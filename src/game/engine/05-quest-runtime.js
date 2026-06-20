        // ===== QUEST SYSTEM RUNTIME =====
        let quests = [];  // Loaded from projectData
        let questSoundsData = [];  // Quest sounds library

        // ===== CUSTOM UI SKINS (game doc) =====
        // Snapshot of projectData.uiConfig, captured at initGame (NO live updates — by design).
        // uiImages: slot -> loaded Image (the 16-frame sheet). uiAnimTimers: slot -> {frame,timer}.
        // A slot is "skinned" only when uiImages[slot] && uiImages[slot].complete.
        let uiConfigData = {};
        const uiImages = {};
        const uiAnimTimers = {
            questLogButton: { frame: 0, timer: 0 },
            questLogPanel:  { frame: 0, timer: 0 }
        };
        let playerInventory = {};  // { [itemId]: quantity }
        // Hoisted to top-level (was declared inside initGame) so the quest-condition functions
        // defined above initGame (hasInventoryItem/isConditionMet) can read the real inventory.
        // initGame assigns to these (no re-declaration) so all runtime code shares one instance.
        let itemsData = [];          // runtime item definitions (projectData.items)
        let inventorySlots = [];     // Array of { itemIndex, quantity } or null — the REAL inventory
        let gameProgress = {
            npcsSpokenTo: {},       // { [npcUid]: true }
            enemiesDefeated: {},    // { [npcUid]: count }
            locationsVisited: {},   // { [mapName]: true }
            questStates: {}         // { [questId]: { status } }
        };
        const QUEST_STATUS = {
            LOCKED: 'locked',
            AVAILABLE: 'available',
            ACTIVE: 'active',
            COMPLETED: 'completed'
        };

        // NPC data for live sync
        let npcs = [];
        let npcImages = [];
        let npcRuntimeState = [];
        let gridSize = 16; // Will be set from projectData

        // Live sync: Connect to builder WebSocket to receive real-time edits
        function connectToBuilderSync(roomCode) {
            const wsUrl = 'wss://multiplayer.lakotafox.partykit.dev/parties/builder/' + roomCode;
            console.log('[LIVE SYNC] Connecting to builder room:', roomCode);

            builderSyncSocket = new WebSocket(wsUrl);

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
                    logNetworkEvent(data.editType || data.type || 'builderEdit', 'recv-builder', data, event.data.length);
                    if (data.type === 'builderEdit' || data.editType) {
                        applyLiveEdit(data);
                    }
                } catch (e) {
                    console.error('[LIVE SYNC] Parse error:', e);
                }
            };

            builderSyncSocket.onclose = () => {
                console.log('[LIVE SYNC] Disconnected from builder');
                // Reconnect after delay
                setTimeout(() => connectToBuilderSync(roomCode), 3000);
            };

            builderSyncSocket.onerror = (err) => {
                console.error('[LIVE SYNC] WebSocket error:', err);
            };
        }

        // Apply incoming edits from builder to live game state
        // fromMultiplayer = true means this edit came from another player, don't relay it again
        function applyLiveEdit(edit, fromMultiplayer = false) {
            // Handle batch edits
            if (edit.editType === 'batch' && edit.edits) {
                edit.edits.forEach(e => applyLiveEdit(e, fromMultiplayer));
                return;
            }

            const editType = edit.editType;

            // Skip non-edit messages
            if (!editType) return;

            console.log('[LIVE SYNC] Applying:', editType, fromMultiplayer ? '(from MP)' : '(from builder)');

            // Relay builder edits to other multiplayer players
            if (!fromMultiplayer && typeof mpSocket !== 'undefined' && mpSocket && mpConnected) {
                mpSocket.send(JSON.stringify({
                    type: 'builderEdit',
                    edit: edit
                }));
            }

            // Get current map name (test game uses currentGameMap)
            const gameMapName = (typeof currentGameMap !== 'undefined') ? currentGameMap : 'main';

            switch (editType) {
                case 'tile':
                    // Update tile in the current map
                    if (edit.mapName === gameMapName || !edit.mapName) {
                        if (!layers[edit.layer]) layers[edit.layer] = [];
                        if (!layers[edit.layer][edit.y]) layers[edit.layer][edit.y] = [];
                        layers[edit.layer][edit.y][edit.x] = edit.cell;
                        liveSyncNeedsRedraw = true;
                        // Update animated tile registry if this is an origin animTile
                        if (edit.cell && edit.cell.type === 'animTile' &&
                            ((edit.cell.offsetX || 0) === 0 && (edit.cell.offsetY || 0) === 0)) {
                            // Add to registry if not already there
                            const exists = animatedTileRegistry.some(e =>
                                e.li === edit.layer && e.x === edit.x && e.y === edit.y);
                            if (!exists) {
                                animatedTileRegistry.push({ li: edit.layer, x: edit.x, y: edit.y });
                            }
                        }
                    }
                    break;

                case 'eraseTile':
                    if (edit.mapName === gameMapName || !edit.mapName) {
                        if (layers[edit.layer] && layers[edit.layer][edit.y]) {
                            // Remove from animated tile registry if it was an animTile
                            const oldCell = layers[edit.layer][edit.y][edit.x];
                            if (oldCell && oldCell.type === 'animTile') {
                                animatedTileRegistry = animatedTileRegistry.filter(e =>
                                    !(e.li === edit.layer && e.x === edit.x && e.y === edit.y));
                            }
                            layers[edit.layer][edit.y][edit.x] = null;
                            liveSyncNeedsRedraw = true;
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
                    if (typeof placedNpcs !== 'undefined' && edit.npc) {
                        placedNpcs.push(edit.npc);
                        // Create runtime state for new NPC
                        if (typeof createNpcRuntimeState === 'function') {
                            npcRuntimeState.push(createNpcRuntimeState(edit.npc));
                        }
                        console.log('[LIVE SYNC] Added NPC at', edit.npc.x, edit.npc.y);
                    }
                    break;

                case 'removeNpc':
                    if (typeof placedNpcs !== 'undefined' && edit.index >= 0 && edit.index < placedNpcs.length) {
                        placedNpcs.splice(edit.index, 1);
                        // Remove runtime state
                        if (npcRuntimeState && edit.index < npcRuntimeState.length) {
                            npcRuntimeState.splice(edit.index, 1);
                        }
                        console.log('[LIVE SYNC] Removed NPC at index', edit.index);
                    }
                    break;

                case 'updateNpc':
                    // NPC definition updated (template, not placed instance)
                    if (typeof npcs !== 'undefined' && edit.index >= 0 && edit.index < npcs.length && edit.npc) {
                        npcs[edit.index] = edit.npc;
                        // Reload sprite image if changed
                        if (edit.npc.spriteData && npcImages) {
                            const img = new Image();
                            img.src = edit.npc.spriteData;
                            npcImages[edit.index] = img;
                        }
                        console.log('[LIVE SYNC] Updated NPC definition:', edit.npc.name);
                    }
                    break;

                case 'addNpc':
                    // NPC definition added (not placed NPC)
                    if (typeof npcs !== 'undefined' && edit.npc) {
                        npcs.push(edit.npc);
                        // Load sprite image
                        if (edit.npc.spriteData) {
                            const img = new Image();
                            img.src = edit.npc.spriteData;
                            npcImages.push(img);
                        }
                        console.log('[LIVE SYNC] Added NPC definition:', edit.npc.name);
                    }
                    break;

                case 'updatePlacedNpc':
                    // Update placed NPC settings (including enemy AI)
                    if (typeof placedNpcs !== 'undefined' && edit.index >= 0 && edit.index < placedNpcs.length && edit.npc) {
                        // Preserve position but update all other settings
                        const oldPlaced = placedNpcs[edit.index];
                        placedNpcs[edit.index] = edit.npc;
                        // Update runtime state with new enemy settings
                        if (npcRuntimeState && npcRuntimeState[edit.index]) {
                            const state = npcRuntimeState[edit.index];
                            // Initialize enemy AI state if becoming an enemy
                            if (edit.npc.isEnemy && !state.aiState) {
                                state.aiState = 'idle';
                                state.aggroTimer = 0;
                                state.attackCooldown = 0;
                                state.returnX = state.x;
                                state.returnY = state.y;
                            }
                        }
                        console.log('[LIVE SYNC] Updated placed NPC at index', edit.index, 'isEnemy:', edit.npc.isEnemy);
                    }
                    break;

                case 'placeTrigger':
                    if (typeof placedTriggers !== 'undefined' && edit.trigger) {
                        placedTriggers.push(edit.trigger);
                        console.log('[LIVE SYNC] Added trigger:', edit.trigger.type, 'at', edit.trigger.x, edit.trigger.y);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'removeTrigger': {
                    // Wave 7: UID-preferred lookup in the test-game runtime.
                    if (typeof placedTriggers === 'undefined' || !Array.isArray(placedTriggers)) break;
                    let idx = -1;
                    if (edit.uid) idx = placedTriggers.findIndex(t => t && t.uid === edit.uid);
                    if (idx < 0 && typeof edit.index === 'number' && edit.index >= 0 && edit.index < placedTriggers.length) idx = edit.index;
                    if (idx >= 0) {
                        placedTriggers.splice(idx, 1);
                        console.log('[LIVE SYNC] Removed trigger at', idx);
                        liveSyncNeedsRedraw = true;
                    }
                    break;
                }

                case 'updateTrigger': {
                    if (typeof placedTriggers === 'undefined' || !Array.isArray(placedTriggers) || !edit.trigger) break;
                    let idx = -1;
                    if (edit.uid) idx = placedTriggers.findIndex(t => t && t.uid === edit.uid);
                    if (idx < 0 && edit.trigger.uid) idx = placedTriggers.findIndex(t => t && t.uid === edit.trigger.uid);
                    if (idx < 0 && typeof edit.index === 'number' && edit.index >= 0 && edit.index < placedTriggers.length) idx = edit.index;
                    if (idx >= 0) {
                        placedTriggers[idx] = edit.trigger;
                        console.log('[LIVE SYNC] Updated trigger at', idx);
                        liveSyncNeedsRedraw = true;
                    }
                    break;
                }

                case 'light':
                    if (typeof pointLights !== 'undefined' && edit.light) {
                        pointLights[edit.key] = edit.light;
                        console.log('[LIVE SYNC] Added/updated light:', edit.key);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'removeLight':
                    if (typeof pointLights !== 'undefined') {
                        delete pointLights[edit.key];
                        console.log('[LIVE SYNC] Removed light:', edit.key);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'addPolyLight':
                    if (typeof polyLights !== 'undefined' && edit.light) {
                        polyLights.push(edit.light);
                        console.log('[LIVE SYNC] Added polygon light:', edit.light.id);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'removePolyLight':
                    if (typeof polyLights !== 'undefined') {
                        const idx = polyLights.findIndex(pl => pl.id === edit.lightId);
                        if (idx >= 0) {
                            polyLights.splice(idx, 1);
                            console.log('[LIVE SYNC] Removed polygon light:', edit.lightId);
                            liveSyncNeedsRedraw = true;
                        }
                    }
                    break;

                case 'tileSound':
                    if (typeof tileSounds !== 'undefined' && edit.sound) {
                        tileSounds[edit.key] = edit.sound;
                        console.log('[LIVE SYNC] Added tile sound:', edit.key);
                    }
                    break;

                case 'removeTileSound':
                    if (typeof tileSounds !== 'undefined') {
                        delete tileSounds[edit.key];
                        console.log('[LIVE SYNC] Removed tile sound:', edit.key);
                    }
                    break;

                case 'updatePlacedAnimProp':
                    // Update placed anim prop (e.g., instance item override)
                    if (typeof placedAnimPropsData !== 'undefined' && edit.index >= 0 && edit.index < placedAnimPropsData.length) {
                        placedAnimPropsData[edit.index] = edit.prop;
                        console.log('[LIVE SYNC] Updated placed anim prop at index', edit.index);
                    }
                    break;

                case 'cameraBounds':
                    if (typeof cameraBounds !== 'undefined' && (edit.mapName === gameMapName || !edit.mapName)) {
                        cameraBounds = edit.bounds;
                        console.log('[LIVE SYNC] Updated camera bounds');
                    }
                    break;

                case 'splitLine':
                    if (typeof tileSplitLines !== 'undefined') {
                        tileSplitLines[edit.key] = edit.mask;
                        console.log('[LIVE SYNC] Added split line:', edit.key);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'clearSplitLine':
                    if (typeof tileSplitLines !== 'undefined') {
                        delete tileSplitLines[edit.key];
                        delete tileSplitLineFlipped[edit.key];
                        console.log('[LIVE SYNC] Cleared split line:', edit.key);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'splitLineFlip':
                    if (typeof tileSplitLineFlipped !== 'undefined') {
                        if (edit.flipped) {
                            tileSplitLineFlipped[edit.key] = true;
                        } else {
                            delete tileSplitLineFlipped[edit.key];
                        }
                        console.log('[LIVE SYNC] Split line flip:', edit.key, edit.flipped);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'addLayer':
                    if (edit.mapName === gameMapName || !edit.mapName) {
                        layers.push([]);
                        for (let y = 0; y < mapRows; y++) {
                            layers[layers.length - 1][y] = [];
                            for (let x = 0; x < mapCols; x++) {
                                layers[layers.length - 1][y][x] = null;
                            }
                        }
                    }
                    break;

                case 'deleteLayer':
                    if (edit.mapName === gameMapName || !edit.mapName) {
                        if (edit.index >= 0 && edit.index < layers.length) {
                            layers.splice(edit.index, 1);
                            liveSyncNeedsRedraw = true;
                        }
                    }
                    break;

                case 'clearMap':
                    if (edit.mapName === gameMapName || !edit.mapName) {
                        layers.forEach((layer, i) => {
                            layers[i] = [];
                            for (let y = 0; y < mapRows; y++) {
                                layers[i][y] = [];
                                for (let x = 0; x < mapCols; x++) {
                                    layers[i][y][x] = null;
                                }
                            }
                        });
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'placeStaticObj':
                    // Place new static object
                    if (edit.placed && typeof placedStaticObjectsData !== 'undefined') {
                        placedStaticObjectsData.push(edit.placed);
                        console.log('[LIVE SYNC] Placed static object at', edit.placed.x, edit.placed.y);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'removeStaticObjPlacement':
                    // Remove static object placement
                    if (typeof placedStaticObjectsData !== 'undefined') {
                        const beforeLen = placedStaticObjectsData.length;
                        for (let i = placedStaticObjectsData.length - 1; i >= 0; i--) {
                            const p = placedStaticObjectsData[i];
                            if (p.x === edit.x && p.y === edit.y && p.mapName === edit.mapName) {
                                placedStaticObjectsData.splice(i, 1);
                                break;
                            }
                        }
                        if (placedStaticObjectsData.length < beforeLen) {
                            console.log('[LIVE SYNC] Removed static object at', edit.x, edit.y);
                            liveSyncNeedsRedraw = true;
                        }
                    }
                    break;

                case 'updateStaticObjCollision':
                    // Update static object collision box
                    if (typeof placedStaticObjectsData !== 'undefined' && edit.index >= 0 && edit.index < placedStaticObjectsData.length) {
                        placedStaticObjectsData[edit.index].collisionBox = edit.collisionBox;
                        console.log('[LIVE SYNC] Updated static object collision at index', edit.index);
                    }
                    break;

                // ===== Wave 6: test-game live-sync hardening =====
                case 'renameMap': {
                    // Critical: trigger routing breaks mid-test if maps get renamed without this.
                    const oldName = edit.oldName, newName = edit.newName;
                    if (!oldName || !newName) break;
                    if (typeof mapsData !== 'undefined' && mapsData[oldName]) {
                        mapsData[newName] = mapsData[oldName];
                        delete mapsData[oldName];
                    }
                    if (typeof placedTriggersData !== 'undefined' && Array.isArray(placedTriggersData)) {
                        for (const t of placedTriggersData) {
                            if (t && t.mapName === oldName) t.mapName = newName;
                            if (t && t.targetMap === oldName) t.targetMap = newName;
                        }
                    }
                    const arrs = ['placedNpcsData','placedItemsData','placedDialogTilesData','placedAnimPropsData','placedStaticObjectsData','placedShopsData'];
                    for (const name of arrs) {
                        try { const a = eval(name);
                            if (Array.isArray(a)) for (const e of a) { if (e && e.mapName === oldName) e.mapName = newName; }
                        } catch(_){}
                    }
                    if (typeof tileSoundsData !== 'undefined' && tileSoundsData) {
                        const oldP = oldName + ':', newP = newName + ':';
                        for (const k of Object.keys(tileSoundsData)) {
                            if (k.startsWith(oldP)) { tileSoundsData[newP + k.slice(oldP.length)] = tileSoundsData[k]; delete tileSoundsData[k]; }
                        }
                    }
                    if (typeof pointLightsData !== 'undefined' && pointLightsData) {
                        const oldP = oldName + ':', newP = newName + ':';
                        for (const k of Object.keys(pointLightsData)) {
                            if (k.startsWith(oldP)) { pointLightsData[newP + k.slice(oldP.length)] = pointLightsData[k]; delete pointLightsData[k]; }
                        }
                    }
                    if (typeof currentGameMap !== 'undefined' && currentGameMap === oldName) currentGameMap = newName;
                    if (typeof spawnMapName !== 'undefined' && spawnMapName === oldName) spawnMapName = newName;
                    liveSyncNeedsRedraw = true;
                    console.log('[LIVE SYNC] renameMap:', oldName, '->', newName);
                    break;
                }

                case 'setPlayerSpawn':
                    if (typeof edit.x === 'number' && typeof edit.y === 'number') {
                        if (typeof playerPreviewPos !== 'undefined') playerPreviewPos = { x: edit.x, y: edit.y };
                        if (edit.mapName && typeof spawnMapName !== 'undefined') spawnMapName = edit.mapName;
                        console.log('[LIVE SYNC] spawn updated (takes effect on next respawn/transition):', edit.mapName, edit.x, edit.y);
                    }
                    break;

                case 'lightingSettings':
                    if (edit.settings && typeof lightingSettingsData !== 'undefined') {
                        Object.assign(lightingSettingsData, edit.settings);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'addSound':
                case 'removeSound':
                case 'setPlayerSound':
                    // Library mutations — touch the test-game's data copy if present.
                    if (edit.editType === 'addSound' && edit.sound && typeof soundsData !== 'undefined' && Array.isArray(soundsData)) {
                        const insertIdx = (typeof edit.index === 'number') ? edit.index : soundsData.length;
                        soundsData[insertIdx] = {
                            name: edit.sound.name, data: edit.sound.data,
                            duration: edit.sound.duration || 0, type: edit.sound.type || 'ambient'
                        };
                    } else if (edit.editType === 'removeSound' && typeof edit.index === 'number'
                               && typeof soundsData !== 'undefined' && Array.isArray(soundsData)
                               && edit.index >= 0 && edit.index < soundsData.length) {
                        soundsData.splice(edit.index, 1);
                        // Dangling-index repair on game side.
                        if (typeof tileSoundsData !== 'undefined' && tileSoundsData) {
                            for (const k of Object.keys(tileSoundsData)) {
                                const e = tileSoundsData[k];
                                if (!e) continue;
                                if (e.soundIndex === edit.index) delete tileSoundsData[k];
                                else if (e.soundIndex > edit.index) e.soundIndex--;
                            }
                        }
                        if (typeof playerSoundsData !== 'undefined' && playerSoundsData) {
                            for (const action of Object.keys(playerSoundsData)) {
                                const c = playerSoundsData[action];
                                if (c && typeof c.soundIndex === 'number') {
                                    if (c.soundIndex === edit.index) c.soundIndex = -1;
                                    else if (c.soundIndex > edit.index) c.soundIndex--;
                                }
                            }
                        }
                    } else if (edit.editType === 'setPlayerSound' && edit.action && edit.config
                               && typeof playerSoundsData !== 'undefined' && playerSoundsData) {
                        Object.assign(playerSoundsData[edit.action] || (playerSoundsData[edit.action] = {}), edit.config);
                    }
                    break;

                case 'addTileset':
                    if (edit.data && typeof tilesetImages !== 'undefined' && Array.isArray(tilesetImages)) {
                        const img = new Image();
                        img.onload = () => { tilesetImages.push(img); liveSyncNeedsRedraw = true; };
                        img.src = edit.data;
                    }
                    break;

                case 'deleteTileset':
                    if (typeof edit.index === 'number' && typeof tilesetImages !== 'undefined' && Array.isArray(tilesetImages)) {
                        tilesetImages.splice(edit.index, 1);
                        // Walk all layers across all maps — null cells whose tilesetIndex equals the deleted, decrement others.
                        if (typeof mapsData !== 'undefined' && mapsData) {
                            for (const mName of Object.keys(mapsData)) {
                                const md = mapsData[mName];
                                if (!md || !Array.isArray(md.layers)) continue;
                                for (const layer of md.layers) {
                                    if (!Array.isArray(layer)) continue;
                                    for (const row of layer) {
                                        if (!Array.isArray(row)) continue;
                                        for (let x = 0; x < row.length; x++) {
                                            const cell = row[x];
                                            if (!cell) continue;
                                            if (cell.tilesetIndex === edit.index) row[x] = null;
                                            else if (cell.tilesetIndex > edit.index) cell.tilesetIndex--;
                                        }
                                    }
                                }
                            }
                        }
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'moveLayerUp':
                case 'moveLayerDown': {
                    // Swap layers[i] with layers[i ± 1] on the current map only (test game viewport).
                    const delta = (edit.editType === 'moveLayerUp') ? -1 : 1;
                    const i = edit.index;
                    if (typeof layers !== 'undefined' && Array.isArray(layers)
                        && typeof i === 'number' && i + delta >= 0 && i + delta < layers.length) {
                        const tmp = layers[i]; layers[i] = layers[i + delta]; layers[i + delta] = tmp;
                        liveSyncNeedsRedraw = true;
                    }
                    break;
                }

                case 'expandMap': {
                    // Broadcasted by Wave 3 auto-expand. Extend mapCols/mapRows on the target map.
                    const mn = edit.mapName || (typeof currentGameMap !== 'undefined' ? currentGameMap : 'main');
                    const dir = edit.direction || 'bottom';
                    const amount = edit.amount || 10;
                    if (typeof mapsData !== 'undefined' && mapsData && mapsData[mn]) {
                        const md = mapsData[mn];
                        if (dir === 'bottom' && Array.isArray(md.layers)) {
                            md.mapRows = (md.mapRows || 0) + amount;
                            for (const layer of md.layers) {
                                if (!Array.isArray(layer)) continue;
                                while (layer.length < md.mapRows) layer.push(new Array(md.mapCols || 0).fill(null));
                            }
                        } else if (dir === 'right' && Array.isArray(md.layers)) {
                            md.mapCols = (md.mapCols || 0) + amount;
                            for (const layer of md.layers) {
                                if (!Array.isArray(layer)) continue;
                                for (const row of layer) { while (row && row.length < md.mapCols) row.push(null); }
                            }
                        }
                        if (mn === currentGameMap) {
                            if (typeof mapCols !== 'undefined') mapCols = md.mapCols;
                            if (typeof mapRows !== 'undefined') mapRows = md.mapRows;
                            if (typeof layers !== 'undefined') layers = md.layers;
                        }
                        liveSyncNeedsRedraw = true;
                    }
                    break;
                }

                case 'addStaticObj':
                    if (edit.obj && typeof staticObjectsData !== 'undefined' && Array.isArray(staticObjectsData)) {
                        const copy = { ...edit.obj };
                        const img = new Image();
                        img.onload = () => { copy._spriteImg = img; liveSyncNeedsRedraw = true; };
                        img.src = edit.obj.spriteData;
                        staticObjectsData.push(copy);
                    }
                    break;

                case 'removeStaticObj':
                    if (typeof edit.index === 'number'
                        && typeof staticObjectsData !== 'undefined' && Array.isArray(staticObjectsData)
                        && edit.index >= 0 && edit.index < staticObjectsData.length) {
                        staticObjectsData.splice(edit.index, 1);
                        if (typeof placedStaticObjectsData !== 'undefined' && Array.isArray(placedStaticObjectsData)) {
                            for (let j = placedStaticObjectsData.length - 1; j >= 0; j--) {
                                const p = placedStaticObjectsData[j];
                                if (!p) continue;
                                if (p.objIndex === edit.index) placedStaticObjectsData.splice(j, 1);
                                else if (p.objIndex > edit.index) p.objIndex--;
                            }
                        }
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'addAnimProp':
                    if (edit.prop && typeof animatedPropsData !== 'undefined' && Array.isArray(animatedPropsData)) {
                        animatedPropsData.push({ ...edit.prop });
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'updateAnimProp':
                    if (typeof edit.index === 'number' && edit.prop
                        && typeof animatedPropsData !== 'undefined' && Array.isArray(animatedPropsData)
                        && edit.index >= 0 && edit.index < animatedPropsData.length) {
                        animatedPropsData[edit.index] = { ...edit.prop };
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'removeAnimProp':
                    if (typeof edit.index === 'number'
                        && typeof animatedPropsData !== 'undefined' && Array.isArray(animatedPropsData)
                        && edit.index >= 0 && edit.index < animatedPropsData.length) {
                        animatedPropsData.splice(edit.index, 1);
                        // Walk map layers dropping/shifting animTile cells referencing the deleted index.
                        if (typeof mapsData !== 'undefined' && mapsData) {
                            for (const mn of Object.keys(mapsData)) {
                                const md = mapsData[mn];
                                if (!md || !Array.isArray(md.layers)) continue;
                                for (const layer of md.layers) {
                                    if (!Array.isArray(layer)) continue;
                                    for (const row of layer) {
                                        if (!Array.isArray(row)) continue;
                                        for (let x = 0; x < row.length; x++) {
                                            const cell = row[x];
                                            if (!cell || cell.type !== 'animTile') continue;
                                            if (cell.propIndex === edit.index) row[x] = null;
                                            else if (cell.propIndex > edit.index) cell.propIndex--;
                                        }
                                    }
                                }
                            }
                        }
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'addPlayerCharacter':
                case 'updatePlayerCharacter':
                case 'deletePlayerCharacter':
                case 'setActivePlayer':
                    // Player-character changes mid-test: stash on projectData so the next respawn picks them up.
                    // Hot-swapping the active player's sprite sheets mid-run is complex; CLAUDE.md policy note:
                    // acceptable gap, player sees change on respawn/map transition.
                    try {
                        if (edit.editType === 'addPlayerCharacter' && edit.character
                            && Array.isArray(projectData.playerCharacters)) {
                            projectData.playerCharacters.push({ ...edit.character });
                        } else if (edit.editType === 'updatePlayerCharacter' && typeof edit.index === 'number'
                                   && edit.character && Array.isArray(projectData.playerCharacters)
                                   && edit.index >= 0 && edit.index < projectData.playerCharacters.length) {
                            projectData.playerCharacters[edit.index] = { ...edit.character };
                        } else if (edit.editType === 'deletePlayerCharacter' && typeof edit.index === 'number'
                                   && Array.isArray(projectData.playerCharacters)
                                   && edit.index >= 0 && edit.index < projectData.playerCharacters.length) {
                            projectData.playerCharacters.splice(edit.index, 1);
                        } else if (edit.editType === 'setActivePlayer' && typeof edit.index === 'number') {
                            projectData.activePlayerIndex = edit.index;
                        }
                    } catch (_) {}
                    break;
                // ===== end Wave 6 additions =====

                default:
                    if (typeof edit.editType === 'string' && edit.editType.length) {
                        console.warn('[LIVE] unhandled editType:', edit.editType);
                    }
                    break;
            }
        }

        // Wait for data from builder via postMessage
        console.log('Waiting for project data from builder...');
        window.onmessage = function(e) {
            if (e.data.type === 'project-data') {
                console.log('Received project data');
                projectData = JSON.parse(e.data.data);
                // Check for auto-multiplayer from builder co-op
                if (e.data.autoMultiplayer) {
                    console.log('Auto-multiplayer enabled:', e.data.autoMultiplayer);
                    // Set multiplayer config so initGame connects automatically
                    projectData.multiplayer = {
                        playerName: e.data.autoMultiplayer.playerName,
                        roomCode: e.data.autoMultiplayer.roomCode
                    };
                }
                if (window.opener) {
                    window.opener.postMessage({ type: 'log', msg: 'Project data received, size: ' + e.data.data.length }, '*');
                }
                initGame();

                // Connect to builder for live sync of edits
                if (e.data.builderSync && e.data.builderSync.roomCode) {
                    setTimeout(() => connectToBuilderSync(e.data.builderSync.roomCode), 1000);
                }
            } else if (e.data.type === 'sound-data') {
                const { index, data, name } = e.data;
                if (projectData && projectData.sounds && projectData.sounds[index]) {
                    projectData.sounds[index].data = data;
                    console.log('Received sound', index, name);
                    if (window.opener) {
                        window.opener.postMessage({ type: 'log', msg: 'Sound received: ' + name }, '*');
                    }
                }
            } else if (e.data.type === 'builderEdit') {
                // Live edit from builder (solo mode - direct postMessage)
                if (e.data.edit && typeof applyLiveEdit === 'function') {
                    console.log('[LIVE SYNC] Received edit via postMessage');
                    applyLiveEdit(e.data.edit, false);
                }
            }
        };
        // Signal ready to host. Desktop test uses a popup (window.opener); the mobile
        // "join the live world" path runs this engine inside an in-page iframe, where the
        // host is window.parent. Fall back accordingly so the boot handshake fires either way.
        var __hostWin = window.opener || (window.parent && window.parent !== window ? window.parent : null);
        if (__hostWin) {
            __hostWin.postMessage({ type: 'ready' }, '*');
        } else {
            console.error('No host window found!');
        }

        // Debug/UI functions (must be global for onclick handlers)
        let showCollision = false;
        let showSounds = false;

        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.log('Fullscreen error:', err);
                });
            } else {
                document.exitFullscreen();
            }
        }
        function toggleCollision() {
            showCollision = !showCollision;
            document.querySelectorAll('#debugButtons button')[1].classList.toggle('active', showCollision);
        }
        function toggleSoundDebug() {
            showSounds = !showSounds;
            document.querySelectorAll('#debugButtons button')[2].classList.toggle('active', showSounds);
        }
        function toggleDebugPanel() {
            const panel = document.getElementById('debugPanel');
            panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
            document.querySelectorAll('#debugButtons button')[3].classList.toggle('active', panel.style.display === 'block');
        }

        // Performance panel
        let perfPanelVisible = false;
        let fpsHistory = [];
        const FPS_HISTORY_SIZE = 60;
        function togglePerfPanel() {
            perfPanelVisible = !perfPanelVisible;
            const panel = document.getElementById('perfPanel');
            panel.style.display = perfPanelVisible ? 'block' : 'none';
            document.querySelectorAll('#debugButtons button')[5].classList.toggle('active', perfPanelVisible);
            if (perfPanelVisible) {
                // Initialize FPS graph bars
                const graph = document.getElementById('fpsGraph');
                graph.innerHTML = '';
                for (let i = 0; i < FPS_HISTORY_SIZE; i++) {
                    const bar = document.createElement('div');
                    bar.className = 'fps-bar';
                    bar.style.height = '0px';
                    graph.appendChild(bar);
                }
            }
        }

        // Network recording for debugging freezes
        let networkRecording = false;
        let networkLog = [];
        let frameTimeLog = [];
        let perfLog = [];  // Detailed per-frame performance breakdown
        let recordStartTime = 0;
        const MAX_LOG_ENTRIES = 500;
        const MAX_PERF_ENTRIES = 300;  // ~5 seconds at 60fps

        function toggleNetworkRecording() {
            networkRecording = !networkRecording;
            const btn = document.getElementById('recordNetBtn');
            const copyBtn = document.getElementById('copyNetBtn');
            const status = document.getElementById('recordStatus');

            if (networkRecording) {
                // Start recording
                networkLog = [];
                frameTimeLog = [];
                perfLog = [];
                recordStartTime = performance.now();
                btn.textContent = '⏹ Stop';
                btn.style.background = '#a33';
                copyBtn.disabled = true;
                status.textContent = 'Recording... (0 frames)';
                status.style.color = '#f88';
            } else {
                // Stop recording
                btn.textContent = '🔴 Record';
                btn.style.background = '#533';
                copyBtn.disabled = false;
                const avgFps = perfLog.length > 0 ? Math.round(perfLog.reduce((a, b) => a + b.fps, 0) / perfLog.length) : 0;
                status.textContent = perfLog.length + ' frames, avg ' + avgFps + ' FPS';
                status.style.color = '#8f8';
            }
        }

        function logNetworkEvent(type, direction, data, size) {
            if (!networkRecording) return;
            if (networkLog.length >= MAX_LOG_ENTRIES) return;

            const now = performance.now();
            const elapsed = now - recordStartTime;

            networkLog.push({
                t: elapsed.toFixed(1),
                type: type,
                dir: direction,
                size: size || 0,
                data: typeof data === 'string' ? data.substring(0, 100) : JSON.stringify(data).substring(0, 100)
            });

            const status = document.getElementById('recordStatus');
            if (status) status.textContent = 'Recording... (' + networkLog.length + ' events)';
        }

        function logFrameTime(frameTime, fps) {
            if (!networkRecording) return;
            if (frameTimeLog.length >= MAX_LOG_ENTRIES * 2) return;

            const now = performance.now();
            const elapsed = now - recordStartTime;

            // Only log if frame time is high (potential freeze)
            if (frameTime > 20) { // More than 20ms = potential issue
                frameTimeLog.push({
                    t: elapsed.toFixed(1),
                    ft: frameTime.toFixed(1),
                    fps: fps
                });
            }
        }

        // Log detailed per-frame performance breakdown
        function logPerfFrame(data) {
            if (!networkRecording) return;
            if (perfLog.length >= MAX_PERF_ENTRIES) return;

            const now = performance.now();
            const elapsed = now - recordStartTime;

            perfLog.push({
                t: Math.round(elapsed),
                ...data
            });

            // Update status
            const status = document.getElementById('recordStatus');
            if (status) status.textContent = 'Recording... (' + perfLog.length + ' frames)';
        }

        function copyNetworkLog() {
            // Calculate performance summary
            const avgFps = perfLog.length > 0 ? Math.round(perfLog.reduce((a, b) => a + b.fps, 0) / perfLog.length) : 0;
            const avgFrameTime = perfLog.length > 0 ? (perfLog.reduce((a, b) => a + b.total, 0) / perfLog.length).toFixed(1) : 0;
            const avgUpdate = perfLog.length > 0 ? (perfLog.reduce((a, b) => a + (b.update || 0), 0) / perfLog.length).toFixed(1) : 0;
            const avgDraw = perfLog.length > 0 ? (perfLog.reduce((a, b) => a + (b.draw || 0), 0) / perfLog.length).toFixed(1) : 0;
            const avgNpc = perfLog.length > 0 ? (perfLog.reduce((a, b) => a + (b.npc || 0), 0) / perfLog.length).toFixed(1) : 0;
            const avgLight = perfLog.length > 0 ? (perfLog.reduce((a, b) => a + (b.light || 0), 0) / perfLog.length).toFixed(1) : 0;

            const report = {
                recorded: new Date().toISOString(),
                duration: ((performance.now() - recordStartTime) / 1000).toFixed(1) + 's',
                summary: {
                    frames: perfLog.length,
                    avgFps: avgFps,
                    avgFrameTime: avgFrameTime + 'ms',
                    avgUpdate: avgUpdate + 'ms',
                    avgDraw: avgDraw + 'ms',
                    avgNpc: avgNpc + 'ms',
                    avgLight: avgLight + 'ms',
                    netEvents: networkLog.length
                },
                frames: perfLog,
                networkEvents: networkLog
            };

            const text = JSON.stringify(report, null, 2);
            navigator.clipboard.writeText(text).then(() => {
                const status = document.getElementById('recordStatus');
                status.textContent = 'Copied to clipboard!';
                status.style.color = '#4f8';
                setTimeout(() => {
                    status.textContent = perfLog.length + ' frames, avg ' + avgFps + ' FPS';
                    status.style.color = '#8f8';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy:', err);
                alert('Failed to copy. Check console for data.');
                console.log('Perf Log:', text);
            });
        }

        function closeGame() {
            window.close();
        }
        let uiHidden = true; // Start with UI hidden
        function hideAllUI() {
            uiHidden = true;
            document.getElementById('debugButtons').style.display = 'none';
            document.getElementById('info').style.display = 'none';
            document.getElementById('debugPanel').style.display = 'none';
            document.getElementById('perfPanel').style.display = 'none';
            perfPanelVisible = false;
            const toggleBtn = document.getElementById('toggleLogBtn');
            if (toggleBtn) toggleBtn.style.display = 'none';
            const debugLog = document.getElementById('debugLog');
            if (debugLog) debugLog.style.display = 'none';
        }
        function showAllUI() {
            uiHidden = false;
            document.getElementById('debugButtons').style.display = '';
            document.getElementById('info').style.display = '';
        }
        function toggleAllUI() {
            if (uiHidden) showAllUI();
            else hideAllUI();
        }

        // Shape-based attack hitbox per direction (triangle/cone) - global for hitbox panel
        let playerHitboxRange = { up: 35, down: 35, left: 35, right: 30 };
        let playerHitboxWidth = { up: 90, down: 90, left: 90, right: 90 };
        let playerHitboxOffsetY = { up: 15, down: -15, left: 0, right: 0 };
        let playerHitboxOffsetX = { up: 0, down: 0, left: 15, right: -15 };

        // Hitbox panel functions
        let hitboxEditDir = 'down';
        function toggleHitboxPanel() {
            const panel = document.getElementById('hitboxPanel');
            panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
            document.querySelectorAll('#debugButtons button')[4].classList.toggle('active', panel.style.display === 'block');
            if (panel.style.display === 'block') {
                updateHitboxSliders();
            }
        }

        function setHitboxDir(dir) {
            hitboxEditDir = dir;
            document.querySelectorAll('[id^="hitboxDir"]').forEach(b => {
                b.classList.remove('active');
                b.style.background = '';
            });
            const btn = document.getElementById('hitboxDir' + dir.charAt(0).toUpperCase() + dir.slice(1));
            btn.classList.add('active');
            btn.style.background = '#66f';
            updateHitboxSliders();
        }

        function updateHitboxSliders() {
            const dir = hitboxEditDir;
            document.getElementById('hbRangeSlider').value = playerHitboxRange[dir];
            document.getElementById('hbRangeVal').textContent = playerHitboxRange[dir];
            document.getElementById('hbWidthSlider').value = playerHitboxWidth[dir];
            document.getElementById('hbWidthVal').textContent = playerHitboxWidth[dir];
            document.getElementById('hbOffsetXSlider').value = playerHitboxOffsetX[dir];
            document.getElementById('hbOffsetXVal').textContent = playerHitboxOffsetX[dir];
            document.getElementById('hbOffsetYSlider').value = playerHitboxOffsetY[dir];
            document.getElementById('hbOffsetYVal').textContent = playerHitboxOffsetY[dir];
        }

        function copyAllHitboxFromDir() {
            const dir = hitboxEditDir;
            ['up', 'down', 'left', 'right'].forEach(d => {
                playerHitboxRange[d] = playerHitboxRange[dir];
                playerHitboxWidth[d] = playerHitboxWidth[dir];
                playerHitboxOffsetX[d] = playerHitboxOffsetX[dir];
                playerHitboxOffsetY[d] = playerHitboxOffsetY[dir];
            });
            console.log('Copied ' + dir + ' hitbox to all directions');
        }

        function copyHitboxSettings() {
            const settings = {
                hitboxRange: playerHitboxRange,
                hitboxWidth: playerHitboxWidth,
                hitboxOffsetX: playerHitboxOffsetX,
                hitboxOffsetY: playerHitboxOffsetY
            };
            const json = JSON.stringify(settings, null, 2);
            navigator.clipboard.writeText(json).then(() => {
                console.log('Hitbox settings copied to clipboard');
            });
        }
