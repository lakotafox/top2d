# World Builder - Project Understanding

## Overview
**Adventure Crafter - World Builder** is a single-file (~22,800 lines) HTML/JavaScript application that serves as both a 2D Zelda-like game editor AND runtime engine. Everything lives in `world-builder.html`.

---

## File Structure (Single HTML File)

| Section | Lines | Purpose |
|---------|-------|---------|
| HTML + CSS | 1-3187 | UI markup, retro styling, phase layouts |
| Editor Logic | 3188-15500 | Builder tools, multiplayer sync, save/load |
| Test Game Engine | 16932-22804 | Runtime game loop, rendering, physics |

---

## Three Phases

### 1. LOAD PHASE (lines 1134-1300)
- Main menu: NEW GAME, LOAD SAVE, JOIN ROOM
- Multiplayer host/join prompts
- IndexedDB + localStorage save handling

### 2. COLLISION PHASE (lines 1298-1395)
- Per-tileset pixel collision mask editing
- Depth split lines for Y-sorting (tree trunks vs canopy)
- Brush tools: paint, erase, split, shapes

### 3. BUILD PHASE (lines 1395-3187)
- Tab-based modes: Tile, Player, NPC, Props, Items, Sound, Lighting, Dialogs, Triggers

---

## Core Data Structures

### Tiles & Layers
```javascript
let tilesets = []              // { name, img, data }
let layers = []                // Array of 2D grids [layer][y][x]
let tileCollisions = {}        // "tilesetIndex:x,y" -> bool
let collisionMasks = {}        // "x,y" -> 2D pixel array
let tileSplitLines = {}        // "x,y" -> Y split value for depth
```

### Player
```javascript
let playerCharacters = []      // Multiple character definitions
let playerAnimations = {       // walkDown/Up/Left/Right, idle*, attack*, interact, death, receiveItem*
    walkDown: [], walkUp: [], attackDown: [], receiveItemDown: [], ...
}
let playerAnimFpsList = {}     // Per-animation FPS
let playerHitboxRange = {}     // Attack range per direction
```

### NPCs
```javascript
let npcs = []                  // NPC definitions { name, spriteData, animations, fps }
let placedNpcs = []            // Instances { npcIndex, x, y, path, isEnemy, enemyConfig, scale, dialogIndex }
let npcRuntimeState = []       // Runtime { x, y, frame, direction, aiState }
```

### Animated Props
```javascript
let animatedProps = []         // { name, spriteData, frames, type, fps, collisionMasks, giveItem }
let placedAnimProps = []       // Instances on map
let animPropCollisionMasks = {} // Per-frame collision: { frameIndex: 2D array }
```

### Items
```javascript
let items = []                 // Item definitions
let placedItems = []           // { itemIndex, x, y, mapName, used }
```

### Sound
```javascript
let sounds = []                // { name, data, duration, type }
let tileSounds = {}            // "x,y" -> { soundIndex, radius, loop, volume }
let playerSounds = { walk: {}, attack: {} }
```

### Lighting
```javascript
let lightingSettings = { blobShadows, ambientEnabled, timeOfDay, playerLight, playerLightRadius }
let pointLights = {}           // "mapName:x,y" -> { radius, flicker }
```

### Maps & Triggers
```javascript
let maps = {}                  // { 'main': {...}, 'dungeon': {...} }
let currentMapName = 'main'
let placedTriggers = []        // { x, y, mapName, targetMap, targetX, targetY, type }
let cameraBounds = {}          // Per-map camera restrictions
```

### Dialogs
```javascript
let dialogs = []               // Dialog configurations with pages
let placedDialogTiles = []     // { x, y, mapName, dialogIndex }
```

---

## Key Function Locations

### Collision System (~3800-4600)
- `drawCollisionTileset()` - Render collision editor
- `paintCollisionAt()` - Paint collision pixels
- `handleSplitClick()` - Depth split lines

### Tile System (~5400-6600)
- `renderMap()` (~6000) - Main map render
- `drawPaintTileset()` - Tileset preview
- `drawRotatedTile()` - Tile with rotation/flip

### Player System (~3769-10100)
- `loadPlayerSprite()` - Load sprite sheet
- `updatePlayerSpritePreview()` - Preview render
- `startReceivingItem()` (19924 in game) - Item pickup animation

### NPC System
- `addNPC()` / `placeNpc()` - Creation and placement
- `updateNpcEnemy()` - Enemy AI config
- `npcPathPreviewLoop()` - Path visualization

### Animated Props (~11089-12050)
- `openAnimPropEditor()` - Create/edit props
- `animPropPaintCollision()` - Per-frame collision painting
- `animPropDrawCanvas()` - Render prop editor

### Sound System (~3965-5193)
- `loadSound()` - Import audio
- `playSound()` (19048 in game) - Runtime playback
- `updateAmbientSounds()` (19092) - Spatial audio

### Lighting (~5235-5300)
- `updateLightingSettings()` - Config
- `renderLighting()` (19202 in game) - Render shadows/overlays

### Triggers/Maps
- `createMapTransitionTrigger()` - Create trigger
- `checkTriggerInteraction()` (20508) - Runtime detection
- `executeMapTransition()` (20845) - Perform transition

### Multiplayer (~13254-14300)
- `connectBuilderMultiplayer()` - Connect to room
- `handleBuilderMessage()` - Process messages
- `broadcastEdit()` - Send edits to others
- `applyRemoteEdit()` - Apply remote changes

### Save/Load (~12732-15500)
- `saveProject()` / `loadProject()`
- `saveProjectToDB()` - IndexedDB
- `getProjectData()` (~12850) - Serialize everything
- `exportConfig()` - Download JSON

### Game Engine (~16932-22804)
- `initGame()` (17443) - Initialize runtime
- `update()` (20244) - Game state update
- `draw()` (21092) - Render frame
- `gameLoop()` (22717) - Main loop
- `checkCollision()` (20033) - Collision detection
- `checkAttackHitbox()` (17985) - Combat

---

## Multiplayer Architecture

### Builder WebSocket
```
wss://multiplayer.lakotafox.partykit.dev/parties/builder/{roomCode}
```
- Broadcasts all edits via `broadcastEdit()`
- Edit types: tile, eraseTile, collision, placeNpc, removeNpc, placeTrigger, etc.

### Game WebSocket
```
wss://multiplayer.lakotafox.partykit.dev/party/{roomCode}
```
- Player position sync
- Live edit relay from builder

### Live Sync (Test Game)
- Test game connects to builder room as observer
- `connectToBuilderSync()` in test game
- `applyLiveEdit()` applies builder changes in real-time

---

## Recent Features Added

### Per-Frame Collision for Animated Props
- `animPropCollisionMasks` - Object keyed by frame index
- Click directly on any frame to paint its collision
- "Copy to All" button to duplicate collision across frames
- Test game uses current animation frame's mask

### Player Receive Item Animation
- Directional variants: receiveItemDown/Up/Left/Right
- Floating item display above player
- Debug sliders: itemScale, floatHeight, displayDuration, finalFramePause
- Triggered by interactive props with `giveItem: true`

### NPC Dialog Integration
- Blue speech bubble icon on NPCs with dialogs
- "Add Dialog" button in NPC settings (glowing retro style)
- Auto-switches to dialog tab and opens editor

### Animated Prop Scaling Fix
- Multi-tile props scale from origin point (not each tile center)
- Prevents gaps/overlap in scaled props

---

## Common Patterns

### Broadcasting Edits
```javascript
broadcastEdit({ editType: 'tile', layer: l, x: x, y: y, cell: data, mapName: currentMapName });
```

### Checking Collision
```javascript
if (tileCollisions[tilesetIdx + ':' + tileX + ',' + tileY]) { ... }
if (collisionMasks[key] && collisionMasks[key][localY][localX]) { ... }
```

### Animation Frame Tracking
```javascript
animPropFrameTimers[key] = { frame: 0, timer: 0 };
animPropFrameTimers[key].frame = (frame + 1) % numFrames;
```

### Layer Iteration
```javascript
for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    const cell = layer[tileY] && layer[tileY][tileX];
    ...
}
```

---

## Testing Workflow

1. Edit in builder (Build Phase)
2. Click "Test Map" button
3. Test game opens in new window
4. If multiplayer connected, test game gets live sync
5. Edits in builder appear instantly in test game
6. Press P in test game for debug panel

---

## Save Format (JSON)

```javascript
{
    maps: { 'main': { layers, layerVisibility, tileCollisions, collisionMasks, tileSplitLines } },
    tilesets: [{ name, data: base64 }],
    npcs: [...], playerCharacters: [...], animatedProps: [...], items: [...],
    sounds: [{ name, data: base64, duration }],
    placedNpcs, placedTriggers, placedAnimProps, placedItems, tileSounds, pointLights,
    dialogs, placedDialogTiles, lightingSettings, currentMapName, spawnMapName
}
```

---

## Debug Tips

- Console logs prefixed with `[ANIM PROP]`, `[LIVE SYNC]`, `[MP]`
- Press P in test game for debug panel (sliders for item receive animation)
- Check `animPropFrameTimers` for animation state
- Check `animatedPropsData` for loaded prop definitions in test game
