// build.mjs — reassemble world-builder.html from src/ modules per build/manifest.json.
//
// HARD REQUIREMENT: output is ONE self-contained world-builder.html.
// The build concatenates fragments in manifest order, joined by '\n'.
//
// Fragment forms supported in manifest.json:
//   { "file": "src/x" }                 -> read that file verbatim as the fragment
//   { "parts": ["src/a", "src/b", ...] } -> read each part, join with '\n' to form the fragment
//   { "template": "src/t", "slots": { "NAME": {...} } } -> reserved for PHASE 3 (game split)
//
// All fragments are then joined with '\n' to produce the final file. Because every cut
// happens on a '\n' boundary, this reproduces the original byte-for-byte for pure moves.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf8'));

const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

function buildFragment(frag) {
  if (frag.file) return read(frag.file);
  if (frag.parts) return frag.parts.map(read).join('\n');
  if (frag.template) return buildTemplate(frag);
  throw new Error('Unknown fragment shape: ' + JSON.stringify(frag));
}

// PHASE 3: inject re-escaped game JS back into the loaderHTML template.
// The template file contains a placeholder line for the game <script> body; we re-escape
// the clean src/game/*.js parts and substitute. (Defined now; activated when manifest uses it.)
function buildTemplate(frag) {
  let tpl = read(frag.template);
  for (const [marker, spec] of Object.entries(frag.slots || {})) {
    const clean = spec.parts.map(read).join('\n');
    const escaped = reEscapeGameJs(clean);
    if (!tpl.includes(marker)) throw new Error('Template marker not found: ' + marker);
    tpl = tpl.replace(marker, () => escaped);
  }
  return tpl;
}

// Re-escape clean game JS so it is safe inside the builder's `const loaderHTML = \`...\`` string.
// Inverse of the un-escaping done when extracting: order matters.
export function reEscapeGameJs(s) {
  return s
    .replace(/\\/g, '\\\\')        // backslash first
    .replace(/`/g, '\\`')          // backtick -> \`
    .replace(/\$/g, '\\$')         // $ -> \$  (kills ${} interpolation)
    .replace(/<\/script>/g, '<\\/script>'); // </script> -> <\/script>
}

let out = manifest.fragments.map(buildFragment).join('\n');
writeFileSync(resolve(ROOT, manifest.output), out, 'utf8');
console.log('Built', manifest.output, '(' + out.length + ' bytes)');
