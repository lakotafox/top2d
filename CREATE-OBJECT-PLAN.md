# CREATE OBJECT Feature - Comprehensive Implementation Plan

## Overview
Add a "CREATE OBJECT" button to the Tiles tab that lets users quickly create static (1-frame) props from tileset selections without the full Animated Prop editor. Static objects inherit collision from their source tileset tiles.

## File to Edit
`/Users/khabefox/zelda-game/world-builder.html` (~26,000 lines)

---

## User Workflow
1. Click "CREATE OBJECT" button (Tiles tab, under Select Tiles)
2. Click/drag on tileset palette to select tiles
3. Button changes to "FINISH" (gold color)
4. Click "FINISH" → enter name → saved as static object
5. Switch to Props tab → see it in "Static Objects" section
6. Select object, use scale slider (0.5x - 3x), click on map to place
7. Collision automatically inherited from source tileset tiles (scales with object)

---

## EXACT LINE NUMBERS AND CODE LOCATIONS

### Key Locations Reference
| Feature | Lines | Function/Element |
|---------|-------|------------------|
| Select Tiles button | 1470-1474 | `#tileExtraButtons` div |
| Animated Props tab HTML | 1712-1742 | `#animPropModeContent` div |
| setMode() function | 5242-5307 | Mode switching logic |
| Tile selection variables | 3460-3469 | `selectedTileData`, `selectedTiles` |
| toggleTileSelectMode() | 6122-6138 | Toggle selection mode |
| Animated props variables | 3589-3606 | `animatedProps[]`, `placedAnimProps[]` |
| placeAnimPropAt() | 6770-6835 | Placement logic |
| removeAnimPropAt() | 6837-6889 | Removal logic |
| renderMap() animTile | 7286-7363 | Rendering animated tiles |
| Hover preview | 7501-7550 | Preview during placement |
| updateAnimPropListDisplay() | 14483-14556 | List UI update |
| getProjectData() | 15386-15525 | Save serialization |
| loadProject() | 17295-17728 | Load deserialization |
| applyRemoteEdit() | 16164-16853 | Multiplayer sync |
| broadcastEdit() | 16915-16958 | Send edits to multiplayer |

---

## STEP 1: Add Data Structures (~line 3606)

Add after the animated props variables (around line 3606):

```javascript
// Static Objects System (tiles saved as reusable props)
let staticObjects = [];           // { name, spriteData, width, height, tilesetIndex, sourceTiles, sourceOrigin, _spriteImg }
let placedStaticObjects = [];     // { objIndex, x, y, mapName, scale }
let currentStaticObjIndex = -1;
let staticObjPlacementScale = 1.0;
let createObjectMode = false;
```

**Data structure details:**

```javascript
// Static Object Definition
{
    name: string,                    // User-provided name
    spriteData: string,              // Base64 data URL of extracted tile region
    width: number,                   // Width in tiles
    height: number,                  // Height in tiles
    tilesetIndex: number,            // Source tileset index (for collision lookup)
    sourceTiles: [{x, y}, ...],      // Array of source tile coordinates
    sourceOrigin: {x, y},            // Top-left tile coordinate
    _spriteImg: Image                // Loaded Image object (not saved)
}

// Placed Static Object
{
    objIndex: number,                // Index in staticObjects array
    x: number,                       // World X position (pixels)
    y: number,                       // World Y position (pixels)
    mapName: string,                 // Map this is placed on
    scale: number                    // Scale factor (0.5 - 3.0)
}
```

---

## STEP 2: Add CREATE OBJECT Button HTML (~line 1474)

Find the `#tileExtraButtons` div at lines 1470-1474:

```html
<!-- CURRENT CODE -->
<div id="tileExtraButtons">
    <div style="display:flex; gap:5px; margin-bottom:5px;">
        <button id="tileSelectModeBtn" onclick="toggleTileSelectMode()" style="flex:1; background:#555;">Select Tiles</button>
    </div>
</div>
```

**CHANGE TO:**

```html
<div id="tileExtraButtons">
    <div style="display:flex; gap:5px; margin-bottom:5px;">
        <button id="tileSelectModeBtn" onclick="toggleTileSelectMode()" style="flex:1; background:#555;">Select Tiles</button>
    </div>
    <!-- CREATE OBJECT button - appears when in tile mode -->
    <div style="display:flex; gap:5px; margin-bottom:5px;">
        <button id="createObjectBtn" onclick="toggleCreateObjectMode()" style="flex:1; background:#4a7c59; font-weight:bold;">CREATE OBJECT</button>
    </div>
</div>
```

---

## STEP 3: Update Props Tab HTML (~line 1712)

Find `#animPropModeContent` at lines 1712-1742. Add Static Objects section BEFORE the Animated Props section:

```html
<div id="animPropModeContent" style="display:none;">
    <!-- ========== STATIC OBJECTS SECTION (NEW) ========== -->
    <h3 style="color:#4a7c59; margin-bottom:10px; border-bottom:1px solid #4a7c59; padding-bottom:5px;">Static Objects</h3>
    <div id="staticObjList" style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:10px; max-height:200px; overflow-y:auto;"></div>

    <p style="color:#888; font-size:10px; margin-bottom:8px;">Use CREATE OBJECT in Tiles tab to add new objects from tileset selections.</p>

    <!-- Scale Slider for Static Objects -->
    <div id="staticObjPlacementControls" style="display:none; margin-bottom:15px; padding:8px; background:#1a2a35; border-radius:4px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
            <span style="font-size:11px; color:#aaa;">Scale:</span>
            <span id="staticObjScaleValue" style="font-size:10px; color:#4a7c59;">1.0x</span>
        </div>
        <input type="range" id="staticObjScaleSlider" min="0.5" max="3" step="0.1" value="1"
               oninput="updateStaticObjScale(this.value)" style="width:100%;">
        <p style="font-size:9px; color:#666; margin-top:5px;">Click map to place. Right-click to remove.</p>
    </div>

    <hr style="margin:15px 0; border-color:#444;">

    <!-- ========== ANIMATED PROPS SECTION (EXISTING) ========== -->
    <h3>Animated Props</h3>
    <!-- ... rest of existing animated props content ... -->
</div>
```

---

## STEP 4: Add Toggle Functions (~line 6138)

Add after `toggleTileSelectMode()` function (around line 6138):

```javascript
// ========== CREATE OBJECT MODE ==========

function toggleCreateObjectMode() {
    if (!createObjectMode) {
        // Enter create object mode
        createObjectMode = true;
        tileSelectModeActive = true; // Enable tile selection
        selectedTiles = [];
        selectedTileData = null;

        // Update Select Tiles button to show mode is active
        const selectBtn = document.getElementById('tileSelectModeBtn');
        if (selectBtn) {
            selectBtn.style.background = '#4af';
            selectBtn.style.color = '#000';
            selectBtn.textContent = 'Select Mode ON';
        }
    } else {
        // Finish - create object from selection
        if (selectedTileData && selectedTiles.length > 0) {
            createStaticObjectFromSelection();
        } else {
            alert('Please select tiles from the tileset first.');
        }

        // Exit mode
        createObjectMode = false;
        tileSelectModeActive = false;

        // Reset Select Tiles button
        const selectBtn = document.getElementById('tileSelectModeBtn');
        if (selectBtn) {
            selectBtn.style.background = '#555';
            selectBtn.style.color = 'white';
            selectBtn.textContent = 'Select Tiles';
        }
    }
    updateCreateObjectButton();
}

function updateCreateObjectButton() {
    const btn = document.getElementById('createObjectBtn');
    if (!btn) return;

    if (createObjectMode) {
        if (selectedTileData && selectedTiles.length > 0) {
            btn.textContent = 'FINISH';
            btn.style.background = '#c9a227'; // Gold
            btn.style.color = '#000';
        } else {
            btn.textContent = 'SELECT TILES...';
            btn.style.background = '#666';
            btn.style.color = '#fff';
        }
    } else {
        btn.textContent = 'CREATE OBJECT';
        btn.style.background = '#4a7c59'; // Green
        btn.style.color = '#fff';
    }
}

function updateStaticObjScale(value) {
    staticObjPlacementScale = parseFloat(value);
    const label = document.getElementById('staticObjScaleValue');
    if (label) label.textContent = staticObjPlacementScale.toFixed(1) + 'x';
}
```

---

## STEP 5: Create Object from Selection (~line 6200)

Add the main creation function:

```javascript
function createStaticObjectFromSelection() {
    if (!selectedTileData || currentTilesetIndex < 0) {
        alert('No tiles selected.');
        return;
    }

    const tileset = tilesets[currentTilesetIndex];
    const img = tileset.img || tileset._img;
    if (!img) {
        alert('Tileset image not loaded.');
        return;
    }

    // Extract tile region to canvas
    const pixelX = selectedTileData.x * gridSize;
    const pixelY = selectedTileData.y * gridSize;
    const pixelW = selectedTileData.width * gridSize;
    const pixelH = selectedTileData.height * gridSize;

    const canvas = document.createElement('canvas');
    canvas.width = pixelW;
    canvas.height = pixelH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, pixelX, pixelY, pixelW, pixelH, 0, 0, pixelW, pixelH);

    const spriteData = canvas.toDataURL('image/png');

    // Prompt for name
    const name = prompt('Name this object:', 'Object ' + (staticObjects.length + 1));
    if (!name || name.trim() === '') return;

    // Store source tiles for collision inheritance
    const sourceTiles = selectedTiles.map(t => ({ x: t.x, y: t.y }));

    // Create static object with tileset reference
    const obj = {
        name: name.trim(),
        spriteData: spriteData,
        width: selectedTileData.width,
        height: selectedTileData.height,
        tilesetIndex: currentTilesetIndex,      // For collision lookup
        sourceTiles: sourceTiles,                // For collision lookup
        sourceOrigin: { x: selectedTileData.x, y: selectedTileData.y },
        _spriteImg: new Image()
    };
    obj._spriteImg.src = spriteData;

    staticObjects.push(obj);

    // Broadcast for multiplayer
    broadcastEdit({
        editType: 'addStaticObj',
        obj: {
            name: obj.name,
            spriteData: obj.spriteData,
            width: obj.width,
            height: obj.height,
            tilesetIndex: obj.tilesetIndex,
            sourceTiles: obj.sourceTiles,
            sourceOrigin: obj.sourceOrigin
        }
    });

    // Clear selection
    selectedTiles = [];
    selectedTileData = null;

    // Update UI
    updateStaticObjectsList();

    // Switch to props tab and select the new object
    setMode('animProp');
    selectStaticObject(staticObjects.length - 1);

    console.log('[STATIC OBJ] Created:', obj.name, 'from tileset', obj.tilesetIndex);
}
```

---

## STEP 6: Static Object List UI (~line 14556)

Add after `updateAnimPropListDisplay()` function:

```javascript
// ========== STATIC OBJECTS LIST ==========

function updateStaticObjectsList() {
    const container = document.getElementById('staticObjList');
    if (!container) return;
    container.innerHTML = '';

    if (staticObjects.length === 0) {
        container.innerHTML = '<div style="color:#666; font-size:11px; padding:10px; text-align:center;">No static objects yet</div>';
        return;
    }

    staticObjects.forEach((obj, i) => {
        const item = document.createElement('div');
        const isSelected = (currentStaticObjIndex === i);
        item.style.cssText = `
            display:flex; align-items:center; gap:8px; padding:6px 8px;
            background:${isSelected ? '#2a4a3a' : '#333'};
            border:2px solid ${isSelected ? '#4a7c59' : 'transparent'};
            border-radius:5px; cursor:pointer; min-width:120px;
        `;
        item.onclick = () => selectStaticObject(i);

        // Preview thumbnail
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        canvas.style.cssText = 'border:1px solid #555; image-rendering:pixelated; flex-shrink:0;';
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        if (obj._spriteImg && obj._spriteImg.complete) {
            const srcW = obj.width * gridSize;
            const srcH = obj.height * gridSize;
            const scale = Math.min(32 / srcW, 32 / srcH);
            const drawW = srcW * scale;
            const drawH = srcH * scale;
            ctx.drawImage(obj._spriteImg, 0, 0, srcW, srcH,
                         (32 - drawW) / 2, (32 - drawH) / 2, drawW, drawH);
        }
        item.appendChild(canvas);

        // Info text
        const info = document.createElement('div');
        info.style.cssText = 'flex:1; min-width:0;';
        info.innerHTML = `
            <div style="color:#4a7c59; font-weight:bold; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${obj.name}</div>
            <div style="font-size:9px; color:#888;">${obj.width}x${obj.height} tiles</div>
        `;
        item.appendChild(info);

        // Delete button
        const delBtn = document.createElement('button');
        delBtn.textContent = '×';
        delBtn.style.cssText = 'padding:2px 6px; font-size:12px; background:#a55; border:none; color:white; cursor:pointer; border-radius:3px;';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            deleteStaticObject(i);
        };
        item.appendChild(delBtn);

        container.appendChild(item);
    });
}

function selectStaticObject(index) {
    currentStaticObjIndex = index;
    currentAnimPropIndex = -1; // Deselect animated props

    updateStaticObjectsList();
    updateAnimPropListDisplay();

    // Show/hide placement controls
    const controls = document.getElementById('staticObjPlacementControls');
    if (controls) {
        controls.style.display = (index >= 0) ? 'block' : 'none';
    }
}

function deleteStaticObject(index) {
    const obj = staticObjects[index];
    if (!obj) return;

    if (!confirm('Delete "' + obj.name + '"?\n\nAll placed instances will also be removed.')) return;

    // Remove placed instances
    placedStaticObjects = placedStaticObjects.filter(p => p.objIndex !== index);

    // Update indices for remaining placements
    placedStaticObjects.forEach(p => {
        if (p.objIndex > index) p.objIndex--;
    });

    // Remove from array
    staticObjects.splice(index, 1);

    // Fix selection
    if (currentStaticObjIndex >= staticObjects.length) {
        currentStaticObjIndex = staticObjects.length - 1;
    }
    if (currentStaticObjIndex < 0) {
        const controls = document.getElementById('staticObjPlacementControls');
        if (controls) controls.style.display = 'none';
    }

    // Broadcast
    broadcastEdit({ editType: 'removeStaticObj', index: index });

    updateStaticObjectsList();
    renderMap();
}
```

---

## STEP 7: Placement Logic (~line 6335)

Find the map click handler (inside `mapCanvas.addEventListener('mousedown', ...)` around line 6255). Add this check BEFORE the animated prop placement check:

```javascript
// Static object mode - click to place, right-click to remove
if (mode === 'animProp' && currentStaticObjIndex >= 0 && staticObjects[currentStaticObjIndex]) {
    if (e.button === 0) {
        placeStaticObjectAt(x, y);
    } else if (e.button === 2) {
        removeStaticObjectAt(worldX, worldY);
    }
    return;
}
```

Add the placement functions:

```javascript
function placeStaticObjectAt(gridX, gridY) {
    if (gridX < 0 || gridY < 0 || gridX >= mapCols || gridY >= mapRows) return;
    if (currentStaticObjIndex < 0 || !staticObjects[currentStaticObjIndex]) return;

    const worldX = gridX * gridSize;
    const worldY = gridY * gridSize;

    const placed = {
        objIndex: currentStaticObjIndex,
        x: worldX,
        y: worldY,
        mapName: currentMapName,
        scale: staticObjPlacementScale
    };

    placedStaticObjects.push(placed);

    broadcastEdit({
        editType: 'placeStaticObj',
        placed: placed
    });

    renderMap();
    console.log('[STATIC OBJ] Placed at', gridX, gridY, 'scale:', staticObjPlacementScale);
}

function removeStaticObjectAt(worldX, worldY) {
    // Search from top to bottom (last placed = on top)
    for (let i = placedStaticObjects.length - 1; i >= 0; i--) {
        const placed = placedStaticObjects[i];
        if (placed.mapName !== currentMapName) continue;

        const obj = staticObjects[placed.objIndex];
        if (!obj) continue;

        const scale = placed.scale || 1;
        const w = obj.width * gridSize * scale;
        const h = obj.height * gridSize * scale;

        if (worldX >= placed.x && worldX < placed.x + w &&
            worldY >= placed.y && worldY < placed.y + h) {

            broadcastEdit({
                editType: 'removeStaticObjPlacement',
                x: placed.x,
                y: placed.y,
                mapName: placed.mapName
            });

            placedStaticObjects.splice(i, 1);
            renderMap();
            console.log('[STATIC OBJ] Removed at', placed.x, placed.y);
            return;
        }
    }
}
```

---

## STEP 8: Render Static Objects in renderMap() (~line 7550)

Find where animated props are rendered (after the hover preview around line 7550). Add static object rendering:

```javascript
// ========== RENDER PLACED STATIC OBJECTS ==========
placedStaticObjects.forEach(placed => {
    if (placed.mapName !== currentMapName) return;

    const obj = staticObjects[placed.objIndex];
    if (!obj || !obj._spriteImg || !obj._spriteImg.complete) return;

    const scale = placed.scale || 1;
    const srcW = obj.width * gridSize;
    const srcH = obj.height * gridSize;
    const drawW = srcW * scale;
    const drawH = srcH * scale;

    // Draw position (already in world coords, need to subtract camera)
    const drawX = placed.x - camX;
    const drawY = placed.y - camY;

    mapCtx.imageSmoothingEnabled = false;
    mapCtx.drawImage(
        obj._spriteImg,
        0, 0, srcW, srcH,
        drawX, drawY, drawW, drawH
    );

    // Show outline in animProp mode when hovering near
    if (mode === 'animProp') {
        mapCtx.strokeStyle = '#4a7c59';
        mapCtx.lineWidth = 1;
        mapCtx.strokeRect(drawX, drawY, drawW, drawH);
    }
});

// ========== HOVER PREVIEW FOR STATIC OBJECTS ==========
if (mode === 'animProp' && hoverMapPos && currentStaticObjIndex >= 0 && !editAnimPropOnMapMode) {
    const obj = staticObjects[currentStaticObjIndex];
    if (obj && obj._spriteImg) {
        const scale = staticObjPlacementScale;
        const srcW = obj.width * gridSize;
        const srcH = obj.height * gridSize;
        const drawW = srcW * scale;
        const drawH = srcH * scale;
        const drawX = hoverMapPos.x * tileSize;
        const drawY = hoverMapPos.y * tileSize;

        mapCtx.globalAlpha = 0.5;
        mapCtx.imageSmoothingEnabled = false;
        mapCtx.drawImage(obj._spriteImg, 0, 0, srcW, srcH, drawX, drawY, drawW, drawH);
        mapCtx.globalAlpha = 1;

        // Outline
        mapCtx.strokeStyle = '#4a7c59';
        mapCtx.lineWidth = 2;
        mapCtx.strokeRect(drawX, drawY, drawW, drawH);
    }
}
```

---

## STEP 9: Save/Load Integration

### In getProjectData() (~line 15525)

Add before the closing return statement:

```javascript
// Static Objects
staticObjects: staticObjects.map(obj => ({
    name: obj.name,
    spriteData: obj.spriteData,
    width: obj.width,
    height: obj.height,
    tilesetIndex: obj.tilesetIndex,
    sourceTiles: obj.sourceTiles,
    sourceOrigin: obj.sourceOrigin
})),
placedStaticObjects: placedStaticObjects.map(p => ({
    objIndex: p.objIndex,
    x: p.x,
    y: p.y,
    mapName: p.mapName,
    scale: p.scale
})),
```

### In loadProject() (~line 17728)

Add after animated props loading:

```javascript
// Load static objects
staticObjects = [];
currentStaticObjIndex = -1;
placedStaticObjects = p.placedStaticObjects || [];

if (p.staticObjects && p.staticObjects.length > 0) {
    console.log('Loading', p.staticObjects.length, 'static objects');
    p.staticObjects.forEach((objData, i) => {
        staticObjects[i] = {
            name: objData.name,
            spriteData: objData.spriteData,
            width: objData.width,
            height: objData.height,
            tilesetIndex: objData.tilesetIndex,
            sourceTiles: objData.sourceTiles,
            sourceOrigin: objData.sourceOrigin,
            _spriteImg: new Image()
        };
        staticObjects[i]._spriteImg.src = objData.spriteData;
    });
}
updateStaticObjectsList();
```

---

## STEP 10: Multiplayer Sync

### In applyRemoteEdit() (~line 16853)

Add these cases to the switch statement:

```javascript
case 'addStaticObj':
    const newStaticObj = {
        name: edit.obj.name,
        spriteData: edit.obj.spriteData,
        width: edit.obj.width,
        height: edit.obj.height,
        tilesetIndex: edit.obj.tilesetIndex,
        sourceTiles: edit.obj.sourceTiles,
        sourceOrigin: edit.obj.sourceOrigin,
        _spriteImg: new Image()
    };
    newStaticObj._spriteImg.onload = () => {
        updateStaticObjectsList();
        renderMap();
    };
    newStaticObj._spriteImg.src = edit.obj.spriteData;
    staticObjects.push(newStaticObj);
    updateStaticObjectsList();
    console.log('[BUILDER MP] Remote static object added:', edit.obj.name);
    break;

case 'removeStaticObj':
    placedStaticObjects = placedStaticObjects.filter(p => p.objIndex !== edit.index);
    placedStaticObjects.forEach(p => {
        if (p.objIndex > edit.index) p.objIndex--;
    });
    staticObjects.splice(edit.index, 1);
    if (currentStaticObjIndex >= staticObjects.length) {
        currentStaticObjIndex = staticObjects.length - 1;
    }
    updateStaticObjectsList();
    renderMap();
    console.log('[BUILDER MP] Remote static object removed:', edit.index);
    break;

case 'placeStaticObj':
    placedStaticObjects.push(edit.placed);
    renderMap();
    break;

case 'removeStaticObjPlacement':
    placedStaticObjects = placedStaticObjects.filter(p =>
        !(p.x === edit.x && p.y === edit.y && p.mapName === edit.mapName)
    );
    renderMap();
    break;
```

---

## STEP 11: Update Tile Selection to Trigger Button Update

In `updateTileSelection()` function (around line 6200), add at the end:

```javascript
// Update CREATE OBJECT button if in that mode
if (createObjectMode) {
    updateCreateObjectButton();
}
```

---

## STEP 12: Collision Inheritance (Test Game)

In the test game collision checking (~line 20033), add this function:

```javascript
function checkStaticObjectCollision(worldX, worldY, playerW, playerH) {
    for (const placed of placedStaticObjects) {
        if (placed.mapName !== currentMapName) continue;

        const obj = staticObjects[placed.objIndex];
        if (!obj || obj.tilesetIndex === undefined) continue;

        const scale = placed.scale || 1;

        // For each source tile in the object
        for (let ty = 0; ty < obj.height; ty++) {
            for (let tx = 0; tx < obj.width; tx++) {
                // Calculate SCALED world position of this tile
                const tileWorldX = placed.x + (tx * gridSize * scale);
                const tileWorldY = placed.y + (ty * gridSize * scale);
                const tileWorldW = gridSize * scale;
                const tileWorldH = gridSize * scale;

                // Check if player overlaps this SCALED tile's area
                if (worldX + playerW <= tileWorldX || worldX >= tileWorldX + tileWorldW) continue;
                if (worldY + playerH <= tileWorldY || worldY >= tileWorldY + tileWorldH) continue;

                // Get source tile coordinates (unscaled, for collision lookup)
                const srcTileX = obj.sourceOrigin.x + tx;
                const srcTileY = obj.sourceOrigin.y + ty;
                const collisionKey = obj.tilesetIndex + ':' + srcTileX + ',' + srcTileY;

                // Check if this source tile has collision
                if (tileCollisions[collisionKey]) {
                    // If has per-pixel mask, check at sub-tile level WITH SCALE
                    const maskKey = srcTileX + ',' + srcTileY;
                    if (collisionMasks[maskKey]) {
                        // Calculate player's position relative to THIS scaled tile
                        const relX = worldX - tileWorldX;
                        const relY = worldY - tileWorldY;

                        // Map to unscaled mask coordinates (0-15 for 16px tiles)
                        const maskX = Math.floor(relX / scale);
                        const maskY = Math.floor(relY / scale);

                        // Check mask bounds and collision
                        if (maskX >= 0 && maskX < gridSize &&
                            maskY >= 0 && maskY < gridSize &&
                            collisionMasks[maskKey][maskY] &&
                            collisionMasks[maskKey][maskY][maskX]) {
                            return true;
                        }
                        continue;
                    }
                    return true; // Tile-level collision
                }
            }
        }
    }
    return false;
}
```

**How scaling affects collision:**
- At 1x scale: 16px tile → 16px collision area
- At 2x scale: 16px tile → 32px collision area
- At 0.5x scale: 16px tile → 8px collision area

---

## Button State Reference

| State | Button Text | Background Color |
|-------|-------------|-----------------|
| Idle (no mode) | CREATE OBJECT | #4a7c59 (green) |
| Mode active, no selection | SELECT TILES... | #666 (gray) |
| Mode active, tiles selected | FINISH | #c9a227 (gold) |

---

## Testing Checklist

- [ ] CREATE OBJECT button appears in Tiles tab
- [ ] Clicking button enters create mode
- [ ] Select Tiles button activates when in create mode
- [ ] Button changes to "FINISH" (gold) when tiles selected
- [ ] Clicking FINISH prompts for name
- [ ] Object created with correct sprite and dimensions
- [ ] Object stores tilesetIndex, sourceTiles, sourceOrigin
- [ ] Object appears in Props tab Static Objects section
- [ ] Clicking object selects it (green highlight)
- [ ] Scale slider appears when object selected
- [ ] Scale slider changes from 0.5x to 3x
- [ ] Hover preview shows on map at cursor
- [ ] Click places object on map
- [ ] Placed objects render correctly
- [ ] Scaled objects render at correct size
- [ ] Right-click removes placed objects
- [ ] Delete button (×) removes object definition
- [ ] Save/load preserves static objects
- [ ] Save/load preserves placed static objects
- [ ] Multiplayer sync: addStaticObj works
- [ ] Multiplayer sync: removeStaticObj works
- [ ] Multiplayer sync: placeStaticObj works
- [ ] Multiplayer sync: removeStaticObjPlacement works
- [ ] Collision inherited from source tileset tiles
- [ ] Collision scales with object

---

## Summary

This feature adds a streamlined workflow for creating static (non-animated) props directly from tileset selections:

1. **No sprite sheet needed** - just select tiles from an existing tileset
2. **Collision inheritance** - automatically uses the source tiles' collision data
3. **Scaled collision** - collision area scales proportionally with the object
4. **Full multiplayer support** - all operations sync across connected builders
5. **Persistent storage** - saves/loads with the project
