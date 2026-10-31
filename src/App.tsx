/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { SingleSpeakerStudio } from './components/SingleSpeakerStudio';
import { VoiceLibrary } from './components/VoiceLibrary';
import { DialogueStudio } from './components/DialogueStudio';
import { HistoryDrawer, HistoryItem } from './components/HistoryDrawer';
import { TagGuideModal } from './components/TagGuideModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { VOAI_VOICES, VoiceActor } from './data/voices';
import { WaveformPlayer } from './components/WaveformPlayer';
import { generateSingleSpeakerAudio, getStoredApiKey } from './services/geminiClient';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('studio');
  const [selectedVoice, setSelectedVoice] = useState<VoiceActor>(VOAI_VOICES[0]); // 曉晴
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(() => !!getStoredApiKey());

  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<{
    base64: string;
    voiceName: string;
    accent: string;
  } | null>(null);

  // 檢查 API Key 狀態
  useEffect(() => {
    setHasApiKey(!!getStoredApiKey());
  }, [isApiKeyModalOpen]);

  // 歷史紀錄狀態 (從 localStorage 讀取)
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('voai_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleSaveToHistory = (item: {
    voiceName: string;
    voiceId: string;
    avatar: string;
    accent: string;
    model: string;
    text: string;
    audioBase64: string;
    charCount: number;
  }) => {
    const newItem: HistoryItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      ...item,
    };
    setHistoryItems((prev) => {
      const updated = [newItem, ...prev].slice(0, 30);
      try {
        localStorage.setItem('voai_history', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save history:', e);
      }
      return updated;
    });
  };

  const handleDeleteHistoryItem = (id: string) => {
    setHistoryItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      try {
        localStorage.setItem('voai_history', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  const handleClearHistory = () => {
    setHistoryItems([]);
    try {
      localStorage.removeItem('voai_history');
    } catch (e) {
      console.error(e);
    }
  };

  // 聲優庫試聽範例 (雙模自動適配)
  const handleGenerateSample = async (voice: VoiceActor) => {
    setPreviewingVoiceId(voice.id);
    try {
      const result = await generateSingleSpeakerAudio({
        text: voice.sampleText,
        voiceName: voice.geminiVoice,
        modelName: voice.recommendedModel,
        style: voice.stylePrompt,
        emotion: '自然親切',
        speed: voice.defaultSpeed,
        pitch: voice.defaultPitch,
      });

      if (result.audioBase64) {
        setPreviewAudio({
          base64: result.audioBase64,
          voiceName: voice.name,
          accent: voice.accent,
        });
      }
    } catch (err) {
      console.error('Sample generation error:', err);
    } finally {
      setPreviewingVoiceId(null);
    }
  };

  const handleSelectVoiceAndGoToStudio = (voice: VoiceActor) => {
    setSelectedVoice(voice);
    setActiveTab('studio');
  };

  const handlePlayHistoryItem = (item: HistoryItem) => {
    setPreviewAudio({
      base64: item.audioBase64,
      voiceName: item.voiceName,
      accent: item.accent || '歷史音檔',
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* 導航欄 */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        historyCount={historyItems.length}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        hasApiKey={hasApiKey}
      />

      {/* 主要內容區 */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'studio' && (
          <SingleSpeakerStudio
            currentVoice={selectedVoice}
            onSelectVoice={setSelectedVoice}
            onNavigateToVoices={() => setActiveTab('voices')}
            onSaveToHistory={handleSaveToHistory}
            onOpenGuide={() => setIsGuideOpen(true)}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
          />
        )}

        {activeTab === 'voices' && (
          <div className="space-y-6">
            <VoiceLibrary
              selectedVoice={selectedVoice}
              onSelectVoice={handleSelectVoiceAndGoToStudio}
              onGenerateSample={handleGenerateSample}
              previewingVoiceId={previewingVoiceId}
            />

            {/* 試聽彈出浮動播放條 */}
            {previewAudio && (
              <div className="sticky bottom-6 z-30 animate-in slide-in-from-bottom duration-300">
                <WaveformPlayer
                  audioBase64={previewAudio.base64}
                  title={`聲優試聽：${previewAudio.voiceName}`}
                  subtitle={previewAudio.accent}
                  autoPlay={true}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'dialogue' && (
          <DialogueStudio
            onSaveToHistory={handleSaveToHistory}
            onOpenGuide={() => setIsGuideOpen(true)}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
          />
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <HistoryDrawer
              items={historyItems}
              onPlayItem={handlePlayHistoryItem}
              onDeleteItem={handleDeleteHistoryItem}
              onClearAll={handleClearHistory}
            />

            {previewAudio && (
              <div className="sticky bottom-6 z-30 animate-in slide-in-from-bottom duration-300">
                <WaveformPlayer
                  audioBase64={previewAudio.base64}
                  title={`播放歷史：${previewAudio.voiceName}`}
                  subtitle={previewAudio.accent}
                  autoPlay={true}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* 標籤指南彈窗 */}
      <TagGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onInsertTag={(tag) => {}}
      />

      {/* API Key 設定彈窗 */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSaved={() => setHasApiKey(!!getStoredApiKey())}
      />

      {/* 頁尾 */}
     {/* 頁尾 */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-4">
          {/* 明顯製作者標示 */}
          <div className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-gradient-to-r from-cyan-950/90 via-slate-900 to-indigo-950/90 border border-cyan-500/50 shadow-xl shadow-cyan-950/50 text-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-base font-extrabold tracking-wide bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-200 bg-clip-text text-transparent">
              本網頁製作者 張桐瑋 2026 版
            </span>
          </div>

          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 pt-2 border-t border-slate-900/80 text-[11px]">
            <p>
              WEIAI Studio • 參考 VOAI.ai 台灣在地化聲優庫與配置 • 支援 GitHub Pages 靜態部署與全端伺服器雙模運作
            </p>
            <div className="flex items-center gap-4 text-slate-400">
              <span>支援 24kHz WAV 高清無損音訊</span>
              <span>•</span>
              <button
                onClick={() => setIsApiKeyModalOpen(true)}
                className="text-cyan-400 hover:underline"
              >
                設定 Gemini API Key
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
