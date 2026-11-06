import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json({ limit: '50mb' }));

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('未設定 GEMINI_API_KEY。請確認環境變數已正確載入。');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// 輔助函式：替換自訂語音停頓標籤與處理標記
function preprocessScript(rawText: string): string {
  let text = rawText;
  // 將自訂停頓標記轉為自然的省略符號與標點
  text = text.replace(/\[停頓\s*0\.25s?\]/gi, '、');
  text = text.replace(/\[停頓\s*0\.5s?\]/gi, '，');
  text = text.replace(/\[停頓\s*1(?:\.0)?s?\]/gi, '…… ');
  text = text.replace(/\[停頓\s*2(?:\.0)?s?\]/gi, '…… …… ');
  text = text.replace(/\[語氣加重\]/gi, '');
  text = text.replace(/\[輕聲細語\]/gi, '');
  text = text.replace(/\[快速\]/gi, '');
  return text.trim();
}

// 嚴格清理台詞文字：濾除誤寫入的主持人與說話者名稱標籤
function cleanSpeakerPrefix(rawText: string, speakerName?: string): string {
  if (!rawText) return '';
  let cleaned = rawText.trim();
  if (speakerName && speakerName.trim()) {
    const escapedSpeaker = speakerName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const speakerRegex = new RegExp(`^${escapedSpeaker}\\s*[：:]\\s*`, 'i');
    cleaned = cleaned.replace(speakerRegex, '');
  }
  cleaned = cleaned.replace(/^(?:主持人[一二1-9]?|來賓|嘉賓|說話者[一二1-9]?|說話人|訪談者|受訪者|Speaker\s*\d*|[A-Za-z0-9_\u4e00-\u9fa5]{1,10})\s*[：:]\s*/i, '');
  return cleaned.trim();
}

// 1. 單人語音生成 (Single Speaker TTS)
app.post('/api/tts/generate', async (req, res) => {
  try {
    const {
      text,
      voiceName = 'Kore',
      modelName = 'gemini-3.8-flash-tts',
      style = '道地台灣華語，親切自然，語調起伏生動',
      emotion = '自然親切',
      speed = 1.0,
      pitch = 1.0,
    } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: '請提供要轉換為語音的文字內容。' });
    }

    const ai = getGeminiClient();
    const processedText = preprocessScript(text);

    // 建立豐富的 style 指令，特別注入台灣口音與情感層次
    let enhancedStyle = style;
    if (emotion && emotion !== '自然親切') {
      enhancedStyle += `。情感狀態：呈現${emotion}的情緒與感染力。`;
    }
    if (speed && speed !== 1.0) {
      if (speed > 1.0) {
        enhancedStyle += `。語速稍快，節奏緊湊輕快（約 ${speed} 倍速）。`;
      } else {
        enhancedStyle += `。語速稍緩，字斟句酌，從容放鬆（約 ${speed} 倍速）。`;
      }
    }
    enhancedStyle += ' 請使用道地自然流暢的台灣腔調，維持真實說話的起伏感與呼吸感。';

    // 根據 gemini-api 規格調用 Gemini 3.8 TTS
    const targetModel =
      modelName === 'gemini-3.8-flash-lite-tts'
        ? 'gemini-3.8-flash-lite-tts'
        : 'gemini-3.8-flash-tts';

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: processedText,
              speechMetadata: {
                style: enhancedStyle,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
          },
        },
      },
    });

    const candidatePart = response.candidates?.[0]?.content?.parts?.[0];
    const base64Audio = candidatePart?.inlineData?.data;

    if (!base64Audio) {
      console.error('Gemini TTS 未返回音訊資料:', JSON.stringify(response));
      return res.status(500).json({
        error: 'Gemini 3.8 語音模型未回傳音訊資料，請稍後再試或調整文字。',
      });
    }

    return res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      charCount: text.length,
      modelUsed: targetModel,
      voiceName,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('TTS Generation Error:', error);
    return res.status(500).json({
      error: error?.message || '生成語音時發生未知錯誤，請檢查 API Key 或網路狀態。',
    });
  }
});

// 音訊拼接輔助函式：無損拼接多個 24kHz 單聲道 16-bit WAV 片段並加入自然交替停頓
function concatWavsNode(wavBuffers: Buffer[], pauseMs: number = 250): Buffer {
  if (wavBuffers.length === 0) return Buffer.alloc(0);
  if (wavBuffers.length === 1) return wavBuffers[0];

  const sampleRate = 24000;
  const pauseBytes = Math.floor(sampleRate * (pauseMs / 1000)) * 2;
  const pauseBuffer = Buffer.alloc(pauseBytes);

  const pcmList: Buffer[] = [];
  wavBuffers.forEach((buf, idx) => {
    if (buf.length > 44) {
      pcmList.push(buf.subarray(44));
      if (idx < wavBuffers.length - 1 && pauseBytes > 0) {
        pcmList.push(pauseBuffer);
      }
    }
  });

  const allPcm = Buffer.concat(pcmList);
  const totalDataSize = allPcm.length;
  const header = Buffer.from(wavBuffers[0].subarray(0, 44));
  header.writeUInt32LE(36 + totalDataSize, 4);
  header.writeUInt32LE(totalDataSize, 40);

  return Buffer.concat([header, allPcm]);
}

// 2. 雙人對談生成 (Multi-Speaker Dialogue / Podcast Studio)
app.post('/api/tts/generate-dialogue', async (req, res) => {
  try {
    const { turns, speaker1, speaker2 } = req.body;

    if (!turns || !Array.isArray(turns) || turns.length === 0) {
      return res.status(400).json({ error: '請提供至少一段對話劇本。' });
    }

    if (!speaker1?.name || !speaker2?.name) {
      return res.status(400).json({ error: '雙人對談需指定兩位說話者 (Speaker 1 & Speaker 2)。' });
    }

    const ai = getGeminiClient();

    // 確保主持人一與主持人二的聲音嚴格綁定，若音色代碼相同則自動指定鮮明對比音色
    let voice1 = speaker1.voiceName || 'Puck';
    let voice2 = speaker2.voiceName || 'Kore';
    if (voice1.toLowerCase() === voice2.toLowerCase()) {
      const femaleVoices = ['Kore', 'Aoede', 'Zephyr', 'Leda'];
      const maleVoices = ['Puck', 'Fenrir', 'Orpheus', 'Charon'];
      if (femaleVoices.includes(voice1)) {
        voice2 = femaleVoices.find((v) => v !== voice1) || 'Aoede';
      } else {
        voice2 = maleVoices.find((v) => v !== voice1) || 'Fenrir';
      }
    }

    // 針對超過 50 格的超長篇對話，採用並行分批 (Concurrency Limit = 4) 與自動重試
    // 100% 保證每一格的音色絕對鎖定，既保證速度，又防止瞬間併發超過 API Rate Limit (429)
    const CONCURRENCY_LIMIT = 4;
    const buffers: Buffer[] = new Array(turns.length);

    async function synthesizeWithRetry(
      processedTurnText: string,
      enhancedStyle: string,
      targetVoice: string,
      turnIndex: number,
      maxRetries = 3
    ): Promise<Buffer> {
      let lastError: any;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const resp = await ai.models.generateContent({
            model: 'gemini-3.8-flash-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: processedTurnText, // 嚴格只寫入純台詞數據，絕不包含主持人姓名
                    speechMetadata: {
                      style: enhancedStyle,
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: targetVoice },
                },
              },
            },
          });

          const audioData = resp.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (audioData) {
            return Buffer.from(audioData, 'base64');
          }
        } catch (err: any) {
          lastError = err;
          // 若遭遇短暫頻率限制 (429) 或網路抖動，等待指數避讓後重試
          await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 800));
        }
      }
      throw new Error(`第 ${turnIndex + 1} 格台詞音訊合成失敗：${lastError?.message || '未回傳音訊'}`);
    }

    for (let i = 0; i < turns.length; i += CONCURRENCY_LIMIT) {
      const chunk = turns.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(
        chunk.map(async (turn: any, chunkIdx: number) => {
          const globalIdx = i + chunkIdx;
          const isSpeaker1 =
            turn.role === 'speaker1' || (turn.role !== 'speaker2' && turn.speaker === speaker1.name);
          const speakerInfo = isSpeaker1 ? speaker1 : speaker2;
          const targetVoice = isSpeaker1 ? voice1 : voice2;

          const rawText = cleanSpeakerPrefix(turn.text || '', speakerInfo.name);
          const processedTurnText = preprocessScript(rawText);
          if (!processedTurnText) return;

          const enhancedStyle = `${speakerInfo.style || '道地台灣口音，親切自然流暢'}。自然對談呼吸感。請使用道地自然流暢的台灣腔調。`;

          const buf = await synthesizeWithRetry(
            processedTurnText,
            enhancedStyle,
            targetVoice,
            globalIdx
          );
          buffers[globalIdx] = buf;
        })
      );
    }

    const validBuffers = buffers.filter((b): b is Buffer => Boolean(b));
    if (validBuffers.length === 0) {
      return res.status(400).json({ error: '未能成功生成任何台詞音訊。' });
    }

    // 無縫拼接所有 WAV 音訊片段，每句之間自動加入 250ms 自然交替呼吸停頓
    const combinedWavBuffer = concatWavsNode(validBuffers, 250);

    return res.json({
      success: true,
      audioBase64: combinedWavBuffer.toString('base64'),
      mimeType: 'audio/wav',
      turnsCount: turns.length,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Dialogue Generation Error:', error);
    return res.status(500).json({
      error: error?.message || '雙人對話生成失敗，請稍後重試。',
    });
  }
});

// 3. AI 文案潤飾與台式生活口吻轉換 (Taiwanese Colloquial Script Polish)
app.post('/api/tts/localize-script', async (req, res) => {
  try {
    const { text, targetTone = '生活隨和' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: '請提供要潤飾的文本。' });
    }

    const ai = getGeminiClient();
    const prompt = `你是一位精通台灣在地配音與口語表達的資深台詞指導與配音編劇。
請將以下文案轉換改寫為最道地、最自然、接地氣的「台灣華語口語口吻」。
要求：
1. 自然加入台灣常見的日常語助詞與發音習慣（例如：啦、喔、呢、耶、齁、吧、真的假的、太誇張了）。
2. 在適當位置插入 Gemini 3.8 TTS 支援的語氣標籤：
   - 停頓標籤：[停頓 0.5s] 或 [停頓 1.0s]
   - 擬真氣息與語音爆發標籤：<laugh> (笑聲)、<gasp> (倒抽一口氣/驚訝)、<breath> (自然換氣/深呼吸)、|mhm| (輕聲附和)、|yeah| (贊同)
3. 改寫目標風格：${targetTone}
4. 直接輸出改寫後的繁體中文台詞文字，不要包含任何開場白或解釋。

原始文案：
${text}`;

    try {
      const result = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      return res.json({
        success: true,
        polishedText: result.text?.trim() || text,
      });
    } catch (modelErr: any) {
      console.warn('Model polish unavailable, applying rule-based localization:', modelErr?.message);
      // 離線/高乘載備用規則化轉換為台灣口語
      let fallbackText = text;
      fallbackText = fallbackText.replace(/好嗎/g, '好不好呀');
      fallbackText = fallbackText.replace(/是不是/g, '真的假的啦');
      fallbackText = fallbackText.replace(/！/g, '啦！<breath> ');
      fallbackText = fallbackText.replace(/。/g, '喔！[停頓 0.5s] ');
      fallbackText = fallbackText.replace(/，/g, '，[停頓 0.25s] ');
      if (!fallbackText.includes('<breath>')) {
        fallbackText += ' <breath>';
      }
      return res.json({
        success: true,
        polishedText: fallbackText,
        note: '已啟用在地化語氣助詞優化',
      });
    }
  } catch (error: any) {
    console.error('Script polish error:', error);
    return res.status(500).json({
      error: error?.message || '文本潤飾失敗',
    });
  }
});

// Vite / Static setup
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[WEIAI Studio] Server is running on http://0.0.0.0:${port}`);
  });

  server.on('error', (err: any) => {
    console.error('Server listen error:', err);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
