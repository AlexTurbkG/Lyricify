'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Music, Play, Trash2 } from 'lucide-react';

interface SavedPlaylist {
  id: string;
  name: string;
  coverImage?: string;
  trackCount?: number;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [playlists, setPlaylists] = useState<SavedPlaylist[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSavedPlaylists = async () => {
    try {
      const res = await fetch('/api/playlists');
      const data = await res.json();
      // Defensive: never let an unexpected response shape crash the page
      // with "playlists.map is not a function" again.
      setPlaylists(Array.isArray(data) ? data : []);
    } catch {
      setPlaylists([]);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedPlaylists();
  }, []);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (res.ok) {
        setUrl('');
        fetchSavedPlaylists();
      } else {
        setErrorMsg(data.error || 'Failed to import playlist.');
      }
    } catch {
      setErrorMsg('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const res = await fetch('/api/playlists', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setPlaylists((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert('Failed to delete playlist');
      }
    } catch {
      alert('Failed to delete playlist');
    }
  };

  return (
    <main className="min-h-screen bg-[#121212] text-white p-6 md:p-12 space-y-12 max-w-5xl mx-auto">
      <div className="relative text-center space-y-4">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/3 rounded-full bg-[#1DB954]/20 blur-3xl"
        />
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1DB954]/10 text-[#1DB954] text-xs font-bold border border-[#1DB954]/20">
          <Sparkles className="w-3.5 h-3.5" /> Spotify Lyric Guesser
        </div>
        <h1 className="text-5xl font-black text-white tracking-tight sm:text-6xl">
          Lyric<span className="text-[#1DB954]">ify</span>
        </h1>
        <p className="text-gray-400 max-w-md mx-auto text-sm">
          Paste any public Spotify playlist link, extract track lyrics, and test your music memory.
        </p>
      </div>

      <div className="max-w-xl mx-auto space-y-3">
        <form onSubmit={handleImport} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste Spotify Playlist URL or URI..."
            className="flex-1 px-4 py-3.5 bg-[#181818] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#1DB954] transition"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3.5 bg-[#1DB954] text-black font-bold rounded-xl hover:bg-[#1ed760] transition disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Import'}
          </button>
        </form>

        {loading && (
          <p className="text-center text-xs text-gray-500">
            Fetching tracks and lyrics — larger playlists can take a minute.
          </p>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl text-center">
            {errorMsg}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Music className="w-5 h-5 text-[#1DB954]" /> Saved Playlists
        </h2>

        {initialLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-[#181818] p-4 rounded-xl border border-white/5 space-y-3 animate-pulse">
                <div className="w-full aspect-square rounded-lg bg-[#282828]" />
                <div className="h-4 w-2/3 rounded bg-[#282828]" />
                <div className="h-3 w-1/3 rounded bg-[#282828]" />
              </div>
            ))}
          </div>
        ) : playlists.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
            <Music className="w-8 h-8 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No playlists yet — paste a link above to import your first one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                className="bg-[#181818] p-4 rounded-xl border border-white/5 hover:border-[#1DB954]/40 transition space-y-3 relative group"
              >
                <button
                  onClick={() => handleDelete(pl.id, pl.name)}
                  className="absolute top-6 right-6 bg-black/60 hover:bg-red-600 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition"
                  title="Delete playlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="w-full aspect-square rounded-lg overflow-hidden bg-[#282828] flex items-center justify-center">
                  {pl.coverImage ? (
                    <img src={pl.coverImage} alt={pl.name} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <Music className="w-10 h-10 text-gray-600" />
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-white truncate pr-6">{pl.name}</h3>
                  <p className="text-xs text-gray-400">{pl.trackCount ?? 0} playable tracks</p>
                </div>
                <Link
                  href={`/game/${pl.id}`}
                  className="w-full py-2 bg-[#282828] hover:bg-[#1DB954] hover:text-black font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Play Game
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="text-center text-[11px] text-gray-600 pt-6">
        Not affiliated with Spotify. Lyrics provided by LRCLIB.
      </footer>
    </main>
  );
}