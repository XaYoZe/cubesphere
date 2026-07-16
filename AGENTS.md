# AGENTS.md

## Repo layout

- `cubesphere/` — the entire project: a zero-build web game (voxel sandbox + factory automation). Open `cubesphere/index.html` directly in a browser; `file://` works because Three.js is vendored at `cubesphere/lib/three.min.js` (r128, UMD) and all art/audio is generated at runtime.
- No package.json, no bundler, no CI. Plain ES5/ES2020 scripts.

## Architecture (non-obvious)

- **No modules.** All JS files are classic `<script>` tags sharing globals, loaded in a strict order defined in `index.html`: `noise → blocks → items → textures → audio → world → player → machines → sky → ui → main`. New files must be added to that list in dependency order; don't introduce `import`/`export`.
- Globals by file: `B`/`BLOCKS` (blocks.js), `ITEMS`/`RECIPES`/`TECHS`/`QUESTS` (items.js), `TEX`/`ICONS` (textures.js), `Sfx` (audio.js), `UI` (ui.js), `window.game` (main.js). `machines.js`/`sky.js` reference `window.game` lazily inside update loops — safe only because `game` is assigned before the first frame.
- All textures are canvas-painted into one atlas (`TEX`, 8×8 tiles of 16px). Block `tex` arrays in blocks.js are atlas tile indices; crack overlay stages start at index 32 (`TEX.crackBase`). Item icons are pixel-art string grids in `ICONS.art`.
- All audio is procedural WebAudio in `Sfx` — never add media files. `Sfx.init()` must run inside a user-gesture handler.
- Machines are NOT chunk voxels: the block grid stores `B.MACHINE` while `MachineSystem` keeps the real entity + Three.js model. Removing a machine must go through `MachineSystem.remove`, not `world.setBlock` alone.
- Facing convention everywhere: `0=+z(南) 1=+x(东) 2=-z(北) 3=-x(西)`; machine models are built front-facing `+z` and rotated `facing * PI/2`. Player yaw→facing uses the `map = [2,3,0,1]` table in `main.js tryPlace`.
- Save = single localStorage key `cubesphere_save`, versioned via `v: 2`. Bump `v` when changing the save shape (old saves are silently discarded by `loadGame`).

## Verify / test

- Syntax check: `node --check cubesphere\js\<file>.js` (Node is available).
- Runtime smoke tests run headless Edge via puppeteer-core from `C:\Users\Yang\AppData\Local\Temp\opencode` (`smoke_runner.js`, `pixel_runner.js`, `shot_runner.js` live there, not in the repo). Launch args that matter: `--enable-unsafe-swiftshader --autoplay-policy=no-user-gesture-required --allow-file-access-from-files`; executable `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`.
- Plain `msedge --headless --dump-dom` produces empty output on this machine — use puppeteer-core instead.
- Pointer lock throws in headless; all `requestPointerLock` calls must stay wrapped (see `Game.relock`). This model cannot view screenshots — verify rendering by `gl.readPixels` sampling (see `pixel_runner.js`) rather than screenshot inspection.

## Conventions

- UI text is Simplified Chinese; keep new player-facing strings in Chinese.
- All assets must remain original/procedural — do not download or embed third-party game assets.
- Class-body methods (Game, World, …) have no trailing commas; `UI`/`Sfx`/`TEX` are object literals and do. Mixing these up has caused syntax errors before.
