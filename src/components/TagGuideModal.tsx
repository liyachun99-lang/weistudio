import React from 'react';
import { X, Sparkles, BookOpen, Check, Copy } from 'lucide-react';

interface TagGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertTag: (tag: string) => void;
}

export const TagGuideModal: React.FC<TagGuideModalProps> = ({
  isOpen,
  onClose,
  onInsertTag,
}) => {
  if (!isOpen) return null;

  const tags = [
    {
      category: '擬真呼吸與氣息 (Vocal Bursts)',
      modelNote: 'Gemini 3.8 Flash TTS 原生旗艦支援',
      items: [
        {
          tag: '<breath>',
          title: '換氣與呼吸聲',
          desc: '插入自然的呼吸停頓與吸氣聲，常放在段落轉折或長句之間，營造真人說話的呼吸感。',
          example: '各位聽眾朋友晚安。<breath> 今天想跟大家聊一段深刻的故事。',
        },
        {
          tag: '<laugh>',
          title: '輕笑聲',
          desc: '在對話或台詞中加入自然的笑意與輕笑聲，非常適合幽默、美食與生活短劇。',
          example: '你怎麼會把鹽巴當成糖放進去啦！<laugh> 太搞笑了！',
        },
        {
          tag: '<gasp>',
          title: '倒抽一口氣 / 驚嘆',
          desc: '表現驚訝、嚇一跳或屏息以待的瞬間，適合故事高潮、懸疑說書與突發事件。',
          example: '只見門縫後面忽然露出一隻眼睛！<gasp> 把大家都嚇了一大跳！',
        },
      ],
    },
    {
      category: '背道附和與點頭反饋 (Backchanneling)',
      modelNote: '雙人對談與 Podcast 必備',
      items: [
        {
          tag: '|mhm|',
          title: '嗯哼 / 輕聲附和',
          desc: '表示正在聆聽與認同的柔和附和音，讓對談更具生活臨場感。',
          example: 'Sam: |mhm| 這點我也完全贊同你的看法。',
        },
        {
          tag: '|yeah|',
          title: '對啊 / 點頭贊成',
          desc: '自然承接上文的肯定語氣，消除傳統機器人朗讀的機械感。',
          example: 'Alex: |yeah| 這真的是今年最具突破性的語音進展了！',
        },
      ],
    },
    {
      category: '停頓與語調調節 (Pacing Tags)',
      modelNote: '雙模型通用',
      items: [
        {
          tag: '[停頓 0.5s]',
          title: '中度停頓 (0.5 秒)',
          desc: '語氣轉折處、標點符號間的思考留白。',
          example: '今天的天氣非常晴朗，[停頓 0.5s] 很適合全家出遊。',
        },
        {
          tag: '[停頓 1.0s]',
          title: '長度停頓 (1.0 秒)',
          desc: '段落換氣、主題切換或懸念留白。',
          example: '到底最後的贏家是誰呢？[停頓 1.0s] 讓我們揭曉答案！',
        },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                Gemini 3.8 TTS 語音標籤與語法指南
              </h3>
              <p className="text-xs text-slate-400">
                點擊標籤即可直接插入編輯器，提升台灣口音擬真度
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-6">
          {tags.map((group) => (
            <div key={group.category} className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="font-bold text-sm text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {group.category}
                </h4>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {group.modelNote}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {group.items.map((item) => (
                  <div
                    key={item.tag}
                    className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                          {item.tag}
                        </code>
                        <span className="text-xs font-semibold text-slate-200">
                          {item.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {item.desc}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono italic">
                        範例：{item.example}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        onInsertTag(item.tag);
                        onClose();
                      }}
                      className="shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 text-xs font-medium transition-all"
                    >
                      <Copy className="w-3 h-3" />
                      插入標籤
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* 台灣腔調特別訣竅 */}
          <div className="bg-gradient-to-r from-cyan-950/40 to-blue-950/40 border border-cyan-500/30 rounded-2xl p-4 space-y-2">
            <h5 className="font-bold text-xs text-cyan-300">
              💡 台灣在地化語音微調小技巧
            </h5>
            <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
              <li>
                善用台灣口語助詞（例如：<strong>啦、喔、呢、耶、齁、捏</strong>），能大幅增加生活感。
              </li>
              <li>
                點擊編輯器中的「<strong>✨ AI 台式口語潤飾</strong>」，可自動將生硬的普通話改寫為台灣道地對白。
              </li>
              <li>
                雙人對談時，主持人可以使用 <strong>|mhm|</strong> 或 <strong>|yeah|</strong> 作為聽者反饋，創造驚人逼真的對談氣氛！
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
          >
            關閉指南
          </button>
        </div>
      </div>
    </div>
  );
};
