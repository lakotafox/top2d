// build.mjs — reassemble world-builder.html from src/ modules per build/manifest.json.
//
// HARD REQUIREMENT: output is ONE self-contained world-builder.html.
// The build concatenates fragments in manifest order, joined by '\n'. Because every cut
// happens on a '\n' boundary, this reproduces the original byte-for-byte for pure moves.
//
// Fragment forms supported in manifest.json:
//   { "file": "src/x" }
//       read that file verbatim as the fragment.
//   { "parts": ["src/a", "src/b", ...] }
//       read each part, join with '\n' to form the fragment (in-order concat, global scope).
//   { "gameParts": [ {file|escape} ... ] }
//       PHASE 3 — the loaderHTML template fragment. Each entry is either:
//         { "file": "src/game/x.html" }    -> scaffolding, passed through verbatim
//         { "escape": "src/game/x.js" }    -> clean game JS, RE-ESCAPED on the way in
//       joined with '\n'. Re-escaping reproduces the original template body byte-for-byte.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reEscapeGameJs } from './escape.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf8'));

const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

function buildFragment(frag) {
  if (frag.file) return read(frag.file);
  if (frag.parts) return frag.parts.map(read).join('\n');
  if (frag.gameParts) return frag.gameParts.map(buildGamePart).join('\n');
  throw new Error('Unknown fragment shape: ' + JSON.stringify(frag));
}

function buildGamePart(p) {
  if (p.file) return read(p.file);              // scaffolding: verbatim
  if (p.escape) return reEscapeGameJs(read(p.escape)); // clean game JS: re-escape
  throw new Error('Unknown gamePart shape: ' + JSON.stringify(p));
}

const out = manifest.fragments.map(buildFragment).join('\n');
writeFileSync(resolve(ROOT, manifest.output), out, 'utf8');
console.log('Built', manifest.output, '(' + out.length + ' bytes)');
