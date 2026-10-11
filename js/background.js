// ---------- drawing: background ----------
// One theme per stage: sky, moon, silhouette layers and ambient particles all change.
const THEMES = [
  { // 1 - the ruined gate: crimson moon over broken towers
    sky: ['#130b26', '#33163f', '#703048'], moon: { x: 700, y: 110, r: 40, c1: '#ff8a70', c2: '#a8141c', glow: '255,50,50' },
    ridge: ['#33193e', '#26122f'], far: '#1d1030', mid: '#10081c', tree: '#0d0716', ground: '#0a0512',
    mist: '150,60,100', fog: ['120,70,120', '150,60,90'], farKind: 'towers', midKind: 'ruins', trees: 1, ambient: null,
  },
  { // 2 - withered garden: sickly green dusk
    sky: ['#0a1a1c', '#1b4034', '#4f8052'], moon: { x: 250, y: 120, r: 34, c1: '#eef4b8', c2: '#8aa860', glow: '190,230,120' },
    ridge: ['#1f4536', '#183a2a'], far: '#12291f', mid: '#0b1b15', tree: '#08140f', ground: '#07120d',
    mist: '90,170,110', fog: ['80,150,100', '110,180,115'], farKind: 'forest', midKind: 'garden', trees: 1.3, ambient: 'fireflies',
  },
  { // 3 - bone cathedral: cold blue night, giant pale moon
    sky: ['#0a1030', '#1c2a60', '#4d6ca6'], moon: { x: 620, y: 130, r: 62, c1: '#eef4ff', c2: '#9ab0e0', glow: '160,190,255' },
    ridge: ['#253c6c', '#1b2e56'], far: '#151f42', mid: '#0c1230', tree: '#080c22', ground: '#070a1a',
    mist: '110,140,215', fog: ['110,130,205', '140,160,235'], farKind: 'spires', midKind: 'cathedral', trees: 0.4, ambient: 'dust',
  },
  { // 4 - ashen crypt: ember sky
    sky: ['#1a0a06', '#4e1e0c', '#b9561e'], moon: { x: 790, y: 140, r: 30, c1: '#ffdca8', c2: '#d06020', glow: '255,140,50' },
    ridge: ['#4e2210', '#3c190c'], far: '#2b1309', mid: '#1b0c06', tree: '#130904', ground: '#0e0603',
    mist: '225,115,50', fog: ['205,105,50', '235,135,60'], farKind: 'crypts', midKind: 'crypt', trees: 0.6, ambient: 'embers',
  },
  { // 5 - throne of shadows: black sun over a crimson void
    sky: ['#080008', '#2c0a22', '#80122f'], moon: { x: 600, y: 120, r: 56, eclipse: true, glow: '255,30,60' },
    ridge: ['#3b0d27', '#2b091d'], far: '#250819', mid: '#15040f', tree: '#0e030a', ground: '#0a0208',
    mist: '205,30,85', fog: ['175,40,95', '215,50,105'], farKind: 'shards', midKind: 'throne', trees: 0.3, ambient: 'motes',
  },
];
const theme = () => THEMES[clamp((stage || 1) - 1, 0, THEMES.length - 1)];
const bgCache = [];

function buildBG(th) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, th.sky[0]); sky.addColorStop(0.5, th.sky[1]); sky.addColorStop(1, th.sky[2]);
  x.fillStyle = sky; x.fillRect(0, 0, W, H);
  const r = seeded(7);
  for (let i = 0; i < 90; i++) {
    x.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.5})`;
    x.fillRect(r() * W, r() * 300, 1.4, 1.4);
  }
  const m = th.moon;
  let gr = x.createRadialGradient(m.x, m.y, m.r * 0.25, m.x, m.y, m.r * 3.8);
  gr.addColorStop(0, `rgba(${m.glow},0.45)`); gr.addColorStop(1, `rgba(${m.glow},0)`);
  x.fillStyle = gr; x.fillRect(m.x - m.r * 4, m.y - m.r * 4, m.r * 8, m.r * 8);
  if (m.eclipse) {
    x.fillStyle = '#000'; x.beginPath(); x.arc(m.x, m.y, m.r, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,60,80,0.9)'; x.lineWidth = 4; x.shadowColor = '#f02050'; x.shadowBlur = 24;
    x.beginPath(); x.arc(m.x, m.y, m.r + 2, 0, 7); x.stroke(); x.shadowBlur = 0;
  } else {
    gr = x.createRadialGradient(m.x - m.r * 0.2, m.y - m.r * 0.2, m.r * 0.1, m.x, m.y, m.r);
    gr.addColorStop(0, m.c1); gr.addColorStop(1, m.c2);
    x.fillStyle = gr; x.beginPath(); x.arc(m.x, m.y, m.r, 0, 7); x.fill();
    x.fillStyle = 'rgba(40,20,40,0.28)';
    [[-0.3, -0.15, 0.2], [0.25, 0.2, 0.25], [0.15, -0.4, 0.12]].forEach(([a, b, rr]) => { x.beginPath(); x.arc(m.x + a * m.r, m.y + b * m.r, rr * m.r, 0, 7); x.fill(); });
  }
  return c;
}
function ridge(parallax, base, amp, col, seed, step = 40) {
  const off = camX * parallax, first = Math.floor(off / step) - 1;
  g.fillStyle = col; g.beginPath(); g.moveTo(-10, H);
  for (let i = first; i < first + W / step + 4; i++) {
    const rr = seeded(seed + (((i % 997) + 997) % 997) * 31)();
    g.lineTo(i * step - off, base - rr * amp);
  }
  g.lineTo(W + 100, H); g.fill();
}
// calls fn(screenX, tileIndex) for every tile of a repeating layer that is on screen
function layer(px, period, fn) {
  const off = camX * px, first = Math.floor((off - 300) / period);
  for (let k = first; k <= first + Math.ceil((W + 600) / period); k++) fn(k * period - off, k);
}
const mod = (k, n) => ((k % n) + n) % n;

// ----- shapes -----
function tower(x, base, w, h, col, seed) {
  const r = seeded(seed);
  g.fillStyle = col;
  g.fillRect(x, base - h, w, h);
  g.beginPath(); g.moveTo(x, base - h);
  for (let i = 0; i <= 6; i++) g.lineTo(x + w * i / 6, base - h - (i % 2 ? 6 + r() * 16 : r() * 4));
  g.lineTo(x + w, base - h); g.fill();
  g.beginPath(); g.moveTo(x + w * 0.1, base - h); g.lineTo(x + w * 0.3, base - h - 50 - r() * 40); g.lineTo(x + w * 0.5, base - h); g.fill();
  g.fillStyle = 'rgba(255,90,40,0.55)';
  g.fillRect(x + w * 0.4, base - h * 0.7, 5, 11);
  g.fillRect(x + w * 0.65, base - h * 0.4, 5, 11);
  g.fillStyle = col;
}
function deadTree(x, base, s, col, seed) {
  const r = seeded(seed);
  g.strokeStyle = col; g.lineCap = 'round';
  function br(bx, by, a, len, wd, d) {
    if (d > 4) return;
    const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
    g.lineWidth = wd; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
    br(ex, ey, a - 0.2 - r() * 0.7, len * 0.75, wd * 0.65, d + 1);
    br(ex, ey, a + 0.2 + r() * 0.7, len * 0.75, wd * 0.65, d + 1);
  }
  br(x, base, -Math.PI / 2 + (r() - 0.5) * 0.3, 55 * s, 9 * s, 0);
}
function spruce(x, base, h, col) {
  g.fillStyle = col;
  for (let i = 0; i < 4; i++) {
    const y = base - h * (i / 4), w = h * 0.28 * (1 - i * 0.2);
    g.beginPath(); g.moveTo(x - w, y); g.lineTo(x, y - h * 0.38); g.lineTo(x + w, y); g.fill();
  }
  g.fillRect(x - 3, base - 8, 6, 8);
}
function gothicArch(x, base, w, h, th, col) {          // pointed arch opening between two pillars
  g.fillStyle = col; g.fillRect(x - 18, base - h, 36, h); g.fillRect(x + w - 18, base - h, 36, h);
  g.strokeStyle = col; g.lineWidth = 30; g.lineCap = 'butt';
  g.beginPath(); g.moveTo(x, base - h); g.quadraticCurveTo(x + w * 0.05, base - h - w * 0.62, x + w * 0.5, base - h - w * 0.72);
  g.quadraticCurveTo(x + w * 0.95, base - h - w * 0.62, x + w, base - h); g.stroke();
}
function gravestone(x, base, s, col, cross) {
  g.fillStyle = col;
  if (cross) { g.fillRect(x - 3 * s, base - 46 * s, 6 * s, 46 * s); g.fillRect(x - 14 * s, base - 36 * s, 28 * s, 6 * s); return; }
  g.beginPath(); g.moveTo(x - 12 * s, base); g.lineTo(x - 12 * s, base - 30 * s); g.arc(x, base - 30 * s, 12 * s, Math.PI, 0); g.lineTo(x + 12 * s, base); g.fill();
}
function torch(x, base, th) {
  g.fillStyle = th.mid; g.fillRect(x - 3, base - 70, 6, 70); g.fillRect(x - 9, base - 74, 18, 6);
  const f = 1 + Math.sin(time * 14 + x) * 0.15;
  const gr = g.createRadialGradient(x, base - 86, 0, x, base - 86, 70 * f);
  gr.addColorStop(0, 'rgba(255,170,60,0.55)'); gr.addColorStop(1, 'rgba(255,100,20,0)');
  g.fillStyle = gr; g.fillRect(x - 80, base - 160, 160, 160);
  g.fillStyle = '#ffb040'; g.beginPath(); g.ellipse(x, base - 86, 5 * f, 11 * f, 0, 0, 7); g.fill();
}

// ----- far layer (base 400) -----
const FAR = {
  towers(th) {
    layer(0.18, 1100, (x, k) => { tower(x + 100, 400, 50, 150, th.far, 11 + mod(k, 4)); tower(x + 360, 400, 38, 110, th.far, 17 + mod(k, 4)); });
  },
  forest(th) {
    layer(0.18, 900, (x, k) => { const r = seeded(30 + mod(k, 5)); for (let i = 0; i < 8; i++) spruce(x + i * 112 + r() * 40, 410, 130 + r() * 90, th.far); });
  },
  spires(th) {
    layer(0.18, 1000, (x, k) => {
      const r = seeded(40 + mod(k, 4));
      for (let i = 0; i < 3; i++) {
        const sx = x + i * 330 + r() * 80, h = 190 + r() * 100;
        g.fillStyle = th.far; g.fillRect(sx, 410 - h, 30, h);
        g.beginPath(); g.moveTo(sx - 6, 410 - h); g.lineTo(sx + 15, 410 - h - 90); g.lineTo(sx + 36, 410 - h); g.fill();
        g.fillStyle = 'rgba(160,190,255,0.5)'; g.beginPath(); g.moveTo(sx + 9, 410 - h * 0.6); g.lineTo(sx + 15, 410 - h * 0.6 - 18); g.lineTo(sx + 21, 410 - h * 0.6); g.fill();
        g.fillStyle = th.far; g.fillRect(sx + 30, 410 - 40, 140, 40);
      }
    });
  },
  crypts(th) {
    layer(0.18, 900, (x, k) => {
      const r = seeded(50 + mod(k, 4));
      for (let i = 0; i < 3; i++) {
        const sx = x + i * 300 + r() * 60, w = 90 + r() * 40, h = 70 + r() * 40;
        g.fillStyle = th.far; g.fillRect(sx, 410 - h, w, h);
        g.beginPath(); g.moveTo(sx - 8, 410 - h); g.lineTo(sx + w / 2, 410 - h - 36); g.lineTo(sx + w + 8, 410 - h); g.fill();
        g.fillRect(sx + w / 2 - 2, 410 - h - 60, 4, 26); g.fillRect(sx + w / 2 - 10, 410 - h - 52, 20, 4);
        g.fillStyle = 'rgba(255,120,40,0.45)'; g.fillRect(sx + w / 2 - 7, 410 - 36, 14, 36);
      }
    });
  },
  shards(th) {
    layer(0.18, 800, (x, k) => {
      const r = seeded(60 + mod(k, 4));
      for (let i = 0; i < 3; i++) {
        const sx = x + i * 270 + r() * 60, h = 120 + r() * 170, w = 26 + r() * 30, lean = (r() - 0.5) * 40;
        g.fillStyle = th.far; g.beginPath(); g.moveTo(sx, 410); g.lineTo(sx + lean + w / 2, 410 - h); g.lineTo(sx + w, 410); g.fill();
        g.strokeStyle = 'rgba(255,40,80,0.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx + w * 0.5, 410); g.lineTo(sx + lean + w / 2, 410 - h); g.stroke();
      }
    });
  },
};
// ----- mid layer (base GROUND + 10) -----
const MID = {
  ruins(th) {
    layer(0.4, 1300, (x, k) => {
      const b = x + 460;
      tower(b, GROUND + 10, 90, 240, th.mid, 40 + mod(k, 4));
      tower(b + 140, GROUND + 10, 60, 160, th.mid, 50 + mod(k, 4));
      g.fillStyle = th.mid; g.fillRect(b + 620, GROUND - 130, 26, 140); g.fillRect(b + 770, GROUND - 100, 26, 110);
      g.beginPath(); g.arc(b + 708, GROUND - 130, 62, Math.PI, Math.PI * 1.55); g.lineWidth = 22; g.strokeStyle = th.mid; g.stroke();
    });
  },
  garden(th) {
    layer(0.4, 900, (x, k) => {
      const r = seeded(70 + mod(k, 5));
      g.fillStyle = th.mid; g.fillRect(x, GROUND - 14, 900, 5); g.fillRect(x, GROUND - 52, 900, 4);   // iron fence rails
      for (let i = 0; i < 40; i++) {
        const bx = x + i * 22.5; g.fillRect(bx, GROUND - 62, 3, 62);
        g.beginPath(); g.moveTo(bx - 3, GROUND - 60); g.lineTo(bx + 1.5, GROUND - 76); g.lineTo(bx + 6, GROUND - 60); g.fill();
      }
      for (let i = 0; i < 4; i++) gravestone(x + 120 + i * 210 + r() * 60, GROUND + 8, 1.2 + r() * 0.5, th.mid, r() < 0.4);
      for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(x + 80 + i * 330 + r() * 80, GROUND + 6, 60, 26, 0, Math.PI, 0); g.fill(); }   // hedges
    });
  },
  cathedral(th) {
    layer(0.4, 760, (x, k) => {
      gothicArch(x + 60, GROUND + 10, 300, 300, th, th.mid);
      const gr = g.createLinearGradient(0, GROUND - 330, 0, GROUND - 120);
      gr.addColorStop(0, 'rgba(120,160,255,0.28)'); gr.addColorStop(1, 'rgba(120,160,255,0)');
      g.fillStyle = gr; g.fillRect(x + 90, GROUND - 330, 240, 200);
    });
  },
  crypt(th) {
    layer(0.4, 1000, (x, k) => {
      const b = x + 200, w = 190, h = 160;
      g.fillStyle = th.mid; g.fillRect(b, GROUND + 10 - h, w, h);
      g.beginPath(); g.moveTo(b - 14, GROUND + 10 - h); g.lineTo(b + w / 2, GROUND + 10 - h - 56); g.lineTo(b + w + 14, GROUND + 10 - h); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.9)'; g.beginPath(); g.moveTo(b + w / 2 - 28, GROUND + 10); g.lineTo(b + w / 2 - 28, GROUND - 64); g.arc(b + w / 2, GROUND - 64, 28, Math.PI, 0); g.lineTo(b + w / 2 + 28, GROUND + 10); g.fill();
      torch(b - 24, GROUND + 10, th); torch(b + w + 24, GROUND + 10, th);
      gravestone(b + w + 150, GROUND + 8, 1.3, th.mid, true); gravestone(b - 140, GROUND + 8, 1.2, th.mid, false);
    });
  },
  throne(th) {
    layer(0.4, 800, (x, k) => {
      const r = seeded(80 + mod(k, 4)), px = x + 200;
      const h = 220 + r() * 80;
      g.fillStyle = th.mid; g.beginPath(); g.moveTo(px - 34, GROUND + 10); g.lineTo(px - 18, GROUND - h); g.lineTo(px + 18, GROUND - h + 20); g.lineTo(px + 34, GROUND + 10); g.fill();
      g.strokeStyle = `rgba(255,40,80,${0.45 + 0.25 * Math.sin(time * 2 + k)})`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(px - 4, GROUND); g.lineTo(px + 6, GROUND - h * 0.45); g.lineTo(px - 6, GROUND - h * 0.7); g.stroke();
      const sy = GROUND - h - 70 + Math.sin(time * 1.2 + k * 2) * 10;     // floating shards
      g.fillStyle = th.mid; g.beginPath(); g.moveTo(px - 16, sy); g.lineTo(px, sy - 34); g.lineTo(px + 18, sy + 4); g.lineTo(px, sy + 24); g.fill();
    });
  },
};

function drawAmbient(th) {
  if (!th.ambient || settings.lowfx) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 36; i++) {
    const s = seeded(i * 13 + 5), sx = s(), sy = s(), sp = 0.4 + s();
    let x, y, col, r = 1.6;
    switch (th.ambient) {
      case 'fireflies': x = mod(sx * W + Math.sin(time * 0.5 * sp + i) * 40 - camX * 0.6, W); y = 260 + sy * 190 + Math.sin(time * sp + i * 3) * 18; col = `rgba(210,255,120,${0.35 + 0.5 * Math.abs(Math.sin(time * 1.3 * sp + i))})`; r = 2.4; break;
      case 'dust': x = mod(sx * W + time * 8 * sp - camX * 0.5, W); y = mod(sy * H + time * 10 * sp, H); col = 'rgba(180,200,255,0.3)'; break;
      case 'embers': x = mod(sx * W + Math.sin(time * sp + i) * 30 - camX * 0.5, W); y = H - mod(sy * H + time * 60 * sp, H); col = `rgba(255,${120 + sx * 80 | 0},40,0.7)`; r = 2; break;
      default: x = mod(sx * W - time * 14 * sp - camX * 0.5, W); y = mod(sy * H - time * 20 * sp, H); col = 'rgba(255,60,90,0.5)'; r = 1.8;
    }
    g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 8; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.restore();
}

function drawBG() {
  const th = theme(), idx = clamp((stage || 1) - 1, 0, THEMES.length - 1);
  g.drawImage(bgCache[idx] || (bgCache[idx] = buildBG(th)), 0, 0);
  ridge(0.05, 330, 90, th.ridge[0], 3, 60);
  ridge(0.1, 360, 80, th.ridge[1], 5, 50);
  FAR[th.farKind](th);
  const mg = g.createLinearGradient(0, 330, 0, 430);
  mg.addColorStop(0, `rgba(${th.mist},0)`); mg.addColorStop(1, `rgba(${th.mist},0.38)`);
  g.fillStyle = mg; g.fillRect(0, 330, W, 100);
  MID[th.midKind](th);
  for (let k = -2; k < 12; k++) {
    if (seeded(k * 7 + 3)() > th.trees * 0.75) continue;
    const x = k * 340 - camX * 0.5 + 100;
    deadTree(mod(x, 3400) - 200, GROUND + 6, 1 + seeded(k * 13 + 100)() * 0.7, th.tree, 70 + mod(k, 7));
  }
  drawAmbient(th);
}
function drawGround() {
  const th = theme();
  g.fillStyle = th.ground;
  g.beginPath(); g.moveTo(0, H);
  const step = 28, off = camX, first = Math.floor(off / step) - 1;
  for (let i = first; i < first + W / step + 3; i++) {
    const rr = seeded(mod(i, 997) * 97 + 5)();
    g.lineTo(i * step - off, GROUND + 4 + rr * 10);
    g.lineTo(i * step - off + step / 2, GROUND + 14 + rr * 4);
  }
  g.lineTo(W + 100, H); g.fill();
  g.fillRect(0, GROUND + 18, W, H);
  g.strokeStyle = th.ground; g.lineWidth = 2.2;
  for (let i = first; i < first + W / step + 3; i += 4) {
    const r = seeded(mod(i, 997) * 53 + 9);
    if (r() < 0.5) continue;
    const bx = i * step - off, by = GROUND + 8;
    for (let j = 0; j < 7; j++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.2, l = 14 + r() * 26;
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + Math.cos(a) * l * 0.5 + 6, by + Math.sin(a) * l * 0.6, bx + Math.cos(a) * l, by + Math.sin(a) * l); g.stroke();
    }
  }
}
function drawFog(front) {
  const th = theme();
  for (let i = 0; i < 6; i++) {
    const x = ((i * 260 - camX * (front ? 1.15 : 0.7) + time * (front ? 14 : 8)) % 1560 + 1560) % 1560 - 300;
    const y = GROUND + (front ? 18 : -6) + Math.sin(time * 0.6 + i) * 4;
    const gr = g.createRadialGradient(x, y, 0, x, y, 190);
    gr.addColorStop(0, `rgba(${th.fog[front ? 0 : 1]},${front ? 0.28 : 0.2})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.save(); g.translate(0, y); g.scale(1, 0.28); g.translate(0, -y); g.fillRect(x - 190, y - 190, 380, 380); g.restore();
  }
}
