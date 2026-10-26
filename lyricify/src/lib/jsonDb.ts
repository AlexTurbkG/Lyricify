import fs from 'fs/promises';
import path from 'path';
 
const DB_PATH = path.join(process.cwd(), 'data', 'db.json');
const DB_DIR = path.dirname(DB_PATH);
 
export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  previewUrl?: string | null;
  lyrics?: string[];
}
 
export interface Playlist {
  id: string;
  name: string;
  coverImage?: string;
  trackCount?: number;
  tracks: Track[];
  // Keep this open-ended so any extra fields the app already stores
  // (stats, lastPlayed, etc.) keep working without a type change here.
  [key: string]: any;
}
 
interface Db {
  playlists: Playlist[];
}
 
// --- Write queue -----------------------------------------------------------
// The old version did read -> modify -> write with no coordination, so two
// requests arriving close together (e.g. saving a playlist while deleting
// another) could both read the same "before" state and the second write
// would silently overwrite the first ("lost update"). Chaining every
// read-modify-write cycle through this queue makes them run one at a time.
let writeChain: Promise<unknown> = Promise.resolve();
 
function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task);
  // Normalize back to a resolved promise so one failed write doesn't
  // permanently jam the queue for everything after it.
  writeChain = run.catch(() => undefined);
  return run;
}
 
export async function readDb(): Promise<Db> {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    if (!parsed || !Array.isArray(parsed.playlists)) {
      return { playlists: [] };
    }
    return parsed;
  } catch {
    return { playlists: [] };
  }
}
 
async function writeDb(db: Db): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  // Write to a temp file then rename over the real one. Rename is atomic on
  // the same filesystem, so a crash/interrupt mid-write can never leave
  // db.json half-written/corrupted the way a direct writeFile could.
  const tmpPath = `${DB_PATH}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(db, null, 2));
  await fs.rename(tmpPath, DB_PATH);
}
 
export async function getPlaylist(id: string): Promise<Playlist | undefined> {
  const db = await readDb();
  return db.playlists.find((p) => p.id === id);
}
 
export async function savePlaylist(playlist: Playlist): Promise<Playlist> {
  return enqueueWrite(async () => {
    const db = await readDb();
    const existingIndex = db.playlists.findIndex((p) => p.id === playlist.id);
    if (existingIndex >= 0) {
      db.playlists[existingIndex] = playlist;
    } else {
      db.playlists.push(playlist);
    }
    await writeDb(db);
    return playlist;
  });
}
 
// Removes a playlist - and everything nested inside it (tracks, cached
// lyrics, stats, whatever else lives on the object) - from db.json.
// Returns true only if a playlist actually existed and was removed, so
// callers/routes can tell a real delete apart from a no-op.
export async function deletePlaylist(id: string): Promise<boolean> {
  return enqueueWrite(async () => {
    const db = await readDb();
    const before = db.playlists.length;
    db.playlists = db.playlists.filter((p) => p.id !== id);
    const removed = db.playlists.length < before;
    if (removed) {
      await writeDb(db);
    }
    return removed;
  });
}
 
// Wipes every playlist from db.json - handy for a "reset everything" admin
// action, or for tests.
export async function clearDb(): Promise<void> {
  return enqueueWrite(async () => {
    await writeDb({ playlists: [] });
  });
}
 
