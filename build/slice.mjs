// One-time slicer: cut world-builder.original.html into the 5 top-level fragments.
// Byte-accurate: split on '\n', slice by INCLUSIVE 1-based line ranges, write fragments.
// The original ends with a trailing '\n', so split() yields a final '' element which we
// attach to the last fragment so that join('\n') round-trips exactly.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const text = readFileSync(resolve(__dirname, 'world-builder.original.html'), 'utf8');
const L = text.split('\n'); // L[0] is line 1; trailing '' if file ends in '\n'
console.log('total split elements:', L.length, '(expect 35596 = 35595 lines + trailing "")');

// Inclusive 1-based ranges -> 0-based slice [start-1, end)
function lines(a, b) { return L.slice(a - 1, b).join('\n'); }

// Fragment 05 must include the trailing '' element (index 35595, i.e. "line 35596")
// so that the whole file's terminating '\n' is preserved on rebuild.
const frag05 = L.slice(35593 - 1).join('\n'); // 35593..end (incl trailing '')

const fragments = {
  '01-head-body-openscript.html': lines(1, 4033),
  '02-builder.js':                lines(4034, 24595),
  '03-loaderHTML-template.js':    lines(24596, 35372),
  '04-builder-tail.js':           lines(35373, 35592),
  '05-close.html':                frag05,
};

mkdirSync(resolve(ROOT, 'src'), { recursive: true });
for (const [name, content] of Object.entries(fragments)) {
  writeFileSync(resolve(ROOT, 'src', name), content, 'utf8');
  console.log('wrote src/' + name, content.length, 'chars');
}
