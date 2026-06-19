// split-builder.mjs — one-time: cut src/02-builder.js into ordered feature modules under
// src/builder/, on banner-comment boundaries. Pure line slicing, no reordering.
// Concatenation of the parts (join '\n') must equal 02-builder.js byte-for-byte.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const text = readFileSync(resolve(ROOT, 'src/02-builder.js'), 'utf8');
const L = text.split('\n');
const N = L.length; // includes no trailing '' (02 has no trailing newline of its own)

// [startLine(1-based), filename] — each module runs from its start to the next start-1.
const starts = [
  [1,     '10-globals.js'],
  [190,   '15-8dir-movement.js'],
  [397,   '20-prop-phase-load.js'],
  [813,   '25-player-sprite.js'],
  [851,   '30-collision.js'],
  [1747,  '35-build-phase.js'],
  [2127,  '40-sound.js'],
  [2544,  '45-lighting.js'],
  [3016,  '50-create-object.js'],
  [6129,  '55-grab-expand-props.js'],
  [6703,  '60-npc.js'],
  [7961,  '65-player-character-editor.js'],
  [9468,  '70-npc-placement.js'],
  [10422, '75-animprops.js'],
  [11516, '80-items.js'],
  [12692, '85-static-objects.js'],
  [13166, '90-storage.js'],
  [13400, '95-quest.js'],
  [14309, '100-shop.js'],
  [15348, '105-saveload.js'],
  [18502, '110-multimap.js'],
  [19638, '115-camera-fishing.js'],
  [19842, '120-dialog.js'],
  [20454, '125-testmap-leadin.js'],
];

mkdirSync(resolve(ROOT, 'src/builder'), { recursive: true });
const parts = [];
for (let i = 0; i < starts.length; i++) {
  const [start, name] = starts[i];
  const end = (i + 1 < starts.length) ? starts[i + 1][0] - 1 : N; // inclusive
  const content = L.slice(start - 1, end).join('\n');
  writeFileSync(resolve(ROOT, 'src/builder/' + name), content, 'utf8');
  parts.push('src/builder/' + name);
  console.log(`wrote src/builder/${name}  lines ${start}..${end}`);
}

// sanity: rejoin parts and compare to source
const rejoined = parts.map(p => readFileSync(resolve(ROOT, p), 'utf8')).join('\n');
console.log(rejoined === text ? 'OK: parts rejoin == 02-builder.js' : 'MISMATCH!');

// emit the manifest "parts" array for copy-in
console.log(JSON.stringify(parts, null, 2));
