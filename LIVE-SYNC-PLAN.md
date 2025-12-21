# Live Builder → Test Game Sync Implementation Plan

## Goal
Make the test game receive live map updates from the builder in real-time, so when you edit tiles/NPCs/triggers in the builder, the running test game updates immediately.

---

## Current Architecture

### Builder WebSocket (already exists)
- **URL**: `wss://multiplayer.lakotafox.partykit.dev/parties/builder/[roomCode]`
- **Connection**: `builderSocket` variable (line ~8798)
- **Broadcasts all edits** via `broadcastEdit()` (line ~9666)
- **Edit types** sent: `tile`, `eraseTile`, `collision`, `placeNpc`, `removeNpc`, `placeTrigger`, `removeTrigger`, `addLayer`, `deleteLayer`, `light`, `removeLight`, `tileSound`, `cameraBounds`, `addMap`, `deleteMap`, etc.

### Test Game (embedded HTML starting ~line 11186)
- Opens in new window via `testMap()` function
- Receives project data ONCE via `postMessage` at startup
- Has its own game state: `layers`, `tileCollisions`, `placedNpcs`, `placedTriggers`, etc.
- Already receives `autoMultiplayer` config if builder is in co-op mode (line 11169-11174)

---

## Implementation Steps

### Step 1: Pass Builder Room Code to Test Game

**Location**: `testMap()` function around line 11169

**Current code** (approx):
```javascript
if (builderConnected && builderRoomCode) {
    payload.autoMultiplayer = {
        roomCode: builderRoomCode,
        playerName: builderPlayerName + '-tester'
    };
}
```

**Change to**:
```javascript
if (builderConnected && builderRoomCode) {
    payload.autoMultiplayer = {
        roomCode: builderRoomCode,
        playerName: builderPlayerName + '-tester'
    };
    // Also pass builder room for live sync
    payload.builderSync = {
        roomCode: builderRoomCode
    };
}
```

---

### Step 2: Add Builder Sync Connection in Test Game

**Location**: Inside the embedded test game HTML (after `initGame()` is defined, around line 11620+)

**Add new function**:
```javascript
function connectToBuilderSync(roomCode) {
    const wsUrl = 'wss://multiplayer.lakotafox.partykit.dev/parties/builder/' + roomCode;
    console.log('[LIVE SYNC] Connecting to builder room:', roomCode);

    const builderSyncSocket = new WebSocket(wsUrl);

    builderSyncSocket.onopen = () => {
        console.log('[LIVE SYNC] Connected to builder!');
        // Join as observer (don't send edits, just receive)
        builderSyncSocket.send(JSON.stringify({
            type: 'join',
            name: 'TestGame-Observer',
            gameType: 'test-observer'
        }));
    };

    builderSyncSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'builderEdit' || data.editType) {
                applyLiveEdit(data);
            }
        } catch (e) {
            console.error('[LIVE SYNC] Parse error:', e);
        }
    };

    builderSyncSocket.onclose = () => {
        console.log('[LIVE SYNC] Disconnected from builder');
        // Optionally reconnect after delay
        setTimeout(() => connectToBuilderSync(roomCode), 3000);
    };

    builderSyncSocket.onerror = (err) => {
        console.error('[LIVE SYNC] WebSocket error:', err);
    };
}
```

---

### Step 3: Add `applyLiveEdit()` Function in Test Game

**Location**: Same area as Step 2

This function applies incoming edits to the live game state. Reference the builder's `applyRemoteEdit()` function (line ~9494) for the full list of edit types.

```javascript
function applyLiveEdit(edit) {
    // Handle batch edits
    if (edit.editType === 'batch' && edit.edits) {
        edit.edits.forEach(e => applyLiveEdit(e));
        return;
    }

    const editType = edit.editType;
    console.log('[LIVE SYNC] Applying:', editType);

    switch (editType) {
        case 'tile':
            // Update tile in the current map
            if (edit.mapName === currentMapName || !edit.mapName) {
                if (!layers[edit.layer]) layers[edit.layer] = [];
                if (!layers[edit.layer][edit.y]) layers[edit.layer][edit.y] = [];
                layers[edit.layer][edit.y][edit.x] = edit.cell;
            }
            break;

        case 'eraseTile':
            if (edit.mapName === currentMapName || !edit.mapName) {
                if (layers[edit.layer] && layers[edit.layer][edit.y]) {
                    layers[edit.layer][edit.y][edit.x] = null;
                }
            }
            break;

        case 'collision':
            if (edit.value) {
                tileCollisions[edit.key] = true;
            } else {
                delete tileCollisions[edit.key];
            }
            break;

        case 'collisionMask':
            collisionMasks[edit.key] = edit.mask;
            break;

        case 'placeNpc':
            placedNpcs.push(edit.npc);
            // TODO: Create NPC sprite in game
            break;

        case 'removeNpc':
            if (edit.index >= 0 && edit.index < placedNpcs.length) {
                placedNpcs.splice(edit.index, 1);
                // TODO: Remove NPC sprite from game
            }
            break;

        case 'updateNpc':
            if (edit.index >= 0 && edit.index < placedNpcs.length) {
                placedNpcs[edit.index] = edit.npc;
            }
            break;

        case 'placeTrigger':
            placedTriggers.push(edit.trigger);
            break;

        case 'removeTrigger':
            if (edit.index >= 0 && edit.index < placedTriggers.length) {
                placedTriggers.splice(edit.index, 1);
            }
            break;

        case 'updateTrigger':
            if (edit.index >= 0 && edit.index < placedTriggers.length) {
                placedTriggers[edit.index] = edit.trigger;
            }
            break;

        case 'light':
            pointLights[edit.key] = edit.light;
            // TODO: Update lighting in renderer
            break;

        case 'removeLight':
            delete pointLights[edit.key];
            break;

        case 'tileSound':
            tileSounds[edit.key] = edit.sound;
            break;

        case 'removeTileSound':
            delete tileSounds[edit.key];
            break;

        case 'cameraBounds':
            if (edit.mapName === currentMapName || !edit.mapName) {
                cameraBounds = edit.bounds;
            }
            break;

        case 'splitLine':
            tileSplitLines[edit.key] = edit.line;
            break;

        case 'clearSplitLine':
            delete tileSplitLines[edit.key];
            break;

        case 'addLayer':
            if (edit.mapName === currentMapName || !edit.mapName) {
                layers.push([]);
                // Initialize empty layer grid
                for (let y = 0; y < mapRows; y++) {
                    layers[layers.length - 1][y] = [];
                    for (let x = 0; x < mapCols; x++) {
                        layers[layers.length - 1][y][x] = null;
                    }
                }
            }
            break;

        case 'deleteLayer':
            if (edit.mapName === currentMapName || !edit.mapName) {
                if (edit.index >= 0 && edit.index < layers.length) {
                    layers.splice(edit.index, 1);
                }
            }
            break;

        case 'clearMap':
            if (edit.mapName === currentMapName || !edit.mapName) {
                // Re-initialize all layers as empty
                layers.forEach((layer, i) => {
                    layers[i] = [];
                    for (let y = 0; y < mapRows; y++) {
                        layers[i][y] = [];
                        for (let x = 0; x < mapCols; x++) {
                            layers[i][y][x] = null;
                        }
                    }
                });
            }
            break;

        default:
            console.log('[LIVE SYNC] Unhandled edit type:', editType);
    }

    // Flag that a redraw is needed (don't redraw on every edit for performance)
    needsRedraw = true;
}

// Add redraw flag and check in game loop
let needsRedraw = false;
```

---

### Step 4: Trigger Connection on Game Init

**Location**: In the test game's `initGame()` function or after project data is received

**Find where `initGame()` ends** and add:
```javascript
// After game is initialized, connect to builder for live sync
if (projectData.builderSync && projectData.builderSync.roomCode) {
    connectToBuilderSync(projectData.builderSync.roomCode);
}
```

Or in the `window.onmessage` handler after `initGame()` call:
```javascript
if (e.data.type === 'project-data') {
    projectData = JSON.parse(e.data.data);
    // ... existing code ...
    initGame();

    // Connect to builder for live sync
    if (e.data.builderSync && e.data.builderSync.roomCode) {
        setTimeout(() => connectToBuilderSync(e.data.builderSync.roomCode), 1000);
    }
}
```

---

### Step 5: Handle Redraw in Game Loop

**Location**: Find the main game loop (`requestAnimationFrame` or `setInterval`)

Add check for `needsRedraw` flag:
```javascript
// In the game's render/update loop
if (needsRedraw) {
    needsRedraw = false;
    // Trigger whatever redraw mechanism the test game uses
    // This might be automatic if tiles are drawn every frame
}
```

---

## Edge Cases to Handle

1. **Map switching**: If builder switches to a different map, test game should either:
   - Ignore edits for other maps (current approach above)
   - Or receive a `switchMap` message and reload that map's data

2. **NPC sprites**: When NPCs are added/removed, need to create/destroy their sprites in the game world

3. **Lighting updates**: Point lights need to be recalculated when added/removed

4. **Batch edits**: Already handled - the builder sends batched edits, we recursively apply them

5. **Reconnection**: Socket may disconnect - added auto-reconnect with 3 second delay

6. **Observer mode**: Test game joins as `test-observer` so it doesn't count as a builder or send edits back

---

## Testing Checklist

- [ ] Open builder, connect to co-op room
- [ ] Click "Test Map" to open test game
- [ ] Verify test game connects to builder WebSocket (check console)
- [ ] Paint a tile in builder → verify it appears in test game
- [ ] Erase a tile in builder → verify it disappears in test game
- [ ] Add/remove an NPC → verify test game updates
- [ ] Add/remove a trigger → verify test game updates
- [ ] Disconnect/reconnect builder → verify test game reconnects

---

## Key Line References in world-builder.html

| What | Approx Line |
|------|-------------|
| `testMap()` function | 11119 |
| Test game HTML starts | 11186 |
| Test game `window.onmessage` | 11592 |
| `builderSocket` connection | 8798 |
| `broadcastEdit()` function | 9666 |
| `applyRemoteEdit()` (builder version) | 9494 |
| `handleBuilderMessage()` | 9063 |
| Edit types switch statement | 9098+ |

---

## Summary

The builder already broadcasts all edits. We just need the test game to:
1. Receive the builder room code at launch
2. Connect to the same WebSocket as an observer
3. Apply incoming edits to its local game state
4. Redraw when edits come in

This gives you live preview of map changes without reopening the test window!
