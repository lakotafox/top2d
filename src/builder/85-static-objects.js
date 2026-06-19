        // ===== STATIC OBJECT EDIT MODE =====
        function toggleEditStaticObjMode() {
            editStaticObjOnMapMode = !editStaticObjOnMapMode;
            const btn = document.getElementById('editStaticObjOnMapBtn');
            if (editStaticObjOnMapMode) {
                btn.classList.add('active');
                btn.style.background = '#8fc99a';
                btn.textContent = '✓ Click Static Object to Edit';
                // Deselect current object to prevent placing while editing
                currentStaticObjIndex = -1;
                updateStaticObjectsList();
            } else {
                btn.classList.remove('active');
                btn.style.background = '#4a7c59';
                btn.textContent = 'Edit Static Object Collision';
            }
            renderMap();
        }

        // Find placed static object at map position
        function findStaticObjAt(gridX, gridY) {
            // Search from top to bottom (last placed = on top)
            for (let i = placedStaticObjects.length - 1; i >= 0; i--) {
                const placed = placedStaticObjects[i];
                if (placed.mapName !== currentMapName) continue;

                const obj = staticObjects[placed.objIndex];
                if (!obj) continue;

                const scale = placed.scale || 1;
                const w = obj.width * scale;
                const h = obj.height * scale;

                if (gridX >= placed.x && gridX < placed.x + w &&
                    gridY >= placed.y && gridY < placed.y + h) {
                    return { placed, index: i };
                }
            }
            return null;
        }

        // Open popup to edit placed static object collision box
        function openStaticObjEditPopup(placedInfo) {
            const { placed, index } = placedInfo;
            const obj = staticObjects[placed.objIndex];
            if (!obj) return;

            const scale = placed.scale || 1;
            const pixelW = obj.width * gridSize * scale;
            const pixelH = obj.height * gridSize * scale;

            // Get current collision box or default to full object
            const cb = placed.collisionBox || { x: 0, y: 0, w: pixelW, h: pixelH };

            const popup = document.createElement('div');
            popup.id = 'staticObjEditPopup';
            popup.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#2a3a2a; padding:20px; border-radius:8px; border:2px solid #4a7c59; z-index:10000; width:450px; max-width:90vw;';

            let html = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">';
            html += '<div style="color:#4a7c59; font-weight:bold; font-size:14px;">Edit Collision: ' + obj.name + '</div>';
            html += '<button onclick="closeStaticObjEditPopup()" style="background:none; border:none; color:#888; font-size:18px; cursor:pointer;">&times;</button>';
            html += '</div>';

            // Object preview and collision editor
            html += '<div style="display:flex; gap:20px;">';

            // Left: Visual preview with collision box overlay
            html += '<div style="flex:0 0 150px;">';
            html += '<canvas id="staticObjCollisionPreview" width="150" height="150" style="border:1px solid #4a7c59; background:#1a1a2a;"></canvas>';
            html += '<p style="font-size:9px; color:#888; margin-top:5px; text-align:center;">Green = collision box</p>';
            html += '</div>';

            // Right: Collision box inputs
            html += '<div style="flex:1;">';
            html += '<p style="font-size:11px; color:#aaa; margin-bottom:10px;">Object size: ' + pixelW + ' x ' + pixelH + ' px</p>';

            html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">';
            html += '<div><label style="color:#aaa; font-size:10px;">X Offset:</label>';
            html += '<input type="number" id="cbX" value="' + cb.x + '" min="0" max="' + pixelW + '" style="width:100%; padding:5px; background:#1a2a1a; color:#4f8; border:1px solid #4a7c59; border-radius:3px;" onchange="updateStaticObjCollisionPreview()"></div>';
            html += '<div><label style="color:#aaa; font-size:10px;">Y Offset:</label>';
            html += '<input type="number" id="cbY" value="' + cb.y + '" min="0" max="' + pixelH + '" style="width:100%; padding:5px; background:#1a2a1a; color:#4f8; border:1px solid #4a7c59; border-radius:3px;" onchange="updateStaticObjCollisionPreview()"></div>';
            html += '<div><label style="color:#aaa; font-size:10px;">Width:</label>';
            html += '<input type="number" id="cbW" value="' + cb.w + '" min="1" max="' + pixelW + '" style="width:100%; padding:5px; background:#1a2a1a; color:#4f8; border:1px solid #4a7c59; border-radius:3px;" onchange="updateStaticObjCollisionPreview()"></div>';
            html += '<div><label style="color:#aaa; font-size:10px;">Height:</label>';
            html += '<input type="number" id="cbH" value="' + cb.h + '" min="1" max="' + pixelH + '" style="width:100%; padding:5px; background:#1a2a1a; color:#4f8; border:1px solid #4a7c59; border-radius:3px;" onchange="updateStaticObjCollisionPreview()"></div>';
            html += '</div>';

            // Preset buttons
            html += '<div style="display:flex; gap:5px; margin-bottom:15px;">';
            html += '<button onclick="setStaticObjCollisionPreset(\'full\')" style="flex:1; padding:5px; font-size:10px; background:#333; color:#aaa; border:1px solid #555; border-radius:3px;">Full Size</button>';
            html += '<button onclick="setStaticObjCollisionPreset(\'bottom\')" style="flex:1; padding:5px; font-size:10px; background:#333; color:#aaa; border:1px solid #555; border-radius:3px;">Bottom Half</button>';
            html += '<button onclick="setStaticObjCollisionPreset(\'none\')" style="flex:1; padding:5px; font-size:10px; background:#333; color:#aaa; border:1px solid #555; border-radius:3px;">No Collision</button>';
            html += '</div>';

            html += '</div>'; // End right column
            html += '</div>'; // End flex container

            // Save/Cancel buttons
            html += '<div style="display:flex; gap:10px; margin-top:15px;">';
            html += '<button onclick="saveStaticObjCollision(' + index + ')" style="flex:1; padding:8px; background:#4a7c59; color:#fff; border:none; border-radius:4px; cursor:pointer;">Save</button>';
            html += '<button onclick="closeStaticObjEditPopup()" style="flex:1; padding:8px; background:#555; color:#fff; border:none; border-radius:4px; cursor:pointer;">Cancel</button>';
            html += '</div>';

            popup.innerHTML = html;

            // Add backdrop
            const backdrop = document.createElement('div');
            backdrop.id = 'staticObjEditBackdrop';
            backdrop.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999;';
            backdrop.onclick = closeStaticObjEditPopup;

            document.body.appendChild(backdrop);
            document.body.appendChild(popup);

            // Store reference for preview updates
            window._editingStaticObj = { placed, index, obj };

            // Draw initial preview
            setTimeout(() => updateStaticObjCollisionPreview(), 50);
        }

        function updateStaticObjCollisionPreview() {
            const canvas = document.getElementById('staticObjCollisionPreview');
            if (!canvas || !window._editingStaticObj) return;

            const ctx = canvas.getContext('2d');
            const { placed, obj } = window._editingStaticObj;
            const scale = placed.scale || 1;
            const pixelW = obj.width * gridSize * scale;
            const pixelH = obj.height * gridSize * scale;

            // Clear canvas
            ctx.fillStyle = '#1a1a2a';
            ctx.fillRect(0, 0, 150, 150);

            // Calculate preview scale to fit canvas
            const previewScale = Math.min(140 / pixelW, 140 / pixelH);
            const offsetX = (150 - pixelW * previewScale) / 2;
            const offsetY = (150 - pixelH * previewScale) / 2;

            // Draw object sprite
            ctx.imageSmoothingEnabled = false;
            if (obj._spriteImg && obj._spriteImg.complete) {
                ctx.drawImage(
                    obj._spriteImg,
                    0, 0, obj.width * gridSize, obj.height * gridSize,
                    offsetX, offsetY, pixelW * previewScale, pixelH * previewScale
                );
            }

            // Get collision values
            const cbX = parseInt(document.getElementById('cbX').value) || 0;
            const cbY = parseInt(document.getElementById('cbY').value) || 0;
            const cbW = parseInt(document.getElementById('cbW').value) || pixelW;
            const cbH = parseInt(document.getElementById('cbH').value) || pixelH;

            // Draw collision box overlay
            ctx.strokeStyle = '#4f8';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 2]);
            ctx.strokeRect(
                offsetX + cbX * previewScale,
                offsetY + cbY * previewScale,
                cbW * previewScale,
                cbH * previewScale
            );
            ctx.setLineDash([]);

            // Fill with semi-transparent green
            ctx.fillStyle = 'rgba(79, 255, 136, 0.2)';
            ctx.fillRect(
                offsetX + cbX * previewScale,
                offsetY + cbY * previewScale,
                cbW * previewScale,
                cbH * previewScale
            );
        }

        function setStaticObjCollisionPreset(preset) {
            if (!window._editingStaticObj) return;
            const { placed, obj } = window._editingStaticObj;
            const scale = placed.scale || 1;
            const pixelW = obj.width * gridSize * scale;
            const pixelH = obj.height * gridSize * scale;

            switch (preset) {
                case 'full':
                    document.getElementById('cbX').value = 0;
                    document.getElementById('cbY').value = 0;
                    document.getElementById('cbW').value = pixelW;
                    document.getElementById('cbH').value = pixelH;
                    break;
                case 'bottom':
                    document.getElementById('cbX').value = 0;
                    document.getElementById('cbY').value = Math.floor(pixelH / 2);
                    document.getElementById('cbW').value = pixelW;
                    document.getElementById('cbH').value = Math.floor(pixelH / 2);
                    break;
                case 'none':
                    document.getElementById('cbX').value = 0;
                    document.getElementById('cbY').value = 0;
                    document.getElementById('cbW').value = 0;
                    document.getElementById('cbH').value = 0;
                    break;
            }
            updateStaticObjCollisionPreview();
        }

        function saveStaticObjCollision(index) {
            if (index < 0 || index >= placedStaticObjects.length) return;

            const cbX = parseInt(document.getElementById('cbX').value) || 0;
            const cbY = parseInt(document.getElementById('cbY').value) || 0;
            const cbW = parseInt(document.getElementById('cbW').value) || 0;
            const cbH = parseInt(document.getElementById('cbH').value) || 0;

            // Save collision box to placed object
            placedStaticObjects[index].collisionBox = { x: cbX, y: cbY, w: cbW, h: cbH };

            // Broadcast to co-op
            broadcastEdit({
                editType: 'updateStaticObjCollision',
                index: index,
                collisionBox: { x: cbX, y: cbY, w: cbW, h: cbH },
                mapName: currentMapName
            });

            closeStaticObjEditPopup();
            renderMap();
        }

        function closeStaticObjEditPopup() {
            const popup = document.getElementById('staticObjEditPopup');
            const backdrop = document.getElementById('staticObjEditBackdrop');
            if (popup) popup.remove();
            if (backdrop) backdrop.remove();
            delete window._editingStaticObj;
        }

        function updateAnimPropListDisplay() {
            const container = document.getElementById('animPropList');
            if (!container) return;
            container.innerHTML = '';

            if (animatedProps.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:11px; padding:10px;">No animated props yet</div>';
                return;
            }

            animatedProps.forEach((prop, i) => {
                const item = document.createElement('div');
                const isSelected = (currentAnimPropIndex === i);
                item.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px; background:' + (isSelected ? '#4a4a6e' : '#333') + '; border:2px solid ' + (isSelected ? '#4af' : 'transparent') + '; border-radius:5px; margin-bottom:5px; cursor:pointer;';
                item.onclick = () => {
                    // Toggle - clicking same one deselects
                    if (currentAnimPropIndex === i) {
                        currentAnimPropIndex = -1;
                    } else {
                        currentAnimPropIndex = i;
                        currentStaticObjIndex = -1; // Deselect static objects
                    }
                    updateAnimPropListDisplay();
                    updateStaticObjectsList();
                };

                // Preview thumbnail
                if (prop.frames && prop.frames.length > 0) {
                    const canvas = document.createElement('canvas');
                    canvas.width = 32;
                    canvas.height = 32;
                    canvas.style.cssText = 'border:1px solid #555; image-rendering:pixelated;';
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = false;

                    const frame = prop.frames[0];
                    if (prop._spriteImg) {
                        ctx.drawImage(prop._spriteImg, frame.x, frame.y, frame.w, frame.h, 0, 0, 32, 32);
                    } else if (prop.spriteData) {
                        // Fallback: load image if _spriteImg not available
                        const img = new Image();
                        img.onload = () => {
                            prop._spriteImg = img;
                            ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, 32, 32);
                        };
                        img.src = prop.spriteData;
                    }
                    item.appendChild(canvas);
                }

                const info = document.createElement('div');
                info.style.flex = '1';
                info.innerHTML = '<div style="color:#4af; font-weight:bold;">' + prop.name + '</div>' +
                    '<div style="font-size:10px; color:#888;">' + prop.frames.length + ' frames | ' + prop.type + '</div>';
                item.appendChild(info);

                // Edit button
                const editBtn = document.createElement('button');
                editBtn.textContent = 'Edit';
                editBtn.style.cssText = 'padding:4px 8px; font-size:10px;';
                editBtn.onclick = (e) => { e.stopPropagation(); openAnimPropEditor(i); };
                item.appendChild(editBtn);

                // Delete button
                const delBtn = document.createElement('button');
                delBtn.textContent = '×';
                delBtn.style.cssText = 'padding:4px 8px; font-size:10px; background:#a55;';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    // Wave 5: walk layers to count animTile cells that will be affected.
                    let placedOnMaps = 0;
                    try {
                        for (const mName of Object.keys(maps || {})) {
                            const m = maps[mName];
                            if (!m || !Array.isArray(m.layers)) continue;
                            for (const layer of m.layers) {
                                if (!Array.isArray(layer)) continue;
                                for (const row of layer) {
                                    if (!Array.isArray(row)) continue;
                                    for (const cell of row) {
                                        if (cell && cell.type === 'animTile' && cell.propIndex === i) placedOnMaps++;
                                    }
                                }
                            }
                        }
                    } catch (_) {}
                    const msg = placedOnMaps > 0
                        ? `Delete "${prop.name}"?\n\n${placedOnMaps} placed tile(s) referencing this prop will also be removed.`
                        : 'Delete "' + prop.name + '"?';
                    if (confirm(msg)) {
                        const deleteIndex = i;
                        animatedProps.splice(deleteIndex, 1);
                        // Wave 5: reindex every animTile cell in every map's every layer + legacy placedAnimProps.
                        reindexAnimPropReferences(deleteIndex);
                        broadcastEdit({ editType: 'removeAnimProp', index: deleteIndex });
                        updateAnimPropListDisplay();
                        renderMap();
                    }
                };
                item.appendChild(delBtn);

                container.appendChild(item);
            });
        }

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
                } else if (obj.spriteData) {
                    // Fallback: load image if _spriteImg not ready
                    const img = new Image();
                    img.onload = () => {
                        obj._spriteImg = img;
                        const srcW = obj.width * gridSize;
                        const srcH = obj.height * gridSize;
                        const scale = Math.min(32 / srcW, 32 / srcH);
                        const drawW = srcW * scale;
                        const drawH = srcH * scale;
                        ctx.drawImage(img, 0, 0, srcW, srcH,
                                     (32 - drawW) / 2, (32 - drawH) / 2, drawW, drawH);
                    };
                    img.src = obj.spriteData;
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
            // Toggle - clicking same one deselects
            if (currentStaticObjIndex === index) {
                currentStaticObjIndex = -1;
            } else {
                currentStaticObjIndex = index;
                currentAnimPropIndex = -1; // Deselect animated props
            }

            updateStaticObjectsList();
            updateAnimPropListDisplay();

            // Show/hide placement controls
            const controls = document.getElementById('staticObjPlacementControls');
            if (controls) {
                controls.style.display = (currentStaticObjIndex >= 0) ? 'block' : 'none';
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
