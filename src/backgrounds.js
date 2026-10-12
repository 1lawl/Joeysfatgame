'use strict';
// ============================================================
//  Parallax backgrounds, one per world
// ============================================================

function layer(c, camX, factor, spacing, fn, seed = 0) {
  const off = camX * factor;
  const i0 = Math.floor((off - spacing * 2) / spacing), i1 = Math.floor((off + W + spacing) / spacing);
  for (let i = i0; i <= i1; i++) fn(i * spacing - off, i, hash(i * 7919 + seed));
}
function skyGrad(c, top, bot, y1 = GROUND_TOP) {
  const g = c.createLinearGradient(0, 0, 0, y1);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  c.fillStyle = g; c.fillRect(0, 0, W, y1 + 2);
}
function cloud(c, x, y, s, col = '#ffffff', lw = 0) {
  c.fillStyle = col;
  [[0, 0, 1], [-0.9, 0.25, 0.7], [0.9, 0.25, 0.75], [0.4, -0.35, 0.7], [-0.4, -0.25, 0.6]].forEach(([dx, dy, r]) => {
    c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, TAU); c.fill();
    if (lw) stroke(c, lw);
  });
}
function groundBase(c, top, mid, bot) {
  const g = c.createLinearGradient(0, GROUND_TOP - 30, 0, H);
  g.addColorStop(0, top); g.addColorStop(0.3, mid); g.addColorStop(1, bot);
  c.fillStyle = g; c.fillRect(0, GROUND_TOP - 30, W, H - GROUND_TOP + 30);
  c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, GROUND_TOP - 30, W, 4);
}

const BG = {
  // ---------------------------------------------------------- prologue
  home(c, camX, f) {
    c.fillStyle = '#f6d6a8'; c.fillRect(0, 0, W, GROUND_TOP);
    c.fillStyle = '#efc48c';
    for (let x = -((camX * 1) % 60); x < W; x += 60) c.fillRect(x, 0, 24, GROUND_TOP);
    // window
    const wx = 640 - camX;
    rrect(c, wx, 90, 220, 160, 6, '#20305a', 5);
    c.fillStyle = '#ffe9b0'; c.beginPath(); c.arc(wx + 170, 140, 22, 0, TAU); c.fill();
    for (let i = 0; i < 12; i++) { c.fillStyle = '#fff'; c.fillRect(wx + 10 + hash(i) * 200, 100 + hash(i + 30) * 140, 2, 2); }
    if (!G.flags.windowBroken) {
      line(c, wx + 110, 92, wx + 110, 248, '#8a5a32', 6); line(c, wx + 2, 170, wx + 218, 170, '#8a5a32', 6);
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(wx + 10, 100, 40, 140);
    } else {
      c.fillStyle = 'rgba(255,255,255,0.6)';
      poly(c, [[wx + 4, 92], [wx + 40, 92], [wx + 10, 140]], 'rgba(220,240,255,0.7)', 2);
      poly(c, [[wx + 216, 248], [wx + 170, 248], [wx + 212, 200]], 'rgba(220,240,255,0.7)', 2);
    }
    // posters
    const px = 120 - camX;
    rrect(c, px, 80, 110, 140, 4, '#ff5d8f', 4);
    txt(c, 'PIZZA', px + 55, 120, 26, '#ffd23f'); txt(c, 'IS LIFE', px + 55, 150, 20, '#fff');
    circ(c, px + 55, 192, 20, '#ffb43d', 3);
    const qx = 340 - camX;
    rrect(c, qx, 110, 120, 80, 4, '#3d6bd1', 4);
    txt(c, 'GYM?', qx + 60, 136, 22, '#fff'); txt(c, 'someday', qx + 60, 166, 16, '#ffd23f');
    // floor
    groundBase(c, '#b07a4a', '#9a6438', '#7a4a28');
    c.fillStyle = 'rgba(60,30,10,0.35)';
    for (let y = GROUND_TOP - 26; y < H; y += 22) c.fillRect(0, y, W, 2);
    for (let r = 0, y = GROUND_TOP - 26; y < H; y += 22, r++)
      for (let x = -((camX + r * 70) % 140); x < W; x += 140) c.fillRect(x, y, 2, 22);
    // rug
    c.fillStyle = '#c84a4a'; c.beginPath(); c.ellipse(560 - camX, 450, 220, 50, 0, 0, TAU); c.fill();
    c.strokeStyle = '#ffd23f'; c.lineWidth = 4; c.beginPath(); c.ellipse(560 - camX, 450, 200, 42, 0, 0, TAU); c.stroke();
  },

  // ---------------------------------------------------------- world 1
  pharmacy(c, camX, f) {
    skyGrad(c, '#6ec6ff', '#d6f1ff');
    layer(c, camX, 0.05, 420, (x, i, r) => cloud(c, x + r * 200, 60 + r * 60, 24 + r * 16), 1);
    layer(c, camX, 0.2, 120, (x, i, r) => {
      const h = 90 + r * 120;
      c.fillStyle = '#a9c6de'; c.fillRect(x, GROUND_TOP - 60 - h, 100, h + 40);
      c.fillStyle = '#c9e0f0';
      for (let wy = GROUND_TOP - 50 - h; wy < GROUND_TOP - 80; wy += 22) for (let wx = 10; wx < 90; wx += 22) c.fillRect(x + wx, wy, 10, 12);
    }, 2);
    const signs = ['PHARMACY', 'SNAX MART', 'DONUT HOLE', 'GYM (CLOSED)', 'PILL HILL', 'WAFFLE WORLD', 'Rx EXPRESS', 'PIZZA PALACE'];
    const fronts = ['#ff7a7a', '#ffd23f', '#7fd8a0', '#c58cff', '#ff9ecf', '#7fb8ff'];
    layer(c, camX, 0.75, 320, (x, i, r) => {
      const top = GROUND_TOP - 230, col = fronts[Math.floor(r * fronts.length)];
      rrect(c, x, top, 300, 204, 4, col, 4);
      rrect(c, x + 30, top + 18, 240, 40, 6, '#fff', 3);
      txt(c, signs[((i % signs.length) + signs.length) % signs.length], x + 150, top + 39, 24, '#2f3f6a', 'center', 0);
      // awning
      for (let k = 0; k < 10; k++) {
        c.fillStyle = k % 2 ? '#fff' : shade(col, -0.25);
        c.beginPath(); c.moveTo(x + k * 30, top + 70); c.lineTo(x + k * 30 + 30, top + 70); c.lineTo(x + k * 30 + 30, top + 92); c.arc(x + k * 30 + 15, top + 92, 15, 0, Math.PI); c.closePath(); c.fill();
      }
      c.strokeStyle = OUT; c.lineWidth = 3; c.strokeRect(x, top + 70, 300, 22);
      rrect(c, x + 26, top + 116, 120, 70, 4, '#bfe6ff', 3);
      for (let k = 0; k < 4; k++) rrect(c, x + 36 + k * 27, top + 150, 16, 26, 4, ['#ff9a3d', '#5fd068', '#e2324a', '#7fd8ff'][k], 2);
      rrect(c, x + 186, top + 116, 70, 88, 4, '#5a6a90', 3);
      circ(c, x + 245, top + 162, 3.5, '#ffd23f', 1.5);
    }, 3);
    groundBase(c, '#d4d4dc', '#7a7a88', '#5c5c68');
    c.fillStyle = '#c4c4cc'; c.fillRect(0, GROUND_TOP - 30, W, 26);
    c.fillStyle = 'rgba(0,0,0,0.15)';
    for (let x = -((camX) % 80); x < W; x += 80) c.fillRect(x, GROUND_TOP - 30, 3, 26);
    c.fillStyle = '#9a9aa6'; c.fillRect(0, GROUND_TOP - 6, W, 6);
    c.fillStyle = '#ffd23f';
    for (let x = -((camX) % 180); x < W + 60; x += 180) {
      c.beginPath(); c.moveTo(x, GROUND_TOP + 10); c.lineTo(x + 8, GROUND_TOP + 10); c.lineTo(x - 40, H); c.lineTo(x - 48, H); c.closePath(); c.fill();
    }
    layer(c, camX, 1, 90, (x, i, r) => { if (r < 0.3) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.ellipse(x, GROUND_TOP + 40 + r * 400, 14, 5, 0, 0, TAU); c.fill(); } }, 4);
  },

  // ---------------------------------------------------------- world 2
  woods(c, camX, f) {
    skyGrad(c, '#ff9fc8', '#ffe6b8');
    c.fillStyle = '#fff2a8'; c.beginPath(); c.arc(760 - camX * 0.02, 100, 50, 0, TAU); c.fill();
    layer(c, camX, 0.08, 380, (x, i, r) => cloud(c, x + r * 160, 50 + r * 60, 22 + r * 14, '#fff6fb'), 5);
    layer(c, camX, 0.18, 220, (x, i, r) => {
      c.fillStyle = '#c58cd8'; c.beginPath(); c.arc(x + 110, GROUND_TOP - 40, 120 + r * 50, Math.PI, 0); c.fill();
    }, 6);
    layer(c, camX, 0.35, 160, (x, i, r) => {
      c.fillStyle = '#a66cc0'; c.beginPath(); c.arc(x + 80, GROUND_TOP - 30, 80 + r * 40, Math.PI, 0); c.fill();
    }, 7);
    layer(c, camX, 0.7, 190, (x, i, r) => {
      const bx = x + r * 80, by = GROUND_TOP - 30;
      if (r < 0.55) {
        // lollipop tree
        const h = 120 + r * 120;
        limb(c, bx, by, bx, by - h, '#fff', 7);
        const col = ['#ff5d8f', '#5fd068', '#ffd23f', '#5fb8ff'][i & 3];
        circ(c, bx, by - h - 30, 36, col, 4);
        c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath();
        for (let a = 0; a < 12; a += 0.3) c.lineTo(bx + Math.cos(a) * a * 2.6, by - h - 30 + Math.sin(a) * a * 2.6);
        c.stroke();
      } else {
        // mushroom house
        rrect(c, bx - 30, by - 70, 60, 70, 10, '#fff4e0', 4);
        rrect(c, bx - 10, by - 40, 20, 40, 10, '#8a5a32', 3);
        c.beginPath(); c.ellipse(bx, by - 74, 62, 40, 0, Math.PI, 0); c.closePath(); fill(c, '#e2324a'); stroke(c, 4);
        circ(c, bx - 26, by - 90, 8, '#fff', 0); circ(c, bx + 18, by - 100, 10, '#fff', 0); circ(c, bx + 40, by - 82, 6, '#fff', 0);
      }
    }, 8);
    // candy-cane fence
    layer(c, camX, 1, 46, (x, i) => {
      const by = GROUND_TOP - 26;
      limb(c, x, by, x, by - 44, '#fff', 5);
      for (let k = 0; k < 3; k++) line(c, x - 3, by - 8 - k * 13, x + 3, by - 14 - k * 13, '#e2324a', 3);
    }, 9);
    c.fillStyle = OUT; c.fillRect(0, GROUND_TOP - 60, W, 3);
    groundBase(c, '#8be06a', '#6cc552', '#4f9a3c');
    c.fillStyle = '#7a4a28';
    c.beginPath(); c.moveTo(0, GROUND_TOP + 30); c.bezierCurveTo(W * 0.3, GROUND_TOP + 10, W * 0.7, GROUND_TOP + 70, W, GROUND_TOP + 40);
    c.lineTo(W, GROUND_TOP + 110); c.bezierCurveTo(W * 0.7, GROUND_TOP + 140, W * 0.3, GROUND_TOP + 80, 0, GROUND_TOP + 100); c.closePath();
    c.globalAlpha = 0.35; c.fill(); c.globalAlpha = 1;
    layer(c, camX, 1, 50, (x, i, r) => {
      const y = GROUND_TOP + 10 + r * 160;
      if (r < 0.25) { circ(c, x, y, 4, ['#fff', '#ffd23f', '#ff9ecf'][i % 3], 1.5); }
      else { line(c, x, y, x - 3, y - 8, '#3f8a30', 2); line(c, x + 4, y, x + 6, y - 7, '#3f8a30', 2); }
    }, 10);
  },

  // ---------------------------------------------------------- world 3
  lagoon(c, camX, f) {
    skyGrad(c, '#ff7a5a', '#ffd27a', 240);
    c.fillStyle = '#fff1a8'; c.beginPath(); c.arc(480, 228, 70, Math.PI, 0); c.fill();
    layer(c, camX, 0.06, 360, (x, i, r) => cloud(c, x + r * 160, 50 + r * 70, 20 + r * 14, 'rgba(255,220,200,0.9)'), 11);
    // gravy sea
    c.fillStyle = '#8b5a2b'; c.fillRect(0, 230, W, GROUND_TOP - 230);
    c.fillStyle = 'rgba(255,220,160,0.35)';
    for (let k = 0; k < 6; k++) {
      const y = 245 + k * 18, o = (f * (0.4 + k * 0.15) + camX * (0.2 + k * 0.08)) % 90;
      for (let x = -o; x < W; x += 90) c.fillRect(x, y, 40, 3);
    }
    layer(c, camX, 0.15, 500, (x, i, r) => {
      c.fillStyle = '#5a3a22'; c.beginPath(); c.ellipse(x + 200, 236, 120, 20, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#e8c070'; c.fillRect(x + 160, 200, 50, 36); c.fillStyle = '#c2c7d3'; c.fillRect(x + 172, 180, 10, 20);
    }, 12);
    // deck back structures
    layer(c, camX, 0.85, 400, (x, i, r) => {
      const by = GROUND_TOP - 70;
      if (r < 0.5) {
        rrect(c, x + 40, by - 150, 46, 150, 4, '#e2324a', 4);
        rrect(c, x + 34, by - 160, 58, 18, 4, '#2a2333', 4);
        FXsmoke(c, x + 63, by - 170, f, i);
      } else {
        rrect(c, x + 20, by - 110, 200, 110, 6, '#f4e2c0', 4);
        for (let k = 0; k < 4; k++) circ(c, x + 50 + k * 45, by - 60, 14, '#7fd8ff', 3);
        rrect(c, x + 10, by - 124, 220, 18, 4, '#8a5a32', 4);
        txt(c, 'GRAVY CO.', x + 120, by - 115, 14, '#ffd23f', 'center', 3);
      }
    }, 13);
    // railing
    c.fillStyle = '#5a3a22'; c.fillRect(0, GROUND_TOP - 72, W, 8);
    c.fillStyle = OUT; c.fillRect(0, GROUND_TOP - 74, W, 2);
    layer(c, camX, 1, 40, (x) => { c.fillStyle = '#6b4423'; c.fillRect(x, GROUND_TOP - 66, 6, 40); }, 14);
    layer(c, camX, 1, 520, (x) => { circ(c, x + 100, GROUND_TOP - 46, 18, '#fff', 4); circ(c, x + 100, GROUND_TOP - 46, 9, '#7fb8ff', 0); c.strokeStyle = '#e2324a'; c.lineWidth = 6; c.beginPath(); c.arc(x + 100, GROUND_TOP - 46, 14, -0.4, 0.4); c.stroke(); c.beginPath(); c.arc(x + 100, GROUND_TOP - 46, 14, Math.PI - 0.4, Math.PI + 0.4); c.stroke(); }, 15);
    groundBase(c, '#c8945a', '#b07a44', '#8a5a32');
    c.fillStyle = 'rgba(60,30,10,0.4)';
    for (let y = GROUND_TOP - 26, r = 0; y < H; y += 18, r++) {
      c.fillRect(0, y, W, 2);
      for (let x = -((camX + r * 97) % 220); x < W; x += 220) c.fillRect(x, y, 2, 18);
    }
    layer(c, camX, 1, 140, (x, i, r) => { if (r < 0.35) { c.fillStyle = 'rgba(110,60,20,0.35)'; c.beginPath(); c.ellipse(x, GROUND_TOP + 30 + r * 380, 22, 6, 0, 0, TAU); c.fill(); } }, 16);
  },

  // ---------------------------------------------------------- world 4
  clouds(c, camX, f) {
    skyGrad(c, '#4aa8ff', '#c6ecff');
    layer(c, camX, 0.04, 300, (x, i, r) => cloud(c, x + r * 100, 80 + r * 100, 40 + r * 30, 'rgba(255,255,255,0.7)'), 17);
    layer(c, camX, 0.25, 330, (x, i, r) => {
      const bx = x + r * 120, by = 170 + r * 60;
      if (r < 0.5) {
        // floating ice cream cone island
        poly(c, [[bx - 30, by], [bx + 30, by], [bx, by + 70]], '#e0a860', 3);
        circ(c, bx - 14, by - 6, 20, '#ff9ecf', 3); circ(c, bx + 14, by - 6, 20, '#fff4e0', 3); circ(c, bx, by - 26, 20, '#7a4a25', 3);
        circ(c, bx, by - 50, 7, '#e2324a', 2.5);
      } else {
        cloud(c, bx, by, 34, '#ffffff', 3);
        rrect(c, bx - 16, by - 70, 32, 46, 6, '#fff4e0', 3);
        poly(c, [[bx - 22, by - 70], [bx + 22, by - 70], [bx, by - 100]], '#ff9ecf', 3);
      }
    }, 18);
    layer(c, camX, 0.6, 240, (x, i, r) => {
      cloud(c, x + 120, GROUND_TOP - 40 - r * 40, 44 + r * 20, '#fbfbff');
      if (r < 0.4) { starShape(c, x + 40, 150 + r * 100, 8, 3, 4, '#fff6a8', 0); }
    }, 19);
    // cloud floor with scalloped back edge
    groundBase(c, '#f6efff', '#e6dcff', '#c9b6f2');
    c.fillStyle = '#f6efff';
    layer(c, camX, 1, 40, (x) => { c.beginPath(); c.arc(x, GROUND_TOP - 26, 22, Math.PI, 0); c.fill(); }, 20);
    c.strokeStyle = 'rgba(255,158,207,0.35)'; c.lineWidth = 3;
    layer(c, camX, 1, 130, (x, i, r) => {
      const y = GROUND_TOP + 20 + r * 150;
      c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 1.5); c.stroke();
    }, 21);
  },

  // ---------------------------------------------------------- world 5
  refinery(c, camX, f) {
    const off = G.flags.powerDown;
    skyGrad(c, '#1c0f2e', off ? '#2a3a5a' : '#4d1f4f');
    for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect((hash(i) * W * 3 - camX * 0.02) % W, hash(i + 99) * 200, 2, 2); }
    layer(c, camX, 0.15, 180, (x, i, r) => {
      const h = 120 + r * 100;
      c.fillStyle = '#2a1640'; c.fillRect(x, GROUND_TOP - 40 - h, 150, h);
      c.fillRect(x + 20 + r * 60, GROUND_TOP - 80 - h, 22, 60);
      c.fillStyle = off ? '#3a4a6a' : '#ff8c1a';
      for (let k = 0; k < 6; k++) if (hash(i * 7 + k) > 0.4) c.fillRect(x + 14 + (k % 3) * 44, GROUND_TOP - 20 - h + Math.floor(k / 3) * 34, 14, 10);
      if (!off) FXsmoke(c, x + 31 + r * 60, GROUND_TOP - 90 - h, f, i, 'rgba(120,80,140,0.5)');
    }, 22);
    layer(c, camX, 0.7, 300, (x, i, r) => {
      const by = GROUND_TOP - 30;
      // big tank
      rrect(c, x + 20, by - 210, 120, 210, 20, '#4a4258', 4);
      rrect(c, x + 36, by - 190, 88, 150, 12, '#1d1226', 3);
      const lvl = off ? 0.15 : 0.6 + Math.sin(f * 0.02 + i) * 0.1;
      const lh = 150 * lvl;
      rrect(c, x + 38, by - 42 - lh, 84, lh, 10, off ? '#3a4a6a' : '#ff8c1a', 0);
      if (!off) for (let k = 0; k < 3; k++) circ(c, x + 50 + k * 28, by - 50 - ((f * 1.2 + k * 40 + i * 13) % lh), 4, 'rgba(255,230,160,0.8)', 0);
      txt(c, 'ADRENO', x + 80, by - 210, 14, off ? '#7fd8ff' : '#ffd23f', 'center', 3);
      // pipes
      limb(c, x + 140, by - 160, x + 300, by - 160, '#5a5068', 12);
      limb(c, x + 220, by - 160, x + 220, by - 20, '#5a5068', 12);
      circ(c, x + 220, by - 160, 10, '#7a6a88', 3);
      if (r < 0.4) {
        rrect(c, x + 160, by - 120, 120, 50, 4, '#ffd23f', 3);
        txt(c, off ? 'OUTPUT: 0%' : 'HANDLE WITH', x + 220, by - 104, 13, OUT, 'center', 0);
        txt(c, off ? 'have a salad' : 'WHIMSY', x + 220, by - 86, 13, OUT, 'center', 0);
      }
    }, 23);
    groundBase(c, '#5a5068', '#3e3650', '#2a2438');
    // hazard stripes
    for (let x = -((camX) % 40); x < W; x += 40) {
      c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(x, GROUND_TOP - 30); c.lineTo(x + 20, GROUND_TOP - 30); c.lineTo(x + 10, GROUND_TOP - 18); c.lineTo(x - 10, GROUND_TOP - 18); c.closePath(); c.fill();
    }
    c.fillStyle = OUT; c.fillRect(0, GROUND_TOP - 18, W, 3);
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2;
    for (let y = GROUND_TOP; y < H; y += 44) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    for (let x = -((camX) % 120); x < W; x += 120) { c.beginPath(); c.moveTo(x, GROUND_TOP - 15); c.lineTo(x, H); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.15)';
    for (let y = GROUND_TOP + 6; y < H; y += 44) for (let x = -((camX) % 120) + 8; x < W; x += 120) { c.fillRect(x, y, 3, 3); c.fillRect(x + 100, y, 3, 3); }
    if (!off) {
      c.fillStyle = 'rgba(255,140,26,0.06)'; c.fillRect(0, GROUND_TOP - 30, W, H);
    }
  },
};

function FXsmoke(c, x, y, f, i, col = 'rgba(80,80,90,0.45)') {
  c.fillStyle = col;
  for (let k = 0; k < 4; k++) {
    const p = ((f * 0.6 + k * 30 + i * 17) % 120) / 120;
    c.globalAlpha = 1 - p;
    c.beginPath(); c.arc(x + p * 30 + Math.sin(p * 6 + i) * 6, y - p * 90, 8 + p * 18, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
}
