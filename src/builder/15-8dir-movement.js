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

        // Custom UI skins (builder doc). null slot = use the built-in default UI.
        // Each non-null slot: { spriteData:<base64 4096x256 16-frame strip>, frames, frameW, frameH, fps, _img:Image }
        // questLogPanel also carries textBox:{x,y,w,h} (256-space) = where quest text renders over the art.
        // _img is runtime-only and MUST be stripped on serialize (see serializeUiConfig).
        let uiConfig = defaultUiConfig();
        function defaultUiConfig() {
            return {
                questLogButton: null,
                questLogPanel:  null,
                hotbar:         null,   // scaffolded — renders default until sprites added
                inventory:      null    // scaffolded — renders default until sprites added
            };
        }

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
