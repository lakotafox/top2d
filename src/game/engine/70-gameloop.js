        function gameLoop(timestamp) {
            if (!timestamp) timestamp = performance.now();
            const deltaTime = lastFrameTime ? timestamp - lastFrameTime : FIXED_TIMESTEP;
            lastFrameTime = timestamp;

            // Accumulate time for fixed timestep
            accumulatedTime += deltaTime;
            if (accumulatedTime > MAX_ACCUMULATED_TIME) {
                accumulatedTime = MAX_ACCUMULATED_TIME; // Prevent spiral of death
            }

            // Log frame time for network recording (outside perf panel check)
            const currentFps = deltaTime > 0 ? Math.round(1000 / deltaTime) : 60;
            if (networkRecording) logFrameTime(deltaTime, currentFps);

            // Update performance panel (every render frame)
            if (perfPanelVisible) {
                perfUpdateCounter++;
                fpsHistory.push(currentFps);
                if (fpsHistory.length > FPS_HISTORY_SIZE) fpsHistory.shift();

                // Update display every 10 frames for performance
                if (perfUpdateCounter % 10 === 0) {
                    const avgFps = Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length);
                    const fpsEl = document.getElementById('perfFPS');
                    fpsEl.textContent = avgFps;
                    fpsEl.className = 'perf-value' + (avgFps < 30 ? ' critical' : avgFps < 50 ? ' warning' : '');

                    const frameTimeEl = document.getElementById('perfFrameTime');
                    frameTimeEl.textContent = deltaTime.toFixed(1) + 'ms';
                    frameTimeEl.className = 'perf-value' + (deltaTime > 33 ? ' critical' : deltaTime > 20 ? ' warning' : '');

                    document.getElementById('perfNPCs').textContent = placedNpcs ? placedNpcs.length : 0;
                    document.getElementById('perfTriggers').textContent = placedTriggers ? placedTriggers.length : 0;
                    document.getElementById('perfLights').textContent = pointLights ? Object.keys(pointLights).length : 0;
                    document.getElementById('perfLayers').textContent = layers ? layers.length : 0;

                    // Update FPS graph
                    const bars = document.querySelectorAll('#fpsGraph .fps-bar');
                    fpsHistory.forEach((fps, i) => {
                        if (bars[i]) {
                            const height = Math.min(30, (fps / 60) * 30);
                            bars[i].style.height = height + 'px';
                            bars[i].style.background = fps < 30 ? '#f44' : fps < 50 ? '#fa4' : '#4f8';
                        }
                    });
                }
            }

            // Performance profiling - log slow frames
            const perfStart = performance.now();
            let framePerfStr = '';
            let updateTime = 0;

            // === FIXED TIMESTEP GAME LOGIC ===
            // Run game logic in fixed 16.67ms chunks for consistent behavior on all refresh rates
            while (accumulatedTime >= FIXED_TIMESTEP) {
                accumulatedTime -= FIXED_TIMESTEP;

                // Save positions BEFORE this tick (for render interpolation)
                prevCameraX = camera.x;
                prevCameraY = camera.y;
                prevPlayerX = player.x;
                prevPlayerY = player.y;

                updateDayCycle();
                updateDeathAnimation();
                updateTransition(FIXED_TIMESTEP);

                // Dialog cooldown
                if (dialogCooldown > 0) dialogCooldown--;

                // Update dialog typewriter effect
                updateDialogTyping();

                // Advance custom UI skin animations (self-gates on visibility; no-op if unskinned)
                advanceUiAnims();

                if (!isTransitioning || transitionPhase === 'fadeIn' || transitionPhase === 'forceWalk') {
                    // Allow player to be visible during forced walk but don't allow input
                    // Don't update if player is dying or game over
                    if (transitionPhase !== 'forceWalk' && !playerDying && !gameOverShown) {
                        const t0 = performance.now();
                        update();
                        const t1 = performance.now();
                        updateTime += (t1 - t0);
                        if (t1 - t0 > 5) framePerfStr += ' update:' + (t1-t0).toFixed(0);
                    }
                    // Check for walkover triggers after movement (but not during forced walk)
                    if (transitionPhase !== 'forceWalk' && !playerDying && !gameOverShown) {
                        checkWalkoverTriggers();
                        // Check for auto-trigger dialogs (NPCs with auto trigger)
                        checkAutoDialogs();
                        // Track player tile for quest location conditions
                        checkPlayerTileForQuests();
                    }
                    // Update item animations
                    updateItemAnimations();
                    // Update interactive animated prop animations
                    updateAnimPropInteractions();
                    // Update receive item animation
                    updateReceiveItemAnimation();
                    // Update dropped items physics and pickup
                    updateDroppedItems();
                    // Update thrown abilities (boomerang etc.)
                    updateProjectiles();
                }
            }

            // === RENDERING (capped to ~30fps on mobile; logic above already ran at 60Hz) ===
            let drawTime = 0;
            if (timestamp - __lastRenderTime >= __renderInterval) {
                __lastRenderTime = timestamp;

                // Interpolate positions for smooth rendering between logic ticks
                const renderAlpha = accumulatedTime / FIXED_TIMESTEP;

                // Save actual positions
                const actualCameraX = camera.x;
                const actualCameraY = camera.y;
                const actualPlayerX = player.x;
                const actualPlayerY = player.y;

                // Apply interpolation for rendering
                camera.x = prevCameraX + (camera.x - prevCameraX) * renderAlpha;
                camera.y = prevCameraY + (camera.y - prevCameraY) * renderAlpha;
                player.x = prevPlayerX + (player.x - prevPlayerX) * renderAlpha;
                player.y = prevPlayerY + (player.y - prevPlayerY) * renderAlpha;

                const t2 = performance.now();
                draw();
                const t3 = performance.now();
                drawTime = t3 - t2;
                if (drawTime > 10) framePerfStr += ' draw:' + drawTime.toFixed(0);
                drawTransitionOverlay();

                // Restore actual positions for next frame's calculations
                camera.x = actualCameraX;
                camera.y = actualCameraY;
                player.x = actualPlayerX;
                player.y = actualPlayerY;
            }

            const totalTime = performance.now() - perfStart;

            // Log detailed perf data when recording
            if (networkRecording) {
                logPerfFrame({
                    fps: currentFps,
                    total: Math.round(totalTime),
                    update: Math.round(updateTime),
                    draw: Math.round(drawTime),
                    npc: Math.round(window._lastNpcTime || 0),
                    light: Math.round(window._lastLightTime || 0)
                });
            }

            if (totalTime > 20) {
                console.log('[PERF]' + framePerfStr + ' total:' + totalTime.toFixed(0) + 'ms');
            }

            requestAnimationFrame(gameLoop);
        }

        // Game loop is started when all tilesets load (see tileset loading code above)
        } // end initGame()