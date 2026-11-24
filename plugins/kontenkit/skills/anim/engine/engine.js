/*
 * horror-anim engine — deterministic canvas renderer for 9:16 horror shorts.
 *
 * Everything is drawn from (time, frame) only, never from wall-clock or Math.random,
 * so the same story always renders the same frames. All drawing uses logical
 * 1080x1920 units; draft renders just scale the canvas down.
 *
 * Exposes:
 *   window.__info            {W, H, FPS, TOTAL, frames}
 *   window.__frame(f, fmt)   draws frame f, returns a data URL ('jpeg' default or 'png')
 */
(function () {
  'use strict';
  const S = window.STORY;
  if (!S || !Array.isArray(S.scenes) || !S.scenes.length) throw new Error('window.STORY.scenes is empty');

  const LW = 1080, LH = 1920, GY = 1350;           // logical size, ground line
  const W = S.width || 1080, H = S.height || 1920, FPS = S.fps || 30;
  const SC = W / LW;
  const ACC = S.accent || '#c4161c';

  const cv = document.getElementById('c');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // ---------- helpers ----------
  function rng(seed) {
    let s = seed | 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = (n) => rng(Math.floor(n) * 2654435761 + 1013904223)();
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  const X = (v) => (v == null ? 540 : v <= 1.5 ? v * LW : v);   // 0..1 fraction or logical px
  function off(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * SC); c.height = Math.ceil(h * SC);
    const x = c.getContext('2d'); x.scale(SC, SC);
    return { c, x };
  }

  const TONES = {
    blue:   { top: '#03060c', mid: '#0e1d33', hor: '#2a4366', rim: 'rgba(140,175,230,0.75)', fog: '190,205,230' },
    green:  { top: '#020604', mid: '#0b2018', hor: '#24503c', rim: 'rgba(150,215,175,0.7)',  fog: '170,210,185' },
    red:    { top: '#070102', mid: '#2a0708', hor: '#661616', rim: 'rgba(245,120,110,0.7)',  fog: '220,160,150' },
    purple: { top: '#050309', mid: '#1a1030', hor: '#422a62', rim: 'rgba(195,165,245,0.7)',  fog: '200,190,230' },
    amber:  { top: '#070402', mid: '#24160a', hor: '#5a3b1b', rim: 'rgba(255,195,125,0.7)',  fog: '230,200,160' },
  };

  // ---------- timeline ----------
  let acc = 0;
  const scenes = S.scenes.map((sc, i) => {
    const o = Object.assign({ fx: [] }, sc, { start: acc, i });
    if (!(o.dur > 0)) throw new Error('scene ' + i + ' needs dur > 0');
    acc += o.dur;
    return o;
  });
  const TOTAL = acc;
  function sceneAt(t) {
    for (let i = scenes.length - 1; i >= 0; i--) if (t >= scenes[i].start) return scenes[i];
    return scenes[0];
  }
  const has = (sc, name) => sc.fx.indexOf(name) !== -1;
  const toneOf = (sc) => TONES[sc.tone || S.tone || 'blue'] || TONES.blue;

  // ---------- backgrounds (static part cached per scene) ----------
  function sky(c, T, moon, r, horizon) {
    const g = c.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, T.top); g.addColorStop(0.6, T.mid); g.addColorStop(1, T.hor);
    c.fillStyle = g; c.fillRect(0, 0, LW, horizon + 2);
    c.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 70; i++) { const x = r() * LW, y = r() * horizon * 0.6; c.fillRect(x, y, 2, 2); }
    if (moon) {
      const mx = 790, my = 360;
      const gl = c.createRadialGradient(mx, my, 60, mx, my, 360);
      gl.addColorStop(0, 'rgba(235,230,210,0.35)'); gl.addColorStop(1, 'rgba(235,230,210,0)');
      c.fillStyle = gl; c.fillRect(0, 0, LW, horizon);
      c.fillStyle = '#ebe6d2'; c.beginPath(); c.arc(mx, my, 88, 0, 7); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.08)';
      for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(mx - 40 + r() * 80, my - 40 + r() * 80, 8 + r() * 16, 0, 7); c.fill(); }
    }
    // thin cloud wisps
    c.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 5; i++) {
      const y = 200 + r() * 500, x = r() * LW;
      c.beginPath(); c.ellipse(x, y, 260 + r() * 200, 18 + r() * 14, 0, 0, 7); c.fill();
    }
  }
  function ground(c, y) {
    const g = c.createLinearGradient(0, y, 0, LH);
    g.addColorStop(0, '#05070a'); g.addColorStop(1, '#000');
    c.fillStyle = g; c.fillRect(0, y, LW, LH - y);
  }
  function tree(c, r, x, y, len, ang, w, depth) {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
    if (depth <= 0) return;
    const n = 2 + (r() < 0.35 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = ang + (r() - 0.5) * 0.9 + (i - (n - 1) / 2) * 0.45;
      tree(c, r, x2, y2, len * (0.66 + r() * 0.14), a, Math.max(1.5, w * 0.66), depth - 1);
    }
  }

  const BG = {
    black(c) { c.fillStyle = '#000'; c.fillRect(0, 0, LW, LH); return {}; },

    forest(c, r, T, sc) {
      sky(c, T, sc.moon !== false, r, 1250);
      c.lineCap = 'round';
      c.strokeStyle = T.mid;
      for (let i = 0; i < 9; i++) tree(c, r, r() * LW, 1250, 170 + r() * 90, -Math.PI / 2 + (r() - 0.5) * 0.2, 16, 6);
      const mist = c.createLinearGradient(0, 1050, 0, 1300);
      mist.addColorStop(0, 'rgba(' + T.fog + ',0)'); mist.addColorStop(1, 'rgba(' + T.fog + ',0.12)');
      c.fillStyle = mist; c.fillRect(0, 1050, LW, 250);
      ground(c, 1250);
      c.strokeStyle = '#010203';
      const xs = [40, 230, 860, 1040];
      xs.forEach((x) => tree(c, r, x + (r() - 0.5) * 60, 1500, 330 + r() * 120, -Math.PI / 2 + (r() - 0.5) * 0.15, 46, 7));
      c.fillStyle = '#010203';
      for (let i = 0; i < 90; i++) { const x = r() * LW; c.beginPath(); c.moveTo(x - 8, 1400); c.lineTo(x, 1340 - r() * 40); c.lineTo(x + 8, 1400); c.fill(); }
      return {};
    },

    house(c, r, T, sc) {
      sky(c, T, sc.moon !== false, r, 1270);
      ground(c, 1270);
      c.lineCap = 'round'; c.strokeStyle = '#010203';
      tree(c, r, 130, 1320, 270, -Math.PI / 2 - 0.08, 32, 6);
      const k = '#020304';
      c.fillStyle = k;
      c.fillRect(300, 820, 480, 450);
      c.beginPath(); c.moveTo(255, 835); c.lineTo(540, 560); c.lineTo(825, 835); c.closePath(); c.fill();
      c.fillRect(660, 610, 50, 150);
      c.fillRect(380, 1070, 320, 18);
      const windows = [
        { x: 355, y: 880, w: 95, h: 125 }, { x: 630, y: 880, w: 95, h: 125 },
        { x: 355, y: 1100, w: 95, h: 125 }, { x: 505, y: 690, w: 70, h: 80 },
      ];
      windows.forEach((w) => {
        c.fillStyle = '#0a0d12'; c.fillRect(w.x, w.y, w.w, w.h);
        c.fillStyle = k; c.fillRect(w.x + w.w / 2 - 3, w.y, 6, w.h); c.fillRect(w.x, w.y + w.h / 2 - 3, w.w, 6);
      });
      c.fillStyle = '#000'; c.fillRect(500, 1110, 80, 160);
      c.fillStyle = '#010203';
      for (let x = 20; x < LW; x += 42) {
        c.beginPath(); c.moveTo(x, 1340); c.lineTo(x, 1265); c.lineTo(x + 9, 1245); c.lineTo(x + 18, 1265); c.lineTo(x + 18, 1340); c.fill();
      }
      c.fillRect(0, 1280, LW, 8); c.fillRect(0, 1315, LW, 8);
      return { windows };
    },

    graveyard(c, r, T, sc) {
      sky(c, T, sc.moon !== false, r, 1200);
      ground(c, 1200);
      c.fillStyle = '#030406';
      c.beginPath(); c.moveTo(0, 1220);
      for (let x = 0; x <= LW; x += 60) c.lineTo(x, 1200 + Math.sin(x * 0.01) * 18);
      c.lineTo(LW, LH); c.lineTo(0, LH); c.fill();
      // banyan: thick trunk, wide canopy, hanging aerial roots
      c.lineCap = 'round'; c.strokeStyle = '#010203';
      for (let i = 0; i < 5; i++) tree(c, r, 190 + (r() - 0.5) * 40, 1260, 300, -Math.PI / 2 + (i - 2) * 0.28, 70, 6);
      c.lineWidth = 2.5;
      for (let i = 0; i < 55; i++) {
        const x = 20 + r() * 440, y0 = 380 + r() * 300, y1 = 900 + r() * 330;
        c.beginPath(); c.moveTo(x, y0); c.quadraticCurveTo(x + (r() - 0.5) * 30, (y0 + y1) / 2, x + (r() - 0.5) * 20, y1); c.stroke();
      }
      const stones = [];
      for (let i = 0; i < 16; i++) stones.push({ x: 380 + r() * 700, y: 1190 + r() * 330 });
      stones.sort((a, b) => a.y - b.y);
      stones.forEach((s) => {
        const k = 0.55 + (s.y - 1190) / 330 * 0.9;
        c.fillStyle = '#020304';
        c.beginPath(); c.ellipse(s.x, s.y, 70 * k, 16 * k, 0, 0, 7); c.fill();
        c.fillStyle = '#2b313b';
        const w = 26 * k, h = 78 * k;
        c.beginPath(); c.moveTo(s.x - w / 2, s.y); c.lineTo(s.x - w / 2, s.y - h); c.lineTo(s.x, s.y - h - 14 * k); c.lineTo(s.x + w / 2, s.y - h); c.lineTo(s.x + w / 2, s.y); c.fill();
        c.fillStyle = 'rgba(' + T.fog + ',0.12)'; c.fillRect(s.x - w / 2, s.y - h, 4 * k, h);
      });
      return {};
    },

    corridor(c, r, T) {
      const bx0 = 400, bx1 = 680, by0 = 760, by1 = 1060;
      const poly = (pts, fill) => { c.fillStyle = fill; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill(); };
      poly([[0, 0], [LW, 0], [bx1, by0], [bx0, by0]], '#040507');
      const wl = c.createLinearGradient(0, 0, bx0, 0); wl.addColorStop(0, '#020304'); wl.addColorStop(1, T.mid);
      poly([[0, 0], [bx0, by0], [bx0, by1], [0, LH]], wl);
      const wr = c.createLinearGradient(LW, 0, bx1, 0); wr.addColorStop(0, '#020304'); wr.addColorStop(1, T.mid);
      poly([[LW, 0], [bx1, by0], [bx1, by1], [LW, LH]], wr);
      const fl = c.createLinearGradient(0, by1, 0, LH); fl.addColorStop(0, T.mid); fl.addColorStop(1, '#000');
      poly([[bx0, by1], [bx1, by1], [LW, LH], [0, LH]], fl);
      c.fillStyle = T.hor; c.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
      c.fillStyle = '#000'; c.fillRect(490, 890, 100, 170);
      c.fillStyle = '#05070a'; c.fillRect(530, 890, 60, 170);
      c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 3;
      for (let i = 1; i < 9; i++) { const d = Math.pow(i / 9, 1.8); const y = lerp(by1, LH, d), xl = lerp(bx0, 0, d), xr = lerp(bx1, LW, d); c.beginPath(); c.moveTo(xl, y); c.lineTo(xr, y); c.stroke(); }
      for (let i = 0; i <= 6; i++) { c.beginPath(); c.moveTo(lerp(bx0, bx1, i / 6), by1); c.lineTo(lerp(-300, LW + 300, i / 6), LH); c.stroke(); }
      // side doors
      [[0.35, -1], [0.62, 1], [0.15, 1]].forEach(([d, side]) => {
        const xa = side < 0 ? lerp(bx0, 0, d) : lerp(bx1, LW, d);
        const xb = side < 0 ? lerp(bx0, 0, d + 0.12) : lerp(bx1, LW, d + 0.12);
        const ta = lerp(by0, 0, d) + lerp(150, 0, d) + 60, tb = lerp(by0, 0, d + 0.12) + 60;
        const ba = lerp(by1, LH, d), bb = lerp(by1, LH, d + 0.12);
        poly([[xa, ta + 80], [xb, tb + 60], [xb, bb], [xa, ba]], '#010102');
      });
      const lamps = [0.12, 0.42, 0.72].map((d) => ({ x: 540, y: lerp(by0, 0, d), w: lerp(70, 260, d), d }));
      return { lamps };
    },

    room(c, r, T) {
      const wg = c.createLinearGradient(0, 0, 0, 1300);
      wg.addColorStop(0, '#030406'); wg.addColorStop(1, T.mid);
      c.fillStyle = wg; c.fillRect(0, 0, LW, 1300);
      const fg = c.createLinearGradient(0, 1300, 0, LH);
      fg.addColorStop(0, '#07090c'); fg.addColorStop(1, '#000');
      c.fillStyle = fg; c.fillRect(0, 1300, LW, LH - 1300);
      // window with night sky
      const wx = 600, wy = 450, ww = 300, wh = 400;
      c.save(); c.beginPath(); c.rect(wx, wy, ww, wh); c.clip();
      const sg = c.createLinearGradient(0, wy, 0, wy + wh); sg.addColorStop(0, T.mid); sg.addColorStop(1, T.hor);
      c.fillStyle = sg; c.fillRect(wx, wy, ww, wh);
      c.fillStyle = '#ebe6d2'; c.beginPath(); c.arc(wx + 200, wy + 110, 46, 0, 7); c.fill();
      c.strokeStyle = '#010203'; c.lineCap = 'round';
      tree(c, r, wx + 60, wy + wh + 40, 160, -Math.PI / 2 + 0.2, 14, 5);
      c.restore();
      c.fillStyle = '#020304';
      c.fillRect(wx - 14, wy - 14, ww + 28, 14); c.fillRect(wx - 14, wy + wh, ww + 28, 20);
      c.fillRect(wx - 14, wy, 14, wh); c.fillRect(wx + ww, wy, 14, wh);
      c.fillRect(wx + ww / 2 - 5, wy, 10, wh); c.fillRect(wx, wy + wh / 2 - 5, ww, 10);
      // curtains
      c.fillStyle = '#050608';
      [[wx - 70, 1], [wx + ww + 70, -1]].forEach(([x0, s]) => {
        c.beginPath(); c.moveTo(x0, wy - 40);
        for (let y = wy - 40; y <= wy + wh + 120; y += 40) c.lineTo(x0 + s * (60 + Math.sin(y * 0.05) * 14), y);
        c.lineTo(x0, wy + wh + 120); c.fill();
      });
      // door ajar
      c.fillStyle = '#020304'; c.fillRect(70, 760, 250, 545);
      c.fillStyle = '#000'; c.fillRect(85, 775, 70, 530);
      c.fillStyle = '#06080b'; c.fillRect(155, 775, 150, 530);
      // bed
      c.fillStyle = '#020304';
      c.fillRect(980, 1030, 70, 340);
      c.fillRect(560, 1200, 470, 170);
      c.fillStyle = '#0a0c10'; c.beginPath(); c.ellipse(900, 1195, 80, 28, 0, 0, 7); c.fill();
      return { window: { x: wx, y: wy, w: ww, h: wh }, door: { x: 85, y: 775, w: 70, h: 530 } };
    },

    road(c, r, T, sc) {
      sky(c, T, sc.moon !== false, r, 1050);
      ground(c, 1050);
      c.lineCap = 'round'; c.strokeStyle = '#010203';
      for (let i = 0; i < 7; i++) {
        const left = i % 2 === 0;
        const x = left ? r() * 380 : 700 + r() * 380;
        tree(c, r, x, 1060, 120 + r() * 90, -Math.PI / 2, 14, 5);
      }
      c.fillStyle = '#0b0d10';
      c.beginPath(); c.moveTo(505, 1050); c.lineTo(575, 1050); c.lineTo(LW + 380, LH); c.lineTo(-380, LH); c.fill();
      c.fillStyle = '#020304';
      c.fillRect(850, 700, 16, 760); c.fillRect(760, 700, 106, 12);
      c.fillRect(752, 708, 34, 16);
      return { lamp: { x: 769, y: 724 }, road: true };
    },

    // Bus interior seen from the front, looking down the aisle to the rear bench.
    // Depth d: 0 = rear wall, 1 = camera. Floor y at depth d = lerp(by1, LH, d).
    bus(c, r, T, sc) {
      const bx0 = 390, bx1 = 690, by0 = 720, by1 = 1040;
      const poly = (pts, fill) => { c.fillStyle = fill; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill(); };
      poly([[0, 0], [LW, 0], [bx1, by0], [bx0, by0]], '#05060a');
      const wl = c.createLinearGradient(0, 0, bx0, 0); wl.addColorStop(0, '#030406'); wl.addColorStop(1, T.mid);
      poly([[0, 0], [bx0, by0], [bx0, by1], [0, LH]], wl);
      const wr = c.createLinearGradient(LW, 0, bx1, 0); wr.addColorStop(0, '#030406'); wr.addColorStop(1, T.mid);
      poly([[LW, 0], [bx1, by0], [bx1, by1], [LW, LH]], wr);
      const fl = c.createLinearGradient(0, by1, 0, LH); fl.addColorStop(0, '#0c0f15'); fl.addColorStop(1, '#000');
      poly([[bx0, by1], [bx1, by1], [LW, LH], [0, LH]], fl);
      poly([[505, by1], [575, by1], [720, LH], [360, LH]], 'rgba(0,0,0,0.45)');
      // rear wall + rear window onto the dark road
      c.fillStyle = '#0a0d13'; c.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
      c.fillStyle = '#04060b'; c.fillRect(bx0 + 30, by0 + 30, bx1 - bx0 - 60, 140);
      glowRadial(c, bx0 + 60, by0 + 150, 2, 60, '200,30,30', 0.35);
      glowRadial(c, bx1 - 60, by0 + 150, 2, 60, '200,30,30', 0.35);
      // side windows (quads), stored for the passing-light pass
      const wins = [];
      const wy = (d, top) => (top ? lerp(by0 + 40, 230, d) : lerp(by0 + 160, 880, d));
      for (let d = 0.04; d < 0.9; d += 0.13) {
        const d2 = d + 0.1;
        [-1, 1].forEach((side) => {
          const xa = side < 0 ? lerp(bx0, 0, d) : lerp(bx1, LW, d);
          const xb = side < 0 ? lerp(bx0, 0, d2) : lerp(bx1, LW, d2);
          const q = [[xa, wy(d, true)], [xb, wy(d2, true)], [xb, wy(d2, false)], [xa, wy(d, false)]];
          poly(q, '#070b14');
          wins.push({ q, d: (d + d2) / 2 });
        });
      }
      // curtains tied at each window pillar
      wins.forEach((w) => {
        const [a, b, cc, dd] = w.q;
        const cw = Math.abs(b[0] - a[0]) * 0.22;
        const s = a[0] < 540 ? 1 : -1;
        c.fillStyle = '#2a1416';
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(a[0] + s * cw, a[1] + (b[1] - a[1]) * 0.22);
        c.quadraticCurveTo(a[0] + s * cw * 0.3, (a[1] + dd[1]) / 2, a[0] + s * cw * 0.8, dd[1] + (cc[1] - dd[1]) * 0.2);
        c.lineTo(dd[0], dd[1]); c.closePath(); c.fill();
      });
      // luggage racks with bags and boxes
      c.strokeStyle = '#0b0d12'; c.lineWidth = 12;
      const rackPt = (side, d) => [side < 0 ? lerp(bx0, 0, d) + lerp(6, 40, d) : lerp(bx1, LW, d) - lerp(6, 40, d), lerp(by0 + 30, 170, d)];
      [-1, 1].forEach((side) => {
        const p0 = rackPt(side, 0), p1 = rackPt(side, 1);
        c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke();
        for (let i = 0; i < 4; i++) {
          const d = 0.12 + i * 0.2 + r() * 0.06, p = rackPt(side, d), sz = lerp(14, 90, d) * (0.7 + r() * 0.5);
          c.fillStyle = ['#1c1a1f', '#23180f', '#15202b'][i % 3];
          c.beginPath(); c.roundRect(p[0] - (side < 0 ? 0 : sz * 1.4), p[1] - sz, sz * 1.4, sz, sz * 0.15); c.fill();
        }
      });
      // ceiling AC vent strip and aisle LED dots
      for (let d = 0.05; d < 1; d += 0.07) {
        const y = lerp(by0, 0, d), w = lerp(26, 120, d);
        c.fillStyle = '#0b0e14'; c.fillRect(540 - w / 2, y - lerp(3, 12, d), w, lerp(4, 16, d));
        const fy = lerp(by1, LH, d);
        glowRadial(c, lerp(505, 360, d), fy, 0, lerp(3, 14, d), '80,140,255', 0.8);
        glowRadial(c, lerp(575, 720, d), fy, 0, lerp(3, 14, d), '80,140,255', 0.8);
      }
      // rear bench across the full width, with its passengers
      c.fillStyle = '#10141c'; c.fillRect(bx0 + 4, by1 - 95, bx1 - bx0 - 8, 95);
      c.fillStyle = '#4b4a46'; for (let i = 0; i < 5; i++) c.fillRect(bx0 + 18 + i * 56, by1 - 95, 40, 22);
      // seat rows, back to front so nearer rows overlap farther ones.
      // Sleeping passengers' heads peek over some seat backs.
      const nPass = sc.passengers == null ? 6 : sc.passengers;
      const seats = [];
      [0.12, 0.26, 0.42, 0.6, 0.8].forEach((d) => [-1, 1].forEach((side) => seats.push({ d, side })));
      const rp = rng((sc.seed || 1) * 131);
      const occupied = new Set();
      while (occupied.size < Math.min(nPass, seats.length - 2)) occupied.add(Math.floor(rp() * (seats.length - 2)));
      seats.forEach(({ d, side }, idx) => {
        const yf = lerp(by1, LH, d), h = lerp(110, 640, d);
        const xw = side < 0 ? lerp(bx0, 0, d) : lerp(bx1, LW, d);
        const xa = side < 0 ? lerp(498, 360, d) : lerp(582, 720, d);
        const x0 = Math.min(xw, xa), w = Math.abs(xa - xw);
        if (occupied.has(idx)) {
          const hx = x0 + w * (0.3 + rp() * 0.4), hrad = h * 0.13, tilt = side * (0.25 + rp() * 0.3);
          c.fillStyle = '#020203';
          c.save(); c.translate(hx, yf - h - hrad * 0.4); c.rotate(tilt);
          c.beginPath(); c.ellipse(0, 0, hrad * 0.9, hrad * 1.1, 0, 0, 7); c.fill();
          if (rp() < 0.5) { c.fillStyle = '#3d2420'; c.beginPath(); c.ellipse(0, -hrad * 0.6, hrad, hrad * 0.5, 0, Math.PI, 0); c.fill(); }
          c.restore();
        }
        c.fillStyle = '#121620';
        c.beginPath(); c.roundRect(x0, yf - h, w, h * 0.8, h * 0.12); c.fill();
        c.fillStyle = 'rgba(' + T.fog + ',0.10)'; c.fillRect(x0 + w * 0.08, yf - h + 3, w * 0.84, Math.max(2, h * 0.02));
        // white headrest covers, typical of Indonesian intercity buses
        c.fillStyle = '#4b4a46';
        c.beginPath(); c.roundRect(x0 + w * 0.14, yf - h + h * 0.04, w * 0.72, h * 0.2, h * 0.04); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x0 + w * 0.14, yf - h + h * 0.2, w * 0.72, h * 0.03);
        c.fillStyle = '#07090d'; c.fillRect(x0, yf - h * 0.25, w, h * 0.25);
      });
      const lights = [0.1, 0.35, 0.6].map((d) => ({ x: 540, y: lerp(by0, 0, d), w: lerp(40, 140, d), d }));
      const straps = [];
      for (let d = 0.2; d < 0.95; d += 0.15) [-1, 1].forEach((s) => straps.push({ d, x: 540 + s * lerp(45, 190, d), y: lerp(by0, 0, d) + lerp(10, 40, d) }));
      return { bus: { wins, lights, straps, by1 } };
    },

    // Driver's cabin seen from behind the driver (right-hand drive, as in Indonesia):
    // windshield onto the night road, dashboard, steering wheel. The road, lamp posts,
    // route sign, mirror and driver are drawn per frame in bgDynamic.
    busfront(c, r, T) {
      c.fillStyle = '#030407'; c.fillRect(0, 0, LW, LH);
      const ws = [[95, 330], [985, 330], [1035, 1000], [45, 1000]];
      c.save(); c.beginPath(); ws.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.clip();
      const g = c.createLinearGradient(0, 330, 0, 700);
      g.addColorStop(0, T.top); g.addColorStop(1, T.hor);
      c.fillStyle = g; c.fillRect(0, 330, LW, 370);
      c.fillStyle = 'rgba(255,255,255,0.45)';
      for (let i = 0; i < 40; i++) c.fillRect(r() * LW, 340 + r() * 250, 2, 2);
      c.fillStyle = '#050608'; c.fillRect(0, 700, LW, 300);
      c.strokeStyle = '#020304'; c.lineCap = 'round';
      for (let i = 0; i < 9; i++) { const x = i < 5 ? r() * 430 : 650 + r() * 430; tree(c, r, x, 705, 50 + r() * 50, -Math.PI / 2, 7, 5); }
      c.fillStyle = '#0d0f13';
      c.beginPath(); c.moveTo(505, 700); c.lineTo(575, 700); c.lineTo(1200, 1000); c.lineTo(-120, 1000); c.fill();
      c.restore();
      // pillars, roof, dashboard
      c.fillStyle = '#010102';
      c.beginPath(); c.moveTo(0, 230); c.lineTo(125, 330); c.lineTo(75, 1010); c.lineTo(0, 1090); c.fill();
      c.beginPath(); c.moveTo(LW, 230); c.lineTo(955, 330); c.lineTo(1005, 1010); c.lineTo(LW, 1090); c.fill();
      c.fillRect(0, 0, LW, 335);
      c.fillStyle = '#07090c'; c.fillRect(140, 250, 360, 70);
      const dg = c.createLinearGradient(0, 990, 0, 1320);
      dg.addColorStop(0, '#0c0f14'); dg.addColorStop(1, '#020203');
      c.fillStyle = dg; c.beginPath(); c.moveTo(0, 1010); c.quadraticCurveTo(540, 960, LW, 1010); c.lineTo(LW, LH); c.lineTo(0, LH); c.fill();
      c.fillStyle = 'rgba(' + T.fog + ',0.12)'; c.beginPath(); c.moveTo(0, 1010); c.quadraticCurveTo(540, 960, LW, 1010); c.lineTo(LW, 1016); c.quadraticCurveTo(540, 966, 0, 1016); c.fill();
      // door, step and grab pole on the left
      c.fillStyle = '#05070b'; c.fillRect(0, 1080, 230, 840);
      c.strokeStyle = '#1a1e26'; c.lineWidth = 16; c.beginPath(); c.moveTo(250, 1060); c.lineTo(250, LH); c.stroke();
      // dashboard trinkets: tissue box and a plastic flower
      c.fillStyle = '#1b1f27'; c.fillRect(380, 985, 90, 36);
      c.fillStyle = '#6a2030'; c.beginPath(); c.arc(330, 975, 14, 0, 7); c.fill();
      c.strokeStyle = '#1e3a24'; c.lineWidth = 4; c.beginPath(); c.moveTo(330, 989); c.lineTo(330, 1010); c.stroke();
      return { busfront: { ws } };
    },

    // Angkot (Indonesian minivan) interior, looking back from behind the driver:
    // two vinyl benches facing each other along the sides, small windows, one
    // fluorescent tube, and the open rear door onto the road. Depth d: 0 = rear, 1 = camera.
    angkot(c, r, T, sc) {
      const ox0 = 380, ox1 = 700, oy0 = 700, oy1 = 1150;
      const poly = (pts, fill) => { c.fillStyle = fill; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill(); };
      const wallX = (side, d) => (side < 0 ? lerp(ox0, 0, d) : lerp(ox1, LW, d));
      const floorY = (d) => lerp(oy1, LH, d);
      poly([[0, 0], [LW, 0], [ox1, oy0], [ox0, oy0]], '#07080b');
      [-1, 1].forEach((s) => {
        const g = c.createLinearGradient(s < 0 ? 0 : LW, 0, s < 0 ? ox0 : ox1, 0);
        g.addColorStop(0, '#040507'); g.addColorStop(1, T.mid);
        poly([[s < 0 ? 0 : LW, 0], [wallX(s, 0), oy0], [wallX(s, 0), oy1], [s < 0 ? 0 : LW, LH]], g);
      });
      const fg = c.createLinearGradient(0, oy1, 0, LH); fg.addColorStop(0, '#0d0f13'); fg.addColorStop(1, '#000');
      poly([[ox0, oy1], [ox1, oy1], [LW, LH], [0, LH]], fg);
      // rear door frame (the opening itself is drawn per frame)
      c.strokeStyle = '#020203'; c.lineWidth = 22; c.strokeRect(ox0, oy0, ox1 - ox0, oy1 - oy0);
      // windows above the benches
      const wins = [];
      for (let d = 0.05; d < 0.8; d += 0.19) {
        const d2 = d + 0.15;
        [-1, 1].forEach((s) => {
          const top = (dd) => lerp(oy0 + 40, 180, dd), bot = (dd) => lerp(oy0 + 190, 760, dd);
          const q = [[wallX(s, d), top(d)], [wallX(s, d2), top(d2)], [wallX(s, d2), bot(d2)], [wallX(s, d), bot(d)]];
          poly(q, '#080c15');
          wins.push({ q, d: (d + d2) / 2 });
        });
      }
      // sticker strip + speaker on the ceiling, typical angkot decor
      c.fillStyle = '#5a1418'; c.fillRect(470, 560, 140, 26);
      c.fillStyle = '#0c0d10'; c.beginPath(); c.roundRect(500, 470, 80, 40, 8); c.fill();
      // benches: backrest on the wall, cushion top, front face
      const seatH = (d) => lerp(60, 330, d), backH = (d) => lerp(70, 380, d);
      const inner = (s, d) => (s < 0 ? lerp(455, 230, d) : lerp(625, 850, d));
      [-1, 1].forEach((s) => {
        const d0 = 0.0, d1 = 0.92;
        const st = (d) => floorY(d) - seatH(d);
        poly([[wallX(s, d0), st(d0)], [wallX(s, d1), st(d1)], [wallX(s, d1), st(d1) - backH(d1)], [wallX(s, d0), st(d0) - backH(d0)]], '#2a1012');
        poly([[wallX(s, d0), st(d0)], [inner(s, d0), st(d0) + 4], [inner(s, d1), st(d1) + 20], [wallX(s, d1), st(d1)]], '#3a1517');
        poly([[inner(s, d0), st(d0) + 4], [inner(s, d1), st(d1) + 20], [inner(s, d1), floorY(d1)], [inner(s, d0), floorY(d0)]], '#14090a');
        c.strokeStyle = 'rgba(' + T.fog + ',0.10)'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(inner(s, d0), st(d0) + 4); c.lineTo(inner(s, d1), st(d1) + 20); c.stroke();
      });
      // seated passengers facing the aisle (the ghost is drawn as a character)
      const rp = rng((sc.seed || 1) * 71);
      const pass = [];
      const nPass = sc.passengers == null ? 2 : sc.passengers;
      const slots = [[-1, 0.32], [1, 0.5], [1, 0.18], [-1, 0.62], [1, 0.75]].slice(0, nPass);
      slots.forEach(([s, d]) => {
        const k = lerp(0.18, 0.95, d);
        const hx = lerp(wallX(s, d), inner(s, d), 0.45), hy = floorY(d) - seatH(d);
        c.save(); c.translate(hx, hy); c.scale(k * -s, k);       // face toward the aisle
        c.fillStyle = '#020203'; c.strokeStyle = '#020203'; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-70, 0); c.lineTo(-62, -230); c.quadraticCurveTo(0, -270, 62, -230); c.lineTo(70, 0); c.closePath(); c.fill();   // torso
        c.beginPath(); c.arc(rp() * 10 - 10, -305, 58, 0, 7); c.fill();          // head
        c.lineWidth = 62; c.beginPath(); c.moveTo(-30, -20); c.lineTo(-170, -10); c.lineTo(-180, seatH(d) / k - 20); c.stroke();
        c.lineWidth = 36; c.beginPath(); c.moveTo(-40, -200); c.lineTo(-110, -60); c.stroke();
        if (rp() < 0.5) { c.fillStyle = '#3a2a1a'; c.fillRect(-120, -80, 70, 60); }  // bag on the lap
        c.restore();
        pass.push({ x: hx - s * 60 * k, y: floorY(d) - 10, d, k });
      });
      return { angkot: { wins, pass, open: { x0: ox0, x1: ox1, y0: oy0, y1: oy1 }, inner, floorY } };
    },
  };

  const bgCache = {};
  function bgFor(sc) {
    const name = sc.bg || 'black';
    if (!BG[name]) throw new Error('unknown bg "' + name + '" in scene ' + sc.i);
    const key = [name, sc.tone || S.tone || 'blue', sc.seed || 1, sc.moon !== false, sc.passengers, sc.routeSign].join('|');
    if (!bgCache[key]) {
      const o = off(LW, LH);
      const meta = BG[name](o.x, rng((sc.seed || 1) * 977 + name.length * 31), toneOf(sc), sc) || {};
      bgCache[key] = { canvas: o.c, meta };
    }
    return bgCache[key];
  }

  function glowRadial(c, x, y, r0, r1, rgb, a) {
    const g = c.createRadialGradient(x, y, r0, x, y, r1);
    g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    c.fillStyle = g; c.fillRect(x - r1, y - r1, r1 * 2, r1 * 2);
  }

  function bgDynamic(c, sc, meta, lt, T) {
    const fl = (k) => 0.75 + 0.25 * Math.sin(lt * 17 + k) * Math.sin(lt * 5.3 + k * 2);
    if (meta.windows) {
      const idx = sc.litWindow == null ? 0 : sc.litWindow;
      if (idx >= 0) {
        const w = meta.windows[idx];
        const red = sc.windowColor === 'red';
        const rgb = red ? '200,30,30' : '255,200,110';
        const a = has(sc, 'flicker') ? (hash(lt * 10) < 0.2 ? 0.25 : fl(1)) : fl(1);
        c.fillStyle = 'rgba(' + rgb + ',' + (0.85 * a) + ')'; c.fillRect(w.x, w.y, w.w, w.h);
        glowRadial(c, w.x + w.w / 2, w.y + w.h / 2, 20, 220, rgb, 0.25 * a);
        if (sc.windowFigure) {
          c.fillStyle = '#000';
          c.beginPath(); c.arc(w.x + w.w / 2, w.y + 52, 20, 0, 7); c.fill();
          c.beginPath(); c.ellipse(w.x + w.w / 2, w.y + w.h, 34, 52, 0, Math.PI, 0); c.fill();
        }
        c.fillStyle = '#020304';
        c.fillRect(w.x + w.w / 2 - 3, w.y, 6, w.h); c.fillRect(w.x, w.y + w.h / 2 - 3, w.w, 6);
      }
    }
    if (meta.lamps) {
      meta.lamps.forEach((l, i) => {
        const bad = i === (sc.flickerLamp == null ? 1 : sc.flickerLamp);
        let a = 0.8;
        if (bad) a = hash(lt * 14 + 3) < 0.35 ? 0.05 : 0.9;
        c.fillStyle = 'rgba(230,235,210,' + (0.5 + a * 0.5) + ')';
        c.fillRect(l.x - l.w / 2, l.y, l.w, 8 + l.d * 10);
        const g = c.createLinearGradient(0, l.y, 0, l.y + 900 * (1 - l.d * 0.4));
        g.addColorStop(0, 'rgba(220,230,210,' + 0.16 * a + ')'); g.addColorStop(1, 'rgba(220,230,210,0)');
        c.fillStyle = g;
        c.beginPath(); c.moveTo(l.x - l.w / 2, l.y); c.lineTo(l.x + l.w / 2, l.y);
        c.lineTo(l.x + l.w * 1.6, l.y + 900); c.lineTo(l.x - l.w * 1.6, l.y + 900); c.fill();
      });
    }
    if (meta.lamp) {
      const L = meta.lamp;
      const a = has(sc, 'flicker') ? (hash(lt * 12 + 7) < 0.3 ? 0.1 : 1) : fl(2);
      const g = c.createLinearGradient(0, L.y, 0, 1480);
      g.addColorStop(0, 'rgba(255,210,140,' + 0.35 * a + ')'); g.addColorStop(1, 'rgba(255,210,140,0)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(L.x - 14, L.y); c.lineTo(L.x + 14, L.y); c.lineTo(L.x + 260, 1480); c.lineTo(L.x - 260, 1480); c.fill();
      c.fillStyle = 'rgba(255,220,160,' + 0.12 * a + ')';
      c.beginPath(); c.ellipse(L.x, 1470, 280, 50, 0, 0, 7); c.fill();
      glowRadial(c, L.x, L.y + 6, 4, 90, '255,215,150', 0.9 * a);
    }
    if (meta.road && sc.roadMove) {
      c.fillStyle = 'rgba(220,210,170,0.55)';
      for (let i = 0; i < 9; i++) {
        const d = ((i / 9 + lt * 0.35) % 1);
        const k = d * d;
        const y = lerp(1050, LH, k), h = lerp(6, 160, k), w = lerp(3, 26, k);
        c.fillRect(540 - w / 2, y, w, h);
      }
    }
    if (meta.bus) {
      const B = meta.bus;
      B.lights.forEach((l) => {
        const a = has(sc, 'flicker') ? (hash(lt * 13 + l.d * 10) < 0.25 ? 0.15 : 0.9) : 0.7;
        c.fillStyle = 'rgba(190,210,255,' + 0.6 * a + ')'; c.fillRect(l.x - l.w / 2, l.y, l.w, 6 + l.d * 8);
        glowRadial(c, l.x, l.y + 10, 4, 120 + l.d * 160, '150,175,230', 0.18 * a);
      });
      // hanging grab straps swinging with the bus
      c.strokeStyle = '#0d1016'; c.lineCap = 'round';
      B.straps.forEach((s, i) => {
        const len = lerp(40, 200, s.d), a = Math.sin(lt * 2.1 + i * 0.7) * 0.12 + (sc.brake ? 0.5 * Math.exp(-lt * 2) * Math.cos(lt * 9) : 0);
        const ex = s.x + Math.sin(a) * len, ey = s.y + Math.cos(a) * len;
        c.lineWidth = lerp(3, 12, s.d); c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(ex, ey); c.stroke();
        c.lineWidth = lerp(3, 10, s.d); c.beginPath(); c.arc(ex, ey + lerp(6, 26, s.d), lerp(6, 26, s.d), 0, 7); c.stroke();
      });
      // a streetlight sweeps from the front windows to the back every `passEvery` seconds
      const P = busPass(sc, lt);
      if (P.on) {
        B.wins.forEach((w) => {
          const a = 0.7 * Math.exp(-Math.pow(w.d - P.center, 2) / 0.006);
          if (a < 0.01) return;
          c.fillStyle = 'rgba(255,190,110,' + a + ')';
          c.beginPath(); w.q.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill();
        });
        const d0 = clamp(P.center - 0.07), d1 = clamp(P.center + 0.07);
        const fa = 0.22 * Math.exp(-Math.pow(P.center - 0.5, 2) / 0.4);
        c.fillStyle = 'rgba(255,190,110,' + fa + ')';
        c.beginPath();
        c.moveTo(lerp(390, 0, d0), lerp(B.by1, LH, d0)); c.lineTo(lerp(690, LW, d0), lerp(B.by1, LH, d0));
        c.lineTo(lerp(690, LW, d1), lerp(B.by1, LH, d1)); c.lineTo(lerp(390, 0, d1), lerp(B.by1, LH, d1)); c.fill();
      }
    }
    if (meta.busfront) busfrontDynamic(c, sc, meta.busfront, lt, T);
    if (meta.angkot) angkotDynamic(c, sc, meta.angkot, lt, T);
    if (meta.window) {
      const w = meta.window;
      const a = 0.07 + 0.015 * Math.sin(lt * 1.3);
      c.fillStyle = 'rgba(' + T.fog + ',' + a + ')';
      c.beginPath(); c.moveTo(w.x, w.y + w.h); c.lineTo(w.x + w.w, w.y + w.h);
      c.lineTo(w.x + w.w - 60, 1700); c.lineTo(w.x - 420, 1700); c.fill();
    }
  }

  function busfrontDynamic(c, sc, M, lt, T) {
    // `brake`: the bus decelerates to a stop during the scene; `roadMove: false`: parked.
    const tm = sc.brake ? (1 - Math.exp(-lt * 2.5)) * 0.6 : sc.roadMove === false ? 0 : lt;
    let flash = 0;
    c.save();
    c.beginPath(); M.ws.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.clip();
    const hg = c.createLinearGradient(0, 1000, 0, 705);
    hg.addColorStop(0, 'rgba(255,235,190,0.28)'); hg.addColorStop(1, 'rgba(255,235,190,0)');
    c.fillStyle = hg; c.beginPath(); c.moveTo(150, 1000); c.lineTo(930, 1000); c.lineTo(600, 705); c.lineTo(480, 705); c.fill();
    c.fillStyle = 'rgba(230,220,180,0.7)';
    for (let i = 0; i < 9; i++) {
      const k = Math.pow((i / 9 + tm * 0.7) % 1, 2);
      const h = lerp(3, 70, k), w = lerp(2, 20, k);
      c.fillRect(540 - w / 2, lerp(700, 1000, k), w, h);
    }
    // lamp posts on the left roadside, rushing past
    for (let i = 0; i < 4; i++) {
      const e = Math.pow((tm * 0.45 + i / 4) % 1, 2);
      const x = lerp(470, -140, e), yb = lerp(702, 1000, e), h = lerp(25, 820, e), w = lerp(2, 24, e);
      c.fillStyle = '#020304'; c.fillRect(x - w / 2, yb - h, w, h);
      const ax = x + lerp(8, 170, e), ay = yb - h;
      c.strokeStyle = '#020304'; c.lineWidth = w * 0.7; c.beginPath(); c.moveTo(x, ay); c.lineTo(ax, ay); c.stroke();
      glowRadial(c, ax, ay + w, 0, lerp(8, 170, e), '255,200,130', 0.85);
      if (e > 0.55) flash = Math.max(flash, (e - 0.55) / 0.45);
    }
    c.restore();
    // LED route sign (`routeSign: ''` hides it, e.g. for an angkot)
    if (sc.routeSign !== '') {
      c.fillStyle = '#000'; c.fillRect(150, 258, 340, 54);
      c.font = '700 26px Consolas, "Courier New", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#ff5a2a'; c.shadowColor = '#ff3a10'; c.shadowBlur = 14;
      c.fillText((sc.routeSign || 'BANYUWANGI - SURABAYA').toUpperCase(), 320, 286); c.shadowBlur = 0; c.textAlign = 'left';
    }
    // rear-view mirror; `mirrorFigure` puts a pale face in it
    c.fillStyle = '#0b0d12'; c.fillRect(580, 330, 10, 22);
    c.beginPath(); c.roundRect(470, 348, 230, 72, 14); c.fill();
    const mg = c.createLinearGradient(0, 356, 0, 412); mg.addColorStop(0, '#1a2233'); mg.addColorStop(1, '#0a0d14');
    c.fillStyle = mg; c.beginPath(); c.roundRect(480, 356, 210, 56, 10); c.fill();
    if (sc.mirrorFigure) {
      c.save(); c.beginPath(); c.roundRect(480, 356, 210, 56, 10); c.clip();
      c.fillStyle = '#000'; c.beginPath(); c.ellipse(640, 392, 30, 40, 0, 0, 7); c.fill();
      c.fillStyle = '#c9d0c2'; c.beginPath(); c.ellipse(640, 392, 15, 21, 0, 0, 7); c.fill();
      c.fillStyle = '#000'; c.fillRect(630, 370, 6, 40); c.fillRect(646, 372, 5, 36);
      c.fillStyle = '#ff2a2a'; c.beginPath(); c.arc(642, 388, 2.5, 0, 7); c.fill();
      c.restore();
    }
    // prayer beads hanging from the mirror, swinging (hard jerk when braking)
    const sa = Math.sin(lt * 2.3) * 0.22 + (sc.brake ? 0.9 * Math.exp(-lt * 1.5) * Math.cos(lt * 7) : 0);
    c.strokeStyle = '#2a2418'; c.lineWidth = 2;
    const bx = 585 + Math.sin(sa) * 120, by = 420 + Math.cos(sa) * 120;
    c.beginPath(); c.moveTo(585, 420); c.lineTo(bx, by); c.stroke();
    c.fillStyle = '#5a4428';
    for (let i = 1; i <= 8; i++) { c.beginPath(); c.arc(lerp(585, bx, i / 8), lerp(420, by, i / 8), 4, 0, 7); c.fill(); }
    c.fillStyle = '#8a6a32'; c.beginPath(); c.arc(bx, by + 8, 9, 0, 7); c.fill();
    glowRadial(c, 700, 1052, 0, 24, '90,255,170', 0.6);
    glowRadial(c, 790, 1052, 0, 24, '255,180,60', 0.6);
    if (sc.driver !== false) drawDriver(c, lt, T);
    // `ghostHand`: a pale arm reaches from behind the driver, holding out an old banknote
    if (sc.ghostHand) {
      const p = clamp((lt - (sc.ghostHandAt || 0.5)) / 1.6);
      if (p > 0) {
        const q = ease(p);
        const hx = lerp(-80, 560, q), hy = lerp(1500, 1230, q);
        c.strokeStyle = '#c9d1c3'; c.lineCap = 'round'; c.lineWidth = 30;
        c.beginPath(); c.moveTo(-60, 1640); c.quadraticCurveTo(lerp(-20, 260, q), lerp(1600, 1380, q), hx, hy); c.stroke();
        c.save(); c.translate(hx, hy); c.rotate(-0.5);
        c.fillStyle = '#a8916a'; c.fillRect(-10, -70, 150, 70);
        c.strokeStyle = '#5b4a2e'; c.lineWidth = 3; c.strokeRect(-2, -62, 134, 54);
        c.restore();
        c.strokeStyle = '#c9d1c3'; c.lineWidth = 7;
        for (let f = 0; f < 4; f++) { c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + 26 + f * 4, hy - 30 + f * 12); c.stroke(); }
        c.fillStyle = '#1a1612';
        for (let f = 0; f < 4; f++) { c.beginPath(); c.arc(hx + 26 + f * 4, hy - 30 + f * 12, 4, 0, 7); c.fill(); }
      }
    }
    if (flash > 0) { c.fillStyle = 'rgba(255,190,110,' + flash * 0.1 + ')'; c.fillRect(0, 0, LW, LH); }
  }

  function angkotDynamic(c, sc, M, lt, T) {
    const tm = sc.brake ? (1 - Math.exp(-lt * 2.5)) * 0.6 : sc.roadMove === false ? 0 : lt;
    const O = M.open;
    // the road receding behind the open rear door
    c.save(); c.beginPath(); c.rect(O.x0, O.y0, O.x1 - O.x0, O.y1 - O.y0); c.clip();
    const sg = c.createLinearGradient(0, O.y0, 0, 930); sg.addColorStop(0, T.top); sg.addColorStop(1, T.hor);
    c.fillStyle = sg; c.fillRect(O.x0, O.y0, O.x1 - O.x0, 240);
    c.fillStyle = '#060709'; c.fillRect(O.x0, 930, O.x1 - O.x0, O.y1 - 930);
    c.fillStyle = '#0e1014'; c.beginPath(); c.moveTo(530, 930); c.lineTo(550, 930); c.lineTo(760, O.y1); c.lineTo(320, O.y1); c.fill();
    c.fillStyle = 'rgba(220,210,170,0.6)';
    for (let i = 0; i < 6; i++) {
      const k = Math.pow(1 - ((i / 6 + tm * 0.6) % 1), 2);
      const h = lerp(3, 60, k), w = lerp(2, 14, k);
      c.fillRect(540 - w / 2, lerp(930, O.y1, k), w, h);
    }
    for (let i = 0; i < 3; i++) {
      const e = Math.pow(1 - ((tm * 0.4 + i / 3) % 1), 2);
      const x = lerp(520, 330, e), yb = lerp(932, 1170, e), h = lerp(12, 420, e), w = lerp(1.5, 12, e);
      c.fillStyle = '#020304'; c.fillRect(x - w / 2, yb - h, w, h);
      glowRadial(c, x + lerp(4, 60, e), yb - h + w, 0, lerp(6, 90, e), '255,200,130', 0.8);
    }
    c.restore();
    // fluorescent tube
    const on = has(sc, 'flicker') ? (hash(lt * 13 + 1) < 0.25 ? 0.12 : 1) : 1;
    c.fillStyle = 'rgba(225,240,255,' + (0.4 + 0.6 * on) + ')'; c.fillRect(470, 300, 140, 12);
    glowRadial(c, 540, 310, 0, 420, '170,200,235', 0.16 * on);
    // passing streetlight through the side windows + moving floor shadows of the living
    const P = busPass(sc, lt);
    if (P.on) {
      M.wins.forEach((w) => {
        const a = 0.65 * Math.exp(-Math.pow(w.d - P.center, 2) / 0.008);
        if (a < 0.01) return;
        c.fillStyle = 'rgba(255,190,110,' + a + ')';
        c.beginPath(); w.q.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill();
      });
      M.pass.forEach((p) => {
        const near = Math.exp(-Math.pow(p.d - P.center, 2) / 0.03);
        c.save(); c.globalAlpha = 0.25 + 0.6 * near;
        c.translate(p.x, p.y); c.transform(1, 0, (p.d - P.center) * 3, 0.22, 0, 0);
        c.fillStyle = '#000'; c.beginPath(); c.ellipse(0, -200 * p.k, 60 * p.k, 220 * p.k, 0, 0, 7); c.fill();
        c.restore();
      });
      const fa = 0.18 * Math.exp(-Math.pow(P.center - 0.5, 2) / 0.4);
      const d0 = clamp(P.center - 0.08), d1 = clamp(P.center + 0.08);
      c.fillStyle = 'rgba(255,190,110,' + fa + ')';
      c.beginPath(); c.moveTo(M.inner(-1, d0), M.floorY(d0)); c.lineTo(M.inner(1, d0), M.floorY(d0));
      c.lineTo(M.inner(1, d1), M.floorY(d1)); c.lineTo(M.inner(-1, d1), M.floorY(d1)); c.fill();
    }
  }

  function drawDriver(c, lt, T) {
    const sway = Math.sin(lt * 0.8) * 6;
    c.save(); c.translate(720 + sway * 0.3, 0);
    // steering wheel sits at chest height in front of the driver; only its sides show
    c.strokeStyle = '#06070a'; c.lineWidth = 18;
    c.beginPath(); c.ellipse(-20, 1225, 250, 50, -0.05, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(' + T.fog + ',0.22)'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(-20, 1218, 254, 52, -0.05, Math.PI * 0.95, Math.PI * 2.05); c.stroke();
    c.shadowColor = T.rim; c.shadowBlur = 26;
    c.strokeStyle = '#000'; c.lineCap = 'round'; c.lineWidth = 34;
    const steer = Math.sin(lt * 0.9) * 10;
    c.beginPath(); c.moveTo(-150, 1260); c.lineTo(-240, 1225 + steer); c.stroke();
    c.beginPath(); c.moveTo(150, 1260); c.lineTo(200, 1220 - steer); c.stroke();
    c.fillStyle = '#000';
    c.beginPath(); c.moveTo(-175, 1360); c.quadraticCurveTo(-165, 1225, -60, 1208); c.lineTo(60, 1208); c.quadraticCurveTo(165, 1225, 175, 1360); c.closePath(); c.fill();
    c.fillRect(-30, 1150, 60, 70);
    c.beginPath(); c.ellipse(sway * 0.5, 1105, 64, 76, 0, 0, 7); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#0c0e13'; c.beginPath(); c.roundRect(-200, 1300, 400, 700, 40); c.fill();
    c.fillStyle = 'rgba(' + T.fog + ',0.12)'; c.fillRect(-180, 1302, 360, 5);
    c.restore();
  }

  // ---------- characters ----------
  function limb(c, x, y, a, len, w) {
    c.lineWidth = w; c.beginPath(); c.moveTo(x, y);
    const x2 = x + Math.sin(a) * len, y2 = y + Math.cos(a) * len;
    c.lineTo(x2, y2); c.stroke();
    return [x2, y2];
  }

  function person(c, ch, k, T) {
    const { lt, mv } = k;
    const act = ch.action || 'idle';
    const moving = (act === 'walk' || act === 'run') && ch.to != null;
    const ph = lt * (act === 'run' ? 13 : 7);
    const sw = moving ? Math.sin(ph) * (act === 'run' ? 0.6 : 0.35) : 0;
    const bob = moving ? -Math.abs(Math.sin(ph)) * (act === 'run' ? 16 : 9) : Math.sin(lt * 2) * 3;
    const col = ch.color || ACC;
    c.translate(0, bob);
    if (act === 'tremble') c.translate((k.R() - 0.5) * 7, 0);
    c.shadowColor = T.rim; c.shadowBlur = 30;
    c.strokeStyle = c.fillStyle = '#000'; c.lineCap = 'round';
    limb(c, -20, -195, sw, 195, 36); limb(c, 20, -195, -sw, 195, 36);
    c.beginPath();
    c.moveTo(-64, -398); c.quadraticCurveTo(0, -418, 64, -398);
    c.lineTo(56, -180); c.quadraticCurveTo(0, -168, -56, -180); c.closePath(); c.fill();
    c.fillRect(-16, -430, 32, 40);
    const lightArm = ch.accessory === 'flashlight';
    limb(c, -58, -385, -sw * 0.9, 190, 27);
    const conductor = ch.role === 'conductor';
    const hand = lightArm ? limb(c, 58, -385, 1.35, 175, 27)
      : conductor && !moving ? limb(c, 58, -385, 0.6 + Math.sin(lt * 1.5) * 0.05, 165, 27)
      : limb(c, 58, -385, sw * 0.9, 190, 27);
    const headTurn = act === 'look' ? Math.sin(lt * 1.4) * 10 : 0;
    c.beginPath(); c.arc(headTurn, -464, 52, 0, 7); c.fill();
    if (ch.hair === 'long') {
      c.beginPath(); c.moveTo(-50, -480); c.quadraticCurveTo(-78, -380, -60, -310); c.lineTo(-10, -330); c.lineTo(-12, -470); c.fill();
    }
    c.shadowBlur = 0;
    c.fillStyle = col; c.strokeStyle = col;
    const a = ch.accessory;
    if (a === 'scarf') {
      c.fillRect(-48, -428, 96, 28);
      c.lineWidth = 22; c.beginPath(); c.moveTo(-30, -412);
      c.quadraticCurveTo(-100, -398 + Math.sin(lt * 6) * 14, -150, -372 + Math.sin(lt * 6 + 1.2) * 22); c.stroke();
    } else if (a === 'bag') {
      c.lineWidth = 6; c.beginPath(); c.moveTo(-50, -395); c.lineTo(48, -250); c.stroke();
      c.fillRect(30, -275, 62, 78);
    } else if (a === 'cap') {
      c.beginPath(); c.arc(headTurn, -472, 54, Math.PI, 0); c.fill(); c.fillRect(headTurn, -478, 84, 14);
    } else if (a === 'lantern') {
      c.fillRect(hand[0] - 16, hand[1], 32, 44);
      c.globalCompositeOperation = 'screen';
      glowRadial(c, hand[0], hand[1] + 22, 6, 240, '255,190,110', 0.55 * (0.85 + 0.15 * Math.sin(lt * 9)));
      c.globalCompositeOperation = 'source-over';
    } else if (a === 'flashlight') {
      c.fillRect(hand[0] - 6, hand[1] - 12, 44, 24);
      const on = ch.flicker ? (hash(lt * 11 + 5) < 0.3 ? 0.15 : 1) : 1;
      c.globalCompositeOperation = 'screen';
      const g = c.createLinearGradient(hand[0], 0, hand[0] + 950, 0);
      g.addColorStop(0, 'rgba(255,245,210,' + 0.45 * on + ')'); g.addColorStop(1, 'rgba(255,245,210,0)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(hand[0] + 36, hand[1] - 10); c.lineTo(hand[0] + 950, hand[1] - 330); c.lineTo(hand[0] + 950, hand[1] + 380); c.lineTo(hand[0] + 36, hand[1] + 10); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    if (conductor) drawConductorKit(c, ch, lt, headTurn, hand, col);
    void mv;
  }

  // Bus conductor (kondektur): uniform shirt, peaked cap, towel on the shoulder,
  // crossbody money bag and a fan of banknotes in hand — readable even as a silhouette.
  function drawConductorKit(c, ch, lt, hx, hand, col) {
    c.fillStyle = '#1c2840';
    c.beginPath();
    c.moveTo(-60, -396); c.quadraticCurveTo(0, -414, 60, -396);
    c.lineTo(54, -200); c.quadraticCurveTo(0, -190, -54, -200); c.closePath(); c.fill();
    c.strokeStyle = '#c9cfdc'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(-26, -404); c.lineTo(0, -366); c.lineTo(26, -404); c.stroke();
    c.fillStyle = '#c9cfdc';
    for (let y = -350; y < -210; y += 34) { c.beginPath(); c.arc(0, y, 4, 0, 7); c.fill(); }
    c.strokeStyle = '#3a4a6a'; c.lineWidth = 4; c.strokeRect(14, -350, 30, 30);
    c.fillStyle = '#e7e2d3'; c.fillRect(20, -362, 5, 18);
    c.fillStyle = '#d8b04a'; c.fillRect(-46, -398, 26, 9); c.fillRect(20, -398, 26, 9);
    // towel over the left shoulder
    const ts = Math.sin(lt * 2.4) * 4;
    c.fillStyle = '#ddd6c4';
    c.beginPath(); c.moveTo(-64, -402); c.lineTo(-30, -404); c.lineTo(-34 + ts, -300); c.lineTo(-58 + ts, -296); c.closePath(); c.fill();
    c.fillStyle = col; c.fillRect(-56 + ts, -318, 22, 8);
    // crossbody money bag
    c.strokeStyle = '#3b2716'; c.lineWidth = 9;
    c.beginPath(); c.moveTo(48, -398); c.lineTo(-40, -228); c.stroke();
    c.fillStyle = '#6e4a2a'; c.beginPath(); c.roundRect(-86, -250, 92, 70, 10); c.fill();
    c.fillStyle = '#5a3a1f'; c.beginPath(); c.roundRect(-86, -250, 92, 28, 8); c.fill();
    c.fillStyle = '#d8b04a'; c.fillRect(-44, -230, 10, 10);
    // peaked cap with colored band
    c.fillStyle = '#16203a';
    c.beginPath(); c.ellipse(hx + 2, -500, 60, 26, 0, Math.PI, 0); c.fill();
    c.fillRect(hx - 54, -502, 112, 20);
    c.fillStyle = col; c.fillRect(hx - 54, -490, 112, 9);
    c.fillStyle = '#000'; c.beginPath(); c.ellipse(hx + 46, -480, 46, 10, 0.08, 0, 7); c.fill();
    c.fillStyle = '#d8b04a'; c.beginPath(); c.arc(hx + 10, -508, 7, 0, 7); c.fill();
    // fan of banknotes in the raised hand
    if (hand) {
      ['#9db48a', '#c9a46a', '#8fa6c4', '#9db48a'].forEach((nc, i) => {
        c.save(); c.translate(hand[0], hand[1]); c.rotate(-0.9 + i * 0.28);
        c.fillStyle = nc; c.fillRect(0, -8, 70, 32);
        c.strokeStyle = 'rgba(40,40,30,0.5)'; c.lineWidth = 2; c.strokeRect(5, -4, 60, 24);
        c.restore();
      });
      c.fillStyle = '#000'; c.beginPath(); c.arc(hand[0], hand[1], 16, 0, 7); c.fill();
    }
  }

  // Kuntilanak: floating, no feet, tattered see-through gown, wet hair hanging over a
  // gaunt tilted face, long pale arms with claw fingers. Origin = where feet would be.
  function ghost(c, ch, k, T) {
    if (ch.pose === 'back') return kuntiBack(c, ch, k, T);
    if (ch.pose === 'perch') return kuntiPerch(c, ch, k, T);
    const { lt, R } = k;
    const hr = rng(31);
    const flick = 0.82 + 0.18 * (R ? R() : 1);
    // `still`: no bobbing or skipping — a ghost that just stands there is scarier
    c.translate(0, ch.still ? -70 : -70 + Math.sin(lt * 1.6) * 16);
    if (!ch.still && R && R() < 0.06) c.translate((R() - 0.5) * 24, 0);       // occasional ghostly skip
    // cold aura
    c.globalCompositeOperation = 'screen';
    glowRadial(c, 0, -300, 30, 470, '190,215,200', 0.30 * flick);
    glowRadial(c, 0, -470, 10, 160, '220,235,225', 0.25 * flick);
    c.globalCompositeOperation = 'source-over';
    // trailing wisps where the legs should be
    c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x0 = -90 + i * 30, sw = Math.sin(lt * 2.2 + i * 1.7);
      const g = c.createLinearGradient(0, -40, 0, 170);
      g.addColorStop(0, 'rgba(215,222,210,0.35)'); g.addColorStop(1, 'rgba(215,222,210,0)');
      c.strokeStyle = g; c.lineWidth = 16 - (i % 3) * 3;
      c.beginPath(); c.moveTo(x0, -40); c.bezierCurveTo(x0 + sw * 30, 30, x0 - sw * 40, 90, x0 + sw * 20 - 20, 150 + (i % 3) * 25); c.stroke();
    }
    // gown: narrow shoulders, long body, ragged strips at the hem
    const gg = c.createLinearGradient(0, -420, 0, 40);
    gg.addColorStop(0, 'rgba(228,232,220,0.95)'); gg.addColorStop(0.55, 'rgba(205,212,200,0.78)'); gg.addColorStop(1, 'rgba(190,200,188,0.05)');
    c.fillStyle = gg;
    c.beginPath(); c.moveTo(-46, -410);
    c.bezierCurveTo(-70, -330, -96, -180, -118, -30);
    for (let i = 0; i <= 12; i++) {
      const x = -118 + i * (236 / 12) + Math.sin(lt * 2.4 + i) * 6;
      const y = (i % 2 ? -10 - (i % 3) * 14 : 30 + hr() * 70) + Math.sin(lt * 3.1 + i * 2) * 10;
      c.lineTo(x, y);
    }
    c.bezierCurveTo(96, -180, 70, -330, 46, -410); c.closePath(); c.fill();
    // cloth folds and grime
    c.strokeStyle = 'rgba(90,100,92,0.35)'; c.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const x = -60 + i * 24;
      c.beginPath(); c.moveTo(x * 0.5, -380); c.quadraticCurveTo(x + Math.sin(lt * 1.5 + i) * 8, -200, x * 1.4, -20); c.stroke();
    }
    c.fillStyle = 'rgba(70,75,62,0.18)';
    for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(-60 + hr() * 120, -300 + hr() * 260, 10 + hr() * 22, 16 + hr() * 30, 0, 0, 7); c.fill(); }
    // long arms, hanging slightly forward; `reach` raises them toward the viewer
    const reach = ch.reach ? 1 : 0;
    const armCol = '#cfd6c9';
    [-1, 1].forEach((s) => {
      // limb angle: 0 = straight down, positive swings toward +x
      const a = s * (0.1 + Math.sin(lt * 1.3 + s) * 0.04 + reach * 1.1);
      c.strokeStyle = armCol;
      const hand = limb(c, s * 44, -392, a, reach ? 210 : 270, 13);
      c.lineWidth = 4; c.strokeStyle = '#c4ccbf';
      for (let f = -2; f <= 2; f++) {
        c.beginPath(); c.moveTo(hand[0], hand[1]);
        c.quadraticCurveTo(hand[0] + f * 6, hand[1] + 30, hand[0] + f * 9 + s * 4, hand[1] + 52 + Math.abs(f) * -6); c.stroke();
      }
      c.fillStyle = '#1a1612';
      for (let f = -2; f <= 2; f++) { c.beginPath(); c.arc(hand[0] + f * 9 + s * 4, hand[1] + 52 - Math.abs(f) * 6, 3, 0, 7); c.fill(); }
    });
    // head tilted to one side
    c.save(); c.translate(0, -440); c.rotate(-0.16 + Math.sin(lt * 0.7) * 0.04);
    c.fillStyle = 'rgba(0,0,0,0.92)';
    c.beginPath(); c.ellipse(0, -10, 62, 74, 0, 0, 7); c.fill();                 // hair mass behind
    const fg = c.createRadialGradient(0, -20, 6, 0, 0, 60);
    fg.addColorStop(0, '#dde3d6'); fg.addColorStop(1, '#8e978a');
    c.fillStyle = fg; c.beginPath(); c.ellipse(0, -6, 38, 54, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(15,12,12,0.85)';
    c.beginPath(); c.ellipse(-14, -14, 11, 15, 0.2, 0, 7); c.ellipse(15, -12, 11, 15, -0.2, 0, 7); c.fill();
    c.fillStyle = 'rgba(25,15,15,0.8)'; c.beginPath(); c.ellipse(2, 26, 9, 14, 0, 0, 7); c.fill();
    if (ch.eyes !== false) {
      c.fillStyle = '#ff2a2a'; c.shadowColor = '#ff0000'; c.shadowBlur = 16;
      c.beginPath(); c.arc(15, -12, 3.5, 0, 7); c.fill(); c.shadowBlur = 0;
    }
    // wet hair: parted strands falling over the face and far down the back
    c.strokeStyle = '#030303'; c.lineCap = 'round';
    for (let i = 0; i < 40; i++) {
      const side = i % 2 ? 1 : -1;
      const over = i < 18;                                  // strands that cover the face
      const x0 = side * (4 + hr() * 30);
      const len = over ? 90 + hr() * 120 : 260 + hr() * 220;
      const spread = over ? side * (6 + hr() * 26) : side * (40 + hr() * 50);
      const sw = Math.sin(lt * 1.4 + i) * 10;
      c.lineWidth = over ? 3 + hr() * 5 : 5 + hr() * 9;
      c.beginPath(); c.moveTo(x0 * 0.3, -78);
      c.bezierCurveTo(x0 + side * 10, -40, spread + sw * 0.5, len * 0.5, spread * 1.1 + sw, len);
      c.stroke();
    }
    c.restore();
  }

  // Pocong: a body bound in a burial shroud — tied at the head, neck and ankles, the cloth
  // wrinkled, yellowed and soiled at the bottom. `faceStyle`: 'dark' (hollow + pale eyes,
  // default), 'rotten', or 'covered'. `lean` tilts it; it only hops with `action:'hop'` or `to`.
  function pocong(c, ch, k, T) {
    const { lt } = k;
    if (!ch.still && (ch.action === 'hop' || ch.to != null)) c.translate(0, -Math.abs(Math.sin(lt * 3.6)) * 46);
    c.rotate((ch.lean == null ? 0.03 : ch.lean) + Math.sin(lt * 1.1) * (ch.still ? 0.004 : 0.01));
    c.globalCompositeOperation = 'screen';
    glowRadial(c, 0, -300, 30, 400, '205,208,190', 0.18);
    c.globalCompositeOperation = 'source-over';
    const body = new Path2D();
    body.moveTo(-22, 0);
    body.quadraticCurveTo(-36, -30, -32, -70); body.quadraticCurveTo(-28, -94, -40, -122);
    body.bezierCurveTo(-72, -262, -80, -362, -64, -432); body.quadraticCurveTo(-58, -470, -44, -482);
    body.bezierCurveTo(-60, -522, -48, -578, 0, -588); body.bezierCurveTo(48, -578, 60, -522, 44, -482);
    body.quadraticCurveTo(58, -470, 64, -432); body.bezierCurveTo(80, -362, 72, -262, 40, -122);
    body.quadraticCurveTo(28, -94, 32, -70); body.quadraticCurveTo(36, -30, 22, 0); body.closePath();
    const g = c.createLinearGradient(-80, 0, 80, 0);
    g.addColorStop(0, '#76756a'); g.addColorStop(0.38, '#d5d2c2'); g.addColorStop(0.55, '#ebe8dc'); g.addColorStop(1, '#838175');
    c.fillStyle = g; c.fill(body);
    const hr = rng(19);
    c.save(); c.clip(body);
    const soil = c.createLinearGradient(0, 0, 0, -230);
    soil.addColorStop(0, 'rgba(62,48,30,0.65)'); soil.addColorStop(1, 'rgba(62,48,30,0)');
    c.fillStyle = soil; c.fillRect(-90, -230, 180, 230);
    c.fillStyle = 'rgba(150,130,70,0.10)'; c.fillRect(-90, -600, 180, 600);           // yellowed cloth
    for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(70,55,35,' + (0.08 + hr() * 0.14) + ')'; c.beginPath(); c.ellipse(-60 + hr() * 120, -40 - hr() * 380, 8 + hr() * 20, 12 + hr() * 30, hr(), 0, 7); c.fill(); }
    // irregular creases where the shroud was pulled and tied — partial, uneven, never a pattern
    for (let i = 0; i < 9; i++) {
      const y = -150 - hr() * 300, x0 = -85 + hr() * 60, x1 = x0 + 50 + hr() * 90, sag = 6 + hr() * 22, tilt = (hr() - 0.5) * 60;
      c.strokeStyle = 'rgba(60,58,50,' + (0.25 + hr() * 0.3) + ')'; c.lineWidth = 2 + hr() * 3;
      c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo((x0 + x1) / 2, y + sag, x1, y + tilt); c.stroke();
      c.strokeStyle = 'rgba(255,255,245,0.18)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x0, y - 4); c.quadraticCurveTo((x0 + x1) / 2, y + sag - 4, x1, y + tilt - 4); c.stroke();
    }
    // tension folds radiating from the neck and ankle ties
    c.strokeStyle = 'rgba(60,58,50,0.35)'; c.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      const a = -0.9 + i * 0.36;
      c.beginPath(); c.moveTo(Math.sin(a) * 30, -470); c.quadraticCurveTo(Math.sin(a) * 60, -440, Math.sin(a) * 75, -380 - hr() * 30); c.stroke();
      c.beginPath(); c.moveTo(Math.sin(a) * 26, -118); c.quadraticCurveTo(Math.sin(a) * 48, -150, Math.sin(a) * 62, -200 - hr() * 30); c.stroke();
    }
    c.strokeStyle = 'rgba(60,58,50,0.35)'; c.lineWidth = 3;
    [-30, 8, 34].forEach((x) => { c.beginPath(); c.moveTo(x * 0.6, -470); c.quadraticCurveTo(x * 1.3, -300, x, -130); c.stroke(); });
    c.globalCompositeOperation = 'screen';
    const rim = c.createLinearGradient(40, 0, 85, 0);
    rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(1, T ? T.rim : 'rgba(150,175,230,0.6)');
    c.fillStyle = rim; c.fillRect(-90, -600, 180, 600);
    c.restore();
    // ties at the ankles, neck and over the head, with frayed tails at the top knot
    c.strokeStyle = '#5e5a4c'; c.lineWidth = 8;
    [[-104, 46], [-478, 50]].forEach(([y, w]) => { c.beginPath(); c.moveTo(-w, y); c.quadraticCurveTo(0, y + 10, w, y); c.stroke(); });
    // the shroud gathered and tied above the head: a short, ragged tuft of cloth
    const tw = Math.sin(lt * 1.7) * 3;
    c.fillStyle = '#c9c6b5';
    c.beginPath(); c.moveTo(-12, -586);
    c.quadraticCurveTo(-26, -606, -24 + tw, -626); c.lineTo(-14 + tw, -616); c.lineTo(-8 + tw, -634);
    c.lineTo(0 + tw, -620); c.lineTo(9 + tw, -636); c.lineTo(14 + tw, -618); c.lineTo(24 + tw, -628);
    c.quadraticCurveTo(26, -604, 12, -586); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(60,58,50,0.4)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-6, -592); c.lineTo(-10 + tw, -620); c.moveTo(6, -592); c.lineTo(8 + tw, -624); c.stroke();
    c.fillStyle = '#5e5a4c'; c.beginPath(); c.ellipse(0, -588, 14, 7, 0, 0, 7); c.fill();
    // face opening
    const fs = ch.faceStyle || 'dark';
    if (fs !== 'covered') {
      c.fillStyle = '#120f0b'; c.beginPath(); c.ellipse(0, -526, 29, 37, 0, 0, 7); c.fill();
      if (fs === 'rotten') {
        const fg = c.createRadialGradient(0, -530, 4, 0, -526, 30);
        fg.addColorStop(0, '#5d5a45'); fg.addColorStop(1, '#22201a');
        c.fillStyle = fg; c.beginPath(); c.ellipse(0, -526, 23, 31, 0, 0, 7); c.fill();
        c.fillStyle = '#0a0806'; c.beginPath(); c.ellipse(0, -506, 8, 6, 0, 0, 7); c.fill();
      }
      c.fillStyle = '#ece8d6'; c.shadowColor = '#ffffff'; c.shadowBlur = 10;
      c.beginPath(); c.arc(-9, -532, fs === 'rotten' ? 5 : 3.5, 0, 7); c.arc(10, -531, fs === 'rotten' ? 5 : 3.5, 0, 7); c.fill();
      c.shadowBlur = 0;
    } else {
      c.fillStyle = 'rgba(40,38,30,0.25)'; c.beginPath(); c.ellipse(0, -526, 26, 34, 0, 0, 7); c.fill();
    }
  }

  function shadowFig(c, ch, k, T) {
    const { lt } = k;
    c.shadowColor = T.rim; c.shadowBlur = 34;
    c.strokeStyle = c.fillStyle = '#000'; c.lineCap = 'round';
    limb(c, -16, -330, 0.03, 330, 20); limb(c, 16, -330, -0.03, 330, 20);
    c.beginPath(); c.moveTo(-40, -660); c.lineTo(40, -660); c.lineTo(26, -310); c.lineTo(-26, -310); c.closePath(); c.fill();
    limb(c, -38, -650, 0.1 + Math.sin(lt * 0.9) * 0.05, 470, 13);
    limb(c, 38, -650, -0.1 - Math.sin(lt * 0.9 + 1) * 0.05, 470, 13);
    c.fillRect(-9, -700, 18, 50);
    c.beginPath(); c.ellipse(0, -735, 38, 54, 0, 0, 7); c.fill();
    c.shadowBlur = 0;
    if (ch.eyes !== false) {
      c.fillStyle = ch.color || '#ffffff'; c.shadowColor = ch.color || '#ffffff'; c.shadowBlur = 16;
      c.beginPath(); c.arc(-13, -740, 4.5, 0, 7); c.arc(13, -740, 4.5, 0, 7); c.fill(); c.shadowBlur = 0;
    }
  }

  function eyes(c, ch, k) {
    const { lt } = k;
    const blinkT = (lt + (ch.blinkOffset || 0)) % 3.2;
    const open = blinkT < 0.14 ? 0.08 : 1;
    const col = ch.color || '#ffd34d';
    c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 30;
    [-1, 1].forEach((s) => {
      c.save(); c.translate(s * 42, 0); c.scale(1, open);
      c.beginPath(); c.moveTo(-26, 0); c.quadraticCurveTo(0, -18, 26, s * 4); c.quadraticCurveTo(0, 16, -26, 0); c.fill();
      c.restore();
    });
    c.shadowBlur = 0;
    c.fillStyle = '#000';
    [-1, 1].forEach((s) => { c.beginPath(); c.ellipse(s * 42, 0, 4, 11 * open, 0, 0, 7); c.fill(); });
  }

  // Side view of a night bus, wheels on the baseline, facing right.
  function busSide(c, ch, k) {
    const { lt } = k;
    const moving = ch.to != null;
    c.translate(0, moving ? Math.sin(lt * 20) * 2 : 0);
    if (!ch.dark) {
      c.globalCompositeOperation = 'screen';
      const g = c.createLinearGradient(360, 0, 1100, 0);
      g.addColorStop(0, 'rgba(255,240,200,0.45)'); g.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(355, -95); c.lineTo(1100, -230); c.lineTo(1100, 40); c.lineTo(355, -70); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    c.fillStyle = '#05060a'; c.shadowColor = 'rgba(150,175,230,0.6)'; c.shadowBlur = 26;
    c.beginPath(); c.roundRect(-370, -320, 730, 285, 26); c.fill();
    c.shadowBlur = 0;
    const lit = ch.dark ? 'rgba(40,50,70,0.8)' : 'rgba(255,200,120,0.78)';
    for (let i = 0; i < 8; i++) {
      c.fillStyle = lit; c.fillRect(-335 + i * 78, -275, 66, 95);
      if (ch.passenger === i) { c.fillStyle = '#000'; c.beginPath(); c.arc(-302 + i * 78, -222, 15, 0, 7); c.fill(); c.fillRect(-322 + i * 78, -205, 40, 25); }
    }
    c.fillStyle = ch.dark ? 'rgba(40,50,70,0.8)' : 'rgba(255,215,150,0.6)';
    c.beginPath(); c.moveTo(300, -280); c.lineTo(345, -280); c.lineTo(355, -170); c.lineTo(300, -170); c.fill();
    c.fillStyle = '#000'; c.fillRect(230, -165, 60, 125);
    c.fillStyle = '#ff2a1a'; c.shadowColor = '#ff2a1a'; c.shadowBlur = 20; c.fillRect(-372, -120, 8, 36); c.shadowBlur = 0;
    c.fillStyle = '#fff3d0'; c.shadowColor = '#fff3d0'; c.shadowBlur = 24; c.fillRect(352, -100, 10, 26); c.shadowBlur = 0;
    [-230, 210].forEach((wx) => {
      c.fillStyle = '#000'; c.beginPath(); c.arc(wx, -32, 46, 0, 7); c.fill();
      c.strokeStyle = '#2a2e36'; c.lineWidth = 6; c.beginPath(); c.arc(wx, -32, 22, 0, 7); c.stroke();
      const a = moving ? lt * 9 : 0;
      c.beginPath(); c.moveTo(wx + Math.cos(a) * 22, -32 + Math.sin(a) * 22); c.lineTo(wx - Math.cos(a) * 22, -32 - Math.sin(a) * 22); c.stroke();
    });
  }

  // An old, stained banknote held up to the camera. Drawn centered on (x, y).
  function money(c, ch, k) {
    const { lt } = k;
    c.rotate(-0.07 + Math.sin(lt * 1.2) * 0.02);
    c.shadowColor = 'rgba(0,0,0,0.9)'; c.shadowBlur = 40;
    const g = c.createLinearGradient(-280, -140, 280, 140);
    g.addColorStop(0, '#bda77c'); g.addColorStop(0.5, '#a48d62'); g.addColorStop(1, '#7c6743');
    c.fillStyle = g; c.fillRect(-280, -140, 560, 280);
    c.shadowBlur = 0;
    c.strokeStyle = '#5b4a2e'; c.lineWidth = 6; c.strokeRect(-262, -122, 524, 244);
    c.lineWidth = 2; c.strokeRect(-250, -110, 500, 220);
    c.lineWidth = 4; c.beginPath(); c.ellipse(-150, 0, 70, 85, 0, 0, 7); c.stroke();
    c.fillStyle = 'rgba(70,55,30,0.55)';
    c.beginPath(); c.arc(-150, -22, 26, 0, 7); c.fill(); c.beginPath(); c.ellipse(-150, 40, 44, 30, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#4a3b22'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 84px Georgia, serif'; c.fillText(ch.value || '100', 150, -40);
    c.font = '700 30px Georgia, serif'; c.fillText(ch.label || 'RUPIAH', 120, 28);
    c.font = '600 26px Georgia, serif'; c.fillText(ch.year || 'TAHUN 1968', 120, 78);
    const sr = rng(5);
    for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(60,40,20,' + (0.08 + sr() * 0.12) + ')'; c.beginPath(); c.arc(-260 + sr() * 520, -130 + sr() * 260, 15 + sr() * 50, 0, 7); c.fill(); }
    c.strokeStyle = 'rgba(60,45,25,0.5)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-10, -140); c.lineTo(5, 140); c.stroke();
    c.textAlign = 'left';
  }

  // Angkot (minivan) side view facing right, wheels on the baseline. `color` = body paint.
  function angkotSide(c, ch, k) {
    const { lt } = k;
    const moving = ch.to != null;
    c.translate(0, moving ? Math.sin(lt * 22) * 2 : 0);
    if (!ch.dark) {
      c.globalCompositeOperation = 'screen';
      const g = c.createLinearGradient(250, 0, 900, 0);
      g.addColorStop(0, 'rgba(255,240,200,0.4)'); g.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(250, -80); c.lineTo(900, -190); c.lineTo(900, 30); c.lineTo(250, -60); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    const body = ch.color || '#1b5f99';
    c.shadowColor = 'rgba(150,175,230,0.5)'; c.shadowBlur = 22;
    c.fillStyle = body;
    c.beginPath(); c.moveTo(-260, -40); c.lineTo(-260, -300); c.quadraticCurveTo(-258, -318, -238, -320);
    c.lineTo(140, -320); c.lineTo(230, -200); c.lineTo(262, -180); c.lineTo(262, -40); c.closePath(); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(-260, -120, 522, 80);                 // dark lower half
    c.fillStyle = '#f2c230'; c.fillRect(-260, -132, 522, 12);                         // stripe
    const lit = ch.dark ? 'rgba(30,40,60,0.9)' : 'rgba(190,210,235,0.45)';
    c.fillStyle = lit;
    [-235, -150, -65].forEach((x) => c.fillRect(x, -295, 72, 92));
    c.fillStyle = '#040507'; c.fillRect(25, -295, 95, 255);                             // open sliding door
    if (ch.passenger != null) { c.fillStyle = '#000'; c.beginPath(); c.arc(-200, -238, 16, 0, 7); c.fill(); c.fillRect(-218, -222, 36, 20); }
    c.fillStyle = ch.dark ? 'rgba(30,40,60,0.9)' : 'rgba(210,220,235,0.5)';
    c.beginPath(); c.moveTo(140, -300); c.lineTo(215, -205); c.lineTo(140, -205); c.fill();
    c.fillStyle = '#000'; c.beginPath(); c.arc(175, -240, 13, 0, 7); c.fill();         // driver
    c.fillStyle = '#ff2a1a'; c.shadowColor = '#ff2a1a'; c.shadowBlur = 16; c.fillRect(-264, -110, 7, 28); c.shadowBlur = 0;
    c.fillStyle = '#fff3d0'; c.shadowColor = '#fff3d0'; c.shadowBlur = 20; c.fillRect(256, -100, 8, 22); c.shadowBlur = 0;
    c.fillStyle = '#e8e1c8'; c.font = '800 30px "Segoe UI", Arial, sans-serif'; c.textBaseline = 'middle';
    c.fillText(ch.label || 'T19', -230, -165);
    [-170, 175].forEach((wx) => {
      c.fillStyle = '#000'; c.beginPath(); c.arc(wx, -34, 36, 0, 7); c.fill();
      c.strokeStyle = '#2a2e36'; c.lineWidth = 5; c.beginPath(); c.arc(wx, -34, 16, 0, 7); c.stroke();
      const a = moving ? lt * 10 : 0;
      c.beginPath(); c.moveTo(wx + Math.cos(a) * 16, -34 + Math.sin(a) * 16); c.lineTo(wx - Math.cos(a) * 16, -34 - Math.sin(a) * 16); c.stroke();
    });
  }

  // ---------- ghost lab: Indonesian ghosts and partial apparitions ----------
  // Short outward strokes along a clockwise (on-screen) outline: shaggy fur, frayed cloth.
  function furEdge(c, pts, r, len, col, w) {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
      // hair hangs: bend each strand from the outline normal toward straight down
      let nx = dy / L, ny = -dx / L;
      nx *= 0.55; ny = ny * 0.55 + 0.85;
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      for (let j = 0, n = Math.ceil(L / 5); j < n; j++) {
        const px = x0 + dx * j / n, py = y0 + dy * j / n, l = len * (0.3 + r() * 1.1), a = (r() - 0.5) * 0.6;
        const ex = px + (nx * Math.cos(a) - ny * Math.sin(a)) * l, ey = py + (ny * Math.cos(a) + nx * Math.sin(a)) * l;
        c.moveTo(px, py);
        c.quadraticCurveTo(px + (ex - px) * 0.5 + (r() - 0.5) * 6, py + (ey - py) * 0.4, ex, ey);
      }
    }
    c.stroke();
  }
  const polyPath = (pts) => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };
  const cloth = (c, top, bottom) => {
    const g = c.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, 'rgba(228,232,220,0.95)'); g.addColorStop(0.6, 'rgba(205,212,200,0.75)'); g.addColorStop(1, 'rgba(190,200,188,0.05)');
    return g;
  };

  // Kuntilanak seen from behind: a curtain of wet hair down past the hips, arms hanging.
  function kuntiBack(c, ch, k) {
    const { lt } = k;
    const hr = rng(44);
    c.translate(0, ch.still === false ? -70 + Math.sin(lt * 1.6) * 14 : -70);
    c.globalCompositeOperation = 'screen'; glowRadial(c, 0, -300, 30, 460, '190,215,200', 0.26); c.globalCompositeOperation = 'source-over';
    c.fillStyle = cloth(c, -420, 40);
    c.beginPath(); c.moveTo(-50, -410); c.bezierCurveTo(-74, -330, -100, -180, -120, -30);
    for (let i = 0; i <= 12; i++) c.lineTo(-120 + i * 20 + Math.sin(lt * 2 + i) * 5, (i % 2 ? -12 : 26 + hr() * 60) + Math.sin(lt * 2.7 + i) * 8);
    c.bezierCurveTo(100, -180, 74, -330, 50, -410); c.closePath(); c.fill();
    c.strokeStyle = '#cfd6c9'; c.lineCap = 'round';
    [-1, 1].forEach((s) => {
      const h = limb(c, s * 52, -392, s * 0.07, 280, 12);
      c.lineWidth = 4;
      for (let f = -2; f <= 2; f++) { c.beginPath(); c.moveTo(h[0], h[1]); c.lineTo(h[0] + f * 7, h[1] + 46); c.stroke(); }
    });
    c.fillStyle = '#030303';
    c.beginPath(); c.moveTo(-46, -470); c.quadraticCurveTo(0, -540, 46, -470);
    c.quadraticCurveTo(80, -300, 70 + Math.sin(lt) * 6, -120); c.lineTo(-70 + Math.sin(lt + 1) * 6, -120); c.quadraticCurveTo(-80, -300, -46, -470); c.fill();
    c.strokeStyle = '#030303';
    for (let i = 0; i < 46; i++) {
      const x0 = (hr() - 0.5) * 120, end = -150 + hr() * 160, sw = Math.sin(lt * 1.3 + i) * 8;
      c.lineWidth = 3 + hr() * 7;
      c.beginPath(); c.moveTo(x0 * 0.5, -490); c.bezierCurveTo(x0, -380, x0 * 1.2 + sw * 0.4, -250, x0 * 1.15 + sw, end); c.stroke();
    }
  }

  // Kuntilanak sitting on a tree branch (origin = where she sits), bare feet dangling.
  // `branch: false` when the scene already has a branch there.
  function kuntiPerch(c, ch, k) {
    const { lt } = k;
    const hr = rng(52);
    if (ch.branch !== false) {
      c.strokeStyle = '#020203'; c.lineCap = 'round'; c.lineWidth = 34;
      c.beginPath(); c.moveTo(-460, 40); c.quadraticCurveTo(-100, -6, 400, 46); c.stroke();
      c.lineWidth = 10; c.beginPath(); c.moveTo(220, 28); c.lineTo(330, -60); c.moveTo(-280, 22); c.lineTo(-350, -50); c.stroke();
    }
    c.globalCompositeOperation = 'screen'; glowRadial(c, 0, -120, 30, 420, '190,215,200', 0.26); c.globalCompositeOperation = 'source-over';
    // dress draped over the branch
    c.fillStyle = cloth(c, -80, 280);
    c.beginPath(); c.moveTo(-50, -70); c.bezierCurveTo(-92, 0, -104, 120, -104, 230);
    for (let i = 0; i <= 10; i++) c.lineTo(-104 + i * 20.8 + Math.sin(lt * 2 + i) * 4, 230 + (i % 2 ? -14 : 18 + hr() * 30) + Math.sin(lt * 2.4 + i) * 6);
    c.bezierCurveTo(104, 120, 92, 0, 50, -70); c.closePath(); c.fill();
    const sw = Math.sin(lt * 1.4) * 12;
    c.strokeStyle = '#c9d1c3'; c.lineCap = 'round'; c.lineWidth = 13;
    [[-26, sw], [24, sw * 0.7]].forEach(([fx, s]) => {
      c.beginPath(); c.moveTo(fx, 220); c.lineTo(fx + s, 300); c.stroke();
      c.fillStyle = '#c9d1c3'; c.beginPath(); c.ellipse(fx + s + 6, 306, 14, 7, 0.2, 0, 7); c.fill();
    });
    c.fillStyle = 'rgba(226,230,218,0.95)';
    c.beginPath(); c.moveTo(-48, -60); c.lineTo(-40, -300); c.quadraticCurveTo(0, -318, 40, -300); c.lineTo(48, -60); c.closePath(); c.fill();
    c.strokeStyle = '#cfd6c9';
    limb(c, -42, -285, 0.18 + Math.sin(lt * 0.9) * 0.03, 250, 12);
    const h = limb(c, 42, -285, -0.55, 190, 12);
    c.lineWidth = 4; for (let f = -2; f <= 2; f++) { c.beginPath(); c.moveTo(h[0], h[1]); c.lineTo(h[0] + 10 + f * 3, h[1] + 30); c.stroke(); }
    c.save(); c.translate(0, -350); c.rotate(0.22 + Math.sin(lt * 0.6) * 0.03);
    c.fillStyle = '#cdd4c7'; c.beginPath(); c.ellipse(0, 0, 38, 48, 0, 0, 7); c.fill();
    c.fillStyle = '#030303'; c.beginPath(); c.ellipse(0, -12, 54, 60, 0, Math.PI, 0); c.fill();
    c.strokeStyle = '#030303';
    for (let i = 0; i < 38; i++) {
      const x0 = (hr() - 0.5) * 90, end = 120 + hr() * 300, s2 = Math.sin(lt * 1.1 + i) * 8;
      c.lineWidth = 3 + hr() * 6;
      c.beginPath(); c.moveTo(x0 * 0.4, -50); c.bezierCurveTo(x0, 20, x0 * 1.1 + s2 * 0.3, end * 0.6, x0 * 1.2 + s2, end); c.stroke();
    }
    if (ch.eyes !== false) { c.fillStyle = '#ff2a2a'; c.shadowColor = '#ff0000'; c.shadowBlur = 14; c.beginPath(); c.arc(12, 2, 3.5, 0, 7); c.fill(); c.shadowBlur = 0; }
    c.restore();
  }

  // Genderuwo: a huge, hunched, hairy silhouette with glowing red eyes and steaming breath.
  // Clockwise outline: small head sunk between huge shoulders, long arms hanging clear of
  // the body (hands at knee height), short thick legs.
  const GENDERUWO = [
    [-34, -770], [0, -802], [40, -786], [52, -740], [44, -712], [70, -705], [140, -690],
    [195, -640], [215, -560], [228, -460], [250, -350], [268, -250], [276, -190], [290, -160],
    [272, -126], [250, -140], [236, -170], [222, -260], [200, -380], [178, -470], [165, -380],
    [150, -260], [150, -170], [140, -90], [128, 0], [52, 0], [44, -120], [0, -150], [-44, -120],
    [-52, 0], [-128, 0], [-140, -90], [-150, -170], [-150, -260], [-165, -380], [-178, -470],
    [-200, -380], [-222, -260], [-236, -170], [-250, -140], [-272, -126], [-290, -160],
    [-276, -190], [-268, -250], [-250, -350], [-228, -460], [-215, -560], [-195, -640],
    [-140, -690], [-70, -705], [-44, -712], [-52, -740],
  ];
  const GENDERUWO_PATH = polyPath(GENDERUWO);
  function genderuwo(c, ch, k, T) {
    const { lt } = k;
    c.scale(1, 1 + Math.sin(lt * 1.8) * 0.008);                    // heavy breathing
    c.shadowColor = T ? T.rim : 'rgba(150,175,230,0.6)'; c.shadowBlur = 34;
    c.fillStyle = '#020202'; c.fill(GENDERUWO_PATH);
    c.shadowBlur = 0;
    furEdge(c, GENDERUWO, rng(23), 30, '#020202', 3.5);
    furEdge(c, GENDERUWO, rng(24), 18, '#020202', 2);
    c.globalCompositeOperation = 'screen';
    furEdge(c, GENDERUWO.slice(4, 14), rng(29), 22, 'rgba(120,140,180,0.16)', 1.6);
    c.globalCompositeOperation = 'source-over';
    const open = ((lt + 1.3) % 4.2) < 0.16 ? 0.1 : 1;
    c.fillStyle = '#ff2416'; c.shadowColor = '#ff1000'; c.shadowBlur = 26;
    c.beginPath(); c.ellipse(-12, -752, 9, 6 * open, -0.2, 0, 7); c.ellipse(20, -750, 9, 6 * open, 0.2, 0, 7); c.fill();
    c.shadowBlur = 0;
    const bp = (lt % 2.6) / 2.6;
    if (bp < 0.6) {
      c.globalCompositeOperation = 'screen';
      glowRadial(c, 30 + bp * 120, -722 - bp * 60, 4, 40 + bp * 90, '220,225,235', 0.22 * (1 - bp / 0.6));
      c.globalCompositeOperation = 'source-over';
    }
  }

  // Tuyul: a small bald child spirit — big head and ears, pot belly, hollow red eyes.
  function tuyul(c, ch, k, T) {
    const { lt } = k;
    const run = ch.to != null && !ch.still;
    const ph = lt * 14, sw = run ? Math.sin(ph) * 0.6 : 0;
    if (run) c.translate(0, -Math.abs(Math.sin(ph)) * 10);
    // grey, underfed, hunched forward; head tilted, sockets dark and empty but for a red pinpoint
    const skin = '#6f7a6f';
    c.rotate(run ? 0.12 : 0.06);
    c.shadowColor = T ? T.rim : 'rgba(150,175,230,0.6)'; c.shadowBlur = 22;
    c.strokeStyle = skin; c.lineCap = 'round';
    limb(c, -14, -95, sw - 0.1, 95, 13); limb(c, 14, -95, -sw + 0.1, 95, 13);
    const hl = limb(c, -30, -160, -sw * 0.8 - 0.1, 92, 9), hrr = limb(c, 30, -160, sw * 0.8 + 0.1, 92, 9);
    c.lineWidth = 3;
    [hl, hrr].forEach((h) => { for (let f = -1; f <= 1; f++) { c.beginPath(); c.moveTo(h[0], h[1]); c.lineTo(h[0] + f * 6, h[1] + 22); c.stroke(); } });
    const bg = c.createRadialGradient(-10, -130, 6, 0, -120, 55);
    bg.addColorStop(0, '#8a9488'); bg.addColorStop(1, '#3f483f');
    c.fillStyle = bg; c.beginPath(); c.ellipse(0, -122, 38, 48, 0, 0, 7); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(30,36,30,0.55)'; c.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-28, -150 + i * 10); c.quadraticCurveTo(0, -142 + i * 10, 28, -150 + i * 10); c.stroke(); }
    c.save(); c.translate(6, -212); c.rotate(-0.28 + Math.sin(lt * 0.8) * 0.06);
    c.fillStyle = skin;
    c.beginPath(); c.moveTo(-58, -8); c.lineTo(-86, -34); c.lineTo(-60, 14); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(58, -8); c.lineTo(86, -34); c.lineTo(60, 14); c.closePath(); c.fill();
    const hg = c.createRadialGradient(-18, -26, 8, 0, 0, 68);
    hg.addColorStop(0, '#99a396'); hg.addColorStop(1, '#3a423a');
    c.fillStyle = hg; c.beginPath(); c.ellipse(0, 0, 60, 66, 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(40,30,50,0.35)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-30, -50); c.quadraticCurveTo(-18, -30, -26, -12); c.moveTo(24, -54); c.quadraticCurveTo(34, -34, 22, -20); c.stroke();
    const sg = (ex) => { const g = c.createRadialGradient(ex, 6, 2, ex, 6, 24); g.addColorStop(0, '#000'); g.addColorStop(0.7, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)'); return g; };
    [-22, 22].forEach((ex) => { c.fillStyle = sg(ex); c.beginPath(); c.ellipse(ex, 6, 22, 24, 0, 0, 7); c.fill(); });
    c.fillStyle = '#ff2a1a'; c.shadowColor = '#ff1a00'; c.shadowBlur = 10;
    c.beginPath(); c.arc(-21, 8, 2.4, 0, 7); c.arc(23, 7, 2.4, 0, 7); c.fill(); c.shadowBlur = 0;
    c.fillStyle = '#0b0908'; c.beginPath(); c.ellipse(2, 40, 7, 10, 0, 0, 7); c.fill();
    c.restore();
  }

  // Suster ngesot: a nurse dragging herself along the floor toward the camera (+x),
  // face hidden by hair, one eye showing. Moves with `to`.
  function ngesot(c, ch, k, T) {
    const { lt } = k;
    const moving = ch.to != null && !ch.still;
    const ph = moving ? lt * 2.4 : lt * 0.5, reach = (Math.sin(ph) + 1) / 2;
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.beginPath(); c.ellipse(0, 0, 360, 22, 0, 0, 7); c.fill();
    c.strokeStyle = '#6f776d'; c.lineCap = 'round';
    c.lineWidth = 22; c.beginPath(); c.moveTo(-130, -26); c.quadraticCurveTo(-240, -14, -330, -10); c.stroke();
    c.lineWidth = 20; c.beginPath(); c.moveTo(-130, -40); c.quadraticCurveTo(-250, -36, -320, -30); c.stroke();
    c.shadowColor = T ? T.rim : 'rgba(150,175,230,0.6)'; c.shadowBlur = 20;
    const dg = c.createLinearGradient(0, -150, 0, 0);
    dg.addColorStop(0, '#b9b8ad'); dg.addColorStop(1, '#5d5c55');
    c.fillStyle = dg;
    c.fill(polyPath([[-230, -12], [-215, -58], [-120, -84], [20, -112], [130, -142], [165, -104], [140, -62], [20, -34], [-120, -10]]));
    c.shadowBlur = 0;
    const hr = rng(61);
    for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(70,60,45,' + (0.12 + hr() * 0.15) + ')'; c.beginPath(); c.ellipse(-180 + hr() * 300, -40 - hr() * 60, 10 + hr() * 20, 6 + hr() * 10, 0, 0, 7); c.fill(); }
    c.strokeStyle = '#c2c9bd'; c.lineWidth = 17;
    c.beginPath(); c.moveTo(140, -118); c.quadraticCurveTo(220 + reach * 40, -110, 290 + reach * 70, -6); c.stroke();
    c.beginPath(); c.moveTo(110, -104); c.quadraticCurveTo(170, -30, 230 - reach * 40, -6); c.stroke();
    c.lineWidth = 5;
    [[290 + reach * 70, -6], [230 - reach * 40, -6]].forEach(([hx, hy]) => { for (let f = 0; f < 4; f++) { c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + 26 + f * 2, hy - 2 + f * 3); c.stroke(); } });
    c.save(); c.translate(205, -160); c.rotate(0.35);
    c.fillStyle = '#c5ccc0'; c.beginPath(); c.ellipse(0, 0, 46, 54, 0, 0, 7); c.fill();
    c.fillStyle = '#e8e6dc'; c.beginPath(); c.moveTo(-34, -30); c.lineTo(30, -40); c.lineTo(22, -62); c.lineTo(-28, -54); c.closePath(); c.fill();
    c.strokeStyle = ACC; c.lineWidth = 4; c.beginPath(); c.moveTo(-4, -56); c.lineTo(-2, -42); c.moveTo(-10, -49); c.lineTo(5, -50); c.stroke();
    // hair falls forward off the bowed head and spreads on the floor in front of her
    c.strokeStyle = '#030303';
    for (let i = 0; i < 34; i++) {
      const a = -0.9 + hr() * 1.3, sw = Math.sin(lt * 1.2 + i) * 4, len = 70 + hr() * 70;
      const x0 = Math.cos(a - 1.2) * 40, y0 = Math.sin(a - 1.2) * 40;
      c.lineWidth = 2.5 + hr() * 5;
      c.beginPath(); c.moveTo(x0, y0);
      c.quadraticCurveTo(x0 + Math.cos(a) * len * 0.6 + sw, y0 + Math.sin(a) * len * 0.6 + 30, x0 + Math.cos(a) * len + 30 + sw, 120 + hr() * 30);
      c.stroke();
    }
    c.fillStyle = '#e9e6d8'; c.beginPath(); c.arc(20, 6, 6, 0, 7); c.fill();
    c.fillStyle = '#ff2a1a'; c.beginPath(); c.arc(21, 7, 2.6, 0, 7); c.fill();
    c.restore();
  }

  // Banaspati: a floating ball of fire with a skull-like hollow face; lights its surroundings.
  function banaspati(c, ch, k) {
    const { lt } = k;
    c.translate(0, Math.sin(lt * 2.1) * 12);
    c.globalCompositeOperation = 'screen';
    glowRadial(c, 0, 0, 20, 560, '255,110,25', 0.38);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      const r = rng(i * 13 + 5), ph = lt * (3 + r() * 2.5) + i * 1.3;
      const a = -Math.PI / 2 + (r() - 0.5) * 1.5 + Math.sin(ph) * 0.18;
      const len = 150 + r() * 170 + Math.sin(ph * 1.7) * 45, w = 38 + r() * 42;
      const px = -Math.sin(a), py = Math.cos(a), tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const g = c.createRadialGradient(0, 0, 10, 0, 0, len);
      g.addColorStop(0, 'rgba(255,235,160,0.55)'); g.addColorStop(0.45, 'rgba(255,140,35,0.4)'); g.addColorStop(1, 'rgba(190,30,0,0)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(px * w, py * w);
      c.quadraticCurveTo(tx * 0.5 + px * w * 0.8 + Math.sin(ph * 2) * 12, ty * 0.5 + py * w * 0.8, tx, ty);
      c.quadraticCurveTo(tx * 0.5 - px * w * 0.8, ty * 0.5 - py * w * 0.8 + Math.cos(ph * 2) * 12, -px * w, -py * w);
      c.closePath(); c.fill();
    }
    const core = c.createRadialGradient(0, 0, 8, 0, 0, 120);
    core.addColorStop(0, 'rgba(255,248,210,1)'); core.addColorStop(0.5, 'rgba(255,175,50,0.85)'); core.addColorStop(1, 'rgba(255,80,10,0)');
    c.fillStyle = core; c.beginPath(); c.arc(0, 0, 120, 0, 7); c.fill();
    for (let i = 0; i < 22; i++) {
      const r = rng(i * 7 + 2), life = (lt * (0.6 + r() * 0.6) + r()) % 1;
      c.fillStyle = 'rgba(255,190,90,' + (1 - life) + ')';
      c.beginPath(); c.arc((r() - 0.5) * 160 + Math.sin(lt * 3 + i) * 20, -life * 420, 3 + r() * 3, 0, 7); c.fill();
    }
    // a face only half-formed in the flames: soft, uneven hollows that come and go
    c.globalCompositeOperation = 'source-over';
    const fa = 0.14 + 0.16 * (0.5 + 0.5 * Math.sin(lt * 1.3));
    const hole = (hx, hy, rx, ry) => {
      const g = c.createRadialGradient(hx, hy, 1, hx, hy, Math.max(rx, ry));
      g.addColorStop(0, 'rgba(60,8,0,' + fa + ')'); g.addColorStop(1, 'rgba(60,8,0,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(hx, hy, rx, ry, 0, 0, 7); c.fill();
    };
    if (ch.face) { hole(-30, -14, 22, 26); hole(34, -10, 20, 28); hole(2, 44, 26, 18); }
  }

  // A pale arm reaching out of the dark (from under a bed, a doorway, the frame edge).
  // Origin = where the arm emerges; `dir` = degrees (0 right, -90 up); grows over `reachTime`.
  function ghostHand(c, ch, k) {
    const { lt } = k;
    const q = ease(clamp((lt - (ch.in || 0)) / (ch.reachTime || 1.6)));
    const L = (ch.len || 420) * lerp(0.2, 1, q);
    c.rotate(((ch.dir == null ? -90 : ch.dir) * Math.PI) / 180);
    const g = c.createLinearGradient(0, 0, L, 0);
    g.addColorStop(0, 'rgba(10,12,10,1)'); g.addColorStop(0.45, '#97a093'); g.addColorStop(1, '#c6cec0');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, -30); c.quadraticCurveTo(L * 0.5, -22, L - 20, -16); c.lineTo(L - 20, 16); c.quadraticCurveTo(L * 0.5, 24, 0, 30); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(60,70,60,0.45)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(L * 0.45, -8); c.lineTo(L - 30, -6); c.moveTo(L * 0.5, 7); c.lineTo(L - 30, 5); c.stroke();
    c.fillStyle = '#c6cec0'; c.beginPath(); c.ellipse(L, 0, 40, 34, 0, 0, 7); c.fill();
    c.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const a = -0.8 + i * 0.38 + Math.sin(lt * 5 + i) * 0.05;
      const fl = i === 0 ? 55 : 90 - Math.abs(i - 2.5) * 9;
      const bx = L + Math.cos(a) * 30, by = Math.sin(a) * 30, tx = bx + Math.cos(a) * fl, ty = by + Math.sin(a) * fl;
      c.strokeStyle = '#c0c8ba'; c.lineWidth = i === 0 ? 13 : 10;
      c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + Math.cos(a + 0.35) * fl * 0.6, by + Math.sin(a + 0.35) * fl * 0.6, tx, ty); c.stroke();
      c.fillStyle = '#1a1410'; c.beginPath(); c.arc(tx, ty, 5, 0, 7); c.fill();
    }
  }

  // Long black hair hanging from the ceiling (origin = top anchor), with an upside-down
  // face at the end. `descend: true` lowers it over `descendTime`; `face: false` hides the face.
  function hangingHair(c, ch, k) {
    const { lt } = k;
    const q = ch.descend ? ease(clamp((lt - (ch.in || 0)) / (ch.descendTime || 2.5))) : 1;
    const len = (ch.len || 760) * lerp(0.08, 1, q);
    const hr = rng(57);
    c.fillStyle = '#030303';
    c.beginPath(); c.moveTo(-58, 0); c.quadraticCurveTo(-76, len * 0.5, -42 + Math.sin(lt) * 6, len);
    c.lineTo(42 + Math.sin(lt + 1) * 6, len); c.quadraticCurveTo(76, len * 0.5, 58, 0); c.closePath(); c.fill();
    c.strokeStyle = '#030303'; c.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const x0 = (hr() - 0.5) * 110, sw = Math.sin(lt * 1.2 + i) * 14 * hr(), end = len + hr() * 120;
      c.lineWidth = 2 + hr() * 6;
      c.beginPath(); c.moveTo(x0, 0); c.bezierCurveTo(x0 * 1.1, end * 0.4, x0 * 1.25 + sw * 0.5, end * 0.75, x0 * 1.2 + sw, end); c.stroke();
    }
    if (ch.face !== false && q > 0.85) {
      const fy = len - 30;
      const fg = c.createRadialGradient(0, fy, 4, 0, fy, 56);
      fg.addColorStop(0, '#d9dfd2'); fg.addColorStop(1, '#848d80');
      c.fillStyle = fg; c.beginPath(); c.ellipse(0, fy, 42, 54, 0, 0, 7); c.fill();
      c.fillStyle = '#0c0a09'; c.beginPath(); c.ellipse(-15, fy + 16, 11, 14, 0, 0, 7); c.ellipse(15, fy + 16, 11, 14, 0, 0, 7); c.fill();
      c.fillStyle = '#ff2a2a'; c.beginPath(); c.arc(-15, fy + 18, 2.6, 0, 7); c.arc(15, fy + 18, 2.6, 0, 7); c.fill();
      c.fillStyle = '#140c0a'; c.beginPath(); c.ellipse(0, fy - 28, 8, 13, 0, 0, 7); c.fill();
      c.strokeStyle = '#030303';
      for (let i = 0; i < 9; i++) { c.lineWidth = 3 + hr() * 3; const x0 = -40 + i * 10; c.beginPath(); c.moveTo(x0, fy - 60); c.quadraticCurveTo(x0 + 4, fy, x0 - 4, fy + 70); c.stroke(); }
    }
  }

  const CHARS = {
    person, ghost, pocong, shadow: shadowFig, eyes, bus: busSide, angkot: angkotSide, money,
    genderuwo, tuyul, ngesot, banaspati, hand: ghostHand, hair: hangingHair,
  };

  function busPass(sc, lt) {
    const every = sc.passEvery || 2.6;
    if (!(sc.bg === 'bus' || sc.bg === 'angkot') || sc.passEvery === 0) return { on: false, center: -1 };
    const k = (lt % every) / every;
    return { on: true, center: 1.25 - k * 1.6 };
  }

  function drawChar(c, ch, sc, lt, R, T) {
    const draw = CHARS[ch.type];
    if (!draw) throw new Error('unknown character type "' + ch.type + '" in scene ' + sc.i);
    const tin = ch.in || 0, tout = ch.out == null ? sc.dur : ch.out;
    if (lt < tin || lt > tout) return;
    const span = Math.max(0.001, tout - tin), pw = clamp((lt - tin) / span);
    let alpha = 1;
    const ap = ch.appear || 'cut';
    if (ap === 'fade') alpha = clamp((lt - tin) / 0.6) * clamp((tout - lt) / 0.6);
    else if (ap === 'flicker') alpha = lt - tin < 0.9 ? (R() < 0.45 + (lt - tin) * 0.5 ? 1 : 0) : 1;
    // `reveal`: only seen when the light allows — during lightning, or in a flickering lamp
    if (ch.reveal === 'lightning') alpha *= clamp(lightningLevel(sc, lt).lvl * 1.6);
    else if (ch.reveal === 'flicker') alpha *= hash(lt * 11 + X(ch.x) * 0.01) < 0.35 ? 1 : 0;
    if (alpha <= 0) return;
    let x = X(ch.x);
    if (ch.to != null) x = lerp(X(ch.x), X(ch.to), ch.action === 'approach' ? ease(pw) : pw);
    let y = ch.y != null ? ch.y : (ch.type === 'eyes' || ch.type === 'banaspati') ? 900 : ch.type === 'hair' ? 0 : GY;
    let s = (ch.size || 1) * (ch.type === 'eyes' ? 1.8 : 1);
    if (ch.action === 'approach') { const q = ease(pw); s *= lerp(1, ch.grow || 1.8, q); y += lerp(0, ch.type === 'eyes' ? 120 : 280, q); }
    const face = ch.face != null ? ch.face : (ch.to != null && X(ch.to) < X(ch.x) ? -1 : 1);
    // Passing streetlight in the bus throws a moving floor shadow — only for the living
    // (people), which is the point of scenes where the ghost casts none.
    if (sc.castShadows && ch.type === 'person') {
      const P = busPass(sc, lt);
      const lightX = P.on ? lerp(-1, 1, clamp(P.center)) : Math.sin(lt * 2.4);
      c.save();
      c.globalAlpha = alpha * 0.75;
      c.translate(x, y); c.transform(1, 0, -lightX * 1.4, 0.18, 0, 0);
      c.fillStyle = '#000';
      c.beginPath(); c.ellipse(0, -260 * s, 70 * s, 260 * s, 0, 0, 7); c.fill();
      c.restore();
    }
    const kk = { lt, R, pw };
    const place = (g, ox, oy, tf) => {
      g.save();
      if (ch.clip) { g.beginPath(); g.rect(ch.clip[0], ch.clip[1], ch.clip[2], ch.clip[3]); g.clip(); }
      g.translate(x + (ox || 0), y + (oy || 0));
      if (tf) g.transform(tf[0], tf[1], tf[2], tf[3], 0, 0);
      g.scale(s * face, s);
      draw(g, ch, kk, T);
      g.restore();
    };
    const baseA = alpha * (ch.alpha == null ? 1 : ch.alpha);
    // `cast`: its shadow thrown big on a wall by a lamp (skewed, blurred). `cast.only` = just the shadow.
    if (ch.cast) {
      const cs = ch.cast;
      // the lamp's pool of light on the wall, so the shadow has something to darken
      if (cs.light !== false) {
        const fl = 0.85 + 0.15 * Math.sin(lt * 9) * Math.sin(lt * 3.7);
        c.save(); c.globalCompositeOperation = 'screen';
        glowRadial(c, x + (cs.dx || 0), y + (cs.dy || 0) - 380 * s * (cs.sy || 1.6), 20, 760 * s * (cs.sy || 1.6), cs.lightColor || '255,180,100', 0.32 * fl);
        c.restore();
      }
      paintSilhouette(c, cs.color || '#000', baseA * (cs.alpha == null ? 0.75 : cs.alpha), cs.blur == null ? 6 : cs.blur,
        (g) => place(g, cs.dx, cs.dy, [cs.sx || 1.6, 0, cs.skew || 0, cs.sy || 1.6]));
      if (cs.only) return;
    }
    // `silhouette`: a flat dark shape, e.g. seen through a window or a curtain (pair with `blur`, `clip`)
    if (ch.silhouette) {
      paintSilhouette(c, ch.silhouette === true ? '#000' : ch.silhouette, baseA, ch.blur || 0, (g) => place(g));
      return;
    }
    c.save();
    c.globalAlpha = baseA;
    if (ch.blur) c.filter = 'blur(' + ch.blur * SC + 'px)';
    place(c);
    c.restore();
  }

  // Renders a character into an offscreen layer, flattens it to one color, then composites it.
  const stage = document.createElement('canvas'); stage.width = W; stage.height = H;
  const sctx = stage.getContext('2d');
  function paintSilhouette(c, color, alpha, blur, placeFn) {
    sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, W, H);
    sctx.setTransform(c.getTransform()); sctx.globalAlpha = 1;
    placeFn(sctx);
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = 'source-in'; sctx.fillStyle = color; sctx.fillRect(0, 0, W, H);
    sctx.globalCompositeOperation = 'source-over';
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = alpha;
    if (blur) c.filter = 'blur(' + blur * SC + 'px)';
    c.drawImage(stage, 0, 0); c.restore();
  }

  // ---------- effects ----------
  const fogCache = {};
  function fogTex(T) {
    if (fogCache[T.fog]) return fogCache[T.fog];
    const o = off(2160, 700), r = rng(4242);
    for (let i = 0; i < 70; i++) {
      const x = r() * 2160, y = 150 + r() * 400, rad = 90 + r() * 200, a = 0.04 + r() * 0.08;
      [x, x - 2160, x + 2160].forEach((xx) => {
        const g = o.x.createRadialGradient(xx, y, 0, xx, y, rad);
        g.addColorStop(0, 'rgba(' + T.fog + ',' + a + ')'); g.addColorStop(1, 'rgba(' + T.fog + ',0)');
        o.x.fillStyle = g; o.x.fillRect(xx - rad, y - rad, rad * 2, rad * 2);
      });
    }
    return (fogCache[T.fog] = o.c);
  }
  function fog(c, t, T, amt) {
    const tex = fogTex(T);
    [[GY - 520, 22, 0.8], [GY - 230, 45, 1]].forEach(([y, sp, a]) => {
      const ox = -((t * sp) % 2160);
      c.globalAlpha = a * amt;
      c.drawImage(tex, ox, y, 2160, 700); c.drawImage(tex, ox + 2160, y, 2160, 700);
    });
    c.globalAlpha = 1;
  }
  function rain(c, t) {
    c.strokeStyle = 'rgba(185,205,235,0.32)'; c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 170; i++) {
      const r = rng(i * 31 + 7);
      const x = r() * 1240 - 80, sp = 1700 + r() * 900;
      const y = ((r() * 2100 + t * sp) % 2100) - 100;
      c.moveTo(x, y); c.lineTo(x - 22, y + 70);
    }
    c.stroke();
  }
  function dust(c, t) {
    c.fillStyle = 'rgba(230,225,210,0.35)';
    for (let i = 0; i < 50; i++) {
      const r = rng(i * 17 + 3);
      const x = (r() * LW + Math.sin(t * 0.4 + i) * 40 + t * 12) % LW;
      const y = (r() * LH - t * (10 + r() * 15) + LH * 4) % LH;
      c.beginPath(); c.arc(x, y, 1.5 + r() * 2, 0, 7); c.fill();
    }
  }
  function lightningLevel(sc, lt) {
    let lvl = 0, bolt = null;
    (sc.lightning || []).forEach((at, j) => {
      const d = lt - at;
      if (d < 0 || d > 0.7) return;
      const a = d < 0.07 ? 0.9 : d < 0.13 ? 0.1 : d < 0.22 ? 0.7 : 0.7 * Math.exp(-(d - 0.22) * 9);
      lvl = Math.max(lvl, a);
      if (d < 0.28) bolt = j + sc.i * 13;
    });
    return { lvl, bolt };
  }
  function drawBolt(c, seed) {
    const r = rng(seed * 97 + 5);
    let x = 200 + r() * 680, y = 0;
    c.strokeStyle = 'rgba(240,245,255,0.95)'; c.lineWidth = 6; c.shadowColor = '#cfe0ff'; c.shadowBlur = 30;
    c.beginPath(); c.moveTo(x, y);
    while (y < 820) { x += (r() - 0.5) * 120; y += 50 + r() * 60; c.lineTo(x, y); }
    c.stroke(); c.shadowBlur = 0;
  }
  const grainTex = (function () {
    const out = [];
    for (let k = 0; k < 4; k++) {
      const w = Math.ceil(W / 2), h = Math.ceil(H / 2);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'), id = x.createImageData(w, h), r = rng(k * 1000 + 1);
      for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
      x.putImageData(id, 0, 0); out.push(c);
    }
    return out;
  })();

  function scareFace(c, q, R) {
    const z = lerp(0.85, 1.3, 1 - Math.pow(1 - clamp(q * 3), 3));
    c.save(); c.translate(540 + (R() - 0.5) * 50, 900 + (R() - 0.5) * 50); c.scale(z, z);
    c.rotate(-0.07);
    // long face, pale and sickly, darker toward the jaw
    const g = c.createRadialGradient(0, -120, 30, 0, 40, 440);
    g.addColorStop(0, '#d3d7c8'); g.addColorStop(0.6, '#8d9584'); g.addColorStop(1, '#2c312a');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, -430);
    c.bezierCurveTo(250, -430, 260, -80, 190, 160); c.bezierCurveTo(130, 380, 60, 470, 0, 470);
    c.bezierCurveTo(-60, 470, -130, 380, -190, 160); c.bezierCurveTo(-260, -80, -250, -430, 0, -430); c.fill();
    // sunken sockets: soft bruise, then a hard slanted hole
    [[-98, 1], [98, -1]].forEach(([ex, s]) => {
      const sg = c.createRadialGradient(ex, -90, 10, ex, -90, 150);
      sg.addColorStop(0, 'rgba(10,8,8,0.95)'); sg.addColorStop(0.5, 'rgba(30,25,25,0.55)'); sg.addColorStop(1, 'rgba(30,25,25,0)');
      c.fillStyle = sg; c.fillRect(ex - 150, -240, 300, 300);
      c.fillStyle = '#000';
      c.beginPath(); c.ellipse(ex, -88, 56, 74, s * 0.35, 0, 7); c.fill();
      c.strokeStyle = 'rgba(20,10,10,0.7)'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(ex - s * 10, -20); c.quadraticCurveTo(ex - s * 4, 60, ex - s * 16, 140); c.stroke();
    });
    c.fillStyle = '#f2f2e8'; c.shadowColor = '#fff'; c.shadowBlur = 14;
    c.beginPath(); c.arc(-90, -96, 5, 0, 7); c.arc(108, -78, 5, 0, 7); c.fill(); c.shadowBlur = 0;
    // stretched, ragged mouth
    const open = 0.75 + 0.25 * Math.sin(q * 24);
    c.fillStyle = '#060404';
    c.beginPath(); c.moveTo(-34, 110);
    for (let i = 0; i <= 8; i++) c.lineTo(-34 - (i % 2) * 10 - i * 2, 110 + i * 30 * open);
    c.quadraticCurveTo(0, 110 + 300 * open, 50, 110 + 240 * open);
    for (let i = 8; i >= 0; i--) c.lineTo(34 + (i % 2) * 10 + i * 2, 110 + i * 30 * open);
    c.quadraticCurveTo(0, 85, -34, 110); c.fill();
    // wet black hair falling over the face
    c.strokeStyle = '#040404'; c.lineCap = 'round';
    const hr = rng(77);
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1, x0 = side * (20 + hr() * 220), w = 8 + hr() * 18;
      c.lineWidth = w; c.beginPath(); c.moveTo(x0 * 0.4, -470);
      c.bezierCurveTo(x0, -300, x0 * 1.1 + side * 30, -60, x0 * 0.9 + side * (40 + hr() * 120), 200 + hr() * 420);
      c.stroke();
    }
    c.fillStyle = '#040404';
    c.beginPath(); c.ellipse(0, -430, 250, 110, 0, Math.PI, 0); c.fill();
    c.restore();
  }

  // ---------- text ----------
  function parseWords(str) {
    // *kata* or *beberapa kata* marks emphasis (accent color); the span may cross words.
    let open = false;
    return String(str).split(/\s+/).filter(Boolean).map((w) => {
      const starts = w.startsWith('*');
      const em = open || starts;
      const stars = (w.match(/\*/g) || []).length;
      if (stars % 2 === 1) open = !open;
      return { w: w.replace(/\*/g, ''), em };
    });
  }
  function layoutLines(c, words, maxW) {
    const lines = []; let line = [], lw = 0;
    const sp = c.measureText(' ').width;
    words.forEach((wd, i) => {
      const m = c.measureText(wd.w).width;
      if (line.length && lw + sp + m > maxW) { lines.push({ words: line, width: lw }); line = []; lw = 0; }
      line.push(Object.assign({ i, m }, wd)); lw += (line.length > 1 ? sp : 0) + m;
    });
    if (line.length) lines.push({ words: line, width: lw });
    return { lines, sp };
  }
  function caption(c, sc, lt) {
    if (!sc.caption) return;
    const words = parseWords(sc.caption);
    const start = sc.captionAt == null ? 0.25 : sc.captionAt;
    const rate = sc.captionSpeed || 3.2;
    const size = sc.captionSize || 66;
    c.font = '800 ' + size + 'px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    const { lines, sp } = layoutLines(c, words, 900);
    const lh = size * 1.25;
    const pos = sc.captionPos || 'bottom';
    const cy = pos === 'top' ? 360 : pos === 'center' ? 960 : 1620;
    let y = cy - (lines.length - 1) * lh / 2;
    c.textBaseline = 'middle'; c.lineJoin = 'round';
    lines.forEach((ln) => {
      let x = 540 - ln.width / 2;
      ln.words.forEach((wd) => {
        const a = clamp((lt - start - wd.i / rate) / 0.18);
        if (a > 0) {
          c.globalAlpha = a;
          const pop = 1 + (1 - a) * 0.12;
          c.save(); c.translate(x + wd.m / 2, y); c.scale(pop, pop);
          c.lineWidth = 12; c.strokeStyle = 'rgba(0,0,0,0.9)'; c.strokeText(wd.w, -wd.m / 2, 0);
          c.fillStyle = wd.em ? ACC : '#f3efe6';
          if (wd.em) { c.shadowColor = ACC; c.shadowBlur = 24; }
          c.fillText(wd.w, -wd.m / 2, 0); c.shadowBlur = 0;
          c.restore();
        }
        x += wd.m + sp;
      });
      y += lh;
    });
    c.globalAlpha = 1;
  }
  // Voice-over subtitles: cues on the global clock (seconds from video start), from an .srt.
  const SUBS = Array.isArray(S.subs) ? S.subs : [];
  function subtitles(c, t) {
    let cue = null;
    for (let i = 0; i < SUBS.length; i++) if (t >= SUBS[i].start && t < SUBS[i].end) { cue = SUBS[i]; break; }
    if (!cue) return;
    const a = 0.35 + 0.65 * clamp((t - cue.start) / 0.12);
    const words = parseWords(cue.text);
    let size = 64, lines, sp;
    do {
      c.font = '800 ' + size + 'px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
      ({ lines, sp } = layoutLines(c, words, 920));
      size -= 4;
    } while (lines.length > 2 && size > 40);
    size += 4;
    const lh = size * 1.25;
    let y = 1600 - (lines.length - 1) * lh / 2;
    const pop = 1 + (1 - clamp((t - cue.start) / 0.12)) * 0.06;
    c.save();
    c.globalAlpha = a; c.textAlign = 'left'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.translate(540, 1600); c.scale(pop, pop); c.translate(-540, -1600);
    lines.forEach((ln) => {
      let x = 540 - ln.width / 2;
      ln.words.forEach((wd) => {
        c.lineWidth = 12; c.strokeStyle = 'rgba(0,0,0,0.9)'; c.strokeText(wd.w, x, y);
        c.fillStyle = wd.em ? ACC : '#f3efe6';
        if (wd.em) { c.shadowColor = ACC; c.shadowBlur = 24; }
        c.fillText(wd.w, x, y); c.shadowBlur = 0;
        x += wd.m + sp;
      });
      y += lh;
    });
    c.restore();
  }
  function title(c, sc, lt, f) {
    if (!sc.title) return;
    const a = clamp(lt / 0.8) * (hash(f * 0.5 + 11) < 0.08 ? 0.35 : 1);
    c.save();
    c.globalAlpha = a;
    c.font = '700 116px Georgia, "Times New Roman", serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const words = parseWords(sc.title);
    const { lines } = layoutLines(c, words, 920);
    let y = 900 - (lines.length - 1) * 66;
    c.shadowColor = ACC; c.shadowBlur = 40; c.fillStyle = '#ece5d3';
    const j = hash(f * 0.25 + 3) < 0.12 ? (hash(f) - 0.5) * 14 : 0;
    lines.forEach((ln) => { c.fillText(ln.words.map((w) => w.w).join(' '), 540 + j, y); y += 132; });
    c.shadowBlur = 0;
    c.fillStyle = ACC; c.fillRect(540 - 120, y - 40, 240, 8);
    if (sc.subtitle) {
      c.font = '600 46px "Segoe UI", Arial, sans-serif'; c.fillStyle = '#cfc8b8';
      c.fillText(sc.subtitle.toUpperCase().split('').join(' '), 540, y + 40);
    }
    c.restore();
  }
  function chrome(c) {
    if (S.tag) {
      c.font = '800 38px "Segoe UI", Arial, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'left';
      const w = c.measureText(S.tag.toUpperCase()).width;
      c.fillStyle = ACC; c.fillRect(64, 120, 10, 56);
      c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(74, 120, w + 36, 56);
      c.fillStyle = '#f3efe6'; c.fillText(S.tag.toUpperCase(), 92, 149);
    }
    if (S.watermark) {
      c.font = '600 34px "Segoe UI", Arial, sans-serif'; c.textAlign = 'right'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(243,239,230,0.6)'; c.fillText(S.watermark, 1016, 149);
      c.textAlign = 'left';
    }
  }

  // ---------- frame ----------
  function draw(t, f) {
    const sc = sceneAt(t), lt = t - sc.start, p = clamp(lt / sc.dur);
    const T = toneOf(sc), R = rng(f * 7919 + 13);
    const scare = sc.scare && lt >= sc.scare.at && lt < sc.scare.at + (sc.scare.dur || 0.7) ? (lt - sc.scare.at) / (sc.scare.dur || 0.7) : -1;

    ctx.setTransform(SC, 0, 0, SC, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, LW, LH);

    // world (camera space)
    ctx.save();
    const cam = sc.camera || {};
    const zr = cam.zoom || [1, 1.06], pr = cam.pan || [0, 0];
    // `focus: [x, y]` (logical px) keeps that point centered while zooming, e.g. a mirror.
    const z = lerp(zr[0], zr[1], ease(p));
    let px = lerp(pr[0], pr[1], ease(p)) * LW, py = 0;
    if (cam.focus) { px = (cam.focus[0] - LW / 2) * z * ease(p); py = (cam.focus[1] - LH / 2) * z * ease(p); }
    let sx = 0, sy = 0;
    if (has(sc, 'shake')) { sx = (R() - 0.5) * 16; sy = (R() - 0.5) * 16; }
    if (sc.bg === 'bus' || sc.bg === 'busfront' || sc.bg === 'angkot') sy += Math.sin(lt * 23) * 2 + Math.sin(lt * 7.3) * 2;   // engine rumble
    ctx.translate(LW / 2 + sx - px, LH / 2 + sy - py); ctx.scale(z, z); ctx.translate(-LW / 2, -LH / 2);
    const bg = bgFor(sc);
    ctx.drawImage(bg.canvas, 0, 0, LW, LH);
    const L = lightningLevel(sc, lt);
    if (L.lvl > 0) {
      ctx.fillStyle = 'rgba(200,215,255,' + L.lvl * 0.55 + ')'; ctx.fillRect(0, 0, LW, LH);
      if (L.bolt != null) drawBolt(ctx, L.bolt);
    }
    bgDynamic(ctx, sc, bg.meta, lt, T);
    if (has(sc, 'fog')) fog(ctx, lt, T, sc.fogAmount == null ? 1 : sc.fogAmount);
    (sc.chars || []).forEach((ch) => drawChar(ctx, ch, sc, lt, R, T));
    if (has(sc, 'fog')) { ctx.globalAlpha = 0.5; fog(ctx, lt * 1.4 + 50, T, sc.fogAmount == null ? 1 : sc.fogAmount); ctx.globalAlpha = 1; }
    if (has(sc, 'rain')) rain(ctx, t);
    if (has(sc, 'dust')) dust(ctx, t);
    ctx.restore();

    // screen overlays
    if (has(sc, 'red')) { ctx.fillStyle = 'rgba(120,0,0,0.25)'; ctx.fillRect(0, 0, LW, LH); }
    if (has(sc, 'flicker') && hash(t * 12 + sc.i * 7) < 0.18) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, LW, LH); }
    if (L.lvl > 0) { ctx.fillStyle = 'rgba(230,235,255,' + L.lvl * 0.18 + ')'; ctx.fillRect(0, 0, LW, LH); }
    const beat = has(sc, 'heartbeat') ? Math.exp(-14 * (lt % 0.85)) + 0.7 * Math.exp(-14 * ((lt + 0.63) % 0.85)) : 0;
    const vg = ctx.createRadialGradient(540, 900, 380 - beat * 120, 540, 960, 1150 - beat * 160);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, beat > 0 ? 'rgba(40,0,0,0.92)' : 'rgba(0,0,0,0.88)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, LW, LH);
    const band = ctx.createLinearGradient(0, 1380, 0, LH);
    band.addColorStop(0, 'rgba(0,0,0,0)'); band.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = band; ctx.fillRect(0, 1380, LW, LH - 1380);

    if (scare >= 0) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, LW, LH);
      if ((sc.scare.type || 'face') === 'ghost') {
        ctx.save(); ctx.translate(540 + (R() - 0.5) * 40, 1900); const s = lerp(2.2, 3.6, scare); ctx.scale(s, s);
        ghost(ctx, { eyes: true }, { lt, R, pw: scare }, T); ctx.restore();
      } else scareFace(ctx, scare, R);
      if (scare < 0.15) { ctx.fillStyle = 'rgba(200,0,0,0.45)'; ctx.fillRect(0, 0, LW, LH); }
    }

    // grain
    ctx.globalAlpha = S.grain == null ? 0.07 : S.grain;
    ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(grainTex[f % 4], 0, 0, LW, LH);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

    // glitch (pixel space)
    const glitchOn = scare >= 0 || (has(sc, 'glitch') && hash(t * 15 + 99) < 0.22);
    if (glitchOn) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let k = 0; k < 7; k++) {
        const y = R() * H, h = (10 + R() * 60) * SC, dx = (R() - 0.5) * 90 * SC;
        ctx.drawImage(cv, 0, y, W, h, dx, y, W, h);
      }
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255,0,40,0.18)'; ctx.fillRect(0, R() * H, W, 30 * SC);
      ctx.globalCompositeOperation = 'source-over';
      ctx.setTransform(SC, 0, 0, SC, 0, 0);
    }

    if (scare < 0) {
      title(ctx, sc, lt, f);
      if (!S.hideCaptions) caption(ctx, sc, lt);
    }

    // scene fades
    const next = scenes[sc.i + 1];
    const fin = sc.cut ? 0 : (sc.fadeIn == null ? 0.35 : sc.fadeIn);
    const fout = next && next.cut ? 0 : (sc.fadeOut == null ? 0.35 : sc.fadeOut);
    let dark = 0;
    if (fin > 0 && lt < fin) dark = 1 - lt / fin;
    if (fout > 0 && sc.dur - lt < fout) dark = Math.max(dark, 1 - (sc.dur - lt) / fout);
    if (sc.i === 0 && lt < fin) dark = 1 - lt / fin;
    if (dark > 0) { ctx.fillStyle = 'rgba(0,0,0,' + dark + ')'; ctx.fillRect(0, 0, LW, LH); }

    // Drawn after scene fades: narration runs across cuts, so its text must not dip to black.
    if (scare < 0) subtitles(ctx, t);
    chrome(ctx);
  }

  window.__info = { W, H, FPS, TOTAL, frames: Math.ceil(TOTAL * FPS) };
  window.__frame = function (f, fmt) {
    draw(f / FPS, f);
    return fmt === 'png' ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.92);
  };
})();
