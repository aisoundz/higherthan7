// Film in Jamoja: full-screen camera with a Bucket button.
// Records in parts (a new part every few minutes) and saves each part on the phone as soon as it ends,
// so a long run never becomes one giant file and nothing is lost if the browser closes.
import { local } from './db.js?v=20261126za';

const PART_SECONDS = 120;
const CHECKPOINT_SECONDS = 20;
const TYPES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
export const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

let wake = null;
export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) { wake = await navigator.wakeLock.request('screen'); }
    else if (!on && wake) { await wake.release(); wake = null; }
  } catch (e) { /* not supported or not allowed: fine */ }
}
document.addEventListener('visibilitychange', () => { if (wake && document.visibilityState === 'visible') keepAwake(true); });

export async function savedParts() {
  try { return (await local.all('chunks')).sort((a, b) => a.id < b.id ? -1 : 1); } catch (e) { return []; }
}
export async function clearParts(ids) { for (const id of ids) { try { await local.del('chunks', id); } catch (e) { /* gone */ } } }

// Camera opens in preview. Nothing records until Start. Pause/Resume between quarters or games,
// BUCKET after big plays, End game to make highlights, ✕ to leave (save or discard what was filmed).
export function record(opts = {}) {
  return new Promise(async (resolve) => {
    const el = document.createElement('div');
    el.className = 'rec';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Film in Jamoja');
    el.innerHTML = `<video playsinline muted autoplay></video>
      <button class="rx" id="rx" aria-label="Exit">✕</button>
      <div class="rtop"><span class="rdot" id="rdot"></span><b id="rt">0:00</b><span id="rst" class="mu">Ready</span></div>
      ${opts.live ? `<div class="rlive" id="rlive" hidden>● LIVE</div>` : ''}${opts.title ? `<div class="rtitle">${opts.title.replace(/[<>&]/g, '')}</div>` : ''}
      <div class="rhint" id="rh">Prop the phone where it sees the court. Press Start when the game starts. Tap BUCKET right after a big play.</div>
      <div class="rflash" id="rf">Play saved</div>
      <div class="rsheet" id="rsh" hidden></div>
      <div class="rbot">
        <button class="bucket start" id="rgo" disabled>${opts.live ? 'GO LIVE' : 'START'}</button>
        <button class="bucket" id="bk" hidden>BUCKET!</button>
        <div class="row" style="justify-content:space-between;width:100%;gap:8px"><button class="btn g s" id="pz" hidden>❚❚ Pause</button><span id="rm" class="mu">0 plays marked</span><button class="btn g s" id="rs" hidden>End game</button></div>
      </div>`;
    document.body.append(el);
    document.documentElement.style.overflow = 'hidden';
    const vid = el.querySelector('video'), $ = id => el.querySelector('#' + id);
    const close = () => { el.remove(); document.documentElement.style.overflow = ''; };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: opts.live ? 960 : 1280 }, height: { ideal: opts.live ? 540 : 720 }, frameRate: { ideal: 30 } }, audio: true });
    } catch (e) {
      el.querySelector('.rbot').innerHTML = `<div class="err">Jamoja could not open the camera. Allow camera and microphone for this site in your browser settings, then try again.</div><button class="btn w" id="rback">Back</button>`;
      const done = () => { close(); resolve(null); };
      $('rback').onclick = done; $('rx').onclick = done;
      return;
    }
    const type = TYPES.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    const session = 'rec-' + Date.now();
    const parts = []; let marks = [], part = 0, rec = null, buf = [], partStart = 0, ticking, total = 0, after = 'next';
    const onLeave = e => { if (parts.length || (rec && rec.state === 'recording')) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onLeave);
    keepAwake(true);
    const recording = () => rec && rec.state === 'recording';
    const setUI = st => {
      $('rst').textContent = st === 'rec' ? (opts.live ? ' · streaming' : part ? ` · part ${part + 1}` : ' · recording') : st === 'paused' ? ' · paused' : ' · ready';
      if (opts.live && $('rlive')) $('rlive').hidden = st !== 'rec';
      $('rdot').classList.toggle('off', st !== 'rec');
      $('rgo').hidden = st === 'rec'; $('rgo').textContent = st === 'paused' ? 'RESUME' : opts.live ? 'GO LIVE' : 'START';
      $('bk').hidden = st !== 'rec'; $('pz').hidden = st !== 'rec';
      $('rs').hidden = !(st === 'rec' || parts.length || st === 'paused');
    };

    let partId = '', lastCheck = 0;
    function startPart() {
      buf = []; marks = []; partId = session + '-' + String(part).padStart(3, '0'); lastCheck = performance.now(); after = 'next';
      const bps = opts.live ? 1200000 : 2500000;
      rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: bps } : { videoBitsPerSecond: bps });
      rec.ondataavailable = e => { if (e.data && e.data.size) buf.push(e.data); };
      rec.onstop = async () => {
        const dur = (performance.now() - partStart) / 1000;
        if (buf.length) {
          const p = { id: partId, name: `part${part + 1}.${ext}`, type: rec.mimeType || type || 'video/webm', blob: new Blob(buf, { type: rec.mimeType || type || 'video/webm' }), dur, marks: marks.slice(), created: Date.now() };
          parts.push(p);
          if (opts.onPart) { try { opts.onPart(p, part, after === 'finish' || after === 'discard'); } catch (e) { console.warn(e); } }
          if (!opts.live) { try { await local.put('chunks', p); } catch (e) { console.warn('could not save part', e); } }
          part++;
        }
        if (after === 'finish') finish(); else if (after === 'discard') discard(); else if (after === 'pause') setUI('paused'); else startPart();
      };
      rec.start(1000);
      partStart = performance.now();
      setUI('rec');
    }
    function finish() {
      clearInterval(ticking);
      stream.getTracks().forEach(t => t.stop());
      window.removeEventListener('beforeunload', onLeave);
      keepAwake(false);
      close();
      resolve({ session, parts });
    }
    async function discard() {
      for (const p of parts) { try { await local.del('chunks', p.id); } catch (e) { /* gone */ } }
      try { await local.del('chunks', partId); } catch (e) { /* gone */ }
      parts.length = 0; finish();
    }
    let lastTick = performance.now();
    ticking = setInterval(() => {
      const nowT = performance.now();
      if (recording()) total += (nowT - lastTick) / 1000;
      lastTick = nowT;
      $('rt').textContent = Math.floor(total / 60) + ':' + String(Math.floor(total % 60)).padStart(2, '0');
      if (recording() && (nowT - partStart) / 1000 >= (opts.live ? 6 : PART_SECONDS)) rec.stop();
      else if (!opts.live && recording() && buf.length && (nowT - lastCheck) / 1000 >= CHECKPOINT_SECONDS) {
        // Safety net: save what has been filmed so far in this part, so a crash or a closed tab loses at most a few seconds.
        lastCheck = nowT;
        const ty = rec.mimeType || type || 'video/webm';
        local.put('chunks', { id: partId, name: `part${part + 1}.${ext}`, type: ty, blob: new Blob(buf, { type: ty }), dur: (nowT - partStart) / 1000, marks: marks.slice(), created: Date.now(), live: true }).catch(() => {});
      }
    }, 500);
    let count = 0;
    $('rgo').onclick = () => { $('rh').textContent = 'Recording. Tap BUCKET right after a big play.'; startPart(); };
    $('pz').onclick = () => { if (!recording()) return; after = 'pause'; $('pz').hidden = true; rec.stop(); };
    $('bk').onclick = () => {
      if (!recording()) return;
      marks.push((performance.now() - partStart) / 1000);
      count++; $('rm').textContent = count + (count === 1 ? ' play marked' : ' plays marked');
      const f = $('rf'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
      try { navigator.vibrate && navigator.vibrate(40); } catch (e) { /* no vibration */ }
      $('rh').hidden = true;
    };
    const stopThen = what => { after = what; if (recording()) rec.stop(); else if (what === 'finish') finish(); else discard(); };
    $('rs').onclick = () => {
      const b = $('rs');
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Tap again to end'; setTimeout(() => { delete b.dataset.sure; b.textContent = 'End game'; }, 3000); return; }
      b.disabled = true; b.textContent = 'Saving…'; $('bk').disabled = true; stopThen('finish');
    };
    $('rx').onclick = () => {
      const filmed = parts.length || recording();
      if (!filmed) { clearInterval(ticking); stream.getTracks().forEach(t => t.stop()); window.removeEventListener('beforeunload', onLeave); keepAwake(false); close(); resolve(null); return; }
      const sh = $('rsh');
      sh.innerHTML = `<b>Leave the camera?</b><p class="mu" style="margin:4px 0 12px">You filmed ${Math.floor(total / 60)}:${String(Math.floor(total % 60)).padStart(2, '0')}${count ? ` and marked ${count} play${count > 1 ? 's' : ''}` : ''}.</p>
        <button class="btn w" data-a="save">Save it and make highlights</button><button class="btn w g" data-a="discard" style="margin-top:8px">Delete what I filmed</button><button class="btn w g" data-a="stay" style="margin-top:8px">Keep filming</button>`;
      sh.hidden = false;
      sh.onclick = e => { const a = e.target.closest('[data-a]'); if (!a) return; sh.hidden = true; if (a.dataset.a === 'save') stopThen('finish'); else if (a.dataset.a === 'discard') stopThen('discard'); };
    };
    const ready = () => { $('rgo').disabled = false; };
    vid.onloadedmetadata = ready;
    vid.srcObject = stream;
    setTimeout(ready, 1500);
    setUI('ready');
  });
}
