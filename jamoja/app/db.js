// Jamoja data layer.
//  live  : Supabase (when config.js has a URL and key)
//  local : everything saved on this phone in IndexedDB (no database connected yet)
//  mock  : in memory, for automated tests (?mock=1)
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=20261125e';

const MOCK = new URLSearchParams(location.search).has('mock');
const configured = !!(SUPABASE_URL && SUPABASE_KEY);
const sb = !MOCK && configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
export const mode = MOCK ? 'mock' : configured ? 'live' : 'local';
const PERSIST = mode === 'local';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now().toString(16) + Math.random().toString(16).slice(2));
const now = () => new Date().toISOString();
function chk({ data, error }) { if (error) throw new Error(error.message || 'Something went wrong'); return data; }

// ---------- tiny IndexedDB helper (local mode + recording safety net)
let dbp = null;
function idbOpen() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open('jamoja', 1);
    r.onupgradeneeded = () => { const d = r.result; for (const n of ['kv', 'files', 'chunks']) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function idb(store, mode2, fn) {
  const d = await idbOpen();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode2); const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req ? req.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Storage is full or blocked'));
  });
}
export const local = {
  get: (s, id) => idb(s, 'readonly', st => st.get(id)),
  all: (s) => idb(s, 'readonly', st => st.getAll()),
  put: (s, v) => idb(s, 'readwrite', st => st.put(v)),
  del: (s, id) => idb(s, 'readwrite', st => st.delete(id)),
};

// ---------- in-memory state used by local and mock modes
let M = { users: {}, session: null, profiles: {}, games: {}, players: {}, highlights: {} };
const FILES = {}; // path -> object URL
let authListeners = [];
const emit = () => authListeners.forEach(f => f());
async function save() { if (PERSIST) await local.put('kv', { id: 'state', M: { ...M, session: null } }); }

export const ready = (async () => {
  if (!PERSIST) return;
  try { const s = await local.get('kv', 'state'); if (s && s.M) M = s.M; } catch (e) { console.warn('local load failed', e); }
  M.session = { id: 'local-player' };
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* optional */ }
})();

export const auth = {
  async user() {
    if (sb) { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; }
    return M.session;
  },
  onChange(fn) { if (sb) sb.auth.onAuthStateChange(() => fn()); else authListeners.push(fn); },
  async signUp(email, password) {
    if (sb) { const d = chk(await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } })); return { needsConfirm: !d.session }; }
    if (M.users[email]) throw new Error('That email already has an account. Sign in instead.');
    M.users[email] = { id: uid(), email, password }; M.session = M.users[email]; emit(); return { needsConfirm: false };
  },
  async signIn(email, password) {
    if (sb) { chk(await sb.auth.signInWithPassword({ email, password })); return; }
    const u = M.users[email]; if (!u || u.password !== password) throw new Error('Email or password is wrong.');
    M.session = u; emit();
  },
  async signOut() { if (sb) await sb.auth.signOut(); else if (!PERSIST) { M.session = null; emit(); } },
};

export const profiles = {
  async byId(id) { if (sb) return chk(await sb.from('profiles').select('*').eq('id', id).maybeSingle()); return M.profiles[id] || null; },
  async byHandle(h) { if (sb) return chk(await sb.from('profiles').select('*').eq('handle', h).maybeSingle()); return Object.values(M.profiles).find(p => p.handle === h) || null; },
  async save(p) {
    if (sb) return chk(await sb.from('profiles').upsert(p).select().single());
    if (Object.values(M.profiles).some(x => x.handle === p.handle && x.id !== p.id)) throw new Error('That handle is taken. Try another.');
    M.profiles[p.id] = { ...(M.profiles[p.id] || { created_at: now() }), ...p }; await save(); return M.profiles[p.id];
  },
};

export const games = {
  async create(g) { if (sb) return chk(await sb.from('games').insert(g).select().single()); const r = { id: uid(), created_at: now(), ...g }; M.games[r.id] = r; await save(); return r; },
  async get(id) {
    if (sb) return chk(await sb.from('games').select('*, owner:profiles(id,name,handle)').eq('id', id).maybeSingle());
    const g = M.games[id]; if (!g) return null; const o = M.profiles[g.owner_id];
    return { ...g, owner: o ? { id: o.id, name: o.name, handle: o.handle } : null };
  },
  async mine(userId) { if (sb) return chk(await sb.from('games').select('*').eq('owner_id', userId).order('created_at', { ascending: false })); return Object.values(M.games).filter(g => g.owner_id === userId).reverse(); },
  async recent() { if (sb) return chk(await sb.from('games').select('*, owner:profiles(name,handle)').order('created_at', { ascending: false }).limit(20)); return Object.values(M.games).reverse().slice(0, 20).map(g => ({ ...g, owner: M.profiles[g.owner_id] })); },
  async remove(id) {
    if (sb) { chk(await sb.from('games').delete().eq('id', id)); return; }
    delete M.games[id];
    for (const [k, p] of Object.entries(M.players)) if (p.game_id === id) delete M.players[k];
    for (const [k, h] of Object.entries(M.highlights)) if (h.game_id === id) delete M.highlights[k];
    await save();
  },
};

export const players = {
  async list(gameId) {
    if (sb) return chk(await sb.from('players').select('*, user:profiles(name,handle)').eq('game_id', gameId).order('created_at'));
    return Object.values(M.players).filter(p => p.game_id === gameId).map(p => ({ ...p, user: p.user_id ? M.profiles[p.user_id] : null }));
  },
  async add(gameId, label) {
    if (sb) return chk(await sb.from('players').insert({ game_id: gameId, label }).select().single());
    const r = { id: uid(), game_id: gameId, label, user_id: null, created_at: now() }; M.players[r.id] = r; await save(); return r;
  },
  async remove(id) {
    if (sb) { chk(await sb.from('players').delete().eq('id', id)); return; }
    delete M.players[id]; Object.values(M.highlights).forEach(h => { if (h.player_id === id) h.player_id = null; }); await save();
  },
  async claim(id) {
    if (sb) return chk(await sb.rpc('claim_player', { p_player: id }));
    const p = M.players[id]; if (!p || p.user_id || !M.session) return false; p.user_id = M.session.id; p.claimed_at = now(); await save(); return true;
  },
  async release(id) {
    if (sb) return chk(await sb.rpc('release_player', { p_player: id }));
    const p = M.players[id]; if (p && M.session && p.user_id === M.session.id) { p.user_id = null; await save(); return true; } return false;
  },
  async mine(userId) {
    if (sb) return chk(await sb.from('players').select('id, label, game:games(id,title,sport,place,played_on)').eq('user_id', userId));
    return Object.values(M.players).filter(p => p.user_id === userId).map(p => ({ ...p, game: M.games[p.game_id] }));
  },
};

export const highlights = {
  async list(gameId) {
    if (sb) return chk(await sb.from('highlights').select('*').eq('game_id', gameId).order('created_at'));
    return Object.values(M.highlights).filter(h => h.game_id === gameId).sort((a, b) => a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0);
  },
  async forPlayers(ids) {
    if (!ids.length) return [];
    if (sb) return chk(await sb.from('highlights').select('*, game:games(id,title)').in('player_id', ids).order('created_at', { ascending: false }));
    return Object.values(M.highlights).filter(h => ids.includes(h.player_id)).map(h => ({ ...h, game: M.games[h.game_id] }));
  },
  async add(h) { if (sb) return chk(await sb.from('highlights').insert(h).select().single()); const r = { id: uid(), created_at: now(), player_id: null, ...h }; M.highlights[r.id] = r; await save(); return r; },
  async update(id, patch) { if (sb) { chk(await sb.from('highlights').update(patch).eq('id', id)); return; } Object.assign(M.highlights[id], patch); await save(); },
  async remove(id) { if (sb) { chk(await sb.from('highlights').delete().eq('id', id)); return; } delete M.highlights[id]; await save(); },
};

export const storage = {
  async upload(path, bytes, type) {
    const blob = new Blob([bytes], { type });
    if (sb) { chk(await sb.storage.from('clips').upload(path, blob, { contentType: type, upsert: false })); return path; }
    if (PERSIST) await local.put('files', { id: path, blob, type });
    FILES[path] = URL.createObjectURL(blob); return path;
  },
  // Make sure every path has a playable URL before a page renders.
  async prep(paths) {
    if (sb || !PERSIST) return;
    for (const p of paths) if (p && !FILES[p]) { const r = await local.get('files', p); if (r && r.blob) FILES[p] = URL.createObjectURL(r.blob); }
  },
  async blob(path) {
    if (sb) { const r = await fetch(storage.url(path)); return r.blob(); }
    if (PERSIST) { const r = await local.get('files', path); return r ? r.blob : null; }
    return FILES[path] ? (await fetch(FILES[path])).blob() : null;
  },
  url(path) { if (!path) return ''; if (sb) return sb.storage.from('clips').getPublicUrl(path).data.publicUrl; return FILES[path] || ''; },
  async remove(paths) {
    if (sb) { await sb.storage.from('clips').remove(paths); return; }
    for (const p of paths) { if (PERSIST) await local.del('files', p); if (FILES[p]) URL.revokeObjectURL(FILES[p]); delete FILES[p]; }
  },
};
export { uid };
