
/* ======================================================================
   CORE
   ====================================================================== */
const W = 960, H = 540, GROUND = 450;
const cv = document.getElementById('c');
const g0 = cv.getContext('2d');
let g = g0;                  // swapped to the shop-preview canvas while it is drawn

// ---------- helpers ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }


// ---------- settings ----------
const settings = { sound: true, lowfx: false, calm: false, vibrate: true, diff: 1, btnScale: 1, btnOp: 0.85, autoChecked: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem('skSettings') || '{}')); } catch (e) {}
function saveSettings() { try { localStorage.setItem('skSettings', JSON.stringify(settings)); } catch (e) {} }
function buzz(p) { if (settings.vibrate && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }
// "Low effects": neutralise canvas glow (shadowBlur) globally - by far the costliest effect on weak GPUs
const sbDesc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
Object.defineProperty(g0, 'shadowBlur', { get() { return sbDesc.get.call(g0); }, set(v) { sbDesc.set.call(g0, settings.lowfx ? 0 : v); }, configurable: true });


/* ======================================================================
   AUDIO
   ====================================================================== */
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



/* ======================================================================
   INPUT
   ====================================================================== */
// ---------- input ----------
const keys = {};
const queue = {};            // edge-triggered actions
const held = {};              // button name -> bool (from touch)
const pointers = new Map();   // id -> button name
const ACTIONS = ['jump', 'attack', 'skill1', 'skill2', 'dash', 'parry'];

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  KeyJ: 'attack', KeyZ: 'attack', KeyK: 'skill1', KeyX: 'skill1',
  KeyL: 'skill2', KeyC: 'skill2', ArrowDown: 'parry', KeyH: 'parry', ShiftLeft: 'dash', ShiftRight: 'dash', KeyI: 'dash',
};
addEventListener('keydown', e => {
  const b = KEYMAP[e.code];
  if (b) { e.preventDefault(); if (!keys[b] && ACTIONS.includes(b)) queue[b] = true; keys[b] = true; }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'Enter' || e.code === 'KeyR') {
    if (state === 'shop') leaveShop(); else if (state === 'paused') setPaused(false); else startFromMenu();
  }
});
addEventListener('keyup', e => { const b = KEYMAP[e.code]; if (b) keys[b] = false; });

// on-screen buttons are real DOM elements (see index.html), so touch/mouse hit-testing is native
const btnEls = {};
document.querySelectorAll('[data-act]').forEach(el => {
  const name = el.dataset.act;
  btnEls[name] = el;
  const press = e => {
    e.preventDefault();
    if (state !== 'play') return;
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    pointers.set(e.pointerId, name);
    if (ACTIONS.includes(name)) queue[name] = true;
    syncHeld();
  };
  const release = e => { pointers.delete(e.pointerId); syncHeld(); };
  el.addEventListener('pointerdown', press);
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('lostpointercapture', release);
  el.addEventListener('contextmenu', e => e.preventDefault());
  if (name === 'left' || name === 'right') {      // slide a thumb between the two d-pad buttons
    el.addEventListener('pointermove', e => {
      const cur = pointers.get(e.pointerId);
      if (cur !== 'left' && cur !== 'right') return;
      const hit = document.elementFromPoint(e.clientX, e.clientY), n = hit && hit.closest('[data-act]') && hit.closest('[data-act]').dataset.act;
      if ((n === 'left' || n === 'right') && n !== cur) { pointers.set(e.pointerId, n); syncHeld(); }
    });
  }
});
['gesturestart', 'gesturechange', 'dblclick'].forEach(t => document.addEventListener(t, e => e.preventDefault()));
function syncHeld() {
  for (const k in btnEls) held[k] = false;
  for (const v of pointers.values()) held[v] = true;
}
addEventListener('blur', () => { for (const k in keys) keys[k] = false; pointers.clear(); syncHeld(); if (state === 'play') setPaused(true); });
const isDown = n => keys[n] || held[n];



/* ======================================================================
   GAME
   ====================================================================== */
// ---------- game state ----------
let state = 'title';
let P, enemies, slashes, parts, texts, orbs, waves, shots, quakes, banner;
let gold, stage = 1, wave = 1, waveKills = 0, phase = 'wave', stageT = 0;
const STAGES = 10, WAVES = 3;
const STAGE_NAMES = ['THE RUINED GATE', 'WITHERED GARDEN', 'BONE CATHEDRAL', 'ASHEN CRYPT', 'THRONE OF SHADOWS', 'FROSTBOUND KEEP', 'DROWNED MARSH', 'MOLTEN FORGE', 'VOID SANCTUM', 'THE ENDLESS ABYSS'];
const BOSS_NAMES = ['CRIMSON WARDEN', 'BONE COLOSSUS', 'THE HOLLOW KING', 'ASHEN REAPER', 'SHADOW EMPEROR', 'GLACIAL SENTINEL', 'MIRE TYRANT', 'FORGE WARLORD', 'VOID ARCHON', 'THE SHADOW GOD'];
const BOSS_COL = ['#7a20ff', '#20c0ff', '#40ff80', '#ffa020', '#ff2040', '#80e8ff', '#a8ff40', '#ff6a00', '#e040ff', '#ffffff'];
// each boss has its own move set (see bossAI): slam, charge, volley, leap, rain, blink, summon, ring, meteor, twin
const BOSS_KITS = [
  ['slam', 'charge', 'volley'],
  ['slam', 'charge', 'volley', 'leap'],
  ['charge', 'volley', 'leap', 'rain'],
  ['slam', 'volley', 'rain', 'blink', 'leap'],
  ['slam', 'charge', 'volley', 'leap', 'rain', 'blink', 'summon'],
  ['ring', 'charge', 'leap', 'volley', 'slam'],
  ['meteor', 'summon', 'slam', 'ring', 'leap'],
  ['twin', 'leap', 'rain', 'ring', 'slam', 'volley'],
  ['blink', 'ring', 'meteor', 'summon', 'twin', 'leap'],
  ['slam', 'charge', 'volley', 'leap', 'rain', 'blink', 'summon', 'ring', 'meteor', 'twin'],
];
// ----- skills (slot 1 = K, slot 2 = L) and weapons -----
const SKILLS = {
  vortex: { slot: 1, name: 'Vortex',         ic: '🌀', desc: 'Spin in a storm of slashes',        mp: 30, cd: 5 },
  nova:   { slot: 1, name: 'Shadow Nova',    ic: '💥', desc: 'Blast & stagger everything near',    mp: 40, cd: 7 },
  wave:   { slot: 2, name: 'Shadow Wave',    ic: '🌊', desc: 'Piercing wave · hold to charge',     mp: 20, cd: 3 },
  rain:   { slot: 1, name: 'Blade Rain',     ic: '☄️', desc: 'Swords fall from the sky ahead',     mp: 45, cd: 8 },
  siphon: { slot: 1, name: 'Soul Siphon',    ic: '🩸', desc: 'Drain nearby foes to heal',          mp: 35, cd: 9 },
  meteor: { slot: 1, name: 'Shadow Meteor', ic: '🔥', desc: 'Call a meteor down on the nearest foe', mp: 50, cd: 9 },
  step:   { slot: 1, name: 'Phantom Step',   ic: '🌑', desc: 'Blink behind a foe and cut it 3 times', mp: 40, cd: 8 },
  fan:    { slot: 2, name: 'Spirit Daggers', ic: '🗡️', desc: 'Fan of fast flying daggers',         mp: 25, cd: 3.5 },
  chain:  { slot: 2, name: 'Chain Lightning', ic: '⚡', desc: 'Lightning jumps between foes',       mp: 30, cd: 4 },
  boomer: { slot: 2, name: 'Spirit Disc',    ic: '🪃', desc: 'A spinning blade that returns',      mp: 25, cd: 4 },
  beam:   { slot: 2, name: 'Void Lance',     ic: '🔱', desc: 'Instant beam through everything ahead', mp: 30, cd: 5 },
  well:   { slot: 2, name: 'Gravity Well',   ic: '🕳️', desc: 'Pulls foes in and crushes them',       mp: 35, cd: 10 },
};
const WPN = [
  { name: 'Shadow Blade',     c: ['30,110,255', '90,200,255', '#3af'],   ch: 'thrust', chn: 'Piercing Thrust', chd: 'Lunge forward and pierce everything in a line' },
  { name: 'Tempered Blade',   c: ['30,170,255', '120,235,255', '#4df'],  ch: 'twin',   chn: 'Twin Thrust',     chd: 'A lunge that cuts twice along its path' },
  { name: 'Moonsteel Blade',  c: ['110,80,255', '190,160,255', '#a7f'],  ch: 'moon',   chn: 'Moon Rend',       chd: 'Huge overhead arc that also looses a crescent wave' },
  { name: 'Voidforged Blade', c: ['190,50,255', '240,150,255', '#e5f'],  ch: 'void',   chn: 'Void Burst',      chd: 'A lunge that detonates in a void blast at its end' },
  { name: 'Abyssal Blade',    c: ['255,50,90', '255,150,170', '#f46'],   ch: 'cross',  chn: 'Blood Cross',     chd: 'Two crossing slashes, wide and brutal' },
  { name: 'Godslayer',        c: ['255,170,30', '255,235,150', '#fb3'],  ch: 'god',    chn: "Heaven's Fall",   chd: 'Leap skyward and crash down in a shockwave' },
];
const wcol = () => WPN[wpn].c;                    // the knight, his aura and his skills take the colour of the equipped weapon
const OPENERS = ['std', 'lunge', 'spin'];          // a new chain after a pause cycles through these
// 5-hit combo (mash J): each hit has its own arc
const COMBO = [
  { r: 92,  a0: -1.0, span: 1.9, ds: 1,  dmg: 26, kb: 200, cd: 0.19, vx: 110, big: false },   // 1 diagonal cut
  { r: 92,  a0: 0.9,  span: 1.9, ds: -1, dmg: 28, kb: 200, cd: 0.19, vx: 110, big: false },   // 2 backhand
  { r: 112, a0: -0.45, span: 0.9, ds: 1, dmg: 32, kb: 260, cd: 0.22, vx: 190, big: false },   // 3 straight slash, steps in
  { r: 108, a0: -1.3, span: 2.6, ds: -1, dmg: 36, kb: 300, cd: 0.26, vx: 140, big: true },    // 4 rising sweep
  { r: 126, a0: -1.8, span: 3.0, ds: 1,  dmg: 56, kb: 420, cd: 0.38, vx: 240, big: true },    // 5 overhead finisher
];
let sk, equip, wpn = 0, spawnQ = [], bolts = [], boomers = [], meteors = [], wells = [], beams = [], sched = [];
let relics = [], relicOffer = [], relicPicked = false, phoenixUsed = false, shopPrep = false, startStage = 1;
const DIFF = [{ n: 'Easy', hp: 0.75, dmg: 0.7, spawn: 1.2 }, { n: 'Normal', hp: 1, dmg: 1, spawn: 1 }, { n: 'Hard', hp: 1.35, dmg: 1.3, spawn: 0.85 }];
const diffM = () => DIFF[settings.diff] || DIFF[1];
// ----- relics: one is offered after every boss (Stats tab of the shop) -----
const RELICS = {
  fang:    { name: 'Vampiric Fang',   ic: '🦷', desc: 'Heal 3% max HP on every kill' },
  spring:  { name: 'Mana Spring',     ic: '💧', desc: 'Every 10-hit combo restores 15 MP' },
  coin:    { name: 'Lucky Coin',      ic: '🪙', desc: '30% chance a coin counts double' },
  thorn:   { name: 'Thorn Mail',      ic: '🌵', desc: 'Getting hit lashes out at nearby foes' },
  phoenix: { name: 'Phoenix Feather', ic: '🪶', desc: 'Revive once per run with 50% HP' },
  eye:     { name: "Hunter's Eye",    ic: '👁️', desc: '+12% critical chance' },
  boots:   { name: 'Swift Boots',     ic: '👢', desc: '+12% movement speed' },
  berserk: { name: 'Berserker Mark',  ic: '💢', desc: '+30% damage below 40% HP' },
  lantern: { name: 'Soul Lantern',    ic: '🏮', desc: '25% of kills drop a mana orb' },
  iron:    { name: 'Iron Will',       ic: '🛡️', desc: 'Take 15% less damage' },
  magnet:  { name: 'Magnet Ring',     ic: '🧲', desc: 'Loot is pulled from twice as far' },
};
const has = id => relics.includes(id);
const skm = id => 1 + 0.25 * (sk[id] - 1);       // skill power per level
const wd = () => 1 + 0.18 * wpn;                  // weapon damage multiplier
let up = { hp: 0, pow: 0, mp: 0, cdr: 0 }, marks = [];   // shop upgrades; boss ground markers
const cdr = () => 1 - 0.08 * up.cdr;
const quota = () => Math.round(7 + stage * 1.2 + wave * 2.5);
let camX, shake, hitstop, time, kills, score, spawnT, combo, comboT, best = 0, flash;
try { best = +localStorage.getItem('shadowKnightBest') || 0; } catch (e) {}
const prog = { cleared: 0, wins: 0 };             // saved progress: furthest stage cleared, times the game was won
try { Object.assign(prog, JSON.parse(localStorage.getItem('shadowKnightProg') || '{}')); } catch (e) {}
function saveProg() { try { localStorage.setItem('shadowKnightProg', JSON.stringify(prog)); } catch (e) {} }

function start() {
  P = {
    x: 0, y: GROUND, vx: 0, vy: 0, face: 1, ground: true,
    hp: 100, maxHp: 100, mp: 100, maxMp: 100,
    atkT: -5, atkCd: 0, step: 0, spin: 0, dashT: 0, dashCd: 0, inv: 0,
    cd1: 0, cd2: 0, vortex: 0, anim: 0, hurt: 0, bPow: 0, bHaste: 0, bShield: 0,
    hpT: 1, mpT: 1, coyote: 0, variant: -1, xT: 0, xl: 0, slam: 0, thrustOn: false, thrustMax: 0, thrustStyle: '', twinDone: false, jbuf: 0, jumps: 0, jflag: false, cdm1: 5, cdm2: 3,
    parryT: 0, parryCd: 0, chg: 0, cs: false, rdy: false, chg2: 0, cs2: false, full2: false, thrustT: 0, thrustLvl: 0, thrustHit: null,
  };
  relics = []; relicOffer = []; relicPicked = false; phoenixUsed = false; shopPrep = false;
  spawnQ = []; bolts = []; boomers = []; meteors = []; wells = []; beams = []; sched = []; enemies = []; slashes = []; parts = []; texts = []; orbs = []; waves = []; shots = []; quakes = []; banner = null;
  gold = 0; stage = 1; wave = 1; waveKills = 0; phase = 'wave'; stageT = 0;
  up = { hp: 0, pow: 0, mp: 0, cdr: 0 }; marks = [];
  sk = { vortex: 1, nova: 0, rain: 0, siphon: 0, meteor: 0, step: 0, wave: 1, fan: 0, chain: 0, boomer: 0, beam: 0, well: 0 }; equip = { 1: 'vortex', 2: 'wave' }; wpn = 0; applySkillButtons();
  camX = -W / 2; shake = 0; hitstop = 0; time = 0; kills = 0; score = 0; spawnT = 1; combo = 0; comboT = 0; flash = 0;
  for (const k in queue) queue[k] = false;
  banner = { text: 'STAGE 1 — ' + STAGE_NAMES[0], t: 3 };
  const dbg = /^#boss(\d{0,2})$/.exec(location.hash);   // debug: #boss / #boss3 jumps straight to a stage boss
  if (dbg) { stage = +dbg[1] || 1; beginBoss(); }
  state = 'play';
  sfx.start();
  if (startStage > 1 && !dbg) {   // replaying from a cleared stage: gear up in the shop first
    stage = startStage - 1; shopPrep = true; gold = (startStage - 1) * 120; banner = null;
    openShop(); return;
  }
  if (location.hash === '#shop') { gold = 200; openShop(); return; }   // debug: open the upgrade shop
  showUI();
}

// ---------- spawn ----------
const TYPES = {
  wraith:  { hp: 55,  spd: 85,  w: 26, h: 56, dmg: 8,  score: 100, fly: true },
  beast:   { hp: 120, spd: 120, w: 44, h: 38, dmg: 12, score: 180 },
  brute:   { hp: 300, spd: 55,  w: 46, h: 92, dmg: 20, score: 450 },
  bat:     { hp: 28,  spd: 150, w: 22, h: 24, dmg: 7,  score: 60,  fly: true },
  archer:  { hp: 70,  spd: 75,  w: 24, h: 62, dmg: 10, score: 170, wu: 0.6 },
  bomber:  { hp: 40,  spd: 200, w: 24, h: 34, dmg: 24, score: 120 },
  hound:   { hp: 70,  spd: 130, w: 40, h: 34, dmg: 11, score: 150 },                  // crouches, then pounces in an arc
  mage:    { hp: 60,  spd: 70,  w: 24, h: 64, dmg: 12, score: 220, fly: true, wu: 0.9 }, // floats back and fires a spread of orbs
  slime:   { hp: 110, spd: 60,  w: 36, h: 30, dmg: 10, score: 130 },                  // splits in two when killed
  slimelet:{ hp: 32,  spd: 95,  w: 20, h: 16, dmg: 6,  score: 40, child: true },
  golem:   { hp: 560, spd: 40,  w: 56, h: 112, dmg: 24, score: 600, wu: 0.75 },       // slow, slams the ground to send shockwaves
};
function pickType() {
  const t = (stage - 1) * WAVES + wave;   // 1..30
  const pool = [['wraith', 3], ['beast', 3], ['bat', t >= 2 ? 3 : 0], ['archer', t >= 3 ? 2 : 0], ['bomber', t >= 4 ? 2 : 0], ['hound', t >= 2 ? 2.5 : 0], ['slime', t >= 4 ? 2 : 0], ['mage', t >= 6 ? 1.6 : 0], ['golem', t >= 9 ? 0.8 + t * 0.03 : 0], ['brute', t >= 5 ? 1.2 + t * 0.06 : 0]];
  let r = Math.random() * pool.reduce((a, b) => a + b[1], 0);
  for (const [k, w] of pool) { if ((r -= w) < 0) return k; }
  return 'beast';
}
function makeEnemy(t, x) {
  const T = TYPES[t], diff = 1 + (stage - 1) * 0.4 + wave * 0.08;
  const e = {
    t, ...T, hp: T.hp * (0.9 + diff * 0.1) * diffM().hp, maxHp: T.hp * (0.9 + diff * 0.1) * diffM().hp,
    x, y: T.fly ? GROUND - (t === 'bat' ? rnd(120, 200) : rnd(60, 130)) : GROUND,
    baseY: 0, vx: 0, vy: 0, face: 1, atk: 0, atkCd: rnd(0.4, 1.2), flash: 0, kb: 0, ph: rnd(0, 6), dead: false,
    dive: 0, diveCd: rnd(1, 2), fuse: 0,
  };
  e.baseY = e.y;
  enemies.push(e);
  return e;
}
function spawn() {
  const x = camX + W + 60 + rnd(0, 80);   // enemies always advance from the right
  if (phase === 'wave' && (stage - 1) * WAVES + wave >= 3 && !enemies.some(e => e.elite) && Math.random() < 0.07) {
    let t = pickType(); if (t === 'bomber' || t === 'bat' || t === 'slimelet') t = 'beast';
    const e = makeEnemy(t, x);          // elite: bigger, tougher, glowing, and a pile of loot
    e.elite = true; e.w *= 1.3; e.h *= 1.3; e.hp = e.maxHp = e.maxHp * 4.5; e.dmg = Math.round(e.dmg * 1.3); e.score *= 4;
    if (!banner) banner = { text: '⚠ ELITE ⚠', t: 1.6 };
    return;
  }
  makeEnemy(pickType(), x);
}
function spawnBoss() {
  const side = Math.random() < 0.5 ? -1 : 1, hp = Math.round((1200 + 900 * (stage - 1)) * diffM().hp);
  const name = BOSS_NAMES[stage - 1];
  enemies.push({
    t: 'boss', boss: true, st: stage, name, col: BOSS_COL[stage - 1], hp, maxHp: hp, spd: 64 + stage * 6, w: 70, h: 170, dmg: 18 + stage * 2, score: 3000 + stage * 1500, twin: 0,
    x: camX + W + 120, y: GROUND, face: -1, atk: 0, atkCd: 0, flash: 0, kb: 0, ph: 0, dead: false,
    mode: 'walk', mt: 2.5, mtMax: 1, pose: 0, rage: false, cdir: 1,
  });
  banner = { text: '⚠ ' + name + ' ⚠', t: 3.2 };
  shake = 10; sfx.bossSpawn();
}
function beginBoss() { phase = 'boss'; spawnBoss(); }
function progressKill() {
  if (phase !== 'wave') return;
  if (++waveKills < quota()) return;
  if (wave >= WAVES) { beginBoss(); return; }
  wave++; waveKills = 0; spawnT = 2;
  banner = { text: 'WAVE ' + wave, t: 2 }; sfx.wavestart();
}
function nextStage() {
  stage++; wave = 1; waveKills = 0; phase = 'wave'; spawnT = 2.5;
  P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.3); P.mp = P.maxMp;
  banner = { text: 'STAGE ' + stage + ' — ' + STAGE_NAMES[stage - 1], t: 3.5 }; sfx.wavestart();
}
function endGame(st) {
  state = st;
  if (score > best) { best = score; try { localStorage.setItem('shadowKnightBest', best); } catch (e) {} }
  showUI();
}

// ---------- effects ----------
function sparks(x, y, n, col, spd = 300) {
  if (settings.lowfx) n = Math.ceil(n * 0.5);
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), s = rnd(60, spd);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: rnd(0.25, 0.6), max: 0.6, col, sz: rnd(1.5, 3.5), grav: 500 });
  }
}
function dmgText(x, y, str, col, big) {
  texts.push({ x: x + rnd(-14, 14), y, str, col, big, life: 1.1, vy: -90 });
}
function hurtEnemy(e, dmg, kbDir, kbPow = 220, crit = Math.random() < 0.2 + (has('eye') ? 0.12 : 0)) {
  if (e.dead) return;
  let d = Math.round(dmg * (P.bPow > 0 ? 1.6 : 1) * (has('berserk') && P.hp < P.maxHp * 0.4 ? 1.3 : 1) * (1 + 0.12 * up.pow) * (e.boss && e.mode === 'rec' ? 1.25 : 1) * (e.stun > 0 || e.mode === 'stun' ? 1.5 : 1) * rnd(0.85, 1.15) * (crit ? 2 : 1));
  e.hp -= d; e.flash = 0.12; e.kb = kbDir * kbPow * (e.boss ? 0.06 : 1);
  const cy = e.y - e.h / 2;
  sparks(e.x, cy, crit ? 18 : 9, crit ? '#ffd040' : '#6cf');
  sparks(e.x, cy, 5, '#fff', 200);
  dmgText(e.x, cy - e.h / 2, d.toLocaleString('en-US'), crit ? '#ffb020' : '#e8f4ff', crit);
  if (crit) dmgText(e.x, cy - e.h / 2 - 26, 'CRITICAL', '#ff4060', false);
  P.mp = Math.min(P.maxMp, P.mp + (crit ? 4 : 2));
  hitstop = Math.max(hitstop, crit ? 0.07 : 0.035);
  shake = Math.max(shake, crit ? 7 : 3);
  sfx.hit(crit);
  combo++; comboT = 2.2;
  if (has('spring') && combo % 10 === 0) { P.mp = Math.min(P.maxMp, P.mp + 15); dmgText(P.x, P.y - 122, '+15 MP', '#6af', false); }
  if (e.hp <= 0) {
    e.dead = true; kills++; score += e.score * (1 + Math.floor(combo / 10) * 0.1) | 0;
    sparks(e.x, cy, 30, '#a050ff', 380);
    if (e.boss) bossDown(e);
    else {
      dropLoot(e.x, cy, e.t === 'brute' || e.t === 'golem' ? 2 : 1);
      if (e.elite) { for (let i = 0; i < 6; i++) drop(e.x, cy, 'gem'); for (let i = 0; i < 8; i++) drop(e.x, cy, 'coin'); drop(e.x, cy, 'hp'); drop(e.x, cy, 'mp'); dmgText(e.x, cy - e.h, 'ELITE DOWN', '#ff6078', true); }
      if (has('fang')) P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.03);
      if (has('lantern') && Math.random() < 0.25) drop(e.x, cy, 'mp');
      if (e.t === 'slime') spawnQ.push(['slimelet', e.x - 20], ['slimelet', e.x + 20]);
      if (!e.child) progressKill();
    }
  }
}

function slashHit(cx, cy, range, face, arc360, dmg, kb) {
  for (const sh of shots) if (!sh.mine && Math.hypot(sh.x - cx, sh.y - cy) < range + 10) { sh.life = 0; sparks(sh.x, sh.y, 8, '#fff', 200); }
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - cx, dy = (e.y - e.h / 2) - cy;
    if (Math.hypot(dx, dy) > range + e.w / 2) continue;
    if (!arc360 && Math.sign(dx || face) !== face && Math.abs(dx) > e.w / 2) continue;
    hurtEnemy(e, dmg, Math.sign(dx || face), kb);
  }
}

// ---------- loot ----------
const ITEMS = {
  coin:   { col: '#ffcf30' },
  gem:    { col: '#7af0ff', ic: '◆' },
  hp:     { col: '#ff3050', ic: '+' },
  mp:     { col: '#3a9cff', ic: '+' },
  pow:    { col: '#ff7a1a', ic: '⚔' },
  haste:  { col: '#ffe040', ic: '⚡' },
  shield: { col: '#40e0ff', ic: '🛡' },
};
function drop(x, y, kind) {
  orbs.push({ x: x + rnd(-10, 10), y, vx: rnd(-140, 140), vy: rnd(-420, -220), kind, age: 0 });
}
function dropLoot(x, y, m = 1) {
  const n = (Math.random() < 0.85 ? 1 + (Math.random() * 3 * m | 0) : 0) + (stage >= 4 && Math.random() < 0.3 ? 1 : 0);
  for (let i = 0; i < n; i++) drop(x, y, 'coin');
  if (Math.random() < 0.08 * m + stage * 0.005) drop(x, y, 'gem');
  for (let k = 0; k < m; k++) {
    const r = Math.random();
    if (r < 0.12) drop(x, y, 'hp');
    else if (r < 0.24) drop(x, y, 'mp');
    else if (r < 0.28) drop(x, y, 'pow');
    else if (r < 0.32) drop(x, y, 'haste');
    else if (r < 0.35) drop(x, y, 'shield');
  }
}
function pickup(o) {
  o.gone = true;
  const t = (str, col) => dmgText(P.x, P.y - 100, str, col, false);
  switch (o.kind) {
    case 'gem': gold += 5; score += 100; t('+5 GOLD', '#7af0ff'); break;
    case 'coin': gold += has('coin') && Math.random() < 0.3 ? 2 : 1; score += 25; t('+1 GOLD', '#ffcf30'); break;
    case 'hp': P.hp = Math.min(P.maxHp, P.hp + 20); t('+20 HP', '#5f6'); break;
    case 'mp': P.mp = Math.min(P.maxMp, P.mp + 30); t('+30 MP', '#6af'); break;
    case 'pow': P.bPow = 12; t('POWER UP!', '#ff7a1a'); break;
    case 'haste': P.bHaste = 10; t('HASTE!', '#ffe040'); break;
    case 'shield': P.bShield = 6; t('SHIELD!', '#40e0ff'); break;
  }
  sfx.pickup(o.kind);
}
function bossDown(e) {
  score += 1000 * stage;
  shots = []; quakes = [];
  prog.cleared = Math.max(prog.cleared, stage); if (stage >= STAGES) prog.wins++; saveProg();
  buzz([60, 40, 120]);
  if (stage >= STAGES) { phase = 'won'; stageT = 3.2; banner = { text: 'THE SHADOW IS SLAIN', t: 3.2 }; }
  else { phase = 'clear'; stageT = 4.2; banner = { text: 'STAGE ' + stage + ' CLEAR', t: 3.6 }; sfx.clear(); }
  flash = 0.7; shake = 20; hitstop = 0.25;
  for (let i = 0; i < 3; i++) setTimeout(() => state === 'play' && sparks(e.x + rnd(-40, 40), e.y - rnd(20, 150), 40, '#ff5a30', 500), i * 120);
  for (let i = 0; i < 30; i++) drop(e.x, e.y - 80, 'coin');
  for (let i = 0; i < 6; i++) drop(e.x, e.y - 80, 'gem');
  for (const k of ['hp', 'hp', 'hp', 'mp', 'mp', 'pow', 'haste', 'shield']) drop(e.x, e.y - 80, k);
  P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.3);
  sfx.bossDown();
  for (const m of enemies) if (!m.boss && !m.dead) { m.hp = 0; m.dead = true; sparks(m.x, m.y - m.h / 2, 14, '#a050ff'); }
}
function explode(x, y, r, dmg) {
  sparks(x, y, 36, '#ff8a20', 460); sparks(x, y, 14, '#fff', 300);
  shake = Math.max(shake, 12); sfx.explode();
  if (Math.hypot(P.x - x, (P.y - 30) - y) < r) hurtPlayer(dmg, Math.sign(P.x - x) || 1);
}
function bossAI(e, dt) {
  const dx = P.x - e.x, dist = Math.abs(dx), rage = e.hp < e.maxHp * 0.5, sp = e.st >= 5 && e.hp < e.maxHp * 0.25 ? 1.4 : rage ? 1.2 : 1;
  if (rage && !e.rage) {
    e.rage = true; flash = 0.4; shake = 16; e.mode = 'walk'; e.mt = 0.6;
    dmgText(e.x, e.y - e.h - 20, 'ENRAGED', '#ff3030', true); sfx.enrage();
  }
  e.mt -= dt; e.pose = 0; e.fade = 0;
  if (e.mode !== 'air') e.y = GROUND;
  const touch = (m = 1) => { if (dist < e.w * 0.6 + 16 && P.y > GROUND - 70) hurtPlayer(e.dmg * m | 0, Math.sign(dx) || 1); };
  const prog = () => 1 - Math.max(0, e.mt) / e.mtMax;
  switch (e.mode) {
    case 'walk': {
      if (dist > 110) e.x += e.face * e.spd * sp * dt;
      touch(0.5);
      if (e.mt <= 0) {
        // each boss learns new moves: leap (2+), sky spikes (3+), blink strike (4+), minions (5 or enraged)
        const opts = BOSS_KITS[e.st - 1].slice();
        if (rage) opts.push('slam');
        if (rage && !opts.includes('summon')) opts.push('summon');
        e.mode = opts[Math.random() * opts.length | 0];
        if (e.mode === 'twin') { e.mode = 'charge'; e.twin = 1; }      // double charge: dashes at you twice in a row
        e.mt = e.mtMax = { slam: 1.2, charge: 1.1, volley: 0.9, summon: 1.1, leap: 1.0, rain: 1.0, blink: 0.8, ring: 1.0, meteor: 1.1 }[e.mode] / (rage ? 1.2 : 1);
        if (e.mode === 'charge') e.cdir = e.face;
        if (e.mode === 'leap') e.tx = P.x;
        if (e.mode === 'rain') for (let i = 0; i < 5; i++) marks.push({ x: P.x + (i - 2) * 120 + rnd(-30, 30), t: 1.0 + i * 0.14 });
        if (e.mode === 'meteor') for (let i = 0; i < 9; i++) marks.push({ x: P.x + (i - 4) * 105 + rnd(-30, 30), t: 1.0 + rnd(0, 0.9) });
      }
      break;
    }
    case 'slam':
      e.pose = prog();
      if (e.mt <= 0) {
        quakes.push({ x: e.x - 40, dir: -1, life: 1.8, hit: false }, { x: e.x + 40, dir: 1, life: 1.8, hit: false });
        shake = 14; sparks(e.x, GROUND, 24, '#ff8a40', 400); sfx.boom();
        e.mode = 'rec'; e.mt = 1.4;
      }
      break;
    case 'charge':
      e.pose = 0.5 * prog(); e.face = e.cdir;
      if (e.mt <= 0) { e.mode = 'dash'; e.mt = 0.7; }
      break;
    case 'dash':
      e.face = e.cdir; e.x += e.cdir * 560 * sp * dt;
      parts.push({ x: e.x - e.cdir * 30, y: GROUND - rnd(0, 40), vx: -e.cdir * rnd(60, 200), vy: rnd(-120, 0), life: 0.4, max: 0.4, col: '#a050ff', sz: 5, grav: 0 });
      touch(1.2);
      if (e.mt <= 0) {
        if (e.twin > 0) { e.twin--; e.mode = 'charge'; e.mt = e.mtMax = 0.55; e.cdir = Math.sign(dx) || 1; }
        else { e.mode = 'rec'; e.mt = 1.3; }
      }
      break;
    case 'ring':
      e.pose = prog();
      if (e.mt <= 0) {
        const n = rage ? 16 : 12, off = rnd(0, 6.28);
        for (let i = 0; i < n; i++) {
          const a = off + i * Math.PI * 2 / n;
          shots.push({ x: e.x, y: e.y - 100, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, dmg: 12, life: 3, col: e.col });
        }
        sfx.volley(); sparks(e.x, e.y - 100, 20, e.col, 300);
        e.mode = 'rec'; e.mt = 1.2;
      }
      break;
    case 'volley':
      e.pose = prog();
      if (e.mt <= 0) {
        const n = (rage ? 5 : 4) + (e.st >= 5 && sp > 1.3 ? 2 : 0), base = Math.atan2((P.y - 50) - (e.y - 110), dx);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.22;
          shots.push({ x: e.x + e.face * 30, y: e.y - 110, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, dmg: 12, life: 3, col: '#ff3050' });
        }
        sfx.volley();
        e.mode = 'rec'; e.mt = 1.1;
      }
      break;
    case 'summon':
      e.pose = prog();
      if (e.mt <= 0) {
        const n = e.st >= 8 ? 3 : 2, kinds = e.st >= 7 ? ['bat', 'bomber', 'archer'] : ['bat', 'bomber'];
        for (let i = 0; i < n; i++) makeEnemy(kinds[Math.random() * kinds.length | 0], e.x + (i - (n - 1) / 2) * 70);
        flash = 0.15; sparks(e.x, e.y - 100, 20, '#a050ff');
        e.mode = 'rec'; e.mt = 1.0;
      }
      break;
    case 'leap':
      e.pose = prog() * 0.8;
      if (e.mt > 0.35) e.tx = P.x;                 // the landing ring locks onto you just before take-off
      if (e.mt <= 0) { e.mode = 'air'; e.mt = e.mtMax = 0.6; e.sx = e.x; sfx.dash(); }
      break;
    case 'air': {
      const k = 1 - Math.max(0, e.mt) / e.mtMax;
      e.x = e.sx + (e.tx - e.sx) * k; e.y = GROUND - 190 * Math.sin(k * Math.PI); e.pose = 1;
      if (e.mt <= 0) {
        e.y = GROUND; shake = 16; sparks(e.x, GROUND, 28, '#ff8a40', 420); sfx.boom();
        quakes.push({ x: e.x - 40, dir: -1, life: 1.4, hit: false }, { x: e.x + 40, dir: 1, life: 1.4, hit: false });
        if (Math.abs(P.x - e.x) < 80 && P.y > GROUND - 50) hurtPlayer(e.dmg, Math.sign(P.x - e.x) || 1);
        e.mode = 'rec'; e.mt = 1.5;
      }
      break;
    }
    case 'rain': case 'meteor':
      e.pose = prog();
      if (e.mt <= 0) { e.mode = 'rec'; e.mt = 1.3; }
      break;
    case 'blink':
      e.fade = prog();
      if (e.mt <= 0) {
        sparks(e.x, e.y - 90, 24, e.col, 300);
        e.x = P.x - P.face * 150; e.face = Math.sign(P.x - e.x) || 1;
        sparks(e.x, e.y - 90, 24, e.col, 300); sfx.dash();
        e.mode = 'slam'; e.mt = e.mtMax = 0.9;
      }
      break;
    case 'stun':
      e.pose = 0;
      if (Math.random() < 0.4) parts.push({ x: e.x + rnd(-30, 30), y: e.y - e.h - rnd(0, 30), vx: 0, vy: -40, life: 0.4, max: 0.4, col: '#ffd060', sz: 4, grav: 0 });
      if (e.mt <= 0) { e.mode = 'walk'; e.mt = rnd(1.0, 1.6); }
      break;
    default:
      if (e.mt <= 0) { e.mode = 'walk'; e.mt = rnd(1.6, 2.6) / sp; }
  }
}

// ---------- player actions ----------
function doAttack() {
  if (P.atkCd > 0 || P.dashT > 0) return;
  const chain = P.atkT > -0.35;
  P.step = chain ? (P.step + 1) % COMBO.length : 0;
  // mashing continues the 5-hit chain; pausing ~1s and attacking again rotates to a different opener
  if (!chain && P.atkT < -0.9) P.variant = (P.variant + 1) % OPENERS.length;
  const mv = !chain ? OPENERS[Math.max(0, P.variant)] : 'std', rg = 1 + 0.05 * wpn;
  const air = !P.ground, cx = P.x + P.face * 20, cy = P.y - 44, hk = (P.bHaste > 0 ? 0.7 : 1);
  if (mv !== 'std') {
    P.atkT = 0.22;
    if (mv === 'lunge') {         // lunge stab: quick dash forward with a long narrow cut
      P.atkCd = 0.3 * hk; P.vx += P.face * 560;
      slashes.push({ x: cx, y: cy, face: P.face, r: 140 * rg, life: 0.22, max: 0.22, a0: -0.22, span: 0.44, dirSign: 1, full: false, big: false, wl: wpn });
      slashHit(cx + P.face * 40, cy, 140 * rg, P.face, false, 38 * wd(), 420);
      for (let i = 0; i < 6; i++) parts.push({ x: P.x, y: cy + rnd(-8, 8), vx: -P.face * rnd(80, 260), vy: 0, life: 0.25, max: 0.25, col: wcol()[2], sz: 3, grav: 0 });
    } else {                      // whirl: full circle around the knight
      P.atkCd = 0.34 * hk; P.spin = 0.3;
      slashes.push({ x: P.x, y: cy, face: P.face, r: 108 * rg, life: 0.28, max: 0.28, a0: rnd(0, 6.28), span: 6.28, dirSign: 1, full: true, big: false, wl: wpn });
      slashHit(P.x, cy, 112 * rg, P.face, true, 32 * wd(), 280);
    }
    sfx.slash(true);
    return;
  }
  const sp = COMBO[P.step];
  P.atkT = 0.22; P.atkCd = sp.cd * hk;
  P.vx += P.face * sp.vx;
  slashes.push({
    x: cx, y: cy, face: P.face, r: (air ? 120 : sp.r) * rg, life: 0.28, max: 0.28, wl: wpn,
    a0: air ? -Math.PI * 0.9 : sp.a0, span: air ? Math.PI * 1.8 : sp.span,
    dirSign: sp.ds, full: air, big: sp.big || air,
  });
  if (air) P.spin = 0.3;
  slashHit(cx, cy, ((air ? 125 : sp.r + 4)) * rg, P.face, air, sp.dmg * wd(), sp.kb);
  sfx.slash(sp.big);
}
function doSkill1() {
  const id = equip[1], S = SKILLS[id];
  if (P.cd1 > 0 || P.mp < S.mp) return;
  P.mp -= S.mp; P.cd1 = P.cdm1 = S.cd * cdr();
  if (id === 'vortex') {
    P.vortex = 0.55; P.inv = Math.max(P.inv, 0.6);
    P.vy = Math.min(P.vy, -260); P.ground = false; P.coyote = 0;
    flash = 0.25;
    sfx.vortex();
  } else if (id === 'nova') {   // one big blast that hurts and staggers everything around you
    const r = 240 + 15 * (sk.nova - 1);
    P.inv = Math.max(P.inv, 0.5); flash = 0.3; shake = Math.max(shake, 12);
    slashHit(P.x, P.y - 44, r, P.face, true, 55 * skm('nova'), 650);
    for (const e of enemies) if (!e.dead && !e.boss && Math.hypot(e.x - P.x, e.y - e.h / 2 - (P.y - 44)) < r + e.w / 2) { e.stun = 1.0; e.atk = 0; }
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; parts.push({ x: P.x, y: P.y - 44, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, life: 0.45, max: 0.45, col: i % 2 ? wcol()[2] : '#fff', sz: 4, grav: 0 }); }
    for (let i = 0; i < 3; i++) slashes.push({ x: P.x, y: P.y - 44, face: P.face, r: r * (0.5 + i * 0.25), life: 0.3, max: 0.3, a0: i, span: 6.28, dirSign: 1, full: true, big: true, wl: wpn });
    sfx.boom();
  } else if (id === 'rain') {   // blades fall in a line ahead of the knight
    P.atkT = 0.3;
    for (let i = 0; i < 8 + sk.rain; i++) shots.push({ x: P.x + P.face * (70 + i * 52) + rnd(-12, 12), y: GROUND - 440 - rnd(0, 160), vx: 0, vy: 1100, mine: true, blade: true, dmg: 48 * skm('rain'), life: 1.3, col: wcol()[2] });
    flash = 0.12; sfx.wave(1);
  } else if (id === 'meteor') { // meteor: lands on the nearest foe in front (or a fixed spot ahead)
    let tx = P.x + P.face * 260, bd = 650;
    for (const e of enemies) { const d = Math.abs(e.x - P.x); if (!e.dead && d < bd && (e.x - P.x) * P.face > -80) { bd = d; tx = e.x; } }
    meteors.push({ x: tx, t: 0.8, max: 0.8, r: 150 + 12 * (sk.meteor - 1), dmg: 150 * skm('meteor') });
    P.atkT = 0.3; sfx.wave(1);
  } else if (id === 'step') {   // blink to the far side of the nearest foe, then three quick cuts
    let tg = null, bd = 460;
    for (const e of enemies) { const d = Math.abs(e.x - P.x); if (!e.dead && d < bd) { bd = d; tg = e; } }
    const ox = P.x, oy = P.y - 44;
    if (tg) { const dir = Math.sign(tg.x - P.x) || P.face; P.x = tg.x + dir * (tg.w / 2 + 55); P.face = -dir; } else P.x += P.face * 260;
    P.vx = 0; P.inv = Math.max(P.inv, 0.75);
    for (let i = 0; i <= 16; i++) { const k = i / 16; parts.push({ x: ox + (P.x - ox) * k, y: oy + rnd(-30, 30), vx: 0, vy: rnd(-30, 30), life: 0.4, max: 0.4, col: i % 2 ? wcol()[2] : '#fff', sz: 5, grav: 0 }); }
    sparks(ox, oy, 12, wcol()[2], 260); sparks(P.x, oy, 12, wcol()[2], 260);
    const f = P.face;
    for (let i = 0; i < 3; i++) sched.push({ t: 0.06 + i * 0.11, fn: () => {
      slashes.push({ x: P.x + f * 20, y: P.y - 44, face: f, r: 112, life: 0.28, max: 0.28, a0: -1.3 + i * 0.9, span: 2.0, dirSign: i % 2 ? -1 : 1, full: false, big: i === 2, wl: wpn });
      slashHit(P.x + f * 20, P.y - 44, 120, f, true, (34 + i * 12) * skm('step'), 260); sfx.slash(i === 2);
    } });
    P.atkT = 0.3; flash = 0.12; sfx.dash();
  } else {                      // siphon: damage everything close and take some of it back as health
    const r = 300, list = enemies.filter(e => !e.dead && Math.hypot(e.x - P.x, e.y - e.h / 2 - (P.y - 44)) < r + e.w / 2);
    let n = 0;
    for (const e of list) {
      hurtEnemy(e, 42 * skm('siphon'), Math.sign(e.x - P.x) || 1, 120, false); n++;
      bolts.push({ pts: curvePts(e.x, e.y - e.h / 2, P.x, P.y - 44, rnd(-50, 50)), life: 0.45, max: 0.45, col: ['200,20,50', '255,110,130', '#ff4a6a'], ws: 0.9 });
      for (let i = 0; i < 6; i++) parts.push({ x: e.x, y: e.y - e.h / 2, vx: (P.x - e.x) * 2.4 + rnd(-40, 40), vy: ((P.y - 44) - (e.y - e.h / 2)) * 2.4 + rnd(-40, 40), life: 0.4, max: 0.4, col: '#ff4a6a', sz: 4, grav: 0 });
    }
    const heal = Math.min(P.maxHp * 0.3, P.maxHp * (0.06 + 0.03 * n));
    P.hp = Math.min(P.maxHp, P.hp + heal); P.mp = Math.min(P.maxMp, P.mp + 8 * n);
    dmgText(P.x, P.y - 104, '+' + Math.round(heal) + ' HP', '#5f6', true);
    for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28; parts.push({ x: P.x + Math.cos(a) * r, y: P.y - 44 + Math.sin(a) * r * 0.6, vx: -Math.cos(a) * r * 2.2, vy: -Math.sin(a) * r * 1.3, life: 0.45, max: 0.45, col: '#ff4a6a', sz: 3, grav: 0 }); }
    flash = 0.15; sfx.vortex();
  }
}
// ----- slot-2 skills: tap = normal, hold = bigger and stronger (costs 25 more MP at full charge, like the wave) -----
function chargeL(S, l) {
  if (P.cd2 > 0 || P.mp < S.mp) return -1;
  l = clamp(l, 0, Math.max(0, (P.mp - S.mp) / 25));
  P.mp -= S.mp + 25 * l; P.cd2 = P.cdm2 = (S.cd + l) * cdr(); P.atkT = 0.22;
  return l;
}
function curvePts(x0, y0, x1, y1, bulge) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, cx = (x0 + x1) / 2 - dy / len * bulge, cy = (y0 + y1) / 2 + dx / len * bulge, pts = [];
  for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push([(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1]); }
  return pts;
}
function castFan(l) {          // Spirit Daggers
  l = chargeL(SKILLS.fan, l); if (l < 0) return;
  const n = 4 + sk.fan + Math.round(l * 4);
  for (let i = 0; i < n; i++) {
    const a = -0.12 + (i - (n - 1) / 2) * (0.5 / (n - 1 || 1)) * Math.max(1, n / 6);
    shots.push({ x: P.x + P.face * 24, y: P.y - 50, vx: P.face * Math.cos(a) * 780, vy: Math.sin(a) * 780, mine: true, dag: true, dmg: 42 * skm('fan') * (1 + 0.8 * l), life: 1.1, col: `rgb(${wcol()[1]})` });
  }
  shake = Math.max(shake, 3 + 4 * l); sfx.wave(l);
}
function castChain(l) {        // Chain Lightning
  const S = SKILLS.chain;
  if (P.cd2 > 0 || P.mp < S.mp) return;
  const alive = enemies.filter(e => !e.dead), lv = clamp(l, 0, Math.max(0, (P.mp - S.mp) / 25));
  let cur = { x: P.x, y: P.y - 50 }, first = true;
  const hitSet = new Set(), pts = [[cur.x, cur.y]], max = 3 + sk.chain + Math.round(lv * 3), branches = [];
  for (let n = 0; n < max; n++) {
    let best = null, bd = first ? 560 + 200 * lv : 280 + 80 * lv;
    for (const e of alive) { if (hitSet.has(e)) continue; const d = Math.hypot(e.x - cur.x, e.y - e.h / 2 - cur.y); if (d < bd) { bd = d; best = e; } }
    if (!best) break;
    first = false; hitSet.add(best);
    const nx = best.x, ny = best.y - best.h / 2;
    for (let k = 1; k <= 4; k++) pts.push([cur.x + (nx - cur.x) * k / 4 + (k < 4 ? rnd(-14, 14) : 0), cur.y + (ny - cur.y) * k / 4 + (k < 4 ? rnd(-14, 14) : 0)]);
    for (let b = 0; b < 2; b++) branches.push([[nx, ny], [nx + rnd(-50, 50), ny + rnd(-45, 10)], [nx + rnd(-95, 95), ny + rnd(-70, 20)]]);
    cur = { x: nx, y: ny };
  }
  if (!hitSet.size) return;
  l = chargeL(S, l);
  bolts.push({ pts, life: 0.3, max: 0.3, ws: 1 + 0.7 * l });
  for (const b of branches) bolts.push({ pts: b, life: 0.22, max: 0.3, ws: 0.6 });
  for (const e of hitSet) { hurtEnemy(e, 58 * skm('chain') * (1 + 0.7 * l), Math.sign(e.x - P.x) || 1, 160); sparks(e.x, e.y - e.h / 2, 12, '#fff', 320); }
  flash = 0.1 + 0.08 * l; sfx.thrust(0.3 + 0.5 * l);
}
function castBoomer(l) {       // Spirit Disc
  l = chargeL(SKILLS.boomer, l); if (l < 0) return;
  boomers.push({ t: 0, T: 1.4 + 0.3 * l, D: 420 + 220 * l, sz: 1 + 0.6 * l, face: P.face, hit: new Set(), reset: false, dmg: 52 * skm('boomer') * (1 + 0.9 * l), x: P.x, y: P.y - 50 });
  sfx.wave(l);
}
function castBeam(l) {         // Void Lance
  l = chargeL(SKILLS.beam, l); if (l < 0) return;
  P.vx -= P.face * (160 + 120 * l);
  const y0 = P.y - 50, len = 700 + 300 * l, band = 30 + 28 * l;
  beams.push({ x: P.x + P.face * 20, y: y0, face: P.face, len, wd: 1 + 0.9 * l, life: 0.35, max: 0.35 });
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = (e.x - P.x) * P.face;
    if (dx < -e.w / 2 || dx > len || e.y - e.h > y0 + band || e.y < y0 - band) continue;
    hurtEnemy(e, 100 * skm('beam') * (1 + 1.1 * l), P.face, 320 + 200 * l);
  }
  for (const sh of shots) if (!sh.mine && (sh.x - P.x) * P.face > 0 && (sh.x - P.x) * P.face < len && Math.abs(sh.y - y0) < 40 + band) { sh.life = 0; sparks(sh.x, sh.y, 8, '#fff', 200); }
  shake = Math.max(shake, 6 + 6 * l); flash = 0.15 + 0.1 * l; sfx.thrust(0.8);
}
function castWell(l) {         // Gravity Well
  l = chargeL(SKILLS.well, l); if (l < 0) return;
  const dur = 2.4 + 0.25 * sk.well + 1.2 * l;
  wells.push({ x: P.x + P.face * 230, y: P.y - 60, t: dur, max: dur, tick: 0.2, sc: 1 + 0.5 * l, pr: 280 + 120 * l, hr: 170 + 70 * l, str: 1 + 0.5 * l, dm: 1 + l });
  flash = 0.1; sfx.vortex();
}
function castL(l) { ({ wave: castWave, fan: castFan, chain: castChain, boomer: castBoomer, beam: castBeam, well: castWell })[equip[2]](l); }
// Shadow Wave: tap = normal, hold = bigger and stronger (costs more MP)
const WAVE_MIN = 0.3, WAVE_FULL = 1.0;
function castWave(l) {
  if (P.cd2 > 0 || P.mp < 20) return;
  l = clamp(l, 0, Math.max(0, (P.mp - 20) / 25));
  P.mp -= 20 + 25 * l; P.cd2 = P.cdm2 = (3 + l) * cdr(); P.atkT = 0.25;
  waves.push({ x: P.x + P.face * 30, y: GROUND, face: P.face, life: 0.9 + 0.5 * l, hit: new Set(), sz: 1 + 1.4 * l, dmg: 70 * (1 + 1.8 * l) * skm('wave') });
  shake = Math.max(shake, 5 + 8 * l);
  sfx.wave(l);
}
// Charged thrust: hold attack, release to lunge forward and pierce everything in a line
const THRUST_READY = 0.45, THRUST_FULL = 0.8;
function doThrust(l) {
  const st = WPN[wpn].ch, rg = 1 + 0.05 * wpn;
  P.atkCd = 0.5; P.atkT = 0;
  flash = 0.12 + 0.1 * l; shake = Math.max(shake, 6 + 6 * l);
  sfx.thrust(l);
  if (st === 'moon') {          // Moon Rend: three pulling crescent cuts in a row
    P.atkT = 0.3; P.inv = Math.max(P.inv, 0.65);
    for (let i = 0; i < 3; i++) sched.push({ t: i * 0.13, fn: () => {
      slashes.push({ x: P.x, y: P.y - 50, face: P.face, r: (165 + 30 * l + i * 14) * rg, life: 0.32, max: 0.32, a0: -2.4 + i * 0.5, span: 3.4 - i * 0.4, dirSign: i % 2 ? -1 : 1, full: false, big: true, wl: wpn });
      slashHit(P.x + P.face * 30, P.y - 50, (170 + 55 * l) * rg, P.face, false, (45 + 85 * l) * wd(), -250);
      shake = Math.max(shake, 5); sfx.slash(true);
    } });
    return;
  }
  if (st === 'cross') {         // Blood Cross: two crossing cuts, the second lands a beat later
    P.atkT = 0.3; P.inv = Math.max(P.inv, 0.45); P.vx += P.face * 300; P.xT = 0.12; P.xl = l;
    const r = (150 + 50 * l) * rg;
    slashes.push({ x: P.x, y: P.y - 50, face: P.face, r, life: 0.3, max: 0.3, a0: -1.2, span: 2.0, dirSign: 1, full: false, big: true, wl: wpn });
    slashHit(P.x + P.face * 20, P.y - 50, r + 10, P.face, false, (60 + 120 * l) * wd(), 380);
    return;
  }
  if (st === 'god') {           // Heaven's Fall: leap, then crash down
    P.vy = -980; P.ground = false; P.coyote = 0; P.jumps = 1; P.slam = l + 0.3; P.inv = Math.max(P.inv, 1.4);
    sparks(P.x, P.y, 16, wcol()[2], 300);
    return;
  }
  P.thrustT = P.thrustMax = 0.2 + 0.14 * l; P.thrustLvl = l; P.thrustHit = new Set();
  P.thrustStyle = st; P.twinDone = false; P.thrustOn = true;
  P.inv = Math.max(P.inv, P.thrustT + 0.05);
}
function voidBurst() {
  const l = P.thrustLvl, r = (170 + 70 * l) * (1 + 0.05 * wpn);
  slashHit(P.x, P.y - 44, r, P.face, true, (70 + 150 * l) * wd(), 600);
  for (let i = 0; i < 36; i++) { const a = i / 36 * 6.28; parts.push({ x: P.x, y: P.y - 44, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, life: 0.45, max: 0.45, col: i % 2 ? wcol()[2] : '#fff', sz: 4, grav: 0 }); }
  slashes.push({ x: P.x, y: P.y - 44, face: P.face, r: r * 0.8, life: 0.3, max: 0.3, a0: 0, span: 6.28, dirSign: 1, full: true, big: true, wl: wpn });
  shake = Math.max(shake, 12); flash = 0.25; sfx.boom();
}
function boltPts(x, top, bottom) {
  const pts = [[x, top]];
  for (let k = 1; k < 6; k++) pts.push([x + rnd(-18, 18), top + (bottom - top) * k / 6]);
  pts.push([x, bottom]); return pts;
}
function slamLand() {
  const pw = P.slam; P.slam = 0;
  slashHit(P.x, GROUND - 40, (230 + 90 * pw) * (1 + 0.05 * wpn), P.face, true, (110 + 240 * pw) * wd(), 700);
  for (const d of [-1, 1]) for (let k = 1; k <= 3; k++) {     // lightning columns strike left and right
    const bx = P.x + d * k * 95;
    sched.push({ t: k * 0.08, fn: () => {
      bolts.push({ pts: boltPts(bx, GROUND - 520, GROUND), life: 0.3, max: 0.3 });
      for (const e of enemies) if (!e.dead && Math.abs(e.x - bx) < 55) hurtEnemy(e, (70 + 130 * pw) * wd(), d, 300);
      sparks(bx, GROUND, 10, wcol()[2], 300); shake = Math.max(shake, 6);
    } });
  }
  sparks(P.x, GROUND, 30, wcol()[2], 520);
  shake = Math.max(shake, 18); flash = 0.4; hitstop = Math.max(hitstop, 0.1); sfx.boom(); buzz(40);
}
function chargeInput(dt) {
    if (isDown('attack') && P.thrustT <= 0 && P.dashT <= 0) {
    P.chg += dt;
    if (P.chg > 0.3 && !P.cs) { P.cs = true; sfx.chargeStart(); }
    if (P.chg >= THRUST_READY && !P.rdy) { P.rdy = true; sfx.chargeReady(); }
  } else {
    if (P.chg >= THRUST_READY && !isDown('attack')) doThrust(clamp((P.chg - THRUST_READY) / THRUST_FULL, 0, 1));
    P.chg = 0; P.cs = P.rdy = false;
  }
  if (P.chg2 > 0) {
    if (isDown('skill2')) {
      P.chg2 += dt;
      if (P.chg2 > WAVE_MIN && !P.cs2) { P.cs2 = true; sfx.chargeStart(); }
      if (P.chg2 >= WAVE_MIN + WAVE_FULL && !P.full2) { P.full2 = true; sfx.chargeReady(); }
    } else {
      castL(clamp((P.chg2 - WAVE_MIN) / WAVE_FULL, 0, 1));
      P.chg2 = 0; P.cs2 = P.full2 = false;
    }
  }
}
function thrustHits() {
  const reach = 120 + 80 * P.thrustLvl, f = P.face;
  for (const sh of shots) {
    if (!sh.mine && (sh.x - P.x) * f > -10 && (sh.x - P.x) * f < reach && Math.abs(sh.y - (P.y - 50)) < 50) { sh.life = 0; sparks(sh.x, sh.y, 8, '#fff', 200); }
  }
  for (const e of enemies) {
    if (e.dead || P.thrustHit.has(e)) continue;
    const dx = (e.x - P.x) * f;
    if (dx < -e.w / 2 || dx > reach + e.w / 2) continue;
    if (e.y - e.h > P.y - 10 || e.y < P.y - 100) continue;
    P.thrustHit.add(e);
    hurtEnemy(e, (85 + 170 * P.thrustLvl) * wd(), f, 520, P.thrustLvl > 0.6 ? true : undefined);
  }
}
// Parry: press right before a hit lands. Negates the hit, staggers nearby enemies (boss included) and reflects projectiles.
const PARRY_WINDOW = 0.26;
function doParry() {
  if (P.parryCd > 0 || P.dashT > 0 || P.thrustT > 0) return;
  P.parryT = PARRY_WINDOW; P.parryCd = 0.75;
  sfx.whiff();
}
function onParry() {
  P.parryT = 0; P.inv = Math.max(P.inv, 0.6); P.mp = Math.min(P.maxMp, P.mp + 15);
  flash = 0.18; hitstop = Math.max(hitstop, 0.14); shake = Math.max(shake, 7);
  sparks(P.x + P.face * 22, P.y - 50, 26, '#ffd060', 440); sparks(P.x + P.face * 22, P.y - 50, 14, '#fff', 320);
  dmgText(P.x, P.y - 104, 'PARRY!', '#ffd060', true);
  sfx.parry(); buzz([20, 30, 20]);
  for (const e of enemies) {
    if (e.dead || Math.abs(e.x - P.x) > (e.boss ? 420 : 240)) continue;
    if (e.boss) {
      if (e.mode !== 'stun') { e.mode = 'stun'; e.mt = 2.2; e.pose = 0; dmgText(e.x, e.y - e.h - 20, 'STAGGERED', '#ffd060', false); }
    } else { e.stun = 1.2; e.atk = 0; e.kb = (Math.sign(e.x - P.x) || 1) * 320; }
  }
  for (const sh of shots) {
    if (sh.mine || sh.fall || Math.hypot(sh.x - P.x, sh.y - (P.y - 45)) > 300) continue;
    sh.mine = true; sh.vx = (Math.sign(sh.x - P.x) || 1) * Math.max(380, Math.abs(sh.vx) * 1.4); sh.vy = 0; sh.col = '#ffd060'; sh.life = 3;
  }
}
function doDash() {
  if (P.dashCd > 0) return;
  P.dashT = 0.2; P.dashCd = 1.1 * cdr(); P.inv = Math.max(P.inv, 0.28);
  sfx.dash();
}
function hurtPlayer(d, dir) {
  if (P.inv > 0) return;
  if (P.parryT > 0) { onParry(); return; }
  if (P.bShield > 0) { P.inv = 0.3; sparks(P.x, P.y - 40, 10, '#4ef'); dmgText(P.x, P.y - 90, 'BLOCK', '#40e0ff', false); sfx.block(); return; }
  d = Math.max(1, Math.round(d * diffM().dmg * (has('iron') ? 0.85 : 1)));
  P.hp -= d; P.inv = 0.8; P.hurt = 0.2; P.vx = dir * 260; P.vy = -220; P.ground = false;
  shake = 10; combo = 0; flash = 0.1;
  sparks(P.x, P.y - 40, 14, '#f33');
  dmgText(P.x, P.y - 90, '-' + d, '#ff4040', false);
  sfx.hurt(); buzz(45);
  if (has('thorn')) for (const e of enemies) if (!e.dead && Math.hypot(e.x - P.x, e.y - e.h / 2 - (P.y - 40)) < 150) hurtEnemy(e, 40, Math.sign(e.x - P.x) || 1, 220, false);
  if (P.hp <= 0 && has('phoenix') && !phoenixUsed) {
    phoenixUsed = true; P.hp = P.maxHp * 0.5; P.inv = 2; flash = 0.6; shake = 16;
    sparks(P.x, P.y - 40, 40, '#ffb030', 480); dmgText(P.x, P.y - 110, 'REBORN', '#ffcf30', true); sfx.clear(); buzz([40, 40, 120]);
    return;
  }
  if (P.hp <= 0) {
    buzz(220);
    P.hp = 0; endGame('over');
  }
}

// ---------- update ----------
function update(dt) {
  if (hitstop > 0) { hitstop -= dt; dt *= 0.05; }
  time += dt;
  // timers
  for (const k of ['atkCd', 'cd1', 'cd2', 'dashCd', 'inv', 'hurt', 'spin', 'vortex', 'thrustT', 'parryT', 'parryCd', 'bPow', 'bHaste', 'bShield']) P[k] = Math.max(0, P[k] - dt);
  P.atkT -= dt;
  { const hv = P.hp / P.maxHp, mv = P.mp / P.maxMp;       // delayed 'damage trail' on the bars
    P.hpT = hv >= P.hpT ? hv : Math.max(hv, P.hpT - 0.4 * dt); P.mpT = mv >= P.mpT ? mv : Math.max(mv, P.mpT - 0.5 * dt); }
  for (const q of sched) { q.t -= dt; if (q.t <= 0) { q.done = true; q.fn(); } }
  sched = sched.filter(q => !q.done);
  comboT -= dt; if (comboT <= 0) combo = 0;
  shake = Math.max(0, shake - 30 * dt); flash = Math.max(0, flash - dt);

  // input
  // jump: coyote time (0.1s after leaving a ledge), input buffer (0.12s before landing), double jump, hold for height
  if (P.ground) { P.coyote = 0.1; P.jumps = 0; } else P.coyote -= dt;
  P.jbuf -= dt;
  if (queue.jump) P.jbuf = 0.12;
  if (P.jbuf > 0 && P.coyote > 0) {
    P.vy = -620; P.ground = false; P.coyote = 0; P.jbuf = 0; P.jumps = 1; P.jflag = true; sfx.jump();
  } else if (queue.jump && P.jumps < 2 && P.coyote <= 0 && P.y < GROUND - 45) {
    P.vy = -540; P.jumps = 2; P.jbuf = 0; P.jflag = true; sfx.jump(); sparks(P.x, P.y, 10, '#8cf', 180);
  }
  if (P.jflag) { if (P.vy >= 0) P.jflag = false; else if (!isDown('jump')) { P.vy = Math.max(P.vy, -330); P.jflag = false; } }
  if (queue.skill1) doSkill1();
  if (queue.skill2 && P.cd2 <= 0 && P.mp >= SKILLS[equip[2]].mp) P.chg2 = 0.001;   // every slot-2 skill can be charged by holding
  if (queue.dash) doDash();
  if (queue.parry) doParry();
  if (queue.attack) doAttack();
  chargeInput(dt);
  for (const k in queue) queue[k] = false;

  const dir = (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0);
  if (P.thrustOn && P.thrustT <= 0) { P.thrustOn = false; if (P.thrustStyle === 'void') voidBurst(); }
  if (P.thrustOn && P.thrustStyle === 'twin' && !P.twinDone && P.thrustT < P.thrustMax * 0.5) { P.twinDone = true; P.thrustHit = new Set(); sparks(P.x, P.y - 50, 12, wcol()[2], 260); }
  if (P.xT > 0 && (P.xT -= dt) <= 0) {
    const r = (150 + 50 * P.xl) * (1 + 0.05 * wpn);
    slashes.push({ x: P.x, y: P.y - 50, face: P.face, r: r * 1.1, life: 0.3, max: 0.3, a0: -0.8, span: 2.0, dirSign: -1, full: false, big: true, wl: wpn });
    slashHit(P.x + P.face * 20, P.y - 50, r + 10, P.face, false, (60 + 120 * P.xl) * wd(), 380); sfx.slash(true);
  }
  if (P.dashT > 0) { P.dashT -= dt; P.vx = P.face * 700; P.vy = 0;
    if (Math.random() < 0.8) parts.push({ x: P.x, y: P.y - rnd(10, 70), vx: 0, vy: 0, life: 0.3, max: 0.3, col: wcol()[2], sz: 5, grav: 0 });
  } else if (P.thrustT > 0) {
    P.vx = P.face * (850 + 450 * P.thrustLvl); P.vy = 0;
    thrustHits();
    parts.push({ x: P.x, y: P.y - rnd(30, 70), vx: -P.face * rnd(40, 200), vy: rnd(-30, 30), life: 0.35, max: 0.35, col: Math.random() < 0.5 ? wcol()[2] : '#fff', sz: rnd(3, 6), grav: 0 });
  } else {
    const spd = (P.bHaste > 0 ? 330 : 250) * (has('boots') ? 1.12 : 1) * (P.chg > 0.3 || P.chg2 > WAVE_MIN ? 0.45 : 1);
    if (dir) { P.face = dir; P.vx += (dir * spd - P.vx) * Math.min(1, 12 * dt); }
    else P.vx *= Math.pow(0.0008, dt);
    P.vy += 1700 * dt;
    if (P.slam && P.vy > 0) P.vy += 3500 * dt;
  }
  P.x += P.vx * dt; P.y += P.vy * dt;
  if (P.y >= GROUND) { P.y = GROUND; P.vy = 0; P.ground = true; } else P.ground = false;
  if (P.slam && P.ground) slamLand();
  P.anim += dt * (Math.abs(P.vx) > 20 ? 10 : 2);

  // vortex skill: repeated 360 hits
  if (P.vortex > 0) {
    P.spin = 0.1;
    if (Math.floor(P.vortex * 20) !== Math.floor((P.vortex + dt) * 20) && Math.floor(P.vortex * 20) % 2 === 0) {
      slashHit(P.x, P.y - 44, 170, P.face, true, 38 * skm('vortex'), 300);
    }
    if (Math.random() < 0.7) {
      slashes.push({ x: P.x, y: P.y - 44, face: P.face, r: rnd(90, 170), life: 0.25, max: 0.25, a0: rnd(0, 6.28), span: rnd(2, 4), dirSign: 1, full: true, big: true, wl: wpn });
    }
  }

  // waves (shadow wave projectile)
  for (const w of waves) {
    w.life -= dt; w.x += w.face * 620 * dt;
    if (Math.random() < 0.9) parts.push({ x: w.x, y: GROUND - rnd(0, 110 * w.sz), vx: -w.face * rnd(0, 80), vy: rnd(-100, 0), life: 0.4, max: 0.4, col: Math.random() < 0.5 ? wcol()[2] : '#fff', sz: rnd(2, 4), grav: 0 });
    for (const e of enemies) {
      if (e.dead || w.hit.has(e)) continue;
      if (Math.abs(e.x - w.x) < 40 * w.sz + e.w / 2 && e.y - e.h < GROUND && e.y > GROUND - 220 * w.sz) { w.hit.add(e); hurtEnemy(e, w.dmg, w.face, 300 + 150 * (w.sz - 1)); }
    }
    for (const sh of shots) if (!sh.mine && Math.abs(sh.x - w.x) < 40 * w.sz && sh.y > GROUND - 220 * w.sz) { sh.life = 0; sparks(sh.x, sh.y, 8, '#8df', 200); }
  }
  waves = waves.filter(w => w.life > 0);

  // spawn
  spawnT -= dt;
  const bossAlive = enemies.some(e => e.boss);
  const tier = (stage - 1) * WAVES + wave;
  const minions = enemies.filter(e => !e.boss).length;
  const cap = bossAlive ? 3 + Math.floor(stage / 4) : Math.min(16, 4 + Math.floor(tier / 2.2));
  if (spawnT <= 0 && minions < cap && (phase === 'wave' || bossAlive)) { spawn(); spawnT = Math.max(0.4, 1.7 - tier * 0.045) * (bossAlive ? 2 : 1) * diffM().spawn; }

  // enemies
  while (spawnQ.length) { const [t, x] = spawnQ.pop(), m = makeEnemy(t, x); m.kb = (x < P.x ? -1 : 1) * 260; }
  for (const e of enemies) {
    e.flash = Math.max(0, e.flash - dt);
    { const hv = e.hp / e.maxHp; e.trail = e.trail === undefined || hv >= e.trail ? hv : Math.max(hv, e.trail - 0.6 * dt); }
    e.kb *= Math.pow(e.boss ? 0.0001 : 0.01, dt);
    e.x += e.kb * dt;
    const dx = P.x - e.x, dist = Math.abs(dx);
    e.face = Math.sign(dx) || 1;
    e.atkCd -= dt;
    if (e.stun > 0 && !e.boss) e.stun -= dt;
    else if (e.boss) bossAI(e, dt);
    else if (e.t === 'bat') {
      e.diveCd -= dt;
      if (e.diveCd <= 0) { e.dive = 0.7; e.diveCd = rnd(2, 3.5); }
      let tx = P.x + Math.sin(time * 1.7 + e.ph * 3) * 160, ty = GROUND - 130 + Math.sin(time * 3 + e.ph) * 30, m = 1;
      if (e.dive > 0) { e.dive -= dt; tx = P.x; ty = P.y - 30; m = 1.9; }
      e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), e.spd * m * dt);
      e.y += (ty - e.y) * Math.min(1, 3 * dt);
      if (e.atkCd <= 0 && Math.hypot(P.x - e.x, (P.y - 30) - (e.y - 12)) < 30) { hurtPlayer(e.dmg, e.face); e.atkCd = 1; }
    } else if (e.t === 'archer') {
      if (e.atk > 0) {
        e.atk -= dt;
        if (e.atk <= 0) {
          const sx = e.x + e.face * 24, sy = e.y - 44, t = Math.max(0.2, Math.abs(P.x - sx) / 340);
          shots.push({ x: sx, y: sy, vx: e.face * 340, vy: clamp(((P.y - 40) - sy) / t, -250, 250), dmg: e.dmg, life: 3, col: '#b8ff60' });
          sfx.bow();
        }
      } else {
        if (dist < 260) e.x -= e.face * e.spd * dt; else if (dist > 380) e.x += e.face * e.spd * dt;
        if (e.atkCd <= 0 && dist < 520) { e.atk = e.wu; e.atkCd = rnd(2, 3); }
      }
    } else if (e.t === 'hound') {
      if (e.pounce > 0) {
        e.pounce -= dt; e.x += e.pdir * 430 * dt; e.y = GROUND - Math.sin((1 - Math.max(0, e.pounce) / 0.55) * Math.PI) * 80;
        if (e.pounce <= 0) { e.y = GROUND; e.atkCd = rnd(1.2, 2); }
        if (Math.hypot(P.x - e.x, (P.y - 30) - (e.y - 17)) < 34) hurtPlayer(e.dmg, e.pdir);
      } else if (e.atk > 0) {
        e.atk -= dt; if (e.atk <= 0) { e.pounce = 0.55; e.pdir = e.face; }
      } else {
        e.x += e.face * e.spd * dt;
        if (dist < 280 && e.atkCd <= 0) e.atk = 0.4;
      }
    } else if (e.t === 'mage') {
      e.y = e.baseY + Math.sin(time * 2 + e.ph) * 12;
      if (e.atk > 0) {
        e.atk -= dt;
        if (e.atk <= 0) {
          const base = Math.atan2((P.y - 40) - (e.y - 40), P.x - e.x);
          for (let i = -1; i <= 1; i++) { const a = base + i * 0.28; shots.push({ x: e.x + e.face * 16, y: e.y - 40, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, dmg: e.dmg, life: 3.5, col: '#c070ff' }); }
          sfx.bow();
        }
      } else {
        if (dist < 300) e.x -= e.face * e.spd * dt; else if (dist > 460) e.x += e.face * e.spd * dt;
        if (e.atkCd <= 0 && dist < 620) { e.atk = e.wu; e.atkCd = rnd(2.4, 3.4); }
      }
    } else if (e.t === 'bomber') {
      if (e.fuse > 0) {
        e.fuse -= dt; e.flash = Math.floor(e.fuse * 14) % 2 ? 0.1 : 0;
        if (e.fuse <= 0) { explode(e.x, e.y - 17, 95, e.dmg); e.dead = true; progressKill(); }
      } else {
        e.x += e.face * e.spd * dt;
        if (dist < 55 && Math.abs(P.y - e.y) < 60) { e.fuse = 0.55; sfx.fuse(); }
      }
    } else {
      if (e.atk > 0) {
        e.atk -= dt;
        if (e.atk <= 0 && e.t === 'golem') {       // ground slam: two shockwaves roll out
          quakes.push({ x: e.x - 30, dir: -1, life: 0.8, hit: false }, { x: e.x + 30, dir: 1, life: 0.8, hit: false });
          shake = Math.max(shake, 9); sparks(e.x, GROUND, 16, '#ff8a40', 320); sfx.boom();
        } else if (e.atk <= 0 && dist < e.w + 38 && P.y - e.y < 40 && e.y - P.y < e.h + 20) hurtPlayer(e.dmg, e.face);
      } else {
        const reach = e.t === 'golem' ? 150 : e.w + 20;
        if (dist > reach) e.x += e.face * e.spd * dt;
        else if (e.atkCd <= 0) { e.atk = e.wu || 0.4; e.atkCd = rnd(1.1, 1.8) * (e.t === 'golem' ? 1.6 : 1); }
      }
      if (e.t === 'wraith') {
        e.y = e.baseY + Math.sin(time * 2 + e.ph) * 14;
        e.baseY += ((GROUND - 50 - e.baseY) * 0.15) * dt;
      }
    }
  }
  enemies = enemies.filter(e => !e.dead);

  // enemy projectiles
  for (const sh of shots) {
    sh.life -= dt; sh.x += sh.vx * dt; sh.y += sh.vy * dt;
    parts.push({ x: sh.x, y: sh.y, vx: 0, vy: 0, life: 0.2, max: 0.2, col: sh.col, sz: 4, grav: 0 });
    if (sh.mine) {
      for (const e of enemies) {
        if (e.dead || Math.hypot(sh.x - e.x, sh.y - (e.y - e.h / 2)) > e.w / 2 + 16) continue;
        hurtEnemy(e, sh.dmg || 90, Math.sign(sh.vx), 260); sh.life = 0; break;
      }
    } else if (Math.hypot(sh.x - P.x, sh.y - (P.y - 40)) < 22) { sh.life = 0; hurtPlayer(sh.dmg, Math.sign(sh.vx) || 1); }
    if (sh.y > GROUND) { sh.life = 0; if (sh.fall) { sparks(sh.x, GROUND, 14, '#ff8a40', 300); shake = Math.max(shake, 4); } }
  }
  shots = shots.filter(sh => sh.life > 0);

  // boss ground shockwaves
  for (const q of quakes) {
    q.life -= dt; q.x += q.dir * 300 * dt;
    parts.push({ x: q.x, y: GROUND - rnd(0, 30), vx: rnd(-40, 40), vy: rnd(-160, -40), life: 0.4, max: 0.4, col: '#ff8a40', sz: 4, grav: 400 });
    if (!q.hit && Math.abs(P.x - q.x) < 26 && P.y > GROUND - 36) { q.hit = true; hurtPlayer(20, q.dir); }
  }
  quakes = quakes.filter(q => q.life > 0);
  for (const m of marks) {
    m.t -= dt;
    if (m.t <= 0) { m.done = true; shots.push({ x: m.x, y: GROUND - 440, vx: 0, vy: 1000, dmg: 16, life: 1, col: '#ff7040', fall: true }); }
  }
  marks = marks.filter(m => !m.done);
  if (banner && (banner.t -= dt) <= 0) banner = null;
  if (phase === 'clear' && (stageT -= dt) <= 0) openShop();
  if (phase === 'won' && (stageT -= dt) <= 0) { phase = 'done'; endGame('won'); }

  // loot
  for (const o of orbs) {
    o.age += dt; o.vy += 900 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= Math.pow(0.3, dt);
    if (o.y > GROUND - 8) { o.y = GROUND - 8; o.vy *= -0.35; if (Math.abs(o.vy) < 40) o.vy = 0; }
    const d = Math.hypot(o.x - P.x, o.y - (P.y - 30));
    if (o.age > 0.5 && d < (has('magnet') ? 300 : 150)) { const k = Math.min(1, 6 * dt); o.x += (P.x - o.x) * k; o.y += ((P.y - 30) - o.y) * k; }
    if (d < 38 && o.age > 0.25) pickup(o);
    if (o.age > 14) o.gone = true;
  }
  orbs = orbs.filter(o => !o.gone);

  // meteors, clone, gravity wells, lances
  for (const m of meteors) {
    m.t -= dt;
    if (m.t <= 0) {
      m.done = true;
      slashHit(m.x, GROUND - 40, m.r, 1, true, m.dmg, 520);
      sparks(m.x, GROUND - 20, 40, '#ff8a20', 520); sparks(m.x, GROUND - 20, 16, '#fff', 360);
      shake = Math.max(shake, 14); flash = 0.25; hitstop = Math.max(hitstop, 0.06); sfx.boom();
    }
  }
  meteors = meteors.filter(m => !m.done);
  for (const w of wells) {
    w.t -= dt; w.tick -= dt;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = w.x - e.x;
      if (Math.abs(dx) < w.pr && Math.abs(dx) > 8) e.x += Math.sign(dx) * (e.boss ? 30 : 200) * w.str * dt;
    }
    if (w.tick <= 0) {
      w.tick = 0.3;
      for (const e of enemies) if (!e.dead && Math.hypot(e.x - w.x, e.y - e.h / 2 - w.y) < w.hr) hurtEnemy(e, 20 * skm('well') * w.dm, Math.sign(w.x - e.x) || 1, 0, false);
    }
    if (Math.random() < 0.8) { const a = rnd(0, 6.28), d = rnd(90, 170) * w.sc; parts.push({ x: w.x + Math.cos(a) * d, y: w.y + Math.sin(a) * d * 0.7, vx: -Math.cos(a) * d * 2.4, vy: -Math.sin(a) * d * 1.7, life: 0.4, max: 0.4, col: wcol()[2], sz: 3, grav: 0 }); }
    if (w.t <= 0) {
      w.done = true; slashHit(w.x, w.y, w.hr + 20, 1, true, 70 * skm('well') * w.dm, 300);
      sparks(w.x, w.y, 28, wcol()[2], 420); shake = Math.max(shake, 8); sfx.boom();
    }
  }
  wells = wells.filter(w => !w.done);
  for (const b of beams) b.life -= dt;
  beams = beams.filter(b => b.life > 0);
  // spirit discs & lightning
  for (const b of boomers) {
    b.t += dt; const D = b.D * Math.sin(Math.PI * Math.min(1, b.t / b.T));
    b.x = P.x + b.face * D; b.y = P.y - 50;
    if (!b.reset && b.t > b.T / 2) { b.reset = true; b.hit = new Set(); }
    if (Math.random() < 0.6) parts.push({ x: b.x, y: b.y + rnd(-10, 10), vx: 0, vy: 0, life: 0.25, max: 0.25, col: wcol()[2], sz: 3, grav: 0 });
    for (const e of enemies) {
      if (e.dead || b.hit.has(e)) continue;
      if (Math.abs(e.x - b.x) < e.w / 2 + 28 * b.sz && e.y - e.h < b.y + 20 * b.sz && e.y > b.y - 30 * b.sz) { b.hit.add(e); hurtEnemy(e, b.dmg, b.face, 200); }
    }
    for (const sh of shots) if (!sh.mine && Math.hypot(sh.x - b.x, sh.y - b.y) < 36) { sh.life = 0; sparks(sh.x, sh.y, 6, '#fff', 160); }
  }
  boomers = boomers.filter(b => b.t < b.T);
  for (const b of bolts) b.life -= dt;
  bolts = bolts.filter(b => b.life > 0);
  // effects
  for (const s of slashes) s.life -= dt;
  slashes = slashes.filter(s => s.life > 0);
  for (const p of parts) { p.life -= dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  parts = parts.filter(p => p.life > 0);
  for (const t of texts) { t.life -= dt; t.y += t.vy * dt; t.vy *= Math.pow(0.1, dt); }
  texts = texts.filter(t => t.life > 0);

  // camera
  camX += (P.x + P.face * 60 - W / 2 - camX) * Math.min(1, 5 * dt);
}



/* ======================================================================
   BACKGROUND
   ====================================================================== */
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
  { // 6 - frostbound keep: icy blue dusk
    sky: ['#07142a', '#1b4a78', '#7ec0e0'], moon: { x: 300, y: 110, r: 46, c1: '#f4fbff', c2: '#a8d8f0', glow: '170,220,255' },
    ridge: ['#2a5a82', '#1f4a6c'], far: '#173a58', mid: '#0d2438', tree: '#08182a', ground: '#07111c',
    mist: '140,200,240', fog: ['130,190,235', '170,215,250'], farKind: 'spires', midKind: 'ruins', trees: 0.5, ambient: 'dust',
  },
  { // 7 - drowned marsh: toxic green haze
    sky: ['#0a1410', '#23402a', '#6a8a3a'], moon: { x: 820, y: 120, r: 38, c1: '#e0f0a0', c2: '#788a30', glow: '200,230,90' },
    ridge: ['#2e4a2a', '#243c22'], far: '#1a2e1a', mid: '#101e12', tree: '#0a140b', ground: '#080f08',
    mist: '120,170,70', fog: ['110,160,70', '150,200,90'], farKind: 'forest', midKind: 'garden', trees: 1.5, ambient: 'fireflies',
  },
  { // 8 - molten forge: furnace glow
    sky: ['#1a0400', '#5a1400', '#ff6a10'], moon: { x: 480, y: 150, r: 70, c1: '#ffe0a0', c2: '#ff7a20', glow: '255,110,20' },
    ridge: ['#5a1c08', '#451406'], far: '#33100a', mid: '#200a06', tree: '#160604', ground: '#100403',
    mist: '255,110,30', fog: ['235,100,30', '255,150,50'], farKind: 'towers', midKind: 'crypt', trees: 0.3, ambient: 'embers',
  },
  { // 9 - void sanctum: violet eclipse
    sky: ['#0a0020', '#2a0a5a', '#8a2ac0'], moon: { x: 300, y: 130, r: 50, eclipse: true, glow: '200,60,255' },
    ridge: ['#3a1068', '#2c0c52'], far: '#220a48', mid: '#140630', tree: '#0c0420', ground: '#08031a',
    mist: '180,70,240', fog: ['160,70,230', '200,100,255'], farKind: 'shards', midKind: 'cathedral', trees: 0.2, ambient: 'motes',
  },
  { // 10 - the endless abyss: a golden eclipse in the black
    sky: ['#000000', '#14081c', '#3a1030'], moon: { x: 480, y: 130, r: 80, eclipse: true, glow: '255,220,140' },
    ridge: ['#1c0a22', '#14061a'], far: '#10040f', mid: '#0a020a', tree: '#060106', ground: '#040104',
    mist: '255,200,120', fog: ['200,150,90', '255,210,130'], farKind: 'shards', midKind: 'throne', trees: 0.2, ambient: 'embers',
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


/* ======================================================================
   DRAW
   ====================================================================== */
// ---------- drawing: characters ----------
function eyes(x, y, col, gap = 5, sz = 2.6, glow = 10) {
  g.save(); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = glow;
  g.beginPath(); g.ellipse(x - gap, y, sz * 1.4, sz * 0.8, 0, 0, 7); g.ellipse(x + gap, y, sz * 1.4, sz * 0.8, 0, 0, 7); g.fill(); g.restore();
}
// each weapon has its own blade; origin is the hand, the blade points along +x
function drawPurpleBlade(wi, c, body) {
  const gr = g.createLinearGradient(16, 0, 98, 0); gr.addColorStop(0, body); gr.addColorStop(1, `rgba(${c[0]},0.8)`);
  g.fillStyle = gr;
  if (wi === 2) {   // crescent falchion: broad curved blade, moon guard
    g.beginPath(); g.moveTo(15, 1); g.bezierCurveTo(40, -21, 78, -21, 100, -2); g.bezierCurveTo(74, -6, 44, -1, 15, 9); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = `rgba(${c[1]},0.9)`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(20, 2); g.bezierCurveTo(44, -13, 76, -14, 95, -3); g.stroke();
    g.lineWidth = 3.5; g.beginPath(); g.arc(5, 4, 12, -1.25, 1.25); g.stroke();
    g.fillStyle = `rgba(${c[1]},0.9)`; g.beginPath(); g.arc(38, -4, 2, 0, 7); g.arc(56, -7, 1.6, 0, 7); g.fill();
  } else {          // voidforged: a short blade, its tip shattered into floating shards
    g.beginPath(); g.moveTo(15, 0); g.lineTo(27, -8); g.lineTo(62, -5); g.lineTo(74, 2); g.lineTo(62, 9); g.lineTo(27, 8); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = `rgba(${c[1]},0.9)`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(22, 2); g.lineTo(66, 2); g.stroke();
    g.fillStyle = `rgba(${c[1]},0.95)`;
    for (let k = 0; k < 3; k++) { const bx = 84 + k * 13, by = 2 + Math.sin(time * 5 + k * 1.7) * 3, sz = 7 - k * 1.8; g.beginPath(); g.moveTo(bx - sz, by - sz * 0.7); g.lineTo(bx + sz, by); g.lineTo(bx - sz, by + sz * 0.7); g.closePath(); g.fill(); }
    g.fillStyle = body; g.strokeStyle = `rgba(${c[1]},0.9)`; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(15, -13); g.lineTo(21, 2); g.lineTo(15, 17); g.lineTo(9, 2); g.closePath(); g.fill(); g.stroke();
  }
}
function drawSword(wi, glow) {
  const c = WPN[wi].c, body = ['#0a1830', '#0a2030', '#160c34', '#1c0630', '#2a0610', '#2a1c06'][wi];
  g.strokeStyle = '#04020a'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(18, 4); g.stroke();
  g.shadowColor = c[2]; g.shadowBlur = glow;
  g.fillStyle = body; g.strokeStyle = `rgba(${c[1]},0.95)`; g.lineWidth = 1.2; g.lineJoin = 'round';
  if (wi === 2 || wi === 3) { drawPurpleBlade(wi, c, body); return; }
  g.beginPath();
  if (wi === 0) { g.moveTo(16, 0); g.lineTo(68, -3); g.lineTo(76, 2); g.lineTo(68, 6); g.lineTo(16, 7); }
  else if (wi === 1) { g.moveTo(16, -1); g.lineTo(78, -4); g.lineTo(88, 2); g.lineTo(78, 7); g.lineTo(16, 8); }
  else if (wi === 2) { g.moveTo(16, 0); g.quadraticCurveTo(52, -18, 88, -3); g.quadraticCurveTo(56, -3, 16, 8); }
  else if (wi === 3) { g.moveTo(16, 0); g.lineTo(30, -6); g.lineTo(38, -2); g.lineTo(50, -10); g.lineTo(58, -4); g.lineTo(72, -11); g.lineTo(92, 2); g.lineTo(72, 8); g.lineTo(58, 5); g.lineTo(50, 9); g.lineTo(38, 5); g.lineTo(30, 9); g.lineTo(16, 7); }
  else if (wi === 4) { g.moveTo(16, -3); g.lineTo(72, -9); g.lineTo(92, 1); g.lineTo(72, 11); g.lineTo(16, 11); }
  else { g.moveTo(14, -5); g.lineTo(86, -10); g.lineTo(108, 1); g.lineTo(86, 13); g.lineTo(14, 10); }
  g.closePath(); g.fill(); g.stroke();
  if (wi >= 1) {            // cross-guard
    g.strokeStyle = `rgba(${c[1]},0.9)`; g.lineWidth = wi === 5 ? 4 : 3; g.beginPath(); g.moveTo(15, wi === 5 ? -13 : -8); g.lineTo(15, wi === 5 ? 18 : 15); g.stroke();
  }
  if (wi === 5) { g.fillStyle = c[2]; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(34 + k * 18, 1, 2.2, 0, 7); g.fill(); } }
  else if (wi === 4) { g.strokeStyle = `rgba(${c[1]},0.8)`; g.lineWidth = 1.5; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(34 + k * 14, -5 - k); g.lineTo(38 + k * 14, 1); g.stroke(); } }
  else if (wi === 2) { g.strokeStyle = `rgba(${c[1]},0.8)`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(20, 2); g.quadraticCurveTo(54, -9, 84, -2); g.stroke(); }
  else { g.strokeStyle = `rgba(${c[1]},0.9)`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(18, 3); g.lineTo(wi === 1 ? 82 : wi === 3 ? 84 : 74, 2); g.stroke(); }
}
function drawPlayer() {
  const f = P.face, bob = P.ground ? Math.sin(P.anim) * (Math.abs(P.vx) > 20 ? 3 : 1.2) : 0;
  g.save(); g.translate(P.x - camX, P.y);
  if (P.inv > 0 && Math.floor(time * 30) % 2 && P.hurt <= 0 && P.vortex <= 0) g.globalAlpha = 0.45;
  // shadow
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.ellipse(0, 2, 24, 5, 0, 0, 7); g.fill();
  g.scale(f, 1);
  if (P.spin > 0 || P.vortex > 0) g.rotate(time * 40);
  const lean = clamp(P.vx / 700, -0.3, 0.3);
  g.translate(0, -bob); g.rotate(lean);
  g.fillStyle = '#04020a';
  // cape
  g.beginPath(); g.moveTo(-6, -66);
  const wv = Math.sin(time * 9) * 4 + (Math.abs(P.vx) > 20 ? 10 : 0) + (P.ground ? 0 : 8);
  g.quadraticCurveTo(-26 - wv, -38, -34 - wv * 1.4, -4 + (P.ground ? 0 : -14));
  g.lineTo(-24 - wv, -10); g.lineTo(-20 - wv * 0.8, 0); g.lineTo(-8, -6); g.lineTo(4, -40); g.fill();
  // legs
  const ls = P.ground ? Math.sin(P.anim) * (Math.abs(P.vx) > 20 ? 9 : 0) : 6;
  g.lineCap = 'round'; g.strokeStyle = '#04020a'; g.lineWidth = 8;
  g.beginPath(); g.moveTo(-3, -28); g.lineTo(-5 + ls, -3); g.moveTo(5, -28); g.lineTo(7 - ls, -3); g.stroke();
  // torso
  g.beginPath(); g.moveTo(-10, -62); g.lineTo(11, -62); g.lineTo(8, -26); g.lineTo(-8, -26); g.fill();
  // pauldrons
  g.beginPath(); g.moveTo(-14, -60); g.lineTo(-4, -66); g.lineTo(-6, -52); g.fill();
  g.beginPath(); g.moveTo(15, -60); g.lineTo(5, -68); g.lineTo(10, -50); g.fill();
  // head + horns
  g.beginPath(); g.arc(2, -72, 9, 0, 7); g.fill();
  g.beginPath(); g.moveTo(-5, -77); g.lineTo(-10, -92); g.lineTo(-1, -80); g.fill();
  g.beginPath(); g.moveTo(8, -78); g.lineTo(15, -93); g.lineTo(4, -81); g.fill();
  eyes(5, -72, wcol()[2], 3.2, 2.2, 14);
  // sword arm + sword
  const sw = P.atkT > 0 ? (0.22 - P.atkT) / 0.22 : 0;
  const ang = P.thrustT > 0 ? -0.04 : P.chg > 0.3 ? Math.PI + 0.25 : P.atkT > 0 ? -1.6 + sw * 3.2 * (P.step % 2 === 1 ? -1 : 1) : -0.5 + Math.sin(P.anim * 0.5) * 0.08;
  g.save(); g.translate(8, -54); g.rotate(ang);
  drawSword(wpn, P.atkT > 0 ? 18 : 6);
  g.restore();
  g.restore();
}
function drawComboPips() {   // five embers beside the knight: how far along the 5-hit chain you are
  const a = clamp((P.atkT + 0.35) * 3, 0, 1);
  if (a <= 0) return;
  const n = COMBO.length, x0 = P.x - camX - (n - 1) * 9, y = P.y - 116;
  g.save(); g.globalAlpha = a;
  for (let i = 0; i < n; i++) {
    const on = i <= P.step, last = i === n - 1;
    g.beginPath(); g.arc(x0 + i * 18, y, last ? 6.5 : 4.5, 0, 7);
    g.fillStyle = on ? (last ? '#ff5a30' : wcol()[2]) : 'rgba(255,255,255,0.14)';
    if (on) { g.shadowColor = g.fillStyle; g.shadowBlur = 10; }
    g.fill(); g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1; g.stroke();
  }
  g.restore();
}
function drawEnemy(e0) {
  const sc = e0.elite ? 1.3 : 1, e = e0.elite ? Object.assign({}, e0, { w: e0.w / sc, h: e0.h / sc }) : e0;
  g.save(); g.translate(e.x - camX, e.y);
  if (sc !== 1) g.scale(sc, sc);
  if (e0.elite) { g.shadowColor = '#ff3050'; g.shadowBlur = 20; }
  if (e.fade) g.globalAlpha = 1 - 0.8 * e.fade;
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(0, (e.fly ? GROUND - e.y : 0) + 2, e.w * 0.7, 5, 0, 0, 7); g.fill();
  g.scale(e.face, 1);
  const col = e.flash > 0 ? '#e8f8ff' : '#0b0612';
  g.fillStyle = col;
  const wind = e.atk > 0 ? 1 - e.atk / (e.wu || 0.4) : 0;
  const ph = time * 7 + e.ph;
  if (e.t === 'wraith') {
    const sw = Math.sin(ph) * 5;
    g.beginPath(); g.moveTo(0, -e.h); g.quadraticCurveTo(22, -e.h + 12, 18 + sw, -4);
    for (let i = 0; i < 5; i++) g.lineTo(14 - i * 7 + sw * (i % 2 ? -1 : 1), -4 + (i % 2) * 14);
    g.quadraticCurveTo(-22, -e.h + 12, 0, -e.h); g.fill();
    // arms
    g.strokeStyle = col; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(8, -e.h + 24); g.lineTo(26 + wind * 16, -e.h + 34 + wind * 8); g.lineTo(34 + wind * 18, -e.h + 40); g.stroke();
    eyes(6, -e.h + 12, '#ff2a50', 4, 2.4, 12);
  } else if (e.t === 'beast') {
    const lg = Math.sin(ph * 1.5) * 8;
    g.strokeStyle = col; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-14, -16); g.lineTo(-18 + lg, 0); g.moveTo(-6, -16); g.lineTo(-6 - lg, 0);
    g.moveTo(10, -16); g.lineTo(12 - lg, 0); g.moveTo(18, -16); g.lineTo(22 + lg, 0); g.stroke();
    g.beginPath(); g.ellipse(0, -24, 26, 13, 0, 0, 7); g.fill();
    // spine spikes
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 7 - 3, -34); g.lineTo(i * 7, -44 - (3 - Math.abs(i)) * 2); g.lineTo(i * 7 + 3, -34); g.fill(); }
    // head
    g.save(); g.translate(26, -28 + wind * 6); g.rotate(wind * 0.5);
    g.beginPath(); g.moveTo(-8, -10); g.lineTo(18, -2); g.lineTo(20, 6); g.lineTo(-8, 10); g.fill();
    g.fillStyle = '#c8c0d0'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(8 + i * 3, 3); g.lineTo(9.5 + i * 3, 9); g.lineTo(11 + i * 3, 3); g.fill(); }
    g.restore();
    eyes(30, -34, '#ff9020', 3, 2.2, 10);
    // tail
    g.beginPath(); g.moveTo(-22, -26); g.quadraticCurveTo(-40, -36 + lg, -46, -22); g.lineWidth = 5; g.stroke();
    // exposed ribs
    g.strokeStyle = 'rgba(190,180,200,0.35)'; g.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.arc(i * 6, -24, 9, 0.3, 2.8); g.stroke(); }
  } else if (e.t === 'bat') {
    const fl = Math.sin(time * 22 + e.ph) * 14;
    g.beginPath(); g.ellipse(0, -12, 7, 9, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-5, -19); g.lineTo(-7, -27); g.lineTo(-1, -20); g.moveTo(5, -19); g.lineTo(7, -27); g.lineTo(1, -20); g.fill();
    for (const sd of [-1, 1]) {
      g.beginPath(); g.moveTo(sd * 3, -14); g.quadraticCurveTo(sd * 18, -30 - fl, sd * 32, -14 - fl * 0.5);
      g.quadraticCurveTo(sd * 22, -12, sd * 16, -5); g.quadraticCurveTo(sd * 10, -10, sd * 3, -5); g.fill();
    }
    eyes(0, -14, '#ff3040', 3, 1.8, 8);
  } else if (e.t === 'archer') {
    const st = Math.sin(ph) * 4;
    g.strokeStyle = col; g.lineCap = 'round'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-2, -28); g.lineTo(-6 + st, 0); g.moveTo(4, -28); g.lineTo(8 - st, 0); g.stroke();
    g.lineWidth = 7; g.beginPath(); g.moveTo(0, -26); g.lineTo(0, -50); g.stroke();
    g.beginPath(); g.arc(1, -56, 8, 0, 7); g.fill();
    g.strokeStyle = 'rgba(200,195,210,0.4)'; g.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-4, -32 - i * 6); g.lineTo(4, -32 - i * 6); g.stroke(); }
    g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.arc(18, -44, 22, -1.2, 1.2); g.stroke();
    g.strokeStyle = 'rgba(200,255,160,0.7)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(26, -64.5); g.lineTo(26 - wind * 12, -44); g.lineTo(26, -23.5); g.stroke();
    if (e.atk > 0) { g.strokeStyle = '#b8ff60'; g.lineWidth = 2; g.beginPath(); g.moveTo(26 - wind * 12, -44); g.lineTo(52, -44); g.stroke(); }
    eyes(4, -57, '#9aff40', 3, 2, 8);
  } else if (e.t === 'bomber') {
    const lg = Math.sin(ph * 2) * 6;
    g.strokeStyle = col; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-5, -10); g.lineTo(-7 + lg, 0); g.moveTo(5, -10); g.lineTo(7 - lg, 0); g.stroke();
    g.beginPath(); g.arc(0, -19, 13, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-9, -28); g.lineTo(-13, -38); g.lineTo(-3, -30); g.moveTo(9, -28); g.lineTo(13, -38); g.lineTo(3, -30); g.fill();
    if (e.fuse > 0) { g.save(); g.strokeStyle = '#ff6a20'; g.shadowColor = '#f80'; g.shadowBlur = 12; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-8, -14); g.lineTo(0, -20); g.lineTo(-3, -10); g.lineTo(8, -16); g.stroke(); g.restore(); }
    eyes(4, -21, '#ffa020', 4, 2.4, 10);
    g.fillStyle = '#ffd040'; g.shadowColor = '#f80'; g.shadowBlur = 10; g.beginPath(); g.arc(0, -34 - Math.abs(Math.sin(time * 20)) * 3, 2.5, 0, 7); g.fill(); g.shadowBlur = 0;
  } else if (e.t === 'hound') {
    const lg = Math.sin(ph * 2) * 7, cr = wind * 6, air = e.pounce > 0 ? -0.35 : 0;
    g.strokeStyle = col; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-12, -14 + cr); g.lineTo(-16 + lg, 0); g.moveTo(-4, -14 + cr); g.lineTo(-4 - lg, 0); g.moveTo(10, -14 + cr); g.lineTo(12 - lg, 0); g.moveTo(17, -14 + cr); g.lineTo(21 + lg, 0); g.stroke();
    g.save(); g.rotate(air); g.beginPath(); g.ellipse(0, -20 + cr, 22, 10, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-18, -22 + cr); g.quadraticCurveTo(-34, -30 + lg, -40, -18); g.lineWidth = 4; g.stroke();
    g.save(); g.translate(22, -26 + cr + wind * 4);
    g.beginPath(); g.moveTo(-6, -8); g.lineTo(16, -2); g.lineTo(16, 5); g.lineTo(-6, 8); g.fill();
    g.beginPath(); g.moveTo(-4, -8); g.lineTo(-2, -18); g.lineTo(4, -8); g.moveTo(2, -8); g.lineTo(6, -17); g.lineTo(10, -6); g.fill();
    g.restore(); eyes(26, -31 + cr, '#ff3030', 2.5, 2, 10); g.restore();
  } else if (e.t === 'mage') {
    const sw = Math.sin(ph) * 3;
    g.beginPath(); g.moveTo(0, -e.h + 10); g.quadraticCurveTo(20, -e.h + 24, 18 + sw, -2);
    for (let i = 0; i < 4; i++) g.lineTo(12 - i * 8 + sw * (i % 2 ? -1 : 1), -2 + (i % 2) * 10);
    g.quadraticCurveTo(-20, -e.h + 24, 0, -e.h + 10); g.fill();
    g.beginPath(); g.arc(1, -e.h + 8, 10, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-9, -e.h + 10); g.lineTo(1, -e.h - 14); g.lineTo(11, -e.h + 10); g.fill();
    g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(22, -8); g.lineTo(22, -e.h + 16); g.stroke();
    const pr = 6 + wind * 8;
    g.fillStyle = '#c070ff'; g.shadowColor = '#b050ff'; g.shadowBlur = 14; g.beginPath(); g.arc(22, -e.h + 12, pr, 0, 7); g.fill(); g.shadowBlur = 0;
    eyes(5, -e.h + 8, '#d070ff', 3.4, 2, 10);
  } else if (e.t === 'slime' || e.t === 'slimelet') {
    const k = e.w / 36, sq = Math.sin(ph * 1.2) * 3 * k + wind * 4 * k;
    g.fillStyle = e.flash > 0 ? col : '#123a24';
    g.beginPath(); g.moveTo(-e.w * 0.6, 0); g.quadraticCurveTo(-e.w * 0.7, -e.h - sq, 0, -e.h - sq); g.quadraticCurveTo(e.w * 0.7, -e.h - sq, e.w * 0.6, 0); g.closePath(); g.fill();
    g.fillStyle = 'rgba(160,255,170,0.25)'; g.beginPath(); g.ellipse(-e.w * 0.18, -e.h * 0.7, e.w * 0.14, e.h * 0.12, -0.5, 0, 7); g.fill();
    eyes(3 * k, -e.h * 0.5, '#a0ff60', 5 * k, 2.6 * k, 10);
  } else if (e.t === 'golem') {
    const st = Math.sin(ph * 0.6) * 2, up = wind * 1.9;
    g.fillRect(-26, -34, 20, 34); g.fillRect(6, -34, 20, 34);
    g.beginPath(); g.moveTo(-30, -e.h + 30); g.lineTo(30, -e.h + 30); g.lineTo(38, -40); g.lineTo(-38, -40); g.fill();
    g.beginPath(); g.moveTo(-14, -e.h + 30); g.lineTo(-10, -e.h + 6); g.lineTo(12, -e.h + 6); g.lineTo(16, -e.h + 30); g.fill();
    g.save(); g.translate(26, -e.h + 40); g.rotate(-0.3 - up);
    g.fillRect(0, -8, 38, 16); g.fillRect(30, -18, 26, 34); g.restore();
    g.save(); g.translate(-26, -e.h + 40); g.rotate(2.6); g.fillRect(0, -8, 32, 14); g.restore();
    g.strokeStyle = '#ffb040'; g.lineWidth = 2; g.shadowColor = '#f80'; g.shadowBlur = 8;
    g.beginPath(); g.moveTo(-18, -e.h + 40); g.lineTo(-6, -e.h + 58 + st); g.lineTo(-14, -e.h + 72); g.moveTo(14, -e.h + 44); g.lineTo(4, -e.h + 62); g.lineTo(16, -e.h + 78); g.stroke(); g.shadowBlur = 0;
    eyes(4, -e.h + 16, '#ffb040', 5, 2.6, 12);
  } else if (e.t === 'boss') {
    const pose = e.pose || 0, br = Math.sin(time * 2) * 3, hh = e.h;
    if (e.rage) { g.shadowColor = '#ff2010'; g.shadowBlur = 28; }
    else { g.shadowColor = e.col; g.shadowBlur = 14; }
    // legs
    g.fillRect(-28, -62, 22, 62); g.fillRect(6, -62, 22, 62);
    // torso
    g.beginPath(); g.moveTo(-40, -hh + 52); g.lineTo(40, -hh + 52); g.lineTo(48, -hh + 98 + br); g.lineTo(26, -56); g.lineTo(-26, -56); g.lineTo(-48, -hh + 98 + br); g.fill();
    // shoulder spikes
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 30, -hh + 52); g.lineTo(sd * 60, -hh + 28); g.lineTo(sd * 48, -hh + 66); g.fill(); }
    // head + horns
    g.beginPath(); g.arc(2, -hh + 32 + br, 24, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-14, -hh + 16); g.lineTo(-40, -hh - 26); g.lineTo(-30, -hh + 8); g.lineTo(-4, -hh + 12); g.fill();
    g.beginPath(); g.moveTo(18, -hh + 16); g.lineTo(46, -hh - 30); g.lineTo(34, -hh + 6); g.lineTo(8, -hh + 12); g.fill();
    // per-boss look
    const bs = e.st || 1;
    if (bs === 2) {          // bone colossus: pale jaw, tusks and rib plates
      g.fillStyle = '#d8d0e0'; g.beginPath(); g.moveTo(-10, -hh + 44 + br); g.lineTo(16, -hh + 44 + br); g.lineTo(10, -hh + 54 + br); g.lineTo(-6, -hh + 54 + br); g.fill();
      for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 12, -hh + 46 + br); g.lineTo(sd * 18, -hh + 62 + br); g.lineTo(sd * 6, -hh + 50 + br); g.fill(); }
      g.fillStyle = 'rgba(216,208,224,0.55)'; for (let i = 0; i < 3; i++) g.fillRect(-30, -hh + 60 + i * 14, 60, 4);
    } else if (bs === 3) {   // hollow king: golden crown
      g.fillStyle = '#d4af37'; g.shadowColor = '#fc4'; g.shadowBlur = 12;
      g.beginPath(); g.moveTo(-22, -hh + 12 + br);
      for (let i = 0; i < 5; i++) { g.lineTo(-20 + i * 10, -hh - 10 + br - (i % 2 ? 0 : 12)); g.lineTo(-15 + i * 10, -hh + 12 + br); }
      g.lineTo(26, -hh + 14 + br); g.fill(); g.shadowBlur = 0;
    } else if (bs === 4) {   // ashen reaper: tall hood
      g.beginPath(); g.moveTo(-32, -hh + 62); g.lineTo(2, -hh - 40 + br); g.lineTo(36, -hh + 62); g.quadraticCurveTo(2, -hh + 30, -32, -hh + 62); g.fill();
    } else if (bs === 5) {   // shadow emperor: wings and halo
      for (const sd of [-1, 1]) {
        g.beginPath(); g.moveTo(sd * 30, -hh + 70); g.quadraticCurveTo(sd * 110, -hh + 20 + Math.sin(time * 2) * 8, sd * 150, -hh + 110);
        g.quadraticCurveTo(sd * 90, -hh + 90, sd * 40, -hh + 110); g.fill();
      }
      g.strokeStyle = e.col; g.lineWidth = 3; g.shadowColor = e.col; g.shadowBlur = 16;
      g.beginPath(); g.ellipse(2, -hh - 20 + br, 32, 9, 0, 0, 7); g.stroke(); g.shadowBlur = 0;
    } else if (bs === 6) {   // glacial sentinel: icicle crown and frozen pauldrons
      g.fillStyle = '#bff4ff'; g.shadowColor = '#8ef'; g.shadowBlur = 12;
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 9 - 5, -hh + 10 + br); g.lineTo(i * 9, -hh - 22 + br - (2 - Math.abs(i)) * 8); g.lineTo(i * 9 + 5, -hh + 10 + br); g.fill(); }
      for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 44, -hh + 56); g.lineTo(sd * 80, -hh + 50); g.lineTo(sd * 50, -hh + 80); g.fill(); }
      g.shadowBlur = 0;
    } else if (bs === 7) {   // mire tyrant: writhing tendrils and glowing spore sacs
      g.lineWidth = 9; g.lineCap = 'round'; g.strokeStyle = g.fillStyle;
      for (let i = 0; i < 3; i++) { const sw = Math.sin(time * 3 + i * 2) * 14; g.beginPath(); g.moveTo(-30, -hh + 80); g.quadraticCurveTo(-72 - i * 14, -hh + 110 + sw, -62 - i * 18, -hh + 165 + sw); g.stroke(); }
      g.fillStyle = e.col; g.shadowColor = e.col; g.shadowBlur = 12;
      for (const [px, py, pr] of [[-24, 70, 6], [20, 84, 8], [-6, 116, 5]]) { g.beginPath(); g.arc(px, -hh + py, pr + Math.sin(time * 4 + px) * 1.2, 0, 7); g.fill(); }
      g.shadowBlur = 0;
    } else if (bs === 8) {   // forge warlord: molten visor and cracked armour
      g.fillStyle = '#ff9a30'; g.shadowColor = '#f60'; g.shadowBlur = 14; g.fillRect(-20, -hh + 22 + br, 44, 6);
      g.strokeStyle = '#ff9a30'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(-30, -hh + 64); g.lineTo(-14, -hh + 80); g.lineTo(-24, -hh + 96); g.moveTo(26, -hh + 62); g.lineTo(12, -hh + 84); g.lineTo(28, -hh + 98); g.stroke();
      g.fillStyle = '#2a1006'; g.fillRect(-34, -hh - 4 + br, 72, 14); g.shadowBlur = 0;
    } else if (bs === 9) {   // void archon: orbiting void orbs
      g.fillStyle = e.col; g.shadowColor = e.col; g.shadowBlur = 16;
      for (let i = 0; i < 3; i++) { const a = time * 2 + i * 2.09; g.beginPath(); g.arc(Math.cos(a) * 78, -hh + 40 + Math.sin(a) * 24, 7, 0, 7); g.fill(); }
      g.strokeStyle = e.col; g.lineWidth = 3; g.beginPath(); g.ellipse(2, -hh - 22 + br, 30, 8, 0, 0, 7); g.stroke(); g.shadowBlur = 0;
    } else if (bs === 10) {  // shadow god: twin halos, wings and orbiting blades
      for (const sd of [-1, 1]) {
        g.beginPath(); g.moveTo(sd * 30, -hh + 70); g.quadraticCurveTo(sd * 120, -hh + 10 + Math.sin(time * 2) * 8, sd * 165, -hh + 120);
        g.quadraticCurveTo(sd * 100, -hh + 90, sd * 40, -hh + 112); g.fill();
      }
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.shadowColor = '#fff'; g.shadowBlur = 18;
      g.beginPath(); g.ellipse(2, -hh - 20 + br, 34, 9, 0, 0, 7); g.ellipse(2, -hh - 34 + br, 22, 6, 0, 0, 7); g.stroke();
      g.fillStyle = '#fff';
      for (let i = 0; i < 6; i++) {
        const a = time * 1.6 + i * 1.047; g.save(); g.translate(Math.cos(a) * 92, -hh * 0.5 + Math.sin(a) * 28); g.rotate(a + 1.57);
        g.beginPath(); g.moveTo(0, -16); g.lineTo(4, 8); g.lineTo(-4, 8); g.fill(); g.restore();
      }
      g.shadowBlur = 0;
    }
    g.fillStyle = col;
    // front arm + cleaver (raises with pose)
    g.save(); g.translate(34, -hh + 70); g.rotate(-0.4 - pose * 2.0 + (e.mode === 'dash' ? 0.8 : 0));
    g.fillRect(0, -10, 56, 20);
    g.beginPath(); g.moveTo(52, -34); g.lineTo(112, -26); g.lineTo(120, 10); g.lineTo(52, 22); g.fill();
    g.restore();
    // back arm
    g.save(); g.translate(-34, -hh + 72); g.rotate(2.6 + pose * 1.4); g.fillRect(0, -8, 48, 16); g.restore();
    g.shadowBlur = 0;
    // glowing ribcage + core
    g.strokeStyle = e.rage ? 'rgba(255,60,40,0.8)' : e.col; g.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-22, -hh + 66 + i * 12); g.quadraticCurveTo(0, -hh + 74 + i * 12, 22, -hh + 66 + i * 12); g.stroke(); }
    g.fillStyle = e.rage ? '#ff4030' : e.col; g.shadowColor = g.fillStyle; g.shadowBlur = 18;
    g.beginPath(); g.arc(0, -hh + 100, 7 + Math.sin(time * 6) * 1.5, 0, 7); g.fill(); g.shadowBlur = 0;
    eyes(8, -hh + 30 + br, e.rage ? '#ff3020' : '#ffffff', 9, 4.4, 20);
  } else {
    // brute
    const st = Math.sin(ph * 0.8) * 4;
    g.beginPath(); g.moveTo(-18, -e.h + 18); g.lineTo(18, -e.h + 18); g.lineTo(26, -e.h * 0.4); g.lineTo(14, -6); g.lineTo(-14, -6); g.lineTo(-26, -e.h * 0.4); g.fill();
    g.fillRect(-16, -26, 12, 26 + st / 2 * 0); g.fillRect(4, -26, 12, 26);
    g.beginPath(); g.arc(2, -e.h + 8, 15, 0, 7); g.fill();
    // horns
    g.beginPath(); g.moveTo(-10, -e.h); g.lineTo(-20, -e.h - 22); g.lineTo(-3, -e.h - 6); g.fill();
    g.beginPath(); g.moveTo(14, -e.h); g.lineTo(26, -e.h - 24); g.lineTo(6, -e.h - 6); g.fill();
    // arm + club
    g.save(); g.translate(18, -e.h + 30); g.rotate(-1.2 + wind * 2.6);
    g.fillRect(0, -6, 38, 12); g.beginPath(); g.ellipse(48, 0, 16, 20, 0, 0, 7); g.fill(); g.restore();
    eyes(6, -e.h + 6, '#b040ff', 5, 3, 14);
    g.strokeStyle = 'rgba(176,64,255,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-8, -e.h * 0.7); g.lineTo(4, -e.h * 0.55); g.lineTo(-4, -e.h * 0.4); g.stroke();
  }
  g.restore();
  // hp bar (elites always show a wider one with a name tag)
  if ((e0.hp < e0.maxHp || e0.elite) && !e0.boss) {
    const bw = e0.elite ? 64 : 44, bh = e0.elite ? 8 : 6, bx = e0.x - camX - bw / 2, by = e0.y - e0.h - (e0.t === 'brute' ? 32 : 16), f = clamp(e0.hp / e0.maxHp, 0, 1), tr = clamp(e0.trail === undefined ? f : e0.trail, 0, 1);
    rr(bx - 1.5, by - 1.5, bw + 3, bh + 3, 4.5); g.fillStyle = 'rgba(8,4,16,0.78)'; g.fill();
    if (tr > f) { rr(bx, by, bw * tr, bh, 3); g.fillStyle = 'rgba(255,232,190,0.6)'; g.fill(); }
    if (f > 0) { const gr = g.createLinearGradient(0, by, 0, by + bh); gr.addColorStop(0, e0.elite ? '#ffb040' : '#ff6a78'); gr.addColorStop(1, e0.elite ? '#c04010' : '#b0102a'); rr(bx, by, Math.max(4, bw * f), bh, 3); g.fillStyle = gr; g.fill(); }
    if (e0.elite) { g.fillStyle = '#ff6078'; g.font = 'bold 11px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('★ ELITE', e0.x - camX, by - 6); }
  }
}

// ---------- drawing: effects ----------
function drawSlash(s) {
  const t = 1 - s.life / s.max;
  const sweep = Math.min(1, t * 2.4);
  const fade = 1 - t;
  const a0 = s.a0, span = s.span * sweep;
  g.save(); g.translate(s.x - camX, s.y); g.scale(s.face, 1);
  g.globalCompositeOperation = 'lighter';
  for (let pass = 0; pass < 3; pass++) {
    const w = [26, 14, 5][pass] * (s.big ? 1.3 : 1);
    const wc = WPN[s.wl || 0].c;
    g.strokeStyle = ['rgba(' + wc[0] + ',' + 0.35 * fade + ')', 'rgba(' + wc[1] + ',' + 0.7 * fade + ')', 'rgba(255,255,255,' + fade + ')'][pass];
    g.lineWidth = w; g.lineCap = 'round';
    g.shadowColor = wc[2]; g.shadowBlur = 24;
    g.beginPath();
    if (s.dirSign > 0) g.arc(0, 0, s.r, a0, a0 + span); else g.arc(0, 0, s.r, a0 + s.span - span + s.span * 0, a0 + s.span);
    g.stroke();
  }
  g.restore();
}
function drawWave(w) {
  // crescent blade of energy standing on the ground, with fading echoes behind it
  g.save(); g.globalCompositeOperation = 'lighter'; g.translate(w.x - camX, w.y); g.scale(w.face * w.sz, w.sz);
  const wc = wcol();
  g.shadowColor = wc[2]; g.shadowBlur = 24;
  const gl = g.createRadialGradient(0, 0, 0, 0, 0, 90);
  gl.addColorStop(0, `rgba(${wc[1]},0.35)`); gl.addColorStop(1, `rgba(${wc[1]},0)`);
  g.fillStyle = gl; g.save(); g.scale(1, 0.18); g.beginPath(); g.arc(0, 0, 90, 0, 7); g.fill(); g.restore();
  const crescent = (dx, k) => {
    const gr = g.createLinearGradient(dx - 20, 0, dx + 72 * k, 0);
    gr.addColorStop(0, `rgba(${wc[0]},0)`); gr.addColorStop(0.55, `rgba(${wc[1]},0.65)`); gr.addColorStop(1, 'rgba(235,252,255,0.97)');
    g.fillStyle = gr; g.beginPath();
    g.moveTo(dx - 16, -146 * k); g.quadraticCurveTo(dx + 96 * k, -78 * k, dx - 16, 4);
    g.quadraticCurveTo(dx + 34 * k, -78 * k, dx - 16, -146 * k); g.fill();
  };
  for (let i = 3; i >= 1; i--) { g.globalAlpha = 0.22 / i; crescent(-i * 26, 1 - i * 0.08); }
  g.globalAlpha = 1; crescent(0, 1);
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 2.5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-16, -146); g.quadraticCurveTo(96, -78, -16, 4); g.stroke();
  g.restore();
}
function drawParts() {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    g.globalAlpha = clamp(p.life / p.max, 0, 1);
    g.fillStyle = p.col; g.shadowColor = p.col; g.shadowBlur = 8;
    g.fillRect(p.x - camX - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz);
  }
  g.restore();
  for (const o of orbs) {
    if (o.age > 10 && Math.floor(o.age * 8) % 2) continue;
    const x = o.x - camX, it = ITEMS[o.kind], y = o.y + Math.sin(time * 6 + o.x) * 2;
    g.save(); g.shadowColor = it.col; g.shadowBlur = 16; g.fillStyle = it.col;
    if (o.kind === 'coin') {
      g.beginPath(); g.ellipse(x, y, Math.abs(Math.cos(time * 5 + o.x)) * 6 + 1.5, 6.5, 0, 0, 7); g.fill();
    } else {
      g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill(); g.shadowBlur = 0;
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(it.ic, x, y + 1); g.textBaseline = 'alphabetic';
    }
    g.restore();
  }
}
function drawBoltPts(pts, a, col3, ws = 1) {
  const c = col3 || wcol();
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round';
  for (const [w, col] of [[7 * ws, `rgba(${c[0]},${0.5 * a})`], [3 * ws, `rgba(${c[1]},${a})`], [1.2 * ws, `rgba(255,255,255,${a})`]]) {
    g.strokeStyle = col; g.lineWidth = w; g.shadowColor = c[2]; g.shadowBlur = 14;
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x - camX, y) : g.moveTo(x - camX, y)); g.stroke();
  }
  g.restore();
}
function drawBolts() { for (const b of bolts) drawBoltPts(b.pts, clamp(b.life / b.max, 0, 1), b.col, b.ws || 1); }
function drawDisc(x, y, rot, sz = 1) {   // spinning toothed ring blade
  const c = wcol();
  g.save(); g.translate(x, y); g.scale(sz, sz); g.globalCompositeOperation = 'lighter'; g.shadowColor = c[2]; g.shadowBlur = 18;
  for (let k = 1; k <= 3; k++) { g.strokeStyle = `rgba(${c[1]},${0.22 / k})`; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 21 + k * 3, rot - 1.2 * k, rot - 1.2 * k + 0.9); g.stroke(); }
  g.rotate(rot);
  g.fillStyle = `rgba(${c[1]},0.95)`;
  for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(19, -5); g.lineTo(31, 0); g.lineTo(19, 5); g.fill(); }
  g.strokeStyle = `rgba(${c[1]},0.95)`; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 18, 0, 7); g.stroke();
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, 12); rg.addColorStop(0, '#fff'); rg.addColorStop(1, `rgba(${c[0]},0.1)`);
  g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 12, 0, 7); g.fill();
  g.restore();
}
function drawDagger(x, y, ang, col) {
  g.save(); g.translate(x, y); g.rotate(ang); g.globalCompositeOperation = 'lighter';
  const tr = g.createLinearGradient(-46, 0, 0, 0); tr.addColorStop(0, 'rgba(255,255,255,0)'); tr.addColorStop(1, col);
  g.globalAlpha = 0.55; g.fillStyle = tr; g.fillRect(-46, -2, 46, 4); g.globalAlpha = 1;
  g.shadowColor = col; g.shadowBlur = 10; g.fillStyle = col;
  g.beginPath(); g.moveTo(20, 0); g.lineTo(2, -4.5); g.lineTo(-8, -2); g.lineTo(-8, 2); g.lineTo(2, 4.5); g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.fillRect(-14, -1, 8, 2); g.fillRect(-9, -6, 3, 12);
  g.restore();
}
function drawFallingBlade(x, y) {   // the equipped weapon, point-down, with a light streak behind it
  g.save(); g.translate(x, y);
  g.globalCompositeOperation = 'lighter';
  const tr = g.createLinearGradient(0, -210, 0, -60); tr.addColorStop(0, 'rgba(255,255,255,0)'); tr.addColorStop(1, `rgba(${wcol()[1]},0.7)`);
  g.fillStyle = tr; g.fillRect(-4, -210, 8, 150);
  g.globalCompositeOperation = 'source-over'; g.translate(0, -70); g.rotate(Math.PI / 2); g.scale(0.78, 0.78);
  drawSword(wpn, 16);
  g.restore();
}
function drawMeteor(m, gy) {
  const x = m.x - camX, k = clamp(1 - m.t / m.max, 0, 1);
  g.save(); g.globalCompositeOperation = 'lighter';
  g.fillStyle = `rgba(255,110,40,${0.1 + 0.2 * k})`; g.strokeStyle = `rgba(255,150,60,${0.4 + 0.5 * k})`; g.lineWidth = 2.5;
  g.beginPath(); g.ellipse(x, gy + 4, m.r * (0.4 + 0.6 * k), m.r * 0.12, 0, 0, 7); g.fill(); g.stroke();
  if (k > 0.4) {
    const f = (k - 0.4) / 0.6, y = -90 + (gy + 60) * f * f;
    const gr = g.createLinearGradient(x - 30 * (1 - f), y - 160, x, y); gr.addColorStop(0, 'rgba(255,90,20,0)'); gr.addColorStop(1, 'rgba(255,170,60,0.8)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - 14, y - 160); g.lineTo(x + 14, y - 160); g.lineTo(x + 18, y); g.lineTo(x - 18, y); g.fill();
    const rg = g.createRadialGradient(x, y, 0, x, y, 34); rg.addColorStop(0, '#fff'); rg.addColorStop(0.4, '#ffb040'); rg.addColorStop(1, 'rgba(255,80,20,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, 34, 0, 7); g.fill();
  }
  g.restore();
}
function drawMeteors() { for (const m of meteors) drawMeteor(m, GROUND); }
function drawWell(x, y, k, sc = 1) {   // black orb with swirling rim
  g.save(); g.translate(x, y); g.globalCompositeOperation = 'lighter';
  const c = wcol(), r = (34 + Math.sin(time * 8) * 3) * sc;
  const gr = g.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.4); gr.addColorStop(0, `rgba(${c[0]},0.5)`); gr.addColorStop(1, `rgba(${c[0]},0)`);
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 2.4, 0, 7); g.fill();
  g.globalCompositeOperation = 'source-over'; g.fillStyle = '#05020a'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
  g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(${c[1]},0.9)`; g.lineWidth = 3; g.shadowColor = c[2]; g.shadowBlur = 14;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, r + 4 + i * 8, time * 5 + i * 2.1, time * 5 + i * 2.1 + 1.4); g.stroke(); }
  g.restore();
}
function drawWells() { for (const w of wells) drawWell(w.x - camX, w.y, w.t / w.max, w.sc); }
function drawBeam(b) {
  const a = clamp(b.life / b.max, 0, 1), x0 = b.x - camX, x1 = x0 + b.face * b.len, c = wcol(), wd = b.wd || 1;
  g.save(); g.globalCompositeOperation = 'lighter'; g.shadowColor = c[2]; g.shadowBlur = 24;
  const fl = g.createRadialGradient(x0, b.y, 0, x0, b.y, 70 * a * wd); fl.addColorStop(0, 'rgba(255,255,255,0.9)'); fl.addColorStop(1, `rgba(${c[0]},0)`);
  g.fillStyle = fl; g.beginPath(); g.arc(x0, b.y, 70 * a * wd, 0, 7); g.fill();
  for (const [hw, col] of [[(22 * a + 4) * wd, `rgba(${c[0]},0.5)`], [(11 * a + 2) * wd, `rgba(${c[1]},0.9)`], [(4 * a + 1) * wd, 'rgba(255,255,255,1)']]) {
    const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x0, b.y - hw * 0.4); g.lineTo(x1, b.y - hw); g.lineTo(x1, b.y + hw); g.lineTo(x0, b.y + hw * 0.4); g.fill();
  }
  g.restore();
}
function drawBeams() { for (const b of beams) drawBeam(b); }
function drawBoomers() { for (const b of boomers) drawDisc(b.x - camX, b.y, time * 24, b.sz); }
function drawShots() {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const sh of shots) {
    g.fillStyle = sh.col; g.shadowColor = sh.col; g.shadowBlur = 14;
    if (sh.blade) drawFallingBlade(sh.x - camX, sh.y);
    else if (sh.dag) drawDagger(sh.x - camX, sh.y, Math.atan2(sh.vy, sh.vx), sh.col);
    else if (sh.fall) { g.fillRect(sh.x - camX - 5, sh.y - 90, 10, 90); g.beginPath(); g.moveTo(sh.x - camX - 9, sh.y); g.lineTo(sh.x - camX, sh.y + 22); g.lineTo(sh.x - camX + 9, sh.y); g.fill(); }
    else { g.beginPath(); g.arc(sh.x - camX, sh.y, 6, 0, 7); g.fill(); }
  }
  g.restore();
}
function drawTelegraph(e) {
  const m = e.mode;
  if (m === 'leap' || m === 'air') {          // landing ring
    const rx = e.tx - camX, a = 0.35 + 0.35 * Math.sin(time * 20);
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = `rgba(255,50,40,${0.12 + 0.12 * a})`; g.strokeStyle = `rgba(255,80,60,${0.5 + a})`; g.lineWidth = 3;
    g.beginPath(); g.ellipse(rx, GROUND + 4, 80, 14, 0, 0, 7); g.fill(); g.stroke(); g.restore();
  }
  if (!['slam', 'charge', 'volley', 'summon', 'leap', 'rain', 'blink', 'ring', 'meteor'].includes(m)) return;
  const p = 1 - Math.max(0, e.mt) / e.mtMax, pulse = 0.5 + 0.5 * Math.sin(time * 24), x = e.x - camX;
  g.save(); g.globalCompositeOperation = 'lighter';
  if (m === 'slam') {
    for (const d of [-1, 1]) {
      const gr = g.createLinearGradient(x, 0, x + d * 360, 0);
      gr.addColorStop(0, `rgba(255,50,40,${0.15 + 0.35 * p})`); gr.addColorStop(1, 'rgba(255,50,40,0)');
      g.fillStyle = gr; g.fillRect(d > 0 ? x : x - 360, GROUND - 4, 360, 14);
    }
  } else if (m === 'charge') {
    const d = e.cdir, gr = g.createLinearGradient(x, 0, x + d * 580, 0);
    gr.addColorStop(0, `rgba(255,40,60,${0.12 + 0.3 * p})`); gr.addColorStop(1, 'rgba(255,40,60,0)');
    g.fillStyle = gr; g.fillRect(d > 0 ? x : x - 580, GROUND - 70, 580, 74);
  } else if (m === 'ring') {
    g.strokeStyle = `rgba(255,90,130,${0.3 + 0.5 * p})`; g.lineWidth = 3;
    g.beginPath(); g.arc(x, e.y - 100, 30 + p * 90, 0, 7); g.stroke();
  }
  g.restore();
  g.save(); g.textAlign = 'center'; g.font = '900 38px Impact, sans-serif';
  g.fillStyle = `rgb(255,${60 + 140 * pulse | 0},60)`; g.shadowColor = '#f00'; g.shadowBlur = 16;
  g.fillText('!', x, e.y - e.h - 40); g.restore();
}
function drawStun(e) {
  if (!(e.stun > 0 || e.mode === 'stun')) return;
  const x = e.x - camX, y = e.y - e.h - 22;
  g.save(); g.fillStyle = '#ffd060'; g.shadowColor = '#fc4'; g.shadowBlur = 10;
  for (let i = 0; i < 3; i++) { const a = time * 5 + i * 2.1; g.beginPath(); g.arc(x + Math.cos(a) * 20, y + Math.sin(a) * 6, 3.5, 0, 7); g.fill(); }
  g.restore();
}
function drawMarks() {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const m of marks) {
    const x = m.x - camX, k = clamp(1 - m.t / 1.5, 0, 1), a = 0.3 + 0.5 * k;
    g.fillStyle = `rgba(255,70,50,${0.15 + 0.2 * k})`; g.strokeStyle = `rgba(255,110,70,${a})`; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(x, GROUND + 4, 34, 8, 0, 0, 7); g.fill(); g.stroke();
    const gr = g.createLinearGradient(0, GROUND - 260, 0, GROUND); gr.addColorStop(0, 'rgba(255,70,50,0)'); gr.addColorStop(1, `rgba(255,70,50,${0.25 * k})`);
    g.fillStyle = gr; g.fillRect(x - 12, GROUND - 260, 24, 260);
  }
  g.restore();
}
function drawQuakes() {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const q of quakes) {
    const x = q.x - camX, a = clamp(q.life, 0, 1);
    g.fillStyle = `rgba(255,110,40,${a})`; g.shadowColor = '#f60'; g.shadowBlur = 18;
    for (let i = 0; i < 4; i++) {
      const bx = x - q.dir * i * 14, h = 46 - i * 9;
      g.beginPath(); g.moveTo(bx - 8, GROUND + 6); g.lineTo(bx + q.dir * 2, GROUND - h); g.lineTo(bx + 8, GROUND + 6); g.fill();
    }
  }
  g.restore();
}
function chargeBar(x, y, p, col, ready) {
  g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(x - 24, y, 48, 5);
  g.fillStyle = ready ? '#fff' : col; g.shadowColor = col; g.shadowBlur = ready ? 12 : 4; g.fillRect(x - 24, y, 48 * clamp(p, 0, 1), 5); g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1; g.strokeRect(x - 24.5, y - 0.5, 49, 6);
}
function drawCharge() {
  const f = P.face, x = P.x - camX;
  if (P.chg > 0.15) {
    const p = P.chg / (THRUST_READY + THRUST_FULL), ready = P.chg >= THRUST_READY;
    const tx = P.x - f * 22, ty = P.y - 56;      // sword is pulled back behind the knight
    const r = 5 + 20 * clamp(p, 0, 1) + (ready ? Math.sin(time * 30) * 2 : 0);
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(tx - camX, ty, 0, tx - camX, ty, r * 1.6);
    const wc = wcol();
    gr.addColorStop(0, ready ? 'rgba(255,255,255,0.95)' : `rgba(${wc[1]},0.8)`); gr.addColorStop(1, `rgba(${wc[0]},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(tx - camX, ty, r * 1.6, 0, 7); g.fill(); g.restore();
    if (Math.random() < 0.7) { const a = rnd(0, 6.28), d = rnd(40, 70); parts.push({ x: tx + Math.cos(a) * d, y: ty + Math.sin(a) * d, vx: -Math.cos(a) * d * 3.2, vy: -Math.sin(a) * d * 3.2, life: 0.3, max: 0.3, col: ready ? '#fff' : wcol()[2], sz: 3, grav: 0 }); }
    chargeBar(x, P.y - 122, p, wcol()[2], ready);
  }
  if (P.chg2 > 0.15) {
    const l = clamp((P.chg2 - WAVE_MIN) / WAVE_FULL, 0, 1), full = P.full2;
    const ox = P.x + f * 50, oy = P.y - 24, r = 8 + 36 * l + (full ? Math.sin(time * 30) * 2 : 0);
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(ox - camX, oy, 0, ox - camX, oy, r * 1.5);
    const wc = wcol();
    gr.addColorStop(0, full ? 'rgba(255,255,255,0.95)' : `rgba(${wc[1]},0.85)`); gr.addColorStop(1, `rgba(${wc[0]},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(ox - camX, oy, r * 1.5, 0, 7); g.fill(); g.restore();
    if (Math.random() < 0.8) { const a = rnd(0, 6.28), d = rnd(50, 90); parts.push({ x: ox + Math.cos(a) * d, y: oy + Math.sin(a) * d * 0.7, vx: -Math.cos(a) * d * 3.2, vy: -Math.sin(a) * d * 2.2, life: 0.3, max: 0.3, col: full ? '#fff' : wcol()[2], sz: 3, grav: 0 }); }
    chargeBar(x, P.y - 122, l, wcol()[2], full);
  }
  if (P.thrustT > 0) {
    const l = P.thrustLvl, len = 160 + 150 * l, y = P.y - 52, tail = x - f * 30, tip = x + f * len;
    const wc = wcol();
    g.save(); g.globalCompositeOperation = 'lighter'; g.shadowColor = wc[2]; g.shadowBlur = 26;
    for (const [hw, col] of [[16 + 10 * l, `rgba(${wc[0]},0.55)`], [8 + 4 * l, `rgba(${wc[1]},0.85)`], [3, 'rgba(255,255,255,1)']]) {
      const gr = g.createLinearGradient(tail, 0, tip, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.6, col); gr.addColorStop(1, col);
      g.fillStyle = gr; g.beginPath(); g.moveTo(tail, y - hw * 0.4); g.lineTo(tip - f * 18, y - hw); g.lineTo(tip + f * 26, y); g.lineTo(tip - f * 18, y + hw); g.lineTo(tail, y + hw * 0.4); g.fill();
    }
    g.restore();
  }
}
function drawAuras() {
  drawCharge();
  const x = P.x - camX, y = P.y - 44;
  if (P.parryT > 0) {
    const k = P.parryT / PARRY_WINDOW, f = P.face;
    g.save(); g.globalCompositeOperation = 'lighter'; g.shadowColor = '#fc4'; g.shadowBlur = 22;
    g.strokeStyle = `rgba(255,215,100,${0.4 + 0.6 * k})`; g.lineWidth = 5;
    g.beginPath(); g.arc(x + f * 14, y, 54 + (1 - k) * 16, f > 0 ? -1.1 : Math.PI - 1.1, f > 0 ? 1.1 : Math.PI + 1.1); g.stroke();
    g.strokeStyle = `rgba(255,255,255,${0.6 * k})`; g.lineWidth = 2; g.beginPath();
    g.arc(x + f * 14, y, 50 + (1 - k) * 16, f > 0 ? -1.0 : Math.PI - 1.0, f > 0 ? 1.0 : Math.PI + 1.0); g.stroke(); g.restore();
  }
  if (P.bShield > 0) {
    g.save(); g.strokeStyle = `rgba(64,224,255,${0.5 + Math.sin(time * 10) * 0.2})`; g.lineWidth = 3; g.shadowColor = '#4ef'; g.shadowBlur = 18;
    g.fillStyle = 'rgba(64,224,255,0.08)'; g.beginPath(); g.arc(x, y, 52, 0, 7); g.fill(); g.stroke(); g.restore();
  }
  if (P.bPow > 0 && Math.random() < 0.5) parts.push({ x: P.x + rnd(-18, 18), y: P.y - rnd(0, 80), vx: 0, vy: -90, life: 0.5, max: 0.5, col: '#ff7a1a', sz: 3, grav: 0 });
  if (P.bHaste > 0 && Math.abs(P.vx) > 50 && Math.random() < 0.6) parts.push({ x: P.x, y: P.y - rnd(5, 70), vx: -P.vx * 0.2, vy: 0, life: 0.3, max: 0.3, col: '#ffe040', sz: 3, grav: 0 });
}
function drawTexts() {
  g.textAlign = 'center';
  for (const t of texts) {
    g.globalAlpha = clamp(t.life * 2, 0, 1);
    g.font = `900 ${t.big ? 30 : t.str === 'CRITICAL' ? 15 : 20}px Impact, "Arial Black", sans-serif`;
    g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(t.str, t.x - camX, t.y);
    g.fillStyle = t.col; g.shadowColor = t.col; g.shadowBlur = 10; g.fillText(t.str, t.x - camX, t.y); g.shadowBlur = 0;
  }
  g.globalAlpha = 1;
}



/* ======================================================================
   HUD
   ====================================================================== */
// ---------- HUD ----------
function rr(x, y, w, h, r) {   // rounded-rectangle path
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// glossy pill bar with a delayed 'damage trail'; warn = flashing frame (low health)
function bar(x, y, w, h, v, c1, c2, left, right, trail, warn) {
  v = clamp(v, 0, 1); const r = h / 2, ix = x + 1.5, iw = w - 3;
  g.save();
  rr(x, y, w, h, r); g.fillStyle = 'rgba(8,4,16,0.82)'; g.fill();
  g.save(); rr(ix, y + 1.5, iw, h - 3, Math.max(1, r - 1.5)); g.clip();
  if (trail > v) { g.fillStyle = 'rgba(255,232,190,0.6)'; g.fillRect(ix, y, iw * clamp(trail, 0, 1), h); }
  if (v > 0) {
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.fillRect(ix, y, iw * v, h);
    g.fillStyle = 'rgba(255,255,255,0.24)'; g.fillRect(ix, y + 1.5, iw * v, h * 0.38);
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(ix + iw * v - 2, y, 2, h);
  }
  g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1;
  for (let i = 1; i < 10; i++) { const tx = ix + iw * i / 10; g.beginPath(); g.moveTo(tx, y + h * 0.6); g.lineTo(tx, y + h); g.stroke(); }
  g.restore();
  rr(x, y, w, h, r); g.lineWidth = 1.6;
  g.strokeStyle = warn ? `rgba(255,70,80,${0.55 + 0.45 * Math.sin(time * 10)})` : 'rgba(255,255,255,0.34)'; g.stroke();
  if (left || right) {
    g.font = `bold ${Math.min(13, h * 0.58) | 0}px system-ui, sans-serif`; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 3;
    g.textAlign = 'left'; g.fillText(left, x + r + 2, y + h / 2 + 0.5); g.textAlign = 'right'; g.fillText(right, x + w - r - 2, y + h / 2 + 0.5);
  }
  g.restore();
}
function updateButtons() {
  const cds = { skill1: P.cd1, skill2: P.cd2, dash: P.dashCd, parry: P.parryCd };
  for (const k in cds) {
    const el = btnEls[k]; if (!el) continue;
    const max = { skill1: P.cdm1, skill2: P.cdm2, dash: 1.1 * cdr(), parry: 0.75 }[k];
    el.style.setProperty('--cd', Math.min(360, cds[k] / max * 360).toFixed(0) + 'deg');
    el.dataset.cd = cds[k] > 0 ? cds[k].toFixed(1) : '';
    el.classList.toggle('nomp', (k === 'skill1' && P.mp < SKILLS[equip[1]].mp) || (k === 'skill2' && P.mp < SKILLS[equip[2]].mp));
  }
  for (const k in btnEls) btnEls[k].classList.toggle('on', !!isDown(k));
}
function drawProgress() {
  const x0 = 352, w = 276, y = 34, h = 7, n = WAVES + 1, gap = 6, sw = (w - gap * (n - 1)) / n;
  g.textAlign = 'center'; g.font = 'bold 11px sans-serif'; g.fillStyle = '#b8a8d8';
  g.fillText(`STAGE ${stage}/${STAGES} · ${STAGE_NAMES[stage - 1]}`, W / 2, 22);
  const bossHp = enemies.find(e => e.boss);
  for (let i = 0; i < n; i++) {
    const sx = x0 + i * (sw + gap), isBoss = i === WAVES;
    let f = 0;
    if (phase !== 'wave') f = isBoss ? (phase === 'boss' ? (bossHp ? bossHp.hp / bossHp.maxHp : 1) : 0) : 1;
    else f = i < wave - 1 ? 1 : i === wave - 1 ? waveKills / quota() : 0;
    if (isBoss && phase !== 'wave' && phase !== 'boss') f = 1;
    g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(sx, y, sw, h);
    g.fillStyle = isBoss ? '#ff3050' : '#b070ff'; g.fillRect(sx, y, sw * clamp(f, 0, 1), h);
    g.strokeStyle = isBoss ? 'rgba(255,80,100,0.7)' : 'rgba(255,255,255,0.3)'; g.lineWidth = 1; g.strokeRect(sx + 0.5, y + 0.5, sw - 1, h - 1);
    g.font = '10px sans-serif'; g.fillStyle = isBoss ? '#ff6078' : (i < wave - 1 || phase !== 'wave' ? '#d8c8f0' : '#8a7ca8');
    g.fillText(isBoss ? '☠ BOSS' : 'WAVE ' + (i + 1), sx + sw / 2, y + 19);
  }
  g.font = '10px sans-serif'; g.fillStyle = '#8a7ca8';
  g.fillText(phase === 'wave' ? `${waveKills}/${quota()} enemies` : phase === 'boss' ? 'BOSS FIGHT' : 'STAGE CLEARED', W / 2, y + 32);
}
function drawHUD() {
  // portrait
  const ac = wcol()[2];
  g.save();
  g.fillStyle = 'rgba(8,4,16,0.75)'; g.strokeStyle = ac; g.lineWidth = 2.5; g.shadowColor = ac; g.shadowBlur = 10;
  g.beginPath(); g.arc(46, 46, 32, 0, 7); g.fill(); g.stroke(); g.restore();
  g.fillStyle = '#04020a'; g.beginPath(); g.arc(46, 50, 17, 0, 7); g.fill();
  g.beginPath(); g.moveTo(35, 40); g.lineTo(31, 22); g.lineTo(42, 36); g.fill();
  g.beginPath(); g.moveTo(57, 40); g.lineTo(63, 21); g.lineTo(50, 36); g.fill();
  eyes(46, 48, ac, 6, 2.8, 12);
  bar(88, 18, 248, 24, P.hp / P.maxHp, '#ff6a78', '#b0102a', 'HP', `${Math.ceil(P.hp)} / ${P.maxHp}`, P.hpT, P.hp / P.maxHp < 0.25);
  bar(88, 47, 208, 16, P.mp / P.maxMp, '#6cc8ff', '#1850b8', 'MP', `${Math.floor(P.mp)} / ${P.maxMp}`, P.mpT, false);
  // score
  g.textAlign = 'right'; g.fillStyle = '#e8d8ff'; g.font = 'bold 22px Impact, sans-serif';
  g.fillText('SCORE ' + score.toLocaleString('en-US'), W - 20, 34);
  g.font = '13px sans-serif'; g.fillStyle = '#a090c0';
  g.fillText(`GOLD ${gold}   KILLS ${kills}   BEST ${best.toLocaleString('en-US')}`, W - 20, 54);
  if (combo >= 3) {
    g.textAlign = 'center'; g.font = '900 30px Impact, sans-serif';
    g.fillStyle = '#ffb020'; g.shadowColor = '#ff5a00'; g.shadowBlur = 16;
    g.fillText(combo + ' HIT COMBO', W / 2, 172); g.shadowBlur = 0;
  }
  drawProgress();
  // active buffs
  let cx = 88;
  for (const [k, ic, col] of [['bPow', '⚔', '#ff7a1a'], ['bHaste', '⚡', '#ffe040'], ['bShield', '🛡', '#40e0ff']]) {
    if (P[k] <= 0) continue;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(cx, 68, 58, 20);
    g.strokeStyle = col; g.lineWidth = 1.5; g.strokeRect(cx, 68, 58, 20);
    g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText(ic + ' ' + Math.ceil(P[k]) + 's', cx + 5, 83);
    cx += 64;
  }
  if (relics.length) {
    g.font = '15px system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    relics.forEach((id, i) => g.fillText(RELICS[id].ic, 90 + i * 22, 102));
  }
  // boss bar
  const boss = enemies.find(e => e.boss);
  if (boss) {
    g.textAlign = 'center'; g.font = '900 16px Impact, sans-serif'; g.fillStyle = boss.rage ? '#ff5040' : '#d8a8ff';
    g.fillText(boss.name + (boss.rage ? '  (ENRAGED)' : ''), W / 2, 106);
    bar(W / 2 - 190, 111, 380, 16, boss.hp / boss.maxHp, boss.rage ? '#ff6a40' : boss.col, boss.rage ? '#8a1010' : '#20103a', '', '', boss.trail, false);
  }
  if (banner) {
    g.save(); g.globalAlpha = clamp(banner.t, 0, 1); g.textAlign = 'center';
    g.font = '900 44px Impact, "Arial Black", sans-serif'; g.fillStyle = '#ff4060'; g.shadowColor = '#f02040'; g.shadowBlur = 24;
    g.fillText(banner.text, W / 2, 210); g.restore();
  }
  updateButtons();
}


/* ======================================================================
   UI
   ====================================================================== */
// ---------- DOM-driven UI: screens, settings, pause, shop ----------
const $ = id => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches;

// body classes decide which screen is visible (see style.css)
function showUI() {
  const cl = document.body.classList;
  cl.toggle('playing', state === 'play'); cl.toggle('over', state === 'over'); cl.toggle('won', state === 'won');
  cl.toggle('paused', state === 'paused'); cl.toggle('shop', state === 'shop');
  const title = $('ovTitle').firstElementChild, sub = $('ovSub'), st = $('ovStats'), btn = $('startBtn');
  if (state === 'over' || state === 'won') {
    title.textContent = state === 'won' ? 'VICTORY' : 'YOU DIED';
    sub.textContent = state === 'won' ? `All ${STAGES} stages cleared` : `Reached stage ${stage} · wave ${wave}`;
    st.hidden = false;
    st.textContent = `Score ${score.toLocaleString('en-US')}  ·  Kills ${kills}  ·  Best ${best.toLocaleString('en-US')}  ·  Record ${prog.cleared}/${STAGES} stages`;
    btn.textContent = 'Play again';
  } else if (state === 'title') {
    title.textContent = 'SHADOW'; sub.textContent = 'The Legend of the Shadow Knight'; btn.textContent = 'Start';
    st.hidden = !(best || prog.cleared);
    st.textContent = `Best ${best.toLocaleString('en-US')}  ·  Furthest stage cleared ${prog.cleared}/${STAGES}` + (prog.wins ? `  ·  Victories ${prog.wins}` : '');
  }
  $('btnMute').textContent = settings.sound ? '🔊' : '🔇';
  applySkillButtons(); updateStagePick();
}

// ----- stage select: replay from any stage you have already cleared (the run then starts in the armory) -----
function updateStagePick() {
  const maxS = Math.min(STAGES, prog.cleared + 1);
  $('stagePick').hidden = prog.cleared < 1 || !(state === 'title' || state === 'over' || state === 'won');
  startStage = clamp(startStage, 1, maxS);
  $('stLabel').textContent = `Start at stage ${startStage} · ${STAGE_NAMES[startStage - 1]}`;
  $('stNote').textContent = startStage > 1 ? `Begins in the armory with ${(startStage - 1) * 120} gold` : 'A fresh run from the beginning';
  $('stPrev').disabled = startStage <= 1; $('stNext').disabled = startStage >= maxS;
}
$('stPrev').addEventListener('click', () => { startStage--; updateStagePick(); });
$('stNext').addEventListener('click', () => { startStage++; updateStagePick(); });

// ----- settings (shared by the intro screen and the pause menu) -----
const CHIPS = [
  { key: 'sound', label: 'Sound', apply: () => { applySound(); $('btnMute').textContent = settings.sound ? '🔊' : '🔇'; } },
  { key: 'lowfx', label: 'Low effects' },
  { key: 'calm', label: 'Reduce shake & flash' },
  { key: 'vibrate', label: 'Vibration', apply: () => buzz(30) },
  { key: 'diff', label: 'Difficulty', opts: ['Easy', 'Normal', 'Hard'] },
];
function refreshChips() {
  document.querySelectorAll('[data-chips] button').forEach(b => {
    const c = CHIPS.find(x => x.key === b.dataset.key);
    if (c.opts) { b.classList.toggle('on', settings.diff !== 1); b.textContent = c.label + ': ' + c.opts[settings[c.key]]; return; }
    const on = !!settings[b.dataset.key];
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    b.textContent = b.dataset.label + ': ' + (on ? 'On' : 'Off');
  });
}
document.querySelectorAll('[data-chips]').forEach(box => {
  for (const c of CHIPS) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.key = c.key; b.dataset.label = c.label; b.className = 'chip';
    b.addEventListener('click', () => { settings[c.key] = c.opts ? (settings[c.key] + 1) % c.opts.length : !settings[c.key]; if (c.key === 'lowfx') settings.autoChecked = true; (c.apply || (() => {}))(); saveSettings(); refreshChips(); });
    box.appendChild(b);
  }
});
refreshChips();
// ----- touch-button size / opacity (pause menu) -----
function applyControls() {
  const r = document.documentElement.style;
  r.setProperty('--bscale', settings.btnScale); r.setProperty('--bop', settings.btnOp);
}
[['rngSize', 'btnScale', 100], ['rngOp', 'btnOp', 100]].forEach(([id, key, mul]) => {
  const el = $(id); el.value = Math.round(settings[key] * mul);
  el.addEventListener('input', () => { settings[key] = el.value / mul; applyControls(); saveSettings(); });
});
applyControls();
// the two skill buttons show whichever skill is equipped
function applySkillButtons() {
  if (!equip) return;
  for (const n of [1, 2]) { const S = SKILLS[equip[n]], el = btnEls['skill' + n]; if (el.textContent !== S.ic) { el.textContent = S.ic; el.setAttribute('aria-label', S.name); } }
}
$('btnMute').addEventListener('click', () => { settings.sound = !settings.sound; applySound(); saveSettings(); refreshChips(); showUI(); });

// ----- pause -----
function setPaused(p) {
  if (p && state === 'play') { state = 'paused'; for (const k in keys) keys[k] = false; pointers.clear(); syncHeld(); showUI(); }
  else if (!p && state === 'paused') { state = 'play'; last = performance.now(); showUI(); }
}
function togglePause() { setPaused(state === 'play'); }
$('btnPause').addEventListener('click', () => setPaused(true));
$('btnResume').addEventListener('click', () => setPaused(false));
$('btnQuit').addEventListener('click', () => { state = 'title'; showUI(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

// ----- start / landscape on touch devices -----
function tryLandscape() {
  if (!isTouch) return;
  try {
    const el = document.documentElement;
    const p = el.requestFullscreen && !document.fullscreenElement ? el.requestFullscreen() : null;
    Promise.resolve(p).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
  } catch (e) {}
}
function startFromMenu() { if (state === 'title' || state === 'over' || state === 'won') { tryLandscape(); start(); } }
$('startBtn').addEventListener('click', startFromMenu);

// ----- upgrade shop (opens after every boss): Stats / Weapon / Skills tabs with a live preview -----
const UPGRADES = [
  { id: 'hp',  name: 'Vitality',  desc: '+20 max HP',     ic: '♥' },
  { id: 'pow', name: 'Might',     desc: '+12% damage',    ic: '⚔' },
  { id: 'mp',  name: 'Focus',     desc: '+20 max MP',     ic: '◆' },
  { id: 'cdr', name: 'Swiftness', desc: '−8% cooldowns',  ic: '≫' },
];
const MAX_UP = 5, upCost = l => 20 + 20 * l;
const wpnCost = l => 40 + 45 * l, skillCost = l => l === 0 ? 80 : 40 + 30 * l;
let shopTab = 'stats', skillPage = 0, selId = null, pvRun = false;
function rollRelics() {
  const pool = Object.keys(RELICS).filter(k => !has(k));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  relicOffer = pool.slice(0, 3); relicPicked = false;
}
function openShop() {
  state = 'shop'; shopTab = 'stats'; selId = null;
  if (shopPrep) { relicOffer = []; relicPicked = true; } else rollRelics();
  buildShop(); sfx.clear(); showUI();
}
function pickRelic(id) { if (relicPicked) return; relics.push(id); relicPicked = true; sfx.pickup('pow'); buildShop(); }
function buildRelics() {
  const rb = $('relicBox'); rb.innerHTML = '';
  const offering = relicOffer.length && !relicPicked, show = shopTab === 'stats' && (offering || relics.length);
  rb.hidden = !show; if (!show) return;
  const head = t => { const h = document.createElement('h4'); h.className = 'shop-h'; h.textContent = t; rb.appendChild(h); };
  if (offering) {
    head('Relic · choose 1 of 3');
    const grid = document.createElement('div'); grid.className = 'relic-grid';
    for (const id of relicOffer) { const r = RELICS[id]; grid.appendChild(mkCard(r.ic, r.name, r.desc, 0, 0, [['Take', true, () => pickRelic(id)]])); }
    rb.appendChild(grid);
  }
  if (relics.length) {
    head('Your relics');
    const row = document.createElement('div'); row.className = 'rchips';
    for (const id of relics) { const r = RELICS[id], sp = document.createElement('span'); sp.className = 'rchip'; sp.title = r.desc; sp.textContent = `${r.ic} ${r.name} — ${r.desc}`; row.appendChild(sp); }
    rb.appendChild(row);
  }
}
function mkCard(ic, name, desc, lvl, max, btns, sel, onSel) {
  const card = document.createElement('div'); card.className = 'card' + (sel ? ' sel' : '');
  card.innerHTML = `<div class="ic">${ic}</div><h3>${name}</h3><p>${desc}</p><div class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>`;
  for (const [label, can, fn, cls] of btns) {
    const b = document.createElement('button'); b.type = 'button'; b.disabled = !can; b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener('click', e => { e.stopPropagation(); fn(); }); card.appendChild(b);
  }
  if (onSel) { card.addEventListener('click', onSel); card.addEventListener('mouseenter', onSel); }
  return card;
}
function selectShop(id) { if (selId === id) return; selId = id; buildShop(); }
function buildShop() {
  $('shopStage').textContent = shopPrep ? `Prepare for stage ${stage + 1}` : `Stage ${stage} cleared`;
  $('shopGold').textContent = `${gold} gold`;
  document.querySelectorAll('#shopTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === shopTab));
  $('shopBody').classList.toggle('noprev', shopTab === 'stats');
  $('shopPager').hidden = shopTab !== 'skills';
  $('shopCards').dataset.tab = shopTab;
  const box = $('shopCards'); box.innerHTML = '';
  if (shopTab === 'stats') {
    for (const u of UPGRADES) {
      const lvl = up[u.id], maxed = lvl >= MAX_UP, cost = upCost(lvl);
      box.appendChild(mkCard(u.ic, u.name, u.desc, lvl, MAX_UP, [[maxed ? 'MAX' : `${cost} gold`, !maxed && gold >= cost, () => buyUpgrade(u.id)]]));
    }
  } else if (shopTab === 'weapon') {
    if (selId === null || typeof selId !== 'number') selId = wpn;
    WPN.forEach((w, i) => {
      const c = wpnCost(wpn), next = i === wpn + 1;
      const btn = i < wpn ? ['Owned', false] : i === wpn ? ['Equipped ✓', false, null, 'eq'] : next ? [`Forge · ${c}`, gold >= c, buyWeapon] : ['Locked', false];
      box.appendChild(mkCard(`<span style="color:${w.c[2]}">⚔</span>`, w.name, `Charge: ${w.chn}`, i, WPN.length - 1, [btn], selId === i, () => selectShop(i)));
    });
    const w = WPN[selId];
    $('prevName').textContent = w.name; $('prevDesc').innerHTML = `<b>${w.chn}</b> — ${w.chd}.<br>Damage +${selId * 18}% · Reach +${selId * 5}%`;
  } else {
    const ids = Object.keys(SKILLS).filter(k => SKILLS[k].slot === skillPage + 1);
    if (!ids.includes(selId)) selId = equip[skillPage + 1];
    $('pgLabel').textContent = `Slot ${skillPage ? 'L' : 'K'} · ${skillPage + 1}/2`;
    for (const id of ids) {
      const S = SKILLS[id], lvl = sk[id], maxed = lvl >= 5, c = skillCost(lvl), eq = equip[S.slot] === id;
      const btns = [[maxed ? 'MAX' : lvl ? `Upgrade · ${c}` : `Learn · ${c}`, !maxed && gold >= c, () => buySkill(id)]];
      if (lvl) btns.push([eq ? 'Equipped ✓' : 'Equip', !eq, () => { equip[S.slot] = id; applySkillButtons(); sfx.pickup('mp'); buildShop(); }, 'eq']);
      box.appendChild(mkCard(S.ic, S.name, S.desc, lvl, 5, btns, selId === id, () => selectShop(id)));
    }
    const S = SKILLS[selId], lvl = sk[selId];
    $('prevName').textContent = `${S.ic} ${S.name}`;
    $('prevDesc').innerHTML = `${S.desc}<br>${lvl ? `Level ${lvl}/5 · power +${25 * (lvl - 1)}%` : 'Not learned yet'} · ${S.mp} MP · ${S.cd}s cooldown${S.slot === 2 ? '<br><span class="hint">Hold to charge: bigger &amp; stronger (up to +25 MP)</span>' : ''}`;
  }
  buildRelics();
  if (shopTab !== 'stats' && !pvRun) { pvRun = true; requestAnimationFrame(pvLoop); }
}
document.querySelectorAll('#shopTabs button').forEach(b => b.addEventListener('click', () => { shopTab = b.dataset.tab; selId = null; buildShop(); }));
$('pgPrev').addEventListener('click', () => { skillPage = 1 - skillPage; selId = null; buildShop(); });
$('pgNext').addEventListener('click', () => { skillPage = 1 - skillPage; selId = null; buildShop(); });

// ----- shop preview: the real knight/enemy/effect drawing code, pointed at a second canvas -----
const pg = $('prevCv').getContext('2d');
function pvLoop(now) {
  if (state !== 'shop' || shopTab === 'stats') { pvRun = false; return; }
  drawPreview(now / 1000); requestAnimationFrame(pvLoop);
}
function drawPreview(t) {
  const sP = P, sC = camX, sW = wpn, sG = g, sT = time;
  const GP = 222, PV = { x: 120, y: GP, vx: 0, vy: 0, face: 1, ground: true, anim: t * 3, atkT: -1, step: 0, atkCd: 0, thrustT: 0, thrustLvl: 0, chg: 0, chg2: 0, inv: 0, hurt: 0, vortex: 0, spin: 0, parryT: 0, bShield: 0, bPow: 0, bHaste: 0 };
  const dummy = (x, h = 92, ty = 'brute') => ({ t: ty, x, y: GP, w: 46, h, face: -1, atk: 0, flash: 0, ph: x, hp: 1, maxHp: 1, boss: false });
  const hitFlash = (e, at, p) => { if (p > at && p < at + 0.08) e.flash = 0.1; };
  const vbolt = (x, k) => { const pts = [[x, GP - 280]]; for (let i = 1; i < 6; i++) pts.push([x + Math.sin(k * 40 + i * 7 + x) * 16, GP - 280 + 280 * i / 6]); pts.push([x, GP]); return pts; };
  try {
    P = PV; camX = 0; g = pg; time = t;
    if (typeof selId === 'number') wpn = selId;
    pg.clearRect(0, 0, 480, 270);
    const bg = pg.createLinearGradient(0, 0, 0, 270); bg.addColorStop(0, '#0d0820'); bg.addColorStop(1, '#241238');
    pg.fillStyle = bg; pg.fillRect(0, 0, 480, 270);
    pg.fillStyle = '#07040e'; pg.fillRect(0, GP + 2, 480, 60);
    const c = wcol(), T = [], fx = [];
    const ring = (x, y, k, col, maxR) => () => { pg.save(); pg.globalCompositeOperation = 'lighter'; pg.strokeStyle = col.replace('A', Math.max(0, 1 - k)); pg.lineWidth = 6 * (1 - k) + 2; pg.shadowColor = c[2]; pg.shadowBlur = 16; pg.beginPath(); pg.arc(x, y, 14 + k * maxR, 0, 7); pg.stroke(); pg.restore(); };
    const orb = q => () => {
      const r = 6 + 22 * q, ox = PV.x - 22, oy = PV.y - 56;
      pg.save(); pg.globalCompositeOperation = 'lighter';
      const gr = pg.createRadialGradient(ox, oy, 0, ox, oy, r * 1.6);
      gr.addColorStop(0, q > 0.7 ? 'rgba(255,255,255,0.95)' : `rgba(${c[1]},0.8)`); gr.addColorStop(1, `rgba(${c[0]},0)`);
      pg.fillStyle = gr; pg.beginPath(); pg.arc(ox, oy, r * 1.6, 0, 7); pg.fill(); pg.restore();
    };
    const tag = txt => fx.push(() => { pg.save(); pg.fillStyle = 'rgba(230,196,106,0.9)'; pg.font = '700 15px system-ui, sans-serif'; pg.textAlign = 'left'; pg.fillText(txt, 12, 24); pg.restore(); });
    if (typeof selId === 'number') {   // ---- weapon: idle -> 5-hit combo -> charge -> charge move ----
      const p = t % 6.0, tg = dummy(400); T.push(tg);
      if (p >= 0.8 && p < 2.9) {
        tag('5-HIT COMBO');
        const k = (p - 0.8) % 0.42, st = Math.floor((p - 0.8) / 0.42) % 5, sp = COMBO[st];
        PV.step = st; PV.atkT = k < 0.22 ? 0.22 - k : -1; PV.x += k < 0.2 ? 10 + st * 4 : 0;
        if (k < 0.28) fx.push(() => drawSlash({ x: PV.x + 20, y: PV.y - 44, face: 1, r: sp.r, life: 0.28 - k, max: 0.28, a0: sp.a0, span: sp.span, dirSign: sp.ds, full: false, big: sp.big, wl: selId }));
        if (k < 0.05) tg.flash = 0.1;
      } else if (p >= 2.9 && p < 4.0) {
        tag('HOLD TO CHARGE'); PV.chg = 0.5; fx.push(orb((p - 2.9) / 1.1));
      } else if (p >= 4.0 && p < 5.3) {
        tag(WPN[selId].chn.toUpperCase());
        const q = (p - 4.0) / 1.3, st = WPN[selId].ch;
        hitFlash(tg, 0.35, q);
        if (st === 'thrust' || st === 'twin' || st === 'void') {
          PV.x += 150 * clamp(q / 0.5, 0, 1); PV.thrustT = q < 0.55 ? 1 : 0; PV.thrustLvl = 0.8;
          if (st === 'twin') hitFlash(tg, 0.15, q);
          fx.push(() => { drawCharge(); if (st === 'void' && q > 0.5) ring(PV.x, PV.y - 44, (q - 0.5) / 0.5, `rgba(${c[1]},A)`, 260)(); });
        } else if (st === 'moon') {
          PV.atkT = 0.15; tg.x = 400 - 50 * clamp(q * 3, 0, 1);
          fx.push(() => { for (let i = 0; i < 3; i++) { const qi = q * 1.3 - i * 0.13; if (qi >= 0 && qi < 0.32) drawSlash({ x: PV.x, y: PV.y - 50, face: 1, r: 175 + i * 14, life: 0.32 - qi, max: 0.32, a0: -2.4 + i * 0.5, span: 3.4 - i * 0.4, dirSign: i % 2 ? -1 : 1, full: false, big: true, wl: selId }); } });
          for (let i = 0; i < 3; i++) hitFlash(tg, i * 0.1 + 0.05, q);
        } else if (st === 'cross') {
          PV.atkT = 0.15;
          fx.push(() => { drawSlash({ x: PV.x, y: PV.y - 50, face: 1, r: 150, life: Math.max(0.01, 0.3 - q * 0.8), max: 0.3, a0: -1.2, span: 2.0, dirSign: 1, full: false, big: true, wl: selId }); if (q > 0.12) drawSlash({ x: PV.x, y: PV.y - 50, face: 1, r: 165, life: Math.max(0.01, 0.3 - (q - 0.12) * 0.8), max: 0.3, a0: -0.8, span: 2.0, dirSign: -1, full: false, big: true, wl: selId }); });
        } else {   // god: leap, crash, lightning columns
          PV.y = GP - 140 * (q < 0.5 ? Math.sin(q / 0.5 * Math.PI / 2) : clamp(1 - (q - 0.5) / 0.15, 0, 1)); PV.ground = PV.y >= GP;
          if (q > 0.65) fx.push(() => { const k = q - 0.65; pg.save(); pg.globalCompositeOperation = 'lighter'; pg.strokeStyle = `rgba(${c[1]},${Math.max(0, 1 - k * 2)})`; pg.lineWidth = 5; pg.beginPath(); pg.ellipse(PV.x, GP, 20 + k * 260, 10 + k * 26, 0, 0, 7); pg.stroke(); pg.restore(); for (const d of [-1, 1]) for (let i = 1; i <= 3; i++) if (k > i * 0.05 && k < i * 0.05 + 0.2) drawBoltPts(vbolt(PV.x + d * i * 95, k), 1 - (k - i * 0.05) / 0.2); });
        }
      }
    } else {                           // ---- skill demo, looping (slot-2 skills show the tap version, then the charged one) ----
      const id = selId, isL = SKILLS[id].slot === 2, tt = t % (isL ? 6.4 : 3.4), ph = isL && tt >= 3.2 ? 1 : 0, qq = isL ? tt % 3.2 : tt, q = ph ? qq - 0.6 : qq, ch = ph;
      const tg = dummy(360); T.push(tg);
      if (isL) { tag(ph ? 'HOLD → CHARGED' : 'TAP'); if (ph && qq < 0.9) { PV.chg = 0.5; fx.push(orb(qq / 0.9)); } }
      if (id === 'chain') { T.length = 0; T.push(dummy(300, 60, 'beast'), dummy(370, 60, 'beast'), dummy(440, 60, 'beast')); }
      PV.atkT = q > 0.3 && q < 0.5 ? 0.15 : -1;
      if (id === 'vortex') {
        if (q > 0.3 && q < 1.1) { PV.vortex = 1; PV.y = GP - 40 * Math.sin((q - 0.3) / 0.8 * Math.PI); PV.x += 120 * (q - 0.3) / 0.8; hitFlash(tg, 0.6, q); fx.push(() => { for (let i = 0; i < 3; i++) drawSlash({ x: PV.x, y: PV.y - 44, face: 1, r: 90 + i * 25, life: 0.15, max: 0.25, a0: t * 30 + i * 2, span: 3, dirSign: 1, full: true, big: true, wl: wpn }); }); }
      } else if (id === 'nova') {
        if (q > 0.4 && q < 1.3) { const k = (q - 0.4) / 0.9; hitFlash(tg, 0.5, q); fx.push(ring(PV.x, PV.y - 44, k, `rgba(${c[1]},A)`, 300)); }
      } else if (id === 'rain') {
        fx.push(() => { for (let i = 0; i < 8; i++) { const k = clamp((q - 0.4 - i * 0.07) / 0.3, 0, 1); if (k <= 0 || k >= 1) continue; drawFallingBlade(PV.x + 90 + i * 34, -40 + (GP + 20) * k); } });
        hitFlash(tg, 0.8, q);
      } else if (id === 'siphon') {
        if (q > 0.4 && q < 1.2) { const a = 1 - (q - 0.4) / 0.8; fx.push(() => { for (let i = 0; i < 3; i++) drawBoltPts(curvePts(tg.x, GP - 50, PV.x, PV.y - 44, (i - 1) * 45), a, ['200,20,50', '255,110,130', '#ff4a6a'], 0.9); pg.save(); pg.fillStyle = '#5f6'; pg.font = '900 20px Impact, sans-serif'; pg.textAlign = 'center'; pg.fillText('+HP', PV.x, PV.y - 110 - (q - 0.4) * 20); pg.restore(); }); hitFlash(tg, 0.4, q); }
      } else if (id === 'meteor') {
        if (q > 0.3 && q < 1.6) { const m = { x: tg.x, t: Math.max(0, 0.8 - (q - 0.3)), max: 0.8, r: 150 }; fx.push(() => drawMeteor(m, GP)); if (q > 1.1) fx.push(ring(tg.x, GP - 20, (q - 1.1) / 0.5, `rgba(255,170,60,A)`, 150)); hitFlash(tg, 1.1, q); }
      } else if (id === 'step') {
        if (q > 0.3) {
          const back = q >= 0.42; PV.x = back ? 440 : 120 + 0; PV.face = back ? -1 : 1;
          if (q > 0.42 && q < 0.8) fx.push(() => { pg.save(); pg.globalCompositeOperation = 'lighter'; const a = 1 - (q - 0.42) / 0.38, gr = pg.createLinearGradient(120, 0, 440, 0); gr.addColorStop(0, `rgba(${c[1]},0)`); gr.addColorStop(1, `rgba(${c[1]},${a})`); pg.fillStyle = gr; pg.fillRect(120, GP - 60, 320, 36); pg.restore(); });
          for (let i = 0; i < 3; i++) { const qi = q - 0.5 - i * 0.11; if (qi >= 0 && qi < 0.28) fx.push(() => drawSlash({ x: PV.x - 20, y: GP - 44, face: -1, r: 112, life: 0.28 - qi, max: 0.28, a0: -1.3 + i * 0.9, span: 2.0, dirSign: i % 2 ? -1 : 1, full: false, big: i === 2, wl: wpn })); if (qi >= 0 && qi < 0.05) tg.flash = 0.1; }
        }
      } else if (id === 'wave') {
        if (q > 0.3 && q < 1.6) fx.push(() => drawWave({ x: PV.x + 40 + (q - 0.3) * 300, y: GP, face: 1, sz: 1 + 0.9 * ch }));
        hitFlash(tg, 1.1, q);
      } else if (id === 'fan') {
        if (q > 0.3 && q < 1.2) fx.push(() => { const n = 7 + ch * 4; for (let i = 0; i < n; i++) { const a = -0.12 + (i - (n - 1) / 2) * 0.1, d = (q - 0.3) * 520; drawDagger(PV.x + 24 + Math.cos(a) * d, PV.y - 50 + Math.sin(a) * d, a, `rgb(${c[1]})`); } });
        hitFlash(tg, 0.75, q);
      } else if (id === 'chain') {
        if (q > 0.4 && q < 0.8) {
          const pts = [[PV.x + 20, PV.y - 50]]; let px = PV.x + 20, py = PV.y - 50;
          for (const e of T) { for (let k = 1; k <= 4; k++) pts.push([px + (e.x - px) * k / 4 + (k < 4 ? Math.sin(t * 90 + k + e.x) * 12 : 0), py + (GP - 30 - py) * k / 4 + (k < 4 ? Math.cos(t * 70 + k + e.x) * 12 : 0)]); px = e.x; py = GP - 30; }
          const a = 1 - (q - 0.4) / 0.4;
          fx.push(() => { drawBoltPts(pts, a, null, 1 + 0.7 * ch); for (const e of T) for (let b = 0; b < 2; b++) drawBoltPts([[e.x, GP - 30], [e.x + (b ? 40 : -40), GP - 60 + Math.sin(t * 60 + b) * 10], [e.x + (b ? 80 : -80), GP - 80 + Math.cos(t * 50 + b) * 14]], a * 0.8, null, 0.6); });
          T.forEach(e => e.flash = 0.1);
        }
      } else if (id === 'boomer') {
        if (q > 0.3 && q < 1.7) { const d = (250 + 90 * ch) * Math.sin(Math.PI * clamp((q - 0.3) / 1.4, 0, 1)); fx.push(() => drawDisc(PV.x + 20 + d, PV.y - 50, t * 24, 1 + 0.6 * ch)); if (Math.abs(d - 220) < 25) tg.flash = 0.1; }
      } else if (id === 'beam') {
        if (q > 0.3 && q < 0.7) { const b = { x: PV.x + 20, y: PV.y - 50, face: 1, len: 340 + 80 * ch, wd: 1 + 0.9 * ch, life: 0.7 - q, max: 0.4 }; fx.push(() => drawBeam(b)); tg.flash = 0.1; }
      } else if (id === 'well') {
        if (q > 0.3 && q < 2.8) { tg.x = 360 - 70 * clamp((q - 0.4) / 1.2, 0, 1); fx.push(() => drawWell(300, GP - 60, 1, 1 + 0.5 * ch)); if (Math.floor(q * 3.3) !== Math.floor((q - 0.02) * 3.3)) tg.flash = 0.1; }
      }
    }
    for (const e of T) { e.flash = e.flash > 0 ? 0.1 : 0; drawEnemy(e); }
    drawPlayer();
    for (const f of fx) f();
  } finally { P = sP; camX = sC; wpn = sW; g = sG; time = sT; }
}
function buyUpgrade(id) {
  const lvl = up[id], cost = upCost(lvl);
  if (lvl >= MAX_UP || gold < cost) return;
  gold -= cost; up[id]++;
  if (id === 'hp') { P.maxHp += 20; P.hp += 20; }
  if (id === 'mp') { P.maxMp += 20; P.mp += 20; }
  sfx.pickup('hp'); buildShop();
}
function buyWeapon() {
  const c = wpnCost(wpn);
  if (wpn >= WPN.length - 1 || gold < c) return;
  gold -= c; wpn++; selId = wpn; sfx.pickup('pow'); buildShop();
}
function buySkill(id) {
  const S = SKILLS[id], c = skillCost(sk[id]);
  if (sk[id] >= 5 || gold < c) return;
  gold -= c; if (!sk[id]) equip[S.slot] = id;      // a newly learned skill is equipped right away
  sk[id]++; applySkillButtons(); sfx.pickup('mp'); buildShop();
}
function leaveShop() { if (state !== 'shop') return; shopPrep = false; state = 'play'; last = performance.now(); nextStage(); showUI(); }
$('btnNext').addEventListener('click', leaveShop);

// ----- small notification (used for the automatic low-effects switch) -----
let toastT = 0;
function toast(msg) { const el = $('toast'); el.textContent = msg; el.hidden = false; toastT = 3.5; }
function toastTick(dt) { if (toastT > 0 && (toastT -= dt) <= 0) $('toast').hidden = true; }


/* ======================================================================
   MAIN
   ====================================================================== */
// ---------- main loop ----------
function render() {
  g.save();
  g.clearRect(0, 0, W, H);
  if (shake > 0 && !settings.calm) g.translate(rnd(-shake, shake), rnd(-shake, shake));
  drawBG();
  drawFog(false);
  drawGround();
  if (P) {
    for (const e of enemies) if (e.boss) drawTelegraph(e);
    for (const e of enemies) { drawEnemy(e); drawStun(e); }
    for (const w of waves) drawWave(w);
    drawBoomers(); drawBolts(); drawMeteors(); drawWells(); drawBeams();
    drawQuakes();
    drawMarks();
    drawPlayer(); drawComboPips();
    drawAuras();
    drawShots();
    for (const s of slashes) drawSlash(s);
    drawParts();
    drawTexts();
  }
  if (!settings.lowfx) drawFog(true);
  // vignette
  const vg = g.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 680);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.32)');
  g.fillStyle = vg; g.fillRect(-20, -20, W + 40, H + 40);
  if (flash > 0) { g.fillStyle = `rgba(140,200,255,${flash * (settings.calm ? 0.25 : 1)})`; g.fillRect(-20, -20, W + 40, H + 40); }
  g.restore();
  if (P) drawHUD();
}

let last = performance.now(), fpsAcc = 0, fpsN = 0;
const rotateMQ = matchMedia('(orientation: portrait) and (pointer: coarse)');   // phones held upright
function loop(now) {
  const raw = (now - last) / 1000, dt = Math.min(0.033, raw); last = now;
  if (rotateMQ.matches && state === 'play') setPaused(true);
  if (state === 'play') {
    update(dt); toastTick(dt);
    // one-off frame-rate check: switch on low-effects automatically on weak devices
    if (!settings.autoChecked && ++fpsN > 30) {
      fpsAcc += raw;
      if (fpsN >= 210) {
        settings.autoChecked = true;
        if (fpsAcc / 180 > 0.026 && !settings.lowfx) { settings.lowfx = true; toast('Low-effects mode enabled for smoother play'); }
        saveSettings(); refreshChips();
      }
    }
  } else if (state === 'title' || state === 'over' || state === 'won') {
    time += dt;
    camX += dt * 30;
    if (P) { for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; } texts = texts.filter(t => (t.life -= dt) > 0); }
  }
  render();
  requestAnimationFrame(loop);
}
time = 0; camX = -W / 2;
showUI();
requestAnimationFrame(loop);

