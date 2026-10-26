const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const MARKET = 'US';

export function extractSpotifyInfo(input: string): { id: string; type: 'playlist' | 'album' } | null {
  const cleanInput = input.replace(/[\[\]'"]/g, '').trim();

  const playlistMatch = cleanInput.match(/(?:playlist\/|spotify:playlist:)([a-zA-Z0-9]+)/);
  if (playlistMatch) return { id: playlistMatch[1], type: 'playlist' };

  const albumMatch = cleanInput.match(/(?:album\/|spotify:album:)([a-zA-Z0-9]+)/);
  if (albumMatch) return { id: albumMatch[1], type: 'album' };

  if (/^[a-zA-Z0-9]{22}$/.test(cleanInput)) return { id: cleanInput, type: 'playlist' };

  return null;
}

// --- Access token caching ---------------------------------------------------
// The old code called accounts.spotify.com/api/token on every single
// request. Client-credentials tokens are valid for ~1 hour, so this caches
// the token in memory and only re-authenticates once it's about to expire -
// far fewer requests, and less exposure to rate limiting.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env.local file.');
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Spotify Access Token Error:', errorText);
    throw new Error('Failed to authenticate with Spotify API. Check your .env.local credentials.');
  }

  const data = await response.json();
  // Refresh a bit early (60s buffer) so we never hand out a token that's
  // about to expire mid-request.
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

async function spotifyFetch(url: string, token: string, retries = 1): Promise<Response> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (res.status === 429 && retries > 0) {
    const retryAfter = Number(res.headers.get('Retry-After') || '1');
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return spotifyFetch(url, token, retries - 1);
  }

  return res;
}

interface RawTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  previewUrl: string | null;
}

function mapTrackItem(
  item: any,
  type: 'playlist' | 'album',
  fallbackName: string,
  fallbackArt: string
): RawTrack | null {
  // Album items contain tracks directly; playlist items wrap tracks in item.track
  const t = type === 'album' ? item : item?.track || item?.item;
  if (!t || !t.id || !t.name || item?.is_local) return null;

  return {
    id: t.id,
    title: t.name,
    artist: t.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
    album: t.album?.name || fallbackName,
    albumArt: t.album?.images?.[0]?.url || fallbackArt,
    previewUrl: t.preview_url || null,
  };
}

export async function getPlaylistData(inputUrl: string) {
  const info = extractSpotifyInfo(inputUrl);
  if (!info) {
    throw new Error('Invalid URL format. Please paste a public Spotify Playlist or Album link.');
  }

  const token = await getAccessToken();
  const endpoint =
    info.type === 'album'
      ? `https://api.spotify.com/v1/albums/${info.id}?market=${MARKET}`
      : `https://api.spotify.com/v1/playlists/${info.id}?market=${MARKET}`;

  const res = await spotifyFetch(endpoint, token);

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    console.error(`Spotify API Error (${res.status}):`, errJson);
    if (res.status === 404) {
      throw new Error('Playlist or Album not found. Make sure it is set to Public on Spotify.');
    }
    throw new Error(errJson.error?.message || `Failed to fetch ${info.type} details from Spotify.`);
  }

  const data = await res.json();
  const name = data.name || 'Untitled';
  const coverImage = data.images?.[0]?.url || '';

  // Spotify paginates track lists (100/page for playlists, 20/page for
  // albums by default) - the old code only ever read the first page, so
  // any playlist/album longer than that was silently truncated. Walk
  // `tracks.next` until every page has been collected.
  let rawItems: any[] = data.tracks?.items || [];
  let nextUrl: string | null = data.tracks?.next || null;

  while (nextUrl) {
    const pageRes = await spotifyFetch(nextUrl, token);
    if (!pageRes.ok) break;
    const page = await pageRes.json();
    rawItems = rawItems.concat(page.items || []);
    nextUrl = page.next || null;
  }

  const tracks = rawItems
    .map((item) => mapTrackItem(item, info.type, name, coverImage))
    .filter((t): t is NonNullable<typeof t> => t !== null);

  if (tracks.length === 0) {
    throw new Error('No accessible tracks found in this playlist. Ensure the playlist is Public and contains playable songs.');
  }

  return {
    id: data.id,
    name,
    coverImage,
    trackCount: tracks.length,
    tracks,
  };
}