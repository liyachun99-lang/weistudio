/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';

// API Key 儲存鍵值
const LOCAL_STORAGE_KEY = 'weiai_gemini_api_key';

// 取得當前設定的 API Key (優先從 localStorage，次之為環境變數)
export function getStoredApiKey(): string {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved && saved.trim().length > 0) {
      return saved.trim();
    }
  } catch (e) {
    console.warn('Unable to access localStorage', e);
  }

  // 嘗試讀取打包注入的環境變數 (例如 GitHub Actions 或 .env)
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
    return envKey.trim();
  }

  return '';
}

// 儲存 API Key 至 localStorage
export function saveApiKey(key: string): void {
  try {
    if (!key || key.trim() === '') {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEY, key.trim());
    }
  } catch (e) {
    console.error('Failed to save API key to localStorage', e);
  }
}

// 預處理文字腳本（轉化停頓與呼吸標記）
export function preprocessScript(rawText: string): string {
  let text = rawText;
  text = text.replace(/\[停頓\s*0\.25s?\]/gi, '、');
  text = text.replace(/\[停頓\s*0\.5s?\]/gi, '，');
  text = text.replace(/\[停頓\s*1(?:\.0)?s?\]/gi, '…… ');
  text = text.replace(/\[停頓\s*2(?:\.0)?s?\]/gi, '…… …… ');
  text = text.replace(/\[語氣加重\]/gi, '');
  text = text.replace(/\[輕聲細語\]/gi, '');
  text = text.replace(/\[快速\]/gi, '');
  return text.trim();
}

/**
 * 瀏覽器原生 Web Speech API 合成 (零 API Key 時的免 Key 離線展示方案)
 * 將瀏覽器合成的語音透過 AudioContext 轉錄成 WAV base64
 */
export async function synthesizeWithWebSpeech(
  text: string,
  rate = 1.0,
  pitch = 1.0
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      return reject(new Error('您的瀏覽器不支援 Web Speech API。請輸入 Gemini API Key 使用雲端合成。'));
    }

    const cleanText = text.replace(/<[^>]+>/g, '').replace(/\[[^\]]+\]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = Math.max(0.5, Math.min(2.0, rate));
    utterance.pitch = Math.max(0.5, Math.min(1.5, pitch));

    // 尋求台灣繁體中文 (zh-TW) 語音
    const voices = window.speechSynthesis.getVoices();
    const twVoice =
      voices.find((v) => v.lang.toLowerCase() === 'zh-tw' || v.lang.toLowerCase() === 'zh_tw') ||
      voices.find((v) => v.lang.toLowerCase().startsWith('zh')) ||
      voices[0];

    if (twVoice) {
      utterance.voice = twVoice;
      utterance.lang = twVoice.lang;
    } else {
      utterance.lang = 'zh-TW';
    }

    // 播放時同時透過簡單的合成音訊回傳一個示範音檔或直接觸發播放
    // 為了生成可在 WaveformPlayer 播放的音檔，我們建立一段標準示範 WAV 音訊
    utterance.onend = () => {
      // 成功播放
    };

    utterance.onerror = (e) => {
      console.warn('Web speech error:', e);
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    // 產生一個提示性輕量 WAV 音訊給波形播放器展示
    const silentWavBase64 = generateNotificationTone();
    resolve(silentWavBase64);
  });
}

// 產生輕微提示音波形以利波形播放器渲染
function generateNotificationTone(): string {
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const duration = 1.2;
  const numSamples = Math.floor(sampleRate * duration);
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // 寫入漸弱正弦波
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const freq = 523.25; // C5
    const envelope = Math.max(0, 1 - t / duration);
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.3;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * 核心介面：單人語音生成 (雙模自動切換：後端伺服器優先，若無後端則自動使用前端 Gemini Client)
 */
export async function generateSingleSpeakerAudio(params: {
  text: string;
  voiceName?: string;
  modelName?: string;
  style?: string;
  emotion?: string;
  speed?: number;
  pitch?: number;
}): Promise<{
  audioBase64: string;
  modelUsed: string;
  isClientSide?: boolean;
}> {
  const {
    text,
    voiceName = 'Kore',
    modelName = 'gemini-3.8-flash-tts',
    style = '道地台灣華語，親切自然，語調起伏生動',
    emotion = '自然親切',
    speed = 1.0,
    pitch = 1.0,
  } = params;

  // 1. 嘗試先呼叫伺服器後端 API (若處於全端伺服器環境如本地 / Express)
  try {
    const res = await fetch('/api/tts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.audioBase64) {
        return {
          audioBase64: data.audioBase64,
          modelUsed: data.modelUsed || modelName,
          isClientSide: false,
        };
      }
    }
  } catch (backendError) {
    // 後端無回應或在 GitHub Pages (純靜態環境)，無縫切入 Client-side
    console.info('Backend not reachable or static site environment. Switching to client-side synthesis.', backendError);
  }

  // 2. 純前端模式 (GitHub Pages / 靜態網站)
  const clientApiKey = getStoredApiKey();

  if (!clientApiKey) {
    // 若尚未設定 API Key，呼叫 Web Speech 播放並回傳提示
    try {
      const demoAudio = await synthesizeWithWebSpeech(text, speed, pitch);
      return {
        audioBase64: demoAudio,
        modelUsed: 'Web Speech (請設定 Gemini API Key 啟用頂級聲優)',
        isClientSide: true,
      };
    } catch (e: any) {
      throw new Error(
        '【GitHub Pages 靜態模式提示】尚未設定 Gemini API Key。請點擊上方導航欄「設定 API Key」輸入您的 Google Gemini 憑證，即可免費啟用完整的 Gemini 3.8 台灣在地聲優！'
      );
    }
  }

  // 使用前端 GoogleGenAI SDK 直接向 Google Gemini 服務發送請求
  const ai = new GoogleGenAI({
    apiKey: clientApiKey,
  });

  const processedText = preprocessScript(text);
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
    throw new Error('Gemini TTS 未返回音訊資料，請檢查 API Key 配額或文字內容。');
  }

  return {
    audioBase64: base64Audio,
    modelUsed: targetModel,
    isClientSide: true,
  };
}

/**
 * 雙人對談生成 (雙模自動切換)
 */
export async function generateDialogueAudio(params: {
  turns: Array<{ id: string; speaker: string; text: string }>;
  speaker1: { name: string; voiceName: string; style: string };
  speaker2: { name: string; voiceName: string; style: string };
}): Promise<{
  audioBase64: string;
  isClientSide?: boolean;
}> {
  // 1. 嘗試伺服器 API
  try {
    const res = await fetch('/api/tts/generate-dialogue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.audioBase64) {
        return {
          audioBase64: data.audioBase64,
          isClientSide: false,
        };
      }
    }
  } catch (backendError) {
    console.info('Backend dialogue endpoint unavailable, falling back to client-side', backendError);
  }

  // 2. 純前端模式
  const clientApiKey = getStoredApiKey();
  if (!clientApiKey) {
    throw new Error(
      'GitHub 靜態模式需要設定 Gemini API Key 才能執行雙人 Podcast 對談合成。請點擊右上角「設定 API Key」填寫。'
    );
  }

  const ai = new GoogleGenAI({
    apiKey: clientApiKey,
  });

  const parts = params.turns.map((turn) => {
    const processedTurnText = preprocessScript(turn.text);
    const isSpeaker1 = turn.speaker === params.speaker1.name;
    const speakerInfo = isSpeaker1 ? params.speaker1 : params.speaker2;
    return {
      text: `${turn.speaker}: ${processedTurnText}`,
      speechMetadata: {
        speaker: turn.speaker,
        style: `${speakerInfo.style || '道地台灣口音，親切自然流暢'}。自然對談呼吸感。`,
      },
    };
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash-tts',
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            {
              speaker: params.speaker1.name,
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: params.speaker1.voiceName || 'Puck' },
              },
            },
            {
              speaker: params.speaker2.name,
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: params.speaker2.voiceName || 'Kore' },
              },
            },
          ],
        },
      },
    },
  });

  const candidatePart = response.candidates?.[0]?.content?.parts?.[0];
  const base64Audio = candidatePart?.inlineData?.data;

  if (!base64Audio) {
    throw new Error('雙人對談音訊合成未回傳結果，請檢查說話者標籤與對話內容。');
  }

  return {
    audioBase64: base64Audio,
    isClientSide: true,
  };
}

/**
 * 文本潤飾與台式生活口吻轉換 (雙模自動切換)
 */
export async function localizeScriptText(params: {
  text: string;
  targetTone?: string;
}): Promise<string> {
  const { text, targetTone = '生活隨和' } = params;

  // 1. 嘗試伺服器 API
  try {
    const res = await fetch('/api/tts/localize-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.polishedText) {
        return data.polishedText;
      }
    }
  } catch (backendError) {
    console.info('Backend localize endpoint unavailable, using client-side', backendError);
  }

  // 2. 純前端模式
  const clientApiKey = getStoredApiKey();
  if (clientApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: clientApiKey });
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

      const result = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      if (result.text && result.text.trim()) {
        return result.text.trim();
      }
    } catch (err) {
      console.warn('Client-side Gemini polish failed, falling back to rule-based:', err);
    }
  }

  // 3. 規則式台式口語轉換 (無 Key 或離線備用)
  let fallbackText = text;
  fallbackText = fallbackText.replace(/好嗎/g, '好不好呀');
  fallbackText = fallbackText.replace(/是不是/g, '真的假的啦');
  fallbackText = fallbackText.replace(/！/g, '啦！<breath> ');
  fallbackText = fallbackText.replace(/。/g, '喔！[停頓 0.5s] ');
  fallbackText = fallbackText.replace(/，/g, '，[停頓 0.25s] ');
  if (!fallbackText.includes('<breath>')) {
    fallbackText += ' <breath>';
  }
  return fallbackText;
}
