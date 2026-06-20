        // ============ UI TAB — custom UI skins (builder doc) ============
        // Assign/clear custom art for in-game UI slots (quest log button + panel), preview it,
        // drag the panel's text-content box, and broadcast changes to co-op peers / the test window.
        // Hotbar + inventory are scaffolded in uiConfig but have no UI here yet (default-only).

        const UI_FRAME = 256;        // each frame is 256x256 in the sheet
        const UI_FRAMES = 16;        // 16-frame horizontal strip (sheet = 4096x256)
        const DEFAULT_PANEL_TEXTBOX = { x: 58, y: 44, w: 153, h: 154 }; // gold-center default (256-space)

        // Chosen PNG file -> dataURL -> assign to slot.
        function onUiFileChosen(slot, input) {
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = e => assignUiArt(slot, e.target.result);
            reader.readAsDataURL(file);
        }

        // Build uiConfig[slot] from a base64 dataURL, load its image, repaint, broadcast.
        function assignUiArt(slot, dataURL) {
            if (!(slot in uiConfig)) return;
            const cfg = {
                spriteData: dataURL,
                frames: UI_FRAMES,
                frameW: UI_FRAME,
                frameH: UI_FRAME,
                fps: (uiConfig[slot] && uiConfig[slot].fps) || 8,
                _img: new Image()
            };
            if (slot === 'questLogPanel') {
                cfg.textBox = (uiConfig[slot] && uiConfig[slot].textBox) || { ...DEFAULT_PANEL_TEXTBOX };
            }
            cfg._img.onload = () => drawUiPreview(slot);
            cfg._img.src = dataURL;
            uiConfig[slot] = cfg;
            drawUiPreview(slot);
            broadcastUiSlot(slot);
        }

        // Revert a slot to the built-in default (null = use default UI).
        function clearUiArt(slot) {
            if (!(slot in uiConfig)) return;
            uiConfig[slot] = null;
            drawUiPreview(slot);
            const fpsEl = document.getElementById('uiFps_' + slot);
            if (fpsEl) fpsEl.value = 8;
            broadcastUiSlot(slot);
        }

        function setUiFps(slot, fps) {
            if (!uiConfig[slot]) return;
            uiConfig[slot].fps = Math.max(1, Math.min(30, fps || 8));
            broadcastUiSlot(slot);
        }

        // Broadcast a slot's current config (stripped of runtime _img) to peers / test window.
        function broadcastUiSlot(slot) {
            let config = null;
            if (uiConfig[slot]) {
                config = { ...uiConfig[slot] };
                delete config._img;
            }
            broadcastEdit({ editType: 'setUiConfig', slot, config });
        }

        // Draw frame 0 of a slot's sheet into its preview canvas (+ textBox overlay on the panel).
        function drawUiPreview(slot) {
            const canvas = document.getElementById('uiPreview_' + slot);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const cfg = uiConfig[slot];
            if (cfg && cfg._img && cfg._img.complete && cfg._img.naturalWidth) {
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(cfg._img, 0, 0, UI_FRAME, UI_FRAME, 0, 0, canvas.width, canvas.height);
                if (slot === 'questLogPanel' && cfg.textBox) {
                    const s = canvas.width / UI_FRAME;
                    ctx.strokeStyle = '#0cf';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([4, 3]);
                    ctx.strokeRect(cfg.textBox.x * s, cfg.textBox.y * s, cfg.textBox.w * s, cfg.textBox.h * s);
                    ctx.setLineDash([]);
                }
            } else {
                ctx.fillStyle = '#222';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#555';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('(default)', canvas.width / 2, canvas.height / 2);
            }
        }

        // Repaint all previews + sync fps inputs from uiConfig (on tab open / after load / remote edit).
        function updateUiTab() {
            ['questLogButton', 'questLogPanel'].forEach(slot => {
                drawUiPreview(slot);
                const fpsEl = document.getElementById('uiFps_' + slot);
                if (fpsEl) fpsEl.value = (uiConfig[slot] && uiConfig[slot].fps) || 8;
            });
        }

        // Drag a text-content box on the panel preview (defines where quest text renders, in 256-space).
        (function initUiTextBoxDrag() {
            const canvas = document.getElementById('uiPreview_questLogPanel');
            if (!canvas) return;
            let dragging = false, startX = 0, startY = 0;
            const toModel = (ev) => {
                const r = canvas.getBoundingClientRect();
                const s = UI_FRAME / r.width; // displayed px -> 256-space
                return { x: (ev.clientX - r.left) * s, y: (ev.clientY - r.top) * s };
            };
            canvas.addEventListener('mousedown', (ev) => {
                if (!uiConfig.questLogPanel) return;
                dragging = true;
                const p = toModel(ev); startX = p.x; startY = p.y;
            });
            window.addEventListener('mousemove', (ev) => {
                if (!dragging || !uiConfig.questLogPanel) return;
                const p = toModel(ev);
                const x = Math.max(0, Math.min(startX, p.x));
                const y = Math.max(0, Math.min(startY, p.y));
                const w = Math.min(UI_FRAME, Math.abs(p.x - startX));
                const h = Math.min(UI_FRAME, Math.abs(p.y - startY));
                uiConfig.questLogPanel.textBox = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
                drawUiPreview('questLogPanel');
            });
            window.addEventListener('mouseup', () => {
                if (!dragging) return;
                dragging = false;
                if (uiConfig.questLogPanel) broadcastUiSlot('questLogPanel');
            });
        })();
