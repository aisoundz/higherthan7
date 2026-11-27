import * as E from './engine.js?v=20261127zb';
import * as R from './rec.js?v=20261127zb';
import { auth, profiles, games, players, highlights, fires, posts, postFires, follows, comments, profileViews, notes, pushSubs, dms, blocks, rsvps, live, nextUp, events, stories, ratings, storage, mode, ready } from './db.js?v=20261127zb';
const LEVELS = ['Recreation', 'High school', 'College', 'Pro'];
const LV = { Recreation: 'REC', 'High school': 'HS', College: 'COLLEGE', Pro: 'PRO' };
const lvBadge = p => p && p.level ? `<span class="lv">${LV[p.level]}</span>` : '';
const avUrl = p => p && p.avatar ? storage.url(p.avatar) : '';
const avatar = (p, px = 40) => avUrl(p) ? `<img class="avi" src="${esc(avUrl(p))}" alt="" style="width:${px}px;height:${px}px">` : `<span class="avi" style="width:${px}px;height:${px}px;font-size:${Math.round(px * 0.42)}px">${esc(ini(p && p.name))}</span>`;
const ago = t => { const s2 = (Date.now() - new Date(t)) / 1000; return s2 < 60 ? 'now' : s2 < 3600 ? Math.floor(s2 / 60) + 'm' : s2 < 86400 ? Math.floor(s2 / 3600) + 'h' : s2 < 604800 ? Math.floor(s2 / 86400) + 'd' : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
const ytId = u => { const m = /(?:youtu\.be\/|[?&]v=|\/(?:live|shorts|embed)\/)([A-Za-z0-9_-]{11})/.exec(u || ''); return m ? m[1] : null; };
const nl = t => esc(t).replace(/\n/g, '<br>');
// Shrink a photo to a JPEG (max side px) before upload.
async function toJpeg(file, max = 1440) {
  let img;
  try { img = await createImageBitmap(file); } catch (e) { img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read that photo. Try another one.')); i.src = URL.createObjectURL(file); }); }
  const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(b => b.arrayBuffer().then(a => r(new Uint8Array(a))), 'image/jpeg', 0.85));
}
const APP_V = '20261127zb';
// If the phone kept an older copy of the page, reload once to get everything matching.
if (window.JM_V !== APP_V) { try { if (sessionStorage.getItem('jm.rl') !== APP_V) { sessionStorage.setItem('jm.rl', APP_V); location.replace(location.pathname + '?v=' + Date.now() + location.hash); } } catch (e) { /* private mode */ } }
const PLAYS = {
  Basketball: ['Bucket', 'Jumper', 'Three', 'Layup', 'Drive', 'And-one', 'Dunk', 'Putback', 'Rebound', 'Dime', 'Block', 'Steal', 'Ankle breaker', 'Game winner'],
  Soccer: ['Goal', 'Assist', 'Skill move', 'Nutmeg', 'Save', 'Tackle'],
  'Flag football': ['Touchdown', 'Catch', 'Pick', 'Big run', 'Flag pull'],
  Football: ['Touchdown', 'Catch', 'Pick', 'Big run', 'Sack', 'Big hit'],
  Volleyball: ['Kill', 'Ace', 'Block', 'Dig', 'Set'],
  Baseball: ['Home run', 'Hit', 'Strikeout', 'Diving catch', 'Double play'],
  Softball: ['Home run', 'Hit', 'Strikeout', 'Diving catch', 'Double play'],
  Track: ['Finish', 'Start', 'PR'],
  Tennis: ['Ace', 'Winner', 'Rally'],
  Training: ['Workout', 'PR', 'Conditioning', 'Agility', 'Mobility', 'Before and after'],
  Weightlifting: ['PR', 'Squat', 'Bench', 'Deadlift', 'Clean', 'Snatch', 'Overhead press'],
  CrossFit: ['WOD', 'PR', 'Muscle-up', 'Pull-ups', 'Box jumps', 'Burpees'],
  Running: ['PR', 'Long run', 'Sprint', 'Race finish', 'Trail run'],
  Boxing: ['Combo', 'Mitt work', 'Bag work', 'Sparring', 'Knockout'],
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
    v.addEventListener('play', () => { const id = v.dataset.hid, k = 'jm.v.' + id; let seen = 0; try { seen = +localStorage.getItem(k) || 0; } catch (e) { /* private mode */ } if (Date.now() - seen < 864e5) return; t = setTimeout(() => { try { localStorage.setItem(k, String(Date.now())); } catch (e) { /* private mode */ } highlights.view(id).catch(() => {}); }, 2000); });
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
const track = (n, p) => events.log(n, p);
window.jmTrack = track; // rec.js uses this
// Count shares wherever they happen.
if (navigator.share) { const _share = navigator.share.bind(navigator); navigator.share = d => { const r = (location.hash.split('?')[0].split('/')[1]) || 'home'; track(d && d.files ? 'share_clip' : r === 'p' ? 'share_post' : r === 'u' ? 'share_profile' : r === 'g' ? 'share_run' : 'share_link', { route: r }); return _share(d); }; }
// One "app_open" per phone per day (plus whether it runs from the Home Screen).
function trackOpen() { try { const k = 'jm.open', d = new Date().toDateString(); if (localStorage.getItem(k) === d + (ME ? ME.id : '')) return; localStorage.setItem(k, d + (ME ? ME.id : '')); } catch (e) { /* private mode */ } track('app_open', { standalone: !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches) || !!navigator.standalone }); }
let ME = null, MYP = null;
const POS = { Basketball: 'Point guard', Soccer: 'Striker', 'Flag football': 'Wide receiver', Volleyball: 'Outside hitter', Football: 'Linebacker', Baseball: 'Shortstop', Softball: 'Pitcher', Track: '100m and 200m', Tennis: 'Singles', Training: 'Strength and conditioning', Weightlifting: 'Powerlifting, 93kg', CrossFit: 'Rx', Running: '5K, 10K, marathon', Boxing: 'Welterweight', Other: '' };
const SPORTS = ['Basketball', 'Football', 'Soccer', 'Training', 'Weightlifting', 'CrossFit', 'Running', 'Baseball', 'Softball', 'Volleyball', 'Flag football', 'Track', 'Tennis', 'Boxing', 'Other'];
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
let BDG_T = null;
async function refreshBadge() {
  const b = document.getElementById('bdg'); if (!b || !ME || LOCAL) return;
  try { const [n, d] = await Promise.all([notes.unread(ME.id), dms.unread(ME.id).catch(() => 0)]); b.hidden = !d; b.textContent = d > 9 ? '9+' : d; const nd = document.getElementById('ndot'); if (nd) { nd.hidden = !n; nd.textContent = n > 99 ? '99+' : n; } document.title = (n + d ? `(${n + d}) ` : '') + 'Jamoja'; } catch (e) { /* offline */ }
}
function topbar() {
  clearInterval(BDG_T); if (ME && !LOCAL) { setTimeout(refreshBadge, 50); BDG_T = setInterval(refreshBadge, 60000); }
  TR.innerHTML = ME
    ? (MYP ? `<a class="bell" href="#/inbox" aria-label="Messages"><svg viewBox="0 0 24 24"><path d="M21.5 3.5 10.5 13.5M21.5 3.5l-7 18-4-8-8-4z"/></svg><span class="bdg" id="bdg" hidden></span></a><a href="#/u/${esc(MYP.handle)}" aria-label="My profile" style="display:flex">${avatar(MYP, 38)}</a>` : '')
    : LOCAL ? '' : `<a class="btn s g" href="#/login">Sign in</a>`;
  const nav = document.getElementById('nav'); if (!nav) return;
  const h = location.hash || '#/';
  nav.hidden = !(ME && MYP) || /^#\/(login|setup|dm\/)/.test(h);
  if (!nav.hidden) {
    const mine = h.startsWith('#/u/' + encodeURIComponent(MYP.handle)) || h.startsWith('#/u/' + MYP.handle) || h.startsWith('#/viewers') || h.startsWith('#/setup');
    const on = { feed: h === '#/' || h === '#' || h === '' || h.startsWith('#/p/'), people: h.startsWith('#/people'), post: /^#\/(post|new)/.test(h), alerts: h.startsWith('#/alerts'), me: mine };
    const I = {
      feed: f => `<svg viewBox="0 0 24 24" class="${f ? 'fill' : ''}"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>`,
      people: f => `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" ${f ? 'stroke-width="3"' : ''}/><path d="m20.5 20.5-4.5-4.5" ${f ? 'stroke-width="3"' : ''}/></svg>`,
      post: f => `<svg viewBox="0 0 24 24" class="${f ? 'fill' : ''}"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M12 8v8M8 12h8" class="pl"/></svg>`,
      alerts: f => `<svg viewBox="0 0 24 24" class="${f ? 'fill' : ''}"><path d="M12 20.5s-8-4.6-8-10.4A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 8 2.5c0 5.8-8 10.4-8 10.4z"/></svg>`,
    };
    nav.innerHTML = `<a href="#/" class="${on.feed ? 'on' : ''}">${I.feed(on.feed)}<small>Home</small></a><a href="#/people" class="${on.people ? 'on' : ''}">${I.people(on.people)}<small>People</small></a><a href="#/post" class="plus ${on.post ? 'on' : ''}" aria-label="Post"><span>+</span></a><a href="#/alerts" class="${on.alerts ? 'on' : ''}">${I.alerts(on.alerts)}<i class="ndot" id="ndot" hidden></i><small>Activity</small></a><a href="#/u/${esc(MYP.handle)}" class="me ${on.me ? 'on' : ''}">${avatar(MYP, 28)}<small>Profile</small></a>`;
  }
}
function needLogin(next) { go(LOCAL ? '#/setup?next=' + encodeURIComponent(next || '#/') : '#/login?next=' + encodeURIComponent(next || location.hash)); }

let ROUTE_N = 0;
async function route() {
  if (busy) { toast('Still cutting highlights. Stay on this screen until it finishes.'); return; }
  window.scrollTo(0, 0);
  const tok = ++ROUTE_N;
  const [path] = location.hash.slice(1).split('?');
  const parts = (path || '/').split('/').filter(Boolean);
  try {
    await ready;
    await refreshMe();
    if (LINK_ERR && !route.linkErr) { route.linkErr = 1; history.replaceState(null, '', location.pathname + location.search + '#/login?expired=1'); return route(); }
    if (RECOVERY) { RECOVERY = false; history.replaceState(null, '', location.pathname + location.search + '#/reset'); return route(); }
    if (/access_token=/.test(location.hash)) { history.replaceState(null, '', location.pathname + location.search + '#/'); return route(); }
    if (ME && !MYP && parts[0] !== 'setup' && parts[0] !== 'login' && parts[0] !== 'reset') return go('#/setup?next=' + encodeURIComponent(location.hash || '#/'));
    topbar(); trackOpen();
    if (parts[0] === 'stats') return await statsPage();
    if (!parts.length) return await home();
    if (parts[0] === 'login') { TR.innerHTML = ''; return LOCAL ? go('#/') : await login(); }
    if (parts[0] === 'setup') return setup();
    if (parts[0] === 'reset') return resetPage();
    if (parts[0] === 'new') return await newGame();
    if (parts[0] === 'post') return await composer();
    if (parts[0] === 'p' && parts[1]) return await postPage(parts[1]);
    if (parts[0] === 'g' && parts[1]) return await gamePage(parts[1]);
    if (parts[0] === 'u' && parts[1] && (parts[2] === 'followers' || parts[2] === 'following')) return await followPage(decodeURIComponent(parts[1]), parts[2]);
    if (parts[0] === 'u' && parts[1]) return await profilePage(decodeURIComponent(parts[1]));
    if (parts[0] === 'court' && parts[1]) return await courtPage(decodeURIComponent(parts[1]));
    if (parts[0] === 'people') return await peoplePage();
    if (parts[0] === 'viewers') return await viewersPage();
    if (parts[0] === 'alerts') return await alertsPage();
    if (parts[0] === 'inbox') return await inboxPage();
    if (parts[0] === 'dm' && parts[1]) return await dmPage(decodeURIComponent(parts[1]));
    V.innerHTML = `<h1>Not found</h1><a class="btn" href="#/">Go home</a>`;
  } catch (e) {
    console.error(e);
    if (tok !== ROUTE_N) return; // an old screen failed after you moved on: leave the current one alone
    V.innerHTML = `<h1>Something went wrong</h1><div class="err">${esc(e.message)}</div><a class="btn g" href="#/">Go home</a>`;
  }
}
window.addEventListener('hashchange', route);
auth.onChange(ev => { if (ev === 'PASSWORD_RECOVERY') { RECOVERY = false; go('#/reset'); return; } refreshMe().then(topbar); });

const gameList = list => `<div class="list">${list.map(g => `<a href="#/g/${g.id}"><span><b>${esc(g.title)}</b><br><span class="mu">${esc(g.sport)}${g.place ? ' · ' + esc(g.place) : ''}</span></span><span class="mu">${esc(g.starts_at ? whenLabel(g.starts_at) : g.played_on ? new Date(g.played_on + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '')}</span></a>`).join('')}</div>`;

// ---------------- Home: the social feed
let FEED_SPORT = '', FEED_TAB = 'all';
async function home() {
  const parts = ME ? await R.savedParts() : [];
  const top = !ME
    ? `${inAppCard()}<section class="hero"><h1>Where athletes get seen.</h1><p>The social network for athletes and everyone who trains. Hoopers, lifters, runners, CrossFit. Post your work, film your games, and Jamoja cuts the highlights for you.</p>
      <div class="row"><a class="btn" href="#/login?mode=up">Create free account</a><a class="btn g" href="#/login">Sign in</a></div></section>`
    : `${parts.length ? `<div class="card" id="savedrec" style="border-color:var(--o)"><b>Your recording is saved</b><br><span class="mu">${mmss(parts.reduce((x, p) => x + (p.dur || 0), 0))} of video on this phone${parts.reduce((x, p) => x + (p.marks || []).length, 0) ? `, ${parts.reduce((x, p) => x + (p.marks || []).length, 0)} plays marked` : ''}. Turn it into highlights, or delete it.</span><div class="row" style="margin-top:10px"><a class="btn s" href="#/new?auto=1">Make highlights</a><button class="btn s g" id="delrec">Delete</button></div></div>` : ''}
      <a class="card compose" href="#/post">${avatar(MYP, 40)}<span class="mu">What's up, ${esc((MYP.name || '').split(' ')[0])}? Post a play, a workout, a run…</span><span class="ic">📷</span></a>`;
  V.innerHTML = `<div id="strail"></div><div id="potw"></div>${top}<div id="rail"></div>${ME ? `<div class="tabs" role="tablist"><button role="tab" data-tab="all" class="${FEED_TAB === 'all' ? 'on' : ''}">For You</button><button role="tab" data-tab="following" class="${FEED_TAB === 'following' ? 'on' : ''}">Following</button></div>` : ''}
    <div class="row sports" id="sp">${['All', ...SPORTS].map(x => `<button class="chip ${(x === 'All' ? '' : x) === FEED_SPORT ? 'on' : ''}" data-sp="${x === 'All' ? '' : esc(x)}">${esc(x)}</button>`).join('')}</div>
    <div id="feed"><p class="mu">Loading…</p></div>
    ${ME && !LOCAL ? '<div id="mine"></div>' : ''}<p class="foot">Jamoja beta${LOCAL ? ' · saved on this phone' : mode === 'mock' ? ' · test mode' : ''}. 18 and older during testing.</p>`;
  const dr = V.querySelector('#delrec'); if (dr) dr.onclick = async () => { if (!confirmIn(dr)) return; await R.clearParts(parts.map(p => p.id)); V.querySelector('#savedrec').remove(); toast('Recording deleted.'); };
  V.querySelector('#sp').onclick = e => { const b = e.target.closest('[data-sp]'); if (!b) return; FEED_SPORT = b.dataset.sp; home(); };
  storyRail(V.querySelector('#strail')); potw(V.querySelector('#potw'));
  const railEl = V.querySelector('#rail');
  const fillRail = () => runsRail().then(h => { if (railEl.isConnected) railEl.innerHTML = h; }).catch(() => {});
  fillRail(); clearInterval(window.RAIL_T); window.RAIL_T = setInterval(() => { if (railEl.isConnected) fillRail(); else clearInterval(window.RAIL_T); }, 20000);
  const tabsEl = V.querySelector('.tabs');
  if (ME && tabsEl && FEED_TAB === 'all' && !FEED_SPORT) {
    const extra = (await recapCard().catch(() => '')) + installCard();
    // The screen may have changed while the recap loaded: only add it if Home is still showing.
    if (extra && tabsEl.isConnected) { tabsEl.insertAdjacentHTML('beforebegin', extra); bindInstall(); }
  }
  const tabs = V.querySelector('.tabs'); if (tabs) tabs.onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; FEED_TAB = b.dataset.tab; home(); };
  await drawFeed();
  if (ME && !LOCAL) drawMine();
}
async function drawFeed() {
  const box = document.getElementById('feed');
  let fol = [];
  try { fol = ME ? await follows.ids(ME.id) : []; } catch (e) { fol = []; }
  const ids = ME && FEED_TAB === 'following' ? [...fol, ME.id] : null;
  let hl = [], ps = [];
  try { [hl, ps] = await Promise.all([highlights.feed(FEED_SPORT, 30, ids), posts.feed(FEED_SPORT, 30, ids)]); }
  catch (e) { console.error(e); box.innerHTML = `<div class="err">Could not load the feed. Pull down to refresh.</div>`; return; }
  const items = [...hl.map(h => ({ t: 'h', at: h.created_at, h })), ...ps.map(x => ({ t: 'p', at: x.created_at, x }))].sort((a, b) => a.at < b.at ? 1 : -1).slice(0, 40);
  const pinned = !FEED_SPORT && FEED_TAB === 'all' && items.length < 3 ? `<article class="post"><div class="pin">Pinned · Welcome to Jamoja</div><video src="../reel.mp4" poster="../poster.jpg" playsinline muted loop preload="metadata"></video><div class="meta"><b>Anis Taylor</b><span class="mu">Founder · Basketball · Anaheim. Built by an athlete, for athletes.</span><a class="mu" href="../profile/">See a full player profile</a></div></article>` : '';
  const empty = FEED_TAB === 'following' && !fol.length && !items.length;
  let sugg = '';
  if (ME && (empty || fol.length < 3)) {
    const people = (await follows.suggested(ME.id).catch(() => [])).filter(p => !fol.includes(p.id)).slice(0, 8);
    if (people.length) sugg = `<div class="card"><b>People to follow</b><div class="people">${people.map(p => `<div class="person"><a href="#/u/${esc(p.handle)}">${avatar(p, 56)}<b>${esc((p.name || '').split(' ')[0])}</b><span class="mu">${esc(p.sport || '')}</span></a><button class="btn s" data-follow="${p.id}">Follow</button></div>`).join('')}</div></div>`;
  }
  const invite = ME && FEED_TAB === 'following' && !fol.length && !sugg ? `<div class="card" style="border-color:var(--o)"><b>Bring your crew</b><p class="mu" style="margin:4px 0 10px">Follow the people you play with and their posts and plays land here. Send them the invite.</p><button class="btn s" id="inv">Invite friends</button></div>` : '';
  const filt = FEED_SPORT ? `<p class="mu" style="margin:0 0 10px">Showing ${esc(FEED_SPORT)} only. <a href="#" id="clr">Show all sports</a></p>` : '';
  box.innerHTML = filt + (empty && !invite ? `<div class="card"><b>Follow athletes to fill this tab.</b><p class="mu" style="margin:4px 0 0">Their posts and plays show up here.</p></div>` : '') + invite + sugg;
  const clr = box.querySelector('#clr'); if (clr) clr.onclick = e => { e.preventDefault(); FEED_SPORT = ''; home(); };
  const inv = box.querySelector('#inv'); if (inv) inv.onclick = () => { const url = shareBase() + '#/u/' + encodeURIComponent(MYP.handle); const text = `I'm on Jamoja, the new app for athletes. Follow me and post your plays: `; if (navigator.share) navigator.share({ title: 'Join me on Jamoja', text, url }).catch(() => {}); else navigator.clipboard.writeText(text + url).then(() => toast('Invite copied. Paste it in the group chat.'), () => toast(url)); };
  const list = document.createElement('div'); box.append(list);
  await renderItems(list, items, { empty: empty || invite ? '' : `<div class="card"><b>${FEED_SPORT ? 'No ' + esc(FEED_SPORT) + ' posts yet.' : 'Nothing here yet.'}</b><p class="mu" style="margin:4px 0 10px">Post something or film your next run.</p>${ME ? `<a class="btn s" href="#/post">Post</a>` : `<a class="btn s" href="#/login?mode=up">Create free account</a>`}</div>`, fol });
  if (pinned) box.insertAdjacentHTML('beforeend', pinned);
  box.querySelectorAll('.pin ~ video').forEach(v => playWhenSeen(v));
  bindFollow(box, fol);
}
// One feed video decodes at a time. iPhones run out of video decoders when every card holds a loaded <video>, and the extra cards paint black.
// Cards keep only their poster; the card in view gets its source, and a card that scrolls away gives it back.
function vOn(v) { if (!v.getAttribute('src') && v.dataset.src) { v.src = v.dataset.src; } v.play().catch(() => {}); }
function vOff(v) { v.pause(); if (v.dataset.src && v.getAttribute('src')) { v.removeAttribute('src'); v.load(); } }
const IO = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => { const v = en.target; if (en.isIntersecting) vOn(v); else vOff(v); }), { threshold: 0.6 }) : null;
function playWhenSeen(v) { if (v.getAttribute('src') && !v.dataset.src) { v.dataset.src = v.getAttribute('src'); v.removeAttribute('src'); v.preload = 'none'; v.load(); } if (IO) IO.observe(v); else vOn(v); v.onclick = () => { const art = v.closest('article'); const capEl = art && art.querySelector('.meta, .pb'); const src = v.dataset.src || v.currentSrc || v.src; openViewer({ video: src, poster: v.poster, hid: v.dataset.hid, start: v.getAttribute('src') ? v.currentTime : 0, cap: capEl ? capEl.innerHTML : '', ck: v.dataset.hid ? 'highlight' : art && art.dataset.pid ? 'post' : '', cid: v.dataset.hid || (art && art.dataset.pid) }); v.pause(); }; }
function bindFollow(root, fol) {
  if (root._fh) root.removeEventListener('click', root._fh);
  root.addEventListener('click', root._fh = async e => {
    const b = e.target.closest('[data-follow]'); if (!b) return;
    if (!ME) return needLogin(location.hash || '#/');
    const id = b.dataset.follow, on = !fol.includes(id);
    try {
      await follows.toggle(ME.id, id, on);
      if (on) fol.push(id); else fol.splice(fol.indexOf(id), 1);
      document.querySelectorAll(`[data-follow="${id}"]`).forEach(x => { x.textContent = on ? 'Following' : 'Follow'; x.classList.toggle('g', on); });
      toast(on ? 'Following. Their posts show up in your Following tab.' : 'Unfollowed.');
    } catch (err) { toast(err.message); }
  });
}
// Draw a mixed list of posts ({t:'p', x}) and highlights ({t:'h', h}).
async function renderItems(box, items, opt = {}) {
  const hs = items.filter(i => i.t === 'h').map(i => i.h), ps = items.filter(i => i.t === 'p').map(i => i.x);
  await storage.prep([...hs.flatMap(h => [h.path, h.poster]), ...ps.flatMap(x => [x.media, x.poster, x.user && x.user.avatar])].filter(Boolean));
  const [lit, plit, cch, ccp] = await Promise.all([
    fires.mine(ME && ME.id, hs.map(h => h.id)).catch(() => new Set()), postFires.mine(ME && ME.id, ps.map(x => x.id)).catch(() => new Set()),
    comments.counts('highlight', hs.map(h => h.id)).catch(() => ({})), comments.counts('post', ps.map(x => x.id)).catch(() => ({}))]);
  const fol = opt.fol || [];
  const folBtn = u => ME && u && u.id !== ME.id && !opt.noFollow ? `<button class="btn s ${fol.includes(u.id) ? 'g' : ''} fb" data-follow="${u.id}">${fol.includes(u.id) ? 'Following' : 'Follow'}</button>` : '';
  const who = h => h.player ? (h.player.user ? `<a href="#/u/${esc(h.player.user.handle)}">@${esc(h.player.user.handle)}</a>` : esc(h.player.label)) : '';
  const whoName = h => h.player ? (h.player.user ? '@' + h.player.user.handle : h.player.label) : '';
  const hCard = h => `<article class="post" data-id="${h.id}"><video data-hid="${h.id}" data-src="${esc(storage.url(h.path))}" poster="${esc(storage.url(h.poster))}" style="background-image:url('${esc(storage.url(h.poster))}')" playsinline muted loop preload="none"></video>
    <div class="side"><button class="fire ${lit.has(h.id) ? 'on' : ''}" data-fire="${h.id}" aria-label="Fire"><span>🔥</span><b>${h.fire || 0}</b></button><button class="fire" data-cm="h:${h.id}" aria-label="Comments"><span>💬</span><b>${cch[h.id] || 0}</b></button><button class="fire" data-share="${h.id}" aria-label="Share"><span>↗</span><b>Share</b></button><button class="fire" data-more="h:${h.id}" aria-label="More"><span>⋯</span><b></b></button></div>
    <div class="meta">${h.play_type ? `<span class="cap">${esc(h.play_type)}</span>` : ''}<b>${who(h) || (h.game.owner && MYP && h.game.owner.handle === MYP.handle ? `<a href="#/g/${h.game_id}">Who is this? Tag them</a>` : 'Who is this?')}</b><a href="#/g/${h.game_id}">${esc(h.game.title)}</a><span class="mu">${esc(h.game.sport)}${h.game.place ? ' · 📍 ' + courtLink(h.game.place) : ''}${h.game.owner ? ` · filmed by <a href="#/u/${esc(h.game.owner.handle)}">@${esc(h.game.owner.handle)}</a>` : ''}${h.views ? ' · ' + views(h.views) : ''}</span>${!h.player ? `<a class="mu" href="#/g/${h.game_id}">In this play? Claim it</a>` : ''}</div></article>`;
  const media = x => x.kind === 'photo' ? `<img class="pm" src="${esc(storage.url(x.media))}" alt="" loading="lazy">`
    : x.kind === 'video' ? `<video class="pm" data-pv="1" data-src="${esc(storage.url(x.media))}" poster="${esc(storage.url(x.poster))}" style="background-image:url('${esc(storage.url(x.poster))}')" playsinline muted loop preload="none"></video>`
    : x.kind === 'youtube' ? `<button class="yt" data-yt="${esc(x.youtube_id)}" aria-label="Play YouTube video"><img src="https://i.ytimg.com/vi/${esc(x.youtube_id)}/hqdefault.jpg" alt="" loading="lazy"><span>▶</span></button>` : '';
  const pCard = x => `<article class="card pst" data-pid="${x.id}"><div class="ph"><a href="#/u/${esc(x.user ? x.user.handle : '')}" class="pu">${avatar(x.user, 40)}<span><b>${esc(x.user ? x.user.name : '')}</b> ${lvBadge(x.user)}<br><span class="mu">@${esc(x.user ? x.user.handle : '')} · ${ago(x.created_at)}${x.sport ? ' · ' + esc(x.sport) : ''}</span></span></a>${folBtn(x.user)}</div>
    ${x.body ? `<p class="pb">${nl(x.body)}</p>` : ''}${media(x)}
    <div class="acts"><button class="fire ${plit.has(x.id) ? 'on' : ''}" data-pfire="${x.id}"><span>🔥</span><b>${x.fire || 0}</b></button><button class="fire" data-cm="p:${x.id}"><span>💬</span><b>${ccp[x.id] || 0}</b></button><button class="fire" data-pshare="${x.id}"><span>↗</span><b>Share</b></button><button class="fire" data-more="p:${x.id}"><span>⋯</span><b></b></button></div></article>`;
  box.innerHTML = items.length ? items.map(i => i.t === 'h' ? hCard(i.h) : pCard(i.x)).join('') : (opt.empty || '');
  box.querySelectorAll('.post video, video[data-pv]').forEach(playWhenSeen);
  countViews(box);
  box.onclick = async e => {
    const q = sel => e.target.closest(sel);
    const f = q('[data-fire]'), pf = q('[data-pfire]'), sh = q('[data-share]'), psh = q('[data-pshare]'), mo = q('[data-more]'), rp = q('[data-rep]'), cm = q('[data-cm]'), yt = q('[data-yt]'), del = q('[data-pdel]');
    const im = e.target.closest('img.pm'); if (im) { openViewer({ img: im.src }); return; }
    if (yt) { yt.outerHTML = `<iframe class="pm ytf" src="https://www.youtube-nocookie.com/embed/${esc(yt.dataset.yt)}?autoplay=1&playsinline=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="YouTube video"></iframe>`; return; }
    if (f || pf) {
      if (!ME) return needLogin('#/');
      const el = f || pf, on = !el.classList.contains('on'), n = el.querySelector('b');
      el.classList.toggle('on', on); n.textContent = (+n.textContent || 0) + (on ? 1 : -1);
      try { if (f) await fires.toggle(f.dataset.fire, ME.id, on); else await postFires.toggle(pf.dataset.pfire, ME.id, on); }
      catch (err) { el.classList.toggle('on', !on); n.textContent = (+n.textContent || 0) + (on ? -1 : 1); toast(err.message); }
      return;
    }
    if (sh) { const h = hs.find(x => x.id === sh.dataset.share); shareClip(h, whoName(h), shareBase() + '#/g/' + h.game_id).catch(err => toast(err.message)); return; }
    if (psh) { const url = shareBase() + '#/p/' + psh.dataset.pshare; if (navigator.share) navigator.share({ title: 'Jamoja', text: 'Check this on Jamoja.', url }).catch(() => {}); else { navigator.clipboard.writeText(url).then(() => toast('Link copied.'), () => toast(url)); } return; }
    if (mo) {
      const art = mo.closest('article'); const open = art.nextElementSibling && art.nextElementSibling.classList.contains('rep');
      box.querySelectorAll('.rep').forEach(x => x.remove()); if (open) return;
      const [kind, id] = mo.dataset.more.split(':');
      const mine = kind === 'p' && ME && (ps.find(x => x.id === id) || {}).user_id === ME.id;
      const px = ps.find(y => y.id === id);
      art.insertAdjacentHTML('afterend', mine ? `<div class="card rep"><div class="row">${px && px.kind === 'video' ? `<button class="btn s g" data-pcov="${id}">Change cover</button>` : ''}<button class="btn s g" data-pdel="${id}">Delete this post</button></div></div>`
        : `<div class="card rep"><b>Report this</b><p class="mu" style="margin:4px 0 10px">Two reports take it off the feed until we review it.</p><div class="row">${["I'm in it and want it removed", 'Inappropriate', 'Not real', 'Spam'].map(r => `<button class="btn s g" data-rep="${kind}:${id}" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div></div>`);
      return;
    }
    const pcov = q('[data-pcov]');
    if (pcov) { const x = ps.find(y => y.id === pcov.dataset.pcov); if (x) changeCover(x, () => { const pv = box.querySelector(`[data-pid="${x.id}"] video`); if (pv) pv.poster = storage.url(x.poster); pcov.closest('.rep').remove(); }); return; }
    if (del) { if (!confirmIn(del)) return; try { const x = ps.find(y => y.id === del.dataset.pdel); await posts.remove(x.id); if (x.media) await storage.remove([x.media, x.poster].filter(Boolean)); del.closest('.rep').previousElementSibling.remove(); del.closest('.rep').remove(); toast('Post deleted.'); } catch (err) { toast(err.message); } return; }
    if (rp) {
      if (!ME) return needLogin('#/');
      const [kind, id] = rp.dataset.rep.split(':');
      try { if (kind === 'h') await highlights.report(id, rp.dataset.r); else await posts.report(id, rp.dataset.r); rp.closest('.rep').innerHTML = `<b>Thanks. We got your report.</b>`; } catch (err) { toast(err.message); }
      return;
    }
    if (cm) { const art = cm.closest('article'); const [kind, id] = cm.dataset.cm.split(':'); openComments(art, kind === 'p' ? 'post' : 'highlight', id, cm.querySelector('b')); }
  };
}
// A text box that grows down as you type (up to ~6 lines) and shrinks back after sending.
function growBox(ta) { const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 150) + 'px'; }; ta.addEventListener('input', fit); ta.form && ta.form.addEventListener('submit', () => setTimeout(fit, 0)); fit(); }
// Hide the bottom menu while the keyboard is up, so it doesn't float over what you're typing.
document.addEventListener('focusin', e => { if (e.target.matches('input:not([type=checkbox]):not([type=range]):not([type=file]),textarea')) document.body.classList.add('typing'); });
document.addEventListener('focusout', () => setTimeout(() => { const a = document.activeElement; if (!a || !a.matches('input,textarea')) document.body.classList.remove('typing'); }, 50));
// Comments list with likes. The most liked rise to the top (like TikTok), newest first after that.
async function drawComments(cl, kind, id) {
  const list = await comments.list(kind, id).catch(() => []);
  const lk = await comments.likes(list.map(c => c.id), ME && ME.id).catch(() => ({ counts: {}, mine: new Set() }));
  await storage.prep(list.map(c => c.user && c.user.avatar).filter(Boolean));
  const sorted = [...list].sort((a, b) => (lk.counts[b.id] || 0) - (lk.counts[a.id] || 0) || (a.created_at < b.created_at ? 1 : -1));
  cl.innerHTML = sorted.length ? sorted.map(c => { const n = lk.counts[c.id] || 0, on = lk.mine.has(c.id); return `<div class="cm1">${avatar(c.user, 30)}<div class="cmb"><a href="#/u/${esc(c.user ? c.user.handle : '')}"><b>${esc(c.user ? c.user.name : '')}</b></a> <span class="mu">${ago(c.created_at)}</span>${ME && c.user_id === ME.id ? ` <button class="lnkb" data-cdel="${c.id}">Delete</button>` : ''}<br>${nl(c.body)}</div><button class="clk ${on ? 'on' : ''}" data-clike="${c.id}" data-on="${on ? 1 : 0}" aria-label="Like comment">${on ? '❤️' : '🤍'}<span>${n || ''}</span></button></div>`; }).join('') : `<p class="mu">No comments yet. Say something.</p>`;
  return list;
}
async function commentClick(e, redraw) {
  const d = e.target.closest('[data-cdel]'); if (d) { try { await comments.remove(d.dataset.cdel); await redraw(); } catch (err) { toast(err.message); } return; }
  const l = e.target.closest('[data-clike]'); if (!l) return;
  if (!ME) return go('#/login?mode=up');
  const on = l.dataset.on !== '1'; l.dataset.on = on ? '1' : '0'; l.classList.toggle('on', on);
  const sp = l.querySelector('span'); const n = (+sp.textContent || 0) + (on ? 1 : -1); sp.textContent = n || ''; l.firstChild.textContent = on ? '❤️' : '🤍';
  try { await comments.like(l.dataset.clike, on); if (on) track('comment_like'); } catch (err) { toast(err.message); }
}
async function openComments(art, kind, id, countEl) {
  const nx = art.nextElementSibling;
  if (nx && nx.classList.contains('cmt')) { nx.remove(); return; }
  art.insertAdjacentHTML('afterend', `<div class="card cmt"><div class="cl"><p class="mu">Loading…</p></div>${ME ? `<form class="cf"><textarea class="t" rows="1" maxlength="500" placeholder="Add a comment" aria-label="Comment"></textarea><button class="btn s">Send</button></form>` : `<a class="btn s g" href="#/login">Sign in to comment</a>`}</div>`);
  const panel = art.nextElementSibling, cl = panel.querySelector('.cl');
  const draw = async () => {
    const list = await drawComments(cl, kind, id);
    if (countEl) countEl.textContent = list.length;
  };
  await draw();
  const cf = panel.querySelector('.cf');
  if (cf) { const ta = cf.querySelector('textarea'); growBox(ta); ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); cf.requestSubmit(); } }); }
  if (cf) cf.onsubmit = async e => { e.preventDefault(); const inp = cf.querySelector('textarea'); const v = inp.value.trim(); if (!v) return; inp.value = ''; try { await comments.add(kind, id, v); await draw(); } catch (err) { toast(err.message); } };
  panel.onclick = e => commentClick(e, draw);
}
async function postPage(id) {
  const x = await posts.get(id);
  if (!x) { V.innerHTML = `<h1>Post not found</h1><p class="mu">It may have been deleted.</p><a class="btn g" href="#/">Go home</a>`; return; }
  const fol = ME ? await follows.ids(ME.id).catch(() => []) : [];
  V.innerHTML = `<div id="one"></div>${ME ? '' : `<div class="card"><b>Athletes post here every day.</b><p class="mu" style="margin:4px 0 10px">Make a free account to follow, comment and post your own plays.</p><a class="btn s" href="#/login?mode=up">Create free account</a></div>`}`;
  const one = V.querySelector('#one');
  await renderItems(one, [{ t: 'p', x }], { fol }); bindFollow(V, fol);
  openComments(one.querySelector('article'), 'post', id, one.querySelector('[data-cm] b'));
}

// ---------------- People: everyone on Jamoja, followers and following lists
function personRow(p, fol) {
  const me = ME && ME.id === p.id, on = fol.includes(p.id);
  return `<div class="prow"><a href="#/u/${esc(p.handle)}">${avatar(p, 48)}<span><b>${esc(p.name)}</b> ${lvBadge(p)}<br><span class="mu">@${esc(p.handle)}${p.sport ? ' · ' + esc(p.sport) : ''}${p.city ? ' · ' + esc(p.city) : ''}</span></span></a>${ME && !me ? `<button class="btn s ${on ? 'g' : ''}" data-follow="${p.id}">${on ? 'Following' : 'Follow'}</button>` : ''}</div>`;
}
let PEOPLE_SPORT = '';
async function peoplePage() {
  const fol = ME ? await follows.ids(ME.id).catch(() => []) : [];
  V.innerHTML = `<h1>People</h1><p class="mu" style="margin-top:0">Everyone on Jamoja, newest first. Follow your crew.</p>
    <input class="t" id="pq" type="search" placeholder="Search name, @handle or city" autocapitalize="off" autocorrect="off" spellcheck="false">
    <div class="row sports" id="psp" style="margin-top:10px">${['All', ...SPORTS].map(x => `<button class="chip ${(x === 'All' ? '' : x) === PEOPLE_SPORT ? 'on' : ''}" data-sp="${x === 'All' ? '' : esc(x)}">${esc(x)}</button>`).join('')}</div>
    <div id="pl"><p class="mu">Loading…</p></div>${ME ? `<div class="card" style="margin-top:16px"><b>Bring your crew</b><p class="mu" style="margin:4px 0 10px">Send friends the invite link.</p><button class="btn s" id="inv2">Invite friends</button></div>` : ''}`;
  const pl = V.querySelector('#pl'), pq = V.querySelector('#pq');
  let t = null;
  const load = async () => {
    const list = await follows.people(pq.value, PEOPLE_SPORT).catch(err => { pl.innerHTML = `<div class="err">${esc(err.message)}</div>`; return null; });
    if (!list) return;
    await storage.prep(list.map(p => p.avatar).filter(Boolean));
    pl.innerHTML = list.length ? `<p class="mu">${list.length} ${list.length === 1 ? 'athlete' : 'athletes'}</p>` + list.map(p => personRow(p, fol)).join('') : `<p class="mu">No one found.</p>`;
  };
  pq.oninput = () => { clearTimeout(t); t = setTimeout(load, 250); };
  V.querySelector('#psp').onclick = e => { const b = e.target.closest('[data-sp]'); if (!b) return; PEOPLE_SPORT = b.dataset.sp; V.querySelectorAll('#psp .chip').forEach(x => x.classList.toggle('on', x === b)); load(); };
  const inv = V.querySelector('#inv2'); if (inv) inv.onclick = () => { const url = 'https://biz.higherthan7.com/jamoja/join/'; const text = `I'm on Jamoja, the new app for athletes. Join and follow me: `; if (navigator.share) navigator.share({ title: 'Join me on Jamoja', text, url }).catch(() => {}); else navigator.clipboard.writeText(text + url).then(() => toast('Invite copied.'), () => toast(url)); };
  bindFollow(V, fol);
  await load();
}
async function followPage(handle, dir) {
  const p = await profiles.byHandle(handle);
  if (!p) { V.innerHTML = `<h1>Player not found</h1>`; return; }
  const [list, fol] = await Promise.all([follows.list(p.id, dir), ME ? follows.ids(ME.id).catch(() => []) : []]);
  await storage.prep(list.map(x => x.avatar).filter(Boolean));
  V.innerHTML = `<a class="mu" href="#/u/${esc(p.handle)}">← ${esc(p.name)}</a><h1>${dir === 'followers' ? 'Followers' : 'Following'}</h1>
    <div class="tabs"><a href="#/u/${esc(p.handle)}/followers" class="${dir === 'followers' ? 'on' : ''}">Followers</a><a href="#/u/${esc(p.handle)}/following" class="${dir === 'following' ? 'on' : ''}">Following</a></div>
    ${list.length ? list.map(x => personRow(x, fol)).join('') : `<p class="mu">${dir === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'} <a href="#/people">Find people</a></p>`}`;
  bindFollow(V, fol);
}

async function viewersPage() {
  if (!ME) return needLogin('#/viewers');
  const list = await profileViews.list(ME.id);
  const seen = list.filter(v => v.viewer), anon = list.length - seen.length;
  const people = []; const at = {};
  for (const v of seen) { if (!at[v.viewer_id]) { at[v.viewer_id] = { ...v, n: 0 }; people.push(at[v.viewer_id]); } at[v.viewer_id].n++; }
  await storage.prep(people.map(v => v.viewer.avatar).filter(Boolean));
  const fol = await follows.ids(ME.id).catch(() => []);
  V.innerHTML = `<a class="mu" href="#/u/${esc(MYP.handle)}">← Your profile</a><h1>Who viewed your profile</h1>
    <div class="row stats"><div><b>${list.length}</b><span>Views, 30 days</span></div><div><b>${people.length}</b><span>Members</span></div><div><b>${anon}</b><span>Not signed in</span></div></div>
    <div style="margin-top:12px">${people.length ? people.map(v => personRow(v.viewer, fol).replace('</span></span></a>', ` · viewed ${ago(v.viewed_at)}${v.n > 1 ? ` · ${v.n} days` : ''}</span></span></a>`)).join('') : `<p class="mu">No members have viewed your profile yet. Post, film a run and share your profile link to get seen.</p>`}</div>
    ${anon ? `<p class="mu">${anon} visit${anon === 1 ? '' : 's'} from people who were not signed in. They are counted but we can't show who.</p>` : ''}
    <p class="foot">When you're signed in and view someone's profile, they can see it was you.</p>`;
  bindFollow(V, fol);
}

// ---------------- Notifications
const NOTE_TEXT = {
  clike: () => 'liked your comment',
  rate: n => `rated your ${n.highlight && n.highlight.play_type ? n.highlight.play_type.toLowerCase() : 'play'} 🔥`,
  follow: () => 'started following you',
  fire_post: () => 'gave your post 🔥',
  fire_play: n => `gave ${n.highlight && n.highlight.play_type ? 'your ' + n.highlight.play_type.toLowerCase() : 'your play'} 🔥`,
  comment: n => n.post_id ? 'commented on your post' : 'commented on your play',
  tagged: n => `tagged you in a play${n.game ? ' from ' + n.game.title : ''}`,
  claimed: n => `claimed their plays${n.game ? ' in ' + n.game.title : ''}`,
  view: () => 'viewed your profile',
  rsvp: n => `is in for ${n.game ? n.game.title : 'your run'}`,
  live: n => `went live 🔴 at ${n.game ? n.game.title : 'a run'}. Tap to watch`,
};
const noteLink = n => n.type === 'follow' || n.type === 'view' ? `#/u/${n.actor ? n.actor.handle : ''}` : n.post_id ? `#/p/${n.post_id}` : n.game_id ? `#/g/${n.game_id}` : '#/';
async function alertsPage() {
  if (!ME) return needLogin('#/alerts');
  const list = await notes.list(ME.id).catch(err => { V.innerHTML = `<div class="err">${esc(err.message)}</div>`; return null; });
  if (!list) return;
  await storage.prep(list.map(n => n.actor && n.actor.avatar).filter(Boolean));
  V.innerHTML = `<h1>Notifications</h1>${installCard()}${list.length ? list.map(n => `<a class="nrow ${n.read_at ? '' : 'new'}" href="${noteLink(n)}">${avatar(n.actor, 44)}<span><b>${esc(n.actor ? n.actor.name : 'Someone')}</b> ${esc((NOTE_TEXT[n.type] || (() => ''))(n))}<br><span class="mu">${ago(n.created_at)}</span></span></a>`).join('')
    : `<p class="mu">Nothing yet. Post, film a run and follow your crew. When people 🔥, comment, follow or view your profile, it shows up here.</p>`}`;
  bindInstall();
  if (list.some(n => !n.read_at)) { await notes.readAll(ME.id).catch(() => {}); refreshBadge(); }
}
// Weekly recap card for the feed
async function recapCard() {
  if (!ME || LOCAL) return '';
  const c = await notes.week(ME.id).catch(() => ({}));
  const fire = (c.fire_post || 0) + (c.fire_play || 0), items = [[c.view || 0, 'profile views', '#/viewers'], [c.follow || 0, 'new followers', `#/u/${MYP.handle}/followers`], [fire, '🔥 on your posts', `#/u/${MYP.handle}`], [c.comment || 0, 'comments', '#/alerts']];
  if (!items.some(i => i[0])) return '';
  return `<div class="card recap"><b>Your week on Jamoja</b><div class="rgrid">${items.map(([n, l, h]) => `<a href="${h}"><b>${n}</b><span>${l}</span></a>`).join('')}</div></div>`;
}
// Add to Home Screen: needed for notifications on iPhone and feels like an app.
let DEFER_PROMPT = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); DEFER_PROMPT = e; });
const STANDALONE = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
// Push: only offered where the phone can actually receive it (on iPhone, after Add to Home Screen).
const PUSH_OK = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function pushCard() {
  if (!ME || LOCAL || !PUSH_OK() || Notification.permission === 'denied') return '';
  if (Notification.permission === 'granted') { ensurePush(false); return ''; }
  return `<div class="card inst" style="border-color:var(--o)"><b>Turn on notifications</b><p class="mu" style="margin:4px 0 10px">Know when someone follows you, 🔥 your plays, comments or tags you in a game. Nothing between 11 PM and 8 AM.</p><button class="btn s" id="pushon">Turn on notifications</button></div>`;
}
async function ensurePush(ask) {
  try {
    if (ask) { const p = await Notification.requestPermission(); if (p !== 'granted') { toast('Notifications are off. You can turn them on later in your phone settings.'); return false; } }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) { const key = await pushSubs.publicKey(); const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - key.length % 4) % 4)); sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, c => c.charCodeAt(0)) }); }
    await pushSubs.save(sub);
    return true;
  } catch (e) { console.error(e); if (ask) toast('Could not turn on notifications: ' + e.message); return false; }
}
function bindPush() { const b = document.getElementById('pushon'); if (b) b.onclick = async () => { b.disabled = true; b.textContent = 'Turning on…'; if (await ensurePush(true)) { b.closest('.inst').innerHTML = '<b>Notifications are on 🔔</b>'; toast('Notifications are on.'); } else { b.disabled = false; b.textContent = 'Turn on notifications'; } }; }
function installCard() {
  if (STANDALONE() || IN_APP) return pushCard();
  if (PUSH_OK() && !/iPhone|iPad|iPod/i.test(UA)) { const pc = pushCard(); if (pc) return pc; }
  try { if (localStorage.getItem('jm.inst.x')) return ''; } catch (e) { /* private */ }
  const ios = /iPhone|iPad|iPod/i.test(UA);
  return `<div class="card inst"><button class="lnkb x" id="instx" aria-label="Dismiss">✕</button><b>Add Jamoja to your Home Screen</b><p class="mu" style="margin:4px 0 ${ios ? 0 : 10}px">${ios ? 'Opens like an app and lets Jamoja notify you. In Safari tap the Share button <svg class="shr" viewBox="0 0 24 24" aria-label="Share"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"/></svg> (the square with the arrow, at the bottom of Safari), then <b>Add to Home Screen</b>.' : 'Opens like an app and lets Jamoja notify you.'}</p>${ios ? '' : `<button class="btn s" id="inst">Add to Home Screen</button>`}</div>`;
}
function bindInstall() {
  bindPush();
  const x = document.getElementById('instx'); if (x) x.onclick = () => { try { localStorage.setItem('jm.inst.x', '1'); } catch (e) { /* private */ } x.closest('.inst').remove(); };
  const b = document.getElementById('inst'); if (b) b.onclick = async () => { if (DEFER_PROMPT) { DEFER_PROMPT.prompt(); DEFER_PROMPT = null; } else toast('Open your browser menu (⋮) and tap Add to Home screen.'); };
}

// ---------------- Direct messages
let DM_T = null;
window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/dm/')) { clearInterval(DM_T); DM_T = null; } });
async function inboxPage() {
  if (!ME) return needLogin('#/inbox');
  const list = await dms.inbox().catch(err => { V.innerHTML = `<div class="err">${esc(err.message)}</div>`; return null; });
  if (!list) return;
  await storage.prep(list.map(r => r.other.avatar).filter(Boolean));
  V.innerHTML = `<div class="row" style="justify-content:space-between;align-items:center"><h1 style="margin:0">Messages</h1><button class="btn s" id="newdm">New message</button></div>
    <div id="pick" hidden style="margin-top:12px"><input class="t" id="dq" type="search" placeholder="Search name or @handle" autocapitalize="off" autocorrect="off" spellcheck="false"><div id="dres"></div></div>
    <div style="margin-top:10px">${list.length ? list.map(r => `<a class="nrow ${r.unread ? 'new' : ''}" href="#/dm/${encodeURIComponent(r.other.handle)}">${avatar(r.other, 52)}<span style="flex:1;min-width:0"><b>${esc(r.other.name)}</b><br><span class="mu dmprev">${r.last_from_me ? 'You: ' : ''}${esc(r.last_body)}</span></span><span class="mu" style="font-size:12px;text-align:right">${ago(r.last_at)}${r.unread ? `<br><i class="udot"></i>` : ''}</span></a>`).join('')
      : `<p class="mu">No messages yet. Tap <b>New message</b>, or open someone's profile and tap <b>Message</b>.</p>`}</div>`;
  const pick = V.querySelector('#pick'), dq = V.querySelector('#dq'), dres = V.querySelector('#dres'); let t = null;
  V.querySelector('#newdm').onclick = () => { pick.hidden = !pick.hidden; if (!pick.hidden) dq.focus(); };
  dq.oninput = () => { clearTimeout(t); t = setTimeout(async () => { const ps = (await follows.people(dq.value).catch(() => [])).filter(p => p.id !== ME.id).slice(0, 12); await storage.prep(ps.map(p => p.avatar).filter(Boolean)); dres.innerHTML = ps.map(p => `<a class="nrow" href="#/dm/${encodeURIComponent(p.handle)}">${avatar(p, 40)}<span><b>${esc(p.name)}</b><br><span class="mu">@${esc(p.handle)}</span></span></a>`).join('') || '<p class="mu">No one found.</p>'; }, 250); };
}
async function dmPage(handle) {
  if (!ME) return needLogin('#/dm/' + encodeURIComponent(handle));
  const other = await profiles.byHandle(handle);
  if (!other) { V.innerHTML = `<h1>Not found</h1><a href="#/inbox">Back to messages</a>`; return; }
  if (other.id === ME.id) return go('#/inbox');
  await storage.prep([other.avatar].filter(Boolean));
  let blocked = await blocks.has(ME.id, other.id).catch(() => false);
  V.innerHTML = `<div class="dmh"><a href="#/inbox" class="dmb" aria-label="Back">‹</a><a href="#/u/${esc(other.handle)}" class="dmu">${avatar(other, 36)}<span><b>${esc(other.name)}</b><br><span class="mu" style="font-size:12px">@${esc(other.handle)}</span></span></a><button class="lnkb" id="dmm" aria-label="Options">⋯</button></div>
    <div id="dmopt" class="card" hidden></div>
    <div id="msgs" class="msgs"><p class="mu">Loading…</p></div>
    <form class="dmf" id="dmf"><textarea class="t" id="dmi" rows="1" maxlength="2000" placeholder="Message…" autocomplete="off" aria-label="Message"></textarea><button class="btn s">Send</button></form>`;
  const box = V.querySelector('#msgs'); let last = null, first = true; // null so an empty chat still draws
  const draw = async () => {
    const list = await dms.thread(ME.id, other.id).catch(() => null); if (!list) return;
    const sig = list.map(m => m.id + (m.read_at ? 1 : 0)).join(); if (sig === last) return; last = sig;
    const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 80;
    box.innerHTML = list.length ? list.map((m, i) => { const mine = m.sender_id === ME.id, prev = list[i - 1]; const gap = !prev || new Date(m.created_at) - new Date(prev.created_at) > 3600e3; return `${gap ? `<div class="dmt">${new Date(m.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>` : ''}<div class="bub ${mine ? 'me' : ''}">${nl(m.body)}</div>`; }).join('') + (list.length && list[list.length - 1].sender_id === ME.id && list[list.length - 1].read_at ? '<div class="seen">Seen</div>' : '')
      : `<div class="dmempty">${avatar(other, 72)}<b>${esc(other.name)}</b><span class="mu">Say what's up. Set up a run, talk about the game.</span></div>`;
    if (atBottom || first) window.scrollTo(0, document.body.scrollHeight); first = false;
    if (list.some(m => m.recipient_id === ME.id && !m.read_at)) { await dms.markRead(ME.id, other.id).catch(() => {}); refreshBadge(); }
  };
  await draw();
  clearInterval(DM_T); DM_T = setInterval(draw, 4000);
  const f = V.querySelector('#dmf'), inp = V.querySelector('#dmi');
  // The box grows as you type (up to about 6 lines), so you can see the whole message.
  const fit = () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 150) + 'px'; };
  inp.addEventListener('input', fit);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); f.requestSubmit(); } });
  f.onsubmit = async e => {
    e.preventDefault(); const v = inp.value.trim(); if (!v) return;
    inp.value = ''; fit(); try { await dms.send(other.id, v); last = ''; await draw(); window.scrollTo(0, document.body.scrollHeight); } catch (err) { inp.value = v; toast(err.message); }
  };
  const opt = V.querySelector('#dmopt');
  const drawOpt = () => { opt.innerHTML = `<button class="btn s g" id="blk">${blocked ? 'Unblock' : 'Block'} ${esc(other.name.split(' ')[0])}</button><p class="mu" style="margin:8px 0 0;font-size:13px">Blocked people can't message you. They aren't told.</p>`; opt.querySelector('#blk').onclick = async () => { try { blocked = !blocked; await blocks.set(ME.id, other.id, blocked); toast(blocked ? 'Blocked.' : 'Unblocked.'); drawOpt(); } catch (err) { toast(err.message); } }; };
  V.querySelector('#dmm').onclick = () => { opt.hidden = !opt.hidden; if (!opt.hidden) drawOpt(); };
}

// Full-screen viewer for a video or photo. Closes with ✕, the back button, or a swipe down.
function openViewer(o) {
  const ov = document.createElement('div'); ov.className = 'viewer';
  ov.innerHTML = `<button class="rx" aria-label="Close">✕</button>${o.video ? `<video ${o.hid ? `data-hid="${esc(o.hid)}"` : ''} src="${esc(o.video)}" poster="${esc(o.poster || '')}" playsinline autoplay loop controls></video>` : `<img src="${esc(o.img)}" alt="">`}${o.cap ? `<div class="vcap">${o.cap}</div>` : ''}`;
  document.body.append(ov); document.documentElement.style.overflow = 'hidden';
  const v = ov.querySelector('video'); if (v) { if (o.start) v.currentTime = o.start; v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); countViews(ov); }
  history.pushState({ viewer: 1 }, '', location.href);
  let closed = false;
  const shut = (fromPop) => { if (closed) return; closed = true; if (v) v.pause(); ov.remove(); document.documentElement.style.overflow = ''; window.removeEventListener('popstate', onPop); if (!fromPop) history.back(); };
  const onPop = () => shut(true);
  window.addEventListener('popstate', onPop);
  ov.querySelector('.rx').onclick = () => shut(false);
  viewerSocial(ov, o, v);
  ov.querySelectorAll('.vcap a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const h = a.getAttribute('href'); shut(false); setTimeout(() => { location.hash = h; }, 50); }));
  let y0 = null; ov.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true }); ov.addEventListener('touchend', e => { if (y0 != null && e.changedTouches[0].clientY - y0 > 120) shut(false); y0 = null; }, { passive: true });
}

// TikTok-style: comments slide up over the video while it keeps playing; plays can be rated 1-10.
function viewerSocial(ov, o, v) {
  const ck = o.ck || (o.hid ? 'highlight' : ''), cid = o.cid || o.hid; if (!ck || !cid) return;
  ov.insertAdjacentHTML('beforeend', `<div class="vrail">${o.hid ? `<button class="vbtn" data-rate><span>🔥</span><b class="vrt">Rate</b></button>` : ''}<button class="vbtn" data-cms><span>💬</span><b class="vcn">·</b></button></div>
    <div class="vrate" hidden><p>How good was that play?</p><div>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button data-sc="${n}">${n}</button>`).join('')}</div></div>
    <div class="vsheet" hidden><div class="vsh"><i></i><b>Comments</b><button data-csx aria-label="Close comments">✕</button></div><div class="cl"></div>${ME ? `<form class="cf"><textarea class="t" rows="1" maxlength="500" placeholder="Add a comment…" aria-label="Comment"></textarea><button class="btn">Send</button></form>` : `<a class="btn w" href="#/login?mode=up">Sign up free to comment</a>`}</div>`);
  const sheet = ov.querySelector('.vsheet'), cl = sheet.querySelector('.cl'), vcn = ov.querySelector('.vcn');
  comments.counts(ck, [cid]).then(m => { vcn.textContent = m[cid] || 0; }).catch(() => {});
  const draw = async () => { const l = await drawComments(cl, ck, cid); vcn.textContent = l.length; };
  const openSheet = async () => { sheet.hidden = false; ov.classList.add('withc'); if (v) v.play().catch(() => {}); track('comments_open', { where: 'viewer' }); await draw(); };
  const closeSheet = () => { sheet.hidden = true; ov.classList.remove('withc'); };
  const rate = ov.querySelector('.vrate'), vrt = ov.querySelector('.vrt');
  const showRating = r => { if (!vrt) return; vrt.textContent = r.n ? r.avg.toFixed(1) : 'Rate'; rate.querySelectorAll('[data-sc]').forEach(b => b.classList.toggle('on', +b.dataset.sc === r.mine)); };
  if (o.hid) ratings.get(o.hid, ME && ME.id).then(showRating).catch(() => {});
  ov.addEventListener('click', async e => {
    if (e.target.closest('[data-cms]')) return sheet.hidden ? openSheet() : closeSheet();
    if (e.target.closest('[data-csx]')) return closeSheet();
    if (e.target.closest('[data-rate]')) { if (!ME) return go('#/login?mode=up'); rate.hidden = !rate.hidden; return; }
    const sc = e.target.closest('[data-sc]');
    if (sc) { try { await ratings.set(o.hid, +sc.dataset.sc); track('play_rate', { s: +sc.dataset.sc }); const r = await ratings.get(o.hid, ME.id); showRating(r); toast(`You rated it ${sc.dataset.sc}. Average ${r.avg.toFixed(1)} from ${r.n}.`); setTimeout(() => { rate.hidden = true; }, 500); } catch (err) { toast(err.message); } return; }
    if (e.target.closest('.vsheet')) commentClick(e, draw);
  });
  const cf = sheet.querySelector('.cf');
  if (cf) { const ta = cf.querySelector('textarea'); growBox(ta); cf.onsubmit = async e => { e.preventDefault(); const t = ta.value.trim(); if (!t) return; ta.value = ''; ta.dispatchEvent(new Event('input')); try { await comments.add(ck, cid, t); track('comment', { where: 'viewer' }); await draw(); cl.scrollTop = 0; } catch (err) { toast(err.message); } }; }
  // the swipe-down-to-close shouldn't fire while scrolling comments
  sheet.addEventListener('touchstart', e => e.stopPropagation(), { passive: true }); sheet.addEventListener('touchend', e => e.stopPropagation(), { passive: true });
}
// Play of the Week: the best rated play in the last 7 days (at a court, or everywhere).
async function potw(host, place) {
  if (!host) return;
  const top = await ratings.top(7, place || null, 1).catch(() => []); if (!top.length || !host.isConnected) return;
  const r = top[0], h = r.h, who = h.player && h.player.user ? h.player.user.name : h.player ? h.player.label : 'Unknown player';
  host.innerHTML = `<button class="card potw" data-potw><img src="${esc(storage.url(h.poster))}" alt=""><span><span class="mu" style="font-size:12px;letter-spacing:.12em">🏆 PLAY OF THE WEEK${place ? ' · THIS COURT' : ''}</span><b>${esc(h.play_type || 'Play')} by ${esc(who)}</b><span class="mu">🔥 ${Number(r.avg_score).toFixed(1)} from ${r.n} rating${r.n > 1 ? 's' : ''}${h.game ? ' · ' + esc(h.game.place || h.game.title) : ''}</span></span></button>`;
  host.querySelector('[data-potw]').onclick = () => openViewer({ video: storage.url(h.path), poster: storage.url(h.poster), hid: h.id, cap: `<b>🏆 Play of the Week</b> <a href="#/g/${h.game_id}">${esc(h.game ? h.game.title : 'Open the game')} →</a>` });
}
// Grab the frame a <video> is showing at time t as a JPEG (what you see is what gets saved).
async function grabFrame(v, t, max = 720) {
  await new Promise((ok, bad) => { const done = () => { v.removeEventListener('seeked', done); ok(); }; v.addEventListener('seeked', done); setTimeout(done, 3000); v.pause(); v.currentTime = Math.max(0, t); });
  if (!v.videoWidth) throw new Error('Could not read that frame');
  const k = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight)); const c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  return new Promise((ok, bad) => c.toBlob(b => b ? b.arrayBuffer().then(a => ok(new Uint8Array(a))) : bad(new Error('Could not save that frame')), 'image/jpeg', 0.86));
}
// Change the cover of one of your video posts.
async function changeCover(x, after) {
  const ov = document.createElement('div'); ov.className = 'crop';
  ov.innerHTML = `<div class="cbox" style="width:min(420px,100%)"><b style="font:28px var(--hd)">Pick the cover</b><p class="mu" style="margin:0 0 10px">Slide to the frame you want people to see.</p>
    <video src="${esc(storage.url(x.media))}" crossorigin="anonymous" playsinline muted preload="auto" style="width:100%;max-height:52vh;border-radius:12px;background:#000"></video>
    <input type="range" class="zm" min="0" step="0.05" value="0" aria-label="Cover frame">
    <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn g s" data-x>Cancel</button><button class="btn s" data-ok>Save cover</button></div></div>`;
  document.body.append(ov);
  const v = ov.querySelector('video'), r = ov.querySelector('input');
  v.onloadedmetadata = () => { r.max = (v.duration || 1).toFixed(2); r.value = Math.min(1, v.duration / 2).toFixed(2); v.currentTime = +r.value; };
  r.oninput = () => { v.currentTime = +r.value; };
  ov.querySelector('[data-x]').onclick = () => ov.remove();
  ov.querySelector('[data-ok]').onclick = async e => {
    const b = e.target; b.disabled = true; b.textContent = 'Saving…';
    try {
      const jpg = await grabFrame(v, +r.value);
      const k = `${ME.id}/posts/cover-${Date.now()}.jpg`; await storage.upload(k, jpg, 'image/jpeg');
      const old = x.poster; await posts.setCover(x.id, k); x.poster = k; if (old) storage.remove([old]).catch(() => {});
      ov.remove(); toast('Cover saved.'); if (after) after();
    } catch (err) { b.disabled = false; b.textContent = 'Save cover'; toast(err.message); }
  };
}

// ---------------- Runs and live
const whenLabel = t => { const d = new Date(t), n = new Date(); const same = d.toDateString() === n.toDateString(); const tm = new Date(n.getTime() + 864e5).toDateString() === d.toDateString(); const hm = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); return same ? 'Today ' + hm : tm ? 'Tomorrow ' + hm : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' + hm; };
const nextHour = () => { const d = new Date(Date.now() + 3600e3); d.setMinutes(0, 0, 0); const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`; };
async function runsRail() {
  if (LOCAL) return '';
  const [list, onAir] = await Promise.all([games.upcoming().catch(() => []), live.now().catch(() => [])]);
  await storage.prep(onAir.map(x => x.user && x.user.avatar).filter(Boolean));
  const liveIds = new Set(onAir.map(x => x.game_id));
  const banner = onAir.map(x => `<a class="livebar" href="#/g/${x.game_id}">${avatar(x.user, 40)}<span><b><span class="lvdot"></span> LIVE NOW</b><br>${esc(x.user ? x.user.name : 'Someone')} at ${esc(x.game ? x.game.title : 'a run')}</span><span class="btn s">Watch</span></a>`).join('');
  await storage.prep(list.map(g => g.owner && g.owner.avatar).filter(Boolean));
  const soon = g => Math.abs(new Date(g.starts_at) - Date.now()) < 3 * 3600e3 && new Date(g.starts_at) <= Date.now() + 15 * 60e3;
  return banner + `<div class="runs"><div class="runs-h"><b>Runs</b><a href="#/new">+ Post a run</a></div><div class="rail">${list.length ? list.map(g => `<a class="runc ${liveIds.has(g.id) ? 'onair' : soon(g) ? 'now' : ''}" href="#/g/${g.id}"><span class="rt">${liveIds.has(g.id) ? '🔴 LIVE' : soon(g) ? '● ON NOW' : esc(whenLabel(g.starts_at))}</span><b>${esc(g.title)}</b><span class="mu">${esc(g.place || g.sport)}</span><span class="rg">${g.owner ? avatar(g.owner, 22) : ''}<span>${g.going + 1} in</span></span></a>`).join('')
    : `<a class="runc empty" href="#/new"><b>No runs posted yet</b><span class="mu">Post where and when you're playing so your crew can meet you.</span><span class="rt">+ Post a run</span></a>`}</div></div>`;
}
async function runBox(g, own) {
  if (!g.starts_at && !own) return '';
  const going = await rsvps.list(g.id).catch(() => []);
  await storage.prep(going.map(p => p.avatar).filter(Boolean));
  const imIn = ME && going.some(p => p.id === ME.id);
  const map = g.place ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(g.place)}` : '';
  return `<div class="card runbox">${g.starts_at ? `<div class="rb-when">🕒 ${esc(whenLabel(g.starts_at))}</div>` : ''}${g.place ? `<div class="rb-where">📍 <a href="${courtUrl(g.place)}">${esc(g.place)}</a> <a class="mu" href="${g.lat != null ? `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}` : map}" target="_blank" rel="noopener">· Map</a></div>` : own ? `<button class="btn s g" id="setspot" style="margin-top:6px">📍 Add this court (use my location)</button>` : ''}${g.notes ? `<p style="margin:6px 0 0">${nl(g.notes)}</p>` : ''}
    <div class="rb-going">${g.owner ? avatar(g.owner, 30) : ''}${going.slice(0, 8).map(p => avatar(p, 30)).join('')}<span class="mu">${going.length + 1} in</span></div>
    ${own ? '' : ME ? `<button class="btn w ${imIn ? 'g' : ''}" id="rsvp" style="margin-top:10px">${imIn ? "✓ You're in" : "I'm in"}</button>` : `<a class="btn w" href="#/login?mode=up&next=${encodeURIComponent('#/g/' + g.id)}" style="margin-top:10px">I'm in (sign up free)</a>`}</div>`;
}
async function liveBox(g) {
  if (LOCAL) return '';
  const own = ME && g.owner_id === ME.id;
  const ss = await live.sessions(g.id).catch(() => []);
  await storage.prep(ss.map(x => x.user && x.user.avatar).filter(Boolean));
  const mins = x => Math.max(1, Math.round((new Date(x.last) - new Date(x.first)) / 60000));
  const onAir = ss.some(x => x.isLive);
  const day = ME ? `<div class="gameday"><b class="gd-t">Game day</b>
      <button class="btn w gd-live" id="golive"><span class="lvdot"></span> Go live${own ? ' + highlights' : ''}</button>
      <p class="mu gd-how">${own ? 'Everyone can watch live. Tap BUCKET after big plays, and when you end, your plays are ready to turn into highlights.' : 'Stream the run so people can watch from anywhere.'}</p>
      ${own ? `<a class="lnkb gd-rec" href="#/new?game=${g.id}">Record only, no live</a>` : ''}</div>` : '';
  const list = ss.length ? `<div class="lb-list">${ss.map(x => `<button class="lb-s" data-watch="${esc(x.session)}" data-live="${x.isLive ? 1 : ''}">${avatar(x.user, 28)}<span><b>${esc(x.user ? x.user.name : 'Someone')}</b><br><span class="mu">${x.isLive ? '🔴 Live now' : `Replay · ${mins(x)} min`}</span></span><span class="btn s g">${x.isLive ? 'Watch' : 'Play'}</span></button>`).join('')}</div>` : '';
  return `<div class="card livebox ${onAir ? 'onair' : ''}">${onAir ? `<div class="lb-h"><b><span class="lvdot"></span> Live now</b></div>` : ''}${day}${list ? `<div class="lb-h" style="margin-top:12px"><b>${onAir ? 'Streams' : 'Replays'}</b></div>${list}` : ''}<div id="player"></div></div>`;
}
// Broadcaster: records 6-second chunks and uploads each one as it finishes.
async function goLive(g) {
  track('live_start');
  if (!R.supported()) return toast('Live is not supported in this browser. Open Jamoja in Safari or Chrome.');
  if (ME && g.owner_id === ME.id && g.lat == null) stampSpot(g);
  const session = 'live-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let chain = Promise.resolve(), failed = 0, sent = 0;
  const up = (p, seq, last) => { chain = chain.then(async () => {
    const ext = p.name.split('.').pop(), path = `${ME.id}/live/${g.id}/${session}-${String(seq).padStart(4, '0')}.${ext}`;
    for (let i = 0; i < 3; i++) { try { await storage.upload(path, p.blob, p.type.split(';')[0]); await live.add({ game_id: g.id, session, seq, path, type: p.type.split(';')[0], dur: +p.dur.toFixed(2), marks: p.marks, ended: !!last }); sent++; return; } catch (e) { await new Promise(r => setTimeout(r, 1200)); } }
    failed++;
  }); };
  const r = await R.record({ live: true, title: g.title, onPart: up });
  if (!r || !r.parts.length) { gamePage(g.id); return; }
  V.innerHTML = `<div class="card" style="margin-top:20px"><b>Saving your stream…</b><p class="mu" id="gls">Finishing the upload.</p><div class="bar"><b id="glb" style="width:30%"></b></div></div>`;
  await chain;
  const own = g.owner_id === ME.id;
  // Turn each BUCKET tap into a short source: the pieces around the tap, joined together.
  let t0 = 0; const parts = r.parts.map(p => { const x = { ...p, t0 }; t0 += p.dur; return x; });
  const taps = parts.flatMap(p => p.marks.map(m => p.t0 + m));
  if (!own || !taps.length) { toast(failed ? `Stream saved with ${failed} missing piece${failed > 1 ? 's' : ''} (weak signal).` : own ? 'Stream saved. No BUCKET taps, so no highlights this time. The replay is on the run page.' : 'Stream saved. People can watch the replay.'); gamePage(g.id); return; }
  const srcs = [];
  try {
    document.getElementById('gls').textContent = 'Getting your plays ready…';
    for (let k = 0; k < taps.length; k++) {
      const T = taps[k], from = T - 9, to = T + 3;
      const pick = parts.filter(p => p.t0 + p.dur > from && p.t0 < to);
      if (!pick.length) continue;
      const blob = pick.length === 1 ? pick[0].blob : await E.join(pick.map(p => p.blob), pick[0].type);
      srcs.push({ id: 'live-' + k, name: `Play ${k + 1}.mp4`, type: 'video/mp4', blob, dur: pick.reduce((a, p) => a + p.dur, 0), marks: [T - pick[0].t0] });
      document.getElementById('glb').style.width = (30 + 70 * (k + 1) / taps.length) + '%';
    }
  } catch (e) { console.error(e); }
  if (!srcs.length) { toast('Stream saved. The replay is on the run page.'); gamePage(g.id); return; }
  window.PENDING_SRC = srcs;
  toast(`${srcs.length} play${srcs.length > 1 ? 's' : ''} from your BUCKET taps. Tap Make highlights.`);
  go('#/new?game=' + g.id);
}
// Viewer: plays chunks back to back. Live: starts near the newest chunk and keeps checking for more.
let WATCH = null;
window.addEventListener('hashchange', () => { if (WATCH) { WATCH.stop(); WATCH = null; } });
async function watchSession(box, gameId, session, isLive) {
  if (WATCH) WATCH.stop();
  box.innerHTML = `<div class="lp"><video playsinline class="lv a"></video><video playsinline class="lv b" hidden></video><div class="lp-badge">${isLive ? '<span class="lvdot"></span> LIVE' : 'REPLAY'}</div><div class="lp-msg mu" id="lpm">Loading…</div></div>`;
  const vids = [...box.querySelectorAll('video')]; let cur = 0, queue = [], lastSeq = -1, stopped = false, playing = false, poll = null;
  const msg = t => { const m = box.querySelector('#lpm'); if (m) { m.textContent = t || ''; m.hidden = !t; } };
  const fetchMore = async () => {
    const segs = await live.segments(gameId, session, lastSeq).catch(() => []);
    if (!segs.length) return false;
    if (lastSeq < 0 && isLive && segs.length > 2) segs.splice(0, segs.length - 2);
    await storage.prep(segs.map(s2 => s2.path));
    for (const s2 of segs) { queue.push(s2); lastSeq = s2.seq; if (s2.ended) isLive = false; }
    return true;
  };
  const load = (v, s2) => { v.src = storage.url(s2.path); v.load(); };
  const next = async () => {
    if (stopped) return;
    if (!queue.length) { await fetchMore(); }
    if (!queue.length) { playing = false; msg(isLive ? 'Waiting for the next few seconds…' : 'End of stream.'); return; }
    const s2 = queue.shift(), v = vids[cur], other = vids[1 - cur];
    if (v.dataset.path !== s2.path) { load(v, s2); v.dataset.path = s2.path; }
    v.hidden = false; other.hidden = true; msg('');
    try { await v.play(); playing = true; } catch (e) { v.muted = true; try { await v.play(); playing = true; msg('Tap the video for sound'); } catch (e2) { msg('Tap to play'); } }
    if (queue[0]) { load(other, queue[0]); other.dataset.path = queue[0].path; }
    v.onended = () => { cur = 1 - cur; vids[cur].muted = v.muted; next(); };
  };
  box.querySelector('.lp').onclick = () => { vids.forEach(v => { v.muted = false; }); const v = vids[cur]; if (v.paused) v.play().catch(() => {}); msg(''); };
  await fetchMore(); next();
  if (isLive) poll = setInterval(async () => { if (stopped) return; const got = await fetchMore(); if (got && !playing) next(); if (!isLive) { clearInterval(poll); } }, 3000);
  WATCH = { stop: () => { stopped = true; clearInterval(poll); vids.forEach(v => { v.pause(); v.removeAttribute('src'); }); } };
}

// ---------------- Post composer: text, photo, video, YouTube link
// ---------- Courts: where the game is
const courtUrl = place => '#/court/' + encodeURIComponent(place);
const courtLink = place => place ? `<a href="${courtUrl(place)}">${esc(place)}</a>` : '';
let SPOT_LL = null; // lat/lng picked on the new-game form
// Ask the phone where we are, reuse a court name someone already set nearby, otherwise look up the place name.
async function spotHere(timeoutMs = 9000) {
  if (!navigator.geolocation) return null;
  const pos = await new Promise(res => { const t = setTimeout(() => res(null), timeoutMs); navigator.geolocation.getCurrentPosition(p => { clearTimeout(t); res(p); }, () => { clearTimeout(t); res(null); }, { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 300000 }); });
  if (!pos) return null;
  const lat = +pos.coords.latitude.toFixed(6), lng = +pos.coords.longitude.toFixed(6);
  let place = await games.near(lat, lng).catch(() => null);
  if (!place) {
    try {
      const r = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': 'en' } })).json();
      const a = r.address || {};
      const name = r.name || a.leisure || a.amenity || a.building || a.road || '';
      const area = a.neighbourhood || a.suburb || a.city_district || a.city || a.town || '';
      place = [name, area].filter((x, i, arr) => x && arr.indexOf(x) === i).join(', ').slice(0, 80);
    } catch (e) { place = ''; }
  }
  return { lat, lng, place: place || '' };
}
// Stamp a run with where it is (only fills what is missing).
async function stampSpot(g) {
  if (!g || (g.lat != null && g.place)) return g;
  const sp = await spotHere(); if (!sp) return g;
  const patch = { lat: sp.lat, lng: sp.lng }; if (!g.place && sp.place) patch.place = sp.place;
  try { await games.setSpot(g.id, patch); Object.assign(g, patch); } catch (e) { /* not the owner or offline */ }
  return g;
}
async function courtPage(place) {
  const [runs, hs] = await Promise.all([games.atCourt(place).catch(() => []), highlights.atCourt(place).catch(() => [])]);
  const liveNow = await live.now().catch(() => []);
  const liveIds = new Set((liveNow || []).map(x => x.game_id));
  const now = Date.now();
  const soonRuns = runs.filter(g => g.starts_at && new Date(g.starts_at).getTime() > now - 4 * 3600e3).sort((a, b) => a.starts_at < b.starts_at ? -1 : 1);
  const past = runs.filter(g => !soonRuns.includes(g));
  // King of the Court: most highlights, fires break ties.
  const kings = {};
  for (const h of hs) { const u = h.player && h.player.user; if (!u) continue; const k = kings[u.handle] || (kings[u.handle] = { u, n: 0, f: 0 }); k.n++; k.f += h.fire || 0; }
  const board = Object.values(kings).sort((a, b) => b.n - a.n || b.f - a.f).slice(0, 5);
  const regs = {}; for (const g of runs) if (g.owner) { const r = regs[g.owner.handle] || (regs[g.owner.handle] = { u: g.owner, n: 0 }); r.n++; }
  const regulars = Object.values(regs).sort((a, b) => b.n - a.n).slice(0, 8);
  await storage.prep([...hs.flatMap(h => [h.path, h.poster]), ...board.map(k => k.u.avatar), ...regulars.map(r => r.u.avatar)].filter(Boolean));
  const ll = runs.find(g => g.lat != null);
  const map = ll ? `https://www.google.com/maps/search/?api=1&query=${ll.lat},${ll.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
  V.innerHTML = `<div class="court-h"><span class="mu">COURT</span><h1>${esc(place)}</h1><p class="mu">${runs.length} run${runs.length === 1 ? '' : 's'} · ${hs.length} highlight${hs.length === 1 ? '' : 's'} · <a href="${map}" target="_blank" rel="noopener">Map</a></p></div>
    ${runs.some(g => liveIds.has(g.id)) ? `<a class="card livebar" href="#/g/${runs.find(g => liveIds.has(g.id)).id}"><span class="lvdot"></span><b>Live here right now</b><span class="mu">Tap to watch</span></a>` : ''}
    <div id="cpotw"></div><a class="btn w" href="#/new?place=${encodeURIComponent(place)}" style="margin:12px 0">+ Post a run here</a>
    <h2>Next runs here</h2>${soonRuns.length ? gameList(soonRuns) : `<p class="mu">Nothing posted. Post one and your crew will see it.</p>`}
    <h2>👑 King of the Court</h2>${board.length ? `<div class="list">${board.map((k, i) => `<a href="#/u/${esc(k.u.handle)}"><span class="row" style="gap:10px;flex-wrap:nowrap"><b style="width:18px">${i + 1}</b>${avatar(k.u, 34)}<span><b>${esc(k.u.name)}</b><br><span class="mu">${k.n} highlight${k.n === 1 ? '' : 's'} · 🔥 ${k.f}</span></span></span></a>`).join('')}</div>` : `<p class="mu">No crown yet. Claim your plays from a game filmed here to get on the board.</p>`}
    ${regulars.length ? `<h2>Regulars</h2><div class="row">${regulars.map(r => `<a href="#/u/${esc(r.u.handle)}" title="${esc(r.u.name)}">${avatar(r.u, 40)}</a>`).join('')}</div>` : ''}
    <h2>Best plays here</h2>${hs.length ? `<div class="tiles">${[...hs].sort((a, b) => (b.fire || 0) - (a.fire || 0)).slice(0, 12).map(h => `<a class="tile" href="#/g/${h.game_id}"><img src="${esc(storage.url(h.poster))}" alt="" loading="lazy"><span class="tlab">🔥 ${h.fire || 0}</span></a>`).join('')}</div>` : `<p class="mu">No highlights from this court yet.</p>`}
    ${past.length ? `<h2>Past games</h2>${gameList(past.slice(0, 10))}` : ''}`;
  potw(V.querySelector('#cpotw'), place);
}
// "I got next": the line for the next game on this court.
async function nextBox(g, own) {
  if (!g.starts_at) return '';
  const line = await nextUp.list(g.id).catch(() => []);
  await storage.prep(line.map(p => p.avatar).filter(Boolean));
  const mine = ME && line.some(p => p.id === ME.id);
  return `<div class="card nextbox"><div class="row" style="justify-content:space-between"><b>Next up</b><span class="mu">${line.length ? line.length + ' waiting' : 'No line yet'}</span></div>
    ${line.length ? `<ol class="nq">${line.map((p, i) => `<li>${avatar(p, 26)}<span>${esc(p.name)}${i < 5 ? '' : ''}</span>${own || (ME && p.id === ME.id) ? `<button class="btn s g" data-nx="${p.id}">${own && p.id !== (ME && ME.id) ? 'On court' : 'Leave'}</button>` : ''}</li>`).join('')}</ol>` : ''}
    ${ME ? (mine ? '' : `<button class="btn w" id="gotnext" style="margin-top:8px">✋ I got next</button>`) : `<a class="btn w" href="#/login?mode=up&next=${encodeURIComponent('#/g/' + g.id)}" style="margin-top:8px">✋ I got next (sign up free)</a>`}
    <p class="mu" style="margin:6px 0 0;font-size:13px">First 5 in line run the next game. No arguing.</p></div>`;
}
// Box score: built from tagged plays. Every tag (play type + who) fills it in.
const SHOT2 = new Set(['Bucket', 'Jumper', 'Layup', 'Drive', 'Dunk', 'Putback', 'And-one', 'Ankle breaker', 'Game winner']);
function boxScore(ps, hs) {
  if (!hs.length) return '';
  const rows = new Map();
  const row = pid => { if (!rows.has(pid)) { const p = ps.find(x => x.id === pid); rows.set(pid, { p, fgm: 0, tpm: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 }); } return rows.get(pid); };
  ps.filter(p => p.user_id).forEach(p => row(p.id)); // claimed players show up even with zeros
  for (const h of hs) {
    const r = row(h.player_id || 'none'), t = h.play_type || 'Bucket';
    if (t === 'Three') { r.fgm++; r.tpm++; r.pts += 3; } else if (SHOT2.has(t)) { r.fgm++; r.pts += t === 'And-one' ? 3 : 2; }
    else if (t === 'Rebound') r.reb++; else if (t === 'Dime') r.ast++; else if (t === 'Steal') r.stl++; else if (t === 'Block') r.blk++;
  }
  const list = [...rows.values()].sort((a, b) => b.pts - a.pts || b.reb + b.ast - a.reb - a.ast);
  const top = list[0] && list[0].pts ? list[0] : null;
  const mix = {}; hs.forEach(h => { const t = h.play_type || 'Bucket'; mix[t] = (mix[t] || 0) + 1; });
  const name = r => r.p ? (r.p.user ? `<a href="#/u/${esc(r.p.user.handle)}">${esc(r.p.user.name)}</a>` : `${esc(r.p.label)} <span class="bx-c">is this you?</span>`) : '<span class="mu">Not tagged yet</span>';
  return `<div class="card bx"><div class="row" style="justify-content:space-between"><span class="mu" style="letter-spacing:.12em;font-size:12px">BOX SCORE</span><span class="mu" style="font-size:12px">${Object.entries(mix).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n} ${esc(t.toLowerCase())}${n > 1 && !/s$/.test(t) ? 's' : ''}`).join(' · ')}</span></div>
    <table><thead><tr><th>Player</th><th>PTS</th><th>FG</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th></tr></thead><tbody>
    ${list.map(r => `<tr class="${r === top ? 'lead' : ''}"><td>${r === top ? '🔥 ' : ''}${name(r)}</td><td><b>${r.pts}</b></td><td>${r.fgm}</td><td>${r.reb}</td><td>${r.ast}</td><td>${r.stl}</td><td>${r.blk}</td></tr>`).join('')}
    </tbody></table><p class="mu" style="font-size:12px;margin:8px 0 0">Made from tagged plays. Tag a rebound, dime, steal or block in Review plays and it shows up here. Points count 2 per bucket, 3 per three.</p></div>`;
}
// Pickup player card: per-game averages across every run this athlete claimed. A résumé built from film.
function pickupCard(p, tags, hs) {
  const games = new Map();
  for (const t of tags) if (t.game) games.set(t.game.id, { g: t.game, pts: 0, fgm: 0, tpm: 0, reb: 0, ast: 0, stl: 0, blk: 0, jum: 0, lay: 0 });
  if (!games.size) return '';
  const pid2game = new Map(tags.map(t => [t.id, t.game && t.game.id]));
  for (const h of hs) {
    const gid = h.game_id || pid2game.get(h.player_id); const r = games.get(gid); if (!r) continue; const t = h.play_type || 'Bucket';
    if (t === 'Three') { r.fgm++; r.tpm++; r.pts += 3; r.jum++; } else if (SHOT2.has(t)) { r.fgm++; r.pts += t === 'And-one' ? 3 : 2; if (t === 'Jumper') r.jum++; if (t === 'Layup' || t === 'Drive' || t === 'Dunk' || t === 'Putback') r.lay++; }
    else if (t === 'Rebound') r.reb++; else if (t === 'Dime') r.ast++; else if (t === 'Steal') r.stl++; else if (t === 'Block') r.blk++;
  }
  const L = [...games.values()].sort((a, b) => (b.g.played_on || '') < (a.g.played_on || '') ? -1 : 1);
  const n = L.length, sum = k => L.reduce((a, r) => a + r[k], 0), avg = k => (sum(k) / n).toFixed(1).replace(/\.0$/, '');
  const shots = sum('jum') + sum('lay');
  const best = [...L].sort((a, b) => b.pts - a.pts)[0];
  const courts = [...new Set(L.map(r => r.g.place).filter(Boolean))];
  const d = r => r.g.played_on ? new Date(r.g.played_on + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  return `<div class="card pk"><div class="row" style="justify-content:space-between"><span class="mu" style="letter-spacing:.12em;font-size:12px">PICKUP STATS</span><span class="mu" style="font-size:12px">${n} game${n > 1 ? 's' : ''} on film${courts.length ? ' · ' + courts.length + ' court' + (courts.length > 1 ? 's' : '') : ''}</span></div>
    <div class="pk-avg">${[['PPG', 'pts'], ['RPG', 'reb'], ['APG', 'ast'], ['SPG', 'stl'], ['BPG', 'blk']].map(([l, k]) => `<div><b>${avg(k)}</b><span>${l}</span></div>`).join('')}</div>
    ${shots ? `<div class="pk-mix"><i style="width:${Math.round(sum('jum') / shots * 100)}%"></i></div><p class="mu" style="font-size:12px;margin:4px 0 0">${Math.round(sum('jum') / shots * 100)}% jumpers · ${Math.round(sum('lay') / shots * 100)}% at the rim${sum('tpm') ? ' · ' + sum('tpm') + ' threes' : ''}</p>` : ''}
    ${best && best.pts ? `<p style="margin:10px 0 0;font-size:14px">Best game: <b>${best.pts} pts</b> at <a href="#/g/${best.g.id}">${esc(best.g.title)}</a></p>` : ''}
    <table class="pk-log"><thead><tr><th>Game</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th></tr></thead><tbody>${L.slice(0, 5).map(r => `<tr><td><a href="#/g/${r.g.id}">${esc(d(r))} ${esc(r.g.title)}</a></td><td><b>${r.pts}</b></td><td>${r.reb}</td><td>${r.ast}</td><td>${r.stl}</td><td>${r.blk}</td></tr>`).join('')}</tbody></table>
    <p class="mu" style="font-size:11px;margin:8px 0 0">Built from plays tagged on film. Every tagged rebound, dime, steal and block counts.</p></div>`;
}
// Run Report: the game in one card, built from what was filmed.
function runReport(g, ps, hs) {
  if (!hs.length) return '';
  const top = [...hs].sort((a, b) => (b.fire || 0) - (a.fire || 0) || (b.views || 0) - (a.views || 0)).slice(0, 3);
  const types = {}; hs.forEach(h => { if (h.play_type) types[h.play_type] = (types[h.play_type] || 0) + 1; });
  const tline = Object.entries(types).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n} ${esc(t)}${n > 1 && !/s$/.test(t) ? 's' : ''}`).join(' · ');
  const when = g.starts_at ? new Date(g.starts_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : (g.played_on || '');
  return `<div class="card report"><span class="mu" style="letter-spacing:.12em;font-size:12px">RUN REPORT</span>
    <div class="rp-h"><b>${esc(g.title)}</b><span class="mu">${g.place ? '📍 ' + courtLink(g.place) + ' · ' : ''}${esc(when)}</span></div>
    <div class="rp-s"><div><b>${hs.length}</b><span>${hs.length === 1 ? 'play' : 'plays'}</span></div><div><b>${ps.length || '·'}</b><span>${ps.length === 1 ? 'player' : 'players'}</span></div><div><b>${hs.reduce((a, h) => a + (h.views || 0), 0)}</b><span>views</span></div></div>
    ${tline ? `<p class="mu" style="margin:8px 0 0">${tline}</p>` : ''}
    <p style="margin:10px 0 4px"><b>Top plays</b></p><div class="tiles rp-t">${top.map(h => `<span class="tile"><img src="${esc(storage.url(h.poster))}" alt="" loading="lazy"><span class="tlab">${esc(h.play_type || h.label)}</span></span>`).join('')}</div></div>`;
}
// Play the video fast in the background and watch the net. A make jerks the net; the backboard staying still means the camera did not move.
async function scanRim(url, rim, dur, onProgress, host) {
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.src = url;
  v.className = 'rimvid'; (host || document.body).append(v); // visible: browsers don't play frames of hidden videos
  await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('this video format')); setTimeout(res, 8000); });
  const W = 160, H = 90, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d', { willReadFrequently: true });
  const X = rim.x * W, Y = rim.y * H;
  const bx = (x0, y0, w, h) => ({ x0: Math.max(0, Math.round(x0)), y0: Math.max(0, Math.round(y0)), x1: Math.min(W, Math.round(x0 + w)), y1: Math.min(H, Math.round(y0 + h)) });
  const NET = bx(X - 6, Y - 1, 12, 11), BOARD = bx(X - 12, Y - 14, 24, 11);
  const diff = (a, b, q) => { let t = 0, n = 0; for (let y = q.y0; y < q.y1; y++) for (let x = q.x0; x < q.x1; x++) { const i = y * W + x; t += Math.abs(a[i] - b[i]); n++; } return n ? t / n : 0; };
  const hits = []; let prev = null, prevT = -1, last = -1e9;
  const total = dur || v.duration || 1;
  const sample = () => {
    cx.drawImage(v, 0, 0, W, H); const d = cx.getImageData(0, 0, W, H).data, g = new Uint8Array(W * H);
    for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    const t = v.currentTime;
    if (prev && t - prevT < 0.35) {
      const sc = diff(g, prev, NET) - 1.5 * diff(g, prev, BOARD);
      if (sc > 14 && t - last > 6) { last = t; hits.push(+t.toFixed(2)); }
    }
    prev = g; prevT = t; onProgress && onProgress(Math.min(1, t / total), hits.length);
  };
  try {
    v.playbackRate = 4;
    await v.play();
    await new Promise(res => {
      v.onended = res;
      if (v.requestVideoFrameCallback) { const tick = () => { if (v.ended) return; sample(); v.requestVideoFrameCallback(tick); }; v.requestVideoFrameCallback(tick); }
      else { const iv = setInterval(() => { if (v.ended || v.paused) { clearInterval(iv); res(); return; } sample(); }, 30); }
    });
  } finally { v.pause(); v.remove(); }
  return hits;
}
// The run's highlight tape: every play back to back, credited to whoever made it.
function playTape(g, list, ps) {
  if (!list.length) return; track('tape_watch', { n: list.length });
  let i = 0;
  const el = document.createElement('div'); el.className = 'rv tape'; document.body.append(el); document.documentElement.style.overflow = 'hidden';
  el.innerHTML = `<div class="rv-top"><b>${esc(g.title)}</b><button class="rv-x" data-x aria-label="Close">✕</button></div>
    <div class="rv-vw"><video class="rv-v" playsinline autoplay></video><button class="rv-fs" data-fs aria-label="Full screen">⤢</button></div>
    <div class="tp-cap"></div><div class="tp-bar"></div>
    <div class="rv-nav"><button class="btn g" data-prev>‹</button><button class="btn" data-next>Next ›</button></div>`;
  const v = el.querySelector('video'), cap = el.querySelector('.tp-cap'), bar = el.querySelector('.tp-bar');
  const show = () => {
    const h = list[i], p = h.player_id && ps.find(x => x.id === h.player_id);
    v.src = storage.url(h.path); v.play().catch(() => {});
    cap.innerHTML = `<span class="cap">${esc(h.play_type || 'Play')}</span> <b>${p ? esc(p.label) : 'Unknown player'}</b>${p && p.user_id ? '' : ' <span class="mu">· is this you? Tap Review plays</span>'}`;
    bar.innerHTML = list.map((_, k) => `<i class="${k < i ? 'd' : k === i ? 'on' : ''}"></i>`).join('');
  };
  const close = () => { v.pause(); el.remove(); document.documentElement.style.overflow = ''; };
  v.onended = () => { if (i < list.length - 1) { i++; show(); } else { cap.innerHTML += ' <span class="mu">· end of the run</span>'; } };
  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.x !== undefined) return close();
    if (b.dataset.next !== undefined) { if (i < list.length - 1) { i++; show(); } else close(); return; }
    if (b.dataset.prev !== undefined) { i = Math.max(0, i - 1); show(); return; }
    if (b.dataset.fs !== undefined) { try { if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); else if (v.requestFullscreen) await v.requestFullscreen(); } catch (err) { /* not allowed */ } }
  });
  show();
}
// ---------- Stories: 24-hour photo/video posts with stickers, like IG but built for hoopers.
const STICKERS = [
  { v: '🏀', a: 'spin' }, { v: '🔥', a: 'pulse' }, { v: '💯', a: 'bounce' }, { v: '😤', a: 'shake' }, { v: '🙏🏾' }, { v: '👑', a: 'bounce' }, { v: '💪🏾', a: 'pulse' }, { v: '🎯' }, { v: '🪣', a: 'bounce' }, { v: '🧊' }, { v: '🥶', a: 'shake' }, { v: '👀' },
  { v: 'BUCKETS', k: 'tag', a: 'pulse' }, { v: 'LOCKED IN', k: 'tag' }, { v: 'GAME TIME', k: 'tag', a: 'bounce' }, { v: 'RUN IT BACK', k: 'tag' }, { v: 'COOKING', k: 'tag', a: 'shake' }, { v: 'W', k: 'tag big', a: 'pulse' }, { v: 'WHO GOT NEXT?', k: 'tag' }, { v: 'GET UP EARLY', k: 'tag' },
];
// Jamoja Beats: original tracks made for Jamoja, so stories can have music with no license issues.
const BEATS = [{ id: 'courtside', n: 'Courtside', m: 'Boom bap · 90' }, { id: 'clutch', n: 'Clutch', m: 'Trap · 140' }, { id: 'morning-run', n: 'Morning Run', m: 'Lo-fi · 82' }, { id: 'warmup', n: 'Warmup', m: 'House · 122' }, { id: 'next-up', n: 'Next Up', m: 'Drill · 142' }, { id: 'bounce', n: 'Bounce', m: 'West coast · 96' }];
const beatUrl = id => `beats/${id}.m4a?v=1`;
const GIFS = ['swish', 'onfire', 'buckets', 'andone', 'crown', 'plus2', 'plus3', 'cooking', 'icecold'];
const gifUrl = n => `gifs/${n}.webp?v=1`;
const seenStory = id => { try { return (localStorage.getItem('jm.ss') || '').includes(id); } catch (e) { return false; } };
const markStory = id => { try { const v = (localStorage.getItem('jm.ss') || '').split(',').slice(-300); if (!v.includes(id)) v.push(id); localStorage.setItem('jm.ss', v.join(',')); } catch (e) { /* private */ } };
async function storyRail(host) {
  if (!host) return;
  if (ME && !window.LAST_COURT) games.mine(ME.id).then(l => { const g = l.find(x => x.place); if (g) window.LAST_COURT = g.place; }).catch(() => {});
  const all = await stories.live().catch(() => []);
  const fol = ME ? await follows.ids(ME.id).catch(() => []) : [];
  const by = new Map(); for (const st of all) { if (!st.user) continue; if (!by.has(st.user_id)) by.set(st.user_id, { u: st.user, list: [] }); by.get(st.user_id).list.push(st); }
  const groups = [...by.values()].sort((a, b) => (ME && b.u.id === ME.id) - (ME && a.u.id === ME.id) || fol.includes(b.u.id) - fol.includes(a.u.id) || (a.list.every(x => seenStory(x.id)) - b.list.every(x => seenStory(x.id))));
  await storage.prep(groups.map(g => g.u.avatar).filter(Boolean));
  const mineG = ME && groups.find(g => g.u.id === ME.id);
  if (!host.isConnected || (!groups.length && !ME)) return;
  host.innerHTML = `<div class="strail">${ME && !mineG ? `<button class="stb add" data-new>${avatar(MYP, 62)}<i>+</i><span>Your story</span></button>` : ''}
    ${groups.map((g, k) => `<button class="stb ${g.list.every(x => seenStory(x.id)) ? 'seen' : ''}" data-g="${k}">${avatar(g.u, 62)}<span>${ME && g.u.id === ME.id ? 'Your story' : esc((g.u.name || '').split(' ')[0])}</span></button>`).join('')}</div>`;
  host.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.new !== undefined) return newStory(); openStories(groups, +b.dataset.g, () => storyRail(host)); };
}
// iPhone needs the file input to live in the page; a detached one can get lost mid-pick and leave the picker stuck.
function newStory() {
  let inp = document.getElementById('storypick');
  if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.id = 'storypick'; inp.accept = 'image/*,video/*'; inp.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'; document.body.append(inp); }
  inp.value = '';
  inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) storyEditor(f); };
  inp.click();
}
function storyEditor(file) {
  const isVid = file.type.startsWith('video');
  const url = URL.createObjectURL(file); const items = [];
  const el = document.createElement('div'); el.className = 'sted'; document.body.append(el); document.documentElement.style.overflow = 'hidden';
  el.innerHTML = `<div class="st-top"><button class="st-x" data-x aria-label="Close">✕</button><div class="st-tools"><button class="st-aa" data-text>Aa</button><button class="st-aa" data-stk>🙂 Stickers</button><button class="st-aa" data-mus>♫ Music</button></div></div>
    <div class="st-stage">${isVid ? `<video src="${url}" autoplay loop muted playsinline></video>` : `<img src="${url}" alt="">`}<div class="st-ov"></div><div class="st-trash" hidden>🗑</div></div>
    <div class="st-tray" hidden><p class="st-h">GIFs</p><div class="st-gifs">${GIFS.map(n => `<button data-gif="${n}"><img src="${gifUrl(n)}" alt="${n}" loading="lazy"></button>`).join('')}</div><p class="st-h">Stickers</p><div class="st-grid">${STICKERS.map((x, k) => `<button data-s="${k}" class="${x.k ? 'st-tagb' : ''}">${esc(x.v)}${x.a ? '<sup>✨</sup>' : ''}</button>`).join('')}
      ${(window.LAST_COURT ? `<button data-court class="st-tagb">📍 ${esc(window.LAST_COURT)}</button>` : '')}</div><p class="mu" style="font-size:12px;margin:6px 0 0">✨ = animated. Drag to move, pinch or use the slider to resize, drag onto 🗑 to remove.</p></div>
    <div class="st-mus" hidden>${BEATS.map(x => `<button data-beat="${x.id}"><b>♫ ${esc(x.n)}</b><span>${esc(x.m)}</span></button>`).join('')}<button data-beat=""><b>No music</b><span>${isVid ? 'Keep the video sound' : 'Silent'}</span></button><p class="mu" style="font-size:12px;margin:6px 2px 0">Jamoja Beats are made for Jamoja. Free to use anywhere you share.</p></div>
    <div class="st-size" hidden><span>Size</span><input type="range" min="0.4" max="3" step="0.05" value="1"><button data-desel>Done</button></div>
    <div class="st-mchip" hidden></div>
    <div class="st-ted" hidden><div class="st-ted-top"><button class="st-aa" data-tbg>A̲ Style</button><button class="btn" data-tdone>Done</button></div><div class="st-ted-mid"><div class="st-ted-in sk-x" contenteditable="true" enterkeyhint="done" spellcheck="false"></div></div><div class="st-cols">${TCOLS.map(c => `<button data-tc="${c}" style="background:${c}" aria-label="Color"></button>`).join('')}</div></div>
    <div class="st-bot"><span class="mu" id="stmsg"></span><button class="btn" data-post>Share to story</button></div>`;
  const ov = el.querySelector('.st-ov'), trash = el.querySelector('.st-trash'); let music = '', au = null;
  if (!window.LAST_COURT && ME) games.mine(ME.id).then(l => { const g = l.find(x => x.place); if (g && el.isConnected) { window.LAST_COURT = g.place; el.querySelector('.st-grid').insertAdjacentHTML('beforeend', `<button data-court class="st-tagb">📍 ${esc(g.place)}</button>`); } }).catch(() => {});
  let selK = null; const size = el.querySelector('.st-size'), range = size.querySelector('input');
  const paint = () => { ov.innerHTML = items.map((it, k) => stickerHTML(it, k, k === selK)).join(''); size.hidden = selK === null; if (selK !== null) range.value = items[selK].s || 1; };
  const select = k => { selK = k; paint(); };
  range.addEventListener('input', () => { if (selK === null) return; items[selK].s = +range.value; const n = ov.querySelector(`[data-k="${selK}"]`); if (n) n.style.setProperty('--s', range.value); });
  const add = it => { items.push({ x: 0.5, y: 0.4, s: 1, ...it }); selK = items.length - 1; paint(); el.querySelector('.st-tray').hidden = true; };
  const close = () => { if (au) au.pause(); el.remove(); URL.revokeObjectURL(url); document.documentElement.style.overflow = ''; };
  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.x !== undefined) return close();
    if (b.dataset.desel !== undefined) return select(null);
    if (b.dataset.stk !== undefined) { const t = el.querySelector('.st-tray'); t.hidden = !t.hidden; el.querySelector('.st-mus').hidden = true; return; }
    if (b.dataset.mus !== undefined) { const t = el.querySelector('.st-mus'); t.hidden = !t.hidden; el.querySelector('.st-tray').hidden = true; return; }
    if (b.dataset.beat !== undefined) {
      music = b.dataset.beat; if (au) au.pause();
      const v = el.querySelector('.st-stage video'); if (v) v.muted = true;
      if (music) { au = new Audio(beatUrl(music)); au.loop = true; au.play().catch(() => {}); }
      else if (v) { v.muted = false; }
      el.querySelectorAll('[data-beat]').forEach(x => x.classList.toggle('on', x.dataset.beat === music));
      const ch = el.querySelector('.st-mchip'); const bt = BEATS.find(x => x.id === music); ch.hidden = !bt; ch.innerHTML = bt ? `♫ ${esc(bt.n)} <button data-beat="" aria-label="Remove music">✕</button>` : '';
      el.querySelector('.st-mus').hidden = true; return;
    }
    if (b.dataset.text !== undefined) return openText(null);
    if (b.dataset.tc) { ted.c = b.dataset.tc; styleTed(); tin.focus(); return; }
    if (b.dataset.tbg !== undefined) { ted.bg = ((ted.bg || 0) + 1) % 3; styleTed(); tin.focus(); return; }
    if (b.dataset.tdone !== undefined) return doneText();
    if (b.dataset.gif) return add({ t: 'gif', v: b.dataset.gif, s: 1 });
    if (b.dataset.s !== undefined) { const x = STICKERS[+b.dataset.s]; return add({ t: x.k ? 'tag' : 'emoji', v: x.v, a: x.a || '', big: /big/.test(x.k || '') }); }
    if (b.dataset.court !== undefined) return add({ t: 'tag', v: '📍 ' + window.LAST_COURT });
    if (b.dataset.post !== undefined) {
      // Close right away and finish in the background, so nobody sits and waits on the upload.
      const overlay = { items: items.map(x => ({ ...x })), music };
      if (au) au.pause(); el.remove(); document.documentElement.style.overflow = ''; if (location.hash !== '' && location.hash !== '#/') go('#/');
      const pill = document.createElement('div'); pill.className = 'st-pill'; pill.textContent = 'Posting your story… keep Jamoja open'; document.body.append(pill);
      try {
        let path, kind;
        const fast = isVid && file.size <= 50 * 1048576 && /^video\/(mp4|quicktime)$/.test(file.type);
        if (fast) { const ext = file.type === 'video/quicktime' ? 'mov' : 'mp4'; path = `${ME.id}/stories/${Date.now()}.${ext}`; await storage.upload(path, file, file.type); kind = 'video'; }
        else if (isVid) {
          const src = await E.analyze(file); const end = Math.min(15, src.dur || 15);
          const c = await E.cut(src, 0, end, pr => { pill.textContent = `Posting your story… ${Math.round(pr * 100)}%`; });
          E.close(src); path = `${ME.id}/stories/${Date.now()}.mp4`; pill.textContent = 'Posting your story… keep Jamoja open'; await storage.upload(path, c.video, 'video/mp4'); kind = 'video';
        } else { const j = await toJpeg(file); path = `${ME.id}/stories/${Date.now()}.jpg`; await storage.upload(path, j, 'image/jpeg'); kind = 'photo'; }
        await stories.add({ kind, path, overlay }); track('story_post', { kind, stickers: overlay.items.length, music });
        pill.remove(); toast('Your story is up. It stays for 24 hours.'); if (location.hash === '' || location.hash === '#/') home();
      } catch (err) { pill.remove(); toast('Story did not post: ' + (err.message || err)); }
      URL.revokeObjectURL(url); return;
    }
  });
  // Text like Instagram: big text typed right on top of the photo, pick a color and a style, tap Done. Tap text later to edit it.
  const tedEl = el.querySelector('.st-ted'), tin = el.querySelector('.st-ted-in'); let ted = null;
  const styleTed = () => { tin.className = 'st-ted-in ' + textCls(ted); tin.style.cssText = textCss(ted); };
  const openText = k => { ted = k === null ? { t: 'text', v: '', c: '#ffffff', bg: 0, x: 0.5, y: 0.4, s: 1, r: 0 } : { ...items[k], k }; tin.textContent = ted.v; styleTed(); tedEl.hidden = false; select(null); ov.style.visibility = 'hidden'; el.classList.add('editing'); setTimeout(() => { tin.focus(); const r = document.createRange(); r.selectNodeContents(tin); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }, 30); };
  const doneText = () => { if (!ted) return; const v = tin.innerText.replace(/\s+$/, '').slice(0, 120); const k = ted.k; delete ted.k; ted.v = v;
    if (k != null) { if (v) items[k] = ted; else items.splice(k, 1); } else if (v) items.push(ted);
    ted = null; tin.blur(); tedEl.hidden = true; ov.style.visibility = ''; el.classList.remove('editing'); selK = null; paint(); };
  tin.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doneText(); } });
  // One finger drags. Two fingers pinch to resize and twist to rotate (the second finger can land anywhere). Tap text to edit it.
  let drag = null, moved = false, downAt = 0; const pts = new Map(); let pinch = null;
  const ang = (a, b2) => Math.atan2(b2.y - a.y, b2.x - a.x) * 180 / Math.PI;
  const setT = k => { const n = ov.querySelector(`[data-k="${k}"]`); if (n) { n.style.setProperty('--s', items[k].s || 1); n.style.setProperty('--r', (items[k].r || 0) + 'deg'); } };
  ov.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { ov.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault();
    if (pts.size === 2) { const k = drag !== null ? drag : selK !== null ? selK : items.length - 1; if (k < 0) return; if (selK !== k) select(k); const [a, b2] = [...pts.values()]; pinch = { k, d: Math.hypot(a.x - b2.x, a.y - b2.y) || 1, a: ang(a, b2), s: items[k].s || 1, r: items[k].r || 0 }; drag = null; trash.hidden = true; return; }
    const s2 = e.target.closest('[data-k]'); if (!s2) { select(null); return; }
    drag = +s2.dataset.k; moved = false; downAt = Date.now(); if (selK !== drag) select(drag);
  });
  ov.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; const p0 = pts.get(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) { const [a, b2] = [...pts.values()]; const it = items[pinch.k]; it.s = Math.min(4, Math.max(0.3, pinch.s * Math.hypot(a.x - b2.x, a.y - b2.y) / pinch.d)); let r = pinch.r + ang(a, b2) - pinch.a; const snap = Math.round(r / 90) * 90; if (Math.abs(r - snap) < 4) r = snap; it.r = Math.round(r); setT(pinch.k); range.value = it.s; return; }
    if (drag === null) return; if (!moved && Math.hypot(e.clientX - p0.x, e.clientY - p0.y) < 2) return; moved = true; trash.hidden = false;
    const r = ov.getBoundingClientRect(); items[drag].x = Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width)); items[drag].y = Math.min(0.98, Math.max(0.02, (e.clientY - r.top) / r.height));
    const n = ov.querySelector(`[data-k="${drag}"]`); n.style.left = items[drag].x * 100 + '%'; n.style.top = items[drag].y * 100 + '%';
    const t = trash.getBoundingClientRect(); trash.classList.toggle('on', e.clientY > t.top - 20 && Math.abs(e.clientX - (t.left + t.width / 2)) < 60);
  });
  const up = e => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    if (drag === null) return; const k = drag; drag = null;
    if (moved && trash.classList.contains('on')) { items.splice(k, 1); selK = null; }
    else if (!moved && Date.now() - downAt < 350 && items[k] && items[k].t === 'text') { trash.hidden = true; return openText(k); }
    trash.hidden = true; trash.classList.remove('on'); paint();
  };
  ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
}
const TCOLS = ['#ffffff', '#0a0a0b', '#ff5a1f', '#ffd23f', '#3ddc84', '#38bdf8', '#a78bfa', '#ff4d6d'];
function textCls(it) { return 'sk-x tb' + (it.bg || 0); }
function textCss(it) { const c = it.c || '#ffffff', dark = /^#(0a|00|11)/.test(c); return it.bg === 1 ? `--tc:${dark ? '#fff' : '#0a0a0b'};--tbg:${c}` : it.bg === 2 ? `--tc:${c};--tbg:rgba(0,0,0,.6)` : `--tc:${c};--tbg:transparent`; }
function stickerHTML(it, k, sel) {
  const cls = it.t === 'emoji' ? 'sk-e' : it.t === 'tag' ? 'sk-t' + (it.big ? ' big' : '') : it.t === 'gif' ? 'sk-g' : textCls(it);
  const inner = it.t === 'gif' ? `<img src="${gifUrl(it.v)}" alt="" draggable="false">` : `<span>${esc(it.v)}</span>`;
  return `<div class="sk ${cls} ${it.a ? 'an-' + it.a : ''} ${sel ? 'sel' : ''}" ${k != null ? `data-k="${k}"` : ''} style="left:${(it.x * 100).toFixed(1)}%;top:${(it.y * 100).toFixed(1)}%;--s:${it.s || 1};--r:${it.r || 0}deg;${it.t === 'text' ? textCss(it) : ''}">${inner}</div>`;
}
function openStories(groups, gi, onClose) {
  let g = gi, i = Math.max(0, groups[gi].list.findIndex(x => !seenStory(x.id))), timer = null; const au = new Audio(); au.loop = true;
  const el = document.createElement('div'); el.className = 'stv'; document.body.append(el); document.documentElement.style.overflow = 'hidden';
  const close = () => { clearTimeout(timer); au.pause(); el.remove(); document.documentElement.style.overflow = ''; onClose && onClose(); };
  const next = () => { if (i < groups[g].list.length - 1) i++; else if (g < groups.length - 1) { g++; i = 0; } else return close(); show(); };
  const prev = () => { if (i > 0) i--; else if (g > 0) { g--; i = groups[g].list.length - 1; } show(); };
  const show = async () => {
    clearTimeout(timer); const G = groups[g], st = G.list[i], mine = ME && G.u.id === ME.id;
    markStory(st.id); if (!mine && ME) stories.view(st.id);
    await storage.prep([st.path]);
    const bt = BEATS.find(x => st.overlay && x.id === st.overlay.music);
    if (bt) { if (!au.src.includes(bt.id)) { au.src = beatUrl(bt.id); } au.play().catch(() => {}); } else au.pause();
    const mins = Math.round((Date.now() - new Date(st.created_at)) / 60e3); const ago = mins < 1 ? 'now' : mins < 60 ? mins + 'm' : Math.round(mins / 60) + 'h';
    el.innerHTML = `<div class="stv-bars">${G.list.map((x, k) => `<i class="${k < i ? 'd' : ''}"><b class="${k === i ? 'run' : ''}"></b></i>`).join('')}</div>
      <div class="stv-h"><a href="#/u/${esc(G.u.handle)}" data-x>${avatar(G.u, 34)}<span class="stv-who"><b>${esc(G.u.name)}</b> <span class="mu">${ago}</span>${bt ? `<br><span class="stv-mus">♫ ${esc(bt.n)} · Jamoja Beats</span>` : ''}</span></a><button data-x>✕</button></div>
      <div class="stv-m">${st.kind === 'video' ? `<video src="${esc(storage.url(st.path))}" autoplay playsinline></video>` : `<img src="${esc(storage.url(st.path))}" alt="">`}<div class="st-ov">${((st.overlay && st.overlay.items) || []).map(it => stickerHTML(it)).join('')}</div>
        <button class="stv-l" aria-label="Previous"></button><button class="stv-r" aria-label="Next"></button></div>
      ${mine ? `<div class="stv-f"><button class="btn g" data-seen>👁 Seen by…</button><button class="btn g" data-del>Delete</button><button class="btn" data-new>+ Add</button></div>` : ''}`;
    const v = el.querySelector('video'), bar = el.querySelector('.run');
    const dur = v ? null : 5000;
    if (v && bt) v.muted = true;
    if (v) { v.onloadedmetadata = () => { bar.style.animationDuration = Math.min(15, v.duration || 6) + 's'; }; v.onended = next; v.ontimeupdate = () => { if (v.currentTime >= 15) { v.ontimeupdate = null; next(); } }; v.onerror = () => { timer = setTimeout(next, 1500); }; v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); }
    else { bar.style.animationDuration = dur / 1000 + 's'; timer = setTimeout(next, dur); }
  };
  el.addEventListener('click', async e => {
    const b = e.target.closest('button,a'); if (!b) return;
    if (b.dataset.x !== undefined) return close();
    if (b.classList.contains('stv-r')) return next();
    if (b.classList.contains('stv-l')) return prev();
    const st = groups[g].list[i];
    if (b.dataset.new !== undefined) { close(); return newStory(); }
    if (b.dataset.del !== undefined) { if (!confirmIn(b)) return; await stories.remove(st.id).catch(err => toast(err.message)); groups[g].list.splice(i, 1); if (!groups[g].list.length) return close(); i = Math.min(i, groups[g].list.length - 1); return show(); }
    if (b.dataset.seen !== undefined) { clearTimeout(timer); const vs = await stories.viewers(st.id).catch(() => []); b.textContent = vs.length ? `👁 ${vs.length}: ${vs.slice(0, 4).map(x => x.name.split(' ')[0]).join(', ')}${vs.length > 4 ? '…' : ''}` : '👁 No views yet'; }
  });
  show();
}
// ---------- Stats (admin only): the numbers that tell us if Jamoja is working.
async function statsPage() {
  if (!ME || !(await events.isAdmin(ME.id).catch(() => false))) { V.innerHTML = `<h1>Not found</h1><a class="btn" href="#/">Go home</a>`; return; }
  const days = +(qs().get('d') || 7);
  V.innerHTML = `<h1>Stats</h1><p class="mu">Loading…</p>`;
  let s; try { s = await events.stats(days); } catch (e) { V.innerHTML = `<h1>Stats</h1><p class="err">${esc(e.message)}</p>`; return; }
  const n = s.now || {}, pv = s.prev || {}, t = s.totals || {};
  const tile = (label, k, hint) => { const a = n[k] || 0, b = pv[k] || 0, d = a - b; return `<div class="st"><b>${a}</b><span>${label}</span><i class="${d > 0 ? 'up' : d < 0 ? 'dn' : ''}">${d > 0 ? '▲ ' + d : d < 0 ? '▼ ' + (-d) : 'same'}</i>${hint ? `<small>${hint}</small>` : ''}</div>`; };
  const daily = s.daily || []; const mx = Math.max(1, ...daily.map(x => x.n));
  V.innerHTML = `<div class="row" style="justify-content:space-between;align-items:baseline"><h1>Stats</h1><span class="row" style="gap:6px">${[7, 30].map(d => `<a class="chip ${d === days ? 'on' : ''}" href="#/stats?d=${d}">${d} days</a>`).join('')}</span></div>
    <p class="mu" style="margin-top:-6px">Last ${days} days vs the ${days} before.</p>
    <h2>Is it growing?</h2><div class="stg">${tile('active people', 'active')}${tile('signups', 'signups')}${tile('active members', 'active_users')}<div class="st"><b>${s.retention == null ? '·' : s.retention + '%'}</b><span>came back</span><small>of last period's members</small></div></div>
    <div class="card spark">${daily.length ? daily.map(x => `<div title="${esc(x.d)}: ${x.n}"><i style="height:${Math.round(x.n / mx * 100)}%"></i><span>${esc(x.d.split(' ')[1])}</span></div>`).join('') : '<p class="mu">Daily active people show here once the app logs opens.</p>'}</div>
    <h2>Is the core working?</h2><div class="stg">${tile('runs posted', 'runs_posted')}${tile('games filmed', 'games_filmed')}${tile('highlights made', 'highlights')}${tile('plays claimed', 'claims')}${tile('live streams', 'lives')}${tile('rim scans', 'rim_scans')}${tile('Auto Bucket', 'auto_bucket')}${tile('reviews', 'reviews')}</div>
    <h2>Is it spreading?</h2><div class="stg">${tile('shares', 'shares')}${tile('reels saved', 'reels')}${tile('follows', 'follows')}${tile('DMs', 'dms')}</div>
    <h2>Are people engaging?</h2><div class="stg">${tile('posts', 'posts')}${tile('fires', 'fires')}${tile('comments', 'comments')}</div>
    <h2>All time</h2><div class="stg"><div class="st"><b>${t.users || 0}</b><span>members</span></div><div class="st"><b>${t.highlights || 0}</b><span>highlights</span></div><div class="st"><b>${t.claimed_share == null ? '·' : t.claimed_share + '%'}</b><span>plays claimed</span><small>the growth loop</small></div><div class="st"><b>${t.push_on || 0}</b><span>notifications on</span></div><div class="st"><b>${t.installed || 0}</b><span>on Home Screen</span></div></div>
    ${(s.top_courts || []).length ? `<h2>Top courts</h2><div class="list">${s.top_courts.map(c => `<a href="${courtUrl(c.place)}"><span>📍 ${esc(c.place)}</span><span class="mu">${c.runs} run${c.runs === 1 ? '' : 's'}</span></a>`).join('')}</div>` : ''}
    <p class="mu" style="font-size:13px;margin-top:18px">Shares, opens, reels, scans and reviews are counted from today on. Everything else counts from the start.</p>`;
}
// ---------- Review plays: one clip at a time, big buttons. A right guess costs one tap (Next).
const QUICK = { Basketball: ['Bucket', 'Three', 'Layup', 'Rebound', 'Block', 'Steal', 'Dime', 'Miss'] };
function reviewPlays(g, list, ps, own, gameId) {
  if (!list.length) return; track('review_open', { n: list.length, own: !!own });
  const types = QUICK[g.sport] || playsFor(g.sport).slice(0, 8);
  const more = [...new Set([...playsFor(g.sport), 'Miss'])].filter(t => !types.includes(t));
  const myPid = () => { const p = ps.find(x => ME && x.user_id === ME.id); return p && p.id; };
  let i = 0, changed = false;
  const el = document.createElement('div'); el.className = 'rv'; document.body.append(el); document.documentElement.style.overflow = 'hidden';
  const close = () => { el.remove(); document.documentElement.style.overflow = ''; if (/review=/.test(location.hash)) history.replaceState(null, '', '#/g/' + gameId); if (changed) gamePage(gameId); };
  const draw = () => {
    const h = list[i]; const mine = h.player_id && h.player_id === myPid();
    const who = h.player_id ? (ps.find(p => p.id === h.player_id) || {}) : null;
    const cur = h.play_type || '';
    el.innerHTML = `<div class="rv-top"><b>Play ${i + 1} of ${list.length}</b><button class="rv-x" data-x aria-label="Close">✕</button></div>
      <div class="rv-vw"><video class="rv-v" src="${esc(storage.url(h.path))}" poster="${esc(storage.url(h.poster))}" playsinline autoplay loop muted></video><button class="rv-fs" data-fs aria-label="Full screen">⤢</button><span class="rv-hint">Tap to zoom</span></div>
      <div class="rv-p">
        ${own ? `<div class="rv-l">What was it?${cur ? '' : ' <span class="mu">(pick one)</span>'}</div>
        <div class="rv-c">${types.map(t => `<button class="chip ${cur === t ? 'on' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}<select data-more aria-label="More play types"><option value="">More…</option>${more.map(t => `<option ${cur === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}<option value="Warmup">Warmup (hide it)</option></select></div>` : `<div class="rv-l">${cur ? esc(cur) : 'Play'}</div>`}
        <div class="rv-l" style="margin-top:12px">Who?</div>
        <div class="rv-c">${mine ? `<span class="chip on">✓ You</span><button class="chip" data-notme>Not me</button>`
          : who && who.user_id ? `<span class="chip on">${esc(who.label || 'Tagged')}</span>`
          : `${h.suggest ? '<span class="chip sug">👀 Might be you</span>' : ''}<button class="chip me" data-me>🙋 That's me</button><span class="mu rv-nm">Not you? Just tap Next. It stays in the run's tape.</span>${own ? `<select data-who aria-label="Someone else"><option value="">Someone else…</option>${ps.filter(p => !p.user_id || p.id !== myPid()).map(p => `<option value="${p.id}" ${h.player_id === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select>` : ''}`}</div>
      </div>
      <div class="rv-nav"><button class="btn g" data-prev ${i ? '' : 'disabled'}>‹ Back</button>${own ? `<button class="btn g" data-del title="Delete for everyone">Bad clip</button>` : ''}<button class="btn" data-next>${i === list.length - 1 ? 'Done ✓' : 'Next ›'}</button></div>`;
  };
  const go2 = d => { i = Math.max(0, Math.min(list.length - 1, i + d)); draw(); };
  const save1 = async (patch) => { try { await highlights.update(list[i].id, patch); Object.assign(list[i], patch); changed = true; } catch (e) { toast(e.message); } };
  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return; const h = list[i];
    if (b.dataset.x !== undefined) return close();
    if (b.dataset.fs !== undefined) { const v = el.querySelector('.rv-v'); v.muted = false; try { if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); else if (v.requestFullscreen) await v.requestFullscreen(); } catch (err) { /* not allowed */ } v.play().catch(() => {}); return; }
    if (b.dataset.next !== undefined) { if (i === list.length - 1) { toast('All set.'); return close(); } return go2(1); }
    if (b.dataset.prev !== undefined) return go2(-1);
    if (b.dataset.t) { track('play_type', { t: b.dataset.t, changed: (list[i].play_type || '') !== b.dataset.t }); await save1({ play_type: b.dataset.t }); draw(); setTimeout(() => { if (i < list.length - 1) go2(1); }, 250); return; }
    if (b.dataset.me !== undefined) { try { const pid = await highlights.claimMine(h.id); track('play_claim'); h.player_id = pid; if (!ps.find(p => p.id === pid)) ps.push({ id: pid, user_id: ME.id, label: (MYP && MYP.name) || 'Me' }); changed = true; draw(); } catch (err) { toast(err.message); } return; }
    if (b.dataset.notme !== undefined) { try { await highlights.unclaimMine(h.id); h.player_id = null; changed = true; draw(); } catch (err) { toast(err.message); } return; }
    if (b.dataset.del !== undefined) { if (!confirmIn(b)) return; try { await highlights.remove(h.id); list.splice(i, 1); changed = true; if (!list.length) return close(); i = Math.min(i, list.length - 1); draw(); } catch (err) { toast(err.message); } }
  });
  el.addEventListener('click', e => {
    const v = e.target.closest('.rv-v'); if (!v) return;
    const r = v.getBoundingClientRect(); const z = v.classList.toggle('zoom');
    v.style.transformOrigin = `${((e.clientX - r.left) / r.width * 100).toFixed(0)}% ${((e.clientY - r.top) / r.height * 100).toFixed(0)}%`;
    const hint = el.querySelector('.rv-hint'); if (hint) hint.textContent = z ? 'Tap to zoom out' : 'Tap to zoom';
  });
  el.addEventListener('change', async e => {
    if (e.target.dataset.more !== undefined && e.target.value) { await save1({ play_type: e.target.value }); draw(); }
    if (e.target.dataset.who !== undefined) { await save1({ player_id: e.target.value || null }); draw(); }
  });
  let sx = 0; el.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 60 && !e.target.closest('select')) go2(dx < 0 ? 1 : -1); });
  draw();
}
// One tap to go live: reuse your run from today, or start a new one, then open its Game day card.
async function quickLive() {
  const q = document.getElementById('qlive'); if (q) q.disabled = true;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const mine = await games.mine(ME.id).catch(() => []);
    let g = mine.find(x => x.played_on === today);
    if (!g) {
      const at = new Date();
      g = await games.create({ owner_id: ME.id, title: 'Run ' + at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), sport: (MYP && MYP.sport) || 'Basketball', place: '', played_on: today, starts_at: at.toISOString(), notes: null });
    }
    if (!g.place || g.lat == null) { if (q) q.innerHTML = '📍 Finding your court…'; await stampSpot(g); }
    location.hash = '#/g/' + g.id + '?live=1';
  } catch (e) { toast(e.message || 'Could not start live. Try again.'); if (q) q.disabled = false; }
}
async function composer() {
  if (!ME) return needLogin('#/post');
  setTimeout(() => { const q = document.getElementById('qlive'); if (q) q.onclick = quickLive; }, 0);
  let att = null; // {kind, file?, yt?}
  V.innerHTML = `<div class="row" style="gap:8px;margin-bottom:14px;flex-wrap:nowrap"><button class="btn gd-live" id="qlive" type="button" style="flex:1"><span class="lvdot"></span> Go live</button><a class="btn g" href="#/new" style="flex:1;min-height:58px;display:flex;align-items:center;justify-content:center">📍 Post a run</a></div>
    <h1>New post</h1>
    <div class="card"><div class="row" style="flex-wrap:nowrap;align-items:flex-start;gap:10px">${avatar(MYP, 40)}<textarea id="pt" class="t ta" maxlength="1000" rows="4" placeholder="What's up? A workout, a big win, a run you're putting together…"></textarea></div>
      <div id="att"></div>
      <div class="row" style="margin-top:10px"><label class="btn s g" for="ph">📷 Photo</label><input id="ph" type="file" accept="image/*" hidden>
        <label class="btn s g" for="vd">🎥 Video</label><input id="vd" type="file" accept="video/*" hidden>
        <button class="btn s g" id="ytb" type="button">▶ YouTube link</button></div>
      <label class="f" for="ps">Sport</label><select class="t" id="ps">${SPORTS.map(x => `<option ${MYP.sport === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <div id="pe"></div><button class="btn w" id="go" style="margin-top:14px;min-height:52px">Post</button><div id="prog" hidden><div class="bar"><b id="pb"></b></div><p class="mu" id="pm"></p></div></div>
    <a class="card film-cta" href="#/new"><span class="dot">●</span><span><b>Film a game instead</b><br><span class="mu">Record or upload a full game. Jamoja cuts the highlights and tags your crew.</span></span></a>`;
  const attEl = V.querySelector('#att'), err = m => { V.querySelector('#pe').innerHTML = m ? `<div class="err">${esc(m)}</div>` : ''; };
  const showAtt = () => {
    if (!att) { attEl.innerHTML = ''; return; }
    const x = `<button class="lnkb" id="rm" type="button">Remove</button>`;
    if (att.kind === 'photo') attEl.innerHTML = `<img class="pm" src="${att.url}" alt="">${x}`;
    else if (att.kind === 'video') { attEl.innerHTML = `<div class="ved"><video class="pm" id="ve" src="${att.url}#t=0.1" playsinline muted preload="auto"></video><div class="ovl top" id="ovTop" hidden></div><div class="ovl bot" id="ovBot" hidden></div><div class="ovl tag" id="ovTag" hidden><b>JAMOJA</b> @${esc(MYP.handle)}</div><div class="slowb" id="slowB" hidden>SLOW-MO</div></div>
      <div class="trim" id="tr2" hidden><div class="tl"><b>Trim</b><span class="mu" id="tl"></span></div>
        <label class="f" for="tst">Start <span id="ts"></span></label><input type="range" id="tst" min="0" step="0.1">
        <label class="f" for="ten">End <span id="te"></span></label><input type="range" id="ten" min="0" step="0.1">
        <button class="btn s g" id="tpv" type="button" style="margin-top:8px">▶ Preview clip</button>
        <div class="tl" style="margin-top:16px"><b>Cover</b><span class="mu">Slide to pick the thumbnail</span></div>
        <div class="cov"><canvas id="cvp" width="160" height="200"></canvas><input type="range" id="tcv" min="0" step="0.1" aria-label="Cover frame"></div>
        <div class="tl" style="margin-top:18px"><b>Quick Edit</b><span class="mu">Optional</span></div>
        <label class="f">Look</label><div class="row chips" id="lk">${[['none', 'None'], ['gameday', 'Game Day'], ['punchy', 'Punchy'], ['bw', 'B&amp;W'], ['vintage', 'Vintage'], ['night', 'Night Run']].map(([k, n]) => `<button type="button" class="chip ${k === 'none' ? 'on' : ''}" data-lk="${k}">${n}</button>`).join('')}</div>
        <label class="f" for="ebr">Brightness</label><input type="range" id="ebr" min="-0.2" max="0.2" step="0.01" value="0">
        <label class="f" for="eco">Contrast</label><input type="range" id="eco" min="0.8" max="1.4" step="0.01" value="1">
        <label class="f">Slow-mo</label><div class="row chips" id="sm">${[0, 1, 2, 3].map(n => `<button type="button" class="chip ${n ? '' : 'on'}" data-sm="${n}">${n ? n + 's' : 'Off'}</button>`).join('')}</div>
        <div id="smw" hidden><label class="f" for="sma">Slow-mo starts at <span id="smt"></span></label><input type="range" id="sma" min="0" step="0.1"></div>
        <label class="f" for="ecap">Caption on video</label><input class="t" id="ecap" maxlength="40" placeholder="Like: Tuesday run. Called game.">
        <div class="row chips" id="cps" style="margin-top:6px"><button type="button" class="chip on" data-cp="bottom">Bottom</button><button type="button" class="chip" data-cp="top">Top</button></div>
        <label class="f" for="epl">Play label</label><select class="t" id="epl"><option value="">None</option>${playsFor(MYP.sport).map(t => `<option>${esc(t)}</option>`).join('')}</select>
        <label class="chk" style="margin-top:12px"><input type="checkbox" id="etag"> Add the Jamoja tag with your @handle</label>
        <button class="btn s g" id="tpv2" type="button" style="margin-top:10px">▶ Preview with edits</button></div>
      <p class="mu" id="tw">Loading your video…</p>${x}`; editVideo(); }
    else attEl.innerHTML = `<img class="pm" src="https://i.ytimg.com/vi/${att.yt}/hqdefault.jpg" alt="">${x}`;
    V.querySelector('#rm').onclick = () => { att = null; showAtt(); };
  };
  function editVideo() {
    const v = V.querySelector('#ve'), st = V.querySelector('#tst'), en = V.querySelector('#ten'), cv = V.querySelector('#tcv'), cvs = V.querySelector('#cvp');
    let stopAt = 0, drawCover = false;
    const label = () => {
      V.querySelector('#ts').textContent = mmss(att.start); V.querySelector('#te').textContent = mmss(att.end);
      V.querySelector('#tl').textContent = `${mmss(att.start)} to ${mmss(att.end)} · ${Math.round(att.end - att.start)}s (max 60s)`;
      cv.min = att.start; cv.max = att.end; if (att.cover < att.start || att.cover > att.end) att.cover = Math.min(att.end, att.start + 1); cv.value = att.cover;
    };
    const paintCover = () => { try { const k = Math.max(cvs.width / v.videoWidth, cvs.height / v.videoHeight), w = v.videoWidth * k, h = v.videoHeight * k; const c = cvs.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, cvs.width, cvs.height); c.drawImage(v, (cvs.width - w) / 2, (cvs.height - h) / 2, w, h); } catch (e) { /* frame not ready */ } };
    const seek = t => { v.pause(); stopAt = 0; v.currentTime = t; };
    v.addEventListener('seeked', () => { if (drawCover) { drawCover = false; paintCover(); } });
    v.addEventListener('timeupdate', () => { if (stopAt && v.currentTime >= stopAt) { v.pause(); stopAt = 0; } });
    const ready = () => {
      const d = v.duration; if (!isFinite(d) || !d) return;
      att.dur = d; att.start = att.start ?? 0; att.end = att.end ?? Math.min(d, 60); att.cover = att.cover ?? Math.min(att.end, 1);
      for (const r of [st, en]) r.max = d.toFixed(1);
      st.value = att.start; en.value = att.end; label();
      V.querySelector('#tr2').hidden = false; const tw = V.querySelector('#tw');
      if (d > 90 && att.file) { tw.innerHTML = `<span class="card" style="display:block;border-color:var(--o);margin:0"><b>This looks like a full game (${mmss(d)}).</b><br><span class="mu">Posts are 60 seconds max. Let Jamoja find every bucket and cut them for you. Only the clips upload, the full video stays on your phone.</span><button class="btn w" id="fullg" type="button" style="margin-top:10px">🎯 Find my highlights</button><span class="mu" style="display:block;margin-top:6px;font-size:13px">Or pick your best 60 seconds below and post it.</span></span>`; tw.querySelector('#fullg').onclick = () => { window.PENDING_FILE = att.file; go('#/new'); }; }
      else tw.textContent = d > 60 ? 'Long video: pick the best 60 seconds.' : '';
      drawCover = true; seek(att.cover);
    };
    v.addEventListener('loadedmetadata', ready); if (v.readyState >= 1) ready();
    setTimeout(() => { if (!att || att.kind !== 'video' || att.dur) return; V.querySelector('#tw').textContent = 'Preview is not available for this video on this phone. The first 60 seconds will be posted.'; }, 6000);
    st.oninput = () => { att.start = Math.min(+st.value, att.dur - 1); if (att.end - att.start > 60) att.end = att.start + 60; if (att.end < att.start + 1) att.end = Math.min(att.dur, att.start + 1); st.value = att.start; en.value = att.end; label(); seek(att.start); };
    en.oninput = () => { att.end = Math.max(+en.value, 1); if (att.end - att.start > 60) att.start = att.end - 60; if (att.end < att.start + 1) att.start = Math.max(0, att.end - 1); st.value = att.start; en.value = att.end; label(); seek(att.end); };
    cv.oninput = () => { att.cover = +cv.value; drawCover = true; seek(att.cover); };
    V.querySelector('#tpv').onclick = () => { v.currentTime = att.start; stopAt = att.end; v.muted = false; v.play().catch(() => {}); };
    // ---- Quick Edit
    att.ed = att.ed || { look: 'none', bright: 0, contrast: 1, slowLen: 0, slowAt: 0, cap: '', capPos: 'bottom', label: '', tag: false };
    const ed = att.ed, CSSLOOK = { none: '', gameday: 'contrast(1.15) saturate(1.35) brightness(1.03)', punchy: 'contrast(1.3) saturate(1.2)', bw: 'grayscale(1) contrast(1.2)', vintage: 'sepia(.45) contrast(1.05) saturate(.85)', night: 'brightness(1.18) saturate(1.1)' };
    const paint = () => {
      v.style.filter = `${CSSLOOK[ed.look]} brightness(${1 + ed.bright * 2}) contrast(${ed.contrast})`;
      const top = V.querySelector('#ovTop'), bot = V.querySelector('#ovBot');
      const capHtml = ed.cap ? `<span class="cap2">${esc(ed.cap)}</span>` : '', lblHtml = ed.label ? `<span class="lbl">${esc(ed.label.toUpperCase())}</span>` : '';
      top.innerHTML = lblHtml + (ed.capPos === 'top' ? capHtml : ''); top.hidden = !top.innerHTML;
      bot.innerHTML = ed.capPos === 'bottom' ? capHtml : ''; bot.hidden = !bot.innerHTML;
      V.querySelector('#ovTag').hidden = !ed.tag;
      const w = V.querySelector('#smw'); w.hidden = !ed.slowLen;
      if (ed.slowLen) { const sa = V.querySelector('#sma'); sa.min = att.start; sa.max = Math.max(att.start, att.end - ed.slowLen); if (ed.slowAt < att.start || ed.slowAt > +sa.max) ed.slowAt = att.start + Math.max(0, (att.end - att.start - ed.slowLen) / 2); sa.value = ed.slowAt; V.querySelector('#smt').textContent = mmss(ed.slowAt); }
    };
    const chips = (sel, key, attr, num) => V.querySelector(sel).onclick = e => { const b = e.target.closest(`[${attr}]`); if (!b) return; V.querySelectorAll(`${sel} .chip`).forEach(x => x.classList.toggle('on', x === b)); ed[key] = num ? +b.getAttribute(attr) : b.getAttribute(attr); if (key === 'slowLen') ed.slowAt = -1; if (key === 'slowLen' && ed.slowLen > att.end - att.start - 0.6) { ed.slowLen = 0; toast('Clip is too short for that much slow-mo.'); V.querySelectorAll(`${sel} .chip`).forEach((x, i) => x.classList.toggle('on', i === 0)); } paint(); };
    chips('#lk', 'look', 'data-lk'); chips('#sm', 'slowLen', 'data-sm', true); chips('#cps', 'capPos', 'data-cp');
    V.querySelector('#ebr').oninput = e => { ed.bright = +e.target.value; paint(); };
    V.querySelector('#eco').oninput = e => { ed.contrast = +e.target.value; paint(); };
    V.querySelector('#sma').oninput = e => { ed.slowAt = +e.target.value; paint(); seek(ed.slowAt); };
    V.querySelector('#ecap').oninput = e => { ed.cap = e.target.value.trim(); paint(); };
    V.querySelector('#epl').onchange = e => { ed.label = e.target.value; paint(); };
    V.querySelector('#etag').onchange = e => { ed.tag = e.target.checked; paint(); };
    V.querySelector('#tpv2').onclick = () => {
      v.currentTime = att.start; stopAt = att.end; v.muted = false; v.playbackRate = 1; v.play().catch(() => {});
      const sb = V.querySelector('#slowB');
      v.ontimeupdate = () => { const inSlow = ed.slowLen && v.currentTime >= ed.slowAt && v.currentTime < ed.slowAt + ed.slowLen; v.playbackRate = inSlow ? 0.5 : 1; sb.hidden = !inSlow; if (v.paused) { v.playbackRate = 1; sb.hidden = true; } };
    };
    paint();
  }
  const edited = ed => ed && (ed.look !== 'none' || ed.bright || ed.contrast !== 1 || ed.slowLen || ed.cap || ed.label || ed.tag);
  // Text overlays drawn as images (Jamoja fonts), stamped onto the video.
  async function overlayPngs(ed) {
    try { await Promise.all([document.fonts.load('64px "Bebas Neue"'), document.fonts.load('700 30px Inter')]); } catch (e) { /* fallback fonts */ }
    const mk = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return new Promise(r => c.toBlob(b => b.arrayBuffer().then(a => r(new Uint8Array(a))), 'image/png')); };
    const fit = (x, t, max) => { while (x.measureText(t).width > max && t.length > 3) t = t.slice(0, -2) + '…'; return t; };
    const out = [];
    if (ed.label) out.push({ pos: 'top', png: await mk(480, 72, (x, w, h) => { x.font = '56px "Bebas Neue", Impact, sans-serif'; const t = fit(x, ed.label.toUpperCase(), w - 40); const tw = x.measureText(t).width + 36; x.fillStyle = '#ff5a1f'; x.beginPath(); (x.roundRect ? x.roundRect((w - tw) / 2, 4, tw, h - 8, 12) : x.rect((w - tw) / 2, 4, tw, h - 8)); x.fill(); x.fillStyle = '#0a0a0b'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, w / 2, h / 2 + 3); }) });
    if (ed.cap) out.push({ pos: ed.label && ed.capPos === 'top' ? 'bottom' : ed.capPos, png: await mk(500, 64, (x, w, h) => { x.font = '700 30px Inter, Arial, sans-serif'; const t = fit(x, ed.cap, w - 40); const tw = x.measureText(t).width + 32; x.fillStyle = 'rgba(0,0,0,0.6)'; x.beginPath(); (x.roundRect ? x.roundRect((w - tw) / 2, 6, tw, h - 12, 12) : x.rect((w - tw) / 2, 6, tw, h - 12)); x.fill(); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, w / 2, h / 2 + 1); }) });
    if (ed.tag) out.push({ pos: 'tag', png: await watermark('@' + MYP.handle, ed.label) });
    return out;
  }
  V.querySelector('#ph').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) { att = { kind: 'photo', file: f, url: URL.createObjectURL(f) }; showAtt(); } };
  V.querySelector('#vd').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) { att = { kind: 'video', file: f, url: URL.createObjectURL(f) }; showAtt(); } };
  V.querySelector('#ytb').onclick = () => {
    attEl.innerHTML = `<div class="lnk"><input id="yu" class="t" inputmode="url" placeholder="Paste a YouTube link" autocapitalize="off"><button class="btn s" id="yo" type="button">Add</button></div>`;
    V.querySelector('#yo').onclick = () => { const id2 = ytId(V.querySelector('#yu').value); if (!id2) return err('That does not look like a YouTube link.'); err(''); att = { kind: 'youtube', yt: id2 }; showAtt(); };
  };
  V.querySelector('#go').onclick = async () => {
    const body = V.querySelector('#pt').value.trim(), sport = V.querySelector('#ps').value;
    if (!body && !att) return err('Write something or add a photo, video or YouTube link.');
    err(''); const go2 = V.querySelector('#go'); go2.disabled = true; go2.hidden = true;
    const prog = V.querySelector('#prog'), pb = V.querySelector('#pb'), pm = V.querySelector('#pm'); prog.hidden = false;
    try {
      const row = { kind: att ? att.kind : 'text', body: body || null, sport };
      const key = `${ME.id}/posts/${Date.now()}`;
      if (att && att.kind === 'photo') { pm.textContent = 'Preparing your photo…'; const j = await toJpeg(att.file); pm.textContent = 'Uploading…'; await storage.upload(key + '.jpg', j, 'image/jpeg'); row.media = key + '.jpg'; }
      if (att && att.kind === 'video') {
        busy = true; R.keepAwake(true);
        pm.textContent = 'Getting your video ready. Keep this screen open.';
        const src = await E.analyze(att.file);
        const s0 = att.dur ? att.start : 0, e0 = Math.min(att.dur ? att.end : Math.min(src.dur || 60, 60), s0 + 60);
        const onP = p => { pb.style.width = (p * 90) + '%'; };
        let c;
        if (edited(att.ed)) {
          pm.textContent = 'Applying your edits. This can take 15 to 60 seconds. Keep this screen open.';
          const ed = att.ed;
          c = await E.edit(src, { start: s0, end: e0, cover: att.dur ? att.cover : s0 + 1, look: ed.look, bright: ed.bright, contrast: ed.contrast,
            slow: ed.slowLen ? { a: Math.max(0.3, ed.slowAt - s0), b: Math.min(e0 - s0 - 0.3, ed.slowAt - s0 + ed.slowLen) } : null, overlays: await overlayPngs(ed) }, onP);
        } else c = await E.cut(src, s0, e0, onP, att.dur ? att.cover : null);
        await E.close(src);
        pm.textContent = 'Uploading…';
        let cover = c.poster;
        if (att.dur && !edited(att.ed)) { try { cover = await grabFrame(V.querySelector('#ve'), att.cover); } catch (e) { console.warn('cover grab failed, using generated one', e); } }
        await storage.upload(key + '.mp4', c.video, 'video/mp4'); await storage.upload(key + '-p.jpg', cover, 'image/jpeg');
        row.media = key + '.mp4'; row.poster = key + '-p.jpg';
      }
      if (att && att.kind === 'youtube') row.youtube_id = att.yt;
      await posts.create(row);
      busy = false; R.keepAwake(false);
      pb.style.width = '100%'; toast('Posted.'); FEED_TAB = 'all'; FEED_SPORT = ''; go('#/');
    } catch (e) { console.error(e); busy = false; R.keepAwake(false); prog.hidden = true; go2.hidden = false; go2.disabled = false; err(e.message || 'Could not post. Try again.'); }
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

// Photo adjuster: drag to move, slider or pinch to zoom. Returns a 400x400 JPEG, or null if cancelled.
function cropPhoto(src) {
  return new Promise(async resolve => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    try { await new Promise((ok, bad) => { img.onload = ok; img.onerror = () => bad(new Error('Could not open that photo.')); img.src = typeof src === 'string' ? src : URL.createObjectURL(src); }); }
    catch (e) { toast(e.message); resolve(null); return; }
    const S = Math.min(300, window.innerWidth - 48);
    const ov = document.createElement('div'); ov.className = 'crop';
    ov.innerHTML = `<div class="cbox"><b style="font:28px var(--hd)">Adjust your photo</b><p class="mu" style="margin:0 0 10px">Drag to move. Zoom with the slider.</p>
      <div class="cvw" style="width:${S}px;height:${S}px"><canvas width="${S * 2}" height="${S * 2}" style="width:${S}px;height:${S}px"></canvas><div class="ring"></div></div>
      <input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom" class="zm">
      <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn g s" data-x>Cancel</button><button class="btn s" data-ok>Use photo</button></div></div>`;
    document.body.append(ov);
    const cv = ov.querySelector('canvas'), cx = cv.getContext('2d'), zm = ov.querySelector('.zm');
    const base = Math.max(S / img.width, S / img.height); let z = 1, ox = 0, oy = 0;
    const clamp = () => { const w = img.width * base * z, h = img.height * base * z; ox = Math.min((w - S) / 2, Math.max(-(w - S) / 2, ox)); oy = Math.min((h - S) / 2, Math.max(-(h - S) / 2, oy)); };
    const draw = (ctx, size) => { const k = size / S, w = img.width * base * z * k, h = img.height * base * z * k; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size); ctx.drawImage(img, (size - w) / 2 + ox * k, (size - h) / 2 + oy * k, w, h); };
    const paint = () => { clamp(); draw(cx, S * 2); };
    paint();
    zm.oninput = () => { z = +zm.value; paint(); };
    const pts = new Map(); let last = null, pinch = 0;
    cv.style.touchAction = 'none';
    cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY]; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } };
    cv.onpointermove = e => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) { z = Math.min(4, Math.max(1, z * d / pinch)); zm.value = z; } pinch = d; }
      else if (last) { ox += e.clientX - last[0]; oy += e.clientY - last[1]; last = [e.clientX, e.clientY]; }
      paint();
    };
    cv.onpointerup = cv.onpointercancel = e => { pts.delete(e.pointerId); pinch = 0; last = pts.size ? [...pts.values()][0] : null; };
    ov.querySelector('[data-x]').onclick = () => { ov.remove(); resolve(null); };
    ov.querySelector('[data-ok]').onclick = () => {
      const out = document.createElement('canvas'); out.width = out.height = 400; draw(out.getContext('2d'), 400);
      out.toBlob(b => { ov.remove(); if (!b) { toast('Could not use that photo. Try another one.'); resolve(null); return; } b.arrayBuffer().then(a => resolve(new Uint8Array(a))); }, 'image/jpeg', 0.88);
    };
  });
}

// ---------------- Profile setup
function setup() {
  if (!ME) return needLogin('#/setup');
  const next = qs().get('next') || '#/';
  const p = MYP || {};
  V.innerHTML = `<h1>${MYP ? 'Edit your profile' : 'Set up your profile'}</h1><p class="mu">${LOCAL ? 'Takes 20 seconds. Saved on this phone.' : 'This is what coaches, scouts and friends see.'}</p>
    <form id="pf"><div class="row" style="gap:14px;margin:8px 0 4px"><span id="avp">${avatar(p, 72)}</span><label class="btn s g" for="avf">${p.avatar ? 'Change photo' : 'Add a photo'}</label><button type="button" class="btn s g" id="avadj" ${p.avatar ? '' : 'hidden'}>Adjust</button><input id="avf" type="file" accept="image/*" hidden></div><p class="mu" id="avh" style="margin:0"></p><label class="f" for="nm">Name</label><input class="t" id="nm" value="${esc(p.name || '')}" autocomplete="name" required>
    <label class="f" for="hd">Handle</label><input class="t" id="hd" value="${esc(p.handle || '')}" placeholder="yourname" autocapitalize="off" autocorrect="off" spellcheck="false" required><p class="mu" id="hp" style="margin:4px 0 0"></p>
    <label class="f" for="sp">Main sport</label><select class="t" id="sp">${SPORTS.map(s => `<option ${p.sport === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <label class="f" for="ps">Position (optional)</label><input class="t" id="ps" value="${esc(p.position || '')}" placeholder="${esc(POS[p.sport || 'Basketball'] || '')}">
    <label class="f" for="lv">Level (optional)</label><select class="t" id="lv"><option value="">Pick one</option>${LEVELS.map(l => `<option ${p.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <label class="f" for="ct">City</label><input class="t" id="ct" value="${esc(p.city || '')}" placeholder="Anaheim, CA">
    <label class="f" for="bi">Bio (optional)</label><textarea class="t ta" id="bi" maxlength="300" rows="3" placeholder="Hoops since day one. PG. Looking for runs in OC.">${esc(p.bio || '')}</textarea>
    <div id="pe"></div><button class="btn w" style="margin-top:16px">Save profile</button></form>`;
  const nm = document.getElementById('nm'), hd = document.getElementById('hd');
  const hp = document.getElementById('hp'), sp = document.getElementById('sp'), ps = document.getElementById('ps');
  const clean = v => v.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._]/g, '').slice(0, 24);
  const showH = () => { hp.innerHTML = hd.value ? `Your profile: <b>@${esc(hd.value)}</b>. Letters, numbers, dots and underscores.` : 'Letters, numbers, dots and underscores.'; };
  nm.oninput = () => { if (!MYP) { hd.value = clean(nm.value).replace(/^[._]+|[._]+$/g, ''); showH(); } };
  hd.oninput = () => { const c = clean(hd.value); if (c !== hd.value) hd.value = c; showH(); };
  sp.onchange = () => { ps.placeholder = POS[sp.value] || ''; };
  showH();
  if (MYP && !LOCAL) { V.insertAdjacentHTML('beforeend', `<button class="btn w g" id="so" style="margin-top:24px">Sign out</button>`); document.getElementById('so').onclick = async () => { await auth.signOut(); toast('Signed out.'); go('#/'); }; }
  let avBytes = null, avSrc = p.avatar ? storage.url(p.avatar) : null;
  const setAv = bytes => { avBytes = bytes; document.getElementById('avp').innerHTML = `<img class="avi" src="${URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }))}" alt="" style="width:72px;height:72px">`; document.querySelector('label[for=avf]').textContent = 'Change photo'; document.getElementById('avadj').hidden = false; document.getElementById('avh').textContent = MYP ? 'Saving your photo…' : 'Looks good. Tap Save profile at the bottom to keep it.'; if (MYP) savePhotoNow(); };
  // Existing profiles: save the photo right away so it never depends on the button at the bottom.
  async function savePhotoNow() {
    const h = document.getElementById('avh');
    try {
      const k = `${ME.id}/avatar-${Date.now()}.jpg`;
      await storage.upload(k, avBytes, 'image/jpeg');
      const old = MYP.avatar;
      MYP = await profiles.save({ id: ME.id, name: MYP.name, handle: MYP.handle, avatar: k });
      if (old) storage.remove([old]).catch(() => {});
      p.avatar = k; avBytes = null; avSrc = storage.url(k); topbar();
      h.textContent = 'Photo saved.'; toast('Profile photo saved.');
    } catch (err) { console.error(err); h.innerHTML = `<span class="err" style="display:block">Photo did not save: ${esc(err.message)}. Try again.</span>`; toast('Photo did not save. ' + err.message); }
  }
  document.getElementById('avf').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; avSrc = f; const b2 = await cropPhoto(f); if (b2) setAv(b2); };
  document.getElementById('avadj').onclick = async () => { if (!avSrc) return; const b2 = await cropPhoto(avSrc); if (b2) setAv(b2); };
  document.getElementById('pf').onsubmit = async e => {
    e.preventDefault();
    const handle = clean(hd.value).replace(/^[._]+|[._]+$/g, '');
    if (!nm.value.trim() || handle.length < 3) { document.getElementById('pe').innerHTML = `<div class="err">Add your name and a handle of at least 3 letters or numbers.</div>`; return; }
    try {
      const sv = e.target.querySelector('button.w'); sv.disabled = true; sv.textContent = 'Saving…';
      let av = p.avatar || null;
      if (avBytes) { const k = `${ME.id}/avatar-${Date.now()}.jpg`; await storage.upload(k, avBytes, 'image/jpeg'); if (p.avatar) storage.remove([p.avatar]).catch(() => {}); av = k; }
      MYP = await profiles.save({ id: ME.id, name: nm.value.trim(), handle, sport: document.getElementById('sp').value, position: document.getElementById('ps').value.trim(), city: document.getElementById('ct').value.trim(), level: document.getElementById('lv').value || null, bio: document.getElementById('bi').value.trim() || null, avatar: av });
      toast('Profile saved.'); go(next);
    } catch (err) { const sv = e.target.querySelector('button.w'); sv.disabled = false; sv.textContent = 'Save profile'; document.getElementById('pe').innerHTML = `<div class="err">${esc(/duplicate|unique/i.test(err.message) ? 'That handle is taken. Try another.' : err.message)}</div>`; toast(err.message); }
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
  V.innerHTML = `${inAppCard()}<h1>${existing ? 'Film or add clips' : 'New game'}</h1>
    ${existing ? `<p class="mu">Adding to <b>${esc(existing.title)}</b></p>` : `<div class="card"><label class="f" for="gt" style="margin-top:0">Game name</label><input class="t" id="gt" value="Saturday Run">
      <label class="f" for="gs">Sport</label><select class="t" id="gs">${SPORTS.map(s => `<option ${MYP.sport === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <label class="f" for="gp">Where</label><div class="row" style="flex-wrap:nowrap;gap:8px"><input class="t" id="gp" value="${esc(qs().get('place') || '')}" placeholder="Court or field, city" style="flex:1"><button class="btn s g" id="gloc" type="button" aria-label="Use my location">📍 Here</button></div>
      <label class="f" for="gw">When</label><input class="t" id="gw" type="datetime-local" value="${nextHour()}">
      <label class="f" for="gn">Notes (optional)</label><input class="t" id="gn" maxlength="300" placeholder="Full court. Bring a dark and a light shirt.">
      <button class="btn w" id="sv" style="margin-top:14px;min-height:52px">Post this run</button><p class="mu" style="margin:6px 0 0;font-size:13px">It shows on everyone's Home under Runs so your crew can meet you. When you get there, open it to go live or film.</p></div>`}
    ${saved.length ? `<div class="card" style="border-color:var(--o)" id="recov"><b>Your recording is saved</b><p class="mu" style="margin:4px 0 10px">${saved.length} part${saved.length > 1 ? 's' : ''} (${mmss(saved.reduce((a, p) => a + p.dur, 0))}) saved on this phone, with ${(n => n + (n === 1 ? ' play' : ' plays'))(saved.reduce((a, p) => a + p.marks.length, 0))} marked.</p><div class="row"><button class="btn s" id="rcv">Use it</button><button class="btn s g" id="rdel">Delete it</button></div></div>` : ''}
    <div class="card"><b>Add your game</b><p class="mu" style="margin:4px 0 12px">Film right here and tap BUCKET after big plays, or upload clips you already shot.</p>
      ${R.supported() ? `<button class="btn w" id="film" style="min-height:56px;font-size:18px">● Film in Jamoja</button>` : ''}
      <label class="btn w g" for="fi" style="margin-top:8px">Upload videos</label><input id="fi" type="file" accept="video/*" multiple hidden></div>
    <div id="eng" class="mu"></div><div id="tip"></div><div id="srcs"></div>
    <div id="go" hidden><button class="btn w" id="mk" style="min-height:56px;font-size:18px">Make highlights</button><div id="prog" hidden><div class="bar"><b id="pb"></b></div><p class="mu" id="pt"></p></div></div>`;
  const eng = document.getElementById('eng');
  const showGo = () => { const g = document.getElementById('go'); if (g) g.hidden = !srcs.some(s => s.moments.some(m => m.on)); };

  async function addSource(file, extra) {
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `<b>${esc(file.name)}</b><p class="mu">Reading the video…</p>`;
    document.getElementById('srcs').append(card);
    try {
      eng.textContent = srcs.length ? '' : 'Loading the highlight engine. The first time takes a moment (about 30 MB).';
      const s = await E.analyze(file); if (!card.isConnected) return; eng.textContent = '';
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
    } catch (err) { console.error(err); if (!card.isConnected) return; eng.textContent = ''; card.innerHTML = `<b>${esc(file.name)}</b><div class="err">Could not read this video. Try a different clip.</div>`; }
    showGo();
  }
  function tips(s) {
    const t = document.getElementById('tip'); if (!t) return;
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
    card.innerHTML = `<div class="row" style="justify-content:space-between"><b>${esc(s.file.name)}</b><span class="mu">${mmss(s.dur)} <button class="lnkb" data-rmsrc type="button">Remove</button></span></div>
      <video class="pv" src="${s.url}" playsinline controls preload="metadata"></video>
      <p class="mu" style="margin:0 0 4px">${msg}</p>
      <div class="moms">${s.moments.map((m, i) => `<div class="mom"><input type="checkbox" data-i="${i}" ${m.on ? 'checked' : ''} aria-label="Use moment ${i + 1}"><span><span class="tm">${mmss(m.start)} to ${mmss(m.end)}</span>${m.src === 'rim' ? ' <span class="chip ok" style="padding:2px 8px;font-size:12px">bucket</span>' : ''}${m.src === 'tap' ? ' <span class="chip" style="padding:2px 8px;font-size:12px">tap</span>' : ''}<br><button class="btn s g" data-pv="${i}" type="button">Preview</button></span><span class="row"><button class="btn s g" data-sh="${i}" data-d="-2" type="button" aria-label="Earlier">−2s</button><button class="btn s g" data-sh="${i}" data-d="2" type="button" aria-label="Later">+2s</button></span></div>`).join('')}</div>
      <button class="btn s g" data-add type="button" style="margin-top:10px">+ Add a play at the current spot</button>
      ${s.dur > 60 && !s.rimDone ? `<div class="rimcta"><b>🎯 Find every bucket</b><p class="mu" style="margin:4px 0 8px">Best for full games. Pause the video where you can see the hoop, tap the button, then tap the rim. Jamoja watches the net and marks every make.</p><button class="btn w" data-rim type="button">Tap the rim</button></div>` : ''}
      <div class="rimscan" hidden><div class="rimhost"></div><div class="bar"><b class="rsb"></b></div><p class="mu rst">Watching the net…</p></div>`;
    const vid = card.querySelector('video');
    let stopAt = 0; vid.ontimeupdate = () => { if (stopAt && vid.currentTime >= stopAt) { vid.pause(); stopAt = 0; } };
    card.onclick = ev => {
      if (ev.target.closest('[data-rmsrc]')) {
        const i = srcs.indexOf(s); if (i >= 0) srcs.splice(i, 1);
        E.close(s).catch(() => {}); URL.revokeObjectURL(s.url);
        if (s.partId) { R.clearParts([s.partId]); recParts.delete(s.partId); }
        card.remove(); showGo(); toast('Video removed.'); return;
      }
      if (ev.target.closest('[data-rim]')) { pickRim(card, s, vid); return; }
      const b = ev.target.closest('[data-pv],[data-sh],[data-add]'); if (!b) return;
      if (b.dataset.pv) { const m = s.moments[+b.dataset.pv]; vid.currentTime = m.start; stopAt = m.end; vid.play().catch(() => {}); }
      else if (b.dataset.sh) { const m = s.moments[+b.dataset.sh], d = +b.dataset.d; const len = m.end - m.start; m.start = Math.max(0, Math.min(Math.max(0, (s.dur || m.end) - len), m.start + d)); m.end = m.start + len; drawSrc(card, s); }
      else { const t = vid.currentTime; s.moments.push({ start: Math.max(0, t - 6), end: Math.min(s.dur || t + 2, t + 2), on: true, src: 'tap' }); s.moments.sort((a, b2) => a.start - b2.start); drawSrc(card, s); showGo(); }
    };
    card.onchange = ev => { const i = ev.target.dataset.i; if (i !== undefined) { s.moments[+i].on = ev.target.checked; showGo(); } };
  }
  // Show the paused frame, let them tap the rim, then scan the whole video for makes.
  function pickRim(card, s, vid) {
    vid.pause();
    const w = vid.clientWidth, h = vid.clientHeight; if (!vid.videoWidth) return toast('Wait for the video to load, then try again.');
    const ov = document.createElement('canvas'); ov.className = 'rimpick'; ov.width = vid.videoWidth; ov.height = vid.videoHeight;
    ov.getContext('2d').drawImage(vid, 0, 0, ov.width, ov.height);
    const wrap = document.createElement('div'); wrap.className = 'rimwrap'; wrap.innerHTML = `<p class="rimtip">Tap the rim</p>`; wrap.prepend(ov);
    vid.after(wrap); vid.hidden = true; wrap.scrollIntoView({ block: 'center' });
    ov.onclick = async e => {
      const r = ov.getBoundingClientRect(); const rim = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      wrap.remove(); vid.hidden = false;
      const cta = card.querySelector('.rimcta'); if (cta) cta.hidden = true;
      const box = card.querySelector('.rimscan'); box.hidden = false;
      try {
        const hits = await scanRim(s.url, rim, s.dur, (p, n) => { box.querySelector('.rsb').style.width = (p * 100) + '%'; box.querySelector('.rst').textContent = `Watching the net… ${Math.round(p * 100)}% · ${n} bucket${n === 1 ? '' : 's'} so far. Keep this screen open.`; }, box.querySelector('.rimhost'));
        s.rimDone = true; track('rim_scan', { found: hits.length, dur: Math.round(s.dur || 0) });
        if (!hits.length) { box.querySelector('.rst').textContent = 'No makes found at that rim. Try tapping the rim again on a clearer frame, or add plays by hand.'; s.rimDone = false; return; }
        for (const m of s.moments) m.on = false;
        s.moments = [...hits.map(t => ({ start: Math.max(0, t - 6), end: Math.min(s.dur || t + 1.5, t + 1.5), on: true, src: 'rim' })), ...s.moments.filter(m => hits.every(t => Math.abs(m.start - (t - 6)) > 5))].sort((a, b2) => a.start - b2.start);
        drawSrc(card, s); showGo();
        toast(`Found ${hits.length} bucket${hits.length > 1 ? 's' : ''}. Uncheck warmups or anything you don't want.`);
      } catch (err) { box.querySelector('.rst').textContent = 'Could not scan this video: ' + (err.message || err); }
    };
  }
  async function useParts(parts) {
    for (const p of parts) { recParts.add(p.id); await addSource(new File([p.blob], p.name, { type: p.type }), p); }
  }
  SPOT_LL = null;
  const gloc = document.getElementById('gloc');
  if (gloc) {
    const fill = async (quiet) => { gloc.disabled = true; gloc.textContent = '…'; const sp = await spotHere(); gloc.disabled = false; gloc.textContent = '📍 Here'; if (!sp) { if (!quiet) toast('Could not get your location. Type the court instead.'); return; } SPOT_LL = { lat: sp.lat, lng: sp.lng }; const gp = document.getElementById('gp'); if (gp && (!quiet || !gp.value.trim()) && sp.place) gp.value = sp.place; };
    gloc.onclick = () => fill(false);
    if (!qs().get('place') && navigator.permissions) navigator.permissions.query({ name: 'geolocation' }).then(r => { if (r.state === 'granted') fill(true); }).catch(() => {});
  }
  const film = document.getElementById('film');
  let madeGame = null; // a retry after a failed cut reuses this run instead of making a new one
  const sv = document.getElementById('sv');
  if (sv) sv.onclick = async () => {
    sv.disabled = true; sv.textContent = 'Saving…';
    try {
      const w = document.getElementById('gw').value; const at = w ? new Date(w) : new Date();
      const g = await games.create({ owner_id: ME.id, title: document.getElementById('gt').value.trim() || 'Saturday Run', sport: document.getElementById('gs').value, place: document.getElementById('gp').value.trim(), ...(SPOT_LL || {}), played_on: at.toISOString().slice(0, 10), starts_at: at.toISOString(), notes: document.getElementById('gn').value.trim() || null });
      toast('Run posted. Share it so people meet you there.'); go('#/g/' + g.id);
    } catch (err) { sv.disabled = false; sv.textContent = 'Post this run'; toast(err.message); }
  };
  if (film) film.onclick = async () => {
    const r = await R.record({ title: existing ? existing.title : (document.getElementById('gt') || {}).value });
    if (!r) return;
    if (!r.parts.length) return toast('Nothing was recorded.');
    toast('Recording saved. Making your highlights…');
    await useParts(r.parts); autoMake();
  };
  const rcv = document.getElementById('rcv');
  if (rcv) rcv.onclick = async () => { document.getElementById('recov').remove(); await useParts(saved); autoMake(); };
  // Highlights from your own recording happen on their own: BUCKET taps (or the loudest moments) are cut right away.
  function autoMake() {
    if (!srcs.some(s => s.moments.some(m => m.on))) { toast('No plays found in that recording. Scrub to a play and add it.'); return; }
    if (!document.getElementById('go')) return;
    if (!existing && !document.getElementById('gt').value.trim()) document.getElementById('gt').value = 'Run ' + new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const n = srcs.reduce((a, s) => a + s.moments.filter(m => m.on).length, 0);
    const go2 = document.getElementById('go'); if (!go2) return; go2.insertAdjacentHTML('afterbegin', `<div class="card" style="border-color:var(--o)"><b>Making ${n} highlight${n > 1 ? 's' : ''} for you</b><p class="mu" style="margin:4px 0 0">Keep this screen open. You can delete any clip you don't like on the game page.</p></div>`);
    go2.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => { const m = document.getElementById('mk'); if (m) m.click(); }, 0);
  }
  if (qs().get('auto') && saved.length && !existing) { document.getElementById('recov') && document.getElementById('recov').remove(); await useParts(saved); autoMake(); }
  const rdel = document.getElementById('rdel');
  if (rdel) rdel.onclick = async () => { if (!confirmIn(rdel)) return; await R.clearParts(saved.map(p => p.id)); document.getElementById('recov').remove(); toast('Recording deleted.'); };
  document.getElementById('fi').onchange = async e => { const files = [...e.target.files]; e.target.value = ''; for (const f of files) await addSource(f); };
  if (window.PENDING_FILE) { const pf = window.PENDING_FILE; window.PENDING_FILE = null; await addSource(pf); const c = document.querySelector('[data-rim]'); if (c) c.scrollIntoView({ block: 'center' }); }
  if (window.PENDING_SRC && existing) { const pend = window.PENDING_SRC; window.PENDING_SRC = null; for (const p of pend) await addSource(new File([p.blob], p.name, { type: p.type }), p); autoMake(); }

  document.getElementById('mk').onclick = async () => {
    const jobs = srcs.flatMap(s => s.moments.filter(m => m.on).map(m => ({ s, m })));
    if (!jobs.length) return;
    const mk = document.getElementById('mk'); mk.disabled = true; mk.hidden = true;
    document.getElementById('prog').hidden = false;
    const pb = document.getElementById('pb'), pt = document.getElementById('pt');
    busy = true; R.keepAwake(true);
    try {
      let game = existing || madeGame;
      if (!game) {
        const title = document.getElementById('gt').value.trim() || 'Saturday Run';
        const w = document.getElementById('gw').value; const at = w ? new Date(w) : new Date();
        game = await games.create({ owner_id: ME.id, title, sport: document.getElementById('gs').value, place: document.getElementById('gp').value.trim(), ...(SPOT_LL || {}), played_on: at.toISOString().slice(0, 10), starts_at: at.toISOString(), notes: document.getElementById('gn').value.trim() || null }); madeGame = game;
      }
      const already = existing ? (await highlights.list(game.id)).length : 0;
      for (let k = 0; k < jobs.length; k++) {
        const { s, m } = jobs[k];
        if (m.done) continue; // made on an earlier try: don't make it twice
        pt.textContent = `Cutting highlight ${k + 1} of ${jobs.length}. Keep this screen open.`;
        const c = await E.cut(s, m.start, m.end, p => { pb.style.width = ((k + p * 0.9) / jobs.length * 100) + '%'; });
        pt.textContent = `Saving highlight ${k + 1} of ${jobs.length}…`;
        const key = `${ME.id}/${game.id}/${Date.now()}-${k}`;
        await storage.upload(key + '.mp4', c.video, 'video/mp4');
        await storage.upload(key + '.jpg', c.poster, 'image/jpeg');
        await highlights.add({ game_id: game.id, created_by: ME.id, label: 'Play ' + (already + k + 1), path: key + '.mp4', poster: key + '.jpg', dur_s: +c.dur.toFixed(2), start_s: +m.start.toFixed(2), ...(m.src === 'rim' ? { play_type: 'Bucket' } : {}) });
        m.done = true;
        pb.style.width = ((k + 1) / jobs.length * 100) + '%';
      }
      for (const s of srcs) { await E.close(s); URL.revokeObjectURL(s.url); }
      await R.clearParts([...recParts]);
      busy = false; R.keepAwake(false);
      toast(`${jobs.length} highlight${jobs.length > 1 ? 's' : ''} ready.`);
      go('#/g/' + game.id + '?review=1');
    } catch (err) {
      console.error(err); busy = false; R.keepAwake(false);
      const done = jobs.filter(j => j.m.done).length;
      if (!existing && madeGame && !done) { try { await games.remove(madeGame.id); } catch (e2) { /* leave it */ } madeGame = null; } // nothing saved: don't leave an empty run behind
      if (/memory|RuntimeError/i.test(String(err && err.message))) { pt.innerHTML = `<span class="err" style="display:block">Your phone ran low on memory on highlight ${done + 1} of ${jobs.length}.${done ? ` ${done} ${done > 1 ? 'are' : 'is'} already saved.` : ''} Close other apps, then tap Make highlights again. It picks up where it stopped.</span>`; mk.hidden = false; mk.disabled = false; return; }
      pt.innerHTML = `<span class="err" style="display:block">${esc(err && err.message ? err.message : 'Something went wrong making that highlight (' + String(err && (err.name || err.code || err.errno) || err) + ')')}. Your clips are still here. Try again.</span>`; mk.hidden = false; mk.disabled = false;
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
  const [ps, hsAll] = await Promise.all([players.list(id), highlights.list(id)]);
  const hs = hsAll.filter(h => !h.hidden && h.play_type !== 'Warmup'); const warm = hsAll.length - hs.length;
  const myP = new Set(ps.filter(p => ME && p.user_id === ME.id).map(p => p.id)); const mineList = hs.filter(h => myP.has(h.player_id)); const mineN = mineList.length;
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
  const [rbox, lbox] = await Promise.all([runBox(g, own), liveBox(g)]); const nbox = ''; // "Next up" line removed (not needed at pickup)
  V.innerHTML = `<h1>${esc(g.title)}</h1><p class="mu">${esc(g.sport)}${g.place && !g.starts_at ? ' · ' + esc(g.place) : ''}${g.played_on && !g.starts_at ? ' · ' + esc(g.played_on) : ''}${g.owner ? ` · by <a href="#/u/${esc(g.owner.handle)}">${esc(g.owner.name)}</a>` : ''}</p>${rbox}${runReport(g, ps, hs)}${boxScore(ps, hs)}${nbox}${lbox}
    ${own && qs().get('fresh') ? `<div class="card" style="border-color:var(--o)"><b>${LOCAL ? 'Next: tag your crew, then send the clips.' : 'Next: tag your crew, then send the link.'}</b><p class="mu" style="margin:4px 0 0">Add each player below, then pick who is in each highlight and what the play was. Tagged plays get shared way more.</p></div>` : ''}
    ${shareCard}
    <h2>Players</h2>
    <div class="row" id="pl">${ps.map(p => `<span class="chip ${p.user_id ? 'ok' : ''}">${esc(p.label)}${p.user && !LOCAL ? ` · <a href="#/u/${esc(p.user.handle)}">@${esc(p.user.handle)}</a>` : p.user_id ? ' · you' : ''}${own && !p.user_id ? `<button data-rm="${p.id}" aria-label="Remove ${esc(p.label)}">×</button>` : ''}</span>`).join('') || '<span class="mu">No players tagged yet.</span>'}</div>
    ${own ? `<form id="af" class="row" style="margin-top:10px"><input class="t" id="an" placeholder="Name or shirt, like Jay or white shirt" style="flex:1"><button class="btn s">Add</button></form>` : ''}
    ${!myClaim && ps.some(p => !p.user_id) ? `<div class="card" style="margin-top:12px"><b>${LOCAL ? 'Which one is you?' : 'Are you in this game?'}</b><p class="mu" style="margin:4px 0 10px">Tap your name to put these plays on your profile.</p><div class="row">${ps.filter(p => !p.user_id).map(p => `<button class="btn s" data-claim="${p.id}">I'm ${esc(p.label)}</button>`).join('')}</div></div>` : ''}
    ${myClaim ? `<p class="mu" style="margin-top:10px">You are <b>${esc(myClaim.label)}</b> in this game. <button class="btn s g" data-release="${myClaim.id}">Not me</button></p>` : ''}
    ${hs.length ? `<div class="row" style="gap:8px;margin:14px 0 0;flex-wrap:nowrap"><button class="btn g" id="tape" style="flex:1">▶ Watch the run (${hs.length})</button>${mineN ? `<button class="btn" id="tapeme" style="flex:1">▶ Just mine (${mineN})</button>` : ''}</div>` : ''}
    ${hs.length && ME ? `<button class="btn w" id="rvgo" style="margin:14px 0 4px">⚡ Review plays (${hs.length})</button><p class="mu" style="margin:0 0 8px;font-size:13px">Swipe through. Fix the play type, tap "That's me" on yours. Right guesses take one tap.</p>` : ''}
    <h2>Highlights</h2>${warm && own ? `<p class="mu" style="margin-top:-6px">${warm} warmup clip${warm > 1 ? 's' : ''} left out of the game.</p>` : ''}
    ${hs.length ? `<div class="grid">${hs.map(h => `<div class="hl"><video data-hid="${h.id}" data-src="${esc(storage.url(h.path))}" poster="${esc(storage.url(h.poster))}" controls playsinline preload="none"></video><div class="b"><b>${esc(h.play_type || h.label)}</b><span class="mu">${h.player_id ? esc(pname(h.player_id)) : own ? 'Who is this?' : ''}${h.views ? ' · ' + views(h.views) : ''}</span>
      ${own ? `<select data-hp="${h.id}" aria-label="Player in ${esc(h.label)}"><option value="">Who is this?</option>${ps.map(p => `<option value="${p.id}" ${h.player_id === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select>
      <select data-pt="${h.id}" aria-label="Play type for ${esc(h.label)}"><option value="">What was the play?</option>${[...playsFor(g.sport), 'Warmup'].map(t => `<option ${h.play_type === t ? 'selected' : ''}>${esc(t === 'Warmup' ? 'Warmup (hide it)' : t)}</option>`.replace('>Warmup (hide it)<', ' value="Warmup">Warmup (hide it)<')).join('')}</select>` : ''}
      <div class="row" style="margin-top:6px">${LOCAL ? `<button class="btn s g" data-s1="${h.id}" style="flex:1">${canFiles ? 'Send' : 'Save'}</button>` : ''}${own ? `<button class="btn s g" data-hd="${h.id}" style="flex:1">Delete</button>` : ''}</div></div></div>`).join('')}</div>` : `<p class="mu">No highlights yet.</p>`}
    ${own ? `<div class="row" style="margin-top:16px"><a class="btn g" href="#/new?game=${id}">+ Upload or record clips</a><button class="btn g" id="dg">Delete game</button></div>` : ''}
    ${LOCAL || ME ? '' : `<p class="foot">Want highlights from your games? <a href="#/login?mode=up">Create a free Jamoja account</a></p>`}`;
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
      else if (b.id === 'dg') { if (!confirmIn(b)) return; const lsess = await live.sessions(id).catch(() => []); const lfiles = []; for (const x of lsess) { (await live.segments(id, x.session).catch(() => [])).forEach(z => lfiles.push(z.path)); } const files = [...hs.flatMap(h => [h.path, h.poster]), ...lfiles]; if (files.length) await storage.remove(files).catch(() => {}); await games.remove(id); toast('Game deleted.'); go('#/'); }
    } catch (err) { toast(err.message); }
  };
  const rb = document.getElementById('rsvp');
  if (rb) rb.onclick = async () => { const on = !rb.classList.contains('g'); rb.disabled = true; try { await rsvps.set(g.id, ME.id, on); toast(on ? "You're in. See you there." : 'Removed.'); gamePage(id); } catch (err) { rb.disabled = false; toast(err.message); } };
  const gn = document.getElementById('gotnext'); if (gn) gn.onclick = async () => { gn.disabled = true; try { await nextUp.join(g.id); toast("You got next."); gamePage(id); } catch (err) { gn.disabled = false; toast(err.message); } };
  V.querySelectorAll('[data-nx]').forEach(b => b.onclick = async ev => { ev.stopPropagation(); b.disabled = true; try { await nextUp.leave(g.id, b.dataset.nx); gamePage(id); } catch (err) { b.disabled = false; toast(err.message); } });
  const ss = document.getElementById('setspot'); if (ss) ss.onclick = async () => { ss.disabled = true; ss.textContent = '📍 Finding your court…'; await stampSpot(g); if (g.place) { toast('Court added: ' + g.place); gamePage(id); } else { ss.disabled = false; ss.textContent = '📍 Add this court (use my location)'; toast('Could not get your location. Check location permission for your browser.'); } };
  const tp = document.getElementById('tape'); if (tp) tp.onclick = () => playTape(g, [...hs].sort((a, b) => (a.start_s || 0) - (b.start_s || 0)), ps);
  const tme = document.getElementById('tapeme'); if (tme) tme.onclick = () => playTape(g, [...mineList].sort((a, b) => (a.start_s || 0) - (b.start_s || 0)), ps);
  const rv = document.getElementById('rvgo'); if (rv) rv.onclick = () => reviewPlays(g, hs, ps, own, id);
  if (rv && qs().get('review')) setTimeout(() => reviewPlays(g, hs, ps, own, id), 300);
  const gl = document.getElementById('golive'); if (gl) gl.onclick = () => goLive(g);
  if (gl && qs().get('live')) { gl.scrollIntoView({ block: 'center' }); gl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 700, iterations: 3 }); toast('Tap Go live when you\'re ready. Camera opens first, nothing streams until you tap.'); }
  V.querySelectorAll('[data-watch]').forEach(b => b.onclick = () => { watchSession(V.querySelector('#player'), g.id, b.dataset.watch, !!b.dataset.live); V.querySelector('#player').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  const autoLive = V.querySelector('[data-watch][data-live="1"]'); if (autoLive && !own) autoLive.click();
  clearInterval(window.LB_T);
  if (!autoLive) window.LB_T = setInterval(async () => { if (!location.hash.startsWith('#/g/' + id)) { clearInterval(window.LB_T); return; } const ss = await live.sessions(g.id).catch(() => []); if (ss.some(x => x.isLive)) { clearInterval(window.LB_T); gamePage(id); } }, 10000);
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
  const [tags, made, cnt, fol, mine] = await Promise.all([players.mine(p.id), games.mine(p.id), follows.counts(p.id).catch(() => ({ followers: 0, following: 0 })), ME ? follows.ids(ME.id).catch(() => []) : [], posts.byUser(p.id).catch(() => [])]);
  const tagged = await highlights.forPlayers(tags.map(t => t.id));
  const hs = tagged; // only plays tagged to this athlete. Plays they filmed live on the game page (the run's tape).
  const card = pickupCard(p, tags, hs);
  await storage.prep([...hs.flatMap(h => [h.path, h.poster]), p.avatar].filter(Boolean));
  const link = shareBase() + '#/u/' + encodeURIComponent(p.handle);
  const following = fol.includes(p.id);
  if (!me && !LOCAL) { const k = 'jm.pv.' + p.id; try { if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); profileViews.record(p.id).catch(() => {}); } } catch (e) { profileViews.record(p.id).catch(() => {}); } }
  const pv = me && !LOCAL ? await profileViews.list(p.id).catch(() => []) : [];
  // Courts: where this athlete plays. Home court = the one they play at most.
  const cc = {}; for (const g of [...made, ...tags.map(t => t.game).filter(Boolean)]) if (g.place && !/^(philippines|philadelphia)$/i.test(g.place)) { const k = g.place; cc[k] = (cc[k] || 0) + 1; }
  const courts = Object.entries(cc).sort((a, b) => b[1] - a[1]);
  const home = courts.length ? courts[0][0] : null;
  let crown = null;
  if (home) { const hsc = await highlights.atCourt(home).catch(() => []); const k = {}; for (const h of hsc) { const u = h.player && h.player.user; if (u) k[u.handle] = (k[u.handle] || 0) + 1; } const top = Object.entries(k).sort((a, b) => b[1] - a[1])[0]; if (top && top[0] === p.handle) crown = home; }
  const emptyIds = me ? await games.empty(made).catch(() => []) : [];
  const nextRun = made.filter(g => g.starts_at && new Date(g.starts_at).getTime() > Date.now() - 3 * 3600e3).sort((a, b) => a.starts_at < b.starts_at ? -1 : 1)[0];
  const ICON = {
    grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>',
    play: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M10 8.5v7l6-3.5z"/></svg>',
    ball: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8"/></svg>',
  };
  const plays = hs.length, totalViews = hs.reduce((a, h) => a + (h.views || 0), 0);
  const fireTotal = mine.reduce((a, x) => a + (x.fire || 0), 0);
  const SPORT_ICON = { Basketball: '🏀', Football: '🏈', Soccer: '⚽', Baseball: '⚾', Softball: '🥎', Volleyball: '🏐', 'Flag football': '🏈', Track: '🏃', Running: '🏃', Tennis: '🎾', Boxing: '🥊', Weightlifting: '🏋️', CrossFit: '🏋️', Training: '💪', Other: '⭐' };
  V.innerHTML = `<div class="pcard">
      <div class="pc-top"><span class="pc-chip">${SPORT_ICON[p.sport] || '⭐'} ${esc(p.sport || 'Athlete')}</span>${p.level ? `<span class="pc-chip lvl">${esc(LV[p.level] || p.level)}</span>` : ''}<span class="pc-brand">JAM<i></i>JA</span></div>
      <div class="pc-main">${avatar(p, 104)}<div class="pc-id"><div class="pc-name">${esc(p.name)}</div><div class="pc-sub">@${esc(p.handle)}</div><div class="pc-pos">${[p.position, p.city].filter(Boolean).map(esc).join(' · ')}</div>${home ? `<a class="pc-home" href="${courtUrl(home)}">📍 Home court: <b>${esc(home)}</b></a>` : ''}${crown ? `<div class="pc-crown">👑 King of the Court</div>` : ''}</div></div>
      ${p.bio ? `<div class="pc-bio">${nl(p.bio)}</div>` : me ? `<a class="pc-bio mu" href="#/setup?next=${encodeURIComponent('#/u/' + p.handle)}">+ Add a bio so scouts and teammates know your game</a>` : ''}
      <div class="pc-stats"><div><b>${plays}</b><span>Plays</span></div><div><b>${totalViews}</b><span>Views</span></div><div><b>${fireTotal}</b><span>🔥</span></div><a href="#/u/${esc(p.handle)}/followers"><b>${cnt.followers}</b><span>Followers</span></a><a href="#/u/${esc(p.handle)}/following"><b>${cnt.following}</b><span>Following</span></a></div>
    </div>
    <div class="ph-btns">${me ? `<a class="btn s" href="#/setup?next=${encodeURIComponent('#/u/' + p.handle)}">Edit card</a>` : LOCAL ? '' : `<button class="btn s ${following ? 'g' : ''}" data-follow="${p.id}">${following ? 'Following' : 'Follow'}</button><a class="btn s g" href="#/dm/${encodeURIComponent(p.handle)}">Message</a>`}${LOCAL ? '' : `<button class="btn s g" id="cp">Share</button>`}${me && !LOCAL ? `<a class="btn s g sq" href="#/people" aria-label="Find people"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5M19 8v6M16 11h6"/></svg></a>` : ''}</div>
    ${me && !LOCAL ? `<a class="scout" href="#/viewers"><span class="sc-n">${pv.length}</span><span><b>Who's watching</b><br><span class="mu">profile view${pv.length === 1 ? '' : 's'} in the last 30 days · see who →</span></span></a>` : ''}
    ${nextRun ? `<a class="card pnext" href="#/g/${nextRun.id}"><span class="mu" style="font-size:12px;letter-spacing:.1em">${new Date(nextRun.starts_at) <= Date.now() ? 'PLAYING NOW' : 'NEXT RUN'}</span><b>${esc(nextRun.title)}</b><span class="mu">${esc(whenLabel(nextRun.starts_at))}${nextRun.place ? ' · ' + esc(nextRun.place) : ''}</span><span class="pn-go">${me ? 'Open · go live' : "I'm in →"}</span></a>` : ''}
    ${courts.length ? `<div class="pcourts">${courts.slice(0, 6).map(([c, n]) => `<a href="${courtUrl(c)}">📍 ${esc(c)} <span>${n}</span></a>`).join('')}</div>` : me ? `<a class="pcourts-empty mu" href="#/post">📍 Tap + then Go live at your court to add it to your card</a>` : ''}
    ${card}
    <div class="ptabs" role="tablist"><button data-pt2="posts" class="on">Posts <span>${mine.length}</span></button><button data-pt2="plays">Highlights <span>${plays}</span></button><button data-pt2="games">Games <span>${made.length}</span></button></div>
    <div id="pgrid"></div>
    ${LOCAL && me ? `<p class="foot">Everything is saved on this phone. Clearing your browser data deletes it.</p>` : ''}`;
  await storage.prep(mine.flatMap(x => [x.media, x.poster]).filter(Boolean));
  const tile = (href, bg, inner, cls = '') => `<a class="tile ${cls}" href="${href}">${bg ? `<img src="${esc(bg)}" alt="" loading="lazy">` : ''}${inner}</a>`;
  const btile = (id, bg, inner) => `<button class="tile" data-pv2="${id}"><img src="${esc(bg)}" alt="" loading="lazy">${inner}</button>`;
  const postTile = x => x.kind === 'photo' ? btile(x.id, storage.url(x.media), x.fire ? `<span class="tb">🔥 ${x.fire}</span>` : '')
    : x.kind === 'video' ? btile(x.id, storage.url(x.poster), `<span class="tp">▶</span>${x.fire ? `<span class="tb">🔥 ${x.fire}</span>` : ''}`)
    : x.kind === 'youtube' ? tile('#/p/' + x.id, `https://i.ytimg.com/vi/${x.youtube_id}/hqdefault.jpg`, `<span class="tp yt">▶</span>`)
    : tile('#/p/' + x.id, '', `<span class="tt">${esc((x.body || '').slice(0, 90))}</span>`, 'txt');
  const playTile = h => `<button class="tile" data-play="${h.id}"><img src="${esc(storage.url(h.poster))}" alt="" loading="lazy"><span class="tp">▶</span>${h.play_type ? `<span class="tl2">${esc(h.play_type)}</span>` : ''}${h.views ? `<span class="tb">${views(h.views)}</span>` : ''}</button>`;
  const grid = V.querySelector('#pgrid');
  const show = t => {
    V.querySelectorAll('[data-pt2]').forEach(b2 => b2.classList.toggle('on', b2.dataset.pt2 === t));
    if (t === 'posts') grid.innerHTML = mine.length ? `<div class="tiles">${mine.map(postTile).join('')}</div>` : `<p class="mu">${me ? 'Nothing posted yet. <a href="#/post">Make your first post</a>.' : 'No posts yet.'}</p>`;
    else if (t === 'plays') grid.innerHTML = hs.length ? `<div class="row" style="gap:8px;margin:10px 0;flex-wrap:nowrap"><button class="btn g" id="myreel" style="flex:1">▶ ${me ? 'My reel' : 'Watch reel'} (${hs.length})</button>${me ? `<button class="btn" id="savereel" style="flex:1">⬇ Save my reel</button>` : ''}</div><p class="mu" id="reelmsg" style="margin:0 0 8px;font-size:13px"></p><div class="tiles">${hs.map(playTile).join('')}</div>` : `<p class="mu">${me ? 'Your game highlights live here: clips from games filmed in Jamoja where you are tagged. When a friend sends you their game link, tap "I\'m [your name]" and your plays land here.' : 'No game highlights yet.'}</p>${me ? `<a class="btn s g" href="#/new">Film a game</a>` : ''}`;
    else grid.innerHTML = made.length ? (emptyIds.length ? `<button class="btn w g" id="cleanup" style="margin:10px 0">🧹 Delete ${emptyIds.length} empty run${emptyIds.length > 1 ? 's' : ''} (no clips, nobody joined)</button>` : '') + gameList(made) : `<p class="mu">${me ? 'Games you film show up here.' : 'No games filmed yet.'}</p>${me ? `<a class="btn s g" href="#/new">Film a game</a>` : ''}`;
  };
  V.querySelector('.ptabs').onclick = e => { const b2 = e.target.closest('[data-pt2]'); if (b2) show(b2.dataset.pt2); };
  if (me) events.isAdmin(ME.id).then(ok => { const tb = V.querySelector('.ptabs'); if (ok && tb && tb.isConnected && !V.querySelector('#statsl')) tb.insertAdjacentHTML('beforebegin', `<a id="statsl" class="btn w g" href="#/stats" style="margin:10px 0">📊 Stats (only you see this)</a>`); }).catch(() => {});
  grid.addEventListener('click', async e => {
    const mr = e.target.closest('#myreel');
    if (mr) { playTape({ title: (me ? 'My reel' : p.name + "'s reel") }, [...hs].sort((a, b) => a.created_at < b.created_at ? -1 : 1), tags); return; }
    const sr = e.target.closest('#savereel');
    if (sr) {
      const msg = document.getElementById('reelmsg'); sr.disabled = true;
      try {
        const list = [...hs].sort((a, b) => a.created_at < b.created_at ? -1 : 1).slice(0, 12);
        msg.textContent = 'Getting your clips…';
        const blobs = []; for (const h of list) blobs.push(await (await fetch(storage.url(h.path))).blob());
        msg.textContent = 'Putting your reel together… keep this screen open.';
        const out = await E.reel(blobs, pr => { msg.textContent = `Putting your reel together… ${Math.round(pr * 100)}%`; });
        await E.reset().catch(() => {});
        const file = new File([out], `${p.handle}-jamoja-reel.mp4`, { type: 'video/mp4' }); track('reel_saved', { n: list.length });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { msg.textContent = 'Ready. Pick "Save Video" or send it.'; await navigator.share({ files: [file], title: 'My Jamoja reel' }).catch(() => {}); }
        else { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); msg.textContent = 'Saved to your downloads.'; }
      } catch (err) { msg.textContent = 'Could not make the reel: ' + (err.message || err); }
      sr.disabled = false; return;
    }
    const c = e.target.closest('#cleanup'); if (!c) return;
    if (!confirmIn(c)) return;
    c.disabled = true; c.textContent = 'Deleting…';
    let n = 0; for (const id of emptyIds) { try { await games.remove(id); n++; } catch (err) { console.warn(err); } }
    toast(`Deleted ${n} empty run${n === 1 ? '' : 's'}.`); profilePage(handle).then(() => { const t = V.querySelector('[data-pt2="games"]'); if (t) t.click(); });
  });
  grid.onclick = e => {
    const pv = e.target.closest('[data-pv2]');
    if (pv) { const x = mine.find(y => y.id === pv.dataset.pv2); if (!x) return; const cap = `${x.body ? nl(x.body) + '<br>' : ''}<a href="#/p/${x.id}">🔥 ${x.fire || 0} · Comments and more →</a>`; if (x.kind === 'video') openViewer({ video: storage.url(x.media), poster: storage.url(x.poster), cap }); else openViewer({ img: storage.url(x.media), cap }); return; }
    const b2 = e.target.closest('[data-play]'); if (!b2) return;
    const h = hs.find(x => x.id === b2.dataset.play); if (!h) return;
    openViewer({ video: storage.url(h.path), poster: storage.url(h.poster), hid: h.id, cap: `<b>${esc(h.play_type || h.label)}</b> <a href="#/g/${h.game_id}">${esc(h.game ? h.game.title : 'Open the game')} →</a>` });
  };
  show('posts');
  countViews(V); bindFollow(V, fol);
  const cp = document.getElementById('cp'); if (cp) cp.onclick = async () => { if (navigator.share) { navigator.share({ title: p.name + ' on Jamoja', text: `Check out ${p.name} on Jamoja`, url: link }).catch(() => {}); return; } try { await navigator.clipboard.writeText(link); toast('Profile link copied.'); } catch (e) { toast(link); } };
  const so = document.getElementById('so'); if (so) so.onclick = async () => { await auth.signOut(); toast('Signed out.'); go('#/'); };
}

route();

// Service worker: makes Jamoja installable and receives push notifications. It caches nothing.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
