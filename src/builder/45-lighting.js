        // ===== LIGHTING MANAGEMENT =====
        let lightingPreviewEnabled = false;

        function toggleLightingPreview() {
            lightingPreviewEnabled = !lightingPreviewEnabled;
            const btn = document.getElementById('lightingPreviewBtn');
            if (btn) {
                btn.textContent = lightingPreviewEnabled ? 'Toggle Darkness: ON' : 'Toggle Darkness: OFF';
                btn.style.background = lightingPreviewEnabled ? '#5a8a2a' : '#2a5a8a';
            }
            // Show/hide darkness slider
            const darknessRow = document.getElementById('previewDarknessRow');
            if (darknessRow) {
                darknessRow.style.display = lightingPreviewEnabled ? 'block' : 'none';
            }
            renderMap();
        }

        function updateLightingSettings() {
            lightingSettings.playerLight = document.getElementById('playerLight').checked;
            lightingSettings.playerLightRadius = parseInt(document.getElementById('playerLightRadius').value);
            renderMap();
            // Wave 3: broadcast player-torch settings (was silently local-only).
            broadcastEdit({ editType: 'lightingSettings', settings: {
                playerLight: lightingSettings.playerLight,
                playerLightRadius: lightingSettings.playerLightRadius
            }});
        }

        // Wave 3: single removal path for point lights — UI list, right-click, and any new callers.
        function removeLightByKey(key) {
            if (!pointLights[key]) return;
            delete pointLights[key];
            updatePlacedLightsList();
            renderMap();
            broadcastEdit({ editType: 'removeLight', key });
        }

        function placeLightAt(x, y) {
            const key = currentMapName + ':' + x + ',' + y;
            const radius = parseInt(document.getElementById('pointLightRadius').value) || 3;
            const flicker = document.getElementById('pointLightFlicker').checked;
            const flickerIntensity = flicker ? parseFloat(document.getElementById('pointFlickerIntensity').value) || 0.1 : 0;
            pointLights[key] = { radius, flicker, flickerIntensity };
            console.log('Placed light:', key, pointLights[key]);
            // Broadcast to co-op builders
            broadcastEdit({ editType: 'light', key: key, light: pointLights[key] });
            updatePlacedLightsList();
            renderMap();
        }

        function removeLightAt(x, y) {
            const key = currentMapName + ':' + x + ',' + y;
            if (pointLights[key]) {
                delete pointLights[key];
                // Broadcast to co-op builders
                broadcastEdit({ editType: 'removeLight', key: key });
                updatePlacedLightsList();
                renderMap();
            }
        }

        function removeNearestLight(x, y) {
            // Find nearest light within 1.5 tiles
            let nearestKey = null;
            let nearestDist = 1.5;
            Object.keys(pointLights).forEach(key => {
                if (!key.startsWith(currentMapName + ':')) return;
                const coords = key.split(':')[1].split(',');
                const lx = parseFloat(coords[0]);
                const ly = parseFloat(coords[1]);
                const dist = Math.sqrt((x - lx) ** 2 + (y - ly) ** 2);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestKey = key;
                }
            });
            if (nearestKey) {
                delete pointLights[nearestKey];
                // Broadcast to co-op builders
                broadcastEdit({ editType: 'removeLight', key: nearestKey });
                updatePlacedLightsList();
                renderMap();
            }
        }

        // ===== POLYGON LIGHTS =====
        function togglePolyLightDraw() {
            polyLightDrawing = !polyLightDrawing;
            const btn = document.getElementById('polyLightDrawBtn');
            const status = document.getElementById('polyLightDrawStatus');

            if (polyLightDrawing) {
                polyLightPoints = [];
                btn.textContent = 'CANCEL';
                btn.style.background = '#a33';
                status.style.display = 'block';
            } else {
                polyLightPoints = [];
                btn.textContent = 'DRAW POLYGON';
                btn.style.background = '#0aa';
                status.style.display = 'none';
            }
            renderMap();
        }

        function addPolyLightPoint(x, y) {
            if (!polyLightDrawing) return false;

            polyLightPoints.push({ x, y });
            renderMap();
            return true;
        }

        function finishPolyLight() {
            if (!polyLightDrawing || polyLightPoints.length < 3) {
                if (polyLightDrawing && polyLightPoints.length < 3) {
                    alert('Need at least 3 points to create a polygon light');
                }
                return;
            }

            const intensity = parseFloat(document.getElementById('polyLightIntensity').value) || 0.8;
            const flicker = document.getElementById('polyLightFlicker').checked;
            const flickerIntensity = flicker ? parseFloat(document.getElementById('polyFlickerIntensity').value) || 0.2 : 0;

            const newLight = {
                id: 'poly_' + Date.now(),
                mapName: currentMapName,
                points: JSON.parse(JSON.stringify(polyLightPoints)),
                intensity,
                flicker,
                flickerIntensity
            };

            polyLights.push(newLight);
            broadcastEdit({ editType: 'addPolyLight', light: newLight });

            // Reset drawing state
            polyLightDrawing = false;
            polyLightPoints = [];
            document.getElementById('polyLightDrawBtn').textContent = 'DRAW POLYGON';
            document.getElementById('polyLightDrawBtn').style.background = '#0aa';
            document.getElementById('polyLightDrawStatus').style.display = 'none';

            updatePolyLightsList();
            renderMap();
            console.log('[LIGHTS] Created polygon light:', newLight);
            console.log('[LIGHTS] Total polyLights now:', polyLights.length, polyLights);
        }

        function deletePolyLight(index) {
            if (index < 0 || index >= polyLights.length) return;
            const lightId = polyLights[index].id;
            polyLights.splice(index, 1);
            broadcastEdit({ editType: 'removePolyLight', lightId });
            updatePolyLightsList();
            renderMap();
        }

        function updatePolyLightsList() {
            const container = document.getElementById('placedPolyLightsList');
            if (!container) return;

            const mapLights = polyLights.filter(l => l.mapName === currentMapName);
            if (mapLights.length === 0) {
                container.innerHTML = '<div style="color:#888;">No polygon lights</div>';
                return;
            }

            container.innerHTML = mapLights.map((light, i) => {
                const globalIndex = polyLights.indexOf(light);
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:4px; margin:2px 0; background:#234; border-radius:3px;">
                    <span style="flex:1;">◇ ${light.points.length} pts (${(light.intensity * 100).toFixed(0)}%${light.flicker ? ', flicker' : ''})</span>
                    <button onclick="deletePolyLight(${globalIndex})" style="padding:2px 6px;">×</button>
                </div>`;
            }).join('');
        }

        function updatePlacedLightsList() {
            const container = document.getElementById('placedLightsList');
            if (!container) return;
            const keys = Object.keys(pointLights).filter(k => k.startsWith(currentMapName + ':'));
            if (keys.length === 0) {
                container.innerHTML = '<div style="color:#888;">No lights placed</div>';
                return;
            }
            container.innerHTML = keys.map(key => {
                const light = pointLights[key];
                const coords = key.split(':')[1];
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:4px; margin:2px 0; background:#333; border-radius:3px;">
                    <span style="flex:1;">💡 ${coords} (r=${light.radius}${light.flicker ? ', flicker' : ''})</span>
                    <button onclick="removeLightByKey('${key}')" style="padding:2px 6px;">×</button>
                </div>`;
            }).join('');
        }

        function setRotation(deg) {
            tileRotation = deg;
            document.querySelectorAll('[id^="rot"]').forEach(b => b.classList.remove('active'));
            document.getElementById('rot' + deg).classList.add('active');
            updateSelectedPreview();
            renderMap(); // Update preview
            updateCursorIndicator();
            resetPrattWarning();
        }

        function rotateNext() {
            const rotations = [0, 90, 180, 270];
            const idx = rotations.indexOf(tileRotation);
            setRotation(rotations[(idx + 1) % 4]);
        }

        function toggleFlipH() {
            tileFlippedH = !tileFlippedH;
            updateFlipButton();
            updateSelectedTilePreview();
            renderMap();
            resetPrattWarning();
        }

        function updateFlipButton() {
            const btn = document.getElementById('flipBtn');
            if (btn) {
                if (tileFlippedH) {
                    btn.classList.add('active');
                    btn.innerHTML = 'FLIPPED';
                } else {
                    btn.classList.remove('active');
                    btn.innerHTML = 'Flip H';
                }
            }
            updateCursorIndicator();
        }

        // Pratt warning callback
        let prattPendingCallback = null;

        // Show Pratt warning when tiles are both rotated AND flipped
        function showPrattWarning() {
            if (prattWarningShown) return true; // Already shown, proceed
            if (tileRotation === 0 || !tileFlippedH) return true; // No warning needed

            // Show custom retro modal
            document.getElementById('prattDegrees').textContent = tileRotation + '°';
            document.getElementById('prattModal').style.display = 'flex';
            return false; // Block the action, will be handled by prattConfirm
        }

        function prattConfirm(proceed) {
            document.getElementById('prattModal').style.display = 'none';
            if (proceed) {
                prattWarningShown = true; // Don't ask again this session
                // User confirmed, trigger the paint action
                if (painting && selectedTileData) {
                    // Re-enable painting - the user confirmed
                    renderMap();
                }
            }
        }

        // Reset pratt warning when rotation or flip changes
        function resetPrattWarning() {
            prattWarningShown = false;
        }

        function toggleEraseMode() {
            eraseMode = !eraseMode;
            updateEraseButton();
        }

        function updateEraseButton() {
            const btn = document.getElementById('eraseBtn');
            if (btn) {
                if (eraseMode) {
                    btn.classList.add('active');
                    btn.innerHTML = 'ERASING';
                } else {
                    btn.classList.remove('active');
                    btn.innerHTML = 'Erase';
                }
            }
            updateCursorIndicator();
        }

        // Cursor indicator for active modes
        function updateCursorIndicator() {
            const indicator = document.getElementById('cursorIndicator');
            if (!indicator) return;

            let symbols = [];
            if (eraseMode) symbols.push('[X]');
            if (tileFlippedH) symbols.push('[FLIP]');
            if (tileRotation === 90) symbols.push('[90]');
            else if (tileRotation === 180) symbols.push('[180]');
            else if (tileRotation === 270) symbols.push('[270]');

            if (symbols.length > 0) {
                indicator.textContent = symbols.join(' ');
                indicator.style.display = 'block';
            } else {
                indicator.style.display = 'none';
            }
        }

        // Track mouse for cursor indicator
        document.addEventListener('mousemove', (e) => {
            const indicator = document.getElementById('cursorIndicator');
            if (indicator && indicator.style.display !== 'none') {
                indicator.style.left = (e.clientX + 20) + 'px';
                indicator.style.top = (e.clientY + 5) + 'px';
            }
        });

        // Draw a tile with rotation and optional horizontal flip
        function drawRotatedTile(ctx, img, srcX, srcY, srcSize, destX, destY, destSize, rotation, flipped) {
            ctx.save();
            ctx.translate(destX + destSize / 2, destY + destSize / 2);

            if (rotation !== 0) {
                ctx.rotate(rotation * Math.PI / 180);
            }
            if (flipped) {
                ctx.scale(-1, 1); // Flip horizontally
            }

            ctx.drawImage(img, srcX, srcY, srcSize, srcSize, -destSize / 2, -destSize / 2, destSize, destSize);
            ctx.restore();
        }

        // Draw player preview on map (uses actual sprite if loaded)
        function drawPlayerPreview(tileSize) {
            mapCtx.globalAlpha = 1;

            const px = playerPreviewPos.x * tileSize;
            const py = playerPreviewPos.y * tileSize;

            // Draw at ~1.7 tiles tall to match test game (playerScale default)
            const drawSize = tileSize * 1.7;

            // Draw the actual player sprite if available (idle frame = first 64x64)
            if (playerSpriteImg && playerSpriteImg.complete && playerSpriteImg.naturalWidth > 0) {
                // Draw idle frame (first frame, facing down)
                mapCtx.drawImage(playerSpriteImg, 0, 0, 64, 64, px, py, drawSize, drawSize);
            } else {
                // Fallback: simple placeholder
                mapCtx.fillStyle = '#f0a';
                mapCtx.fillRect(px + drawSize * 0.3, py + drawSize * 0.1, drawSize * 0.4, drawSize * 0.7);
                mapCtx.beginPath();
                mapCtx.arc(px + drawSize * 0.5, py + drawSize * 0.15, drawSize * 0.15, 0, Math.PI * 2);
                mapCtx.fill();
            }

            // Label
            mapCtx.fillStyle = 'rgba(0,0,0,0.7)';
            mapCtx.font = '10px sans-serif';
            mapCtx.textAlign = 'center';
            const labelWidth = mapCtx.measureText('SPAWN').width + 6;
            mapCtx.fillRect(px + drawSize / 2 - labelWidth / 2, py - 14, labelWidth, 12);
            mapCtx.fillStyle = '#4f8';
            mapCtx.fillText('SPAWN', px + drawSize / 2, py - 4);

            // Spawn marker outline
            mapCtx.strokeStyle = '#4f8';
            mapCtx.lineWidth = 2;
            mapCtx.setLineDash([4, 4]);
            mapCtx.strokeRect(px - 2, py - 2, drawSize + 4, drawSize + 4);
            mapCtx.setLineDash([]);
        }

        function drawPaintTileset() {
            if (!tilesetImg) return;

            const displayZoom = paintTilesetZoom;
            paintTilesetCanvas.width = tilesetImg.naturalWidth * displayZoom;
            paintTilesetCanvas.height = tilesetImg.naturalHeight * displayZoom;

            paintTilesetCtx.imageSmoothingEnabled = false;
            paintTilesetCtx.drawImage(tilesetImg, 0, 0, paintTilesetCanvas.width, paintTilesetCanvas.height);

            // Grid
            paintTilesetCtx.strokeStyle = 'rgba(255,255,255,0.2)';
            const cols = Math.floor(tilesetImg.naturalWidth / gridSize);
            const rows = Math.floor(tilesetImg.naturalHeight / gridSize);

            for (let x = 0; x <= cols; x++) {
                paintTilesetCtx.beginPath();
                paintTilesetCtx.moveTo(x * gridSize * displayZoom, 0);
                paintTilesetCtx.lineTo(x * gridSize * displayZoom, paintTilesetCanvas.height);
                paintTilesetCtx.stroke();
            }
            for (let y = 0; y <= rows; y++) {
                paintTilesetCtx.beginPath();
                paintTilesetCtx.moveTo(0, y * gridSize * displayZoom);
                paintTilesetCtx.lineTo(paintTilesetCanvas.width, y * gridSize * displayZoom);
                paintTilesetCtx.stroke();
            }

            // Mark collision tiles
            for (let key in tileCollisions) {
                if (tileCollisions[key] && tileCollisions[key].length >= 3) {
                    const [tx, ty] = key.split(',').map(Number);
                    paintTilesetCtx.fillStyle = 'rgba(255, 0, 0, 0.25)';
                    paintTilesetCtx.fillRect(tx * displayZoom, ty * displayZoom, gridSize * displayZoom, gridSize * displayZoom);
                }
            }

            // Mark tiles with depth split lines (cyan indicator)
            const keyPrefix = currentTilesetIndex + ':';
            for (let key in tileSplitLines) {
                if (!key.startsWith(keyPrefix)) continue;

                const splitY = tileSplitLines[key];
                const coordPart = key.substring(keyPrefix.length);
                const parts = coordPart.split(',');
                const tx = parseInt(parts[0]);
                const ty = parseInt(parts[1]);

                // Draw cyan horizontal line
                paintTilesetCtx.strokeStyle = '#0ff';
                paintTilesetCtx.lineWidth = 2;
                const lineY = (ty + splitY) * displayZoom;
                paintTilesetCtx.beginPath();
                paintTilesetCtx.moveTo(tx * displayZoom, lineY);
                paintTilesetCtx.lineTo((tx + gridSize) * displayZoom, lineY);
                paintTilesetCtx.stroke();

                // Draw small cyan dot in corner to indicate split tile
                paintTilesetCtx.fillStyle = '#0ff';
                paintTilesetCtx.beginPath();
                paintTilesetCtx.arc(tx * displayZoom + 6, ty * displayZoom + 6, 4, 0, Math.PI * 2);
                paintTilesetCtx.fill();
            }

            // Highlight selected tiles
            if (selectedTileData) {
                paintTilesetCtx.strokeStyle = '#0f0';
                paintTilesetCtx.lineWidth = 3;
                const w = (selectedTileData.width || 1) * gridSize * displayZoom;
                const h = (selectedTileData.height || 1) * gridSize * displayZoom;
                paintTilesetCtx.strokeRect(
                    selectedTileData.x * displayZoom,
                    selectedTileData.y * displayZoom,
                    w,
                    h
                );
                paintTilesetCtx.lineWidth = 1;
            }
        }

        // Multi-tile selection on tileset
        let tilesetSelecting = false;
        let tileSelectModeActive = false;

        function toggleTileSelectMode() {
            tileSelectModeActive = !tileSelectModeActive;
            const btn = document.getElementById('tileSelectModeBtn');
            const canvas = document.getElementById('paintTilesetCanvas');

            if (tileSelectModeActive) {
                btn.style.background = '#4af';
                btn.style.color = '#000';
                btn.textContent = 'Select Mode ON';
                canvas.style.touchAction = 'none';
            } else {
                btn.style.background = '#555';
                btn.style.color = 'white';
                btn.textContent = 'Select Tiles';
                canvas.style.touchAction = 'manipulation';
            }
        }
