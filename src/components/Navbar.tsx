import React from 'react';
import { Mic2, Users, Radio, History, Sparkles, BookOpen, Key, Github } from 'lucide-react';

export type ActiveTab = 'studio' | 'voices' | 'dialogue' | 'history';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  historyCount: number;
  onOpenGuide: () => void;
  onOpenApiKeyModal: () => void;
  hasApiKey: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  historyCount,
  onOpenGuide,
  onOpenApiKeyModal,
  hasApiKey,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('studio')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Mic2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                  WEIAI Studio
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  台灣在地化
                </span>
              </div>
              <p className="text-[11px] text-slate-400 -mt-0.5">
                Gemini 3.8 旗艦文字轉語音引擎
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5 p-1 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setActiveTab('studio')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'studio'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Mic2 className="w-4 h-4" />
              語音合成工作台
            </button>

            <button
              onClick={() => setActiveTab('voices')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'voices'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Users className="w-4 h-4" />
              台灣聲優庫
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-cyan-400 font-bold border border-cyan-500/30">
                26+ 專業角色
              </span>
            </button>

            <button
              onClick={() => setActiveTab('dialogue')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'dialogue'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Radio className="w-4 h-4" />
              雙人 Podcast 對談
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <History className="w-4 h-4" />
              歷史紀錄
              {historyCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-bold">
                  {historyCount}
                </span>
              )}
            </button>
          </nav>

          {/* Right Action: API Key, Guide & Engine indicator */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              onClick={onOpenApiKeyModal}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                hasApiKey
                  ? 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200'
                  : 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/40 text-cyan-300 animate-pulse'
              }`}
              title="設定 Gemini API Key (GitHub Pages 必備)"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{hasApiKey ? 'API Key 已配置' : '設定 API Key'}</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  hasApiKey ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            </button>

            <button
              onClick={onOpenGuide}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-cyan-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors"
              title="查看 Gemini 3.8 語音標籤與台語調教語法"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">語法指南</span>
            </button>

            <a
              href="https://github.com/liyachun99-lang"
              target="_blank"
              rel="noreferrer"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="前往 GitHub 專案庫"
            >
              <Github className="w-4 h-4" />
            </a>

            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono text-[11px]">Gemini 3.8</span>
            </div>
          </div>
        </div>

        {/* Mobile Submenu */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('studio')}
            className={`flex flex-col items-center gap-1 py-1 px-2 ${
              activeTab === 'studio' ? 'text-cyan-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Mic2 className="w-4 h-4" />
            工作台
          </button>
          <button
            onClick={() => setActiveTab('voices')}
            className={`flex flex-col items-center gap-1 py-1 px-2 ${
              activeTab === 'voices' ? 'text-cyan-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Users className="w-4 h-4" />
            聲優庫
          </button>
          <button
            onClick={() => setActiveTab('dialogue')}
            className={`flex flex-col items-center gap-1 py-1 px-2 ${
              activeTab === 'dialogue' ? 'text-cyan-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Radio className="w-4 h-4" />
            雙人對談
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 py-1 px-2 ${
              activeTab === 'history' ? 'text-cyan-400 font-bold' : 'text-slate-400'
            }`}
          >
            <History className="w-4 h-4" />
            紀錄 ({historyCount})
          </button>
        </div>
      </div>
    </header>
  );
};
