import React, { useState, useRef } from 'react';
import {
  Mic2,
  Sparkles,
  Volume2,
  Sliders,
  RotateCcw,
  Copy,
  Check,
  Wand2,
  Clock,
  Layers,
  ArrowRight,
  Info,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { VoiceActor, SAMPLE_SCRIPTS, VOAI_VOICES } from '../data/voices';
import { WaveformPlayer } from './WaveformPlayer';
import { estimateDuration } from '../utils/audio';
import { generateSingleSpeakerAudio, localizeScriptText } from '../services/geminiClient';

interface SingleSpeakerStudioProps {
  currentVoice: VoiceActor;
  onSelectVoice: (voice: VoiceActor) => void;
  onNavigateToVoices: () => void;
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

const EMOTIONS = [
  { id: '自然親切', label: '自然親切', icon: '😊' },
  { id: '熱情開朗', label: '熱情開朗', icon: '🔥' },
  { id: '沉穩知性', label: '沉穩知性', icon: '👓' },
  { id: '溫柔療癒', label: '溫柔療癒', icon: '🌿' },
  { id: '權威嚴肅', label: '權威嚴肅', icon: '⚖️' },
  { id: '幽默風趣', label: '幽默風趣', icon: '😄' },
  { id: '悲傷感傷', label: '悲傷感傷', icon: '💧' },
  { id: '懸疑緊張', label: '懸疑緊張', icon: '🕵️' },
];

export const SingleSpeakerStudio: React.FC<SingleSpeakerStudioProps> = ({
  currentVoice,
  onSelectVoice,
  onNavigateToVoices,
  onSaveToHistory,
  onOpenGuide,
  onOpenApiKeyModal,
}) => {
  const [text, setText] = useState<string>(
    '早安！歡迎收看今日晨間整點新聞。<breath> 中央氣象署表示，受東北季風增強影響，北部與東半部地區轉為濕涼有雨的天氣，[停頓 0.5s] 出門請記得攜帶雨具喔！'
  );
  const [modelName, setModelName] = useState<'gemini-3.8-flash-tts' | 'gemini-3.8-flash-lite-tts'>(
    currentVoice.recommendedModel || 'gemini-3.8-flash-tts'
  );
  const [selectedEmotion, setSelectedEmotion] = useState<string>('自然親切');
  const [speed, setSpeed] = useState<number>(currentVoice.defaultSpeed || 1.0);
  const [pitch, setPitch] = useState<number>(currentVoice.defaultPitch || 1.0);
  const [customStyle, setCustomStyle] = useState<string>(currentVoice.stylePrompt);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showVoicePicker, setShowVoicePicker] = useState<boolean>(false);

  // 生成狀態
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPolishing, setIsPolishing] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const timerRef = useRef<any>(null);

  // 當選擇的聲優改變時，同步更新推薦模型與提示詞
  React.useEffect(() => {
    setModelName(currentVoice.recommendedModel);
    setCustomStyle(currentVoice.stylePrompt);
    setSpeed(currentVoice.defaultSpeed);
    setPitch(currentVoice.defaultPitch);
  }, [currentVoice]);

  // 插入語法標籤至游標所在位置
  const insertTagAtCursor = (tag: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newText = text.substring(0, start) + tag + text.substring(end);
    setText(newText);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + tag.length;
      }
    }, 50);
  };

  // 一鍵 AI 潤飾為台式口語 (支援全端後端與純前端 GitHub Pages 雙模)
  const handleAILocalize = async () => {
    if (!text.trim()) return;
    setIsPolishing(true);
    setErrorMessage(null);
    try {
      const polished = await localizeScriptText({
        text,
        targetTone: `${currentVoice.accent}，${selectedEmotion}`,
      });
      setText(polished);
    } catch (err: any) {
      setErrorMessage(err.message || '潤飾發生錯誤');
    } finally {
      setIsPolishing(false);
    }
  };

  // 生成語音 (雙模自動適配)
  const handleGenerateTTS = async () => {
    if (!text.trim()) {
      setErrorMessage('請先輸入想要朗讀的台詞或文案內容。');
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
      const result = await generateSingleSpeakerAudio({
        text,
        voiceName: currentVoice.geminiVoice,
        modelName,
        style: customStyle,
        emotion: selectedEmotion,
        speed,
        pitch,
      });

      setGeneratedAudio(result.audioBase64);

      // 儲存至歷史紀錄
      onSaveToHistory({
        voiceName: currentVoice.name,
        voiceId: currentVoice.id,
        avatar: currentVoice.avatar,
        accent: currentVoice.accent,
        model: result.modelUsed || modelName,
        text,
        audioBase64: result.audioBase64,
        charCount: text.length,
      });
    } catch (err: any) {
      console.error('Generation error:', err);
      setErrorMessage(err.message || '語音生成發生錯誤，請檢查 API Key 或網路重試。');
    } finally {
      clearInterval(timerRef.current);
      setIsGenerating(false);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 工作台主版面 (左側/中央編輯器 + 右側參數面板) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左側與中間：腳本編輯器 (8 Cols) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between h-full">
            {/* 編輯器頂部工具列 */}
            <div className="space-y-3 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                    台詞
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                      腳本內容編輯
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      支援插入台灣腔語氣呼吸標籤與停頓語法
                    </p>
                  </div>
                </div>

                {/* 範本選擇下拉選單 */}
                <div className="flex items-center gap-2">
                  <select
                    onChange={(e) => {
                      const idx = parseInt(e.target.value);
                      if (!isNaN(idx) && SAMPLE_SCRIPTS[idx]) {
                        setText(SAMPLE_SCRIPTS[idx].text);
                        const matchedVoice = VOAI_VOICES.find(
                          (v) => v.id === SAMPLE_SCRIPTS[idx].voiceId
                        );
                        if (matchedVoice) onSelectVoice(matchedVoice);
                      }
                    }}
                    defaultValue=""
                    className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="" disabled>
                      📋 快速套用情境範本文案...
                    </option>
                    {SAMPLE_SCRIPTS.map((s, idx) => (
                      <option key={s.title} value={idx}>
                        {s.title}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setText('')}
                    className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
                    title="清空文字"
                  >
                    清空
                  </button>

                  <button
                    onClick={handleCopyText}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    title="複製文字"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 語氣標籤快捷工具列 */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 pl-1 pr-1.5 border-r border-slate-800">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  快捷標籤：
                </span>

                <button
                  type="button"
                  onClick={() => insertTagAtCursor('[停頓 0.5s]')}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60"
                  title="插入半秒停頓"
                >
                  停頓 0.5s
                </button>
                <button
                  type="button"
                  onClick={() => insertTagAtCursor('[停頓 1.0s]')}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60"
                  title="插入一秒長停頓"
                >
                  停頓 1.0s
                </button>
                <button
                  type="button"
                  onClick={() => insertTagAtCursor('<breath> ')}
                  className="px-2 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 hover:text-cyan-200 transition-colors border border-cyan-700/50 font-mono"
                  title="插入自然吸氣/換氣聲"
                >
                  &lt;breath&gt; 換氣
                </button>
                <button
                  type="button"
                  onClick={() => insertTagAtCursor('<laugh> ')}
                  className="px-2 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 hover:text-amber-200 transition-colors border border-amber-700/50 font-mono"
                  title="插入輕笑聲"
                >
                  &lt;laugh&gt; 輕笑
                </button>
                <button
                  type="button"
                  onClick={() => insertTagAtCursor('<gasp> ')}
                  className="px-2 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 hover:text-purple-200 transition-colors border border-purple-700/50 font-mono"
                  title="插入驚訝抽氣聲"
                >
                  &lt;gasp&gt; 驚嘆
                </button>

                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleAILocalize}
                    disabled={isPolishing || !text.trim()}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium shadow-sm transition-all disabled:opacity-50"
                    title="透過 Gemini 3.8 自動將文案潤飾為道地台灣口語"
                  >
                    {isPolishing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">AI 台式口語潤飾</span>
                    <span className="sm:hidden">潤飾</span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenGuide}
                    className="p-1 text-slate-400 hover:text-cyan-300"
                    title="語法指南"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* 文字輸入區域 */}
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="請輸入想要轉為語音的繁體中文文字內容，可隨時點擊上方按鈕插入自然換氣 <breath> 或輕笑 <laugh> 標籤..."
                rows={10}
                className="w-full h-full min-h-[220px] bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 leading-relaxed font-sans resize-none transition-all"
              />
            </div>

            {/* 編輯器底部計數資訊 */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
              <div className="flex items-center gap-4">
                <span>
                  字數統計：<strong className="text-cyan-400 font-mono">{text.length}</strong> 字
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  預估時長：約{' '}
                  <strong className="text-slate-300 font-mono">
                    {estimateDuration(text.length, speed)}
                  </strong>{' '}
                  秒
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                支援台灣華語口語助詞（啦、喔、呢、耶、齁）
              </span>
            </div>
          </div>
        </div>

        {/* 右側：聲優選擇與語音風格調教面板 (4-5 Cols) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
            {/* 當前聲優資訊卡片 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Mic2 className="w-3.5 h-3.5 text-cyan-400" />
                  目前選用 AI 聲優
                </span>
                <button
                  onClick={onNavigateToVoices}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
                >
                  瀏覽全部聲優庫 <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={currentVoice.avatar}
                    alt={currentVoice.name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-700 shadow-md"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-white">
                        {currentVoice.name}
                      </h4>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/60">
                        {currentVoice.profession}
                      </span>
                    </div>
                    <p className="text-xs text-cyan-400 font-medium mt-0.5">
                      {currentVoice.accent}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowVoicePicker(!showVoicePicker)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                >
                  切換
                </button>
              </div>

              {/* 快捷聲優切換下拉列表 */}
              {showVoicePicker && (
                <div className="mt-2 p-2 bg-slate-950 border border-slate-750 rounded-2xl grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto animate-in fade-in duration-150">
                  {VOAI_VOICES.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        onSelectVoice(v);
                        setShowVoicePicker(false);
                      }}
                      className={`flex items-center gap-2 p-1.5 rounded-xl text-left transition-all ${
                        currentVoice.id === v.id
                          ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40'
                          : 'hover:bg-slate-800/80 text-slate-300'
                      }`}
                    >
                      <img
                        src={v.avatar}
                        alt={v.name}
                        className="w-7 h-7 rounded-lg object-cover"
                      />
                      <div className="truncate">
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-bold leading-none truncate">{v.name}</p>
                        </div>
                        <p className="text-[10px] text-cyan-400 font-medium truncate mt-0.5">
                          {v.profession} • {v.category}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 模型選擇 */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                Gemini 3.8 語音模型架構
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModelName('gemini-3.8-flash-tts')}
                  className={`p-3 rounded-2xl text-left border transition-all ${
                    modelName === 'gemini-3.8-flash-tts'
                      ? 'bg-gradient-to-br from-cyan-950/70 to-slate-900 border-cyan-500 text-white shadow-md shadow-cyan-950/30'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-cyan-300">
                      Flash TTS (旗艦)
                    </span>
                    <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded font-mono">
                      推薦
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                    支援 Voice Design、細膩情緒起伏與呼吸聲
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setModelName('gemini-3.8-flash-lite-tts')}
                  className={`p-3 rounded-2xl text-left border transition-all ${
                    modelName === 'gemini-3.8-flash-lite-tts'
                      ? 'bg-gradient-to-br from-cyan-950/70 to-slate-900 border-cyan-500 text-white shadow-md shadow-cyan-950/30'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-200">
                      Lite TTS (極速)
                    </span>
                    <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                      低延遲
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                    極致低延遲、成本優化，適合長文快讀
                  </p>
                </button>
              </div>
            </div>

            {/* 情感狀態選擇 */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                情感風格 (Emotion)
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {EMOTIONS.map((emo) => (
                  <button
                    key={emo.id}
                    type="button"
                    onClick={() => setSelectedEmotion(emo.id)}
                    className={`py-2 px-1 rounded-xl text-center text-xs transition-all border flex flex-col items-center gap-1 ${
                      selectedEmotion === emo.id
                        ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300 font-bold'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-base">{emo.icon}</span>
                    <span className="text-[11px]">{emo.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 語速與音調控制 */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-400 font-medium">朗讀語速</span>
                  <div className="flex items-center gap-1 font-mono text-cyan-400 font-bold">
                    <span>{speed.toFixed(2)}x</span>
                    {speed !== 1.0 && (
                      <button
                        onClick={() => setSpeed(1.0)}
                        className="text-[10px] text-slate-500 hover:text-slate-300 ml-1"
                      >
                        重設
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={0.75}
                  max={1.5}
                  step={0.05}
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                  <span>徐緩 (0.75x)</span>
                  <span>標準 (1.0x)</span>
                  <span>輕快 (1.5x)</span>
                </div>
              </div>
            </div>

            {/* 進階 Voice Design 提示詞摺疊面板 */}
            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-cyan-300 transition-colors py-1"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Sliders className="w-3.5 h-3.5" />
                  自訂 Voice Design 語音風格指令 (進階)
                </span>
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showAdvanced && (
                <div className="mt-2 space-y-2 animate-in fade-in duration-200">
                  <p className="text-[11px] text-slate-500">
                    此欄位將直接傳送給 Gemini 3.8 的 <code>speechMetadata.style</code>
                    ，精確控制發音口音、說話者角色性格與起伏。
                  </p>
                  <textarea
                    value={customStyle}
                    onChange={(e) => setCustomStyle(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 leading-relaxed font-mono"
                    placeholder="輸入詳細的聲音人設風格指令..."
                  />
                  <button
                    type="button"
                    onClick={() => setCustomStyle(currentVoice.stylePrompt)}
                    className="text-[11px] text-cyan-400 hover:underline"
                  >
                    恢復此聲優預設風格提示詞
                  </button>
                </div>
              )}
            </div>

            {/* 核心合成按鈕 */}
            <div className="pt-2">
              <button
                onClick={handleGenerateTTS}
                disabled={isGenerating || !text.trim()}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:via-sky-400 hover:to-blue-500 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Gemini 3.8 語音合成中 ({elapsedTime.toFixed(1)}s)...</span>
                  </>
                ) : (
                  <>
                    <Mic2 className="w-4 h-4 fill-slate-950 text-slate-950" />
                    <span>生成 Gemini 3.8 擬真語音</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 錯誤訊息條 */}
      {errorMessage && (
        <div className="bg-red-950/80 border border-red-800 text-red-200 rounded-2xl p-4 text-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
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

      {/* 音訊播放器 */}
      <div className="pt-2">
        <WaveformPlayer
          audioBase64={generatedAudio}
          title={`${currentVoice.name} - ${currentVoice.accent}`}
          subtitle={`模型：${modelName} • 風格：${selectedEmotion} • 語速：${speed}x`}
          autoPlay={true}
        />
      </div>
    </div>
  );
};
