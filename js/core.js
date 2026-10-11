const W = 960, H = 540, GROUND = 450;
const cv = document.getElementById('c');
const g = cv.getContext('2d');

// ---------- helpers ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }


// ---------- settings ----------
const settings = { sound: true, lowfx: false, calm: false, autoChecked: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem('skSettings') || '{}')); } catch (e) {}
function saveSettings() { try { localStorage.setItem('skSettings', JSON.stringify(settings)); } catch (e) {} }
// "Low effects": neutralise canvas glow (shadowBlur) globally - by far the costliest effect on weak GPUs
const sbDesc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
Object.defineProperty(g, 'shadowBlur', { get() { return sbDesc.get.call(g); }, set(v) { sbDesc.set.call(g, settings.lowfx ? 0 : v); }, configurable: true });
