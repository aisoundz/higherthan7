// Film in Jamoja: full-screen camera with a Bucket button.
// Records in parts (a new part every few minutes) and saves each part on the phone as soon as it ends,
// so a long run never becomes one giant file and nothing is lost if the browser closes.
import { local } from './db.js?v=20261126g';

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

export function record() {
  return new Promise(async (resolve) => {
    const el = document.createElement('div');
    el.className = 'rec';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Film in Jamoja');
    el.innerHTML = `<video playsinline muted autoplay></video>
      <div class="rtop"><span class="rdot"></span><b id="rt">0:00</b><span id="rp" class="mu"></span></div>
      <div class="rhint" id="rh">Prop the phone where it sees the court. Tap BUCKET right after a big play.</div>
      <div class="rflash" id="rf">Play saved</div>
      <div class="rbot"><button class="bucket" id="bk" disabled>BUCKET!</button><div class="row" style="justify-content:space-between;width:100%"><span id="rm" class="mu">0 plays marked</span><button class="btn g s" id="rs" disabled>End game</button></div></div>`;
    document.body.append(el);
    document.documentElement.style.overflow = 'hidden';
    const vid = el.querySelector('video'), $ = id => el.querySelector('#' + id);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: true });
    } catch (e) {
      el.querySelector('.rbot').innerHTML = `<div class="err">Jamoja could not open the camera. Allow camera and microphone for this site in your browser settings, then try again.</div><button class="btn w" id="rx">Back</button>`;
      $('rx').onclick = () => { el.remove(); document.documentElement.style.overflow = ''; resolve(null); };
      return;
    }
    const type = TYPES.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    const session = 'rec-' + Date.now();
    const parts = []; let marks = [], part = 0, rec = null, buf = [], partStart = 0, t0 = performance.now(), ticking, stopping = false, total = 0;
    const onLeave = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onLeave);
    keepAwake(true);

    let partId = '', lastCheck = 0;
    function startPart() {
      buf = []; marks = []; partId = session + '-' + String(part).padStart(3, '0'); lastCheck = performance.now();
      rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 2500000 } : { videoBitsPerSecond: 2500000 });
      rec.ondataavailable = e => { if (e.data && e.data.size) buf.push(e.data); };
      rec.onstop = async () => {
        const dur = (performance.now() - partStart) / 1000;
        const p = { id: partId, name: `part${part + 1}.${ext}`, type: rec.mimeType || type || 'video/webm', blob: new Blob(buf, { type: rec.mimeType || type || 'video/webm' }), dur, marks: marks.slice(), created: Date.now() };
        parts.push(p);
        try { await local.put('chunks', p); } catch (e) { console.warn('could not save part', e); }
        part++;
        if (stopping) finish(); else startPart();
      };
      rec.start(1000);
      partStart = performance.now();
      $('rp').textContent = part ? ` · part ${part + 1}` : '';
    }
    function finish() {
      clearInterval(ticking);
      stream.getTracks().forEach(t => t.stop());
      window.removeEventListener('beforeunload', onLeave);
      keepAwake(false);
      el.remove(); document.documentElement.style.overflow = '';
      resolve({ session, parts });
    }
    ticking = setInterval(() => {
      total = (performance.now() - t0) / 1000;
      $('rt').textContent = Math.floor(total / 60) + ':' + String(Math.floor(total % 60)).padStart(2, '0');
      if (rec && rec.state === 'recording' && (performance.now() - partStart) / 1000 >= PART_SECONDS) rec.stop();
      else if (rec && rec.state === 'recording' && buf.length && (performance.now() - lastCheck) / 1000 >= CHECKPOINT_SECONDS) {
        // Safety net: save what has been filmed so far in this part, so a crash or a closed tab loses at most a few seconds.
        lastCheck = performance.now();
        const ty = rec.mimeType || type || 'video/webm';
        local.put('chunks', { id: partId, name: `part${part + 1}.${ext}`, type: ty, blob: new Blob(buf, { type: ty }), dur: (performance.now() - partStart) / 1000, marks: marks.slice(), created: Date.now(), live: true }).catch(() => {});
      }
    }, 500);
    let count = 0;
    $('bk').onclick = () => {
      if (!rec) return;
      marks.push((performance.now() - partStart) / 1000);
      count++; $('rm').textContent = count + (count === 1 ? ' play marked' : ' plays marked');
      const f = $('rf'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
      try { navigator.vibrate && navigator.vibrate(40); } catch (e) { /* no vibration */ }
      $('rh').hidden = true;
    };
    $('rs').onclick = () => {
      const b = $('rs');
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Tap again to end'; setTimeout(() => { delete b.dataset.sure; b.textContent = 'End game'; }, 3000); return; }
      stopping = true; b.disabled = true; b.textContent = 'Saving…'; $('bk').disabled = true;
      if (rec && rec.state !== 'inactive') rec.stop(); else finish();
    };
    let started = false;
    const go = () => { if (started) return; started = true; startPart(); $('bk').disabled = false; $('rs').disabled = false; };
    vid.onloadedmetadata = go;
    vid.srcObject = stream;
    setTimeout(go, 1500);
  });
}
