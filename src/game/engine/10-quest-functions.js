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

        // ===== Custom UI skin helpers (game doc) =====
        // A slot is skinned only when its sheet Image is loaded; otherwise the default inline-styled
        // DOM look is left untouched. No live updates — uiConfigData is a snapshot taken at Play.
        // Per slot: frames (auto-detected), animated (bool), trigger ('constant'|'hover'), fps.
        const uiHover = { questLogButton: false, questLogPanel: false };

        // Per-slot LAYOUT defaults — resolution-INDEPENDENT (fractions of the screen) so the builder
        // preview (fraction × screenshot) and the game (fraction × window) match on any res/DPI.
        // sizePct = fraction of screen HEIGHT (square element); offsetXPct = fraction of width,
        // offsetYPct = fraction of height (from the anchor). Defaults ≈ the old hardcoded look.
        const UI_LAYOUT_DEFAULTS = {
            questLogButton: { anchor: 'top-right',    offsetXPct: 0.008, offsetYPct: 0.012, sizePct: 0.16 },
            questLogPanel:  { anchor: 'center',        offsetXPct: 0,     offsetYPct: 0,     sizePct: 0.58 },
            hotbar:         { anchor: 'bottom-center', offsetXPct: 0,     offsetYPct: 0.013, sizePct: 0.34 },
            inventory:      { anchor: 'center',        offsetXPct: 0,     offsetYPct: 0,     sizePct: 0.55 }
        };
        function uiLayoutFor(slot) {
            const d = UI_LAYOUT_DEFAULTS[slot] || { anchor: 'center', offsetXPct: 0, offsetYPct: 0, sizePct: 0.3 };
            const c = uiConfigData[slot] || {};
            return {
                anchor:     c.anchor || d.anchor,
                offsetXPct: (c.offsetXPct != null ? c.offsetXPct : d.offsetXPct),
                offsetYPct: (c.offsetYPct != null ? c.offsetYPct : d.offsetYPct),
                sizePct:    (c.sizePct    != null ? c.sizePct    : d.sizePct)
            };
        }
        function uiSize(slot) { return Math.max(8, Math.round(uiLayoutFor(slot).sizePct * window.innerHeight)); }

        // Position + size a skinned element on screen from its layout config (fractions -> px).
        function applyUiLayout(el, slot) {
            const L = uiLayoutFor(slot);
            const offX = Math.round(L.offsetXPct * window.innerWidth);
            const offY = Math.round(L.offsetYPct * window.innerHeight);
            el.style.position = 'fixed';
            el.style.top = el.style.bottom = el.style.left = el.style.right = 'auto';
            let tx = '0', ty = '0', useT = false, a = L.anchor;
            if (a.startsWith('top')) el.style.top = offY + 'px';
            else if (a.startsWith('bottom')) el.style.bottom = offY + 'px';
            else { el.style.top = '50%'; ty = 'calc(-50% + ' + offY + 'px)'; useT = true; }
            if (a.endsWith('left')) el.style.left = offX + 'px';
            else if (a.endsWith('right')) el.style.right = offX + 'px';
            else { el.style.left = '50%'; tx = 'calc(-50% + ' + offX + 'px)'; useT = true; }
            el.style.transform = useT ? ('translate(' + tx + ',' + ty + ')') : 'none';
        }

        // Rescale/reposition the skinned HUD when the window/canvas size changes (debounced).
        let _uiResizeTimer = null;
        window.addEventListener('resize', function () {
            clearTimeout(_uiResizeTimer);
            _uiResizeTimer = setTimeout(function () { if (typeof applyUiSkins === 'function') applyUiSkins(); }, 120);
        });

        function uiSkinReady(slot) {
            return !!(uiImages[slot] && uiImages[slot].complete && uiImages[slot].naturalWidth);
        }
        function uiFrames(slot) { return (uiConfigData[slot] && uiConfigData[slot].frames) || 1; }
        // The ordered list of sheet-frame indices to play (creator-selected subset, or all frames).
        function uiSeq(slot) {
            const cfg = uiConfigData[slot];
            if (cfg && cfg.frameSeq && cfg.frameSeq.length) return cfg.frameSeq;
            const n = uiFrames(slot); const a = [];
            for (let i = 0; i < n; i++) a.push(i);
            return a;
        }

        // Set a slot's background image + sizing on a DOM element. backgroundSize scales the whole
        // sheet so each frame == sizePx wide; backgroundPosition (set by stepUiSpriteAnim) picks one.
        function applySheetBackground(el, slot, sizePx) {
            el.style.background = 'transparent';
            el.style.border = 'none';
            el.style.padding = '0';
            el.style.width = el.style.minWidth = el.style.maxWidth = sizePx + 'px';
            el.style.height = sizePx + 'px';
            el.style.backgroundImage = 'url(' + uiConfigData[slot].spriteData + ')';
            el.style.backgroundRepeat = 'no-repeat';
            el.style.backgroundSize = (uiFrames(slot) * sizePx) + 'px ' + sizePx + 'px';
        }
        function stepUiSpriteAnim(elId, slot, sizePx) {
            const el = document.getElementById(elId);
            if (!el || !uiSkinReady(slot)) return;
            const seq = uiSeq(slot);                                   // uiAnimTimers[slot].frame = index INTO seq
            const actual = seq[uiAnimTimers[slot].frame % seq.length] || 0;
            el.style.backgroundPosition = '-' + (actual * sizePx) + 'px 0';
        }

        // Hover tracking (for trigger==='hover'); attach once per element.
        function attachUiHover(elId, slot) {
            const el = document.getElementById(elId);
            if (!el || el.dataset.uiHoverBound) return;
            el.dataset.uiHoverBound = '1';
            el.addEventListener('mouseenter', () => { uiHover[slot] = true; });
            el.addEventListener('mouseleave', () => { uiHover[slot] = false; });
        }

        // Apply both skins to their DOM elements (idempotent; safe to call repeatedly).
        // PORT-TODO(monogame): custom quest-log UI runtime — render uiConfig skins (animated sprite, %-layout, active/completed text zones, text style). docs/PORTING.md §B.
        function applyUiSkins() {
            const tracker = document.getElementById('questTracker');
            if (tracker && uiSkinReady('questLogButton')) {
                applySheetBackground(tracker, 'questLogButton', uiSize('questLogButton'));
                applyUiLayout(tracker, 'questLogButton');
                const t = document.getElementById('questTrackerTitle');
                const o = document.getElementById('questTrackerObjectives');
                if (t) t.style.display = 'none';
                if (o) o.style.display = 'none';
                attachUiHover('questTracker', 'questLogButton');
                stepUiSpriteAnim('questTracker', 'questLogButton', uiSize('questLogButton'));
            }
            const popup = document.getElementById('questLogPopup');
            if (popup && uiSkinReady('questLogPanel')) {
                const panelPx = uiSize('questLogPanel');
                applySheetBackground(popup, 'questLogPanel', panelPx);
                applyUiLayout(popup, 'questLogPanel');
                popup.style.maxHeight = 'none';
                popup.style.overflow = 'visible';
                // Position BOTH quest-text zones (active + completed) per the creator-defined rects
                // (frame-space -> px). Each scrolls independently inside its own box.
                const fw = (uiConfigData.questLogPanel && uiConfigData.questLogPanel.frameW) || 256;
                const sc = panelPx / fw;
                const pcfg = uiConfigData.questLogPanel || {};
                const placeZone = function (elId, box, defBox) {
                    const el = document.getElementById(elId); if (!el) return;
                    const b = box || defBox;
                    el.style.position = 'absolute';
                    el.style.left = Math.round(b.x * sc) + 'px';
                    el.style.top = Math.round(b.y * sc) + 'px';
                    el.style.width = Math.round(b.w * sc) + 'px';
                    el.style.height = Math.round(b.h * sc) + 'px';
                    el.style.overflowY = 'auto';
                };
                placeZone('questLogContent', pcfg.textBox, { x: 50, y: 40, w: 156, h: 80 });
                placeZone('questLogCompleted', pcfg.completedBox, { x: 50, y: 128, w: 156, h: 80 });
                // Trim the default header to just a close button in the top-right corner.
                const header = document.getElementById('questLogHeader');
                const title = document.getElementById('questLogTitle');
                if (title) title.style.display = 'none';
                if (header) {
                    header.style.position = 'absolute';
                    header.style.top = '6px'; header.style.right = '6px';
                    header.style.margin = '0'; header.style.border = 'none'; header.style.padding = '0';
                }
                attachUiHover('questLogPopup', 'questLogPanel');
                stepUiSpriteAnim('questLogPopup', 'questLogPanel', panelPx);
            }
        }

        // Should a skinned slot animate right now? (>1 selected frame + animated + trigger satisfied)
        function uiShouldAnimate(slot) {
            const cfg = uiConfigData[slot];
            if (!cfg || !cfg.animated || uiSeq(slot).length <= 1) return false;
            if (cfg.trigger === 'hover') return !!uiHover[slot];
            return true; // 'constant'
        }

        // Advance the UI skin loops each frame (button while tracker visible, panel while log open).
        function advanceUiAnims() {
            const tracker = document.getElementById('questTracker');
            if (uiSkinReady('questLogButton') && tracker && tracker.style.display !== 'none') {
                if (uiShouldAnimate('questLogButton')) {
                    stepUiAnimTimer('questLogButton');
                    stepUiSpriteAnim('questTracker', 'questLogButton', uiSize('questLogButton'));
                } else if (uiAnimTimers.questLogButton.frame !== 0) {
                    uiAnimTimers.questLogButton.frame = 0;
                    stepUiSpriteAnim('questTracker', 'questLogButton', uiSize('questLogButton'));
                }
            }
            if (uiSkinReady('questLogPanel') && questLogVisible) {
                if (uiShouldAnimate('questLogPanel')) {
                    stepUiAnimTimer('questLogPanel');
                    stepUiSpriteAnim('questLogPopup', 'questLogPanel', uiSize('questLogPanel'));
                } else if (uiAnimTimers.questLogPanel.frame !== 0) {
                    uiAnimTimers.questLogPanel.frame = 0;
                    stepUiSpriteAnim('questLogPopup', 'questLogPanel', uiSize('questLogPanel'));
                }
            }
        }
        function stepUiAnimTimer(slot) {
            const fps = (uiConfigData[slot] && uiConfigData[slot].fps) || 8;
            const t = uiAnimTimers[slot];
            t.timer++;
            if (t.timer >= Math.max(1, Math.round(60 / fps))) { t.timer = 0; t.frame = (t.frame + 1) % uiSeq(slot).length; }
        }

        function updateQuestTracker() {
            const tracker = document.getElementById('questTracker');
            const titleEl = document.getElementById('questTrackerTitle');
            const objectivesEl = document.getElementById('questTrackerObjectives');
            if (!tracker || !titleEl) return;

            const activeQuest = getActiveQuest();
            // A custom-skinned button is a persistent control to OPEN the log — keep it visible
            // even with no active quest. The default (unskinned) tracker still hides when idle.
            if (!activeQuest && !uiSkinReady('questLogButton')) {
                tracker.style.display = 'none';
                return;
            }

            tracker.style.display = 'block';
            titleEl.textContent = 'QUESTS';

            // Hide objectives - just show quest name
            if (objectivesEl) objectivesEl.innerHTML = '';

            // Apply custom button skin if assigned (hides the default text, shows the art).
            applyUiSkins();
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
                if (questLogVisible) {
                    applyUiSkins();   // apply panel skin + position content box before filling text
                    renderQuestLog();
                }
            }
        }

        // === SHARED: keep in sync with the builder copy in src/builder/130-ui-tab.js ===
        // Plain styled quest text (NO boxes — the panel art is the container). One zone (active or
        // completed). style = uiConfig.questLogPanel.textStyle: { font, size, color, titleColor }.
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

        function renderQuestLog() {
            if (!quests) return;
            const activeEl = document.getElementById('questLogContent');     // ACTIVE zone
            const completedEl = document.getElementById('questLogCompleted'); // COMPLETED zone
            const active = quests.filter(q => gameProgress.questStates[q.id]?.status === QUEST_STATUS.ACTIVE);
            const completed = quests.filter(q => gameProgress.questStates[q.id]?.status === QUEST_STATUS.COMPLETED);
            const style = (uiConfigData.questLogPanel && uiConfigData.questLogPanel.textStyle) || {};
            if (activeEl) activeEl.innerHTML = buildQuestTextHtml(active, false, style);
            if (completedEl) completedEl.innerHTML = buildQuestTextHtml(completed, true, style);
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
