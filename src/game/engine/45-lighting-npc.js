        // === LIGHTING SYSTEM ===
        // Wave 8: removed dead shadow const for currentMapName; live map is currentGameMap.
        const lightingSettingsData = projectData.lightingSettings || {
            playerLight: false,
            playerLightRadius: 4
        };
        // Use outer scope pointLights/polyLights for live sync
        pointLights = projectData.pointLights || {};
        polyLights = projectData.polyLights || [];
        console.log('[INIT] Loaded polyLights:', polyLights.length, polyLights);
        const TIME_PRESETS = {
            dawn:  { r: 0, g: 0, b: 20, a: 0.45 },
            day:   { r: 0, g: 0, b: 0, a: 0 },
            dusk:  { r: 0, g: 0, b: 20, a: 0.55 },
            night: { r: 0, g: 0, b: 20, a: 0.95 }
        };

        // Day/Night cycle system
        let dayCycleEnabled = false;
        let dayLength = 60; // seconds for full cycle (1 min default)
        let cycleTime = 0;  // current position in cycle (0-1)
        let lastCycleUpdate = Date.now();
        let currentLighting = { r: 0, g: 0, b: 0, a: 0 }; // interpolated values
        let manualDarkness = 0; // 0-100, used when cycle is off

        // playerShadowWidth, playerShadowHeight, playerShadowYOffset, playerNoShadow
        // are declared earlier (~line 24072) and loaded from character data

        // === NPC SYSTEM ===
        // Use outer scope variables for live sync
        npcs = projectData.npcs || [];
        placedNpcs = projectData.placedNpcs || [];
        npcImages = [];
        // gridSize is already set from projectData above

        // Migrate old collisionMask/collisionBox to collisionInsets (backwards compatibility)
        npcs.forEach(npc => {
            if (npc && !npc.collisionInsets) {
                const frameW = npc.frameWidth || 32;
                const frameH = npc.frameHeight || 32;
                if (npc.collisionBox) {
                    // Migrate from old collisionBox format
                    npc.collisionInsets = {
                        top: npc.collisionBox.y || 0,
                        bottom: Math.max(0, frameH - (npc.collisionBox.y || 0) - (npc.collisionBox.height || frameH)),
                        left: npc.collisionBox.x || 0,
                        right: Math.max(0, frameW - (npc.collisionBox.x || 0) - (npc.collisionBox.width || frameW))
                    };
                } else if (npc.collisionMask) {
                    // Migrate from very old collisionMask format
                    let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
                    for (let py = 0; py < npc.collisionMask.length; py++) {
                        if (!npc.collisionMask[py]) continue;
                        for (let px = 0; px < npc.collisionMask[py].length; px++) {
                            if (npc.collisionMask[py][px] === 1) {
                                minX = Math.min(minX, px);
                                maxX = Math.max(maxX, px);
                                minY = Math.min(minY, py);
                                maxY = Math.max(maxY, py);
                            }
                        }
                    }
                    if (minX !== Infinity) {
                        npc.collisionInsets = {
                            top: minY,
                            bottom: Math.max(0, frameH - maxY - 1),
                            left: minX,
                            right: Math.max(0, frameW - maxX - 1)
                        };
                    }
                }
            }
        });

        // Ensure all placed NPCs have UIDs (for backwards compatibility with older saves)
        placedNpcs.forEach((npc, i) => {
            if (!npc.uid) {
                npc.uid = 'npc_' + npc.npcIndex + '_' + i + '_' + Date.now();
            }
        });

        // Load NPC sprites (counted in imagesToLoad)
        npcs.forEach((npc, i) => {
            if (npc && npc.spriteData) {
                const img = new Image();
                img.onload = () => {
                    console.log('NPC sprite loaded:', npc.name, '(' + (imagesLoaded + 1) + '/' + imagesToLoad + ')');
                    imagesLoaded++;
                    checkAllImagesLoaded();
                };
                img.onerror = () => {
                    console.error('Failed to load NPC sprite:', npc.name);
                    imagesLoaded++;
                    checkAllImagesLoaded();
                };
                img.src = npc.spriteData;
                npcImages[i] = img;
            }
        });

        // NPC runtime state for each placed NPC
        npcRuntimeState = placedNpcs.map((placed, i) => createNpcRuntimeState(placed));

        // Helper function to create NPC runtime state (also used by live sync)
        function createNpcRuntimeState(placed) {
            return {
                // Position (in pixels)
                x: placed.x * gridSize,
                y: placed.y * gridSize,
                // Path following
                currentWaypoint: 0,
                pathDirection: 1, // 1 = forward, -1 = backward (for non-loop paths)
                // Animation
                direction: 'down',
                frame: 0,
                frameTimer: 0,
                // Movement
                moving: false,
                targetX: placed.x * gridSize,
                targetY: placed.y * gridSize,
                // Trigger state
                triggered: placed.trigger === 'loop', // Loop starts immediately
                waitTimer: 0,
                // Waypoint properties
                idleUntil: 0, // Timestamp when idle ends
                waypointAnimation: '', // Custom animation at waypoint
                // Enemy AI state
                aiState: 'idle', // 'idle', 'chase', 'attack', 'recover', 'return'
                aggroTimer: 0, // Time player has been in/out of vision
                attackCooldown: 0, // Time until can attack again
                returnX: placed.x * gridSize, // Position to return to when de-aggro
                returnY: placed.y * gridSize,
                lastAttackTime: 0 // Timestamp of last attack
            };
        }

        console.log('NPCs loaded:', npcs.length, 'Placed:', placedNpcs.length);

        // Cycle phases: long night with peak darkness held for 50% of each night period
        // Night1: 0-30% (peak 0-15%), EarlyMorn: 30-38%, Dawn: 38-45%, Day: 45-55%,
        // Afternoon: 55-62%, Dusk: 62-70%, Night2: 70-100% (peak 85-100%)
        function updateDayCycle() {
            if (!dayCycleEnabled) return;

            const now = Date.now();
            const delta = (now - lastCycleUpdate) / 1000; // seconds
            lastCycleUpdate = now;

            // Advance cycle
            cycleTime += delta / dayLength;
            if (cycleTime >= 1) cycleTime -= 1;

            // Determine current phase and interpolation
            let fromPreset, toPreset, t, phaseName;

            if (cycleTime < 0.15) {
                // Peak Night 1 (0-15%) - full darkness
                fromPreset = TIME_PRESETS.night;
                toPreset = TIME_PRESETS.night;
                t = 0;
                phaseName = 'Night';
            } else if (cycleTime < 0.30) {
                // Late Night (15-30%) - very slowly lightening
                fromPreset = TIME_PRESETS.night;
                toPreset = TIME_PRESETS.night;
                t = (cycleTime - 0.15) / 0.15 * 0.1; // barely lighten
                phaseName = 'Late Night';
            } else if (cycleTime < 0.38) {
                // Early Morning (30-38%) - still very dark
                fromPreset = TIME_PRESETS.night;
                toPreset = TIME_PRESETS.dawn;
                t = (cycleTime - 0.30) / 0.08 * 0.4;
                phaseName = 'Early Morn';
            } else if (cycleTime < 0.45) {
                // Dawn (38-45%)
                fromPreset = TIME_PRESETS.dawn;
                toPreset = TIME_PRESETS.day;
                t = (cycleTime - 0.38) / 0.07;
                phaseName = 'Dawn';
            } else if (cycleTime < 0.55) {
                // Day (45-55%)
                fromPreset = TIME_PRESETS.day;
                toPreset = TIME_PRESETS.day;
                t = 0;
                phaseName = 'Day';
            } else if (cycleTime < 0.62) {
                // Afternoon (55-62%)
                fromPreset = TIME_PRESETS.day;
                toPreset = TIME_PRESETS.dusk;
                t = (cycleTime - 0.55) / 0.07;
                phaseName = 'Afternoon';
            } else if (cycleTime < 0.70) {
                // Dusk (62-70%)
                fromPreset = TIME_PRESETS.dusk;
                toPreset = TIME_PRESETS.night;
                t = (cycleTime - 0.62) / 0.08;
                phaseName = 'Dusk';
            } else if (cycleTime < 0.85) {
                // Early Night (70-85%) - getting darker
                fromPreset = TIME_PRESETS.night;
                toPreset = TIME_PRESETS.night;
                t = 0;
                phaseName = 'Early Night';
            } else {
                // Peak Night 2 (85-100%) - full darkness
                fromPreset = TIME_PRESETS.night;
                toPreset = TIME_PRESETS.night;
                t = 0;
                phaseName = 'Night';
            }

            // Smooth interpolation
            currentLighting.r = Math.round(fromPreset.r + (toPreset.r - fromPreset.r) * t);
            currentLighting.g = Math.round(fromPreset.g + (toPreset.g - fromPreset.g) * t);
            currentLighting.b = Math.round(fromPreset.b + (toPreset.b - fromPreset.b) * t);
            currentLighting.a = fromPreset.a + (toPreset.a - fromPreset.a) * t;

            // Update display
            const timeDisplay = document.getElementById('timeDisplay');
            if (timeDisplay) {
                timeDisplay.textContent = 'Time: ' + phaseName + ' (' + Math.round(cycleTime * 100) + '%)';
            }
        }

        console.log('=== LIGHTING DATA LOADED ===');
        console.log('Lighting settings:', lightingSettingsData);
        console.log('Point lights:', Object.keys(pointLights).length);

        // === NPC UPDATE FUNCTION ===
        function updateNPCs() {
            // Use for loop instead of forEach to avoid creating closure every frame (GC pressure)
            for (let i = 0; i < placedNpcs.length; i++) {
                const placed = placedNpcs[i];
                // Only update NPCs on current map
                if (placed.mapName && placed.mapName !== currentGameMap) continue;

                const state = npcRuntimeState[i];
                if (!state) continue;

                // Skip movement if NPC is paused for dialog
                if (state._dialogPaused) {
                    state.moving = false;
                    continue;
                }

                const npc = npcs[placed.npcIndex];
                if (!npc) continue;

                const path = placed.path || [];
                const speed = (placed.speed || 3) * 0.5; // Convert to pixel speed

                // Check trigger conditions
                if (!state.triggered) {
                    if (placed.trigger === 'interact') {
                        // Triggered by player attack - check if player is attacking nearby
                        if (player.attacking) {
                            const dx = player.x - state.x, dy = player.y - state.y;
                            const distSq = dx * dx + dy * dy;
                            const triggerRadiusSq = (gridSize * 2) * (gridSize * 2);
                            if (distSq < triggerRadiusSq) {
                                state.triggered = true;
                            }
                        }
                    } else if (placed.trigger === 'timeDay') {
                        // Only active during day
                        state.triggered = dayCycleEnabled && cycleTime > 0.38 && cycleTime < 0.70;
                    } else if (placed.trigger === 'timeNight') {
                        // Only active during night
                        state.triggered = dayCycleEnabled && (cycleTime < 0.38 || cycleTime > 0.70);
                    }
                }

                // Reset trigger for time-based when condition no longer met
                if (placed.trigger === 'timeDay' && state.triggered) {
                    if (!dayCycleEnabled || cycleTime < 0.38 || cycleTime > 0.70) {
                        state.triggered = false;
                        state.currentWaypoint = 0;
                    }
                }
                if (placed.trigger === 'timeNight' && state.triggered) {
                    if (!dayCycleEnabled || (cycleTime > 0.38 && cycleTime < 0.70)) {
                        state.triggered = false;
                        state.currentWaypoint = 0;
                    }
                }

                // === ENEMY AI STATE MACHINE ===
                if (placed.isEnemy && !state.dead) {
                    const visionRadius = (placed.visionRadius || 5) * gridSize * TILE_SCALE;
                    const attackRange = (placed.attackRange || 2) * gridSize * TILE_SCALE;
                    const chaseSpeed = (placed.chaseSpeed || 4) * TILE_SCALE * 0.5;
                    const attackMode = placed.attackMode || 'touch';
                    const damage = placed.damage || 10;
                    const cooldownTime = (placed.attackCooldown || 1) * 60; // Convert seconds to frames
                    const lungeSpeed = (placed.lungeSpeed || 8) * TILE_SCALE * 0.5;

                    // NPC state uses unscaled coords, player uses scaled - convert NPC to scaled
                    const npcScaledX = state.x * TILE_SCALE;
                    const npcScaledY = state.y * TILE_SCALE;

                    // Calculate squared distance to player (both in scaled coordinates now)
                    // Use squared distances for comparisons to avoid expensive sqrt
                    const dxToPlayer = player.x - npcScaledX;
                    const dyToPlayer = player.y - npcScaledY;
                    const distToPlayerSq = dxToPlayer * dxToPlayer + dyToPlayer * dyToPlayer;

                    // Pre-compute squared radii for comparisons
                    const visionRadiusSq = visionRadius * visionRadius;
                    const attackRangeSq = attackRange * attackRange;

                    // Initialize AI state if not set
                    if (!state.aiState) state.aiState = 'idle';
                    if (state.returnX === undefined) state.returnX = state.x;
                    if (state.returnY === undefined) state.returnY = state.y;
                    if (state.damageCooldown === undefined) state.damageCooldown = 0;

                    // Decrement damage cooldown
                    if (state.damageCooldown > 0) state.damageCooldown--;

                    // NPC scale affects hitbox size
                    const npcScale = placed.scale || 1;

                    // Contact hitbox size (scales with NPC)
                    const npcW = gridSize * TILE_SCALE * 0.7 * npcScale;
                    const npcH = gridSize * TILE_SCALE * 0.7 * npcScale;

                    // Get slowdown settings from placed NPC
                    const slowdownPercent = placed.slowdownPercent !== undefined ? placed.slowdownPercent : 50;
                    const slowdownDuration = placed.slowdownDuration !== undefined ? placed.slowdownDuration : 0.5;
                    const slowdownFrames = Math.floor(slowdownDuration * 60); // Convert to frames

                    // Check for contact damage (Touch mode or during Lunge)
                    const touchDistance = gridSize * TILE_SCALE * 0.6 * npcScale;
                    const touchDistanceSq = touchDistance * touchDistance;
                    if (distToPlayerSq < touchDistanceSq && state.damageCooldown <= 0) {
                        if (attackMode === 'touch' || state.aiState === 'lunge') {
                            damagePlayer(damage);
                            state.damageCooldown = cooldownTime;
                            // Trigger attack animation — size the window so it plays the attack anim
                            // ONCE at the NPC's configured FPS (matches walk/idle), not a fixed 0.5s.
                            const _atkDef = npcs[placed.npcIndex];
                            const _atkKey = { down: 'attackDown', up: 'attackUp', left: 'attackLeft', right: 'attackRight' }[cardinalOf(state.direction)] || 'attackDown';
                            const _atkLen = (_atkDef && _atkDef.animations && _atkDef.animations[_atkKey]) ? _atkDef.animations[_atkKey].length : 0;
                            const _atkFps = placed.animSpeed || (_atkDef && _atkDef.fps) || 8;
                            const _atkTicks = Math.max(1, Math.round(60 / _atkFps));
                            state.attackAnimTimer = _atkLen > 0 ? _atkLen * _atkTicks : 30;
                            state.attackAnimFrame = 0;
                            // Trigger post-attack slowdown
                            state.slowdownTimer = slowdownFrames;
                            if (attackMode === 'lunge' && state.aiState === 'lunge') {
                                state.aiState = 'recover';
                                state.attackCooldown = 0;
                            }
                        }
                    }

                    // Decrement attack animation timer
                    if (state.attackAnimTimer > 0) {
                        state.attackAnimTimer--;
                        state.attackAnimFrame++;
                    }
                    // Decrement slowdown timer
                    if (state.slowdownTimer > 0) {
                        state.slowdownTimer--;
                    }

                    // State machine transitions
                    switch (state.aiState) {
                        case 'idle':
                            // Check if player is in vision range (use squared distance)
                            if (distToPlayerSq <= visionRadiusSq) {
                                state.aiState = 'chase';
                                state.aggroTimer = 0;
                            }
                            break;

                        case 'chase':
                            // Check if player left vision range for too long (1.5x = 2.25x squared)
                            const deaggroRadiusSq = visionRadiusSq * 2.25;
                            if (distToPlayerSq > deaggroRadiusSq) {
                                state.aggroTimer++;
                                if (state.aggroTimer > 180) { // 3 seconds at 60fps
                                    // Patrol/loop enemies rejoin their path (resume from currentWaypoint);
                                    // others walk back to their spawn point.
                                    state.aiState = (placed.trigger === 'loop' && path.length > 0) ? 'idle' : 'return';
                                    state.aggroTimer = 0;
                                }
                            } else {
                                state.aggroTimer = 0;
                            }

                            // Lunge mode: start lunge when in attack range (use squared distance)
                            if (attackMode === 'lunge' && distToPlayerSq <= attackRangeSq && state.damageCooldown <= 0) {
                                state.aiState = 'lunge';
                                // Store target in unscaled coords (same as state.x/y)
                                state.lungeTargetX = player.x / TILE_SCALE;
                                state.lungeTargetY = player.y / TILE_SCALE;
                                state.lungeTimer = 0;
                            }
                            break;

                        case 'lunge':
                            // Dash toward the stored target position (both in unscaled coords)
                            const ldx = state.lungeTargetX - state.x;
                            const ldy = state.lungeTargetY - state.y;
                            const ldist = Math.hypot(ldx, ldy);
                            const unscaledLungeSpeed = lungeSpeed / TILE_SCALE;

                            state.lungeTimer++;

                            if (ldist > unscaledLungeSpeed && state.lungeTimer < 30) {
                                // Move toward lunge target at high speed
                                const lmoveX = (ldx / ldist) * unscaledLungeSpeed;
                                const lmoveY = (ldy / ldist) * unscaledLungeSpeed;

                                // Check collision (scale up position for collision check)
                                const scaledX = (state.x + lmoveX) * TILE_SCALE;
                                const scaledY = (state.y + lmoveY) * TILE_SCALE;
                                if (!checkCollision(scaledX, scaledY, npcW, npcH)) {
                                    state.x += lmoveX;
                                    state.y += lmoveY;
                                    state.moving = true;
                                } else {
                                    // Hit a wall, end lunge
                                    state.aiState = 'recover';
                                    state.attackCooldown = 0;
                                }

                                // Set direction
                                state.direction = dir8FromVector(ldx, ldy, hasDiagonalAnims(npc.animations)) || state.direction;
                            } else {
                                // Lunge complete or timeout
                                state.aiState = 'recover';
                                state.attackCooldown = 0;
                            }
                            break;

                        case 'recover':
                            // Recovery period after attack
                            state.attackCooldown++;
                            state.moving = false;
                            if (state.attackCooldown > 45) { // 0.75 second recovery
                                if (distToPlayerSq <= visionRadiusSq) {
                                    state.aiState = 'chase';
                                } else {
                                    // Patrol/loop enemies rejoin their path; others return to spawn.
                                    state.aiState = (placed.trigger === 'loop' && path.length > 0) ? 'idle' : 'return';
                                }
                                state.attackCooldown = 0;
                            }
                            break;

                        case 'return':
                            // Check if back at start position (use squared distance)
                            const dxHome = state.returnX - state.x;
                            const dyHome = state.returnY - state.y;
                            const distToHomeSq = dxHome * dxHome + dyHome * dyHome;
                            const chaseSpeedSq = chaseSpeed * chaseSpeed;
                            if (distToHomeSq < chaseSpeedSq) {
                                state.x = state.returnX;
                                state.y = state.returnY;
                                state.aiState = 'idle';
                            }
                            // If player gets close again while returning, chase (0.75^2 = 0.5625)
                            const reaggroRadiusSq = visionRadiusSq * 0.5625;
                            if (distToPlayerSq <= reaggroRadiusSq) {
                                state.aiState = 'chase';
                            }
                            break;
                    }

                    // Handle movement based on AI state (chase and return)
                    if (state.aiState === 'chase' || state.aiState === 'return') {
                        let targetX, targetY;
                        if (state.aiState === 'chase') {
                            // Convert player position to unscaled coords
                            targetX = player.x / TILE_SCALE;
                            targetY = player.y / TILE_SCALE;
                        } else {
                            // Return position is already in unscaled coords
                            targetX = state.returnX;
                            targetY = state.returnY;
                        }

                        const dx = targetX - state.x;
                        const dy = targetY - state.y;
                        const dist = Math.hypot(dx, dy);

                        // Convert chase speed to unscaled coords
                        // Apply slowdown if timer is active
                        let effectiveSpeed = chaseSpeed;
                        if (state.slowdownTimer > 0) {
                            effectiveSpeed = chaseSpeed * (1 - slowdownPercent / 100);
                        }
                        const unscaledChaseSpeed = effectiveSpeed / TILE_SCALE;

                        if (dist > unscaledChaseSpeed) {
                            // Normalize movement (in unscaled coords)
                            let moveX = (dx / dist) * unscaledChaseSpeed;
                            let moveY = (dy / dist) * unscaledChaseSpeed;

                            // Scale up for collision checks
                            const newScaledX = (state.x + moveX) * TILE_SCALE;
                            const newScaledY = (state.y + moveY) * TILE_SCALE;

                            // Collision-aware movement - try full move, then axis by axis
                            if (!checkCollision(newScaledX, newScaledY, npcW, npcH) &&
                                !checkNPCPlayerCollision(newScaledX, newScaledY, i)) {
                                state.x += moveX;
                                state.y += moveY;
                                state.moving = true;
                            } else {
                                // Try X-only movement
                                const xOnlyScaledX = (state.x + moveX) * TILE_SCALE;
                                const xOnlyScaledY = state.y * TILE_SCALE;
                                if (Math.abs(moveX) > 0.1 &&
                                    !checkCollision(xOnlyScaledX, xOnlyScaledY, npcW, npcH) &&
                                    !checkNPCPlayerCollision(xOnlyScaledX, xOnlyScaledY, i)) {
                                    state.x += moveX;
                                    state.moving = true;
                                }
                                // Try Y-only movement
                                else {
                                    const yOnlyScaledX = state.x * TILE_SCALE;
                                    const yOnlyScaledY = (state.y + moveY) * TILE_SCALE;
                                    if (Math.abs(moveY) > 0.1 &&
                                        !checkCollision(yOnlyScaledX, yOnlyScaledY, npcW, npcH) &&
                                        !checkNPCPlayerCollision(yOnlyScaledX, yOnlyScaledY, i)) {
                                        state.y += moveY;
                                        state.moving = true;
                                    } else {
                                        state.moving = false;
                                    }
                                }
                            }

                            // Set direction based on target (8-way when the NPC sprite has diagonals)
                            state.direction = dir8FromVector(dx, dy, hasDiagonalAnims(npc.animations)) || state.direction;
                        } else {
                            state.moving = false;
                        }
                    } else if (state.aiState === 'idle' || state.aiState === 'recover') {
                        state.moving = false;
                    }

                    // Update animation for enemy (only when not idle - idle uses normal path anim)
                    if (state.aiState !== 'idle') {
                        state.frameTimer++;
                        const fps = placed.animSpeed || npc.fps || 8;
                        const animSpeed = Math.max(1, Math.round(60 / fps));
                        if (state.frameTimer >= animSpeed) {
                            state.frameTimer = 0;
                            state.frame = state.frame + 1; // uncapped; draw does % anim.length so any frame count works
                        }
                        continue; // Skip normal path movement when chasing/attacking/returning
                    }
                    // If idle, fall through to normal path movement (patrol behavior)
                }

                // Skip movement if not triggered or no path
                if (!state.triggered || path.length === 0) {
                    state.moving = false;
                    // Still animate idle NPCs even with no path
                    state.frameTimer++;
                    const fps = placed.animSpeed || npc.fps || 8;
                    const animSpeed = Math.max(1, Math.round(60 / fps));
                    if (state.frameTimer >= animSpeed) {
                        state.frameTimer = 0;
                        state.frame = state.frame + 1; // uncapped; draw does % anim.length
                    }
                    continue;
                }

                // Get current waypoint target
                const waypoint = path[state.currentWaypoint];
                if (!waypoint) {
                    // Reset to start
                    state.currentWaypoint = 0;
                    continue;
                }

                state.targetX = waypoint.x * gridSize;
                state.targetY = waypoint.y * gridSize;

                // Calculate direction to target
                const dx = state.targetX - state.x;
                const dy = state.targetY - state.y;
                const dist = Math.hypot(dx, dy);

                // Check if currently idling at a waypoint
                if (state.idleUntil > 0) {
                    if (performance.now() < state.idleUntil) {
                        // Still idling - don't move, but keep animating
                        state.moving = false;
                        // Update animation while idling (use per-NPC animation speed)
                        state.frameTimer++;
                        const idleFps = placed.animSpeed || npc.fps || 8;
                        const idleAnimSpeed = Math.max(1, Math.round(60 / idleFps));
                        if (state.frameTimer >= idleAnimSpeed) {
                            state.frameTimer = 0;
                            state.frame = state.frame + 1; // uncapped; draw does % anim.length so any frame count works
                        }
                        // Keep the linked prop looping for the whole stop (it self-completes via updateAnimPropInteractions)
                        if (state._triggerKey) {
                            const ps = interactivePropStates[state._triggerKey];
                            if (ps && !ps.animating) { ps.used = false; ps.animating = true; ps.frame = 0; ps.timer = 0; if (animPropFrameTimers[state._triggerKey]) animPropFrameTimers[state._triggerKey].frame = 0; }
                        }
                        continue;
                    } else {
                        // Idle complete - stop the linked prop and advance to next waypoint
                        if (state._triggerKey) {
                            const ps = interactivePropStates[state._triggerKey];
                            if (ps) { ps.animating = false; ps.frame = 0; if (animPropFrameTimers[state._triggerKey]) animPropFrameTimers[state._triggerKey].frame = 0; }
                            state._triggerKey = null;
                        }
                        state.idleUntil = 0;
                        state.waypointAnimation = '';
                        state.currentWaypoint++;

                        // Check if path complete after advancing
                        if (state.currentWaypoint >= path.length) {
                            if (placed.trigger === 'loop') {
                                state.currentWaypoint = 0;
                                state.x = placed.x * gridSize;
                                state.y = placed.y * gridSize;
                            } else {
                                state.triggered = false;
                                state.currentWaypoint = 0;
                                state.x = placed.x * gridSize;
                                state.y = placed.y * gridSize;
                            }
                        }
                        continue; // Start moving to next waypoint on next frame
                    }
                }

                if (dist < speed) {
                    // Reached waypoint
                    state.x = state.targetX;
                    state.y = state.targetY;

                    // Check for waypoint properties (idle time, animation)
                    const currentWp = path[state.currentWaypoint];
                    let idleTime = currentWp?.idleTime || 0;
                    const wpAnim = currentWp?.animation || '';

                    // If animation is set but not "walk", ensure minimum idle time
                    if (wpAnim && wpAnim !== 'walk' && wpAnim !== '' && idleTime <= 0) {
                        idleTime = 2; // Default 2 seconds if animation set but no duration
                    }

                    if (idleTime > 0 && state.idleUntil === 0) {
                        // Start idling/performing action at this waypoint
                        state.idleUntil = performance.now() + (idleTime * 1000);
                        state.waypointAnimation = wpAnim;
                        state.moving = false;
                        // NPC-triggered interactive prop: start it animating (re-fires each lap, gives no item)
                        if (currentWp.triggerProp) {
                            const tp = currentWp.triggerProp;
                            const pkey = tp.x + ',' + tp.y + ',' + tp.layer;
                            const ps = interactivePropStates[pkey] || (interactivePropStates[pkey] = { used: false, animating: false, frame: 0, gaveItem: false });
                            ps.used = false; ps.animating = true; ps.frame = 0; ps.timer = 0; // re-fire; ignore the player one-time flag
                            if (animPropFrameTimers[pkey]) animPropFrameTimers[pkey].frame = 0;
                            state._triggerKey = pkey; // keep it looping while stopped here; cleared on leave
                        }
                        // Don't advance waypoint - will advance after idle completes
                        continue;
                    }

                    state.currentWaypoint++;

                    // Check if path complete
                    if (state.currentWaypoint >= path.length) {
                        if (placed.trigger === 'loop') {
                            // Return to start position, then repeat path
                            state.currentWaypoint = 0;
                            state.x = placed.x * gridSize;
                            state.y = placed.y * gridSize;
                        } else {
                            // One-shot trigger - stop and reset
                            state.triggered = false;
                            state.currentWaypoint = 0;
                            state.x = placed.x * gridSize;
                            state.y = placed.y * gridSize;
                        }
                    }
                    state.moving = false;
                } else {
                    // Move towards waypoint
                    const moveX = (dx / dist) * speed;
                    const moveY = (dy / dist) * speed;
                    const newX = state.x + moveX;
                    const newY = state.y + moveY;

                    // Check if NPC would collide with player
                    if (checkNPCPlayerCollision(newX, newY, i)) {
                        // Stop and wait for player to move
                        state.moving = false;
                        // Still face the direction of movement
                        state.direction = dir8FromVector(dx, dy, hasDiagonalAnims(npc.animations)) || state.direction;
                    } else {
                        // No collision, proceed with movement
                        state.moving = true;
                        state.x = newX;
                        state.y = newY;

                        // Set direction based on movement
                        state.direction = dir8FromVector(dx, dy, hasDiagonalAnims(npc.animations)) || state.direction;
                    }
                }

                // Update animation using per-NPC animation speed
                state.frameTimer++;
                const fps = placed.animSpeed || npc.fps || 8;
                const animSpeed = Math.max(1, Math.round(60 / fps)); // Convert fps to frame delay
                if (state.frameTimer >= animSpeed) {
                    state.frameTimer = 0;
                    state.frame = state.frame + 1; // uncapped; draw does % anim.length
                }
            }
        }

        // Offscreen canvas for lighting effects
        let lightCanvas = null;
        let lightCtx = null;

        // Flicker optimization - cache random values and update less frequently
        let flickerValues = {}; // key -> { value, lastUpdate }
        let lastFlickerUpdate = 0;
        const FLICKER_UPDATE_INTERVAL = 80; // ms between flicker updates (12.5 fps for flicker)

        function getFlickerValue(key, intensity = 0.1) {
            const now = performance.now();
            if (!flickerValues[key] || now - flickerValues[key].lastUpdate > FLICKER_UPDATE_INTERVAL) {
                flickerValues[key] = {
                    value: 1 - intensity / 2 + Math.random() * intensity,
                    lastUpdate: now
                };
            }
            return flickerValues[key].value;
        }

        // Audio context for playback
        let audioContext = null;
        let soundBuffers = {}; // soundIndex -> AudioBuffer
        let soundsDecoding = {}; // Track sounds currently being decoded
        let decodeQueue = []; // Queue of sounds waiting to decode
        let isDecoding = false; // Currently decoding a sound
        const DECODE_DELAY = 500; // ms between each decode (give iPad breathing room)
        let gameStartTime = 0; // Track when game started for sound delay
        const SOUND_STARTUP_DELAY = 1500; // Wait 1.5 seconds before starting ambient sounds

        // Walk sound timing
        let lastWalkSoundTime = 0;

        // Item pickup sound (hardcoded file)
        let pickupSoundBuffer = null;
        const PICKUP_SOUND_PATH = 'sounds/itempickupblkoop.mp3';

        // Load pickup sound when audio context is ready
        function loadPickupSound() {
            if (!audioContext || pickupSoundBuffer) return;
            fetch(PICKUP_SOUND_PATH)
                .then(r => r.arrayBuffer())
                .then(data => audioContext.decodeAudioData(data))
                .then(buffer => {
                    pickupSoundBuffer = buffer;
                    console.log('[SOUND] Pickup sound loaded');
                })
                .catch(e => console.warn('[SOUND] Could not load pickup sound:', e));
        }

        // Play pickup sound with pitch variation
        function playPickupSound() {
            if (!audioContext || !pickupSoundBuffer) return;
            const source = audioContext.createBufferSource();
            source.buffer = pickupSoundBuffer;
            // Pitch variation: 0.85 to 1.15 (±15%)
            source.playbackRate.value = 0.85 + Math.random() * 0.3;
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 0.6;
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            source.start();
        }

        // Ambient sounds currently playing
        let ambientSounds = {}; // "x,y" -> { source, gainNode, playing }

        // Debug flags
        let showLayers = false; // L key to toggle layer debug

        // Initialize audio context on first user interaction (LAZY - don't decode all sounds)
        function initAudio() {
            if (audioContext) {
                // iOS requires resume after user gesture
                if (audioContext.state === 'suspended') {
                    audioContext.resume();
                }
                return;
            }
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // iOS may start suspended - resume it
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
            console.log('Audio context initialized (lazy mode - sounds decode on first play)');
            console.log('Sounds available:', soundsData.length);
            console.log('Tile sounds:', Object.keys(tileSounds).length);
            console.log('Player sounds:', playerSoundsData);
            // Load hardcoded sounds
            loadPickupSound();
        }

        // Queue a sound for decoding (one at a time with delays for iPad)
        function decodeSound(idx, callback) {
            // Already decoded
            if (soundBuffers[idx]) {
                if (callback) callback(soundBuffers[idx]);
                return;
            }
            // Already in queue or decoding
            if (soundsDecoding[idx]) return;

            const sound = soundsData[idx];
            if (!sound || !sound.data) {
                console.warn('No sound data for index', idx);
                return;
            }

            // Mark as queued and add to queue
            soundsDecoding[idx] = true;
            decodeQueue.push({ idx, callback });
            processDecodeQueue();
        }

        // Process decode queue one at a time with delays
        function processDecodeQueue() {
            if (isDecoding || decodeQueue.length === 0) return;

            isDecoding = true;
            const { idx, callback } = decodeQueue.shift();
            const sound = soundsData[idx];

            // Use fetch with data URL for fully async base64 conversion (non-blocking)
            fetch(sound.data)
                .then(res => res.arrayBuffer())
                .then(audioBuffer => {
                    audioContext.decodeAudioData(audioBuffer, (buffer) => {
                        soundBuffers[idx] = buffer;
                        soundsDecoding[idx] = false;
                        console.log('Sound', idx, sound.name, 'decoded (' + decodeQueue.length + ' in queue)');
                        if (callback) callback(buffer);

                        // Wait before processing next sound
                        setTimeout(() => {
                            isDecoding = false;
                            processDecodeQueue();
                        }, DECODE_DELAY);
                    }, (err) => {
                        console.error('Failed to decode sound', idx, err);
                        soundsDecoding[idx] = false;
                        setTimeout(() => {
                            isDecoding = false;
                            processDecodeQueue();
                        }, DECODE_DELAY);
                    });
                })
                .catch(e => {
                    console.error('Error fetching sound', idx, ':', e.message);
                    soundsDecoding[idx] = false;
                    setTimeout(() => {
                        isDecoding = false;
                        processDecodeQueue();
                    }, DECODE_DELAY);
                });
        }

        // Play a sound with optional pitch and length variation (lazy decode on first play)
        function playSound(soundIndex, volume = 1, pitchVariation = 0, lengthVariation = 0) {
            if (!audioContext) {
                console.log('playSound: No audio context');
                return;
            }
            if (soundIndex < 0 || soundIndex >= soundsData.length) {
                return;
            }

            // Lazy decode: if buffer not ready, decode it first then play
            if (!soundBuffers[soundIndex]) {
                decodeSound(soundIndex, (buffer) => {
                    // Play after decode completes
                    playSoundBuffer(buffer, volume, pitchVariation, lengthVariation);
                });
                return;
            }

            return playSoundBuffer(soundBuffers[soundIndex], volume, pitchVariation, lengthVariation);
        }

        // Internal: play an already-decoded buffer
        function playSoundBuffer(buffer, volume, pitchVariation, lengthVariation = 0) {
            if (!buffer) return;

            const source = audioContext.createBufferSource();
            source.buffer = buffer;

            // Apply pitch variation (randomizes pitch each play)
            if (pitchVariation > 0) {
                source.playbackRate.value = 1 + (Math.random() - 0.5) * pitchVariation * 2;
            }

            const gainNode = audioContext.createGain();
            gainNode.gain.value = volume;

            source.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Apply length variation (randomly cuts off sound early)
            if (lengthVariation > 0) {
                const duration = buffer.duration;
                const minLength = Math.max(0.1, duration * (1 - lengthVariation));
                const actualLength = minLength + Math.random() * (duration - minLength);
                source.start(0, 0, actualLength);
            } else {
                source.start();
            }

            return { source, gainNode };
        }

        // Update ambient sounds based on player position with smooth fading
        function updateAmbientSounds() {
            if (!audioContext) return;

            // Delay ambient sounds on startup to prevent iPad crashes
            if (gameStartTime && Date.now() - gameStartTime < SOUND_STARTUP_DELAY) {
                return;
            }

            const tileSize = gridSize * TILE_SCALE;
            const playerTileX = Math.floor(player.x / tileSize);
            const playerTileY = Math.floor(player.y / tileSize);
            const fadeTime = 0.1; // Smooth transition time in seconds

            // Use for-in to avoid Object.keys() allocation
            for (const key in tileSounds) {
                // Filter by current map (keys are "mapName:x,y" or legacy "x,y")
                let sx, sy;
                const colonIdx = key.indexOf(':');
                if (colonIdx !== -1) {
                    // New format: "mapName:x,y" - avoid split() allocations
                    const mapName = key.substring(0, colonIdx);
                    if (mapName !== currentGameMap) continue; // Skip sounds on other maps
                    const coords = key.substring(colonIdx + 1);
                    const commaIdx = coords.indexOf(',');
                    sx = parseInt(coords.substring(0, commaIdx), 10);
                    sy = parseInt(coords.substring(commaIdx + 1), 10);
                } else {
                    // Legacy format: "x,y" (treat as main map)
                    if (currentGameMap !== 'main') continue;
                    const commaIdx = key.indexOf(',');
                    sx = parseInt(key.substring(0, commaIdx), 10);
                    sy = parseInt(key.substring(commaIdx + 1), 10);
                }
                const ts = tileSounds[key];

                // Looping sounds use HTML Audio (streaming) - no need to decode buffer
                // Non-looping sounds need buffer for Web Audio API
                if (!ts.loop) {
                    let soundBuffer = soundBuffers[ts.soundIndex];
                    // Lazy decode: if not loaded yet, trigger decode (will be available next frame)
                    if (!soundBuffer && ts.soundIndex >= 0 && ts.soundIndex < soundsData.length) {
                        decodeSound(ts.soundIndex);
                        continue;
                    }
                    if (!soundBuffer) continue;
                }

                // Calculate distance from player (in tiles)
                const dx = playerTileX - sx;
                const dy = playerTileY - sy;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Get fade percent (default 50% = half the radius is fade zone)
                const fadePercent = ts.fadePercent !== undefined ? ts.fadePercent : 0.5;

                // Calculate volume based on distance with fade zone
                let targetVolume = 0;
                if (dist <= ts.radius) {
                    // Inside radius - calculate fade
                    const fadeStartDist = ts.radius * (1 - fadePercent); // Where fade begins
                    if (dist <= fadeStartDist) {
                        // Inside inner zone - full volume
                        targetVolume = ts.volume;
                    } else {
                        // In fade zone - linear fade from full to zero
                        const fadeZoneSize = ts.radius - fadeStartDist;
                        const distInFadeZone = dist - fadeStartDist;
                        targetVolume = ts.volume * (1 - distInFadeZone / fadeZoneSize);
                    }
                }

                // Start sound if not playing yet (for looping sounds, use HTML Audio for streaming)
                if (!ambientSounds[key]?.playing && ts.loop) {
                    // Use HTML5 Audio for looping sounds - streams instead of buffering entire file
                    // This is critical for large ambient sounds (e.g. 30-min fire sound)
                    const sound = soundsData[ts.soundIndex];
                    if (sound && sound.data) {
                        const audio = new Audio(sound.data);
                        audio.loop = true;
                        audio.volume = 0; // Start silent
                        audio.play().catch(e => console.warn('Audio play failed:', e));
                        ambientSounds[key] = { audio, playing: true, useHtmlAudio: true };
                    }
                }

                // For non-looping sounds, only start when in range
                if (!ambientSounds[key]?.playing && !ts.loop && targetVolume > 0) {
                    const soundBuffer = soundBuffers[ts.soundIndex];
                    if (!soundBuffer) continue;
                    const source = audioContext.createBufferSource();
                    source.buffer = soundBuffer;
                    source.loop = false;

                    const gainNode = audioContext.createGain();
                    gainNode.gain.value = targetVolume;

                    source.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    source.start();

                    ambientSounds[key] = { source, gainNode, playing: true };

                    source.onended = () => {
                        if (ambientSounds[key]) {
                            ambientSounds[key].playing = false;
                        }
                    };
                }

                // Smoothly adjust volume for playing sounds
                if (ambientSounds[key]?.playing) {
                    if (ambientSounds[key].useHtmlAudio && ambientSounds[key].audio) {
                        // HTML Audio - direct volume control (no smooth ramping but much faster)
                        ambientSounds[key].audio.volume = Math.max(0, Math.min(1, targetVolume));
                    } else if (ambientSounds[key].gainNode) {
                        const gain = ambientSounds[key].gainNode.gain;
                        // Use linearRampToValueAtTime for smooth transitions
                        gain.cancelScheduledValues(audioContext.currentTime);
                        gain.setValueAtTime(gain.value, audioContext.currentTime);
                        gain.linearRampToValueAtTime(Math.max(0, targetVolume), audioContext.currentTime + fadeTime);
                    }
                }
            }
        }
