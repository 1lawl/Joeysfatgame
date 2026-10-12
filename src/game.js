'use strict';
// ============================================================
//  Game: state machine, scenes, waves, camera, HUD, menus
// ============================================================

const PARAMS = new URLSearchParams(location.search);

class Scene {
  constructor(steps, done) { this.steps = steps || []; this.i = 0; this.t = 0; this.dialog = null; this.done = done; this.finished = false; }
  next() { this.i++; this.t = 0; this.dialog = null; }
  skipAll() {
    for (; this.i < this.steps.length; this.i++) {
      const s = this.steps[this.i];
      if (s.do) s.do(G);
      else if (s.title) G.showBanner(s.title, s.sub);
      else if (s.move) {
        const a = G.actor(s.move);
        if (a) { if (s.x !== undefined) a.x = s.x; if (s.y !== undefined) a.y = s.y; if (s.z !== undefined) a.z = s.z; a.moveTo = null; }
      } else if (s.walk !== undefined) G.walkPlayers(s.walk, s.y, true);
    }
    this.dialog = null;
  }
  update() {
    if (anyPressed('magic') && this.steps.some((s) => s.say)) this.skipAll();
    while (this.i < this.steps.length) {
      const s = this.steps[this.i];
      if (s.do) { s.do(G); this.i++; this.t = 0; continue; }
      if (s.title) { G.showBanner(s.title, s.sub); this.i++; continue; }
      if (s.emote) { G.players.forEach((p) => { if (!p.dead) p.emoteSay(s.emote, s.t || 80); }); this.i++; continue; }
      if (s.wait !== undefined) { if (++this.t >= s.wait) this.next(); return; }
      if (s.say) {
        if (!this.dialog) this.dialog = { who: s.say, text: s.text, shown: 0 };
        const d = this.dialog;
        this.t++;
        if (d.shown < d.text.length) { d.shown = Math.min(d.text.length, d.shown + 1.3); if (this.t % 4 === 0 && d.text[Math.floor(d.shown)] !== ' ') Snd.play('talk'); }
        if (this.t > 6 && anyPressed('light', 'jump', 'start')) {
          if (d.shown < d.text.length) d.shown = d.text.length; else { Snd.play('select'); this.next(); }
        }
        return;
      }
      if (s.walk !== undefined) {
        if (this.t++ === 0) G.walkPlayers(s.walk, s.y);
        if ((this.t > 2 && G.players.every((p) => !p.sceneTarget)) || this.t > 420) this.next();
        return;
      }
      if (s.move) {
        const a = G.actor(s.move);
        if (this.t++ === 0 && a) a.moveTo = { x: s.x ?? a.x, y: s.y, z: s.z, speed: s.speed || 3, keepFacing: s.keepFacing };
        if (!a || !a.moveTo || s.nowait) this.next();
        else if (this.t > 600) this.next();
        return;
      }
      if (s.until) { if (s.until(G, this.t++) || this.t > 900) this.next(); return; }
      this.i++;
    }
    if (!this.finished) {
      this.finished = true;
      G.phase = 'play'; G.scene = null;
      G.players.forEach((p) => { if (['scene', 'scenewalk', 'cheer'].includes(p.state)) p.setState('idle'); p.sceneTarget = null; });
      if (this.done) this.done();
    }
  }
}

const G = {
  mode: 'title', t: 0, frame: 0,
  players: [], enemies: [], props: [], pickups: [], projectiles: [], actors: [], hazards: [], warnings: [], timers: [],
  boss: null, cam: { x: 0 }, camTarget: null, locked: false, lockX: 0,
  levelIdx: 0, level: null, phase: 'play', scene: null,
  segIdx: 0, waveIdx: 0, spawnQ: [], spawnT: 0, goT: 0,
  shake: 0, hitstop: 0, slowmo: 0, flashT: 0, banner: null, flags: {},
  stats: { kills: 0, gold: 0, damage: 0, time: 0 }, snapshots: [], paused: false,
  joined: [], map: null, menuT: 0, credits: null, god: PARAMS.has('god'),

  // ---------- queries used by entities ----------
  hpScale() { return (1 + 0.14 * Math.max(0, this.levelIdx - 1)) * (1 + 0.35 * (this.players.length - 1)); },
  dmgScale() { return 1 + 0.1 * Math.max(0, this.levelIdx - 1); },
  livingPlayers() { return this.players.filter((p) => !p.dead); },
  foeTargets() {
    const out = this.enemies.filter((e) => !e.dead);
    if (this.boss && !this.boss.dead && this.boss.state !== 'intro') out.push(this.boss);
    for (const p of this.props) if (!p.dead) out.push(p);
    return out;
  },
  attackers() { return this.enemies.filter((e) => !e.dead && (e.state === 'windup' || e.state === 'strike') && (e.type === 'grunt' || e.type === 'brute')).length; },
  maxAttackers() { return Math.max(1, this.livingPlayers().length); },
  actor(name) { return this.actors.find((a) => a.name === name); },
  addActor(o) { const a = new SceneActor(o); this.actors.push(a); return a; },
  after(n, fn) { this.timers.push({ n, fn }); },
  showBanner(text, sub, t = 150) { this.banner = { text, sub, t, max: t }; },

  // ---------- flow ----------
  startGame() {
    this.players = this.joined.map((dev, i) => new Player(i, dev));
    if (this.god) this.players.forEach((p) => (p.dmgTaken = 0));
    this.stats = { kills: 0, gold: 0, damage: 0, time: 0 };
    this.flags = {};
    this.loadLevel(0);
  },
  loadLevel(i, atBoss = false) {
    const L = this.level = LEVELS[i];
    if (!atBoss) this.checkpoint = null;
    this.levelIdx = i; this.mode = 'world'; this.phase = 'play'; this.scene = null; this.paused = false;
    this.enemies = []; this.props = []; this.pickups = []; this.projectiles = []; this.actors = []; this.hazards = []; this.warnings = []; this.timers = [];
    PARTS.length = 0;
    this.boss = null; this.cam.x = 0; this.camTarget = null; this.locked = false; this.segIdx = 0; this.waveIdx = 0; this.spawnQ = []; this.goT = 0;
    this.shake = 0; this.hitstop = 0; this.slowmo = 0; this.banner = null; this.deadT = 0;
    this.flags = { hasPen: this.flags.hasPen, penRecovered: this.flags.penRecovered };
    this.snapshots = this.players.map((p) => p.snapshot());
    this.players.forEach((p, k) => { p.fullReset(); p.x = 110 + k * 45 - (k % 2) * 20; p.y = 400 + (k % 2) * 50 + (k > 1 ? 25 : 0); p.facing = 1; });
    (L.crates || []).forEach(([x, y]) => this.props.push(new Prop(L.crate || 'crate', x, y)));
    if (L.setup) L.setup(this);
    Snd.music(L.music);
    if (atBoss) {
      // restart right at the boss arena; the arena lock (and boss intro) triggers next frame
      this.segIdx = L.segments.length - 1;
      const at = L.segments[this.segIdx].at;
      this.cam.x = at; this.props = [];
      this.players.forEach((p, k) => { p.x = at + 120 + k * 50; });
      return;
    }
    const afterIntro = () => { if (!L.segments.length) this.completeLevel(); };
    if (L.intro) this.startScene(L.intro, afterIntro); else afterIntro();
  },
  retryLevel() {
    const cp = this.checkpoint && this.checkpoint.level === this.levelIdx ? this.checkpoint : null;
    this.players.forEach((p, i) => p.restore(cp ? cp.snaps[i] : this.snapshots[i]));
    if (cp) this.flags.hasPen = cp.hasPen;
    this.loadLevel(this.levelIdx, !!cp);
  },
  completeLevel() {
    if (this.levelIdx >= LEVELS.length - 1) this.startCredits();
    else this.goMap(this.levelIdx + 1);
  },
  goMap(i) { this.mode = 'map'; this.map = { to: i, t: 0 }; Snd.music('title'); },
  startScene(steps, done) { this.phase = 'scene'; this.scene = new Scene(steps, done); },
  walkPlayers(x, y, instant) {
    this.players.forEach((p, i) => {
      const tx = x - i * 62, ty = (y ?? 410) + (i % 2) * 44 + (i > 1 ? 18 : 0);
      if (p.dead) { p.dead = false; p.hp = Math.ceil(p.maxHp * 0.5); p.setState('idle'); p.z = 0; }
      if (instant) { p.x = tx; p.y = ty; p.sceneTarget = null; p.facing = 1; }
      else { p.sceneTarget = { x: tx, y: ty }; p.faceAfter = 1; }
    });
  },
  spawnEnemy(type, side) {
    if (side == null) side = this.cam.x < 40 ? 1 : Math.random() < 0.5 ? -1 : 1;
    const x = side > 0 ? this.cam.x + W + 40 + rand(0, 40) : this.cam.x - 40 - rand(0, 40);
    const y = rand(GROUND_TOP + 10, GROUND_BOTTOM - 10);
    const e = new Enemy(type, this.level.skin || 'goblin', x, y);
    e.facing = -side;
    this.enemies.push(e);
    return e;
  },
  spawnBoss(key) {
    const b = new Boss(key, this.cam.x + W + 160, (GROUND_TOP + GROUND_BOTTOM) / 2 + 10);
    b.introX = this.cam.x + W - 230;
    this.boss = b;
    Snd.play('roar'); this.shake = 8;
  },
  bossCard() {
    const b = this.boss; if (!b) return;
    b.setState('idle'); b.rest = 40; b.arrived = true;
    this.showBanner(b.D.name, b.D.title, 170);
    Snd.music('boss');
  },
  onBossDefeated(b) {
    this.flags.bossX = b.x;
    this.boss = null;
    this.after(50, () => {
      for (const e of this.enemies) if (!e.dead) e.die(null, { kbz: 6 }, sign(e.x - b.x));
      this.projectiles = []; this.warnings = []; this.hazards = [];
      for (const p of this.players) { if (p.dead) { p.dead = false; p.setState('idle'); p.z = 0; } p.hp = Math.max(p.hp, Math.ceil(p.maxHp * 0.5)); }
      Snd.music(this.levelIdx === LEVELS.length - 1 ? 'story' : 'story');
      this.startScene(this.level.outro, () => this.completeLevel());
    });
  },
  onPlayerDeath() {
    if (this.players.every((p) => p.dead)) this.after(110, () => { if (this.players.every((p) => p.dead)) { this.mode = 'gameover'; this.menuT = 0; Snd.music('story'); } });
  },
  startCredits() { this.mode = 'credits'; this.credits = { t: 0 }; Snd.music('ending'); },

  // ---------- update ----------
  update() {
    this.frame++;
    if (tapped('KeyM')) Snd.toggleMute();
    switch (this.mode) {
      case 'title': return this.updateTitle();
      case 'lobby': return this.updateLobby();
      case 'map': return this.updateMap();
      case 'world': return this.updateWorld();
      case 'gameover': return this.updateGameOver();
      case 'credits': return this.updateCredits();
    }
  },
  updateTitle() {
    this.menuT++;
    if (this.menuT < 20) return;
    for (const d of DEVICES) {
      if (d.pressed('start') || d.pressed('light') || d.pressed('jump')) {
        Snd.unlock(); Snd.play('select');
        this.joined = [d]; this.mode = 'lobby'; this.menuT = 0; Snd.music('title');
        return;
      }
    }
  },
  updateLobby() {
    this.menuT++;
    if (this.menuT < 12) return;
    for (const d of DEVICES) {
      const j = this.joined.includes(d);
      if (!j && d.pressed('light') && this.joined.length < 4) { this.joined.push(d); Snd.play('select'); continue; }
      if (j && (d.pressed('start') || d.pressed('jump'))) { Snd.play('select'); this.startGame(); return; }
      if (j && d.pressed('magic')) {
        this.joined = this.joined.filter((x) => x !== d);
        if (!this.joined.length) { this.mode = 'title'; this.menuT = 0; }
        return;
      }
    }
  },
  updateMap() {
    this.map.t++;
    if (this.map.t > 60 && anyPressed('light', 'jump', 'start')) { Snd.play('select'); this.loadLevel(this.map.to); }
  },
  updateGameOver() {
    this.menuT++;
    if (this.menuT < 60) return;
    if (anyPressed('light', 'jump', 'start')) { Snd.play('select'); this.retryLevel(); }
    else if (tapped('Escape')) { this.mode = 'title'; this.menuT = 0; Snd.music('title'); }
  },
  updateCredits() {
    this.credits.t++;
    if (this.credits.t > 200 && anyPressed('light', 'jump', 'start')) {
      if (this.credits.t < 1640) this.credits.t = 1640;
      else if (this.credits.t > 1700) { this.mode = 'title'; this.menuT = 0; this.flags = {}; Snd.music('title'); }
    }
  },
  updateWorld() {
    if (tapped('Escape') || tapped('KeyP')) { this.paused = !this.paused; Snd.play('select'); }
    if (this.paused) {
      if (tapped('KeyQ')) { this.paused = false; this.mode = 'title'; this.menuT = 0; this.flags = {}; Snd.music('title'); }
      return;
    }
    this.shake = this.shake > 0.5 ? this.shake * 0.86 : 0;
    if (this.flashT > 0) this.flashT--;
    if (this.banner && --this.banner.t <= 0) this.banner = null;
    if (this.hitstop > 0) { this.hitstop--; return; }
    if (this.slowmo > 0) { this.slowmo--; if (this.slowmo % 3 !== 0) return; }
    this.worldStep();
  },
  worldStep() {
    if (this.phase === 'play') this.stats.time++;
    for (const p of this.players) p.update();
    for (const e of this.enemies) e.update();
    this.separate();
    if (this.boss) this.boss.update();
    for (const p of this.props) p.update();
    for (const p of this.pickups) p.update();
    for (const p of this.projectiles) p.update();
    for (const a of this.actors) { a.update(); if (a.shout && --a.shout.t <= 0) a.shout = null; }
    updateParts();
    for (const h of this.hazards) {
      h.life--;
      for (const p of this.players) if (!p.dead && p.z < 5 && Math.abs(p.x - h.x) < h.r && Math.abs(p.y - h.y) < h.r * 0.35) p.slowT = 8;
    }
    for (const w of this.warnings) w.life--;
    this.enemies = this.enemies.filter((e) => !e.remove);
    this.props = this.props.filter((e) => !e.remove);
    this.pickups = this.pickups.filter((e) => !e.remove);
    this.projectiles = this.projectiles.filter((e) => !e.remove);
    this.hazards = this.hazards.filter((h) => h.life > 0);
    this.warnings = this.warnings.filter((w) => w.life > 0);
    if (this.boss && this.boss.remove) this.boss = null;
    for (let i = this.timers.length - 1; i >= 0; i--) { const tm = this.timers[i]; if (--tm.n <= 0) { this.timers.splice(i, 1); tm.fn(); } }
    this.updateCamera();
    if (this.phase === 'play') this.updateWaves();
    else if (this.scene) this.scene.update();
    if (this.goT > 0) this.goT--;
  },
  separate() {
    const E = this.enemies;
    for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
      const a = E[i], b = E[j];
      if (a.dead || b.dead || a.type === 'flyer' || b.type === 'flyer') continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) < 34 && Math.abs(dy) < 14) {
        const push = (34 - Math.abs(dx)) * 0.07 * (dx < 0 ? -1 : 1) || 0.6;
        a.x -= push; b.x += push; a.y -= (dy < 0 ? -0.3 : 0.3); b.y += (dy < 0 ? -0.3 : 0.3);
      }
    }
  },
  updateCamera() {
    const L = this.level, maxX = Math.max(0, L.length - W);
    if (this.camTarget != null) { this.cam.x = approach(this.cam.x, this.camTarget, 5); return; }
    if (this.locked) { this.cam.x = approach(this.cam.x, this.lockX, 6); return; }
    if (this.phase !== 'play') return;
    const alive = this.livingPlayers(); if (!alive.length) return;
    const avg = alive.reduce((s, p) => s + p.x, 0) / alive.length;
    const seg = L.segments[this.segIdx];
    const limit = Math.min(seg ? seg.at : maxX, maxX);
    let target = clamp(avg - W * 0.42, this.cam.x, limit);
    target = Math.min(target, Math.min(...alive.map((p) => p.x)) - 30);
    if (target > this.cam.x) this.cam.x = approach(this.cam.x, target, 8);
  },
  updateWaves() {
    const L = this.level, seg = L.segments[this.segIdx];
    if (!seg) return;
    if (!this.locked) {
      if (this.cam.x >= seg.at - 1) {
        this.locked = true; this.lockX = seg.at; this.waveIdx = 0; this.goT = 0;
        if (seg.boss) {
          this.checkpoint = { level: this.levelIdx, snaps: this.players.map((p) => p.snapshot()), hasPen: this.flags.hasPen };
          this.startScene(L.bossIntro, () => {});
        }
        else this.queueWave(seg.waves[0]);
      }
      return;
    }
    if (this.spawnQ.length && --this.spawnT <= 0) { this.spawnEnemy(this.spawnQ.shift()); this.spawnT = 24; }
    if (seg.boss) return;
    const alive = this.enemies.filter((e) => !e.dead).length;
    if (!this.spawnQ.length && alive === 0) {
      this.waveIdx++;
      if (this.waveIdx < seg.waves.length) this.queueWave(seg.waves[this.waveIdx]);
      else { this.locked = false; this.segIdx++; this.goT = 220; Snd.play('go'); }
    }
  },
  queueWave(w) {
    const q = [];
    for (const [type, n] of w) for (let i = 0; i < n; i++) q.push(type);
    for (let i = q.length - 1; i > 0; i--) { const j = randi(0, i); [q[i], q[j]] = [q[j], q[i]]; }
    this.spawnQ = q; this.spawnT = 30;
  },

  // ---------- render ----------
  render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.lineJoin = 'round';
    switch (this.mode) {
      case 'title': drawTitle(); break;
      case 'lobby': drawLobby(); break;
      case 'map': drawMap(); break;
      case 'world': drawWorld(); break;
      case 'gameover': drawWorld(); drawGameOver(); break;
      case 'credits': drawCredits(); break;
    }
    if (this.flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flashT / 40})`; ctx.fillRect(0, 0, W, H); }
  },
};

// ============================================================
//  World rendering
// ============================================================
function speechBubble(c, x, y, text) {
  c.font = `14px ${FONT}`;
  const w = c.measureText(text).width + 22;
  const bx = clamp(x - w / 2, 8, W - w - 8);
  rrect(c, bx, y - 34, w, 30, 10, '#fff', 3);
  c.beginPath(); c.moveTo(x - 8, y - 6); c.lineTo(x, y + 8); c.lineTo(x + 8, y - 6); fill(c, '#fff'); stroke(c, 3);
  c.fillStyle = '#fff'; c.fillRect(x - 7, y - 9, 14, 5);
  txt(c, text, bx + w / 2, y - 19, 14, OUT, 'center', 0);
}

function drawWorld() {
  const c = ctx, L = G.level, camX = Math.round(G.cam.x);
  c.save();
  if (G.shake > 0) c.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake) * 0.6);
  BG[L.theme](c, camX, G.frame, L);
  // ground hazards & telegraphs
  for (const h of G.hazards) {
    c.globalAlpha = Math.min(1, h.life / 40) * 0.85;
    ell(c, h.x - camX, h.y, h.r, h.r * 0.35, '#8b5a2b', 0);
    c.fillStyle = 'rgba(255,220,160,0.4)'; c.beginPath(); c.ellipse(h.x - camX - h.r * 0.3, h.y - 3, h.r * 0.3, 3, 0, 0, TAU); c.fill();
    c.globalAlpha = 1;
  }
  for (const w of G.warnings) {
    const k = 1 - w.life / w.max;
    c.save();
    c.strokeStyle = `rgba(255,50,50,${0.4 + 0.5 * Math.abs(Math.sin(G.frame * 0.3))})`; c.lineWidth = 3;
    c.beginPath(); c.ellipse(w.x - camX, w.y, w.r, w.r * 0.35, 0, 0, TAU); c.stroke();
    c.fillStyle = 'rgba(255,50,50,0.18)'; c.beginPath(); c.ellipse(w.x - camX, w.y, w.r * k, w.r * 0.35 * k, 0, 0, TAU); c.fill();
    c.restore();
  }
  const list = [...G.actors, ...G.props, ...G.pickups, ...G.enemies, ...G.players, ...G.projectiles];
  if (G.boss) list.push(G.boss);
  list.sort((a, b) => (a.layer || 0) - (b.layer || 0) || a.y - b.y);
  for (const e of list) e.draw(c, camX);
  for (const a of G.actors) if (a.shout && a.visible) speechBubble(c, a.x - camX, a.y - a.z - (a.shoutH || 150), a.shout.text);
  drawParts(c, camX);
  c.restore();

  if (G.phase === 'play' || G.mode === 'gameover') drawHUD(c);
  else drawHUD(c, true);
  if (G.scene && G.scene.dialog) drawDialog(c, G.scene.dialog);
  if (G.phase === 'scene' && G.scene && G.scene.steps.some((s) => s.say)) txt(c, 'J / Space: next     L: skip scene', W - 12, H - 9, 12, 'rgba(255,255,255,0.8)', 'right', 3);
  if (G.levelIdx === 1 && G.phase === 'play' && G.stats.time < 1200 && !G.paused && !G.boss) {
    c.save(); c.globalAlpha = clamp((1200 - G.stats.time) / 60, 0, 1);
    rrect(c, W / 2 - 330, H - 44, 660, 34, 12, 'rgba(29,18,38,0.8)', 3);
    txt(c, 'J attack   K launcher   Space jump   L magic   Shift block   Esc help', W / 2, H - 27, 16, '#fff', 'center', 3);
    c.restore();
  }
  if (G.banner) drawBanner(c, G.banner);
  if (G.paused) drawPause(c);
}

function bar(c, x, y, w, h, k, col, back = '#2a1a36') {
  rrect(c, x, y, w, h, h / 2, back, 3);
  if (k > 0) { rr(c, x + 1.5, y + 1.5, Math.max(h - 3, (w - 3) * clamp(k, 0, 1)), h - 3, (h - 3) / 2); c.fillStyle = col; c.fill(); }
  c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(x + h / 2, y + 2.5, Math.max(0, (w - h) * clamp(k, 0, 1)), 2);
}

function drawHUD(c, dim = false) {
  c.save();
  if (dim) c.globalAlpha = 0.5;
  G.players.forEach((p, i) => {
    const k = KNIGHTS[p.idx], x = 8 + i * 238, y = 8;
    rrect(c, x, y, 228, 66, 14, 'rgba(29,18,38,0.78)', 3);
    circ(c, x + 33, y + 33, 25, k.color, 3);
    drawKnightHead(c, x + 34, y + 37, k, 15);
    if (p.dead) txt(c, '✖', x + 33, y + 33, 30, '#ff5d5d');
    txt(c, `P${i + 1}`, x + 64, y + 13, 14, k.color, 'left', 3);
    txt(c, `Lv ${p.lvl}`, x + 94, y + 13, 14, '#fff', 'left', 3);
    // gold
    ell(c, x + 158, y + 13, 6, 6, '#ffd23f', 2);
    txt(c, String(p.gold), x + 168, y + 13, 14, '#ffe066', 'left', 3);
    bar(c, x + 62, y + 24, 156, 15, p.hp / p.maxHp, p.hp / p.maxHp < 0.3 ? '#ff4d4d' : '#ff6b6b');
    txt(c, `${Math.ceil(p.hp)}/${p.maxHp}`, x + 140, y + 32, 11, '#fff', 'center', 3);
    bar(c, x + 62, y + 42, 120, 11, p.mp / p.maxMp, '#5fb8ff');
    c.fillStyle = '#ffe066'; c.fillRect(x + 64, y + 56, 150 * (p.xp / p.xpNeed()), 3);
  });
  if (G.flags.hasPen) {
    const x = W - 64, y = G.players.length >= 4 ? 100 : 40;
    rrect(c, x - 50, y - 26, 104, 52, 12, 'rgba(29,18,38,0.78)', 3);
    drawPen(c, x, y - 6, -0.25, 0.9, true, G.frame);
    txt(c, 'GLP-1', x, y + 15, 12, '#8fe3ff', 'center', 3);
  }
  c.restore();
  // boss bar
  const b = G.boss;
  if (b && b.state !== 'intro' && !dim) {
    const bw = 520, bx = W / 2 - bw / 2, by = H - 40;
    txt(c, b.D.name, W / 2, by - 12, 18, '#fff', 'center', 4);
    bar(c, bx, by, bw, 18, b.hp / b.maxHp, b.phase === 2 ? '#ff4040' : '#c58cff');
  }
  // GO arrow
  if (G.goT > 0 && G.phase === 'play' && !G.locked && (G.goT >> 4) % 2 === 0) {
    txt(c, 'GO!', W - 120, H / 2 - 20, 44, '#ffe066');
    poly(c, [[W - 80, H / 2 - 44], [W - 30, H / 2 - 20], [W - 80, H / 2 + 4]], '#ffe066', 4);
  }
}

function drawDialog(c, d) {
  const x = 20, y = H - 150, w = W - 40, h = 132;
  rrect(c, x, y, w, h, 18, 'rgba(255,248,232,0.97)', 4);
  drawPortrait(c, d.who, x + 62, y + 66, G.frame);
  const sp = SPEAKERS[d.who] || { name: d.who, color: '#fff' };
  c.font = `18px ${FONT}`;
  const nw = c.measureText(sp.name).width + 28;
  rrect(c, x + 116, y - 16, nw, 30, 10, '#2d1846', 3);
  txt(c, sp.name, x + 116 + nw / 2, y - 1, 18, sp.color, 'center', 3);
  const lines = wrapText(c, d.text, w - 150, 20);
  let shown = Math.floor(d.shown);
  c.fillStyle = OUT; c.font = `20px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'top';
  lines.forEach((ln, i) => {
    if (shown <= 0) return;
    const part = ln.slice(0, shown);
    shown -= ln.length + 1;
    c.fillText(part, x + 118, y + 26 + i * 26);
  });
  if (d.shown >= d.text.length && (G.frame >> 4) % 2 === 0) txt(c, '▼', x + w - 28, y + h - 22, 18, '#e2324a', 'center', 3);
}

function drawBanner(c, b) {
  const k = b.max - b.t, inK = clamp(k / 14, 0, 1), outK = clamp(b.t / 20, 0, 1);
  c.save();
  c.globalAlpha = outK;
  c.translate(W / 2, 150);
  const s = easeOut(inK) * (1 + (1 - inK) * 0.5);
  c.scale(s, s);
  c.fillStyle = 'rgba(29,18,38,0.55)'; c.fillRect(-W, -46, W * 2, b.sub ? 96 : 70);
  txt(c, b.text, 0, -8, 46, '#ffe066', 'center', 9);
  if (b.sub) txt(c, b.sub, 0, 34, 22, '#fff', 'center', 5);
  c.restore();
}

function controlsList(c, x, y, size = 15) {
  const rows = [
    ['', 'P1 KEYS', 'P2 KEYS', 'GAMEPAD'],
    ['Move', 'W A S D', 'Arrows', 'Stick / D-pad'],
    ['Attack', 'J', ',  or Num1', 'X'],
    ['Heavy / Launch', 'K', '.  or Num2', 'Y'],
    ['Jump', 'Space', '/  or Num0', 'A'],
    ['Magic', 'L', ';  or Num3', 'B'],
    ['Block', 'I / L-Shift', "'  or NumEnter", 'Bumpers'],
  ];
  const cols = [0, 170, 300, 450];
  rows.forEach((r, i) => r.forEach((cell, j) => txt(c, cell, x + cols[j], y + i * (size + 9), size, i === 0 ? '#ffe066' : j === 0 ? '#ffd1e8' : '#fff', 'left', 3)));
}

function drawPause(c) {
  c.fillStyle = 'rgba(15,8,25,0.75)'; c.fillRect(0, 0, W, H);
  txt(c, 'PAUSED', W / 2, 90, 56, '#ffe066', 'center', 8);
  controlsList(c, W / 2 - 290, 170, 17);
  txt(c, 'Combos: J J J  ·  J J K (launcher)  ·  launch, then Jump + J to juggle  ·  Jump + K = ground slam', W / 2, 380, 15, '#c8ff6a', 'center', 3);
  txt(c, 'Esc / P: resume     Q: quit to title     M: mute', W / 2, 440, 18, '#fff', 'center', 4);
}

// ============================================================
//  Menus
// ============================================================
function menuBackdrop(c) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a1240'); g.addColorStop(0.55, '#a8327a'); g.addColorStop(1, '#ff9a3d');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 50; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + hash(i) * 0.5})`; c.fillRect(hash(i * 3) * W, hash(i * 7) * 260, 2, 2); }
  c.fillStyle = '#3a1a48';
  for (let i = 0; i < 9; i++) {
    const x = i * 120 - 20, h = 90 + hash(i + 40) * 120;
    c.fillRect(x, H - 120 - h, 100, h + 120);
    c.fillStyle = 'rgba(255,140,26,0.6)';
    for (let k = 0; k < 4; k++) if (hash(i * 9 + k) > 0.4) c.fillRect(x + 14 + (k % 2) * 44, H - 100 - h + Math.floor(k / 2) * 34, 14, 10);
    c.fillStyle = '#3a1a48';
  }
  c.fillStyle = '#24102e'; c.fillRect(0, H - 70, W, 70);
}

function fakeKnight(idx, state = 'idle', t = G.frame) { return { idx, state, t, anim: t + idx * 13, facing: 1 }; }

function drawTitle() {
  const c = ctx, f = G.frame;
  menuBackdrop(c);
  drawJoeyTank(c, 760, H - 68, f, {});
  for (let i = 0; i < 4; i++) drawKnight(c, fakeKnight(i, 'idle'), 90 + i * 70, H - 70 + (i % 2) * 8);
  c.save(); c.translate(W / 2 - 60, 120); c.rotate(-0.04 + Math.sin(f * 0.03) * 0.01);
  txt(c, 'CRAVING', 0, -30, 84, '#ffe066', 'center', 14);
  txt(c, 'CRASHERS', 0, 50, 84, '#ff9a3d', 'center', 14);
  c.restore();
  txt(c, "The Quest for Joey's GLP-1", W / 2 - 60, 210, 26, '#fff', 'center', 6);
  drawPen(c, 110, 250, -0.5 + Math.sin(f * 0.05) * 0.1, 1.2, true, f);
  if ((f >> 5) % 2 === 0) txt(c, 'Press  ENTER  /  J  /  START', W / 2 - 60, 300, 28, '#fff', 'center', 6);
  txt(c, '1-4 players  ·  keyboard + gamepads  ·  M: mute', W / 2 - 60, 340, 16, '#ffd1e8', 'center', 4);
}

function drawLobby() {
  const c = ctx, f = G.frame;
  menuBackdrop(c);
  c.fillStyle = 'rgba(20,10,30,0.55)'; c.fillRect(0, 0, W, H);
  txt(c, 'CHOOSE YOUR KNIGHTS', W / 2, 52, 44, '#ffe066', 'center', 8);
  for (let i = 0; i < 4; i++) {
    const x = 40 + i * 225, y = 92;
    const dev = G.joined[i];
    rrect(c, x, y, 205, 200, 16, dev ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.3)', 3);
    if (dev) {
      drawKnight(c, fakeKnight(i, (f >> 6) % 3 === 0 ? 'cheer' : 'idle'), x + 102, y + 160);
      txt(c, KNIGHTS[i].name, x + 102, y + 24, 20, KNIGHTS[i].color, 'center', 4);
      txt(c, dev.label, x + 102, y + 182, 13, '#fff', 'center', 3);
    } else {
      txt(c, `P${i + 1}`, x + 102, y + 60, 34, 'rgba(255,255,255,0.4)', 'center', 4);
      if ((f >> 5) % 2 === 0) txt(c, 'Press ATTACK', x + 102, y + 110, 18, '#fff', 'center', 4);
      txt(c, 'to join', x + 102, y + 136, 15, '#ddd', 'center', 3);
    }
  }
  controlsList(c, 200, 330, 15);
  if ((f >> 5) % 2 === 0) txt(c, 'Press JUMP or START to begin!', W / 2, 504, 26, '#ffe066', 'center', 6);
  txt(c, 'Magic button: leave', W - 14, H - 10, 12, '#ddd', 'right', 3);
}

function drawMap() {
  const c = ctx, m = G.map, f = G.frame;
  c.fillStyle = '#2a1640'; c.fillRect(0, 0, W, H);
  rrect(c, 24, 20, W - 48, H - 40, 20, '#f3e2b8', 5);
  c.fillStyle = 'rgba(160,110,60,0.12)';
  for (let i = 0; i < 30; i++) { c.beginPath(); c.arc(hash(i) * W, hash(i + 5) * H, 20 + hash(i + 9) * 40, 0, TAU); c.fill(); }
  txt(c, 'THE ROAD TO JOEY', W / 2, 62, 40, '#e2324a', 'center', 7);
  // dotted path
  c.save(); c.setLineDash([2, 12]); c.lineCap = 'round'; c.strokeStyle = '#7a4a28'; c.lineWidth = 6;
  c.beginPath(); MAP_NODES.forEach((n, i) => (i ? c.lineTo(n.x, n.y) : c.moveTo(n.x, n.y))); c.stroke(); c.restore();
  MAP_NODES.forEach((n, i) => {
    const done = i < m.to, cur = i === m.to;
    const r = cur ? 26 + Math.sin(f * 0.15) * 3 : 22;
    circ(c, n.x, n.y, r, done ? '#5fd068' : cur ? '#ffd23f' : '#c8b088', 4);
    txt(c, done ? '✓' : String(i), n.x, n.y + 1, 22, done ? '#fff' : OUT, 'center', 0);
    txt(c, n.name, n.x, n.y + 42, 16, '#5a3a22', 'center', 0);
    if (i > m.to) txt(c, 'Joey?', n.x, n.y - 40, 14, '#a07050', 'center', 0);
  });
  // knight token travelling
  const a = MAP_NODES[m.to - 1], b = MAP_NODES[m.to];
  const k = easeInOut(clamp(m.t / 90, 0, 1));
  const tx = lerp(a.x, b.x, k), ty = lerp(a.y, b.y, k) - 40 - Math.abs(Math.sin(k * Math.PI * 4)) * 12;
  circ(c, tx, ty, 18, KNIGHTS[0].color, 3); drawKnightHead(c, tx + 1, ty + 3, KNIGHTS[0], 12);
  // Joey icon at the destination
  if (m.t > 90) { c.save(); c.translate(b.x + 46, b.y + 4); c.scale(0.35, 0.35); drawJoey(c, 0, 0, { t: f, mood: 'worried' }); c.restore(); }
  const L = LEVELS[m.to];
  rrect(c, 120, 440, W - 240, 72, 14, 'rgba(45,24,70,0.9)', 4);
  txt(c, `${L.world}: ${L.name}`, W / 2, 462, 24, '#ffe066', 'center', 5);
  txt(c, L.mapNote || '', W / 2, 492, 15, '#fff', 'center', 3);
  if (m.t > 60 && (f >> 5) % 2 === 0) txt(c, 'Press ATTACK to continue', W - 40, 40, 14, '#7a4a28', 'right', 0);
}

function drawGameOver() {
  const c = ctx;
  c.fillStyle = `rgba(15,5,20,${Math.min(0.8, G.menuT / 60)})`; c.fillRect(0, 0, W, H);
  if (G.menuT < 20) return;
  txt(c, 'DEFEATED!', W / 2, 150, 72, '#ff5d5d', 'center', 10);
  txt(c, 'Joey is still hungry...', W / 2, 220, 26, '#fff', 'center', 5);
  drawJoey(c, W / 2, 400, { t: G.frame, mood: 'worried', scale: 0.9 });
  const atBoss = G.checkpoint && G.checkpoint.level === G.levelIdx;
  if (G.menuT > 60 && (G.frame >> 5) % 2 === 0) txt(c, `ATTACK: retry ${atBoss ? 'boss' : 'level'}     Esc: title`, W / 2, 470, 22, '#ffe066', 'center', 5);
}

const CREDIT_LINES = [
  ['THE END', 60, '#ffe066'],
  ['', 20],
  ['Joey lost 80 pounds and took up competitive pickleball.', 20, '#fff'],
  ['The Countess now leads a 6 AM mall-walking club.', 20, '#fff'],
  ['She is extremely punctual.', 20, '#fff'],
  ['Sir Snatchington runs a successful pen recycling program.', 20, '#fff'],
  ['The Prior Authorization Troll is still reviewing your claim.', 20, '#fff'],
  ['The squirrel is fine. Better than fine.', 20, '#fff'],
  ['Joey still owes you for the pizza.', 20, '#fff'],
  ['', 30],
  ['CRAVING CRASHERS', 40, '#ff9a3d'],
  ['a whimsical beat-em-up for Joey', 18, '#ffd1e8'],
];

function drawCredits() {
  const c = ctx, cr = G.credits, t = cr.t, f = G.frame;
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3a1a6a'); g.addColorStop(0.6, '#ff7a5a'); g.addColorStop(1, '#ffd27a');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#fff1a8'; c.beginPath(); c.arc(W / 2, 330, 90, Math.PI, 0); c.fill();
  c.fillStyle = '#5a3a6a';
  for (let i = 0; i < 12; i++) { c.beginPath(); c.arc(((i * 140 - t * 0.3) % (W + 280) + W + 280) % (W + 280) - 140, 340, 90 + hash(i) * 40, Math.PI, 0); c.fill(); }
  c.fillStyle = '#6cc552'; c.fillRect(0, 330, W, H - 330);
  c.fillStyle = 'rgba(60,120,40,0.5)';
  for (let x = -((t * 2) % 60); x < W; x += 60) c.fillRect(x, 360, 20, 4);
  const slim = clamp(t / 900, 0, 1);
  const n = G.players.length || 1;
  for (let i = 0; i < n; i++) drawKnight(c, fakeKnight(i, 'walk', t), 220 + i * 60, 440 + (i % 2) * 14);
  drawJoey(c, 520, 452, { t, mood: 'cheer', walking: true, slim });
  // scrolling text, above the horizon
  let y = 330 - t * 0.6;
  c.save(); c.beginPath(); c.rect(0, 0, W, 322); c.clip();
  for (const [s, size, col] of CREDIT_LINES) {
    if (s && y > -40 && y < 360) {
      c.globalAlpha = clamp(y / 60, 0, 1) * clamp((330 - y) / 40, 0, 1);
      txt(c, s, W / 2, y, size, col, 'center', Math.max(4, size * 0.18));
    }
    y += size + 22;
  }
  c.restore();
  const st = G.stats;
  if (t > 1450) {
    const k = clamp((t - 1450) / 30, 0, 1);
    c.save(); c.globalAlpha = k;
    rrect(c, W / 2 - 230, 60, 460, 170, 16, 'rgba(29,18,38,0.85)', 4);
    txt(c, 'QUEST STATS', W / 2, 88, 26, '#ffe066', 'center', 5);
    const mins = Math.floor(st.time / 3600), secs = Math.floor(st.time / 60) % 60;
    txt(c, `Goons bonked: ${st.kills}     Gold: ${st.gold}`, W / 2, 126, 18, '#fff', 'center', 3);
    txt(c, `Damage dealt: ${st.damage}     Time: ${mins}m ${String(secs).padStart(2, '0')}s`, W / 2, 156, 18, '#fff', 'center', 3);
    txt(c, G.players.map((p) => `P${p.idx + 1} Lv ${p.lvl}`).join('    '), W / 2, 190, 18, '#c8ff6a', 'center', 3);
    c.restore();
  }
  if (t > 1640) {
    speechBubble(c, 520, 312, 'Guys... my refill is due next week.');
    if (t > 1700 && (f >> 5) % 2 === 0) txt(c, 'Press ATTACK to return to title', W / 2, 520, 18, '#fff', 'center', 4);
  }
}

// ============================================================
//  Main loop
// ============================================================
(function boot() {
  if (PARAMS.has('level')) {
    G.joined = [DEVICES[0]];
    const n = clamp(parseInt(PARAMS.get('level'), 10) || 0, 0, LEVELS.length - 1);
    G.players = G.joined.map((dev, i) => new Player(i, dev));
    if (G.god) G.players.forEach((p) => (p.dmgTaken = 0));
    if (n >= 5) G.flags.hasPen = false; else if (n >= 2) G.flags.hasPen = true;
    G.loadLevel(n);
  }
  if (PARAMS.has('credits')) { G.joined = [DEVICES[0]]; G.players = [new Player(0, DEVICES[0])]; G.startCredits(); }
  const STEP = 1000 / 60, SPEED = clamp(+PARAMS.get('speed') || 1, 0.25, 8);
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(100, now - last) * SPEED; last = now;
    while (acc >= STEP) { pollInput(); G.update(); acc -= STEP; }
    G.render();
    requestAnimationFrame(frame);
  }
  window.G = G;
  requestAnimationFrame(frame);
})();
