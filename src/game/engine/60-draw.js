        function draw() {
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const tileSize = gridSize * TILE_SCALE;
            ctx.imageSmoothingEnabled = false;

            // Check if all tilesets are ready
            let allTilesetsReady = true;
            for (let i = 0; i < tilesetImages.length; i++) {
                if (!tilesetImages[i] || !tilesetImages[i].complete) {
                    allTilesetsReady = false;
                    break;
                }
            }
            if (!allTilesetsReady) {
                ctx.fillStyle = '#4af';
                ctx.font = '20px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('Loading tilesets...', canvas.width / 2, canvas.height / 2);
                return;
            }

            // Debug: Show message if no layers
            if (layers.length === 0) {
                ctx.fillStyle = '#f00';
                ctx.font = '16px monospace';
                ctx.fillText('ERROR: No layers loaded!', 20, 70);
                return;
            }

            // Apply camera zoom transform
            ctx.save();
            ctx.scale(cameraZoom, cameraZoom);

            // Draw tiles - use Math.round for camera to prevent seams
            const camX = Math.round(camera.x);
            const camY = Math.round(camera.y);

            // === 3-PASS RENDERING FOR Y-SORTING ===
            // Performance profiling for render passes
            const drawPerfStart = performance.now();
            let drawPerfLog = '';

            // PASS 1: Draw ground layer (layer 0) - always behind everything
            let dp1 = performance.now();
            let tilesDrawn = drawLayer(0, camX, camY, tileSize);
            let dp1e = performance.now();
            if (dp1e - dp1 > 3) drawPerfLog += ' L0:' + (dp1e-dp1).toFixed(0) + '(' + tilesDrawn + 'tiles)';

            // PASS 2: Y-sort player with tiles from layers 1+
            let dp2 = performance.now();
            tilesDrawn += drawYSortedEntities(camX, camY, tileSize);
            drawProjectiles(camX, camY); // thrown abilities (boomerang etc.) on top of entities
            let dp2e = performance.now();
            if (dp2e - dp2 > 5) drawPerfLog += ' Ysort:' + (dp2e-dp2).toFixed(0);

            // PASS 2.5: Draw dropped items on ground
            renderDroppedItems(ctx, camX, camY);

            // PASS 3: Draw canopy overlay (split tile tops)
            let dp3 = performance.now();
            drawCanopyOverlay(camX, camY, tileSize);
            let dp3e = performance.now();
            if (dp3e - dp3 > 3) drawPerfLog += ' canopy:' + (dp3e-dp3).toFixed(0);

            // PASS 4: Redraw higher layer content that canopy covered
            let dp4 = performance.now();
            redrawHigherLayerContent(camX, camY, tileSize);
            let dp4e = performance.now();
            if (dp4e - dp4 > 3) drawPerfLog += ' redraw:' + (dp4e-dp4).toFixed(0);

            if (drawPerfLog && (performance.now() - drawPerfStart) > 12) {
                console.log('[DRAW]' + drawPerfLog + ' total:' + (performance.now() - drawPerfStart).toFixed(0));
            }

            // PASS 5: Draw collision debug on top of everything (so canopy doesn't hide it)
            if (showCollision) {
                drawCollisionDebugOverlay(camX, camY, tileSize);
            }

            // Draw sound debug visualization
            if (showSounds) {
                Object.keys(tileSounds).forEach(key => {
                    // Filter by current map
                    let sx, sy;
                    if (key.includes(':')) {
                        const parts = key.split(':');
                        if (parts[0] !== currentGameMap) return;
                        [sx, sy] = parts[1].split(',').map(Number);
                    } else {
                        if (currentGameMap !== 'main') return;
                        [sx, sy] = key.split(',').map(Number);
                    }
                    const ts = tileSounds[key];
                    if (!ts) return;

                    const px = sx * tileSize - camX + tileSize / 2;
                    const py = sy * tileSize - camY + tileSize / 2;
                    const radius = (ts.radius || 3) * tileSize;

                    // Draw radius circle - filled purple gradient for visibility
                    const isPlaying = ambientSounds[key]?.playing;

                    // Filled gradient circle
                    const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
                    if (isPlaying) {
                        gradient.addColorStop(0, 'rgba(100, 255, 100, 0.3)');
                        gradient.addColorStop(0.7, 'rgba(100, 255, 100, 0.15)');
                        gradient.addColorStop(1, 'rgba(100, 255, 100, 0)');
                    } else {
                        gradient.addColorStop(0, 'rgba(180, 100, 255, 0.3)');
                        gradient.addColorStop(0.7, 'rgba(180, 100, 255, 0.15)');
                        gradient.addColorStop(1, 'rgba(180, 100, 255, 0)');
                    }
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(px, py, radius, 0, Math.PI * 2);
                    ctx.fill();

                    // Outer ring
                    ctx.strokeStyle = isPlaying ? 'rgba(100, 255, 100, 0.8)' : 'rgba(180, 100, 255, 0.8)';
                    ctx.lineWidth = 3;
                    ctx.stroke();

                    // Draw center marker
                    ctx.fillStyle = isPlaying ? '#0f0' : '#b464ff';
                    ctx.beginPath();
                    ctx.arc(px, py, tileSize / 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // Label
                    ctx.fillStyle = '#fff';
                    ctx.font = '10px monospace';
                    ctx.textAlign = 'center';
                    const soundName = soundsData[ts.soundIndex]?.name || 'Sound ' + ts.soundIndex;
                    ctx.fillText(soundName, px, py - tileSize / 2);
                    ctx.fillText(isPlaying ? 'PLAYING' : 'idle', px, py + tileSize / 2 + 12);
                });
            }

            // Layer debug visualization
            if (showLayers) {
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                for (let li = 0; li < layers.length; li++) {
                    const layer = layers[li];
                    if (!layer) continue;
                    for (let y = 0; y < mapRows; y++) {
                        if (!layer[y]) continue;
                        for (let x = 0; x < mapCols; x++) {
                            const cell = layer[y][x];
                            if (!cell) continue;
                            const px = x * tileSize - camX + tileSize / 2;
                            const py = y * tileSize - camY + tileSize / 2;
                            // Skip off-screen tiles
                            if (px < -tileSize || px > canvas.width / cameraZoom + tileSize || py < -tileSize || py > canvas.height / cameraZoom + tileSize) continue;
                            // Different color for animTiles
                            if (cell.type === 'animTile') {
                                ctx.fillStyle = 'rgba(255, 0, 255, 0.8)'; // Magenta for animTiles
                                ctx.fillRect(px - 8, py - 6, 16, 12);
                                ctx.fillStyle = '#fff';
                                ctx.fillText('A' + li, px, py);
                            } else if (li > 0) {
                                // Only show layer number for non-ground tiles
                                ctx.fillStyle = 'rgba(0, 100, 255, 0.7)';
                                ctx.fillRect(px - 6, py - 6, 12, 12);
                                ctx.fillStyle = '#fff';
                                ctx.fillText(li, px, py);
                            }
                        }
                    }
                }
            }

            // Draw trigger zones when collision debug is enabled
            if (showCollision && placedTriggers) {
                const triggersOnMap = placedTriggers.filter(t => t.mapName === currentGameMap);

                triggersOnMap.forEach(trigger => {
                    const px = trigger.x * tileSize - camX;
                    const py = trigger.y * tileSize - camY;
                    const pw = (trigger.width || 1) * tileSize;
                    const ph = (trigger.height || 1) * tileSize;

                    // Draw trigger zone - bright magenta
                    ctx.fillStyle = 'rgba(255, 0, 255, 0.4)';
                    ctx.fillRect(px, py, pw, ph);
                    ctx.strokeStyle = '#f0f';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(px, py, pw, ph);

                    // Draw type label
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 12px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(trigger.type.toUpperCase(), px + pw / 2, py + ph / 2 - 8);

                    // Show target info
                    ctx.font = '10px monospace';
                    const doorNum = trigger.doorNumber || '?';
                    ctx.fillText('Door ' + doorNum + ' > ' + trigger.targetMap, px + pw / 2, py + ph / 2 + 6);
                });

                // Draw GREEN spawn boxes for incoming doors (doors that lead TO this map)
                // Only draw if spawn has been set (not null)
                const incomingTriggers = placedTriggers.filter(t => t.targetMap === currentGameMap && t.targetX !== null && t.targetY !== null);
                incomingTriggers.forEach(trigger => {
                    const sx = trigger.targetX * tileSize - camX;
                    const sy = trigger.targetY * tileSize - camY;

                    // Green spawn box
                    ctx.fillStyle = 'rgba(0, 255, 100, 0.4)';
                    ctx.fillRect(sx, sy, tileSize, tileSize);
                    ctx.strokeStyle = '#0f0';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(sx, sy, tileSize, tileSize);

                    // Label
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const doorNum = trigger.doorNumber || '?';
                    ctx.fillText('Door ' + doorNum, sx + tileSize / 2, sy + tileSize / 2 - 6);
                    ctx.fillText('from ' + trigger.mapName, sx + tileSize / 2, sy + tileSize / 2 + 6);
                });
            }

            // Draw fish zones (purple) when collision debug (C key) is enabled
            if (showCollision) {
                const fzMd = mapsData[currentGameMap];
                const fz = (fzMd && fzMd.fishZones) || [];
                fz.forEach((z, i) => {
                    const px = z.x * tileSize - camX;
                    const py = z.y * tileSize - camY;
                    const pw = z.width * tileSize;
                    const ph = z.height * tileSize;
                    ctx.fillStyle = 'rgba(168, 85, 255, 0.4)';
                    ctx.fillRect(px, py, pw, ph);
                    ctx.strokeStyle = '#c77dff';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(px, py, pw, ph);
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 12px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('🎣 FISH ' + (i + 1), px + pw / 2, py + ph / 2);
                });
            }

            // Draw dialog tiles when collision debug is enabled
            if (showCollision && placedDialogTiles) {
                const dialogTilesOnMap = placedDialogTiles.filter(t => t.mapName === currentGameMap);

                dialogTilesOnMap.forEach(tile => {
                    const px = tile.x * tileSize - camX;
                    const py = tile.y * tileSize - camY;

                    // Draw dialog tile - orange/yellow
                    ctx.fillStyle = 'rgba(255, 180, 0, 0.4)';
                    ctx.fillRect(px, py, tileSize, tileSize);
                    ctx.strokeStyle = '#fa0';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(px, py, tileSize, tileSize);

                    // Speech bubble icon
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 14px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('💬', px + tileSize / 2, py + tileSize / 2 - 4);

                    // Show dialog name if available
                    const dialog = dialogs[tile.dialogIndex];
                    if (dialog && dialog.name) {
                        ctx.font = '8px monospace';
                        ctx.fillStyle = '#fa0';
                        ctx.fillText(dialog.name.substring(0, 10), px + tileSize / 2, py + tileSize / 2 + 10);
                    }
                });
            }

            // Draw INITIAL spawn point when collision debug is enabled
            // Only shows on the spawn map - this is where player spawns when game first loads
            // Door targets are separate (shown as magenta trigger zones with yellow coordinates)
            if (showCollision && projectData.playerPreviewPos) {
                // Only show initial spawn on the spawn map
                if (currentGameMap === spawnMapNameData) {
                    const spawnPos = projectData.playerPreviewPos;
                    const spawnX = spawnPos.x * tileSize - camX;
                    const spawnY = spawnPos.y * tileSize - camY;

                    // Green spawn marker
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.4)';
                    ctx.fillRect(spawnX, spawnY, tileSize, tileSize);
                    ctx.strokeStyle = '#0f0';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(spawnX, spawnY, tileSize, tileSize);

                    // Label with coordinates
                    ctx.fillStyle = '#0f0';
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('START', spawnX + tileSize/2, spawnY + tileSize/2 - 6);
                    ctx.font = '9px monospace';
                    ctx.fillText('(' + spawnPos.x + ',' + spawnPos.y + ')', spawnX + tileSize/2, spawnY + tileSize/2 + 6);
                }
            }

            // DEBUG: Draw player position marker at player feet (only when UI visible)
            if (!uiHidden) {
                ctx.fillStyle = '#f0f';
                ctx.beginPath();
                ctx.arc(player.x - camX, player.y - camY, 5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();

            // DEBUG HUD: Show player position (only when UI visible)
            if (!uiHidden) {
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(10, 10, 200, 50);
                ctx.fillStyle = '#0ff';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText('PLAYER POS (for builder)', 15, 15);
                ctx.fillStyle = '#ff0';
                ctx.fillText('x:' + Math.round(player.x) + ' y:' + Math.round(player.y), 15, 35);
            }

            // === LIGHTING OVERLAY (drawn after all game content) ===
            const lightT0 = performance.now();
            renderLighting();
            window._lastLightTime = performance.now() - lightT0;  // For perf recording

            // Debug info - stacked properly from bottom up
            if (!uiHidden) {
                ctx.font = '12px monospace';
                let debugY = canvas.height - 10;
                const lineHeight = 15;

                // Always show basic info at bottom
                ctx.fillStyle = '#fff';
                ctx.fillText('Layers: ' + layers.length + ' | Tiles: ' + tilesDrawn + ' | Zoom: ' + cameraZoom.toFixed(1) + 'x', 10, debugY);
                debugY -= lineHeight;

                // Health display (always visible when collision debug on)
                if (showCollision) {
                    ctx.fillStyle = player.health <= 25 ? '#f44' : (player.health <= 50 ? '#fa4' : '#4f4');
                    ctx.fillText('HEALTH: ' + player.health + '/' + player.maxHealth + (player.invincible ? ' [INV]' : ''), 10, debugY);
                    debugY -= lineHeight;

                    // Spawn and player position
                    const playerTileX = Math.floor(player.x / tileSize);
                    const playerTileY = Math.floor(player.y / tileSize);
                    const spawnPos = projectData.playerPreviewPos || {x: '?', y: '?'};
                    ctx.fillStyle = '#0f0';
                    ctx.fillText('START: (' + spawnPos.x + ',' + spawnPos.y + ') | PLAYER: (' + playerTileX + ',' + playerTileY + ') on "' + currentGameMap + '"', 10, debugY);
                    debugY -= lineHeight;
                }

                // Sound debug info
                if (showSounds) {
                    ctx.fillStyle = '#ff0';
                    ctx.fillText('Sounds: ' + soundsData.length + ' | Tile sounds: ' + Object.keys(tileSounds).length + ' | Audio: ' + (audioContext ? 'ON' : 'OFF'), 10, debugY);
                    debugY -= lineHeight;
                }

                // Layer debug info
                if (showLayers) {
                    let animCounts = [];
                    for (let li = 0; li < layers.length; li++) {
                        let count = 0;
                        const layer = layers[li];
                        if (layer) {
                            for (let y = 0; y < mapRows; y++) {
                                if (!layer[y]) continue;
                                for (let x = 0; x < mapCols; x++) {
                                    if (layer[y][x]?.type === 'animTile') count++;
                                }
                            }
                        }
                        if (count > 0) animCounts.push('L' + li + ':' + count);
                    }
                    ctx.fillStyle = '#4af';
                    ctx.fillText('AnimTiles: ' + (animCounts.length > 0 ? animCounts.join(', ') : 'none') + ' | Press L to toggle', 10, debugY);
                }
            }

            // Draw inventory UI (always on top)
            drawHotbar();
            if (inventoryOpen) {
                drawInventoryPopup();
            }
            // Draw shop UI if open
            if (shopOpen) {
                drawShopUI();
            }
        }

        // Draw hotbar at bottom of screen
        function drawHotbar() {
            const hotbarWidth = HOTBAR_SIZE * SLOT_SIZE + (HOTBAR_SIZE - 1) * 2; // slots + gaps
            const hotbarX = (canvas.width - hotbarWidth) / 2;
            const hotbarY = canvas.height - SLOT_SIZE - 10;

            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(hotbarX - 5, hotbarY - 5, hotbarWidth + 10, SLOT_SIZE + 10);

            for (let i = 0; i < HOTBAR_SIZE; i++) {
                const slotX = hotbarX + i * (SLOT_SIZE + 2);
                const slot = inventorySlots[i];

                // Slot background
                if (i === selectedHotbarSlot) {
                    ctx.fillStyle = '#555';
                    ctx.strokeStyle = '#fff';
                } else {
                    ctx.fillStyle = '#333';
                    ctx.strokeStyle = '#666';
                }
                ctx.fillRect(slotX, hotbarY, SLOT_SIZE, SLOT_SIZE);
                ctx.strokeRect(slotX, hotbarY, SLOT_SIZE, SLOT_SIZE);

                // Draw item if slot has one
                if (slot) {
                    const item = itemsData[slot.itemIndex];
                    const img = itemImages[slot.itemIndex];
                    if (item && img && img.complete) {
                        // Draw item sprite (idle frame)
                        const frame = item.frames[item.idleFrame || 0];
                        if (frame) {
                            const scale = Math.min((SLOT_SIZE - 4) / frame.w, (SLOT_SIZE - 4) / frame.h);
                            const drawW = frame.w * scale;
                            const drawH = frame.h * scale;
                            const drawX = slotX + (SLOT_SIZE - drawW) / 2;
                            const drawY = hotbarY + (SLOT_SIZE - drawH) / 2;
                            ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
                        }
                    }

                    // Draw quantity if > 1
                    if (slot.quantity > 1) {
                        ctx.fillStyle = '#fff';
                        ctx.strokeStyle = '#000';
                        ctx.font = 'bold 12px monospace';
                        ctx.textAlign = 'right';
                        ctx.textBaseline = 'bottom';
                        ctx.lineWidth = 2;
                        ctx.strokeText(slot.quantity, slotX + SLOT_SIZE - 2, hotbarY + SLOT_SIZE - 2);
                        ctx.fillText(slot.quantity, slotX + SLOT_SIZE - 2, hotbarY + SLOT_SIZE - 2);
                    }
                }

                // Slot number (1-9, 0)
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.font = '10px monospace';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(i === 9 ? '0' : (i + 1).toString(), slotX + 2, hotbarY + 2);
            }

            // Draw gold display above hotbar
            if (playerGold !== undefined) {
                const goldX = hotbarX + hotbarWidth + 15;
                const goldY = hotbarY + SLOT_SIZE / 2;
                // Gold coin icon
                ctx.fillStyle = '#fa0';
                ctx.beginPath();
                ctx.arc(goldX, goldY, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#c80';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = '#640';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('$', goldX, goldY);
                // Gold amount
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'left';
                ctx.fillText(playerGold.toString(), goldX + 16, goldY + 1);
            }
        }

        // === SHOP SYSTEM ===
        let shopUIButtons = {};
        let shopCart = []; // { type: 'buy'|'sell', shopInvIdx, playerSlotIdx, itemIndex, price, name }
        const SHOP_SLOT_SIZE = 36;
        let shopMusicAudio = null;
        let shopMusicFadeInterval = null;

        function openShop(shopIndex) {
            if (shopIndex < 0 || shopIndex >= shops.length) return;
            shopOpen = true;
            activeShopIndex = shopIndex;
            shopCart = [];
            console.log('[SHOP] Opened shop:', shops[shopIndex].name);

            // Start shop music if configured
            const shop = shops[shopIndex];
            if (shop.musicIndex >= 0 && soundsData[shop.musicIndex]) {
                startShopMusic(shop.musicIndex);
            }
        }

        function closeShop() {
            shopOpen = false;
            activeShopIndex = -1;
            shopCart = [];
            stopShopMusic();
        }

        function startShopMusic(soundIndex) {
            // Stop any existing shop music
            stopShopMusic();

            const sound = soundsData[soundIndex];
            if (!sound || !sound.data) return;

            shopMusicAudio = new Audio(sound.data);
            shopMusicAudio.loop = true;
            shopMusicAudio.volume = 0;
            shopMusicAudio.play().catch(e => console.log('[SHOP] Music play failed:', e));

            // Fade in
            let vol = 0;
            shopMusicFadeInterval = setInterval(() => {
                vol += 0.05;
                if (vol >= 0.5) {
                    vol = 0.5;
                    clearInterval(shopMusicFadeInterval);
                    shopMusicFadeInterval = null;
                }
                if (shopMusicAudio) shopMusicAudio.volume = vol;
            }, 50);
        }

        function stopShopMusic() {
            if (shopMusicFadeInterval) {
                clearInterval(shopMusicFadeInterval);
                shopMusicFadeInterval = null;
            }

            if (shopMusicAudio) {
                // Fade out
                let vol = shopMusicAudio.volume;
                const fadeOut = setInterval(() => {
                    vol -= 0.05;
                    if (vol <= 0) {
                        vol = 0;
                        clearInterval(fadeOut);
                        shopMusicAudio.pause();
                        shopMusicAudio = null;
                    } else if (shopMusicAudio) {
                        shopMusicAudio.volume = vol;
                    }
                }, 50);
            }
        }

        function getCartTotal() {
            let total = 0;
            shopCart.forEach(c => {
                if (c.type === 'buy') total -= c.price;
                else total += c.price;
            });
            return total;
        }

        function drawShopUI() {
            if (!shopOpen || activeShopIndex < 0) return;

            const shop = shops[activeShopIndex];
            if (!shop) return;

            // Get custom styles or defaults
            const style = shop.uiStyle || {
                borderColor: '#ffaa00',
                panelBg: '#1e1e28',
                forSaleBg: '#284028',
                inventoryBg: '#1e1e32',
                cartBg: '#32281e',
                textColor: '#ffffff',
                accentColor: '#ffaa00'
            };

            // Use same slot size as regular inventory
            const cols = 10;
            const padding = 15;
            const slotGap = 2;
            const invWidth = cols * SLOT_SIZE + (cols - 1) * slotGap + padding * 2;

            // Calculate heights for two inventory sections
            const shopRows = Math.max(2, Math.ceil((shop.inventory?.length || 0) / cols));
            const playerRows = 4; // Show 4 rows of player inventory
            const sectionH = playerRows * SLOT_SIZE + (playerRows - 1) * slotGap + 35; // +35 for header
            const shopSectionH = shopRows * SLOT_SIZE + (shopRows - 1) * slotGap + 35;

            // Total panel size
            const panelW = invWidth + 120; // Extra space for cart summary on right
            const panelH = shopSectionH + sectionH + 90; // +90 for title, gold, buttons
            const panelX = (canvas.width - panelW) / 2;
            const panelY = (canvas.height - panelH) / 2;

            // Darken background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Main panel
            ctx.fillStyle = style.panelBg;
            ctx.fillRect(panelX, panelY, panelW, panelH);
            ctx.strokeStyle = style.borderColor;
            ctx.lineWidth = 3;
            ctx.strokeRect(panelX, panelY, panelW, panelH);

            // Header with shop name and gold
            ctx.fillStyle = style.accentColor;
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(shop.name || 'Shop', panelX + panelW / 2, panelY + 20);

            // Gold display with cart total
            const cartTotal = getCartTotal();
            ctx.fillStyle = '#fc0';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('Gold: ' + playerGold, panelX + 15, panelY + 20);

            // Show cart cost next to gold (red for spending, green for earning)
            if (cartTotal !== 0) {
                const costText = (cartTotal >= 0 ? '+' : '') + cartTotal;
                ctx.fillStyle = cartTotal >= 0 ? '#4f8' : '#f44';
                ctx.font = 'bold 12px monospace';
                ctx.fillText(costText, panelX + 95, panelY + 20);

                // Show resulting gold
                const resultGold = playerGold + cartTotal;
                ctx.fillStyle = resultGold >= 0 ? '#888' : '#f44';
                ctx.font = '11px monospace';
                ctx.fillText('= ' + resultGold, panelX + 140, panelY + 20);
            }

            // Close X button
            const closeBtnX = panelX + panelW - 28;
            const closeBtnY = panelY + 6;
            ctx.fillStyle = '#633';
            ctx.fillRect(closeBtnX, closeBtnY, 22, 22);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('X', closeBtnX + 11, closeBtnY + 16);
            shopUIButtons.close = { x: closeBtnX, y: closeBtnY, w: 22, h: 22 };

            // === SHOP INVENTORY (top, green theme) ===
            const shopAreaX = panelX + padding;
            const shopAreaY = panelY + 35;
            const shopAreaW = invWidth - padding;

            ctx.fillStyle = 'rgba(40, 60, 40, 0.5)';
            ctx.fillRect(shopAreaX, shopAreaY, shopAreaW, shopSectionH);
            ctx.strokeStyle = '#4a7c59';
            ctx.lineWidth = 2;
            ctx.strokeRect(shopAreaX, shopAreaY, shopAreaW, shopSectionH);

            ctx.fillStyle = '#8f8';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('FOR SALE', shopAreaX + 8, shopAreaY + 16);

            // Draw shop items
            shopUIButtons.shopItems = [];
            const shopInv = shop.inventory || [];
            const availableGold = playerGold + cartTotal; // Gold after current cart
            for (let i = 0; i < Math.max(shopInv.length, cols * 2); i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const slotX = shopAreaX + padding + col * (SLOT_SIZE + slotGap);
                const slotY = shopAreaY + 25 + row * (SLOT_SIZE + slotGap);

                if (row >= shopRows) break;

                const inv = shopInv[i];
                const inCart = inv && shopCart.some(c => c.type === 'buy' && c.shopInvIdx === i);
                const canAfford = inv && (inCart || inv.buyPrice <= availableGold);

                // Slot background - gray out if can't afford
                if (inCart) {
                    ctx.fillStyle = '#3a5a3a';
                } else if (!canAfford && inv) {
                    ctx.fillStyle = '#1a1a1a'; // Darker for unaffordable
                } else {
                    ctx.fillStyle = '#2a3a2a';
                }
                ctx.fillRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                ctx.strokeStyle = inCart ? '#8f8' : (!canAfford && inv ? '#333' : '#4a5a4a');
                ctx.lineWidth = inCart ? 2 : 1;
                ctx.strokeRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);

                if (inv) {
                    // Draw item sprite (same as regular inventory)
                    const item = itemsData[inv.itemIndex];
                    const img = itemImages[inv.itemIndex];
                    if (item && img && img.complete) {
                        const frame = item.frames?.[item.idleFrame || 0];
                        if (frame) {
                            const scale = Math.min((SLOT_SIZE - 4) / frame.w, (SLOT_SIZE - 4) / frame.h);
                            const drawW = frame.w * scale;
                            const drawH = frame.h * scale;
                            const drawX = slotX + (SLOT_SIZE - drawW) / 2;
                            const drawY = slotY + (SLOT_SIZE - drawH) / 2;
                            // Gray out sprite if can't afford
                            if (!canAfford) ctx.globalAlpha = 0.4;
                            ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
                            ctx.globalAlpha = 1;
                        }
                    }

                    // Price below slot - red if can't afford
                    ctx.fillStyle = canAfford ? '#fc0' : '#844';
                    ctx.font = '9px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(inv.buyPrice + 'g', slotX + SLOT_SIZE/2, slotY + SLOT_SIZE + 10);

                    shopUIButtons.shopItems.push({ x: slotX, y: slotY, w: SLOT_SIZE, h: SLOT_SIZE, idx: i });
                }
            }

            // === PLAYER INVENTORY (bottom, blue theme - same as pressing I) ===
            const invAreaX = panelX + padding;
            const invAreaY = shopAreaY + shopSectionH + 10;
            const invAreaW = invWidth - padding;

            ctx.fillStyle = 'rgba(30, 30, 50, 0.5)';
            ctx.fillRect(invAreaX, invAreaY, invAreaW, sectionH);
            ctx.strokeStyle = '#557';
            ctx.lineWidth = 2;
            ctx.strokeRect(invAreaX, invAreaY, invAreaW, sectionH);

            ctx.fillStyle = '#aaf';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('YOUR INVENTORY', invAreaX + 8, invAreaY + 16);

            // Draw player inventory slots (same style as drawInventoryPopup)
            shopUIButtons.playerItems = [];
            const totalSlots = cols * playerRows;
            for (let i = 0; i < totalSlots; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const slotX = invAreaX + padding + col * (SLOT_SIZE + slotGap);
                const slotY = invAreaY + 25 + row * (SLOT_SIZE + slotGap);

                const slot = inventorySlots[i];
                const inCart = slot && shopCart.some(c => c.type === 'sell' && c.playerSlotIdx === i);

                // Slot background - hotbar slots get slight highlight
                if (i < HOTBAR_SIZE) {
                    ctx.fillStyle = inCart ? '#5a3a5a' : '#3a3a4a';
                } else {
                    ctx.fillStyle = inCart ? '#5a3a5a' : '#333';
                }
                ctx.fillRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                ctx.strokeStyle = inCart ? '#f8f' : (i < HOTBAR_SIZE ? '#666' : '#444');
                ctx.lineWidth = inCart ? 2 : 1;
                ctx.strokeRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);

                if (slot) {
                    // Draw item sprite (same as regular inventory)
                    const item = itemsData[slot.itemIndex];
                    const img = itemImages[slot.itemIndex];
                    if (item && img && img.complete) {
                        const frame = item.frames?.[item.idleFrame || 0];
                        if (frame) {
                            const scale = Math.min((SLOT_SIZE - 4) / frame.w, (SLOT_SIZE - 4) / frame.h);
                            const drawW = frame.w * scale;
                            const drawH = frame.h * scale;
                            const drawX = slotX + (SLOT_SIZE - drawW) / 2;
                            const drawY = slotY + (SLOT_SIZE - drawH) / 2;
                            ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
                        }
                    }

                    // Quantity
                    if (slot.quantity > 1) {
                        ctx.fillStyle = '#fff';
                        ctx.strokeStyle = '#000';
                        ctx.font = 'bold 11px monospace';
                        ctx.textAlign = 'right';
                        ctx.textBaseline = 'bottom';
                        ctx.lineWidth = 2;
                        ctx.strokeText(slot.quantity, slotX + SLOT_SIZE - 2, slotY + SLOT_SIZE - 2);
                        ctx.fillText(slot.quantity, slotX + SLOT_SIZE - 2, slotY + SLOT_SIZE - 2);
                        ctx.textBaseline = 'alphabetic';
                    }

                    // Calculate sell price
                    const buyEntry = shop.buyList?.find(b => b.itemIndex === slot.itemIndex);
                    const itemDef = itemsData[slot.itemIndex];
                    const sellPrice = buyEntry ? buyEntry.sellPrice : Math.floor((itemDef?.basePrice || 10) * (shop.defaultSellRate || 50) / 100);

                    shopUIButtons.playerItems.push({
                        x: slotX, y: slotY, w: SLOT_SIZE, h: SLOT_SIZE,
                        idx: i, sellPrice: sellPrice
                    });
                } else {
                    shopUIButtons.playerItems.push({ x: slotX, y: slotY, w: SLOT_SIZE, h: SLOT_SIZE, idx: i, sellPrice: 0 });
                }
            }

            // === CART SUMMARY (right side) ===
            const cartX = panelX + invWidth + 5;
            const cartY = panelY + 35;
            const cartW = 105;
            const cartH = shopSectionH + sectionH;

            ctx.fillStyle = 'rgba(40, 40, 50, 0.8)';
            ctx.fillRect(cartX, cartY, cartW, cartH);
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 1;
            ctx.strokeRect(cartX, cartY, cartW, cartH);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('CART', cartX + cartW/2, cartY + 14);

            // List cart items
            ctx.font = '9px monospace';
            ctx.textAlign = 'left';
            let cartListY = cartY + 30;
            const maxCartShow = Math.floor((cartH - 60) / 14);
            shopCart.slice(0, maxCartShow).forEach((c, i) => {
                ctx.fillStyle = c.type === 'buy' ? '#f88' : '#8f8';
                const prefix = c.type === 'buy' ? '-' : '+';
                ctx.fillText(prefix + c.price + 'g', cartX + 5, cartListY + i * 14);
                ctx.fillStyle = '#ccc';
                ctx.fillText((c.name || '?').substring(0, 8), cartX + 40, cartListY + i * 14);
            });
            if (shopCart.length > maxCartShow) {
                ctx.fillStyle = '#888';
                ctx.fillText('+' + (shopCart.length - maxCartShow) + ' more', cartX + 5, cartListY + maxCartShow * 14);
            }
            if (shopCart.length === 0) {
                ctx.fillStyle = '#666';
                ctx.textAlign = 'center';
                ctx.font = '10px monospace';
                ctx.fillText('Cart empty', cartX + cartW/2, cartY + cartH/2);
            }

            // Cart total (using cartTotal from earlier in function)
            ctx.fillStyle = cartTotal >= 0 ? '#8f8' : '#f88';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            const totalText = (cartTotal >= 0 ? '+' : '') + cartTotal + 'g';
            ctx.fillText(totalText, cartX + cartW/2, cartY + cartH - 10);

            // === BOTTOM BUTTONS ===
            const btnY = panelY + panelH - 45;
            const btnH = 32;

            // Clear button
            const clearW = 70;
            const clearX = panelX + 20;
            ctx.fillStyle = '#444';
            ctx.fillRect(clearX, btnY, clearW, btnH);
            ctx.strokeStyle = '#666';
            ctx.strokeRect(clearX, btnY, clearW, btnH);
            ctx.fillStyle = '#ccc';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('CLEAR', clearX + clearW/2, btnY + 21);
            shopUIButtons.clear = { x: clearX, y: btnY, w: clearW, h: btnH };

            // Confirm button
            const confirmW = 120;
            const confirmX = panelX + panelW/2 - confirmW/2 - 30;
            const canConfirm = shopCart.length > 0 && (playerGold + cartTotal) >= 0;
            ctx.fillStyle = canConfirm ? '#4a7c59' : '#333';
            ctx.fillRect(confirmX, btnY, confirmW, btnH);
            ctx.strokeStyle = canConfirm ? '#8f8' : '#555';
            ctx.lineWidth = 2;
            ctx.strokeRect(confirmX, btnY, confirmW, btnH);
            ctx.fillStyle = canConfirm ? '#fff' : '#666';
            ctx.font = 'bold 12px monospace';
            ctx.fillText('CONFIRM', confirmX + confirmW/2, btnY + 21);
            shopUIButtons.confirm = { x: confirmX, y: btnY, w: confirmW, h: btnH };

            // Close button
            const closeBtnW = 70;
            const closeBtnX2 = panelX + panelW - 20 - closeBtnW;
            ctx.fillStyle = '#633';
            ctx.fillRect(closeBtnX2, btnY, closeBtnW, btnH);
            ctx.strokeStyle = '#a66';
            ctx.strokeRect(closeBtnX2, btnY, closeBtnW, btnH);
            ctx.fillStyle = '#fff';
            ctx.fillText('CLOSE', closeBtnX2 + closeBtnW/2, btnY + 21);
            shopUIButtons.closeBtn = { x: closeBtnX2, y: btnY, w: closeBtnW, h: btnH };

            // Affordability warning
            if (shopCart.length > 0 && (playerGold + cartTotal) < 0) {
                ctx.fillStyle = '#f44';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('Not enough gold!', panelX + panelW/2, btnY - 8);
            }
        }

        function handleShopClick(clickX, clickY) {
            if (!shopOpen) return false;

            const shop = shops[activeShopIndex];
            if (!shop) return true;

            // Close buttons
            if (shopUIButtons.close && isInRect(clickX, clickY, shopUIButtons.close)) {
                closeShop();
                return true;
            }
            if (shopUIButtons.closeBtn && isInRect(clickX, clickY, shopUIButtons.closeBtn)) {
                closeShop();
                return true;
            }

            // Clear cart
            if (shopUIButtons.clear && isInRect(clickX, clickY, shopUIButtons.clear)) {
                shopCart = [];
                return true;
            }

            // Confirm transaction
            if (shopUIButtons.confirm && isInRect(clickX, clickY, shopUIButtons.confirm)) {
                if (shopCart.length > 0 && (playerGold + getCartTotal()) >= 0) {
                    executeShopTransaction();
                }
                return true;
            }

            // Click on shop item (add to cart as buy)
            if (shopUIButtons.shopItems) {
                for (const btn of shopUIButtons.shopItems) {
                    if (isInRect(clickX, clickY, btn)) {
                        const inv = shop.inventory[btn.idx];
                        const existing = shopCart.findIndex(c => c.type === 'buy' && c.shopInvIdx === btn.idx);
                        if (existing >= 0) {
                            shopCart.splice(existing, 1); // Remove from cart
                        } else {
                            // Check if player can afford this item with current cart
                            const currentTotal = getCartTotal();
                            const newTotal = currentTotal - inv.buyPrice;
                            if (playerGold + newTotal < 0) {
                                // Can't afford - don't add to cart
                                console.log('[SHOP] Cannot afford item, need', inv.buyPrice, 'but only have', playerGold + currentTotal);
                                return true;
                            }
                            const itemDef = itemsData[inv.itemIndex];
                            shopCart.push({
                                type: 'buy',
                                shopInvIdx: btn.idx,
                                itemIndex: inv.itemIndex,
                                price: inv.buyPrice,
                                name: itemDef?.name || 'Item'
                            });
                        }
                        return true;
                    }
                }
            }

            // Click on player item (add to cart as sell)
            if (shopUIButtons.playerItems) {
                for (const btn of shopUIButtons.playerItems) {
                    if (isInRect(clickX, clickY, btn)) {
                        const slot = inventorySlots[btn.idx];
                        if (slot) {
                            const existing = shopCart.findIndex(c => c.type === 'sell' && c.playerSlotIdx === btn.idx);
                            if (existing >= 0) {
                                shopCart.splice(existing, 1); // Remove from cart
                            } else {
                                const itemDef = itemsData[slot.itemIndex];
                                const buyEntry = shop.buyList?.find(b => b.itemIndex === slot.itemIndex);
                                const sellPrice = buyEntry ? buyEntry.sellPrice : Math.floor((itemDef?.basePrice || 10) * (shop.defaultSellRate || 50) / 100);
                                shopCart.push({
                                    type: 'sell',
                                    playerSlotIdx: btn.idx,
                                    itemIndex: slot.itemIndex,
                                    price: sellPrice,
                                    name: itemDef?.name || 'Item'
                                });
                            }
                        }
                        return true;
                    }
                }
            }

            return true;
        }

        function executeShopTransaction() {
            // Process all cart items
            shopCart.forEach(c => {
                if (c.type === 'buy') {
                    const added = addToInventory(c.itemIndex, 1);
                    if (added) playerGold -= c.price;
                } else {
                    // Remove item from player inventory
                    const slot = inventorySlots[c.playerSlotIdx];
                    if (slot) {
                        playerGold += c.price;
                        slot.quantity--;
                        if (slot.quantity <= 0) {
                            inventorySlots[c.playerSlotIdx] = null;
                        }
                    }
                }
            });
            shopCart = [];
            console.log('[SHOP] Transaction complete. Gold:', playerGold);
        }

        function isInRect(x, y, rect) {
            return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
        }

        function checkShopInteraction() {
            // Check if player is near an NPC with a shop
            const tileSize = gridSize * TILE_SCALE;
            const playerTileX = Math.floor(player.x / tileSize);
            const playerTileY = Math.floor(player.y / tileSize);

            for (let i = 0; i < placedNpcs.length; i++) {
                const npc = placedNpcs[i];
                if (npc.mapName && npc.mapName !== currentGameMap) continue;
                if (npc.shopIndex === undefined || npc.shopIndex < 0) continue;

                const dist = Math.abs(npc.x - playerTileX) + Math.abs(npc.y - playerTileY);
                if (dist <= 1) {
                    return { shopIndex: npc.shopIndex, npc: npc };
                }
            }
            return null;
        }

        // Draw full inventory popup
        function drawInventoryPopup() {
            const cols = 10;
            const rows = 4;
            const padding = 20;
            const invWidth = cols * SLOT_SIZE + (cols - 1) * 2 + padding * 2;
            const invHeight = rows * SLOT_SIZE + (rows - 1) * 2 + padding * 2 + 30; // +30 for title
            const invX = (canvas.width - invWidth) / 2;
            const invY = (canvas.height - invHeight) / 2;

            // Darken background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Inventory panel
            ctx.fillStyle = 'rgba(30, 30, 40, 0.95)';
            ctx.fillRect(invX, invY, invWidth, invHeight);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(invX, invY, invWidth, invHeight);

            // Title
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('INVENTORY', canvas.width / 2, invY + 10);

            // Draw slots
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const slotIdx = row * cols + col;
                    const slotX = invX + padding + col * (SLOT_SIZE + 2);
                    const slotY = invY + padding + 30 + row * (SLOT_SIZE + 2);
                    const slot = inventorySlots[slotIdx];

                    // Slot background - highlight hotbar slots
                    if (slotIdx < HOTBAR_SIZE) {
                        ctx.fillStyle = slotIdx === selectedHotbarSlot ? '#555' : '#3a3a4a';
                    } else {
                        ctx.fillStyle = '#333';
                    }
                    ctx.fillRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                    ctx.strokeStyle = slotIdx < HOTBAR_SIZE ? '#888' : '#555';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);

                    // Draw item if slot has one
                    if (slot) {
                        const item = itemsData[slot.itemIndex];
                        const img = itemImages[slot.itemIndex];
                        if (item && img && img.complete) {
                            const frame = item.frames[item.idleFrame || 0];
                            if (frame) {
                                const scale = Math.min((SLOT_SIZE - 4) / frame.w, (SLOT_SIZE - 4) / frame.h);
                                const drawW = frame.w * scale;
                                const drawH = frame.h * scale;
                                const drawX = slotX + (SLOT_SIZE - drawW) / 2;
                                const drawY = slotY + (SLOT_SIZE - drawH) / 2;
                                ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
                            }
                        }

                        // Draw quantity
                        if (slot.quantity > 1) {
                            ctx.fillStyle = '#fff';
                            ctx.strokeStyle = '#000';
                            ctx.font = 'bold 12px monospace';
                            ctx.textAlign = 'right';
                            ctx.textBaseline = 'bottom';
                            ctx.lineWidth = 2;
                            ctx.strokeText(slot.quantity, slotX + SLOT_SIZE - 2, slotY + SLOT_SIZE - 2);
                            ctx.fillText(slot.quantity, slotX + SLOT_SIZE - 2, slotY + SLOT_SIZE - 2);
                        }
                    }
                }
            }

            // Draw cursor item if held
            if (cursorItem) {
                const item = itemsData[cursorItem.itemIndex];
                const img = itemImages[cursorItem.itemIndex];
                if (item && img && img.complete) {
                    const frame = item.frames[item.idleFrame || 0];
                    if (frame) {
                        const scale = Math.min((SLOT_SIZE - 4) / frame.w, (SLOT_SIZE - 4) / frame.h);
                        const drawW = frame.w * scale;
                        const drawH = frame.h * scale;
                        ctx.globalAlpha = 0.8;
                        ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h,
                            mouseX - drawW / 2, mouseY - drawH / 2, drawW, drawH);
                        ctx.globalAlpha = 1;

                        if (cursorItem.quantity > 1) {
                            ctx.fillStyle = '#fff';
                            ctx.strokeStyle = '#000';
                            ctx.font = 'bold 12px monospace';
                            ctx.textAlign = 'right';
                            ctx.textBaseline = 'bottom';
                            ctx.lineWidth = 2;
                            ctx.strokeText(cursorItem.quantity, mouseX + SLOT_SIZE/2, mouseY + SLOT_SIZE/2);
                            ctx.fillText(cursorItem.quantity, mouseX + SLOT_SIZE/2, mouseY + SLOT_SIZE/2);
                        }
                    }
                }
            }

            // Instructions
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '11px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('Click to pick up/swap items | Press I to close', canvas.width / 2, invY + invHeight - 5);
        }

        // Helper for drawing tiles with rotation and flip in test game
        function drawTileWithEffects(ctx, img, srcX, srcY, srcSize, destX, destY, destSize, rotation, flipped) {
            // Round to integers to prevent tile seams from floating point errors
            const dx = Math.round(destX);
            const dy = Math.round(destY);

            // Fast path: no rotation or flip - skip expensive save/restore
            if (!rotation && !flipped) {
                ctx.drawImage(img, srcX, srcY, srcSize, srcSize, dx, dy, destSize, destSize);
                return;
            }

            // Slow path: needs transforms
            ctx.save();
            ctx.translate(dx + destSize / 2, dy + destSize / 2);

            if (rotation !== 0) {
                ctx.rotate(rotation * Math.PI / 180);
            }
            if (flipped) {
                ctx.scale(-1, 1); // Flip horizontally
            }

            ctx.drawImage(img, srcX, srcY, srcSize, srcSize, -destSize / 2, -destSize / 2, destSize, destSize);
            ctx.restore();
        }

        function drawLayer(li, camX, camY, tileSize) {
            if (!layerVisibility[li]) return 0;
            const layer = layers[li];
            if (!layer) return 0;

            // Calculate visible tile range with generous buffer (10 tiles) to prevent pop-in
            const buffer = 10;
            const viewWidth = canvas.width / cameraZoom;
            const viewHeight = canvas.height / cameraZoom;
            const startX = Math.max(0, Math.floor(camX / tileSize) - buffer);
            const endX = Math.min(mapCols, Math.ceil((camX + viewWidth) / tileSize) + buffer);
            const startY = Math.max(0, Math.floor(camY / tileSize) - buffer);
            const endY = Math.min(mapRows, Math.ceil((camY + viewHeight) / tileSize) + buffer);

            let count = 0;
            for (let y = startY; y < endY; y++) {
                if (!layer[y]) continue;
                for (let x = startX; x < endX; x++) {
                    const cell = layer[y][x];
                    if (!cell) continue;

                    // Use exact integer positions - no overlap to avoid double-drawing semi-transparent pixels
                    const px = x * tileSize - camX;
                    const py = y * tileSize - camY;

                    if (cell.type === 'tile') {
                        count++;
                        // Use correct tileset for this tile
                        const cellTileset = tilesetImages[cell.tilesetIndex || 0] || tilesetImages[0];
                        if (cellTileset) {
                            // Draw at exact pixel positions - no overlap needed since tileSize is integer
                            drawTileWithEffects(ctx, cellTileset, cell.x, cell.y, gridSize, px, py, tileSize, cell.rotation || 0, cell.flipped || false);
                        } else {
                            // Fallback: draw colored rectangle if tileset not loaded
                            ctx.fillStyle = '#4a7c59';
                            ctx.fillRect(px, py, tileSize, tileSize);
                        }

                        // Draw collision overlay if debug enabled (all layers)
                        if (showCollision) {
                            // Include tileset index in collision key
                            const tilesetIdx = cell.tilesetIndex || 0;
                            const key = tilesetIdx + ':' + cell.x + ',' + cell.y;
                            const mask = collisionMasks[key];

                            if (mask) {
                                // Draw pixel-level collision
                                const pixelSize = tileSize / gridSize;
                                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                                for (let my = 0; my < gridSize; my++) {
                                    for (let mx = 0; mx < gridSize; mx++) {
                                        if (mask[my] && mask[my][mx]) {
                                            ctx.fillRect(
                                                px + mx * pixelSize,
                                                py + my * pixelSize,
                                                pixelSize,
                                                pixelSize
                                            );
                                        }
                                    }
                                }
                            } else if (tileCollisions[key]) {
                                // Full tile collision
                                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                                ctx.fillRect(px, py, tileSize, tileSize);
                            }
                        }
                    } else if (cell.type === 'prop') {
                        const propIdx = cell.propIndex || 0;
                        const propImg = propImages[propIdx];
                        if (propImg && propImg.complete) {
                            count++;
                            ctx.drawImage(propImg, cell.x, cell.y, gridSize, gridSize, px, py, tileSize, tileSize);
                        }

                        // Show collision in debug mode
                        if (showCollision) {
                            const key = cell.x + ',' + cell.y;
                            const mask = propCollisionMasksAll[propIdx] ? propCollisionMasksAll[propIdx][key] : null;
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
                            }
                        }
                    } else if (cell.type === 'animTile') {
                        // Delegate to the scale/nudge/mirror/rotation-aware renderer so LAYER 0 anim
                        // props honor cell.scale. (This inline branch used to blit at flat tileSize,
                        // so props on layer 0 never scaled in-game while layers 1+ did — that's why the
                        // chest scaled in the builder but not the test game.) Layer 0 is the always-behind
                        // ground pass, so the whole tile is drawn via drawAnimTile (no trunk/canopy split).
                        const propData = animatedPropsData[cell.propIndex];
                        if (propData && propData.frames && propData.frames.length > 0) {
                            drawAnimTile(cell, x, y, li, camX, camY, tileSize);
                            count++;
                        }
                    }
                }
            }

            return count;
        }
