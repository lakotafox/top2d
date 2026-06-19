        // ========== CREATE OBJECT MODE ==========
        function toggleCreateObjectMode() {
            if (!createObjectMode) {
                // Enter create object mode
                createObjectMode = true;
                tileSelectModeActive = true;
                selectedTiles = [];
                selectedTileData = null;

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
                    btn.style.background = '#c9a227';
                    btn.style.color = '#000';
                } else {
                    btn.textContent = 'SELECT TILES...';
                    btn.style.background = '#666';
                    btn.style.color = '#fff';
                }
            } else {
                btn.textContent = 'CREATE OBJECT';
                btn.style.background = '#4a7c59';
                btn.style.color = '#fff';
            }
        }

        function updateStaticObjScale(value) {
            staticObjPlacementScale = parseFloat(value);
            const label = document.getElementById('staticObjScaleValue');
            if (label) label.textContent = staticObjPlacementScale.toFixed(2).replace(/\.?0+$/, '') + 'x';
        }

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
            // Note: selectedTileData.x/y are already in pixels, width/height are in tile counts
            const pixelX = selectedTileData.x;
            const pixelY = selectedTileData.y;
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

            // Create static object
            const obj = {
                name: name.trim(),
                spriteData: spriteData,
                width: selectedTileData.width,
                height: selectedTileData.height,
                tilesetIndex: currentTilesetIndex,
                sourceTiles: sourceTiles,
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

        function placeStaticObjectAt(gridX, gridY) {
            if (gridX < 0 || gridY < 0 || gridX >= mapCols || gridY >= mapRows) return;
            if (currentStaticObjIndex < 0 || !staticObjects[currentStaticObjIndex]) return;

            // Store grid coordinates (like items do)
            const placed = {
                objIndex: currentStaticObjIndex,
                x: gridX,
                y: gridY,
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

        function removeStaticObjectAt(gridX, gridY) {
            // Search from top to bottom (last placed = on top)
            for (let i = placedStaticObjects.length - 1; i >= 0; i--) {
                const placed = placedStaticObjects[i];
                if (placed.mapName !== currentMapName) continue;

                const obj = staticObjects[placed.objIndex];
                if (!obj) continue;

                const scale = placed.scale || 1;
                const w = obj.width * scale;
                const h = obj.height * scale;

                // placed.x/y are grid coords
                if (gridX >= placed.x && gridX < placed.x + w &&
                    gridY >= placed.y && gridY < placed.y + h) {

                    broadcastEdit({
                        editType: 'removeStaticObjPlacement',
                        x: placed.x,
                        y: placed.y,
                        mapName: placed.mapName
                    });

                    placedStaticObjects.splice(i, 1);
                    renderMap();
                    console.log('[STATIC OBJ] Removed at grid', placed.x, placed.y);
                    return;
                }
            }
        }

        paintTilesetCanvas.addEventListener('mousedown', (e) => {
            if (mode !== 'tile') return;
            const rect = paintTilesetCanvas.getBoundingClientRect();
            const displayZoom = paintTilesetZoom;
            const x = Math.floor((e.clientX - rect.left) / displayZoom / gridSize) * gridSize;
            const y = Math.floor((e.clientY - rect.top) / displayZoom / gridSize) * gridSize;

            selectionStart = { x, y };
            tilesetSelecting = true;
        });

        paintTilesetCanvas.addEventListener('mousemove', (e) => {
            if (!tilesetSelecting || mode !== 'tile') return;
            updateTileSelection(e);
        });

        paintTilesetCanvas.addEventListener('mouseup', (e) => {
            if (!tilesetSelecting || mode !== 'tile') return;
            updateTileSelection(e);
            tilesetSelecting = false;
        });

        // Touch support for tileset selection (only when select mode is active)
        paintTilesetCanvas.addEventListener('touchstart', (e) => {
            if (mode !== 'tile') return;
            if (!tileSelectModeActive) return; // Allow scrolling when select mode is off
            e.preventDefault();
            const touch = e.touches[0];
            const rect = paintTilesetCanvas.getBoundingClientRect();
            const displayZoom = paintTilesetZoom;
            const x = Math.floor((touch.clientX - rect.left) / displayZoom / gridSize) * gridSize;
            const y = Math.floor((touch.clientY - rect.top) / displayZoom / gridSize) * gridSize;

            selectionStart = { x, y };
            tilesetSelecting = true;
        }, { passive: false });

        paintTilesetCanvas.addEventListener('touchmove', (e) => {
            if (!tilesetSelecting || mode !== 'tile') return;
            if (!tileSelectModeActive) return;
            e.preventDefault();
            updateTileSelectionTouch(e.touches[0]);
        }, { passive: false });

        paintTilesetCanvas.addEventListener('touchend', (e) => {
            if (!tilesetSelecting || mode !== 'tile') return;
            tilesetSelecting = false;
        });

        // Shift + scroll wheel zooms the tileset palette:
        //   zoom OUT (scroll down) to see/grab more tiles at once, zoom IN (scroll up) for tiny items.
        // Plain scroll (no Shift) is left alone so the palette still scrolls normally.
        paintTilesetCanvas.addEventListener('wheel', (e) => {
            if (!e.shiftKey) return;
            e.preventDefault();
            const prev = paintTilesetZoom;
            paintTilesetZoom = Math.max(1, Math.min(8, prev + (e.deltaY < 0 ? 1 : -1)));
            if (paintTilesetZoom === prev) return;
            // Anchor the zoom on the tile under the cursor so it doesn't jump away.
            const rect = paintTilesetCanvas.getBoundingClientRect();
            const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
            const ratio = paintTilesetZoom / prev;
            drawPaintTileset(); // re-renders the canvas at the new zoom
            const sc = paintTilesetCanvas.parentElement;
            if (sc) {
                if (sc.scrollWidth > sc.clientWidth) sc.scrollLeft += cx * (ratio - 1);
                if (sc.scrollHeight > sc.clientHeight) sc.scrollTop += cy * (ratio - 1);
            }
        }, { passive: false });

        function updateTileSelectionTouch(touch) {
            const rect = paintTilesetCanvas.getBoundingClientRect();
            const displayZoom = paintTilesetZoom;
            const x = Math.floor((touch.clientX - rect.left) / displayZoom / gridSize) * gridSize;
            const y = Math.floor((touch.clientY - rect.top) / displayZoom / gridSize) * gridSize;

            const minX = Math.min(selectionStart.x, x);
            const minY = Math.min(selectionStart.y, y);
            const maxX = Math.max(selectionStart.x, x);
            const maxY = Math.max(selectionStart.y, y);

            selectedTiles = [];
            for (let ty = minY; ty <= maxY; ty += gridSize) {
                for (let tx = minX; tx <= maxX; tx += gridSize) {
                    selectedTiles.push({ x: tx, y: ty });
                }
            }

            const selWidth = (maxX - minX) / gridSize + 1;
            const selHeight = (maxY - minY) / gridSize + 1;

            selectedTileData = { x: minX, y: minY, width: selWidth, height: selHeight };
            drawPaintTileset();
        }

        function updateTileSelection(e) {
            const rect = paintTilesetCanvas.getBoundingClientRect();
            const displayZoom = paintTilesetZoom;
            const x = Math.floor((e.clientX - rect.left) / displayZoom / gridSize) * gridSize;
            const y = Math.floor((e.clientY - rect.top) / displayZoom / gridSize) * gridSize;

            // Calculate selection rectangle
            const minX = Math.min(selectionStart.x, x);
            const minY = Math.min(selectionStart.y, y);
            const maxX = Math.max(selectionStart.x, x);
            const maxY = Math.max(selectionStart.y, y);

            // Build array of selected tiles
            selectedTiles = [];
            for (let ty = minY; ty <= maxY; ty += gridSize) {
                for (let tx = minX; tx <= maxX; tx += gridSize) {
                    selectedTiles.push({ x: tx, y: ty });
                }
            }

            // Calculate selection dimensions
            const selWidth = (maxX - minX) / gridSize + 1;
            const selHeight = (maxY - minY) / gridSize + 1;

            // Store selection bounds for painting
            selectedTileData = { x: minX, y: minY, width: selWidth, height: selHeight };
            drawPaintTileset();

            // Update CREATE OBJECT button when tiles selected
            if (createObjectMode) {
                updateCreateObjectButton();
            }
        }

        function updateSelectedPreview() {
            // Preview removed
        }

        function updateSelectedTilePreview() {
            // Preview removed
        }

        // Map painting
        let painting = false;
        let erasing = false;

        mapCanvas.addEventListener('mousedown', (e) => {
            // Skip painting when grab tool is active
            if (grabToolActive) return;

            e.preventDefault();
            const rect = mapCanvas.getBoundingClientRect();
            const tileSize = gridSize * zoom;
            const x = Math.floor((e.clientX - rect.left) / tileSize);
            const y = Math.floor((e.clientY - rect.top) / tileSize);

            // DEBUG: Ctrl+Shift+Click to mark position (in pixel coords like game uses)
            if (e.ctrlKey && e.shiftKey) {
                const pixelX = (e.clientX - rect.left) / zoom;
                const pixelY = (e.clientY - rect.top) / zoom;
                window.debugClickPos = { x: Math.round(pixelX), y: Math.round(pixelY) };
                console.log('[DEBUG] Marked position:', window.debugClickPos, 'tile:', x, y);
                renderMap();
                return;
            }

            // Check if in door animation tile selection mode (only on correct map)
            if (selectingAnimTiles && pendingAnimTrigger && doorAnimMapName === currentMapName && e.button === 0) {
                // Toggle tile selection
                toggleAnimTileSelection(x, y);
                return;
            }

            // In door animation painting mode, let normal tile painting handle clicks
            // (Done button is now HTML, not on canvas)

            // Set spawn mode - click anywhere to place player spawn
            if (setSpawnMode) {
                playerPreviewPos.x = x;
                playerPreviewPos.y = y;
                spawnMapName = currentMapName; // Record which map spawn is on
                playerPreviewVisible = true;
                toggleSetSpawnMode(); // Turn off set spawn mode after placing
                renderMap();
                // Wave 3: broadcast spawn point (was silently local-only).
                broadcastEdit({ editType: 'setPlayerSpawn', x, y, mapName: spawnMapName });
                return;
            }

            // Quest condition setting mode - click to set condition target
            if (settingConditionMode) {
                if (handleMapClickForCondition(x, y)) {
                    return;
                }
            }

            // Quest giver/turn-in NPC setting mode
            if (settingQuestGiverMode || settingQuestTurnInMode) {
                if (handleMapClickForQuestNpc(x, y)) {
                    return;
                }
            }

            // Find-tileset pick mode — capture the click, report the source tileset
            if (findTilesetMode) {
                if (e.button === 0) findTilesetAt(x, y);
                else toggleFindTilesetMode(); // right-click cancels
                return;
            }

            if (copyMode) {
                // Start copy selection
                copyStart = { x, y };
                copyEnd = { x, y };
                renderMap();
                return;
            }

            // Animated prop mode - click to place, right-click to remove (no dragging)
            if (mode === 'animProp') {
                // Static object edit mode - click to edit collision box
                if (editStaticObjOnMapMode && e.button === 0) {
                    const staticObjInfo = findStaticObjAt(x, y);
                    if (staticObjInfo) {
                        openStaticObjEditPopup(staticObjInfo);
                        return;
                    }
                }
                // Static object placement/removal takes priority
                if (currentStaticObjIndex >= 0 && staticObjects[currentStaticObjIndex] && !editStaticObjOnMapMode) {
                    if (e.button === 0) {
                        placeStaticObjectAt(x, y);
                    } else if (e.button === 2) {
                        removeStaticObjectAt(x, y);
                    }
                    return;
                }
                // Edit mode - click on placed props to edit their timing
                if (editAnimPropOnMapMode && e.button === 0) {
                    const propInfo = findAnimPropAt(x, y);
                    if (propInfo) {
                        openAnimPropEditPopup(propInfo);
                        return;
                    }
                }
                if (e.button === 0 && currentAnimPropIndex >= 0 && !editAnimPropOnMapMode) {
                    placeAnimPropAt(x, y);
                } else if (e.button === 2) {
                    removeAnimPropAt(x, y);
                }
                return;
            }

            // Item mode - click to place interactive item, right-click to remove
            // Also handle clicking on interactive anim props to assign items
            if (mode === 'item') {
                // Check if clicking on an interactive anim prop (chest with giveItem)
                const clickedPropIdx = findInteractivePropAt(x, y);
                if (clickedPropIdx >= 0 && e.button === 0) {
                    // Open item assignment for this prop instance
                    openPropItemAssignment(clickedPropIdx);
                    return;
                }

                if (e.button === 0 && currentItemIndex >= 0) {
                    placeItemAt(x, y);
                } else if (e.button === 2) {
                    removeItemAt(x, y);
                }
                return;
            }

            // Sound mode - click to place/select tile sound, right-click to remove
            if (mode === 'sound' && soundAttachMode === 'tile') {
                const key = `${currentMapName}:${x},${y}`;
                if (e.button === 0) {
                    // If clicking on existing sound, select it for editing
                    if (tileSounds[key]) {
                        selectTileSound(key);
                    } else if (selectedTileSoundKey) {
                        // If a sound is selected and clicking empty tile, deselect
                        deselectTileSound();
                    } else {
                        // Place new sound
                        placeTileSound(x, y);
                    }
                } else if (e.button === 2) {
                    if (selectedTileSoundKey === key) {
                        deselectTileSound();
                    }
                    removeTileSound(key);
                }
                return;
            }

            // Lighting mode - click to place point lights (free placement), right-click to remove
            if (mode === 'lighting') {
                // Use float coordinates for free placement (not grid-snapped)
                const freeX = (e.clientX - rect.left) / tileSize;
                const freeY = (e.clientY - rect.top) / tileSize;

                // Polygon light drawing mode
                if (polyLightDrawing) {
                    if (e.button === 0) {
                        addPolyLightPoint(freeX, freeY);
                    } else if (e.button === 2) {
                        // Right-click finishes polygon
                        finishPolyLight();
                    }
                    return;
                }

                // Normal point light placement
                if (e.button === 0) {
                    placeLightAt(freeX.toFixed(2), freeY.toFixed(2));
                } else if (e.button === 2) {
                    // Find and remove nearest light within 1 tile
                    removeNearestLight(freeX, freeY);
                }
                return;
            }

            // Trigger mode - click to place triggers, right-click to remove, drag green spawns
            if (mode === 'trigger') {
                console.log('[CLICK DEBUG] Trigger mode click at', x, y, 'button:', e.button);
                console.log('[CLICK DEBUG] settingSpawnPoint:', settingSpawnPoint, 'settingWalkOutPoint:', settingWalkOutPoint);

                // Check if we're setting walk-out point (before spawn)
                if (settingWalkOutPoint && e.button === 0) {
                    console.log('[CLICK DEBUG] Calling setWalkOutPointAt');
                    setWalkOutPointAt(x, y);
                    return;
                }

                // Check if we're setting spawn point
                if (settingSpawnPoint && e.button === 0) {
                    console.log('[CLICK DEBUG] Calling setSpawnPointAt');
                    setSpawnPointAt(x, y);
                    return;
                }

                // Check if clicking on a green spawn box (incoming trigger)
                if (e.button === 0) {
                    const incomingTriggers = placedTriggers.filter(t => t.targetMap === currentMapName && t.targetX !== null && t.targetY !== null);
                    for (const trigger of incomingTriggers) {
                        if (x === trigger.targetX && y === trigger.targetY) {
                            // Start dragging this spawn
                            draggingSpawnTrigger = trigger;
                            console.log('[DRAG] Started dragging spawn for Door', trigger.doorNumber);
                            return;
                        }
                    }
                    // Start drag to create trigger area
                    triggerDragStart = { x, y };
                    triggerDragEnd = { x, y };
                    renderMap();
                } else if (e.button === 2) {
                    removeTriggerAt(x, y);
                }
                return;
            }

            // Camera mode - click and drag to set camera bounds
            if (mode === 'camera') {
                if (settingCameraBounds && e.button === 0) {
                    cameraBoundsDragStart = { x, y };
                    cameraBoundsDragEnd = { x, y };
                    renderMap();
                }
                return;
            }

            // Fishing mode - click and drag to add a fish zone
            if (mode === 'fish') {
                if (settingFishZones && e.button === 0) {
                    fishZoneDragStart = { x, y };
                    fishZoneDragEnd = { x, y };
                    renderMap();
                }
                return;
            }

            // Dialog mode - click NPC to attach dialog, or click tile to place sign
            if (mode === 'dialog') {
                if (e.button === 0) {
                    // Check if clicking on an NPC first
                    const npcIdx = findPlacedNpcAt(x, y);
                    if (npcIdx >= 0) {
                        // Attach dialog to this NPC
                        if (currentDialogTileIndex >= 0) {
                            const triggerType = document.getElementById('dialogNpcTrigger')?.value || 'interact';
                            placedNpcs[npcIdx].dialogIndex = currentDialogTileIndex;
                            placedNpcs[npcIdx].dialogTrigger = triggerType;
                            broadcastEdit({ editType: 'attachNpcDialog', npcIndex: npcIdx, dialogIndex: currentDialogTileIndex, dialogTrigger: triggerType });
                            updateDialogNpcDropdown();
                            renderMap();
                        } else {
                            alert('Select a dialog first by clicking it in the list');
                        }
                    } else {
                        // Place dialog tile (sign)
                        placeDialogTileAt(x, y);
                    }
                } else if (e.button === 2) {
                    // Right-click: remove dialog tile or detach from NPC
                    const npcIdx = findPlacedNpcAt(x, y);
                    if (npcIdx >= 0 && placedNpcs[npcIdx].dialogIndex >= 0) {
                        // Detach dialog from NPC
                        placedNpcs[npcIdx].dialogIndex = -1;
                        delete placedNpcs[npcIdx].dialogTrigger;
                        broadcastEdit({ editType: 'attachNpcDialog', npcIndex: npcIdx, dialogIndex: -1 });
                        updateDialogNpcDropdown();
                        renderMap();
                    } else {
                        removeDialogTileAt(x, y);
                    }
                }
                return;
            }

            // Shop mode - click NPC to attach shop
            if (mode === 'shop') {
                if (e.button === 0) {
                    const npcIdx = findPlacedNpcAt(x, y);
                    if (npcIdx >= 0) {
                        if (selectedShopIndex >= 0) {
                            // Attach selected shop to this NPC
                            placedNpcs[npcIdx].shopIndex = selectedShopIndex;
                            broadcastEdit({
                                editType: 'updatePlacedNpc',
                                index: npcIdx,
                                npc: placedNpcs[npcIdx]
                            });
                            updateNpcShopList();
                            renderMap();
                        } else {
                            alert('Select a shop first by clicking it in the list');
                        }
                    }
                } else if (e.button === 2) {
                    // Right-click: remove shop from NPC
                    const npcIdx = findPlacedNpcAt(x, y);
                    if (npcIdx >= 0 && placedNpcs[npcIdx].shopIndex >= 0) {
                        placedNpcs[npcIdx].shopIndex = -1;
                        broadcastEdit({
                            editType: 'updatePlacedNpc',
                            index: npcIdx,
                            npc: placedNpcs[npcIdx]
                        });
                        updateNpcShopList();
                        renderMap();
                    }
                }
                return;
            }

            // NPC mode - place, select, draw path, or edit path
            if (mode === 'npc') {
                // Prop-link targeting takes priority over draw/edit/select
                if (npcWaypointPropTarget >= 0) {
                    if (e.button === 2) { // right-click cancels targeting
                        npcWaypointPropTarget = -1;
                        updateNpcWaypointList();
                    } else if (e.button === 0) {
                        tryLinkWaypointProp(x, y);
                    }
                    return;
                }
                if (npcPathEditing && selectedPlacedNpcIndex >= 0) {
                    // Editing path - drag waypoints
                    const placed = placedNpcs[selectedPlacedNpcIndex];
                    if (placed && placed.path) {
                        if (e.button === 0) {
                            // Find closest waypoint to click
                            const waypointIdx = findNearestWaypoint(x, y, placed.path);
                            if (waypointIdx >= 0) {
                                npcDraggingWaypoint = waypointIdx;
                            }
                        } else if (e.button === 2) {
                            // Right-click to delete waypoint
                            const waypointIdx = findNearestWaypoint(x, y, placed.path);
                            if (waypointIdx >= 0) {
                                placed.path.splice(waypointIdx, 1);
                                updateNpcWaypointList();
                                renderMap();
                                // Wave 3: broadcast waypoint delete (was silently local-only).
                                broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
                            }
                        }
                    }
                } else if (npcPathDrawing && selectedPlacedNpcIndex >= 0) {
                    // Drawing path - add waypoint
                    if (e.button === 0) {
                        addNpcWaypoint(x, y);
                    } else if (e.button === 2) {
                        // Right-click removes last waypoint
                        removeLastNpcWaypoint();
                    }
                } else if (e.button === 0) {
                    // Check if clicking on existing placed NPC
                    const clickedNpcIdx = findPlacedNpcAt(x, y);
                    if (clickedNpcIdx >= 0) {
                        selectPlacedNpc(clickedNpcIdx);
                    } else if (currentNpcIndex >= 0) {
                        // Place new NPC
                        placeNpcAt(x, y);
                    }
                } else if (e.button === 2) {
                    // Right-click to remove placed NPC
                    removeNpcAt(x, y);
                }
                return;
            }

            if (e.button === 0) {
                if (eraseMode) {
                    erasing = true;
                } else {
                    painting = true;
                }
                paintAt(x, y);
            }
            if (e.button === 2) {
                erasing = true;
                paintAt(x, y);
            }
        });

        mapCanvas.addEventListener('mousemove', (e) => {
            const rect = mapCanvas.getBoundingClientRect();
            const tileSize = gridSize * zoom;
            const x = Math.floor((e.clientX - rect.left) / tileSize);
            const y = Math.floor((e.clientY - rect.top) / tileSize);

            if (copyMode && copyStart) {
                // Update copy selection
                copyEnd = { x, y };
                renderMap();
                return;
            }

            // Handle spawn point dragging (green boxes)
            if (draggingSpawnTrigger && mode === 'trigger') {
                draggingSpawnTrigger.targetX = x;
                draggingSpawnTrigger.targetY = y;
                renderMap();
                return;
            }

            // Handle trigger area dragging (creating multi-tile triggers)
            if (triggerDragStart && mode === 'trigger') {
                triggerDragEnd = { x, y };
                renderMap();
                return;
            }

            // Handle camera bounds dragging
            if (cameraBoundsDragStart && settingCameraBounds) {
                cameraBoundsDragEnd = { x, y };
                renderMap();
                return;
            }

            // Handle fish zone dragging
            if (fishZoneDragStart && settingFishZones) {
                fishZoneDragEnd = { x, y };
                renderMap();
                return;
            }

            // Handle waypoint dragging
            if (npcDraggingWaypoint >= 0 && selectedPlacedNpcIndex >= 0) {
                const placed = placedNpcs[selectedPlacedNpcIndex];
                if (placed && placed.path && placed.path[npcDraggingWaypoint]) {
                    placed.path[npcDraggingWaypoint].x = x;
                    placed.path[npcDraggingWaypoint].y = y;
                    updateNpcWaypointList();
                    renderMap();
                }
                return;
            }

            // Update hover position for preview
            if (hoverMapPos?.x !== x || hoverMapPos?.y !== y) {
                hoverMapPos = { x, y };
                renderMap();
            }

            if (painting || erasing) {
                paintAt(x, y);
            }
        });

        mapCanvas.addEventListener('mouseleave', () => {
            hoverMapPos = null;
            renderMap();
        });

        window.addEventListener('mouseup', (e) => {
            // Stop dragging spawn points
            if (draggingSpawnTrigger) {
                console.log('[DRAG] Stopped dragging spawn for Door', draggingSpawnTrigger.doorNumber,
                    'new position:', draggingSpawnTrigger.targetX, draggingSpawnTrigger.targetY);
                // Sync the trigger update
                const triggerIndex = placedTriggers.indexOf(draggingSpawnTrigger);
                if (triggerIndex >= 0) {
                    broadcastEdit({ editType: 'updateTrigger', index: triggerIndex, uid: draggingSpawnTrigger.uid, trigger: draggingSpawnTrigger });
                }
                draggingSpawnTrigger = null;
                renderMap();
            }

            // Finish trigger area drag - create multi-tile trigger
            if (triggerDragStart && triggerDragEnd) {
                const x1 = Math.min(triggerDragStart.x, triggerDragEnd.x);
                const y1 = Math.min(triggerDragStart.y, triggerDragEnd.y);
                const x2 = Math.max(triggerDragStart.x, triggerDragEnd.x);
                const y2 = Math.max(triggerDragStart.y, triggerDragEnd.y);
                const width = x2 - x1 + 1;
                const height = y2 - y1 + 1;

                // Store dimensions and show modal
                pendingTriggerWidth = width;
                pendingTriggerHeight = height;
                placeTriggerAt(x1, y1);

                triggerDragStart = null;
                triggerDragEnd = null;
                renderMap();
            }

            // Finish camera bounds drag
            if (cameraBoundsDragStart && cameraBoundsDragEnd && settingCameraBounds) {
                setCameraBoundsFromDrag();
            }

            // Finish fish zone drag
            if (fishZoneDragStart && fishZoneDragEnd && settingFishZones) {
                setFishZoneFromDrag();
            }

            if (copyMode && copyStart && copyEnd) {
                // Finish copy selection
                finishCopyFromMap();
            }
            // End painting/erasing stroke
            painting = false;
            erasing = false;
            // Stop waypoint dragging and broadcast if we were dragging
            if (npcDraggingWaypoint >= 0 && selectedPlacedNpcIndex >= 0) {
                const placed = placedNpcs[selectedPlacedNpcIndex];
                if (placed) {
                    broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
                }
            }
            npcDraggingWaypoint = -1;
        });
        mapCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Touch support for mobile
        mapCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = mapCanvas.getBoundingClientRect();
            const tileSize = gridSize * zoom;
            const x = Math.floor((touch.clientX - rect.left) / tileSize);
            const y = Math.floor((touch.clientY - rect.top) / tileSize);

            // Set spawn mode - touch to place player spawn
            if (setSpawnMode) {
                playerPreviewPos.x = x;
                playerPreviewPos.y = y;
                spawnMapName = currentMapName; // Record which map spawn is on
                playerPreviewVisible = true;
                toggleSetSpawnMode();
                renderMap();
                // Wave 3: broadcast spawn point (was silently local-only).
                broadcastEdit({ editType: 'setPlayerSpawn', x, y, mapName: spawnMapName });
                return;
            }

            // Copy mode - touch to start selection
            if (copyMode) {
                copyStart = { x, y };
                copyEnd = { x, y };
                renderMap();
                return;
            }

            // Static object mode - click to place
            if (mode === 'animProp' && currentStaticObjIndex >= 0 && staticObjects[currentStaticObjIndex]) {
                placeStaticObjectAt(x, y);
                return;
            }

            // Animated prop mode
            if (mode === 'animProp' && currentAnimPropIndex >= 0) {
                placeAnimPropAt(x, y);
                return;
            }

            // Sound mode
            if (mode === 'sound' && soundAttachMode === 'tile') {
                const key = `${currentMapName}:${x},${y}`;
                if (tileSounds[key]) {
                    selectTileSound(key);
                } else if (!selectedTileSoundKey) {
                    placeTileSound(x, y);
                }
                renderMap();
                return;
            }

            // Default: paint tiles
            if (eraseMode) {
                erasing = true;
            } else {
                painting = true;
            }
            hoverMapPos = { x, y };
            paintAt(x, y);
            renderMap();
        }, { passive: false });

        mapCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = mapCanvas.getBoundingClientRect();
            const tileSize = gridSize * zoom;
            const x = Math.floor((touch.clientX - rect.left) / tileSize);
            const y = Math.floor((touch.clientY - rect.top) / tileSize);

            // Copy mode - update selection
            if (copyMode && copyStart) {
                copyEnd = { x, y };
                renderMap();
                return;
            }

            if (hoverMapPos?.x !== x || hoverMapPos?.y !== y) {
                hoverMapPos = { x, y };
                renderMap();
            }

            if (painting || erasing) {
                paintAt(x, y);
            }
        }, { passive: false });

        mapCanvas.addEventListener('touchend', (e) => {
            // Copy mode - finish selection
            if (copyMode && copyStart && copyEnd) {
                finishCopyFromMap();
                return;
            }

            painting = false;
            erasing = false;
            hoverMapPos = null;
            renderMap();
        });

        // Animated prop placement helpers - stores directly in layer like tiles
        // Supports multi-tile props based on frame size
        // Properly rotates the entire object shape, not just individual tiles
        function placeAnimPropAt(x, y) {
            if (x < 0 || y < 0 || x >= mapCols || y >= mapRows) return;
            if (!layers[currentLayer]) return;
            if (currentAnimPropIndex < 0 || !animatedProps[currentAnimPropIndex]) return;

            const prop = animatedProps[currentAnimPropIndex];
            const frames = prop.frames || [];
            if (frames.length === 0) return;

            // Calculate how many tiles this prop spans based on first frame size
            const frame = frames[0];
            const origW = Math.ceil(frame.w / gridSize);
            const origH = Math.ceil(frame.h / gridSize);

            // Determine placed dimensions based on rotation (90/270 swap W and H)
            const rot = tileRotation;
            const placedW = (rot === 90 || rot === 270) ? origH : origW;
            const placedH = (rot === 90 || rot === 270) ? origW : origH;

            // Place tiles with proper rotation mapping
            for (let ty = 0; ty < origH; ty++) {
                for (let tx = 0; tx < origW; tx++) {
                    // Calculate rotated position on map
                    let placedTx, placedTy;
                    if (rot === 0) {
                        placedTx = tx;
                        placedTy = ty;
                    } else if (rot === 90) {
                        // 90° CW: (tx, ty) -> (origH - 1 - ty, tx)
                        placedTx = origH - 1 - ty;
                        placedTy = tx;
                    } else if (rot === 180) {
                        // 180°: (tx, ty) -> (origW - 1 - tx, origH - 1 - ty)
                        placedTx = origW - 1 - tx;
                        placedTy = origH - 1 - ty;
                    } else { // 270
                        // 270° CW: (tx, ty) -> (ty, origW - 1 - tx)
                        placedTx = ty;
                        placedTy = origW - 1 - tx;
                    }

                    const px = x + placedTx;
                    const py = y + placedTy;
                    if (px < 0 || py < 0 || px >= mapCols || py >= mapRows) continue;

                    if (!layers[currentLayer][py]) layers[currentLayer][py] = [];

                    // Store original source offset (for sprite lookup), rotation, and scale
                    layers[currentLayer][py][px] = {
                        type: 'animTile',
                        propIndex: currentAnimPropIndex,
                        offsetX: tx,  // Original source tile X (for sprite lookup)
                        offsetY: ty,  // Original source tile Y (for sprite lookup)
                        tilesW: origW,  // Original prop size
                        tilesH: origH,
                        placedW: placedW,  // Placed size (after rotation)
                        placedH: placedH,
                        rotation: rot,
                        scale: currentAnimPropScale  // Scale factor
                    };
                    // Broadcast to co-op builders
                    broadcastEdit({ editType: 'tile', layer: currentLayer, x: px, y: py, cell: layers[currentLayer][py][px], mapName: currentMapName });
                }
            }
            renderMap();
        }

        function removeAnimPropAt(x, y) {
            if (x < 0 || y < 0 || x >= mapCols || y >= mapRows) return;
            if (!layers[currentLayer] || !layers[currentLayer][y]) return;

            const cell = layers[currentLayer][y][x];
            if (cell && cell.type === 'animTile') {
                // Remove all tiles of this multi-tile prop
                const rot = cell.rotation || 0;
                const origW = cell.tilesW || 1;
                const origH = cell.tilesH || 1;
                const offsetX = cell.offsetX || 0;
                const offsetY = cell.offsetY || 0;

                // Calculate placed offset based on rotation (reverse of placement)
                let placedOffX, placedOffY;
                if (rot === 0) {
                    placedOffX = offsetX;
                    placedOffY = offsetY;
                } else if (rot === 90) {
                    placedOffX = origH - 1 - offsetY;
                    placedOffY = offsetX;
                } else if (rot === 180) {
                    placedOffX = origW - 1 - offsetX;
                    placedOffY = origH - 1 - offsetY;
                } else { // 270
                    placedOffX = offsetY;
                    placedOffY = origW - 1 - offsetX;
                }

                // Find origin (top-left of placed object)
                const originX = x - placedOffX;
                const originY = y - placedOffY;

                // Get placed dimensions
                const placedW = (rot === 90 || rot === 270) ? origH : origW;
                const placedH = (rot === 90 || rot === 270) ? origW : origH;

                // Remove all tiles in the placed rectangle
                for (let py = 0; py < placedH; py++) {
                    for (let px = 0; px < placedW; px++) {
                        const mapX = originX + px;
                        const mapY = originY + py;
                        if (mapX < 0 || mapY < 0 || mapX >= mapCols || mapY >= mapRows) continue;
                        if (layers[currentLayer][mapY]) {
                            layers[currentLayer][mapY][mapX] = null;
                            // Broadcast to co-op builders
                            broadcastEdit({ editType: 'eraseTile', layer: currentLayer, x: mapX, y: mapY, mapName: currentMapName });
                        }
                    }
                }
            }
            renderMap();
        }

        // Copy from map functions
        function startCopyFromMap() {
            copyMode = true;
            copyStart = null;
            copyEnd = null;
            copiedTiles = null;
            document.getElementById('copyFromMapBtn').classList.add('active');
            document.getElementById('copyFromMapBtn').textContent = 'Selecting...';
            document.getElementById('copyModeInfo').style.display = 'inline';
            mapCanvas.style.cursor = 'copy';
        }

        function finishCopyFromMap() {
            if (!copyStart || !copyEnd) {
                cancelCopyMode();
                return;
            }

            const minX = Math.min(copyStart.x, copyEnd.x);
            const maxX = Math.max(copyStart.x, copyEnd.x);
            const minY = Math.min(copyStart.y, copyEnd.y);
            const maxY = Math.max(copyStart.y, copyEnd.y);

            const width = maxX - minX + 1;
            const height = maxY - minY + 1;

            // Check if copying all layers
            copiedAllLayers = document.getElementById('copyAllLayers').checked;

            if (copiedAllLayers) {
                // Copy tiles from ALL layers - 3D array [layer][y][x]
                copiedTiles = [];
                for (let li = 0; li < layers.length; li++) {
                    copiedTiles[li] = [];
                    for (let dy = 0; dy < height; dy++) {
                        copiedTiles[li][dy] = [];
                        for (let dx = 0; dx < width; dx++) {
                            const mx = minX + dx;
                            const my = minY + dy;
                            if (my >= 0 && my < mapRows && mx >= 0 && mx < mapCols && layers[li] && layers[li][my]) {
                                copiedTiles[li][dy][dx] = layers[li][my][mx] ? { ...layers[li][my][mx] } : null;
                            } else {
                                copiedTiles[li][dy][dx] = null;
                            }
                        }
                    }
                }
            } else {
                // Copy tiles from current layer only - 2D array [y][x]
                copiedTiles = [];
                for (let dy = 0; dy < height; dy++) {
                    copiedTiles[dy] = [];
                    for (let dx = 0; dx < width; dx++) {
                        const mx = minX + dx;
                        const my = minY + dy;
                        if (my >= 0 && my < mapRows && mx >= 0 && mx < mapCols) {
                            copiedTiles[dy][dx] = map[my][mx] ? { ...map[my][mx] } : null;
                        } else {
                            copiedTiles[dy][dx] = null;
                        }
                    }
                }
            }

            // Set as selected tile data for painting
            selectedTileData = {
                isCopied: true,
                width: width,
                height: height
            };

            // Reset flip when copying from map (copied tiles have their own transforms)
            tileFlippedH = false;
            updateFlipButton();

            // Update preview
            updateCopiedPreview();

            // Exit copy mode
            copyMode = false;
            copyStart = null;
            copyEnd = null;
            document.getElementById('copyFromMapBtn').classList.remove('active');
            document.getElementById('copyFromMapBtn').textContent = 'Copy from Map';
            document.getElementById('copyModeInfo').style.display = 'none';
            mapCanvas.style.cursor = 'crosshair';
            renderMap();
        }

        function cancelCopyMode() {
            copyMode = false;
            copyStart = null;
            copyEnd = null;
            document.getElementById('copyFromMapBtn').classList.remove('active');
            document.getElementById('copyFromMapBtn').textContent = 'Copy from Map';
            document.getElementById('copyModeInfo').style.display = 'none';
            mapCanvas.style.cursor = 'crosshair';
            renderMap();
        }

        function updateCopiedPreview() {
            if (!copiedTiles || copiedTiles.length === 0) return;

            const previewCanvas = document.getElementById('selectedTile');
            if (!previewCanvas) return;
            const previewCtx = previewCanvas.getContext('2d');
            const previewSize = 48;

            // Calculate dimensions based on whether all layers were copied
            let width, height;
            if (copiedAllLayers) {
                // 3D array [layer][y][x]
                height = copiedTiles[0]?.length || 0;
                width = copiedTiles[0]?.[0]?.length || 0;
            } else {
                // 2D array [y][x]
                height = copiedTiles.length;
                width = copiedTiles[0]?.length || 0;
            }

            if (width === 0 || height === 0) return;

            const tilePreviewSize = Math.min(previewSize / width, previewSize / height, 16);

            previewCanvas.width = previewSize;
            previewCanvas.height = previewSize;

            previewCtx.fillStyle = '#333';
            previewCtx.fillRect(0, 0, previewSize, previewSize);
            previewCtx.imageSmoothingEnabled = false;

            if (copiedAllLayers) {
                // Draw all layers composite
                for (let li = 0; li < copiedTiles.length; li++) {
                    for (let dy = 0; dy < height; dy++) {
                        for (let dx = 0; dx < width; dx++) {
                            const cell = copiedTiles[li] && copiedTiles[li][dy] && copiedTiles[li][dy][dx];
                            if (cell) {
                                const px = dx * tilePreviewSize;
                                const py = dy * tilePreviewSize;

                                if (cell.type === 'tile') {
                                    const cellTileset = tilesets[cell.tilesetIndex || 0]?.img || tilesetImg;
                                    if (cellTileset) {
                                        previewCtx.drawImage(cellTileset, cell.x, cell.y, gridSize, gridSize, px, py, tilePreviewSize, tilePreviewSize);
                                    }
                                } else if (cell.type === 'prop' && propImage) {
                                    previewCtx.drawImage(propImage, cell.x, cell.y, gridSize, gridSize, px, py, tilePreviewSize, tilePreviewSize);
                                }
                            }
                        }
                    }
                }
            } else {
                // Single layer preview
                for (let dy = 0; dy < height; dy++) {
                    for (let dx = 0; dx < width; dx++) {
                        const cell = copiedTiles[dy] && copiedTiles[dy][dx];
                        if (cell) {
                            const px = dx * tilePreviewSize;
                            const py = dy * tilePreviewSize;

                            if (cell.type === 'tile') {
                                const cellTileset = tilesets[cell.tilesetIndex || 0]?.img || tilesetImg;
                                if (cellTileset) {
                                    previewCtx.drawImage(cellTileset, cell.x, cell.y, gridSize, gridSize, px, py, tilePreviewSize, tilePreviewSize);
                                }
                            } else if (cell.type === 'prop' && propImage) {
                                previewCtx.drawImage(propImage, cell.x, cell.y, gridSize, gridSize, px, py, tilePreviewSize, tilePreviewSize);
                            }
                        }
                    }
                }
            }

            const layerInfo = copiedAllLayers ? ' (all layers)' : '';
            document.getElementById('selectedInfo').textContent = width + 'x' + height + layerInfo;
            document.getElementById('selectedInfo').style.color = copiedAllLayers ? '#5f8' : '#fff';
            document.getElementById('selectedCollisionInfo').textContent = 'From map';
        }

        function paintAt(x, y) {
            // During door animation painting, only allow painting on selected tiles (matching layer)
            if (paintingAnimTiles) {
                const isSelectedTile = selectedAnimTiles.some(t => t.x === x && t.y === y && t.layer === currentLayer);
                if (!isSelectedTile) {
                    return; // Block painting outside selected area
                }
            }

            if (!selectedTileData) {
                if (erasing && x >= 0 && x < mapCols && y >= 0 && y < mapRows) {
                    map[y][x] = null;
                    // Broadcast erase to co-op builders
                    broadcastEdit({ editType: 'eraseTile', layer: currentLayer, x: x, y: y, mapName: currentMapName });
                    renderMap();
                }
                return;
            }

            const selW = selectedTileData.width || 1;
            const selH = selectedTileData.height || 1;

            if (erasing) {
                // Erase area matching selection size
                for (let dy = 0; dy < selH; dy++) {
                    for (let dx = 0; dx < selW; dx++) {
                        const mx = x + dx;
                        const my = y + dy;
                        if (mx >= 0 && mx < mapCols && my >= 0 && my < mapRows) {
                            map[my][mx] = null;
                            // Broadcast erase to co-op builders
                            broadcastEdit({ editType: 'eraseTile', layer: currentLayer, x: mx, y: my, mapName: currentMapName });
                        }
                    }
                }
            } else if (painting) {
                // Check for flip+rotation combo (Pratt warning)
                if (!selectedTileData.isCopied && !selectedTileData.isProp && tileRotation !== 0 && tileFlippedH) {
                    if (!showPrattWarning()) {
                        return; // User cancelled
                    }
                }
                // Check if painting with copied tiles
                if (selectedTileData.isCopied && copiedTiles) {
                    if (copiedAllLayers) {
                        // Paint copied tiles to ALL layers
                        for (let li = 0; li < copiedTiles.length && li < layers.length; li++) {
                            for (let dy = 0; dy < selH; dy++) {
                                for (let dx = 0; dx < selW; dx++) {
                                    const mx = x + dx;
                                    const my = y + dy;

                                    // Auto-expand map if painting at or beyond edge
                                    if (my >= mapRows - 2) expandMapRows();
                                    if (mx >= mapCols - 2) expandMapCols();

                                    if (mx >= 0 && my >= 0 && mx < mapCols && my < mapRows) {
                                        const srcCell = copiedTiles[li] && copiedTiles[li][dy] && copiedTiles[li][dy][dx];
                                        if (srcCell) {
                                            if (!layers[li][my]) layers[li][my] = [];
                                            layers[li][my][mx] = { ...srcCell };
                                            // Broadcast tile to co-op builders
                                            broadcastEdit({ editType: 'tile', layer: li, x: mx, y: my, cell: layers[li][my][mx], mapName: currentMapName });
                                        }
                                    }
                                }
                            }
                        }
                        // Clear after pasting all layers (one-time paste)
                        copiedTiles = null;
                        copiedAllLayers = false;
                        selectedTileData = null;
                    } else {
                        // Paint copied tiles to current layer only (can paste multiple times)
                        for (let dy = 0; dy < selH; dy++) {
                            for (let dx = 0; dx < selW; dx++) {
                                const mx = x + dx;
                                const my = y + dy;

                                // Auto-expand map if painting at or beyond edge
                                if (my >= mapRows - 2) expandMapRows();
                                if (mx >= mapCols - 2) expandMapCols();

                                if (mx >= 0 && my >= 0 && mx < mapCols && my < mapRows) {
                                    const srcCell = copiedTiles[dy] && copiedTiles[dy][dx];
                                    if (srcCell) {
                                        map[my][mx] = { ...srcCell };
                                        // Broadcast tile to co-op builders
                                        broadcastEdit({ editType: 'tile', layer: currentLayer, x: mx, y: my, cell: map[my][mx], mapName: currentMapName });
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // Paint from tileset selection
                    for (let dy = 0; dy < selH; dy++) {
                        for (let dx = 0; dx < selW; dx++) {
                            const mx = x + dx;
                            const my = y + dy;

                            // Auto-expand map if painting at or beyond edge
                            if (my >= mapRows - 2) expandMapRows();
                            if (mx >= mapCols - 2) expandMapCols();

                            if (mx >= 0 && my >= 0 && mx < mapCols && my < mapRows) {
                                // When flipped, mirror the source tile positions horizontally
                                const srcDx = tileFlippedH ? (selW - 1 - dx) : dx;
                                const tileX = selectedTileData.x + srcDx * gridSize;
                                const tileY = selectedTileData.y + dy * gridSize;

                                if (selectedTileData.isProp) {
                                    // Paint as prop with propIndex (collision is painted separately in prop panel)
                                    map[my][mx] = { type: 'prop', x: tileX, y: tileY, propIndex: currentPropIndex };
                                } else {
                                    // Paint as tile with rotation and flip
                                    map[my][mx] = { type: 'tile', x: tileX, y: tileY, rotation: tileRotation, flipped: tileFlippedH, tilesetIndex: currentTilesetIndex };
                                }
                                // Broadcast tile to co-op builders
                                broadcastEdit({ editType: 'tile', layer: currentLayer, x: mx, y: my, cell: map[my][mx], mapName: currentMapName });
                            }
                        }
                    }
                }
            }
            renderMap();
        }

        function renderMap() {
            const tileSize = gridSize * zoom;
            mapCanvas.width = mapCols * tileSize;
            mapCanvas.height = mapRows * tileSize;

            // Background
            mapCtx.fillStyle = '#1a1a1a';
            mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
            for (let y = 0; y < mapRows; y++) {
                for (let x = 0; x < mapCols; x++) {
                    if ((x + y) % 2 === 0) {
                        mapCtx.fillStyle = '#222';
                        mapCtx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                    }
                }
            }

            // Grid
            mapCtx.strokeStyle = 'rgba(255,255,255,0.1)';
            for (let x = 0; x <= mapCols; x++) {
                mapCtx.beginPath();
                mapCtx.moveTo(x * tileSize, 0);
                mapCtx.lineTo(x * tileSize, mapCanvas.height);
                mapCtx.stroke();
            }
            for (let y = 0; y <= mapRows; y++) {
                mapCtx.beginPath();
                mapCtx.moveTo(0, y * tileSize);
                mapCtx.lineTo(mapCanvas.width, y * tileSize);
                mapCtx.stroke();
            }

            // Draw all visible layers (bottom to top)
            if (tilesetImg) {
                mapCtx.imageSmoothingEnabled = false;

                for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
                    // Draw player preview at the right layer position (only on spawn map)
                    if (layerIdx === playerLayerIndex && playerPreviewVisible && currentMapName === spawnMapName) {
                        drawPlayerPreview(tileSize);
                    }

                    if (!layerVisibility[layerIdx]) continue;

                    const layerData = layers[layerIdx];
                    // Dim non-current layers slightly
                    mapCtx.globalAlpha = (layerIdx === currentLayer) ? 1 : 0.7;

                    for (let y = 0; y < mapRows; y++) {
                        for (let x = 0; x < mapCols; x++) {
                            const cell = layerData[y] && layerData[y][x];
                            if (!cell) continue;

                            const px = x * tileSize;
                            const py = y * tileSize;

                            if (cell.type === 'tile') {
                                // Use the correct tileset for this tile
                                const cellTileset = tilesets[cell.tilesetIndex || 0]?.img || tilesetImg;
                                drawRotatedTile(mapCtx, cellTileset, cell.x, cell.y, gridSize, px, py, tileSize, cell.rotation || 0, cell.flipped || false);

                                // Show collision only on current layer
                                if (layerIdx === currentLayer) {
                                    // Include tileset index in collision key lookup
                                    const tilesetIdx = cell.tilesetIndex || 0;
                                    const key = tilesetIdx + ':' + cell.x + ',' + cell.y;
                                    const collision = tileCollisions[key];
                                    if (collision && collision.length >= 3) {
                                        const scale = tileSize / gridSize;
                                        mapCtx.fillStyle = 'rgba(255, 0, 0, 0.2)';
                                        mapCtx.beginPath();
                                        mapCtx.moveTo(px + collision[0].x * scale, py + collision[0].y * scale);
                                        for (let i = 1; i < collision.length; i++) {
                                            mapCtx.lineTo(px + collision[i].x * scale, py + collision[i].y * scale);
                                        }
                                        mapCtx.closePath();
                                        mapCtx.fill();
                                    }
                                }
                            } else if (cell.type === 'prop') {
                                // Draw prop from the correct prop image
                                const propIdx = cell.propIndex || 0;
                                const propImg = props[propIdx]?.img;
                                if (propImg) {
                                    mapCtx.drawImage(propImg, cell.x, cell.y, gridSize, gridSize, px, py, tileSize, tileSize);
                                }
                            } else if (cell.type === 'animTile') {
                                // Animated tile - cycles through frames (supports multi-tile)
                                const prop = animatedProps[cell.propIndex];
                                if (prop && prop._spriteImg && prop.frames && prop.frames.length > 0) {
                                    // Use origin tile's position for animation sync
                                    const originX = x - (cell.offsetX || 0);
                                    const originY = y - (cell.offsetY || 0);
                                    const key = originX + ',' + originY + ',' + layerIdx;
                                    const animState = placedAnimPropFrames[key] || { frame: 0 };
                                    const frameIdx = animState.frame % prop.frames.length;
                                    const frame = prop.frames[frameIdx];

                                    // Draw only this tile's portion of the frame
                                    const offsetX = cell.offsetX || 0;
                                    const offsetY = cell.offsetY || 0;
                                    const srcX = frame.x + offsetX * gridSize;
                                    const srcY = frame.y + offsetY * gridSize;

                                    // Apply scale factor - scale from prop's origin, not each tile's center
                                    const propScale = cell.scale || 1;
                                    const scaledTileSize = tileSize * propScale;

                                    // Calculate prop's total size to find proper scale origin
                                    const tilesW = cell.tilesW || 1;
                                    const tilesH = cell.tilesH || 1;
                                    const propWidth = tilesW * tileSize;
                                    const propHeight = tilesH * tileSize;
                                    const scaledPropWidth = propWidth * propScale;
                                    const scaledPropHeight = propHeight * propScale;

                                    // Scale offset from prop's center
                                    const propCenterOffsetX = (scaledPropWidth - propWidth) / 2;
                                    const propCenterOffsetY = (scaledPropHeight - propHeight) / 2;

                                    // This tile's position relative to origin
                                    const tileOffsetX = offsetX * tileSize;
                                    const tileOffsetY = offsetY * tileSize;

                                    // Scale tile offset from prop origin
                                    const scaledTileOffsetX = tileOffsetX * propScale;
                                    const scaledTileOffsetY = tileOffsetY * propScale;

                                    // Origin tile's screen position
                                    const originPx = originX * tileSize;
                                    const originPy = originY * tileSize;

                                    // Draw position: origin - center offset + scaled tile offset
                                    const drawX = originPx - propCenterOffsetX + scaledTileOffsetX;
                                    const drawY = originPy - propCenterOffsetY + scaledTileOffsetY;

                                    mapCtx.imageSmoothingEnabled = false;
                                    // Per-instance pixel nudge (fine-position off the grid)
                                    const _nx = (cell.nudgeX || 0) * (tileSize / gridSize);
                                    const _ny = (cell.nudgeY || 0) * (tileSize / gridSize);
                                    const _nudged = _nx || _ny;
                                    if (_nudged) { mapCtx.save(); mapCtx.translate(_nx, _ny); }
                                    // Per-instance horizontal mirror (reflect whole prop about its screen-center)
                                    const mirror = cell.mirror;
                                    if (mirror) {
                                        mapCtx.save();
                                        const centerScreenX = originPx - propCenterOffsetX + scaledPropWidth / 2;
                                        mapCtx.translate(centerScreenX, 0);
                                        mapCtx.scale(-1, 1);
                                        mapCtx.translate(-centerScreenX, 0);
                                    }
                                    // Draw with rotation support
                                    const rot = cell.rotation || 0;
                                    if (rot === 0) {
                                        mapCtx.drawImage(prop._spriteImg, srcX, srcY, gridSize, gridSize, drawX, drawY, scaledTileSize, scaledTileSize);
                                    } else {
                                        mapCtx.save();
                                        const propCenterX = originPx + propWidth / 2;
                                        const propCenterY = originPy + propHeight / 2;
                                        mapCtx.translate(propCenterX, propCenterY);
                                        mapCtx.rotate(rot * Math.PI / 180);
                                        const rotDrawX = -scaledPropWidth / 2 + scaledTileOffsetX;
                                        const rotDrawY = -scaledPropHeight / 2 + scaledTileOffsetY;
                                        mapCtx.drawImage(prop._spriteImg, srcX, srcY, gridSize, gridSize, rotDrawX, rotDrawY, scaledTileSize, scaledTileSize);
                                        mapCtx.restore();
                                    }
                                    if (mirror) mapCtx.restore();
                                    if (_nudged) mapCtx.restore();

                                    // Show label in animProp mode (only on origin tile)
                                    if (mode === 'animProp' && offsetX === 0 && offsetY === 0) {
                                        mapCtx.fillStyle = 'rgba(0,0,0,0.7)';
                                        mapCtx.font = '10px sans-serif';
                                        mapCtx.textAlign = 'center';
                                        const nameWidth = mapCtx.measureText(prop.name).width + 4;
                                        mapCtx.fillRect(px + tileSize / 2 - nameWidth / 2, py - 14, nameWidth, 14);
                                        mapCtx.fillStyle = '#fff';
                                        mapCtx.fillText(prop.name, px + tileSize / 2, py - 3);
                                    }
                                }
                            }
                        }
                    }
                }

                // Draw player preview at end if it's beyond all layers (only on spawn map)
                if (playerLayerIndex >= layers.length && playerPreviewVisible && currentMapName === spawnMapName) {
                    drawPlayerPreview(tileSize);
                }

                mapCtx.globalAlpha = 1;
            }

            // Draw copy selection rectangle if in copy mode
            if (copyMode && copyStart && copyEnd) {
                const minX = Math.min(copyStart.x, copyEnd.x);
                const maxX = Math.max(copyStart.x, copyEnd.x);
                const minY = Math.min(copyStart.y, copyEnd.y);
                const maxY = Math.max(copyStart.y, copyEnd.y);

                mapCtx.fillStyle = 'rgba(74, 175, 255, 0.3)';
                mapCtx.fillRect(minX * tileSize, minY * tileSize, (maxX - minX + 1) * tileSize, (maxY - minY + 1) * tileSize);

                mapCtx.strokeStyle = '#4af';
                mapCtx.lineWidth = 3;
                mapCtx.setLineDash([5, 5]);
                mapCtx.strokeRect(minX * tileSize, minY * tileSize, (maxX - minX + 1) * tileSize, (maxY - minY + 1) * tileSize);
                mapCtx.setLineDash([]);
            }

            // Draw transparent preview of selected tiles at hover position
            // Skip when in animProp mode (animProp has its own preview)
            if (hoverMapPos && selectedTileData && !copyMode && mode !== 'animProp') {
                mapCtx.globalAlpha = 0.5;
                const selW = selectedTileData.width || 1;
                const selH = selectedTileData.height || 1;

                // Check if using copied tiles
                if (selectedTileData.isCopied && copiedTiles) {
                    // Draw preview of copied tiles
                    if (copiedAllLayers) {
                        // Draw all layers preview (composite)
                        for (let li = 0; li < copiedTiles.length; li++) {
                            for (let dy = 0; dy < selH; dy++) {
                                for (let dx = 0; dx < selW; dx++) {
                                    const mx = hoverMapPos.x + dx;
                                    const my = hoverMapPos.y + dy;
                                    if (mx >= 0 && mx < mapCols && my >= 0 && my < mapRows) {
                                        const srcCell = copiedTiles[li] && copiedTiles[li][dy] && copiedTiles[li][dy][dx];
                                        if (srcCell) {
                                            const px = mx * tileSize;
                                            const py = my * tileSize;
                                            if (srcCell.type === 'tile') {
                                                const cellTileset = tilesets[srcCell.tilesetIndex || 0]?.img || tilesetImg;
                                                if (cellTileset) {
                                                    drawRotatedTile(mapCtx, cellTileset, srcCell.x, srcCell.y, gridSize, px, py, tileSize, srcCell.rotation || 0, srcCell.inverted || false);
                                                }
                                            } else if (srcCell.type === 'prop') {
                                                const propIdx = srcCell.propIndex || 0;
                                                const propImg = props[propIdx]?.img;
                                                if (propImg) {
                                                    mapCtx.drawImage(propImg, srcCell.x, srcCell.y, gridSize, gridSize, px, py, tileSize, tileSize);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        // Single layer preview
                        for (let dy = 0; dy < selH; dy++) {
                            for (let dx = 0; dx < selW; dx++) {
                                const mx = hoverMapPos.x + dx;
                                const my = hoverMapPos.y + dy;
                                if (mx >= 0 && mx < mapCols && my >= 0 && my < mapRows) {
                                    const srcCell = copiedTiles[dy] && copiedTiles[dy][dx];
                                    if (srcCell) {
                                        const px = mx * tileSize;
                                        const py = my * tileSize;
                                        if (srcCell.type === 'tile') {
                                            const cellTileset = tilesets[srcCell.tilesetIndex || 0]?.img || tilesetImg;
                                            if (cellTileset) {
                                                drawRotatedTile(mapCtx, cellTileset, srcCell.x, srcCell.y, gridSize, px, py, tileSize, srcCell.rotation || 0, srcCell.inverted || false);
                                            }
                                        } else if (srcCell.type === 'prop') {
                                            const propIdx = srcCell.propIndex || 0;
                                            const propImg = props[propIdx]?.img;
                                            if (propImg) {
                                                mapCtx.drawImage(propImg, srcCell.x, srcCell.y, gridSize, gridSize, px, py, tileSize, tileSize);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // Draw preview from tileset/prop selection
                    const sourceImg = selectedTileData.isProp ? propImage : tilesetImg;

                    if (sourceImg) {
                        for (let dy = 0; dy < selH; dy++) {
                            for (let dx = 0; dx < selW; dx++) {
                                const mx = hoverMapPos.x + dx;
                                const my = hoverMapPos.y + dy;
                                if (mx >= 0 && mx < mapCols && my >= 0 && my < mapRows) {
                                    // Mirror source tile position when flipped
                                    const srcDx = tileFlippedH ? (selW - 1 - dx) : dx;
                                    const tileX = selectedTileData.x + srcDx * gridSize;
                                    const tileY = selectedTileData.y + dy * gridSize;
                                    const px = mx * tileSize;
                                    const py = my * tileSize;
                                    if (selectedTileData.isProp) {
                                        mapCtx.drawImage(sourceImg, tileX, tileY, gridSize, gridSize, px, py, tileSize, tileSize);
                                    } else {
                                        drawRotatedTile(mapCtx, sourceImg, tileX, tileY, gridSize, px, py, tileSize, tileRotation, tileFlippedH);
                                    }
                                }
                            }
                        }
                    }
                }

                // Draw outline
                mapCtx.globalAlpha = 1;
                mapCtx.strokeStyle = selectedTileData.isCopied ? '#ff0' : (selectedTileData.isProp ? '#4af' : '#0f0');
                mapCtx.lineWidth = 2;
                mapCtx.strokeRect(
                    hoverMapPos.x * tileSize,
                    hoverMapPos.y * tileSize,
                    selW * tileSize,
                    selH * tileSize
                );
            }

            // Draw static object placement preview when hovering
            if (mode === 'animProp' && hoverMapPos && currentStaticObjIndex >= 0 && !copyMode) {
                const obj = staticObjects[currentStaticObjIndex];
                if (obj && obj._spriteImg && obj._spriteImg.complete) {
                    const scale = staticObjPlacementScale;
                    const srcW = obj.width * gridSize;
                    const srcH = obj.height * gridSize;
                    // Use tileSize for canvas display
                    const drawW = obj.width * tileSize * scale;
                    const drawH = obj.height * tileSize * scale;
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

            // Draw animated prop placement preview when hovering in animProp mode
            if (mode === 'animProp' && hoverMapPos && currentAnimPropIndex >= 0 && !copyMode) {
                const prop = animatedProps[currentAnimPropIndex];
                if (prop) {
                    const frames = prop.frames || [];
                    const spriteImg = prop._spriteImg;
                    const drawX = hoverMapPos.x * tileSize;
                    const drawY = hoverMapPos.y * tileSize;
                    const scale = currentAnimPropScale || 1; // preview at the scale it will be placed

                    mapCtx.globalAlpha = 0.5;
                    if (spriteImg && frames.length > 0) {
                        const frame = frames[0];
                        // Calculate how many tiles this prop spans
                        const origW = Math.ceil(frame.w / gridSize);
                        const origH = Math.ceil(frame.h / gridSize);
                        // Apply rotation to dimensions
                        const rot = tileRotation;
                        const placedW = (rot === 90 || rot === 270) ? origH : origW;
                        const placedH = (rot === 90 || rot === 270) ? origW : origH;
                        const drawW = placedW * tileSize; // footprint (tiles it occupies)
                        const drawH = placedH * tileSize;
                        // Scaled sprite size, centered within the footprint (matches placed render)
                        const sW = origW * tileSize * scale;
                        const sH = origH * tileSize * scale;

                        mapCtx.imageSmoothingEnabled = false;
                        // Draw with rotation, scaled and centered
                        if (rot === 0) {
                            const sx = drawX + (origW * tileSize - sW) / 2;
                            const sy = drawY + (origH * tileSize - sH) / 2;
                            mapCtx.drawImage(spriteImg, frame.x, frame.y, frame.w, frame.h, sx, sy, sW, sH);
                        } else {
                            mapCtx.save();
                            mapCtx.translate(drawX + drawW / 2, drawY + drawH / 2);
                            mapCtx.rotate(rot * Math.PI / 180);
                            // After rotation, draw centered at scaled size
                            mapCtx.drawImage(spriteImg, frame.x, frame.y, frame.w, frame.h, -sW / 2, -sH / 2, sW, sH);
                            mapCtx.restore();
                        }

                        mapCtx.globalAlpha = 1;
                        // Solid outline = actual scaled size; dashed = tile footprint it snaps to
                        const oxC = drawX + (origW * tileSize - sW) / 2;
                        const oyC = drawY + (origH * tileSize - sH) / 2;
                        mapCtx.strokeStyle = '#f0a';
                        mapCtx.lineWidth = 2;
                        mapCtx.strokeRect(oxC, oyC, sW, sH);
                        mapCtx.setLineDash([4, 4]);
                        mapCtx.lineWidth = 1;
                        mapCtx.strokeRect(drawX, drawY, drawW, drawH);
                        mapCtx.setLineDash([]);
                    } else {
                        // Placeholder preview
                        mapCtx.fillStyle = '#f0a';
                        mapCtx.fillRect(drawX + 2, drawY + 2, tileSize - 4, tileSize - 4);
                        mapCtx.globalAlpha = 1;
                        mapCtx.strokeStyle = '#f0a';
                        mapCtx.lineWidth = 2;
                        mapCtx.strokeRect(drawX, drawY, tileSize, tileSize);
                    }
                }
            }

            // Draw sound markers when in sound mode
            if (mode === 'sound' && tileSounds) {
                Object.keys(tileSounds).forEach(key => {
                    try {
                        // Filter by current map (keys are "mapName:x,y")
                        if (!key.startsWith(currentMapName + ':')) return;
                        const coords = key.split(':')[1];
                        const parts = coords.split(',');
                        const sx = parseInt(parts[0]) || 0;
                        const sy = parseInt(parts[1]) || 0;
                        const ts = tileSounds[key];
                        if (!ts) return;

                        const px = sx * tileSize + tileSize / 2;
                        const py = sy * tileSize + tileSize / 2;
                        const radius = ts.radius || 3;
                        const isSelected = key === selectedTileSoundKey;

                        // Draw radius circle (highlighted if selected)
                        mapCtx.strokeStyle = isSelected ? 'rgba(0, 255, 100, 0.8)' : 'rgba(255, 165, 0, 0.5)';
                        mapCtx.lineWidth = isSelected ? 3 : 2;
                        mapCtx.setLineDash(isSelected ? [] : [5, 5]);
                        mapCtx.beginPath();
                        mapCtx.arc(px, py, radius * tileSize, 0, Math.PI * 2);
                        mapCtx.stroke();
                        mapCtx.setLineDash([]);

                        // Draw fade zone indicator if selected
                        if (isSelected && ts.fadePercent > 0) {
                            const fadeStartRadius = radius * (1 - ts.fadePercent);
                            mapCtx.strokeStyle = 'rgba(0, 255, 100, 0.4)';
                            mapCtx.lineWidth = 1;
                            mapCtx.setLineDash([3, 3]);
                            mapCtx.beginPath();
                            mapCtx.arc(px, py, fadeStartRadius * tileSize, 0, Math.PI * 2);
                            mapCtx.stroke();
                            mapCtx.setLineDash([]);
                        }

                        // Draw speaker icon (highlighted if selected)
                        mapCtx.fillStyle = isSelected ? '#0f8' : (ts.loop ? '#ffa500' : '#ff6600');
                        mapCtx.beginPath();
                        mapCtx.arc(px, py, tileSize / 4, 0, Math.PI * 2);
                        mapCtx.fill();

                        // Sound wave icon
                        mapCtx.font = `${tileSize / 3}px sans-serif`;
                        mapCtx.textAlign = 'center';
                        mapCtx.textBaseline = 'middle';
                        mapCtx.fillStyle = '#fff';
                        mapCtx.fillText('🔊', px, py);
                    } catch (e) {
                        console.error('Error drawing sound marker:', key, e);
                    }
                });
            }

            // Draw light markers when in lighting mode (but hide guide UI when preview is on)
            if (mode === 'lighting' && pointLights && !lightingPreviewEnabled) {
                Object.keys(pointLights).forEach(key => {
                    try {
                        if (!key.startsWith(currentMapName + ':')) return;
                        const coords = key.split(':')[1];
                        const parts = coords.split(',');
                        const lx = parseInt(parts[0]) || 0;
                        const ly = parseInt(parts[1]) || 0;
                        const light = pointLights[key];
                        if (!light) return;

                        const px = lx * tileSize + tileSize / 2;
                        const py = ly * tileSize + tileSize / 2;
                        const radius = light.radius || 3;

                        // Draw light radius circle
                        mapCtx.strokeStyle = 'rgba(255, 220, 100, 0.6)';
                        mapCtx.lineWidth = 2;
                        mapCtx.setLineDash([5, 5]);
                        mapCtx.beginPath();
                        mapCtx.arc(px, py, radius * tileSize, 0, Math.PI * 2);
                        mapCtx.stroke();
                        mapCtx.setLineDash([]);

                        // Draw light glow gradient preview
                        const gradient = mapCtx.createRadialGradient(px, py, 0, px, py, radius * tileSize);
                        gradient.addColorStop(0, 'rgba(255, 220, 100, 0.3)');
                        gradient.addColorStop(0.6, 'rgba(255, 200, 50, 0.1)');
                        gradient.addColorStop(1, 'rgba(255, 200, 50, 0)');
                        mapCtx.fillStyle = gradient;
                        mapCtx.beginPath();
                        mapCtx.arc(px, py, radius * tileSize, 0, Math.PI * 2);
                        mapCtx.fill();

                        // Draw light bulb icon
                        mapCtx.fillStyle = light.flicker ? '#ffd700' : '#ffaa00';
                        mapCtx.beginPath();
                        mapCtx.arc(px, py, tileSize / 4, 0, Math.PI * 2);
                        mapCtx.fill();

                        mapCtx.font = `${tileSize / 3}px sans-serif`;
                        mapCtx.textAlign = 'center';
                        mapCtx.textBaseline = 'middle';
                        mapCtx.fillStyle = '#fff';
                        mapCtx.fillText('💡', px, py);
                    } catch (e) {
                        console.error('Error drawing light marker:', key, e);
                    }
                });

                // Draw placed polygon lights (guide UI)
                polyLights.filter(pl => pl.mapName === currentMapName).forEach((poly, idx) => {
                    if (poly.points.length < 3) return;

                    // Draw filled polygon with light glow
                    mapCtx.fillStyle = 'rgba(255, 220, 100, ' + (poly.intensity * 0.3) + ')';
                    mapCtx.beginPath();
                    mapCtx.moveTo(poly.points[0].x * tileSize, poly.points[0].y * tileSize);
                    for (let i = 1; i < poly.points.length; i++) {
                        mapCtx.lineTo(poly.points[i].x * tileSize, poly.points[i].y * tileSize);
                    }
                    mapCtx.closePath();
                    mapCtx.fill();

                    // Draw outline
                    mapCtx.strokeStyle = poly.flicker ? '#ffd700' : '#ffaa00';
                    mapCtx.lineWidth = 2;
                    mapCtx.stroke();

                    // Draw vertex points
                    mapCtx.fillStyle = '#0ff';
                    poly.points.forEach(pt => {
                        mapCtx.beginPath();
                        mapCtx.arc(pt.x * tileSize, pt.y * tileSize, 4, 0, Math.PI * 2);
                        mapCtx.fill();
                    });
                });

                // Draw polygon being drawn (preview)
                if (polyLightDrawing && polyLightPoints.length > 0) {
                    // Draw preview lines
                    mapCtx.strokeStyle = '#0ff';
                    mapCtx.lineWidth = 2;
                    mapCtx.setLineDash([5, 5]);
                    mapCtx.beginPath();
                    mapCtx.moveTo(polyLightPoints[0].x * tileSize, polyLightPoints[0].y * tileSize);
                    for (let i = 1; i < polyLightPoints.length; i++) {
                        mapCtx.lineTo(polyLightPoints[i].x * tileSize, polyLightPoints[i].y * tileSize);
                    }
                    mapCtx.stroke();
                    mapCtx.setLineDash([]);

                    // Draw placed points
                    mapCtx.fillStyle = '#0ff';
                    polyLightPoints.forEach((pt, i) => {
                        mapCtx.beginPath();
                        mapCtx.arc(pt.x * tileSize, pt.y * tileSize, 6, 0, Math.PI * 2);
                        mapCtx.fill();

                        // Number the points
                        mapCtx.fillStyle = '#000';
                        mapCtx.font = '10px sans-serif';
                        mapCtx.textAlign = 'center';
                        mapCtx.textBaseline = 'middle';
                        mapCtx.fillText('' + (i + 1), pt.x * tileSize, pt.y * tileSize);
                        mapCtx.fillStyle = '#0ff';
                    });
                }
            }

            // Draw triggers when in trigger mode, camera bounds when in camera mode, dialog tiles when in dialog mode
            if (mode === 'trigger' || mode === 'camera' || mode === 'dialog' || mode === 'fish') {
                // Show trigger drag preview (purple box while dragging)
                if (triggerDragStart && triggerDragEnd) {
                    const x1 = Math.min(triggerDragStart.x, triggerDragEnd.x);
                    const y1 = Math.min(triggerDragStart.y, triggerDragEnd.y);
                    const x2 = Math.max(triggerDragStart.x, triggerDragEnd.x);
                    const y2 = Math.max(triggerDragStart.y, triggerDragEnd.y);
                    const w = (x2 - x1 + 1) * tileSize;
                    const h = (y2 - y1 + 1) * tileSize;

                    mapCtx.fillStyle = 'rgba(255, 0, 255, 0.4)';
                    mapCtx.fillRect(x1 * tileSize, y1 * tileSize, w, h);
                    mapCtx.strokeStyle = '#f0f';
                    mapCtx.lineWidth = 3;
                    mapCtx.setLineDash([5, 5]);
                    mapCtx.strokeRect(x1 * tileSize, y1 * tileSize, w, h);
                    mapCtx.setLineDash([]);

                    // Show dimensions
                    mapCtx.fillStyle = '#fff';
                    mapCtx.font = 'bold 12px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'middle';
                    const dimText = (x2 - x1 + 1) + 'x' + (y2 - y1 + 1);
                    mapCtx.fillText(dimText, x1 * tileSize + w / 2, y1 * tileSize + h / 2);
                }

                // Show spawn point marker following mouse when setting spawn
                if (settingSpawnPoint && hoverMapPos) {
                    const hx = hoverMapPos.x * tileSize;
                    const hy = hoverMapPos.y * tileSize;

                    // Green spawn box follows mouse
                    mapCtx.fillStyle = 'rgba(0, 255, 100, 0.5)';
                    mapCtx.fillRect(hx, hy, tileSize, tileSize);
                    mapCtx.strokeStyle = '#0f0';
                    mapCtx.lineWidth = 3;
                    mapCtx.strokeRect(hx, hy, tileSize, tileSize);

                    // Label
                    mapCtx.fillStyle = '#fff';
                    mapCtx.font = 'bold 10px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'middle';
                    const doorNum = pendingTriggerForSpawn ? pendingTriggerForSpawn.doorNumber : '?';
                    mapCtx.fillText('Door ' + doorNum, hx + tileSize / 2, hy + tileSize / 2 - 6);
                    mapCtx.fillText('SPAWN', hx + tileSize / 2, hy + tileSize / 2 + 6);

                    // Draw instruction banner at top
                    mapCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                    mapCtx.fillRect(0, 0, mapCanvas.width, 30);
                    mapCtx.fillStyle = '#0f0';
                    mapCtx.font = 'bold 14px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.fillText('CLICK TO PLACE SPAWN FOR DOOR ' + doorNum, mapCanvas.width / 2, 18);
                }

                // Show walk-out point marker following mouse when setting walk-out
                if (settingWalkOutPoint && hoverMapPos) {
                    const hx = hoverMapPos.x * tileSize;
                    const hy = hoverMapPos.y * tileSize;

                    // Cyan walk-out box follows mouse
                    mapCtx.fillStyle = 'rgba(0, 255, 255, 0.5)';
                    mapCtx.fillRect(hx, hy, tileSize, tileSize);
                    mapCtx.strokeStyle = '#0ff';
                    mapCtx.lineWidth = 3;
                    mapCtx.strokeRect(hx, hy, tileSize, tileSize);

                    // Label
                    mapCtx.fillStyle = '#fff';
                    mapCtx.font = 'bold 10px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'middle';
                    const doorNum = pendingWalkOutTrigger ? pendingWalkOutTrigger.doorNumber : '?';
                    mapCtx.fillText('Door ' + doorNum, hx + tileSize / 2, hy + tileSize / 2 - 6);
                    mapCtx.fillText('WALK-OUT', hx + tileSize / 2, hy + tileSize / 2 + 6);

                    // Draw line from door trigger to cursor
                    if (pendingWalkOutTrigger) {
                        const startX = pendingWalkOutTrigger.x * tileSize + tileSize / 2;
                        const startY = pendingWalkOutTrigger.y * tileSize + tileSize / 2;
                        mapCtx.strokeStyle = '#0ff';
                        mapCtx.lineWidth = 2;
                        mapCtx.setLineDash([5, 5]);
                        mapCtx.beginPath();
                        mapCtx.moveTo(startX, startY);
                        mapCtx.lineTo(hx + tileSize / 2, hy + tileSize / 2);
                        mapCtx.stroke();
                        mapCtx.setLineDash([]);
                    }

                    // Draw instruction banner at top
                    mapCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                    mapCtx.fillRect(0, 0, mapCanvas.width, 30);
                    mapCtx.fillStyle = '#0ff';
                    mapCtx.font = 'bold 14px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.fillText('CLICK WHERE PLAYER WALKS TO BEFORE FADE (DOOR ' + doorNum + ')', mapCanvas.width / 2, 18);
                }

                // Draw triggers ON this map (purple boxes - where you enter)
                const currentTriggers = placedTriggers.filter(t => t.mapName === currentMapName);
                currentTriggers.forEach(trigger => {
                    const px = trigger.x * tileSize;
                    const py = trigger.y * tileSize;
                    const pw = (trigger.width || 1) * tileSize;
                    const ph = (trigger.height || 1) * tileSize;
                    const doorNum = trigger.doorNumber || 1;
                    const doorType = trigger.doorType || 'walkover';
                    const isExternal = doorType === 'external';

                    // Draw trigger zone fill (cyan for external, purple for internal)
                    mapCtx.fillStyle = isExternal ? 'rgba(0, 255, 255, 0.3)' : 'rgba(255, 100, 255, 0.3)';
                    mapCtx.fillRect(px, py, pw, ph);

                    // Draw border
                    mapCtx.strokeStyle = isExternal ? 'rgba(0, 255, 255, 0.8)' : 'rgba(255, 100, 255, 0.8)';
                    mapCtx.lineWidth = 2;
                    mapCtx.strokeRect(px, py, pw, ph);

                    // Draw door number label with type indicator
                    mapCtx.fillStyle = '#fff';
                    mapCtx.font = 'bold 11px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'middle';
                    const typeLabel = doorType === 'interact' ? '[E]' : (isExternal ? '[EXT]' : '');
                    mapCtx.fillText('Door ' + doorNum + ' ' + typeLabel, px + pw / 2, py + ph / 2 - 5);

                    // Draw destination below
                    mapCtx.font = '9px monospace';
                    mapCtx.fillStyle = isExternal ? '#0ff' : '#f4f';
                    const destLabel = isExternal ? trigger.externalUrl : trigger.targetMap;
                    mapCtx.fillText('→ ' + destLabel, px + pw / 2, py + ph / 2 + 7);

                    // Draw walk-out point and line if set
                    if (trigger.walkOutX !== null && trigger.walkOutX !== undefined &&
                        trigger.walkOutY !== null && trigger.walkOutY !== undefined) {
                        const woX = trigger.walkOutX * tileSize;
                        const woY = trigger.walkOutY * tileSize;

                        // Draw dashed line from trigger center to walk-out
                        mapCtx.strokeStyle = '#0ff';
                        mapCtx.lineWidth = 2;
                        mapCtx.setLineDash([4, 4]);
                        mapCtx.beginPath();
                        mapCtx.moveTo(px + pw / 2, py + ph / 2);
                        mapCtx.lineTo(woX + tileSize / 2, woY + tileSize / 2);
                        mapCtx.stroke();
                        mapCtx.setLineDash([]);

                        // Draw cyan walk-out box
                        mapCtx.fillStyle = 'rgba(0, 255, 255, 0.3)';
                        mapCtx.fillRect(woX, woY, tileSize, tileSize);
                        mapCtx.strokeStyle = '#0ff';
                        mapCtx.lineWidth = 2;
                        mapCtx.strokeRect(woX, woY, tileSize, tileSize);

                        // Label
                        mapCtx.fillStyle = '#0ff';
                        mapCtx.font = 'bold 8px monospace';
                        mapCtx.textAlign = 'center';
                        mapCtx.textBaseline = 'middle';
                        mapCtx.fillText('WALK', woX + tileSize / 2, woY + tileSize / 2 - 4);
                        mapCtx.fillText('OUT', woX + tileSize / 2, woY + tileSize / 2 + 5);
                    }
                });

                // Draw spawn points TO this map (green boxes - where you exit/appear)
                // Only draw if spawn has been set (not null)
                const incomingTriggers = placedTriggers.filter(t => t.targetMap === currentMapName && t.targetX !== null && t.targetY !== null);
                incomingTriggers.forEach(trigger => {
                    const sx = trigger.targetX * tileSize;
                    const sy = trigger.targetY * tileSize;
                    const doorNum = trigger.doorNumber || 1;

                    // Green spawn box
                    mapCtx.fillStyle = 'rgba(0, 255, 0, 0.3)';
                    mapCtx.fillRect(sx, sy, tileSize, tileSize);
                    mapCtx.strokeStyle = '#0f0';
                    mapCtx.lineWidth = 2;
                    mapCtx.strokeRect(sx, sy, tileSize, tileSize);

                    // Label: "Door X from [mapName]"
                    mapCtx.fillStyle = '#0f0';
                    mapCtx.font = 'bold 10px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'middle';
                    mapCtx.fillText('Door ' + doorNum, sx + tileSize / 2, sy + tileSize / 2 - 5);
                    mapCtx.font = '8px monospace';
                    mapCtx.fillText('from ' + trigger.mapName, sx + tileSize / 2, sy + tileSize / 2 + 6);
                });

                // Draw RETURN spawn points for external doors (cyan boxes - where you return from 3D)
                const externalReturns = placedTriggers.filter(t =>
                    t.doorType === 'external' &&
                    t.mapName === currentMapName &&
                    t.returnX !== null && t.returnY !== null
                );
                externalReturns.forEach(trigger => {
                    const sx = trigger.returnX * tileSize;
                    const sy = trigger.returnY * tileSize;
                    const doorNum = trigger.doorNumber || 1;

                    // Cyan return box
                    mapCtx.fillStyle = 'rgba(0, 255, 255, 0.3)';
                    mapCtx.fillRect(sx, sy, tileSize, tileSize);
                    mapCtx.strokeStyle = '#0ff';
                    mapCtx.lineWidth = 2;
                    mapCtx.strokeRect(sx, sy, tileSize, tileSize);

                    // Label: "Door X RETURN"
                    mapCtx.fillStyle = '#0ff';
                    mapCtx.font = 'bold 10px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'middle';
                    mapCtx.fillText('Door ' + doorNum, sx + tileSize / 2, sy + tileSize / 2 - 5);
                    mapCtx.font = '8px monospace';
                    mapCtx.fillText('RETURN', sx + tileSize / 2, sy + tileSize / 2 + 6);
                });

                // Draw dialog tiles (signs) - orange speech bubble markers
                const currentDialogTiles = placedDialogTiles.filter(t => t.mapName === currentMapName);
                currentDialogTiles.forEach(tile => {
                    const tx = tile.x * tileSize;
                    const ty = tile.y * tileSize;
                    const dialogName = dialogs[tile.dialogIndex]?.name || '?';

                    // Orange fill
                    mapCtx.fillStyle = 'rgba(255, 160, 0, 0.4)';
                    mapCtx.fillRect(tx, ty, tileSize, tileSize);

                    // Orange border
                    mapCtx.strokeStyle = '#fa0';
                    mapCtx.lineWidth = 2;
                    mapCtx.strokeRect(tx, ty, tileSize, tileSize);

                    // Speech bubble icon (simple triangle + circle)
                    const cx = tx + tileSize / 2;
                    const cy = ty + tileSize / 2 - 3;
                    mapCtx.fillStyle = '#fff';
                    mapCtx.beginPath();
                    mapCtx.arc(cx, cy, tileSize / 4, 0, Math.PI * 2);
                    mapCtx.fill();
                    // Triangle pointer
                    mapCtx.beginPath();
                    mapCtx.moveTo(cx - 3, cy + tileSize / 4 - 2);
                    mapCtx.lineTo(cx - 6, cy + tileSize / 3 + 2);
                    mapCtx.lineTo(cx + 2, cy + tileSize / 4);
                    mapCtx.fill();

                    // Dialog name below
                    mapCtx.fillStyle = '#fa0';
                    mapCtx.font = '8px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'top';
                    mapCtx.fillText(dialogName.substring(0, 8), cx, ty + tileSize + 2);
                });

                // Draw camera bounds (yellow/orange border)
                if (cameraBounds) {
                    const bx = cameraBounds.x * tileSize;
                    const by = cameraBounds.y * tileSize;
                    const bw = cameraBounds.width * tileSize;
                    const bh = cameraBounds.height * tileSize;

                    // Semi-transparent fill outside bounds
                    mapCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                    // Top
                    mapCtx.fillRect(0, 0, mapCanvas.width, by);
                    // Bottom
                    mapCtx.fillRect(0, by + bh, mapCanvas.width, mapCanvas.height - (by + bh));
                    // Left
                    mapCtx.fillRect(0, by, bx, bh);
                    // Right
                    mapCtx.fillRect(bx + bw, by, mapCanvas.width - (bx + bw), bh);

                    // Draw bounds border
                    mapCtx.strokeStyle = '#fa0';
                    mapCtx.lineWidth = 3;
                    mapCtx.setLineDash([8, 4]);
                    mapCtx.strokeRect(bx, by, bw, bh);
                    mapCtx.setLineDash([]);

                    // Label
                    mapCtx.fillStyle = '#fa0';
                    mapCtx.font = 'bold 11px monospace';
                    mapCtx.textAlign = 'left';
                    mapCtx.textBaseline = 'top';
                    mapCtx.fillText('CAMERA BOUNDS', bx + 5, by + 5);
                }

                // Draw camera bounds preview while dragging
                if (settingCameraBounds && cameraBoundsDragStart && cameraBoundsDragEnd) {
                    const x1 = Math.min(cameraBoundsDragStart.x, cameraBoundsDragEnd.x);
                    const y1 = Math.min(cameraBoundsDragStart.y, cameraBoundsDragEnd.y);
                    const x2 = Math.max(cameraBoundsDragStart.x, cameraBoundsDragEnd.x);
                    const y2 = Math.max(cameraBoundsDragStart.y, cameraBoundsDragEnd.y);
                    const w = (x2 - x1 + 1) * tileSize;
                    const h = (y2 - y1 + 1) * tileSize;

                    mapCtx.fillStyle = 'rgba(255, 170, 0, 0.2)';
                    mapCtx.fillRect(x1 * tileSize, y1 * tileSize, w, h);
                    mapCtx.strokeStyle = '#fa0';
                    mapCtx.lineWidth = 3;
                    mapCtx.strokeRect(x1 * tileSize, y1 * tileSize, w, h);

                    // Show dimensions
                    mapCtx.fillStyle = '#fff';
                    mapCtx.font = 'bold 12px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'middle';
                    mapCtx.fillText((x2 - x1 + 1) + 'x' + (y2 - y1 + 1) + ' tiles', x1 * tileSize + w / 2, y1 * tileSize + h / 2);
                }

                // Draw fish zones (purple highlight) — only on the Fishing tab to avoid clutter
                if (mode === 'fish') {
                    fishZones.forEach((z, i) => {
                        const zx = z.x * tileSize, zy = z.y * tileSize;
                        const zw = z.width * tileSize, zh = z.height * tileSize;
                        mapCtx.fillStyle = 'rgba(168, 85, 255, 0.35)';
                        mapCtx.fillRect(zx, zy, zw, zh);
                        mapCtx.strokeStyle = '#c77dff';
                        mapCtx.lineWidth = 3;
                        mapCtx.setLineDash([8, 4]);
                        mapCtx.strokeRect(zx, zy, zw, zh);
                        mapCtx.setLineDash([]);
                        mapCtx.fillStyle = '#e0c0ff';
                        mapCtx.font = 'bold 11px monospace';
                        mapCtx.textAlign = 'left';
                        mapCtx.textBaseline = 'top';
                        mapCtx.fillText('🎣 FISH ' + (i + 1), zx + 5, zy + 5);
                    });

                    // Fish zone preview while dragging
                    if (settingFishZones && fishZoneDragStart && fishZoneDragEnd) {
                        const x1 = Math.min(fishZoneDragStart.x, fishZoneDragEnd.x);
                        const y1 = Math.min(fishZoneDragStart.y, fishZoneDragEnd.y);
                        const x2 = Math.max(fishZoneDragStart.x, fishZoneDragEnd.x);
                        const y2 = Math.max(fishZoneDragStart.y, fishZoneDragEnd.y);
                        const w = (x2 - x1 + 1) * tileSize, h = (y2 - y1 + 1) * tileSize;
                        mapCtx.fillStyle = 'rgba(168, 85, 255, 0.45)';
                        mapCtx.fillRect(x1 * tileSize, y1 * tileSize, w, h);
                        mapCtx.strokeStyle = '#c77dff';
                        mapCtx.lineWidth = 3;
                        mapCtx.strokeRect(x1 * tileSize, y1 * tileSize, w, h);
                        mapCtx.fillStyle = '#fff';
                        mapCtx.font = 'bold 12px monospace';
                        mapCtx.textAlign = 'center';
                        mapCtx.textBaseline = 'middle';
                        mapCtx.fillText((x2 - x1 + 1) + 'x' + (y2 - y1 + 1) + ' tiles', x1 * tileSize + w / 2, y1 * tileSize + h / 2);
                    }
                }
            }

            // === DRAW DOOR ANIMATION SELECTED TILES (orange) ===
            // Draw regardless of mode so they show while in tile mode
            if ((selectingAnimTiles || paintingAnimTiles) && pendingAnimTrigger && doorAnimMapName === currentMapName) {
                // Highlight selected tiles with orange (only on current layer)
                selectedAnimTiles.forEach(tile => {
                    if (tile.layer !== currentLayer) return; // Only show on matching layer
                    const tx = tile.x * tileSize;
                    const ty = tile.y * tileSize;
                    mapCtx.fillStyle = 'rgba(255, 100, 0, 0.5)';
                    mapCtx.fillRect(tx, ty, tileSize, tileSize);
                    mapCtx.strokeStyle = '#f60';
                    mapCtx.lineWidth = 2;
                    mapCtx.strokeRect(tx, ty, tileSize, tileSize);
                });
            }

            // === DRAW PLACED NPCs AND PATHS ===
            if (mode === 'npc' || placedNpcs.length > 0) {
                const currentMapNpcs = placedNpcs.filter(p => p.mapName === currentMapName);

                currentMapNpcs.forEach((placed, idx) => {
                    const globalIdx = placedNpcs.indexOf(placed);
                    const npc = npcs[placed.npcIndex];
                    if (!npc) return;

                    const isSelected = globalIdx === selectedPlacedNpcIndex;

                    // Use preview position if preview is active for this NPC
                    const usePreview = npcPathPreviewActive && isSelected && npcPreviewState;
                    const drawX = usePreview ? npcPreviewState.x : placed.x;
                    const drawY = usePreview ? npcPreviewState.y : placed.y;
                    const px = drawX * tileSize;
                    const py = drawY * tileSize;

                    // Draw path if has waypoints (only in NPC mode, hide during preview)
                    if (placed.path && placed.path.length > 0 && mode === 'npc' && !npcPathPreviewActive) {
                        mapCtx.strokeStyle = isSelected ? '#4f4' : 'rgba(100, 255, 100, 0.5)';
                        mapCtx.lineWidth = isSelected ? 3 : 2;
                        mapCtx.setLineDash(isSelected ? [] : [5, 5]);

                        // Draw line from NPC to first waypoint
                        mapCtx.beginPath();
                        mapCtx.moveTo(px + tileSize / 2, py + tileSize / 2);

                        // Draw lines through all waypoints
                        placed.path.forEach((wp, i) => {
                            const wpx = wp.x * tileSize + tileSize / 2;
                            const wpy = wp.y * tileSize + tileSize / 2;
                            mapCtx.lineTo(wpx, wpy);
                        });

                        // If loop trigger, connect back to start
                        if (placed.trigger === 'loop') {
                            mapCtx.lineTo(px + tileSize / 2, py + tileSize / 2);
                        }

                        mapCtx.stroke();
                        mapCtx.setLineDash([]);

                        // Draw waypoint markers
                        placed.path.forEach((wp, i) => {
                            const wpx = wp.x * tileSize + tileSize / 2;
                            const wpy = wp.y * tileSize + tileSize / 2;

                            mapCtx.fillStyle = isSelected ? '#4f4' : 'rgba(100, 255, 100, 0.7)';
                            mapCtx.beginPath();
                            mapCtx.arc(wpx, wpy, 6, 0, Math.PI * 2);
                            mapCtx.fill();

                            // Number
                            mapCtx.fillStyle = '#000';
                            mapCtx.font = 'bold 10px sans-serif';
                            mapCtx.textAlign = 'center';
                            mapCtx.textBaseline = 'middle';
                            mapCtx.fillText((i + 1).toString(), wpx, wpy);
                        });
                    }

                    // Draw NPC sprite - use correct animation if previewing
                    const anims = npc.animations || {};
                    let anim;
                    let frameIdx = 0;

                    if (usePreview && npcPreviewState) {
                        // Use waypoint animation if idling, otherwise directional walk
                        const dirMap = { 'down': 'walkDown', 'up': 'walkUp', 'left': 'walkLeft', 'right': 'walkRight' };
                        if (npcPreviewState.waypointAnimation && npcPreviewState.waypointAnimation !== 'walk' &&
                            anims[npcPreviewState.waypointAnimation] && anims[npcPreviewState.waypointAnimation].length > 0) {
                            // Playing waypoint animation (idle, dance, etc.)
                            anim = anims[npcPreviewState.waypointAnimation];
                        } else {
                            // Walking animation
                            anim = (anims[dirMap[npcPreviewState.direction]]?.length > 0 ? anims[dirMap[npcPreviewState.direction]] : null) ||
                               (anims.walkDown?.length > 0 ? anims.walkDown : null) ||
                               (anims.idle?.length > 0 ? anims.idle : null) ||
                               Object.values(anims).find(a => a && a.length > 0);
                        }
                        frameIdx = npcPreviewState.frame % (anim ? anim.length : 1);
                    } else {
                        anim = (anims.walkDown?.length > 0 ? anims.walkDown : null) ||
                               (anims.idle?.length > 0 ? anims.idle : null) ||
                               Object.values(anims).find(a => a && a.length > 0);
                    }

                    if (npc.spriteData && anim && anim.length > 0) {
                        const frame = anim[frameIdx] || anim[0];
                        const img = npc._editorImg;

                        if (img && img.complete) {
                            mapCtx.imageSmoothingEnabled = false;

                            // Apply per-instance scale
                            const npcScale = placed.scale || 1;
                            const drawW = tileSize * npcScale;
                            const drawH = tileSize * npcScale;

                            // Center larger/smaller NPCs on the tile
                            const offsetX = (tileSize - drawW) / 2;
                            const offsetY = tileSize - drawH; // Anchor at bottom
                            const drawX = px + offsetX;
                            const drawY = py + offsetY;

                            // Draw NPC shadow (unless noShadow is set) - matches game rendering
                            if (!npc.noShadow) {
                                const shadowOffsetX = npc.shadowOffsetX ?? 0;
                                const shadowOffsetY = npc.shadowOffsetY ?? 4;
                                const shadowWidthRatio = npc.shadowWidth ?? 0.35;
                                const shadowHeightRatio = npc.shadowHeight ?? 0.12;
                                mapCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                                mapCtx.beginPath();
                                mapCtx.ellipse(
                                    drawX + drawW / 2 + shadowOffsetX,
                                    drawY + drawH - shadowOffsetY,
                                    drawW * shadowWidthRatio,
                                    drawW * shadowHeightRatio,
                                    0, 0, Math.PI * 2
                                );
                                mapCtx.fill();
                            }

                            // Determine which animation key is being used for mirror check
                            let animKey = 'walkDown';
                            if (usePreview && npcPreviewState) {
                                if (npcPreviewState.waypointAnimation && npcPreviewState.waypointAnimation !== 'walk' &&
                                    anims[npcPreviewState.waypointAnimation] && anims[npcPreviewState.waypointAnimation].length > 0) {
                                    animKey = npcPreviewState.waypointAnimation;
                                } else {
                                    const dirMap = { 'down': 'walkDown', 'up': 'walkUp', 'left': 'walkLeft', 'right': 'walkRight' };
                                    animKey = dirMap[npcPreviewState.direction] || 'walkDown';
                                }
                            }
                            // Flip for mirrored animations OR left direction fallback
                            const animMirrors = npc.animMirrors || {};
                            const isMirrored = animMirrors[animKey];
                            const flipX = isMirrored || (usePreview && npcPreviewState && npcPreviewState.direction === 'left' && !anims.walkLeft?.length);
                            if (flipX) {
                                mapCtx.save();
                                mapCtx.translate(px + offsetX + drawW, py + offsetY);
                                mapCtx.scale(-1, 1);
                                mapCtx.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, drawW, drawH);
                                mapCtx.restore();
                            } else {
                                mapCtx.drawImage(img, frame.x, frame.y, frame.w, frame.h, px + offsetX, py + offsetY, drawW, drawH);
                            }
                        } else {
                            // Load image if not cached
                            if (!npc._editorImg) {
                                npc._editorImg = new Image();
                                npc._editorImg.onload = () => renderMap();
                                npc._editorImg.src = npc.spriteData;
                            }
                            // Draw placeholder
                            mapCtx.fillStyle = '#a4f';
                            mapCtx.fillRect(px + 4, py + 4, tileSize - 8, tileSize - 8);
                        }
                    } else {
                        // No sprite - draw placeholder
                        mapCtx.fillStyle = '#a4f';
                        mapCtx.fillRect(px + 4, py + 4, tileSize - 8, tileSize - 8);
                    }

                    // Draw selection highlight
                    if (isSelected) {
                        mapCtx.strokeStyle = '#4f4';
                        mapCtx.lineWidth = 3;
                        mapCtx.strokeRect(px, py, tileSize, tileSize);
                    }

                    // Draw enemy AI radius circles when selected
                    if (isSelected && placed.isEnemy && mode === 'npc') {
                        const centerX = px + tileSize / 2;
                        const centerY = py + tileSize / 2;

                        // Vision radius (outer ring - yellow/orange)
                        const visionRadius = (placed.visionRadius || 5) * tileSize;
                        mapCtx.strokeStyle = 'rgba(255, 200, 50, 0.8)';
                        mapCtx.lineWidth = 2;
                        mapCtx.setLineDash([8, 4]);
                        mapCtx.beginPath();
                        mapCtx.arc(centerX, centerY, visionRadius, 0, Math.PI * 2);
                        mapCtx.stroke();
                        // Fill with transparent
                        mapCtx.fillStyle = 'rgba(255, 200, 50, 0.1)';
                        mapCtx.fill();

                        // Attack radius (inner ring - red)
                        const attackRadius = (placed.attackRange || 1) * tileSize;
                        mapCtx.strokeStyle = 'rgba(255, 80, 80, 0.9)';
                        mapCtx.lineWidth = 2;
                        mapCtx.setLineDash([4, 4]);
                        mapCtx.beginPath();
                        mapCtx.arc(centerX, centerY, attackRadius, 0, Math.PI * 2);
                        mapCtx.stroke();
                        // Fill with transparent red
                        mapCtx.fillStyle = 'rgba(255, 80, 80, 0.15)';
                        mapCtx.fill();

                        mapCtx.setLineDash([]);
                    }

                    // Draw NPC name label
                    if (mode === 'npc') {
                        mapCtx.fillStyle = 'rgba(0,0,0,0.7)';
                        mapCtx.font = '10px sans-serif';
                        mapCtx.textAlign = 'center';
                        const nameWidth = mapCtx.measureText(npc.name).width + 4;
                        mapCtx.fillRect(px + tileSize / 2 - nameWidth / 2, py - 14, nameWidth, 14);
                        mapCtx.fillStyle = isSelected ? '#4f4' : '#fff';
                        mapCtx.fillText(npc.name, px + tileSize / 2, py - 3);
                    }

                    // Draw dialog indicator for NPCs with dialogs attached (in dialog or npc mode)
                    if ((mode === 'dialog' || mode === 'npc') && placed.dialogIndex >= 0) {
                        const iconX = px + tileSize - 12;
                        const iconY = py - 8;
                        // Speech bubble icon background
                        mapCtx.fillStyle = '#4af';
                        mapCtx.beginPath();
                        mapCtx.ellipse(iconX, iconY, 10, 8, 0, 0, Math.PI * 2);
                        mapCtx.fill();
                        // Triangle tail
                        mapCtx.beginPath();
                        mapCtx.moveTo(iconX - 4, iconY + 6);
                        mapCtx.lineTo(iconX - 8, iconY + 14);
                        mapCtx.lineTo(iconX + 2, iconY + 6);
                        mapCtx.fill();
                        // "..." dots
                        mapCtx.fillStyle = '#000';
                        mapCtx.beginPath();
                        mapCtx.arc(iconX - 4, iconY, 2, 0, Math.PI * 2);
                        mapCtx.arc(iconX, iconY, 2, 0, Math.PI * 2);
                        mapCtx.arc(iconX + 4, iconY, 2, 0, Math.PI * 2);
                        mapCtx.fill();
                    }

                    // Draw shop indicator for NPCs with shops attached (in shop or npc mode)
                    if ((mode === 'shop' || mode === 'npc') && placed.shopIndex >= 0 && placed.shopIndex < shops.length) {
                        const iconX = px + 8;
                        const iconY = py - 8;
                        // Gold coin icon
                        mapCtx.fillStyle = '#fa0';
                        mapCtx.beginPath();
                        mapCtx.arc(iconX, iconY, 8, 0, Math.PI * 2);
                        mapCtx.fill();
                        mapCtx.strokeStyle = '#c80';
                        mapCtx.lineWidth = 2;
                        mapCtx.stroke();
                        // $ symbol
                        mapCtx.fillStyle = '#640';
                        mapCtx.font = 'bold 10px sans-serif';
                        mapCtx.textAlign = 'center';
                        mapCtx.textBaseline = 'middle';
                        mapCtx.fillText('$', iconX, iconY);
                    }
                });
            }

            // === DRAW PLACED ITEMS ===
            if (mode === 'item' || placedItems.length > 0) {
                const currentMapItems = placedItems.filter(p => !p.mapName || p.mapName === currentMapName);

                currentMapItems.forEach((placed, idx) => {
                    const item = items[placed.itemIndex];
                    if (!item || !item.frames || item.frames.length === 0) return;

                    const px = placed.x * tileSize;
                    const py = placed.y * tileSize;

                    // Get idle frame
                    const idleIdx = item.idleFrame || 0;
                    const frame = item.frames[idleIdx] || item.frames[0];

                    // Load/use sprite image
                    if (!item._spriteImg && item.spriteData) {
                        item._spriteImg = new Image();
                        item._spriteImg.src = item.spriteData;
                    }

                    if (item._spriteImg && item._spriteImg.complete) {
                        mapCtx.imageSmoothingEnabled = false;
                        const drawW = (item.frameWidth / gridSize) * tileSize;
                        const drawH = (item.frameHeight / gridSize) * tileSize;
                        mapCtx.drawImage(item._spriteImg,
                            frame.x, frame.y, frame.w, frame.h,
                            px, py, drawW, drawH
                        );
                    }

                    // Draw item highlight and label in item mode
                    if (mode === 'item') {
                        mapCtx.strokeStyle = '#4f8';
                        mapCtx.lineWidth = 2;
                        mapCtx.strokeRect(px, py, tileSize, tileSize);

                        // Name label
                        mapCtx.fillStyle = 'rgba(0,0,0,0.7)';
                        mapCtx.font = '10px sans-serif';
                        mapCtx.textAlign = 'center';
                        const nameWidth = mapCtx.measureText(item.name).width + 4;
                        mapCtx.fillRect(px + tileSize / 2 - nameWidth / 2, py - 14, nameWidth, 14);
                        mapCtx.fillStyle = '#4f8';
                        mapCtx.fillText(item.name, px + tileSize / 2, py - 3);
                    }
                });
            }

            // === DRAW PLACED STATIC OBJECTS ===
            placedStaticObjects.forEach(placed => {
                if (placed.mapName !== currentMapName) return;

                const obj = staticObjects[placed.objIndex];
                if (!obj || !obj._spriteImg || !obj._spriteImg.complete) return;

                const scale = placed.scale || 1;
                const srcW = obj.width * gridSize;
                const srcH = obj.height * gridSize;
                // Convert to canvas coordinates and apply scale
                const drawW = obj.width * tileSize * scale;
                const drawH = obj.height * tileSize * scale;

                // placed.x/y are in grid coordinates
                const drawX = placed.x * tileSize;
                const drawY = placed.y * tileSize;

                mapCtx.imageSmoothingEnabled = false;
                mapCtx.drawImage(
                    obj._spriteImg,
                    0, 0, srcW, srcH,
                    drawX, drawY, drawW, drawH
                );

                // Show outline in animProp mode
                if (mode === 'animProp') {
                    mapCtx.strokeStyle = '#4a7c59';
                    mapCtx.lineWidth = 2;
                    mapCtx.strokeRect(drawX, drawY, drawW, drawH);

                    // In edit mode, show collision box overlay
                    if (editStaticObjOnMapMode) {
                        const cb = placed.collisionBox;
                        if (cb && cb.w > 0 && cb.h > 0) {
                            // Draw collision box
                            const boxScale = tileSize / gridSize;
                            const cbDrawX = drawX + cb.x * boxScale;
                            const cbDrawY = drawY + cb.y * boxScale;
                            const cbDrawW = cb.w * boxScale;
                            const cbDrawH = cb.h * boxScale;

                            mapCtx.fillStyle = 'rgba(79, 255, 136, 0.3)';
                            mapCtx.fillRect(cbDrawX, cbDrawY, cbDrawW, cbDrawH);
                            mapCtx.strokeStyle = '#4f8';
                            mapCtx.setLineDash([4, 2]);
                            mapCtx.strokeRect(cbDrawX, cbDrawY, cbDrawW, cbDrawH);
                            mapCtx.setLineDash([]);
                        } else if (!cb) {
                            // No custom collision - show full object as collision (semi-transparent)
                            mapCtx.fillStyle = 'rgba(255, 200, 100, 0.2)';
                            mapCtx.fillRect(drawX, drawY, drawW, drawH);
                        }
                        // cb.w/h = 0 means no collision, show nothing
                    }
                }
            });

            // === HIGHLIGHT INTERACTIVE ANIM PROPS IN ITEM MODE ===
            // Show animated props that have giveItem enabled so users can click to assign specific items
            if (mode === 'item') {
                placedAnimProps.forEach((placed, idx) => {
                    if (placed.mapName && placed.mapName !== currentMapName) return;
                    // Guard: only draw the overlay where a real animTile cell exists on the CURRENT map.
                    // Kills cross-map phantom boxes from stale/untagged placedAnimProps entries.
                    if (!animTileCellExistsAt(placed.x, placed.y)) return;
                    const prop = animatedProps[placed.propIndex];
                    if (!prop || !prop.giveItem) return;

                    // Calculate prop bounds
                    const frames = prop.frames || [];
                    if (frames.length === 0) return;
                    const frame = frames[0];
                    const tilesW = Math.ceil(frame.w / gridSize);
                    const tilesH = Math.ceil(frame.h / gridSize);

                    const px = placed.x * tileSize;
                    const py = placed.y * tileSize;
                    const pw = tilesW * tileSize;
                    const ph = tilesH * tileSize;

                    // Orange dashed border for interactive props
                    mapCtx.strokeStyle = '#fa0';
                    mapCtx.lineWidth = 3;
                    mapCtx.setLineDash([6, 4]);
                    mapCtx.strokeRect(px + 2, py + 2, pw - 4, ph - 4);
                    mapCtx.setLineDash([]);

                    // Get item name - instance override or default from prop
                    const hasInstanceItem = placed.instanceItemIndex !== undefined && placed.instanceItemIndex >= 0;
                    const itemIdx = hasInstanceItem ? placed.instanceItemIndex : prop.giveItemIndex;
                    const itemName = (itemIdx >= 0 && items[itemIdx]) ? items[itemIdx].name : 'No Item';

                    // Background for label
                    mapCtx.fillStyle = hasInstanceItem ? 'rgba(0, 200, 100, 0.8)' : 'rgba(255, 150, 0, 0.8)';
                    mapCtx.font = 'bold 10px sans-serif';
                    const labelText = hasInstanceItem ? '🎁 ' + itemName : '📦 ' + itemName;
                    const textWidth = mapCtx.measureText(labelText).width + 6;
                    mapCtx.fillRect(px + pw / 2 - textWidth / 2, py - 16, textWidth, 14);

                    // Item label text
                    mapCtx.fillStyle = '#fff';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'middle';
                    mapCtx.fillText(labelText, px + pw / 2, py - 9);

                    // "Click to set item" hint at bottom
                    mapCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    mapCtx.font = '9px sans-serif';
                    const hintText = 'Click to set item';
                    const hintWidth = mapCtx.measureText(hintText).width + 4;
                    mapCtx.fillRect(px + pw / 2 - hintWidth / 2, py + ph + 2, hintWidth, 12);
                    mapCtx.fillStyle = '#fa0';
                    mapCtx.fillText(hintText, px + pw / 2, py + ph + 8);
                });
            }

            // === HIGHLIGHT ANIMATED PROPS IN EDIT MODE ===
            // Yellow highlight when "Edit Object on Map" is active in animProp mode
            if (mode === 'animProp' && editAnimPropOnMapMode) {
                // Scan all layers for animTiles and highlight them
                const highlightedOrigins = new Set(); // Track which props we've highlighted
                for (let li = 0; li < layers.length; li++) {
                    const layer = layers[li];
                    if (!layer) continue;
                    for (let y = 0; y < mapRows; y++) {
                        if (!layer[y]) continue;
                        for (let x = 0; x < mapCols; x++) {
                            const cell = layer[y][x];
                            if (!cell || cell.type !== 'animTile') continue;

                            // Only highlight at origin to avoid duplicates
                            const originX = x - (cell.offsetX || 0);
                            const originY = y - (cell.offsetY || 0);
                            const originKey = originX + ',' + originY + ',' + li;
                            if (highlightedOrigins.has(originKey)) continue;
                            highlightedOrigins.add(originKey);

                            const prop = animatedProps[cell.propIndex];
                            if (!prop) continue;

                            // Calculate prop size
                            const tilesW = cell.tilesW || 1;
                            const tilesH = cell.tilesH || 1;
                            const px = originX * tileSize;
                            const py = originY * tileSize;
                            const pw = tilesW * tileSize;
                            const ph = tilesH * tileSize;

                            // Yellow highlight border
                            mapCtx.strokeStyle = '#ff0';
                            mapCtx.lineWidth = 3;
                            mapCtx.setLineDash([6, 4]);
                            mapCtx.strokeRect(px + 2, py + 2, pw - 4, ph - 4);
                            mapCtx.setLineDash([]);

                            // Show current mode label
                            const instanceMode = cell.instancePlayMode || 'default';
                            let modeLabel = instanceMode === 'default' ? 'Default' : (instanceMode === 'loop' ? 'Loop' : 'Timed');
                            if (instanceMode === 'timed') {
                                modeLabel += ' (' + (cell.instancePlayCount || 1) + 'x, ' + (cell.instanceWaitTime || 2) + 's)';
                            }

                            // Background for label
                            mapCtx.fillStyle = instanceMode === 'default' ? 'rgba(100, 100, 100, 0.8)' : 'rgba(255, 200, 0, 0.9)';
                            mapCtx.font = 'bold 9px sans-serif';
                            const textWidth = mapCtx.measureText(modeLabel).width + 6;
                            mapCtx.fillRect(px + pw / 2 - textWidth / 2, py - 14, textWidth, 12);

                            // Mode label text
                            mapCtx.fillStyle = '#000';
                            mapCtx.textAlign = 'center';
                            mapCtx.textBaseline = 'middle';
                            mapCtx.fillText(modeLabel, px + pw / 2, py - 8);

                            // "Click to edit" hint
                            mapCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                            mapCtx.font = '8px sans-serif';
                            const hintText = 'Click to edit';
                            const hintWidth = mapCtx.measureText(hintText).width + 4;
                            mapCtx.fillRect(px + pw / 2 - hintWidth / 2, py + ph + 2, hintWidth, 10);
                            mapCtx.fillStyle = '#ff0';
                            mapCtx.fillText(hintText, px + pw / 2, py + ph + 7);
                        }
                    }
                }
            }

            // === LIGHTING PREVIEW OVERLAY ===
            if (lightingPreviewEnabled) {
                // Get darkness level from slider (0-100 -> 0-0.95)
                const darknessSlider = document.getElementById('previewDarknessSlider');
                const darknessLevel = darknessSlider ? parseInt(darknessSlider.value) / 100 * 0.95 : 0.7;

                if (darknessLevel > 0) {
                    // Create offscreen canvas for lighting
                    const lightCanvas = document.createElement('canvas');
                    lightCanvas.width = mapCanvas.width;
                    lightCanvas.height = mapCanvas.height;
                    const lightCtx = lightCanvas.getContext('2d');

                    // Fill with darkness (black with slider-controlled alpha)
                    lightCtx.fillStyle = 'rgba(0, 0, 20, ' + darknessLevel + ')';
                    lightCtx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

                    // Cut out point lights
                    lightCtx.globalCompositeOperation = 'destination-out';
                    Object.keys(pointLights).forEach(key => {
                        if (!key.startsWith(currentMapName + ':')) return;
                        const light = pointLights[key];
                        const coords = key.split(':')[1].split(',');
                        const lx = parseFloat(coords[0]);
                        const ly = parseFloat(coords[1]);
                        const px = lx * tileSize + tileSize / 2;
                        const py = ly * tileSize + tileSize / 2;
                        const radius = light.radius * tileSize;

                        const gradient = lightCtx.createRadialGradient(px, py, 0, px, py, radius);
                        gradient.addColorStop(0, 'rgba(255,255,255,1)');
                        gradient.addColorStop(0.6, 'rgba(255,255,255,0.5)');
                        gradient.addColorStop(1, 'rgba(255,255,255,0)');
                        lightCtx.fillStyle = gradient;
                        lightCtx.beginPath();
                        lightCtx.arc(px, py, radius, 0, Math.PI * 2);
                        lightCtx.fill();
                    });

                    // Cut out polygon lights
                    polyLights.filter(pl => pl.mapName === currentMapName).forEach(poly => {
                        if (poly.points.length < 3) return;
                        lightCtx.beginPath();
                        lightCtx.moveTo(poly.points[0].x * tileSize, poly.points[0].y * tileSize);
                        for (let i = 1; i < poly.points.length; i++) {
                            lightCtx.lineTo(poly.points[i].x * tileSize, poly.points[i].y * tileSize);
                        }
                        lightCtx.closePath();
                        lightCtx.fillStyle = 'rgba(255,255,255,' + (poly.intensity || 1) + ')';
                        lightCtx.fill();
                    });

                    // Draw lighting overlay on map
                    mapCtx.drawImage(lightCanvas, 0, 0);
                }
            }

            // === DRAW INITIAL SPAWN POINT MARKER ===
            // Only show on the map where spawn is set
            if (playerPreviewPos && currentMapName === spawnMapName) {
                const spawnX = playerPreviewPos.x * tileSize;
                const spawnY = playerPreviewPos.y * tileSize;

                // Green spawn box
                mapCtx.fillStyle = 'rgba(0, 255, 0, 0.3)';
                mapCtx.fillRect(spawnX, spawnY, tileSize, tileSize);
                mapCtx.strokeStyle = '#0f0';
                mapCtx.lineWidth = 2;
                mapCtx.strokeRect(spawnX, spawnY, tileSize, tileSize);

                // Label: "SPAWN" and "from [mapName]"
                mapCtx.fillStyle = '#0f0';
                mapCtx.font = 'bold 10px monospace';
                mapCtx.textAlign = 'center';
                mapCtx.textBaseline = 'middle';
                mapCtx.fillText('START', spawnX + tileSize / 2, spawnY + tileSize / 2 - 6);
                mapCtx.font = '9px monospace';
                mapCtx.fillStyle = '#8f8';
                mapCtx.fillText('(' + playerPreviewPos.x + ',' + playerPreviewPos.y + ')', spawnX + tileSize / 2, spawnY + tileSize / 2 + 7);
            }

            // === DRAW GAME PLAYERS (visible to builder when co-op) ===
            if (gamePlayersInBuilder.size > 0) {
                // Get the active player character sprite
                let activeSprite = null;
                if (activePlayerIndex >= 0 && playerCharacters[activePlayerIndex]) {
                    const activeChar = playerCharacters[activePlayerIndex];
                    if (activeChar._spriteImg && activeChar._spriteImg.complete && activeChar._spriteImg.naturalWidth > 0) {
                        activeSprite = activeChar._spriteImg;
                    }
                }
                // Fall back to playerSpriteImg if no active character sprite
                if (!activeSprite && playerSpriteImg && playerSpriteImg.complete && playerSpriteImg.naturalWidth > 0) {
                    activeSprite = playerSpriteImg;
                }

                // Get active character's animations for proper frame display
                const activeChar = activePlayerIndex >= 0 ? playerCharacters[activePlayerIndex] : null;
                const charAnims = activeChar?.animations || null;
                const charFrameW = activeChar?.frameWidth || 64;
                const charFrameH = activeChar?.frameHeight || 64;
                const charMirrors = activeChar?.animMirrors || {};

                // Legacy frame data fallback
                const idleFrames = {
                    down: [0, 1, 2],
                    up: [3, 4, 5],
                    right: [6, 7, 8],
                    left: [6, 7, 8]
                };
                const walkFrames = {
                    down: { row: 0, cols: [9, 10, 11, 12] },
                    up: { row: 0, cols: [13, 14, 15] },
                    right: { row: 1, cols: [1, 2, 3, 4] },
                    left: { row: 1, cols: [1, 2, 3, 4] }
                };

                gamePlayersInBuilder.forEach((gPlayer, id) => {
                    // Only show players on current map
                    if (gPlayer.currentMap !== currentMapName) return;

                    // Game coords are 4x builder coords (TILE_SCALE=2 + cameraZoom=2)
                    const px = (gPlayer.x / 4) * zoom;
                    const py = (gPlayer.y / 4) * zoom;

                    const drawSize = tileSize * 1.5;
                    const dir = gPlayer.direction || 'down';
                    const frame = gPlayer.frame || 0;

                    let srcX = 0, srcY = 0, srcW = charFrameW, srcH = charFrameH;
                    let flipX = false;

                    // Try to use new animation system
                    if (charAnims) {
                        const dirMap = { down: 'walkDown', up: 'walkUp', left: 'walkLeft', right: 'walkRight' };
                        const idleDirMap = { down: 'idleDown', up: 'idleUp', left: 'idleLeft', right: 'idleRight' };
                        const attackDirMap = { down: 'attackDown', up: 'attackUp', left: 'attackLeft', right: 'attackRight' };

                        let animKey;
                        if (gPlayer.animation === 'attack') {
                            const attackKey = attackDirMap[cardinalOf(dir)];
                            if (charAnims[attackKey] && charAnims[attackKey].length > 0) {
                                animKey = attackKey;
                            } else if (charAnims.attack && charAnims.attack.length > 0) {
                                animKey = 'attack';
                            } else {
                                animKey = dirMap[cardinalOf(dir)];
                            }
                        } else if (gPlayer.animation === 'walk') {
                            const _wr = resolveWalkKey(charAnims, dir);
                            animKey = _wr.key;
                            if (_wr.flip) flipX = true;
                        } else {
                            const dirIdleKey = idleDirMap[cardinalOf(dir)];
                            if (charAnims[dirIdleKey] && charAnims[dirIdleKey].length > 0) {
                                animKey = dirIdleKey;
                            } else {
                                animKey = 'idle';
                            }
                        }

                        let frames = charAnims[animKey];
                        if (!frames || frames.length === 0) frames = charAnims.walkDown || [];
                        if ((!frames || frames.length === 0) && dir === 'left') {
                            frames = charAnims.walkRight || [];
                            flipX = true;
                        }

                        if (frames && frames.length > 0) {
                            const f = frames[frame % frames.length];
                            srcX = f.x;
                            srcY = f.y;
                            srcW = f.w;
                            srcH = f.h;
                        }

                        if (charMirrors[animKey]) flipX = !flipX;
                        if (dir === 'left' && (!charAnims.walkLeft || charAnims.walkLeft.length === 0)) {
                            flipX = true;
                        }
                    } else {
                        // Legacy frame layout
                        let row = 0, col = 0;
                        const ldir = cardinalOf(dir); // legacy 4-key tables have no diagonals; collapse to avoid undefined lookup
                        flipX = ldir === 'left';

                        if (gPlayer.animation === 'walk') {
                            const walk = walkFrames[ldir];
                            row = walk.row;
                            col = walk.cols[frame % walk.cols.length];
                        } else {
                            row = 0;
                            col = idleFrames[ldir][frame % idleFrames[ldir].length];
                        }

                        srcX = col * charFrameW;
                        srcY = row * charFrameH;
                    }

                    if (activeSprite) {
                        // Draw shadow
                        mapCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                        mapCtx.beginPath();
                        mapCtx.ellipse(px, py + drawSize * 0.4, drawSize * 0.3, drawSize * 0.1, 0, 0, Math.PI * 2);
                        mapCtx.fill();

                        // Draw sprite
                        mapCtx.save();
                        if (flipX) {
                            mapCtx.translate(px + drawSize / 2, py - drawSize / 2);
                            mapCtx.scale(-1, 1);
                            mapCtx.drawImage(activeSprite,
                                srcX, srcY, srcW, srcH,
                                0, 0, drawSize, drawSize);
                        } else {
                            mapCtx.drawImage(activeSprite,
                                srcX, srcY, srcW, srcH,
                                px - drawSize / 2, py - drawSize / 2, drawSize, drawSize);
                        }
                        mapCtx.restore();
                    } else {
                        // Fallback: simple colored circle with direction indicator
                        mapCtx.fillStyle = 'rgba(0, 255, 255, 0.8)';
                        mapCtx.beginPath();
                        mapCtx.arc(px, py, 12 * zoom, 0, Math.PI * 2);
                        mapCtx.fill();
                        mapCtx.fillStyle = '#000';
                        mapCtx.font = '8px monospace';
                        mapCtx.textAlign = 'center';
                        mapCtx.fillText(dir[0], px, py + 3);
                    }

                    // Draw name above player
                    mapCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    mapCtx.font = 'bold ' + (10 * zoom) + 'px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'bottom';
                    const nameWidth = mapCtx.measureText(gPlayer.name).width + 8;
                    mapCtx.fillRect(px - nameWidth / 2, py - drawSize / 2 - 16 * zoom, nameWidth, 14 * zoom);
                    mapCtx.fillStyle = '#0ff';
                    mapCtx.fillText(gPlayer.name, px, py - drawSize / 2 - 4 * zoom);
                });
            }

            // === DEBUG: Show click coords ===
            if (window.debugClickPos) {
                const dx = window.debugClickPos.x * zoom;
                const dy = window.debugClickPos.y * zoom;
                mapCtx.fillStyle = '#f0f';
                mapCtx.beginPath();
                mapCtx.arc(dx, dy, 8 * zoom, 0, Math.PI * 2);
                mapCtx.fill();
                mapCtx.fillStyle = '#fff';
                mapCtx.font = 'bold 12px monospace';
                mapCtx.textAlign = 'left';
                mapCtx.fillText('DEBUG: ' + window.debugClickPos.x + ',' + window.debugClickPos.y, dx + 10, dy);
            }

            // Update expand button positions after canvas resize
            positionExpandButtons();
        }

        // Zoom
        function updateZoomDisplay() {
            document.getElementById('zoomLevel').textContent = zoom + 'x';
            const toolbarZoom = document.getElementById('zoomLevelToolbar');
            if (toolbarZoom) toolbarZoom.textContent = zoom + 'x';
        }
        function zoomIn() { if (zoom < 4) { zoom++; updateZoomDisplay(); renderMap(); } }
        function zoomOut() { if (zoom > 1) { zoom--; updateZoomDisplay(); renderMap(); } }

        // Only zoom with scroll when grab tool is active
        document.getElementById('mapViewport').addEventListener('wheel', (e) => {
            if (grabToolActive) {
                e.preventDefault();
                if (e.deltaY < 0) zoomIn(); else zoomOut();
            }
        });

        function clearMap() { if (confirm('Clear entire map?')) { initMap(); mapInitialized = true; broadcastEdit({ editType: 'clearMap', mapName: currentMapName }); renderMap(); } }
