import React, { useState } from 'react';
import {
  Search,
  Volume2,
  Sparkles,
  ArrowRight,
  Filter,
  Check,
  Star,
  Loader2,
  Briefcase,
  Stethoscope,
  HeartPulse,
  GraduationCap,
  Scale,
} from 'lucide-react';
import { VoiceActor, VOAI_VOICES, CATEGORIES, PROFESSION_OPTIONS } from '../data/voices';

interface VoiceLibraryProps {
  selectedVoice: VoiceActor;
  onSelectVoice: (voice: VoiceActor) => void;
  onGenerateSample: (voice: VoiceActor) => void;
  previewingVoiceId: string | null;
}

export const VoiceLibrary: React.FC<VoiceLibraryProps> = ({
  selectedVoice,
  onSelectVoice,
  onGenerateSample,
  previewingVoiceId,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [selectedProfession, setSelectedProfession] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<'all' | 'female' | 'male'>('all');
  const [selectedAge, setSelectedAge] = useState<'all' | 'child' | 'young' | 'mature' | 'senior'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('voai_favorites');
      return saved ? JSON.parse(saved) : ['dr-chen', 'nurse-yiting', 'dietitian-ssuyu', 'teacher-chang', 'therapist-shuhan'];
    } catch {
      return ['dr-chen', 'nurse-yiting', 'dietitian-ssuyu'];
    }
  });

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      localStorage.setItem('voai_favorites', JSON.stringify(next));
      return next;
    });
  };

  // 篩選聲優列表
  const filteredVoices = VOAI_VOICES.filter((voice) => {
    // 職業篩選
    if (selectedProfession !== 'all') {
      if (selectedProfession === '老師') {
        if (voice.profession !== '老師' && !voice.profession.includes('教授')) return false;
      } else if (!voice.profession.includes(selectedProfession)) {
        return false;
      }
    }
    // 類別情境篩選
    if (selectedCategory !== '全部' && voice.category !== selectedCategory) {
      return false;
    }
    // 性別篩選
    if (selectedGender !== 'all' && voice.gender !== selectedGender) {
      return false;
    }
    // 年齡篩選
    if (selectedAge !== 'all' && voice.ageGroup !== selectedAge) {
      return false;
    }
    // 關鍵字搜尋
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = voice.name.toLowerCase().includes(q) || voice.englishName.toLowerCase().includes(q);
      const matchTag = voice.tags.some((t) => t.toLowerCase().includes(q));
      const matchAccent = voice.accent.toLowerCase().includes(q);
      const matchDesc = voice.description.toLowerCase().includes(q);
      const matchProf = voice.profession.toLowerCase().includes(q);
      if (!matchName && !matchTag && !matchAccent && !matchDesc && !matchProf) {
        return false;
      }
    }
    return true;
  });

  const getProfessionBadgeColor = (prof: string) => {
    if (prof.includes('醫師')) return 'bg-cyan-950/90 text-cyan-300 border-cyan-700/60';
    if (prof.includes('營養師')) return 'bg-emerald-950/90 text-emerald-300 border-emerald-700/60';
    if (prof.includes('護理師')) return 'bg-rose-950/90 text-rose-300 border-rose-700/60';
    if (prof.includes('心理師')) return 'bg-teal-950/90 text-teal-300 border-teal-700/60';
    if (prof.includes('老師') || prof.includes('教授')) return 'bg-amber-950/90 text-amber-300 border-amber-700/60';
    if (prof.includes('律師')) return 'bg-indigo-950/90 text-indigo-300 border-indigo-700/60';
    if (prof.includes('教練')) return 'bg-orange-950/90 text-orange-300 border-orange-700/60';
    if (prof.includes('導遊')) return 'bg-lime-950/90 text-lime-300 border-lime-700/60';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="space-y-6">
      {/* 頂部引言與搜尋 */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              WEIAI Studio × Gemini 3.8 全職業專業聲優庫 (26+ 位)
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              涵蓋 <span className="text-cyan-400">醫師、營養師、護理師、老師、心理師</span> 等專業角色
            </h2>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">
              為醫病衛教、健康諮詢、線上教學、心理輔導與法律顧問等專業場景打造。
              每個職業均具備專屬腔調起伏與親和說服力，完美呈現台灣在地專業口吻。
            </p>
          </div>

          {/* 搜尋框 */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜尋醫師、護理師、心理師、姓名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                清除
              </button>
            )}
          </div>
        </div>

        {/* 職業快速篩選按鈕專區 */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="flex items-center gap-2 mb-2.5">
            <Briefcase className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-200">職業專區快速切換：</span>
            {selectedProfession !== 'all' && (
              <button
                onClick={() => setSelectedProfession('all')}
                className="text-[11px] text-cyan-400 hover:underline ml-auto"
              >
                重設為全部職業
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {PROFESSION_OPTIONS.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedProfession(item.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  selectedProfession === item.id
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 條件篩選工具列 */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-3">
          {/* 性別篩選 */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedGender('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                selectedGender === 'all'
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              全部性別
            </button>
            <button
              onClick={() => setSelectedGender('female')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                selectedGender === 'female'
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              女性
            </button>
            <button
              onClick={() => setSelectedGender('male')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                selectedGender === 'male'
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              男性
            </button>
          </div>

          {/* 年齡層篩選 */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-500 pl-2 pr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> 年齡：
            </span>
            {(['all', 'young', 'mature', 'child', 'senior'] as const).map((age) => {
              const labelMap: Record<string, string> = {
                all: '不限',
                young: '青年',
                mature: '熟齡',
                child: '少年/童音',
                senior: '長輩',
              };
              return (
                <button
                  key={age}
                  onClick={() => setSelectedAge(age)}
                  className={`px-2.5 py-1.5 rounded-lg transition-colors font-medium ${
                    selectedAge === age
                      ? 'bg-slate-700 text-cyan-300 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {labelMap[age]}
                </button>
              );
            })}
          </div>

          <div className="text-xs text-slate-400 ml-auto">
            共找到 <span className="text-cyan-400 font-bold">{filteredVoices.length}</span> 位專業 AI 聲優
          </div>
        </div>

        {/* 情境分類標籤滑動條 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-4 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 聲優卡片網格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredVoices.map((voice) => {
          const isSelected = selectedVoice.id === voice.id;
          const isFavorited = favorites.includes(voice.id);
          const isPreviewing = previewingVoiceId === voice.id;

          return (
            <div
              key={voice.id}
              className={`group bg-slate-900/90 border rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between relative hover:border-cyan-500/60 hover:shadow-xl hover:shadow-cyan-950/20 ${
                isSelected
                  ? 'border-cyan-500 ring-2 ring-cyan-500/30 bg-slate-900'
                  : 'border-slate-800'
              }`}
            >
              {/* 卡片頂部 */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={voice.avatar}
                        alt={voice.name}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-700 group-hover:border-cyan-400 transition-colors shadow-md"
                      />
                      <span
                        className={`absolute -bottom-1 -right-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${
                          voice.gender === 'female'
                            ? 'bg-pink-950 text-pink-300 border-pink-700'
                            : 'bg-blue-950 text-blue-300 border-blue-700'
                        }`}
                      >
                        {voice.gender === 'female' ? '女' : '男'}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-base text-white group-hover:text-cyan-300 transition-colors">
                          {voice.name}
                        </h3>
                        {/* 職業徽章 */}
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${getProfessionBadgeColor(
                            voice.profession
                          )}`}
                        >
                          {voice.profession}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-medium mt-1">
                        {voice.ageDesc} • {voice.category}
                      </p>
                    </div>
                  </div>

                  {/* 收藏按鈕 */}
                  <button
                    onClick={(e) => toggleFavorite(voice.id, e)}
                    className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors rounded-lg hover:bg-slate-800"
                    title={isFavorited ? '取消收藏' : '加入收藏'}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        isFavorited ? 'fill-amber-400 text-amber-400' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* 腔調與口音標籤 */}
                <div className="inline-block bg-slate-950/80 px-2.5 py-1 rounded-lg text-xs font-medium text-cyan-300 border border-slate-800 mb-2.5">
                  🎙️ {voice.accent}
                </div>

                {/* 聲線標語與詳細描述 */}
                <p className="text-xs font-semibold text-slate-200 line-clamp-1 mb-1">
                  「{voice.tagline}」
                </p>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
                  {voice.description}
                </p>

                {/* 示範文本預覽 */}
                <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-850 mb-3 text-xs text-slate-300 italic line-clamp-2">
                  "{voice.sampleText}"
                </div>

                {/* 標籤群 */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {voice.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/50"
                    >
                      #{tag}
                    </span>
                  ))}
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-950/50 text-indigo-300 border border-indigo-700/40 font-mono ml-auto">
                    {voice.geminiVoice}
                  </span>
                </div>
              </div>

              {/* 底部操作按鈕 */}
              <div className="pt-3 border-t border-slate-850 flex items-center gap-2">
                <button
                  onClick={() => onGenerateSample(voice)}
                  disabled={isPreviewing}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-60"
                >
                  {isPreviewing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      語音合成中...
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                      試聽示範
                    </>
                  )}
                </button>

                <button
                  onClick={() => onSelectVoice(voice)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                      : 'bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30'
                  }`}
                >
                  {isSelected ? '正在使用' : '選用此角色'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
