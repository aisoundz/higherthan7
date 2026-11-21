import * as E from './engine.js';
import { auth, profiles, games, players, highlights, storage, mode } from './db.js';

const V = document.getElementById('view'), TR = document.getElementById('tr');
let ME = null, MYP = null;
const SPORTS = ['Basketball', 'Soccer', 'Flag football', 'Volleyball', 'Football', 'Baseball', 'Softball', 'Track', 'Tennis', 'Other'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mmss = t => { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const today = () => new Date().toISOString().slice(0, 10);
const ini = n => (n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const shareBase = () => location.origin + location.pathname + location.search.replace(/[?&]mock=1/, '').replace(/^&/, '?');
let toastT;
function toast(m) { let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); } t.textContent = m; clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 3200); }
const go = h => { if (location.hash === h) route(); else location.hash = h; };
const qs = () => new URLSearchParams((location.hash.split('?')[1]) || '');

async function refreshMe() { ME = await auth.user(); MYP = ME ? await profiles.byId(ME.id) : null; }
function topbar() {
  TR.innerHTML = ME && MYP
    ? `<a class="btn s" href="#/new">+ New game</a><a href="#/u/${esc(MYP.handle)}" class="av" style="width:38px;height:38px;font-size:17px;text-decoration:none" aria-label="My profile">${esc(ini(MYP.name))}</a>`
    : `<a class="btn s g" href="#/login">Sign in</a>`;
}
function needLogin(next) { go('#/login?next=' + encodeURIComponent(next || location.hash)); }

async function route() {
  window.scrollTo(0, 0);
  const [path] = location.hash.slice(1).split('?');
  const parts = (path || '/').split('/').filter(Boolean);
  try {
    await refreshMe();
    if (ME && !MYP && parts[0] !== 'setup' && parts[0] !== 'login') return go('#/setup?next=' + encodeURIComponent(location.hash || '#/'));
    topbar();
    if (!parts.length) return await home();
    if (parts[0] === 'login') return login();
    if (parts[0] === 'setup') return setup();
    if (parts[0] === 'new') return await newGame();
    if (parts[0] === 'g' && parts[1]) return await gamePage(parts[1]);
    if (parts[0] === 'u' && parts[1]) return await profilePage(decodeURIComponent(parts[1]));
    V.innerHTML = `<h1>Not found</h1><a class="btn" href="#/">Go home</a>`;
  } catch (e) {
    console.error(e);
    V.innerHTML = `<h1>Something went wrong</h1><div class="err">${esc(e.message)}</div><a class="btn g" href="#/">Go home</a>`;
  }
}
window.addEventListener('hashchange', route);
auth.onChange(() => { refreshMe().then(topbar); });

// ---------------- Home
async function home() {
  if (mode === 'unconfigured') {
    V.innerHTML = `<h1>Almost ready</h1><p>The Jamoja app is built. It is waiting for its database to be connected.</p><p class="mu">Open the <a href="../">prototype</a> to try the full experience in the meantime.</p>`;
    return;
  }
  if (!ME) {
    const rec = await games.recent().catch(() => []);
    V.innerHTML = `<section class="hero"><h1>Your game. Your tape. Get seen.</h1><p>Film your run. Jamoja finds the big plays, cuts the highlights and gives every player their own tape.</p>
      <ol class="steps"><li><span><b>Upload your game clips</b><br><span class="mu">Straight from your phone.</span></span></li><li><span><b>Get highlights automatically</b><br><span class="mu">The loudest crowd moments become clips.</span></span></li><li><span><b>Tag your crew and send one link</b><br><span class="mu">Friends claim their plays with a free account.</span></span></li></ol>
      <div class="row"><a class="btn" href="#/login?mode=up">Create free account</a><a class="btn g" href="#/login">Sign in</a></div></section>
      ${rec.length ? `<h2>Recent games</h2><div class="list">${rec.map(g => `<a href="#/g/${g.id}"><span><b>${esc(g.title)}</b><br><span class="mu">${esc(g.sport)} · ${esc(g.place || '')}</span></span><span class="mu">${esc(g.played_on || '')}</span></a>`).join('')}</div>` : ''}
      <p class="foot">Jamoja beta. 18 and older during testing.</p>`;
    return;
  }
  const [mine, tagged] = await Promise.all([games.mine(ME.id), players.mine(ME.id)]);
  V.innerHTML = `<h1>What's up, ${esc((MYP.name || '').split(' ')[0])}</h1>
    <a class="card" href="#/new" style="display:block;text-decoration:none"><b style="font:26px/1 var(--hd)">+ New game</b><br><span class="mu">Upload clips from today's run and get highlights.</span></a>
    <h2>Your games</h2>${mine.length ? `<div class="list">${mine.map(g => `<a href="#/g/${g.id}"><span><b>${esc(g.title)}</b><br><span class="mu">${esc(g.sport)} · ${esc(g.place || '')}</span></span><span class="mu">${esc(g.played_on || '')}</span></a>`).join('')}</div>` : `<p class="mu">No games yet. Film your next run and upload it.</p>`}
    <h2>Games you're in</h2>${tagged.length ? `<div class="list">${tagged.filter(t => t.game).map(t => `<a href="#/g/${t.game.id}"><span><b>${esc(t.game.title)}</b><br><span class="mu">You: ${esc(t.label)}</span></span><span class="mu">${esc(t.game.played_on || '')}</span></a>`).join('')}</div>` : `<p class="mu">When a friend tags you and you claim your plays, those games show up here.</p>`}
    <p class="foot">Jamoja beta${mode === 'mock' ? ' · test mode' : ''}</p>`;
}

// ---------------- Sign in / create account
function login() {
  const q = qs(); let up = q.get('mode') === 'up'; const next = q.get('next') || '#/';
  const draw = (msg = '') => {
    V.innerHTML = `<h1>${up ? 'Create your account' : 'Welcome back'}</h1>
      <form id="lf" novalidate><label class="f" for="em">Email</label><input class="t" id="em" type="email" autocomplete="email" required>
      <label class="f" for="pw">Password</label><input class="t" id="pw" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" minlength="6" required>
      ${up ? `<label class="ck"><input type="checkbox" id="age"> <span>I am 18 or older. The Jamoja beta is adults only for now.</span></label>` : ''}
      ${msg ? `<div class="err">${esc(msg)}</div>` : ''}
      <button class="btn w" style="margin-top:14px">${up ? 'Create account' : 'Sign in'}</button></form>
      <p style="margin-top:16px" class="mu">${up ? 'Already have an account?' : 'New to Jamoja?'} <a href="#" id="sw">${up ? 'Sign in' : 'Create one'}</a></p>`;
    document.getElementById('sw').onclick = e => { e.preventDefault(); up = !up; draw(); };
    document.getElementById('lf').onsubmit = async e => {
      e.preventDefault();
      const em = document.getElementById('em').value.trim(), pw = document.getElementById('pw').value;
      if (!/^\S+@\S+\.\S+$/.test(em)) return draw('Enter a valid email.');
      if (pw.length < 6) return draw('Use a password with at least 6 characters.');
      if (up && !document.getElementById('age').checked) return draw('The beta is 18 and older for now.');
      const b = e.target.querySelector('button'); b.disabled = true; b.textContent = 'One sec…';
      try {
        if (up) { const r = await auth.signUp(em, pw); if (r.needsConfirm) { V.innerHTML = `<h1>Check your email</h1><p>We sent a confirmation link to <b>${esc(em)}</b>. Tap it, then come back and sign in.</p><a class="btn g" href="#/login">Sign in</a>`; return; } }
        else await auth.signIn(em, pw);
        await refreshMe();
        go(MYP ? next : '#/setup?next=' + encodeURIComponent(next));
      } catch (err) { draw(err.message); }
    };
  };
  draw();
}

// ---------------- Profile setup
function setup() {
  if (!ME) return needLogin('#/setup');
  const next = qs().get('next') || '#/';
  const p = MYP || {};
  V.innerHTML = `<h1>${MYP ? 'Edit your profile' : 'Set up your profile'}</h1><p class="mu">This is what coaches, scouts and friends see.</p>
    <form id="pf"><label class="f" for="nm">Name</label><input class="t" id="nm" value="${esc(p.name || '')}" autocomplete="name" required>
    <label class="f" for="hd">Handle</label><input class="t" id="hd" value="${esc(p.handle || '')}" placeholder="yourname" autocapitalize="off" required>
    <label class="f" for="sp">Main sport</label><select class="t" id="sp">${SPORTS.map(s => `<option ${p.sport === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <label class="f" for="ps">Position (optional)</label><input class="t" id="ps" value="${esc(p.position || '')}" placeholder="Point guard">
    <label class="f" for="ct">City</label><input class="t" id="ct" value="${esc(p.city || '')}" placeholder="Anaheim, CA">
    <div id="pe"></div><button class="btn w" style="margin-top:16px">Save profile</button></form>`;
  const nm = document.getElementById('nm'), hd = document.getElementById('hd');
  nm.oninput = () => { if (!MYP) hd.value = nm.value.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 24); };
  document.getElementById('pf').onsubmit = async e => {
    e.preventDefault();
    const handle = hd.value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24);
    if (!nm.value.trim() || handle.length < 3) { document.getElementById('pe').innerHTML = `<div class="err">Add your name and a handle of at least 3 letters or numbers.</div>`; return; }
    try {
      MYP = await profiles.save({ id: ME.id, name: nm.value.trim(), handle, sport: document.getElementById('sp').value, position: document.getElementById('ps').value.trim(), city: document.getElementById('ct').value.trim() });
      toast('Profile saved.'); go(next);
    } catch (err) { document.getElementById('pe').innerHTML = `<div class="err">${esc(/duplicate|unique/i.test(err.message) ? 'That handle is taken. Try another.' : err.message)}</div>`; }
  };
}

// ---------------- New game: upload, find moments, cut
async function newGame() {
  if (!ME) return needLogin('#/new');
  const addTo = qs().get('game');
  const existing = addTo ? await games.get(addTo) : null;
  if (existing && existing.owner_id !== ME.id) return go('#/g/' + addTo);
  const srcs = [];
  V.innerHTML = `<h1>${existing ? 'Add clips' : 'New game'}</h1>
    ${existing ? `<p class="mu">Adding to <b>${esc(existing.title)}</b></p>` : `<div class="card"><label class="f" for="gt" style="margin-top:0">Game name</label><input class="t" id="gt" value="Saturday Run">
      <label class="f" for="gs">Sport</label><select class="t" id="gs">${SPORTS.map(s => `<option ${MYP.sport === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <label class="f" for="gp">Where</label><input class="t" id="gp" value="${esc(MYP.city || '')}" placeholder="Court or field, city">
      <label class="f" for="gd">Date</label><input class="t" id="gd" type="date" value="${today()}"></div>`}
    <div class="card"><b>Add your clips</b><p class="mu" style="margin:4px 0 10px">Pick videos from your phone. Clips up to about 10 minutes work best. Jamoja finds the loudest crowd moments, and you choose which become highlights.</p>
      <label class="btn w g" for="fi">Choose videos</label><input id="fi" type="file" accept="video/*" multiple hidden></div>
    <div id="eng" class="mu"></div><div id="srcs"></div>
    <div id="go" hidden><button class="btn w" id="mk">Make highlights</button><div id="prog" hidden><div class="bar"><b id="pb"></b></div><p class="mu" id="pt"></p></div></div>`;
  const eng = document.getElementById('eng');
  const showGo = () => { document.getElementById('go').hidden = !srcs.some(s => s.moments.some(m => m.on)); };
  document.getElementById('fi').onchange = async e => {
    const files = [...e.target.files]; e.target.value = '';
    for (const file of files) {
      const card = document.createElement('div'); card.className = 'card';
      card.innerHTML = `<b>${esc(file.name)}</b><p class="mu">Reading the video…</p>`;
      document.getElementById('srcs').append(card);
      try {
        if (!srcs.length) eng.textContent = 'Loading the highlight engine. The first time takes a moment (about 30 MB).';
        const s = await E.analyze(file); eng.textContent = '';
        s.url = URL.createObjectURL(file);
        s.moments.forEach(m => m.on = true);
        srcs.push(s); drawSrc(card, s);
      } catch (err) { console.error(err); card.innerHTML = `<b>${esc(file.name)}</b><div class="err">Could not read this video. Try a different clip.</div>`; }
      showGo();
    }
  };
  function drawSrc(card, s) {
    card.innerHTML = `<div class="row" style="justify-content:space-between"><b>${esc(s.file.name)}</b><span class="mu">${mmss(s.dur)}</span></div>
      <video class="pv" src="${s.url}" playsinline controls preload="metadata"></video>
      <p class="mu" style="margin:0 0 4px">${s.moments.length ? `Found ${s.moments.length} big moment${s.moments.length > 1 ? 's' : ''}. Uncheck any you don't want.` : s.hasAudio ? 'No big crowd moments found. Scrub to a play and add it below.' : 'This clip has no sound. Scrub to a play and add it below.'}</p>
      <div class="moms">${s.moments.map((m, i) => `<div class="mom"><input type="checkbox" data-i="${i}" ${m.on ? 'checked' : ''} aria-label="Use moment ${i + 1}"><span><span class="tm">${mmss(m.start)} to ${mmss(m.end)}</span><br><button class="btn s g" data-pv="${i}" type="button">Preview</button></span><span class="row"><button class="btn s g" data-sh="${i}" data-d="-2" type="button" aria-label="Earlier">−2s</button><button class="btn s g" data-sh="${i}" data-d="2" type="button" aria-label="Later">+2s</button></span></div>`).join('')}</div>
      <button class="btn s g" data-add type="button" style="margin-top:10px">+ Add a play at the current spot</button>`;
    const vid = card.querySelector('video');
    let stopAt = 0; vid.ontimeupdate = () => { if (stopAt && vid.currentTime >= stopAt) { vid.pause(); stopAt = 0; } };
    card.onclick = ev => {
      const b = ev.target.closest('[data-pv],[data-sh],[data-add]'); if (!b) return;
      if (b.dataset.pv) { const m = s.moments[+b.dataset.pv]; vid.currentTime = m.start; stopAt = m.end; vid.play().catch(() => {}); }
      else if (b.dataset.sh) { const m = s.moments[+b.dataset.sh], d = +b.dataset.d; const len = m.end - m.start; m.start = Math.max(0, Math.min(s.dur - len, m.start + d)); m.end = m.start + len; drawSrc(card, s); }
      else { const t = vid.currentTime; s.moments.push({ start: Math.max(0, t - 5), end: Math.min(s.dur || t + 1.5, t + 1.5), on: true }); s.moments.sort((a, b2) => a.start - b2.start); drawSrc(card, s); showGo(); }
    };
    card.onchange = ev => { const i = ev.target.dataset.i; if (i !== undefined) { s.moments[+i].on = ev.target.checked; showGo(); } };
  }
  document.getElementById('mk').onclick = async () => {
    const jobs = srcs.flatMap(s => s.moments.filter(m => m.on).map(m => ({ s, m })));
    if (!jobs.length) return;
    const mk = document.getElementById('mk'); mk.disabled = true; mk.hidden = true;
    document.getElementById('prog').hidden = false;
    const pb = document.getElementById('pb'), pt = document.getElementById('pt');
    try {
      let game = existing;
      if (!game) {
        const title = document.getElementById('gt').value.trim() || 'Saturday Run';
        game = await games.create({ owner_id: ME.id, title, sport: document.getElementById('gs').value, place: document.getElementById('gp').value.trim(), played_on: document.getElementById('gd').value || today() });
      }
      const already = existing ? (await highlights.list(game.id)).length : 0;
      for (let k = 0; k < jobs.length; k++) {
        const { s, m } = jobs[k];
        pt.textContent = `Cutting highlight ${k + 1} of ${jobs.length}. Keep this screen open.`;
        const c = await E.cut(s, m.start, m.end, p => { pb.style.width = ((k + p * 0.9) / jobs.length * 100) + '%'; });
        pt.textContent = `Uploading highlight ${k + 1} of ${jobs.length}…`;
        const key = `${ME.id}/${game.id}/${Date.now()}-${k}`;
        await storage.upload(key + '.mp4', c.video, 'video/mp4');
        await storage.upload(key + '.jpg', c.poster, 'image/jpeg');
        await highlights.add({ game_id: game.id, created_by: ME.id, label: 'Play ' + (already + k + 1), path: key + '.mp4', poster: key + '.jpg', dur_s: +c.dur.toFixed(2), start_s: +m.start.toFixed(2) });
        pb.style.width = ((k + 1) / jobs.length * 100) + '%';
      }
      for (const s of srcs) { await E.close(s); URL.revokeObjectURL(s.url); }
      toast(`${jobs.length} highlight${jobs.length > 1 ? 's' : ''} ready.`);
      go('#/g/' + game.id + '?fresh=1');
    } catch (err) { console.error(err); pt.innerHTML = `<span class="err" style="display:block">${esc(err.message)}. Your clips are still here. Try again.</span>`; mk.hidden = false; mk.disabled = false; }
  };
}

// ---------------- Game page: watch, tag, share, claim
async function gamePage(id) {
  const g = await games.get(id);
  if (!g) { V.innerHTML = `<h1>Game not found</h1><p class="mu">The link may be wrong, or the game was deleted.</p><a class="btn g" href="#/">Go home</a>`; return; }
  const [ps, hs] = await Promise.all([players.list(id), highlights.list(id)]);
  const own = ME && g.owner_id === ME.id;
  const link = shareBase() + '#/g/' + id;
  const pname = pid => { const p = ps.find(x => x.id === pid); return p ? (p.user ? p.user.name : p.label) : ''; };
  const myClaim = ME && ps.find(p => p.user_id === ME.id);
  V.innerHTML = `<h1>${esc(g.title)}</h1><p class="mu">${esc(g.sport)}${g.place ? ' · ' + esc(g.place) : ''}${g.played_on ? ' · ' + esc(g.played_on) : ''}${g.owner ? ` · by <a href="#/u/${esc(g.owner.handle)}">${esc(g.owner.name)}</a>` : ''}</p>
    ${own && qs().get('fresh') ? `<div class="card" style="border-color:var(--o)"><b>Next: tag your crew, then send the link.</b><p class="mu" style="margin:4px 0 0">Add each player below, pick who's in each highlight, then share. Friends claim their plays with a free account.</p></div>` : ''}
    <div class="card"><b>Share this game</b><div class="lnk"><input readonly value="${esc(link)}" aria-label="Game link" id="lk"><button class="btn s" id="cp">Copy</button></div>
      ${navigator.share ? `<button class="btn g w" id="sh" style="margin-top:8px">Send to the group chat</button>` : ''}</div>
    <h2>Players</h2>
    <div class="row" id="pl">${ps.map(p => `<span class="chip ${p.user_id ? 'ok' : ''}">${esc(p.label)}${p.user ? ` · <a href="#/u/${esc(p.user.handle)}">@${esc(p.user.handle)}</a>` : ''}${own && !p.user_id ? `<button data-rm="${p.id}" aria-label="Remove ${esc(p.label)}">×</button>` : ''}</span>`).join('') || '<span class="mu">No players tagged yet.</span>'}</div>
    ${own ? `<form id="af" class="row" style="margin-top:10px"><input class="t" id="an" placeholder="Name or shirt, like Jay or white shirt" style="flex:1"><button class="btn s">Add</button></form>` : ''}
    ${!myClaim && ps.some(p => !p.user_id) ? `<div class="card" style="margin-top:12px"><b>Are you in this game?</b><p class="mu" style="margin:4px 0 10px">Tap your name to put these plays on your profile.</p><div class="row">${ps.filter(p => !p.user_id).map(p => `<button class="btn s" data-claim="${p.id}">I'm ${esc(p.label)}</button>`).join('')}</div></div>` : ''}
    ${myClaim ? `<p class="mu" style="margin-top:10px">You claimed <b>${esc(myClaim.label)}</b>. <button class="btn s g" data-release="${myClaim.id}">Not me</button></p>` : ''}
    <h2>Highlights</h2>
    ${hs.length ? `<div class="grid">${hs.map(h => `<div class="hl"><video src="${esc(storage.url(h.path))}" poster="${esc(storage.url(h.poster))}" controls playsinline preload="none"></video><div class="b"><b>${esc(h.label)}</b><span class="mu">${h.player_id ? esc(pname(h.player_id)) : own ? 'Who is this?' : ''}</span>
      ${own ? `<select data-hp="${h.id}" aria-label="Player in ${esc(h.label)}"><option value="">No one tagged</option>${ps.map(p => `<option value="${p.id}" ${h.player_id === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select><button class="btn s g w" data-hd="${h.id}" style="margin-top:6px">Delete</button>` : ''}</div></div>`).join('')}</div>` : `<p class="mu">No highlights yet.</p>`}
    ${own ? `<div class="row" style="margin-top:16px"><a class="btn g" href="#/new?game=${id}">+ Add more clips</a><button class="btn g" id="dg">Delete game</button></div>` : ''}
    <p class="foot">Want highlights from your games? <a href="#/login?mode=up">Create a free Jamoja account</a></p>`;
  const lk = document.getElementById('lk');
  document.getElementById('cp').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Link copied. Drop it in the group chat.'); } catch (e) { lk.select(); toast('Press and hold the link to copy it.'); } };
  const sh = document.getElementById('sh'); if (sh) sh.onclick = () => navigator.share({ title: g.title + ' on Jamoja', text: 'Highlights from ' + g.title + '. Tap to watch and claim your plays.', url: link }).catch(() => {});
  const af = document.getElementById('af');
  if (af) af.onsubmit = async e => { e.preventDefault(); const v = document.getElementById('an').value.trim(); if (!v) return; await players.add(id, v.slice(0, 40)); gamePage(id); };
  V.onclick = async ev => {
    const b = ev.target.closest('[data-rm],[data-claim],[data-release],[data-hd],#dg'); if (!b) return;
    try {
      if (b.dataset.rm) { await players.remove(b.dataset.rm); gamePage(id); }
      else if (b.dataset.claim) {
        if (!ME) return needLogin('#/g/' + id);
        const okc = await players.claim(b.dataset.claim);
        toast(okc ? 'These plays are now on your profile.' : 'Someone already claimed that one.'); gamePage(id);
      }
      else if (b.dataset.release) { await players.release(b.dataset.release); toast('Removed from your profile.'); gamePage(id); }
      else if (b.dataset.hd) { if (!confirmIn(b)) return; const h = hs.find(x => x.id === b.dataset.hd); await highlights.remove(h.id); await storage.remove([h.path, h.poster]); gamePage(id); }
      else if (b.id === 'dg') { if (!confirmIn(b)) return; await storage.remove(hs.flatMap(h => [h.path, h.poster])); await games.remove(id); toast('Game deleted.'); go('#/'); }
    } catch (err) { toast(err.message); }
  };
  V.onchange = async ev => { const s = ev.target.closest('[data-hp]'); if (!s) return; await highlights.update(s.dataset.hp, { player_id: s.value || null }); toast('Tagged.'); gamePage(id); };
}
// Two-tap confirm without browser dialogs.
function confirmIn(b) { if (b.dataset.sure) return true; b.dataset.sure = '1'; const t = b.textContent; b.textContent = 'Tap again to confirm'; setTimeout(() => { delete b.dataset.sure; b.textContent = t; }, 3000); return false; }

// ---------------- Profile
async function profilePage(handle) {
  const p = await profiles.byHandle(handle);
  if (!p) { V.innerHTML = `<h1>Player not found</h1><a class="btn g" href="#/">Go home</a>`; return; }
  const me = ME && ME.id === p.id;
  const [tags, made] = await Promise.all([players.mine(p.id), games.mine(p.id)]);
  const hs = await highlights.forPlayers(tags.map(t => t.id));
  const link = shareBase() + '#/u/' + encodeURIComponent(p.handle);
  V.innerHTML = `<div class="row" style="gap:14px"><div class="av">${esc(ini(p.name))}</div><div><h1 style="margin:0">${esc(p.name)}</h1><p class="mu" style="margin:0">@${esc(p.handle)} · ${esc(p.sport || '')}${p.position ? ' · ' + esc(p.position) : ''}${p.city ? ' · ' + esc(p.city) : ''}</p></div></div>
    <div class="row" style="margin-top:14px"><button class="btn s" id="cp">Copy profile link</button>${me ? `<a class="btn s g" href="#/setup?next=${encodeURIComponent('#/u/' + p.handle)}">Edit profile</a><button class="btn s g" id="so">Sign out</button>` : ''}</div>
    <h2>Highlights</h2>${hs.length ? `<div class="grid">${hs.map(h => `<div class="hl"><video src="${esc(storage.url(h.path))}" poster="${esc(storage.url(h.poster))}" controls playsinline preload="none"></video><div class="b"><b>${esc(h.label)}</b><a class="mu" href="#/g/${h.game_id}">${esc(h.game ? h.game.title : 'Game')}</a></div></div>`).join('')}</div>` : `<p class="mu">${me ? 'Claim yourself in a game and your plays show up here.' : 'No highlights yet.'}</p>`}
    <h2>Games filmed</h2>${made.length ? `<div class="list">${made.map(g => `<a href="#/g/${g.id}"><span><b>${esc(g.title)}</b><br><span class="mu">${esc(g.sport)} · ${esc(g.place || '')}</span></span><span class="mu">${esc(g.played_on || '')}</span></a>`).join('')}</div>` : `<p class="mu">None yet.</p>`}`;
  document.getElementById('cp').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Profile link copied.'); } catch (e) { toast(link); } };
  const so = document.getElementById('so'); if (so) so.onclick = async () => { await auth.signOut(); toast('Signed out.'); go('#/'); };
}

route();
