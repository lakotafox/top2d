        // === Y-SORTING FUNCTIONS ===

        // Object pool for Y-sorting to avoid GC pauses
        // Pre-allocated array and objects - reuse instead of creating new ones each frame
        const ENTITY_POOL_SIZE = 200; // Max entities to Y-sort (player + NPCs + items + other players)
        const entityPool = [];
        for (let i = 0; i < ENTITY_POOL_SIZE; i++) {
            entityPool.push({ type: '', gridY: 0, subSort: 0, npcIndex: -1, itemIndex: -1, placedIndex: -1, playerId: null });
        }
        let entityPoolUsed = 0;

        // Original Y-sorting: Y position is primary, layer is tiebreaker
        function drawYSortedEntities(camX, camY, tileSize) {
            // OPTIMIZED: Draw tiles by row order (no sorting needed), interleave moving entities
            // This avoids creating/sorting a 16k+ element array every frame!
            // FURTHER OPTIMIZED: Reuse pooled objects to eliminate GC pauses

            // Calculate visible tile range (reduced buffer from 10 to 4 for performance)
            const buffer = 4;
            const viewWidth = canvas.width / cameraZoom;
            const viewHeight = canvas.height / cameraZoom;
            const startX = Math.max(0, Math.floor(camX / tileSize) - buffer);
            const endX = Math.min(mapCols, Math.ceil((camX + viewWidth) / tileSize) + buffer);
            const startY = Math.max(0, Math.floor(camY / tileSize) - buffer);
            const endY = Math.min(mapRows, Math.ceil((camY + viewHeight) / tileSize) + buffer);

            const playerLayer = playerLayerIndex || 1;

            // Reset pool counter (reuse pre-allocated objects instead of creating new ones)
            entityPoolUsed = 0;

            // Helper to get next pooled entity
            function getPooledEntity(type, gridY, subSort) {
                if (entityPoolUsed >= ENTITY_POOL_SIZE) return null; // Safety limit
                const e = entityPool[entityPoolUsed++];
                e.type = type;
                e.gridY = gridY;
                e.subSort = subSort;
                e.npcIndex = -1;
                e.itemIndex = -1;
                e.placedIndex = -1;
                e.playerId = null;
                return e;
            }

            // Add player
            const playerGridY = Math.floor((player.y + player.height) / (gridSize * TILE_SCALE));
            getPooledEntity('player', playerGridY, 0.5);

            // Add NPCs on current map
            for (let i = 0; i < placedNpcs.length; i++) {
                const placed = placedNpcs[i];
                if (placed.mapName && placed.mapName !== currentGameMap) continue;
                const state = npcRuntimeState[i];
                if (!state) continue;
                const npc = npcs[placed.npcIndex];
                if (!npc) continue;

                const npcGridY = Math.floor((state.y + gridSize) / gridSize);
                const e = getPooledEntity('npc', npcGridY, 0.4);
                if (e) e.npcIndex = i;
            }

            // Add items on current map
            for (let i = 0; i < placedItemsData.length; i++) {
                const placed = placedItemsData[i];
                if (placed.mapName && placed.mapName !== currentGameMap) continue;
                const item = itemsData[placed.itemIndex];
                if (!item) continue;

                const e = getPooledEntity('item', placed.y + 1, 0.3);
                if (e) e.itemIndex = i;
            }

            // Add static objects on current map
            for (let i = 0; i < placedStaticObjectsData.length; i++) {
                const placed = placedStaticObjectsData[i];
                if (placed.mapName && placed.mapName !== currentGameMap) continue;
                const obj = staticObjectsData[placed.objIndex];
                if (!obj) continue;

                const e = getPooledEntity('staticObj', placed.y + (obj.height || 1), 0.2);
                if (e) e.placedIndex = i;
            }

            // Add other multiplayer players
            otherPlayers.forEach((other, odId) => {
                if (other.inTavern || other.currentMap !== currentGameMap) return;
                const otherGridY = Math.floor((other.y + player.height) / (gridSize * TILE_SCALE));
                const e = getPooledEntity('otherPlayer', otherGridY, 0.45);
                if (e) e.playerId = odId;
            });

            // Sort only the used portion of the pool (typically < 50 items)
            // Use a view into the pool array to avoid creating new array
            const usedCount = entityPoolUsed;
            // In-place sort of first N elements
            for (let i = 1; i < usedCount; i++) {
                const current = entityPool[i];
                let j = i - 1;
                while (j >= 0 && (entityPool[j].gridY > current.gridY ||
                       (entityPool[j].gridY === current.gridY && entityPool[j].subSort > current.subSort))) {
                    entityPool[j + 1] = entityPool[j];
                    j--;
                }
                entityPool[j + 1] = current;
            }

            // Track which moving entities we've drawn
            let entityIndex = 0;
            let count = 0;

            // Draw row by row, interleaving tiles and entities
            for (let y = startY; y < endY; y++) {
                // Draw all visible layers at this row (tiles are static, don't need sorting)
                for (let li = 1; li < layers.length; li++) {
                    if (!layerVisibility[li]) continue;
                    const layer = layers[li];
                    if (!layer || !layer[y]) continue;

                    for (let x = startX; x < endX; x++) {
                        const cell = layer[y][x];
                        if (!cell) continue;

                        if (cell.type === 'tile') {
                            const key = (cell.tilesetIndex || 0) + ':' + cell.x + ',' + cell.y;
                            const splitData = tileSplitLines[key];
                            if (splitData !== undefined && splitData !== null) {
                                drawTileTrunk(cell, x, y, camX, camY, tileSize);
                            } else {
                                drawTileFull(cell, x, y, camX, camY, tileSize);
                            }
                            count++;
                        } else if (cell.type === 'animTile') {
                            const propData = animatedPropsData[cell.propIndex];
                            const hasSplit = propData && propData.splitLine !== null && propData.splitLine !== undefined &&
                                (typeof propData.splitLine === 'number' ||
                                 (typeof propData.splitLine === 'object' && Object.keys(propData.splitLine).length > 0));
                            if (hasSplit) {
                                drawAnimTileTrunk(cell, x, y, li, camX, camY, tileSize);
                            } else {
                                drawAnimTile(cell, x, y, li, camX, camY, tileSize);
                            }
                            count++;
                        }
                    }
                }

                // After drawing tiles for this row, draw any entities at this Y
                while (entityIndex < usedCount && entityPool[entityIndex].gridY <= y) {
                    const e = entityPool[entityIndex];
                    if (e.type === 'player') {
                        drawPlayer();
                    } else if (e.type === 'otherPlayer') {
                        drawOtherPlayer(e.playerId, camX, camY);
                    } else if (e.type === 'npc') {
                        drawNPC(e.npcIndex, camX, camY, tileSize);
                    } else if (e.type === 'item') {
                        drawItem(e.itemIndex, camX, camY, tileSize);
                    } else if (e.type === 'staticObj') {
                        drawStaticObject(e.placedIndex, camX, camY, tileSize);
                    }
                    entityIndex++;
                }
            }

            // Draw any remaining entities below the visible area
            while (entityIndex < usedCount) {
                const e = entityPool[entityIndex];
                if (e.type === 'player') drawPlayer();
                else if (e.type === 'otherPlayer') drawOtherPlayer(e.playerId, camX, camY);
                else if (e.type === 'npc') drawNPC(e.npcIndex, camX, camY, tileSize);
                else if (e.type === 'item') drawItem(e.itemIndex, camX, camY, tileSize);
                else if (e.type === 'staticObj') drawStaticObject(e.placedIndex, camX, camY, tileSize);
                entityIndex++;
            }

            return count;
        }

        // Redraw content from higher layers that overlaps with canopy from lower layers
        function redrawHigherLayerContent(camX, camY, tileSize) {
            // Calculate visible tile range (reduced buffer from 10 to 4 for performance)
            const buffer = 4;
            const viewWidth = canvas.width / cameraZoom;
            const viewHeight = canvas.height / cameraZoom;
            const startX = Math.max(0, Math.floor(camX / tileSize) - buffer);
            const endX = Math.min(mapCols, Math.ceil((camX + viewWidth) / tileSize) + buffer);
            const startY = Math.max(0, Math.floor(camY / tileSize) - buffer);
            const endY = Math.min(mapRows, Math.ceil((camY + viewHeight) / tileSize) + buffer);

            // For each position that has canopy (split line), redraw any higher layer content
            for (let li = 1; li < layers.length; li++) {
                if (!layerVisibility[li]) continue;
                const layer = layers[li];
                if (!layer) continue;

                for (let y = startY; y < endY; y++) {
                    if (!layer[y]) continue;
                    for (let x = startX; x < endX; x++) {
                        const cell = layer[y][x];
                        if (!cell) continue;

                        // Check if this cell has canopy (split line)
                        let hasCanopy = false;
                        if (cell.type === 'tile') {
                            const key = (cell.tilesetIndex || 0) + ':' + cell.x + ',' + cell.y;
                            hasCanopy = tileSplitLines[key] !== undefined && tileSplitLines[key] !== null;
                        } else if (cell.type === 'animTile') {
                            const propData = animatedPropsData[cell.propIndex];
                            hasCanopy = propData && propData.splitLine !== null && propData.splitLine !== undefined;
                        }

                        if (!hasCanopy) continue;

                        // This cell has canopy - redraw any higher layer content at this position
                        for (let hi = li + 1; hi < layers.length; hi++) {
                            if (!layerVisibility[hi]) continue;
                            const higherLayer = layers[hi];
                            if (!higherLayer || !higherLayer[y] || !higherLayer[y][x]) continue;

                            const higherCell = higherLayer[y][x];
                            if (higherCell.type === 'animTile') {
                                drawAnimTile(higherCell, x, y, hi, camX, camY, tileSize);
                            } else if (higherCell.type === 'tile') {
                                drawTileFull(higherCell, x, y, camX, camY, tileSize);
                            }
                        }
                    }
                }
            }
        }

        function drawAnimTile(cell, tx, ty, li, camX, camY, tileSize) {
            const propData = animatedPropsData[cell.propIndex];
            const propImg = animPropImages[cell.propIndex];

            if (!propData || !propImg || !propImg.complete || !propData.frames || propData.frames.length === 0) {
                return;
            }

            // Round to integers to prevent tile seams
            const px = Math.round(tx * tileSize - camX);
            const py = Math.round(ty * tileSize - camY);

            // Use origin tile position for synced animation
            const originX = tx - (cell.offsetX || 0);
            const originY = ty - (cell.offsetY || 0);
            const key = originX + ',' + originY + ',' + li;
            const timer = animPropFrameTimers[key] || { frame: 0 };
            const frameIdx = timer.frame % propData.frames.length;
            const frame = propData.frames[frameIdx];

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

            // Scale offset from prop's center (not individual tile center)
            const propCenterOffsetX = (scaledPropWidth - propWidth) / 2;
            const propCenterOffsetY = (scaledPropHeight - propHeight) / 2;

            // This tile's position relative to origin
            const tileOffsetX = offsetX * tileSize;
            const tileOffsetY = offsetY * tileSize;

            // Scale tile offset from prop origin
            const scaledTileOffsetX = tileOffsetX * propScale;
            const scaledTileOffsetY = tileOffsetY * propScale;

            // Origin tile's screen position
            const originPx = Math.floor(originX * tileSize - camX);
            const originPy = Math.floor(originY * tileSize - camY);

            // Draw position: origin - center offset + scaled tile offset
            const drawX = originPx - propCenterOffsetX + scaledTileOffsetX;
            const drawY = originPy - propCenterOffsetY + scaledTileOffsetY;

            ctx.imageSmoothingEnabled = false;

            // Per-instance pixel nudge: fine-position the prop off the grid. Collision shifts to match (checkCollision).
            const _nx = (cell.nudgeX || 0) * (tileSize / gridSize);
            const _ny = (cell.nudgeY || 0) * (tileSize / gridSize);
            const _nudged = _nx || _ny;
            if (_nudged) { ctx.save(); ctx.translate(_nx, _ny); }

            // Per-instance horizontal mirror: reflect the whole prop about its screen-center
            // vertical axis. Wrapping the draw handles multi-tile + scale + rotation in one shot.
            const mirror = cell.mirror;
            if (mirror) {
                ctx.save();
                const centerScreenX = originPx - propCenterOffsetX + scaledPropWidth / 2;
                ctx.translate(centerScreenX, 0);
                ctx.scale(-1, 1);
                ctx.translate(-centerScreenX, 0);
            }

            // Draw with rotation support
            const rot = cell.rotation || 0;
            if (rot === 0) {
                ctx.drawImage(propImg, srcX, srcY, gridSize, gridSize, drawX, drawY, scaledTileSize, scaledTileSize);
            } else {
                ctx.save();
                const propCenterX = originPx + propWidth / 2;
                const propCenterY = originPy + propHeight / 2;
                ctx.translate(propCenterX, propCenterY);
                ctx.rotate(rot * Math.PI / 180);
                const rotDrawX = -scaledPropWidth / 2 + scaledTileOffsetX;
                const rotDrawY = -scaledPropHeight / 2 + scaledTileOffsetY;
                ctx.drawImage(propImg, srcX, srcY, gridSize, gridSize, rotDrawX, rotDrawY, scaledTileSize, scaledTileSize);
                ctx.restore();
            }

            if (mirror) ctx.restore();
            if (_nudged) ctx.restore();
        }

        // Draw only the trunk (bottom) portion of an animated tile with split line
        function drawAnimTileTrunk(cell, tx, ty, li, camX, camY, tileSize) {
            const propData = animatedPropsData[cell.propIndex];
            const propImg = animPropImages[cell.propIndex];
            if (!propData || !propImg || !propImg.complete) return;
            if (!propData.frames || propData.frames.length === 0) return;
            if (!propData.splitLine) return;

            // Round to integers to prevent tile seams (+ per-instance pixel nudge)
            const px = Math.round(tx * tileSize - camX + (cell.nudgeX || 0) * (tileSize / gridSize));
            const py = Math.round(ty * tileSize - camY + (cell.nudgeY || 0) * (tileSize / gridSize));
            const scale = tileSize / gridSize;

            // Use origin tile position for synced animation
            const originX = tx - (cell.offsetX || 0);
            const originY = ty - (cell.offsetY || 0);
            const key = originX + ',' + originY + ',' + li;
            const timer = animPropFrameTimers[key] || { frame: 0 };
            const frameIdx = timer.frame % propData.frames.length;
            const frame = propData.frames[frameIdx];

            // Calculate this tile's portion
            const offsetX = cell.offsetX || 0;
            const offsetY = cell.offsetY || 0;

            // Per-instance horizontal mirror (match drawAnimTile): reflect about the prop's screen-center.
            const mirror = cell.mirror;
            const _twTrunk = cell.tilesW || 1;
            const _cxTrunk = (originX * tileSize - camX) + (_twTrunk * tileSize) / 2 + (cell.nudgeX || 0) * (tileSize / gridSize);
            const blit = (sx, sy, sw, sh, dx, dy, dw, dh) => {
                if (mirror) { ctx.save(); ctx.translate(_cxTrunk, 0); ctx.scale(-1, 1); ctx.translate(-_cxTrunk, 0); }
                ctx.drawImage(propImg, sx, sy, sw, sh, dx, dy, dw, dh);
                if (mirror) ctx.restore();
            };

            // Get split Y for this specific tile within the prop
            const tileKey = offsetX + ',' + offsetY;
            let splitY = null;

            if (typeof propData.splitLine === 'object' && !Array.isArray(propData.splitLine)) {
                // Try per-frame format first: "frameIndex:tileX,tileY"
                const perFrameKey = frameIdx + ':' + tileKey;
                splitY = propData.splitLine[perFrameKey];

                // Fall back to shared format: "tileX,tileY"
                if (splitY === undefined || splitY === null) {
                    splitY = propData.splitLine[tileKey];
                }
            } else if (typeof propData.splitLine === 'number') {
                // Old format: single number (only applies to tile 0,0)
                if (offsetX === 0 && offsetY === 0) splitY = propData.splitLine;
            }

            // If no split for this tile, draw full tile
            if (splitY === null || splitY === undefined) {
                const srcX = frame.x + offsetX * gridSize;
                const srcY = frame.y + offsetY * gridSize;
                ctx.imageSmoothingEnabled = false;
                blit(srcX, srcY, gridSize, gridSize, px, py, tileSize, tileSize);
                return;
            }

            // Handle splitY being an array (freeform line) - use minimum for trunk rendering
            let localSplitY;
            if (Array.isArray(splitY)) {
                // Use minimum value for trunk rendering (draw trunk where split is lowest)
                localSplitY = Math.min(...splitY);
            } else {
                localSplitY = splitY;
            }

            // Only draw if split is within this tile
            if (localSplitY <= 0) {
                // Split is above this tile - draw full tile
                const srcX = frame.x + offsetX * gridSize;
                const srcY = frame.y + offsetY * gridSize;
                ctx.imageSmoothingEnabled = false;
                blit(srcX, srcY, gridSize, gridSize, px, py, tileSize, tileSize);
            } else if (localSplitY < gridSize) {
                // Split is within this tile - draw only trunk (below split)
                const srcX = frame.x + offsetX * gridSize;
                const srcY = frame.y + offsetY * gridSize + localSplitY;
                const srcH = gridSize - localSplitY;
                const destY = py + localSplitY * scale;
                const destH = srcH * scale;

                ctx.imageSmoothingEnabled = false;
                blit(srcX, srcY, gridSize, srcH, px, destY, tileSize, destH);
            }
            // If localSplitY >= gridSize, split is below this tile - don't draw trunk here
        }

        function drawTileFull(cell, tx, ty, camX, camY, tileSize) {
            const px = tx * tileSize - camX;
            const py = ty * tileSize - camY;
            const cellTileset = tilesetImages[cell.tilesetIndex || 0] || tilesetImages[0];

            if (cellTileset) {
                ctx.imageSmoothingEnabled = false;
                drawTileWithEffects(ctx, cellTileset, cell.x, cell.y, gridSize, px, py, tileSize, cell.rotation || 0, cell.flipped || false);
            }

            // Draw collision overlay if debug enabled
            if (showCollision) {
                const tilesetIdx = cell.tilesetIndex || 0;
                const key = tilesetIdx + ':' + cell.x + ',' + cell.y;
                const mask = collisionMasks[key];

                if (mask) {
                    const pixelSize = tileSize / gridSize;
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                    for (let my = 0; my < gridSize; my++) {
                        for (let mx = 0; mx < gridSize; mx++) {
                            if (mask[my] && mask[my][mx]) {
                                ctx.fillRect(px + mx * pixelSize, py + my * pixelSize, pixelSize, pixelSize);
                            }
                        }
                    }
                } else if (tileCollisions[key]) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                    ctx.fillRect(px, py, tileSize, tileSize);
                }
            }
        }

        function drawTileTrunk(cell, tx, ty, camX, camY, tileSize) {
            const key = (cell.tilesetIndex || 0) + ':' + cell.x + ',' + cell.y;
            const splitData = tileSplitLines[key];
            const cellTileset = tilesetImages[cell.tilesetIndex || 0] || tilesetImages[0];
            const isFlipped = tileSplitLineFlipped[key] || false;

            if (!cellTileset || splitData === undefined) return;

            // Round to integers to prevent tile seams
            const px = Math.round(tx * tileSize - camX);
            const py = Math.round(ty * tileSize - camY);
            const scale = tileSize / gridSize;

            ctx.imageSmoothingEnabled = false;

            // Handle rotation or flip
            const rot = cell.rotation || 0;
            if (rot !== 0 || cell.flipped) {
                // For rotated/flipped tiles, just draw full tile (rotation + split is complex)
                drawTileWithEffects(ctx, cellTileset, cell.x, cell.y, gridSize, px, py, tileSize, rot, cell.flipped || false);
                return;
            }

            // Draw trunk using clipping path for freeform line
            ctx.save();
            ctx.beginPath();

            const splitYArray = resolveSplitArray(splitData, gridSize);

            if (isFlipped) {
                // FLIPPED: Trunk is ABOVE the split line (top portion is Y-sorted)
                // Start at top-left, go along top edge
                ctx.moveTo(px, py);
                ctx.lineTo(px + tileSize, py);
                // Go down right edge to last split point
                ctx.lineTo(px + tileSize, py + splitYArray[gridSize - 1] * scale);
                // Draw along the split line (right to left)
                for (let col = gridSize - 1; col >= 0; col--) {
                    const splitY = splitYArray[col];
                    ctx.lineTo(px + (col + 1) * scale, py + splitY * scale);
                    ctx.lineTo(px + col * scale, py + splitY * scale);
                }
                // Close back to top-left
                ctx.lineTo(px, py);
            } else {
                // NORMAL: Trunk is BELOW the split line (bottom portion is Y-sorted)
                // Start at bottom-left, go up the left edge to first split point
                ctx.moveTo(px, py + tileSize);
                ctx.lineTo(px, py + splitYArray[0] * scale);
                // Draw along the split line (left to right)
                for (let col = 0; col < gridSize; col++) {
                    const splitY = splitYArray[col];
                    ctx.lineTo(px + col * scale, py + splitY * scale);
                    ctx.lineTo(px + (col + 1) * scale, py + splitY * scale);
                }
                // Go down right edge and close
                ctx.lineTo(px + tileSize, py + tileSize);
            }
            ctx.closePath();
            ctx.clip();

            // Draw the full tile, clipped to trunk region
            ctx.drawImage(cellTileset, cell.x, cell.y, gridSize, gridSize, px, py, tileSize, tileSize);
            ctx.restore();

            // Draw collision overlay if debug enabled
            if (showCollision) {
                const mask = collisionMasks[key];
                if (mask) {
                    const pixelSize = tileSize / gridSize;
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                    for (let my = 0; my < gridSize; my++) {
                        for (let mx = 0; mx < gridSize; mx++) {
                            if (mask[my] && mask[my][mx]) {
                                ctx.fillRect(px + mx * pixelSize, py + my * pixelSize, pixelSize, pixelSize);
                            }
                        }
                    }
                } else if (tileCollisions[key]) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                    ctx.fillRect(px, py, tileSize, tileSize);
                }
            }
        }

        function drawCanopyOverlay(camX, camY, tileSize) {
            // Calculate visible tile range with generous buffer (10 tiles)
            const buffer = 10;
            const viewWidth = canvas.width / cameraZoom;
            const viewHeight = canvas.height / cameraZoom;
            const startX = Math.max(0, Math.floor(camX / tileSize) - buffer);
            const endX = Math.min(mapCols, Math.ceil((camX + viewWidth) / tileSize) + buffer);
            const startY = Math.max(0, Math.floor(camY / tileSize) - buffer);
            const endY = Math.min(mapRows, Math.ceil((camY + viewHeight) / tileSize) + buffer);

            // Draw canopy portions (above split line) for all split tiles
            for (let li = 1; li < layers.length; li++) {
                if (!layerVisibility[li]) continue;
                const layer = layers[li];
                if (!layer) continue;

                for (let y = startY; y < endY; y++) {
                    if (!layer[y]) continue;
                    for (let x = startX; x < endX; x++) {
                        const cell = layer[y][x];
                        if (!cell) continue;

                        // Round to integers to prevent tile seams
                        const px = Math.round(x * tileSize - camX);
                        const py = Math.round(y * tileSize - camY);
                        const scale = tileSize / gridSize;

                        if (cell.type === 'tile') {
                            const key = (cell.tilesetIndex || 0) + ':' + cell.x + ',' + cell.y;
                            const splitData = tileSplitLines[key];
                            if (splitData === undefined || splitData === null) continue;

                            const cellTileset = tilesetImages[cell.tilesetIndex || 0] || tilesetImages[0];
                            if (!cellTileset) continue;
                            const isFlipped = tileSplitLineFlipped[key] || false;

                            ctx.imageSmoothingEnabled = false;

                            // Handle rotation / flip
                            const rot = cell.rotation || 0;
                            // Skip rotated OR flipped tiles — drawTileTrunk already drew them FULL
                            // (its early-return fires on rot !== 0 OR cell.flipped). Without the
                            // cell.flipped check here, a flipped tile's canopy was redrawn UN-flipped on
                            // top of the full flipped tile, scrambling the crown/holes.
                            if (rot !== 0 || cell.flipped) continue;

                            // Draw canopy using clipping path for freeform line
                            ctx.save();
                            ctx.beginPath();

                            const splitYArray = resolveSplitArray(splitData, gridSize);

                            if (isFlipped) {
                                // FLIPPED: Canopy is BELOW the split line (bottom portion covers player)
                                // Start at bottom-left, go up the left edge to first split point
                                ctx.moveTo(px, py + tileSize);
                                ctx.lineTo(px, py + splitYArray[0] * scale);
                                // Draw along the split line (left to right)
                                for (let col = 0; col < gridSize; col++) {
                                    const splitY = splitYArray[col];
                                    ctx.lineTo(px + col * scale, py + splitY * scale);
                                    ctx.lineTo(px + (col + 1) * scale, py + splitY * scale);
                                }
                                // Go down right edge and close
                                ctx.lineTo(px + tileSize, py + tileSize);
                            } else {
                                // NORMAL: Canopy is ABOVE the split line (top portion covers player)
                                // Start at top-left, go along top edge
                                ctx.moveTo(px, py);
                                ctx.lineTo(px + tileSize, py);
                                // Go down right edge to last split point
                                ctx.lineTo(px + tileSize, py + splitYArray[gridSize - 1] * scale);
                                // Draw along the split line (right to left)
                                for (let col = gridSize - 1; col >= 0; col--) {
                                    const splitY = splitYArray[col];
                                    ctx.lineTo(px + (col + 1) * scale, py + splitY * scale);
                                    ctx.lineTo(px + col * scale, py + splitY * scale);
                                }
                                // Go up left edge and close
                                ctx.lineTo(px, py);
                            }
                            ctx.closePath();
                            ctx.clip();

                            // Draw the full tile, clipped to canopy region
                            ctx.drawImage(cellTileset, cell.x, cell.y, gridSize, gridSize, px, py, tileSize, tileSize);
                            ctx.restore();

                        } else if (cell.type === 'animTile') {
                            // Animated tile canopy
                            const propData = animatedPropsData[cell.propIndex];
                            const propImg = animPropImages[cell.propIndex];
                            if (!propData || !propImg || !propImg.complete) continue;
                            if (propData.splitLine === null || propData.splitLine === undefined) continue;
                            if (!propData.frames || propData.frames.length === 0) continue;

                            // Get current animation frame
                            const originX = x - (cell.offsetX || 0);
                            const originY = y - (cell.offsetY || 0);
                            const key = originX + ',' + originY + ',' + li;
                            const timer = animPropFrameTimers[key] || { frame: 0 };
                            const frameIdx = timer.frame % propData.frames.length;
                            const frame = propData.frames[frameIdx];

                            const offsetX = cell.offsetX || 0;
                            const offsetY = cell.offsetY || 0;

                            // Get split Y for this specific tile within the prop
                            const tileKey = offsetX + ',' + offsetY;
                            let splitY = null;

                            if (typeof propData.splitLine === 'object' && !Array.isArray(propData.splitLine)) {
                                // Try per-frame format first: "frameIndex:tileX,tileY"
                                const perFrameKey = frameIdx + ':' + tileKey;
                                splitY = propData.splitLine[perFrameKey];

                                // Fall back to shared format: "tileX,tileY"
                                if (splitY === undefined || splitY === null) {
                                    splitY = propData.splitLine[tileKey];
                                }
                            } else if (typeof propData.splitLine === 'number') {
                                // Old format: single number (only applies to tile 0,0)
                                if (offsetX === 0 && offsetY === 0) splitY = propData.splitLine;
                            }

                            // If no split for this tile, skip canopy
                            if (splitY === null || splitY === undefined) continue;

                            // Handle splitY being an array (freeform line) - use maximum for canopy rendering
                            let localSplitY;
                            if (Array.isArray(splitY)) {
                                // Use maximum value for canopy rendering (draw canopy where split is highest)
                                localSplitY = Math.max(...splitY);
                            } else {
                                localSplitY = splitY;
                            }

                            // Only draw canopy if split is within this tile
                            if (localSplitY > 0 && localSplitY < gridSize) {
                                const srcX = frame.x + offsetX * gridSize;
                                const srcY = frame.y + offsetY * gridSize;
                                const srcH = localSplitY;
                                const destH = srcH * scale;

                                ctx.imageSmoothingEnabled = false;
                                ctx.drawImage(propImg, srcX, srcY, gridSize, srcH, px, py, tileSize, destH);
                            } else if (localSplitY >= gridSize) {
                                // Full tile is canopy (split at bottom)
                                const srcX = frame.x + offsetX * gridSize;
                                const srcY = frame.y + offsetY * gridSize;

                                ctx.imageSmoothingEnabled = false;
                                ctx.drawImage(propImg, srcX, srcY, gridSize, gridSize, px, py, tileSize, tileSize);
                            }
                        }
                    }
                }
            }
        }

        // Draw collision debug overlay on top of everything (for split tiles that get covered by canopy)
        function drawCollisionDebugOverlay(camX, camY, tileSize) {
            const pixelSize = tileSize / gridSize;

            // Calculate visible tile range with generous buffer (10 tiles)
            const buffer = 10;
            const viewWidth = canvas.width / cameraZoom;
            const viewHeight = canvas.height / cameraZoom;
            const startX = Math.max(0, Math.floor(camX / tileSize) - buffer);
            const endX = Math.min(mapCols, Math.ceil((camX + viewWidth) / tileSize) + buffer);
            const startY = Math.max(0, Math.floor(camY / tileSize) - buffer);
            const endY = Math.min(mapRows, Math.ceil((camY + viewHeight) / tileSize) + buffer);

            // Draw collision for all tiles in all layers (on top of canopy)
            for (let li = 0; li < layers.length; li++) {
                if (!layerVisibility[li]) continue;
                const layer = layers[li];
                if (!layer) continue;

                for (let y = startY; y < endY; y++) {
                    if (!layer[y]) continue;
                    for (let x = startX; x < endX; x++) {
                        const cell = layer[y][x];
                        if (!cell) continue;

                        const px = x * tileSize - camX;
                        const py = y * tileSize - camY;

                        if (cell.type === 'tile') {
                            const tilesetIdx = cell.tilesetIndex || 0;
                            const key = tilesetIdx + ':' + cell.x + ',' + cell.y;
                            const mask = collisionMasks[key];

                            if (mask) {
                                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                                for (let my = 0; my < gridSize; my++) {
                                    for (let mx = 0; mx < gridSize; mx++) {
                                        if (mask[my] && mask[my][mx]) {
                                            ctx.fillRect(px + mx * pixelSize, py + my * pixelSize, pixelSize, pixelSize);
                                        }
                                    }
                                }
                            } else if (tileCollisions[key]) {
                                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                                ctx.fillRect(px, py, tileSize, tileSize);
                            }
                        } else if (cell.type === 'prop') {
                            const propIdx = cell.propIndex || 0;
                            const propKey = cell.x + ',' + cell.y;
                            const mask = propCollisionMasksAll[propIdx] ? propCollisionMasksAll[propIdx][propKey] : null;
                            if (mask) {
                                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                                for (let my = 0; my < gridSize; my++) {
                                    for (let mx = 0; mx < gridSize; mx++) {
                                        if (mask[my] && mask[my][mx]) {
                                            ctx.fillRect(px + mx * pixelSize, py + my * pixelSize, pixelSize, pixelSize);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Draw static object collision boxes (dark green outline)
            if (placedStaticObjectsData) {
                placedStaticObjectsData.forEach((placed, i) => {
                    if (placed.mapName && placed.mapName !== currentGameMap) return;

                    const obj = staticObjectsData[placed.objIndex];
                    if (!obj) return;

                    const scale = placed.scale || 1;
                    const objPixelX = placed.x * tileSize - camX;
                    const objPixelY = placed.y * tileSize - camY;
                    const objPixelW = obj.width * tileSize * scale;
                    const objPixelH = obj.height * tileSize * scale;

                    // Skip off-screen
                    if (objPixelX + objPixelW < 0 || objPixelX > canvas.width / cameraZoom ||
                        objPixelY + objPixelH < 0 || objPixelY > canvas.height / cameraZoom) return;

                    // Draw dark green collision outline (same as builder)
                    ctx.strokeStyle = '#4a7c59';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(objPixelX, objPixelY, objPixelW, objPixelH);

                    // Also fill with semi-transparent green to show collision area
                    ctx.fillStyle = 'rgba(74, 124, 89, 0.2)';
                    ctx.fillRect(objPixelX, objPixelY, objPixelW, objPixelH);
                });
            }
        }

        function drawPlayer() {
            const camX = Math.round(camera.x);
            const camY = Math.round(camera.y);
            // Don't round player offset - keep fractional for smooth interpolation on high refresh rate monitors
            const sx = player.x - camX;
            const sy = player.y - camY;

            // Use player character animation if available, otherwise use legacy layout
            let srcX = 0, srcY = 0, srcW = playerFrameWidth, srcH = playerFrameHeight;
            let flipX = false;

            if (playerAnimations) {
                // New animation system: use frame data from playerAnimations
                const dirMap = {
                    down: 'walkDown',
                    up: 'walkUp',
                    left: 'walkLeft',
                    right: 'walkRight'
                };
                const idleDirMap = {
                    down: 'idleDown',
                    up: 'idleUp',
                    left: 'idleLeft',
                    right: 'idleRight'
                };
                const attackDirMap = {
                    down: 'attackDown',
                    up: 'attackUp',
                    left: 'attackLeft',
                    right: 'attackRight'
                };
                let animKey;
                let useDeathFrame = false;
                if (playerDying) {
                    // Death animation
                    animKey = 'death';
                    useDeathFrame = true;
                } else if (player.attacking && player.attackAnim) {
                    // A throw plays its own chosen animation if one is set; otherwise the directional attack.
                    if (player.throwing && player.throwAnimKey && playerAnimations[player.throwAnimKey] && playerAnimations[player.throwAnimKey].length > 0) {
                        animKey = player.throwAnimKey;
                    } else {
                        const attackKey = attackDirMap[cardinalOf(player.direction)];
                        if (playerAnimations[attackKey] && playerAnimations[attackKey].length > 0) {
                            animKey = attackKey;
                        } else if (playerAnimations.attack && playerAnimations.attack.length > 0) {
                            // Fall back to generic attack
                            animKey = 'attack';
                        } else {
                            // No attack animation, use walk
                            animKey = dirMap[cardinalOf(player.direction)];
                        }
                    }
                } else if (isReceivingItem && receivingItemData) {
                    // Receive item animation
                    const receiveItemDirMap = {
                        down: 'receiveItemDown',
                        up: 'receiveItemUp',
                        left: 'receiveItemLeft',
                        right: 'receiveItemRight'
                    };
                    const receiveKey = receiveItemDirMap[cardinalOf(player.direction)];
                    if (playerAnimations[receiveKey] && playerAnimations[receiveKey].length > 0) {
                        animKey = receiveKey;
                    } else if (playerAnimations.receivedItem && playerAnimations.receivedItem.length > 0) {
                        animKey = 'receivedItem';
                    } else {
                        // No receive animation, use idle
                        const dirIdleKey = idleDirMap[cardinalOf(player.direction)];
                        if (playerAnimations[dirIdleKey] && playerAnimations[dirIdleKey].length > 0) {
                            animKey = dirIdleKey;
                        } else {
                            animKey = 'idle';
                        }
                    }
                } else if (player.fishing) {
                    // Fishing: cast (one-shot) then wait-for-bite (loop), directional
                    const fsuf = player.fishing.dir.charAt(0).toUpperCase() + player.fishing.dir.slice(1);
                    const fk = (player.fishing.phase === 'cast' ? 'fishCast' : 'fishWait') + fsuf;
                    if (playerAnimations[fk] && playerAnimations[fk].length > 0) {
                        animKey = fk;
                    } else {
                        const dirIdleKey = idleDirMap[cardinalOf(player.direction)];
                        animKey = (playerAnimations[dirIdleKey] && playerAnimations[dirIdleKey].length) ? dirIdleKey : 'idle';
                    }
                } else if (player.moving) {
                    // Walk: resolve diagonal->mirror->cardinal (handles 8-dir and 4-dir sprites)
                    const _wr = resolveWalkKey(playerAnimations, player.direction);
                    animKey = _wr.key;
                    if (_wr.flip) flipX = true;
                } else {
                    // Check for directional idle first, then fall back to generic idle
                    const dirIdleKey = idleDirMap[cardinalOf(player.direction)];
                    if (playerAnimations[dirIdleKey] && playerAnimations[dirIdleKey].length > 0) {
                        animKey = dirIdleKey;
                    } else {
                        animKey = 'idle';
                    }
                }
                let frames = playerAnimations[animKey];

                // Fallback: if no idle frames, use first frame of walkDown
                if (!frames || frames.length === 0) {
                    frames = playerAnimations.walkDown || [];
                }
                // Fallback for left: use right and flip
                if ((!frames || frames.length === 0) && player.direction === 'left') {
                    frames = playerAnimations.walkRight || [];
                    flipX = true;
                }

                let currentSheetIndex = 0;
                if (frames && frames.length > 0) {
                    // Use attackFrame for attack animations, deathAnimFrame for death, receiveItemFrame for receive, otherwise use regular frame
                    let frameIndex;
                    if (useDeathFrame) {
                        frameIndex = Math.min(deathAnimFrame, frames.length - 1);
                    } else if (player.attacking && player.attackAnim) {
                        frameIndex = (player.attackFrame || 0) % frames.length;
                    } else if (isReceivingItem && receivingItemData) {
                        frameIndex = Math.min(receivingItemData.frame || 0, frames.length - 1);
                    } else if (player.fishing) {
                        frameIndex = (player.fishing.frame || 0) % frames.length;
                    } else {
                        frameIndex = player.frame % frames.length;
                    }
                    const frame = frames[frameIndex];
                    srcX = frame.x;
                    srcY = frame.y;
                    srcW = frame.w;
                    srcH = frame.h;
                    currentSheetIndex = frame.sheet || 0;
                }

                // Use the correct sprite sheet for this frame
                if (playerSpriteSheets && playerSpriteSheets[currentSheetIndex]) {
                    playerImg = playerSpriteSheets[currentSheetIndex];
                }

                // Check if this animation should be mirrored (from player editor mirror toggle)
                if (playerAnimMirrors && playerAnimMirrors[animKey]) {
                    flipX = !flipX; // Toggle flip - if already flipping, unflip; if not, flip
                }

                // Handle left direction by mirroring right (fallback if no walkLeft defined)
                if (player.direction === 'left' && (!playerAnimations.walkLeft || playerAnimations.walkLeft.length === 0)) {
                    flipX = true;
                }
            } else {
                // Legacy sprite layout: 1024x512, 16 cols x 8 rows = 64x64 each
                const frameWidth = 64;
                const frameHeight = 64;

                // Idle frames (Row 0)
                const idleFrames = {
                    down: [0, 1, 2],
                    up: [3, 4, 5],
                    right: [6, 7, 8],
                    left: [6, 7, 8]
                };

                // Walk frames
                const walkFrames = {
                    down: { row: 0, cols: [9, 10, 11, 12] },
                    up: { row: 0, cols: [13, 14, 15] },
                    right: { row: 1, cols: [1, 2, 3, 4] },
                    left: { row: 1, cols: [1, 2, 3, 4] }
                };

                let row = 0;
                let col = 0;
                const pdir = cardinalOf(player.direction); // legacy 4-key tables have no diagonals (defensive)

                if (player.attacking) {
                    row = walkFrames[pdir].row;
                    col = walkFrames[pdir].cols[player.frame % walkFrames[pdir].cols.length];
                    if (pdir === 'left') flipX = true;
                } else if (player.moving) {
                    const walk = walkFrames[pdir];
                    row = walk.row;
                    col = walk.cols[player.frame % walk.cols.length];
                    if (pdir === 'left') flipX = true;
                } else {
                    row = 0;
                    col = idleFrames[pdir][player.frame % idleFrames[pdir].length];
                    if (pdir === 'left') flipX = true;
                }

                srcX = col * frameWidth;
                srcY = row * frameHeight;
                srcW = frameWidth;
                srcH = frameHeight;
            }

            const drawW = Math.round(playerFrameWidth * playerScale);
            const drawH = Math.round(playerFrameHeight * playerScale);

            // Center sprite on collision box
            // Collision box should cover body from feet to near head
            // Sprite is drawn so collision box aligns with the character body
            const spriteX = sx + player.width / 2 - drawW / 2;
            const spriteY = sy - 15; // shift sprite up so collision box covers body properly

            // Simple ellipse shadow under hero (unless disabled)
            if (!playerNoShadow) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.beginPath();
                ctx.ellipse(
                    spriteX + drawW / 2,
                    spriteY + drawH - playerShadowYOffset,
                    drawW * (playerShadowWidth / 100),
                    drawW * (playerShadowHeight / 100),
                    0, 0, Math.PI * 2
                );
                ctx.fill();
            }

            // Invincibility flashing effect - blink every 4 frames
            const shouldDraw = !player.invincible || (Math.floor(player.invincibleTimer / 4) % 2 === 0);

            if (playerImg.complete && shouldDraw) {
                // Tint red briefly when just hit
                if (player.invincible && player.invincibleTimer > 80) {
                    ctx.globalAlpha = 0.7;
                }
                if (flipX) {
                    ctx.save();
                    ctx.translate(spriteX + drawW, spriteY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(playerImg, srcX, srcY, srcW, srcH, 0, 0, drawW, drawH);
                    ctx.restore();
                } else {
                    ctx.drawImage(playerImg, srcX, srcY, srcW, srcH, spriteX, spriteY, drawW, drawH);
                }
                ctx.globalAlpha = 1;
            } else if (!playerImg.complete) {
                ctx.fillStyle = '#4a7';
                ctx.fillRect(sx, sy, player.width, player.height);
            }

            // Draw floating item above player when receiving
            if (isReceivingItem && receivingItemData) {
                const floatX = spriteX + drawW / 2;
                const floatY = spriteY;
                drawFloatingItem(floatX, floatY);
            }

            // Attack effect removed - using attack animation instead

            // DEBUG: Draw collision box (shows actual foot hitbox used for collision)
            if (showCollision) {
                // Always show the small foot hitbox (bottom 1/3)
                const collisionHeight = player.height / 3;
                const collisionOffsetY = player.height * 2/3;

                ctx.strokeStyle = '#0f0';
                ctx.lineWidth = 2;
                ctx.strokeRect(sx, sy + collisionOffsetY, player.width, collisionHeight);

                // Draw center point of collision box
                ctx.fillStyle = '#0f0';
                ctx.beginPath();
                ctx.arc(sx + player.width / 2, sy + collisionOffsetY + collisionHeight / 2, 3, 0, Math.PI * 2);
                ctx.fill();

                // Draw attack hitbox preview (dark blue, always visible in debug)
                const dir = cardinalOf(player.direction); // collapse diagonal->cardinal for hitbox geometry
                const hbRange = playerHitboxRange[dir] || 40;
                const hbWidth = playerHitboxWidth[dir] || 60;
                const hbOffX = playerHitboxOffsetX[dir] || 0;
                const hbOffY = playerHitboxOffsetY[dir] || 0;

                if (hbRange > 0) {
                    const range = hbRange * TILE_SCALE;
                    const halfAngle = (hbWidth / 2) * (Math.PI / 180);
                    const dirAngles = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
                    const baseAngle = dirAngles[dir] || 0;

                    const centerX = sx + player.width / 2 + hbOffX * TILE_SCALE;
                    const centerY = sy + player.height / 2 + hbOffY * TILE_SCALE;

                    // Draw preview cone (dark blue, semi-transparent)
                    ctx.fillStyle = 'rgba(30, 60, 120, 0.3)';
                    ctx.strokeStyle = 'rgba(60, 120, 200, 0.6)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(centerX, centerY);
                    ctx.lineTo(
                        centerX + Math.cos(baseAngle - halfAngle) * range,
                        centerY + Math.sin(baseAngle - halfAngle) * range
                    );
                    ctx.arc(centerX, centerY, range, baseAngle - halfAngle, baseAngle + halfAngle);
                    ctx.lineTo(centerX, centerY);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Draw yellow origin dot
                    ctx.fillStyle = '#ff0';
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

                // Draw player attack hitbox cone when attacking (magenta - active)
                if (player.attacking && player.attackAnim && hbRange > 0) {
                    const range = hbRange * TILE_SCALE;
                    const halfAngle = (hbWidth / 2) * (Math.PI / 180);
                    const dirAngles = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
                    const baseAngle = dirAngles[dir] || 0;

                    const centerX = sx + player.width / 2 + hbOffX * TILE_SCALE;
                    const centerY = sy + player.height / 2 + hbOffY * TILE_SCALE;

                    // Draw cone/triangle shape
                    ctx.fillStyle = 'rgba(255, 0, 255, 0.35)';
                    ctx.strokeStyle = 'rgba(255, 0, 255, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(centerX, centerY);
                    // Left edge of cone
                    ctx.lineTo(
                        centerX + Math.cos(baseAngle - halfAngle) * range,
                        centerY + Math.sin(baseAngle - halfAngle) * range
                    );
                    // Arc at the end of the cone
                    ctx.arc(centerX, centerY, range, baseAngle - halfAngle, baseAngle + halfAngle);
                    // Right edge back to center
                    ctx.lineTo(centerX, centerY);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
            }
        }

        // Draw other multiplayer player
        function drawOtherPlayer(playerId, camX, camY) {
            const other = otherPlayers.get(playerId);
            if (!other) return;

            // Don't round - keep fractional for smooth interpolation on high refresh rate monitors
            const sx = other.x - camX;
            const sy = other.y - camY;
            const dir = other.direction || 'down';

            // Use player character animation if available, otherwise use legacy layout
            let srcX = 0, srcY = 0, srcW = playerFrameWidth, srcH = playerFrameHeight;
            let flipX = false;

            if (playerAnimations) {
                // New animation system - match local player's logic
                const dirMap = { down: 'walkDown', up: 'walkUp', left: 'walkLeft', right: 'walkRight' };
                const idleDirMap = { down: 'idleDown', up: 'idleUp', left: 'idleLeft', right: 'idleRight' };
                const attackDirMap = { down: 'attackDown', up: 'attackUp', left: 'attackLeft', right: 'attackRight' };

                let animKey;
                let useAttackFrame = false;

                if (other.animation === 'attack') {
                    // Check for directional attack animation
                    const attackKey = attackDirMap[cardinalOf(dir)];
                    if (playerAnimations[attackKey] && playerAnimations[attackKey].length > 0) {
                        animKey = attackKey;
                    } else if (playerAnimations.attack && playerAnimations.attack.length > 0) {
                        animKey = 'attack';
                    } else {
                        animKey = dirMap[cardinalOf(dir)];
                    }
                    useAttackFrame = true;
                } else if (other.animation === 'walk') {
                    const _wr = resolveWalkKey(playerAnimations, dir);
                    animKey = _wr.key;
                    if (_wr.flip) flipX = true;
                } else {
                    // Idle - check for directional idle first
                    const dirIdleKey = idleDirMap[cardinalOf(dir)];
                    if (playerAnimations[dirIdleKey] && playerAnimations[dirIdleKey].length > 0) {
                        animKey = dirIdleKey;
                    } else {
                        animKey = 'idle';
                    }
                }

                let frames = playerAnimations[animKey];

                // Fallback: if no frames, use walkDown
                if (!frames || frames.length === 0) {
                    frames = playerAnimations.walkDown || [];
                }
                // Fallback for left: use right and flip
                if ((!frames || frames.length === 0) && dir === 'left') {
                    frames = playerAnimations.walkRight || [];
                    flipX = true;
                }

                let currentSheetIndex = 0;
                if (frames && frames.length > 0) {
                    let frameIndex;
                    if (useAttackFrame) {
                        frameIndex = (other.attackFrame || 0) % frames.length;
                    } else {
                        frameIndex = other.frame % frames.length;
                    }
                    const frame = frames[frameIndex];
                    srcX = frame.x;
                    srcY = frame.y;
                    srcW = frame.w;
                    srcH = frame.h;
                    currentSheetIndex = frame.sheet || 0;
                }

                // Use the correct sprite sheet for this frame
                if (playerSpriteSheets && playerSpriteSheets[currentSheetIndex]) {
                    playerImg = playerSpriteSheets[currentSheetIndex];
                }

                // Check if this animation should be mirrored (from player editor mirror toggle)
                if (playerAnimMirrors && playerAnimMirrors[animKey]) {
                    flipX = !flipX;
                }

                // Handle left direction by mirroring right (fallback if no walkLeft defined)
                if (dir === 'left' && (!playerAnimations.walkLeft || playerAnimations.walkLeft.length === 0)) {
                    flipX = true;
                }
            } else {
                // Legacy sprite layout
                const frameWidth = 64;
                const frameHeight = 64;

                const idleFrames = {
                    down: [0, 1, 2], up: [3, 4, 5], right: [6, 7, 8], left: [6, 7, 8]
                };
                const walkFrames = {
                    down: { row: 0, cols: [9, 10, 11, 12] },
                    up: { row: 0, cols: [13, 14, 15] },
                    right: { row: 1, cols: [1, 2, 3, 4] },
                    left: { row: 1, cols: [1, 2, 3, 4] }
                };

                let row = 0, col = 0;
                const ldir = cardinalOf(dir); // legacy 4-key tables have no diagonals; collapse to avoid undefined lookup
                if (other.animation === 'walk') {
                    const walk = walkFrames[ldir];
                    row = walk.row;
                    col = walk.cols[other.frame % walk.cols.length];
                    if (ldir === 'left') flipX = true;
                } else {
                    row = 0;
                    col = idleFrames[ldir][other.frame % idleFrames[ldir].length];
                    if (ldir === 'left') flipX = true;
                }

                srcX = col * frameWidth;
                srcY = row * frameHeight;
                srcW = frameWidth;
                srcH = frameHeight;
            }

            const drawW = Math.round(playerFrameWidth * playerScale);
            const drawH = Math.round(playerFrameHeight * playerScale);
            const spriteX = sx + player.width / 2 - drawW / 2;
            const spriteY = sy - 15;

            // Shadow (use player shadow settings)
            if (!playerNoShadow) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.beginPath();
                ctx.ellipse(spriteX + drawW / 2, spriteY + drawH - playerShadowYOffset, drawW * 0.2, drawW * 0.08, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw sprite
            if (playerImg.complete) {
                ctx.save();
                if (flipX) {
                    ctx.translate(spriteX + drawW, spriteY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(playerImg, srcX, srcY, srcW, srcH, 0, 0, drawW, drawH);
                } else {
                    ctx.drawImage(playerImg, srcX, srcY, srcW, srcH, spriteX, spriteY, drawW, drawH);
                }
                ctx.restore();
            }

            // Draw nametag above player
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            const nameWidth = ctx.measureText(other.name).width + 8;
            ctx.fillRect(spriteX + drawW / 2 - nameWidth / 2, spriteY - 18, nameWidth, 14);
            ctx.fillStyle = '#fff';
            ctx.fillText(other.name, spriteX + drawW / 2, spriteY - 8);
        }

        // Draw NPC with correct animation based on direction
        function drawNPC(npcIdx, camX, camY, tileSize) {
            const placed = placedNpcs[npcIdx];
            const state = npcRuntimeState[npcIdx];
            const npc = npcs[placed.npcIndex];
            const img = npcImages[placed.npcIndex];

            if (!placed || !state || !npc || !img || !img.complete) return;

            // Skip dead enemies
            if (state.dead) return;

            // Round to prevent sub-pixel blur (NPCs don't use interpolation like player does)
            const sx = Math.round(state.x * TILE_SCALE - camX);
            const sy = Math.round(state.y * TILE_SCALE - camY);

            // Get correct animation based on direction or waypoint animation
            const anims = npc.animations || {};
            const dirMap = {
                'down': 'walkDown',
                'up': 'walkUp',
                'left': 'walkLeft',
                'right': 'walkRight'
            };
            const attackDirMap = {
                'down': 'attackDown',
                'up': 'attackUp',
                'left': 'attackLeft',
                'right': 'attackRight'
            };
            // Use waypoint animation if set AND has frames, otherwise use walk/idle based on state
            let animKey;
            let useAttackFrame = false;
            let npcWalkFlip = false; // set by resolveWalkKey when a diagonal/left mirrors its opposite
            // Check if playing attack animation (enemy attacking)
            if (state.attackAnimTimer > 0 && placed.isEnemy) {
                const attackKey = attackDirMap[cardinalOf(state.direction)];
                if (anims[attackKey] && anims[attackKey].length > 0) {
                    animKey = attackKey;
                    useAttackFrame = true;
                } else {
                    // No attack anim, use walk anim (diagonal-aware)
                    const _wr = resolveWalkKey(anims, state.direction);
                    animKey = _wr.key;
                    if (_wr.flip) npcWalkFlip = true;
                }
            } else if (state.waypointAnimation && state.waypointAnimation !== 'walk' &&
                anims[state.waypointAnimation] && anims[state.waypointAnimation].length > 0) {
                animKey = state.waypointAnimation;
            } else if (state.moving) {
                const _wr = resolveWalkKey(anims, state.direction);
                animKey = _wr.key;
                if (_wr.flip) npcWalkFlip = true;
            } else {
                animKey = 'idle';
            }
            let anim = anims[animKey];

            // Fallback to any available animation
            if (!anim || anim.length === 0) {
                anim = (anims.walkDown?.length > 0 ? anims.walkDown : null) ||
                       (anims.idle?.length > 0 ? anims.idle : null) ||
                       Object.values(anims).find(a => a && a.length > 0);
            }
            if (!anim || anim.length === 0) return;

            // Get current frame (use attack frame counter for attack anims)
            let frameIdx;
            if (useAttackFrame) {
                // Advance attack frames at the NPC's configured FPS (same clock as walk/idle) so the
                // attack speed matches the rest of the animation instead of a fixed window.
                const atkFps = placed.animSpeed || npc.fps || 8;
                const atkTicks = Math.max(1, Math.round(60 / atkFps));
                frameIdx = Math.min(Math.floor(state.attackAnimFrame / atkTicks), anim.length - 1);
            } else {
                frameIdx = state.frame % anim.length;
            }
            const frame = anim[frameIdx];
            if (!frame) return;

            // Apply NPC scale (default 1.0)
            const npcScale = placed.scale || 1;
            const drawW = tileSize * npcScale;
            const drawH = tileSize * npcScale;

            // Adjust position so NPC is centered and feet stay on ground
            const offsetX = (drawW - tileSize) / 2;
            const offsetY = drawH - tileSize; // Bottom-aligned
            const drawX = sx - offsetX;
            const drawY = sy - offsetY;

            // Draw shadow (scales with NPC, uses per-NPC shadow settings)
            if (!npc.noShadow) {
                const shadowOffsetX = npc.shadowOffsetX ?? 0;
                const shadowOffsetY = npc.shadowOffsetY ?? 4;
                const shadowWidthRatio = npc.shadowWidth ?? 0.35;
                const shadowHeightRatio = npc.shadowHeight ?? 0.12;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.beginPath();
                ctx.ellipse(
                    drawX + drawW / 2 + shadowOffsetX,
                    drawY + drawH - shadowOffsetY,
                    drawW * shadowWidthRatio,
                    drawW * shadowHeightRatio,
                    0, 0, Math.PI * 2
                );
                ctx.fill();
            }

            // Handle horizontal flip - either for left fallback OR if animation is marked as mirrored
            const animMirrors = npc.animMirrors || {};
            const isMirrored = animMirrors[animKey];
            const flipX = isMirrored || npcWalkFlip || (state.direction === 'left' && !anims.walkLeft?.length);

            // Blink effect when NPC takes damage (skip drawing on odd frames)
            if (state.hitFlash > 0) {
                state.hitFlash--;
                if (Math.floor(state.hitFlash / 2) % 2 === 1) {
                    return; // Skip drawing this frame - creates blink effect
                }
            }

            if (flipX) {
                ctx.save();
                ctx.translate(drawX + drawW, drawY);
                ctx.scale(-1, 1);
                ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, drawW, drawH);
                ctx.restore();
            } else {
                ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
            }

            // DEBUG: Draw NPC collision/hurtbox when C is pressed (cyan overlay)
            if (showCollision) {
                // Use collision insets if defined (shrink from each edge)
                const insets = npc.collisionInsets;
                if (insets && (insets.top > 0 || insets.bottom > 0 || insets.left > 0 || insets.right > 0)) {
                    const frameW = frame.w || npc.frameWidth || 32;
                    const pixelScale = drawW / frameW;
                    const boxX = drawX + insets.left * pixelScale;
                    const boxY = drawY + insets.top * pixelScale;
                    const boxW = drawW - (insets.left + insets.right) * pixelScale;
                    const boxH = drawH - (insets.top + insets.bottom) * pixelScale;
                    ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
                    ctx.strokeStyle = '#0ff';
                    ctx.lineWidth = 2;
                    ctx.fillRect(boxX, boxY, boxW, boxH);
                    ctx.strokeRect(boxX, boxY, boxW, boxH);
                } else {
                    // No insets - draw cyan bounding box around full sprite
                    ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
                    ctx.strokeStyle = '#0ff';
                    ctx.lineWidth = 2;
                    ctx.fillRect(drawX, drawY, drawW, drawH);
                    ctx.strokeRect(drawX, drawY, drawW, drawH);
                }

                // Draw enemy health bar
                if (placed.isEnemy && state && state.hp !== undefined) {
                    const barWidth = drawW * 0.8;
                    const barHeight = 6;
                    const barX = drawX + (drawW - barWidth) / 2;
                    const barY = drawY - 12;
                    const hpPercent = Math.max(0, state.hp / (state.maxHp || 30));

                    // Background (dark)
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

                    // Health bar background (red)
                    ctx.fillStyle = '#400';
                    ctx.fillRect(barX, barY, barWidth, barHeight);

                    // Health bar fill (green to red gradient based on HP)
                    const hpColor = hpPercent > 0.5 ? '#0f0' : (hpPercent > 0.25 ? '#ff0' : '#f00');
                    ctx.fillStyle = hpColor;
                    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

                    // HP text
                    ctx.fillStyle = '#fff';
                    ctx.font = '8px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(Math.ceil(state.hp) + '/' + (state.maxHp || 30), drawX + drawW / 2, barY - 2);
                }
            }

            // Draw quest indicator icon above NPC
            const questIndicator = getQuestIndicatorForNpc(placed);
            if (questIndicator) {
                const iconX = drawX + drawW / 2;
                const iconY = drawY - 20;

                // Floating animation
                const bobOffset = Math.sin(Date.now() / 300) * 3;

                // Draw icon background glow
                ctx.beginPath();
                ctx.arc(iconX, iconY + bobOffset, 12, 0, Math.PI * 2);
                ctx.fillStyle = questIndicator.glowColor;
                ctx.fill();

                // Draw icon
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = questIndicator.color;
                ctx.fillText(questIndicator.symbol, iconX, iconY + bobOffset);
            }
        }

        // Get quest indicator for an NPC (! = available, ? = can turn in)
        function getQuestIndicatorForNpc(npc) {
            if (!npc.uid || !quests) return null;

            for (const quest of quests) {
                const state = gameProgress.questStates[quest.id];
                if (!state) continue;

                // Quest giver with available quest - yellow !
                if (quest.startNpcUid === npc.uid && state.status === QUEST_STATUS.AVAILABLE) {
                    return { symbol: '!', color: '#FFD700', glowColor: 'rgba(255, 215, 0, 0.4)' };
                }

                // Turn-in NPC with completable quest - yellow ?
                const turnInNpc = quest.turnInNpcUid || quest.startNpcUid;
                if (turnInNpc === npc.uid && state.status === QUEST_STATUS.ACTIVE) {
                    if (areAllConditionsMet(quest)) {
                        return { symbol: '?', color: '#FFD700', glowColor: 'rgba(255, 215, 0, 0.4)' };
                    } else if (quest.startNpcUid === npc.uid) {
                        // Quest giver for active quest (reminder) - gray ?
                        return { symbol: '?', color: '#888888', glowColor: 'rgba(136, 136, 136, 0.3)' };
                    }
                }
            }

            return null;
        }

        // Draw a placed item (simple sprite - disappears when picked up)
        function drawItem(itemIdx, camX, camY, tileSize) {
            const placed = placedItemsData[itemIdx];
            if (!placed) return;

            const state = itemStates[itemIdx];
            if (!state || state.used) return; // Don't draw used/picked up items

            const item = itemsData[placed.itemIndex];
            if (!item || !item.frames || item.frames.length === 0) return;

            const img = itemImages[placed.itemIndex];
            if (!img || !img.complete) return;

            // Always show first frame (simple static item on map)
            const frame = item.frames[0];

            // Draw position
            const drawX = placed.x * tileSize - camX;
            const drawY = placed.y * tileSize - camY;
            const drawW = (item.frameWidth / gridSize) * tileSize;
            const drawH = (item.frameHeight / gridSize) * tileSize;

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
        }

        function drawStaticObject(placedIdx, camX, camY, tileSize) {
            const placed = placedStaticObjectsData[placedIdx];
            if (!placed) return;

            const obj = staticObjectsData[placed.objIndex];
            if (!obj) return;

            const img = staticObjectImages[placed.objIndex];
            if (!img || !img.complete) return;

            // Object dimensions in pixels
            const objW = obj.width * gridSize;
            const objH = obj.height * gridSize;

            // Scale factor (like items)
            const scale = placed.scale || 1;

            // Draw position
            const drawX = placed.x * tileSize - camX;
            const drawY = placed.y * tileSize - camY;
            const drawW = (objW / gridSize) * tileSize * scale;
            const drawH = (objH / gridSize) * tileSize * scale;

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, objW, objH, drawX, drawY, drawW, drawH);
        }

        // Fixed timestep for frame-rate independence
        const FIXED_TIMESTEP = 1000 / 60;  // 16.67ms - game logic runs at 60 FPS
        const MAX_ACCUMULATED_TIME = FIXED_TIMESTEP * 5;  // Cap at 5 ticks to prevent spiral of death
        let accumulatedTime = 0;
        let lastFrameTime = 0;
        let perfUpdateCounter = 0;

        // Mobile render throttle: cap RENDERING to ~30fps while game LOGIC stays 60Hz (the
        // fixed-timestep loop is untouched). Halves draw/GPU work on phones; desktop unaffected.
        const __isMobileRender = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const __renderInterval = __isMobileRender ? 33 : 0; // ms between rendered frames
        let __lastRenderTime = 0;

        // Cache for canopy split arrays — avoids allocating new Array(gridSize) per split tile per
        // frame (GC stutter on mobile). Scalar split values are few and stable, so the cache is tiny.
        const __splitArrCache = new Map();
        function resolveSplitArray(splitData, gridSize) {
            if (Array.isArray(splitData)) return splitData;
            let a = __splitArrCache.get(splitData);
            if (!a || a.length !== gridSize) { a = new Array(gridSize).fill(splitData); __splitArrCache.set(splitData, a); }
            return a;
        }
