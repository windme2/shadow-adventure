// ---------- HUD ----------
function bar(x, y, w, h, v, c1, c2, label) {
  g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(x, y, w, h);
  const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
  g.fillStyle = gr; g.fillRect(x + 2, y + 2, (w - 4) * clamp(v, 0, 1), h - 4);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5; g.strokeRect(x, y, w, h);
  g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText(label, x + 8, y + h - 5);
}
const CD = { skill1: 5, skill2: 3, dash: 1.1, parry: 0.75 };
function updateButtons() {
  const cds = { skill1: P.cd1, skill2: P.cd2, dash: P.dashCd, parry: P.parryCd };
  for (const k in cds) {
    const el = btnEls[k]; if (!el) continue;
    el.style.setProperty('--cd', Math.min(360, cds[k] / CD[k] * 360).toFixed(0) + 'deg');
    el.dataset.cd = cds[k] > 0 ? cds[k].toFixed(1) : '';
    el.classList.toggle('nomp', (k === 'skill1' && P.mp < 30) || (k === 'skill2' && P.mp < 20));
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
  g.save();
  g.fillStyle = 'rgba(8,4,16,0.75)'; g.strokeStyle = '#2cf0ff'; g.lineWidth = 2.5; g.shadowColor = '#2cf0ff'; g.shadowBlur = 10;
  g.beginPath(); g.arc(46, 46, 32, 0, 7); g.fill(); g.stroke(); g.restore();
  g.fillStyle = '#04020a'; g.beginPath(); g.arc(46, 50, 17, 0, 7); g.fill();
  g.beginPath(); g.moveTo(35, 40); g.lineTo(31, 22); g.lineTo(42, 36); g.fill();
  g.beginPath(); g.moveTo(57, 40); g.lineTo(63, 21); g.lineTo(50, 36); g.fill();
  eyes(46, 48, '#2cf0ff', 6, 2.8, 12);
  bar(88, 20, 240, 22, P.hp / P.maxHp, '#ff4a5a', '#8e0f22', `HP ${Math.ceil(P.hp)}/${P.maxHp}`);
  bar(88, 46, 200, 16, P.mp / P.maxMp, '#4ab4ff', '#1040a0', `MP ${Math.floor(P.mp)}/${P.maxMp}`);
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
  // boss bar
  const boss = enemies.find(e => e.boss);
  if (boss) {
    g.textAlign = 'center'; g.font = '900 16px Impact, sans-serif'; g.fillStyle = boss.rage ? '#ff5040' : '#d8a8ff';
    g.fillText(boss.name + (boss.rage ? '  (ENRAGED)' : ''), W / 2, 106);
    bar(W / 2 - 190, 112, 380, 14, boss.hp / boss.maxHp, boss.rage ? '#ff5030' : boss.col, boss.rage ? '#801010' : '#20103a', '');
  }
  if (banner) {
    g.save(); g.globalAlpha = clamp(banner.t, 0, 1); g.textAlign = 'center';
    g.font = '900 44px Impact, "Arial Black", sans-serif'; g.fillStyle = '#ff4060'; g.shadowColor = '#f02040'; g.shadowBlur = 24;
    g.fillText(banner.text, W / 2, 210); g.restore();
  }
  updateButtons();
}
