            const loaderHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Map Test</title>
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; }
        body { background: #000; overflow: hidden; }
        canvas { display: block; }
        #info {
            position: fixed;
            top: 10px;
            left: 10px;
            color: white;
            font-family: monospace;
            font-size: 12px;
            background: rgba(0,0,0,0.7);
            padding: 10px;
            border-radius: 5px;
        }
        #debugPanel {
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.85);
            padding: 15px;
            border-radius: 8px;
            color: white;
            font-family: monospace;
            font-size: 12px;
            min-width: 200px;
            display: none;
        }
        #debugPanel.visible { display: block; }
        #debugPanel h3 { margin: 0 0 10px 0; color: #4af; font-size: 14px; }
        #debugPanel label { display: block; margin: 8px 0 4px 0; color: #aaa; }
        #debugPanel input[type="range"] { width: 100%; }
        #debugPanel .value { color: #4f8; float: right; }
        #debugPanel button {
            margin-top: 10px;
            padding: 5px 10px;
            background: #4a7c59;
            border: none;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            width: 100%;
        }
        #debugPanel button:hover { background: #5a9c69; }

        /* Performance overlay */
        #perfPanel {
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0,0,0,0.85);
            padding: 10px 15px;
            border-radius: 8px;
            color: white;
            font-family: monospace;
            font-size: 11px;
            min-width: 180px;
            z-index: 1000;
            display: none;
            border: 1px solid #4af;
        }
        #perfPanel.visible { display: block; }
        #perfPanel h3 { margin: 0 0 8px 0; color: #4af; font-size: 12px; border-bottom: 1px solid #333; padding-bottom: 5px; }
        #perfPanel .perf-row { display: flex; justify-content: space-between; margin: 3px 0; }
        #perfPanel .perf-label { color: #aaa; }
        #perfPanel .perf-value { color: #4f8; font-weight: bold; }
        #perfPanel .perf-value.warning { color: #fa4; }
        #perfPanel .perf-value.critical { color: #f44; }
        #perfPanel .fps-graph { height: 30px; background: #222; margin-top: 8px; border-radius: 3px; overflow: hidden; display: flex; align-items: flex-end; }
        #perfPanel .fps-bar { width: 2px; margin-right: 1px; background: #4f8; transition: height 0.1s; }

        /* Debug log for iPad (no console) */
        #debugLog {
            position: fixed;
            bottom: 10px;
            left: 10px;
            right: 10px;
            max-height: 150px;
            overflow-y: auto;
            background: rgba(0,0,0,0.9);
            color: #0f0;
            font-family: monospace;
            font-size: 10px;
            padding: 8px;
            border-radius: 5px;
            display: none;
            z-index: 2000;
        }
        #debugLog.visible { display: block; }
        #debugLog .error { color: #f44; }
        #debugLog .warn { color: #fa0; }
        #toggleLogBtn {
            position: fixed;
            bottom: 170px;
            left: 10px;
            background: rgba(0,100,0,0.8);
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 2001;
        }

        /* Touch controls - Virtual Joystick */
        #touchControls {
            position: fixed;
            bottom: 30px;
            left: 30px;
            z-index: 1000;
            display: none;
        }
        @media (pointer: coarse), (max-width: 800px) {
            #touchControls { display: block; }
        }
        /* Left half touch zone for dynamic joystick */
        #leftTouchZone {
            position: fixed;
            left: 0;
            top: 0;
            width: 50%;
            height: 100%;
            z-index: 999;
            touch-action: none;
            display: none;
        }
        @media (pointer: coarse), (max-width: 800px) {
            #leftTouchZone { display: block; }
        }
        .joystick-base {
            width: 120px;
            height: 120px;
            background: rgba(255,255,255,0.15);
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            position: fixed;
            touch-action: none;
            display: none;
            pointer-events: none;
        }
        .joystick-base.active {
            display: block;
        }
        .joystick-thumb {
            width: 50px;
            height: 50px;
            background: rgba(255,255,255,0.5);
            border: 2px solid rgba(255,255,255,0.7);
            border-radius: 50%;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
        }
        .touch-actions {
            position: fixed;
            bottom: 50px;
            right: 30px;
        }
        .action-btn {
            width: 80px;
            height: 80px;
            background: rgba(255,100,100,0.3);
            border: 3px solid rgba(255,100,100,0.5);
            border-radius: 50%;
            font-size: 32px;
            color: white;
            cursor: pointer;
            touch-action: manipulation;
        }
        .action-btn:active { background: rgba(255,100,100,0.6); }

        /* Debug buttons */
        #debugButtons {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            display: flex;
            gap: 5px;
        }
        #debugButtons button {
            width: 40px;
            height: 40px;
            background: rgba(0,0,0,0.5);
            border: 1px solid #666;
            border-radius: 5px;
            color: white;
            font-size: 16px;
            cursor: pointer;
        }
        #debugButtons button:hover { background: rgba(100,100,100,0.7); }
        #debugButtons button.active { background: rgba(74,175,89,0.7); border-color: #4af; }

        /* Loading overlay - retro pixel style */
        #loadingOverlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            font-family: 'Press Start 2P', monospace;
            color: white;
        }
        #loadingOverlay.hidden { display: none; }
        #loadingText {
            font-size: 12px;
            color: #fff;
            margin-bottom: 20px;
            letter-spacing: 2px;
        }
        #loadingProgress {
            width: 200px;
            height: 16px;
            background: #000;
            border: 2px solid #fff;
            padding: 2px;
        }
        #loadingBar {
            width: 0%;
            height: 100%;
            background: #fff;
            transition: width 0.1s steps(20);
        }
        #loadingPercent {
            margin-top: 15px;
            font-size: 10px;
            color: #888;
        }
        @keyframes blink {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
        }
        .blink { animation: blink 1s step-end infinite; }
        /* 3D Interior styles */
        #interior3D canvas {
            display: block;
        }
        #exitButton3D {
            position: fixed;
            top: 20px;
            left: 20px;
            padding: 10px 20px;
            background: rgba(0,0,0,0.7);
            color: white;
            border: 2px solid #4af;
            border-radius: 5px;
            cursor: pointer;
            font-family: monospace;
            z-index: 600;
        }
        #exitButton3D:hover { background: rgba(50,100,150,0.8); }
        .hotspot-label {
            position: absolute;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 5px 10px;
            border-radius: 3px;
            font-family: monospace;
            font-size: 12px;
            pointer-events: none;
            transform: translate(-50%, -50%);
        }
    </style>
</head>
<body>
    <!-- Loading overlay shows immediately -->
    <div id="loadingOverlay">
        <div id="loadingText">LOADING</div>
        <div id="loadingProgress"><div id="loadingBar"></div></div>
        <div id="loadingPercent">0%</div>
        <div class="blink" style="margin-top:20px; font-size:8px;">PLEASE WAIT</div>
    </div>
    <canvas id="game"></canvas>
    <!-- 3D Interior container (hidden by default) -->
    <div id="interior3D" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; z-index:500;"></div>
    <div id="leftTouchZone"></div>
    <div class="joystick-base" id="joystickBase">
        <div class="joystick-thumb" id="joystickThumb"></div>
    </div>
    <div id="touchControls">
        <div class="touch-actions">
            <button class="action-btn" id="interactBtn">A</button>
            <button class="action-btn" id="attackBtn">⚔</button>
        </div>
    </div>
    <div id="debugButtons">
        <button onclick="toggleFullscreen()">⛶</button>
        <button onclick="toggleCollision()">C</button>
        <button onclick="toggleSoundDebug()">S</button>
        <button onclick="toggleDebugPanel()">P</button>
        <button onclick="toggleHitboxPanel()">ATK</button>
        <button onclick="togglePerfPanel()">FPS</button>
        <button onclick="hideAllUI()">H</button>
        <button onclick="closeGame()">✕</button>
    </div>
    <div id="info">Move: Arrows | Attack: SPACE | Interact: A</div>
    <!-- Game Over Overlay -->
    <div id="gameOverOverlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; justify-content:center; align-items:center; flex-direction:column;">
        <div style="text-align:center; font-family:'Press Start 2P', 'Courier New', monospace;">
            <h1 style="font-size:48px; color:#fff; text-shadow:4px 4px 0 #000; margin-bottom:40px; letter-spacing:8px;">GAME OVER</h1>
            <div style="display:flex; flex-direction:column; gap:20px;">
                <button onclick="tryAgain()" style="padding:15px 40px; font-size:18px; font-family:inherit; background:#444; color:#fff; border:3px solid #fff; cursor:pointer; letter-spacing:2px;">TRY AGAIN</button>
                <button onclick="quitGame()" style="padding:15px 40px; font-size:18px; font-family:inherit; background:#222; color:#888; border:3px solid #666; cursor:pointer; letter-spacing:2px;">QUIT</button>
            </div>
        </div>
    </div>
    <!-- Dialog Box -->
    <div id="dialogBox" style="display:none; position:fixed; bottom:60px; left:50%; transform:translateX(-50%); width:80%; max-width:500px; padding:20px; font-family:'Press Start 2P', monospace; font-size:12px; z-index:1000; image-rendering:pixelated;"></div>
    <!-- Quest Tracker HUD (Retro Style) -->
    <div id="questTracker" style="display:none; position:fixed; top:10px; right:10px; background:#000; border:3px solid #fff; padding:8px 12px; min-width:160px; max-width:220px; font-family:'Press Start 2P', monospace; color:#fff; z-index:100; cursor:pointer; image-rendering:pixelated;" onclick="toggleQuestLog()">
        <div id="questTrackerTitle" style="font-weight:bold; color:#fff; margin-bottom:6px; border-bottom:2px solid #fff; padding-bottom:4px; font-size:9px;"></div>
        <div id="questTrackerObjectives" style="font-size:8px; line-height:1.4;"></div>
    </div>
    <!-- Quest Log Popup (Retro Style) -->
    <div id="questLogPopup" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#000; border:4px solid #fff; padding:16px; min-width:280px; max-width:360px; max-height:70vh; overflow-y:auto; z-index:200; font-family:'Press Start 2P', monospace; image-rendering:pixelated;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:2px solid #fff; padding-bottom:8px;">
            <span style="color:#fff; font-weight:bold; font-size:10px;">QUEST LOG</span>
            <button onclick="toggleQuestLog()" style="background:none; border:2px solid #fff; color:#fff; font-size:12px; cursor:pointer; padding:2px 6px;">X</button>
        </div>
        <div id="questLogContent" style="font-size:8px; line-height:1.5;"></div>
    </div>
    <!-- Performance Panel -->
    <div id="perfPanel">
        <h3>⚡ Performance</h3>
        <div class="perf-row"><span class="perf-label">FPS:</span><span class="perf-value" id="perfFPS">60</span></div>
        <div class="perf-row"><span class="perf-label">Frame Time:</span><span class="perf-value" id="perfFrameTime">16.7ms</span></div>
        <div class="perf-row"><span class="perf-label">NPCs:</span><span class="perf-value" id="perfNPCs">0</span></div>
        <div class="perf-row"><span class="perf-label">Triggers:</span><span class="perf-value" id="perfTriggers">0</span></div>
        <div class="perf-row"><span class="perf-label">Lights:</span><span class="perf-value" id="perfLights">0</span></div>
        <div class="perf-row"><span class="perf-label">Layers:</span><span class="perf-value" id="perfLayers">0</span></div>
        <div class="fps-graph" id="fpsGraph"></div>
        <div style="margin-top:10px; display:flex; gap:5px;">
            <button id="recordNetBtn" onclick="toggleNetworkRecording()" style="flex:1; padding:5px; font-size:10px; background:#533; color:#fff; border:1px solid #755; border-radius:3px; cursor:pointer;">🔴 Record</button>
            <button id="copyNetBtn" onclick="copyNetworkLog()" style="flex:1; padding:5px; font-size:10px; background:#335; color:#fff; border:1px solid #557; border-radius:3px; cursor:pointer;" disabled>📋 Copy Log</button>
        </div>
        <div id="recordStatus" style="margin-top:5px; font-size:9px; color:#888;"></div>
    </div>
    <div id="debugPanel">
        <h3>Player Settings</h3>
        <label>Scale: <span class="value" id="scaleVal">1.7</span></label>
        <input type="range" id="scaleSlider" min="0.1" max="10" step="0.1" value="1.7">
        <label>Move Speed: <span class="value" id="speedVal">5.5</span></label>
        <input type="range" id="speedSlider" min="1" max="15" step="0.5" value="5.5">
        <label>Anim Speed: <span class="value" id="animVal">7</span></label>
        <input type="range" id="animSlider" min="1" max="20" step="1" value="7">
        <label>Hitbox Width: <span class="value" id="widthVal">28</span></label>
        <input type="range" id="widthSlider" min="10" max="60" step="2" value="28">
        <label>Hitbox Height: <span class="value" id="heightVal">76</span></label>
        <input type="range" id="heightSlider" min="20" max="100" step="2" value="76">
        <h3 style="margin-top:15px;">Camera</h3>
        <label>Zoom: <span class="value" id="zoomVal">0.9</span></label>
        <input type="range" id="zoomSlider" min="0.5" max="3" step="0.1" value="0.9">
        <h3 style="margin-top:15px;">Lighting</h3>
        <label>Darkness: <span class="value" id="darknessVal">0</span>%</label>
        <input type="range" id="darknessSlider" min="0" max="100" step="5" value="0">
        <label style="margin-top:10px;"><input type="checkbox" id="torchEnabled"> Player Torch</label>
        <label>Torch Radius: <span class="value" id="torchRadiusVal">4</span></label>
        <input type="range" id="torchRadiusSlider" min="1" max="15" step="1" value="4">
        <label style="margin-top:10px;"><input type="checkbox" id="cycleEnabled"> Enable Day/Night Cycle</label>
        <label>Cycle Time: <span class="value" id="dayLengthVal">1</span> min</label>
        <input type="range" id="dayLengthSlider" min="1" max="10" step="0.5" value="1">
        <div id="timeDisplay" style="color:#4f8;margin-top:5px;"></div>
        <h3 style="margin-top:15px;">Item Receive Display</h3>
        <label>Item Scale: <span class="value" id="itemScaleVal">2</span>x</label>
        <input type="range" id="itemScaleSlider" min="0.5" max="4" step="0.25" value="2">
        <label>Float Height: <span class="value" id="itemHeightVal">45</span>px</label>
        <input type="range" id="itemHeightSlider" min="-30" max="150" step="5" value="45">
        <label>Display Duration: <span class="value" id="itemDurationVal">2</span>s</label>
        <input type="range" id="itemDurationSlider" min="0.5" max="5" step="0.25" value="2">
        <label>Final Frame Pause: <span class="value" id="itemPauseVal">1</span>s</label>
        <input type="range" id="itemPauseSlider" min="0" max="3" step="0.25" value="1">
        <button onclick="copySettings()">Copy Settings</button>
    </div>
    <div id="hitboxPanel" style="display:none; position:fixed; top:60px; left:10px; background:rgba(20,20,40,0.95); padding:12px; border-radius:8px; font-size:10px; color:#fff; z-index:200; width:280px; border:2px solid #66f;">
        <h3 style="margin:0 0 10px 0; color:#88f;">Attack Hitbox (Per Direction)</h3>
        <div style="display:flex; gap:5px; margin-bottom:10px;">
            <button id="hitboxDirUp" onclick="setHitboxDir('up')" style="flex:1; padding:5px; font-size:10px;">↑ Up</button>
            <button id="hitboxDirDown" onclick="setHitboxDir('down')" class="active" style="flex:1; padding:5px; font-size:10px; background:#66f;">↓ Down</button>
            <button id="hitboxDirLeft" onclick="setHitboxDir('left')" style="flex:1; padding:5px; font-size:10px;">← Left</button>
            <button id="hitboxDirRight" onclick="setHitboxDir('right')" style="flex:1; padding:5px; font-size:10px;">→ Right</button>
        </div>
        <div style="background:rgba(0,0,0,0.3); padding:8px; border-radius:4px;">
            <label>Range: <span class="value" id="hbRangeVal">40</span>px</label>
            <input type="range" id="hbRangeSlider" min="10" max="120" step="5" value="40" style="width:100%;">
            <label>Width: <span class="value" id="hbWidthVal">60</span>°</label>
            <input type="range" id="hbWidthSlider" min="20" max="180" step="5" value="60" style="width:100%;">
            <label>Offset X: <span class="value" id="hbOffsetXVal">0</span>px</label>
            <input type="range" id="hbOffsetXSlider" min="-50" max="50" step="5" value="0" style="width:100%;">
            <label>Offset Y: <span class="value" id="hbOffsetYVal">0</span>px</label>
            <input type="range" id="hbOffsetYSlider" min="-50" max="50" step="5" value="0" style="width:100%;">
        </div>
        <div style="margin-top:8px; display:flex; gap:5px;">
            <button onclick="copyAllHitboxFromDir()" style="flex:1; padding:5px; font-size:9px; background:#484;">Copy to All</button>
            <button onclick="copyHitboxSettings()" style="flex:1; padding:5px; font-size:9px; background:#448;">Copy JSON</button>
        </div>
        <h3 style="margin:12px 0 8px 0; color:#fa0;">Attack Slide</h3>
        <div style="background:rgba(0,0,0,0.3); padding:8px; border-radius:4px;">
            <label>Slide Amount: <span class="value" id="slideAmountVal">50</span>%</label>
            <input type="range" id="slideAmountSlider" min="0" max="100" step="5" value="50" style="width:100%;">
            <label>Slide Duration: <span class="value" id="slideDurationVal">30</span> frames</label>
            <input type="range" id="slideDurationSlider" min="5" max="60" step="5" value="30" style="width:100%;">
        </div>
        <p style="font-size:8px; color:#888; margin:8px 0 0 0;">Blue=preview, Magenta=active hit. Press C to show.</p>
    </div>
    <button id="toggleLogBtn" onclick="toggleDebugLog()">Show Log</button>
    <div id="debugLog"></div>
    <script>
        // Debug log for iPad (captures console output)
        const debugLogEl = document.getElementById('debugLog');
        let debugLogVisible = false;

        function toggleDebugLog() {
            debugLogVisible = !debugLogVisible;
            debugLogEl.classList.toggle('visible', debugLogVisible);
            document.getElementById('toggleLogBtn').textContent = debugLogVisible ? 'Hide Log' : 'Show Log';
        }

        function logToScreen(msg, type = 'log') {
            const line = document.createElement('div');
            line.className = type;
            line.textContent = new Date().toLocaleTimeString() + ' ' + msg;
            debugLogEl.appendChild(line);
            debugLogEl.scrollTop = debugLogEl.scrollHeight;
            // Keep only last 50 lines
            while (debugLogEl.children.length > 50) {
                debugLogEl.removeChild(debugLogEl.firstChild);
            }
        }

        // Capture console methods
        const origLog = console.log;
        const origWarn = console.warn;
        const origError = console.error;
        console.log = (...args) => { origLog(...args); logToScreen(args.join(' '), 'log'); };
        console.warn = (...args) => { origWarn(...args); logToScreen(args.join(' '), 'warn'); };
        console.error = (...args) => { origError(...args); logToScreen(args.join(' '), 'error'); };

        // Capture uncaught errors
        window.onerror = (msg, url, line, col, error) => {
            logToScreen('ERROR: ' + msg + ' at line ' + line, 'error');
        };
        window.onunhandledrejection = (e) => {
            logToScreen('PROMISE ERROR: ' + e.reason, 'error');
        };

        logToScreen('Debug log initialized');
    <\/script>
    <script>
        const canvas = document.getElementById('game');
        const ctx = canvas.getContext('2d');

        // Fullscreen canvas
        function resizeCanvas() {
            // Prefer the visualViewport (the actually-visible area) so the game fits even when iOS
            // Safari's toolbar is showing — otherwise bottom controls get cut off.
            const vv = window.visualViewport;
            const cssW = Math.round((vv && vv.width) || window.innerWidth);
            const cssH = Math.round((vv && vv.height) || window.innerHeight);
            const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (mobile && cssH > 0) {
                // Render at INTEGER scale (cameraZoom stays 1) into a backing store sized to show a
                // fixed number of tiles, then let CSS downscale the finished frame ONCE. This avoids
                // fractional tile positions entirely → no tile tearing. (Assumes gridSize 16 = 64px tiles.)
                const TILES_HIGH = 11, TILE_PX = 64;
                const backingH = TILES_HIGH * TILE_PX;
                const backingW = Math.max(1, Math.round(backingH * cssW / cssH));
                canvas.width = backingW;
                canvas.height = backingH;
                canvas.style.width = cssW + 'px';
                canvas.style.height = cssH + 'px';
            } else {
                canvas.width = cssW;
                canvas.height = cssH;
                canvas.style.width = '';
                canvas.style.height = '';
            }
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        // Re-fit when Safari shows/hides its toolbar (fires visualViewport resize, not window resize).
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', resizeCanvas);
            window.visualViewport.addEventListener('scroll', resizeCanvas);
        }
        // Mobile rotation: the 'resize' event can fire with stale dimensions, so resize again
        // shortly after the orientation settles (zoom re-adapts per-frame in the camera update).
        window.addEventListener('orientationchange', () => { setTimeout(resizeCanvas, 150); setTimeout(resizeCanvas, 400); });

        // Show loading message with percentage - updates HTML overlay
        function showLoading(current, total) {
            const percent = total > 0 ? Math.round((current / total) * 100) : 0;

            // Update HTML loading overlay (visible immediately)
            const loadingBar = document.getElementById('loadingBar');
            const loadingPercent = document.getElementById('loadingPercent');
            const loadingText = document.getElementById('loadingText');
            if (loadingBar) loadingBar.style.width = percent + '%';
            if (loadingPercent) loadingPercent.textContent = current + '/' + total + ' (' + percent + '%)';
            if (loadingText && current > 0) loadingText.textContent = 'Loading Assets...';
        }

        // Hide loading overlay when game starts
        function hideLoading() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) overlay.classList.add('hidden');
        }

        showLoading(0, 1);

        // Load project data via postMessage from opener window
        let projectData = null;
        let builderSyncSocket = null;
        let liveSyncNeedsRedraw = false;

        // Declare game state variables at outer scope so applyLiveEdit can access them
        let layers = [];
        let mapRows = 30;
        let mapCols = 40;
        let tileCollisions = {};
        let collisionMasks = {};
        let tileSplitLines = {};
        let tileSplitLineFlipped = {};
        let placedNpcs = [];
        let placedTriggers = [];
        let pointLights = {};
        let polyLights = [];
        let tileSounds = {};
        let cameraBounds = null;
        let currentGameMap = 'main';

        // Animated tile registry - caches locations of animated tiles for performance
        let animatedTileRegistry = [];

        // ===== QUEST SYSTEM RUNTIME =====
        let quests = [];  // Loaded from projectData
        let questSoundsData = [];  // Quest sounds library
        let playerInventory = {};  // { [itemId]: quantity }
        // Hoisted to top-level (was declared inside initGame) so the quest-condition functions
        // defined above initGame (hasInventoryItem/isConditionMet) can read the real inventory.
        // initGame assigns to these (no re-declaration) so all runtime code shares one instance.
        let itemsData = [];          // runtime item definitions (projectData.items)
        let inventorySlots = [];     // Array of { itemIndex, quantity } or null — the REAL inventory
        let gameProgress = {
            npcsSpokenTo: {},       // { [npcUid]: true }
            enemiesDefeated: {},    // { [npcUid]: count }
            locationsVisited: {},   // { [mapName]: true }
            questStates: {}         // { [questId]: { status } }
        };
        const QUEST_STATUS = {
            LOCKED: 'locked',
            AVAILABLE: 'available',
            ACTIVE: 'active',
            COMPLETED: 'completed'
        };

        // NPC data for live sync
        let npcs = [];
        let npcImages = [];
        let npcRuntimeState = [];
        let gridSize = 16; // Will be set from projectData

        // Live sync: Connect to builder WebSocket to receive real-time edits
        function connectToBuilderSync(roomCode) {
            const wsUrl = 'wss://multiplayer.lakotafox.partykit.dev/parties/builder/' + roomCode;
            console.log('[LIVE SYNC] Connecting to builder room:', roomCode);

            builderSyncSocket = new WebSocket(wsUrl);

            builderSyncSocket.onopen = () => {
                console.log('[LIVE SYNC] Connected to builder!');
                // Join as observer (don't send edits, just receive)
                builderSyncSocket.send(JSON.stringify({
                    type: 'join',
                    name: 'TestGame-Observer',
                    gameType: 'test-observer'
                }));
            };

            builderSyncSocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    logNetworkEvent(data.editType || data.type || 'builderEdit', 'recv-builder', data, event.data.length);
                    if (data.type === 'builderEdit' || data.editType) {
                        applyLiveEdit(data);
                    }
                } catch (e) {
                    console.error('[LIVE SYNC] Parse error:', e);
                }
            };

            builderSyncSocket.onclose = () => {
                console.log('[LIVE SYNC] Disconnected from builder');
                // Reconnect after delay
                setTimeout(() => connectToBuilderSync(roomCode), 3000);
            };

            builderSyncSocket.onerror = (err) => {
                console.error('[LIVE SYNC] WebSocket error:', err);
            };
        }

        // Apply incoming edits from builder to live game state
        // fromMultiplayer = true means this edit came from another player, don't relay it again
        function applyLiveEdit(edit, fromMultiplayer = false) {
            // Handle batch edits
            if (edit.editType === 'batch' && edit.edits) {
                edit.edits.forEach(e => applyLiveEdit(e, fromMultiplayer));
                return;
            }

            const editType = edit.editType;

            // Skip non-edit messages
            if (!editType) return;

            console.log('[LIVE SYNC] Applying:', editType, fromMultiplayer ? '(from MP)' : '(from builder)');

            // Relay builder edits to other multiplayer players
            if (!fromMultiplayer && typeof mpSocket !== 'undefined' && mpSocket && mpConnected) {
                mpSocket.send(JSON.stringify({
                    type: 'builderEdit',
                    edit: edit
                }));
            }

            // Get current map name (test game uses currentGameMap)
            const gameMapName = (typeof currentGameMap !== 'undefined') ? currentGameMap : 'main';

            switch (editType) {
                case 'tile':
                    // Update tile in the current map
                    if (edit.mapName === gameMapName || !edit.mapName) {
                        if (!layers[edit.layer]) layers[edit.layer] = [];
                        if (!layers[edit.layer][edit.y]) layers[edit.layer][edit.y] = [];
                        layers[edit.layer][edit.y][edit.x] = edit.cell;
                        liveSyncNeedsRedraw = true;
                        // Update animated tile registry if this is an origin animTile
                        if (edit.cell && edit.cell.type === 'animTile' &&
                            ((edit.cell.offsetX || 0) === 0 && (edit.cell.offsetY || 0) === 0)) {
                            // Add to registry if not already there
                            const exists = animatedTileRegistry.some(e =>
                                e.li === edit.layer && e.x === edit.x && e.y === edit.y);
                            if (!exists) {
                                animatedTileRegistry.push({ li: edit.layer, x: edit.x, y: edit.y });
                            }
                        }
                    }
                    break;

                case 'eraseTile':
                    if (edit.mapName === gameMapName || !edit.mapName) {
                        if (layers[edit.layer] && layers[edit.layer][edit.y]) {
                            // Remove from animated tile registry if it was an animTile
                            const oldCell = layers[edit.layer][edit.y][edit.x];
                            if (oldCell && oldCell.type === 'animTile') {
                                animatedTileRegistry = animatedTileRegistry.filter(e =>
                                    !(e.li === edit.layer && e.x === edit.x && e.y === edit.y));
                            }
                            layers[edit.layer][edit.y][edit.x] = null;
                            liveSyncNeedsRedraw = true;
                        }
                    }
                    break;

                case 'collision':
                    if (edit.value) {
                        tileCollisions[edit.key] = true;
                    } else {
                        delete tileCollisions[edit.key];
                    }
                    break;

                case 'collisionMask':
                    collisionMasks[edit.key] = edit.mask;
                    break;

                case 'placeNpc':
                    if (typeof placedNpcs !== 'undefined' && edit.npc) {
                        placedNpcs.push(edit.npc);
                        // Create runtime state for new NPC
                        if (typeof createNpcRuntimeState === 'function') {
                            npcRuntimeState.push(createNpcRuntimeState(edit.npc));
                        }
                        console.log('[LIVE SYNC] Added NPC at', edit.npc.x, edit.npc.y);
                    }
                    break;

                case 'removeNpc':
                    if (typeof placedNpcs !== 'undefined' && edit.index >= 0 && edit.index < placedNpcs.length) {
                        placedNpcs.splice(edit.index, 1);
                        // Remove runtime state
                        if (npcRuntimeState && edit.index < npcRuntimeState.length) {
                            npcRuntimeState.splice(edit.index, 1);
                        }
                        console.log('[LIVE SYNC] Removed NPC at index', edit.index);
                    }
                    break;

                case 'updateNpc':
                    // NPC definition updated (template, not placed instance)
                    if (typeof npcs !== 'undefined' && edit.index >= 0 && edit.index < npcs.length && edit.npc) {
                        npcs[edit.index] = edit.npc;
                        // Reload sprite image if changed
                        if (edit.npc.spriteData && npcImages) {
                            const img = new Image();
                            img.src = edit.npc.spriteData;
                            npcImages[edit.index] = img;
                        }
                        console.log('[LIVE SYNC] Updated NPC definition:', edit.npc.name);
                    }
                    break;

                case 'addNpc':
                    // NPC definition added (not placed NPC)
                    if (typeof npcs !== 'undefined' && edit.npc) {
                        npcs.push(edit.npc);
                        // Load sprite image
                        if (edit.npc.spriteData) {
                            const img = new Image();
                            img.src = edit.npc.spriteData;
                            npcImages.push(img);
                        }
                        console.log('[LIVE SYNC] Added NPC definition:', edit.npc.name);
                    }
                    break;

                case 'updatePlacedNpc':
                    // Update placed NPC settings (including enemy AI)
                    if (typeof placedNpcs !== 'undefined' && edit.index >= 0 && edit.index < placedNpcs.length && edit.npc) {
                        // Preserve position but update all other settings
                        const oldPlaced = placedNpcs[edit.index];
                        placedNpcs[edit.index] = edit.npc;
                        // Update runtime state with new enemy settings
                        if (npcRuntimeState && npcRuntimeState[edit.index]) {
                            const state = npcRuntimeState[edit.index];
                            // Initialize enemy AI state if becoming an enemy
                            if (edit.npc.isEnemy && !state.aiState) {
                                state.aiState = 'idle';
                                state.aggroTimer = 0;
                                state.attackCooldown = 0;
                                state.returnX = state.x;
                                state.returnY = state.y;
                            }
                        }
                        console.log('[LIVE SYNC] Updated placed NPC at index', edit.index, 'isEnemy:', edit.npc.isEnemy);
                    }
                    break;

                case 'placeTrigger':
                    if (typeof placedTriggers !== 'undefined' && edit.trigger) {
                        placedTriggers.push(edit.trigger);
                        console.log('[LIVE SYNC] Added trigger:', edit.trigger.type, 'at', edit.trigger.x, edit.trigger.y);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'removeTrigger': {
                    // Wave 7: UID-preferred lookup in the test-game runtime.
                    if (typeof placedTriggers === 'undefined' || !Array.isArray(placedTriggers)) break;
                    let idx = -1;
                    if (edit.uid) idx = placedTriggers.findIndex(t => t && t.uid === edit.uid);
                    if (idx < 0 && typeof edit.index === 'number' && edit.index >= 0 && edit.index < placedTriggers.length) idx = edit.index;
                    if (idx >= 0) {
                        placedTriggers.splice(idx, 1);
                        console.log('[LIVE SYNC] Removed trigger at', idx);
                        liveSyncNeedsRedraw = true;
                    }
                    break;
                }

                case 'updateTrigger': {
                    if (typeof placedTriggers === 'undefined' || !Array.isArray(placedTriggers) || !edit.trigger) break;
                    let idx = -1;
                    if (edit.uid) idx = placedTriggers.findIndex(t => t && t.uid === edit.uid);
                    if (idx < 0 && edit.trigger.uid) idx = placedTriggers.findIndex(t => t && t.uid === edit.trigger.uid);
                    if (idx < 0 && typeof edit.index === 'number' && edit.index >= 0 && edit.index < placedTriggers.length) idx = edit.index;
                    if (idx >= 0) {
                        placedTriggers[idx] = edit.trigger;
                        console.log('[LIVE SYNC] Updated trigger at', idx);
                        liveSyncNeedsRedraw = true;
                    }
                    break;
                }

                case 'light':
                    if (typeof pointLights !== 'undefined' && edit.light) {
                        pointLights[edit.key] = edit.light;
                        console.log('[LIVE SYNC] Added/updated light:', edit.key);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'removeLight':
                    if (typeof pointLights !== 'undefined') {
                        delete pointLights[edit.key];
                        console.log('[LIVE SYNC] Removed light:', edit.key);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'addPolyLight':
                    if (typeof polyLights !== 'undefined' && edit.light) {
                        polyLights.push(edit.light);
                        console.log('[LIVE SYNC] Added polygon light:', edit.light.id);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'removePolyLight':
                    if (typeof polyLights !== 'undefined') {
                        const idx = polyLights.findIndex(pl => pl.id === edit.lightId);
                        if (idx >= 0) {
                            polyLights.splice(idx, 1);
                            console.log('[LIVE SYNC] Removed polygon light:', edit.lightId);
                            liveSyncNeedsRedraw = true;
                        }
                    }
                    break;

                case 'tileSound':
                    if (typeof tileSounds !== 'undefined' && edit.sound) {
                        tileSounds[edit.key] = edit.sound;
                        console.log('[LIVE SYNC] Added tile sound:', edit.key);
                    }
                    break;

                case 'removeTileSound':
                    if (typeof tileSounds !== 'undefined') {
                        delete tileSounds[edit.key];
                        console.log('[LIVE SYNC] Removed tile sound:', edit.key);
                    }
                    break;

                case 'updatePlacedAnimProp':
                    // Update placed anim prop (e.g., instance item override)
                    if (typeof placedAnimPropsData !== 'undefined' && edit.index >= 0 && edit.index < placedAnimPropsData.length) {
                        placedAnimPropsData[edit.index] = edit.prop;
                        console.log('[LIVE SYNC] Updated placed anim prop at index', edit.index);
                    }
                    break;

                case 'cameraBounds':
                    if (typeof cameraBounds !== 'undefined' && (edit.mapName === gameMapName || !edit.mapName)) {
                        cameraBounds = edit.bounds;
                        console.log('[LIVE SYNC] Updated camera bounds');
                    }
                    break;

                case 'splitLine':
                    if (typeof tileSplitLines !== 'undefined') {
                        tileSplitLines[edit.key] = edit.mask;
                        console.log('[LIVE SYNC] Added split line:', edit.key);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'clearSplitLine':
                    if (typeof tileSplitLines !== 'undefined') {
                        delete tileSplitLines[edit.key];
                        delete tileSplitLineFlipped[edit.key];
                        console.log('[LIVE SYNC] Cleared split line:', edit.key);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'splitLineFlip':
                    if (typeof tileSplitLineFlipped !== 'undefined') {
                        if (edit.flipped) {
                            tileSplitLineFlipped[edit.key] = true;
                        } else {
                            delete tileSplitLineFlipped[edit.key];
                        }
                        console.log('[LIVE SYNC] Split line flip:', edit.key, edit.flipped);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'addLayer':
                    if (edit.mapName === gameMapName || !edit.mapName) {
                        layers.push([]);
                        for (let y = 0; y < mapRows; y++) {
                            layers[layers.length - 1][y] = [];
                            for (let x = 0; x < mapCols; x++) {
                                layers[layers.length - 1][y][x] = null;
                            }
                        }
                    }
                    break;

                case 'deleteLayer':
                    if (edit.mapName === gameMapName || !edit.mapName) {
                        if (edit.index >= 0 && edit.index < layers.length) {
                            layers.splice(edit.index, 1);
                            liveSyncNeedsRedraw = true;
                        }
                    }
                    break;

                case 'clearMap':
                    if (edit.mapName === gameMapName || !edit.mapName) {
                        layers.forEach((layer, i) => {
                            layers[i] = [];
                            for (let y = 0; y < mapRows; y++) {
                                layers[i][y] = [];
                                for (let x = 0; x < mapCols; x++) {
                                    layers[i][y][x] = null;
                                }
                            }
                        });
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'placeStaticObj':
                    // Place new static object
                    if (edit.placed && typeof placedStaticObjectsData !== 'undefined') {
                        placedStaticObjectsData.push(edit.placed);
                        console.log('[LIVE SYNC] Placed static object at', edit.placed.x, edit.placed.y);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'removeStaticObjPlacement':
                    // Remove static object placement
                    if (typeof placedStaticObjectsData !== 'undefined') {
                        const beforeLen = placedStaticObjectsData.length;
                        for (let i = placedStaticObjectsData.length - 1; i >= 0; i--) {
                            const p = placedStaticObjectsData[i];
                            if (p.x === edit.x && p.y === edit.y && p.mapName === edit.mapName) {
                                placedStaticObjectsData.splice(i, 1);
                                break;
                            }
                        }
                        if (placedStaticObjectsData.length < beforeLen) {
                            console.log('[LIVE SYNC] Removed static object at', edit.x, edit.y);
                            liveSyncNeedsRedraw = true;
                        }
                    }
                    break;

                case 'updateStaticObjCollision':
                    // Update static object collision box
                    if (typeof placedStaticObjectsData !== 'undefined' && edit.index >= 0 && edit.index < placedStaticObjectsData.length) {
                        placedStaticObjectsData[edit.index].collisionBox = edit.collisionBox;
                        console.log('[LIVE SYNC] Updated static object collision at index', edit.index);
                    }
                    break;

                // ===== Wave 6: test-game live-sync hardening =====
                case 'renameMap': {
                    // Critical: trigger routing breaks mid-test if maps get renamed without this.
                    const oldName = edit.oldName, newName = edit.newName;
                    if (!oldName || !newName) break;
                    if (typeof mapsData !== 'undefined' && mapsData[oldName]) {
                        mapsData[newName] = mapsData[oldName];
                        delete mapsData[oldName];
                    }
                    if (typeof placedTriggersData !== 'undefined' && Array.isArray(placedTriggersData)) {
                        for (const t of placedTriggersData) {
                            if (t && t.mapName === oldName) t.mapName = newName;
                            if (t && t.targetMap === oldName) t.targetMap = newName;
                        }
                    }
                    const arrs = ['placedNpcsData','placedItemsData','placedDialogTilesData','placedAnimPropsData','placedStaticObjectsData','placedShopsData'];
                    for (const name of arrs) {
                        try { const a = eval(name);
                            if (Array.isArray(a)) for (const e of a) { if (e && e.mapName === oldName) e.mapName = newName; }
                        } catch(_){}
                    }
                    if (typeof tileSoundsData !== 'undefined' && tileSoundsData) {
                        const oldP = oldName + ':', newP = newName + ':';
                        for (const k of Object.keys(tileSoundsData)) {
                            if (k.startsWith(oldP)) { tileSoundsData[newP + k.slice(oldP.length)] = tileSoundsData[k]; delete tileSoundsData[k]; }
                        }
                    }
                    if (typeof pointLightsData !== 'undefined' && pointLightsData) {
                        const oldP = oldName + ':', newP = newName + ':';
                        for (const k of Object.keys(pointLightsData)) {
                            if (k.startsWith(oldP)) { pointLightsData[newP + k.slice(oldP.length)] = pointLightsData[k]; delete pointLightsData[k]; }
                        }
                    }
                    if (typeof currentGameMap !== 'undefined' && currentGameMap === oldName) currentGameMap = newName;
                    if (typeof spawnMapName !== 'undefined' && spawnMapName === oldName) spawnMapName = newName;
                    liveSyncNeedsRedraw = true;
                    console.log('[LIVE SYNC] renameMap:', oldName, '->', newName);
                    break;
                }

                case 'setPlayerSpawn':
                    if (typeof edit.x === 'number' && typeof edit.y === 'number') {
                        if (typeof playerPreviewPos !== 'undefined') playerPreviewPos = { x: edit.x, y: edit.y };
                        if (edit.mapName && typeof spawnMapName !== 'undefined') spawnMapName = edit.mapName;
                        console.log('[LIVE SYNC] spawn updated (takes effect on next respawn/transition):', edit.mapName, edit.x, edit.y);
                    }
                    break;

                case 'lightingSettings':
                    if (edit.settings && typeof lightingSettingsData !== 'undefined') {
                        Object.assign(lightingSettingsData, edit.settings);
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'addSound':
                case 'removeSound':
                case 'setPlayerSound':
                    // Library mutations — touch the test-game's data copy if present.
                    if (edit.editType === 'addSound' && edit.sound && typeof soundsData !== 'undefined' && Array.isArray(soundsData)) {
                        const insertIdx = (typeof edit.index === 'number') ? edit.index : soundsData.length;
                        soundsData[insertIdx] = {
                            name: edit.sound.name, data: edit.sound.data,
                            duration: edit.sound.duration || 0, type: edit.sound.type || 'ambient'
                        };
                    } else if (edit.editType === 'removeSound' && typeof edit.index === 'number'
                               && typeof soundsData !== 'undefined' && Array.isArray(soundsData)
                               && edit.index >= 0 && edit.index < soundsData.length) {
                        soundsData.splice(edit.index, 1);
                        // Dangling-index repair on game side.
                        if (typeof tileSoundsData !== 'undefined' && tileSoundsData) {
                            for (const k of Object.keys(tileSoundsData)) {
                                const e = tileSoundsData[k];
                                if (!e) continue;
                                if (e.soundIndex === edit.index) delete tileSoundsData[k];
                                else if (e.soundIndex > edit.index) e.soundIndex--;
                            }
                        }
                        if (typeof playerSoundsData !== 'undefined' && playerSoundsData) {
                            for (const action of Object.keys(playerSoundsData)) {
                                const c = playerSoundsData[action];
                                if (c && typeof c.soundIndex === 'number') {
                                    if (c.soundIndex === edit.index) c.soundIndex = -1;
                                    else if (c.soundIndex > edit.index) c.soundIndex--;
                                }
                            }
                        }
                    } else if (edit.editType === 'setPlayerSound' && edit.action && edit.config
                               && typeof playerSoundsData !== 'undefined' && playerSoundsData) {
                        Object.assign(playerSoundsData[edit.action] || (playerSoundsData[edit.action] = {}), edit.config);
                    }
                    break;

                case 'addTileset':
                    if (edit.data && typeof tilesetImages !== 'undefined' && Array.isArray(tilesetImages)) {
                        const img = new Image();
                        img.onload = () => { tilesetImages.push(img); liveSyncNeedsRedraw = true; };
                        img.src = edit.data;
                    }
                    break;

                case 'deleteTileset':
                    if (typeof edit.index === 'number' && typeof tilesetImages !== 'undefined' && Array.isArray(tilesetImages)) {
                        tilesetImages.splice(edit.index, 1);
                        // Walk all layers across all maps — null cells whose tilesetIndex equals the deleted, decrement others.
                        if (typeof mapsData !== 'undefined' && mapsData) {
                            for (const mName of Object.keys(mapsData)) {
                                const md = mapsData[mName];
                                if (!md || !Array.isArray(md.layers)) continue;
                                for (const layer of md.layers) {
                                    if (!Array.isArray(layer)) continue;
                                    for (const row of layer) {
                                        if (!Array.isArray(row)) continue;
                                        for (let x = 0; x < row.length; x++) {
                                            const cell = row[x];
                                            if (!cell) continue;
                                            if (cell.tilesetIndex === edit.index) row[x] = null;
                                            else if (cell.tilesetIndex > edit.index) cell.tilesetIndex--;
                                        }
                                    }
                                }
                            }
                        }
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'moveLayerUp':
                case 'moveLayerDown': {
                    // Swap layers[i] with layers[i ± 1] on the current map only (test game viewport).
                    const delta = (edit.editType === 'moveLayerUp') ? -1 : 1;
                    const i = edit.index;
                    if (typeof layers !== 'undefined' && Array.isArray(layers)
                        && typeof i === 'number' && i + delta >= 0 && i + delta < layers.length) {
                        const tmp = layers[i]; layers[i] = layers[i + delta]; layers[i + delta] = tmp;
                        liveSyncNeedsRedraw = true;
                    }
                    break;
                }

                case 'expandMap': {
                    // Broadcasted by Wave 3 auto-expand. Extend mapCols/mapRows on the target map.
                    const mn = edit.mapName || (typeof currentGameMap !== 'undefined' ? currentGameMap : 'main');
                    const dir = edit.direction || 'bottom';
                    const amount = edit.amount || 10;
                    if (typeof mapsData !== 'undefined' && mapsData && mapsData[mn]) {
                        const md = mapsData[mn];
                        if (dir === 'bottom' && Array.isArray(md.layers)) {
                            md.mapRows = (md.mapRows || 0) + amount;
                            for (const layer of md.layers) {
                                if (!Array.isArray(layer)) continue;
                                while (layer.length < md.mapRows) layer.push(new Array(md.mapCols || 0).fill(null));
                            }
                        } else if (dir === 'right' && Array.isArray(md.layers)) {
                            md.mapCols = (md.mapCols || 0) + amount;
                            for (const layer of md.layers) {
                                if (!Array.isArray(layer)) continue;
                                for (const row of layer) { while (row && row.length < md.mapCols) row.push(null); }
                            }
                        }
                        if (mn === currentGameMap) {
                            if (typeof mapCols !== 'undefined') mapCols = md.mapCols;
                            if (typeof mapRows !== 'undefined') mapRows = md.mapRows;
                            if (typeof layers !== 'undefined') layers = md.layers;
                        }
                        liveSyncNeedsRedraw = true;
                    }
                    break;
                }

                case 'addStaticObj':
                    if (edit.obj && typeof staticObjectsData !== 'undefined' && Array.isArray(staticObjectsData)) {
                        const copy = { ...edit.obj };
                        const img = new Image();
                        img.onload = () => { copy._spriteImg = img; liveSyncNeedsRedraw = true; };
                        img.src = edit.obj.spriteData;
                        staticObjectsData.push(copy);
                    }
                    break;

                case 'removeStaticObj':
                    if (typeof edit.index === 'number'
                        && typeof staticObjectsData !== 'undefined' && Array.isArray(staticObjectsData)
                        && edit.index >= 0 && edit.index < staticObjectsData.length) {
                        staticObjectsData.splice(edit.index, 1);
                        if (typeof placedStaticObjectsData !== 'undefined' && Array.isArray(placedStaticObjectsData)) {
                            for (let j = placedStaticObjectsData.length - 1; j >= 0; j--) {
                                const p = placedStaticObjectsData[j];
                                if (!p) continue;
                                if (p.objIndex === edit.index) placedStaticObjectsData.splice(j, 1);
                                else if (p.objIndex > edit.index) p.objIndex--;
                            }
                        }
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'addAnimProp':
                    if (edit.prop && typeof animatedPropsData !== 'undefined' && Array.isArray(animatedPropsData)) {
                        animatedPropsData.push({ ...edit.prop });
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'updateAnimProp':
                    if (typeof edit.index === 'number' && edit.prop
                        && typeof animatedPropsData !== 'undefined' && Array.isArray(animatedPropsData)
                        && edit.index >= 0 && edit.index < animatedPropsData.length) {
                        animatedPropsData[edit.index] = { ...edit.prop };
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'removeAnimProp':
                    if (typeof edit.index === 'number'
                        && typeof animatedPropsData !== 'undefined' && Array.isArray(animatedPropsData)
                        && edit.index >= 0 && edit.index < animatedPropsData.length) {
                        animatedPropsData.splice(edit.index, 1);
                        // Walk map layers dropping/shifting animTile cells referencing the deleted index.
                        if (typeof mapsData !== 'undefined' && mapsData) {
                            for (const mn of Object.keys(mapsData)) {
                                const md = mapsData[mn];
                                if (!md || !Array.isArray(md.layers)) continue;
                                for (const layer of md.layers) {
                                    if (!Array.isArray(layer)) continue;
                                    for (const row of layer) {
                                        if (!Array.isArray(row)) continue;
                                        for (let x = 0; x < row.length; x++) {
                                            const cell = row[x];
                                            if (!cell || cell.type !== 'animTile') continue;
                                            if (cell.propIndex === edit.index) row[x] = null;
                                            else if (cell.propIndex > edit.index) cell.propIndex--;
                                        }
                                    }
                                }
                            }
                        }
                        liveSyncNeedsRedraw = true;
                    }
                    break;

                case 'addPlayerCharacter':
                case 'updatePlayerCharacter':
                case 'deletePlayerCharacter':
                case 'setActivePlayer':
                    // Player-character changes mid-test: stash on projectData so the next respawn picks them up.
                    // Hot-swapping the active player's sprite sheets mid-run is complex; CLAUDE.md policy note:
                    // acceptable gap, player sees change on respawn/map transition.
                    try {
                        if (edit.editType === 'addPlayerCharacter' && edit.character
                            && Array.isArray(projectData.playerCharacters)) {
                            projectData.playerCharacters.push({ ...edit.character });
                        } else if (edit.editType === 'updatePlayerCharacter' && typeof edit.index === 'number'
                                   && edit.character && Array.isArray(projectData.playerCharacters)
                                   && edit.index >= 0 && edit.index < projectData.playerCharacters.length) {
                            projectData.playerCharacters[edit.index] = { ...edit.character };
                        } else if (edit.editType === 'deletePlayerCharacter' && typeof edit.index === 'number'
                                   && Array.isArray(projectData.playerCharacters)
                                   && edit.index >= 0 && edit.index < projectData.playerCharacters.length) {
                            projectData.playerCharacters.splice(edit.index, 1);
                        } else if (edit.editType === 'setActivePlayer' && typeof edit.index === 'number') {
                            projectData.activePlayerIndex = edit.index;
                        }
                    } catch (_) {}
                    break;
                // ===== end Wave 6 additions =====

                default:
                    if (typeof edit.editType === 'string' && edit.editType.length) {
                        console.warn('[LIVE] unhandled editType:', edit.editType);
                    }
                    break;
            }
        }

        // Wait for data from builder via postMessage
        console.log('Waiting for project data from builder...');
        window.onmessage = function(e) {
            if (e.data.type === 'project-data') {
                console.log('Received project data');
                projectData = JSON.parse(e.data.data);
                // Check for auto-multiplayer from builder co-op
                if (e.data.autoMultiplayer) {
                    console.log('Auto-multiplayer enabled:', e.data.autoMultiplayer);
                    // Set multiplayer config so initGame connects automatically
                    projectData.multiplayer = {
                        playerName: e.data.autoMultiplayer.playerName,
                        roomCode: e.data.autoMultiplayer.roomCode
                    };
                }
                if (window.opener) {
                    window.opener.postMessage({ type: 'log', msg: 'Project data received, size: ' + e.data.data.length }, '*');
                }
                initGame();

                // Connect to builder for live sync of edits
                if (e.data.builderSync && e.data.builderSync.roomCode) {
                    setTimeout(() => connectToBuilderSync(e.data.builderSync.roomCode), 1000);
                }
            } else if (e.data.type === 'sound-data') {
                const { index, data, name } = e.data;
                if (projectData && projectData.sounds && projectData.sounds[index]) {
                    projectData.sounds[index].data = data;
                    console.log('Received sound', index, name);
                    if (window.opener) {
                        window.opener.postMessage({ type: 'log', msg: 'Sound received: ' + name }, '*');
                    }
                }
            } else if (e.data.type === 'builderEdit') {
                // Live edit from builder (solo mode - direct postMessage)
                if (e.data.edit && typeof applyLiveEdit === 'function') {
                    console.log('[LIVE SYNC] Received edit via postMessage');
                    applyLiveEdit(e.data.edit, false);
                }
            }
        };
        // Signal ready to host. Desktop test uses a popup (window.opener); the mobile
        // "join the live world" path runs this engine inside an in-page iframe, where the
        // host is window.parent. Fall back accordingly so the boot handshake fires either way.
        var __hostWin = window.opener || (window.parent && window.parent !== window ? window.parent : null);
        if (__hostWin) {
            __hostWin.postMessage({ type: 'ready' }, '*');
        } else {
            console.error('No host window found!');
        }

        // Debug/UI functions (must be global for onclick handlers)
        let showCollision = false;
        let showSounds = false;

        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.log('Fullscreen error:', err);
                });
            } else {
                document.exitFullscreen();
            }
        }
        function toggleCollision() {
            showCollision = !showCollision;
            document.querySelectorAll('#debugButtons button')[1].classList.toggle('active', showCollision);
        }
        function toggleSoundDebug() {
            showSounds = !showSounds;
            document.querySelectorAll('#debugButtons button')[2].classList.toggle('active', showSounds);
        }
        function toggleDebugPanel() {
            const panel = document.getElementById('debugPanel');
            panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
            document.querySelectorAll('#debugButtons button')[3].classList.toggle('active', panel.style.display === 'block');
        }

        // Performance panel
        let perfPanelVisible = false;
        let fpsHistory = [];
        const FPS_HISTORY_SIZE = 60;
        function togglePerfPanel() {
            perfPanelVisible = !perfPanelVisible;
            const panel = document.getElementById('perfPanel');
            panel.style.display = perfPanelVisible ? 'block' : 'none';
            document.querySelectorAll('#debugButtons button')[5].classList.toggle('active', perfPanelVisible);
            if (perfPanelVisible) {
                // Initialize FPS graph bars
                const graph = document.getElementById('fpsGraph');
                graph.innerHTML = '';
                for (let i = 0; i < FPS_HISTORY_SIZE; i++) {
                    const bar = document.createElement('div');
                    bar.className = 'fps-bar';
                    bar.style.height = '0px';
                    graph.appendChild(bar);
                }
            }
        }

        // Network recording for debugging freezes
        let networkRecording = false;
        let networkLog = [];
        let frameTimeLog = [];
        let perfLog = [];  // Detailed per-frame performance breakdown
        let recordStartTime = 0;
        const MAX_LOG_ENTRIES = 500;
        const MAX_PERF_ENTRIES = 300;  // ~5 seconds at 60fps

        function toggleNetworkRecording() {
            networkRecording = !networkRecording;
            const btn = document.getElementById('recordNetBtn');
            const copyBtn = document.getElementById('copyNetBtn');
            const status = document.getElementById('recordStatus');

            if (networkRecording) {
                // Start recording
                networkLog = [];
                frameTimeLog = [];
                perfLog = [];
                recordStartTime = performance.now();
                btn.textContent = '⏹ Stop';
                btn.style.background = '#a33';
                copyBtn.disabled = true;
                status.textContent = 'Recording... (0 frames)';
                status.style.color = '#f88';
            } else {
                // Stop recording
                btn.textContent = '🔴 Record';
                btn.style.background = '#533';
                copyBtn.disabled = false;
                const avgFps = perfLog.length > 0 ? Math.round(perfLog.reduce((a, b) => a + b.fps, 0) / perfLog.length) : 0;
                status.textContent = perfLog.length + ' frames, avg ' + avgFps + ' FPS';
                status.style.color = '#8f8';
            }
        }

        function logNetworkEvent(type, direction, data, size) {
            if (!networkRecording) return;
            if (networkLog.length >= MAX_LOG_ENTRIES) return;

            const now = performance.now();
            const elapsed = now - recordStartTime;

            networkLog.push({
                t: elapsed.toFixed(1),
                type: type,
                dir: direction,
                size: size || 0,
                data: typeof data === 'string' ? data.substring(0, 100) : JSON.stringify(data).substring(0, 100)
            });

            const status = document.getElementById('recordStatus');
            if (status) status.textContent = 'Recording... (' + networkLog.length + ' events)';
        }

        function logFrameTime(frameTime, fps) {
            if (!networkRecording) return;
            if (frameTimeLog.length >= MAX_LOG_ENTRIES * 2) return;

            const now = performance.now();
            const elapsed = now - recordStartTime;

            // Only log if frame time is high (potential freeze)
            if (frameTime > 20) { // More than 20ms = potential issue
                frameTimeLog.push({
                    t: elapsed.toFixed(1),
                    ft: frameTime.toFixed(1),
                    fps: fps
                });
            }
        }

        // Log detailed per-frame performance breakdown
        function logPerfFrame(data) {
            if (!networkRecording) return;
            if (perfLog.length >= MAX_PERF_ENTRIES) return;

            const now = performance.now();
            const elapsed = now - recordStartTime;

            perfLog.push({
                t: Math.round(elapsed),
                ...data
            });

            // Update status
            const status = document.getElementById('recordStatus');
            if (status) status.textContent = 'Recording... (' + perfLog.length + ' frames)';
        }

        function copyNetworkLog() {
            // Calculate performance summary
            const avgFps = perfLog.length > 0 ? Math.round(perfLog.reduce((a, b) => a + b.fps, 0) / perfLog.length) : 0;
            const avgFrameTime = perfLog.length > 0 ? (perfLog.reduce((a, b) => a + b.total, 0) / perfLog.length).toFixed(1) : 0;
            const avgUpdate = perfLog.length > 0 ? (perfLog.reduce((a, b) => a + (b.update || 0), 0) / perfLog.length).toFixed(1) : 0;
            const avgDraw = perfLog.length > 0 ? (perfLog.reduce((a, b) => a + (b.draw || 0), 0) / perfLog.length).toFixed(1) : 0;
            const avgNpc = perfLog.length > 0 ? (perfLog.reduce((a, b) => a + (b.npc || 0), 0) / perfLog.length).toFixed(1) : 0;
            const avgLight = perfLog.length > 0 ? (perfLog.reduce((a, b) => a + (b.light || 0), 0) / perfLog.length).toFixed(1) : 0;

            const report = {
                recorded: new Date().toISOString(),
                duration: ((performance.now() - recordStartTime) / 1000).toFixed(1) + 's',
                summary: {
                    frames: perfLog.length,
                    avgFps: avgFps,
                    avgFrameTime: avgFrameTime + 'ms',
                    avgUpdate: avgUpdate + 'ms',
                    avgDraw: avgDraw + 'ms',
                    avgNpc: avgNpc + 'ms',
                    avgLight: avgLight + 'ms',
                    netEvents: networkLog.length
                },
                frames: perfLog,
                networkEvents: networkLog
            };

            const text = JSON.stringify(report, null, 2);
            navigator.clipboard.writeText(text).then(() => {
                const status = document.getElementById('recordStatus');
                status.textContent = 'Copied to clipboard!';
                status.style.color = '#4f8';
                setTimeout(() => {
                    status.textContent = perfLog.length + ' frames, avg ' + avgFps + ' FPS';
                    status.style.color = '#8f8';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy:', err);
                alert('Failed to copy. Check console for data.');
                console.log('Perf Log:', text);
            });
        }

        function closeGame() {
            window.close();
        }
        let uiHidden = true; // Start with UI hidden
        function hideAllUI() {
            uiHidden = true;
            document.getElementById('debugButtons').style.display = 'none';
            document.getElementById('info').style.display = 'none';
            document.getElementById('debugPanel').style.display = 'none';
            document.getElementById('perfPanel').style.display = 'none';
            perfPanelVisible = false;
            const toggleBtn = document.getElementById('toggleLogBtn');
            if (toggleBtn) toggleBtn.style.display = 'none';
            const debugLog = document.getElementById('debugLog');
            if (debugLog) debugLog.style.display = 'none';
        }
        function showAllUI() {
            uiHidden = false;
            document.getElementById('debugButtons').style.display = '';
            document.getElementById('info').style.display = '';
        }
        function toggleAllUI() {
            if (uiHidden) showAllUI();
            else hideAllUI();
        }

        // Shape-based attack hitbox per direction (triangle/cone) - global for hitbox panel
        let playerHitboxRange = { up: 35, down: 35, left: 35, right: 30 };
        let playerHitboxWidth = { up: 90, down: 90, left: 90, right: 90 };
        let playerHitboxOffsetY = { up: 15, down: -15, left: 0, right: 0 };
        let playerHitboxOffsetX = { up: 0, down: 0, left: 15, right: -15 };

        // Hitbox panel functions
        let hitboxEditDir = 'down';
        function toggleHitboxPanel() {
            const panel = document.getElementById('hitboxPanel');
            panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
            document.querySelectorAll('#debugButtons button')[4].classList.toggle('active', panel.style.display === 'block');
            if (panel.style.display === 'block') {
                updateHitboxSliders();
            }
        }

        function setHitboxDir(dir) {
            hitboxEditDir = dir;
            document.querySelectorAll('[id^="hitboxDir"]').forEach(b => {
                b.classList.remove('active');
                b.style.background = '';
            });
            const btn = document.getElementById('hitboxDir' + dir.charAt(0).toUpperCase() + dir.slice(1));
            btn.classList.add('active');
            btn.style.background = '#66f';
            updateHitboxSliders();
        }

        function updateHitboxSliders() {
            const dir = hitboxEditDir;
            document.getElementById('hbRangeSlider').value = playerHitboxRange[dir];
            document.getElementById('hbRangeVal').textContent = playerHitboxRange[dir];
            document.getElementById('hbWidthSlider').value = playerHitboxWidth[dir];
            document.getElementById('hbWidthVal').textContent = playerHitboxWidth[dir];
            document.getElementById('hbOffsetXSlider').value = playerHitboxOffsetX[dir];
            document.getElementById('hbOffsetXVal').textContent = playerHitboxOffsetX[dir];
            document.getElementById('hbOffsetYSlider').value = playerHitboxOffsetY[dir];
            document.getElementById('hbOffsetYVal').textContent = playerHitboxOffsetY[dir];
        }

        function copyAllHitboxFromDir() {
            const dir = hitboxEditDir;
            ['up', 'down', 'left', 'right'].forEach(d => {
                playerHitboxRange[d] = playerHitboxRange[dir];
                playerHitboxWidth[d] = playerHitboxWidth[dir];
                playerHitboxOffsetX[d] = playerHitboxOffsetX[dir];
                playerHitboxOffsetY[d] = playerHitboxOffsetY[dir];
            });
            console.log('Copied ' + dir + ' hitbox to all directions');
        }

        function copyHitboxSettings() {
            const settings = {
                hitboxRange: playerHitboxRange,
                hitboxWidth: playerHitboxWidth,
                hitboxOffsetX: playerHitboxOffsetX,
                hitboxOffsetY: playerHitboxOffsetY
            };
            const json = JSON.stringify(settings, null, 2);
            navigator.clipboard.writeText(json).then(() => {
                console.log('Hitbox settings copied to clipboard');
            });
        }

        // ===== QUEST SYSTEM FUNCTIONS =====

        // Inventory functions
        function addToInventory(itemId, quantity = 1) {
            if (!itemId) return;
            playerInventory[itemId] = (playerInventory[itemId] || 0) + quantity;
            console.log('[QUEST] Added to inventory:', itemId, 'x', quantity, '- total:', playerInventory[itemId]);
            checkQuestConditions();
        }

        function removeFromInventory(itemId, quantity = 1) {
            if (!itemId || !playerInventory[itemId]) return false;
            if (playerInventory[itemId] < quantity) return false;
            playerInventory[itemId] -= quantity;
            if (playerInventory[itemId] <= 0) delete playerInventory[itemId];
            console.log('[QUEST] Removed from inventory:', itemId, 'x', quantity);
            return true;
        }

        function hasInventoryItem(itemId, quantity = 1) {
            // Count the item across the REAL inventory (inventorySlots). The old code checked a dead
            // playerInventory map that pickups never fill, so hasItem quest conditions always failed.
            let idx = (typeof itemId === 'number') ? itemId : itemsData.findIndex(it => it && it.id === itemId);
            if ((idx === undefined || idx < 0) && typeof itemId === 'string') {
                const m = /(\d+)$/.exec(itemId); if (m) idx = parseInt(m[1]); // fallback "item_11" -> 11
            }
            if (idx === undefined || idx < 0) return false;
            let total = 0;
            for (const slot of inventorySlots) { if (slot && slot.itemIndex === idx) total += slot.quantity; }
            return total >= quantity;
        }

        // Remove qty of an item from the real inventory (used to consume keys on a locked open).
        function consumeInventoryItem(idx, qty = 1) {
            for (let i = 0; i < inventorySlots.length && qty > 0; i++) {
                const slot = inventorySlots[i];
                if (slot && slot.itemIndex === idx) {
                    const take = Math.min(slot.quantity || 1, qty);
                    slot.quantity = (slot.quantity || 1) - take;
                    qty -= take;
                    if (slot.quantity <= 0) inventorySlots[i] = null;
                }
            }
        }

        // Lightweight on-screen toast (e.g. "Locked"), self-contained DOM overlay.
        function showGameToast(text, ms = 1500) {
            let el = document.getElementById('gameToast');
            if (!el) {
                el = document.createElement('div');
                el.id = 'gameToast';
                el.style.cssText = 'position:fixed; top:18%; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.85); color:#fff; padding:10px 18px; border:2px solid #c77dff; border-radius:6px; font-family:monospace; font-size:14px; z-index:99999; pointer-events:none; transition:opacity 0.3s; opacity:0;';
                document.body.appendChild(el);
            }
            el.textContent = text;
            el.style.opacity = '1';
            clearTimeout(el._t);
            el._t = setTimeout(function () { el.style.opacity = '0'; }, ms);
        }

        // Tracking hooks - call these when events happen
        function onNpcInteraction(npcUid) {
            if (!npcUid) return;
            if (!gameProgress.npcsSpokenTo[npcUid]) {
                gameProgress.npcsSpokenTo[npcUid] = true;
                console.log('[QUEST] Talked to NPC:', npcUid);
                checkQuestConditions();
            }
        }

        function onEnemyDefeated(npcUid) {
            if (!npcUid) return;
            gameProgress.enemiesDefeated[npcUid] = (gameProgress.enemiesDefeated[npcUid] || 0) + 1;
            console.log('[QUEST] Enemy defeated:', npcUid, '- total:', gameProgress.enemiesDefeated[npcUid]);
            checkQuestConditions();
        }

        function onMapEnter(mapName) {
            if (!mapName) return;
            if (!gameProgress.locationsVisited[mapName]) {
                gameProgress.locationsVisited[mapName] = true;
                console.log('[QUEST] Visited location:', mapName);
                checkQuestConditions();
            }
        }

        function onLocationVisit(mapName, x, y) {
            const key = mapName + '_' + x + '_' + y;
            if (!gameProgress.locationsVisited[key]) {
                gameProgress.locationsVisited[key] = true;
                console.log('[QUEST] Visited tile:', key);
                checkQuestConditions();
            }
        }

        // Track player tile position for location-based quest conditions
        let lastKnownPlayerTile = { x: -1, y: -1 };
        function checkPlayerTileForQuests() {
            if (typeof player === 'undefined' || !player || player.x === undefined) return;
            const tileX = Math.floor((player.x + player.width / 2) / tileSize);
            const tileY = Math.floor((player.y + player.height / 2) / tileSize);
            if (tileX !== lastKnownPlayerTile.x || tileY !== lastKnownPlayerTile.y) {
                lastKnownPlayerTile = { x: tileX, y: tileY };
                onLocationVisit(currentGameMap, tileX, tileY);
            }
        }

        // Quest state management
        function initializeQuestStates() {
            if (!quests || quests.length === 0) return;

            quests.forEach(quest => {
                if (!gameProgress.questStates[quest.id]) {
                    gameProgress.questStates[quest.id] = { status: QUEST_STATUS.LOCKED };
                }
            });

            updateQuestAvailability();
            console.log('[QUEST] Initialized', quests.length, 'quests');
        }

        function updateQuestAvailability() {
            if (!quests) return;

            quests.forEach(quest => {
                const state = gameProgress.questStates[quest.id];
                if (!state) return;

                // Already completed and not repeatable? Stay completed
                if (state.status === QUEST_STATUS.COMPLETED && !quest.isRepeatable) return;

                // Already active? Stay active
                if (state.status === QUEST_STATUS.ACTIVE) return;

                // Check prerequisites
                const prereqsMet = !quest.prerequisites || quest.prerequisites.length === 0 ||
                    quest.prerequisites.every(prereqId =>
                        gameProgress.questStates[prereqId]?.status === QUEST_STATUS.COMPLETED
                    );

                if (prereqsMet) {
                    if (state.status !== QUEST_STATUS.AVAILABLE) {
                        state.status = QUEST_STATUS.AVAILABLE;

                        // Auto-start if configured
                        if (quest.autoStart) {
                            state.status = QUEST_STATUS.ACTIVE;
                            showQuestNotification('started', quest.name);
                        }
                    }
                } else {
                    state.status = QUEST_STATUS.LOCKED;
                }
            });
        }

        function checkQuestConditions() {
            if (!quests) return;

            quests.forEach(quest => {
                const state = gameProgress.questStates[quest.id];
                if (!state || state.status !== QUEST_STATUS.ACTIVE) return;

                // Check if all conditions are met
                const allMet = checkAllConditionsMet(quest);
                if (allMet) {
                    // Quest can be completed - but wait for turn-in NPC if specified
                    if (!quest.turnInNpcUid) {
                        completeQuest(quest);
                    }
                    // Otherwise player needs to talk to turn-in NPC
                }
            });

            // Update quest tracker UI
            updateQuestTracker();
        }

        function checkAllConditionsMet(quest) {
            if (!quest.conditions || quest.conditions.length === 0) return true;

            return quest.conditions.every(condition => {
                if (condition.broken) return true; // Skip broken conditions

                switch (condition.type) {
                    case 'enemyDefeated':
                        return (gameProgress.enemiesDefeated[condition.targetUid] || 0) >= (condition.count || 1);

                    case 'talkedToNpc':
                        return gameProgress.npcsSpokenTo[condition.targetUid] === true;

                    case 'locationVisited':
                        if (condition.x !== undefined && condition.y !== undefined) {
                            const key = condition.mapName + '_' + condition.x + '_' + condition.y;
                            return gameProgress.locationsVisited[key] === true;
                        }
                        return gameProgress.locationsVisited[condition.mapName] === true;

                    case 'hasItem':
                        return hasInventoryItem(condition.targetUid, condition.count || 1);

                    default:
                        console.warn('[QUEST] Unknown condition type:', condition.type);
                        return false;
                }
            });
        }

        function completeQuest(quest) {
            const state = gameProgress.questStates[quest.id];
            if (!state || state.status === QUEST_STATUS.COMPLETED) return;

            console.log('[QUEST] Completing quest:', quest.name);
            state.status = QUEST_STATUS.COMPLETED;

            // Apply rewards
            if (quest.onComplete) {
                if (quest.onComplete.giveItems) {
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
                if (quest.onComplete.removeItems) {
                    quest.onComplete.removeItems.forEach(itemId => {
                        const idx = itemIdToIndex(itemId);
                        if (idx >= 0) removeFromInventory(idx, 1);
                    });
                }
            }

            showQuestNotification('completed', quest.name);
            updateQuestAvailability();
        }

        function acceptQuest(questId) {
            const quest = quests.find(q => q.id === questId);
            if (!quest) return;

            const state = gameProgress.questStates[questId];
            if (!state || state.status !== QUEST_STATUS.AVAILABLE) return;

            state.status = QUEST_STATUS.ACTIVE;
            console.log('[QUEST] Accepted quest:', quest.name);
            showQuestNotification('started', quest.name);

            // Play quest start sound if set
            playQuestStartSound(quest);
        }

        function playQuestStartSound(quest) {
            // Use startSoundIndex to reference questSounds library
            const soundIndex = quest.startSoundIndex;
            if (soundIndex === undefined || soundIndex < 0) return;
            if (!questSoundsData || soundIndex >= questSoundsData.length) return;

            const sound = questSoundsData[soundIndex];
            if (sound && sound.data) {
                const audio = new Audio(sound.data);
                audio.volume = 0.7;
                audio.play().catch(e => console.log('[QUEST] Sound play failed:', e));
            }
        }

        function getActiveQuest() {
            if (!quests) return null;
            return quests.find(q =>
                gameProgress.questStates[q.id]?.status === QUEST_STATUS.ACTIVE
            );
        }

        function getQuestById(questId) {
            return quests?.find(q => q.id === questId);
        }

        function showQuestNotification(type, questName) {
            const messages = {
                'started': 'NEW QUEST: ' + questName,
                'updated': 'QUEST UPDATE: ' + questName,
                'completed': 'QUEST COMPLETE: ' + questName
            };

            console.log('[QUEST]', messages[type] || type);

            // Create notification element with retro style
            const container = document.getElementById('gameContainer') || document.body;
            const div = document.createElement('div');
            div.className = 'quest-notification ' + type;
            div.textContent = messages[type] || questName;
            div.style.cssText = "position:fixed; top:80px; right:-350px; background:#000; border:3px solid #fff; padding:12px 20px; font-family:'Press Start 2P', monospace; color:#fff; font-size:10px; transition:right 0.4s ease; z-index:150; image-rendering:pixelated;";

            container.appendChild(div);

            // Animate slide in and out
            setTimeout(() => div.style.right = '20px', 10);
            setTimeout(() => div.style.right = '-350px', 3000);
            setTimeout(() => div.remove(), 3500);
        }

        // Quest Tracker HUD
        let questLogVisible = false;

        function updateQuestTracker() {
            const tracker = document.getElementById('questTracker');
            const titleEl = document.getElementById('questTrackerTitle');
            const objectivesEl = document.getElementById('questTrackerObjectives');
            if (!tracker || !titleEl) return;

            const activeQuest = getActiveQuest();
            if (!activeQuest) {
                tracker.style.display = 'none';
                return;
            }

            tracker.style.display = 'block';
            titleEl.textContent = 'QUESTS';

            // Hide objectives - just show quest name
            if (objectivesEl) objectivesEl.innerHTML = '';
        }

        function isConditionMet(condition) {
            if (condition.broken) return true;
            switch (condition.type) {
                case 'enemyDefeated':
                    return (gameProgress.enemiesDefeated[condition.targetUid] || 0) >= (condition.count || 1);
                case 'talkedToNpc':
                    return gameProgress.npcsSpokenTo[condition.targetUid] === true;
                case 'locationVisited':
                    if (condition.x !== undefined && condition.y !== undefined) {
                        const key = condition.mapName + '_' + condition.x + '_' + condition.y;
                        return gameProgress.locationsVisited[key] === true;
                    }
                    return gameProgress.locationsVisited[condition.mapName] === true;
                case 'hasItem':
                    return hasInventoryItem(condition.targetUid, condition.count || 1);
                default:
                    return false;
            }
        }

        function toggleQuestLog() {
            questLogVisible = !questLogVisible;
            const popup = document.getElementById('questLogPopup');
            if (popup) {
                popup.style.display = questLogVisible ? 'block' : 'none';
                if (questLogVisible) renderQuestLog();
            }
        }

        function renderQuestLog() {
            const content = document.getElementById('questLogContent');
            if (!content || !quests) return;

            let html = '';

            // Active quests - just show name, no objectives
            const active = quests.filter(q => gameProgress.questStates[q.id]?.status === QUEST_STATUS.ACTIVE);
            if (active.length > 0) {
                html += '<div style="color:#0ff; font-weight:bold; margin-bottom:8px;">ACTIVE QUESTS</div>';
                active.forEach(q => {
                    html += '<div style="background:#1a1a2e; border:1px solid #0ff; border-radius:6px; padding:10px; margin-bottom:8px;">';
                    html += '<div style="color:#FFD700; font-weight:bold;">' + q.name + '</div>';
                    if (q.description) {
                        html += '<div style="color:#888; font-size:11px; margin-top:4px;">' + q.description + '</div>';
                    }
                    html += '</div>';
                });
            }

            // Completed quests
            const completed = quests.filter(q => gameProgress.questStates[q.id]?.status === QUEST_STATUS.COMPLETED);
            if (completed.length > 0) {
                html += '<div style="color:#4f4; font-weight:bold; margin:12px 0 8px;">COMPLETED</div>';
                completed.forEach(q => {
                    html += '<div style="background:#1a2a1a; border:1px solid #4f4; border-radius:6px; padding:8px; margin-bottom:8px; opacity:0.7;">';
                    html += '<div style="color:#4f4;">✓ ' + q.name + '</div>';
                    html += '</div>';
                });
            }

            if (!html) {
                html = '<div style="color:#666; text-align:center; padding:20px;">No active quests</div>';
            }

            content.innerHTML = html;
        }

        // Build registry of animated tile locations (called once on load and when map changes)
        function buildAnimatedTileRegistry() {
            animatedTileRegistry = [];
            for (let li = 0; li < layers.length; li++) {
                const layer = layers[li];
                if (!layer) continue;
                for (let y = 0; y < mapRows; y++) {
                    if (!layer[y]) continue;
                    for (let x = 0; x < mapCols; x++) {
                        const cell = layer[y][x];
                        // Only track origin tiles (offsetX/offsetY both 0 or undefined)
                        if (cell && cell.type === 'animTile' &&
                            ((cell.offsetX || 0) === 0 && (cell.offsetY || 0) === 0)) {
                            animatedTileRegistry.push({ li, x, y });
                        }
                    }
                }
            }
            console.log('[PERF] Built animated tile registry:', animatedTileRegistry.length, 'entries');
        }

        // ===== 8-DIRECTION MOVEMENT SUPPORT (TEST-GAME copy) =====
        // The Test Game is a SEPARATE document/window from the builder, so it needs its own
        // copy of these helpers (the builder has an identical copy near its top).
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
        // ===== END 8-DIRECTION MOVEMENT SUPPORT (TEST-GAME copy) =====

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
            { name: 'Game Over 1', file: 'game-over-417465.mp3' },
            { name: 'Game Over 2 (Arcade)', file: 'game-over-arcade-6435.mp3' }
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

        // ===== USABLE ITEMS / ABILITIES (sword swing + boomerang) =====
        let projectiles = [];

        // Item currently held in the active hotbar slot (the "equipped" item).
        function getActiveItemDef() {
            const slot = inventorySlots[selectedHotbarSlot];
            if (!slot || slot.itemIndex == null) return null;
            return { def: itemsData[slot.itemIndex], index: slot.itemIndex } ;
        }

        // The attack button now uses whatever is equipped.
        function useActiveItem() {
            const a = getActiveItemDef();
            if (!a || !a.def || !a.def.behavior || a.def.behavior === 'none') return; // nothing usable -> can't attack
            if (a.def.behavior === 'sword') {
                player.attackDamage = a.def.abilityDamage || 10;
                startSwordAttack();
            } else if (a.def.behavior === 'boomerang') {
                throwBoomerang(a.def, a.index);
            } else if (a.def.behavior === 'fishingPole') {
                if (player.fishing) player.fishing = null; // reel in / cancel
                else startFishing();
            }
        }

        // ===== FISHING =====
        // Use a Fishing Pole while facing the edge of a fish zone -> cast -> wait for a
        // bite -> weighted loot handed over via the existing receive-item animation.
        function fishZoneInFront() {
            const md = mapsData[currentGameMap];
            const zones = (md && md.fishZones) || [];
            if (!zones.length) return false;
            const tileSize = gridSize * TILE_SCALE;
            const ptx = Math.floor((player.x + player.width / 2) / tileSize);
            const pty = Math.floor((player.y + player.height * 0.8) / tileSize);
            const v = dirToVec(cardinalOf(player.direction));
            const ftx = ptx + Math.round(v.x);
            const fty = pty + Math.round(v.y);
            const inZone = (tx, ty) => zones.some(z => tx >= z.x && tx < z.x + z.width && ty >= z.y && ty < z.y + z.height);
            return inZone(ftx, fty) && !inZone(ptx, pty); // facing INTO water, standing on land
        }

        function startFishing() {
            if (player.fishing) return;
            if (player.attacking || isReceivingItem || inventoryOpen || activeDialog || shopOpen) return;
            if (!fishZoneInFront()) { console.log('[FISHING] Not facing a fish zone edge'); return; }
            player.moving = false;
            player.fishing = {
                phase: 'cast',
                dir: cardinalOf(player.direction),
                frame: 0,
                frameTimer: 0,
                waitTimer: 0,
                biteDelay: 120 + Math.floor(Math.random() * 240) // 2-6s at ~60fps
            };
            console.log('[FISHING] Cast!');
        }

        function updateFishing() {
            if (!player.fishing) return;
            const f = player.fishing;
            // Any movement input reels in / cancels the cast.
            if (keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight']) {
                player.fishing = null;
                return;
            }
            const suf = f.dir.charAt(0).toUpperCase() + f.dir.slice(1);
            if (f.phase === 'cast') {
                const castFrames = (playerAnimations['fishCast' + suf] || []).length || 1;
                const fps = playerAnimFpsList['fishCast' + suf] || 8;
                if (++f.frameTimer >= 60 / fps) { f.frameTimer = 0; f.frame++; }
                if (f.frame >= castFrames) { f.phase = 'wait'; f.frame = 0; f.frameTimer = 0; f.waitTimer = 0; }
            } else if (f.phase === 'wait') {
                const waitFrames = (playerAnimations['fishWait' + suf] || []).length || 1;
                const fps = playerAnimFpsList['fishWait' + suf] || 6;
                if (++f.frameTimer >= 60 / fps) { f.frameTimer = 0; f.frame = (f.frame + 1) % waitFrames; }
                if (++f.waitTimer >= f.biteDelay) catchFish();
            }
        }

        function catchFish() {
            player.fishing = null;
            const loot = (typeof fishingLoot !== 'undefined' && fishingLoot) || [];
            let pick = null;
            if (loot.length) {
                const total = loot.reduce((s, e) => s + (e.weight || 1), 0);
                let r = Math.random() * total;
                for (const e of loot) { r -= (e.weight || 1); if (r <= 0) { pick = e; break; } }
                if (!pick) pick = loot[loot.length - 1];
            }
            if (pick && pick.itemIndex != null && itemsData[pick.itemIndex]) {
                console.log('[FISHING] Caught:', itemsData[pick.itemIndex].name);
                startReceivingItem(pick.itemIndex, itemsData[pick.itemIndex]);
            } else {
                console.log('[FISHING] Bite! ...but no loot table is set — nothing caught.');
            }
        }

        function startSwordAttack() {
            if (player.attacking) return;
            player.attacking = true;
            player.attackAnim = true;
            player.attackFrame = 0;
            player.attackFrameTimer = 0;
            player.attackTimer = 30;
            player.attackHitNpcs = {};
            player.throwing = false;
            if (playerSoundsData.attack && playerSoundsData.attack.soundIndex >= 0) {
                playSound(playerSoundsData.attack.soundIndex, playerSoundsData.attack.volume || 0.7, playerSoundsData.attack.pitchVariation || 0.15, playerSoundsData.attack.lengthVariation || 0);
            }
        }

        function dirVector() {
            // True unit vector incl. diagonals so projectiles fire along the actual facing.
            return dirToVec(player.direction);
        }

        // Resolve the player animation to play for an ability use. Prefers a directional anim
        // (e.g. "throwDown") then a single one (e.g. "throw"); returns null to fall back to attack.
        function resolveAbilityAnimKey(name) {
            if (!name || !playerAnimations) return null;
            const suffix = { down: 'Down', up: 'Up', left: 'Left', right: 'Right' }[cardinalOf(player.direction)] || 'Down';
            if (playerAnimations[name + suffix] && playerAnimations[name + suffix].length) return name + suffix;
            if (playerAnimations[name] && playerAnimations[name].length) return name;
            return null;
        }

        function throwBoomerang(def, itemIndex) {
            // Only one of the player's boomerangs in flight at a time.
            if (projectiles.some(p => p.type === 'boomerang')) return;
            const d = dirVector();
            const px = player.x + player.width / 2;
            const py = player.y + player.height / 2;
            projectiles.push({
                type: 'boomerang', x: px, y: py, dirX: d.x, dirY: d.y,
                speed: def.abilitySpeed || 7, maxRange: (def.abilityRange || 180) * TILE_SCALE,
                dist: 0, phase: 'out', dmg: def.abilityDamage || 10, itemIndex: itemIndex,
                hit: {}, frame: 0, frameTimer: 0
            });
            // The boomerang has NO player throw pose by default — the player keeps idle/walking while it
            // flies and spins on its own (this matches the original game). Only if the creator explicitly
            // sets a "Player anim on use" do we play it (reusing the attack lifecycle, melee suppressed).
            const key = resolveAbilityAnimKey(def.abilityAnim);
            if (key) {
                player.throwAnimKey = key;
                startSwordAttack();
                player.throwing = true;
            }
        }

        // Shared enemy-hit used by projectiles — mirrors the center/damage math in checkAttackHitbox.
        function hitEnemiesAt(wx, wy, radius, dmg, hitSet) {
            const tileSize = gridSize * TILE_SCALE;
            for (let i = 0; i < placedNpcs.length; i++) {
                const placed = placedNpcs[i]; const state = npcRuntimeState[i];
                if (!placed || !placed.isEnemy || !state || state.dead) continue;
                if (hitSet && hitSet[i]) continue;
                const npc = npcs[placed.npcIndex]; if (!npc) continue;
                const npcScale = placed.scale || 1;
                const scaledW = tileSize * npcScale, scaledH = tileSize * npcScale;
                const cx = state.x * TILE_SCALE + tileSize / 2;
                const cy = state.y * TILE_SCALE + tileSize - scaledH / 2;
                const dx = wx - cx, dy = wy - cy;
                const r = radius + Math.max(scaledW, scaledH) * 0.4;
                if (dx * dx + dy * dy <= r * r) {
                    damageNPC(i, dmg);
                    if (hitSet) hitSet[i] = true;
                }
            }
        }

        function updateProjectiles() {
            const pcx = player.x + player.width / 2;
            const pcy = player.y + player.height / 2;
            for (let i = projectiles.length - 1; i >= 0; i--) {
                const p = projectiles[i];
                if (p.type === 'boomerang') {
                    if (p.phase === 'out') {
                        p.x += p.dirX * p.speed; p.y += p.dirY * p.speed; p.dist += p.speed;
                        if (p.dist >= p.maxRange) { p.phase = 'return'; p.hit = {}; }
                    } else {
                        const dx = pcx - p.x, dy = pcy - p.y;
                        const len = Math.hypot(dx, dy) || 1;
                        p.x += (dx / len) * p.speed; p.y += (dy / len) * p.speed;
                        if (len < 26) { projectiles.splice(i, 1); continue; } // caught
                    }
                    hitEnemiesAt(p.x, p.y, 12, p.dmg, p.hit);
                    p.frameTimer++;
                    if (p.frameTimer >= 3) { p.frameTimer = 0; p.frame++; }
                }
            }
        }

        function drawProjectiles(camX, camY) {
            const tileSize = gridSize * TILE_SCALE;
            for (const p of projectiles) {
                if (p.type !== 'boomerang') continue;
                const img = itemImages[p.itemIndex];
                const def = itemsData[p.itemIndex];
                const sx = Math.floor(p.x - camX), sy = Math.floor(p.y - camY);
                if (img && img.complete && def && def.frames && def.frames.length) {
                    const f = def.frames[p.frame % def.frames.length];
                    const dw = tileSize * 0.7;
                    const dh = dw * (f.h / f.w);
                    ctx.save();
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(img, f.x, f.y, f.w, f.h, sx - dw / 2, sy - dh / 2, dw, dh);
                    ctx.restore();
                } else {
                    ctx.fillStyle = '#ffcf33';
                    ctx.beginPath(); ctx.arc(sx, sy, 8, 0, 7); ctx.fill();
                }
            }
        }

        // === MULTIPLAYER SYSTEM ===
        let mpSocket = null;
        let mpConnected = false;
        let mpPlayerName = 'Player';
        let mpLastSendTime = 0;
        const otherPlayers = new Map(); // id -> {x, y, targetX, targetY, direction, animation, name, frame, frameTimer}

        // Initialize multiplayer if settings provided
        if (projectData.multiplayer) {
            mpPlayerName = projectData.multiplayer.playerName || 'Player';
            const roomCode = projectData.multiplayer.roomCode;
            // Default desktop play uses the game party (/party/); the "join the live world"
            // path points at the authoritative play party (/parties/play/) which relays
            // positions the same way and also serves the world snapshot.
            const partyPath = projectData.multiplayer.partyPath || 'party';
            console.log('[MP] Connecting as', mpPlayerName, 'to room', roomCode);

            // Resilient reconnect: phones drop sockets on background/network blips. Back off with
            // jitter, re-join on reconnect, and clear stale avatars so we don't accumulate ghosts.
            let mpReconnectDelay = 1000;
            let mpReconnectTimer = null;
            function scheduleMpReconnect() {
                if (mpReconnectTimer) return;
                const delay = Math.min(mpReconnectDelay, 15000) + Math.random() * 500;
                mpReconnectTimer = setTimeout(() => {
                    mpReconnectTimer = null;
                    mpReconnectDelay = Math.min(mpReconnectDelay * 2, 15000);
                    connectMpSocket();
                }, delay);
            }
            function connectMpSocket() {
                try {
                    mpSocket = new WebSocket('wss://multiplayer.lakotafox.partykit.dev/' + partyPath + '/' + roomCode);

                    mpSocket.onopen = () => {
                        console.log('[MP] Connected to server');
                        mpConnected = true;
                        mpReconnectDelay = 1000; // reset backoff on a good connection
                        mpSocket.send(JSON.stringify({
                            type: 'join',
                            name: mpPlayerName,
                            x: player.x,
                            y: player.y,
                            direction: player.direction,
                            animation: 'idle',
                            currentMap: currentGameMap,
                            gameType: 'game2d'
                        }));
                    };

                    mpSocket.onmessage = (event) => {
                        try {
                            const data = JSON.parse(event.data);
                            logNetworkEvent(data.type || 'unknown', 'recv', data, event.data.length);
                            handleMpMessage(data);
                        } catch (e) {
                            console.error('[MP] Error parsing message:', e);
                        }
                    };

                    mpSocket.onclose = () => {
                        console.log('[MP] Disconnected');
                        mpConnected = false;
                        otherPlayers.clear(); // drop ghosts; roster is rebuilt from welcome on reconnect
                        scheduleMpReconnect();
                    };

                    mpSocket.onerror = (err) => {
                        console.error('[MP] WebSocket error:', err);
                    };
                } catch (e) {
                    console.error('[MP] Failed to connect:', e);
                    scheduleMpReconnect();
                }
            }
            connectMpSocket();

            // Mobile browsers silently kill backgrounded sockets — reconnect on return to foreground.
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && (!mpSocket || mpSocket.readyState > 1)) {
                    mpReconnectDelay = 1000;
                    scheduleMpReconnect();
                }
            });
        }

        function handleMpMessage(data) {
            switch (data.type) {
                case 'welcome':
                    console.log('[MP] Welcome:', data.message);
                    // Spawn existing players (only game2d ones)
                    if (data.players) {
                        data.players.filter(p => p.gameType === 'game2d').forEach(p => {
                            otherPlayers.set(p.id, {
                                x: p.x, y: p.y,
                                targetX: p.x, targetY: p.y,
                                prevX: p.x, prevY: p.y,  // Previous position for velocity calc
                                vx: 0, vy: 0,           // Estimated velocity
                                lastUpdateTime: Date.now(),
                                direction: p.direction || 'down',
                                animation: p.animation || 'idle',
                                name: p.name || 'Player',
                                currentMap: p.currentMap || 'main',
                                inTavern: p.inTavern || false,
                                frame: 0, frameTimer: 0
                            });
                            console.log('[MP] Added existing player:', p.name, 'on map:', p.currentMap);
                        });
                    }
                    break;

                case 'join':
                    if (data.player && data.player.gameType === 'game2d') {
                        otherPlayers.set(data.player.id, {
                            x: data.player.x, y: data.player.y,
                            targetX: data.player.x, targetY: data.player.y,
                            prevX: data.player.x, prevY: data.player.y,
                            vx: 0, vy: 0,
                            lastUpdateTime: Date.now(),
                            direction: data.player.direction || 'down',
                            animation: data.player.animation || 'idle',
                            name: data.player.name || 'Player',
                            currentMap: data.player.currentMap || 'main',
                            inTavern: data.player.inTavern || false,
                            frame: 0, frameTimer: 0
                        });
                        console.log('[MP] Player joined:', data.player.name, 'on map:', data.player.currentMap);
                    }
                    break;

                case 'update':
                    if (data.player && data.player.gameType === 'game2d') {
                        const other = otherPlayers.get(data.player.id);
                        if (other) {
                            const now = Date.now();
                            const dt = (now - other.lastUpdateTime) / 1000; // Time since last update in seconds

                            // Calculate velocity from position change
                            if (dt > 0 && dt < 1) { // Ignore if too long (probably reconnect)
                                other.vx = (data.player.x - other.prevX) / dt;
                                other.vy = (data.player.y - other.prevY) / dt;
                            }

                            // Store previous target as prev position
                            other.prevX = other.targetX;
                            other.prevY = other.targetY;

                            // Set new target position
                            other.targetX = data.player.x;
                            other.targetY = data.player.y;
                            other.lastUpdateTime = now;

                            other.direction = data.player.direction || other.direction;
                            other.animation = data.player.animation || other.animation;
                            other.attackFrame = data.player.attackFrame || 0;
                            other.currentMap = data.player.currentMap || other.currentMap;
                            other.inTavern = data.player.inTavern || false;
                        }
                    }
                    break;

                case 'leave':
                    if (data.playerId) {
                        const leaving = otherPlayers.get(data.playerId);
                        if (leaving) {
                            console.log('[MP] Player left:', leaving.name);
                            otherPlayers.delete(data.playerId);
                        }
                    }
                    break;

                case 'builderEdit':
                    // Received a builder edit relayed from another player
                    if (data.edit) {
                        console.log('[MP] Received builder edit from other player');
                        applyLiveEdit(data.edit, true); // true = from multiplayer, don't relay again
                    }
                    break;

                case 'itemInteract':
                    // Another player interacted with an item
                    if (data.itemIndex !== undefined && itemStates[data.itemIndex]) {
                        const state = itemStates[data.itemIndex];
                        if (!state.used && !state.animating) {
                            state.animating = true;
                            state.frame = 0;
                            state.frameTimer = 0;
                            console.log('[MP] Remote player opened item at', data.x, data.y);
                        }
                    }
                    break;

                case 'propInteract':
                    // Another player interacted with an animated prop
                    if (data.key) {
                        if (!interactivePropStates[data.key]) {
                            interactivePropStates[data.key] = { used: false, animating: false, frame: 0, gaveItem: false };
                        }
                        const state = interactivePropStates[data.key];
                        if (!state.used && !state.animating) {
                            state.animating = true;
                            state.frame = 0;
                            console.log('[MP] Remote player opened prop at', data.originX, data.originY);
                        }
                    }
                    break;
            }
        }

        function sendMpUpdate() {
            if (!mpConnected || !mpSocket) return;
            const now = Date.now();
            if (now - mpLastSendTime < 100) return; // Throttle to 10/sec
            mpLastSendTime = now;

            // Determine animation state
            let animState = 'idle';
            if (player.attacking && player.attackAnim) {
                animState = 'attack';
            } else if (player.moving) {
                animState = 'walk';
            }

            mpSocket.send(JSON.stringify({
                type: 'update',
                x: player.x,
                y: player.y,
                direction: player.direction,
                animation: animState,
                attackFrame: player.attackFrame || 0,
                currentMap: currentGameMap,
                inTavern: inTavernMode
            }));
        }

        // === SOUND SYSTEM ===
        let soundsData = projectData.sounds || []; // 'let' so we can receive streamed sounds
        // Use outer scope tileSounds for live sync
        tileSounds = projectData.tileSounds || {};
        const playerSoundsData = projectData.playerSounds || {
            walk: { soundIndex: -1, interval: 200, volume: 0.5, pitchVariation: 0.1 },
            attack: { soundIndex: -1, volume: 0.7, pitchVariation: 0.15, lengthVariation: 0 },
            inventoryOpen: { soundIndex: -1, volume: 0.5 },
            inventoryClose: { soundIndex: -1, volume: 0.5 }
        };
        // Ensure inventory fields exist for older saves
        if (!playerSoundsData.inventoryOpen) playerSoundsData.inventoryOpen = { soundIndex: -1, volume: 0.5 };
        if (!playerSoundsData.inventoryClose) playerSoundsData.inventoryClose = { soundIndex: -1, volume: 0.5 };
        const soundsWillStream = projectData.soundsWillStream || false;
        let soundsStreamedCount = 0;

        console.log('=== SOUND DATA LOADED ===');
        console.log('Sounds array:', soundsData.length, soundsData);
        console.log('Sounds will stream:', soundsWillStream);
        console.log('Tile sounds:', Object.keys(tileSounds).length, tileSounds);
        console.log('Player sounds:', playerSoundsData);

        // === TRIGGER/MAP SYSTEM ===
        // Use outer scope placedTriggers for live sync
        placedTriggers = projectData.placedTriggers || [];
        // Wave 7: stamp missing UIDs so game-side updateTrigger/removeTrigger lookups work.
        if (typeof ensureTriggerUids === 'function') ensureTriggerUids(placedTriggers);
        const mapsData = projectData.maps || {};
        const spawnMapNameData = projectData.spawnMapName || 'main';
        currentGameMap = spawnMapNameData; // Start on the map where spawn is set
        onMapEnter(currentGameMap);  // Track initial map for quest conditions
        console.log('Triggers:', placedTriggers.length, 'Maps:', Object.keys(mapsData).length, 'SpawnMap:', spawnMapNameData);

        // === DIALOG SYSTEM ===
        const dialogs = projectData.dialogs || [];
        const placedDialogTiles = projectData.placedDialogTiles || [];
        console.log('Dialogs:', dialogs.length, 'Dialog tiles:', placedDialogTiles.length);

        // NPC Talk Sound - lazy-loaded once audio is unlocked (the AudioContext doesn't exist at
        // startup, so the old eager decode silently produced no buffer -> no typing sound).
        let npcTalkSoundBuffer = null;
        let npcTalkLoading = false;
        let lastTalkSoundTime = 0;
        const TALK_SOUND_MIN_INTERVAL = 50; // Minimum ms between sounds

        function ensureTalkSound() {
            if (npcTalkSoundBuffer || npcTalkLoading || !audioContext) return;
            npcTalkLoading = true;
            const base = (typeof projectData !== 'undefined' && projectData && projectData.baseUrl) ? projectData.baseUrl : '';
            fetch(base + 'talkingnpcsound.mp3')
                .then(r => r.arrayBuffer())
                .then(ab => audioContext.decodeAudioData(ab))
                .then(buf => { npcTalkSoundBuffer = buf; console.log('[NPC TALK] Sound loaded'); })
                .catch(err => { npcTalkLoading = false; console.log('[NPC TALK] Could not load:', err.message); });
        }

        // Short synth blip for UI (dialog choice move/confirm). No asset, never lags.
        function uiBlip(freq, dur, vol, type) {
            if (!audioContext) return;
            const o = audioContext.createOscillator(), g = audioContext.createGain();
            o.type = type || 'square'; o.frequency.value = freq;
            g.gain.setValueAtTime(vol || 0.12, audioContext.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + (dur || 0.06));
            o.connect(g); g.connect(audioContext.destination);
            o.start(); o.stop(audioContext.currentTime + (dur || 0.06));
        }
        function dialogMoveSound() { uiBlip(520, 0.05, 0.1); }
        function dialogSelectSound() { uiBlip(440, 0.05, 0.13); setTimeout(() => uiBlip(680, 0.08, 0.13), 55); }

        // Play NPC talk sound with pitch/length variation based on character
        function playNpcTalkSound(char) {
            ensureTalkSound();
            if (!audioContext || !npcTalkSoundBuffer) return;

            const now = performance.now();
            if (now - lastTalkSoundTime < TALK_SOUND_MIN_INTERVAL) return;
            lastTalkSoundTime = now;

            // Skip spaces and punctuation (silent pause)
            if (/[\s.,!?;:\-]/.test(char)) return;

            // Create buffer source
            const source = audioContext.createBufferSource();
            source.buffer = npcTalkSoundBuffer;

            // Pitch variation based on character code (gives each letter a slightly different pitch)
            const charCode = char.toLowerCase().charCodeAt(0);
            const basePitch = 0.9 + (charCode % 26) / 26 * 0.4; // Range 0.9 to 1.3
            const randomVariation = (Math.random() - 0.5) * 0.2; // ±0.1 random
            source.playbackRate.value = basePitch + randomVariation;

            // Gain node for volume
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 0.3; // Keep it subtle

            source.connect(gainNode);
            gainNode.connect(audioContext.destination);

            source.start(0);
        }

        // === ITEMS SYSTEM (interactive objects like chests) ===
        itemsData = projectData.items || []; // assigns hoisted top-level var (see decl near playerInventory)
        var fishingLoot = projectData.fishingLoot || []; // fishing loot table: [{ itemIndex, weight }]
        const placedItemsData = projectData.placedItems || [];
        const itemImages = {}; // Preloaded item sprite images
        const itemStates = {}; // Runtime state for each placed item: { used: false, animating: false, frame: 0 }

        // Preload item sprites
        itemsData.forEach((item, i) => {
            if (item.spriteData) {
                const img = new Image();
                img.src = item.spriteData;
                itemImages[i] = img;
            }
        });

        // Initialize item states
        placedItemsData.forEach((placed, i) => {
            if (!placed) return; // Skip null entries
            itemStates[i] = {
                used: placed.used || false,
                animating: false,
                frame: itemsData[placed.itemIndex]?.idleFrame || 0,
                frameTimer: 0
            };
        });
        console.log('Items:', itemsData.length, 'Placed items:', placedItemsData.length);

        // === INVENTORY SYSTEM ===
        const INVENTORY_SIZE = 40;  // Total slots (4 rows x 10 columns)
        const HOTBAR_SIZE = 10;     // First 10 slots shown in HUD
        const SLOT_SIZE = 40;       // Pixel size of each slot in UI
        inventorySlots = [];    // assigns hoisted top-level var (see decl near playerInventory)
        let cursorItem = null;      // Item held on cursor: { itemIndex, quantity } or null
        let inventoryOpen = false;  // Is full inventory popup open
        let selectedHotbarSlot = 0; // Currently selected hotbar slot (0-9)

        // === SHOP SYSTEM (Test Game) ===
        // playerGold already loaded above with projectData.startingGold
        let shopOpen = false;       // Is shop UI open
        let activeShopIndex = -1;   // Index of currently open shop
        let shopTab = 'buy';        // 'buy' or 'sell'
        let shopSelectedIndex = 0;  // Selected item in shop list
        // shops already loaded above with projectData.shops

        // Initialize empty inventory slots
        function initInventory() {
            inventorySlots = [];
            for (let i = 0; i < INVENTORY_SIZE; i++) {
                inventorySlots.push(null);
            }
            cursorItem = null;
            inventoryOpen = false;
            selectedHotbarSlot = 0;
            console.log('[INVENTORY] Initialized with', INVENTORY_SIZE, 'slots');
        }

        // Get max stack size for an item (default 99)
        function getMaxStack(itemIndex) {
            const item = itemsData[itemIndex];
            return item?.maxStack || 99;
        }

        // Find slot with existing stack that has room
        function getStackableSlot(itemIndex) {
            const maxStack = getMaxStack(itemIndex);
            for (let i = 0; i < inventorySlots.length; i++) {
                const slot = inventorySlots[i];
                if (slot && slot.itemIndex === itemIndex && slot.quantity < maxStack) {
                    return i;
                }
            }
            return -1;
        }

        // Find first empty slot
        function getEmptySlot() {
            for (let i = 0; i < inventorySlots.length; i++) {
                if (inventorySlots[i] === null) {
                    return i;
                }
            }
            return -1;
        }

        // Add item to inventory - returns true if successful
        function addToInventory(itemIndex, quantity = 1) {
            const maxStack = getMaxStack(itemIndex);
            let remaining = quantity;

            // First, try to stack with existing items
            while (remaining > 0) {
                const stackSlot = getStackableSlot(itemIndex);
                if (stackSlot >= 0) {
                    const slot = inventorySlots[stackSlot];
                    const canAdd = Math.min(remaining, maxStack - slot.quantity);
                    slot.quantity += canAdd;
                    remaining -= canAdd;
                } else {
                    break;
                }
            }

            // Then, put remaining in empty slots
            while (remaining > 0) {
                const emptySlot = getEmptySlot();
                if (emptySlot >= 0) {
                    const toAdd = Math.min(remaining, maxStack);
                    inventorySlots[emptySlot] = { itemIndex: itemIndex, quantity: toAdd };
                    remaining -= toAdd;
                } else {
                    console.log('[INVENTORY] Full! Could not add', remaining, 'items');
                    return false; // Inventory full
                }
            }

            const item = itemsData[itemIndex];
            // Auto-equip the first weapon/ability picked up so the attack button works immediately.
            if (item && item.behavior && item.behavior !== 'none') {
                const activeSlot = inventorySlots[selectedHotbarSlot];
                const activeDef = activeSlot ? itemsData[activeSlot.itemIndex] : null;
                const activeUsable = activeDef && activeDef.behavior && activeDef.behavior !== 'none';
                if (!activeUsable) {
                    for (let s = 0; s < 10 && s < inventorySlots.length; s++) {
                        if (inventorySlots[s] && inventorySlots[s].itemIndex === itemIndex) { selectedHotbarSlot = s; break; }
                    }
                }
            }
            console.log('[INVENTORY] Added', quantity, 'x', item?.name || 'Item ' + itemIndex);
            return true;
        }

        // Remove items from a specific slot
        function removeFromSlot(slotIndex, quantity = 1) {
            if (slotIndex < 0 || slotIndex >= inventorySlots.length) return false;
            const slot = inventorySlots[slotIndex];
            if (!slot) return false;

            slot.quantity -= quantity;
            if (slot.quantity <= 0) {
                inventorySlots[slotIndex] = null;
            }
            return true;
        }

        // Get item in selected hotbar slot
        function getSelectedItem() {
            if (selectedHotbarSlot < 0 || selectedHotbarSlot >= HOTBAR_SIZE) return null;
            return inventorySlots[selectedHotbarSlot];
        }

        // Remove item by itemIndex (for quest rewards) - removes from first stack found
        function removeFromInventory(itemIndex, quantity = 1) {
            let remaining = quantity;
            for (let i = 0; i < inventorySlots.length && remaining > 0; i++) {
                const slot = inventorySlots[i];
                if (slot && slot.itemIndex === itemIndex) {
                    const toRemove = Math.min(remaining, slot.quantity);
                    slot.quantity -= toRemove;
                    remaining -= toRemove;
                    if (slot.quantity <= 0) {
                        inventorySlots[i] = null;
                    }
                }
            }
            return remaining === 0;
        }

        // Check if player has item in inventory
        function hasItem(itemIndex, quantity = 1) {
            let count = 0;
            for (const slot of inventorySlots) {
                if (slot && slot.itemIndex === itemIndex) {
                    count += slot.quantity;
                    if (count >= quantity) return true;
                }
            }
            return false;
        }

        // Convert itemId (string like "item_0") to numeric index
        function itemIdToIndex(itemId) {
            if (typeof itemId === 'number') return itemId;
            if (typeof itemId === 'string') {
                // Try "item_N" format first
                if (itemId.startsWith('item_')) {
                    return parseInt(itemId.substring(5));
                }
                // Try direct number string
                const parsed = parseInt(itemId);
                if (!isNaN(parsed)) return parsed;
                // Search by id property
                for (let i = 0; i < itemsData.length; i++) {
                    if (itemsData[i].id === itemId) return i;
                }
            }
            return -1;
        }

        // Initialize inventory on game start
        initInventory();

        // Debug: log all received triggers
        console.log('=== TEST GAME RECEIVED TRIGGERS ===');
        placedTriggers.forEach((t, i) => {
            console.log('Trigger ' + i + ': Door ' + t.doorNumber + ' at (' + t.x + ',' + t.y + ') on "' + t.mapName + '" -> "' + t.targetMap + '" spawn (' + t.targetX + ',' + t.targetY + ')');
        });

        // Listen for streamed sound data from builder (mobile only)
        if (soundsWillStream) {
            console.log('Waiting for sound data to stream from builder...');
            window.addEventListener('message', function(e) {
                if (e.data && e.data.type === 'sound-data') {
                    const { index, data, name } = e.data;
                    if (soundsData[index]) {
                        soundsData[index].data = data;
                        soundsStreamedCount++;
                        console.log('Received sound', index, name, '(' + soundsStreamedCount + '/' + soundsData.length + ')');
                    }
                } else if (e.data && e.data.type === 'sounds-complete') {
                    console.log('All sounds received from builder');
                }
            });
        }

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
            const settings = \`Player Settings:
  scale: \${playerScale}
  speed: \${player.speed}
  animSpeed: \${animSpeed}
  width: \${player.width}
  height: \${player.height}
  cameraZoom: \${cameraZoom}
Attack Slide:
  slideAmount: \${attackSlideAmount}
  slideDuration: \${attackSlideDuration}
Item Receive Display:
  itemReceiveScale: \${itemReceiveScale}
  itemReceiveHeight: \${itemReceiveHeight}
  itemReceiveDuration: \${itemReceiveDuration}
  itemReceiveFinalPause: \${itemReceiveFinalPause}\`;
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
                // Check for shop interaction first
                const shopResult = checkShopInteraction();
                if (shopResult && shopResult.shopIndex >= 0 && !activeDialog) {
                    // Show shop greeting dialog with Open Shop / Leave choices
                    const shop = shops[shopResult.shopIndex];
                    const shopName = shop?.name || 'Shop';

                    // Check if shop has a custom greeting dialog by ID
                    const dialogId = parseInt(shop?.greetingDialogId);
                    if (!isNaN(dialogId) && dialogs[dialogId]) {
                        // Use existing dialog - but add shop choices to last page if not present
                        const greetingDialog = JSON.parse(JSON.stringify(dialogs[dialogId])); // Deep copy
                        const lastPage = greetingDialog.pages[greetingDialog.pages.length - 1];
                        if (!lastPage.choices || lastPage.choices.length === 0) {
                            lastPage.choices = [
                                { text: 'Open Shop', action: 'shop' },
                                { text: 'Leave', action: 'close' }
                            ];
                        }
                        activeDialog = {
                            dialog: greetingDialog,
                            pageIndex: 0,
                            npc: shopResult.npc,
                            isShopGreeting: true,
                            shopIndex: shopResult.shopIndex
                        };
                    } else {
                        // Use custom greeting text or default
                        const greetingText = (shop?.greetingDialogId || shop?.greeting || 'Welcome! Would you like to browse my wares?').trim();
                        activeDialog = {
                            dialog: {
                                name: shopName,
                                pages: [{
                                    text: greetingText || 'Welcome! Would you like to browse my wares?',
                                    choices: [
                                        { text: 'Open Shop', action: 'shop' },
                                        { text: 'Leave', action: 'close' }
                                    ]
                                }]
                            },
                            pageIndex: 0,
                            npc: shopResult.npc,
                            shopIndex: shopResult.shopIndex
                        };
                    }
                    dialogSelectedChoice = 0;
                    resetDialogTyping();
                    renderDialogBox();
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
                        // Use tile collision masks for tiles, prop collision masks for props (by propIndex)
                        let mask = null;
                        let maskOffsetX = 0;
                        let maskOffsetY = 0;

                        if (cell.type === 'prop') {
                            const propIdx = cell.propIndex || 0;
                            const propKey = cell.x + ',' + cell.y;
                            mask = propCollisionMasksAll[propIdx] ? propCollisionMasksAll[propIdx][propKey] : null;
                        } else if (cell.type === 'animTile') {
                            // Animated tile - get collision from prop data (per-frame)
                            const propData = animatedPropsData[cell.propIndex];
                            if (propData) {
                                // Get current animation frame for this prop
                                const animKey = tileX + ',' + tileY + ',' + li;
                                const timer = animPropFrameTimers[animKey] || { frame: 0 };
                                const currentFrame = timer.frame;

                                // Check for per-frame collision masks first, fall back to single mask
                                if (propData.collisionMasks && propData.collisionMasks[currentFrame]) {
                                    mask = propData.collisionMasks[currentFrame];
                                } else if (propData.collisionMask) {
                                    // Legacy single mask format
                                    mask = propData.collisionMask;
                                }

                                // For multi-tile props, offset into the mask
                                maskOffsetX = (cell.offsetX || 0) * gridSize;
                                maskOffsetY = (cell.offsetY || 0) * gridSize;
                            }
                        } else {
                            mask = collisionMasks[key];
                        }

                        if (mask) {
                            // Check pixel-level collision (works for both tiles and props)
                            const localX = Math.floor((point.x % tileSize) / pixelScale);
                            const localY = Math.floor((point.y % tileSize) / pixelScale);

                            let maskX, maskY;
                            if (cell.type === 'animTile' && ((cell.scale && cell.scale !== 1) || cell.nudgeX || cell.nudgeY || cell.mirror)) {
                                // Inverse-transform the sample point so collision matches the RENDERED prop:
                                // per-instance scale (about the prop's center), pixel nudge, and horizontal mirror.
                                const tw = cell.tilesW || 1, th = cell.tilesH || 1;
                                const pmw = tw * gridSize, pmh = th * gridSize;
                                const cs = cell.scale || 1;
                                let sx = (localX + maskOffsetX) - (cell.nudgeX || 0);
                                let sy = (localY + maskOffsetY) - (cell.nudgeY || 0);
                                sx = (sx - pmw / 2) / cs + pmw / 2;
                                sy = (sy - pmh / 2) / cs + pmh / 2;
                                if (cell.mirror) sx = pmw - 1 - sx;
                                maskX = Math.floor(sx);
                                maskY = Math.floor(sy);
                            } else {
                                // Apply offset for multi-tile animated props
                                maskX = localX + maskOffsetX;
                                maskY = localY + maskOffsetY;
                            }

                            if (maskY >= 0 && maskY < mask.length && mask[maskY]) {
                                if (maskX >= 0 && maskX < mask[maskY].length && mask[maskY][maskX]) {
                                    return true;
                                }
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

        function draw() {
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const tileSize = gridSize * TILE_SCALE;
            ctx.imageSmoothingEnabled = false;

            // Check if all tilesets are ready
            let allTilesetsReady = true;
            for (let i = 0; i < tilesetImages.length; i++) {
                if (!tilesetImages[i] || !tilesetImages[i].complete) {
                    allTilesetsReady = false;
                    break;
                }
            }
            if (!allTilesetsReady) {
                ctx.fillStyle = '#4af';
                ctx.font = '20px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('Loading tilesets...', canvas.width / 2, canvas.height / 2);
                return;
            }

            // Debug: Show message if no layers
            if (layers.length === 0) {
                ctx.fillStyle = '#f00';
                ctx.font = '16px monospace';
                ctx.fillText('ERROR: No layers loaded!', 20, 70);
                return;
            }

            // Apply camera zoom transform
            ctx.save();
            ctx.scale(cameraZoom, cameraZoom);

            // Draw tiles - use Math.round for camera to prevent seams
            const camX = Math.round(camera.x);
            const camY = Math.round(camera.y);

            // === 3-PASS RENDERING FOR Y-SORTING ===
            // Performance profiling for render passes
            const drawPerfStart = performance.now();
            let drawPerfLog = '';

            // PASS 1: Draw ground layer (layer 0) - always behind everything
            let dp1 = performance.now();
            let tilesDrawn = drawLayer(0, camX, camY, tileSize);
            let dp1e = performance.now();
            if (dp1e - dp1 > 3) drawPerfLog += ' L0:' + (dp1e-dp1).toFixed(0) + '(' + tilesDrawn + 'tiles)';

            // PASS 2: Y-sort player with tiles from layers 1+
            let dp2 = performance.now();
            tilesDrawn += drawYSortedEntities(camX, camY, tileSize);
            drawProjectiles(camX, camY); // thrown abilities (boomerang etc.) on top of entities
            let dp2e = performance.now();
            if (dp2e - dp2 > 5) drawPerfLog += ' Ysort:' + (dp2e-dp2).toFixed(0);

            // PASS 2.5: Draw dropped items on ground
            renderDroppedItems(ctx, camX, camY);

            // PASS 3: Draw canopy overlay (split tile tops)
            let dp3 = performance.now();
            drawCanopyOverlay(camX, camY, tileSize);
            let dp3e = performance.now();
            if (dp3e - dp3 > 3) drawPerfLog += ' canopy:' + (dp3e-dp3).toFixed(0);

            // PASS 4: Redraw higher layer content that canopy covered
            let dp4 = performance.now();
            redrawHigherLayerContent(camX, camY, tileSize);
            let dp4e = performance.now();
            if (dp4e - dp4 > 3) drawPerfLog += ' redraw:' + (dp4e-dp4).toFixed(0);

            if (drawPerfLog && (performance.now() - drawPerfStart) > 12) {
                console.log('[DRAW]' + drawPerfLog + ' total:' + (performance.now() - drawPerfStart).toFixed(0));
            }

            // PASS 5: Draw collision debug on top of everything (so canopy doesn't hide it)
            if (showCollision) {
                drawCollisionDebugOverlay(camX, camY, tileSize);
            }

            // Draw sound debug visualization
            if (showSounds) {
                Object.keys(tileSounds).forEach(key => {
                    // Filter by current map
                    let sx, sy;
                    if (key.includes(':')) {
                        const parts = key.split(':');
                        if (parts[0] !== currentGameMap) return;
                        [sx, sy] = parts[1].split(',').map(Number);
                    } else {
                        if (currentGameMap !== 'main') return;
                        [sx, sy] = key.split(',').map(Number);
                    }
                    const ts = tileSounds[key];
                    if (!ts) return;

                    const px = sx * tileSize - camX + tileSize / 2;
                    const py = sy * tileSize - camY + tileSize / 2;
                    const radius = (ts.radius || 3) * tileSize;

                    // Draw radius circle - filled purple gradient for visibility
                    const isPlaying = ambientSounds[key]?.playing;

                    // Filled gradient circle
                    const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
                    if (isPlaying) {
                        gradient.addColorStop(0, 'rgba(100, 255, 100, 0.3)');
                        gradient.addColorStop(0.7, 'rgba(100, 255, 100, 0.15)');
                        gradient.addColorStop(1, 'rgba(100, 255, 100, 0)');
                    } else {
                        gradient.addColorStop(0, 'rgba(180, 100, 255, 0.3)');
                        gradient.addColorStop(0.7, 'rgba(180, 100, 255, 0.15)');
                        gradient.addColorStop(1, 'rgba(180, 100, 255, 0)');
                    }
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(px, py, radius, 0, Math.PI * 2);
                    ctx.fill();

                    // Outer ring
                    ctx.strokeStyle = isPlaying ? 'rgba(100, 255, 100, 0.8)' : 'rgba(180, 100, 255, 0.8)';
                    ctx.lineWidth = 3;
                    ctx.stroke();

                    // Draw center marker
                    ctx.fillStyle = isPlaying ? '#0f0' : '#b464ff';
                    ctx.beginPath();
                    ctx.arc(px, py, tileSize / 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // Label
                    ctx.fillStyle = '#fff';
                    ctx.font = '10px monospace';
                    ctx.textAlign = 'center';
                    const soundName = soundsData[ts.soundIndex]?.name || 'Sound ' + ts.soundIndex;
                    ctx.fillText(soundName, px, py - tileSize / 2);
                    ctx.fillText(isPlaying ? 'PLAYING' : 'idle', px, py + tileSize / 2 + 12);
                });
            }

            // Layer debug visualization
            if (showLayers) {
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                for (let li = 0; li < layers.length; li++) {
                    const layer = layers[li];
                    if (!layer) continue;
                    for (let y = 0; y < mapRows; y++) {
                        if (!layer[y]) continue;
                        for (let x = 0; x < mapCols; x++) {
                            const cell = layer[y][x];
                            if (!cell) continue;
                            const px = x * tileSize - camX + tileSize / 2;
                            const py = y * tileSize - camY + tileSize / 2;
                            // Skip off-screen tiles
                            if (px < -tileSize || px > canvas.width / cameraZoom + tileSize || py < -tileSize || py > canvas.height / cameraZoom + tileSize) continue;
                            // Different color for animTiles
                            if (cell.type === 'animTile') {
                                ctx.fillStyle = 'rgba(255, 0, 255, 0.8)'; // Magenta for animTiles
                                ctx.fillRect(px - 8, py - 6, 16, 12);
                                ctx.fillStyle = '#fff';
                                ctx.fillText('A' + li, px, py);
                            } else if (li > 0) {
                                // Only show layer number for non-ground tiles
                                ctx.fillStyle = 'rgba(0, 100, 255, 0.7)';
                                ctx.fillRect(px - 6, py - 6, 12, 12);
                                ctx.fillStyle = '#fff';
                                ctx.fillText(li, px, py);
                            }
                        }
                    }
                }
            }

            // Draw trigger zones when collision debug is enabled
            if (showCollision && placedTriggers) {
                const triggersOnMap = placedTriggers.filter(t => t.mapName === currentGameMap);

                triggersOnMap.forEach(trigger => {
                    const px = trigger.x * tileSize - camX;
                    const py = trigger.y * tileSize - camY;
                    const pw = (trigger.width || 1) * tileSize;
                    const ph = (trigger.height || 1) * tileSize;

                    // Draw trigger zone - bright magenta
                    ctx.fillStyle = 'rgba(255, 0, 255, 0.4)';
                    ctx.fillRect(px, py, pw, ph);
                    ctx.strokeStyle = '#f0f';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(px, py, pw, ph);

                    // Draw type label
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 12px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(trigger.type.toUpperCase(), px + pw / 2, py + ph / 2 - 8);

                    // Show target info
                    ctx.font = '10px monospace';
                    const doorNum = trigger.doorNumber || '?';
                    ctx.fillText('Door ' + doorNum + ' > ' + trigger.targetMap, px + pw / 2, py + ph / 2 + 6);
                });

                // Draw GREEN spawn boxes for incoming doors (doors that lead TO this map)
                // Only draw if spawn has been set (not null)
                const incomingTriggers = placedTriggers.filter(t => t.targetMap === currentGameMap && t.targetX !== null && t.targetY !== null);
                incomingTriggers.forEach(trigger => {
                    const sx = trigger.targetX * tileSize - camX;
                    const sy = trigger.targetY * tileSize - camY;

                    // Green spawn box
                    ctx.fillStyle = 'rgba(0, 255, 100, 0.4)';
                    ctx.fillRect(sx, sy, tileSize, tileSize);
                    ctx.strokeStyle = '#0f0';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(sx, sy, tileSize, tileSize);

                    // Label
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const doorNum = trigger.doorNumber || '?';
                    ctx.fillText('Door ' + doorNum, sx + tileSize / 2, sy + tileSize / 2 - 6);
                    ctx.fillText('from ' + trigger.mapName, sx + tileSize / 2, sy + tileSize / 2 + 6);
                });
            }

            // Draw fish zones (purple) when collision debug (C key) is enabled
            if (showCollision) {
                const fzMd = mapsData[currentGameMap];
                const fz = (fzMd && fzMd.fishZones) || [];
                fz.forEach((z, i) => {
                    const px = z.x * tileSize - camX;
                    const py = z.y * tileSize - camY;
                    const pw = z.width * tileSize;
                    const ph = z.height * tileSize;
                    ctx.fillStyle = 'rgba(168, 85, 255, 0.4)';
                    ctx.fillRect(px, py, pw, ph);
                    ctx.strokeStyle = '#c77dff';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(px, py, pw, ph);
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 12px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('🎣 FISH ' + (i + 1), px + pw / 2, py + ph / 2);
                });
            }

            // Draw dialog tiles when collision debug is enabled
            if (showCollision && placedDialogTiles) {
                const dialogTilesOnMap = placedDialogTiles.filter(t => t.mapName === currentGameMap);

                dialogTilesOnMap.forEach(tile => {
                    const px = tile.x * tileSize - camX;
                    const py = tile.y * tileSize - camY;

                    // Draw dialog tile - orange/yellow
                    ctx.fillStyle = 'rgba(255, 180, 0, 0.4)';
                    ctx.fillRect(px, py, tileSize, tileSize);
                    ctx.strokeStyle = '#fa0';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(px, py, tileSize, tileSize);

                    // Speech bubble icon
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 14px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('💬', px + tileSize / 2, py + tileSize / 2 - 4);

                    // Show dialog name if available
                    const dialog = dialogs[tile.dialogIndex];
                    if (dialog && dialog.name) {
                        ctx.font = '8px monospace';
                        ctx.fillStyle = '#fa0';
                        ctx.fillText(dialog.name.substring(0, 10), px + tileSize / 2, py + tileSize / 2 + 10);
                    }
                });
            }

            // Draw INITIAL spawn point when collision debug is enabled
            // Only shows on the spawn map - this is where player spawns when game first loads
            // Door targets are separate (shown as magenta trigger zones with yellow coordinates)
            if (showCollision && projectData.playerPreviewPos) {
                // Only show initial spawn on the spawn map
                if (currentGameMap === spawnMapNameData) {
                    const spawnPos = projectData.playerPreviewPos;
                    const spawnX = spawnPos.x * tileSize - camX;
                    const spawnY = spawnPos.y * tileSize - camY;

                    // Green spawn marker
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.4)';
                    ctx.fillRect(spawnX, spawnY, tileSize, tileSize);
                    ctx.strokeStyle = '#0f0';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(spawnX, spawnY, tileSize, tileSize);

                    // Label with coordinates
                    ctx.fillStyle = '#0f0';
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('START', spawnX + tileSize/2, spawnY + tileSize/2 - 6);
                    ctx.font = '9px monospace';
                    ctx.fillText('(' + spawnPos.x + ',' + spawnPos.y + ')', spawnX + tileSize/2, spawnY + tileSize/2 + 6);
                }
            }

            // DEBUG: Draw player position marker at player feet (only when UI visible)
            if (!uiHidden) {
                ctx.fillStyle = '#f0f';
                ctx.beginPath();
                ctx.arc(player.x - camX, player.y - camY, 5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();

            // DEBUG HUD: Show player position (only when UI visible)
            if (!uiHidden) {
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(10, 10, 200, 50);
                ctx.fillStyle = '#0ff';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText('PLAYER POS (for builder)', 15, 15);
                ctx.fillStyle = '#ff0';
                ctx.fillText('x:' + Math.round(player.x) + ' y:' + Math.round(player.y), 15, 35);
            }

            // === LIGHTING OVERLAY (drawn after all game content) ===
            const lightT0 = performance.now();
            renderLighting();
            window._lastLightTime = performance.now() - lightT0;  // For perf recording

            // Debug info - stacked properly from bottom up
            if (!uiHidden) {
                ctx.font = '12px monospace';
                let debugY = canvas.height - 10;
                const lineHeight = 15;

                // Always show basic info at bottom
                ctx.fillStyle = '#fff';
                ctx.fillText('Layers: ' + layers.length + ' | Tiles: ' + tilesDrawn + ' | Zoom: ' + cameraZoom.toFixed(1) + 'x', 10, debugY);
                debugY -= lineHeight;

                // Health display (always visible when collision debug on)
                if (showCollision) {
                    ctx.fillStyle = player.health <= 25 ? '#f44' : (player.health <= 50 ? '#fa4' : '#4f4');
                    ctx.fillText('HEALTH: ' + player.health + '/' + player.maxHealth + (player.invincible ? ' [INV]' : ''), 10, debugY);
                    debugY -= lineHeight;

                    // Spawn and player position
                    const playerTileX = Math.floor(player.x / tileSize);
                    const playerTileY = Math.floor(player.y / tileSize);
                    const spawnPos = projectData.playerPreviewPos || {x: '?', y: '?'};
                    ctx.fillStyle = '#0f0';
                    ctx.fillText('START: (' + spawnPos.x + ',' + spawnPos.y + ') | PLAYER: (' + playerTileX + ',' + playerTileY + ') on "' + currentGameMap + '"', 10, debugY);
                    debugY -= lineHeight;
                }

                // Sound debug info
                if (showSounds) {
                    ctx.fillStyle = '#ff0';
                    ctx.fillText('Sounds: ' + soundsData.length + ' | Tile sounds: ' + Object.keys(tileSounds).length + ' | Audio: ' + (audioContext ? 'ON' : 'OFF'), 10, debugY);
                    debugY -= lineHeight;
                }

                // Layer debug info
                if (showLayers) {
                    let animCounts = [];
                    for (let li = 0; li < layers.length; li++) {
                        let count = 0;
                        const layer = layers[li];
                        if (layer) {
                            for (let y = 0; y < mapRows; y++) {
                                if (!layer[y]) continue;
                                for (let x = 0; x < mapCols; x++) {
                                    if (layer[y][x]?.type === 'animTile') count++;
                                }
                            }
                        }
                        if (count > 0) animCounts.push('L' + li + ':' + count);
                    }
                    ctx.fillStyle = '#4af';
                    ctx.fillText('AnimTiles: ' + (animCounts.length > 0 ? animCounts.join(', ') : 'none') + ' | Press L to toggle', 10, debugY);
                }
            }

            // Draw inventory UI (always on top)
            drawHotbar();
            if (inventoryOpen) {
                drawInventoryPopup();
            }
            // Draw shop UI if open
            if (shopOpen) {
                drawShopUI();
            }
        }

        // Draw hotbar at bottom of screen
        function drawHotbar() {
            const hotbarWidth = HOTBAR_SIZE * SLOT_SIZE + (HOTBAR_SIZE - 1) * 2; // slots + gaps
            const hotbarX = (canvas.width - hotbarWidth) / 2;
            const hotbarY = canvas.height - SLOT_SIZE - 10;

            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(hotbarX - 5, hotbarY - 5, hotbarWidth + 10, SLOT_SIZE + 10);

            for (let i = 0; i < HOTBAR_SIZE; i++) {
                const slotX = hotbarX + i * (SLOT_SIZE + 2);
                const slot = inventorySlots[i];

                // Slot background
                if (i === selectedHotbarSlot) {
                    ctx.fillStyle = '#555';
                    ctx.strokeStyle = '#fff';
                } else {
                    ctx.fillStyle = '#333';
                    ctx.strokeStyle = '#666';
                }
                ctx.fillRect(slotX, hotbarY, SLOT_SIZE, SLOT_SIZE);
                ctx.strokeRect(slotX, hotbarY, SLOT_SIZE, SLOT_SIZE);

                // Draw item if slot has one
                if (slot) {
                    const item = itemsData[slot.itemIndex];
                    const img = itemImages[slot.itemIndex];
                    if (item && img && img.complete) {
                        // Draw item sprite (idle frame)
                        const frame = item.frames[item.idleFrame || 0];
                        if (frame) {
                            const scale = Math.min((SLOT_SIZE - 4) / frame.w, (SLOT_SIZE - 4) / frame.h);
                            const drawW = frame.w * scale;
                            const drawH = frame.h * scale;
                            const drawX = slotX + (SLOT_SIZE - drawW) / 2;
                            const drawY = hotbarY + (SLOT_SIZE - drawH) / 2;
                            ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
                        }
                    }

                    // Draw quantity if > 1
                    if (slot.quantity > 1) {
                        ctx.fillStyle = '#fff';
                        ctx.strokeStyle = '#000';
                        ctx.font = 'bold 12px monospace';
                        ctx.textAlign = 'right';
                        ctx.textBaseline = 'bottom';
                        ctx.lineWidth = 2;
                        ctx.strokeText(slot.quantity, slotX + SLOT_SIZE - 2, hotbarY + SLOT_SIZE - 2);
                        ctx.fillText(slot.quantity, slotX + SLOT_SIZE - 2, hotbarY + SLOT_SIZE - 2);
                    }
                }

                // Slot number (1-9, 0)
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.font = '10px monospace';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(i === 9 ? '0' : (i + 1).toString(), slotX + 2, hotbarY + 2);
            }

            // Draw gold display above hotbar
            if (playerGold !== undefined) {
                const goldX = hotbarX + hotbarWidth + 15;
                const goldY = hotbarY + SLOT_SIZE / 2;
                // Gold coin icon
                ctx.fillStyle = '#fa0';
                ctx.beginPath();
                ctx.arc(goldX, goldY, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#c80';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = '#640';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('$', goldX, goldY);
                // Gold amount
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'left';
                ctx.fillText(playerGold.toString(), goldX + 16, goldY + 1);
            }
        }

        // === SHOP SYSTEM ===
        let shopUIButtons = {};
        let shopCart = []; // { type: 'buy'|'sell', shopInvIdx, playerSlotIdx, itemIndex, price, name }
        const SHOP_SLOT_SIZE = 36;
        let shopMusicAudio = null;
        let shopMusicFadeInterval = null;

        function openShop(shopIndex) {
            if (shopIndex < 0 || shopIndex >= shops.length) return;
            shopOpen = true;
            activeShopIndex = shopIndex;
            shopCart = [];
            console.log('[SHOP] Opened shop:', shops[shopIndex].name);

            // Start shop music if configured
            const shop = shops[shopIndex];
            if (shop.musicIndex >= 0 && soundsData[shop.musicIndex]) {
                startShopMusic(shop.musicIndex);
            }
        }

        function closeShop() {
            shopOpen = false;
            activeShopIndex = -1;
            shopCart = [];
            stopShopMusic();
        }

        function startShopMusic(soundIndex) {
            // Stop any existing shop music
            stopShopMusic();

            const sound = soundsData[soundIndex];
            if (!sound || !sound.data) return;

            shopMusicAudio = new Audio(sound.data);
            shopMusicAudio.loop = true;
            shopMusicAudio.volume = 0;
            shopMusicAudio.play().catch(e => console.log('[SHOP] Music play failed:', e));

            // Fade in
            let vol = 0;
            shopMusicFadeInterval = setInterval(() => {
                vol += 0.05;
                if (vol >= 0.5) {
                    vol = 0.5;
                    clearInterval(shopMusicFadeInterval);
                    shopMusicFadeInterval = null;
                }
                if (shopMusicAudio) shopMusicAudio.volume = vol;
            }, 50);
        }

        function stopShopMusic() {
            if (shopMusicFadeInterval) {
                clearInterval(shopMusicFadeInterval);
                shopMusicFadeInterval = null;
            }

            if (shopMusicAudio) {
                // Fade out
                let vol = shopMusicAudio.volume;
                const fadeOut = setInterval(() => {
                    vol -= 0.05;
                    if (vol <= 0) {
                        vol = 0;
                        clearInterval(fadeOut);
                        shopMusicAudio.pause();
                        shopMusicAudio = null;
                    } else if (shopMusicAudio) {
                        shopMusicAudio.volume = vol;
                    }
                }, 50);
            }
        }

        function getCartTotal() {
            let total = 0;
            shopCart.forEach(c => {
                if (c.type === 'buy') total -= c.price;
                else total += c.price;
            });
            return total;
        }

        function drawShopUI() {
            if (!shopOpen || activeShopIndex < 0) return;

            const shop = shops[activeShopIndex];
            if (!shop) return;

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

            // Use same slot size as regular inventory
            const cols = 10;
            const padding = 15;
            const slotGap = 2;
            const invWidth = cols * SLOT_SIZE + (cols - 1) * slotGap + padding * 2;

            // Calculate heights for two inventory sections
            const shopRows = Math.max(2, Math.ceil((shop.inventory?.length || 0) / cols));
            const playerRows = 4; // Show 4 rows of player inventory
            const sectionH = playerRows * SLOT_SIZE + (playerRows - 1) * slotGap + 35; // +35 for header
            const shopSectionH = shopRows * SLOT_SIZE + (shopRows - 1) * slotGap + 35;

            // Total panel size
            const panelW = invWidth + 120; // Extra space for cart summary on right
            const panelH = shopSectionH + sectionH + 90; // +90 for title, gold, buttons
            const panelX = (canvas.width - panelW) / 2;
            const panelY = (canvas.height - panelH) / 2;

            // Darken background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Main panel
            ctx.fillStyle = style.panelBg;
            ctx.fillRect(panelX, panelY, panelW, panelH);
            ctx.strokeStyle = style.borderColor;
            ctx.lineWidth = 3;
            ctx.strokeRect(panelX, panelY, panelW, panelH);

            // Header with shop name and gold
            ctx.fillStyle = style.accentColor;
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(shop.name || 'Shop', panelX + panelW / 2, panelY + 20);

            // Gold display with cart total
            const cartTotal = getCartTotal();
            ctx.fillStyle = '#fc0';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('Gold: ' + playerGold, panelX + 15, panelY + 20);

            // Show cart cost next to gold (red for spending, green for earning)
            if (cartTotal !== 0) {
                const costText = (cartTotal >= 0 ? '+' : '') + cartTotal;
                ctx.fillStyle = cartTotal >= 0 ? '#4f8' : '#f44';
                ctx.font = 'bold 12px monospace';
                ctx.fillText(costText, panelX + 95, panelY + 20);

                // Show resulting gold
                const resultGold = playerGold + cartTotal;
                ctx.fillStyle = resultGold >= 0 ? '#888' : '#f44';
                ctx.font = '11px monospace';
                ctx.fillText('= ' + resultGold, panelX + 140, panelY + 20);
            }

            // Close X button
            const closeBtnX = panelX + panelW - 28;
            const closeBtnY = panelY + 6;
            ctx.fillStyle = '#633';
            ctx.fillRect(closeBtnX, closeBtnY, 22, 22);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('X', closeBtnX + 11, closeBtnY + 16);
            shopUIButtons.close = { x: closeBtnX, y: closeBtnY, w: 22, h: 22 };

            // === SHOP INVENTORY (top, green theme) ===
            const shopAreaX = panelX + padding;
            const shopAreaY = panelY + 35;
            const shopAreaW = invWidth - padding;

            ctx.fillStyle = 'rgba(40, 60, 40, 0.5)';
            ctx.fillRect(shopAreaX, shopAreaY, shopAreaW, shopSectionH);
            ctx.strokeStyle = '#4a7c59';
            ctx.lineWidth = 2;
            ctx.strokeRect(shopAreaX, shopAreaY, shopAreaW, shopSectionH);

            ctx.fillStyle = '#8f8';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('FOR SALE', shopAreaX + 8, shopAreaY + 16);

            // Draw shop items
            shopUIButtons.shopItems = [];
            const shopInv = shop.inventory || [];
            const availableGold = playerGold + cartTotal; // Gold after current cart
            for (let i = 0; i < Math.max(shopInv.length, cols * 2); i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const slotX = shopAreaX + padding + col * (SLOT_SIZE + slotGap);
                const slotY = shopAreaY + 25 + row * (SLOT_SIZE + slotGap);

                if (row >= shopRows) break;

                const inv = shopInv[i];
                const inCart = inv && shopCart.some(c => c.type === 'buy' && c.shopInvIdx === i);
                const canAfford = inv && (inCart || inv.buyPrice <= availableGold);

                // Slot background - gray out if can't afford
                if (inCart) {
                    ctx.fillStyle = '#3a5a3a';
                } else if (!canAfford && inv) {
                    ctx.fillStyle = '#1a1a1a'; // Darker for unaffordable
                } else {
                    ctx.fillStyle = '#2a3a2a';
                }
                ctx.fillRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                ctx.strokeStyle = inCart ? '#8f8' : (!canAfford && inv ? '#333' : '#4a5a4a');
                ctx.lineWidth = inCart ? 2 : 1;
                ctx.strokeRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);

                if (inv) {
                    // Draw item sprite (same as regular inventory)
                    const item = itemsData[inv.itemIndex];
                    const img = itemImages[inv.itemIndex];
                    if (item && img && img.complete) {
                        const frame = item.frames?.[item.idleFrame || 0];
                        if (frame) {
                            const scale = Math.min((SLOT_SIZE - 4) / frame.w, (SLOT_SIZE - 4) / frame.h);
                            const drawW = frame.w * scale;
                            const drawH = frame.h * scale;
                            const drawX = slotX + (SLOT_SIZE - drawW) / 2;
                            const drawY = slotY + (SLOT_SIZE - drawH) / 2;
                            // Gray out sprite if can't afford
                            if (!canAfford) ctx.globalAlpha = 0.4;
                            ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
                            ctx.globalAlpha = 1;
                        }
                    }

                    // Price below slot - red if can't afford
                    ctx.fillStyle = canAfford ? '#fc0' : '#844';
                    ctx.font = '9px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(inv.buyPrice + 'g', slotX + SLOT_SIZE/2, slotY + SLOT_SIZE + 10);

                    shopUIButtons.shopItems.push({ x: slotX, y: slotY, w: SLOT_SIZE, h: SLOT_SIZE, idx: i });
                }
            }

            // === PLAYER INVENTORY (bottom, blue theme - same as pressing I) ===
            const invAreaX = panelX + padding;
            const invAreaY = shopAreaY + shopSectionH + 10;
            const invAreaW = invWidth - padding;

            ctx.fillStyle = 'rgba(30, 30, 50, 0.5)';
            ctx.fillRect(invAreaX, invAreaY, invAreaW, sectionH);
            ctx.strokeStyle = '#557';
            ctx.lineWidth = 2;
            ctx.strokeRect(invAreaX, invAreaY, invAreaW, sectionH);

            ctx.fillStyle = '#aaf';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('YOUR INVENTORY', invAreaX + 8, invAreaY + 16);

            // Draw player inventory slots (same style as drawInventoryPopup)
            shopUIButtons.playerItems = [];
            const totalSlots = cols * playerRows;
            for (let i = 0; i < totalSlots; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const slotX = invAreaX + padding + col * (SLOT_SIZE + slotGap);
                const slotY = invAreaY + 25 + row * (SLOT_SIZE + slotGap);

                const slot = inventorySlots[i];
                const inCart = slot && shopCart.some(c => c.type === 'sell' && c.playerSlotIdx === i);

                // Slot background - hotbar slots get slight highlight
                if (i < HOTBAR_SIZE) {
                    ctx.fillStyle = inCart ? '#5a3a5a' : '#3a3a4a';
                } else {
                    ctx.fillStyle = inCart ? '#5a3a5a' : '#333';
                }
                ctx.fillRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                ctx.strokeStyle = inCart ? '#f8f' : (i < HOTBAR_SIZE ? '#666' : '#444');
                ctx.lineWidth = inCart ? 2 : 1;
                ctx.strokeRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);

                if (slot) {
                    // Draw item sprite (same as regular inventory)
                    const item = itemsData[slot.itemIndex];
                    const img = itemImages[slot.itemIndex];
                    if (item && img && img.complete) {
                        const frame = item.frames?.[item.idleFrame || 0];
                        if (frame) {
                            const scale = Math.min((SLOT_SIZE - 4) / frame.w, (SLOT_SIZE - 4) / frame.h);
                            const drawW = frame.w * scale;
                            const drawH = frame.h * scale;
                            const drawX = slotX + (SLOT_SIZE - drawW) / 2;
                            const drawY = slotY + (SLOT_SIZE - drawH) / 2;
                            ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
                        }
                    }

                    // Quantity
                    if (slot.quantity > 1) {
                        ctx.fillStyle = '#fff';
                        ctx.strokeStyle = '#000';
                        ctx.font = 'bold 11px monospace';
                        ctx.textAlign = 'right';
                        ctx.textBaseline = 'bottom';
                        ctx.lineWidth = 2;
                        ctx.strokeText(slot.quantity, slotX + SLOT_SIZE - 2, slotY + SLOT_SIZE - 2);
                        ctx.fillText(slot.quantity, slotX + SLOT_SIZE - 2, slotY + SLOT_SIZE - 2);
                        ctx.textBaseline = 'alphabetic';
                    }

                    // Calculate sell price
                    const buyEntry = shop.buyList?.find(b => b.itemIndex === slot.itemIndex);
                    const itemDef = itemsData[slot.itemIndex];
                    const sellPrice = buyEntry ? buyEntry.sellPrice : Math.floor((itemDef?.basePrice || 10) * (shop.defaultSellRate || 50) / 100);

                    shopUIButtons.playerItems.push({
                        x: slotX, y: slotY, w: SLOT_SIZE, h: SLOT_SIZE,
                        idx: i, sellPrice: sellPrice
                    });
                } else {
                    shopUIButtons.playerItems.push({ x: slotX, y: slotY, w: SLOT_SIZE, h: SLOT_SIZE, idx: i, sellPrice: 0 });
                }
            }

            // === CART SUMMARY (right side) ===
            const cartX = panelX + invWidth + 5;
            const cartY = panelY + 35;
            const cartW = 105;
            const cartH = shopSectionH + sectionH;

            ctx.fillStyle = 'rgba(40, 40, 50, 0.8)';
            ctx.fillRect(cartX, cartY, cartW, cartH);
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 1;
            ctx.strokeRect(cartX, cartY, cartW, cartH);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('CART', cartX + cartW/2, cartY + 14);

            // List cart items
            ctx.font = '9px monospace';
            ctx.textAlign = 'left';
            let cartListY = cartY + 30;
            const maxCartShow = Math.floor((cartH - 60) / 14);
            shopCart.slice(0, maxCartShow).forEach((c, i) => {
                ctx.fillStyle = c.type === 'buy' ? '#f88' : '#8f8';
                const prefix = c.type === 'buy' ? '-' : '+';
                ctx.fillText(prefix + c.price + 'g', cartX + 5, cartListY + i * 14);
                ctx.fillStyle = '#ccc';
                ctx.fillText((c.name || '?').substring(0, 8), cartX + 40, cartListY + i * 14);
            });
            if (shopCart.length > maxCartShow) {
                ctx.fillStyle = '#888';
                ctx.fillText('+' + (shopCart.length - maxCartShow) + ' more', cartX + 5, cartListY + maxCartShow * 14);
            }
            if (shopCart.length === 0) {
                ctx.fillStyle = '#666';
                ctx.textAlign = 'center';
                ctx.font = '10px monospace';
                ctx.fillText('Cart empty', cartX + cartW/2, cartY + cartH/2);
            }

            // Cart total (using cartTotal from earlier in function)
            ctx.fillStyle = cartTotal >= 0 ? '#8f8' : '#f88';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            const totalText = (cartTotal >= 0 ? '+' : '') + cartTotal + 'g';
            ctx.fillText(totalText, cartX + cartW/2, cartY + cartH - 10);

            // === BOTTOM BUTTONS ===
            const btnY = panelY + panelH - 45;
            const btnH = 32;

            // Clear button
            const clearW = 70;
            const clearX = panelX + 20;
            ctx.fillStyle = '#444';
            ctx.fillRect(clearX, btnY, clearW, btnH);
            ctx.strokeStyle = '#666';
            ctx.strokeRect(clearX, btnY, clearW, btnH);
            ctx.fillStyle = '#ccc';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('CLEAR', clearX + clearW/2, btnY + 21);
            shopUIButtons.clear = { x: clearX, y: btnY, w: clearW, h: btnH };

            // Confirm button
            const confirmW = 120;
            const confirmX = panelX + panelW/2 - confirmW/2 - 30;
            const canConfirm = shopCart.length > 0 && (playerGold + cartTotal) >= 0;
            ctx.fillStyle = canConfirm ? '#4a7c59' : '#333';
            ctx.fillRect(confirmX, btnY, confirmW, btnH);
            ctx.strokeStyle = canConfirm ? '#8f8' : '#555';
            ctx.lineWidth = 2;
            ctx.strokeRect(confirmX, btnY, confirmW, btnH);
            ctx.fillStyle = canConfirm ? '#fff' : '#666';
            ctx.font = 'bold 12px monospace';
            ctx.fillText('CONFIRM', confirmX + confirmW/2, btnY + 21);
            shopUIButtons.confirm = { x: confirmX, y: btnY, w: confirmW, h: btnH };

            // Close button
            const closeBtnW = 70;
            const closeBtnX2 = panelX + panelW - 20 - closeBtnW;
            ctx.fillStyle = '#633';
            ctx.fillRect(closeBtnX2, btnY, closeBtnW, btnH);
            ctx.strokeStyle = '#a66';
            ctx.strokeRect(closeBtnX2, btnY, closeBtnW, btnH);
            ctx.fillStyle = '#fff';
            ctx.fillText('CLOSE', closeBtnX2 + closeBtnW/2, btnY + 21);
            shopUIButtons.closeBtn = { x: closeBtnX2, y: btnY, w: closeBtnW, h: btnH };

            // Affordability warning
            if (shopCart.length > 0 && (playerGold + cartTotal) < 0) {
                ctx.fillStyle = '#f44';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('Not enough gold!', panelX + panelW/2, btnY - 8);
            }
        }

        function handleShopClick(clickX, clickY) {
            if (!shopOpen) return false;

            const shop = shops[activeShopIndex];
            if (!shop) return true;

            // Close buttons
            if (shopUIButtons.close && isInRect(clickX, clickY, shopUIButtons.close)) {
                closeShop();
                return true;
            }
            if (shopUIButtons.closeBtn && isInRect(clickX, clickY, shopUIButtons.closeBtn)) {
                closeShop();
                return true;
            }

            // Clear cart
            if (shopUIButtons.clear && isInRect(clickX, clickY, shopUIButtons.clear)) {
                shopCart = [];
                return true;
            }

            // Confirm transaction
            if (shopUIButtons.confirm && isInRect(clickX, clickY, shopUIButtons.confirm)) {
                if (shopCart.length > 0 && (playerGold + getCartTotal()) >= 0) {
                    executeShopTransaction();
                }
                return true;
            }

            // Click on shop item (add to cart as buy)
            if (shopUIButtons.shopItems) {
                for (const btn of shopUIButtons.shopItems) {
                    if (isInRect(clickX, clickY, btn)) {
                        const inv = shop.inventory[btn.idx];
                        const existing = shopCart.findIndex(c => c.type === 'buy' && c.shopInvIdx === btn.idx);
                        if (existing >= 0) {
                            shopCart.splice(existing, 1); // Remove from cart
                        } else {
                            // Check if player can afford this item with current cart
                            const currentTotal = getCartTotal();
                            const newTotal = currentTotal - inv.buyPrice;
                            if (playerGold + newTotal < 0) {
                                // Can't afford - don't add to cart
                                console.log('[SHOP] Cannot afford item, need', inv.buyPrice, 'but only have', playerGold + currentTotal);
                                return true;
                            }
                            const itemDef = itemsData[inv.itemIndex];
                            shopCart.push({
                                type: 'buy',
                                shopInvIdx: btn.idx,
                                itemIndex: inv.itemIndex,
                                price: inv.buyPrice,
                                name: itemDef?.name || 'Item'
                            });
                        }
                        return true;
                    }
                }
            }

            // Click on player item (add to cart as sell)
            if (shopUIButtons.playerItems) {
                for (const btn of shopUIButtons.playerItems) {
                    if (isInRect(clickX, clickY, btn)) {
                        const slot = inventorySlots[btn.idx];
                        if (slot) {
                            const existing = shopCart.findIndex(c => c.type === 'sell' && c.playerSlotIdx === btn.idx);
                            if (existing >= 0) {
                                shopCart.splice(existing, 1); // Remove from cart
                            } else {
                                const itemDef = itemsData[slot.itemIndex];
                                const buyEntry = shop.buyList?.find(b => b.itemIndex === slot.itemIndex);
                                const sellPrice = buyEntry ? buyEntry.sellPrice : Math.floor((itemDef?.basePrice || 10) * (shop.defaultSellRate || 50) / 100);
                                shopCart.push({
                                    type: 'sell',
                                    playerSlotIdx: btn.idx,
                                    itemIndex: slot.itemIndex,
                                    price: sellPrice,
                                    name: itemDef?.name || 'Item'
                                });
                            }
                        }
                        return true;
                    }
                }
            }

            return true;
        }

        function executeShopTransaction() {
            // Process all cart items
            shopCart.forEach(c => {
                if (c.type === 'buy') {
                    const added = addToInventory(c.itemIndex, 1);
                    if (added) playerGold -= c.price;
                } else {
                    // Remove item from player inventory
                    const slot = inventorySlots[c.playerSlotIdx];
                    if (slot) {
                        playerGold += c.price;
                        slot.quantity--;
                        if (slot.quantity <= 0) {
                            inventorySlots[c.playerSlotIdx] = null;
                        }
                    }
                }
            });
            shopCart = [];
            console.log('[SHOP] Transaction complete. Gold:', playerGold);
        }

        function isInRect(x, y, rect) {
            return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
        }

        function checkShopInteraction() {
            // Check if player is near an NPC with a shop
            const tileSize = gridSize * TILE_SCALE;
            const playerTileX = Math.floor(player.x / tileSize);
            const playerTileY = Math.floor(player.y / tileSize);

            for (let i = 0; i < placedNpcs.length; i++) {
                const npc = placedNpcs[i];
                if (npc.mapName && npc.mapName !== currentGameMap) continue;
                if (npc.shopIndex === undefined || npc.shopIndex < 0) continue;

                const dist = Math.abs(npc.x - playerTileX) + Math.abs(npc.y - playerTileY);
                if (dist <= 1) {
                    return { shopIndex: npc.shopIndex, npc: npc };
                }
            }
            return null;
        }

        // Draw full inventory popup
        function drawInventoryPopup() {
            const cols = 10;
            const rows = 4;
            const padding = 20;
            const invWidth = cols * SLOT_SIZE + (cols - 1) * 2 + padding * 2;
            const invHeight = rows * SLOT_SIZE + (rows - 1) * 2 + padding * 2 + 30; // +30 for title
            const invX = (canvas.width - invWidth) / 2;
            const invY = (canvas.height - invHeight) / 2;

            // Darken background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Inventory panel
            ctx.fillStyle = 'rgba(30, 30, 40, 0.95)';
            ctx.fillRect(invX, invY, invWidth, invHeight);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(invX, invY, invWidth, invHeight);

            // Title
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('INVENTORY', canvas.width / 2, invY + 10);

            // Draw slots
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const slotIdx = row * cols + col;
                    const slotX = invX + padding + col * (SLOT_SIZE + 2);
                    const slotY = invY + padding + 30 + row * (SLOT_SIZE + 2);
                    const slot = inventorySlots[slotIdx];

                    // Slot background - highlight hotbar slots
                    if (slotIdx < HOTBAR_SIZE) {
                        ctx.fillStyle = slotIdx === selectedHotbarSlot ? '#555' : '#3a3a4a';
                    } else {
                        ctx.fillStyle = '#333';
                    }
                    ctx.fillRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                    ctx.strokeStyle = slotIdx < HOTBAR_SIZE ? '#888' : '#555';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);

                    // Draw item if slot has one
                    if (slot) {
                        const item = itemsData[slot.itemIndex];
                        const img = itemImages[slot.itemIndex];
                        if (item && img && img.complete) {
                            const frame = item.frames[item.idleFrame || 0];
                            if (frame) {
                                const scale = Math.min((SLOT_SIZE - 4) / frame.w, (SLOT_SIZE - 4) / frame.h);
                                const drawW = frame.w * scale;
                                const drawH = frame.h * scale;
                                const drawX = slotX + (SLOT_SIZE - drawW) / 2;
                                const drawY = slotY + (SLOT_SIZE - drawH) / 2;
                                ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
                            }
                        }

                        // Draw quantity
                        if (slot.quantity > 1) {
                            ctx.fillStyle = '#fff';
                            ctx.strokeStyle = '#000';
                            ctx.font = 'bold 12px monospace';
                            ctx.textAlign = 'right';
                            ctx.textBaseline = 'bottom';
                            ctx.lineWidth = 2;
                            ctx.strokeText(slot.quantity, slotX + SLOT_SIZE - 2, slotY + SLOT_SIZE - 2);
                            ctx.fillText(slot.quantity, slotX + SLOT_SIZE - 2, slotY + SLOT_SIZE - 2);
                        }
                    }
                }
            }

            // Draw cursor item if held
            if (cursorItem) {
                const item = itemsData[cursorItem.itemIndex];
                const img = itemImages[cursorItem.itemIndex];
                if (item && img && img.complete) {
                    const frame = item.frames[item.idleFrame || 0];
                    if (frame) {
                        const scale = Math.min((SLOT_SIZE - 4) / frame.w, (SLOT_SIZE - 4) / frame.h);
                        const drawW = frame.w * scale;
                        const drawH = frame.h * scale;
                        ctx.globalAlpha = 0.8;
                        ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h,
                            mouseX - drawW / 2, mouseY - drawH / 2, drawW, drawH);
                        ctx.globalAlpha = 1;

                        if (cursorItem.quantity > 1) {
                            ctx.fillStyle = '#fff';
                            ctx.strokeStyle = '#000';
                            ctx.font = 'bold 12px monospace';
                            ctx.textAlign = 'right';
                            ctx.textBaseline = 'bottom';
                            ctx.lineWidth = 2;
                            ctx.strokeText(cursorItem.quantity, mouseX + SLOT_SIZE/2, mouseY + SLOT_SIZE/2);
                            ctx.fillText(cursorItem.quantity, mouseX + SLOT_SIZE/2, mouseY + SLOT_SIZE/2);
                        }
                    }
                }
            }

            // Instructions
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '11px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('Click to pick up/swap items | Press I to close', canvas.width / 2, invY + invHeight - 5);
        }

        // Helper for drawing tiles with rotation and flip in test game
        function drawTileWithEffects(ctx, img, srcX, srcY, srcSize, destX, destY, destSize, rotation, flipped) {
            // Round to integers to prevent tile seams from floating point errors
            const dx = Math.round(destX);
            const dy = Math.round(destY);

            // Fast path: no rotation or flip - skip expensive save/restore
            if (!rotation && !flipped) {
                ctx.drawImage(img, srcX, srcY, srcSize, srcSize, dx, dy, destSize, destSize);
                return;
            }

            // Slow path: needs transforms
            ctx.save();
            ctx.translate(dx + destSize / 2, dy + destSize / 2);

            if (rotation !== 0) {
                ctx.rotate(rotation * Math.PI / 180);
            }
            if (flipped) {
                ctx.scale(-1, 1); // Flip horizontally
            }

            ctx.drawImage(img, srcX, srcY, srcSize, srcSize, -destSize / 2, -destSize / 2, destSize, destSize);
            ctx.restore();
        }

        function drawLayer(li, camX, camY, tileSize) {
            if (!layerVisibility[li]) return 0;
            const layer = layers[li];
            if (!layer) return 0;

            // Calculate visible tile range with generous buffer (10 tiles) to prevent pop-in
            const buffer = 10;
            const viewWidth = canvas.width / cameraZoom;
            const viewHeight = canvas.height / cameraZoom;
            const startX = Math.max(0, Math.floor(camX / tileSize) - buffer);
            const endX = Math.min(mapCols, Math.ceil((camX + viewWidth) / tileSize) + buffer);
            const startY = Math.max(0, Math.floor(camY / tileSize) - buffer);
            const endY = Math.min(mapRows, Math.ceil((camY + viewHeight) / tileSize) + buffer);

            let count = 0;
            for (let y = startY; y < endY; y++) {
                if (!layer[y]) continue;
                for (let x = startX; x < endX; x++) {
                    const cell = layer[y][x];
                    if (!cell) continue;

                    // Use exact integer positions - no overlap to avoid double-drawing semi-transparent pixels
                    const px = x * tileSize - camX;
                    const py = y * tileSize - camY;

                    if (cell.type === 'tile') {
                        count++;
                        // Use correct tileset for this tile
                        const cellTileset = tilesetImages[cell.tilesetIndex || 0] || tilesetImages[0];
                        if (cellTileset) {
                            // Draw at exact pixel positions - no overlap needed since tileSize is integer
                            drawTileWithEffects(ctx, cellTileset, cell.x, cell.y, gridSize, px, py, tileSize, cell.rotation || 0, cell.flipped || false);
                        } else {
                            // Fallback: draw colored rectangle if tileset not loaded
                            ctx.fillStyle = '#4a7c59';
                            ctx.fillRect(px, py, tileSize, tileSize);
                        }

                        // Draw collision overlay if debug enabled (all layers)
                        if (showCollision) {
                            // Include tileset index in collision key
                            const tilesetIdx = cell.tilesetIndex || 0;
                            const key = tilesetIdx + ':' + cell.x + ',' + cell.y;
                            const mask = collisionMasks[key];

                            if (mask) {
                                // Draw pixel-level collision
                                const pixelSize = tileSize / gridSize;
                                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                                for (let my = 0; my < gridSize; my++) {
                                    for (let mx = 0; mx < gridSize; mx++) {
                                        if (mask[my] && mask[my][mx]) {
                                            ctx.fillRect(
                                                px + mx * pixelSize,
                                                py + my * pixelSize,
                                                pixelSize,
                                                pixelSize
                                            );
                                        }
                                    }
                                }
                            } else if (tileCollisions[key]) {
                                // Full tile collision
                                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                                ctx.fillRect(px, py, tileSize, tileSize);
                            }
                        }
                    } else if (cell.type === 'prop') {
                        const propIdx = cell.propIndex || 0;
                        const propImg = propImages[propIdx];
                        if (propImg && propImg.complete) {
                            count++;
                            ctx.drawImage(propImg, cell.x, cell.y, gridSize, gridSize, px, py, tileSize, tileSize);
                        }

                        // Show collision in debug mode
                        if (showCollision) {
                            const key = cell.x + ',' + cell.y;
                            const mask = propCollisionMasksAll[propIdx] ? propCollisionMasksAll[propIdx][key] : null;
                            if (mask) {
                                const pixelSize = tileSize / gridSize;
                                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                                for (let my = 0; my < gridSize; my++) {
                                    for (let mx = 0; mx < gridSize; mx++) {
                                        if (mask[my] && mask[my][mx]) {
                                            ctx.fillRect(px + mx * pixelSize, py + my * pixelSize, pixelSize, pixelSize);
                                        }
                                    }
                                }
                            }
                        }
                    } else if (cell.type === 'animTile') {
                        // Animated tile - cycles through frames like a regular tile
                        const propData = animatedPropsData[cell.propIndex];
                        const propImg = animPropImages[cell.propIndex];
                        if (propData && propImg && propImg.complete && propData.frames && propData.frames.length > 0) {
                            // Use origin tile position for synced animation
                            const originX = x - (cell.offsetX || 0);
                            const originY = y - (cell.offsetY || 0);
                            const key = originX + ',' + originY + ',' + li;
                            const timer = animPropFrameTimers[key] || { frame: 0 };
                            const frameIdx = timer.frame % propData.frames.length;
                            const frame = propData.frames[frameIdx];

                            // Draw only this tile's portion of the frame
                            const offsetX = cell.offsetX || 0;
                            const offsetY = cell.offsetY || 0;
                            const srcX = frame.x + offsetX * gridSize;
                            const srcY = frame.y + offsetY * gridSize;

                            count++;
                            // Draw with rotation support
                            const rot = cell.rotation || 0;
                            if (rot === 0) {
                                ctx.drawImage(propImg, srcX, srcY, gridSize, gridSize, px, py, tileSize, tileSize);
                            } else {
                                ctx.save();
                                ctx.translate(px + tileSize / 2, py + tileSize / 2);
                                ctx.rotate(rot * Math.PI / 180);
                                ctx.drawImage(propImg, srcX, srcY, gridSize, gridSize, -tileSize / 2, -tileSize / 2, tileSize, tileSize);
                                ctx.restore();
                            }
                        }
                    }
                }
            }

            return count;
        }

        // === Y-SORTING FUNCTIONS ===

        // Object pool for Y-sorting to avoid GC pauses
        // Pre-allocated array and objects - reuse instead of creating new ones each frame
        const ENTITY_POOL_SIZE = 200; // Max entities to Y-sort (player + NPCs + items + other players)
        const entityPool = [];
        for (let i = 0; i < ENTITY_POOL_SIZE; i++) {
            entityPool.push({ type: '', gridY: 0, subSort: 0, npcIndex: -1, itemIndex: -1, placedIndex: -1, playerId: null });
        }
        let entityPoolUsed = 0;

        // Original Y-sorting: Y position is primary, layer is tiebreaker
        function drawYSortedEntities(camX, camY, tileSize) {
            // OPTIMIZED: Draw tiles by row order (no sorting needed), interleave moving entities
            // This avoids creating/sorting a 16k+ element array every frame!
            // FURTHER OPTIMIZED: Reuse pooled objects to eliminate GC pauses

            // Calculate visible tile range (reduced buffer from 10 to 4 for performance)
            const buffer = 4;
            const viewWidth = canvas.width / cameraZoom;
            const viewHeight = canvas.height / cameraZoom;
            const startX = Math.max(0, Math.floor(camX / tileSize) - buffer);
            const endX = Math.min(mapCols, Math.ceil((camX + viewWidth) / tileSize) + buffer);
            const startY = Math.max(0, Math.floor(camY / tileSize) - buffer);
            const endY = Math.min(mapRows, Math.ceil((camY + viewHeight) / tileSize) + buffer);

            const playerLayer = playerLayerIndex || 1;

            // Reset pool counter (reuse pre-allocated objects instead of creating new ones)
            entityPoolUsed = 0;

            // Helper to get next pooled entity
            function getPooledEntity(type, gridY, subSort) {
                if (entityPoolUsed >= ENTITY_POOL_SIZE) return null; // Safety limit
                const e = entityPool[entityPoolUsed++];
                e.type = type;
                e.gridY = gridY;
                e.subSort = subSort;
                e.npcIndex = -1;
                e.itemIndex = -1;
                e.placedIndex = -1;
                e.playerId = null;
                return e;
            }

            // Add player
            const playerGridY = Math.floor((player.y + player.height) / (gridSize * TILE_SCALE));
            getPooledEntity('player', playerGridY, 0.5);

            // Add NPCs on current map
            for (let i = 0; i < placedNpcs.length; i++) {
                const placed = placedNpcs[i];
                if (placed.mapName && placed.mapName !== currentGameMap) continue;
                const state = npcRuntimeState[i];
                if (!state) continue;
                const npc = npcs[placed.npcIndex];
                if (!npc) continue;

                const npcGridY = Math.floor((state.y + gridSize) / gridSize);
                const e = getPooledEntity('npc', npcGridY, 0.4);
                if (e) e.npcIndex = i;
            }

            // Add items on current map
            for (let i = 0; i < placedItemsData.length; i++) {
                const placed = placedItemsData[i];
                if (placed.mapName && placed.mapName !== currentGameMap) continue;
                const item = itemsData[placed.itemIndex];
                if (!item) continue;

                const e = getPooledEntity('item', placed.y + 1, 0.3);
                if (e) e.itemIndex = i;
            }

            // Add static objects on current map
            for (let i = 0; i < placedStaticObjectsData.length; i++) {
                const placed = placedStaticObjectsData[i];
                if (placed.mapName && placed.mapName !== currentGameMap) continue;
                const obj = staticObjectsData[placed.objIndex];
                if (!obj) continue;

                const e = getPooledEntity('staticObj', placed.y + (obj.height || 1), 0.2);
                if (e) e.placedIndex = i;
            }

            // Add other multiplayer players
            otherPlayers.forEach((other, odId) => {
                if (other.inTavern || other.currentMap !== currentGameMap) return;
                const otherGridY = Math.floor((other.y + player.height) / (gridSize * TILE_SCALE));
                const e = getPooledEntity('otherPlayer', otherGridY, 0.45);
                if (e) e.playerId = odId;
            });

            // Sort only the used portion of the pool (typically < 50 items)
            // Use a view into the pool array to avoid creating new array
            const usedCount = entityPoolUsed;
            // In-place sort of first N elements
            for (let i = 1; i < usedCount; i++) {
                const current = entityPool[i];
                let j = i - 1;
                while (j >= 0 && (entityPool[j].gridY > current.gridY ||
                       (entityPool[j].gridY === current.gridY && entityPool[j].subSort > current.subSort))) {
                    entityPool[j + 1] = entityPool[j];
                    j--;
                }
                entityPool[j + 1] = current;
            }

            // Track which moving entities we've drawn
            let entityIndex = 0;
            let count = 0;

            // Draw row by row, interleaving tiles and entities
            for (let y = startY; y < endY; y++) {
                // Draw all visible layers at this row (tiles are static, don't need sorting)
                for (let li = 1; li < layers.length; li++) {
                    if (!layerVisibility[li]) continue;
                    const layer = layers[li];
                    if (!layer || !layer[y]) continue;

                    for (let x = startX; x < endX; x++) {
                        const cell = layer[y][x];
                        if (!cell) continue;

                        if (cell.type === 'tile') {
                            const key = (cell.tilesetIndex || 0) + ':' + cell.x + ',' + cell.y;
                            const splitData = tileSplitLines[key];
                            if (splitData !== undefined && splitData !== null) {
                                drawTileTrunk(cell, x, y, camX, camY, tileSize);
                            } else {
                                drawTileFull(cell, x, y, camX, camY, tileSize);
                            }
                            count++;
                        } else if (cell.type === 'animTile') {
                            const propData = animatedPropsData[cell.propIndex];
                            const hasSplit = propData && propData.splitLine !== null && propData.splitLine !== undefined &&
                                (typeof propData.splitLine === 'number' ||
                                 (typeof propData.splitLine === 'object' && Object.keys(propData.splitLine).length > 0));
                            if (hasSplit) {
                                drawAnimTileTrunk(cell, x, y, li, camX, camY, tileSize);
                            } else {
                                drawAnimTile(cell, x, y, li, camX, camY, tileSize);
                            }
                            count++;
                        }
                    }
                }

                // After drawing tiles for this row, draw any entities at this Y
                while (entityIndex < usedCount && entityPool[entityIndex].gridY <= y) {
                    const e = entityPool[entityIndex];
                    if (e.type === 'player') {
                        drawPlayer();
                    } else if (e.type === 'otherPlayer') {
                        drawOtherPlayer(e.playerId, camX, camY);
                    } else if (e.type === 'npc') {
                        drawNPC(e.npcIndex, camX, camY, tileSize);
                    } else if (e.type === 'item') {
                        drawItem(e.itemIndex, camX, camY, tileSize);
                    } else if (e.type === 'staticObj') {
                        drawStaticObject(e.placedIndex, camX, camY, tileSize);
                    }
                    entityIndex++;
                }
            }

            // Draw any remaining entities below the visible area
            while (entityIndex < usedCount) {
                const e = entityPool[entityIndex];
                if (e.type === 'player') drawPlayer();
                else if (e.type === 'otherPlayer') drawOtherPlayer(e.playerId, camX, camY);
                else if (e.type === 'npc') drawNPC(e.npcIndex, camX, camY, tileSize);
                else if (e.type === 'item') drawItem(e.itemIndex, camX, camY, tileSize);
                else if (e.type === 'staticObj') drawStaticObject(e.placedIndex, camX, camY, tileSize);
                entityIndex++;
            }

            return count;
        }

        // Redraw content from higher layers that overlaps with canopy from lower layers
        function redrawHigherLayerContent(camX, camY, tileSize) {
            // Calculate visible tile range (reduced buffer from 10 to 4 for performance)
            const buffer = 4;
            const viewWidth = canvas.width / cameraZoom;
            const viewHeight = canvas.height / cameraZoom;
            const startX = Math.max(0, Math.floor(camX / tileSize) - buffer);
            const endX = Math.min(mapCols, Math.ceil((camX + viewWidth) / tileSize) + buffer);
            const startY = Math.max(0, Math.floor(camY / tileSize) - buffer);
            const endY = Math.min(mapRows, Math.ceil((camY + viewHeight) / tileSize) + buffer);

            // For each position that has canopy (split line), redraw any higher layer content
            for (let li = 1; li < layers.length; li++) {
                if (!layerVisibility[li]) continue;
                const layer = layers[li];
                if (!layer) continue;

                for (let y = startY; y < endY; y++) {
                    if (!layer[y]) continue;
                    for (let x = startX; x < endX; x++) {
                        const cell = layer[y][x];
                        if (!cell) continue;

                        // Check if this cell has canopy (split line)
                        let hasCanopy = false;
                        if (cell.type === 'tile') {
                            const key = (cell.tilesetIndex || 0) + ':' + cell.x + ',' + cell.y;
                            hasCanopy = tileSplitLines[key] !== undefined && tileSplitLines[key] !== null;
                        } else if (cell.type === 'animTile') {
                            const propData = animatedPropsData[cell.propIndex];
                            hasCanopy = propData && propData.splitLine !== null && propData.splitLine !== undefined;
                        }

                        if (!hasCanopy) continue;

                        // This cell has canopy - redraw any higher layer content at this position
                        for (let hi = li + 1; hi < layers.length; hi++) {
                            if (!layerVisibility[hi]) continue;
                            const higherLayer = layers[hi];
                            if (!higherLayer || !higherLayer[y] || !higherLayer[y][x]) continue;

                            const higherCell = higherLayer[y][x];
                            if (higherCell.type === 'animTile') {
                                drawAnimTile(higherCell, x, y, hi, camX, camY, tileSize);
                            } else if (higherCell.type === 'tile') {
                                drawTileFull(higherCell, x, y, camX, camY, tileSize);
                            }
                        }
                    }
                }
            }
        }

        function drawAnimTile(cell, tx, ty, li, camX, camY, tileSize) {
            const propData = animatedPropsData[cell.propIndex];
            const propImg = animPropImages[cell.propIndex];

            if (!propData || !propImg || !propImg.complete || !propData.frames || propData.frames.length === 0) {
                return;
            }

            // Round to integers to prevent tile seams
            const px = Math.round(tx * tileSize - camX);
            const py = Math.round(ty * tileSize - camY);

            // Use origin tile position for synced animation
            const originX = tx - (cell.offsetX || 0);
            const originY = ty - (cell.offsetY || 0);
            const key = originX + ',' + originY + ',' + li;
            const timer = animPropFrameTimers[key] || { frame: 0 };
            const frameIdx = timer.frame % propData.frames.length;
            const frame = propData.frames[frameIdx];

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

            // Scale offset from prop's center (not individual tile center)
            const propCenterOffsetX = (scaledPropWidth - propWidth) / 2;
            const propCenterOffsetY = (scaledPropHeight - propHeight) / 2;

            // This tile's position relative to origin
            const tileOffsetX = offsetX * tileSize;
            const tileOffsetY = offsetY * tileSize;

            // Scale tile offset from prop origin
            const scaledTileOffsetX = tileOffsetX * propScale;
            const scaledTileOffsetY = tileOffsetY * propScale;

            // Origin tile's screen position
            const originPx = Math.floor(originX * tileSize - camX);
            const originPy = Math.floor(originY * tileSize - camY);

            // Draw position: origin - center offset + scaled tile offset
            const drawX = originPx - propCenterOffsetX + scaledTileOffsetX;
            const drawY = originPy - propCenterOffsetY + scaledTileOffsetY;

            ctx.imageSmoothingEnabled = false;

            // Per-instance pixel nudge: fine-position the prop off the grid. Collision shifts to match (checkCollision).
            const _nx = (cell.nudgeX || 0) * (tileSize / gridSize);
            const _ny = (cell.nudgeY || 0) * (tileSize / gridSize);
            const _nudged = _nx || _ny;
            if (_nudged) { ctx.save(); ctx.translate(_nx, _ny); }

            // Per-instance horizontal mirror: reflect the whole prop about its screen-center
            // vertical axis. Wrapping the draw handles multi-tile + scale + rotation in one shot.
            const mirror = cell.mirror;
            if (mirror) {
                ctx.save();
                const centerScreenX = originPx - propCenterOffsetX + scaledPropWidth / 2;
                ctx.translate(centerScreenX, 0);
                ctx.scale(-1, 1);
                ctx.translate(-centerScreenX, 0);
            }

            // Draw with rotation support
            const rot = cell.rotation || 0;
            if (rot === 0) {
                ctx.drawImage(propImg, srcX, srcY, gridSize, gridSize, drawX, drawY, scaledTileSize, scaledTileSize);
            } else {
                ctx.save();
                const propCenterX = originPx + propWidth / 2;
                const propCenterY = originPy + propHeight / 2;
                ctx.translate(propCenterX, propCenterY);
                ctx.rotate(rot * Math.PI / 180);
                const rotDrawX = -scaledPropWidth / 2 + scaledTileOffsetX;
                const rotDrawY = -scaledPropHeight / 2 + scaledTileOffsetY;
                ctx.drawImage(propImg, srcX, srcY, gridSize, gridSize, rotDrawX, rotDrawY, scaledTileSize, scaledTileSize);
                ctx.restore();
            }

            if (mirror) ctx.restore();
            if (_nudged) ctx.restore();
        }

        // Draw only the trunk (bottom) portion of an animated tile with split line
        function drawAnimTileTrunk(cell, tx, ty, li, camX, camY, tileSize) {
            const propData = animatedPropsData[cell.propIndex];
            const propImg = animPropImages[cell.propIndex];
            if (!propData || !propImg || !propImg.complete) return;
            if (!propData.frames || propData.frames.length === 0) return;
            if (!propData.splitLine) return;

            // Round to integers to prevent tile seams (+ per-instance pixel nudge)
            const px = Math.round(tx * tileSize - camX + (cell.nudgeX || 0) * (tileSize / gridSize));
            const py = Math.round(ty * tileSize - camY + (cell.nudgeY || 0) * (tileSize / gridSize));
            const scale = tileSize / gridSize;

            // Use origin tile position for synced animation
            const originX = tx - (cell.offsetX || 0);
            const originY = ty - (cell.offsetY || 0);
            const key = originX + ',' + originY + ',' + li;
            const timer = animPropFrameTimers[key] || { frame: 0 };
            const frameIdx = timer.frame % propData.frames.length;
            const frame = propData.frames[frameIdx];

            // Calculate this tile's portion
            const offsetX = cell.offsetX || 0;
            const offsetY = cell.offsetY || 0;

            // Per-instance horizontal mirror (match drawAnimTile): reflect about the prop's screen-center.
            const mirror = cell.mirror;
            const _twTrunk = cell.tilesW || 1;
            const _cxTrunk = (originX * tileSize - camX) + (_twTrunk * tileSize) / 2 + (cell.nudgeX || 0) * (tileSize / gridSize);
            const blit = (sx, sy, sw, sh, dx, dy, dw, dh) => {
                if (mirror) { ctx.save(); ctx.translate(_cxTrunk, 0); ctx.scale(-1, 1); ctx.translate(-_cxTrunk, 0); }
                ctx.drawImage(propImg, sx, sy, sw, sh, dx, dy, dw, dh);
                if (mirror) ctx.restore();
            };

            // Get split Y for this specific tile within the prop
            const tileKey = offsetX + ',' + offsetY;
            let splitY = null;

            if (typeof propData.splitLine === 'object' && !Array.isArray(propData.splitLine)) {
                // Try per-frame format first: "frameIndex:tileX,tileY"
                const perFrameKey = frameIdx + ':' + tileKey;
                splitY = propData.splitLine[perFrameKey];

                // Fall back to shared format: "tileX,tileY"
                if (splitY === undefined || splitY === null) {
                    splitY = propData.splitLine[tileKey];
                }
            } else if (typeof propData.splitLine === 'number') {
                // Old format: single number (only applies to tile 0,0)
                if (offsetX === 0 && offsetY === 0) splitY = propData.splitLine;
            }

            // If no split for this tile, draw full tile
            if (splitY === null || splitY === undefined) {
                const srcX = frame.x + offsetX * gridSize;
                const srcY = frame.y + offsetY * gridSize;
                ctx.imageSmoothingEnabled = false;
                blit(srcX, srcY, gridSize, gridSize, px, py, tileSize, tileSize);
                return;
            }

            // Handle splitY being an array (freeform line) - use minimum for trunk rendering
            let localSplitY;
            if (Array.isArray(splitY)) {
                // Use minimum value for trunk rendering (draw trunk where split is lowest)
                localSplitY = Math.min(...splitY);
            } else {
                localSplitY = splitY;
            }

            // Only draw if split is within this tile
            if (localSplitY <= 0) {
                // Split is above this tile - draw full tile
                const srcX = frame.x + offsetX * gridSize;
                const srcY = frame.y + offsetY * gridSize;
                ctx.imageSmoothingEnabled = false;
                blit(srcX, srcY, gridSize, gridSize, px, py, tileSize, tileSize);
            } else if (localSplitY < gridSize) {
                // Split is within this tile - draw only trunk (below split)
                const srcX = frame.x + offsetX * gridSize;
                const srcY = frame.y + offsetY * gridSize + localSplitY;
                const srcH = gridSize - localSplitY;
                const destY = py + localSplitY * scale;
                const destH = srcH * scale;

                ctx.imageSmoothingEnabled = false;
                blit(srcX, srcY, gridSize, srcH, px, destY, tileSize, destH);
            }
            // If localSplitY >= gridSize, split is below this tile - don't draw trunk here
        }

        function drawTileFull(cell, tx, ty, camX, camY, tileSize) {
            const px = tx * tileSize - camX;
            const py = ty * tileSize - camY;
            const cellTileset = tilesetImages[cell.tilesetIndex || 0] || tilesetImages[0];

            if (cellTileset) {
                ctx.imageSmoothingEnabled = false;
                drawTileWithEffects(ctx, cellTileset, cell.x, cell.y, gridSize, px, py, tileSize, cell.rotation || 0, cell.flipped || false);
            }

            // Draw collision overlay if debug enabled
            if (showCollision) {
                const tilesetIdx = cell.tilesetIndex || 0;
                const key = tilesetIdx + ':' + cell.x + ',' + cell.y;
                const mask = collisionMasks[key];

                if (mask) {
                    const pixelSize = tileSize / gridSize;
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                    for (let my = 0; my < gridSize; my++) {
                        for (let mx = 0; mx < gridSize; mx++) {
                            if (mask[my] && mask[my][mx]) {
                                ctx.fillRect(px + mx * pixelSize, py + my * pixelSize, pixelSize, pixelSize);
                            }
                        }
                    }
                } else if (tileCollisions[key]) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                    ctx.fillRect(px, py, tileSize, tileSize);
                }
            }
        }

        function drawTileTrunk(cell, tx, ty, camX, camY, tileSize) {
            const key = (cell.tilesetIndex || 0) + ':' + cell.x + ',' + cell.y;
            const splitData = tileSplitLines[key];
            const cellTileset = tilesetImages[cell.tilesetIndex || 0] || tilesetImages[0];
            const isFlipped = tileSplitLineFlipped[key] || false;

            if (!cellTileset || splitData === undefined) return;

            // Round to integers to prevent tile seams
            const px = Math.round(tx * tileSize - camX);
            const py = Math.round(ty * tileSize - camY);
            const scale = tileSize / gridSize;

            ctx.imageSmoothingEnabled = false;

            // Handle rotation or flip
            const rot = cell.rotation || 0;
            if (rot !== 0 || cell.flipped) {
                // For rotated/flipped tiles, just draw full tile (rotation + split is complex)
                drawTileWithEffects(ctx, cellTileset, cell.x, cell.y, gridSize, px, py, tileSize, rot, cell.flipped || false);
                return;
            }

            // Draw trunk using clipping path for freeform line
            ctx.save();
            ctx.beginPath();

            const splitYArray = resolveSplitArray(splitData, gridSize);

            if (isFlipped) {
                // FLIPPED: Trunk is ABOVE the split line (top portion is Y-sorted)
                // Start at top-left, go along top edge
                ctx.moveTo(px, py);
                ctx.lineTo(px + tileSize, py);
                // Go down right edge to last split point
                ctx.lineTo(px + tileSize, py + splitYArray[gridSize - 1] * scale);
                // Draw along the split line (right to left)
                for (let col = gridSize - 1; col >= 0; col--) {
                    const splitY = splitYArray[col];
                    ctx.lineTo(px + (col + 1) * scale, py + splitY * scale);
                    ctx.lineTo(px + col * scale, py + splitY * scale);
                }
                // Close back to top-left
                ctx.lineTo(px, py);
            } else {
                // NORMAL: Trunk is BELOW the split line (bottom portion is Y-sorted)
                // Start at bottom-left, go up the left edge to first split point
                ctx.moveTo(px, py + tileSize);
                ctx.lineTo(px, py + splitYArray[0] * scale);
                // Draw along the split line (left to right)
                for (let col = 0; col < gridSize; col++) {
                    const splitY = splitYArray[col];
                    ctx.lineTo(px + col * scale, py + splitY * scale);
                    ctx.lineTo(px + (col + 1) * scale, py + splitY * scale);
                }
                // Go down right edge and close
                ctx.lineTo(px + tileSize, py + tileSize);
            }
            ctx.closePath();
            ctx.clip();

            // Draw the full tile, clipped to trunk region
            ctx.drawImage(cellTileset, cell.x, cell.y, gridSize, gridSize, px, py, tileSize, tileSize);
            ctx.restore();

            // Draw collision overlay if debug enabled
            if (showCollision) {
                const mask = collisionMasks[key];
                if (mask) {
                    const pixelSize = tileSize / gridSize;
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                    for (let my = 0; my < gridSize; my++) {
                        for (let mx = 0; mx < gridSize; mx++) {
                            if (mask[my] && mask[my][mx]) {
                                ctx.fillRect(px + mx * pixelSize, py + my * pixelSize, pixelSize, pixelSize);
                            }
                        }
                    }
                } else if (tileCollisions[key]) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                    ctx.fillRect(px, py, tileSize, tileSize);
                }
            }
        }

        function drawCanopyOverlay(camX, camY, tileSize) {
            // Calculate visible tile range with generous buffer (10 tiles)
            const buffer = 10;
            const viewWidth = canvas.width / cameraZoom;
            const viewHeight = canvas.height / cameraZoom;
            const startX = Math.max(0, Math.floor(camX / tileSize) - buffer);
            const endX = Math.min(mapCols, Math.ceil((camX + viewWidth) / tileSize) + buffer);
            const startY = Math.max(0, Math.floor(camY / tileSize) - buffer);
            const endY = Math.min(mapRows, Math.ceil((camY + viewHeight) / tileSize) + buffer);

            // Draw canopy portions (above split line) for all split tiles
            for (let li = 1; li < layers.length; li++) {
                if (!layerVisibility[li]) continue;
                const layer = layers[li];
                if (!layer) continue;

                for (let y = startY; y < endY; y++) {
                    if (!layer[y]) continue;
                    for (let x = startX; x < endX; x++) {
                        const cell = layer[y][x];
                        if (!cell) continue;

                        // Round to integers to prevent tile seams
                        const px = Math.round(x * tileSize - camX);
                        const py = Math.round(y * tileSize - camY);
                        const scale = tileSize / gridSize;

                        if (cell.type === 'tile') {
                            const key = (cell.tilesetIndex || 0) + ':' + cell.x + ',' + cell.y;
                            const splitData = tileSplitLines[key];
                            if (splitData === undefined || splitData === null) continue;

                            const cellTileset = tilesetImages[cell.tilesetIndex || 0] || tilesetImages[0];
                            if (!cellTileset) continue;
                            const isFlipped = tileSplitLineFlipped[key] || false;

                            ctx.imageSmoothingEnabled = false;

                            // Handle rotation / flip
                            const rot = cell.rotation || 0;
                            // Skip rotated OR flipped tiles — drawTileTrunk already drew them FULL
                            // (its early-return fires on rot !== 0 OR cell.flipped). Without the
                            // cell.flipped check here, a flipped tile's canopy was redrawn UN-flipped on
                            // top of the full flipped tile, scrambling the crown/holes.
                            if (rot !== 0 || cell.flipped) continue;

                            // Draw canopy using clipping path for freeform line
                            ctx.save();
                            ctx.beginPath();

                            const splitYArray = resolveSplitArray(splitData, gridSize);

                            if (isFlipped) {
                                // FLIPPED: Canopy is BELOW the split line (bottom portion covers player)
                                // Start at bottom-left, go up the left edge to first split point
                                ctx.moveTo(px, py + tileSize);
                                ctx.lineTo(px, py + splitYArray[0] * scale);
                                // Draw along the split line (left to right)
                                for (let col = 0; col < gridSize; col++) {
                                    const splitY = splitYArray[col];
                                    ctx.lineTo(px + col * scale, py + splitY * scale);
                                    ctx.lineTo(px + (col + 1) * scale, py + splitY * scale);
                                }
                                // Go down right edge and close
                                ctx.lineTo(px + tileSize, py + tileSize);
                            } else {
                                // NORMAL: Canopy is ABOVE the split line (top portion covers player)
                                // Start at top-left, go along top edge
                                ctx.moveTo(px, py);
                                ctx.lineTo(px + tileSize, py);
                                // Go down right edge to last split point
                                ctx.lineTo(px + tileSize, py + splitYArray[gridSize - 1] * scale);
                                // Draw along the split line (right to left)
                                for (let col = gridSize - 1; col >= 0; col--) {
                                    const splitY = splitYArray[col];
                                    ctx.lineTo(px + (col + 1) * scale, py + splitY * scale);
                                    ctx.lineTo(px + col * scale, py + splitY * scale);
                                }
                                // Go up left edge and close
                                ctx.lineTo(px, py);
                            }
                            ctx.closePath();
                            ctx.clip();

                            // Draw the full tile, clipped to canopy region
                            ctx.drawImage(cellTileset, cell.x, cell.y, gridSize, gridSize, px, py, tileSize, tileSize);
                            ctx.restore();

                        } else if (cell.type === 'animTile') {
                            // Animated tile canopy
                            const propData = animatedPropsData[cell.propIndex];
                            const propImg = animPropImages[cell.propIndex];
                            if (!propData || !propImg || !propImg.complete) continue;
                            if (propData.splitLine === null || propData.splitLine === undefined) continue;
                            if (!propData.frames || propData.frames.length === 0) continue;

                            // Get current animation frame
                            const originX = x - (cell.offsetX || 0);
                            const originY = y - (cell.offsetY || 0);
                            const key = originX + ',' + originY + ',' + li;
                            const timer = animPropFrameTimers[key] || { frame: 0 };
                            const frameIdx = timer.frame % propData.frames.length;
                            const frame = propData.frames[frameIdx];

                            const offsetX = cell.offsetX || 0;
                            const offsetY = cell.offsetY || 0;

                            // Get split Y for this specific tile within the prop
                            const tileKey = offsetX + ',' + offsetY;
                            let splitY = null;

                            if (typeof propData.splitLine === 'object' && !Array.isArray(propData.splitLine)) {
                                // Try per-frame format first: "frameIndex:tileX,tileY"
                                const perFrameKey = frameIdx + ':' + tileKey;
                                splitY = propData.splitLine[perFrameKey];

                                // Fall back to shared format: "tileX,tileY"
                                if (splitY === undefined || splitY === null) {
                                    splitY = propData.splitLine[tileKey];
                                }
                            } else if (typeof propData.splitLine === 'number') {
                                // Old format: single number (only applies to tile 0,0)
                                if (offsetX === 0 && offsetY === 0) splitY = propData.splitLine;
                            }

                            // If no split for this tile, skip canopy
                            if (splitY === null || splitY === undefined) continue;

                            // Handle splitY being an array (freeform line) - use maximum for canopy rendering
                            let localSplitY;
                            if (Array.isArray(splitY)) {
                                // Use maximum value for canopy rendering (draw canopy where split is highest)
                                localSplitY = Math.max(...splitY);
                            } else {
                                localSplitY = splitY;
                            }

                            // Only draw canopy if split is within this tile
                            if (localSplitY > 0 && localSplitY < gridSize) {
                                const srcX = frame.x + offsetX * gridSize;
                                const srcY = frame.y + offsetY * gridSize;
                                const srcH = localSplitY;
                                const destH = srcH * scale;

                                ctx.imageSmoothingEnabled = false;
                                ctx.drawImage(propImg, srcX, srcY, gridSize, srcH, px, py, tileSize, destH);
                            } else if (localSplitY >= gridSize) {
                                // Full tile is canopy (split at bottom)
                                const srcX = frame.x + offsetX * gridSize;
                                const srcY = frame.y + offsetY * gridSize;

                                ctx.imageSmoothingEnabled = false;
                                ctx.drawImage(propImg, srcX, srcY, gridSize, gridSize, px, py, tileSize, tileSize);
                            }
                        }
                    }
                }
            }
        }

        // Draw collision debug overlay on top of everything (for split tiles that get covered by canopy)
        function drawCollisionDebugOverlay(camX, camY, tileSize) {
            const pixelSize = tileSize / gridSize;

            // Calculate visible tile range with generous buffer (10 tiles)
            const buffer = 10;
            const viewWidth = canvas.width / cameraZoom;
            const viewHeight = canvas.height / cameraZoom;
            const startX = Math.max(0, Math.floor(camX / tileSize) - buffer);
            const endX = Math.min(mapCols, Math.ceil((camX + viewWidth) / tileSize) + buffer);
            const startY = Math.max(0, Math.floor(camY / tileSize) - buffer);
            const endY = Math.min(mapRows, Math.ceil((camY + viewHeight) / tileSize) + buffer);

            // Draw collision for all tiles in all layers (on top of canopy)
            for (let li = 0; li < layers.length; li++) {
                if (!layerVisibility[li]) continue;
                const layer = layers[li];
                if (!layer) continue;

                for (let y = startY; y < endY; y++) {
                    if (!layer[y]) continue;
                    for (let x = startX; x < endX; x++) {
                        const cell = layer[y][x];
                        if (!cell) continue;

                        const px = x * tileSize - camX;
                        const py = y * tileSize - camY;

                        if (cell.type === 'tile') {
                            const tilesetIdx = cell.tilesetIndex || 0;
                            const key = tilesetIdx + ':' + cell.x + ',' + cell.y;
                            const mask = collisionMasks[key];

                            if (mask) {
                                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                                for (let my = 0; my < gridSize; my++) {
                                    for (let mx = 0; mx < gridSize; mx++) {
                                        if (mask[my] && mask[my][mx]) {
                                            ctx.fillRect(px + mx * pixelSize, py + my * pixelSize, pixelSize, pixelSize);
                                        }
                                    }
                                }
                            } else if (tileCollisions[key]) {
                                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                                ctx.fillRect(px, py, tileSize, tileSize);
                            }
                        } else if (cell.type === 'prop') {
                            const propIdx = cell.propIndex || 0;
                            const propKey = cell.x + ',' + cell.y;
                            const mask = propCollisionMasksAll[propIdx] ? propCollisionMasksAll[propIdx][propKey] : null;
                            if (mask) {
                                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                                for (let my = 0; my < gridSize; my++) {
                                    for (let mx = 0; mx < gridSize; mx++) {
                                        if (mask[my] && mask[my][mx]) {
                                            ctx.fillRect(px + mx * pixelSize, py + my * pixelSize, pixelSize, pixelSize);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Draw static object collision boxes (dark green outline)
            if (placedStaticObjectsData) {
                placedStaticObjectsData.forEach((placed, i) => {
                    if (placed.mapName && placed.mapName !== currentGameMap) return;

                    const obj = staticObjectsData[placed.objIndex];
                    if (!obj) return;

                    const scale = placed.scale || 1;
                    const objPixelX = placed.x * tileSize - camX;
                    const objPixelY = placed.y * tileSize - camY;
                    const objPixelW = obj.width * tileSize * scale;
                    const objPixelH = obj.height * tileSize * scale;

                    // Skip off-screen
                    if (objPixelX + objPixelW < 0 || objPixelX > canvas.width / cameraZoom ||
                        objPixelY + objPixelH < 0 || objPixelY > canvas.height / cameraZoom) return;

                    // Draw dark green collision outline (same as builder)
                    ctx.strokeStyle = '#4a7c59';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(objPixelX, objPixelY, objPixelW, objPixelH);

                    // Also fill with semi-transparent green to show collision area
                    ctx.fillStyle = 'rgba(74, 124, 89, 0.2)';
                    ctx.fillRect(objPixelX, objPixelY, objPixelW, objPixelH);
                });
            }
        }

        function drawPlayer() {
            const camX = Math.round(camera.x);
            const camY = Math.round(camera.y);
            // Don't round player offset - keep fractional for smooth interpolation on high refresh rate monitors
            const sx = player.x - camX;
            const sy = player.y - camY;

            // Use player character animation if available, otherwise use legacy layout
            let srcX = 0, srcY = 0, srcW = playerFrameWidth, srcH = playerFrameHeight;
            let flipX = false;

            if (playerAnimations) {
                // New animation system: use frame data from playerAnimations
                const dirMap = {
                    down: 'walkDown',
                    up: 'walkUp',
                    left: 'walkLeft',
                    right: 'walkRight'
                };
                const idleDirMap = {
                    down: 'idleDown',
                    up: 'idleUp',
                    left: 'idleLeft',
                    right: 'idleRight'
                };
                const attackDirMap = {
                    down: 'attackDown',
                    up: 'attackUp',
                    left: 'attackLeft',
                    right: 'attackRight'
                };
                let animKey;
                let useDeathFrame = false;
                if (playerDying) {
                    // Death animation
                    animKey = 'death';
                    useDeathFrame = true;
                } else if (player.attacking && player.attackAnim) {
                    // A throw plays its own chosen animation if one is set; otherwise the directional attack.
                    if (player.throwing && player.throwAnimKey && playerAnimations[player.throwAnimKey] && playerAnimations[player.throwAnimKey].length > 0) {
                        animKey = player.throwAnimKey;
                    } else {
                        const attackKey = attackDirMap[cardinalOf(player.direction)];
                        if (playerAnimations[attackKey] && playerAnimations[attackKey].length > 0) {
                            animKey = attackKey;
                        } else if (playerAnimations.attack && playerAnimations.attack.length > 0) {
                            // Fall back to generic attack
                            animKey = 'attack';
                        } else {
                            // No attack animation, use walk
                            animKey = dirMap[cardinalOf(player.direction)];
                        }
                    }
                } else if (isReceivingItem && receivingItemData) {
                    // Receive item animation
                    const receiveItemDirMap = {
                        down: 'receiveItemDown',
                        up: 'receiveItemUp',
                        left: 'receiveItemLeft',
                        right: 'receiveItemRight'
                    };
                    const receiveKey = receiveItemDirMap[cardinalOf(player.direction)];
                    if (playerAnimations[receiveKey] && playerAnimations[receiveKey].length > 0) {
                        animKey = receiveKey;
                    } else if (playerAnimations.receivedItem && playerAnimations.receivedItem.length > 0) {
                        animKey = 'receivedItem';
                    } else {
                        // No receive animation, use idle
                        const dirIdleKey = idleDirMap[cardinalOf(player.direction)];
                        if (playerAnimations[dirIdleKey] && playerAnimations[dirIdleKey].length > 0) {
                            animKey = dirIdleKey;
                        } else {
                            animKey = 'idle';
                        }
                    }
                } else if (player.fishing) {
                    // Fishing: cast (one-shot) then wait-for-bite (loop), directional
                    const fsuf = player.fishing.dir.charAt(0).toUpperCase() + player.fishing.dir.slice(1);
                    const fk = (player.fishing.phase === 'cast' ? 'fishCast' : 'fishWait') + fsuf;
                    if (playerAnimations[fk] && playerAnimations[fk].length > 0) {
                        animKey = fk;
                    } else {
                        const dirIdleKey = idleDirMap[cardinalOf(player.direction)];
                        animKey = (playerAnimations[dirIdleKey] && playerAnimations[dirIdleKey].length) ? dirIdleKey : 'idle';
                    }
                } else if (player.moving) {
                    // Walk: resolve diagonal->mirror->cardinal (handles 8-dir and 4-dir sprites)
                    const _wr = resolveWalkKey(playerAnimations, player.direction);
                    animKey = _wr.key;
                    if (_wr.flip) flipX = true;
                } else {
                    // Check for directional idle first, then fall back to generic idle
                    const dirIdleKey = idleDirMap[cardinalOf(player.direction)];
                    if (playerAnimations[dirIdleKey] && playerAnimations[dirIdleKey].length > 0) {
                        animKey = dirIdleKey;
                    } else {
                        animKey = 'idle';
                    }
                }
                let frames = playerAnimations[animKey];

                // Fallback: if no idle frames, use first frame of walkDown
                if (!frames || frames.length === 0) {
                    frames = playerAnimations.walkDown || [];
                }
                // Fallback for left: use right and flip
                if ((!frames || frames.length === 0) && player.direction === 'left') {
                    frames = playerAnimations.walkRight || [];
                    flipX = true;
                }

                let currentSheetIndex = 0;
                if (frames && frames.length > 0) {
                    // Use attackFrame for attack animations, deathAnimFrame for death, receiveItemFrame for receive, otherwise use regular frame
                    let frameIndex;
                    if (useDeathFrame) {
                        frameIndex = Math.min(deathAnimFrame, frames.length - 1);
                    } else if (player.attacking && player.attackAnim) {
                        frameIndex = (player.attackFrame || 0) % frames.length;
                    } else if (isReceivingItem && receivingItemData) {
                        frameIndex = Math.min(receivingItemData.frame || 0, frames.length - 1);
                    } else if (player.fishing) {
                        frameIndex = (player.fishing.frame || 0) % frames.length;
                    } else {
                        frameIndex = player.frame % frames.length;
                    }
                    const frame = frames[frameIndex];
                    srcX = frame.x;
                    srcY = frame.y;
                    srcW = frame.w;
                    srcH = frame.h;
                    currentSheetIndex = frame.sheet || 0;
                }

                // Use the correct sprite sheet for this frame
                if (playerSpriteSheets && playerSpriteSheets[currentSheetIndex]) {
                    playerImg = playerSpriteSheets[currentSheetIndex];
                }

                // Check if this animation should be mirrored (from player editor mirror toggle)
                if (playerAnimMirrors && playerAnimMirrors[animKey]) {
                    flipX = !flipX; // Toggle flip - if already flipping, unflip; if not, flip
                }

                // Handle left direction by mirroring right (fallback if no walkLeft defined)
                if (player.direction === 'left' && (!playerAnimations.walkLeft || playerAnimations.walkLeft.length === 0)) {
                    flipX = true;
                }
            } else {
                // Legacy sprite layout: 1024x512, 16 cols x 8 rows = 64x64 each
                const frameWidth = 64;
                const frameHeight = 64;

                // Idle frames (Row 0)
                const idleFrames = {
                    down: [0, 1, 2],
                    up: [3, 4, 5],
                    right: [6, 7, 8],
                    left: [6, 7, 8]
                };

                // Walk frames
                const walkFrames = {
                    down: { row: 0, cols: [9, 10, 11, 12] },
                    up: { row: 0, cols: [13, 14, 15] },
                    right: { row: 1, cols: [1, 2, 3, 4] },
                    left: { row: 1, cols: [1, 2, 3, 4] }
                };

                let row = 0;
                let col = 0;
                const pdir = cardinalOf(player.direction); // legacy 4-key tables have no diagonals (defensive)

                if (player.attacking) {
                    row = walkFrames[pdir].row;
                    col = walkFrames[pdir].cols[player.frame % walkFrames[pdir].cols.length];
                    if (pdir === 'left') flipX = true;
                } else if (player.moving) {
                    const walk = walkFrames[pdir];
                    row = walk.row;
                    col = walk.cols[player.frame % walk.cols.length];
                    if (pdir === 'left') flipX = true;
                } else {
                    row = 0;
                    col = idleFrames[pdir][player.frame % idleFrames[pdir].length];
                    if (pdir === 'left') flipX = true;
                }

                srcX = col * frameWidth;
                srcY = row * frameHeight;
                srcW = frameWidth;
                srcH = frameHeight;
            }

            const drawW = Math.round(playerFrameWidth * playerScale);
            const drawH = Math.round(playerFrameHeight * playerScale);

            // Center sprite on collision box
            // Collision box should cover body from feet to near head
            // Sprite is drawn so collision box aligns with the character body
            const spriteX = sx + player.width / 2 - drawW / 2;
            const spriteY = sy - 15; // shift sprite up so collision box covers body properly

            // Simple ellipse shadow under hero (unless disabled)
            if (!playerNoShadow) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.beginPath();
                ctx.ellipse(
                    spriteX + drawW / 2,
                    spriteY + drawH - playerShadowYOffset,
                    drawW * (playerShadowWidth / 100),
                    drawW * (playerShadowHeight / 100),
                    0, 0, Math.PI * 2
                );
                ctx.fill();
            }

            // Invincibility flashing effect - blink every 4 frames
            const shouldDraw = !player.invincible || (Math.floor(player.invincibleTimer / 4) % 2 === 0);

            if (playerImg.complete && shouldDraw) {
                // Tint red briefly when just hit
                if (player.invincible && player.invincibleTimer > 80) {
                    ctx.globalAlpha = 0.7;
                }
                if (flipX) {
                    ctx.save();
                    ctx.translate(spriteX + drawW, spriteY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(playerImg, srcX, srcY, srcW, srcH, 0, 0, drawW, drawH);
                    ctx.restore();
                } else {
                    ctx.drawImage(playerImg, srcX, srcY, srcW, srcH, spriteX, spriteY, drawW, drawH);
                }
                ctx.globalAlpha = 1;
            } else if (!playerImg.complete) {
                ctx.fillStyle = '#4a7';
                ctx.fillRect(sx, sy, player.width, player.height);
            }

            // Draw floating item above player when receiving
            if (isReceivingItem && receivingItemData) {
                const floatX = spriteX + drawW / 2;
                const floatY = spriteY;
                drawFloatingItem(floatX, floatY);
            }

            // Attack effect removed - using attack animation instead

            // DEBUG: Draw collision box (shows actual foot hitbox used for collision)
            if (showCollision) {
                // Always show the small foot hitbox (bottom 1/3)
                const collisionHeight = player.height / 3;
                const collisionOffsetY = player.height * 2/3;

                ctx.strokeStyle = '#0f0';
                ctx.lineWidth = 2;
                ctx.strokeRect(sx, sy + collisionOffsetY, player.width, collisionHeight);

                // Draw center point of collision box
                ctx.fillStyle = '#0f0';
                ctx.beginPath();
                ctx.arc(sx + player.width / 2, sy + collisionOffsetY + collisionHeight / 2, 3, 0, Math.PI * 2);
                ctx.fill();

                // Draw attack hitbox preview (dark blue, always visible in debug)
                const dir = cardinalOf(player.direction); // collapse diagonal->cardinal for hitbox geometry
                const hbRange = playerHitboxRange[dir] || 40;
                const hbWidth = playerHitboxWidth[dir] || 60;
                const hbOffX = playerHitboxOffsetX[dir] || 0;
                const hbOffY = playerHitboxOffsetY[dir] || 0;

                if (hbRange > 0) {
                    const range = hbRange * TILE_SCALE;
                    const halfAngle = (hbWidth / 2) * (Math.PI / 180);
                    const dirAngles = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
                    const baseAngle = dirAngles[dir] || 0;

                    const centerX = sx + player.width / 2 + hbOffX * TILE_SCALE;
                    const centerY = sy + player.height / 2 + hbOffY * TILE_SCALE;

                    // Draw preview cone (dark blue, semi-transparent)
                    ctx.fillStyle = 'rgba(30, 60, 120, 0.3)';
                    ctx.strokeStyle = 'rgba(60, 120, 200, 0.6)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(centerX, centerY);
                    ctx.lineTo(
                        centerX + Math.cos(baseAngle - halfAngle) * range,
                        centerY + Math.sin(baseAngle - halfAngle) * range
                    );
                    ctx.arc(centerX, centerY, range, baseAngle - halfAngle, baseAngle + halfAngle);
                    ctx.lineTo(centerX, centerY);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Draw yellow origin dot
                    ctx.fillStyle = '#ff0';
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

                // Draw player attack hitbox cone when attacking (magenta - active)
                if (player.attacking && player.attackAnim && hbRange > 0) {
                    const range = hbRange * TILE_SCALE;
                    const halfAngle = (hbWidth / 2) * (Math.PI / 180);
                    const dirAngles = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
                    const baseAngle = dirAngles[dir] || 0;

                    const centerX = sx + player.width / 2 + hbOffX * TILE_SCALE;
                    const centerY = sy + player.height / 2 + hbOffY * TILE_SCALE;

                    // Draw cone/triangle shape
                    ctx.fillStyle = 'rgba(255, 0, 255, 0.35)';
                    ctx.strokeStyle = 'rgba(255, 0, 255, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(centerX, centerY);
                    // Left edge of cone
                    ctx.lineTo(
                        centerX + Math.cos(baseAngle - halfAngle) * range,
                        centerY + Math.sin(baseAngle - halfAngle) * range
                    );
                    // Arc at the end of the cone
                    ctx.arc(centerX, centerY, range, baseAngle - halfAngle, baseAngle + halfAngle);
                    // Right edge back to center
                    ctx.lineTo(centerX, centerY);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
            }
        }

        // Draw other multiplayer player
        function drawOtherPlayer(playerId, camX, camY) {
            const other = otherPlayers.get(playerId);
            if (!other) return;

            // Don't round - keep fractional for smooth interpolation on high refresh rate monitors
            const sx = other.x - camX;
            const sy = other.y - camY;
            const dir = other.direction || 'down';

            // Use player character animation if available, otherwise use legacy layout
            let srcX = 0, srcY = 0, srcW = playerFrameWidth, srcH = playerFrameHeight;
            let flipX = false;

            if (playerAnimations) {
                // New animation system - match local player's logic
                const dirMap = { down: 'walkDown', up: 'walkUp', left: 'walkLeft', right: 'walkRight' };
                const idleDirMap = { down: 'idleDown', up: 'idleUp', left: 'idleLeft', right: 'idleRight' };
                const attackDirMap = { down: 'attackDown', up: 'attackUp', left: 'attackLeft', right: 'attackRight' };

                let animKey;
                let useAttackFrame = false;

                if (other.animation === 'attack') {
                    // Check for directional attack animation
                    const attackKey = attackDirMap[cardinalOf(dir)];
                    if (playerAnimations[attackKey] && playerAnimations[attackKey].length > 0) {
                        animKey = attackKey;
                    } else if (playerAnimations.attack && playerAnimations.attack.length > 0) {
                        animKey = 'attack';
                    } else {
                        animKey = dirMap[cardinalOf(dir)];
                    }
                    useAttackFrame = true;
                } else if (other.animation === 'walk') {
                    const _wr = resolveWalkKey(playerAnimations, dir);
                    animKey = _wr.key;
                    if (_wr.flip) flipX = true;
                } else {
                    // Idle - check for directional idle first
                    const dirIdleKey = idleDirMap[cardinalOf(dir)];
                    if (playerAnimations[dirIdleKey] && playerAnimations[dirIdleKey].length > 0) {
                        animKey = dirIdleKey;
                    } else {
                        animKey = 'idle';
                    }
                }

                let frames = playerAnimations[animKey];

                // Fallback: if no frames, use walkDown
                if (!frames || frames.length === 0) {
                    frames = playerAnimations.walkDown || [];
                }
                // Fallback for left: use right and flip
                if ((!frames || frames.length === 0) && dir === 'left') {
                    frames = playerAnimations.walkRight || [];
                    flipX = true;
                }

                let currentSheetIndex = 0;
                if (frames && frames.length > 0) {
                    let frameIndex;
                    if (useAttackFrame) {
                        frameIndex = (other.attackFrame || 0) % frames.length;
                    } else {
                        frameIndex = other.frame % frames.length;
                    }
                    const frame = frames[frameIndex];
                    srcX = frame.x;
                    srcY = frame.y;
                    srcW = frame.w;
                    srcH = frame.h;
                    currentSheetIndex = frame.sheet || 0;
                }

                // Use the correct sprite sheet for this frame
                if (playerSpriteSheets && playerSpriteSheets[currentSheetIndex]) {
                    playerImg = playerSpriteSheets[currentSheetIndex];
                }

                // Check if this animation should be mirrored (from player editor mirror toggle)
                if (playerAnimMirrors && playerAnimMirrors[animKey]) {
                    flipX = !flipX;
                }

                // Handle left direction by mirroring right (fallback if no walkLeft defined)
                if (dir === 'left' && (!playerAnimations.walkLeft || playerAnimations.walkLeft.length === 0)) {
                    flipX = true;
                }
            } else {
                // Legacy sprite layout
                const frameWidth = 64;
                const frameHeight = 64;

                const idleFrames = {
                    down: [0, 1, 2], up: [3, 4, 5], right: [6, 7, 8], left: [6, 7, 8]
                };
                const walkFrames = {
                    down: { row: 0, cols: [9, 10, 11, 12] },
                    up: { row: 0, cols: [13, 14, 15] },
                    right: { row: 1, cols: [1, 2, 3, 4] },
                    left: { row: 1, cols: [1, 2, 3, 4] }
                };

                let row = 0, col = 0;
                const ldir = cardinalOf(dir); // legacy 4-key tables have no diagonals; collapse to avoid undefined lookup
                if (other.animation === 'walk') {
                    const walk = walkFrames[ldir];
                    row = walk.row;
                    col = walk.cols[other.frame % walk.cols.length];
                    if (ldir === 'left') flipX = true;
                } else {
                    row = 0;
                    col = idleFrames[ldir][other.frame % idleFrames[ldir].length];
                    if (ldir === 'left') flipX = true;
                }

                srcX = col * frameWidth;
                srcY = row * frameHeight;
                srcW = frameWidth;
                srcH = frameHeight;
            }

            const drawW = Math.round(playerFrameWidth * playerScale);
            const drawH = Math.round(playerFrameHeight * playerScale);
            const spriteX = sx + player.width / 2 - drawW / 2;
            const spriteY = sy - 15;

            // Shadow (use player shadow settings)
            if (!playerNoShadow) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.beginPath();
                ctx.ellipse(spriteX + drawW / 2, spriteY + drawH - playerShadowYOffset, drawW * 0.2, drawW * 0.08, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw sprite
            if (playerImg.complete) {
                ctx.save();
                if (flipX) {
                    ctx.translate(spriteX + drawW, spriteY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(playerImg, srcX, srcY, srcW, srcH, 0, 0, drawW, drawH);
                } else {
                    ctx.drawImage(playerImg, srcX, srcY, srcW, srcH, spriteX, spriteY, drawW, drawH);
                }
                ctx.restore();
            }

            // Draw nametag above player
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            const nameWidth = ctx.measureText(other.name).width + 8;
            ctx.fillRect(spriteX + drawW / 2 - nameWidth / 2, spriteY - 18, nameWidth, 14);
            ctx.fillStyle = '#fff';
            ctx.fillText(other.name, spriteX + drawW / 2, spriteY - 8);
        }

        // Draw NPC with correct animation based on direction
        function drawNPC(npcIdx, camX, camY, tileSize) {
            const placed = placedNpcs[npcIdx];
            const state = npcRuntimeState[npcIdx];
            const npc = npcs[placed.npcIndex];
            const img = npcImages[placed.npcIndex];

            if (!placed || !state || !npc || !img || !img.complete) return;

            // Skip dead enemies
            if (state.dead) return;

            // Round to prevent sub-pixel blur (NPCs don't use interpolation like player does)
            const sx = Math.round(state.x * TILE_SCALE - camX);
            const sy = Math.round(state.y * TILE_SCALE - camY);

            // Get correct animation based on direction or waypoint animation
            const anims = npc.animations || {};
            const dirMap = {
                'down': 'walkDown',
                'up': 'walkUp',
                'left': 'walkLeft',
                'right': 'walkRight'
            };
            const attackDirMap = {
                'down': 'attackDown',
                'up': 'attackUp',
                'left': 'attackLeft',
                'right': 'attackRight'
            };
            // Use waypoint animation if set AND has frames, otherwise use walk/idle based on state
            let animKey;
            let useAttackFrame = false;
            let npcWalkFlip = false; // set by resolveWalkKey when a diagonal/left mirrors its opposite
            // Check if playing attack animation (enemy attacking)
            if (state.attackAnimTimer > 0 && placed.isEnemy) {
                const attackKey = attackDirMap[cardinalOf(state.direction)];
                if (anims[attackKey] && anims[attackKey].length > 0) {
                    animKey = attackKey;
                    useAttackFrame = true;
                } else {
                    // No attack anim, use walk anim (diagonal-aware)
                    const _wr = resolveWalkKey(anims, state.direction);
                    animKey = _wr.key;
                    if (_wr.flip) npcWalkFlip = true;
                }
            } else if (state.waypointAnimation && state.waypointAnimation !== 'walk' &&
                anims[state.waypointAnimation] && anims[state.waypointAnimation].length > 0) {
                animKey = state.waypointAnimation;
            } else if (state.moving) {
                const _wr = resolveWalkKey(anims, state.direction);
                animKey = _wr.key;
                if (_wr.flip) npcWalkFlip = true;
            } else {
                animKey = 'idle';
            }
            let anim = anims[animKey];

            // Fallback to any available animation
            if (!anim || anim.length === 0) {
                anim = (anims.walkDown?.length > 0 ? anims.walkDown : null) ||
                       (anims.idle?.length > 0 ? anims.idle : null) ||
                       Object.values(anims).find(a => a && a.length > 0);
            }
            if (!anim || anim.length === 0) return;

            // Get current frame (use attack frame counter for attack anims)
            let frameIdx;
            if (useAttackFrame) {
                // Advance attack frames at the NPC's configured FPS (same clock as walk/idle) so the
                // attack speed matches the rest of the animation instead of a fixed window.
                const atkFps = placed.animSpeed || npc.fps || 8;
                const atkTicks = Math.max(1, Math.round(60 / atkFps));
                frameIdx = Math.min(Math.floor(state.attackAnimFrame / atkTicks), anim.length - 1);
            } else {
                frameIdx = state.frame % anim.length;
            }
            const frame = anim[frameIdx];
            if (!frame) return;

            // Apply NPC scale (default 1.0)
            const npcScale = placed.scale || 1;
            const drawW = tileSize * npcScale;
            const drawH = tileSize * npcScale;

            // Adjust position so NPC is centered and feet stay on ground
            const offsetX = (drawW - tileSize) / 2;
            const offsetY = drawH - tileSize; // Bottom-aligned
            const drawX = sx - offsetX;
            const drawY = sy - offsetY;

            // Draw shadow (scales with NPC, uses per-NPC shadow settings)
            if (!npc.noShadow) {
                const shadowOffsetX = npc.shadowOffsetX ?? 0;
                const shadowOffsetY = npc.shadowOffsetY ?? 4;
                const shadowWidthRatio = npc.shadowWidth ?? 0.35;
                const shadowHeightRatio = npc.shadowHeight ?? 0.12;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.beginPath();
                ctx.ellipse(
                    drawX + drawW / 2 + shadowOffsetX,
                    drawY + drawH - shadowOffsetY,
                    drawW * shadowWidthRatio,
                    drawW * shadowHeightRatio,
                    0, 0, Math.PI * 2
                );
                ctx.fill();
            }

            // Handle horizontal flip - either for left fallback OR if animation is marked as mirrored
            const animMirrors = npc.animMirrors || {};
            const isMirrored = animMirrors[animKey];
            const flipX = isMirrored || npcWalkFlip || (state.direction === 'left' && !anims.walkLeft?.length);

            // Blink effect when NPC takes damage (skip drawing on odd frames)
            if (state.hitFlash > 0) {
                state.hitFlash--;
                if (Math.floor(state.hitFlash / 2) % 2 === 1) {
                    return; // Skip drawing this frame - creates blink effect
                }
            }

            if (flipX) {
                ctx.save();
                ctx.translate(drawX + drawW, drawY);
                ctx.scale(-1, 1);
                ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, drawW, drawH);
                ctx.restore();
            } else {
                ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
            }

            // DEBUG: Draw NPC collision/hurtbox when C is pressed (cyan overlay)
            if (showCollision) {
                // Use collision insets if defined (shrink from each edge)
                const insets = npc.collisionInsets;
                if (insets && (insets.top > 0 || insets.bottom > 0 || insets.left > 0 || insets.right > 0)) {
                    const frameW = frame.w || npc.frameWidth || 32;
                    const pixelScale = drawW / frameW;
                    const boxX = drawX + insets.left * pixelScale;
                    const boxY = drawY + insets.top * pixelScale;
                    const boxW = drawW - (insets.left + insets.right) * pixelScale;
                    const boxH = drawH - (insets.top + insets.bottom) * pixelScale;
                    ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
                    ctx.strokeStyle = '#0ff';
                    ctx.lineWidth = 2;
                    ctx.fillRect(boxX, boxY, boxW, boxH);
                    ctx.strokeRect(boxX, boxY, boxW, boxH);
                } else {
                    // No insets - draw cyan bounding box around full sprite
                    ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
                    ctx.strokeStyle = '#0ff';
                    ctx.lineWidth = 2;
                    ctx.fillRect(drawX, drawY, drawW, drawH);
                    ctx.strokeRect(drawX, drawY, drawW, drawH);
                }

                // Draw enemy health bar
                if (placed.isEnemy && state && state.hp !== undefined) {
                    const barWidth = drawW * 0.8;
                    const barHeight = 6;
                    const barX = drawX + (drawW - barWidth) / 2;
                    const barY = drawY - 12;
                    const hpPercent = Math.max(0, state.hp / (state.maxHp || 30));

                    // Background (dark)
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

                    // Health bar background (red)
                    ctx.fillStyle = '#400';
                    ctx.fillRect(barX, barY, barWidth, barHeight);

                    // Health bar fill (green to red gradient based on HP)
                    const hpColor = hpPercent > 0.5 ? '#0f0' : (hpPercent > 0.25 ? '#ff0' : '#f00');
                    ctx.fillStyle = hpColor;
                    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

                    // HP text
                    ctx.fillStyle = '#fff';
                    ctx.font = '8px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(Math.ceil(state.hp) + '/' + (state.maxHp || 30), drawX + drawW / 2, barY - 2);
                }
            }

            // Draw quest indicator icon above NPC
            const questIndicator = getQuestIndicatorForNpc(placed);
            if (questIndicator) {
                const iconX = drawX + drawW / 2;
                const iconY = drawY - 20;

                // Floating animation
                const bobOffset = Math.sin(Date.now() / 300) * 3;

                // Draw icon background glow
                ctx.beginPath();
                ctx.arc(iconX, iconY + bobOffset, 12, 0, Math.PI * 2);
                ctx.fillStyle = questIndicator.glowColor;
                ctx.fill();

                // Draw icon
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = questIndicator.color;
                ctx.fillText(questIndicator.symbol, iconX, iconY + bobOffset);
            }
        }

        // Get quest indicator for an NPC (! = available, ? = can turn in)
        function getQuestIndicatorForNpc(npc) {
            if (!npc.uid || !quests) return null;

            for (const quest of quests) {
                const state = gameProgress.questStates[quest.id];
                if (!state) continue;

                // Quest giver with available quest - yellow !
                if (quest.startNpcUid === npc.uid && state.status === QUEST_STATUS.AVAILABLE) {
                    return { symbol: '!', color: '#FFD700', glowColor: 'rgba(255, 215, 0, 0.4)' };
                }

                // Turn-in NPC with completable quest - yellow ?
                const turnInNpc = quest.turnInNpcUid || quest.startNpcUid;
                if (turnInNpc === npc.uid && state.status === QUEST_STATUS.ACTIVE) {
                    if (areAllConditionsMet(quest)) {
                        return { symbol: '?', color: '#FFD700', glowColor: 'rgba(255, 215, 0, 0.4)' };
                    } else if (quest.startNpcUid === npc.uid) {
                        // Quest giver for active quest (reminder) - gray ?
                        return { symbol: '?', color: '#888888', glowColor: 'rgba(136, 136, 136, 0.3)' };
                    }
                }
            }

            return null;
        }

        // Draw a placed item (simple sprite - disappears when picked up)
        function drawItem(itemIdx, camX, camY, tileSize) {
            const placed = placedItemsData[itemIdx];
            if (!placed) return;

            const state = itemStates[itemIdx];
            if (!state || state.used) return; // Don't draw used/picked up items

            const item = itemsData[placed.itemIndex];
            if (!item || !item.frames || item.frames.length === 0) return;

            const img = itemImages[placed.itemIndex];
            if (!img || !img.complete) return;

            // Always show first frame (simple static item on map)
            const frame = item.frames[0];

            // Draw position
            const drawX = placed.x * tileSize - camX;
            const drawY = placed.y * tileSize - camY;
            const drawW = (item.frameWidth / gridSize) * tileSize;
            const drawH = (item.frameHeight / gridSize) * tileSize;

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
        }

        function drawStaticObject(placedIdx, camX, camY, tileSize) {
            const placed = placedStaticObjectsData[placedIdx];
            if (!placed) return;

            const obj = staticObjectsData[placed.objIndex];
            if (!obj) return;

            const img = staticObjectImages[placed.objIndex];
            if (!img || !img.complete) return;

            // Object dimensions in pixels
            const objW = obj.width * gridSize;
            const objH = obj.height * gridSize;

            // Scale factor (like items)
            const scale = placed.scale || 1;

            // Draw position
            const drawX = placed.x * tileSize - camX;
            const drawY = placed.y * tileSize - camY;
            const drawW = (objW / gridSize) * tileSize * scale;
            const drawH = (objH / gridSize) * tileSize * scale;

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, objW, objH, drawX, drawY, drawW, drawH);
        }

        // Fixed timestep for frame-rate independence
        const FIXED_TIMESTEP = 1000 / 60;  // 16.67ms - game logic runs at 60 FPS
        const MAX_ACCUMULATED_TIME = FIXED_TIMESTEP * 5;  // Cap at 5 ticks to prevent spiral of death
        let accumulatedTime = 0;
        let lastFrameTime = 0;
        let perfUpdateCounter = 0;

        // Mobile render throttle: cap RENDERING to ~30fps while game LOGIC stays 60Hz (the
        // fixed-timestep loop is untouched). Halves draw/GPU work on phones; desktop unaffected.
        const __isMobileRender = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const __renderInterval = __isMobileRender ? 33 : 0; // ms between rendered frames
        let __lastRenderTime = 0;

        // Cache for canopy split arrays — avoids allocating new Array(gridSize) per split tile per
        // frame (GC stutter on mobile). Scalar split values are few and stable, so the cache is tiny.
        const __splitArrCache = new Map();
        function resolveSplitArray(splitData, gridSize) {
            if (Array.isArray(splitData)) return splitData;
            let a = __splitArrCache.get(splitData);
            if (!a || a.length !== gridSize) { a = new Array(gridSize).fill(splitData); __splitArrCache.set(splitData, a); }
            return a;
        }

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
    <\/script>
</body>
</html>
            `;