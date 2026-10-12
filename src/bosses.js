'use strict';
// ============================================================
//  Bosses: one generic pattern-driven class + five definitions
// ============================================================

class Boss extends Actor {
  constructor(key, x, y) {
    super(x, y);
    const D = this.D = BOSS_DEFS[key];
    this.key = key; this.name = D.name; this.team = 'foe';
    this.maxHp = this.hp = Math.round(D.hp * (1 + 0.6 * (G.players.length - 1)));
    this.w = D.w; this.h = D.h; this.depthR = D.depthR || 14; this.zOff = D.zOff || 0;
    this.setState('intro');
    this.pat = null; this.pt = 0; this.rest = 50; this.phase = 1; this.facing = -1; this.last = null;
    this.pose = 'walk'; this.noGrav = !!D.flying; this.z = D.startZ || 0;
    this.introX = x - 300; this.trail = [];
  }
  get target() {
    let best = null, bd = 1e9;
    for (const p of G.players) { if (p.dead) continue; const d = Math.abs(p.x - this.x) + Math.abs(p.y - this.y); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  face(t) { if (t) this.facing = t.x >= this.x ? 1 : -1; }
  update() {
    this.t++; this.anim++;
    if (this.flash > 0) this.flash--;
    if (this.D.flying) { this.trail.unshift({ x: this.x, y: this.y, z: this.z }); if (this.trail.length > 60) this.trail.pop(); }
    if (this.state === 'intro') {
      this.pose = 'walk';
      if (Math.abs(this.x - this.introX) > 3) this.x = approach(this.x, this.introX, 2.4);
      else { this.pose = 'idle'; this.arrived = true; }
      if (this.D.flying) this.z = approach(this.z, 60 + Math.sin(this.t * 0.06) * 8, 2);
      this.physics();
      return;
    }
    if (this.state === 'dying') {
      this.pose = 'dying';
      if (this.t % 7 === 0) {
        const ex = this.x + rand(-this.w, this.w), ez = this.z + rand(20, this.h);
        FX.sparks(ex, this.y, ez, 10, '#ffe066'); FX.puff(ex, this.y, ez, 4, 'rgba(255,200,120,0.8)'); Snd.play('boom');
        G.shake = Math.max(G.shake, 6);
      }
      if (this.D.flying) this.z = approach(this.z, 0, 1.5);
      if (this.t >= 120) { this.remove = true; FX.chunks(this.x, this.y, 40, 24, this.D.chunk || '#888'); FX.stars(this.x, this.y, 60, 16); G.onBossDefeated(this); }
      return;
    }
    if (G.phase !== 'play') { if (this.pose === 'walk') this.pose = 'idle'; return; }
    const tgt = this.target;
    if (this.phase === 1 && this.hp < this.maxHp * 0.5) {
      this.phase = 2;
      FX.text(this.x, this.y, this.h + 40, 'ENRAGED!', '#ff5d5d', 34, 80);
      Snd.play('roar'); G.shake = 10;
    }
    if (!tgt) { this.pose = 'idle'; this.physics(); return; }
    if (this.state === 'idle') {
      this.D.move(this, tgt);
      if (--this.rest <= 0) this.choose();
    } else if (this.state === 'pattern') {
      this.pt++;
      const P = this.D.patterns[this.pat];
      P.fn(this, this.pt, tgt);
      if (this.pt >= P.dur) {
        this.setState('idle'); this.pose = 'idle';
        const r = this.D.rest;
        this.rest = Math.round(rand(r[0], r[1]) * (this.phase === 2 ? 0.6 : 1));
      }
    }
    this.physics();
    if (!this.offscreenOk) this.x = clamp(this.x, G.cam.x + this.w * 0.6, G.cam.x + W - this.w * 0.6);
  }
  choose() {
    const opts = Object.entries(this.D.patterns).filter(([k, p]) => k !== this.last && (!p.phase2 || this.phase === 2) && (!p.when || p.when(this)));
    let tot = opts.reduce((s, [, p]) => s + (p.w || 1), 0), r = Math.random() * tot;
    let pick = opts[0][0];
    for (const [k, p] of opts) { r -= p.w || 1; if (r <= 0) { pick = k; break; } }
    this.pat = pick; this.last = pick; this.pt = 0; this.hitset = new Set();
    this.setState('pattern');
    this.face(this.target);
  }
  onHurt(src, spec, dir) { this.vx += dir * 0.3; }
  die(src) {
    this.dead = true; this.setState('dying');
    G.slowmo = 100; G.shake = 14;
    Snd.play('boom'); Snd.play('roar');
    for (const pr of G.projectiles) if (pr.team === 'foe') pr.remove = true;
    G.warnings.length = 0;
    for (const p of G.players) p.gainXp(this.D.xp);
  }
  draw(c, camX) {
    const sx = this.x - camX, sy = this.y - this.z;
    if (this.D.shadowFn) this.D.shadowFn(c, this, camX);
    else drawShadow(c, sx, this.y, this.w * 1.2, this.z);
    if (this.state === 'dying' && this.t > 90 && (this.t >> 1) % 2) return;
    withFlash(c, this.flash > 0, () => this.D.draw(c, this, sx, sy));
  }
}

// ---------- shared pattern helpers ----------
function bossHit(b, near, far, depth, z1, z2, dmg, opt = {}) {
  const x1 = b.facing > 0 ? b.x + near : b.x - far, x2 = b.facing > 0 ? b.x + far : b.x - near;
  return resolveAttack(b, Object.assign({
    x1, x2, y: b.y, depth, z1, z2, dmg: dmg * G.dmgScale(), kbx: 6, kbz: 7, knock: true, hitstop: 6, dir: b.facing, hitset: b.hitset,
  }, opt), G.livingPlayers());
}
function bossAoe(b, r, dmg, opt = {}) {
  return resolveAttack(b, Object.assign({
    x1: b.x - r, x2: b.x + r, y: b.y, depth: r * 0.45, z1: -10, z2: 60, dmg: dmg * G.dmgScale(), kbx: 6, kbz: 8, knock: true, hitstop: 7, dir: null, hitset: new Set(),
  }, opt), G.livingPlayers());
}
function stepToward(b, x, y, sx, sy = sx * 0.6) {
  const dx = x - b.x, dy = y - b.y;
  b.x += clamp(dx, -sx, sx); b.y += clamp(dy, -sy, sy);
  return Math.abs(dx) > sx || Math.abs(dy) > sy;
}
function standardMove(dist, spd) {
  return (b, tgt) => {
    const side = b.x < tgt.x ? -1 : 1;
    const wx = clamp(tgt.x + side * dist, G.cam.x + b.w, G.cam.x + W - b.w);
    const moving = stepToward(b, wx, tgt.y, spd, spd * 0.7);
    b.pose = moving ? 'walk' : 'idle';
    b.face(tgt);
  };
}
function chargeAttack(b, t, tgt, { wind = 30, speed = 8, until = 100, stunEnd = 130, dmg = 14, depth = 34 } = {}) {
  if (t < wind) { b.pose = 'windup'; b.face(tgt); b.y = approach(b.y, tgt.y, 1.5); b.x += Math.sin(t * 1.5) * 1.5; if (t === 1) Snd.play('charge'); return; }
  if (t === wind) { Snd.play('roar'); b.offscreenOk = false; }
  if (t < until && !b.stunned) {
    b.pose = 'charge'; b.x += b.facing * speed;
    if (t % 4 === 0) FX.puff(b.x - b.facing * 30, b.y, 0, 2);
    bossHit(b, -10, b.w + 30, depth, 0, b.h, dmg);
    const atEdge = b.x <= G.cam.x + b.w * 0.6 + 2 || b.x >= G.cam.x + W - b.w * 0.6 - 2;
    if (atEdge) { b.stunned = true; b.pt = until; G.shake = 12; Snd.play('boom'); FX.stars(b.x, b.y, b.h, 8); }
    return;
  }
  b.pose = 'stun';
  if (t >= stunEnd - 1) b.stunned = false;
}

// ============================================================
//  Boss art
// ============================================================
function drawStamp(c, x, y, ang, slammed) {
  c.save(); c.translate(x, y); c.rotate(ang);
  limb(c, 0, 0, 0, 40, '#8a5a32', 10);
  rrect(c, -38, 40, 76, 22, 6, '#6b4423', 3.5);
  rrect(c, -36, 58, 72, 12, 3, '#d33b3b', 3);
  if (slammed) txt(c, 'DENIED', 0, 64, 12, '#fff', 'center', 2);
  c.restore();
}

function drawTroll(c, b, sx, sy) {
  const pose = b.pose, t = b.anim;
  c.save(); c.translate(sx, sy); c.scale(b.facing, 1);
  let lean = 0, bob = 0;
  if (pose === 'walk') bob = -Math.abs(Math.sin(t * 0.15)) * 4;
  if (pose === 'charge') lean = 0.3;
  if (pose === 'windup') lean = -0.1;
  if (pose === 'dying') lean = -0.2 + Math.sin(t * 0.5) * 0.05;
  c.translate(0, bob); c.rotate(lean);
  const sk = '#8aa86a';
  const ls = pose === 'walk' || pose === 'charge' ? Math.sin(t * (pose === 'charge' ? 0.5 : 0.15)) * 14 : 0;
  limb(c, -20, -40, -24 + ls, -2, sk, 22); limb(c, 20, -40, 24 - ls, -2, sk, 22);
  ell(c, -22 + ls, 0, 20, 8, '#4a3a2a'); ell(c, 26 - ls, 0, 20, 8, '#4a3a2a');
  // back arm
  limb(c, -40, -120, -62, -70, sk, 20);
  // body
  ell(c, 0, -100, 66, 72, sk);
  ell(c, 8, -84, 40, 44, '#b4c99a', 0);
  poly(c, [[-14, -168], [26, -168], [16, -150], [-6, -150]], '#fff', 3);
  poly(c, [[2, -156], [12, -156], [16, -104], [7, -94], [-2, -104]], '#d33b3b', 3);
  // head
  const hy = -184;
  circ(c, 12, hy, 30, sk);
  ell(c, 38, hy + 4, 12, 10, shade(sk, -0.1), 3);
  line(c, 0, hy - 14, 34, hy - 10, OUT, 6);
  c.strokeStyle = OUT; c.lineWidth = 2.5;
  c.beginPath(); c.arc(16, hy - 4, 7, 0, TAU); c.moveTo(35, hy - 3); c.arc(28, hy - 3, 7, 0, TAU); c.stroke();
  c.fillStyle = OUT; c.beginPath(); c.arc(17, hy - 3, 2.2, 0, TAU); c.arc(29, hy - 2, 2.2, 0, TAU); c.fill();
  poly(c, [[6, hy + 16], [40, hy + 14], [36, hy + 26], [10, hy + 26]], '#5a2a2a', 2.5);
  poly(c, [[10, hy + 16], [14, hy + 6], [17, hy + 16]], '#fff', 2); poly(c, [[30, hy + 15], [34, hy + 5], [37, hy + 15]], '#fff', 2);
  if (pose === 'stun') for (let i = 0; i < 3; i++) { const a = t * 0.15 + i * 2.1; starShape(c, 12 + Math.cos(a) * 34, hy - 36 + Math.sin(a) * 8, 8, 3.5, 5, '#ffe066'); }
  // front arm + stamp
  let arm = 0.7, stampAng = -0.2, slammed = false;
  if (pose === 'raise') { arm = -2.0 - Math.sin(b.pt * 0.4) * 0.05; stampAng = Math.PI + 0.3; }
  if (pose === 'slam') { arm = 0.85; stampAng = -0.6; slammed = true; }
  if (pose === 'throw') { arm = Math.sin(b.pt * 0.5) > 0 ? -1.6 : 0.3; stampAng = 0.2; }
  if (pose === 'charge') { arm = 0.2; stampAng = -1.2; }
  const hx = 34 + Math.cos(arm) * 56, hy2 = -120 + Math.sin(arm) * 56;
  drawStamp(c, hx, hy2, stampAng, slammed);
  limb(c, 34, -120, hx, hy2, sk, 20);
  circ(c, hx, hy2, 13, sk);
  c.restore();
}

function drawGolem(c, b, sx, sy) {
  const pose = b.pose, t = b.anim;
  const gb = '#c47a3c', ic = '#ffffff';
  c.save(); c.translate(sx, sy); c.scale(b.facing, 1);
  let bob = pose === 'walk' ? -Math.abs(Math.sin(t * 0.12)) * 5 : Math.sin(t * 0.05) * 2;
  if (pose === 'dying') c.rotate(Math.sin(t * 0.4) * 0.05);
  c.translate(0, bob);
  const ls = pose === 'walk' ? Math.sin(t * 0.12) * 16 : 0;
  limb(c, -26, -60, -30 + ls, -4, gb, 30); limb(c, 26, -60, 30 - ls, -4, gb, 30);
  line(c, -38 + ls, -12, -20 + ls, -12, ic, 3); line(c, 20 - ls, -12, 40 - ls, -12, ic, 3);
  let back = 1.9, front = 1.2;
  if (pose === 'windup') { front = -2.6; back = 0.6; }
  if (pose === 'punch') front = 0.0;
  if (pose === 'raise') { front = -1.9 + Math.sin(t * 0.3) * 0.2; back = -1.3 - Math.sin(t * 0.3) * 0.2; }
  if (pose === 'jump') { front = -0.6; back = -0.4; }
  const L = pose === 'punch' ? 100 : 70;
  limb(c, -40, -150, -40 + Math.cos(back) * 70, -150 + Math.sin(back) * 70, gb, 28);
  rrect(c, -56, -136, 112, 100, 34, gb, 4);
  c.strokeStyle = ic; c.lineWidth = 4; c.beginPath();
  for (let i = 0; i <= 10; i++) c.lineTo(-48 + i * 9.6, -48 + (i % 2) * 7); c.stroke();
  [['#ff5d8f', -112], ['#5fd068', -88], ['#ffd23f', -64]].forEach(([col, y]) => circ(c, 4, y, 8, col, 3));
  // head
  const hy = -174;
  circ(c, 4, hy, 40, gb, 4);
  c.strokeStyle = ic; c.lineWidth = 4; c.beginPath(); c.arc(4, hy, 33, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  circ(c, 16, hy - 4, 7, ic, 3); circ(c, 36, hy - 4, 6, ic, 3);
  c.fillStyle = OUT; c.beginPath(); c.arc(18, hy - 3, 3, 0, TAU); c.arc(37, hy - 3, 3, 0, TAU); c.fill();
  line(c, 6, hy - 18, 26, hy - 12, ic, 5); line(c, 30, hy - 12, 44, hy - 18, ic, 5);
  c.strokeStyle = ic; c.lineWidth = 4; c.beginPath(); c.arc(26, hy + 22, 12, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  const fx = 40 + Math.cos(front) * L, fy = -150 + Math.sin(front) * L;
  limb(c, 40, -150, fx, fy, gb, 28);
  circ(c, fx, fy, 20, gb, 4);
  line(c, fx - 14, fy, fx + 14, fy, ic, 3);
  c.restore();
}

function drawGravybeard(c, b, sx, sy) {
  const pose = b.pose, t = b.anim;
  c.save(); c.translate(sx, sy);
  let fac = b.facing;
  if (pose === 'whirl') fac = Math.sin(t * 0.6) > 0 ? 1 : -1;
  c.scale(fac, 1);
  const bob = pose === 'walk' ? -Math.abs(Math.sin(t * 0.18)) * 4 : 0;
  c.translate(0, bob);
  if (pose === 'charge') c.rotate(0.25);
  const ls = pose === 'walk' || pose === 'charge' ? Math.sin(t * 0.3) * 12 : 0;
  limb(c, -16, -40, -18 + ls, -4, '#5b3b26', 16); limb(c, 16, -40, 18 - ls, -4, '#5b3b26', 16);
  rrect(c, -36 + ls, -10, 28, 12, 5, '#2a2333'); rrect(c, 6 - ls, -10, 28, 12, 5, '#2a2333');
  let arm = 0.9;
  if (pose === 'windup') arm = -2.6; if (pose === 'sweep') arm = 0.3; if (pose === 'throw') arm = Math.sin(b.pt * 0.4) > 0 ? -2 : 0.4;
  if (pose === 'charge') arm = -0.1; if (pose === 'whirl') arm = 0;
  limb(c, -34, -110, -50, -66, '#f0c39a', 14);
  ell(c, 0, -86, 52, 56, '#ffffff');
  c.save(); c.beginPath(); c.ellipse(0, -86, 51, 55, 0, 0, TAU); c.clip();
  c.fillStyle = '#2f5fb3'; for (let i = 0; i < 6; i++) c.fillRect(-60, -136 + i * 18, 120, 8);
  c.restore();
  poly(c, [[-26, -96], [26, -96], [34, -36], [-34, -36]], '#f4f4f4', 3);
  c.fillStyle = '#8b5a2b'; c.beginPath(); c.ellipse(4, -60, 12, 8, 0, 0, TAU); c.fill();
  // head
  const hy = -152;
  circ(c, 6, hy, 26, '#f0c39a');
  // beard
  c.beginPath(); c.moveTo(-16, hy + 4); c.quadraticCurveTo(0, hy + 60, 36, hy + 6); c.quadraticCurveTo(10, hy + 16, -16, hy + 4); fill(c, '#7a4a25'); stroke(c, 3);
  for (let i = 0; i < 3; i++) { const dx = -4 + i * 12, dl = 8 + Math.sin(t * 0.1 + i) * 4; c.fillStyle = '#8b5a2b'; c.beginPath(); c.ellipse(dx, hy + 36 + dl, 3, 5, 0, 0, TAU); c.fill(); }
  // eye + patch
  circ(c, 20, hy - 4, 5, '#fff', 2); c.fillStyle = OUT; c.beginPath(); c.arc(21, hy - 3, 2.2, 0, TAU); c.fill();
  ell(c, 2, hy - 4, 8, 7, OUT, 0); line(c, -18, hy - 14, 30, hy - 10, OUT, 2.5);
  line(c, 12, hy - 14, 28, hy - 10, OUT, 4);
  ell(c, 30, hy + 4, 7, 6, '#f7a88a', 2.5);
  // chef hat
  rrect(c, -16, hy - 40, 44, 18, 4, '#fff', 3);
  circ(c, -10, hy - 50, 14, '#fff'); circ(c, 6, hy - 58, 16, '#fff'); circ(c, 22, hy - 50, 14, '#fff');
  c.fillStyle = '#fff'; c.fillRect(-14, hy - 46, 40, 10);
  txt(c, '☠', 6, hy - 31, 12, OUT, 'center', 0);
  // front arm + giant ladle
  const hx = 30 + Math.cos(arm) * 40, hy2 = -112 + Math.sin(arm) * 40;
  c.save(); c.translate(hx, hy2); c.scale(2, 2); drawWeapon(c, 'ladle', 0, 0, arm - 0.4 + (pose === 'sweep' ? 1.2 : 0)); c.restore();
  limb(c, 30, -112, hx, hy2, '#f0c39a', 14);
  circ(c, hx, hy2, 9, '#f0c39a');
  if (pose === 'stun') for (let i = 0; i < 3; i++) { const a = t * 0.15 + i * 2.1; starShape(c, 6 + Math.cos(a) * 30, hy - 74 + Math.sin(a) * 8, 8, 3.5, 5, '#ffe066'); }
  c.restore();
}

function drawWyrm(c, b, sx, sy) {
  const camX = G.cam.x, t = b.anim;
  // body segments, tail first
  const segs = [];
  for (let i = 1; i <= 7; i++) { const p = b.trail[Math.min(b.trail.length - 1, i * 6)] || b; segs.push(p); }
  for (let i = segs.length - 1; i >= 0; i--) {
    const p = segs[i], r = 30 - i * 2.6;
    const px = p.x - camX, py = p.y - p.z - 40 + Math.sin(t * 0.1 + i) * 4;
    circ(c, px, py, r, i % 2 ? '#8b5a2b' : '#7a4a25', 3.5);
    ell(c, px, py - r * 0.55, r * 0.7, r * 0.25, '#fff8ef', 0);
    if (i === 1) {
      const fl = Math.sin(t * 0.3);
      poly(c, [[px, py - 10], [px - 30, py - 50 - fl * 16], [px + 10, py - 30]], '#ffd9c7', 3);
      poly(c, [[px, py - 10], [px + 34, py - 54 - fl * 16], [px + 14, py - 22]], '#ffe9de', 3);
    }
  }
  // head
  c.save(); c.translate(sx, sy - 40); c.scale(b.facing, 1);
  if (b.pose === 'dazed' || b.pose === 'dying') c.rotate(0.3);
  c.beginPath(); c.moveTo(-42, 26); c.lineTo(-36, -20); c.quadraticCurveTo(0, -46, 36, -20); c.lineTo(46, 26); c.quadraticCurveTo(0, 36, -42, 26); fill(c, '#7a4a25'); stroke(c, 4);
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.ellipse(-14, -18, 10, 5, -0.4, 0, TAU); c.fill();
  // cream dollop + cherry
  for (let i = 0; i < 4; i++) circ(c, -14 + i * 10, -32 - (i % 2) * 6, 11, '#fff8ef', 3);
  circ(c, 2, -50, 9, '#e2324a', 3); line(c, 2, -58, 10, -70, '#3f8a30', 3);
  // face
  const open = b.pose === 'spit' ? 1 : 0;
  circ(c, 16, -6, 8, '#fff', 2.5); circ(c, 34, -6, 7, '#fff', 2.5);
  c.fillStyle = OUT; c.beginPath(); c.arc(19, -5, 3.2, 0, TAU); c.arc(36, -5, 3, 0, TAU); c.fill();
  if (b.pose === 'dazed') { txt(c, 'x', 16, -6, 14, OUT, 'center', 0); txt(c, 'x', 34, -6, 14, OUT, 'center', 0); }
  line(c, 6, -18, 24, -14, OUT, 3); line(c, 28, -14, 42, -18, OUT, 3);
  c.beginPath(); c.ellipse(28, 14, 14, 4 + open * 8, 0, 0, TAU); fill(c, '#4a1a1a'); stroke(c, 3);
  poly(c, [[18, 10], [22, 18], [26, 10]], '#fff', 1.5); poly(c, [[32, 10], [36, 18], [40, 10]], '#fff', 1.5);
  c.restore();
  if (b.pose === 'dazed') for (let i = 0; i < 3; i++) { const a = t * 0.15 + i * 2.1; starShape(c, sx + Math.cos(a) * 36, sy - 110 + Math.sin(a) * 8, 8, 3.5, 5, '#ffe066'); }
}

function drawMech(c, b, sx, sy) {
  const pose = b.pose, t = b.anim;
  // laser beam (drawn first so the mech overlaps it)
  if (b.laser) {
    const L = b.laser, by = L.y - 70, x0 = sx + b.facing * 110, x1 = b.facing > 0 ? W + 40 : -40;
    if (L.active) {
      c.save();
      c.fillStyle = 'rgba(255,140,26,0.35)'; c.fillRect(Math.min(x0, x1), by - 26, Math.abs(x1 - x0), 52);
      c.fillStyle = '#ffb347'; c.fillRect(Math.min(x0, x1), by - 14, Math.abs(x1 - x0), 28);
      c.fillStyle = '#fff6d0'; c.fillRect(Math.min(x0, x1), by - 5, Math.abs(x1 - x0), 10);
      c.restore();
    } else {
      c.save(); c.globalAlpha = 0.5 + Math.sin(t * 0.8) * 0.3;
      c.strokeStyle = '#ff4040'; c.lineWidth = 2; c.setLineDash([10, 8]);
      c.beginPath(); c.moveTo(x0, by); c.lineTo(x1, by); c.stroke();
      c.setLineDash([]);
      c.restore();
      c.fillStyle = 'rgba(255,64,64,0.18)';
      c.beginPath(); c.ellipse((x0 + x1) / 2, L.y, Math.abs(x1 - x0) / 2, 18, 0, 0, TAU); c.fill();
    }
  }
  c.save(); c.translate(sx, sy); c.scale(b.facing, 1);
  if (pose === 'dying') c.rotate(Math.sin(t * 0.6) * 0.04);
  const ls = pose === 'walk' ? Math.sin(t * 0.14) * 14 : 0;
  // legs
  for (const [ox, d] of [[-40, ls], [40, -ls]]) {
    limb(c, ox, -90, ox + d * 0.5 - 6, -46, '#5a5068', 18);
    limb(c, ox + d * 0.5 - 6, -46, ox + d, -8, '#7a6a88', 14);
    rrect(c, ox + d - 26, -14, 52, 16, 6, '#3a3348');
  }
  // back tanks
  rrect(c, -96, -190, 34, 90, 12, '#4a4258', 3.5);
  rrect(c, -91, -172 + (G.flags.powerDown ? 50 : 0), 24, G.flags.powerDown ? 18 : 64, 8, '#ff8c1a', 2);
  // body
  rrect(c, -76, -176, 152, 100, 22, '#6b2fa8', 4);
  c.fillStyle = '#ff8c1a'; c.fillRect(-74, -120, 148, 10);
  for (let i = 0; i < 5; i++) circ(c, -60 + i * 30, -160, 3, '#c58cff', 1.5);
  c.save(); c.scale(b.facing, 1); txt(c, 'GIGGLE JUICER 9000', 0, -94, 11, '#ffe066', 'center', 3); c.restore();
  // cockpit dome with the Countess
  c.save();
  c.beginPath(); c.arc(0, -176, 46, Math.PI, 0); c.closePath(); c.clip();
  c.fillStyle = '#2a1a40'; c.fillRect(-50, -230, 100, 60);
  drawCountess(c, -4, -110, { t, scale: 0.55, facing: 1 });
  c.restore();
  c.fillStyle = 'rgba(180,230,255,0.25)'; c.beginPath(); c.arc(0, -176, 46, Math.PI, 0); c.fill();
  c.beginPath(); c.arc(0, -176, 46, Math.PI, 0); stroke(c, 4);
  c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(-20, -200, 10, 5, -0.5, 0, TAU); c.fill();
  // magpie on top holding the pen
  if (!G.flags.penRecovered) drawBird(c, 6, -222, { t, kind: 'magpie', carry: 'pen' });
  // cannon arm
  const glow = pose === 'charge' || (b.laser && b.laser.active);
  limb(c, 60, -140, 90, -120, '#5a5068', 16);
  rrect(c, 80, -138, 50, 30, 10, '#3a3348', 3.5);
  circ(c, 130, -123, 12, glow ? '#ffb347' : '#2a2333', 3);
  if (glow) { c.fillStyle = 'rgba(255,180,70,0.4)'; c.beginPath(); c.arc(130, -123, 24 + Math.sin(t) * 4, 0, TAU); c.fill(); }
  // missile pods
  rrect(c, -40, -200, 26, 22, 4, '#3a3348', 3); rrect(c, 14, -200, 26, 22, 4, '#3a3348', 3);
  c.restore();
}

// ============================================================
//  Boss definitions
// ============================================================
const BOSS_DEFS = {
  // ---------------------------------------------------------- World 1
  troll: {
    name: 'Prior Authorization Troll', title: 'Keeper of the Paperwork', hp: 460, w: 50, h: 200, depthR: 18, xp: 120, chunk: '#8aa86a',
    rest: [50, 90], draw: drawTroll,
    portrait(c, x, y, t) { c.save(); c.translate(x - 14, y + 200); drawTroll(c, { pose: 'idle', anim: t, facing: 1, pt: 0 }, 0, 0); c.restore(); },
    move: standardMove(170, 1.3),
    patterns: {
      stamp: {
        dur: 84, w: 3,
        fn(b, t, tgt) {
          if (t < 38) { b.pose = 'raise'; if (t < 20) { b.face(tgt); stepToward(b, tgt.x - b.facing * 120, tgt.y, 1.6, 1.4); } }
          if (t === 38) {
            b.pose = 'slam'; G.shake = 12; Snd.play('boom');
            const sx = b.x + b.facing * 110;
            FX.ring(sx, b.y, 0, '#fff', 80); FX.puff(sx, b.y, 0, 10);
            FX.text(sx, b.y, 70, 'DENIED!', '#d33b3b', 30, 50);
            bossHit(b, 20, 180, 42, 0, 90, 14);
            shockwave(b, sx, b.y, 1, 10 * G.dmgScale(), 7); shockwave(b, sx, b.y, -1, 10 * G.dmgScale(), 7);
            if (b.phase === 2) {
              shockwave(b, sx, b.y - 60, 1, 10 * G.dmgScale(), 6); shockwave(b, sx, b.y + 60, -1, 10 * G.dmgScale(), 6);
            }
          }
        },
      },
      papers: {
        dur: 76, w: 2,
        fn(b, t, tgt) {
          b.pose = 'throw';
          if (t === 20 || t === 34 || t === 48) {
            b.face(tgt); Snd.play('throw');
            const dx = Math.abs(tgt.x - b.x) || 1, steps = dx / 7;
            const spread = b.phase === 2 ? [-1, 0, 1] : [0];
            for (const s of spread) {
              G.projectiles.push(new Projectile({
                x: b.x + b.facing * 60, y: b.y, z: 60, vx: b.facing * 7, vy: clamp((tgt.y - b.y) / steps + s * 1.2, -2.5, 2.5),
                team: 'foe', kind: 'paper', dmg: 7 * G.dmgScale(), life: 150, w: 16, h: 26, owner: b,
              }));
            }
          }
        },
      },
      charge: {
        dur: 130, w: 2,
        fn(b, t, tgt) { chargeAttack(b, t, tgt, { wind: 32, speed: 8.5, until: 100, stunEnd: 130, dmg: 14 }); },
      },
    },
  },

  // ---------------------------------------------------------- World 2
  golem: {
    name: 'Gingerbread Golem', title: 'Baked Fresh. Baked Angry.', hp: 650, w: 56, h: 220, depthR: 20, xp: 160, chunk: '#c47a3c',
    rest: [36, 70], draw: drawGolem,
    portrait(c, x, y, t) { c.save(); c.translate(x - 8, y + 200); drawGolem(c, { pose: 'idle', anim: t, facing: 1 }, 0, 0); c.restore(); },
    move: standardMove(160, 1.1),
    patterns: {
      punch: {
        dur: 66, w: 3,
        fn(b, t, tgt) {
          if (t < 30) { b.pose = 'windup'; b.face(tgt); stepToward(b, tgt.x - b.facing * 150, tgt.y, 1.4, 1.4); if (t === 1) Snd.play('charge'); }
          else if (t < 50) {
            b.pose = 'punch';
            if (t === 30) { Snd.play('swing'); G.shake = 6; }
            if (t < 37) bossHit(b, 0, 210, 38, 0, 160, 15);
          } else b.pose = 'idle';
        },
      },
      rain: {
        dur: 120, w: 2,
        fn(b, t, tgt) {
          b.pose = 'raise';
          if (t === 1) Snd.play('roar');
          const every = b.phase === 2 ? 6 : 9;
          if (t >= 10 && t <= 96 && t % every === 0) {
            const p = choice(G.livingPlayers()) || tgt;
            const tx = clamp(p.x + rand(-120, 120), G.cam.x + 30, G.cam.x + W - 30), ty = clamp(p.y + rand(-50, 50), GROUND_TOP, GROUND_BOTTOM);
            G.projectiles.push(new Projectile({ x: tx, y: ty, z: 520, vz: -9, grav: 0.2, team: 'foe', kind: 'drop', dmg: 9 * G.dmgScale(), life: 200, w: 14, h: 24, owner: b, splash: 34, scale: 1.6 }));
            G.warnings.push({ x: tx, y: ty, r: 34, life: 40, max: 40 });
          }
        },
      },
      bellyflop: {
        dur: 110, w: 2,
        fn(b, t, tgt) {
          if (t === 1) b.landed = false;
          if (t < 20) { b.pose = 'windup'; return; }
          if (t === 20) { b.jumpTo = { x: tgt.x, y: tgt.y }; b.vz = 14; b.z = 0.1; b.pose = 'jump'; Snd.play('jump'); G.warnings.push({ x: tgt.x, y: tgt.y, r: 110, life: 46, max: 46 }); }
          if (!b.landed && t > 20) {
            stepToward(b, b.jumpTo.x, b.jumpTo.y, 6, 4);
            if (b.z === 0 && t > 24) {
              b.landed = true; b.pose = 'idle'; G.shake = 14; Snd.play('boom');
              FX.ring(b.x, b.y, 0, '#fff', 120); FX.puff(b.x, b.y, 0, 14, 'rgba(255,240,220,0.8)', 5);
              bossAoe(b, 120, 16);
              shockwave(b, b.x, b.y, 1, 10 * G.dmgScale(), 6, '#e0b080'); shockwave(b, b.x, b.y, -1, 10 * G.dmgScale(), 6, '#e0b080');
            }
          }
        },
      },
      summon: {
        dur: 60, w: 1, when: () => G.enemies.filter((e) => !e.dead).length < 2,
        fn(b, t) {
          b.pose = 'raise';
          if (t === 20) { Snd.play('roar'); G.spawnEnemy('grunt', -1); G.spawnEnemy(b.phase === 2 ? 'thrower' : 'grunt', 1); }
        },
      },
    },
  },

  // ---------------------------------------------------------- World 3
  gravy: {
    name: 'Captain Gravybeard', title: 'Scourge of the Seven Sauces', hp: 720, w: 44, h: 190, depthR: 16, xp: 200, chunk: '#8b5a2b',
    rest: [30, 64], draw: drawGravybeard,
    portrait(c, x, y, t) { c.save(); c.translate(x - 6, y + 170); drawGravybeard(c, { pose: 'idle', anim: t, facing: 1, pt: 0 }, 0, 0); c.restore(); },
    move: standardMove(150, 1.6),
    patterns: {
      sweep: {
        dur: 60, w: 3,
        fn(b, t, tgt) {
          if (t < 24) { b.pose = 'windup'; b.face(tgt); stepToward(b, tgt.x - b.facing * 110, tgt.y, 2, 1.6); }
          else if (t < 40) { b.pose = 'sweep'; if (t === 24) Snd.play('swing'); if (t < 31) bossHit(b, -20, 180, 50, 0, 120, 14, { kbz: 6 }); }
          else b.pose = 'idle';
        },
      },
      lobs: {
        dur: 84, w: 2,
        fn(b, t) {
          b.pose = 'throw';
          const times = b.phase === 2 ? [14, 26, 38, 50, 62] : [16, 34, 52];
          if (times.includes(t)) {
            const p = choice(G.livingPlayers()); if (!p) return;
            Snd.play('throw');
            lob(b, p.x + rand(-30, 30), p.y + rand(-20, 20), 'gravyboat', 9 * G.dmgScale(), 46, {
              z0: 120, r: 46,
              onLand(pr) {
                Snd.play('splash'); FX.drops(pr.x, pr.y, 4, 12, '#8b5a2b');
                G.hazards.push({ x: pr.x, y: pr.y, r: 54, life: 360, max: 360, kind: 'gravy' });
                resolveAttack(b, { x1: pr.x - 40, x2: pr.x + 40, y: pr.y, depth: 22, z1: -5, z2: 40, dmg: pr.dmg, kbx: 3, kbz: 4, stun: 18, dir: null, hitset: new Set() }, G.livingPlayers());
              },
            });
          }
        },
      },
      dash: {
        dur: 120, w: 2,
        fn(b, t, tgt) { chargeAttack(b, t, tgt, { wind: 26, speed: 10, until: 90, stunEnd: 120, dmg: 14, depth: 30 }); },
      },
      whirl: {
        dur: 100, w: 2, phase2: true,
        fn(b, t, tgt) {
          if (t === 1) Snd.play('roar');
          b.pose = 'whirl';
          stepToward(b, tgt.x, tgt.y, 2.6, 1.6);
          if (t % 12 === 0) { b.hitset = new Set(); Snd.play('swing'); }
          resolveAttack(b, { x1: b.x - 110, x2: b.x + 110, y: b.y, depth: 34, z1: 0, z2: 100, dmg: 7 * G.dmgScale(), kbx: 5, kbz: 5, knock: true, hitstop: 3, dir: null, hitset: b.hitset }, G.livingPlayers());
        },
      },
    },
  },

  // ---------------------------------------------------------- World 4
  wyrm: {
    name: 'The Pudding Wyrm', title: 'Jiggly. Ancient. Unrefrigerated.', hp: 620, w: 50, h: 80, depthR: 22, zOff: 0, xp: 240, chunk: '#7a4a25',
    flying: true, startZ: 60, rest: [30, 60], draw: drawWyrm,
    shadowFn(c, b, camX) { drawShadow(c, b.x - camX, b.y, 60, Math.min(b.z, 200)); },
    portrait(c, x, y, t) { c.save(); drawWyrm(c, { pose: 'idle', anim: t, facing: 1, trail: [], x: G.cam.x + x - 18, y: y + 60, z: 0 }, x - 18, y + 60); c.restore(); },
    move(b, tgt) {
      const side = b.x < tgt.x ? -1 : 1;
      const wx = clamp(tgt.x + side * 140, G.cam.x + 80, G.cam.x + W - 80);
      stepToward(b, wx, tgt.y, 1.8, 1.5);
      b.z = approach(b.z, 60 + Math.sin(b.anim * 0.06) * 10, 2);
      b.face(tgt); b.pose = 'idle';
    },
    patterns: {
      spit: {
        dur: 72, w: 3,
        fn(b, t, tgt) {
          b.z = approach(b.z, 70, 2);
          b.pose = t % 15 < 8 && t > 14 ? 'spit' : 'idle';
          const shots = b.phase === 2 ? [16, 26, 36, 46, 56] : [20, 36, 52];
          if (shots.includes(t)) {
            b.face(tgt); Snd.play('throw');
            lob(b, tgt.x + rand(-40, 40), tgt.y + rand(-25, 25), 'pudding', 10 * G.dmgScale(), 40, { z0: b.z + 40, x: b.x + b.facing * 40, r: 38 });
          }
        },
      },
      dive: {
        dur: 176, w: 2,
        fn(b, t, tgt) {
          b.offscreenOk = false;
          if (t === 1) { b.landed = false; Snd.play('roar'); }
          if (t < 40) { b.z = approach(b.z, 360, 10); b.pose = 'idle'; return; }
          if (t < 90) {
            stepToward(b, tgt.x, tgt.y, 5, 3);
            if (t === 60) G.warnings.push({ x: tgt.x, y: tgt.y, r: 100, life: 40, max: 40 });
            return;
          }
          if (!b.landed) {
            b.z = approach(b.z, 0, 22);
            if (b.z <= 0) {
              b.landed = true; G.shake = 16; Snd.play('boom');
              FX.ring(b.x, b.y, 0, '#fff', 110); FX.drops(b.x, b.y, 10, 20, '#7a4a25');
              bossAoe(b, 110, 18);
            }
            return;
          }
          if (t < 156) { b.pose = 'dazed'; return; }
          b.pose = 'idle'; b.z = approach(b.z, 60, 3);
        },
      },
      swoop: {
        dur: 130, w: 2,
        fn(b, t, tgt) {
          if (t === 1) { b.swoopDir = b.x < G.cam.x + W / 2 ? 1 : -1; b.hitset = new Set(); }
          const startX = b.swoopDir > 0 ? G.cam.x + 70 : G.cam.x + W - 70;
          if (t < 40) { stepToward(b, startX, tgt.y, 7, 3); b.z = approach(b.z, 80, 3); b.facing = b.swoopDir; return; }
          if (t === 40) Snd.play('roar');
          if (t < 110) {
            b.facing = b.swoopDir; b.x += b.swoopDir * 9; b.z = approach(b.z, 14, 4);
            b.y = approach(b.y, tgt.y, 1.2);
            resolveAttack(b, { x1: b.x - 50, x2: b.x + 50, y: b.y, depth: 26, z1: b.z, z2: b.z + 70, dmg: 13 * G.dmgScale(), kbx: 6, kbz: 7, knock: true, hitstop: 5, dir: b.swoopDir, hitset: b.hitset }, G.livingPlayers());
            return;
          }
          b.z = approach(b.z, 60, 3);
        },
      },
    },
  },

  // ---------------------------------------------------------- World 5
  mech: {
    name: 'GIGGLE JUICER 9000', title: 'Piloted by Countess Adrena Krome', hp: 1100, w: 70, h: 230, depthR: 22, xp: 300, chunk: '#6b2fa8',
    rest: [30, 60], draw: drawMech,
    portrait(c, x, y, t) { drawCountess(c, x - 6, y + 128, { t }); },
    move: standardMove(260, 1.2),
    patterns: {
      laser: {
        dur: 140, w: 3,
        fn(b, t, tgt) {
          if (t === 1) { Snd.play('charge'); b.laser = { y: b.y, active: false }; }
          if (t < 50) {
            b.pose = 'charge'; b.face(tgt);
            b.y = approach(b.y, tgt.y, 2.2); b.laser.y = b.y;
            return;
          }
          if (t === 50) { b.laser.active = true; Snd.play('laser'); b.hitset = new Set(); }
          if (t < 100) {
            b.pose = 'charge'; G.shake = Math.max(G.shake, 2);
            if (b.phase === 2) { b.laser.y = approach(b.laser.y, tgt.y, 0.9); b.y = b.laser.y; }
            if (t % 15 === 0) b.hitset = new Set();
            const x1 = b.facing > 0 ? b.x + 100 : G.cam.x - 50, x2 = b.facing > 0 ? G.cam.x + W + 50 : b.x - 100;
            resolveAttack(b, { x1, x2, y: b.laser.y, depth: 20, z1: 0, z2: 110, dmg: 12 * G.dmgScale(), kbx: 5, kbz: 6, knock: true, hitstop: 4, dir: b.facing, hitset: b.hitset }, G.livingPlayers());
            if (t % 3 === 0) FX.sparks(b.x + b.facing * rand(120, 800), b.laser.y, 60, 2, '#ffb347');
            return;
          }
          b.laser = null; b.pose = 'idle';
        },
      },
      missiles: {
        dur: 100, w: 2,
        fn(b, t) {
          b.pose = 'idle';
          const every = b.phase === 2 ? 7 : 11;
          if (t >= 16 && t <= 72 && t % every === 0) {
            const p = choice(G.livingPlayers()); if (!p) return;
            Snd.play('throw');
            lob(b, p.x + rand(-90, 90), p.y + rand(-40, 40), 'vial', 11 * G.dmgScale(), 50, {
              z0: 220, x: b.x + rand(-20, 20), r: 44,
              onLand(pr) {
                Snd.play('boom'); FX.drops(pr.x, pr.y, 4, 14, '#ff8c1a'); FX.ring(pr.x, pr.y, 0, '#ff8c1a', 50);
                G.shake = Math.max(G.shake, 4);
                resolveAttack(b, { x1: pr.x - 46, x2: pr.x + 46, y: pr.y, depth: 24, z1: -5, z2: 50, dmg: pr.dmg, kbx: 4, kbz: 6, knock: true, hitstop: 4, dir: null, hitset: new Set() }, G.livingPlayers());
              },
            });
          }
        },
      },
      stomp: {
        dur: 110, w: 2,
        fn(b, t, tgt) {
          if (t === 1) b.landed = false;
          if (t < 22) { b.pose = 'idle'; b.x += Math.sin(t * 1.4) * 2; return; }
          if (t === 22) { b.jumpTo = { x: tgt.x, y: tgt.y }; b.vz = 15; b.z = 0.1; Snd.play('jump'); G.warnings.push({ x: tgt.x, y: tgt.y, r: 120, life: 48, max: 48 }); }
          if (!b.landed && t > 22) {
            stepToward(b, b.jumpTo.x, b.jumpTo.y, 6, 4);
            if (b.z === 0 && t > 26) {
              b.landed = true; G.shake = 16; Snd.play('boom');
              FX.ring(b.x, b.y, 0, '#ff8c1a', 130); FX.puff(b.x, b.y, 0, 14, 'rgba(200,180,220,0.8)', 5);
              bossAoe(b, 125, 18);
              shockwave(b, b.x, b.y, 1, 11 * G.dmgScale(), 7, '#9a8ab0'); shockwave(b, b.x, b.y, -1, 11 * G.dmgScale(), 7, '#9a8ab0');
            }
          }
        },
      },
      summon: {
        dur: 60, w: 1, when: () => G.enemies.filter((e) => !e.dead).length < 2,
        fn(b, t) {
          if (t === 20) { Snd.play('roar'); G.spawnEnemy('grunt', -1); G.spawnEnemy(b.phase === 2 ? 'flyer' : 'grunt', 1); }
        },
      },
    },
  },
};
