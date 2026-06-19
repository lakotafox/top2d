// split-engine.mjs — one-time: cut src/game/20-engine.js (clean, un-escaped) into ordered
// feature modules under src/game/engine/, on === SECTION === boundaries. Pure line slicing.
// Concatenation (join '\n') must equal 20-engine.js byte-for-byte.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const text = readFileSync(resolve(ROOT, 'src/game/20-engine.js'), 'utf8');
const L = text.split('\n');
const N = L.length;

const starts = [
  [1,     '00-canvas-livesync.js'],     // canvas/ctx, resize, loading, connectToBuilderSync, applyLiveEdit, UI toggles
  [86,    '05-quest-runtime.js'],       // QUEST SYSTEM RUNTIME (inside applyLiveEdit region start marker)
  [1100,  '10-quest-functions.js'],     // QUEST SYSTEM FUNCTIONS
  [1516,  '15-8dir-movement.js'],       // 8-DIRECTION MOVEMENT (test-game copy)
  [1574,  '20-init-combat.js'],         // initGame, warmup, image-load, damage/death, dropItems, attack hitbox
  [2640,  '25-usable-items-fishing.js'],// USABLE ITEMS / ABILITIES + FISHING + projectiles
  [2855,  '30-multiplayer.js'],         // MULTIPLAYER SYSTEM
  [3090,  '35-sound-trigger-dialog.js'],// SOUND + TRIGGER/MAP + DIALOG (defs) + ITEMS + INVENTORY
  [3228,  '40-shop.js'],                // SHOP SYSTEM (test game)
  [3416,  '45-lighting-npc.js'],        // LIGHTING SYSTEM + NPC SYSTEM + NPC UPDATE + enemy AI
  [4473,  '50-lighting-render.js'],     // LIGHTING RENDERING + shop controls
  [5871,  '55-update.js'],              // update() — NPCs, sound, mp, map transition, dialog interaction
  [7210,  '60-draw.js'],                // draw() — 3-pass render, lighting overlay, shop UI
  [8538,  '65-ysort-helpers.js'],       // Y-SORTING FUNCTIONS through to gameLoop start
  [10149, '70-gameloop.js'],            // gameLoop + end
];

mkdirSync(resolve(ROOT, 'src/game/engine'), { recursive: true });
const parts = [];
for (let i = 0; i < starts.length; i++) {
  const [start, name] = starts[i];
  const end = (i + 1 < starts.length) ? starts[i + 1][0] - 1 : N;
  const content = L.slice(start - 1, end).join('\n');
  writeFileSync(resolve(ROOT, 'src/game/engine/' + name), content, 'utf8');
  parts.push('src/game/engine/' + name);
  console.log(`wrote src/game/engine/${name}  lines ${start}..${end}`);
}

const rejoined = parts.map(p => readFileSync(resolve(ROOT, p), 'utf8')).join('\n');
console.log(rejoined === text ? 'OK: engine parts rejoin == 20-engine.js' : 'MISMATCH!');
console.log(JSON.stringify(parts));
