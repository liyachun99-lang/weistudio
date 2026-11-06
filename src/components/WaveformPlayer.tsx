import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Download,
  Volume2,
  VolumeX,
  Sparkles,
} from 'lucide-react';
import { formatTime, downloadBase64Audio, base64ToBlob } from '../utils/audio';

interface WaveformPlayerProps {
  audioBase64: string | null;
  mimeType?: string;
  title?: string;
  subtitle?: string;
  autoPlay?: boolean;
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
  audioBase64,
  mimeType = 'audio/wav',
  title = '合成語音預覽',
  subtitle,
  autoPlay = true,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // 當 audioBase64 改變時更新音訊 URL
  useEffect(() => {
    if (!audioBase64) {
      setAudioUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    try {
      const blob = base64ToBlob(audioBase64, mimeType);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.error('Failed to parse audio base64:', err);
    }
  }, [audioBase64, mimeType]);

  // 設定自動播放
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      if (autoPlay) {
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch((e) => console.log('Autoplay prevented:', e));
      }
    }
  }, [audioUrl, autoPlay]);

  // 波形繪製動畫
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let barHeights = Array.from({ length: 48 }, (_, i) => {
      // 靜態基底波形
      return Math.sin(i * 0.25) * 15 + Math.cos(i * 0.45) * 10 + 20;
    });

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const barWidth = 4;
      const gap = 3;
      const totalBars = Math.floor(width / (barWidth + gap));

      const progress = duration > 0 ? currentTime / duration : 0;
      const activeBars = Math.floor(totalBars * progress);

      for (let i = 0; i < totalBars; i++) {
        let h = barHeights[i % barHeights.length] || 15;
        if (isPlaying) {
          // 動態律動
          const jitter = Math.sin(Date.now() * 0.008 + i * 0.5) * 12;
          h = Math.max(6, Math.min(height - 4, h + jitter));
        }

        const x = i * (barWidth + gap);
        const y = (height - h) / 2;

        if (i <= activeBars) {
          // 播放過的進度
          const gradient = ctx.createLinearGradient(0, y, 0, y + h);
          gradient.addColorStop(0, '#38bdf8');
          gradient.addColorStop(1, '#6366f1');
          ctx.fillStyle = gradient;
        } else {
          // 未播放進度
          ctx.fillStyle = '#334155';
        }

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, h, 2);
        ctx.fill();
      }

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(draw);
      }
    };

    draw();

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(draw);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentTime, duration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.error('Play error:', e));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSkip = (seconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audioRef.current.muted = newMuted;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
    }
  };

  const handleDownload = () => {
    if (!audioBase64) return;
    const filename = `voai_${title.replace(/[\s/\\:]/g, '_')}_${Date.now()}.wav`;
    downloadBase64Audio(audioBase64, filename, mimeType);
  };

  if (!audioBase64 || !audioUrl) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 flex flex-col items-center justify-center min-h-[140px]">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center mb-2.5 text-slate-500">
          <Sparkles className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-slate-300">尚未生成語音音訊</p>
        <p className="text-xs text-slate-500 mt-1">
          在上方編輯文案後，點擊「生成 Gemini 3.8 擬真語音」即可在此即時播放與下載音檔
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-cyan-500/30 rounded-2xl p-5 shadow-xl shadow-cyan-950/20 text-white relative overflow-hidden">
      {/* 隱藏的 HTML5 audio 物件 */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => setIsPlaying(false)}
      />

      {/* 標題與音質標籤 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <div>
            <h4 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
              {title}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                WAV 24kHz
              </span>
            </h4>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>

        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium shadow-md shadow-cyan-900/30 transition-all hover:scale-105 active:scale-95"
          title="下載高品質 WAV 音檔"
        >
          <Download className="w-3.5 h-3.5" />
          下載音檔
        </button>
      </div>

      {/* 波形可視化圖表 */}
      <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 mb-4 flex flex-col justify-center">
        <canvas
          ref={canvasRef}
          width={560}
          height={48}
          className="w-full h-12 rounded cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            if (audioRef.current && duration > 0) {
              const newTime = pos * duration;
              audioRef.current.currentTime = newTime;
              setCurrentTime(newTime);
            }
          }}
        />

        {/* 時間軸與拖曳條 */}
        <div className="flex items-center gap-3 mt-2">
          <span className="font-mono text-xs text-cyan-400 w-12 text-left">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300"
          />
          <span className="font-mono text-xs text-slate-400 w-12 text-right">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* 播放控制按鈕區 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* 倍速選擇 */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60">
          {[0.75, 1.0, 1.25, 1.5].map((rate) => (
            <button
              key={rate}
              onClick={() => handleRateChange(rate)}
              className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
                playbackRate === rate
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* 核心播放控制器 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSkip(-5)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            title="倒退 5 秒"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            className="w-11 h-11 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white flex items-center justify-center shadow-lg shadow-cyan-500/30 transition-all hover:scale-105 active:scale-95"
            title={isPlaying ? '暫停' : '播放'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-white" />
            ) : (
              <Play className="w-5 h-5 fill-white ml-0.5" />
            )}
          </button>

          <button
            onClick={() => handleSkip(5)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            title="快進 5 秒"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* 音量控制 */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="text-slate-400 hover:text-white transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>
    </div>
  );
};
