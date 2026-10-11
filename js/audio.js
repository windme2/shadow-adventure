// ---------- audio ----------
// Noise + low-thump based SFX through a short reverb: heavier and grittier than plain oscillator beeps.
let actx = null, bus = null, nbuf = null, master = null;
function applySound() { if (master) master.gain.value = settings.sound ? 0.9 : 0; }
function audio() {
  if (actx) return actx;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  const comp = actx.createDynamicsCompressor(); comp.connect(actx.destination);
  master = actx.createGain(); master.gain.value = settings.sound ? 0.9 : 0; master.connect(comp);
  bus = actx.createGain(); bus.connect(master);
  const len = actx.sampleRate * 1.3, ir = actx.createBuffer(2, len, actx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  const conv = actx.createConvolver(); conv.buffer = ir;
  const wet = actx.createGain(); wet.gain.value = 0.25;
  bus.connect(conv); conv.connect(wet); wet.connect(master);
  nbuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
  const nd = nbuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return actx;
}
function env(gn, t, att, dur, vol) {
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.linearRampToValueAtTime(vol, t + att);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function noise({ dur = 0.2, f0 = 2000, f1 = 500, q = 1, vol = 0.2, type = 'bandpass', att = 0.004, delay = 0 }) {
  try {
    const a = audio(), t = a.currentTime + delay;
    const src = a.createBufferSource(); src.buffer = nbuf; src.loop = true;
    const f = a.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const gn = a.createGain(); env(gn, t, att, dur, vol);
    src.connect(f); f.connect(gn); gn.connect(bus);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  } catch (e) {}
}
function tone({ f0 = 100, f1 = 50, dur = 0.2, vol = 0.3, type = 'sine', att = 0.004, delay = 0, lp = 0 }) {
  try {
    const a = audio(), t = a.currentTime + delay;
    const o = a.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const gn = a.createGain(); env(gn, t, att, dur, vol);
    let out = o;
    if (lp) { const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); out = f; }
    out.connect(gn); gn.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  } catch (e) {}
}
const sfx = {
  slash(big) {
    const v = rnd(0.92, 1.08);
    noise({ dur: big ? 0.24 : 0.15, f0: 3600 * v, f1: big ? 380 : 800, q: 0.9, vol: big ? 0.2 : 0.15 });
    if (big) tone({ f0: 120, f1: 45, dur: 0.18, vol: 0.28 });
  },
  hit(crit) {
    tone({ f0: crit ? 170 : 140, f1: 50, dur: crit ? 0.2 : 0.13, vol: crit ? 0.5 : 0.34 });
    noise({ dur: 0.09, f0: 2200, f1: 300, type: 'lowpass', vol: 0.22 });
    if (crit) {
      tone({ f0: 1240, f1: 1200, dur: 0.4, vol: 0.05, delay: 0.01 });
      tone({ f0: 1870, f1: 1820, dur: 0.3, vol: 0.035, delay: 0.01 });
    }
  },
  vortex() {
    noise({ dur: 0.6, f0: 300, f1: 2600, q: 3, vol: 0.2 });
    noise({ dur: 0.5, f0: 2200, f1: 400, q: 2, vol: 0.14, delay: 0.25 });
    tone({ f0: 60, f1: 140, dur: 0.55, vol: 0.34 });
  },
  parry() {
    tone({ f0: 1320, f1: 1300, dur: 0.5, vol: 0.1, type: 'triangle' }); tone({ f0: 1980, f1: 1960, dur: 0.4, vol: 0.07, delay: 0.01 });
    tone({ f0: 2640, f1: 2600, dur: 0.3, vol: 0.04, delay: 0.01 }); noise({ dur: 0.12, f0: 4500, f1: 2500, type: 'highpass', vol: 0.28 });
    tone({ f0: 150, f1: 60, dur: 0.22, vol: 0.4 });
  },
  whiff() { noise({ dur: 0.1, f0: 1800, f1: 800, q: 1, vol: 0.05 }); },
  wave(l = 0) { tone({ f0: 95, f1: 32, dur: 0.55 + 0.5 * l, vol: 0.55 + 0.2 * l }); noise({ dur: 0.55 + 0.5 * l, f0: 1400, f1: 120, type: 'lowpass', vol: 0.3 + 0.15 * l }); },
  thrust(l = 0) {
    noise({ dur: 0.28 + 0.2 * l, f0: 5200, f1: 450, q: 0.8, vol: 0.24 });
    tone({ f0: 170, f1: 42, dur: 0.28 + 0.15 * l, vol: 0.45 });
    noise({ dur: 0.35, f0: 1500, f1: 100, type: 'lowpass', vol: 0.2 + 0.15 * l, delay: 0.04 });
  },
  chargeStart() { noise({ dur: 0.7, f0: 200, f1: 1800, q: 3, vol: 0.07 }); tone({ f0: 70, f1: 160, dur: 0.7, vol: 0.12 }); },
  chargeReady() { tone({ f0: 700, f1: 690, dur: 0.28, vol: 0.07, type: 'triangle' }); noise({ dur: 0.06, f0: 5000, f1: 3000, type: 'highpass', vol: 0.08 }); },
  dash() { noise({ dur: 0.18, f0: 1000, f1: 3800, q: 0.7, vol: 0.12 }); },
  jump() { noise({ dur: 0.09, f0: 350, f1: 900, q: 0.8, vol: 0.05 }); },
  pickup(kind) {
    if (kind === 'coin') { tone({ f0: 1760, f1: 1750, dur: 0.22, vol: 0.05 }); tone({ f0: 2637, f1: 2620, dur: 0.3, vol: 0.035, delay: 0.05 }); }
    else { tone({ f0: 330, f1: 495, dur: 0.35, vol: 0.12, type: 'triangle', lp: 1800 }); tone({ f0: 660, f1: 700, dur: 0.4, vol: 0.04, delay: 0.06 }); }
  },
  hurt() { tone({ f0: 110, f1: 38, dur: 0.3, vol: 0.55 }); noise({ dur: 0.28, f0: 1000, f1: 160, type: 'lowpass', vol: 0.32 }); },
  block() { tone({ f0: 920, f1: 900, dur: 0.35, vol: 0.07 }); tone({ f0: 1380, f1: 1360, dur: 0.3, vol: 0.05 }); noise({ dur: 0.07, f0: 4000, f1: 2000, type: 'highpass', vol: 0.12 }); },
  explode() { noise({ dur: 0.65, f0: 2000, f1: 70, type: 'lowpass', vol: 0.55 }); tone({ f0: 75, f1: 28, dur: 0.6, vol: 0.55 }); },
  boom() { tone({ f0: 80, f1: 26, dur: 0.5, vol: 0.6 }); noise({ dur: 0.4, f0: 900, f1: 80, type: 'lowpass', vol: 0.35 }); },
  bow() { noise({ dur: 0.09, f0: 2400, f1: 800, q: 1.5, vol: 0.12 }); tone({ f0: 220, f1: 130, dur: 0.12, vol: 0.1, type: 'triangle' }); },
  fuse() { noise({ dur: 0.55, f0: 5200, f1: 3000, q: 1.2, vol: 0.07 }); },
  volley() { noise({ dur: 0.3, f0: 800, f1: 180, q: 1.2, vol: 0.3 }); tone({ f0: 130, f1: 55, dur: 0.3, vol: 0.3 }); },
  bossSpawn() { tone({ f0: 52, f1: 36, dur: 1.4, vol: 0.55 }); noise({ dur: 1.3, f0: 500, f1: 90, type: 'lowpass', q: 2, vol: 0.4 }); tone({ f0: 74, f1: 70, dur: 1.2, vol: 0.12, type: 'sawtooth', lp: 400 }); },
  enrage() { noise({ dur: 1.1, f0: 600, f1: 130, type: 'lowpass', q: 5, vol: 0.45 }); tone({ f0: 58, f1: 95, dur: 1, vol: 0.2, type: 'sawtooth', lp: 500 }); },
  bossDown() { sfx.explode(); noise({ dur: 1.6, f0: 1400, f1: 60, type: 'lowpass', vol: 0.4, delay: 0.15 }); tone({ f0: 60, f1: 24, dur: 1.5, vol: 0.5, delay: 0.1 }); },
  wavestart() { tone({ f0: 98, f1: 92, dur: 0.9, vol: 0.14, type: 'sawtooth', lp: 500, att: 0.15 }); tone({ f0: 147, f1: 140, dur: 0.9, vol: 0.07, type: 'sawtooth', lp: 500, att: 0.15 }); },
  clear() { [196, 247, 294, 392].forEach((f, i) => tone({ f0: f, f1: f * 0.995, dur: 1.4, vol: 0.09, type: 'triangle', lp: 1600, delay: i * 0.18, att: 0.03 })); },
  start() { tone({ f0: 90, f1: 40, dur: 0.5, vol: 0.4 }); noise({ dur: 0.5, f0: 700, f1: 100, type: 'lowpass', vol: 0.2 }); },
};

