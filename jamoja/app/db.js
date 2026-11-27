// Jamoja data layer.
//  live  : Supabase (when config.js has a URL and key)
//  local : everything saved on this phone in IndexedDB (no database connected yet)
//  mock  : in memory, for automated tests (?mock=1)
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=20261127t';

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
  onChange(fn) { if (sb) sb.auth.onAuthStateChange(ev => fn(ev)); else authListeners.push(fn); },
  async resetEmail(email, back) { if (sb) { chk(await sb.auth.resetPasswordForEmail(email, { redirectTo: back })); return; } },
  async setPassword(password) { if (sb) { chk(await sb.auth.updateUser({ password })); return; } const u = Object.values(M.users).find(x => M.session && x.id === M.session.id); if (u) u.password = password; },
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
    if (sb) return chk(await sb.from('games').select('*, owner:profiles!games_owner_id_fkey(id,name,handle,avatar)').eq('id', id).maybeSingle());
    const g = M.games[id]; if (!g) return null; const o = M.profiles[g.owner_id];
    return { ...g, owner: o ? { id: o.id, name: o.name, handle: o.handle } : null };
  },
  async upcoming() {
    const from = new Date(Date.now() - 4 * 3600e3).toISOString(), to = new Date(Date.now() + 8 * 864e5).toISOString();
    if (sb) return chk(await sb.from('games').select('id,title,sport,place,starts_at,notes,owner_id, owner:profiles!games_owner_id_fkey(id,name,handle,avatar), rsvps(count)').gte('starts_at', from).lte('starts_at', to).order('starts_at').limit(20)).map(g => ({ ...g, going: (g.rsvps && g.rsvps[0] && g.rsvps[0].count) || 0 }));
    return Object.values(M.games).filter(g => g.starts_at && g.starts_at >= from && g.starts_at <= to).sort((a, b) => a.starts_at < b.starts_at ? -1 : 1).map(g => ({ ...g, owner: M.profiles[g.owner_id], going: Object.values(M.rsvps || {}).filter(r => r.game_id === g.id).length }));
  },
  async mine(userId) { if (sb) return chk(await sb.from('games').select('*').eq('owner_id', userId).order('created_at', { ascending: false })); return Object.values(M.games).filter(g => g.owner_id === userId).reverse(); },
  async recent() { if (sb) return chk(await sb.from('games').select('*, owner:profiles!games_owner_id_fkey(name,handle)').order('created_at', { ascending: false }).limit(20)); return Object.values(M.games).reverse().slice(0, 20).map(g => ({ ...g, owner: M.profiles[g.owner_id] })); },
  // Runs with nothing in them (no clips, no live video, nobody joined) whose time has passed.
  async empty(list) {
    const past = list.filter(g => !g.starts_at || new Date(g.starts_at).getTime() < Date.now()).map(g => g.id);
    if (!past.length) return [];
    if (sb) {
      const [h, l, r] = await Promise.all([sb.from('highlights').select('game_id').in('game_id', past), sb.from('live_segments').select('game_id').in('game_id', past), sb.from('rsvps').select('game_id').in('game_id', past)]);
      const used = new Set([...(h.data || []), ...(l.data || []), ...(r.data || [])].map(x => x.game_id));
      return past.filter(id => !used.has(id));
    }
    return past.filter(id => !Object.values(M.highlights).some(x => x.game_id === id));
  },
  async setSpot(id, spot) { if (sb) { chk(await sb.from('games').update(spot).eq('id', id)); return; } Object.assign(M.games[id], spot); await save(); },
  // A court someone already named within about 150 m, so everyone at the same court lands on the same page.
  async near(lat, lng) {
    const d = 0.0015;
    let list;
    if (sb) list = chk(await sb.from('games').select('place,lat,lng').gte('lat', lat - d).lte('lat', lat + d).gte('lng', lng - d).lte('lng', lng + d).neq('place', '').not('place', 'is', null).limit(50));
    else list = Object.values(M.games).filter(g => g.place && g.lat != null && Math.abs(g.lat - lat) < d && Math.abs(g.lng - lng) < d);
    const n = {}; for (const g of list) n[g.place] = (n[g.place] || 0) + 1;
    return Object.entries(n).sort((a, b) => b[1] - a[1]).map(x => x[0])[0] || null;
  },
  async atCourt(place) {
    if (sb) return chk(await sb.from('games').select('id,title,sport,place,starts_at,played_on,lat,lng,owner_id, owner:profiles!games_owner_id_fkey(id,name,handle,avatar)').ilike('place', place).order('starts_at', { ascending: false, nullsFirst: false }).limit(60));
    return Object.values(M.games).filter(g => (g.place || '').toLowerCase() === place.toLowerCase()).map(g => ({ ...g, owner: M.profiles[g.owner_id] })).reverse();
  },
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
  async forGames(ids) {
    if (!ids.length) return [];
    if (sb) return chk(await sb.from('highlights').select('*, game:games(id,title)').in('game_id', ids).eq('hidden', false).order('created_at', { ascending: false }).limit(60)).filter(h => h.play_type !== 'Warmup');
    return Object.values(M.highlights).filter(h => ids.includes(h.game_id) && !h.hidden).map(h => ({ ...h, game: M.games[h.game_id] }));
  },
  async forPlayers(ids) {
    if (!ids.length) return [];
    if (sb) return chk(await sb.from('highlights').select('*, game:games(id,title)').in('player_id', ids).eq('hidden', false).order('created_at', { ascending: false })).filter(h => h.play_type !== 'Warmup');
    return Object.values(M.highlights).filter(h => ids.includes(h.player_id)).map(h => ({ ...h, game: M.games[h.game_id] }));
  },
  // The public feed: newest highlights from every game, optionally one sport.
  async feed(sport, limit = 30, ids = null) {
    if (ids && !ids.length) return [];
    if (sb) {
      let pids = null;
      if (ids) pids = chk(await sb.from('players').select('id').in('user_id', ids)).map(r => r.id);
      let q = sb.from('highlights').select('id,label,play_type,views,path,poster,dur_s,created_at,game_id,player_id, game:games!inner(id,title,sport,place,played_on, owner:profiles!games_owner_id_fkey(id,name,handle,avatar,level)), player:players(label, user:profiles(id,name,handle,avatar,level)), fires(count)').eq('hidden', false).order('created_at', { ascending: false }).limit(limit);
      if (sport) q = q.eq('game.sport', sport);
      if (ids) q = q.or(`created_by.in.(${ids.join(',')})` + (pids.length ? `,player_id.in.(${pids.join(',')})` : ''));
      return chk(await q).filter(h => h.play_type !== 'Warmup').map(h => ({ ...h, fire: (h.fires && h.fires[0] && h.fires[0].count) || 0 }));
    }
    return Object.values(M.highlights).map(h => {
      const g = M.games[h.game_id] || {}; const o = M.profiles[g.owner_id]; const p = M.players[h.player_id];
      return { ...h, game: { ...g, owner: o ? { name: o.name, handle: o.handle } : null }, player: p ? { label: p.label, user: p.user_id ? M.profiles[p.user_id] : null } : null, fire: Object.values(M.fires || {}).filter(f => f.highlight_id === h.id).length };
    }).filter(h => !h.hidden && (!sport || h.game.sport === sport) && (!ids || ids.includes(h.created_by) || (h.player_id && M.players[h.player_id] && ids.includes(M.players[h.player_id].user_id)))).sort((a, b) => a.created_at < b.created_at ? 1 : -1).slice(0, limit);
  },
  async atCourt(place, limit = 40) {
    if (sb) return chk(await sb.from('highlights').select('id,label,play_type,views,path,poster,dur_s,created_at,game_id,player_id, game:games!inner(id,title,sport,place,played_on, owner:profiles!games_owner_id_fkey(id,name,handle,avatar,level)), player:players(label, user:profiles(id,name,handle,avatar,level)), fires(count)').eq('hidden', false).ilike('game.place', place).order('created_at', { ascending: false }).limit(limit)).filter(h => h.play_type !== 'Warmup').map(h => ({ ...h, fire: (h.fires && h.fires[0] && h.fires[0].count) || 0 }));
    return (await this.feed(null, 200)).filter(h => (h.game.place || '').toLowerCase() === place.toLowerCase()).slice(0, limit);
  },
  async add(h) { if (sb) return chk(await sb.from('highlights').insert(h).select().single()); const r = { id: uid(), created_at: now(), player_id: null, ...h }; M.highlights[r.id] = r; await save(); return r; },
  async view(id) { if (sb) { await sb.rpc('add_view', { p_highlight: id }); return; } if (M.highlights[id]) { M.highlights[id].views = (M.highlights[id].views || 0) + 1; await save(); } },
  async report(id, reason) {
    if (sb) { const r = await sb.from('reports').insert({ highlight_id: id, reason }); if (r.error && !/duplicate/i.test(r.error.message)) throw new Error(r.error.message); return; }
    M.reports = M.reports || {}; M.reports[id + ':' + (M.session && M.session.id)] = { id, reason };
    if (Object.keys(M.reports).filter(k => k.startsWith(id + ':')).length >= 2 && M.highlights[id]) M.highlights[id].hidden = true; await save();
  },
  // "That's me" / "Not me": any signed-in player can claim an untagged play or drop one tagged to them.
  async claimMine(id) {
    if (sb) { const r = await sb.rpc('claim_play', { p_hl: id }); if (r.error) throw new Error(r.error.message); return r.data; }
    const h = M.highlights[id], g = h.game_id, me = M.session.id;
    let p = Object.values(M.players).find(x => x.game_id === g && x.user_id === me);
    if (!p) { p = { id: uid(), game_id: g, label: (M.profiles[me] || {}).name || 'Me', user_id: me, claimed_at: now(), created_at: now() }; M.players[p.id] = p; }
    h.player_id = p.id; await save(); return p.id;
  },
  async unclaimMine(id) {
    if (sb) { const r = await sb.rpc('unclaim_play', { p_hl: id }); if (r.error) throw new Error(r.error.message); return; }
    const h = M.highlights[id]; const p = M.players[h.player_id]; if (p && p.user_id === M.session.id) { h.player_id = null; await save(); }
  },
  async update(id, patch) { if (sb) { chk(await sb.from('highlights').update(patch).eq('id', id)); return; } Object.assign(M.highlights[id], patch); await save(); },
  async remove(id) { if (sb) { chk(await sb.from('highlights').delete().eq('id', id)); return; } delete M.highlights[id]; await save(); },
};

const PROF = 'id,name,handle,avatar,level,sport';
export const posts = {
  async create(p) { if (sb) return chk(await sb.from('posts').insert(p).select().single()); const r = { id: uid(), created_at: now(), hidden: false, user_id: M.session.id, ...p }; M.posts = M.posts || {}; M.posts[r.id] = r; await save(); return r; },
  async feed(sport, limit = 30, ids = null) {
    if (ids && !ids.length) return [];
    if (sb) {
      let q = sb.from('posts').select(`*, user:profiles(${PROF}), post_fires(count)`).eq('hidden', false).order('created_at', { ascending: false }).limit(limit);
      if (sport) q = q.eq('sport', sport);
      if (ids) q = q.in('user_id', ids);
      return chk(await q).map(x => ({ ...x, fire: (x.post_fires && x.post_fires[0] && x.post_fires[0].count) || 0 }));
    }
    return Object.values(M.posts || {}).filter(x => !x.hidden && (!sport || x.sport === sport) && (!ids || ids.includes(x.user_id)))
      .map(x => ({ ...x, user: M.profiles[x.user_id], fire: Object.values(M.pfires || {}).filter(f => f.post_id === x.id).length })).sort((a, b) => a.created_at < b.created_at ? 1 : -1).slice(0, limit);
  },
  async get(id) { if (sb) { const r = chk(await sb.from('posts').select(`*, user:profiles(${PROF}), post_fires(count)`).eq('id', id).maybeSingle()); return r && { ...r, fire: (r.post_fires && r.post_fires[0] && r.post_fires[0].count) || 0 }; } const x = (M.posts || {})[id]; return x ? { ...x, user: M.profiles[x.user_id], fire: 0 } : null; },
  async byUser(userId) { return posts.feed('', 50, [userId]); },
  async remove(id) { if (sb) { chk(await sb.from('posts').delete().eq('id', id)); return; } delete M.posts[id]; await save(); },
  async setCover(id, poster) { if (sb) { chk(await sb.from('posts').update({ poster }).eq('id', id)); return; } M.posts[id].poster = poster; await save(); },
  async report(id, reason) {
    if (sb) { const r = await sb.from('reports').insert({ post_id: id, reason }); if (r.error && !/duplicate/i.test(r.error.message)) throw new Error(r.error.message); return; }
    M.preports = M.preports || {}; M.preports[id + ':' + M.session.id] = reason; if (Object.keys(M.preports).filter(k => k.startsWith(id + ':')).length >= 2) M.posts[id].hidden = true; await save();
  },
};
export const postFires = {
  async mine(userId, ids) {
    if (!userId || !ids.length) return new Set();
    if (sb) return new Set(chk(await sb.from('post_fires').select('post_id').eq('user_id', userId).in('post_id', ids)).map(r => r.post_id));
    return new Set(Object.values(M.pfires || {}).filter(f => f.user_id === userId).map(f => f.post_id));
  },
  async toggle(pid, userId, on) {
    if (sb) { if (on) chk(await sb.from('post_fires').insert({ post_id: pid })); else chk(await sb.from('post_fires').delete().eq('post_id', pid).eq('user_id', userId)); return; }
    M.pfires = M.pfires || {}; const k = pid + ':' + userId; if (on) M.pfires[k] = { post_id: pid, user_id: userId }; else delete M.pfires[k]; await save();
  },
};
export const follows = {
  async ids(userId) { if (!userId) return []; if (sb) return chk(await sb.from('follows').select('followee_id').eq('follower_id', userId)).map(r => r.followee_id); return Object.values(M.follows || {}).filter(f => f.follower_id === userId).map(f => f.followee_id); },
  async counts(userId) {
    if (sb) { const [a, b] = await Promise.all([sb.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', userId), sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId)]); return { followers: a.count || 0, following: b.count || 0 }; }
    const all = Object.values(M.follows || {}); return { followers: all.filter(f => f.followee_id === userId).length, following: all.filter(f => f.follower_id === userId).length };
  },
  async toggle(me, them, on) {
    if (sb) { if (on) { const r = await sb.from('follows').insert({ followee_id: them }); if (r.error && !/duplicate/i.test(r.error.message)) throw new Error(r.error.message); } else chk(await sb.from('follows').delete().eq('follower_id', me).eq('followee_id', them)); return; }
    M.follows = M.follows || {}; const k = me + ':' + them; if (on) M.follows[k] = { follower_id: me, followee_id: them }; else delete M.follows[k]; await save();
  },
  async list(userId, dir) {
    const [mine, other] = dir === 'followers' ? ['followee_id', 'follower_id'] : ['follower_id', 'followee_id'];
    if (sb) { const ids = chk(await sb.from('follows').select(other).eq(mine, userId).order('created_at', { ascending: false })).map(r => r[other]); if (!ids.length) return []; const ps = chk(await sb.from('profiles').select(PROF + ',city,position').in('id', ids)); return ids.map(i => ps.find(p => p.id === i)).filter(Boolean); }
    return Object.values(M.follows || {}).filter(f => f[mine] === userId).map(f => M.profiles[f[other]]).filter(Boolean);
  },
  async people(q = '', sport = '', limit = 60) {
    if (sb) {
      let r = sb.from('profiles').select(PROF + ',city,position,created_at').order('created_at', { ascending: false }).limit(limit);
      if (sport) r = r.eq('sport', sport);
      const t = q.replace(/[%,()*]/g, '').trim(); if (t) r = r.or(`name.ilike.%${t}%,handle.ilike.%${t}%,city.ilike.%${t}%`);
      return chk(await r);
    }
    const t = q.toLowerCase();
    return Object.values(M.profiles).filter(p => (!sport || p.sport === sport) && (!t || [p.name, p.handle, p.city].some(x => (x || '').toLowerCase().includes(t))));
  },
  async suggested(me, limit = 8) {
    if (sb) { const r = chk(await sb.from('profiles').select(PROF).neq('id', me || '00000000-0000-0000-0000-000000000000').order('created_at', { ascending: false }).limit(limit + 20)); return r; }
    return Object.values(M.profiles).filter(p => p.id !== me);
  },
};
export const comments = {
  async counts(kind, ids) {
    const m = {}; if (!ids.length) return m; const col = kind === 'post' ? 'post_id' : 'highlight_id';
    const rows = sb ? chk(await sb.from('comments').select(col).in(col, ids)) : Object.values(M.comments || {}).filter(c => ids.includes(c[col]));
    for (const r of rows) m[r[col]] = (m[r[col]] || 0) + 1; return m;
  },
  async list(kind, id) {
    const col = kind === 'post' ? 'post_id' : 'highlight_id';
    if (sb) return chk(await sb.from('comments').select(`id,body,created_at,user_id, user:profiles(${PROF})`).eq(col, id).order('created_at').limit(100));
    return Object.values(M.comments || {}).filter(c => c[col] === id).sort((a, b) => a.created_at < b.created_at ? -1 : 1).map(c => ({ ...c, user: M.profiles[c.user_id] }));
  },
  async add(kind, id, body) {
    const row = { [kind === 'post' ? 'post_id' : 'highlight_id']: id, body };
    if (sb) return chk(await sb.from('comments').insert(row).select().single());
    M.comments = M.comments || {}; const r = { id: uid(), user_id: M.session.id, created_at: now(), post_id: null, highlight_id: null, ...row }; M.comments[r.id] = r; await save(); return r;
  },
  async remove(id) { if (sb) { chk(await sb.from('comments').delete().eq('id', id)); return; } delete M.comments[id]; await save(); },
};

export const profileViews = {
  async record(profileId) { if (sb) { await sb.rpc('record_profile_view', { p_profile: profileId }); return; } M.pviews = M.pviews || []; const v = M.session && M.session.id; if (v === profileId) return; M.pviews.push({ profile_id: profileId, viewer_id: v || null, viewed_at: now() }); await save(); },
  async list(me, days = 30) {
    const since = new Date(Date.now() - days * 864e5).toISOString();
    if (sb) return chk(await sb.from('profile_views').select(`viewer_id, viewed_at, viewer:profiles!profile_views_viewer_id_fkey(${PROF},city)`).eq('profile_id', me).gte('viewed_at', since).order('viewed_at', { ascending: false }).limit(300));
    return (M.pviews || []).filter(v => v.profile_id === me && v.viewed_at >= since).map(v => ({ ...v, viewer: v.viewer_id ? M.profiles[v.viewer_id] : null })).reverse();
  },
};

export const pushSubs = {
  async publicKey() { const r = await fetch(SUPABASE_URL + '/functions/v1/push'); if (!r.ok) throw new Error('Notifications are not available right now.'); return (await r.json()).publicKey; },
  async save(sub) {
    const j = sub.toJSON(); const row = { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || null };
    if (!sb) return; const r = await sb.from('push_subs').insert(row); if (r.error && !/duplicate/i.test(r.error.message)) throw new Error(r.error.message);
  },
  async remove(endpoint) { if (sb) await sb.from('push_subs').delete().eq('endpoint', endpoint); },
};

export const dms = {
  async inbox() {
    let rows;
    if (sb) rows = chk(await sb.rpc('dm_inbox'));
    else { const me = M.session.id, all = Object.values(M.msgs || {}).filter(m => [m.sender_id, m.recipient_id].includes(me)).sort((a, b) => a.created_at < b.created_at ? 1 : -1); const seen = {}; rows = [];
      for (const m of all) { const o = m.sender_id === me ? m.recipient_id : m.sender_id; if (seen[o]) continue; seen[o] = 1; rows.push({ other_id: o, last_body: m.body, last_at: m.created_at, last_from_me: m.sender_id === me, unread: all.filter(x => x.recipient_id === me && x.sender_id === o && !x.read_at).length }); } }
    if (!rows.length) return [];
    const ids = rows.map(r => r.other_id);
    const ps = sb ? chk(await sb.from('profiles').select(PROF).in('id', ids)) : ids.map(i => M.profiles[i]).filter(Boolean);
    return rows.map(r => ({ ...r, other: ps.find(p => p.id === r.other_id) })).filter(r => r.other);
  },
  async thread(me, other) {
    if (sb) return chk(await sb.from('messages').select('id,sender_id,recipient_id,body,created_at,read_at').or(`and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`).order('created_at', { ascending: false }).limit(200)).reverse();
    return Object.values(M.msgs || {}).filter(m => (m.sender_id === me && m.recipient_id === other) || (m.sender_id === other && m.recipient_id === me)).sort((a, b) => a.created_at < b.created_at ? -1 : 1);
  },
  async send(to, body) {
    if (sb) return chk(await sb.from('messages').insert({ recipient_id: to, body }).select().single());
    if ((M.blocks || {})[to + ':' + M.session.id]) throw new Error("You can't message this person.");
    M.msgs = M.msgs || {}; const r = { id: uid(), sender_id: M.session.id, recipient_id: to, body, created_at: now(), read_at: null }; M.msgs[r.id] = r; await save(); return r;
  },
  async markRead(me, other) { if (sb) { await sb.from('messages').update({ read_at: new Date().toISOString() }).eq('recipient_id', me).eq('sender_id', other).is('read_at', null); return; } Object.values(M.msgs || {}).forEach(m => { if (m.recipient_id === me && m.sender_id === other && !m.read_at) m.read_at = now(); }); await save(); },
  async unread(me) { if (!me) return 0; if (sb) { const r = await sb.from('messages').select('*', { count: 'exact', head: true }).eq('recipient_id', me).is('read_at', null); return r.count || 0; } return Object.values(M.msgs || {}).filter(m => m.recipient_id === me && !m.read_at).length; },
};
export const blocks = {
  async has(me, other) { if (sb) return chk(await sb.from('blocks').select('blocked_id').eq('blocker_id', me).eq('blocked_id', other)).length > 0; return !!(M.blocks || {})[me + ':' + other]; },
  async set(me, other, on) {
    if (sb) { if (on) { const r = await sb.from('blocks').insert({ blocked_id: other }); if (r.error && !/duplicate/i.test(r.error.message)) throw new Error(r.error.message); } else chk(await sb.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', other)); return; }
    M.blocks = M.blocks || {}; if (on) M.blocks[me + ':' + other] = 1; else delete M.blocks[me + ':' + other]; await save();
  },
};

export const rsvps = {
  async list(gameId) {
    if (sb) { const ids = chk(await sb.from('rsvps').select('user_id').eq('game_id', gameId).order('created_at')).map(r => r.user_id); if (!ids.length) return []; const ps = chk(await sb.from('profiles').select(PROF).in('id', ids)); return ids.map(i => ps.find(p => p.id === i)).filter(Boolean); }
    return Object.values(M.rsvps || {}).filter(r => r.game_id === gameId).map(r => M.profiles[r.user_id]).filter(Boolean);
  },
  async set(gameId, me, on) {
    if (sb) { if (on) { const r = await sb.from('rsvps').insert({ game_id: gameId }); if (r.error && !/duplicate/i.test(r.error.message)) throw new Error(r.error.message); } else chk(await sb.from('rsvps').delete().eq('game_id', gameId).eq('user_id', me)); return; }
    M.rsvps = M.rsvps || {}; const k = gameId + ':' + me; if (on) M.rsvps[k] = { game_id: gameId, user_id: me }; else delete M.rsvps[k]; await save();
  },
};
export const live = {
  async add(row) { if (sb) { chk(await sb.from('live_segments').insert(row)); return; } M.live = M.live || []; M.live.push({ id: uid(), user_id: M.session.id, created_at: now(), ...row }); await save(); },
  async segments(gameId, session, afterSeq = -1) {
    if (sb) return chk(await sb.from('live_segments').select('seq,path,type,dur,marks,ended,created_at').eq('game_id', gameId).eq('session', session).gt('seq', afterSeq).order('seq').limit(200));
    return (M.live || []).filter(r => r.game_id === gameId && r.session === session && r.seq > afterSeq).sort((a, b) => a.seq - b.seq);
  },
  async now() {
    const since = new Date(Date.now() - 30000).toISOString();
    const rows = sb ? chk(await sb.from('live_segments').select(`game_id,session,user_id,ended,created_at, user:profiles(${PROF}), game:games(id,title,place)`).gte('created_at', since).order('created_at', { ascending: false }).limit(50))
      : (M.live || []).filter(r => r.created_at >= since).map(r => ({ ...r, user: M.profiles[r.user_id], game: M.games[r.game_id] }));
    const by = {}; for (const r of rows) { if (r.ended) { by[r.session] = null; continue; } if (!(r.session in by)) by[r.session] = r; }
    return Object.values(by).filter(Boolean);
  },
  async sessions(gameId) {
    const rows = sb ? chk(await sb.from('live_segments').select(`session,user_id,seq,ended,created_at, user:profiles(${PROF})`).eq('game_id', gameId).order('created_at', { ascending: false }).limit(500))
      : (M.live || []).filter(r => r.game_id === gameId).map(r => ({ ...r, user: M.profiles[r.user_id] })).reverse();
    const by = {};
    for (const r of rows) { const x = by[r.session] || (by[r.session] = { session: r.session, user: r.user, last: r.created_at, first: r.created_at, count: 0, ended: false }); x.count++; if (r.ended) x.ended = true; if (r.created_at > x.last) x.last = r.created_at; if (r.created_at < x.first) x.first = r.created_at; }
    return Object.values(by).map(x => ({ ...x, isLive: !x.ended && Date.now() - new Date(x.last) < 30000 })).sort((a, b) => (b.isLive - a.isLive) || (a.last < b.last ? 1 : -1));
  },
};

export const notes = {
  async unread(me) { if (!me) return 0; if (sb) { const r = await sb.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', me).is('read_at', null); return r.count || 0; } return (M.notes || []).filter(n => n.user_id === me && !n.read_at).length; },
  async list(me, limit = 60) {
    if (sb) return chk(await sb.from('notifications').select(`id,type,created_at,read_at,post_id,highlight_id,game_id, actor:profiles!notifications_actor_id_fkey(${PROF}), game:games(title), highlight:highlights(play_type,label)`).eq('user_id', me).order('created_at', { ascending: false }).limit(limit));
    return (M.notes || []).filter(n => n.user_id === me).map(n => ({ ...n, actor: M.profiles[n.actor_id] })).reverse();
  },
  async readAll(me) { if (sb) { await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', me).is('read_at', null); return; } (M.notes || []).forEach(n => { if (n.user_id === me) n.read_at = now(); }); await save(); },
  async week(me) {
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const rows = sb ? chk(await sb.from('notifications').select('type').eq('user_id', me).gte('created_at', since).limit(1000)) : (M.notes || []).filter(n => n.user_id === me && n.created_at >= since);
    const c = {}; for (const r of rows) c[r.type] = (c[r.type] || 0) + 1; return c;
  },
};

export const fires = {
  async mine(userId, ids) {
    if (!userId || !ids.length) return new Set();
    if (sb) return new Set(chk(await sb.from('fires').select('highlight_id').eq('user_id', userId).in('highlight_id', ids)).map(r => r.highlight_id));
    return new Set(Object.values(M.fires || {}).filter(f => f.user_id === userId).map(f => f.highlight_id));
  },
  async toggle(hid, userId, on) {
    if (sb) { if (on) chk(await sb.from('fires').insert({ highlight_id: hid })); else chk(await sb.from('fires').delete().eq('highlight_id', hid).eq('user_id', userId)); return; }
    M.fires = M.fires || {}; const k = hid + ':' + userId; if (on) M.fires[k] = { highlight_id: hid, user_id: userId }; else delete M.fires[k]; await save();
  },
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
  url(path) { if (!path) return ''; if (/^(https?:)?\/\//.test(path) || path.startsWith('/')) return path; if (sb) return sb.storage.from('clips').getPublicUrl(path).data.publicUrl; return FILES[path] || ''; },
  async remove(paths) {
    if (sb) { await sb.storage.from('clips').remove(paths); return; }
    for (const p of paths) { if (PERSIST) await local.del('files', p); if (FILES[p]) URL.revokeObjectURL(FILES[p]); delete FILES[p]; }
  },
};
export { uid };

// "I got next": the line to get on the court.
export const nextUp = {
  async list(gameId) {
    if (sb) { const rows = chk(await sb.from('next_up').select('user_id,created_at').eq('game_id', gameId).order('created_at')); if (!rows.length) return []; const ps = chk(await sb.from('profiles').select(PROF).in('id', rows.map(r => r.user_id))); return rows.map(r => ps.find(p => p.id === r.user_id)).filter(Boolean); }
    return Object.values(M.next || {}).filter(r => r.game_id === gameId).sort((a, b) => a.created_at < b.created_at ? -1 : 1).map(r => M.profiles[r.user_id]).filter(Boolean);
  },
  async join(gameId) { if (sb) { const r = await sb.from('next_up').insert({ game_id: gameId }); if (r.error && !/duplicate/i.test(r.error.message)) throw new Error(r.error.message); return; } M.next = M.next || {}; M.next[gameId + ':' + M.session.id] = { game_id: gameId, user_id: M.session.id, created_at: now() }; await save(); },
  async leave(gameId, userId) { if (sb) { chk(await sb.from('next_up').delete().eq('game_id', gameId).eq('user_id', userId)); return; } delete (M.next || {})[gameId + ':' + userId]; await save(); },
};

// Analytics: a light event log. Fire and forget, never blocks the app.
const DEV = (() => { try { let d = localStorage.getItem('jm.dev'); if (!d) { d = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('jm.dev', d); } return d; } catch (e) { return 'nodev'; } })();
export const events = {
  log(name, props) {
    try {
      if (!sb) { (M.events = M.events || []).push({ name, props, created_at: now() }); return; }
      sb.from('events').insert({ name, props: props || null, device: DEV }) /* user_id fills in from the login */.then(() => {}, () => {});
    } catch (e) { /* never break the app for analytics */ }
  },
  async isAdmin(uidv) { if (!sb || !uidv) return false; const r = await sb.from('admins').select('user_id').eq('user_id', uidv).maybeSingle(); return !!(r.data); },
  async stats(days) { if (!sb) return null; const r = await sb.rpc('admin_stats', { p_days: days }); if (r.error) throw new Error(r.error.message); return r.data; },
};

// Stories: 24-hour posts with stickers drawn on top.
export const stories = {
  async live() {
    const nowIso = now();
    if (sb) return chk(await sb.from('stories').select('id,user_id,kind,path,overlay,created_at, user:profiles(id,name,handle,avatar)').gt('expires_at', nowIso).order('created_at'));
    return Object.values(M.stories || {}).filter(x => x.expires_at > nowIso).sort((a, b) => a.created_at < b.created_at ? -1 : 1).map(x => ({ ...x, user: M.profiles[x.user_id] }));
  },
  async add(st) {
    if (sb) return chk(await sb.from('stories').insert(st).select().single());
    M.stories = M.stories || {}; const r = { id: uid(), user_id: M.session.id, created_at: now(), expires_at: new Date(Date.now() + 864e5).toISOString(), ...st }; M.stories[r.id] = r; await save(); return r;
  },
  async remove(id) { if (sb) { chk(await sb.from('stories').delete().eq('id', id)); return; } delete (M.stories || {})[id]; await save(); },
  async view(id) { if (sb) { await sb.from('story_views').insert({ story_id: id }).then(() => {}, () => {}); } },
  async viewers(id) {
    if (!sb) return [];
    const rows = chk(await sb.from('story_views').select('viewer_id').eq('story_id', id)); if (!rows.length) return [];
    return chk(await sb.from('profiles').select(PROF).in('id', rows.map(r => r.viewer_id)));
  },
};
