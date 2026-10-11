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
    st.textContent = `Score ${score.toLocaleString('en-US')}  ·  Kills ${kills}  ·  Best ${best.toLocaleString('en-US')}`;
    btn.textContent = 'Play again';
  } else if (state === 'title') {
    title.textContent = 'SHADOW'; sub.textContent = 'The Legend of the Shadow Knight'; st.hidden = true; btn.textContent = 'Start';
  }
  $('btnMute').textContent = settings.sound ? '🔊' : '🔇';
}

// ----- settings (shared by the intro screen and the pause menu) -----
const CHIPS = [
  { key: 'sound', label: 'Sound', apply: () => { applySound(); $('btnMute').textContent = settings.sound ? '🔊' : '🔇'; } },
  { key: 'lowfx', label: 'Low effects' },
  { key: 'calm', label: 'Reduce shake & flash' },
];
function refreshChips() {
  document.querySelectorAll('[data-chips] button').forEach(b => {
    const on = !!settings[b.dataset.key];
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    b.textContent = b.dataset.label + ': ' + (on ? 'On' : 'Off');
  });
}
document.querySelectorAll('[data-chips]').forEach(box => {
  for (const c of CHIPS) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.key = c.key; b.dataset.label = c.label; b.className = 'chip';
    b.addEventListener('click', () => { settings[c.key] = !settings[c.key]; if (c.key === 'lowfx') settings.autoChecked = true; (c.apply || (() => {}))(); saveSettings(); refreshChips(); });
    box.appendChild(b);
  }
});
refreshChips();
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

// ----- upgrade shop (opens after every boss) -----
const UPGRADES = [
  { id: 'hp',  name: 'Vitality',  desc: '+20 max HP',     ic: '♥' },
  { id: 'pow', name: 'Might',     desc: '+12% damage',    ic: '⚔' },
  { id: 'mp',  name: 'Focus',     desc: '+20 max MP',     ic: '◆' },
  { id: 'cdr', name: 'Swiftness', desc: '−8% cooldowns',  ic: '≫' },
];
const MAX_UP = 5, upCost = l => 20 + 20 * l;
function openShop() { state = 'shop'; buildShop(); sfx.clear(); showUI(); }
function buildShop() {
  $('shopStage').textContent = `Stage ${stage} cleared`;
  $('shopGold').textContent = `${gold} gold`;
  const box = $('shopCards'); box.innerHTML = '';
  for (const u of UPGRADES) {
    const lvl = up[u.id], maxed = lvl >= MAX_UP, cost = upCost(lvl), can = !maxed && gold >= cost;
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `<div class="ic">${u.ic}</div><h3>${u.name}</h3><p>${u.desc}</p><div class="pips">${Array.from({ length: MAX_UP }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>`;
    const b = document.createElement('button'); b.type = 'button'; b.disabled = !can;
    b.textContent = maxed ? 'MAX' : `${cost} gold`;
    b.addEventListener('click', () => buyUpgrade(u.id));
    card.appendChild(b); box.appendChild(card);
  }
}
function buyUpgrade(id) {
  const lvl = up[id], cost = upCost(lvl);
  if (lvl >= MAX_UP || gold < cost) return;
  gold -= cost; up[id]++;
  if (id === 'hp') { P.maxHp += 20; P.hp += 20; }
  if (id === 'mp') { P.maxMp += 20; P.mp += 20; }
  sfx.pickup('hp'); buildShop();
}
function leaveShop() { if (state !== 'shop') return; state = 'play'; last = performance.now(); nextStage(); showUI(); }
$('btnNext').addEventListener('click', leaveShop);

// ----- small notification (used for the automatic low-effects switch) -----
let toastT = 0;
function toast(msg) { const el = $('toast'); el.textContent = msg; el.hidden = false; toastT = 3.5; }
function toastTick(dt) { if (toastT > 0 && (toastT -= dt) <= 0) $('toast').hidden = true; }
