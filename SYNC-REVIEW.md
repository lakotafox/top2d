# Multiplayer Sync Implementation Review

## Overview

This document summarizes all multiplayer sync fixes implemented in `world-builder.html` to ensure co-op builders stay synchronized.

---

## Broadcast Fixes Implemented

### NPC System (5 functions)

| Function | Line | What It Does | Fix Applied |
|----------|------|--------------|-------------|
| `updateNpcTrigger()` | ~10984 | Sets NPC trigger type | Already had broadcast |
| `updateNpcSpeed()` | ~10989 | Sets NPC walk speed | Already had broadcast |
| `updateNpcAnimSpeed()` | ~10996 | Sets NPC animation FPS | Already had broadcast |
| `setWaypointAction()` | ~11085 | Changes waypoint animation | Added `broadcastEdit({ editType: 'updatePlacedNpc', ... })` |
| `setWaypointDuration()` | ~11102 | Changes waypoint idle time | Added `broadcastEdit({ editType: 'updatePlacedNpc', ... })` |

### Sound System (1 function)

| Function | Line | Fix Applied |
|----------|------|-------------|
| `saveSelectedSound()` | ~5303 | Added `broadcastEdit({ editType: 'tileSound', key, sound })` |

### Item System (3 functions)

| Function | Line | Fix Applied |
|----------|------|-------------|
| `itemSave()` | ~12770 | Added `broadcastEdit({ editType: 'addItem' })` for new items, `broadcastEdit({ editType: 'updateItem' })` for edits |
| `deleteItem()` | ~12784 | Added `broadcastEdit({ editType: 'deleteItem', index })` |
| `removePlacedItem()` | ~12817 | Added `broadcastEdit({ editType: 'removeItem', x, y, mapName })` |

### Map System (2 functions)

| Function | Line | Fix Applied |
|----------|------|-------------|
| `expandMap()` | ~8084 | Added `fromNetwork` parameter, broadcasts `{ editType: 'expandMap', direction, mapName }`. Also improved to shift NPCs, items, triggers on left/top expansion. |
| `deleteTileset()` | ~3738 | Added `fromNetwork` and `networkTilesetIndex` parameters, broadcasts `{ editType: 'deleteTileset', index }` |

### Collision System (1 function)

| Function | Line | Fix Applied |
|----------|------|-------------|
| `setSplitLineY()` | ~4588 | Added `broadcastEdit({ editType: 'splitLine', key, mask })` |

---

## New applyRemoteEdit Handlers

Added to `applyRemoteEdit()` function (around line 14923):

### addItem
```javascript
case 'addItem':
    items.push(edit.item);
    if (edit.item.spriteData) {
        const img = new Image();
        img.onload = () => { itemImages[items.length - 1] = img; updateItemList(); };
        img.src = edit.item.spriteData;
    }
    updateItemList();
    break;
```

### updateItem
```javascript
case 'updateItem':
    if (edit.index >= 0 && edit.index < items.length && edit.item) {
        items[edit.index] = edit.item;
        // Load sprite image...
        updateItemList();
    }
    break;
```

### deleteItem
```javascript
case 'deleteItem':
    if (edit.index >= 0 && edit.index < items.length) {
        items.splice(edit.index, 1);
        itemImages.splice(edit.index, 1);
        // Update placedItems indices
        placedItems = placedItems.filter(pi => pi.itemIndex !== edit.index);
        placedItems.forEach(pi => { if (pi.itemIndex > edit.index) pi.itemIndex--; });
        updateItemList();
        updatePlacedItemsList();
        renderMap();
    }
    break;
```

### expandMap
```javascript
case 'expandMap':
    if (edit.mapName === currentMapName) {
        expandMap(edit.direction, true); // true = fromNetwork
    } else if (maps[edit.mapName]) {
        // Expand other map's data directly
    }
    break;
```

### deleteTileset
```javascript
case 'deleteTileset':
    if (edit.index >= 0 && edit.index < tilesets.length) {
        deleteTileset(true, edit.index); // fromNetwork, index
    }
    break;
```

### startEditing / stopEditing
```javascript
case 'startEditing':
    const key = edit.editorType + ':' + edit.editorIndex;
    currentlyEditing[key] = { username: edit.username };
    break;

case 'stopEditing':
    const key = edit.editorType + ':' + edit.editorIndex;
    delete currentlyEditing[key];
    break;
```

---

## Modal Editing Lock/Warning System

### New Global Variables (line ~13836)

```javascript
let currentlyEditing = {};  // Format: { 'npc:0': { username: 'Player1' }, ... }
let myEditingKey = null;    // What am I currently editing?
```

### New Helper Functions (line ~13839)

```javascript
function isBeingEdited(type, index)  // Returns true if someone else is editing
function getEditor(type, index)      // Returns username of editor or null
function startEditing(type, index)   // Marks as editing, broadcasts startEditing
function stopEditing()               // Clears my editing lock, broadcasts stopEditing
function clearPlayerEdits(username)  // Clears all locks for disconnected player
```

### Modified Modal Functions

Each editor function now:
1. Checks if someone else is editing (shows warning if so)
2. Broadcasts `startEditing` when opening existing item for edit
3. Calls `stopEditing()` on save and cancel

| Function | Line | Changes |
|----------|------|---------|
| `openNpcEditor()` | ~8537 | Added edit lock check and startEditing broadcast |
| `openPlayerEditor()` | ~9394 | Added edit lock check and startEditing broadcast |
| `openAnimPropEditor()` | ~11420 | Added edit lock check and startEditing broadcast |
| `openItemEditor()` | ~12434 | Added edit lock check and startEditing broadcast |

### Save/Cancel Functions Updated

Added `stopEditing()` call to:
- `npcSave()` close section (~9309)
- `npcCancel()` (~9316)
- `playerSave()` close section (~10406)
- `playerCancel()` (~10413)
- `animPropSave()` close section (~12415)
- `animPropCancel()` (~12423)
- `itemSave()` close section (~12782)
- `itemCancel()` (~12790)

### Disconnect Handling

Updated `handleBuilderMessage()` leave handler (~14123):
```javascript
if (data.type === 'leave') {
    if (data.playerId) {
        const leavingPlayer = builderPlayersInRoom.get(data.playerId);
        if (leavingPlayer && leavingPlayer.name) {
            clearPlayerEdits(leavingPlayer.name);  // NEW: Clear their locks
        }
        builderPlayersInRoom.delete(data.playerId);
    }
}
```

---

## What Still Doesn't Sync (By Design)

These were reviewed and intentionally left as local-only:

| Feature | Reason |
|---------|--------|
| Layer visibility | Different builders may want to see different layers |
| Lighting settings | Local preference during editing |
| Player sounds | Will be per-player when character selection is added |

---

## Testing Checklist

To verify sync is working:

1. **Item definitions**: Create/edit/delete items in one builder, verify appears in other
2. **Placed items**: Place/remove items, verify syncs
3. **Map expansion**: Expand map in any direction, verify other builder sees it
4. **Tileset deletion**: Delete tileset, verify removed on other builder
5. **Split lines**: Use "Set Y" button on collision phase, verify syncs
6. **Sound edits**: Edit existing tile sound settings, verify syncs
7. **NPC waypoints**: Change waypoint action/duration, verify syncs
8. **Edit warnings**: Open same NPC/Item/Prop editor on both builders, verify warning appears
9. **Disconnect cleanup**: Have one builder editing, disconnect them, verify lock clears

---

## File Reference

All changes are in: `world-builder.html`

Key sections:
- Editing lock system: lines ~13834-13940
- applyRemoteEdit handlers: lines ~14278-14940
- Modal editor functions: search for `openNpcEditor`, `openPlayerEditor`, `openAnimPropEditor`, `openItemEditor`
