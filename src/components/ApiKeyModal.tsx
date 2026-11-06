/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Key, X, Check, ExternalLink, ShieldCheck, HelpCircle, Loader2, RefreshCw } from 'lucide-react';
import { getStoredApiKey, saveApiKey } from '../services/geminiClient';
import { GoogleGenAI } from '@google/genai';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [apiKey, setApiKey] = useState<string>('');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavedFeedback, setIsSavedFeedback] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setApiKey(getStoredApiKey());
      setTestResult(null);
      setIsSavedFeedback(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveApiKey(apiKey.trim());
    setIsSavedFeedback(true);
    if (onSaved) onSaved();
    setTimeout(() => {
      setIsSavedFeedback(false);
      onClose();
    }, 800);
  };

  const handleClear = () => {
    saveApiKey('');
    setApiKey('');
    setTestResult(null);
    if (onSaved) onSaved();
  };

  const handleTestKey = async () => {
    const keyToTest = apiKey.trim();
    if (!keyToTest) {
      setTestResult({
        success: false,
        message: '請先輸入 Gemini API Key 再進行連線測試。',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: keyToTest });
      // 簡單進行一次超微型測試以驗證有效性
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Test connection: reply with "OK"',
      });

      if (response.text) {
        setTestResult({
          success: true,
          message: '驗證成功！API Key 運作正常，已解鎖所有 Gemini 3.8 台灣聲優模型。',
        });
      } else {
        throw new Error('未取得回應');
      }
    } catch (err: any) {
      console.error('API Key test failed:', err);
      setTestResult({
        success: false,
        message: `連線失敗：${err?.message || '請確認 API Key 是否輸入正確或具備存取權限。'}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative text-slate-100">
        {/* 關閉按鈕 */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 標題與圖示 */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              設定 Gemini API Key
            </h3>
            <p className="text-xs text-slate-400">
              支援 GitHub Pages 靜態網站直接呼叫 AI 聲優
            </p>
          </div>
        </div>

        {/* 說明區塊 */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 mb-5 text-xs text-slate-300 space-y-2">
          <div className="flex items-start gap-2 text-cyan-300 font-medium">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
            <span>安全宣告：金鑰僅保存在您本人的瀏覽器 LocalStorage 中，絕不傳送到任何第三方伺服器。</span>
          </div>
          <p className="text-slate-400 pl-6 leading-relaxed">
            GitHub Pages 為靜態網頁空間，直接在前端填入您的 Google AI Studio API Key 即可享有完整文字轉語音、語音合成及雙人對話功能。
          </p>
        </div>

        {/* 輸入欄位 */}
        <div className="space-y-2 mb-4">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Google Gemini API Key</span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline text-[11px]"
            >
              免費申請 API Key
              <ExternalLink className="w-3 h-3" />
            </a>
          </label>
          <div className="relative">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>

        {/* 測試結果反饋 */}
        {testResult && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs ${
              testResult.success
                ? 'bg-emerald-950/60 border border-emerald-700/60 text-emerald-300'
                : 'bg-rose-950/60 border border-rose-700/60 text-rose-300'
            }`}
          >
            {testResult.message}
          </div>
        )}

        {/* 按鈕組 */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleTestKey}
            disabled={isTesting || !apiKey.trim()}
            className="px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                連線測試中...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                測試連線
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            {apiKey && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-all"
              >
                清除金鑰
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
            >
              {isSavedFeedback ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  已儲存！
                </>
              ) : (
                '儲存設定'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
