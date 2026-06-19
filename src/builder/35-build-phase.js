        // ===== BUILD PHASE =====
        function initMap() {
            // Initialize with one layer
            layers = [createEmptyLayer()];
            layerVisibility = [true];
            layerNames = [''];
            currentLayer = 0;
            map = layers[0]; // map points to current layer for compatibility
            renderLayerList();
        }

        function createEmptyLayer() {
            const layer = [];
            for (let y = 0; y < mapRows; y++) {
                layer[y] = [];
                for (let x = 0; x < mapCols; x++) {
                    layer[y][x] = null;
                }
            }
            return layer;
        }

        function addLayer(fromNetwork = false) {
            layers.push(createEmptyLayer());
            layerVisibility.push(true);
            layerNames.push('');
            currentLayer = layers.length - 1;
            map = layers[currentLayer];
            renderLayerList();
            renderMap();

            // Broadcast to other builders
            if (!fromNetwork) {
                broadcastEdit({ editType: 'addLayer', mapName: currentMapName });
            }
        }

        function selectLayer(index) {
            currentLayer = index;
            map = layers[currentLayer];
            renderLayerList();
            renderMap();
        }

        function toggleLayerVisibility(index) {
            layerVisibility[index] = !layerVisibility[index];
            renderLayerList();
            renderMap();
        }

        function deleteLayer(index, fromNetwork = false) {
            if (layers.length <= 1) return alert('Need at least one layer');
            if (!fromNetwork) {
                const layerLabel = layerNames[index] ? `"${layerNames[index]}"` : `Layer ${index}`;
                if (!confirm('Delete ' + layerLabel + '?')) return;
            }
            layers.splice(index, 1);
            layerVisibility.splice(index, 1);
            layerNames.splice(index, 1);
            if (currentLayer >= layers.length) currentLayer = layers.length - 1;
            map = layers[currentLayer];
            if (!fromNetwork) {
                broadcastEdit({ editType: 'deleteLayer', index: index, mapName: currentMapName });
            }
            renderLayerList();
            renderMap();
        }

        function moveLayerUp(index, fromNetwork = false) {
            if (index <= 0) return;
            [layers[index], layers[index-1]] = [layers[index-1], layers[index]];
            [layerVisibility[index], layerVisibility[index-1]] = [layerVisibility[index-1], layerVisibility[index]];
            [layerNames[index], layerNames[index-1]] = [layerNames[index-1], layerNames[index]];
            if (currentLayer === index) currentLayer--;
            else if (currentLayer === index - 1) currentLayer++;
            map = layers[currentLayer];
            if (!fromNetwork) {
                broadcastEdit({ editType: 'moveLayerUp', index: index, mapName: currentMapName });
            }
            renderLayerList();
            renderMap();
        }

        function moveLayerDown(index, fromNetwork = false) {
            if (index >= layers.length - 1) return;
            [layers[index], layers[index+1]] = [layers[index+1], layers[index]];
            [layerVisibility[index], layerVisibility[index+1]] = [layerVisibility[index+1], layerVisibility[index]];
            [layerNames[index], layerNames[index+1]] = [layerNames[index+1], layerNames[index]];
            if (currentLayer === index) currentLayer++;
            else if (currentLayer === index + 1) currentLayer--;
            map = layers[currentLayer];
            if (!fromNetwork) {
                broadcastEdit({ editType: 'moveLayerDown', index: index, mapName: currentMapName });
            }
            renderLayerList();
            renderMap();
        }

        function renderLayerList() {
            // Render to both layer lists (tileset mode and animProp mode)
            const lists = [
                document.getElementById('layerList'),
                document.getElementById('animPropLayerList')
            ];

            for (const list of lists) {
                if (!list) continue;
                list.innerHTML = '';

                // Insert player layer row at the right position
                // Player layer is rendered BETWEEN layers[playerLayerIndex-1] and layers[playerLayerIndex]
                // So we need to show it after displaying layer playerLayerIndex-1

                for (let i = 0; i < layers.length; i++) {
                    // If this is where the player layer should appear, show it first
                    if (i === playerLayerIndex) {
                        list.appendChild(createPlayerLayerRow());
                    }

                    const div = document.createElement('div');
                    div.style.cssText = 'display:flex; align-items:center; gap:5px; padding:5px; margin:3px 0; background:' + (i === currentLayer ? '#4af' : '#333') + '; border-radius:4px; font-size:11px;';

                    const layerLabel = layerNames[i] ? `Layer ${i} (${layerNames[i]})` : `Layer ${i}`;

                    div.innerHTML = `
                        <input type="checkbox" ${layerVisibility[i] ? 'checked' : ''} onclick="toggleLayerVisibility(${i})" title="Visibility">
                        <span style="flex:1; cursor:pointer; color:${i === currentLayer ? '#000' : '#fff'};" onclick="selectLayer(${i})">${layerLabel}</span>
                        <button onclick="renameLayer(${i})" style="padding:2px 5px; font-size:10px;" title="Rename">✎</button>
                        <button onclick="moveLayerUp(${i})" style="padding:2px 5px; font-size:10px;">↑</button>
                        <button onclick="moveLayerDown(${i})" style="padding:2px 5px; font-size:10px;">↓</button>
                        <button onclick="deleteLayer(${i})" style="padding:2px 5px; font-size:10px; background:#a55;">X</button>
                    `;
                    list.appendChild(div);
                }

                // If player layer is at the end (beyond all layers)
                if (playerLayerIndex >= layers.length) {
                    list.appendChild(createPlayerLayerRow());
                }
            }
        }

        function createPlayerLayerRow() {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; align-items:center; gap:5px; padding:5px; margin:3px 0; background:#f0a; border-radius:4px; font-size:11px;';

            div.innerHTML = `
                <input type="checkbox" ${playerPreviewVisible ? 'checked' : ''} onclick="togglePlayerPreview()" title="Visibility">
                <span style="flex:1; color:#000;">🧍 PLAYER</span>
                <span style="color:#000; font-size:9px; opacity:0.7;">locked</span>
                <button onclick="movePlayerLayerUp()" style="padding:2px 5px; font-size:10px;">↑</button>
                <button onclick="movePlayerLayerDown()" style="padding:2px 5px; font-size:10px;">↓</button>
            `;
            return div;
        }

        function togglePlayerPreview() {
            playerPreviewVisible = !playerPreviewVisible;
            renderLayerList();
            renderMap();
        }

        function toggleSetSpawnMode() {
            setSpawnMode = !setSpawnMode;
            const btn = document.getElementById('setSpawnBtn');
            const canvas = document.getElementById('mapCanvas');

            if (setSpawnMode) {
                btn.classList.add('active');
                btn.textContent = 'CLICK MAP';
                canvas.style.cursor = 'crosshair';
            } else {
                btn.classList.remove('active');
                btn.textContent = 'SPAWN';
                canvas.style.cursor = grabToolActive ? 'grab' : 'crosshair';
            }
        }

        function movePlayerLayerUp() {
            if (playerLayerIndex > 0) {
                playerLayerIndex--;
                renderLayerList();
                renderMap();
            }
        }

        function movePlayerLayerDown() {
            if (playerLayerIndex < layers.length) {
                playerLayerIndex++;
                renderLayerList();
                renderMap();
            }
        }

        function renameLayer(index, newName = null, fromNetwork = false) {
            if (!fromNetwork) {
                const currentName = layerNames[index] || '';
                newName = prompt('Enter nickname for Layer ' + index + ':', currentName);
            }
            if (newName !== null) {
                layerNames[index] = newName.trim ? newName.trim() : newName;
                if (!fromNetwork) {
                    broadcastEdit({ editType: 'renameLayer', index: index, name: layerNames[index], mapName: currentMapName });
                }
                renderLayerList();
            }
        }

        function setMode(m) {
            mode = m;
            // Turn off edit modes when switching away from animProp
            if (m !== 'animProp') {
                if (editAnimPropOnMapMode) {
                    editAnimPropOnMapMode = false;
                    const btn = document.getElementById('editAnimPropOnMapBtn');
                    if (btn) {
                        btn.classList.remove('active');
                        btn.textContent = 'Edit Object on Map';
                    }
                }
                if (editStaticObjOnMapMode) {
                    editStaticObjOnMapMode = false;
                    const btn = document.getElementById('editStaticObjOnMapBtn');
                    if (btn) {
                        btn.classList.remove('active');
                        btn.style.background = '#4a7c59';
                        btn.textContent = 'Edit Static Object Collision';
                    }
                }
            }
            // Turn off fish-zone draw mode when leaving the Fishing tab so it can't keep
            // intercepting map drags / forcing redraws in other tools.
            if (m !== 'fish' && typeof settingFishZones !== 'undefined' && settingFishZones) {
                settingFishZones = false;
                fishZoneDragStart = null;
                fishZoneDragEnd = null;
                const fb = document.getElementById('setFishZonesBtn');
                if (fb) { fb.textContent = 'Add Zone'; fb.style.background = '#484'; }
            }
            // Sidebar tabs
            document.getElementById('tileMode').classList.toggle('active', m === 'tile');
            document.getElementById('playerMode').classList.toggle('active', m === 'player');
            document.getElementById('npcMode').classList.toggle('active', m === 'npc');
            document.getElementById('animPropMode').classList.toggle('active', m === 'animProp');
            document.getElementById('soundMode').classList.toggle('active', m === 'sound');
            document.getElementById('lightingMode').classList.toggle('active', m === 'lighting');
            document.getElementById('triggerMode').classList.toggle('active', m === 'trigger');
            document.getElementById('cameraMode').classList.toggle('active', m === 'camera');
            if (document.getElementById('fishMode')) document.getElementById('fishMode').classList.toggle('active', m === 'fish');
            document.getElementById('dialogMode').classList.toggle('active', m === 'dialog');
            document.getElementById('itemMode').classList.toggle('active', m === 'item');
            document.getElementById('questMode').classList.toggle('active', m === 'quest');
            document.getElementById('shopMode').classList.toggle('active', m === 'shop');
            // Toolbar tabs
            document.getElementById('tileMode2').classList.toggle('active', m === 'tile');
            if (document.getElementById('playerMode2')) document.getElementById('playerMode2').classList.toggle('active', m === 'player');
            document.getElementById('npcMode2').classList.toggle('active', m === 'npc');
            document.getElementById('animPropMode2').classList.toggle('active', m === 'animProp');
            document.getElementById('soundMode2').classList.toggle('active', m === 'sound');
            document.getElementById('lightingMode2').classList.toggle('active', m === 'lighting');
            document.getElementById('triggerMode2').classList.toggle('active', m === 'trigger');
            document.getElementById('cameraMode2').classList.toggle('active', m === 'camera');
            if (document.getElementById('fishMode2')) document.getElementById('fishMode2').classList.toggle('active', m === 'fish');
            document.getElementById('dialogMode2').classList.toggle('active', m === 'dialog');
            document.getElementById('itemMode2').classList.toggle('active', m === 'item');
            document.getElementById('questMode2').classList.toggle('active', m === 'quest');
            document.getElementById('shopMode2').classList.toggle('active', m === 'shop');
            document.getElementById('tileModeContent').style.display = m === 'tile' ? 'block' : 'none';
            document.getElementById('playerModeContent').style.display = m === 'player' ? 'block' : 'none';
            document.getElementById('npcModeContent').style.display = m === 'npc' ? 'block' : 'none';
            document.getElementById('animPropModeContent').style.display = m === 'animProp' ? 'block' : 'none';
            document.getElementById('soundModeContent').style.display = m === 'sound' ? 'block' : 'none';
            document.getElementById('lightingModeContent').style.display = m === 'lighting' ? 'block' : 'none';
            document.getElementById('triggerModeContent').style.display = m === 'trigger' ? 'block' : 'none';
            document.getElementById('cameraModeContent').style.display = m === 'camera' ? 'block' : 'none';
            if (document.getElementById('fishModeContent')) document.getElementById('fishModeContent').style.display = m === 'fish' ? 'block' : 'none';
            document.getElementById('dialogModeContent').style.display = m === 'dialog' ? 'block' : 'none';
            document.getElementById('itemModeContent').style.display = m === 'item' ? 'block' : 'none';
            document.getElementById('questModeContent').style.display = m === 'quest' ? 'block' : 'none';
            document.getElementById('shopModeContent').style.display = m === 'shop' ? 'block' : 'none';

            // Update mode label for mobile
            const labels = { tile: 'Tiles', player: 'Player', npc: 'NPCs', animProp: 'Animated', sound: 'Sounds', lighting: 'Lights', trigger: 'Triggers', camera: 'Camera', fish: 'Fishing', dialog: 'Dialogs', item: 'Items', quest: 'Quests', shop: 'Shops' };
            document.getElementById('currentModeLabel').textContent = labels[m] || m;

            // Collapse menu on mobile after selection
            document.getElementById('modeTabs').classList.remove('expanded');

            // Update lists when switching modes
            if (m === 'player') updatePlayerList();
            if (m === 'npc') updateNpcList();
            if (m === 'trigger') {
                updateMapDropdowns();
                updateTriggerList();
            }
            if (m === 'camera') {
                updateMapDropdowns();
                updateCameraBoundsInfo();
            }
            if (m === 'fish') {
                updateMapDropdowns();
                updateFishZonesInfo();
                renderFishingLoot();
            }
            if (m === 'dialog') {
                updateDialogList();
                updateDialogNpcDropdown();
            }
            if (m === 'item') {
                updateItemList();
                updateItemLayerDropdown();
            }
            if (m === 'quest') {
                renderQuestList();
                updateQuestNpcDropdowns();
            }
            if (m === 'shop') {
                updateShopList();
                updateNpcShopList();
            }

            // Redraw map to show appropriate overlays
            renderMap();
        }

        function toggleModeMenu() {
            document.getElementById('modeTabs').classList.toggle('expanded');
        }

        // Sidebar resize functionality
        (function() {
            const panel = document.getElementById('leftPanel');
            const handle = document.getElementById('sidebarResize');
            if (!panel || !handle) return;

            let isResizing = false;

            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                handle.classList.add('active');
                document.body.style.cursor = 'ew-resize';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                const newWidth = e.clientX;
                if (newWidth >= 100 && newWidth <= 600) {
                    panel.style.width = newWidth + 'px';
                }
            });

            document.addEventListener('mouseup', () => {
                isResizing = false;
                handle.classList.remove('active');
                document.body.style.cursor = '';
            });

            // Touch support for resize
            handle.addEventListener('touchstart', (e) => {
                isResizing = true;
                handle.classList.add('active');
                e.preventDefault();
            }, { passive: false });

            document.addEventListener('touchmove', (e) => {
                if (!isResizing) return;
                const touch = e.touches[0];
                const newWidth = touch.clientX;
                if (newWidth >= 100 && newWidth <= 600) {
                    panel.style.width = newWidth + 'px';
                }
            }, { passive: false });

            document.addEventListener('touchend', () => {
                isResizing = false;
                handle.classList.remove('active');
            });
        })();
