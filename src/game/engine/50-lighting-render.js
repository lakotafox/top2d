        // === LIGHTING RENDERING (Classic 2D - no WebGL) ===
        // Pre-allocated arrays for polygon lights to avoid GC pauses
        const polyScreenPointsPool = [];
        for (let i = 0; i < 100; i++) polyScreenPointsPool.push({ x: 0, y: 0 });
        const filteredPolyLightsPool = []; // Reusable array for filtered poly lights

        function renderLighting() {
            const lighting = lightingSettingsData;

            // Get lighting values - use cycle if enabled, otherwise use darkness slider
            let preset;
            if (dayCycleEnabled) {
                preset = currentLighting;
            } else {
                // Use manual darkness slider (0-100 maps to 0-0.95 alpha)
                const alpha = manualDarkness / 100 * 0.95;
                preset = { r: 0, g: 0, b: 20, a: alpha };
            }

            // Skip lighting entirely if darkness is negligible (< 1% alpha) and no player light
            // This is a huge performance win during daytime!
            if (preset.a < 0.01 && !lighting.playerLight) return;

            // Create/resize offscreen canvas for lighting
            if (!lightCanvas || lightCanvas.width !== canvas.width || lightCanvas.height !== canvas.height) {
                lightCanvas = document.createElement('canvas');
                lightCanvas.width = canvas.width;
                lightCanvas.height = canvas.height;
                lightCtx = lightCanvas.getContext('2d');
            }

            // Clear and fill with ambient darkness
            lightCtx.clearRect(0, 0, lightCanvas.width, lightCanvas.height);
            lightCtx.fillStyle = 'rgba(' + preset.r + ',' + preset.g + ',' + preset.b + ',' + preset.a + ')';
            lightCtx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

            // Cut out light circles using destination-out compositing
            lightCtx.globalCompositeOperation = 'destination-out';

            const tileSize = gridSize * TILE_SCALE;
            const camX = Math.floor(player.x - canvas.width / (2 * cameraZoom) + player.width / 2);
            const camY = Math.floor(player.y - canvas.height / (2 * cameraZoom) + player.height / 2);

            // Player torch light (always follows player)
            if (lighting.playerLight) {
                const px = (player.x - camX + player.width / 2) * cameraZoom;
                const py = (player.y - camY + player.height / 2) * cameraZoom;
                const radius = lighting.playerLightRadius * tileSize * cameraZoom;

                const gradient = lightCtx.createRadialGradient(px, py, 0, px, py, radius);
                gradient.addColorStop(0, 'rgba(255,255,255,1)');
                gradient.addColorStop(0.5, 'rgba(255,255,255,0.6)');
                gradient.addColorStop(1, 'rgba(255,255,255,0)');
                lightCtx.fillStyle = gradient;
                lightCtx.beginPath();
                lightCtx.arc(px, py, radius, 0, Math.PI * 2);
                lightCtx.fill();
            }

            // Cut out placed point lights (use for-in to avoid Object.keys() allocation)
            const mapPrefix = currentGameMap + ':';
            for (const key in pointLights) {
                if (!key.startsWith(mapPrefix)) continue;

                const colonIdx = key.indexOf(':');
                const coords = key.substring(colonIdx + 1);
                const commaIdx = coords.indexOf(',');
                const lx = parseInt(coords.substring(0, commaIdx), 10);
                const ly = parseInt(coords.substring(commaIdx + 1), 10);
                const light = pointLights[key];

                const screenX = ((lx * tileSize + tileSize / 2) - camX) * cameraZoom;
                const screenY = ((ly * tileSize + tileSize / 2) - camY) * cameraZoom;
                let radius = light.radius * tileSize * cameraZoom;

                // Optional flicker effect (throttled for performance)
                if (light.flicker) {
                    const flickerAmt = light.flickerIntensity || 0.1;
                    radius *= getFlickerValue('point_' + key, flickerAmt);
                }

                const gradient = lightCtx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
                gradient.addColorStop(0, 'rgba(255,255,255,1)');
                gradient.addColorStop(0.6, 'rgba(255,255,255,0.5)');
                gradient.addColorStop(1, 'rgba(255,255,255,0)');
                lightCtx.fillStyle = gradient;
                lightCtx.beginPath();
                lightCtx.arc(screenX, screenY, radius, 0, Math.PI * 2);
                lightCtx.fill();
            }

            // Cut out polygon lights (reuse array to avoid GC)
            filteredPolyLightsPool.length = 0;
            for (let i = 0; i < polyLights.length; i++) {
                if (polyLights[i].mapName === currentGameMap) {
                    filteredPolyLightsPool.push(polyLights[i]);
                }
            }

            // Debug: Log once per map
            if (!window._polyLightLoggedMap || window._polyLightLoggedMap !== currentGameMap) {
                console.log('[POLY LIGHTS] Map:', currentGameMap, 'Total polyLights:', polyLights.length, 'On this map:', filteredPolyLightsPool.length);
                filteredPolyLightsPool.forEach((pl, i) => console.log('  Poly', i, 'points:', pl.points?.length, 'intensity:', pl.intensity));
                window._polyLightLoggedMap = currentGameMap;
            }

            for (let pi = 0; pi < filteredPolyLightsPool.length; pi++) {
                const poly = filteredPolyLightsPool[pi];
                if (!poly.points || poly.points.length < 3) continue;

                // Calculate screen coordinates using pooled objects (avoid creating new arrays/objects)
                const pointCount = Math.min(poly.points.length, polyScreenPointsPool.length);
                for (let i = 0; i < pointCount; i++) {
                    const pt = poly.points[i];
                    polyScreenPointsPool[i].x = ((pt.x * tileSize) - camX) * cameraZoom;
                    polyScreenPointsPool[i].y = ((pt.y * tileSize) - camY) * cameraZoom;
                }

                // Draw filled polygon with gradient-like intensity
                const intensity = poly.intensity || 0.8;

                // Apply flicker if enabled (throttled for performance)
                let flickerMult = 1;
                if (poly.flicker) {
                    const flickerAmt = poly.flickerIntensity || 0.2;
                    flickerMult = getFlickerValue('poly_' + poly.id, flickerAmt);
                }

                // Draw polygon as light cutout
                lightCtx.fillStyle = 'rgba(255,255,255,' + (intensity * flickerMult) + ')';
                lightCtx.beginPath();
                lightCtx.moveTo(polyScreenPointsPool[0].x, polyScreenPointsPool[0].y);
                for (let i = 1; i < pointCount; i++) {
                    lightCtx.lineTo(polyScreenPointsPool[i].x, polyScreenPointsPool[i].y);
                }
                lightCtx.closePath();
                lightCtx.fill();
            }

            // Reset composite operation and draw darkness over game
            lightCtx.globalCompositeOperation = 'source-over';
            ctx.drawImage(lightCanvas, 0, 0);
        }

        // (8-direction movement helpers moved to top-level scope — see near the top of the script
        //  so both the editor's renderMap and the game engine can call them.)

        // Initialize audio on first user interaction (key or touch)
        document.addEventListener('keydown', () => initAudio(), { once: true });
        document.addEventListener('touchstart', () => initAudio(), { once: true });
        document.addEventListener('click', () => initAudio(), { once: true });

        // Adjustable settings
        // playerScale is declared earlier (line ~24070) and loaded from character data
        let animSpeed = 7; // Lower = faster animation

        // Tile scale - how big to render tiles (zoom level)
        const TILE_SCALE = 4;

        // Camera zoom (1 = normal, 2 = 2x closer, etc)
        let cameraZoom = 1.0;

        // On phones the view must adapt to the small screen and to rotation; otherwise the world
        // looks wildly over-zoomed and the framing jumps between portrait and landscape. Fit a
        // consistent number of tiles vertically. Called every frame in the camera update so it
        // tracks resize/rotation/gridSize automatically. Desktop is unaffected (UA-gated).
        const __isMobileView = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const __targetTilesHigh = 11;
        function updateMobileZoom() {
            // Mobile zoom is now achieved via canvas backing resolution (see resizeCanvas), so the
            // world renders at INTEGER scale with no tile tearing. Keep cameraZoom at 1 on mobile.
            if (__isMobileView) cameraZoom = 1.0;
        }
        updateMobileZoom();

        // Item receive display settings
        let itemReceiveScale = 2;         // Scale of floating item sprite
        let itemReceiveHeight = 45;       // Height above player in pixels
        let itemReceiveDuration = 2;      // Total display time in seconds
        let itemReceiveFinalPause = 1;    // Pause on final frame in seconds

        // Item receive state
        let isReceivingItem = false;
        let receivingItemData = null;     // { itemIndex, startTime, item }
        let receiveItemAnimFrame = 0;
        let receiveItemAnimTimer = 0;

        // Debug panel toggle and slider handlers
        document.addEventListener('keydown', (e) => {
            if (e.key === 'p' || e.key === 'P') {
                document.getElementById('debugPanel').classList.toggle('visible');
            }
            if (e.key === 's' || e.key === 'S') {
                showSounds = !showSounds;
                console.log('Sound debug:', showSounds ? 'ON' : 'OFF');
            }
            if (e.key === 'l' || e.key === 'L') {
                showLayers = !showLayers;
                console.log('Layer debug:', showLayers ? 'ON' : 'OFF');
            }
        });

        document.getElementById('scaleSlider').addEventListener('input', (e) => {
            playerScale = parseFloat(e.target.value);
            document.getElementById('scaleVal').textContent = playerScale.toFixed(1);
        });

        document.getElementById('speedSlider').addEventListener('input', (e) => {
            player.speed = parseFloat(e.target.value);
            document.getElementById('speedVal').textContent = player.speed.toFixed(1);
        });

        document.getElementById('animSlider').addEventListener('input', (e) => {
            animSpeed = parseInt(e.target.value);
            document.getElementById('animVal').textContent = animSpeed;
        });

        document.getElementById('widthSlider').addEventListener('input', (e) => {
            player.width = parseInt(e.target.value);
            document.getElementById('widthVal').textContent = player.width;
        });

        document.getElementById('heightSlider').addEventListener('input', (e) => {
            player.height = parseInt(e.target.value);
            document.getElementById('heightVal').textContent = player.height;
        });

        // Per-direction hitbox sliders
        document.getElementById('hbRangeSlider').addEventListener('input', (e) => {
            playerHitboxRange[hitboxEditDir] = parseInt(e.target.value);
            document.getElementById('hbRangeVal').textContent = e.target.value;
        });
        document.getElementById('hbWidthSlider').addEventListener('input', (e) => {
            playerHitboxWidth[hitboxEditDir] = parseInt(e.target.value);
            document.getElementById('hbWidthVal').textContent = e.target.value;
        });
        document.getElementById('hbOffsetXSlider').addEventListener('input', (e) => {
            playerHitboxOffsetX[hitboxEditDir] = parseInt(e.target.value);
            document.getElementById('hbOffsetXVal').textContent = e.target.value;
        });
        document.getElementById('hbOffsetYSlider').addEventListener('input', (e) => {
            playerHitboxOffsetY[hitboxEditDir] = parseInt(e.target.value);
            document.getElementById('hbOffsetYVal').textContent = e.target.value;
        });

        // Attack slide settings
        document.getElementById('slideAmountSlider').addEventListener('input', (e) => {
            attackSlideAmount = parseInt(e.target.value);
            document.getElementById('slideAmountVal').textContent = attackSlideAmount;
        });
        document.getElementById('slideDurationSlider').addEventListener('input', (e) => {
            attackSlideDuration = parseInt(e.target.value);
            document.getElementById('slideDurationVal').textContent = attackSlideDuration;
        });

        document.getElementById('zoomSlider').addEventListener('input', (e) => {
            cameraZoom = parseFloat(e.target.value);
            document.getElementById('zoomVal').textContent = cameraZoom.toFixed(1);
        });

        // Lighting controls
        document.getElementById('darknessSlider').addEventListener('input', (e) => {
            manualDarkness = parseInt(e.target.value);
            document.getElementById('darknessVal').textContent = manualDarkness;
        });

        document.getElementById('torchEnabled').addEventListener('change', (e) => {
            lightingSettingsData.playerLight = e.target.checked;
            console.log('Player torch:', e.target.checked ? 'ON' : 'OFF');
        });

        document.getElementById('torchRadiusSlider').addEventListener('input', (e) => {
            lightingSettingsData.playerLightRadius = parseInt(e.target.value);
            document.getElementById('torchRadiusVal').textContent = e.target.value;
        });

        document.getElementById('cycleEnabled').addEventListener('change', (e) => {
            dayCycleEnabled = e.target.checked;
            lastCycleUpdate = Date.now(); // Reset timer
            if (!dayCycleEnabled) {
                document.getElementById('timeDisplay').textContent = '';
            }
        });

        document.getElementById('dayLengthSlider').addEventListener('input', (e) => {
            const minutes = parseFloat(e.target.value);
            dayLength = minutes * 60; // convert to seconds
            document.getElementById('dayLengthVal').textContent = minutes;
        });

        // Item receive display settings
        document.getElementById('itemScaleSlider').addEventListener('input', (e) => {
            itemReceiveScale = parseFloat(e.target.value);
            document.getElementById('itemScaleVal').textContent = itemReceiveScale.toFixed(2);
        });

        document.getElementById('itemHeightSlider').addEventListener('input', (e) => {
            itemReceiveHeight = parseInt(e.target.value);
            document.getElementById('itemHeightVal').textContent = itemReceiveHeight;
        });

        document.getElementById('itemDurationSlider').addEventListener('input', (e) => {
            itemReceiveDuration = parseFloat(e.target.value);
            document.getElementById('itemDurationVal').textContent = itemReceiveDuration.toFixed(2);
        });

        document.getElementById('itemPauseSlider').addEventListener('input', (e) => {
            itemReceiveFinalPause = parseFloat(e.target.value);
            document.getElementById('itemPauseVal').textContent = itemReceiveFinalPause.toFixed(2);
        });

        function copySettings() {
            const settings = `Player Settings:
  scale: ${playerScale}
  speed: ${player.speed}
  animSpeed: ${animSpeed}
  width: ${player.width}
  height: ${player.height}
  cameraZoom: ${cameraZoom}
Attack Slide:
  slideAmount: ${attackSlideAmount}
  slideDuration: ${attackSlideDuration}
Item Receive Display:
  itemReceiveScale: ${itemReceiveScale}
  itemReceiveHeight: ${itemReceiveHeight}
  itemReceiveDuration: ${itemReceiveDuration}
  itemReceiveFinalPause: ${itemReceiveFinalPause}`;
            navigator.clipboard.writeText(settings).then(() => {
                alert('Settings copied to clipboard!');
            });
        }

        // Find starting position - ONLY used for initial game start (not door transitions)
        // This uses the global playerPreviewPos from the editor
        function findStartPos() {
            const tileSize = gridSize * TILE_SCALE;

            console.log('findStartPos called - INITIAL GAME START on map:', currentGameMap);

            // Check if returning from external area (3D world)
            const returnInfoStr = localStorage.getItem('externalDoorReturn');
            if (returnInfoStr) {
                try {
                    const returnInfo = JSON.parse(returnInfoStr);
                    // Only use if less than 5 minutes old (in case of stale data)
                    if (Date.now() - returnInfo.timestamp < 5 * 60 * 1000) {
                        console.log('[EXTERNAL RETURN] Spawning at door:', returnInfo);
                        // Clear the return info so we don't use it again
                        localStorage.removeItem('externalDoorReturn');
                        // Switch to the return map if different
                        if (returnInfo.map && returnInfo.map !== currentGameMap) {
                            currentGameMap = returnInfo.map;
                            const mapData = mapsData[returnInfo.map];
                            if (mapData) {
                                // Note: collision data is global, not per-map
                                layers = mapData.layers || layers;
                                mapCols = mapData.mapCols || mapCols;
                                mapRows = mapData.mapRows || mapRows;
                                buildAnimatedTileRegistry(); // Rebuild for new map
                            }
                        }
                        // Spawn at the door position
                        player.x = returnInfo.x * tileSize + tileSize / 2;
                        player.y = returnInfo.y * tileSize + tileSize / 2;
                        console.log('[EXTERNAL RETURN] Player spawned at:', player.x, player.y);
                        return;
                    } else {
                        console.log('[EXTERNAL RETURN] Return info too old, ignoring');
                        localStorage.removeItem('externalDoorReturn');
                    }
                } catch (e) {
                    console.error('[EXTERNAL RETURN] Failed to parse return info:', e);
                    localStorage.removeItem('externalDoorReturn');
                }
            }

            // Use global playerPreviewPos for initial spawn
            if (projectData.playerPreviewPos && (projectData.playerPreviewPos.x !== undefined)) {
                const pos = projectData.playerPreviewPos;
                player.x = pos.x * tileSize + tileSize / 2;
                player.y = pos.y * tileSize + tileSize / 2;
                // Store initial spawn for respawn on death
                initialSpawnX = player.x;
                initialSpawnY = player.y;
                initialSpawnMap = projectData.spawnMapName || currentGameMap;
                console.log('Initial spawn: tile', pos.x, pos.y, '-> pixel', player.x, player.y);
                return;
            }

            console.log('No playerPreviewPos found, using fallback');
            // Fallback: find first tile without collision
            const layer = layers[0];
            if (!layer) {
                console.error('No layers found for starting position');
                return;
            }
            for (let y = 0; y < mapRows; y++) {
                for (let x = 0; x < mapCols; x++) {
                    const cell = layer[y] && layer[y][x];
                    if (cell && cell.type === 'tile') {
                        const key = cell.x + ',' + cell.y;
                        if (!tileCollisions[key]) {
                            player.x = x * tileSize + tileSize / 2;
                            player.y = y * tileSize + tileSize / 2;
                            console.log('Start position: tile', x, y);
                            return;
                        }
                    }
                }
            }
            // If no safe tile, just start at first tile
            for (let y = 0; y < mapRows; y++) {
                for (let x = 0; x < mapCols; x++) {
                    const cell = layer[y] && layer[y][x];
                    if (cell) {
                        player.x = x * tileSize + tileSize / 2;
                        player.y = y * tileSize + tileSize / 2;
                        console.log('Start position (fallback): tile', x, y);
                        return;
                    }
                }
            }
        }

        // Camera
        const camera = { x: 0, y: 0 };
        // Previous positions for render interpolation (smooth 120Hz rendering)
        let prevCameraX = 0;
        let prevCameraY = 0;
        let prevPlayerX = 0;
        let prevPlayerY = 0;

        // Input
        const keys = {};

        document.addEventListener('keydown', e => {
            keys[e.key] = true;

            // === SHOP CONTROLS (mouse-based, escape to close) ===
            if (shopOpen) {
                e.preventDefault();
                if (e.key === 'Escape') {
                    closeShop();
                }
                return; // Block all other keys while shop is open
            }

            if (e.key === 'Escape') {
                if (inventoryOpen) {
                    inventoryOpen = false;
                    cursorItem = null;
                } else {
                    window.close();
                }
                return;
            }
            if (e.key === 'c' || e.key === 'C') showCollision = !showCollision;
            if (e.key === 'h' || e.key === 'H') toggleAllUI();
            if (e.key === 'q' || e.key === 'Q') toggleQuestLog();
            // Inventory toggle (I key)
            if (e.key === 'i' || e.key === 'I') {
                inventoryOpen = !inventoryOpen;
                if (!inventoryOpen) cursorItem = null; // Drop cursor item when closing
                // Play inventory sound
                const soundAction = inventoryOpen ? 'inventoryOpen' : 'inventoryClose';
                if (playerSoundsData[soundAction] && playerSoundsData[soundAction].soundIndex >= 0) {
                    const snd = soundsData[playerSoundsData[soundAction].soundIndex];
                    if (snd && snd.data) {
                        const audio = new Audio(snd.data);
                        audio.volume = playerSoundsData[soundAction].volume || 0.5;
                        audio.play().catch(() => {});
                    }
                }
            }
            // Hotbar selection (1-9, 0)
            if (e.key >= '1' && e.key <= '9') {
                selectedHotbarSlot = parseInt(e.key) - 1;
            }
            if (e.key === '0') {
                selectedHotbarSlot = 9;
            }
            // Dialog choice navigation (when dialog has choices)
            if (activeDialog && dialogTypingState.complete) {
                const page = activeDialog.dialog?.pages?.[activeDialog.pageIndex];
                if (page?.choices && page.choices.length > 0) {
                    if (e.key === 'ArrowUp') {
                        const prev = dialogSelectedChoice;
                        dialogSelectedChoice = Math.max(0, dialogSelectedChoice - 1);
                        if (dialogSelectedChoice !== prev) dialogMoveSound();
                        renderDialogBox();
                        return;
                    }
                    if (e.key === 'ArrowDown') {
                        const prev = dialogSelectedChoice;
                        dialogSelectedChoice = Math.min(page.choices.length - 1, dialogSelectedChoice + 1);
                        if (dialogSelectedChoice !== prev) dialogMoveSound();
                        renderDialogBox();
                        return;
                    }
                    if (e.key === 'z' || e.key === 'Z' || e.key === 'Enter' || e.key === 'a' || e.key === 'A') {
                        selectDialogChoice();
                        return;
                    }
                }
            }

            // Interact key (A) - for dialogs, doors, NPCs, and shops
            if ((e.key === 'a' || e.key === 'A') && !player.attacking) {
                // Shop NPCs open via their assigned dialog (shop.dialogId) — a normal authored
                // dialog that contains an 'Open Shop' choice. No synthetic greeting, no choice
                // injection, no shadowing of a real dialog (the shop dialog IS the conversation).
                const shopResult = checkShopInteraction();
                if (shopResult && shopResult.shopIndex >= 0 && !activeDialog) {
                    const shop = shops[shopResult.shopIndex];
                    const did = parseInt(shop?.dialogId);
                    if (!isNaN(did) && dialogs[did]) {
                        activeDialog = {
                            dialog: dialogs[did],
                            pageIndex: 0,
                            npc: shopResult.npc,
                            shopIndex: shopResult.shopIndex
                        };
                        dialogSelectedChoice = 0;
                        resetDialogTyping();
                        renderDialogBox();
                        return;
                    }
                    // Defensive fallback: shop has no valid dialog assigned — open it directly.
                    openShop(shopResult.shopIndex);
                    return;
                }
                handleInteract();
            }
            // Attack key (Space)
            if (e.key === ' ') {
                useActiveItem(); // attack button uses the equipped hotbar item (sword swing / boomerang throw)
            }
        });
        document.addEventListener('keyup', e => keys[e.key] = false);

        // Mouse tracking for inventory
        let mouseX = 0, mouseY = 0;
        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
            mouseX = (e.clientX - rect.left) * sx;
            mouseY = (e.clientY - rect.top) * sy;
        });

        // Click handling for inventory and shop
        canvas.addEventListener('click', e => {
            const rect = canvas.getBoundingClientRect();
            const csx = canvas.width / rect.width, csy = canvas.height / rect.height;
            const clickX = (e.clientX - rect.left) * csx;
            const clickY = (e.clientY - rect.top) * csy;

            // Handle shop clicks first
            if (shopOpen) {
                handleShopClick(clickX, clickY);
                return;
            }

            if (!inventoryOpen) return;

            // Calculate inventory popup position (same as in drawInventoryPopup)
            const cols = 10;
            const rows = 4;
            const padding = 20;
            const invWidth = cols * SLOT_SIZE + (cols - 1) * 2 + padding * 2;
            const invHeight = rows * SLOT_SIZE + (rows - 1) * 2 + padding * 2 + 30;
            const invX = (canvas.width - invWidth) / 2;
            const invY = (canvas.height - invHeight) / 2;

            // Check if click is in a slot
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const slotIdx = row * cols + col;
                    const slotX = invX + padding + col * (SLOT_SIZE + 2);
                    const slotY = invY + padding + 30 + row * (SLOT_SIZE + 2);

                    if (clickX >= slotX && clickX < slotX + SLOT_SIZE &&
                        clickY >= slotY && clickY < slotY + SLOT_SIZE) {
                        // Clicked on this slot
                        handleInventoryClick(slotIdx);
                        return;
                    }
                }
            }
        });

        // Handle inventory slot click
        function handleInventoryClick(slotIdx) {
            const clickedSlot = inventorySlots[slotIdx];

            if (cursorItem === null) {
                // Pick up item from slot
                if (clickedSlot) {
                    cursorItem = { ...clickedSlot };
                    inventorySlots[slotIdx] = null;
                }
            } else {
                // Have item on cursor
                if (clickedSlot === null) {
                    // Empty slot - place item
                    inventorySlots[slotIdx] = { ...cursorItem };
                    cursorItem = null;
                } else if (clickedSlot.itemIndex === cursorItem.itemIndex) {
                    // Same item - try to stack
                    const maxStack = getMaxStack(cursorItem.itemIndex);
                    const canAdd = Math.min(cursorItem.quantity, maxStack - clickedSlot.quantity);
                    if (canAdd > 0) {
                        clickedSlot.quantity += canAdd;
                        cursorItem.quantity -= canAdd;
                        if (cursorItem.quantity <= 0) {
                            cursorItem = null;
                        }
                    } else {
                        // Stack full - swap
                        const temp = { ...clickedSlot };
                        inventorySlots[slotIdx] = { ...cursorItem };
                        cursorItem = temp;
                    }
                } else {
                    // Different item - swap
                    const temp = { ...clickedSlot };
                    inventorySlots[slotIdx] = { ...cursorItem };
                    cursorItem = temp;
                }
            }
        }

        // Virtual Joystick controls - appears where user touches left half
        const joystickBase = document.getElementById('joystickBase');
        const joystickThumb = document.getElementById('joystickThumb');
        const leftTouchZone = document.getElementById('leftTouchZone');
        let joystickActive = false;
        let joystickCenter = { x: 0, y: 0 };
        let joystickTouchId = null;
        const joystickMaxDist = 40;
        const joystickDeadzone = 10;

        function updateJoystick(touchX, touchY) {
            const dx = touchX - joystickCenter.x;
            const dy = touchY - joystickCenter.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Clamp to max distance
            let clampedX = dx;
            let clampedY = dy;
            if (dist > joystickMaxDist) {
                clampedX = (dx / dist) * joystickMaxDist;
                clampedY = (dy / dist) * joystickMaxDist;
            }

            // Move thumb (relative to joystick center which is 60px from edge)
            joystickThumb.style.left = (60 + clampedX) + 'px';
            joystickThumb.style.top = (60 + clampedY) + 'px';

            // Reset keys
            keys['ArrowUp'] = false;
            keys['ArrowDown'] = false;
            keys['ArrowLeft'] = false;
            keys['ArrowRight'] = false;

            // Set keys based on direction (if outside deadzone)
            if (dist > joystickDeadzone) {
                const angle = Math.atan2(dy, dx);
                const P = Math.PI;
                // 8 sectors of 45°. Diagonal sectors set TWO arrows; the engine derives a diagonal
                // facing from the (dx,dy) pair when the active sprite supports it, else stays cardinal.
                if (angle > -P/8 && angle <= P/8) { keys['ArrowRight'] = true; }                                 // E
                else if (angle > P/8 && angle <= 3*P/8) { keys['ArrowRight'] = true; keys['ArrowDown'] = true; } // SE
                else if (angle > 3*P/8 && angle <= 5*P/8) { keys['ArrowDown'] = true; }                          // S
                else if (angle > 5*P/8 && angle <= 7*P/8) { keys['ArrowDown'] = true; keys['ArrowLeft'] = true; }// SW
                else if (angle > 7*P/8 || angle <= -7*P/8) { keys['ArrowLeft'] = true; }                         // W
                else if (angle > -7*P/8 && angle <= -5*P/8) { keys['ArrowLeft'] = true; keys['ArrowUp'] = true; }// NW
                else if (angle > -5*P/8 && angle <= -3*P/8) { keys['ArrowUp'] = true; }                          // N
                else { keys['ArrowUp'] = true; keys['ArrowRight'] = true; }                                      // NE
            }
        }

        function resetJoystick() {
            joystickActive = false;
            joystickTouchId = null;
            joystickBase.classList.remove('active');
            joystickThumb.style.left = '50%';
            joystickThumb.style.top = '50%';
            joystickThumb.style.transform = 'translate(-50%, -50%)';
            keys['ArrowUp'] = false;
            keys['ArrowDown'] = false;
            keys['ArrowLeft'] = false;
            keys['ArrowRight'] = false;
        }

        // Touch on left half of screen - show joystick at touch position
        leftTouchZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            joystickTouchId = touch.identifier;
            joystickActive = true;

            // Position joystick centered on touch
            const x = touch.clientX - 60;
            const y = touch.clientY - 60;
            joystickBase.style.left = x + 'px';
            joystickBase.style.top = y + 'px';
            joystickBase.classList.add('active');

            // Set center for movement calculation
            joystickCenter = { x: touch.clientX, y: touch.clientY };
            joystickThumb.style.left = '50%';
            joystickThumb.style.top = '50%';
            joystickThumb.style.transform = 'translate(-50%, -50%)';
        }, { passive: false });

        leftTouchZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!joystickActive) return;
            // Find our touch
            for (let touch of e.touches) {
                if (touch.identifier === joystickTouchId) {
                    updateJoystick(touch.clientX, touch.clientY);
                    break;
                }
            }
        }, { passive: false });

        leftTouchZone.addEventListener('touchend', (e) => {
            // Check if our touch ended
            for (let touch of e.changedTouches) {
                if (touch.identifier === joystickTouchId) {
                    resetJoystick();
                    break;
                }
            }
        });
        leftTouchZone.addEventListener('touchcancel', resetJoystick);

        // Attack button (mobile) — uses the equipped hotbar item (sword swing / boomerang throw)
        document.getElementById('attackBtn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            useActiveItem();
        }, { passive: false });
        document.getElementById('attackBtn').addEventListener('click', () => {
            useActiveItem();
        });

        // Interact button (mobile) - for doors, NPCs, and dialogs
        const interactBtn = document.getElementById('interactBtn');
        if (interactBtn) {
            interactBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                handleInteract();
            }, { passive: false });
            interactBtn.addEventListener('click', () => {
                handleInteract();
            });
        }

        function handleInteract() {
            // If dialog is active, advance it
            if (activeDialog) {
                advanceDialog();
                return;
            }
            // Check for items first, then animated props, then dialogs, then triggers
            if (!checkItemInteraction()) {
                if (!checkAnimPropInteraction()) {
                    if (!checkDialogInteraction()) {
                        checkTriggerInteraction('interact');
                    }
                }
            }
        }

        // Check for nearby items and pick them up with receive animation
        function checkItemInteraction() {
            if (isReceivingItem) return false; // Already receiving an item

            const tileSize = gridSize * TILE_SCALE;
            const playerTileX = Math.floor((player.x + player.width / 2) / tileSize);
            const playerTileY = Math.floor((player.y + player.height * 0.8) / tileSize);

            for (let i = 0; i < placedItemsData.length; i++) {
                const placed = placedItemsData[i];
                if (placed.mapName && placed.mapName !== currentGameMap) continue;

                const state = itemStates[i];
                if (!state || state.used) continue;

                // Check if player is adjacent to item
                const dx = Math.abs(placed.x - playerTileX);
                const dy = Math.abs(placed.y - playerTileY);
                if (dx <= 1 && dy <= 1) {
                    // Mark item as used immediately (disappears from map)
                    state.used = true;

                    // Get item data for receive animation
                    const item = itemsData[placed.itemIndex];
                    if (item) {
                        // Start player receive item animation
                        startReceivingItem(placed.itemIndex, item);
                        console.log('[ITEM] Picked up item:', item.name, 'at', placed.x, placed.y);
                    }

                    // Broadcast to other players
                    if (mpSocket && mpConnected) {
                        mpSocket.send(JSON.stringify({
                            type: 'itemInteract', // Wave 3: renamed from 'itemPickup' to match receiver
                            itemIndex: i,
                            x: placed.x,
                            y: placed.y,
                            mapName: placed.mapName || currentGameMap
                        }));
                    }
                    return true;
                }
            }
            return false;
        }

        // Update item animations each frame
        function updateItemAnimations() {
            for (let i = 0; i < placedItemsData.length; i++) {
                const placed = placedItemsData[i];
                if (placed.mapName && placed.mapName !== currentGameMap) continue;

                const state = itemStates[i];
                if (!state || !state.animating) continue;

                const item = itemsData[placed.itemIndex];
                if (!item || !item.frames || item.frames.length === 0) continue;

                const fps = item.fps || 8;
                const animSpeed = Math.max(1, Math.round(60 / fps));

                state.frameTimer++;
                if (state.frameTimer >= animSpeed) {
                    state.frameTimer = 0;
                    state.frame++;

                    // Animation complete
                    if (state.frame >= item.frames.length) {
                        state.animating = false;
                        state.used = true;
                        state.frame = item.frames.length - 1; // Stay on last frame
                        console.log('[ITEM] Animation complete, item used');
                    }
                }
            }
        }

        // Check for nearby interactive animated props and trigger their animation
        function checkAnimPropInteraction() {
            const tileSize = gridSize * TILE_SCALE;
            const playerTileX = Math.floor((player.x + player.width / 2) / tileSize);
            const playerTileY = Math.floor((player.y + player.height * 0.8) / tileSize);

            // Search layers for interactive animated props near player
            for (let li = 0; li < layers.length; li++) {
                if (!layers[li]) continue;

                // Check tiles around player
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const tx = playerTileX + dx;
                        const ty = playerTileY + dy;

                        if (ty < 0 || ty >= layers[li].length) continue;
                        if (!layers[li][ty] || tx < 0 || tx >= layers[li][ty].length) continue;

                        const cell = layers[li][ty][tx];
                        if (!cell || (cell.type !== 'animTile' && cell.type !== 'animTrunk') || cell.propIndex === undefined) continue;

                        const propData = animatedPropsData[cell.propIndex];
                        if (!propData || propData.type !== 'interactive') continue;

                        // Use origin position for multi-tile props
                        const originX = tx - (cell.offsetX || 0);
                        const originY = ty - (cell.offsetY || 0);
                        const key = originX + ',' + originY + ',' + li;

                        // Check if already used
                        if (interactivePropStates[key] && interactivePropStates[key].used) continue;

                        // Initialize state if needed
                        if (!interactivePropStates[key]) {
                            interactivePropStates[key] = { used: false, animating: false, frame: 0, gaveItem: false };
                        }

                        // Skip if already animating
                        if (interactivePropStates[key].animating) continue;

                        // Locked? Require the key item in inventory; consume it (or not) per config.
                        const _lockIdx = (propData.lockItemIndex !== undefined) ? propData.lockItemIndex : -1;
                        if (_lockIdx >= 0) {
                            if (!hasInventoryItem(_lockIdx)) {
                                const _kn = (itemsData[_lockIdx] && itemsData[_lockIdx].name) || 'a key';
                                showGameToast('🔒 Locked — needs ' + _kn);
                                continue; // can't open without the key
                            }
                            if (propData.lockConsume !== false) consumeInventoryItem(_lockIdx, 1);
                        }

                        // Trigger animation!
                        interactivePropStates[key].animating = true;
                        interactivePropStates[key].frame = 0;
                        console.log('[ANIM PROP] Interacted with', propData.name, 'at', originX, originY);

                        // Give item if configured - check for instance override first
                        if (propData.giveItem) {
                            // Find matching placed prop to check for instance-specific item
                            const placedProp = placedAnimPropsData.find(p =>
                                p.x === originX && p.y === originY &&
                                (!p.mapName || p.mapName === currentGameMap)
                            );
                            // Use instance item if set, otherwise use default from prop definition
                            let itemIdx = propData.giveItemIndex;
                            if (placedProp && placedProp.instanceItemIndex !== undefined && placedProp.instanceItemIndex >= 0) {
                                itemIdx = placedProp.instanceItemIndex;
                            }
                            if (itemIdx >= 0 && itemIdx < itemsData.length) {
                                const givenItem = itemsData[itemIdx];
                                console.log('[ANIM PROP] Giving item:', givenItem?.name || 'Item ' + itemIdx, placedProp?.instanceItemIndex !== undefined ? '(instance override)' : '(default)');
                                // Start receive item animation and display
                                startReceivingItem(itemIdx, givenItem);
                                interactivePropStates[key].gaveItem = true;
                            }
                        }

                        // Broadcast to other players
                        if (mpSocket && mpConnected) {
                            mpSocket.send(JSON.stringify({
                                type: 'propInteract',
                                key: key,
                                originX: originX,
                                originY: originY,
                                layer: li,
                                mapName: currentGameMap
                            }));
                        }

                        return true;
                    }
                }
            }
            return false;
        }

        // Update interactive animated prop animations each frame
        function updateAnimPropInteractions() {
            for (const key in interactivePropStates) {
                const state = interactivePropStates[key];
                if (!state.animating) continue;

                // Parse key to get prop info
                const parts = key.split(',');
                const originX = parseInt(parts[0]);
                const originY = parseInt(parts[1]);
                const li = parseInt(parts[2]);

                // Find the prop data from the cell
                if (!layers[li] || !layers[li][originY] || !layers[li][originY][originX]) continue;
                const cell = layers[li][originY][originX];
                if (!cell || cell.propIndex === undefined) continue;

                const propData = animatedPropsData[cell.propIndex];
                if (!propData || !propData.frames || propData.frames.length === 0) continue;

                const fps = propData.fps || 8;
                const frameDelay = Math.max(1, Math.round(60 / fps));

                state.timer = (state.timer || 0) + 1;
                if (state.timer >= frameDelay) {
                    state.timer = 0;
                    state.frame++;

                    // Update the frame timer so rendering uses the correct frame
                    if (!animPropFrameTimers[key]) {
                        animPropFrameTimers[key] = { frame: 0, timer: 0 };
                    }
                    animPropFrameTimers[key].frame = state.frame;

                    // Animation complete
                    if (state.frame >= propData.frames.length) {
                        state.animating = false;
                        state.used = true;
                        state.frame = propData.frames.length - 1;
                        animPropFrameTimers[key].frame = state.frame;
                        console.log('[ANIM PROP] Animation complete');
                    }
                }
            }
        }

        // Start the receive item animation and floating item display
        function startReceivingItem(itemIndex, itemData) {
            console.log('[RECEIVE ITEM] Starting receive animation for:', itemData?.name || itemIndex);
            isReceivingItem = true;
            receivingItemData = {
                itemIndex: itemIndex,
                item: itemData,
                startTime: Date.now(),
                frame: 0,
                frameTimer: 0,
                displayTimer: 0,
                floatOffset: 0,
                pausing: false  // True when on final frame pause
            };
            receiveItemAnimFrame = 0;
            receiveItemAnimTimer = 0;

            // Stop player movement during receive animation
            player.moving = false;
        }

        // Update receive item animation each frame
        function updateReceiveItemAnimation() {
            if (!isReceivingItem || !receivingItemData) return;

            const totalDurationMs = itemReceiveDuration * 1000;
            const finalPauseMs = itemReceiveFinalPause * 1000;
            const elapsed = Date.now() - receivingItemData.startTime;

            // Update floating item display timer for bob effect
            receivingItemData.displayTimer++;
            receivingItemData.floatOffset = Math.sin(receivingItemData.displayTimer * 0.1) * 5;

            // Get receive item animation frames based on direction
            const receiveDirMap = { down: 'receiveItemDown', up: 'receiveItemUp', left: 'receiveItemLeft', right: 'receiveItemRight' };
            const receiveKey = receiveDirMap[cardinalOf(player.direction)];
            let receiveFrames = [];

            if (playerAnimations) {
                // Try directional first, then fallback to receivedItem, then empty
                receiveFrames = playerAnimations[receiveKey] || playerAnimations.receivedItem || [];
            }

            // Update player animation frames
            if (receiveFrames.length > 0) {
                const fps = playerAnimFpsList[receiveKey] || playerAnimFpsList.receivedItem || 8;
                const frameDelay = Math.round(60 / fps);

                receivingItemData.frameTimer++;
                if (receivingItemData.frameTimer >= frameDelay) {
                    receivingItemData.frameTimer = 0;

                    // If not on last frame, advance
                    if (receivingItemData.frame < receiveFrames.length - 1) {
                        receivingItemData.frame++;
                    } else if (!receivingItemData.pausing) {
                        // Start final frame pause
                        receivingItemData.pausing = true;
                        receivingItemData.pauseStart = Date.now();
                    }
                }
            }

            // Check if animation complete (total duration or pause complete)
            const isPauseComplete = receivingItemData.pausing &&
                (Date.now() - receivingItemData.pauseStart >= finalPauseMs);

            if (elapsed >= totalDurationMs || isPauseComplete) {
                console.log('[RECEIVE ITEM] Animation complete');
                // Add item to inventory
                if (receivingItemData.itemIndex !== undefined) {
                    addToInventory(receivingItemData.itemIndex, 1);
                }
                isReceivingItem = false;
                receivingItemData = null;
            }
        }

        // Draw floating item above player
        function drawFloatingItem(screenX, screenY) {
            if (!isReceivingItem || !receivingItemData || !receivingItemData.item) return;

            const item = receivingItemData.item;
            const itemIndex = receivingItemData.itemIndex;
            if (!item.frames || item.frames.length === 0) return;

            // Get the item's sprite image from preloaded itemImages
            const itemImg = itemImages[itemIndex];
            if (!itemImg || !itemImg.complete) return;

            // Get first frame of item (static display)
            const frame = item.frames[0];
            if (!frame) return;

            const scale = itemReceiveScale;
            const floatY = itemReceiveHeight + receivingItemData.floatOffset;

            // Center item above player
            const drawW = frame.w * scale;
            const drawH = frame.h * scale;
            const drawX = screenX - drawW / 2;
            const drawY = screenY - floatY - drawH;

            // Draw the item sprite
            ctx.drawImage(
                itemImg,
                frame.x, frame.y,
                frame.w, frame.h,
                drawX, drawY,
                drawW, drawH
            );
        }

        // Pixel-level collision check on ALL layers
        // Pre-allocated collision check points to avoid GC (8 points: corners + edge midpoints)
        const collisionPoints = [
            { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 },
            { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }
        ];

        // PORT-TODO(monogame): collision = rotation-aware tiles + scaled-bounds anim props (registry pass, scale/nudge/mirror/rotation inverse). docs/PORTING.md §B.
        function checkCollision(x, y, w, h) {
            const tileSize = gridSize * TILE_SCALE;
            const pixelScale = tileSize / gridSize;

            // Update pre-allocated points instead of creating new array
            collisionPoints[0].x = x;           collisionPoints[0].y = y;
            collisionPoints[1].x = x + w - 1;   collisionPoints[1].y = y;
            collisionPoints[2].x = x;           collisionPoints[2].y = y + h - 1;
            collisionPoints[3].x = x + w - 1;   collisionPoints[3].y = y + h - 1;
            collisionPoints[4].x = x + w / 2;   collisionPoints[4].y = y;
            collisionPoints[5].x = x + w / 2;   collisionPoints[5].y = y + h - 1;
            collisionPoints[6].x = x;           collisionPoints[6].y = y + h / 2;
            collisionPoints[7].x = x + w - 1;   collisionPoints[7].y = y + h / 2;

            for (let pi = 0; pi < 8; pi++) {
                const point = collisionPoints[pi];
                const tileX = Math.floor(point.x / tileSize);
                const tileY = Math.floor(point.y / tileSize);

                // Out of bounds = collision
                if (tileX < 0 || tileX >= mapCols || tileY < 0 || tileY >= mapRows) {
                    return true;
                }

                // Check static objects for collision (per-instance collision box)
                for (let i = 0; i < placedStaticObjectsData.length; i++) {
                    const placed = placedStaticObjectsData[i];
                    if (placed.mapName && placed.mapName !== currentGameMap) continue;

                    const obj = staticObjectsData[placed.objIndex];
                    if (!obj) continue;

                    const scale = placed.scale || 1;
                    const objPixelX = placed.x * tileSize;
                    const objPixelY = placed.y * tileSize;
                    const objPixelW = obj.width * tileSize * scale;
                    const objPixelH = obj.height * tileSize * scale;

                    // Use per-instance collision box if defined, otherwise use full object bounds
                    let collisionX, collisionY, collisionW, collisionH;
                    if (placed.collisionBox) {
                        const cb = placed.collisionBox;
                        // Skip if collision is set to zero size (no collision)
                        if (cb.w <= 0 || cb.h <= 0) continue;
                        // Collision box is relative to object origin, scale it
                        const boxScale = tileSize / gridSize;
                        collisionX = objPixelX + cb.x * boxScale;
                        collisionY = objPixelY + cb.y * boxScale;
                        collisionW = cb.w * boxScale;
                        collisionH = cb.h * boxScale;
                    } else {
                        // Default: full object bounds
                        collisionX = objPixelX;
                        collisionY = objPixelY;
                        collisionW = objPixelW;
                        collisionH = objPixelH;
                    }

                    if (point.x >= collisionX && point.x < collisionX + collisionW &&
                        point.y >= collisionY && point.y < collisionY + collisionH) {
                        return true;
                    }
                }

                // Animated props: test the point against each placed prop's SCALED bounds.
                // (The per-tile scan below can't see scale/nudge overflow beyond the footprint tiles.)
                if (typeof animatedTileRegistry !== 'undefined' && animatedTileRegistry) {
                    for (let ri = 0; ri < animatedTileRegistry.length; ri++) {
                        const reg = animatedTileRegistry[ri];
                        const rlayer = layers[reg.li];
                        if (!rlayer || !rlayer[reg.y]) continue;
                        const rcell = rlayer[reg.y][reg.x];
                        if (!rcell || rcell.type !== 'animTile') continue;
                        const rprop = animatedPropsData[rcell.propIndex];
                        if (!rprop) continue;
                        const rTimer = animPropFrameTimers[reg.x + ',' + reg.y + ',' + reg.li] || { frame: 0 };
                        let rmask = null;
                        if (rprop.collisionMasks) {
                            const fc = (rprop.frames && rprop.frames.length) || 1;
                            rmask = rprop.collisionMasks[rTimer.frame % fc] || rprop.collisionMasks[0];
                        } else if (rprop.collisionMask) {
                            rmask = rprop.collisionMask;
                        }
                        if (!rmask) continue;
                        const cs = rcell.scale || 1;
                        const tw = rcell.tilesW || 1, th = rcell.tilesH || 1;
                        const propW = tw * tileSize, propH = th * tileSize;
                        const rectX = reg.x * tileSize - propW * (cs - 1) / 2 + (rcell.nudgeX || 0) * pixelScale;
                        const rectY = reg.y * tileSize - propH * (cs - 1) / 2 + (rcell.nudgeY || 0) * pixelScale;
                        if (point.x < rectX || point.x >= rectX + propW * cs || point.y < rectY || point.y >= rectY + propH * cs) continue;
                        let mfx = (point.x - rectX) / cs / pixelScale;
                        const mfy = (point.y - rectY) / cs / pixelScale;
                        if (rcell.mirror) mfx = (tw * gridSize) - 1 - mfx;
                        let rmx = Math.floor(mfx), rmy = Math.floor(mfy);
                        // Rotated square-footprint props: invert rotation into mask space.
                        if (rcell.rotation && tw === th) {
                            const rc = unrotateMaskCoord(rmx, rmy, tw * gridSize, rcell.rotation, false);
                            rmx = rc[0]; rmy = rc[1];
                        }
                        if (rmy >= 0 && rmy < rmask.length && rmask[rmy] && rmx >= 0 && rmx < rmask[rmy].length && rmask[rmy][rmx]) {
                            return true;
                        }
                    }
                }

                // Check ALL layers for collision
                for (let li = 0; li < layers.length; li++) {
                    const layer = layers[li];
                    if (!layer) continue;

                    const cell = layer[tileY] && layer[tileY][tileX];
                    if (cell) {
                        // Include tileset index in key for tiles
                        const tilesetIdx = cell.tilesetIndex || 0;
                        const key = cell.type === 'tile'
                            ? tilesetIdx + ':' + cell.x + ',' + cell.y
                            : cell.x + ',' + cell.y;
                        // Use tile collision masks for tiles, prop collision masks for props.
                        // (Animated props are handled by the scaled-bounds registry pass above.)
                        let mask = null;
                        if (cell.type === 'prop') {
                            const propIdx = cell.propIndex || 0;
                            const propKey = cell.x + ',' + cell.y;
                            mask = propCollisionMasksAll[propIdx] ? propCollisionMasksAll[propIdx][propKey] : null;
                        } else if (cell.type === 'tile') {
                            mask = collisionMasks[key];
                        }

                        if (mask) {
                            let localX = Math.floor((point.x % tileSize) / pixelScale);
                            let localY = Math.floor((point.y % tileSize) / pixelScale);
                            // Rotated/flipped tiles: invert the render transform (rotate then flip)
                            // so the collision mask matches the rotated sprite.
                            if (cell.type === 'tile' && (cell.rotation || cell.flipped)) {
                                const rc = unrotateMaskCoord(localX, localY, gridSize, cell.rotation, cell.flipped);
                                localX = rc[0]; localY = rc[1];
                            }
                            if (localY >= 0 && localY < mask.length && mask[localY] &&
                                localX >= 0 && localX < mask[localY].length && mask[localY][localX]) {
                                return true;
                            }
                        } else if (cell.type === 'tile' && tileCollisions[key]) {
                            // Full tile collision (no mask = solid tile)
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        // Check collision with all NPCs - uses collision box (simple AABB)
        function checkNPCCollision(x, y, w, h) {
            const tileSize = gridSize * TILE_SCALE;
            for (let i = 0; i < placedNpcs.length; i++) {
                const placed = placedNpcs[i];
                // Only check NPCs on current map
                if (placed.mapName && placed.mapName !== currentGameMap) continue;

                const state = npcRuntimeState[i];
                if (!state) continue;
                const npc = npcs[placed.npcIndex];
                if (!npc) continue;

                // Skip collision with enemy NPCs on damage cooldown (lets player escape)
                if (placed.isEnemy && state.damageCooldown > 0) continue;

                // Get NPC dimensions - use same logic as debug draw for consistency
                // Get frame dimensions from animation data or npc settings
                const anims = npc.animations || {};
                const firstAnim = anims.walkDown || anims.idle || Object.values(anims).find(a => a && a.length > 0);
                const firstFrame = firstAnim && firstAnim[0];
                const frameW = (firstFrame && firstFrame.w) || npc.frameWidth || 32;
                const frameH = (firstFrame && firstFrame.h) || npc.frameHeight || 32;
                const npcScale = placed.scale || 1;
                const scaledW = tileSize * npcScale;
                const scaledH = tileSize * npcScale;
                // Use single scale like debug draw does (drawW / frameW)
                const pixelScale = scaledW / frameW;

                // Calculate NPC screen position (anchored at bottom-center) - same as drawNPC
                const npcBaseX = state.x * TILE_SCALE + (tileSize - scaledW) / 2;
                const npcBaseY = state.y * TILE_SCALE + tileSize - scaledH;

                // Use collision insets if defined (shrink from each edge)
                const insets = npc.collisionInsets;
                let npcX, npcY, npcW, npcH;
                if (insets && (insets.top > 0 || insets.bottom > 0 || insets.left > 0 || insets.right > 0)) {
                    npcX = npcBaseX + insets.left * pixelScale;
                    npcY = npcBaseY + insets.top * pixelScale;
                    npcW = scaledW - (insets.left + insets.right) * pixelScale;
                    npcH = scaledH - (insets.top + insets.bottom) * pixelScale;
                } else {
                    // No insets - use full NPC sprite bounds (the working default)
                    npcX = npcBaseX;
                    npcY = npcBaseY;
                    npcW = scaledW;
                    npcH = scaledH;
                }

                // AABB collision check
                if (x < npcX + npcW && x + w > npcX &&
                    y < npcY + npcH && y + h > npcY) {
                    return true;
                }
            }
            return false;
        }

        // Check if NPC at given position would collide with player
        function checkNPCPlayerCollision(npcTileX, npcTileY, npcIndex) {
            const tileSize = gridSize * TILE_SCALE;
            const placed = placedNpcs[npcIndex];
            const npc = npcs[placed?.npcIndex];
            if (!npc) return false;

            // Get NPC dimensions
            const anims = npc.animations || {};
            const firstAnim = anims.walkDown || anims.idle || Object.values(anims).find(a => a && a.length > 0);
            const firstFrame = firstAnim && firstAnim[0];
            const frameW = (firstFrame && firstFrame.w) || npc.frameWidth || 32;
            const npcScale = placed.scale || 1;
            const scaledW = tileSize * npcScale;
            const scaledH = tileSize * npcScale;
            const pixelScale = scaledW / frameW;

            // Calculate NPC screen position (anchored at bottom-center)
            const npcBaseX = npcTileX * TILE_SCALE + (tileSize - scaledW) / 2;
            const npcBaseY = npcTileY * TILE_SCALE + tileSize - scaledH;

            // Use collision insets if defined
            const insets = npc.collisionInsets;
            let npcHitX, npcHitY, npcW, npcH;
            if (insets && (insets.top > 0 || insets.bottom > 0 || insets.left > 0 || insets.right > 0)) {
                npcHitX = npcBaseX + insets.left * pixelScale;
                npcHitY = npcBaseY + insets.top * pixelScale;
                npcW = scaledW - (insets.left + insets.right) * pixelScale;
                npcH = scaledH - (insets.top + insets.bottom) * pixelScale;
            } else {
                // No insets - use full NPC sprite bounds
                npcHitX = npcBaseX;
                npcHitY = npcBaseY;
                npcW = scaledW;
                npcH = scaledH;
            }

            // Player foot hitbox (bottom 1/3)
            const playerW = player.width * 0.7;
            const playerH = player.height / 3;
            const playerHitX = player.x + (player.width - playerW) / 2;
            const playerHitY = player.y + player.height * 2/3;

            // AABB collision check
            return npcHitX < playerHitX + playerW && npcHitX + npcW > playerHitX &&
                   npcHitY < playerHitY + playerH && npcHitY + npcH > playerHitY;
        }
