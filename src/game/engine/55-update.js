        function update() {
            const updatePerfStart = performance.now();
            let updatePerfLog = '';

            let dx = 0, dy = 0;
            player.moving = false;

            // Advance any in-progress fishing cast/wait (cancels on movement input).
            updateFishing();

            // Check if player can move (based on attack movement setting, receive item state, inventory, dialog, shop)
            let canMove = !player.attacking && !isReceivingItem && !inventoryOpen && !activeDialog && !shopOpen && !player.fishing;
            let moveMultiplier = 1;

            if (player.attacking && playerAttackMovement !== 'stop') {
                if (playerAttackMovement === 'move') {
                    canMove = true; // Full movement during attack
                } else if (playerAttackMovement === 'slide') {
                    canMove = true;
                    // Slide: start at slideAmount% speed, slow down over slideDuration frames
                    const slideProgress = 1 - (player.attackTimer / attackSlideDuration); // 0 to 1
                    const startSpeed = attackSlideAmount / 100; // Convert percentage to 0-1
                    moveMultiplier = Math.max(0, startSpeed * (1 - slideProgress)); // Starts at slideAmount, goes to 0
                }
            }

            if (canMove) {
                if (keys['ArrowUp']) { dy = -1; player.direction = 'up'; player.moving = true; }
                if (keys['ArrowDown']) { dy = 1; player.direction = 'down'; player.moving = true; }
                if (keys['ArrowLeft']) { dx = -1; player.direction = 'left'; player.moving = true; }
                if (keys['ArrowRight']) { dx = 1; player.direction = 'right'; player.moving = true; }

                // 8-direction facing: override the cardinal above with a diagonal, but ONLY when the
                // active sprite actually has diagonal walk frames. 4-dir sprites keep last-key-wins.
                if (player.moving && playerHasDiagonals) {
                    player.direction = dir8FromVector(dx, dy, true) || player.direction;
                }

                // Normalize diagonal movement so it's not faster
                if (dx !== 0 && dy !== 0) {
                    const diag = 0.7071; // 1/sqrt(2)
                    dx *= diag;
                    dy *= diag;
                }

                dx *= player.speed * moveMultiplier;
                dy *= player.speed * moveMultiplier;
            }

            // Move with collision - always use small foot hitbox (bottom 1/3 of player)
            // This allows walking behind objects naturally and prevents getting stuck
            const collisionHeight = player.height / 3;
            const collisionY = player.y + player.height * 2/3;

            let movedX = false;
            let movedY = false;

            // Check tile collision AND NPC collision
            const collT0 = performance.now();
            if (dx !== 0 && !checkCollision(player.x + dx, collisionY, player.width, collisionHeight) &&
                !checkNPCCollision(player.x + dx, collisionY, player.width, collisionHeight)) {
                player.x += dx;
                movedX = true;
            }
            if (dy !== 0 && !checkCollision(player.x, collisionY + dy, player.width, collisionHeight) &&
                !checkNPCCollision(player.x, collisionY + dy, player.width, collisionHeight)) {
                player.y += dy;
                movedY = true;
            }
            const collT1 = performance.now();
            if (collT1 - collT0 > 5) updatePerfLog += ' collision:' + (collT1-collT0).toFixed(0);

            // If player tried to move but was blocked in all directions, force idle
            if (player.moving && !movedX && !movedY) {
                player.moving = false;
            }

            // Animation - uses per-animation FPS if available
            player.frameTimer++;
            // Get FPS for current animation
            let currentAnimKey = 'walkDown';
            if (playerAnimations) {
                const dirMap = { down: 'walkDown', up: 'walkUp', left: 'walkLeft', right: 'walkRight' };
                const idleDirMap = { down: 'idleDown', up: 'idleUp', left: 'idleLeft', right: 'idleRight' };
                if (player.moving) {
                    currentAnimKey = resolveWalkKey(playerAnimations, player.direction).key;
                } else {
                    const dirIdleKey = idleDirMap[cardinalOf(player.direction)];
                    if (playerAnimations[dirIdleKey] && playerAnimations[dirIdleKey].length > 0) {
                        currentAnimKey = dirIdleKey;
                    } else if (playerAnimations.idle && playerAnimations.idle.length > 0) {
                        currentAnimKey = 'idle';
                    } else {
                        currentAnimKey = dirMap[cardinalOf(player.direction)];
                    }
                }
            }
            const currentFps = playerAnimFpsList[currentAnimKey] || 8;
            const frameDelay = Math.max(1, Math.round(60 / currentFps));
            if (player.frameTimer >= frameDelay) {
                player.frameTimer = 0;
                player.frame = player.frame + 1; // uncapped; draw uses % frames.length so >4-frame walks play fully
            }

            // Update animated tile animations - use cached registry (MUCH faster than scanning all tiles)
            const animT0 = performance.now();
            for (const entry of animatedTileRegistry) {
                const cell = layers[entry.li]?.[entry.y]?.[entry.x];
                if (!cell || cell.type !== 'animTile') continue;

                const propData = animatedPropsData[cell.propIndex];
                if (!propData || !propData.frames || propData.frames.length <= 1) continue;
                if (propData.type !== 'loop') continue;

                // Use origin position for animation state key
                const key = entry.x + ',' + entry.y + ',' + entry.li;

                if (!animPropFrameTimers[key]) {
                    animPropFrameTimers[key] = { frame: 0, timer: 0, waiting: false, waitTimer: 0, playCount: 0 };
                }
                const state = animPropFrameTimers[key];
                const instanceSpeed = cell.instanceSpeed || 1;
                const fps = (propData.fps || 8) * instanceSpeed;
                const frameDelay = Math.round(60 / fps);
                // Use instance settings if set, otherwise prop defaults
                const playMode = cell.instancePlayMode || propData.playMode || 'loop';
                const waitTime = ((cell.instanceWaitTime !== undefined ? cell.instanceWaitTime : propData.waitTime) || 2) * 60;
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
                } else {
                    state.timer++;
                    if (state.timer >= frameDelay) {
                        state.timer = 0;
                        state.frame++;

                        // Handle end of animation
                        if (state.frame >= propData.frames.length) {
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
                    }
                }
            }
            const animT1 = performance.now();
            if (animT1 - animT0 > 5) updatePerfLog += ' animTiles:' + (animT1-animT0).toFixed(0);

            // Attack timer and animation
            if (player.attacking) {
                player.attackTimer--;

                // Advance attack animation frames
                if (player.attackAnim && playerAnimations) {
                    const attackDirMap = { down: 'attackDown', up: 'attackUp', left: 'attackLeft', right: 'attackRight' };
                    const attackKey = (player.throwing && player.throwAnimKey) ? player.throwAnimKey : attackDirMap[cardinalOf(player.direction)];
                    let attackFrames = playerAnimations[attackKey] || playerAnimations.attack || [];

                    if (attackFrames.length > 0) {
                        // Get FPS for attack animation
                        const attackFps = playerAnimFpsList[attackKey] || playerAnimFpsList.attack || 8;
                        const frameDelay = Math.round(60 / attackFps);

                        if (player.attackFrameTimer === undefined) player.attackFrameTimer = 0;
                        player.attackFrameTimer++;

                        if (player.attackFrameTimer >= frameDelay) {
                            player.attackFrameTimer = 0;
                            player.attackFrame++;

                            // If animation finished, end attack
                            if (player.attackFrame >= attackFrames.length) {
                                player.attacking = false;
                                player.attackAnim = false;
                                player.attackFrame = 0;
                            }
                        }
                        // Use attackFrame for drawing
                        player.frame = player.attackFrame;
                    } else {
                        // No attack animation, just use timer
                        if (player.attackTimer <= 0) {
                            player.attacking = false;
                            player.attackAnim = false;
                        }
                    }
                } else if (player.attackTimer <= 0) {
                    player.attacking = false;
                    player.attackAnim = false;
                }

                if (!player.attacking) { player.throwing = false; player.throwAnimKey = null; } // swing/throw finished

                // Check for attack hitbox collisions with enemy NPCs
                checkAttackHitbox();
            }

            // Invincibility timer
            if (player.invincible) {
                player.invincibleTimer--;
                if (player.invincibleTimer <= 0) {
                    player.invincible = false;
                }
            }

            // Keep mobile zoom in sync with the current screen size / orientation each frame.
            updateMobileZoom();

            // Camera follow - adjust for zoom so player stays centered
            camera.x = player.x - (canvas.width / 2) / cameraZoom;
            camera.y = player.y - (canvas.height / 2) / cameraZoom;

            // Apply camera bounds if set for this map
            const currentMapData = mapsData[currentGameMap];
            if (currentMapData && currentMapData.cameraBounds) {
                const bounds = currentMapData.cameraBounds;
                const tileSize = gridSize * TILE_SCALE;
                const boundsPixelX = bounds.x * tileSize;
                const boundsPixelY = bounds.y * tileSize;
                const boundsPixelW = bounds.width * tileSize;
                const boundsPixelH = bounds.height * tileSize;

                const viewW = canvas.width / cameraZoom;
                const viewH = canvas.height / cameraZoom;

                // Clamp camera to bounds
                camera.x = Math.max(boundsPixelX, Math.min(camera.x, boundsPixelX + boundsPixelW - viewW));
                camera.y = Math.max(boundsPixelY, Math.min(camera.y, boundsPixelY + boundsPixelH - viewH));

                // If view is larger than bounds, center on bounds
                if (viewW >= boundsPixelW) {
                    camera.x = boundsPixelX + (boundsPixelW - viewW) / 2;
                }
                if (viewH >= boundsPixelH) {
                    camera.y = boundsPixelY + (boundsPixelH - viewH) / 2;
                }
            }

            // === UPDATE NPCs ===
            const npcT0 = performance.now();
            updateNPCs();
            const npcT1 = performance.now();
            window._lastNpcTime = npcT1 - npcT0;  // For perf recording
            if (npcT1 - npcT0 > 10) updatePerfLog += ' NPCs:' + (npcT1-npcT0).toFixed(0);

            // === SOUND UPDATES ===
            // Play walk sounds when moving
            if (player.moving && playerSoundsData.walk && playerSoundsData.walk.soundIndex >= 0) {
                const now = performance.now();
                const interval = playerSoundsData.walk.interval || 200;
                if (now - lastWalkSoundTime >= interval) {
                    playSound(
                        playerSoundsData.walk.soundIndex,
                        playerSoundsData.walk.volume || 0.5,
                        playerSoundsData.walk.pitchVariation || 0.1
                    );
                    lastWalkSoundTime = now;
                }
            }

            // Update ambient sounds based on proximity
            const soundT0 = performance.now();
            updateAmbientSounds();
            const soundT1 = performance.now();
            if (soundT1 - soundT0 > 5) updatePerfLog += ' sounds:' + (soundT1-soundT0).toFixed(0);

            // === MULTIPLAYER UPDATES ===
            // Send position update to server
            sendMpUpdate();

            // Update other players - smooth interpolation with prediction
            otherPlayers.forEach((other, id) => {
                const now = Date.now();
                const timeSinceUpdate = (now - other.lastUpdateTime) / 1000; // seconds

                // Predict where player should be based on velocity
                // Only predict for a short time (0.15s) to avoid overshooting
                const predictTime = Math.min(timeSinceUpdate, 0.15);
                const predictedX = other.targetX + (other.vx || 0) * predictTime;
                const predictedY = other.targetY + (other.vy || 0) * predictTime;

                // Smooth interpolation toward predicted position
                // Use exponential decay for smoother movement
                const smoothing = 0.12; // Lower = smoother but laggier, higher = snappier but jerkier
                other.x += (predictedX - other.x) * smoothing;
                other.y += (predictedY - other.y) * smoothing;

                // Snap if very close to avoid micro-jitter
                if (Math.abs(other.x - predictedX) < 0.5) other.x = predictedX;
                if (Math.abs(other.y - predictedY) < 0.5) other.y = predictedY;

                // Update animation frame
                other.frameTimer++;
                if (other.frameTimer >= animSpeed) {
                    other.frameTimer = 0;
                    other.frame = other.frame + 1; // uncapped; draw uses % frames.length
                }
            });

            // Log slow update sections
            const updateTotalTime = performance.now() - updatePerfStart;
            if (updateTotalTime > 16) {
                console.log('[UPDATE PERF]' + updatePerfLog + ' total:' + updateTotalTime.toFixed(0) + 'ms');
            }
        }

        // === MAP TRANSITION SYSTEM ===
        let isTransitioning = false;
        let transitionAlpha = 0;
        let transitionPhase = 'none'; // 'fadeOut', 'fadeIn', 'none', 'doorAnim'
        let pendingTransition = null;
        let pendingExternalUrl = null; // For external door navigation
        let inTavernMode = false; // True when player is in tavern (new tab)
        let tavernWindow = null; // Reference to tavern window

        // Check if player is on a trigger and interact
        // doorTypeFilter: 'interact' = only interact doors, 'walkover' = only walkover doors, null = all
        function checkTriggerInteraction(doorTypeFilter) {
            if (isTransitioning) return false;

            const tileSize = gridSize * TILE_SCALE;
            // Get player's foot position (center bottom)
            const playerTileX = Math.floor((player.x + player.width / 2) / tileSize);
            const playerTileY = Math.floor((player.y + player.height * 0.8) / tileSize);

            for (const trigger of placedTriggers) {
                if (trigger.mapName !== currentGameMap) continue;

                // Filter by door type if specified
                const triggerDoorType = trigger.doorType || 'walkover'; // Default to walkover for old triggers
                // External doors act like walkover doors (trigger on contact)
                const effectiveDoorType = triggerDoorType === 'external' ? 'walkover' : triggerDoorType;
                if (doorTypeFilter && effectiveDoorType !== doorTypeFilter) continue;

                // Check if player is in trigger zone
                if (playerTileX >= trigger.x && playerTileX < trigger.x + (trigger.width || 1) &&
                    playerTileY >= trigger.y && playerTileY < trigger.y + (trigger.height || 1)) {

                    // Skip if target map doesn't exist (unless external door)
                    if (trigger.doorType !== 'external' && !mapsData[trigger.targetMap]) {
                        // Only log once per door to avoid spam
                        if (!trigger._warnedMissing) {
                            console.warn('[TRIGGER] Door ' + trigger.doorNumber + ' target map "' + trigger.targetMap + '" not found');
                            trigger._warnedMissing = true;
                        }
                        return false;
                    }

                    // Skip if spawn point hasn't been set (targetX/Y are null)
                    if (trigger.doorType !== 'external' && (trigger.targetX === null || trigger.targetY === null)) {
                        if (!trigger._warnedNoSpawn) {
                            console.warn('[TRIGGER] Door ' + trigger.doorNumber + ' has no spawn point set - skipping');
                            trigger._warnedNoSpawn = true;
                        }
                        return false;
                    }

                    // Found a trigger - start transition
                    startMapTransition(trigger);
                    return true;
                }
            }
            return false;
        }

        // Check for walkover triggers (called every frame)
        function checkWalkoverTriggers() {
            return checkTriggerInteraction('walkover');
        }

        // === DIALOG INTERACTION SYSTEM ===
        let activeDialog = null; // { dialog, pageIndex, npc }
        let dialogCooldown = 0; // Prevent rapid re-trigger
        let dialogSelectedChoice = 0; // Index of currently selected choice
        // Typewriter effect state
        let dialogTypingState = {
            charsShown: 0,
            complete: true,
            lastTypeTime: 0,
            fullText: ''
        };

        function checkDialogInteraction() {
            if (activeDialog || dialogCooldown > 0) return false;

            const tileSize = gridSize * TILE_SCALE;
            // Use player center for X, and upper-middle for Y (not feet)
            const playerTileX = Math.floor((player.x + player.width / 2) / tileSize);
            const playerTileY = Math.floor((player.y + player.height / 2) / tileSize);

            // Build interaction cone based on player facing direction
            // Cone checks tiles in front of player (generous reach for interaction)
            const dir = cardinalOf(player.direction) || 'down'; // diagonal->cardinal so the interaction cone matches
            const coneTiles = [];

            // Always include player's current tile (for overlapping/adjacent NPCs)
            coneTiles.push({ x: playerTileX, y: playerTileY });

            if (dir === 'up') {
                // Tiles above player
                coneTiles.push({ x: playerTileX, y: playerTileY - 1 });
                coneTiles.push({ x: playerTileX - 1, y: playerTileY - 1 });
                coneTiles.push({ x: playerTileX + 1, y: playerTileY - 1 });
                coneTiles.push({ x: playerTileX, y: playerTileY - 2 });
                coneTiles.push({ x: playerTileX - 1, y: playerTileY });
                coneTiles.push({ x: playerTileX + 1, y: playerTileY });
            } else if (dir === 'down') {
                // Tiles below player
                coneTiles.push({ x: playerTileX, y: playerTileY + 1 });
                coneTiles.push({ x: playerTileX - 1, y: playerTileY + 1 });
                coneTiles.push({ x: playerTileX + 1, y: playerTileY + 1 });
                coneTiles.push({ x: playerTileX, y: playerTileY + 2 });
                coneTiles.push({ x: playerTileX - 1, y: playerTileY });
                coneTiles.push({ x: playerTileX + 1, y: playerTileY });
            } else if (dir === 'left') {
                // Tiles to the left of player
                coneTiles.push({ x: playerTileX - 1, y: playerTileY });
                coneTiles.push({ x: playerTileX - 1, y: playerTileY - 1 });
                coneTiles.push({ x: playerTileX - 1, y: playerTileY + 1 });
                coneTiles.push({ x: playerTileX - 2, y: playerTileY });
                coneTiles.push({ x: playerTileX, y: playerTileY - 1 });
                coneTiles.push({ x: playerTileX, y: playerTileY + 1 });
            } else if (dir === 'right') {
                // Tiles to the right of player
                coneTiles.push({ x: playerTileX + 1, y: playerTileY });
                coneTiles.push({ x: playerTileX + 1, y: playerTileY - 1 });
                coneTiles.push({ x: playerTileX + 1, y: playerTileY + 1 });
                coneTiles.push({ x: playerTileX + 2, y: playerTileY });
                coneTiles.push({ x: playerTileX, y: playerTileY - 1 });
                coneTiles.push({ x: playerTileX, y: playerTileY + 1 });
            }

            // Check dialog tiles (signs) - must be in cone
            for (const tile of placedDialogTiles) {
                if (tile.mapName !== currentGameMap) continue;
                // Check if dialog tile is in the interaction cone
                const inCone = coneTiles.some(ct => ct.x === tile.x && ct.y === tile.y);
                if (inCone) {
                    const dialog = dialogs[tile.dialogIndex];
                    if (dialog) {
                        showDialog(dialog, null);
                        return true;
                    }
                }
            }

            // Check NPCs - quest dialogs take priority over regular dialogs
            for (let i = 0; i < placedNpcs.length; i++) {
                const npc = placedNpcs[i];
                // Skip NPCs on different maps (treat undefined/empty mapName as current map)
                if (npc.mapName && npc.mapName !== currentGameMap) continue;

                // Use NPC's current runtime position (where they are now), not spawn position
                // state.x/y are in gridSize pixels (unscaled), divide by gridSize to get tile coords
                const state = npcRuntimeState[i];
                const npcCurrentX = state ? Math.floor(state.x / gridSize) : npc.x;
                const npcCurrentY = state ? Math.floor(state.y / gridSize) : npc.y;

                // Check if NPC is in the interaction cone
                const inCone = coneTiles.some(ct => ct.x === npcCurrentX && ct.y === npcCurrentY);
                if (!inCone) continue;

                // Debug: show NPC info when in range
                const npcDef = npcs[npc.npcIndex];
                console.log('[DIALOG] NPC in cone:', npcDef?.name || 'unknown', 'dialogIndex:', npc.dialogIndex, 'uid:', npc.uid);

                // Check for quest dialog first
                const questAction = getQuestDialogForNpc(npc);

                if (questAction) {
                    const dialog = dialogs[questAction.dialogIndex];
                    if (dialog) {
                        // Set up callback for quest action after dialog closes
                        pendingQuestAction = questAction;
                        showDialog(dialog, npc);
                        return true;
                    }
                }

                // Fall back to regular NPC dialog
                if (npc.dialogIndex !== undefined && npc.dialogIndex >= 0) {
                    if (npc.dialogTrigger === 'auto') continue; // Skip auto-trigger NPCs
                    const dialog = dialogs[npc.dialogIndex];
                    if (dialog) {
                        showDialog(dialog, npc);
                        return true;
                    }
                }
            }

            return false;
        }

        // Track pending quest action after dialog closes
        let pendingQuestAction = null;

        // Get the appropriate quest dialog for an NPC based on quest state
        function getQuestDialogForNpc(npc) {
            if (!npc.uid || !quests) return null;

            for (const quest of quests) {
                const state = gameProgress.questStates[quest.id];
                if (!state) continue;

                // Check if this NPC is the quest giver for an available quest
                if (quest.startNpcUid === npc.uid && state.status === QUEST_STATUS.AVAILABLE) {
                    const dialogIdx = parseInt(quest.startDialogId);
                    if (!isNaN(dialogIdx) && dialogIdx >= 0) {
                        return { type: 'offer', questId: quest.id, dialogIndex: dialogIdx };
                    }
                }

                // Check if this NPC is the quest giver for an active quest (reminder)
                if (quest.startNpcUid === npc.uid && state.status === QUEST_STATUS.ACTIVE) {
                    // Check if all conditions are met (can turn in to same NPC)
                    const turnInNpc = quest.turnInNpcUid || quest.startNpcUid;
                    if (turnInNpc === npc.uid && areAllConditionsMet(quest)) {
                        const dialogIdx = parseInt(quest.completeDialogId);
                        if (!isNaN(dialogIdx) && dialogIdx >= 0) {
                            return { type: 'complete', questId: quest.id, dialogIndex: dialogIdx };
                        }
                    } else {
                        // Show reminder dialog
                        const dialogIdx = parseInt(quest.activeDialogId);
                        if (!isNaN(dialogIdx) && dialogIdx >= 0) {
                            return { type: 'reminder', questId: quest.id, dialogIndex: dialogIdx };
                        }
                    }
                }

                // Check if this NPC is the turn-in NPC for an active quest
                if (quest.turnInNpcUid === npc.uid && quest.turnInNpcUid !== quest.startNpcUid && state.status === QUEST_STATUS.ACTIVE) {
                    if (areAllConditionsMet(quest)) {
                        const dialogIdx = parseInt(quest.completeDialogId);
                        if (!isNaN(dialogIdx) && dialogIdx >= 0) {
                            return { type: 'complete', questId: quest.id, dialogIndex: dialogIdx };
                        }
                    }
                }
            }

            return null;
        }

        // Check if all conditions are met for a quest
        function areAllConditionsMet(quest) {
            if (!quest.conditions || quest.conditions.length === 0) return true;
            return quest.conditions.every(c => isConditionMet(c));
        }

        function checkAutoDialogs() {
            if (activeDialog || dialogCooldown > 0) return false;

            const tileSize = gridSize * TILE_SCALE;
            const playerTileX = Math.floor((player.x + player.width / 2) / tileSize);
            const playerTileY = Math.floor((player.y + player.height * 0.8) / tileSize);

            // Check NPCs with auto-trigger dialogs
            for (let i = 0; i < placedNpcs.length; i++) {
                const npc = placedNpcs[i];
                // Skip NPCs on different maps (treat undefined/empty mapName as current map)
                if (npc.mapName && npc.mapName !== currentGameMap) continue;
                if (npc.dialogIndex === undefined || npc.dialogIndex < 0) continue;
                if (npc.dialogTrigger !== 'auto') continue;

                // Use NPC's current runtime position (where they are now), not spawn position
                // state.x/y are in gridSize pixels (unscaled), divide by gridSize to get tile coords
                const state = npcRuntimeState[i];
                const npcCurrentX = state ? Math.floor(state.x / gridSize) : npc.x;
                const npcCurrentY = state ? Math.floor(state.y / gridSize) : npc.y;

                // Check if player is on or adjacent to NPC's current position
                const dx = Math.abs(npcCurrentX - playerTileX);
                const dy = Math.abs(npcCurrentY - playerTileY);
                if (dx <= 1 && dy <= 1) {
                    const dialog = dialogs[npc.dialogIndex];
                    if (dialog) {
                        showDialog(dialog, npc);
                        return true;
                    }
                }
            }

            return false;
        }

        function showDialog(dialog, npc) {
            activeDialog = { dialog, pageIndex: 0, npc };
            // Reset typewriter state for new dialog
            resetDialogTyping();
            // Pause NPC movement while talking
            if (npc) {
                // Find the NPC's runtime state and set pause flag there
                const npcIndex = placedNpcs.indexOf(npc);
                if (npcIndex >= 0 && npcRuntimeState[npcIndex]) {
                    npcRuntimeState[npcIndex]._dialogPaused = true;
                }
                // Track NPC interaction for quest system
                if (npc.uid) {
                    onNpcInteraction(npc.uid);
                }
            }
            renderDialogBox();
        }

        function resetDialogTyping() {
            const page = activeDialog?.dialog?.pages?.[activeDialog?.pageIndex];
            const typeSpeed = activeDialog?.dialog?.typeSpeed ?? 30;
            dialogTypingState = {
                charsShown: typeSpeed === 0 ? 999999 : 0, // Instant if speed is 0
                complete: typeSpeed === 0,
                lastTypeTime: performance.now(),
                fullText: page?.text || ''
            };
        }

        function updateDialogTyping() {
            if (!activeDialog || dialogTypingState.complete) return;

            const typeSpeed = activeDialog.dialog.typeSpeed ?? 30;
            if (typeSpeed === 0) {
                dialogTypingState.complete = true;
                dialogTypingState.charsShown = dialogTypingState.fullText.length;
                return;
            }

            const now = performance.now();
            const msPerChar = 1000 / typeSpeed;
            const elapsed = now - dialogTypingState.lastTypeTime;

            if (elapsed >= msPerChar) {
                const prevCharsShown = dialogTypingState.charsShown;
                const charsToAdd = Math.floor(elapsed / msPerChar);
                dialogTypingState.charsShown += charsToAdd;
                dialogTypingState.lastTypeTime = now;

                // Play talk sound for new characters
                if (dialogTypingState.charsShown > prevCharsShown) {
                    const newChar = dialogTypingState.fullText.charAt(dialogTypingState.charsShown - 1);
                    playNpcTalkSound(newChar);
                }

                if (dialogTypingState.charsShown >= dialogTypingState.fullText.length) {
                    dialogTypingState.charsShown = dialogTypingState.fullText.length;
                    dialogTypingState.complete = true;
                }

                // Re-render to show new characters
                renderDialogBox();
            }
        }

        function advanceDialog() {
            if (!activeDialog) return;

            // If still typing, complete instantly first
            if (!dialogTypingState.complete) {
                dialogTypingState.charsShown = dialogTypingState.fullText.length;
                dialogTypingState.complete = true;
                renderDialogBox();
                return;
            }

            // Check if current page has choices - don't auto-advance, wait for choice selection
            const page = activeDialog.dialog.pages[activeDialog.pageIndex];
            if (page?.choices && page.choices.length > 0) {
                // Don't advance - player must select a choice with Z key
                return;
            }

            // Typing complete, advance to next page
            activeDialog.pageIndex++;
            dialogSelectedChoice = 0; // Reset choice selection for next page
            if (activeDialog.pageIndex >= activeDialog.dialog.pages.length) {
                closeDialog();
            } else {
                resetDialogTyping(); // Reset typing for new page
                renderDialogBox();
            }
        }

        // Handle dialog choice selection (index param for mouse clicks)
        function selectDialogChoice(clickedIndex) {
            if (!activeDialog || !dialogTypingState.complete) return;

            const page = activeDialog.dialog.pages[activeDialog.pageIndex];
            if (!page?.choices || page.choices.length === 0) return;

            // If clicked, update selected choice first
            if (clickedIndex !== undefined && clickedIndex >= 0 && clickedIndex < page.choices.length) {
                dialogSelectedChoice = clickedIndex;
            }
            dialogSelectSound(); // confirm blip (keyboard Enter or mobile tap)

            const choice = page.choices[dialogSelectedChoice];
            if (!choice) return;

            console.log('[DIALOG] Selected choice:', choice.text, 'action:', choice.action);

            switch (choice.action) {
                case 'accept':
                    // Accept quest - will be handled by pending quest action
                    activeDialog.pageIndex = activeDialog.dialog.pages.length; // End dialog
                    closeDialog();
                    break;

                case 'decline':
                    // Decline quest - show decline dialog if available
                    if (pendingQuestAction && pendingQuestAction.type === 'offer') {
                        const quest = quests?.find(q => q.id === pendingQuestAction.questId);
                        if (quest?.declineDialogId !== undefined && quest.declineDialogId !== '') {
                            const declineDialogIndex = parseInt(quest.declineDialogId);
                            if (dialogs[declineDialogIndex]) {
                                pendingQuestAction = null; // Cancel quest offer
                                activeDialog = {
                                    dialog: dialogs[declineDialogIndex],
                                    pageIndex: 0,
                                    npc: activeDialog.npc
                                };
                                dialogSelectedChoice = 0;
                                resetDialogTyping();
                                renderDialogBox();
                                return;
                            }
                        }
                    }
                    pendingQuestAction = null;
                    closeDialog();
                    break;

                case 'goto':
                    // Go to specific dialog
                    if (choice.targetDialogId !== undefined) {
                        const targetIdx = parseInt(choice.targetDialogId);
                        if (dialogs[targetIdx]) {
                            activeDialog = {
                                dialog: dialogs[targetIdx],
                                pageIndex: 0,
                                npc: activeDialog.npc
                            };
                            dialogSelectedChoice = 0;
                            resetDialogTyping();
                            renderDialogBox();
                            return;
                        }
                    }
                    closeDialog();
                    break;

                case 'shop':
                    // Open shop - save index before closing dialog
                    let shopIdx = activeDialog?.shopIndex;
                    console.log('[SHOP DEBUG] shopIdx:', shopIdx, 'activeDialog:', JSON.parse(JSON.stringify(activeDialog || {})));
                    // Fallback: get shopIndex from the NPC if not on dialog
                    if (shopIdx === undefined && activeDialog?.npc) {
                        shopIdx = activeDialog.npc.shopIndex;
                        console.log('[SHOP DEBUG] Fallback shopIdx from npc:', shopIdx);
                    }
                    closeDialog();
                    if (shopIdx >= 0) {
                        openShop(shopIdx);
                    }
                    break;

                case 'close':
                default:
                    closeDialog();
                    break;
            }
        }
        window.selectDialogChoice = selectDialogChoice; // Expose to onclick

        function closeDialog() {
            // Resume NPC movement
            if (activeDialog && activeDialog.npc) {
                const npcIndex = placedNpcs.indexOf(activeDialog.npc);
                if (npcIndex >= 0 && npcRuntimeState[npcIndex]) {
                    npcRuntimeState[npcIndex]._dialogPaused = false;
                }
            }
            activeDialog = null;
            dialogCooldown = 30; // ~0.5 seconds at 60fps
            hideDialogBox();

            // Handle pending quest action
            if (pendingQuestAction) {
                const action = pendingQuestAction;
                pendingQuestAction = null;

                if (action.type === 'offer') {
                    // Accept the quest
                    acceptQuest(action.questId);
                    updateQuestTracker();
                } else if (action.type === 'complete') {
                    // Complete the quest
                    completeQuest(action.questId);
                    updateQuestTracker();
                }
                // 'reminder' type doesn't need any action
            }
        }

        // Complete a quest and give rewards
        function completeQuest(questId) {
            const quest = quests?.find(q => q.id === questId);
            if (!quest) return;

            const state = gameProgress.questStates[questId];
            if (!state || state.status !== QUEST_STATUS.ACTIVE) return;

            // Mark as completed
            state.status = QUEST_STATUS.COMPLETED;

            // Give rewards
            if (quest.onComplete) {
                // Give items
                if (quest.onComplete.giveItems && quest.onComplete.giveItems.length > 0) {
                    quest.onComplete.giveItems.forEach(reward => {
                        // Handle both old format (string) and new format (object with quantity)
                        const itemId = typeof reward === 'string' ? reward : reward.itemId;
                        const quantity = typeof reward === 'object' ? (reward.quantity || 1) : 1;
                        const idx = itemIdToIndex(itemId);
                        if (idx >= 0) {
                            for (let i = 0; i < quantity; i++) {
                                addToInventory(idx, 1);
                            }
                        }
                    });
                }
                // Remove items
                if (quest.onComplete.removeItems && quest.onComplete.removeItems.length > 0) {
                    quest.onComplete.removeItems.forEach(itemId => {
                        const idx = itemIdToIndex(itemId);
                        if (idx >= 0) removeFromInventory(idx, 1);
                    });
                }
            }

            console.log('[QUEST] Completed quest:', quest.name);
            showQuestNotification('completed', quest.name);

            // Check if other quests become available
            initializeQuestStates();
        }

        function renderDialogBox() {
            if (!activeDialog) return;

            const dialog = activeDialog.dialog;
            const page = dialog.pages[activeDialog.pageIndex];
            const box = document.getElementById('dialogBox');

            if (!box) return;

            // Apply dialog styling
            const style = dialog.style || 1;
            const presets = {
                1: { bg: '#000000', border: '#ffffff', text: '#ffffff', accent: '#ffffff', radius: 0, borderW: 4 },
                2: { bg: '#000088', border: '#ffffff', text: '#ffffff', accent: '#ffff00', radius: 0, borderW: 2 },
                3: { bg: '#f8f8f8', border: '#303030', text: '#303030', accent: '#e03030', radius: 8, borderW: 3 },
                4: { bg: '#000000', border: '#a080ff', text: '#ffffff', accent: '#ffff00', radius: 0, borderW: 2 },
                5: { bg: '#1a1a4e', border: '#8888ff', text: '#ffffff', accent: '#ffcc00', radius: 4, borderW: 2 },
                6: { bg: '#2d2d2d', border: '#4a9eff', text: '#ffffff', accent: '#4a9eff', radius: 6, borderW: 2 }
            };
            const preset = presets[style] || presets[1];

            box.style.background = dialog.colors?.background || preset.bg;
            box.style.border = (preset.borderW || 3) + 'px solid ' + (dialog.colors?.border || preset.border);
            box.style.borderRadius = (preset.radius || 0) + 'px';
            box.style.color = dialog.colors?.text || preset.text;

            // Build content with typewriter effect
            let html = '';
            if (page.speaker) {
                html += '<div style="color:' + (dialog.colors?.accent || preset.accent) + '; font-weight:bold; margin-bottom:8px;">' + page.speaker + '</div>';
            }

            // Show partial text based on typing state
            const fullText = page.text || '';
            const displayText = fullText.substring(0, dialogTypingState.charsShown);
            const typingCursor = dialogTypingState.complete ? '' : '<span style="animation:blink 0.5s infinite;">▌</span>';
            html += '<div style="line-height:1.5;">' + displayText + typingCursor + '</div>';

            // Show dialog choices if present and typing is complete
            const choices = page.choices || [];
            if (choices.length > 0 && dialogTypingState.complete) {
                html += '<div style="margin-top:8px; padding:6px; background:rgba(0,0,0,0.3); border-radius:4px;">';
                choices.forEach((choice, i) => {
                    const isSelected = i === dialogSelectedChoice;
                    const cursor = isSelected ? '► ' : '  ';
                    const bgColor = isSelected ? 'rgba(255,255,200,0.25)' : 'rgba(255,255,255,0.08)';
                    const borderColor = isSelected ? (dialog.colors?.accent || preset.accent) : 'transparent';
                    html += '<div onclick="selectDialogChoice(' + i + ')" style="padding:6px 10px; margin:4px 0; background:' + bgColor + '; border-left:3px solid ' + borderColor + '; cursor:pointer; transition:background 0.15s;">' +
                            '<span style="color:' + (dialog.colors?.accent || preset.accent) + ';">' + cursor + '</span>' +
                            choice.text +
                            '</div>';
                });
                html += '</div>';
            } else {
                // Show different prompt based on typing state
                const prompt = dialogTypingState.complete ? '[A]' : '[A] skip';
                html += '<div style="text-align:right; margin-top:10px; font-size:10px; color:#888;">' + prompt + ' ' + (activeDialog.pageIndex + 1) + '/' + dialog.pages.length + '</div>';
            }

            // Add blink animation style if not present
            if (!document.getElementById('dialogBlinkStyle')) {
                const style = document.createElement('style');
                style.id = 'dialogBlinkStyle';
                style.textContent = '@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }';
                document.head.appendChild(style);
            }

            box.innerHTML = html;
            box.style.display = 'block';
        }

        function hideDialogBox() {
            const box = document.getElementById('dialogBox');
            if (box) box.style.display = 'none';
        }

        // Forced walking state
        let forcedWalk = {
            active: false,
            direction: null,
            targetX: null, // Walk-out destination X (pixels)
            targetY: null, // Walk-out destination Y (pixels)
            duration: 0,
            elapsed: 0,
            speed: 2 // pixels per frame
        };

        // Start map transition
        function startMapTransition(trigger) {
            if (isTransitioning) return;

            isTransitioning = true;
            pendingTransition = trigger;

            // Handle external doors (navigate to another HTML file)
            if (trigger.doorType === 'external' && trigger.externalUrl) {
                // Resolve relative URLs using baseUrl from project data
                let externalUrl = trigger.externalUrl;
                if (!externalUrl.startsWith('http://') && !externalUrl.startsWith('https://')) {
                    // Relative URL - prefix with baseUrl
                    const baseUrl = projectData.baseUrl || '';
                    externalUrl = baseUrl + externalUrl;
                }
                console.log('[EXTERNAL DOOR] Navigating to:', externalUrl);

                // Save return coordinates so we can spawn back here
                // Use returnX/returnY if set, otherwise fall back to door position
                const returnInfo = {
                    map: currentGameMap,
                    x: trigger.returnX !== null ? trigger.returnX : trigger.x,
                    y: trigger.returnY !== null ? trigger.returnY : trigger.y,
                    timestamp: Date.now()
                };
                localStorage.setItem('externalDoorReturn', JSON.stringify(returnInfo));
                console.log('[EXTERNAL DOOR] Saved return info:', returnInfo);

                // Save multiplayer info for the external world (3D tavern)
                if (projectData.multiplayer && projectData.multiplayer.roomCode) {
                    const mpInfo = {
                        playerName: projectData.multiplayer.playerName,
                        roomCode: projectData.multiplayer.roomCode
                    };
                    localStorage.setItem('tavernMultiplayer', JSON.stringify(mpInfo));
                    console.log('[EXTERNAL DOOR] Saved multiplayer info:', mpInfo);
                }

                const fadeDuration = trigger.fadeDuration !== undefined ? trigger.fadeDuration : 0.5;

                if (fadeDuration > 0) {
                    // Fade to black, then navigate
                    transitionPhase = 'fadeOut';
                    transitionAlpha = 0;
                    // Store URL for navigation after fade completes
                    pendingExternalUrl = externalUrl;
                } else {
                    // Instant navigation
                    window.location.href = externalUrl;
                }
                return;
            }

            // Apply door animation tile changes (swap tiles to show "door open")
            if (trigger.animTiles && trigger.animTiles.length > 0) {
                console.log('[DOOR ANIM] Applying', trigger.animTiles.length, 'tile changes for door', trigger.doorNumber);
                trigger.animTiles.forEach(change => {
                    // Update the layers array with the "after" state
                    if (!layers[change.layer]) return;
                    if (!layers[change.layer][change.y]) {
                        layers[change.layer][change.y] = [];
                    }
                    layers[change.layer][change.y][change.x] = change.after;
                });
            }

            // Get fade duration (default to 0.5 if not set)
            const fadeDuration = trigger.fadeDuration !== undefined ? trigger.fadeDuration : 0.5;
            const tileSize = gridSize * TILE_SCALE;

            // Check if this is a walkover door with forced walking
            const hasWalkOut = trigger.walkOutX !== null && trigger.walkOutX !== undefined &&
                               trigger.walkOutY !== null && trigger.walkOutY !== undefined;
            const hasWalkDirection = trigger.walkDirection && trigger.walkDuration > 0;

            if (trigger.doorType === 'walkover' && (hasWalkOut || hasWalkDirection)) {
                // Start forced walking phase
                transitionPhase = 'forceWalk';
                forcedWalk.active = true;
                forcedWalk.elapsed = 0;

                if (hasWalkOut) {
                    // Walk to specific destination
                    forcedWalk.targetX = trigger.walkOutX * tileSize;
                    forcedWalk.targetY = trigger.walkOutY * tileSize;
                    forcedWalk.direction = null;

                    // Calculate duration based on distance if not manually set
                    const dx = forcedWalk.targetX - player.x;
                    const dy = forcedWalk.targetY - player.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const walkSpeed = forcedWalk.speed; // pixels per frame
                    const framesNeeded = dist / walkSpeed;
                    forcedWalk.duration = (framesNeeded / 60) * 1000; // Convert frames to ms

                    // Set initial facing
                    if (Math.abs(dx) > Math.abs(dy)) {
                        player.facing = dx > 0 ? 'right' : 'left';
                    } else {
                        player.facing = dy > 0 ? 'down' : 'up';
                    }
                } else {
                    // Walk in direction for duration
                    forcedWalk.targetX = null;
                    forcedWalk.targetY = null;
                    forcedWalk.direction = trigger.walkDirection;
                    forcedWalk.duration = trigger.walkDuration * 1000; // Convert to ms
                    player.facing = trigger.walkDirection;
                }
            } else if (fadeDuration === 0) {
                // Instant transition (no fade)
                executeMapTransition(trigger);
            } else {
                // Fade transition
                transitionPhase = 'fadeOut';
                transitionAlpha = 0;
            }
        }

        // Execute the actual map switch
        function executeMapTransition(trigger) {
            // Locked door? Require the key item in inventory; consume it (or not) per config.
            const _lockIdx = (trigger.lockItemIndex !== undefined) ? trigger.lockItemIndex : -1;
            if (_lockIdx >= 0) {
                if (!hasInventoryItem(_lockIdx)) {
                    const _kn = (itemsData[_lockIdx] && itemsData[_lockIdx].name) || 'a key';
                    showGameToast('🔒 Locked — needs ' + _kn);
                    isTransitioning = false;
                    pendingTransition = null;
                    return;
                }
                if (trigger.lockConsume !== false) consumeInventoryItem(_lockIdx, 1);
            }
            console.log('=== DOOR TRANSITION ===');
            console.log('Door ' + trigger.doorNumber + ' used: "' + trigger.mapName + '" -> "' + trigger.targetMap + '"');
            console.log('Player spawning at tile (' + trigger.targetX + ', ' + trigger.targetY + ')');

            const targetMapData = mapsData[trigger.targetMap];
            if (!targetMapData) {
                console.error('[GAME TRIGGER DEBUG] Target map not found:', trigger.targetMap);
                console.log('[GAME TRIGGER DEBUG] Available maps:', Object.keys(mapsData));
                isTransitioning = false;
                pendingTransition = null;
                return;
            }

            // Switch to new map
            currentGameMap = trigger.targetMap;
            onMapEnter(currentGameMap);  // Track for quest conditions

            // Stop all ambient sounds from previous map
            Object.keys(ambientSounds).forEach(key => {
                try {
                    if (ambientSounds[key]?.useHtmlAudio && ambientSounds[key].audio) {
                        ambientSounds[key].audio.pause();
                        ambientSounds[key].audio.src = ''; // Release memory
                    } else if (ambientSounds[key]?.source) {
                        ambientSounds[key].source.stop();
                    }
                } catch (e) { /* ignore */ }
            });
            ambientSounds = {}; // Clear all ambient sounds
            console.log('[SOUND] Cleared ambient sounds for map transition');

            // Load the new map data
            // Note: tileCollisions, collisionMasks, tileSplitLines, tileSplitLineFlipped are GLOBAL
            // (per-tileset, not per-map) - they persist across map transitions
            layers = targetMapData.layers || layers;
            mapCols = targetMapData.mapCols || mapCols;
            mapRows = targetMapData.mapRows || mapRows;

            // Rebuild animated tile registry for new map
            buildAnimatedTileRegistry();

            // Position player at target spawn
            const tileSize = gridSize * TILE_SCALE;

            player.x = trigger.targetX * tileSize;
            player.y = trigger.targetY * tileSize;
            console.log('Player pixel position: (' + player.x + ', ' + player.y + ')');

            // Reset camera to center on player
            camera.x = player.x - canvas.width / 2;
            camera.y = player.y - canvas.height / 2;

            // Start fade in (or finish if instant)
            if (pendingTransition && pendingTransition.transitionStyle !== 'instant') {
                transitionPhase = 'fadeIn';
            } else {
                isTransitioning = false;
                pendingTransition = null;
            }
        }

        // Update transition animation
        function updateTransition(deltaTime) {
            if (!isTransitioning) return;

            // Get fade duration from trigger (default to 0.5 seconds)
            const fadeDuration = pendingTransition?.fadeDuration !== undefined ? pendingTransition.fadeDuration : 0.5;
            // Calculate fade speed (alpha change per frame at ~60fps)
            const fadeSpeed = fadeDuration > 0 ? (1 / (fadeDuration * 60)) : 1;

            if (transitionPhase === 'forceWalk') {
                // Update forced walking
                forcedWalk.elapsed += deltaTime;

                // Move player toward walk-out destination (if set) or in direction
                const moveSpeed = forcedWalk.speed;

                if (forcedWalk.targetX !== null && forcedWalk.targetY !== null) {
                    // Walk toward specific destination
                    const dx = forcedWalk.targetX - player.x;
                    const dy = forcedWalk.targetY - player.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > moveSpeed) {
                        // Move toward target
                        player.x += (dx / dist) * moveSpeed;
                        player.y += (dy / dist) * moveSpeed;

                        // Set facing based on dominant direction
                        if (Math.abs(dx) > Math.abs(dy)) {
                            player.facing = dx > 0 ? 'right' : 'left';
                        } else {
                            player.facing = dy > 0 ? 'down' : 'up';
                        }
                    } else {
                        // Reached destination
                        player.x = forcedWalk.targetX;
                        player.y = forcedWalk.targetY;
                        forcedWalk.elapsed = forcedWalk.duration; // Force completion
                    }
                } else {
                    // Walk in direction for duration
                    switch (forcedWalk.direction) {
                        case 'up':
                            player.y -= moveSpeed;
                            player.facing = 'up';
                            break;
                        case 'down':
                            player.y += moveSpeed;
                            player.facing = 'down';
                            break;
                        case 'left':
                            player.x -= moveSpeed;
                            player.facing = 'left';
                            break;
                        case 'right':
                            player.x += moveSpeed;
                            player.facing = 'right';
                            break;
                    }
                }

                // Animate walking - update frame timer
                player.isMoving = true;
                player.frameTimer++;
                const walkAnimKey = 'walk' + player.direction.charAt(0).toUpperCase() + player.direction.slice(1);
                const walkFps = playerAnimFpsList[walkAnimKey] || 8;
                const walkFrameDelay = Math.max(1, Math.round(60 / walkFps));
                if (player.frameTimer >= walkFrameDelay) {
                    player.frameTimer = 0;
                    player.frame = player.frame + 1; // uncapped; draw uses % frames.length so >4-frame walks play fully
                }

                // Check if walk duration is complete
                if (forcedWalk.elapsed >= forcedWalk.duration) {
                    forcedWalk.active = false;
                    player.isMoving = false;

                    // Move to fade phase (or instant if fadeDuration is 0)
                    if (fadeDuration === 0) {
                        executeMapTransition(pendingTransition);
                    } else {
                        transitionPhase = 'fadeOut';
                        transitionAlpha = 0;
                    }
                }
            } else if (transitionPhase === 'fadeOut') {
                transitionAlpha += fadeSpeed;
                if (transitionAlpha >= 1) {
                    transitionAlpha = 1;
                    // Check if this is an external door navigation
                    if (pendingExternalUrl) {
                        // Open tavern in new tab instead of navigating
                        tavernWindow = window.open(pendingExternalUrl, '_blank');
                        inTavernMode = true;
                        pendingExternalUrl = null;
                        transitionPhase = 'tavern'; // Stay on black screen
                        return;
                    }
                    executeMapTransition(pendingTransition);
                }
            } else if (transitionPhase === 'fadeIn') {
                transitionAlpha -= fadeSpeed;
                if (transitionAlpha <= 0) {
                    transitionAlpha = 0;
                    transitionPhase = 'none';
                    isTransitioning = false;

                    // Restore door tiles on source map (close the door after transition)
                    if (pendingTransition && pendingTransition.animTiles && pendingTransition.animTiles.length > 0) {
                        const sourceMapName = pendingTransition.mapName;
                        const sourceMapData = mapsData[sourceMapName];
                        if (sourceMapData && sourceMapData.layers) {
                            console.log('[DOOR ANIM] Restoring', pendingTransition.animTiles.length, 'tiles on', sourceMapName, '(closing door)');
                            pendingTransition.animTiles.forEach(change => {
                                if (!sourceMapData.layers[change.layer]) return;
                                if (!sourceMapData.layers[change.layer][change.y]) {
                                    sourceMapData.layers[change.layer][change.y] = [];
                                }
                                sourceMapData.layers[change.layer][change.y][change.x] = change.before;
                            });
                        }
                    }

                    pendingTransition = null;
                }
            }
        }

        // Draw transition overlay
        function drawTransitionOverlay() {
            if (transitionAlpha > 0 || inTavernMode) {
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Show tavern message when in tavern mode
                if (inTavernMode) {
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 24px "Press Start 2P", monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText("YOU ARE IN THE TAVERN", canvas.width / 2, canvas.height / 2 - 30);
                    ctx.font = '12px "Press Start 2P", monospace';
                    ctx.fillStyle = '#888';
                    ctx.fillText("( DO NOT CLOSE THIS TAB )", canvas.width / 2, canvas.height / 2 + 20);
                    ctx.fillText("RETURN THROUGH THE BLUE DOOR", canvas.width / 2, canvas.height / 2 + 50);
                }
            }
        }

        // Listen for focus to detect return from tavern
        window.addEventListener('focus', () => {
            if (inTavernMode) {
                // Check if tavern window was closed
                if (!tavernWindow || tavernWindow.closed) {
                    inTavernMode = false;

                    // Spawn player at return point
                    const returnInfoStr = localStorage.getItem('externalDoorReturn');
                    if (returnInfoStr) {
                        try {
                            const returnInfo = JSON.parse(returnInfoStr);
                            const tileSize = gridSize * TILE_SCALE;

                            // Switch map if needed
                            if (returnInfo.map && returnInfo.map !== currentGameMap) {
                                currentGameMap = returnInfo.map;
                                const mapData = mapsData[returnInfo.map];
                                if (mapData) {
                                    layers = mapData.layers || [];
                                    triggers = mapData.triggers || [];
                                    buildAnimatedTileRegistry(); // Rebuild for new map
                                }
                            }

                            // Move player to return position
                            player.x = returnInfo.x * tileSize + tileSize / 2;
                            player.y = returnInfo.y * tileSize + tileSize / 2;
                            console.log('[TAVERN RETURN] Spawned at:', player.x, player.y);

                            // Clear the return info
                            localStorage.removeItem('externalDoorReturn');
                        } catch (e) {
                            console.error('[TAVERN RETURN] Error:', e);
                        }
                    }

                    transitionPhase = 'fadeIn';
                    transitionAlpha = 1;
                }
            }
        });
