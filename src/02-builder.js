        // ===== GLOBALS =====
        let currentPhase = 'load'; // 'load', 'collision', 'build'
        let gridSize = 16;
        let zoom = 2;
        let mapCols = 40;
        let mapRows = 30;

        // Version tagging — bump GAME_VERSION on releases; SAVE_SCHEMA_VERSION on save-format changes.
        // GAME_BUILD = number of commits on main (`git rev-list --count HEAD` for the commit being
        // made). Bump it on every push to main — see CLAUDE.md "Version" rule.
        const GAME_VERSION = '0.1.0';
        const GAME_BUILD = 172;
        const SAVE_SCHEMA_VERSION = 1;

        // Render version on main menu once DOM is ready.
        (function paintVersion() {
            const tryPaint = () => {
                const el = document.getElementById('mainMenuVersion');
                if (el) el.textContent = 'v0.1.' + GAME_BUILD; // patch = commit count on main (climbs every push)
            };
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', tryPaint);
            } else {
                tryPaint();
            }
        })();

        // ===== DEV LANDING GATE =====
        // Public visitors see only JOIN ROOM. Typing the secret password (no button, no input box)
        // un-hides the original builder menu. This is obscurity, not security (password is in source),
        // it just keeps casual stream viewers out of the builder. Unlock persists per-device.
        (function devLandingGate() {
            const DEV_PASSWORD = 'Millyween22.';
            const unlock = (persist) => {
                document.body.classList.add('dev-unlocked');
                if (persist) { try { localStorage.setItem('acDevUnlocked', '1'); } catch (e) {} }
            };
            const apply = () => {
                let already = false;
                try { already = localStorage.getItem('acDevUnlocked') === '1'; } catch (e) {}
                if (already) unlock(false);
            };
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', apply);
            } else { apply(); }
            // Buffer typed printable chars; match the password as a Konami-style sequence.
            let buf = '';
            window.addEventListener('keydown', (e) => {
                if (document.body.classList.contains('dev-unlocked')) return;
                if (e.key && e.key.length === 1) {
                    buf = (buf + e.key).slice(-DEV_PASSWORD.length);
                    if (buf === DEV_PASSWORD) { buf = ''; unlock(true); }
                }
            });
        })();

        let tilesetImg = null;
        let tilesets = []; // Array of { name, img, data } for multiple tilesets
        let currentTilesetIndex = 0;
        let paintTilesetZoom = 2; // palette display zoom (Shift+scroll over palette to change). 1=see-all, 8=big
        let tilesetSortOrder = 'added'; // 'added' or 'alpha'
        let tilesetSearchTerm = '';
        let tileCollisions = {}; // "tilesetIndex:x,y" -> [{x,y}, ...]
        let selectedTileData = null;
        let selectionStart = null; // For multi-tile selection
        let selectedTiles = []; // Array of {x, y} for multi-tile selection
        let hoverMapPos = null; // Current hover position on map for preview
        let tileRotation = 0; // 0, 90, 180, 270 degrees
        let tileFlippedH = false; // Flip tile horizontally
        let prattWarningShown = false; // Track if flip+rotation warning was shown
        let eraseMode = false; // Erase tiles instead of painting

        // Layers
        let layers = []; // Array of layer data, each layer is a 2D array like map
        let currentLayer = 0;
        let layerVisibility = []; // Which layers are visible
        let layerNames = []; // Custom names for layers

        // Player layer (for visualization - uneditable, undeletable)
        let playerLayerIndex = 1; // Which layer position the player appears at
        let playerPreviewPos = { x: 5, y: 5 }; // Position on map for player preview
        let spawnMapName = 'main'; // Which map the initial spawn is on
        let playerPreviewVisible = true;
        let setSpawnMode = false; // For setting player spawn position

        // Brush settings
        let brushPainting = false;
        let brushErasing = false;
        let collisionZoom = 6;
        let collisionTool = 'paint'; // 'paint' or 'erase'
        let brushSize = 4; // Brush size in pixels
        let brushShape = 'square'; // 'square', 'circle', 'rect'
        let brushRectW = 8;
        let brushRectH = 4;
        let brushPreviewPos = null; // { x, y } for cyan preview
        let modifiedCollisionKeys = new Set(); // Track modified tiles for sync

        // Pixel collision masks per tile
        let collisionMasks = {}; // "x,y" -> 2D array of booleans

        // Depth split lines for Y-sorting (trunk vs canopy)
        let tileSplitLines = {}; // "tilesetIndex:x,y" -> array of Y values per column (freeform line)
        let tileSplitLineFlipped = {}; // "tilesetIndex:x,y" -> boolean (true = bottom covers player, false = top covers player)
        let selectedSplitTile = null; // {x, y, tilesetIndex} - currently selected tile for splitting
        let draggingSplitLine = false; // true when dragging the split line
        let flatLineMode = true; // when true, split lines are always horizontal
        let modifiedSplitKey = null; // Track current split line being modified for sync

        // Panning
        let collisionPanX = 0;
        let collisionPanY = 0;
        let isPanning = false;
        let panStartX = 0;
        let panStartY = 0;

        let mode = 'tile';
        let currentMapName = 'main'; // Current map name (for multi-map support)
        let maps = {}; // All maps data: { 'main': {layers, tileCollisions, ...}, 'dungeon1': {...} }
        let placedTriggers = []; // Map transition triggers: { x, y, mapName, targetMap, targetX, targetY, type, ... }
        let settingSpawnPoint = false; // True when clicking to set trigger spawn point
        let spawnSourceMap = null; // Map we came from when setting spawn
        let draggingSpawnTrigger = null; // Trigger being dragged (to move spawn point)
        let pendingTriggerForSpawn = null; // Trigger we're setting spawn for (green box follows mouse)
        let triggerDragStart = null; // Start position for drag-to-create trigger {x, y}
        let triggerDragEnd = null; // End position for drag-to-create trigger {x, y}
        let pendingTriggerWidth = 1; // Width of trigger being created
        let pendingTriggerHeight = 1; // Height of trigger being created

        // Player sprite (embedded as base64)
        let playerSpriteData = null; // Base64 data URL of player sprite
        let playerSpriteImg = null; // Image object for preview

        // Player character system (multiple characters with animations)
        let playerCharacters = []; // Array of { name, spriteData, frameWidth, frameHeight, animations, fps }
        let activePlayerIndex = -1; // Which character is active (-1 = use default sprite)

        // Player editor state
        let playerEditorSheets = []; // Array of { image, data, name }
        let playerCurrentSheetIndex = 0;
        let playerEditorFrameW = 64;
        let playerEditorFrameH = 64;
        let playerEditorZoom = 3;
        let playerEditorEditingIndex = -1; // -1 = new, >= 0 = editing existing
        let playerAnimations = { walkDown: [], walkUp: [], walkLeft: [], walkRight: [], idle: [], idleDown: [], idleUp: [], idleLeft: [], idleRight: [], attackDown: [], attackUp: [], attackLeft: [], attackRight: [], interact: [], death: [], receivedItem: [], receiveItemDown: [], receiveItemUp: [], receiveItemLeft: [], receiveItemRight: [], fishCastDown: [], fishCastUp: [], fishCastLeft: [], fishCastRight: [], fishWaitDown: [], fishWaitUp: [], fishWaitLeft: [], fishWaitRight: [] };
        let playerCurrentAnim = 'walkDown';
        let playerPreviewPlaying = false;
        let playerPreviewInterval = null;
        let playerPreviewFrame = 0;
        let playerAnimFpsList = {}; // Per-animation FPS: { walkDown: 8, death: 1, ... }
        let playerPingPong = false;
        let playerPreviewDirection = 1; // 1 = forward, -1 = backward for ping-pong
        let playerAnimMirrors = {}; // { walkLeft: true } - animations to render flipped horizontally
        let playerAttackMovement = 'stop'; // 'stop', 'slide', 'move' - player movement during attack
        // Shape-based attack hitbox per direction (triangle/cone)
        let playerHitboxRange = { up: 35, down: 35, left: 35, right: 30 };
        let playerHitboxWidth = { up: 90, down: 90, left: 90, right: 90 };
        let playerHitboxOffsetY = { up: 15, down: -15, left: 0, right: 0 };
        let playerHitboxOffsetX = { up: 0, down: 0, left: 15, right: -15 }; // Horizontal offset
        let playerGameOverSoundIndex = -1; // Index of game over sound (-1 = none, 0+ = builtin, 100+ = project sounds)

        // Built-in game over sounds
        const builtinGameOverSounds = [
            { name: 'Game Over 1', file: 'game-over-417465.mp3' },
            { name: 'Game Over 2 (Arcade)', file: 'game-over-arcade-6435.mp3' }
        ];
        let builtinGameOverAudios = [null, null]; // Lazy-loaded audio elements
        // Player drag-selection for multi-tile frames
        let playerFrameDragging = false;
        let playerFrameDragStart = null;
        let playerFrameDragEnd = null;

        // Copy from map mode
        let copyMode = false;
        let copyStart = null;
        let copyEnd = null;
        let copiedTiles = null; // 2D array of copied tile data (or 3D if all layers)
        let copiedAllLayers = false; // Whether copiedTiles contains all layers

        // Multiple props system - array of prop images like tilesets
        let props = []; // Array of { name, img, data, collisionMasks }
        let currentPropIndex = -1;
        let propImage = null; // Current prop image (shortcut)
        let propImageData = null; // Current prop data (shortcut)
        let propSelection = null; // {x, y, width, height}
        let propCollisionMasks = {}; // Current prop's collision masks
        let propTool = 'select'; // 'select', 'collision', 'erase'
        let propBrushSize = 4;
        let propPainting = false;

        // ===================== 8-DIRECTION MOVEMENT SUPPORT (top-level) =====================
        // Defined at top-level so BOTH the editor (renderMap etc.) AND the game engine can call them.
        // Diagonal facing values are camelCase: 'upLeft','upRight','downLeft','downRight'.
        // Anim slot = 'walk' + dirSuffix(dir) -> 'walkUpLeft' etc. Diagonals drive WALK anim only;
        // everything else collapses to cardinal via cardinalOf(); projectiles use dirToVec().
        // A diagonal facing is only assigned when hasDiagonalAnims(sprite) is true (4-dir safe).
        function dirSuffix(dir) { return dir.charAt(0).toUpperCase() + dir.slice(1); }
        function dir8FromVector(dx, dy, allowDiagonal) {
            if (!dx && !dy) return null;
            const ax = Math.abs(dx), ay = Math.abs(dy);
            if (allowDiagonal && ax > 0.0001 && ay > 0.0001 && ax > ay * 0.41 && ay > ax * 0.41) {
                return (dy < 0 ? 'up' : 'down') + (dx < 0 ? 'Left' : 'Right');
            }
            if (ax > ay) return dx < 0 ? 'left' : 'right';
            return dy < 0 ? 'up' : 'down';
        }
        function cardinalOf(dir) {
            switch (dir) {
                case 'upLeft': case 'upRight': return 'up';
                case 'downLeft': case 'downRight': return 'down';
                default: return dir;
            }
        }
        function dirToVec(dir) {
            const d = 0.7071;
            switch (dir) {
                case 'left':  return { x: -1, y: 0 };
                case 'right': return { x: 1,  y: 0 };
                case 'up':    return { x: 0,  y: -1 };
                case 'down':  return { x: 0,  y: 1 };
                case 'upLeft':    return { x: -d, y: -d };
                case 'upRight':   return { x: d,  y: -d };
                case 'downLeft':  return { x: -d, y: d };
                case 'downRight': return { x: d,  y: d };
                default: return { x: 0, y: 1 };
            }
        }
        function hasDiagonalAnims(anims) {
            return !!(anims && ((anims.walkUpLeft && anims.walkUpLeft.length) ||
                (anims.walkUpRight && anims.walkUpRight.length) ||
                (anims.walkDownLeft && anims.walkDownLeft.length) ||
                (anims.walkDownRight && anims.walkDownRight.length)));
        }
        function resolveWalkKey(anims, dir) {
            const has = k => !!(anims && anims[k] && anims[k].length > 0);
            const own = 'walk' + dirSuffix(dir);
            if (has(own)) return { key: own, flip: false };
            const mirrorFrom = { left: 'right', upLeft: 'upRight', downLeft: 'downRight' };
            if (mirrorFrom[dir]) {
                const src = 'walk' + dirSuffix(mirrorFrom[dir]);
                if (has(src)) return { key: src, flip: true };
            }
            const card = cardinalOf(dir);
            if (card !== dir) {
                if (has('walk' + dirSuffix(card))) return { key: 'walk' + dirSuffix(card), flip: false };
                if (card === 'left' && has('walkRight')) return { key: 'walkRight', flip: true };
            }
            return { key: own, flip: false };
        }
        // =================== END 8-DIRECTION MOVEMENT SUPPORT ===================

        // Animated Props System
        let animatedProps = []; // Array of animated prop definitions { name, spriteData, frameWidth, frameHeight, frames: [{x,y,w,h},...], type: 'loop'|'interactive', fps }
        let currentAnimPropIndex = -1;
        let currentAnimPropScale = 1; // Scale for placing animated props
        let editAnimPropOnMapMode = false; // Edit mode for clicking placed props to adjust timing
        let animPropSpriteSheet = null; // Current sprite sheet Image
        let animPropSpriteData = null; // Current sprite data URL
        let animPropFrames = []; // Frames being edited
        let animPropPreviewPlaying = false;
        let animPropPreviewFrame = 0;
        let animPropPreviewInterval = null;
        let placedAnimProps = []; // Animated props placed on map: { propIndex, x, y, layer } (grid coords like tiles)
        // Drag selection for multi-tile frames
        let animPropDragStart = null; // {gridX, gridY}
        let animPropDragEnd = null; // {gridX, gridY}
        let animPropIsDragging = false;
        // Animation state for placed props in editor
        let placedAnimPropFrames = {}; // key: "x,y,layer" -> { frame: 0, timer: 0 }
        let editorAnimInterval = null;

        // Static Objects System (tiles saved as reusable props)
        let staticObjects = [];           // { name, spriteData, width, height, tilesetIndex, sourceTiles, sourceOrigin, _spriteImg }
        let placedStaticObjects = [];     // { objIndex, x, y, mapName, scale, collisionBox: {x, y, w, h} }
        let currentStaticObjIndex = -1;
        let staticObjPlacementScale = 1.0;
        let createObjectMode = false;
        let editStaticObjOnMapMode = false; // Edit mode for clicking placed static objects to edit collision

        // Items System (interactive props like chests)
        let items = []; // Array of item definitions { name, spriteData, frameWidth, frameHeight, frames: [{x,y,w,h},...], fps, idleFrame }
        let fishingLoot = []; // Fishing loot table: [{ itemIndex, weight }] — what casting in a fish zone can catch
        let currentItemIndex = -1;
        let itemSpriteSheet = null; // Current sprite sheet Image
        let itemSpriteData = null; // Current sprite data URL
        let itemFrames = []; // Frames being edited
        let itemPreviewPlaying = false;
        let itemPreviewFrame = 0;
        let itemPreviewInterval = null;
        let placedItems = []; // Items placed on map: { itemIndex, x, y, layer, mapName, used: false }
        let itemImages = {}; // Wave 3: module-scope map of item-index -> HTMLImageElement. Builder UI + MP receivers share this.
        // Drag selection for multi-tile frames
        let itemDragStart = null;
        let itemDragEnd = null;
        let itemIsDragging = false;
        // Animation state for placed items in editor
        let placedItemFrames = {}; // key: "x,y,layer,map" -> { frame: 0, timer: 0, playing: false }

        // Quest System (builder side)
        let quests = [];
        let selectedQuestIndex = -1;
        let settingConditionMode = false;
        let settingConditionType = null;

        // Shop System (builder side)
        let shops = [];
        let selectedShopIndex = -1;
        let placedShops = []; // Shop objects placed on map: { x, y, mapName, shopIndex, trigger }
        let startingGold = 100; // Initial gold for new games

        // NPC System
        let npcs = []; // Array of NPC definitions { name, spriteData, frameWidth, frameHeight, animations: {...}, fps }
        let currentNpcIndex = -1;
        let placedNpcs = []; // NPCs placed on map: { npcIndex, x, y, path: [{x,y},...], trigger, speed }
        let selectedPlacedNpcIndex = -1; // Currently selected placed NPC for editing
        let npcPathDrawing = false; // Currently drawing a path
        let npcPathEditing = false; // Currently editing/moving waypoints
        let npcDraggingWaypoint = -1; // Index of waypoint being dragged (-1 = none)
        let npcWaypointPropTarget = -1; // Waypoint index awaiting a prop-link click on the map (-1 = off)
        let npcEditorImage = null;

        // NPC Path Preview
        let npcPathPreviewActive = false;
        let npcPreviewAnimId = null;
        let npcPreviewState = null; // { x, y, waypointIndex, direction, frame, frameTimer }
        let npcEditorData = null;
        let npcEditorFrameW = 16;
        let npcEditorFrameH = 16;
        let npcEditorEditingIndex = -1;
        let npcEditorZoom = 3; // Zoom level for sprite sheet display
        let npcTool = 'none'; // 'none', 'collision', 'erase', 'split'
        let npcBrushSize = 4;
        let npcBrushShape = 'square'; // 'square', 'circle', 'rect'
        let npcBrushRectW = 8; // Width for rectangle brush
        let npcBrushRectH = 4; // Height for rectangle brush
        let npcBrushPreviewPos = null; // {x, y} for cursor preview
        let npcCollisionMask = null; // 2D array for collision pixels
        let npcSplitLine = null; // Y value for depth split
        let npcPainting = false;
        let npcFrames = []; // Frames being edited

        // NPC frame drag selection (for multi-tile frames)
        let npcFrameDragStart = null;   // {gridX, gridY}
        let npcFrameDragEnd = null;     // {gridX, gridY}
        let npcFrameDragging = false;
        let npcPreviewPlaying = false;
        let npcPreviewFrame = 0;
        let npcPreviewInterval = null;
        let npcPingPong = false;
        let npcPreviewDirection = 1; // 1 = forward, -1 = backward for ping-pong

        // Dialog System
        let dialogs = []; // Array of dialog configurations { name, style, colors, pages: [{speaker, text}], ... }
        let placedDialogTiles = []; // Dialog tiles (signs): { x, y, mapName, dialogIndex }
        let currentDialogIndex = -1;
        let currentDialogTileIndex = -1; // Selected dialog for tile placement
        let dialogEditorOpen = false;

        // Sound System
        let sounds = []; // Array of { name, data, duration, type: 'ambient'|'action' }
        let currentSoundIndex = -1;
        let soundAttachMode = 'tile'; // 'tile' or 'player'
        let tileSounds = {}; // "x,y" -> { soundIndex, radius, loop, volume, fadePercent }
        let playerSounds = {
            walk: { soundIndex: -1, interval: 200, volume: 0.5, pitchVariation: 0.1 },
            attack: { soundIndex: -1, volume: 0.7, pitchVariation: 0.15, lengthVariation: 0 },
            inventoryOpen: { soundIndex: -1, volume: 0.5 },
            inventoryClose: { soundIndex: -1, volume: 0.5 }
        };
        let previewAudio = null; // For sound preview playback
        let selectedTileSoundKey = null; // Currently selected tile sound for editing

        // Quest Sounds Library - separate from ambient/action sounds
        let questSounds = []; // Array of { name, data }

        // Lighting System (Classic 2D - no WebGL)
        let lightingSettings = {
            playerLight: false,
            playerLightRadius: 4
        };
        let pointLights = {};  // "mapName:x,y" -> { radius, flicker }
        let polyLights = [];   // Array of { mapName, points: [{x,y}], intensity, flicker }
        let polyLightDrawing = false;  // True when drawing a polygon light
        let polyLightPoints = [];      // Current polygon being drawn

        let map = [];

        // Canvas refs
        const collisionTilesetCanvas = document.getElementById('collisionTilesetCanvas');
        const collisionTilesetCtx = collisionTilesetCanvas.getContext('2d');
        const paintTilesetCanvas = document.getElementById('paintTilesetCanvas');
        const paintTilesetCtx = paintTilesetCanvas.getContext('2d');
        const mapCanvas = document.getElementById('mapCanvas');
        const mapCtx = mapCanvas.getContext('2d');
        const propTilesetCanvas = document.getElementById('propTilesetCanvas');
        const propTilesetCtx = propTilesetCanvas ? propTilesetCanvas.getContext('2d') : null;

        // ===== PROP TOOLS =====
        function setPropTool(tool) {
            propTool = tool;
            document.getElementById('propToolSelect').classList.remove('active');
            document.getElementById('propToolCollision').classList.remove('active');
            document.getElementById('propToolErase').classList.remove('active');
            document.getElementById('propTool' + tool.charAt(0).toUpperCase() + tool.slice(1)).classList.add('active');

            // Show/hide brush controls
            document.getElementById('propBrushControls').style.display =
                (tool === 'collision' || tool === 'erase') ? 'block' : 'none';

            // Update cursor
            if (propTilesetCanvas) propTilesetCanvas.style.cursor = (tool === 'select') ? 'crosshair' : 'cell';

            drawPropTileset();
        }

        function setPropBrushSize(size) {
            propBrushSize = size;
            document.querySelectorAll('[id^="propBrush"]').forEach(b => b.classList.remove('active'));
            document.getElementById('propBrush' + size).classList.add('active');
        }

        // ===== PHASE MANAGEMENT =====
        let keepLoadPhaseVisible = false; // Flag to keep loading screen visible during adventure mode
        function setPhase(phase) {
            currentPhase = phase;
            document.querySelectorAll('.phase').forEach(p => p.classList.remove('active'));
            document.getElementById(phase + 'Phase').classList.add('active');
            // Keep loadPhase visible if flag is set (adventure mode loading)
            if (keepLoadPhaseVisible) {
                document.getElementById('loadPhase').classList.add('active');
            }

            // Start/stop editor animation loop based on phase
            if (phase === 'build') {
                startEditorAnimLoop();
            } else {
                stopEditorAnimLoop();
            }
        }

        // Animation loop for animated props in the editor
        function startEditorAnimLoop() {
            if (editorAnimInterval) return;
            editorAnimInterval = setInterval(() => {
                let needsRender = false;

                // Scan all layers for animTile cells
                for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
                    const layer = layers[layerIdx];
                    if (!layer) continue;

                    for (let y = 0; y < layer.length; y++) {
                        if (!layer[y]) continue;
                        for (let x = 0; x < layer[y].length; x++) {
                            const cell = layer[y][x];
                            if (!cell || cell.type !== 'animTile') continue;

                            const prop = animatedProps[cell.propIndex];
                            if (!prop || !prop.frames || prop.frames.length <= 1) continue;
                            if (prop.type !== 'loop') continue;

                            const key = x + ',' + y + ',' + layerIdx;
                            if (!placedAnimPropFrames[key]) {
                                placedAnimPropFrames[key] = { frame: 0, timer: 0, waiting: false, waitTimer: 0, playCount: 0 };
                            }
                            const state = placedAnimPropFrames[key];
                            const instanceSpeed = cell.instanceSpeed || 1;
                            const fps = (prop.fps || 8) * instanceSpeed;
                            const frameDelay = Math.round(60 / fps);
                            // Use instance settings if set, otherwise fall back to prop defaults
                            const playMode = cell.instancePlayMode || prop.playMode || 'loop';
                            const waitTime = ((cell.instanceWaitTime !== undefined ? cell.instanceWaitTime : prop.waitTime) || 2) * 60;
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
                                continue;
                            }

                            state.timer++;
                            if (state.timer >= frameDelay) {
                                state.timer = 0;
                                state.frame++;

                                // Handle end of animation
                                if (state.frame >= prop.frames.length) {
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
                                needsRender = true;
                            }
                        }
                    }
                }

                if (needsRender) renderMap();
            }, 1000 / 60); // 60fps update
        }

        function stopEditorAnimLoop() {
            if (editorAnimInterval) {
                clearInterval(editorAnimInterval);
                editorAnimInterval = null;
            }
        }

        // ===== LOAD PHASE =====
        function loadTileset(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Add as first tileset
                    tilesets = [{ name: file.name, img: img, data: e.target.result }];
                    currentTilesetIndex = 0;
                    tilesetImg = img;
                    updateTilesetDropdown();
                    setPhase('collision');
                    rebuildCollisionView();
                    // Broadcast to other builders
                    broadcastEdit({ editType: 'addTileset', name: file.name, data: e.target.result });
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        function addTileset(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    tilesets.push({ name: file.name, img: img, data: e.target.result });
                    currentTilesetIndex = tilesets.length - 1;
                    tilesetImg = img;
                    updateTilesetDropdown();
                    drawPaintTileset();
                    drawPropTileset();
                    // Broadcast to other builders
                    broadcastEdit({ editType: 'addTileset', name: file.name, data: e.target.result });
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
            event.target.value = ''; // Reset input so same file can be selected again
        }

        function switchTileset() {
            // Legacy function - now handled by selectTilesetFromPicker
            if (tilesets[currentTilesetIndex]) {
                tilesetImg = tilesets[currentTilesetIndex].img;
            }
            selectedTileData = null;
            selectedTiles = [];
            drawPaintTileset();
            drawPropTileset();
            renderMap();
        }

        function updateTilesetDropdown() {
            // Update the picker button with current tileset
            const thumb = document.getElementById('tilesetPickerThumb');
            const name = document.getElementById('tilesetPickerName');
            const dropdownList = document.getElementById('tilesetDropdownList');
            const sortBtn = document.getElementById('tilesetSortBtn');

            if (!thumb || !name || !dropdownList) return;

            if (tilesets.length > 0 && tilesets[currentTilesetIndex]) {
                const ts = tilesets[currentTilesetIndex];
                thumb.src = ts.data || '';
                thumb.style.display = ts.data ? 'block' : 'none';
                name.textContent = ts.name || 'Untitled';
            } else {
                thumb.src = '';
                thumb.style.display = 'none';
                name.textContent = 'No tileset';
            }

            // Update sort button text
            if (sortBtn) {
                sortBtn.textContent = tilesetSortOrder === 'alpha' ? 'A-Z' : '1-2-3';
                sortBtn.title = tilesetSortOrder === 'alpha' ? 'Sorted alphabetically (click for order added)' : 'Sorted by order added (click for alphabetical)';
            }

            // Create array with original indices
            let tilesetsWithIndex = tilesets.map((ts, i) => ({ ts, originalIndex: i }));

            // Filter by search term
            if (tilesetSearchTerm) {
                const term = tilesetSearchTerm.toLowerCase();
                tilesetsWithIndex = tilesetsWithIndex.filter(item =>
                    (item.ts.name || '').toLowerCase().includes(term)
                );
            }

            // Sort by order
            if (tilesetSortOrder === 'alpha') {
                tilesetsWithIndex.sort((a, b) =>
                    (a.ts.name || '').localeCompare(b.ts.name || '')
                );
            }

            // Build dropdown items
            dropdownList.innerHTML = '';
            tilesetsWithIndex.forEach(({ ts, originalIndex }) => {
                const item = document.createElement('div');
                item.className = 'tileset-picker-item' + (originalIndex === currentTilesetIndex ? ' selected' : '');
                item.onclick = () => selectTilesetFromPicker(originalIndex);

                const itemThumb = document.createElement('img');
                itemThumb.className = 'thumb';
                itemThumb.src = ts.data || '';

                const info = document.createElement('div');
                info.className = 'info';

                const itemName = document.createElement('div');
                itemName.className = 'name';
                itemName.textContent = ts.name || 'Untitled';

                const size = document.createElement('div');
                size.className = 'size';
                if (ts.img) {
                    size.textContent = ts.img.width + ' x ' + ts.img.height + ' px';
                }

                info.appendChild(itemName);
                info.appendChild(size);
                item.appendChild(itemThumb);
                item.appendChild(info);
                dropdownList.appendChild(item);
            });

            if (tilesetsWithIndex.length === 0 && tilesetSearchTerm) {
                dropdownList.innerHTML = '<div style="padding:10px; color:#888; text-align:center; font-size:11px;">No matching tilesets</div>';
            }
        }

        function filterTilesets(term) {
            tilesetSearchTerm = term;
            updateTilesetDropdown();
        }

        function toggleTilesetSort() {
            tilesetSortOrder = tilesetSortOrder === 'added' ? 'alpha' : 'added';
            updateTilesetDropdown();
        }

        function toggleTilesetPicker() {
            const dropdown = document.getElementById('tilesetPickerDropdown');
            if (dropdown) {
                dropdown.classList.toggle('open');
            }
        }

        function selectTilesetFromPicker(index) {
            currentTilesetIndex = index;
            tilesetImg = tilesets[currentTilesetIndex].img;
            selectedTileData = null;
            selectedTiles = [];

            // Close dropdown
            const dropdown = document.getElementById('tilesetPickerDropdown');
            if (dropdown) dropdown.classList.remove('open');

            // Update UI
            updateTilesetDropdown();
            drawPaintTileset();
            drawPropTileset();
            renderMap();
        }

        // ===== Find Tileset: click a tile on the map to discover which tileset it's from =====
        let findTilesetMode = false;
        function toggleFindTilesetMode() {
            findTilesetMode = !findTilesetMode;
            if (findTilesetMode) copyMode = false; // don't fight the copy click-capture
            const btn = document.getElementById('findTilesetBtn');
            if (btn) {
                btn.classList.toggle('active', findTilesetMode);
                btn.textContent = findTilesetMode ? '✕ Cancel — click a tile' : '🔍 Find Tileset';
            }
            if (typeof mapCanvas !== 'undefined' && mapCanvas) mapCanvas.style.cursor = findTilesetMode ? 'help' : '';
            const res = document.getElementById('findTilesetResult');
            if (res && !findTilesetMode) res.style.display = 'none';
        }

        function findTilesetAt(x, y) {
            const res = document.getElementById('findTilesetResult');
            // Find the top-most VISIBLE tile cell at this spot — that's what the user clicked on.
            let found = null;
            for (let li = layers.length - 1; li >= 0; li--) {
                if (!layerVisibility[li]) continue;
                const row = layers[li] && layers[li][y];
                const cell = row && row[x];
                if (cell && cell.type === 'tile') { found = cell; break; }
            }
            if (!found) {
                if (res) { res.style.display = 'block'; res.style.color = '#f88'; res.textContent = 'No tile at that spot — try another (hidden layers are skipped).'; }
                return;
            }
            const idx = found.tilesetIndex || 0;
            const ts = tilesets[idx];
            const name = ts ? ts.name : ('Tileset #' + idx);
            if (ts) selectTilesetFromPicker(idx); // select it so collisions can be edited right away
            if (res) {
                res.style.display = 'block';
                res.style.color = '#5cf';
                res.textContent = 'From “' + name + '” (#' + idx + ') — selected. Now hit “Edit Tile Collisions”.';
            }
            console.log('[FIND TILESET] tile at', x + ',' + y, '-> tileset #' + idx, name);
            // One pick, then exit the mode.
            findTilesetMode = false;
            const btn = document.getElementById('findTilesetBtn');
            if (btn) { btn.classList.remove('active'); btn.textContent = '🔍 Find Tileset'; }
            if (typeof mapCanvas !== 'undefined' && mapCanvas) mapCanvas.style.cursor = '';
        }

        // Close tileset picker when clicking outside
        document.addEventListener('click', function(e) {
            const picker = document.getElementById('tilesetPicker');
            const dropdown = document.getElementById('tilesetPickerDropdown');
            if (picker && dropdown && !picker.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });

        function deleteTileset(fromNetwork = false, networkTilesetIndex = null) {
            const tilesetIndexToDelete = fromNetwork ? networkTilesetIndex : currentTilesetIndex;

            if (tilesets.length === 0) {
                if (!fromNetwork) alert('No tileset to delete');
                return;
            }
            if (tilesets.length === 1) {
                if (!fromNetwork) alert('Cannot delete the only tileset. Add another one first.');
                return;
            }

            const tileset = tilesets[tilesetIndexToDelete];
            if (!fromNetwork && !confirm('Delete tileset "' + tileset.name + '"?\n\nTiles from this tileset on the map will become empty.')) return;

            // Remove tiles from map that use this tileset
            layers.forEach(layer => {
                for (let y = 0; y < layer.length; y++) {
                    for (let x = 0; x < layer[y].length; x++) {
                        const tile = layer[y][x];
                        if (tile && tile.tilesetIndex === tilesetIndexToDelete) {
                            layer[y][x] = null;
                        } else if (tile && tile.tilesetIndex > tilesetIndexToDelete) {
                            // Adjust indices for tilesets after the deleted one
                            tile.tilesetIndex--;
                        }
                    }
                }
            });

            // Wave 5: rekey ALL four tileset-prefixed collision dicts (was only tileCollisions).
            // Prior bug left collisionMasks / tileSplitLines / tileSplitLineFlipped pointing at
            // wrong indices after a delete, corrupting saves silently.
            reindexTilesetReferences(tilesetIndexToDelete);

            // Broadcast before modifying tilesets array (need to send original index)
            if (!fromNetwork) {
                broadcastEdit({ editType: 'deleteTileset', index: tilesetIndexToDelete });
            }

            // Remove the tileset
            tilesets.splice(tilesetIndexToDelete, 1);

            // Update current index
            if (currentTilesetIndex >= tilesets.length) {
                currentTilesetIndex = tilesets.length - 1;
            }
            if (tilesets.length > 0) {
                tilesetImg = tilesets[currentTilesetIndex].img;
            }

            // Update UI
            updateTilesetDropdown();
            selectedTileData = null;
            selectedTiles = [];
            drawPaintTileset();
            renderMap();
        }

        // ===== PLAYER SPRITE =====
        function loadPlayerSprite(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                playerSpriteData = e.target.result;
                playerSpriteImg = new Image();
                playerSpriteImg.onload = () => {
                    // Update preview
                    const preview = document.getElementById('playerSpritePreview');
                    const ctx = preview.getContext('2d');
                    ctx.clearRect(0, 0, 48, 48);
                    ctx.imageSmoothingEnabled = false;
                    // Draw first frame (assuming 64x64 frames, top-left)
                    ctx.drawImage(playerSpriteImg, 0, 0, 64, 64, 0, 0, 48, 48);
                    document.getElementById('playerSpriteInfo').textContent =
                        file.name + ' (' + playerSpriteImg.naturalWidth + 'x' + playerSpriteImg.naturalHeight + ')';
                };
                playerSpriteImg.src = playerSpriteData;
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        }

        function updatePlayerSpritePreview() {
            const preview = document.getElementById('playerSpritePreview');
            if (!preview) return;
            const ctx = preview.getContext('2d');
            ctx.clearRect(0, 0, 48, 48);

            if (playerSpriteImg && playerSpriteImg.complete && playerSpriteImg.naturalWidth > 0) {
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(playerSpriteImg, 0, 0, 64, 64, 0, 0, 48, 48);
            }
        }

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

        // ===== BUILD PHASE =====
        function initMap() {
            // Initialize with one layer
            layers = [createEmptyLayer()];
            layerVisibility = [true];
            layerNames = [''];
            currentLayer = 0;
            map = layers[0]; // map points to current layer for compatibility
            renderLayerList();
        }

        function createEmptyLayer() {
            const layer = [];
            for (let y = 0; y < mapRows; y++) {
                layer[y] = [];
                for (let x = 0; x < mapCols; x++) {
                    layer[y][x] = null;
                }
            }
            return layer;
        }

        function addLayer(fromNetwork = false) {
            layers.push(createEmptyLayer());
            layerVisibility.push(true);
            layerNames.push('');
            currentLayer = layers.length - 1;
            map = layers[currentLayer];
            renderLayerList();
            renderMap();

            // Broadcast to other builders
            if (!fromNetwork) {
                broadcastEdit({ editType: 'addLayer', mapName: currentMapName });
            }
        }

        function selectLayer(index) {
            currentLayer = index;
            map = layers[currentLayer];
            renderLayerList();
            renderMap();
        }

        function toggleLayerVisibility(index) {
            layerVisibility[index] = !layerVisibility[index];
            renderLayerList();
            renderMap();
        }

        function deleteLayer(index, fromNetwork = false) {
            if (layers.length <= 1) return alert('Need at least one layer');
            if (!fromNetwork) {
                const layerLabel = layerNames[index] ? `"${layerNames[index]}"` : `Layer ${index}`;
                if (!confirm('Delete ' + layerLabel + '?')) return;
            }
            layers.splice(index, 1);
            layerVisibility.splice(index, 1);
            layerNames.splice(index, 1);
            if (currentLayer >= layers.length) currentLayer = layers.length - 1;
            map = layers[currentLayer];
            if (!fromNetwork) {
                broadcastEdit({ editType: 'deleteLayer', index: index, mapName: currentMapName });
            }
            renderLayerList();
            renderMap();
        }

        function moveLayerUp(index, fromNetwork = false) {
            if (index <= 0) return;
            [layers[index], layers[index-1]] = [layers[index-1], layers[index]];
            [layerVisibility[index], layerVisibility[index-1]] = [layerVisibility[index-1], layerVisibility[index]];
            [layerNames[index], layerNames[index-1]] = [layerNames[index-1], layerNames[index]];
            if (currentLayer === index) currentLayer--;
            else if (currentLayer === index - 1) currentLayer++;
            map = layers[currentLayer];
            if (!fromNetwork) {
                broadcastEdit({ editType: 'moveLayerUp', index: index, mapName: currentMapName });
            }
            renderLayerList();
            renderMap();
        }

        function moveLayerDown(index, fromNetwork = false) {
            if (index >= layers.length - 1) return;
            [layers[index], layers[index+1]] = [layers[index+1], layers[index]];
            [layerVisibility[index], layerVisibility[index+1]] = [layerVisibility[index+1], layerVisibility[index]];
            [layerNames[index], layerNames[index+1]] = [layerNames[index+1], layerNames[index]];
            if (currentLayer === index) currentLayer++;
            else if (currentLayer === index + 1) currentLayer--;
            map = layers[currentLayer];
            if (!fromNetwork) {
                broadcastEdit({ editType: 'moveLayerDown', index: index, mapName: currentMapName });
            }
            renderLayerList();
            renderMap();
        }

        function renderLayerList() {
            // Render to both layer lists (tileset mode and animProp mode)
            const lists = [
                document.getElementById('layerList'),
                document.getElementById('animPropLayerList')
            ];

            for (const list of lists) {
                if (!list) continue;
                list.innerHTML = '';

                // Insert player layer row at the right position
                // Player layer is rendered BETWEEN layers[playerLayerIndex-1] and layers[playerLayerIndex]
                // So we need to show it after displaying layer playerLayerIndex-1

                for (let i = 0; i < layers.length; i++) {
                    // If this is where the player layer should appear, show it first
                    if (i === playerLayerIndex) {
                        list.appendChild(createPlayerLayerRow());
                    }

                    const div = document.createElement('div');
                    div.style.cssText = 'display:flex; align-items:center; gap:5px; padding:5px; margin:3px 0; background:' + (i === currentLayer ? '#4af' : '#333') + '; border-radius:4px; font-size:11px;';

                    const layerLabel = layerNames[i] ? `Layer ${i} (${layerNames[i]})` : `Layer ${i}`;

                    div.innerHTML = `
                        <input type="checkbox" ${layerVisibility[i] ? 'checked' : ''} onclick="toggleLayerVisibility(${i})" title="Visibility">
                        <span style="flex:1; cursor:pointer; color:${i === currentLayer ? '#000' : '#fff'};" onclick="selectLayer(${i})">${layerLabel}</span>
                        <button onclick="renameLayer(${i})" style="padding:2px 5px; font-size:10px;" title="Rename">✎</button>
                        <button onclick="moveLayerUp(${i})" style="padding:2px 5px; font-size:10px;">↑</button>
                        <button onclick="moveLayerDown(${i})" style="padding:2px 5px; font-size:10px;">↓</button>
                        <button onclick="deleteLayer(${i})" style="padding:2px 5px; font-size:10px; background:#a55;">X</button>
                    `;
                    list.appendChild(div);
                }

                // If player layer is at the end (beyond all layers)
                if (playerLayerIndex >= layers.length) {
                    list.appendChild(createPlayerLayerRow());
                }
            }
        }

        function createPlayerLayerRow() {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; align-items:center; gap:5px; padding:5px; margin:3px 0; background:#f0a; border-radius:4px; font-size:11px;';

            div.innerHTML = `
                <input type="checkbox" ${playerPreviewVisible ? 'checked' : ''} onclick="togglePlayerPreview()" title="Visibility">
                <span style="flex:1; color:#000;">🧍 PLAYER</span>
                <span style="color:#000; font-size:9px; opacity:0.7;">locked</span>
                <button onclick="movePlayerLayerUp()" style="padding:2px 5px; font-size:10px;">↑</button>
                <button onclick="movePlayerLayerDown()" style="padding:2px 5px; font-size:10px;">↓</button>
            `;
            return div;
        }

        function togglePlayerPreview() {
            playerPreviewVisible = !playerPreviewVisible;
            renderLayerList();
            renderMap();
        }

        function toggleSetSpawnMode() {
            setSpawnMode = !setSpawnMode;
            const btn = document.getElementById('setSpawnBtn');
            const canvas = document.getElementById('mapCanvas');

            if (setSpawnMode) {
                btn.classList.add('active');
                btn.textContent = 'CLICK MAP';
                canvas.style.cursor = 'crosshair';
            } else {
                btn.classList.remove('active');
                btn.textContent = 'SPAWN';
                canvas.style.cursor = grabToolActive ? 'grab' : 'crosshair';
            }
        }

        function movePlayerLayerUp() {
            if (playerLayerIndex > 0) {
                playerLayerIndex--;
                renderLayerList();
                renderMap();
            }
        }

        function movePlayerLayerDown() {
            if (playerLayerIndex < layers.length) {
                playerLayerIndex++;
                renderLayerList();
                renderMap();
            }
        }

        function renameLayer(index, newName = null, fromNetwork = false) {
            if (!fromNetwork) {
                const currentName = layerNames[index] || '';
                newName = prompt('Enter nickname for Layer ' + index + ':', currentName);
            }
            if (newName !== null) {
                layerNames[index] = newName.trim ? newName.trim() : newName;
                if (!fromNetwork) {
                    broadcastEdit({ editType: 'renameLayer', index: index, name: layerNames[index], mapName: currentMapName });
                }
                renderLayerList();
            }
        }

        function setMode(m) {
            mode = m;
            // Turn off edit modes when switching away from animProp
            if (m !== 'animProp') {
                if (editAnimPropOnMapMode) {
                    editAnimPropOnMapMode = false;
                    const btn = document.getElementById('editAnimPropOnMapBtn');
                    if (btn) {
                        btn.classList.remove('active');
                        btn.textContent = 'Edit Object on Map';
                    }
                }
                if (editStaticObjOnMapMode) {
                    editStaticObjOnMapMode = false;
                    const btn = document.getElementById('editStaticObjOnMapBtn');
                    if (btn) {
                        btn.classList.remove('active');
                        btn.style.background = '#4a7c59';
                        btn.textContent = 'Edit Static Object Collision';
                    }
                }
            }
            // Turn off fish-zone draw mode when leaving the Fishing tab so it can't keep
            // intercepting map drags / forcing redraws in other tools.
            if (m !== 'fish' && typeof settingFishZones !== 'undefined' && settingFishZones) {
                settingFishZones = false;
                fishZoneDragStart = null;
                fishZoneDragEnd = null;
                const fb = document.getElementById('setFishZonesBtn');
                if (fb) { fb.textContent = 'Add Zone'; fb.style.background = '#484'; }
            }
            // Sidebar tabs
            document.getElementById('tileMode').classList.toggle('active', m === 'tile');
            document.getElementById('playerMode').classList.toggle('active', m === 'player');
            document.getElementById('npcMode').classList.toggle('active', m === 'npc');
            document.getElementById('animPropMode').classList.toggle('active', m === 'animProp');
            document.getElementById('soundMode').classList.toggle('active', m === 'sound');
            document.getElementById('lightingMode').classList.toggle('active', m === 'lighting');
            document.getElementById('triggerMode').classList.toggle('active', m === 'trigger');
            document.getElementById('cameraMode').classList.toggle('active', m === 'camera');
            if (document.getElementById('fishMode')) document.getElementById('fishMode').classList.toggle('active', m === 'fish');
            document.getElementById('dialogMode').classList.toggle('active', m === 'dialog');
            document.getElementById('itemMode').classList.toggle('active', m === 'item');
            document.getElementById('questMode').classList.toggle('active', m === 'quest');
            document.getElementById('shopMode').classList.toggle('active', m === 'shop');
            // Toolbar tabs
            document.getElementById('tileMode2').classList.toggle('active', m === 'tile');
            if (document.getElementById('playerMode2')) document.getElementById('playerMode2').classList.toggle('active', m === 'player');
            document.getElementById('npcMode2').classList.toggle('active', m === 'npc');
            document.getElementById('animPropMode2').classList.toggle('active', m === 'animProp');
            document.getElementById('soundMode2').classList.toggle('active', m === 'sound');
            document.getElementById('lightingMode2').classList.toggle('active', m === 'lighting');
            document.getElementById('triggerMode2').classList.toggle('active', m === 'trigger');
            document.getElementById('cameraMode2').classList.toggle('active', m === 'camera');
            if (document.getElementById('fishMode2')) document.getElementById('fishMode2').classList.toggle('active', m === 'fish');
            document.getElementById('dialogMode2').classList.toggle('active', m === 'dialog');
            document.getElementById('itemMode2').classList.toggle('active', m === 'item');
            document.getElementById('questMode2').classList.toggle('active', m === 'quest');
            document.getElementById('shopMode2').classList.toggle('active', m === 'shop');
            document.getElementById('tileModeContent').style.display = m === 'tile' ? 'block' : 'none';
            document.getElementById('playerModeContent').style.display = m === 'player' ? 'block' : 'none';
            document.getElementById('npcModeContent').style.display = m === 'npc' ? 'block' : 'none';
            document.getElementById('animPropModeContent').style.display = m === 'animProp' ? 'block' : 'none';
            document.getElementById('soundModeContent').style.display = m === 'sound' ? 'block' : 'none';
            document.getElementById('lightingModeContent').style.display = m === 'lighting' ? 'block' : 'none';
            document.getElementById('triggerModeContent').style.display = m === 'trigger' ? 'block' : 'none';
            document.getElementById('cameraModeContent').style.display = m === 'camera' ? 'block' : 'none';
            if (document.getElementById('fishModeContent')) document.getElementById('fishModeContent').style.display = m === 'fish' ? 'block' : 'none';
            document.getElementById('dialogModeContent').style.display = m === 'dialog' ? 'block' : 'none';
            document.getElementById('itemModeContent').style.display = m === 'item' ? 'block' : 'none';
            document.getElementById('questModeContent').style.display = m === 'quest' ? 'block' : 'none';
            document.getElementById('shopModeContent').style.display = m === 'shop' ? 'block' : 'none';

            // Update mode label for mobile
            const labels = { tile: 'Tiles', player: 'Player', npc: 'NPCs', animProp: 'Animated', sound: 'Sounds', lighting: 'Lights', trigger: 'Triggers', camera: 'Camera', fish: 'Fishing', dialog: 'Dialogs', item: 'Items', quest: 'Quests', shop: 'Shops' };
            document.getElementById('currentModeLabel').textContent = labels[m] || m;

            // Collapse menu on mobile after selection
            document.getElementById('modeTabs').classList.remove('expanded');

            // Update lists when switching modes
            if (m === 'player') updatePlayerList();
            if (m === 'npc') updateNpcList();
            if (m === 'trigger') {
                updateMapDropdowns();
                updateTriggerList();
            }
            if (m === 'camera') {
                updateMapDropdowns();
                updateCameraBoundsInfo();
            }
            if (m === 'fish') {
                updateMapDropdowns();
                updateFishZonesInfo();
                renderFishingLoot();
            }
            if (m === 'dialog') {
                updateDialogList();
                updateDialogNpcDropdown();
            }
            if (m === 'item') {
                updateItemList();
                updateItemLayerDropdown();
            }
            if (m === 'quest') {
                renderQuestList();
                updateQuestNpcDropdowns();
            }
            if (m === 'shop') {
                updateShopList();
                updateNpcShopList();
            }

            // Redraw map to show appropriate overlays
            renderMap();
        }

        function toggleModeMenu() {
            document.getElementById('modeTabs').classList.toggle('expanded');
        }

        // Sidebar resize functionality
        (function() {
            const panel = document.getElementById('leftPanel');
            const handle = document.getElementById('sidebarResize');
            if (!panel || !handle) return;

            let isResizing = false;

            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                handle.classList.add('active');
                document.body.style.cursor = 'ew-resize';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                const newWidth = e.clientX;
                if (newWidth >= 100 && newWidth <= 600) {
                    panel.style.width = newWidth + 'px';
                }
            });

            document.addEventListener('mouseup', () => {
                isResizing = false;
                handle.classList.remove('active');
                document.body.style.cursor = '';
            });

            // Touch support for resize
            handle.addEventListener('touchstart', (e) => {
                isResizing = true;
                handle.classList.add('active');
                e.preventDefault();
            }, { passive: false });

            document.addEventListener('touchmove', (e) => {
                if (!isResizing) return;
                const touch = e.touches[0];
                const newWidth = touch.clientX;
                if (newWidth >= 100 && newWidth <= 600) {
                    panel.style.width = newWidth + 'px';
                }
            }, { passive: false });

            document.addEventListener('touchend', () => {
                isResizing = false;
                handle.classList.remove('active');
            });
        })();

        // ===== SOUND MANAGEMENT =====
        function loadSound(event, soundType = 'ambient') {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                const audio = new Audio(e.target.result);
                audio.addEventListener('loadedmetadata', function() {
                    sounds.push({
                        name: file.name,
                        data: e.target.result,
                        duration: audio.duration || 0,
                        type: soundType
                    });
                    updateSoundDropdown();
                    currentSoundIndex = sounds.length - 1;
                    // Update the appropriate dropdown based on type
                    if (soundType === 'ambient') {
                        const selectEl = document.getElementById('soundSelect');
                        const controlsEl = document.getElementById('soundControls');
                        if (selectEl) selectEl.value = currentSoundIndex;
                        if (controlsEl) controlsEl.style.display = 'block';
                    } else if (soundType === 'player') {
                        const selectEl = document.getElementById('playerSoundSelect');
                        if (selectEl) selectEl.value = currentSoundIndex;
                        updatePlayerSoundsList();
                    } else if (soundType === 'music') {
                        updateMusicSoundsList();
                    }
                });
                audio.addEventListener('error', function() {
                    console.error('Failed to load audio metadata');
                    sounds.push({
                        name: file.name,
                        data: e.target.result,
                        duration: 0,
                        type: soundType
                    });
                    updateSoundDropdown();
                    currentSoundIndex = sounds.length - 1;
                    if (soundType === 'ambient') {
                        const selectEl = document.getElementById('soundSelect');
                        const controlsEl = document.getElementById('soundControls');
                        if (selectEl) selectEl.value = currentSoundIndex;
                        if (controlsEl) controlsEl.style.display = 'block';
                    } else if (soundType === 'player') {
                        const selectEl = document.getElementById('playerSoundSelect');
                        if (selectEl) selectEl.value = currentSoundIndex;
                        updatePlayerSoundsList();
                    } else if (soundType === 'music') {
                        updateMusicSoundsList();
                    }
                });
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        }

        function updatePlayerSoundsList() {
            const container = document.getElementById('playerSoundsList');
            if (!container) return;
            const playerSoundsList = sounds.filter(s => s.type === 'player');
            if (playerSoundsList.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px;">No player sounds loaded</div>';
            } else {
                container.innerHTML = playerSoundsList.map((s, i) => {
                    const realIdx = sounds.findIndex(snd => snd === s);
                    return `<div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0; border-bottom:1px solid #333;">
                        <span style="color:#8f8; font-size:10px;">${s.name}</span>
                        <button onclick="deleteSound(${realIdx})" style="padding:1px 5px; font-size:9px; background:#633;">×</button>
                    </div>`;
                }).join('');
            }
        }

        function updateMusicSoundsList() {
            const container = document.getElementById('musicSoundsList');
            if (!container) return;
            const musicList = sounds.filter(s => s.type === 'music');
            if (musicList.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px;">No music loaded</div>';
            } else {
                container.innerHTML = musicList.map((s, i) => {
                    const realIdx = sounds.findIndex(snd => snd === s);
                    return `<div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0; border-bottom:1px solid #333;">
                        <span style="color:#fa0; font-size:10px;">${s.name}</span>
                        <button onclick="deleteSound(${realIdx})" style="padding:1px 5px; font-size:9px; background:#633;">×</button>
                    </div>`;
                }).join('');
            }
        }

        function deleteSound(idx) {
            if (idx < 0 || idx >= sounds.length) return;
            if (!confirm('Delete "' + sounds[idx].name + '"?')) return;
            sounds.splice(idx, 1);
            // Update indices in playerSounds
            ['walk', 'attack', 'inventoryOpen', 'inventoryClose'].forEach(action => {
                if (playerSounds[action] && playerSounds[action].soundIndex === idx) {
                    playerSounds[action].soundIndex = -1;
                } else if (playerSounds[action] && playerSounds[action].soundIndex > idx) {
                    playerSounds[action].soundIndex--;
                }
            });
            // Update tileSounds indices
            Object.keys(tileSounds).forEach(key => {
                if (tileSounds[key].soundIndex === idx) {
                    delete tileSounds[key];
                } else if (tileSounds[key].soundIndex > idx) {
                    tileSounds[key].soundIndex--;
                }
            });
            updateSoundDropdown();
            updatePlayerSoundsList();
            updateMusicSoundsList();
            updatePlayerSoundAssignments();
            updatePlacedSoundsList();
        }

        function switchSound() {
            const selectEl = document.getElementById('soundSelect');
            const controlsEl = document.getElementById('soundControls');
            currentSoundIndex = selectEl ? parseInt(selectEl.value) : -1;
            if (controlsEl) controlsEl.style.display = currentSoundIndex >= 0 ? 'block' : 'none';
            stopPreview();
        }

        function updateSoundDropdown() {
            // Update main sound dropdown (ambient only for tile sounds)
            updateFilteredSoundDropdown('soundSelect', 'ambient');
            // Update player sound dropdown
            updateFilteredSoundDropdown('playerSoundSelect', 'player');
            // Update shop music dropdown
            updateFilteredSoundDropdown('shopEditorMusic', 'music');
        }

        function updateFilteredSoundDropdown(selectId, typeFilter) {
            const select = document.getElementById(selectId);
            if (!select) return;
            const currentVal = select.value;
            select.innerHTML = '<option value="-1">-- Select Sound --</option>';
            sounds.forEach((sound, idx) => {
                if (!typeFilter || sound.type === typeFilter) {
                    const opt = document.createElement('option');
                    opt.value = idx;
                    opt.textContent = sound.name;
                    select.appendChild(opt);
                }
            });
            // Restore selection if still valid
            if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
                select.value = currentVal;
            }
        }

        function previewSound() {
            if (currentSoundIndex < 0 || !sounds[currentSoundIndex]) return;
            stopPreview();
            previewAudio = new Audio(sounds[currentSoundIndex].data);
            const volumeEl = document.getElementById('soundVolume');
            previewAudio.volume = volumeEl ? volumeEl.value / 100 : 0.5;
            previewAudio.play();
        }

        function stopPreview() {
            if (previewAudio) {
                previewAudio.pause();
                previewAudio.currentTime = 0;
                previewAudio = null;
            }
        }

        function setSoundAttachMode(attachMode) {
            soundAttachMode = attachMode;
            // Tile mode is now the only mode in Sound tab
            // Player sounds moved to Player tab
            renderMap();
        }

        function assignPlayerSound() {
            const playerSoundSelectEl = document.getElementById('playerSoundSelect');
            const selectedSoundIndex = playerSoundSelectEl ? parseInt(playerSoundSelectEl.value) : -1;

            if (selectedSoundIndex < 0) {
                alert('Select a sound first');
                return;
            }
            const actionEl = document.getElementById('playerActionSelect');
            const volumeEl = document.getElementById('playerSoundVolume');
            const intervalEl = document.getElementById('walkInterval');
            const walkPitchEl = document.getElementById('walkPitch');
            const attackPitchEl = document.getElementById('attackPitch');
            const attackLengthEl = document.getElementById('attackLength');

            const action = actionEl ? actionEl.value : 'walk';
            playerSounds[action].soundIndex = selectedSoundIndex;
            playerSounds[action].volume = volumeEl ? volumeEl.value / 100 : 0.5;
            if (action === 'walk') {
                playerSounds.walk.interval = intervalEl ? parseInt(intervalEl.value) : 200;
                playerSounds.walk.pitchVariation = walkPitchEl ? parseInt(walkPitchEl.value) / 100 : 0.1;
            } else if (action === 'attack') {
                playerSounds.attack.pitchVariation = attackPitchEl ? parseInt(attackPitchEl.value) / 100 : 0.15;
                playerSounds.attack.lengthVariation = attackLengthEl ? parseInt(attackLengthEl.value) / 100 : 0;
            }
            updatePlayerSoundAssignments();
        }

        function updatePlayerSoundAssignments() {
            const container = document.getElementById('playerSoundAssignments');
            if (!container) return;
            let html = '';
            if (playerSounds.walk.soundIndex >= 0) {
                html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span>Walk: ${sounds[playerSounds.walk.soundIndex]?.name || 'Unknown'}</span>
                    <button onclick="clearPlayerSound('walk')" style="background:#a33; border:none; color:#fff; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px;">X</button>
                </div>`;
            }
            if (playerSounds.attack.soundIndex >= 0) {
                html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span>Attack: ${sounds[playerSounds.attack.soundIndex]?.name || 'Unknown'}</span>
                    <button onclick="clearPlayerSound('attack')" style="background:#a33; border:none; color:#fff; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px;">X</button>
                </div>`;
            }
            if (playerSounds.inventoryOpen && playerSounds.inventoryOpen.soundIndex >= 0) {
                html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span>Inv Open: ${sounds[playerSounds.inventoryOpen.soundIndex]?.name || 'Unknown'}</span>
                    <button onclick="clearPlayerSound('inventoryOpen')" style="background:#a33; border:none; color:#fff; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px;">X</button>
                </div>`;
            }
            if (playerSounds.inventoryClose && playerSounds.inventoryClose.soundIndex >= 0) {
                html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span>Inv Close: ${sounds[playerSounds.inventoryClose.soundIndex]?.name || 'Unknown'}</span>
                    <button onclick="clearPlayerSound('inventoryClose')" style="background:#a33; border:none; color:#fff; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px;">X</button>
                </div>`;
            }
            container.innerHTML = html || '<div style="color:#888;">None assigned</div>';
        }

        function clearPlayerSound(action) {
            if (playerSounds[action]) {
                playerSounds[action].soundIndex = -1;
            }
            updatePlayerSoundAssignments();
        }

        function updatePlayerSoundUI() {
            const actionSelect = document.getElementById('playerActionSelect');
            const walkSettings = document.getElementById('walkSoundSettings');
            const attackSettings = document.getElementById('attackSoundSettings');
            if (!actionSelect) return;
            const action = actionSelect.value;
            if (walkSettings) walkSettings.style.display = action === 'walk' ? 'block' : 'none';
            if (attackSettings) attackSettings.style.display = action === 'attack' ? 'block' : 'none';

            // Update volume slider to current value for selected action
            const volumeSlider = document.getElementById('playerSoundVolume');
            const volumeVal = document.getElementById('playerSoundVolumeVal');

            if (playerSounds[action] && playerSounds[action].soundIndex >= 0) {
                const vol = Math.round((playerSounds[action].volume || 0.5) * 100);
                if (volumeSlider) volumeSlider.value = vol;
                if (volumeVal) volumeVal.textContent = vol;
            }

            if (action === 'attack' && playerSounds.attack.soundIndex >= 0) {
                // Update attack-specific sliders
                const pitchSlider = document.getElementById('attackPitch');
                const pitchVal = document.getElementById('attackPitchVal');
                const lengthSlider = document.getElementById('attackLength');
                const lengthVal = document.getElementById('attackLengthVal');
                if (pitchSlider) pitchSlider.value = playerSounds.attack.pitchVariation || 15;
                if (pitchVal) pitchVal.textContent = playerSounds.attack.pitchVariation || 15;
                if (lengthSlider) lengthSlider.value = playerSounds.attack.lengthVariation || 0;
                if (lengthVal) lengthVal.textContent = playerSounds.attack.lengthVariation || 0;
            }
        }

        function placeTileSound(gridX, gridY) {
            if (currentSoundIndex < 0) {
                alert('Select a sound first');
                return;
            }
            const radiusEl = document.getElementById('soundRadius');
            const loopEl = document.getElementById('soundLoop');
            const volumeEl = document.getElementById('soundVolume');
            const fadeEl = document.getElementById('soundFade');
            const key = `${currentMapName}:${gridX},${gridY}`;
            tileSounds[key] = {
                soundIndex: currentSoundIndex,
                radius: radiusEl ? parseInt(radiusEl.value) : 3,
                loop: loopEl ? loopEl.checked : true,
                volume: volumeEl ? volumeEl.value / 100 : 0.5,
                fadePercent: fadeEl ? parseInt(fadeEl.value) / 100 : 0.5
            };
            console.log('Placed tile sound:', key, tileSounds[key]);
            console.log('Total tile sounds:', Object.keys(tileSounds).length);
            // Broadcast to co-op builders
            broadcastEdit({ editType: 'tileSound', key: key, sound: tileSounds[key] });
            updatePlacedSoundsList();
            renderMap();
        }

        function removeTileSound(key) {
            delete tileSounds[key];
            // Broadcast to co-op builders
            broadcastEdit({ editType: 'removeTileSound', key: key });
            updatePlacedSoundsList();
            renderMap();
        }

        // Legacy saves stored main-map tile sounds as bare "x,y" keys (no map prefix). The runtime
        // treats those as the main map, but the builder UI filters by "mapName:". Normalize them to
        // "main:x,y" so the placed-sounds list and click-to-edit find them.
        function normalizeTileSoundKeys() {
            if (!tileSounds || typeof tileSounds !== 'object') return;
            for (const key of Object.keys(tileSounds)) {
                if (key.indexOf(':') === -1) {
                    if (!tileSounds['main:' + key]) tileSounds['main:' + key] = tileSounds[key];
                    delete tileSounds[key];
                }
            }
        }

        function updatePlacedSoundsList() {
            normalizeTileSoundKeys();
            const container = document.getElementById('placedSoundsList');
            if (!container) return;
            const keys = Object.keys(tileSounds).filter(k => k.startsWith(currentMapName + ':'));
            if (keys.length === 0) {
                container.innerHTML = '<div style="color:#888;">No sounds placed</div>';
                return;
            }
            container.innerHTML = keys.map(key => {
                const ts = tileSounds[key];
                const coords = key.split(':')[1]; // Get "x,y" part after map name
                const soundName = sounds[ts.soundIndex]?.name || 'Unknown';
                const isSelected = key === selectedTileSoundKey;
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:4px; margin:2px 0; background:${isSelected ? '#4a7c59' : '#333'}; border-radius:3px; cursor:pointer;" onclick="selectTileSound('${key}')">
                    <span style="flex:1;">📍 ${coords}: ${soundName}</span>
                    <button onclick="event.stopPropagation(); removeTileSound('${key}')" style="padding:2px 6px;">×</button>
                </div>`;
            }).join('');
        }

        function selectTileSound(key) {
            if (!tileSounds[key]) return;
            selectedTileSoundKey = key;
            const ts = tileSounds[key];

            // Populate UI with current values
            const radiusEl = document.getElementById('soundRadius');
            const loopEl = document.getElementById('soundLoop');
            const volumeEl = document.getElementById('soundVolume');
            const fadeEl = document.getElementById('soundFade');
            const selectEl = document.getElementById('soundSelect');

            if (radiusEl) {
                radiusEl.value = ts.radius || 3;
                document.getElementById('soundRadiusVal').textContent = ts.radius || 3;
            }
            if (loopEl) loopEl.checked = ts.loop !== false;
            if (volumeEl) {
                volumeEl.value = (ts.volume || 0.5) * 100;
                document.getElementById('soundVolumeVal').textContent = Math.round((ts.volume || 0.5) * 100);
            }
            if (fadeEl) {
                fadeEl.value = (ts.fadePercent !== undefined ? ts.fadePercent : 0.5) * 100;
                document.getElementById('soundFadeVal').textContent = Math.round((ts.fadePercent !== undefined ? ts.fadePercent : 0.5) * 100);
            }
            if (selectEl) selectEl.value = ts.soundIndex;
            currentSoundIndex = ts.soundIndex;

            // Show edit mode indicator
            document.getElementById('soundEditMode').style.display = 'block';
            document.getElementById('editingSoundKey').textContent = key;

            updatePlacedSoundsList();
            renderMap();
        }

        function deselectTileSound() {
            selectedTileSoundKey = null;
            document.getElementById('soundEditMode').style.display = 'none';
            updatePlacedSoundsList();
            renderMap();
        }

        function saveSelectedSound() {
            if (!selectedTileSoundKey || !tileSounds[selectedTileSoundKey]) {
                alert('No sound selected to save');
                return;
            }
            if (currentSoundIndex < 0) {
                alert('Select a sound first');
                return;
            }

            const radiusEl = document.getElementById('soundRadius');
            const loopEl = document.getElementById('soundLoop');
            const volumeEl = document.getElementById('soundVolume');
            const fadeEl = document.getElementById('soundFade');

            tileSounds[selectedTileSoundKey] = {
                soundIndex: currentSoundIndex,
                radius: radiusEl ? parseInt(radiusEl.value) : 3,
                loop: loopEl ? loopEl.checked : true,
                volume: volumeEl ? volumeEl.value / 100 : 0.5,
                fadePercent: fadeEl ? parseInt(fadeEl.value) / 100 : 0.5
            };

            console.log('Updated tile sound:', selectedTileSoundKey, tileSounds[selectedTileSoundKey]);
            broadcastEdit({ editType: 'tileSound', key: selectedTileSoundKey, sound: tileSounds[selectedTileSoundKey] });
            updatePlacedSoundsList();
            renderMap();
        }

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

        // ========== CREATE OBJECT MODE ==========
        function toggleCreateObjectMode() {
            if (!createObjectMode) {
                // Enter create object mode
                createObjectMode = true;
                tileSelectModeActive = true;
                selectedTiles = [];
                selectedTileData = null;

                const selectBtn = document.getElementById('tileSelectModeBtn');
                if (selectBtn) {
                    selectBtn.style.background = '#4af';
                    selectBtn.style.color = '#000';
                    selectBtn.textContent = 'Select Mode ON';
                }
            } else {
                // Finish - create object from selection
                if (selectedTileData && selectedTiles.length > 0) {
                    createStaticObjectFromSelection();
                } else {
                    alert('Please select tiles from the tileset first.');
                }

                // Exit mode
                createObjectMode = false;
                tileSelectModeActive = false;

                const selectBtn = document.getElementById('tileSelectModeBtn');
                if (selectBtn) {
                    selectBtn.style.background = '#555';
                    selectBtn.style.color = 'white';
                    selectBtn.textContent = 'Select Tiles';
                }
            }
            updateCreateObjectButton();
        }

        function updateCreateObjectButton() {
            const btn = document.getElementById('createObjectBtn');
            if (!btn) return;

            if (createObjectMode) {
                if (selectedTileData && selectedTiles.length > 0) {
                    btn.textContent = 'FINISH';
                    btn.style.background = '#c9a227';
                    btn.style.color = '#000';
                } else {
                    btn.textContent = 'SELECT TILES...';
                    btn.style.background = '#666';
                    btn.style.color = '#fff';
                }
            } else {
                btn.textContent = 'CREATE OBJECT';
                btn.style.background = '#4a7c59';
                btn.style.color = '#fff';
            }
        }

        function updateStaticObjScale(value) {
            staticObjPlacementScale = parseFloat(value);
            const label = document.getElementById('staticObjScaleValue');
            if (label) label.textContent = staticObjPlacementScale.toFixed(2).replace(/\.?0+$/, '') + 'x';
        }

        function createStaticObjectFromSelection() {
            if (!selectedTileData || currentTilesetIndex < 0) {
                alert('No tiles selected.');
                return;
            }

            const tileset = tilesets[currentTilesetIndex];
            const img = tileset.img || tileset._img;
            if (!img) {
                alert('Tileset image not loaded.');
                return;
            }

            // Extract tile region to canvas
            // Note: selectedTileData.x/y are already in pixels, width/height are in tile counts
            const pixelX = selectedTileData.x;
            const pixelY = selectedTileData.y;
            const pixelW = selectedTileData.width * gridSize;
            const pixelH = selectedTileData.height * gridSize;

            const canvas = document.createElement('canvas');
            canvas.width = pixelW;
            canvas.height = pixelH;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, pixelX, pixelY, pixelW, pixelH, 0, 0, pixelW, pixelH);

            const spriteData = canvas.toDataURL('image/png');

            // Prompt for name
            const name = prompt('Name this object:', 'Object ' + (staticObjects.length + 1));
            if (!name || name.trim() === '') return;

            // Store source tiles for collision inheritance
            const sourceTiles = selectedTiles.map(t => ({ x: t.x, y: t.y }));

            // Create static object
            const obj = {
                name: name.trim(),
                spriteData: spriteData,
                width: selectedTileData.width,
                height: selectedTileData.height,
                tilesetIndex: currentTilesetIndex,
                sourceTiles: sourceTiles,
                sourceOrigin: { x: selectedTileData.x, y: selectedTileData.y },
                _spriteImg: new Image()
            };
            obj._spriteImg.src = spriteData;

            staticObjects.push(obj);

            // Broadcast for multiplayer
            broadcastEdit({
                editType: 'addStaticObj',
                obj: {
                    name: obj.name,
                    spriteData: obj.spriteData,
                    width: obj.width,
                    height: obj.height,
                    tilesetIndex: obj.tilesetIndex,
                    sourceTiles: obj.sourceTiles,
                    sourceOrigin: obj.sourceOrigin
                }
            });

            // Clear selection
            selectedTiles = [];
            selectedTileData = null;

            // Update UI
            updateStaticObjectsList();

            // Switch to props tab and select the new object
            setMode('animProp');
            selectStaticObject(staticObjects.length - 1);

            console.log('[STATIC OBJ] Created:', obj.name, 'from tileset', obj.tilesetIndex);
        }

        function placeStaticObjectAt(gridX, gridY) {
            if (gridX < 0 || gridY < 0 || gridX >= mapCols || gridY >= mapRows) return;
            if (currentStaticObjIndex < 0 || !staticObjects[currentStaticObjIndex]) return;

            // Store grid coordinates (like items do)
            const placed = {
                objIndex: currentStaticObjIndex,
                x: gridX,
                y: gridY,
                mapName: currentMapName,
                scale: staticObjPlacementScale
            };

            placedStaticObjects.push(placed);

            broadcastEdit({
                editType: 'placeStaticObj',
                placed: placed
            });

            renderMap();
            console.log('[STATIC OBJ] Placed at', gridX, gridY, 'scale:', staticObjPlacementScale);
        }

        function removeStaticObjectAt(gridX, gridY) {
            // Search from top to bottom (last placed = on top)
            for (let i = placedStaticObjects.length - 1; i >= 0; i--) {
                const placed = placedStaticObjects[i];
                if (placed.mapName !== currentMapName) continue;

                const obj = staticObjects[placed.objIndex];
                if (!obj) continue;

                const scale = placed.scale || 1;
                const w = obj.width * scale;
                const h = obj.height * scale;

                // placed.x/y are grid coords
                if (gridX >= placed.x && gridX < placed.x + w &&
                    gridY >= placed.y && gridY < placed.y + h) {

                    broadcastEdit({
                        editType: 'removeStaticObjPlacement',
                        x: placed.x,
                        y: placed.y,
                        mapName: placed.mapName
                    });

                    placedStaticObjects.splice(i, 1);
                    renderMap();
                    console.log('[STATIC OBJ] Removed at grid', placed.x, placed.y);
                    return;
                }
            }
        }

        paintTilesetCanvas.addEventListener('mousedown', (e) => {
            if (mode !== 'tile') return;
            const rect = paintTilesetCanvas.getBoundingClientRect();
            const displayZoom = paintTilesetZoom;
            const x = Math.floor((e.clientX - rect.left) / displayZoom / gridSize) * gridSize;
            const y = Math.floor((e.clientY - rect.top) / displayZoom / gridSize) * gridSize;

            selectionStart = { x, y };
            tilesetSelecting = true;
        });

        paintTilesetCanvas.addEventListener('mousemove', (e) => {
            if (!tilesetSelecting || mode !== 'tile') return;
            updateTileSelection(e);
        });

        paintTilesetCanvas.addEventListener('mouseup', (e) => {
            if (!tilesetSelecting || mode !== 'tile') return;
            updateTileSelection(e);
            tilesetSelecting = false;
        });

        // Touch support for tileset selection (only when select mode is active)
        paintTilesetCanvas.addEventListener('touchstart', (e) => {
            if (mode !== 'tile') return;
            if (!tileSelectModeActive) return; // Allow scrolling when select mode is off
            e.preventDefault();
            const touch = e.touches[0];
            const rect = paintTilesetCanvas.getBoundingClientRect();
            const displayZoom = paintTilesetZoom;
            const x = Math.floor((touch.clientX - rect.left) / displayZoom / gridSize) * gridSize;
            const y = Math.floor((touch.clientY - rect.top) / displayZoom / gridSize) * gridSize;

            selectionStart = { x, y };
            tilesetSelecting = true;
        }, { passive: false });

        paintTilesetCanvas.addEventListener('touchmove', (e) => {
            if (!tilesetSelecting || mode !== 'tile') return;
            if (!tileSelectModeActive) return;
            e.preventDefault();
            updateTileSelectionTouch(e.touches[0]);
        }, { passive: false });

        paintTilesetCanvas.addEventListener('touchend', (e) => {
            if (!tilesetSelecting || mode !== 'tile') return;
            tilesetSelecting = false;
        });

        // Shift + scroll wheel zooms the tileset palette:
        //   zoom OUT (scroll down) to see/grab more tiles at once, zoom IN (scroll up) for tiny items.
        // Plain scroll (no Shift) is left alone so the palette still scrolls normally.
        paintTilesetCanvas.addEventListener('wheel', (e) => {
            if (!e.shiftKey) return;
            e.preventDefault();
            const prev = paintTilesetZoom;
            paintTilesetZoom = Math.max(1, Math.min(8, prev + (e.deltaY < 0 ? 1 : -1)));
            if (paintTilesetZoom === prev) return;
            // Anchor the zoom on the tile under the cursor so it doesn't jump away.
            const rect = paintTilesetCanvas.getBoundingClientRect();
            const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
            const ratio = paintTilesetZoom / prev;
            drawPaintTileset(); // re-renders the canvas at the new zoom
            const sc = paintTilesetCanvas.parentElement;
            if (sc) {
                if (sc.scrollWidth > sc.clientWidth) sc.scrollLeft += cx * (ratio - 1);
                if (sc.scrollHeight > sc.clientHeight) sc.scrollTop += cy * (ratio - 1);
            }
        }, { passive: false });

        function updateTileSelectionTouch(touch) {
            const rect = paintTilesetCanvas.getBoundingClientRect();
            const displayZoom = paintTilesetZoom;
            const x = Math.floor((touch.clientX - rect.left) / displayZoom / gridSize) * gridSize;
            const y = Math.floor((touch.clientY - rect.top) / displayZoom / gridSize) * gridSize;

            const minX = Math.min(selectionStart.x, x);
            const minY = Math.min(selectionStart.y, y);
            const maxX = Math.max(selectionStart.x, x);
            const maxY = Math.max(selectionStart.y, y);

            selectedTiles = [];
            for (let ty = minY; ty <= maxY; ty += gridSize) {
                for (let tx = minX; tx <= maxX; tx += gridSize) {
                    selectedTiles.push({ x: tx, y: ty });
                }
            }

            const selWidth = (maxX - minX) / gridSize + 1;
            const selHeight = (maxY - minY) / gridSize + 1;

            selectedTileData = { x: minX, y: minY, width: selWidth, height: selHeight };
            drawPaintTileset();
        }

        function updateTileSelection(e) {
            const rect = paintTilesetCanvas.getBoundingClientRect();
            const displayZoom = paintTilesetZoom;
            const x = Math.floor((e.clientX - rect.left) / displayZoom / gridSize) * gridSize;
            const y = Math.floor((e.clientY - rect.top) / displayZoom / gridSize) * gridSize;

            // Calculate selection rectangle
            const minX = Math.min(selectionStart.x, x);
            const minY = Math.min(selectionStart.y, y);
            const maxX = Math.max(selectionStart.x, x);
            const maxY = Math.max(selectionStart.y, y);

            // Build array of selected tiles
            selectedTiles = [];
            for (let ty = minY; ty <= maxY; ty += gridSize) {
                for (let tx = minX; tx <= maxX; tx += gridSize) {
                    selectedTiles.push({ x: tx, y: ty });
                }
            }

            // Calculate selection dimensions
            const selWidth = (maxX - minX) / gridSize + 1;
            const selHeight = (maxY - minY) / gridSize + 1;

            // Store selection bounds for painting
            selectedTileData = { x: minX, y: minY, width: selWidth, height: selHeight };
            drawPaintTileset();

            // Update CREATE OBJECT button when tiles selected
            if (createObjectMode) {
                updateCreateObjectButton();
            }
        }

        function updateSelectedPreview() {
            // Preview removed
        }

        function updateSelectedTilePreview() {
            // Preview removed
        }

        // Map painting
        let painting = false;
        let erasing = false;

        mapCanvas.addEventListener('mousedown', (e) => {
            // Skip painting when grab tool is active
            if (grabToolActive) return;

            e.preventDefault();
            const rect = mapCanvas.getBoundingClientRect();
            const tileSize = gridSize * zoom;
            const x = Math.floor((e.clientX - rect.left) / tileSize);
            const y = Math.floor((e.clientY - rect.top) / tileSize);

            // DEBUG: Ctrl+Shift+Click to mark position (in pixel coords like game uses)
            if (e.ctrlKey && e.shiftKey) {
                const pixelX = (e.clientX - rect.left) / zoom;
                const pixelY = (e.clientY - rect.top) / zoom;
                window.debugClickPos = { x: Math.round(pixelX), y: Math.round(pixelY) };
                console.log('[DEBUG] Marked position:', window.debugClickPos, 'tile:', x, y);
                renderMap();
                return;
            }

            // Check if in door animation tile selection mode (only on correct map)
            if (selectingAnimTiles && pendingAnimTrigger && doorAnimMapName === currentMapName && e.button === 0) {
                // Toggle tile selection
                toggleAnimTileSelection(x, y);
                return;
            }

            // In door animation painting mode, let normal tile painting handle clicks
            // (Done button is now HTML, not on canvas)

            // Set spawn mode - click anywhere to place player spawn
            if (setSpawnMode) {
                playerPreviewPos.x = x;
                playerPreviewPos.y = y;
                spawnMapName = currentMapName; // Record which map spawn is on
                playerPreviewVisible = true;
                toggleSetSpawnMode(); // Turn off set spawn mode after placing
                renderMap();
                // Wave 3: broadcast spawn point (was silently local-only).
                broadcastEdit({ editType: 'setPlayerSpawn', x, y, mapName: spawnMapName });
                return;
            }

            // Quest condition setting mode - click to set condition target
            if (settingConditionMode) {
                if (handleMapClickForCondition(x, y)) {
                    return;
                }
            }

            // Quest giver/turn-in NPC setting mode
            if (settingQuestGiverMode || settingQuestTurnInMode) {
                if (handleMapClickForQuestNpc(x, y)) {
                    return;
                }
            }

            // Find-tileset pick mode — capture the click, report the source tileset
            if (findTilesetMode) {
                if (e.button === 0) findTilesetAt(x, y);
                else toggleFindTilesetMode(); // right-click cancels
                return;
            }

            if (copyMode) {
                // Start copy selection
                copyStart = { x, y };
                copyEnd = { x, y };
                renderMap();
                return;
            }

            // Animated prop mode - click to place, right-click to remove (no dragging)
            if (mode === 'animProp') {
                // Static object edit mode - click to edit collision box
                if (editStaticObjOnMapMode && e.button === 0) {
                    const staticObjInfo = findStaticObjAt(x, y);
                    if (staticObjInfo) {
                        openStaticObjEditPopup(staticObjInfo);
                        return;
                    }
                }
                // Static object placement/removal takes priority
                if (currentStaticObjIndex >= 0 && staticObjects[currentStaticObjIndex] && !editStaticObjOnMapMode) {
                    if (e.button === 0) {
                        placeStaticObjectAt(x, y);
                    } else if (e.button === 2) {
                        removeStaticObjectAt(x, y);
                    }
                    return;
                }
                // Edit mode - click on placed props to edit their timing
                if (editAnimPropOnMapMode && e.button === 0) {
                    const propInfo = findAnimPropAt(x, y);
                    if (propInfo) {
                        openAnimPropEditPopup(propInfo);
                        return;
                    }
                }
                if (e.button === 0 && currentAnimPropIndex >= 0 && !editAnimPropOnMapMode) {
                    placeAnimPropAt(x, y);
                } else if (e.button === 2) {
                    removeAnimPropAt(x, y);
                }
                return;
            }

            // Item mode - click to place interactive item, right-click to remove
            // Also handle clicking on interactive anim props to assign items
            if (mode === 'item') {
                // Check if clicking on an interactive anim prop (chest with giveItem)
                const clickedPropIdx = findInteractivePropAt(x, y);
                if (clickedPropIdx >= 0 && e.button === 0) {
                    // Open item assignment for this prop instance
                    openPropItemAssignment(clickedPropIdx);
                    return;
                }

                if (e.button === 0 && currentItemIndex >= 0) {
                    placeItemAt(x, y);
                } else if (e.button === 2) {
                    removeItemAt(x, y);
                }
                return;
            }

            // Sound mode - click to place/select tile sound, right-click to remove
            if (mode === 'sound' && soundAttachMode === 'tile') {
                const key = `${currentMapName}:${x},${y}`;
                if (e.button === 0) {
                    // If clicking on existing sound, select it for editing
                    if (tileSounds[key]) {
                        selectTileSound(key);
                    } else if (selectedTileSoundKey) {
                        // If a sound is selected and clicking empty tile, deselect
                        deselectTileSound();
                    } else {
                        // Place new sound
                        placeTileSound(x, y);
                    }
                } else if (e.button === 2) {
                    if (selectedTileSoundKey === key) {
                        deselectTileSound();
                    }
                    removeTileSound(key);
                }
                return;
            }

            // Lighting mode - click to place point lights (free placement), right-click to remove
            if (mode === 'lighting') {
                // Use float coordinates for free placement (not grid-snapped)
                const freeX = (e.clientX - rect.left) / tileSize;
                const freeY = (e.clientY - rect.top) / tileSize;

                // Polygon light drawing mode
                if (polyLightDrawing) {
                    if (e.button === 0) {
                        addPolyLightPoint(freeX, freeY);
                    } else if (e.button === 2) {
                        // Right-click finishes polygon
                        finishPolyLight();
                    }
                    return;
                }

                // Normal point light placement
                if (e.button === 0) {
                    placeLightAt(freeX.toFixed(2), freeY.toFixed(2));
                } else if (e.button === 2) {
                    // Find and remove nearest light within 1 tile
                    removeNearestLight(freeX, freeY);
                }
                return;
            }

            // Trigger mode - click to place triggers, right-click to remove, drag green spawns
            if (mode === 'trigger') {
                console.log('[CLICK DEBUG] Trigger mode click at', x, y, 'button:', e.button);
                console.log('[CLICK DEBUG] settingSpawnPoint:', settingSpawnPoint, 'settingWalkOutPoint:', settingWalkOutPoint);

                // Check if we're setting walk-out point (before spawn)
                if (settingWalkOutPoint && e.button === 0) {
                    console.log('[CLICK DEBUG] Calling setWalkOutPointAt');
                    setWalkOutPointAt(x, y);
                    return;
                }

                // Check if we're setting spawn point
                if (settingSpawnPoint && e.button === 0) {
                    console.log('[CLICK DEBUG] Calling setSpawnPointAt');
                    setSpawnPointAt(x, y);
                    return;
                }

                // Check if clicking on a green spawn box (incoming trigger)
                if (e.button === 0) {
                    const incomingTriggers = placedTriggers.filter(t => t.targetMap === currentMapName && t.targetX !== null && t.targetY !== null);
                    for (const trigger of incomingTriggers) {
                        if (x === trigger.targetX && y === trigger.targetY) {
                            // Start dragging this spawn
                            draggingSpawnTrigger = trigger;
                            console.log('[DRAG] Started dragging spawn for Door', trigger.doorNumber);
                            return;
                        }
                    }
                    // Start drag to create trigger area
                    triggerDragStart = { x, y };
                    triggerDragEnd = { x, y };
                    renderMap();
                } else if (e.button === 2) {
                    removeTriggerAt(x, y);
                }
                return;
            }

            // Camera mode - click and drag to set camera bounds
            if (mode === 'camera') {
                if (settingCameraBounds && e.button === 0) {
                    cameraBoundsDragStart = { x, y };
                    cameraBoundsDragEnd = { x, y };
                    renderMap();
                }
                return;
            }

            // Fishing mode - click and drag to add a fish zone
            if (mode === 'fish') {
                if (settingFishZones && e.button === 0) {
                    fishZoneDragStart = { x, y };
                    fishZoneDragEnd = { x, y };
                    renderMap();
                }
                return;
            }

            // Dialog mode - click NPC to attach dialog, or click tile to place sign
            if (mode === 'dialog') {
                if (e.button === 0) {
                    // Check if clicking on an NPC first
                    const npcIdx = findPlacedNpcAt(x, y);
                    if (npcIdx >= 0) {
                        // Attach dialog to this NPC
                        if (currentDialogTileIndex >= 0) {
                            const triggerType = document.getElementById('dialogNpcTrigger')?.value || 'interact';
                            placedNpcs[npcIdx].dialogIndex = currentDialogTileIndex;
                            placedNpcs[npcIdx].dialogTrigger = triggerType;
                            broadcastEdit({ editType: 'attachNpcDialog', npcIndex: npcIdx, dialogIndex: currentDialogTileIndex, dialogTrigger: triggerType });
                            updateDialogNpcDropdown();
                            renderMap();
                        } else {
                            alert('Select a dialog first by clicking it in the list');
                        }
                    } else {
                        // Place dialog tile (sign)
                        placeDialogTileAt(x, y);
                    }
                } else if (e.button === 2) {
                    // Right-click: remove dialog tile or detach from NPC
                    const npcIdx = findPlacedNpcAt(x, y);
                    if (npcIdx >= 0 && placedNpcs[npcIdx].dialogIndex >= 0) {
                        // Detach dialog from NPC
                        placedNpcs[npcIdx].dialogIndex = -1;
                        delete placedNpcs[npcIdx].dialogTrigger;
                        broadcastEdit({ editType: 'attachNpcDialog', npcIndex: npcIdx, dialogIndex: -1 });
                        updateDialogNpcDropdown();
                        renderMap();
                    } else {
                        removeDialogTileAt(x, y);
                    }
                }
                return;
            }

            // Shop mode - click NPC to attach shop
            if (mode === 'shop') {
                if (e.button === 0) {
                    const npcIdx = findPlacedNpcAt(x, y);
                    if (npcIdx >= 0) {
                        if (selectedShopIndex >= 0) {
                            // Attach selected shop to this NPC
                            placedNpcs[npcIdx].shopIndex = selectedShopIndex;
                            broadcastEdit({
                                editType: 'updatePlacedNpc',
                                index: npcIdx,
                                npc: placedNpcs[npcIdx]
                            });
                            updateNpcShopList();
                            renderMap();
                        } else {
                            alert('Select a shop first by clicking it in the list');
                        }
                    }
                } else if (e.button === 2) {
                    // Right-click: remove shop from NPC
                    const npcIdx = findPlacedNpcAt(x, y);
                    if (npcIdx >= 0 && placedNpcs[npcIdx].shopIndex >= 0) {
                        placedNpcs[npcIdx].shopIndex = -1;
                        broadcastEdit({
                            editType: 'updatePlacedNpc',
                            index: npcIdx,
                            npc: placedNpcs[npcIdx]
                        });
                        updateNpcShopList();
                        renderMap();
                    }
                }
                return;
            }

            // NPC mode - place, select, draw path, or edit path
            if (mode === 'npc') {
                // Prop-link targeting takes priority over draw/edit/select
                if (npcWaypointPropTarget >= 0) {
                    if (e.button === 2) { // right-click cancels targeting
                        npcWaypointPropTarget = -1;
                        updateNpcWaypointList();
                    } else if (e.button === 0) {
                        tryLinkWaypointProp(x, y);
                    }
                    return;
                }
                if (npcPathEditing && selectedPlacedNpcIndex >= 0) {
                    // Editing path - drag waypoints
                    const placed = placedNpcs[selectedPlacedNpcIndex];
                    if (placed && placed.path) {
                        if (e.button === 0) {
                            // Find closest waypoint to click
                            const waypointIdx = findNearestWaypoint(x, y, placed.path);
                            if (waypointIdx >= 0) {
                                npcDraggingWaypoint = waypointIdx;
                            }
                        } else if (e.button === 2) {
                            // Right-click to delete waypoint
                            const waypointIdx = findNearestWaypoint(x, y, placed.path);
                            if (waypointIdx >= 0) {
                                placed.path.splice(waypointIdx, 1);
                                updateNpcWaypointList();
                                renderMap();
                                // Wave 3: broadcast waypoint delete (was silently local-only).
                                broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
                            }
                        }
                    }
                } else if (npcPathDrawing && selectedPlacedNpcIndex >= 0) {
                    // Drawing path - add waypoint
                    if (e.button === 0) {
                        addNpcWaypoint(x, y);
                    } else if (e.button === 2) {
                        // Right-click removes last waypoint
                        removeLastNpcWaypoint();
                    }
                } else if (e.button === 0) {
                    // Check if clicking on existing placed NPC
                    const clickedNpcIdx = findPlacedNpcAt(x, y);
                    if (clickedNpcIdx >= 0) {
                        selectPlacedNpc(clickedNpcIdx);
                    } else if (currentNpcIndex >= 0) {
                        // Place new NPC
                        placeNpcAt(x, y);
                    }
                } else if (e.button === 2) {
                    // Right-click to remove placed NPC
                    removeNpcAt(x, y);
                }
                return;
            }

            if (e.button === 0) {
                if (eraseMode) {
                    erasing = true;
                } else {
                    painting = true;
                }
                paintAt(x, y);
            }
            if (e.button === 2) {
                erasing = true;
                paintAt(x, y);
            }
        });

        mapCanvas.addEventListener('mousemove', (e) => {
            const rect = mapCanvas.getBoundingClientRect();
            const tileSize = gridSize * zoom;
            const x = Math.floor((e.clientX - rect.left) / tileSize);
            const y = Math.floor((e.clientY - rect.top) / tileSize);

            if (copyMode && copyStart) {
                // Update copy selection
                copyEnd = { x, y };
                renderMap();
                return;
            }

            // Handle spawn point dragging (green boxes)
            if (draggingSpawnTrigger && mode === 'trigger') {
                draggingSpawnTrigger.targetX = x;
                draggingSpawnTrigger.targetY = y;
                renderMap();
                return;
            }

            // Handle trigger area dragging (creating multi-tile triggers)
            if (triggerDragStart && mode === 'trigger') {
                triggerDragEnd = { x, y };
                renderMap();
                return;
            }

            // Handle camera bounds dragging
            if (cameraBoundsDragStart && settingCameraBounds) {
                cameraBoundsDragEnd = { x, y };
                renderMap();
                return;
            }

            // Handle fish zone dragging
            if (fishZoneDragStart && settingFishZones) {
                fishZoneDragEnd = { x, y };
                renderMap();
                return;
            }

            // Handle waypoint dragging
            if (npcDraggingWaypoint >= 0 && selectedPlacedNpcIndex >= 0) {
                const placed = placedNpcs[selectedPlacedNpcIndex];
                if (placed && placed.path && placed.path[npcDraggingWaypoint]) {
                    placed.path[npcDraggingWaypoint].x = x;
                    placed.path[npcDraggingWaypoint].y = y;
                    updateNpcWaypointList();
                    renderMap();
                }
                return;
            }

            // Update hover position for preview
            if (hoverMapPos?.x !== x || hoverMapPos?.y !== y) {
                hoverMapPos = { x, y };
                renderMap();
            }

            if (painting || erasing) {
                paintAt(x, y);
            }
        });

        mapCanvas.addEventListener('mouseleave', () => {
            hoverMapPos = null;
            renderMap();
        });

        window.addEventListener('mouseup', (e) => {
            // Stop dragging spawn points
            if (draggingSpawnTrigger) {
                console.log('[DRAG] Stopped dragging spawn for Door', draggingSpawnTrigger.doorNumber,
                    'new position:', draggingSpawnTrigger.targetX, draggingSpawnTrigger.targetY);
                // Sync the trigger update
                const triggerIndex = placedTriggers.indexOf(draggingSpawnTrigger);
                if (triggerIndex >= 0) {
                    broadcastEdit({ editType: 'updateTrigger', index: triggerIndex, uid: draggingSpawnTrigger.uid, trigger: draggingSpawnTrigger });
                }
                draggingSpawnTrigger = null;
                renderMap();
            }

            // Finish trigger area drag - create multi-tile trigger
            if (triggerDragStart && triggerDragEnd) {
                const x1 = Math.min(triggerDragStart.x, triggerDragEnd.x);
                const y1 = Math.min(triggerDragStart.y, triggerDragEnd.y);
                const x2 = Math.max(triggerDragStart.x, triggerDragEnd.x);
                const y2 = Math.max(triggerDragStart.y, triggerDragEnd.y);
                const width = x2 - x1 + 1;
                const height = y2 - y1 + 1;

                // Store dimensions and show modal
                pendingTriggerWidth = width;
                pendingTriggerHeight = height;
                placeTriggerAt(x1, y1);

                triggerDragStart = null;
                triggerDragEnd = null;
                renderMap();
            }

            // Finish camera bounds drag
            if (cameraBoundsDragStart && cameraBoundsDragEnd && settingCameraBounds) {
                setCameraBoundsFromDrag();
            }

            // Finish fish zone drag
            if (fishZoneDragStart && fishZoneDragEnd && settingFishZones) {
                setFishZoneFromDrag();
            }

            if (copyMode && copyStart && copyEnd) {
                // Finish copy selection
                finishCopyFromMap();
            }
            // End painting/erasing stroke
            painting = false;
            erasing = false;
            // Stop waypoint dragging and broadcast if we were dragging
            if (npcDraggingWaypoint >= 0 && selectedPlacedNpcIndex >= 0) {
                const placed = placedNpcs[selectedPlacedNpcIndex];
                if (placed) {
                    broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
                }
            }
            npcDraggingWaypoint = -1;
        });
        mapCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Touch support for mobile
        mapCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = mapCanvas.getBoundingClientRect();
            const tileSize = gridSize * zoom;
            const x = Math.floor((touch.clientX - rect.left) / tileSize);
            const y = Math.floor((touch.clientY - rect.top) / tileSize);

            // Set spawn mode - touch to place player spawn
            if (setSpawnMode) {
                playerPreviewPos.x = x;
                playerPreviewPos.y = y;
                spawnMapName = currentMapName; // Record which map spawn is on
                playerPreviewVisible = true;
                toggleSetSpawnMode();
                renderMap();
                // Wave 3: broadcast spawn point (was silently local-only).
                broadcastEdit({ editType: 'setPlayerSpawn', x, y, mapName: spawnMapName });
                return;
            }

            // Copy mode - touch to start selection
            if (copyMode) {
                copyStart = { x, y };
                copyEnd = { x, y };
                renderMap();
                return;
            }

            // Static object mode - click to place
            if (mode === 'animProp' && currentStaticObjIndex >= 0 && staticObjects[currentStaticObjIndex]) {
                placeStaticObjectAt(x, y);
                return;
            }

            // Animated prop mode
            if (mode === 'animProp' && currentAnimPropIndex >= 0) {
                placeAnimPropAt(x, y);
                return;
            }

            // Sound mode
            if (mode === 'sound' && soundAttachMode === 'tile') {
                const key = `${currentMapName}:${x},${y}`;
                if (tileSounds[key]) {
                    selectTileSound(key);
                } else if (!selectedTileSoundKey) {
                    placeTileSound(x, y);
                }
                renderMap();
                return;
            }

            // Default: paint tiles
            if (eraseMode) {
                erasing = true;
            } else {
                painting = true;
            }
            hoverMapPos = { x, y };
            paintAt(x, y);
            renderMap();
        }, { passive: false });

        mapCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = mapCanvas.getBoundingClientRect();
            const tileSize = gridSize * zoom;
            const x = Math.floor((touch.clientX - rect.left) / tileSize);
            const y = Math.floor((touch.clientY - rect.top) / tileSize);

            // Copy mode - update selection
            if (copyMode && copyStart) {
                copyEnd = { x, y };
                renderMap();
                return;
            }

            if (hoverMapPos?.x !== x || hoverMapPos?.y !== y) {
                hoverMapPos = { x, y };
                renderMap();
            }

            if (painting || erasing) {
                paintAt(x, y);
            }
        }, { passive: false });

        mapCanvas.addEventListener('touchend', (e) => {
            // Copy mode - finish selection
            if (copyMode && copyStart && copyEnd) {
                finishCopyFromMap();
                return;
            }

            painting = false;
            erasing = false;
            hoverMapPos = null;
            renderMap();
        });

        // Animated prop placement helpers - stores directly in layer like tiles
        // Supports multi-tile props based on frame size
        // Properly rotates the entire object shape, not just individual tiles
        function placeAnimPropAt(x, y) {
            if (x < 0 || y < 0 || x >= mapCols || y >= mapRows) return;
            if (!layers[currentLayer]) return;
            if (currentAnimPropIndex < 0 || !animatedProps[currentAnimPropIndex]) return;

            const prop = animatedProps[currentAnimPropIndex];
            const frames = prop.frames || [];
            if (frames.length === 0) return;

            // Calculate how many tiles this prop spans based on first frame size
            const frame = frames[0];
            const origW = Math.ceil(frame.w / gridSize);
            const origH = Math.ceil(frame.h / gridSize);

            // Determine placed dimensions based on rotation (90/270 swap W and H)
            const rot = tileRotation;
            const placedW = (rot === 90 || rot === 270) ? origH : origW;
            const placedH = (rot === 90 || rot === 270) ? origW : origH;

            // Place tiles with proper rotation mapping
            for (let ty = 0; ty < origH; ty++) {
                for (let tx = 0; tx < origW; tx++) {
                    // Calculate rotated position on map
                    let placedTx, placedTy;
                    if (rot === 0) {
                        placedTx = tx;
                        placedTy = ty;
                    } else if (rot === 90) {
                        // 90° CW: (tx, ty) -> (origH - 1 - ty, tx)
                        placedTx = origH - 1 - ty;
                        placedTy = tx;
                    } else if (rot === 180) {
                        // 180°: (tx, ty) -> (origW - 1 - tx, origH - 1 - ty)
                        placedTx = origW - 1 - tx;
                        placedTy = origH - 1 - ty;
                    } else { // 270
                        // 270° CW: (tx, ty) -> (ty, origW - 1 - tx)
                        placedTx = ty;
                        placedTy = origW - 1 - tx;
                    }

                    const px = x + placedTx;
                    const py = y + placedTy;
                    if (px < 0 || py < 0 || px >= mapCols || py >= mapRows) continue;

                    if (!layers[currentLayer][py]) layers[currentLayer][py] = [];

                    // Store original source offset (for sprite lookup), rotation, and scale
                    layers[currentLayer][py][px] = {
                        type: 'animTile',
                        propIndex: currentAnimPropIndex,
                        offsetX: tx,  // Original source tile X (for sprite lookup)
                        offsetY: ty,  // Original source tile Y (for sprite lookup)
                        tilesW: origW,  // Original prop size
                        tilesH: origH,
                        placedW: placedW,  // Placed size (after rotation)
                        placedH: placedH,
                        rotation: rot,
                        scale: currentAnimPropScale  // Scale factor
                    };
                    // Broadcast to co-op builders
                    broadcastEdit({ editType: 'tile', layer: currentLayer, x: px, y: py, cell: layers[currentLayer][py][px], mapName: currentMapName });
                }
            }
            renderMap();
        }

        function removeAnimPropAt(x, y) {
            if (x < 0 || y < 0 || x >= mapCols || y >= mapRows) return;
            if (!layers[currentLayer] || !layers[currentLayer][y]) return;

            const cell = layers[currentLayer][y][x];
            if (cell && cell.type === 'animTile') {
                // Remove all tiles of this multi-tile prop
                const rot = cell.rotation || 0;
                const origW = cell.tilesW || 1;
                const origH = cell.tilesH || 1;
                const offsetX = cell.offsetX || 0;
                const offsetY = cell.offsetY || 0;

                // Calculate placed offset based on rotation (reverse of placement)
                let placedOffX, placedOffY;
                if (rot === 0) {
                    placedOffX = offsetX;
                    placedOffY = offsetY;
                } else if (rot === 90) {
                    placedOffX = origH - 1 - offsetY;
                    placedOffY = offsetX;
                } else if (rot === 180) {
                    placedOffX = origW - 1 - offsetX;
                    placedOffY = origH - 1 - offsetY;
                } else { // 270
                    placedOffX = offsetY;
                    placedOffY = origW - 1 - offsetX;
                }

                // Find origin (top-left of placed object)
                const originX = x - placedOffX;
                const originY = y - placedOffY;

                // Get placed dimensions
                const placedW = (rot === 90 || rot === 270) ? origH : origW;
                const placedH = (rot === 90 || rot === 270) ? origW : origH;

                // Remove all tiles in the placed rectangle
                for (let py = 0; py < placedH; py++) {
                    for (let px = 0; px < placedW; px++) {
                        const mapX = originX + px;
                        const mapY = originY + py;
                        if (mapX < 0 || mapY < 0 || mapX >= mapCols || mapY >= mapRows) continue;
                        if (layers[currentLayer][mapY]) {
                            layers[currentLayer][mapY][mapX] = null;
                            // Broadcast to co-op builders
                            broadcastEdit({ editType: 'eraseTile', layer: currentLayer, x: mapX, y: mapY, mapName: currentMapName });
                        }
                    }
                }
            }
            renderMap();
        }

        // Copy from map functions
        function startCopyFromMap() {
            copyMode = true;
            copyStart = null;
            copyEnd = null;
            copiedTiles = null;
            document.getElementById('copyFromMapBtn').classList.add('active');
            document.getElementById('copyFromMapBtn').textContent = 'Selecting...';
            document.getElementById('copyModeInfo').style.display = 'inline';
            mapCanvas.style.cursor = 'copy';
        }

        function finishCopyFromMap() {
            if (!copyStart || !copyEnd) {
                cancelCopyMode();
                return;
            }

            const minX = Math.min(copyStart.x, copyEnd.x);
            const maxX = Math.max(copyStart.x, copyEnd.x);
            const minY = Math.min(copyStart.y, copyEnd.y);
            const maxY = Math.max(copyStart.y, copyEnd.y);

            const width = maxX - minX + 1;
            const height = maxY - minY + 1;

            // Check if copying all layers
            copiedAllLayers = document.getElementById('copyAllLayers').checked;

            if (copiedAllLayers) {
                // Copy tiles from ALL layers - 3D array [layer][y][x]
                copiedTiles = [];
                for (let li = 0; li < layers.length; li++) {
                    copiedTiles[li] = [];
                    for (let dy = 0; dy < height; dy++) {
                        copiedTiles[li][dy] = [];
                        for (let dx = 0; dx < width; dx++) {
                            const mx = minX + dx;
                            const my = minY + dy;
                            if (my >= 0 && my < mapRows && mx >= 0 && mx < mapCols && layers[li] && layers[li][my]) {
                                copiedTiles[li][dy][dx] = layers[li][my][mx] ? { ...layers[li][my][mx] } : null;
                            } else {
                                copiedTiles[li][dy][dx] = null;
                            }
                        }
                    }
                }
            } else {
                // Copy tiles from current layer only - 2D array [y][x]
                copiedTiles = [];
                for (let dy = 0; dy < height; dy++) {
                    copiedTiles[dy] = [];
                    for (let dx = 0; dx < width; dx++) {
                        const mx = minX + dx;
                        const my = minY + dy;
                        if (my >= 0 && my < mapRows && mx >= 0 && mx < mapCols) {
                            copiedTiles[dy][dx] = map[my][mx] ? { ...map[my][mx] } : null;
                        } else {
                            copiedTiles[dy][dx] = null;
                        }
                    }
                }
            }

            // Set as selected tile data for painting
            selectedTileData = {
                isCopied: true,
                width: width,
                height: height
            };

            // Reset flip when copying from map (copied tiles have their own transforms)
            tileFlippedH = false;
            updateFlipButton();

            // Update preview
            updateCopiedPreview();

            // Exit copy mode
            copyMode = false;
            copyStart = null;
            copyEnd = null;
            document.getElementById('copyFromMapBtn').classList.remove('active');
            document.getElementById('copyFromMapBtn').textContent = 'Copy from Map';
            document.getElementById('copyModeInfo').style.display = 'none';
            mapCanvas.style.cursor = 'crosshair';
            renderMap();
        }

        function cancelCopyMode() {
            copyMode = false;
            copyStart = null;
            copyEnd = null;
            document.getElementById('copyFromMapBtn').classList.remove('active');
            document.getElementById('copyFromMapBtn').textContent = 'Copy from Map';
            document.getElementById('copyModeInfo').style.display = 'none';
            mapCanvas.style.cursor = 'crosshair';
            renderMap();
        }

        function updateCopiedPreview() {
            if (!copiedTiles || copiedTiles.length === 0) return;

            const previewCanvas = document.getElementById('selectedTile');
            if (!previewCanvas) return;
            const previewCtx = previewCanvas.getContext('2d');
            const previewSize = 48;

            // Calculate dimensions based on whether all layers were copied
            let width, height;
            if (copiedAllLayers) {
                // 3D array [layer][y][x]
                height = copiedTiles[0]?.length || 0;
                width = copiedTiles[0]?.[0]?.length || 0;
            } else {
                // 2D array [y][x]
                height = copiedTiles.length;
                width = copiedTiles[0]?.length || 0;
            }

            if (width === 0 || height === 0) return;

            const tilePreviewSize = Math.min(previewSize / width, previewSize / height, 16);

            previewCanvas.width = previewSize;
            previewCanvas.height = previewSize;

            previewCtx.fillStyle = '#333';
            previewCtx.fillRect(0, 0, previewSize, previewSize);
            previewCtx.imageSmoothingEnabled = false;

            if (copiedAllLayers) {
                // Draw all layers composite
                for (let li = 0; li < copiedTiles.length; li++) {
                    for (let dy = 0; dy < height; dy++) {
                        for (let dx = 0; dx < width; dx++) {
                            const cell = copiedTiles[li] && copiedTiles[li][dy] && copiedTiles[li][dy][dx];
                            if (cell) {
                                const px = dx * tilePreviewSize;
                                const py = dy * tilePreviewSize;

                                if (cell.type === 'tile') {
                                    const cellTileset = tilesets[cell.tilesetIndex || 0]?.img || tilesetImg;
                                    if (cellTileset) {
                                        previewCtx.drawImage(cellTileset, cell.x, cell.y, gridSize, gridSize, px, py, tilePreviewSize, tilePreviewSize);
                                    }
                                } else if (cell.type === 'prop' && propImage) {
                                    previewCtx.drawImage(propImage, cell.x, cell.y, gridSize, gridSize, px, py, tilePreviewSize, tilePreviewSize);
                                }
                            }
                        }
                    }
                }
            } else {
                // Single layer preview
                for (let dy = 0; dy < height; dy++) {
                    for (let dx = 0; dx < width; dx++) {
                        const cell = copiedTiles[dy] && copiedTiles[dy][dx];
                        if (cell) {
                            const px = dx * tilePreviewSize;
                            const py = dy * tilePreviewSize;

                            if (cell.type === 'tile') {
                                const cellTileset = tilesets[cell.tilesetIndex || 0]?.img || tilesetImg;
                                if (cellTileset) {
                                    previewCtx.drawImage(cellTileset, cell.x, cell.y, gridSize, gridSize, px, py, tilePreviewSize, tilePreviewSize);
                                }
                            } else if (cell.type === 'prop' && propImage) {
                                previewCtx.drawImage(propImage, cell.x, cell.y, gridSize, gridSize, px, py, tilePreviewSize, tilePreviewSize);
                            }
                        }
                    }
                }
            }

            const layerInfo = copiedAllLayers ? ' (all layers)' : '';
            document.getElementById('selectedInfo').textContent = width + 'x' + height + layerInfo;
            document.getElementById('selectedInfo').style.color = copiedAllLayers ? '#5f8' : '#fff';
            document.getElementById('selectedCollisionInfo').textContent = 'From map';
        }

        function paintAt(x, y) {
            // During door animation painting, only allow painting on selected tiles (matching layer)
            if (paintingAnimTiles) {
                const isSelectedTile = selectedAnimTiles.some(t => t.x === x && t.y === y && t.layer === currentLayer);
                if (!isSelectedTile) {
                    return; // Block painting outside selected area
                }
            }

            if (!selectedTileData) {
                if (erasing && x >= 0 && x < mapCols && y >= 0 && y < mapRows) {
                    map[y][x] = null;
                    // Broadcast erase to co-op builders
                    broadcastEdit({ editType: 'eraseTile', layer: currentLayer, x: x, y: y, mapName: currentMapName });
                    renderMap();
                }
                return;
            }

            const selW = selectedTileData.width || 1;
            const selH = selectedTileData.height || 1;

            if (erasing) {
                // Erase area matching selection size
                for (let dy = 0; dy < selH; dy++) {
                    for (let dx = 0; dx < selW; dx++) {
                        const mx = x + dx;
                        const my = y + dy;
                        if (mx >= 0 && mx < mapCols && my >= 0 && my < mapRows) {
                            map[my][mx] = null;
                            // Broadcast erase to co-op builders
                            broadcastEdit({ editType: 'eraseTile', layer: currentLayer, x: mx, y: my, mapName: currentMapName });
                        }
                    }
                }
            } else if (painting) {
                // Check for flip+rotation combo (Pratt warning)
                if (!selectedTileData.isCopied && !selectedTileData.isProp && tileRotation !== 0 && tileFlippedH) {
                    if (!showPrattWarning()) {
                        return; // User cancelled
                    }
                }
                // Check if painting with copied tiles
                if (selectedTileData.isCopied && copiedTiles) {
                    if (copiedAllLayers) {
                        // Paint copied tiles to ALL layers
                        for (let li = 0; li < copiedTiles.length && li < layers.length; li++) {
                            for (let dy = 0; dy < selH; dy++) {
                                for (let dx = 0; dx < selW; dx++) {
                                    const mx = x + dx;
                                    const my = y + dy;

                                    // Auto-expand map if painting at or beyond edge
                                    if (my >= mapRows - 2) expandMapRows();
                                    if (mx >= mapCols - 2) expandMapCols();

                                    if (mx >= 0 && my >= 0 && mx < mapCols && my < mapRows) {
                                        const srcCell = copiedTiles[li] && copiedTiles[li][dy] && copiedTiles[li][dy][dx];
                                        if (srcCell) {
                                            if (!layers[li][my]) layers[li][my] = [];
                                            layers[li][my][mx] = { ...srcCell };
                                            // Broadcast tile to co-op builders
                                            broadcastEdit({ editType: 'tile', layer: li, x: mx, y: my, cell: layers[li][my][mx], mapName: currentMapName });
                                        }
                                    }
                                }
                            }
                        }
                        // Clear after pasting all layers (one-time paste)
                        copiedTiles = null;
                        copiedAllLayers = false;
                        selectedTileData = null;
                    } else {
                        // Paint copied tiles to current layer only (can paste multiple times)
                        for (let dy = 0; dy < selH; dy++) {
                            for (let dx = 0; dx < selW; dx++) {
                                const mx = x + dx;
                                const my = y + dy;

                                // Auto-expand map if painting at or beyond edge
                                if (my >= mapRows - 2) expandMapRows();
                                if (mx >= mapCols - 2) expandMapCols();

                                if (mx >= 0 && my >= 0 && mx < mapCols && my < mapRows) {
                                    const srcCell = copiedTiles[dy] && copiedTiles[dy][dx];
                                    if (srcCell) {
                                        map[my][mx] = { ...srcCell };
                                        // Broadcast tile to co-op builders
                                        broadcastEdit({ editType: 'tile', layer: currentLayer, x: mx, y: my, cell: map[my][mx], mapName: currentMapName });
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // Paint from tileset selection
                    for (let dy = 0; dy < selH; dy++) {
                        for (let dx = 0; dx < selW; dx++) {
                            const mx = x + dx;
                            const my = y + dy;

                            // Auto-expand map if painting at or beyond edge
                            if (my >= mapRows - 2) expandMapRows();
                            if (mx >= mapCols - 2) expandMapCols();

                            if (mx >= 0 && my >= 0 && mx < mapCols && my < mapRows) {
                                // When flipped, mirror the source tile positions horizontally
                                const srcDx = tileFlippedH ? (selW - 1 - dx) : dx;
                                const tileX = selectedTileData.x + srcDx * gridSize;
                                const tileY = selectedTileData.y + dy * gridSize;

                                if (selectedTileData.isProp) {
                                    // Paint as prop with propIndex (collision is painted separately in prop panel)
                                    map[my][mx] = { type: 'prop', x: tileX, y: tileY, propIndex: currentPropIndex };
                                } else {
                                    // Paint as tile with rotation and flip
                                    map[my][mx] = { type: 'tile', x: tileX, y: tileY, rotation: tileRotation, flipped: tileFlippedH, tilesetIndex: currentTilesetIndex };
                                }
                                // Broadcast tile to co-op builders
                                broadcastEdit({ editType: 'tile', layer: currentLayer, x: mx, y: my, cell: map[my][mx], mapName: currentMapName });
                            }
                        }
                    }
                }
            }
            renderMap();
        }

        function renderMap() {
            const tileSize = gridSize * zoom;
            mapCanvas.width = mapCols * tileSize;
            mapCanvas.height = mapRows * tileSize;

            // Background
            mapCtx.fillStyle = '#1a1a1a';
            mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
            for (let y = 0; y < mapRows; y++) {
                for (let x = 0; x < mapCols; x++) {
                    if ((x + y) % 2 === 0) {
                        mapCtx.fillStyle = '#222';
                        mapCtx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                    }
                }
            }

            // Grid
            mapCtx.strokeStyle = 'rgba(255,255,255,0.1)';
            for (let x = 0; x <= mapCols; x++) {
                mapCtx.beginPath();
                mapCtx.moveTo(x * tileSize, 0);
                mapCtx.lineTo(x * tileSize, mapCanvas.height);
                mapCtx.stroke();
            }
            for (let y = 0; y <= mapRows; y++) {
                mapCtx.beginPath();
                mapCtx.moveTo(0, y * tileSize);
                mapCtx.lineTo(mapCanvas.width, y * tileSize);
                mapCtx.stroke();
            }

            // Draw all visible layers (bottom to top)
            if (tilesetImg) {
                mapCtx.imageSmoothingEnabled = false;

                for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
                    // Draw player preview at the right layer position (only on spawn map)
                    if (layerIdx === playerLayerIndex && playerPreviewVisible && currentMapName === spawnMapName) {
                        drawPlayerPreview(tileSize);
                    }

                    if (!layerVisibility[layerIdx]) continue;

                    const layerData = layers[layerIdx];
                    // Dim non-current layers slightly
                    mapCtx.globalAlpha = (layerIdx === currentLayer) ? 1 : 0.7;

                    for (let y = 0; y < mapRows; y++) {
                        for (let x = 0; x < mapCols; x++) {
                            const cell = layerData[y] && layerData[y][x];
                            if (!cell) continue;

                            const px = x * tileSize;
                            const py = y * tileSize;

                            if (cell.type === 'tile') {
                                // Use the correct tileset for this tile
                                const cellTileset = tilesets[cell.tilesetIndex || 0]?.img || tilesetImg;
                                drawRotatedTile(mapCtx, cellTileset, cell.x, cell.y, gridSize, px, py, tileSize, cell.rotation || 0, cell.flipped || false);

                                // Show collision only on current layer
                                if (layerIdx === currentLayer) {
                                    // Include tileset index in collision key lookup
                                    const tilesetIdx = cell.tilesetIndex || 0;
                                    const key = tilesetIdx + ':' + cell.x + ',' + cell.y;
                                    const collision = tileCollisions[key];
                                    if (collision && collision.length >= 3) {
                                        const scale = tileSize / gridSize;
                                        mapCtx.fillStyle = 'rgba(255, 0, 0, 0.2)';
                                        mapCtx.beginPath();
                                        mapCtx.moveTo(px + collision[0].x * scale, py + collision[0].y * scale);
                                        for (let i = 1; i < collision.length; i++) {
                                            mapCtx.lineTo(px + collision[i].x * scale, py + collision[i].y * scale);
                                        }
                                        mapCtx.closePath();
                                        mapCtx.fill();
                                    }
                                }
                            } else if (cell.type === 'prop') {
                                // Draw prop from the correct prop image
                                const propIdx = cell.propIndex || 0;
                                const propImg = props[propIdx]?.img;
                                if (propImg) {
                                    mapCtx.drawImage(propImg, cell.x, cell.y, gridSize, gridSize, px, py, tileSize, tileSize);
                                }
                            } else if (cell.type === 'animTile') {
                                // Animated tile - cycles through frames (supports multi-tile)
                                const prop = animatedProps[cell.propIndex];
                                if (prop && prop._spriteImg && prop.frames && prop.frames.length > 0) {
                                    // Use origin tile's position for animation sync
                                    const originX = x - (cell.offsetX || 0);
                                    const originY = y - (cell.offsetY || 0);
                                    const key = originX + ',' + originY + ',' + layerIdx;
                                    const animState = placedAnimPropFrames[key] || { frame: 0 };
                                    const frameIdx = animState.frame % prop.frames.length;
                                    const frame = prop.frames[frameIdx];

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

                                    // Scale offset from prop's center
                                    const propCenterOffsetX = (scaledPropWidth - propWidth) / 2;
                                    const propCenterOffsetY = (scaledPropHeight - propHeight) / 2;

                                    // This tile's position relative to origin
                                    const tileOffsetX = offsetX * tileSize;
                                    const tileOffsetY = offsetY * tileSize;

                                    // Scale tile offset from prop origin
                                    const scaledTileOffsetX = tileOffsetX * propScale;
                                    const scaledTileOffsetY = tileOffsetY * propScale;

                                    // Origin tile's screen position
                                    const originPx = originX * tileSize;
                                    const originPy = originY * tileSize;

                                    // Draw position: origin - center offset + scaled tile offset
                                    const drawX = originPx - propCenterOffsetX + scaledTileOffsetX;
                                    const drawY = originPy - propCenterOffsetY + scaledTileOffsetY;

                                    mapCtx.imageSmoothingEnabled = false;
                                    // Per-instance pixel nudge (fine-position off the grid)
                                    const _nx = (cell.nudgeX || 0) * (tileSize / gridSize);
                                    const _ny = (cell.nudgeY || 0) * (tileSize / gridSize);
                                    const _nudged = _nx || _ny;
                                    if (_nudged) { mapCtx.save(); mapCtx.translate(_nx, _ny); }
                                    // Per-instance horizontal mirror (reflect whole prop about its screen-center)
                                    const mirror = cell.mirror;
                                    if (mirror) {
                                        mapCtx.save();
                                        const centerScreenX = originPx - propCenterOffsetX + scaledPropWidth / 2;
                                        mapCtx.translate(centerScreenX, 0);
                                        mapCtx.scale(-1, 1);
                                        mapCtx.translate(-centerScreenX, 0);
                                    }
                                    // Draw with rotation support
                                    const rot = cell.rotation || 0;
                                    if (rot === 0) {
                                        mapCtx.drawImage(prop._spriteImg, srcX, srcY, gridSize, gridSize, drawX, drawY, scaledTileSize, scaledTileSize);
                                    } else {
                                        mapCtx.save();
                                        const propCenterX = originPx + propWidth / 2;
                                        const propCenterY = originPy + propHeight / 2;
                                        mapCtx.translate(propCenterX, propCenterY);
                                        mapCtx.rotate(rot * Math.PI / 180);
                                        const rotDrawX = -scaledPropWidth / 2 + scaledTileOffsetX;
                                        const rotDrawY = -scaledPropHeight / 2 + scaledTileOffsetY;
                                        mapCtx.drawImage(prop._spriteImg, srcX, srcY, gridSize, gridSize, rotDrawX, rotDrawY, scaledTileSize, scaledTileSize);
                                        mapCtx.restore();
                                    }
                                    if (mirror) mapCtx.restore();
                                    if (_nudged) mapCtx.restore();

                                    // Show label in animProp mode (only on origin tile)
                                    if (mode === 'animProp' && offsetX === 0 && offsetY === 0) {
                                        mapCtx.fillStyle = 'rgba(0,0,0,0.7)';
                                        mapCtx.font = '10px sans-serif';
                                        mapCtx.textAlign = 'center';
                                        const nameWidth = mapCtx.measureText(prop.name).width + 4;
                                        mapCtx.fillRect(px + tileSize / 2 - nameWidth / 2, py - 14, nameWidth, 14);
                                        mapCtx.fillStyle = '#fff';
                                        mapCtx.fillText(prop.name, px + tileSize / 2, py - 3);
                                    }
                                }
                            }
                        }
                    }
                }

                // Draw player preview at end if it's beyond all layers (only on spawn map)
                if (playerLayerIndex >= layers.length && playerPreviewVisible && currentMapName === spawnMapName) {
                    drawPlayerPreview(tileSize);
                }

                mapCtx.globalAlpha = 1;
            }

            // Draw copy selection rectangle if in copy mode
            if (copyMode && copyStart && copyEnd) {
                const minX = Math.min(copyStart.x, copyEnd.x);
                const maxX = Math.max(copyStart.x, copyEnd.x);
                const minY = Math.min(copyStart.y, copyEnd.y);
                const maxY = Math.max(copyStart.y, copyEnd.y);

                mapCtx.fillStyle = 'rgba(74, 175, 255, 0.3)';
                mapCtx.fillRect(minX * tileSize, minY * tileSize, (maxX - minX + 1) * tileSize, (maxY - minY + 1) * tileSize);

                mapCtx.strokeStyle = '#4af';
                mapCtx.lineWidth = 3;
                mapCtx.setLineDash([5, 5]);
                mapCtx.strokeRect(minX * tileSize, minY * tileSize, (maxX - minX + 1) * tileSize, (maxY - minY + 1) * tileSize);
                mapCtx.setLineDash([]);
            }

            // Draw transparent preview of selected tiles at hover position
            // Skip when in animProp mode (animProp has its own preview)
            if (hoverMapPos && selectedTileData && !copyMode && mode !== 'animProp') {
                mapCtx.globalAlpha = 0.5;
                const selW = selectedTileData.width || 1;
                const selH = selectedTileData.height || 1;

                // Check if using copied tiles
                if (selectedTileData.isCopied && copiedTiles) {
                    // Draw preview of copied tiles
                    if (copiedAllLayers) {
                        // Draw all layers preview (composite)
                        for (let li = 0; li < copiedTiles.length; li++) {
                            for (let dy = 0; dy < selH; dy++) {
                                for (let dx = 0; dx < selW; dx++) {
                                    const mx = hoverMapPos.x + dx;
                                    const my = hoverMapPos.y + dy;
                                    if (mx >= 0 && mx < mapCols && my >= 0 && my < mapRows) {
                                        const srcCell = copiedTiles[li] && copiedTiles[li][dy] && copiedTiles[li][dy][dx];
                                        if (srcCell) {
                                            const px = mx * tileSize;
                                            const py = my * tileSize;
                                            if (srcCell.type === 'tile') {
                                                const cellTileset = tilesets[srcCell.tilesetIndex || 0]?.img || tilesetImg;
                                                if (cellTileset) {
                                                    drawRotatedTile(mapCtx, cellTileset, srcCell.x, srcCell.y, gridSize, px, py, tileSize, srcCell.rotation || 0, srcCell.inverted || false);
                                                }
                                            } else if (srcCell.type === 'prop') {
                                                const propIdx = srcCell.propIndex || 0;
                                                const propImg = props[propIdx]?.img;
                                                if (propImg) {
                                                    mapCtx.drawImage(propImg, srcCell.x, srcCell.y, gridSize, gridSize, px, py, tileSize, tileSize);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        // Single layer preview
                        for (let dy = 0; dy < selH; dy++) {
                            for (let dx = 0; dx < selW; dx++) {
                                const mx = hoverMapPos.x + dx;
                                const my = hoverMapPos.y + dy;
                                if (mx >= 0 && mx < mapCols && my >= 0 && my < mapRows) {
                                    const srcCell = copiedTiles[dy] && copiedTiles[dy][dx];
                                    if (srcCell) {
                                        const px = mx * tileSize;
                                        const py = my * tileSize;
                                        if (srcCell.type === 'tile') {
                                            const cellTileset = tilesets[srcCell.tilesetIndex || 0]?.img || tilesetImg;
                                            if (cellTileset) {
                                                drawRotatedTile(mapCtx, cellTileset, srcCell.x, srcCell.y, gridSize, px, py, tileSize, srcCell.rotation || 0, srcCell.inverted || false);
                                            }
                                        } else if (srcCell.type === 'prop') {
                                            const propIdx = srcCell.propIndex || 0;
                                            const propImg = props[propIdx]?.img;
                                            if (propImg) {
                                                mapCtx.drawImage(propImg, srcCell.x, srcCell.y, gridSize, gridSize, px, py, tileSize, tileSize);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // Draw preview from tileset/prop selection
                    const sourceImg = selectedTileData.isProp ? propImage : tilesetImg;

                    if (sourceImg) {
                        for (let dy = 0; dy < selH; dy++) {
                            for (let dx = 0; dx < selW; dx++) {
                                const mx = hoverMapPos.x + dx;
                                const my = hoverMapPos.y + dy;
                                if (mx >= 0 && mx < mapCols && my >= 0 && my < mapRows) {
                                    // Mirror source tile position when flipped
                                    const srcDx = tileFlippedH ? (selW - 1 - dx) : dx;
                                    const tileX = selectedTileData.x + srcDx * gridSize;
                                    const tileY = selectedTileData.y + dy * gridSize;
                                    const px = mx * tileSize;
                                    const py = my * tileSize;
                                    if (selectedTileData.isProp) {
                                        mapCtx.drawImage(sourceImg, tileX, tileY, gridSize, gridSize, px, py, tileSize, tileSize);
                                    } else {
                                        drawRotatedTile(mapCtx, sourceImg, tileX, tileY, gridSize, px, py, tileSize, tileRotation, tileFlippedH);
                                    }
                                }
                            }
                        }
                    }
                }

                // Draw outline
                mapCtx.globalAlpha = 1;
                mapCtx.strokeStyle = selectedTileData.isCopied ? '#ff0' : (selectedTileData.isProp ? '#4af' : '#0f0');
                mapCtx.lineWidth = 2;
                mapCtx.strokeRect(
                    hoverMapPos.x * tileSize,
                    hoverMapPos.y * tileSize,
                    selW * tileSize,
                    selH * tileSize
                );
            }

            // Draw static object placement preview when hovering
            if (mode === 'animProp' && hoverMapPos && currentStaticObjIndex >= 0 && !copyMode) {
                const obj = staticObjects[currentStaticObjIndex];
                if (obj && obj._spriteImg && obj._spriteImg.complete) {
                    const scale = staticObjPlacementScale;
                    const srcW = obj.width * gridSize;
                    const srcH = obj.height * gridSize;
                    // Use tileSize for canvas display
                    const drawW = obj.width * tileSize * scale;
                    const drawH = obj.height * tileSize * scale;
                    const drawX = hoverMapPos.x * tileSize;
                    const drawY = hoverMapPos.y * tileSize;

                    mapCtx.globalAlpha = 0.5;
                    mapCtx.imageSmoothingEnabled = false;
                    mapCtx.drawImage(obj._spriteImg, 0, 0, srcW, srcH, drawX, drawY, drawW, drawH);
                    mapCtx.globalAlpha = 1;

                    // Outline
                    mapCtx.strokeStyle = '#4a7c59';
                    mapCtx.lineWidth = 2;
                    mapCtx.strokeRect(drawX, drawY, drawW, drawH);
                }
            }

            // Draw animated prop placement preview when hovering in animProp mode
            if (mode === 'animProp' && hoverMapPos && currentAnimPropIndex >= 0 && !copyMode) {
                const prop = animatedProps[currentAnimPropIndex];
                if (prop) {
                    const frames = prop.frames || [];
                    const spriteImg = prop._spriteImg;
                    const drawX = hoverMapPos.x * tileSize;
                    const drawY = hoverMapPos.y * tileSize;
                    const scale = currentAnimPropScale || 1; // preview at the scale it will be placed

                    mapCtx.globalAlpha = 0.5;
                    if (spriteImg && frames.length > 0) {
                        const frame = frames[0];
                        // Calculate how many tiles this prop spans
                        const origW = Math.ceil(frame.w / gridSize);
                        const origH = Math.ceil(frame.h / gridSize);
                        // Apply rotation to dimensions
                        const rot = tileRotation;
                        const placedW = (rot === 90 || rot === 270) ? origH : origW;
                        const placedH = (rot === 90 || rot === 270) ? origW : origH;
                        const drawW = placedW * tileSize; // footprint (tiles it occupies)
                        const drawH = placedH * tileSize;
                        // Scaled sprite size, centered within the footprint (matches placed render)
                        const sW = origW * tileSize * scale;
                        const sH = origH * tileSize * scale;

                        mapCtx.imageSmoothingEnabled = false;
                        // Draw with rotation, scaled and centered
                        if (rot === 0) {
                            const sx = drawX + (origW * tileSize - sW) / 2;
                            const sy = drawY + (origH * tileSize - sH) / 2;
                            mapCtx.drawImage(spriteImg, frame.x, frame.y, frame.w, frame.h, sx, sy, sW, sH);
                        } else {
                            mapCtx.save();
                            mapCtx.translate(drawX + drawW / 2, drawY + drawH / 2);
                            mapCtx.rotate(rot * Math.PI / 180);
                            // After rotation, draw centered at scaled size
                            mapCtx.drawImage(spriteImg, frame.x, frame.y, frame.w, frame.h, -sW / 2, -sH / 2, sW, sH);
                            mapCtx.restore();
                        }

                        mapCtx.globalAlpha = 1;
                        // Solid outline = actual scaled size; dashed = tile footprint it snaps to
                        const oxC = drawX + (origW * tileSize - sW) / 2;
                        const oyC = drawY + (origH * tileSize - sH) / 2;
                        mapCtx.strokeStyle = '#f0a';
                        mapCtx.lineWidth = 2;
                        mapCtx.strokeRect(oxC, oyC, sW, sH);
                        mapCtx.setLineDash([4, 4]);
                        mapCtx.lineWidth = 1;
                        mapCtx.strokeRect(drawX, drawY, drawW, drawH);
                        mapCtx.setLineDash([]);
                    } else {
                        // Placeholder preview
                        mapCtx.fillStyle = '#f0a';
                        mapCtx.fillRect(drawX + 2, drawY + 2, tileSize - 4, tileSize - 4);
                        mapCtx.globalAlpha = 1;
                        mapCtx.strokeStyle = '#f0a';
                        mapCtx.lineWidth = 2;
                        mapCtx.strokeRect(drawX, drawY, tileSize, tileSize);
                    }
                }
            }

            // Draw sound markers when in sound mode
            if (mode === 'sound' && tileSounds) {
                Object.keys(tileSounds).forEach(key => {
                    try {
                        // Filter by current map (keys are "mapName:x,y")
                        if (!key.startsWith(currentMapName + ':')) return;
                        const coords = key.split(':')[1];
                        const parts = coords.split(',');
                        const sx = parseInt(parts[0]) || 0;
                        const sy = parseInt(parts[1]) || 0;
                        const ts = tileSounds[key];
                        if (!ts) return;

                        const px = sx * tileSize + tileSize / 2;
                        const py = sy * tileSize + tileSize / 2;
                        const radius = ts.radius || 3;
                        const isSelected = key === selectedTileSoundKey;

                        // Draw radius circle (highlighted if selected)
                        mapCtx.strokeStyle = isSelected ? 'rgba(0, 255, 100, 0.8)' : 'rgba(255, 165, 0, 0.5)';
                        mapCtx.lineWidth = isSelected ? 3 : 2;
                        mapCtx.setLineDash(isSelected ? [] : [5, 5]);
                        mapCtx.beginPath();
                        mapCtx.arc(px, py, radius * tileSize, 0, Math.PI * 2);
                        mapCtx.stroke();
                        mapCtx.setLineDash([]);

                        // Draw fade zone indicator if selected
                        if (isSelected && ts.fadePercent > 0) {
                            const fadeStartRadius = radius * (1 - ts.fadePercent);
                            mapCtx.strokeStyle = 'rgba(0, 255, 100, 0.4)';
                            mapCtx.lineWidth = 1;
                            mapCtx.setLineDash([3, 3]);
                            mapCtx.beginPath();
                            mapCtx.arc(px, py, fadeStartRadius * tileSize, 0, Math.PI * 2);
                            mapCtx.stroke();
                            mapCtx.setLineDash([]);
                        }

                        // Draw speaker icon (highlighted if selected)
                        mapCtx.fillStyle = isSelected ? '#0f8' : (ts.loop ? '#ffa500' : '#ff6600');
                        mapCtx.beginPath();
                        mapCtx.arc(px, py, tileSize / 4, 0, Math.PI * 2);
                        mapCtx.fill();

                        // Sound wave icon
                        mapCtx.font = `${tileSize / 3}px sans-serif`;
                        mapCtx.textAlign = 'center';
                        mapCtx.textBaseline = 'middle';
                        mapCtx.fillStyle = '#fff';
                        mapCtx.fillText('🔊', px, py);
                    } catch (e) {
                        console.error('Error drawing sound marker:', key, e);
                    }
                });
            }

            // Draw light markers when in lighting mode (but hide guide UI when preview is on)
            if (mode === 'lighting' && pointLights && !lightingPreviewEnabled) {
                Object.keys(pointLights).forEach(key => {
                    try {
                        if (!key.startsWith(currentMapName + ':')) return;
                        const coords = key.split(':')[1];
                        const parts = coords.split(',');
                        const lx = parseInt(parts[0]) || 0;
                        const ly = parseInt(parts[1]) || 0;
                        const light = pointLights[key];
                        if (!light) return;

                        const px = lx * tileSize + tileSize / 2;
                        const py = ly * tileSize + tileSize / 2;
                        const radius = light.radius || 3;

                        // Draw light radius circle
                        mapCtx.strokeStyle = 'rgba(255, 220, 100, 0.6)';
                        mapCtx.lineWidth = 2;
                        mapCtx.setLineDash([5, 5]);
                        mapCtx.beginPath();
                        mapCtx.arc(px, py, radius * tileSize, 0, Math.PI * 2);
                        mapCtx.stroke();
                        mapCtx.setLineDash([]);

                        // Draw light glow gradient preview
                        const gradient = mapCtx.createRadialGradient(px, py, 0, px, py, radius * tileSize);
                        gradient.addColorStop(0, 'rgba(255, 220, 100, 0.3)');
                        gradient.addColorStop(0.6, 'rgba(255, 200, 50, 0.1)');
                        gradient.addColorStop(1, 'rgba(255, 200, 50, 0)');
                        mapCtx.fillStyle = gradient;
                        mapCtx.beginPath();
                        mapCtx.arc(px, py, radius * tileSize, 0, Math.PI * 2);
                        mapCtx.fill();

                        // Draw light bulb icon
                        mapCtx.fillStyle = light.flicker ? '#ffd700' : '#ffaa00';
                        mapCtx.beginPath();
                        mapCtx.arc(px, py, tileSize / 4, 0, Math.PI * 2);
                        mapCtx.fill();

                        mapCtx.font = `${tileSize / 3}px sans-serif`;
                        mapCtx.textAlign = 'center';
                        mapCtx.textBaseline = 'middle';
                        mapCtx.fillStyle = '#fff';
                        mapCtx.fillText('💡', px, py);
                    } catch (e) {
                        console.error('Error drawing light marker:', key, e);
                    }
                });

                // Draw placed polygon lights (guide UI)
                polyLights.filter(pl => pl.mapName === currentMapName).forEach((poly, idx) => {
                    if (poly.points.length < 3) return;

                    // Draw filled polygon with light glow
                    mapCtx.fillStyle = 'rgba(255, 220, 100, ' + (poly.intensity * 0.3) + ')';
                    mapCtx.beginPath();
                    mapCtx.moveTo(poly.points[0].x * tileSize, poly.points[0].y * tileSize);
                    for (let i = 1; i < poly.points.length; i++) {
                        mapCtx.lineTo(poly.points[i].x * tileSize, poly.points[i].y * tileSize);
                    }
                    mapCtx.closePath();
                    mapCtx.fill();

                    // Draw outline
                    mapCtx.strokeStyle = poly.flicker ? '#ffd700' : '#ffaa00';
                    mapCtx.lineWidth = 2;
                    mapCtx.stroke();

                    // Draw vertex points
                    mapCtx.fillStyle = '#0ff';
                    poly.points.forEach(pt => {
                        mapCtx.beginPath();
                        mapCtx.arc(pt.x * tileSize, pt.y * tileSize, 4, 0, Math.PI * 2);
                        mapCtx.fill();
                    });
                });

                // Draw polygon being drawn (preview)
                if (polyLightDrawing && polyLightPoints.length > 0) {
                    // Draw preview lines
                    mapCtx.strokeStyle = '#0ff';
                    mapCtx.lineWidth = 2;
                    mapCtx.setLineDash([5, 5]);
                    mapCtx.beginPath();
                    mapCtx.moveTo(polyLightPoints[0].x * tileSize, polyLightPoints[0].y * tileSize);
                    for (let i = 1; i < polyLightPoints.length; i++) {
                        mapCtx.lineTo(polyLightPoints[i].x * tileSize, polyLightPoints[i].y * tileSize);
                    }
                    mapCtx.stroke();
                    mapCtx.setLineDash([]);

                    // Draw placed points
                    mapCtx.fillStyle = '#0ff';
                    polyLightPoints.forEach((pt, i) => {
                        mapCtx.beginPath();
                        mapCtx.arc(pt.x * tileSize, pt.y * tileSize, 6, 0, Math.PI * 2);
                        mapCtx.fill();

                        // Number the points
                        mapCtx.fillStyle = '#000';
                        mapCtx.font = '10px sans-serif';
                        mapCtx.textAlign = 'center';
                        mapCtx.textBaseline = 'middle';
                        mapCtx.fillText('' + (i + 1), pt.x * tileSize, pt.y * tileSize);
                        mapCtx.fillStyle = '#0ff';
                    });
                }
            }

            // Draw triggers when in trigger mode, camera bounds when in camera mode, dialog tiles when in dialog mode
            if (mode === 'trigger' || mode === 'camera' || mode === 'dialog' || mode === 'fish') {
                // Show trigger drag preview (purple box while dragging)
                if (triggerDragStart && triggerDragEnd) {
                    const x1 = Math.min(triggerDragStart.x, triggerDragEnd.x);
                    const y1 = Math.min(triggerDragStart.y, triggerDragEnd.y);
                    const x2 = Math.max(triggerDragStart.x, triggerDragEnd.x);
                    const y2 = Math.max(triggerDragStart.y, triggerDragEnd.y);
                    const w = (x2 - x1 + 1) * tileSize;
                    const h = (y2 - y1 + 1) * tileSize;

                    mapCtx.fillStyle = 'rgba(255, 0, 255, 0.4)';
                    mapCtx.fillRect(x1 * tileSize, y1 * tileSize, w, h);
                    mapCtx.strokeStyle = '#f0f';
                    mapCtx.lineWidth = 3;
                    mapCtx.setLineDash([5, 5]);
                    mapCtx.strokeRect(x1 * tileSize, y1 * tileSize, w, h);
                    mapCtx.setLineDash([]);

                    // Show dimensions
                    mapCtx.fillStyle = '#fff';
                    mapCtx.font = 'bold 12px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'middle';
                    const dimText = (x2 - x1 + 1) + 'x' + (y2 - y1 + 1);
                    mapCtx.fillText(dimText, x1 * tileSize + w / 2, y1 * tileSize + h / 2);
                }

                // Show spawn point marker following mouse when setting spawn
                if (settingSpawnPoint && hoverMapPos) {
                    const hx = hoverMapPos.x * tileSize;
                    const hy = hoverMapPos.y * tileSize;

                    // Green spawn box follows mouse
                    mapCtx.fillStyle = 'rgba(0, 255, 100, 0.5)';
                    mapCtx.fillRect(hx, hy, tileSize, tileSize);
                    mapCtx.strokeStyle = '#0f0';
                    mapCtx.lineWidth = 3;
                    mapCtx.strokeRect(hx, hy, tileSize, tileSize);

                    // Label
                    mapCtx.fillStyle = '#fff';
                    mapCtx.font = 'bold 10px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'middle';
                    const doorNum = pendingTriggerForSpawn ? pendingTriggerForSpawn.doorNumber : '?';
                    mapCtx.fillText('Door ' + doorNum, hx + tileSize / 2, hy + tileSize / 2 - 6);
                    mapCtx.fillText('SPAWN', hx + tileSize / 2, hy + tileSize / 2 + 6);

                    // Draw instruction banner at top
                    mapCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                    mapCtx.fillRect(0, 0, mapCanvas.width, 30);
                    mapCtx.fillStyle = '#0f0';
                    mapCtx.font = 'bold 14px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.fillText('CLICK TO PLACE SPAWN FOR DOOR ' + doorNum, mapCanvas.width / 2, 18);
                }

                // Show walk-out point marker following mouse when setting walk-out
                if (settingWalkOutPoint && hoverMapPos) {
                    const hx = hoverMapPos.x * tileSize;
                    const hy = hoverMapPos.y * tileSize;

                    // Cyan walk-out box follows mouse
                    mapCtx.fillStyle = 'rgba(0, 255, 255, 0.5)';
                    mapCtx.fillRect(hx, hy, tileSize, tileSize);
                    mapCtx.strokeStyle = '#0ff';
                    mapCtx.lineWidth = 3;
                    mapCtx.strokeRect(hx, hy, tileSize, tileSize);

                    // Label
                    mapCtx.fillStyle = '#fff';
                    mapCtx.font = 'bold 10px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'middle';
                    const doorNum = pendingWalkOutTrigger ? pendingWalkOutTrigger.doorNumber : '?';
                    mapCtx.fillText('Door ' + doorNum, hx + tileSize / 2, hy + tileSize / 2 - 6);
                    mapCtx.fillText('WALK-OUT', hx + tileSize / 2, hy + tileSize / 2 + 6);

                    // Draw line from door trigger to cursor
                    if (pendingWalkOutTrigger) {
                        const startX = pendingWalkOutTrigger.x * tileSize + tileSize / 2;
                        const startY = pendingWalkOutTrigger.y * tileSize + tileSize / 2;
                        mapCtx.strokeStyle = '#0ff';
                        mapCtx.lineWidth = 2;
                        mapCtx.setLineDash([5, 5]);
                        mapCtx.beginPath();
                        mapCtx.moveTo(startX, startY);
                        mapCtx.lineTo(hx + tileSize / 2, hy + tileSize / 2);
                        mapCtx.stroke();
                        mapCtx.setLineDash([]);
                    }

                    // Draw instruction banner at top
                    mapCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                    mapCtx.fillRect(0, 0, mapCanvas.width, 30);
                    mapCtx.fillStyle = '#0ff';
                    mapCtx.font = 'bold 14px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.fillText('CLICK WHERE PLAYER WALKS TO BEFORE FADE (DOOR ' + doorNum + ')', mapCanvas.width / 2, 18);
                }

                // Draw triggers ON this map (purple boxes - where you enter)
                const currentTriggers = placedTriggers.filter(t => t.mapName === currentMapName);
                currentTriggers.forEach(trigger => {
                    const px = trigger.x * tileSize;
                    const py = trigger.y * tileSize;
                    const pw = (trigger.width || 1) * tileSize;
                    const ph = (trigger.height || 1) * tileSize;
                    const doorNum = trigger.doorNumber || 1;
                    const doorType = trigger.doorType || 'walkover';
                    const isExternal = doorType === 'external';

                    // Draw trigger zone fill (cyan for external, purple for internal)
                    mapCtx.fillStyle = isExternal ? 'rgba(0, 255, 255, 0.3)' : 'rgba(255, 100, 255, 0.3)';
                    mapCtx.fillRect(px, py, pw, ph);

                    // Draw border
                    mapCtx.strokeStyle = isExternal ? 'rgba(0, 255, 255, 0.8)' : 'rgba(255, 100, 255, 0.8)';
                    mapCtx.lineWidth = 2;
                    mapCtx.strokeRect(px, py, pw, ph);

                    // Draw door number label with type indicator
                    mapCtx.fillStyle = '#fff';
                    mapCtx.font = 'bold 11px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'middle';
                    const typeLabel = doorType === 'interact' ? '[E]' : (isExternal ? '[EXT]' : '');
                    mapCtx.fillText('Door ' + doorNum + ' ' + typeLabel, px + pw / 2, py + ph / 2 - 5);

                    // Draw destination below
                    mapCtx.font = '9px monospace';
                    mapCtx.fillStyle = isExternal ? '#0ff' : '#f4f';
                    const destLabel = isExternal ? trigger.externalUrl : trigger.targetMap;
                    mapCtx.fillText('→ ' + destLabel, px + pw / 2, py + ph / 2 + 7);

                    // Draw walk-out point and line if set
                    if (trigger.walkOutX !== null && trigger.walkOutX !== undefined &&
                        trigger.walkOutY !== null && trigger.walkOutY !== undefined) {
                        const woX = trigger.walkOutX * tileSize;
                        const woY = trigger.walkOutY * tileSize;

                        // Draw dashed line from trigger center to walk-out
                        mapCtx.strokeStyle = '#0ff';
                        mapCtx.lineWidth = 2;
                        mapCtx.setLineDash([4, 4]);
                        mapCtx.beginPath();
                        mapCtx.moveTo(px + pw / 2, py + ph / 2);
                        mapCtx.lineTo(woX + tileSize / 2, woY + tileSize / 2);
                        mapCtx.stroke();
                        mapCtx.setLineDash([]);

                        // Draw cyan walk-out box
                        mapCtx.fillStyle = 'rgba(0, 255, 255, 0.3)';
                        mapCtx.fillRect(woX, woY, tileSize, tileSize);
                        mapCtx.strokeStyle = '#0ff';
                        mapCtx.lineWidth = 2;
                        mapCtx.strokeRect(woX, woY, tileSize, tileSize);

                        // Label
                        mapCtx.fillStyle = '#0ff';
                        mapCtx.font = 'bold 8px monospace';
                        mapCtx.textAlign = 'center';
                        mapCtx.textBaseline = 'middle';
                        mapCtx.fillText('WALK', woX + tileSize / 2, woY + tileSize / 2 - 4);
                        mapCtx.fillText('OUT', woX + tileSize / 2, woY + tileSize / 2 + 5);
                    }
                });

                // Draw spawn points TO this map (green boxes - where you exit/appear)
                // Only draw if spawn has been set (not null)
                const incomingTriggers = placedTriggers.filter(t => t.targetMap === currentMapName && t.targetX !== null && t.targetY !== null);
                incomingTriggers.forEach(trigger => {
                    const sx = trigger.targetX * tileSize;
                    const sy = trigger.targetY * tileSize;
                    const doorNum = trigger.doorNumber || 1;

                    // Green spawn box
                    mapCtx.fillStyle = 'rgba(0, 255, 0, 0.3)';
                    mapCtx.fillRect(sx, sy, tileSize, tileSize);
                    mapCtx.strokeStyle = '#0f0';
                    mapCtx.lineWidth = 2;
                    mapCtx.strokeRect(sx, sy, tileSize, tileSize);

                    // Label: "Door X from [mapName]"
                    mapCtx.fillStyle = '#0f0';
                    mapCtx.font = 'bold 10px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'middle';
                    mapCtx.fillText('Door ' + doorNum, sx + tileSize / 2, sy + tileSize / 2 - 5);
                    mapCtx.font = '8px monospace';
                    mapCtx.fillText('from ' + trigger.mapName, sx + tileSize / 2, sy + tileSize / 2 + 6);
                });

                // Draw RETURN spawn points for external doors (cyan boxes - where you return from 3D)
                const externalReturns = placedTriggers.filter(t =>
                    t.doorType === 'external' &&
                    t.mapName === currentMapName &&
                    t.returnX !== null && t.returnY !== null
                );
                externalReturns.forEach(trigger => {
                    const sx = trigger.returnX * tileSize;
                    const sy = trigger.returnY * tileSize;
                    const doorNum = trigger.doorNumber || 1;

                    // Cyan return box
                    mapCtx.fillStyle = 'rgba(0, 255, 255, 0.3)';
                    mapCtx.fillRect(sx, sy, tileSize, tileSize);
                    mapCtx.strokeStyle = '#0ff';
                    mapCtx.lineWidth = 2;
                    mapCtx.strokeRect(sx, sy, tileSize, tileSize);

                    // Label: "Door X RETURN"
                    mapCtx.fillStyle = '#0ff';
                    mapCtx.font = 'bold 10px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'middle';
                    mapCtx.fillText('Door ' + doorNum, sx + tileSize / 2, sy + tileSize / 2 - 5);
                    mapCtx.font = '8px monospace';
                    mapCtx.fillText('RETURN', sx + tileSize / 2, sy + tileSize / 2 + 6);
                });

                // Draw dialog tiles (signs) - orange speech bubble markers
                const currentDialogTiles = placedDialogTiles.filter(t => t.mapName === currentMapName);
                currentDialogTiles.forEach(tile => {
                    const tx = tile.x * tileSize;
                    const ty = tile.y * tileSize;
                    const dialogName = dialogs[tile.dialogIndex]?.name || '?';

                    // Orange fill
                    mapCtx.fillStyle = 'rgba(255, 160, 0, 0.4)';
                    mapCtx.fillRect(tx, ty, tileSize, tileSize);

                    // Orange border
                    mapCtx.strokeStyle = '#fa0';
                    mapCtx.lineWidth = 2;
                    mapCtx.strokeRect(tx, ty, tileSize, tileSize);

                    // Speech bubble icon (simple triangle + circle)
                    const cx = tx + tileSize / 2;
                    const cy = ty + tileSize / 2 - 3;
                    mapCtx.fillStyle = '#fff';
                    mapCtx.beginPath();
                    mapCtx.arc(cx, cy, tileSize / 4, 0, Math.PI * 2);
                    mapCtx.fill();
                    // Triangle pointer
                    mapCtx.beginPath();
                    mapCtx.moveTo(cx - 3, cy + tileSize / 4 - 2);
                    mapCtx.lineTo(cx - 6, cy + tileSize / 3 + 2);
                    mapCtx.lineTo(cx + 2, cy + tileSize / 4);
                    mapCtx.fill();

                    // Dialog name below
                    mapCtx.fillStyle = '#fa0';
                    mapCtx.font = '8px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'top';
                    mapCtx.fillText(dialogName.substring(0, 8), cx, ty + tileSize + 2);
                });

                // Draw camera bounds (yellow/orange border)
                if (cameraBounds) {
                    const bx = cameraBounds.x * tileSize;
                    const by = cameraBounds.y * tileSize;
                    const bw = cameraBounds.width * tileSize;
                    const bh = cameraBounds.height * tileSize;

                    // Semi-transparent fill outside bounds
                    mapCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                    // Top
                    mapCtx.fillRect(0, 0, mapCanvas.width, by);
                    // Bottom
                    mapCtx.fillRect(0, by + bh, mapCanvas.width, mapCanvas.height - (by + bh));
                    // Left
                    mapCtx.fillRect(0, by, bx, bh);
                    // Right
                    mapCtx.fillRect(bx + bw, by, mapCanvas.width - (bx + bw), bh);

                    // Draw bounds border
                    mapCtx.strokeStyle = '#fa0';
                    mapCtx.lineWidth = 3;
                    mapCtx.setLineDash([8, 4]);
                    mapCtx.strokeRect(bx, by, bw, bh);
                    mapCtx.setLineDash([]);

                    // Label
                    mapCtx.fillStyle = '#fa0';
                    mapCtx.font = 'bold 11px monospace';
                    mapCtx.textAlign = 'left';
                    mapCtx.textBaseline = 'top';
                    mapCtx.fillText('CAMERA BOUNDS', bx + 5, by + 5);
                }

                // Draw camera bounds preview while dragging
                if (settingCameraBounds && cameraBoundsDragStart && cameraBoundsDragEnd) {
                    const x1 = Math.min(cameraBoundsDragStart.x, cameraBoundsDragEnd.x);
                    const y1 = Math.min(cameraBoundsDragStart.y, cameraBoundsDragEnd.y);
                    const x2 = Math.max(cameraBoundsDragStart.x, cameraBoundsDragEnd.x);
                    const y2 = Math.max(cameraBoundsDragStart.y, cameraBoundsDragEnd.y);
                    const w = (x2 - x1 + 1) * tileSize;
                    const h = (y2 - y1 + 1) * tileSize;

                    mapCtx.fillStyle = 'rgba(255, 170, 0, 0.2)';
                    mapCtx.fillRect(x1 * tileSize, y1 * tileSize, w, h);
                    mapCtx.strokeStyle = '#fa0';
                    mapCtx.lineWidth = 3;
                    mapCtx.strokeRect(x1 * tileSize, y1 * tileSize, w, h);

                    // Show dimensions
                    mapCtx.fillStyle = '#fff';
                    mapCtx.font = 'bold 12px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'middle';
                    mapCtx.fillText((x2 - x1 + 1) + 'x' + (y2 - y1 + 1) + ' tiles', x1 * tileSize + w / 2, y1 * tileSize + h / 2);
                }

                // Draw fish zones (purple highlight) — only on the Fishing tab to avoid clutter
                if (mode === 'fish') {
                    fishZones.forEach((z, i) => {
                        const zx = z.x * tileSize, zy = z.y * tileSize;
                        const zw = z.width * tileSize, zh = z.height * tileSize;
                        mapCtx.fillStyle = 'rgba(168, 85, 255, 0.35)';
                        mapCtx.fillRect(zx, zy, zw, zh);
                        mapCtx.strokeStyle = '#c77dff';
                        mapCtx.lineWidth = 3;
                        mapCtx.setLineDash([8, 4]);
                        mapCtx.strokeRect(zx, zy, zw, zh);
                        mapCtx.setLineDash([]);
                        mapCtx.fillStyle = '#e0c0ff';
                        mapCtx.font = 'bold 11px monospace';
                        mapCtx.textAlign = 'left';
                        mapCtx.textBaseline = 'top';
                        mapCtx.fillText('🎣 FISH ' + (i + 1), zx + 5, zy + 5);
                    });

                    // Fish zone preview while dragging
                    if (settingFishZones && fishZoneDragStart && fishZoneDragEnd) {
                        const x1 = Math.min(fishZoneDragStart.x, fishZoneDragEnd.x);
                        const y1 = Math.min(fishZoneDragStart.y, fishZoneDragEnd.y);
                        const x2 = Math.max(fishZoneDragStart.x, fishZoneDragEnd.x);
                        const y2 = Math.max(fishZoneDragStart.y, fishZoneDragEnd.y);
                        const w = (x2 - x1 + 1) * tileSize, h = (y2 - y1 + 1) * tileSize;
                        mapCtx.fillStyle = 'rgba(168, 85, 255, 0.45)';
                        mapCtx.fillRect(x1 * tileSize, y1 * tileSize, w, h);
                        mapCtx.strokeStyle = '#c77dff';
                        mapCtx.lineWidth = 3;
                        mapCtx.strokeRect(x1 * tileSize, y1 * tileSize, w, h);
                        mapCtx.fillStyle = '#fff';
                        mapCtx.font = 'bold 12px monospace';
                        mapCtx.textAlign = 'center';
                        mapCtx.textBaseline = 'middle';
                        mapCtx.fillText((x2 - x1 + 1) + 'x' + (y2 - y1 + 1) + ' tiles', x1 * tileSize + w / 2, y1 * tileSize + h / 2);
                    }
                }
            }

            // === DRAW DOOR ANIMATION SELECTED TILES (orange) ===
            // Draw regardless of mode so they show while in tile mode
            if ((selectingAnimTiles || paintingAnimTiles) && pendingAnimTrigger && doorAnimMapName === currentMapName) {
                // Highlight selected tiles with orange (only on current layer)
                selectedAnimTiles.forEach(tile => {
                    if (tile.layer !== currentLayer) return; // Only show on matching layer
                    const tx = tile.x * tileSize;
                    const ty = tile.y * tileSize;
                    mapCtx.fillStyle = 'rgba(255, 100, 0, 0.5)';
                    mapCtx.fillRect(tx, ty, tileSize, tileSize);
                    mapCtx.strokeStyle = '#f60';
                    mapCtx.lineWidth = 2;
                    mapCtx.strokeRect(tx, ty, tileSize, tileSize);
                });
            }

            // === DRAW PLACED NPCs AND PATHS ===
            if (mode === 'npc' || placedNpcs.length > 0) {
                const currentMapNpcs = placedNpcs.filter(p => p.mapName === currentMapName);

                currentMapNpcs.forEach((placed, idx) => {
                    const globalIdx = placedNpcs.indexOf(placed);
                    const npc = npcs[placed.npcIndex];
                    if (!npc) return;

                    const isSelected = globalIdx === selectedPlacedNpcIndex;

                    // Use preview position if preview is active for this NPC
                    const usePreview = npcPathPreviewActive && isSelected && npcPreviewState;
                    const drawX = usePreview ? npcPreviewState.x : placed.x;
                    const drawY = usePreview ? npcPreviewState.y : placed.y;
                    const px = drawX * tileSize;
                    const py = drawY * tileSize;

                    // Draw path if has waypoints (only in NPC mode, hide during preview)
                    if (placed.path && placed.path.length > 0 && mode === 'npc' && !npcPathPreviewActive) {
                        mapCtx.strokeStyle = isSelected ? '#4f4' : 'rgba(100, 255, 100, 0.5)';
                        mapCtx.lineWidth = isSelected ? 3 : 2;
                        mapCtx.setLineDash(isSelected ? [] : [5, 5]);

                        // Draw line from NPC to first waypoint
                        mapCtx.beginPath();
                        mapCtx.moveTo(px + tileSize / 2, py + tileSize / 2);

                        // Draw lines through all waypoints
                        placed.path.forEach((wp, i) => {
                            const wpx = wp.x * tileSize + tileSize / 2;
                            const wpy = wp.y * tileSize + tileSize / 2;
                            mapCtx.lineTo(wpx, wpy);
                        });

                        // If loop trigger, connect back to start
                        if (placed.trigger === 'loop') {
                            mapCtx.lineTo(px + tileSize / 2, py + tileSize / 2);
                        }

                        mapCtx.stroke();
                        mapCtx.setLineDash([]);

                        // Draw waypoint markers
                        placed.path.forEach((wp, i) => {
                            const wpx = wp.x * tileSize + tileSize / 2;
                            const wpy = wp.y * tileSize + tileSize / 2;

                            mapCtx.fillStyle = isSelected ? '#4f4' : 'rgba(100, 255, 100, 0.7)';
                            mapCtx.beginPath();
                            mapCtx.arc(wpx, wpy, 6, 0, Math.PI * 2);
                            mapCtx.fill();

                            // Number
                            mapCtx.fillStyle = '#000';
                            mapCtx.font = 'bold 10px sans-serif';
                            mapCtx.textAlign = 'center';
                            mapCtx.textBaseline = 'middle';
                            mapCtx.fillText((i + 1).toString(), wpx, wpy);
                        });
                    }

                    // Draw NPC sprite - use correct animation if previewing
                    const anims = npc.animations || {};
                    let anim;
                    let frameIdx = 0;

                    if (usePreview && npcPreviewState) {
                        // Use waypoint animation if idling, otherwise directional walk
                        const dirMap = { 'down': 'walkDown', 'up': 'walkUp', 'left': 'walkLeft', 'right': 'walkRight' };
                        if (npcPreviewState.waypointAnimation && npcPreviewState.waypointAnimation !== 'walk' &&
                            anims[npcPreviewState.waypointAnimation] && anims[npcPreviewState.waypointAnimation].length > 0) {
                            // Playing waypoint animation (idle, dance, etc.)
                            anim = anims[npcPreviewState.waypointAnimation];
                        } else {
                            // Walking animation
                            anim = (anims[dirMap[npcPreviewState.direction]]?.length > 0 ? anims[dirMap[npcPreviewState.direction]] : null) ||
                               (anims.walkDown?.length > 0 ? anims.walkDown : null) ||
                               (anims.idle?.length > 0 ? anims.idle : null) ||
                               Object.values(anims).find(a => a && a.length > 0);
                        }
                        frameIdx = npcPreviewState.frame % (anim ? anim.length : 1);
                    } else {
                        anim = (anims.walkDown?.length > 0 ? anims.walkDown : null) ||
                               (anims.idle?.length > 0 ? anims.idle : null) ||
                               Object.values(anims).find(a => a && a.length > 0);
                    }

                    if (npc.spriteData && anim && anim.length > 0) {
                        const frame = anim[frameIdx] || anim[0];
                        const img = npc._editorImg;

                        if (img && img.complete) {
                            mapCtx.imageSmoothingEnabled = false;

                            // Apply per-instance scale
                            const npcScale = placed.scale || 1;
                            const drawW = tileSize * npcScale;
                            const drawH = tileSize * npcScale;

                            // Center larger/smaller NPCs on the tile
                            const offsetX = (tileSize - drawW) / 2;
                            const offsetY = tileSize - drawH; // Anchor at bottom
                            const drawX = px + offsetX;
                            const drawY = py + offsetY;

                            // Draw NPC shadow (unless noShadow is set) - matches game rendering
                            if (!npc.noShadow) {
                                const shadowOffsetX = npc.shadowOffsetX ?? 0;
                                const shadowOffsetY = npc.shadowOffsetY ?? 4;
                                const shadowWidthRatio = npc.shadowWidth ?? 0.35;
                                const shadowHeightRatio = npc.shadowHeight ?? 0.12;
                                mapCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                                mapCtx.beginPath();
                                mapCtx.ellipse(
                                    drawX + drawW / 2 + shadowOffsetX,
                                    drawY + drawH - shadowOffsetY,
                                    drawW * shadowWidthRatio,
                                    drawW * shadowHeightRatio,
                                    0, 0, Math.PI * 2
                                );
                                mapCtx.fill();
                            }

                            // Determine which animation key is being used for mirror check
                            let animKey = 'walkDown';
                            if (usePreview && npcPreviewState) {
                                if (npcPreviewState.waypointAnimation && npcPreviewState.waypointAnimation !== 'walk' &&
                                    anims[npcPreviewState.waypointAnimation] && anims[npcPreviewState.waypointAnimation].length > 0) {
                                    animKey = npcPreviewState.waypointAnimation;
                                } else {
                                    const dirMap = { 'down': 'walkDown', 'up': 'walkUp', 'left': 'walkLeft', 'right': 'walkRight' };
                                    animKey = dirMap[npcPreviewState.direction] || 'walkDown';
                                }
                            }
                            // Flip for mirrored animations OR left direction fallback
                            const animMirrors = npc.animMirrors || {};
                            const isMirrored = animMirrors[animKey];
                            const flipX = isMirrored || (usePreview && npcPreviewState && npcPreviewState.direction === 'left' && !anims.walkLeft?.length);
                            if (flipX) {
                                mapCtx.save();
                                mapCtx.translate(px + offsetX + drawW, py + offsetY);
                                mapCtx.scale(-1, 1);
                                mapCtx.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, drawW, drawH);
                                mapCtx.restore();
                            } else {
                                mapCtx.drawImage(img, frame.x, frame.y, frame.w, frame.h, px + offsetX, py + offsetY, drawW, drawH);
                            }
                        } else {
                            // Load image if not cached
                            if (!npc._editorImg) {
                                npc._editorImg = new Image();
                                npc._editorImg.onload = () => renderMap();
                                npc._editorImg.src = npc.spriteData;
                            }
                            // Draw placeholder
                            mapCtx.fillStyle = '#a4f';
                            mapCtx.fillRect(px + 4, py + 4, tileSize - 8, tileSize - 8);
                        }
                    } else {
                        // No sprite - draw placeholder
                        mapCtx.fillStyle = '#a4f';
                        mapCtx.fillRect(px + 4, py + 4, tileSize - 8, tileSize - 8);
                    }

                    // Draw selection highlight
                    if (isSelected) {
                        mapCtx.strokeStyle = '#4f4';
                        mapCtx.lineWidth = 3;
                        mapCtx.strokeRect(px, py, tileSize, tileSize);
                    }

                    // Draw enemy AI radius circles when selected
                    if (isSelected && placed.isEnemy && mode === 'npc') {
                        const centerX = px + tileSize / 2;
                        const centerY = py + tileSize / 2;

                        // Vision radius (outer ring - yellow/orange)
                        const visionRadius = (placed.visionRadius || 5) * tileSize;
                        mapCtx.strokeStyle = 'rgba(255, 200, 50, 0.8)';
                        mapCtx.lineWidth = 2;
                        mapCtx.setLineDash([8, 4]);
                        mapCtx.beginPath();
                        mapCtx.arc(centerX, centerY, visionRadius, 0, Math.PI * 2);
                        mapCtx.stroke();
                        // Fill with transparent
                        mapCtx.fillStyle = 'rgba(255, 200, 50, 0.1)';
                        mapCtx.fill();

                        // Attack radius (inner ring - red)
                        const attackRadius = (placed.attackRange || 1) * tileSize;
                        mapCtx.strokeStyle = 'rgba(255, 80, 80, 0.9)';
                        mapCtx.lineWidth = 2;
                        mapCtx.setLineDash([4, 4]);
                        mapCtx.beginPath();
                        mapCtx.arc(centerX, centerY, attackRadius, 0, Math.PI * 2);
                        mapCtx.stroke();
                        // Fill with transparent red
                        mapCtx.fillStyle = 'rgba(255, 80, 80, 0.15)';
                        mapCtx.fill();

                        mapCtx.setLineDash([]);
                    }

                    // Draw NPC name label
                    if (mode === 'npc') {
                        mapCtx.fillStyle = 'rgba(0,0,0,0.7)';
                        mapCtx.font = '10px sans-serif';
                        mapCtx.textAlign = 'center';
                        const nameWidth = mapCtx.measureText(npc.name).width + 4;
                        mapCtx.fillRect(px + tileSize / 2 - nameWidth / 2, py - 14, nameWidth, 14);
                        mapCtx.fillStyle = isSelected ? '#4f4' : '#fff';
                        mapCtx.fillText(npc.name, px + tileSize / 2, py - 3);
                    }

                    // Draw dialog indicator for NPCs with dialogs attached (in dialog or npc mode)
                    if ((mode === 'dialog' || mode === 'npc') && placed.dialogIndex >= 0) {
                        const iconX = px + tileSize - 12;
                        const iconY = py - 8;
                        // Speech bubble icon background
                        mapCtx.fillStyle = '#4af';
                        mapCtx.beginPath();
                        mapCtx.ellipse(iconX, iconY, 10, 8, 0, 0, Math.PI * 2);
                        mapCtx.fill();
                        // Triangle tail
                        mapCtx.beginPath();
                        mapCtx.moveTo(iconX - 4, iconY + 6);
                        mapCtx.lineTo(iconX - 8, iconY + 14);
                        mapCtx.lineTo(iconX + 2, iconY + 6);
                        mapCtx.fill();
                        // "..." dots
                        mapCtx.fillStyle = '#000';
                        mapCtx.beginPath();
                        mapCtx.arc(iconX - 4, iconY, 2, 0, Math.PI * 2);
                        mapCtx.arc(iconX, iconY, 2, 0, Math.PI * 2);
                        mapCtx.arc(iconX + 4, iconY, 2, 0, Math.PI * 2);
                        mapCtx.fill();
                    }

                    // Draw shop indicator for NPCs with shops attached (in shop or npc mode)
                    if ((mode === 'shop' || mode === 'npc') && placed.shopIndex >= 0 && placed.shopIndex < shops.length) {
                        const iconX = px + 8;
                        const iconY = py - 8;
                        // Gold coin icon
                        mapCtx.fillStyle = '#fa0';
                        mapCtx.beginPath();
                        mapCtx.arc(iconX, iconY, 8, 0, Math.PI * 2);
                        mapCtx.fill();
                        mapCtx.strokeStyle = '#c80';
                        mapCtx.lineWidth = 2;
                        mapCtx.stroke();
                        // $ symbol
                        mapCtx.fillStyle = '#640';
                        mapCtx.font = 'bold 10px sans-serif';
                        mapCtx.textAlign = 'center';
                        mapCtx.textBaseline = 'middle';
                        mapCtx.fillText('$', iconX, iconY);
                    }
                });
            }

            // === DRAW PLACED ITEMS ===
            if (mode === 'item' || placedItems.length > 0) {
                const currentMapItems = placedItems.filter(p => !p.mapName || p.mapName === currentMapName);

                currentMapItems.forEach((placed, idx) => {
                    const item = items[placed.itemIndex];
                    if (!item || !item.frames || item.frames.length === 0) return;

                    const px = placed.x * tileSize;
                    const py = placed.y * tileSize;

                    // Get idle frame
                    const idleIdx = item.idleFrame || 0;
                    const frame = item.frames[idleIdx] || item.frames[0];

                    // Load/use sprite image
                    if (!item._spriteImg && item.spriteData) {
                        item._spriteImg = new Image();
                        item._spriteImg.src = item.spriteData;
                    }

                    if (item._spriteImg && item._spriteImg.complete) {
                        mapCtx.imageSmoothingEnabled = false;
                        const drawW = (item.frameWidth / gridSize) * tileSize;
                        const drawH = (item.frameHeight / gridSize) * tileSize;
                        mapCtx.drawImage(item._spriteImg,
                            frame.x, frame.y, frame.w, frame.h,
                            px, py, drawW, drawH
                        );
                    }

                    // Draw item highlight and label in item mode
                    if (mode === 'item') {
                        mapCtx.strokeStyle = '#4f8';
                        mapCtx.lineWidth = 2;
                        mapCtx.strokeRect(px, py, tileSize, tileSize);

                        // Name label
                        mapCtx.fillStyle = 'rgba(0,0,0,0.7)';
                        mapCtx.font = '10px sans-serif';
                        mapCtx.textAlign = 'center';
                        const nameWidth = mapCtx.measureText(item.name).width + 4;
                        mapCtx.fillRect(px + tileSize / 2 - nameWidth / 2, py - 14, nameWidth, 14);
                        mapCtx.fillStyle = '#4f8';
                        mapCtx.fillText(item.name, px + tileSize / 2, py - 3);
                    }
                });
            }

            // === DRAW PLACED STATIC OBJECTS ===
            placedStaticObjects.forEach(placed => {
                if (placed.mapName !== currentMapName) return;

                const obj = staticObjects[placed.objIndex];
                if (!obj || !obj._spriteImg || !obj._spriteImg.complete) return;

                const scale = placed.scale || 1;
                const srcW = obj.width * gridSize;
                const srcH = obj.height * gridSize;
                // Convert to canvas coordinates and apply scale
                const drawW = obj.width * tileSize * scale;
                const drawH = obj.height * tileSize * scale;

                // placed.x/y are in grid coordinates
                const drawX = placed.x * tileSize;
                const drawY = placed.y * tileSize;

                mapCtx.imageSmoothingEnabled = false;
                mapCtx.drawImage(
                    obj._spriteImg,
                    0, 0, srcW, srcH,
                    drawX, drawY, drawW, drawH
                );

                // Show outline in animProp mode
                if (mode === 'animProp') {
                    mapCtx.strokeStyle = '#4a7c59';
                    mapCtx.lineWidth = 2;
                    mapCtx.strokeRect(drawX, drawY, drawW, drawH);

                    // In edit mode, show collision box overlay
                    if (editStaticObjOnMapMode) {
                        const cb = placed.collisionBox;
                        if (cb && cb.w > 0 && cb.h > 0) {
                            // Draw collision box
                            const boxScale = tileSize / gridSize;
                            const cbDrawX = drawX + cb.x * boxScale;
                            const cbDrawY = drawY + cb.y * boxScale;
                            const cbDrawW = cb.w * boxScale;
                            const cbDrawH = cb.h * boxScale;

                            mapCtx.fillStyle = 'rgba(79, 255, 136, 0.3)';
                            mapCtx.fillRect(cbDrawX, cbDrawY, cbDrawW, cbDrawH);
                            mapCtx.strokeStyle = '#4f8';
                            mapCtx.setLineDash([4, 2]);
                            mapCtx.strokeRect(cbDrawX, cbDrawY, cbDrawW, cbDrawH);
                            mapCtx.setLineDash([]);
                        } else if (!cb) {
                            // No custom collision - show full object as collision (semi-transparent)
                            mapCtx.fillStyle = 'rgba(255, 200, 100, 0.2)';
                            mapCtx.fillRect(drawX, drawY, drawW, drawH);
                        }
                        // cb.w/h = 0 means no collision, show nothing
                    }
                }
            });

            // === HIGHLIGHT INTERACTIVE ANIM PROPS IN ITEM MODE ===
            // Show animated props that have giveItem enabled so users can click to assign specific items
            if (mode === 'item') {
                placedAnimProps.forEach((placed, idx) => {
                    if (placed.mapName && placed.mapName !== currentMapName) return;
                    // Guard: only draw the overlay where a real animTile cell exists on the CURRENT map.
                    // Kills cross-map phantom boxes from stale/untagged placedAnimProps entries.
                    if (!animTileCellExistsAt(placed.x, placed.y)) return;
                    const prop = animatedProps[placed.propIndex];
                    if (!prop || !prop.giveItem) return;

                    // Calculate prop bounds
                    const frames = prop.frames || [];
                    if (frames.length === 0) return;
                    const frame = frames[0];
                    const tilesW = Math.ceil(frame.w / gridSize);
                    const tilesH = Math.ceil(frame.h / gridSize);

                    const px = placed.x * tileSize;
                    const py = placed.y * tileSize;
                    const pw = tilesW * tileSize;
                    const ph = tilesH * tileSize;

                    // Orange dashed border for interactive props
                    mapCtx.strokeStyle = '#fa0';
                    mapCtx.lineWidth = 3;
                    mapCtx.setLineDash([6, 4]);
                    mapCtx.strokeRect(px + 2, py + 2, pw - 4, ph - 4);
                    mapCtx.setLineDash([]);

                    // Get item name - instance override or default from prop
                    const hasInstanceItem = placed.instanceItemIndex !== undefined && placed.instanceItemIndex >= 0;
                    const itemIdx = hasInstanceItem ? placed.instanceItemIndex : prop.giveItemIndex;
                    const itemName = (itemIdx >= 0 && items[itemIdx]) ? items[itemIdx].name : 'No Item';

                    // Background for label
                    mapCtx.fillStyle = hasInstanceItem ? 'rgba(0, 200, 100, 0.8)' : 'rgba(255, 150, 0, 0.8)';
                    mapCtx.font = 'bold 10px sans-serif';
                    const labelText = hasInstanceItem ? '🎁 ' + itemName : '📦 ' + itemName;
                    const textWidth = mapCtx.measureText(labelText).width + 6;
                    mapCtx.fillRect(px + pw / 2 - textWidth / 2, py - 16, textWidth, 14);

                    // Item label text
                    mapCtx.fillStyle = '#fff';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'middle';
                    mapCtx.fillText(labelText, px + pw / 2, py - 9);

                    // "Click to set item" hint at bottom
                    mapCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    mapCtx.font = '9px sans-serif';
                    const hintText = 'Click to set item';
                    const hintWidth = mapCtx.measureText(hintText).width + 4;
                    mapCtx.fillRect(px + pw / 2 - hintWidth / 2, py + ph + 2, hintWidth, 12);
                    mapCtx.fillStyle = '#fa0';
                    mapCtx.fillText(hintText, px + pw / 2, py + ph + 8);
                });
            }

            // === HIGHLIGHT ANIMATED PROPS IN EDIT MODE ===
            // Yellow highlight when "Edit Object on Map" is active in animProp mode
            if (mode === 'animProp' && editAnimPropOnMapMode) {
                // Scan all layers for animTiles and highlight them
                const highlightedOrigins = new Set(); // Track which props we've highlighted
                for (let li = 0; li < layers.length; li++) {
                    const layer = layers[li];
                    if (!layer) continue;
                    for (let y = 0; y < mapRows; y++) {
                        if (!layer[y]) continue;
                        for (let x = 0; x < mapCols; x++) {
                            const cell = layer[y][x];
                            if (!cell || cell.type !== 'animTile') continue;

                            // Only highlight at origin to avoid duplicates
                            const originX = x - (cell.offsetX || 0);
                            const originY = y - (cell.offsetY || 0);
                            const originKey = originX + ',' + originY + ',' + li;
                            if (highlightedOrigins.has(originKey)) continue;
                            highlightedOrigins.add(originKey);

                            const prop = animatedProps[cell.propIndex];
                            if (!prop) continue;

                            // Calculate prop size
                            const tilesW = cell.tilesW || 1;
                            const tilesH = cell.tilesH || 1;
                            const px = originX * tileSize;
                            const py = originY * tileSize;
                            const pw = tilesW * tileSize;
                            const ph = tilesH * tileSize;

                            // Yellow highlight border
                            mapCtx.strokeStyle = '#ff0';
                            mapCtx.lineWidth = 3;
                            mapCtx.setLineDash([6, 4]);
                            mapCtx.strokeRect(px + 2, py + 2, pw - 4, ph - 4);
                            mapCtx.setLineDash([]);

                            // Show current mode label
                            const instanceMode = cell.instancePlayMode || 'default';
                            let modeLabel = instanceMode === 'default' ? 'Default' : (instanceMode === 'loop' ? 'Loop' : 'Timed');
                            if (instanceMode === 'timed') {
                                modeLabel += ' (' + (cell.instancePlayCount || 1) + 'x, ' + (cell.instanceWaitTime || 2) + 's)';
                            }

                            // Background for label
                            mapCtx.fillStyle = instanceMode === 'default' ? 'rgba(100, 100, 100, 0.8)' : 'rgba(255, 200, 0, 0.9)';
                            mapCtx.font = 'bold 9px sans-serif';
                            const textWidth = mapCtx.measureText(modeLabel).width + 6;
                            mapCtx.fillRect(px + pw / 2 - textWidth / 2, py - 14, textWidth, 12);

                            // Mode label text
                            mapCtx.fillStyle = '#000';
                            mapCtx.textAlign = 'center';
                            mapCtx.textBaseline = 'middle';
                            mapCtx.fillText(modeLabel, px + pw / 2, py - 8);

                            // "Click to edit" hint
                            mapCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                            mapCtx.font = '8px sans-serif';
                            const hintText = 'Click to edit';
                            const hintWidth = mapCtx.measureText(hintText).width + 4;
                            mapCtx.fillRect(px + pw / 2 - hintWidth / 2, py + ph + 2, hintWidth, 10);
                            mapCtx.fillStyle = '#ff0';
                            mapCtx.fillText(hintText, px + pw / 2, py + ph + 7);
                        }
                    }
                }
            }

            // === LIGHTING PREVIEW OVERLAY ===
            if (lightingPreviewEnabled) {
                // Get darkness level from slider (0-100 -> 0-0.95)
                const darknessSlider = document.getElementById('previewDarknessSlider');
                const darknessLevel = darknessSlider ? parseInt(darknessSlider.value) / 100 * 0.95 : 0.7;

                if (darknessLevel > 0) {
                    // Create offscreen canvas for lighting
                    const lightCanvas = document.createElement('canvas');
                    lightCanvas.width = mapCanvas.width;
                    lightCanvas.height = mapCanvas.height;
                    const lightCtx = lightCanvas.getContext('2d');

                    // Fill with darkness (black with slider-controlled alpha)
                    lightCtx.fillStyle = 'rgba(0, 0, 20, ' + darknessLevel + ')';
                    lightCtx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

                    // Cut out point lights
                    lightCtx.globalCompositeOperation = 'destination-out';
                    Object.keys(pointLights).forEach(key => {
                        if (!key.startsWith(currentMapName + ':')) return;
                        const light = pointLights[key];
                        const coords = key.split(':')[1].split(',');
                        const lx = parseFloat(coords[0]);
                        const ly = parseFloat(coords[1]);
                        const px = lx * tileSize + tileSize / 2;
                        const py = ly * tileSize + tileSize / 2;
                        const radius = light.radius * tileSize;

                        const gradient = lightCtx.createRadialGradient(px, py, 0, px, py, radius);
                        gradient.addColorStop(0, 'rgba(255,255,255,1)');
                        gradient.addColorStop(0.6, 'rgba(255,255,255,0.5)');
                        gradient.addColorStop(1, 'rgba(255,255,255,0)');
                        lightCtx.fillStyle = gradient;
                        lightCtx.beginPath();
                        lightCtx.arc(px, py, radius, 0, Math.PI * 2);
                        lightCtx.fill();
                    });

                    // Cut out polygon lights
                    polyLights.filter(pl => pl.mapName === currentMapName).forEach(poly => {
                        if (poly.points.length < 3) return;
                        lightCtx.beginPath();
                        lightCtx.moveTo(poly.points[0].x * tileSize, poly.points[0].y * tileSize);
                        for (let i = 1; i < poly.points.length; i++) {
                            lightCtx.lineTo(poly.points[i].x * tileSize, poly.points[i].y * tileSize);
                        }
                        lightCtx.closePath();
                        lightCtx.fillStyle = 'rgba(255,255,255,' + (poly.intensity || 1) + ')';
                        lightCtx.fill();
                    });

                    // Draw lighting overlay on map
                    mapCtx.drawImage(lightCanvas, 0, 0);
                }
            }

            // === DRAW INITIAL SPAWN POINT MARKER ===
            // Only show on the map where spawn is set
            if (playerPreviewPos && currentMapName === spawnMapName) {
                const spawnX = playerPreviewPos.x * tileSize;
                const spawnY = playerPreviewPos.y * tileSize;

                // Green spawn box
                mapCtx.fillStyle = 'rgba(0, 255, 0, 0.3)';
                mapCtx.fillRect(spawnX, spawnY, tileSize, tileSize);
                mapCtx.strokeStyle = '#0f0';
                mapCtx.lineWidth = 2;
                mapCtx.strokeRect(spawnX, spawnY, tileSize, tileSize);

                // Label: "SPAWN" and "from [mapName]"
                mapCtx.fillStyle = '#0f0';
                mapCtx.font = 'bold 10px monospace';
                mapCtx.textAlign = 'center';
                mapCtx.textBaseline = 'middle';
                mapCtx.fillText('START', spawnX + tileSize / 2, spawnY + tileSize / 2 - 6);
                mapCtx.font = '9px monospace';
                mapCtx.fillStyle = '#8f8';
                mapCtx.fillText('(' + playerPreviewPos.x + ',' + playerPreviewPos.y + ')', spawnX + tileSize / 2, spawnY + tileSize / 2 + 7);
            }

            // === DRAW GAME PLAYERS (visible to builder when co-op) ===
            if (gamePlayersInBuilder.size > 0) {
                // Get the active player character sprite
                let activeSprite = null;
                if (activePlayerIndex >= 0 && playerCharacters[activePlayerIndex]) {
                    const activeChar = playerCharacters[activePlayerIndex];
                    if (activeChar._spriteImg && activeChar._spriteImg.complete && activeChar._spriteImg.naturalWidth > 0) {
                        activeSprite = activeChar._spriteImg;
                    }
                }
                // Fall back to playerSpriteImg if no active character sprite
                if (!activeSprite && playerSpriteImg && playerSpriteImg.complete && playerSpriteImg.naturalWidth > 0) {
                    activeSprite = playerSpriteImg;
                }

                // Get active character's animations for proper frame display
                const activeChar = activePlayerIndex >= 0 ? playerCharacters[activePlayerIndex] : null;
                const charAnims = activeChar?.animations || null;
                const charFrameW = activeChar?.frameWidth || 64;
                const charFrameH = activeChar?.frameHeight || 64;
                const charMirrors = activeChar?.animMirrors || {};

                // Legacy frame data fallback
                const idleFrames = {
                    down: [0, 1, 2],
                    up: [3, 4, 5],
                    right: [6, 7, 8],
                    left: [6, 7, 8]
                };
                const walkFrames = {
                    down: { row: 0, cols: [9, 10, 11, 12] },
                    up: { row: 0, cols: [13, 14, 15] },
                    right: { row: 1, cols: [1, 2, 3, 4] },
                    left: { row: 1, cols: [1, 2, 3, 4] }
                };

                gamePlayersInBuilder.forEach((gPlayer, id) => {
                    // Only show players on current map
                    if (gPlayer.currentMap !== currentMapName) return;

                    // Game coords are 4x builder coords (TILE_SCALE=2 + cameraZoom=2)
                    const px = (gPlayer.x / 4) * zoom;
                    const py = (gPlayer.y / 4) * zoom;

                    const drawSize = tileSize * 1.5;
                    const dir = gPlayer.direction || 'down';
                    const frame = gPlayer.frame || 0;

                    let srcX = 0, srcY = 0, srcW = charFrameW, srcH = charFrameH;
                    let flipX = false;

                    // Try to use new animation system
                    if (charAnims) {
                        const dirMap = { down: 'walkDown', up: 'walkUp', left: 'walkLeft', right: 'walkRight' };
                        const idleDirMap = { down: 'idleDown', up: 'idleUp', left: 'idleLeft', right: 'idleRight' };
                        const attackDirMap = { down: 'attackDown', up: 'attackUp', left: 'attackLeft', right: 'attackRight' };

                        let animKey;
                        if (gPlayer.animation === 'attack') {
                            const attackKey = attackDirMap[cardinalOf(dir)];
                            if (charAnims[attackKey] && charAnims[attackKey].length > 0) {
                                animKey = attackKey;
                            } else if (charAnims.attack && charAnims.attack.length > 0) {
                                animKey = 'attack';
                            } else {
                                animKey = dirMap[cardinalOf(dir)];
                            }
                        } else if (gPlayer.animation === 'walk') {
                            const _wr = resolveWalkKey(charAnims, dir);
                            animKey = _wr.key;
                            if (_wr.flip) flipX = true;
                        } else {
                            const dirIdleKey = idleDirMap[cardinalOf(dir)];
                            if (charAnims[dirIdleKey] && charAnims[dirIdleKey].length > 0) {
                                animKey = dirIdleKey;
                            } else {
                                animKey = 'idle';
                            }
                        }

                        let frames = charAnims[animKey];
                        if (!frames || frames.length === 0) frames = charAnims.walkDown || [];
                        if ((!frames || frames.length === 0) && dir === 'left') {
                            frames = charAnims.walkRight || [];
                            flipX = true;
                        }

                        if (frames && frames.length > 0) {
                            const f = frames[frame % frames.length];
                            srcX = f.x;
                            srcY = f.y;
                            srcW = f.w;
                            srcH = f.h;
                        }

                        if (charMirrors[animKey]) flipX = !flipX;
                        if (dir === 'left' && (!charAnims.walkLeft || charAnims.walkLeft.length === 0)) {
                            flipX = true;
                        }
                    } else {
                        // Legacy frame layout
                        let row = 0, col = 0;
                        const ldir = cardinalOf(dir); // legacy 4-key tables have no diagonals; collapse to avoid undefined lookup
                        flipX = ldir === 'left';

                        if (gPlayer.animation === 'walk') {
                            const walk = walkFrames[ldir];
                            row = walk.row;
                            col = walk.cols[frame % walk.cols.length];
                        } else {
                            row = 0;
                            col = idleFrames[ldir][frame % idleFrames[ldir].length];
                        }

                        srcX = col * charFrameW;
                        srcY = row * charFrameH;
                    }

                    if (activeSprite) {
                        // Draw shadow
                        mapCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                        mapCtx.beginPath();
                        mapCtx.ellipse(px, py + drawSize * 0.4, drawSize * 0.3, drawSize * 0.1, 0, 0, Math.PI * 2);
                        mapCtx.fill();

                        // Draw sprite
                        mapCtx.save();
                        if (flipX) {
                            mapCtx.translate(px + drawSize / 2, py - drawSize / 2);
                            mapCtx.scale(-1, 1);
                            mapCtx.drawImage(activeSprite,
                                srcX, srcY, srcW, srcH,
                                0, 0, drawSize, drawSize);
                        } else {
                            mapCtx.drawImage(activeSprite,
                                srcX, srcY, srcW, srcH,
                                px - drawSize / 2, py - drawSize / 2, drawSize, drawSize);
                        }
                        mapCtx.restore();
                    } else {
                        // Fallback: simple colored circle with direction indicator
                        mapCtx.fillStyle = 'rgba(0, 255, 255, 0.8)';
                        mapCtx.beginPath();
                        mapCtx.arc(px, py, 12 * zoom, 0, Math.PI * 2);
                        mapCtx.fill();
                        mapCtx.fillStyle = '#000';
                        mapCtx.font = '8px monospace';
                        mapCtx.textAlign = 'center';
                        mapCtx.fillText(dir[0], px, py + 3);
                    }

                    // Draw name above player
                    mapCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    mapCtx.font = 'bold ' + (10 * zoom) + 'px monospace';
                    mapCtx.textAlign = 'center';
                    mapCtx.textBaseline = 'bottom';
                    const nameWidth = mapCtx.measureText(gPlayer.name).width + 8;
                    mapCtx.fillRect(px - nameWidth / 2, py - drawSize / 2 - 16 * zoom, nameWidth, 14 * zoom);
                    mapCtx.fillStyle = '#0ff';
                    mapCtx.fillText(gPlayer.name, px, py - drawSize / 2 - 4 * zoom);
                });
            }

            // === DEBUG: Show click coords ===
            if (window.debugClickPos) {
                const dx = window.debugClickPos.x * zoom;
                const dy = window.debugClickPos.y * zoom;
                mapCtx.fillStyle = '#f0f';
                mapCtx.beginPath();
                mapCtx.arc(dx, dy, 8 * zoom, 0, Math.PI * 2);
                mapCtx.fill();
                mapCtx.fillStyle = '#fff';
                mapCtx.font = 'bold 12px monospace';
                mapCtx.textAlign = 'left';
                mapCtx.fillText('DEBUG: ' + window.debugClickPos.x + ',' + window.debugClickPos.y, dx + 10, dy);
            }

            // Update expand button positions after canvas resize
            positionExpandButtons();
        }

        // Zoom
        function updateZoomDisplay() {
            document.getElementById('zoomLevel').textContent = zoom + 'x';
            const toolbarZoom = document.getElementById('zoomLevelToolbar');
            if (toolbarZoom) toolbarZoom.textContent = zoom + 'x';
        }
        function zoomIn() { if (zoom < 4) { zoom++; updateZoomDisplay(); renderMap(); } }
        function zoomOut() { if (zoom > 1) { zoom--; updateZoomDisplay(); renderMap(); } }

        // Only zoom with scroll when grab tool is active
        document.getElementById('mapViewport').addEventListener('wheel', (e) => {
            if (grabToolActive) {
                e.preventDefault();
                if (e.deltaY < 0) zoomIn(); else zoomOut();
            }
        });

        function clearMap() { if (confirm('Clear entire map?')) { initMap(); mapInitialized = true; broadcastEdit({ editType: 'clearMap', mapName: currentMapName }); renderMap(); } }

        // ===== GRAB TOOL =====
        let grabToolActive = false;
        let grabbing = false;
        let grabStartX = 0;
        let grabStartY = 0;
        let grabScrollX = 0;
        let grabScrollY = 0;

        // Tools menu toggle
        function toggleToolsMenu() {
            const menu = document.getElementById('toolsMenu');
            menu.classList.toggle('open');
        }

        // UI Theme changer
        function setUITheme(color) {
            // Apply to panel and toolbar
            document.querySelectorAll('.panel').forEach(el => el.style.background = color);
            document.querySelectorAll('.toolbar').forEach(el => el.style.background = color);
            document.querySelectorAll('.tools-menu').forEach(el => el.style.background = color);

            // Update active swatch indicator
            document.querySelectorAll('.theme-swatch').forEach(el => {
                el.classList.toggle('active', el.style.background === color);
            });

            // Update color picker
            const picker = document.getElementById('customThemeColor');
            if (picker) picker.value = color;

            // Save to localStorage
            localStorage.setItem('builderUITheme', color);
        }

        // Load saved theme on startup
        (function loadSavedTheme() {
            const saved = localStorage.getItem('builderUITheme');
            if (saved) {
                setTimeout(() => setUITheme(saved), 100);
            }
        })();

        // Close tools menu when clicking outside
        document.addEventListener('click', function(e) {
            const dropdown = document.querySelector('.tools-dropdown');
            const menu = document.getElementById('toolsMenu');
            if (dropdown && menu && !dropdown.contains(e.target)) {
                menu.classList.remove('open');
            }
        });

        function toggleGrabTool() {
            grabToolActive = !grabToolActive;
            const btn = document.getElementById('grabToolBtn');
            const canvas = document.getElementById('mapCanvas');
            const hint = document.getElementById('toolHint');

            if (grabToolActive) {
                btn.classList.add('active');
                canvas.classList.add('grabbing');
                hint.textContent = 'Drag to pan | Scroll to zoom';
                // Clear selected tiles when grab tool is activated
                selectedTiles = [];
                document.getElementById('selectedInfo').textContent = 'No tile selected';
                document.getElementById('selectedInfo').style.color = '#888';
                document.getElementById('selectedCollisionInfo').textContent = 'Click tileset to select';
                const canvas = document.getElementById('selectedTile');
                if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            } else {
                btn.classList.remove('active');
                canvas.classList.remove('grabbing');
                hint.textContent = 'R:rotate | I:flip | E:erase';
            }
        }

        // Grab/pan handlers
        const mapViewport = document.getElementById('mapViewport');

        mapCanvas.addEventListener('mousedown', (e) => {
            if (grabToolActive && e.button === 0) {
                grabbing = true;
                grabStartX = e.clientX;
                grabStartY = e.clientY;
                grabScrollX = mapViewport.scrollLeft;
                grabScrollY = mapViewport.scrollTop;
                e.preventDefault();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (grabbing) {
                const dx = e.clientX - grabStartX;
                const dy = e.clientY - grabStartY;
                mapViewport.scrollLeft = grabScrollX - dx;
                mapViewport.scrollTop = grabScrollY - dy;
            }
        });

        document.addEventListener('mouseup', () => {
            grabbing = false;
        });

        // Touch support for grab tool (iPad/mobile)
        mapCanvas.addEventListener('touchstart', (e) => {
            if (grabToolActive && e.touches.length === 1) {
                grabbing = true;
                grabStartX = e.touches[0].clientX;
                grabStartY = e.touches[0].clientY;
                grabScrollX = mapViewport.scrollLeft;
                grabScrollY = mapViewport.scrollTop;
                e.preventDefault();
            }
        }, { passive: false });

        mapCanvas.addEventListener('touchmove', (e) => {
            if (grabbing && e.touches.length === 1) {
                const dx = e.touches[0].clientX - grabStartX;
                const dy = e.touches[0].clientY - grabStartY;
                mapViewport.scrollLeft = grabScrollX - dx;
                mapViewport.scrollTop = grabScrollY - dy;
                e.preventDefault();
            }
        }, { passive: false });

        mapCanvas.addEventListener('touchend', () => {
            grabbing = false;
        });

        mapCanvas.addEventListener('touchcancel', () => {
            grabbing = false;
        });

        // ===== EXPAND MAP =====
        function expandMap(direction, fromNetwork = false) {
            const expandAmount = 5; // Add 5 rows/cols at a time

            if (direction === 'right') {
                mapCols += expandAmount;
                layers.forEach(layer => {
                    for (let y = 0; y < layer.length; y++) {
                        for (let i = 0; i < expandAmount; i++) {
                            layer[y].push(null);
                        }
                    }
                });
            } else if (direction === 'left') {
                mapCols += expandAmount;
                layers.forEach(layer => {
                    for (let y = 0; y < layer.length; y++) {
                        for (let i = 0; i < expandAmount; i++) {
                            layer[y].unshift(null);
                        }
                    }
                });
                // Shift placed animated props
                placedAnimProps.forEach(ap => { if (!ap.mapName || ap.mapName === currentMapName) ap.x += expandAmount; });
                // Shift placed props
                placedProps.forEach(prop => { if (!prop.mapName || prop.mapName === currentMapName) prop.x += expandAmount; });
                // Shift placed NPCs
                placedNpcs.forEach(npc => { if (!npc.mapName || npc.mapName === currentMapName) { npc.x += expandAmount; if (npc.path) npc.path.forEach(wp => wp.x += expandAmount); } });
                // Shift placed items
                placedItems.forEach(item => { if (!item.mapName || item.mapName === currentMapName) item.x += expandAmount; });
                // Shift placed triggers
                placedTriggers.forEach(t => { if (!t.mapName || t.mapName === currentMapName) { t.x += expandAmount; if (t.targetMap === currentMapName) t.targetX += expandAmount; } });
            } else if (direction === 'bottom') {
                mapRows += expandAmount;
                layers.forEach(layer => {
                    for (let i = 0; i < expandAmount; i++) {
                        const newRow = [];
                        for (let x = 0; x < mapCols; x++) newRow.push(null);
                        layer.push(newRow);
                    }
                });
            } else if (direction === 'top') {
                mapRows += expandAmount;
                layers.forEach(layer => {
                    for (let i = 0; i < expandAmount; i++) {
                        const newRow = [];
                        for (let x = 0; x < mapCols; x++) newRow.push(null);
                        layer.unshift(newRow);
                    }
                });
                // Shift placed animated props
                placedAnimProps.forEach(ap => { if (!ap.mapName || ap.mapName === currentMapName) ap.y += expandAmount; });
                // Shift placed props
                placedProps.forEach(prop => { if (!prop.mapName || prop.mapName === currentMapName) prop.y += expandAmount; });
                // Shift placed NPCs
                placedNpcs.forEach(npc => { if (!npc.mapName || npc.mapName === currentMapName) { npc.y += expandAmount; if (npc.path) npc.path.forEach(wp => wp.y += expandAmount); } });
                // Shift placed items
                placedItems.forEach(item => { if (!item.mapName || item.mapName === currentMapName) item.y += expandAmount; });
                // Shift placed triggers
                placedTriggers.forEach(t => { if (!t.mapName || t.mapName === currentMapName) { t.y += expandAmount; if (t.targetMap === currentMapName) t.targetY += expandAmount; } });
            }

            if (!fromNetwork) {
                broadcastEdit({ editType: 'expandMap', direction: direction, mapName: currentMapName });
            }
            renderMap();
        }

        // Position expand buttons at map edges
        function positionExpandButtons() {
            const canvas = document.getElementById('mapCanvas');
            const viewport = document.getElementById('mapViewport');
            if (!canvas || !viewport) return;

            const padding = 40; // viewport padding
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;

            const topBtn = document.querySelector('.expand-top');
            const bottomBtn = document.querySelector('.expand-bottom');
            const leftBtn = document.querySelector('.expand-left');
            const rightBtn = document.querySelector('.expand-right');

            if (topBtn) {
                topBtn.style.left = (padding + canvasWidth / 2 - 30) + 'px';
            }
            if (bottomBtn) {
                bottomBtn.style.left = (padding + canvasWidth / 2 - 30) + 'px';
                bottomBtn.style.top = (padding + canvasHeight + 5) + 'px';
            }
            if (leftBtn) {
                leftBtn.style.top = (padding + canvasHeight / 2 - 30) + 'px';
            }
            if (rightBtn) {
                rightBtn.style.left = (padding + canvasWidth + 5) + 'px';
                rightBtn.style.top = (padding + canvasHeight / 2 - 30) + 'px';
            }
        }

        // ===== MULTIPLE PROPS SYSTEM =====
        // Props work just like tilesets - load images, select area, paint on map
        // Each prop has its own collision masks

        function loadPropImage(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Save current prop's collision masks before switching
                    if (currentPropIndex >= 0 && props[currentPropIndex]) {
                        props[currentPropIndex].collisionMasks = { ...propCollisionMasks };
                    }

                    // Add new prop to array
                    const newProp = {
                        name: file.name,
                        img: img,
                        data: e.target.result,
                        collisionMasks: {}
                    };
                    props.push(newProp);
                    currentPropIndex = props.length - 1;

                    // Set current prop shortcuts
                    propImage = img;
                    propImageData = e.target.result;
                    propCollisionMasks = newProp.collisionMasks;
                    propSelection = null;

                    updatePropDropdown();
                    updatePropUI();
                    drawPropTileset();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        }

        function switchProp() {
            const select = document.getElementById('propSelect');
            const newIndex = parseInt(select.value);

            // Save current prop's collision masks
            if (currentPropIndex >= 0 && props[currentPropIndex]) {
                props[currentPropIndex].collisionMasks = { ...propCollisionMasks };
            }

            // Switch to new prop
            currentPropIndex = newIndex;
            if (currentPropIndex >= 0 && props[currentPropIndex]) {
                propImage = props[currentPropIndex].img;
                propImageData = props[currentPropIndex].data;
                propCollisionMasks = props[currentPropIndex].collisionMasks || {};
            } else {
                propImage = null;
                propImageData = null;
                propCollisionMasks = {};
            }

            propSelection = null;
            updatePropUI();
            drawPropTileset();
            renderMap();
        }

        function updatePropDropdown() {
            const select = document.getElementById('propSelect');
            if (!select) return;
            select.innerHTML = '';

            if (props.length === 0) {
                const opt = document.createElement('option');
                opt.value = -1;
                opt.textContent = 'No props loaded';
                select.appendChild(opt);
            } else {
                props.forEach((prop, i) => {
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.textContent = prop.name;
                    if (i === currentPropIndex) opt.selected = true;
                    select.appendChild(opt);
                });
            }
        }

        function updatePropUI() {
            const propControls = document.getElementById('propControls');
            const noPropMessage = document.getElementById('noPropMessage');
            if (!propControls || !noPropMessage) return;
            const hasProps = props.length > 0 && currentPropIndex >= 0;
            propControls.style.display = hasProps ? 'block' : 'none';
            noPropMessage.style.display = hasProps ? 'none' : 'block';
        }

        function drawPropTileset() {
            if (!propTilesetCanvas || !propTilesetCtx) return;
            if (!propImage) {
                propTilesetCanvas.width = 200;
                propTilesetCanvas.height = 50;
                propTilesetCtx.fillStyle = '#333';
                propTilesetCtx.fillRect(0, 0, 200, 50);
                propTilesetCtx.fillStyle = '#888';
                propTilesetCtx.font = '12px sans-serif';
                propTilesetCtx.fillText('Load a prop image...', 20, 30);
                return;
            }

            const displayZoom = 3; // Larger zoom for easier collision painting
            propTilesetCanvas.width = propImage.naturalWidth * displayZoom;
            propTilesetCanvas.height = propImage.naturalHeight * displayZoom;

            propTilesetCtx.imageSmoothingEnabled = false;
            propTilesetCtx.drawImage(propImage, 0, 0, propTilesetCanvas.width, propTilesetCanvas.height);

            // Draw collision overlay (red pixels where collision is set)
            if (propTool === 'collision' || propTool === 'erase') {
                const cols = Math.floor(propImage.naturalWidth / gridSize);
                const rows = Math.floor(propImage.naturalHeight / gridSize);

                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        const tileX = col * gridSize;
                        const tileY = row * gridSize;
                        const key = tileX + ',' + tileY;
                        const mask = propCollisionMasks[key];

                        if (mask) {
                            for (let py = 0; py < gridSize; py++) {
                                for (let px = 0; px < gridSize; px++) {
                                    if (mask[py] && mask[py][px]) {
                                        propTilesetCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                                        propTilesetCtx.fillRect(
                                            (tileX + px) * displayZoom,
                                            (tileY + py) * displayZoom,
                                            displayZoom,
                                            displayZoom
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Grid
            propTilesetCtx.strokeStyle = 'rgba(255,255,255,0.2)';
            const cols = Math.floor(propImage.naturalWidth / gridSize);
            const rows = Math.floor(propImage.naturalHeight / gridSize);

            for (let x = 0; x <= cols; x++) {
                propTilesetCtx.beginPath();
                propTilesetCtx.moveTo(x * gridSize * displayZoom, 0);
                propTilesetCtx.lineTo(x * gridSize * displayZoom, propTilesetCanvas.height);
                propTilesetCtx.stroke();
            }
            for (let y = 0; y <= rows; y++) {
                propTilesetCtx.beginPath();
                propTilesetCtx.moveTo(0, y * gridSize * displayZoom);
                propTilesetCtx.lineTo(propTilesetCanvas.width, y * gridSize * displayZoom);
                propTilesetCtx.stroke();
            }

            // Highlight selection (only in select mode)
            if (propSelection && propTool === 'select') {
                propTilesetCtx.fillStyle = 'rgba(74, 175, 255, 0.4)';
                propTilesetCtx.strokeStyle = '#4af';
                propTilesetCtx.lineWidth = 2;
                propTilesetCtx.fillRect(
                    propSelection.x * displayZoom,
                    propSelection.y * displayZoom,
                    propSelection.width * displayZoom,
                    propSelection.height * displayZoom
                );
                propTilesetCtx.strokeRect(
                    propSelection.x * displayZoom,
                    propSelection.y * displayZoom,
                    propSelection.width * displayZoom,
                    propSelection.height * displayZoom
                );
            }
        }

        // Prop tileset selection and collision painting
        let propSelectionStart = null;

        function paintPropCollisionAt(canvasX, canvasY, isErasing) {
            const displayZoom = 3;
            const imgX = Math.floor(canvasX / displayZoom);
            const imgY = Math.floor(canvasY / displayZoom);

            // Find which tile this pixel belongs to
            const tileCol = Math.floor(imgX / gridSize);
            const tileRow = Math.floor(imgY / gridSize);
            const tileX = tileCol * gridSize;
            const tileY = tileRow * gridSize;
            const key = tileX + ',' + tileY;

            // Initialize mask if needed
            if (!propCollisionMasks[key]) {
                propCollisionMasks[key] = [];
                for (let y = 0; y < gridSize; y++) {
                    propCollisionMasks[key][y] = new Array(gridSize).fill(false);
                }
            }

            // Paint with brush
            const halfBrush = Math.floor(propBrushSize / 2);
            for (let dy = -halfBrush; dy < halfBrush; dy++) {
                for (let dx = -halfBrush; dx < halfBrush; dx++) {
                    const px = imgX + dx;
                    const py = imgY + dy;

                    // Get the tile for this pixel
                    const ptileCol = Math.floor(px / gridSize);
                    const ptileRow = Math.floor(py / gridSize);
                    const ptileX = ptileCol * gridSize;
                    const ptileY = ptileRow * gridSize;
                    const pkey = ptileX + ',' + ptileY;

                    // Local coords within tile
                    const localX = px - ptileX;
                    const localY = py - ptileY;

                    if (localX >= 0 && localX < gridSize && localY >= 0 && localY < gridSize) {
                        if (!propCollisionMasks[pkey]) {
                            propCollisionMasks[pkey] = [];
                            for (let y = 0; y < gridSize; y++) {
                                propCollisionMasks[pkey][y] = new Array(gridSize).fill(false);
                            }
                        }
                        propCollisionMasks[pkey][localY][localX] = !isErasing;
                    }
                }
            }

            drawPropTileset();
        }

        if (propTilesetCanvas) propTilesetCanvas.addEventListener('mousedown', (e) => {
            if (!propImage) return;
            const rect = propTilesetCanvas.getBoundingClientRect();
            const displayZoom = 3;

            if (propTool === 'select') {
                // Tile selection mode
                const x = Math.floor((e.clientX - rect.left) / displayZoom / gridSize) * gridSize;
                const y = Math.floor((e.clientY - rect.top) / displayZoom / gridSize) * gridSize;
                propSelectionStart = { x, y };
            } else {
                // Collision painting mode
                propPainting = true;
                const canvasX = e.clientX - rect.left;
                const canvasY = e.clientY - rect.top;
                paintPropCollisionAt(canvasX, canvasY, propTool === 'erase');
            }
        });

        if (propTilesetCanvas) propTilesetCanvas.addEventListener('mousemove', (e) => {
            if (!propImage || !propPainting) return;
            if (propTool === 'collision' || propTool === 'erase') {
                const rect = propTilesetCanvas.getBoundingClientRect();
                const canvasX = e.clientX - rect.left;
                const canvasY = e.clientY - rect.top;
                paintPropCollisionAt(canvasX, canvasY, propTool === 'erase');
            }
        });

        if (propTilesetCanvas) propTilesetCanvas.addEventListener('mouseup', (e) => {
            if (!propImage) return;

            if (propTool === 'select' && propSelectionStart) {
                const rect = propTilesetCanvas.getBoundingClientRect();
                const displayZoom = 3;
                const x = Math.floor((e.clientX - rect.left) / displayZoom / gridSize) * gridSize;
                const y = Math.floor((e.clientY - rect.top) / displayZoom / gridSize) * gridSize;

                const minX = Math.min(propSelectionStart.x, x);
                const minY = Math.min(propSelectionStart.y, y);
                const maxX = Math.max(propSelectionStart.x, x) + gridSize;
                const maxY = Math.max(propSelectionStart.y, y) + gridSize;

                propSelection = {
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY
                };

                // When in prop mode, set this as the selected tile data for painting
                if (mode === 'prop') {
                    selectedTileData = {
                        x: minX,
                        y: minY,
                        width: (maxX - minX) / gridSize,
                        height: (maxY - minY) / gridSize,
                        isProp: true // Flag to indicate this is from prop image
                    };
                }

                propSelectionStart = null;
                drawPropTileset();
            }

            propPainting = false;
        });

        if (propTilesetCanvas) propTilesetCanvas.addEventListener('mouseleave', () => {
            propPainting = false;
        });

        if (propTilesetCanvas) propTilesetCanvas.style.cursor = 'crosshair';

        // Expand map size
        function expandMapRows(fromNetwork = false) {
            mapRows += 10;
            layers.forEach(layer => {
                while (layer.length < mapRows) {
                    layer.push(new Array(mapCols).fill(null));
                }
            });
            // Wave 3: broadcast auto-expand so peers don't drift out of bounds.
            if (!fromNetwork) broadcastEdit({ editType: 'expandMap', direction: 'bottom', mapName: currentMapName, amount: 10 });
        }

        function expandMapCols(fromNetwork = false) {
            mapCols += 10;
            layers.forEach(layer => {
                layer.forEach((row, i) => {
                    if (row) {
                        while (row.length < mapCols) row.push(null);
                    }
                });
            });
            if (!fromNetwork) broadcastEdit({ editType: 'expandMap', direction: 'right', mapName: currentMapName, amount: 10 });
        }

        // ===== NPC FUNCTIONS =====
        let npcCurrentAnim = 'walkDown'; // Currently selected animation type
        let npcAnimations = {}; // { walkDown: [], walkUp: [], walkLeft: [], walkRight: [], idle: [], attackDown: [], ... }
        let npcAnimMirrors = {}; // { walkLeft: true } - animations to render flipped horizontally

        function openNpcEditor(editIndex = -1) {
            // Check if someone else is already editing this NPC
            if (editIndex >= 0 && isBeingEdited('npc', editIndex)) {
                const editor = getEditor('npc', editIndex);
                if (!confirm(`"${editor}" is currently editing this NPC.\n\nEditing simultaneously may cause conflicts.\n\nOpen anyway?`)) {
                    return;
                }
            }

            npcStopPreview();
            npcEditorEditingIndex = editIndex;

            // Broadcast that we're editing this NPC
            if (editIndex >= 0) {
                startEditing('npc', editIndex);
            }

            npcCurrentAnim = 'walkDown';
            npcAnimations = { walkDown: [], walkUp: [], walkLeft: [], walkRight: [], idle: [], attackDown: [], attackUp: [], attackLeft: [], attackRight: [], walkDownLeft: [], walkDownRight: [], walkUpLeft: [], walkUpRight: [] };
            npcAnimMirrors = {}; // Reset mirror flags
            // Reset collision tool to Select mode
            npcTool = 'none';
            npcPainting = false;
            setNpcTool('none');

            if (editIndex >= 0 && npcs[editIndex]) {
                // Editing existing NPC
                const npc = npcs[editIndex];
                npcEditorFrameW = npc.frameWidth || 32;
                npcEditorFrameH = npc.frameHeight || 32;
                npcEditorData = npc.spriteData;
                document.getElementById('npcNameInput').value = npc.name;
                const fps = npc.fps || 8;
                document.getElementById('npcSpeedSlider').value = fps;
                document.getElementById('npcSpeedLabel').textContent = fps + ' fps';

                // Load animations
                if (npc.animations) {
                    npcAnimations = JSON.parse(JSON.stringify(npc.animations));
                }
                // Load mirror flags
                if (npc.animMirrors) {
                    npcAnimMirrors = JSON.parse(JSON.stringify(npc.animMirrors));
                }
                // Load ping-pong setting
                npcPingPong = npc.pingPong || false;
                document.getElementById('npcPingPong').checked = npcPingPong;

                // Load collision mask and split line
                npcSplitLine = npc.splitLine ?? null;

                if (npc.spriteData) {
                    npcEditorImage = new Image();
                    npcEditorImage.onload = () => {
                        document.getElementById('npcFrameSection').style.display = 'block';
                        document.getElementById('npcAnimSection').style.display = 'block';
                        document.getElementById('npcNameSection').style.display = 'block';
                        document.getElementById('npcCollisionSection').style.display = 'block';
                        document.getElementById('npcShadowSection').style.display = 'block';
                        // Load shadow settings from NPC
                        const shadowOffsetX = npc.shadowOffsetX ?? 0;
                        const shadowOffset = npc.shadowOffsetY ?? 4;
                        const shadowWidth = Math.round((npc.shadowWidth ?? 0.35) * 100);
                        const shadowHeight = Math.round((npc.shadowHeight ?? 0.12) * 100);
                        document.getElementById('npcShadowOffsetXSlider').value = shadowOffsetX;
                        document.getElementById('npcShadowOffsetXVal').textContent = shadowOffsetX;
                        document.getElementById('npcShadowOffsetSlider').value = shadowOffset;
                        document.getElementById('npcShadowOffsetVal').textContent = shadowOffset;
                        document.getElementById('npcShadowWidthSlider').value = shadowWidth;
                        document.getElementById('npcShadowWidthVal').textContent = shadowWidth;
                        document.getElementById('npcShadowHeightSlider').value = shadowHeight;
                        document.getElementById('npcShadowHeightVal').textContent = shadowHeight;
                        // Load noShadow setting
                        document.getElementById('npcNoShadow').checked = npc.noShadow || false;
                        document.getElementById('npcShadowControls').style.display = npc.noShadow ? 'none' : 'block';
                        // Load collision insets (or migrate from old formats)
                        if (npc.collisionInsets) {
                            npcCollisionInsets = { ...npc.collisionInsets };
                        } else if (npc.collisionBox) {
                            // Migrate old collisionBox to insets
                            const frameW = npc.frameWidth || 32;
                            const frameH = npc.frameHeight || 32;
                            npcCollisionInsets = {
                                top: npc.collisionBox.y || 0,
                                bottom: frameH - (npc.collisionBox.y || 0) - (npc.collisionBox.height || frameH),
                                left: npc.collisionBox.x || 0,
                                right: frameW - (npc.collisionBox.x || 0) - (npc.collisionBox.width || frameW)
                            };
                        } else {
                            npcCollisionInsets = null;
                        }
                        // Update collision status display
                        const status = document.getElementById('npcCollisionStatus');
                        const ins = npcCollisionInsets;
                        if (ins && (ins.top > 0 || ins.bottom > 0 || ins.left > 0 || ins.right > 0)) {
                            const boxW = (npc.frameWidth || 32) - ins.left - ins.right;
                            const boxH = (npc.frameHeight || 32) - ins.top - ins.bottom;
                            status.textContent = `Box: ${boxW}x${boxH}px`;
                            status.style.color = '#0ff';
                        } else {
                            status.textContent = 'Full sprite';
                            status.style.color = '#888';
                        }
                        npcUpdateGrid();
                        npcDrawCanvas();
                        npcUpdateFramesList();
                        npcStartPreview();
                    };
                    npcEditorImage.src = npc.spriteData;
                    document.getElementById('npcFileName').textContent = 'Sprite loaded';
                }
            } else {
                // New NPC
                npcEditorImage = null;
                npcEditorData = null;
                npcEditorFrameW = 32;
                npcEditorFrameH = 32;
                npcCollisionBox = null;
                // Reset collision status display
                const status = document.getElementById('npcCollisionStatus');
                if (status) {
                    status.textContent = 'No collision box set';
                    status.style.color = '#888';
                }
                document.getElementById('npcNameInput').value = '';
                document.getElementById('npcSpeedSlider').value = 8;
                document.getElementById('npcSpeedLabel').textContent = '8 fps';
                npcPingPong = false;
                document.getElementById('npcPingPong').checked = false;
                document.getElementById('npcFileName').textContent = '';
                document.getElementById('npcFrameSection').style.display = 'none';
                document.getElementById('npcAnimSection').style.display = 'none';
                document.getElementById('npcNameSection').style.display = 'none';
                document.getElementById('npcCollisionSection').style.display = 'none';
                document.getElementById('npcShadowSection').style.display = 'none';
                // Reset shadow sliders to defaults
                document.getElementById('npcShadowOffsetXSlider').value = 0;
                document.getElementById('npcShadowOffsetXVal').textContent = '0';
                document.getElementById('npcShadowOffsetSlider').value = 4;
                document.getElementById('npcShadowOffsetVal').textContent = '4';
                document.getElementById('npcShadowWidthSlider').value = 35;
                document.getElementById('npcShadowWidthVal').textContent = '35';
                document.getElementById('npcShadowHeightSlider').value = 12;
                document.getElementById('npcShadowHeightVal').textContent = '12';
                document.getElementById('npcNoShadow').checked = false;
                document.getElementById('npcShadowControls').style.display = 'block';
                document.getElementById('npcPreviewScale').value = 1;
                document.getElementById('npcPreviewScaleLabel').textContent = '1x';
                // Clear canvases
                const previewCtx = document.getElementById('npcLivePreview').getContext('2d');
                previewCtx.clearRect(0, 0, 96, 96);
                const editorCanvas = document.getElementById('npcEditorCanvas');
                const editorCtx = editorCanvas.getContext('2d');
                editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
                const framesList = document.getElementById('npcFramesList');
                if (framesList) framesList.innerHTML = '';
                const fileInput = document.getElementById('npcFileInput');
                if (fileInput) fileInput.value = '';
            }

            npcSelectAnim('walkDown');
            document.getElementById('npcModal').classList.add('visible');
        }

        function npcLoadSheet(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                npcEditorData = e.target.result;
                npcEditorImage = new Image();
                npcEditorImage.onload = () => {
                    document.getElementById('npcFileName').textContent = file.name + ' (' + npcEditorImage.naturalWidth + 'x' + npcEditorImage.naturalHeight + ')';
                    document.getElementById('npcFrameSection').style.display = 'block';
                    document.getElementById('npcAnimSection').style.display = 'block';
                    document.getElementById('npcNameSection').style.display = 'block';
                    document.getElementById('npcCollisionSection').style.display = 'block';
                    document.getElementById('npcShadowSection').style.display = 'block';
                    // Initialize collision mask for new image
                    const w = npcEditorImage.naturalWidth;
                    const h = npcEditorImage.naturalHeight;
                    npcCollisionMask = Array(h).fill(null).map(() => Array(w).fill(0));
                    npcSplitLine = null;
                    npcUpdateGrid();
                    npcDrawCanvas();
                };
                npcEditorImage.src = npcEditorData;
            };
            reader.readAsDataURL(file);
        }

        function npcSetFrameSize(w, h) {
            npcEditorFrameW = w;
            npcEditorFrameH = h;
            // Sync input fields
            const wInput = document.getElementById('npcFrameW');
            const hInput = document.getElementById('npcFrameH');
            if (wInput) wInput.value = w;
            if (hInput) hInput.value = h;
            npcUpdateGrid();
            npcDrawCanvas();
        }

        function npcSetFrameSizeFromInput() {
            const w = parseInt(document.getElementById('npcFrameW').value) || 16;
            const h = parseInt(document.getElementById('npcFrameH').value) || 16;
            npcEditorFrameW = Math.max(8, Math.min(256, w));
            npcEditorFrameH = Math.max(8, Math.min(256, h));
            // Sync back in case of clamping
            document.getElementById('npcFrameW').value = npcEditorFrameW;
            document.getElementById('npcFrameH').value = npcEditorFrameH;
            npcUpdateGrid();
            npcDrawCanvas();
        }

        function npcResetGrid() {
            npcEditorFrameW = 32;
            npcEditorFrameH = 32;
            // Sync input fields
            const wInput = document.getElementById('npcFrameW');
            const hInput = document.getElementById('npcFrameH');
            if (wInput) wInput.value = 32;
            if (hInput) hInput.value = 32;
            npcUpdateGrid();
            npcDrawCanvas();
        }

        function npcUpdateGrid() {
            if (npcEditorImage) {
                const cols = Math.floor(npcEditorImage.naturalWidth / npcEditorFrameW);
                const rows = Math.floor(npcEditorImage.naturalHeight / npcEditorFrameH);
                document.getElementById('npcGridInfo').textContent = cols + ' cols x ' + rows + ' rows (' + npcEditorFrameW + 'x' + npcEditorFrameH + ')';
            }
            npcDrawCanvas();
        }

        function npcSelectAnim(animName) {
            npcCurrentAnim = animName;
            if (!npcAnimations[animName]) npcAnimations[animName] = []; // ensure slot exists (new diagonal slots etc.)
            // Update all button states and show frame counts
            npcUpdateAnimButtons();
            // Update display
            const names = { walkDown: 'Walk Down', walkUp: 'Walk Up', walkLeft: 'Walk Left', walkRight: 'Walk Right', idle: 'Idle', attackDown: 'Attack Down', attackUp: 'Attack Up', attackLeft: 'Attack Left', attackRight: 'Attack Right', walkDownLeft: 'Walk ↙', walkDownRight: 'Walk ↘', walkUpLeft: 'Walk ↖', walkUpRight: 'Walk ↗' };
            document.getElementById('npcCurrentAnimName').textContent = names[animName] || animName;
            // Update mirror button state
            npcUpdateMirrorButton();
            npcDrawCanvas();
            npcUpdateFramesList();
            npcStartPreview();
        }

        function npcToggleMirror() {
            npcAnimMirrors[npcCurrentAnim] = !npcAnimMirrors[npcCurrentAnim];
            npcUpdateMirrorButton();
            npcStartPreview(); // Restart preview with new mirror state
        }

        function npcUpdateMirrorButton() {
            const btn = document.getElementById('npcMirrorBtn');
            if (npcAnimMirrors[npcCurrentAnim]) {
                btn.style.background = '#48f';
                btn.style.color = '#000';
                btn.style.borderColor = '#48f';
                btn.textContent = 'Mirrored';
            } else {
                btn.style.background = '#555';
                btn.style.color = '#fff';
                btn.style.borderColor = '#888';
                btn.textContent = 'Mirror';
            }
        }

        function npcUpdateAnimButtons() {
            const animMap = {
                'Down': 'walkDown',
                'Up': 'walkUp',
                'Left': 'walkLeft',
                'Right': 'walkRight',
                'Idle': 'idle',
                'DownLeft': 'walkDownLeft',
                'DownRight': 'walkDownRight',
                'UpLeft': 'walkUpLeft',
                'UpRight': 'walkUpRight',
                'AttackDown': 'attackDown',
                'AttackUp': 'attackUp',
                'AttackLeft': 'attackLeft',
                'AttackRight': 'attackRight'
            };
            const labels = {
                'Down': '↓ Walk',
                'Up': '↑ Walk',
                'Left': '← Walk',
                'Right': '→ Walk',
                'Idle': 'Idle',
                'DownLeft': '↙ Walk',
                'DownRight': '↘ Walk',
                'UpLeft': '↖ Walk',
                'UpRight': '↗ Walk',
                'AttackDown': '↓ Atk',
                'AttackUp': '↑ Atk',
                'AttackLeft': '← Atk',
                'AttackRight': '→ Atk'
            };
            const attackAnims = ['AttackDown', 'AttackUp', 'AttackLeft', 'AttackRight'];

            for (const [dir, animKey] of Object.entries(animMap)) {
                const btn = document.getElementById('npcAnim' + dir);
                if (btn) {
                    const frames = npcAnimations[animKey] || [];
                    const isActive = npcCurrentAnim === animKey;
                    const isAttack = attackAnims.includes(dir);
                    btn.classList.toggle('active', isActive);

                    // Show frame count and checkmark if has frames
                    if (frames.length > 0) {
                        btn.innerHTML = `✓ ${labels[dir]} <span style="color:#4f4;">(${frames.length})</span>`;
                        btn.style.background = isActive ? (isAttack ? '#844' : '#2a5a2a') : (isAttack ? '#633' : '#1a3a1a');
                    } else {
                        btn.innerHTML = labels[dir];
                        btn.style.background = isActive ? (isAttack ? '#955' : '#555') : (isAttack ? '#744' : '#333');
                    }
                }
            }
            // Update custom animations list
            npcUpdateCustomAnimList();
        }

        function npcAddCustomAnim() {
            const input = document.getElementById('npcCustomAnimName');
            const name = input.value.trim().toLowerCase().replace(/\s+/g, '_');
            if (!name) return;

            // Don't allow duplicates or reserved names
            const reserved = ['walkdown', 'walkup', 'walkleft', 'walkright', 'walkdownleft', 'walkdownright', 'walkupleft', 'walkupright', 'idle'];
            if (reserved.includes(name) || npcAnimations[name]) {
                alert('Animation "' + name + '" already exists');
                return;
            }

            // Create the new animation category
            npcAnimations[name] = [];
            input.value = '';

            // Select the new animation
            npcSelectAnim(name);
        }

        function npcUpdateCustomAnimList() {
            const container = document.getElementById('npcCustomAnimList');
            if (!container) return;

            // Get custom animations (not the default ones)
            const defaultAnims = ['walkDown', 'walkUp', 'walkLeft', 'walkRight', 'idle', 'attackDown', 'attackUp', 'attackLeft', 'attackRight', 'walkDownLeft', 'walkDownRight', 'walkUpLeft', 'walkUpRight'];
            const customAnims = Object.keys(npcAnimations).filter(k => !defaultAnims.includes(k));

            if (customAnims.length === 0) {
                container.innerHTML = '';
                return;
            }

            let html = '<div style="font-size:10px; color:#888; margin-bottom:3px;">Custom:</div>';
            html += '<div style="display:flex; flex-direction:column; gap:3px;">';
            customAnims.forEach(name => {
                const frames = npcAnimations[name] || [];
                const isActive = npcCurrentAnim === name;
                const hasFrames = frames.length > 0;
                const bgColor = isActive ? (hasFrames ? '#2a5a2a' : '#555') : (hasFrames ? '#1a3a1a' : '#333');
                html += `<div style="display:flex; gap:3px;">`;
                html += `<button onclick="npcSelectAnim('${name}')" style="flex:1; padding:4px; font-size:10px; background:${bgColor};">`;
                html += hasFrames ? `✓ ${name} <span style="color:#4f4;">(${frames.length})</span>` : name;
                html += `</button>`;
                html += `<button onclick="npcRemoveCustomAnim('${name}')" style="padding:4px 6px; font-size:10px; background:#a33;" title="Remove">×</button>`;
                html += `</div>`;
            });
            html += '</div>';
            container.innerHTML = html;
        }

        function npcRemoveCustomAnim(name) {
            if (!npcAnimations[name]) return;
            if (npcAnimations[name].length > 0) {
                if (!confirm('Delete "' + name + '" animation with ' + npcAnimations[name].length + ' frames?')) return;
            }
            delete npcAnimations[name];
            if (npcCurrentAnim === name) {
                npcSelectAnim('walkDown');
            } else {
                npcUpdateCustomAnimList();
            }
        }

        function setNpcTool(tool) {
            npcTool = tool;
            // Collision tools removed - now using collision box editor modal
            // Just update cursor
            const canvas = document.getElementById('npcEditorCanvas');
            if (canvas) canvas.style.cursor = 'crosshair';
        }

        function setNpcBrushSize(size) {
            npcBrushSize = parseInt(size);
            document.getElementById('npcBrushSizeVal').textContent = npcBrushSize;
            npcDrawCanvas(); // Redraw to update preview
        }

        function setNpcBrushShape(shape) {
            npcBrushShape = shape;
            document.querySelectorAll('[id^="npcShape"]').forEach(b => b.classList.remove('active'));
            document.getElementById('npcShape' + shape.charAt(0).toUpperCase() + shape.slice(1)).classList.add('active');
            // Show/hide rectangle controls
            document.getElementById('npcRectControls').style.display = shape === 'rect' ? 'block' : 'none';
            // Hide size slider for rect (uses W/H instead)
            document.getElementById('npcBrushSizeSlider').parentElement.style.display = shape === 'rect' ? 'none' : 'block';
            npcDrawCanvas();
        }

        function setNpcBrushRectW(w) {
            npcBrushRectW = parseInt(w);
            document.getElementById('npcBrushRectWVal').textContent = npcBrushRectW;
            npcDrawCanvas();
        }

        function setNpcBrushRectH(h) {
            npcBrushRectH = parseInt(h);
            document.getElementById('npcBrushRectHVal').textContent = npcBrushRectH;
            npcDrawCanvas();
        }

        function npcPaintCollision(x, y, erase) {
            if (!npcCollisionMask || !npcEditorImage) return;

            const value = erase ? 0 : 1;

            if (npcBrushShape === 'square') {
                const halfBrush = Math.floor(npcBrushSize / 2);
                for (let dy = -halfBrush; dy < halfBrush; dy++) {
                    for (let dx = -halfBrush; dx < halfBrush; dx++) {
                        const px = x + dx;
                        const py = y + dy;
                        if (py >= 0 && py < npcCollisionMask.length && px >= 0 && px < npcCollisionMask[0].length) {
                            npcCollisionMask[py][px] = value;
                        }
                    }
                }
            } else if (npcBrushShape === 'circle') {
                const radius = npcBrushSize / 2;
                const radiusSq = radius * radius;
                for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
                    for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
                        if (dx * dx + dy * dy <= radiusSq) {
                            const px = x + dx;
                            const py = y + dy;
                            if (py >= 0 && py < npcCollisionMask.length && px >= 0 && px < npcCollisionMask[0].length) {
                                npcCollisionMask[py][px] = value;
                            }
                        }
                    }
                }
            } else if (npcBrushShape === 'rect') {
                const halfW = Math.floor(npcBrushRectW / 2);
                const halfH = Math.floor(npcBrushRectH / 2);
                for (let dy = -halfH; dy < halfH; dy++) {
                    for (let dx = -halfW; dx < halfW; dx++) {
                        const px = x + dx;
                        const py = y + dy;
                        if (py >= 0 && py < npcCollisionMask.length && px >= 0 && px < npcCollisionMask[0].length) {
                            npcCollisionMask[py][px] = value;
                        }
                    }
                }
            }
        }

        function npcPaintSplit(x, y) {
            if (!npcEditorImage) return;
            // Split line is a single Y value for the entire sprite
            npcSplitLine = Math.max(0, Math.min(npcEditorFrameH, y));
        }

        function npcZoomIn() {
            npcEditorZoom = Math.min(6, npcEditorZoom + 1);
            document.getElementById('npcZoomLevel').textContent = npcEditorZoom + 'x';
            npcDrawCanvas();
        }

        function npcZoomOut() {
            npcEditorZoom = Math.max(1, npcEditorZoom - 1);
            document.getElementById('npcZoomLevel').textContent = npcEditorZoom + 'x';
            npcDrawCanvas();
        }

        function npcDrawCanvas() {
            const canvas = document.getElementById('npcEditorCanvas');
            const ctx = canvas.getContext('2d');

            if (!npcEditorImage) {
                canvas.width = 400;
                canvas.height = 300;
                ctx.fillStyle = '#222';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#666';
                ctx.textAlign = 'center';
                ctx.font = '14px monospace';
                ctx.fillText('Load a sprite sheet to begin', canvas.width / 2, canvas.height / 2);
                return;
            }

            const scale = npcEditorZoom;
            canvas.width = npcEditorImage.naturalWidth * scale;
            canvas.height = npcEditorImage.naturalHeight * scale;

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(npcEditorImage, 0, 0, canvas.width, canvas.height);

            // Draw grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;

            const fw = npcEditorFrameW * scale;
            const fh = npcEditorFrameH * scale;

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

            // Highlight frames for current animation
            const currentFrames = npcAnimations[npcCurrentAnim] || [];
            currentFrames.forEach((frame, i) => {
                const sx = frame.x * scale;
                const sy = frame.y * scale;
                const sw = frame.w * scale;
                const sh = frame.h * scale;

                ctx.fillStyle = 'rgba(74, 170, 255, 0.3)';
                ctx.fillRect(sx, sy, sw, sh);
                ctx.strokeStyle = '#4af';
                ctx.lineWidth = 2;
                ctx.strokeRect(sx, sy, sw, sh);

                // Frame number
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'center';
                ctx.fillText((i + 1).toString(), sx + sw / 2, sy + sh / 2 + 5);
            });

            // Draw drag selection preview
            if (npcFrameDragging && npcFrameDragStart && npcFrameDragEnd) {
                const startGX = Math.min(npcFrameDragStart.gridX, npcFrameDragEnd.gridX);
                const startGY = Math.min(npcFrameDragStart.gridY, npcFrameDragEnd.gridY);
                const endGX = Math.max(npcFrameDragStart.gridX, npcFrameDragEnd.gridX);
                const endGY = Math.max(npcFrameDragStart.gridY, npcFrameDragEnd.gridY);

                const dragX = startGX * npcEditorFrameW * scale;
                const dragY = startGY * npcEditorFrameH * scale;
                const dragW = (endGX - startGX + 1) * npcEditorFrameW * scale;
                const dragH = (endGY - startGY + 1) * npcEditorFrameH * scale;

                ctx.fillStyle = 'rgba(255, 200, 0, 0.3)';
                ctx.fillRect(dragX, dragY, dragW, dragH);
                ctx.strokeStyle = '#fc0';
                ctx.lineWidth = 3;
                ctx.strokeRect(dragX, dragY, dragW, dragH);
            }

            // Draw collision mask overlay
            if (npcCollisionMask && (npcTool === 'collision' || npcTool === 'erase' || npcTool === 'split' || npcTool === 'none')) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.35)';
                for (let py = 0; py < npcCollisionMask.length; py++) {
                    for (let px = 0; px < npcCollisionMask[py].length; px++) {
                        if (npcCollisionMask[py][px] === 1) {
                            ctx.fillRect(px * scale, py * scale, scale, scale);
                        }
                    }
                }
            }

            // Draw brush preview
            if (npcBrushPreviewPos && (npcTool === 'collision' || npcTool === 'erase')) {
                const bx = npcBrushPreviewPos.x;
                const by = npcBrushPreviewPos.y;
                ctx.strokeStyle = npcTool === 'erase' ? '#ff0' : '#0ff';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);

                if (npcBrushShape === 'square') {
                    const halfBrush = Math.floor(npcBrushSize / 2);
                    ctx.strokeRect(
                        (bx - halfBrush) * scale,
                        (by - halfBrush) * scale,
                        npcBrushSize * scale,
                        npcBrushSize * scale
                    );
                } else if (npcBrushShape === 'circle') {
                    const radius = (npcBrushSize / 2) * scale;
                    ctx.beginPath();
                    ctx.arc(bx * scale, by * scale, radius, 0, Math.PI * 2);
                    ctx.stroke();
                } else if (npcBrushShape === 'rect') {
                    const halfW = Math.floor(npcBrushRectW / 2);
                    const halfH = Math.floor(npcBrushRectH / 2);
                    ctx.strokeRect(
                        (bx - halfW) * scale,
                        (by - halfH) * scale,
                        npcBrushRectW * scale,
                        npcBrushRectH * scale
                    );
                }
                ctx.setLineDash([]);

                // Draw size label near cursor
                ctx.fillStyle = npcTool === 'erase' ? '#ff0' : '#0ff';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'left';
                const sizeText = npcBrushShape === 'rect'
                    ? `${npcBrushRectW}x${npcBrushRectH}`
                    : `${npcBrushSize}px`;
                ctx.fillText(sizeText, (bx + 10) * scale, (by - 5) * scale);
            }

            // Draw split line
            if (npcSplitLine !== null) {
                const splitY = npcSplitLine * scale;
                ctx.strokeStyle = '#0f0';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.moveTo(0, splitY);
                ctx.lineTo(canvas.width, splitY);
                ctx.stroke();
                ctx.setLineDash([]);

                // Label
                ctx.fillStyle = '#0f0';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('DEPTH SPLIT', 4, splitY - 4);
            }
        }

        function npcCanvasClick(e) {
            if (!npcEditorImage) return;

            const canvas = document.getElementById('npcEditorCanvas');
            const rect = canvas.getBoundingClientRect();
            const scale = npcEditorZoom;

            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            const gridX = Math.floor(clickX / scale / npcEditorFrameW);
            const gridY = Math.floor(clickY / scale / npcEditorFrameH);

            const frameX = gridX * npcEditorFrameW;
            const frameY = gridY * npcEditorFrameH;

            // Initialize animation array if needed
            if (!npcAnimations[npcCurrentAnim]) {
                npcAnimations[npcCurrentAnim] = [];
            }

            const frames = npcAnimations[npcCurrentAnim];

            // Always add frame (allows same frame multiple times for animation)
            // Use right-click or frame list to remove frames
            frames.push({
                x: frameX,
                y: frameY,
                w: npcEditorFrameW,
                h: npcEditorFrameH
            });

            npcDrawCanvas();
            npcUpdateFramesList();
            npcUpdateAnimButtons();
            npcStartPreview();
        }

        function npcUpdateFramesList() {
            const container = document.getElementById('npcFramesList');
            const countEl = document.getElementById('npcFrameCount');
            const frames = npcAnimations[npcCurrentAnim] || [];

            countEl.textContent = frames.length;

            if (!npcEditorImage || frames.length === 0) {
                container.innerHTML = '<span style="color:#666;">Click frames on sprite sheet to add</span>';
                return;
            }

            container.innerHTML = '';
            frames.forEach((frame, i) => {
                const div = document.createElement('div');
                div.style.cssText = 'display:inline-block; margin:2px; cursor:pointer;';

                const thumbCanvas = document.createElement('canvas');
                thumbCanvas.width = 40;
                thumbCanvas.height = 40;
                const thumbCtx = thumbCanvas.getContext('2d');
                thumbCtx.imageSmoothingEnabled = false;

                const scale = Math.min(40 / frame.w, 40 / frame.h);
                const dw = frame.w * scale;
                const dh = frame.h * scale;
                const dx = (40 - dw) / 2;
                const dy = (40 - dh) / 2;

                thumbCtx.drawImage(npcEditorImage, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh);

                thumbCanvas.style.border = '2px solid #4af';
                thumbCanvas.style.borderRadius = '3px';
                thumbCanvas.title = 'Frame ' + (i + 1) + ' - Click to remove';
                thumbCanvas.onclick = () => {
                    npcAnimations[npcCurrentAnim].splice(i, 1);
                    npcDrawCanvas();
                    npcUpdateFramesList();
                    npcUpdateAnimButtons();
                };

                div.appendChild(thumbCanvas);
                container.appendChild(div);
            });
        }

        function npcUpdateSpeed() {
            const fps = parseInt(document.getElementById('npcSpeedSlider').value);
            document.getElementById('npcSpeedLabel').textContent = fps + ' fps';
            npcStartPreview();
        }

        function npcUpdatePingPong() {
            npcPingPong = document.getElementById('npcPingPong').checked;
            npcPreviewDirection = 1;
            npcStartPreview();
        }

        function npcUpdatePreviewScale() {
            const scale = parseFloat(document.getElementById('npcPreviewScale').value) || 1;
            document.getElementById('npcPreviewScaleLabel').textContent = scale + 'x';
            // Preview will update on next frame
        }

        function updateNpcShadowPreview() {
            // Hide/show shadow controls based on noShadow checkbox
            const noShadow = document.getElementById('npcNoShadow')?.checked;
            const controls = document.getElementById('npcShadowControls');
            if (controls) controls.style.display = noShadow ? 'none' : 'block';

            // Update slider labels
            const offsetXVal = document.getElementById('npcShadowOffsetXSlider').value;
            const offsetVal = document.getElementById('npcShadowOffsetSlider').value;
            const widthVal = document.getElementById('npcShadowWidthSlider').value;
            const heightVal = document.getElementById('npcShadowHeightSlider').value;
            document.getElementById('npcShadowOffsetXVal').textContent = offsetXVal;
            document.getElementById('npcShadowOffsetVal').textContent = offsetVal;
            document.getElementById('npcShadowWidthVal').textContent = widthVal;
            document.getElementById('npcShadowHeightVal').textContent = heightVal;
        }

        function npcStartPreview() {
            npcStopPreview();
            const frames = npcAnimations[npcCurrentAnim] || [];
            if (frames.length === 0 || !npcEditorImage) return;

            const fps = parseInt(document.getElementById('npcSpeedSlider').value) || 8;
            const isMirrored = npcAnimMirrors[npcCurrentAnim];
            npcPreviewFrame = 0;
            npcPreviewDirection = 1;
            npcPreviewPlaying = true;

            npcPreviewInterval = setInterval(() => {
                const canvas = document.getElementById('npcLivePreview');
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, 96, 96);

                // Draw light background so shadow is visible
                ctx.fillStyle = '#e8e8e8';
                ctx.fillRect(0, 0, 96, 96);

                if (frames.length > 0) {
                    const frame = frames[npcPreviewFrame];
                    // Get user preview scale (simulates NPC scale on map)
                    const previewScale = parseFloat(document.getElementById('npcPreviewScale')?.value || 1);
                    // Base scale to fit in canvas
                    const baseScale = Math.min(96 / (frame.w * previewScale), 96 / (frame.h * previewScale));
                    const scale = baseScale;
                    const dw = frame.w * scale * previewScale;
                    const dh = frame.h * scale * previewScale;
                    const dx = (96 - dw) / 2;
                    // Bottom-aligned like in game
                    const dy = 96 - dh - 4;

                    // Draw shadow preview (matches game rendering)
                    const noShadow = document.getElementById('npcNoShadow')?.checked;
                    if (!noShadow) {
                        const shadowOffsetX = parseInt(document.getElementById('npcShadowOffsetXSlider').value) || 0;
                        const shadowOffsetY = parseInt(document.getElementById('npcShadowOffsetSlider').value) || 4;
                        const shadowWidthRatio = (parseInt(document.getElementById('npcShadowWidthSlider').value) || 35) / 100;
                        const shadowHeightRatio = (parseInt(document.getElementById('npcShadowHeightSlider').value) || 12) / 100;
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                        ctx.beginPath();
                        // Shadow size scales with NPC, offset doesn't (matches game)
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
                        ctx.drawImage(npcEditorImage, frame.x, frame.y, frame.w, frame.h, 96 - dx - dw, dy, dw, dh);
                        ctx.restore();
                    } else {
                        ctx.drawImage(npcEditorImage, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh);
                    }

                    // Ping-pong or loop
                    if (npcPingPong && frames.length > 1) {
                        npcPreviewFrame += npcPreviewDirection;
                        if (npcPreviewFrame >= frames.length - 1) {
                            npcPreviewDirection = -1;
                        } else if (npcPreviewFrame <= 0) {
                            npcPreviewDirection = 1;
                        }
                    } else {
                        npcPreviewFrame = (npcPreviewFrame + 1) % frames.length;
                    }
                }
            }, 1000 / fps);
        }

        function npcStopPreview() {
            if (npcPreviewInterval) {
                clearInterval(npcPreviewInterval);
                npcPreviewInterval = null;
            }
            npcPreviewPlaying = false;
        }

        function npcClearCurrentAnim() {
            npcAnimations[npcCurrentAnim] = [];
            npcDrawCanvas();
            npcUpdateFramesList();
            npcStopPreview();
            const ctx = document.getElementById('npcLivePreview').getContext('2d');
            ctx.clearRect(0, 0, 96, 96);
        }

        // ============ Collision Box Editor (Inset-based) ============
        // Store insets (pixels to shrink from each edge) - simpler and matches debug draw exactly
        let npcCollisionInsets = null; // { top, bottom, left, right } in pixels
        let collisionPreviewDir = 'down';
        let collisionPreviewFrame = 0;
        let collisionPreviewAnimId = null;
        let collisionFrameInterval = null;

        function getCollisionFrameSize() {
            const anims = npcAnimations || {};
            const firstAnim = anims.walkDown || anims.idle || Object.values(anims).find(a => a && a.length > 0);
            const firstFrame = firstAnim && firstAnim[0];
            return {
                w: (firstFrame && firstFrame.w) || npcEditorFrameW || 32,
                h: (firstFrame && firstFrame.h) || npcEditorFrameH || 32
            };
        }

        function openNpcCollisionEditor() {
            if (!npcEditorImage) {
                alert('Please load an NPC sprite first');
                return;
            }
            // Initialize from current insets
            const insets = npcCollisionInsets || { top: 0, bottom: 0, left: 0, right: 0 };
            const frameSize = getCollisionFrameSize();

            // Set slider max values based on frame size
            document.getElementById('insetTop').max = Math.floor(frameSize.h / 2);
            document.getElementById('insetBottom').max = Math.floor(frameSize.h / 2);
            document.getElementById('insetLeft').max = Math.floor(frameSize.w / 2);
            document.getElementById('insetRight').max = Math.floor(frameSize.w / 2);

            // Set slider values
            document.getElementById('insetTop').value = insets.top;
            document.getElementById('insetBottom').value = insets.bottom;
            document.getElementById('insetLeft').value = insets.left;
            document.getElementById('insetRight').value = insets.right;

            document.getElementById('npcCollisionModal').style.display = 'flex';
            collisionPreviewDir = 'down';
            collisionPreviewFrame = 0;
            updateCollisionDirButtons();
            startCollisionPreviewLoop();
            updateCollisionInsets();
        }

        function closeNpcCollisionEditor() {
            document.getElementById('npcCollisionModal').style.display = 'none';
            stopCollisionPreviewLoop();
        }

        function setCollisionPreviewDir(dir) {
            collisionPreviewDir = dir;
            collisionPreviewFrame = 0;
            updateCollisionDirButtons();
        }

        function updateCollisionDirButtons() {
            ['idle', 'down', 'up', 'left', 'right'].forEach(d => {
                const btn = document.getElementById('collisionDir' + d.charAt(0).toUpperCase() + d.slice(1));
                if (btn) btn.classList.toggle('active', d === collisionPreviewDir);
            });
        }

        function startCollisionPreviewLoop() {
            stopCollisionPreviewLoop();
            const canvas = document.getElementById('collisionPreviewCanvas');
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;

            function loop() {
                ctx.clearRect(0, 0, 200, 200);
                ctx.fillStyle = '#222';
                ctx.fillRect(0, 0, 200, 200);

                if (!npcEditorImage) {
                    collisionPreviewAnimId = requestAnimationFrame(loop);
                    return;
                }

                // Get animation frames for current direction
                let animKey = collisionPreviewDir === 'idle' ? 'idle' :
                    'walk' + collisionPreviewDir.charAt(0).toUpperCase() + collisionPreviewDir.slice(1);
                let frames = npcAnimations[animKey] || [];
                if (frames.length === 0) {
                    frames = npcAnimations.idle || npcAnimations.walkDown || [];
                    if (frames.length === 0) {
                        const anyAnim = Object.values(npcAnimations).find(a => a && a.length > 0);
                        if (anyAnim) frames = anyAnim;
                    }
                }
                if (frames.length === 0) {
                    collisionPreviewAnimId = requestAnimationFrame(loop);
                    return;
                }

                const frame = frames[collisionPreviewFrame % frames.length];
                const isMirrored = npcAnimMirrors[animKey] || false;
                const frameW = frame.w || npcEditorFrameW;
                const frameH = frame.h || npcEditorFrameH;

                // Calculate scale to fit in canvas
                const padding = 20;
                const maxSize = 200 - padding * 2;
                const scale = Math.min(maxSize / frameW, maxSize / frameH, 4);
                const drawW = frameW * scale;
                const drawH = frameH * scale;
                const drawX = (200 - drawW) / 2;
                const drawY = (200 - drawH) / 2;

                // Draw shadow
                const shadowOffsetX = parseInt(document.getElementById('npcShadowOffsetXSlider')?.value || 0);
                const shadowOffsetY = parseInt(document.getElementById('npcShadowOffsetSlider')?.value || 4);
                const shadowWidthRatio = (parseInt(document.getElementById('npcShadowWidthSlider')?.value || 35)) / 100;
                const shadowHeightRatio = (parseInt(document.getElementById('npcShadowHeightSlider')?.value || 12)) / 100;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.beginPath();
                ctx.ellipse(100 + shadowOffsetX * scale, drawY + drawH - shadowOffsetY * scale, drawW * shadowWidthRatio, drawW * shadowHeightRatio, 0, 0, Math.PI * 2);
                ctx.fill();

                // Draw NPC frame
                ctx.save();
                if (isMirrored) {
                    ctx.translate(200, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(npcEditorImage, frame.x, frame.y, frameW, frameH, 200 - drawX - drawW, drawY, drawW, drawH);
                } else {
                    ctx.drawImage(npcEditorImage, frame.x, frame.y, frameW, frameH, drawX, drawY, drawW, drawH);
                }
                ctx.restore();

                // Draw full sprite outline (dashed cyan - the "default" that works)
                ctx.strokeStyle = '#0ff';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(drawX, drawY, drawW, drawH);
                ctx.setLineDash([]);

                // Draw collision box with insets (solid cyan fill)
                const insets = npcCollisionInsets || { top: 0, bottom: 0, left: 0, right: 0 };
                const boxX = drawX + insets.left * scale;
                const boxY = drawY + insets.top * scale;
                const boxW = drawW - (insets.left + insets.right) * scale;
                const boxH = drawH - (insets.top + insets.bottom) * scale;

                if (boxW > 0 && boxH > 0) {
                    ctx.fillStyle = 'rgba(0, 255, 255, 0.25)';
                    ctx.fillRect(boxX, boxY, boxW, boxH);
                    ctx.strokeStyle = '#0ff';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(boxX, boxY, boxW, boxH);
                }

                collisionPreviewAnimId = requestAnimationFrame(loop);
            }

            loop();

            // Advance frame every 150ms
            collisionFrameInterval = setInterval(() => {
                let animKey = collisionPreviewDir === 'idle' ? 'idle' :
                    'walk' + collisionPreviewDir.charAt(0).toUpperCase() + collisionPreviewDir.slice(1);
                let frames = npcAnimations[animKey] || [];
                if (frames.length === 0) {
                    frames = npcAnimations.idle || npcAnimations.walkDown || Object.values(npcAnimations).find(a => a && a.length > 0) || [];
                }
                if (frames.length > 0) {
                    collisionPreviewFrame = (collisionPreviewFrame + 1) % frames.length;
                }
            }, 150);
        }

        function stopCollisionPreviewLoop() {
            if (collisionPreviewAnimId) {
                cancelAnimationFrame(collisionPreviewAnimId);
                collisionPreviewAnimId = null;
            }
            if (collisionFrameInterval) {
                clearInterval(collisionFrameInterval);
                collisionFrameInterval = null;
            }
        }

        // Update insets from sliders
        function updateCollisionInsets() {
            const top = parseInt(document.getElementById('insetTop').value) || 0;
            const bottom = parseInt(document.getElementById('insetBottom').value) || 0;
            const left = parseInt(document.getElementById('insetLeft').value) || 0;
            const right = parseInt(document.getElementById('insetRight').value) || 0;

            document.getElementById('insetTopVal').textContent = top;
            document.getElementById('insetBottomVal').textContent = bottom;
            document.getElementById('insetLeftVal').textContent = left;
            document.getElementById('insetRightVal').textContent = right;

            npcCollisionInsets = { top, bottom, left, right };

            // Update info text
            const info = document.getElementById('collisionBoxInfo');
            const frameSize = getCollisionFrameSize();
            const boxW = frameSize.w - left - right;
            const boxH = frameSize.h - top - bottom;

            if (top === 0 && bottom === 0 && left === 0 && right === 0) {
                info.textContent = 'Full sprite (no insets)';
                info.style.color = '#0ff';
            } else if (boxW <= 0 || boxH <= 0) {
                info.textContent = 'Box too small!';
                info.style.color = '#f44';
            } else {
                info.textContent = `Collision: ${boxW}x${boxH}px`;
                info.style.color = '#0ff';
            }
        }

        function resetCollisionInsets() {
            document.getElementById('insetTop').value = 0;
            document.getElementById('insetBottom').value = 0;
            document.getElementById('insetLeft').value = 0;
            document.getElementById('insetRight').value = 0;
            updateCollisionInsets();
        }

        function applyNpcCollisionBox() {
            // Update status in NPC editor
            const status = document.getElementById('npcCollisionStatus');
            const insets = npcCollisionInsets || { top: 0, bottom: 0, left: 0, right: 0 };
            if (insets.top > 0 || insets.bottom > 0 || insets.left > 0 || insets.right > 0) {
                const frameSize = getCollisionFrameSize();
                const boxW = frameSize.w - insets.left - insets.right;
                const boxH = frameSize.h - insets.top - insets.bottom;
                status.textContent = `Box: ${boxW}x${boxH}px`;
                status.style.color = '#0ff';
            } else {
                status.textContent = 'Full sprite';
                status.style.color = '#888';
            }
            closeNpcCollisionEditor();
        }
        // ============ End Collision Box Editor ============

        function npcSave() {
            const name = document.getElementById('npcNameInput').value.trim() || 'NPC ' + (npcs.length + 1);

            // Check if at least one animation has frames
            const hasFrames = Object.values(npcAnimations).some(arr => arr.length > 0);
            if (!hasFrames) {
                alert('Please select at least one frame for any animation');
                return;
            }

            const fps = parseInt(document.getElementById('npcSpeedSlider').value) || 8;

            // Read shadow settings from sliders
            const noShadow = document.getElementById('npcNoShadow')?.checked || false;
            const shadowOffsetX = parseInt(document.getElementById('npcShadowOffsetXSlider').value) || 0;
            const shadowOffsetY = parseInt(document.getElementById('npcShadowOffsetSlider').value) || 4;
            const shadowWidth = (parseInt(document.getElementById('npcShadowWidthSlider').value) || 35) / 100;
            const shadowHeight = (parseInt(document.getElementById('npcShadowHeightSlider').value) || 12) / 100;

            const npcData = {
                name: name,
                spriteData: npcEditorData,
                frameWidth: npcEditorFrameW,
                frameHeight: npcEditorFrameH,
                animations: JSON.parse(JSON.stringify(npcAnimations)),
                animMirrors: JSON.parse(JSON.stringify(npcAnimMirrors)),
                fps: fps,
                pingPong: npcPingPong,
                collisionInsets: npcCollisionInsets ? { ...npcCollisionInsets } : null,
                noShadow: noShadow,
                shadowOffsetX: shadowOffsetX,
                shadowOffsetY: shadowOffsetY,
                shadowWidth: shadowWidth,
                shadowHeight: shadowHeight
            };

            if (npcEditorEditingIndex >= 0) {
                npcs[npcEditorEditingIndex] = npcData;
                // Broadcast update to other builders
                broadcastEdit({ editType: 'updateNpc', index: npcEditorEditingIndex, npc: npcData });
            } else {
                npcs.push(npcData);
                currentNpcIndex = npcs.length - 1;
                // Broadcast new NPC to other builders
                broadcastEdit({ editType: 'addNpc', npc: npcData });
            }

            document.getElementById('npcModal').classList.remove('visible');
            npcStopPreview();
            stopEditing(); // Clear editing lock
            updateNpcList();
        }

        function npcCancel() {
            document.getElementById('npcModal').classList.remove('visible');
            npcStopPreview();
            stopEditing(); // Clear editing lock
        }

        function updateNpcList() {
            const container = document.getElementById('npcList');

            if (npcs.length === 0) {
                container.innerHTML = '<div style="color:#888; font-size:12px; padding:10px; text-align:center;">No NPCs created yet</div>';
                return;
            }

            container.innerHTML = '';
            npcs.forEach((npc, i) => {
                const div = document.createElement('div');
                div.style.cssText = 'display:flex; align-items:center; gap:8px; padding:5px; margin-bottom:5px; background:' + (i === currentNpcIndex ? '#2a5a8a' : '#333') + '; border-radius:4px; cursor:pointer;';

                // Thumbnail
                const thumb = document.createElement('canvas');
                thumb.width = 32;
                thumb.height = 32;
                thumb.style.cssText = 'border:1px solid #555; border-radius:3px; image-rendering:pixelated;';

                // Use first frame from walkDown or first available animation
                const anims = npc.animations || {};
                const firstAnim = (anims.walkDown?.length > 0 ? anims.walkDown : null) ||
                                  (anims.idle?.length > 0 ? anims.idle : null) ||
                                  Object.values(anims).find(a => a && a.length > 0);
                if (npc.spriteData && firstAnim && firstAnim.length > 0) {
                    const img = new Image();
                    img.onload = () => {
                        const ctx = thumb.getContext('2d');
                        ctx.imageSmoothingEnabled = false;
                        const frame = firstAnim[0];
                        const scale = Math.min(32 / frame.w, 32 / frame.h);
                        const dw = frame.w * scale;
                        const dh = frame.h * scale;
                        ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, (32-dw)/2, (32-dh)/2, dw, dh);
                    };
                    img.src = npc.spriteData;
                }

                // Name
                const nameSpan = document.createElement('span');
                nameSpan.textContent = npc.name;
                nameSpan.style.cssText = 'flex:1; font-size:12px;';

                // Edit button
                const editBtn = document.createElement('button');
                editBtn.textContent = '✎';
                editBtn.style.cssText = 'padding:2px 6px; font-size:11px; background:#666;';
                editBtn.onclick = (e) => { e.stopPropagation(); openNpcEditor(i); };

                // Delete button
                const delBtn = document.createElement('button');
                delBtn.textContent = '×';
                delBtn.style.cssText = 'padding:2px 6px; font-size:11px; background:#a55;';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    // Wave 3: warn about placed NPCs that will be orphan-dropped.
                    const placedCount = Array.isArray(placedNpcs)
                        ? placedNpcs.filter(p => p && p.npcIndex === i).length : 0;
                    const msg = placedCount > 0
                        ? `Delete NPC "${npc.name}"?\n\n${placedCount} placed instance(s) will also be removed.`
                        : `Delete NPC "${npc.name}"?`;
                    if (confirm(msg)) {
                        const deletedIndex = i;
                        npcs.splice(i, 1);
                        reindexNpcReferences(deletedIndex);
                        if (currentNpcIndex >= npcs.length) currentNpcIndex = npcs.length - 1;
                        updateNpcList();
                        if (typeof updatePlacedNpcList === 'function') updatePlacedNpcList();
                        renderMap();
                        broadcastEdit({ editType: 'deleteNpc', index: deletedIndex });
                    }
                };

                div.onclick = () => {
                    currentNpcIndex = i;
                    updateNpcList();
                };

                div.appendChild(thumb);
                div.appendChild(nameSpan);
                div.appendChild(editBtn);
                div.appendChild(delBtn);
                container.appendChild(div);
            });
        }

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

        // ===== NPC PLACEMENT & PATH FUNCTIONS =====

        function placeNpcAt(x, y) {
            console.log('placeNpcAt called:', x, y, 'currentNpcIndex:', currentNpcIndex);
            if (currentNpcIndex < 0 || !npcs[currentNpcIndex]) {
                console.log('No NPC selected, cannot place');
                return;
            }

            // Check if there's already an NPC at this position
            const existing = placedNpcs.findIndex(p => p.x === x && p.y === y && p.mapName === currentMapName);
            if (existing >= 0) {
                // Select existing instead of placing new
                selectPlacedNpc(existing);
                return;
            }

            // Get current scale from placement slider (for new placement)
            const currentScale = parseFloat(document.getElementById('npcPlacementScale')?.value) || 1;

            const placed = {
                npcIndex: currentNpcIndex,
                mapName: currentMapName,
                x: x,
                y: y,
                path: [],
                trigger: 'loop',
                speed: 3,
                scale: currentScale,
                uid: 'npc_' + currentNpcIndex + '_' + Date.now() // Assign UID immediately for quest system
            };

            placedNpcs.push(placed);
            selectedPlacedNpcIndex = placedNpcs.length - 1;
            // Broadcast to co-op builders
            broadcastEdit({ editType: 'placeNpc', npc: placed, index: selectedPlacedNpcIndex });

            updatePlacedNpcList();
            showNpcPathPanel();
            renderMap();
        }

        function findPlacedNpcAt(x, y) {
            return placedNpcs.findIndex(p => p.x === x && p.y === y && p.mapName === currentMapName);
        }

        function selectPlacedNpc(index) {
            // Stop any running preview when selecting different NPC
            if (npcPathPreviewActive && index !== selectedPlacedNpcIndex) {
                stopNpcPathPreview();
            }

            selectedPlacedNpcIndex = index;
            npcPathDrawing = false;
            npcPathEditing = false;
            npcDraggingWaypoint = -1;
            updatePathDrawButton();

            const placed = placedNpcs[index];
            if (placed) {
                document.getElementById('npcTriggerType').value = placed.trigger || 'loop';
                document.getElementById('npcWalkSpeed').value = placed.speed || 3;
                document.getElementById('npcSpeedValue').textContent = placed.speed || 3;
                // Load animation speed (default to NPC's fps or 8)
                const npc = npcs[placed.npcIndex];
                const defaultFps = npc?.fps || 8;
                const animSpeed = placed.animSpeed || defaultFps;
                document.getElementById('npcAnimSpeed').value = animSpeed;
                document.getElementById('npcAnimSpeedValue').textContent = animSpeed + ' fps';
            }

            updatePlacedNpcList();
            showNpcPathPanel();
            renderMap();
        }

        function removeNpcAt(x, y) {
            const idx = findPlacedNpcAt(x, y);
            if (idx >= 0) {
                placedNpcs.splice(idx, 1);
                // Broadcast to co-op builders
                broadcastEdit({ editType: 'removeNpc', index: idx });
                if (selectedPlacedNpcIndex === idx) {
                    selectedPlacedNpcIndex = -1;
                    hideNpcPathPanel();
                } else if (selectedPlacedNpcIndex > idx) {
                    selectedPlacedNpcIndex--;
                }
                updatePlacedNpcList();
                renderMap();
            }
        }

        function deleteSelectedPlacedNpc() {
            if (selectedPlacedNpcIndex >= 0) {
                const idx = selectedPlacedNpcIndex;
                placedNpcs.splice(selectedPlacedNpcIndex, 1);
                // Broadcast to co-op builders
                broadcastEdit({ editType: 'removeNpc', index: idx });
                selectedPlacedNpcIndex = -1;
                npcPathDrawing = false;
                hideNpcPathPanel();
                updatePlacedNpcList();
                renderMap();
            }
        }

        function showNpcPathPanel() {
            const panel = document.getElementById('npcPathPanel');
            if (!panel) {
                console.error('npcPathPanel not found!');
                return;
            }
            panel.style.display = 'block';
            console.log('Path panel shown, selectedPlacedNpcIndex:', selectedPlacedNpcIndex);

            if (selectedPlacedNpcIndex >= 0) {
                const placed = placedNpcs[selectedPlacedNpcIndex];
                const npc = npcs[placed.npcIndex];
                document.getElementById('npcPathName').textContent = npc ? npc.name : 'NPC';
                updateNpcWaypointList();
                updatePathDrawButton();

                // Load enemy settings
                const isEnemy = placed.isEnemy || false;
                const attackMode = placed.attackMode || 'touch';
                document.getElementById('npcIsEnemy').checked = isEnemy;
                document.getElementById('npcEnemyOptions').style.display = isEnemy ? 'block' : 'none';
                document.getElementById('npcVisionRadius').value = placed.visionRadius || 5;
                document.getElementById('npcVisionValue').textContent = (placed.visionRadius || 5) + ' tiles';
                document.getElementById('npcChaseSpeed').value = placed.chaseSpeed || 4;
                document.getElementById('npcChaseSpeedValue').textContent = placed.chaseSpeed || 4;
                document.getElementById('npcAttackMode').value = attackMode;
                document.getElementById('npcDamage').value = placed.damage || 10;
                document.getElementById('npcDamageValue').textContent = placed.damage || 10;
                document.getElementById('npcAttackCooldown').value = placed.attackCooldown || 1;
                document.getElementById('npcCooldownValue').textContent = (placed.attackCooldown || 1).toFixed(1) + 's';
                document.getElementById('npcLungeOptions').style.display = attackMode === 'lunge' ? 'block' : 'none';
                document.getElementById('npcAttackRange').value = placed.attackRange || 2;
                document.getElementById('npcLungeRangeValue').textContent = (placed.attackRange || 2) + ' tiles';
                document.getElementById('npcLungeSpeed').value = placed.lungeSpeed || 8;
                document.getElementById('npcLungeSpeedValue').textContent = placed.lungeSpeed || 8;
                // Load slowdown settings
                document.getElementById('npcSlowdownPercent').value = placed.slowdownPercent !== undefined ? placed.slowdownPercent : 50;
                document.getElementById('npcSlowdownValue').textContent = (placed.slowdownPercent !== undefined ? placed.slowdownPercent : 50) + '%';
                document.getElementById('npcSlowdownDuration').value = placed.slowdownDuration !== undefined ? placed.slowdownDuration : 0.5;
                document.getElementById('npcSlowdownDurationValue').textContent = (placed.slowdownDuration !== undefined ? placed.slowdownDuration : 0.5).toFixed(2) + 's';

                // Load drop items
                renderNpcDropItems();

                // Load trigger and speed settings
                document.getElementById('npcTriggerType').value = placed.trigger || 'loop';
                document.getElementById('npcWalkSpeed').value = placed.speed || 3;
                document.getElementById('npcSpeedValue').textContent = placed.speed || 3;

                // Load scale setting
                document.getElementById('npcScale').value = placed.scale || 1;
                document.getElementById('npcScaleValue').textContent = (placed.scale || 1).toFixed(1) + 'x';

                // Load shop attachment
                updateNpcShopDropdown();
                const shopSelect = document.getElementById('npcShopSelect');
                if (shopSelect) {
                    shopSelect.value = placed.shopIndex !== undefined ? placed.shopIndex : -1;
                }
                updateNpcShopInfo(placed);

                // Show quest chain info for this NPC
                updateNpcQuestChainPanel(placed);
            }
        }

        function updateNpcQuestChainPanel(placed) {
            const panel = document.getElementById('npcQuestChainPanel');
            const list = document.getElementById('npcQuestChainList');
            if (!panel || !list) return;

            // Find all quests that reference this NPC
            const npcUid = placed.uid;
            if (!npcUid || !quests || quests.length === 0) {
                panel.style.display = 'none';
                return;
            }

            // Get quests where this NPC is the START NPC (these form the chain)
            const questsForNpc = [];
            quests.forEach((quest, index) => {
                if (quest.startNpcUid === npcUid) {
                    const roles = ['Start'];
                    if (quest.turnInNpcUid === npcUid) roles.push('Turn-in');
                    questsForNpc.push({
                        quest,
                        globalIndex: index,
                        roles: roles.join(' & ')
                    });
                } else if (quest.turnInNpcUid === npcUid) {
                    // Turn-in only (not part of this NPC's chain, just receives)
                    questsForNpc.push({
                        quest,
                        globalIndex: index,
                        roles: 'Turn-in only',
                        isTurnInOnly: true
                    });
                }
            });

            if (questsForNpc.length === 0) {
                panel.style.display = 'none';
                return;
            }

            panel.style.display = 'block';

            // Separate chain quests from turn-in only
            const chainQuests = questsForNpc.filter(q => !q.isTurnInOnly);
            const turnInOnlyQuests = questsForNpc.filter(q => q.isTurnInOnly);

            let html = '';

            // Show chain quests with per-NPC order numbers
            if (chainQuests.length > 0) {
                html += chainQuests.map((q, i) => {
                    const orderBadge = chainQuests.length > 1 ?
                        `<span style="background:#fa0; color:#000; padding:1px 5px; border-radius:3px; font-weight:bold; margin-right:5px;">${i + 1}</span>` : '';
                    return `<div style="margin-bottom:4px; padding:4px; background:#333; border-radius:3px;">
                        ${orderBadge}<span style="color:#fff;">${q.quest.name || q.quest.id}</span>
                    </div>`;
                }).join('');
            }

            // Show turn-in only quests separately
            if (turnInOnlyQuests.length > 0) {
                html += `<div style="font-size:9px; color:#888; margin-top:6px;">Turn-in for:</div>`;
                html += turnInOnlyQuests.map(q => {
                    return `<div style="margin-bottom:2px; padding:3px; background:#2a2a3a; border-radius:3px; font-size:10px;">
                        <span style="color:#aaa;">${q.quest.name || q.quest.id}</span>
                    </div>`;
                }).join('');
            }

            if (chainQuests.length > 1) {
                html += `<div style="font-size:9px; color:#fa0; margin-top:6px; font-style:italic;">
                    Chain order: #1 triggers first, then #2, etc.
                </div>`;
            }

            list.innerHTML = html;
        }

        function updateNpcEnemy() {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];

            const isEnemy = document.getElementById('npcIsEnemy').checked;
            const visionRadius = parseInt(document.getElementById('npcVisionRadius').value) || 5;
            const chaseSpeed = parseInt(document.getElementById('npcChaseSpeed').value) || 4;
            const attackMode = document.getElementById('npcAttackMode').value || 'touch';
            const damage = parseInt(document.getElementById('npcDamage').value) || 10;
            const attackCooldown = parseFloat(document.getElementById('npcAttackCooldown').value) || 1;
            const attackRange = parseInt(document.getElementById('npcAttackRange').value) || 2;
            const lungeSpeed = parseInt(document.getElementById('npcLungeSpeed').value) || 8;
            const slowdownPercent = parseInt(document.getElementById('npcSlowdownPercent').value);
            const slowdownDuration = parseFloat(document.getElementById('npcSlowdownDuration').value);

            // Update UI labels
            document.getElementById('npcEnemyOptions').style.display = isEnemy ? 'block' : 'none';
            document.getElementById('npcVisionValue').textContent = visionRadius + ' tiles';
            document.getElementById('npcChaseSpeedValue').textContent = chaseSpeed;
            document.getElementById('npcDamageValue').textContent = damage;
            document.getElementById('npcCooldownValue').textContent = attackCooldown.toFixed(1) + 's';
            document.getElementById('npcLungeOptions').style.display = attackMode === 'lunge' ? 'block' : 'none';
            document.getElementById('npcLungeRangeValue').textContent = attackRange + ' tiles';
            document.getElementById('npcLungeSpeedValue').textContent = lungeSpeed;
            document.getElementById('npcSlowdownValue').textContent = slowdownPercent + '%';
            document.getElementById('npcSlowdownDurationValue').textContent = slowdownDuration.toFixed(2) + 's';

            // Update placed NPC data
            placed.isEnemy = isEnemy;
            placed.visionRadius = visionRadius;
            placed.chaseSpeed = chaseSpeed;
            placed.attackMode = attackMode;
            placed.damage = damage;
            placed.attackCooldown = attackCooldown;
            placed.attackRange = attackRange;
            placed.lungeSpeed = lungeSpeed;
            placed.slowdownPercent = slowdownPercent;
            placed.slowdownDuration = slowdownDuration;

            // Broadcast to live sync
            broadcastEdit({
                editType: 'updatePlacedNpc',
                index: selectedPlacedNpcIndex,
                npc: placed
            });

            renderMap();
        }

        function updateNpcScale() {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];

            const scale = parseFloat(document.getElementById('npcScale').value) || 1;
            document.getElementById('npcScaleValue').textContent = scale.toFixed(1) + 'x';

            placed.scale = scale;

            // Broadcast to live sync
            broadcastEdit({
                editType: 'updatePlacedNpc',
                index: selectedPlacedNpcIndex,
                npc: placed
            });

            renderMap();
        }

        // Update placement scale display (before placing)
        function updateNpcPlacementScaleDisplay() {
            const scale = parseFloat(document.getElementById('npcPlacementScale').value) || 1;
            document.getElementById('npcPlacementScaleValue').textContent = scale.toFixed(1) + 'x';
        }

        // === NPC DROP ITEMS SYSTEM ===
        function renderNpcDropItems() {
            const container = document.getElementById('npcDropItemsList');
            if (!container) return;

            if (selectedPlacedNpcIndex < 0) {
                container.innerHTML = '<span style="color:#666; font-size:9px;">No NPC selected</span>';
                return;
            }

            const placed = placedNpcs[selectedPlacedNpcIndex];
            const dropItems = placed.dropItems || [];

            if (dropItems.length === 0) {
                container.innerHTML = '<span style="color:#666; font-size:9px;">No drops configured</span>';
                return;
            }

            container.innerHTML = dropItems.map((drop, i) => {
                const item = items[drop.itemIndex];
                const itemName = item ? item.name : 'Unknown';
                const qty = drop.quantity || 1;
                return `<div style="display:inline-flex; align-items:center; background:#3a2a3a; padding:2px 6px; margin:2px; border-radius:3px; font-size:9px;">
                    <span style="color:#a8a;">Give: ${itemName}${qty > 1 ? ' x' + qty : ''}</span>
                    <button onclick="removeNpcDropItem(${i})" style="margin-left:5px; background:#a55; border:none; color:#fff; padding:1px 4px; cursor:pointer; font-size:8px;">×</button>
                </div>`;
            }).join('');
        }

        function addNpcDropItem() {
            if (selectedPlacedNpcIndex < 0) return;
            if (items.length === 0) {
                alert('No items defined. Create items first in the Items tab.');
                return;
            }

            // Create item selection popup
            const popup = document.createElement('div');
            popup.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#222; border:2px solid #a4a; padding:15px; z-index:10000; border-radius:8px; max-height:80vh; overflow:auto;';
            popup.innerHTML = `
                <div style="color:#a8a; margin-bottom:10px; font-weight:bold;">Select Drop Item:</div>
                <div style="display:flex; align-items:center; margin-bottom:10px;">
                    <label style="color:#888; font-size:10px; margin-right:5px;">Quantity:</label>
                    <input type="number" id="dropItemQuantity" value="1" min="1" max="99" style="width:50px; background:#333; color:#fff; border:1px solid #555; padding:3px;">
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:5px; max-width:300px;">
                    ${items.map((item, i) => `
                        <div onclick="selectNpcDropItem(${i})" style="background:#333; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:10px; color:#fff; border:1px solid #555;">
                            ${item.name}
                        </div>
                    `).join('')}
                </div>
                <button onclick="this.parentElement.remove()" style="margin-top:10px; background:#555; color:#fff; border:none; padding:5px 15px; cursor:pointer;">Cancel</button>
            `;
            document.body.appendChild(popup);
            window.currentDropItemPopup = popup;
        }

        function selectNpcDropItem(itemIndex) {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];

            if (!placed.dropItems) placed.dropItems = [];

            const quantityInput = document.getElementById('dropItemQuantity');
            const quantity = parseInt(quantityInput?.value) || 1;

            placed.dropItems.push({ itemIndex: itemIndex, quantity: quantity });
            renderNpcDropItems();

            // Broadcast to live sync
            broadcastEdit({
                editType: 'updatePlacedNpc',
                index: selectedPlacedNpcIndex,
                npc: placed
            });

            // Close popup
            if (window.currentDropItemPopup) {
                window.currentDropItemPopup.remove();
                window.currentDropItemPopup = null;
            }
        }

        function removeNpcDropItem(index) {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];

            if (placed.dropItems && index >= 0 && index < placed.dropItems.length) {
                placed.dropItems.splice(index, 1);
                renderNpcDropItems();

                // Broadcast to live sync
                broadcastEdit({
                    editType: 'updatePlacedNpc',
                    index: selectedPlacedNpcIndex,
                    npc: placed
                });
            }
        }

        function hideNpcPathPanel() {
            document.getElementById('npcPathPanel').style.display = 'none';
            npcPathDrawing = false;
            updatePathDrawButton();
        }

        // Toggle NPC settings collapsible panel
        let npcSettingsExpanded = false;
        function toggleNpcSettingsPanel() {
            npcSettingsExpanded = !npcSettingsExpanded;
            const content = document.getElementById('npcSettingsContent');
            const toggle = document.getElementById('npcSettingsToggle');
            if (npcSettingsExpanded) {
                content.style.display = 'block';
                toggle.textContent = '-';
            } else {
                content.style.display = 'none';
                toggle.textContent = '+';
            }
        }

        function toggleNpcPathDrawing() {
            npcPathDrawing = !npcPathDrawing;
            if (npcPathDrawing) {
                npcPathEditing = false; // Disable edit mode when drawing
            }
            updatePathDrawButton();
        }

        function updatePathDrawButton() {
            const drawBtn = document.getElementById('npcDrawPathBtn');
            const editBtn = document.getElementById('npcEditPathBtn');
            const info = document.getElementById('npcPathInfo');

            if (npcPathDrawing) {
                drawBtn.textContent = 'Stop Drawing';
                drawBtn.style.background = '#a55';
                editBtn.style.background = '#47a';
                info.textContent = 'Click tiles to add waypoints. Right-click to undo.';
                info.style.color = '#4f4';
            } else if (npcPathEditing) {
                drawBtn.textContent = 'Draw Path';
                drawBtn.style.background = '#4a4';
                editBtn.textContent = 'Stop Editing';
                editBtn.style.background = '#a55';
                info.textContent = 'Drag waypoint markers to move them. Right-click to delete.';
                info.style.color = '#fa4';
            } else {
                drawBtn.textContent = 'Draw Path';
                drawBtn.style.background = '#4a4';
                editBtn.textContent = 'Edit Path';
                editBtn.style.background = '#47a';
                info.textContent = 'Click tiles to add waypoints';
                info.style.color = '#666';
            }
        }

        function toggleNpcPathEditing() {
            npcPathEditing = !npcPathEditing;
            if (npcPathEditing) {
                npcPathDrawing = false; // Disable draw mode when editing
            }
            npcDraggingWaypoint = -1;
            updatePathDrawButton();
        }

        // Find the nearest waypoint to a given position (within 1 tile distance)
        function findNearestWaypoint(x, y, path) {
            if (!path || path.length === 0) return -1;

            let nearest = -1;
            let minDist = 2; // Max distance of 2 tiles to select

            for (let i = 0; i < path.length; i++) {
                const wp = path[i];
                const dist = Math.abs(wp.x - x) + Math.abs(wp.y - y); // Manhattan distance
                if (dist < minDist) {
                    minDist = dist;
                    nearest = i;
                }
            }

            return nearest;
        }

        function addNpcWaypoint(x, y) {
            if (selectedPlacedNpcIndex < 0) return;

            const placed = placedNpcs[selectedPlacedNpcIndex];
            if (!placed.path) placed.path = [];

            // Don't add duplicate consecutive waypoints
            const last = placed.path[placed.path.length - 1];
            if (last && last.x === x && last.y === y) return;

            placed.path.push({ x, y });
            updateNpcWaypointList();
            renderMap();
            broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
        }

        function removeLastNpcWaypoint() {
            if (selectedPlacedNpcIndex < 0) return;

            const placed = placedNpcs[selectedPlacedNpcIndex];
            if (placed.path && placed.path.length > 0) {
                placed.path.pop();
                updateNpcWaypointList();
                renderMap();
                broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
            }
        }

        function clearNpcPath() {
            if (selectedPlacedNpcIndex < 0) return;

            const placed = placedNpcs[selectedPlacedNpcIndex];
            placed.path = [];
            updateNpcWaypointList();
            renderMap();
            broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
        }

        function updateNpcTrigger() {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            placed.trigger = document.getElementById('npcTriggerType').value;
            broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
        }

        function updateNpcSpeed() {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            const speed = parseFloat(document.getElementById('npcWalkSpeed').value);
            placed.speed = speed;
            document.getElementById('npcSpeedValue').textContent = speed;
            broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
        }

        function updateNpcAnimSpeed() {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            const fps = parseInt(document.getElementById('npcAnimSpeed').value);
            placed.animSpeed = fps;
            document.getElementById('npcAnimSpeedValue').textContent = fps + ' fps';
            broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
        }

        function updateNpcWaypointList() {
            const container = document.getElementById('npcWaypointList');
            if (selectedPlacedNpcIndex < 0) {
                container.innerHTML = 'No NPC selected';
                return;
            }

            const placed = placedNpcs[selectedPlacedNpcIndex];
            const path = placed.path || [];

            if (path.length === 0) {
                container.innerHTML = 'No waypoints - click Draw Path then click map';
                return;
            }

            // Get available animations for this NPC
            const npc = npcs[placed.npcIndex];
            const customAnims = [];
            if (npc && npc.animations) {
                Object.keys(npc.animations).forEach(key => {
                    if (!['walkDown', 'walkUp', 'walkLeft', 'walkRight', 'idle', 'attackDown', 'attackUp', 'attackLeft', 'attackRight'].includes(key)) {
                        customAnims.push(key);
                    }
                });
            }

            // Show list of waypoints with clear action controls
            let html = '<strong>Waypoints:</strong><div style="margin-top:8px;">';
            path.forEach((wp, i) => {
                const duration = wp.idleTime || 0;
                const action = wp.animation || 'walk';
                const hasStop = duration > 0;

                html += `<div style="background:#1a1a2e; border-radius:4px; padding:6px; margin-bottom:6px; border-left:3px solid ${wp.triggerProp ? '#fa0' : (hasStop ? '#4af' : '#444')};">`;

                // Header row: waypoint number and position
                html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">`;
                html += `<span style="font-weight:bold; color:#4af;">#${i + 1}</span>`;
                html += `<span style="color:#666; font-size:10px;">(${wp.x}, ${wp.y})</span>`;
                html += `</div>`;

                // Action row: what to do at this waypoint
                html += `<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">`;

                // Action dropdown
                html += `<select id="wpAction${i}" style="font-size:11px; padding:3px; background:#333; border:1px solid #555; color:#fff; border-radius:3px;" onchange="setWaypointAction(${i}, this.value)">`;
                html += `<option value="walk"${action === 'walk' ? ' selected' : ''}>Walk through</option>`;
                html += `<option value="idle"${action === 'idle' ? ' selected' : ''}>Stop & Idle</option>`;
                customAnims.forEach(anim => {
                    html += `<option value="${anim}"${action === anim ? ' selected' : ''}>Stop & ${anim}</option>`;
                });
                html += `</select>`;

                // Duration (only show if not walking through)
                if (action !== 'walk') {
                    html += `<span style="color:#888; font-size:10px;">for</span>`;
                    html += `<input type="number" min="1" max="60" value="${duration || 2}" style="width:40px; padding:3px; font-size:11px; background:#333; border:1px solid #555; color:#fff; border-radius:3px; text-align:center;" onchange="setWaypointDuration(${i}, this.value)">`;
                    html += `<span style="color:#888; font-size:10px;">sec</span>`;
                }

                html += `</div>`;

                // Trigger-prop control (only meaningful on stop waypoints)
                if (action !== 'walk') {
                    html += `<div style="margin-top:6px; padding-top:6px; border-top:1px solid #333;">`;
                    if (wp.triggerProp) {
                        const tc = layers[wp.triggerProp.layer] && layers[wp.triggerProp.layer][wp.triggerProp.y] && layers[wp.triggerProp.layer][wp.triggerProp.y][wp.triggerProp.x];
                        const pd = tc && animatedProps[tc.propIndex];
                        const pname = pd ? pd.name : 'prop (missing)';
                        html += `<span style="color:#fa0; font-size:10px;">⚙ Triggers: ${pname}</span> `;
                        html += `<button onclick="clearWaypointProp(${i})" style="font-size:10px; padding:1px 5px; background:#633; border:1px solid #855; color:#fff; border-radius:3px; cursor:pointer;">✕</button>`;
                    } else {
                        const arming = npcWaypointPropTarget === i;
                        html += `<button onclick="startWaypointPropTarget(${i})" style="font-size:10px; padding:2px 6px; background:${arming ? '#a70' : '#444'}; border:1px solid #666; color:#fff; border-radius:3px; cursor:pointer;">🎯 ${arming ? 'Click prop on map…' : 'Trigger a prop'}</button>`;
                    }
                    html += `</div>`;
                }

                html += `</div>`;
            });
            html += '</div>';
            container.innerHTML = html;
        }

        // ===== NPC waypoint -> interactive prop linking =====
        function startWaypointPropTarget(index) {
            if (selectedPlacedNpcIndex < 0) return;
            npcWaypointPropTarget = index;
            // Make sure we're not in draw/edit path mode (they share the map click)
            npcPathDrawing = false;
            npcPathEditing = false;
            updateNpcWaypointList();
            const info = document.getElementById('npcPathInfo');
            if (info) { info.textContent = 'Click an INTERACTIVE animated prop on the map to link it to this waypoint.'; info.style.color = '#fa0'; }
        }

        function clearWaypointProp(index) {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            if (placed.path && placed.path[index]) {
                delete placed.path[index].triggerProp;
                npcWaypointPropTarget = -1;
                updateNpcWaypointList();
                broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
            }
        }

        // Called by the map-click handler when a prop-link is armed. Returns true if it consumed the click.
        function tryLinkWaypointProp(x, y) {
            if (npcWaypointPropTarget < 0 || selectedPlacedNpcIndex < 0) return false;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            const wp = placed.path && placed.path[npcWaypointPropTarget];
            if (!wp) { npcWaypointPropTarget = -1; return true; }
            const hit = findAnimPropAt(x, y);
            const def = hit && hit.cell ? animatedProps[hit.cell.propIndex] : null;
            const info = document.getElementById('npcPathInfo');
            if (!def || def.type !== 'interactive') {
                if (info) { info.textContent = 'That tile is not an interactive prop. Click an interactive animated prop.'; info.style.color = '#f66'; }
                return true; // stay armed
            }
            wp.triggerProp = { x: hit.x, y: hit.y, layer: hit.layer };
            npcWaypointPropTarget = -1;
            if (info) { info.textContent = 'Linked! NPC will trigger "' + def.name + '" at this waypoint.'; info.style.color = '#4f4'; }
            updateNpcWaypointList();
            broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
            renderMap();
            return true;
        }

        function setWaypointAction(index, action) {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            if (placed.path && placed.path[index]) {
                placed.path[index].animation = action;
                // If switching from walk to an action, set default duration
                if (action !== 'walk' && !placed.path[index].idleTime) {
                    placed.path[index].idleTime = 2; // Default 2 seconds
                }
                // If switching to walk, clear duration
                if (action === 'walk') {
                    placed.path[index].idleTime = 0;
                }
                updateNpcWaypointList(); // Refresh to show/hide duration
                broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
            }
        }

        function setWaypointDuration(index, value) {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            if (placed.path && placed.path[index]) {
                placed.path[index].idleTime = Math.max(1, parseFloat(value) || 2);
                broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
            }
        }

        function setWaypointIdle(index, value) {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            if (placed.path && placed.path[index]) {
                placed.path[index].idleTime = parseFloat(value) || 0;
                broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
            }
        }

        function setWaypointAnim(index, value) {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            if (placed.path && placed.path[index]) {
                placed.path[index].animation = value || '';
                broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
            }
        }

        function updatePlacedNpcList() {
            const container = document.getElementById('placedNpcList');
            const currentMapNpcs = placedNpcs.filter(p => p.mapName === currentMapName);

            if (currentMapNpcs.length === 0) {
                container.innerHTML = 'No NPCs placed on this map';
                return;
            }

            container.innerHTML = '';
            currentMapNpcs.forEach((placed, localIdx) => {
                const globalIdx = placedNpcs.indexOf(placed);
                const npc = npcs[placed.npcIndex];
                const div = document.createElement('div');
                div.style.cssText = 'padding:4px; margin-bottom:3px; background:' +
                    (globalIdx === selectedPlacedNpcIndex ? '#2a5a8a' : '#333') +
                    '; border-radius:3px; cursor:pointer;';
                div.innerHTML = `<strong>${npc ? npc.name : 'Unknown'}</strong> at (${placed.x},${placed.y})` +
                    `<br><span style="font-size:9px; color:#888;">${placed.trigger} | ${placed.path?.length || 0} waypoints</span>`;
                div.onclick = () => selectPlacedNpc(globalIdx);
                container.appendChild(div);
            });
        }

        // ===== NPC PATH PREVIEW =====
        function toggleNpcPathPreview() {
            if (npcPathPreviewActive) {
                stopNpcPathPreview();
            } else {
                startNpcPathPreview();
            }
        }

        function startNpcPathPreview() {
            if (selectedPlacedNpcIndex < 0) return;

            const placed = placedNpcs[selectedPlacedNpcIndex];
            if (!placed.path || placed.path.length === 0) {
                alert('No path to preview. Draw a path first.');
                return;
            }

            npcPathPreviewActive = true;
            npcPreviewState = {
                x: placed.x,
                y: placed.y,
                waypointIndex: 0,
                direction: 'down',
                frame: 0,
                frameTimer: 0,
                idleUntil: 0,  // Timestamp when idle ends
                waypointAnimation: ''  // Current animation at waypoint
            };

            // Update button
            const btn = document.getElementById('npcPreviewPathBtn');
            btn.textContent = 'Edit';
            btn.style.background = '#a55';

            // Start animation loop
            npcPreviewAnimId = requestAnimationFrame(npcPathPreviewLoop);
        }

        function stopNpcPathPreview() {
            npcPathPreviewActive = false;
            if (npcPreviewAnimId) {
                cancelAnimationFrame(npcPreviewAnimId);
                npcPreviewAnimId = null;
            }
            npcPreviewState = null;

            // Update button
            const btn = document.getElementById('npcPreviewPathBtn');
            if (btn) {
                btn.textContent = '▶ Preview';
                btn.style.background = '#47a';
            }

            renderMap();
        }

        let lastPreviewTime = 0;
        function npcPathPreviewLoop(timestamp) {
            if (!npcPathPreviewActive || selectedPlacedNpcIndex < 0) {
                stopNpcPathPreview();
                return;
            }

            const deltaTime = timestamp - lastPreviewTime;
            lastPreviewTime = timestamp;

            const placed = placedNpcs[selectedPlacedNpcIndex];
            const path = placed.path || [];
            const speed = (placed.speed || 3) * 0.05; // Slower for editor preview

            if (path.length === 0) {
                stopNpcPathPreview();
                return;
            }

            // Check if currently idling at a waypoint
            if (npcPreviewState.idleUntil > 0) {
                if (timestamp < npcPreviewState.idleUntil) {
                    // Still idling - just animate, don't move
                    npcPreviewState.frameTimer++;
                    const npc = npcs[placed.npcIndex];
                    const fps = placed.animSpeed || npc?.fps || 8;
                    const animDelay = Math.max(1, Math.round(60 / fps));
                    if (npcPreviewState.frameTimer >= animDelay) {
                        npcPreviewState.frameTimer = 0;
                        npcPreviewState.frame = npcPreviewState.frame + 1; // uncapped; draw uses % anim.length
                    }
                    renderMap();
                    npcPreviewAnimId = requestAnimationFrame(npcPathPreviewLoop);
                    return;
                } else {
                    // Idle complete - advance to next waypoint
                    npcPreviewState.idleUntil = 0;
                    npcPreviewState.waypointAnimation = '';
                    npcPreviewState.waypointIndex++;

                    // Check if path complete
                    if (npcPreviewState.waypointIndex >= path.length) {
                        npcPreviewState.waypointIndex = 0;
                        npcPreviewState.x = placed.x;
                        npcPreviewState.y = placed.y;
                    }
                    renderMap();
                    npcPreviewAnimId = requestAnimationFrame(npcPathPreviewLoop);
                    return;
                }
            }

            // Get target waypoint
            const waypoint = path[npcPreviewState.waypointIndex];
            if (!waypoint) {
                // Loop back to start
                npcPreviewState.waypointIndex = 0;
                npcPreviewState.x = placed.x;
                npcPreviewState.y = placed.y;
                npcPreviewAnimId = requestAnimationFrame(npcPathPreviewLoop);
                return;
            }

            // Move towards waypoint
            const dx = waypoint.x - npcPreviewState.x;
            const dy = waypoint.y - npcPreviewState.y;
            const dist = Math.hypot(dx, dy);

            if (dist < speed) {
                // Reached waypoint
                npcPreviewState.x = waypoint.x;
                npcPreviewState.y = waypoint.y;

                // Check for waypoint action (idle time, animation)
                let idleTime = waypoint.idleTime || 0;
                const wpAnim = waypoint.animation || '';

                // If animation is set but not "walk", ensure minimum idle time
                if (wpAnim && wpAnim !== 'walk' && wpAnim !== '' && idleTime <= 0) {
                    idleTime = 2;
                }

                if (idleTime > 0) {
                    // Start idling at this waypoint
                    npcPreviewState.idleUntil = timestamp + (idleTime * 1000);
                    npcPreviewState.waypointAnimation = wpAnim;
                    // Don't advance waypoint yet
                } else {
                    // No idle - advance immediately
                    npcPreviewState.waypointIndex++;
                    if (npcPreviewState.waypointIndex >= path.length) {
                        npcPreviewState.waypointIndex = 0;
                        npcPreviewState.x = placed.x;
                        npcPreviewState.y = placed.y;
                    }
                }
            } else {
                // Move
                npcPreviewState.x += (dx / dist) * speed;
                npcPreviewState.y += (dy / dist) * speed;

                // Set direction
                if (Math.abs(dx) > Math.abs(dy)) {
                    npcPreviewState.direction = dx > 0 ? 'right' : 'left';
                } else {
                    npcPreviewState.direction = dy > 0 ? 'down' : 'up';
                }
            }

            // Update animation frame
            npcPreviewState.frameTimer++;
            const npc = npcs[placed.npcIndex];
            const fps = placed.animSpeed || npc?.fps || 8;
            const animDelay = Math.max(1, Math.round(60 / fps));
            if (npcPreviewState.frameTimer >= animDelay) {
                npcPreviewState.frameTimer = 0;
                npcPreviewState.frame = npcPreviewState.frame + 1; // uncapped; draw uses % anim.length
            }

            // Render
            renderMap();

            // Continue loop
            npcPreviewAnimId = requestAnimationFrame(npcPathPreviewLoop);
        }

        // ===== ANIMATED PROPS FUNCTIONS =====
        let animPropEditorImage = null;
        let animPropEditorData = null;
        let animPropEditorFrameW = 16;
        let animPropEditorFrameH = 16;
        let animPropEditorEditingIndex = -1;
        let animPropEditorZoom = 3; // Zoom level for sprite sheet
        let animPropTool = 'none'; // 'none', 'collision', 'erase', 'split'
        let animPropCollisionMasks = {}; // Per-frame collision: { frameIndex: 2D array }
        let animPropCollisionFrame = 0; // Which frame we're editing collision for
        let animPropSplitLine = null; // Array of Y values per column (like tileSplitLines)
        let animPropPainting = false;

        function animPropZoomIn() {
            animPropEditorZoom = Math.min(6, animPropEditorZoom + 1);
            document.getElementById('animPropZoomLevel').textContent = animPropEditorZoom + 'x';
            animPropDrawCanvas();
        }

        function animPropZoomOut() {
            animPropEditorZoom = Math.max(1, animPropEditorZoom - 1);
            document.getElementById('animPropZoomLevel').textContent = animPropEditorZoom + 'x';
            animPropDrawCanvas();
        }

        function openAnimPropEditor(editIndex = -1) {
            // Check if someone else is already editing this prop
            if (editIndex >= 0 && isBeingEdited('animProp', editIndex)) {
                const editor = getEditor('animProp', editIndex);
                if (!confirm(`"${editor}" is currently editing this animated prop.\n\nEditing simultaneously may cause conflicts.\n\nOpen anyway?`)) {
                    return;
                }
            }

            // Stop any running preview from previous session
            animPropStopPreview();

            animPropEditorEditingIndex = editIndex;

            // Broadcast that we're editing this prop
            if (editIndex >= 0) {
                startEditing('animProp', editIndex);
            }

            animPropFrames = [];

            // Reset collision/split tool state
            animPropTool = 'none';
            setAnimPropTool('none');

            if (editIndex >= 0 && animatedProps[editIndex]) {
                // Editing existing
                const prop = animatedProps[editIndex];
                animPropEditorFrameW = prop.frameWidth || 16;
                animPropEditorFrameH = prop.frameHeight || 16;
                animPropFrames = JSON.parse(JSON.stringify(prop.frames || []));
                animPropEditorData = prop.spriteData;
                document.getElementById('animPropNameInput').value = prop.name;
                document.getElementById('animPropType').value = prop.type || 'loop';
                const fps = prop.fps || 8;
                document.getElementById('animPropSpeedSlider').value = fps;
                document.getElementById('animPropSpeedLabel').textContent = fps + ' fps';

                // Load existing collision/split data (support both old single-mask and new per-frame format)
                if (prop.collisionMasks) {
                    // New per-frame format
                    animPropCollisionMasks = JSON.parse(JSON.stringify(prop.collisionMasks));
                } else if (prop.collisionMask) {
                    // Convert old single mask to per-frame (apply to all frames)
                    animPropCollisionMasks = {};
                    const numFrames = (prop.frames || []).length || 1;
                    for (let i = 0; i < numFrames; i++) {
                        animPropCollisionMasks[i] = JSON.parse(JSON.stringify(prop.collisionMask));
                    }
                } else {
                    animPropCollisionMasks = {};
                }
                animPropCollisionFrame = 0;
                animPropSplitLine = prop.splitLine ? JSON.parse(JSON.stringify(prop.splitLine)) : null;

                // Load giveItem settings
                document.getElementById('animPropGiveItem').checked = prop.giveItem || false;
                if (prop.type === 'interactive') {
                    document.getElementById('animPropInteractOptions').style.display = 'block';
                    animPropUpdateItemDropdown();
                    if (prop.giveItem) {
                        document.getElementById('animPropItemSection').style.display = 'block';
                        if (prop.giveItemIndex >= 0 && prop.giveItemIndex < items.length) {
                            document.getElementById('animPropItemSelect').value = prop.giveItemIndex;
                        }
                    } else {
                        document.getElementById('animPropItemSection').style.display = 'none';
                    }
                    // Load lock (requires-key) settings
                    const lockIdx = (prop.lockItemIndex !== undefined) ? prop.lockItemIndex : -1;
                    document.getElementById('animPropLock').checked = lockIdx >= 0;
                    document.getElementById('animPropLockSection').style.display = lockIdx >= 0 ? 'block' : 'none';
                    document.getElementById('animPropLockConsume').checked = prop.lockConsume !== false;
                    if (lockIdx >= 0) {
                        animPropUpdateLockDropdown();
                        if (lockIdx < items.length) document.getElementById('animPropLockSelect').value = lockIdx;
                    }
                } else {
                    document.getElementById('animPropInteractOptions').style.display = 'none';
                    document.getElementById('animPropItemSection').style.display = 'none';
                }

                if (prop.spriteData) {
                    animPropEditorImage = new Image();
                    animPropEditorImage.onload = () => {
                        document.getElementById('animPropFrameSection').style.display = 'block';
                        document.getElementById('animPropTypeSection').style.display = 'block';
                        document.getElementById('animPropCollisionSection').style.display = 'block';
                        document.getElementById('animPropNameSection').style.display = 'block';
                        animPropDrawCanvas();
                        animPropUpdateFramesList();
                    };
                    animPropEditorImage.src = prop.spriteData;
                    document.getElementById('animPropFileName').textContent = 'Sprite loaded';
                }
            } else {
                // New prop - default frame size to match grid size
                animPropEditorImage = null;
                animPropEditorData = null;
                animPropEditorFrameW = gridSize;
                animPropEditorFrameH = gridSize;
                animPropCollisionMasks = {};
                animPropCollisionFrame = 0;
                animPropSplitLine = null;
                animPropFrames = []; // Ensure frames list is cleared
                document.getElementById('animPropNameInput').value = '';
                document.getElementById('animPropType').value = 'loop';
                document.getElementById('animPropSpeedSlider').value = 8;
                document.getElementById('animPropSpeedLabel').textContent = '8 fps';
                document.getElementById('animPropFileName').textContent = '';
                document.getElementById('animPropFrameSection').style.display = 'none';
                document.getElementById('animPropTypeSection').style.display = 'none';
                document.getElementById('animPropCollisionSection').style.display = 'none';
                document.getElementById('animPropNameSection').style.display = 'none';
                // Reset give item settings
                document.getElementById('animPropGiveItem').checked = false;
                document.getElementById('animPropInteractOptions').style.display = 'none';
                document.getElementById('animPropItemSection').style.display = 'none';
                // Clear live preview
                const previewCtx = document.getElementById('animPropLivePreview').getContext('2d');
                previewCtx.clearRect(0, 0, 48, 48);
                // Clear editor canvas
                const editorCanvas = document.getElementById('animPropEditorCanvas');
                const editorCtx = editorCanvas.getContext('2d');
                editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
                // Clear frames list display
                const framesList = document.getElementById('animPropFramesList');
                if (framesList) framesList.innerHTML = '';
                // Reset file input
                const fileInput = document.getElementById('animPropFileInput');
                if (fileInput) fileInput.value = '';
            }

            document.getElementById('animPropFrameW').value = animPropEditorFrameW;
            document.getElementById('animPropFrameH').value = animPropEditorFrameH;
            animPropUpdateFramesList();

            document.getElementById('animPropModal').classList.add('visible');
        }

        function animPropLoadSheet(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                animPropEditorData = e.target.result;
                animPropEditorImage = new Image();
                animPropEditorImage.onload = () => {
                    document.getElementById('animPropFileName').textContent = file.name + ' (' + animPropEditorImage.naturalWidth + 'x' + animPropEditorImage.naturalHeight + ')';
                    document.getElementById('animPropFrameSection').style.display = 'block';
                    document.getElementById('animPropTypeSection').style.display = 'block';
                    document.getElementById('animPropCollisionSection').style.display = 'block';
                    document.getElementById('animPropNameSection').style.display = 'block';

                    // Reset collision/split for new sheet
                    animPropCollisionMasks = {};
                    animPropCollisionFrame = 0;
                    animPropSplitLine = null;

                    // Auto-suggest frame size
                    const w = animPropEditorImage.naturalWidth;
                    const h = animPropEditorImage.naturalHeight;
                    const sizes = [16, 32, 24, 48, 64];
                    for (const size of sizes) {
                        if (w % size === 0 && h % size === 0) {
                            animPropEditorFrameW = size;
                            animPropEditorFrameH = size;
                            break;
                        }
                    }
                    document.getElementById('animPropFrameW').value = animPropEditorFrameW;
                    document.getElementById('animPropFrameH').value = animPropEditorFrameH;

                    animPropUpdateGrid();
                    animPropDrawCanvas();
                };
                animPropEditorImage.src = animPropEditorData;
            };
            reader.readAsDataURL(file);
        }

        function animPropUpdateGrid() {
            animPropEditorFrameW = parseInt(document.getElementById('animPropFrameW').value) || 16;
            animPropEditorFrameH = parseInt(document.getElementById('animPropFrameH').value) || 16;

            if (animPropEditorImage) {
                const cols = Math.floor(animPropEditorImage.naturalWidth / animPropEditorFrameW);
                const rows = Math.floor(animPropEditorImage.naturalHeight / animPropEditorFrameH);
                document.getElementById('animPropGridInfo').textContent = cols + ' cols x ' + rows + ' rows';
            }

            animPropDrawCanvas();
        }

        function animPropDrawCanvas() {
            const canvas = document.getElementById('animPropEditorCanvas');
            const ctx = canvas.getContext('2d');

            if (!animPropEditorImage) {
                canvas.width = 400;
                canvas.height = 300;
                ctx.fillStyle = '#222';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#666';
                ctx.font = '16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Load a sprite sheet to begin', 200, 150);
                return;
            }

            const scale = animPropEditorZoom;
            canvas.width = animPropEditorImage.naturalWidth * scale;
            canvas.height = animPropEditorImage.naturalHeight * scale;

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(animPropEditorImage, 0, 0, canvas.width, canvas.height);

            // Draw grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            const cols = Math.floor(animPropEditorImage.naturalWidth / animPropEditorFrameW);
            const rows = Math.floor(animPropEditorImage.naturalHeight / animPropEditorFrameH);

            for (let x = 0; x <= cols; x++) {
                ctx.beginPath();
                ctx.moveTo(x * animPropEditorFrameW * scale, 0);
                ctx.lineTo(x * animPropEditorFrameW * scale, canvas.height);
                ctx.stroke();
            }
            for (let y = 0; y <= rows; y++) {
                ctx.beginPath();
                ctx.moveTo(0, y * animPropEditorFrameH * scale);
                ctx.lineTo(canvas.width, y * animPropEditorFrameH * scale);
                ctx.stroke();
            }

            // Highlight selected frames
            ctx.strokeStyle = '#4af';
            ctx.lineWidth = 3;
            animPropFrames.forEach((frame, i) => {
                ctx.strokeRect(frame.x * scale + 2, frame.y * scale + 2, frame.w * scale - 4, frame.h * scale - 4);
                ctx.fillStyle = '#4af';
                ctx.font = 'bold 14px sans-serif';
                ctx.fillText(i + 1, frame.x * scale + 6, frame.y * scale + 18);
            });

            // Draw current drag selection
            if (animPropIsDragging && animPropDragStart && animPropDragEnd) {
                const startGX = Math.min(animPropDragStart.gridX, animPropDragEnd.gridX);
                const startGY = Math.min(animPropDragStart.gridY, animPropDragEnd.gridY);
                const endGX = Math.max(animPropDragStart.gridX, animPropDragEnd.gridX);
                const endGY = Math.max(animPropDragStart.gridY, animPropDragEnd.gridY);

                const selX = startGX * animPropEditorFrameW * scale;
                const selY = startGY * animPropEditorFrameH * scale;
                const selW = (endGX - startGX + 1) * animPropEditorFrameW * scale;
                const selH = (endGY - startGY + 1) * animPropEditorFrameH * scale;

                ctx.fillStyle = 'rgba(74, 170, 255, 0.3)';
                ctx.fillRect(selX, selY, selW, selH);
                ctx.strokeStyle = '#4af';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(selX, selY, selW, selH);
                ctx.setLineDash([]);
            }

            // Draw collision mask overlay on ALL frames (each frame has its own collision)
            if (animPropFrames.length > 0) {
                animPropFrames.forEach((frame, frameIndex) => {
                    const frameMask = animPropCollisionMasks[frameIndex];
                    if (frameMask) {
                        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                        for (let py = 0; py < frameMask.length; py++) {
                            if (!frameMask[py]) continue;
                            for (let px = 0; px < frameMask[py].length; px++) {
                                if (frameMask[py][px]) {
                                    ctx.fillRect(
                                        (frame.x + px) * scale,
                                        (frame.y + py) * scale,
                                        scale, scale
                                    );
                                }
                            }
                        }
                    }
                });
            }

            // Draw brush preview for collision tool
            if (animPropBrushPreviewPos && (animPropTool === 'collision' || animPropTool === 'erase') && animPropFrames.length > 0) {
                ctx.strokeStyle = animPropTool === 'erase' ? '#ff0' : '#0ff';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);

                const halfBrush = Math.floor(animPropBrushSize / 2);
                const previewX = (animPropBrushPreviewPos.x - halfBrush) * scale;
                const previewY = (animPropBrushPreviewPos.y - halfBrush) * scale;
                const previewSize = animPropBrushSize * scale;

                if (animPropBrushShape === 'square') {
                    ctx.strokeRect(previewX, previewY, previewSize, previewSize);
                } else if (animPropBrushShape === 'circle') {
                    ctx.beginPath();
                    ctx.arc(
                        animPropBrushPreviewPos.x * scale,
                        animPropBrushPreviewPos.y * scale,
                        (animPropBrushSize / 2) * scale,
                        0, Math.PI * 2
                    );
                    ctx.stroke();
                } else if (animPropBrushShape === 'rect') {
                    const rectW = animPropBrushRectW * scale;
                    const rectH = animPropBrushRectH * scale;
                    ctx.strokeRect(
                        (animPropBrushPreviewPos.x - Math.floor(animPropBrushRectW / 2)) * scale,
                        (animPropBrushPreviewPos.y - Math.floor(animPropBrushRectH / 2)) * scale,
                        rectW, rectH
                    );
                }
                ctx.setLineDash([]);
            }

            // Draw split line overlay on EACH frame separately
            if (animPropFrames.length > 0 && animPropSplitLine && typeof animPropSplitLine === 'object') {
                ctx.strokeStyle = '#0ff';
                ctx.lineWidth = 2;
                ctx.font = 'bold ' + Math.max(8, scale * 3) + 'px sans-serif';

                // Draw split lines for each frame
                for (let frameIndex = 0; frameIndex < animPropFrames.length; frameIndex++) {
                    const frame = animPropFrames[frameIndex];
                    const tilesW = Math.ceil(frame.w / gridSize);
                    const tilesH = Math.ceil(frame.h / gridSize);

                    for (let ty = 0; ty < tilesH; ty++) {
                        for (let tx = 0; tx < tilesW; tx++) {
                            // Try new per-frame format first: "frameIndex:tileX,tileY"
                            let key = frameIndex + ':' + tx + ',' + ty;
                            let splitYArray = animPropSplitLine[key];

                            // Fall back to old format: "tileX,tileY" (shared across frames)
                            if (splitYArray === undefined || splitYArray === null) {
                                key = tx + ',' + ty;
                                splitYArray = animPropSplitLine[key];
                            }

                            if (splitYArray === undefined || splitYArray === null) continue;

                            const tileStartX = frame.x + tx * gridSize;
                            const tileStartY = frame.y + ty * gridSize;

                            // Fill canopy region (above split line) with semi-transparent cyan
                            ctx.fillStyle = 'rgba(0, 255, 255, 0.25)';
                            ctx.beginPath();
                            ctx.moveTo(tileStartX * scale, tileStartY * scale);
                            for (let col = 0; col < gridSize; col++) {
                                const splitY = Array.isArray(splitYArray) ? splitYArray[col] : splitYArray;
                                const lineX = (tileStartX + col + 0.5) * scale;
                                const lineY = (tileStartY + splitY) * scale;
                                ctx.lineTo(lineX, lineY);
                            }
                            ctx.lineTo((tileStartX + gridSize) * scale, tileStartY * scale);
                            ctx.closePath();
                            ctx.fill();

                            // Draw freeform split line in cyan
                            ctx.strokeStyle = '#0ff';
                            ctx.lineWidth = 2;
                            ctx.beginPath();
                            for (let col = 0; col < gridSize; col++) {
                                const splitY = Array.isArray(splitYArray) ? splitYArray[col] : splitYArray;
                                const lineX = (tileStartX + col + 0.5) * scale;
                                const lineY = (tileStartY + splitY) * scale;
                                if (col === 0) {
                                    ctx.moveTo(lineX, lineY);
                                } else {
                                    ctx.lineTo(lineX, lineY);
                                }
                            }
                            ctx.stroke();

                            // Calculate average Y for label placement
                            const avgSplitY = Array.isArray(splitYArray)
                                ? splitYArray.reduce((a, b) => a + b, 0) / splitYArray.length
                                : splitYArray;

                            // Draw C (canopy - above line) and T (trunk - below line) labels
                            ctx.fillStyle = '#0ff';
                            ctx.textAlign = 'center';
                            if (avgSplitY > 4) {
                                ctx.fillText('C', (tileStartX + gridSize / 2) * scale, (tileStartY + avgSplitY / 2) * scale + 4);
                            }
                            if (avgSplitY < gridSize - 4) {
                                ctx.fillText('T', (tileStartX + gridSize / 2) * scale, (tileStartY + avgSplitY + (gridSize - avgSplitY) / 2) * scale + 4);
                            }
                        }
                    }
                }
            }
        }

        // Animated prop editor brush size and shape
        let animPropBrushSize = 4;
        let animPropBrushShape = 'square'; // 'square', 'circle', 'rect'
        let animPropBrushRectW = 8;
        let animPropBrushRectH = 4;
        let animPropBrushPreviewPos = null; // { x, y } for brush preview
        let animPropFlatLineY = null; // Y position locked when flat line mode + dragging

        // Tool switching for animated prop editor
        function setAnimPropTool(tool) {
            animPropTool = tool;
            ['None', 'Collision', 'Erase', 'Split'].forEach(t => {
                const btn = document.getElementById('animPropTool' + t);
                if (btn) btn.classList.toggle('active', t.toLowerCase() === tool);
            });

            // Show/hide brush section for collision/erase tools
            const brushSection = document.getElementById('animPropBrushSection');
            if (brushSection) {
                brushSection.style.display = (tool === 'collision' || tool === 'erase') ? 'block' : 'none';
            }

            // Show/hide split controls
            const splitControls = document.getElementById('animPropSplitControls');
            if (splitControls) {
                splitControls.style.display = (tool === 'split') ? 'block' : 'none';
            }
        }

        function setAnimPropBrush(size) {
            animPropBrushSize = size;
            [1, 2, 4, 8].forEach(s => {
                const btn = document.getElementById('animPropBrush' + s);
                if (btn) btn.classList.toggle('active', s === size);
            });
        }

        function setAnimPropBrushShape(shape) {
            animPropBrushShape = shape;
            ['square', 'circle', 'rect'].forEach(s => {
                const btn = document.getElementById('animPropShape' + s.charAt(0).toUpperCase() + s.slice(1));
                if (btn) btn.classList.toggle('active', s === shape);
            });
            // Show/hide size row vs rect size row
            const sizeRow = document.getElementById('animPropBrushSizeRow');
            const rectRow = document.getElementById('animPropRectSizeRow');
            if (sizeRow) sizeRow.style.display = (shape === 'rect') ? 'none' : 'block';
            if (rectRow) rectRow.style.display = (shape === 'rect') ? 'block' : 'none';
        }

        function updateAnimPropRectSize() {
            animPropBrushRectW = parseInt(document.getElementById('animPropRectW').value) || 8;
            animPropBrushRectH = parseInt(document.getElementById('animPropRectH').value) || 4;
        }

        function setAnimPropCollisionFrame(frameIdx) {
            animPropCollisionFrame = parseInt(frameIdx) || 0;
            animPropDrawCanvas();
        }

        function updateAnimPropCollisionFrameDropdown() {
            const select = document.getElementById('animPropCollisionFrameSelect');
            if (!select) return;
            select.innerHTML = '';
            animPropFrames.forEach((frame, i) => {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = 'Frame ' + (i + 1);
                if (i === animPropCollisionFrame) opt.selected = true;
                select.appendChild(opt);
            });
            // Ensure current frame is valid
            if (animPropCollisionFrame >= animPropFrames.length) {
                animPropCollisionFrame = Math.max(0, animPropFrames.length - 1);
            }
        }

        function copyCollisionToAllFrames() {
            if (animPropFrames.length === 0) return;
            const sourceMask = animPropCollisionMasks[animPropCollisionFrame];
            if (!sourceMask) {
                alert('No collision on current frame to copy');
                return;
            }
            // Copy to all other frames
            for (let i = 0; i < animPropFrames.length; i++) {
                if (i !== animPropCollisionFrame) {
                    animPropCollisionMasks[i] = JSON.parse(JSON.stringify(sourceMask));
                }
            }
            animPropDrawCanvas();
            console.log('[ANIM PROP] Copied collision from frame', animPropCollisionFrame + 1, 'to all frames');
        }

        function setAnimPropSplitY() {
            const yVal = parseInt(document.getElementById('animPropSplitY').value) || 8;
            if (animPropFrames.length === 0) return;

            // Initialize split lines object if needed
            if (!animPropSplitLine || typeof animPropSplitLine !== 'object' || Array.isArray(animPropSplitLine)) {
                animPropSplitLine = {};
            }

            const clampedY = Math.max(0, Math.min(gridSize, yVal));

            // Set same Y for all tiles in ALL frames (flat line = array filled with same value)
            for (let frameIndex = 0; frameIndex < animPropFrames.length; frameIndex++) {
                const frame = animPropFrames[frameIndex];
                const tilesW = Math.ceil(frame.w / gridSize);
                const tilesH = Math.ceil(frame.h / gridSize);

                for (let ty = 0; ty < tilesH; ty++) {
                    for (let tx = 0; tx < tilesW; tx++) {
                        const key = frameIndex + ':' + tx + ',' + ty;
                        animPropSplitLine[key] = new Array(gridSize).fill(clampedY);
                    }
                }
            }
            animPropDrawCanvas();
        }

        function clearAnimPropSplit() {
            animPropSplitLine = null;
            animPropDrawCanvas();
        }

        // Collision/split painting helpers
        function animPropPaintCollision(px, py, erase) {
            if (animPropFrames.length === 0) return;

            // Find which frame was clicked - paint directly on that frame
            let clickedFrameIndex = -1;
            let clickedFrame = null;
            for (let i = 0; i < animPropFrames.length; i++) {
                const frame = animPropFrames[i];
                if (px >= frame.x && px < frame.x + frame.w &&
                    py >= frame.y && py < frame.y + frame.h) {
                    clickedFrameIndex = i;
                    clickedFrame = frame;
                    break;
                }
            }
            if (!clickedFrame || clickedFrameIndex < 0) return;

            // Use first frame dimensions for mask size (all frames share same size)
            const frame0 = animPropFrames[0];

            // Initialize mask for clicked frame if needed
            if (!animPropCollisionMasks[clickedFrameIndex]) {
                animPropCollisionMasks[clickedFrameIndex] = [];
                for (let y = 0; y < frame0.h; y++) {
                    animPropCollisionMasks[clickedFrameIndex][y] = new Array(frame0.w).fill(false);
                }
            }
            const mask = animPropCollisionMasks[clickedFrameIndex];

            // Calculate position relative to clicked frame
            const localX = px - clickedFrame.x;
            const localY = py - clickedFrame.y;

            if (localX < 0 || localX >= frame0.w || localY < 0 || localY >= frame0.h) return;

            // Paint based on brush shape
            if (animPropBrushShape === 'square') {
                const halfBrush = Math.floor(animPropBrushSize / 2);
                for (let dy = -halfBrush; dy < animPropBrushSize - halfBrush; dy++) {
                    for (let dx = -halfBrush; dx < animPropBrushSize - halfBrush; dx++) {
                        const bx = localX + dx;
                        const by = localY + dy;
                        if (bx >= 0 && bx < frame0.w && by >= 0 && by < frame0.h) {
                            if (!mask[by]) mask[by] = [];
                            mask[by][bx] = !erase;
                        }
                    }
                }
            } else if (animPropBrushShape === 'circle') {
                const radius = animPropBrushSize / 2;
                const radiusSq = radius * radius;
                for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
                    for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
                        if (dx * dx + dy * dy <= radiusSq) {
                            const bx = localX + dx;
                            const by = localY + dy;
                            if (bx >= 0 && bx < frame0.w && by >= 0 && by < frame0.h) {
                                if (!mask[by]) mask[by] = [];
                                mask[by][bx] = !erase;
                            }
                        }
                    }
                }
            } else if (animPropBrushShape === 'rect') {
                const halfW = Math.floor(animPropBrushRectW / 2);
                const halfH = Math.floor(animPropBrushRectH / 2);
                for (let dy = -halfH; dy < animPropBrushRectH - halfH; dy++) {
                    for (let dx = -halfW; dx < animPropBrushRectW - halfW; dx++) {
                        const bx = localX + dx;
                        const by = localY + dy;
                        if (bx >= 0 && bx < frame0.w && by >= 0 && by < frame0.h) {
                            if (!mask[by]) mask[by] = [];
                            mask[by][bx] = !erase;
                        }
                    }
                }
            }
        }

        function animPropPaintSplit(px, py, isStart = false) {
            if (animPropFrames.length === 0) return;

            // Find which frame was clicked
            let clickedFrameIndex = -1;
            let clickedFrame = null;
            for (let i = 0; i < animPropFrames.length; i++) {
                const frame = animPropFrames[i];
                if (px >= frame.x && px < frame.x + frame.w &&
                    py >= frame.y && py < frame.y + frame.h) {
                    clickedFrameIndex = i;
                    clickedFrame = frame;
                    break;
                }
            }
            if (!clickedFrame) return;

            // Calculate which tile within the frame was clicked
            const localX = px - clickedFrame.x;
            const localY = py - clickedFrame.y;

            const tileX = Math.floor(localX / gridSize);
            const tileY = Math.floor(localY / gridSize);

            // Position within the tile
            const tileLocalX = localX - (tileX * gridSize);
            const tileLocalY = localY - (tileY * gridSize);

            // Clamp Y value
            let clampedY = Math.round(tileLocalY);
            if (tileLocalY >= gridSize - 2) clampedY = gridSize;
            clampedY = Math.max(0, Math.min(gridSize, clampedY));

            // Clamp X for column index
            const clampedX = Math.max(0, Math.min(gridSize - 1, Math.floor(tileLocalX)));

            // Check flat line mode
            const flatLineCheckbox = document.getElementById('animPropFlatLine');
            const flatLineMode = flatLineCheckbox && flatLineCheckbox.checked;

            // Initialize split lines object if needed
            if (!animPropSplitLine || typeof animPropSplitLine !== 'object' || Array.isArray(animPropSplitLine)) {
                animPropSplitLine = {};
            }

            // Key format: "frameIndex:tileX,tileY" for per-frame splits
            const key = clickedFrameIndex + ':' + tileX + ',' + tileY;

            if (flatLineMode) {
                // Flat line mode: set entire tile to same Y value
                if (isStart) {
                    animPropFlatLineY = clampedY;
                }
                const yVal = (animPropFlatLineY !== null) ? animPropFlatLineY : clampedY;
                animPropSplitLine[key] = new Array(gridSize).fill(yVal);
            } else {
                // Freeform mode: initialize array if needed, then set this column
                if (!animPropSplitLine[key] || !Array.isArray(animPropSplitLine[key])) {
                    const defaultY = Math.floor(gridSize / 2);
                    animPropSplitLine[key] = new Array(gridSize).fill(defaultY);
                }
                animPropSplitLine[key][clampedX] = clampedY;
            }
        }

        // Canvas drag handlers for animated prop editor (multi-tile selection)
        document.getElementById('animPropEditorCanvas').addEventListener('mousedown', function(e) {
            if (!animPropEditorImage) return;

            const rect = this.getBoundingClientRect();
            const scale = animPropEditorZoom;
            const clickX = (e.clientX - rect.left) / scale;
            const clickY = (e.clientY - rect.top) / scale;

            if (animPropTool === 'collision' || animPropTool === 'erase') {
                animPropPainting = true;
                animPropPaintCollision(Math.floor(clickX), Math.floor(clickY), animPropTool === 'erase');
                animPropDrawCanvas();
            } else if (animPropTool === 'split') {
                animPropPainting = true;
                animPropPaintSplit(Math.floor(clickX), Math.floor(clickY), true); // isStart = true
                animPropDrawCanvas();
            } else {
                // Frame selection mode
                const gridX = Math.floor(clickX / animPropEditorFrameW);
                const gridY = Math.floor(clickY / animPropEditorFrameH);

                animPropDragStart = { gridX, gridY };
                animPropDragEnd = { gridX, gridY };
                animPropIsDragging = true;
                animPropDrawCanvas();
            }
        });

        document.getElementById('animPropEditorCanvas').addEventListener('mousemove', function(e) {
            if (!animPropEditorImage) return;

            const rect = this.getBoundingClientRect();
            const scale = animPropEditorZoom;
            const clickX = (e.clientX - rect.left) / scale;
            const clickY = (e.clientY - rect.top) / scale;

            // Update brush preview position for collision/erase tools
            if (animPropTool === 'collision' || animPropTool === 'erase') {
                // Find which frame we're over
                let overFrame = null;
                for (const frame of animPropFrames) {
                    if (clickX >= frame.x && clickX < frame.x + frame.w &&
                        clickY >= frame.y && clickY < frame.y + frame.h) {
                        overFrame = frame;
                        break;
                    }
                }
                if (overFrame) {
                    animPropBrushPreviewPos = { x: Math.floor(clickX), y: Math.floor(clickY) };
                } else {
                    animPropBrushPreviewPos = null;
                }
            } else {
                animPropBrushPreviewPos = null;
            }

            if (animPropPainting) {
                if (animPropTool === 'collision' || animPropTool === 'erase') {
                    animPropPaintCollision(Math.floor(clickX), Math.floor(clickY), animPropTool === 'erase');
                    animPropDrawCanvas();
                } else if (animPropTool === 'split') {
                    animPropPaintSplit(Math.floor(clickX), Math.floor(clickY));
                    animPropDrawCanvas();
                }
            } else if (animPropIsDragging) {
                const cols = Math.floor(animPropEditorImage.naturalWidth / animPropEditorFrameW);
                const rows = Math.floor(animPropEditorImage.naturalHeight / animPropEditorFrameH);

                const gridX = Math.max(0, Math.min(cols - 1, Math.floor(clickX / animPropEditorFrameW)));
                const gridY = Math.max(0, Math.min(rows - 1, Math.floor(clickY / animPropEditorFrameH)));

                animPropDragEnd = { gridX, gridY };
                animPropDrawCanvas();
            } else {
                // Redraw to show brush preview
                animPropDrawCanvas();
            }
        });

        document.getElementById('animPropEditorCanvas').addEventListener('mouseup', function(e) {
            if (!animPropEditorImage) return;

            if (animPropPainting) {
                animPropPainting = false;
                animPropFlatLineY = null; // Reset flat line Y lock
                return;
            }

            if (!animPropIsDragging) return;
            animPropIsDragging = false;

            // Calculate selection rectangle
            const startGX = Math.min(animPropDragStart.gridX, animPropDragEnd.gridX);
            const startGY = Math.min(animPropDragStart.gridY, animPropDragEnd.gridY);
            const endGX = Math.max(animPropDragStart.gridX, animPropDragEnd.gridX);
            const endGY = Math.max(animPropDragStart.gridY, animPropDragEnd.gridY);

            const frameX = startGX * animPropEditorFrameW;
            const frameY = startGY * animPropEditorFrameH;
            const frameW = (endGX - startGX + 1) * animPropEditorFrameW;
            const frameH = (endGY - startGY + 1) * animPropEditorFrameH;

            if (frameX >= animPropEditorImage.naturalWidth || frameY >= animPropEditorImage.naturalHeight) return;

            animPropFrames.push({
                x: frameX,
                y: frameY,
                w: frameW,
                h: frameH
            });

            animPropDragStart = null;
            animPropDragEnd = null;
            animPropDrawCanvas();
            animPropUpdateFramesList();
        });

        document.getElementById('animPropEditorCanvas').addEventListener('mouseleave', function(e) {
            animPropPainting = false;
            animPropFlatLineY = null; // Reset flat line Y lock
            animPropBrushPreviewPos = null; // Clear brush preview
            if (animPropIsDragging) {
                animPropIsDragging = false;
                animPropDragStart = null;
                animPropDragEnd = null;
            }
            animPropDrawCanvas();
        });

        function animPropUpdateFramesList() {
            const container = document.getElementById('animPropFramesList');
            container.innerHTML = '';
            document.getElementById('animPropFrameCount').textContent = animPropFrames.length;

            // Update collision frame dropdown when frames change
            updateAnimPropCollisionFrameDropdown();

            if (animPropFrames.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:11px;">Click or drag on sprite sheet to select frames</div>';
                animPropStopPreview();
                // Clear live preview
                const previewCtx = document.getElementById('animPropLivePreview').getContext('2d');
                previewCtx.clearRect(0, 0, 48, 48);
                return;
            }

            animPropFrames.forEach((frame, i) => {
                const thumb = document.createElement('div');
                thumb.className = 'anim-frame-thumb';

                const canvas = document.createElement('canvas');
                canvas.width = 48;
                canvas.height = 48;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;

                const scale = Math.min(48 / frame.w, 48 / frame.h);
                const drawW = frame.w * scale;
                const drawH = frame.h * scale;
                const drawX = (48 - drawW) / 2;
                const drawY = (48 - drawH) / 2;

                ctx.drawImage(animPropEditorImage, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);

                const num = document.createElement('span');
                num.className = 'frame-num';
                num.textContent = i + 1;

                thumb.appendChild(canvas);
                thumb.appendChild(num);
                thumb.onclick = () => {
                    animPropFrames.splice(i, 1);
                    animPropUpdateFramesList();
                    animPropDrawCanvas();
                };
                thumb.title = 'Click to remove';

                container.appendChild(thumb);
            });

            // Auto-start live preview when frames exist
            animPropStartLivePreview();
        }

        function animPropClearFrames() {
            if (!confirm('Clear all frames?')) return;
            animPropFrames = [];
            animPropUpdateFramesList();
            animPropDrawCanvas();
        }

        // Live animation preview - starts automatically when frames are added
        function animPropStartLivePreview() {
            if (animPropPreviewInterval) return; // Already running
            if (animPropFrames.length === 0) return;

            animPropPreviewFrame = 0;
            const fps = parseInt(document.getElementById('animPropSpeedSlider').value) || 8;

            animPropPreviewInterval = setInterval(() => {
                animPropPreviewFrame = (animPropPreviewFrame + 1) % animPropFrames.length;
                animPropDrawLivePreview();

                // Highlight current frame in list
                const thumbs = document.querySelectorAll('.anim-frame-thumb');
                thumbs.forEach((t, i) => {
                    t.style.borderColor = i === animPropPreviewFrame ? '#0f0' : '#4af';
                });
            }, 1000 / fps);
        }

        function animPropStopPreview() {
            if (animPropPreviewInterval) {
                clearInterval(animPropPreviewInterval);
                animPropPreviewInterval = null;
            }
            const thumbs = document.querySelectorAll('.anim-frame-thumb');
            thumbs.forEach(t => t.style.borderColor = '#4af');
        }

        function animPropDrawLivePreview() {
            const canvas = document.getElementById('animPropLivePreview');
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 48, 48);

            if (!animPropEditorImage || animPropFrames.length === 0) return;

            const frame = animPropFrames[animPropPreviewFrame];
            if (!frame) return;

            ctx.imageSmoothingEnabled = false;
            // Scale to fit 48x48 preview
            const scale = Math.min(48 / frame.w, 48 / frame.h);
            const drawW = frame.w * scale;
            const drawH = frame.h * scale;
            const drawX = (48 - drawW) / 2;
            const drawY = (48 - drawH) / 2;
            ctx.drawImage(animPropEditorImage, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
        }

        function animPropUpdateSpeed() {
            const fps = parseInt(document.getElementById('animPropSpeedSlider').value) || 8;
            document.getElementById('animPropSpeedLabel').textContent = fps + ' fps';
            document.getElementById('animPropSpeed').value = fps; // Sync with hidden input

            // Restart preview with new speed
            if (animPropPreviewInterval) {
                animPropStopPreview();
                animPropStartLivePreview();
            }
        }


        function animPropTypeChanged() {
            const type = document.getElementById('animPropType').value;
            const interactOptions = document.getElementById('animPropInteractOptions');
            if (type === 'interactive') {
                interactOptions.style.display = 'block';
                animPropUpdateItemDropdown();
            } else {
                interactOptions.style.display = 'none';
            }
        }

        function animPropGiveItemChanged() {
            const giveItem = document.getElementById('animPropGiveItem').checked;
            document.getElementById('animPropItemSection').style.display = giveItem ? 'block' : 'none';
            if (giveItem) {
                animPropUpdateItemDropdown();
            }
        }

        function animPropUpdateItemDropdown() {
            const select = document.getElementById('animPropItemSelect');
            const currentValue = select.value;
            select.innerHTML = '';

            if (items.length === 0) {
                const opt = document.createElement('option');
                opt.value = '-1';
                opt.textContent = '-- No items defined (create in Items tab) --';
                select.appendChild(opt);
            } else {
                items.forEach((item, i) => {
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.textContent = item.name || ('Item ' + (i + 1));
                    select.appendChild(opt);
                });
            }

            // Restore previous selection if valid
            if (currentValue && parseInt(currentValue) >= 0 && parseInt(currentValue) < items.length) {
                select.value = currentValue;
            }
        }

        function animPropLockChanged() {
            const locked = document.getElementById('animPropLock').checked;
            document.getElementById('animPropLockSection').style.display = locked ? 'block' : 'none';
            if (locked) animPropUpdateLockDropdown();
        }

        function animPropUpdateLockDropdown() {
            const select = document.getElementById('animPropLockSelect');
            const currentValue = select.value;
            select.innerHTML = '';
            if (items.length === 0) {
                const opt = document.createElement('option');
                opt.value = '-1';
                opt.textContent = '-- No items defined (create in Items tab) --';
                select.appendChild(opt);
            } else {
                items.forEach((item, i) => {
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.textContent = item.name || ('Item ' + (i + 1));
                    select.appendChild(opt);
                });
            }
            if (currentValue && parseInt(currentValue) >= 0 && parseInt(currentValue) < items.length) {
                select.value = currentValue;
            }
        }

        function animPropSave() {
            const name = document.getElementById('animPropNameInput').value.trim();
            if (!name) {
                alert('Please enter a name for the prop');
                return;
            }

            if (!animPropEditorImage) {
                alert('Please load a sprite sheet first');
                return;
            }

            if (animPropFrames.length === 0) {
                alert('Please add at least one frame');
                return;
            }

            const propType = document.getElementById('animPropType').value;
            const giveItem = document.getElementById('animPropGiveItem').checked;
            const giveItemIndex = giveItem ? parseInt(document.getElementById('animPropItemSelect').value) : -1;
            const lockOn = document.getElementById('animPropLock').checked;
            const lockItemIndex = lockOn ? parseInt(document.getElementById('animPropLockSelect').value) : -1;
            const lockConsume = document.getElementById('animPropLockConsume').checked;

            const propData = {
                name: name,
                spriteData: animPropEditorData,
                frameWidth: animPropEditorFrameW,
                frameHeight: animPropEditorFrameH,
                frames: [...animPropFrames],
                type: propType,
                fps: parseInt(document.getElementById('animPropSpeedSlider').value) || 8,
                collisionMasks: Object.keys(animPropCollisionMasks).length > 0 ? JSON.parse(JSON.stringify(animPropCollisionMasks)) : null,
                splitLine: animPropSplitLine ? JSON.parse(JSON.stringify(animPropSplitLine)) : null,
                giveItem: giveItem,
                giveItemIndex: giveItemIndex,
                lockItemIndex: lockItemIndex,
                lockConsume: lockConsume,
                _spriteImg: animPropEditorImage // Store the loaded image
            };

            if (animPropEditorEditingIndex >= 0) {
                animatedProps[animPropEditorEditingIndex] = propData;
                // Sync prop update (exclude non-serializable _spriteImg)
                const syncProp = { ...propData };
                delete syncProp._spriteImg;
                broadcastEdit({ editType: 'updateAnimProp', index: animPropEditorEditingIndex, prop: syncProp });
            } else {
                animatedProps.push(propData);
                currentAnimPropIndex = animatedProps.length - 1; // Select the new prop
                // Sync new prop (exclude non-serializable _spriteImg)
                const syncProp = { ...propData };
                delete syncProp._spriteImg;
                broadcastEdit({ editType: 'addAnimProp', prop: syncProp });
            }

            animPropStopPreview();
            document.getElementById('animPropModal').classList.remove('visible');
            stopEditing(); // Clear editing lock
            updateAnimPropListDisplay();
            renderMap();
        }

        function animPropCancel() {
            animPropStopPreview();
            document.getElementById('animPropModal').classList.remove('visible');
            stopEditing(); // Clear editing lock
        }

        // ========== ITEM EDITOR FUNCTIONS ==========
        let itemEditorImage = null;
        let itemEditorData = null;
        let itemEditorFrameW = 16;
        let itemEditorFrameH = 16;
        let itemEditorEditingIndex = -1;
        let itemEditorZoom = 3;

        function openItemEditor(editIndex = -1) {
            // Check if someone else is already editing this item
            if (editIndex >= 0 && isBeingEdited('item', editIndex)) {
                const editor = getEditor('item', editIndex);
                if (!confirm(`"${editor}" is currently editing this item.\n\nEditing simultaneously may cause conflicts.\n\nOpen anyway?`)) {
                    return;
                }
            }

            itemStopPreview();
            itemEditorEditingIndex = editIndex;

            // Broadcast that we're editing this item
            if (editIndex >= 0) {
                startEditing('item', editIndex);
            }

            itemFrames = [];

            if (editIndex >= 0 && items[editIndex]) {
                const item = items[editIndex];
                itemEditorFrameW = item.frameWidth || 16;
                itemEditorFrameH = item.frameHeight || 16;
                itemFrames = JSON.parse(JSON.stringify(item.frames || []));
                itemEditorData = item.spriteData;
                document.getElementById('itemNameInput').value = item.name;
                const fps = item.fps || 8;
                document.getElementById('itemSpeedSlider').value = fps;
                document.getElementById('itemSpeedLabel').textContent = fps + ' fps';

                if (item.spriteData) {
                    itemEditorImage = new Image();
                    itemEditorImage.onload = () => {
                        document.getElementById('itemFrameSection').style.display = 'block';
                        document.getElementById('itemIdleSection').style.display = 'block';
                        document.getElementById('itemNameSection').style.display = 'block';
                        document.getElementById('itemStackSection').style.display = 'block';
                        document.getElementById('itemBehaviorSection').style.display = 'block';
                        itemDrawCanvas();
                        itemUpdateFramesList();
                        itemUpdateIdleDropdown();
                        document.getElementById('itemIdleFrame').value = item.idleFrame || 0;
                        document.getElementById('itemMaxStack').value = item.maxStack || 99;
                        loadItemBehaviorFields(item);
                    };
                    itemEditorImage.src = item.spriteData;
                    document.getElementById('itemFileName').textContent = 'Sprite loaded';
                }
            } else {
                itemEditorImage = null;
                itemEditorData = null;
                itemEditorFrameW = gridSize;
                itemEditorFrameH = gridSize;
                itemFrames = [];
                document.getElementById('itemNameInput').value = '';
                document.getElementById('itemSpeedSlider').value = 8;
                document.getElementById('itemSpeedLabel').textContent = '8 fps';
                document.getElementById('itemFileName').textContent = '';
                document.getElementById('itemFrameSection').style.display = 'none';
                document.getElementById('itemIdleSection').style.display = 'none';
                document.getElementById('itemNameSection').style.display = 'none';
                document.getElementById('itemStackSection').style.display = 'none';
                document.getElementById('itemMaxStack').value = 99;
                document.getElementById('itemBehaviorSection').style.display = 'none';
                resetItemBehaviorFields();
                const previewCtx = document.getElementById('itemLivePreview').getContext('2d');
                previewCtx.clearRect(0, 0, 48, 48);
                const editorCanvas = document.getElementById('itemEditorCanvas');
                const editorCtx = editorCanvas.getContext('2d');
                editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
                const framesList = document.getElementById('itemFramesList');
                if (framesList) framesList.innerHTML = '';
                const fileInput = document.getElementById('itemFileInput');
                if (fileInput) fileInput.value = '';
            }

            document.getElementById('itemFrameW').value = itemEditorFrameW;
            document.getElementById('itemFrameH').value = itemEditorFrameH;
            itemUpdateFramesList();

            document.getElementById('itemModal').classList.add('visible');
        }

        function itemLoadSheet(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                itemEditorData = e.target.result;
                itemEditorImage = new Image();
                itemEditorImage.onload = () => {
                    document.getElementById('itemFileName').textContent = file.name + ' (' + itemEditorImage.naturalWidth + 'x' + itemEditorImage.naturalHeight + ')';
                    document.getElementById('itemFrameSection').style.display = 'block';
                    document.getElementById('itemIdleSection').style.display = 'block';
                    document.getElementById('itemNameSection').style.display = 'block';
                    document.getElementById('itemStackSection').style.display = 'block';
                    document.getElementById('itemBehaviorSection').style.display = 'block';

                    // Auto-suggest frame size
                    const w = itemEditorImage.naturalWidth;
                    const h = itemEditorImage.naturalHeight;
                    const sizes = [16, 32, 24, 48, 64];
                    for (const size of sizes) {
                        if (w % size === 0 && h % size === 0) {
                            itemEditorFrameW = size;
                            itemEditorFrameH = size;
                            break;
                        }
                    }
                    document.getElementById('itemFrameW').value = itemEditorFrameW;
                    document.getElementById('itemFrameH').value = itemEditorFrameH;

                    itemUpdateGrid();
                    itemDrawCanvas();
                };
                itemEditorImage.src = itemEditorData;
            };
            reader.readAsDataURL(file);
        }

        function itemUpdateGrid() {
            itemEditorFrameW = parseInt(document.getElementById('itemFrameW').value) || 16;
            itemEditorFrameH = parseInt(document.getElementById('itemFrameH').value) || 16;

            if (itemEditorImage) {
                const cols = Math.floor(itemEditorImage.naturalWidth / itemEditorFrameW);
                const rows = Math.floor(itemEditorImage.naturalHeight / itemEditorFrameH);
                document.getElementById('itemGridInfo').textContent = cols + ' cols x ' + rows + ' rows';
            }

            itemDrawCanvas();
        }

        function itemDrawCanvas() {
            const canvas = document.getElementById('itemEditorCanvas');
            const ctx = canvas.getContext('2d');

            if (!itemEditorImage) {
                canvas.width = 400;
                canvas.height = 300;
                ctx.fillStyle = '#222';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#666';
                ctx.font = '16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Load a sprite sheet to begin', 200, 150);
                return;
            }

            const scale = itemEditorZoom;
            canvas.width = itemEditorImage.naturalWidth * scale;
            canvas.height = itemEditorImage.naturalHeight * scale;

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(itemEditorImage, 0, 0, canvas.width, canvas.height);

            // Draw grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            const cols = Math.floor(itemEditorImage.naturalWidth / itemEditorFrameW);
            const rows = Math.floor(itemEditorImage.naturalHeight / itemEditorFrameH);

            for (let x = 0; x <= cols; x++) {
                ctx.beginPath();
                ctx.moveTo(x * itemEditorFrameW * scale, 0);
                ctx.lineTo(x * itemEditorFrameW * scale, canvas.height);
                ctx.stroke();
            }
            for (let y = 0; y <= rows; y++) {
                ctx.beginPath();
                ctx.moveTo(0, y * itemEditorFrameH * scale);
                ctx.lineTo(canvas.width, y * itemEditorFrameH * scale);
                ctx.stroke();
            }

            // Highlight selected frames
            ctx.strokeStyle = '#4f8';
            ctx.lineWidth = 3;
            itemFrames.forEach((frame, i) => {
                ctx.strokeRect(frame.x * scale + 2, frame.y * scale + 2, frame.w * scale - 4, frame.h * scale - 4);
                ctx.fillStyle = '#4f8';
                ctx.font = 'bold 14px sans-serif';
                ctx.fillText(i + 1, frame.x * scale + 6, frame.y * scale + 18);
            });

            // Draw drag selection box
            if (itemIsDragging && itemDragStart && itemDragEnd) {
                const startGX = Math.min(itemDragStart.gridX, itemDragEnd.gridX);
                const startGY = Math.min(itemDragStart.gridY, itemDragEnd.gridY);
                const endGX = Math.max(itemDragStart.gridX, itemDragEnd.gridX);
                const endGY = Math.max(itemDragStart.gridY, itemDragEnd.gridY);

                const selX = startGX * itemEditorFrameW * scale;
                const selY = startGY * itemEditorFrameH * scale;
                const selW = (endGX - startGX + 1) * itemEditorFrameW * scale;
                const selH = (endGY - startGY + 1) * itemEditorFrameH * scale;

                ctx.fillStyle = 'rgba(255, 200, 0, 0.3)';
                ctx.fillRect(selX, selY, selW, selH);
                ctx.strokeStyle = '#fc0';
                ctx.lineWidth = 3;
                ctx.strokeRect(selX, selY, selW, selH);
            }
        }

        // Legacy single-click handler (kept for backwards compat, but drag is preferred)
        function itemCanvasClick(e) {
            if (!itemEditorImage) return;
            const canvas = document.getElementById('itemEditorCanvas');
            const rect = canvas.getBoundingClientRect();
            const scale = itemEditorZoom;
            const x = Math.floor((e.clientX - rect.left) / (itemEditorFrameW * scale));
            const y = Math.floor((e.clientY - rect.top) / (itemEditorFrameH * scale));

            const frameX = x * itemEditorFrameW;
            const frameY = y * itemEditorFrameH;

            // Check if already selected
            const existingIdx = itemFrames.findIndex(f => f.x === frameX && f.y === frameY);
            if (existingIdx >= 0) {
                itemFrames.splice(existingIdx, 1);
            } else {
                itemFrames.push({ x: frameX, y: frameY, w: itemEditorFrameW, h: itemEditorFrameH });
            }

            itemDrawCanvas();
            itemUpdateFramesList();
            itemUpdateIdleDropdown();
            itemStartPreview();
        }

        function itemUpdateFramesList() {
            const container = document.getElementById('itemFramesList');
            const countEl = document.getElementById('itemFrameCount');
            if (!container) return;
            container.innerHTML = '';
            countEl.textContent = itemFrames.length;

            if (!itemEditorImage || itemFrames.length === 0) {
                container.innerHTML = '<span style="color:#666; font-size:11px;">Click frames on the sprite sheet</span>';
                return;
            }

            itemFrames.forEach((frame, i) => {
                const frameEl = document.createElement('div');
                frameEl.className = 'anim-frame-item';
                frameEl.innerHTML = `
                    <canvas width="32" height="32" style="border:1px solid #555; image-rendering:pixelated;"></canvas>
                    <span style="font-size:10px; color:#888;">${i + 1}</span>
                `;
                const canvas = frameEl.querySelector('canvas');
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(itemEditorImage, frame.x, frame.y, frame.w, frame.h, 0, 0, 32, 32);
                container.appendChild(frameEl);
            });
        }

        function itemUpdateIdleDropdown() {
            const select = document.getElementById('itemIdleFrame');
            if (!select) return;
            select.innerHTML = '';
            itemFrames.forEach((_, i) => {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = 'Frame ' + (i + 1) + (i === 0 ? ' (first)' : '');
                select.appendChild(opt);
            });
        }

        function itemClearFrames() {
            itemFrames = [];
            itemDrawCanvas();
            itemUpdateFramesList();
            itemUpdateIdleDropdown();
            itemStopPreview();
        }

        function itemStartPreview() {
            itemStopPreview();
            if (itemFrames.length === 0 || !itemEditorImage) return;
            const fps = parseInt(document.getElementById('itemSpeedSlider').value) || 8;
            itemPreviewPlaying = true;
            itemPreviewFrame = 0;
            itemPreviewInterval = setInterval(() => {
                itemPreviewFrame = (itemPreviewFrame + 1) % itemFrames.length;
                itemDrawPreviewFrame();
            }, 1000 / fps);
            itemDrawPreviewFrame();
        }

        function itemStopPreview() {
            if (itemPreviewInterval) {
                clearInterval(itemPreviewInterval);
                itemPreviewInterval = null;
            }
            itemPreviewPlaying = false;
        }

        function itemDrawPreviewFrame() {
            const canvas = document.getElementById('itemLivePreview');
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 48, 48);
            if (!itemEditorImage || itemFrames.length === 0) return;
            const frame = itemFrames[itemPreviewFrame];
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(itemEditorImage, frame.x, frame.y, frame.w, frame.h, 0, 0, 48, 48);
        }

        function itemUpdateSpeed() {
            const fps = document.getElementById('itemSpeedSlider').value;
            document.getElementById('itemSpeedLabel').textContent = fps + ' fps';
            if (itemPreviewPlaying) itemStartPreview();
        }

        function itemZoomIn() {
            itemEditorZoom = Math.min(8, itemEditorZoom + 1);
            document.getElementById('itemZoomLevel').textContent = itemEditorZoom + 'x';
            itemDrawCanvas();
        }

        function itemZoomOut() {
            itemEditorZoom = Math.max(1, itemEditorZoom - 1);
            document.getElementById('itemZoomLevel').textContent = itemEditorZoom + 'x';
            itemDrawCanvas();
        }

        function itemSave() {
            if (!itemEditorData || itemFrames.length === 0) {
                alert('Please load a sprite sheet and select animation frames.');
                return;
            }

            const name = document.getElementById('itemNameInput').value.trim() || 'Item ' + (items.length + 1);
            const fps = parseInt(document.getElementById('itemSpeedSlider').value) || 8;
            const idleFrame = parseInt(document.getElementById('itemIdleFrame').value) || 0;
            const maxStack = parseInt(document.getElementById('itemMaxStack').value) || 99;

            const itemData = {
                id: itemEditorEditingIndex >= 0 ? (items[itemEditorEditingIndex].id || 'item_' + itemEditorEditingIndex) : ('item_' + items.length),
                name: name,
                spriteData: itemEditorData,
                frameWidth: itemEditorFrameW,
                frameHeight: itemEditorFrameH,
                frames: JSON.parse(JSON.stringify(itemFrames)),
                fps: fps,
                idleFrame: idleFrame,
                maxStack: maxStack
            };
            Object.assign(itemData, readItemBehaviorFields());

            if (itemEditorEditingIndex >= 0) {
                items[itemEditorEditingIndex] = itemData;
                broadcastEdit({ editType: 'updateItem', index: itemEditorEditingIndex, item: itemData });
            } else {
                items.push(itemData);
                broadcastEdit({ editType: 'addItem', item: itemData });
            }

            itemStopPreview();
            document.getElementById('itemModal').classList.remove('visible');
            stopEditing(); // Clear editing lock
            updateItemList();
            renderMap();
        }

        // ===== Usable-item behavior (sword / boomerang) =====
        function itemBehaviorChanged() {
            const b = document.getElementById('itemBehavior').value;
            document.getElementById('itemBehaviorConfig').style.display = (b === 'none') ? 'none' : 'block';
            const isFishing = (b === 'fishingPole');
            // Fishing pole uses fish zones + the loot table, not damage/range/speed/anim-on-use.
            document.getElementById('itemAbilityDamageRow').style.display = isFishing ? 'none' : 'block';
            document.getElementById('itemAbilityRangeRow').style.display = isFishing ? 'none' : 'block';
            document.getElementById('itemAbilitySpeedRow').style.display = (b === 'boomerang') ? 'block' : 'none';
            document.getElementById('itemAbilityAnimRow').style.display = isFishing ? 'none' : 'block';
            document.getElementById('itemFishingNote').style.display = isFishing ? 'block' : 'none';
        }
        function readItemBehaviorFields() {
            const behavior = document.getElementById('itemBehavior').value || 'none';
            if (behavior === 'none') return { behavior: 'none' };
            return {
                behavior: behavior,
                abilityDamage: parseInt(document.getElementById('itemAbilityDamage').value) || 10,
                abilityRange: parseInt(document.getElementById('itemAbilityRange').value) || 180,
                abilitySpeed: parseInt(document.getElementById('itemAbilitySpeed').value) || 7,
                abilityAnim: (document.getElementById('itemAbilityAnim').value || '').trim()
            };
        }
        function loadItemBehaviorFields(item) {
            const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
            const txt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            set('itemBehavior', item.behavior || 'none');
            set('itemAbilityDamage', item.abilityDamage || 10); txt('itemAbilityDamageVal', item.abilityDamage || 10);
            set('itemAbilityRange', item.abilityRange || 180); txt('itemAbilityRangeVal', item.abilityRange || 180);
            set('itemAbilitySpeed', item.abilitySpeed || 7); txt('itemAbilitySpeedVal', item.abilitySpeed || 7);
            set('itemAbilityAnim', item.abilityAnim || '');
            itemBehaviorChanged();
        }
        function resetItemBehaviorFields() {
            const d = { behavior: 'none' };
            loadItemBehaviorFields(d);
        }

        function itemCancel() {
            itemStopPreview();
            document.getElementById('itemModal').classList.remove('visible');
            stopEditing(); // Clear editing lock
        }

        // Save item and keep modal open to create another from same sprite sheet
        function itemSaveAndContinue() {
            if (!itemEditorData || itemFrames.length === 0) {
                alert('Please load a sprite sheet and select animation frames.');
                return;
            }

            const name = document.getElementById('itemNameInput').value.trim() || 'Item ' + (items.length + 1);
            const fps = parseInt(document.getElementById('itemSpeedSlider').value) || 8;
            const idleFrame = parseInt(document.getElementById('itemIdleFrame').value) || 0;
            const maxStack = parseInt(document.getElementById('itemMaxStack').value) || 99;

            const itemData = {
                id: 'item_' + items.length,
                name: name,
                spriteData: itemEditorData,
                frameWidth: itemEditorFrameW,
                frameHeight: itemEditorFrameH,
                frames: JSON.parse(JSON.stringify(itemFrames)),
                fps: fps,
                idleFrame: idleFrame,
                maxStack: maxStack
            };
            Object.assign(itemData, readItemBehaviorFields());

            // Always add as new item (not editing)
            items.push(itemData);
            broadcastEdit({ editType: 'addItem', item: itemData });
            updateItemList();

            // Reset for next item - keep sprite sheet loaded
            document.getElementById('itemNameInput').value = 'Item ' + (items.length + 1);
            document.getElementById('itemIdleFrame').value = 0;
            document.getElementById('itemMaxStack').value = 99;
            itemFrames = []; // Clear selected frames
            itemEditorEditingIndex = -1; // Always creating new items now
            itemStopPreview();
            itemDrawCanvas(); // Redraw to show cleared selection

            console.log('[ITEM] Saved "' + name + '", ready to create another');
        }

        function updateItemLayerDropdown() {
            const select = document.getElementById('itemPlacementLayer');
            if (!select) return;
            const currentVal = parseInt(select.value) || 0;
            select.innerHTML = '';
            layers.forEach((layer, i) => {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = layerNames[i] || ('Layer ' + (i + 1));
                if (i === currentVal) opt.selected = true;
                select.appendChild(opt);
            });
            // Default to player layer if available
            if (currentVal === 0 && playerLayerIndex >= 0 && playerLayerIndex < layers.length) {
                select.value = playerLayerIndex;
            }
        }

        function updateItemList() {
            const container = document.getElementById('itemList');
            if (!container) return;
            container.innerHTML = '';

            if (items.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:11px; padding:10px;">No items yet</div>';
                return;
            }

            items.forEach((item, i) => {
                const itemEl = document.createElement('div');
                const isSelected = (currentItemIndex === i);
                itemEl.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px; background:' + (isSelected ? '#3a4a3a' : '#333') + '; border:2px solid ' + (isSelected ? '#4f8' : 'transparent') + '; border-radius:5px; margin-bottom:5px; cursor:pointer;';
                itemEl.onclick = () => { currentItemIndex = i; updateItemList(); };

                // Preview thumbnail
                if (item.frames && item.frames.length > 0) {
                    const canvas = document.createElement('canvas');
                    canvas.width = 32;
                    canvas.height = 32;
                    canvas.style.cssText = 'border:1px solid #555; image-rendering:pixelated;';
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = false;

                    const idleIdx = item.idleFrame || 0;
                    const frame = item.frames[idleIdx] || item.frames[0];
                    if (item._spriteImg) {
                        ctx.drawImage(item._spriteImg, frame.x, frame.y, frame.w, frame.h, 0, 0, 32, 32);
                    } else if (item.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            item._spriteImg = img;
                            ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, 32, 32);
                        };
                        img.src = item.spriteData;
                    }
                    itemEl.appendChild(canvas);
                }

                // Name and info
                const info = document.createElement('div');
                info.innerHTML = `<div style="font-weight:bold; color:#4f8;">${item.name}</div>
                    <div style="font-size:10px; color:#888;">${item.frames?.length || 0} frames</div>`;
                itemEl.appendChild(info);

                // Edit/Delete buttons
                const btns = document.createElement('div');
                btns.style.cssText = 'margin-left:auto; display:flex; gap:5px;';
                btns.innerHTML = `
                    <button onclick="event.stopPropagation(); openItemEditor(${i})" style="padding:3px 6px; font-size:10px;">Edit</button>
                    <button onclick="event.stopPropagation(); deleteItem(${i})" style="padding:3px 6px; font-size:10px; background:#a55;">×</button>
                `;
                itemEl.appendChild(btns);

                container.appendChild(itemEl);
            });
        }

        function deleteItem(index) {
            // Wave 5: warn about downstream references that will be cleaned up.
            const placedCount = placedItems.filter(p => p && p.itemIndex === index).length;
            const shopRefs = Array.isArray(shops) ? shops.reduce((n, s) => {
                if (!s) return n;
                const inv = (s.inventory || []).filter(i => i && i.itemIndex === index).length;
                const buy = (s.buyList || []).filter(i => i && i.itemIndex === index).length;
                return n + inv + buy;
            }, 0) : 0;
            const msg = (placedCount || shopRefs)
                ? `Delete this item?\n\n${placedCount} placed instance(s) and ${shopRefs} shop entry/entries will also be cleaned up.`
                : 'Delete this item?';
            if (!confirm(msg)) return;
            items.splice(index, 1);
            // Wave 5: reindex all downstream refs (placedItems, shops, animProps, NPC drops).
            reindexItemReferences(index);
            // itemImages object-map: delete + shift higher keys.
            if (typeof itemImages !== 'undefined') {
                delete itemImages[index];
                const keys = Object.keys(itemImages).map(k => parseInt(k, 10)).filter(Number.isFinite).sort((a,b)=>a-b);
                for (const k of keys) {
                    if (k > index) { itemImages[k - 1] = itemImages[k]; delete itemImages[k]; }
                }
            }
            broadcastEdit({ editType: 'deleteItem', index: index });
            if (currentItemIndex >= items.length) currentItemIndex = items.length - 1;
            updateItemList();
            if (typeof updatePlacedItemsList === 'function') updatePlacedItemsList();
            if (typeof updateShopList === 'function') updateShopList();
            renderMap();
        }

        function updatePlacedItemsList() {
            const container = document.getElementById('placedItemsList');
            if (!container) return;

            const currentMapItems = placedItems.filter(p => !p.mapName || p.mapName === currentMapName);

            if (currentMapItems.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:11px; text-align:center; padding:10px;">No items placed</div>';
                return;
            }

            container.innerHTML = '';
            currentMapItems.forEach((placed, i) => {
                const item = items[placed.itemIndex];
                if (!item) return;
                const realIdx = placedItems.indexOf(placed);
                const div = document.createElement('div');
                div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid #333;';
                div.innerHTML = `
                    <span style="color:#4f8;">${item.name}</span>
                    <span style="font-size:10px; color:#888;">(${placed.x}, ${placed.y})</span>
                    <button onclick="removePlacedItem(${realIdx})" style="padding:2px 6px; font-size:9px; background:#a55;">×</button>
                `;
                container.appendChild(div);
            });
        }

        function removePlacedItem(index) {
            const item = placedItems[index];
            if (item) {
                broadcastEdit({ editType: 'removeItem', x: item.x, y: item.y, mapName: item.mapName || currentMapName });
            }
            placedItems.splice(index, 1);
            updatePlacedItemsList();
            renderMap();
        }

        // Find an interactive anim prop (with giveItem) at the given map coordinates
        // placedAnimProps is a STALE all-maps registry (placement writes animTile cells into `layers`,
        // not this array; legacy entries also lack mapName). Verify a real animTile cell actually exists
        // at these coords on the CURRENT map's layers. Prevents cross-map phantom highlight boxes/hit-tests.
        function animTileCellExistsAt(x, y) {
            for (let li = 0; li < layers.length; li++) {
                const layer = layers[li];
                if (layer && layer[y] && layer[y][x] && layer[y][x].type === 'animTile') return true;
            }
            return false;
        }

        function findInteractivePropAt(x, y) {
            for (let i = 0; i < placedAnimProps.length; i++) {
                const placed = placedAnimProps[i];
                if (placed.mapName && placed.mapName !== currentMapName) continue;
                if (!animTileCellExistsAt(placed.x, placed.y)) continue;

                const prop = animatedProps[placed.propIndex];
                if (!prop || !prop.giveItem) continue;

                // Calculate prop bounds
                const frames = prop.frames || [];
                if (frames.length === 0) continue;
                const frame = frames[0];
                const tilesW = Math.ceil(frame.w / gridSize);
                const tilesH = Math.ceil(frame.h / gridSize);

                // Check if click is within prop bounds
                if (x >= placed.x && x < placed.x + tilesW &&
                    y >= placed.y && y < placed.y + tilesH) {
                    return i;
                }
            }
            return -1;
        }

        // Open a popup to assign an item to a specific placed prop instance
        function openPropItemAssignment(placedPropIndex) {
            const placed = placedAnimProps[placedPropIndex];
            if (!placed) return;

            const prop = animatedProps[placed.propIndex];
            if (!prop) return;

            // Build item options
            let itemOptions = '<option value="-1">(Use default: ' + (items[prop.giveItemIndex]?.name || 'None') + ')</option>';
            items.forEach((item, idx) => {
                const selected = placed.instanceItemIndex === idx ? ' selected' : '';
                itemOptions += '<option value="' + idx + '"' + selected + '>' + item.name + '</option>';
            });

            // Create simple popup
            const popup = document.createElement('div');
            popup.id = 'propItemAssignPopup';
            popup.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#2a2a3a; padding:20px; border-radius:8px; border:2px solid #fa0; z-index:10000; min-width:300px;';
            popup.innerHTML = `
                <div style="color:#fa0; font-weight:bold; margin-bottom:15px; font-size:14px;">
                    📦 Assign Item to: ${prop.name}
                </div>
                <div style="margin-bottom:15px;">
                    <label style="color:#ccc; display:block; margin-bottom:5px;">Item to give:</label>
                    <select id="propInstanceItemSelect" style="width:100%; padding:8px; background:#1a1a2a; color:#fff; border:1px solid #555; border-radius:4px;">
                        ${itemOptions}
                    </select>
                </div>
                <div style="display:flex; gap:10px; justify-content:flex-end;">
                    <button onclick="closePropItemAssignment()" style="padding:8px 16px; background:#555; color:#fff; border:none; border-radius:4px; cursor:pointer;">Cancel</button>
                    <button onclick="savePropItemAssignment(${placedPropIndex})" style="padding:8px 16px; background:#fa0; color:#000; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Save</button>
                </div>
            `;
            document.body.appendChild(popup);

            // Add backdrop
            const backdrop = document.createElement('div');
            backdrop.id = 'propItemAssignBackdrop';
            backdrop.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:9999;';
            backdrop.onclick = closePropItemAssignment;
            document.body.appendChild(backdrop);
        }

        function closePropItemAssignment() {
            const popup = document.getElementById('propItemAssignPopup');
            const backdrop = document.getElementById('propItemAssignBackdrop');
            if (popup) popup.remove();
            if (backdrop) backdrop.remove();
        }

        function savePropItemAssignment(placedPropIndex) {
            const select = document.getElementById('propInstanceItemSelect');
            if (!select) return;

            const itemIdx = parseInt(select.value);
            const placed = placedAnimProps[placedPropIndex];
            if (!placed) return;

            if (itemIdx < 0) {
                // Clear instance override (use default)
                delete placed.instanceItemIndex;
            } else {
                placed.instanceItemIndex = itemIdx;
            }

            // Broadcast to co-op builders
            broadcastEdit({ editType: 'updatePlacedAnimProp', index: placedPropIndex, prop: placed });

            closePropItemAssignment();
            renderMap();
        }

        function placeItemAt(x, y) {
            if (x < 0 || y < 0 || x >= mapCols || y >= mapRows) return;
            if (currentItemIndex < 0 || !items[currentItemIndex]) return;

            // Get selected layer from dropdown
            const layerSelect = document.getElementById('itemPlacementLayer');
            const itemLayer = layerSelect ? parseInt(layerSelect.value) : 0;

            // Check if item already exists at this position on same layer
            const existingIdx = placedItems.findIndex(p =>
                p.x === x && p.y === y &&
                (!p.mapName || p.mapName === currentMapName) &&
                p.layer === itemLayer
            );
            if (existingIdx >= 0) return; // Don't stack items

            const newItem = {
                itemIndex: currentItemIndex,
                x: x,
                y: y,
                layer: itemLayer,
                mapName: currentMapName,
                used: false
            };
            placedItems.push(newItem);

            // Broadcast to co-op builders
            broadcastEdit({ editType: 'placeItem', item: newItem, index: placedItems.length - 1 });

            updatePlacedItemsList();
            renderMap();
        }

        function removeItemAt(x, y) {
            const idx = placedItems.findIndex(p =>
                p.x === x && p.y === y &&
                (!p.mapName || p.mapName === currentMapName)
            );
            if (idx >= 0) {
                placedItems.splice(idx, 1);
                // Broadcast to co-op builders
                broadcastEdit({ editType: 'removeItem', x: x, y: y, mapName: currentMapName });
                updatePlacedItemsList();
                renderMap();
            }
        }

        // Initialize item editor canvas with drag selection handlers
        document.addEventListener('DOMContentLoaded', () => {
            const itemCanvas = document.getElementById('itemEditorCanvas');
            if (itemCanvas) {
                itemCanvas.addEventListener('mousedown', function(e) {
                    if (!itemEditorImage) return;
                    const rect = this.getBoundingClientRect();
                    const scale = itemEditorZoom;
                    const gridX = Math.floor((e.clientX - rect.left) / (itemEditorFrameW * scale));
                    const gridY = Math.floor((e.clientY - rect.top) / (itemEditorFrameH * scale));
                    itemDragStart = { gridX, gridY };
                    itemDragEnd = { gridX, gridY };
                    itemIsDragging = true;
                    itemDrawCanvas();
                });

                itemCanvas.addEventListener('mousemove', function(e) {
                    if (!itemIsDragging || !itemEditorImage) return;
                    const rect = this.getBoundingClientRect();
                    const scale = itemEditorZoom;
                    const gridX = Math.floor((e.clientX - rect.left) / (itemEditorFrameW * scale));
                    const gridY = Math.floor((e.clientY - rect.top) / (itemEditorFrameH * scale));
                    itemDragEnd = { gridX, gridY };
                    itemDrawCanvas();
                });

                itemCanvas.addEventListener('mouseup', function(e) {
                    if (!itemIsDragging || !itemEditorImage) return;
                    itemIsDragging = false;

                    if (itemDragStart && itemDragEnd) {
                        const startGX = Math.min(itemDragStart.gridX, itemDragEnd.gridX);
                        const startGY = Math.min(itemDragStart.gridY, itemDragEnd.gridY);
                        const endGX = Math.max(itemDragStart.gridX, itemDragEnd.gridX);
                        const endGY = Math.max(itemDragStart.gridY, itemDragEnd.gridY);

                        // Add all frames in the selection as a single multi-tile frame
                        const frameX = startGX * itemEditorFrameW;
                        const frameY = startGY * itemEditorFrameH;
                        const frameW = (endGX - startGX + 1) * itemEditorFrameW;
                        const frameH = (endGY - startGY + 1) * itemEditorFrameH;

                        // Check if already exists
                        const existingIdx = itemFrames.findIndex(f => f.x === frameX && f.y === frameY && f.w === frameW && f.h === frameH);
                        if (existingIdx >= 0) {
                            itemFrames.splice(existingIdx, 1);
                        } else {
                            itemFrames.push({ x: frameX, y: frameY, w: frameW, h: frameH });
                        }

                        itemUpdateFramesList();
                        itemUpdateIdleDropdown();
                        itemStartPreview();
                    }

                    itemDragStart = null;
                    itemDragEnd = null;
                    itemDrawCanvas();
                });

                itemCanvas.addEventListener('mouseleave', function() {
                    if (itemIsDragging) {
                        itemIsDragging = false;
                        itemDragStart = null;
                        itemDragEnd = null;
                        itemDrawCanvas();
                    }
                });
            }
        });

        function updateAnimPropScale() {
            const scale = parseFloat(document.getElementById('animPropScale').value) || 1;
            currentAnimPropScale = scale;
            document.getElementById('animPropScaleValue').textContent = scale.toFixed(2) + 'x';
            renderMap(); // Update preview
        }

        function toggleEditAnimPropMode() {
            editAnimPropOnMapMode = !editAnimPropOnMapMode;
            const btn = document.getElementById('editAnimPropOnMapBtn');
            if (editAnimPropOnMapMode) {
                btn.classList.add('active');
                btn.textContent = '✓ Click Prop to Edit';
            } else {
                btn.classList.remove('active');
                btn.textContent = 'Edit Object on Map';
            }
            renderMap();
        }

        // Find placed animated prop at map position
        function findAnimPropAt(x, y) {
            // Search all layers for animTile at this position
            for (let li = 0; li < layers.length; li++) {
                const layer = layers[li];
                if (!layer || !layer[y] || !layer[y][x]) continue;
                const cell = layer[y][x];
                if (cell && cell.type === 'animTile') {
                    // Return origin position for multi-tile props
                    const originX = x - (cell.offsetX || 0);
                    const originY = y - (cell.offsetY || 0);
                    return { x: originX, y: originY, layer: li, cell: layer[originY][originX] };
                }
            }
            return null;
        }

        // Open popup to edit placed animated prop timing
        function openAnimPropEditPopup(propInfo) {
            const { x, y, layer, cell } = propInfo;
            const prop = animatedProps[cell.propIndex];
            if (!prop) return;

            // Get current instance settings or defaults
            const currentMode = cell.instancePlayMode || 'default';
            const currentPlayCount = cell.instancePlayCount || 1;
            const currentWaitTime = cell.instanceWaitTime || 2;
            const currentSpeed = cell.instanceSpeed !== undefined ? cell.instanceSpeed : 1;
            const currentScale = cell.scale !== undefined ? cell.scale : 1;
            const currentMirror = !!cell.mirror;
            const currentNudgeX = cell.nudgeX || 0;
            const currentNudgeY = cell.nudgeY || 0;

            const popup = document.createElement('div');
            popup.id = 'animPropEditPopup';
            popup.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#2a2a3a; padding:20px; border-radius:8px; border:2px solid #fa0; z-index:10000; width:500px; max-width:90vw;';

            let html = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">';
            html += '<div style="color:#fa0; font-weight:bold; font-size:14px;">Edit: ' + prop.name + '</div>';
            html += '<button onclick="closeAnimPropEditPopup()" style="background:none; border:none; color:#888; font-size:18px; cursor:pointer;">&times;</button>';
            html += '</div>';

            html += '<div style="display:flex; gap:20px;">';

            // Left column - Scale and Speed
            html += '<div style="flex:1;">';
            html += '<div style="margin-bottom:12px;">';
            html += '<label style="color:#ccc; display:block; margin-bottom:5px;">Scale:</label>';
            html += '<div style="display:flex; align-items:center; gap:10px;">';
            html += '<input type="range" id="editAnimScale" min="0.25" max="4" step="0.25" value="' + currentScale + '" style="flex:1;" oninput="document.getElementById(\'scaleValue\').textContent = this.value + \'x\'; previewAnimPropScale(' + x + ', ' + y + ', ' + layer + ', this.value)">';
            html += '<span id="scaleValue" style="color:#4af; min-width:40px;">' + currentScale + 'x</span>';
            html += '</div></div>';
            html += '<div style="margin-bottom:12px;">';
            html += '<label style="color:#ccc; display:block; margin-bottom:5px;">Animation Speed:</label>';
            html += '<div style="display:flex; align-items:center; gap:10px;">';
            html += '<input type="range" id="editAnimSpeed" min="0.25" max="3" step="0.25" value="' + currentSpeed + '" style="flex:1;" oninput="document.getElementById(\'speedValue\').textContent = this.value + \'x\'">';
            html += '<span id="speedValue" style="color:#4af; min-width:40px;">' + currentSpeed + 'x</span>';
            html += '</div></div>';
            html += '<div style="margin-bottom:4px;">';
            html += '<label style="color:#ccc; display:flex; align-items:center; gap:8px; cursor:pointer;">';
            html += '<input type="checkbox" id="editAnimMirror"' + (currentMirror ? ' checked' : '') + ' onchange="previewAnimPropMirror(' + x + ', ' + y + ', ' + layer + ', this.checked)"> Mirror (flip horizontally)';
            html += '</label></div>';
            html += '<div style="margin-top:10px;">';
            html += '<label style="color:#ccc; display:block; margin-bottom:5px;">Fine position (px) — collision follows:</label>';
            html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">';
            html += '<span style="color:#888; width:12px;">X</span>';
            html += '<input type="range" id="editAnimNudgeX" min="' + (-gridSize) + '" max="' + gridSize + '" step="1" value="' + currentNudgeX + '" style="flex:1;" oninput="document.getElementById(\'nudgeXValue\').textContent = this.value; previewAnimPropNudge(' + x + ', ' + y + ', ' + layer + ')">';
            html += '<span id="nudgeXValue" style="color:#4af; min-width:26px;">' + currentNudgeX + '</span>';
            html += '</div>';
            html += '<div style="display:flex; align-items:center; gap:8px;">';
            html += '<span style="color:#888; width:12px;">Y</span>';
            html += '<input type="range" id="editAnimNudgeY" min="' + (-gridSize) + '" max="' + gridSize + '" step="1" value="' + currentNudgeY + '" style="flex:1;" oninput="document.getElementById(\'nudgeYValue\').textContent = this.value; previewAnimPropNudge(' + x + ', ' + y + ', ' + layer + ')">';
            html += '<span id="nudgeYValue" style="color:#4af; min-width:26px;">' + currentNudgeY + '</span>';
            html += '</div></div>';
            html += '</div>';

            // Right column - Animation Mode
            html += '<div style="flex:1;">';
            html += '<div style="margin-bottom:12px;">';
            html += '<label style="color:#ccc; display:block; margin-bottom:5px;">Animation Mode:</label>';
            html += '<select id="editAnimMode" style="width:100%; padding:8px; background:#1a1a2a; color:#fff; border:1px solid #555; border-radius:4px;" onchange="updateAnimEditPopup()">';
            html += '<option value="default"' + (currentMode === 'default' ? ' selected' : '') + '>Default (from prop)</option>';
            html += '<option value="loop"' + (currentMode === 'loop' ? ' selected' : '') + '>Loop Forever</option>';
            html += '<option value="timed"' + (currentMode === 'timed' ? ' selected' : '') + '>Timed</option>';
            html += '</select></div>';
            html += '<div id="timedSettings" style="display:' + (currentMode === 'timed' ? 'block' : 'none') + '; background:#1a1a2a; padding:10px; border-radius:4px;">';
            html += '<div style="margin-bottom:8px;"><label style="color:#aaa; font-size:11px;">Play animation:</label>';
            html += '<div style="display:flex; align-items:center; gap:5px; margin-top:3px;">';
            html += '<input type="number" id="editPlayCount" value="' + currentPlayCount + '" min="1" max="10" style="width:50px; padding:5px; background:#222; color:#4af; border:1px solid #555; border-radius:3px;">';
            html += '<span style="color:#888;">time(s)</span></div></div>';
            html += '<div><label style="color:#aaa; font-size:11px;">Then wait:</label>';
            html += '<div style="display:flex; align-items:center; gap:5px; margin-top:3px;">';
            html += '<input type="number" id="editWaitTime" value="' + currentWaitTime + '" min="0.5" max="60" step="0.5" style="width:60px; padding:5px; background:#222; color:#4af; border:1px solid #555; border-radius:3px;">';
            html += '<span style="color:#888;">seconds</span></div></div></div>';
            html += '</div>';

            html += '</div>'; // End flex container

            html += '<div style="display:flex; gap:10px; justify-content:flex-end; align-items:center; margin-top:15px; padding-top:15px; border-top:1px solid #444;">';
            html += '<button onclick="deleteAnimPropOnMap(' + x + ', ' + y + ', ' + layer + ')" style="padding:8px 20px; background:#a33; color:#fff; border:none; border-radius:4px; cursor:pointer; margin-right:auto;">🗑 Delete</button>';
            html += '<button onclick="closeAnimPropEditPopup()" style="padding:8px 20px; background:#555; color:#fff; border:none; border-radius:4px; cursor:pointer;">Cancel</button>';
            html += '<button onclick="saveAnimPropEdit(' + x + ', ' + y + ', ' + layer + ')" style="padding:8px 20px; background:#fa0; color:#000; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Save</button>';
            html += '</div>';

            popup.innerHTML = html;
            document.body.appendChild(popup);

            // Add backdrop (semi-transparent, doesn't block view much)
            const backdrop = document.createElement('div');
            backdrop.id = 'animPropEditBackdrop';
            backdrop.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.3); z-index:9999;';
            backdrop.onclick = closeAnimPropEditPopup;
            document.body.appendChild(backdrop);
        }

        function updateAnimEditPopup() {
            const mode = document.getElementById('editAnimMode').value;
            document.getElementById('timedSettings').style.display = mode === 'timed' ? 'block' : 'none';
        }

        function closeAnimPropEditPopup() {
            const popup = document.getElementById('animPropEditPopup');
            const backdrop = document.getElementById('animPropEditBackdrop');
            if (popup) popup.remove();
            if (backdrop) backdrop.remove();
        }

        function previewAnimPropScale(originX, originY, layerIdx, scaleValue) {
            const scale = parseFloat(scaleValue) || 1;
            const layer = layers[layerIdx];
            if (!layer || !layer[originY] || !layer[originY][originX]) return;

            const cell = layer[originY][originX];
            if (!cell || cell.type !== 'animTile') return;

            // Temporarily update scale on origin cell
            if (scale === 1) {
                delete cell.scale;
            } else {
                cell.scale = scale;
            }

            // Propagate scale to all tiles of multi-tile prop.
            // NOTE: tilesW/tilesH live on the CELL (set at placement), NOT on the prop definition.
            const tilesW = cell.tilesW || 1;
            const tilesH = cell.tilesH || 1;
            if (tilesW > 1 || tilesH > 1) {
                for (let ty = 0; ty < tilesH; ty++) {
                    for (let tx = 0; tx < tilesW; tx++) {
                        if (tx === 0 && ty === 0) continue;
                        const tileX = originX + tx;
                        const tileY = originY + ty;
                        if (layer[tileY] && layer[tileY][tileX] && layer[tileY][tileX].type === 'animTile') {
                            if (scale === 1) {
                                delete layer[tileY][tileX].scale;
                            } else {
                                layer[tileY][tileX].scale = scale;
                            }
                        }
                    }
                }
            }

            renderMap();
        }

        // Live-preview a per-instance horizontal mirror (applies to all tiles of the prop).
        function previewAnimPropMirror(originX, originY, layerIdx, checked) {
            const layer = layers[layerIdx];
            if (!layer || !layer[originY] || !layer[originY][originX]) return;
            const cell = layer[originY][originX];
            if (!cell || cell.type !== 'animTile') return;
            const apply = (c) => { if (checked) c.mirror = true; else delete c.mirror; };
            apply(cell);
            const tilesW = cell.tilesW || 1;
            const tilesH = cell.tilesH || 1;
            if (tilesW > 1 || tilesH > 1) {
                for (let ty = 0; ty < tilesH; ty++) {
                    for (let tx = 0; tx < tilesW; tx++) {
                        if (tx === 0 && ty === 0) continue;
                        const c = layer[originY + ty] && layer[originY + ty][originX + tx];
                        if (c && c.type === 'animTile') apply(c);
                    }
                }
            }
            renderMap();
        }

        // Live-preview a per-instance pixel nudge (applies to all tiles of the prop).
        function previewAnimPropNudge(originX, originY, layerIdx) {
            const layer = layers[layerIdx];
            if (!layer || !layer[originY] || !layer[originY][originX]) return;
            const cell = layer[originY][originX];
            if (!cell || cell.type !== 'animTile') return;
            const nx = parseInt(document.getElementById('editAnimNudgeX').value) || 0;
            const ny = parseInt(document.getElementById('editAnimNudgeY').value) || 0;
            const apply = (c) => { if (nx) c.nudgeX = nx; else delete c.nudgeX; if (ny) c.nudgeY = ny; else delete c.nudgeY; };
            apply(cell);
            const tilesW = cell.tilesW || 1, tilesH = cell.tilesH || 1;
            if (tilesW > 1 || tilesH > 1) {
                for (let ty = 0; ty < tilesH; ty++) for (let tx = 0; tx < tilesW; tx++) {
                    if (tx === 0 && ty === 0) continue;
                    const c = layer[originY + ty] && layer[originY + ty][originX + tx];
                    if (c && c.type === 'animTile') apply(c);
                }
            }
            renderMap();
        }

        function saveAnimPropEdit(originX, originY, layerIdx) {
            const mode = document.getElementById('editAnimMode').value;
            const playCount = parseInt(document.getElementById('editPlayCount').value) || 1;
            const waitTime = parseFloat(document.getElementById('editWaitTime').value) || 2;
            const speed = parseFloat(document.getElementById('editAnimSpeed').value) || 1;
            const scale = parseFloat(document.getElementById('editAnimScale').value) || 1;
            const mirrorEl = document.getElementById('editAnimMirror');
            const mirror = mirrorEl ? mirrorEl.checked : false;
            const nudgeXEl = document.getElementById('editAnimNudgeX');
            const nudgeYEl = document.getElementById('editAnimNudgeY');
            const nudgeX = nudgeXEl ? (parseInt(nudgeXEl.value) || 0) : 0;
            const nudgeY = nudgeYEl ? (parseInt(nudgeYEl.value) || 0) : 0;

            const layer = layers[layerIdx];
            if (!layer || !layer[originY] || !layer[originY][originX]) return;

            const cell = layer[originY][originX];
            if (!cell || cell.type !== 'animTile') return;

            // Update instance scale
            if (scale === 1) {
                delete cell.scale;
            } else {
                cell.scale = scale;
            }

            // Update instance mirror
            if (mirror) cell.mirror = true; else delete cell.mirror;

            // Update instance pixel nudge (fine-position; collision follows)
            if (nudgeX) cell.nudgeX = nudgeX; else delete cell.nudgeX;
            if (nudgeY) cell.nudgeY = nudgeY; else delete cell.nudgeY;

            // Update instance speed
            if (speed === 1) {
                delete cell.instanceSpeed;
            } else {
                cell.instanceSpeed = speed;
            }

            // Update instance settings
            if (mode === 'default') {
                delete cell.instancePlayMode;
                delete cell.instancePlayCount;
                delete cell.instanceWaitTime;
            } else {
                cell.instancePlayMode = mode;
                if (mode === 'timed') {
                    cell.instancePlayCount = playCount;
                    cell.instanceWaitTime = waitTime;
                } else {
                    delete cell.instancePlayCount;
                    delete cell.instanceWaitTime;
                }
            }

            // Propagate scale to all tiles of multi-tile prop.
            // NOTE: tilesW/tilesH live on the CELL (set at placement), NOT on the prop definition.
            const tilesW = cell.tilesW || 1;
            const tilesH = cell.tilesH || 1;
            if (tilesW > 1 || tilesH > 1) {
                for (let ty = 0; ty < tilesH; ty++) {
                    for (let tx = 0; tx < tilesW; tx++) {
                        if (tx === 0 && ty === 0) continue; // Skip origin, already updated
                        const tileX = originX + tx;
                        const tileY = originY + ty;
                        if (layer[tileY] && layer[tileY][tileX] && layer[tileY][tileX].type === 'animTile') {
                            const tc = layer[tileY][tileX];
                            if (scale === 1) { delete tc.scale; } else { tc.scale = scale; }
                            if (mirror) { tc.mirror = true; } else { delete tc.mirror; }
                            if (nudgeX) { tc.nudgeX = nudgeX; } else { delete tc.nudgeX; }
                            if (nudgeY) { tc.nudgeY = nudgeY; } else { delete tc.nudgeY; }
                        }
                    }
                }
            }

            // Reset animation state for this prop
            const key = originX + ',' + originY + ',' + layerIdx;
            delete placedAnimPropFrames[key];

            // Broadcast to co-op
            broadcastEdit({ editType: 'tile', layer: layerIdx, x: originX, y: originY, cell: cell, mapName: currentMapName });

            closeAnimPropEditPopup();
            renderMap();
        }

        // Delete a placed anim prop (and all its tiles) from the map — handy for clearing
        // invisible/orphaned props that can't be erased any other way.
        function deleteAnimPropOnMap(originX, originY, layerIdx) {
            const layer = layers[layerIdx];
            if (!layer || !layer[originY] || !layer[originY][originX]) { closeAnimPropEditPopup(); return; }
            const cell = layer[originY][originX];
            if (!cell || cell.type !== 'animTile') { closeAnimPropEditPopup(); return; }
            const tilesW = cell.tilesW || 1;
            const tilesH = cell.tilesH || 1;
            // Clear every tile of this prop (set to null = empty) + broadcast each erase.
            for (let ty = 0; ty < tilesH; ty++) {
                for (let tx = 0; tx < tilesW; tx++) {
                    const cx = originX + tx, cy = originY + ty;
                    if (layer[cy] && layer[cy][cx] && layer[cy][cx].type === 'animTile') {
                        layer[cy][cx] = null;
                        broadcastEdit({ editType: 'eraseTile', layer: layerIdx, x: cx, y: cy, mapName: currentMapName });
                    }
                }
            }
            delete placedAnimPropFrames[originX + ',' + originY + ',' + layerIdx];
            closeAnimPropEditPopup();
            renderMap();
        }

        // ===== STATIC OBJECT EDIT MODE =====
        function toggleEditStaticObjMode() {
            editStaticObjOnMapMode = !editStaticObjOnMapMode;
            const btn = document.getElementById('editStaticObjOnMapBtn');
            if (editStaticObjOnMapMode) {
                btn.classList.add('active');
                btn.style.background = '#8fc99a';
                btn.textContent = '✓ Click Static Object to Edit';
                // Deselect current object to prevent placing while editing
                currentStaticObjIndex = -1;
                updateStaticObjectsList();
            } else {
                btn.classList.remove('active');
                btn.style.background = '#4a7c59';
                btn.textContent = 'Edit Static Object Collision';
            }
            renderMap();
        }

        // Find placed static object at map position
        function findStaticObjAt(gridX, gridY) {
            // Search from top to bottom (last placed = on top)
            for (let i = placedStaticObjects.length - 1; i >= 0; i--) {
                const placed = placedStaticObjects[i];
                if (placed.mapName !== currentMapName) continue;

                const obj = staticObjects[placed.objIndex];
                if (!obj) continue;

                const scale = placed.scale || 1;
                const w = obj.width * scale;
                const h = obj.height * scale;

                if (gridX >= placed.x && gridX < placed.x + w &&
                    gridY >= placed.y && gridY < placed.y + h) {
                    return { placed, index: i };
                }
            }
            return null;
        }

        // Open popup to edit placed static object collision box
        function openStaticObjEditPopup(placedInfo) {
            const { placed, index } = placedInfo;
            const obj = staticObjects[placed.objIndex];
            if (!obj) return;

            const scale = placed.scale || 1;
            const pixelW = obj.width * gridSize * scale;
            const pixelH = obj.height * gridSize * scale;

            // Get current collision box or default to full object
            const cb = placed.collisionBox || { x: 0, y: 0, w: pixelW, h: pixelH };

            const popup = document.createElement('div');
            popup.id = 'staticObjEditPopup';
            popup.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#2a3a2a; padding:20px; border-radius:8px; border:2px solid #4a7c59; z-index:10000; width:450px; max-width:90vw;';

            let html = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">';
            html += '<div style="color:#4a7c59; font-weight:bold; font-size:14px;">Edit Collision: ' + obj.name + '</div>';
            html += '<button onclick="closeStaticObjEditPopup()" style="background:none; border:none; color:#888; font-size:18px; cursor:pointer;">&times;</button>';
            html += '</div>';

            // Object preview and collision editor
            html += '<div style="display:flex; gap:20px;">';

            // Left: Visual preview with collision box overlay
            html += '<div style="flex:0 0 150px;">';
            html += '<canvas id="staticObjCollisionPreview" width="150" height="150" style="border:1px solid #4a7c59; background:#1a1a2a;"></canvas>';
            html += '<p style="font-size:9px; color:#888; margin-top:5px; text-align:center;">Green = collision box</p>';
            html += '</div>';

            // Right: Collision box inputs
            html += '<div style="flex:1;">';
            html += '<p style="font-size:11px; color:#aaa; margin-bottom:10px;">Object size: ' + pixelW + ' x ' + pixelH + ' px</p>';

            html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">';
            html += '<div><label style="color:#aaa; font-size:10px;">X Offset:</label>';
            html += '<input type="number" id="cbX" value="' + cb.x + '" min="0" max="' + pixelW + '" style="width:100%; padding:5px; background:#1a2a1a; color:#4f8; border:1px solid #4a7c59; border-radius:3px;" onchange="updateStaticObjCollisionPreview()"></div>';
            html += '<div><label style="color:#aaa; font-size:10px;">Y Offset:</label>';
            html += '<input type="number" id="cbY" value="' + cb.y + '" min="0" max="' + pixelH + '" style="width:100%; padding:5px; background:#1a2a1a; color:#4f8; border:1px solid #4a7c59; border-radius:3px;" onchange="updateStaticObjCollisionPreview()"></div>';
            html += '<div><label style="color:#aaa; font-size:10px;">Width:</label>';
            html += '<input type="number" id="cbW" value="' + cb.w + '" min="1" max="' + pixelW + '" style="width:100%; padding:5px; background:#1a2a1a; color:#4f8; border:1px solid #4a7c59; border-radius:3px;" onchange="updateStaticObjCollisionPreview()"></div>';
            html += '<div><label style="color:#aaa; font-size:10px;">Height:</label>';
            html += '<input type="number" id="cbH" value="' + cb.h + '" min="1" max="' + pixelH + '" style="width:100%; padding:5px; background:#1a2a1a; color:#4f8; border:1px solid #4a7c59; border-radius:3px;" onchange="updateStaticObjCollisionPreview()"></div>';
            html += '</div>';

            // Preset buttons
            html += '<div style="display:flex; gap:5px; margin-bottom:15px;">';
            html += '<button onclick="setStaticObjCollisionPreset(\'full\')" style="flex:1; padding:5px; font-size:10px; background:#333; color:#aaa; border:1px solid #555; border-radius:3px;">Full Size</button>';
            html += '<button onclick="setStaticObjCollisionPreset(\'bottom\')" style="flex:1; padding:5px; font-size:10px; background:#333; color:#aaa; border:1px solid #555; border-radius:3px;">Bottom Half</button>';
            html += '<button onclick="setStaticObjCollisionPreset(\'none\')" style="flex:1; padding:5px; font-size:10px; background:#333; color:#aaa; border:1px solid #555; border-radius:3px;">No Collision</button>';
            html += '</div>';

            html += '</div>'; // End right column
            html += '</div>'; // End flex container

            // Save/Cancel buttons
            html += '<div style="display:flex; gap:10px; margin-top:15px;">';
            html += '<button onclick="saveStaticObjCollision(' + index + ')" style="flex:1; padding:8px; background:#4a7c59; color:#fff; border:none; border-radius:4px; cursor:pointer;">Save</button>';
            html += '<button onclick="closeStaticObjEditPopup()" style="flex:1; padding:8px; background:#555; color:#fff; border:none; border-radius:4px; cursor:pointer;">Cancel</button>';
            html += '</div>';

            popup.innerHTML = html;

            // Add backdrop
            const backdrop = document.createElement('div');
            backdrop.id = 'staticObjEditBackdrop';
            backdrop.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999;';
            backdrop.onclick = closeStaticObjEditPopup;

            document.body.appendChild(backdrop);
            document.body.appendChild(popup);

            // Store reference for preview updates
            window._editingStaticObj = { placed, index, obj };

            // Draw initial preview
            setTimeout(() => updateStaticObjCollisionPreview(), 50);
        }

        function updateStaticObjCollisionPreview() {
            const canvas = document.getElementById('staticObjCollisionPreview');
            if (!canvas || !window._editingStaticObj) return;

            const ctx = canvas.getContext('2d');
            const { placed, obj } = window._editingStaticObj;
            const scale = placed.scale || 1;
            const pixelW = obj.width * gridSize * scale;
            const pixelH = obj.height * gridSize * scale;

            // Clear canvas
            ctx.fillStyle = '#1a1a2a';
            ctx.fillRect(0, 0, 150, 150);

            // Calculate preview scale to fit canvas
            const previewScale = Math.min(140 / pixelW, 140 / pixelH);
            const offsetX = (150 - pixelW * previewScale) / 2;
            const offsetY = (150 - pixelH * previewScale) / 2;

            // Draw object sprite
            ctx.imageSmoothingEnabled = false;
            if (obj._spriteImg && obj._spriteImg.complete) {
                ctx.drawImage(
                    obj._spriteImg,
                    0, 0, obj.width * gridSize, obj.height * gridSize,
                    offsetX, offsetY, pixelW * previewScale, pixelH * previewScale
                );
            }

            // Get collision values
            const cbX = parseInt(document.getElementById('cbX').value) || 0;
            const cbY = parseInt(document.getElementById('cbY').value) || 0;
            const cbW = parseInt(document.getElementById('cbW').value) || pixelW;
            const cbH = parseInt(document.getElementById('cbH').value) || pixelH;

            // Draw collision box overlay
            ctx.strokeStyle = '#4f8';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 2]);
            ctx.strokeRect(
                offsetX + cbX * previewScale,
                offsetY + cbY * previewScale,
                cbW * previewScale,
                cbH * previewScale
            );
            ctx.setLineDash([]);

            // Fill with semi-transparent green
            ctx.fillStyle = 'rgba(79, 255, 136, 0.2)';
            ctx.fillRect(
                offsetX + cbX * previewScale,
                offsetY + cbY * previewScale,
                cbW * previewScale,
                cbH * previewScale
            );
        }

        function setStaticObjCollisionPreset(preset) {
            if (!window._editingStaticObj) return;
            const { placed, obj } = window._editingStaticObj;
            const scale = placed.scale || 1;
            const pixelW = obj.width * gridSize * scale;
            const pixelH = obj.height * gridSize * scale;

            switch (preset) {
                case 'full':
                    document.getElementById('cbX').value = 0;
                    document.getElementById('cbY').value = 0;
                    document.getElementById('cbW').value = pixelW;
                    document.getElementById('cbH').value = pixelH;
                    break;
                case 'bottom':
                    document.getElementById('cbX').value = 0;
                    document.getElementById('cbY').value = Math.floor(pixelH / 2);
                    document.getElementById('cbW').value = pixelW;
                    document.getElementById('cbH').value = Math.floor(pixelH / 2);
                    break;
                case 'none':
                    document.getElementById('cbX').value = 0;
                    document.getElementById('cbY').value = 0;
                    document.getElementById('cbW').value = 0;
                    document.getElementById('cbH').value = 0;
                    break;
            }
            updateStaticObjCollisionPreview();
        }

        function saveStaticObjCollision(index) {
            if (index < 0 || index >= placedStaticObjects.length) return;

            const cbX = parseInt(document.getElementById('cbX').value) || 0;
            const cbY = parseInt(document.getElementById('cbY').value) || 0;
            const cbW = parseInt(document.getElementById('cbW').value) || 0;
            const cbH = parseInt(document.getElementById('cbH').value) || 0;

            // Save collision box to placed object
            placedStaticObjects[index].collisionBox = { x: cbX, y: cbY, w: cbW, h: cbH };

            // Broadcast to co-op
            broadcastEdit({
                editType: 'updateStaticObjCollision',
                index: index,
                collisionBox: { x: cbX, y: cbY, w: cbW, h: cbH },
                mapName: currentMapName
            });

            closeStaticObjEditPopup();
            renderMap();
        }

        function closeStaticObjEditPopup() {
            const popup = document.getElementById('staticObjEditPopup');
            const backdrop = document.getElementById('staticObjEditBackdrop');
            if (popup) popup.remove();
            if (backdrop) backdrop.remove();
            delete window._editingStaticObj;
        }

        function updateAnimPropListDisplay() {
            const container = document.getElementById('animPropList');
            if (!container) return;
            container.innerHTML = '';

            if (animatedProps.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:11px; padding:10px;">No animated props yet</div>';
                return;
            }

            animatedProps.forEach((prop, i) => {
                const item = document.createElement('div');
                const isSelected = (currentAnimPropIndex === i);
                item.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px; background:' + (isSelected ? '#4a4a6e' : '#333') + '; border:2px solid ' + (isSelected ? '#4af' : 'transparent') + '; border-radius:5px; margin-bottom:5px; cursor:pointer;';
                item.onclick = () => {
                    // Toggle - clicking same one deselects
                    if (currentAnimPropIndex === i) {
                        currentAnimPropIndex = -1;
                    } else {
                        currentAnimPropIndex = i;
                        currentStaticObjIndex = -1; // Deselect static objects
                    }
                    updateAnimPropListDisplay();
                    updateStaticObjectsList();
                };

                // Preview thumbnail
                if (prop.frames && prop.frames.length > 0) {
                    const canvas = document.createElement('canvas');
                    canvas.width = 32;
                    canvas.height = 32;
                    canvas.style.cssText = 'border:1px solid #555; image-rendering:pixelated;';
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = false;

                    const frame = prop.frames[0];
                    if (prop._spriteImg) {
                        ctx.drawImage(prop._spriteImg, frame.x, frame.y, frame.w, frame.h, 0, 0, 32, 32);
                    } else if (prop.spriteData) {
                        // Fallback: load image if _spriteImg not available
                        const img = new Image();
                        img.onload = () => {
                            prop._spriteImg = img;
                            ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, 32, 32);
                        };
                        img.src = prop.spriteData;
                    }
                    item.appendChild(canvas);
                }

                const info = document.createElement('div');
                info.style.flex = '1';
                info.innerHTML = '<div style="color:#4af; font-weight:bold;">' + prop.name + '</div>' +
                    '<div style="font-size:10px; color:#888;">' + prop.frames.length + ' frames | ' + prop.type + '</div>';
                item.appendChild(info);

                // Edit button
                const editBtn = document.createElement('button');
                editBtn.textContent = 'Edit';
                editBtn.style.cssText = 'padding:4px 8px; font-size:10px;';
                editBtn.onclick = (e) => { e.stopPropagation(); openAnimPropEditor(i); };
                item.appendChild(editBtn);

                // Delete button
                const delBtn = document.createElement('button');
                delBtn.textContent = '×';
                delBtn.style.cssText = 'padding:4px 8px; font-size:10px; background:#a55;';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    // Wave 5: walk layers to count animTile cells that will be affected.
                    let placedOnMaps = 0;
                    try {
                        for (const mName of Object.keys(maps || {})) {
                            const m = maps[mName];
                            if (!m || !Array.isArray(m.layers)) continue;
                            for (const layer of m.layers) {
                                if (!Array.isArray(layer)) continue;
                                for (const row of layer) {
                                    if (!Array.isArray(row)) continue;
                                    for (const cell of row) {
                                        if (cell && cell.type === 'animTile' && cell.propIndex === i) placedOnMaps++;
                                    }
                                }
                            }
                        }
                    } catch (_) {}
                    const msg = placedOnMaps > 0
                        ? `Delete "${prop.name}"?\n\n${placedOnMaps} placed tile(s) referencing this prop will also be removed.`
                        : 'Delete "' + prop.name + '"?';
                    if (confirm(msg)) {
                        const deleteIndex = i;
                        animatedProps.splice(deleteIndex, 1);
                        // Wave 5: reindex every animTile cell in every map's every layer + legacy placedAnimProps.
                        reindexAnimPropReferences(deleteIndex);
                        broadcastEdit({ editType: 'removeAnimProp', index: deleteIndex });
                        updateAnimPropListDisplay();
                        renderMap();
                    }
                };
                item.appendChild(delBtn);

                container.appendChild(item);
            });
        }

        // ========== STATIC OBJECTS LIST ==========
        function updateStaticObjectsList() {
            const container = document.getElementById('staticObjList');
            if (!container) return;
            container.innerHTML = '';

            if (staticObjects.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:11px; padding:10px; text-align:center;">No static objects yet</div>';
                return;
            }

            staticObjects.forEach((obj, i) => {
                const item = document.createElement('div');
                const isSelected = (currentStaticObjIndex === i);
                item.style.cssText = `
                    display:flex; align-items:center; gap:8px; padding:6px 8px;
                    background:${isSelected ? '#2a4a3a' : '#333'};
                    border:2px solid ${isSelected ? '#4a7c59' : 'transparent'};
                    border-radius:5px; cursor:pointer; min-width:120px;
                `;
                item.onclick = () => selectStaticObject(i);

                // Preview thumbnail
                const canvas = document.createElement('canvas');
                canvas.width = 32;
                canvas.height = 32;
                canvas.style.cssText = 'border:1px solid #555; image-rendering:pixelated; flex-shrink:0;';
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;

                if (obj._spriteImg && obj._spriteImg.complete) {
                    const srcW = obj.width * gridSize;
                    const srcH = obj.height * gridSize;
                    const scale = Math.min(32 / srcW, 32 / srcH);
                    const drawW = srcW * scale;
                    const drawH = srcH * scale;
                    ctx.drawImage(obj._spriteImg, 0, 0, srcW, srcH,
                                 (32 - drawW) / 2, (32 - drawH) / 2, drawW, drawH);
                } else if (obj.spriteData) {
                    // Fallback: load image if _spriteImg not ready
                    const img = new Image();
                    img.onload = () => {
                        obj._spriteImg = img;
                        const srcW = obj.width * gridSize;
                        const srcH = obj.height * gridSize;
                        const scale = Math.min(32 / srcW, 32 / srcH);
                        const drawW = srcW * scale;
                        const drawH = srcH * scale;
                        ctx.drawImage(img, 0, 0, srcW, srcH,
                                     (32 - drawW) / 2, (32 - drawH) / 2, drawW, drawH);
                    };
                    img.src = obj.spriteData;
                }
                item.appendChild(canvas);

                // Info text
                const info = document.createElement('div');
                info.style.cssText = 'flex:1; min-width:0;';
                info.innerHTML = `
                    <div style="color:#4a7c59; font-weight:bold; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${obj.name}</div>
                    <div style="font-size:9px; color:#888;">${obj.width}x${obj.height} tiles</div>
                `;
                item.appendChild(info);

                // Delete button
                const delBtn = document.createElement('button');
                delBtn.textContent = '×';
                delBtn.style.cssText = 'padding:2px 6px; font-size:12px; background:#a55; border:none; color:white; cursor:pointer; border-radius:3px;';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    deleteStaticObject(i);
                };
                item.appendChild(delBtn);

                container.appendChild(item);
            });
        }

        function selectStaticObject(index) {
            // Toggle - clicking same one deselects
            if (currentStaticObjIndex === index) {
                currentStaticObjIndex = -1;
            } else {
                currentStaticObjIndex = index;
                currentAnimPropIndex = -1; // Deselect animated props
            }

            updateStaticObjectsList();
            updateAnimPropListDisplay();

            // Show/hide placement controls
            const controls = document.getElementById('staticObjPlacementControls');
            if (controls) {
                controls.style.display = (currentStaticObjIndex >= 0) ? 'block' : 'none';
            }
        }

        function deleteStaticObject(index) {
            const obj = staticObjects[index];
            if (!obj) return;

            if (!confirm('Delete "' + obj.name + '"?\n\nAll placed instances will also be removed.')) return;

            // Remove placed instances
            placedStaticObjects = placedStaticObjects.filter(p => p.objIndex !== index);

            // Update indices for remaining placements
            placedStaticObjects.forEach(p => {
                if (p.objIndex > index) p.objIndex--;
            });

            // Remove from array
            staticObjects.splice(index, 1);

            // Fix selection
            if (currentStaticObjIndex >= staticObjects.length) {
                currentStaticObjIndex = staticObjects.length - 1;
            }
            if (currentStaticObjIndex < 0) {
                const controls = document.getElementById('staticObjPlacementControls');
                if (controls) controls.style.display = 'none';
            }

            // Broadcast
            broadcastEdit({ editType: 'removeStaticObj', index: index });

            updateStaticObjectsList();
            renderMap();
        }

        // ===== INDEXEDDB STORAGE =====
        let projectDB = null;

        function initProjectDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open('WorldBuilderDB', 1);
                request.onerror = () => {
                    console.error('IndexedDB error:', request.error);
                    reject(request.error);
                };
                request.onsuccess = () => {
                    projectDB = request.result;
                    console.log('IndexedDB opened successfully');
                    resolve(projectDB);
                };
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('projects')) {
                        db.createObjectStore('projects');
                        console.log('Created projects object store');
                    }
                };
            });
        }

        async function saveProjectToDB(data) {
            try {
                if (!projectDB) await initProjectDB();
                return new Promise((resolve, reject) => {
                    const tx = projectDB.transaction('projects', 'readwrite');
                    const store = tx.objectStore('projects');
                    const request = store.put(data, 'current');
                    request.onsuccess = () => {
                        console.log('Project saved to IndexedDB');
                        resolve();
                    };
                    request.onerror = () => {
                        console.error('IndexedDB save error:', request.error);
                        reject(request.error);
                    };
                });
            } catch (err) {
                console.error('saveProjectToDB error:', err);
                throw err;
            }
        }

        async function loadProjectFromDB() {
            try {
                if (!projectDB) await initProjectDB();
                return new Promise((resolve, reject) => {
                    const tx = projectDB.transaction('projects', 'readonly');
                    const store = tx.objectStore('projects');
                    const request = store.get('current');
                    request.onsuccess = () => {
                        resolve(request.result);
                    };
                    request.onerror = () => {
                        console.error('IndexedDB load error:', request.error);
                        reject(request.error);
                    };
                });
            } catch (err) {
                console.error('loadProjectFromDB error:', err);
                throw err;
            }
        }

        // ===== Wave 3 feature: named builder saves (multiple IndexedDB slots) =====
        function _slotKey(name) { return 'named:' + name; }

        async function saveNamedProjectToDB(name, data) {
            if (!name) throw new Error('save name required');
            if (!projectDB) await initProjectDB();
            return new Promise((resolve, reject) => {
                const tx = projectDB.transaction('projects', 'readwrite');
                tx.objectStore('projects').put(data, _slotKey(name));
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }

        async function loadNamedProjectFromDB(name) {
            if (!projectDB) await initProjectDB();
            return new Promise((resolve, reject) => {
                const tx = projectDB.transaction('projects', 'readonly');
                const request = tx.objectStore('projects').get(_slotKey(name));
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async function deleteNamedProjectFromDB(name) {
            if (!projectDB) await initProjectDB();
            return new Promise((resolve, reject) => {
                const tx = projectDB.transaction('projects', 'readwrite');
                tx.objectStore('projects').delete(_slotKey(name));
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }

        async function listNamedProjects() {
            if (!projectDB) await initProjectDB();
            return new Promise((resolve, reject) => {
                const tx = projectDB.transaction('projects', 'readonly');
                const request = tx.objectStore('projects').getAllKeys();
                request.onsuccess = () => {
                    const all = request.result || [];
                    resolve(all.filter(k => typeof k === 'string' && k.startsWith('named:'))
                               .map(k => k.slice('named:'.length)));
                };
                request.onerror = () => reject(request.error);
            });
        }

        // Public: Save As… prompts for a name and writes to a new slot.
        async function saveProjectAs() {
            const defaultName = (typeof currentSaveName === 'string' && currentSaveName) ? currentSaveName : '';
            const raw = prompt('Name this save:', defaultName);
            if (raw === null) return;
            const name = raw.trim();
            if (!name) { alert('Name cannot be empty.'); return; }
            try {
                const existing = await loadNamedProjectFromDB(name);
                if (existing && !confirm(`"${name}" already exists. Overwrite?`)) return;
                const data = getProjectData();
                data.saveName = name;
                await saveNamedProjectToDB(name, data);
                currentSaveName = name;
                console.log('[SAVE] Saved as:', name);
                alert('Saved as "' + name + '"');
            } catch (e) {
                console.error('[SAVE] saveProjectAs error:', e);
                alert('Save failed — see console.');
            }
        }

        // Public: opens a picker listing named saves with load/delete controls.
        async function showNamedSavesPicker() {
            try {
                const names = (await listNamedProjects()).sort();
                if (names.length === 0) { alert('No named saves yet. Use "Save As…" to create one.'); return; }
                const picker = document.getElementById('namedSavesPicker');
                if (!picker) return;
                // Build DOM programmatically to avoid string-escaping pitfalls.
                picker.innerHTML = '';
                for (const n of names) {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex; gap:6px; margin:4px 0; align-items:center;';
                    const label = document.createElement('span');
                    label.style.cssText = 'flex:1; color:#4af; font-size:10px;';
                    label.textContent = n;
                    const loadBtn = document.createElement('button');
                    loadBtn.className = 'retro-btn';
                    loadBtn.style.cssText = 'font-size:9px; padding:3px 6px;';
                    loadBtn.textContent = 'LOAD';
                    loadBtn.onclick = () => loadNamedProject(n);
                    const delBtn = document.createElement('button');
                    delBtn.className = 'retro-btn';
                    delBtn.style.cssText = 'font-size:9px; padding:3px 6px; background:#a55;';
                    delBtn.textContent = '×';
                    delBtn.onclick = () => deleteNamedProject(n);
                    row.appendChild(label);
                    row.appendChild(loadBtn);
                    row.appendChild(delBtn);
                    picker.appendChild(row);
                }
                picker.style.display = 'block';
            } catch (e) { console.error(e); }
        }

        async function loadNamedProject(name) {
            try {
                const data = await loadNamedProjectFromDB(name);
                if (!data) { alert('Save "' + name + '" not found.'); return; }
                currentSaveName = name;
                await loadProject(data);
                const picker = document.getElementById('namedSavesPicker');
                if (picker) picker.style.display = 'none';
            } catch (e) {
                console.error('[LOAD] loadNamedProject error:', e);
                alert('Load failed — see console.');
            }
        }

        async function deleteNamedProject(name) {
            if (!confirm('Delete save "' + name + '"? This cannot be undone.')) return;
            try {
                await deleteNamedProjectFromDB(name);
                if (currentSaveName === name) currentSaveName = '';
                showNamedSavesPicker();
            } catch (e) { console.error(e); }
        }

        let currentSaveName = '';
        // ===== end Wave 3 named-saves feature =====

        async function showStorageInfo() {
            const data = getProjectData();
            const json = JSON.stringify(data);
            const totalMB = (json.length / 1000000).toFixed(2);

            // Get storage quota (if available)
            let quotaInfo = 'Unknown';
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                const usedMB = (estimate.usage / 1000000).toFixed(2);
                const quotaMB = (estimate.quota / 1000000).toFixed(0);
                quotaInfo = usedMB + 'MB / ' + quotaMB + 'MB';
            }

            // Breakdown by component
            const soundsSize = JSON.stringify(data.sounds || []).length;
            const tilesetsSize = JSON.stringify(data.tilesets || []).length;
            const propsSize = JSON.stringify(data.props || []).length;
            const animPropsSize = JSON.stringify(data.animatedProps || []).length;
            const npcsSize = JSON.stringify(data.npcs || []).length;
            const mapSize = JSON.stringify(data.layers || []).length;

            alert('Project Size: ' + totalMB + 'MB\n' +
                'Browser Storage: ' + quotaInfo + '\n\n' +
                'Breakdown:\n' +
                '- Sounds: ' + (soundsSize/1000000).toFixed(2) + 'MB\n' +
                '- Tilesets: ' + (tilesetsSize/1000000).toFixed(2) + 'MB\n' +
                '- Props: ' + (propsSize/1000000).toFixed(2) + 'MB\n' +
                '- Animated Props: ' + (animPropsSize/1000000).toFixed(2) + 'MB\n' +
                '- NPCs: ' + (npcsSize/1000000).toFixed(2) + 'MB\n' +
                '- Map Data: ' + (mapSize/1000000).toFixed(2) + 'MB');
        }

        // Initialize IndexedDB on page load
        initProjectDB().catch(err => console.warn('IndexedDB init failed, will use localStorage:', err));

        // ===== QUEST SYSTEM FUNCTIONS =====

        function generateQuestId() {
            return 'quest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }

        function addNewQuest() {
            const newQuest = {
                id: generateQuestId(),
                name: 'New Quest ' + (quests.length + 1),
                description: '',
                conditions: [],
                onComplete: {
                    giveItems: [],
                    removeItems: []
                },
                startNpcUid: '',
                turnInNpcUid: '',
                startDialogId: '',    // Dialog shown when offering quest
                activeDialogId: '',   // Dialog shown while quest is active (reminder)
                completeDialogId: '', // Dialog shown when turning in quest
                prerequisites: [],
                autoStart: false,
                isRepeatable: false
            };
            quests.push(newQuest);
            broadcastEdit({ editType: 'addQuest', quest: newQuest });
            renderQuestList();
            selectQuest(quests.length - 1);
        }

        function selectQuest(index) {
            selectedQuestIndex = index;
            renderQuestList();

            const panel = document.getElementById('questEditorPanel');
            if (index < 0 || index >= quests.length) {
                panel.style.display = 'none';
                return;
            }

            panel.style.display = 'block';
            loadQuestIntoEditor(index);
        }

        function loadQuestIntoEditor(index) {
            const quest = quests[index];
            if (!quest) return;

            // The "Add Condition" type dropdown is a global control for what to add NEXT — it isn't
            // tied to the quest. Reset it on every quest switch so a stale value (e.g. "Kill") doesn't
            // look like it's this quest's condition.
            const condTypeSel = document.getElementById('conditionType');
            if (condTypeSel) condTypeSel.selectedIndex = 0;

            document.getElementById('questName').value = quest.name || '';
            document.getElementById('questDescription').value = quest.description || '';
            document.getElementById('questAutoStart').checked = quest.autoStart || false;
            document.getElementById('questRepeatable').checked = quest.isRepeatable || false;

            // Load quest start sound from library
            updateQuestSoundDropdown();

            // Update NPC display names
            updateQuestNpcDisplayNames();

            // Update dialog dropdowns
            updateQuestDialogDropdowns();

            // Update prerequisites
            updateQuestPrereqDropdown();
            renderQuestPrerequisites();

            renderQuestConditions();
            renderQuestRewards();
        }

        // Populate quest dialog dropdowns with available dialogs
        function updateQuestDialogDropdowns() {
            const startSelect = document.getElementById('questStartDialog');
            const activeSelect = document.getElementById('questActiveDialog');
            const completeSelect = document.getElementById('questCompleteDialog');
            const declineSelect = document.getElementById('questDeclineDialog');
            if (!startSelect || !activeSelect || !completeSelect) return;

            // Build dialog options
            let options = '<option value="">(None - skip)</option>';
            dialogs.forEach((d, i) => {
                const name = d.name || 'Dialog ' + (i + 1);
                options += '<option value="' + i + '">' + name + '</option>';
            });

            startSelect.innerHTML = options;
            activeSelect.innerHTML = options;
            completeSelect.innerHTML = options;
            if (declineSelect) declineSelect.innerHTML = options;

            // Set selected values from current quest
            const quest = quests[selectedQuestIndex];
            if (quest) {
                if (quest.startDialogId !== undefined && quest.startDialogId !== '') {
                    startSelect.value = quest.startDialogId;
                }
                if (quest.activeDialogId !== undefined && quest.activeDialogId !== '') {
                    activeSelect.value = quest.activeDialogId;
                }
                if (quest.completeDialogId !== undefined && quest.completeDialogId !== '') {
                    completeSelect.value = quest.completeDialogId;
                }
                if (declineSelect && quest.declineDialogId !== undefined && quest.declineDialogId !== '') {
                    declineSelect.value = quest.declineDialogId;
                }
            }
        }

        // Edit existing dialog from quest tab
        function editQuestDialog(type) {
            const selectMap = {
                'start': 'questStartDialog',
                'active': 'questActiveDialog',
                'complete': 'questCompleteDialog',
                'decline': 'questDeclineDialog'
            };
            const select = document.getElementById(selectMap[type]);
            if (!select) return;

            const dialogIndex = parseInt(select.value);
            if (isNaN(dialogIndex) || dialogIndex < 0 || dialogIndex >= dialogs.length) {
                alert('No dialog selected. Use + to create one first.');
                return;
            }

            // Open the dialog editor with the selected dialog
            openDialogEditor(dialogIndex);
        }

        // Open dialog creator/picker for quest dialog
        let questDialogPickerType = null; // 'start', 'active', or 'complete'

        function openDialogPickerForQuest(type) {
            questDialogPickerType = type;
            // Open the dialog editor with a new dialog
            openDialogEditor(-1);
            // Show hint to user
            const typeLabels = { start: 'Offer Quest', active: 'While Active', complete: 'Turn In', decline: 'If Declined' };
            setTimeout(() => {
                const nameInput = document.getElementById('dialogName');
                if (nameInput) {
                    const quest = quests[selectedQuestIndex];
                    const questName = quest?.name || 'Quest';
                    nameInput.value = questName + ' - ' + typeLabels[type];
                }
            }, 100);
        }

        // Hook into dialog save to auto-attach to quest
        function attachNewDialogToQuest(dialogIndex) {
            if (questDialogPickerType && selectedQuestIndex >= 0) {
                const fieldMap = {
                    'start': 'startDialogId',
                    'active': 'activeDialogId',
                    'complete': 'completeDialogId',
                    'decline': 'declineDialogId'
                };
                const field = fieldMap[questDialogPickerType];
                if (field) {
                    updateQuestField(field, dialogIndex.toString());
                    updateQuestDialogDropdowns();
                }
                questDialogPickerType = null;
            }
        }

        function updateQuestField(field, value) {
            if (selectedQuestIndex < 0 || selectedQuestIndex >= quests.length) return;
            const quest = quests[selectedQuestIndex];
            quest[field] = value;
            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
            if (field === 'name') renderQuestList();
        }

        // Quest start sound library functions
        let questSoundPreviewAudio = null;

        function updateQuestSoundDropdown() {
            const select = document.getElementById('questStartSound');
            if (!select) return;

            // Build options from questSounds library
            let options = '<option value="-1">None</option>';
            questSounds.forEach((sound, i) => {
                options += '<option value="' + i + '">' + sound.name + '</option>';
            });
            select.innerHTML = options;

            // Set current quest's sound index
            const quest = quests[selectedQuestIndex];
            if (quest && quest.startSoundIndex !== undefined && quest.startSoundIndex >= 0) {
                select.value = quest.startSoundIndex;
            }

            // Update count label
            const countEl = document.getElementById('questSoundCount');
            if (countEl) {
                countEl.textContent = questSounds.length + ' sound(s) in library';
            }
        }

        function previewQuestStartSound() {
            const select = document.getElementById('questStartSound');
            const index = parseInt(select?.value);
            if (index < 0 || index >= questSounds.length) return;

            // Stop any playing preview
            if (questSoundPreviewAudio) {
                questSoundPreviewAudio.pause();
                questSoundPreviewAudio = null;
            }

            const sound = questSounds[index];
            if (sound && sound.data) {
                questSoundPreviewAudio = new Audio(sound.data);
                questSoundPreviewAudio.volume = 0.7;
                questSoundPreviewAudio.play().catch(e => console.log('Preview failed:', e));
            }
        }

        function uploadQuestSound() {
            document.getElementById('questSoundUpload').click();
        }

        function handleQuestSoundUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                const name = file.name.replace(/\.[^/.]+$/, ''); // Remove extension

                // Add to library
                questSounds.push({ name: name, data: dataUrl });
                const newIndex = questSounds.length - 1;

                // Broadcast to other builders
                broadcastEdit({ editType: 'addQuestSound', sound: { name: name, data: dataUrl } });

                // Update dropdown and select new sound
                updateQuestSoundDropdown();
                document.getElementById('questStartSound').value = newIndex;
                updateQuestField('startSoundIndex', newIndex);

                console.log('[QUEST SOUND] Added:', name);
            };
            reader.readAsDataURL(file);

            // Reset file input
            event.target.value = '';
        }

        function deleteQuestSound() {
            const select = document.getElementById('questStartSound');
            const index = parseInt(select?.value);
            if (index < 0 || index >= questSounds.length) return;

            const soundName = questSounds[index].name;
            if (!confirm('Delete sound "' + soundName + '" from library?')) return;

            // Remove from library
            questSounds.splice(index, 1);

            // Broadcast deletion
            broadcastEdit({ editType: 'deleteQuestSound', index: index });

            // Update all quests that used this or higher indices
            quests.forEach(quest => {
                if (quest.startSoundIndex === index) {
                    quest.startSoundIndex = -1;
                } else if (quest.startSoundIndex > index) {
                    quest.startSoundIndex--;
                }
            });

            // Update UI
            updateQuestSoundDropdown();
            console.log('[QUEST SOUND] Deleted:', soundName);
        }

        function deleteCurrentQuest() {
            if (selectedQuestIndex < 0 || selectedQuestIndex >= quests.length) return;
            if (!confirm('Delete quest "' + quests[selectedQuestIndex].name + '"?')) return;

            const questId = quests[selectedQuestIndex].id;
            quests.splice(selectedQuestIndex, 1);
            broadcastEdit({ editType: 'deleteQuest', questId: questId });
            selectedQuestIndex = -1;
            renderQuestList();
            document.getElementById('questEditorPanel').style.display = 'none';
        }

        // Quest prerequisites - require specific quests to be completed
        function updateQuestPrereqDropdown() {
            const select = document.getElementById('questPrereqSelect');
            if (!select) return;

            const currentQuest = quests[selectedQuestIndex];
            if (!currentQuest) return;

            // Show all other quests except current one and already added prereqs
            const prereqs = currentQuest.prerequisites || [];
            let options = '<option value="">Select quest...</option>';
            quests.forEach((q, i) => {
                if (i === selectedQuestIndex) return; // Can't require itself
                if (prereqs.includes(q.id)) return; // Already a prereq
                options += '<option value="' + q.id + '">' + (q.name || 'Quest ' + (i + 1)) + '</option>';
            });
            select.innerHTML = options;
        }

        function renderQuestPrerequisites() {
            const container = document.getElementById('questPrereqList');
            if (!container) return;

            const quest = quests[selectedQuestIndex];
            if (!quest || !quest.prerequisites || quest.prerequisites.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px;">None (available from start)</div>';
                return;
            }

            container.innerHTML = quest.prerequisites.map((prereqId, i) => {
                const prereqQuest = quests.find(q => q.id === prereqId);
                const name = prereqQuest ? (prereqQuest.name || prereqId) : prereqId + ' (not found)';
                return '<div style="display:flex; justify-content:space-between; align-items:center; padding:3px; margin:2px 0; background:#333; border-radius:3px; font-size:10px;">' +
                    '<span style="color:#fa0;">' + name + '</span>' +
                    '<button onclick="removeQuestPrerequisite(' + i + ')" style="padding:1px 5px; font-size:9px; background:#a55; border:none; color:#fff; cursor:pointer;">×</button>' +
                '</div>';
            }).join('');
        }

        function addQuestPrerequisite() {
            if (selectedQuestIndex < 0) return;
            const select = document.getElementById('questPrereqSelect');
            const prereqId = select.value;
            if (!prereqId) return;

            const quest = quests[selectedQuestIndex];
            if (!quest.prerequisites) quest.prerequisites = [];
            if (quest.prerequisites.includes(prereqId)) return;

            quest.prerequisites.push(prereqId);
            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });

            updateQuestPrereqDropdown();
            renderQuestPrerequisites();
        }

        function removeQuestPrerequisite(index) {
            if (selectedQuestIndex < 0) return;
            const quest = quests[selectedQuestIndex];
            if (!quest.prerequisites) return;

            quest.prerequisites.splice(index, 1);
            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });

            updateQuestPrereqDropdown();
            renderQuestPrerequisites();
        }

        function renderQuestList() {
            const container = document.getElementById('questList');
            if (!container) return;

            if (quests.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:11px; text-align:center; padding:10px;">No quests created</div>';
                return;
            }

            // Find NPCs with multiple quests
            const npcQuestCounts = {};
            quests.forEach(q => {
                if (q.startNpcUid) {
                    npcQuestCounts[q.startNpcUid] = (npcQuestCounts[q.startNpcUid] || 0) + 1;
                }
            });

            container.innerHTML = quests.map((q, i) => {
                const isSelected = i === selectedQuestIndex;
                const condCount = q.conditions?.length || 0;
                const prereqCount = q.prerequisites?.length || 0;
                const hasMultiQuestNpc = q.startNpcUid && npcQuestCounts[q.startNpcUid] > 1;
                const multiQuestBadge = hasMultiQuestNpc ?
                    '<span style="background:#fa0; color:#000; padding:1px 4px; border-radius:3px; font-size:9px; font-weight:bold; margin-left:5px;" title="This NPC has multiple quests - order matters!">#' + (i + 1) + '</span>' : '';
                const prereqBadge = prereqCount > 0 ?
                    '<span style="background:#a80; color:#fff; padding:1px 4px; border-radius:3px; font-size:9px; margin-left:5px;" title="Requires ' + prereqCount + ' quest(s) completed first">🔒' + prereqCount + '</span>' : '';
                const npcName = getNpcNameByUid(q.startNpcUid);
                const npcInfo = npcName ? '<span style="color:#8cf;"> → ' + npcName + '</span>' : '';

                return '<div draggable="true" ondragstart="questDragStart(event, ' + i + ')" ondragover="questDragOver(event)" ondrop="questDrop(event, ' + i + ')" onclick="selectQuest(' + i + ')" style="padding:8px; margin:3px 0; background:' + (isSelected ? '#4a4a7a' : '#333') + '; border-radius:4px; cursor:pointer; border:2px solid ' + (isSelected ? '#a8f' : 'transparent') + '; display:flex; align-items:center; gap:8px;">' +
                    '<span style="cursor:grab; color:#666; font-size:14px;" title="Drag to reorder">⋮⋮</span>' +
                    '<div style="flex:1;">' +
                        '<div style="font-size:12px; color:#fff;">' + (q.name || 'Unnamed Quest') + multiQuestBadge + prereqBadge + '</div>' +
                        '<div style="font-size:10px; color:#888;">' + condCount + ' condition' + (condCount !== 1 ? 's' : '') + npcInfo + '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
        }

        // Helper to get NPC name by UID
        function getNpcNameByUid(uid) {
            if (!uid) return null;
            const placed = placedNpcs.find(p => p.uid === uid);
            if (!placed) return null;
            const npcDef = npcs[placed.npcIndex];
            return npcDef?.name || 'NPC';
        }

        // Quest drag and drop for reordering
        let questDragIndex = -1;

        function questDragStart(e, index) {
            questDragIndex = index;
            e.dataTransfer.effectAllowed = 'move';
            e.target.style.opacity = '0.5';
        }

        function questDragOver(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        }

        function questDrop(e, dropIndex) {
            e.preventDefault();
            e.target.style.opacity = '1';

            if (questDragIndex < 0 || questDragIndex === dropIndex) return;

            // Reorder quests array
            const draggedQuest = quests[questDragIndex];
            quests.splice(questDragIndex, 1);
            quests.splice(dropIndex, 0, draggedQuest);

            // Update selection if needed
            if (selectedQuestIndex === questDragIndex) {
                selectedQuestIndex = dropIndex;
            } else if (selectedQuestIndex > questDragIndex && selectedQuestIndex <= dropIndex) {
                selectedQuestIndex--;
            } else if (selectedQuestIndex < questDragIndex && selectedQuestIndex >= dropIndex) {
                selectedQuestIndex++;
            }

            // Broadcast the reorder
            broadcastEdit({ editType: 'reorderQuests', quests: quests.map(q => q.id) });

            questDragIndex = -1;
            renderQuestList();
        }

        function updateQuestNpcDropdowns() {
            const startSelect = document.getElementById('questStartNpc');
            const turnInSelect = document.getElementById('questTurnInNpc');
            if (!startSelect || !turnInSelect) return;

            // Build NPC options from placed NPCs
            let options = '<option value="">(None)</option>';
            placedNpcs.forEach((placed, i) => {
                const npcDef = npcs[placed.npcIndex];
                const name = npcDef?.name || 'NPC ' + i;
                const uid = placed.uid || 'npc_' + i;  // Generate UID if not present
                if (!placed.uid) placed.uid = uid;  // Store it
                options += '<option value="' + uid + '">' + name + ' at (' + placed.x + ',' + placed.y + ')</option>';
            });

            startSelect.innerHTML = options;
            turnInSelect.innerHTML = '<option value="">(Same as quest giver)</option>' + options.substring(options.indexOf('</option>') + 9);
        }

        function renderQuestConditions() {
            const container = document.getElementById('questConditions');
            if (!container) return;

            const quest = quests[selectedQuestIndex];
            if (!quest || !quest.conditions || quest.conditions.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px;">No conditions</div>';
                return;
            }

            container.innerHTML = quest.conditions.map((c, i) => {
                const typeLabels = { enemyDefeated: 'Kill', talkedToNpc: 'Talk', locationVisited: 'Visit', hasItem: 'Has Item' };
                const isBroken = c.broken;
                // hasItem and enemyDefeated need a quantity — show an editable count so "3 pineapples"
                // is ONE condition (count:3), not three duplicate "have ≥1" conditions.
                const usesCount = (c.type === 'hasItem' || c.type === 'enemyDefeated');
                const countInput = usesCount
                    ? '<span style="color:#888; margin-left:6px;">×</span>' +
                      '<input type="number" min="1" value="' + (c.count || 1) + '" title="how many required" ' +
                      'onchange="updateConditionCount(' + i + ', this.value)" ' +
                      'style="width:42px; margin:0 4px; font-size:10px; background:#222; color:#0ff; border:1px solid #555; border-radius:3px; text-align:center;">'
                    : '';
                return '<div style="display:flex; justify-content:space-between; align-items:center; padding:4px; margin:2px 0; background:' + (isBroken ? '#4a2a2a' : '#333') + '; border-radius:3px; font-size:10px;">' +
                    '<span style="color:' + (isBroken ? '#f88' : '#fff') + '; flex:1;">' + (typeLabels[c.type] || c.type) + ': ' + (c.displayName || 'Unknown') + '</span>' +
                    countInput +
                    '<button onclick="removeQuestCondition(' + i + ')" style="padding:2px 6px; font-size:9px; background:#a55;">×</button>' +
                '</div>';
            }).join('');
        }

        function updateConditionCount(index, value) {
            if (selectedQuestIndex < 0) return;
            const quest = quests[selectedQuestIndex];
            if (!quest.conditions || !quest.conditions[index]) return;
            quest.conditions[index].count = Math.max(1, parseInt(value) || 1);
            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
        }

        function removeQuestCondition(index) {
            if (selectedQuestIndex < 0) return;
            const quest = quests[selectedQuestIndex];
            if (!quest.conditions) return;
            quest.conditions.splice(index, 1);
            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
            renderQuestConditions();
        }

        function renderQuestRewards() {
            const container = document.getElementById('questRewards');
            if (!container) return;

            const quest = quests[selectedQuestIndex];
            let giveItems = quest?.onComplete?.giveItems || [];

            // Normalize old format (array of strings) to new format (array of objects with quantity)
            giveItems = normalizeQuestRewards(giveItems);

            if (giveItems.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px;">No rewards</div>';
                return;
            }

            container.innerHTML = giveItems.map((reward, i) => {
                const itemId = typeof reward === 'string' ? reward : reward.itemId;
                const quantity = typeof reward === 'object' ? (reward.quantity || 1) : 1;
                const item = items.find(it => it.id === itemId) || { name: 'Unknown Item' };
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:4px; margin:2px 0; background:#2a3a2a; border-radius:3px; font-size:10px;">
                    <span style="color:#4f8;">Give: ${item.name || itemId}</span>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <span style="color:#888;">x</span>
                        <input type="number" value="${quantity}" min="1" max="99" style="width:40px; background:#333; color:#fff; border:1px solid #555; padding:2px; font-size:10px;" onchange="updateQuestRewardQuantity(${i}, this.value)">
                        <button onclick="removeQuestReward(${i})" style="padding:2px 6px; font-size:9px; background:#a55;">×</button>
                    </div>
                </div>`;
            }).join('');
        }

        // Normalize old format rewards to new format
        function normalizeQuestRewards(giveItems) {
            if (!giveItems || giveItems.length === 0) return [];
            return giveItems.map(item => {
                if (typeof item === 'string') {
                    return { itemId: item, quantity: 1 };
                }
                return item;
            });
        }

        function addQuestReward() {
            if (selectedQuestIndex < 0) return;
            if (items.length === 0) {
                alert('Create some items first in the Items tab!');
                return;
            }

            // Show item picker popup with quantity input
            let html = '<div style="position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#222; padding:20px; border-radius:8px; border:2px solid #4f8; z-index:10000; max-height:80vh; overflow:auto;">';
            html += '<h3 style="margin:0 0 10px 0; color:#4f8;">Select Item to Give</h3>';
            html += '<div style="margin-bottom:10px; display:flex; align-items:center; gap:5px;">';
            html += '<label style="color:#888; font-size:10px;">Quantity:</label>';
            html += '<input type="number" id="rewardQuantityInput" value="1" min="1" max="99" style="width:50px; background:#333; color:#fff; border:1px solid #555; padding:3px;">';
            html += '</div>';
            items.forEach((item, i) => {
                const itemId = item.id || 'item_' + i;
                if (!item.id) item.id = itemId;
                html += '<div onclick="selectRewardItem(\'' + itemId + '\')" style="padding:8px; margin:5px 0; background:#333; border-radius:4px; cursor:pointer;">' + (item.name || 'Item ' + i) + '</div>';
            });
            html += '<button onclick="closeItemPickerPopup()" style="margin-top:10px; width:100%;">Cancel</button>';
            html += '</div><div id="itemPickerOverlay" onclick="closeItemPickerPopup()" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:9999;"></div>';

            const popup = document.createElement('div');
            popup.id = 'itemPickerPopup';
            popup.innerHTML = html;
            document.body.appendChild(popup);
        }

        function selectRewardItem(itemId) {
            if (selectedQuestIndex < 0) return;
            const quest = quests[selectedQuestIndex];
            if (!quest.onComplete) quest.onComplete = {};
            if (!quest.onComplete.giveItems) quest.onComplete.giveItems = [];

            // Get quantity from input
            const quantityInput = document.getElementById('rewardQuantityInput');
            const quantity = parseInt(quantityInput?.value) || 1;

            // Normalize existing rewards and add new one
            quest.onComplete.giveItems = normalizeQuestRewards(quest.onComplete.giveItems);
            quest.onComplete.giveItems.push({ itemId: itemId, quantity: quantity });

            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
            closeItemPickerPopup();
            renderQuestRewards();
        }

        function updateQuestRewardQuantity(index, value) {
            if (selectedQuestIndex < 0) return;
            const quest = quests[selectedQuestIndex];
            if (!quest.onComplete?.giveItems) return;

            // Normalize and update quantity
            quest.onComplete.giveItems = normalizeQuestRewards(quest.onComplete.giveItems);
            if (quest.onComplete.giveItems[index]) {
                quest.onComplete.giveItems[index].quantity = parseInt(value) || 1;
                broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
            }
        }

        function removeQuestReward(index) {
            if (selectedQuestIndex < 0) return;
            const quest = quests[selectedQuestIndex];
            if (!quest.onComplete?.giveItems) return;
            quest.onComplete.giveItems.splice(index, 1);
            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
            renderQuestRewards();
        }

        function closeItemPickerPopup() {
            const popup = document.getElementById('itemPickerPopup');
            if (popup) popup.remove();
        }

        // Condition setting mode
        function toggleSetCondition() {
            const type = document.getElementById('conditionType').value;

            if (settingConditionMode) {
                cancelSettingCondition();
                return;
            }

            if (!type) {
                const s = document.getElementById('conditionStatus');
                if (s) s.textContent = 'Pick a condition type first.';
                return;
            }

            if (type === 'hasItem') {
                showItemConditionPicker();
                return;
            }

            settingConditionMode = true;
            settingConditionType = type;

            const btn = document.getElementById('setConditionBtn');
            btn.textContent = 'CANCEL';
            btn.style.background = '#f55';

            const statusTexts = {
                'kill': 'Click on an ENEMY NPC on the map...',
                'talk': 'Click on any NPC on the map...',
                'visit': 'Click on a tile on the map...'
            };
            document.getElementById('conditionStatus').textContent = statusTexts[type] || 'Click on map...';

            renderMap();
        }

        function cancelSettingCondition() {
            settingConditionMode = false;
            settingConditionType = null;

            const btn = document.getElementById('setConditionBtn');
            btn.textContent = 'SET CONDITION';
            btn.style.background = 'linear-gradient(135deg, #0ff, #a8f)';
            document.getElementById('conditionStatus').textContent = '';

            renderMap();
        }

        function showItemConditionPicker() {
            if (items.length === 0) {
                alert('Create some items first in the Items tab!');
                return;
            }

            let html = '<div style="position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#222; padding:20px; border-radius:8px; border:2px solid #0ff; z-index:10000;">';
            html += '<h3 style="margin:0 0 10px 0; color:#0ff;">Select Required Item</h3>';
            items.forEach((item, i) => {
                const itemId = item.id || 'item_' + i;
                if (!item.id) item.id = itemId;
                html += '<div onclick="addItemCondition(\'' + itemId + '\', \'' + (item.name || 'Item ' + i).replace(/'/g, "\\'") + '\')" style="padding:8px; margin:5px 0; background:#333; border-radius:4px; cursor:pointer;">' + (item.name || 'Item ' + i) + '</div>';
            });
            html += '<button onclick="closeItemPickerPopup()" style="margin-top:10px; width:100%;">Cancel</button>';
            html += '</div><div id="itemPickerOverlay" onclick="closeItemPickerPopup()" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:9999;"></div>';

            const popup = document.createElement('div');
            popup.id = 'itemPickerPopup';
            popup.innerHTML = html;
            document.body.appendChild(popup);
        }

        function addItemCondition(itemId, itemName) {
            if (selectedQuestIndex < 0) return;
            const quest = quests[selectedQuestIndex];
            if (!quest.conditions) quest.conditions = [];

            quest.conditions.push({
                type: 'hasItem',
                targetUid: itemId,
                count: 1,
                displayName: itemName
            });

            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
            closeItemPickerPopup();
            renderQuestConditions();
        }

        function handleMapClickForCondition(tileX, tileY) {
            if (!settingConditionMode || selectedQuestIndex < 0) return false;

            const quest = quests[selectedQuestIndex];
            if (!quest.conditions) quest.conditions = [];

            const typeMap = { 'kill': 'enemyDefeated', 'talk': 'talkedToNpc', 'visit': 'locationVisited' };
            const internalType = typeMap[settingConditionType];

            if (settingConditionType === 'visit') {
                // Location visit condition
                quest.conditions.push({
                    type: 'locationVisited',
                    mapName: currentMapName,
                    x: tileX,
                    y: tileY,
                    displayName: 'Visit (' + tileX + ',' + tileY + ') on ' + currentMapName
                });
            } else {
                // NPC-based condition - find NPC at click position
                const npcIndex = findPlacedNpcAt(tileX, tileY);
                if (npcIndex < 0) {
                    document.getElementById('conditionStatus').textContent = 'No NPC there! Click on an NPC...';
                    return true;
                }

                const placed = placedNpcs[npcIndex];
                const npcDef = npcs[placed.npcIndex];
                const isEnemy = placed.isEnemy || npcDef?.isEnemy;

                if (settingConditionType === 'kill' && !isEnemy) {
                    document.getElementById('conditionStatus').textContent = 'That NPC is not an enemy! Click on an enemy...';
                    return true;
                }

                // Ensure NPC has a UID
                if (!placed.uid) placed.uid = 'npc_' + npcIndex + '_' + Date.now();

                const npcName = npcDef?.name || 'NPC';
                quest.conditions.push({
                    type: internalType,
                    targetUid: placed.uid,
                    displayName: (settingConditionType === 'kill' ? 'Kill ' : 'Talk to ') + npcName + ' at (' + placed.x + ',' + placed.y + ')'
                });
            }

            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
            cancelSettingCondition();
            renderQuestConditions();
            return true;
        }

        function findPlacedNpcAt(tileX, tileY) {
            for (let i = 0; i < placedNpcs.length; i++) {
                const placed = placedNpcs[i];
                if (placed.mapName && placed.mapName !== currentMapName) continue;
                if (placed.x === tileX && placed.y === tileY) return i;
            }
            return -1;
        }

        // ===== QUEST GIVER / TURN-IN NPC CLICK SELECTION =====
        let settingQuestGiverMode = false;
        let settingQuestTurnInMode = false;

        function toggleSetQuestGiver() {
            if (settingQuestGiverMode) {
                cancelSetQuestGiver();
                return;
            }
            // Cancel other modes
            if (settingConditionMode) cancelSettingCondition();
            if (settingQuestTurnInMode) cancelSetQuestTurnIn();

            settingQuestGiverMode = true;
            document.getElementById('setQuestGiverBtn').textContent = 'CANCEL';
            document.getElementById('setQuestGiverBtn').style.background = '#f44';
            document.getElementById('questGiverStatus').textContent = 'Click on an NPC on the map...';
            renderMap();
        }

        function cancelSetQuestGiver() {
            settingQuestGiverMode = false;
            document.getElementById('setQuestGiverBtn').textContent = 'CLICK NPC TO SET QUEST GIVER';
            document.getElementById('setQuestGiverBtn').style.background = 'linear-gradient(135deg, #fa0, #f80)';
            document.getElementById('questGiverStatus').textContent = '';
            renderMap();
        }

        function toggleSetQuestTurnIn() {
            if (settingQuestTurnInMode) {
                cancelSetQuestTurnIn();
                return;
            }
            // Cancel other modes
            if (settingConditionMode) cancelSettingCondition();
            if (settingQuestGiverMode) cancelSetQuestGiver();

            settingQuestTurnInMode = true;
            document.getElementById('setQuestTurnInBtn').textContent = 'CANCEL';
            document.getElementById('setQuestTurnInBtn').style.background = '#f44';
            document.getElementById('questTurnInStatus').textContent = 'Click on an NPC on the map...';
            renderMap();
        }

        function cancelSetQuestTurnIn() {
            settingQuestTurnInMode = false;
            document.getElementById('setQuestTurnInBtn').textContent = 'CLICK NPC TO SET TURN-IN';
            document.getElementById('setQuestTurnInBtn').style.background = 'linear-gradient(135deg, #4a4, #282)';
            document.getElementById('questTurnInStatus').textContent = '';
            renderMap();
        }

        function handleMapClickForQuestNpc(tileX, tileY) {
            if (!settingQuestGiverMode && !settingQuestTurnInMode) return false;
            if (selectedQuestIndex < 0) return false;

            const npcIndex = findPlacedNpcAt(tileX, tileY);
            if (npcIndex < 0) {
                const statusEl = settingQuestGiverMode ? 'questGiverStatus' : 'questTurnInStatus';
                document.getElementById(statusEl).textContent = 'No NPC there! Click on an NPC...';
                return true;
            }

            const placed = placedNpcs[npcIndex];
            const npcDef = npcs[placed.npcIndex];
            const npcName = npcDef?.name || 'NPC';

            // Ensure NPC has a UID
            if (!placed.uid) placed.uid = 'npc_' + npcIndex + '_' + Date.now();

            const quest = quests[selectedQuestIndex];

            if (settingQuestGiverMode) {
                quest.startNpcUid = placed.uid;
                quest._startNpcName = npcName + ' at (' + placed.x + ',' + placed.y + ')';
                document.getElementById('questGiverName').textContent = quest._startNpcName;
                broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
                cancelSetQuestGiver();
            } else if (settingQuestTurnInMode) {
                quest.turnInNpcUid = placed.uid;
                quest._turnInNpcName = npcName + ' at (' + placed.x + ',' + placed.y + ')';
                document.getElementById('questTurnInName').textContent = quest._turnInNpcName;
                broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
                cancelSetQuestTurnIn();
            }

            return true;
        }

        function updateQuestNpcDisplayNames() {
            const quest = quests[selectedQuestIndex];
            if (!quest) return;

            // Find and display quest giver name
            if (quest.startNpcUid) {
                const npcIndex = placedNpcs.findIndex(p => p.uid === quest.startNpcUid);
                if (npcIndex >= 0) {
                    const placed = placedNpcs[npcIndex];
                    const npcDef = npcs[placed.npcIndex];
                    document.getElementById('questGiverName').textContent = (npcDef?.name || 'NPC') + ' at (' + placed.x + ',' + placed.y + ')';
                } else {
                    document.getElementById('questGiverName').textContent = '(NPC not found)';
                }
            } else {
                document.getElementById('questGiverName').textContent = '(None)';
            }

            // Find and display turn-in name
            if (quest.turnInNpcUid) {
                const npcIndex = placedNpcs.findIndex(p => p.uid === quest.turnInNpcUid);
                if (npcIndex >= 0) {
                    const placed = placedNpcs[npcIndex];
                    const npcDef = npcs[placed.npcIndex];
                    document.getElementById('questTurnInName').textContent = (npcDef?.name || 'NPC') + ' at (' + placed.x + ',' + placed.y + ')';
                } else {
                    document.getElementById('questTurnInName').textContent = '(NPC not found)';
                }
            } else {
                document.getElementById('questTurnInName').textContent = '(Same as giver)';
            }
        }

        // ===== SHOP SYSTEM =====
        function generateShopId() {
            return 'shop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }

        function updateShopList() {
            const container = document.getElementById('shopList');
            if (!container) return;

            if (shops.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:11px; text-align:center; padding:10px;">No shops created</div>';
                return;
            }

            container.innerHTML = shops.map((shop, i) => {
                const isSelected = i === selectedShopIndex;
                const itemCount = shop.inventory ? shop.inventory.length : 0;
                const buyCount = shop.buyList ? shop.buyList.length : 0;
                return '<div onclick="selectShop(' + i + ')" style="padding:8px; margin:3px 0; background:' + (isSelected ? '#4a5a2a' : '#333') + '; border-radius:4px; cursor:pointer; border:2px solid ' + (isSelected ? '#fa0' : 'transparent') + ';">' +
                    '<div style="font-size:12px; color:#fff;">' + (shop.name || 'Unnamed Shop') + '</div>' +
                    '<div style="font-size:10px; color:#888;">' + itemCount + ' item(s) for sale, buys ' + buyCount + ' type(s)</div>' +
                '</div>';
            }).join('');
        }

        function selectShop(index) {
            // Toggle selection - click again to unselect
            if (selectedShopIndex === index) {
                selectedShopIndex = -1;
            } else {
                selectedShopIndex = index;
            }
            updateShopList();
            updateSelectedShopInfo();
        }

        function unselectShop() {
            selectedShopIndex = -1;
            updateShopList();
            updateSelectedShopInfo();
        }

        function updateSelectedShopInfo() {
            const infoPanel = document.getElementById('selectedShopInfo');
            if (!infoPanel) return;

            if (selectedShopIndex < 0 || !shops[selectedShopIndex]) {
                infoPanel.style.display = 'none';
                return;
            }

            infoPanel.style.display = 'block';
            const shop = shops[selectedShopIndex];
            infoPanel.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <strong style="color:#fa0;">${shop.name || 'Unnamed Shop'}</strong>
                    <button onclick="unselectShop()" style="background:none; border:none; color:#888; cursor:pointer; font-size:14px;" title="Unselect">✕</button>
                </div>
                <div style="font-size:10px; color:#aaa; margin-bottom:8px;">
                    ${shop.inventory?.length || 0} items for sale<br>
                    Buys ${shop.buyList?.length || 0} item types<br>
                    Default sell rate: ${shop.defaultSellRate || 50}%
                </div>
                <div style="display:flex; gap:5px;">
                    <button onclick="openShopEditor(selectedShopIndex)" style="flex:1; padding:6px; background:#4a7c59; color:#fff; border:none; border-radius:3px; cursor:pointer;">Edit</button>
                    <button onclick="deleteShop(selectedShopIndex)" style="padding:6px 10px; background:#a55; color:#fff; border:none; border-radius:3px; cursor:pointer;">X</button>
                </div>
                <div style="margin-top:8px; font-size:10px; color:#aaa;">
                    Click an NPC to attach this shop
                </div>
            `;
        }

        function updateNpcShopList() {
            const container = document.getElementById('npcShopList');
            if (!container) return;

            const npcsWithShops = placedNpcs.filter((p, i) => p.shopIndex >= 0 && p.shopIndex < shops.length);

            if (npcsWithShops.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px;">No NPCs have shops attached</div>';
                return;
            }

            container.innerHTML = npcsWithShops.map(placed => {
                const npcDef = npcs[placed.npcIndex];
                const shop = shops[placed.shopIndex];
                return '<div style="padding:4px; margin:2px 0; background:#333; border-radius:3px; font-size:10px;">' +
                    '<span style="color:#8cf;">' + (npcDef?.name || 'NPC') + '</span> → ' +
                    '<span style="color:#fa0;">' + (shop?.name || 'Shop') + '</span>' +
                '</div>';
            }).join('');
        }

        function addNewShop() {
            const newShop = {
                id: generateShopId(),
                name: 'Shop ' + (shops.length + 1),
                inventory: [],      // Items for sale: { itemIndex, buyPrice, stock }
                buyList: [],        // Items shop buys: { itemIndex, sellPrice }
                defaultSellRate: 50,
                greetingDialogId: '',
                musicIndex: -1,
                uiStyle: {
                    borderColor: '#ffaa00',
                    panelBg: '#1e1e28',
                    forSaleBg: '#284028',
                    inventoryBg: '#1e1e32',
                    cartBg: '#32281e',
                    textColor: '#ffffff',
                    accentColor: '#ffaa00'
                }
            };
            shops.push(newShop);
            selectedShopIndex = shops.length - 1;
            broadcastEdit({ editType: 'addShop', shop: newShop });
            updateShopList();
            updateSelectedShopInfo();
            openShopEditor(selectedShopIndex);
        }

        function deleteShop(index) {
            if (index < 0 || index >= shops.length) return;
            if (!confirm('Delete this shop?')) return;

            // Remove shop attachment from any NPCs
            placedNpcs.forEach(p => {
                if (p.shopIndex === index) {
                    p.shopIndex = -1;
                } else if (p.shopIndex > index) {
                    p.shopIndex--;
                }
            });

            // Remove from placedShops
            placedShops = placedShops.filter(ps => ps.shopIndex !== index);
            placedShops.forEach(ps => { if (ps.shopIndex > index) ps.shopIndex--; });

            shops.splice(index, 1);
            selectedShopIndex = -1;

            broadcastEdit({ editType: 'deleteShop', index: index });
            updateShopList();
            updateSelectedShopInfo();
            updateNpcShopList();
        }

        let editingShopIndex = -1;

        function openShopEditor(index) {
            // Create new shop if index is -1
            if (index < 0) {
                const newShop = {
                    id: 'shop_' + Date.now(),
                    name: 'New Shop',
                    inventory: [],
                    buyList: [],
                    defaultSellRate: 50,
                    greetingDialogId: '',
                    musicIndex: -1,
                    uiStyle: {
                        borderColor: '#ffaa00',
                        panelBg: '#1e1e28',
                        forSaleBg: '#284028',
                        inventoryBg: '#1e1e32',
                        cartBg: '#32281e',
                        textColor: '#ffffff',
                        accentColor: '#ffaa00'
                    }
                };
                shops.push(newShop);
                index = shops.length - 1;
                broadcastEdit({ editType: 'addShop', shop: newShop });
                updateShopList();
            }
            if (index >= shops.length) return;
            editingShopIndex = index;
            selectedShopIndex = index;
            const shop = shops[index];

            document.getElementById('shopEditorName').value = shop.name || '';
            const sellRate = shop.defaultSellRate || 50;
            document.getElementById('shopEditorSellRate').value = sellRate;
            document.getElementById('sellRateDisplay').textContent = sellRate;
            document.getElementById('shopEditorGreeting').value = shop.greeting || shop.greetingDialogId || '';

            // Populate music dropdown
            const musicSelect = document.getElementById('shopEditorMusic');
            musicSelect.innerHTML = '<option value="-1">(None)</option>';
            sounds.forEach((s, i) => {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = s.name || ('Sound ' + i);
                musicSelect.appendChild(opt);
            });
            musicSelect.value = shop.musicIndex !== undefined ? shop.musicIndex : -1;

            updateShopItemDropdowns();
            renderShopInventoryEditor();
            renderShopBuyListEditor();

            document.getElementById('shopModal').style.display = 'flex';
            updateSelectedShopInfo();
        }

        function closeShopEditor() {
            document.getElementById('shopModal').style.display = 'none';
            editingShopIndex = -1;
        }

        function saveShopEditor() {
            if (editingShopIndex < 0) return;
            const shop = shops[editingShopIndex];

            shop.name = document.getElementById('shopEditorName').value || 'Unnamed Shop';
            shop.defaultSellRate = parseInt(document.getElementById('shopEditorSellRate').value) || 50;
            shop.greetingDialogId = document.getElementById('shopEditorGreeting').value || '';
            shop.musicIndex = parseInt(document.getElementById('shopEditorMusic').value);

            broadcastEdit({ editType: 'updateShop', index: editingShopIndex, shop: shop });
            closeShopEditor();
            updateShopList();
            updateSelectedShopInfo();
        }

        function deleteShopFromEditor() {
            if (editingShopIndex < 0) return;
            if (!confirm('Delete this shop?')) return;
            const indexToDelete = editingShopIndex;
            closeShopEditor();
            deleteShop(indexToDelete);
        }

        function previewShopUI() {
            if (editingShopIndex < 0) return;
            const shop = shops[editingShopIndex];
            if (!shop) return;

            // Create overlay
            const overlay = document.createElement('div');
            overlay.id = 'shopPreviewOverlay';
            overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.9); z-index:3000; display:flex; justify-content:center; align-items:center; flex-direction:column;';

            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 450;
            canvas.style.cssText = 'border:2px solid #fa0; border-radius:4px;';

            // Button container
            const btnContainer = document.createElement('div');
            btnContainer.style.cssText = 'margin-top:15px; display:flex; gap:10px;';

            // Edit button
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit UI Style';
            editBtn.style.cssText = 'padding:10px 25px; background:#448; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:14px;';
            editBtn.onclick = () => {
                overlay.remove();
                openShopUIEditor();
            };

            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close Preview';
            closeBtn.style.cssText = 'padding:10px 25px; background:#444; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:14px;';
            closeBtn.onclick = () => overlay.remove();

            btnContainer.appendChild(editBtn);
            btnContainer.appendChild(closeBtn);
            overlay.appendChild(canvas);
            overlay.appendChild(btnContainer);
            document.body.appendChild(overlay);

            const ctx = canvas.getContext('2d');
            const SLOT_SIZE = 40;
            const cols = 10;
            const padding = 12;
            const slotGap = 2;
            const shopInv = shop.inventory || [];

            // Preload item images then draw
            const itemImages = {};
            let imagesToLoad = 0;
            let imagesLoaded = 0;

            shopInv.forEach(inv => {
                const item = items[inv.itemIndex];
                if (item && item.spriteData && !itemImages[inv.itemIndex]) {
                    imagesToLoad++;
                    const img = new Image();
                    img.onload = () => {
                        imagesLoaded++;
                        itemImages[inv.itemIndex] = img;
                        if (imagesLoaded >= imagesToLoad) drawPreview();
                    };
                    img.onerror = () => {
                        imagesLoaded++;
                        if (imagesLoaded >= imagesToLoad) drawPreview();
                    };
                    img.src = item.spriteData;
                }
            });

            // Draw immediately if no images to load
            if (imagesToLoad === 0) drawPreview();

            function drawPreview() {
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

                // Background
                ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const shopRows = Math.max(2, Math.ceil(shopInv.length / cols));
                const playerRows = 4;
                const sectionH = playerRows * SLOT_SIZE + (playerRows - 1) * slotGap + 30;
                const shopSectionH = shopRows * SLOT_SIZE + (shopRows - 1) * slotGap + 30;

                const panelW = cols * SLOT_SIZE + (cols - 1) * slotGap + padding * 2 + 100;
                const panelH = shopSectionH + sectionH + 80;
                const panelX = (canvas.width - panelW) / 2;
                const panelY = (canvas.height - panelH) / 2;

                // Main panel
                ctx.fillStyle = style.panelBg;
                ctx.fillRect(panelX, panelY, panelW, panelH);
                ctx.strokeStyle = style.borderColor;
                ctx.lineWidth = 3;
                ctx.strokeRect(panelX, panelY, panelW, panelH);

                // Header
                ctx.fillStyle = style.accentColor;
                ctx.font = 'bold 16px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(shop.name || 'Shop', panelX + panelW / 2, panelY + 22);

                // Gold display
                ctx.fillStyle = '#fc0';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('Gold: 100', panelX + 15, panelY + 22);

                // Shop inventory section
                const shopAreaX = panelX + padding;
                const shopAreaY = panelY + 35;
                const shopAreaW = panelW - padding * 2 - 90;

                ctx.fillStyle = style.forSaleBg;
                ctx.fillRect(shopAreaX, shopAreaY, shopAreaW, shopSectionH);
                ctx.strokeStyle = '#4a7c59';
                ctx.lineWidth = 2;
                ctx.strokeRect(shopAreaX, shopAreaY, shopAreaW, shopSectionH);

                ctx.fillStyle = '#8f8';
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('FOR SALE', shopAreaX + 8, shopAreaY + 16);

                // Draw shop item slots
                for (let i = 0; i < Math.max(shopInv.length, cols * 2); i++) {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    if (row >= shopRows) break;

                    const slotX = shopAreaX + padding + col * (SLOT_SIZE + slotGap);
                    const slotY = shopAreaY + 22 + row * (SLOT_SIZE + slotGap);

                    const inv = shopInv[i];
                    ctx.fillStyle = inv ? '#2a3a2a' : '#1a1a1a';
                    ctx.fillRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                    ctx.strokeStyle = inv ? '#4a5a4a' : '#333';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);

                    if (inv) {
                        const item = items[inv.itemIndex];
                        const img = itemImages[inv.itemIndex];

                        // Draw item sprite if available
                        if (img && item && item.frames && item.frames.length > 0) {
                            const frame = item.frames[item.idleFrame || 0];
                            if (frame) {
                                const scale = Math.min((SLOT_SIZE - 4) / frame.w, (SLOT_SIZE - 4) / frame.h);
                                const drawW = frame.w * scale;
                                const drawH = frame.h * scale;
                                const drawX = slotX + (SLOT_SIZE - drawW) / 2;
                                const drawY = slotY + (SLOT_SIZE - drawH) / 2;
                                ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
                            }
                        } else {
                            // Fallback to name abbreviation
                            ctx.fillStyle = '#fff';
                            ctx.font = '9px monospace';
                            ctx.textAlign = 'center';
                            const abbrev = item ? item.name.substring(0, 4) : '?';
                            ctx.fillText(abbrev, slotX + SLOT_SIZE/2, slotY + SLOT_SIZE/2 + 3);
                        }

                        // Price below
                        ctx.fillStyle = '#fc0';
                        ctx.font = '9px monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText(inv.buyPrice + 'g', slotX + SLOT_SIZE/2, slotY + SLOT_SIZE + 10);
                    }
                }

                // Player inventory section
                const invAreaX = panelX + padding;
                const invAreaY = shopAreaY + shopSectionH + 8;

                ctx.fillStyle = style.inventoryBg;
                ctx.fillRect(invAreaX, invAreaY, shopAreaW, sectionH);
                ctx.strokeStyle = '#557';
                ctx.lineWidth = 2;
                ctx.strokeRect(invAreaX, invAreaY, shopAreaW, sectionH);

                ctx.fillStyle = '#aaf';
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('YOUR INVENTORY', invAreaX + 8, invAreaY + 16);

                // Draw empty player inventory slots
                for (let i = 0; i < cols * playerRows; i++) {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    const slotX = invAreaX + padding + col * (SLOT_SIZE + slotGap);
                    const slotY = invAreaY + 22 + row * (SLOT_SIZE + slotGap);

                    ctx.fillStyle = i < 10 ? '#3a3a4a' : '#333';
                    ctx.fillRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                    ctx.strokeStyle = i < 10 ? '#666' : '#444';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                }

                // Cart area
                const cartX = shopAreaX + shopAreaW + 8;
                const cartY = shopAreaY;
                const cartW = 80;
                const cartH = shopSectionH + sectionH + 8;

                ctx.fillStyle = style.cartBg;
                ctx.fillRect(cartX, cartY, cartW, cartH);
                ctx.strokeStyle = '#a86';
                ctx.lineWidth = 2;
                ctx.strokeRect(cartX, cartY, cartW, cartH);

                ctx.fillStyle = '#fa8';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('CART', cartX + cartW/2, cartY + 16);

                ctx.fillStyle = '#666';
                ctx.font = '10px monospace';
                ctx.fillText('Cart empty', cartX + cartW/2, cartY + cartH/2);

                // Confirm button area
                const btnY = panelY + panelH - 35;
                ctx.fillStyle = '#4a4';
                ctx.fillRect(panelX + panelW/2 - 50, btnY, 100, 25);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('CONFIRM', panelX + panelW/2, btnY + 17);

                // Preview label
                ctx.fillStyle = '#888';
                ctx.font = '10px monospace';
                ctx.fillText('[ PREVIEW ]', panelX + panelW/2, panelY + panelH - 8);
            }
        }

        function openShopUIEditor() {
            if (editingShopIndex < 0) return;
            const shop = shops[editingShopIndex];
            if (!shop) return;

            // Initialize uiStyle if not present
            if (!shop.uiStyle) {
                shop.uiStyle = {
                    borderColor: '#ffaa00',
                    panelBg: '#1e1e28',
                    forSaleBg: '#284028',
                    inventoryBg: '#1e1e32',
                    cartBg: '#32281e',
                    textColor: '#ffffff',
                    accentColor: '#ffaa00'
                };
            }

            // Store original values for cancel
            const originalStyle = JSON.parse(JSON.stringify(shop.uiStyle));

            const overlay = document.createElement('div');
            overlay.id = 'shopUIEditorOverlay';
            overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.95); z-index:3000; display:flex; justify-content:center; align-items:center; gap:30px;';

            // Left panel - controls
            const controlPanel = document.createElement('div');
            controlPanel.style.cssText = 'background:#2a2a2a; padding:20px; border-radius:8px; border:2px solid #448; width:280px;';
            controlPanel.innerHTML = `
                <h3 style="margin:0 0 15px 0; color:#4af;">Shop UI Style</h3>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <label style="color:#aaa; font-size:11px;">Border:
                        <input type="color" id="shopUIBorder" value="${shop.uiStyle.borderColor}" style="width:100%; height:28px; margin-top:4px; cursor:pointer;">
                    </label>
                    <label style="color:#aaa; font-size:11px;">Panel BG:
                        <input type="color" id="shopUIPanel" value="${shop.uiStyle.panelBg}" style="width:100%; height:28px; margin-top:4px; cursor:pointer;">
                    </label>
                    <label style="color:#aaa; font-size:11px;">For Sale:
                        <input type="color" id="shopUIForSale" value="${shop.uiStyle.forSaleBg}" style="width:100%; height:28px; margin-top:4px; cursor:pointer;">
                    </label>
                    <label style="color:#aaa; font-size:11px;">Inventory:
                        <input type="color" id="shopUIInventory" value="${shop.uiStyle.inventoryBg}" style="width:100%; height:28px; margin-top:4px; cursor:pointer;">
                    </label>
                    <label style="color:#aaa; font-size:11px;">Cart:
                        <input type="color" id="shopUICart" value="${shop.uiStyle.cartBg}" style="width:100%; height:28px; margin-top:4px; cursor:pointer;">
                    </label>
                    <label style="color:#aaa; font-size:11px;">Accent:
                        <input type="color" id="shopUIAccent" value="${shop.uiStyle.accentColor}" style="width:100%; height:28px; margin-top:4px; cursor:pointer;">
                    </label>
                </div>
                <div style="margin-top:20px; display:flex; flex-direction:column; gap:8px;">
                    <button id="shopUIReset" style="padding:10px; background:#633; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">Reset to Defaults</button>
                    <div style="display:flex; gap:8px;">
                        <button id="shopUICancel" style="flex:1; padding:10px; background:#444; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">Cancel</button>
                        <button id="shopUISave" style="flex:1; padding:10px; background:#484; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">Save</button>
                    </div>
                </div>
            `;

            // Right panel - live preview canvas
            const previewPanel = document.createElement('div');
            previewPanel.style.cssText = 'display:flex; flex-direction:column; align-items:center;';

            const previewLabel = document.createElement('div');
            previewLabel.style.cssText = 'color:#888; font-size:12px; margin-bottom:8px;';
            previewLabel.textContent = 'Live Preview';

            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 450;
            canvas.style.cssText = 'border:2px solid #fa0; border-radius:4px;';

            previewPanel.appendChild(previewLabel);
            previewPanel.appendChild(canvas);

            overlay.appendChild(controlPanel);
            overlay.appendChild(previewPanel);
            document.body.appendChild(overlay);

            const ctx = canvas.getContext('2d');
            const SLOT_SIZE = 40;
            const cols = 10;
            const padding = 12;
            const slotGap = 2;
            const shopInv = shop.inventory || [];

            // Preload item images
            const itemImages = {};
            let imagesToLoad = 0;
            let imagesLoaded = 0;

            shopInv.forEach(inv => {
                const item = items[inv.itemIndex];
                if (item && item.spriteData && !itemImages[inv.itemIndex]) {
                    imagesToLoad++;
                    const img = new Image();
                    img.onload = () => {
                        imagesLoaded++;
                        itemImages[inv.itemIndex] = img;
                        if (imagesLoaded >= imagesToLoad) drawPreview();
                    };
                    img.onerror = () => {
                        imagesLoaded++;
                        if (imagesLoaded >= imagesToLoad) drawPreview();
                    };
                    img.src = item.spriteData;
                }
            });

            if (imagesToLoad === 0) drawPreview();

            function drawPreview() {
                const style = {
                    borderColor: document.getElementById('shopUIBorder').value,
                    panelBg: document.getElementById('shopUIPanel').value,
                    forSaleBg: document.getElementById('shopUIForSale').value,
                    inventoryBg: document.getElementById('shopUIInventory').value,
                    cartBg: document.getElementById('shopUICart').value,
                    textColor: '#ffffff',
                    accentColor: document.getElementById('shopUIAccent').value
                };

                ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const shopRows = Math.max(2, Math.ceil(shopInv.length / cols));
                const playerRows = 4;
                const sectionH = playerRows * SLOT_SIZE + (playerRows - 1) * slotGap + 30;
                const shopSectionH = shopRows * SLOT_SIZE + (shopRows - 1) * slotGap + 30;

                const panelW = cols * SLOT_SIZE + (cols - 1) * slotGap + padding * 2 + 100;
                const panelH = shopSectionH + sectionH + 80;
                const panelX = (canvas.width - panelW) / 2;
                const panelY = (canvas.height - panelH) / 2;

                // Main panel
                ctx.fillStyle = style.panelBg;
                ctx.fillRect(panelX, panelY, panelW, panelH);
                ctx.strokeStyle = style.borderColor;
                ctx.lineWidth = 3;
                ctx.strokeRect(panelX, panelY, panelW, panelH);

                // Header
                ctx.fillStyle = style.accentColor;
                ctx.font = 'bold 16px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(shop.name || 'Shop', panelX + panelW / 2, panelY + 22);

                ctx.fillStyle = '#fc0';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('Gold: 100', panelX + 15, panelY + 22);

                // Shop inventory section
                const shopAreaX = panelX + padding;
                const shopAreaY = panelY + 35;
                const shopAreaW = panelW - padding * 2 - 90;

                ctx.fillStyle = style.forSaleBg;
                ctx.fillRect(shopAreaX, shopAreaY, shopAreaW, shopSectionH);
                ctx.strokeStyle = '#4a7c59';
                ctx.lineWidth = 2;
                ctx.strokeRect(shopAreaX, shopAreaY, shopAreaW, shopSectionH);

                ctx.fillStyle = '#8f8';
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('FOR SALE', shopAreaX + 8, shopAreaY + 16);

                for (let i = 0; i < Math.max(shopInv.length, cols * 2); i++) {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    if (row >= shopRows) break;

                    const slotX = shopAreaX + padding + col * (SLOT_SIZE + slotGap);
                    const slotY = shopAreaY + 22 + row * (SLOT_SIZE + slotGap);

                    const inv = shopInv[i];
                    ctx.fillStyle = inv ? '#2a3a2a' : '#1a1a1a';
                    ctx.fillRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                    ctx.strokeStyle = inv ? '#4a5a4a' : '#333';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);

                    if (inv) {
                        const item = items[inv.itemIndex];
                        const img = itemImages[inv.itemIndex];

                        if (img && item && item.frames && item.frames.length > 0) {
                            const frame = item.frames[item.idleFrame || 0];
                            if (frame) {
                                const scale = Math.min((SLOT_SIZE - 4) / frame.w, (SLOT_SIZE - 4) / frame.h);
                                const drawW = frame.w * scale;
                                const drawH = frame.h * scale;
                                const drawX = slotX + (SLOT_SIZE - drawW) / 2;
                                const drawY = slotY + (SLOT_SIZE - drawH) / 2;
                                ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
                            }
                        } else {
                            ctx.fillStyle = '#fff';
                            ctx.font = '9px monospace';
                            ctx.textAlign = 'center';
                            const abbrev = item ? item.name.substring(0, 4) : '?';
                            ctx.fillText(abbrev, slotX + SLOT_SIZE/2, slotY + SLOT_SIZE/2 + 3);
                        }

                        ctx.fillStyle = '#fc0';
                        ctx.font = '9px monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText(inv.buyPrice + 'g', slotX + SLOT_SIZE/2, slotY + SLOT_SIZE + 10);
                    }
                }

                // Player inventory section
                const invAreaX = panelX + padding;
                const invAreaY = shopAreaY + shopSectionH + 8;

                ctx.fillStyle = style.inventoryBg;
                ctx.fillRect(invAreaX, invAreaY, shopAreaW, sectionH);
                ctx.strokeStyle = '#557';
                ctx.lineWidth = 2;
                ctx.strokeRect(invAreaX, invAreaY, shopAreaW, sectionH);

                ctx.fillStyle = '#aaf';
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('YOUR INVENTORY', invAreaX + 8, invAreaY + 16);

                for (let i = 0; i < cols * playerRows; i++) {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    const slotX = invAreaX + padding + col * (SLOT_SIZE + slotGap);
                    const slotY = invAreaY + 22 + row * (SLOT_SIZE + slotGap);

                    ctx.fillStyle = i < 10 ? '#3a3a4a' : '#333';
                    ctx.fillRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                    ctx.strokeStyle = i < 10 ? '#666' : '#444';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                }

                // Cart area
                const cartX = shopAreaX + shopAreaW + 8;
                const cartY = shopAreaY;
                const cartW = 80;
                const cartH = shopSectionH + sectionH + 8;

                ctx.fillStyle = style.cartBg;
                ctx.fillRect(cartX, cartY, cartW, cartH);
                ctx.strokeStyle = '#a86';
                ctx.lineWidth = 2;
                ctx.strokeRect(cartX, cartY, cartW, cartH);

                ctx.fillStyle = '#fa8';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('CART', cartX + cartW/2, cartY + 16);

                ctx.fillStyle = '#666';
                ctx.font = '10px monospace';
                ctx.fillText('Cart empty', cartX + cartW/2, cartY + cartH/2);

                const btnY = panelY + panelH - 35;
                ctx.fillStyle = '#4a4';
                ctx.fillRect(panelX + panelW/2 - 50, btnY, 100, 25);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('CONFIRM', panelX + panelW/2, btnY + 17);
            }

            // Add live update listeners to all color pickers
            ['shopUIBorder', 'shopUIPanel', 'shopUIForSale', 'shopUIInventory', 'shopUICart', 'shopUIAccent'].forEach(id => {
                document.getElementById(id).oninput = drawPreview;
            });

            document.getElementById('shopUICancel').onclick = () => {
                shop.uiStyle = originalStyle;
                overlay.remove();
            };

            document.getElementById('shopUIReset').onclick = () => {
                const defaults = {
                    borderColor: '#ffaa00',
                    panelBg: '#1e1e28',
                    forSaleBg: '#284028',
                    inventoryBg: '#1e1e32',
                    cartBg: '#32281e',
                    textColor: '#ffffff',
                    accentColor: '#ffaa00'
                };
                document.getElementById('shopUIBorder').value = defaults.borderColor;
                document.getElementById('shopUIPanel').value = defaults.panelBg;
                document.getElementById('shopUIForSale').value = defaults.forSaleBg;
                document.getElementById('shopUIInventory').value = defaults.inventoryBg;
                document.getElementById('shopUICart').value = defaults.cartBg;
                document.getElementById('shopUIAccent').value = defaults.accentColor;
                drawPreview();
            };

            document.getElementById('shopUISave').onclick = () => {
                shop.uiStyle = {
                    borderColor: document.getElementById('shopUIBorder').value,
                    panelBg: document.getElementById('shopUIPanel').value,
                    forSaleBg: document.getElementById('shopUIForSale').value,
                    inventoryBg: document.getElementById('shopUIInventory').value,
                    cartBg: document.getElementById('shopUICart').value,
                    textColor: '#ffffff',
                    accentColor: document.getElementById('shopUIAccent').value
                };
                overlay.remove();
            };
        }

        function renderShopInventoryEditor() {
            const container = document.getElementById('shopInventoryList');
            if (!container || editingShopIndex < 0) return;

            const shop = shops[editingShopIndex];
            const inventory = shop.inventory || [];

            if (inventory.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px; text-align:center; padding:5px;">No items for sale</div>';
                return;
            }

            // Column headers
            let html = '<div style="display:flex; justify-content:space-between; align-items:center; padding:2px 4px; font-size:9px; color:#888; border-bottom:1px solid #444;">' +
                '<span style="flex:1;">Item</span>' +
                '<span style="width:50px; text-align:center; margin:0 4px;">Price</span>' +
                '<span style="width:40px; text-align:center; margin:0 4px;">Stock</span>' +
                '<span style="width:26px;"></span>' +
                '</div>';

            html += inventory.map((inv, i) => {
                const item = items[inv.itemIndex];
                const itemName = item ? item.name : '(Unknown)';
                return '<div style="display:flex; justify-content:space-between; align-items:center; padding:4px; margin:2px 0; background:#333; border-radius:3px; font-size:10px;">' +
                    '<span style="flex:1; color:#fff;">' + itemName + '</span>' +
                    '<input type="number" value="' + (inv.buyPrice || 0) + '" onchange="updateShopInventoryPrice(' + i + ', this.value)" style="width:50px; margin:0 4px; text-align:center;">' +
                    '<input type="number" value="' + (inv.stock === -1 ? -1 : (inv.stock || 1)) + '" onchange="updateShopInventoryStock(' + i + ', this.value)" style="width:40px; margin:0 4px; text-align:center;">' +
                    '<button onclick="removeShopInventoryItem(' + i + ')" style="padding:2px 6px; font-size:9px; background:#a55;">×</button>' +
                '</div>';
            }).join('');

            container.innerHTML = html;
        }

        function updateShopInventoryPrice(index, value) {
            if (editingShopIndex < 0) return;
            const shop = shops[editingShopIndex];
            if (shop.inventory && shop.inventory[index]) {
                shop.inventory[index].buyPrice = parseInt(value) || 0;
            }
        }

        function updateShopInventoryStock(index, value) {
            if (editingShopIndex < 0) return;
            const shop = shops[editingShopIndex];
            if (shop.inventory && shop.inventory[index]) {
                shop.inventory[index].stock = parseInt(value);
            }
        }

        function removeShopInventoryItem(index) {
            if (editingShopIndex < 0) return;
            const shop = shops[editingShopIndex];
            if (shop.inventory) {
                shop.inventory.splice(index, 1);
                renderShopInventoryEditor();
            }
        }

        function shopAddInventoryItem() {
            if (editingShopIndex < 0) return;
            const select = document.getElementById('shopAddItemSelect');
            const priceInput = document.getElementById('shopAddItemPrice');
            const stockInput = document.getElementById('shopAddItemStock');
            const itemIndex = parseInt(select.value);
            if (isNaN(itemIndex) || itemIndex < 0) return;

            const shop = shops[editingShopIndex];
            if (!shop.inventory) shop.inventory = [];
            if (!shop.buyList) shop.buyList = [];

            // Check if item already exists
            if (shop.inventory.find(inv => inv.itemIndex === itemIndex)) {
                alert('This item is already in the shop inventory');
                return;
            }

            // Get values from inputs
            const buyPrice = parseInt(priceInput.value) || 10;
            const stock = parseInt(stockInput.value);

            shop.inventory.push({
                itemIndex: itemIndex,
                buyPrice: buyPrice,
                stock: isNaN(stock) ? -1 : stock
            });

            // Auto-add to buyList if not already there (shop will also buy this item)
            if (!shop.buyList.find(b => b.itemIndex === itemIndex)) {
                const sellRate = shop.defaultSellRate || 50;
                const sellPrice = Math.floor(buyPrice * sellRate / 100);
                shop.buyList.push({
                    itemIndex: itemIndex,
                    sellPrice: sellPrice
                });
                renderShopBuyListEditor();
            }

            renderShopInventoryEditor();
            select.value = '';
        }

        function renderShopBuyListEditor() {
            const container = document.getElementById('shopBuyList');
            if (!container || editingShopIndex < 0) return;

            const shop = shops[editingShopIndex];
            const buyList = shop.buyList || [];

            if (buyList.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px; text-align:center; padding:5px;">Shop doesn\'t buy anything</div>';
                return;
            }

            // Column headers
            let html = '<div style="display:flex; justify-content:space-between; align-items:center; padding:2px 4px; font-size:9px; color:#888; border-bottom:1px solid #444;">' +
                '<span style="flex:1;">Item</span>' +
                '<span style="width:50px; text-align:center; margin:0 4px;">Pays</span>' +
                '<span style="width:26px;"></span>' +
                '</div>';

            html += buyList.map((buy, i) => {
                const item = items[buy.itemIndex];
                const itemName = item ? item.name : '(Unknown)';
                return '<div style="display:flex; justify-content:space-between; align-items:center; padding:4px; margin:2px 0; background:#333; border-radius:3px; font-size:10px;">' +
                    '<span style="flex:1; color:#fff;">' + itemName + '</span>' +
                    '<input type="number" value="' + (buy.sellPrice || 0) + '" onchange="updateShopBuyPrice(' + i + ', this.value)" style="width:50px; margin:0 4px; text-align:center;">' +
                    '<button onclick="removeShopBuyItem(' + i + ')" style="padding:2px 6px; font-size:9px; background:#a55;">×</button>' +
                '</div>';
            }).join('');

            container.innerHTML = html;
        }

        function updateShopBuyPrice(index, value) {
            if (editingShopIndex < 0) return;
            const shop = shops[editingShopIndex];
            if (shop.buyList && shop.buyList[index]) {
                shop.buyList[index].sellPrice = parseInt(value) || 0;
            }
        }

        function removeShopBuyItem(index) {
            if (editingShopIndex < 0) return;
            const shop = shops[editingShopIndex];
            if (shop.buyList) {
                shop.buyList.splice(index, 1);
                renderShopBuyListEditor();
            }
        }

        function shopAddBuyListItem() {
            if (editingShopIndex < 0) return;
            const select = document.getElementById('shopAddBuyItemSelect');
            const priceInput = document.getElementById('shopAddBuyItemPrice');
            const itemIndex = parseInt(select.value);
            if (isNaN(itemIndex) || itemIndex < 0) return;

            const shop = shops[editingShopIndex];
            if (!shop.buyList) shop.buyList = [];

            // Check if item already exists
            if (shop.buyList.find(b => b.itemIndex === itemIndex)) {
                alert('This item is already in the buy list');
                return;
            }

            // Get price from input
            const sellPrice = parseInt(priceInput.value) || 5;

            shop.buyList.push({
                itemIndex: itemIndex,
                sellPrice: sellPrice
            });

            renderShopBuyListEditor();
            select.value = '';
        }

        function updateShopItemDropdowns() {
            const addItemSelect = document.getElementById('shopAddItemSelect');
            const addBuySelect = document.getElementById('shopAddBuyItemSelect');

            let options = '<option value="">(Select item)</option>';
            items.forEach((item, i) => {
                options += '<option value="' + i + '">' + (item.name || 'Item ' + i) + '</option>';
            });

            if (addItemSelect) addItemSelect.innerHTML = options;
            if (addBuySelect) addBuySelect.innerHTML = options;
        }

        function updateStartingGold(value) {
            startingGold = parseInt(value) || 100;
            broadcastEdit({ editType: 'updateStartingGold', value: startingGold });
        }

        // NPC Shop attachment functions
        function updateNpcShopDropdown() {
            const select = document.getElementById('npcShopSelect');
            if (!select) return;

            let options = '<option value="-1">(None)</option>';
            shops.forEach((shop, i) => {
                options += '<option value="' + i + '">' + (shop.name || 'Shop ' + i) + '</option>';
            });
            select.innerHTML = options;
        }

        function updateNpcShopInfo(placed) {
            const info = document.getElementById('npcShopInfo');
            if (!info) return;

            if (placed.shopIndex >= 0 && placed.shopIndex < shops.length) {
                const shop = shops[placed.shopIndex];
                info.innerHTML = '<span style="color:#fa0;">' + (shop.name || 'Shop') + '</span> - ' +
                    (shop.inventory?.length || 0) + ' items';
            } else {
                info.textContent = '(No shop attached)';
            }
        }

        function attachShopToNpc() {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            const select = document.getElementById('npcShopSelect');
            const shopIndex = parseInt(select.value);

            placed.shopIndex = shopIndex;

            broadcastEdit({
                editType: 'updatePlacedNpc',
                index: selectedPlacedNpcIndex,
                npc: placed
            });

            updateNpcShopInfo(placed);
            if (mode === 'shop') {
                updateNpcShopList();
            }
            renderMap(); // Re-render to show shop indicator
        }

        // ===== SAVE/LOAD =====
        async function saveProject() {
            // Use getProjectData() to ensure both save methods have identical data
            const data = getProjectData();
            console.log('Saving project - shops:', data.shops?.length || 0, 'items:', data.items?.length || 0, 'quests:', data.quests?.length || 0);
            console.log('Saving playerPreviewPos:', playerPreviewPos, 'on map:', spawnMapName);
            try {
                // Try IndexedDB first (much larger storage)
                await saveProjectToDB(data);
                alert('Saved! Player spawn: (' + playerPreviewPos.x + ', ' + playerPreviewPos.y + ')');
            } catch (e) {
                console.warn('IndexedDB save failed, trying localStorage:', e);
                // Fallback to localStorage for older browsers
                try {
                    localStorage.setItem('worldBuilderProject', JSON.stringify(data));
                    console.log('Project saved to localStorage (fallback)');
                    alert('Saved! Player spawn: (' + playerPreviewPos.x + ', ' + playerPreviewPos.y + ')');
                } catch (e2) {
                    if (e2.name === 'QuotaExceededError') {
                        alert('Project too large to save! Use "Download" to save to a file.');
                    } else {
                        throw e2;
                    }
                }
            }
            return data; // Return for file download
        }

        function downloadProject() {
            // Get save data
            const data = getProjectData();
            const json = JSON.stringify(data, null, 2);

            // Create download
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'world-project-' + new Date().toISOString().slice(0,10) + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function getProjectData() {
            // Save current map state to maps object before saving
            saveCurrentMapState();

            // Save current prop's collision masks before saving
            if (currentPropIndex >= 0 && props[currentPropIndex]) {
                props[currentPropIndex].collisionMasks = { ...propCollisionMasks };
            }

            // Save all tilesets
            const tilesetsData = tilesets.map(ts => ({ name: ts.name, data: ts.data }));

            // Save all props
            const propsData = props.map(p => ({
                name: p.name,
                data: p.data,
                collisionMasks: p.collisionMasks || {}
            }));

            // Save all animated props — spread-with-strip so new fields round-trip without drift.
            const animPropsData = animatedProps.map(prop => {
                const copy = { ...prop };
                delete copy._spriteImg;
                delete copy.img;
                return copy;
            });

            // Save sounds
            const soundsData = sounds.map(s => ({
                name: s.name,
                data: s.data,
                duration: s.duration,
                type: s.type
            }));
            console.log('getProjectData - sounds:', sounds.length, 'tileSounds:', Object.keys(tileSounds).length);

            // Debug: log all triggers being passed
            console.log('=== getProjectData TRIGGERS ===');
            placedTriggers.forEach((t, i) => {
                console.log('Trigger ' + i + ': Door ' + t.doorNumber + ' at (' + t.x + ',' + t.y + ') on "' + t.mapName + '" -> "' + t.targetMap + '" spawn (' + t.targetX + ',' + t.targetY + ')');
            });

            return {
                gridSize, mapCols, mapRows,
                layers, layerVisibility, layerNames, currentLayer,
                tileCollisions, collisionMasks,
                tileSplitLines, // Depth split lines for Y-sorting
                tileSplitLineFlipped, // Flipped split lines (bottom covers player)
                tilesets: tilesetsData,
                currentTilesetIndex,
                // Keep for backwards compatibility
                tilesetData: tilesets[0]?.data,
                // Save multiple props
                props: propsData,
                currentPropIndex,
                // Keep old format for backwards compatibility
                propImageData: props[0]?.data || null,
                propCollisionMasks: props[0]?.collisionMasks || {},
                // Save animated props
                animatedProps: animPropsData,
                currentAnimPropIndex,
                placedAnimProps,
                // Save NPCs — spread-with-strip (new fields round-trip automatically).
                npcs: npcs.map(npc => {
                    const copy = { ...npc };
                    delete copy._spriteImg;
                    delete copy._editorImg;
                    delete copy.img;
                    return copy;
                }),
                currentNpcIndex,
                placedNpcs,
                // Save player layer settings
                playerLayerIndex,
                playerPreviewPos,
                spawnMapName,
                playerPreviewVisible,
                // Save sound data
                sounds: soundsData,
                tileSounds,
                playerSounds,
                // Quest sounds library
                questSounds: questSounds.map(s => ({ name: s.name, data: s.data })),
                // Save lighting data
                lightingSettings,
                pointLights,
                polyLights,
                // Save player sprite (legacy)
                playerSpriteData,
                // Player characters — spread-with-strip so hitboxRange/hitboxWidth/etc. round-trip.
                playerCharacters: playerCharacters.map(c => {
                    const copy = { ...c };
                    delete copy._spriteImg;
                    delete copy._editorImg;
                    delete copy.img;
                    return copy;
                }),
                activePlayerIndex,
                // Multi-map support
                maps,
                currentMapName,
                placedTriggers,
                // Dialogs
                dialogs,
                placedDialogTiles,
                // Items — spread-with-strip.
                items: items.map(item => {
                    const copy = { ...item };
                    delete copy._spriteImg;
                    delete copy.img;
                    return copy;
                }),
                placedItems,
                // Fishing loot table (project-global): [{ itemIndex, weight }]
                fishingLoot: fishingLoot.map(e => ({ ...e })),
                // Static objects — spread-with-strip.
                staticObjects: staticObjects.map(obj => {
                    const copy = { ...obj };
                    delete copy._spriteImg;
                    delete copy.img;
                    return copy;
                }),
                placedStaticObjects,
                // Quests
                quests,
                // Shops
                shops,
                placedShops,
                startingGold,
                // Version tagging (Wave 1)
                version: SAVE_SCHEMA_VERSION,
                gameVersion: GAME_VERSION,
                savedAt: Date.now()
            };
        }

        // Lightweight world for phone "join by URL": same shape as getProjectData() but with the
        // heavy AUDIO stripped (sounds/questSounds base64 = ~90% of a real save). The engine still
        // gets the inline tile/sprite images it needs to render a viewport, so it boots unchanged
        // from this object. Audio is deferred (phones play silent for v1). Compact JSON of this is
        // ~MBs instead of ~200MB, so it ships in a single WebSocket frame and parses on a phone.
        function getLightweightWorld() {
            const d = getProjectData();
            if (Array.isArray(d.sounds)) {
                d.sounds = d.sounds.map(s => ({ name: s.name, duration: s.duration, type: s.type }));
            }
            if (Array.isArray(d.questSounds)) {
                d.questSounds = d.questSounds.map(s => ({ name: s.name }));
            }
            d.audioStripped = true;   // signals the join client that sounds carry no data
            d.lightweight = true;
            return d;
        }

        function uploadProject(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    // Save to IndexedDB so Test Map works
                    try {
                        await saveProjectToDB(data);
                        console.log('Uploaded project saved to IndexedDB');
                    } catch (dbErr) {
                        console.warn('IndexedDB save failed, trying localStorage:', dbErr);
                        try {
                            localStorage.setItem('worldBuilderProject', JSON.stringify(data));
                        } catch (storageErr) {
                            console.warn('localStorage also full, project loaded but not persisted');
                        }
                    }
                    // Load into editor
                    await loadProject(data);
                } catch (err) {
                    alert('Error loading file: ' + err.message);
                }
            };
            reader.readAsText(file);

            // Clear input so same file can be loaded again
            event.target.value = '';
        }

        // Load save and show mode selection
        let pendingSaveData = null;

        // Show save choice menu (demo vs own save)
        function showSaveChoice() {
            document.getElementById('mainMenu').style.display = 'none';
            document.getElementById('saveChoice').style.display = 'block';
        }

        // Load save menu HTML
        const saveChoiceOriginalHTML = `
            <h1>LOAD<br>SAVE</h1>
            <p>- SELECT SOURCE -</p>
            <div style="margin-top:20px;">
                <button class="retro-btn" onclick="playButtonSound(); document.getElementById('projectFileInputWelcome').click(); document.getElementById('saveChoice').style.display='none'; document.getElementById('mainMenu').style.display='block';">
                    > YOUR SAVE
                </button>
            </div>
            <div style="margin-top:10px;">
                <button class="retro-btn" onclick="playButtonSound(); document.getElementById('saveChoice').style.display='none'; document.getElementById('mainMenu').style.display='block';" style="font-size:10px;">
                    > BACK
                </button>
            </div>
        `;
        async function loadDemo() {
            document.getElementById('saveChoice').innerHTML = '<h1>LOADING...</h1>';
            try {
                const response = await fetch('thenewdemo.json');
                const data = await response.json();
                pendingSaveData = data;
                await saveProjectToDB(pendingSaveData);
                document.getElementById('saveChoice').innerHTML = saveChoiceOriginalHTML;
                document.getElementById('saveChoice').style.display = 'none';
                document.getElementById('modeSelect').style.display = 'block';
            } catch (err) {
                alert('Error loading demo: ' + err.message);
                document.getElementById('saveChoice').innerHTML = saveChoiceOriginalHTML;
                document.getElementById('saveChoice').style.display = 'none';
                document.getElementById('mainMenu').style.display = 'block';
            }
        }
        function loadSaveWithModeSelect(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    pendingSaveData = JSON.parse(e.target.result);
                    await saveProjectToDB(pendingSaveData);
                    document.getElementById('mainMenu').style.display = 'none';
                    document.getElementById('modeSelect').style.display = 'block';
                } catch (err) {
                    alert('Error: ' + err.message);
                }
            };
            reader.readAsText(file);
            event.target.value = '';
        }

        // Multiplayer prompt functions
        function showMultiplayerPrompt() {
            document.getElementById('modeSelect').style.display = 'none';
            document.getElementById('multiplayerPrompt').style.display = 'block';
            document.getElementById('mpPlayerName').focus();
        }

        function hideMultiplayerPrompt() {
            document.getElementById('multiplayerPrompt').style.display = 'none';
            document.getElementById('modeSelect').style.display = 'block';
        }

        // Craft multiplayer prompt functions
        function showCraftMultiplayerPrompt() {
            document.getElementById('modeSelect').style.display = 'none';
            document.getElementById('craftMultiplayerPrompt').style.display = 'block';
            // Focus is handled in showHostPrompt/showJoinPrompt
        }

        function hideCraftMultiplayerPrompt() {
            document.getElementById('craftMultiplayerPrompt').style.display = 'none';
            document.getElementById('modeSelect').style.display = 'block';
        }

        // Simple builder start - shows co-op prompt
        function startBuilder() {
            if (!pendingSaveData) {
                console.log('[START] No save data, returning');
                return;
            }

            // Hide mode select, show co-op prompt
            document.getElementById('modeSelect').style.display = 'none';
            document.getElementById('craftMultiplayerPrompt').style.display = 'block';
            // Focus is handled in showHostPrompt/showJoinPrompt
        }

        // === BUILDER MULTIPLAYER SYSTEM ===
        let builderSocket = null;
        let builderConnected = false;
        let builderPlayerName = 'Builder';
        let builderRoomCode = null;
        // Resilient co-op sync: track the latest server edit seq we've applied so we can
        // ask the server for exactly what we missed after a dropped/slept socket.
        let builderLastSeq = 0;            // highest server _seq applied
        let builderWantConnection = false; // true while user is in co-op mode (drives auto-reconnect)
        let builderReconnectDelay = 1000;
        let builderReconnectTimer = null;
        let builderVisibilityHooked = false;
        let testGameWindow = null; // Reference to test game window for solo live sync

        // Track who's editing what modal (to prevent conflicts)
        // Format: { 'npc:0': { username: 'Player1', socketId: 'abc123' }, 'item:2': {...} }
        let currentlyEditing = {};
        let myEditingKey = null; // What am I currently editing?

        // Check if something is being edited by someone else
        function isBeingEdited(type, index) {
            const key = type + ':' + index;
            return currentlyEditing[key] && currentlyEditing[key].username !== builderPlayerName;
        }

        // Get who is editing something
        function getEditor(type, index) {
            const key = type + ':' + index;
            return currentlyEditing[key] ? currentlyEditing[key].username : null;
        }

        // Start editing something
        function startEditing(type, index) {
            const key = type + ':' + index;
            myEditingKey = key;
            currentlyEditing[key] = { username: builderPlayerName };
            broadcastEdit({ editType: 'startEditing', editorType: type, editorIndex: index, username: builderPlayerName });
        }

        // Stop editing something
        function stopEditing() {
            if (myEditingKey) {
                const [type, index] = myEditingKey.split(':');
                delete currentlyEditing[myEditingKey];
                broadcastEdit({ editType: 'stopEditing', editorType: type, editorIndex: parseInt(index) });
                myEditingKey = null;
            }
        }

        // Clear all edits by a disconnected player
        function clearPlayerEdits(username) {
            for (const key in currentlyEditing) {
                if (currentlyEditing[key].username === username) {
                    delete currentlyEditing[key];
                }
            }
        }

        // Track game players visible in builder
        let gamePlayersInBuilder = new Map(); // id -> {x, y, name, direction, currentMap, animation, frame, lastFrameTime}
        let gamePlayerAnimInterval = null; // Animation loop for game players in builder
        let builderGameSocket = null; // socket to game server to see testers
        let builderPlaySocket = null; // read-only listener on the live PLAY party (shows URL viewers on the builder)
        let liveRoomCode = null;      // room the host is currently live in (set by goLive)

        // Track builder co-op players in the room
        let builderPlayersInRoom = new Map(); // id -> {name, joinedAt}
        let builderMyId = null;     // assigned by server in welcome
        let isBuilderHost = false;  // true if I arrived to an empty room

        function connectBuilderMultiplayer(name, roomCode) {
            console.log('[BUILDER MP DEBUG] connectBuilderMultiplayer called with name:', name, 'roomCode:', roomCode);

            if (!roomCode) {
                console.log('[BUILDER MP DEBUG] No room code, solo mode');
                return; // Solo mode
            }

            builderPlayerName = name;
            builderRoomCode = roomCode;
            builderWantConnection = true; // we intend to stay connected — drives auto-reconnect
            hookBuilderVisibility();
            const wsUrl = 'wss://multiplayer.lakotafox.partykit.dev/parties/builder/' + roomCode;
            console.log('[BUILDER MP DEBUG] Connecting to:', wsUrl);

            try {
                builderSocket = new WebSocket(wsUrl);
                console.log('[BUILDER MP DEBUG] WebSocket created, waiting for open...');

                builderSocket.onopen = () => {
                    console.log('[BUILDER MP DEBUG] WebSocket OPEN!');
                    builderConnected = true;
                    builderReconnectDelay = 1000; // reset backoff on a successful connect
                    const joinMsg = {
                        type: 'join',
                        name: builderPlayerName,
                        gameType: 'builder'
                    };
                    console.log('[BUILDER MP DEBUG] Sending join message:', joinMsg);
                    builderSocket.send(JSON.stringify(joinMsg));
                    showBuilderStatus('Connected: ' + roomCode);
                    console.log('[BUILDER MP DEBUG] builderConnected is now:', builderConnected);
                };

                builderSocket.onmessage = (event) => {
                    console.log('[BUILDER MP DEBUG] Raw message received:', event.data);
                    try {
                        const data = JSON.parse(event.data);
                        handleBuilderMessage(data);
                    } catch (e) {
                        console.error('[BUILDER MP DEBUG] Parse error:', e);
                    }
                };

                builderSocket.onclose = (event) => {
                    console.log('[BUILDER MP DEBUG] WebSocket CLOSED, code:', event.code, 'reason:', event.reason);
                    builderConnected = false;
                    // Also close game socket and clear players
                    if (builderGameSocket) {
                        builderGameSocket.close();
                        builderGameSocket = null;
                    }
                    gamePlayersInBuilder.clear();
                    renderMap();
                    // Backgrounded tabs drop sockets — auto-reconnect and catch up on missed edits.
                    if (builderWantConnection) {
                        showBuilderStatus('Reconnecting…');
                        scheduleBuilderReconnect();
                    } else {
                        showBuilderStatus('Disconnected');
                    }
                };

                builderSocket.onerror = (err) => {
                    console.error('[BUILDER MP DEBUG] WebSocket ERROR:', err);
                };
            } catch (e) {
                console.error('[BUILDER MP DEBUG] Connect failed:', e);
            }

            // Also connect to game server to see players testing the game
            connectToGameServerForBuilder(roomCode);
        }

        function connectToGameServerForBuilder(roomCode) {
            const gameWsUrl = 'wss://multiplayer.lakotafox.partykit.dev/party/' + roomCode;
            console.log('[BUILDER GAME] Connecting to game server:', gameWsUrl);
            builderGameSocket = new WebSocket(gameWsUrl);

            builderGameSocket.onopen = () => {
                console.log('[BUILDER GAME] Connected to game server!');
            };

            builderGameSocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'welcome' && data.players) {
                        data.players.forEach(p => {
                            if (p.gameType === 'game2d') {
                                p.frame = 0;
                                p.lastFrameTime = Date.now();
                                gamePlayersInBuilder.set(p.id, p);
                            }
                        });
                        startGamePlayerAnimLoop();
                        renderMap();
                    } else if (data.type === 'join' && data.player && data.player.gameType === 'game2d') {
                        console.log('[BUILDER] Game player joined:', data.player.name);
                        data.player.frame = 0;
                        data.player.lastFrameTime = Date.now();
                        gamePlayersInBuilder.set(data.player.id, data.player);
                        startGamePlayerAnimLoop();
                        renderMap();
                    } else if (data.type === 'update' && data.player && data.player.gameType === 'game2d') {
                        const existing = gamePlayersInBuilder.get(data.player.id);
                        data.player.frame = existing ? existing.frame : 0;
                        data.player.lastFrameTime = existing ? existing.lastFrameTime : Date.now();
                        gamePlayersInBuilder.set(data.player.id, data.player);
                    } else if (data.type === 'leave' && data.playerId) {
                        console.log('[BUILDER] Game player left');
                        gamePlayersInBuilder.delete(data.playerId);
                        if (gamePlayersInBuilder.size === 0) stopGamePlayerAnimLoop();
                        renderMap();
                    }
                } catch (e) {}
            };

            builderGameSocket.onclose = () => {
                console.log('[BUILDER GAME] Disconnected from game server');
                gamePlayersInBuilder.clear();
                stopGamePlayerAnimLoop();
            };
        }

        // Read-only listener on the live PLAY party so viewers who joined by URL show up on the
        // builder canvas (the play party is a separate room from the default game party watched by
        // connectToGameServerForBuilder). play.ts strips gameType, so we DON'T filter on it here —
        // that room only ever holds game2d viewers. Mirrors the tester listener otherwise.
        function connectBuilderToPlayParty(room) {
            if (!room) return;
            try { if (builderPlaySocket) builderPlaySocket.close(); } catch (e) {}
            const url = 'wss://multiplayer.lakotafox.partykit.dev/parties/play/' + encodeURIComponent(room);
            console.log('[BUILDER PLAY] Watching live viewers at', url);
            builderPlaySocket = new WebSocket(url);
            builderPlaySocket.onmessage = (event) => {
                let data; try { data = JSON.parse(event.data); } catch (e) { return; }
                if (data.type === 'welcome' && Array.isArray(data.players)) {
                    data.players.forEach(p => {
                        p.frame = 0; p.lastFrameTime = Date.now();
                        gamePlayersInBuilder.set(p.id, p);
                    });
                    if (data.players.length) { startGamePlayerAnimLoop(); renderMap(); }
                } else if (data.type === 'join' && data.player) {
                    data.player.frame = 0; data.player.lastFrameTime = Date.now();
                    gamePlayersInBuilder.set(data.player.id, data.player);
                    startGamePlayerAnimLoop(); renderMap();
                } else if (data.type === 'update' && data.player) {
                    const ex = gamePlayersInBuilder.get(data.player.id);
                    data.player.frame = ex ? ex.frame : 0;
                    data.player.lastFrameTime = ex ? ex.lastFrameTime : Date.now();
                    gamePlayersInBuilder.set(data.player.id, data.player);
                } else if (data.type === 'leave' && data.playerId) {
                    gamePlayersInBuilder.delete(data.playerId);
                    if (gamePlayersInBuilder.size === 0) stopGamePlayerAnimLoop();
                    renderMap();
                }
            };
            builderPlaySocket.onclose = () => { console.log('[BUILDER PLAY] Disconnected from play party'); };
            builderPlaySocket.onerror = () => { console.log('[BUILDER PLAY] Play party socket error'); };
        }

        // Animation loop for game players shown in builder
        function startGamePlayerAnimLoop() {
            if (gamePlayerAnimInterval) return; // Already running
            gamePlayerAnimInterval = setInterval(() => {
                if (gamePlayersInBuilder.size === 0) {
                    stopGamePlayerAnimLoop();
                    return;
                }
                const now = Date.now();
                let needsRender = false;
                gamePlayersInBuilder.forEach(p => {
                    // Advance frame every 150ms for walking players
                    if (p.animation === 'walk' && now - p.lastFrameTime > 150) {
                        p.frame = p.frame + 1; // uncapped; draw uses % frames.length
                        p.lastFrameTime = now;
                        needsRender = true;
                    } else if (p.animation !== 'walk') {
                        // Reset to idle frame
                        if (p.frame !== 0) needsRender = true;
                        p.frame = 0;
                    }
                });
                if (needsRender) renderMap();
            }, 100);
        }

        function stopGamePlayerAnimLoop() {
            if (gamePlayerAnimInterval) {
                clearInterval(gamePlayerAnimInterval);
                gamePlayerAnimInterval = null;
            }
        }

        // Auto-reconnect the co-op socket with capped backoff. The server keeps an
        // authoritative edit log, so on reconnect we ask for everything missed (requestSince).
        function scheduleBuilderReconnect() {
            if (!builderWantConnection || builderReconnectTimer) return;
            builderReconnectTimer = setTimeout(() => {
                builderReconnectTimer = null;
                if (builderWantConnection && (!builderSocket || builderSocket.readyState > 1)) {
                    console.log('[BUILDER MP] reconnecting (delay was ' + builderReconnectDelay + 'ms)…');
                    builderReconnectDelay = Math.min(builderReconnectDelay * 1.5, 15000);
                    connectBuilderMultiplayer(builderPlayerName, builderRoomCode);
                }
            }, builderReconnectDelay);
        }

        // When the tab comes back to the foreground: reconnect if the socket died, or
        // (if still open) ask the server for any edits that landed while we were away.
        function hookBuilderVisibility() {
            if (builderVisibilityHooked) return;
            builderVisibilityHooked = true;
            document.addEventListener('visibilitychange', () => {
                if (document.hidden || !builderWantConnection) return;
                if (!builderSocket || builderSocket.readyState > 1) {
                    builderReconnectDelay = 1000;
                    scheduleBuilderReconnect();
                } else if (builderSocket.readyState === 1) {
                    try {
                        builderSocket.send(JSON.stringify({ type: 'requestSince', since: builderLastSeq }));
                        console.log('[BUILDER MP] tab visible — requesting catch-up since', builderLastSeq);
                    } catch (e) {}
                }
            });
        }

        function handleBuilderMessage(data) {
            console.log('[BUILDER MP DEBUG] handleBuilderMessage received:', data);
            console.log('[BUILDER MP DEBUG] data.type:', data.type);

            // Track players joining/leaving for room info
            if (data.type === 'welcome') {
                builderMyId = data.yourId || null;
                // Initial player list when we join
                if (data.players) {
                    builderPlayersInRoom.clear();
                    data.players.forEach(p => {
                        builderPlayersInRoom.set(p.id, { name: p.name, joinedAt: Date.now() });
                    });
                    // Empty room = I'm the host (source of truth for late joiners)
                    isBuilderHost = (data.players.length === 0);
                    console.log('[BUILDER MP] Players in room:', builderPlayersInRoom.size, '| Host:', isBuilderHost, '| MyId:', builderMyId);
                }
                // Ask the server for every edit we missed (covers first join AND reconnect
                // after a slept tab). builderLastSeq persists across reconnects.
                if (typeof data.serverSeq === 'number' && data.serverSeq > builderLastSeq) {
                    try {
                        builderSocket.send(JSON.stringify({ type: 'requestSince', since: builderLastSeq }));
                        console.log('[BUILDER MP] welcome: requesting catch-up since', builderLastSeq, '(server at', data.serverSeq + ')');
                    } catch (e) {}
                }
                return;
            }

            if (data.type === 'join') {
                if (data.player) {
                    builderPlayersInRoom.set(data.player.id, { name: data.player.name, joinedAt: Date.now() });
                    console.log('[BUILDER MP] Player joined:', data.player.name, '- Total:', builderPlayersInRoom.size);
                    // NOTE: late joiners now catch up from the SERVER's authoritative edit log
                    // (they send requestSince on welcome), so we no longer host-replay here —
                    // doing both would double-apply edits (e.g. duplicate quests).
                }
                return;
            }

            if (data.type === 'leave') {
                if (data.playerId) {
                    // Clear any editing locks held by this player
                    const leavingPlayer = builderPlayersInRoom.get(data.playerId);
                    if (leavingPlayer && leavingPlayer.name) {
                        clearPlayerEdits(leavingPlayer.name);
                    }
                    builderPlayersInRoom.delete(data.playerId);
                    console.log('[BUILDER MP] Player left - Remaining:', builderPlayersInRoom.size);
                }
                return;
            }

            // Handle edit messages from other builders
            if (data.type === 'builderEdit' && data.editType) {
                // Directed message — skip if it's not meant for me
                if (data.targetId && data.targetId !== builderMyId) {
                    return;
                }
                console.log('[BUILDER MP DEBUG] >>> APPLYING REMOTE EDIT <<<', data.editType);
                // Advance our catch-up cursor so reconnects only re-request the gap.
                if (typeof data._seq === 'number' && data._seq > builderLastSeq) builderLastSeq = data._seq;
                applyRemoteEdit(data);
            }
        }

        // Resync Room button + host auto-resync-on-join. We do NOT send full project state
        // (base saves are shared out-of-band via file download/upload — see the Save button
        // in Tools menu). We replay only the session edit log: every broadcastEdit made
        // since this host connected. Tiny and fast.
        function sendFullProject(targetId) {
            if (!builderSocket || !builderConnected) return;
            if (!Array.isArray(sessionEditLog) || sessionEditLog.length === 0) {
                console.log('[BUILDER MP] No session edits to replay' + (targetId ? ' -> ' + targetId : ''));
                return;
            }
            // Chunk the log so individual messages stay under the WebSocket size cap.
            // Target ~8 KB per chunk to leave headroom; skip any single oversized edit.
            const TARGET_CHUNK_BYTES = 8 * 1024;
            const chunks = [];
            let cur = [];
            let curBytes = 0;
            for (const e of sessionEditLog) {
                const sz = JSON.stringify(e).length;
                if (sz > TARGET_CHUNK_BYTES * 1.5) {
                    // Single edit larger than chunk budget — send it alone if possible.
                    if (cur.length) { chunks.push(cur); cur = []; curBytes = 0; }
                    chunks.push([e]);
                    continue;
                }
                if (curBytes + sz > TARGET_CHUNK_BYTES && cur.length > 0) {
                    chunks.push(cur);
                    cur = [];
                    curBytes = 0;
                }
                cur.push(e);
                curBytes += sz;
            }
            if (cur.length) chunks.push(cur);

            console.log('[BUILDER MP] Replaying session log —',
                        sessionEditLog.length, 'edits in', chunks.length, 'chunk(s)',
                        targetId ? ('-> ' + targetId) : '(broadcast)');

            chunks.forEach((chunk, i) => {
                setTimeout(() => {
                    if (!builderSocket || !builderConnected) return;
                    const msg = JSON.stringify({
                        type: 'builderEdit',
                        editType: 'sessionLogReplay',
                        targetId: targetId || undefined,
                        edits: chunk
                    });
                    try {
                        builderSocket.send(msg);
                        console.log('[BUILDER MP] session chunk', (i + 1) + '/' + chunks.length,
                                    chunk.length, 'edits,', (msg.length / 1024).toFixed(1), 'KB');
                    } catch (err) {
                        console.error('[BUILDER MP] session chunk send failed:', err);
                    }
                }, 60 * i); // stagger so we don't blast the socket
            });
        }

        function loadFullProject(project) {
            console.log('[BUILDER MP] Loading full project with maps:', Object.keys(project.maps || {}));
            project = migrateProjectData(project);

            // Load maps — replace-not-merge so ghost maps from the previous session don't linger.
            if (project.maps && typeof project.maps === 'object') {
                maps = {};
                for (const mapName in project.maps) {
                    maps[mapName] = project.maps[mapName];
                }
            }

            // Load triggers, NPCs, sounds, lights
            placedTriggers = project.placedTriggers || [];
            ensureTriggerUids(placedTriggers); // Wave 7: stamp UIDs for MP-late-joiners with legacy data.
            placedNpcs = project.placedNpcs || [];
            // Ensure all placed NPCs have UIDs (for backwards compatibility)
            placedNpcs.forEach((npc, i) => {
                if (!npc.uid) {
                    npc.uid = 'npc_' + npc.npcIndex + '_' + i + '_' + Date.now();
                }
            });

            // Load static objects from multiplayer sync
            staticObjects = [];
            placedStaticObjects = project.placedStaticObjects || [];
            if (project.staticObjects && project.staticObjects.length > 0) {
                project.staticObjects.forEach((objData, i) => {
                    staticObjects[i] = {
                        ...objData,
                        _spriteImg: new Image()
                    };
                    staticObjects[i]._spriteImg.src = objData.spriteData;
                });
            }
            updateStaticObjectsList();

            tileSounds = project.tileSounds || {};
            normalizeTileSoundKeys(); // migrate legacy "x,y" keys -> "main:x,y"
            pointLights = project.pointLights || {};
            polyLights = project.polyLights || [];
            tileCollisions = project.tileCollisions || {};
            collisionMasks = project.collisionMasks || {};
            tileSplitLines = project.tileSplitLines || {};
            tileSplitLineFlipped = project.tileSplitLineFlipped || {};

            // Load animated props (need to reload images)
            animatedProps = project.animatedProps || [];
            animatedProps.forEach((prop, i) => {
                if (prop.spriteData) {
                    const img = new Image();
                    img.onload = () => {
                        animatedProps[i]._spriteImg = img;
                        updateAnimPropListDisplay();
                    };
                    img.src = prop.spriteData;
                }
            });

            // Load tilesets (need to reload images from base64)
            console.log('[BUILDER MP] Loading tilesets:', project.tilesets ? project.tilesets.length : 0);
            if (project.tilesets && project.tilesets.length > 0) {
                tilesets = [];
                project.tilesets.forEach((ts, i) => {
                    console.log('[BUILDER MP] Tileset', i, ts.name, 'data length:', ts.data ? ts.data.length : 'NO DATA');
                    if (!ts.data) {
                        console.error('[BUILDER MP] Tileset', ts.name, 'has no data!');
                        return;
                    }
                    const img = new Image();
                    img.onload = () => {
                        console.log('[BUILDER MP] Tileset loaded:', ts.name, img.width, 'x', img.height);
                        tilesets[i] = { name: ts.name, img: img, data: ts.data };
                        // Update tilesetImg if this is the current tileset
                        if (i === (project.currentTilesetIndex || 0)) {
                            tilesetImg = img;
                            currentTilesetIndex = i;
                        }
                        updateTilesetDropdown();
                        renderTilesetPanel();
                        renderMap();
                    };
                    img.onerror = (e) => {
                        console.error('[BUILDER MP] Failed to load tileset image:', ts.name, e);
                    };
                    img.src = ts.data;
                });
            } else {
                console.warn('[BUILDER MP] No tilesets in project!');
            }

            // Load NPC definitions (need to reload images from spriteData)
            if (project.npcs && project.npcs.length > 0) {
                npcs = [];
                project.npcs.forEach((npc, i) => {
                    npcs[i] = { ...npc };
                    if (npc.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            // Wave 8: canonical property is _editorImg (what the renderer reads).
                            npcs[i]._editorImg = img;
                            updateNpcList();
                        };
                        img.src = npc.spriteData;
                    }
                });
            }

            // Load dialogs
            if (project.dialogs) {
                dialogs = project.dialogs;
            }

            // Load shops
            if (project.shops) {
                shops = project.shops;
            }
            placedShops = project.placedShops || [];
            startingGold = project.startingGold !== undefined ? project.startingGold : 100;

            // Load player characters
            if (project.playerCharacters && project.playerCharacters.length > 0) {
                playerCharacters = [];
                project.playerCharacters.forEach((char, i) => {
                    playerCharacters[i] = { ...char };
                    if (char.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            playerCharacters[i]._spriteImg = img;
                            updatePlayerList();
                        };
                        img.src = char.spriteData;
                    }
                });
                activePlayerIndex = project.activePlayerIndex !== undefined ? project.activePlayerIndex : 0;
            }

            // Load spawn
            if (project.playerPreviewPos) {
                playerPreviewPos = project.playerPreviewPos;
            }
            spawnMapName = project.spawnMapName || spawnMapName;

            // ===== Wave 2 (R2): complete the field list that getProjectData serializes =====
            // Lighting settings — spread-with-defaults so future fields round-trip.
            if (project.lightingSettings) {
                lightingSettings = {
                    playerLight: false,
                    playerLightRadius: 4,
                    ...project.lightingSettings
                };
                const playerLightEl = document.getElementById('playerLight');
                const radiusEl = document.getElementById('playerLightRadius');
                const radiusVal = document.getElementById('playerLightRadiusVal');
                if (playerLightEl) playerLightEl.checked = !!lightingSettings.playerLight;
                if (radiusEl) radiusEl.value = lightingSettings.playerLightRadius;
                if (radiusVal) radiusVal.textContent = lightingSettings.playerLightRadius;
            }

            // Sounds library (with Audio decode) — was silently dropped before.
            sounds = [];
            if (Array.isArray(project.sounds)) {
                project.sounds.forEach((s, i) => {
                    sounds[i] = {
                        ...s, // preserve all saved fields — don't whitelist
                        name: s.name,
                        data: s.data,
                        duration: s.duration || 0,
                        type: s.type || 'ambient'
                    };
                });
            }
            if (project.playerSounds) {
                playerSounds = {
                    walk: { soundIndex: -1, interval: 200, volume: 0.5, pitchVariation: 0.1 },
                    attack: { soundIndex: -1, volume: 0.7, pitchVariation: 0.15, lengthVariation: 0 },
                    inventoryOpen: { soundIndex: -1, volume: 0.5 },
                    inventoryClose: { soundIndex: -1, volume: 0.5 },
                    ...project.playerSounds
                };
            }
            if (typeof updateSoundDropdown === 'function') updateSoundDropdown();
            if (typeof updatePlayerSoundAssignments === 'function') updatePlayerSoundAssignments();

            // Quest sounds library.
            if (Array.isArray(project.questSounds)) {
                questSounds = project.questSounds.map(s => ({ name: s.name, data: s.data }));
            }

            // Items + placed items.
            items = [];
            placedItems = Array.isArray(project.placedItems) ? project.placedItems : [];
            fishingLoot = Array.isArray(project.fishingLoot) ? project.fishingLoot.map(e => ({ ...e })) : [];
            if (typeof itemImages !== 'undefined') {
                for (const k of Object.keys(itemImages)) delete itemImages[k];
            }
            if (Array.isArray(project.items)) {
                project.items.forEach((itemData, i) => {
                    items[i] = {
                        ...itemData,
                        id: itemData.id || ('item_' + i)
                    };
                    if (itemData.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            if (typeof itemImages !== 'undefined') itemImages[i] = img;
                            if (typeof updateItemsList === 'function') updateItemsList();
                            if (typeof renderMap === 'function') renderMap();
                        };
                        img.src = itemData.spriteData;
                    }
                });
            }
            if (typeof updateItemsList === 'function') updateItemsList();

            // Placed dialog tiles (signs).
            placedDialogTiles = Array.isArray(project.placedDialogTiles) ? project.placedDialogTiles : [];

            // Quests.
            if (Array.isArray(project.quests)) {
                quests = project.quests;
                if (typeof renderQuestList === 'function') renderQuestList();
            }

            // Placed animated props.
            if (Array.isArray(project.placedAnimProps)) {
                placedAnimProps = project.placedAnimProps;
            }

            // Player layer index.
            if (typeof project.playerLayerIndex === 'number') {
                playerLayerIndex = project.playerLayerIndex;
            }
            // ===== end Wave 2 additions =====

            // Switch to the current map
            if (project.currentMapName && maps[project.currentMapName]) {
                currentMapName = project.currentMapName;
                loadMapState(maps[currentMapName]);
            }

            // Update all UI
            updateMapDropdowns();
            updateTriggerList();
            updatePlacedNpcList();
            updatePlacedSoundsList();
            updatePlacedLightsList();
            updatePolyLightsList();
            updateAnimPropListDisplay();
            updateDialogList();
            updatePlayerList();
            renderLayerList();
            renderMap();

            console.log('[BUILDER MP] Full project loaded successfully!');
            showBuilderStatus('Synced: ' + builderRoomCode);
        }

        // Idempotency guards: a catch-up replay or late-join resync can re-deliver a
        // place* edit that's already present. Without these, the receivers blind-push
        // and duplicate the entity. NPCs/triggers carry a uid; items dedup by position.
        function _placedNpcExists(npc) { return !!(npc && npc.uid && placedNpcs.some(n => n && n.uid === npc.uid)); }
        function _placedTriggerExists(t) { return !!(t && t.uid && placedTriggers.some(x => x && x.uid === t.uid)); }
        function _placedItemExists(it) { return !!(it && placedItems.some(p => p && p.x === it.x && p.y === it.y && p.mapName === it.mapName && p.itemIndex === it.itemIndex)); }

        function applyRemoteEdit(edit) {
            console.log('[BUILDER MP] Applying remote edit:', edit.editType);

            // Get the target map's layers
            let targetLayers;
            if (edit.mapName && edit.mapName !== currentMapName && maps[edit.mapName]) {
                // Edit is for a different map
                targetLayers = maps[edit.mapName].layers;
            } else {
                // Edit is for current map
                targetLayers = layers;
            }

            switch (edit.editType) {
                case 'batch':
                    // Apply batch of edits
                    let needsRender = false;
                    for (const e of edit.edits) {
                        // Apply each edit without rendering
                        applyRemoteEditNoRender(e);
                        if (!e.mapName || e.mapName === currentMapName) needsRender = true;
                    }
                    if (needsRender) renderMap();
                    break;

                case 'fullProject':
                    // Legacy full-project resync. Now vestigial — kept for backward compat
                    // with any peer still running older code.
                    if (edit.project) {
                        console.log('[BUILDER MP] Receiving full project resync (legacy path)');
                        loadFullProject(edit.project);
                        showBuilderStatus('Resynced from room');
                    }
                    break;

                case 'sessionLogReplay':
                    // Catch-up batch from the server's authoritative log (or a peer's session log).
                    // Base saves are shared out-of-band; this catches us up on in-session changes.
                    if (Array.isArray(edit.edits)) {
                        console.log('[BUILDER MP] Replaying', edit.edits.length, 'session edits');
                        let applied = 0, failed = 0;
                        for (const e of edit.edits) {
                            try {
                                applyRemoteEdit(e);
                                if (typeof e._seq === 'number' && e._seq > builderLastSeq) builderLastSeq = e._seq;
                                applied++;
                            }
                            catch (err) { failed++; console.warn('[MP] replay failed for', e?.editType, err); }
                        }
                        // Advance the cursor to the server's reported head so we don't re-request
                        // gaps (e.g. oversized edits the server didn't log).
                        if (typeof edit.serverSeq === 'number' && edit.serverSeq > builderLastSeq) builderLastSeq = edit.serverSeq;
                        if (applied) showBuilderStatus('Synced ' + applied + ' edits' + (failed ? ' (' + failed + ' failed)' : ''));
                    }
                    break;

                case 'tilesetSync':
                    if (edit.data) {
                        const tsImg = new Image();
                        tsImg.onload = () => {
                            tilesets[edit.index] = { name: edit.name, img: tsImg, data: edit.data };
                            if (edit.index === currentTilesetIndex) {
                                tilesetImg = tsImg;
                            }
                            updateTilesetDropdown();
                            renderTilesetPanel();
                            renderMap();
                            console.log('[BUILDER MP] Tileset synced:', edit.index, edit.name);
                        };
                        tsImg.src = edit.data;
                    }
                    break;

                // HOTFIX 2026-04-17 streaming receivers — fill in base64 assets that arrive
                // after the main (stripped) fullProject payload.
                case 'itemSpriteSync':
                    if (Array.isArray(items) && items[edit.index] && edit.data) {
                        items[edit.index].spriteData = edit.data;
                        const img = new Image();
                        img.onload = () => {
                            if (typeof itemImages !== 'undefined') itemImages[edit.index] = img;
                            if (typeof updateItemsList === 'function') updateItemsList();
                            renderMap();
                        };
                        img.src = edit.data;
                    }
                    break;
                case 'npcSpriteSync':
                    if (Array.isArray(npcs) && npcs[edit.index] && edit.data) {
                        npcs[edit.index].spriteData = edit.data;
                        const img = new Image();
                        img.onload = () => {
                            npcs[edit.index]._editorImg = img;
                            if (typeof updateNpcList === 'function') updateNpcList();
                            renderMap();
                        };
                        img.src = edit.data;
                    }
                    break;
                case 'animPropSpriteSync':
                    if (Array.isArray(animatedProps) && animatedProps[edit.index] && edit.data) {
                        animatedProps[edit.index].spriteData = edit.data;
                        const img = new Image();
                        img.onload = () => {
                            animatedProps[edit.index]._spriteImg = img;
                            if (typeof updateAnimPropListDisplay === 'function') updateAnimPropListDisplay();
                            renderMap();
                        };
                        img.src = edit.data;
                    }
                    break;
                case 'staticObjSpriteSync':
                    if (Array.isArray(staticObjects) && staticObjects[edit.index] && edit.data) {
                        staticObjects[edit.index].spriteData = edit.data;
                        const img = new Image();
                        img.onload = () => {
                            staticObjects[edit.index]._spriteImg = img;
                            if (typeof updateStaticObjectsList === 'function') updateStaticObjectsList();
                            renderMap();
                        };
                        img.src = edit.data;
                    }
                    break;
                case 'soundBlobSync':
                    if (Array.isArray(sounds) && sounds[edit.index] && edit.data) {
                        sounds[edit.index].data = edit.data;
                        if (typeof updateSoundDropdown === 'function') updateSoundDropdown();
                        if (typeof updatePlayerSoundAssignments === 'function') updatePlayerSoundAssignments();
                    }
                    break;
                case 'questSoundBlobSync':
                    if (Array.isArray(questSounds) && questSounds[edit.index] && edit.data) {
                        questSounds[edit.index].data = edit.data;
                    }
                    break;
                case 'playerCharSheetSync':
                    if (Array.isArray(playerCharacters) && playerCharacters[edit.index] && edit.data) {
                        const c = playerCharacters[edit.index];
                        if (edit.sheetIndex === -1 || edit.sheetIndex === undefined) {
                            c.spriteData = edit.data;
                            const img = new Image();
                            img.onload = () => {
                                c._spriteImg = img;
                                if (typeof updatePlayerList === 'function') updatePlayerList();
                            };
                            img.src = edit.data;
                        } else if (typeof edit.sheetIndex === 'number') {
                            if (!Array.isArray(c.spriteSheets)) c.spriteSheets = [];
                            c.spriteSheets[edit.sheetIndex] = edit.data;
                        }
                    }
                    break;

                case 'tile':
                    // Apply tile placement
                    if (!targetLayers[edit.layer]) targetLayers[edit.layer] = [];
                    if (!targetLayers[edit.layer][edit.y]) targetLayers[edit.layer][edit.y] = [];
                    targetLayers[edit.layer][edit.y][edit.x] = edit.cell;
                    if (!edit.mapName || edit.mapName === currentMapName) {
                        renderMap();
                    }
                    break;

                case 'eraseTile':
                    // Apply tile erasure
                    if (targetLayers[edit.layer] && targetLayers[edit.layer][edit.y]) {
                        targetLayers[edit.layer][edit.y][edit.x] = null;
                    }
                    if (!edit.mapName || edit.mapName === currentMapName) {
                        renderMap();
                    }
                    break;

                case 'tileSound':
                    // Apply tile sound placement
                    tileSounds[edit.key] = edit.sound;
                    updatePlacedSoundsList();
                    renderMap();
                    break;

                case 'removeTileSound':
                    // Remove tile sound
                    delete tileSounds[edit.key];
                    updatePlacedSoundsList();
                    renderMap();
                    break;

                case 'light':
                    // Apply light placement
                    pointLights[edit.key] = edit.light;
                    updatePlacedLightsList();
                    renderMap();
                    break;

                case 'removeLight':
                    // Remove light
                    delete pointLights[edit.key];
                    updatePlacedLightsList();
                    renderMap();
                    break;

                case 'addPolyLight':
                    // Add polygon light
                    polyLights.push(edit.light);
                    updatePolyLightsList();
                    renderMap();
                    break;

                case 'removePolyLight':
                    // Remove polygon light by ID
                    const polyIdx = polyLights.findIndex(pl => pl.id === edit.lightId);
                    if (polyIdx >= 0) {
                        polyLights.splice(polyIdx, 1);
                        updatePolyLightsList();
                        renderMap();
                    }
                    break;

                case 'placeNpc':
                    // Add NPC (guard against duplicate from catch-up replay / resync)
                    if (!_placedNpcExists(edit.npc)) placedNpcs.push(edit.npc);
                    updatePlacedNpcList();
                    renderMap();
                    break;

                case 'removeNpc':
                    // Remove NPC by index
                    if (edit.index >= 0 && edit.index < placedNpcs.length) {
                        placedNpcs.splice(edit.index, 1);
                        updatePlacedNpcList();
                        renderMap();
                    }
                    break;

                case 'placeTrigger':
                    // Add trigger (guard against duplicate from catch-up replay / resync)
                    if (!_placedTriggerExists(edit.trigger)) placedTriggers.push(edit.trigger);
                    updateTriggerList();
                    renderMap();
                    break;

                case 'removeTrigger': {
                    // Wave 7: prefer UID lookup, fall back to index for pre-UID peers.
                    let idx = (edit.uid) ? findTriggerByUid(edit.uid) : -1;
                    if (idx < 0 && typeof edit.index === 'number' && edit.index >= 0 && edit.index < placedTriggers.length) idx = edit.index;
                    if (idx >= 0 && idx < placedTriggers.length) {
                        placedTriggers.splice(idx, 1);
                        updateTriggerList();
                        renderMap();
                    } else if (edit.uid) {
                        console.warn('[MP] removeTrigger: uid', edit.uid, 'not found locally');
                    }
                    break;
                }

                case 'updateTrigger': {
                    // Wave 7: prefer UID lookup over fragile array-index.
                    let idx = (edit.uid) ? findTriggerByUid(edit.uid) : -1;
                    if (idx < 0 && edit.trigger && edit.trigger.uid) idx = findTriggerByUid(edit.trigger.uid);
                    if (idx < 0 && typeof edit.index === 'number' && edit.index >= 0 && edit.index < placedTriggers.length) idx = edit.index;
                    if (idx >= 0 && idx < placedTriggers.length && edit.trigger) {
                        placedTriggers[idx] = edit.trigger;
                        updateTriggerList();
                        renderMap();
                        console.log('[BUILDER MP] Remote trigger updated:', idx, edit.trigger.uid || '(no uid)');
                    } else if (edit.uid || (edit.trigger && edit.trigger.uid)) {
                        console.warn('[MP] updateTrigger: uid not found locally', edit.uid || edit.trigger.uid);
                    }
                    break;
                }

                case 'placeItem':
                    // Add item (guard against duplicate from catch-up replay / resync)
                    if (!_placedItemExists(edit.item)) placedItems.push(edit.item);
                    updatePlacedItemsList();
                    renderMap();
                    console.log('[BUILDER MP] Remote item placed');
                    break;

                case 'removeItem':
                    // Remove item by position
                    const itemIdx = placedItems.findIndex(p =>
                        p.x === edit.x && p.y === edit.y &&
                        (!p.mapName || p.mapName === edit.mapName)
                    );
                    if (itemIdx >= 0) {
                        placedItems.splice(itemIdx, 1);
                        updatePlacedItemsList();
                        renderMap();
                        console.log('[BUILDER MP] Remote item removed');
                    }
                    break;

                case 'updatePlacedAnimProp':
                    // Update placed anim prop (e.g., instance item override)
                    if (edit.index >= 0 && edit.index < placedAnimProps.length) {
                        placedAnimProps[edit.index] = edit.prop;
                        renderMap();
                        console.log('[BUILDER MP] Remote placed anim prop updated:', edit.index);
                    }
                    break;

                case 'collision':
                    // Apply collision change
                    if (edit.value) {
                        tileCollisions[edit.key] = true;
                    } else {
                        delete tileCollisions[edit.key];
                    }
                    break;

                case 'collisionMask':
                    // Apply collision mask
                    collisionMasks[edit.key] = edit.mask;
                    break;

                case 'addLayer':
                    // Add new layer (from another builder)
                    if (edit.mapName === currentMapName) {
                        addLayer(true); // true = from network, don't rebroadcast
                    } else if (maps[edit.mapName]) {
                        maps[edit.mapName].layers.push(createEmptyLayer());
                    }
                    break;

                case 'addMap':
                    // Another builder created a new map
                    if (!maps[edit.mapName]) {
                        createMapData(edit.mapName);
                        updateMapDropdowns();
                        console.log('[BUILDER MP] Remote map created:', edit.mapName);
                    }
                    break;

                case 'deleteMap':
                    // Another builder deleted a map
                    if (maps[edit.mapName]) {
                        deleteMap(edit.mapName);
                        updateMapDropdowns();
                        updateTriggerList();
                        renderMap();
                        console.log('[BUILDER MP] Remote map deleted:', edit.mapName);
                    }
                    break;

                case 'clearMap':
                    // Another builder cleared a map
                    if (edit.mapName === currentMapName) {
                        initMap();
                        mapInitialized = true;
                        renderMap();
                    } else if (maps[edit.mapName]) {
                        // Clear the other map's data
                        maps[edit.mapName].layers = [createEmptyLayer()];
                        maps[edit.mapName].tileCollisions = {};
                        maps[edit.mapName].collisionMasks = {};
                    }
                    console.log('[BUILDER MP] Remote map cleared:', edit.mapName);
                    break;

                case 'addAnimProp':
                    // Another builder added an animated prop
                    animatedProps.push(edit.prop);
                    // Load the sprite image
                    if (edit.prop.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            animatedProps[animatedProps.length - 1]._spriteImg = img;
                            updateAnimPropListDisplay();
                            renderMap();
                        };
                        img.src = edit.prop.spriteData;
                    }
                    updateAnimPropListDisplay();
                    console.log('[BUILDER MP] Remote anim prop added:', edit.prop.name);
                    break;

                case 'removeAnimProp':
                    // Another builder removed an animated prop
                    if (edit.index >= 0 && edit.index < animatedProps.length) {
                        animatedProps.splice(edit.index, 1);
                        // Wave 5: also reindex animTile cells across every map's layers.
                        reindexAnimPropReferences(edit.index);
                        updateAnimPropListDisplay();
                        renderMap();
                        console.log('[BUILDER MP] Remote anim prop removed:', edit.index);
                    }
                    break;

                case 'addStaticObj':
                    // Another builder created a static object
                    const newStaticObj = {
                        name: edit.obj.name,
                        spriteData: edit.obj.spriteData,
                        width: edit.obj.width,
                        height: edit.obj.height,
                        tilesetIndex: edit.obj.tilesetIndex,
                        sourceTiles: edit.obj.sourceTiles,
                        sourceOrigin: edit.obj.sourceOrigin,
                        _spriteImg: new Image()
                    };
                    newStaticObj._spriteImg.onload = () => {
                        updateStaticObjectsList();
                        renderMap();
                    };
                    newStaticObj._spriteImg.src = edit.obj.spriteData;
                    staticObjects.push(newStaticObj);
                    updateStaticObjectsList();
                    console.log('[BUILDER MP] Remote static object added:', edit.obj.name);
                    break;

                case 'removeStaticObj':
                    // Another builder removed a static object definition
                    if (edit.index >= 0 && edit.index < staticObjects.length) {
                        placedStaticObjects = placedStaticObjects.filter(p => p.objIndex !== edit.index);
                        placedStaticObjects.forEach(p => {
                            if (p.objIndex > edit.index) p.objIndex--;
                        });
                        staticObjects.splice(edit.index, 1);
                        if (currentStaticObjIndex >= staticObjects.length) {
                            currentStaticObjIndex = staticObjects.length - 1;
                        }
                        updateStaticObjectsList();
                        renderMap();
                        console.log('[BUILDER MP] Remote static object removed:', edit.index);
                    }
                    break;

                case 'placeStaticObj':
                    // Another builder placed a static object
                    if (edit.placed) {
                        placedStaticObjects.push(edit.placed);
                        renderMap();
                        console.log('[BUILDER MP] Remote static object placed at', edit.placed.x, edit.placed.y);
                    }
                    break;

                case 'removeStaticObjPlacement':
                    // Another builder removed a placed static object
                    placedStaticObjects = placedStaticObjects.filter(p =>
                        !(p.x === edit.x && p.y === edit.y && p.mapName === edit.mapName)
                    );
                    renderMap();
                    console.log('[BUILDER MP] Remote static object placement removed');
                    break;

                case 'updateStaticObjCollision':
                    // Another builder updated a static object's collision box
                    if (edit.index >= 0 && edit.index < placedStaticObjects.length) {
                        placedStaticObjects[edit.index].collisionBox = edit.collisionBox;
                        renderMap();
                        console.log('[BUILDER MP] Remote static object collision updated:', edit.index);
                    }
                    break;

                case 'updateAnimProp':
                    // Another builder updated an animated prop
                    if (edit.index >= 0 && edit.index < animatedProps.length) {
                        animatedProps[edit.index] = edit.prop;
                        // Load the sprite image
                        if (edit.prop.spriteData) {
                            const img = new Image();
                            img.onload = () => {
                                animatedProps[edit.index]._spriteImg = img;
                                updateAnimPropListDisplay();
                                renderMap();
                            };
                            img.src = edit.prop.spriteData;
                        }
                        updateAnimPropListDisplay();
                        console.log('[BUILDER MP] Remote anim prop updated:', edit.index);
                    }
                    break;

                case 'addTileset':
                    // Another builder added a tileset
                    if (edit.name && edit.data) {
                        const img = new Image();
                        img.onload = () => {
                            tilesets.push({ name: edit.name, img: img, data: edit.data });
                            updateTilesetDropdown();
                            renderMap();
                            console.log('[BUILDER MP] Remote tileset added:', edit.name);
                        };
                        img.src = edit.data;
                    }
                    break;

                case 'addNpc':
                    // Another builder added an NPC definition
                    if (edit.npc) {
                        npcs.push({ ...edit.npc });
                        const idx = npcs.length - 1;
                        if (edit.npc.spriteData) {
                            const img = new Image();
                            img.onload = () => {
                                npcs[idx]._editorImg = img; // Wave 8: canonical property.
                                updateNpcList();
                            };
                            img.src = edit.npc.spriteData;
                        }
                        updateNpcList();
                        console.log('[BUILDER MP] Remote NPC added:', edit.npc.name);
                    }
                    break;

                case 'updateNpc':
                    // Another builder updated an NPC definition
                    if (edit.index >= 0 && edit.index < npcs.length && edit.npc) {
                        npcs[edit.index] = { ...edit.npc };
                        if (edit.npc.spriteData) {
                            const img = new Image();
                            img.onload = () => {
                                npcs[edit.index]._editorImg = img; // Wave 8: canonical property.
                                updateNpcList();
                            };
                            img.src = edit.npc.spriteData;
                        }
                        updateNpcList();
                        console.log('[BUILDER MP] Remote NPC updated:', edit.npc.name);
                    }
                    break;

                case 'updatePlacedNpc':
                    // Another builder updated a placed NPC (enemy settings, path, speed, etc.)
                    if (edit.index >= 0 && edit.index < placedNpcs.length && edit.npc) {
                        placedNpcs[edit.index] = edit.npc;
                        // Refresh UI if this NPC is currently selected
                        if (selectedPlacedNpcIndex === edit.index) {
                            selectPlacedNpc(edit.index);
                        }
                        updatePlacedNpcList();
                        renderMap();
                        console.log('[BUILDER MP] Remote placed NPC updated at index:', edit.index);
                    }
                    break;

                case 'addDialog':
                    // Another builder added a dialog
                    if (edit.dialog) {
                        dialogs.push(edit.dialog);
                        updateDialogList();
                        console.log('[BUILDER MP] Remote dialog added:', edit.dialog.name);
                    }
                    break;

                case 'updateDialog':
                    // Another builder updated a dialog
                    if (edit.index >= 0 && edit.index < dialogs.length && edit.dialog) {
                        dialogs[edit.index] = edit.dialog;
                        updateDialogList();
                        console.log('[BUILDER MP] Remote dialog updated:', edit.dialog.name);
                    }
                    break;

                case 'deleteDialog':
                    // Another builder deleted a dialog
                    if (edit.index >= 0 && edit.index < dialogs.length) {
                        dialogs.splice(edit.index, 1);
                        // Wave 5: full cascade — placedDialogTiles, placedNpcs.dialogIndex,
                        // quest hook IDs, shops[].greetingDialogId.
                        reindexDialogReferences(edit.index);
                        updateDialogList();
                        if (typeof renderQuestList === 'function') renderQuestList();
                        if (typeof updateShopList === 'function') updateShopList();
                        renderMap();
                        console.log('[BUILDER MP] Remote dialog deleted:', edit.index);
                    }
                    break;

                case 'attachNpcDialog':
                    // Another builder attached a dialog to an NPC
                    if (edit.npcIndex >= 0 && edit.npcIndex < placedNpcs.length) {
                        placedNpcs[edit.npcIndex].dialogIndex = edit.dialogIndex;
                        if (edit.dialogTrigger) {
                            placedNpcs[edit.npcIndex].dialogTrigger = edit.dialogTrigger;
                        } else if (edit.dialogIndex < 0) {
                            delete placedNpcs[edit.npcIndex].dialogTrigger;
                        }
                        updateDialogNpcDropdown();
                        console.log('[BUILDER MP] Remote NPC dialog attached:', edit.npcIndex, '->', edit.dialogIndex);
                    }
                    break;

                case 'deleteLayer':
                    // Another builder deleted a layer
                    if (edit.mapName === currentMapName) {
                        deleteLayer(edit.index, true);
                    } else if (maps[edit.mapName]) {
                        maps[edit.mapName].layers.splice(edit.index, 1);
                        maps[edit.mapName].layerVisibility.splice(edit.index, 1);
                        maps[edit.mapName].layerNames.splice(edit.index, 1);
                    }
                    console.log('[BUILDER MP] Remote layer deleted:', edit.index);
                    break;

                case 'moveLayerUp':
                    // Another builder moved a layer up
                    if (edit.mapName === currentMapName) {
                        moveLayerUp(edit.index, true);
                    } else if (maps[edit.mapName] && edit.index > 0) {
                        const m = maps[edit.mapName];
                        [m.layers[edit.index], m.layers[edit.index-1]] = [m.layers[edit.index-1], m.layers[edit.index]];
                        [m.layerVisibility[edit.index], m.layerVisibility[edit.index-1]] = [m.layerVisibility[edit.index-1], m.layerVisibility[edit.index]];
                        [m.layerNames[edit.index], m.layerNames[edit.index-1]] = [m.layerNames[edit.index-1], m.layerNames[edit.index]];
                    }
                    break;

                case 'moveLayerDown':
                    // Another builder moved a layer down
                    if (edit.mapName === currentMapName) {
                        moveLayerDown(edit.index, true);
                    } else if (maps[edit.mapName] && edit.index < maps[edit.mapName].layers.length - 1) {
                        const m = maps[edit.mapName];
                        [m.layers[edit.index], m.layers[edit.index+1]] = [m.layers[edit.index+1], m.layers[edit.index]];
                        [m.layerVisibility[edit.index], m.layerVisibility[edit.index+1]] = [m.layerVisibility[edit.index+1], m.layerVisibility[edit.index]];
                        [m.layerNames[edit.index], m.layerNames[edit.index+1]] = [m.layerNames[edit.index+1], m.layerNames[edit.index]];
                    }
                    break;

                case 'renameLayer':
                    // Another builder renamed a layer
                    if (edit.mapName === currentMapName) {
                        renameLayer(edit.index, edit.name, true);
                    } else if (maps[edit.mapName]) {
                        maps[edit.mapName].layerNames[edit.index] = edit.name;
                    }
                    break;

                case 'renameMap':
                    // Wave 4: use shared cascade helper for complete coverage of .mapName-tagged
                    // arrays + prefix-keyed dicts (covers items, dialogTiles, animProps, staticObjects,
                    // shops, polyLights, tileSounds keys, pointLights keys).
                    if (maps[edit.oldName]) {
                        cascadeMapRename(edit.oldName, edit.newName);
                        updateMapDropdowns();
                        updateTriggerList();
                        if (typeof updatePlacedLightsList === 'function') updatePlacedLightsList();
                        if (typeof updatePolyLightsList === 'function') updatePolyLightsList();
                        if (typeof updatePlacedSoundsList === 'function') updatePlacedSoundsList();
                        renderMap();
                        console.log('[BUILDER MP] Remote map renamed:', edit.oldName, '->', edit.newName);
                    }
                    break;

                case 'cameraBounds':
                    // Another builder set/cleared camera bounds
                    if (edit.mapName === currentMapName) {
                        cameraBounds = edit.bounds;
                        updateCameraBoundsInfo();
                        renderMap();
                    } else if (maps[edit.mapName]) {
                        maps[edit.mapName].cameraBounds = edit.bounds;
                    }
                    break;

                case 'fishZones':
                    // Another builder added/cleared fish zones
                    if (edit.mapName === currentMapName) {
                        fishZones = (edit.zones || []).map(z => ({ ...z }));
                        updateFishZonesInfo();
                        renderMap();
                    } else if (maps[edit.mapName]) {
                        maps[edit.mapName].fishZones = (edit.zones || []).map(z => ({ ...z }));
                    }
                    break;

                case 'selectAllCollision':
                    // Another builder filled all collision for a tileset
                    selectAllCollision(true, edit.tilesetIndex);
                    break;

                case 'clearAllCollision':
                    // Another builder cleared all collision for a tileset
                    clearAllCollision(true, edit.tilesetIndex);
                    break;

                case 'splitLine':
                    // Another builder set a split line
                    console.log('[SYNC] Received splitLine:', edit.key, 'mask:', edit.mask);
                    if (edit.mask && Array.isArray(edit.mask)) {
                        tileSplitLines[edit.key] = edit.mask;
                    } else {
                        // Fallback: flat line at middle
                        tileSplitLines[edit.key] = new Array(16).fill(8);
                    }
                    drawCollisionTileset();
                    break;

                case 'clearSplitLine':
                    // Another builder cleared a split line
                    delete tileSplitLines[edit.key];
                    delete tileSplitLineFlipped[edit.key];
                    drawCollisionTileset();
                    break;

                case 'splitLineFlip':
                    // Another builder changed split line flip state
                    if (edit.flipped) {
                        tileSplitLineFlipped[edit.key] = true;
                    } else {
                        delete tileSplitLineFlipped[edit.key];
                    }
                    drawCollisionTileset();
                    break;

                case 'addPlayerCharacter':
                    // Another builder added a player character
                    if (edit.character) {
                        playerCharacters.push({ ...edit.character });
                        const idx = playerCharacters.length - 1;
                        if (edit.character.spriteData) {
                            const img = new Image();
                            img.onload = () => {
                                playerCharacters[idx]._spriteImg = img;
                                updatePlayerList();
                            };
                            img.src = edit.character.spriteData;
                        }
                        updatePlayerList();
                        console.log('[BUILDER MP] Remote player character added:', edit.character.name);
                    }
                    break;

                case 'updatePlayerCharacter':
                    // Another builder updated a player character
                    if (edit.index >= 0 && edit.index < playerCharacters.length && edit.character) {
                        playerCharacters[edit.index] = { ...edit.character };
                        if (edit.character.spriteData) {
                            const img = new Image();
                            img.onload = () => {
                                playerCharacters[edit.index]._spriteImg = img;
                                updatePlayerList();
                            };
                            img.src = edit.character.spriteData;
                        }
                        updatePlayerList();
                        console.log('[BUILDER MP] Remote player character updated:', edit.character.name);
                    }
                    break;

                case 'deletePlayerCharacter':
                    // Another builder deleted a player character
                    if (edit.index >= 0 && edit.index < playerCharacters.length) {
                        playerCharacters.splice(edit.index, 1);
                        if (activePlayerIndex >= playerCharacters.length) {
                            activePlayerIndex = playerCharacters.length - 1;
                        }
                        updatePlayerList();
                        console.log('[BUILDER MP] Remote player character deleted:', edit.index);
                    }
                    break;

                case 'setActivePlayer':
                    // Another builder changed active player
                    if (edit.index >= -1 && edit.index < playerCharacters.length) {
                        activePlayerIndex = edit.index;
                        updatePlayerList();
                        console.log('[BUILDER MP] Remote active player changed:', edit.index);
                    }
                    break;

                case 'addItem':
                    // Another builder added an item definition
                    if (edit.item) {
                        items.push(edit.item);
                        if (edit.item.spriteData) {
                            const img = new Image();
                            img.onload = () => {
                                itemImages[items.length - 1] = img;
                                updateItemList();
                            };
                            img.src = edit.item.spriteData;
                        }
                        updateItemList();
                        console.log('[BUILDER MP] Remote item definition added:', edit.item.name);
                    }
                    break;

                case 'updateItem':
                    // Another builder updated an item definition
                    if (edit.index >= 0 && edit.index < items.length && edit.item) {
                        items[edit.index] = edit.item;
                        if (edit.item.spriteData) {
                            const img = new Image();
                            img.onload = () => {
                                itemImages[edit.index] = img;
                                updateItemList();
                            };
                            img.src = edit.item.spriteData;
                        }
                        updateItemList();
                        console.log('[BUILDER MP] Remote item definition updated:', edit.item.name);
                    }
                    break;

                case 'deleteItem':
                    // Another builder deleted an item definition
                    if (edit.index >= 0 && edit.index < items.length) {
                        items.splice(edit.index, 1);
                        // Wave 5: fan-out reindex (placedItems, shops, animProps, NPC drops).
                        reindexItemReferences(edit.index);
                        // itemImages object-map cleanup: delete + shift higher keys.
                        delete itemImages[edit.index];
                        const keys = Object.keys(itemImages).map(k => parseInt(k, 10)).filter(Number.isFinite).sort((a,b)=>a-b);
                        for (const k of keys) {
                            if (k > edit.index) { itemImages[k - 1] = itemImages[k]; delete itemImages[k]; }
                        }
                        updateItemList();
                        if (typeof updatePlacedItemsList === 'function') updatePlacedItemsList();
                        if (typeof updateShopList === 'function') updateShopList();
                        renderMap();
                        console.log('[BUILDER MP] Remote item definition deleted:', edit.index);
                    }
                    break;

                // ===== QUEST SYNC HANDLERS =====
                case 'addQuest':
                    // Another builder added a quest. Dedup by id so catch-up replays are idempotent.
                    if (edit.quest) {
                        const existing = quests.findIndex(q => q.id === edit.quest.id);
                        if (existing >= 0) quests[existing] = edit.quest;
                        else quests.push(edit.quest);
                        renderQuestList();
                        console.log('[BUILDER MP] Remote quest added:', edit.quest.name);
                    }
                    break;

                case 'updateQuest':
                    // Another builder updated a quest field
                    if (edit.questId) {
                        const questIndex = quests.findIndex(q => q.id === edit.questId);
                        if (questIndex >= 0 && edit.quest) {
                            quests[questIndex] = edit.quest;
                            if (selectedQuestIndex === questIndex) {
                                loadQuestIntoEditor(questIndex);
                            }
                            renderQuestList();
                            console.log('[BUILDER MP] Remote quest updated:', edit.quest.name);
                        }
                    }
                    break;

                case 'deleteQuest':
                    // Another builder deleted a quest
                    if (edit.questId) {
                        const questIndex = quests.findIndex(q => q.id === edit.questId);
                        if (questIndex >= 0) {
                            quests.splice(questIndex, 1);
                            if (selectedQuestIndex === questIndex) {
                                selectedQuestIndex = -1;
                                document.getElementById('questEditorPanel').style.display = 'none';
                            } else if (selectedQuestIndex > questIndex) {
                                selectedQuestIndex--;
                            }
                            renderQuestList();
                            console.log('[BUILDER MP] Remote quest deleted:', edit.questId);
                        }
                    }
                    break;

                case 'addQuestSound':
                    // Another builder added a quest sound to library
                    if (edit.sound) {
                        questSounds.push({ name: edit.sound.name, data: edit.sound.data });
                        updateQuestSoundDropdown();
                        console.log('[BUILDER MP] Quest sound added:', edit.sound.name);
                    }
                    break;

                case 'deleteQuestSound':
                    // Another builder deleted a quest sound
                    if (edit.index >= 0 && edit.index < questSounds.length) {
                        questSounds.splice(edit.index, 1);
                        // Update quests that used this sound
                        quests.forEach(quest => {
                            if (quest.startSoundIndex === edit.index) {
                                quest.startSoundIndex = -1;
                            } else if (quest.startSoundIndex > edit.index) {
                                quest.startSoundIndex--;
                            }
                        });
                        updateQuestSoundDropdown();
                        console.log('[BUILDER MP] Quest sound deleted at index:', edit.index);
                    }
                    break;

                case 'reorderQuests':
                    // Another builder reordered quests
                    if (edit.quests && Array.isArray(edit.quests)) {
                        const newOrder = [];
                        edit.quests.forEach(questId => {
                            const quest = quests.find(q => q.id === questId);
                            if (quest) newOrder.push(quest);
                        });
                        // Add any quests that weren't in the reorder list (shouldn't happen but safety)
                        quests.forEach(q => {
                            if (!newOrder.find(nq => nq.id === q.id)) {
                                newOrder.push(q);
                            }
                        });
                        quests.length = 0;
                        quests.push(...newOrder);
                        renderQuestList();
                        console.log('[BUILDER MP] Quests reordered');
                    }
                    break;

                case 'expandMap':
                    // Another builder expanded a map
                    if (edit.direction && edit.mapName) {
                        if (edit.mapName === currentMapName) {
                            expandMap(edit.direction, true); // true = fromNetwork
                        } else if (maps[edit.mapName]) {
                            // Expand another map's data
                            const targetMap = maps[edit.mapName];
                            const dir = edit.direction;
                            const mapWidth = targetMap.layers[0][0].length;
                            const mapHeight = targetMap.layers[0].length;

                            targetMap.layers.forEach(layer => {
                                if (dir === 'right' || dir === 'left') {
                                    layer.forEach(row => {
                                        if (dir === 'right') row.push(null);
                                        else row.unshift(null);
                                    });
                                } else {
                                    const newRow = new Array(mapWidth + (dir === 'left' || dir === 'right' ? 1 : 0)).fill(null);
                                    if (dir === 'down') layer.push([...newRow]);
                                    else layer.unshift([...newRow]);
                                }
                            });
                        }
                        console.log('[BUILDER MP] Remote map expanded:', edit.mapName, edit.direction);
                    }
                    break;

                case 'deleteTileset':
                    // Another builder deleted a tileset
                    if (edit.index >= 0 && edit.index < tilesets.length) {
                        deleteTileset(true, edit.index); // true = fromNetwork
                        console.log('[BUILDER MP] Remote tileset deleted:', edit.index);
                    }
                    break;

                case 'startEditing':
                    // Another builder started editing something
                    if (edit.editorType && edit.editorIndex !== undefined && edit.username) {
                        const key = edit.editorType + ':' + edit.editorIndex;
                        currentlyEditing[key] = { username: edit.username };
                        console.log('[BUILDER MP] Remote user started editing:', key, 'by', edit.username);
                    }
                    break;

                case 'stopEditing':
                    // Another builder stopped editing something
                    if (edit.editorType && edit.editorIndex !== undefined) {
                        const key = edit.editorType + ':' + edit.editorIndex;
                        delete currentlyEditing[key];
                        console.log('[BUILDER MP] Remote user stopped editing:', key);
                    }
                    break;

                // Shop system
                case 'addShop':
                    if (edit.shop) {
                        shops.push(edit.shop);
                        if (mode === 'shop') {
                            updateShopList();
                            updateNpcShopList();
                        }
                        console.log('[BUILDER MP] Remote shop added:', edit.shop.name);
                    }
                    break;

                case 'updateShop':
                    if (edit.index >= 0 && edit.index < shops.length && edit.shop) {
                        shops[edit.index] = edit.shop;
                        if (mode === 'shop') {
                            updateShopList();
                            updateSelectedShopInfo();
                        }
                        console.log('[BUILDER MP] Remote shop updated:', edit.shop.name);
                    }
                    break;

                case 'deleteShop':
                    if (edit.index >= 0 && edit.index < shops.length) {
                        // Update NPC references
                        placedNpcs.forEach(p => {
                            if (p.shopIndex === edit.index) {
                                p.shopIndex = -1;
                            } else if (p.shopIndex > edit.index) {
                                p.shopIndex--;
                            }
                        });
                        // Update placed shops
                        placedShops = placedShops.filter(ps => ps.shopIndex !== edit.index);
                        placedShops.forEach(ps => { if (ps.shopIndex > edit.index) ps.shopIndex--; });

                        shops.splice(edit.index, 1);
                        if (selectedShopIndex === edit.index) selectedShopIndex = -1;
                        else if (selectedShopIndex > edit.index) selectedShopIndex--;

                        if (mode === 'shop') {
                            updateShopList();
                            updateSelectedShopInfo();
                            updateNpcShopList();
                        }
                        console.log('[BUILDER MP] Remote shop deleted');
                    }
                    break;

                case 'updateStartingGold':
                    if (edit.value !== undefined) {
                        startingGold = edit.value;
                        const goldInput = document.getElementById('startingGoldInput');
                        if (goldInput) goldInput.value = startingGold;
                        console.log('[BUILDER MP] Starting gold updated:', startingGold);
                    }
                    break;

                // ===== Wave 3 additions =====
                case 'setPlayerSpawn':
                    if (typeof edit.x === 'number' && typeof edit.y === 'number') {
                        playerPreviewPos = { x: edit.x, y: edit.y };
                        if (edit.mapName) spawnMapName = edit.mapName;
                        playerPreviewVisible = true;
                        renderMap();
                        console.log('[BUILDER MP] Spawn updated:', spawnMapName, edit.x, edit.y);
                    }
                    break;

                case 'lightingSettings':
                    if (edit.settings && typeof edit.settings === 'object') {
                        Object.assign(lightingSettings, edit.settings);
                        const playerLightEl = document.getElementById('playerLight');
                        const radiusEl = document.getElementById('playerLightRadius');
                        const radiusVal = document.getElementById('playerLightRadiusVal');
                        if (playerLightEl) playerLightEl.checked = !!lightingSettings.playerLight;
                        if (radiusEl) radiusEl.value = lightingSettings.playerLightRadius;
                        if (radiusVal) radiusVal.textContent = lightingSettings.playerLightRadius;
                        renderMap();
                    }
                    break;

                case 'placeDialogTile':
                    if (edit.tile) {
                        placedDialogTiles.push(edit.tile);
                        renderMap();
                    }
                    break;
                case 'updateDialogTile':
                    if (typeof edit.index === 'number' && edit.index >= 0 && edit.index < placedDialogTiles.length && edit.tile) {
                        placedDialogTiles[edit.index] = edit.tile;
                        renderMap();
                    }
                    break;
                case 'removeDialogTile':
                    if (typeof edit.index === 'number' && edit.index >= 0 && edit.index < placedDialogTiles.length) {
                        placedDialogTiles.splice(edit.index, 1);
                        renderMap();
                    }
                    break;

                case 'addSound':
                    if (edit.sound && edit.sound.name) {
                        const insertIdx = (typeof edit.index === 'number') ? edit.index : sounds.length;
                        sounds[insertIdx] = {
                            name: edit.sound.name,
                            data: edit.sound.data,
                            duration: edit.sound.duration || 0,
                            type: edit.sound.type || 'ambient'
                        };
                        if (typeof updateSoundDropdown === 'function') updateSoundDropdown();
                        if (typeof updatePlayerSoundAssignments === 'function') updatePlayerSoundAssignments();
                    }
                    break;
                case 'removeSound':
                    if (typeof edit.index === 'number' && edit.index >= 0 && edit.index < sounds.length) {
                        sounds.splice(edit.index, 1);
                        reindexSoundReferences(edit.index);
                        if (typeof updateSoundDropdown === 'function') updateSoundDropdown();
                        if (typeof updatePlayerSoundAssignments === 'function') updatePlayerSoundAssignments();
                        if (typeof updatePlacedSoundsList === 'function') updatePlacedSoundsList();
                        renderMap();
                    }
                    break;
                case 'setPlayerSound':
                    if (edit.action && edit.config) {
                        if (!playerSounds) playerSounds = {};
                        playerSounds[edit.action] = { ...(playerSounds[edit.action] || {}), ...edit.config };
                        if (typeof updatePlayerSoundAssignments === 'function') updatePlayerSoundAssignments();
                    }
                    break;

                case 'deleteNpc':
                    if (typeof edit.index === 'number' && edit.index >= 0 && edit.index < npcs.length) {
                        npcs.splice(edit.index, 1);
                        reindexNpcReferences(edit.index);
                        if (typeof updateNpcList === 'function') updateNpcList();
                        if (typeof updatePlacedNpcList === 'function') updatePlacedNpcList();
                        renderMap();
                        console.log('[BUILDER MP] NPC definition deleted:', edit.index);
                    }
                    break;
                // ===== end Wave 3 additions =====
            }
        }

        // Version without renderMap calls (for batching)
        function applyRemoteEditNoRender(edit) {
            let targetLayers = (edit.mapName && edit.mapName !== currentMapName && maps[edit.mapName])
                ? maps[edit.mapName].layers : layers;

            switch (edit.editType) {
                case 'tile':
                    if (!targetLayers[edit.layer]) targetLayers[edit.layer] = [];
                    if (!targetLayers[edit.layer][edit.y]) targetLayers[edit.layer][edit.y] = [];
                    targetLayers[edit.layer][edit.y][edit.x] = edit.cell;
                    break;
                case 'eraseTile':
                    if (targetLayers[edit.layer] && targetLayers[edit.layer][edit.y]) {
                        targetLayers[edit.layer][edit.y][edit.x] = null;
                    }
                    break;
                case 'tileSound':
                    tileSounds[edit.key] = edit.sound;
                    break;
                case 'removeTileSound':
                    delete tileSounds[edit.key];
                    break;
                case 'light':
                    pointLights[edit.key] = edit.light;
                    break;
                case 'removeLight':
                    delete pointLights[edit.key];
                    break;
                case 'placeNpc':
                    if (!_placedNpcExists(edit.npc)) placedNpcs.push(edit.npc);
                    break;
                case 'removeNpc':
                    if (edit.index >= 0 && edit.index < placedNpcs.length) {
                        placedNpcs.splice(edit.index, 1);
                    }
                    break;
                case 'placeTrigger':
                    if (!_placedTriggerExists(edit.trigger)) placedTriggers.push(edit.trigger);
                    break;
                case 'removeTrigger':
                    if (edit.index >= 0 && edit.index < placedTriggers.length) {
                        placedTriggers.splice(edit.index, 1);
                    }
                    break;
                case 'collision':
                    if (edit.value) tileCollisions[edit.key] = true;
                    else delete tileCollisions[edit.key];
                    break;
                case 'collisionMask':
                    collisionMasks[edit.key] = edit.mask;
                    break;
                default:
                    // Wave 2 (R1): unknown editTypes in a batch fall through to the full dispatcher.
                    // Previously these were silently dropped. Now they're applied correctly;
                    // the per-edit renderMap calls are minor perf cost in a 250ms batch window.
                    console.warn('[MP] batch delegating to full dispatcher:', edit.editType);
                    try { applyRemoteEdit(edit); } catch (e) { console.error('[MP] delegate failed:', e, edit); }
                    break;
            }
        }

        // Batching system for builder edits
        let editBatch = [];
        let batchTimeout = null;
        const BATCH_DELAY = 250; // ms to wait before sending batch (higher = less network traffic)

        // Session edit log — every broadcast we make locally. When a late joiner arrives,
        // the host replays this log so the joiner catches up. Users share BASE saves
        // out-of-band (download/upload). We only sync in-session deltas.
        let sessionEditLog = [];
        const SESSION_LOG_MAX = 5000; // safety cap

        function broadcastEdit(editData) {
            // Track this edit in the session log for late-joiner replay.
            if (sessionEditLog.length < SESSION_LOG_MAX) sessionEditLog.push(editData);

            // Send to test game window directly (works in solo mode)
            if (testGameWindow && !testGameWindow.closed) {
                try {
                    testGameWindow.postMessage({ type: 'builderEdit', edit: editData }, '*');
                } catch (e) {
                    // Window might be closed or cross-origin
                }
            }

            // Also broadcast via WebSocket if in CO-OP mode
            if (!builderConnected || !builderSocket) return;

            // Add to batch
            editBatch.push(editData);

            // If no pending send, schedule one
            if (!batchTimeout) {
                batchTimeout = setTimeout(flushEditBatch, BATCH_DELAY);
            }
        }

        function flushEditBatch() {
            batchTimeout = null;
            if (editBatch.length === 0 || !builderConnected || !builderSocket) return;

            if (editBatch.length === 1) {
                // Single edit - send normally
                builderSocket.send(JSON.stringify({
                    type: 'update',
                    ...editBatch[0],
                    gameType: 'builder'
                }));
            } else {
                // Multiple edits - send as batch
                builderSocket.send(JSON.stringify({
                    type: 'update',
                    editType: 'batch',
                    edits: editBatch,
                    gameType: 'builder'
                }));
            }
            editBatch = [];
        }

        // Warn before closing tab if in co-op mode
        window.addEventListener('beforeunload', (e) => {
            if (builderConnected) {
                e.preventDefault();
                e.returnValue = 'You are in a co-op session. Make sure to save your work!';
                return e.returnValue;
            }
        });

        function showBuilderStatus(msg) {
            // Show connection status in Tools dropdown menu
            const statusEl = document.getElementById('coopStatusInMenu');
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.textContent = 'CO-OP: ' + msg;
                if (msg.includes('Disconnected')) {
                    statusEl.className = 'coop-status-menu disconnected';
                } else {
                    statusEl.className = 'coop-status-menu connected';
                }
            }
            // Also update tools button to show connection indicator
            const toolsBtn = document.querySelector('.tools-toggle');
            if (toolsBtn) {
                if (msg.includes('Disconnected')) {
                    toolsBtn.innerHTML = '⚙ Tools ▼';
                } else {
                    toolsBtn.innerHTML = '⚙ Tools <span style="color:#0f0;">●</span> ▼';
                }
            }
        }

        function showRoomInfo() {
            // Create or update room info modal
            let modal = document.getElementById('roomInfoModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'roomInfoModal';
                modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:10000;';
                modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
                document.body.appendChild(modal);
            }

            // Build content - retro styled
            let html = '<div style="background:#1a1a1a;border:3px solid #fff;padding:25px;min-width:320px;max-width:500px;font-family:\'Press Start 2P\',monospace;">';
            html += '<h2 style="color:#fff;margin:0 0 20px 0;text-align:center;font-size:14px;letter-spacing:2px;">ROOM INFO</h2>';

            // Connection status
            if (builderConnected && builderRoomCode) {
                html += '<div style="background:#0a1a0a;color:#0f0;padding:10px;margin-bottom:15px;border:2px solid #0f0;text-align:center;font-size:8px;">';
                html += '> CONNECTED: <strong>' + builderRoomCode + '</strong></div>';
            } else {
                html += '<div style="background:#1a0a0a;color:#f00;padding:10px;margin-bottom:15px;border:2px solid #f00;text-align:center;font-size:8px;">';
                html += '> NOT CONNECTED</div>';
            }

            // Your name
            html += '<div style="color:#888;margin-bottom:12px;font-size:8px;"><span style="color:#f90;">PLAYER:</span> ' + builderPlayerName + '</div>';

            // Builder players in room
            html += '<div style="color:#4af;margin-bottom:8px;font-size:8px;">BUILDERS (' + builderPlayersInRoom.size + ')</div>';
            if (builderPlayersInRoom.size > 0) {
                html += '<div style="color:#666;margin:0 0 15px 10px;font-size:7px;">';
                builderPlayersInRoom.forEach((p, id) => {
                    html += '> ' + p.name + '<br>';
                });
                html += '</div>';
            } else {
                html += '<div style="color:#444;margin-bottom:15px;padding-left:10px;font-size:7px;">No other builders</div>';
            }

            // Game testers in room
            html += '<div style="color:#0ff;margin-bottom:8px;font-size:8px;">TESTERS (' + gamePlayersInBuilder.size + ')</div>';
            if (gamePlayersInBuilder.size > 0) {
                html += '<div style="color:#666;margin:0 0 15px 10px;font-size:7px;">';
                gamePlayersInBuilder.forEach((p, id) => {
                    html += '> ' + p.name + ' <span style="color:#444;">[' + (p.currentMap || '?') + ']</span><br>';
                });
                html += '</div>';
            } else {
                html += '<div style="color:#444;margin-bottom:15px;padding-left:10px;font-size:7px;">No game testers</div>';
            }

            // Project info
            html += '<div style="border-top:1px solid #333;padding-top:15px;margin-top:10px;">';
            html += '<div style="color:#a6f;margin-bottom:10px;font-size:8px;">PROJECT STATS</div>';
            html += '<div style="color:#666;margin-left:10px;font-size:7px;">';
            html += '<div style="margin:4px 0;">Maps........ ' + Object.keys(maps).length + '</div>';
            html += '<div style="margin:4px 0;">Tilesets.... ' + tilesets.length + '</div>';
            html += '<div style="margin:4px 0;">NPCs........ ' + npcs.length + '</div>';
            html += '<div style="margin:4px 0;">Triggers.... ' + placedTriggers.length + '</div>';
            html += '</div></div>';

            // Share save button (for host to share with late joiners)
            html += '<div style="border-top:1px solid #333;padding-top:15px;margin-top:15px;">';
            html += '<div style="color:#fd0;margin-bottom:8px;font-size:8px;">LATE JOINERS</div>';
            html += '<p style="color:#444;font-size:6px;margin:0 0 10px 0;">Download save to share with friends</p>';
            html += '<button onclick="downloadProject(); document.getElementById(\'roomInfoModal\').style.display=\'none\'" ';
            html += 'style="width:100%;padding:12px;background:#1a1a1a;color:#0f0;border:2px solid #0f0;cursor:pointer;font-family:\'Press Start 2P\',monospace;font-size:8px;">DOWNLOAD SAVE</button>';
            html += '</div>';

            // Close button
            html += '<button onclick="document.getElementById(\'roomInfoModal\').style.display=\'none\'" ';
            html += 'style="width:100%;margin-top:12px;padding:12px;background:#1a1a1a;color:#f55;border:2px solid #f55;cursor:pointer;font-family:\'Press Start 2P\',monospace;font-size:8px;">CLOSE</button>';

            html += '</div>';
            modal.innerHTML = html;
            modal.style.display = 'flex';
        }

        // Adventure mode - load project, open test, hide UI
        let launchAsAdventure = false;
        let multiplayerSettings = null; // Will be set from prompt

        async function startAdventure() {
            if (!pendingSaveData) return;

            // Get multiplayer settings from prompt
            const playerName = document.getElementById('mpPlayerName').value.trim() || 'Player';
            const roomCode = document.getElementById('mpRoomCode').value.trim();

            if (roomCode) {
                multiplayerSettings = { playerName, roomCode };
            } else {
                multiplayerSettings = null; // Solo mode
            }

            document.getElementById('multiplayerPrompt').style.display = 'none';
            document.getElementById('modeSelect').style.display = 'block';
            document.getElementById('modeSelect').innerHTML = '<h1>LOADING...</h1>';
            // Keep loadPhase visible during entire loading process
            keepLoadPhaseVisible = true;
            document.getElementById('loadPhase').style.zIndex = '9999';

            await loadProject(pendingSaveData);
            pendingSaveData = null;

            // Wait for tilesets to load
            setTimeout(() => {
                launchAsAdventure = true;
                testMap();
                launchAsAdventure = false;
                // Return to start menu after game opens
                setTimeout(() => {
                    keepLoadPhaseVisible = false;
                    document.getElementById('loadPhase').style.zIndex = '';
                    // Reset to start screen (not builder)
                    document.getElementById('modeSelect').style.display = 'none';
                    document.getElementById('mainMenu').style.display = 'block';
                    document.getElementById('loadPhase').classList.add('active');
                    setPhase('load');
                }, 2000);
            }, 1000);
        }

        // Show/hide prompt functions
        function showDirectJoinPrompt() {
            // Show join prompt directly from main menu (no save file needed)
            document.getElementById('mainMenu').style.display = 'none';
            document.getElementById('joinRoomPrompt').style.display = 'block';
        }

        function showHostPrompt() {
            document.getElementById('craftMultiplayerPrompt').style.display = 'none';
            document.getElementById('hostRoomPrompt').style.display = 'block';
            setTimeout(() => document.getElementById('hostPlayerName').focus(), 50);
        }

        function hideHostPrompt() {
            document.getElementById('hostRoomPrompt').style.display = 'none';
            document.getElementById('craftMultiplayerPrompt').style.display = 'block';
        }

        function showJoinPrompt() {
            document.getElementById('craftMultiplayerPrompt').style.display = 'none';
            document.getElementById('joinRoomPrompt').style.display = 'block';
            setTimeout(() => document.getElementById('joinPlayerName').focus(), 50);
        }

        function hideJoinPrompt() {
            document.getElementById('joinRoomPrompt').style.display = 'none';
            document.getElementById('mainMenu').style.display = 'block';
            joinSaveData = null;
            document.getElementById('joinSaveStatus').textContent = 'No file loaded';
        }

        // Handle save file loaded in Join Room prompt
        let joinSaveData = null;
        function handleJoinSaveFile(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    joinSaveData = JSON.parse(e.target.result);
                    document.getElementById('joinSaveStatus').textContent = 'Loaded: ' + file.name;
                    document.getElementById('joinSaveStatus').style.color = '#0f0';
                    console.log('[JOIN] Save file loaded:', file.name);
                } catch (err) {
                    alert('Invalid save file!');
                    joinSaveData = null;
                    document.getElementById('joinSaveStatus').textContent = 'Error loading file';
                    document.getElementById('joinSaveStatus').style.color = '#f00';
                }
            };
            reader.readAsText(file);
        }

        // SOLO MODE - Load local save, no multiplayer
        async function startCraftSolo() {
            console.log('[CRAFT] Starting SOLO mode');
            if (!pendingSaveData) {
                console.log('[CRAFT] No pendingSaveData, returning');
                return;
            }

            document.getElementById('craftMultiplayerPrompt').style.display = 'none';

            await loadProject(pendingSaveData);
            pendingSaveData = null;
            document.getElementById('modeSelect').style.display = 'none';
            document.getElementById('mainMenu').style.display = 'block';

            console.log('[CRAFT] Solo mode ready');
        }

        // HOST MODE - Load local save, then connect to room (others get your project)
        async function startCraftHost() {
            console.log('[CRAFT] Starting HOST mode');
            if (!pendingSaveData) {
                console.log('[CRAFT] No pendingSaveData, returning');
                return;
            }

            const playerName = document.getElementById('hostPlayerName').value.trim() || 'Host';
            const roomCode = document.getElementById('hostRoomCode').value.trim();

            if (!roomCode) {
                alert('Please enter a room code for others to join');
                return;
            }

            document.getElementById('hostRoomPrompt').style.display = 'none';

            // Load YOUR local project first (you're the host, your project is the map)
            await loadProject(pendingSaveData);
            pendingSaveData = null;
            document.getElementById('modeSelect').style.display = 'none';
            document.getElementById('mainMenu').style.display = 'block';

            // Connect to multiplayer - you're the host
            console.log('[CRAFT] Host connecting to room:', roomCode);
            connectBuilderMultiplayer(playerName, roomCode);

            console.log('[CRAFT] Host mode ready - share room code:', roomCode);
        }

        // JOIN MODE - Load same save as host, then connect for real-time sync
        async function startCraftJoin() {
            console.log('[CRAFT] Starting JOIN mode');

            const playerName = document.getElementById('joinPlayerName').value.trim() || 'Builder';
            const roomCode = document.getElementById('joinRoomCode').value.trim();

            if (!roomCode) {
                alert('Please enter a room code to join');
                return;
            }

            if (!joinSaveData) {
                alert('Please load the save file first!');
                return;
            }

            document.getElementById('joinRoomPrompt').style.display = 'none';

            // Load the save file
            console.log('[CRAFT] Loading save for co-op join');
            await loadProject(joinSaveData);
            joinSaveData = null;

            // Show the builder interface
            document.getElementById('loadPhase').classList.remove('active');
            document.getElementById('buildPhase').classList.add('active');
            setPhase('build');

            // Connect to multiplayer for real-time sync
            console.log('[CRAFT] Joining room:', roomCode);
            connectBuilderMultiplayer(playerName, roomCode);

            console.log('[CRAFT] Join mode ready - edits will sync with room');
        }

        // Initialize an empty project for joiners
        function initEmptyProject() {
            gridSize = 16;
            mapCols = 40;
            mapRows = 30;
            layers = [[]];
            layerVisibility = [true];
            layerNames = ['Layer 1'];
            currentLayer = 0;
            tileCollisions = {};
            collisionMasks = {};
            tileSplitLines = {};
            maps = { 'main': { layers: [[]], layerVisibility: [true], layerNames: ['Layer 1'], currentLayer: 0 }};
            currentMapName = 'main';
            placedTriggers = [];
            placedNpcs = [];
            npcs = [];
            tilesets = [];
            animatedProps = [];
            placedAnimProps = [];
            sounds = [];
            tileSounds = {};
            pointLights = {};
            polyLights = [];
            dialogs = [];
            placedDialogTiles = [];
            items = [];
            placedItems = [];
            staticObjects = [];
            placedStaticObjects = [];
            quests = [];
            questSounds = [];
            shops = [];
            placedShops = [];
            startingGold = 100;
            tileSplitLineFlipped = {};

            // Initialize empty layer grid
            for (let y = 0; y < mapRows; y++) {
                layers[0][y] = [];
                for (let x = 0; x < mapCols; x++) {
                    layers[0][y][x] = null;
                }
            }

            console.log('[CRAFT] Empty project initialized');
        }

        // Legacy function for backwards compatibility
        async function startCraft() {
            startCraftSolo();
        }

        async function loadProject(projectData) {
            // If no data passed, load from IndexedDB (or migrate from localStorage)
            let p;
            if (projectData) {
                p = migrateProjectData(projectData);
            } else {
                // Try IndexedDB first
                try {
                    const dbData = await loadProjectFromDB();
                    if (dbData) {
                        p = dbData;
                        console.log('Loaded project from IndexedDB');
                    }
                } catch (err) {
                    console.warn('IndexedDB load failed:', err);
                }

                // If no IndexedDB data, check localStorage for migration
                if (!p) {
                    const legacyData = localStorage.getItem('worldBuilderProject');
                    if (legacyData) {
                        try {
                            p = JSON.parse(legacyData);
                            console.log('Loaded project from localStorage, migrating to IndexedDB...');
                            // Migrate to IndexedDB
                            try {
                                await saveProjectToDB(p);
                                localStorage.removeItem('worldBuilderProject');
                                console.log('Migration complete, localStorage cleared');
                            } catch (migErr) {
                                console.warn('Migration to IndexedDB failed:', migErr);
                            }
                        } catch (parseErr) {
                            alert('Error parsing saved data: ' + parseErr.message);
                            return;
                        }
                    }
                }

                if (!p) {
                    alert('No saved project found in browser storage. Use "Load File" to load from a downloaded file.');
                    return;
                }
            }

            console.log('Loading project:', p);
            gridSize = p.gridSize || 16;
            mapCols = p.mapCols || 40;
            mapRows = p.mapRows || 30;
            tileCollisions = p.tileCollisions || {};
            collisionMasks = p.collisionMasks || {};
            tileSplitLines = p.tileSplitLines || {}; // Depth split lines for Y-sorting
            tileSplitLineFlipped = p.tileSplitLineFlipped || {}; // Flipped split lines

            // Load multiple props (new format)
            props = [];
            propImage = null;
            propImageData = null;
            propCollisionMasks = {};
            currentPropIndex = -1;

            if (p.props && p.props.length > 0) {
                console.log('Loading', p.props.length, 'props');
                let propsLoaded = 0;
                p.props.forEach((propData, i) => {
                    const img = new Image();
                    img.onload = () => {
                        props[i] = {
                            ...propData, // preserve all saved fields — don't whitelist
                            name: propData.name,
                            img: img,
                            data: propData.data,
                            collisionMasks: propData.collisionMasks || {}
                        };
                        propsLoaded++;
                        if (propsLoaded === p.props.length) {
                            // All props loaded
                            currentPropIndex = p.currentPropIndex >= 0 ? p.currentPropIndex : 0;
                            if (props[currentPropIndex]) {
                                propImage = props[currentPropIndex].img;
                                propImageData = props[currentPropIndex].data;
                                propCollisionMasks = props[currentPropIndex].collisionMasks;
                            }
                            updatePropDropdown();
                            updatePropUI();
                            drawPropTileset();
                            renderMap();
                        }
                    };
                    img.onerror = () => {
                        console.error('Failed to load prop', i);
                        propsLoaded++;
                    };
                    img.src = propData.data;
                });
            } else if (p.propImageData) {
                // Old format - single prop image (backwards compatibility)
                console.log('Loading single prop (old format)');
                const img = new Image();
                img.onload = () => {
                    props = [{
                        name: 'prop',
                        img: img,
                        data: p.propImageData,
                        collisionMasks: p.propCollisionMasks || {}
                    }];
                    currentPropIndex = 0;
                    propImage = img;
                    propImageData = p.propImageData;
                    propCollisionMasks = p.propCollisionMasks || {};
                    updatePropDropdown();
                    updatePropUI();
                    drawPropTileset();
                    renderMap();
                };
                img.onerror = () => console.error('Failed to load prop image');
                img.src = p.propImageData;
            } else {
                console.log('No props in saved project');
                updatePropDropdown();
                updatePropUI();
            }

            // Load animated props
            animatedProps = [];
            animPropSpriteSheet = null;
            animPropSpriteData = null;
            currentAnimPropIndex = -1;
            placedAnimProps = p.placedAnimProps || [];

            if (p.animatedProps && p.animatedProps.length > 0) {
                console.log('Loading', p.animatedProps.length, 'animated props');
                let propsLoaded = 0;
                p.animatedProps.forEach((propData, i) => {
                    // Spread-with-strip + legacy-compat migration for singular collisionMask
                    const legacyMask = (!propData.collisionMasks && propData.collisionMask)
                        ? { 0: propData.collisionMask } : null;
                    animatedProps[i] = {
                        ...propData,
                        frameWidth: propData.frameWidth || 16,
                        frameHeight: propData.frameHeight || 16,
                        frames: propData.frames || [],
                        type: propData.type || 'loop',
                        fps: propData.fps || 8,
                        collisionMasks: propData.collisionMasks || legacyMask,
                        splitLine: propData.splitLine || null,
                        giveItem: propData.giveItem || false,
                        giveItemIndex: propData.giveItemIndex ?? -1,
                        lockItemIndex: propData.lockItemIndex ?? -1,
                        lockConsume: propData.lockConsume !== false
                    };

                    // Load sprite sheet image if present
                    if (propData.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            animatedProps[i]._spriteImg = img;
                            propsLoaded++;
                            if (propsLoaded === p.animatedProps.length) {
                                currentAnimPropIndex = p.currentAnimPropIndex >= 0 ? p.currentAnimPropIndex : 0;
                                if (animatedProps[currentAnimPropIndex] && animatedProps[currentAnimPropIndex]._spriteImg) {
                                    animPropSpriteSheet = animatedProps[currentAnimPropIndex]._spriteImg;
                                    animPropSpriteData = animatedProps[currentAnimPropIndex].spriteData;
                                }
                                updateAnimPropListDisplay();
                                renderMap();
                            }
                        };
                        img.onerror = () => {
                            console.error('Failed to load animated prop sprite', i);
                            propsLoaded++;
                        };
                        img.src = propData.spriteData;
                    } else {
                        propsLoaded++;
                        if (propsLoaded === p.animatedProps.length) {
                            currentAnimPropIndex = p.currentAnimPropIndex >= 0 ? p.currentAnimPropIndex : 0;
                            updateAnimPropListDisplay();
                            renderMap();
                        }
                    }
                });
            } else {
                console.log('No animated props in saved project');
                updateAnimPropListDisplay();
            }

            // Load NPCs
            npcs = [];
            currentNpcIndex = -1;
            placedNpcs = p.placedNpcs || [];
            selectedPlacedNpcIndex = -1;
            npcPathDrawing = false;

            if (p.npcs && p.npcs.length > 0) {
                console.log('Loading', p.npcs.length, 'NPCs');
                p.npcs.forEach((npcData, i) => {
                    // Spread all saved fields to preserve collisionInsets, shadow settings, etc.
                    npcs[i] = {
                        ...npcData,
                        // Ensure required fields have defaults
                        frameWidth: npcData.frameWidth || 32,
                        frameHeight: npcData.frameHeight || 32,
                        animations: npcData.animations || { walkDown: [], walkUp: [], walkLeft: [], walkRight: [], idle: [], attackDown: [], attackUp: [], attackLeft: [], attackRight: [] },
                        animMirrors: npcData.animMirrors || {},
                        fps: npcData.fps || 8
                    };
                    // Preload sprite image
                    if (npcData.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            npcs[i]._editorImg = img;
                            renderMap();
                        };
                        img.src = npcData.spriteData;
                    }
                });
                currentNpcIndex = p.currentNpcIndex >= 0 ? p.currentNpcIndex : 0;
                updateNpcList();
                updatePlacedNpcList();
            } else {
                console.log('No NPCs in saved project');
                updateNpcList();
                updatePlacedNpcList();
            }

            // Load static objects
            staticObjects = [];
            currentStaticObjIndex = -1;
            placedStaticObjects = p.placedStaticObjects || [];

            if (p.staticObjects && p.staticObjects.length > 0) {
                console.log('Loading', p.staticObjects.length, 'static objects');
                p.staticObjects.forEach((objData, i) => {
                    staticObjects[i] = {
                        ...objData, // preserve all saved fields — don't whitelist
                        name: objData.name,
                        spriteData: objData.spriteData,
                        width: objData.width,
                        height: objData.height,
                        tilesetIndex: objData.tilesetIndex,
                        sourceTiles: objData.sourceTiles,
                        sourceOrigin: objData.sourceOrigin,
                        _spriteImg: new Image()
                    };
                    staticObjects[i]._spriteImg.src = objData.spriteData;
                });
            }
            updateStaticObjectsList();

            // Load layers (backwards compatible with old saves)
            if (p.layers) {
                layers = p.layers;
                layerVisibility = p.layerVisibility || layers.map(() => true);
                layerNames = p.layerNames || layers.map(() => '');
                currentLayer = p.currentLayer || 0;
            } else if (p.map) {
                // Old format - single map
                layers = [p.map];
                layerVisibility = [true];
                layerNames = [''];
                currentLayer = 0;
            } else {
                layers = [createEmptyLayer()];
                layerVisibility = [true];
                layerNames = [''];
                currentLayer = 0;
            }
            map = layers[currentLayer];

            // Load player layer settings
            playerLayerIndex = p.playerLayerIndex !== undefined ? p.playerLayerIndex : 1;
            playerPreviewPos = p.playerPreviewPos || { x: 5, y: 5 };
            spawnMapName = p.spawnMapName || 'main';
            playerPreviewVisible = p.playerPreviewVisible !== undefined ? p.playerPreviewVisible : true;

            // Load sounds
            sounds = [];
            tileSounds = p.tileSounds || {};
            normalizeTileSoundKeys(); // migrate legacy "x,y" keys -> "main:x,y" so the builder sees them
            playerSounds = p.playerSounds || {
                walk: { soundIndex: -1, interval: 200, volume: 0.5, pitchVariation: 0.1 },
                attack: { soundIndex: -1, volume: 0.7, pitchVariation: 0.15, lengthVariation: 0 },
                inventoryOpen: { soundIndex: -1, volume: 0.5 },
                inventoryClose: { soundIndex: -1, volume: 0.5 }
            };
            // Ensure inventory fields exist for older saves
            if (!playerSounds.inventoryOpen) playerSounds.inventoryOpen = { soundIndex: -1, volume: 0.5 };
            if (!playerSounds.inventoryClose) playerSounds.inventoryClose = { soundIndex: -1, volume: 0.5 };

            if (p.sounds && p.sounds.length > 0) {
                console.log('Loading', p.sounds.length, 'sounds');
                p.sounds.forEach((soundData, i) => {
                    sounds[i] = {
                        ...soundData, // preserve all saved fields — don't whitelist
                        name: soundData.name,
                        data: soundData.data,
                        duration: soundData.duration || 0,
                        type: soundData.type || 'ambient'
                    };
                });
                updateSoundDropdown();
                updatePlacedSoundsList();
                updatePlayerSoundAssignments();
            } else {
                console.log('No sounds in saved project');
                updateSoundDropdown();
                updatePlacedSoundsList();
                updatePlayerSoundAssignments();
            }

            // Load quest sounds library
            if (p.questSounds && p.questSounds.length > 0) {
                console.log('Loading', p.questSounds.length, 'quest sounds');
                questSounds = p.questSounds.map(s => ({ name: s.name, data: s.data }));
            } else {
                questSounds = [];
            }

            // Load lighting settings — spread with defaults so unknown keys round-trip.
            if (p.lightingSettings) {
                lightingSettings = {
                    playerLight: false,
                    playerLightRadius: 4,
                    ...p.lightingSettings
                };
                // Update UI to match loaded settings
                const playerLightEl = document.getElementById('playerLight');
                const radiusEl = document.getElementById('playerLightRadius');
                if (playerLightEl) playerLightEl.checked = lightingSettings.playerLight;
                if (radiusEl) {
                    radiusEl.value = lightingSettings.playerLightRadius;
                    document.getElementById('playerLightRadiusVal').textContent = lightingSettings.playerLightRadius;
                }
            }
            pointLights = p.pointLights || {};
            polyLights = p.polyLights || [];
            updatePlacedLightsList();
            updatePolyLightsList();

            // Load multi-map data
            if (p.maps && Object.keys(p.maps).length > 0) {
                maps = p.maps;
                currentMapName = p.currentMapName || 'main';
                console.log('Loaded', Object.keys(maps).length, 'maps');
            } else {
                // No multi-map data - will create 'main' map from current data after load
                maps = {};
                currentMapName = 'main';
            }

            // Load triggers
            placedTriggers = p.placedTriggers || [];
            ensureTriggerUids(placedTriggers); // Wave 7: stamp UIDs on legacy saves so runtime lookups work.
            console.log('Loaded', placedTriggers.length, 'triggers');
            updateDoorNumberDropdown();

            // Load dialogs
            dialogs = p.dialogs || [];
            placedDialogTiles = p.placedDialogTiles || [];
            console.log('Loaded', dialogs.length, 'dialogs,', placedDialogTiles.length, 'dialog tiles');
            updateDialogList();

            // Load items
            items = [];
            placedItems = p.placedItems || [];
            fishingLoot = (p.fishingLoot || []).map(e => ({ ...e }));
            currentItemIndex = -1;
            if (p.items && p.items.length > 0) {
                p.items.forEach((itemData, i) => {
                    items[i] = {
                        ...itemData, // preserve all fields (behavior/ability config etc.) — don't whitelist
                        id: itemData.id || ('item_' + i), // Ensure ID exists
                        name: itemData.name,
                        spriteData: itemData.spriteData,
                        frameWidth: itemData.frameWidth || 16,
                        frameHeight: itemData.frameHeight || 16,
                        frames: itemData.frames || [],
                        fps: itemData.fps || 8,
                        idleFrame: itemData.idleFrame || 0,
                        maxStack: itemData.maxStack || 99
                    };
                    delete items[i]._spriteImg; // re-created below
                    // Preload sprite image
                    if (itemData.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            items[i]._spriteImg = img;
                            renderMap();
                        };
                        img.src = itemData.spriteData;
                    }
                });
                console.log('Loaded', items.length, 'items,', placedItems.length, 'placed items');
            }
            updateItemList();
            updatePlacedItemsList();

            // Load quests
            quests = p.quests || [];
            selectedQuestIndex = -1;
            console.log('Loaded', quests.length, 'quests');
            renderQuestList();

            // Load shops
            shops = p.shops || [];
            placedShops = p.placedShops || [];
            startingGold = p.startingGold !== undefined ? p.startingGold : 100;
            console.log('Loaded', shops.length, 'shops, starting gold:', startingGold);
            updateShopList();
            // Update gold input display
            const goldInput = document.getElementById('startingGoldInput');
            if (goldInput) goldInput.value = startingGold;

            // Load player characters
            playerCharacters = [];
            activePlayerIndex = -1;
            if (p.playerCharacters && p.playerCharacters.length > 0) {
                p.playerCharacters.forEach((char, i) => {
                    playerCharacters[i] = { ...char };
                    // Wave 1: shadow-unit migration — player chars canonicalize on integer percent.
                    // Legacy decimal values (< 1) get multiplied by 100 and a console warn is logged.
                    const sw = playerCharacters[i].shadowWidth;
                    if (typeof sw === 'number' && sw > 0 && sw < 1) {
                        console.warn('[MIGRATE] player[' + i + '].shadowWidth', sw, '-> integer percent', Math.round(sw * 100));
                        playerCharacters[i].shadowWidth = Math.round(sw * 100);
                    }
                    const sh = playerCharacters[i].shadowHeight;
                    if (typeof sh === 'number' && sh > 0 && sh < 1) {
                        console.warn('[MIGRATE] player[' + i + '].shadowHeight', sh, '-> integer percent', Math.round(sh * 100));
                        playerCharacters[i].shadowHeight = Math.round(sh * 100);
                    }
                    if (char.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            playerCharacters[i]._spriteImg = img;
                            updatePlayerList();
                        };
                        img.src = char.spriteData;
                    }
                });
                activePlayerIndex = p.activePlayerIndex !== undefined ? p.activePlayerIndex : 0;
                console.log('Loaded', playerCharacters.length, 'player characters, active:', activePlayerIndex);
            }
            updatePlayerList();

            // ===== Wave 1 orphan-purge pass — runs after all state is loaded =====
            try {
                // Triggers: drop any whose targetMap references a non-existent map.
                if (Array.isArray(placedTriggers) && maps) {
                    const before = placedTriggers.length;
                    placedTriggers = placedTriggers.filter(t => {
                        if (!t) return false;
                        const homeOk = !t.mapName || maps[t.mapName];
                        const targetOk = !t.targetMap || maps[t.targetMap];
                        if (!homeOk || !targetOk) console.warn('[LOAD] purged orphan trigger:', t);
                        return homeOk && targetOk;
                    });
                    if (placedTriggers.length < before) console.warn('[LOAD] dropped', before - placedTriggers.length, 'orphan trigger(s)');
                }
                // spawnMapName: if it points at a deleted map, repair it.
                if (spawnMapName && maps && !maps[spawnMapName]) {
                    const remaining = Object.keys(maps);
                    const repair = remaining[0] || 'main';
                    console.warn('[LOAD] spawnMapName', spawnMapName, 'missing; repaired to', repair);
                    spawnMapName = repair;
                }
                // Dangling soundIndex refs: clamp to -1.
                const nSounds = Array.isArray(sounds) ? sounds.length : 0;
                if (typeof tileSounds === 'object' && tileSounds) {
                    for (const k of Object.keys(tileSounds)) {
                        const e = tileSounds[k];
                        if (e && typeof e.soundIndex === 'number' && (e.soundIndex < 0 || e.soundIndex >= nSounds)) {
                            if (e.soundIndex !== -1) console.warn('[LOAD] dangling tileSound key', k, '-> soundIndex', e.soundIndex);
                            e.soundIndex = -1;
                        }
                    }
                }
                if (typeof playerSounds === 'object' && playerSounds) {
                    for (const action of Object.keys(playerSounds)) {
                        const cfg = playerSounds[action];
                        if (cfg && typeof cfg.soundIndex === 'number' && (cfg.soundIndex < 0 || cfg.soundIndex >= nSounds)) {
                            if (cfg.soundIndex !== -1) console.warn('[LOAD] dangling playerSound', action, '-> soundIndex', cfg.soundIndex);
                            cfg.soundIndex = -1;
                        }
                    }
                }
            } catch (err) {
                console.error('[LOAD] orphan-purge pass failed:', err);
            }
            // ===== end Wave 1 orphan-purge =====

            // Load tilesets (new format with multiple tilesets)
            if (p.tilesets && p.tilesets.length > 0) {
                let loadedCount = 0;
                tilesets = [];
                p.tilesets.forEach((tsData, i) => {
                    const img = new Image();
                    img.onload = () => {
                        tilesets[i] = { name: tsData.name, img: img, data: tsData.data };
                        loadedCount++;
                        if (loadedCount === p.tilesets.length) {
                            // All tilesets loaded
                            currentTilesetIndex = p.currentTilesetIndex || 0;
                            tilesetImg = tilesets[currentTilesetIndex].img;
                            mapInitialized = true; // Mark map as loaded

                            // Initialize maps object if empty (old format project)
                            if (Object.keys(maps).length === 0) {
                                saveCurrentMapState();
                                console.log('Initialized maps object with current data');
                            } else if (maps[currentMapName]) {
                                // Load current map's state (including cameraBounds)
                                loadMapState(maps[currentMapName]);
                                console.log('Loaded current map state for:', currentMapName);
                            }

                            updateTilesetDropdown();
                            setPhase('build');
                            drawPaintTileset();
                            renderLayerList();
                            renderMap();
                            updateAnimPropListDisplay();
                            updateMapDropdowns();
                            updateTriggerList();
                            updateCameraBoundsInfo();
                        }
                    };
                    img.src = tsData.data;
                });
            } else if (p.tilesetData) {
                // Old format - single tileset
                const img = new Image();
                img.onload = () => {
                    tilesets = [{ name: 'tileset', img: img, data: p.tilesetData }];
                    currentTilesetIndex = 0;
                    tilesetImg = img;
                    mapInitialized = true; // Mark map as loaded

                    // Initialize maps object if empty (old format project)
                    if (Object.keys(maps).length === 0) {
                        saveCurrentMapState();
                        console.log('Initialized maps object with current data');
                    } else if (maps[currentMapName]) {
                        // Load current map's state (including cameraBounds)
                        loadMapState(maps[currentMapName]);
                        console.log('Loaded current map state for:', currentMapName);
                    }

                    updateTilesetDropdown();
                    setPhase('build');
                    drawPaintTileset();
                    renderLayerList();
                    renderMap();
                    updateAnimPropListDisplay();
                    updateMapDropdowns();
                    updateTriggerList();
                    updateCameraBoundsInfo();
                };
                img.src = p.tilesetData;
            } else {
                alert('No tileset data found in save');
            }
        }

        // ===== MULTI-MAP FUNCTIONS =====

        // Save the current map state to the maps object
        // Camera bounds for current map (null = no bounds)
        let cameraBounds = null;
        let fishZones = []; // [{x,y,width,height}] in tiles — per-map water-fishing zones

        function saveCurrentMapState() {
            // Note: tileCollisions, collisionMasks, tileSplitLines are GLOBAL (per-tileset, not per-map)
            // They apply to all maps using the same tileset tiles
            maps[currentMapName] = {
                layers: JSON.parse(JSON.stringify(layers)),
                layerVisibility: [...layerVisibility],
                layerNames: [...layerNames],
                currentLayer: currentLayer,
                mapCols: mapCols,
                mapRows: mapRows,
                cameraBounds: cameraBounds ? { ...cameraBounds } : null,
                fishZones: fishZones.map(z => ({ ...z }))
            };
            console.log('Saved map state for:', currentMapName);
        }

        // Load a map state from the maps object
        function loadMapState(mapData) {
            layers = JSON.parse(JSON.stringify(mapData.layers));
            layerVisibility = [...mapData.layerVisibility];
            layerNames = [...mapData.layerNames];
            currentLayer = mapData.currentLayer || 0;
            // Note: collision data is global, not loaded per-map
            // Migrate old per-map collision data to global if present (backwards compatibility)
            if (mapData.tileCollisions && Object.keys(mapData.tileCollisions).length > 0) {
                Object.assign(tileCollisions, mapData.tileCollisions);
            }
            if (mapData.collisionMasks && Object.keys(mapData.collisionMasks).length > 0) {
                Object.assign(collisionMasks, mapData.collisionMasks);
            }
            if (mapData.tileSplitLines && Object.keys(mapData.tileSplitLines).length > 0) {
                Object.assign(tileSplitLines, mapData.tileSplitLines);
            }
            mapCols = mapData.mapCols || mapCols;
            mapRows = mapData.mapRows || mapRows;
            cameraBounds = mapData.cameraBounds ? { ...mapData.cameraBounds } : null;
            fishZones = (mapData.fishZones || []).map(z => ({ ...z }));
            map = layers[currentLayer];
        }

        // ===== Wave 0 helper stubs (to be called by later waves) =====
        // Rekey every key `${oldPrefix}:*` in `dict` to `${newPrefix}:*`. In place.
        function rekeyPrefix(dict, oldPrefix, newPrefix) {
            if (!dict || oldPrefix === newPrefix) return;
            const oldP = oldPrefix + ':';
            const newP = newPrefix + ':';
            for (const k of Object.keys(dict)) {
                if (k.startsWith(oldP)) {
                    const rest = k.slice(oldP.length);
                    dict[newP + rest] = dict[k];
                    delete dict[k];
                }
            }
        }

        // Cascade map rename across every known data structure that references a map by name.
        // Safe to call from local rename, applyRemoteEdit, applyRemoteEditNoRender, applyLiveEdit.
        function cascadeMapRename(oldName, newName) {
            if (!oldName || !newName || oldName === newName) return;
            if (typeof maps !== 'undefined' && maps && maps[oldName]) {
                maps[newName] = maps[oldName];
                delete maps[oldName];
            }
            const mapNameArrays = [
                (typeof placedTriggers !== 'undefined') ? placedTriggers : null,
                (typeof placedNpcs !== 'undefined') ? placedNpcs : null,
                (typeof placedItems !== 'undefined') ? placedItems : null,
                (typeof placedDialogTiles !== 'undefined') ? placedDialogTiles : null,
                (typeof placedAnimProps !== 'undefined') ? placedAnimProps : null,
                (typeof placedStaticObjects !== 'undefined') ? placedStaticObjects : null,
                (typeof placedShops !== 'undefined') ? placedShops : null
            ];
            for (const arr of mapNameArrays) {
                if (!Array.isArray(arr)) continue;
                for (const e of arr) {
                    if (e && e.mapName === oldName) e.mapName = newName;
                }
            }
            if (typeof placedTriggers !== 'undefined' && Array.isArray(placedTriggers)) {
                for (const t of placedTriggers) {
                    if (t && t.targetMap === oldName) t.targetMap = newName;
                }
            }
            if (typeof polyLights !== 'undefined' && Array.isArray(polyLights)) {
                for (const p of polyLights) {
                    if (p && p.mapName === oldName) p.mapName = newName;
                }
            }
            if (typeof tileSounds !== 'undefined') rekeyPrefix(tileSounds, oldName, newName);
            if (typeof pointLights !== 'undefined') rekeyPrefix(pointLights, oldName, newName);
            if (typeof currentMapName !== 'undefined' && currentMapName === oldName) currentMapName = newName;
            if (typeof spawnMapName !== 'undefined' && spawnMapName === oldName) spawnMapName = newName;
        }

        // Cascade map delete. Drops every record tagged with this map plus any trigger targeting it.
        // Repairs spawnMapName if it pointed at the deleted map.
        function cascadeMapDelete(name) {
            if (!name) return;
            if (typeof placedTriggers !== 'undefined' && Array.isArray(placedTriggers)) {
                placedTriggers = placedTriggers.filter(t => t && t.mapName !== name && t.targetMap !== name);
            }
            const mapNameArrayNames = ['placedNpcs','placedItems','placedDialogTiles','placedAnimProps','placedStaticObjects','placedShops'];
            for (const varName of mapNameArrayNames) {
                try {
                    const arr = eval(varName);
                    if (Array.isArray(arr)) {
                        // Filter in place by reassigning via window when possible; else splice.
                        for (let i = arr.length - 1; i >= 0; i--) {
                            if (arr[i] && arr[i].mapName === name) arr.splice(i, 1);
                        }
                    }
                } catch (_) {}
            }
            if (typeof polyLights !== 'undefined' && Array.isArray(polyLights)) {
                for (let i = polyLights.length - 1; i >= 0; i--) {
                    if (polyLights[i] && polyLights[i].mapName === name) polyLights.splice(i, 1);
                }
            }
            if (typeof tileSounds !== 'undefined') {
                const pref = name + ':';
                for (const k of Object.keys(tileSounds)) if (k.startsWith(pref)) delete tileSounds[k];
            }
            if (typeof pointLights !== 'undefined') {
                const pref = name + ':';
                for (const k of Object.keys(pointLights)) if (k.startsWith(pref)) delete pointLights[k];
            }
            if (typeof maps !== 'undefined' && maps) delete maps[name];
            if (typeof spawnMapName !== 'undefined' && spawnMapName === name) {
                const remaining = (typeof maps !== 'undefined' && maps) ? Object.keys(maps) : [];
                spawnMapName = remaining[0] || 'main';
            }
        }

        // Reindex helpers — called by Wave 5 delete paths. No-ops until wired.
        function reindexNpcReferences(deletedIndex) {
            if (typeof placedNpcs === 'undefined' || !Array.isArray(placedNpcs)) return;
            for (let i = placedNpcs.length - 1; i >= 0; i--) {
                const p = placedNpcs[i];
                if (!p) continue;
                if (p.npcIndex === deletedIndex) placedNpcs.splice(i, 1);
                else if (p.npcIndex > deletedIndex) p.npcIndex--;
            }
        }

        function reindexItemReferences(deletedIndex) {
            if (typeof placedItems !== 'undefined' && Array.isArray(placedItems)) {
                for (let i = placedItems.length - 1; i >= 0; i--) {
                    const p = placedItems[i];
                    if (!p) continue;
                    if (p.itemIndex === deletedIndex) placedItems.splice(i, 1);
                    else if (p.itemIndex > deletedIndex) p.itemIndex--;
                }
            }
            if (typeof shops !== 'undefined' && Array.isArray(shops)) {
                for (const s of shops) {
                    if (!s) continue;
                    for (const listName of ['inventory','buyList']) {
                        const list = s[listName];
                        if (!Array.isArray(list)) continue;
                        for (let i = list.length - 1; i >= 0; i--) {
                            const it = list[i];
                            if (!it) continue;
                            if (it.itemIndex === deletedIndex) list.splice(i, 1);
                            else if (it.itemIndex > deletedIndex) it.itemIndex--;
                        }
                    }
                }
            }
            if (typeof animatedProps !== 'undefined' && Array.isArray(animatedProps)) {
                for (const p of animatedProps) {
                    if (!p) continue;
                    if (p.giveItemIndex === deletedIndex) { p.giveItem = false; p.giveItemIndex = -1; }
                    else if (p.giveItemIndex > deletedIndex) p.giveItemIndex--;
                }
            }
            if (typeof placedAnimProps !== 'undefined' && Array.isArray(placedAnimProps)) {
                for (const p of placedAnimProps) {
                    if (!p) continue;
                    if (p.instanceItemIndex === deletedIndex) p.instanceItemIndex = -1;
                    else if (p.instanceItemIndex > deletedIndex) p.instanceItemIndex--;
                }
            }
            if (typeof placedNpcs !== 'undefined' && Array.isArray(placedNpcs)) {
                for (const n of placedNpcs) {
                    if (!n || !Array.isArray(n.dropItems)) continue;
                    for (let i = n.dropItems.length - 1; i >= 0; i--) {
                        const d = n.dropItems[i];
                        if (!d) continue;
                        if (d.itemIndex === deletedIndex) n.dropItems.splice(i, 1);
                        else if (d.itemIndex > deletedIndex) d.itemIndex--;
                    }
                }
            }
        }

        function reindexDialogReferences(deletedIndex) {
            const shift = (v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return v;
                if (n === deletedIndex) return '';
                if (n > deletedIndex) return String(n - 1);
                return v;
            };
            if (typeof placedDialogTiles !== 'undefined' && Array.isArray(placedDialogTiles)) {
                for (let i = placedDialogTiles.length - 1; i >= 0; i--) {
                    const t = placedDialogTiles[i];
                    if (!t) continue;
                    if (t.dialogIndex === deletedIndex) placedDialogTiles.splice(i, 1);
                    else if (t.dialogIndex > deletedIndex) t.dialogIndex--;
                }
            }
            if (typeof placedNpcs !== 'undefined' && Array.isArray(placedNpcs)) {
                for (const n of placedNpcs) {
                    if (!n) continue;
                    if (n.dialogIndex === deletedIndex) n.dialogIndex = -1;
                    else if (typeof n.dialogIndex === 'number' && n.dialogIndex > deletedIndex) n.dialogIndex--;
                }
            }
            if (typeof quests !== 'undefined' && Array.isArray(quests)) {
                for (const q of quests) {
                    if (!q) continue;
                    for (const f of ['startDialogId','activeDialogId','completeDialogId','declineDialogId']) {
                        if (q[f] !== undefined && q[f] !== null && q[f] !== '') q[f] = shift(q[f]);
                    }
                }
            }
            if (typeof shops !== 'undefined' && Array.isArray(shops)) {
                for (const s of shops) {
                    if (!s) continue;
                    if (s.greetingDialogId !== undefined && s.greetingDialogId !== null && s.greetingDialogId !== '') {
                        s.greetingDialogId = shift(s.greetingDialogId);
                    }
                }
            }
        }

        function reindexSoundReferences(deletedIndex) {
            if (typeof tileSounds !== 'undefined') {
                for (const k of Object.keys(tileSounds)) {
                    const e = tileSounds[k];
                    if (!e) continue;
                    if (e.soundIndex === deletedIndex) delete tileSounds[k];
                    else if (e.soundIndex > deletedIndex) e.soundIndex--;
                }
            }
            if (typeof playerSounds !== 'undefined' && playerSounds) {
                for (const action of Object.keys(playerSounds)) {
                    const cfg = playerSounds[action];
                    if (!cfg) continue;
                    if (cfg.soundIndex === deletedIndex) cfg.soundIndex = -1;
                    else if (cfg.soundIndex > deletedIndex) cfg.soundIndex--;
                }
            }
        }

        function reindexTilesetReferences(deletedIndex) {
            // Rebuild each tileset-prefixed dict excluding the deleted prefix; shift higher indices down.
            const dicts = [];
            if (typeof tileCollisions !== 'undefined') dicts.push(['tileCollisions', tileCollisions]);
            if (typeof collisionMasks !== 'undefined') dicts.push(['collisionMasks', collisionMasks]);
            if (typeof tileSplitLines !== 'undefined') dicts.push(['tileSplitLines', tileSplitLines]);
            if (typeof tileSplitLineFlipped !== 'undefined') dicts.push(['tileSplitLineFlipped', tileSplitLineFlipped]);
            for (const [name, dict] of dicts) {
                const rebuilt = {};
                for (const k of Object.keys(dict)) {
                    const colonIdx = k.indexOf(':');
                    if (colonIdx < 0) { rebuilt[k] = dict[k]; continue; }
                    const idx = parseInt(k.slice(0, colonIdx), 10);
                    const rest = k.slice(colonIdx);
                    if (!Number.isFinite(idx)) { rebuilt[k] = dict[k]; continue; }
                    if (idx === deletedIndex) continue;
                    if (idx > deletedIndex) rebuilt[(idx - 1) + rest] = dict[k];
                    else rebuilt[k] = dict[k];
                }
                // In-place replace keys
                for (const k of Object.keys(dict)) delete dict[k];
                Object.assign(dict, rebuilt);
            }
        }

        function reindexAnimPropReferences(deletedIndex) {
            // Walks every map's every layer's every cell; drops or decrements animTile cells.
            if (typeof maps === 'undefined' || !maps) return;
            for (const mapName of Object.keys(maps)) {
                const m = maps[mapName];
                if (!m || !Array.isArray(m.layers)) continue;
                for (const layer of m.layers) {
                    if (!Array.isArray(layer)) continue;
                    for (const row of layer) {
                        if (!Array.isArray(row)) continue;
                        for (let x = 0; x < row.length; x++) {
                            const cell = row[x];
                            if (!cell || cell.type !== 'animTile') continue;
                            if (cell.propIndex === deletedIndex) row[x] = null;
                            else if (cell.propIndex > deletedIndex) cell.propIndex--;
                        }
                    }
                }
            }
            if (typeof placedAnimProps !== 'undefined' && Array.isArray(placedAnimProps)) {
                for (let i = placedAnimProps.length - 1; i >= 0; i--) {
                    const p = placedAnimProps[i];
                    if (!p) continue;
                    if (p.propIndex === deletedIndex) placedAnimProps.splice(i, 1);
                    else if (p.propIndex > deletedIndex) p.propIndex--;
                }
            }
        }

        // Wave 7: trigger UID helpers. Index-based ID is fragile under concurrent edits.
        function findTriggerByUid(uid) {
            if (!uid || typeof placedTriggers === 'undefined' || !Array.isArray(placedTriggers)) return -1;
            return placedTriggers.findIndex(t => t && t.uid === uid);
        }

        function ensureTriggerUids(list) {
            if (!Array.isArray(list)) return;
            for (const t of list) {
                if (t && !t.uid) {
                    t.uid = (typeof crypto !== 'undefined' && crypto.randomUUID)
                        ? crypto.randomUUID()
                        : ('trig_' + Date.now() + '_' + Math.random().toString(36).slice(2));
                }
            }
        }

        // Save-format migration ladder. Bump SAVE_SCHEMA_VERSION and add a case per hop.
        function migrateProjectData(p) {
            if (!p || typeof p !== 'object') return p;
            const v = (typeof p.version === 'number') ? p.version : 1;
            // Future: if (v < 2) { ...migrate v1 -> v2... p.version = 2; }
            return p;
        }
        // ===== end Wave 0 helpers =====

        // Create a new empty map
        function createMapData(name) {
            // Note: collision/split data is global (per-tileset), not per-map
            maps[name] = {
                layers: [createEmptyLayer()],
                layerVisibility: [true],
                layerNames: ['Layer 1'],
                currentLayer: 0,
                mapCols: mapCols,
                mapRows: mapRows,
                cameraBounds: null, // {x, y, width, height} in tiles, null = no bounds
                fishZones: [] // [{x,y,width,height}] in tiles — water fishing zones
            };
            console.log('Created new map:', name);
        }

        // Switch to a different map
        function switchToMap(mapName) {
            if (!maps[mapName]) {
                console.warn('Map not found:', mapName);
                return false;
            }

            // Save current map state first
            saveCurrentMapState();

            // Load the new map
            currentMapName = mapName;
            loadMapState(maps[mapName]);

            // Update UI
            renderLayerList();
            renderMap();
            updateTriggerList();
            updatePlacedNpcList();
            updatePlacedSoundsList();
            updatePlacedLightsList();
            updateMapDropdowns(); // Update dropdown to show current map
            updateCameraBoundsInfo(); // Update camera bounds display

            console.log('Switched to map:', mapName);
            return true;
        }

        // Get list of all map names
        function getMapNames() {
            return Object.keys(maps);
        }

        // Delete a map (cannot delete last map)
        function deleteMap(mapName) {
            const mapNames = getMapNames();
            if (mapNames.length <= 1) {
                alert('Cannot delete the last map');
                return false;
            }
            if (mapName === currentMapName) {
                // Switch to another map first
                const otherMap = mapNames.find(n => n !== mapName);
                switchToMap(otherMap);
            }

            // Wave 4: shared cascade handles placedTriggers + all other .mapName arrays,
            // prefix-keyed dicts, and spawnMapName invariant repair.
            cascadeMapDelete(mapName);

            updateDoorNumberDropdown();
            if (typeof updatePlacedLightsList === 'function') updatePlacedLightsList();
            if (typeof updatePolyLightsList === 'function') updatePolyLightsList();
            if (typeof updatePlacedSoundsList === 'function') updatePlacedSoundsList();

            console.log('Deleted map:', mapName);
            return true;
        }

        // Update map dropdown selectors
        function updateMapDropdowns() {
            const mapNames = getMapNames();

            // Update current map selector (triggers tab)
            const currentSelect = document.getElementById('currentMapSelect');
            if (currentSelect) {
                currentSelect.innerHTML = mapNames.map(name =>
                    `<option value="${name}" ${name === currentMapName ? 'selected' : ''}>${name}</option>`
                ).join('');
            }

            // Update toolbar map selector
            const toolbarSelect = document.getElementById('toolbarMapSelect');
            if (toolbarSelect) {
                toolbarSelect.innerHTML = mapNames.map(name =>
                    `<option value="${name}" ${name === currentMapName ? 'selected' : ''}>${name}</option>`
                ).join('');
            }

            // Update camera map selector
            const cameraSelect = document.getElementById('cameraMapSelect');
            if (cameraSelect) {
                cameraSelect.innerHTML = mapNames.map(name =>
                    `<option value="${name}" ${name === currentMapName ? 'selected' : ''}>${name}</option>`
                ).join('');
            }

            const fishSelect = document.getElementById('fishMapSelect');
            if (fishSelect) {
                fishSelect.innerHTML = mapNames.map(name =>
                    `<option value="${name}" ${name === currentMapName ? 'selected' : ''}>${name}</option>`
                ).join('');
            }

            // Update target map selector
            const targetSelect = document.getElementById('triggerTargetMap');
            if (targetSelect) {
                targetSelect.innerHTML = '<option value="">-- Select Map --</option>' +
                    mapNames.map(name => `<option value="${name}">${name}</option>`).join('');
            }
        }

        // Update trigger list UI
        function updateTriggerList() {
            const container = document.getElementById('triggerList');
            if (!container) return;

            const currentTriggers = placedTriggers.filter(t => t.mapName === currentMapName);

            if (currentTriggers.length === 0) {
                container.innerHTML = '<div style="color:#666; text-align:center; padding:10px;">No triggers placed</div>';
                return;
            }

            container.innerHTML = currentTriggers.map((t, i) => {
                const globalIdx = placedTriggers.indexOf(t);
                const doorNum = t.doorNumber || 1;
                const doorType = t.doorType || 'walkover';
                const isExternal = doorType === 'external';
                const spawnSet = isExternal ? (t.returnX != null && t.returnY != null) : (t.targetX != null && t.targetY != null);
                const spawnText = isExternal
                    ? (spawnSet ? `return:(${t.returnX}, ${t.returnY})` : '<span style="color:#f80;">SET RETURN!</span>')
                    : (spawnSet ? `(${t.targetX}, ${t.targetY})` : '<span style="color:#f80;">SET SPAWN!</span>');
                const typeIcon = isExternal ? '🌐' : (doorType === 'interact' ? '🔘' : '🚶');
                const destination = isExternal ? t.externalUrl : t.targetMap;
                const borderColor = spawnSet ? (isExternal ? '#0cc' : '#f4f') : '#f80';
                return `<div style="background:#333; padding:8px; margin-bottom:4px; border-radius:3px; border-left:3px solid ${borderColor};">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span>${typeIcon} <b>Door ${doorNum}</b> → ${destination}</span>
                        <button onclick="deleteTrigger(${globalIdx})" style="background:#a33; padding:2px 6px; font-size:10px;">x</button>
                    </div>
                    <div style="font-size:10px; color:#888; margin-top:4px;">
                        ${t.width}x${t.height} | ${spawnText}${t.animTiles && t.animTiles.length ? ' | anim:' + t.animTiles.length : ''}
                    </div>
                </div>`;
            }).join('');
        }

        // Prompt for new map name
        function promptNewMap() {
            const name = prompt('Enter new map name:');
            if (!name || !name.trim()) return;

            const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            if (maps[cleanName]) {
                alert('Map "' + cleanName + '" already exists');
                return;
            }

            // Save current map first
            saveCurrentMapState();

            // Create new map and switch to it
            createMapData(cleanName);
            broadcastEdit({ editType: 'addMap', mapName: cleanName });
            currentMapName = cleanName;
            loadMapState(maps[cleanName]);

            updateMapDropdowns();
            updateTriggerList();
            renderLayerList();
            renderMap();

            alert('Created and switched to map: ' + cleanName);
        }

        // Prompt to delete current map
        function promptDeleteMap() {
            if (getMapNames().length <= 1) {
                alert('Cannot delete the last map');
                return;
            }

            if (!confirm('Delete map "' + currentMapName + '"? This cannot be undone.')) {
                return;
            }

            const deletedName = currentMapName;
            deleteMap(deletedName);
            broadcastEdit({ editType: 'deleteMap', mapName: deletedName });
            updateMapDropdowns();
            updateTriggerList();
            renderMap();

            alert('Deleted map: ' + deletedName);
        }

        // Rename current map
        function promptRenameMap() {
            const oldName = currentMapName;
            const newName = prompt('Enter new name for map "' + oldName + '":', oldName);

            if (!newName || !newName.trim()) return;

            const cleanName = newName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');

            if (cleanName === oldName) return; // No change

            if (maps[cleanName]) {
                alert('Map "' + cleanName + '" already exists');
                return;
            }

            // Wave 4: single-source cascade covers maps object, placedTriggers (mapName+targetMap),
            // placedNpcs, placedItems, placedDialogTiles, placedAnimProps, placedStaticObjects,
            // placedShops, polyLights, tileSounds keys, pointLights keys, currentMapName, spawnMapName.
            cascadeMapRename(oldName, cleanName);

            // Sync to other builders
            broadcastEdit({ editType: 'renameMap', oldName: oldName, newName: cleanName });

            // Update UI
            updateMapDropdowns();
            updateTriggerList();
            renderMap();

            console.log('[RENAME] Map renamed: "' + oldName + '" → "' + cleanName + '"');
        }

        // Update door number dropdown to only show available numbers
        function updateDoorNumberDropdown() {
            const select = document.getElementById('triggerDoorNumber');
            if (!select) return;

            const usedNumbers = placedTriggers.map(t => t.doorNumber);

            select.innerHTML = '';
            for (let i = 1; i <= 10; i++) {
                if (!usedNumbers.includes(i)) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = 'Door ' + i;
                    select.appendChild(option);
                }
            }

            // If all doors used, show message
            if (select.options.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'All doors used!';
                select.appendChild(option);
            }
        }

        // Door modal state
        let pendingDoorX = 0;
        let pendingDoorY = 0;
        let pendingDoorNumber = 1;
        let selectedWalkDirection = 'down'; // Default walk direction
        let useWalkOutPoint = false; // Whether to set walk-out destination by clicking
        let settingWalkOutPoint = false; // Currently in walk-out setting mode
        let pendingWalkOutTrigger = null; // Trigger waiting for walk-out point

        // Door animation state
        let selectingAnimTiles = false; // Selecting which tiles to swap
        let paintingAnimTiles = false; // Painting replacement tiles
        let pendingAnimTrigger = null; // Trigger being set up for animation
        let selectedAnimTiles = []; // Array of {x, y, layer, tileData} for selected tiles
        let doorAnimMapName = null; // Which map the door animation is being set up on

        // Update door animation panel visibility and hide extra UI
        function updateDoorAnimPanel() {
            const panel = document.getElementById('doorAnimPanel');
            const selectMode = document.getElementById('doorAnimSelectMode');
            const paintMode = document.getElementById('doorAnimPaintMode');

            // Elements to hide during door animation mode
            const hideElements = [
                'tileNormalUI',      // Selected tile + transform
                'tileExtraButtons',  // Select Tiles button
                'tileCopyCollision', // Copy from Map + Edit Collisions
                'tileLayerAdd',      // + Add Layer button
                'tilePlayerSprite'   // Player sprite section
            ];

            const inDoorAnimMode = selectingAnimTiles || paintingAnimTiles;

            // Show/hide extra UI elements
            hideElements.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = inDoorAnimMode ? 'none' : 'block';
            });

            // Hide mode tabs and main toolbar during door animation
            const modeTabs = document.getElementById('modeTabs');
            if (modeTabs) modeTabs.style.display = inDoorAnimMode ? 'none' : 'flex';

            const mainToolbar = document.getElementById('mainToolbar');
            if (mainToolbar) mainToolbar.style.display = inDoorAnimMode ? 'none' : 'flex';

            if (selectingAnimTiles) {
                panel.style.display = 'block';
                selectMode.style.display = 'block';
                paintMode.style.display = 'none';
            } else if (paintingAnimTiles) {
                panel.style.display = 'block';
                selectMode.style.display = 'none';
                paintMode.style.display = 'block';
            } else {
                panel.style.display = 'none';
                selectMode.style.display = 'none';
                paintMode.style.display = 'none';
            }
        }

        // Update modal options visibility based on door type
        function updateDoorModalOptions() {
            const doorType = document.getElementById('doorModalType').value;
            const walkoverOptions = document.getElementById('walkoverOptions');
            const interactOptions = document.getElementById('interactOptions');
            const externalOptions = document.getElementById('externalOptions');
            const mapSelectDiv = document.getElementById('doorMapSelectDiv');
            const confirmBtn = document.getElementById('doorModalConfirmBtn');

            walkoverOptions.style.display = doorType === 'walkover' ? 'block' : 'none';
            interactOptions.style.display = doorType === 'interact' ? 'block' : 'none';
            externalOptions.style.display = doorType === 'external' ? 'block' : 'none';

            // Hide map selector for external doors (they don't need a target map)
            if (mapSelectDiv) mapSelectDiv.style.display = doorType === 'external' ? 'none' : 'block';

            // Change confirm button text and color
            if (confirmBtn) {
                if (doorType === 'external') {
                    confirmBtn.textContent = 'Create Door';
                    confirmBtn.style.background = '#0cc';
                } else {
                    confirmBtn.textContent = 'Set Spawn →';
                    confirmBtn.style.background = '#4af';
                }
            }
        }

        // Toggle between walk-out point mode and direction mode
        function toggleWalkOutMode() {
            useWalkOutPoint = document.getElementById('useWalkOutPoint').checked;
            const dirOptions = document.getElementById('walkDirectionOptions');
            dirOptions.style.display = useWalkOutPoint ? 'none' : 'block';
        }

        // Set walk direction for walkover doors
        function setWalkDirection(dir) {
            selectedWalkDirection = dir;
            // Uncheck walk-out point if direction is selected
            document.getElementById('useWalkOutPoint').checked = false;
            useWalkOutPoint = false;
            document.getElementById('walkDirectionOptions').style.display = 'block';

            // Update button styles
            ['up', 'down', 'left', 'right'].forEach(d => {
                const btn = document.getElementById('walkDir' + d.charAt(0).toUpperCase() + d.slice(1));
                if (btn) {
                    btn.style.background = d === dir ? '#4af' : '#444';
                    btn.style.color = d === dir ? '#000' : '#fff';
                }
            });
        }

        // Show door map selection modal
        function showDoorMapModal(x, y, doorNumber) {
            pendingDoorX = x;
            pendingDoorY = y;
            pendingDoorNumber = doorNumber;

            // Update modal title
            document.getElementById('doorModalNumber').textContent = doorNumber;

            // Populate dropdown with other maps
            const select = document.getElementById('doorMapSelect');
            const otherMaps = Object.keys(maps).filter(m => m !== currentMapName);

            select.innerHTML = '';
            if (otherMaps.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = '(No other maps - create one below)';
                select.appendChild(opt);
            } else {
                otherMaps.forEach(mapName => {
                    const opt = document.createElement('option');
                    opt.value = mapName;
                    opt.textContent = mapName;
                    select.appendChild(opt);
                });
            }

            // Clear new map input
            document.getElementById('doorNewMapName').value = '';

            // Reset door options to defaults
            document.getElementById('doorModalType').value = 'walkover';
            document.getElementById('doorWalkDuration').value = '0.5';
            document.getElementById('doorFadeDuration').value = '0.5';
            document.getElementById('useWalkOutPoint').checked = false;
            useWalkOutPoint = false;
            document.getElementById('walkDirectionOptions').style.display = 'block';
            selectedWalkDirection = 'down';
            setWalkDirection('down');
            updateDoorModalOptions();

            // Populate the "Requires Key" dropdown from items
            const lockSel = document.getElementById('doorLockSelect');
            if (lockSel) {
                lockSel.innerHTML = '<option value="-1">None (unlocked)</option>' +
                    items.map((it, i) => '<option value="' + i + '">' + (it.name || ('Item ' + (i + 1))) + '</option>').join('');
                lockSel.value = '-1';
            }
            const lockConsumeEl = document.getElementById('doorLockConsume');
            if (lockConsumeEl) lockConsumeEl.checked = true;

            // Show modal
            document.getElementById('doorMapModal').style.display = 'flex';
        }

        function closeDoorMapModal() {
            document.getElementById('doorMapModal').style.display = 'none';
            // Reset pending trigger state
            pendingTriggerWidth = 1;
            pendingTriggerHeight = 1;
            useWalkOutPoint = false;
            settingWalkOutPoint = false;
            pendingWalkOutTrigger = null;
        }

        function confirmDoorMapModal() {
            // Get selected or new map
            let targetMap = document.getElementById('doorNewMapName').value.trim();
            const doorType = document.getElementById('doorModalType').value;
            const isExternal = doorType === 'external';

            // Handle external doors (link to another HTML file)
            if (isExternal) {
                const externalUrl = document.getElementById('externalDestination').value;
                const trigger = {
                    uid: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ('trig_' + Date.now() + '_' + Math.random().toString(36).slice(2)), // Wave 7
                    x: pendingDoorX,
                    y: pendingDoorY,
                    width: pendingTriggerWidth,
                    height: pendingTriggerHeight,
                    mapName: currentMapName,
                    doorNumber: pendingDoorNumber,
                    type: 'door',
                    doorType: 'external',
                    externalUrl: externalUrl,
                    fadeDuration: parseFloat(document.getElementById('doorFadeDuration').value),
                    returnX: null,  // Return spawn point (set by clicking on map)
                    returnY: null
                };
                pendingTriggerWidth = 1;
                pendingTriggerHeight = 1;

                console.log('=== EXTERNAL DOOR PLACED ===');
                console.log('[DOOR] Door ' + pendingDoorNumber + ' at (' + pendingDoorX + ', ' + pendingDoorY + ') -> "' + externalUrl + '"');

                placedTriggers.push(trigger);
                // Broadcast to co-op builders
                broadcastEdit({ editType: 'placeTrigger', trigger: trigger });
                updateTriggerList();
                updateDoorNumberDropdown();
                closeDoorMapModal();

                // Now set return spawn point (stay on same map)
                pendingTriggerForSpawn = trigger;
                pendingTriggerForSpawn.isExternalReturn = true; // Flag for special handling
                spawnSourceMap = currentMapName;
                settingSpawnPoint = true;
                setMode('trigger');
                renderMap();
                return;
            }

            if (!targetMap) {
                targetMap = document.getElementById('doorMapSelect').value;
            }

            if (!targetMap) {
                alert('Please select a map or enter a new map name');
                return;
            }

            const cleanMapName = targetMap.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

            // Create target map if it doesn't exist
            if (!maps[cleanMapName]) {
                createMapData(cleanMapName);
                broadcastEdit({ editType: 'addMap', mapName: cleanMapName });
                updateMapDropdowns();
            }

            const isWalkOver = doorType === 'walkover';
            const isInteract = doorType === 'interact';
            const useDoorAnim = isInteract && document.getElementById('useDoorAnimation').checked;
            const trigger = {
                uid: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ('trig_' + Date.now() + '_' + Math.random().toString(36).slice(2)), // Wave 7
                x: pendingDoorX,
                y: pendingDoorY,
                width: pendingTriggerWidth,
                height: pendingTriggerHeight,
                mapName: currentMapName,
                targetMap: cleanMapName,
                targetX: null,
                targetY: null,
                doorNumber: pendingDoorNumber,
                type: 'door',
                doorType: doorType, // 'walkover' or 'interact'
                // Walkover properties
                walkOutX: null, // Will be set if useWalkOutPoint is true
                walkOutY: null,
                walkDirection: isWalkOver && !useWalkOutPoint ? selectedWalkDirection : null,
                walkDuration: isWalkOver && !useWalkOutPoint ? parseFloat(document.getElementById('doorWalkDuration').value) : 0,
                fadeDuration: parseFloat(document.getElementById('doorFadeDuration').value),
                // Door animation properties (for interact doors)
                animTiles: useDoorAnim ? [] : null, // Array of {x, y, layer} tiles to hide on open
                // Key/lock: -1 = unlocked
                lockItemIndex: parseInt(document.getElementById('doorLockSelect')?.value ?? '-1'),
                lockConsume: document.getElementById('doorLockConsume') ? document.getElementById('doorLockConsume').checked : true
            };
            // Reset for next trigger
            pendingTriggerWidth = 1;
            pendingTriggerHeight = 1;

            console.log('=== DOOR PLACED ===');
            console.log('[DOOR] Door ' + pendingDoorNumber + ' at (' + pendingDoorX + ', ' + pendingDoorY + ') -> "' + cleanMapName + '"');

            placedTriggers.push(trigger);
            // Broadcast to co-op builders
            broadcastEdit({ editType: 'placeTrigger', trigger: trigger });
            updateTriggerList();
            updateDoorNumberDropdown();

            // Close modal
            closeDoorMapModal();

            // If walk-out point mode, stay on this map to set walk-out first
            if (isWalkOver && useWalkOutPoint) {
                settingWalkOutPoint = true;
                pendingWalkOutTrigger = trigger;
                pendingTriggerForSpawn = trigger;
                spawnSourceMap = currentMapName;
                renderMap();
                return;
            }

            // If door animation mode, mark trigger for anim setup after spawn is set
            if (useDoorAnim) {
                trigger.needsAnimSetup = true;
                console.log('[DOOR ANIM] Marked trigger for anim setup, needsAnimSetup =', trigger.needsAnimSetup);
            }

            // Go to target map to set spawn
            pendingTriggerForSpawn = trigger;
            spawnSourceMap = currentMapName;
            settingSpawnPoint = true;
            setMode('trigger'); // Ensure trigger mode for spawn click
            switchToMap(cleanMapName);
            renderMap();
        }

        // Place a trigger at the given tile position
        function placeTriggerAt(x, y) {
            // Auto-select next available door number
            const usedNumbers = placedTriggers.map(t => t.doorNumber);
            let doorNumber = null;
            for (let i = 1; i <= 100; i++) { // Wave 3: raised cap from 10 -> 100 doors per project
                if (!usedNumbers.includes(i)) {
                    doorNumber = i;
                    break;
                }
            }

            if (doorNumber === null) {
                alert('All door numbers (1-100) are in use! Delete an existing door first.');
                return;
            }

            // Show modal to select target map
            showDoorMapModal(x, y, doorNumber);
        }

        // Delete a trigger by index
        function deleteTrigger(index) {
            if (index >= 0 && index < placedTriggers.length) {
                const uid = placedTriggers[index]?.uid; // Wave 7: stable ID for the broadcast
                placedTriggers.splice(index, 1);
                // Broadcast to co-op builders (uid + index; receivers prefer uid)
                broadcastEdit({ editType: 'removeTrigger', index: index, uid: uid });
                updateTriggerList();
                updateDoorNumberDropdown();
                renderMap();
            }
        }

        // Remove trigger at position (for right-click)
        function removeTriggerAt(x, y) {
            const idx = placedTriggers.findIndex(t =>
                t.mapName === currentMapName &&
                x >= t.x && x < t.x + t.width &&
                y >= t.y && y < t.y + t.height
            );
            if (idx >= 0) {
                deleteTrigger(idx);
            }
        }

        // Set spawn point at clicked location
        function setSpawnPointAt(x, y) {
            // Update the pending trigger directly
            if (pendingTriggerForSpawn) {
                // Check if this is an external door return spawn
                if (pendingTriggerForSpawn.isExternalReturn) {
                    pendingTriggerForSpawn.returnX = x;
                    pendingTriggerForSpawn.returnY = y;
                    delete pendingTriggerForSpawn.isExternalReturn; // Clean up temp flag
                    console.log('=== EXTERNAL RETURN SPAWN PLACED ===');
                    console.log('[SPAWN] Door', pendingTriggerForSpawn.doorNumber, 'RETURN spawn set at (' + x + ', ' + y + ') on "' + currentMapName + '"');
                } else {
                    pendingTriggerForSpawn.targetX = x;
                    pendingTriggerForSpawn.targetY = y;
                    console.log('=== SPAWN PLACED ===');
                    console.log('[SPAWN] Door', pendingTriggerForSpawn.doorNumber, 'spawn set at (' + x + ', ' + y + ') on "' + currentMapName + '"');
                }
                // Sync the trigger update
                const triggerIndex = placedTriggers.indexOf(pendingTriggerForSpawn);
                if (triggerIndex >= 0) {
                    broadcastEdit({ editType: 'updateTrigger', index: triggerIndex, uid: pendingTriggerForSpawn.uid, trigger: pendingTriggerForSpawn });
                }
            }

            // Check if this trigger needs animation setup
            const needsAnim = pendingTriggerForSpawn && pendingTriggerForSpawn.needsAnimSetup;
            const triggerForAnim = pendingTriggerForSpawn;
            const isExternalDoor = pendingTriggerForSpawn && pendingTriggerForSpawn.doorType === 'external';
            console.log('[DOOR ANIM] In setSpawnPointAt, needsAnim =', needsAnim, 'trigger.needsAnimSetup =', pendingTriggerForSpawn?.needsAnimSetup);

            // Exit spawn setting mode
            settingSpawnPoint = false;
            const returnMap = spawnSourceMap;
            spawnSourceMap = null;
            pendingTriggerForSpawn = null;

            // Auto-return to source map (but not for external doors - we're already on the right map)
            if (returnMap && !isExternalDoor) {
                switchToMap(returnMap);
            }

            // If needs animation setup, start tile selection mode
            if (needsAnim && triggerForAnim) {
                triggerForAnim.needsAnimSetup = false;
                triggerForAnim.animTiles = [];
                pendingAnimTrigger = triggerForAnim;
                selectingAnimTiles = true;
                selectedAnimTiles = [];
                doorAnimMapName = currentMapName; // Track which map we're editing
                console.log('[DOOR ANIM] Starting tile selection for door', triggerForAnim.doorNumber);
                setMode('tile'); // Switch to tile mode for layer controls + palette
                updateDoorAnimPanel();
            } else {
                console.log('[DOOR ANIM] NOT starting tile selection. needsAnim =', needsAnim, 'triggerForAnim =', triggerForAnim);
            }

            renderMap();
        }

        // Set walk-out point at clicked location (where player walks TO before fade)
        function setWalkOutPointAt(x, y) {
            if (pendingWalkOutTrigger) {
                pendingWalkOutTrigger.walkOutX = x;
                pendingWalkOutTrigger.walkOutY = y;
                console.log('=== WALK-OUT POINT SET ===');
                console.log('[WALK-OUT] Door', pendingWalkOutTrigger.doorNumber, 'walk-out at (' + x + ', ' + y + ')');
                // Wave 3: broadcast the walk-out update (was silently local-only).
                const idx = placedTriggers.indexOf(pendingWalkOutTrigger);
                if (idx >= 0) {
                    broadcastEdit({ editType: 'updateTrigger', index: idx, uid: pendingWalkOutTrigger.uid, trigger: pendingWalkOutTrigger });
                }
            }

            // Exit walk-out setting mode
            settingWalkOutPoint = false;
            pendingWalkOutTrigger = null;

            // Now switch to target map to set spawn
            if (pendingTriggerForSpawn) {
                settingSpawnPoint = true;
                switchToMap(pendingTriggerForSpawn.targetMap);
            }
            renderMap();
        }

        // Toggle a tile in the animation selection
        function toggleAnimTileSelection(x, y) {
            // Check if already selected on current layer
            const idx = selectedAnimTiles.findIndex(t => t.x === x && t.y === y && t.layer === currentLayer);
            if (idx >= 0) {
                // Remove it
                selectedAnimTiles.splice(idx, 1);
                console.log('[DOOR ANIM] Deselected tile at', x, y, 'layer', currentLayer);
            } else {
                // Add it - capture current tile data from current layer
                const tileData = (layers[currentLayer] && layers[currentLayer][y] && layers[currentLayer][y][x])
                    ? JSON.parse(JSON.stringify(layers[currentLayer][y][x])) : null;
                selectedAnimTiles.push({
                    x, y,
                    layer: currentLayer,
                    before: tileData
                });
                console.log('[DOOR ANIM] Selected tile at', x, y, 'layer', currentLayer);
            }
            renderMap();
        }

        // Finish tile selection, move to painting mode
        function finishTileSelection() {
            if (selectedAnimTiles.length === 0) {
                alert('Select at least one tile to animate');
                return;
            }

            // Erase the selected tiles so user can paint replacements
            selectedAnimTiles.forEach(tile => {
                if (layers[tile.layer] && layers[tile.layer][tile.y]) {
                    layers[tile.layer][tile.y][tile.x] = null;
                }
            });

            selectingAnimTiles = false;
            paintingAnimTiles = true;
            setMode('tile'); // Switch to tile mode for painting
            console.log('[DOOR ANIM] Moved to paint mode with', selectedAnimTiles.length, 'tiles');
            updateDoorAnimPanel();
            renderMap();
        }

        // Finish painting, save the animation
        function finishAnimPainting() {
            // Capture the "after" state for each selected tile position
            const animChanges = [];
            selectedAnimTiles.forEach(tile => {
                const afterData = (layers[tile.layer] && layers[tile.layer][tile.y] && layers[tile.layer][tile.y][tile.x])
                    ? JSON.parse(JSON.stringify(layers[tile.layer][tile.y][tile.x])) : null;
                animChanges.push({
                    x: tile.x,
                    y: tile.y,
                    layer: tile.layer,
                    before: tile.before,
                    after: afterData
                });
            });

            // Restore the "before" tiles (door starts closed)
            selectedAnimTiles.forEach(tile => {
                if (!layers[tile.layer]) layers[tile.layer] = [];
                if (!layers[tile.layer][tile.y]) layers[tile.layer][tile.y] = [];
                layers[tile.layer][tile.y][tile.x] = tile.before;
            });

            // Save to trigger
            if (pendingAnimTrigger) {
                pendingAnimTrigger.animTiles = animChanges;
                console.log('=== DOOR ANIM SAVED ===');
                console.log('[DOOR ANIM] Door', pendingAnimTrigger.doorNumber, 'has', animChanges.length, 'tile swaps');
                // Wave 3: broadcast the animTiles update (was silently local-only).
                const idx = placedTriggers.indexOf(pendingAnimTrigger);
                if (idx >= 0) {
                    broadcastEdit({ editType: 'updateTrigger', index: idx, uid: pendingAnimTrigger.uid, trigger: pendingAnimTrigger });
                }
            }

            // Reset state
            paintingAnimTiles = false;
            pendingAnimTrigger = null;
            selectedAnimTiles = [];
            doorAnimMapName = null;
            updateDoorAnimPanel();
            renderMap();
        }

        // ===== CAMERA BOUNDS =====
        let settingCameraBounds = false;
        let cameraBoundsDragStart = null;
        let cameraBoundsDragEnd = null;

        function toggleCameraBoundsMode() {
            settingCameraBounds = !settingCameraBounds;
            const btn = document.getElementById('setCameraBoundsBtn');
            if (settingCameraBounds) {
                btn.textContent = '✓ Done';
                btn.style.background = '#8a4';
            } else {
                btn.textContent = 'Set Bounds';
                btn.style.background = '#484';
                cameraBoundsDragStart = null;
                cameraBoundsDragEnd = null;
            }
            updateCameraBoundsInfo();
            renderMap();
        }

        function clearCameraBounds(fromNetwork = false) {
            cameraBounds = null;
            cameraBoundsDragStart = null;
            cameraBoundsDragEnd = null;
            settingCameraBounds = false;
            document.getElementById('setCameraBoundsBtn').textContent = 'Set Bounds';
            document.getElementById('setCameraBoundsBtn').style.background = '#484';
            if (!fromNetwork) {
                broadcastEdit({ editType: 'cameraBounds', bounds: null, mapName: currentMapName });
            }
            updateCameraBoundsInfo();
            renderMap();
        }

        function setCameraBoundsFromDrag() {
            if (!cameraBoundsDragStart || !cameraBoundsDragEnd) return;

            const x1 = Math.min(cameraBoundsDragStart.x, cameraBoundsDragEnd.x);
            const y1 = Math.min(cameraBoundsDragStart.y, cameraBoundsDragEnd.y);
            const x2 = Math.max(cameraBoundsDragStart.x, cameraBoundsDragEnd.x);
            const y2 = Math.max(cameraBoundsDragStart.y, cameraBoundsDragEnd.y);

            if (cameraBounds) {
                // Expand existing bounds to include new selection
                const oldX2 = cameraBounds.x + cameraBounds.width - 1;
                const oldY2 = cameraBounds.y + cameraBounds.height - 1;
                const newX1 = Math.min(cameraBounds.x, x1);
                const newY1 = Math.min(cameraBounds.y, y1);
                const newX2 = Math.max(oldX2, x2);
                const newY2 = Math.max(oldY2, y2);

                cameraBounds = {
                    x: newX1,
                    y: newY1,
                    width: newX2 - newX1 + 1,
                    height: newY2 - newY1 + 1
                };
            } else {
                // First selection
                cameraBounds = {
                    x: x1,
                    y: y1,
                    width: x2 - x1 + 1,
                    height: y2 - y1 + 1
                };
            }

            console.log('Camera bounds expanded:', cameraBounds);
            broadcastEdit({ editType: 'cameraBounds', bounds: cameraBounds, mapName: currentMapName });

            // Stay in bounds mode for more selections
            cameraBoundsDragStart = null;
            cameraBoundsDragEnd = null;
            updateCameraBoundsInfo();
            renderMap();
        }

        function updateCameraBoundsInfo() {
            const info = document.getElementById('cameraBoundsInfo');
            if (!info) return;

            if (settingCameraBounds) {
                if (cameraBounds) {
                    info.innerHTML = `${cameraBounds.width}x${cameraBounds.height} tiles - drag to expand`;
                } else {
                    info.innerHTML = 'Drag on map to select area';
                }
                info.style.color = '#fa0';
            } else if (cameraBounds) {
                info.innerHTML = `Bounds: ${cameraBounds.width}x${cameraBounds.height} tiles`;
                info.style.color = '#8f8';
            } else {
                info.innerHTML = 'No bounds (camera follows player)';
                info.style.color = '#aaa';
            }
        }

        // ===== FISH ZONES TOOL (mirrors camera bounds, but a per-map ARRAY of zones) =====
        let settingFishZones = false;
        let fishZoneDragStart = null;
        let fishZoneDragEnd = null;

        function toggleFishZonesMode() {
            settingFishZones = !settingFishZones;
            const btn = document.getElementById('setFishZonesBtn');
            if (settingFishZones) {
                if (mode !== 'fish') setMode('fish'); // ensure the map-drag handlers are armed
                btn.textContent = '✓ Done';
                btn.style.background = '#8a4';
            } else {
                btn.textContent = 'Add Zone';
                btn.style.background = '#484';
                fishZoneDragStart = null;
                fishZoneDragEnd = null;
            }
            updateFishZonesInfo();
            renderMap();
        }

        function clearFishZones(fromNetwork = false) {
            fishZones = [];
            fishZoneDragStart = null;
            fishZoneDragEnd = null;
            settingFishZones = false;
            const btn = document.getElementById('setFishZonesBtn');
            if (btn) { btn.textContent = 'Add Zone'; btn.style.background = '#484'; }
            if (!fromNetwork) {
                broadcastEdit({ editType: 'fishZones', zones: [], mapName: currentMapName });
            }
            updateFishZonesInfo();
            renderMap();
        }

        function setFishZoneFromDrag() {
            if (!fishZoneDragStart || !fishZoneDragEnd) return;
            const x1 = Math.min(fishZoneDragStart.x, fishZoneDragEnd.x);
            const y1 = Math.min(fishZoneDragStart.y, fishZoneDragEnd.y);
            const x2 = Math.max(fishZoneDragStart.x, fishZoneDragEnd.x);
            const y2 = Math.max(fishZoneDragStart.y, fishZoneDragEnd.y);

            const nz = { x: x1, y: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 };
            // Like camera bounds: a drag that OVERLAPS existing zone(s) expands/merges them
            // into one big area (great for a whole river); a separate drag makes a new pond.
            const overlaps = (a, b) => a.x <= b.x + b.width - 1 && a.x + a.width - 1 >= b.x && a.y <= b.y + b.height - 1 && a.y + a.height - 1 >= b.y;
            const touched = fishZones.filter(z => overlaps(z, nz));
            if (touched.length) {
                let mx1 = nz.x, my1 = nz.y, mx2 = nz.x + nz.width - 1, my2 = nz.y + nz.height - 1;
                touched.forEach(z => { mx1 = Math.min(mx1, z.x); my1 = Math.min(my1, z.y); mx2 = Math.max(mx2, z.x + z.width - 1); my2 = Math.max(my2, z.y + z.height - 1); });
                fishZones = fishZones.filter(z => !touched.includes(z));
                fishZones.push({ x: mx1, y: my1, width: mx2 - mx1 + 1, height: my2 - my1 + 1 });
            } else {
                fishZones.push(nz);
            }
            broadcastEdit({ editType: 'fishZones', zones: fishZones, mapName: currentMapName });

            fishZoneDragStart = null;
            fishZoneDragEnd = null;
            updateFishZonesInfo();
            renderMap();
        }

        function updateFishZonesInfo() {
            const info = document.getElementById('fishZonesInfo');
            if (!info) return;
            const n = fishZones.length;
            if (settingFishZones) {
                info.innerHTML = n ? `${n} zone${n > 1 ? 's' : ''} - drag to add another` : 'Drag on the map over water';
                info.style.color = '#fa0';
            } else if (n) {
                info.innerHTML = `${n} fish zone${n > 1 ? 's' : ''}`;
                info.style.color = '#8f8';
            } else {
                info.innerHTML = 'No fish zones';
                info.style.color = '#aaa';
            }
        }

        // ===== FISHING LOOT TABLE (project-global) =====
        function renderFishingLoot() {
            const list = document.getElementById('fishingLootList');
            if (!list) return;
            if (!fishingLoot.length) {
                list.innerHTML = '<p style="font-size:10px; color:#666; margin:0;">No catches yet — add items the player can fish up.</p>';
                return;
            }
            const opts = items.map((it, i) => `<option value="${i}">${it.name || ('Item ' + i)}</option>`).join('');
            list.innerHTML = fishingLoot.map((e, idx) =>
                `<div style="display:flex; gap:4px; align-items:center; margin-bottom:4px;">
                    <select onchange="setFishingLootItem(${idx}, this.value)" style="flex:1; font-size:11px; padding:3px;">
                        <option value="-1">— item —</option>${opts}
                    </select>
                    <input type="number" min="1" value="${e.weight || 1}" title="weight (higher = more common)" onchange="setFishingLootWeight(${idx}, this.value)" style="width:48px; font-size:11px; padding:3px;">
                    <button onclick="removeFishingLootRow(${idx})" style="background:#622; color:#fff; border:none; padding:3px 7px; cursor:pointer;">✕</button>
                </div>`
            ).join('');
            const selects = list.querySelectorAll('select');
            fishingLoot.forEach((e, idx) => { if (selects[idx]) selects[idx].value = (e.itemIndex != null ? e.itemIndex : -1); });
        }
        function addFishingLootRow() { fishingLoot.push({ itemIndex: items.length ? 0 : -1, weight: 1 }); renderFishingLoot(); }
        function removeFishingLootRow(i) { fishingLoot.splice(i, 1); renderFishingLoot(); }
        function setFishingLootItem(i, v) { if (fishingLoot[i]) fishingLoot[i].itemIndex = parseInt(v); }
        function setFishingLootWeight(i, v) { if (fishingLoot[i]) fishingLoot[i].weight = Math.max(1, parseInt(v) || 1); }

        // ===== DIALOG SYSTEM =====
        const dialogStylePresets = {
            1: { name: 'Classic NES', bg: '#000000', border: '#ffffff', text: '#ffffff', accent: '#ffffff', radius: 0, borderW: 4 },
            2: { name: 'Final Fantasy', bg: '#000088', border: '#ffffff', text: '#ffffff', accent: '#ffff00', radius: 0, borderW: 2 },
            3: { name: 'Pokemon', bg: '#f8f8f8', border: '#303030', text: '#303030', accent: '#e03030', radius: 8, borderW: 3 },
            4: { name: 'Earthbound', bg: '#000000', border: '#a080ff', text: '#ffffff', accent: '#ffff00', radius: 0, borderW: 2 },
            5: { name: 'Chrono Trigger', bg: '#1a1a4e', border: '#8888ff', text: '#ffffff', accent: '#ffcc00', radius: 4, borderW: 2 },
            6: { name: 'Modern Pixel', bg: '#2d2d2d', border: '#4a9eff', text: '#ffffff', accent: '#4a9eff', radius: 6, borderW: 2 }
        };

        let dialogEditorPages = [{ speaker: '', text: '' }];
        let dialogEditorPageIndex = 0;
        let dialogEditingIndex = -1; // -1 = new dialog
        let dialogAutoAttachNpcIndex = -1; // NPC to auto-attach dialog to after saving

        // Add dialog to currently selected NPC - switches to dialog tab and opens editor
        function addDialogToSelectedNpc() {
            if (selectedPlacedNpcIndex < 0) {
                alert('No NPC selected! Select an NPC first.');
                return;
            }

            const npc = placedNpcs[selectedPlacedNpcIndex];
            const npcDef = npcs[npc.npcIndex];
            const npcName = npcDef?.name || 'NPC ' + selectedPlacedNpcIndex;

            // Store which NPC to attach to
            dialogAutoAttachNpcIndex = selectedPlacedNpcIndex;

            // Switch to dialog mode
            setMode('dialog');

            // Open dialog editor for new dialog with NPC name pre-filled
            openDialogEditor(-1);
            document.getElementById('dialogNameInput').value = npcName + ' Dialog';

            console.log('[DIALOG] Adding dialog for NPC:', npcName);
        }

        function openDialogEditor(index) {
            dialogEditingIndex = index;

            if (index >= 0 && dialogs[index]) {
                // Editing existing dialog
                const d = dialogs[index];
                document.getElementById('dialogNameInput').value = d.name || '';
                document.getElementById('dialogStyleSelect').value = d.style || 1;
                document.getElementById('dialogBgColor').value = d.colors?.background || '#000000';
                document.getElementById('dialogBorderColor').value = d.colors?.border || '#ffffff';
                document.getElementById('dialogTextColor').value = d.colors?.text || '#ffffff';
                document.getElementById('dialogAccentColor').value = d.colors?.accent || '#ffffff';
                document.getElementById('dialogWidth').value = d.width || 280;
                document.getElementById('dialogHeight').value = d.height || 80;
                document.getElementById('dialogTypeSpeed').value = d.typeSpeed ?? 30;
                document.getElementById('dialogTypeSpeedVal').textContent = d.typeSpeed == 0 ? 'Instant' : (d.typeSpeed ?? 30);
                dialogEditorPages = d.pages ? JSON.parse(JSON.stringify(d.pages)) : [{ speaker: '', text: '' }];
            } else {
                // New dialog
                document.getElementById('dialogNameInput').value = '';
                document.getElementById('dialogStyleSelect').value = '1';
                applyDialogStylePreset(1);
                document.getElementById('dialogWidth').value = 280;
                document.getElementById('dialogHeight').value = 80;
                document.getElementById('dialogTypeSpeed').value = 30;
                document.getElementById('dialogTypeSpeedVal').textContent = '30';
                dialogEditorPages = [{ speaker: '', text: '' }];
            }

            dialogEditorPageIndex = 0;
            loadDialogPage(0, true);
            updateDialogPagesListEditor();
            updateDialogPreview();

            document.getElementById('dialogModal').classList.add('visible');
        }

        function closeDialogEditor() {
            document.getElementById('dialogModal').classList.remove('visible');
            dialogAutoAttachNpcIndex = -1; // Reset auto-attach
        }

        function applyDialogStylePreset(style) {
            const preset = dialogStylePresets[style];
            if (preset) {
                document.getElementById('dialogBgColor').value = preset.bg;
                document.getElementById('dialogBorderColor').value = preset.border;
                document.getElementById('dialogTextColor').value = preset.text;
                document.getElementById('dialogAccentColor').value = preset.accent;
            }
        }

        function loadDialogPage(index, skipSave = false) {
            // Save current page first (including choices)
            if (!skipSave && dialogEditorPages[dialogEditorPageIndex]) {
                dialogEditorPages[dialogEditorPageIndex] = {
                    speaker: document.getElementById('dialogSpeaker').value,
                    text: document.getElementById('dialogTextInput').value,
                    choices: dialogEditorPages[dialogEditorPageIndex].choices || null
                };
            }

            dialogEditorPageIndex = index;
            const page = dialogEditorPages[index] || { speaker: '', text: '' };
            document.getElementById('dialogSpeaker').value = page.speaker || '';
            document.getElementById('dialogTextInput').value = page.text || '';
            renderDialogChoicesList();
            updateDialogPagesListEditor();
            updateDialogPreview();
        }

        // Dialog choices management
        function renderDialogChoicesList() {
            const container = document.getElementById('dialogChoicesList');
            if (!container) return;

            const page = dialogEditorPages[dialogEditorPageIndex];
            const choices = page?.choices || [];

            if (choices.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px;">No choices (auto-advance)</div>';
                return;
            }

            container.innerHTML = choices.map((choice, i) => {
                const actionLabel = {
                    'accept': 'Accept Quest',
                    'decline': 'Decline Quest',
                    'goto': 'Go to Dialog',
                    'shop': 'Open Shop',
                    'close': 'Close Dialog'
                }[choice.action] || choice.action;

                return `<div style="display:flex; gap:4px; align-items:center; margin-bottom:4px; padding:4px; background:#333; border-radius:3px;">
                    <input type="text" value="${choice.text || ''}" onchange="updateDialogChoice(${i}, 'text', this.value)" style="flex:1; padding:3px; font-size:10px;" placeholder="Choice text...">
                    <select onchange="updateDialogChoice(${i}, 'action', this.value)" style="padding:3px; font-size:9px; width:80px;">
                        <option value="accept" ${choice.action === 'accept' ? 'selected' : ''}>Accept</option>
                        <option value="decline" ${choice.action === 'decline' ? 'selected' : ''}>Decline</option>
                        <option value="goto" ${choice.action === 'goto' ? 'selected' : ''}>Go to</option>
                        <option value="shop" ${choice.action === 'shop' ? 'selected' : ''}>Shop</option>
                        <option value="close" ${choice.action === 'close' ? 'selected' : ''}>Close</option>
                    </select>
                    <button onclick="removeDialogChoice(${i})" style="padding:2px 5px; font-size:9px; background:#a55;">X</button>
                </div>`;
            }).join('');
        }

        function addDialogChoice() {
            const page = dialogEditorPages[dialogEditorPageIndex];
            if (!page.choices) page.choices = [];

            page.choices.push({
                text: 'Choice ' + (page.choices.length + 1),
                action: 'accept'
            });

            renderDialogChoicesList();
        }

        function updateDialogChoice(index, field, value) {
            const page = dialogEditorPages[dialogEditorPageIndex];
            if (page?.choices && page.choices[index]) {
                page.choices[index][field] = value;
            }
        }

        function removeDialogChoice(index) {
            const page = dialogEditorPages[dialogEditorPageIndex];
            if (page?.choices) {
                page.choices.splice(index, 1);
                if (page.choices.length === 0) {
                    page.choices = [];
                }
                renderDialogChoicesList();
            }
        }

        function selectDialogPageEditor(index) {
            loadDialogPage(index);
        }

        function addDialogPage() {
            // Save current page
            const existingChoices = dialogEditorPages[dialogEditorPageIndex]?.choices || null;
            dialogEditorPages[dialogEditorPageIndex] = {
                speaker: document.getElementById('dialogSpeaker').value,
                text: document.getElementById('dialogTextInput').value,
                choices: existingChoices
            };

            dialogEditorPages.push({ speaker: '', text: '', choices: null });
            loadDialogPage(dialogEditorPages.length - 1);
        }

        function removeCurrentDialogPage() {
            if (dialogEditorPages.length <= 1) {
                alert('Cannot delete the only page');
                return;
            }

            dialogEditorPages.splice(dialogEditorPageIndex, 1);
            if (dialogEditorPageIndex >= dialogEditorPages.length) {
                dialogEditorPageIndex = dialogEditorPages.length - 1;
            }
            loadDialogPage(dialogEditorPageIndex);
        }

        function updateDialogPagesListEditor() {
            const container = document.getElementById('dialogPagesList');
            container.innerHTML = dialogEditorPages.map((page, i) => {
                const active = i === dialogEditorPageIndex ? 'active' : '';
                const preview = (page.text || 'Empty').substring(0, 15);
                return `<div class="dialog-page ${active}" onclick="selectDialogPageEditor(${i})">${i + 1}</div>`;
            }).join('');
        }

        function updateDialogPreview() {
            const canvas = document.getElementById('dialogPreviewCanvas');
            if (!canvas) return;

            const width = parseInt(document.getElementById('dialogWidth').value) || 280;
            const height = parseInt(document.getElementById('dialogHeight').value) || 80;
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            const bgColor = document.getElementById('dialogBgColor').value;
            const borderColor = document.getElementById('dialogBorderColor').value;
            const textColor = document.getElementById('dialogTextColor').value;
            const accentColor = document.getElementById('dialogAccentColor').value;
            const style = parseInt(document.getElementById('dialogStyleSelect').value);
            const preset = dialogStylePresets[style];

            // Draw background
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, width, height);

            // Draw border
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = preset?.borderW || 2;
            const radius = preset?.radius || 0;

            if (radius > 0) {
                ctx.beginPath();
                ctx.roundRect(2, 2, width - 4, height - 4, radius);
                ctx.stroke();
            } else {
                ctx.strokeRect(2, 2, width - 4, height - 4);
            }

            // Draw speaker name
            const speaker = document.getElementById('dialogSpeaker').value;
            const text = document.getElementById('dialogTextInput').value;

            ctx.font = '12px monospace';
            let y = 18;

            if (speaker) {
                ctx.fillStyle = accentColor;
                ctx.fillText(speaker, 12, y);
                y += 16;
            }

            // Draw text (simple word wrap)
            ctx.fillStyle = textColor;
            const words = text.split(' ');
            let line = '';
            const maxWidth = width - 24;

            for (const word of words) {
                const testLine = line + word + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && line) {
                    ctx.fillText(line, 12, y);
                    line = word + ' ';
                    y += 14;
                    if (y > height - 10) break;
                } else {
                    line = testLine;
                }
            }
            if (y <= height - 10) {
                ctx.fillText(line, 12, y);
            }
        }

        function saveDialog() {
            // Save current page (preserving choices)
            const existingChoices = dialogEditorPages[dialogEditorPageIndex]?.choices || null;
            dialogEditorPages[dialogEditorPageIndex] = {
                speaker: document.getElementById('dialogSpeaker').value,
                text: document.getElementById('dialogTextInput').value,
                choices: existingChoices
            };

            const name = document.getElementById('dialogNameInput').value.trim() || 'Dialog ' + (dialogs.length + 1);
            const style = parseInt(document.getElementById('dialogStyleSelect').value);

            const dialogData = {
                name: name,
                style: style,
                width: parseInt(document.getElementById('dialogWidth').value) || 280,
                height: parseInt(document.getElementById('dialogHeight').value) || 80,
                typeSpeed: parseInt(document.getElementById('dialogTypeSpeed').value) || 30,
                colors: {
                    background: document.getElementById('dialogBgColor').value,
                    border: document.getElementById('dialogBorderColor').value,
                    text: document.getElementById('dialogTextColor').value,
                    accent: document.getElementById('dialogAccentColor').value
                },
                pages: JSON.parse(JSON.stringify(dialogEditorPages))
            };

            if (dialogEditingIndex >= 0) {
                dialogs[dialogEditingIndex] = dialogData;
                broadcastEdit({ editType: 'updateDialog', index: dialogEditingIndex, dialog: dialogData });
            } else {
                dialogs.push(dialogData);
                broadcastEdit({ editType: 'addDialog', dialog: dialogData });

                // Auto-attach to NPC if we came from NPC panel
                if (dialogAutoAttachNpcIndex >= 0 && dialogAutoAttachNpcIndex < placedNpcs.length) {
                    const newDialogIndex = dialogs.length - 1;
                    placedNpcs[dialogAutoAttachNpcIndex].dialogIndex = newDialogIndex;
                    placedNpcs[dialogAutoAttachNpcIndex].dialogTrigger = 'interact'; // Default to interact trigger
                    broadcastEdit({ editType: 'attachNpcDialog', npcIndex: dialogAutoAttachNpcIndex, dialogIndex: newDialogIndex, dialogTrigger: 'interact' });
                    console.log('[DIALOG] Auto-attached dialog to NPC', dialogAutoAttachNpcIndex);
                    dialogAutoAttachNpcIndex = -1; // Reset
                }

                // Auto-attach to quest if we came from quest dialog picker
                if (typeof questDialogPickerType !== 'undefined' && questDialogPickerType) {
                    attachNewDialogToQuest(dialogs.length - 1);
                }
            }

            closeDialogEditor();
            updateDialogList();
            // Refresh quest dialog dropdowns in case name changed
            if (typeof updateQuestDialogDropdowns === 'function') {
                updateQuestDialogDropdowns();
            }
            console.log('[DIALOG] Saved dialog:', name);
        }

        function deleteDialog(index) {
            if (!confirm('Delete dialog "' + dialogs[index].name + '"?')) return;

            // Check if any NPC uses this dialog
            const usedBy = placedNpcs.filter(n => n.dialogIndex === index);
            if (usedBy.length > 0) {
                alert('Cannot delete: This dialog is attached to ' + usedBy.length + ' NPC(s)');
                return;
            }

            dialogs.splice(index, 1);

            // Wave 5: cascade reindex — placedDialogTiles, placedNpcs.dialogIndex,
            // quest hook IDs (startDialogId/activeDialogId/completeDialogId/declineDialogId),
            // shops[].greetingDialogId.
            reindexDialogReferences(index);

            broadcastEdit({ editType: 'deleteDialog', index: index });
            updateDialogList();
            if (typeof renderQuestList === 'function') renderQuestList();
            if (typeof updateShopList === 'function') updateShopList();
            renderMap();
        }

        function updateDialogList() {
            const container = document.getElementById('dialogList');
            if (!container) return;

            if (dialogs.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:12px; text-align:center; padding:20px;">No dialogs created yet</div>';
                return;
            }

            // Gather info about each dialog
            const dialogInfo = dialogs.map((d, i) => {
                const pageCount = d.pages?.length || 1;
                const attachedTo = [];
                const questUsage = [];

                // Check which NPCs use this dialog
                placedNpcs.forEach((n, npcIdx) => {
                    if (n.dialogIndex === i) {
                        const npcDef = npcs[n.npcIndex];
                        const npcName = npcDef?.name || 'NPC ' + npcIdx;
                        const trigger = n.dialogTrigger === 'auto' ? ' (auto)' : '';
                        attachedTo.push('NPC: ' + npcName + trigger);
                    }
                });

                // Check which signs use this dialog
                placedDialogTiles.forEach((tile, tileIdx) => {
                    if (tile.dialogIndex === i) {
                        attachedTo.push('Sign at (' + tile.x + ',' + tile.y + ')');
                    }
                });

                // Check which quests use this dialog
                quests.forEach(quest => {
                    if (parseInt(quest.startDialogId) === i) {
                        questUsage.push({ quest: quest.name || quest.id, type: 'Start' });
                    }
                    if (parseInt(quest.activeDialogId) === i) {
                        questUsage.push({ quest: quest.name || quest.id, type: 'Active' });
                    }
                    if (parseInt(quest.completeDialogId) === i) {
                        questUsage.push({ quest: quest.name || quest.id, type: 'Complete' });
                    }
                });

                return {
                    dialog: d,
                    index: i,
                    pageCount,
                    attachedTo,
                    questUsage,
                    isQuestDialog: questUsage.length > 0
                };
            });

            // Separate into quest dialogs and regular dialogs
            const questDialogs = dialogInfo.filter(d => d.isQuestDialog);
            const regularDialogs = dialogInfo.filter(d => !d.isQuestDialog);

            let html = '';

            // Quest Dialogs section
            if (questDialogs.length > 0) {
                html += '<div style="font-size:11px; color:#fa0; font-weight:bold; margin:8px 0 4px 0; border-bottom:1px solid #fa0; padding-bottom:2px;">QUEST DIALOGS</div>';
                html += questDialogs.map(info => renderDialogItem(info)).join('');
            }

            // Regular Dialogs section
            if (regularDialogs.length > 0) {
                html += '<div style="font-size:11px; color:#8cf; font-weight:bold; margin:8px 0 4px 0; border-bottom:1px solid #8cf; padding-bottom:2px;">REGULAR DIALOGS</div>';
                html += regularDialogs.map(info => renderDialogItem(info)).join('');
            }

            container.innerHTML = html;

            // Also update the dialog dropdown for attaching
            updateDialogDropdown();
            updateDialogTileDropdown();
            updatePlacedDialogTilesList();
        }

        function renderDialogItem(info) {
            const { dialog, index, pageCount, attachedTo, questUsage, isQuestDialog } = info;
            const isSelected = currentDialogTileIndex === index;
            const bgColor = isSelected ? '#4a7c59' : '#333';
            const borderStyle = isSelected ? '2px solid #8f8' : '2px solid transparent';

            // Build usage text
            let usageText = '';
            if (questUsage.length > 0) {
                usageText = questUsage.map(q => q.quest + ' (' + q.type + ')').join(', ');
            } else if (attachedTo.length > 0) {
                usageText = attachedTo.join(', ');
            } else {
                usageText = '<span style="color:#f88;">Not attached</span>';
            }

            return `<div onclick="selectDialogForPlacement(${index})" style="display:flex; align-items:center; gap:8px; padding:8px; margin-bottom:5px; background:${bgColor}; border-radius:4px; cursor:pointer; border:${borderStyle};">
                <div style="flex:1; min-width:0;">
                    <div style="font-size:12px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${dialog.name}</div>
                    <div style="font-size:10px; color:#888;">${pageCount} page${pageCount > 1 ? 's' : ''}${isSelected ? ' - SELECTED' : ''}</div>
                    <div style="font-size:9px; color:#aaa; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${usageText}</div>
                </div>
                <button onclick="event.stopPropagation(); openDialogEditor(${index})" style="padding:4px 8px; font-size:11px; background:#448;">Edit</button>
                <button onclick="event.stopPropagation(); deleteDialog(${index})" style="padding:4px 8px; font-size:11px; background:#644;">X</button>
            </div>`;
        }

        function updateDialogDropdown() {
            const select = document.getElementById('dialogToAttach');
            if (!select) return;

            select.innerHTML = '<option value="">Select a dialog...</option>' +
                dialogs.map((d, i) => `<option value="${i}">${d.name}</option>`).join('');
        }

        function updateDialogNpcDropdown() {
            const select = document.getElementById('dialogNpcSelect');
            if (!select) return;

            select.innerHTML = '<option value="">Select an NPC...</option>' +
                placedNpcs.map((n, i) => {
                    const npcDef = npcs[n.npcIndex];
                    const name = npcDef?.name || 'NPC ' + i;
                    const hasDialog = n.dialogIndex >= 0 ? ' (has dialog)' : '';
                    return `<option value="${i}">${name}${hasDialog}</option>`;
                }).join('');
        }

        function attachDialogToNpc() {
            const npcIdx = parseInt(document.getElementById('dialogNpcSelect').value);
            const dialogIdx = parseInt(document.getElementById('dialogToAttach').value);
            const triggerType = document.getElementById('dialogNpcTrigger').value;

            if (isNaN(npcIdx) || npcIdx < 0) {
                alert('Please select an NPC');
                return;
            }
            if (isNaN(dialogIdx) || dialogIdx < 0) {
                alert('Please select a dialog');
                return;
            }

            placedNpcs[npcIdx].dialogIndex = dialogIdx;
            placedNpcs[npcIdx].dialogTrigger = triggerType; // 'interact' or 'auto'
            broadcastEdit({ editType: 'attachNpcDialog', npcIndex: npcIdx, dialogIndex: dialogIdx, dialogTrigger: triggerType });

            alert('Dialog attached to NPC!');
            updateDialogNpcDropdown();
        }

        // ===== DIALOG TILE PLACEMENT (Signs) =====
        function selectDialogForPlacement(index) {
            // Toggle selection
            if (currentDialogTileIndex === index) {
                currentDialogTileIndex = -1; // Deselect
            } else {
                currentDialogTileIndex = index;
            }
            updateDialogList();
            // Also update dropdown if it exists
            const select = document.getElementById('dialogTileSelect');
            if (select) select.value = currentDialogTileIndex;
        }

        function selectDialogForTile(value) {
            currentDialogTileIndex = parseInt(value);
            updateDialogList();
        }

        function updateDialogTileDropdown() {
            const select = document.getElementById('dialogTileSelect');
            if (!select) return;
            select.innerHTML = '<option value="-1">Select a dialog...</option>' +
                dialogs.map((d, i) => `<option value="${i}">${d.name}</option>`).join('');
            select.value = currentDialogTileIndex;
        }

        function updatePlacedDialogTilesList() {
            const list = document.getElementById('placedDialogTilesList');
            if (!list) return;

            const tilesOnMap = placedDialogTiles.filter(t => t.mapName === currentMapName);
            if (tilesOnMap.length === 0) {
                list.innerHTML = '<div style="color:#666; font-size:11px; text-align:center; padding:10px;">No dialog tiles placed</div>';
                return;
            }

            list.innerHTML = tilesOnMap.map((t, i) => {
                const globalIdx = placedDialogTiles.indexOf(t);
                const dialogName = dialogs[t.dialogIndex]?.name || 'Unknown';
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:4px; margin:2px 0; background:#333; border-radius:3px; font-size:11px;">
                    <span>(${t.x}, ${t.y}) - ${dialogName}</span>
                    <button onclick="removeDialogTileByIndex(${globalIdx})" style="padding:2px 6px; font-size:10px; background:#a33;">x</button>
                </div>`;
            }).join('');
        }

        function placeDialogTileAt(x, y) {
            if (currentDialogTileIndex < 0) {
                alert('Select a dialog first');
                return;
            }

            // Check if already has dialog tile at this position
            const existing = findDialogTileAt(x, y);
            if (existing >= 0) {
                // Update existing
                placedDialogTiles[existing].dialogIndex = currentDialogTileIndex;
                broadcastEdit({ editType: 'updateDialogTile', index: existing, tile: placedDialogTiles[existing] });
            } else {
                // Add new
                const tile = { x, y, mapName: currentMapName, dialogIndex: currentDialogTileIndex };
                placedDialogTiles.push(tile);
                broadcastEdit({ editType: 'placeDialogTile', tile });
            }

            updatePlacedDialogTilesList();
            renderMap();
        }

        function removeDialogTileAt(x, y) {
            const idx = findDialogTileAt(x, y);
            if (idx >= 0) {
                placedDialogTiles.splice(idx, 1);
                broadcastEdit({ editType: 'removeDialogTile', index: idx });
                updatePlacedDialogTilesList();
                renderMap();
            }
        }

        function removeDialogTileByIndex(idx) {
            if (idx >= 0 && idx < placedDialogTiles.length) {
                placedDialogTiles.splice(idx, 1);
                broadcastEdit({ editType: 'removeDialogTile', index: idx });
                updatePlacedDialogTilesList();
                renderMap();
            }
        }

        function findDialogTileAt(x, y) {
            return placedDialogTiles.findIndex(t => t.x === x && t.y === y && t.mapName === currentMapName);
        }

        // ===== TEST MAP =====
        let testLogs = []; // Logs saved to localStorage for crash recovery

        function logTestEvent(msg, type = 'info') {
            const entry = { time: Date.now(), msg, type };
            testLogs.push(entry);
            localStorage.setItem('testGameCrashLog', JSON.stringify(testLogs));
            console.log('[TestMap]', msg);

            // Add to visible console
            const logsDiv = document.getElementById('testConsoleLogs');
            if (logsDiv) {
                const time = new Date().toLocaleTimeString();
                const div = document.createElement('div');
                div.className = type;
                div.innerHTML = '<span class="time">' + time + '</span>' + msg;
                logsDiv.appendChild(div);
                logsDiv.scrollTop = logsDiv.scrollHeight; // Auto-scroll
            }
        }

        function openTestConsole() {
            const console = document.getElementById('testConsole');
            const logsDiv = document.getElementById('testConsoleLogs');
            if (console) console.classList.add('visible');
            if (logsDiv) logsDiv.innerHTML = ''; // Clear previous logs
        }

        function testMap() {
            if (typeof stopLandingTheme === 'function') stopLandingTheme(); // game launching — fade menu theme
            // Open visible console and clear previous logs (skip on the public join path).
            if (!window.__joinMode) openTestConsole();
            testLogs = [];
            logTestEvent('Starting test game...');

            // Get project data. When joining a live room (mobile "join the world"), use the
            // world snapshot received over the network; otherwise build it from the local editor.
            const projectDataForTest = (window.__joinMode && window.__joinWorld) ? window.__joinWorld : getProjectData();
            // Add base URL so external doors can resolve relative paths
            projectDataForTest.baseUrl = window.location.href.replace(/\/[^\/]*$/, '/');
            if (launchAsAdventure) {
                projectDataForTest.autoHideUI = true;
            }
            // Add multiplayer settings if set
            if (multiplayerSettings) {
                projectDataForTest.multiplayer = {
                    playerName: multiplayerSettings.playerName,
                    roomCode: multiplayerSettings.roomCode
                };
                logTestEvent('Multiplayer: ' + multiplayerSettings.playerName + ' in room ' + multiplayerSettings.roomCode);
            }
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

            logTestEvent('Mobile: ' + isMobile + ', Sounds: ' + (projectDataForTest.sounds?.length || 0));

            // On mobile, strip sound data - will stream via postMessage.
            // Skip in join mode: the network world already has audio stripped (silent for v1).
            let soundsToStream = [];
            if (!window.__joinMode && isMobile && projectDataForTest.sounds && projectDataForTest.sounds.length > 0) {
                soundsToStream = projectDataForTest.sounds.map(s => ({ ...s }));
                projectDataForTest.sounds = projectDataForTest.sounds.map(s => ({
                    name: s.name, duration: s.duration, type: s.type
                }));
                projectDataForTest.soundsWillStream = true;
                logTestEvent('Stripped ' + soundsToStream.length + ' sounds for streaming');
            }

            const projectDataJSON = JSON.stringify(projectDataForTest);
            const dataSize = projectDataJSON.length;
            const sizeMB = (dataSize / 1000000).toFixed(1);
            logTestEvent('Project size: ' + sizeMB + 'MB');

            // Setup message listener for test game communication
            window.testGameData = { projectDataJSON, soundsToStream };
            window.onmessage = (e) => {
                if (e.data.type === 'log') {
                    logTestEvent('[Game] ' + e.data.msg, e.data.level || 'info');
                } else if (e.data.type === 'ready') {
                    logTestEvent('Test game ready, sending data...');
                    // Include room code so the engine can auto-join multiplayer.
                    const payload = { type: 'project-data', data: projectDataJSON };
                    if (window.__joinMode && window.__joinRoom) {
                        // Joining a live room: sync positions through the play party.
                        payload.autoMultiplayer = {
                            roomCode: window.__joinRoom,
                            playerName: window.__joinName || ('Viewer' + Math.floor(Math.random() * 1000)),
                            partyPath: 'parties/play'
                        };
                    } else if (builderConnected && builderRoomCode) {
                        payload.autoMultiplayer = {
                            roomCode: builderRoomCode,
                            playerName: builderPlayerName + '-tester'
                        };
                        // Also pass builder room for live sync of edits
                        payload.builderSync = {
                            roomCode: builderRoomCode
                        };
                    }
                    e.source.postMessage(payload, '*');
                    // Stream sounds with delay
                    if (soundsToStream.length > 0) {
                        streamSoundsToWindow(e.source, soundsToStream);
                    }
                }
            };

            logTestEvent('Opening test window...');

            // Create minimal loader HTML