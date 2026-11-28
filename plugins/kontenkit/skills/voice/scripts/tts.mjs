#!/usr/bin/env node
// Voice-over generator for kontenkit: turns a tagged VO script into one audio file
// using the Gemini TTS Interactions API. No npm dependencies (Node 18+ fetch).
//
//   node tts.mjs <naskah.md|.txt> [--out narasi.wav|.mp3] [--voice Enceladus|voice_...]
//                [--model gemini-3.8-flash-tts] [--style "..."] [--gap 0.2] [--dry-run] [--no-cache]
//   node tts.mjs clone --source sampel.wav --consent persetujuan.wav [--name "Suara Saya"]
//
// ElevenLabs (ELEVENLABS_API_KEY):
//   node tts.mjs voices [--search kata]                                  -> voice IDs in the account + credits
//   node tts.mjs cast <vo-generate.md> --voices voices.json --engine elevenlabs [--dir out]  -> one take per character
//   node tts.mjs <naskah.md> --engine elevenlabs --voice <voice_id> [--model eleven_v3] [--accent "casual Jakarta accent"] [--lang id|auto] [--out x.wav]
//
// Manual mode (Google AI Studio web, free, no API key):
//   node tts.mjs prep <naskah.md> [--dir folder] [--voice Nama]   -> potongan.md + rencana.json
//   node tts.mjs stitch <folder> [file1 file2 ...] [--out narasi.mp3] [--gap 0.4]
//   node tts.mjs align <naskah.md> <take.wav> [--out x.vo.wav] [--whisper-model f] [--lang id]  -> one full take

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, realpathSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve, extname, basename } from 'node:path';
import { tmpdir, homedir } from 'node:os';
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

// ---------- ElevenLabs (--engine elevenlabs) ----------

const EL_API = 'https://api.elevenlabs.io/v1';
const EL_DEFAULT_MODEL = 'eleven_v3';

function elKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) die('ELEVENLABS_API_KEY belum di-set. Buat key di https://elevenlabs.io/app/settings/api-keys lalu set environment variable ELEVENLABS_API_KEY.');
  return key;
}

async function elFetch(path, { method = 'GET', body, key, raw = false } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${EL_API}${path}`, {
      method,
      headers: { 'xi-api-key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return raw ? Buffer.from(await res.arrayBuffer()) : res.json();
    const text = await res.text();
    let msg = text.slice(0, 500);
    try { const j = JSON.parse(text); msg = j?.detail?.message || j?.detail?.status || msg; } catch { /* keep raw text */ }
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 4) throw new Error(`ElevenLabs HTTP ${res.status}: ${msg}`);
    const waitS = 5 * 2 ** attempt;
    console.error(`  HTTP ${res.status}, coba lagi dalam ${waitS} dtk...`);
    await sleep(waitS * 1000);
  }
}

// Script tags (AI Studio style) -> ElevenLabs v3 audio tags. Delivery words from the line start
// become a leading [tag]; inline vocal sounds become [sound]; pauses become an ellipsis.
const EL_TAG = {
  whispering: 'whispers', whispers: 'whispers', shout: 'shouts', shouting: 'shouts', yelling: 'shouts',
  laugh: 'laughs', laughter: 'laughs', chuckle: 'chuckles', chuckles: 'chuckles', giggle: 'giggles',
  sigh: 'sighs', sighs: 'sighs', gasp: 'gasps', breath: 'inhales', exhales: 'exhales', cry: 'crying',
  sob: 'sobbing', cough: 'coughs', yawn: 'yawns', 'throat-clearing': 'clears throat',
};
// Only eleven_v3 understands [audio tags]; older models (multilingual_v2, flash, turbo) read them
// aloud, so for those the tags are dropped and only the words (plus pause ellipses) are sent.
// accent: a v3 tag put before every request (e.g. "casual Jakarta accent"); each line is sent on
// its own, so a tag on the first line alone would not hold for the rest.
export function toElevenText(text, style, model = EL_DEFAULT_MODEL, accent = '') {
  const tags = /^eleven_v3/.test(model);
  const lead = tags ? [...(accent ? [accent] : []), ...style.map((w) => EL_TAG[w] || w)].map((w) => `[${w}]`).join(' ') : '';
  const body = text.replace(/<([^<>]+)>/g, (_, t) => (/pause$/.test(t) ? '...' : tags ? `[${EL_TAG[t] || t}]` : ''));
  return `${lead} ${body}`.replace(/\s+/g, ' ').trim();
}

// lang: language_code sent to the API (default "id"); "auto" leaves it out so the model follows
// the voice sample, which can keep a cloned voice closer to its own accent.
async function synthEleven({ text, voice, model, key, lang = 'id' }) {
  const settings = model === 'eleven_v3' ? { stability: 0.5 } : { stability: 0.45, similarity_boost: 0.8, style: 0.3 };
  // pcm_24000 = raw 16-bit mono at the same rate the rest of this script works in
  return elFetch(`/text-to-speech/${encodeURIComponent(voice)}?output_format=pcm_24000`, {
    method: 'POST', key, raw: true,
    body: { text, model_id: model, ...(lang === 'auto' ? {} : { language_code: lang }), voice_settings: settings },
  });
}

// node tts.mjs cast <vo-generate.md> --voices voices.json [--dir out] [--engine elevenlabs|gemini] [--dry-run]
// A multi-character VO file: one "## <Character>" section per character, each with a
// "**Simpan sebagai:** `.../<key>.wav`" line and its own "### Script Voice Over" (+ optional
// "### Style instructions"). voices.json maps <key> -> voice id/name. Writes <dir>/<key>.wav (+ .srt).
async function cast(opts) {
  const input = opts._[1];
  if (!input || !opts.voices) die('pakai: node tts.mjs cast <vo-generate.md> --voices voices.json [--dir folder] [--engine elevenlabs]');
  if (!existsSync(input)) die(`file tidak ada: ${input}`);
  const map = JSON.parse(readFileSync(opts.voices, 'utf8'));
  const dir = resolve(opts.dir || dirname(input));
  const md = readFileSync(input, 'utf8');
  const parts = md.split(/^##\s+(?!#)/m).slice(1);
  let done = 0;
  for (const part of parts) {
    const key = /Simpan sebagai:\*\*\s*`[^`]*?([\w-]+)\.wav`/.exec(part)?.[1];
    if (!key) continue;
    if (!map[key]) die(`voices.json belum punya suara untuk "${key}"`);
    const vo = /^###\s+Script Voice Over\s*$([\s\S]*?)(?=^###\s|$(?![\s\S]))/m.exec(part)?.[1];
    const st = /^###\s+Style instructions\s*$([\s\S]*?)(?=^###\s|$(?![\s\S]))/m.exec(part)?.[1];
    if (!vo) die(`bagian "${key}" tidak punya ### Script Voice Over`);
    const tmp = join(tmpdir(), `vo-cast-${process.pid}-${key}.md`);
    const strip = (s) => s.replace(/^-{3,}\s*$/gm, '');   // section separators are not part of the text
    writeFileSync(tmp, `## Script Voice Over\n${strip(vo)}\n${st ? `## Style instructions\n${strip(st)}\n` : ''}`);
    console.log(`\n=== ${key} (${map[key]})`);
    try {
      await generate({ ...opts, _: [tmp], voice: map[key], out: join(dir, `${key}.wav`) });
    } finally {
      rmSync(tmp, { force: true });
    }
    done++;
  }
  if (!done) die('tidak ada bagian karakter (## Nama + "Simpan sebagai: `...<key>.wav`") di file ini');
}

// node tts.mjs voices [--search kata]  -> voices in the account (id, name, labels) + remaining credits
async function voices(opts) {
  const key = elKey();
  const sub = await elFetch('/user/subscription', { key });
  console.log(`Paket: ${sub.tier} · kredit terpakai ${sub.character_count} / ${sub.character_limit} · reset ${new Date(sub.next_character_count_reset_unix * 1000).toLocaleDateString('id-ID')}\n`);
  const q = opts.search ? `?search=${encodeURIComponent(opts.search)}` : '';
  const { voices: list } = await elFetch(`/voices${q}`, { key });
  for (const v of list) {
    const l = v.labels || {};
    console.log(`${v.voice_id}  ${v.name}  (${[l.gender, l.age, l.accent, l.language, v.category].filter(Boolean).join(', ')})`);
  }
  console.log(`\n${list.length} suara. Pakai: node tts.mjs <naskah.md> --engine elevenlabs --voice <voice_id>`);
}

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
  const eleven = (opts.engine || 'gemini').toLowerCase() === 'elevenlabs';
  if (!eleven && opts.engine && opts.engine.toLowerCase() !== 'gemini') die('--engine harus gemini atau elevenlabs');
  if (eleven && !opts.voice) die('--engine elevenlabs butuh --voice <voice_id> (lihat: node tts.mjs voices)');
  const voice = opts.voice || DEFAULT_VOICE;
  const model = opts.model || (eleven ? EL_DEFAULT_MODEL : DEFAULT_MODEL);
  const gap = opts.gap !== undefined ? Number(opts.gap) : 0.2;
  if (!Number.isFinite(gap) || gap < 0) die('--gap harus angka >= 0');

  const { script, style, styleFromFile } = readScript(readFileSync(input, 'utf8'), opts.style);
  const warnings = [];
  const segs = toSegments(parseLines(script, (w) => warnings.push(w)));
  const speech = segs.filter((s) => s.text !== undefined);
  if (!speech.length) die('tidak ada teks yang bisa dibacakan di naskah');

  console.log(`${eleven ? 'ElevenLabs' : 'Gemini'} · Model: ${model} · Suara: ${voice}${eleven ? ' (style instructions tidak dipakai; karakter suara dari voice-nya, ekspresi dari tag)' : ` · Style: ${opts.style ? '--style' : styleFromFile ? 'dari file' : 'default horor'}`}`);
  console.log(`Segmen: ${speech.length} permintaan TTS, ${segs.length - speech.length} jeda`);
  warnings.forEach((w) => console.warn(`  peringatan: ${w}`));

  if (opts['dry-run']) {
    console.log(`\nStyle dasar:\n  ${style}\n`);
    segs.forEach((s, i) => {
      if (s.silence !== undefined) console.log(`${String(i + 1).padStart(2)}. [jeda ${s.silence.toFixed(2)} dtk]`);
      else console.log(`${String(i + 1).padStart(2)}. ${eleven ? toElevenText(s.text, s.style, model, opts.accent) : `(${s.style.join(', ') || 'style dasar'}) ${s.text}`}`);
    });
    return;
  }

  const key = eleven ? elKey() : apiKey();
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
    const fullStyle = eleven ? toElevenText(s.text, s.style, model, opts.accent) : styleFor(style, s.style);
    const hash = createHash('sha256').update(JSON.stringify([eleven ? 'el:' + (opts.lang || 'id') : 'g', model, voice, fullStyle, s.text])).digest('hex').slice(0, 16);
    const cached = join(cacheDir, `${hash}.pcm`);
    let pcm;
    if (!opts['no-cache'] && existsSync(cached)) {
      pcm = readFileSync(cached);
      console.log(`  [${n}/${speech.length}] cache  ${s.text.slice(0, 60)}`);
    } else {
      console.log(`  [${n}/${speech.length}] TTS    ${s.text.slice(0, 60)}`);
      try {
        pcm = eleven ? await synthEleven({ text: fullStyle, voice, model, key, lang: opts.lang }) : await synth({ text: s.text, style: fullStyle, voice, model, key });
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

// ---------- manual mode (Google AI Studio web, no API key) ----------

const CHUNK_MAX_WORDS = 45, CHUNK_MIN_WORDS = 8;
const countWords = (t) => t.replace(/<[^<>]*>/g, ' ').split(/\s+/).filter(Boolean).length;

// Group lines into a few paste-sized chunks. Medium/long pauses are natural beat breaks and
// become exact silence when stitching; short pauses stay inline as AI Studio tags.
export function buildChunks(items) {
  const chunks = [];
  let cur = null;
  const close = () => {
    if (!cur) return;
    while (cur.text.length && cur.text[cur.text.length - 1] === '<short pause>') cur.text.pop();
    chunks.push(cur);
    cur = null;
  };
  for (const it of items) {
    if (it.silence !== undefined) {
      if (it.silence >= 1) { close(); if (chunks.length) chunks[chunks.length - 1].pauseAfter += it.silence; }
      else if (cur) cur.text.push('<short pause>');
      else if (chunks.length) chunks[chunks.length - 1].pauseAfter += it.silence;
      continue;
    }
    cur ??= { text: [], lines: [], moods: [], pauseAfter: 0, words: 0 };
    const style = it.style.join(', ');
    if (cur.moods[cur.moods.length - 1]?.style !== style) cur.moods.push({ style, from: it.display });
    cur.text.push(it.text);
    if (it.display) cur.lines.push(it.display);
    cur.words += countWords(it.text);
    if (cur.words >= CHUNK_MAX_WORDS) close();
  }
  close();
  // A chunk of a few words is not worth a separate take: fold it into its neighbour.
  const mergeInto = (i) => {
    const p = chunks[i - 1], c = chunks[i];
    p.text.push(p.pauseAfter >= 1.5 ? '<long pause>' : '<short pause>', ...c.text);
    p.lines.push(...c.lines);
    for (const m of c.moods) if (p.moods[p.moods.length - 1].style !== m.style) p.moods.push(m);
    p.words += c.words;
    p.pauseAfter = c.pauseAfter;
    chunks.splice(i, 1);
  };
  for (let i = chunks.length - 1; i > 0; i--) if (chunks[i].words < CHUNK_MIN_WORDS) mergeInto(i);
  if (chunks.length > 1 && chunks[0].words < CHUNK_MIN_WORDS) mergeInto(1);
  return chunks;
}

function chunkStyle(base, moods) {
  const named = (s) => s || 'the base style';
  if (moods.every((m) => !m.style)) return base;
  if (moods.length === 1) return `${base}\nDelivery for this part: ${moods[0].style}.`;
  const steps = moods.map((m, i) => {
    if (i === 0) return `start ${named(m.style)}`;
    const cue = m.from.replace(/["“”]/g, '').split(/\s+/).slice(0, 5).join(' ').replace(/[.,;:!?…]+$/, '');
    return `from "${cue}..." switch to ${named(m.style)}`;
  });
  return `${base}\nDelivery for this part: ${steps.join('; ')}.`;
}

const pad2 = (n) => String(n).padStart(2, '0');
const AUDIO_EXT = /\.(wav|mp3|m4a|aac|ogg|opus|flac|webm)$/i;

async function prep(opts) {
  const input = opts._[1];
  if (!input) die('pakai: node tts.mjs prep <naskah.md|.txt> [--dir folder] [--voice Nama] [--style "..."]');
  if (!existsSync(input)) die(`file tidak ada: ${input}`);
  const dir = resolve(opts.dir || join(dirname(input), basename(input, extname(input)) + '-vo'));
  const voice = opts.voice || DEFAULT_VOICE;
  const { script, style } = readScript(readFileSync(input, 'utf8'), opts.style);
  const warnings = [];
  const chunks = buildChunks(parseLines(script, (w) => warnings.push(w)));
  if (!chunks.length) die('tidak ada teks yang bisa dibacakan di naskah');
  warnings.forEach((w) => console.warn(`  peringatan: ${w}`));

  mkdirSync(dir, { recursive: true });
  const md = [
    '# Potongan VO untuk Google AI Studio',
    '',
    `Suara: **${voice}**. Pakai suara yang sama untuk semua potongan supaya narasinya seragam.`,
    '',
    '1. Buka https://aistudio.google.com, pilih **Generate Speech** (single speaker), pilih suara di atas.',
    '2. Per potongan: tempel **Style instructions** dan **Teks**, klik Run, dengarkan. Ulangi Run kalau intonasinya kurang pas.',
    `3. Download audionya ke folder ini dengan nama sesuai judul potongan: ${chunks.map((_, i) => `\`${pad2(i + 1)}.wav\``).join(', ')} (mp3/m4a juga boleh).`,
    `4. Kalau semua sudah, gabungkan: \`node tts.mjs stitch "${dir}"\``,
    '',
  ];
  chunks.forEach((c, i) => {
    const label = c.moods.map((m) => m.style || 'dasar').join(' → ');
    md.push(
      `## ${pad2(i + 1)} · ${label} · ${c.words} kata (±${Math.round(c.words / 2.3)} dtk)`,
      '',
      '**Style instructions**',
      '```text', chunkStyle(style, c.moods), '```',
      '',
      '**Teks**',
      '```text', c.text.join('\n'), '```',
      '',
      c.pauseAfter ? `_Setelah potongan ini: hening ${c.pauseAfter.toFixed(2)} dtk (ditambahkan otomatis saat digabung)._` : '',
      '',
    );
  });
  writeFileSync(join(dir, 'potongan.md'), md.join('\n'));
  writeFileSync(join(dir, 'rencana.json'), JSON.stringify({
    voice,
    chunks: chunks.map((c, i) => ({ file: pad2(i + 1), pauseAfter: c.pauseAfter, lines: c.lines })),
  }, null, 2));
  console.log(`Folder: ${dir}`);
  console.log(`Potongan: ${chunks.length} (${chunks.map((c) => c.words).join(' + ')} kata) · suara ${voice}`);
  console.log(`Petunjuk tempel: ${join(dir, 'potongan.md')}`);
}

// Leading/trailing silence trimmed (50 ms kept) so the planned pauses are the real pauses,
// then each take normalized on its own: AI Studio takes come out at different levels.
const TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,'
  + 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,'
  + 'loudnorm=I=-16:TP=-1.5:LRA=11';

function decodeTrimmed(path) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path, '-af', TRIM,
    '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', '-acodec', 'pcm_s16le', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) die(`gagal membaca ${basename(path)}: ${r.stderr?.toString() || r.error}`);
  if (!r.stdout.length) die(`${basename(path)} kosong atau hening semua`);
  return r.stdout;
}

async function stitch(opts) {
  const dir = opts._[1];
  if (!dir) die('pakai: node tts.mjs stitch <folder-potongan> [file1 file2 ...] [--out narasi.mp3] [--gap 0.4]');
  const planPath = join(dir, 'rencana.json');
  if (!existsSync(planPath)) die(`rencana.json tidak ada di ${dir}; jalankan "prep" dulu`);
  if (!hasFfmpeg()) die('ffmpeg tidak ditemukan; mode manual butuh ffmpeg untuk membaca file dari AI Studio');
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const gap = opts.gap !== undefined ? Number(opts.gap) : 0.4;
  if (!Number.isFinite(gap) || gap < 0) die('--gap harus angka >= 0');

  // Explicit file list wins; otherwise match 01.*, 02.* ... in the folder.
  const explicit = opts._.slice(2);
  if (explicit.length && explicit.length !== plan.chunks.length) {
    die(`rencana punya ${plan.chunks.length} potongan tapi diberi ${explicit.length} file`);
  }
  const present = readdirSync(dir).filter((f) => AUDIO_EXT.test(f));
  const missing = [];
  const files = plan.chunks.map((c, i) => {
    if (explicit.length) return resolve(explicit[i]);
    const hit = present.find((f) => new RegExp(`^0*${i + 1}(?![0-9])`).test(f));
    if (!hit) missing.push(`${c.file}.wav`);
    return hit && join(dir, hit);
  });
  if (missing.length) die(`file belum ada di ${dir}: ${missing.join(', ')}`);
  files.forEach((f) => { if (!existsSync(f)) die(`file tidak ada: ${f}`); });

  const parts = [], cues = [];
  let bytes = 0;
  const push = (buf) => { parts.push(buf); bytes += buf.length; };
  push(silencePcm(0.2));
  plan.chunks.forEach((c, i) => {
    const pcm = decodeTrimmed(files[i]);
    const at = bytes / 2 / SAMPLE_RATE;
    const [v0, v1] = voicedRange(pcm);
    if (c.lines.length) cues.push(...timeLines(c.lines, at + v0, at + v1));
    push(pcm);
    console.log(`  ${c.file}: ${basename(files[i])} (${(pcm.length / 2 / SAMPLE_RATE).toFixed(1)} dtk)`);
    if (i < plan.chunks.length - 1) push(silencePcm(c.pauseAfter || gap));
  });
  push(silencePcm(0.5));

  const out = resolve(opts.out || join(dir, 'narasi.mp3'));
  const tmp = join(tmpdir(), `vo-stitch-${process.pid}.wav`);
  writeFileSync(tmp, pcmToWav(Buffer.concat(parts)));
  const codec = extname(out).toLowerCase() === '.mp3' ? ['-codec:a', 'libmp3lame', '-q:a', '2'] : [];
  ffmpeg(['-i', tmp, ...codec, out]);
  rmSync(tmp, { force: true });
  const srt = out.slice(0, out.length - extname(out).length) + '.srt';
  writeFileSync(srt, toSrt(cues));
  console.log(`\nSelesai: ${out} (${(bytes / 2 / SAMPLE_RATE).toFixed(1)} dtk)`);
  console.log(`Subtitle: ${srt} (${cues.length} baris)`);
}

// ---------- align: one full AI Studio take -> clean VO + synced subtitles ----------

const DEFAULT_WHISPER_MODEL = join(homedir(), 'whisper-models', 'ggml-base.bin');

// Speech gaps in a clip: runs of quiet 10 ms frames, at least `minLen` seconds long.
export function findGaps(pcm, minLen = 0.25) {
  const fr = SAMPLE_RATE / 100, n = Math.floor(pcm.length / 2), voiced = [];
  for (let f = 0; f * fr < n; f++) {
    let p = 0;
    for (let i = f * fr; i < Math.min(n, (f + 1) * fr); i++) p = Math.max(p, Math.abs(pcm.readInt16LE(i * 2)));
    voiced.push(p > 900);
  }
  const first = voiced.indexOf(true), last = voiced.lastIndexOf(true);
  const gaps = [];
  let s = -1;
  for (let f = first; f <= last; f++) {
    if (!voiced[f] && s < 0) s = f;
    if (voiced[f] && s >= 0) { if ((f - s) / 100 >= minLen) gaps.push({ a: s / 100, b: f / 100, len: (f - s) / 100 }); s = -1; }
  }
  return { gaps, t0: Math.max(0, first) / 100, t1: (last + 1) / 100 };
}

const fold = (t) => t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');
const bigrams = (t) => { const s = fold(t), out = new Set(); for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2)); return out; };

// Share of a whisper segment's letter pairs found in `bg`. Whisper mishears whispered
// Indonesian badly, so this is fuzzy on purpose.
function containment(seg, bg) {
  const a = bigrams(seg.text);
  if (a.size < 2) return 0;
  let hit = 0;
  for (const x of a) if (bg.has(x)) hit++;
  return hit / a.size;
}
// Short segments ("Saya.", "Nitu?") share letters with almost any line, so they count for little.
const segScore = (seg, line) => containment(seg, line.bg) * Math.min(1, bigrams(seg.text).size / 6);

// A line's opening word (two words when the first is shorter than 4 letters), as letter pairs.
const opening = (t) => {
  const w = t.split(/\s+/).map(fold).filter(Boolean);
  return bigrams(w[0]?.length >= 4 ? w[0] : w.slice(0, 2).join(''));
};
// Does this segment begin with the line's opening word? Compares against the segment's first
// letters only, so a later word of the line ("Cuma" in "Sepi. Cuma ...") never counts.
function startsLike(seg, head) {
  if (head.size < 2) return false;
  const start = bigrams(fold(seg.text).slice(0, 10));
  let hit = 0;
  for (const x of head) if (start.has(x)) hit++;
  return hit / head.size >= 0.6;
}

// Assign whisper segments to lines in order (each segment to one line or skipped).
export function anchorLines(lines, segs) {
  const L = lines.length, S = segs.length, NEG = -1e9;
  const ln = lines.map((t) => ({ t, bg: bigrams(t), head: opening(t) }));
  // best[j][i]: best total using segments < j with the last assigned line <= i
  const best = Array.from({ length: S + 1 }, () => new Array(L).fill(NEG));
  const from = Array.from({ length: S + 1 }, () => new Array(L).fill(null));
  best[0].fill(0);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < L; i++) {
      // skip segment j
      if (best[j][i] > best[j + 1][i]) { best[j + 1][i] = best[j][i]; from[j + 1][i] = { i, take: false }; }
      // assign segment j to line i (previous assignments to lines <= i)
      const sc = segScore(segs[j], ln[i]) - 0.15;
      if (sc > 0 && best[j][i] + sc > best[j + 1][i]) { best[j + 1][i] = best[j][i] + sc; from[j + 1][i] = { i, take: true }; }
    }
    for (let i = 1; i < L; i++) if (best[j + 1][i - 1] > best[j + 1][i]) { best[j + 1][i] = best[j + 1][i - 1]; from[j + 1][i] = { i: i - 1, carry: true }; }
  }
  const assigned = Array.from({ length: L }, () => []);
  let j = S, i = L - 1;
  while (j > 0) {
    const f = from[j][i];
    if (!f) break;
    if (f.carry) { i = f.i; continue; }
    if (f.take) assigned[i].unshift(segs[j - 1]);
    j--;
  }
  // head: when the line starts (a segment beginning with its opening word; short ones like
  // "Satu!" count). inside: times the line is clearly being spoken, used only as limits.
  return assigned.map((list, k) => {
    const head = list.find((s) => startsLike(s, ln[k].head));
    const inside = list.filter((s) => s === head || (bigrams(s.text).size >= 5 && containment(s, ln[k].bg) >= 0.6)).map((s) => s.start);
    return { head: head ? head.start : null, inside };
  });
}

// Pick one silence gap between each pair of consecutive lines, in order. A line start is pulled
// toward its head anchor and may not come after a time the line is known to be spoken, nor end
// before one; otherwise line lengths follow text length.
export function pickBoundaries(lines, anchors, gaps, t0, t1) {
  anchors = anchors.map((a) => a ?? { head: null, inside: [] });
  const L = lines.length, G = gaps.length;
  if (L < 2) return [];
  if (G < L - 1) return null;
  const chars = lines.map((l) => fold(l).length + 3), C = chars.reduce((a, b) => a + b, 0);
  const speech = (t1 - t0) - gaps.reduce((x, g) => x + g.len, 0);
  const talk = (a, b) => (b - a) - gaps.filter((g) => g.a >= a && g.b <= b).reduce((x, g) => x + g.len, 0);
  const lenCost = (i, a, b) => { const e = speech * chars[i] / C; return 0.3 * ((talk(a, b) - e) / Math.max(1, e)) ** 2; };
  const SLACK = 0.9, BREAK = 25;
  // Gap g ends line i and starts line i+1.
  const edge = (i, g) => {
    const next = anchors[i + 1], cur = anchors[i];
    // Whisper stamps the start of its listening window, which is at or a little before the
    // word, so a start up to ~0.6 s after the stamp is free and one before it is costly.
    const h = next.head;
    let c = h == null ? 0 : g.b < h - 0.3 ? 4 * Math.min(4, h - g.b) ** 2 : Math.max(0, g.b - h - 0.6) ** 2;
    if (next.inside.some((s) => g.b > s + SLACK)) c += BREAK;
    if (cur.inside.some((s) => g.a < s - SLACK)) c += BREAK;
    return c - 0.1 * Math.min(g.len, 2);
  };
  const INF = 1e18;
  const cost = Array.from({ length: L - 1 }, () => new Array(G).fill(INF));
  const prev = Array.from({ length: L - 1 }, () => new Array(G).fill(-1));
  for (let k = 0; k < G; k++) cost[0][k] = lenCost(0, t0, gaps[k].a) + edge(0, gaps[k]);
  for (let i = 1; i < L - 1; i++) {
    for (let k = i; k < G; k++) {
      for (let p = i - 1; p < k; p++) {
        if (cost[i - 1][p] >= INF) continue;
        const c = cost[i - 1][p] + lenCost(i, gaps[p].b, gaps[k].a) + edge(i, gaps[k]);
        if (c < cost[i][k]) { cost[i][k] = c; prev[i][k] = p; }
      }
    }
  }
  let end = -1, bestC = INF;
  for (let k = L - 2; k < G; k++) {
    const c = cost[L - 2][k] + lenCost(L - 1, gaps[k].b, t1);
    if (c < bestC) { bestC = c; end = k; }
  }
  const picked = new Array(L - 1);
  for (let i = L - 2, k = end; i >= 0; i--) { picked[i] = gaps[k]; k = prev[i][k]; }
  return picked;
}

function filterPath(p) {
  // Inside an ffmpeg filter graph ':' separates options and '\' escapes; both need escaping twice.
  return p.replace(/\\/g, '/').replace(/:/g, '\\\\:');
}

function whisperSegments(wavPath, model, lang) {
  const out = join(tmpdir(), `vo-whisper-${process.pid}.json`);
  rmSync(out, { force: true });
  const af = `aresample=16000,whisper=model=${filterPath(model)}:language=${lang}:queue=1:destination=${filterPath(out)}:format=json`;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wavPath, '-af', af, '-f', 'null', '-'], { encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(out)) throw new Error(r.stderr || 'whisper tidak menghasilkan output');
  const segs = readFileSync(out, 'utf8').split(/\r?\n/).map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((s) => s && typeof s.text === 'string' && !/^\s*[[*(]/.test(s.text))
    .map((s) => ({ start: s.start / 1000, end: s.end / 1000, text: s.text.trim() }));
  rmSync(out, { force: true });
  return segs;
}

function hasWhisperFilter() {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' });
  return r.status === 0 && /\swhisper\s/.test(r.stdout);
}

async function align(opts) {
  const [, input, take] = opts._;
  if (!input || !take) die('pakai: node tts.mjs align <naskah.md> <take.wav|mp3|m4a> [--out x.vo.wav] [--whisper-model ggml-base.bin] [--lang id]');
  if (!existsSync(input)) die(`file tidak ada: ${input}`);
  if (!existsSync(take)) die(`file tidak ada: ${take}`);
  if (!hasFfmpeg()) die('ffmpeg tidak ditemukan; align butuh ffmpeg');
  const out = resolve(opts.out || join(dirname(take), basename(input, extname(input)) + '.vo.wav'));
  if (resolve(take) === out) die('--out tidak boleh sama dengan file take; take asli tidak ditimpa');

  const lines = parseLines(readScript(readFileSync(input, 'utf8')).script).filter((it) => it.display).map((it) => it.display);
  if (!lines.length) die('tidak ada teks yang bisa dibacakan di naskah');

  // Same cleanup as stitch: edge silence trimmed, loudness normalized; small lead-in and tail.
  const pcm = Buffer.concat([silencePcm(0.2), decodeTrimmed(take), silencePcm(0.5)]);
  const { gaps, t0, t1 } = findGaps(pcm);

  const model = resolve(opts['whisper-model'] || process.env.WHISPER_MODEL || DEFAULT_WHISPER_MODEL);
  let anchors = new Array(lines.length).fill(null), how = 'tanpa whisper (perkiraan dari panjang teks dan jeda)';
  if (!hasWhisperFilter()) console.warn('  peringatan: ffmpeg ini tidak punya filter whisper; subtitle hanya perkiraan');
  else if (!existsSync(model)) console.warn(`  peringatan: model whisper tidak ada di ${model}; subtitle hanya perkiraan`);
  else {
    const tmp = join(tmpdir(), `vo-align-${process.pid}.wav`);
    writeFileSync(tmp, pcmToWav(pcm));
    try {
      const segs = whisperSegments(tmp, model, opts.lang || 'id');
      anchors = anchorLines(lines, segs);
      how = `whisper (${basename(model)}), ${anchors.filter((a) => a.head != null).length}/${lines.length} awal baris terkunci, ${anchors.filter((a) => a.head == null && a.inside.length).length} dibatasi`;
    } catch (e) {
      console.warn(`  peringatan: whisper gagal, subtitle hanya perkiraan — ${e.message.split('\n')[0]}`);
    } finally {
      rmSync(tmp, { force: true });
    }
  }

  const bounds = pickBoundaries(lines, anchors, gaps, t0, t1);
  if (!bounds) die(`audio hanya punya ${gaps.length} jeda untuk ${lines.length} baris; apakah take ini cocok dengan naskahnya?`);
  const cues = lines.flatMap((l, i) => timeLines([l], i ? bounds[i - 1].b : t0, i < lines.length - 1 ? bounds[i].a : t1));
  // Keep each cue up a little longer (until the next starts, max +0.8 s) so short lines stay readable.
  cues.forEach((c, i) => { c.end = Math.min(cues[i + 1]?.start ?? c.end + 0.8, c.end + 0.8); });

  mkdirSync(dirname(out), { recursive: true });
  if (extname(out).toLowerCase() === '.wav') writeFileSync(out, pcmToWav(pcm));
  else {
    const tmp = join(tmpdir(), `vo-align-out-${process.pid}.wav`);
    writeFileSync(tmp, pcmToWav(pcm));
    ffmpeg(['-i', tmp, ...(extname(out).toLowerCase() === '.mp3' ? ['-codec:a', 'libmp3lame', '-q:a', '2'] : []), out]);
    rmSync(tmp, { force: true });
  }
  const srt = out.slice(0, out.length - extname(out).length) + '.srt';
  writeFileSync(srt, toSrt(cues));
  console.log(`Timing: ${how}`);
  lines.forEach((l, i) => {
    const a = i ? bounds[i - 1].b : t0, b = i < lines.length - 1 ? bounds[i].a : t1;
    console.log(`  ${a.toFixed(2).padStart(6)}–${b.toFixed(2).padStart(6)}  ${l}`);
  });
  console.log(`\nSelesai: ${out} (${(pcm.length / 2 / SAMPLE_RATE).toFixed(1)} dtk)`);
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

// realpath both sides: the skill is often installed as a symlink, and argv[1] keeps the
// link path while import.meta.url points at the real file.
const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  const opts = parseArgs(process.argv.slice(2));
  const run = { clone, prep, stitch, align, voices, cast }[opts._[0]] ?? generate;
  run(opts).catch((e) => die(e.message));
}
