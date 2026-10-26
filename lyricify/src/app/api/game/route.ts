import { NextRequest, NextResponse } from 'next/server';
import { readDb, savePlaylist, deletePlaylist, Playlist, Track } from '@/lib/jsonDb';
import { getPlaylistData } from '@/lib/spotify';
import { fetchLyrics } from '@/lib/lyrics';

const MIN_PLAYABLE_TRACKS = 4;
const LYRICS_FETCH_CONCURRENCY = 5;

// Runs `task` over `items` with at most `limit` running at once, so
// importing a big playlist doesn't fire off 100+ simultaneous requests
// against the lyrics API.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const current = next++;
      results[current] = await task(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function GET() {
  const db = await readDb();
  // The frontend calls `playlists.map(...)` directly on the response body,
  // so this has to be the raw array, not `{ playlists: [...] }`. Returning
  // the wrapped object was exactly what caused
  // "playlists.map is not a function".
  return NextResponse.json(db.playlists);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const url = body?.url;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Please paste a Spotify playlist or album URL.' }, { status: 400 });
    }

    // The frontend only ever sends { url }, not a full playlist object - the
    // actual Spotify fetch + lyrics lookup has to happen here.
    const playlistData = await getPlaylistData(url);

    const tracksWithLyrics: Track[] = await mapWithConcurrency(
      playlistData.tracks,
      LYRICS_FETCH_CONCURRENCY,
      async (track) => ({
        ...track,
        lyrics: await fetchLyrics(track.title, track.artist),
      })
    );

    const playableCount = tracksWithLyrics.filter((t) => t.lyrics && t.lyrics.length >= 4).length;

    if (playableCount < MIN_PLAYABLE_TRACKS) {
      return NextResponse.json(
        {
          error: `Only found usable lyrics for ${playableCount} of ${tracksWithLyrics.length} tracks. Need at least ${MIN_PLAYABLE_TRACKS} to play - try a different playlist.`,
        },
        { status: 400 }
      );
    }

    const playlist: Playlist = {
      id: playlistData.id,
      name: playlistData.name,
      coverImage: playlistData.coverImage,
      // "Playable tracks" means tracks we can actually quiz on, i.e. ones
      // with lyrics - not just the raw Spotify track count.
      trackCount: playableCount,
      tracks: tracksWithLyrics,
    };

    const saved = await savePlaylist(playlist);
    return NextResponse.json({ playlist: saved });
  } catch (err: any) {
    console.error('Failed to import playlist:', err);
    return NextResponse.json({ error: err?.message || 'Failed to import playlist.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Accept the id as either ?id=... or a JSON body { id } (the frontend
    // sends it in the body).
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      const delBody = await req.json().catch(() => null);
      id = delBody?.id ?? null;
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing playlist id.' }, { status: 400 });
    }

    const removed = await deletePlaylist(id);

    if (!removed) {
      return NextResponse.json({ error: 'Playlist not found.' }, { status: 404 });
    }

    // Playlist (and everything nested in it) is now gone from db.json.
    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error('Failed to delete playlist:', err);
    return NextResponse.json({ error: 'Failed to delete playlist.' }, { status: 500 });
  }
}