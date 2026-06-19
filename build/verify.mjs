// verify.mjs — full verification pass:
//  1) rebuild world-builder.html
//  2) assert byte-identical to world-builder.original.html (shasum)
//  3) node --check the BUILDER js (all top-level <script> bodies, excluding the loaderHTML template string)
//  4) node --check the GAME js (extract loaderHTML template, un-escape, check its inner <script>)
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const sha = (b) => createHash('sha1').update(b).digest('hex');

let fail = 0;
const ok = (m) => console.log('  ok  ' + m);
const bad = (m) => { console.log('  FAIL ' + m); fail++; };

// 1) rebuild
execSync('node ' + JSON.stringify(resolve(__dirname, 'build.mjs')), { stdio: 'inherit' });

// 2) compare to the frozen pre-split original — INFORMATIONAL only (we intentionally
//    diverge from it via real edits; the node --check gates below are pass/fail).
const built = readFileSync(resolve(ROOT, 'thesoup.html'));
const orig = readFileSync(resolve(__dirname, 'world-builder.original.html'));
if (sha(built) === sha(orig)) ok('byte-identical to frozen original (' + sha(built) + ')');
else console.log('  note  diverges from frozen original (expected after edits): built=' + sha(built).slice(0, 8) + ' orig=' + sha(orig).slice(0, 8));

const html = built.toString('utf8');
const tmp = mkdtempSync(join(tmpdir(), 'wb-verify-'));

// 3) BUILDER check. The builder is everything in the top-level <script>...</script> blocks.
//    The game lives inside the loaderHTML template literal, which is itself valid builder JS
//    (just a big string), so node --check of the whole builder script body already covers it
//    as a string. We extract top-level script blocks (the outer document's scripts only).
//    Top-level <script> tags are at column 4 ("    <script>"); the game's are escaped <\/script>.
const scriptRe = /<script>([\s\S]*?)<\/script>/g;
let m, builderBody = '';
while ((m = scriptRe.exec(html)) !== null) builderBody += m[1] + '\n;\n';
const builderFile = join(tmp, 'builder.js');
writeFileSync(builderFile, builderBody, 'utf8');
try { execSync('node --check ' + JSON.stringify(builderFile), { stdio: 'pipe' }); ok('builder JS node --check passed'); }
catch (e) { bad('builder JS node --check FAILED:\n' + (e.stderr || e.stdout || e).toString()); }

// 4) GAME check. Extract the loaderHTML template literal, un-escape it, pull its inner <script>.
const startMarker = 'const loaderHTML = `';
const sIdx = html.indexOf(startMarker);
if (sIdx === -1) { bad('could not find loaderHTML template'); }
else {
  const afterStart = sIdx + startMarker.length;
  // find the closing unescaped backtick: the template ends at "\n            `;" after </html>
  const endIdx = html.indexOf('\n            `;', afterStart);
  if (endIdx === -1) { bad('could not find loaderHTML closing backtick'); }
  else {
    const rawTemplate = html.slice(afterStart, endIdx);
    // Un-escape (inverse of build re-escape): \$ -> $, <\/script> -> </script>, \` -> `, \\ -> \
    const gameHtml = rawTemplate
      .replace(/<\\\/script>/g, '</script>')
      .replace(/\\\$/g, '$')
      .replace(/\\`/g, '`')
      .replace(/\\\\/g, '\\');
    // its inner <script> (now un-escaped) — there is one game <script>
    const gm = /<script>([\s\S]*?)<\/script>/.exec(gameHtml);
    if (!gm) { bad('could not find game inner <script>'); }
    else {
      const gameFile = join(tmp, 'game.js');
      writeFileSync(gameFile, gm[1], 'utf8');
      try { execSync('node --check ' + JSON.stringify(gameFile), { stdio: 'pipe' }); ok('game JS node --check passed'); }
      catch (e) { bad('game JS node --check FAILED:\n' + (e.stderr || e.stdout || e).toString()); }
    }
  }
}

console.log(fail === 0 ? '\nVERIFY: ALL PASS' : '\nVERIFY: ' + fail + ' FAILURE(S)');
process.exit(fail === 0 ? 0 : 1);
