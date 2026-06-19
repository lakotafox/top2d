// split-head.mjs — one-time: cut src/01-head-body-openscript.html into 5 parts so the two
// builder <style> bodies live in standalone .css files. Pure line slicing; rejoin '\n' must
// equal fragment 01 byte-for-byte.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const text = readFileSync(resolve(ROOT, 'src/01-head-body-openscript.html'), 'utf8');
const L = text.split('\n');
const N = L.length;
const lines = (a, b) => L.slice(a - 1, b).join('\n');

// 7=<style> 8..1166=css1 1167=</style> ... 2918=<style> 2919..3135=css2 3136=</style>
const a = lines(1, 7);        // ...<style>
const css1 = lines(8, 1166);  // CSS body 1
const b = lines(1167, 2918);  // </style> ...markup... <style>
const css2 = lines(2919, 3135); // CSS body 2
const c = lines(3136, N);     // </style> ...markup... <script>

mkdirSync(resolve(ROOT, 'src/head'), { recursive: true });
writeFileSync(resolve(ROOT, 'src/head/01a-head-open.html'), a, 'utf8');
writeFileSync(resolve(ROOT, 'src/styles.css'), css1, 'utf8');
writeFileSync(resolve(ROOT, 'src/head/01b-between-styles.html'), b, 'utf8');
writeFileSync(resolve(ROOT, 'src/styles2.css'), css2, 'utf8');
writeFileSync(resolve(ROOT, 'src/head/01c-body-openscript.html'), c, 'utf8');

const rejoined = [a, css1, b, css2, c].join('\n');
console.log(rejoined === text ? 'OK: head parts rejoin == fragment 01' : 'MISMATCH!');
