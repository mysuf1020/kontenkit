#!/usr/bin/env node
// Cut a green-screen character image into puppet parts for the anim engine.
//
//   node puppet-cut.mjs <spec.json> --out <puppets-dir>   write <puppets-dir>/<name>/rig.json + part PNGs
//   node puppet-cut.mjs <image> --grid [--step 50]        write <image>.grid.png with a labelled pixel grid
//                                                         (to read off polygon/pivot coordinates)
//
// spec.json (paths relative to the spec file, coordinates in source-image pixels):
// {
//   "name": "mbah-karto", "ghost": false,
//   "image": "mbah-karto-badan.png",
//   "foot": [x, y],                       // ground point between the feet
//   "parts": {                            // every pixel not claimed by a part becomes "torso"
//     "head": { "poly": [[x,y],...], "pivot": [x,y], "z": 5, "joint": 0 },
//     "armF": { "poly": [...], "pivot": [x,y], "z": 6, "joint": 28 },   // joint: radius kept on the torso
//     "foreF": { "poly": [...], "pivot": [x,y], "parent": "armF", "z": 7, "cap": 30 },  // cap: disc of the parent kept round the joint
//     // "keep": px at the bottom of the polygon that also stay on the torso (neck under a swapped face)
//     ...                                  // "rest": radians added to the pose (e.g. bring A-pose arms down)
//   },
//   "torsoZ": 3,
//   "body": [x, y, w, h],                 // optional: only this area holds the full body
//   "faces": { "image": "mbah-karto-ekspresi.png",   // optional, defaults to "image" (one sheet)
//              "rect": [x, y, w, h],     // optional: area holding the expression heads
//              "ref": "neutral" },       // the head used to fit the scale; "faces" may also be a list of sheets
//   "anims": { "walk": { "image": "01-jalan.png", "count": 6, "fps": 10 },          // one row of whole-body frames
//              "pose": { "image": "03-pose.png", "count": 6, "names": ["point", ...] } },  // named still poses
//              "order": ["neutral","blink","talk","scared","shout","laugh"] }   // heads found left-to-right, top-to-bottom
// }
// Parts default to parent "torso". The pivot is the joint the part rotates around.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';


function findChrome() {
  const c = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  const hit = c.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('Chrome/Edge not found. Set CHROME_PATH.');
  return hit;
}
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
function dataUrl(p) {
  const m = MIME[path.extname(p).toLowerCase()];
  if (!m) throw new Error('Unsupported image: ' + p);
  return `data:${m};base64,${fs.readFileSync(p).toString('base64')}`;
}
const save = (file, url) => fs.writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));

// Runs inside the page. Everything image-related happens on canvases.
const PAGE_LIB = `
window.loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
window.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// Green-screen key with a soft edge and spill removal.
window.keyGreen = (img) => {
  const c = canvas(img.width, img.height), x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  const lo = 18, hi = 70;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2], m = Math.max(r, b), e = g - m;
    if (e <= 0) continue;
    if (e >= hi) { p[i + 3] = 0; continue; }
    if (e > lo) p[i + 3] = Math.round(p[i + 3] * (hi - e) / (hi - lo));
    p[i + 1] = m;                                  // despill
  }
  x.putImageData(d, 0, 0);
  return c;
};
window.polyPath =(x, poly) => { x.beginPath(); poly.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); };
window.alphaBox = (c) => {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
};
window.cropOut = (c, pad = 2) => {
  const b = alphaBox(c);
  if (!b) return null;
  const x0 = Math.max(0, b[0] - pad), y0 = Math.max(0, b[1] - pad);
  const w = Math.min(c.width - x0, b[2] + pad * 2), h = Math.min(c.height - y0, b[3] + pad * 2);
  const o = canvas(w, h); o.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
  return { url: o.toDataURL('image/png'), off: [x0, y0], box: b };
};
// Connected blobs of opaque pixels (on a 1/4 grid), biggest first trimmed to n, then sorted in reading order.
window.blobs = (c, n) => {
  const s = 4, w = Math.ceil(c.width / s), h = Math.ceil(c.height / s);
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const on = new Uint8Array(w * h), lab = new Int32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) on[y * w + x] = d[((y * s) * c.width + x * s) * 4 + 3] > 40 ? 1 : 0;
  const out = []; let id = 0;
  for (let i = 0; i < w * h; i++) {
    if (!on[i] || lab[i]) continue;
    id++; const st = [i]; lab[i] = id; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, cnt = 0;
    while (st.length) {
      const j = st.pop(), x = j % w, y = (j - x) / w; cnt++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const k of [j - 1, j + 1, j - w, j + w]) {
        if (k < 0 || k >= w * h || lab[k] || !on[k]) continue;
        if ((k === j - 1 && x === 0) || (k === j + 1 && x === w - 1)) continue;
        lab[k] = id; st.push(k);
      }
    }
    out.push({ cnt, id, box: [x0 * s, y0 * s, (x1 - x0 + 1) * s, (y1 - y0 + 1) * s] });
  }
  // each box carries a mask of just its own blob, so a crop never picks up a neighbour's limb
  const big = out.sort((a, b) => b.cnt - a.cnt).slice(0, n).map((o) => {
    const m = canvas(w, h), mx = m.getContext('2d'), md = mx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      if (lab[i] !== o.id) continue;
      const x = i % w, y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        md.data[(yy * w + xx) * 4 + 3] = 255;
      }
    }
    mx.putImageData(md, 0, 0);
    const box = o.box; box.mask = m; box.s = s;
    return box;
  });
  const rowH = Math.max(...big.map((b) => b[3])) * 0.5;
  return big.sort((a, b) => (Math.abs(a[1] - b[1]) > rowH ? a[1] - b[1] : a[0] - b[0]));
};
`;

async function cut(specFile, outDir) {
  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  const dir = path.dirname(specFile);
  const dest = path.join(outDir, spec.name);
  fs.mkdirSync(dest, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: PAGE_LIB });
    const res = await page.evaluate(async (spec, baseUrl, faceUrls, animUrls) => {
      const img = await loadImg(baseUrl);
      // `body` / `faces.rect` limit each step to its own area when body and heads share one sheet
      const only = (src, r) => { if (!r) return src; const c = canvas(src.width, src.height); c.getContext('2d').drawImage(src, r[0], r[1], r[2], r[3], r[0], r[1], r[2], r[3]); return c; };
      const keyed = only(keyGreen(img), spec.body);
      const W = keyed.width, H = keyed.height;
      const out = { parts: {}, faces: {} };
      const names = Object.keys(spec.parts);
      // torso = everything not claimed by a part, plus a disc of each part around its joint
      const t = canvas(W, H), tx = t.getContext('2d');
      tx.drawImage(keyed, 0, 0);
      tx.globalCompositeOperation = 'destination-out';
      for (const n of names) { polyPath(tx, spec.parts[n].poly); tx.fill(); }
      tx.globalCompositeOperation = 'source-over';
      for (const n of names) {
        const P = spec.parts[n];
        if (!P.joint) continue;
        tx.save(); polyPath(tx, P.poly); tx.clip();
        tx.beginPath(); tx.arc(P.pivot[0], P.pivot[1], P.joint, 0, 7); tx.clip();
        tx.drawImage(keyed, 0, 0); tx.restore();
      }
      // keep: the torso also keeps the bottom `keep` px of the part's polygon, so when a swapped
      // face is narrower than the base head (or fades out at the neck) the body's own neck and
      // collar show underneath instead of a hole
      for (const n of names) {
        const P = spec.parts[n];
        if (!P.keep) continue;
        const yMax = Math.max(...P.poly.map((p) => p[1]));
        tx.save(); polyPath(tx, P.poly); tx.clip();
        tx.beginPath(); tx.rect(0, yMax - P.keep, W, P.keep); tx.clip();
        tx.drawImage(keyed, 0, 0); tx.restore();
      }
      out.parts.torso = cropOut(t);
      for (const n of names) {
        const c = canvas(W, H), x = c.getContext('2d');
        const P = spec.parts[n];
        x.save(); polyPath(x, P.poly); x.clip(); x.drawImage(keyed, 0, 0); x.restore();
        // cap: also take a disc of the parent's pixels around the joint, so a bent elbow/knee stays round
        const par = P.parent && spec.parts[P.parent];
        if (P.cap && par) {
          x.save(); x.beginPath(); x.arc(P.pivot[0], P.pivot[1], P.cap, 0, 7); x.clip();
          polyPath(x, par.poly); x.clip(); x.drawImage(keyed, 0, 0); x.restore();
        }
        out.parts[n] = cropOut(c);
      }
      // expression heads: found as blobs on the sheet, scaled so the neutral head matches the
      // body's head width, then aligned on the top of the head and its horizontal center
      const faceSpecs = [].concat(spec.faces || []);
      for (let fi = 0; fi < faceSpecs.length && spec.parts.head; fi++) {
        const fs_ = faceSpecs[fi];
        const sheet = only(keyGreen(await loadImg(faceUrls[fi])), fs_.rect);
        const order = fs_.order;
        const boxes = blobs(sheet, order.length);
        if (boxes.length < order.length) throw new Error('found ' + boxes.length + ' heads on the sheet, expected ' + order.length);
        // fit on the top half of each head (hair + face) so shoulders drawn on the sheet don't skew the scale
        const band = (src, b, frac) => {
          const c = canvas(b[2], Math.max(1, Math.round(b[3] * frac)));
          c.getContext('2d').drawImage(src, b[0], b[1], b[2], c.height, 0, 0, b[2], c.height);
          const a = alphaBox(c) || [0, 0, b[2], c.height];
          return [b[0] + a[0], b[1] + a[1], a[2], a[3]];
        };
        const hb0 = out.parts.head.box;
        const hb = band(keyed, hb0, 0.5);
        const headPoly = spec.parts.head.poly, neckY = Math.max(...headPoly.map((p) => p[1]));
        const ref = boxes[Math.max(0, order.indexOf(fs_.ref || 'neutral'))];
        const rb = band(sheet, ref, 0.5);
        const k = (fs_.scale || 1) * hb[2] / rb[2];
        order.forEach((name, i) => {
          const b = boxes[i], bb = band(sheet, b, 0.5);
          const c = canvas(W, H), x = c.getContext('2d');
          x.beginPath(); x.rect(0, 0, W, neckY); x.clip();
          const dx = hb[0] + hb[2] / 2 - (bb[0] + bb[2] / 2) * k + (fs_.dx || 0);
          const dy = hb[1] - bb[1] * k + (fs_.dy || 0);
          x.setTransform(k, 0, 0, k, dx, dy);
          x.drawImage(sheet, b[0], b[1], b[2], b[3], b[0], b[1], b[2], b[3]);
          // fade the neck out over the last few px so it melts into the body's own neck
          const fz = fs_.feather ?? 18;
          if (fz) {
            x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'destination-out';
            const g = x.createLinearGradient(0, neckY - fz, 0, neckY);
            g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
            x.fillStyle = g; x.fillRect(0, neckY - fz, W, fz);
            x.globalCompositeOperation = 'source-over';
          }
          out.faces[name] = cropOut(c);
        });
      }
      // sprite sheets: one row of whole-body frames. Each frame is anchored on the sheet's common
      // baseline (lowest foot) and on the horizontal center of its upper body, so the figure
      // doesn't wobble sideways when the legs change.
      out.anims = {};
      const animNames = Object.keys(spec.anims || {});
      for (let ai = 0; ai < animNames.length; ai++) {
        const A = spec.anims[animNames[ai]];
        const sheet = only(keyGreen(await loadImg(animUrls[ai])), A.rect);
        const boxes = blobs(sheet, A.count);
        if (boxes.length < A.count) throw new Error(animNames[ai] + ': found ' + boxes.length + ' frames, expected ' + A.count);
        boxes.sort((a, b) => a[0] - b[0]);
        const base = Math.max(...boxes.map((b) => b[1] + b[3]));
        out.anims[animNames[ai]] = boxes.map((b) => {
          const c = canvas(b[2] + 8, b[3] + 8), x = c.getContext('2d');
          x.drawImage(sheet, b[0] - 4, b[1] - 4, b[2] + 8, b[3] + 8, 0, 0, b[2] + 8, b[3] + 8);
          x.globalCompositeOperation = 'destination-in'; x.imageSmoothingEnabled = false;
          x.drawImage(b.mask, -(b[0] - 4), -(b[1] - 4), b.mask.width * b.s, b.mask.height * b.s);
          x.globalCompositeOperation = 'source-over';
          const top = canvas(b[2] + 8, Math.round(b[3] * 0.35)); top.getContext('2d').drawImage(c, 0, 0);
          const tb = alphaBox(top) || [0, 0, c.width, 0];
          const cx = b[0] - 4 + tb[0] + tb[2] / 2;
          return { url: c.toDataURL('image/png'), off: [b[0] - 4 - cx, b[1] - 4 - base], h: b[3], foot: base - (b[1] + b[3]) };
        });
      }
      // debug overlay: keyed figure on grey, part outlines and pivots
      const dbg = canvas(W, H), dx = dbg.getContext('2d');
      dx.fillStyle = '#777'; dx.fillRect(0, 0, W, H); dx.drawImage(keyed, 0, 0);
      dx.lineWidth = Math.max(2, W / 400);
      for (const n of names) {
        const P = spec.parts[n];
        dx.strokeStyle = '#ff00ff'; polyPath(dx, P.poly); dx.stroke();
        dx.fillStyle = '#00ffff'; dx.beginPath(); dx.arc(P.pivot[0], P.pivot[1], dx.lineWidth * 3, 0, 7); dx.fill();
        if (P.joint) { dx.strokeStyle = '#00ffff'; dx.beginPath(); dx.arc(P.pivot[0], P.pivot[1], P.joint, 0, 7); dx.stroke(); }
        dx.fillStyle = '#fff'; dx.font = (W / 40) + 'px sans-serif'; dx.fillText(n, P.pivot[0] + 8, P.pivot[1] - 8);
      }
      dx.fillStyle = '#ff0'; dx.beginPath(); dx.arc(spec.foot[0], spec.foot[1], dx.lineWidth * 4, 0, 7); dx.fill();
      out.debug = dbg.toDataURL('image/png');
      return out;
    }, spec, dataUrl(path.join(dir, spec.image)),
    [].concat(spec.faces || []).map((f) => dataUrl(path.join(dir, f.image || spec.image))),
    Object.values(spec.anims || {}).map((a) => dataUrl(path.join(dir, a.image))));

    // tall: height relative to a 1.0 adult man, so a cast stands at believable relative heights
    const rig = { heightPx: 0, foot: spec.foot, ghost: !!spec.ghost, tall: spec.tall || 1, head: 'head', parts: [], faces: {} };
    const top = Math.min(...Object.values(res.parts).filter(Boolean).map((p) => p.box[1]));
    rig.heightPx = spec.foot[1] - top;
    for (const [id, r] of Object.entries(res.parts)) {
      if (!r) { console.warn('part "' + id + '" is empty, skipped'); continue; }
      const P = spec.parts[id] || {};
      save(path.join(dest, id + '.png'), r.url);
      rig.parts.push({ id, src: id + '.png', off: r.off, pivot: P.pivot || spec.foot, parent: id === 'torso' ? null : (P.parent || 'torso'), z: id === 'torso' ? (spec.torsoZ ?? 3) : (P.z ?? 4), rest: P.rest || 0 });
    }
    for (const [name, r] of Object.entries(res.faces)) {
      if (!r) continue;
      save(path.join(dest, 'face-' + name + '.png'), r.url);
      rig.faces[name] = { src: 'face-' + name + '.png', off: r.off };
    }
    rig.anims = {};
    for (const [name, frames] of Object.entries(res.anims || {})) {
      const A = spec.anims[name];
      // scale: the engine sizes a sheet so its median frame is this fraction of the standing body,
      // the same rule for every character: a stride is a little shorter than standing, a running
      // lean shorter still, poses and other loops stand full height (explicit `scale` wins)
      const SHEET_HEIGHT = { walk: 0.97, run: 0.9 };
      rig.anims[name] = { fps: A.fps || 10, scale: A.scale || SHEET_HEIGHT[name] || 1, names: A.names, loop: A.loop !== false, frames: frames.map((fr, i) => {
        const file = 'anim-' + name + '-' + i + '.png';
        save(path.join(dest, file), fr.url);
        return { src: file, off: fr.off, h: fr.h, foot: fr.foot };
      }) };
    }
    fs.writeFileSync(path.join(dest, 'rig.json'), JSON.stringify(rig, null, 2));
    save(path.join(dest, '_debug.png'), res.debug);
    console.log(`puppet ${spec.name}: ${rig.parts.length} parts, ${Object.keys(rig.faces).length} faces, ${Object.keys(rig.anims).length} anims, height ${rig.heightPx}px -> ${dest}`);
    console.log('  anim scale: ' + Object.entries(rig.anims).map(([n, a]) => n + ' ' + a.scale).join(', '));
  } finally {
    await browser.close();
  }
}

async function grid(imgFile, step) {
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: PAGE_LIB });
    const url = await page.evaluate(async (src, step) => {
      const img = await loadImg(src);
      const c = canvas(img.width, img.height), x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      x.font = Math.max(12, step / 3) + 'px sans-serif';
      for (let v = 0; v <= Math.max(c.width, c.height); v += step) {
        const major = v % (step * 2) === 0;
        x.strokeStyle = major ? 'rgba(255,0,255,0.7)' : 'rgba(255,0,255,0.3)'; x.lineWidth = major ? 2 : 1;
        x.beginPath(); x.moveTo(v, 0); x.lineTo(v, c.height); x.moveTo(0, v); x.lineTo(c.width, v); x.stroke();
        if (major) { x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 3; x.strokeText(v, v + 3, 16); x.fillText(v, v + 3, 16); x.strokeText(v, 3, v - 3); x.fillText(v, 3, v - 3); }
      }
      return c.toDataURL('image/png');
    }, dataUrl(imgFile), step);
    const out = imgFile.replace(/\.[^.]+$/, '') + '.grid.png';
    save(out, url);
    console.log('grid', out);
  } finally {
    await browser.close();
  }
}

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--out' && argv[argv.indexOf(a) - 1] !== '--step');
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
if (!file) { console.error('Usage: node puppet-cut.mjs <spec.json> --out <dir> | <image> --grid [--step 50]'); process.exit(1); }
const job = argv.includes('--grid') ? grid(file, +(opt('--step') || 50)) : cut(file, opt('--out') || path.join(path.dirname(file), 'puppets'));
job.catch((e) => { console.error(e.message || e); process.exit(1); });
