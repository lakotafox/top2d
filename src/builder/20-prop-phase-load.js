        // ===== PROP TOOLS =====
        function setPropTool(tool) {
            propTool = tool;
            document.getElementById('propToolSelect').classList.remove('active');
            document.getElementById('propToolCollision').classList.remove('active');
            document.getElementById('propToolErase').classList.remove('active');
            document.getElementById('propTool' + tool.charAt(0).toUpperCase() + tool.slice(1)).classList.add('active');

            // Show/hide brush controls
            document.getElementById('propBrushControls').style.display =
                (tool === 'collision' || tool === 'erase') ? 'block' : 'none';

            // Update cursor
            if (propTilesetCanvas) propTilesetCanvas.style.cursor = (tool === 'select') ? 'crosshair' : 'cell';

            drawPropTileset();
        }

        function setPropBrushSize(size) {
            propBrushSize = size;
            document.querySelectorAll('[id^="propBrush"]').forEach(b => b.classList.remove('active'));
            document.getElementById('propBrush' + size).classList.add('active');
        }

        // ===== PHASE MANAGEMENT =====
        let keepLoadPhaseVisible = false; // Flag to keep loading screen visible during adventure mode
        function setPhase(phase) {
            currentPhase = phase;
            document.querySelectorAll('.phase').forEach(p => p.classList.remove('active'));
            document.getElementById(phase + 'Phase').classList.add('active');
            // Keep loadPhase visible if flag is set (adventure mode loading)
            if (keepLoadPhaseVisible) {
                document.getElementById('loadPhase').classList.add('active');
            }

            // Start/stop editor animation loop based on phase
            if (phase === 'build') {
                startEditorAnimLoop();
            } else {
                stopEditorAnimLoop();
            }
        }

        // Animation loop for animated props in the editor
        function startEditorAnimLoop() {
            if (editorAnimInterval) return;
            editorAnimInterval = setInterval(() => {
                let needsRender = false;

                // Scan all layers for animTile cells
                for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
                    const layer = layers[layerIdx];
                    if (!layer) continue;

                    for (let y = 0; y < layer.length; y++) {
                        if (!layer[y]) continue;
                        for (let x = 0; x < layer[y].length; x++) {
                            const cell = layer[y][x];
                            if (!cell || cell.type !== 'animTile') continue;

                            const prop = animatedProps[cell.propIndex];
                            if (!prop || !prop.frames || prop.frames.length <= 1) continue;
                            if (prop.type !== 'loop') continue;

                            const key = x + ',' + y + ',' + layerIdx;
                            if (!placedAnimPropFrames[key]) {
                                placedAnimPropFrames[key] = { frame: 0, timer: 0, waiting: false, waitTimer: 0, playCount: 0 };
                            }
                            const state = placedAnimPropFrames[key];
                            const instanceSpeed = cell.instanceSpeed || 1;
                            const fps = (prop.fps || 8) * instanceSpeed;
                            const frameDelay = Math.round(60 / fps);
                            // Use instance settings if set, otherwise fall back to prop defaults
                            const playMode = cell.instancePlayMode || prop.playMode || 'loop';
                            const waitTime = ((cell.instanceWaitTime !== undefined ? cell.instanceWaitTime : prop.waitTime) || 2) * 60;
                            const targetPlayCount = cell.instancePlayCount || 1;

                            // Handle timed mode - wait between animation cycles
                            if (playMode === 'timed' && state.waiting) {
                                state.waitTimer++;
                                if (state.waitTimer >= waitTime) {
                                    state.waiting = false;
                                    state.waitTimer = 0;
                                    state.frame = 0;
                                    state.playCount = 0;
                                }
                                continue;
                            }

                            state.timer++;
                            if (state.timer >= frameDelay) {
                                state.timer = 0;
                                state.frame++;

                                // Handle end of animation
                                if (state.frame >= prop.frames.length) {
                                    if (playMode === 'loop') {
                                        state.frame = 0; // Loop forever
                                    } else if (playMode === 'timed') {
                                        state.playCount++;
                                        if (state.playCount >= targetPlayCount) {
                                            // Played enough times, now wait
                                            state.frame = 0;
                                            state.waiting = true;
                                            state.waitTimer = 0;
                                        } else {
                                            state.frame = 0; // Play again
                                        }
                                    } else {
                                        state.frame = 0; // Default: loop
                                    }
                                }
                                needsRender = true;
                            }
                        }
                    }
                }

                if (needsRender) renderMap();
            }, 1000 / 60); // 60fps update
        }

        function stopEditorAnimLoop() {
            if (editorAnimInterval) {
                clearInterval(editorAnimInterval);
                editorAnimInterval = null;
            }
        }

        // ===== LOAD PHASE =====
        function loadTileset(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Add as first tileset
                    tilesets = [{ name: file.name, img: img, data: e.target.result }];
                    currentTilesetIndex = 0;
                    tilesetImg = img;
                    updateTilesetDropdown();
                    setPhase('collision');
                    rebuildCollisionView();
                    // Broadcast to other builders
                    broadcastEdit({ editType: 'addTileset', name: file.name, data: e.target.result });
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        function addTileset(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    tilesets.push({ name: file.name, img: img, data: e.target.result });
                    currentTilesetIndex = tilesets.length - 1;
                    tilesetImg = img;
                    updateTilesetDropdown();
                    drawPaintTileset();
                    drawPropTileset();
                    // Broadcast to other builders
                    broadcastEdit({ editType: 'addTileset', name: file.name, data: e.target.result });
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
            event.target.value = ''; // Reset input so same file can be selected again
        }

        function switchTileset() {
            // Legacy function - now handled by selectTilesetFromPicker
            if (tilesets[currentTilesetIndex]) {
                tilesetImg = tilesets[currentTilesetIndex].img;
            }
            selectedTileData = null;
            selectedTiles = [];
            drawPaintTileset();
            drawPropTileset();
            renderMap();
        }

        function updateTilesetDropdown() {
            // Update the picker button with current tileset
            const thumb = document.getElementById('tilesetPickerThumb');
            const name = document.getElementById('tilesetPickerName');
            const dropdownList = document.getElementById('tilesetDropdownList');
            const sortBtn = document.getElementById('tilesetSortBtn');

            if (!thumb || !name || !dropdownList) return;

            if (tilesets.length > 0 && tilesets[currentTilesetIndex]) {
                const ts = tilesets[currentTilesetIndex];
                thumb.src = ts.data || '';
                thumb.style.display = ts.data ? 'block' : 'none';
                name.textContent = ts.name || 'Untitled';
            } else {
                thumb.src = '';
                thumb.style.display = 'none';
                name.textContent = 'No tileset';
            }

            // Update sort button text
            if (sortBtn) {
                sortBtn.textContent = tilesetSortOrder === 'alpha' ? 'A-Z' : '1-2-3';
                sortBtn.title = tilesetSortOrder === 'alpha' ? 'Sorted alphabetically (click for order added)' : 'Sorted by order added (click for alphabetical)';
            }

            // Create array with original indices
            let tilesetsWithIndex = tilesets.map((ts, i) => ({ ts, originalIndex: i }));

            // Filter by search term
            if (tilesetSearchTerm) {
                const term = tilesetSearchTerm.toLowerCase();
                tilesetsWithIndex = tilesetsWithIndex.filter(item =>
                    (item.ts.name || '').toLowerCase().includes(term)
                );
            }

            // Sort by order
            if (tilesetSortOrder === 'alpha') {
                tilesetsWithIndex.sort((a, b) =>
                    (a.ts.name || '').localeCompare(b.ts.name || '')
                );
            }

            // Build dropdown items
            dropdownList.innerHTML = '';
            tilesetsWithIndex.forEach(({ ts, originalIndex }) => {
                const item = document.createElement('div');
                item.className = 'tileset-picker-item' + (originalIndex === currentTilesetIndex ? ' selected' : '');
                item.onclick = () => selectTilesetFromPicker(originalIndex);

                const itemThumb = document.createElement('img');
                itemThumb.className = 'thumb';
                itemThumb.src = ts.data || '';

                const info = document.createElement('div');
                info.className = 'info';

                const itemName = document.createElement('div');
                itemName.className = 'name';
                itemName.textContent = ts.name || 'Untitled';

                const size = document.createElement('div');
                size.className = 'size';
                if (ts.img) {
                    size.textContent = ts.img.width + ' x ' + ts.img.height + ' px';
                }

                info.appendChild(itemName);
                info.appendChild(size);
                item.appendChild(itemThumb);
                item.appendChild(info);
                dropdownList.appendChild(item);
            });

            if (tilesetsWithIndex.length === 0 && tilesetSearchTerm) {
                dropdownList.innerHTML = '<div style="padding:10px; color:#888; text-align:center; font-size:11px;">No matching tilesets</div>';
            }
        }

        function filterTilesets(term) {
            tilesetSearchTerm = term;
            updateTilesetDropdown();
        }

        function toggleTilesetSort() {
            tilesetSortOrder = tilesetSortOrder === 'added' ? 'alpha' : 'added';
            updateTilesetDropdown();
        }

        function toggleTilesetPicker() {
            const dropdown = document.getElementById('tilesetPickerDropdown');
            if (dropdown) {
                dropdown.classList.toggle('open');
            }
        }

        function selectTilesetFromPicker(index) {
            currentTilesetIndex = index;
            tilesetImg = tilesets[currentTilesetIndex].img;
            selectedTileData = null;
            selectedTiles = [];

            // Close dropdown
            const dropdown = document.getElementById('tilesetPickerDropdown');
            if (dropdown) dropdown.classList.remove('open');

            // Update UI
            updateTilesetDropdown();
            drawPaintTileset();
            drawPropTileset();
            renderMap();
        }

        // ===== Find Tileset: click a tile on the map to discover which tileset it's from =====
        let findTilesetMode = false;
        function toggleFindTilesetMode() {
            findTilesetMode = !findTilesetMode;
            if (findTilesetMode) copyMode = false; // don't fight the copy click-capture
            const btn = document.getElementById('findTilesetBtn');
            if (btn) {
                btn.classList.toggle('active', findTilesetMode);
                btn.textContent = findTilesetMode ? '✕ Cancel — click a tile' : '🔍 Find Tileset';
            }
            if (typeof mapCanvas !== 'undefined' && mapCanvas) mapCanvas.style.cursor = findTilesetMode ? 'help' : '';
            const res = document.getElementById('findTilesetResult');
            if (res && !findTilesetMode) res.style.display = 'none';
        }

        function findTilesetAt(x, y) {
            const res = document.getElementById('findTilesetResult');
            // Find the top-most VISIBLE tile cell at this spot — that's what the user clicked on.
            let found = null;
            for (let li = layers.length - 1; li >= 0; li--) {
                if (!layerVisibility[li]) continue;
                const row = layers[li] && layers[li][y];
                const cell = row && row[x];
                if (cell && cell.type === 'tile') { found = cell; break; }
            }
            if (!found) {
                if (res) { res.style.display = 'block'; res.style.color = '#f88'; res.textContent = 'No tile at that spot — try another (hidden layers are skipped).'; }
                return;
            }
            const idx = found.tilesetIndex || 0;
            const ts = tilesets[idx];
            const name = ts ? ts.name : ('Tileset #' + idx);
            if (ts) selectTilesetFromPicker(idx); // select it so collisions can be edited right away
            if (res) {
                res.style.display = 'block';
                res.style.color = '#5cf';
                res.textContent = 'From “' + name + '” (#' + idx + ') — selected. Now hit “Edit Tile Collisions”.';
            }
            console.log('[FIND TILESET] tile at', x + ',' + y, '-> tileset #' + idx, name);
            // One pick, then exit the mode.
            findTilesetMode = false;
            const btn = document.getElementById('findTilesetBtn');
            if (btn) { btn.classList.remove('active'); btn.textContent = '🔍 Find Tileset'; }
            if (typeof mapCanvas !== 'undefined' && mapCanvas) mapCanvas.style.cursor = '';
        }

        // Close tileset picker when clicking outside
        document.addEventListener('click', function(e) {
            const picker = document.getElementById('tilesetPicker');
            const dropdown = document.getElementById('tilesetPickerDropdown');
            if (picker && dropdown && !picker.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });

        function deleteTileset(fromNetwork = false, networkTilesetIndex = null) {
            const tilesetIndexToDelete = fromNetwork ? networkTilesetIndex : currentTilesetIndex;

            if (tilesets.length === 0) {
                if (!fromNetwork) alert('No tileset to delete');
                return;
            }
            if (tilesets.length === 1) {
                if (!fromNetwork) alert('Cannot delete the only tileset. Add another one first.');
                return;
            }

            const tileset = tilesets[tilesetIndexToDelete];
            if (!fromNetwork && !confirm('Delete tileset "' + tileset.name + '"?\n\nTiles from this tileset on the map will become empty.')) return;

            // Remove tiles from map that use this tileset
            layers.forEach(layer => {
                for (let y = 0; y < layer.length; y++) {
                    for (let x = 0; x < layer[y].length; x++) {
                        const tile = layer[y][x];
                        if (tile && tile.tilesetIndex === tilesetIndexToDelete) {
                            layer[y][x] = null;
                        } else if (tile && tile.tilesetIndex > tilesetIndexToDelete) {
                            // Adjust indices for tilesets after the deleted one
                            tile.tilesetIndex--;
                        }
                    }
                }
            });

            // Wave 5: rekey ALL four tileset-prefixed collision dicts (was only tileCollisions).
            // Prior bug left collisionMasks / tileSplitLines / tileSplitLineFlipped pointing at
            // wrong indices after a delete, corrupting saves silently.
            reindexTilesetReferences(tilesetIndexToDelete);

            // Broadcast before modifying tilesets array (need to send original index)
            if (!fromNetwork) {
                broadcastEdit({ editType: 'deleteTileset', index: tilesetIndexToDelete });
            }

            // Remove the tileset
            tilesets.splice(tilesetIndexToDelete, 1);

            // Update current index
            if (currentTilesetIndex >= tilesets.length) {
                currentTilesetIndex = tilesets.length - 1;
            }
            if (tilesets.length > 0) {
                tilesetImg = tilesets[currentTilesetIndex].img;
            }

            // Update UI
            updateTilesetDropdown();
            selectedTileData = null;
            selectedTiles = [];
            drawPaintTileset();
            renderMap();
        }
