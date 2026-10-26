'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Props {
  promptLine: string;
  nextPhrase: string;
  onAnswer: (isCorrect: boolean) => void;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// The old check was `cleanTarget.includes(cleanInput) && cleanInput.length > 3`,
// which had two problems: any next-phrase 3 characters or shorter could
// never be answered correctly (target.length <= 3 can't satisfy both
// conditions), and a short, generic guess that happened to be a substring
// of a long line ("you", "the") could be marked correct. This scales the
// substring check by how much of the actual line the guess covers.
function isCloseEnough(input: string, target: string): boolean {
  if (!input || !target) return false;
  if (input === target) return true;
  if (target.includes(input) || input.includes(target)) {
    const shorter = Math.min(input.length, target.length);
    const longer = Math.max(input.length, target.length);
    return shorter > 2 && shorter / longer > 0.6;
  }
  return false;
}

export default function FinishLyric({ promptLine, nextPhrase, onAnswer }: Props) {
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [promptLine]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || submitted) return;

    const correct = isCloseEnough(normalize(input), normalize(nextPhrase));
    setIsCorrect(correct);
    setSubmitted(true);

    setTimeout(() => {
      onAnswer(correct);
      setInput('');
      setSubmitted(false);
      setIsCorrect(null);
    }, 1800);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 w-full max-w-xl mx-auto"
    >
      <div className="bg-[#181818] p-8 rounded-2xl border border-white/10 shadow-2xl space-y-4 backdrop-blur-lg">
        <span className="text-[#1DB954] text-xs font-bold uppercase tracking-wider block">
          Finish the Next Line
        </span>
        <p className="text-xl font-serif text-gray-300">"{promptLine}"</p>
        <p className="text-2xl font-serif italic text-[#1DB954]">"..."</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          disabled={submitted}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type the next lyric phrase..."
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full px-5 py-4 bg-[#282828] text-white rounded-xl border border-white/10 focus:border-[#1DB954] focus:outline-none transition disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={submitted || !input.trim()}
          className="w-full py-3.5 bg-[#1DB954] text-black font-bold rounded-xl hover:bg-[#1ed760] transition disabled:opacity-50"
        >
          Submit Answer
        </button>
      </form>

      {submitted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-4 rounded-xl border text-center ${
            isCorrect ? 'bg-[#1DB954]/20 border-[#1DB954]' : 'bg-red-500/20 border-red-500'
          }`}
        >
          <p className={`text-xs uppercase font-bold ${isCorrect ? 'text-[#1DB954]' : 'text-red-400'}`}>
            {isCorrect ? 'Correct!' : 'Not quite'}
          </p>
          <p className="text-white font-medium mt-1">{nextPhrase}</p>
        </motion.div>
      )}
    </motion.div>
  );
}