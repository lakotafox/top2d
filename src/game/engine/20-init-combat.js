        function initGame() {
        console.log('Initializing game with project data:', projectData);

        // Auto-hide UI if adventure mode
        if (projectData.autoHideUI) {
            setTimeout(() => hideAllUI(), 100);
        }

        const gridSize = projectData.gridSize || 16;
        mapRows = projectData.mapRows || 30;
        mapCols = projectData.mapCols || 40;

        // Load layers - use spawn map's data if available
        layers = [];
        const spawnMap = projectData.spawnMapName || 'main';
        const spawnMapData = projectData.maps && projectData.maps[spawnMap];

        if (spawnMapData && spawnMapData.layers && spawnMapData.layers.length > 0) {
            // Load from spawn map
            layers = spawnMapData.layers;
            console.log('Loaded layers from spawn map:', spawnMap);
        } else if (projectData.layers && projectData.layers.length > 0) {
            layers = projectData.layers;
            console.log('Loaded layers from projectData.layers');
        } else if (projectData.map && projectData.map.length > 0) {
            layers = [projectData.map];
            console.log('Loaded map from projectData.map (old format)');
        } else {
            console.error('No map data found!');
        }

        let layerVisibility = projectData.layerVisibility || layers.map(() => true);
        const playerLayerIndex = projectData.playerLayerIndex !== undefined ? projectData.playerLayerIndex : 1;

        console.log('Layers:', layers.length, 'MapRows:', mapRows, 'MapCols:', mapCols, 'PlayerLayer:', playerLayerIndex);

        // Debug: Check layer content
        if (layers.length > 0) {
            const firstLayer = layers[0];
            console.log('First layer type:', typeof firstLayer, 'isArray:', Array.isArray(firstLayer));
            if (Array.isArray(firstLayer) && firstLayer.length > 0) {
                console.log('First layer rows:', firstLayer.length);
                // Count non-null cells
                let tileCount = 0;
                for (let y = 0; y < firstLayer.length; y++) {
                    if (firstLayer[y]) {
                        for (let x = 0; x < firstLayer[y].length; x++) {
                            if (firstLayer[y][x]) tileCount++;
                        }
                    }
                }
                console.log('Tiles in first layer:', tileCount);
            }
        }

        // Load collision data - use spawn map's data if available
        tileCollisions = (spawnMapData && spawnMapData.tileCollisions) || projectData.tileCollisions || {};
        collisionMasks = (spawnMapData && spawnMapData.collisionMasks) || projectData.collisionMasks || {};
        tileSplitLines = (spawnMapData && spawnMapData.tileSplitLines) || projectData.tileSplitLines || {}; // Depth split for Y-sorting
        tileSplitLineFlipped = (spawnMapData && spawnMapData.tileSplitLineFlipped) || projectData.tileSplitLineFlipped || {}; // Flipped split lines

        console.log('Tiles with collision:', Object.keys(tileCollisions).length, 'from map:', spawnMap);
        console.log('Tiles with depth split:', Object.keys(tileSplitLines).length);

        // Multiple props system
        const propImages = [];
        const propsData = projectData.props || [];
        const propCollisionMasksAll = {}; // propIndex -> collision masks

        // Load tilesets (support multiple)
        const tilesetImages = [];
        const tilesetsData = projectData.tilesets || [{ data: projectData.tilesetData }];

        // Animated props data (needed for counting)
        const animatedPropsData = projectData.animatedProps || [];
        // Placed animated props (for instance-specific item overrides)
        const placedAnimPropsData = projectData.placedAnimProps || [];

        // Static objects data (multi-tile props from tilesets)
        const staticObjectsData = projectData.staticObjects || [];
        const placedStaticObjectsData = projectData.placedStaticObjects || [];
        const staticObjectImages = [];

        // Quest system data
        quests = projectData.quests || [];
        questSoundsData = projectData.questSounds || [];
        initializeQuestStates();

        // Custom UI skins — snapshot at Play (no live updates by design).
        uiConfigData = projectData.uiConfig || {};

        // Update quest tracker after a short delay to ensure UI elements exist
        setTimeout(updateQuestTracker, 100);

        // Shop system data
        let shops = projectData.shops || [];
        let playerGold = projectData.startingGold !== undefined ? projectData.startingGold : 100;
        console.log('[SHOP] Loaded', shops.length, 'shops, starting gold:', playerGold);

        // Track all images that need to load before starting the game
        let imagesToLoad = 0;
        let imagesLoaded = 0;
        let gameStarted = false;

        // Warmup system - run simulated frames to JIT compile hot code paths
        // IMPORTANT: Must use requestAnimationFrame (not setTimeout) so JIT compiles the same code path!
        let isWarmingUp = false;
        let warmupFrames = 0;
        const WARMUP_FRAME_COUNT = 200; // ~3 seconds at 60fps
        const WARMUP_ITERATIONS_PER_FRAME = 8; // Run hot functions 8x per frame = 1600 total iterations
        // TurboFan needs ~1000+ iterations to fully optimize - this gives us plenty

        function runWarmup() {
            isWarmingUp = true;
            warmupFrames = 0;
            console.log('[WARMUP] Starting comprehensive JIT warmup phase...');

            // Show warmup indicator
            const loadingEl = document.getElementById('loadingScreen');
            if (loadingEl) {
                loadingEl.style.display = 'flex';
                loadingEl.innerHTML = '<div style="color:#fff;font-size:18px;">Optimizing...</div>';
            }

            // Save original player state to restore after warmup
            const originalX = player.x;
            const originalY = player.y;
            const originalHealth = player.health;

            // Collect NPC positions to visit during warmup (triggers AI code paths)
            // Calculate tileSize here - TILE_SCALE (4) isn't defined yet at this point
            const warmupTileSize = gridSize * 4;
            const npcPositions = placedNpcs.map(npc => ({
                x: npc.x * warmupTileSize + warmupTileSize / 2,
                y: npc.y * warmupTileSize + warmupTileSize / 2
            }));

            // Make player invulnerable during entire warmup
            player.invulnerable = true;

            function warmupLoop() {
                if (warmupFrames >= WARMUP_FRAME_COUNT) {
                    // Warmup complete - restore player state
                    isWarmingUp = false;
                    player.x = originalX;
                    player.y = originalY;
                    player.health = originalHealth;
                    player.keys = { up: false, down: false, left: false, right: false };
                    player.invulnerable = false;
                    player.knockbackVx = 0;
                    player.knockbackVy = 0;
                    player.attacking = false;
                    player.attackAnim = null;
                    player.attackFrame = 0;
                    console.log('[WARMUP] Complete after', warmupFrames, 'frames');

                    // Hide loading and start real game
                    hideLoading();
                    gameLoop();
                    return;
                }

                // Phase 1 (0-300): Basic movement in all directions
                // Phase 2 (300-600): Visit NPC positions to trigger AI code
                // Phase 3 (600-900): Stress test with rapid direction changes

                const phase = Math.floor(warmupFrames / 300);

                if (phase === 0) {
                    // Basic movement - change direction every 30 frames
                    const dirs = ['up', 'down', 'left', 'right'];
                    const dir = dirs[Math.floor(warmupFrames / 30) % 4];
                    player.keys = { up: dir === 'up', down: dir === 'down', left: dir === 'left', right: dir === 'right' };
                } else if (phase === 1 && npcPositions.length > 0) {
                    // Teleport near NPCs to trigger vision/chase/combat AI
                    const npcIndex = Math.floor((warmupFrames - 300) / 50) % npcPositions.length;
                    const targetNpc = npcPositions[npcIndex];
                    // Position player near (but not on) the NPC
                    player.x = targetNpc.x + 40;
                    player.y = targetNpc.y + 40;
                    // Simulate movement toward NPC
                    player.keys = { up: false, down: false, left: true, right: false };
                } else {
                    // Phase 3: Rapid direction changes to stress test
                    const dirs = ['up', 'down', 'left', 'right'];
                    const dir = dirs[Math.floor(warmupFrames / 5) % 4]; // Change every 5 frames
                    player.keys = { up: dir === 'up', down: dir === 'down', left: dir === 'left', right: dir === 'right' };
                }

                // Run hot functions multiple times per frame to accelerate JIT optimization
                // TurboFan needs ~1000+ iterations - with 8 iterations per frame over 600 frames = 4800 iterations
                // NOTE: No try-catch blocks - they prevent TurboFan from inlining!
                for (let iter = 0; iter < WARMUP_ITERATIONS_PER_FRAME; iter++) {
                    const totalIter = warmupFrames * WARMUP_ITERATIONS_PER_FRAME + iter;

                    // Run one frame of game logic (same as real game loop)
                    updateDayCycle();
                    update();
                    updateNPCs();

                    // Run draw to warm up rendering code (only draw once per frame to avoid visual glitches)
                    if (iter === 0) {
                        draw();
                    }

                    // Cycle through different lighting levels to warm up all light code paths
                    if (totalIter % 30 === 0) {
                        const savedDarkness = manualDarkness;
                        manualDarkness = (totalIter % 90 === 0) ? 80 : (totalIter % 60 === 0) ? 40 : 20;
                        renderLighting();
                        manualDarkness = savedDarkness;
                    }

                    // Exercise trigger checking explicitly (no try-catch - prevents inlining)
                    if (totalIter % 10 === 0 && typeof checkTriggers === 'function') {
                        checkTriggers();
                    }

                    // Exercise ALL player animation paths (not just attackDown)
                    // This ensures monomorphic dispatch for animation lookup
                    const animKeys = ['walkUp', 'walkDown', 'walkLeft', 'walkRight',
                                      'idleUp', 'idleDown', 'idleLeft', 'idleRight',
                                      'attackUp', 'attackDown', 'attackLeft', 'attackRight'];
                    const animIndex = totalIter % animKeys.length;
                    const animKey = animKeys[animIndex];

                    if (totalIter % 45 < 15) {
                        player.attacking = true;
                        player.attackFrame = totalIter % 3;
                        player.attackAnim = player.animations && player.animations[animKey] ? animKey : null;
                    } else {
                        player.attacking = false;
                        // Exercise idle/walk animations too
                        if (player.animations && player.animations[animKey]) {
                            player.currentAnim = animKey;
                        }
                    }

                    // Exercise quest checking (no try-catch)
                    if (totalIter % 20 === 0 && typeof checkQuestConditions === 'function') {
                        checkQuestConditions();
                    }

                    // Exercise dialog checking (no try-catch)
                    if (totalIter % 15 === 0 && typeof checkDialogInteraction === 'function') {
                        checkDialogInteraction();
                    }

                    // Exercise item interaction checking (no try-catch)
                    if (totalIter % 25 === 0 && typeof checkItemInteraction === 'function') {
                        checkItemInteraction();
                    }

                    // Exercise collision checking with various positions (no try-catch)
                    if (totalIter % 5 === 0 && typeof checkCollision === 'function') {
                        const testX = player.x + (totalIter % 100) - 50;
                        const testY = player.y + (totalIter % 80) - 40;
                        checkCollision(testX, testY, 20, 20);
                    }

                    // Exercise inventory functions (no try-catch)
                    if (totalIter % 30 === 0 && typeof updateInventoryUI === 'function') {
                        updateInventoryUI();
                    }

                    // Exercise ambient sound code paths
                    if (totalIter % 20 === 0 && typeof updateAmbientSounds === 'function') {
                        updateAmbientSounds();
                    }
                }

                warmupFrames++;

                // Update loading text periodically
                if (warmupFrames % 90 === 0 && loadingEl) {
                    const pct = Math.round((warmupFrames / WARMUP_FRAME_COUNT) * 100);
                    loadingEl.innerHTML = '<div style="color:#fff;font-size:18px;">Optimizing... ' + pct + '%</div>';
                }

                // Use requestAnimationFrame - MUST match real game loop call path for JIT!
                requestAnimationFrame(warmupLoop);
            }

            // Start with rAF to match real game loop
            requestAnimationFrame(warmupLoop);
        }

        function checkAllImagesLoaded() {
            showLoading(imagesLoaded, imagesToLoad);
            if (imagesLoaded >= imagesToLoad && !gameStarted) {
                console.log('All images loaded, starting warmup...');
                gameStarted = true;
                gameStartTime = Date.now();
                findStartPos();
                hideAllUI(); // Start with debug UI hidden
                buildAnimatedTileRegistry(); // Cache animated tile locations for performance
                runWarmup(); // Run warmup before starting game loop
            }
        }

        // Count all images to load
        imagesToLoad += tilesetsData.filter(ts => ts && ts.data).length; // Tilesets with valid data
        imagesToLoad += animatedPropsData.filter(p => p && p.spriteData).length; // Animated props
        imagesToLoad += staticObjectsData.filter(o => o && o.spriteData).length; // Static objects
        imagesToLoad += propsData.filter(p => p && p.data).length; // Regular props with valid data
        if (projectData.propImageData && propsData.length === 0) imagesToLoad += 1; // Legacy single prop
        imagesToLoad += (projectData.npcs || []).filter(n => n && n.spriteData).length; // NPC sprites
        imagesToLoad += 1; // Player sprite
        imagesToLoad += ['questLogButton','questLogPanel','hotbar','inventory']
            .filter(s => uiConfigData[s] && uiConfigData[s].spriteData).length; // Custom UI skins

        // Detect mobile for staggered loading
        const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        console.log('Total images to load:', imagesToLoad, isMobileDevice ? '(mobile - staggered loading)' : '');

        // Safety check - if somehow no images to load, start anyway
        if (imagesToLoad === 0) {
            console.warn('No images to load, starting game immediately');
            imagesToLoad = 1;
            imagesLoaded = 1;
            gameStartTime = Date.now();
            hideLoading();
            findStartPos();
            hideAllUI(); // Start with debug UI hidden
            buildAnimatedTileRegistry(); // Cache animated tile locations for performance
            gameLoop();
        }

        // Fallback timeout - start game after 2 minutes even if some images failed (large projects need more time on iPad)
        setTimeout(() => {
            if (!gameStarted) {
                console.warn('Timeout reached, starting game with', imagesLoaded, '/', imagesToLoad, 'images loaded');
                gameStarted = true;
                gameStartTime = Date.now();
                hideLoading();
                findStartPos();
                hideAllUI(); // Start with debug UI hidden
                buildAnimatedTileRegistry(); // Cache animated tile locations for performance
                gameLoop();
            }
        }, 120000);

        // Load all prop images
        if (propsData.length > 0) {
            propsData.forEach((propData, i) => {
                if (!propData || !propData.data) {
                    console.warn('Prop', i, 'has no data, skipping');
                    return;
                }
                const img = new Image();
                img.onload = () => {
                    console.log('Prop', i, 'loaded (' + (imagesLoaded + 1) + '/' + imagesToLoad + ')');
                    imagesLoaded++;
                    checkAllImagesLoaded();
                };
                img.onerror = () => {
                    console.error('Failed to load prop', i);
                    imagesLoaded++;
                    checkAllImagesLoaded();
                };
                img.src = propData.data;
                propImages[i] = img;
                propCollisionMasksAll[i] = propData.collisionMasks || {};
            });
        } else if (projectData.propImageData) {
            // Backwards compatibility - single prop
            const img = new Image();
            img.onload = () => {
                console.log('Prop image loaded (legacy) (' + (imagesLoaded + 1) + '/' + imagesToLoad + ')');
                imagesLoaded++;
                checkAllImagesLoaded();
            };
            img.onerror = () => {
                console.error('Failed to load legacy prop');
                imagesLoaded++;
                checkAllImagesLoaded();
            };
            img.src = projectData.propImageData;
            propImages[0] = img;
            propCollisionMasksAll[0] = projectData.propCollisionMasks || {};
        }

        tilesetsData.forEach((ts, i) => {
            if (!ts || !ts.data) {
                console.warn('Tileset', i, 'has no data, skipping');
                return;
            }
            const img = new Image();
            img.onload = () => {
                tilesetImages[i] = img;
                imagesLoaded++;
                console.log('Tileset', i, 'loaded (' + imagesLoaded + '/' + imagesToLoad + ')');
                checkAllImagesLoaded();
            };
            img.onerror = () => {
                console.error('Failed to load tileset', i);
                imagesLoaded++;
                checkAllImagesLoaded();
            };
            img.src = ts.data;
        });

        // For backwards compat
        const tilesetImg = { complete: false };

        // Load animated props (stored as animTile cells in layers)
        const animPropImages = [];
        const animPropFrameTimers = {}; // key: "x,y,layer" -> { frame: 0, timer: 0 }
        const interactivePropStates = {}; // key: "x,y,layer" -> { used: false, animating: false, frame: 0 }

        animatedPropsData.forEach((propData, i) => {
            if (propData && propData.spriteData) {
                const img = new Image();
                img.onload = () => {
                    console.log('AnimProp', i, propData.name, 'loaded (' + (imagesLoaded + 1) + '/' + imagesToLoad + ')');
                    imagesLoaded++;
                    checkAllImagesLoaded();
                };
                img.onerror = () => {
                    console.error('Failed to load AnimProp', i);
                    imagesLoaded++;
                    checkAllImagesLoaded();
                };
                img.src = propData.spriteData;
                animPropImages[i] = img;
            }
        });

        // Load custom UI skin sheets (onload AND onerror both advance the loader so a bad sheet
        // can never hang boot at the loading screen). On ready, apply skins to the DOM elements.
        ['questLogButton','questLogPanel','hotbar','inventory'].forEach(slot => {
            const cfg = uiConfigData[slot];
            if (cfg && cfg.spriteData) {
                const img = new Image();
                img.onload = () => {
                    uiImages[slot] = img;
                    imagesLoaded++;
                    if (typeof applyUiSkins === 'function') applyUiSkins();
                    checkAllImagesLoaded();
                };
                img.onerror = () => {
                    console.error('Failed to load UI skin', slot);
                    imagesLoaded++;
                    checkAllImagesLoaded();
                };
                img.src = cfg.spriteData;
            }
        });

        console.log('Animated props:', animatedPropsData.length);
        // Debug: log props with giveItem
        animatedPropsData.forEach((prop, i) => {
            if (prop.giveItem) {
                console.log('[PROP ' + i + '] "' + prop.name + '" gives item index:', prop.giveItemIndex);
            }
        });

        // Load static objects (multi-tile props from tilesets)
        staticObjectsData.forEach((objData, i) => {
            if (objData && objData.spriteData) {
                const img = new Image();
                img.onload = () => {
                    console.log('StaticObj', i, objData.name, 'loaded (' + (imagesLoaded + 1) + '/' + imagesToLoad + ')');
                    imagesLoaded++;
                    checkAllImagesLoaded();
                };
                img.onerror = () => {
                    console.error('Failed to load StaticObj', i);
                    imagesLoaded++;
                    checkAllImagesLoaded();
                };
                img.src = objData.spriteData;
                staticObjectImages[i] = img;
            }
        });
        console.log('Static objects:', staticObjectsData.length, 'Placed:', placedStaticObjectsData.length);

        // Load player sprite - check for player characters first, then embedded sprite, then file
        let playerImg = new Image();
        const basePath = window.opener ? window.opener.location.href.replace(/[^/]*$/, '') : '';

        // Player character animation data (if using player characters system)
        let activePlayerChar = null;
        let playerFrameWidth = 64;
        let playerFrameHeight = 64;
        let playerAnimations = null;
        let playerHasDiagonals = false; // true if active char has diagonal walk frames (gates 8-way facing)
        let playerAnimFpsList = {}; // Per-animation FPS
        let playerAnimMirrors = {}; // Per-animation mirror flags
        let playerAttackMovement = 'stop'; // 'stop', 'slide', 'move'
        let attackSlideAmount = 50; // 0-100%, how much speed to retain during slide
        let attackSlideDuration = 30; // How many frames the slide lasts
        let playerScale = 1.7; // Player sprite scale (loaded from character data)

        // Shadow settings (loaded from player character or defaults)
        let playerShadowWidth = 21;
        let playerShadowHeight = 8;
        let playerShadowYOffset = 17;
        let playerNoShadow = false;

        let playerGameOverSoundIndex = -1; // Index of game over sound (-1 = none, 0-99 = builtin, 100+ = project)
        let playerSpriteSheets = []; // Array of loaded sprite sheet images

        // Built-in game over sounds (lazy loaded)
        const builtinGameOverSounds = [
            { name: 'Game Over 1', file: 'sounds/game-over-417465.mp3' },
            { name: 'Game Over 2 (Arcade)', file: 'sounds/game-over-arcade-6435.mp3' }
        ];
        let builtinGameOverAudios = [null, null];

        // Check for player characters system first
        if (projectData.playerCharacters && projectData.playerCharacters.length > 0 && projectData.activePlayerIndex >= 0) {
            activePlayerChar = projectData.playerCharacters[projectData.activePlayerIndex];
            console.log('=== PLAYER CHARACTER DATA ===');
            console.log('spriteSheets:', activePlayerChar.spriteSheets ? activePlayerChar.spriteSheets.length + ' sheets' : 'none');
            console.log('animMirrors:', JSON.stringify(activePlayerChar.animMirrors));
            console.log('animations keys:', Object.keys(activePlayerChar.animations || {}));
            console.log('attackDown frames:', activePlayerChar.animations?.attackDown?.length || 0);
            if (activePlayerChar) {
                playerFrameWidth = activePlayerChar.frameWidth || 64;
                playerFrameHeight = activePlayerChar.frameHeight || 64;
                playerAnimations = activePlayerChar.animations;
                playerHasDiagonals = hasDiagonalAnims(playerAnimations); // gate for 8-way facing
                // Load per-animation FPS
                if (activePlayerChar.animFps && typeof activePlayerChar.animFps === 'object') {
                    playerAnimFpsList = activePlayerChar.animFps;
                } else {
                    // Old format: use single fps for all
                    const defaultFps = activePlayerChar.fps || 8;
                    if (playerAnimations) {
                        Object.keys(playerAnimations).forEach(k => playerAnimFpsList[k] = defaultFps);
                    }
                }
                // Load per-animation mirror flags
                if (activePlayerChar.animMirrors && typeof activePlayerChar.animMirrors === 'object') {
                    playerAnimMirrors = activePlayerChar.animMirrors;
                    console.log('Loaded animMirrors:', JSON.stringify(playerAnimMirrors));
                }
                // Load attack hitbox shape (per-direction)
                if (activePlayerChar.hitboxRange !== undefined) {
                    // Handle both old single-value format and new per-direction format
                    if (typeof activePlayerChar.hitboxRange === 'object') {
                        playerHitboxRange = activePlayerChar.hitboxRange;
                    } else {
                        // Convert old format to new
                        const val = activePlayerChar.hitboxRange;
                        playerHitboxRange = { up: val, down: val, left: val, right: val };
                    }
                }
                if (activePlayerChar.hitboxWidth !== undefined) {
                    if (typeof activePlayerChar.hitboxWidth === 'object') {
                        playerHitboxWidth = activePlayerChar.hitboxWidth;
                    } else {
                        const val = activePlayerChar.hitboxWidth;
                        playerHitboxWidth = { up: val, down: val, left: val, right: val };
                    }
                }
                if (activePlayerChar.hitboxOffsetY !== undefined) {
                    if (typeof activePlayerChar.hitboxOffsetY === 'object') {
                        playerHitboxOffsetY = activePlayerChar.hitboxOffsetY;
                    } else {
                        const val = activePlayerChar.hitboxOffsetY;
                        playerHitboxOffsetY = { up: val, down: val, left: val, right: val };
                    }
                }
                if (activePlayerChar.hitboxOffsetX !== undefined) {
                    if (typeof activePlayerChar.hitboxOffsetX === 'object') {
                        playerHitboxOffsetX = activePlayerChar.hitboxOffsetX;
                    } else {
                        const val = activePlayerChar.hitboxOffsetX;
                        playerHitboxOffsetX = { up: val, down: val, left: val, right: val };
                    }
                }
                console.log('Loaded per-direction hitbox:', JSON.stringify(playerHitboxRange));
                // Load attack movement setting
                if (activePlayerChar.attackMovement) {
                    playerAttackMovement = activePlayerChar.attackMovement;
                }
                // Load game over sound index
                if (activePlayerChar.gameOverSoundIndex !== undefined) {
                    playerGameOverSoundIndex = activePlayerChar.gameOverSoundIndex;
                }
                // Load scale (convert from multiplier to pixels-per-tile ratio)
                if (activePlayerChar.scale !== undefined) {
                    // Scale is saved as a multiplier (0.5 to 3), default playerScale is 1.7
                    playerScale = activePlayerChar.scale * 1.7;
                    console.log('Loaded player scale:', activePlayerChar.scale, '-> playerScale:', playerScale);
                }
                // Load shadow settings
                if (activePlayerChar.noShadow !== undefined) {
                    playerNoShadow = activePlayerChar.noShadow;
                }
                if (activePlayerChar.shadowOffsetX !== undefined || activePlayerChar.shadowOffsetY !== undefined) {
                    // Convert from pixel offsets to the expected format
                    playerShadowYOffset = 17 - (activePlayerChar.shadowOffsetY || 0);
                }
                if (activePlayerChar.shadowWidth !== undefined) {
                    // Canonical unit is integer percent. Migrate legacy decimal values.
                    const sw = activePlayerChar.shadowWidth;
                    playerShadowWidth = Math.round(sw > 0 && sw < 1 ? sw * 100 : sw);
                }
                if (activePlayerChar.shadowHeight !== undefined) {
                    const sh = activePlayerChar.shadowHeight;
                    playerShadowHeight = Math.round(sh > 0 && sh < 1 ? sh * 100 : sh);
                }
                console.log('Using player character:', activePlayerChar.name, playerFrameWidth + 'x' + playerFrameHeight, 'attackMovement:', playerAttackMovement, 'scale:', playerScale);
            }
        }

        // Load player sprite sheets (supports multiple sheets)
        const sheetsToLoad = activePlayerChar?.spriteSheets || (activePlayerChar?.spriteData ? [activePlayerChar.spriteData] : null) || (projectData.playerSpriteData ? [projectData.playerSpriteData] : null);

        if (sheetsToLoad && sheetsToLoad.length > 0) {
            // Load all sprite sheets
            let sheetsLoaded = 0;
            sheetsToLoad.forEach((sheetData, index) => {
                const sheetImg = new Image();
                sheetImg.onload = () => {
                    playerSpriteSheets[index] = sheetImg;
                    sheetsLoaded++;
                    console.log('Player sheet ' + (index + 1) + ' loaded (' + sheetsLoaded + '/' + sheetsToLoad.length + ')');
                    if (sheetsLoaded === sheetsToLoad.length) {
                        // All sheets loaded - set playerImg to first sheet for backwards compat
                        playerImg = playerSpriteSheets[0];
                        imagesLoaded++;
                        checkAllImagesLoaded();
                    }
                };
                sheetImg.onerror = () => {
                    console.error('Failed to load player sheet ' + (index + 1));
                    sheetsLoaded++;
                    if (sheetsLoaded === sheetsToLoad.length) {
                        imagesLoaded++;
                        checkAllImagesLoaded();
                    }
                };
                sheetImg.src = sheetData;
            });
        } else {
            // No player sprite data in save - skip loading
            console.warn('No player sprite data in project - player will not be visible');
            imagesLoaded++;
            checkAllImagesLoaded();
        }

        // Player state (matching game.js)
        const player = {
            x: 100,
            y: 100,
            width: 28,
            height: 76,
            speed: 5.5,
            direction: 'down',
            frame: 0,
            frameTimer: 0,
            moving: false,
            attacking: false,
            attackTimer: 0,
            // Health system
            health: 100,
            maxHealth: 100,
            invincible: false,
            invincibleTimer: 0
        };

        // Store initial spawn for respawn on death
        let initialSpawnX = 100;
        let initialSpawnY = 100;
        let initialSpawnMap = '';

        // Dropped items on the ground (from enemy deaths, etc.)
        // Each: { itemIndex, x, y, vx, vy, bounces, settled, timer, scale }
        let droppedItems = [];

        // Damage player function
        function damagePlayer(amount) {
            if (player.invincible || player.health <= 0) return;

            player.health -= amount;
            player.invincible = true;
            player.invincibleTimer = 90; // 1.5 seconds of invincibility

            console.log('[COMBAT] Player took', amount, 'damage! Health:', player.health);

            if (player.health <= 0) {
                player.health = 0;
                startPlayerDeath();
            }
        }

        // Death animation state
        let playerDying = false;
        let deathAnimFrame = 0;
        let deathAnimTimer = 0;
        let gameOverShown = false;

        // Start player death sequence
        function startPlayerDeath() {
            console.log('[COMBAT] Player died! Playing death animation...');
            playerDying = true;
            deathAnimFrame = 0;
            deathAnimTimer = 0;
            player.attacking = false;
            player.attackAnim = false;
        }

        // Update death animation
        function updateDeathAnimation() {
            if (!playerDying) return;

            deathAnimTimer++;

            // Get death animation frames
            const deathFrames = playerAnimations?.death || [];
            const deathFps = playerAnimFpsList?.death || 4; // Slow death anim
            const frameDelay = Math.round(60 / deathFps);

            if (deathFrames.length > 0) {
                if (deathAnimTimer >= frameDelay) {
                    deathAnimTimer = 0;
                    deathAnimFrame++;

                    // Death animation finished
                    if (deathAnimFrame >= deathFrames.length) {
                        playerDying = false;
                        showGameOver();
                    }
                }
            } else {
                // No death animation - just wait a moment then show game over
                if (deathAnimTimer >= 60) {
                    playerDying = false;
                    showGameOver();
                }
            }
        }

        // Show Game Over screen
        function showGameOver() {
            gameOverShown = true;
            document.getElementById('gameOverOverlay').style.display = 'flex';
            // Play game over sound if set
            // Index scheme: -1 = none, 0-99 = builtin sounds, 100+ = project sounds
            if (playerGameOverSoundIndex >= 0) {
                if (playerGameOverSoundIndex < 100) {
                    // Builtin sound
                    const builtinIndex = playerGameOverSoundIndex;
                    if (builtinIndex >= 0 && builtinIndex < builtinGameOverSounds.length) {
                        if (!builtinGameOverAudios[builtinIndex]) {
                            builtinGameOverAudios[builtinIndex] = new Audio(builtinGameOverSounds[builtinIndex].file);
                        }
                        builtinGameOverAudios[builtinIndex].currentTime = 0;
                        builtinGameOverAudios[builtinIndex].volume = 1.0;
                        builtinGameOverAudios[builtinIndex].play().catch(e => console.warn('Game over sound blocked:', e));
                    }
                } else {
                    // Project sound (index - 100)
                    const projectIndex = playerGameOverSoundIndex - 100;
                    if (projectIndex >= 0 && projectIndex < soundsData.length) {
                        playSound(projectIndex, 1.0, 0);
                    }
                }
            }
        }

        // Try Again - respawn player
        function tryAgain() {
            gameOverShown = false;
            document.getElementById('gameOverOverlay').style.display = 'none';
            respawnPlayer();
        }
        window.tryAgain = tryAgain; // Expose to onclick

        // Quit game
        function quitGame() {
            window.close();
        }
        window.quitGame = quitGame; // Expose to onclick

        // Respawn player at initial spawn
        function respawnPlayer() {
            console.log('[COMBAT] Respawning player...');
            player.health = player.maxHealth;
            player.x = initialSpawnX;
            player.y = initialSpawnY;
            player.invincible = true;
            player.invincibleTimer = 120; // 2 seconds after respawn
            playerDying = false;
            deathAnimFrame = 0;
            if (initialSpawnMap && initialSpawnMap !== currentGameMap) {
                // Switch to spawn map
                switchMap(initialSpawnMap, initialSpawnX / (gridSize * TILE_SCALE), initialSpawnY / (gridSize * TILE_SCALE));
            }
        }

        // Damage NPC (enemy) by amount
        function damageNPC(npcIndex, amount) {
            const placed = placedNpcs[npcIndex];
            const state = npcRuntimeState[npcIndex];
            if (!placed || !state || !placed.isEnemy) return;

            // Initialize HP if not set (default to 30 HP)
            if (state.hp === undefined) {
                state.hp = placed.maxHp || 30;
                state.maxHp = state.hp;
            }

            // Apply damage
            state.hp -= amount;
            state.damageCooldown = 30; // Brief invincibility
            state.hitFlash = 10; // Flash white for 10 frames

            console.log('[COMBAT] NPC', npcIndex, 'took', amount, 'damage! HP:', state.hp);

            // Check for death
            if (state.hp <= 0) {
                state.hp = 0;
                state.dead = true;
                console.log('[COMBAT] NPC', npcIndex, 'defeated!');
                // Track for quest system
                if (placed.uid) {
                    onEnemyDefeated(placed.uid);
                }
                // Drop items on death
                if (placed.dropItems && placed.dropItems.length > 0) {
                    dropItemsFromEnemy(placed, state);
                }
            }
        }

        // Drop items from defeated enemy - spawn on ground
        function dropItemsFromEnemy(placed, state) {
            // Calculate NPC's world position (center)
            const dropX = state.x * TILE_SCALE + (placed.frameWidth || 16) * TILE_SCALE / 2;
            const dropY = state.y * TILE_SCALE + (placed.frameHeight || 16) * TILE_SCALE / 2;

            placed.dropItems.forEach(drop => {
                const itemIndex = drop.itemIndex;
                const quantity = drop.quantity || 1;

                if (itemIndex >= 0 && itemIndex < itemsData.length) {
                    // Spawn each item on the ground with random velocity
                    for (let i = 0; i < quantity; i++) {
                        // Random angle and speed for scatter effect - wide spread
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 6 + Math.random() * 6; // Even faster for more spread
                        const vx = Math.cos(angle) * speed;
                        const vy = Math.sin(angle) * speed * 0.7;

                        droppedItems.push({
                            itemIndex: itemIndex,
                            x: dropX + (Math.random() - 0.5) * 30,
                            y: dropY + (Math.random() - 0.5) * 30,
                            vx: vx,
                            vy: vy,
                            vz: -3 - Math.random() * 2, // Less upward pop
                            z: 0, // Height off ground
                            bounces: 0,
                            settled: false,
                            timer: 0,
                            scale: 0.8 + Math.random() * 0.2, // Slight scale variation
                            bobOffset: Math.random() * Math.PI * 2 // Random bob phase
                        });

                        const itemName = itemsData[itemIndex]?.name || 'Item';
                        console.log('[DROP] Spawned:', itemName, 'at', dropX.toFixed(0), dropY.toFixed(0));
                    }
                }
            });
        }

        // Update dropped items physics
        function updateDroppedItems() {
            const gravity = 0.35;
            const friction = 0.92; // Less friction = items spread further
            const bounceDecay = 0.4;
            const pickupRange = 8 * TILE_SCALE; // Small pickup range - must walk close

            for (let i = droppedItems.length - 1; i >= 0; i--) {
                const item = droppedItems[i];
                item.timer++;

                if (!item.settled) {
                    // Apply physics
                    item.vz += gravity; // Gravity pulls down (z decreases)
                    item.z -= item.vz;
                    item.x += item.vx;
                    item.y += item.vy;

                    // Friction on horizontal movement
                    item.vx *= friction;
                    item.vy *= friction;

                    // Bounce when hitting ground
                    if (item.z <= 0) {
                        item.z = 0;
                        item.bounces++;
                        if (item.bounces < 3 && Math.abs(item.vz) > 1) {
                            item.vz = -item.vz * bounceDecay;
                        } else {
                            item.vz = 0;
                            item.settled = true;
                        }
                    }
                }

                // Check if player is close enough to pick up (after brief delay)
                if (item.timer > 30) { // 0.5 second delay before pickable
                    const dx = player.x + player.width / 2 - item.x;
                    const dy = player.y + player.height / 2 - item.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < pickupRange) {
                        // Pick up the item
                        const added = addToInventory(item.itemIndex, 1);
                        if (added) {
                            const itemName = itemsData[item.itemIndex]?.name || 'Item';
                            console.log('[PICKUP] Collected:', itemName);
                            playPickupSound();
                            droppedItems.splice(i, 1);
                        }
                    }
                }

                // Remove items after 60 seconds
                if (item.timer > 3600) {
                    droppedItems.splice(i, 1);
                }
            }
        }

        // Render dropped items on ground
        function renderDroppedItems(ctx, cameraX, cameraY) {
            droppedItems.forEach(item => {
                const itemData = itemsData[item.itemIndex];
                if (!itemData) return;

                // Get the item's sprite image
                const img = itemImages[item.itemIndex];
                if (!img || !img.complete) return;

                // Get first frame of animation
                const frames = itemData.frames || [];
                if (frames.length === 0) return;
                const frame = frames[0];

                const screenX = item.x - cameraX;
                const screenY = item.y - cameraY - item.z; // Subtract z for height

                // Bob up and down when settled
                let bobY = 0;
                if (item.settled) {
                    bobY = Math.sin(item.timer * 0.08 + item.bobOffset) * 3;
                }

                // Scale - use smaller scale for dropped items
                const scale = item.scale * TILE_SCALE * 0.5; // Half size
                const drawW = (frame.w || 16) * scale;
                const drawH = (frame.h || 16) * scale;

                // Draw small shadow
                const shadowAlpha = Math.max(0.1, 0.3 - item.z / 100);
                ctx.fillStyle = 'rgba(0, 0, 0, ' + shadowAlpha + ')';
                ctx.beginPath();
                ctx.ellipse(screenX, screenY + drawH / 2, drawW / 2.5, 3, 0, 0, Math.PI * 2);
                ctx.fill();

                // Draw item sprite
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(
                    img,
                    frame.x || 0, frame.y || 0, frame.w || 16, frame.h || 16,
                    screenX - drawW / 2, screenY - drawH / 2 + bobY,
                    drawW, drawH
                );
            });
        }

        // Check player attack hitbox against NPCs using cone/triangle shape
        function checkAttackHitbox() {
            if (!player.attacking || !player.attackAnim) return;
            if (player.throwing) return; // throw reuses the swing anim but does no melee damage

            const attackDamage = player.attackDamage || 10;
            const tileSize = gridSize * TILE_SCALE;

            // Track which NPCs we've hit this attack to prevent multiple hits
            if (player.attackHitNpcs === undefined) player.attackHitNpcs = {};

            // Get cone parameters for current direction
            const dir = cardinalOf(player.direction); // collapse diagonal->cardinal for hitbox geometry
            const range = (playerHitboxRange[dir] || 40) * TILE_SCALE;
            const halfAngle = ((playerHitboxWidth[dir] || 60) / 2) * (Math.PI / 180); // Convert to radians
            const offsetX = (playerHitboxOffsetX[dir] || 0) * TILE_SCALE;
            const offsetY = (playerHitboxOffsetY[dir] || 0) * TILE_SCALE;

            // Direction to angle (radians) - 0 is right, PI/2 is down
            const dirAngles = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
            const baseAngle = dirAngles[dir] || 0;

            // Player center position with offset
            const playerCenterX = player.x + player.width / 2 + offsetX;
            const playerCenterY = player.y + player.height / 2 + offsetY;

            // Helper to check if a point is within the attack cone
            function isPointInCone(px, py) {
                const dx = px - playerCenterX;
                const dy = py - playerCenterY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance > range) return false;

                const angleToPoint = Math.atan2(dy, dx);
                let angleDiff = angleToPoint - baseAngle;
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

                return Math.abs(angleDiff) <= halfAngle;
            }

            for (let i = 0; i < placedNpcs.length; i++) {
                const placed = placedNpcs[i];
                const state = npcRuntimeState[i];

                // Skip non-enemies, dead enemies, and already-hit enemies this attack
                if (!placed || !placed.isEnemy || !state) continue;
                if (state.dead) continue;
                if (player.attackHitNpcs[i]) continue;

                // Get NPC definition for collision mask
                const npc = npcs[placed.npcIndex];
                if (!npc) continue;

                // Calculate NPC collision bounds from collision mask
                const frameW = npc.frameWidth || gridSize;
                const frameH = npc.frameHeight || gridSize;
                const npcScale = placed.scale || 1;
                const scaledW = tileSize * npcScale;
                const scaledH = tileSize * npcScale;
                const scaleX = scaledW / frameW;
                const scaleY = scaledH / frameH;

                // NPC base position (anchored at bottom-center like collision system)
                const npcBaseX = state.x * TILE_SCALE + (tileSize - scaledW) / 2;
                const npcBaseY = state.y * TILE_SCALE + tileSize - scaledH;

                // Calculate collision box position using insets
                let boxX, boxY, boxW, boxH;
                const insets = npc.collisionInsets;
                if (insets && (insets.top > 0 || insets.bottom > 0 || insets.left > 0 || insets.right > 0)) {
                    boxX = npcBaseX + insets.left * scaleX;
                    boxY = npcBaseY + insets.top * scaleY;
                    boxW = scaledW - (insets.left + insets.right) * scaleX;
                    boxH = scaledH - (insets.top + insets.bottom) * scaleY;
                } else {
                    // No insets - use full sprite bounds
                    boxX = npcBaseX;
                    boxY = npcBaseY;
                    boxW = scaledW;
                    boxH = scaledH;
                }

                // Check multiple points on the collision box against the attack cone
                const points = [
                    // 4 corners
                    [boxX, boxY],
                    [boxX + boxW, boxY],
                    [boxX, boxY + boxH],
                    [boxX + boxW, boxY + boxH],
                    // Center
                    [boxX + boxW / 2, boxY + boxH / 2],
                    // Edge midpoints
                    [boxX + boxW / 2, boxY],           // Top middle
                    [boxX + boxW / 2, boxY + boxH],    // Bottom middle
                    [boxX, boxY + boxH / 2],           // Left middle
                    [boxX + boxW, boxY + boxH / 2]     // Right middle
                ];

                // If any point is in the cone, register a hit
                let hit = false;
                for (const [px, py] of points) {
                    if (isPointInCone(px, py)) {
                        hit = true;
                        break;
                    }
                }

                if (hit) {
                    damageNPC(i, attackDamage);
                    player.attackHitNpcs[i] = true;
                }
            }
        }
