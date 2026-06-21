# Porting ledger — web → C#/MonoGame (`monogame-port`)

Tracks web-side changes made **since the C# port branched** so nothing is missed when the
native engine catches up. The C# port is **Core + Runtime only** (the editor is cut); the
**JSON save is the contract**. So items are categorized by what the port actually needs.

- **Branch point:** `2486ba2` (GAME_BUILD 187). Everything below landed on web `main`/working-tree after that.
- **Inline tags** (grep these in `src/`):
  - `PORT-TODO(monogame)` — engine runtime / save-schema the C# port MUST replicate.
  - `PORT-SKIP(monogame)` — builder/editor-only; recorded for completeness, **not** ported.
  - `PORT-WEBONLY(monogame)` — web-page-only (never ported).
- **Status:** all items below are **UNPORTED** as of this writing. Mark `[x]` / delete when the C# side implements them.

---

## A. SAVE-SCHEMA additions since the split (the JSON contract — HIGHEST priority)
New fields added after the branch point; the C# loader must read them (additive; ride `[JsonExtensionData]` until structurally handled).

- [ ] **`uiConfig`** (top-level, added in `3b43c83`) — custom quest-log UI skins. Per slot (`questLogButton`, `questLogPanel`, `hotbar`, `inventory`): `{spriteData, frames, frameW, frameH, fps, animated, trigger, frameSeq}`; panel also has `textBox`, `completedBox` (256-space rects), `textStyle {font,size,color,titleColor}`, and layout `{anchor, offsetXPct, offsetYPct, sizePct}`. Serialized in `src/builder/105-saveload.js` `getProjectData`.
- [ ] **`animatedProps[*].splitFlipped`** (this session) — `{ "tileX,tileY": true }`, flips which half of a depth-split covers the player (frame-agnostic). Round-trips in `getProjectData` + both load paths.
- [ ] **`shop.dialogId`** (this session, SAVE_SCHEMA_VERSION 2) — replaces the ad-hoc `shop.greeting`/`shop.greetingDialogId`. A shop references a real authored dialog (index into `dialogs`) that contains an `action:'shop'` choice. Migration (`migrateProjectData` v1→v2) converts old numeric `greetingDialogId`→`dialogId` and free-text greetings→a new one-page dialog with Yes(shop)/no(close) choices. C# must read `shop.dialogId` and handle the same migration (or only accept v2 saves).

> Note: per-instance `animTile` fields (`scale/nudge/mirror`, `instance*`) **predate the split** (already in the port base) — they're part of the port's normal roadmap, not tracked here.

## B. ENGINE RUNTIME added since the split (C# must replicate — port targets)
Files in `src/game/engine/*` (the JS reference implementation). These build on the pre-split
scale/nudge/mirror geometry: rect = `origin*tileSize - propSize*(scale-1)/2 + nudge*(tileSize/gridSize)`, size `propSize*scale`, mirror about prop center-X (see `drawAnimTile`).

- [ ] **Depth-split Flip** for anim props — trunk/canopy swap which half is Y-sorted vs player-covering. `drawAnimTileTrunk` + `drawCanopyOverlay` animTile branch (`65-ysort-helpers.js`), driven by `splitFlipped`.
- [ ] **Split (trunk/canopy) honors per-instance scale** — the split cut scales with the sprite. Same two functions.
- [ ] **`unrotateMaskCoord(mx,my,N,rotation,flipped)`** (`65-ysort-helpers.js`) — inverts the renderer's rotate(90° steps)→flip so collision/overlay match the sprite. Used for tiles AND anim props.
- [ ] **Rotation-aware collision** — rotated/flipped **tiles** now rotate their collision mask; rotated **square** anim props too. `checkCollision` (`50-lighting-render.js`).
- [ ] **Scaled anim-prop collision via prop-origin registry** — `checkCollision` tests each placed prop's full **scaled bounds** (covers overflow beyond footprint tiles), inverting scale/nudge/mirror/rotation to the mask. `animatedTileRegistry` is the origin list. (`50-lighting-render.js`, `10-quest-functions.js buildAnimatedTileRegistry`.)
- [ ] **Shops open via dialog (no synthetic greeting)** — interacting with a shop NPC shows `dialogs[shops[npc.shopIndex].dialogId]`; the dialog's `action:'shop'` choice opens the shop. Drop the old `ShowShopGreeting`/auto-injected greeting + early-return (it shadowed real dialogs). Defensive fallback: open the shop directly if `dialogId` is invalid. Ref: `src/game/engine/50-lighting-render.js` interact handler + `55-update.js` `shop` choice.
- [ ] **Custom quest-log UI runtime** — render `uiConfig` skins: animated sprite-sheet button/panel, %-based layout, active+completed scrollable text zones, custom text style. `src/game/engine/10-quest-functions.js` (`applyUiSkins`, `renderQuestLog`, `buildQuestTextHtml`, sprite-anim stepping) + ingest in `20-init-combat.js`. (Note: HTML/DOM-based in web; C# will reimplement in its own UI layer.)

## C. DEBUG / OVERLAY (port only if you want the debug view)
- [ ] **C-key collision overlay for `animTile`** + rotation-aware tile overlay, drawn once in `drawCollisionDebugOverlay` PASS 5 (`65-ysort-helpers.js`). Inline per-layer overlays were removed (dedup). Debug-only — low priority.

## D. BUILDER / EDITOR (NOT ported — editor is cut; listed for completeness)
- `PORT-SKIP` — anim-prop **depth-split tool** rewrite: tiles-tab-parity drag, Flip checkbox, copy-split-to-all-frames, erase-split sub-mode (`src/builder/75-animprops.js`, markup in `src/head/01c-body-openscript.html`).
- `PORT-SKIP` — **UI tab** editor: sprite-sheet skinning, frame select, layout arrange, text-zone editor, text-style controls (`src/builder/130-ui-tab.js`, markup in `src/head/01b/01c`).
- `PORT-SKIP` — copy-collision-to-all-frames, per-instance placed-prop edit popup (scale/nudge/mirror), placement preview.

## E. WEB-PAGE-ONLY (never ported)
- `PORT-WEBONLY` — landing-page background video **ping-pong** (`assets/ui/landing-bg-pingpong.mp4`, `src/head/01b-between-styles.html`).

---

## Commits/working-tree covered
- `3b43c83` — Custom quest-log UI system (editor redesign, frame select, %-layout, text zones+style; ping-pong video; build 188).
- working tree (uncommitted at time of writing) — anim-prop split-tool (drag/Flip/copy-all/erase) + `splitFlipped`; collision overhaul (rotation-aware tiles+props, registry scaled collision, C-overlay for animTile, split scaling, overlay dedup).
