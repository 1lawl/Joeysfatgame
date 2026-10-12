'use strict';
// ============================================================
//  Core: canvas, math helpers, input, audio, particles
// ============================================================

const W = 960, H = 540;
const GROUND_TOP = 350, GROUND_BOTTOM = 524;
const GRAV = 0.6;
const TAU = Math.PI * 2;
const FONT = '"Luckiest Guy", "Arial Black", Impact, sans-serif';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let DPR = 1;

function resize() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
  DPR = Math.min(2, Math.max(1, (window.devicePixelRatio || 1) * s));
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
}
window.addEventListener('resize', resize);
resize();

// ---------- math ----------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sign = (v) => (v < 0 ? -1 : 1);
const approach = (v, t, s) => (v < t ? Math.min(v + s, t) : Math.max(v - s, t));
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
function hash(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = n + (n << 3);
  n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d);
  n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967296;
}

// ---------- input ----------
const ACTIONS = ['left', 'right', 'up', 'down', 'light', 'heavy', 'jump', 'magic', 'block', 'start'];
const KEYMAPS = {
  kb1: {
    left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
    light: ['KeyJ'], heavy: ['KeyK'], jump: ['Space'], magic: ['KeyL'],
    block: ['KeyI', 'ShiftLeft'], start: ['Enter'],
  },
  kb2: {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    light: ['Numpad1', 'Comma'], heavy: ['Numpad2', 'Period'], jump: ['Numpad0', 'Slash'],
    magic: ['Numpad3', 'Semicolon'], block: ['NumpadEnter', 'Quote'], start: ['NumpadAdd', 'Backslash'],
  },
};
const GAME_KEYS = new Set(['Escape', 'KeyP', 'KeyM', 'Tab']);
for (const m of Object.values(KEYMAPS)) for (const a of ACTIONS) m[a].forEach((k) => GAME_KEYS.add(k));

const keysDown = new Set();
const keysTapped = new Set();
const sysTaps = new Set();
window.addEventListener('keydown', (e) => {
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  if (!e.repeat) keysTapped.add(e.code);
  keysDown.add(e.code);
  Snd.unlock();
});
window.addEventListener('keyup', (e) => keysDown.delete(e.code));
window.addEventListener('blur', () => keysDown.clear());
window.addEventListener('pointerdown', () => Snd.unlock());

class Device {
  constructor(id, kind, map, padIndex) {
    this.id = id; this.kind = kind; this.map = map; this.padIndex = padIndex;
    this.cur = {}; this.prev = {};
    this.label = kind === 'kb' ? (id === 'kb1' ? 'Keyboard (WASD)' : 'Keyboard (Arrows)') : 'Gamepad ' + (padIndex + 1);
  }
  poll() {
    this.prev = this.cur;
    const c = {};
    if (this.kind === 'kb') {
      for (const a of ACTIONS) c[a] = this.map[a].some((k) => keysDown.has(k) || keysTapped.has(k));
    } else {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = pads && pads[this.padIndex];
      if (gp) {
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
        c.left = ax < -0.4 || b(14); c.right = ax > 0.4 || b(15);
        c.up = ay < -0.4 || b(12); c.down = ay > 0.4 || b(13);
        c.jump = b(0); c.magic = b(1); c.light = b(2); c.heavy = b(3);
        c.block = b(4) || b(5) || b(6) || b(7); c.start = b(9);
      }
    }
    this.cur = c;
  }
  held(a) { return !!this.cur[a]; }
  pressed(a) { return !!this.cur[a] && !this.prev[a]; }
  get mx() { return (this.cur.right ? 1 : 0) - (this.cur.left ? 1 : 0); }
  get my() { return (this.cur.down ? 1 : 0) - (this.cur.up ? 1 : 0); }
}

const DEVICES = [
  new Device('kb1', 'kb', KEYMAPS.kb1),
  new Device('kb2', 'kb', KEYMAPS.kb2),
  new Device('pad0', 'pad', null, 0),
  new Device('pad1', 'pad', null, 1),
  new Device('pad2', 'pad', null, 2),
  new Device('pad3', 'pad', null, 3),
];

function pollInput() {
  for (const d of DEVICES) d.poll();
  sysTaps.clear();
  for (const k of keysTapped) sysTaps.add(k);
  keysTapped.clear();
}
const tapped = (code) => sysTaps.has(code);
const anyPressed = (...acts) => DEVICES.some((d) => acts.some((a) => d.pressed(a)));

// ---------- audio (all procedural) ----------
const SONGS = {
  title: {
    bpm: 112, root: 48, wave: 'square',
    bass: [0, null, 12, null, 7, null, 12, null, 5, null, 17, null, 7, null, 19, null],
    lead: [12, null, 16, 19, null, 16, 24, null, 21, null, 19, 17, null, 16, 14, null,
      12, null, 16, 19, null, 24, 23, null, 21, 19, 17, null, 14, null, 12, null],
    drum: 'k.h.s.h.k.khs.h.',
  },
  story: {
    bpm: 92, root: 53, wave: 'triangle',
    bass: [0, null, null, null, 7, null, null, null, 5, null, null, null, 7, null, null, null],
    lead: [12, null, 14, null, 16, null, 19, null, 17, null, 16, null, 14, null, null, null,
      12, null, 14, null, 16, null, 21, null, 19, null, 16, null, 12, null, null, null],
    drum: 'k.......k.......',
  },
  adventure: {
    bpm: 136, root: 50, wave: 'square',
    bass: [0, 0, 12, 0, 0, 0, 12, 0, 5, 5, 17, 5, 7, 7, 19, 7],
    lead: [12, null, 15, 17, null, 19, null, 17, 15, null, 12, null, 10, 12, null, null,
      12, null, 15, 17, null, 19, 22, null, 24, null, 22, 19, 17, null, 15, null],
    drum: 'k.h.s.hkk.h.s.hh',
  },
  sky: {
    bpm: 126, root: 53, wave: 'square',
    bass: [0, null, 7, null, 12, null, 7, null, 9, null, 4, null, 5, null, 7, null],
    lead: [16, null, 19, null, 24, null, 23, 21, 19, null, 16, null, 17, 19, null, null,
      16, null, 19, null, 24, null, 26, 28, 26, null, 24, null, 21, null, 19, null],
    drum: 'k.h.s.h.k.h.s.hs',
  },
  factory: {
    bpm: 142, root: 45, wave: 'sawtooth',
    bass: [0, 0, 12, 0, 3, 3, 15, 3, 5, 5, 17, 5, 3, 3, 15, 3],
    lead: [12, null, null, 15, null, null, 17, null, 15, null, 12, null, 10, null, 12, null,
      12, null, null, 15, null, null, 19, null, 17, null, 15, null, 14, null, 15, null],
    drum: 'kkh.s.hkk.h.s.hs',
  },
  boss: {
    bpm: 152, root: 43, wave: 'sawtooth',
    bass: [0, 12, 0, 12, 1, 13, 1, 13, 0, 12, 0, 12, 6, 18, 5, 17],
    lead: [24, null, 24, null, 22, null, 24, null, 25, null, 24, null, 22, 20, 19, null],
    drum: 'k.hsk.hsk.hsk.ss',
  },
  ending: {
    bpm: 104, root: 48, wave: 'triangle',
    bass: [0, null, 7, null, 9, null, 7, null, 5, null, 0, null, 7, null, 7, null],
    lead: [16, null, 19, null, 24, null, 19, null, 21, null, 24, null, 23, null, 19, null,
      16, null, 19, null, 24, null, 26, null, 28, null, 26, null, 24, null, null, null],
    drum: 'k...s...k.k.s...',
  },
};

const Snd = {
  ac: null, master: null, sfx: null, mus: null, noiseBuf: null,
  muted: false, song: null, songName: null, step: 0, nextT: 0,
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ac = new AC(); } catch (e) { return; }
    const ac = this.ac;
    this.master = ac.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(ac.destination);
    this.sfx = ac.createGain(); this.sfx.gain.value = 0.5; this.sfx.connect(this.master);
    this.mus = ac.createGain(); this.mus.gain.value = 0.2; this.mus.connect(this.master);
    const len = ac.sampleRate;
    this.noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    setInterval(() => this.tick(), 25);
    if (this.songName) this.music(this.songName, true);
  },
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.8;
  },
  tone(f, dur, type = 'square', vol = 0.2, f2 = null, delay = 0, bus = null) {
    const ac = this.ac; if (!ac) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfx);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.3, freq = 2000, type = 'lowpass', delay = 0, f2 = null, bus = null) {
    const ac = this.ac; if (!ac) return;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = ac.createBiquadFilter(); fl.type = type;
    fl.frequency.setValueAtTime(freq, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(bus || this.sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  play(n) {
    if (!this.ac) return;
    switch (n) {
      case 'swing': this.noise(0.12, 0.22, 1200, 'bandpass', 0, 4000); break;
      case 'hit': this.noise(0.1, 0.5, 3000, 'lowpass', 0, 400); this.tone(170, 0.12, 'sine', 0.5, 60); break;
      case 'bighit': this.noise(0.25, 0.7, 2500, 'lowpass', 0, 200); this.tone(120, 0.25, 'sine', 0.7, 40); break;
      case 'block': this.tone(900, 0.08, 'square', 0.12, 1400); this.tone(1400, 0.1, 'triangle', 0.12, null, 0.03); break;
      case 'jump': this.tone(260, 0.15, 'square', 0.1, 520); break;
      case 'land': this.noise(0.08, 0.2, 600); break;
      case 'coin': this.tone(988, 0.07, 'square', 0.1); this.tone(1319, 0.14, 'square', 0.1, null, 0.06); break;
      case 'heal': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.18, null, i * 0.05)); break;
      case 'magic': this.tone(400, 0.3, 'sawtooth', 0.1, 1600); this.tone(800, 0.3, 'sine', 0.15, 2400); break;
      case 'hurt': this.tone(300, 0.2, 'square', 0.16, 110); break;
      case 'die': this.tone(400, 0.6, 'square', 0.18, 60); break;
      case 'break': this.noise(0.2, 0.5, 1800, 'lowpass', 0, 300); this.tone(200, 0.1, 'square', 0.1, 90); break;
      case 'lvlup': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.18, 'square', 0.12, null, i * 0.07)); break;
      case 'throw': this.noise(0.15, 0.2, 800, 'bandpass', 0, 2500); break;
      case 'splash': this.noise(0.25, 0.35, 900, 'lowpass', 0, 200); break;
      case 'boom': this.noise(0.6, 0.8, 1200, 'lowpass', 0, 60); this.tone(90, 0.5, 'sine', 0.7, 30); break;
      case 'roar': this.tone(110, 0.7, 'sawtooth', 0.22, 70); this.noise(0.7, 0.3, 500, 'lowpass'); break;
      case 'laser': this.tone(1200, 0.6, 'sawtooth', 0.1, 300); this.noise(0.6, 0.15, 3000, 'bandpass'); break;
      case 'charge': this.tone(200, 0.6, 'sine', 0.15, 900); break;
      case 'talk': this.tone(rand(480, 720), 0.035, 'square', 0.04); break;
      case 'select': this.tone(660, 0.08, 'square', 0.1); this.tone(990, 0.1, 'square', 0.1, null, 0.05); break;
      case 'pen': [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.18, null, i * 0.09)); break;
      case 'crash': this.noise(0.5, 0.6, 4000, 'highpass', 0, 800); break;
      case 'squawk': this.tone(1400, 0.12, 'sawtooth', 0.12, 700); this.tone(1500, 0.12, 'sawtooth', 0.12, 800, 0.14); break;
      case 'go': this.tone(880, 0.1, 'square', 0.1); this.tone(880, 0.1, 'square', 0.1, null, 0.15); break;
      case 'poof': this.noise(0.3, 0.3, 3000, 'bandpass', 0, 600); this.tone(600, 0.25, 'sine', 0.15, 1800); break;
      case 'powerdown': this.tone(600, 1.6, 'sawtooth', 0.15, 40); break;
    }
  },
  music(name, force = false) {
    if (!force && name === this.songName) return;
    this.songName = name;
    this.song = SONGS[name] || null;
    this.step = 0;
    if (this.ac) this.nextT = this.ac.currentTime + 0.08;
  },
  tick() {
    if (!this.song || !this.ac) return;
    const ac = this.ac, s = this.song, sd = 60 / s.bpm / 4;
    if (this.nextT < ac.currentTime - 0.2) this.nextT = ac.currentTime + 0.02;
    while (this.nextT < ac.currentTime + 0.12) {
      const d = this.nextT - ac.currentTime, i = this.step;
      const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
      const b = s.bass[i % s.bass.length];
      if (b != null) this.tone(mf(s.root + b), sd * 1.8, 'triangle', 0.32, null, d, this.mus);
      const l = s.lead[i % s.lead.length];
      if (l != null) this.tone(mf(s.root + 12 + l), sd * 1.6, s.wave, s.wave === 'triangle' ? 0.16 : 0.07, null, d, this.mus);
      const dr = s.drum[i % s.drum.length];
      if (dr === 'k') this.tone(150, 0.12, 'sine', 0.55, 40, d, this.mus);
      else if (dr === 's') this.noise(0.1, 0.22, 1800, 'bandpass', d, null, this.mus);
      else if (dr === 'h') this.noise(0.03, 0.08, 7000, 'highpass', d, null, this.mus);
      this.step++;
      this.nextT += sd;
    }
  },
};

// ---------- particles ----------
const PARTS = [];
function part(o) {
  const p = Object.assign({
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0.3, life: 30, size: 4, color: '#fff',
    kind: 'puff', rot: 0, vr: 0, drag: 0.96, bounce: true,
  }, o);
  p.max = p.life;
  PARTS.push(p);
  return p;
}
const FX = {
  sparks(x, y, z, n = 8, color = '#fff') {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(3, 8);
      part({ kind: 'spark', x, y, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, g: 0.2, life: randi(8, 16), color, size: rand(2, 4), bounce: false });
    }
  },
  puff(x, y, z, n = 6, color = 'rgba(255,255,255,0.8)', spread = 2) {
    for (let i = 0; i < n; i++) {
      part({ kind: 'puff', x: x + rand(-8, 8), y: y + rand(-4, 4), z: z + rand(0, 10), vx: rand(-spread, spread), vy: rand(-0.5, 0.5), vz: rand(0.2, 1.5), g: 0.02, life: randi(20, 36), size: rand(6, 12), color });
    }
  },
  stars(x, y, z, n = 6, color = '#ffe066') {
    for (let i = 0; i < n; i++) {
      part({ kind: 'star', x, y, z, vx: rand(-4, 4), vy: rand(-1, 1), vz: rand(2, 7), g: 0.25, life: randi(24, 40), size: rand(5, 9), color, vr: rand(-0.3, 0.3) });
    }
  },
  chunks(x, y, z, n = 8, color = '#a0703c') {
    for (let i = 0; i < n; i++) {
      part({ kind: 'chunk', x, y, z: z + rand(0, 20), vx: rand(-5, 5), vy: rand(-1.5, 1.5), vz: rand(3, 9), g: 0.45, life: randi(40, 70), size: rand(5, 10), color, vr: rand(-0.4, 0.4), drag: 0.98 });
    }
  },
  drops(x, y, z, n = 8, color = '#ff8c1a') {
    for (let i = 0; i < n; i++) {
      part({ kind: 'drop', x, y, z, vx: rand(-3.5, 3.5), vy: rand(-1, 1), vz: rand(2, 7), g: 0.35, life: randi(25, 45), size: rand(3, 6), color });
    }
  },
  ring(x, y, z, color = '#fff', r = 40) {
    part({ kind: 'ring', x, y, z, g: 0, life: 18, size: r, color, bounce: false });
  },
  text(x, y, z, str, color = '#fff', size = 22, life = 40) {
    part({ kind: 'text', x, y, z, vz: 1.6, g: 0.04, life, size, color, text: str, bounce: false, drag: 1 });
  },
};

function updateParts() {
  for (let i = PARTS.length - 1; i >= 0; i--) {
    const p = PARTS[i];
    p.life--;
    p.x += p.vx; p.y += p.vy; p.z += p.vz;
    p.vz -= p.g;
    p.vx *= p.drag; p.vy *= p.drag;
    p.rot += p.vr;
    if (p.bounce && p.z < 0) { p.z = 0; p.vz *= -0.35; p.vx *= 0.6; p.vr *= 0.5; }
    if (p.life <= 0) PARTS.splice(i, 1);
  }
}

function drawParts(c, camX) {
  for (const p of PARTS) {
    const sx = p.x - camX, sy = p.y - p.z;
    const k = p.life / p.max;
    c.save();
    switch (p.kind) {
      case 'spark':
        c.strokeStyle = p.color; c.lineWidth = p.size; c.lineCap = 'round';
        c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - p.vx * 2.2, sy + p.vz * 2.2); c.stroke();
        break;
      case 'puff':
        c.globalAlpha = k * 0.9; c.fillStyle = p.color;
        c.beginPath(); c.arc(sx, sy, p.size * (1.6 - k * 0.6), 0, TAU); c.fill();
        break;
      case 'star':
        c.globalAlpha = Math.min(1, k * 2); c.translate(sx, sy); c.rotate(p.rot);
        starShape(c, 0, 0, p.size, p.size * 0.45, 4, p.color);
        break;
      case 'chunk':
        c.globalAlpha = Math.min(1, k * 3); c.translate(sx, sy); c.rotate(p.rot);
        c.fillStyle = p.color; c.strokeStyle = '#1d1226'; c.lineWidth = 2;
        c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        c.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        break;
      case 'drop':
        c.globalAlpha = Math.min(1, k * 2); c.fillStyle = p.color;
        c.beginPath(); c.arc(sx, sy, p.size, 0, TAU); c.fill();
        break;
      case 'ring':
        c.globalAlpha = k; c.strokeStyle = p.color; c.lineWidth = 6 * k + 1;
        c.beginPath(); c.ellipse(sx, sy, p.size * (1.4 - k), p.size * (1.4 - k) * 0.4, 0, 0, TAU); c.stroke();
        break;
      case 'text':
        c.globalAlpha = Math.min(1, k * 2.5);
        txt(c, p.text, sx, sy, p.size * (k > 0.85 ? 1 + (k - 0.85) * 3 : 1), p.color);
        break;
    }
    c.restore();
  }
}
