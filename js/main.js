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
    drawQuakes();
    drawMarks();
    drawPlayer();
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
