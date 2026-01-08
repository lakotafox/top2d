# Multiplayer Sync Implementation Plan

## Overview: Two Types of Sync

### 1. Builder-to-Builder Sync (FULLY IMPLEMENTED)
When multiple builders are in the same co-op room, ALL edits sync between them via `applyRemoteEdit()`.

**WebSocket:** `wss://multiplayer.lakotafox.partykit.dev/parties/builder/[roomCode]`
**Function:** `applyRemoteEdit(edit)` in builder code
**Status:** Complete - handles 70+ edit types

### 2. Builder-to-Test-Game Sync (PARTIALLY IMPLEMENTED)
When a test game window connects to watch builder edits, it receives updates via `applyLiveEdit()`.

**WebSocket:** Same as builder room, but joins as observer
**Function:** `applyLiveEdit(edit)` in test game code
**Status:** Partial - only handles ~32 edit types, missing many

---

## What Currently Syncs

| Category | Builder-to-Builder | Builder-to-Test-Game |
|----------|-------------------|---------------------|
| Tiles (paint/erase) | YES | YES |
| Collision/masks | YES | YES |
| NPCs (place/remove) | YES | YES |
| NPC updates (speed, waypoints) | YES | YES |
| Triggers | YES | YES |
| Point lights | YES | YES |
| Tile sounds | YES | YES |
| Camera bounds | YES | YES |
| Layers (add/delete) | YES | YES |
| Split lines | YES | YES |
| Map clear | YES | YES |
| **Items (definitions)** | YES | NO |
| **Items (placed)** | YES | PARTIAL |
| **Dialogs** | YES | NO |
| **Quests** | YES | NO |
| **Shops** | YES | NO |
| **NPC definitions** | YES | NO |
| **Animated props** | YES | NO |
| **Player characters** | YES | NO |
| **Map expand** | YES | NO |
| **Tileset delete** | YES | NO |

---

## Task
Add missing sync handlers to the test game so all builder edits are synchronized to players in multiplayer rooms.

## Problem
The builder broadcasts 70+ edit types, but the test game's `applyLiveEdit()` function only handles ~32. This causes the test game to become out of sync when builders add/modify items, dialogs, quests, shops, animated props, etc.

## File to Modify
`/Users/khabefox/zelda-game/world-builder.html`

## Location
Add new cases to the `applyLiveEdit()` function switch statement (starts at line ~22392, add before the `default:` case at line ~22700)

---

## Important: Test Game Variable Names

The test game uses different variable names than the builder:

| Builder Variable | Test Game Variable | Notes |
|------------------|-------------------|-------|
| `items` | `itemsData` | const array |
| `placedItems` | `placedItemsData` | const array |
| `animatedProps` | `animatedPropsData` | const array |
| `placedAnimProps` | `placedAnimPropsData` | const array |
| `dialogs` | `dialogs` | const array |
| `placedDialogTiles` | `placedDialogTiles` | const array |
| `shops` | `shopsData` | let variable |
| `quests` | `questsData` | let variable |

Note: `const` arrays can still be modified with `.push()`, `.splice()`, etc.

---

## Implementation: Add These Cases to applyLiveEdit()

### 1. Item Handlers

```javascript
case 'addItem':
    if (typeof itemsData !== 'undefined' && edit.item) {
        itemsData.push(edit.item);
        if (edit.item.spriteData) {
            const img = new Image();
            img.src = edit.item.spriteData;
            itemImages.push(img);
        }
        console.log('[LIVE SYNC] Added item definition:', edit.item.name);
    }
    break;

case 'updateItem':
    if (typeof itemsData !== 'undefined' && edit.index >= 0 && edit.index < itemsData.length && edit.item) {
        itemsData[edit.index] = edit.item;
        if (edit.item.spriteData && itemImages) {
            const img = new Image();
            img.src = edit.item.spriteData;
            itemImages[edit.index] = img;
        }
        console.log('[LIVE SYNC] Updated item definition:', edit.item.name);
    }
    break;

case 'deleteItem':
    if (typeof itemsData !== 'undefined' && edit.index >= 0 && edit.index < itemsData.length) {
        itemsData.splice(edit.index, 1);
        if (itemImages) itemImages.splice(edit.index, 1);
        console.log('[LIVE SYNC] Deleted item at index', edit.index);
    }
    break;

case 'placeItem':
    if (typeof placedItemsData !== 'undefined' && edit.item) {
        placedItemsData.push(edit.item);
        console.log('[LIVE SYNC] Placed item at', edit.item.x, edit.item.y);
        liveSyncNeedsRedraw = true;
    }
    break;

case 'removeItem':
    if (typeof placedItemsData !== 'undefined') {
        for (let i = placedItemsData.length - 1; i >= 0; i--) {
            const item = placedItemsData[i];
            if (item.x === edit.x && item.y === edit.y &&
                (item.mapName || 'main') === (edit.mapName || 'main')) {
                placedItemsData.splice(i, 1);
                break;
            }
        }
        console.log('[LIVE SYNC] Removed item at', edit.x, edit.y);
        liveSyncNeedsRedraw = true;
    }
    break;
```

### 2. Animated Prop Handlers

```javascript
case 'addAnimProp':
    if (typeof animatedPropsData !== 'undefined' && edit.prop) {
        animatedPropsData.push(edit.prop);
        if (edit.prop.spriteData) {
            const img = new Image();
            img.src = edit.prop.spriteData;
            animatedPropImages.push(img);
        }
        console.log('[LIVE SYNC] Added animated prop:', edit.prop.name);
    }
    break;

case 'updateAnimProp':
    if (typeof animatedPropsData !== 'undefined' && edit.index >= 0 && edit.index < animatedPropsData.length && edit.prop) {
        animatedPropsData[edit.index] = edit.prop;
        if (edit.prop.spriteData && animatedPropImages) {
            const img = new Image();
            img.src = edit.prop.spriteData;
            animatedPropImages[edit.index] = img;
        }
        console.log('[LIVE SYNC] Updated animated prop:', edit.prop.name);
    }
    break;

case 'removeAnimProp':
    if (typeof animatedPropsData !== 'undefined' && edit.index >= 0 && edit.index < animatedPropsData.length) {
        animatedPropsData.splice(edit.index, 1);
        if (animatedPropImages) animatedPropImages.splice(edit.index, 1);
        console.log('[LIVE SYNC] Removed animated prop at index', edit.index);
    }
    break;
```

### 3. Dialog Handlers

```javascript
case 'addDialog':
    if (typeof dialogs !== 'undefined' && edit.dialog) {
        dialogs.push(edit.dialog);
        console.log('[LIVE SYNC] Added dialog:', edit.dialog.name);
    }
    break;

case 'updateDialog':
    if (typeof dialogs !== 'undefined' && edit.index >= 0 && edit.index < dialogs.length && edit.dialog) {
        dialogs[edit.index] = edit.dialog;
        console.log('[LIVE SYNC] Updated dialog:', edit.dialog.name);
    }
    break;

case 'deleteDialog':
    if (typeof dialogs !== 'undefined' && edit.index >= 0 && edit.index < dialogs.length) {
        dialogs.splice(edit.index, 1);
        console.log('[LIVE SYNC] Deleted dialog at index', edit.index);
    }
    break;

case 'placeDialogTile':
    if (typeof placedDialogTiles !== 'undefined' && edit.tile) {
        placedDialogTiles.push(edit.tile);
        console.log('[LIVE SYNC] Placed dialog tile at', edit.tile.x, edit.tile.y);
        liveSyncNeedsRedraw = true;
    }
    break;

case 'removeDialogTile':
    if (typeof placedDialogTiles !== 'undefined' && edit.index >= 0 && edit.index < placedDialogTiles.length) {
        placedDialogTiles.splice(edit.index, 1);
        console.log('[LIVE SYNC] Removed dialog tile at index', edit.index);
        liveSyncNeedsRedraw = true;
    }
    break;

case 'attachNpcDialog':
    if (typeof placedNpcs !== 'undefined' && edit.npcIndex >= 0 && edit.npcIndex < placedNpcs.length) {
        placedNpcs[edit.npcIndex].dialogIndex = edit.dialogIndex;
        placedNpcs[edit.npcIndex].dialogTrigger = edit.dialogTrigger;
        console.log('[LIVE SYNC] Attached dialog to NPC', edit.npcIndex);
    }
    break;
```

### 4. Shop Handlers

```javascript
case 'addShop':
    if (typeof shopsData !== 'undefined' && edit.shop) {
        shopsData.push(edit.shop);
        console.log('[LIVE SYNC] Added shop:', edit.shop.name);
    }
    break;

case 'updateShop':
    if (typeof shopsData !== 'undefined' && edit.index >= 0 && edit.index < shopsData.length && edit.shop) {
        shopsData[edit.index] = edit.shop;
        console.log('[LIVE SYNC] Updated shop:', edit.shop.name);
    }
    break;

case 'deleteShop':
    if (typeof shopsData !== 'undefined' && edit.index >= 0 && edit.index < shopsData.length) {
        shopsData.splice(edit.index, 1);
        console.log('[LIVE SYNC] Deleted shop at index', edit.index);
    }
    break;
```

### 5. Quest Handlers

```javascript
case 'addQuest':
    if (typeof questsData !== 'undefined' && edit.quest) {
        questsData.push(edit.quest);
        if (typeof questStates !== 'undefined' && edit.quest.id) {
            questStates[edit.quest.id] = {
                status: 'inactive',
                objectiveProgress: {}
            };
        }
        console.log('[LIVE SYNC] Added quest:', edit.quest.name);
    }
    break;

case 'updateQuest':
    if (typeof questsData !== 'undefined' && edit.questId && edit.quest) {
        const idx = questsData.findIndex(q => q.id === edit.questId);
        if (idx >= 0) {
            questsData[idx] = edit.quest;
            console.log('[LIVE SYNC] Updated quest:', edit.quest.name);
        }
    }
    break;

case 'deleteQuest':
    if (typeof questsData !== 'undefined' && edit.questId) {
        const idx = questsData.findIndex(q => q.id === edit.questId);
        if (idx >= 0) {
            questsData.splice(idx, 1);
            if (typeof questStates !== 'undefined') {
                delete questStates[edit.questId];
            }
            console.log('[LIVE SYNC] Deleted quest:', edit.questId);
        }
    }
    break;
```

### 6. Player Character Handlers (log only - requires restart)

```javascript
case 'addPlayerCharacter':
    console.log('[LIVE SYNC] Player character added (restart game to apply)');
    break;

case 'updatePlayerCharacter':
    console.log('[LIVE SYNC] Player character updated (restart game to apply)');
    break;

case 'deletePlayerCharacter':
    console.log('[LIVE SYNC] Player character deleted (restart game to apply)');
    break;

case 'setActivePlayer':
    console.log('[LIVE SYNC] Active player changed (restart game to apply)');
    break;
```

### 7. Tileset Handlers

```javascript
case 'addTileset':
    if (typeof tilesetsData !== 'undefined' && edit.data) {
        tilesetsData.push({ name: edit.name, data: edit.data });
        const img = new Image();
        img.src = edit.data;
        tilesetImages.push(img);
        console.log('[LIVE SYNC] Added tileset:', edit.name);
    }
    break;

case 'deleteTileset':
    if (typeof tilesetsData !== 'undefined' && edit.index >= 0 && edit.index < tilesetsData.length) {
        tilesetsData.splice(edit.index, 1);
        tilesetImages.splice(edit.index, 1);
        console.log('[LIVE SYNC] Deleted tileset at index', edit.index);
        liveSyncNeedsRedraw = true;
    }
    break;
```

### 8. Layer Reorder Handlers

```javascript
case 'moveLayerUp':
    if (edit.mapName === gameMapName || !edit.mapName) {
        if (edit.index > 0 && edit.index < layers.length) {
            const temp = layers[edit.index];
            layers[edit.index] = layers[edit.index - 1];
            layers[edit.index - 1] = temp;
            liveSyncNeedsRedraw = true;
        }
    }
    break;

case 'moveLayerDown':
    if (edit.mapName === gameMapName || !edit.mapName) {
        if (edit.index >= 0 && edit.index < layers.length - 1) {
            const temp = layers[edit.index];
            layers[edit.index] = layers[edit.index + 1];
            layers[edit.index + 1] = temp;
            liveSyncNeedsRedraw = true;
        }
    }
    break;
```

### 9. Map Expand Handler

```javascript
case 'expandMap':
    if (edit.mapName === gameMapName || !edit.mapName) {
        const dir = edit.direction;
        if (dir === 'right' || dir === 'left') {
            mapCols++;
            layers.forEach(layer => {
                layer.forEach(row => {
                    if (dir === 'right') row.push(null);
                    else row.unshift(null);
                });
            });
        } else if (dir === 'down' || dir === 'up') {
            mapRows++;
            layers.forEach(layer => {
                const newRow = new Array(mapCols).fill(null);
                if (dir === 'down') layer.push(newRow);
                else layer.unshift(newRow);
            });
        }
        liveSyncNeedsRedraw = true;
        console.log('[LIVE SYNC] Expanded map:', edit.direction);
    }
    break;
```

### 10. Collision Bulk Operation Handlers

```javascript
case 'selectAllCollision':
    if (typeof tileCollisions !== 'undefined' && edit.tilesetIndex >= 0) {
        const ts = tilesetsData[edit.tilesetIndex];
        if (ts) {
            const img = tilesetImages[edit.tilesetIndex];
            if (img && img.complete) {
                const cols = Math.floor(img.width / gridSize);
                const rows = Math.floor(img.height / gridSize);
                for (let ty = 0; ty < rows; ty++) {
                    for (let tx = 0; tx < cols; tx++) {
                        tileCollisions[edit.tilesetIndex + ':' + tx + ',' + ty] = true;
                    }
                }
            }
        }
        console.log('[LIVE SYNC] Selected all collision for tileset', edit.tilesetIndex);
    }
    break;

case 'clearAllCollision':
    if (typeof tileCollisions !== 'undefined' && edit.tilesetIndex >= 0) {
        const prefix = edit.tilesetIndex + ':';
        Object.keys(tileCollisions).forEach(key => {
            if (key.startsWith(prefix)) {
                delete tileCollisions[key];
            }
        });
        console.log('[LIVE SYNC] Cleared all collision for tileset', edit.tilesetIndex);
    }
    break;
```

---

## Summary of Changes

| Category | Edit Types Added | Count |
|----------|------------------|-------|
| Items | addItem, updateItem, deleteItem, placeItem, removeItem | 5 |
| Animated Props | addAnimProp, updateAnimProp, removeAnimProp | 3 |
| Dialogs | addDialog, updateDialog, deleteDialog, placeDialogTile, removeDialogTile, attachNpcDialog | 6 |
| Shops | addShop, updateShop, deleteShop | 3 |
| Quests | addQuest, updateQuest, deleteQuest | 3 |
| Player | addPlayerCharacter, updatePlayerCharacter, deletePlayerCharacter, setActivePlayer | 4 |
| Tilesets | addTileset, deleteTileset | 2 |
| Layers | moveLayerUp, moveLayerDown | 2 |
| Map | expandMap | 1 |
| Collision | selectAllCollision, clearAllCollision | 2 |

**Total: 31 new case handlers**

---

## Verification Steps

1. Open builder and create/join a multiplayer room
2. Click "Test Map" to open the test game
3. In the builder, perform each type of edit and verify it syncs to the test game:
   - Add/edit/delete an item definition
   - Place/remove items on the map
   - Add/edit dialogs and attach to NPCs
   - Create/modify shops
   - Add/update quests
   - Add animated props
   - Modify collision (select all / clear all)
4. Have a second person join the builder room and verify their edits also sync to the test game
