import React from 'react';
import {
  History,
  Trash2,
  Play,
  Download,
  Calendar,
  Volume2,
  FileText,
  Sparkles,
} from 'lucide-react';
import { downloadBase64Audio } from '../utils/audio';

export interface HistoryItem {
  id: string;
  voiceName: string;
  voiceId?: string;
  avatar?: string;
  accent?: string;
  model: string;
  text: string;
  audioBase64: string;
  timestamp: number;
  charCount: number;
}

interface HistoryDrawerProps {
  items: HistoryItem[];
  onPlayItem: (item: HistoryItem) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  items,
  onPlayItem,
  onDeleteItem,
  onClearAll,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-2">
            <History className="w-3.5 h-3.5" />
            語音生成紀錄庫
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            近期生成的語音歷史存檔
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            本機儲存您最近生成的音檔，可隨時重新試聽、下載或比對效果
          </p>
        </div>

        {items.length > 0 && (
          <button
            onClick={() => {
              if (confirm('確定要清空所有語音歷史紀錄嗎？')) {
                onClearAll();
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 text-xs font-semibold transition-all self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清空所有紀錄
          </button>
        )}
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mb-3 text-slate-500">
            <History className="w-8 h-8" />
          </div>
          <h4 className="font-bold text-base text-slate-200">尚無歷史生成紀錄</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            請至「語音合成工作台」或「雙人 Podcast 對談」嘗試生成語音，您的音檔會自動儲存於此。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between transition-all group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-3">
                    {item.avatar ? (
                      <img
                        src={item.avatar}
                        alt={item.voiceName}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-cyan-600/30 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-sm">
                        {item.voiceName.slice(0, 1)}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        {item.voiceName}
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {item.model.includes('lite') ? 'Lite TTS' : 'Flash TTS'}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.timestamp).toLocaleString('zh-TW', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        <span>•</span>
                        <span>{item.charCount} 字</span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
                    title="刪除此紀錄"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-slate-950/70 border border-slate-850 rounded-xl p-3 mb-3 text-xs text-slate-300 line-clamp-3 leading-relaxed">
                  "{item.text}"
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => onPlayItem(item)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-950/30 transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  立即播放
                </button>
                <button
                  onClick={() =>
                    downloadBase64Audio(
                      item.audioBase64,
                      `voai_${item.voiceName}_${item.id}.wav`
                    )
                  }
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                  title="下載 WAV 音檔"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
