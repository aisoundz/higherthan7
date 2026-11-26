// Jamoja highlight engine: runs entirely in the browser with ffmpeg.wasm.
// It reads the video in place (no full copy into memory), finds loud crowd moments,
// and cuts each chosen moment into a small H.264 clip that plays on any phone.
import { FFmpeg } from './vendor/ffmpeg/index.js';

let ff = null, loading = null, seq = 0;
const mounted = new Set();
// iPhones give the browser little memory. ffmpeg.wasm can corrupt its memory there ("Out of bounds memory access"),
// and after that every command fails. So on iOS each clip gets a fresh engine, and any crash restarts it and retries once.
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export async function reset() {
  const old = ff; ff = null; loading = null; mounted.clear();
  try { if (old) old.terminate(); } catch (e) { /* already gone */ }
}
async function ready(src) {
  const f = await ensure();
  if (src && src.file && !mounted.has(src.dir)) {
    try { await f.createDir(src.dir); } catch (e) { /* exists */ }
    await f.mount('WORKERFS', { files: [src.file] }, src.dir);
    mounted.add(src.dir);
  }
  return f;
}
const crashed = e => e && !e.jm && /memory|RuntimeError|abort|terminat|unreachable|called before load|not loaded/i.test(String(e.message || e));
const base = new URL('.', import.meta.url);

export async function ensure() {
  if (ff) return ff;
  if (!loading) loading = (async () => {
    const f = new FFmpeg();
    await f.load({
      coreURL: new URL('vendor/core/ffmpeg-core.js', base).href,
      wasmURL: new URL('vendor/core/ffmpeg-core.wasm', base).href,
    });
    ff = f;
    return f;
  })();
  return loading;
}

const parseDur = (log) => {
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(log);
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 0;
};

// Pick the loudest separate moments. Window = 0.5 s.
function pickMoments(db, dur) {
  if (!db.length) return [];
  const sm = db.map((v, i) => (db[i - 1] ?? v) * 0.25 + v * 0.5 + (db[i + 1] ?? v) * 0.25);
  const sorted = [...sm].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const maxN = Math.max(1, Math.min(8, Math.ceil(dur / 15)));
  const order = sm.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
  const picked = [];
  for (const [v, i] of order) {
    if (picked.length >= maxN) break;
    if (v < med + 3 && picked.length) break;
    const t = i * 0.5;
    if (picked.every(p => Math.abs(p.peak - t) >= 8)) picked.push({ peak: t, lift: +(v - med).toFixed(1) });
  }
  return picked
    .map(p => ({ peak: p.peak, lift: p.lift, start: Math.max(0, p.peak - 5), end: Math.min(dur || p.peak + 1.5, p.peak + 1.5) }))
    .sort((a, b) => a.start - b.start);
}

// Open a file: mount it, read its info, and score the crowd noise.
export async function analyze(file) {
  const f = await ensure();
  const dir = '/src' + (++seq);
  await f.createDir(dir);
  await f.mount('WORKERFS', { files: [file] }, dir);
  mounted.add(dir);
  const inp = dir + '/' + file.name;
  let log = '';
  const h = ({ message }) => { log += message + '\n'; };
  f.on('log', h);
  let pcm = null;
  try {
    await f.exec(['-i', inp, '-vn', '-ac', '1', '-ar', '8000', '-f', 's16le', '/a.pcm']);
    pcm = await f.readFile('/a.pcm');
    await f.deleteFile('/a.pcm');
  } catch (e) { pcm = null; }
  f.off('log', h);
  const dur = parseDur(log);
  const codec = (/Video: (\w+)/.exec(log) || [])[1] || '';
  let db = [];
  if (pcm && pcm.byteLength > 8000) {
    const a = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.byteLength >> 1);
    for (let i = 0; i + 4000 <= a.length; i += 4000) {
      let s = 0;
      for (let j = i; j < i + 4000; j++) s += a[j] * a[j];
      db.push(20 * Math.log10(Math.sqrt(s / 4000) + 1));
    }
  }
  return { file, dir, inp, dur, codec, moments: pickMoments(db, dur), hasAudio: db.length > 0 };
}

// Cut one moment into a phone-friendly clip plus a poster image.
export async function cut(src, start, end, onProgress, posterAt) {
  try {
    const r = await cutOnce(src, start, end, onProgress, posterAt);
    if (IOS) await reset(); // start the next clip with clean memory
    return r;
  } catch (e) {
    if (!crashed(e)) throw e;
    console.warn('engine crashed, restarting', e);
    await reset();
    const r = await cutOnce(src, start, end, onProgress, posterAt);
    if (IOS) await reset();
    return r;
  }
}
async function cutOnce(src, start, end, onProgress, posterAt) {
  const f = await ready(src);
  const d = Math.max(1, end - start);
  const id = ++seq;
  const out = `/c${id}.mp4`, pos = `/p${id}.jpg`;
  const scale = "scale='if(gt(iw,ih),-2,540)':'if(gt(iw,ih),540,-2)'";
  const prog = ({ progress }) => onProgress && onProgress(Math.max(0, Math.min(1, progress)));
  const size = async p => { try { return (await f.readFile(p)).length; } catch (e) { return 0; } };
  const del = async p => { try { await f.deleteFile(p); } catch (e) { /* gone */ } };
  const encode = ['-vf', scale, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-ac', '2'];
  f.on('progress', prog);
  try {
    // Fast path: copy without re-encoding (only for H.264). Videos filmed inside the browser can refuse this, so check the result.
    let ok = false;
    if (src.codec === 'h264') {
      const rc = await f.exec(['-ss', start.toFixed(2), '-i', src.inp, '-t', d.toFixed(2), '-c', 'copy', '-movflags', '+faststart', out]);
      ok = rc === 0 && (await size(out)) > 20000;
      if (!ok) await del(out);
    }
    if (!ok) {
      const rc = await f.exec(['-ss', start.toFixed(2), '-i', src.inp, '-t', d.toFixed(2), ...encode, '-movflags', '+faststart', out]);
      if (rc !== 0 || (await size(out)) < 2000) { await del(out); const er = new Error('Could not cut this clip. The video may be damaged or too short at that spot'); er.jm = 1; throw er; }
    }
  } finally { f.off('progress', prog); }
  // Cover image: from the source, or from the finished clip if that fails.
  let rc = await f.exec(['-ss', (posterAt != null ? Math.max(0, posterAt) : start + d * 0.6).toFixed(2), '-i', src.inp, '-frames:v', '1', '-vf', scale, '-q:v', '5', pos]);
  if (rc !== 0 || !(await size(pos))) { await del(pos); rc = await f.exec(['-ss', (d * 0.5).toFixed(2), '-i', out, '-frames:v', '1', '-q:v', '5', pos]); }
  if (rc !== 0 || !(await size(pos))) { await del(pos); await f.exec(['-i', out, '-frames:v', '1', '-q:v', '5', pos]); }
  const video = await f.readFile(out);
  let poster; try { poster = await f.readFile(pos); } catch (e) { const er = new Error('Could not make a cover image for this clip'); er.jm = 1; throw er; }
  await del(out); await del(pos);
  return { video, poster, dur: d };
}

export async function close(src) {
  if (!ff || !mounted.has(src.dir)) return;
  try { await ff.unmount(src.dir); await ff.deleteDir(src.dir); } catch (e) { /* already closed */ }
  mounted.delete(src.dir);
}

// Stamp a watermark image (PNG bytes) onto a clip so every repost carries the brand.
export async function brand(videoBlob, png, onProgress) {
  const f = await ensure();
  const id = ++seq, inp = `/b${id}.mp4`, wm = `/w${id}.png`, out = `/o${id}.mp4`;
  await f.writeFile(inp, new Uint8Array(await videoBlob.arrayBuffer()));
  await f.writeFile(wm, png);
  const prog = ({ progress }) => onProgress && onProgress(Math.max(0, Math.min(1, progress)));
  f.on('progress', prog);
  try {
    await f.exec(['-i', inp, '-i', wm, '-filter_complex',
      "[0:v]scale='if(gt(iw,ih),-2,540)':'if(gt(iw,ih),540,-2)'[v];[v][1:v]overlay=16:main_h-overlay_h-24",
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out]);
  } finally { f.off('progress', prog); }
  const data = await f.readFile(out);
  for (const p of [inp, wm, out]) { try { await f.deleteFile(p); } catch (e) { /* gone */ } }
  return new Blob([data], { type: 'video/mp4' });
}

// Quick Edit: trim, look, brightness/contrast, slow-mo window, text overlays, in one pass.
// opts: {start, end, cover, look, bright, contrast, slow: {a, b} (seconds inside the clip) | null, overlays: [{png, pos}]}
export const LOOKS = {
  none: '',
  gameday: 'eq=contrast=1.15:saturation=1.35:brightness=0.02',
  punchy: 'eq=contrast=1.3:saturation=1.2,unsharp=5:5:0.8',
  bw: 'hue=s=0,eq=contrast=1.2',
  vintage: 'curves=preset=vintage',
  night: 'eq=brightness=0.08:gamma=1.3:saturation=1.1',
};
export async function edit(src, o, onProgress) {
  const f = await ensure();
  const id = ++seq, out = `/e${id}.mp4`, pos = `/q${id}.jpg`;
  const D = Math.max(1, o.end - o.start);
  const scale = "scale='if(gt(iw,ih),-2,540)':'if(gt(iw,ih),540,-2)'";
  const fx = [LOOKS[o.look] || '', (o.bright || o.contrast !== 1) ? `eq=brightness=${(o.bright || 0).toFixed(3)}:contrast=${(o.contrast || 1).toFixed(3)}` : ''].filter(Boolean).join(',');
  const aud = !!src.hasAudio;
  const g = [`[0:v]${scale},fps=30,setsar=1${fx ? ',' + fx : ''}[b]`];
  let v = 'b', a = aud ? '0:a' : null, outDur = D;
  if (o.slow) {
    const s1 = o.slow.a.toFixed(2), s2 = o.slow.b.toFixed(2);
    g.push(`[b]split=3[v1][v2][v3]`, `[v1]trim=0:${s1},setpts=PTS-STARTPTS[p1]`, `[v2]trim=${s1}:${s2},setpts=2*(PTS-STARTPTS)[p2]`, `[v3]trim=start=${s2},setpts=PTS-STARTPTS[p3]`);
    if (aud) {
      g.push(`[0:a]aresample=44100,asplit=3[a1][a2][a3]`, `[a1]atrim=0:${s1},asetpts=PTS-STARTPTS[q1]`, `[a2]atrim=${s1}:${s2},asetpts=PTS-STARTPTS,atempo=0.5[q2]`, `[a3]atrim=start=${s2},asetpts=PTS-STARTPTS[q3]`, `[p1][q1][p2][q2][p3][q3]concat=n=3:v=1:a=1[vc][ac]`);
      a = '[ac]';
    } else g.push(`[p1][p2][p3]concat=n=3:v=1:a=0[vc]`);
    v = 'vc'; outDur = D + (o.slow.b - o.slow.a);
  }
  const ins = [];
  (o.overlays || []).forEach((ov, i) => {
    const y = ov.pos === 'top' ? '48' : ov.pos === 'tag' ? 'main_h-overlay_h-24' : 'main_h-overlay_h-110';
    const x = ov.pos === 'tag' ? '16' : '(main_w-overlay_w)/2';
    g.push(`[${v}][${i + 1}:v]overlay=${x}:${y}[o${i}]`); v = `o${i}`;
  });
  for (let i = 0; i < (o.overlays || []).length; i++) { const p = `/t${id}_${i}.png`; await f.writeFile(p, new Uint8Array(o.overlays[i].png)); ins.push('-i', p); }
  const prog = ({ progress }) => onProgress && onProgress(Math.max(0, Math.min(1, progress)));
  f.on('progress', prog);
  try {
    const args = ['-ss', o.start.toFixed(2), '-t', D.toFixed(2), '-i', src.inp, ...ins, '-filter_complex', g.join(';'), '-map', `[${v}]`];
    if (a) args.push('-map', a.startsWith('[') ? a : '0:a?', '-c:a', 'aac', '-b:a', '96k', '-ac', '2');
    args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
    const rc = await f.exec(args);
    if (rc) throw new Error('Editing failed on this video. Try without slow-mo or a look.');
  } finally { f.off('progress', prog); }
  // Cover time inside the edited clip
  let c = Math.max(0, (o.cover ?? o.start) - o.start);
  if (o.slow) { if (c > o.slow.b) c += o.slow.b - o.slow.a; else if (c > o.slow.a) c = o.slow.a + 2 * (c - o.slow.a); }
  await f.exec(['-ss', Math.min(c, outDur - 0.1).toFixed(2), '-i', out, '-frames:v', '1', '-q:v', '5', pos]);
  const video = await f.readFile(out), poster = await f.readFile(pos);
  for (const p of [out, pos, ...ins.filter(x => x !== '-i')]) { try { await f.deleteFile(p); } catch (e) { /* gone */ } }
  return { video, poster, dur: outDur };
}

// Join several short video pieces (from a live stream) into one file. Tries a fast copy first, then a full conversion.
export async function join(blobs, type = 'video/mp4') {
  const f = await ensure();
  const id = ++seq, ext = type.includes('webm') ? 'webm' : 'mp4';
  const names = [];
  for (let i = 0; i < blobs.length; i++) { const n = `/j${id}_${i}.${ext}`; await f.writeFile(n, new Uint8Array(await blobs[i].arrayBuffer())); names.push(n); }
  const list = `/j${id}.txt`, out = `/j${id}_out.mp4`;
  await f.writeFile(list, new TextEncoder().encode(names.map(n => `file '${n}'`).join('\n')));
  const size = async p => { try { return (await f.readFile(p)).length; } catch (e) { return 0; } };
  let rc = await f.exec(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
  if (rc !== 0 || (await size(out)) < 20000) {
    try { await f.deleteFile(out); } catch (e) { /* none */ }
    rc = await f.exec(['-f', 'concat', '-safe', '0', '-i', list, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', out]);
  }
  const data = rc === 0 ? await f.readFile(out) : null;
  for (const p of [...names, list, out]) { try { await f.deleteFile(p); } catch (e) { /* gone */ } }
  if (!data) throw new Error('Could not put the stream pieces together');
  return new Blob([data], { type: 'video/mp4' });
}
