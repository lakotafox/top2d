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
