        // ===== MULTI-MAP FUNCTIONS =====

        // Save the current map state to the maps object
        // Camera bounds for current map (null = no bounds)
        let cameraBounds = null;
        let fishZones = []; // [{x,y,width,height}] in tiles — per-map water-fishing zones

        function saveCurrentMapState() {
            // Note: tileCollisions, collisionMasks, tileSplitLines are GLOBAL (per-tileset, not per-map)
            // They apply to all maps using the same tileset tiles
            maps[currentMapName] = {
                layers: JSON.parse(JSON.stringify(layers)),
                layerVisibility: [...layerVisibility],
                layerNames: [...layerNames],
                currentLayer: currentLayer,
                mapCols: mapCols,
                mapRows: mapRows,
                cameraBounds: cameraBounds ? { ...cameraBounds } : null,
                fishZones: fishZones.map(z => ({ ...z }))
            };
            console.log('Saved map state for:', currentMapName);
        }

        // Load a map state from the maps object
        function loadMapState(mapData) {
            layers = JSON.parse(JSON.stringify(mapData.layers));
            layerVisibility = [...mapData.layerVisibility];
            layerNames = [...mapData.layerNames];
            currentLayer = mapData.currentLayer || 0;
            // Note: collision data is global, not loaded per-map
            // Migrate old per-map collision data to global if present (backwards compatibility)
            if (mapData.tileCollisions && Object.keys(mapData.tileCollisions).length > 0) {
                Object.assign(tileCollisions, mapData.tileCollisions);
            }
            if (mapData.collisionMasks && Object.keys(mapData.collisionMasks).length > 0) {
                Object.assign(collisionMasks, mapData.collisionMasks);
            }
            if (mapData.tileSplitLines && Object.keys(mapData.tileSplitLines).length > 0) {
                Object.assign(tileSplitLines, mapData.tileSplitLines);
            }
            mapCols = mapData.mapCols || mapCols;
            mapRows = mapData.mapRows || mapRows;
            cameraBounds = mapData.cameraBounds ? { ...mapData.cameraBounds } : null;
            fishZones = (mapData.fishZones || []).map(z => ({ ...z }));
            map = layers[currentLayer];
        }

        // ===== Wave 0 helper stubs (to be called by later waves) =====
        // Rekey every key `${oldPrefix}:*` in `dict` to `${newPrefix}:*`. In place.
        function rekeyPrefix(dict, oldPrefix, newPrefix) {
            if (!dict || oldPrefix === newPrefix) return;
            const oldP = oldPrefix + ':';
            const newP = newPrefix + ':';
            for (const k of Object.keys(dict)) {
                if (k.startsWith(oldP)) {
                    const rest = k.slice(oldP.length);
                    dict[newP + rest] = dict[k];
                    delete dict[k];
                }
            }
        }

        // Cascade map rename across every known data structure that references a map by name.
        // Safe to call from local rename, applyRemoteEdit, applyRemoteEditNoRender, applyLiveEdit.
        function cascadeMapRename(oldName, newName) {
            if (!oldName || !newName || oldName === newName) return;
            if (typeof maps !== 'undefined' && maps && maps[oldName]) {
                maps[newName] = maps[oldName];
                delete maps[oldName];
            }
            const mapNameArrays = [
                (typeof placedTriggers !== 'undefined') ? placedTriggers : null,
                (typeof placedNpcs !== 'undefined') ? placedNpcs : null,
                (typeof placedItems !== 'undefined') ? placedItems : null,
                (typeof placedDialogTiles !== 'undefined') ? placedDialogTiles : null,
                (typeof placedAnimProps !== 'undefined') ? placedAnimProps : null,
                (typeof placedStaticObjects !== 'undefined') ? placedStaticObjects : null,
                (typeof placedShops !== 'undefined') ? placedShops : null
            ];
            for (const arr of mapNameArrays) {
                if (!Array.isArray(arr)) continue;
                for (const e of arr) {
                    if (e && e.mapName === oldName) e.mapName = newName;
                }
            }
            if (typeof placedTriggers !== 'undefined' && Array.isArray(placedTriggers)) {
                for (const t of placedTriggers) {
                    if (t && t.targetMap === oldName) t.targetMap = newName;
                }
            }
            if (typeof polyLights !== 'undefined' && Array.isArray(polyLights)) {
                for (const p of polyLights) {
                    if (p && p.mapName === oldName) p.mapName = newName;
                }
            }
            if (typeof tileSounds !== 'undefined') rekeyPrefix(tileSounds, oldName, newName);
            if (typeof pointLights !== 'undefined') rekeyPrefix(pointLights, oldName, newName);
            if (typeof currentMapName !== 'undefined' && currentMapName === oldName) currentMapName = newName;
            if (typeof spawnMapName !== 'undefined' && spawnMapName === oldName) spawnMapName = newName;
        }

        // Cascade map delete. Drops every record tagged with this map plus any trigger targeting it.
        // Repairs spawnMapName if it pointed at the deleted map.
        function cascadeMapDelete(name) {
            if (!name) return;
            if (typeof placedTriggers !== 'undefined' && Array.isArray(placedTriggers)) {
                placedTriggers = placedTriggers.filter(t => t && t.mapName !== name && t.targetMap !== name);
            }
            const mapNameArrayNames = ['placedNpcs','placedItems','placedDialogTiles','placedAnimProps','placedStaticObjects','placedShops'];
            for (const varName of mapNameArrayNames) {
                try {
                    const arr = eval(varName);
                    if (Array.isArray(arr)) {
                        // Filter in place by reassigning via window when possible; else splice.
                        for (let i = arr.length - 1; i >= 0; i--) {
                            if (arr[i] && arr[i].mapName === name) arr.splice(i, 1);
                        }
                    }
                } catch (_) {}
            }
            if (typeof polyLights !== 'undefined' && Array.isArray(polyLights)) {
                for (let i = polyLights.length - 1; i >= 0; i--) {
                    if (polyLights[i] && polyLights[i].mapName === name) polyLights.splice(i, 1);
                }
            }
            if (typeof tileSounds !== 'undefined') {
                const pref = name + ':';
                for (const k of Object.keys(tileSounds)) if (k.startsWith(pref)) delete tileSounds[k];
            }
            if (typeof pointLights !== 'undefined') {
                const pref = name + ':';
                for (const k of Object.keys(pointLights)) if (k.startsWith(pref)) delete pointLights[k];
            }
            if (typeof maps !== 'undefined' && maps) delete maps[name];
            if (typeof spawnMapName !== 'undefined' && spawnMapName === name) {
                const remaining = (typeof maps !== 'undefined' && maps) ? Object.keys(maps) : [];
                spawnMapName = remaining[0] || 'main';
            }
        }

        // Reindex helpers — called by Wave 5 delete paths. No-ops until wired.
        function reindexNpcReferences(deletedIndex) {
            if (typeof placedNpcs === 'undefined' || !Array.isArray(placedNpcs)) return;
            for (let i = placedNpcs.length - 1; i >= 0; i--) {
                const p = placedNpcs[i];
                if (!p) continue;
                if (p.npcIndex === deletedIndex) placedNpcs.splice(i, 1);
                else if (p.npcIndex > deletedIndex) p.npcIndex--;
            }
        }

        function reindexItemReferences(deletedIndex) {
            if (typeof placedItems !== 'undefined' && Array.isArray(placedItems)) {
                for (let i = placedItems.length - 1; i >= 0; i--) {
                    const p = placedItems[i];
                    if (!p) continue;
                    if (p.itemIndex === deletedIndex) placedItems.splice(i, 1);
                    else if (p.itemIndex > deletedIndex) p.itemIndex--;
                }
            }
            if (typeof shops !== 'undefined' && Array.isArray(shops)) {
                for (const s of shops) {
                    if (!s) continue;
                    for (const listName of ['inventory','buyList']) {
                        const list = s[listName];
                        if (!Array.isArray(list)) continue;
                        for (let i = list.length - 1; i >= 0; i--) {
                            const it = list[i];
                            if (!it) continue;
                            if (it.itemIndex === deletedIndex) list.splice(i, 1);
                            else if (it.itemIndex > deletedIndex) it.itemIndex--;
                        }
                    }
                }
            }
            if (typeof animatedProps !== 'undefined' && Array.isArray(animatedProps)) {
                for (const p of animatedProps) {
                    if (!p) continue;
                    if (p.giveItemIndex === deletedIndex) { p.giveItem = false; p.giveItemIndex = -1; }
                    else if (p.giveItemIndex > deletedIndex) p.giveItemIndex--;
                }
            }
            if (typeof placedAnimProps !== 'undefined' && Array.isArray(placedAnimProps)) {
                for (const p of placedAnimProps) {
                    if (!p) continue;
                    if (p.instanceItemIndex === deletedIndex) p.instanceItemIndex = -1;
                    else if (p.instanceItemIndex > deletedIndex) p.instanceItemIndex--;
                }
            }
            if (typeof placedNpcs !== 'undefined' && Array.isArray(placedNpcs)) {
                for (const n of placedNpcs) {
                    if (!n || !Array.isArray(n.dropItems)) continue;
                    for (let i = n.dropItems.length - 1; i >= 0; i--) {
                        const d = n.dropItems[i];
                        if (!d) continue;
                        if (d.itemIndex === deletedIndex) n.dropItems.splice(i, 1);
                        else if (d.itemIndex > deletedIndex) d.itemIndex--;
                    }
                }
            }
        }

        function reindexDialogReferences(deletedIndex) {
            const shift = (v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return v;
                if (n === deletedIndex) return '';
                if (n > deletedIndex) return String(n - 1);
                return v;
            };
            if (typeof placedDialogTiles !== 'undefined' && Array.isArray(placedDialogTiles)) {
                for (let i = placedDialogTiles.length - 1; i >= 0; i--) {
                    const t = placedDialogTiles[i];
                    if (!t) continue;
                    if (t.dialogIndex === deletedIndex) placedDialogTiles.splice(i, 1);
                    else if (t.dialogIndex > deletedIndex) t.dialogIndex--;
                }
            }
            if (typeof placedNpcs !== 'undefined' && Array.isArray(placedNpcs)) {
                for (const n of placedNpcs) {
                    if (!n) continue;
                    if (n.dialogIndex === deletedIndex) n.dialogIndex = -1;
                    else if (typeof n.dialogIndex === 'number' && n.dialogIndex > deletedIndex) n.dialogIndex--;
                }
            }
            if (typeof quests !== 'undefined' && Array.isArray(quests)) {
                for (const q of quests) {
                    if (!q) continue;
                    for (const f of ['startDialogId','activeDialogId','completeDialogId','declineDialogId']) {
                        if (q[f] !== undefined && q[f] !== null && q[f] !== '') q[f] = shift(q[f]);
                    }
                }
            }
            if (typeof shops !== 'undefined' && Array.isArray(shops)) {
                for (const s of shops) {
                    if (!s) continue;
                    if (s.greetingDialogId !== undefined && s.greetingDialogId !== null && s.greetingDialogId !== '') {
                        s.greetingDialogId = shift(s.greetingDialogId);
                    }
                }
            }
        }

        function reindexSoundReferences(deletedIndex) {
            if (typeof tileSounds !== 'undefined') {
                for (const k of Object.keys(tileSounds)) {
                    const e = tileSounds[k];
                    if (!e) continue;
                    if (e.soundIndex === deletedIndex) delete tileSounds[k];
                    else if (e.soundIndex > deletedIndex) e.soundIndex--;
                }
            }
            if (typeof playerSounds !== 'undefined' && playerSounds) {
                for (const action of Object.keys(playerSounds)) {
                    const cfg = playerSounds[action];
                    if (!cfg) continue;
                    if (cfg.soundIndex === deletedIndex) cfg.soundIndex = -1;
                    else if (cfg.soundIndex > deletedIndex) cfg.soundIndex--;
                }
            }
        }

        function reindexTilesetReferences(deletedIndex) {
            // Rebuild each tileset-prefixed dict excluding the deleted prefix; shift higher indices down.
            const dicts = [];
            if (typeof tileCollisions !== 'undefined') dicts.push(['tileCollisions', tileCollisions]);
            if (typeof collisionMasks !== 'undefined') dicts.push(['collisionMasks', collisionMasks]);
            if (typeof tileSplitLines !== 'undefined') dicts.push(['tileSplitLines', tileSplitLines]);
            if (typeof tileSplitLineFlipped !== 'undefined') dicts.push(['tileSplitLineFlipped', tileSplitLineFlipped]);
            for (const [name, dict] of dicts) {
                const rebuilt = {};
                for (const k of Object.keys(dict)) {
                    const colonIdx = k.indexOf(':');
                    if (colonIdx < 0) { rebuilt[k] = dict[k]; continue; }
                    const idx = parseInt(k.slice(0, colonIdx), 10);
                    const rest = k.slice(colonIdx);
                    if (!Number.isFinite(idx)) { rebuilt[k] = dict[k]; continue; }
                    if (idx === deletedIndex) continue;
                    if (idx > deletedIndex) rebuilt[(idx - 1) + rest] = dict[k];
                    else rebuilt[k] = dict[k];
                }
                // In-place replace keys
                for (const k of Object.keys(dict)) delete dict[k];
                Object.assign(dict, rebuilt);
            }
        }

        function reindexAnimPropReferences(deletedIndex) {
            // Walks every map's every layer's every cell; drops or decrements animTile cells.
            if (typeof maps === 'undefined' || !maps) return;
            for (const mapName of Object.keys(maps)) {
                const m = maps[mapName];
                if (!m || !Array.isArray(m.layers)) continue;
                for (const layer of m.layers) {
                    if (!Array.isArray(layer)) continue;
                    for (const row of layer) {
                        if (!Array.isArray(row)) continue;
                        for (let x = 0; x < row.length; x++) {
                            const cell = row[x];
                            if (!cell || cell.type !== 'animTile') continue;
                            if (cell.propIndex === deletedIndex) row[x] = null;
                            else if (cell.propIndex > deletedIndex) cell.propIndex--;
                        }
                    }
                }
            }
            if (typeof placedAnimProps !== 'undefined' && Array.isArray(placedAnimProps)) {
                for (let i = placedAnimProps.length - 1; i >= 0; i--) {
                    const p = placedAnimProps[i];
                    if (!p) continue;
                    if (p.propIndex === deletedIndex) placedAnimProps.splice(i, 1);
                    else if (p.propIndex > deletedIndex) p.propIndex--;
                }
            }
        }

        // Wave 7: trigger UID helpers. Index-based ID is fragile under concurrent edits.
        function findTriggerByUid(uid) {
            if (!uid || typeof placedTriggers === 'undefined' || !Array.isArray(placedTriggers)) return -1;
            return placedTriggers.findIndex(t => t && t.uid === uid);
        }

        function ensureTriggerUids(list) {
            if (!Array.isArray(list)) return;
            for (const t of list) {
                if (t && !t.uid) {
                    t.uid = (typeof crypto !== 'undefined' && crypto.randomUUID)
                        ? crypto.randomUUID()
                        : ('trig_' + Date.now() + '_' + Math.random().toString(36).slice(2));
                }
            }
        }

        // Save-format migration ladder. Bump SAVE_SCHEMA_VERSION and add a case per hop.
        function migrateProjectData(p) {
            if (!p || typeof p !== 'object') return p;
            const v = (typeof p.version === 'number') ? p.version : 1;
            // Future: if (v < 2) { ...migrate v1 -> v2... p.version = 2; }
            return p;
        }
        // ===== end Wave 0 helpers =====

        // Create a new empty map
        function createMapData(name) {
            // Note: collision/split data is global (per-tileset), not per-map
            maps[name] = {
                layers: [createEmptyLayer()],
                layerVisibility: [true],
                layerNames: ['Layer 1'],
                currentLayer: 0,
                mapCols: mapCols,
                mapRows: mapRows,
                cameraBounds: null, // {x, y, width, height} in tiles, null = no bounds
                fishZones: [] // [{x,y,width,height}] in tiles — water fishing zones
            };
            console.log('Created new map:', name);
        }

        // Switch to a different map
        function switchToMap(mapName) {
            if (!maps[mapName]) {
                console.warn('Map not found:', mapName);
                return false;
            }

            // Save current map state first
            saveCurrentMapState();

            // Load the new map
            currentMapName = mapName;
            loadMapState(maps[mapName]);

            // Update UI
            renderLayerList();
            renderMap();
            updateTriggerList();
            updatePlacedNpcList();
            updatePlacedSoundsList();
            updatePlacedLightsList();
            updateMapDropdowns(); // Update dropdown to show current map
            updateCameraBoundsInfo(); // Update camera bounds display

            console.log('Switched to map:', mapName);
            return true;
        }

        // Get list of all map names
        function getMapNames() {
            return Object.keys(maps);
        }

        // Delete a map (cannot delete last map)
        function deleteMap(mapName) {
            const mapNames = getMapNames();
            if (mapNames.length <= 1) {
                alert('Cannot delete the last map');
                return false;
            }
            if (mapName === currentMapName) {
                // Switch to another map first
                const otherMap = mapNames.find(n => n !== mapName);
                switchToMap(otherMap);
            }

            // Wave 4: shared cascade handles placedTriggers + all other .mapName arrays,
            // prefix-keyed dicts, and spawnMapName invariant repair.
            cascadeMapDelete(mapName);

            updateDoorNumberDropdown();
            if (typeof updatePlacedLightsList === 'function') updatePlacedLightsList();
            if (typeof updatePolyLightsList === 'function') updatePolyLightsList();
            if (typeof updatePlacedSoundsList === 'function') updatePlacedSoundsList();

            console.log('Deleted map:', mapName);
            return true;
        }

        // Update map dropdown selectors
        function updateMapDropdowns() {
            const mapNames = getMapNames();

            // Update current map selector (triggers tab)
            const currentSelect = document.getElementById('currentMapSelect');
            if (currentSelect) {
                currentSelect.innerHTML = mapNames.map(name =>
                    `<option value="${name}" ${name === currentMapName ? 'selected' : ''}>${name}</option>`
                ).join('');
            }

            // Update toolbar map selector
            const toolbarSelect = document.getElementById('toolbarMapSelect');
            if (toolbarSelect) {
                toolbarSelect.innerHTML = mapNames.map(name =>
                    `<option value="${name}" ${name === currentMapName ? 'selected' : ''}>${name}</option>`
                ).join('');
            }

            // Update camera map selector
            const cameraSelect = document.getElementById('cameraMapSelect');
            if (cameraSelect) {
                cameraSelect.innerHTML = mapNames.map(name =>
                    `<option value="${name}" ${name === currentMapName ? 'selected' : ''}>${name}</option>`
                ).join('');
            }

            const fishSelect = document.getElementById('fishMapSelect');
            if (fishSelect) {
                fishSelect.innerHTML = mapNames.map(name =>
                    `<option value="${name}" ${name === currentMapName ? 'selected' : ''}>${name}</option>`
                ).join('');
            }

            // Update target map selector
            const targetSelect = document.getElementById('triggerTargetMap');
            if (targetSelect) {
                targetSelect.innerHTML = '<option value="">-- Select Map --</option>' +
                    mapNames.map(name => `<option value="${name}">${name}</option>`).join('');
            }
        }

        // Update trigger list UI
        function updateTriggerList() {
            const container = document.getElementById('triggerList');
            if (!container) return;

            const currentTriggers = placedTriggers.filter(t => t.mapName === currentMapName);

            if (currentTriggers.length === 0) {
                container.innerHTML = '<div style="color:#666; text-align:center; padding:10px;">No triggers placed</div>';
                return;
            }

            container.innerHTML = currentTriggers.map((t, i) => {
                const globalIdx = placedTriggers.indexOf(t);
                const doorNum = t.doorNumber || 1;
                const doorType = t.doorType || 'walkover';
                const isExternal = doorType === 'external';
                const spawnSet = isExternal ? (t.returnX != null && t.returnY != null) : (t.targetX != null && t.targetY != null);
                const spawnText = isExternal
                    ? (spawnSet ? `return:(${t.returnX}, ${t.returnY})` : '<span style="color:#f80;">SET RETURN!</span>')
                    : (spawnSet ? `(${t.targetX}, ${t.targetY})` : '<span style="color:#f80;">SET SPAWN!</span>');
                const typeIcon = isExternal ? '🌐' : (doorType === 'interact' ? '🔘' : '🚶');
                const destination = isExternal ? t.externalUrl : t.targetMap;
                const borderColor = spawnSet ? (isExternal ? '#0cc' : '#f4f') : '#f80';
                return `<div style="background:#333; padding:8px; margin-bottom:4px; border-radius:3px; border-left:3px solid ${borderColor};">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span>${typeIcon} <b>Door ${doorNum}</b> → ${destination}</span>
                        <button onclick="deleteTrigger(${globalIdx})" style="background:#a33; padding:2px 6px; font-size:10px;">x</button>
                    </div>
                    <div style="font-size:10px; color:#888; margin-top:4px;">
                        ${t.width}x${t.height} | ${spawnText}${t.animTiles && t.animTiles.length ? ' | anim:' + t.animTiles.length : ''}
                    </div>
                </div>`;
            }).join('');
        }

        // Prompt for new map name
        function promptNewMap() {
            const name = prompt('Enter new map name:');
            if (!name || !name.trim()) return;

            const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            if (maps[cleanName]) {
                alert('Map "' + cleanName + '" already exists');
                return;
            }

            // Save current map first
            saveCurrentMapState();

            // Create new map and switch to it
            createMapData(cleanName);
            broadcastEdit({ editType: 'addMap', mapName: cleanName });
            currentMapName = cleanName;
            loadMapState(maps[cleanName]);

            updateMapDropdowns();
            updateTriggerList();
            renderLayerList();
            renderMap();

            alert('Created and switched to map: ' + cleanName);
        }

        // Prompt to delete current map
        function promptDeleteMap() {
            if (getMapNames().length <= 1) {
                alert('Cannot delete the last map');
                return;
            }

            if (!confirm('Delete map "' + currentMapName + '"? This cannot be undone.')) {
                return;
            }

            const deletedName = currentMapName;
            deleteMap(deletedName);
            broadcastEdit({ editType: 'deleteMap', mapName: deletedName });
            updateMapDropdowns();
            updateTriggerList();
            renderMap();

            alert('Deleted map: ' + deletedName);
        }

        // Rename current map
        function promptRenameMap() {
            const oldName = currentMapName;
            const newName = prompt('Enter new name for map "' + oldName + '":', oldName);

            if (!newName || !newName.trim()) return;

            const cleanName = newName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');

            if (cleanName === oldName) return; // No change

            if (maps[cleanName]) {
                alert('Map "' + cleanName + '" already exists');
                return;
            }

            // Wave 4: single-source cascade covers maps object, placedTriggers (mapName+targetMap),
            // placedNpcs, placedItems, placedDialogTiles, placedAnimProps, placedStaticObjects,
            // placedShops, polyLights, tileSounds keys, pointLights keys, currentMapName, spawnMapName.
            cascadeMapRename(oldName, cleanName);

            // Sync to other builders
            broadcastEdit({ editType: 'renameMap', oldName: oldName, newName: cleanName });

            // Update UI
            updateMapDropdowns();
            updateTriggerList();
            renderMap();

            console.log('[RENAME] Map renamed: "' + oldName + '" → "' + cleanName + '"');
        }

        // Update door number dropdown to only show available numbers
        function updateDoorNumberDropdown() {
            const select = document.getElementById('triggerDoorNumber');
            if (!select) return;

            const usedNumbers = placedTriggers.map(t => t.doorNumber);

            select.innerHTML = '';
            for (let i = 1; i <= 10; i++) {
                if (!usedNumbers.includes(i)) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = 'Door ' + i;
                    select.appendChild(option);
                }
            }

            // If all doors used, show message
            if (select.options.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'All doors used!';
                select.appendChild(option);
            }
        }

        // Door modal state
        let pendingDoorX = 0;
        let pendingDoorY = 0;
        let pendingDoorNumber = 1;
        let selectedWalkDirection = 'down'; // Default walk direction
        let useWalkOutPoint = false; // Whether to set walk-out destination by clicking
        let settingWalkOutPoint = false; // Currently in walk-out setting mode
        let pendingWalkOutTrigger = null; // Trigger waiting for walk-out point

        // Door animation state
        let selectingAnimTiles = false; // Selecting which tiles to swap
        let paintingAnimTiles = false; // Painting replacement tiles
        let pendingAnimTrigger = null; // Trigger being set up for animation
        let selectedAnimTiles = []; // Array of {x, y, layer, tileData} for selected tiles
        let doorAnimMapName = null; // Which map the door animation is being set up on

        // Update door animation panel visibility and hide extra UI
        function updateDoorAnimPanel() {
            const panel = document.getElementById('doorAnimPanel');
            const selectMode = document.getElementById('doorAnimSelectMode');
            const paintMode = document.getElementById('doorAnimPaintMode');

            // Elements to hide during door animation mode
            const hideElements = [
                'tileNormalUI',      // Selected tile + transform
                'tileExtraButtons',  // Select Tiles button
                'tileCopyCollision', // Copy from Map + Edit Collisions
                'tileLayerAdd',      // + Add Layer button
                'tilePlayerSprite'   // Player sprite section
            ];

            const inDoorAnimMode = selectingAnimTiles || paintingAnimTiles;

            // Show/hide extra UI elements
            hideElements.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = inDoorAnimMode ? 'none' : 'block';
            });

            // Hide mode tabs and main toolbar during door animation
            const modeTabs = document.getElementById('modeTabs');
            if (modeTabs) modeTabs.style.display = inDoorAnimMode ? 'none' : 'flex';

            const mainToolbar = document.getElementById('mainToolbar');
            if (mainToolbar) mainToolbar.style.display = inDoorAnimMode ? 'none' : 'flex';

            if (selectingAnimTiles) {
                panel.style.display = 'block';
                selectMode.style.display = 'block';
                paintMode.style.display = 'none';
            } else if (paintingAnimTiles) {
                panel.style.display = 'block';
                selectMode.style.display = 'none';
                paintMode.style.display = 'block';
            } else {
                panel.style.display = 'none';
                selectMode.style.display = 'none';
                paintMode.style.display = 'none';
            }
        }

        // Update modal options visibility based on door type
        function updateDoorModalOptions() {
            const doorType = document.getElementById('doorModalType').value;
            const walkoverOptions = document.getElementById('walkoverOptions');
            const interactOptions = document.getElementById('interactOptions');
            const externalOptions = document.getElementById('externalOptions');
            const mapSelectDiv = document.getElementById('doorMapSelectDiv');
            const confirmBtn = document.getElementById('doorModalConfirmBtn');

            walkoverOptions.style.display = doorType === 'walkover' ? 'block' : 'none';
            interactOptions.style.display = doorType === 'interact' ? 'block' : 'none';
            externalOptions.style.display = doorType === 'external' ? 'block' : 'none';

            // Hide map selector for external doors (they don't need a target map)
            if (mapSelectDiv) mapSelectDiv.style.display = doorType === 'external' ? 'none' : 'block';

            // Change confirm button text and color
            if (confirmBtn) {
                if (doorType === 'external') {
                    confirmBtn.textContent = 'Create Door';
                    confirmBtn.style.background = '#0cc';
                } else {
                    confirmBtn.textContent = 'Set Spawn →';
                    confirmBtn.style.background = '#4af';
                }
            }
        }

        // Toggle between walk-out point mode and direction mode
        function toggleWalkOutMode() {
            useWalkOutPoint = document.getElementById('useWalkOutPoint').checked;
            const dirOptions = document.getElementById('walkDirectionOptions');
            dirOptions.style.display = useWalkOutPoint ? 'none' : 'block';
        }

        // Set walk direction for walkover doors
        function setWalkDirection(dir) {
            selectedWalkDirection = dir;
            // Uncheck walk-out point if direction is selected
            document.getElementById('useWalkOutPoint').checked = false;
            useWalkOutPoint = false;
            document.getElementById('walkDirectionOptions').style.display = 'block';

            // Update button styles
            ['up', 'down', 'left', 'right'].forEach(d => {
                const btn = document.getElementById('walkDir' + d.charAt(0).toUpperCase() + d.slice(1));
                if (btn) {
                    btn.style.background = d === dir ? '#4af' : '#444';
                    btn.style.color = d === dir ? '#000' : '#fff';
                }
            });
        }

        // Show door map selection modal
        function showDoorMapModal(x, y, doorNumber) {
            pendingDoorX = x;
            pendingDoorY = y;
            pendingDoorNumber = doorNumber;

            // Update modal title
            document.getElementById('doorModalNumber').textContent = doorNumber;

            // Populate dropdown with other maps
            const select = document.getElementById('doorMapSelect');
            const otherMaps = Object.keys(maps).filter(m => m !== currentMapName);

            select.innerHTML = '';
            if (otherMaps.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = '(No other maps - create one below)';
                select.appendChild(opt);
            } else {
                otherMaps.forEach(mapName => {
                    const opt = document.createElement('option');
                    opt.value = mapName;
                    opt.textContent = mapName;
                    select.appendChild(opt);
                });
            }

            // Clear new map input
            document.getElementById('doorNewMapName').value = '';

            // Reset door options to defaults
            document.getElementById('doorModalType').value = 'walkover';
            document.getElementById('doorWalkDuration').value = '0.5';
            document.getElementById('doorFadeDuration').value = '0.5';
            document.getElementById('useWalkOutPoint').checked = false;
            useWalkOutPoint = false;
            document.getElementById('walkDirectionOptions').style.display = 'block';
            selectedWalkDirection = 'down';
            setWalkDirection('down');
            updateDoorModalOptions();

            // Populate the "Requires Key" dropdown from items
            const lockSel = document.getElementById('doorLockSelect');
            if (lockSel) {
                lockSel.innerHTML = '<option value="-1">None (unlocked)</option>' +
                    items.map((it, i) => '<option value="' + i + '">' + (it.name || ('Item ' + (i + 1))) + '</option>').join('');
                lockSel.value = '-1';
            }
            const lockConsumeEl = document.getElementById('doorLockConsume');
            if (lockConsumeEl) lockConsumeEl.checked = true;

            // Show modal
            document.getElementById('doorMapModal').style.display = 'flex';
        }

        function closeDoorMapModal() {
            document.getElementById('doorMapModal').style.display = 'none';
            // Reset pending trigger state
            pendingTriggerWidth = 1;
            pendingTriggerHeight = 1;
            useWalkOutPoint = false;
            settingWalkOutPoint = false;
            pendingWalkOutTrigger = null;
        }

        function confirmDoorMapModal() {
            // Get selected or new map
            let targetMap = document.getElementById('doorNewMapName').value.trim();
            const doorType = document.getElementById('doorModalType').value;
            const isExternal = doorType === 'external';

            // Handle external doors (link to another HTML file)
            if (isExternal) {
                const externalUrl = document.getElementById('externalDestination').value;
                const trigger = {
                    uid: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ('trig_' + Date.now() + '_' + Math.random().toString(36).slice(2)), // Wave 7
                    x: pendingDoorX,
                    y: pendingDoorY,
                    width: pendingTriggerWidth,
                    height: pendingTriggerHeight,
                    mapName: currentMapName,
                    doorNumber: pendingDoorNumber,
                    type: 'door',
                    doorType: 'external',
                    externalUrl: externalUrl,
                    fadeDuration: parseFloat(document.getElementById('doorFadeDuration').value),
                    returnX: null,  // Return spawn point (set by clicking on map)
                    returnY: null
                };
                pendingTriggerWidth = 1;
                pendingTriggerHeight = 1;

                console.log('=== EXTERNAL DOOR PLACED ===');
                console.log('[DOOR] Door ' + pendingDoorNumber + ' at (' + pendingDoorX + ', ' + pendingDoorY + ') -> "' + externalUrl + '"');

                placedTriggers.push(trigger);
                // Broadcast to co-op builders
                broadcastEdit({ editType: 'placeTrigger', trigger: trigger });
                updateTriggerList();
                updateDoorNumberDropdown();
                closeDoorMapModal();

                // Now set return spawn point (stay on same map)
                pendingTriggerForSpawn = trigger;
                pendingTriggerForSpawn.isExternalReturn = true; // Flag for special handling
                spawnSourceMap = currentMapName;
                settingSpawnPoint = true;
                setMode('trigger');
                renderMap();
                return;
            }

            if (!targetMap) {
                targetMap = document.getElementById('doorMapSelect').value;
            }

            if (!targetMap) {
                alert('Please select a map or enter a new map name');
                return;
            }

            const cleanMapName = targetMap.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

            // Create target map if it doesn't exist
            if (!maps[cleanMapName]) {
                createMapData(cleanMapName);
                broadcastEdit({ editType: 'addMap', mapName: cleanMapName });
                updateMapDropdowns();
            }

            const isWalkOver = doorType === 'walkover';
            const isInteract = doorType === 'interact';
            const useDoorAnim = isInteract && document.getElementById('useDoorAnimation').checked;
            const trigger = {
                uid: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ('trig_' + Date.now() + '_' + Math.random().toString(36).slice(2)), // Wave 7
                x: pendingDoorX,
                y: pendingDoorY,
                width: pendingTriggerWidth,
                height: pendingTriggerHeight,
                mapName: currentMapName,
                targetMap: cleanMapName,
                targetX: null,
                targetY: null,
                doorNumber: pendingDoorNumber,
                type: 'door',
                doorType: doorType, // 'walkover' or 'interact'
                // Walkover properties
                walkOutX: null, // Will be set if useWalkOutPoint is true
                walkOutY: null,
                walkDirection: isWalkOver && !useWalkOutPoint ? selectedWalkDirection : null,
                walkDuration: isWalkOver && !useWalkOutPoint ? parseFloat(document.getElementById('doorWalkDuration').value) : 0,
                fadeDuration: parseFloat(document.getElementById('doorFadeDuration').value),
                // Door animation properties (for interact doors)
                animTiles: useDoorAnim ? [] : null, // Array of {x, y, layer} tiles to hide on open
                // Key/lock: -1 = unlocked
                lockItemIndex: parseInt(document.getElementById('doorLockSelect')?.value ?? '-1'),
                lockConsume: document.getElementById('doorLockConsume') ? document.getElementById('doorLockConsume').checked : true
            };
            // Reset for next trigger
            pendingTriggerWidth = 1;
            pendingTriggerHeight = 1;

            console.log('=== DOOR PLACED ===');
            console.log('[DOOR] Door ' + pendingDoorNumber + ' at (' + pendingDoorX + ', ' + pendingDoorY + ') -> "' + cleanMapName + '"');

            placedTriggers.push(trigger);
            // Broadcast to co-op builders
            broadcastEdit({ editType: 'placeTrigger', trigger: trigger });
            updateTriggerList();
            updateDoorNumberDropdown();

            // Close modal
            closeDoorMapModal();

            // If walk-out point mode, stay on this map to set walk-out first
            if (isWalkOver && useWalkOutPoint) {
                settingWalkOutPoint = true;
                pendingWalkOutTrigger = trigger;
                pendingTriggerForSpawn = trigger;
                spawnSourceMap = currentMapName;
                renderMap();
                return;
            }

            // If door animation mode, mark trigger for anim setup after spawn is set
            if (useDoorAnim) {
                trigger.needsAnimSetup = true;
                console.log('[DOOR ANIM] Marked trigger for anim setup, needsAnimSetup =', trigger.needsAnimSetup);
            }

            // Go to target map to set spawn
            pendingTriggerForSpawn = trigger;
            spawnSourceMap = currentMapName;
            settingSpawnPoint = true;
            setMode('trigger'); // Ensure trigger mode for spawn click
            switchToMap(cleanMapName);
            renderMap();
        }

        // Place a trigger at the given tile position
        function placeTriggerAt(x, y) {
            // Auto-select next available door number
            const usedNumbers = placedTriggers.map(t => t.doorNumber);
            let doorNumber = null;
            for (let i = 1; i <= 100; i++) { // Wave 3: raised cap from 10 -> 100 doors per project
                if (!usedNumbers.includes(i)) {
                    doorNumber = i;
                    break;
                }
            }

            if (doorNumber === null) {
                alert('All door numbers (1-100) are in use! Delete an existing door first.');
                return;
            }

            // Show modal to select target map
            showDoorMapModal(x, y, doorNumber);
        }

        // Delete a trigger by index
        function deleteTrigger(index) {
            if (index >= 0 && index < placedTriggers.length) {
                const uid = placedTriggers[index]?.uid; // Wave 7: stable ID for the broadcast
                placedTriggers.splice(index, 1);
                // Broadcast to co-op builders (uid + index; receivers prefer uid)
                broadcastEdit({ editType: 'removeTrigger', index: index, uid: uid });
                updateTriggerList();
                updateDoorNumberDropdown();
                renderMap();
            }
        }

        // Remove trigger at position (for right-click)
        function removeTriggerAt(x, y) {
            const idx = placedTriggers.findIndex(t =>
                t.mapName === currentMapName &&
                x >= t.x && x < t.x + t.width &&
                y >= t.y && y < t.y + t.height
            );
            if (idx >= 0) {
                deleteTrigger(idx);
            }
        }

        // Set spawn point at clicked location
        function setSpawnPointAt(x, y) {
            // Update the pending trigger directly
            if (pendingTriggerForSpawn) {
                // Check if this is an external door return spawn
                if (pendingTriggerForSpawn.isExternalReturn) {
                    pendingTriggerForSpawn.returnX = x;
                    pendingTriggerForSpawn.returnY = y;
                    delete pendingTriggerForSpawn.isExternalReturn; // Clean up temp flag
                    console.log('=== EXTERNAL RETURN SPAWN PLACED ===');
                    console.log('[SPAWN] Door', pendingTriggerForSpawn.doorNumber, 'RETURN spawn set at (' + x + ', ' + y + ') on "' + currentMapName + '"');
                } else {
                    pendingTriggerForSpawn.targetX = x;
                    pendingTriggerForSpawn.targetY = y;
                    console.log('=== SPAWN PLACED ===');
                    console.log('[SPAWN] Door', pendingTriggerForSpawn.doorNumber, 'spawn set at (' + x + ', ' + y + ') on "' + currentMapName + '"');
                }
                // Sync the trigger update
                const triggerIndex = placedTriggers.indexOf(pendingTriggerForSpawn);
                if (triggerIndex >= 0) {
                    broadcastEdit({ editType: 'updateTrigger', index: triggerIndex, uid: pendingTriggerForSpawn.uid, trigger: pendingTriggerForSpawn });
                }
            }

            // Check if this trigger needs animation setup
            const needsAnim = pendingTriggerForSpawn && pendingTriggerForSpawn.needsAnimSetup;
            const triggerForAnim = pendingTriggerForSpawn;
            const isExternalDoor = pendingTriggerForSpawn && pendingTriggerForSpawn.doorType === 'external';
            console.log('[DOOR ANIM] In setSpawnPointAt, needsAnim =', needsAnim, 'trigger.needsAnimSetup =', pendingTriggerForSpawn?.needsAnimSetup);

            // Exit spawn setting mode
            settingSpawnPoint = false;
            const returnMap = spawnSourceMap;
            spawnSourceMap = null;
            pendingTriggerForSpawn = null;

            // Auto-return to source map (but not for external doors - we're already on the right map)
            if (returnMap && !isExternalDoor) {
                switchToMap(returnMap);
            }

            // If needs animation setup, start tile selection mode
            if (needsAnim && triggerForAnim) {
                triggerForAnim.needsAnimSetup = false;
                triggerForAnim.animTiles = [];
                pendingAnimTrigger = triggerForAnim;
                selectingAnimTiles = true;
                selectedAnimTiles = [];
                doorAnimMapName = currentMapName; // Track which map we're editing
                console.log('[DOOR ANIM] Starting tile selection for door', triggerForAnim.doorNumber);
                setMode('tile'); // Switch to tile mode for layer controls + palette
                updateDoorAnimPanel();
            } else {
                console.log('[DOOR ANIM] NOT starting tile selection. needsAnim =', needsAnim, 'triggerForAnim =', triggerForAnim);
            }

            renderMap();
        }

        // Set walk-out point at clicked location (where player walks TO before fade)
        function setWalkOutPointAt(x, y) {
            if (pendingWalkOutTrigger) {
                pendingWalkOutTrigger.walkOutX = x;
                pendingWalkOutTrigger.walkOutY = y;
                console.log('=== WALK-OUT POINT SET ===');
                console.log('[WALK-OUT] Door', pendingWalkOutTrigger.doorNumber, 'walk-out at (' + x + ', ' + y + ')');
                // Wave 3: broadcast the walk-out update (was silently local-only).
                const idx = placedTriggers.indexOf(pendingWalkOutTrigger);
                if (idx >= 0) {
                    broadcastEdit({ editType: 'updateTrigger', index: idx, uid: pendingWalkOutTrigger.uid, trigger: pendingWalkOutTrigger });
                }
            }

            // Exit walk-out setting mode
            settingWalkOutPoint = false;
            pendingWalkOutTrigger = null;

            // Now switch to target map to set spawn
            if (pendingTriggerForSpawn) {
                settingSpawnPoint = true;
                switchToMap(pendingTriggerForSpawn.targetMap);
            }
            renderMap();
        }

        // Toggle a tile in the animation selection
        function toggleAnimTileSelection(x, y) {
            // Check if already selected on current layer
            const idx = selectedAnimTiles.findIndex(t => t.x === x && t.y === y && t.layer === currentLayer);
            if (idx >= 0) {
                // Remove it
                selectedAnimTiles.splice(idx, 1);
                console.log('[DOOR ANIM] Deselected tile at', x, y, 'layer', currentLayer);
            } else {
                // Add it - capture current tile data from current layer
                const tileData = (layers[currentLayer] && layers[currentLayer][y] && layers[currentLayer][y][x])
                    ? JSON.parse(JSON.stringify(layers[currentLayer][y][x])) : null;
                selectedAnimTiles.push({
                    x, y,
                    layer: currentLayer,
                    before: tileData
                });
                console.log('[DOOR ANIM] Selected tile at', x, y, 'layer', currentLayer);
            }
            renderMap();
        }

        // Finish tile selection, move to painting mode
        function finishTileSelection() {
            if (selectedAnimTiles.length === 0) {
                alert('Select at least one tile to animate');
                return;
            }

            // Erase the selected tiles so user can paint replacements
            selectedAnimTiles.forEach(tile => {
                if (layers[tile.layer] && layers[tile.layer][tile.y]) {
                    layers[tile.layer][tile.y][tile.x] = null;
                }
            });

            selectingAnimTiles = false;
            paintingAnimTiles = true;
            setMode('tile'); // Switch to tile mode for painting
            console.log('[DOOR ANIM] Moved to paint mode with', selectedAnimTiles.length, 'tiles');
            updateDoorAnimPanel();
            renderMap();
        }

        // Finish painting, save the animation
        function finishAnimPainting() {
            // Capture the "after" state for each selected tile position
            const animChanges = [];
            selectedAnimTiles.forEach(tile => {
                const afterData = (layers[tile.layer] && layers[tile.layer][tile.y] && layers[tile.layer][tile.y][tile.x])
                    ? JSON.parse(JSON.stringify(layers[tile.layer][tile.y][tile.x])) : null;
                animChanges.push({
                    x: tile.x,
                    y: tile.y,
                    layer: tile.layer,
                    before: tile.before,
                    after: afterData
                });
            });

            // Restore the "before" tiles (door starts closed)
            selectedAnimTiles.forEach(tile => {
                if (!layers[tile.layer]) layers[tile.layer] = [];
                if (!layers[tile.layer][tile.y]) layers[tile.layer][tile.y] = [];
                layers[tile.layer][tile.y][tile.x] = tile.before;
            });

            // Save to trigger
            if (pendingAnimTrigger) {
                pendingAnimTrigger.animTiles = animChanges;
                console.log('=== DOOR ANIM SAVED ===');
                console.log('[DOOR ANIM] Door', pendingAnimTrigger.doorNumber, 'has', animChanges.length, 'tile swaps');
                // Wave 3: broadcast the animTiles update (was silently local-only).
                const idx = placedTriggers.indexOf(pendingAnimTrigger);
                if (idx >= 0) {
                    broadcastEdit({ editType: 'updateTrigger', index: idx, uid: pendingAnimTrigger.uid, trigger: pendingAnimTrigger });
                }
            }

            // Reset state
            paintingAnimTiles = false;
            pendingAnimTrigger = null;
            selectedAnimTiles = [];
            doorAnimMapName = null;
            updateDoorAnimPanel();
            renderMap();
        }
