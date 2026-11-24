#!/usr/bin/env node
// Voice-over generator for mysuf-horror: turns a tagged VO script into one audio file
// using the Gemini TTS Interactions API. No npm dependencies (Node 18+ fetch).
//
//   node tts.mjs <naskah.md|.txt> [--out narasi.wav|.mp3] [--voice Enceladus|voice_...]
//                [--model gemini-3.8-flash-tts] [--style "..."] [--gap 0.2] [--dry-run] [--no-cache]
//   node tts.mjs clone --source sampel.wav --consent persetujuan.wav [--name "Suara Saya"]

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve, extname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-3.8-flash-tts';
const DEFAULT_VOICE = 'Enceladus';
const SAMPLE_RATE = 24000;
const DEFAULT_STYLE =
  'Speak like a real Indonesian person recounting a personal horror experience to a friend late at night. ' +
  'Natural Indonesian accent, conversational, grounded and unhurried, not theatrical. ' +
  'Let the fear build gradually through hesitation, heavier breathing and a trembling voice near the climax.';

// Pause lengths match the timing budget used by the `script` skill.
const PAUSES = { 'short pause': 0.5, 'medium pause': 1.0, 'long pause': 1.75 };

// Vocal sounds the TTS model renders inline (documented list, Gemini speech-generation docs).
const BURSTS = new Set([
  'argh', 'breath', 'heavy breath', 'exhales', 'cackle', 'cheer', 'chuckle', 'chuckles', 'cough', 'cry',
  'gasp', 'giggle', 'groan', 'growl', 'grunt', 'grr', 'hiss', 'laugh', 'laughter', 'moan', 'pant', 'pff',
  'phew', 'scream', 'shout', 'shriek', 'sigh', 'sighs', 'sneeze', 'snicker', 'snort', 'sob',
  'throat-clearing', 'tsk', 'whimper', 'whispers', 'whispering', 'yawn',
]);
// Tags used by the `script` skill (AI Studio style) mapped to the documented burst names.
const BURST_ALIASES = {
  inhale: 'breath', exhale: 'exhales', 'clearing throat': 'throat-clearing', crying: 'cry',
  sobbing: 'sob', sniffle: 'breath', yelling: 'shout', shouting: 'shout', whisper: 'whispering',
};
// At the start of a line these describe how the whole line is delivered, so they go to `style`.
const DELIVERY_AT_LINE_START = new Set(['whispers', 'whispering', 'whisper', 'shout', 'shouting', 'yelling', 'crying', 'sobbing']);

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { opts._.push(a); continue; }
    const key = a.slice(2);
    if (key === 'dry-run' || key === 'no-cache') { opts[key] = true; continue; }
    const val = argv[++i];
    if (val === undefined) die(`--${key} butuh nilai`);
    opts[key] = val;
  }
  return opts;
}

// ---------- script parsing ----------

function section(md, heading) {
  const re = new RegExp(`^##\\s+${heading}\\s*$`, 'im');
  const m = re.exec(md);
  if (!m) return null;
  const rest = md.slice(m.index + m[0].length);
  const next = rest.search(/^##\s+/m);
  return next === -1 ? rest : rest.slice(0, next);
}

function cleanBlock(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^```\w*\s*$/gm, '')
    .trim();
}

export function readScript(raw, styleOverride) {
  const vo = section(raw, 'Script Voice Over');
  const styleSec = section(raw, 'Style instructions');
  const script = cleanBlock(vo ?? raw);
  const fileStyle = styleSec ? cleanBlock(styleSec).replace(/\s+/g, ' ') : '';
  return { script, style: styleOverride || fileStyle || DEFAULT_STYLE, styleFromFile: Boolean(fileStyle) };
}

const norm = (t) => t.trim().toLowerCase().replace(/\s+/g, ' ');

// Returns a list of items: {silence: seconds} | {text, style: string[]}
export function parseLines(script, warn = () => {}) {
  const items = [];
  for (const rawLine of script.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;
    const style = [];
    // Leading tags: pause -> silence, delivery words -> style, vocal sounds -> stay inline.
    const inlineLead = [];
    let m;
    while ((m = /^<([^<>]+)>\s*/.exec(line))) {
      const tag = norm(m[1]);
      line = line.slice(m[0].length);
      if (tag in PAUSES) { items.push({ silence: PAUSES[tag] }); continue; }
      if (DELIVERY_AT_LINE_START.has(tag)) { style.push(tag.replace(/^whisper(s)?$/, 'whispering')); continue; }
      const burst = BURST_ALIASES[tag] ?? tag;
      if (BURSTS.has(burst)) { inlineLead.push(`<${burst}>`); continue; }
      style.push(tag);
    }
    // Tags inside the sentence: keep documented sounds/pauses, drop the rest so they are never read aloud.
    let text = line.replace(/<([^<>]+)>/g, (whole, inner) => {
      const tag = norm(inner);
      if (tag === 'short pause' || tag === 'long pause') return `<${tag}>`;
      if (tag === 'medium pause') return '<short pause>';
      const burst = BURST_ALIASES[tag] ?? tag;
      if (BURSTS.has(burst)) return `<${burst}>`;
      warn(`tag <${inner}> di tengah kalimat tidak dikenal, dibuang: "${rawLine.trim()}"`);
      return '';
    });
    text = [...inlineLead, text].join(' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    // What the subtitle shows: the spoken words only, never tags or vocal sounds.
    const display = text.replace(/<[^<>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    items.push({ text, style, display });
  }
  return items;
}

// Merge adjacent lines with the same delivery into one request; silences always split.
export function toSegments(items) {
  const segs = [];
  for (const it of items) {
    const last = segs[segs.length - 1];
    if (it.silence !== undefined) {
      if (last && last.silence !== undefined) last.silence += it.silence;
      else segs.push({ silence: it.silence });
      continue;
    }
    const key = it.style.join('|');
    const lines = it.display ? [it.display] : [];
    if (last && last.text !== undefined && last.key === key) { last.text += ' ' + it.text; last.lines.push(...lines); }
    else segs.push({ text: it.text, style: it.style, key, lines });
  }
  return segs;
}

// ---------- subtitles ----------

// [start, end] seconds of audible speech inside a clip, so model-added leading/trailing
// silence does not shift the subtitles. 10 ms windows, peak above ~2% full scale.
export function voicedRange(pcm) {
  const win = SAMPLE_RATE / 100, n = Math.floor(pcm.length / 2);
  let first = -1, last = -1;
  for (let w = 0; w * win < n; w++) {
    let peak = 0;
    for (let i = w * win; i < Math.min(n, (w + 1) * win); i++) peak = Math.max(peak, Math.abs(pcm.readInt16LE(i * 2)));
    if (peak > 650) { if (first < 0) first = w; last = w; }
  }
  if (first < 0) return [0, n / SAMPLE_RATE];
  return [first * win / SAMPLE_RATE, Math.min(n, (last + 1) * win) / SAMPLE_RATE];
}

// Break one VO line into screen-sized cues (≤7 words / ≤38 chars): split at punctuation
// first, cut any still-long clause into even parts, then rejoin short whole clauses that fit.
const CUE_WORDS = 7, CUE_CHARS = 38;
const fits = (s) => s.split(' ').length <= CUE_WORDS && s.length <= CUE_CHARS;
export function splitCue(line) {
  const cues = [];
  let lastWhole = false;
  for (const clause of line.split(/(?<=[,.;:!?…])\s+/)) {
    const words = clause.split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const k = Math.max(1, Math.ceil(words.length / CUE_WORDS), Math.ceil(clause.length / CUE_CHARS));
    if (k === 1 && lastWhole && fits(cues[cues.length - 1] + ' ' + clause)) {
      cues[cues.length - 1] += ' ' + clause;
      continue;
    }
    for (let i = 0; i < k; i++) {
      const part = words.slice(Math.round((i * words.length) / k), Math.round(((i + 1) * words.length) / k));
      if (part.length) cues.push(part.join(' '));
    }
    lastWhole = k === 1;
  }
  return cues;
}

// Spread a merged segment's lines over its voiced span, weighted by text length.
// Timing inside a segment is an estimate; segment boundaries come from the real audio.
export function timeLines(lines, t0, t1) {
  const cues = lines.flatMap(splitCue);
  const weight = (c) => c.length + 4;
  const total = cues.reduce((a, c) => a + weight(c), 0);
  let t = t0;
  return cues.map((text) => {
    const start = t;
    t += (t1 - t0) * weight(text) / total;
    return { start, end: t, text };
  });
}

function srtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

export function toSrt(cues) {
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n');
}

function styleFor(base, words) {
  return words.length ? `${base}\nDelivery for this part: ${words.join(', ')}.` : base;
}

// ---------- audio helpers ----------

export function wavToPcm(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return buf; // headerless audio/l16
  let off = 12, fmt = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === 'fmt ') {
      fmt = {
        format: buf.readUInt16LE(body), channels: buf.readUInt16LE(body + 2),
        rate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      if (!fmt) throw new Error('WAV tanpa chunk fmt');
      if (fmt.format !== 1 || fmt.channels !== 1 || fmt.rate !== SAMPLE_RATE || fmt.bits !== 16) {
        throw new Error(`format WAV tak terduga: ${JSON.stringify(fmt)} (butuh PCM 24kHz mono 16-bit)`);
      }
      // Some streams write 0 or 0xFFFFFFFF as size; fall back to the rest of the buffer.
      const end = size && body + size <= buf.length ? body + size : buf.length;
      return buf.subarray(body, end);
    }
    off = body + size + (size % 2);
  }
  throw new Error('WAV tanpa chunk data');
}

function pcmToWav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SAMPLE_RATE, 24); h.writeUInt32LE(SAMPLE_RATE * 2, 28); h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const silencePcm = (sec) => Buffer.alloc(Math.round(sec * SAMPLE_RATE) * 2);

function hasFfmpeg() {
  return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
}

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) die(`ffmpeg gagal: ${r.stderr || r.error}`);
}

// ---------- API ----------

function apiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) die('GEMINI_API_KEY belum di-set. Buat key di https://aistudio.google.com/apikey lalu set environment variable GEMINI_API_KEY.');
  return key;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body, key) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}/${path}`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }
    if (res.ok) return json;
    const msg = json?.error?.message || text.slice(0, 500);
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 5) throw new Error(`HTTP ${res.status}: ${msg}`);
    const hinted = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(text);
    const waitS = hinted ? Math.ceil(Number(hinted[1])) + 1 : 5 * 2 ** attempt;
    console.error(`  HTTP ${res.status}, coba lagi dalam ${waitS} dtk...`);
    await sleep(waitS * 1000);
  }
}

function findAudio(json) {
  for (const step of json?.steps ?? []) {
    for (const c of step?.content ?? []) {
      if (c?.type === 'audio' && c.data) return c.data;
    }
  }
  return null;
}

async function synth({ text, style, voice, model, key }) {
  const body = {
    model,
    input: [{
      type: 'user_input',
      content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style }] }],
    }],
    response_format: { type: 'audio' },
    generation_config: { speech_config: [{ voice }] },
  };
  const json = await post('interactions', body, key);
  const b64 = findAudio(json);
  if (!b64) throw new Error(`respons tanpa audio: ${JSON.stringify(json).slice(0, 400)}`);
  return wavToPcm(Buffer.from(b64, 'base64'));
}

// ---------- commands ----------

async function generate(opts) {
  const input = opts._[0];
  if (!input) die('pakai: node tts.mjs <naskah.md|.txt> [--out narasi.wav|.mp3] [--voice Nama] [--dry-run]');
  if (!existsSync(input)) die(`file tidak ada: ${input}`);
  const out = resolve(opts.out || join(dirname(input), basename(input, extname(input)) + '.vo.wav'));
  const voice = opts.voice || DEFAULT_VOICE;
  const model = opts.model || DEFAULT_MODEL;
  const gap = opts.gap !== undefined ? Number(opts.gap) : 0.2;
  if (!Number.isFinite(gap) || gap < 0) die('--gap harus angka >= 0');

  const { script, style, styleFromFile } = readScript(readFileSync(input, 'utf8'), opts.style);
  const warnings = [];
  const segs = toSegments(parseLines(script, (w) => warnings.push(w)));
  const speech = segs.filter((s) => s.text !== undefined);
  if (!speech.length) die('tidak ada teks yang bisa dibacakan di naskah');

  console.log(`Model: ${model} · Suara: ${voice} · Style: ${opts.style ? '--style' : styleFromFile ? 'dari file' : 'default horor'}`);
  console.log(`Segmen: ${speech.length} permintaan TTS, ${segs.length - speech.length} jeda`);
  warnings.forEach((w) => console.warn(`  peringatan: ${w}`));

  if (opts['dry-run']) {
    console.log(`\nStyle dasar:\n  ${style}\n`);
    segs.forEach((s, i) => {
      if (s.silence !== undefined) console.log(`${String(i + 1).padStart(2)}. [jeda ${s.silence.toFixed(2)} dtk]`);
      else console.log(`${String(i + 1).padStart(2)}. (${s.style.join(', ') || 'style dasar'}) ${s.text}`);
    });
    return;
  }

  const key = apiKey();
  const cacheDir = join(dirname(out), '.vo-cache');
  if (!opts['no-cache']) mkdirSync(cacheDir, { recursive: true });

  const parts = [];
  const cues = [];
  let bytes = 0;
  const push = (buf) => { parts.push(buf); bytes += buf.length; };
  let n = 0;
  for (const s of segs) {
    if (s.silence !== undefined) { push(silencePcm(s.silence)); continue; }
    n++;
    const fullStyle = styleFor(style, s.style);
    const hash = createHash('sha256').update(JSON.stringify([model, voice, fullStyle, s.text])).digest('hex').slice(0, 16);
    const cached = join(cacheDir, `${hash}.pcm`);
    let pcm;
    if (!opts['no-cache'] && existsSync(cached)) {
      pcm = readFileSync(cached);
      console.log(`  [${n}/${speech.length}] cache  ${s.text.slice(0, 60)}`);
    } else {
      console.log(`  [${n}/${speech.length}] TTS    ${s.text.slice(0, 60)}`);
      try {
        pcm = await synth({ text: s.text, style: fullStyle, voice, model, key });
      } catch (e) {
        die(`segmen ${n} gagal — ${e.message}\nSegmen yang sudah jadi tersimpan di cache; jalankan ulang untuk melanjutkan.`);
      }
      if (!opts['no-cache']) writeFileSync(cached, pcm);
    }
    // Small breath between consecutive spoken segments, unless a pause line already separates them.
    const prev = parts.length ? segs[segs.indexOf(s) - 1] : null;
    if (prev && prev.text !== undefined && gap > 0) push(silencePcm(gap));
    const at = bytes / 2 / SAMPLE_RATE;
    const [v0, v1] = voicedRange(pcm);
    if (s.lines.length) cues.push(...timeLines(s.lines, at + v0, at + v1));
    push(pcm);
  }
  push(silencePcm(0.5));

  const pcm = Buffer.concat(parts);
  const seconds = pcm.length / 2 / SAMPLE_RATE;
  mkdirSync(dirname(out), { recursive: true });
  if (extname(out).toLowerCase() === '.wav') {
    writeFileSync(out, pcmToWav(pcm));
  } else {
    if (!hasFfmpeg()) die('ffmpeg tidak ditemukan; pakai --out *.wav atau install ffmpeg');
    const tmp = join(tmpdir(), `vo-${process.pid}.wav`);
    writeFileSync(tmp, pcmToWav(pcm));
    ffmpeg(['-i', tmp, ...(extname(out).toLowerCase() === '.mp3' ? ['-codec:a', 'libmp3lame', '-q:a', '2'] : []), out]);
    rmSync(tmp, { force: true });
  }
  const srt = out.slice(0, out.length - extname(out).length) + '.srt';
  writeFileSync(srt, toSrt(cues));
  console.log(`\nSelesai: ${out} (${seconds.toFixed(1)} dtk)`);
  console.log(`Subtitle: ${srt} (${cues.length} baris)`);
}

function loadAsWav24k(path) {
  if (!existsSync(path)) die(`file tidak ada: ${path}`);
  if (!hasFfmpeg()) {
    const buf = readFileSync(path);
    wavToPcm(buf); // validates 24kHz mono 16-bit
    return buf;
  }
  const tmp = join(tmpdir(), `vo-clone-${process.pid}-${basename(path)}.wav`);
  ffmpeg(['-i', path, '-ac', '1', '-ar', String(SAMPLE_RATE), '-sample_fmt', 's16', tmp]);
  const buf = readFileSync(tmp);
  rmSync(tmp, { force: true });
  return buf;
}

function findVoiceIds(obj, found = new Set()) {
  if (typeof obj === 'string' && /^voice(key)?_/.test(obj)) found.add(obj);
  else if (obj && typeof obj === 'object') Object.values(obj).forEach((v) => findVoiceIds(v, found));
  return found;
}

async function clone(opts) {
  if (!opts.source || !opts.consent) {
    die('pakai: node tts.mjs clone --source sampel.wav --consent persetujuan.wav [--name "Suara Saya"]');
  }
  const source = loadAsWav24k(opts.source);
  const consent = loadAsWav24k(opts.consent);
  const srcSec = wavToPcm(source).length / 2 / SAMPLE_RATE;
  if (srcSec < 10 || srcSec > 30) die(`rekaman sampel ${srcSec.toFixed(1)} dtk; harus 10–30 dtk`);

  const body = {
    store: true,
    voice: {
      model: opts.model || DEFAULT_MODEL,
      type: 'replicated',
      display_name: opts.name || 'Suara Narator',
      replicated: {
        source_audio: { mime_type: 'audio/wav', data: source.toString('base64') },
        consent_audio: { mime_type: 'audio/wav', data: consent.toString('base64') },
      },
    },
  };
  let json;
  try {
    json = await post('voices', body, apiKey());
  } catch (e) {
    die(`gagal membuat suara — ${e.message}\n(Voice replication hanya untuk project Gemini API Paid Tier.)`);
  }
  const ids = [...findVoiceIds(json)];
  if (!ids.length) {
    console.log(JSON.stringify(json, null, 2));
    die('suara dibuat tapi ID tidak ditemukan di respons; cek JSON di atas');
  }
  console.log(`Suara berhasil dibuat. ID: ${ids[0]}`);
  console.log(`Pakai dengan: node tts.mjs naskah.md --voice ${ids[0]}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const opts = parseArgs(process.argv.slice(2));
  const run = opts._[0] === 'clone' ? clone : generate;
  run(opts).catch((e) => die(e.message));
}
