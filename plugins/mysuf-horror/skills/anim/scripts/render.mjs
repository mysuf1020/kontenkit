#!/usr/bin/env node
// Render a horror-anim story file to a 9:16 MP4 (or preview stills).
//
//   node render.mjs <story.js> [--out video.mp4] [--draft] [--stills 1.5,8,20]
//                   [--voice narasi.mp3] [--music musik.mp3] [--no-audio]
//                   [--subs narasi.srt] [--no-subs] [--keep-captions]
//
// With --voice, a .srt of the same name next to the audio (written by the voice skill)
// is burned in as subtitles automatically; scene captions are then hidden unless
// --keep-captions is given.
//
// Needs: Node 18+, ffmpeg on PATH, and Chrome/Chromium/Edge (or CHROME_PATH).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.join(HERE, '..', 'engine', 'engine.js');

function parseArgs(argv) {
  const a = { story: null, out: null, draft: false, stills: null, voice: null, music: null, audio: true, subs: null, noSubs: false, keepCaptions: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--out') a.out = argv[++i];
    else if (v === '--subs') a.subs = argv[++i];
    else if (v === '--no-subs') a.noSubs = true;
    else if (v === '--keep-captions') a.keepCaptions = true;
    else if (v === '--draft') a.draft = true;
    else if (v === '--stills') a.stills = argv[++i].split(',').map(Number).filter((n) => !Number.isNaN(n));
    else if (v === '--voice') a.voice = argv[++i];
    else if (v === '--music') a.music = argv[++i];
    else if (v === '--no-audio') a.audio = false;
    else if (!v.startsWith('--') && !a.story) a.story = v;
    else throw new Error('Unknown argument: ' + v);
  }
  if (!a.story) throw new Error('Usage: node render.mjs <story.js> [--out file.mp4] [--draft] [--stills 1,5] [--voice f] [--music f] [--no-audio] [--subs f.srt] [--no-subs] [--keep-captions]');
  return a;
}

export function parseSrt(text) {
  const t = (s) => { const [h, m, rest] = s.trim().replace('.', ',').split(':'); const [sec, ms] = rest.split(','); return +h * 3600 + +m * 60 + +sec + +(ms || 0) / 1000; };
  return text.replace(/\r/g, '').split(/\n\s*\n/).map((block) => {
    const lines = block.trim().split('\n');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) return null;
    const [a, b] = lines[i].split('-->');
    const txt = lines.slice(i + 1).join(' ').replace(/<[^>]*>/g, '').trim();
    return txt ? { start: t(a), end: t(b), text: txt } : null;
  }).filter(Boolean);
}

function resolveSubs(opts) {
  if (opts.noSubs) return null;
  if (opts.subs) {
    if (!fs.existsSync(opts.subs)) throw new Error('Subtitle file not found: ' + opts.subs);
    return opts.subs;
  }
  if (opts.voice) {
    const guess = opts.voice.replace(/\.[^./\\]+$/, '') + '.srt';
    if (fs.existsSync(guess)) return guess;
  }
  return null;
}

function findChrome() {
  const env = process.env.CHROME_PATH;
  const candidates = [
    env,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const hit = candidates.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('Chrome/Edge not found. Set CHROME_PATH to a Chromium-based browser executable.');
  return hit;
}

function loadStory(file, draft) {
  const code = fs.readFileSync(file, 'utf8');
  const win = {};
  new Function('window', code)(win);
  if (!win.STORY) throw new Error(file + ' must assign window.STORY = {...}');
  const S = win.STORY;
  if (draft) { S.width = 540; S.height = 960; S.fps = 24; }
  return S;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'pipe'], ...opts });
    let err = '';
    p.stderr.on('data', (d) => { err += d; if (err.length > 20000) err = err.slice(-20000); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(cmd + ' exited ' + code + '\n' + err.slice(-3000)))));
    if (opts.onSpawn) opts.onSpawn(p);
  });
}

// ---- audio: synthesized ambience + cues timed from the story ----
const SFX = {
  hit: { d: 1.6, src: ["aevalsrc='0.9*sin(2*PI*(70*t-12*t*t))*exp(-2.5*t)':s=44100:d=1.6", 'anoisesrc=color=white:amplitude=0.45:d=0.6,highpass=f=900,afade=t=out:st=0:d=0.6'] },
  sting: { d: 2.5, src: ["aevalsrc='0.22*(sin(2*PI*1180*t)+sin(2*PI*1243*t)+sin(2*PI*1667*t))*(1-exp(-12*t))*exp(-1.2*t)':s=44100:d=2.5"] },
  thunder: { d: 3, src: ['anoisesrc=color=brown:amplitude=0.95:d=3,lowpass=f=180,afade=t=in:d=0.05,afade=t=out:st=0.3:d=2.7'] },
  knock: { d: 1.2, src: ["aevalsrc='0.9*sin(2*PI*90*t)*(exp(-40*t)+exp(-40*(t-0.35))*gte(t,0.35)+exp(-40*(t-0.7))*gte(t,0.7))':s=44100:d=1.2"] },
  whisper: { d: 2.5, src: ['anoisesrc=color=pink:amplitude=0.3:d=2.5,bandpass=f=2500:width_type=h:w=1500,tremolo=f=7:d=0.8,afade=t=in:d=0.5,afade=t=out:st=1.5:d=1'] },
  creak: { d: 1.8, src: ["aevalsrc='0.35*sin(2*PI*(180*t+40*sin(2*PI*3*t)))*sin(2*PI*23*t)*(1-exp(-8*t))*exp(-1.5*t)':s=44100:d=1.8"] },
};
const heartbeat = (d) => `aevalsrc='0.9*sin(2*PI*48*t)*(exp(-25*mod(t,0.85))+0.7*exp(-25*mod(t+0.63,0.85)))':s=44100:d=${d.toFixed(3)}`;

function audioCues(S) {
  const cues = [];
  let t0 = 0;
  for (const sc of S.scenes) {
    if (sc.scare) cues.push({ type: 'hit', at: t0 + sc.scare.at });
    for (const at of sc.lightning || []) cues.push({ type: 'thunder', at: t0 + at + 0.15 });
    if ((sc.fx || []).includes('heartbeat')) cues.push({ type: 'heartbeat', at: t0, dur: sc.dur });
    for (const s of sc.sfx || []) {
      if (s.type !== 'heartbeat' && !SFX[s.type]) throw new Error('Unknown sfx type "' + s.type + '". Use: ' + Object.keys(SFX).join(', ') + ', heartbeat');
      cues.push({ type: s.type, at: t0 + (s.at || 0), dur: s.dur || 3 });
    }
    t0 += sc.dur;
  }
  return cues;
}

async function mux(video, out, S, total, opts) {
  const args = ['-y', '-i', video];
  const parts = [];
  let n = 1;
  const add = (src, delayMs, vol) => {
    args.push('-f', 'lavfi', '-i', src);
    parts.push(`[${n}:a]aformat=channel_layouts=stereo:sample_rates=44100,adelay=${Math.max(0, Math.round(delayMs))}:all=1,volume=${vol}[a${n}]`);
    n++;
  };
  const droneVol = opts.voice ? 0.55 : 1;
  add(`aevalsrc='0.16*sin(2*PI*55*t)*(0.65+0.35*sin(2*PI*0.11*t))+0.10*sin(2*PI*58.27*t)+0.05*sin(2*PI*110.9*t)*(0.5+0.5*sin(2*PI*0.05*t))':s=44100:d=${total.toFixed(3)}`, 0, droneVol);
  add(`anoisesrc=color=brown:amplitude=0.07:d=${total.toFixed(3)},lowpass=f=300`, 0, droneVol);
  for (const c of audioCues(S)) {
    if (c.type === 'heartbeat') add(heartbeat(c.dur), c.at * 1000, 0.9);
    else for (const src of SFX[c.type].src) add(src, c.at * 1000, c.type === 'hit' ? 1 : 0.8);
  }
  for (const [file, vol] of [[opts.music, 0.35], [opts.voice, 1.6]]) {
    if (!file) continue;
    if (!fs.existsSync(file)) throw new Error('Audio file not found: ' + file);
    args.push('-i', file);
    parts.push(`[${n}:a]aformat=channel_layouts=stereo:sample_rates=44100,volume=${vol}[a${n}]`);
    n++;
  }
  const labels = Array.from({ length: n - 1 }, (_, i) => `[a${i + 1}]`).join('');
  const fadeSt = Math.max(0, total - 1.2).toFixed(3);
  parts.push(`${labels}amix=inputs=${n - 1}:normalize=0:duration=first,alimiter=limit=0.8,afade=t=out:st=${fadeSt}:d=1.2[aout]`);
  args.push('-filter_complex', parts.join(';'), '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', total.toFixed(3), '-movflags', '+faststart', out);
  await run('ffmpeg', args);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const storyPath = path.resolve(opts.story);
  const S = loadStory(storyPath, opts.draft);
  const base = storyPath.replace(/\.js$/i, '');
  const out = path.resolve(opts.out || base + (opts.draft ? '_draft' : '') + '.mp4');
  const subsFile = resolveSubs(opts);
  if (subsFile) {
    S.subs = parseSrt(fs.readFileSync(subsFile, 'utf8'));
    if (!opts.keepCaptions) S.hideCaptions = true;
    console.log(`Subtitles: ${subsFile} (${S.subs.length} cues${S.hideCaptions ? ', scene captions hidden' : ''})`);
  }

  const engine = fs.readFileSync(ENGINE, 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#000">
<canvas id="c"></canvas><script>window.STORY=${JSON.stringify(S)};</script><script>${engine}</script></body></html>`;

  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-first-run', '--disable-extensions'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    if (errors.length) throw new Error('Engine error: ' + errors.join('\n'));
    const info = await page.evaluate(() => window.__info);
    console.log(`Story: ${S.scenes.length} scenes, ${info.TOTAL.toFixed(1)}s, ${info.W}x${info.H} @ ${info.FPS}fps (${info.frames} frames)`);
    const lastSub = S.subs && S.subs.length ? S.subs[S.subs.length - 1].end : 0;
    if (lastSub > info.TOTAL) console.warn(`WARNING: narration/subtitles run to ${lastSub.toFixed(1)}s but the story is ${info.TOTAL.toFixed(1)}s — lengthen scene durations or the ending gets cut.`);

    if (opts.stills) {
      for (const sec of opts.stills) {
        const f = Math.min(info.frames - 1, Math.max(0, Math.round(sec * info.FPS)));
        const url = await page.evaluate((fr) => window.__frame(fr, 'png'), f);
        const file = `${base}_still_${String(sec).replace('.', '_')}s.png`;
        fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
        console.log('still', file);
      }
      if (errors.length) throw new Error('Engine error: ' + errors.join('\n'));
      return;
    }

    const tmpVideo = out.replace(/\.mp4$/i, '') + '.video-only.mp4';
    let ff;
    const ffDone = run('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(info.FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', opts.draft ? 'veryfast' : 'medium', '-crf', opts.draft ? '30' : '20', tmpVideo],
    { onSpawn: (p) => { ff = p; } });
    const started = Date.now();
    let lastPct = -1;
    for (let f = 0; f < info.frames; f++) {
      const url = await page.evaluate((fr) => window.__frame(fr), f);
      if (errors.length) throw new Error('Engine error at frame ' + f + ': ' + errors.join('\n'));
      const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      const pct = Math.floor((f / info.frames) * 20) * 5;
      if (pct !== lastPct) { lastPct = pct; console.log(`render ${pct}%  (${((Date.now() - started) / 1000).toFixed(0)}s)`); }
    }
    ff.stdin.end();
    await ffDone;

    if (opts.audio) {
      await mux(tmpVideo, out, S, info.TOTAL, opts);
      fs.unlinkSync(tmpVideo);
    } else {
      fs.renameSync(tmpVideo, out);
    }
    console.log(`done ${out}  (${((Date.now() - started) / 1000).toFixed(0)}s)`);
  } finally {
    await browser.close();
  }
}

// realpath both sides: the skill is often installed as a symlink, and argv[1] keeps the
// link path while import.meta.url points at the real file.
const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) main().catch((e) => { console.error(e.message || e); process.exit(1); });
