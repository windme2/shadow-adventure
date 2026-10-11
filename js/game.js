// ---------- game state ----------
let state = 'title';
let P, enemies, slashes, parts, texts, orbs, waves, shots, quakes, banner;
let gold, stage = 1, wave = 1, waveKills = 0, phase = 'wave', stageT = 0;
const STAGES = 5, WAVES = 3;
const STAGE_NAMES = ['THE RUINED GATE', 'WITHERED GARDEN', 'BONE CATHEDRAL', 'ASHEN CRYPT', 'THRONE OF SHADOWS'];
const BOSS_NAMES = ['CRIMSON WARDEN', 'BONE COLOSSUS', 'THE HOLLOW KING', 'ASHEN REAPER', 'SHADOW EMPEROR'];
const BOSS_COL = ['#7a20ff', '#20c0ff', '#40ff80', '#ffa020', '#ff2040'];
let up = { hp: 0, pow: 0, mp: 0, cdr: 0 }, marks = [];   // shop upgrades; boss ground markers
const cdr = () => 1 - 0.08 * up.cdr;
const quota = () => 5 + stage + wave * 2;
let camX, shake, hitstop, time, kills, score, spawnT, combo, comboT, best = 0, flash;
try { best = +localStorage.getItem('shadowKnightBest') || 0; } catch (e) {}

function start() {
  P = {
    x: 0, y: GROUND, vx: 0, vy: 0, face: 1, ground: true,
    hp: 100, maxHp: 100, mp: 100, maxMp: 100,
    atkT: 0, atkCd: 0, step: 0, spin: 0, dashT: 0, dashCd: 0, inv: 0,
    cd1: 0, cd2: 0, vortex: 0, anim: 0, hurt: 0, bPow: 0, bHaste: 0, bShield: 0,
    parryT: 0, parryCd: 0, chg: 0, cs: false, rdy: false, chg2: 0, cs2: false, full2: false, thrustT: 0, thrustLvl: 0, thrustHit: null,
  };
  enemies = []; slashes = []; parts = []; texts = []; orbs = []; waves = []; shots = []; quakes = []; banner = null;
  gold = 0; stage = 1; wave = 1; waveKills = 0; phase = 'wave'; stageT = 0;
  up = { hp: 0, pow: 0, mp: 0, cdr: 0 }; marks = [];
  camX = -W / 2; shake = 0; hitstop = 0; time = 0; kills = 0; score = 0; spawnT = 1; combo = 0; comboT = 0; flash = 0;
  for (const k in queue) queue[k] = false;
  banner = { text: 'STAGE 1 — ' + STAGE_NAMES[0], t: 3 };
  const dbg = /^#boss(\d?)$/.exec(location.hash);   // debug: #boss / #boss3 jumps straight to a stage boss
  if (dbg) { stage = +dbg[1] || 1; beginBoss(); }
  state = 'play';
  sfx.start();
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
};
function pickType() {
  const t = (stage - 1) * WAVES + wave;   // 1..15
  const pool = [['wraith', 3], ['beast', 3], ['bat', t >= 2 ? 3 : 0], ['archer', t >= 3 ? 2 : 0], ['bomber', t >= 4 ? 2 : 0], ['brute', t >= 5 ? 1.5 : 0]];
  let r = Math.random() * pool.reduce((a, b) => a + b[1], 0);
  for (const [k, w] of pool) { if ((r -= w) < 0) return k; }
  return 'beast';
}
function makeEnemy(t, x) {
  const T = TYPES[t], diff = 1 + (stage - 1) * 0.45 + wave * 0.08;
  const e = {
    t, ...T, hp: T.hp * (0.9 + diff * 0.1), maxHp: T.hp * (0.9 + diff * 0.1),
    x, y: T.fly ? GROUND - (t === 'bat' ? rnd(120, 200) : rnd(60, 130)) : GROUND,
    baseY: 0, vx: 0, vy: 0, face: 1, atk: 0, atkCd: rnd(0.4, 1.2), flash: 0, kb: 0, ph: rnd(0, 6), dead: false,
    dive: 0, diveCd: rnd(1, 2), fuse: 0,
  };
  e.baseY = e.y;
  enemies.push(e);
  return e;
}
function spawn() {
  makeEnemy(pickType(), camX + W + 60 + rnd(0, 80));   // enemies always advance from the right
}
function spawnBoss() {
  const side = Math.random() < 0.5 ? -1 : 1, hp = 1200 + 800 * (stage - 1);
  const name = BOSS_NAMES[stage - 1];
  enemies.push({
    t: 'boss', boss: true, st: stage, name, col: BOSS_COL[stage - 1], hp, maxHp: hp, spd: 64 + stage * 6, w: 70, h: 170, dmg: 18 + stage * 2, score: 3000 + stage * 1500,
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
function hurtEnemy(e, dmg, kbDir, kbPow = 220, crit = Math.random() < 0.2) {
  if (e.dead) return;
  let d = Math.round(dmg * (P.bPow > 0 ? 1.6 : 1) * (1 + 0.12 * up.pow) * (e.boss && e.mode === 'rec' ? 1.25 : 1) * (e.stun > 0 || e.mode === 'stun' ? 1.5 : 1) * rnd(0.85, 1.15) * (crit ? 2 : 1));
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
  if (e.hp <= 0) {
    e.dead = true; kills++; score += e.score * (1 + Math.floor(combo / 10) * 0.1) | 0;
    sparks(e.x, cy, 30, '#a050ff', 380);
    if (e.boss) bossDown(e); else { dropLoot(e.x, cy, e.t === 'brute' ? 2 : 1); progressKill(); }
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
  const n = Math.random() < 0.7 ? 1 + (Math.random() * 2 * m | 0) : 0;
  for (let i = 0; i < n; i++) drop(x, y, 'coin');
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
    case 'coin': gold++; score += 25; t('+1 GOLD', '#ffcf30'); break;
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
  if (stage >= STAGES) { phase = 'won'; stageT = 3.2; banner = { text: 'THE SHADOW IS SLAIN', t: 3.2 }; }
  else { phase = 'clear'; stageT = 4.2; banner = { text: 'STAGE ' + stage + ' CLEAR', t: 3.6 }; sfx.clear(); }
  flash = 0.7; shake = 20; hitstop = 0.25;
  for (let i = 0; i < 3; i++) setTimeout(() => state === 'play' && sparks(e.x + rnd(-40, 40), e.y - rnd(20, 150), 40, '#ff5a30', 500), i * 120);
  for (let i = 0; i < 16; i++) drop(e.x, e.y - 80, 'coin');
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
        const opts = ['slam', 'charge', 'volley'];
        if (e.st >= 2) opts.push('leap');
        if (e.st >= 3) opts.push('rain');
        if (e.st >= 4) opts.push('blink');
        if (e.st >= 5 || rage) opts.push('summon');
        if (rage) opts.push('slam');
        e.mode = opts[Math.random() * opts.length | 0];
        e.mt = e.mtMax = { slam: 1.2, charge: 1.1, volley: 0.9, summon: 1.1, leap: 1.0, rain: 1.0, blink: 0.8 }[e.mode] / (rage ? 1.2 : 1);
        if (e.mode === 'charge') e.cdir = e.face;
        if (e.mode === 'leap') e.tx = P.x;
        if (e.mode === 'rain') for (let i = 0; i < 5; i++) marks.push({ x: P.x + (i - 2) * 120 + rnd(-30, 30), t: 1.0 + i * 0.14 });
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
      if (e.mt <= 0) { e.mode = 'rec'; e.mt = 1.3; }
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
        for (let i = 0; i < 2; i++) makeEnemy(Math.random() < 0.5 ? 'bat' : 'bomber', e.x + (i ? 70 : -70));
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
    case 'rain':
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
  P.step = P.atkT > -0.35 ? (P.step + 1) % 3 : 0;
  const big = P.step === 2, air = !P.ground;
  P.atkT = 0.22; P.atkCd = (big ? 0.34 : 0.2) * (P.bHaste > 0 ? 0.7 : 1);
  P.vx += P.face * (big ? 220 : 120);
  const cx = P.x + P.face * 20, cy = P.y - 44;
  slashes.push({
    x: cx, y: cy, face: P.face, r: big || air ? 120 : 92, life: 0.28, max: 0.28,
    a0: air ? -Math.PI * 0.9 : (P.step === 1 ? 0.9 : -1.0), span: air ? Math.PI * 1.8 : 1.9 + (big ? 0.6 : 0),
    dirSign: P.step === 1 ? -1 : 1, full: air, big,
  });
  if (air) P.spin = 0.3;
  slashHit(cx, cy, big || air ? 125 : 95, P.face, air, big ? 46 : 28, big ? 360 : 220);
  sfx.slash(big);
}
function doSkill1() {
  if (P.cd1 > 0 || P.mp < 30) return;
  P.mp -= 30; P.cd1 = 5 * cdr(); P.vortex = 0.55; P.inv = Math.max(P.inv, 0.6);
  P.vy = Math.min(P.vy, -260); P.ground = false;
  flash = 0.25;
  sfx.vortex();
}
// Shadow Wave: tap = normal, hold = bigger and stronger (costs more MP)
const WAVE_MIN = 0.3, WAVE_FULL = 1.0;
function castWave(l) {
  if (P.cd2 > 0 || P.mp < 20) return;
  l = clamp(l, 0, Math.max(0, (P.mp - 20) / 25));
  P.mp -= 20 + 25 * l; P.cd2 = (3 + l) * cdr(); P.atkT = 0.25;
  waves.push({ x: P.x + P.face * 30, y: GROUND, face: P.face, life: 0.9 + 0.5 * l, hit: new Set(), sz: 1 + 1.4 * l, dmg: 70 * (1 + 1.8 * l) });
  shake = Math.max(shake, 5 + 8 * l);
  sfx.wave(l);
}
// Charged thrust: hold attack, release to lunge forward and pierce everything in a line
const THRUST_READY = 0.45, THRUST_FULL = 0.8;
function doThrust(l) {
  P.thrustT = 0.2 + 0.14 * l; P.thrustLvl = l; P.thrustHit = new Set();
  P.atkCd = 0.5; P.atkT = 0; P.inv = Math.max(P.inv, P.thrustT + 0.05);
  flash = 0.12 + 0.1 * l; shake = Math.max(shake, 6 + 6 * l);
  sfx.thrust(l);
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
      castWave(clamp((P.chg2 - WAVE_MIN) / WAVE_FULL, 0, 1));
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
    hurtEnemy(e, 85 + 170 * P.thrustLvl, f, 520, P.thrustLvl > 0.6 ? true : undefined);
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
  sfx.parry();
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
  P.hp -= d; P.inv = 0.8; P.hurt = 0.2; P.vx = dir * 260; P.vy = -220; P.ground = false;
  shake = 10; combo = 0; flash = 0.1;
  sparks(P.x, P.y - 40, 14, '#f33');
  dmgText(P.x, P.y - 90, '-' + d, '#ff4040', false);
  sfx.hurt();
  if (P.hp <= 0) {
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
  comboT -= dt; if (comboT <= 0) combo = 0;
  shake = Math.max(0, shake - 30 * dt); flash = Math.max(0, flash - dt);

  // input
  if (queue.jump && P.ground) { P.vy = -620; P.ground = false; sfx.jump(); }
  if (queue.skill1) doSkill1();
  if (queue.skill2 && P.cd2 <= 0 && P.mp >= 20) P.chg2 = 0.001;
  if (queue.dash) doDash();
  if (queue.parry) doParry();
  if (queue.attack) doAttack();
  chargeInput(dt);
  for (const k in queue) queue[k] = false;

  const dir = (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0);
  if (P.dashT > 0) { P.dashT -= dt; P.vx = P.face * 700; P.vy = 0;
    if (Math.random() < 0.8) parts.push({ x: P.x, y: P.y - rnd(10, 70), vx: 0, vy: 0, life: 0.3, max: 0.3, col: '#37f', sz: 5, grav: 0 });
  } else if (P.thrustT > 0) {
    P.vx = P.face * (850 + 450 * P.thrustLvl); P.vy = 0;
    thrustHits();
    parts.push({ x: P.x, y: P.y - rnd(30, 70), vx: -P.face * rnd(40, 200), vy: rnd(-30, 30), life: 0.35, max: 0.35, col: Math.random() < 0.5 ? '#4cf' : '#fff', sz: rnd(3, 6), grav: 0 });
  } else {
    const spd = (P.bHaste > 0 ? 330 : 250) * (P.chg > 0.3 || P.chg2 > WAVE_MIN ? 0.45 : 1);
    if (dir) { P.face = dir; P.vx += (dir * spd - P.vx) * Math.min(1, 12 * dt); }
    else P.vx *= Math.pow(0.0008, dt);
    P.vy += 1700 * dt;
  }
  P.x += P.vx * dt; P.y += P.vy * dt;
  if (P.y >= GROUND) { P.y = GROUND; P.vy = 0; P.ground = true; } else P.ground = false;
  P.anim += dt * (Math.abs(P.vx) > 20 ? 10 : 2);

  // vortex skill: repeated 360 hits
  if (P.vortex > 0) {
    P.spin = 0.1;
    if (Math.floor(P.vortex * 20) !== Math.floor((P.vortex + dt) * 20) && Math.floor(P.vortex * 20) % 2 === 0) {
      slashHit(P.x, P.y - 44, 170, P.face, true, 38, 300);
    }
    if (Math.random() < 0.7) {
      slashes.push({ x: P.x, y: P.y - 44, face: P.face, r: rnd(90, 170), life: 0.25, max: 0.25, a0: rnd(0, 6.28), span: rnd(2, 4), dirSign: 1, full: true, big: true });
    }
  }

  // waves (shadow wave projectile)
  for (const w of waves) {
    w.life -= dt; w.x += w.face * 620 * dt;
    if (Math.random() < 0.9) parts.push({ x: w.x, y: GROUND - rnd(0, 110 * w.sz), vx: -w.face * rnd(0, 80), vy: rnd(-100, 0), life: 0.4, max: 0.4, col: Math.random() < 0.5 ? '#4cf' : '#fff', sz: rnd(2, 4), grav: 0 });
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
  const cap = bossAlive ? 3 : Math.min(12, 3 + Math.floor(tier / 2));
  if (spawnT <= 0 && minions < cap && (phase === 'wave' || bossAlive)) { spawn(); spawnT = Math.max(0.55, 2.1 - tier * 0.09) * (bossAlive ? 2 : 1); }

  // enemies
  for (const e of enemies) {
    e.flash = Math.max(0, e.flash - dt);
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
        if (e.atk <= 0 && dist < e.w + 38 && P.y - e.y < 40 && e.y - P.y < e.h + 20) hurtPlayer(e.dmg, e.face);
      } else {
        if (dist > e.w + 20) e.x += e.face * e.spd * dt;
        else if (e.atkCd <= 0) { e.atk = 0.4; e.atkCd = rnd(1.1, 1.8); }
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
        hurtEnemy(e, 90, Math.sign(sh.vx), 260); sh.life = 0; break;
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
    if (o.age > 0.5 && d < 150) { const k = Math.min(1, 6 * dt); o.x += (P.x - o.x) * k; o.y += ((P.y - 30) - o.y) * k; }
    if (d < 38 && o.age > 0.25) pickup(o);
    if (o.age > 14) o.gone = true;
  }
  orbs = orbs.filter(o => !o.gone);

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

