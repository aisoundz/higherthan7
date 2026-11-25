import * as E from './engine.js?v=20261125g';
import * as R from './rec.js?v=20261125g';
import { auth, profiles, games, players, highlights, fires, storage, mode, ready } from './db.js?v=20261125g';
const PLAYS = {
  Basketball: ['Bucket', 'Three', 'And-one', 'Dunk', 'Dime', 'Block', 'Steal', 'Ankle breaker', 'Game winner'],
  Soccer: ['Goal', 'Assist', 'Skill move', 'Nutmeg', 'Save', 'Tackle'],
  'Flag football': ['Touchdown', 'Catch', 'Pick', 'Big run', 'Flag pull'],
  Football: ['Touchdown', 'Catch', 'Pick', 'Big run', 'Sack', 'Big hit'],
  Volleyball: ['Kill', 'Ace', 'Block', 'Dig', 'Set'],
  Baseball: ['Home run', 'Hit', 'Strikeout', 'Diving catch', 'Double play'],
  Softball: ['Home run', 'Hit', 'Strikeout', 'Diving catch', 'Double play'],
  Track: ['Finish', 'Start', 'PR'],
  Tennis: ['Ace', 'Winner', 'Rally'],
  Other: ['Big play'],
};
const playsFor = sp => [...(PLAYS[sp] || []), 'Big play'].filter((v, i, a) => a.indexOf(v) === i);
// Links opened inside Instagram, Facebook, TikTok, Snapchat or LinkedIn run in their own browser,
// where the camera, uploads and staying signed in often fail.
const UA = navigator.userAgent || '';
const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Bytedance|Snapchat|LinkedInApp|Line\//i.test(UA);
const ANDROID = /Android/i.test(UA);
function inAppCard() {
  if (!IN_APP) return '';
  const url = location.href;
  const open = ANDROID ? `<a class="btn s" href="intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end">Open in Chrome</a>` : '';
  return `<div class="card" style="border-color:var(--o)"><b>Open Jamoja in your browser</b><p class="mu" style="margin:4px 0 10px">You opened this inside another app, where filming, uploads and staying signed in can fail. ${ANDROID ? 'Tap below.' : 'Tap the ••• or share button at the top or bottom, then Open in Safari.'}</p><div class="row">${open}<button class="btn s g" type="button" onclick="navigator.clipboard&&navigator.clipboard.writeText(location.href).then(()=>this.textContent='Link copied')">Copy link</button></div></div>`;
}
// Password reset links come back with tokens in the address.
let RECOVERY = /type=recovery/.test(location.hash);
const LINK_ERR = /error_description=([^&]+)/.exec(location.hash);
// Count a view once per clip per visit, after 2 seconds of play.
function countViews(root) {
  root.querySelectorAll('video[data-hid]').forEach(v => {
    let t = null;
    v.addEventListener('play', () => { const id = v.dataset.hid; if (sessionStorage.getItem('jm.v.' + id)) return; t = setTimeout(() => { try { sessionStorage.setItem('jm.v.' + id, '1'); } catch (e) { /* private mode */ } highlights.view(id).catch(() => {}); }, 2000); });
    v.addEventListener('pause', () => clearTimeout(t));
  });
}
const views = n => n ? `${n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : n} view${n === 1 ? '' : 's'}` : '';
// Branded clip for sharing: JAMOJA tag plus the player's handle and the play.
function watermark(who, play) {
  const c = document.createElement('canvas'); const W = 360, H = 64; c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,0.62)'; x.beginPath(); (x.roundRect ? x.roundRect(0, 0, W, H, 14) : x.rect(0, 0, W, H)); x.fill();
  x.fillStyle = '#ff5a1f'; x.font = 'bold 24px Impact, Arial Black, sans-serif'; x.textBaseline = 'middle'; x.fillText('JAMOJA', 14, 22);
  x.fillStyle = '#fff'; x.font = '600 17px Inter, Arial, sans-serif';
  let line = [who, play].filter(Boolean).join(' · ').toUpperCase(); while (x.measureText(line).width > W - 28 && line.length > 4) line = line.slice(0, -2) + '…';
  x.fillText(line || 'EVERY GAME. SEEN.', 14, 46);
  return new Promise(r => c.toBlob(b => b.arrayBuffer().then(a => r(new Uint8Array(a))), 'image/png'));
}
let sharing = false;
async function shareClip(h, who, link) {
  if (sharing) return; sharing = true;
  try {
    const canFiles = navigator.canShare && navigator.canShare({ files: [new File([new Blob()], 'x.mp4', { type: 'video/mp4' })] });
    if (!canFiles) {
      if (navigator.share) await navigator.share({ title: 'Jamoja', text: (who ? who + ' on Jamoja. ' : '') + 'Watch the play:', url: link }).catch(() => {});
      else { await navigator.clipboard.writeText(link).catch(() => {}); toast('Link copied.'); }
      return;
    }
    toast('Making your clip with the Jamoja tag… the first time takes a moment.');
    const raw = await storage.blob(h.path);
    let out = raw;
    try { out = await E.brand(raw, await watermark(who, h.play_type)); } catch (e) { console.warn('brand failed, sharing original', e); }
    const file = new File([out], `jamoja-${(who || 'play').replace(/[^\w]+/g, '-')}.mp4`, { type: 'video/mp4' });
    await navigator.share({ files: [file], text: `${who ? who + ' ' : ''}on Jamoja. ${link}` }).catch(() => {});
  } finally { sharing = false; }
}

const V = document.getElementById('view'), TR = document.getElementById('tr');
const LOCAL = mode === 'local';
let ME = null, MYP = null;
const POS = { Basketball: 'Point guard', Soccer: 'Striker', 'Flag football': 'Wide receiver', Volleyball: 'Outside hitter', Football: 'Linebacker', Baseball: 'Shortstop', Softball: 'Pitcher', Track: '100m and 200m', Tennis: 'Singles', Other: '' };
const SPORTS = ['Basketball', 'Soccer', 'Flag football', 'Volleyball', 'Football', 'Baseball', 'Softball', 'Track', 'Tennis', 'Other'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mmss = t => { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const ini = n => (n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const shareBase = () => location.origin + location.pathname + location.search.replace(/[?&]mock=1/, '').replace(/^&/, '?');
let toastT;
function toast(m) { let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); } t.textContent = m; clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 3500); }
const go = h => { if (location.hash === h) route(); else location.hash = h; };
const qs = () => new URLSearchParams((location.hash.split('?')[1]) || '');
let busy = false; // true while cutting highlights: warn before leaving
window.addEventListener('beforeunload', e => { if (busy) { e.preventDefault(); e.returnValue = ''; } });

async function refreshMe() { ME = await auth.user(); MYP = ME ? await profiles.byId(ME.id) : null; }
function topbar() {
  TR.innerHTML = ME
    ? (MYP ? `<a class="btn s" href="#/new">+ New game</a><a href="#/u/${esc(MYP.handle)}" class="av" style="width:38px;height:38px;font-size:17px;text-decoration:none" aria-label="My profile">${esc(ini(MYP.name))}</a>` : '')
    : LOCAL ? '' : `<a class="btn s g" href="#/login">Sign in</a>`;
  const nav = document.getElementById('nav'); if (!nav) return;
  const h = location.hash || '#/';
  nav.hidden = !(ME && MYP) || /^#\/(login|setup)/.test(h);
  if (!nav.hidden) nav.innerHTML = `<a href="#/" class="${h === '#/' || h === '#' ? 'on' : ''}"><svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>Feed</a><a href="#/new" class="film"><span>+</span>Film</a><a href="#/u/${esc(MYP.handle)}" class="${h.startsWith('#/u/') ? 'on' : ''}"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>Me</a>`;
}
function needLogin(next) { go(LOCAL ? '#/setup?next=' + encodeURIComponent(next || '#/') : '#/login?next=' + encodeURIComponent(next || location.hash)); }

async function route() {
  if (busy) { toast('Still cutting highlights. Stay on this screen until it finishes.'); return; }
  window.scrollTo(0, 0);
  const [path] = location.hash.slice(1).split('?');
  const parts = (path || '/').split('/').filter(Boolean);
  try {
    await ready;
    await refreshMe();
    if (LINK_ERR && !route.linkErr) { route.linkErr = 1; history.replaceState(null, '', location.pathname + location.search + '#/login?expired=1'); return route(); }
    if (RECOVERY) { RECOVERY = false; history.replaceState(null, '', location.pathname + location.search + '#/reset'); return route(); }
    if (/access_token=/.test(location.hash)) { history.replaceState(null, '', location.pathname + location.search + '#/'); return route(); }
    if (ME && !MYP && parts[0] !== 'setup' && parts[0] !== 'login' && parts[0] !== 'reset') return go('#/setup?next=' + encodeURIComponent(location.hash || '#/'));
    topbar();
    if (!parts.length) return await home();
    if (parts[0] === 'login') { TR.innerHTML = ''; return LOCAL ? go('#/') : await login(); }
    if (parts[0] === 'setup') return setup();
    if (parts[0] === 'reset') return resetPage();
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
auth.onChange(ev => { if (ev === 'PASSWORD_RECOVERY') { RECOVERY = false; go('#/reset'); return; } refreshMe().then(topbar); });

const gameList = list => `<div class="list">${list.map(g => `<a href="#/g/${g.id}"><span><b>${esc(g.title)}</b><br><span class="mu">${esc(g.sport)}${g.place ? ' · ' + esc(g.place) : ''}</span></span><span class="mu">${esc(g.played_on || '')}</span></a>`).join('')}</div>`;

// ---------------- Home: the social feed
let FEED_SPORT = '';
async function home() {
  const parts = ME ? await R.savedParts() : [];
  const top = !ME
    ? `${inAppCard()}<section class="hero"><h1>Every game. Seen.</h1><p>Film your run. Jamoja finds the big plays, cuts the highlights and puts them on every player's profile.</p>
      <div class="row"><a class="btn" href="#/login?mode=up">Create free account</a><a class="btn g" href="#/login">Sign in</a></div></section>`
    : `${parts.length ? `<a class="card" href="#/new" style="display:block;text-decoration:none;border-color:var(--o)"><b>You have an unfinished recording</b><br><span class="mu">${parts.length} part${parts.length > 1 ? 's' : ''} saved on this phone. Tap to make highlights from it.</span></a>` : ''}
      <a class="card film-cta" href="#/new"><span class="dot">●</span><span><b>Film a game</b><br><span class="mu">Tap BUCKET after big plays. Highlights are cut for you.</span></span></a>`;
  V.innerHTML = `${top}<div class="row sports" id="sp">${['All', ...SPORTS].map(x => `<button class="chip ${(x === 'All' ? '' : x) === FEED_SPORT ? 'on' : ''}" data-sp="${x === 'All' ? '' : esc(x)}">${esc(x)}</button>`).join('')}</div>
    <div id="feed"><p class="mu">Loading highlights…</p></div>
    ${ME && !LOCAL ? '<div id="mine"></div>' : ''}<p class="foot">Jamoja beta${LOCAL ? ' · saved on this phone' : mode === 'mock' ? ' · test mode' : ''}. 18 and older during testing.</p>`;
  document.getElementById('sp').onclick = e => { const b = e.target.closest('[data-sp]'); if (!b) return; FEED_SPORT = b.dataset.sp; home(); };
  await drawFeed();
  if (ME && !LOCAL) drawMine();
}
async function drawFeed() {
  const box = document.getElementById('feed');
  let list = [];
  try { list = await highlights.feed(FEED_SPORT); } catch (e) { console.error(e); box.innerHTML = `<div class="err">Could not load the feed. Pull down to refresh.</div>`; return; }
  await storage.prep(list.flatMap(h => [h.path, h.poster]));
  const lit = await fires.mine(ME && ME.id, list.map(h => h.id)).catch(() => new Set());
  const who = h => h.player ? (h.player.user ? `<a href="#/u/${esc(h.player.user.handle)}">@${esc(h.player.user.handle)}</a>` : esc(h.player.label)) : '';
  const pinned = list.length < 3 && !FEED_SPORT ? `<article class="post"><div class="pin">Pinned · Welcome to Jamoja</div><video src="../reel.mp4" poster="../poster.jpg" playsinline muted loop preload="metadata"></video><div class="meta"><b>Anis Taylor</b><span class="mu">Founder · Basketball · Anaheim. Built by an athlete, for athletes.</span><a class="mu" href="../profile/">See a full player profile</a></div></article>` : '';
  const whoName = h => h.player ? (h.player.user ? '@' + h.player.user.handle : h.player.label) : '';
  box.innerHTML = (list.length ? list.map(h => `<article class="post" data-id="${h.id}"><video data-hid="${h.id}" src="${esc(storage.url(h.path))}" poster="${esc(storage.url(h.poster))}" playsinline muted loop preload="none"></video>
    <div class="side"><button class="fire ${lit.has(h.id) ? 'on' : ''}" data-fire="${h.id}" aria-label="Fire"><span>🔥</span><b>${h.fire || 0}</b></button><button class="fire" data-share="${h.id}" aria-label="Share"><span>↗</span><b>Share</b></button><button class="fire" data-more="${h.id}" aria-label="More"><span>⋯</span><b></b></button></div>
    <div class="meta">${h.play_type ? `<span class="cap">${esc(h.play_type)}</span>` : ''}<b>${who(h) || (h.game.owner && MYP && h.game.owner.handle === MYP.handle ? `<a href="#/g/${h.game_id}">Who is this? Tag them</a>` : 'Who is this?')}</b><a href="#/g/${h.game_id}">${esc(h.game.title)}</a><span class="mu">${esc(h.game.sport)}${h.game.place ? ' · ' + esc(h.game.place) : ''}${h.game.owner ? ` · filmed by <a href="#/u/${esc(h.game.owner.handle)}">@${esc(h.game.owner.handle)}</a>` : ''}${h.views ? ' · ' + views(h.views) : ''}</span>${!h.player ? `<a class="mu" href="#/g/${h.game_id}">In this play? Claim it</a>` : ''}</div></article>`).join('')
    : `<div class="card"><b>${FEED_SPORT ? 'No ' + esc(FEED_SPORT) + ' highlights yet.' : 'The feed fills up as games get filmed.'}</b><p class="mu" style="margin:4px 0 10px">Film your next run and your plays show up here for everyone.</p>${ME ? `<a class="btn s" href="#/new">Film a game</a>` : `<a class="btn s" href="#/login?mode=up">Create free account</a>`}</div>`) + pinned;
  countViews(box);
  // Autoplay the clip that is on screen, muted. Tap a clip for sound.
  const io = new IntersectionObserver(es => es.forEach(en => { const v = en.target; if (en.isIntersecting) { v.preload = 'auto'; v.play().catch(() => {}); } else v.pause(); }), { threshold: 0.6 });
  box.querySelectorAll('video').forEach(v => { io.observe(v); v.onclick = () => { v.muted = !v.muted; if (v.paused) v.play().catch(() => {}); toast(v.muted ? 'Sound off' : 'Sound on'); }; });
  box.onclick = async e => {
    const f = e.target.closest('[data-fire]'), sh = e.target.closest('[data-share]'), mo = e.target.closest('[data-more]'), rp = e.target.closest('[data-rep]');
    if (mo) {
      const art = mo.closest('.post'); const open = art.nextElementSibling && art.nextElementSibling.classList.contains('rep');
      box.querySelectorAll('.rep').forEach(x => x.remove()); if (open) return;
      art.insertAdjacentHTML('afterend', `<div class="card rep"><b>Report this clip</b><p class="mu" style="margin:4px 0 10px">Two reports take a clip off the feed until we review it.</p><div class="row">${["I'm in it and want it removed", 'Inappropriate', 'Not a real play', 'Spam'].map(r => `<button class="btn s g" data-rep="${mo.dataset.more}" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div></div>`);
      return;
    }
    if (rp) {
      if (!ME) return needLogin('#/');
      try { await highlights.report(rp.dataset.rep, rp.dataset.r); rp.closest('.rep').innerHTML = `<b>Thanks. We got your report.</b>`; } catch (err) { toast(err.message); }
      return;
    }
    if (f) {
      if (!ME) return needLogin('#/');
      const on = !f.classList.contains('on'), n = f.querySelector('b');
      f.classList.toggle('on', on); n.textContent = (+n.textContent || 0) + (on ? 1 : -1);
      try { await fires.toggle(f.dataset.fire, ME.id, on); } catch (err) { f.classList.toggle('on', !on); n.textContent = (+n.textContent || 0) + (on ? -1 : 1); toast(err.message); }
    } else if (sh) {
      const h = list.find(x => x.id === sh.dataset.share);
      shareClip(h, whoName(h), shareBase() + '#/g/' + h.game_id).catch(err => toast(err.message));
    }
  };
}
async function drawMine() {
  const [mine, tagged] = await Promise.all([games.mine(ME.id), players.mine(ME.id)]).catch(() => [[], []]);
  const el = document.getElementById('mine'); if (!el) return;
  el.innerHTML = `${mine.length ? `<h2>Your games</h2>${gameList(mine)}` : ''}${tagged.filter(t => t.game).length ? `<h2>Games you're in</h2><div class="list">${tagged.filter(t => t.game).map(t => `<a href="#/g/${t.game.id}"><span><b>${esc(t.game.title)}</b><br><span class="mu">You: ${esc(t.label)}</span></span><span class="mu">${esc(t.game.played_on || '')}</span></a>`).join('')}</div>` : ''}`;
}

// ---------------- Sign in / create account (live mode)
async function login() {
  const q = qs(); const next = q.get('next') || '#/';
  if (q.get('mode') === 'forgot') return forgot();
  const gm = /^#\/g\/([0-9a-f-]{36})(?:\?claim=([0-9a-f-]{36}))?/.exec(next);
  let up = q.get('mode') === 'up' || (!!gm && q.get('mode') !== 'in');
  let invite = '';
  if (gm) {
    try {
      const [g, ps, hs] = await Promise.all([games.get(gm[1]), players.list(gm[1]), highlights.list(gm[1])]);
      if (g) {
        const who = gm[2] && ps.find(p => p.id === gm[2]);
        const mine = who ? hs.filter(h => h.player_id === who.id).length : 0;
        const pic = hs.find(h => h.poster);
        if (pic) await storage.prep([pic.poster]);
        invite = `<div class="card row" style="flex-wrap:nowrap;gap:12px;border-color:var(--o)">${pic ? `<img src="${esc(storage.url(pic.poster))}" alt="" style="width:64px;height:84px;object-fit:cover;border-radius:10px;flex:none">` : ''}<div><b>${who ? `Claim ${esc(who.label)}'s plays` : 'Join this game on Jamoja'}</b><br><span class="mu">${esc(g.title)}${g.owner ? ' · filmed by ' + esc(g.owner.name) : ''}${who ? ` · ${mine || hs.length} highlight${(mine || hs.length) === 1 ? '' : 's'}` : ` · ${hs.length} highlight${hs.length === 1 ? '' : 's'}`}</span></div></div>`;
      }
    } catch (e) { invite = ''; }
  }
  const draw = (msg = '') => {
    V.innerHTML = `${inAppCard()}${q.get('expired') ? `<div class="err">That link expired or was already used. Ask for a new one below.</div>` : ''}${invite}<h1>${up ? (gm ? 'Claim your plays' : 'Create your account') : 'Welcome back'}</h1>
      <p class="mu" style="margin-top:-4px">${up ? (gm ? 'Make a free account and these plays go on your profile. Takes 20 seconds.' : 'Free. Takes 20 seconds.') : 'Sign in to see your games and plays.'}</p>
      <form id="lf" novalidate><label class="f" for="em">Email</label><input class="t" id="em" type="email" inputmode="email" autocomplete="email" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="you@email.com" required>
      <label class="f" for="pw">Password</label><div class="pwb"><input class="t" id="pw" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" autocapitalize="off" autocorrect="off" spellcheck="false" minlength="6" placeholder="${up ? 'At least 6 characters' : 'Your password'}" required><button type="button" id="eye" class="eye" aria-pressed="false" aria-label="Show password"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path class="sl" d="M4 4l16 16"/></svg></button></div>
      ${up ? `<label class="ck"><input type="checkbox" id="age"> <span>I am 18 or older. The Jamoja beta is adults only for now.</span></label>` : ''}
      ${msg ? `<div class="err">${esc(msg)}</div>` : ''}
      <button class="btn w" style="margin-top:14px">${up ? 'Create account' : 'Sign in'}</button></form>
      <p style="margin-top:16px" class="mu">${up ? 'Already have an account?' : 'New to Jamoja?'} <a href="#" id="sw">${up ? 'Sign in' : 'Create one'}</a>${up ? '' : ` · <a href="#/login?mode=forgot">Forgot password?</a>`}</p>`;
    document.getElementById('sw').onclick = e => { e.preventDefault(); up = !up; draw(); };
    const eye = document.getElementById('eye'), pwi = document.getElementById('pw');
    eye.onclick = () => { const show = pwi.type === 'password'; pwi.type = show ? 'text' : 'password'; eye.classList.toggle('on', show); eye.setAttribute('aria-pressed', show); eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); pwi.focus(); };
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

function forgot() {
  V.innerHTML = `<h1>Reset your password</h1><p class="mu">Enter your email and we will send you a link to set a new one.</p>
    <form id="ff" novalidate><label class="f" for="em">Email</label><input class="t" id="em" type="email" inputmode="email" autocomplete="email" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="you@email.com"><div id="fe"></div>
    <button class="btn w" style="margin-top:14px">Send reset link</button></form><p class="mu" style="margin-top:16px"><a href="#/login">Back to sign in</a></p>`;
  document.getElementById('ff').onsubmit = async e => {
    e.preventDefault(); const em = document.getElementById('em').value.trim();
    if (!/^\S+@\S+\.\S+$/.test(em)) { document.getElementById('fe').innerHTML = `<div class="err">Enter a valid email.</div>`; return; }
    const b = e.target.querySelector('button'); b.disabled = true; b.textContent = 'Sending…';
    try { await auth.resetEmail(em, location.origin + location.pathname); V.innerHTML = `<h1>Check your email</h1><p>If <b>${esc(em)}</b> has a Jamoja account, a reset link is on the way. It can take a few minutes, and it may land in spam.</p><a class="btn g" href="#/login">Back to sign in</a>`; }
    catch (err) { b.disabled = false; b.textContent = 'Send reset link'; document.getElementById('fe').innerHTML = `<div class="err">${esc(/rate|seconds/i.test(err.message) ? 'Too many tries. Wait a minute and try again.' : err.message)}</div>`; }
  };
}
function resetPage() {
  if (!ME) { V.innerHTML = `<h1>Link expired</h1><p class="mu">Ask for a new reset link.</p><a class="btn" href="#/login?mode=forgot">Send a new link</a>`; return; }
  TR.innerHTML = '';
  V.innerHTML = `<h1>Set a new password</h1><form id="rf" novalidate><label class="f" for="pw">New password</label><div class="pwb"><input class="t" id="pw" type="text" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="At least 6 characters"></div><div id="re"></div><button class="btn w" style="margin-top:14px">Save password</button></form>`;
  document.getElementById('rf').onsubmit = async e => {
    e.preventDefault(); const pw = document.getElementById('pw').value;
    if (pw.length < 6) { document.getElementById('re').innerHTML = `<div class="err">Use at least 6 characters.</div>`; return; }
    try { await auth.setPassword(pw); toast('Password saved. You are signed in.'); go(MYP ? '#/' : '#/setup'); }
    catch (err) { document.getElementById('re').innerHTML = `<div class="err">${esc(err.message)}</div>`; }
  };
}

// ---------------- Profile setup
function setup() {
  if (!ME) return needLogin('#/setup');
  const next = qs().get('next') || '#/';
  const p = MYP || {};
  V.innerHTML = `<h1>${MYP ? 'Edit your profile' : 'Set up your profile'}</h1><p class="mu">${LOCAL ? 'Takes 20 seconds. Saved on this phone.' : 'This is what coaches, scouts and friends see.'}</p>
    <form id="pf"><label class="f" for="nm">Name</label><input class="t" id="nm" value="${esc(p.name || '')}" autocomplete="name" required>
    <label class="f" for="hd">Handle</label><input class="t" id="hd" value="${esc(p.handle || '')}" placeholder="yourname" autocapitalize="off" autocorrect="off" spellcheck="false" required><p class="mu" id="hp" style="margin:4px 0 0"></p>
    <label class="f" for="sp">Main sport</label><select class="t" id="sp">${SPORTS.map(s => `<option ${p.sport === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <label class="f" for="ps">Position (optional)</label><input class="t" id="ps" value="${esc(p.position || '')}" placeholder="${esc(POS[p.sport || 'Basketball'] || '')}">
    <label class="f" for="ct">City</label><input class="t" id="ct" value="${esc(p.city || '')}" placeholder="Anaheim, CA">
    <div id="pe"></div><button class="btn w" style="margin-top:16px">Save profile</button></form>`;
  const nm = document.getElementById('nm'), hd = document.getElementById('hd');
  const hp = document.getElementById('hp'), sp = document.getElementById('sp'), ps = document.getElementById('ps');
  const clean = v => v.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._]/g, '').slice(0, 24);
  const showH = () => { hp.innerHTML = hd.value ? `Your profile: <b>@${esc(hd.value)}</b>. Letters, numbers, dots and underscores.` : 'Letters, numbers, dots and underscores.'; };
  nm.oninput = () => { if (!MYP) { hd.value = clean(nm.value).replace(/^[._]+|[._]+$/g, ''); showH(); } };
  hd.oninput = () => { const c = clean(hd.value); if (c !== hd.value) hd.value = c; showH(); };
  sp.onchange = () => { ps.placeholder = POS[sp.value] || ''; };
  showH();
  document.getElementById('pf').onsubmit = async e => {
    e.preventDefault();
    const handle = clean(hd.value).replace(/^[._]+|[._]+$/g, '');
    if (!nm.value.trim() || handle.length < 3) { document.getElementById('pe').innerHTML = `<div class="err">Add your name and a handle of at least 3 letters or numbers.</div>`; return; }
    try {
      MYP = await profiles.save({ id: ME.id, name: nm.value.trim(), handle, sport: document.getElementById('sp').value, position: document.getElementById('ps').value.trim(), city: document.getElementById('ct').value.trim() });
      toast('Profile saved.'); go(next);
    } catch (err) { document.getElementById('pe').innerHTML = `<div class="err">${esc(/duplicate|unique/i.test(err.message) ? 'That handle is taken. Try another.' : err.message)}</div>`; }
  };
}

// ---------------- New game: film or upload, find moments, cut
async function newGame() {
  if (!ME) return needLogin('#/new');
  const addTo = qs().get('game');
  const existing = addTo ? await games.get(addTo) : null;
  if (existing && existing.owner_id !== ME.id) return go('#/g/' + addTo);
  const srcs = [];
  const recParts = new Set();
  const saved = await R.savedParts();
  V.innerHTML = `${inAppCard()}<h1>${existing ? 'Add clips' : 'New game'}</h1>
    ${existing ? `<p class="mu">Adding to <b>${esc(existing.title)}</b></p>` : `<div class="card"><label class="f" for="gt" style="margin-top:0">Game name</label><input class="t" id="gt" value="Saturday Run">
      <label class="f" for="gs">Sport</label><select class="t" id="gs">${SPORTS.map(s => `<option ${MYP.sport === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <label class="f" for="gp">Where</label><input class="t" id="gp" value="${esc(MYP.city || '')}" placeholder="Court or field, city">
      <label class="f" for="gd">Date</label><input class="t" id="gd" type="date" value="${today()}"></div>`}
    ${saved.length ? `<div class="card" style="border-color:var(--o)" id="recov"><b>Unfinished recording found</b><p class="mu" style="margin:4px 0 10px">${saved.length} part${saved.length > 1 ? 's' : ''} (${mmss(saved.reduce((a, p) => a + p.dur, 0))}) saved on this phone, with ${(n => n + (n === 1 ? ' play' : ' plays'))(saved.reduce((a, p) => a + p.marks.length, 0))} marked.</p><div class="row"><button class="btn s" id="rcv">Use it</button><button class="btn s g" id="rdel">Delete it</button></div></div>` : ''}
    <div class="card"><b>Add your game</b><p class="mu" style="margin:4px 0 12px">Film right here and tap BUCKET after big plays, or upload clips you already shot.</p>
      ${R.supported() ? `<button class="btn w" id="film" style="min-height:56px;font-size:18px">● Film in Jamoja</button>` : ''}
      <label class="btn w g" for="fi" style="margin-top:8px">Upload videos</label><input id="fi" type="file" accept="video/*" multiple hidden></div>
    <div id="eng" class="mu"></div><div id="tip"></div><div id="srcs"></div>
    <div id="go" hidden><button class="btn w" id="mk" style="min-height:56px;font-size:18px">Make highlights</button><div id="prog" hidden><div class="bar"><b id="pb"></b></div><p class="mu" id="pt"></p></div></div>`;
  const eng = document.getElementById('eng');
  const showGo = () => { document.getElementById('go').hidden = !srcs.some(s => s.moments.some(m => m.on)); };

  async function addSource(file, extra) {
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `<b>${esc(file.name)}</b><p class="mu">Reading the video…</p>`;
    document.getElementById('srcs').append(card);
    try {
      eng.textContent = srcs.length ? '' : 'Loading the highlight engine. The first time takes a moment (about 30 MB).';
      const s = await E.analyze(file); eng.textContent = '';
      s.url = URL.createObjectURL(file);
      if (!s.dur && extra && extra.dur) s.dur = extra.dur;
      const auto = s.moments.map(m => ({ ...m, on: true, src: 'crowd' }));
      if (extra && extra.marks && extra.marks.length) {
        // BUCKET taps win: each tap keeps the 8 seconds before it and 2 after.
        s.moments = extra.marks.map(t => ({ start: Math.max(0, t - 8), end: Math.min(s.dur || t + 2, t + 2), on: true, src: 'tap' }));
        for (const a of auto) if (s.moments.every(m => Math.abs(m.start - a.start) > 6)) s.moments.push({ ...a, on: false });
        s.moments.sort((a, b) => a.start - b.start);
      } else s.moments = auto;
      s.quiet = s.hasAudio && auto.length > 0 && Math.max(...s.moments.filter(m => m.src === 'crowd').map(m => m.lift || 0)) < 5;
      if (extra && extra.id) s.partId = extra.id;
      srcs.push(s); drawSrc(card, s); tips(s);
    } catch (err) { console.error(err); eng.textContent = ''; card.innerHTML = `<b>${esc(file.name)}</b><div class="err">Could not read this video. Try a different clip.</div>`; }
    showGo();
  }
  function tips(s) {
    const t = document.getElementById('tip');
    if (s.codec === 'hevc' && !localStorage.getItem('jm.tip.hevc')) {
      localStorage.setItem('jm.tip.hevc', '1');
      t.innerHTML = `<div class="card"><b>Tip: make highlights about 10 times faster</b><p class="mu" style="margin:4px 0 0">This video is in iPhone's High Efficiency format, so each highlight takes 30 to 60 seconds to convert. Next time, film inside Jamoja, or set iPhone Settings, Camera, Formats to Most Compatible.</p></div>`;
    }
  }
  function drawSrc(card, s) {
    const n = s.moments.length, taps = s.moments.filter(m => m.src === 'tap').length;
    const msg = taps ? `${taps} play${taps > 1 ? 's' : ''} from your BUCKET taps.${n > taps ? ' Crowd-noise moments are listed too, unchecked.' : ''}`
      : n ? (s.quiet ? `Not much crowd noise in this clip, so these picks are rough. Check them with Preview, or scrub to a play and add it.` : `Found ${n} big moment${n > 1 ? 's' : ''}. Uncheck any you don't want.`)
      : s.hasAudio ? 'No big moments found. Scrub to a play and add it below.' : 'This clip has no sound. Scrub to a play and add it below.';
    card.innerHTML = `<div class="row" style="justify-content:space-between"><b>${esc(s.file.name)}</b><span class="mu">${mmss(s.dur)}</span></div>
      <video class="pv" src="${s.url}" playsinline controls preload="metadata"></video>
      <p class="mu" style="margin:0 0 4px">${msg}</p>
      <div class="moms">${s.moments.map((m, i) => `<div class="mom"><input type="checkbox" data-i="${i}" ${m.on ? 'checked' : ''} aria-label="Use moment ${i + 1}"><span><span class="tm">${mmss(m.start)} to ${mmss(m.end)}</span>${m.src === 'tap' ? ' <span class="chip" style="padding:2px 8px;font-size:12px">tap</span>' : ''}<br><button class="btn s g" data-pv="${i}" type="button">Preview</button></span><span class="row"><button class="btn s g" data-sh="${i}" data-d="-2" type="button" aria-label="Earlier">−2s</button><button class="btn s g" data-sh="${i}" data-d="2" type="button" aria-label="Later">+2s</button></span></div>`).join('')}</div>
      <button class="btn s g" data-add type="button" style="margin-top:10px">+ Add a play at the current spot</button>`;
    const vid = card.querySelector('video');
    let stopAt = 0; vid.ontimeupdate = () => { if (stopAt && vid.currentTime >= stopAt) { vid.pause(); stopAt = 0; } };
    card.onclick = ev => {
      const b = ev.target.closest('[data-pv],[data-sh],[data-add]'); if (!b) return;
      if (b.dataset.pv) { const m = s.moments[+b.dataset.pv]; vid.currentTime = m.start; stopAt = m.end; vid.play().catch(() => {}); }
      else if (b.dataset.sh) { const m = s.moments[+b.dataset.sh], d = +b.dataset.d; const len = m.end - m.start; m.start = Math.max(0, Math.min(Math.max(0, (s.dur || m.end) - len), m.start + d)); m.end = m.start + len; drawSrc(card, s); }
      else { const t = vid.currentTime; s.moments.push({ start: Math.max(0, t - 6), end: Math.min(s.dur || t + 2, t + 2), on: true, src: 'tap' }); s.moments.sort((a, b2) => a.start - b2.start); drawSrc(card, s); showGo(); }
    };
    card.onchange = ev => { const i = ev.target.dataset.i; if (i !== undefined) { s.moments[+i].on = ev.target.checked; showGo(); } };
  }
  async function useParts(parts) {
    for (const p of parts) { recParts.add(p.id); await addSource(new File([p.blob], p.name, { type: p.type }), p); }
  }
  const film = document.getElementById('film');
  if (film) film.onclick = async () => {
    const r = await R.record();
    if (!r) return;
    if (!r.parts.length) return toast('Nothing was recorded.');
    toast('Recording saved. Finding your plays…');
    await useParts(r.parts);
  };
  const rcv = document.getElementById('rcv');
  if (rcv) rcv.onclick = async () => { document.getElementById('recov').remove(); await useParts(saved); };
  const rdel = document.getElementById('rdel');
  if (rdel) rdel.onclick = async () => { if (!confirmIn(rdel)) return; await R.clearParts(saved.map(p => p.id)); document.getElementById('recov').remove(); toast('Recording deleted.'); };
  document.getElementById('fi').onchange = async e => { const files = [...e.target.files]; e.target.value = ''; for (const f of files) await addSource(f); };

  document.getElementById('mk').onclick = async () => {
    const jobs = srcs.flatMap(s => s.moments.filter(m => m.on).map(m => ({ s, m })));
    if (!jobs.length) return;
    const mk = document.getElementById('mk'); mk.disabled = true; mk.hidden = true;
    document.getElementById('prog').hidden = false;
    const pb = document.getElementById('pb'), pt = document.getElementById('pt');
    busy = true; R.keepAwake(true);
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
        pt.textContent = `Saving highlight ${k + 1} of ${jobs.length}…`;
        const key = `${ME.id}/${game.id}/${Date.now()}-${k}`;
        await storage.upload(key + '.mp4', c.video, 'video/mp4');
        await storage.upload(key + '.jpg', c.poster, 'image/jpeg');
        await highlights.add({ game_id: game.id, created_by: ME.id, label: 'Play ' + (already + k + 1), path: key + '.mp4', poster: key + '.jpg', dur_s: +c.dur.toFixed(2), start_s: +m.start.toFixed(2) });
        pb.style.width = ((k + 1) / jobs.length * 100) + '%';
      }
      for (const s of srcs) { await E.close(s); URL.revokeObjectURL(s.url); }
      await R.clearParts([...recParts]);
      busy = false; R.keepAwake(false);
      toast(`${jobs.length} highlight${jobs.length > 1 ? 's' : ''} ready.`);
      go('#/g/' + game.id + '?fresh=1');
    } catch (err) {
      console.error(err); busy = false; R.keepAwake(false);
      pt.innerHTML = `<span class="err" style="display:block">${esc(err.message)}. Your clips are still here. Try again.</span>`; mk.hidden = false; mk.disabled = false;
    }
  };
}

// ---------------- Game page: watch, tag, share, claim
async function gamePage(id) {
  const g = await games.get(id);
  if (!g) { V.innerHTML = `<h1>Game not found</h1><p class="mu">${LOCAL ? 'It may have been deleted from this phone.' : 'The link may be wrong, or the game was deleted.'}</p><a class="btn g" href="#/">Go home</a>`; return; }
  const want = qs().get('claim');
  if (want && ME && MYP) {
    let okc = false; try { okc = await players.claim(want); } catch (e) { okc = false; }
    toast(okc ? 'Your plays are claimed. They are on your profile now.' : 'That name was already claimed, or you already claimed one in this game.');
    history.replaceState(null, '', location.pathname + location.search + '#/g/' + id);
  }
  const [ps, hs] = await Promise.all([players.list(id), highlights.list(id)]);
  await storage.prep(hs.flatMap(h => [h.path, h.poster]));
  const own = ME && g.owner_id === ME.id;
  const link = shareBase() + '#/g/' + id;
  const pname = pid => { const p = ps.find(x => x.id === pid); return p ? (p.user ? p.user.name : p.label) : ''; };
  const myClaim = ME && ps.find(p => p.user_id === ME.id);
  const canFiles = !!(navigator.canShare && navigator.share);
  const shareCard = LOCAL
    ? `<div class="card"><b>Send the highlights</b><p class="mu" style="margin:4px 0 10px">Send the clips straight to the group chat, Instagram or anywhere. Share links that friends can open come when the Jamoja database is connected.</p>
        ${hs.length ? `<button class="btn w" id="sa">${canFiles ? 'Send all ' + hs.length + ' clips' : 'Save all clips'}</button>` : ''}</div>`
    : `<div class="card"><b>Share this game</b><div class="lnk"><input readonly value="${esc(link)}" aria-label="Game link" id="lk"><button class="btn s" id="cp">Copy</button></div>
      ${navigator.share ? `<button class="btn g w" id="sh" style="margin-top:8px">Send to the group chat</button>` : ''}</div>`;
  V.innerHTML = `<h1>${esc(g.title)}</h1><p class="mu">${esc(g.sport)}${g.place ? ' · ' + esc(g.place) : ''}${g.played_on ? ' · ' + esc(g.played_on) : ''}${g.owner ? ` · by <a href="#/u/${esc(g.owner.handle)}">${esc(g.owner.name)}</a>` : ''}</p>
    ${own && qs().get('fresh') ? `<div class="card" style="border-color:var(--o)"><b>${LOCAL ? 'Next: tag your crew, then send the clips.' : 'Next: tag your crew, then send the link.'}</b><p class="mu" style="margin:4px 0 0">Add each player below, then pick who is in each highlight and what the play was. Tagged plays get shared way more.</p></div>` : ''}
    ${shareCard}
    <h2>Players</h2>
    <div class="row" id="pl">${ps.map(p => `<span class="chip ${p.user_id ? 'ok' : ''}">${esc(p.label)}${p.user && !LOCAL ? ` · <a href="#/u/${esc(p.user.handle)}">@${esc(p.user.handle)}</a>` : p.user_id ? ' · you' : ''}${own && !p.user_id ? `<button data-rm="${p.id}" aria-label="Remove ${esc(p.label)}">×</button>` : ''}</span>`).join('') || '<span class="mu">No players tagged yet.</span>'}</div>
    ${own ? `<form id="af" class="row" style="margin-top:10px"><input class="t" id="an" placeholder="Name or shirt, like Jay or white shirt" style="flex:1"><button class="btn s">Add</button></form>` : ''}
    ${!myClaim && ps.some(p => !p.user_id) ? `<div class="card" style="margin-top:12px"><b>${LOCAL ? 'Which one is you?' : 'Are you in this game?'}</b><p class="mu" style="margin:4px 0 10px">Tap your name to put these plays on your profile.</p><div class="row">${ps.filter(p => !p.user_id).map(p => `<button class="btn s" data-claim="${p.id}">I'm ${esc(p.label)}</button>`).join('')}</div></div>` : ''}
    ${myClaim ? `<p class="mu" style="margin-top:10px">You are <b>${esc(myClaim.label)}</b> in this game. <button class="btn s g" data-release="${myClaim.id}">Not me</button></p>` : ''}
    <h2>Highlights</h2>
    ${hs.length ? `<div class="grid">${hs.map(h => `<div class="hl"><video data-hid="${h.id}" src="${esc(storage.url(h.path))}" poster="${esc(storage.url(h.poster))}" controls playsinline preload="none"></video><div class="b"><b>${esc(h.play_type || h.label)}</b><span class="mu">${h.player_id ? esc(pname(h.player_id)) : own ? 'Who is this?' : ''}${h.views ? ' · ' + views(h.views) : ''}</span>
      ${own ? `<select data-hp="${h.id}" aria-label="Player in ${esc(h.label)}"><option value="">Who is this?</option>${ps.map(p => `<option value="${p.id}" ${h.player_id === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select>
      <select data-pt="${h.id}" aria-label="Play type for ${esc(h.label)}"><option value="">What was the play?</option>${playsFor(g.sport).map(t => `<option ${h.play_type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` : ''}
      <div class="row" style="margin-top:6px">${LOCAL ? `<button class="btn s g" data-s1="${h.id}" style="flex:1">${canFiles ? 'Send' : 'Save'}</button>` : ''}${own ? `<button class="btn s g" data-hd="${h.id}" style="flex:1">Delete</button>` : ''}</div></div></div>`).join('')}</div>` : `<p class="mu">No highlights yet.</p>`}
    ${own ? `<div class="row" style="margin-top:16px"><a class="btn g" href="#/new?game=${id}">+ Add more clips</a><button class="btn g" id="dg">Delete game</button></div>` : ''}
    ${LOCAL ? '' : `<p class="foot">Want highlights from your games? <a href="#/login?mode=up">Create a free Jamoja account</a></p>`}`;
  const fileFor = async h => { const b = await storage.blob(h.path); return new File([b], `${g.title.replace(/[^\w]+/g, '-')}-${h.label.replace(/\s+/g, '-')}.mp4`, { type: 'video/mp4' }); };
  async function sendFiles(list) {
    const files = await Promise.all(list.map(fileFor));
    if (navigator.canShare && navigator.canShare({ files })) {
      try { await navigator.share({ files, title: g.title, text: `Highlights from ${g.title}. Filmed with Jamoja.` }); } catch (e) { /* cancelled */ }
      return;
    }
    for (const f of files) { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.append(a); a.click(); a.remove(); }
    toast('Saved. Check your downloads.');
  }
  const sa = document.getElementById('sa'); if (sa) sa.onclick = () => sendFiles(hs);
  const cp = document.getElementById('cp'), lk = document.getElementById('lk');
  if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Link copied. Drop it in the group chat.'); } catch (e) { lk.select(); toast('Press and hold the link to copy it.'); } };
  const sh = document.getElementById('sh'); if (sh) sh.onclick = () => navigator.share({ title: g.title + ' on Jamoja', text: 'Highlights from ' + g.title + '. Tap to watch and claim your plays.', url: link }).catch(() => {});
  const af = document.getElementById('af');
  if (af) af.onsubmit = async e => { e.preventDefault(); const v = document.getElementById('an').value.trim(); if (!v) return; await players.add(id, v.slice(0, 40)); gamePage(id); };
  V.onclick = async ev => {
    const b = ev.target.closest('[data-rm],[data-claim],[data-release],[data-hd],[data-s1],#dg'); if (!b) return;
    try {
      if (b.dataset.rm) { await players.remove(b.dataset.rm); gamePage(id); }
      else if (b.dataset.s1) { await sendFiles([hs.find(x => x.id === b.dataset.s1)]); }
      else if (b.dataset.claim) {
        if (!ME) return needLogin('#/g/' + id + '?claim=' + b.dataset.claim);
        const okc = await players.claim(b.dataset.claim);
        toast(okc ? 'These plays are now on your profile.' : 'Someone already claimed that one.'); gamePage(id);
      }
      else if (b.dataset.release) { await players.release(b.dataset.release); toast('Removed from your profile.'); gamePage(id); }
      else if (b.dataset.hd) { if (!confirmIn(b)) return; const h = hs.find(x => x.id === b.dataset.hd); await highlights.remove(h.id); await storage.remove([h.path, h.poster]); gamePage(id); }
      else if (b.id === 'dg') { if (!confirmIn(b)) return; await storage.remove(hs.flatMap(h => [h.path, h.poster])); await games.remove(id); toast('Game deleted.'); go('#/'); }
    } catch (err) { toast(err.message); }
  };
  countViews(V);
  V.onchange = async ev => {
    const s = ev.target.closest('[data-hp]'), t = ev.target.closest('[data-pt]');
    try {
      if (s) { await highlights.update(s.dataset.hp, { player_id: s.value || null }); toast('Tagged.'); gamePage(id); }
      else if (t) { await highlights.update(t.dataset.pt, { play_type: t.value || null }); toast('Saved.'); gamePage(id); }
    } catch (err) { toast(err.message); }
  };
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
  await storage.prep(hs.flatMap(h => [h.path, h.poster]));
  const link = shareBase() + '#/u/' + encodeURIComponent(p.handle);
  V.innerHTML = `<div class="row" style="gap:14px"><div class="av">${esc(ini(p.name))}</div><div><h1 style="margin:0">${esc(p.name)}</h1><p class="mu" style="margin:0">@${esc(p.handle)} · ${esc(p.sport || '')}${p.position ? ' · ' + esc(p.position) : ''}${p.city ? ' · ' + esc(p.city) : ''}</p></div></div>
    <div class="row" style="margin-top:14px">${LOCAL ? '' : `<button class="btn s" id="cp">Copy profile link</button>`}${me ? `<a class="btn s g" href="#/setup?next=${encodeURIComponent('#/u/' + p.handle)}">Edit profile</a>${LOCAL ? '' : `<button class="btn s g" id="so">Sign out</button>`}` : ''}</div>
    ${hs.length ? `<div class="row stats"><div><b>${hs.length}</b><span>Plays</span></div><div><b>${hs.reduce((a, h) => a + (h.views || 0), 0)}</b><span>Views</span></div><div><b>${made.length}</b><span>Games filmed</span></div></div>` : ''}
    <h2>${me ? 'Your plays' : 'Plays'}</h2>${hs.length ? `<div class="grid">${hs.map(h => `<div class="hl"><video data-hid="${h.id}" src="${esc(storage.url(h.path))}" poster="${esc(storage.url(h.poster))}" controls playsinline preload="none"></video><div class="b"><b>${esc(h.play_type || h.label)}</b>${h.views ? `<span class="mu">${views(h.views)}</span>` : ''}<a class="mu" href="#/g/${h.game_id}">${esc(h.game ? h.game.title : 'Game')}</a></div></div>`).join('')}</div>` : `<p class="mu">${me ? 'In a game, tap "I\'m …" on your name and your plays show up here.' : 'No highlights yet.'}</p>`}
    <h2>Games filmed</h2>${made.length ? gameList(made) : `<p class="mu">None yet.</p>`}
    ${LOCAL && me ? `<p class="foot">Everything is saved on this phone. Clearing your browser data deletes it.</p>` : ''}`;
  const cp = document.getElementById('cp'); if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Profile link copied.'); } catch (e) { toast(link); } };
  countViews(V);
  const so = document.getElementById('so'); if (so) so.onclick = async () => { await auth.signOut(); toast('Signed out.'); go('#/'); };
}

route();
