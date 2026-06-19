# World Builder - Comprehensive Reference Document

## File: world-builder.html (~31,730 lines)

---

# PART 1: BUILDER ARCHITECTURE

## Phases (3 Main States)
| Phase | Purpose |
|-------|---------|
| `load` | Main menu - NEW GAME, LOAD SAVE, JOIN ROOM |
| `collision` | Define collision masks on tilesets |
| `build` | Main editing interface with 12 modes |

## Editing Modes (12 Total)
| Mode | Color | Purpose |
|------|-------|---------|
| tile | Green #4a7 | Paint tiles, manage layers |
| player | Default | Character sprites/animations |
| npc | Orange #f93 | NPC placement, paths, AI |
| animProp | Magenta #a6f | Animated sprites on map |
| sound | Yellow #fd0 | Audio placement |
| lighting | Cyan #0ff | Darkness, lights |
| trigger | Red #f55 | Doors, map transitions |
| camera | Blue #58f | Camera bounds |
| dialog | Pink #f6a | Dialog text/choices |
| item | Default | Pickupable items |
| quest | Purple #a8f | Quest system |
| shop | Orange #fa0 | Shop inventory |

---

## Key Global Variables (Builder)

### Core State
```javascript
let currentPhase = 'load';      // 'load', 'collision', 'build'
let mode = 'tile';              // Current editing mode
let currentMapName = 'main';    // Active map
let maps = {};                  // Multi-map data
```

### Grid/Viewport
```javascript
let gridSize = 16;              // Tile size (16 or 32)
let zoom = 2;                   // Map viewport zoom
let mapCols = 40, mapRows = 30; // Map dimensions
```

### Layers
```javascript
let layers = [];                // 2D layer arrays
let currentLayer = 0;           // Active layer
let layerVisibility = [];       // Per-layer visibility
let layerNames = [];            // Layer nicknames
let playerLayerIndex = 1;       // Player render layer
```

### Collision
```javascript
let tileCollisions = {};        // "tilesetIndex:x,y" -> collision
let collisionMasks = {};        // Pixel-level masks
let tileSplitLines = {};        // Y-sort depth lines
let tileSplitLineFlipped = {};  // Flip flag per split
```

### Assets
```javascript
let tilesets = [];              // { name, img, data }
let props = [];                 // Prop definitions
let animatedProps = [];         // Animated prop defs
let staticObjects = [];         // Multi-tile objects
let sounds = [];                // Audio files
```

### Entities
```javascript
let npcs = [];                  // NPC definitions
let placedNpcs = [];            // NPC instances on map
let items = [];                 // Item definitions
let placedItems = [];           // Items on map
let dialogs = [];               // Dialog definitions
let quests = [];                // Quest definitions
let shops = [];                 // Shop definitions
let placedShops = [];           // Shops on map
```

### Player Characters
```javascript
let playerCharacters = [];      // Character definitions
let activePlayerIndex = -1;     // Selected character
let playerPreviewPos = {x:5,y:5}; // Spawn preview
let spawnMapName = 'main';      // Starting map
```

---

# PART 2: SAVE/LOAD SYSTEM

## Data Flow
```
testMap() → getProjectData() → postMessage to test window
Save button → getProjectData() → saveProjectToDB() → IndexedDB
Download → getProjectData() → JSON file download
Load → uploadProject() → saveProjectToDB() → loadProject()
```

## getProjectData() Returns (Line ~17582)
Everything saved:
- layers, layerVisibility, layerNames, mapCols, mapRows
- tileCollisions, collisionMasks, tileSplitLines
- tilesets (with base64 data)
- props, animatedProps, staticObjects
- npcs (with sprites), placedNpcs
- items, placedItems
- dialogs, placedDialogTiles
- quests
- **shops, placedShops, startingGold**
- sounds, tileSounds, playerSounds
- pointLights, polyLights
- playerCharacters, activePlayerIndex
- maps, currentMapName, placedTriggers
- cameraBounds

## Storage Priority
1. IndexedDB (~50MB+) - Primary
2. localStorage (~5-10MB) - Fallback
3. JSON file download - Manual backup

## CRITICAL: testMap() Uses getProjectData() Directly
- No need to "Save" before testing
- Test window gets live data via postMessage
- Save button is for persistent storage only

---

# PART 3: MULTIPLAYER SYNC SYSTEM

## WebSocket URL
```
wss://multiplayer.lakotafox.partykit.dev/parties/builder/[roomCode]
```

## Sync Architecture
```
Builder Edit → broadcastEdit() → WebSocket → Other Builders
                    ↓
            postMessage → Test Game Window
```

## broadcastEdit(editData)
- Solo mode: Direct postMessage to test window
- Co-op mode: Batch edits (250ms delay), send via WebSocket

## Edit Batching
```javascript
const BATCH_DELAY = 250;  // milliseconds
let editBatch = [];
// Edits collected, then flushed as batch
```

## applyRemoteEdit(edit) - 60+ Edit Types
| Category | Types |
|----------|-------|
| Tiles | tile, eraseTile |
| Objects | placeNpc, removeNpc, placeTrigger, placeItem |
| Audio | tileSound, playerSound |
| Lighting | light, addPolyLight, removeLight |
| Definitions | addNpc, updateNpc, addDialog, addQuest, addShop |
| Maps | addMap, deleteMap, renameMap |

## Edit Conflict Resolution
```javascript
let currentlyEditing = {};  // { 'npc:0': { username } }
let myEditingKey = null;
// Functions: startEditing(), stopEditing(), clearPlayerEdits()
```

---

# PART 4: TEST GAME ARCHITECTURE

## Data Reception
```javascript
// Test game signals ready
window.opener.postMessage({ type: 'ready' }, '*');

// Builder responds with project data
{ type: 'project-data', data: projectDataJSON, autoMultiplayer, builderSync }
```

## Variable Names (Builder vs Test Game)

| Builder | Test Game | Notes |
|---------|-----------|-------|
| `dialogs` | `dialogs` | Same |
| `shops` | `shops` | Same (fixed 2026-01-07) |
| `npcs` | `npcs` | Same (fixed 2026-01-07) |
| `quests` | `quests` | Same (fixed 2026-01-07) |
| `items` | `itemsData` | Different (TODO) |
| `placedItems` | `placedItemsData` | Different (TODO) |
| `placedNpcs` | `placedNpcs` | Same |

## Player State Variables
```javascript
let playerScale = 1.7;
let playerFrameWidth = 64;
let playerFrameHeight = 64;
let playerAnimations = null;
let playerAnimFpsList = {};
let playerAnimMirrors = {};
let playerAttackMovement = 'stop';  // 'stop', 'slide', 'move'
let playerShadowWidth = 21;
let playerShadowHeight = 8;
let playerShadowYOffset = 17;
let playerNoShadow = false;
```

## Player Object
```javascript
player = {
  x, y,                    // Position
  width, height,           // Collision box
  health, maxHealth,       // HP
  attacking, attackAnim,   // Combat state
  invincible, knockbackVx/Vy
}
```

## Game Progress Tracking
```javascript
let gameProgress = {
  npcsSpokenTo: {},
  enemiesDefeated: {},
  locationsVisited: {},
  questStates: {}
};
let playerInventory = {};
let playerGold = 100;
```

---

# PART 5: SHOP SYSTEM

## Builder Side (shops array)
```javascript
{
  id: 'shop_0',
  name: 'General Store',
  inventory: [{ itemIndex, buyPrice, stock }],
  buyList: [{ itemIndex, sellPrice }],
  defaultSellRate: 50,
  greetingDialogId: ''  // NOT 'greeting'!
}
```

## Test Game Side (shopsData)
```javascript
let shopsData = projectData.shops || [];
let playerGold = projectData.startingGold || 100;
let shopOpen = false;
let activeShopIndex = -1;
let shopCart = [];  // { type, itemIndex, price, name }
```

## Shop Interaction Flow
1. Player presses A near NPC with shop
2. checkShopInteraction() returns { shopIndex, npc }
3. Shows greeting dialog with "Open Shop" / "Leave" choices
4. If "Open Shop" chosen → openShop(shopIndex)
5. drawShopUI() renders shop interface

---

# PART 6: DIALOG SYSTEM

## Builder Side
```javascript
dialogs = [{
  name: 'Dialog Name',
  style: 1,
  colors: { background, border, text, accent },
  width: 280, height: 80,
  pages: [{
    speaker: 'NPC Name',
    text: 'Dialog text...',
    choices: [
      { text: 'Yes', action: 'accept' },
      { text: 'No', action: 'decline' }
    ]
  }]
}]
```

## Test Game Side (uses `dialogs` directly!)
```javascript
// Same variable name as builder
const dialogs = projectData.dialogs || [];

let activeDialog = {
  dialog: dialogObject,
  pageIndex: 0,
  npc: npcReference
};
let dialogSelectedChoice = 0;
```

## Dialog Choice Actions
| Action | Effect |
|--------|--------|
| `accept` | Accept quest, close dialog |
| `decline` | Show decline dialog if exists |
| `goto` | Jump to targetDialogId |
| `shop` | Open shop via npc.shopIndex |
| `close` | Close dialog |

---

# PART 7: QUEST SYSTEM

## Quest Structure
```javascript
{
  id: 'quest_xxx',
  name: 'Quest Name',
  description: 'Quest text',
  conditions: [{ type, value }],
  onComplete: { giveItems: [], removeItems: [] },
  startNpcUid: 'npc_x_timestamp',
  turnInNpcUid: 'npc_y_timestamp',
  startDialogId: '0',
  activeDialogId: '1',
  completeDialogId: '2',
  declineDialogId: '3',
  prerequisites: ['quest_other'],
  autoStart: false,
  isRepeatable: false
}
```

## Quest Dialog Flow
1. Player talks to quest NPC
2. getQuestDialogForNpc() checks quest status
3. Returns appropriate dialog (start/active/complete)
4. If start dialog has choices → player can accept/decline
5. Accept: Quest becomes active
6. Decline: Shows declineDialogId if set

---

# PART 8: NPC SYSTEM

## NPC Definition (npcs array)
```javascript
{
  name: 'NPC Name',
  spriteData: 'base64...',
  frameWidth: 32, frameHeight: 32,
  animations: { walkDown: [], walkUp: [], idle: [] },
  animMirrors: { walkLeft: true },
  fps: 8,
  pingPong: false,
  collisionInsets: { top, bottom, left, right },
  noShadow: false,
  shadowOffsetX/Y, shadowWidth/Height
}
```

## Placed NPC (placedNpcs array)
```javascript
{
  npcIndex: 0,
  x: 10, y: 5,
  mapName: 'main',
  path: [{ x, y, action, duration }],
  trigger: 'interact',  // or 'proximity'
  speed: 1,
  dialogIndex: -1,
  dialogTrigger: 'interact',
  shopIndex: -1,        // Shop attachment
  isEnemy: false,
  damage: 10,
  maxHp: 30,
  visionRadius: 5,
  chaseSpeed: 1.5,
  attackMode: 'touch',  // or 'lunge'
  dropItems: [{ itemIndex, quantity, chance }]
}
```

## NPC Runtime State (test game)
```javascript
npcRuntimeState[i] = {
  x, y,                    // Current position
  frame, frameTimer,       // Animation
  moving, targetX, targetY,
  currentWaypoint, pathDirection,
  // Enemy AI
  aiState,  // 'idle', 'chase', 'lunge', 'recover', 'return'
  hp, maxHp, dead,
  damageCooldown, hitFlash
}
```

---

# PART 9: ITEM SYSTEM

## Item Definition
```javascript
{
  id: 'item_0',
  name: 'Health Potion',
  spriteData: 'base64...',
  frameWidth: 16, frameHeight: 16,
  frames: 1,
  fps: 8,
  idleFrame: 0,
  maxStack: 99
}
```

## Placed Item
```javascript
{
  itemIndex: 0,
  x: 10, y: 5,
  mapName: 'main',
  layer: 1
}
```

## Inventory System (test game)
```javascript
let inventorySlots = new Array(40);  // 10x4 grid
// Each slot: { itemIndex, quantity } or null

let playerInventory = {};  // Quest tracking: { [itemId]: quantity }
```

---

# PART 10: COMBAT SYSTEM

## Player Combat
```javascript
player.health, player.maxHealth
player.attacking, player.attackAnim
player.invincible, player.invincibleTimer
player.knockbackVx, player.knockbackVy

// Per-direction hitbox config
playerHitboxRange = { up: 35, down: 35, left: 35, right: 30 };
playerHitboxWidth = { up: 90, down: 90, left: 90, right: 90 };
```

## Enemy Attack Modes
| Mode | Behavior |
|------|----------|
| `touch` | Damage on contact |
| `lunge` | Dash toward player, then damage |

## Damage Functions
- `damagePlayer(amount)` - Reduces health, sets invincibility
- `damageNPC(npcIndex, amount)` - Damages enemy, handles death

---

# PART 11: RENDERING SYSTEM

## Game Loop (60fps fixed timestep)
```javascript
gameLoop(timestamp):
  1. Calculate deltaTime
  2. UPDATE LOOP (16.67ms steps):
     - updateDayCycle()
     - update() - player/NPC movement
     - checkTriggers()
     - updateAnimations()
  3. RENDER: draw()
  4. requestAnimationFrame(gameLoop)
```

## Draw Order
1. Ground layer (layer 0)
2. Y-sorted entities (player + tiles with depth)
3. Dropped items
4. Canopy overlay
5. Higher layer content
6. UI overlays (dialog, inventory, shop)

---

# PART 12: COMMON BUGS & FIXES

## Variable Name Mismatches
| Wrong | Correct | Location |
|-------|---------|----------|
| `dialogsData` | `dialogs` | Test game |
| `shop.greeting` | `shop.greetingDialogId` | Shop editor |

## Declaration Order Issues
Variables must be declared before use:
- `playerScale` - declare early (~line 24070)
- `playerShadowWidth/Height/YOffset/NoShadow` - declare early

## Save System
- `saveProject()` must use `getProjectData()` for consistency
- Previously had duplicate data building that was incomplete

## CHECKLIST: Adding New Data Types
When adding a new saveable thing (shops, quests, items, etc), verify ALL of these:

1. **getProjectData()** (~line 17631) - includes the data in return object
2. **loadProject()** (~line 19728) - loads the data from `p.xxx`
3. **loadFullProject()** (~line 18261) - loads for multiplayer sync
4. **applyRemoteEdit()** (~line 18420) - handles live edits from other builders
5. **applyLiveEdit()** (~line 22392) - handles edits in test game

Missing ANY of these = broken save/load. Check both directions!

## applyLiveEdit() Coverage (Builder → Test Game Sync)

`applyLiveEdit()` only syncs tiles, NPCs, triggers, lights, sounds, layers, collision.
It does NOT sync items, dialogs, shops, quests, animated props to the test game.

**This is fine** - test game sync is mainly for multiplayer tile updates.
Restarting the test game loads fresh data from `getProjectData()` anyway.

---

# QUICK REFERENCE: Line Numbers

| Section | Lines |
|---------|-------|
| HTML/Modals | 1-3800 |
| Global Variables | 3800-4100 |
| Mode/Tool Functions | 4100-8000 |
| NPC/Player Editors | 8000-12000 |
| Item/Quest/Dialog/Shop | 12000-17000 |
| Save/Load System | 17500-18000 |
| Multiplayer Sync | 18000-19500 |
| applyRemoteEdit() | 18420-19287 |
| Test Game Start | 21600+ |
| Test Game Player Init | 23950-24100 |
| NPC Runtime | 25058-25738 |
| Input Handling | 26491-26840 |
| Dialog Runtime | 27803-28200 |
| Shop Runtime | 29176-29700 |
| Game Loop | 31525-31676 |

---

# PART 13: WEBSOCKET PROTOCOLS

## Server URLs (Verified)
```
Builder Server: wss://multiplayer.lakotafox.partykit.dev/parties/builder/[roomCode]
Game Server:    wss://multiplayer.lakotafox.partykit.dev/party/[roomCode]
```

## Join Messages
```javascript
// Builder (line 17959)
{ type: 'join', name: builderPlayerName, gameType: 'builder' }

// Game (line 24558)
{ type: 'join', name, x, y, direction, animation, currentMap, gameType: 'game2d' }

// Test Game Observer (line 22407)
{ type: 'join', name: 'TestGame-Observer', gameType: 'test-observer' }
```

---

# PART 14: REMAINING PLAN FILES

| File | Purpose |
|------|---------|
| MAP-HUB-PLAN.md | Map hub feature (other Claude working on it) |
| WORLD-HUB-NETLIFY-PLAN.md | Alt hub design (other Claude working on it) |
| CLAUDE_BLACKJACK_PROMPT.md | 3D tavern reference |

---

## Animated Prop system — DUAL-STORE architecture & bugs (10-agent audit, 2026-06-17)

**Core gotcha: animated props have TWO parallel data stores that disagree.**

1. **`animTile` cells in `layers`** = the REAL data / source of truth. `placeAnimPropAt` (~7787) writes one cell per occupied tile: `{type:'animTile', propIndex, offsetX, offsetY, tilesW, tilesH, placedW, placedH, rotation, scale, instanceSpeed?, instancePlayMode?, instancePlayCount?, instanceWaitTime?}`. These live inside **per-map** `layers` (deep-cloned per map by `saveCurrentMapState`/`loadMapState` ~21808/21824). Renders the sprite (builder ~8255, game `drawAnimTile` ~32724).
   - **`tilesW`/`tilesH` live on the CELL, NOT the prop definition.** Bug fixed 2026-06-17: `previewAnimPropScale` (~15968) and `saveAnimPropEdit` (~16007) propagated multi-tile scale via `prop.tilesW` (undefined) — only the origin tile rescaled. Now use `cell.tilesW`/`cell.tilesH`.

2. **`placedAnimProps[]`** = VESTIGIAL global array (all maps in one list, entries `{propIndex, x, y, layer, mapName?, instanceItemIndex?}`). **`placeAnimPropAt` NEVER pushes to it** — only filled by loading a save (`loadProject` ~21368, `loadFullProject` ~19651). Used ONLY for the giveItem item-assignment overlay (~9418) + hit-test `findInteractivePropAt` (~15626) + game item-override lookup (~29424).

**Cross-map "phantom box" bug (fixed 2026-06-17):** overlay/hit-test filtered with `if (placed.mapName && placed.mapName !== currentMapName)` — the truthy `placed.mapName &&` lets UNTAGGED legacy entries through on EVERY map. Box position came from global `placedAnimProps`, sprite from per-map `layers` → empty box on wrong map that fills on map switch. Fix: added `animTileCellExistsAt(x,y)` and guard both overlay (~9418) and hit-test (~15626). NOTE: data is NOT corrupted — this was display logic reading a stale array; real per-map cells are fine.

**STILL-OPEN anim-prop bugs (found, not yet fixed):**
- Item-assignment broken for freshly-placed props (no `placedAnimProps` entry created on placement). Proper fix = move `instanceItemIndex` onto the cell, drive overlay/assignment from per-map cells, deprecate `placedAnimProps`.
- `removeAnimPropAt` clears `layers` but not `placedAnimProps` (divergence).
- `animPropFrameTimers` + `interactivePropStates` keyed `x,y,layer` with NO map namespace, never cleared in `executeMapTransition` (~30931) → chest/anim state bleeds across maps sharing coords.
- `saveAnimPropEdit` broadcasts only origin cell for multi-tile scale edits → co-op desync.

**Placement scale slider** (`#animPropScale` → `currentAnimPropScale`): only affects the NEXT placed prop. Relabeled "Next-place scale:", min lowered 0.5→0.1 (2026-06-17). To resize a placed prop use Edit Object on Map → its scale slider (writes `cell.scale`, live-previews via `previewAnimPropScale`).

---

## 8-DIRECTION MOVEMENT (added 2026-06-17)

Player + NPCs support 8-way facing/animation, **gated** so 4-direction sprites are unaffected.

- **Shared helpers** (game-engine scope, before the audio-init listener): `dirSuffix(dir)`, `dir8FromVector(dx,dy,allowDiagonal)`, `cardinalOf(dir)`, `dirToVec(dir)`, `hasDiagonalAnims(anims)`, `resolveWalkKey(anims,dir)→{key,flip}`.
- **Direction values** are camelCase: `upLeft/upRight/downLeft/downRight`. **Anim slots**: `walkUpLeft/walkUpRight/walkDownLeft/walkDownRight` (WALK only — by design).
- **The gate**: a diagonal facing is assigned ONLY when the sprite has diagonal walk frames. Player: cached `playerHasDiagonals` (set where `playerAnimations` is assigned at game init). NPC: `hasDiagonalAnims(npc.animations)` checked at the facing-collapse sites. So 4-dir sprites / legacy / old saves keep cardinal facing = identical behavior.
- **Design rule**: diagonals drive WALK animation only. Attack hitbox, attack/idle/ability/receive anim, and the interaction cone all `cardinalOf()`-collapse a diagonal to its dominant cardinal. Projectiles (boomerang `dirVector`) use the true vector via `dirToVec`.
- **Fallback**: `resolveWalkKey` tries the diagonal slot → mirrors the opposite-horizontal diagonal (`downLeft`↔`downRight`, `upLeft`↔`upRight`, `left`←`right`) → collapses to cardinal. Horizontal flip is geometrically correct for top-down.
- **Frame-counter fix (shipped same change)**: player/other/preview frame advance was `% 4` (capped >4-frame walks to 4). Now uncapped (`frame+1`), draw does `% frames.length` (matches the NPC engine). 4-frame anims unchanged; 8-frame walks now play fully.
- **Editor UI**: optional "Diagonal Walk" button rows in BOTH the Player and NPC editors (ids `playerAnim{DownLeft,DownRight,UpLeft,UpRight}` / `npcAnim{...}`). Slots round-trip via the existing spread save/load (no loader changes). Custom-anim reserved lists + `defaultAnims` extended so diagonal names don't show as "custom".
- **Joystick** extended to 8 sectors (sets two arrows on diagonals).
- Blacksmith demo sheet (`~/zelda-game/assets/blacksmith_sprite.png`, 11 rows) includes the 4 diagonal walk rows (up-left mirrored from up-right; PixelLab never generated north-west).

---

## Two-document architecture (mapped 2026-06-17 — CRITICAL)

`world-builder.html` is ONE file but TWO HTML documents / runtime contexts:

- **Builder doc:** lines **1–~23893** (editor, `renderMap` ~8246, save/load, multiplayer, all editor UI).
- **Test Game doc:** the template literal **`const loaderHTML = \`…\``**, opens **~23894**, closes **~34452**. `testMap()` (~23814) writes it via `document.write(loaderHTML)` into a popup (`testWindow.document.write` ~34487) or iframe (~34470), stored as `testGameWindow`. Separate global scope.

**Game `<script>` tags inside loaderHTML:** open ~24314 and ~24355; closes are escaped **`<\/script>`** (~24354, ~34449) so they don't terminate the builder's own script.

**Game-engine functions live INSIDE loaderHTML (string), real line ranges ~25900–34286:**
`initGame` ~25901, `checkAttackHitbox` ~26853, `dirVector` ~27003, `playSound` ~28526, `renderLighting` ~28710, `checkCollision` ~29835, `update` ~30075, `checkTriggerInteraction` ~30409, `executeMapTransition` ~31145, `draw` ~31399, `drawAnimTile`/`drawAnimTileTrunk` ~32938/33029, `drawPlayer` ~33483, `drawNPC` ~33972, `gameLoop` ~34286. (The "File Structure" table line ranges at the top of this doc and in CLAUDE.md are STALE for these.)

**Builder↔game data flow (postMessage handshake, NO shared scope):**
1. Game boots → `__hostWin.postMessage({type:'ready'})` (~25175).
2. Builder listener (~23859) → sends `{type:'project-data', data: JSON}` (~23883).
3. Game `window.onmessage` (~25133) → `JSON.parse` → `initGame()` (~25149).
4. Sounds streamed separately (`streamSoundsToWindow` ~34646 → `{type:'sound-data'}`).
5. Solo live edits: builder `testGameWindow.postMessage({type:'builderEdit'})` (~21014) → game `applyLiveEdit` (~25164).

**Consequence / rule:** a function used in BOTH docs must be DEFINED in BOTH (e.g. the 8-dir helpers are duplicated: builder ~4088, game ~25846 — kept byte-identical). Adding it to only one → runtime `ReferenceError` in the other (Test Map crash or frozen renderMap). `node --check` on the file only validates the builder; the game doc is a string to it.

**Mirror note:** per-instance `cell.mirror` is honored in BOTH `drawAnimTile` (game) and the builder `renderMap` animTile draw, AND in `drawAnimTileTrunk` (split-line props, fixed 2026-06-17 via a `blit()` wrapper).

---

*Generated by Claude Code agents - Last updated: 2026-06-17*
