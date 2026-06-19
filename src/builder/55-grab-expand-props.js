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
