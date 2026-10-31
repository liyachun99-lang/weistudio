import React, { useState, useRef } from 'react';
import {
  Radio,
  Plus,
  Trash2,
  Sparkles,
  Play,
  RotateCcw,
  Loader2,
  AlertCircle,
  Copy,
  Users,
  ChevronDown,
} from 'lucide-react';
import { VOAI_VOICES, SAMPLE_DIALOGUES, VoiceActor } from '../data/voices';
import { WaveformPlayer } from './WaveformPlayer';
import { generateDialogueAudio } from '../services/geminiClient';

interface DialogueTurn {
  id: string;
  speaker: string;
  text: string;
}

interface DialogueStudioProps {
  onSaveToHistory: (item: {
    voiceName: string;
    voiceId: string;
    avatar: string;
    accent: string;
    model: string;
    text: string;
    audioBase64: string;
    charCount: number;
  }) => void;
  onOpenGuide: () => void;
  onOpenApiKeyModal?: () => void;
}

export const DialogueStudio: React.FC<DialogueStudioProps> = ({
  onSaveToHistory,
  onOpenGuide,
  onOpenApiKeyModal,
}) => {
  const [speaker1Voice, setSpeaker1Voice] = useState<VoiceActor>(
    VOAI_VOICES.find((v) => v.id === 'yi-chen') || VOAI_VOICES[1]
  );
  const [speaker2Voice, setSpeaker2Voice] = useState<VoiceActor>(
    VOAI_VOICES.find((v) => v.id === 'xiao-qing') || VOAI_VOICES[0]
  );

  const [turns, setTurns] = useState<DialogueTurn[]>([
    {
      id: '1',
      speaker: speaker1Voice.name,
      text: '哈囉大家！歡迎收聽科技漫步。<breath> 今天非常榮幸邀請到資深科技主播曉晴，來跟我們聊聊 Gemini 3.8 的最新語音黑科技！',
    },
    {
      id: '2',
      speaker: speaker2Voice.name,
      text: '奕辰你好，各位聽眾朋友大家好！|yeah| 這次的新模型真的很讓人驚豔，特別是在台灣在地腔調的抑揚頓挫上，表現得極為細膩。',
    },
    {
      id: '3',
      speaker: speaker1Voice.name,
      text: '沒錯！<laugh> 我之前試聽的時候，連那個輕微的吸氣聲跟語助詞都超逼真，根本分不出來是不是真人錄的耶！',
    },
    {
      id: '4',
      speaker: speaker2Voice.name,
      text: '這就是所謂的語音情感建模。|mhm| 不僅是字詞的發音，連對話中的呼吸節奏與情緒共鳴，都能被精準捕捉呈現出來。',
    },
  ]);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);

  const timerRef = useRef<any>(null);

  // 載入預設對白劇本
  const handleLoadSample = (index: number) => {
    const sample = SAMPLE_DIALOGUES[index];
    if (!sample) return;

    // 比對說話者聲優
    if (index === 0) {
      const v1 = VOAI_VOICES.find((v) => v.name === '奕辰') || speaker1Voice;
      const v2 = VOAI_VOICES.find((v) => v.name === '曉晴') || speaker2Voice;
      setSpeaker1Voice(v1);
      setSpeaker2Voice(v2);
    } else {
      const v1 = VOAI_VOICES.find((v) => v.name === '佳玲') || speaker1Voice;
      const v2 = VOAI_VOICES.find((v) => v.name === '美玉阿姨') || speaker2Voice;
      setSpeaker1Voice(v1);
      setSpeaker2Voice(v2);
    }

    setTurns(
      sample.turns.map((t, i) => ({
        id: String(i + 1),
        speaker: t.speaker,
        text: t.text,
      }))
    );
  };

  // 新增台詞
  const handleAddTurn = () => {
    const lastTurn = turns[turns.length - 1];
    const nextSpeaker =
      lastTurn?.speaker === speaker1Voice.name ? speaker2Voice.name : speaker1Voice.name;
    setTurns((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        speaker: nextSpeaker,
        text: '',
      },
    ]);
  };

  // 刪除台詞
  const handleDeleteTurn = (id: string) => {
    if (turns.length <= 1) return;
    setTurns((prev) => prev.filter((t) => t.id !== id));
  };

  // 修改台詞文字
  const handleTextChange = (id: string, newText: string) => {
    setTurns((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text: newText } : t))
    );
  };

  // 修改說話者
  const handleSpeakerChange = (id: string, newSpeaker: string) => {
    setTurns((prev) =>
      prev.map((t) => (t.id === id ? { ...t, speaker: newSpeaker } : t))
    );
  };

  // 插入語法標籤
  const handleInsertTag = (id: string, tag: string) => {
    setTurns((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text: t.text + tag } : t))
    );
  };

  // 生成對談音訊
  const handleGenerateDialogue = async () => {
    const validTurns = turns.filter((t) => t.text.trim().length > 0);
    if (validTurns.length === 0) {
      setErrorMessage('請輸入至少一句對話台詞。');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setElapsedTime(0);
    const startTime = Date.now();

    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 100) / 10);
    }, 100);

    try {
      const result = await generateDialogueAudio({
        turns: validTurns,
        speaker1: {
          name: speaker1Voice.name,
          voiceName: speaker1Voice.geminiVoice,
          style: speaker1Voice.stylePrompt,
        },
        speaker2: {
          name: speaker2Voice.name,
          voiceName: speaker2Voice.geminiVoice,
          style: speaker2Voice.stylePrompt,
        },
      });

      setGeneratedAudio(result.audioBase64);

      const combinedText = validTurns.map((t) => `${t.speaker}: ${t.text}`).join(' ');

      onSaveToHistory({
        voiceName: `${speaker1Voice.name} & ${speaker2Voice.name}`,
        voiceId: `${speaker1Voice.id}_${speaker2Voice.id}`,
        avatar: speaker1Voice.avatar,
        accent: '雙人對談 Podcast',
        model: 'gemini-3.8-flash-tts',
        text: combinedText,
        audioBase64: result.audioBase64,
        charCount: combinedText.length,
      });
    } catch (err: any) {
      console.error('Dialogue generate error:', err);
      setErrorMessage(err.message || '生成失敗，請檢查 API Key 或網路重試。');
    } finally {
      clearInterval(timerRef.current);
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 頂部引言 */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-2">
              <Radio className="w-3.5 h-3.5" />
              WEIAI Studio × Gemini 3.8 雙人對談 Podcast 工作室
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              多人角色對白與 Podcast 訪談生成
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              使用 Gemini 3.8 原生 <code>multiSpeakerVoiceConfig</code> 雙人語音架構。
              支援雙方互相接話、反饋附和（|mhm|、|yeah|）、自然笑聲與呼吸，打造媲美錄音室品質的雙人中文節目。
            </p>
          </div>

          {/* 預設劇本選擇 */}
          <div className="flex items-center gap-2 shrink-0">
            {SAMPLE_DIALOGUES.map((s, idx) => (
              <button
                key={s.title}
                onClick={() => handleLoadSample(idx)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
              >
                帶入：{s.title}
              </button>
            ))}
          </div>
        </div>

        {/* 雙說話者聲優指定列 */}
        <div className="mt-5 pt-5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Speaker 1 */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={speaker1Voice.avatar}
                  alt={speaker1Voice.name}
                  className="w-11 h-11 rounded-xl object-cover border border-cyan-500/40"
                />
                <span className="absolute -top-1.5 -left-1.5 bg-cyan-600 text-white text-[10px] font-bold px-1.5 rounded-md">
                  1
                </span>
              </div>
              <div>
                <p className="text-[11px] text-cyan-400 font-semibold">說話者 1 (主持人)</p>
                <h4 className="font-bold text-sm text-white">{speaker1Voice.name}</h4>
                <p className="text-[11px] text-slate-400">{speaker1Voice.accent}</p>
              </div>
            </div>

            <select
              value={speaker1Voice.id}
              onChange={(e) => {
                const found = VOAI_VOICES.find((v) => v.id === e.target.value);
                if (found) setSpeaker1Voice(found);
              }}
              className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              {VOAI_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.geminiVoice})
                </option>
              ))}
            </select>
          </div>

          {/* Speaker 2 */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={speaker2Voice.avatar}
                  alt={speaker2Voice.name}
                  className="w-11 h-11 rounded-xl object-cover border border-indigo-500/40"
                />
                <span className="absolute -top-1.5 -left-1.5 bg-indigo-600 text-white text-[10px] font-bold px-1.5 rounded-md">
                  2
                </span>
              </div>
              <div>
                <p className="text-[11px] text-indigo-400 font-semibold">說話者 2 (嘉賓/對手戲)</p>
                <h4 className="font-bold text-sm text-white">{speaker2Voice.name}</h4>
                <p className="text-[11px] text-slate-400">{speaker2Voice.accent}</p>
              </div>
            </div>

            <select
              value={speaker2Voice.id}
              onChange={(e) => {
                const found = VOAI_VOICES.find((v) => v.id === e.target.value);
                if (found) setSpeaker2Voice(found);
              }}
              className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              {VOAI_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.geminiVoice})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 對話輪次列表 */}
      <div className="space-y-3">
        {turns.map((turn, index) => {
          const isSpeaker1 = turn.speaker === speaker1Voice.name;
          const currentActor = isSpeaker1 ? speaker1Voice : speaker2Voice;

          return (
            <div
              key={turn.id}
              className={`bg-slate-900/90 border rounded-2xl p-4 transition-all ${
                isSpeaker1
                  ? 'border-cyan-500/30 bg-slate-900/90'
                  : 'border-indigo-500/30 bg-slate-900/70'
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-mono">
                    {index + 1}
                  </span>

                  <img
                    src={currentActor.avatar}
                    alt={turn.speaker}
                    className="w-7 h-7 rounded-lg object-cover"
                  />

                  {/* 切換說話者按鈕 */}
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleSpeakerChange(turn.id, speaker1Voice.name)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        turn.speaker === speaker1Voice.name
                          ? 'bg-cyan-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {speaker1Voice.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSpeakerChange(turn.id, speaker2Voice.name)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        turn.speaker === speaker2Voice.name
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {speaker2Voice.name}
                    </button>
                  </div>
                </div>

                {/* 快捷插入小標籤 */}
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    onClick={() => handleInsertTag(turn.id, ' <breath>')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-mono"
                    title="插入換氣"
                  >
                    &lt;breath&gt;
                  </button>
                  <button
                    onClick={() => handleInsertTag(turn.id, ' <laugh>')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-mono"
                    title="插入笑聲"
                  >
                    &lt;laugh&gt;
                  </button>
                  <button
                    onClick={() => handleInsertTag(turn.id, ' |mhm| ')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 font-mono"
                    title="插入附和音"
                  >
                    |mhm|
                  </button>

                  <button
                    onClick={() => handleDeleteTurn(turn.id)}
                    disabled={turns.length <= 1}
                    className="p-1 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 disabled:opacity-30 ml-2"
                    title="刪除此句"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 台詞文字框 */}
              <textarea
                value={turn.text}
                onChange={(e) => handleTextChange(turn.id, e.target.value)}
                rows={2}
                placeholder={`${turn.speaker} 的台詞內容...`}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 leading-relaxed font-sans resize-none"
              />
            </div>
          );
        })}

        {/* 新增台詞按鈕 */}
        <button
          onClick={handleAddTurn}
          className="w-full py-3 rounded-2xl bg-slate-900 border border-dashed border-slate-700 hover:border-cyan-500 hover:bg-slate-850 text-slate-300 hover:text-cyan-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          新增對話台詞 (接續下一句)
        </button>
      </div>

      {/* 錯誤訊息 */}
      {errorMessage && (
        <div className="bg-red-950/80 border border-red-800 text-red-200 rounded-2xl p-4 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1">{errorMessage}</div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenApiKeyModal && (
              <button
                type="button"
                onClick={onOpenApiKeyModal}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 font-semibold transition-all"
              >
                立即設定 API Key
              </button>
            )}
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-white px-2 py-1"
            >
              關閉
            </button>
          </div>
        </div>
      )}

      {/* 底部生成按鈕 */}
      <div>
        <button
          onClick={handleGenerateDialogue}
          disabled={isGenerating}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              <span>Gemini 3.8 雙人對談音訊合成中 ({elapsedTime.toFixed(1)}s)...</span>
            </>
          ) : (
            <>
              <Radio className="w-4 h-4 fill-slate-950 text-slate-950" />
              <span>一鍵生成雙人 Podcast 完整對談音檔</span>
            </>
          )}
        </button>
      </div>

      {/* 播放器 */}
      <WaveformPlayer
        audioBase64={generatedAudio}
        title={`雙人對談：${speaker1Voice.name} & ${speaker2Voice.name}`}
        subtitle={`共 ${turns.length} 輪對話 • Gemini 3.8 Flash TTS 原生雙人多聲線合成`}
        autoPlay={true}
      />
    </div>
  );
};
