        // ============ UI TAB — custom UI skins (builder doc) ============
        // The UI tab shows a LIST of skinnable slots (quest log button + panel). Each "Set Up"
        // opens a FULL-PAGE editor (mirrors the animated-prop editor): Load Image -> sheet view with
        // a frame grid you CLICK to include/exclude frames -> live preview + speed -> Static/Animated
        // + Always/On-hover -> Save/Cancel. Frame layout auto-detected (square): frames = round(w/h).
        // Output uiConfig[slot] = { spriteData, frames, frameW, frameH, fps, animated, trigger,
        // frameSeq(selected frame indices), textBox?(panel), _img } — shape save/load + MP + engine use.
        // (Quest-text placement / textBox drag is deferred — panel keeps a default textBox for now.)

        const DEFAULT_PANEL_TEXTBOX = { x: 50, y: 40, w: 156, h: 80 };        // ACTIVE quests zone (256-space)
        const DEFAULT_PANEL_COMPLETEDBOX = { x: 50, y: 128, w: 156, h: 80 };  // COMPLETED quests zone
        // The two scrollable quest-text zones drawn/edited in the Quest Text Zone editor.
        const UI_ZONES = [
            { key: 'textBox', def: DEFAULT_PANEL_TEXTBOX, color: '#0cf', lines: [['#0ff', 'bold 13px monospace', 'ACTIVE QUESTS', 16], ['#FFD700', 'bold 12px monospace', 'Soup for gran gran', 36], ['#aaa', '11px monospace', 'Find Ingredients for granny', 52]] },
            { key: 'completedBox', def: DEFAULT_PANEL_COMPLETEDBOX, color: '#4f4', lines: [['#4f4', 'bold 13px monospace', 'COMPLETED', 16], ['#4f4', '12px monospace', '✓ First quest done', 34]] }
        ];

        // ----- UI tab slot list (thumbnails + status) -----
        function drawUiThumb(slot) {
            const canvas = document.getElementById('uiThumb_' + slot);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 64, 64);
            const cfg = uiConfig[slot];
            if (cfg && cfg._img && cfg._img.complete && cfg._img.naturalWidth) {
                ctx.imageSmoothingEnabled = false;
                const f0 = (cfg.frameSeq && cfg.frameSeq.length) ? cfg.frameSeq[0] : 0;
                ctx.drawImage(cfg._img, f0 * cfg.frameW, 0, cfg.frameW, cfg.frameH, 0, 0, 64, 64);
            } else {
                ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 64, 64);
                ctx.fillStyle = '#555'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
                ctx.fillText('default', 32, 34);
            }
        }
        function updateUiTab() {
            ['questLogButton', 'questLogPanel'].forEach(slot => {
                drawUiThumb(slot);
                const status = document.getElementById('uiStatus_' + slot);
                if (!status) return;
                const cfg = uiConfig[slot];
                if (!cfg) { status.textContent = 'No image — using default'; return; }
                const n = (cfg.frameSeq && cfg.frameSeq.length) || cfg.frames || 1;
                status.textContent = n > 1
                    ? (n + ' frames · ' + (cfg.animated ? (cfg.trigger === 'hover' ? 'on hover' : 'animated') : 'static') + ' · ' + (cfg.fps || 8) + ' fps')
                    : 'single image (static)';
            });
        }

        // Revert a slot to the default UI (null) and refresh the list.
        function clearUiArt(slot) {
            if (!(slot in uiConfig)) return;
            uiConfig[slot] = null;
            updateUiTab();
            broadcastUiSlot(slot);
        }

        // Broadcast a slot's current config (stripped of runtime _img) to peers / test window.
        function broadcastUiSlot(slot) {
            let config = null;
            if (uiConfig[slot]) { config = { ...uiConfig[slot] }; delete config._img; }
            broadcastEdit({ editType: 'setUiConfig', slot, config });
        }

        // ===================== FULL-PAGE UI EDITOR =====================
        let uiEditorSlot = null;       // slot being edited
        let uiEditorWorking = null;    // in-progress config (committed only on Save)
        let uiEditorImage = null;      // loaded sheet Image
        let uiEditorPreviewIdx = 0;    // index INTO frameSeq for the live preview
        let uiEditorPreviewInterval = null;
        let uiEditorZoom = 1;          // sheet canvas zoom

        function uiEditorFrameRect(i) {
            const w = uiEditorWorking.frameW, h = uiEditorWorking.frameH;
            return { x: i * w, y: 0, w: w, h: h };
        }
        function uiEditorAllFrames() {
            return Array.from({ length: uiEditorWorking.frames }, (_, i) => i);
        }

        // Open the editor for a slot. Deep-copies the existing config into a working draft.
        function openUiEditor(slot) {
            uiEditorSlot = slot;
            const src = uiConfig[slot];
            uiEditorWorking = src
                ? { spriteData: src.spriteData, frames: src.frames, frameW: src.frameW, frameH: src.frameH,
                    fps: src.fps || 8, animated: !!src.animated, trigger: src.trigger || 'constant',
                    frameSeq: (src.frameSeq && src.frameSeq.length) ? [...src.frameSeq] : null,
                    textBox: src.textBox ? { ...src.textBox } : null }
                : { spriteData: null, frames: 1, frameW: 256, frameH: 256, fps: 8, animated: false, trigger: 'constant', frameSeq: null, textBox: null };

            document.getElementById('uiEditorTitle').textContent = slot === 'questLogPanel' ? 'Quest Log Panel' : 'Quest Log Button';
            document.getElementById('uiEditorFileName').textContent = uiEditorWorking.spriteData ? '(current art)' : '';

            uiEditorImage = null;
            if (uiEditorWorking.spriteData) {
                const img = new Image();
                img.onload = () => {
                    uiEditorImage = img;
                    if (!uiEditorWorking.frameSeq) uiEditorWorking.frameSeq = uiEditorAllFrames();
                    uiEditorFitZoom();
                    uiEditorSyncControls(); uiEditorDrawCanvas(); uiEditorUpdateFramesList(); uiEditorRestartPreview();
                };
                img.src = uiEditorWorking.spriteData;
            }
            uiEditorSyncControls();
            uiEditorDrawCanvas();
            uiEditorUpdateFramesList();
            uiEditorInitCanvas();
            document.getElementById('uiEditorModal').classList.add('visible');
        }

        function uiEditorSyncControls() {
            const w = uiEditorWorking;
            const has = !!w.spriteData;
            const selCount = (w.frameSeq && w.frameSeq.length) || w.frames || 0;
            document.getElementById('uiEditorPlaybackSection').style.display = has ? 'block' : 'none';
            document.getElementById('uiEditorFrameInfo').textContent = !has ? 'No image loaded — uses default UI.'
                : (w.frames > 1 ? (w.frames + ' frames (' + w.frameW + '×' + w.frameH + ' each)') : 'single image (static)');
            const animChk = document.getElementById('uiEditorAnimated');
            animChk.checked = w.animated; animChk.disabled = false;   // never lock (engine ignores anim at 1 frame)
            document.getElementById('uiEditorTriggerRow').style.display = w.animated ? 'block' : 'none';
            document.getElementById('uiEditorTrigger').value = w.trigger || 'constant';
            document.getElementById('uiEditorSpeedSlider').value = w.fps || 8;
            document.getElementById('uiEditorSpeedLabel').textContent = (w.fps || 8) + ' fps';
            // frame count is owned by uiEditorUpdateFramesList (the bottom timeline)
        }

        // Load a chosen image: auto-detect frames (square), select all by default, redraw.
        function uiEditorLoadSheet(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => {
                    const fh = img.naturalHeight || 256;
                    const frames = Math.max(1, Math.round((img.naturalWidth || fh) / fh));
                    uiEditorImage = img;
                    uiEditorWorking.spriteData = e.target.result;
                    uiEditorWorking.frames = frames;
                    uiEditorWorking.frameW = fh;
                    uiEditorWorking.frameH = fh;
                    uiEditorWorking.frameSeq = uiEditorAllFrames();
                    uiEditorWorking.animated = frames > 1;
                    if (uiEditorSlot === 'questLogPanel' && !uiEditorWorking.textBox) uiEditorWorking.textBox = { ...DEFAULT_PANEL_TEXTBOX };
                    document.getElementById('uiEditorFileName').textContent = file.name;
                    uiEditorFitZoom();
                    uiEditorSyncControls();
                    uiEditorDrawCanvas();
                    uiEditorUpdateFramesList();
                    uiEditorRestartPreview();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        }

        // ---- Sprite-sheet canvas (mirrors animPropDrawCanvas): sheet zoomed + frame grid +
        //      selected frames highlighted with a blue border + their loop-position number. ----
        function uiEditorDrawCanvas() {
            const canvas = document.getElementById('uiEditorSheetCanvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!uiEditorImage || !uiEditorWorking || !uiEditorWorking.spriteData) {
                canvas.width = 400; canvas.height = 200;
                ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 400, 200);
                ctx.fillStyle = '#666'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText('Load an image to begin', 200, 100); return;
            }
            const scale = uiEditorZoom;
            canvas.width = Math.round(uiEditorImage.naturalWidth * scale);
            canvas.height = Math.round(uiEditorImage.naturalHeight * scale);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(uiEditorImage, 0, 0, canvas.width, canvas.height);
            const fw = uiEditorWorking.frameW * scale;
            // frame grid
            ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
            for (let i = 0; i <= uiEditorWorking.frames; i++) {
                ctx.beginPath(); ctx.moveTo(i * fw, 0); ctx.lineTo(i * fw, canvas.height); ctx.stroke();
            }
            // highlight selected frames (blue border + loop-position number)
            const seq = uiEditorWorking.frameSeq || [];
            ctx.strokeStyle = '#4af'; ctx.lineWidth = 3;
            seq.forEach((fi, j) => {
                ctx.strokeRect(fi * fw + 2, 2, fw - 4, canvas.height - 4);
                ctx.fillStyle = '#4af'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
                ctx.fillText(String(j + 1), fi * fw + 6, 18);
            });
        }

        // Click a frame ON THE SHEET to ADD it to the loop (sheet order). Once-bound.
        function uiEditorInitCanvas() {
            const canvas = document.getElementById('uiEditorSheetCanvas');
            if (!canvas || canvas.dataset.uiBound) return;
            canvas.dataset.uiBound = '1';
            canvas.addEventListener('click', (e) => {
                if (!uiEditorImage || !uiEditorWorking || !uiEditorWorking.spriteData) return;
                const rect = canvas.getBoundingClientRect();
                const x = (e.clientX - rect.left) * (canvas.width / rect.width) / uiEditorZoom;
                const i = Math.floor(x / uiEditorWorking.frameW);
                if (i < 0 || i >= uiEditorWorking.frames) return;
                let seq = uiEditorWorking.frameSeq ? [...uiEditorWorking.frameSeq] : [];
                if (seq.indexOf(i) === -1) { seq.push(i); seq.sort((a, b) => a - b); uiEditorWorking.frameSeq = seq; uiEditorAfterFrameChange(); }
            });
        }

        // Bottom timeline (mirrors animPropUpdateFramesList): selected frames as 48px thumbnails,
        // numbered in loop order; click a thumbnail to REMOVE it.
        function uiEditorUpdateFramesList() {
            const container = document.getElementById('uiEditorFramesList');
            if (!container) return;
            container.innerHTML = '';
            const seq = (uiEditorWorking && uiEditorWorking.frameSeq) || [];
            const countEl = document.getElementById('uiEditorFrameCount');
            if (countEl) countEl.textContent = seq.length;
            if (!uiEditorImage || seq.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:11px;">Click frames on the sheet above to add them</div>';
                return;
            }
            const fw = uiEditorWorking.frameW, fh = uiEditorWorking.frameH;
            seq.forEach((fi, j) => {
                const thumb = document.createElement('div');
                thumb.className = 'anim-frame-thumb';
                thumb.title = 'Frame ' + (fi + 1) + ' — click to remove';
                const c = document.createElement('canvas'); c.width = 48; c.height = 48;
                const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false;
                const s = Math.min(48 / fw, 48 / fh), dw = fw * s, dh = fh * s;
                cx.drawImage(uiEditorImage, fi * fw, 0, fw, fh, (48 - dw) / 2, (48 - dh) / 2, dw, dh);
                const num = document.createElement('span');
                num.textContent = j + 1;
                num.style.cssText = 'position:absolute; top:1px; left:3px; color:#4af; font:bold 10px monospace; text-shadow:0 0 2px #000;';
                thumb.appendChild(c); thumb.appendChild(num);
                thumb.onclick = () => {
                    const s2 = [...uiEditorWorking.frameSeq]; s2.splice(j, 1);
                    uiEditorWorking.frameSeq = s2; uiEditorAfterFrameChange();
                };
                container.appendChild(thumb);
            });
        }

        // Redraw everything after the frame selection changes.
        function uiEditorAfterFrameChange() {
            uiEditorSyncControls();
            uiEditorDrawCanvas();
            uiEditorUpdateFramesList();
            uiEditorRestartPreview();
        }
        function uiEditorSelectAll() {
            if (!uiEditorWorking || !uiEditorWorking.spriteData) return;
            uiEditorWorking.frameSeq = uiEditorAllFrames();
            uiEditorAfterFrameChange();
        }
        function uiEditorClearFrames() {
            if (!uiEditorWorking) return;
            uiEditorWorking.frameSeq = [];
            uiEditorAfterFrameChange();
        }
        function uiEditorZoomIn() { uiEditorZoom = Math.min(4, uiEditorZoom * 1.5); uiEditorUpdateZoomLabel(); uiEditorDrawCanvas(); }
        function uiEditorZoomOut() { uiEditorZoom = Math.max(0.05, uiEditorZoom / 1.5); uiEditorUpdateZoomLabel(); uiEditorDrawCanvas(); }
        function uiEditorUpdateZoomLabel() {
            const el = document.getElementById('uiEditorZoomLevel');
            if (el) el.textContent = (uiEditorZoom >= 1 ? uiEditorZoom.toFixed(1) : uiEditorZoom.toFixed(2)) + 'x';
        }
        // Pick an initial zoom so the whole strip fits ~1100px wide.
        function uiEditorFitZoom() {
            if (!uiEditorImage) { uiEditorZoom = 1; return; }
            uiEditorZoom = Math.max(0.05, Math.min(2, 1100 / uiEditorImage.naturalWidth));
            uiEditorUpdateZoomLabel();
        }

        // ----- live preview (mirrors animPropStartLivePreview/StopPreview/UpdateSpeed) -----
        function uiEditorRestartPreview() {
            uiEditorStopPreview();
            uiEditorPreviewIdx = 0;
            uiEditorDrawLivePreview();
            const seq = uiEditorWorking && uiEditorWorking.frameSeq;
            if (uiEditorWorking && uiEditorWorking.spriteData && uiEditorWorking.animated && seq && seq.length > 1) {
                const fps = uiEditorWorking.fps || 8;
                uiEditorPreviewInterval = setInterval(() => {
                    uiEditorPreviewIdx = (uiEditorPreviewIdx + 1) % seq.length;
                    uiEditorDrawLivePreview();
                }, 1000 / fps);
            }
        }
        function uiEditorStopPreview() {
            if (uiEditorPreviewInterval) { clearInterval(uiEditorPreviewInterval); uiEditorPreviewInterval = null; }
        }
        function uiEditorDrawLivePreview() {
            const canvas = document.getElementById('uiEditorLivePreview');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 48, 48);
            if (!uiEditorImage || !uiEditorWorking) return;
            const seq = (uiEditorWorking.frameSeq && uiEditorWorking.frameSeq.length) ? uiEditorWorking.frameSeq : [0];
            const r = uiEditorFrameRect(seq[uiEditorPreviewIdx % seq.length] || 0);
            ctx.imageSmoothingEnabled = false;
            const scale = Math.min(48 / r.w, 48 / r.h);
            const dw = r.w * scale, dh = r.h * scale;
            ctx.drawImage(uiEditorImage, r.x, r.y, r.w, r.h, (48 - dw) / 2, (48 - dh) / 2, dw, dh);
        }
        function uiEditorUpdateSpeed() {
            const fps = parseInt(document.getElementById('uiEditorSpeedSlider').value) || 8;
            document.getElementById('uiEditorSpeedLabel').textContent = fps + ' fps';
            if (uiEditorWorking) uiEditorWorking.fps = fps;
            uiEditorRestartPreview();
        }
        function uiEditorToggleAnimated(on) {
            if (!uiEditorWorking) return;
            uiEditorWorking.animated = !!on;
            document.getElementById('uiEditorTriggerRow').style.display = on ? 'block' : 'none';
            uiEditorRestartPreview();
        }
        function uiEditorSetTrigger(mode) {
            if (uiEditorWorking) uiEditorWorking.trigger = (mode === 'hover') ? 'hover' : 'constant';
        }

        // Commit the working draft into uiConfig[slot] (or clear if no image) + broadcast.
        function uiEditorSave() {
            const slot = uiEditorSlot;
            if (slot && (slot in uiConfig)) {
                if (uiEditorWorking && uiEditorWorking.spriteData) {
                    const cfg = {
                        spriteData: uiEditorWorking.spriteData,
                        frames: uiEditorWorking.frames, frameW: uiEditorWorking.frameW, frameH: uiEditorWorking.frameH,
                        fps: uiEditorWorking.fps || 8, animated: !!uiEditorWorking.animated,
                        trigger: uiEditorWorking.trigger || 'constant',
                        frameSeq: (uiEditorWorking.frameSeq && uiEditorWorking.frameSeq.length) ? [...uiEditorWorking.frameSeq] : uiEditorAllFrames(),
                        _img: uiEditorImage || new Image()
                    };
                    if (slot === 'questLogPanel') cfg.textBox = uiEditorWorking.textBox || { ...DEFAULT_PANEL_TEXTBOX };
                    if (!cfg._img.complete) cfg._img.src = cfg.spriteData;
                    uiConfig[slot] = cfg;
                } else {
                    uiConfig[slot] = null;
                }
                updateUiTab();
                broadcastUiSlot(slot);
            }
            uiEditorCloseModal();
        }
        function uiEditorClear() {
            if (uiEditorSlot && (uiEditorSlot in uiConfig)) { uiConfig[uiEditorSlot] = null; updateUiTab(); broadcastUiSlot(uiEditorSlot); }
            uiEditorCloseModal();
        }
        function uiEditorCancel() { uiEditorCloseModal(); }
        function uiEditorCloseModal() {
            uiEditorStopPreview();
            uiEditorWorking = null; uiEditorImage = null; uiEditorSlot = null;
            const m = document.getElementById('uiEditorModal');
            if (m) m.classList.remove('visible');
        }

        // ===================== UI LAYOUT (position + size on screen) =====================
        // Resolution-independent: anchor + fractional offset/size (builder copy of engine defaults).
        // sizePct = fraction of screen HEIGHT, offsetXPct = fraction of width, offsetYPct of height.
        const UI_LAYOUT_DEFAULTS_B = {
            questLogButton: { anchor: 'top-right', offsetXPct: 0.008, offsetYPct: 0.012, sizePct: 0.16 },
            questLogPanel:  { anchor: 'center',    offsetXPct: 0,     offsetYPct: 0,     sizePct: 0.58 }
        };
        let uiLayoutScreenshot = null;  // builder-only reference backdrop (NOT saved into the project)
        const UI_LAYOUT_SLOTS = ['questLogButton', 'questLogPanel'];
        let uiLayoutScreenW = 1280, uiLayoutScreenH = 720, uiLayoutScale = 1; // last-drawn screen dims + canvas scale
        let uiLayoutDrag = null;        // { slot, mode, sx, sy, offXPct, offYPct, sizePct, anchor }

        function uiLayoutGet(slot) {
            const d = UI_LAYOUT_DEFAULTS_B[slot] || { anchor: 'center', offsetXPct: 0, offsetYPct: 0, sizePct: 0.3 };
            const c = uiConfig[slot] || {};
            return {
                anchor: c.anchor || d.anchor,
                offsetXPct: (c.offsetXPct != null ? c.offsetXPct : d.offsetXPct),
                offsetYPct: (c.offsetYPct != null ? c.offsetYPct : d.offsetYPct),
                sizePct: (c.sizePct != null ? c.sizePct : d.sizePct)
            };
        }

        function openUiLayout() {
            if (!uiLayoutScreenshot) {
                // user's uploaded override (localStorage) wins; else the bundled default screenshot
                const src = localStorage.getItem('uiLayoutScreenshot') || 'assets/ui/layout-sample.png';
                const img = new Image();
                img.onload = () => { uiLayoutScreenshot = img; uiLayoutDraw(); };
                img.src = src;
            }
            uiLayoutSyncControls();
            uiLayoutInitCanvas();
            uiLayoutDraw();
            document.getElementById('uiLayoutModal').classList.add('visible');
        }
        function uiLayoutClose() {
            const m = document.getElementById('uiLayoutModal');
            if (m) m.classList.remove('visible');
        }
        // "Lock In" the layout, then lead into the quest-text-zone setup if the panel has art.
        function uiLayoutLockIn() {
            uiLayoutClose();
            if (uiConfig.questLogPanel && uiConfig.questLogPanel.spriteData) openUiZone();
        }

        // ===================== QUEST TEXT ZONE (where "ACTIVE QUESTS" renders on the panel) =====================
        let uiZoneImg = null, uiZoneScale = 1, uiZoneDrag = null;
        function uiZoneFrame() { return (uiConfig.questLogPanel && uiConfig.questLogPanel.frameW) || 256; }

        const DEFAULT_TEXT_STYLE = { font: "'Press Start 2P', monospace", size: 10, color: '#ffffff', titleColor: '#00ffff' };
        const UI_ZONE_SAMPLE_ACTIVE = [{ name: 'Soup for gran gran', description: 'Find Ingredients for granny' }, { name: 'The lost cat', description: 'Search the forest' }];
        const UI_ZONE_SAMPLE_COMPLETED = [{ name: 'First steps', description: '' }, { name: 'Meet the blacksmith', description: '' }];

        // === SHARED: keep in sync with the engine copy in src/game/engine/10-quest-functions.js ===
        function buildQuestTextHtml(list, isCompleted, style) {
            const s = style || {};
            const font = s.font || "'Press Start 2P', monospace";
            const size = s.size || 10;
            const color = s.color || '#ffffff';
            const titleColor = s.titleColor || '#0ff';
            let html = '<div style="font-family:' + font + '; font-size:' + size + 'px; color:' + color + '; line-height:1.6;">';
            html += '<div style="color:' + titleColor + '; font-weight:bold; margin-bottom:8px;">' + (isCompleted ? 'COMPLETED' : 'ACTIVE QUESTS') + '</div>';
            if (!list || list.length === 0) {
                html += '<div style="opacity:0.55;">' + (isCompleted ? 'None yet' : 'None active') + '</div>';
            } else if (isCompleted) {
                list.forEach(function (q) { html += '<div style="color:' + titleColor + '; margin-bottom:6px;">✓ ' + q.name + '</div>'; });
            } else {
                list.forEach(function (q) {
                    html += '<div style="margin-bottom:10px;">';
                    html += '<div style="color:' + titleColor + '; font-weight:bold;">' + q.name + '</div>';
                    if (q.description) html += '<div style="margin-top:2px;">' + q.description + '</div>';
                    html += '</div>';
                });
            }
            html += '</div>';
            return html;
        }

        // Create the two real-text preview overlays (exactly what the game renders) over the panel.
        function uiZoneEnsureOverlays() {
            const canvas = document.getElementById('uiZoneCanvas'); if (!canvas) return;
            const area = canvas.parentElement; area.style.position = 'relative';
            ['Active', 'Completed'].forEach(k => {
                if (!document.getElementById('uiZonePreview' + k)) {
                    const el = document.createElement('div');
                    el.id = 'uiZonePreview' + k;
                    el.style.cssText = 'position:absolute; overflow-y:auto; pointer-events:none; box-sizing:border-box; padding:0;';
                    area.appendChild(el);
                }
            });
        }
        function uiZoneHideOverlays() {
            ['Active', 'Completed'].forEach(k => { const el = document.getElementById('uiZonePreview' + k); if (el) el.style.display = 'none'; });
        }
        function uiZoneSyncTextStyle() {
            const s = (uiConfig.questLogPanel && uiConfig.questLogPanel.textStyle) || {};
            const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
            set('uiZoneFont', s.font || DEFAULT_TEXT_STYLE.font);
            set('uiZoneSize', s.size || DEFAULT_TEXT_STYLE.size);
            const lbl = document.getElementById('uiZoneSizeLbl'); if (lbl) lbl.textContent = s.size || DEFAULT_TEXT_STYLE.size;
            set('uiZoneColor', s.color || DEFAULT_TEXT_STYLE.color);
            set('uiZoneTitleColor', s.titleColor || DEFAULT_TEXT_STYLE.titleColor);
        }
        function uiZoneSetTextStyle(field, value) {
            const cfg = uiConfig.questLogPanel; if (!cfg) return;
            if (!cfg.textStyle) cfg.textStyle = { ...DEFAULT_TEXT_STYLE };
            cfg.textStyle[field] = value;
            if (field === 'size') { const lbl = document.getElementById('uiZoneSizeLbl'); if (lbl) lbl.textContent = value; }
            broadcastUiSlot('questLogPanel');
            uiZoneDraw();
        }

        function openUiZone() {
            const cfg = uiConfig.questLogPanel;
            if (!cfg || !cfg.spriteData) return;
            UI_ZONES.forEach(z => { if (!cfg[z.key]) cfg[z.key] = { ...z.def }; });   // ensure both boxes exist
            uiZoneImg = (cfg._img && cfg._img.complete) ? cfg._img : null;
            if (!uiZoneImg) { const im = new Image(); im.onload = () => { uiZoneImg = im; uiZoneDraw(); }; im.src = cfg.spriteData; }
            uiZoneEnsureOverlays();
            uiZoneInitCanvas();
            uiZoneSyncTextStyle();
            uiZoneDraw();
            document.getElementById('uiZoneModal').classList.add('visible');
        }
        function uiZoneClose() {
            uiZoneHideOverlays();
            const m = document.getElementById('uiZoneModal'); if (m) m.classList.remove('visible');
            broadcastUiSlot('questLogPanel');
        }
        function uiZoneReset() {
            const cfg = uiConfig.questLogPanel; if (!cfg) return;
            UI_ZONES.forEach(z => { cfg[z.key] = { ...z.def }; });
            uiZoneDraw();
        }
        function uiZoneDraw() {
            const canvas = document.getElementById('uiZoneCanvas'); if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const F = uiZoneFrame(), disp = 540; uiZoneScale = disp / F;
            canvas.width = disp; canvas.height = disp;
            ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, disp, disp);
            const cfg = uiConfig.questLogPanel; if (!cfg) return;
            if (uiZoneImg && uiZoneImg.complete && uiZoneImg.naturalWidth) {
                const f0 = (cfg.frameSeq && cfg.frameSeq.length) ? cfg.frameSeq[0] : 0;
                ctx.drawImage(uiZoneImg, f0 * cfg.frameW, 0, cfg.frameW, cfg.frameH, 0, 0, disp, disp);
            }
            // Builder-only dashed outline + resize handle per zone (no boxes/outline in-game).
            UI_ZONES.forEach(z => {
                const b = cfg[z.key] || z.def;
                const bx = b.x * uiZoneScale, by = b.y * uiZoneScale, bw = b.w * uiZoneScale, bh = b.h * uiZoneScale;
                ctx.strokeStyle = z.color; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(bx, by, bw, bh); ctx.setLineDash([]);
                ctx.fillStyle = z.color; ctx.fillRect(bx + bw - 12, by + bh - 12, 12, 12);
            });
            // Real-text WYSIWYG overlays — identical to what the game renders (buildQuestTextHtml).
            const style = cfg.textStyle || {};
            const ox = canvas.offsetLeft, oy = canvas.offsetTop;
            const zones = [
                { k: 'Active', box: cfg.textBox || DEFAULT_PANEL_TEXTBOX, list: UI_ZONE_SAMPLE_ACTIVE, comp: false },
                { k: 'Completed', box: cfg.completedBox || DEFAULT_PANEL_COMPLETEDBOX, list: UI_ZONE_SAMPLE_COMPLETED, comp: true }
            ];
            zones.forEach(z => {
                const el = document.getElementById('uiZonePreview' + z.k); if (!el) return;
                el.style.display = 'block';
                el.style.left = (ox + z.box.x * uiZoneScale) + 'px';
                el.style.top = (oy + z.box.y * uiZoneScale) + 'px';
                el.style.width = (z.box.w * uiZoneScale) + 'px';
                el.style.height = (z.box.h * uiZoneScale) + 'px';
                el.innerHTML = buildQuestTextHtml(z.list, z.comp, style);
            });
        }
        function uiZoneInitCanvas() {
            const canvas = document.getElementById('uiZoneCanvas');
            if (!canvas || canvas.dataset.uiZoneBound) return;
            canvas.dataset.uiZoneBound = '1';
            const toFrame = (e) => {
                const r = canvas.getBoundingClientRect();
                return { x: (e.clientX - r.left) / r.width * canvas.width / uiZoneScale, y: (e.clientY - r.top) / r.height * canvas.height / uiZoneScale };
            };
            canvas.addEventListener('mousedown', (e) => {
                const cfg = uiConfig.questLogPanel; if (!cfg) return;
                const p = toFrame(e);
                for (const z of UI_ZONES) {
                    const tb = cfg[z.key]; if (!tb) continue;
                    if (p.x >= tb.x && p.x <= tb.x + tb.w && p.y >= tb.y && p.y <= tb.y + tb.h) {
                        const hz = 14 / uiZoneScale;
                        const onHandle = (p.x > tb.x + tb.w - hz) && (p.y > tb.y + tb.h - hz);
                        uiZoneDrag = { key: z.key, mode: onHandle ? 'resize' : 'move', sx: p.x, sy: p.y, x: tb.x, y: tb.y, w: tb.w, h: tb.h };
                        canvas.style.cursor = onHandle ? 'nwse-resize' : 'move';
                        e.preventDefault();
                        return;
                    }
                }
            });
            window.addEventListener('mousemove', (e) => {
                if (!uiZoneDrag) return;
                const cfg = uiConfig.questLogPanel; if (!cfg) return;
                const p = toFrame(e), d = uiZoneDrag, F = uiZoneFrame(), tb = cfg[d.key];
                if (!tb) return;
                if (d.mode === 'resize') {
                    tb.w = Math.max(20, Math.min(F - d.x, Math.round(d.w + (p.x - d.sx))));
                    tb.h = Math.max(20, Math.min(F - d.y, Math.round(d.h + (p.y - d.sy))));
                } else {
                    tb.x = Math.max(0, Math.min(F - d.w, Math.round(d.x + (p.x - d.sx))));
                    tb.y = Math.max(0, Math.min(F - d.h, Math.round(d.y + (p.y - d.sy))));
                }
                uiZoneDraw();
            });
            window.addEventListener('mouseup', () => {
                if (!uiZoneDrag) return;
                uiZoneDrag = null;
                const c = document.getElementById('uiZoneCanvas'); if (c) c.style.cursor = 'default';
                broadcastUiSlot('questLogPanel');
            });
        }

        // Reflect each slot's layout into the sidebar controls; disable controls for slots with no art.
        function uiLayoutSyncControls() {
            UI_LAYOUT_SLOTS.forEach(slot => {
                const has = !!(uiConfig[slot] && uiConfig[slot].spriteData);
                const L = uiLayoutGet(slot);
                const anchorEl = document.getElementById('uiLayoutAnchor_' + slot);
                const offX = document.getElementById('uiLayoutOffX_' + slot);
                const offY = document.getElementById('uiLayoutOffY_' + slot);
                const size = document.getElementById('uiLayoutSize_' + slot);
                const lbl = document.getElementById('uiLayoutSizeLbl_' + slot);
                const note = document.getElementById('uiLayoutNote_' + slot);
                if (anchorEl) anchorEl.value = L.anchor;
                if (offX) offX.value = Math.round(L.offsetXPct * 100);
                if (offY) offY.value = Math.round(L.offsetYPct * 100);
                if (size) size.value = Math.round(L.sizePct * 100);
                if (lbl) lbl.textContent = Math.round(L.sizePct * 100);
                [anchorEl, offX, offY, size].forEach(e => { if (e) e.disabled = !has; });
                if (note) note.style.display = has ? 'none' : 'block';
            });
        }
        function uiLayoutSetAnchor(slot, v) { if (!uiConfig[slot]) return; uiConfig[slot].anchor = v; broadcastUiSlot(slot); uiLayoutDraw(); }
        function uiLayoutSetOffset(slot, axis, v) { if (!uiConfig[slot]) return; uiConfig[slot][axis === 'x' ? 'offsetXPct' : 'offsetYPct'] = (v || 0) / 100; broadcastUiSlot(slot); uiLayoutDraw(); }
        function uiLayoutSetSize(slot, v) {
            if (!uiConfig[slot]) return;
            uiConfig[slot].sizePct = Math.max(0.01, (v || 0) / 100);
            const lbl = document.getElementById('uiLayoutSizeLbl_' + slot); if (lbl) lbl.textContent = v;
            broadcastUiSlot(slot); uiLayoutDraw();
        }
        function uiLayoutLoadScreenshot(event) {
            const file = event.target.files && event.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => { uiLayoutScreenshot = img; try { localStorage.setItem('uiLayoutScreenshot', e.target.result); } catch (_) {} uiLayoutDraw(); };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file); event.target.value = '';
        }

        // Top-left of an element's box in a WxH screen (fractions -> px; mirrors the engine).
        function uiLayoutBox(slot, screenW, screenH) {
            const L = uiLayoutGet(slot), a = L.anchor;
            const s = L.sizePct * screenH, offX = L.offsetXPct * screenW, offY = L.offsetYPct * screenH;
            let left, top;
            if (a.startsWith('top')) top = offY;
            else if (a.startsWith('bottom')) top = screenH - s - offY;
            else top = (screenH - s) / 2 + offY;
            if (a.endsWith('left')) left = offX;
            else if (a.endsWith('right')) left = screenW - s - offX;
            else left = (screenW - s) / 2 + offX;
            return { left: left, top: top, size: s };
        }

        function uiLayoutDraw() {
            const canvas = document.getElementById('uiLayoutCanvas'); if (!canvas) return;
            const ctx = canvas.getContext('2d');
            let sw = 1280, sh = 720;
            if (uiLayoutScreenshot && uiLayoutScreenshot.naturalWidth) { sw = uiLayoutScreenshot.naturalWidth; sh = uiLayoutScreenshot.naturalHeight; }
            const scale = Math.min(900 / sw, 540 / sh);
            canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
            uiLayoutScreenW = sw; uiLayoutScreenH = sh; uiLayoutScale = scale;
            ctx.imageSmoothingEnabled = false;
            if (uiLayoutScreenshot && uiLayoutScreenshot.naturalWidth) {
                ctx.drawImage(uiLayoutScreenshot, 0, 0, canvas.width, canvas.height);
            } else {
                ctx.fillStyle = '#223040'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#557'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText('Load a game screenshot for reference (16:9 assumed)', canvas.width / 2, canvas.height / 2);
            }
            UI_LAYOUT_SLOTS.forEach(slot => {
                const cfg = uiConfig[slot];
                if (!cfg || !cfg._img || !cfg._img.complete || !cfg._img.naturalWidth) return;
                const box = uiLayoutBox(slot, sw, sh);
                const bx = box.left * scale, by = box.top * scale, bs = box.size * scale;
                const f0 = (cfg.frameSeq && cfg.frameSeq.length) ? cfg.frameSeq[0] : 0;
                ctx.drawImage(cfg._img, f0 * cfg.frameW, 0, cfg.frameW, cfg.frameH, bx, by, bs, bs);
                ctx.strokeStyle = '#0cf'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bs, bs);
                // bottom-right resize handle
                ctx.fillStyle = '#0cf'; ctx.fillRect(bx + bs - 11, by + bs - 11, 11, 11);
                ctx.fillStyle = '#0cf'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
                ctx.fillText(slot === 'questLogPanel' ? 'Panel' : 'Button', bx + 3, by + 13);
            });
        }

        // Drag a UI element on the preview to move it; drag its bottom-right handle to resize
        // (size stays square — the art never stretches). Both update the same anchor/offset/size.
        function uiLayoutInitCanvas() {
            const canvas = document.getElementById('uiLayoutCanvas');
            if (!canvas || canvas.dataset.uiLayBound) return;
            canvas.dataset.uiLayBound = '1';
            const toScreen = (e) => {
                const r = canvas.getBoundingClientRect();
                return { x: (e.clientX - r.left) / r.width * uiLayoutScreenW, y: (e.clientY - r.top) / r.height * uiLayoutScreenH };
            };
            canvas.addEventListener('mousedown', (e) => {
                const p = toScreen(e);
                for (const slot of ['questLogPanel', 'questLogButton']) {   // panel drawn on top → hit-test first
                    const cfg = uiConfig[slot];
                    if (!cfg || !cfg.spriteData) continue;
                    const box = uiLayoutBox(slot, uiLayoutScreenW, uiLayoutScreenH);
                    if (p.x >= box.left && p.x <= box.left + box.size && p.y >= box.top && p.y <= box.top + box.size) {
                        const hz = Math.max(18, box.size * 0.18);
                        const onHandle = (p.x > box.left + box.size - hz) && (p.y > box.top + box.size - hz);
                        const L = uiLayoutGet(slot);
                        uiLayoutDrag = { slot: slot, mode: onHandle ? 'resize' : 'move', sx: p.x, sy: p.y, offXPct: L.offsetXPct, offYPct: L.offsetYPct, sizePct: L.sizePct, anchor: L.anchor };
                        canvas.style.cursor = onHandle ? 'nwse-resize' : 'move';
                        e.preventDefault();
                        return;
                    }
                }
            });
            window.addEventListener('mousemove', (e) => {
                if (!uiLayoutDrag) return;
                const p = toScreen(e), d = uiLayoutDrag, cfg = uiConfig[d.slot];
                if (!cfg) return;
                if (d.mode === 'resize') {
                    const grow = Math.max(p.x - d.sx, p.y - d.sy) / uiLayoutScreenH;  // px delta -> fraction of height
                    cfg.sizePct = Math.max(0.02, Math.min(1.5, d.sizePct + grow));
                } else {
                    const dxs = d.anchor.endsWith('right') ? -1 : 1;        // offset sign depends on anchor
                    const dys = d.anchor.startsWith('bottom') ? -1 : 1;
                    cfg.offsetXPct = d.offXPct + dxs * (p.x - d.sx) / uiLayoutScreenW;
                    cfg.offsetYPct = d.offYPct + dys * (p.y - d.sy) / uiLayoutScreenH;
                }
                uiLayoutSyncControls();
                uiLayoutDraw();
            });
            window.addEventListener('mouseup', () => {
                if (!uiLayoutDrag) return;
                broadcastUiSlot(uiLayoutDrag.slot);
                uiLayoutDrag = null;
                const c = document.getElementById('uiLayoutCanvas'); if (c) c.style.cursor = 'default';
            });
        }
