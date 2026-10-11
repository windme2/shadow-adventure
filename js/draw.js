// ---------- drawing: characters ----------
function eyes(x, y, col, gap = 5, sz = 2.6, glow = 10) {
  g.save(); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = glow;
  g.beginPath(); g.ellipse(x - gap, y, sz * 1.4, sz * 0.8, 0, 0, 7); g.ellipse(x + gap, y, sz * 1.4, sz * 0.8, 0, 0, 7); g.fill(); g.restore();
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
  eyes(5, -72, '#2cf0ff', 3.2, 2.2, 14);
  // sword arm + sword
  const sw = P.atkT > 0 ? (0.22 - P.atkT) / 0.22 : 0;
  const ang = P.thrustT > 0 ? -0.04 : P.chg > 0.3 ? Math.PI + 0.25 : P.atkT > 0 ? -1.6 + sw * 3.2 * (P.step === 1 ? -1 : 1) : -0.5 + Math.sin(P.anim * 0.5) * 0.08;
  g.save(); g.translate(8, -54); g.rotate(ang);
  g.strokeStyle = '#04020a'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(18, 4); g.stroke();
  g.shadowColor = '#4cf'; g.shadowBlur = P.atkT > 0 ? 18 : 6;
  g.fillStyle = '#0a1830'; g.beginPath(); g.moveTo(16, 0); g.lineTo(68, -3); g.lineTo(76, 2); g.lineTo(68, 6); g.lineTo(16, 7); g.fill();
  g.strokeStyle = 'rgba(120,220,255,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(18, 3); g.lineTo(74, 2); g.stroke();
  g.restore();
  g.restore();
}
function drawEnemy(e) {
  g.save(); g.translate(e.x - camX, e.y);
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
  // hp bar
  if (e.hp < e.maxHp && !e.boss) {
    const bw = 40, bx = e.x - camX - bw / 2, by = e.y - e.h - (e.t === 'brute' ? 32 : 16);
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(bx - 1, by - 1, bw + 2, 6);
    g.fillStyle = '#e02a40'; g.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 4);
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
    g.strokeStyle = ['rgba(30,110,255,' + 0.35 * fade + ')', 'rgba(90,200,255,' + 0.7 * fade + ')', 'rgba(255,255,255,' + fade + ')'][pass];
    g.lineWidth = w; g.lineCap = 'round';
    g.shadowColor = '#3af'; g.shadowBlur = 24;
    g.beginPath();
    if (s.dirSign > 0) g.arc(0, 0, s.r, a0, a0 + span); else g.arc(0, 0, s.r, a0 + s.span - span + s.span * 0, a0 + s.span);
    g.stroke();
  }
  g.restore();
}
function drawWave(w) {
  // crescent blade of energy standing on the ground, with fading echoes behind it
  g.save(); g.globalCompositeOperation = 'lighter'; g.translate(w.x - camX, w.y); g.scale(w.face * w.sz, w.sz);
  g.shadowColor = '#3cf'; g.shadowBlur = 24;
  const gl = g.createRadialGradient(0, 0, 0, 0, 0, 90);
  gl.addColorStop(0, 'rgba(80,200,255,0.35)'); gl.addColorStop(1, 'rgba(80,200,255,0)');
  g.fillStyle = gl; g.save(); g.scale(1, 0.18); g.beginPath(); g.arc(0, 0, 90, 0, 7); g.fill(); g.restore();
  const crescent = (dx, k) => {
    const gr = g.createLinearGradient(dx - 20, 0, dx + 72 * k, 0);
    gr.addColorStop(0, 'rgba(30,110,255,0)'); gr.addColorStop(0.55, 'rgba(70,180,255,0.65)'); gr.addColorStop(1, 'rgba(235,252,255,0.97)');
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
function drawShots() {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const sh of shots) {
    g.fillStyle = sh.col; g.shadowColor = sh.col; g.shadowBlur = 14;
    if (sh.fall) { g.fillRect(sh.x - camX - 5, sh.y - 90, 10, 90); g.beginPath(); g.moveTo(sh.x - camX - 9, sh.y); g.lineTo(sh.x - camX, sh.y + 22); g.lineTo(sh.x - camX + 9, sh.y); g.fill(); }
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
  if (!['slam', 'charge', 'volley', 'summon', 'leap', 'rain', 'blink'].includes(m)) return;
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
    gr.addColorStop(0, ready ? 'rgba(255,255,255,0.95)' : 'rgba(150,230,255,0.8)'); gr.addColorStop(1, 'rgba(40,120,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(tx - camX, ty, r * 1.6, 0, 7); g.fill(); g.restore();
    if (Math.random() < 0.7) { const a = rnd(0, 6.28), d = rnd(40, 70); parts.push({ x: tx + Math.cos(a) * d, y: ty + Math.sin(a) * d, vx: -Math.cos(a) * d * 3.2, vy: -Math.sin(a) * d * 3.2, life: 0.3, max: 0.3, col: ready ? '#fff' : '#6cf', sz: 3, grav: 0 }); }
    chargeBar(x, P.y - 122, p, '#ff7a1a', ready);
  }
  if (P.chg2 > 0.15) {
    const l = clamp((P.chg2 - WAVE_MIN) / WAVE_FULL, 0, 1), full = P.full2;
    const ox = P.x + f * 50, oy = P.y - 24, r = 8 + 36 * l + (full ? Math.sin(time * 30) * 2 : 0);
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(ox - camX, oy, 0, ox - camX, oy, r * 1.5);
    gr.addColorStop(0, full ? 'rgba(255,255,255,0.95)' : 'rgba(120,230,255,0.85)'); gr.addColorStop(1, 'rgba(30,120,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(ox - camX, oy, r * 1.5, 0, 7); g.fill(); g.restore();
    if (Math.random() < 0.8) { const a = rnd(0, 6.28), d = rnd(50, 90); parts.push({ x: ox + Math.cos(a) * d, y: oy + Math.sin(a) * d * 0.7, vx: -Math.cos(a) * d * 3.2, vy: -Math.sin(a) * d * 2.2, life: 0.3, max: 0.3, col: full ? '#fff' : '#4cf', sz: 3, grav: 0 }); }
    chargeBar(x, P.y - 122, l, '#2ad4ff', full);
  }
  if (P.thrustT > 0) {
    const l = P.thrustLvl, len = 160 + 150 * l, y = P.y - 52, tail = x - f * 30, tip = x + f * len;
    g.save(); g.globalCompositeOperation = 'lighter'; g.shadowColor = '#3af'; g.shadowBlur = 26;
    for (const [hw, col] of [[16 + 10 * l, 'rgba(40,120,255,0.55)'], [8 + 4 * l, 'rgba(130,220,255,0.85)'], [3, 'rgba(255,255,255,1)']]) {
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

