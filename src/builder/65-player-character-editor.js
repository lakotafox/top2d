        // ============ PLAYER CHARACTER EDITOR ============

        function openPlayerEditor(editIndex = -1) {
            // Check if someone else is already editing this player
            if (editIndex >= 0 && isBeingEdited('player', editIndex)) {
                const editor = getEditor('player', editIndex);
                if (!confirm(`"${editor}" is currently editing this player character.\n\nEditing simultaneously may cause conflicts.\n\nOpen anyway?`)) {
                    return;
                }
            }

            playerEditorEditingIndex = editIndex;

            // Broadcast that we're editing this player
            if (editIndex >= 0) {
                startEditing('player', editIndex);
            }

            playerEditorSheets = [];
            playerCurrentSheetIndex = 0;
            playerEditorFrameW = 64;
            playerEditorFrameH = 64;
            playerAnimations = { walkDown: [], walkUp: [], walkLeft: [], walkRight: [], idle: [], idleDown: [], idleUp: [], idleLeft: [], idleRight: [], attackDown: [], attackUp: [], attackLeft: [], attackRight: [], interact: [], death: [], receivedItem: [], receiveItemDown: [], receiveItemUp: [], receiveItemLeft: [], receiveItemRight: [], fishCastDown: [], fishCastUp: [], fishCastLeft: [], fishCastRight: [], fishWaitDown: [], fishWaitUp: [], fishWaitLeft: [], fishWaitRight: [] };
            playerAnimMirrors = {}; // Reset mirror flags
            playerHitboxRange = { up: 35, down: 35, left: 35, right: 30 }; // Reset hitbox shape (per-direction px)
            playerHitboxWidth = 60;
            playerHitboxOffsetY = 0;
            playerAttackMovement = 'stop'; // Reset attack movement
            playerGameOverSoundIndex = -1; // Reset game over sound
            playerCurrentAnim = 'walkDown';
            playerAnimFpsList = {}; // Reset per-animation FPS
            playerStopPreview();

            // Reset UI
            document.getElementById('playerFileName').textContent = '';
            document.getElementById('playerSheetTabs').innerHTML = '';
            document.getElementById('playerFrameSection').style.display = 'none';
            document.getElementById('playerAnimSection').style.display = 'none';
            document.getElementById('playerNameSection').style.display = 'none';
            document.getElementById('playerScaleShadowSection').style.display = 'none';
            document.getElementById('playerNameInput').value = '';
            document.getElementById('playerSpeedSlider').value = 8;
            document.getElementById('playerSpeedLabel').textContent = '8 fps';
            playerPingPong = false;
            document.getElementById('playerPingPong').checked = false;
            document.getElementById('playerAttackMovement').value = 'stop';
            document.getElementById('playerCustomAnimName').value = '';
            document.getElementById('playerCustomAnimList').innerHTML = '';
            // Reset scale and shadow
            document.getElementById('playerScaleSlider').value = 1;
            document.getElementById('playerScaleVal').textContent = '1.0';
            document.getElementById('playerNoShadow').checked = false;
            document.getElementById('playerShadowControls').style.display = 'block';
            document.getElementById('playerShadowOffsetXSlider').value = 0;
            document.getElementById('playerShadowOffsetXVal').textContent = '0';
            document.getElementById('playerShadowOffsetYSlider').value = 4;
            document.getElementById('playerShadowOffsetYVal').textContent = '4';
            document.getElementById('playerShadowWidthSlider').value = 35;
            document.getElementById('playerShadowWidthVal').textContent = '35';
            document.getElementById('playerShadowHeightSlider').value = 12;
            document.getElementById('playerShadowHeightVal').textContent = '12';

            // If editing existing character, load its data
            if (editIndex >= 0 && playerCharacters[editIndex]) {
                const char = playerCharacters[editIndex];
                playerEditorFrameW = char.frameWidth;
                playerEditorFrameH = char.frameHeight;
                playerAnimations = JSON.parse(JSON.stringify(char.animations));
                // Load per-animation FPS (support both old single fps and new per-anim fps)
                if (char.animFps && typeof char.animFps === 'object') {
                    playerAnimFpsList = JSON.parse(JSON.stringify(char.animFps));
                } else {
                    // Old format: single fps value - apply to all anims
                    const defaultFps = char.fps || 8;
                    playerAnimFpsList = {};
                    Object.keys(playerAnimations).forEach(k => {
                        playerAnimFpsList[k] = defaultFps;
                    });
                }

                document.getElementById('playerNameInput').value = char.name;
                const currentFps = playerAnimFpsList[playerCurrentAnim] || 8;
                document.getElementById('playerSpeedSlider').value = currentFps;
                document.getElementById('playerSpeedLabel').textContent = currentFps + ' fps';
                // Load ping-pong setting
                playerPingPong = char.pingPong || false;
                document.getElementById('playerPingPong').checked = playerPingPong;
                // Load mirror flags
                if (char.animMirrors) {
                    playerAnimMirrors = JSON.parse(JSON.stringify(char.animMirrors));
                }
                // Load attack movement setting
                if (char.attackMovement) {
                    playerAttackMovement = char.attackMovement;
                    document.getElementById('playerAttackMovement').value = playerAttackMovement;
                }
                // Load hitbox shape (per-direction or convert from old single-value)
                if (char.hitboxRange !== undefined) {
                    if (typeof char.hitboxRange === 'object') {
                        playerHitboxRange = char.hitboxRange;
                    } else {
                        const val = char.hitboxRange;
                        playerHitboxRange = { up: val, down: val, left: val, right: val };
                    }
                }
                if (char.hitboxWidth !== undefined) {
                    if (typeof char.hitboxWidth === 'object') {
                        playerHitboxWidth = char.hitboxWidth;
                    } else {
                        const val = char.hitboxWidth;
                        playerHitboxWidth = { up: val, down: val, left: val, right: val };
                    }
                }
                if (char.hitboxOffsetX !== undefined) {
                    if (typeof char.hitboxOffsetX === 'object') {
                        playerHitboxOffsetX = char.hitboxOffsetX;
                    } else {
                        const val = char.hitboxOffsetX;
                        playerHitboxOffsetX = { up: val, down: val, left: val, right: val };
                    }
                }
                if (char.hitboxOffsetY !== undefined) {
                    if (typeof char.hitboxOffsetY === 'object') {
                        playerHitboxOffsetY = char.hitboxOffsetY;
                    } else {
                        const val = char.hitboxOffsetY;
                        playerHitboxOffsetY = { up: val, down: val, left: val, right: val };
                    }
                }
                // Load game over sound index
                playerGameOverSoundIndex = char.gameOverSoundIndex !== undefined ? char.gameOverSoundIndex : -1;

                // Load scale and shadow settings
                const charScale = char.scale || 1;
                document.getElementById('playerScaleSlider').value = charScale;
                document.getElementById('playerScaleVal').textContent = charScale.toFixed(1);
                document.getElementById('playerNoShadow').checked = char.noShadow || false;
                document.getElementById('playerShadowControls').style.display = char.noShadow ? 'none' : 'block';
                document.getElementById('playerShadowOffsetXSlider').value = char.shadowOffsetX ?? 0;
                document.getElementById('playerShadowOffsetXVal').textContent = char.shadowOffsetX ?? 0;
                document.getElementById('playerShadowOffsetYSlider').value = char.shadowOffsetY ?? 4;
                document.getElementById('playerShadowOffsetYVal').textContent = char.shadowOffsetY ?? 4;
                document.getElementById('playerShadowWidthSlider').value = char.shadowWidth ?? 35;
                document.getElementById('playerShadowWidthVal').textContent = char.shadowWidth ?? 35;
                document.getElementById('playerShadowHeightSlider').value = char.shadowHeight ?? 12;
                document.getElementById('playerShadowHeightVal').textContent = char.shadowHeight ?? 12;

                // Load sheets (support both new multi-sheet and old single-sheet format)
                const sheetsToLoad = char.spriteSheets || (char.spriteData ? [char.spriteData] : []);
                let loadedCount = 0;
                sheetsToLoad.forEach((sheetData, index) => {
                    const img = new Image();
                    img.onload = () => {
                        playerEditorSheets[index] = {
                            image: img,
                            data: sheetData,
                            name: 'Sheet ' + (index + 1)
                        };
                        loadedCount++;
                        if (loadedCount === sheetsToLoad.length) {
                            // All sheets loaded
                            playerCurrentSheetIndex = 0;
                            playerUpdateSheetTabs();
                            const sheet = playerGetCurrentSheet();
                            if (sheet) {
                                document.getElementById('playerFileName').textContent = 'Sheet 1: ' + sheet.image.naturalWidth + 'x' + sheet.image.naturalHeight;
                            }
                            document.getElementById('playerFrameSection').style.display = 'block';
                            document.getElementById('playerAnimSection').style.display = 'block';
                            document.getElementById('playerNameSection').style.display = 'block';
                            document.getElementById('playerScaleShadowSection').style.display = 'block';
                            playerUpdateGrid();
                            playerDrawCanvas();
                            playerUpdateAnimButtons();
                            playerUpdateFramesList();
                            playerStartPreview();
                        }
                    };
                    img.src = sheetData;
                });
            }

            // Populate game over sound dropdown
            playerPopulateGameOverSoundDropdown();

            document.getElementById('playerModal').classList.add('visible');
        }

        function playerLoadSheet(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target.result;
                const img = new Image();
                img.onload = () => {
                    // Add to sheets array
                    const sheetName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
                    playerEditorSheets.push({
                        image: img,
                        data: data,
                        name: sheetName
                    });
                    playerCurrentSheetIndex = playerEditorSheets.length - 1;
                    playerUpdateSheetTabs();
                    document.getElementById('playerFileName').textContent = 'Sheet ' + (playerCurrentSheetIndex + 1) + ': ' + img.naturalWidth + 'x' + img.naturalHeight;
                    document.getElementById('playerFrameSection').style.display = 'block';
                    document.getElementById('playerAnimSection').style.display = 'block';
                    document.getElementById('playerNameSection').style.display = 'block';
                    document.getElementById('playerScaleShadowSection').style.display = 'block';
                    playerUpdateGrid();
                    playerDrawCanvas();
                };
                img.src = data;
            };
            reader.readAsDataURL(file);
            // Reset file input so same file can be loaded again
            event.target.value = '';
        }

        function playerUpdateSheetTabs() {
            const container = document.getElementById('playerSheetTabs');
            container.innerHTML = '';
            playerEditorSheets.forEach((sheet, i) => {
                const tab = document.createElement('div');
                tab.style.cssText = 'display:flex; align-items:center; gap:5px;';
                const btn = document.createElement('button');
                btn.textContent = (i + 1) + '. ' + sheet.name;
                btn.style.cssText = 'flex:1; padding:5px 8px; font-size:11px; text-align:left; overflow:hidden; text-overflow:ellipsis;';
                if (i === playerCurrentSheetIndex) {
                    btn.style.background = '#4f8';
                    btn.style.color = '#000';
                }
                btn.onclick = () => playerSwitchSheet(i);
                tab.appendChild(btn);
                // Remove button (only if more than one sheet)
                if (playerEditorSheets.length > 1) {
                    const removeBtn = document.createElement('button');
                    removeBtn.textContent = 'X';
                    removeBtn.style.cssText = 'padding:5px 8px; font-size:11px; background:#a55;';
                    removeBtn.onclick = (e) => { e.stopPropagation(); playerRemoveSheet(i); };
                    tab.appendChild(removeBtn);
                }
                container.appendChild(tab);
            });
        }

        function playerSwitchSheet(index) {
            if (index < 0 || index >= playerEditorSheets.length) return;
            playerCurrentSheetIndex = index;
            const sheet = playerEditorSheets[index];
            document.getElementById('playerFileName').textContent = 'Sheet ' + (index + 1) + ': ' + sheet.image.naturalWidth + 'x' + sheet.image.naturalHeight;
            playerUpdateSheetTabs();
            playerUpdateGrid();
            playerDrawCanvas();
        }

        function playerRemoveSheet(index) {
            if (playerEditorSheets.length <= 1) return;
            // Remove frames that reference this sheet
            Object.keys(playerAnimations).forEach(animKey => {
                playerAnimations[animKey] = playerAnimations[animKey].filter(f => f.sheet !== index);
                // Update sheet indices for frames from higher sheets
                playerAnimations[animKey].forEach(f => {
                    if (f.sheet > index) f.sheet--;
                });
            });
            playerEditorSheets.splice(index, 1);
            if (playerCurrentSheetIndex >= playerEditorSheets.length) {
                playerCurrentSheetIndex = playerEditorSheets.length - 1;
            }
            playerUpdateSheetTabs();
            playerSwitchSheet(playerCurrentSheetIndex);
            playerUpdateAnimButtons();
            playerUpdateFramesList();
        }

        // Helper to get current sheet image
        function playerGetCurrentSheet() {
            if (playerEditorSheets.length === 0) return null;
            return playerEditorSheets[playerCurrentSheetIndex];
        }

        function playerSetFrameSize(w, h) {
            playerEditorFrameW = w;
            playerEditorFrameH = h;
            // Sync input fields
            const wInput = document.getElementById('playerFrameW');
            const hInput = document.getElementById('playerFrameH');
            if (wInput) wInput.value = w;
            if (hInput) hInput.value = h;
            playerAnimations = { walkDown: [], walkUp: [], walkLeft: [], walkRight: [], idle: [], idleDown: [], idleUp: [], idleLeft: [], idleRight: [], attackDown: [], attackUp: [], attackLeft: [], attackRight: [], interact: [], death: [], receivedItem: [], receiveItemDown: [], receiveItemUp: [], receiveItemLeft: [], receiveItemRight: [], fishCastDown: [], fishCastUp: [], fishCastLeft: [], fishCastRight: [], fishWaitDown: [], fishWaitUp: [], fishWaitLeft: [], fishWaitRight: [] };
            playerAnimMirrors = {};
            playerUpdateGrid();
            playerDrawCanvas();
            playerUpdateAnimButtons();
            playerUpdateMirrorButton();
            playerUpdateFramesList();
        }

        function playerSetFrameSizeFromInput() {
            const w = parseInt(document.getElementById('playerFrameW').value) || 16;
            const h = parseInt(document.getElementById('playerFrameH').value) || 16;
            const clampedW = Math.max(8, Math.min(256, w));
            const clampedH = Math.max(8, Math.min(256, h));
            // Sync back in case of clamping
            document.getElementById('playerFrameW').value = clampedW;
            document.getElementById('playerFrameH').value = clampedH;
            playerSetFrameSize(clampedW, clampedH);
        }

        function playerResetGrid() {
            playerSetFrameSize(64, 64);
        }

        function playerUpdateGrid() {
            const sheet = playerGetCurrentSheet();
            if (!sheet) return;
            const cols = Math.floor(sheet.image.naturalWidth / playerEditorFrameW);
            const rows = Math.floor(sheet.image.naturalHeight / playerEditorFrameH);
            document.getElementById('playerGridInfo').textContent = playerEditorFrameW + 'x' + playerEditorFrameH + ' (' + cols + 'x' + rows + ' grid)';
        }

        function playerSelectAnim(animName) {
            playerCurrentAnim = animName;
            if (!playerAnimations[animName]) playerAnimations[animName] = []; // ensure slot exists (new diagonal slots etc.)
            playerUpdateAnimButtons();
            playerUpdateMirrorButton();
            playerUpdateHitboxUI(); // Show/hide hitbox section based on anim type
            playerUpdateFramesList();
            // Update FPS slider to show this animation's FPS
            const fps = playerAnimFpsList[animName] || 8;
            document.getElementById('playerSpeedSlider').value = fps;
            document.getElementById('playerSpeedLabel').textContent = fps + ' fps';
            playerStartPreview();
        }

        function playerUpdateAnimButtons() {
            const names = {
                walkDown: 'Walk Down',
                walkUp: 'Walk Up',
                walkLeft: 'Walk Left',
                walkRight: 'Walk Right',
                idle: 'Idle (All)',
                idleDown: 'Idle Down',
                idleUp: 'Idle Up',
                idleLeft: 'Idle Left',
                idleRight: 'Idle Right',
                attackDown: 'Attack Down',
                attackUp: 'Attack Up',
                attackLeft: 'Attack Left',
                attackRight: 'Attack Right',
                interact: 'Interact',
                death: 'Death',
                receivedItem: 'Received Item'
            };

            // Walk buttons
            const walkBtnMap = {
                walkDown: 'playerAnimDown',
                walkUp: 'playerAnimUp',
                walkLeft: 'playerAnimLeft',
                walkRight: 'playerAnimRight',
                walkDownLeft: 'playerAnimDownLeft',
                walkDownRight: 'playerAnimDownRight',
                walkUpLeft: 'playerAnimUpLeft',
                walkUpRight: 'playerAnimUpRight'
            };
            const walkLabels = { walkDown: '↓ Walk', walkUp: '↑ Walk', walkLeft: '← Walk', walkRight: '→ Walk', walkDownLeft: '↙ Walk', walkDownRight: '↘ Walk', walkUpLeft: '↖ Walk', walkUpRight: '↗ Walk' };
            Object.entries(walkBtnMap).forEach(([anim, btnId]) => {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.classList.toggle('active', playerCurrentAnim === anim);
                    const count = playerAnimations[anim]?.length || 0;
                    btn.classList.toggle('has-frames', count > 0);
                    let label = walkLabels[anim] || '→ Walk';
                    btn.textContent = label + (count > 0 ? ' (' + count + ')' : '');
                }
            });

            // Idle (All) button
            const idleAllBtn = document.getElementById('playerAnimIdle');
            if (idleAllBtn) {
                idleAllBtn.classList.toggle('active', playerCurrentAnim === 'idle');
                const count = playerAnimations['idle']?.length || 0;
                idleAllBtn.classList.toggle('has-frames', count > 0);
                idleAllBtn.textContent = 'Idle (All)' + (count > 0 ? ' (' + count + ')' : '');
            }

            // Directional idle buttons
            const idleBtnMap = {
                idleDown: 'playerAnimIdleDown',
                idleUp: 'playerAnimIdleUp',
                idleLeft: 'playerAnimIdleLeft',
                idleRight: 'playerAnimIdleRight'
            };
            Object.entries(idleBtnMap).forEach(([anim, btnId]) => {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.classList.toggle('active', playerCurrentAnim === anim);
                    const count = playerAnimations[anim]?.length || 0;
                    btn.classList.toggle('has-frames', count > 0);
                    let label = anim === 'idleDown' ? '↓' : anim === 'idleUp' ? '↑' : anim === 'idleLeft' ? '←' : '→';
                    btn.textContent = label + (count > 0 ? ' (' + count + ')' : '');
                }
            });

            // Attack buttons
            const attackBtnMap = {
                attackDown: 'playerAnimAttackDown',
                attackUp: 'playerAnimAttackUp',
                attackLeft: 'playerAnimAttackLeft',
                attackRight: 'playerAnimAttackRight'
            };
            Object.entries(attackBtnMap).forEach(([anim, btnId]) => {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.classList.toggle('active', playerCurrentAnim === anim);
                    const count = playerAnimations[anim]?.length || 0;
                    btn.classList.toggle('has-frames', count > 0);
                    let label = anim === 'attackDown' ? '↓ Atk' : anim === 'attackUp' ? '↑ Atk' : anim === 'attackLeft' ? '← Atk' : '→ Atk';
                    btn.textContent = label + (count > 0 ? ' (' + count + ')' : '');
                }
            });

            // Interact button
            const interactBtn = document.getElementById('playerAnimInteract');
            if (interactBtn) {
                interactBtn.classList.toggle('active', playerCurrentAnim === 'interact');
                const count = playerAnimations['interact']?.length || 0;
                interactBtn.classList.toggle('has-frames', count > 0);
                interactBtn.textContent = 'Interact' + (count > 0 ? ' (' + count + ')' : '');
            }

            // Death button
            const deathBtn = document.getElementById('playerAnimDeath');
            if (deathBtn) {
                deathBtn.classList.toggle('active', playerCurrentAnim === 'death');
                const count = playerAnimations['death']?.length || 0;
                deathBtn.classList.toggle('has-frames', count > 0);
                deathBtn.textContent = 'Death' + (count > 0 ? ' (' + count + ')' : '');
            }

            // Received Item button (All)
            const receivedItemBtn = document.getElementById('playerAnimReceivedItem');
            if (receivedItemBtn) {
                receivedItemBtn.classList.toggle('active', playerCurrentAnim === 'receivedItem');
                const count = playerAnimations['receivedItem']?.length || 0;
                receivedItemBtn.classList.toggle('has-frames', count > 0);
                receivedItemBtn.textContent = 'Receive (All)' + (count > 0 ? ' (' + count + ')' : '');
            }

            // Directional Receive Item buttons
            const receiveItemDirs = {
                receiveItemDown: 'playerAnimReceiveItemDown',
                receiveItemUp: 'playerAnimReceiveItemUp',
                receiveItemLeft: 'playerAnimReceiveItemLeft',
                receiveItemRight: 'playerAnimReceiveItemRight'
            };
            for (const [anim, btnId] of Object.entries(receiveItemDirs)) {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.classList.toggle('active', playerCurrentAnim === anim);
                    const count = playerAnimations[anim]?.length || 0;
                    btn.classList.toggle('has-frames', count > 0);
                    const arrow = anim.includes('Down') ? '↓' : anim.includes('Up') ? '↑' : anim.includes('Left') ? '←' : '→';
                    btn.textContent = arrow + (count > 0 ? '(' + count + ')' : '');
                }
            }

            // Fishing buttons (cast one-shot + wait loop, directional)
            const fishingDirs = {
                fishCastDown: 'playerAnimFishCastDown', fishCastUp: 'playerAnimFishCastUp', fishCastLeft: 'playerAnimFishCastLeft', fishCastRight: 'playerAnimFishCastRight',
                fishWaitDown: 'playerAnimFishWaitDown', fishWaitUp: 'playerAnimFishWaitUp', fishWaitLeft: 'playerAnimFishWaitLeft', fishWaitRight: 'playerAnimFishWaitRight'
            };
            for (const [anim, btnId] of Object.entries(fishingDirs)) {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.classList.toggle('active', playerCurrentAnim === anim);
                    const count = playerAnimations[anim]?.length || 0;
                    btn.classList.toggle('has-frames', count > 0);
                    const arrow = anim.includes('Down') ? '↓' : anim.includes('Up') ? '↑' : anim.includes('Left') ? '←' : '→';
                    btn.textContent = arrow + (count > 0 ? '(' + count + ')' : '');
                }
            }

            // Update custom animations list
            playerUpdateCustomAnimList();

            // Update current animation name display
            document.getElementById('playerCurrentAnimName').textContent = names[playerCurrentAnim] || playerCurrentAnim;
            document.getElementById('playerFrameCount').textContent = playerAnimations[playerCurrentAnim]?.length || 0;
        }

        function playerDrawCanvas() {
            const sheet = playerGetCurrentSheet();
            if (!sheet) return;

            const canvas = document.getElementById('playerEditorCanvas');
            const ctx = canvas.getContext('2d');
            const scale = playerEditorZoom;

            canvas.width = sheet.image.naturalWidth * scale;
            canvas.height = sheet.image.naturalHeight * scale;

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(sheet.image, 0, 0, canvas.width, canvas.height);

            // Draw grid
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;

            const fw = playerEditorFrameW * scale;
            const fh = playerEditorFrameH * scale;

            for (let x = 0; x <= canvas.width; x += fw) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
            for (let y = 0; y <= canvas.height; y += fh) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }

            // Highlight frames in current animation (only those from current sheet)
            const frames = playerAnimations[playerCurrentAnim] || [];
            frames.forEach((frame, i) => {
                // Only highlight if frame is from current sheet (or no sheet specified for backwards compat)
                if (frame.sheet !== undefined && frame.sheet !== playerCurrentSheetIndex) {
                    return; // Skip frames from other sheets
                }
                const x = frame.x * scale;
                const y = frame.y * scale;
                const w = frame.w * scale;
                const h = frame.h * scale;

                ctx.fillStyle = 'rgba(74, 255, 136, 0.3)';
                ctx.fillRect(x, y, w, h);
                ctx.strokeStyle = '#4f8';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, w, h);

                // Frame number
                ctx.fillStyle = '#fff';
                ctx.font = 'bold ' + (12 * scale / 3) + 'px monospace';
                ctx.fillText(i + 1, x + 4, y + 14 * scale / 3);
            });

            // Draw drag selection preview
            if (playerFrameDragging && playerFrameDragStart && playerFrameDragEnd) {
                const startGX = Math.min(playerFrameDragStart.gridX, playerFrameDragEnd.gridX);
                const startGY = Math.min(playerFrameDragStart.gridY, playerFrameDragEnd.gridY);
                const endGX = Math.max(playerFrameDragStart.gridX, playerFrameDragEnd.gridX);
                const endGY = Math.max(playerFrameDragStart.gridY, playerFrameDragEnd.gridY);

                const selX = startGX * fw;
                const selY = startGY * fh;
                const selW = (endGX - startGX + 1) * fw;
                const selH = (endGY - startGY + 1) * fh;

                ctx.fillStyle = 'rgba(255, 200, 0, 0.4)';
                ctx.fillRect(selX, selY, selW, selH);
                ctx.strokeStyle = '#fc0';
                ctx.lineWidth = 3;
                ctx.strokeRect(selX, selY, selW, selH);
            }

            document.getElementById('playerZoomLevel').textContent = scale + 'x';
        }

        function playerZoomIn() {
            if (playerEditorZoom < 6) {
                playerEditorZoom++;
                playerDrawCanvas();
            }
        }

        function playerZoomOut() {
            if (playerEditorZoom > 1) {
                playerEditorZoom--;
                playerDrawCanvas();
            }
        }

        // Canvas drag-selection handlers for multi-tile frames
        (function() {
            const canvas = document.getElementById('playerEditorCanvas');

            canvas.addEventListener('mousedown', function(e) {
                if (playerEditorSheets.length === 0) return;

                const rect = this.getBoundingClientRect();
                const scale = playerEditorZoom;
                const clickX = (e.clientX - rect.left) / scale;
                const clickY = (e.clientY - rect.top) / scale;

                // Start drag for multi-tile selection
                const gridX = Math.floor(clickX / playerEditorFrameW);
                const gridY = Math.floor(clickY / playerEditorFrameH);
                playerFrameDragStart = { gridX, gridY };
                playerFrameDragEnd = { gridX, gridY };
                playerFrameDragging = true;
                playerDrawCanvas();
            });

            canvas.addEventListener('mousemove', function(e) {
                if (playerEditorSheets.length === 0) return;
                if (!playerFrameDragging) return;

                const rect = this.getBoundingClientRect();
                const scale = playerEditorZoom;
                const clickX = (e.clientX - rect.left) / scale;
                const clickY = (e.clientY - rect.top) / scale;

                const gridX = Math.floor(clickX / playerEditorFrameW);
                const gridY = Math.floor(clickY / playerEditorFrameH);
                playerFrameDragEnd = { gridX, gridY };
                playerDrawCanvas();
            });

            canvas.addEventListener('mouseup', function(e) {
                // Finalize frame drag selection
                if (playerFrameDragging && playerFrameDragStart && playerFrameDragEnd) {
                    // Calculate rectangle bounds (handle drag in any direction)
                    const startGX = Math.min(playerFrameDragStart.gridX, playerFrameDragEnd.gridX);
                    const startGY = Math.min(playerFrameDragStart.gridY, playerFrameDragEnd.gridY);
                    const endGX = Math.max(playerFrameDragStart.gridX, playerFrameDragEnd.gridX);
                    const endGY = Math.max(playerFrameDragStart.gridY, playerFrameDragEnd.gridY);

                    // Calculate frame in pixels
                    const frameX = startGX * playerEditorFrameW;
                    const frameY = startGY * playerEditorFrameH;
                    const frameW = (endGX - startGX + 1) * playerEditorFrameW;
                    const frameH = (endGY - startGY + 1) * playerEditorFrameH;

                    // Initialize animation array if needed
                    if (!playerAnimations[playerCurrentAnim]) {
                        playerAnimations[playerCurrentAnim] = [];
                    }

                    const frames = playerAnimations[playerCurrentAnim];

                    // Always add frame (allows same frame multiple times for animation)
                    // Use frame list to remove individual frames
                    frames.push({
                        x: frameX,
                        y: frameY,
                        w: frameW,
                        h: frameH,
                        sheet: playerCurrentSheetIndex
                    });

                    playerDrawCanvas();
                    playerUpdateAnimButtons();
                    playerUpdateFramesList();
                    playerStartPreview();
                }

                // Reset drag state
                playerFrameDragging = false;
                playerFrameDragStart = null;
                playerFrameDragEnd = null;
            });

            canvas.addEventListener('mouseleave', function(e) {
                // Cancel drag on mouse leave
                if (playerFrameDragging) {
                    playerFrameDragging = false;
                    playerFrameDragStart = null;
                    playerFrameDragEnd = null;
                    playerDrawCanvas();
                }
            });
        })();

        function playerUpdateFramesList() {
            const container = document.getElementById('playerFramesList');
            const frames = playerAnimations[playerCurrentAnim] || [];

            if (frames.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:11px;">Click on sprite sheet to add frames</div>';
                return;
            }

            container.innerHTML = '';
            frames.forEach((frame, i) => {
                const wrapper = document.createElement('div');
                wrapper.style.cssText = 'display:inline-block; position:relative;';

                const thumb = document.createElement('canvas');
                thumb.width = 48;
                thumb.height = 48;
                thumb.style.cssText = 'border:1px solid #4f8; border-radius:3px; background:#111; image-rendering:pixelated; cursor:pointer;';
                const sheetNum = (frame.sheet || 0) + 1;
                thumb.title = 'Frame ' + (i + 1) + ' (Sheet ' + sheetNum + ') - Click to remove';

                // Get correct sheet for this frame
                const sheetIndex = frame.sheet || 0;
                const sheet = playerEditorSheets[sheetIndex];
                if (sheet) {
                    const ctx = thumb.getContext('2d');
                    ctx.imageSmoothingEnabled = false;
                    const scale = Math.min(46 / frame.w, 46 / frame.h);
                    const dw = frame.w * scale;
                    const dh = frame.h * scale;
                    ctx.drawImage(sheet.image, frame.x, frame.y, frame.w, frame.h, (48 - dw) / 2, (48 - dh) / 2, dw, dh);
                }

                thumb.onclick = () => {
                    frames.splice(i, 1);
                    playerDrawCanvas();
                    playerUpdateAnimButtons();
                    playerUpdateFramesList();
                    playerStartPreview();
                };

                wrapper.appendChild(thumb);

                // Show sheet number badge if multiple sheets
                if (playerEditorSheets.length > 1) {
                    const badge = document.createElement('div');
                    badge.textContent = sheetNum;
                    badge.style.cssText = 'position:absolute; top:-4px; right:-4px; background:#4af; color:#000; font-size:9px; font-weight:bold; width:14px; height:14px; border-radius:50%; display:flex; align-items:center; justify-content:center;';
                    wrapper.appendChild(badge);
                }

                container.appendChild(wrapper);
            });
        }

        function playerUpdateSpeed() {
            const fps = parseInt(document.getElementById('playerSpeedSlider').value);
            playerAnimFpsList[playerCurrentAnim] = fps;
            document.getElementById('playerSpeedLabel').textContent = fps + ' fps';
            if (playerPreviewPlaying) {
                playerStartPreview();
            }
        }

        // Get FPS for current animation (defaults to 8)
        function playerGetCurrentFps() {
            return playerAnimFpsList[playerCurrentAnim] || 8;
        }

        function playerUpdatePingPong() {
            playerPingPong = document.getElementById('playerPingPong').checked;
            playerPreviewDirection = 1;
            playerStartPreview();
        }

        function playerToggleMirror() {
            playerAnimMirrors[playerCurrentAnim] = !playerAnimMirrors[playerCurrentAnim];
            playerUpdateMirrorButton();
            playerStartPreview(); // Restart preview with new mirror state
        }

        function playerUpdateMirrorButton() {
            const btn = document.getElementById('playerMirrorBtn');
            if (playerAnimMirrors[playerCurrentAnim]) {
                btn.style.background = '#4f8';
                btn.style.color = '#000';
                btn.style.borderColor = '#4f8';
                btn.textContent = 'Mirrored';
            } else {
                btn.style.background = '#555';
                btn.style.color = '#fff';
                btn.style.borderColor = '#888';
                btn.textContent = 'Mirror';
            }
        }

        // Shape-based hitbox functions (per-direction)
        let playerHitboxEditDir = 'down';

        function setPlayerHitboxDir(dir) {
            playerHitboxEditDir = dir;
            document.querySelectorAll('[id^="phbDir"]').forEach(b => {
                b.classList.remove('active');
                b.style.background = '';
            });
            const btn = document.getElementById('phbDir' + dir.charAt(0).toUpperCase() + dir.slice(1));
            if (btn) {
                btn.classList.add('active');
                btn.style.background = '#606';
            }
            updatePlayerHitboxSliders();
        }

        function updatePlayerHitboxSliders() {
            const dir = playerHitboxEditDir;
            document.getElementById('playerHitboxRange').value = playerHitboxRange[dir] || 40;
            document.getElementById('playerHitboxWidth').value = playerHitboxWidth[dir] || 60;
            document.getElementById('playerHitboxOffsetX').value = playerHitboxOffsetX[dir] || 0;
            document.getElementById('playerHitboxOffsetY').value = playerHitboxOffsetY[dir] || 0;
            document.getElementById('playerHitboxRangeVal').textContent = playerHitboxRange[dir] || 40;
            document.getElementById('playerHitboxWidthVal').textContent = playerHitboxWidth[dir] || 60;
            document.getElementById('playerHitboxOffsetXVal').textContent = playerHitboxOffsetX[dir] || 0;
            document.getElementById('playerHitboxOffsetYVal').textContent = playerHitboxOffsetY[dir] || 0;
        }

        function updatePlayerHitboxShape() {
            const dir = playerHitboxEditDir;
            playerHitboxRange[dir] = parseInt(document.getElementById('playerHitboxRange').value);
            playerHitboxWidth[dir] = parseInt(document.getElementById('playerHitboxWidth').value);
            playerHitboxOffsetX[dir] = parseInt(document.getElementById('playerHitboxOffsetX').value);
            playerHitboxOffsetY[dir] = parseInt(document.getElementById('playerHitboxOffsetY').value);
            document.getElementById('playerHitboxRangeVal').textContent = playerHitboxRange[dir];
            document.getElementById('playerHitboxWidthVal').textContent = playerHitboxWidth[dir];
            document.getElementById('playerHitboxOffsetXVal').textContent = playerHitboxOffsetX[dir];
            document.getElementById('playerHitboxOffsetYVal').textContent = playerHitboxOffsetY[dir];
        }

        function copyPlayerHitboxToAll() {
            const dir = playerHitboxEditDir;
            ['up', 'down', 'left', 'right'].forEach(d => {
                playerHitboxRange[d] = playerHitboxRange[dir];
                playerHitboxWidth[d] = playerHitboxWidth[dir];
                playerHitboxOffsetX[d] = playerHitboxOffsetX[dir];
                playerHitboxOffsetY[d] = playerHitboxOffsetY[dir];
            });
            console.log('Copied ' + dir + ' hitbox to all directions');
        }

        function playerUpdateHitboxUI() {
            const section = document.getElementById('playerHitboxSection');
            const isAttackAnim = playerCurrentAnim.startsWith('attack');
            // Show hitbox section only for attack animations
            if (section) section.style.display = isAttackAnim ? 'block' : 'none';
            // Update slider values
            if (document.getElementById('playerHitboxRange')) {
                updatePlayerHitboxSliders();
            }
        }

        function playerStartPreview() {
            playerStopPreview();
            const frames = playerAnimations[playerCurrentAnim] || [];
            if (frames.length === 0 || playerEditorSheets.length === 0) return;

            playerPreviewPlaying = true;
            playerPreviewFrame = 0;
            playerPreviewDirection = 1;
            const isMirrored = playerAnimMirrors[playerCurrentAnim];

            const canvas = document.getElementById('playerLivePreview');
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;

            function drawFrame() {
                if (!playerPreviewPlaying) return;
                const frame = frames[playerPreviewFrame];
                // Get the correct sheet for this frame
                const sheetIndex = frame.sheet || 0;
                const sheet = playerEditorSheets[sheetIndex];
                if (!sheet) return;

                ctx.clearRect(0, 0, 96, 96);

                // Get scale and shadow settings from UI
                const spriteScale = parseFloat(document.getElementById('playerScaleSlider')?.value || 1);
                const noShadow = document.getElementById('playerNoShadow')?.checked || false;

                const baseScale = Math.min(80 / frame.w, 80 / frame.h); // Reduced to 80 to fit scaled sprites
                const scale = baseScale * spriteScale;
                const dw = frame.w * scale;
                const dh = frame.h * scale;
                const dx = (96 - dw) / 2;
                const dy = (96 - dh) / 2;

                // Draw shadow (if enabled)
                if (!noShadow) {
                    const shadowOffsetX = parseInt(document.getElementById('playerShadowOffsetXSlider')?.value || 0);
                    const shadowOffsetY = parseInt(document.getElementById('playerShadowOffsetYSlider')?.value || 4);
                    const shadowWidthRatio = (parseInt(document.getElementById('playerShadowWidthSlider')?.value || 35)) / 100;
                    const shadowHeightRatio = (parseInt(document.getElementById('playerShadowHeightSlider')?.value || 12)) / 100;

                    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
                    ctx.beginPath();
                    ctx.ellipse(
                        dx + dw / 2 + shadowOffsetX * scale,
                        dy + dh - shadowOffsetY * scale,
                        dw * shadowWidthRatio,
                        dw * shadowHeightRatio,
                        0, 0, Math.PI * 2
                    );
                    ctx.fill();
                }

                // Apply mirror transform if enabled
                if (isMirrored) {
                    ctx.save();
                    ctx.translate(96, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(sheet.image, frame.x, frame.y, frame.w, frame.h, 96 - dx - dw, dy, dw, dh);
                    ctx.restore();
                } else {
                    ctx.drawImage(sheet.image, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh);
                }

                // Ping-pong or loop
                if (playerPingPong && frames.length > 1) {
                    playerPreviewFrame += playerPreviewDirection;
                    if (playerPreviewFrame >= frames.length - 1) {
                        playerPreviewDirection = -1;
                    } else if (playerPreviewFrame <= 0) {
                        playerPreviewDirection = 1;
                    }
                } else {
                    playerPreviewFrame = (playerPreviewFrame + 1) % frames.length;
                }
            }

            drawFrame();
            playerPreviewInterval = setInterval(drawFrame, 1000 / playerGetCurrentFps());
        }

        function playerStopPreview() {
            playerPreviewPlaying = false;
            if (playerPreviewInterval) {
                clearInterval(playerPreviewInterval);
                playerPreviewInterval = null;
            }
        }

        function playerClearCurrentAnim() {
            playerAnimations[playerCurrentAnim] = [];
            playerDrawCanvas();
            playerUpdateAnimButtons();
            playerUpdateFramesList();
            playerStopPreview();
        }

        function playerAddCustomAnim() {
            const input = document.getElementById('playerCustomAnimName');
            const name = input.value.trim();
            if (!name) {
                alert('Enter an animation name');
                return;
            }
            // Reserved names
            const reserved = ['walkDown', 'walkUp', 'walkLeft', 'walkRight', 'walkDownLeft', 'walkDownRight', 'walkUpLeft', 'walkUpRight', 'idle', 'idleDown', 'idleUp', 'idleLeft', 'idleRight', 'attackDown', 'attackUp', 'attackLeft', 'attackRight', 'interact', 'death', 'receivedItem'];
            if (reserved.includes(name) || playerAnimations[name]) {
                alert('Animation "' + name + '" already exists or is reserved');
                return;
            }

            playerAnimations[name] = [];
            input.value = '';
            playerSelectAnim(name);
            playerUpdateCustomAnimList();
            playerUpdateAnimButtons();
        }

        function playerUpdateCustomAnimList() {
            const container = document.getElementById('playerCustomAnimList');
            if (!container) return;

            // Get custom animations (not the default ones)
            const reserved = ['walkDown', 'walkUp', 'walkLeft', 'walkRight', 'walkDownLeft', 'walkDownRight', 'walkUpLeft', 'walkUpRight', 'idle', 'idleDown', 'idleUp', 'idleLeft', 'idleRight', 'attackDown', 'attackUp', 'attackLeft', 'attackRight', 'interact', 'death', 'receivedItem'];
            const customAnims = Object.keys(playerAnimations).filter(k => !reserved.includes(k));

            if (customAnims.length === 0) {
                container.innerHTML = '';
                return;
            }

            container.innerHTML = '<div style="font-size:10px; color:#a8f; margin-bottom:5px; border-top:1px solid #555; padding-top:5px;">-- Custom --</div>';
            customAnims.forEach(name => {
                const frames = playerAnimations[name] || [];
                const div = document.createElement('div');
                div.style.cssText = 'display:flex; gap:4px; margin-bottom:4px;';
                div.innerHTML = '<button id="playerAnimCustom_' + name + '" onclick="playerSelectAnim(\'' + name + '\')" style="flex:1; padding:4px 6px; font-size:10px; background:#648;">' + name + (frames.length > 0 ? ' (' + frames.length + ')' : '') + '</button>' +
                    '<button onclick="playerDeleteCustomAnim(\'' + name + '\')" style="padding:4px 6px; font-size:10px; background:#a44;">X</button>';
                container.appendChild(div);
            });
        }

        function playerDeleteCustomAnim(name) {
            if (!playerAnimations[name]) return;
            if (playerAnimations[name].length > 0) {
                if (!confirm('Delete "' + name + '" animation with ' + playerAnimations[name].length + ' frames?')) return;
            }
            delete playerAnimations[name];
            if (playerCurrentAnim === name) {
                playerSelectAnim('walkDown');
            }
            playerUpdateCustomAnimList();
            playerUpdateAnimButtons();
        }

        // Game Over Sound functions
        // Index scheme: -1 = none, 0-99 = builtin sounds, 100+ = project sounds (index - 100)
        function playerPopulateGameOverSoundDropdown() {
            const select = document.getElementById('playerGameOverSound');
            if (!select) return;
            select.innerHTML = '<option value="-1">None</option>';
            // Built-in game over sounds
            builtinGameOverSounds.forEach((sound, index) => {
                const opt = document.createElement('option');
                opt.value = index; // 0, 1, etc for builtin
                opt.textContent = '🎵 ' + sound.name;
                select.appendChild(opt);
            });
            // Project sounds
            if (sounds.length > 0) {
                const separator = document.createElement('option');
                separator.disabled = true;
                separator.textContent = '─── Project Sounds ───';
                select.appendChild(separator);
                sounds.forEach((sound, index) => {
                    const opt = document.createElement('option');
                    opt.value = 100 + index; // 100+ for project sounds
                    opt.textContent = sound.name;
                    select.appendChild(opt);
                });
            }
            select.value = playerGameOverSoundIndex;
        }

        function playerUpdateGameOverSound() {
            const select = document.getElementById('playerGameOverSound');
            playerGameOverSoundIndex = parseInt(select.value);
        }

        // Update scale preview display
        function updatePlayerScalePreview() {
            const scale = parseFloat(document.getElementById('playerScaleSlider').value) || 1;
            document.getElementById('playerScaleVal').textContent = scale.toFixed(1);
            // Preview will update on next frame since it reads values directly
        }

        // Update shadow preview and toggle controls visibility
        function updatePlayerShadowPreview() {
            const noShadow = document.getElementById('playerNoShadow').checked;
            document.getElementById('playerShadowControls').style.display = noShadow ? 'none' : 'block';

            // Update slider value displays
            document.getElementById('playerShadowOffsetXVal').textContent = document.getElementById('playerShadowOffsetXSlider').value;
            document.getElementById('playerShadowOffsetYVal').textContent = document.getElementById('playerShadowOffsetYSlider').value;
            document.getElementById('playerShadowWidthVal').textContent = document.getElementById('playerShadowWidthSlider').value;
            document.getElementById('playerShadowHeightVal').textContent = document.getElementById('playerShadowHeightSlider').value;
            // Preview will update on next frame since it reads values directly
        }

        function playerPreviewGameOverSound() {
            if (playerGameOverSoundIndex < 0) {
                alert('No game over sound selected');
                return;
            }
            // Check if it's a builtin sound (0-99) or project sound (100+)
            if (playerGameOverSoundIndex < 100) {
                // Builtin sound - lazy load and play
                const builtinIndex = playerGameOverSoundIndex;
                if (builtinIndex >= 0 && builtinIndex < builtinGameOverSounds.length) {
                    if (!builtinGameOverAudios[builtinIndex]) {
                        builtinGameOverAudios[builtinIndex] = new Audio(builtinGameOverSounds[builtinIndex].file);
                    }
                    builtinGameOverAudios[builtinIndex].currentTime = 0;
                    builtinGameOverAudios[builtinIndex].play();
                }
            } else {
                // Project sound
                const projectIndex = playerGameOverSoundIndex - 100;
                if (projectIndex >= 0 && projectIndex < sounds.length) {
                    const sound = sounds[projectIndex];
                    if (sound && sound.audio) {
                        sound.audio.currentTime = 0;
                        sound.audio.play();
                    }
                }
            }
        }

        function playerSave() {
            const name = document.getElementById('playerNameInput').value.trim() || 'Player ' + (playerCharacters.length + 1);

            // Check if at least one animation has frames
            const hasFrames = Object.values(playerAnimations).some(a => a && a.length > 0);
            if (!hasFrames) {
                alert('Please add at least one animation frame');
                return;
            }

            // Save all sheets (array of base64 data)
            const sheetsData = playerEditorSheets.map(s => s.data);

            // Get attack movement setting from dropdown
            playerAttackMovement = document.getElementById('playerAttackMovement').value;

            // Get scale and shadow settings
            const spriteScale = parseFloat(document.getElementById('playerScaleSlider').value) || 1;
            const noShadow = document.getElementById('playerNoShadow').checked;
            const shadowOffsetX = parseInt(document.getElementById('playerShadowOffsetXSlider').value) || 0;
            const shadowOffsetY = parseInt(document.getElementById('playerShadowOffsetYSlider').value) || 4;
            const shadowWidth = parseInt(document.getElementById('playerShadowWidthSlider').value) || 35;
            const shadowHeight = parseInt(document.getElementById('playerShadowHeightSlider').value) || 12;

            const charData = {
                name: name,
                spriteData: sheetsData[0] || null, // Keep for backwards compatibility
                spriteSheets: sheetsData, // Array of all sheets
                frameWidth: playerEditorFrameW,
                frameHeight: playerEditorFrameH,
                animations: JSON.parse(JSON.stringify(playerAnimations)),
                animMirrors: JSON.parse(JSON.stringify(playerAnimMirrors)),
                hitboxRange: JSON.parse(JSON.stringify(playerHitboxRange)), // Per-direction range
                hitboxWidth: JSON.parse(JSON.stringify(playerHitboxWidth)), // Per-direction width
                hitboxOffsetX: JSON.parse(JSON.stringify(playerHitboxOffsetX)), // Per-direction X offset
                hitboxOffsetY: JSON.parse(JSON.stringify(playerHitboxOffsetY)), // Per-direction Y offset
                animFps: JSON.parse(JSON.stringify(playerAnimFpsList)), // Per-animation FPS
                fps: 8, // Keep for backwards compatibility
                pingPong: playerPingPong,
                attackMovement: playerAttackMovement, // 'stop', 'slide', 'move'
                gameOverSoundIndex: playerGameOverSoundIndex, // Index of game over sound
                // Scale and shadow
                scale: spriteScale,
                noShadow: noShadow,
                shadowOffsetX: shadowOffsetX,
                shadowOffsetY: shadowOffsetY,
                shadowWidth: shadowWidth,
                shadowHeight: shadowHeight
            };

            if (playerEditorEditingIndex >= 0) {
                playerCharacters[playerEditorEditingIndex] = charData;
                broadcastEdit({ editType: 'updatePlayerCharacter', index: playerEditorEditingIndex, character: charData });
            } else {
                playerCharacters.push(charData);
                broadcastEdit({ editType: 'addPlayerCharacter', character: charData });
            }

            // Load the sprite image for this character (so preview works)
            const charIndex = playerEditorEditingIndex >= 0 ? playerEditorEditingIndex : playerCharacters.length - 1;
            if (charData.spriteData) {
                const img = new Image();
                img.onload = () => {
                    playerCharacters[charIndex]._spriteImg = img;
                    updatePlayerList(); // Refresh preview
                    renderMap(); // Refresh map in case player is shown
                };
                img.src = charData.spriteData;
            }

            // If this is the first character, make it active
            if (playerCharacters.length === 1 && activePlayerIndex < 0) {
                setActivePlayer(0);
            }

            document.getElementById('playerModal').classList.remove('visible');
            playerStopPreview();
            stopEditing(); // Clear editing lock
            updatePlayerList();
        }

        function playerCancel() {
            document.getElementById('playerModal').classList.remove('visible');
            playerStopPreview();
            stopEditing(); // Clear editing lock
        }

        function updatePlayerList() {
            const container = document.getElementById('playerCharacterList');
            const activeNameEl = document.getElementById('activePlayerName');
            const previewCanvas = document.getElementById('activePlayerPreview');

            if (playerCharacters.length === 0) {
                container.innerHTML = '<div style="color:#888; font-size:12px; padding:10px; text-align:center;">No characters created yet</div>';
                activeNameEl.textContent = 'Default Sprite';
                // Draw default sprite preview
                if (previewCanvas && playerSpriteImg && playerSpriteImg.complete && playerSpriteImg.naturalWidth > 0) {
                    const ctx = previewCanvas.getContext('2d');
                    ctx.imageSmoothingEnabled = false;
                    ctx.clearRect(0, 0, 64, 64);
                    ctx.drawImage(playerSpriteImg, 0, 0, 64, 64, 0, 0, 64, 64);
                }
                return;
            }

            // Update active player name and preview
            if (activePlayerIndex >= 0 && playerCharacters[activePlayerIndex]) {
                const char = playerCharacters[activePlayerIndex];
                activeNameEl.textContent = char.name;
                // Draw active player preview
                if (previewCanvas && char.spriteData) {
                    const img = new Image();
                    img.onload = () => {
                        const ctx = previewCanvas.getContext('2d');
                        ctx.imageSmoothingEnabled = false;
                        ctx.clearRect(0, 0, 64, 64);
                        const anims = char.animations || {};
                        const frames = (anims.walkDown?.length > 0 ? anims.walkDown : null) ||
                                       (anims.idle?.length > 0 ? anims.idle : null) ||
                                       Object.values(anims).find(a => a && a.length > 0);
                        if (frames && frames.length > 0) {
                            const frame = frames[0];
                            const scale = Math.min(62 / frame.w, 62 / frame.h);
                            const dw = frame.w * scale;
                            const dh = frame.h * scale;
                            ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, (64 - dw) / 2, (64 - dh) / 2, dw, dh);
                        } else {
                            ctx.drawImage(img, 0, 0, char.frameWidth, char.frameHeight, 0, 0, 64, 64);
                        }
                    };
                    img.src = char.spriteData;
                }
            } else {
                activeNameEl.textContent = 'Default Sprite';
            }

            container.innerHTML = '';
            playerCharacters.forEach((char, i) => {
                const div = document.createElement('div');
                const isActive = i === activePlayerIndex;
                div.style.cssText = 'display:flex; align-items:center; gap:8px; padding:5px; margin-bottom:5px; background:' + (isActive ? '#2a5a3a' : '#333') + '; border-radius:4px; cursor:pointer;' + (isActive ? 'border:1px solid #4f8;' : '');

                // Thumbnail
                const thumb = document.createElement('canvas');
                thumb.width = 32;
                thumb.height = 32;
                thumb.style.cssText = 'border:1px solid #555; border-radius:3px; image-rendering:pixelated;';

                const anims = char.animations || {};
                const firstAnim = (anims.walkDown?.length > 0 ? anims.walkDown : null) ||
                                  (anims.idle?.length > 0 ? anims.idle : null) ||
                                  Object.values(anims).find(a => a && a.length > 0);
                if (char.spriteData && firstAnim && firstAnim.length > 0) {
                    const img = new Image();
                    img.onload = () => {
                        const ctx = thumb.getContext('2d');
                        ctx.imageSmoothingEnabled = false;
                        const frame = firstAnim[0];
                        const scale = Math.min(32 / frame.w, 32 / frame.h);
                        const dw = frame.w * scale;
                        const dh = frame.h * scale;
                        ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, (32 - dw) / 2, (32 - dh) / 2, dw, dh);
                    };
                    img.src = char.spriteData;
                }

                // Active indicator
                const indicator = document.createElement('span');
                indicator.textContent = isActive ? '*' : '';
                indicator.style.cssText = 'color:#4f8; font-weight:bold; width:12px;';

                // Name
                const nameSpan = document.createElement('span');
                nameSpan.textContent = char.name;
                nameSpan.style.cssText = 'flex:1; font-size:12px;';

                // Set Active button
                const activeBtn = document.createElement('button');
                activeBtn.textContent = isActive ? 'Active' : 'Use';
                activeBtn.style.cssText = 'padding:2px 6px; font-size:10px; background:' + (isActive ? '#4f8' : '#555') + '; color:' + (isActive ? '#000' : '#fff') + ';';
                activeBtn.onclick = (e) => { e.stopPropagation(); setActivePlayer(i); };

                // Edit button
                const editBtn = document.createElement('button');
                editBtn.textContent = 'Edit';
                editBtn.style.cssText = 'padding:2px 6px; font-size:10px; background:#666;';
                editBtn.onclick = (e) => { e.stopPropagation(); openPlayerEditor(i); };

                // Delete button
                const delBtn = document.createElement('button');
                delBtn.textContent = 'X';
                delBtn.style.cssText = 'padding:2px 6px; font-size:10px; background:#a55;';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm('Delete character "' + char.name + '"?')) {
                        deletePlayerCharacter(i);
                    }
                };

                div.onclick = () => setActivePlayer(i);

                div.appendChild(thumb);
                div.appendChild(indicator);
                div.appendChild(nameSpan);
                div.appendChild(activeBtn);
                div.appendChild(editBtn);
                div.appendChild(delBtn);
                container.appendChild(div);
            });
        }

        function setActivePlayer(index) {
            activePlayerIndex = index;
            updatePlayerList();
            broadcastEdit({ editType: 'setActivePlayer', index: index });
        }

        function deletePlayerCharacter(index) {
            playerCharacters.splice(index, 1);
            if (activePlayerIndex >= playerCharacters.length) {
                activePlayerIndex = playerCharacters.length - 1;
            }
            if (activePlayerIndex === index) {
                activePlayerIndex = playerCharacters.length > 0 ? 0 : -1;
            }
            updatePlayerList();
            broadcastEdit({ editType: 'deletePlayerCharacter', index: index });
        }

        // ============ END PLAYER CHARACTER EDITOR ============

        // Button click sounds for start screen
        const buttonNavSound = new Audio('sounds/button-press-382713.mp3'); // Navigation clicks
        buttonNavSound.volume = 0.5;
        const buttonActionSound = new Audio('sounds/button-select.mp3'); // Final action (join/build/start)
        buttonActionSound.volume = 0.5;

        // Landing-page theme song. Plays on the menu, fades out when the game starts.
        const landingTheme = new Audio('assets/landing-theme.mp3');
        landingTheme.loop = true;
        landingTheme.volume = 0.6;
        let landingThemeStopped = false;

        function startLandingTheme() {
            if (landingThemeStopped) return;
            landingTheme.play().catch(() => {});
        }

        function stopLandingTheme() {
            if (landingThemeStopped) return;
            landingThemeStopped = true;
            const fade = setInterval(() => {
                if (landingTheme.volume > 0.06) {
                    landingTheme.volume = Math.max(0, landingTheme.volume - 0.06);
                } else {
                    landingTheme.pause();
                    landingTheme.currentTime = 0;
                    clearInterval(fade);
                }
            }, 40);
        }

        // Autoplay-with-sound is blocked until a user gesture, so the theme song —
        // and the menu grow-in — both wait for the first click/keypress, then fire
        // together. (.theme-started reveals + animates #mainMenu; see CSS.)
        window.addEventListener('DOMContentLoaded', () => {
            const reveal = () => {
                document.body.classList.add('theme-started');
                startLandingTheme();
            };
            landingTheme.play().then(() => {
                // Rare: autoplay allowed — reveal right away.
                document.body.classList.add('theme-started');
            }).catch(() => {
                const kick = () => {
                    document.removeEventListener('pointerdown', kick);
                    document.removeEventListener('keydown', kick);
                    reveal();
                };
                document.addEventListener('pointerdown', kick);
                document.addEventListener('keydown', kick);
            });
        });

        function playButtonSound() {
            buttonNavSound.currentTime = 0;
            buttonNavSound.play().catch(() => {});
        }

        function playActionSound() {
            buttonActionSound.currentTime = 0;
            buttonActionSound.play().catch(() => {});
            stopLandingTheme(); // game is starting — fade the menu theme out
        }

        // Set up NPC canvas mouse handlers
        document.addEventListener('DOMContentLoaded', () => {
            // Add navigation sound to all retro-btn in loadPhase
            document.querySelectorAll('#loadPhase .retro-btn').forEach(btn => {
                btn.addEventListener('click', playButtonSound);
            });
            const npcCanvas = document.getElementById('npcEditorCanvas');
            if (npcCanvas) {
                npcCanvas.addEventListener('mousedown', function(e) {
                    if (!npcEditorImage) return;

                    const rect = this.getBoundingClientRect();
                    const scale = npcEditorZoom;
                    const clickX = (e.clientX - rect.left) / scale;
                    const clickY = (e.clientY - rect.top) / scale;

                    if (npcTool === 'collision' || npcTool === 'erase') {
                        npcPainting = true;
                        npcPaintCollision(Math.floor(clickX), Math.floor(clickY), npcTool === 'erase');
                        npcDrawCanvas();
                    } else if (npcTool === 'split') {
                        npcPainting = true;
                        npcPaintSplit(Math.floor(clickX), Math.floor(clickY));
                        npcDrawCanvas();
                    } else {
                        // Frame selection mode (npcTool === 'none') - start drag for multi-tile selection
                        const gridX = Math.floor(clickX / npcEditorFrameW);
                        const gridY = Math.floor(clickY / npcEditorFrameH);
                        npcFrameDragStart = { gridX, gridY };
                        npcFrameDragEnd = { gridX, gridY };
                        npcFrameDragging = true;
                        npcDrawCanvas();
                    }
                });

                npcCanvas.addEventListener('mousemove', function(e) {
                    if (!npcEditorImage) return;

                    const rect = this.getBoundingClientRect();
                    const scale = npcEditorZoom;
                    const clickX = (e.clientX - rect.left) / scale;
                    const clickY = (e.clientY - rect.top) / scale;

                    // Update brush preview position
                    if (npcTool === 'collision' || npcTool === 'erase') {
                        npcBrushPreviewPos = { x: Math.floor(clickX), y: Math.floor(clickY) };
                        if (!npcPainting) npcDrawCanvas(); // Redraw for preview
                    } else {
                        npcBrushPreviewPos = null;
                    }

                    // Handle frame drag selection
                    if (npcFrameDragging) {
                        const gridX = Math.floor(clickX / npcEditorFrameW);
                        const gridY = Math.floor(clickY / npcEditorFrameH);
                        npcFrameDragEnd = { gridX, gridY };
                        npcDrawCanvas();
                        return;
                    }

                    if (!npcPainting) return;

                    if (npcTool === 'collision' || npcTool === 'erase') {
                        npcPaintCollision(Math.floor(clickX), Math.floor(clickY), npcTool === 'erase');
                        npcDrawCanvas();
                    } else if (npcTool === 'split') {
                        npcPaintSplit(Math.floor(clickX), Math.floor(clickY));
                        npcDrawCanvas();
                    }
                });

                npcCanvas.addEventListener('mouseleave', function() {
                    npcBrushPreviewPos = null;
                    if (npcTool === 'collision' || npcTool === 'erase') {
                        npcDrawCanvas();
                    }
                });

                npcCanvas.addEventListener('mouseup', function(e) {
                    // Finalize frame drag selection
                    if (npcFrameDragging && npcFrameDragStart && npcFrameDragEnd) {
                        // Calculate rectangle bounds (handle drag in any direction)
                        const startGX = Math.min(npcFrameDragStart.gridX, npcFrameDragEnd.gridX);
                        const startGY = Math.min(npcFrameDragStart.gridY, npcFrameDragEnd.gridY);
                        const endGX = Math.max(npcFrameDragStart.gridX, npcFrameDragEnd.gridX);
                        const endGY = Math.max(npcFrameDragStart.gridY, npcFrameDragEnd.gridY);

                        // Calculate frame in pixels
                        const frameX = startGX * npcEditorFrameW;
                        const frameY = startGY * npcEditorFrameH;
                        const frameW = (endGX - startGX + 1) * npcEditorFrameW;
                        const frameH = (endGY - startGY + 1) * npcEditorFrameH;

                        // Initialize animation array if needed
                        if (!npcAnimations[npcCurrentAnim]) {
                            npcAnimations[npcCurrentAnim] = [];
                        }

                        const frames = npcAnimations[npcCurrentAnim];

                        // Always add frame (allows same frame multiple times for animation)
                        frames.push({
                            x: frameX,
                            y: frameY,
                            w: frameW,
                            h: frameH
                        });

                        npcDrawCanvas();
                        npcUpdateFramesList();
                        npcUpdateAnimButtons();
                        npcStartPreview();
                    }

                    // Reset drag state
                    npcFrameDragging = false;
                    npcFrameDragStart = null;
                    npcFrameDragEnd = null;
                    npcPainting = false;
                });

                npcCanvas.addEventListener('mouseleave', function(e) {
                    // Cancel drag on mouse leave
                    if (npcFrameDragging) {
                        npcFrameDragging = false;
                        npcFrameDragStart = null;
                        npcFrameDragEnd = null;
                        npcDrawCanvas();
                    }
                    npcPainting = false;
                });
            }
        });
