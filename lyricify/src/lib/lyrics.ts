function cleanTrackTitle(title: string): string {
  return title
    .replace(/\(feat\..*?\)/gi, '')
    .replace(/\bfeat\..*/gi, '')
    .replace(/\bft\..*/gi, '')
    // NOTE: the old code also had `.replace(/with\..*/gi, '')` here. That
    // required a literal period right after "with" ("with."), which real
    // track titles never have - so it was dead code that silently matched
    // nothing. Featuring credits like "(with Artist)" are already handled
    // by the parenthetical-stripping rule below.
    .replace(/-\s*.*?(remaster|live|deluxe|version|edition|reissue|mono|stereo|bonus|anniversary).*$/gi, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanArtistName(artist: string): string {
  return artist
    .split(/[,&/]/)[0]
    .replace(/feat\..*/gi, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseLyricsToLines(rawLyrics: string): string[] {
  if (!rawLyrics) return [];

  const clean = rawLyrics.replace(/\[\d+:\d+\.\d+\]/g, '');

  const lines = clean
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || line.length <= 3) return false;
      if (line.startsWith('[') && line.endsWith(']')) return false;
      const lower = line.toLowerCase();
      if (lower.includes('embed')) return false;
      // Filters out scraped page headers like "42 ContributorsSong Lyrics"
      // without also killing a genuine lyric line that happens to contain
      // the word "lyrics" (the old blanket `.includes('lyrics')` check did).
      if (lower.endsWith('lyrics') && line.split(/\s+/).length < 8) return false;
      return true;
    });

  // Collapse consecutive duplicate lines (common when a chorus/hook repeats
  // back-to-back) so the game never serves the exact same line twice in a row.
  return lines.filter((line, i) => line !== lines[i - 1]);
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLyrics(rawTitle: string, rawArtist: string): Promise<string[]> {
  const title = cleanTrackTitle(rawTitle);
  const artist = cleanArtistName(rawArtist);

  if (!title) return [];

  // 1. Query LRCLIB by Title + Artist (fuzzy search - most forgiving)
  try {
    const query = `${title} ${artist}`.trim();
    const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Lyricify/1.0' } });
    if (res.ok) {
      const results = await res.json();
      if (Array.isArray(results) && results.length > 0) {
        for (const item of results.slice(0, 5)) {
          const lyricsText = item.plainLyrics || item.syncedLyrics;
          if (lyricsText) {
            const lines = parseLyricsToLines(lyricsText);
            if (lines.length >= 4) return lines;
          }
        }
      }
    }
  } catch {
    // network error / timeout - fall through to the next strategy
  }

  // 2. Query LRCLIB Direct Match (exact title/artist)
  if (artist) {
    try {
      const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
      const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Lyricify/1.0' } });
      if (res.ok) {
        const data = await res.json();
        const lyricsText = data.plainLyrics || data.syncedLyrics;
        if (lyricsText) {
          const lines = parseLyricsToLines(lyricsText);
          if (lines.length >= 4) return lines;
        }
      }
    } catch {
      // network error / timeout
    }
  }

  // 3. Last resort: search by title only. Helps when the artist string we
  // have doesn't match what LRCLIB has on file (compilation credits,
  // "Various Artists", heavily co-billed tracks, etc.)
  try {
    const url = `https://lrclib.net/api/search?q=${encodeURIComponent(title)}`;
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Lyricify/1.0' } });
    if (res.ok) {
      const results = await res.json();
      if (Array.isArray(results) && results.length > 0) {
        for (const item of results.slice(0, 5)) {
          const lyricsText = item.plainLyrics || item.syncedLyrics;
          if (lyricsText) {
            const lines = parseLyricsToLines(lyricsText);
            if (lines.length >= 4) return lines;
          }
        }
      }
    }
  } catch {
    // network error / timeout
  }

  return [];
}