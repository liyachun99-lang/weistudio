import React, { useState, useRef, useEffect } from 'react';
import {
  Radio,
  Plus,
  Trash2,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Loader2,
  AlertCircle,
  Users,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Zap,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { VOAI_VOICES, SAMPLE_DIALOGUES, VoiceActor } from '../data/voices';
import { WaveformPlayer } from './WaveformPlayer';
import {
  generateSingleSpeakerAudio,
  concatWavBuffersClient,
  cleanSpeakerPrefix,
  preprocessScript,
} from '../services/geminiClient';

export interface DialogueTurn {
  id: string;
  role: 'speaker1' | 'speaker2';
  text: string;
  audioBase64?: string;
  status?: 'idle' | 'generating' | 'ready' | 'error';
  errorMessage?: string;
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

  // 嚴格綁定 role: 'speaker1' (主持人一) 與 'speaker2' (主持人二)，不以名稱字串作為鍵值
  const [turns, setTurns] = useState<DialogueTurn[]>([
    {
      id: '1',
      role: 'speaker1',
      text: '哈囉大家！歡迎收聽科技漫步。<breath> 今天非常榮幸邀請到資深科技主播曉晴，來跟我們聊聊 Gemini 3.8 的最新語音黑科技！',
      status: 'idle',
    },
    {
      id: '2',
      role: 'speaker2',
      text: '奕辰你好，各位聽眾朋友大家好！|yeah| 這次的新模型真的很讓人驚豔，特別是在台灣在地腔調的抑揚頓挫上，表現得極為細膩。',
      status: 'idle',
    },
    {
      id: '3',
      role: 'speaker1',
      text: '沒錯！<laugh> 我之前試聽的時候，連那個輕微的吸氣聲跟語助詞都超逼真，根本分不出來是不是真人錄的耶！',
      status: 'idle',
    },
    {
      id: '4',
      role: 'speaker2',
      text: '這就是所謂的語音情感建模。|mhm| 不僅是字詞的發音，連對話中的呼吸節奏與情緒共鳴，都能被精準捕捉呈現出來。',
      status: 'idle',
    },
  ]);

  // 分批控制參數（防止觸發 Gemini 免費版 15 RPM 限額）
  const [batchSize, setBatchSize] = useState<number>(5); // 預設 5 格一批
  const [cooldownSec, setCooldownSec] = useState<number>(5); // 批次間冷卻時間 (秒)
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);
  const [isAutoRunning, setIsAutoRunning] = useState<boolean>(false);
  const [cooldownCountdown, setCooldownCountdown] = useState<number>(0);
  const [batchStatusText, setBatchStatusText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 單句播放器控制
  const [playingTurnId, setPlayingTurnId] = useState<string | null>(null);
  const turnAudioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // 完整合併音訊
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState<boolean>(false);

  // 停止批次旗標
  const stopBatchRequestedRef = useRef<boolean>(false);

  // 清除單句播放器
  useEffect(() => {
    return () => {
      if (turnAudioPlayerRef.current) {
        turnAudioPlayerRef.current.pause();
        turnAudioPlayerRef.current = null;
      }
    };
  }, []);

  // 計算當前進度數據
  const readyCount = turns.filter((t) => t.status === 'ready' && t.audioBase64).length;
  const totalCount = turns.length;
  const progressPercent = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;

  // 尋找下一批未生成的格數
  const getNextUngeneratedIndices = () => {
    const indices: number[] = [];
    turns.forEach((t, idx) => {
      if (t.status !== 'ready' || !t.audioBase64) {
        indices.push(idx);
      }
    });
    return indices.slice(0, batchSize);
  };

  const nextBatchIndices = getNextUngeneratedIndices();

  // 載入預設對白劇本
  const handleLoadSample = (index: number) => {
    const sample = SAMPLE_DIALOGUES[index];
    if (!sample || !sample.turns || sample.turns.length === 0) return;

    const sampleSpeaker1Name = sample.turns[0].speaker;
    const sampleSpeaker2Turn = sample.turns.find((t) => t.speaker !== sampleSpeaker1Name);
    const sampleSpeaker2Name = sampleSpeaker2Turn ? sampleSpeaker2Turn.speaker : '';

    const v1 =
      VOAI_VOICES.find((v) => v.name === sampleSpeaker1Name || sampleSpeaker1Name.includes(v.name)) ||
      speaker1Voice;
    const v2 =
      (sampleSpeaker2Name
        ? VOAI_VOICES.find(
            (v) => v.name === sampleSpeaker2Name || sampleSpeaker2Name.includes(v.name)
          )
        : null) || speaker2Voice;

    setSpeaker1Voice(v1);
    setSpeaker2Voice(v2);

    setTurns(
      sample.turns.map((t, i) => ({
        id: String(i + 1),
        role: t.speaker === sampleSpeaker1Name ? 'speaker1' : 'speaker2',
        text: cleanSpeakerPrefix(t.text, t.speaker),
        status: 'idle',
      }))
    );
    setGeneratedAudio(null);
  };

  // 新增台詞
  const handleAddTurn = () => {
    const lastTurn = turns[turns.length - 1];
    const nextRole: 'speaker1' | 'speaker2' =
      lastTurn?.role === 'speaker1' ? 'speaker2' : 'speaker1';
    setTurns((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        role: nextRole,
        text: '',
        status: 'idle',
      },
    ]);
  };

  // 批次 ＋5 句台詞
  const handleBatchAddTurns = (count = 5) => {
    setTurns((prev) => {
      let currentRole: 'speaker1' | 'speaker2' =
        prev[prev.length - 1]?.role === 'speaker1' ? 'speaker2' : 'speaker1';
      const newTurns: DialogueTurn[] = [];
      const baseTime = Date.now();
      for (let i = 0; i < count; i++) {
        newTurns.push({
          id: String(baseTime + i),
          role: currentRole,
          text: '',
          status: 'idle',
        });
        currentRole = currentRole === 'speaker1' ? 'speaker2' : 'speaker1';
      }
      return [...prev, ...newTurns];
    });
  };

  // 刪除台詞
  const handleDeleteTurn = (id: string) => {
    if (turns.length <= 1) return;
    setTurns((prev) => prev.filter((t) => t.id !== id));
  };

  // 修改台詞文字 (若已生成過音訊，編輯文字自動重置該格狀態為待生成)
  const handleTextChange = (id: string, newText: string) => {
    setTurns((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            text: newText,
            audioBase64: undefined,
            status: 'idle',
            errorMessage: undefined,
          };
        }
        return t;
      })
    );
  };

  // 嚴格切換角色 (切換角色亦自動重置該格狀態)
  const handleRoleChange = (id: string, newRole: 'speaker1' | 'speaker2') => {
    setTurns((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            role: newRole,
            audioBase64: undefined,
            status: 'idle',
            errorMessage: undefined,
          };
        }
        return t;
      })
    );
  };

  // 插入語法標籤
  const handleInsertTag = (id: string, tag: string) => {
    setTurns((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text: t.text + tag, audioBase64: undefined, status: 'idle' } : t))
    );
  };

  // 單句獨立生成核心函式
  const generateSingleTurnAudio = async (turn: DialogueTurn): Promise<string> => {
    const isSpeaker1 = turn.role === 'speaker1';
    const actor = isSpeaker1 ? speaker1Voice : speaker2Voice;
    const cleanText = cleanSpeakerPrefix(turn.text, actor.name);
    const processed = preprocessScript(cleanText);

    if (!processed || processed.trim().length === 0) {
      throw new Error('此格台詞內容為空');
    }

    const enhancedStyle = `${actor.stylePrompt || '道地台灣口音，親切自然流暢'}。自然對談呼吸感。請使用道地自然流暢的台灣腔調。`;

    const result = await generateSingleSpeakerAudio({
      text: processed,
      voiceName: actor.geminiVoice,
      modelName: 'gemini-3.8-flash-tts',
      style: enhancedStyle,
      emotion: '自然親切',
    });

    if (!result.audioBase64) {
      throw new Error('未取得音訊回傳');
    }

    return result.audioBase64;
  };

  // 單句重成或單獨產出
  const handleGenerateSingleTurn = async (turnId: string) => {
    const targetTurn = turns.find((t) => t.id === turnId);
    if (!targetTurn) return;

    setTurns((prev) =>
      prev.map((t) => (t.id === turnId ? { ...t, status: 'generating', errorMessage: undefined } : t))
    );
    setErrorMessage(null);

    try {
      const audioBase64 = await generateSingleTurnAudio(targetTurn);
      setTurns((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, audioBase64, status: 'ready', errorMessage: undefined } : t))
      );
    } catch (err: any) {
      console.error(`Error generating turn ${turnId}:`, err);
      const msg = err.message || '生成失敗';
      setTurns((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, status: 'error', errorMessage: msg } : t))
      );
      setErrorMessage(`第 ${turns.findIndex((t) => t.id === turnId) + 1} 格生成失敗：${msg}`);
    }
  };

  // 單句即時試聽 / 暫停
  const handlePlaySingleTurn = (turn: DialogueTurn) => {
    if (!turn.audioBase64) return;

    if (playingTurnId === turn.id) {
      if (turnAudioPlayerRef.current) {
        turnAudioPlayerRef.current.pause();
      }
      setPlayingTurnId(null);
      return;
    }

    if (turnAudioPlayerRef.current) {
      turnAudioPlayerRef.current.pause();
    }

    const audio = new Audio(`data:audio/wav;base64,${turn.audioBase64}`);
    turnAudioPlayerRef.current = audio;
    setPlayingTurnId(turn.id);

    audio.onended = () => {
      setPlayingTurnId(null);
    };

    audio.onerror = () => {
      setPlayingTurnId(null);
    };

    audio.play().catch((e) => {
      console.warn('Playback error:', e);
      setPlayingTurnId(null);
    });
  };

  // 執行指定批次生成 (逐格產出，防止同時多併發打爆 15 RPM 限額)
  const executeBatch = async (indices: number[]): Promise<boolean> => {
    for (const idx of indices) {
      if (stopBatchRequestedRef.current) {
        return false;
      }

      const turn = turns[idx];
      if (!turn) continue;

      setTurns((prev) =>
        prev.map((t, i) => (i === idx ? { ...t, status: 'generating', errorMessage: undefined } : t))
      );
      setBatchStatusText(`正在產出第 ${idx + 1} 格台詞語音...`);

      try {
        const audioBase64 = await generateSingleTurnAudio(turn);
        setTurns((prev) =>
          prev.map((t, i) => (i === idx ? { ...t, audioBase64, status: 'ready', errorMessage: undefined } : t))
        );
      } catch (err: any) {
        const isQuota429 =
          err?.message?.includes('429') ||
          err?.message?.includes('quota') ||
          err?.message?.includes('RESOURCE_EXHAUSTED');

        if (isQuota429) {
          setBatchStatusText(`⚠️ 觸發 Gemini 免費配額每分鐘限制 (429)，自動暫停 15 秒保護配額...`);
          // 冷卻 15 秒後重試一次本格
          for (let c = 15; c > 0; c--) {
            if (stopBatchRequestedRef.current) return false;
            setCooldownCountdown(c);
            await new Promise((r) => setTimeout(r, 1000));
          }
          setCooldownCountdown(0);
          try {
            const retryAudio = await generateSingleTurnAudio(turn);
            setTurns((prev) =>
              prev.map((t, i) => (i === idx ? { ...t, audioBase64: retryAudio, status: 'ready', errorMessage: undefined } : t))
            );
            continue;
          } catch (retryErr: any) {
            setTurns((prev) =>
              prev.map((t, i) => (i === idx ? { ...t, status: 'error', errorMessage: retryErr.message } : t))
            );
            return false;
          }
        } else {
          setTurns((prev) =>
            prev.map((t, i) => (i === idx ? { ...t, status: 'error', errorMessage: err.message } : t))
          );
          setErrorMessage(`第 ${idx + 1} 格生成失敗：${err.message}`);
          return false;
        }
      }

      // 每句之間保留小間隔 600ms，保持請求溫和
      await new Promise((r) => setTimeout(r, 600));
    }
    return true;
  };

  // 手動：只生成下一批 (例如下 5 格)
  const handleGenerateNextBatch = async () => {
    const targets = getNextUngeneratedIndices();
    if (targets.length === 0) return;

    setIsBatchGenerating(true);
    setErrorMessage(null);
    stopBatchRequestedRef.current = false;

    try {
      await executeBatch(targets);
      setBatchStatusText(`本批 (第 ${targets[0] + 1} ~ ${targets[targets.length - 1] + 1} 格) 生成完畢！`);
    } catch (err: any) {
      console.error('Batch error:', err);
    } finally {
      setIsBatchGenerating(false);
    }
  };

  // 自動：分批生成全部 (自動在批次間等待冷卻，徹底避開免費版 15 RPM 限制)
  const handleAutoBatchAll = async () => {
    setIsAutoRunning(true);
    setIsBatchGenerating(true);
    setErrorMessage(null);
    stopBatchRequestedRef.current = false;

    try {
      while (!stopBatchRequestedRef.current) {
        // 重新確認目前尚未生成的清單
        const ungenerated = turns
          .map((t, idx) => ({ t, idx }))
          .filter((item) => item.t.status !== 'ready' || !item.t.audioBase64)
          .map((item) => item.idx);

        if (ungenerated.length === 0) {
          // 全部生成完畢！自動無損合併
          setBatchStatusText('🎉 全部長篇對話台詞已全數生成完成！正在進行一鍵無損合併...');
          await handleMergeReadyTurns();
          break;
        }

        const currentBatch = ungenerated.slice(0, batchSize);
        const ok = await executeBatch(currentBatch);
        if (!ok || stopBatchRequestedRef.current) {
          break;
        }

        // 檢查是否還有下一批
        const remaining = turns
          .map((t, idx) => ({ t, idx }))
          .filter((item) => item.t.status !== 'ready' || !item.t.audioBase64)
          .map((item) => item.idx);

        if (remaining.length > 0 && cooldownSec > 0 && !stopBatchRequestedRef.current) {
          // 批次間冷卻倒數計時
          for (let c = cooldownSec; c > 0; c--) {
            if (stopBatchRequestedRef.current) break;
            setCooldownCountdown(c);
            setBatchStatusText(`已完成本批！避開免費限額冷卻中：剩餘 ${c} 秒後自動產出下一批...`);
            await new Promise((r) => setTimeout(r, 1000));
          }
          setCooldownCountdown(0);
        }
      }
    } catch (err: any) {
      console.error('Auto batch failed:', err);
      setErrorMessage(err.message || '自動分批中斷');
    } finally {
      setIsAutoRunning(false);
      setIsBatchGenerating(false);
      setCooldownCountdown(0);
    }
  };

  // 暫停自動分批
  const handleStopAutoBatch = () => {
    stopBatchRequestedRef.current = true;
    setIsAutoRunning(false);
    setIsBatchGenerating(false);
    setCooldownCountdown(0);
    setBatchStatusText('已暫停分批生成。隨時可點擊「繼續」或「一鍵無損合併」已生成部分。');
  };

  // 一鍵無損合併已生成的對話 (前端純粹記憶體拼接，0 API 消耗，秒級完成)
  const handleMergeReadyTurns = async () => {
    const readyItems = turns.filter((t) => t.status === 'ready' && t.audioBase64);
    if (readyItems.length === 0) {
      setErrorMessage('目前尚無已生成完畢的對話音訊，請先點擊分批產出語音。');
      return;
    }

    setIsMerging(true);
    setErrorMessage(null);

    try {
      // 依 turns 原始順序收集 ready 音訊
      const readyWavs = readyItems.map((t) => t.audioBase64 as string);
      const mergedBase64 = await concatWavBuffersClient(readyWavs, 250);

      setGeneratedAudio(mergedBase64);

      // 嚴格只寫入純台詞數據，絕不寫入主持人姓名
      const pureDialogueContent = readyItems.map((t) => t.text).join(' ');

      onSaveToHistory({
        voiceName: `${speaker1Voice.name} (主持人一) & ${speaker2Voice.name} (主持人二)`,
        voiceId: `${speaker1Voice.id}_${speaker2Voice.id}`,
        avatar: speaker1Voice.avatar,
        accent: `雙人對談 Podcast (分批產出・已合併 ${readyItems.length}/${turns.length} 格)`,
        model: 'gemini-3.8-flash-tts',
        text: pureDialogueContent,
        audioBase64: mergedBase64,
        charCount: pureDialogueContent.length,
      });

      setBatchStatusText(`🎵 已成功合併 ${readyItems.length} 格音訊！已存入歷史記錄，可於下方播放器完整播放或下載。`);
    } catch (err: any) {
      console.error('Merge error:', err);
      setErrorMessage(`無損合併失敗：${err.message}`);
    } finally {
      setIsMerging(false);
    }
  };

  // 清空所有快取音訊 (重置)
  const handleResetAllAudios = () => {
    if (confirm('確定要清除所有已產出的快取音檔嗎？清除後需重新產出。')) {
      setTurns((prev) =>
        prev.map((t) => ({ ...t, audioBase64: undefined, status: 'idle', errorMessage: undefined }))
      );
      setGeneratedAudio(null);
      setBatchStatusText('已重置所有音訊快取。');
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
              專為長篇 Podcast 與 Gemini 免費額度設計：支援<strong>「分批智慧生成」</strong>與
              <strong>「無損秒速合併」</strong>。每一格台詞均獨立快取，自動避開每分鐘 15 RPM
              免費額度上限，聲線 100% 嚴格鎖定主持人一與二！
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                系統嚴格設定：只寫入對話方塊數據，絕不寫入或朗讀主持人名字
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                超長篇防串音架構：即使對話超過 50 格，每一格聲線依然 100% 嚴格鎖定，絕不跳音！
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                分批生成模式：有效避免 429 額度超限
              </span>
            </div>
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

      {/* 分批產出控制中心 (防 429 免費限額神器) */}
      <div className="bg-slate-900/95 border border-cyan-500/30 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                分批生成控制台
              </span>
              <span className="text-xs text-slate-400">
                目前進度：
                <strong className="text-cyan-300 mx-1">{readyCount}</strong> / {totalCount} 格完成 ({progressPercent}%)
              </span>
            </div>
            <p className="text-xs text-slate-300">
              設定每批格數與間隔冷卻時間，點擊即可穩健產出，徹底避免免費 API 15 RPM 請求上限。
            </p>
          </div>

          {/* 參數選擇器 */}
          <div className="flex flex-wrap items-center gap-3">
            {/* 每批格數 */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">每批生成：</span>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                disabled={isBatchGenerating}
                className="bg-transparent text-xs text-cyan-300 font-bold focus:outline-none cursor-pointer"
              >
                <option value={3} className="bg-slate-900 text-slate-200">3 格 (最安全)</option>
                <option value={5} className="bg-slate-900 text-slate-200">5 格 (推薦免費版)</option>
                <option value={8} className="bg-slate-900 text-slate-200">8 格</option>
                <option value={10} className="bg-slate-900 text-slate-200">10 格</option>
              </select>
            </div>

            {/* 冷卻時間 */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-slate-400 font-medium">批次冷卻：</span>
              <select
                value={cooldownSec}
                onChange={(e) => setCooldownSec(Number(e.target.value))}
                disabled={isBatchGenerating}
                className="bg-transparent text-xs text-amber-300 font-bold focus:outline-none cursor-pointer"
              >
                <option value={0} className="bg-slate-900 text-slate-200">0 秒 (立即連續)</option>
                <option value={3} className="bg-slate-900 text-slate-200">3 秒</option>
                <option value={5} className="bg-slate-900 text-slate-200">5 秒 (推薦免費版)</option>
                <option value={8} className="bg-slate-900 text-slate-200">8 秒 (防封頂級)</option>
              </select>
            </div>

            {/* 清空快取 */}
            {readyCount > 0 && (
              <button
                type="button"
                onClick={handleResetAllAudios}
                disabled={isBatchGenerating}
                className="p-2 text-slate-400 hover:text-red-400 bg-slate-950 hover:bg-red-950/30 rounded-xl border border-slate-800 transition-colors"
                title="清空所有音訊快取"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 進度條 */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
            <div
              className="bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>
              已完成：{readyCount} 格 • 待產出：{totalCount - readyCount} 格
            </span>
            {cooldownCountdown > 0 ? (
              <span className="text-amber-300 font-semibold flex items-center gap-1 animate-pulse">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                免費限額冷卻中：{cooldownCountdown} 秒後自動接續...
              </span>
            ) : batchStatusText ? (
              <span className="text-cyan-300 font-medium">{batchStatusText}</span>
            ) : null}
          </div>
        </div>

        {/* 核心操作按鈕群組 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* 按鈕 1：手動產出下一批 */}
          <button
            type="button"
            onClick={handleGenerateNextBatch}
            disabled={isBatchGenerating || nextBatchIndices.length === 0}
            className="py-3 px-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
          >
            {isBatchGenerating && !isAutoRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>生成本批中...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" />
                <span>
                  {nextBatchIndices.length > 0
                    ? `手動產出下一批 (第 ${nextBatchIndices[0] + 1}~${nextBatchIndices[nextBatchIndices.length - 1] + 1} 格)`
                    : '本劇本已全部產出'}
                </span>
              </>
            )}
          </button>

          {/* 按鈕 2：自動分批產出全部 (含冷卻) */}
          {isAutoRunning ? (
            <button
              type="button"
              onClick={handleStopAutoBatch}
              className="py-3 px-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 transition-all"
            >
              <Pause className="w-4 h-4 fill-white" />
              <span>暫停自動分批</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAutoBatchAll}
              disabled={isBatchGenerating || readyCount === totalCount}
              className="py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>自動分批生成全部 (自動避開限額)</span>
            </button>
          )}

          {/* 按鈕 3：一鍵無損合併 (0 API 消耗) */}
          <button
            type="button"
            onClick={handleMergeReadyTurns}
            disabled={isMerging || readyCount === 0}
            className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
          >
            {isMerging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>正在秒速無損拼接...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>一鍵無損合併音訊 (共 {readyCount} 格)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 對話輪次列表 */}
      <div className="space-y-3">
        {turns.map((turn, index) => {
          const isSpeaker1 = turn.role === 'speaker1';
          const currentActor = isSpeaker1 ? speaker1Voice : speaker2Voice;
          const isReady = turn.status === 'ready' && Boolean(turn.audioBase64);
          const isGeneratingThis = turn.status === 'generating';
          const isErrorThis = turn.status === 'error';
          const isPlayingThis = playingTurnId === turn.id;

          return (
            <div
              key={turn.id}
              className={`border rounded-2xl p-4 transition-all ${
                isSpeaker1
                  ? 'border-cyan-500/40 bg-slate-900/95 shadow-md shadow-cyan-950/20'
                  : 'border-indigo-500/40 bg-slate-900/80 shadow-md shadow-indigo-950/20'
              } ${isReady ? 'ring-1 ring-emerald-500/30' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                      isSpeaker1
                        ? 'bg-cyan-950/90 text-cyan-300 border-cyan-600/60'
                        : 'bg-indigo-950/90 text-indigo-300 border-indigo-600/60'
                    }`}
                  >
                    第 {index + 1} 格
                  </span>

                  <img
                    src={currentActor.avatar}
                    alt={currentActor.name}
                    className="w-7 h-7 rounded-lg object-cover border border-slate-700"
                  />

                  {/* 嚴格角色鎖定切換按鈕 */}
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleRoleChange(turn.id, 'speaker1')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        isSpeaker1
                          ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                          : 'text-slate-400 hover:text-white hover:bg-slate-850'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-300"></span>
                      <span>主持人 1：{speaker1Voice.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRoleChange(turn.id, 'speaker2')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        !isSpeaker1
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'text-slate-400 hover:text-white hover:bg-slate-850'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-300"></span>
                      <span>主持人 2：{speaker2Voice.name}</span>
                    </button>
                  </div>

                  {/* 該格音訊狀態徽章 */}
                  {isReady && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      已生成音訊
                    </span>
                  )}
                  {isGeneratingThis && (
                    <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-[11px] font-semibold flex items-center gap-1 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      語音產出中...
                    </span>
                  )}
                  {isErrorThis && (
                    <span className="px-2 py-0.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      生成失敗
                    </span>
                  )}
                </div>

                {/* 右側操作：試聽、單句重成、標籤與刪除 */}
                <div className="flex items-center gap-1.5 text-[11px]">
                  {/* 單句試聽按鈕 */}
                  {isReady && (
                    <button
                      type="button"
                      onClick={() => handlePlaySingleTurn(turn)}
                      className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 border transition-all ${
                        isPlayingThis
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                          : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                      }`}
                      title={isPlayingThis ? '暫停播放' : '試聽此句'}
                    >
                      {isPlayingThis ? (
                        <>
                          <Pause className="w-3 h-3 fill-slate-950" />
                          <span>暫停</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-emerald-400" />
                          <span>試聽此句</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* 單句獨立生成 / 重成按鈕 */}
                  <button
                    type="button"
                    onClick={() => handleGenerateSingleTurn(turn.id)}
                    disabled={isGeneratingThis || isBatchGenerating}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-medium flex items-center gap-1 disabled:opacity-40"
                    title="單獨產出或重成此句台詞"
                  >
                    <Zap className="w-3 h-3 text-cyan-400" />
                    <span>{isReady ? '重成此句' : '產出此句'}</span>
                  </button>

                  {/* 快捷插入小標籤 */}
                  <button
                    type="button"
                    onClick={() => handleInsertTag(turn.id, ' <breath>')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-mono hidden sm:inline-block"
                    title="插入換氣"
                  >
                    &lt;breath&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTag(turn.id, ' <laugh>')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-mono hidden sm:inline-block"
                    title="插入笑聲"
                  >
                    &lt;laugh&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTag(turn.id, ' |mhm| ')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 font-mono hidden sm:inline-block"
                    title="插入附和音"
                  >
                    |mhm|
                  </button>

                  {/* 刪除此句 */}
                  <button
                    type="button"
                    onClick={() => handleDeleteTurn(turn.id)}
                    disabled={turns.length <= 1}
                    className="p-1 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 disabled:opacity-30 ml-1"
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
                onBlur={(e) => {
                  const cleaned = cleanSpeakerPrefix(e.target.value, currentActor.name);
                  if (cleaned !== e.target.value) {
                    handleTextChange(turn.id, cleaned);
                  }
                }}
                rows={2}
                placeholder={`對話方塊純文字數據（系統已嚴格設定：僅輸入台詞，不要寫入 ${currentActor.name} 的名字）...`}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 leading-relaxed font-sans resize-none"
              />
            </div>
          );
        })}

        {/* 新增台詞按鈕組 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleAddTurn}
            className="py-3 px-4 rounded-2xl bg-slate-900 border border-dashed border-slate-700 hover:border-cyan-500 hover:bg-slate-850 text-slate-300 hover:text-cyan-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新增 1 句台詞 (接續下一句)
          </button>
          <button
            type="button"
            onClick={() => handleBatchAddTurns(5)}
            className="py-3 px-4 rounded-2xl bg-slate-900 border border-dashed border-indigo-700/60 hover:border-indigo-400 hover:bg-slate-850 text-indigo-300 hover:text-indigo-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Users className="w-4 h-4 text-indigo-400" />
            批次 ＋5 句台詞 (自動交替雙人角色)
          </button>
        </div>
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
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-white px-2 py-1"
            >
              關閉
            </button>
          </div>
        </div>
      )}

      {/* 合併後的完整音訊播放器 */}
      <WaveformPlayer
        audioBase64={generatedAudio}
        title={`雙人 Podcast 完整對談：${speaker1Voice.name} & ${speaker2Voice.name}`}
        subtitle={`共 ${turns.length} 輪對話 • 已合併 ${readyCount} 格 • Gemini 3.8 Flash TTS 原生雙人多聲線合成`}
        autoPlay={true}
      />
    </div>
  );
};
