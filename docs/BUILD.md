# Building `world-builder.html` from modular source

`world-builder.html` is a single self-contained HTML file that is **both** the world-builder
editor **and** the runtime game engine. Shipping it as ONE offline file (with embedded base64
assets) is a hard product requirement. To keep it editable, the source now lives as small
modules under `src/`, and a build step **reassembles them into the one `world-builder.html`**.

> The build for pure code moves is **byte-identical** to the original. Prefer editing the
> modules in `src/` and rebuilding over hand-editing `world-builder.html`.

## Build & verify

```bash
node build/build.mjs        # regenerate world-builder.html from src/ per build/manifest.json
node build/verify.mjs       # rebuild + assert byte-identical to golden ref + node --check builder AND game JS
```

`world-builder.original.html` is the **immutable golden reference** (the pristine pre-split
file). `verify.mjs` shasum-compares the rebuilt output against it.

## How it fits together

`build/manifest.json` lists fragments concatenated **in order, joined by `\n`**, to form the
output. Order is load-bearing: the two runtime documents share global scope **by concatenation
order**, not by imports — there are intentionally **no `import`/`export`** statements.

Fragment forms in the manifest:
- `{ "file": "..." }` — one file, verbatim.
- `{ "parts": [ ... ] }` — several files, joined by `\n`.
- `{ "gameParts": [ {file|escape} ... ] }` — the game-engine template fragment (see below).

## The two documents (critical)

`world-builder.html` contains **two separate runtime contexts**:

1. **BUILDER doc** — the editor page. Its JS is the big top-level `<script>`.
2. **GAME doc** — the runtime engine, stored as a **JS template-literal string**
   `const loaderHTML = \`…\`` that `testMap()` writes into a new window via `document.write`.
   It has its **own** global scope; data crosses only via `postMessage`.

Because the game lives inside a template literal, its source is **escaped** in the file. We
extract it to **clean, readable `.js`** under `src/game/` and **re-escape on build**.

### Escaping (verified, see `build/escape.mjs`)

Empirically, the original escapes inside `loaderHTML`:
- `` ` `` → `` \` ``  (only the nested *Player Settings* template uses backticks)
- `${` → `\${`  — **only `$` immediately before `{`** is escaped (kills `${}` interpolation).
  Lone `$` (regex `$` end-anchors, the `'$'` gold glyph) is left **raw**.
- `</script>` → `<\/script>`
- there are **no** escaped backslashes (`\\`) in the body.

The un-escape / re-escape pair is verified to round-trip the template body **byte-for-byte**.
(Note: the project CLAUDE.md's older claim that "every `$` is escaped" is imprecise — only
`${` is; the build relies on the precise rule above.)

## Module map (output order, top → bottom)

| Group | Files | What |
|---|---|---|
| head + CSS | `src/head/01a-head-open.html`, `src/styles.css`, `src/head/01b-between-styles.html`, `src/styles2.css`, `src/head/01c-body-openscript.html` | `<head>`, the two builder `<style>` bodies (as CSS), body markup, opening `<script>` |
| **builder JS** | `src/builder/10-globals.js` … `125-testmap-leadin.js` (24 modules) | globals, 8-dir movement, phases, collision, tiles, sound, lighting, create-object, props, NPC, player-char editor, animprops, items, static objects, storage, quest, shop, save/load, multi-map, camera/fishing, dialog, test-map lead-in |
| **game template** | `src/game/00-template-head.html`, `10-debug-log.js`, `_mid-template.html`, `engine/00…70`, `99-template-tail.html` | the `loaderHTML` template: scaffolding HTML (verbatim) + clean game JS (`escape`d back in) |
| builder tail | `src/04-builder-tail.js` | `testMap()` window-write + tail |
| close | `src/05-close.html` | `</script></body></html>` |

Game engine modules (`src/game/engine/`, clean un-escaped JS):
`00-canvas-livesync`, `05-quest-runtime`, `10-quest-functions`, `15-8dir-movement`,
`20-init-combat`, `25-usable-items-fishing`, `30-multiplayer`, `35-sound-trigger-dialog`,
`40-shop`, `45-lighting-npc`, `50-lighting-render`, `55-update`, `60-draw`,
`65-ysort-helpers`, `70-gameloop`.

A helper used in **both** documents is **duplicated** in both (e.g. 8-dir movement helpers in
`src/builder/15-8dir-movement.js` AND `src/game/engine/15-8dir-movement.js`). Do not dedupe —
separate scopes.

## Editing workflow

1. Edit a module under `src/`.
2. `node build/verify.mjs`.
   - For **pure moves / formatting-neutral** edits the output stays byte-identical.
   - For **real changes** the byte-identical check will (correctly) fail; rely on the two
     `node --check` results and Test Map in-browser. Re-snapshot the golden ref only when you
     intend to bless a new baseline (`cp world-builder.html world-builder.original.html`).
3. Commit `src/` + the rebuilt `world-builder.html` together.

## `build/` scripts

- `build.mjs` — the build. **Keep.**
- `verify.mjs` — rebuild + byte-check + node-check builder & game. **Keep.**
- `escape.mjs` — un-escape/re-escape pair for game JS. **Keep** (imported by build/verify).
- `manifest.json` — fragment order. **Keep.**
- `slice.mjs`, `split-builder.mjs`, `split-game.mjs`, `split-engine.mjs`, `split-head.mjs` —
  **one-time** slicers used to carve the original into `src/`. Kept for provenance; they read
  source files that no longer exist after the split, so they are not part of the build.
