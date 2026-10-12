'use strict';
// ============================================================
//  Entities: combat core, knights, goons, projectiles, pickups
// ============================================================

let NEXT_ID = 1;
const PSPEED = 3.3, PSPEED_Y = 2.3, MAGIC_COST = 25;

// Player attack table. a = active frames [from, to]; reach = [near, far] in front of the knight
const ATK = {
  l1: { dur: 15, a: [3, 7], reach: [0, 84], z: [0, 96], dmg: 7, kbx: 1.6, stun: 18, next: 'l2' },
  l2: { dur: 15, a: [3, 7], reach: [0, 84], z: [0, 96], dmg: 7, kbx: 1.6, stun: 18, next: 'l3' },
  l3: { dur: 26, a: [7, 12], reach: [0, 100], z: [0, 106], dmg: 13, kbx: 7, kbz: 5, knock: true, hitstop: 6, depth: 34 },
  heavy: { dur: 30, a: [8, 14], reach: [0, 82], z: [0, 150], dmg: 11, kbx: 1.4, kbz: 10.5, launch: true, hitstop: 5, heavy: true },
  air: { dur: 16, a: [2, 11], reach: [-14, 86], z: [-40, 96], dmg: 6, kbx: 1.2, kbz: 4.2, hitstop: 3, stun: 14 },
};

function resolveAttack(att, spec, targets) {
  let hits = 0;
  for (const t of targets) {
    if (t === att || t.dead || t.remove || t.invuln > 0 || spec.hitset.has(t.id)) continue;
    if (Math.abs(t.y - spec.y) > spec.depth + (t.depthR || 0)) continue;
    if (t.x + t.w < spec.x1 || t.x - t.w > spec.x2) continue;
    const tz1 = t.z + (t.zOff || 0), tz2 = tz1 + t.h;
    if (tz2 < spec.z1 || tz1 > spec.z2) continue;
    spec.hitset.add(t.id);
    if (t.takeHit(att, spec)) hits++;
  }
  return hits;
}

// ------------------------------------------------------------
class Actor {
  constructor(x, y) {
    this.id = NEXT_ID++;
    this.x = x; this.y = y; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.facing = 1; this.state = 'idle'; this.t = 0; this.anim = 0;
    this.flash = 0; this.invuln = 0; this.dead = false; this.remove = false;
    this.w = 18; this.h = 66; this.hp = this.maxHp = 50; this.juggle = 0;
    this.noGrav = false; this.hitset = new Set(); this.showHp = 0;
  }
  setState(s) { this.state = s; this.t = 0; }
  physics() {
    if (!this.noGrav && (this.z > 0 || this.vz > 0)) {
      this.vz -= GRAV; this.z += this.vz;
      if (this.z <= 0) { this.z = 0; const v = this.vz; this.vz = 0; this.onLand(v); }
    }
    this.x += this.vx; this.y += this.vy;
    const fr = this.z > 0 ? 0.97 : 0.78;
    this.vx *= fr; this.vy *= fr;
    if (Math.abs(this.vx) < 0.05) this.vx = 0;
    this.y = clamp(this.y, GROUND_TOP, GROUND_BOTTOM);
  }
  onLand() {}
  takeHit(src, spec) {
    const dir = spec.dir ?? (this.x >= src.x ? 1 : -1);
    if (this.blocking && this.facing === -dir && !spec.unblockable && this.z === 0) {
      this.vx = dir * 2.5;
      FX.sparks(this.x + this.facing * 16, this.y, 40, 6, '#ffe066');
      Snd.play('block');
      if (this.mp !== undefined) this.mp = Math.max(0, this.mp - 3);
      return false;
    }
    const dmg = this.dmgTaken === 0 ? 0 : Math.max(1, Math.round(spec.dmg * (this.dmgTaken ?? 1)));
    this.hp -= dmg;
    this.flash = 7; this.showHp = 120;
    const hz = this.z + this.h * 0.6;
    FX.sparks(this.x - dir * 6, this.y, hz, spec.knock || spec.launch ? 12 : 7, '#fff7c2');
    FX.text(this.x, this.y - 2, hz + 20, String(dmg), this.team === 'hero' ? '#ff5d5d' : '#fff', dmg >= 12 ? 26 : 20);
    G.hitstop = Math.max(G.hitstop, spec.hitstop ?? 3);
    G.shake = Math.max(G.shake, spec.knock || spec.launch ? 5 : 2);
    Snd.play(spec.knock || spec.launch || dmg >= 12 ? 'bighit' : 'hit');
    if (src && src.onDealtDamage) src.onDealtDamage(dmg, this);
    if (this.hp <= 0) { this.hp = 0; this.die(src, spec, dir); return true; }
    this.onHurt(src, spec, dir);
    return true;
  }
  onHurt(src, spec, dir) {
    this.facing = -dir;
    if (spec.launch || spec.knock || this.z > 0) {
      let kbz = spec.kbz ?? 4;
      if (this.z > 0 && !spec.launch && !spec.knock) kbz = Math.max(this.vz, kbz);
      if (this.juggle >= 8) kbz = Math.min(kbz, 1);
      this.juggle++;
      this.vz = kbz * (this.weight || 1); this.z = Math.max(this.z, 0.1);
      this.vx = dir * (spec.kbx ?? 2);
      this.noGrav = false;
      this.setState('launched');
    } else {
      this.stun = spec.stun ?? 16;
      this.vx = dir * (spec.kbx ?? 2);
      this.setState('hurt');
    }
  }
  die() { this.dead = true; this.remove = true; }
}

// ------------------------------------------------------------
//  Knights
// ------------------------------------------------------------
class Player extends Actor {
  constructor(idx, dev) {
    super(140 + idx * 50, 400 + idx * 28);
    this.idx = idx; this.dev = dev; this.team = 'hero';
    this.lvl = 1; this.xp = 0; this.str = 1; this.mag = 1;
    this.maxHp = 100; this.hp = 100; this.maxMp = 100; this.mp = 100; this.gold = 0;
    this.w = 18; this.h = 100;
    this.reviveT = 0; this.emote = null; this.buf = null; this.airHits = 0; this.slowT = 0;
    this.sceneTarget = null; this.blocking = false;
  }
  get name() { return KNIGHTS[this.idx].name; }
  xpNeed() { return 80 + (this.lvl - 1) * 70; }
  dmgMul() { return 1 + (this.str - 1) * 0.07; }
  snapshot() { const { lvl, xp, str, mag, maxHp, maxMp, gold } = this; return { lvl, xp, str, mag, maxHp, maxMp, gold }; }
  restore(s) { Object.assign(this, s); this.fullReset(); }
  fullReset() {
    this.hp = this.maxHp; this.mp = this.maxMp; this.dead = false; this.setState('idle');
    this.z = 0; this.vx = this.vy = this.vz = 0; this.flash = 0; this.invuln = 0; this.emote = null; this.sceneTarget = null; this.slowT = 0;
  }
  gainXp(n) {
    this.xp += n;
    while (this.xp >= this.xpNeed()) {
      this.xp -= this.xpNeed();
      this.lvl++; this.maxHp += 10; this.maxMp += 5; this.str++; this.mag++;
      this.hp = this.maxHp; this.mp = this.maxMp;
      FX.text(this.x, this.y, 120, 'LEVEL UP!', '#ffe066', 30, 70);
      FX.stars(this.x, this.y, 60, 10, KNIGHTS[this.idx].magic);
      Snd.play('lvlup');
    }
  }
  onDealtDamage(dmg) { this.gainXp(Math.ceil(dmg * 0.35)); G.stats.damage += dmg; }
  startAtk(name) { this.atkName = name; this.setState('attack'); this.buf = null; this.hitset = new Set(); }
  startHeavy() { this.setState('heavy'); this.buf = null; this.hitset = new Set(); }
  swing(A) {
    if (this.t === A.a[0]) Snd.play('swing');
    const x1 = this.facing > 0 ? this.x + A.reach[0] : this.x - A.reach[1];
    const x2 = this.facing > 0 ? this.x + A.reach[1] : this.x - A.reach[0];
    return resolveAttack(this, {
      x1, x2, y: this.y, depth: A.depth || 30, z1: this.z + A.z[0], z2: this.z + A.z[1],
      dmg: A.dmg * this.dmgMul(), kbx: A.kbx, kbz: A.kbz, stun: A.stun, knock: A.knock, launch: A.launch,
      hitstop: A.hitstop, heavy: A.heavy, dir: this.facing, hitset: this.hitset,
    }, G.foeTargets());
  }
  emoteSay(icon, t = 90) { this.emote = { icon, t, max: t }; }

  update() {
    this.t++; this.anim++;
    if (this.flash > 0) this.flash--;
    if (this.invuln > 0) this.invuln--;
    if (this.slowT > 0) this.slowT--;
    if (this.emote && --this.emote.t <= 0) this.emote = null;
    const d = this.dev, play = G.phase === 'play';
    this.blocking = false;
    if (!this.dead) this.mp = Math.min(this.maxMp, this.mp + 0.07);

    if (this.state === 'dead') {
      this.physics();
      if (play && G.players.some((p) => !p.dead)) { if (--this.reviveT <= 0) this.revive(); }
      return;
    }
    if (!play && ['idle', 'walk', 'scene', 'scenewalk', 'cheer'].includes(this.state)) {
      this.sceneUpdate(); this.physics(); return;
    }
    const mx = play ? d.mx : 0, my = play ? d.my : 0;
    const spd = this.slowT > 0 ? 0.5 : 1;

    switch (this.state) {
      case 'idle': case 'walk': case 'scene': case 'scenewalk': case 'cheer':
        if (play) {
          if (d.pressed('jump')) { this.vz = 11; this.z = 0.1; this.airHits = 0; this.setState('jump'); Snd.play('jump'); FX.puff(this.x, this.y, 0, 3); break; }
          if (d.pressed('light')) { this.startAtk('l1'); break; }
          if (d.pressed('heavy')) { this.startHeavy(); break; }
          if (d.pressed('magic')) {
            if (this.mp >= MAGIC_COST) { this.mp -= MAGIC_COST; this.setState('magic'); }
            else FX.text(this.x, this.y, 100, 'NO MP', '#7fd8ff', 16, 30);
            break;
          }
          if (d.held('block')) { this.setState('block'); this.blocking = true; break; }
        }
        if (mx || my) {
          this.x += mx * PSPEED * spd; this.y += my * PSPEED_Y * spd;
          if (mx) this.facing = mx;
          this.state = 'walk';
        } else this.state = 'idle';
        break;
      case 'jump':
        this.x += mx * PSPEED * 0.95 * spd; this.y += my * PSPEED_Y * 0.6 * spd;
        if (mx) this.facing = mx;
        if (play && d.pressed('light')) { this.setState('airatk'); this.hitset = new Set(); }
        else if (play && d.pressed('heavy')) { this.setState('slam'); this.vz = 3; }
        break;
      case 'airatk': {
        this.x += mx * PSPEED * 0.8; this.y += my * PSPEED_Y * 0.5;
        const A = ATK.air;
        if (this.t >= A.a[0] && this.t <= A.a[1]) {
          if (this.swing(A) && this.airHits < 4) { this.vz = Math.max(this.vz, 3.4); this.airHits++; }
        }
        if (this.t >= A.dur) this.setState(this.z > 0 ? 'jump' : 'idle');
        break;
      }
      case 'slam':
        if (this.t > 7) this.vz = -16;
        break;
      case 'slamland': if (this.t >= 18) this.setState('idle'); break;
      case 'attack': {
        const A = ATK[this.atkName];
        if (play && this.t >= 3) { if (d.pressed('light')) this.buf = 'light'; else if (d.pressed('heavy')) this.buf = 'heavy'; }
        if (this.t >= A.a[0] && this.t <= A.a[1]) { this.x += this.facing * 1.3; this.swing(A); }
        if (this.t > A.a[1] + 1 && this.buf) {
          if (this.buf === 'light' && A.next) { this.startAtk(A.next); break; }
          if (this.buf === 'heavy') { this.startHeavy(); break; }
        }
        if (this.t >= A.dur) this.setState('idle');
        break;
      }
      case 'heavy': {
        const A = ATK.heavy;
        if (this.t === A.a[0]) { this.vz = 4; this.z = 0.1; }
        if (this.t >= A.a[0] && this.t <= A.a[1]) this.swing(A);
        if (this.t >= A.dur && this.z === 0) this.setState('idle');
        break;
      }
      case 'magic':
        if (this.t === 10) this.castMagic();
        if (this.t >= 28) this.setState('idle');
        break;
      case 'block':
        this.blocking = true;
        if (mx) this.facing = mx;
        if (!play || !d.held('block')) this.setState('idle');
        break;
      case 'hurt': if (this.t >= this.stun) this.setState('idle'); break;
      case 'down': if (this.t >= 34) { this.setState('getup'); this.invuln = 60; } break;
      case 'getup': if (this.t >= 14) this.setState('idle'); break;
    }
    this.physics();
    if (play) this.x = clamp(this.x, G.cam.x + 20, G.cam.x + W - 20);
  }
  sceneUpdate() {
    if (this.sceneTarget) {
      const tx = this.sceneTarget.x, ty = this.sceneTarget.y ?? this.y;
      const dx = tx - this.x, dy = ty - this.y, dist = Math.hypot(dx, dy);
      if (dist > 3) {
        this.x += (dx / dist) * 2.8; this.y += (dy / dist) * 2.0;
        if (Math.abs(dx) > 1) this.facing = sign(dx);
        if (this.state !== 'scenewalk') this.state = 'scenewalk';
        return;
      }
      this.sceneTarget = null;
      if (this.faceAfter) { this.facing = this.faceAfter; this.faceAfter = null; }
    }
    if (this.state !== 'cheer') this.state = 'scene';
  }
  castMagic() {
    const k = KNIGHTS[this.idx];
    Snd.play('magic');
    G.projectiles.push(new Projectile({
      x: this.x + this.facing * 56, y: this.y, z: 40, vx: this.facing * 9.5, team: 'hero', owner: this,
      kind: 'sparkle', color: k.magic, color2: k.magic2, dmg: 15 * (1 + (this.mag - 1) * 0.15),
      pierce: true, life: 75, w: 20, h: 44, hit: { kbx: 4, kbz: 5, knock: true, hitstop: 4 },
    }));
  }
  onLand() {
    switch (this.state) {
      case 'jump': case 'airatk': this.setState('idle'); Snd.play('land'); FX.puff(this.x, this.y, 0, 3); break;
      case 'slam': this.setState('slamland'); this.slamImpact(); break;
      case 'launched':
        FX.puff(this.x, this.y, 0, 5); Snd.play('land');
        if (this.dead) { this.setState('dead'); this.reviveT = 360; } else this.setState('down');
        break;
    }
  }
  slamImpact() {
    G.shake = 8; Snd.play('bighit');
    FX.ring(this.x, this.y, 0, '#fff', 85); FX.puff(this.x, this.y, 0, 10, 'rgba(255,255,255,0.8)', 4);
    resolveAttack(this, {
      x1: this.x - 100, x2: this.x + 100, y: this.y, depth: 40, z1: -10, z2: 70,
      dmg: 13 * this.dmgMul(), kbx: 5, kbz: 6.5, knock: true, hitstop: 6, dir: null, hitset: new Set(),
    }, G.foeTargets());
  }
  onHurt(src, spec, dir) {
    Snd.play('hurt');
    super.onHurt(src, spec, dir);
    // brief mercy window so two goons can't stun-lock a knight
    if (this.state === 'hurt') this.invuln = Math.max(this.invuln, 16);
  }
  die(src, spec, dir) {
    this.dead = true; this.blocking = false;
    this.vz = 7; this.z = Math.max(this.z, 0.1); this.vx = dir * 4;
    this.setState('launched');
    Snd.play('die');
    G.onPlayerDeath(this);
  }
  revive() {
    this.dead = false; this.hp = Math.ceil(this.maxHp * 0.5); this.invuln = 120;
    this.setState('getup'); FX.stars(this.x, this.y, 30, 10); Snd.play('heal');
  }
  draw(c, camX) {
    const sx = this.x - camX, sy = this.y - this.z;
    drawShadow(c, sx, this.y, 28, this.z);
    let alpha = 1;
    if (this.state === 'dead') alpha = 0.55;
    else if (this.invuln > 0 && (this.invuln >> 2) % 2) alpha = 0.45;
    withFlash(c, this.flash > 0, () => drawKnight(c, this, sx, sy, alpha));
    if (this.state === 'dead' && G.phase === 'play') {
      txt(c, String(Math.ceil(this.reviveT / 60)), sx, sy - 70, 24, '#fff');
      txt(c, 'reviving', sx, sy - 48, 13, '#ddd');
    }
    if (this.emote) {
      const k = Math.min(1, (this.emote.max - this.emote.t) / 8);
      const by = sy - 140 - Math.sin(this.anim * 0.15) * 2;
      c.save(); c.translate(sx + 22, by); c.scale(k, k);
      rrect(c, -20, -18, 40, 34, 12, '#fff', 3);
      poly(c, [[-8, 14], [-16, 26], [2, 14]], '#fff', 0);
      c.beginPath(); c.moveTo(-8, 16); c.lineTo(-16, 26); c.lineTo(2, 16); stroke(c, 3);
      c.fillStyle = '#fff'; c.fillRect(-10, 12, 14, 4);
      txt(c, this.emote.icon, 0, -1, 22, this.emote.icon === '♥' ? '#e2324a' : OUT, 'center', 0);
      c.restore();
    }
    // tiny player tag
    if (G.players.length > 1 && G.phase === 'play' && this.state !== 'dead') {
      txt(c, 'P' + (this.idx + 1), sx, sy - 132, 14, KNIGHTS[this.idx].color, 'center', 3);
    }
  }
}

// ------------------------------------------------------------
//  Goons
// ------------------------------------------------------------
const ETYPES = {
  grunt: { hp: 34, spd: 1.6, w: 20, h: 88, dmg: 6, xp: 14, gold: 2, reach: 66, wind: 21, cd: [50, 120] },
  thrower: { hp: 26, spd: 1.4, w: 20, h: 88, dmg: 8, xp: 16, gold: 2, wind: 28, cd: [110, 190] },
  brute: { hp: 120, spd: 0.95, w: 30, h: 122, dmg: 15, xp: 40, gold: 6, reach: 100, wind: 34, cd: [80, 140], scale: 1.35, poise: 4 },
  flyer: { hp: 18, spd: 2.4, w: 20, h: 52, dmg: 6, xp: 12, gold: 1, wind: 28, cd: [80, 150] },
};

class Enemy extends Actor {
  constructor(type, skin, x, y) {
    super(x, y);
    const T = this.T = ETYPES[type];
    this.type = type; this.skin = skin; this.team = 'foe';
    this.maxHp = this.hp = Math.round(T.hp * G.hpScale());
    this.w = T.w; this.h = T.h; this.scale = T.scale || 1;
    this.poise = T.poise || 0;
    this.cd = randi(30, 90); this.anim = randi(0, 100);
    this.offset = rand(-1, 1); this.retarget = 0; this.target = null;
    this.setState('enter');
    if (type === 'flyer') { this.z = 120; this.noGrav = true; this.zOff = 0; }
    if (type === 'brute') this.weight = 0.7;
  }
  get inside() { return this.x > G.cam.x + 40 && this.x < G.cam.x + W - 40; }
  pickTarget() {
    if (!this.target || this.target.dead || --this.retarget <= 0) {
      this.retarget = 90;
      let best = null, bd = 1e9;
      for (const p of G.players) { if (p.dead) continue; const d = Math.abs(p.x - this.x) + Math.abs(p.y - this.y) * 2; if (d < bd) { bd = d; best = p; } }
      this.target = best;
    }
    return this.target;
  }
  moveTo(x, y, spd) {
    const dx = x - this.x, dy = y - this.y, d = Math.hypot(dx, dy);
    if (d < 3) return false;
    const s = Math.min(spd, d);
    this.x += (dx / d) * s; this.y += (dy / d) * s * 0.8;
    return true;
  }
  update() {
    this.t++; this.anim++;
    if (this.flash > 0) this.flash--;
    if (this.invuln > 0) this.invuln--;
    if (this.showHp > 0) this.showHp--;
    switch (this.state) {
      case 'hurt': if (this.t >= this.stun) this.setState(this.type === 'flyer' ? 'rise' : 'idle'); break;
      case 'launched': break;
      case 'down': if (this.t >= 40) { this.setState('getup'); this.invuln = 20; } break;
      case 'getup': if (this.t >= 16) this.setState(this.type === 'flyer' ? 'rise' : 'idle'); break;
      case 'dying': if (this.t >= 45) this.remove = true; break;
      default: if (G.phase === 'play') this.ai(); else if (this.state === 'walk') this.state = 'idle';
    }
    this.noGrav = this.type === 'flyer' && ['enter', 'fly', 'idle', 'walk', 'windup', 'dive', 'rise'].includes(this.state);
    this.physics();
    if (this.state !== 'enter' && !this.dead) this.x = clamp(this.x, G.cam.x + 10, G.cam.x + W - 10);
  }
  ai() {
    const tgt = this.pickTarget();
    if (!tgt) { if (this.state === 'walk') this.state = 'idle'; return; }
    if (this.cd > 0) this.cd--;
    if (this.type === 'flyer') return this.aiFlyer(tgt);
    if (this.state === 'enter') {
      if (this.inside) this.setState('idle');
      else this.moveTo(clamp(this.x, G.cam.x + 80, G.cam.x + W - 80), this.y, this.T.spd * 1.3);
      return;
    }
    if (this.type === 'thrower') return this.aiThrower(tgt);
    this.aiMelee(tgt);
  }
  aiMelee(tgt) {
    const T = this.T, brute = this.type === 'brute';
    if (this.state === 'windup') {
      if (this.t >= T.wind) { this.setState('strike'); this.hitset = new Set(); Snd.play('swing'); }
      return;
    }
    if (this.state === 'strike') {
      if (this.t <= 6) {
        const x1 = this.facing > 0 ? this.x : this.x - T.reach - 10, x2 = this.facing > 0 ? this.x + T.reach + 10 : this.x;
        resolveAttack(this, {
          x1, x2, y: this.y, depth: brute ? 34 : 22, z1: 0, z2: 90, dmg: T.dmg * G.dmgScale(),
          kbx: brute ? 6 : 3, kbz: brute ? 7 : 0, knock: brute, stun: 22, hitstop: brute ? 6 : 3,
          dir: this.facing, hitset: this.hitset,
        }, G.livingPlayers());
      }
      if (brute && this.t === 2) { G.shake = Math.max(G.shake, 6); FX.puff(this.x + this.facing * 80, this.y, 0, 6); Snd.play('bighit'); }
      if (this.t >= 20) { this.setState('recover'); this.cd = randi(T.cd[0], T.cd[1]); }
      return;
    }
    if (this.state === 'recover') { if (this.t >= 16) this.setState('idle'); return; }
    const side = this.x < tgt.x ? -1 : 1;
    const canAtk = this.cd <= 0 && G.attackers() < G.maxAttackers();
    let wx, wy = tgt.y;
    if (canAtk) wx = tgt.x + side * (T.reach - 14);
    else { wx = tgt.x + side * (150 + this.offset * 50); wy = tgt.y + this.offset * 45; }
    wx = clamp(wx, G.cam.x + 30, G.cam.x + W - 30);
    wy = clamp(wy, GROUND_TOP, GROUND_BOTTOM);
    this.facing = -side;
    if (canAtk && Math.abs(tgt.x - this.x) < T.reach && Math.abs(this.y - tgt.y) < 13 && tgt.z < 70) {
      this.setState('windup'); return;
    }
    if (Math.abs(this.x - wx) > 5 || Math.abs(this.y - wy) > 4) { this.moveTo(wx, wy, T.spd * (canAtk ? 1 : 0.65)); this.state = 'walk'; }
    else this.state = 'idle';
  }
  aiThrower(tgt) {
    const T = this.T;
    if (this.state === 'windup') {
      if (this.t >= T.wind) {
        lob(this, tgt.x + tgt.vx * 10, tgt.y, SKINS[this.skin].lob, T.dmg * G.dmgScale(), 48);
        Snd.play('throw');
        this.setState('recover'); this.cd = randi(T.cd[0], T.cd[1]);
      }
      return;
    }
    if (this.state === 'recover') { if (this.t >= 20) this.setState('idle'); return; }
    const side = this.x < tgt.x ? -1 : 1;
    let wx = tgt.x + side * 250;
    if (wx < G.cam.x + 40 || wx > G.cam.x + W - 40) wx = tgt.x - side * 250;
    wx = clamp(wx, G.cam.x + 40, G.cam.x + W - 40);
    const wy = clamp(tgt.y + this.offset * 30, GROUND_TOP, GROUND_BOTTOM);
    this.facing = -side;
    if (this.cd <= 0 && Math.abs(this.x - tgt.x) > 110) { this.setState('windup'); return; }
    const close = Math.abs(this.x - tgt.x) < 100;
    if (Math.abs(this.x - wx) > 8 || Math.abs(this.y - wy) > 6) { this.moveTo(wx, wy, T.spd * (close ? 1.5 : 1)); this.state = 'walk'; }
    else this.state = 'idle';
  }
  aiFlyer(tgt) {
    const T = this.T, hover = 110;
    const side = this.x < tgt.x ? -1 : 1;
    switch (this.state) {
      case 'windup':
        this.x += Math.sin(this.t * 1.7) * 1.5;
        if (this.t >= T.wind) { this.setState('dive'); this.diveTo = { x: tgt.x, y: tgt.y }; this.hitset = new Set(); Snd.play('swing'); }
        return;
      case 'dive': {
        this.moveTo(this.diveTo.x, this.diveTo.y, 6.5);
        this.z = approach(this.z, 22, 4.5);
        this.facing = sign(this.diveTo.x - this.x) || this.facing;
        resolveAttack(this, {
          x1: this.x - 30, x2: this.x + 30, y: this.y, depth: 20, z1: this.z, z2: this.z + 50,
          dmg: T.dmg * G.dmgScale(), kbx: 3, stun: 18, dir: this.facing, hitset: this.hitset,
        }, G.livingPlayers());
        if (this.t > 40 || (Math.abs(this.x - this.diveTo.x) < 6 && this.z <= 26)) { this.setState('rise'); this.cd = randi(T.cd[0], T.cd[1]); }
        return;
      }
      case 'rise':
        this.z = approach(this.z, hover, 2.5);
        if (this.z >= hover - 1) this.setState('fly');
        return;
      default: {
        const wx = tgt.x + side * (90 + this.offset * 30) + Math.sin(this.anim * 0.05) * 20;
        this.moveTo(wx, tgt.y - 6, T.spd);
        this.z = approach(this.z, hover + Math.sin(this.anim * 0.08) * 8, 2);
        this.facing = -side;
        if (this.state === 'enter' && this.inside) this.setState('fly');
        if (this.state !== 'enter' && this.cd <= 0 && Math.abs(this.x - tgt.x) < 170) this.setState('windup');
      }
    }
  }
  onHurt(src, spec, dir) {
    if (this.type === 'brute') {
      if (this.state === 'windup' || this.state === 'strike') { this.vx = dir * 0.5; return; }
      if (!spec.knock && !spec.launch) {
        if (--this.poise > 0) { this.vx = dir * 0.8; return; }
      }
      this.poise = this.T.poise;
    }
    super.onHurt(src, spec, dir);
  }
  onLand(vz) {
    if (this.state !== 'launched') return;
    if (vz < -9 && !this.bounced) { this.vz = -vz * 0.35; this.z = 0.1; this.bounced = true; FX.puff(this.x, this.y, 0, 4); Snd.play('land'); return; }
    this.bounced = false; this.juggle = 0;
    FX.puff(this.x, this.y, 0, 6);
    this.setState(this.dead ? 'dying' : 'down');
  }
  die(src, spec, dir) {
    this.dead = true; this.noGrav = false;
    this.z = Math.max(this.z, 0.1); this.vz = Math.max(6, spec.kbz || 0); this.vx = dir * (4 + (spec.kbx || 0) * 0.4);
    this.setState('launched');
    if (src instanceof Player) { src.gainXp(this.T.xp); src.kills = (src.kills || 0) + 1; }
    G.stats.kills++;
    const n = this.T.gold + randi(0, 2);
    for (let i = 0; i < n; i++) G.pickups.push(new Pickup('coin', this.x, this.y, 30, rand(-3, 3), rand(4, 7)));
    const r = Math.random();
    if (r < 0.14) G.pickups.push(new Pickup(choice(['apple', 'broccoli']), this.x, this.y, 30, rand(-2, 2), 5));
    else if (r < 0.2) G.pickups.push(new Pickup('shake', this.x, this.y, 30, rand(-2, 2), 5));
  }
  draw(c, camX) {
    const sx = this.x - camX, sy = this.y - this.z;
    drawShadow(c, sx, this.y, 26 * this.scale, this.z);
    if (this.state === 'dying' && (this.t >> 2) % 2) return;
    withFlash(c, this.flash > 0, () => {
      if (this.type === 'flyer') drawBattery(c, this, sx, sy);
      else drawGoon(c, this, sx, sy);
    });
    if (this.state === 'windup' && this.type !== 'thrower') txt(c, '!', sx, sy - this.h - 20, 26, '#ff4040');
    if (this.showHp > 0 && !this.dead) {
      const bw = 44, by = sy - this.h - 8;
      c.fillStyle = OUT; c.fillRect(sx - bw / 2 - 2, by - 2, bw + 4, 8);
      c.fillStyle = '#ff5d5d'; c.fillRect(sx - bw / 2, by, bw * (this.hp / this.maxHp), 4);
    }
  }
}

// ------------------------------------------------------------
//  Projectiles
// ------------------------------------------------------------
class Projectile {
  constructor(o) {
    Object.assign(this, {
      id: NEXT_ID++, x: 0, y: 0, z: 30, vx: 0, vy: 0, vz: 0, grav: 0, w: 14, h: 20,
      team: 'hero', dmg: 10, life: 120, pierce: false, kind: 'sparkle', hitset: new Set(),
      rot: 0, spin: 0, t: 0, hit: {}, remove: false,
    }, o);
  }
  update() {
    this.t++; this.life--;
    this.x += this.vx; this.y += this.vy; this.z += this.vz; this.vz -= this.grav;
    this.rot += this.spin;
    if (this.kind === 'sparkle' && this.t % 2 === 0) part({ kind: 'star', x: this.x, y: this.y, z: this.z + 14, vx: -this.vx * 0.1, vz: rand(-1, 1), g: 0, life: 14, size: 5, color: this.color2 || '#fff' });
    if (this.kind === 'wave' && this.t % 3 === 0) FX.puff(this.x, this.y, 0, 1, 'rgba(200,180,160,0.7)', 1);
    const targets = this.team === 'hero' ? G.foeTargets() : G.livingPlayers();
    const n = resolveAttack(this.owner || this, Object.assign({
      x1: this.x - this.w, x2: this.x + this.w, y: this.y, depth: this.depth || 18, z1: this.z, z2: this.z + this.h,
      dmg: this.dmg, kbx: 3, stun: 18, dir: this.vx ? sign(this.vx) : null, hitset: this.hitset, hitstop: 3,
    }, this.hit), targets);
    if (n && !this.pierce) { this.remove = true; this.burst(); }
    if (this.grav && this.z <= 0) { this.z = 0; this.land(); }
    if (this.life <= 0 || this.x < G.cam.x - 200 || this.x > G.cam.x + W + 200) this.remove = true;
  }
  burst() {
    const col = { pills: '#ff9a3d', gumdrop: '#ff5d8f', gravyboat: '#8b5a2b', creampuff: '#fff4e0', vial: '#ff8c1a', pudding: '#7a4a25', paper: '#ffffff', drop: '#ff5d8f' }[this.kind] || '#fff';
    FX.drops(this.x, this.y, Math.max(this.z, 4), 8, col);
  }
  land() {
    this.remove = true;
    if (this.onLand) { this.onLand(this); return; }
    this.burst(); Snd.play('splash');
    resolveAttack(this.owner || this, {
      x1: this.x - (this.splash || 34), x2: this.x + (this.splash || 34), y: this.y, depth: 20, z1: -5, z2: 40,
      dmg: this.dmg, kbx: 3, kbz: 4, knock: !!this.knockOnLand, stun: 18, dir: null, hitset: this.hitset,
    }, this.team === 'hero' ? G.foeTargets() : G.livingPlayers());
  }
  draw(c, camX) {
    const sx = this.x - camX, sy = this.y - this.z;
    if (this.kind !== 'wave') drawShadow(c, sx, this.y, 12, this.z);
    switch (this.kind) {
      case 'sparkle': {
        c.save();
        c.fillStyle = this.color; c.globalAlpha = 0.45;
        c.beginPath(); c.arc(sx, sy - 16, 22 + Math.sin(this.t) * 3, 0, TAU); c.fill();
        c.globalAlpha = 1;
        c.translate(sx, sy - 16); c.rotate(this.t * 0.3);
        starShape(c, 0, 0, 16, 7, 4, this.color2, 3);
        c.restore();
        break;
      }
      case 'wave': {
        const d = sign(this.vx);
        c.save(); c.translate(sx, this.y); c.scale(d, 1);
        poly(c, [[-26, 0], [-8, -26], [6, -12], [14, -30], [24, 0]], this.color || '#c9b28a', 3);
        c.restore();
        break;
      }
      case 'paper': drawLobItem(c, 'paper', sx, sy - 10, Math.sin(this.t * 0.3) * 0.3, 1.4); break;
      case 'laser': break;
      default: drawLobItem(c, this.kind === 'drop' ? 'gumdrop' : this.kind, sx, sy - 10, this.rot, this.scale || 1.2);
    }
  }
}

function lob(from, tx, ty, kind, dmg, T = 50, opts = {}) {
  const z0 = opts.z0 ?? 70, g = 0.4;
  const sx = opts.x ?? from.x, sy = opts.y ?? from.y;
  ty = clamp(ty, GROUND_TOP, GROUND_BOTTOM);
  const vx = (tx - sx) / T, vy = (ty - sy) / T;
  const vz = (0.5 * g * T * T - z0) / T + g * 0.5;
  G.projectiles.push(new Projectile(Object.assign({
    x: sx, y: sy, z: z0, vx, vy, vz, grav: g, team: 'foe', kind, dmg, life: T + 40, w: 14, h: 22,
    owner: from, spin: rand(-0.3, 0.3),
  }, opts.proj || {}, { onLand: opts.onLand })));
  G.warnings.push({ x: tx, y: ty, r: opts.r || 34, life: T, max: T });
}

function shockwave(from, x, y, dir, dmg, speed = 7, color) {
  G.projectiles.push(new Projectile({
    x, y, z: 0, vx: dir * speed, team: 'foe', kind: 'wave', dmg, life: 110, w: 18, h: 30, pierce: true,
    owner: from, color, hit: { kbx: 4, kbz: 6, knock: true, hitstop: 4 },
  }));
}

// ------------------------------------------------------------
//  Pickups
// ------------------------------------------------------------
class Pickup {
  constructor(kind, x, y, z = 20, vx = 0, vz = 4) {
    this.id = NEXT_ID++; this.kind = kind; this.x = x; this.y = y; this.z = z; this.vx = vx; this.vz = vz; this.vy = rand(-1, 1);
    this.t = randi(0, 60); this.life = kind === 'coin' ? 900 : 1500; this.remove = false;
  }
  update() {
    this.t++; this.life--;
    if (this.z > 0 || this.vz > 0) {
      this.vz -= 0.4; this.z += this.vz; this.x += this.vx; this.y += this.vy;
      if (this.z <= 0) { this.z = 0; this.vz = Math.abs(this.vz) > 2 ? -this.vz * 0.4 : 0; this.vx *= 0.5; this.vy *= 0.5; }
    }
    this.y = clamp(this.y, GROUND_TOP, GROUND_BOTTOM);
    this.x = clamp(this.x, G.cam.x + 14, G.cam.x + W - 14);
    for (const p of G.players) {
      if (p.dead) continue;
      const dx = p.x - this.x, dy = p.y - this.y;
      if (this.kind === 'coin' && Math.abs(dx) < 70 && Math.abs(dy) < 40 && this.t > 20) { this.x += dx * 0.12; this.y += dy * 0.12; }
      if (Math.abs(dx) < 32 && Math.abs(dy) < 20 && this.z < 30 && this.t > 12) { this.apply(p); this.remove = true; return; }
    }
    if (this.life <= 0) this.remove = true;
  }
  apply(p) {
    switch (this.kind) {
      case 'coin': p.gold += 5; G.stats.gold += 5; Snd.play('coin'); break;
      case 'apple': p.hp = Math.min(p.maxHp, p.hp + 25); FX.text(p.x, p.y, 100, '+25', '#5fd068', 20); Snd.play('heal'); break;
      case 'broccoli': p.hp = Math.min(p.maxHp, p.hp + 45); FX.text(p.x, p.y, 100, '+45', '#5fd068', 22); Snd.play('heal'); break;
      case 'shake': p.mp = Math.min(p.maxMp, p.mp + 60); FX.text(p.x, p.y, 100, '+MP', '#7fd8ff', 20); Snd.play('heal'); break;
    }
    FX.stars(this.x, this.y, 10, 4, this.kind === 'coin' ? '#ffe066' : '#c8ff6a');
  }
  draw(c, camX) {
    if (this.life < 120 && (this.life >> 2) % 2) return;
    const sx = this.x - camX;
    drawShadow(c, sx, this.y, 10, this.z);
    drawPickup(c, this.kind, sx, this.y - this.z, this.t);
  }
}

// ------------------------------------------------------------
//  Breakable props
// ------------------------------------------------------------
class Prop extends Actor {
  constructor(kind, x, y) {
    super(x, y);
    this.kind = kind; this.team = 'prop'; this.hp = this.maxHp = 18; this.w = 24; this.h = 48;
  }
  takeHit(src, spec) {
    this.hp -= spec.dmg; this.flash = 6;
    FX.chunks(this.x, this.y, 20, 3, this.kind === 'cake' ? '#ff9ecf' : '#c08a4a');
    Snd.play('hit');
    if (this.hp <= 0) this.smash();
    return true;
  }
  smash() {
    this.dead = true; this.remove = true;
    FX.chunks(this.x, this.y, 20, 12, this.kind === 'cake' ? '#ff9ecf' : this.kind === 'meds' ? '#f2f2f2' : '#c08a4a');
    FX.puff(this.x, this.y, 10, 6);
    Snd.play('break');
    const r = Math.random();
    if (r < 0.45) for (let i = 0; i < 4; i++) G.pickups.push(new Pickup('coin', this.x, this.y, 20, rand(-3, 3), rand(4, 7)));
    else if (r < 0.7) G.pickups.push(new Pickup('apple', this.x, this.y, 20, 0, 5));
    else if (r < 0.85) G.pickups.push(new Pickup('broccoli', this.x, this.y, 20, 0, 5));
    else G.pickups.push(new Pickup('shake', this.x, this.y, 20, 0, 5));
  }
  update() { if (this.flash > 0) this.flash--; }
  draw(c, camX) {
    const sx = this.x - camX;
    drawShadow(c, sx, this.y, 26, 0);
    withFlash(c, this.flash > 0, () => drawCrate(c, sx, this.y, this.kind, this.hp / this.maxHp));
  }
}

// ------------------------------------------------------------
//  Scene actors (story characters)
// ------------------------------------------------------------
class SceneActor {
  constructor(o) {
    Object.assign(this, { x: 0, y: 400, z: 0, t: 0, facing: 1, visible: true, shadow: 24, layer: 0 }, o);
  }
  update() {
    this.t++;
    if (this.moveTo) {
      const m = this.moveTo, dx = m.x - this.x, dy = (m.y ?? this.y) - this.y, dz = (m.z ?? this.z) - this.z;
      const d = Math.hypot(dx, dy, dz);
      if (d <= m.speed) { this.x = m.x; this.y = m.y ?? this.y; this.z = m.z ?? this.z; this.moveTo = null; this.walking = false; }
      else { this.x += dx / d * m.speed; this.y += dy / d * m.speed; this.z += dz / d * m.speed; this.walking = true; if (Math.abs(dx) > 0.5 && !m.keepFacing) this.facing = sign(dx); }
    }
    if (this.upd) this.upd(this);
  }
  draw(c, camX) {
    if (!this.visible) return;
    const sx = this.x - camX, sy = this.y - this.z;
    if (this.shadow) drawShadow(c, sx, this.y, this.shadow, this.z);
    this.drawFn(c, this, sx, sy);
  }
}
