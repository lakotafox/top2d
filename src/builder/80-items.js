        // ========== ITEM EDITOR FUNCTIONS ==========
        let itemEditorImage = null;
        let itemEditorData = null;
        let itemEditorFrameW = 16;
        let itemEditorFrameH = 16;
        let itemEditorEditingIndex = -1;
        let itemEditorZoom = 3;

        function openItemEditor(editIndex = -1) {
            // Check if someone else is already editing this item
            if (editIndex >= 0 && isBeingEdited('item', editIndex)) {
                const editor = getEditor('item', editIndex);
                if (!confirm(`"${editor}" is currently editing this item.\n\nEditing simultaneously may cause conflicts.\n\nOpen anyway?`)) {
                    return;
                }
            }

            itemStopPreview();
            itemEditorEditingIndex = editIndex;

            // Broadcast that we're editing this item
            if (editIndex >= 0) {
                startEditing('item', editIndex);
            }

            itemFrames = [];

            if (editIndex >= 0 && items[editIndex]) {
                const item = items[editIndex];
                itemEditorFrameW = item.frameWidth || 16;
                itemEditorFrameH = item.frameHeight || 16;
                itemFrames = JSON.parse(JSON.stringify(item.frames || []));
                itemEditorData = item.spriteData;
                document.getElementById('itemNameInput').value = item.name;
                const fps = item.fps || 8;
                document.getElementById('itemSpeedSlider').value = fps;
                document.getElementById('itemSpeedLabel').textContent = fps + ' fps';

                if (item.spriteData) {
                    itemEditorImage = new Image();
                    itemEditorImage.onload = () => {
                        document.getElementById('itemFrameSection').style.display = 'block';
                        document.getElementById('itemIdleSection').style.display = 'block';
                        document.getElementById('itemNameSection').style.display = 'block';
                        document.getElementById('itemStackSection').style.display = 'block';
                        document.getElementById('itemBehaviorSection').style.display = 'block';
                        itemDrawCanvas();
                        itemUpdateFramesList();
                        itemUpdateIdleDropdown();
                        document.getElementById('itemIdleFrame').value = item.idleFrame || 0;
                        document.getElementById('itemMaxStack').value = item.maxStack || 99;
                        loadItemBehaviorFields(item);
                    };
                    itemEditorImage.src = item.spriteData;
                    document.getElementById('itemFileName').textContent = 'Sprite loaded';
                }
            } else {
                itemEditorImage = null;
                itemEditorData = null;
                itemEditorFrameW = gridSize;
                itemEditorFrameH = gridSize;
                itemFrames = [];
                document.getElementById('itemNameInput').value = '';
                document.getElementById('itemSpeedSlider').value = 8;
                document.getElementById('itemSpeedLabel').textContent = '8 fps';
                document.getElementById('itemFileName').textContent = '';
                document.getElementById('itemFrameSection').style.display = 'none';
                document.getElementById('itemIdleSection').style.display = 'none';
                document.getElementById('itemNameSection').style.display = 'none';
                document.getElementById('itemStackSection').style.display = 'none';
                document.getElementById('itemMaxStack').value = 99;
                document.getElementById('itemBehaviorSection').style.display = 'none';
                resetItemBehaviorFields();
                const previewCtx = document.getElementById('itemLivePreview').getContext('2d');
                previewCtx.clearRect(0, 0, 48, 48);
                const editorCanvas = document.getElementById('itemEditorCanvas');
                const editorCtx = editorCanvas.getContext('2d');
                editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
                const framesList = document.getElementById('itemFramesList');
                if (framesList) framesList.innerHTML = '';
                const fileInput = document.getElementById('itemFileInput');
                if (fileInput) fileInput.value = '';
            }

            document.getElementById('itemFrameW').value = itemEditorFrameW;
            document.getElementById('itemFrameH').value = itemEditorFrameH;
            itemUpdateFramesList();

            document.getElementById('itemModal').classList.add('visible');
        }

        function itemLoadSheet(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                itemEditorData = e.target.result;
                itemEditorImage = new Image();
                itemEditorImage.onload = () => {
                    document.getElementById('itemFileName').textContent = file.name + ' (' + itemEditorImage.naturalWidth + 'x' + itemEditorImage.naturalHeight + ')';
                    document.getElementById('itemFrameSection').style.display = 'block';
                    document.getElementById('itemIdleSection').style.display = 'block';
                    document.getElementById('itemNameSection').style.display = 'block';
                    document.getElementById('itemStackSection').style.display = 'block';
                    document.getElementById('itemBehaviorSection').style.display = 'block';

                    // Auto-suggest frame size
                    const w = itemEditorImage.naturalWidth;
                    const h = itemEditorImage.naturalHeight;
                    const sizes = [16, 32, 24, 48, 64];
                    for (const size of sizes) {
                        if (w % size === 0 && h % size === 0) {
                            itemEditorFrameW = size;
                            itemEditorFrameH = size;
                            break;
                        }
                    }
                    document.getElementById('itemFrameW').value = itemEditorFrameW;
                    document.getElementById('itemFrameH').value = itemEditorFrameH;

                    itemUpdateGrid();
                    itemDrawCanvas();
                };
                itemEditorImage.src = itemEditorData;
            };
            reader.readAsDataURL(file);
        }

        function itemUpdateGrid() {
            itemEditorFrameW = parseInt(document.getElementById('itemFrameW').value) || 16;
            itemEditorFrameH = parseInt(document.getElementById('itemFrameH').value) || 16;

            if (itemEditorImage) {
                const cols = Math.floor(itemEditorImage.naturalWidth / itemEditorFrameW);
                const rows = Math.floor(itemEditorImage.naturalHeight / itemEditorFrameH);
                document.getElementById('itemGridInfo').textContent = cols + ' cols x ' + rows + ' rows';
            }

            itemDrawCanvas();
        }

        function itemDrawCanvas() {
            const canvas = document.getElementById('itemEditorCanvas');
            const ctx = canvas.getContext('2d');

            if (!itemEditorImage) {
                canvas.width = 400;
                canvas.height = 300;
                ctx.fillStyle = '#222';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#666';
                ctx.font = '16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Load a sprite sheet to begin', 200, 150);
                return;
            }

            const scale = itemEditorZoom;
            canvas.width = itemEditorImage.naturalWidth * scale;
            canvas.height = itemEditorImage.naturalHeight * scale;

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(itemEditorImage, 0, 0, canvas.width, canvas.height);

            // Draw grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            const cols = Math.floor(itemEditorImage.naturalWidth / itemEditorFrameW);
            const rows = Math.floor(itemEditorImage.naturalHeight / itemEditorFrameH);

            for (let x = 0; x <= cols; x++) {
                ctx.beginPath();
                ctx.moveTo(x * itemEditorFrameW * scale, 0);
                ctx.lineTo(x * itemEditorFrameW * scale, canvas.height);
                ctx.stroke();
            }
            for (let y = 0; y <= rows; y++) {
                ctx.beginPath();
                ctx.moveTo(0, y * itemEditorFrameH * scale);
                ctx.lineTo(canvas.width, y * itemEditorFrameH * scale);
                ctx.stroke();
            }

            // Highlight selected frames
            ctx.strokeStyle = '#4f8';
            ctx.lineWidth = 3;
            itemFrames.forEach((frame, i) => {
                ctx.strokeRect(frame.x * scale + 2, frame.y * scale + 2, frame.w * scale - 4, frame.h * scale - 4);
                ctx.fillStyle = '#4f8';
                ctx.font = 'bold 14px sans-serif';
                ctx.fillText(i + 1, frame.x * scale + 6, frame.y * scale + 18);
            });

            // Draw drag selection box
            if (itemIsDragging && itemDragStart && itemDragEnd) {
                const startGX = Math.min(itemDragStart.gridX, itemDragEnd.gridX);
                const startGY = Math.min(itemDragStart.gridY, itemDragEnd.gridY);
                const endGX = Math.max(itemDragStart.gridX, itemDragEnd.gridX);
                const endGY = Math.max(itemDragStart.gridY, itemDragEnd.gridY);

                const selX = startGX * itemEditorFrameW * scale;
                const selY = startGY * itemEditorFrameH * scale;
                const selW = (endGX - startGX + 1) * itemEditorFrameW * scale;
                const selH = (endGY - startGY + 1) * itemEditorFrameH * scale;

                ctx.fillStyle = 'rgba(255, 200, 0, 0.3)';
                ctx.fillRect(selX, selY, selW, selH);
                ctx.strokeStyle = '#fc0';
                ctx.lineWidth = 3;
                ctx.strokeRect(selX, selY, selW, selH);
            }
        }

        // Legacy single-click handler (kept for backwards compat, but drag is preferred)
        function itemCanvasClick(e) {
            if (!itemEditorImage) return;
            const canvas = document.getElementById('itemEditorCanvas');
            const rect = canvas.getBoundingClientRect();
            const scale = itemEditorZoom;
            const x = Math.floor((e.clientX - rect.left) / (itemEditorFrameW * scale));
            const y = Math.floor((e.clientY - rect.top) / (itemEditorFrameH * scale));

            const frameX = x * itemEditorFrameW;
            const frameY = y * itemEditorFrameH;

            // Check if already selected
            const existingIdx = itemFrames.findIndex(f => f.x === frameX && f.y === frameY);
            if (existingIdx >= 0) {
                itemFrames.splice(existingIdx, 1);
            } else {
                itemFrames.push({ x: frameX, y: frameY, w: itemEditorFrameW, h: itemEditorFrameH });
            }

            itemDrawCanvas();
            itemUpdateFramesList();
            itemUpdateIdleDropdown();
            itemStartPreview();
        }

        function itemUpdateFramesList() {
            const container = document.getElementById('itemFramesList');
            const countEl = document.getElementById('itemFrameCount');
            if (!container) return;
            container.innerHTML = '';
            countEl.textContent = itemFrames.length;

            if (!itemEditorImage || itemFrames.length === 0) {
                container.innerHTML = '<span style="color:#666; font-size:11px;">Click frames on the sprite sheet</span>';
                return;
            }

            itemFrames.forEach((frame, i) => {
                const frameEl = document.createElement('div');
                frameEl.className = 'anim-frame-item';
                frameEl.innerHTML = `
                    <canvas width="32" height="32" style="border:1px solid #555; image-rendering:pixelated;"></canvas>
                    <span style="font-size:10px; color:#888;">${i + 1}</span>
                `;
                const canvas = frameEl.querySelector('canvas');
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(itemEditorImage, frame.x, frame.y, frame.w, frame.h, 0, 0, 32, 32);
                container.appendChild(frameEl);
            });
        }

        function itemUpdateIdleDropdown() {
            const select = document.getElementById('itemIdleFrame');
            if (!select) return;
            select.innerHTML = '';
            itemFrames.forEach((_, i) => {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = 'Frame ' + (i + 1) + (i === 0 ? ' (first)' : '');
                select.appendChild(opt);
            });
        }

        function itemClearFrames() {
            itemFrames = [];
            itemDrawCanvas();
            itemUpdateFramesList();
            itemUpdateIdleDropdown();
            itemStopPreview();
        }

        function itemStartPreview() {
            itemStopPreview();
            if (itemFrames.length === 0 || !itemEditorImage) return;
            const fps = parseInt(document.getElementById('itemSpeedSlider').value) || 8;
            itemPreviewPlaying = true;
            itemPreviewFrame = 0;
            itemPreviewInterval = setInterval(() => {
                itemPreviewFrame = (itemPreviewFrame + 1) % itemFrames.length;
                itemDrawPreviewFrame();
            }, 1000 / fps);
            itemDrawPreviewFrame();
        }

        function itemStopPreview() {
            if (itemPreviewInterval) {
                clearInterval(itemPreviewInterval);
                itemPreviewInterval = null;
            }
            itemPreviewPlaying = false;
        }

        function itemDrawPreviewFrame() {
            const canvas = document.getElementById('itemLivePreview');
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 48, 48);
            if (!itemEditorImage || itemFrames.length === 0) return;
            const frame = itemFrames[itemPreviewFrame];
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(itemEditorImage, frame.x, frame.y, frame.w, frame.h, 0, 0, 48, 48);
        }

        function itemUpdateSpeed() {
            const fps = document.getElementById('itemSpeedSlider').value;
            document.getElementById('itemSpeedLabel').textContent = fps + ' fps';
            if (itemPreviewPlaying) itemStartPreview();
        }

        function itemZoomIn() {
            itemEditorZoom = Math.min(8, itemEditorZoom + 1);
            document.getElementById('itemZoomLevel').textContent = itemEditorZoom + 'x';
            itemDrawCanvas();
        }

        function itemZoomOut() {
            itemEditorZoom = Math.max(1, itemEditorZoom - 1);
            document.getElementById('itemZoomLevel').textContent = itemEditorZoom + 'x';
            itemDrawCanvas();
        }

        function itemSave() {
            if (!itemEditorData || itemFrames.length === 0) {
                alert('Please load a sprite sheet and select animation frames.');
                return;
            }

            const name = document.getElementById('itemNameInput').value.trim() || 'Item ' + (items.length + 1);
            const fps = parseInt(document.getElementById('itemSpeedSlider').value) || 8;
            const idleFrame = parseInt(document.getElementById('itemIdleFrame').value) || 0;
            const maxStack = parseInt(document.getElementById('itemMaxStack').value) || 99;

            const itemData = {
                id: itemEditorEditingIndex >= 0 ? (items[itemEditorEditingIndex].id || 'item_' + itemEditorEditingIndex) : ('item_' + items.length),
                name: name,
                spriteData: itemEditorData,
                frameWidth: itemEditorFrameW,
                frameHeight: itemEditorFrameH,
                frames: JSON.parse(JSON.stringify(itemFrames)),
                fps: fps,
                idleFrame: idleFrame,
                maxStack: maxStack
            };
            Object.assign(itemData, readItemBehaviorFields());

            if (itemEditorEditingIndex >= 0) {
                items[itemEditorEditingIndex] = itemData;
                broadcastEdit({ editType: 'updateItem', index: itemEditorEditingIndex, item: itemData });
            } else {
                items.push(itemData);
                broadcastEdit({ editType: 'addItem', item: itemData });
            }

            itemStopPreview();
            document.getElementById('itemModal').classList.remove('visible');
            stopEditing(); // Clear editing lock
            updateItemList();
            renderMap();
        }

        // ===== Usable-item behavior (sword / boomerang) =====
        function itemBehaviorChanged() {
            const b = document.getElementById('itemBehavior').value;
            document.getElementById('itemBehaviorConfig').style.display = (b === 'none') ? 'none' : 'block';
            const isFishing = (b === 'fishingPole');
            // Fishing pole uses fish zones + the loot table, not damage/range/speed/anim-on-use.
            document.getElementById('itemAbilityDamageRow').style.display = isFishing ? 'none' : 'block';
            document.getElementById('itemAbilityRangeRow').style.display = isFishing ? 'none' : 'block';
            document.getElementById('itemAbilitySpeedRow').style.display = (b === 'boomerang') ? 'block' : 'none';
            document.getElementById('itemAbilityAnimRow').style.display = isFishing ? 'none' : 'block';
            document.getElementById('itemFishingNote').style.display = isFishing ? 'block' : 'none';
        }
        function readItemBehaviorFields() {
            const behavior = document.getElementById('itemBehavior').value || 'none';
            if (behavior === 'none') return { behavior: 'none' };
            return {
                behavior: behavior,
                abilityDamage: parseInt(document.getElementById('itemAbilityDamage').value) || 10,
                abilityRange: parseInt(document.getElementById('itemAbilityRange').value) || 180,
                abilitySpeed: parseInt(document.getElementById('itemAbilitySpeed').value) || 7,
                abilityAnim: (document.getElementById('itemAbilityAnim').value || '').trim()
            };
        }
        function loadItemBehaviorFields(item) {
            const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
            const txt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            set('itemBehavior', item.behavior || 'none');
            set('itemAbilityDamage', item.abilityDamage || 10); txt('itemAbilityDamageVal', item.abilityDamage || 10);
            set('itemAbilityRange', item.abilityRange || 180); txt('itemAbilityRangeVal', item.abilityRange || 180);
            set('itemAbilitySpeed', item.abilitySpeed || 7); txt('itemAbilitySpeedVal', item.abilitySpeed || 7);
            set('itemAbilityAnim', item.abilityAnim || '');
            itemBehaviorChanged();
        }
        function resetItemBehaviorFields() {
            const d = { behavior: 'none' };
            loadItemBehaviorFields(d);
        }

        function itemCancel() {
            itemStopPreview();
            document.getElementById('itemModal').classList.remove('visible');
            stopEditing(); // Clear editing lock
        }

        // Save item and keep modal open to create another from same sprite sheet
        function itemSaveAndContinue() {
            if (!itemEditorData || itemFrames.length === 0) {
                alert('Please load a sprite sheet and select animation frames.');
                return;
            }

            const name = document.getElementById('itemNameInput').value.trim() || 'Item ' + (items.length + 1);
            const fps = parseInt(document.getElementById('itemSpeedSlider').value) || 8;
            const idleFrame = parseInt(document.getElementById('itemIdleFrame').value) || 0;
            const maxStack = parseInt(document.getElementById('itemMaxStack').value) || 99;

            const itemData = {
                id: 'item_' + items.length,
                name: name,
                spriteData: itemEditorData,
                frameWidth: itemEditorFrameW,
                frameHeight: itemEditorFrameH,
                frames: JSON.parse(JSON.stringify(itemFrames)),
                fps: fps,
                idleFrame: idleFrame,
                maxStack: maxStack
            };
            Object.assign(itemData, readItemBehaviorFields());

            // Always add as new item (not editing)
            items.push(itemData);
            broadcastEdit({ editType: 'addItem', item: itemData });
            updateItemList();

            // Reset for next item - keep sprite sheet loaded
            document.getElementById('itemNameInput').value = 'Item ' + (items.length + 1);
            document.getElementById('itemIdleFrame').value = 0;
            document.getElementById('itemMaxStack').value = 99;
            itemFrames = []; // Clear selected frames
            itemEditorEditingIndex = -1; // Always creating new items now
            itemStopPreview();
            itemDrawCanvas(); // Redraw to show cleared selection

            console.log('[ITEM] Saved "' + name + '", ready to create another');
        }

        function updateItemLayerDropdown() {
            const select = document.getElementById('itemPlacementLayer');
            if (!select) return;
            const currentVal = parseInt(select.value) || 0;
            select.innerHTML = '';
            layers.forEach((layer, i) => {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = layerNames[i] || ('Layer ' + (i + 1));
                if (i === currentVal) opt.selected = true;
                select.appendChild(opt);
            });
            // Default to player layer if available
            if (currentVal === 0 && playerLayerIndex >= 0 && playerLayerIndex < layers.length) {
                select.value = playerLayerIndex;
            }
        }

        function updateItemList() {
            const container = document.getElementById('itemList');
            if (!container) return;
            container.innerHTML = '';

            if (items.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:11px; padding:10px;">No items yet</div>';
                return;
            }

            items.forEach((item, i) => {
                const itemEl = document.createElement('div');
                const isSelected = (currentItemIndex === i);
                itemEl.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px; background:' + (isSelected ? '#3a4a3a' : '#333') + '; border:2px solid ' + (isSelected ? '#4f8' : 'transparent') + '; border-radius:5px; margin-bottom:5px; cursor:pointer;';
                itemEl.onclick = () => { currentItemIndex = i; updateItemList(); };

                // Preview thumbnail
                if (item.frames && item.frames.length > 0) {
                    const canvas = document.createElement('canvas');
                    canvas.width = 32;
                    canvas.height = 32;
                    canvas.style.cssText = 'border:1px solid #555; image-rendering:pixelated;';
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = false;

                    const idleIdx = item.idleFrame || 0;
                    const frame = item.frames[idleIdx] || item.frames[0];
                    if (item._spriteImg) {
                        ctx.drawImage(item._spriteImg, frame.x, frame.y, frame.w, frame.h, 0, 0, 32, 32);
                    } else if (item.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            item._spriteImg = img;
                            ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, 32, 32);
                        };
                        img.src = item.spriteData;
                    }
                    itemEl.appendChild(canvas);
                }

                // Name and info
                const info = document.createElement('div');
                info.innerHTML = `<div style="font-weight:bold; color:#4f8;">${item.name}</div>
                    <div style="font-size:10px; color:#888;">${item.frames?.length || 0} frames</div>`;
                itemEl.appendChild(info);

                // Edit/Delete buttons
                const btns = document.createElement('div');
                btns.style.cssText = 'margin-left:auto; display:flex; gap:5px;';
                btns.innerHTML = `
                    <button onclick="event.stopPropagation(); openItemEditor(${i})" style="padding:3px 6px; font-size:10px;">Edit</button>
                    <button onclick="event.stopPropagation(); deleteItem(${i})" style="padding:3px 6px; font-size:10px; background:#a55;">×</button>
                `;
                itemEl.appendChild(btns);

                container.appendChild(itemEl);
            });
        }

        function deleteItem(index) {
            // Wave 5: warn about downstream references that will be cleaned up.
            const placedCount = placedItems.filter(p => p && p.itemIndex === index).length;
            const shopRefs = Array.isArray(shops) ? shops.reduce((n, s) => {
                if (!s) return n;
                const inv = (s.inventory || []).filter(i => i && i.itemIndex === index).length;
                const buy = (s.buyList || []).filter(i => i && i.itemIndex === index).length;
                return n + inv + buy;
            }, 0) : 0;
            const msg = (placedCount || shopRefs)
                ? `Delete this item?\n\n${placedCount} placed instance(s) and ${shopRefs} shop entry/entries will also be cleaned up.`
                : 'Delete this item?';
            if (!confirm(msg)) return;
            items.splice(index, 1);
            // Wave 5: reindex all downstream refs (placedItems, shops, animProps, NPC drops).
            reindexItemReferences(index);
            // itemImages object-map: delete + shift higher keys.
            if (typeof itemImages !== 'undefined') {
                delete itemImages[index];
                const keys = Object.keys(itemImages).map(k => parseInt(k, 10)).filter(Number.isFinite).sort((a,b)=>a-b);
                for (const k of keys) {
                    if (k > index) { itemImages[k - 1] = itemImages[k]; delete itemImages[k]; }
                }
            }
            broadcastEdit({ editType: 'deleteItem', index: index });
            if (currentItemIndex >= items.length) currentItemIndex = items.length - 1;
            updateItemList();
            if (typeof updatePlacedItemsList === 'function') updatePlacedItemsList();
            if (typeof updateShopList === 'function') updateShopList();
            renderMap();
        }

        function updatePlacedItemsList() {
            const container = document.getElementById('placedItemsList');
            if (!container) return;

            const currentMapItems = placedItems.filter(p => !p.mapName || p.mapName === currentMapName);

            if (currentMapItems.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:11px; text-align:center; padding:10px;">No items placed</div>';
                return;
            }

            container.innerHTML = '';
            currentMapItems.forEach((placed, i) => {
                const item = items[placed.itemIndex];
                if (!item) return;
                const realIdx = placedItems.indexOf(placed);
                const div = document.createElement('div');
                div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid #333;';
                div.innerHTML = `
                    <span style="color:#4f8;">${item.name}</span>
                    <span style="font-size:10px; color:#888;">(${placed.x}, ${placed.y})</span>
                    <button onclick="removePlacedItem(${realIdx})" style="padding:2px 6px; font-size:9px; background:#a55;">×</button>
                `;
                container.appendChild(div);
            });
        }

        function removePlacedItem(index) {
            const item = placedItems[index];
            if (item) {
                broadcastEdit({ editType: 'removeItem', x: item.x, y: item.y, mapName: item.mapName || currentMapName });
            }
            placedItems.splice(index, 1);
            updatePlacedItemsList();
            renderMap();
        }

        // Find an interactive anim prop (with giveItem) at the given map coordinates
        // placedAnimProps is a STALE all-maps registry (placement writes animTile cells into `layers`,
        // not this array; legacy entries also lack mapName). Verify a real animTile cell actually exists
        // at these coords on the CURRENT map's layers. Prevents cross-map phantom highlight boxes/hit-tests.
        function animTileCellExistsAt(x, y) {
            for (let li = 0; li < layers.length; li++) {
                const layer = layers[li];
                if (layer && layer[y] && layer[y][x] && layer[y][x].type === 'animTile') return true;
            }
            return false;
        }

        function findInteractivePropAt(x, y) {
            for (let i = 0; i < placedAnimProps.length; i++) {
                const placed = placedAnimProps[i];
                if (placed.mapName && placed.mapName !== currentMapName) continue;
                if (!animTileCellExistsAt(placed.x, placed.y)) continue;

                const prop = animatedProps[placed.propIndex];
                if (!prop || !prop.giveItem) continue;

                // Calculate prop bounds
                const frames = prop.frames || [];
                if (frames.length === 0) continue;
                const frame = frames[0];
                const tilesW = Math.ceil(frame.w / gridSize);
                const tilesH = Math.ceil(frame.h / gridSize);

                // Check if click is within prop bounds
                if (x >= placed.x && x < placed.x + tilesW &&
                    y >= placed.y && y < placed.y + tilesH) {
                    return i;
                }
            }
            return -1;
        }

        // Open a popup to assign an item to a specific placed prop instance
        function openPropItemAssignment(placedPropIndex) {
            const placed = placedAnimProps[placedPropIndex];
            if (!placed) return;

            const prop = animatedProps[placed.propIndex];
            if (!prop) return;

            // Build item options
            let itemOptions = '<option value="-1">(Use default: ' + (items[prop.giveItemIndex]?.name || 'None') + ')</option>';
            items.forEach((item, idx) => {
                const selected = placed.instanceItemIndex === idx ? ' selected' : '';
                itemOptions += '<option value="' + idx + '"' + selected + '>' + item.name + '</option>';
            });

            // Create simple popup
            const popup = document.createElement('div');
            popup.id = 'propItemAssignPopup';
            popup.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#2a2a3a; padding:20px; border-radius:8px; border:2px solid #fa0; z-index:10000; min-width:300px;';
            popup.innerHTML = `
                <div style="color:#fa0; font-weight:bold; margin-bottom:15px; font-size:14px;">
                    📦 Assign Item to: ${prop.name}
                </div>
                <div style="margin-bottom:15px;">
                    <label style="color:#ccc; display:block; margin-bottom:5px;">Item to give:</label>
                    <select id="propInstanceItemSelect" style="width:100%; padding:8px; background:#1a1a2a; color:#fff; border:1px solid #555; border-radius:4px;">
                        ${itemOptions}
                    </select>
                </div>
                <div style="display:flex; gap:10px; justify-content:flex-end;">
                    <button onclick="closePropItemAssignment()" style="padding:8px 16px; background:#555; color:#fff; border:none; border-radius:4px; cursor:pointer;">Cancel</button>
                    <button onclick="savePropItemAssignment(${placedPropIndex})" style="padding:8px 16px; background:#fa0; color:#000; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Save</button>
                </div>
            `;
            document.body.appendChild(popup);

            // Add backdrop
            const backdrop = document.createElement('div');
            backdrop.id = 'propItemAssignBackdrop';
            backdrop.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:9999;';
            backdrop.onclick = closePropItemAssignment;
            document.body.appendChild(backdrop);
        }

        function closePropItemAssignment() {
            const popup = document.getElementById('propItemAssignPopup');
            const backdrop = document.getElementById('propItemAssignBackdrop');
            if (popup) popup.remove();
            if (backdrop) backdrop.remove();
        }

        function savePropItemAssignment(placedPropIndex) {
            const select = document.getElementById('propInstanceItemSelect');
            if (!select) return;

            const itemIdx = parseInt(select.value);
            const placed = placedAnimProps[placedPropIndex];
            if (!placed) return;

            if (itemIdx < 0) {
                // Clear instance override (use default)
                delete placed.instanceItemIndex;
            } else {
                placed.instanceItemIndex = itemIdx;
            }

            // Broadcast to co-op builders
            broadcastEdit({ editType: 'updatePlacedAnimProp', index: placedPropIndex, prop: placed });

            closePropItemAssignment();
            renderMap();
        }

        function placeItemAt(x, y) {
            if (x < 0 || y < 0 || x >= mapCols || y >= mapRows) return;
            if (currentItemIndex < 0 || !items[currentItemIndex]) return;

            // Get selected layer from dropdown
            const layerSelect = document.getElementById('itemPlacementLayer');
            const itemLayer = layerSelect ? parseInt(layerSelect.value) : 0;

            // Check if item already exists at this position on same layer
            const existingIdx = placedItems.findIndex(p =>
                p.x === x && p.y === y &&
                (!p.mapName || p.mapName === currentMapName) &&
                p.layer === itemLayer
            );
            if (existingIdx >= 0) return; // Don't stack items

            const newItem = {
                itemIndex: currentItemIndex,
                x: x,
                y: y,
                layer: itemLayer,
                mapName: currentMapName,
                used: false
            };
            placedItems.push(newItem);

            // Broadcast to co-op builders
            broadcastEdit({ editType: 'placeItem', item: newItem, index: placedItems.length - 1 });

            updatePlacedItemsList();
            renderMap();
        }

        function removeItemAt(x, y) {
            const idx = placedItems.findIndex(p =>
                p.x === x && p.y === y &&
                (!p.mapName || p.mapName === currentMapName)
            );
            if (idx >= 0) {
                placedItems.splice(idx, 1);
                // Broadcast to co-op builders
                broadcastEdit({ editType: 'removeItem', x: x, y: y, mapName: currentMapName });
                updatePlacedItemsList();
                renderMap();
            }
        }

        // Initialize item editor canvas with drag selection handlers
        document.addEventListener('DOMContentLoaded', () => {
            const itemCanvas = document.getElementById('itemEditorCanvas');
            if (itemCanvas) {
                itemCanvas.addEventListener('mousedown', function(e) {
                    if (!itemEditorImage) return;
                    const rect = this.getBoundingClientRect();
                    const scale = itemEditorZoom;
                    const gridX = Math.floor((e.clientX - rect.left) / (itemEditorFrameW * scale));
                    const gridY = Math.floor((e.clientY - rect.top) / (itemEditorFrameH * scale));
                    itemDragStart = { gridX, gridY };
                    itemDragEnd = { gridX, gridY };
                    itemIsDragging = true;
                    itemDrawCanvas();
                });

                itemCanvas.addEventListener('mousemove', function(e) {
                    if (!itemIsDragging || !itemEditorImage) return;
                    const rect = this.getBoundingClientRect();
                    const scale = itemEditorZoom;
                    const gridX = Math.floor((e.clientX - rect.left) / (itemEditorFrameW * scale));
                    const gridY = Math.floor((e.clientY - rect.top) / (itemEditorFrameH * scale));
                    itemDragEnd = { gridX, gridY };
                    itemDrawCanvas();
                });

                itemCanvas.addEventListener('mouseup', function(e) {
                    if (!itemIsDragging || !itemEditorImage) return;
                    itemIsDragging = false;

                    if (itemDragStart && itemDragEnd) {
                        const startGX = Math.min(itemDragStart.gridX, itemDragEnd.gridX);
                        const startGY = Math.min(itemDragStart.gridY, itemDragEnd.gridY);
                        const endGX = Math.max(itemDragStart.gridX, itemDragEnd.gridX);
                        const endGY = Math.max(itemDragStart.gridY, itemDragEnd.gridY);

                        // Add all frames in the selection as a single multi-tile frame
                        const frameX = startGX * itemEditorFrameW;
                        const frameY = startGY * itemEditorFrameH;
                        const frameW = (endGX - startGX + 1) * itemEditorFrameW;
                        const frameH = (endGY - startGY + 1) * itemEditorFrameH;

                        // Check if already exists
                        const existingIdx = itemFrames.findIndex(f => f.x === frameX && f.y === frameY && f.w === frameW && f.h === frameH);
                        if (existingIdx >= 0) {
                            itemFrames.splice(existingIdx, 1);
                        } else {
                            itemFrames.push({ x: frameX, y: frameY, w: frameW, h: frameH });
                        }

                        itemUpdateFramesList();
                        itemUpdateIdleDropdown();
                        itemStartPreview();
                    }

                    itemDragStart = null;
                    itemDragEnd = null;
                    itemDrawCanvas();
                });

                itemCanvas.addEventListener('mouseleave', function() {
                    if (itemIsDragging) {
                        itemIsDragging = false;
                        itemDragStart = null;
                        itemDragEnd = null;
                        itemDrawCanvas();
                    }
                });
            }
        });

        function updateAnimPropScale() {
            const scale = parseFloat(document.getElementById('animPropScale').value) || 1;
            currentAnimPropScale = scale;
            document.getElementById('animPropScaleValue').textContent = scale.toFixed(2) + 'x';
            renderMap(); // Update preview
        }

        function toggleEditAnimPropMode() {
            editAnimPropOnMapMode = !editAnimPropOnMapMode;
            const btn = document.getElementById('editAnimPropOnMapBtn');
            if (editAnimPropOnMapMode) {
                btn.classList.add('active');
                btn.textContent = '✓ Click Prop to Edit';
            } else {
                btn.classList.remove('active');
                btn.textContent = 'Edit Object on Map';
            }
            renderMap();
        }

        // Find placed animated prop at map position
        function findAnimPropAt(x, y) {
            // Search all layers for animTile at this position
            for (let li = 0; li < layers.length; li++) {
                const layer = layers[li];
                if (!layer || !layer[y] || !layer[y][x]) continue;
                const cell = layer[y][x];
                if (cell && cell.type === 'animTile') {
                    // Return origin position for multi-tile props
                    const originX = x - (cell.offsetX || 0);
                    const originY = y - (cell.offsetY || 0);
                    return { x: originX, y: originY, layer: li, cell: layer[originY][originX] };
                }
            }
            return null;
        }

        // Open popup to edit placed animated prop timing
        function openAnimPropEditPopup(propInfo) {
            const { x, y, layer, cell } = propInfo;
            const prop = animatedProps[cell.propIndex];
            if (!prop) return;

            // Get current instance settings or defaults
            const currentMode = cell.instancePlayMode || 'default';
            const currentPlayCount = cell.instancePlayCount || 1;
            const currentWaitTime = cell.instanceWaitTime || 2;
            const currentSpeed = cell.instanceSpeed !== undefined ? cell.instanceSpeed : 1;
            const currentScale = cell.scale !== undefined ? cell.scale : 1;
            const currentMirror = !!cell.mirror;
            const currentNudgeX = cell.nudgeX || 0;
            const currentNudgeY = cell.nudgeY || 0;

            const popup = document.createElement('div');
            popup.id = 'animPropEditPopup';
            popup.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#2a2a3a; padding:20px; border-radius:8px; border:2px solid #fa0; z-index:10000; width:500px; max-width:90vw;';

            let html = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">';
            html += '<div style="color:#fa0; font-weight:bold; font-size:14px;">Edit: ' + prop.name + '</div>';
            html += '<button onclick="closeAnimPropEditPopup()" style="background:none; border:none; color:#888; font-size:18px; cursor:pointer;">&times;</button>';
            html += '</div>';

            html += '<div style="display:flex; gap:20px;">';

            // Left column - Scale and Speed
            html += '<div style="flex:1;">';
            html += '<div style="margin-bottom:12px;">';
            html += '<label style="color:#ccc; display:block; margin-bottom:5px;">Scale:</label>';
            html += '<div style="display:flex; align-items:center; gap:10px;">';
            html += '<input type="range" id="editAnimScale" min="0.25" max="4" step="0.25" value="' + currentScale + '" style="flex:1;" oninput="document.getElementById(\'scaleValue\').textContent = this.value + \'x\'; previewAnimPropScale(' + x + ', ' + y + ', ' + layer + ', this.value)">';
            html += '<span id="scaleValue" style="color:#4af; min-width:40px;">' + currentScale + 'x</span>';
            html += '</div></div>';
            html += '<div style="margin-bottom:12px;">';
            html += '<label style="color:#ccc; display:block; margin-bottom:5px;">Animation Speed:</label>';
            html += '<div style="display:flex; align-items:center; gap:10px;">';
            html += '<input type="range" id="editAnimSpeed" min="0.25" max="3" step="0.25" value="' + currentSpeed + '" style="flex:1;" oninput="document.getElementById(\'speedValue\').textContent = this.value + \'x\'">';
            html += '<span id="speedValue" style="color:#4af; min-width:40px;">' + currentSpeed + 'x</span>';
            html += '</div></div>';
            html += '<div style="margin-bottom:4px;">';
            html += '<label style="color:#ccc; display:flex; align-items:center; gap:8px; cursor:pointer;">';
            html += '<input type="checkbox" id="editAnimMirror"' + (currentMirror ? ' checked' : '') + ' onchange="previewAnimPropMirror(' + x + ', ' + y + ', ' + layer + ', this.checked)"> Mirror (flip horizontally)';
            html += '</label></div>';
            html += '<div style="margin-top:10px;">';
            html += '<label style="color:#ccc; display:block; margin-bottom:5px;">Fine position (px) — collision follows:</label>';
            html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">';
            html += '<span style="color:#888; width:12px;">X</span>';
            html += '<input type="range" id="editAnimNudgeX" min="' + (-gridSize) + '" max="' + gridSize + '" step="1" value="' + currentNudgeX + '" style="flex:1;" oninput="document.getElementById(\'nudgeXValue\').textContent = this.value; previewAnimPropNudge(' + x + ', ' + y + ', ' + layer + ')">';
            html += '<span id="nudgeXValue" style="color:#4af; min-width:26px;">' + currentNudgeX + '</span>';
            html += '</div>';
            html += '<div style="display:flex; align-items:center; gap:8px;">';
            html += '<span style="color:#888; width:12px;">Y</span>';
            html += '<input type="range" id="editAnimNudgeY" min="' + (-gridSize) + '" max="' + gridSize + '" step="1" value="' + currentNudgeY + '" style="flex:1;" oninput="document.getElementById(\'nudgeYValue\').textContent = this.value; previewAnimPropNudge(' + x + ', ' + y + ', ' + layer + ')">';
            html += '<span id="nudgeYValue" style="color:#4af; min-width:26px;">' + currentNudgeY + '</span>';
            html += '</div></div>';
            html += '</div>';

            // Right column - Animation Mode
            html += '<div style="flex:1;">';
            html += '<div style="margin-bottom:12px;">';
            html += '<label style="color:#ccc; display:block; margin-bottom:5px;">Animation Mode:</label>';
            html += '<select id="editAnimMode" style="width:100%; padding:8px; background:#1a1a2a; color:#fff; border:1px solid #555; border-radius:4px;" onchange="updateAnimEditPopup()">';
            html += '<option value="default"' + (currentMode === 'default' ? ' selected' : '') + '>Default (from prop)</option>';
            html += '<option value="loop"' + (currentMode === 'loop' ? ' selected' : '') + '>Loop Forever</option>';
            html += '<option value="timed"' + (currentMode === 'timed' ? ' selected' : '') + '>Timed</option>';
            html += '</select></div>';
            html += '<div id="timedSettings" style="display:' + (currentMode === 'timed' ? 'block' : 'none') + '; background:#1a1a2a; padding:10px; border-radius:4px;">';
            html += '<div style="margin-bottom:8px;"><label style="color:#aaa; font-size:11px;">Play animation:</label>';
            html += '<div style="display:flex; align-items:center; gap:5px; margin-top:3px;">';
            html += '<input type="number" id="editPlayCount" value="' + currentPlayCount + '" min="1" max="10" style="width:50px; padding:5px; background:#222; color:#4af; border:1px solid #555; border-radius:3px;">';
            html += '<span style="color:#888;">time(s)</span></div></div>';
            html += '<div><label style="color:#aaa; font-size:11px;">Then wait:</label>';
            html += '<div style="display:flex; align-items:center; gap:5px; margin-top:3px;">';
            html += '<input type="number" id="editWaitTime" value="' + currentWaitTime + '" min="0.5" max="60" step="0.5" style="width:60px; padding:5px; background:#222; color:#4af; border:1px solid #555; border-radius:3px;">';
            html += '<span style="color:#888;">seconds</span></div></div></div>';
            html += '</div>';

            html += '</div>'; // End flex container

            html += '<div style="display:flex; gap:10px; justify-content:flex-end; align-items:center; margin-top:15px; padding-top:15px; border-top:1px solid #444;">';
            html += '<button onclick="deleteAnimPropOnMap(' + x + ', ' + y + ', ' + layer + ')" style="padding:8px 20px; background:#a33; color:#fff; border:none; border-radius:4px; cursor:pointer; margin-right:auto;">🗑 Delete</button>';
            html += '<button onclick="closeAnimPropEditPopup()" style="padding:8px 20px; background:#555; color:#fff; border:none; border-radius:4px; cursor:pointer;">Cancel</button>';
            html += '<button onclick="saveAnimPropEdit(' + x + ', ' + y + ', ' + layer + ')" style="padding:8px 20px; background:#fa0; color:#000; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Save</button>';
            html += '</div>';

            popup.innerHTML = html;
            document.body.appendChild(popup);

            // Add backdrop (semi-transparent, doesn't block view much)
            const backdrop = document.createElement('div');
            backdrop.id = 'animPropEditBackdrop';
            backdrop.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.3); z-index:9999;';
            backdrop.onclick = closeAnimPropEditPopup;
            document.body.appendChild(backdrop);
        }

        function updateAnimEditPopup() {
            const mode = document.getElementById('editAnimMode').value;
            document.getElementById('timedSettings').style.display = mode === 'timed' ? 'block' : 'none';
        }

        function closeAnimPropEditPopup() {
            const popup = document.getElementById('animPropEditPopup');
            const backdrop = document.getElementById('animPropEditBackdrop');
            if (popup) popup.remove();
            if (backdrop) backdrop.remove();
        }

        function previewAnimPropScale(originX, originY, layerIdx, scaleValue) {
            const scale = parseFloat(scaleValue) || 1;
            const layer = layers[layerIdx];
            if (!layer || !layer[originY] || !layer[originY][originX]) return;

            const cell = layer[originY][originX];
            if (!cell || cell.type !== 'animTile') return;

            // Temporarily update scale on origin cell
            if (scale === 1) {
                delete cell.scale;
            } else {
                cell.scale = scale;
            }

            // Propagate scale to all tiles of multi-tile prop.
            // NOTE: tilesW/tilesH live on the CELL (set at placement), NOT on the prop definition.
            const tilesW = cell.tilesW || 1;
            const tilesH = cell.tilesH || 1;
            if (tilesW > 1 || tilesH > 1) {
                for (let ty = 0; ty < tilesH; ty++) {
                    for (let tx = 0; tx < tilesW; tx++) {
                        if (tx === 0 && ty === 0) continue;
                        const tileX = originX + tx;
                        const tileY = originY + ty;
                        if (layer[tileY] && layer[tileY][tileX] && layer[tileY][tileX].type === 'animTile') {
                            if (scale === 1) {
                                delete layer[tileY][tileX].scale;
                            } else {
                                layer[tileY][tileX].scale = scale;
                            }
                        }
                    }
                }
            }

            renderMap();
        }

        // Live-preview a per-instance horizontal mirror (applies to all tiles of the prop).
        function previewAnimPropMirror(originX, originY, layerIdx, checked) {
            const layer = layers[layerIdx];
            if (!layer || !layer[originY] || !layer[originY][originX]) return;
            const cell = layer[originY][originX];
            if (!cell || cell.type !== 'animTile') return;
            const apply = (c) => { if (checked) c.mirror = true; else delete c.mirror; };
            apply(cell);
            const tilesW = cell.tilesW || 1;
            const tilesH = cell.tilesH || 1;
            if (tilesW > 1 || tilesH > 1) {
                for (let ty = 0; ty < tilesH; ty++) {
                    for (let tx = 0; tx < tilesW; tx++) {
                        if (tx === 0 && ty === 0) continue;
                        const c = layer[originY + ty] && layer[originY + ty][originX + tx];
                        if (c && c.type === 'animTile') apply(c);
                    }
                }
            }
            renderMap();
        }

        // Live-preview a per-instance pixel nudge (applies to all tiles of the prop).
        function previewAnimPropNudge(originX, originY, layerIdx) {
            const layer = layers[layerIdx];
            if (!layer || !layer[originY] || !layer[originY][originX]) return;
            const cell = layer[originY][originX];
            if (!cell || cell.type !== 'animTile') return;
            const nx = parseInt(document.getElementById('editAnimNudgeX').value) || 0;
            const ny = parseInt(document.getElementById('editAnimNudgeY').value) || 0;
            const apply = (c) => { if (nx) c.nudgeX = nx; else delete c.nudgeX; if (ny) c.nudgeY = ny; else delete c.nudgeY; };
            apply(cell);
            const tilesW = cell.tilesW || 1, tilesH = cell.tilesH || 1;
            if (tilesW > 1 || tilesH > 1) {
                for (let ty = 0; ty < tilesH; ty++) for (let tx = 0; tx < tilesW; tx++) {
                    if (tx === 0 && ty === 0) continue;
                    const c = layer[originY + ty] && layer[originY + ty][originX + tx];
                    if (c && c.type === 'animTile') apply(c);
                }
            }
            renderMap();
        }

        function saveAnimPropEdit(originX, originY, layerIdx) {
            const mode = document.getElementById('editAnimMode').value;
            const playCount = parseInt(document.getElementById('editPlayCount').value) || 1;
            const waitTime = parseFloat(document.getElementById('editWaitTime').value) || 2;
            const speed = parseFloat(document.getElementById('editAnimSpeed').value) || 1;
            const scale = parseFloat(document.getElementById('editAnimScale').value) || 1;
            const mirrorEl = document.getElementById('editAnimMirror');
            const mirror = mirrorEl ? mirrorEl.checked : false;
            const nudgeXEl = document.getElementById('editAnimNudgeX');
            const nudgeYEl = document.getElementById('editAnimNudgeY');
            const nudgeX = nudgeXEl ? (parseInt(nudgeXEl.value) || 0) : 0;
            const nudgeY = nudgeYEl ? (parseInt(nudgeYEl.value) || 0) : 0;

            const layer = layers[layerIdx];
            if (!layer || !layer[originY] || !layer[originY][originX]) return;

            const cell = layer[originY][originX];
            if (!cell || cell.type !== 'animTile') return;

            // Update instance scale
            if (scale === 1) {
                delete cell.scale;
            } else {
                cell.scale = scale;
            }

            // Update instance mirror
            if (mirror) cell.mirror = true; else delete cell.mirror;

            // Update instance pixel nudge (fine-position; collision follows)
            if (nudgeX) cell.nudgeX = nudgeX; else delete cell.nudgeX;
            if (nudgeY) cell.nudgeY = nudgeY; else delete cell.nudgeY;

            // Update instance speed
            if (speed === 1) {
                delete cell.instanceSpeed;
            } else {
                cell.instanceSpeed = speed;
            }

            // Update instance settings
            if (mode === 'default') {
                delete cell.instancePlayMode;
                delete cell.instancePlayCount;
                delete cell.instanceWaitTime;
            } else {
                cell.instancePlayMode = mode;
                if (mode === 'timed') {
                    cell.instancePlayCount = playCount;
                    cell.instanceWaitTime = waitTime;
                } else {
                    delete cell.instancePlayCount;
                    delete cell.instanceWaitTime;
                }
            }

            // Propagate scale to all tiles of multi-tile prop.
            // NOTE: tilesW/tilesH live on the CELL (set at placement), NOT on the prop definition.
            const tilesW = cell.tilesW || 1;
            const tilesH = cell.tilesH || 1;
            if (tilesW > 1 || tilesH > 1) {
                for (let ty = 0; ty < tilesH; ty++) {
                    for (let tx = 0; tx < tilesW; tx++) {
                        if (tx === 0 && ty === 0) continue; // Skip origin, already updated
                        const tileX = originX + tx;
                        const tileY = originY + ty;
                        if (layer[tileY] && layer[tileY][tileX] && layer[tileY][tileX].type === 'animTile') {
                            const tc = layer[tileY][tileX];
                            if (scale === 1) { delete tc.scale; } else { tc.scale = scale; }
                            if (mirror) { tc.mirror = true; } else { delete tc.mirror; }
                            if (nudgeX) { tc.nudgeX = nudgeX; } else { delete tc.nudgeX; }
                            if (nudgeY) { tc.nudgeY = nudgeY; } else { delete tc.nudgeY; }
                        }
                    }
                }
            }

            // Reset animation state for this prop
            const key = originX + ',' + originY + ',' + layerIdx;
            delete placedAnimPropFrames[key];

            // Broadcast to co-op
            broadcastEdit({ editType: 'tile', layer: layerIdx, x: originX, y: originY, cell: cell, mapName: currentMapName });

            closeAnimPropEditPopup();
            renderMap();
        }

        // Delete a placed anim prop (and all its tiles) from the map — handy for clearing
        // invisible/orphaned props that can't be erased any other way.
        function deleteAnimPropOnMap(originX, originY, layerIdx) {
            const layer = layers[layerIdx];
            if (!layer || !layer[originY] || !layer[originY][originX]) { closeAnimPropEditPopup(); return; }
            const cell = layer[originY][originX];
            if (!cell || cell.type !== 'animTile') { closeAnimPropEditPopup(); return; }
            const tilesW = cell.tilesW || 1;
            const tilesH = cell.tilesH || 1;
            // Clear every tile of this prop (set to null = empty) + broadcast each erase.
            for (let ty = 0; ty < tilesH; ty++) {
                for (let tx = 0; tx < tilesW; tx++) {
                    const cx = originX + tx, cy = originY + ty;
                    if (layer[cy] && layer[cy][cx] && layer[cy][cx].type === 'animTile') {
                        layer[cy][cx] = null;
                        broadcastEdit({ editType: 'eraseTile', layer: layerIdx, x: cx, y: cy, mapName: currentMapName });
                    }
                }
            }
            delete placedAnimPropFrames[originX + ',' + originY + ',' + layerIdx];
            closeAnimPropEditPopup();
            renderMap();
        }
