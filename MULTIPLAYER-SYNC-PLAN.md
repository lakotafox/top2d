# Complete Builder Sync Audit - All Inputs & Broadcast Coverage

## Status: IMPLEMENTING ALL FIXES

### Fixes to Implement (12 functions + handlers)

**NPC System (5 functions):**
1. `updateNpcTrigger()` - line ~10984 - add broadcast
2. `updateNpcSpeed()` - line ~10989 - add broadcast
3. `updateNpcAnimSpeed()` - line ~10996 - add broadcast
4. `setWaypointAction()` - line ~11085 - add broadcast
5. `setWaypointDuration()` - line ~11102 - add broadcast

**Sound System (1 function):**
6. `saveSelectedSound()` - line ~5279 - add broadcast for edits

**Item System (3 functions + new handlers):**
7. `itemSave()` - line ~12660 - add `addItem`/`updateItem` broadcast
8. `deleteItem()` - line ~12774 - add `deleteItem` broadcast
9. `removePlacedItem()` - line ~12809 - add `removeItem` broadcast

**Map System (2 functions + new handlers):**
10. `expandMap()` - line ~8083 - add `expandMap` broadcast
11. `deleteTileset()` - line ~3738 - add `deleteTileset` broadcast

**Collision System (1 function):**
12. `setSplitLineY()` - line ~4567 - add `splitLine` broadcast

**Also need to add handlers in `applyRemoteEdit()` for:**
- `addItem`, `updateItem`, `deleteItem`
- `expandMap`
- `deleteTileset`

---

### NEW FEATURE: Modal Editing Lock/Warning System

**Problem:** Two players might open the same NPC/Prop/Item editor at once, causing conflicts.

**Solution:** Broadcast when opening/closing modals, show warning if someone else is editing.

**New editTypes needed:**
- `startEditing` - { type: 'npc'|'animProp'|'item'|'player', index: number, username: string }
- `stopEditing` - { type: 'npc'|'animProp'|'item'|'player', index: number }

**Implementation:**
1. Track `currentlyEditing = {}` - who's editing what
2. On modal open: `broadcastEdit({ editType: 'startEditing', type, index, username })`
3. On modal close/save: `broadcastEdit({ editType: 'stopEditing', type, index })`
4. Show visual indicator on items being edited (e.g., yellow border, "Edited by Player2")
5. Show warning when trying to open something being edited by someone else
6. Handle if player disconnects while editing (clear their locks)

---

## Executive Summary

**Total inputs audited:** 200+ across all tabs/modals
**broadcastEdit calls found:** 74
**applyRemoteEdit handlers:** 46
**applyLiveEdit handlers:** 23

**Critical bugs found:** 35+ missing sync operations

---

## CRITICAL BUGS - Functions That Don't Broadcast

### NPC System (HIGH PRIORITY)

| Function | Line | What It Does | Impact |
|----------|------|--------------|--------|
| `updateNpcTrigger()` | 10984 | Sets NPC trigger type (interact/proximity) | Other builders don't see trigger changes |
| `updateNpcSpeed()` | 10989 | Sets NPC walk speed | Other builders don't see speed changes |
| `updateNpcAnimSpeed()` | 10996 | Sets NPC animation FPS | Other builders don't see FPS changes |
| `setWaypointAction()` | 11085 | Changes waypoint animation type | Waypoint actions don't sync |
| `setWaypointDuration()` | 11102 | Changes waypoint idle time | Waypoint durations don't sync |

**Fix:** Add `broadcastEdit({ editType: 'updatePlacedNpc', index, npc })` to each function.

---

### Sound System

| Function | Line | What It Does | Impact |
|----------|------|--------------|--------|
| `saveSelectedSound()` | 5279 | Updates tile sound parameters | Sound edits don't sync (only placement does) |

**Fix:** Add `broadcastEdit({ editType: 'tileSound', key, sound })` after updating.

---

### Item System

| Function | Line | What It Does | Impact |
|----------|------|--------------|--------|
| `itemSave()` | 12660 | Creates/updates item definition | Item definitions don't sync |
| `deleteItem()` | 12774 | Deletes item definition | Item deletions don't sync |
| `removePlacedItem()` | 12809 | UI button removal | Inconsistent - right-click syncs, button doesn't |

**Fix:** Add `addItem`, `updateItem`, `deleteItem` editTypes.

---

### Map/Layer System

| Function | Line | What It Does | Impact |
|----------|------|--------------|--------|
| `expandMap()` | 8083 | Expands map boundaries | Map expansion causes MAJOR desync |
| `deleteTileset()` | 3738 | Deletes tileset | Tileset deletion doesn't sync |

**Fix:** Add `expandMap`, `deleteTileset` editTypes.

---

### Collision System

| Function | Line | What It Does | Impact |
|----------|------|--------------|--------|
| `setSplitLineY()` | 4567 | Sets split line Y value via button | Split line Y doesn't sync (drag does) |

**Fix:** Add broadcast after setting `tileSplitLines[key]`.

---

## Summary by Category

### What DOES Sync Correctly

| Category | Builder↔Builder | Builder→Test Game |
|----------|-----------------|-------------------|
| Tile painting | ✅ | ✅ |
| Tile erasing | ✅ | ✅ |
| Collision masks | ✅ | ✅ |
| Split lines (drag) | ✅ | ✅ |
| NPC placement/removal | ✅ | ✅ |
| NPC enemy config (damage, vision, etc.) | ✅ | ✅ |
| NPC waypoint add/remove/clear | ✅ | ✅ |
| Trigger placement/removal | ✅ | ✅ |
| Point light placement/removal | ✅ | ✅ |
| Tile sound placement/removal | ✅ | ✅ |
| Layer add/delete/reorder | ✅ | Partial |
| Map add/delete/rename | ✅ | ❌ |
| Camera bounds | ✅ | ✅ |
| Dialog definitions | ✅ | ❌ |
| NPC definitions | ✅ | Partial |
| Player definitions | ✅ | ❌ |
| AnimProp definitions | ✅ | ❌ |

### What DOESN'T Sync

| Category | Builder↔Builder | Builder→Test Game |
|----------|-----------------|-------------------|
| NPC trigger type | ❌ | ❌ |
| NPC walk speed | ❌ | ❌ |
| NPC animation FPS | ❌ | ❌ |
| Waypoint action/duration | ❌ | ❌ |
| Tile sound EDITS | ❌ | ❌ |
| Item definitions | ❌ | ❌ |
| Map expansion | ❌ | ❌ |
| Tileset deletion | ❌ | ❌ |
| Split line Y button | ❌ | ❌ |

---

## Implementation Details

### Fix 1-5: NPC System Functions
Add this line after each function updates `placed`:
```javascript
broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
```

**Functions to modify:**
- `updateNpcTrigger()` - after `placed.trigger = ...`
- `updateNpcSpeed()` - after `placed.speed = ...`
- `updateNpcAnimSpeed()` - after `placed.animSpeed = ...`
- `setWaypointAction()` - after updating waypoint action
- `setWaypointDuration()` - after updating waypoint duration

### Fix 6: saveSelectedSound()
After updating `tileSounds[selectedSoundKey]`, add:
```javascript
broadcastEdit({ editType: 'tileSound', key: selectedSoundKey, sound: tileSounds[selectedSoundKey] });
```

### Fix 7: itemSave()
After pushing/updating item in `items[]`, add:
```javascript
if (editingItemIndex >= 0) {
    broadcastEdit({ editType: 'updateItem', index: editingItemIndex, item: itemData });
} else {
    broadcastEdit({ editType: 'addItem', item: itemData });
}
```

### Fix 8: deleteItem()
After removing from `items[]`, add:
```javascript
broadcastEdit({ editType: 'deleteItem', index: index });
```

### Fix 9: removePlacedItem()
Add same broadcast as `removeItemAt()`:
```javascript
broadcastEdit({ editType: 'removeItem', x: item.x, y: item.y, mapName: item.mapName });
```

### Fix 10: expandMap()
After expanding layers/collision, add:
```javascript
broadcastEdit({ editType: 'expandMap', direction: direction, mapName: currentMapName });
```

### Fix 11: deleteTileset()
After removing tileset, add:
```javascript
broadcastEdit({ editType: 'deleteTileset', index: tilesetIndex });
```

### Fix 12: setSplitLineY()
After setting `tileSplitLines[key]`, add:
```javascript
broadcastEdit({ editType: 'splitLine', key: key, mask: tileSplitLines[key] });
```

---

## New Handlers for applyRemoteEdit()

### addItem handler:
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

### updateItem handler:
```javascript
case 'updateItem':
    if (edit.index >= 0 && edit.index < items.length) {
        items[edit.index] = edit.item;
        if (edit.item.spriteData) {
            const img = new Image();
            img.onload = () => { itemImages[edit.index] = img; updateItemList(); };
            img.src = edit.item.spriteData;
        }
        updateItemList();
    }
    break;
```

### deleteItem handler:
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

### expandMap handler:
```javascript
case 'expandMap':
    if (edit.mapName === currentMapName) {
        expandMap(edit.direction, true); // true = fromNetwork
    } else if (maps[edit.mapName]) {
        // Expand other map's data
        // ... handle remote map expansion
    }
    break;
```

### deleteTileset handler:
```javascript
case 'deleteTileset':
    if (edit.index >= 0 && edit.index < tilesets.length) {
        deleteTileset(true); // true = fromNetwork, need to add this param
    }
    break;
```

---

## File to Modify

**world-builder.html** - All changes in single file (~22,800 lines)
