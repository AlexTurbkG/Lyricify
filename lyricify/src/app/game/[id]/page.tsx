'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MultipleChoice from '@/components/MultipleChoice';
import FinishLyric from '@/components/FinishLyric';
import { ArrowLeft, Volume2 } from 'lucide-react';

export default function GameRoom() {
  const { id } = useParams();
  const router = useRouter();
  const [gameData, setGameData] = useState<any>(null);
  const [mode, setMode] = useState<1 | 2>(1);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);

  const loadRound = async () => {
    setGameData(null);
    const res = await fetch(`/api/game?playlistId=${id}`);
    if (res.ok) {
      setGameData(await res.json());
    }
  };

  useEffect(() => {
    if (id) loadRound();
  }, [id, round]);

  const handleAnswer = (isCorrect: boolean) => {
    if (isCorrect) setScore((prev) => prev + 100);
    setRound((prev) => prev + 1);
  };

  return (
    <main className="min-h-screen bg-[#121212] text-white p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <button onClick={() => router.push('/')} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm">
          <ArrowLeft className="w-4 h-4" /> Exit
        </button>
        <div className="flex gap-2 bg-[#181818] p-1 rounded-lg border border-white/10 text-xs">
          <button
            onClick={() => setMode(1)}
            className={`px-3 py-1.5 rounded-md font-semibold ${mode === 1 ? 'bg-[#1DB954] text-black' : 'text-gray-400'}`}
          >
            Multiple Choice
          </button>
          <button
            onClick={() => setMode(2)}
            className={`px-3 py-1.5 rounded-md font-semibold ${mode === 2 ? 'bg-[#1DB954] text-black' : 'text-gray-400'}`}
          >
            Finish Lyric
          </button>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Score</p>
          <p className="text-xl font-bold text-[#1DB954]">{score}</p>
        </div>
      </div>

      {gameData ? (
        <div className="w-full max-w-xl space-y-6">
          {gameData.targetTrack.previewUrl && (
            <div className="bg-[#181818] p-3 rounded-xl border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Volume2 className="w-4 h-4 text-[#1DB954]" /> Audio Preview Snippet
              </div>
              <audio controls src={gameData.targetTrack.previewUrl} className="h-8 max-w-[200px]" />
            </div>
          )}

          {mode === 1 ? (
            <MultipleChoice
              snippet={gameData.mode1.snippet}
              correctTitle={gameData.targetTrack.title}
              options={gameData.mode1.options}
              onAnswer={handleAnswer}
            />
          ) : (
            <FinishLyric
              promptLine={gameData.mode2.promptLine}
              nextPhrase={gameData.mode2.nextPhrase}
              onAnswer={handleAnswer}
            />
          )}
        </div>
      ) : (
        <p className="text-gray-500 animate-pulse mt-20">Loading next lyric challenge...</p>
      )}
    </main>
  );
}