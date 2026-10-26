'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MultipleChoice from '@/components/MultipleChoice';
import FinishLyric from '@/components/FinishLyric';
import { ArrowLeft, Volume2, RotateCw } from 'lucide-react';

interface GameData {
  targetTrack: { id: string; title: string; artist: string; albumArt?: string; previewUrl?: string | null };
  mode1: { snippet: string; options: { title: string; artist: string }[] };
  mode2: { promptLine: string; nextPhrase: string };
}

// The old page did `if (res.ok) setGameData(await res.json())` and then read
// `gameData.targetTrack.previewUrl`. Any 200 response that wasn't shaped like a
// game round (e.g. a JSON array from the wrong route) crashed the whole page.
function isGameData(d: any): d is GameData {
  return (
    !!d &&
    !Array.isArray(d) &&
    !!d.targetTrack &&
    typeof d.mode1?.snippet === 'string' &&
    Array.isArray(d.mode1?.options) &&
    typeof d.mode2?.promptLine === 'string' &&
    typeof d.mode2?.nextPhrase === 'string'
  );
}

export default function GameRoom() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<1 | 2>(1);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false; // ignore responses from a round we've already moved past

    setGameData(null);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/game?playlistId=${encodeURIComponent(id)}`, { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (!res.ok) {
          setError(data?.error || `Could not load a round (HTTP ${res.status}).`);
          return;
        }
        if (!isGameData(data)) {
          console.error('Unexpected /api/game response:', data);
          setError('The game API returned an unexpected response (details in the browser console).');
          return;
        }
        setGameData(data);
      } catch {
        if (!cancelled) setError('Network error while loading the next round.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, round, attempt]);

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

      {error ? (
        <div className="w-full max-w-xl text-center space-y-4 mt-12">
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setAttempt((a) => a + 1)}
              className="flex items-center gap-2 px-4 py-2 bg-[#1DB954] text-black font-bold text-sm rounded-xl hover:bg-[#1ed760] transition"
            >
              <RotateCw className="w-4 h-4" /> Try again
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-[#282828] text-white font-semibold text-sm rounded-xl hover:bg-[#333333] transition"
            >
              Back to playlists
            </button>
          </div>
        </div>
      ) : gameData ? (
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
              key={round}
              snippet={gameData.mode1.snippet}
              correctTitle={gameData.targetTrack.title}
              options={gameData.mode1.options}
              onAnswer={handleAnswer}
            />
          ) : (
            <FinishLyric
              key={round}
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