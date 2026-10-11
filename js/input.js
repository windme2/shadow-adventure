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
  KeyL: 'skill2', KeyC: 'skill2', ArrowDown: 'parry', KeyS: 'parry', KeyU: 'parry', ShiftLeft: 'dash', ShiftRight: 'dash', KeyI: 'dash',
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

