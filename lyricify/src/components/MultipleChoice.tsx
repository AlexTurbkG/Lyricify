'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface Option {
  title: string;
  artist: string;
}

interface Props {
  snippet: string;
  correctTitle: string;
  options: Option[];
  onAnswer: (isCorrect: boolean) => void;
}

export default function MultipleChoice({ snippet, correctTitle, options, onAnswer }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (title: string) => {
    if (selected) return;
    setSelected(title);
    const correct = title === correctTitle;
    setTimeout(() => {
      onAnswer(correct);
      setSelected(null);
    }, 1200);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 w-full max-w-xl mx-auto"
    >
      <div className="bg-[#181818] p-8 rounded-2xl border border-white/10 shadow-2xl text-center backdrop-blur-lg">
        <span className="text-[#1DB954] text-xs font-bold uppercase tracking-wider mb-3 block">
          Which song features this lyric?
        </span>
        <p className="text-2xl font-serif italic text-white leading-relaxed">"{snippet}"</p>
      </div>

      <div className="grid grid-cols-1 gap-3" role="group" aria-label="Answer options">
        {options.map((opt, idx) => {
          let style = 'bg-[#282828] hover:bg-[#333333] border-white/5 text-white';
          if (selected) {
            if (opt.title === correctTitle) {
              style = 'bg-[#1DB954]/20 border-[#1DB954] text-[#1DB954]';
            } else if (opt.title === selected) {
              style = 'bg-red-500/20 border-red-500 text-red-400';
            }
          }

          return (
            <button
              key={`${opt.title}-${opt.artist}-${idx}`}
              disabled={!!selected}
              onClick={() => handleSelect(opt.title)}
              aria-pressed={selected === opt.title}
              className={`p-4 rounded-xl border text-left font-medium transition duration-200 flex justify-between items-center disabled:cursor-not-allowed ${style}`}
            >
              <div>
                <p className="font-bold">{opt.title}</p>
                <p className="text-xs text-gray-400">{opt.artist}</p>
              </div>
            </button>
          );
        })}
      </div>
      {/* Options are matched by title text alone (that's the interface this
          component was given). If a playlist can ever contain two tracks
          with the exact same title, pass a unique id instead so the
          correct/incorrect highlighting can't land on the wrong option. */}
    </motion.div>
  );
} 