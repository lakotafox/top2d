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

## CRITICAL: Variable Name Differences

| Builder | Test Game | Notes |
|---------|-----------|-------|
| `dialogs` | `dialogs` | Same - shared |
| `shops` | `shopsData` | Different! |
| `npcs` | `npcsData` | Different! |
| `quests` | `questsData` | Different! |
| `items` | `items` | Same - shared |
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

*Generated by Claude Code agents - Last updated: 2026-01-07*
