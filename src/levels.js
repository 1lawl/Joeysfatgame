'use strict';
// ============================================================
//  Levels + story scripts
//
//  Scene step types:
//   {say: speaker, text}        dialog box (J/Space to advance)
//   {wait: frames}
//   {do: (G) => {...}}          instant action
//   {until: (G, t) => bool}     wait for a condition
//   {emote: '!'}                all knights pop an emote bubble
//   {walk: x, y?}               knights walk to x (and wait)
//   {move: actor, x, y, z, speed, nowait}
//   {title: text, sub}          banner
// ============================================================

const ARENA = (len) => len - W;

// ---------- reusable actor builders ----------
function joeyActor(o = {}) {
  return Object.assign({
    name: 'joey', shadow: 30, mood: 'happy',
    drawFn: (c, a, sx, sy) => drawJoey(c, sx, sy, { t: a.t, mood: a.mood, sitting: a.sitting, munching: a.munching, cake: a.cake, walking: a.walking, slim: a.slim, facing: a.facing, scale: a.scale }),
  }, o);
}
function batActor(name, follow, dx, dz) {
  return {
    name, shadow: 0, layer: 1, z: 0,
    upd(a) { const f = G.actor(follow); if (f) { a.x = f.x + dx; a.y = f.y + 1; a.z = f.z + dz + Math.sin(a.t * 0.2 + dx) * 4; } },
    drawFn: (c, a, sx, sy) => drawBattery(c, { anim: a.t, facing: dx < 0 ? 1 : -1, state: 'fly' }, sx, sy),
  };
}
function shouter(lines, every = 300) {
  return (a) => {
    if (G.phase === 'play' && G.boss && !G.boss.dead && a.t % every === 0) a.shout = { text: choice(lines), t: 140 };
  };
}
function penFlyToPlayer(G) {
  const p = G.players[0], pen = G.actor('pen');
  if (!pen || !p) return true;
  pen.moveTo = { x: p.x, y: p.y + 1, z: 110, speed: 5 };
  return false;
}

// ============================================================
const LEVELS = [
  // ---------------------------------------------------------- PROLOGUE
  {
    key: 'prologue', name: "Joey's Apartment", world: 'Prologue', theme: 'home', music: 'story', length: W,
    segments: [],
    setup(G) {
      G.addActor({ name: 'couch', x: 640, y: 418, shadow: 0, drawFn: (c, a, sx, sy) => drawCouch(c, sx, sy) });
      G.addActor(joeyActor({ x: 640, y: 419, sitting: true, shadow: 0 }));
      G.players.forEach((p, i) => { p.x = -40 - i * 50; });
    },
    intro: [
      { title: 'Prologue', sub: "Joey's Apartment" },
      { wait: 30 },
      { say: 'narrator', text: 'Once upon a Tuesday, in the snack-scented kingdom of Lower Munchton, there lived a man named Joey.' },
      { say: 'narrator', text: 'Joey was a good guy. Joey was a loyal friend. Joey was also, at all times, extremely hungry.' },
      { walk: 400 },
      { say: 'joey', text: "FELLAS! You made it! Did you grab my GLP-1 pen from the pharmacy? Doc says it'll finally shush the Snack Goblin that lives in my brain." },
      { emote: '?' }, { wait: 50 }, { emote: '...' }, { wait: 60 },
      { say: 'joeyWorried', text: "...You forgot. Classic. No, it's cool! I'll just have one small pizza while I wait. A personal pizza. Personal for, like, eight persons." },
      { do: (G) => { G.actor('joey').munching = true; } },
      { wait: 40 },
      {
        do: (G) => {
          Snd.play('crash'); G.flags.windowBroken = true; G.shake = 14;
          FX.chunks(750, GROUND_TOP, 140, 14, '#cfe8ff');
          G.addActor({ name: 'countess', x: 1150, y: 360, z: 260, shadow: 40, facing: -1, drawFn: (c, a, sx, sy) => drawCountess(c, sx, sy, { t: a.t, throne: true, facing: -1 }) });
          [[-70, 110], [70, 110], [-40, 170], [40, 170]].forEach(([dx, dz], i) => G.addActor(batActor('bat' + i, 'countess', dx, dz)));
        },
      },
      { emote: '!' },
      { move: 'countess', x: 830, z: 70, speed: 6 },
      { do: (G) => { const j = G.actor('joey'); j.mood = 'shock'; j.munching = false; } },
      { say: 'countess', text: 'Hohoho! My Crave-O-Meter is SCREAMING! Nine thousand kilo-cravings! Such hunger! Such delicious, renewable hunger!' },
      { say: 'countess', text: "That boy's appetite will power my Adrenochrome Farms for a thousand years. And keep my skin SO dewy. Bat-teries... FETCH!" },
      { say: 'joeyWorried', text: 'Is that... bad? It sounds kind of flattering.' },
      {
        do: (G) => {
          for (let i = 0; i < 4; i++) G.actors = G.actors.filter((a) => a.name !== 'bat' + i);
          [[-90, 60], [90, 60], [-50, 90], [50, 90]].forEach(([dx, dz], i) => G.addActor(batActor('bat' + i, 'couch', dx, dz)));
          const couch = G.actor('couch'), j = G.actor('joey');
          couch.moveTo = { x: 1200, z: 320, speed: 3.2 };
          j.upd = (a) => { a.x = couch.x; a.z = couch.z; };
          G.actor('countess').moveTo = { x: 1250, z: 260, speed: 3 };
        },
      },
      { wait: 70 },
      { say: 'joeyWorried', text: 'At least let me bring the diiiiiip!' },
      { wait: 40 },
      { emote: '!' },
      { wait: 40 },
      { say: 'narrator', text: "And so our heroes set off to rescue Joey. But first: the pharmacy. You can't save a man from a craving-powered farm without the cure." },
    ],
  },

  // ---------------------------------------------------------- WORLD 1
  {
    key: 'pharmacy', name: 'Pharmacy Panic', world: 'World 1', theme: 'pharmacy', music: 'adventure', skin: 'goblin', length: 4200, crate: 'meds',
    mapNote: 'Joey: kidnapped by bats.  Pen: still at the pharmacy.',
    segments: [
      { at: 380, waves: [[['grunt', 3]], [['grunt', 2], ['thrower', 1]]] },
      { at: 1250, waves: [[['grunt', 2], ['flyer', 2]], [['brute', 1], ['grunt', 1]]] },
      { at: 2250, waves: [[['thrower', 2], ['grunt', 2]], [['grunt', 3], ['flyer', 1]], [['brute', 1], ['thrower', 1]]] },
      { at: ARENA(4200), boss: 'troll' },
    ],
    crates: [[620, 440], [670, 500], [1620, 410], [1680, 480], [2700, 430], [2760, 495]],
    setup(G) {
      G.addActor({ name: 'counter', x: ARENA(4200) + W - 130, y: GROUND_TOP - 2, layer: -1, shadow: 0, drawFn: (c, a, sx, sy) => drawPharmacyCounter(c, sx, sy) });
    },
    intro: [
      { title: 'World 1', sub: 'Pharmacy Panic' },
      { wait: 30 },
      { say: 'narrator', text: "The Lower Munchton Pharmacy. Joey's GLP-1 pen is waiting at the counter..." },
      { say: 'narrator', text: '...behind an army of Insurance Goblins. They deny everything. Even high-fives.' },
      { emote: '!' },
    ],
    bossIntro: [
      { do: (G) => G.spawnBoss('troll') },
      { until: (G) => G.boss && G.boss.arrived },
      { say: 'troll', text: 'HALT! This prescription requires PRIOR AUTHORIZATION. Please complete Form 27-B in triplicate and wait six to eight business years.' },
      { emote: '!' },
      { say: 'troll', text: 'Your claim is... DENIED!' },
      { do: (G) => G.bossCard() },
    ],
    outro: [
      { walk: ARENA(4200) + 420 },
      { do: (G) => G.addActor({ name: 'pharm', x: G.cam.x + W + 60, y: 430, facing: -1, drawFn: (c, a, sx, sy) => drawGoon(c, { skin: 'human', type: 'npc', state: a.walking ? 'walk' : 'idle', t: a.t, anim: a.t, facing: a.facing, mood: 'nice' }, sx, sy) }) },
      { move: 'pharm', x: ARENA(4200) + 620, speed: 3 },
      { say: 'pharm', text: "Phew! That troll's been sitting on your claim for six weeks. One GLP-1 pen, for Joey. APPROVED!" },
      { do: (G) => { const ph = G.actor('pharm'); G.addActor({ name: 'pen', x: ph.x, y: ph.y + 1, z: 70, shadow: 10, drawFn: (c, a, sx, sy) => drawPen(c, sx, sy, -0.5 + Math.sin(a.t * 0.1) * 0.2, 1, true, a.t) }); } },
      { until: (G) => { const pen = G.actor('pen'); if (!pen.moveTo && Math.abs(pen.x - G.players[0].x) > 4) penFlyToPlayer(G); return !pen.moveTo && Math.abs(pen.x - G.players[0].x) <= 4; } },
      { do: (G) => { G.flags.hasPen = true; Snd.play('pen'); G.showBanner('GOT THE GLP-1 PEN!', 'One click a week. Keep refrigerated.'); G.players.forEach((p) => (p.state = 'cheer')); FX.stars(G.players[0].x, G.players[0].y, 100, 16); } },
      { wait: 100 },
      { do: (G) => { G.actors = G.actors.filter((a) => a.name !== 'pen'); G.players.forEach((p) => (p.state = 'scene')); } },
      { say: 'pharm', text: "Keep it cool, one click a week, and— oh. There's a pigeon here for you." },
      { do: (G) => G.addActor({ name: 'pigeon', x: G.cam.x + W + 40, y: 420, z: 220, facing: -1, shadow: 14, drawFn: (c, a, sx, sy) => drawBird(c, sx, sy, { t: a.t, kind: 'pigeon', flying: a.z > 1, carry: 'note', facing: a.facing }) }) },
      { move: 'pigeon', x: ARENA(4200) + 500, z: 0, speed: 5 },
      { say: 'pigeon', text: "COO. Message for you. 'Joey taken to Craving Farm Number One, deep in the Whimsy Woods.' COO. Also, you have a parking ticket." },
      { emote: '!' },
      { say: 'narrator', text: 'Joey was close. Our heroes could feel it. They could practically smell the pizza.' },
    ],
  },

  // ---------------------------------------------------------- WORLD 2
  {
    key: 'woods', name: 'Whimsy Woods', world: 'World 2', theme: 'woods', music: 'adventure', skin: 'ginger', length: 4600, crate: 'cake',
    mapNote: 'Rumored location: Craving Farm #1, deep in the Whimsy Woods.',
    segments: [
      { at: 400, waves: [[['grunt', 3], ['flyer', 1]], [['grunt', 2], ['thrower', 2]]] },
      { at: 1300, waves: [[['brute', 1], ['grunt', 2]], [['thrower', 2], ['flyer', 2]]] },
      { at: 2250, waves: [[['grunt', 4]], [['brute', 1], ['thrower', 1], ['flyer', 1]]] },
      { at: 3000, waves: [[['grunt', 3], ['thrower', 2]], [['brute', 2]]] },
      { at: ARENA(4600), boss: 'golem' },
    ],
    crates: [[700, 430], [760, 490], [1700, 420], [2600, 470], [2660, 410], [3400, 450]],
    setup(G) {
      const x = ARENA(4600) + W - 150;
      G.addActor(joeyActor({
        name: 'cage', x, y: GROUND_TOP - 2, layer: -1, shadow: 0, open: 0, shoutH: 250,
        drawFn: (c, a, sx, sy) => { if (a.gone) { drawCage(c, sx, sy, { open: 1 }); return; } drawJoey(c, sx, sy - 10, { t: a.t, mood: a.mood, cake: a.cake, scale: a.scale || 1 }); drawCage(c, sx, sy, { open: a.open }); },
        upd: shouter(['Over here, buddy!', 'Hit him in the gumdrops!', 'It smells like frosting in here!', "I'm fine! Totally fine!"]),
      }));
    },
    intro: [
      { title: 'World 2', sub: 'Whimsy Woods' },
      { wait: 30 },
      { say: 'narrator', text: 'Craving Farm #1, hidden deep in the Whimsy Woods, where the trees are lollipops and the guards are baked goods.' },
      { say: 'narrator', text: 'Somewhere past those candy canes, Joey awaits.' },
    ],
    bossIntro: [
      { do: (G) => G.spawnBoss('golem') },
      { until: (G) => G.boss && G.boss.arrived },
      { say: 'joey', text: "BUDDY! Over here! In the cage! Watch out, that big cookie is NOT gluten free!" },
      { say: 'golem', text: 'RRRAAAGH! NOBODY TOUCHES THE CRAVING BATTERY! GOLEM IS FRESHLY BAKED AND VERY, VERY CRUMBLY!' },
      { do: (G) => G.bossCard() },
    ],
    outro: [
      { walk: ARENA(4600) + W - 330 },
      { say: 'joey', text: "You did it! Quick, open the cage and hit me with that pen!" },
      { until: (G) => { const a = G.actor('cage'); a.open = Math.min(1, a.open + 0.02); return a.open >= 1; } },
      { wait: 20 },
      { say: 'narrator', text: 'But as our heroes stepped closer, something smelled... frosted.' },
      { emote: '?' },
      { do: (G) => { const a = G.actor('cage'); a.cake = true; FX.stars(a.x, a.y, 80, 14, '#ff9ecf'); Snd.play('poof'); } },
      { wait: 40 },
      { say: 'cake', text: 'Thank you, heroes! But your Joey is in another farm!' },
      { emote: '...' },
      { do: (G) => G.addActor({ name: 'squirrel', x: G.cam.x - 40, y: GROUND_TOP + 6, shadow: 14, drawFn: (c, a, sx, sy) => drawSquirrel(c, sx, sy, { t: a.t, walking: a.walking, munching: a.munching, facing: a.facing }) }) },
      { move: 'squirrel', x: ARENA(4600) + W - 210, speed: 6 },
      { do: (G) => { G.actor('squirrel').munching = true; } },
      { until: (G, t) => { const a = G.actor('cage'); a.scale = Math.max(0.05, 1 - t / 90); if (t % 10 === 0) { Snd.play('talk'); FX.chunks(a.x, a.y, 60, 2, '#ff9ecf'); } return t > 90; } },
      { do: (G) => { G.actor('cage').gone = true; } },
      { say: 'squirrel', text: "*munch munch* The real one's on the Gravy Barge, downriver. *munch* Good frosting, though." },
      { say: 'narrator', text: 'Closer. They were definitely getting closer.' },
    ],
  },

  // ---------------------------------------------------------- WORLD 3
  {
    key: 'lagoon', name: 'Gravy Lagoon', world: 'World 3', theme: 'lagoon', music: 'sky', skin: 'pirate', length: 4800, crate: 'barrel',
    mapNote: 'Rumored location: the Gravy Barge. (The real Joey this time?)',
    segments: [
      { at: 400, waves: [[['grunt', 3], ['thrower', 1]], [['grunt', 2], ['flyer', 2]]] },
      { at: 1300, waves: [[['brute', 1], ['thrower', 2]], [['grunt', 4]]] },
      { at: 2200, waves: [[['flyer', 3], ['grunt', 1]], [['brute', 1], ['grunt', 2]], [['thrower', 3]]] },
      { at: 3100, waves: [[['brute', 2], ['grunt', 1]], [['grunt', 3], ['flyer', 2]]] },
      { at: ARENA(4800), boss: 'gravy' },
    ],
    crates: [[700, 430], [760, 490], [1700, 420], [2600, 470], [2660, 410], [3500, 450], [3560, 500]],
    setup(G) {
      G.addActor({
        name: 'wheel', x: ARENA(4800) + W - 140, y: GROUND_TOP - 4, layer: -1, shadow: 0, hasJoey: true, shoutH: 240,
        drawFn: (c, a, sx, sy) => drawPaddleWheel(c, sx, sy, a.t, a.hasJoey ? { mood: a.mood || 'worried' } : null),
        upd: shouter(['BUDDY! Down here! Well, up here!', "I'm getting dizzy!", 'Hit him with the ladle! No wait, he HAS the ladle!', "It's really me this time!"]),
      });
    },
    intro: [
      { title: 'World 3', sub: 'Gravy Lagoon' },
      { wait: 30 },
      { say: 'narrator', text: "The Gravy Barge: a floating buffet where Joey's cravings turn a giant paddle wheel. Its crew? Gravy Pirates. Its cargo? Mostly gravy." },
    ],
    bossIntro: [
      { do: (G) => G.spawnBoss('gravy') },
      { until: (G) => G.boss && G.boss.arrived },
      { say: 'joey', text: "BUDDY! It's me! The REAL me! I checked, zero frosting!" },
      { say: 'gravy', text: "Yarr! That lad's appetite be turnin' me wheel! Ye'll take him over me ladle's dead body! Which is to say: never! Ladles can't die!" },
      { do: (G) => G.bossCard() },
    ],
    outro: [
      { walk: ARENA(4800) + W - 340 },
      { say: 'joey', text: 'You came! You actually came! Through a woods made of CANDY! Do you know how hard that would have been for me?!' },
      { emote: '♥' },
      { wait: 30 },
      {
        do: (G) => {
          const w = G.actor('wheel');
          G.addActor({ name: 'balloon', x: w.x - 8, y: w.y + 2, z: 600, shadow: 0, layer: -1, drawFn: (c, a, sx, sy) => drawBalloon(c, sx, sy, a.t) });
          Snd.play('roar');
        },
      },
      { move: 'balloon', z: 175, speed: 6 },
      { do: (G) => { G.actor('wheel').mood = 'shock'; } },
      { say: 'countess', text: "Hohoho! Did you really think I'd keep my best battery on a BOAT? To the Cloud Creamery!" },
      {
        do: (G) => {
          const w = G.actor('wheel'), b = G.actor('balloon');
          w.hasJoey = false;
          G.addActor(joeyActor({ x: w.x, y: w.y + 3, z: 64, mood: 'shock', shadow: 0, layer: -1, upd: (a) => { a.x = b.x - 8; a.z = b.z - 111; } }));
          b.moveTo = { x: b.x + 500, z: 700, speed: 2.2 };
          G.camTarget = null;
        },
      },
      { wait: 40 },
      { say: 'joeyWorried', text: 'I could SMELL the pen! Does the pen smell? It smells like HOPE, buddy!' },
      { wait: 30 },
      { emote: '!' },
      { say: 'narrator', text: 'So close! Up, up and away went Joey. Our heroes would simply have to go up, too.' },
    ],
  },

  // ---------------------------------------------------------- WORLD 4
  {
    key: 'clouds', name: 'Cloud Creamery', world: 'World 4', theme: 'clouds', music: 'sky', skin: 'cherub', length: 4800, crate: 'cake',
    mapNote: 'Last seen: dangling from a balloon over the Cloud Creamery.',
    segments: [
      { at: 400, waves: [[['grunt', 3], ['flyer', 2]], [['thrower', 2], ['grunt', 2]]] },
      { at: 1300, waves: [[['brute', 1], ['flyer', 2]], [['grunt', 3], ['thrower', 1]]] },
      { at: 2200, waves: [[['flyer', 4]], [['brute', 2], ['thrower', 1]]] },
      { at: 3100, waves: [[['grunt', 4], ['thrower', 2]], [['brute', 1], ['flyer', 2], ['grunt', 2]]] },
      { at: ARENA(4800), boss: 'wyrm' },
    ],
    crates: [[700, 430], [1650, 420], [1700, 490], [2600, 470], [3500, 450], [3560, 500]],
    setup(G) {
      G.addActor(joeyActor({
        name: 'joey', x: ARENA(4800) + W - 140, y: GROUND_TOP - 2, z: 170, layer: -1, shadow: 0, mood: 'wave', shoutH: 150,
        drawFn: (c, a, sx, sy) => { drawCloudPlatform(c, sx, sy + 6, a.t); if (!a.gone) drawJoey(c, sx, sy, { t: a.t, mood: a.mood, facing: -1 }); },
        upd: shouter(['Up here, buddy!', 'Watch the jiggle!', 'This cloud tastes like whipped cream. I checked.', "Don't let it spit on you!"]),
      }));
    },
    intro: [
      { title: 'World 4', sub: 'Cloud Creamery' },
      { wait: 30 },
      { say: 'narrator', text: 'High above the world floats the Cloud Creamery, where clouds are whipped daily and the cherubs are paid in sprinkles.' },
    ],
    bossIntro: [
      { do: (G) => G.spawnBoss('wyrm') },
      { until: (G) => G.boss && G.boss.arrived },
      { say: 'joey', text: "Up here, buddy! Careful, that pudding's been sitting out since the Renaissance!" },
      { say: 'wyrm', text: 'SSSLURRRP... Who dares disturb my jiggle? I shall wobble you into OBLIVION!' },
      { do: (G) => G.bossCard() },
    ],
    outro: [
      { move: 'joey', z: 0, speed: 3 },
      { do: (G) => { G.actor('joey').mood = 'cheer'; } },
      { walk: ARENA(4800) + W - 300 },
      { say: 'joey', text: 'This is it! THIS is the moment! Hit me with that sweet, sweet satiety!' },
      { do: (G) => { const p = G.players[0]; p.state = 'cheer'; G.addActor({ name: 'pen', x: p.x + 4, y: p.y + 1, z: 120, shadow: 0, drawFn: (c, a, sx, sy) => drawPen(c, sx, sy, -0.6, 1, true, a.t) }); Snd.play('pen'); } },
      { wait: 50 },
      { do: (G) => G.addActor({ name: 'magpie', x: G.cam.x - 60, y: 430, z: 320, facing: 1, shadow: 12, layer: 1, drawFn: (c, a, sx, sy) => drawBird(c, sx, sy, { t: a.t, kind: 'magpie', flying: true, carry: a.carry, facing: a.facing }) }) },
      { do: (G) => { const pen = G.actor('pen'); G.actor('magpie').moveTo = { x: pen.x, y: pen.y + 1, z: pen.z, speed: 9 }; } },
      { until: (G) => !G.actor('magpie').moveTo },
      { do: (G) => { G.actors = G.actors.filter((a) => a.name !== 'pen'); const m = G.actor('magpie'); m.carry = 'pen'; G.flags.hasPen = false; Snd.play('squawk'); m.moveTo = { x: G.cam.x + W + 200, z: 400, speed: 6 }; G.players.forEach((p) => { p.state = 'scene'; }); } },
      { say: 'magpie', text: 'SHINY! SHINY SHINY! Mine! The Countess pays in shinies!' },
      { emote: '!' },
      {
        do: (G) => {
          const j = G.actor('joey'); j.mood = 'shock';
          [[-50, 120], [50, 120]].forEach(([dx, dz], i) => G.addActor(batActor('bat' + i, 'joey', dx, dz)));
          j.moveTo = { x: j.x + 400, z: 600, speed: 3, keepFacing: true };
          j.layer = 1;
        },
      },
      { say: 'joeyWorried', text: 'Did... did a bird just steal my medicine? This is the worst Tuesday of my LIFE.' },
      { wait: 30 },
      { say: 'narrator', text: 'The pen was gone. Joey was gone. There was only one place left to go: the Adrenochrome Refinery itself.' },
    ],
  },

  // ---------------------------------------------------------- WORLD 5
  {
    key: 'refinery', name: 'The Adrenochrome Refinery', world: 'World 5', theme: 'refinery', music: 'factory', skin: 'trooper', length: 5200, crate: 'tank',
    mapNote: 'Location: the Adrenochrome Refinery.  Pen: stolen by a bird.',
    segments: [
      { at: 400, waves: [[['grunt', 3], ['thrower', 1]], [['brute', 1], ['flyer', 2]]] },
      { at: 1300, waves: [[['grunt', 4], ['thrower', 1]], [['brute', 2], ['thrower', 1]]] },
      { at: 2200, waves: [[['flyer', 3], ['thrower', 2]], [['grunt', 3], ['brute', 1]], [['grunt', 2], ['flyer', 2], ['thrower', 1]]] },
      { at: 3100, waves: [[['brute', 2], ['grunt', 2]], [['thrower', 3], ['flyer', 2]]] },
      { at: 3800, waves: [[['grunt', 4], ['brute', 1]], [['brute', 2], ['thrower', 2], ['flyer', 1]]] },
      { at: ARENA(5200), boss: 'mech' },
    ],
    crates: [[700, 430], [1650, 420], [1700, 490], [2600, 470], [3500, 450], [3560, 500], [4100, 420]],
    setup(G) {
      G.addActor({
        name: 'tank', x: ARENA(5200) + W / 2 + 200, y: GROUND_TOP - 3, layer: -1, shadow: 0, shoutH: 270,
        drawFn: (c, a, sx, sy) => drawJoeyTank(c, sx, sy, a.t, { off: G.flags.powerDown, open: a.open, mood: a.mood, scale: 0.84 }),
        upd: shouter(["I'm in the big tube!", 'Nine hours on this treadmill!', 'Get the bird! The BIRD has the pen!', 'So... hungry...']),
      });
    },
    intro: [
      { title: 'World 5', sub: 'The Adrenochrome Refinery' },
      { wait: 30 },
      { say: 'narrator', text: "The Adrenochrome Refinery. Here, Joey's cravings are squeezed into glowing orange juice that keeps Countess Krome forever fabulous." },
      { say: 'narrator', text: 'This is it. No more cakes. No more balloons. No more birds. Probably.' },
    ],
    bossIntro: [
      { do: (G) => G.spawnBoss('mech') },
      { until: (G) => G.boss && G.boss.arrived },
      { say: 'joeyWorried', text: "Buddy! I'm in the big tube! I've been on this treadmill for nine hours and I'm STARVING, which I'm told is the whole point!" },
      { say: 'countess', text: 'YOU AGAIN?! Sir Snatchington, guard the pen! Behold my masterpiece... the GIGGLE JUICER 9000!' },
      { say: 'magpie', text: 'Shiny!' },
      { do: (G) => G.bossCard() },
    ],
    outro: [
      {
        do: (G) => {
          const x = G.flags.bossX ?? G.cam.x + W - 200;
          G.flags.penRecovered = true;
          G.addActor({ name: 'magpie', x, y: 420, z: 200, facing: 1, shadow: 12, layer: 1, drawFn: (c, a, sx, sy) => drawBird(c, sx, sy, { t: a.t, kind: 'magpie', flying: true, facing: a.facing }) });
          G.addActor({ name: 'pen', x, y: 421, z: 190, shadow: 10, drawFn: (c, a, sx, sy) => drawPen(c, sx, sy, a.t * 0.2, 1, true, a.t) });
          G.actor('pen').moveTo = { x: x - 60, z: 0, speed: 4 };
          G.actor('magpie').moveTo = { x: x + 600, z: 500, speed: 5 };
          Snd.play('squawk');
        },
      },
      { say: 'magpie', text: 'Not shiny! NOT SHINY! *flaps away forever*' },
      { until: (G) => { const pen = G.actor('pen'); if (!pen.moveTo && Math.abs(pen.x - G.players[0].x) > 4) penFlyToPlayer(G); return !pen.moveTo && Math.abs(pen.x - G.players[0].x) <= 4; } },
      { do: (G) => { G.actors = G.actors.filter((a) => a.name !== 'pen'); G.flags.hasPen = true; Snd.play('pen'); G.showBanner('GOT THE PEN BACK!', 'For real this time.'); } },
      { wait: 60 },
      { walk: ARENA(5200) + W / 2 + 40 },
      { do: (G) => { const t = G.actor('tank'); t.open = true; t.mood = 'cheer'; Snd.play('poof'); FX.puff(t.x, t.y, 60, 14, 'rgba(255,200,140,0.8)', 4); } },
      { wait: 30 },
      { say: 'joey', text: 'Buddy... you came all this way. Through goblins. Gingerbread. Gravy. Pudding. For ME.' },
      { emote: '♥' },
      { say: 'joey', text: "Okay. I'm ready. Do the thing." },
      {
        do: (G) => {
          const t = G.actor('tank'), p = G.players[0];
          G.addActor({ name: 'pen', x: p.x, y: t.y + 2, z: 110, shadow: 0, layer: 1, drawFn: (c, a, sx, sy) => drawPen(c, sx, sy, -0.3, 1.2, true, a.t) });
          G.actor('pen').moveTo = { x: t.x - 30, z: 70, speed: 4 };
        },
      },
      { until: (G) => !G.actor('pen').moveTo },
      { do: (G) => { Snd.play('pen'); G.flashT = 40; FX.stars(G.actor('tank').x, G.actor('tank').y, 80, 30, '#8fe3ff'); G.actors = G.actors.filter((a) => a.name !== 'pen'); G.actor('tank').mood = 'blissful'; } },
      { wait: 70 },
      { say: 'joeyBliss', text: '...Huh.' },
      { say: 'joeyBliss', text: "Guys. The Snack Goblin. He's... quiet. I don't want a snack. I want... a SALAD? Who AM I?!" },
      { do: (G) => { G.flags.powerDown = true; Snd.play('powerdown'); G.shake = 10; Snd.music('ending'); } },
      { wait: 70 },
      {
        do: (G) => {
          const x = G.flags.bossX ?? G.cam.x + W - 200;
          G.addActor({ name: 'countessOld', x: x + 80, y: 440, facing: -1, shadow: 30, drawFn: (c, a, sx, sy) => drawCountess(c, sx, sy, { t: a.t, aged: 1, facing: -1 }) });
          FX.puff(x + 80, 440, 20, 10, 'rgba(120,110,130,0.8)');
        },
      },
      { say: 'countessOld', text: "No... NO! My adrenochrome! Without his cravings, my eternal youth is... I'm AGING! I'm practically forty-five!" },
      { say: 'joeyBliss', text: 'Lady, you look fine. Have you tried drinking water and going for walks?' },
      { say: 'countessOld', text: '...Walks?' },
      { do: (G) => { G.players.forEach((p) => (p.state = 'cheer')); G.actor('tank').mood = 'cheer'; } },
      { wait: 90 },
      { say: 'narrator', text: 'And so Joey was saved. The farms went dark, the Countess took up mall-walking, and our heroes finally got some sleep.' },
    ],
  },
];

const MAP_NODES = [
  { x: 110, y: 400, name: "Joey's Place" },
  { x: 255, y: 270, name: 'Pharmacy' },
  { x: 410, y: 390, name: 'Whimsy Woods' },
  { x: 560, y: 250, name: 'Gravy Lagoon' },
  { x: 705, y: 370, name: 'Cloud Creamery' },
  { x: 855, y: 220, name: 'Refinery' },
];
