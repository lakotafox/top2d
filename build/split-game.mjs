// split-game.mjs — one-time: split fragment 03 (the loaderHTML template) into:
//   src/game/00-template-head.html   : scaffolding lines 1..421  (opener + HTML + first <script> open)
//   src/game/10-debug-log.js         : first <script> BODY (un-escaped), lines 422..460
//   src/game/_mid-template.html      : "    <\/script>\n    <script>" between the two scripts (461..462)
//   src/game/20-engine.js            : second <script> BODY (un-escaped), lines 463..10773
//   src/game/99-template-tail.html   : scaffolding lines 10774..end (<\/script></body></html> + `;)
//
// Re-escape on build reproduces fragment 03 byte-for-byte. This script also self-checks that.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unescapeGameJs, reEscapeGameJs } from './escape.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const text = readFileSync(resolve(ROOT, 'src/03-loaderHTML-template.js'), 'utf8');
const L = text.split('\n');
const N = L.length;
const lines = (a, b) => L.slice(a - 1, b).join('\n'); // inclusive 1-based

// Boundaries (verified against the file):
//  421 = "    <script>"  (first script open)  -> head ends here (inclusive)
//  422..460 = debug body
//  461 = "    <\/script>"  462 = "    <script>"  -> mid template
//  463..10773 = engine body
//  10774 = "    <\/script>"  ... N = closing `;
const headEnd = 421;
const debugStart = 422, debugEnd = 460;
const midStart = 461, midEnd = 462;
const engineStart = 463, engineEnd = 10773;
const tailStart = 10774;

const head = lines(1, headEnd);
const debugRaw = lines(debugStart, debugEnd);
const mid = lines(midStart, midEnd);
const engineRaw = lines(engineStart, engineEnd);
const tail = lines(tailStart, N);

const debugClean = unescapeGameJs(debugRaw);
const engineClean = unescapeGameJs(engineRaw);

// SELF-CHECK: re-escape must reproduce the raw bodies exactly.
if (reEscapeGameJs(debugClean) !== debugRaw) throw new Error('debug body round-trip MISMATCH');
if (reEscapeGameJs(engineClean) !== engineRaw) throw new Error('engine body round-trip MISMATCH');

// SELF-CHECK: full reassembly equals fragment 03.
const rebuilt = [head, reEscapeGameJs(debugClean), mid, reEscapeGameJs(engineClean), tail].join('\n');
if (rebuilt !== text) throw new Error('fragment 03 reassembly MISMATCH');
console.log('OK: fragment 03 round-trips byte-identical via clean game JS');

mkdirSync(resolve(ROOT, 'src/game'), { recursive: true });
writeFileSync(resolve(ROOT, 'src/game/00-template-head.html'), head, 'utf8');
writeFileSync(resolve(ROOT, 'src/game/10-debug-log.js'), debugClean, 'utf8');
writeFileSync(resolve(ROOT, 'src/game/_mid-template.html'), mid, 'utf8');
writeFileSync(resolve(ROOT, 'src/game/20-engine.js'), engineClean, 'utf8');
writeFileSync(resolve(ROOT, 'src/game/99-template-tail.html'), tail, 'utf8');
console.log('wrote src/game/{00-template-head.html,10-debug-log.js,_mid-template.html,20-engine.js,99-template-tail.html}');
