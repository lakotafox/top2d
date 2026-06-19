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
