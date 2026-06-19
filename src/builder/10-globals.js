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
