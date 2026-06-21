        // ===== ANIMATED PROPS FUNCTIONS =====
        // PORT-SKIP(monogame): builder/editor (split tool, Flip, copy-to-all, erase-split). Editor is cut; not ported. docs/PORTING.md §D.
        let animPropEditorImage = null;
        let animPropEditorData = null;
        let animPropEditorFrameW = 16;
        let animPropEditorFrameH = 16;
        let animPropEditorEditingIndex = -1;
        let animPropEditorZoom = 3; // Zoom level for sprite sheet
        let animPropTool = 'none'; // 'none', 'collision', 'erase', 'split'
        let animPropCollisionMasks = {}; // Per-frame collision: { frameIndex: 2D array }
        let animPropCollisionFrame = 0; // Which frame we're editing collision for
        let animPropSplitLine = null; // { "frameIndex:tileX,tileY": [Y per column] } per-frame split lines
        let animPropSplitFlipped = {}; // { "tileX,tileY": true } - flip which half covers player (frame-agnostic, like tileSplitLineFlipped)
        let animPropSplitTarget = null; // { frameIndex, tileX, tileY, frame } - tile locked during a split drag (like selectedSplitTile)
        let animPropSplitFrame = 0; // Source frame for "Copy split to all frames"
        let animPropSplitErase = false; // Split sub-mode: erase a tile's split (square by square)
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
                animPropSplitFlipped = prop.splitFlipped ? JSON.parse(JSON.stringify(prop.splitFlipped)) : {};
                animPropSplitFrame = 0;
                animPropSplitTarget = null;

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
                animPropSplitFlipped = {};
                animPropSplitFrame = 0;
                animPropSplitTarget = null;
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

                            // Flipped tiles cover the player with the BOTTOM half (trunk on top).
                            // Color/label them orange like the tiles tab; cyan when normal.
                            const isFlipped = !!animPropSplitFlipped[tx + ',' + ty];
                            const lineColor = isFlipped ? '#fa0' : '#0ff';

                            // Fill the canopy region (the half that covers the player)
                            ctx.fillStyle = isFlipped ? 'rgba(255, 170, 0, 0.25)' : 'rgba(0, 255, 255, 0.25)';
                            ctx.beginPath();
                            const edgeY = isFlipped ? (tileStartY + gridSize) : tileStartY; // canopy base edge
                            ctx.moveTo(tileStartX * scale, edgeY * scale);
                            for (let col = 0; col < gridSize; col++) {
                                const splitY = Array.isArray(splitYArray) ? splitYArray[col] : splitYArray;
                                const lineX = (tileStartX + col + 0.5) * scale;
                                const lineY = (tileStartY + splitY) * scale;
                                ctx.lineTo(lineX, lineY);
                            }
                            ctx.lineTo((tileStartX + gridSize) * scale, edgeY * scale);
                            ctx.closePath();
                            ctx.fill();

                            // Draw freeform split line
                            ctx.strokeStyle = lineColor;
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

                            // C = canopy (covers player), T = trunk (Y-sorted). Flip swaps which half is which.
                            const topLabel = isFlipped ? 'T' : 'C';
                            const botLabel = isFlipped ? 'C' : 'T';
                            ctx.fillStyle = lineColor;
                            ctx.textAlign = 'center';
                            if (avgSplitY > 4) {
                                ctx.fillText(topLabel, (tileStartX + gridSize / 2) * scale, (tileStartY + avgSplitY / 2) * scale + 4);
                            }
                            if (avgSplitY < gridSize - 4) {
                                ctx.fillText(botLabel, (tileStartX + gridSize / 2) * scale, (tileStartY + avgSplitY + (gridSize - avgSplitY) / 2) * scale + 4);
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
        // Tool switching for animated prop editor
        function setAnimPropTool(tool) {
            animPropTool = tool;
            ['None', 'Collision', 'Erase', 'Split'].forEach(t => {
                const btn = document.getElementById('animPropTool' + t);
                if (btn) btn.classList.toggle('active', t.toLowerCase() === tool);
            });

            // Reset the split erase sub-mode whenever the tool changes
            animPropSplitErase = false;
            const splitEraseBtn = document.getElementById('animPropSplitEraseBtn');
            if (splitEraseBtn) splitEraseBtn.style.background = '#555';

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

        function setAnimPropSplitFrame(frameIdx) {
            animPropSplitFrame = parseInt(frameIdx) || 0;
        }

        function updateAnimPropSplitFrameDropdown() {
            const select = document.getElementById('animPropSplitFrameSelect');
            if (!select) return;
            select.innerHTML = '';
            animPropFrames.forEach((frame, i) => {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = 'Frame ' + (i + 1);
                if (i === animPropSplitFrame) opt.selected = true;
                select.appendChild(opt);
            });
            if (animPropSplitFrame >= animPropFrames.length) {
                animPropSplitFrame = Math.max(0, animPropFrames.length - 1);
            }
        }

        // Make every other frame EXACTLY mirror the source frame's split lines — including
        // erased tiles (set where the source has a split, delete where it doesn't). Additive-only
        // copying left stale splits on targets after you erased a tile on the source.
        function copySplitToAllFrames() {
            if (animPropFrames.length === 0) return;
            if (!animPropSplitLine || typeof animPropSplitLine !== 'object' || Array.isArray(animPropSplitLine)) {
                animPropSplitLine = {};
            }
            const src = animPropSplitFrame;
            const srcFrame = animPropFrames[src];
            if (!srcFrame) return;
            const tilesW = Math.ceil(srcFrame.w / gridSize);
            const tilesH = Math.ceil(srcFrame.h / gridSize);
            for (let i = 0; i < animPropFrames.length; i++) {
                if (i === src) continue;
                for (let ty = 0; ty < tilesH; ty++) {
                    for (let tx = 0; tx < tilesW; tx++) {
                        const key = i + ':' + tx + ',' + ty;
                        const srcLine = animPropSplitLine[src + ':' + tx + ',' + ty];
                        if (srcLine) {
                            animPropSplitLine[key] = JSON.parse(JSON.stringify(srcLine));
                        } else {
                            delete animPropSplitLine[key]; // mirror the source's erased tiles
                        }
                    }
                }
            }
            animPropDrawCanvas();
            console.log('[ANIM PROP] Mirrored split from frame', src + 1, 'to all frames');
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

        // Toggle the split "erase" sub-mode: when on, clicking/dragging deletes a tile's split.
        function toggleAnimPropSplitErase() {
            animPropSplitErase = !animPropSplitErase;
            const btn = document.getElementById('animPropSplitEraseBtn');
            if (btn) btn.style.background = animPropSplitErase ? '#d33' : '#555';
            const canvas = document.getElementById('animPropEditorCanvas');
            if (canvas) canvas.style.cursor = animPropSplitErase ? 'not-allowed' : 'crosshair';
        }

        // Erase the split line for whichever tile is under the cursor (square by square).
        function animPropEraseSplitAt(px, py) {
            for (let i = 0; i < animPropFrames.length; i++) {
                const f = animPropFrames[i];
                if (px >= f.x && px < f.x + f.w && py >= f.y && py < f.y + f.h) {
                    const tileX = Math.floor((px - f.x) / gridSize);
                    const tileY = Math.floor((py - f.y) / gridSize);
                    const tk = tileX + ',' + tileY;
                    if (animPropSplitLine && typeof animPropSplitLine === 'object') {
                        delete animPropSplitLine[i + ':' + tk]; // per-frame key
                        delete animPropSplitLine[tk];           // legacy shared key
                    }
                    // Drop the tile's flip once no frame keeps a split for it
                    let stillSplit = false;
                    for (let j = 0; j < animPropFrames.length; j++) {
                        if (animPropSplitLine && animPropSplitLine[j + ':' + tk]) { stillSplit = true; break; }
                    }
                    if (!stillSplit && animPropSplitFlipped) delete animPropSplitFlipped[tk];
                    return;
                }
            }
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

        // Split painting — behaves like the tiles-tab tool (handleSplitClick/handleSplitDrag):
        // on mousedown we lock onto the clicked frame+tile; the drag stays on that tile and the
        // line follows the mouse live (no bottom-snap, no frozen flat-line Y).
        function animPropPaintSplit(px, py, isStart = false) {
            if (animPropFrames.length === 0) return;

            // Erase sub-mode: delete the split for whichever tile is under the cursor (no tile-lock,
            // so a drag wipes each square it crosses).
            if (animPropSplitErase) {
                animPropEraseSplitAt(px, py);
                return;
            }

            let frameIndex, frame, tileX, tileY;
            if (isStart) {
                // Detect which frame + tile was clicked, then lock onto it for the drag
                let clickedFrameIndex = -1, clickedFrame = null;
                for (let i = 0; i < animPropFrames.length; i++) {
                    const f = animPropFrames[i];
                    if (px >= f.x && px < f.x + f.w && py >= f.y && py < f.y + f.h) {
                        clickedFrameIndex = i; clickedFrame = f; break;
                    }
                }
                if (!clickedFrame) return;
                frame = clickedFrame;
                frameIndex = clickedFrameIndex;
                tileX = Math.floor((px - frame.x) / gridSize);
                tileY = Math.floor((py - frame.y) / gridSize);
                animPropSplitTarget = { frameIndex, tileX, tileY, frame };
                // Sync the Flip checkbox to this tile's current state
                const flipCb = document.getElementById('animPropSplitFlip');
                if (flipCb) flipCb.checked = !!animPropSplitFlipped[tileX + ',' + tileY];
            } else {
                if (!animPropSplitTarget) return;
                ({ frameIndex, tileX, tileY, frame } = animPropSplitTarget);
            }

            // Position within the LOCKED tile, clamped (mirror handleSplitDrag)
            const tileLocalX = px - (frame.x + tileX * gridSize);
            const tileLocalY = py - (frame.y + tileY * gridSize);
            const clampedY = Math.max(0, Math.min(gridSize, Math.floor(tileLocalY)));
            const clampedX = Math.max(0, Math.min(gridSize - 1, Math.floor(tileLocalX)));

            const flatLineCheckbox = document.getElementById('animPropFlatLine');
            const flatLineMode = flatLineCheckbox && flatLineCheckbox.checked;

            if (!animPropSplitLine || typeof animPropSplitLine !== 'object' || Array.isArray(animPropSplitLine)) {
                animPropSplitLine = {};
            }
            const key = frameIndex + ':' + tileX + ',' + tileY;

            if (flatLineMode) {
                // Flat line follows the mouse live (every column = current Y)
                animPropSplitLine[key] = new Array(gridSize).fill(clampedY);
            } else {
                // Freeform: set only the hovered column
                if (!Array.isArray(animPropSplitLine[key])) {
                    animPropSplitLine[key] = new Array(gridSize).fill(Math.floor(gridSize / 2));
                }
                animPropSplitLine[key][clampedX] = clampedY;
            }
        }

        // Flip which half of the selected split tile covers the player (mirror toggleSplitFlip).
        // Flip is keyed by prop-local tile (frame-agnostic) — a tile's orientation is constant.
        function toggleAnimPropSplitFlip() {
            if (!animPropSplitTarget) return;
            const tileKey = animPropSplitTarget.tileX + ',' + animPropSplitTarget.tileY;
            const cb = document.getElementById('animPropSplitFlip');
            if (cb && cb.checked) {
                animPropSplitFlipped[tileKey] = true;
            } else {
                delete animPropSplitFlipped[tileKey];
            }
            animPropDrawCanvas();
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
                animPropSplitTarget = null; // End split drag (unlock tile)
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
            animPropSplitTarget = null; // End split drag (unlock tile)
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

            // Update collision + split frame dropdowns when frames change
            updateAnimPropCollisionFrameDropdown();
            updateAnimPropSplitFrameDropdown();

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
                splitFlipped: (animPropSplitFlipped && Object.keys(animPropSplitFlipped).length) ? JSON.parse(JSON.stringify(animPropSplitFlipped)) : null,
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
