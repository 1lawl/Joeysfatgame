'use strict';
// ============================================================
//  Procedural art: drawing helpers + every character sprite
// ============================================================

const OUT = '#1d1226';
const CHAR_SCALE = 1.3; // knights & goons are drawn at this scale

function shade(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (a > 0) { r += (255 - r) * a; g += (255 - g) * a; b += (255 - b) * a; }
  else { r *= 1 + a; g *= 1 + a; b *= 1 + a; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function stroke(c, lw) { if (lw) { c.lineWidth = lw; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke(); } }
function fill(c, f) { if (f) { c.fillStyle = f; c.fill(); } }
function circ(c, x, y, r, f, lw = 3) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); fill(c, f); stroke(c, lw); }
function ell(c, x, y, rx, ry, f, lw = 3, rot = 0) {
  c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); fill(c, f); stroke(c, lw);
}
function rr(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function rrect(c, x, y, w, h, r, f, lw = 3) { rr(c, x, y, w, h, r); fill(c, f); stroke(c, lw); }
function poly(c, pts, f, lw = 3) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath(); fill(c, f); stroke(c, lw);
}
function limb(c, x1, y1, x2, y2, col, w = 7) {
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
  c.strokeStyle = OUT; c.lineWidth = w + 5; c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.stroke();
}
function line(c, x1, y1, x2, y2, col = OUT, w = 3) {
  c.lineCap = 'round'; c.strokeStyle = col; c.lineWidth = w;
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}
function starShape(c, x, y, r1, r2, n, f, lw = 2) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU - Math.PI / 2, r = i % 2 ? r2 : r1;
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath(); fill(c, f); stroke(c, lw);
}
function txt(c, s, x, y, size, f = '#fff', align = 'center', lw = null, strokeCol = OUT) {
  c.font = `${size}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = lw ?? Math.max(3, size * 0.22); c.strokeStyle = strokeCol;
  c.strokeText(s, x, y);
  c.fillStyle = f; c.fillText(s, x, y);
}
function wrapText(c, s, maxW, size) {
  c.font = `${size}px ${FONT}`;
  const words = s.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawShadow(c, sx, sy, w, z) {
  const k = clamp(1 - z / 260, 0.25, 1);
  c.fillStyle = `rgba(20,8,30,${0.28 * k})`;
  c.beginPath(); c.ellipse(sx, sy, w * k, w * 0.32 * k, 0, 0, TAU); c.fill();
}
function withFlash(c, on, fn) {
  if (on) { c.save(); c.filter = 'brightness(2.6) saturate(0.3)'; fn(); c.restore(); } else fn();
}

// ============================================================
//  Knights (players)
// ============================================================
const KNIGHTS = [
  { name: 'Red Knight', color: '#e23b3b', dark: '#a0202c', magic: '#ff9a3d', magic2: '#ffe066' },
  { name: 'Blue Knight', color: '#3b7be2', dark: '#1f4a9c', magic: '#7fd8ff', magic2: '#e0f7ff' },
  { name: 'Green Knight', color: '#3fbf4a', dark: '#23802c', magic: '#c8ff6a', magic2: '#f4ffd0' },
  { name: 'Orange Knight', color: '#f39a2b', dark: '#b3631a', magic: '#ffd23f', magic2: '#fff6c8' },
];

function knightPose(p) {
  const st = p.state, t = p.t, a = p.anim;
  const P = { la: 0, lb: 0, tilt: 0, bob: 0, arm: 1.1, sw: -1.15, back: 1.4, shield: false, trail: null, glow: 0, lying: 0, crouch: 0 };
  switch (st) {
    case 'idle': P.bob = Math.sin(a * 0.08) * 1.2; break;
    case 'walk': {
      const s = Math.sin(a * 0.28);
      P.la = s * 0.55; P.lb = -s * 0.55; P.bob = -Math.abs(Math.cos(a * 0.28)) * 2;
      P.arm = 1.0 + s * 0.25; P.back = 1.4 - s * 0.3; break;
    }
    case 'jump': P.la = 0.8; P.lb = -0.5; P.arm = 0.3; P.sw = -0.7; P.back = -0.2; break;
    case 'attack': {
      const k = p.atkName, A = ATK[k], a0 = A.a[0], a1 = A.a[1];
      const pr = t < a0 ? 0 : t > a1 ? 1 : (t - a0) / (a1 - a0);
      let from = -2.3, to = 0.9;
      if (k === 'l2') { from = 1.3; to = -1.5; }
      if (k === 'l3') { from = -3.0; to = 1.3; P.tilt = t < a0 ? -0.15 : 0.2; P.crouch = t >= a0 ? 4 : 0; }
      P.sw = t < a0 ? lerp(-1.1, from, t / a0) : lerp(from, to, easeOut(pr));
      P.arm = P.sw * 0.75 + 0.15;
      if (t >= a0 && t <= a1 + 2) P.trail = [from, P.sw];
      P.la = 0.35; P.lb = -0.35;
      break;
    }
    case 'heavy': {
      const A = ATK.heavy, a0 = A.a[0], a1 = A.a[1];
      const pr = t < a0 ? 0 : t > a1 ? 1 : (t - a0) / (a1 - a0);
      P.sw = t < a0 ? lerp(-1.1, 2.5, t / a0) : lerp(2.5, -1.7, easeOut(pr));
      P.arm = t < a0 ? 1.6 : lerp(1.6, -1.4, easeOut(pr));
      P.crouch = t < a0 ? 7 : 0; P.tilt = t < a0 ? 0.15 : -0.1;
      if (t >= a0 && t <= a1 + 2) P.trail = [2.5, P.sw];
      P.la = 0.4; P.lb = -0.4;
      break;
    }
    case 'airatk': {
      const A = ATK.air, a0 = A.a[0], a1 = A.a[1];
      const pr = t < a0 ? 0 : t > a1 ? 1 : (t - a0) / (a1 - a0);
      P.sw = lerp(-1.8, 1.7, easeOut(pr)); P.arm = P.sw * 0.7 + 0.2;
      if (t >= a0 && t <= a1 + 1) P.trail = [-1.8, P.sw];
      P.la = 0.9; P.lb = 0.4;
      break;
    }
    case 'slam': P.sw = 1.55; P.arm = 1.1; P.la = 0.9; P.lb = 0.9; P.tilt = 0.15; break;
    case 'slamland': P.sw = 1.3; P.arm = 1.0; P.crouch = 8; P.la = 0.6; P.lb = -0.6; break;
    case 'magic':
      P.arm = t < 8 ? -2.2 : -0.15; P.sw = t < 8 ? -2.4 : -0.25; P.glow = t >= 6 && t < 22 ? 1 : 0;
      P.tilt = t < 8 ? -0.1 : 0.1; P.la = 0.3; P.lb = -0.3;
      break;
    case 'block': P.shield = true; P.back = 0; P.arm = 1.4; P.sw = -1.5; P.crouch = 3; P.la = 0.3; P.lb = -0.3; break;
    case 'hurt': P.tilt = -0.3; P.arm = -0.6; P.sw = -2.2; P.back = -2.2; P.la = -0.3; P.lb = 0.3; break;
    case 'launched': P.lying = clamp(0.4 + p.t / 25, 0.4, 1); P.arm = -0.8; P.sw = -2; P.back = -2.4; P.la = 0.5; break;
    case 'down': case 'dead': P.lying = 1; P.arm = -2.6; P.sw = -2.8; break;
    case 'getup': P.lying = clamp(1 - t / 14, 0, 1); break;
    case 'scene': P.bob = Math.sin(a * 0.08) * 1.2; break;
    case 'scenewalk': {
      const s = Math.sin(a * 0.28);
      P.la = s * 0.55; P.lb = -s * 0.55; P.bob = -Math.abs(Math.cos(a * 0.28)) * 2; P.arm = 1.0 + s * 0.25;
      break;
    }
    case 'cheer': P.arm = -1.6 + Math.sin(a * 0.3) * 0.3; P.sw = -1.6; P.back = -1.8; P.bob = -Math.abs(Math.sin(a * 0.15)) * 8; break;
  }
  return P;
}

function drawSword(c, hx, hy, ang) {
  const cs = Math.cos(ang), sn = Math.sin(ang);
  limb(c, hx - cs * 8, hy - sn * 8, hx + cs * 3, hy + sn * 3, '#6b4423', 3);
  const gx = hx + cs * 5, gy = hy + sn * 5;
  limb(c, gx + sn * 8, gy - cs * 8, gx - sn * 8, gy + cs * 8, '#e7bd4a', 3);
  const L = 42, bw = 4;
  const tx = gx + cs * L, ty = gy + sn * L;
  poly(c, [
    [gx + sn * bw, gy - cs * bw], [gx + cs * (L - 9) + sn * bw, gy + sn * (L - 9) - cs * bw], [tx, ty],
    [gx + cs * (L - 9) - sn * bw, gy + sn * (L - 9) + cs * bw], [gx - sn * bw, gy + cs * bw],
  ], '#eef1f7', 2.5);
  line(c, gx + cs * 4, gy + sn * 4, gx + cs * (L - 10), gy + sn * (L - 10), '#b9c0cf', 1.5);
}

function drawKnightHead(c, x, y, k, r = 17) {
  circ(c, x, y, r, '#d6dae4');
  // crest
  ell(c, x - r * 0.15, y - r * 1.02, r * 0.55, r * 0.28, k.color, 2.5);
  // visor (T slit)
  c.fillStyle = OUT;
  rr(c, x + r * 0.05, y - r * 0.32, r * 0.95, r * 0.26, r * 0.1); c.fill();
  rr(c, x + r * 0.4, y - r * 0.32, r * 0.26, r * 0.95, r * 0.1); c.fill();
  // shine
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.beginPath(); c.ellipse(x - r * 0.45, y - r * 0.45, r * 0.22, r * 0.14, -0.6, 0, TAU); c.fill();
}

function drawKnight(c, p, sx, sy, alpha = 1) {
  const k = KNIGHTS[p.idx], P = knightPose(p);
  c.save();
  c.globalAlpha = alpha;
  c.translate(sx, sy);
  c.scale(p.facing * CHAR_SCALE, CHAR_SCALE);
  c.translate(0, P.bob - 12 * P.lying);
  c.rotate(P.tilt - P.lying * 1.5);
  const cr = P.crouch;
  const hipY = -20 + cr;
  const leg = (ox, ang) => {
    const L = 20 - cr * 0.5;
    const fx = ox + Math.sin(ang) * L, fy = hipY + Math.cos(ang) * L;
    limb(c, ox, hipY, fx, fy - 2, '#3b3448', 7);
    ell(c, fx + 3, fy, 7, 4.5, '#2a2333', 2.5);
  };
  // back arm & small shield
  const shY = -42 + cr;
  const bh = [-5 + Math.cos(P.back) * 15, shY + Math.sin(P.back) * 15];
  if (!P.shield) {
    limb(c, -5, shY, bh[0], bh[1], k.dark, 6);
    ell(c, bh[0] - 3, bh[1], 7, 11, k.color, 2.5);
    circ(c, bh[0] - 3, bh[1], 3, '#e7bd4a', 1.5);
  }
  leg(-5, P.lb);
  leg(5, P.la);
  // body
  rrect(c, -13, -48 + cr, 26, 30, 9, k.color);
  c.fillStyle = shade(k.color, -0.25); c.fillRect(-11.5, -30 + cr, 23, 4);
  c.fillStyle = '#5a3a22'; c.fillRect(-11.5, -26 + cr, 23, 4);
  circ(c, 3, -24 + cr, 2.5, '#e7bd4a', 1.5);
  // head
  drawKnightHead(c, 2, -64 + cr, k);
  // front arm & sword
  const sh = [4, shY];
  const hand = [sh[0] + Math.cos(P.arm) * 15, sh[1] + Math.sin(P.arm) * 15];
  if (P.trail) {
    c.save();
    const a1 = Math.min(P.trail[0], P.trail[1]), a2 = Math.max(P.trail[0], P.trail[1]);
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 16; c.lineCap = 'round';
    c.beginPath(); c.arc(sh[0], sh[1], 46, a1, a2); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 5;
    c.beginPath(); c.arc(sh[0], sh[1], 54, a1, a2); c.stroke();
    c.restore();
  }
  drawSword(c, hand[0], hand[1], P.sw);
  limb(c, sh[0], sh[1], hand[0], hand[1], k.dark, 6);
  circ(c, hand[0], hand[1], 4.5, '#c2c7d3', 2.5);
  if (P.glow) {
    const gx = hand[0] + Math.cos(P.sw) * 40, gy = hand[1] + Math.sin(P.sw) * 40;
    c.fillStyle = k.magic; c.globalAlpha = alpha * 0.5;
    c.beginPath(); c.arc(gx, gy, 16 + Math.sin(p.t) * 3, 0, TAU); c.fill();
    c.globalAlpha = alpha;
    starShape(c, gx, gy, 10, 4, 4, k.magic2, 2);
  }
  if (P.shield) {
    limb(c, -5, shY, 12, shY + 2, k.dark, 6);
    ell(c, 15, -38 + cr, 9, 17, k.color, 3);
    ell(c, 15, -38 + cr, 5, 11, shade(k.color, 0.25), 2);
    circ(c, 15, -38 + cr, 3, '#e7bd4a', 1.5);
  }
  c.restore();
}

// ============================================================
//  Goons (regular enemies), per-world skins
// ============================================================
const SKINS = {
  goblin: { name: 'Insurance Goblin', skin: '#86c35a', body: '#f2f2f2', pants: '#3d4660', acc: '#d33b3b', hat: 'ears', weapon: 'clipboard', lob: 'pills' },
  ginger: { name: 'Gingerbread Goon', skin: '#c47a3c', body: '#c47a3c', pants: '#b06a30', acc: '#ff5d8f', hat: 'icing', weapon: 'cane', lob: 'gumdrop' },
  pirate: { name: 'Gravy Pirate', skin: '#f0c39a', body: '#ffffff', pants: '#5b3b26', acc: '#d33b3b', hat: 'bandana', weapon: 'ladle', lob: 'gravyboat', stripes: '#2f5fb3' },
  cherub: { name: 'Cream Cherub', skin: '#ffd9c7', body: '#fff8ef', pants: '#f3e6d8', acc: '#ffd23f', hat: 'halo', weapon: 'whisk', lob: 'creampuff', wings: true },
  trooper: { name: 'Krome Trooper', skin: '#c9c3d9', body: '#5b2a86', pants: '#2d1846', acc: '#ff8c1a', hat: 'goggles', weapon: 'prod', lob: 'vial' },
  human: { name: 'Pharmacist', skin: '#f0c39a', body: '#ffffff', pants: '#3d4660', acc: '#4aa3ff', hat: 'glasses', weapon: null },
};

function goonPose(e) {
  const P = { la: 0, lb: 0, tilt: 0, bob: 0, arm: 1.2, back: 1.7, lying: 0, raise: false };
  const t = e.t, a = e.anim;
  switch (e.state) {
    case 'walk': case 'enter': case 'scenewalk': {
      const s = Math.sin(a * 0.3);
      P.la = s * 0.55; P.lb = -s * 0.55; P.bob = -Math.abs(Math.cos(a * 0.3)) * 2; P.arm = 1.1 + s * 0.3; P.back = 1.7 - s * 0.3;
      break;
    }
    case 'idle': case 'scene': P.bob = Math.sin(a * 0.09) * 1.2; break;
    case 'windup': P.arm = -2.3; P.tilt = -0.15; P.raise = true; P.la = 0.3; P.lb = -0.3; P.bob = Math.sin(t * 1.3) * 1; break;
    case 'strike': P.arm = 0.15; P.tilt = 0.18; P.la = 0.4; P.lb = -0.4; break;
    case 'recover': P.arm = 0.7; P.tilt = 0.05; break;
    case 'hurt': P.tilt = -0.32; P.arm = -0.6; P.back = -2.2; P.la = -0.3; P.lb = 0.3; break;
    case 'launched': P.lying = clamp(0.4 + t / 25, 0.4, 1); P.arm = -0.8; P.back = -2.2; break;
    case 'down': case 'dying': P.lying = 1; P.arm = -2.6; break;
    case 'getup': P.lying = clamp(1 - t / 16, 0, 1); break;
  }
  return P;
}

function drawWeapon(c, kind, hx, hy, ang) {
  const cs = Math.cos(ang), sn = Math.sin(ang);
  switch (kind) {
    case 'clipboard':
      c.save(); c.translate(hx, hy); c.rotate(ang + 0.3);
      rrect(c, 2, -12, 18, 24, 2, '#a0703c', 2.5);
      c.fillStyle = '#fff'; c.fillRect(5, -9, 12, 18);
      c.fillStyle = '#d33b3b'; c.font = `7px ${FONT}`; c.textAlign = 'center'; c.fillText('NO', 11, 0);
      rrect(c, 7, -14, 8, 4, 1, '#bbb', 1.5);
      c.restore();
      break;
    case 'cane': {
      const L = 34, tx = hx + cs * L, ty = hy + sn * L;
      limb(c, hx - cs * 4, hy - sn * 4, tx, ty, '#ffffff', 5);
      for (let i = 0; i < 4; i++) {
        const k = 0.15 + i * 0.22;
        line(c, hx + cs * L * k - sn * 2.5, hy + sn * L * k + cs * 2.5, hx + cs * L * (k + 0.08) + sn * 2.5, hy + sn * L * (k + 0.08) - cs * 2.5, '#e2324a', 3);
      }
      c.beginPath(); c.arc(tx - sn * 7, ty + cs * 7, 7, ang - Math.PI / 2, ang + Math.PI / 2, true);
      c.strokeStyle = OUT; c.lineWidth = 10; c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 5; c.stroke();
      break;
    }
    case 'ladle': {
      const L = 32, tx = hx + cs * L, ty = hy + sn * L;
      limb(c, hx - cs * 4, hy - sn * 4, tx, ty, '#8a8f9c', 3);
      ell(c, tx + cs * 7, ty + sn * 7, 10, 7, '#aab0bd', 2.5, ang);
      ell(c, tx + cs * 7, ty + sn * 7 - 1, 6, 3.5, '#8b5a2b', 0, ang);
      break;
    }
    case 'whisk': {
      const L = 16, tx = hx + cs * L, ty = hy + sn * L;
      limb(c, hx - cs * 4, hy - sn * 4, tx, ty, '#ffd23f', 4);
      c.save(); c.translate(tx, ty); c.rotate(ang);
      for (let i = -1; i <= 1; i++) { ell(c, 13, 0, 13, 4 + Math.abs(i) * 3, null, 2); }
      c.restore();
      break;
    }
    case 'prod': {
      const L = 36, tx = hx + cs * L, ty = hy + sn * L;
      limb(c, hx - cs * 6, hy - sn * 6, tx, ty, '#3a3a4a', 4);
      c.fillStyle = 'rgba(255,140,26,0.45)'; c.beginPath(); c.arc(tx, ty, 9, 0, TAU); c.fill();
      circ(c, tx, ty, 4.5, '#ff8c1a', 2);
      break;
    }
  }
}

function drawLobItem(c, kind, x, y, rot = 0, s = 1) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  switch (kind) {
    case 'pills':
      rrect(c, -6, -8, 12, 16, 3, '#ff9a3d', 2.5); rrect(c, -7, -12, 14, 5, 2, '#fff', 2.5);
      c.fillStyle = '#fff'; c.fillRect(-4, -3, 8, 6); break;
    case 'gumdrop':
      c.beginPath(); c.moveTo(-9, 6); c.quadraticCurveTo(-9, -10, 0, -10); c.quadraticCurveTo(9, -10, 9, 6); c.closePath();
      fill(c, choiceFixed(['#ff5d8f', '#5fd068', '#ffd23f', '#5fb8ff'], x)); stroke(c, 2.5);
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(-4, -4, 2, 2); c.fillRect(2, -1, 2, 2); break;
    case 'gravyboat':
      c.beginPath(); c.moveTo(-12, -2); c.quadraticCurveTo(0, 10, 12, -2); c.lineTo(16, -6); c.lineTo(-12, -4); c.closePath();
      fill(c, '#fff'); stroke(c, 2.5); ell(c, 0, -4, 10, 3, '#8b5a2b', 1.5); break;
    case 'creampuff':
      circ(c, -4, 0, 7, '#fff4e0', 2.5); circ(c, 4, -2, 7, '#fff4e0', 2.5); circ(c, 0, -6, 6, '#fff4e0', 2.5); circ(c, 1, -11, 3, '#e2324a', 2); break;
    case 'vial':
      rrect(c, -5, -11, 10, 22, 4, 'rgba(220,240,255,0.8)', 2.5); rrect(c, -4, -2, 8, 12, 3, '#ff8c1a', 0);
      rrect(c, -6, -14, 12, 5, 2, '#5b2a86', 2); break;
    case 'paper':
      rrect(c, -10, -7, 20, 14, 1, '#fff', 2);
      c.fillStyle = '#d33b3b'; c.font = `8px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('DENIED', 0, 1); break;
    case 'pudding':
      c.beginPath(); c.moveTo(-10, 8); c.lineTo(-8, -6); c.quadraticCurveTo(0, -12, 8, -6); c.lineTo(10, 8); c.closePath();
      fill(c, '#7a4a25'); stroke(c, 2.5); ell(c, 0, -8, 6, 3, '#fff8ef', 1.5); circ(c, 0, -12, 3, '#e2324a', 1.5); break;
  }
  c.restore();
}
function choiceFixed(arr, seed) { return arr[Math.floor(hash(Math.floor(seed * 13) | 0) * arr.length)]; }

function drawGoonHead(c, x, y, sk, r = 15, mood = 'mean') {
  if (sk.wings) { /* drawn with body */ }
  if (sk.hat === 'ears') {
    poly(c, [[x - r * 0.7, y - r * 0.2], [x - r * 1.8, y - r * 0.9], [x - r * 0.6, y + r * 0.4]], sk.skin, 2.5);
  }
  circ(c, x, y, r, sk.skin);
  if (sk.hat === 'icing') {
    c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath();
    for (let i = 0; i <= 10; i++) { const a = Math.PI + (i / 10) * Math.PI; const rr2 = r - 3 + (i % 2) * 2; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
    c.stroke();
  }
  if (sk.hat === 'halo') {
    c.save(); c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.ellipse(x, y - r - 7, r * 0.8, 4, 0, 0, TAU); c.stroke();
    c.strokeStyle = '#ffd23f'; c.lineWidth = 3; c.stroke(); c.restore();
    for (let i = 0; i < 3; i++) circ(c, x - r * 0.5 + i * r * 0.4, y - r * 0.85, 4, '#ffe6a8', 2);
  }
  // eyes
  const ey = y - r * 0.15;
  if (sk.hat === 'goggles') {
    limb(c, x - r, ey, x + r, ey, '#2d1846', 4);
    circ(c, x + r * 0.15, ey, 6, '#ff8c1a', 2.5); circ(c, x + r * 0.7, ey, 5, '#ff8c1a', 2.5);
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(x + r * 0.05, ey - 3, 2, 2); c.fillRect(x + r * 0.6, ey - 3, 2, 2);
  } else {
    ell(c, x + r * 0.15, ey, 4, 5, '#fff', 2); ell(c, x + r * 0.68, ey, 3.5, 4.5, '#fff', 2);
    c.fillStyle = OUT; c.beginPath(); c.arc(x + r * 0.25, ey + 1, 2, 0, TAU); c.arc(x + r * 0.76, ey + 1, 1.8, 0, TAU); c.fill();
    if (mood === 'mean') { line(c, x - r * 0.1, ey - 7, x + r * 0.4, ey - 4, OUT, 2.5); line(c, x + r * 0.55, ey - 4, x + r * 0.95, ey - 7, OUT, 2.5); }
    if (sk.hat === 'glasses') {
      c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.arc(x + r * 0.2, ey, 6, 0, TAU); c.moveTo(x + r * 0.7 + 5.5, ey); c.arc(x + r * 0.7, ey, 5.5, 0, TAU); c.stroke();
    }
  }
  if (sk.hat === 'ears') poly(c, [[x + r * 0.45, y + r * 0.05], [x + r * 1.45, y + r * 0.3], [x + r * 0.45, y + r * 0.45]], shade(sk.skin, -0.1), 2.5);
  // mouth
  if (mood === 'mean') {
    c.beginPath(); c.moveTo(x + r * 0.05, y + r * 0.55); c.lineTo(x + r * 0.85, y + r * 0.45); c.lineTo(x + r * 0.6, y + r * 0.7); c.closePath();
    fill(c, '#fff'); stroke(c, 2);
  } else {
    c.beginPath(); c.arc(x + r * 0.45, y + r * 0.35, r * 0.3, 0.2, Math.PI - 0.2); stroke(c, 2.5);
  }
  if (sk.hat === 'bandana') {
    c.beginPath(); c.arc(x, y, r, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); fill(c, sk.acc); stroke(c, 2.5);
    poly(c, [[x - r * 0.9, y - r * 0.4], [x - r * 1.6, y - r * 0.6], [x - r * 1.5, y - r * 0.05]], sk.acc, 2);
    c.fillStyle = '#fff'; [[-0.3, -0.7], [0.3, -0.75], [0, -0.55]].forEach(([dx, dy]) => { c.beginPath(); c.arc(x + dx * r, y + dy * r, 1.6, 0, TAU); c.fill(); });
    c.fillStyle = 'rgba(60,40,30,0.35)'; c.beginPath(); c.arc(x + r * 0.45, y + r * 0.55, r * 0.5, 0, Math.PI); c.fill();
  }
  if (sk.hat === 'goggles') {
    c.beginPath(); c.arc(x, y - 1, r + 1, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); fill(c, '#5b2a86'); stroke(c, 2.5);
    circ(c, x, y - r - 1, 3, '#ff8c1a', 2);
  }
  if (sk.hat === 'glasses') {
    c.beginPath(); c.arc(x, y, r, Math.PI * 1.0, Math.PI * 1.85); c.lineTo(x - r * 0.3, y - r * 0.4); c.closePath(); fill(c, '#5a3a22'); stroke(c, 2);
  }
  if (sk.hat === 'halo' || sk.wings) {
    c.fillStyle = 'rgba(255,120,140,0.4)'; c.beginPath(); c.arc(x + r * 0.55, y + r * 0.3, 3.5, 0, TAU); c.fill();
  }
}

function drawGoon(c, e, sx, sy) {
  const sk = SKINS[e.skin] || SKINS.goblin, P = goonPose(e), s = (e.scale || 1) * CHAR_SCALE;
  c.save();
  c.translate(sx, sy); c.scale(e.facing * s, s);
  c.translate(0, P.bob - 12 * P.lying);
  c.rotate(P.tilt - P.lying * 1.5);
  const bulk = e.type === 'brute' ? 1.25 : 1;
  const shY = -40;
  // wings
  if (sk.wings) {
    const fl = Math.sin(e.anim * 0.4) * 0.3;
    c.save(); c.translate(-8, -40); c.rotate(-0.5 + fl);
    ell(c, -10, -4, 14, 8, '#ffffff', 2.5); ell(c, -8, 4, 11, 6, '#f6f0ff', 2.5); c.restore();
  }
  // back arm
  const bh = [-5 + Math.cos(P.back) * 14, shY + Math.sin(P.back) * 14];
  limb(c, -5, shY, bh[0], bh[1], sk.skin, 6);
  // legs
  const leg = (ox, ang) => {
    const fx = ox + Math.sin(ang) * 19, fy = -19 + Math.cos(ang) * 19;
    limb(c, ox, -19, fx, fy - 2, sk.pants, 7);
    ell(c, fx + 3, fy, 6.5, 4, e.skin === 'ginger' ? sk.skin : '#2a2333', 2.5);
  };
  leg(-5, P.lb); leg(5, P.la);
  // body
  const bw = 24 * bulk;
  rrect(c, -bw / 2, -46, bw, 28, 9, sk.body);
  if (e.skin === 'goblin') poly(c, [[-1, -45], [3, -45], [4, -30], [1, -26], [-2, -30]], sk.acc, 2);
  if (e.skin === 'pirate') { c.fillStyle = sk.stripes; for (let i = 0; i < 3; i++) c.fillRect(-bw / 2 + 2, -40 + i * 8, bw - 4, 3); }
  if (e.skin === 'ginger') {
    [['#ff5d8f', -38], ['#5fd068', -30]].forEach(([col, yy]) => circ(c, 3, yy, 3.2, col, 2));
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(-bw / 2 + 3, -22); for (let i = 0; i < 6; i++) c.lineTo(-bw / 2 + 3 + i * (bw - 6) / 5, -22 + (i % 2) * 3); c.stroke();
  }
  if (e.skin === 'trooper') { circ(c, 4, -36, 4, sk.acc, 2); c.fillStyle = '#2d1846'; c.fillRect(-bw / 2 + 2, -24, bw - 4, 4); }
  if (e.skin === 'cherub') { c.fillStyle = sk.acc; c.fillRect(-bw / 2 + 2, -26, bw - 4, 3); }
  if (e.skin === 'human') { c.fillStyle = '#4aa3ff'; c.fillRect(-3, -44, 6, 16); c.strokeStyle = OUT; c.lineWidth = 1.5; c.strokeRect(-3, -44, 6, 16); }
  // head
  drawGoonHead(c, 2, -58, sk, 15, e.mood || 'mean');
  // front arm + weapon
  const hand = [4 + Math.cos(P.arm) * 14, shY + Math.sin(P.arm) * 14];
  if (e.type === 'thrower') {
    if (P.raise) drawLobItem(c, sk.lob, hand[0], hand[1] - 6, 0, 1);
  } else if (sk.weapon && e.type !== 'npc') {
    drawWeapon(c, sk.weapon, hand[0], hand[1], P.arm - 1.0 + (e.state === 'strike' ? 1.1 : 0));
  }
  limb(c, 4, shY, hand[0], hand[1], sk.skin, 6);
  circ(c, hand[0], hand[1], 4.2, sk.skin, 2.5);
  c.restore();
}

// ============================================================
//  Bat-tery (flying minion)
// ============================================================
function drawBattery(c, e, sx, sy) {
  const flap = Math.sin(e.anim * 0.55);
  const dive = e.state === 'dive';
  c.save(); c.translate(sx, sy - 26); c.scale(e.facing * CHAR_SCALE, CHAR_SCALE);
  if (e.state === 'launched' || e.state === 'down' || e.state === 'dying') c.rotate(Math.PI / 2 * (e.state === 'launched' ? 0.6 : 1));
  if (dive) c.rotate(0.6);
  // wings
  for (const sd of [-1, 1]) {
    c.save(); c.scale(sd, 1); c.rotate(flap * 0.5 * sd);
    poly(c, [[6, -6], [30, -18 - flap * 6], [26, -6], [32, 2], [20, 0], [14, 8], [6, 4]], '#3d2a5a', 2.5);
    c.restore();
  }
  // body
  rrect(c, -10, -18, 20, 34, 5, '#2d2d3a');
  c.fillStyle = '#ff8c1a'; c.fillRect(-8.5, -4, 17, 18);
  c.strokeStyle = OUT; c.lineWidth = 2; c.strokeRect(-8.5, -4, 17, 18);
  rrect(c, -4, -23, 8, 6, 2, '#c08a3a', 2);
  txt(c, '+', 0, 8, 12, '#fff', 'center', 2);
  // face
  const ey = -11, glow = e.state === 'windup';
  ell(c, -3, ey, 3, 3.5, glow ? '#ff4040' : '#fff', 1.5); ell(c, 5, ey, 3, 3.5, glow ? '#ff4040' : '#fff', 1.5);
  c.fillStyle = OUT; c.fillRect(-3, ey, 1.6, 1.6); c.fillRect(5, ey, 1.6, 1.6);
  line(c, -6, ey - 5, -1, ey - 3, OUT, 2); line(c, 2, ey - 3, 8, ey - 5, OUT, 2);
  poly(c, [[-2, -5], [0, -1], [2, -5]], '#fff', 1);
  c.restore();
}

// ============================================================
//  Joey
// ============================================================
function drawJoey(c, x, y, o = {}) {
  const s = o.scale || 1, t = o.t || 0, mood = o.mood || 'happy';
  const cake = !!o.cake, slim = o.slim || 0;
  const shirt = cake ? '#ff9ecf' : '#ffd23f', skin = cake ? '#fff1d6' : '#f2c29b', shorts = cake ? '#ffd1e8' : '#3d6bd1';
  const bw = lerp(40, 27, slim);
  c.save(); c.translate(x, y); c.scale((o.facing || 1) * s, s);
  const bob = mood === 'cheer' ? -Math.abs(Math.sin(t * 0.15)) * 8 : Math.sin(t * 0.07) * 1.5;
  c.translate(0, bob);
  if (o.sitting) c.translate(0, 12);
  // legs
  if (o.sitting) {
    limb(c, -14, -22, -24, -8, shorts, 12); limb(c, 14, -22, 24, -8, shorts, 12);
    limb(c, -24, -8, -26, 6, skin, 9); limb(c, 24, -8, 26, 6, skin, 9);
  } else {
    const run = o.walking ? Math.sin(t * 0.3) * 0.4 : 0;
    limb(c, -12, -24, -14 + run * 14, -3, skin, 10); limb(c, 12, -24, 14 - run * 14, -3, skin, 10);
    ell(c, -15 + run * 14, -1, 8, 4.5, '#ffffff', 2.5); ell(c, 15 - run * 14, -1, 8, 4.5, '#ffffff', 2.5);
    rrect(c, -bw * 0.62, -36, bw * 1.24, 16, 7, shorts);
  }
  // arms
  const wave = mood === 'cheer' || mood === 'wave' ? -1.2 + Math.sin(t * 0.25) * 0.5 : mood === 'worried' ? -2.4 : 0.9;
  limb(c, -bw * 0.75, -66, -bw * 0.75 - Math.cos(wave) * 16, -66 + Math.sin(wave) * 18, skin, 9);
  limb(c, bw * 0.75, -66, bw * 0.75 + Math.cos(wave) * 16, -66 + Math.sin(wave) * 18 * (mood === 'wave' ? 1 : 1), skin, 9);
  // body
  ell(c, 0, -56, bw, 36, shirt);
  if (!cake) {
    c.save(); c.translate(0, -58); c.scale(o.facing || 1, 1);
    txt(c, slim > 0.5 ? 'I ♥ SALAD' : 'I ♥ SNAX', 0, 0, 11, '#e2324a', 'center', 3, '#fff');
    c.restore();
  } else {
    for (let i = 0; i < 14; i++) { c.fillStyle = ['#5fb8ff', '#5fd068', '#ffd23f', '#e2324a'][i % 4]; c.fillRect(-bw * 0.7 + hash(i) * bw * 1.4, -80 + hash(i + 9) * 46, 4, 2); }
    c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath();
    for (let i = 0; i <= 12; i++) c.lineTo(-bw + i * bw / 6, -48 + (i % 2) * 6); c.stroke();
  }
  // head
  const hy = -98;
  circ(c, 0, hy + 14, 15, skin, 2.5); // chin
  circ(c, 0, hy, 21, skin);
  c.fillStyle = skin; c.beginPath(); c.ellipse(0, hy + 9, 17, 9, 0, 0, TAU); c.fill();
  // cap (backwards) or candle
  if (cake) {
    rrect(c, -3, hy - 42, 6, 22, 2, '#5fb8ff', 2);
    c.fillStyle = '#ffd23f'; c.beginPath(); c.ellipse(0, hy - 47 + Math.sin(t * 0.4), 4, 7, 0, 0, TAU); c.fill(); stroke(c, 1.5);
    ell(c, 0, hy - 18, 20, 6, '#fff', 2);
  } else {
    c.beginPath(); c.arc(0, hy - 3, 21, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); fill(c, '#e2324a'); stroke(c, 3);
    rrect(c, -30, hy - 11, 14, 6, 3, '#e2324a', 2.5);
    circ(c, 0, hy - 24, 3, '#fff', 2);
  }
  // face
  const ey = hy + 1;
  if (mood === 'blissful' || mood === 'cheer') {
    c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.arc(-7, ey + 2, 4, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    c.beginPath(); c.arc(7, ey + 2, 4, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  } else if (mood === 'shock') {
    circ(c, -7, ey, 5, '#fff', 2); circ(c, 7, ey, 5, '#fff', 2);
    c.fillStyle = OUT; c.beginPath(); c.arc(-7, ey, 1.8, 0, TAU); c.arc(7, ey, 1.8, 0, TAU); c.fill();
  } else {
    c.fillStyle = OUT; c.beginPath(); c.ellipse(-7, ey, 2.4, 3.2, 0, 0, TAU); c.ellipse(7, ey, 2.4, 3.2, 0, 0, TAU); c.fill();
    if (mood === 'worried') { line(c, -11, ey - 7, -4, ey - 9, OUT, 2); line(c, 4, ey - 9, 11, ey - 7, OUT, 2); }
  }
  c.fillStyle = 'rgba(255,110,110,0.45)';
  c.beginPath(); c.arc(-13, ey + 7, 4, 0, TAU); c.arc(13, ey + 7, 4, 0, TAU); c.fill();
  if (mood === 'shock') { ell(c, 0, ey + 12, 4, 5, '#5a1a1a', 2); }
  else if (mood === 'worried') { c.beginPath(); c.arc(0, ey + 15, 6, Math.PI * 1.15, Math.PI * 1.85); stroke(c, 2.5); }
  else { c.beginPath(); c.arc(0, ey + 8, 7, 0.15, Math.PI - 0.15); fill(c, '#7a2a2a'); stroke(c, 2.5); }
  if (o.munching) { drawLobItem(c, 'pudding', 22, -70, 0.3, 0.8); }
  c.restore();
}

// ============================================================
//  Countess Adrena Krome
// ============================================================
function drawCountess(c, x, y, o = {}) {
  const t = o.t || 0, aged = o.aged || 0;
  c.save(); c.translate(x, y); c.scale((o.facing || 1) * (o.scale || 1), o.scale || 1);
  const hover = o.throne ? Math.sin(t * 0.06) * 4 : 0;
  c.translate(0, hover);
  if (o.throne) {
    ell(c, 0, 4, 46, 12, '#3a1d52', 3);
    c.fillStyle = 'rgba(255,140,26,0.35)'; c.beginPath(); c.ellipse(0, 14, 36, 8 + Math.sin(t * 0.3) * 2, 0, 0, TAU); c.fill();
    rrect(c, -30, -60, 60, 62, 14, '#5b2a86');
    rrect(c, -38, -20, 76, 20, 8, '#7a3fb0');
    circ(c, 0, -46, 6, '#ff8c1a', 2);
  }
  // collar behind head
  const dress = aged ? '#7a6a8a' : '#6b2fa8';
  poly(c, [[-26, -112], [-34, -150], [-12, -126], [0, -158], [12, -126], [34, -150], [26, -112]], aged ? '#5a4a6a' : '#3a1d52', 3);
  // gown
  poly(c, [[-12, -88], [12, -88], [30, -2], [-30, -2]], dress, 3);
  c.fillStyle = '#ff8c1a'; c.fillRect(-28, -10, 56, 5);
  rrect(c, -12, -104, 24, 22, 8, dress);
  // arm with goblet
  limb(c, 8, -98, 24, -84, '#f1e6ff', 5);
  if (!aged) {
    poly(c, [[18, -100], [32, -100], [28, -88], [22, -88]], '#e7bd4a', 2.5);
    c.fillStyle = '#ff8c1a'; c.fillRect(20, -98, 10, 4);
    limb(c, 25, -88, 25, -80, '#e7bd4a', 2);
  } else {
    limb(c, 24, -84, 30, -2, '#6b4423', 3);
  }
  // head
  const hy = -122;
  // hair
  if (aged) {
    for (let i = 0; i < 7; i++) circ(c, -14 + i * 4.5, hy - 14 - Math.sin(i) * 4, 9, '#c8c8d0', 2.5);
  } else {
    ell(c, -2, hy - 30, 15, 26, '#fff8ff', 3);
    c.strokeStyle = '#ff8c1a'; c.lineWidth = 4; c.beginPath(); c.moveTo(4, hy - 50); c.quadraticCurveTo(10, hy - 30, 2, hy - 10); c.stroke();
  }
  circ(c, 0, hy, 15, aged ? '#e9dcc8' : '#f4e6ff');
  // face
  c.fillStyle = OUT;
  c.beginPath(); c.ellipse(4, hy - 2, 2.5, 1.6, 0, 0, TAU); c.ellipse(11, hy - 2, 2.2, 1.6, 0, 0, TAU); c.fill();
  line(c, 0, hy - 7, 7, hy - 5, OUT, 2); line(c, 9, hy - 5, 14, hy - 8, OUT, 2);
  if (aged) {
    line(c, -4, hy + 3, 0, hy + 4, '#a08070', 1.5); line(c, 12, hy + 4, 15, hy + 2, '#a08070', 1.5);
    c.beginPath(); c.arc(8, hy + 9, 4, Math.PI * 1.1, Math.PI * 1.9); stroke(c, 2);
  } else {
    c.beginPath(); c.moveTo(3, hy + 7); c.quadraticCurveTo(8, hy + 11, 13, hy + 6); fill(c, '#d01a4a'); stroke(c, 2);
    c.fillStyle = 'rgba(255,90,140,0.4)'; c.beginPath(); c.arc(12, hy + 3, 3, 0, TAU); c.fill();
  }
  c.restore();
}

// ============================================================
//  Misc. story actors & items
// ============================================================
function drawPen(c, x, y, ang = -0.5, s = 1, glow = true, t = 0) {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
  if (glow) {
    const g = c.createRadialGradient(0, 0, 2, 0, 0, 34);
    g.addColorStop(0, 'rgba(160,255,240,0.7)'); g.addColorStop(1, 'rgba(160,255,240,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 34 + Math.sin(t * 0.15) * 4, 0, TAU); c.fill();
  }
  rrect(c, -24, -6, 44, 12, 5, '#f4f8ff');
  rrect(c, -2, -4, 12, 8, 2, '#8fe3ff', 2);
  rrect(c, 18, -7, 10, 14, 4, '#2f7de1', 2.5);
  rrect(c, -30, -4, 8, 8, 2, '#ff8c1a', 2.5);
  c.fillStyle = '#2f7de1'; c.fillRect(-20, -1.5, 14, 3);
  c.restore();
}

function drawBird(c, x, y, o = {}) {
  const t = o.t || 0, kind = o.kind || 'pigeon', flap = Math.sin(t * 0.6);
  c.save(); c.translate(x, y); c.scale(o.facing || 1, 1);
  const body = kind === 'magpie' ? '#1d1d2a' : '#9aa3b5';
  const wingC = kind === 'magpie' ? '#2f4f9a' : '#7d879b';
  if (o.flying) {
    c.save(); c.rotate(-0.6 + flap * 0.8); ell(c, -4, -14, 7, 18, wingC, 2.5); c.restore();
  }
  ell(c, 0, -10, 15, 10, body);
  if (kind === 'magpie') { ell(c, 2, -6, 8, 5, '#fff', 2); poly(c, [[-12, -12], [-30, -18], [-28, -10]], body, 2.5); }
  else { ell(c, 4, -8, 7, 5, '#b7a7d6', 0); poly(c, [[-12, -12], [-24, -14], [-22, -6]], body, 2.5); }
  circ(c, 12, -20, 8, body);
  poly(c, [[18, -22], [27, -19], [18, -16]], '#ffb43d', 2);
  circ(c, 14, -22, 2.2, '#fff', 1); c.fillStyle = OUT; c.fillRect(14, -23, 1.6, 1.6);
  if (!o.flying) { line(c, -2, 0, -3, 6, '#ffb43d', 2); line(c, 4, 0, 5, 6, '#ffb43d', 2); }
  if (o.carry === 'note') { rrect(c, 18, -14, 14, 10, 1, '#fff', 2); }
  if (o.carry === 'pen') drawPen(c, 22, -14, 0.2, 0.55, false);
  c.restore();
}

function drawSquirrel(c, x, y, o = {}) {
  const t = o.t || 0;
  c.save(); c.translate(x, y); c.scale(o.facing || 1, 1);
  const hop = o.walking ? -Math.abs(Math.sin(t * 0.3)) * 8 : 0;
  c.translate(0, hop);
  c.beginPath(); c.moveTo(-8, -8); c.bezierCurveTo(-40, -10, -40, -60, -12, -52); c.bezierCurveTo(-26, -40, -20, -22, -6, -16); c.closePath();
  fill(c, '#b8743a'); stroke(c, 3);
  ell(c, 2, -16, 12, 14, '#c9844a');
  ell(c, 5, -12, 6, 8, '#f3d9b5', 0);
  circ(c, 10, -34, 10, '#c9844a');
  poly(c, [[4, -42], [6, -52], [12, -42]], '#c9844a', 2);
  circ(c, 14, -36, 2.2, OUT, 0);
  circ(c, 20, -32, 2, '#3a2010', 0);
  if (o.munching) { c.fillStyle = '#ff9ecf'; c.fillRect(16, -28, 8, 6); }
  c.restore();
}

function drawCouch(c, x, y) {
  rrect(c, x - 90, y - 70, 180, 50, 16, '#7a4ba8');
  rrect(c, x - 104, y - 44, 30, 44, 10, '#6a3d96');
  rrect(c, x + 74, y - 44, 30, 44, 10, '#6a3d96');
  rrect(c, x - 80, y - 32, 160, 30, 8, '#8b5cbf');
  c.fillStyle = OUT; c.fillRect(x - 90, y - 2, 8, 6); c.fillRect(x + 82, y - 2, 8, 6);
}

function drawCage(c, x, y, o = {}) {
  const open = o.open || 0;
  rrect(c, x - 70, y - 8, 140, 14, 4, '#5a5f70');
  rrect(c, x - 70, y - 176, 140, 14, 4, '#5a5f70');
  for (let i = 0; i < 8; i++) {
    const bx = x - 62 + i * 17.7;
    const lift = i >= 2 && i <= 5 ? open * 160 : 0;
    c.save(); c.globalAlpha = 1 - (lift ? open * 0.7 : 0);
    line(c, bx, y - 164 - lift * 0.1, bx, y - 8 - lift, OUT, 7); line(c, bx, y - 164 - lift * 0.1, bx, y - 8 - lift, '#9aa0b0', 3.5);
    c.restore();
  }
  limb(c, x, y - 176, x, y - 230, '#5a5f70', 4);
}

function drawPaddleWheel(c, x, y, t, joey) {
  c.save(); c.translate(x, y - 110);
  c.rotate(t * 0.02);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    limb(c, 0, 0, Math.cos(a) * 100, Math.sin(a) * 100, '#8a5a32', 6);
    c.save(); c.rotate(a); rrect(c, 80, -14, 30, 28, 4, '#a8703c', 3); c.restore();
  }
  circ(c, 0, 0, 100, null, 0);
  c.strokeStyle = OUT; c.lineWidth = 9; c.beginPath(); c.arc(0, 0, 96, 0, TAU); c.stroke();
  c.strokeStyle = '#8a5a32'; c.lineWidth = 5; c.stroke();
  circ(c, 0, 0, 14, '#5a3a22');
  c.restore();
  if (joey) {
    drawJoey(c, x, y - 64, { t, mood: joey.mood || 'worried' });
    limb(c, x - 44, y - 120, x + 44, y - 120, '#d9c39a', 3);
    limb(c, x - 44, y - 80, x + 44, y - 80, '#d9c39a', 3);
  }
}

function drawBalloon(c, x, y, t) {
  // y = bottom of basket hook
  const by = y - 120;
  line(c, x - 30, by - 30, x - 20, by + 40, OUT, 2); line(c, x + 30, by - 30, x + 20, by + 40, OUT, 2);
  rrect(c, x - 26, by + 40, 52, 30, 6, '#8a5a32');
  c.save();
  c.beginPath(); c.ellipse(x, by - 90, 80, 90, 0, 0, TAU); c.closePath();
  c.fillStyle = '#6b2fa8'; c.fill();
  c.clip();
  c.fillStyle = '#ff8c1a';
  for (let i = -3; i <= 3; i += 2) c.fillRect(x + i * 22 - 10, by - 190, 22, 200);
  c.restore();
  ell(c, x, by - 90, 80, 90, null, 3.5);
  txt(c, 'K', x, by - 95, 40, '#fff');
  line(c, x, by + 70, x, y + 4, OUT, 3);
  c.strokeStyle = OUT; c.lineWidth = 5; c.beginPath(); c.arc(x + 8, y + 4, 9, Math.PI, Math.PI * 0.2, true); c.stroke();
  c.strokeStyle = '#c2c7d3'; c.lineWidth = 2.5; c.stroke();
}

function drawCloudPlatform(c, x, y, t) {
  const b = Math.sin(t * 0.05) * 3;
  for (let i = -3; i <= 3; i++) circ(c, x + i * 22, y + b - (3 - Math.abs(i)) * 6, 26 - Math.abs(i) * 2, '#fff8ff', 3);
  c.fillStyle = '#fff8ff'; c.fillRect(x - 70, y + b - 12, 140, 20);
}

function drawJoeyTank(c, x, y, t, o = {}) {
  // big glass "Craving Core" tank with Joey on a treadmill
  const on = !o.off;
  if (o.scale) { c.save(); c.translate(x, y); c.scale(o.scale, o.scale); drawJoeyTank(c, 0, 0, t, Object.assign({}, o, { scale: 0 })); c.restore(); return; }
  rrect(c, x - 90, y - 26, 180, 30, 6, '#3a3348');
  rrect(c, x - 80, y - 300, 160, 20, 6, '#3a3348');
  limb(c, x, y - 300, x, y - 380, '#4a4258', 10);
  limb(c, x - 60, y - 300, x - 160, y - 380, '#4a4258', 8);
  if (!o.open) {
    c.fillStyle = on ? 'rgba(255,140,26,0.28)' : 'rgba(140,200,255,0.18)';
    rr(c, x - 76, y - 284, 152, 260, 12); c.fill();
  }
  // treadmill
  rrect(c, x - 56, y - 44, 112, 16, 6, '#2a2333');
  for (let i = 0; i < 6; i++) { c.fillStyle = '#555'; c.fillRect(x - 50 + ((i * 20 + (on ? t * 3 : 0)) % 100), y - 40, 6, 8); }
  drawJoey(c, x, y - 44, { t, mood: o.mood || (on ? 'worried' : 'happy'), walking: on && !o.open });
  if (on && !o.open) {
    for (let i = 0; i < 6; i++) {
      const by = y - 40 - ((t * 1.5 + i * 47) % 240);
      circ(c, x - 60 + hash(i + 3) * 120, by, 4 + hash(i) * 4, 'rgba(255,200,120,0.6)', 0);
    }
  }
  if (!o.open) {
    c.strokeStyle = OUT; c.lineWidth = 4; rr(c, x - 76, y - 284, 152, 260, 12); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x - 64, y - 270, 10, 200);
  }
  // sign
  rrect(c, x - 70, y - 352, 140, 30, 6, '#1d1226', 0);
  txt(c, on ? 'CRAVING CORE' : 'OFFLINE', x, y - 337, 16, on ? '#ff8c1a' : '#7fd8ff', 'center', 3);
}

function drawPharmacyCounter(c, x, y) {
  rrect(c, x - 80, y - 60, 160, 60, 6, '#e9eef7');
  rrect(c, x - 86, y - 68, 172, 12, 4, '#4aa3ff');
  txt(c, '+ Rx PICKUP', x, y - 32, 16, '#2f7de1', 'center', 3, '#fff');
}

// ============================================================
//  Pickups & props
// ============================================================
function drawPickup(c, kind, sx, sy, t) {
  const b = Math.sin(t * 0.12) * 3;
  switch (kind) {
    case 'coin': {
      const w = Math.abs(Math.cos(t * 0.12)) * 8 + 2;
      ell(c, sx, sy - 10 + b, w, 9, '#ffd23f', 2.5);
      if (w > 6) txt(c, '$', sx, sy - 10 + b, 10, '#c98a12', 'center', 0);
      break;
    }
    case 'apple':
      circ(c, sx - 4, sy - 12 + b, 9, '#e2324a'); circ(c, sx + 4, sy - 12 + b, 9, '#e2324a', 0);
      c.beginPath(); c.arc(sx + 4, sy - 12 + b, 9, -1.5, 1.6); stroke(c, 3);
      ell(c, sx + 5, sy - 25 + b, 6, 3, '#5fd068', 2, -0.4); line(c, sx, sy - 20 + b, sx + 1, sy - 26 + b, '#5a3a22', 2.5);
      break;
    case 'broccoli':
      limb(c, sx, sy - 4 + b, sx, sy - 16 + b, '#8fd16a', 7);
      circ(c, sx - 8, sy - 20 + b, 8, '#3fa34d'); circ(c, sx + 8, sy - 20 + b, 8, '#3fa34d'); circ(c, sx, sy - 27 + b, 9, '#4bbf5a');
      break;
    case 'shake':
      poly(c, [[sx - 9, sy - 30 + b], [sx + 9, sy - 30 + b], [sx + 7, sy - 2 + b], [sx - 7, sy - 2 + b]], '#7fd8ff', 2.5);
      rrect(c, sx - 10, sy - 34 + b, 20, 6, 2, '#fff', 2);
      line(c, sx + 3, sy - 34 + b, sx + 7, sy - 44 + b, '#e2324a', 3);
      txt(c, 'P', sx, sy - 16 + b, 11, '#1f4a9c', 'center', 0);
      break;
    case 'pen':
      drawPen(c, sx, sy - 22 + b, -0.4, 0.9, true, t);
      break;
  }
}

function drawCrate(c, sx, sy, kind, hpk) {
  const wob = hpk < 1 ? Math.sin(performance.now() * 0.05) * (1 - hpk) * 2 : 0;
  c.save(); c.translate(sx + wob, sy);
  if (kind === 'barrel') {
    rrect(c, -20, -48, 40, 48, 10, '#a0602a');
    line(c, -19, -36, 19, -36, OUT, 3); line(c, -19, -12, 19, -12, OUT, 3);
    c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(-12, -44, 5, 40);
  } else if (kind === 'meds') {
    rrect(c, -24, -40, 48, 40, 3, '#f2f2f2');
    c.fillStyle = '#e2324a'; c.fillRect(-5, -32, 10, 24); c.fillRect(-12, -25, 24, 10);
  } else if (kind === 'cake') {
    rrect(c, -24, -36, 48, 36, 6, '#ff9ecf'); rrect(c, -24, -42, 48, 12, 6, '#fff');
    circ(c, 0, -46, 5, '#e2324a', 2);
  } else if (kind === 'tank') {
    rrect(c, -18, -54, 36, 54, 8, '#4a4258');
    rrect(c, -12, -44, 24, 30, 5, '#ff8c1a', 2);
  } else {
    rrect(c, -24, -44, 48, 44, 3, '#c08a4a');
    line(c, -22, -42, 22, -2, OUT, 3); line(c, 22, -42, -22, -2, OUT, 3);
    c.strokeStyle = OUT; c.lineWidth = 3; c.strokeRect(-18, -38, 36, 32);
  }
  c.restore();
}

// ============================================================
//  Portraits for the dialog box
// ============================================================
function drawPortrait(c, who, x, y, t) {
  c.save();
  c.beginPath(); c.arc(x, y, 38, 0, TAU); c.fillStyle = SPEAKERS[who]?.bg || '#3a2a50'; c.fill();
  c.clip();
  switch (who) {
    case 'joey': drawJoey(c, x - 2, y + 128, { t, mood: 'happy', scale: 1.2 }); break;
    case 'joeyWorried': drawJoey(c, x - 2, y + 128, { t, mood: 'worried', scale: 1.2 }); break;
    case 'joeyBliss': drawJoey(c, x - 2, y + 128, { t, mood: 'blissful', scale: 1.2, slim: 0.4 }); break;
    case 'cake': drawJoey(c, x - 2, y + 128, { t, mood: 'happy', scale: 1.2, cake: true }); break;
    case 'countess': drawCountess(c, x - 6, y + 128, { t }); break;
    case 'countessOld': drawCountess(c, x - 6, y + 124, { t, aged: 1 }); break;
    case 'pharm': drawGoonHead(c, x - 4, y + 4, SKINS.human, 26, 'nice'); break;
    case 'pigeon': drawBird(c, x - 10, y + 32, { t, kind: 'pigeon', scale: 1.6 }); break;
    case 'magpie': drawBird(c, x - 10, y + 32, { t, kind: 'magpie' }); break;
    case 'squirrel': drawSquirrel(c, x - 10, y + 40, { t }); break;
    case 'narrator': txt(c, '?', x, y + 4, 52, '#ffe9b0'); break;
    default: {
      const b = BOSS_DEFS[who];
      if (b && b.portrait) b.portrait(c, x, y, t);
    }
  }
  c.restore();
  c.beginPath(); c.arc(x, y, 38, 0, TAU); stroke(c, 4);
}

const SPEAKERS = {
  narrator: { name: 'Storybook', color: '#ffe9b0', bg: '#5a3d2a' },
  joey: { name: 'Joey', color: '#ffd23f', bg: '#5fb8ff' },
  joeyWorried: { name: 'Joey', color: '#ffd23f', bg: '#5fb8ff' },
  joeyBliss: { name: 'Joey', color: '#ffd23f', bg: '#7fe0a0' },
  cake: { name: 'Joey...?', color: '#ff9ecf', bg: '#ffe6f2' },
  countess: { name: 'Countess Adrena Krome', color: '#c58cff', bg: '#2d1846' },
  countessOld: { name: 'Countess Adrena Krome', color: '#c8c8d0', bg: '#4a4058' },
  pharm: { name: 'Pharmacist Phil', color: '#7fd8ff', bg: '#d8f0ff' },
  pigeon: { name: 'Carrier Pigeon', color: '#c8d0e0', bg: '#8fd3ff' },
  magpie: { name: 'Sir Snatchington', color: '#9fb8ff', bg: '#ffe066' },
  squirrel: { name: 'A Squirrel', color: '#e0a060', bg: '#bfe8a0' },
  troll: { name: 'Prior Authorization Troll', color: '#a8d080', bg: '#5a6a4a' },
  golem: { name: 'Gingerbread Golem', color: '#e0a060', bg: '#ffd1e8' },
  gravy: { name: 'Captain Gravybeard', color: '#e0b080', bg: '#5fb8ff' },
  wyrm: { name: 'The Pudding Wyrm', color: '#d0a070', bg: '#c6ecff' },
  mech: { name: 'Countess Adrena Krome', color: '#c58cff', bg: '#2d1846' },
};
