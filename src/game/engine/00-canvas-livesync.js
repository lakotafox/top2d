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
