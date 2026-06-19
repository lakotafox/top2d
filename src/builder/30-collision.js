        // ===== COLLISION PHASE =====
        function rebuildCollisionView() {
            gridSize = parseInt(document.getElementById('gridSize').value);
            drawCollisionTileset();
            updateCollisionStats();
        }

        function drawCollisionTileset() {
            if (!tilesetImg) return;

            collisionTilesetCanvas.width = tilesetImg.naturalWidth * collisionZoom;
            collisionTilesetCanvas.height = tilesetImg.naturalHeight * collisionZoom;

            collisionTilesetCtx.imageSmoothingEnabled = false;
            collisionTilesetCtx.drawImage(tilesetImg, 0, 0, collisionTilesetCanvas.width, collisionTilesetCanvas.height);

            // Grid
            collisionTilesetCtx.strokeStyle = 'rgba(255,255,255,0.3)';
            const cols = Math.floor(tilesetImg.naturalWidth / gridSize);
            const rows = Math.floor(tilesetImg.naturalHeight / gridSize);

            for (let x = 0; x <= cols; x++) {
                collisionTilesetCtx.beginPath();
                collisionTilesetCtx.moveTo(x * gridSize * collisionZoom, 0);
                collisionTilesetCtx.lineTo(x * gridSize * collisionZoom, collisionTilesetCanvas.height);
                collisionTilesetCtx.stroke();
            }
            for (let y = 0; y <= rows; y++) {
                collisionTilesetCtx.beginPath();
                collisionTilesetCtx.moveTo(0, y * gridSize * collisionZoom);
                collisionTilesetCtx.lineTo(collisionTilesetCanvas.width, y * gridSize * collisionZoom);
                collisionTilesetCtx.stroke();
            }

            // Draw pixel collision masks (only for current tileset)
            collisionTilesetCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            const keyPrefix = currentTilesetIndex + ':';
            for (let key in collisionMasks) {
                // Only show collisions for current tileset
                if (!key.startsWith(keyPrefix)) continue;

                const mask = collisionMasks[key];
                if (!mask) continue;

                // Parse key format: "tilesetIndex:x,y"
                const coordPart = key.substring(keyPrefix.length);
                const parts = coordPart.split(',');
                const tx = parseInt(parts[0]);
                const ty = parseInt(parts[1]);

                for (let py = 0; py < gridSize; py++) {
                    for (let px = 0; px < gridSize; px++) {
                        if (mask[py] && mask[py][px]) {
                            collisionTilesetCtx.fillRect(
                                (tx + px) * collisionZoom,
                                (ty + py) * collisionZoom,
                                collisionZoom,
                                collisionZoom
                            );
                        }
                    }
                }
            }

            // Draw depth split lines (cyan freeform lines)
            collisionTilesetCtx.strokeStyle = '#0ff';
            collisionTilesetCtx.lineWidth = 2;
            for (let key in tileSplitLines) {
                if (!key.startsWith(keyPrefix)) continue;

                const splitYArray = tileSplitLines[key];
                const coordPart = key.substring(keyPrefix.length);
                const parts = coordPart.split(',');
                const tx = parseInt(parts[0]);
                const ty = parseInt(parts[1]);

                // Draw freeform line connecting all column Y values
                collisionTilesetCtx.beginPath();
                for (let col = 0; col < gridSize; col++) {
                    const splitY = Array.isArray(splitYArray) ? splitYArray[col] : splitYArray;
                    const lineX = (tx + col + 0.5) * collisionZoom;
                    const lineY = (ty + splitY) * collisionZoom;
                    if (col === 0) {
                        collisionTilesetCtx.moveTo(lineX, lineY);
                    } else {
                        collisionTilesetCtx.lineTo(lineX, lineY);
                    }
                }
                collisionTilesetCtx.stroke();

                // Fill canopy region with semi-transparent cyan
                collisionTilesetCtx.fillStyle = 'rgba(0, 255, 255, 0.2)';
                collisionTilesetCtx.beginPath();
                collisionTilesetCtx.moveTo(tx * collisionZoom, ty * collisionZoom);
                for (let col = 0; col < gridSize; col++) {
                    const splitY = Array.isArray(splitYArray) ? splitYArray[col] : splitYArray;
                    const lineX = (tx + col + 0.5) * collisionZoom;
                    const lineY = (ty + splitY) * collisionZoom;
                    collisionTilesetCtx.lineTo(lineX, lineY);
                }
                collisionTilesetCtx.lineTo((tx + gridSize) * collisionZoom, ty * collisionZoom);
                collisionTilesetCtx.closePath();
                collisionTilesetCtx.fill();

                // Draw "C" for canopy and "T" for trunk (swap if flipped)
                const avgSplitY = Array.isArray(splitYArray)
                    ? splitYArray.reduce((a, b) => a + b, 0) / splitYArray.length
                    : splitYArray;
                const isFlipped = tileSplitLineFlipped[key];
                collisionTilesetCtx.fillStyle = isFlipped ? '#fa0' : '#0ff';
                collisionTilesetCtx.font = (collisionZoom * 2) + 'px sans-serif';
                collisionTilesetCtx.textAlign = 'center';
                // Top label position
                const topY = (ty + avgSplitY / 2) * collisionZoom;
                // Bottom label position
                const bottomY = (ty + avgSplitY + (gridSize - avgSplitY) / 2) * collisionZoom;
                const centerX = tx * collisionZoom + gridSize * collisionZoom / 2;
                if (isFlipped) {
                    // Flipped: T on top (Y-sorted), C on bottom (covers player)
                    collisionTilesetCtx.fillText('T', centerX, topY);
                    collisionTilesetCtx.fillText('C', centerX, bottomY);
                } else {
                    // Normal: C on top (covers player), T on bottom (Y-sorted)
                    collisionTilesetCtx.fillText('C', centerX, topY);
                    collisionTilesetCtx.fillText('T', centerX, bottomY);
                }
            }

            // Highlight selected split tile
            if (selectedSplitTile && collisionTool === 'split') {
                collisionTilesetCtx.strokeStyle = '#ff0';
                collisionTilesetCtx.lineWidth = 3;
                collisionTilesetCtx.strokeRect(
                    selectedSplitTile.x * collisionZoom,
                    selectedSplitTile.y * collisionZoom,
                    gridSize * collisionZoom,
                    gridSize * collisionZoom
                );
            }

            // Draw cyan brush preview
            if (brushPreviewPos && (collisionTool === 'paint' || collisionTool === 'erase')) {
                const bx = brushPreviewPos.x;
                const by = brushPreviewPos.y;
                collisionTilesetCtx.strokeStyle = collisionTool === 'erase' ? '#ff0' : '#0ff';
                collisionTilesetCtx.lineWidth = 2;
                collisionTilesetCtx.setLineDash([4, 4]);

                if (brushShape === 'square') {
                    const half = Math.floor(brushSize / 2);
                    collisionTilesetCtx.strokeRect(
                        (bx - half) * collisionZoom,
                        (by - half) * collisionZoom,
                        brushSize * collisionZoom,
                        brushSize * collisionZoom
                    );
                } else if (brushShape === 'circle') {
                    const radius = (brushSize / 2) * collisionZoom;
                    collisionTilesetCtx.beginPath();
                    collisionTilesetCtx.arc(bx * collisionZoom, by * collisionZoom, radius, 0, Math.PI * 2);
                    collisionTilesetCtx.stroke();
                } else if (brushShape === 'rect') {
                    const halfW = Math.floor(brushRectW / 2);
                    const halfH = Math.floor(brushRectH / 2);
                    collisionTilesetCtx.strokeRect(
                        (bx - halfW) * collisionZoom,
                        (by - halfH) * collisionZoom,
                        brushRectW * collisionZoom,
                        brushRectH * collisionZoom
                    );
                }

                collisionTilesetCtx.setLineDash([]);
            }
        }

        function setCollisionZoom(z) {
            collisionZoom = z;
            document.querySelectorAll('[id^="collisionZoom"]').forEach(b => b.classList.remove('active'));
            const btn = document.querySelector(`[onclick="setCollisionZoom(${z})"]`);
            if (btn) btn.classList.add('active');
            drawCollisionTileset();
        }

        function setCollisionTool(tool) {
            collisionTool = tool;
            document.getElementById('collisionToolPaint').classList.toggle('active', tool === 'paint');
            document.getElementById('collisionToolErase').classList.toggle('active', tool === 'erase');
            document.getElementById('collisionToolSplit').classList.toggle('active', tool === 'split');

            // Show/hide split controls
            document.getElementById('splitControls').style.display = tool === 'split' ? 'block' : 'none';

            // Update cursor based on tool
            if (tool === 'split') {
                collisionTilesetCanvas.style.cursor = 'pointer';
            } else if (tool === 'erase') {
                collisionTilesetCanvas.style.cursor = 'not-allowed';
            } else {
                collisionTilesetCanvas.style.cursor = 'crosshair';
            }

            // Clear split selection when switching away
            if (tool !== 'split') {
                selectedSplitTile = null;
            }

            drawCollisionTileset();
        }

        function setBrushSize(size) {
            brushSize = size;
            document.querySelectorAll('[id^="brush"]').forEach(b => b.classList.remove('active'));
            document.getElementById('brush' + size).classList.add('active');
            drawCollisionTileset();
        }

        function setBrushShape(shape) {
            brushShape = shape;
            document.getElementById('brushShapeSquare').classList.remove('active');
            document.getElementById('brushShapeCircle').classList.remove('active');
            document.getElementById('brushShapeRect').classList.remove('active');
            document.getElementById('brushShape' + shape.charAt(0).toUpperCase() + shape.slice(1)).classList.add('active');
            document.getElementById('brushRectControls').style.display = shape === 'rect' ? 'block' : 'none';
            drawCollisionTileset();
        }

        function updateBrushRect() {
            brushRectW = parseInt(document.getElementById('brushRectW').value) || 8;
            brushRectH = parseInt(document.getElementById('brushRectH').value) || 4;
            drawCollisionTileset();
        }

        function updateCollisionStats() {
            // Only count collisions for current tileset
            const keyPrefix = currentTilesetIndex + ':';
            const count = Object.keys(tileCollisions).filter(k => k.startsWith(keyPrefix) && tileCollisions[k]).length;
            document.getElementById('collisionStats').textContent = count + ' tiles with collision (tileset ' + currentTilesetIndex + ')';
        }

        function selectAllCollision(fromNetwork = false) {
            if (!tilesetImg && !fromNetwork) return;
            const cols = fromNetwork ? 100 : Math.floor(tilesetImg.naturalWidth / gridSize);
            const rows = fromNetwork ? 100 : Math.floor(tilesetImg.naturalHeight / gridSize);
            const tilesetIdx = fromNetwork ? arguments[1] : currentTilesetIndex;

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const tileX = col * gridSize;
                    const tileY = row * gridSize;
                    const key = tilesetIdx + ':' + tileX + ',' + tileY;
                    tileCollisions[key] = true;
                }
            }

            if (!fromNetwork) {
                broadcastEdit({ editType: 'selectAllCollision', tilesetIndex: currentTilesetIndex });
            }
            drawCollisionTileset();
            updateCollisionStats();
        }

        function clearAllCollision(fromNetwork = false, tilesetIdx = null) {
            if (!fromNetwork && !confirm('Clear all collision for current tileset?')) return;
            const keyPrefix = (fromNetwork ? tilesetIdx : currentTilesetIndex) + ':';
            for (let key in tileCollisions) {
                if (key.startsWith(keyPrefix)) {
                    delete tileCollisions[key];
                }
            }
            for (let key in collisionMasks) {
                if (key.startsWith(keyPrefix)) {
                    delete collisionMasks[key];
                }
            }
            if (!fromNetwork) {
                broadcastEdit({ editType: 'clearAllCollision', tilesetIndex: currentTilesetIndex });
            }
            drawCollisionTileset();
            updateCollisionStats();
        }

        // Collision canvas mouse events - pixel brush painting + pan
        collisionTilesetCanvas.addEventListener('mousedown', (e) => {
            e.preventDefault();

            // Middle mouse or shift+left = pan
            if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
                isPanning = true;
                panStartX = e.clientX + collisionPanX;
                panStartY = e.clientY + collisionPanY;
                collisionTilesetCanvas.style.cursor = 'grabbing';
                return;
            }

            // Handle split tool mode
            if (collisionTool === 'split' && e.button === 0) {
                handleSplitClick(e);
                return;
            }

            if (e.button === 0) {
                brushPainting = true;
                paintCollisionAt(e, collisionTool === 'paint');
            } else if (e.button === 2) {
                brushErasing = true;
                paintCollisionAt(e, false);
            }
        });

        collisionTilesetCanvas.addEventListener('mousemove', (e) => {
            if (isPanning) {
                collisionPanX = panStartX - e.clientX;
                collisionPanY = panStartY - e.clientY;
                updateCollisionScroll();
                return;
            }

            // Handle dragging split line
            if (draggingSplitLine && selectedSplitTile) {
                handleSplitDrag(e);
                return;
            }

            if (brushPainting) paintCollisionAt(e, collisionTool === 'paint');
            if (brushErasing) paintCollisionAt(e, false);

            // Update brush preview position
            const rect = collisionTilesetCanvas.getBoundingClientRect();
            const px = Math.floor((e.clientX - rect.left) / collisionZoom);
            const py = Math.floor((e.clientY - rect.top) / collisionZoom);
            brushPreviewPos = { x: px, y: py };
            if (!brushPainting && !brushErasing && collisionTool !== 'split') {
                drawCollisionTileset();
            }
        });

        collisionTilesetCanvas.addEventListener('mouseleave', () => {
            brushPreviewPos = null;
            drawCollisionTileset();
        });

        collisionTilesetCanvas.addEventListener('mouseup', (e) => {
            if (isPanning) {
                isPanning = false;
                collisionTilesetCanvas.style.cursor = collisionTool === 'split' ? 'pointer' : 'crosshair';
            }
            // Sync split line on drag end
            if (draggingSplitLine && modifiedSplitKey && tileSplitLines[modifiedSplitKey]) {
                console.log('[SYNC] Broadcasting splitLine:', modifiedSplitKey, 'line:', tileSplitLines[modifiedSplitKey]);
                broadcastEdit({ editType: 'splitLine', key: modifiedSplitKey, mask: tileSplitLines[modifiedSplitKey] });
                modifiedSplitKey = null;
            }
            draggingSplitLine = false;
            // Sync modified collision data
            if ((brushPainting || brushErasing) && modifiedCollisionKeys.size > 0) {
                syncModifiedCollisions();
            }
            brushPainting = false;
            brushErasing = false;
        });

        collisionTilesetCanvas.addEventListener('mouseleave', () => {
            if (isPanning) {
                isPanning = false;
                collisionTilesetCanvas.style.cursor = 'crosshair';
            }
            // Sync modified collision data
            if ((brushPainting || brushErasing) && modifiedCollisionKeys.size > 0) {
                syncModifiedCollisions();
            }
            brushPainting = false;
            brushErasing = false;
        });

        function syncModifiedCollisions() {
            // Send collision updates to other builders
            modifiedCollisionKeys.forEach(key => {
                if (tileCollisions[key]) {
                    broadcastEdit({ editType: 'collision', key: key, value: true });
                    if (collisionMasks[key]) {
                        broadcastEdit({ editType: 'collisionMask', key: key, mask: collisionMasks[key] });
                    }
                } else {
                    broadcastEdit({ editType: 'collision', key: key, value: false });
                }
            });
            modifiedCollisionKeys.clear();
        }

        collisionTilesetCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Touch support for collision canvas (mobile/iPad)
        collisionTilesetCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent scrolling while drawing
            const touch = e.touches[0];

            // Handle split tool mode
            if (collisionTool === 'split') {
                handleSplitClickTouch(touch);
                return;
            }

            // Start painting collision
            brushPainting = true;
            paintCollisionAtTouch(touch, collisionTool === 'paint');
        }, { passive: false });

        collisionTilesetCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Prevent scrolling while drawing
            const touch = e.touches[0];

            // Handle dragging split line
            if (draggingSplitLine && selectedSplitTile) {
                handleSplitDragTouch(touch);
                return;
            }

            if (brushPainting) paintCollisionAtTouch(touch, collisionTool === 'paint');
        }, { passive: false });

        collisionTilesetCanvas.addEventListener('touchend', () => {
            // Sync split line on drag end
            if (draggingSplitLine && modifiedSplitKey && tileSplitLines[modifiedSplitKey]) {
                console.log('[SYNC] Broadcasting splitLine:', modifiedSplitKey, 'line:', tileSplitLines[modifiedSplitKey]);
                broadcastEdit({ editType: 'splitLine', key: modifiedSplitKey, mask: tileSplitLines[modifiedSplitKey] });
                modifiedSplitKey = null;
            }
            draggingSplitLine = false;
            if ((brushPainting || brushErasing) && modifiedCollisionKeys.size > 0) {
                syncModifiedCollisions();
            }
            brushPainting = false;
            brushErasing = false;
        });

        collisionTilesetCanvas.addEventListener('touchcancel', () => {
            // Sync split line on drag end
            if (draggingSplitLine && modifiedSplitKey && tileSplitLines[modifiedSplitKey]) {
                console.log('[SYNC] Broadcasting splitLine:', modifiedSplitKey, 'line:', tileSplitLines[modifiedSplitKey]);
                broadcastEdit({ editType: 'splitLine', key: modifiedSplitKey, mask: tileSplitLines[modifiedSplitKey] });
                modifiedSplitKey = null;
            }
            draggingSplitLine = false;
            if ((brushPainting || brushErasing) && modifiedCollisionKeys.size > 0) {
                syncModifiedCollisions();
            }
            brushPainting = false;
            brushErasing = false;
        });

        // Touch versions of paint/split functions
        function paintCollisionAtTouch(touch, addCollision) {
            const rect = collisionTilesetCanvas.getBoundingClientRect();
            const px = Math.floor((touch.clientX - rect.left) / collisionZoom);
            const py = Math.floor((touch.clientY - rect.top) / collisionZoom);

            if (!tilesetImg || px < 0 || py < 0 || px >= tilesetImg.naturalWidth || py >= tilesetImg.naturalHeight) return;

            const tileX = Math.floor(px / gridSize) * gridSize;
            const tileY = Math.floor(py / gridSize) * gridSize;
            const key = currentTilesetIndex + ':' + tileX + ',' + tileY;

            if (!collisionMasks[key]) {
                collisionMasks[key] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
            }

            const localX = px - tileX;
            const localY = py - tileY;
            const halfBrush = Math.floor(brushSize / 2);

            for (let by = -halfBrush; by <= halfBrush; by++) {
                for (let bx = -halfBrush; bx <= halfBrush; bx++) {
                    const targetX = localX + bx;
                    const targetY = localY + by;
                    if (targetX >= 0 && targetX < gridSize && targetY >= 0 && targetY < gridSize) {
                        collisionMasks[key][targetY][targetX] = addCollision;
                    }
                }
            }

            // Update tileCollisions
            let hasCollision = false;
            for (let y = 0; y < gridSize && !hasCollision; y++) {
                for (let x = 0; x < gridSize && !hasCollision; x++) {
                    if (collisionMasks[key][y][x]) hasCollision = true;
                }
            }
            if (hasCollision) {
                tileCollisions[key] = true;
            } else {
                delete tileCollisions[key];
                delete collisionMasks[key];
            }

            // Track for sync
            modifiedCollisionKeys.add(key);

            drawCollisionTileset();
            updateCollisionStats();
        }

        function handleSplitClickTouch(touch) {
            const rect = collisionTilesetCanvas.getBoundingClientRect();
            const px = Math.floor((touch.clientX - rect.left) / collisionZoom);
            const py = Math.floor((touch.clientY - rect.top) / collisionZoom);

            if (!tilesetImg || px < 0 || py < 0 || px >= tilesetImg.naturalWidth || py >= tilesetImg.naturalHeight) return;

            const tileX = Math.floor(px / gridSize) * gridSize;
            const tileY = Math.floor(py / gridSize) * gridSize;

            selectedSplitTile = { x: tileX, y: tileY, tilesetIndex: currentTilesetIndex };
            draggingSplitLine = true;

            const key = currentTilesetIndex + ':' + tileX + ',' + tileY;
            modifiedSplitKey = key; // Track for sync

            // Update flip checkbox to reflect this tile's state
            const isFlipped = tileSplitLineFlipped[key] || false;
            document.getElementById('splitFlipToggle').checked = isFlipped;
            updateSplitHelpText(isFlipped);

            const localY = py - tileY;
            const clampedY = Math.max(0, Math.min(gridSize, localY));

            if (flatLineMode) {
                tileSplitLines[key] = new Array(gridSize).fill(clampedY);
                document.getElementById('splitYInput').value = clampedY;
            } else {
                if (!tileSplitLines[key]) {
                    const defaultY = parseInt(document.getElementById('splitYInput').value) || Math.floor(gridSize / 2);
                    tileSplitLines[key] = new Array(gridSize).fill(defaultY);
                }
                const localX = px - tileX;
                const clampedX = Math.max(0, Math.min(gridSize - 1, localX));
                tileSplitLines[key][clampedX] = clampedY;
            }

            document.getElementById('splitYInput').max = gridSize;
            drawCollisionTileset();
        }

        function handleSplitDragTouch(touch) {
            if (!selectedSplitTile || !draggingSplitLine) return;

            const rect = collisionTilesetCanvas.getBoundingClientRect();
            const px = Math.floor((touch.clientX - rect.left) / collisionZoom);
            const py = Math.floor((touch.clientY - rect.top) / collisionZoom);

            const key = currentTilesetIndex + ':' + selectedSplitTile.x + ',' + selectedSplitTile.y;
            if (!tileSplitLines[key]) return;

            const localY = py - selectedSplitTile.y;
            const clampedY = Math.max(0, Math.min(gridSize, localY));

            if (flatLineMode) {
                tileSplitLines[key] = new Array(gridSize).fill(clampedY);
                document.getElementById('splitYInput').value = clampedY;
            } else {
                const localX = px - selectedSplitTile.x;
                const clampedX = Math.max(0, Math.min(gridSize - 1, localX));
                tileSplitLines[key][clampedX] = clampedY;
            }

            // Update modifiedSplitKey to ensure it stays in sync
            modifiedSplitKey = key;

            drawCollisionTileset();
        }

        // Paint collision pixels with brush
        function paintCollisionAt(e, addCollision) {
            const rect = collisionTilesetCanvas.getBoundingClientRect();
            const px = Math.floor((e.clientX - rect.left) / collisionZoom);
            const py = Math.floor((e.clientY - rect.top) / collisionZoom);

            if (!tilesetImg || px < 0 || py < 0 || px >= tilesetImg.naturalWidth || py >= tilesetImg.naturalHeight) return;

            // Find which tile this pixel is in
            const tileX = Math.floor(px / gridSize) * gridSize;
            const tileY = Math.floor(py / gridSize) * gridSize;
            // Include tileset index in key so each tileset has separate collisions
            const key = currentTilesetIndex + ':' + tileX + ',' + tileY;

            // Get or create mask for this tile
            if (!collisionMasks[key]) {
                collisionMasks[key] = [];
                for (let y = 0; y < gridSize; y++) {
                    collisionMasks[key][y] = new Array(gridSize).fill(false);
                }
            }
            const mask = collisionMasks[key];

            // Paint pixels with brush based on shape
            const half = Math.floor(brushSize / 2);
            const localX = px - tileX;
            const localY = py - tileY;

            if (brushShape === 'square') {
                for (let dy = -half; dy < half; dy++) {
                    for (let dx = -half; dx < half; dx++) {
                        const mx = localX + dx;
                        const my = localY + dy;
                        if (mx >= 0 && mx < gridSize && my >= 0 && my < gridSize) {
                            mask[my][mx] = addCollision;
                        }
                    }
                }
            } else if (brushShape === 'circle') {
                const radius = brushSize / 2;
                const radiusSq = radius * radius;
                for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
                    for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
                        if (dx * dx + dy * dy <= radiusSq) {
                            const mx = localX + dx;
                            const my = localY + dy;
                            if (mx >= 0 && mx < gridSize && my >= 0 && my < gridSize) {
                                mask[my][mx] = addCollision;
                            }
                        }
                    }
                }
            } else if (brushShape === 'rect') {
                const halfW = Math.floor(brushRectW / 2);
                const halfH = Math.floor(brushRectH / 2);
                for (let dy = -halfH; dy < halfH; dy++) {
                    for (let dx = -halfW; dx < halfW; dx++) {
                        const mx = localX + dx;
                        const my = localY + dy;
                        if (mx >= 0 && mx < gridSize && my >= 0 && my < gridSize) {
                            mask[my][mx] = addCollision;
                        }
                    }
                }
            }

            // Update tileCollisions (true if any pixel is set)
            let hasCollision = false;
            for (let y = 0; y < gridSize && !hasCollision; y++) {
                for (let x = 0; x < gridSize && !hasCollision; x++) {
                    if (mask[y][x]) hasCollision = true;
                }
            }
            if (hasCollision) {
                tileCollisions[key] = true;
            } else {
                delete tileCollisions[key];
                delete collisionMasks[key];
            }

            // Track for sync on mouseup
            modifiedCollisionKeys.add(key);

            drawCollisionTileset();
            updateCollisionStats();
        }

        // ===== DEPTH SPLIT FUNCTIONS =====
        // tileSplitLines stores an array of Y values per column for freeform lines
        // Format: "tilesetIndex:x,y" -> [y0, y1, y2, ..., y15] (one Y per column)

        function toggleFlatLineMode() {
            flatLineMode = document.getElementById('flatLineToggle').checked;
        }

        function toggleSplitFlip() {
            if (!selectedSplitTile) return;
            const key = selectedSplitTile.tilesetIndex + ':' + selectedSplitTile.x + ',' + selectedSplitTile.y;
            const isFlipped = document.getElementById('splitFlipToggle').checked;
            if (isFlipped) {
                tileSplitLineFlipped[key] = true;
            } else {
                delete tileSplitLineFlipped[key];
            }
            // Update help text
            updateSplitHelpText(isFlipped);
            // Broadcast the change
            broadcastEdit({ editType: 'splitLineFlip', key: key, flipped: isFlipped });
            drawCollisionTileset();
        }

        function updateSplitHelpText(isFlipped) {
            const helpText = document.getElementById('splitHelpText');
            if (helpText) {
                if (isFlipped) {
                    helpText.textContent = 'T = Trunk (top, Y-sorted) | C = Canopy (bottom, covers player)';
                    helpText.style.color = '#fa0';
                } else {
                    helpText.textContent = 'C = Canopy (top, covers player) | T = Trunk (bottom, Y-sorted)';
                    helpText.style.color = '#888';
                }
            }
        }

        function handleSplitClick(e) {
            const rect = collisionTilesetCanvas.getBoundingClientRect();
            const px = Math.floor((e.clientX - rect.left) / collisionZoom);
            const py = Math.floor((e.clientY - rect.top) / collisionZoom);

            if (!tilesetImg || px < 0 || py < 0 || px >= tilesetImg.naturalWidth || py >= tilesetImg.naturalHeight) return;

            // Find which tile was clicked
            const tileX = Math.floor(px / gridSize) * gridSize;
            const tileY = Math.floor(py / gridSize) * gridSize;

            // Select this tile for splitting
            selectedSplitTile = { x: tileX, y: tileY, tilesetIndex: currentTilesetIndex };
            draggingSplitLine = true;

            const key = currentTilesetIndex + ':' + tileX + ',' + tileY;
            modifiedSplitKey = key; // Track for sync

            // Update flip checkbox to reflect this tile's state
            const isFlipped = tileSplitLineFlipped[key] || false;
            document.getElementById('splitFlipToggle').checked = isFlipped;
            updateSplitHelpText(isFlipped);

            // Calculate local Y position within the tile
            const localY = py - tileY;
            const clampedY = Math.max(0, Math.min(gridSize, localY));

            // Initialize or set split line
            if (flatLineMode) {
                // Flat line mode: set entire line to clicked Y
                tileSplitLines[key] = new Array(gridSize).fill(clampedY);
                // Update the Y input to show current value
                document.getElementById('splitYInput').value = clampedY;
            } else {
                // Freeform mode: initialize if doesn't exist, then set clicked column
                if (!tileSplitLines[key]) {
                    const defaultY = parseInt(document.getElementById('splitYInput').value) || Math.floor(gridSize / 2);
                    tileSplitLines[key] = new Array(gridSize).fill(defaultY);
                }
                const localX = px - tileX;
                const clampedX = Math.max(0, Math.min(gridSize - 1, localX));
                tileSplitLines[key][clampedX] = clampedY;
            }

            // Update UI
            document.getElementById('splitYInput').max = gridSize;

            drawCollisionTileset();
        }

        function handleSplitDrag(e) {
            if (!selectedSplitTile || !draggingSplitLine) return;

            const rect = collisionTilesetCanvas.getBoundingClientRect();
            const px = Math.floor((e.clientX - rect.left) / collisionZoom);
            const py = Math.floor((e.clientY - rect.top) / collisionZoom);

            const key = currentTilesetIndex + ':' + selectedSplitTile.x + ',' + selectedSplitTile.y;
            if (!tileSplitLines[key]) return;

            // Calculate local position within the tile
            const localY = py - selectedSplitTile.y;
            const clampedY = Math.max(0, Math.min(gridSize, localY));

            if (flatLineMode) {
                // Flat line mode: set entire line to current Y
                tileSplitLines[key] = new Array(gridSize).fill(clampedY);
                document.getElementById('splitYInput').value = clampedY;
            } else {
                // Freeform mode: set only this column
                const localX = px - selectedSplitTile.x;
                const clampedX = Math.max(0, Math.min(gridSize - 1, localX));
                tileSplitLines[key][clampedX] = clampedY;
            }

            // Update modifiedSplitKey to ensure it stays in sync
            modifiedSplitKey = key;

            drawCollisionTileset();
        }

        function setSplitLineY() {
            // Set a flat horizontal line at the specified Y
            if (!selectedSplitTile) {
                alert('Click a tile first to select it');
                return;
            }

            const splitY = parseInt(document.getElementById('splitYInput').value) || Math.floor(gridSize / 2);
            const clampedY = Math.max(0, Math.min(gridSize, splitY));

            const key = currentTilesetIndex + ':' + selectedSplitTile.x + ',' + selectedSplitTile.y;
            tileSplitLines[key] = new Array(gridSize).fill(clampedY);
            broadcastEdit({ editType: 'splitLine', key: key, mask: tileSplitLines[key] });

            drawCollisionTileset();
        }

        function clearSelectedSplit() {
            if (!selectedSplitTile) return;

            const key = currentTilesetIndex + ':' + selectedSplitTile.x + ',' + selectedSplitTile.y;
            delete tileSplitLines[key];
            delete tileSplitLineFlipped[key];
            broadcastEdit({ editType: 'clearSplitLine', key: key });
            selectedSplitTile = null;
            // Reset flip checkbox
            document.getElementById('splitFlipToggle').checked = false;
            updateSplitHelpText(false);

            drawCollisionTileset();
        }

        // Keyboard controls for build phase
        document.addEventListener('keydown', (e) => {
            // Ignore shortcuts when typing in input fields
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;

            if (currentPhase === 'build') {
                if (e.key === 'r' || e.key === 'R') {
                    e.preventDefault();
                    rotateNext();
                }
                if (e.key === 'i' || e.key === 'I') {
                    e.preventDefault();
                    toggleFlipH();
                }
                if (e.key === 'e' || e.key === 'E') {
                    e.preventDefault();
                    toggleEraseMode();
                }
            }
        });

        // Keyboard controls for collision painter
        document.addEventListener('keydown', (e) => {
            // Ignore shortcuts when typing in input fields
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;

            if (currentPhase !== 'collision') return;

            // Zoom with Q/E or +/-
            if (e.key === 'e' || e.key === 'E' || e.key === '=' || e.key === '+') {
                e.preventDefault();
                if (collisionZoom < 12) setCollisionZoom(collisionZoom + 1);
                return;
            }
            if (e.key === 'q' || e.key === 'Q' || e.key === '-' || e.key === '_') {
                e.preventDefault();
                if (collisionZoom > 1) setCollisionZoom(collisionZoom - 1);
                return;
            }

            // Arrow keys to pan
            const panSpeed = 50;
            let moved = false;

            if (e.key === 'ArrowLeft') { collisionPanX -= panSpeed; moved = true; }
            if (e.key === 'ArrowRight') { collisionPanX += panSpeed; moved = true; }
            if (e.key === 'ArrowUp') { collisionPanY -= panSpeed; moved = true; }
            if (e.key === 'ArrowDown') { collisionPanY += panSpeed; moved = true; }

            if (moved) {
                e.preventDefault();
                updateCollisionScroll();
            }
        });

        function updateCollisionScroll() {
            const container = document.querySelector('.collision-main');
            // Clamp pan values
            const maxX = Math.max(0, collisionTilesetCanvas.width - container.clientWidth);
            const maxY = Math.max(0, collisionTilesetCanvas.height - container.clientHeight);
            collisionPanX = Math.max(0, Math.min(maxX, collisionPanX));
            collisionPanY = Math.max(0, Math.min(maxY, collisionPanY));

            container.scrollLeft = collisionPanX;
            container.scrollTop = collisionPanY;
        }

        let mapInitialized = false;

        function finishCollisionSetup() {
            // Only initialize map if it hasn't been created yet
            if (!mapInitialized) {
                initMap();
                mapInitialized = true;
            }
            setPhase('build');
            drawPaintTileset();
            renderMap();
            updateAnimPropListDisplay();
        }

        function goBackToCollision() {
            setPhase('collision');
            rebuildCollisionView();
        }
