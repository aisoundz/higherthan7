// Jamoja highlight engine: runs entirely in the browser with ffmpeg.wasm.
// It reads the video in place (no full copy into memory), finds loud crowd moments,
// and cuts each chosen moment into a small H.264 clip that plays on any phone.
import { FFmpeg } from './vendor/ffmpeg/index.js';

let ff = null, loading = null, seq = 0;
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
export async function cut(src, start, end, onProgress) {
  const f = await ensure();
  const d = Math.max(1, end - start);
  const id = ++seq;
  const out = `/c${id}.mp4`, pos = `/p${id}.jpg`;
  const scale = "scale='if(gt(iw,ih),-2,540)':'if(gt(iw,ih),540,-2)'";
  const prog = ({ progress }) => onProgress && onProgress(Math.max(0, Math.min(1, progress)));
  f.on('progress', prog);
  const copy = src.codec === 'h264';
  const args = ['-ss', start.toFixed(2), '-i', src.inp, '-t', d.toFixed(2)];
  if (copy) args.push('-c', 'copy');
  else args.push('-vf', scale, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-ac', '2');
  args.push('-movflags', '+faststart', out);
  await f.exec(args);
  f.off('progress', prog);
  await f.exec(['-ss', (start + d * 0.6).toFixed(2), '-i', src.inp, '-frames:v', '1', '-vf', scale, '-q:v', '5', pos]);
  const video = await f.readFile(out), poster = await f.readFile(pos);
  await f.deleteFile(out); await f.deleteFile(pos);
  return { video, poster, dur: d };
}

export async function close(src) {
  try { await (await ensure()).unmount(src.dir); await ff.deleteDir(src.dir); } catch (e) { /* already closed */ }
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
