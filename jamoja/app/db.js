// Jamoja data layer. Uses Supabase in production; ?mock=1 uses an in-memory copy for testing.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const MOCK = new URLSearchParams(location.search).has('mock');
const ready = !!(SUPABASE_URL && SUPABASE_KEY);
const sb = !MOCK && ready ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
export const mode = MOCK ? 'mock' : ready ? 'live' : 'unconfigured';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(16).slice(2));
const now = () => new Date().toISOString();
const ok = (data) => data;
function chk({ data, error }) { if (error) throw new Error(error.message || 'Something went wrong'); return data; }

// ---------- in-memory mock (testing only)
const M = { users: {}, session: null, profiles: {}, games: {}, players: {}, highlights: {}, files: {} };
let authListeners = [];
const mockEmit = () => authListeners.forEach(f => f());

export const auth = {
  async user() {
    if (sb) { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; }
    return M.session;
  },
  onChange(fn) {
    if (sb) sb.auth.onAuthStateChange(() => fn()); else authListeners.push(fn);
  },
  async signUp(email, password) {
    if (sb) {
      const d = chk(await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } }));
      return { needsConfirm: !d.session };
    }
    if (M.users[email]) throw new Error('That email already has an account. Sign in instead.');
    M.users[email] = { id: uid(), email, password }; M.session = M.users[email]; mockEmit();
    return { needsConfirm: false };
  },
  async signIn(email, password) {
    if (sb) { chk(await sb.auth.signInWithPassword({ email, password })); return; }
    const u = M.users[email];
    if (!u || u.password !== password) throw new Error('Email or password is wrong.');
    M.session = u; mockEmit();
  },
  async signOut() { if (sb) await sb.auth.signOut(); else { M.session = null; mockEmit(); } },
};

export const profiles = {
  async byId(id) {
    if (sb) return chk(await sb.from('profiles').select('*').eq('id', id).maybeSingle());
    return M.profiles[id] || null;
  },
  async byHandle(h) {
    if (sb) return chk(await sb.from('profiles').select('*').eq('handle', h).maybeSingle());
    return Object.values(M.profiles).find(p => p.handle === h) || null;
  },
  async save(p) {
    if (sb) return chk(await sb.from('profiles').upsert(p).select().single());
    if (Object.values(M.profiles).some(x => x.handle === p.handle && x.id !== p.id)) throw new Error('That handle is taken. Try another.');
    M.profiles[p.id] = { ...(M.profiles[p.id] || { created_at: now() }), ...p }; return M.profiles[p.id];
  },
};

export const games = {
  async create(g) {
    if (sb) return chk(await sb.from('games').insert(g).select().single());
    const r = { id: uid(), created_at: now(), ...g }; M.games[r.id] = r; return r;
  },
  async get(id) {
    if (sb) return chk(await sb.from('games').select('*, owner:profiles(id,name,handle)').eq('id', id).maybeSingle());
    const g = M.games[id]; if (!g) return null;
    const o = M.profiles[g.owner_id]; return { ...g, owner: o ? { id: o.id, name: o.name, handle: o.handle } : null };
  },
  async mine(userId) {
    if (sb) return chk(await sb.from('games').select('*').eq('owner_id', userId).order('created_at', { ascending: false }));
    return Object.values(M.games).filter(g => g.owner_id === userId).reverse();
  },
  async recent() {
    if (sb) return chk(await sb.from('games').select('*, owner:profiles(name,handle)').order('created_at', { ascending: false }).limit(20));
    return Object.values(M.games).reverse().slice(0, 20).map(g => ({ ...g, owner: M.profiles[g.owner_id] }));
  },
  async remove(id) {
    if (sb) { chk(await sb.from('games').delete().eq('id', id)); return; }
    delete M.games[id];
  },
};

export const players = {
  async list(gameId) {
    if (sb) return chk(await sb.from('players').select('*, user:profiles(name,handle)').eq('game_id', gameId).order('created_at'));
    return Object.values(M.players).filter(p => p.game_id === gameId).map(p => ({ ...p, user: p.user_id ? M.profiles[p.user_id] : null }));
  },
  async add(gameId, label) {
    if (sb) return chk(await sb.from('players').insert({ game_id: gameId, label }).select().single());
    const r = { id: uid(), game_id: gameId, label, user_id: null, created_at: now() }; M.players[r.id] = r; return r;
  },
  async remove(id) {
    if (sb) { chk(await sb.from('players').delete().eq('id', id)); return; }
    delete M.players[id]; Object.values(M.highlights).forEach(h => { if (h.player_id === id) h.player_id = null; });
  },
  async claim(id) {
    if (sb) return chk(await sb.rpc('claim_player', { p_player: id }));
    const p = M.players[id]; if (!p || p.user_id || !M.session) return false;
    p.user_id = M.session.id; p.claimed_at = now(); return true;
  },
  async release(id) {
    if (sb) return chk(await sb.rpc('release_player', { p_player: id }));
    const p = M.players[id]; if (p && M.session && p.user_id === M.session.id) { p.user_id = null; return true; } return false;
  },
  async mine(userId) {
    if (sb) return chk(await sb.from('players').select('id, label, game:games(id,title,sport,place,played_on)').eq('user_id', userId));
    return Object.values(M.players).filter(p => p.user_id === userId).map(p => ({ ...p, game: M.games[p.game_id] }));
  },
};

export const highlights = {
  async list(gameId) {
    if (sb) return chk(await sb.from('highlights').select('*').eq('game_id', gameId).order('start_s'));
    return Object.values(M.highlights).filter(h => h.game_id === gameId).sort((a, b) => a.created_at < b.created_at ? -1 : 1);
  },
  async forPlayers(ids) {
    if (!ids.length) return [];
    if (sb) return chk(await sb.from('highlights').select('*, game:games(id,title)').in('player_id', ids).order('created_at', { ascending: false }));
    return Object.values(M.highlights).filter(h => ids.includes(h.player_id)).map(h => ({ ...h, game: M.games[h.game_id] }));
  },
  async add(h) {
    if (sb) return chk(await sb.from('highlights').insert(h).select().single());
    const r = { id: uid(), created_at: now(), player_id: null, ...h }; M.highlights[r.id] = r; return r;
  },
  async update(id, patch) {
    if (sb) { chk(await sb.from('highlights').update(patch).eq('id', id)); return; }
    Object.assign(M.highlights[id], patch);
  },
  async remove(id) {
    if (sb) { chk(await sb.from('highlights').delete().eq('id', id)); return; }
    delete M.highlights[id];
  },
};

export const storage = {
  async upload(path, bytes, type) {
    if (sb) { chk(await sb.storage.from('clips').upload(path, new Blob([bytes], { type }), { contentType: type, upsert: false })); return path; }
    M.files[path] = URL.createObjectURL(new Blob([bytes], { type })); return path;
  },
  url(path) {
    if (!path) return '';
    if (sb) return sb.storage.from('clips').getPublicUrl(path).data.publicUrl;
    return M.files[path] || '';
  },
  async remove(paths) {
    if (sb) { await sb.storage.from('clips').remove(paths); return; }
    paths.forEach(p => delete M.files[p]);
  },
};
export { uid, ok };
