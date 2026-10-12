# Craving Crashers: The Quest for Joey's GLP-1

A whimsical, Castle Crashers–style 2D beat 'em up for 1–4 players.

Joey is a good guy with a big appetite. So big that Countess Adrena Krome has
kidnapped him to power her Adrenochrome Farms with his cravings. Your knights
have to grab Joey's GLP-1 pen and get it to him. Every time you get close,
something goes wrong and Joey ends up somewhere else.

## Play

No build step and no dependencies. Open `index.html` in a browser.

You can also serve the folder (`python3 -m http.server`) and open
`http://localhost:8000`.

## Controls

| Action           | P1 keys       | P2 keys             | Gamepad       |
|------------------|---------------|---------------------|---------------|
| Move             | W A S D       | Arrows              | Stick / D-pad |
| Attack           | J             | `,` or Num1         | X             |
| Heavy / Launcher | K             | `.` or Num2         | Y             |
| Jump             | Space         | `/` or Num0         | A             |
| Magic            | L             | `;` or Num3         | B             |
| Block            | I / L-Shift   | `'` or NumEnter     | Bumpers       |

`Esc`/`P` pauses, `M` mutes. In cutscenes, Attack/Jump advances the dialog
and Magic skips the scene.

**Combos:** `J J J` (the finisher knocks enemies down) · `J J K` (launcher) ·
launch an enemy, then jump and press `J` repeatedly to juggle it ·
`Space` then `K` does a ground slam.

Each knight levels up from XP, which raises their health, magic, and damage.
Smash crates for apples, broccoli, and protein shakes. If a knight goes down
in co-op, they revive after a few seconds as long as someone is still standing.

## The worlds

| # | World                     | Boss                       | Where Joey actually is |
|---|---------------------------|----------------------------|------------------------|
| 0 | Joey's Apartment          | —                          | Carried off by bats, couch and all |
| 1 | Pharmacy Panic            | Prior Authorization Troll  | You get the pen, then a pigeon arrives with news |
| 2 | Whimsy Woods              | Gingerbread Golem          | It's a cake. "Your Joey is in another farm!" |
| 3 | Gravy Lagoon              | Captain Gravybeard         | Hooked by a balloon and lifted into the sky |
| 4 | Cloud Creamery            | The Pudding Wyrm           | A magpie steals the pen |
| 5 | The Adrenochrome Refinery | Giggle Juicer 9000         | Finally! |

## Code layout

Everything is drawn procedurally on a `<canvas>` and all audio is synthesized
with WebAudio, so the game has no asset files.

- `src/engine.js` – canvas setup, math helpers, keyboard/gamepad input, synth sfx and music, particles
- `src/art.js` – character drawing (knights, goons, Joey, the Countess, props)
- `src/backgrounds.js` – parallax backgrounds for each world
- `src/entities.js` – combat resolution, players, enemies, projectiles, pickups
- `src/bosses.js` – the pattern-driven `Boss` class and the five boss definitions
- `src/levels.js` – level layouts, enemy waves, and every cutscene script
- `src/game.js` – state machine, camera, waves, HUD, menus, world map, credits

### Debug URL parameters

- `?level=N` – jump straight into level N (0–5) with one keyboard player
- `?god` – players take no damage
- `?speed=4` – run the simulation faster
- `?credits` – jump to the ending
