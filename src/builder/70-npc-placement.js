        // ===== NPC PLACEMENT & PATH FUNCTIONS =====

        function placeNpcAt(x, y) {
            console.log('placeNpcAt called:', x, y, 'currentNpcIndex:', currentNpcIndex);
            if (currentNpcIndex < 0 || !npcs[currentNpcIndex]) {
                console.log('No NPC selected, cannot place');
                return;
            }

            // Check if there's already an NPC at this position
            const existing = placedNpcs.findIndex(p => p.x === x && p.y === y && p.mapName === currentMapName);
            if (existing >= 0) {
                // Select existing instead of placing new
                selectPlacedNpc(existing);
                return;
            }

            // Get current scale from placement slider (for new placement)
            const currentScale = parseFloat(document.getElementById('npcPlacementScale')?.value) || 1;

            const placed = {
                npcIndex: currentNpcIndex,
                mapName: currentMapName,
                x: x,
                y: y,
                path: [],
                trigger: 'loop',
                speed: 3,
                scale: currentScale,
                uid: 'npc_' + currentNpcIndex + '_' + Date.now() // Assign UID immediately for quest system
            };

            placedNpcs.push(placed);
            selectedPlacedNpcIndex = placedNpcs.length - 1;
            // Broadcast to co-op builders
            broadcastEdit({ editType: 'placeNpc', npc: placed, index: selectedPlacedNpcIndex });

            updatePlacedNpcList();
            showNpcPathPanel();
            renderMap();
        }

        function findPlacedNpcAt(x, y) {
            return placedNpcs.findIndex(p => p.x === x && p.y === y && p.mapName === currentMapName);
        }

        function selectPlacedNpc(index) {
            // Stop any running preview when selecting different NPC
            if (npcPathPreviewActive && index !== selectedPlacedNpcIndex) {
                stopNpcPathPreview();
            }

            selectedPlacedNpcIndex = index;
            npcPathDrawing = false;
            npcPathEditing = false;
            npcDraggingWaypoint = -1;
            updatePathDrawButton();

            const placed = placedNpcs[index];
            if (placed) {
                document.getElementById('npcTriggerType').value = placed.trigger || 'loop';
                document.getElementById('npcWalkSpeed').value = placed.speed || 3;
                document.getElementById('npcSpeedValue').textContent = placed.speed || 3;
                // Load animation speed (default to NPC's fps or 8)
                const npc = npcs[placed.npcIndex];
                const defaultFps = npc?.fps || 8;
                const animSpeed = placed.animSpeed || defaultFps;
                document.getElementById('npcAnimSpeed').value = animSpeed;
                document.getElementById('npcAnimSpeedValue').textContent = animSpeed + ' fps';
            }

            updatePlacedNpcList();
            showNpcPathPanel();
            renderMap();
        }

        function removeNpcAt(x, y) {
            const idx = findPlacedNpcAt(x, y);
            if (idx >= 0) {
                placedNpcs.splice(idx, 1);
                // Broadcast to co-op builders
                broadcastEdit({ editType: 'removeNpc', index: idx });
                if (selectedPlacedNpcIndex === idx) {
                    selectedPlacedNpcIndex = -1;
                    hideNpcPathPanel();
                } else if (selectedPlacedNpcIndex > idx) {
                    selectedPlacedNpcIndex--;
                }
                updatePlacedNpcList();
                renderMap();
            }
        }

        function deleteSelectedPlacedNpc() {
            if (selectedPlacedNpcIndex >= 0) {
                const idx = selectedPlacedNpcIndex;
                placedNpcs.splice(selectedPlacedNpcIndex, 1);
                // Broadcast to co-op builders
                broadcastEdit({ editType: 'removeNpc', index: idx });
                selectedPlacedNpcIndex = -1;
                npcPathDrawing = false;
                hideNpcPathPanel();
                updatePlacedNpcList();
                renderMap();
            }
        }

        function showNpcPathPanel() {
            const panel = document.getElementById('npcPathPanel');
            if (!panel) {
                console.error('npcPathPanel not found!');
                return;
            }
            panel.style.display = 'block';
            console.log('Path panel shown, selectedPlacedNpcIndex:', selectedPlacedNpcIndex);

            if (selectedPlacedNpcIndex >= 0) {
                const placed = placedNpcs[selectedPlacedNpcIndex];
                const npc = npcs[placed.npcIndex];
                document.getElementById('npcPathName').textContent = npc ? npc.name : 'NPC';
                updateNpcWaypointList();
                updatePathDrawButton();

                // Load enemy settings
                const isEnemy = placed.isEnemy || false;
                const attackMode = placed.attackMode || 'touch';
                document.getElementById('npcIsEnemy').checked = isEnemy;
                document.getElementById('npcEnemyOptions').style.display = isEnemy ? 'block' : 'none';
                document.getElementById('npcVisionRadius').value = placed.visionRadius || 5;
                document.getElementById('npcVisionValue').textContent = (placed.visionRadius || 5) + ' tiles';
                document.getElementById('npcChaseSpeed').value = placed.chaseSpeed || 4;
                document.getElementById('npcChaseSpeedValue').textContent = placed.chaseSpeed || 4;
                document.getElementById('npcAttackMode').value = attackMode;
                document.getElementById('npcDamage').value = placed.damage || 10;
                document.getElementById('npcDamageValue').textContent = placed.damage || 10;
                document.getElementById('npcAttackCooldown').value = placed.attackCooldown || 1;
                document.getElementById('npcCooldownValue').textContent = (placed.attackCooldown || 1).toFixed(1) + 's';
                document.getElementById('npcLungeOptions').style.display = attackMode === 'lunge' ? 'block' : 'none';
                document.getElementById('npcAttackRange').value = placed.attackRange || 2;
                document.getElementById('npcLungeRangeValue').textContent = (placed.attackRange || 2) + ' tiles';
                document.getElementById('npcLungeSpeed').value = placed.lungeSpeed || 8;
                document.getElementById('npcLungeSpeedValue').textContent = placed.lungeSpeed || 8;
                // Load slowdown settings
                document.getElementById('npcSlowdownPercent').value = placed.slowdownPercent !== undefined ? placed.slowdownPercent : 50;
                document.getElementById('npcSlowdownValue').textContent = (placed.slowdownPercent !== undefined ? placed.slowdownPercent : 50) + '%';
                document.getElementById('npcSlowdownDuration').value = placed.slowdownDuration !== undefined ? placed.slowdownDuration : 0.5;
                document.getElementById('npcSlowdownDurationValue').textContent = (placed.slowdownDuration !== undefined ? placed.slowdownDuration : 0.5).toFixed(2) + 's';

                // Load drop items
                renderNpcDropItems();

                // Load trigger and speed settings
                document.getElementById('npcTriggerType').value = placed.trigger || 'loop';
                document.getElementById('npcWalkSpeed').value = placed.speed || 3;
                document.getElementById('npcSpeedValue').textContent = placed.speed || 3;

                // Load scale setting
                document.getElementById('npcScale').value = placed.scale || 1;
                document.getElementById('npcScaleValue').textContent = (placed.scale || 1).toFixed(1) + 'x';

                // Load shop attachment
                updateNpcShopDropdown();
                const shopSelect = document.getElementById('npcShopSelect');
                if (shopSelect) {
                    shopSelect.value = placed.shopIndex !== undefined ? placed.shopIndex : -1;
                }
                updateNpcShopInfo(placed);

                // Show quest chain info for this NPC
                updateNpcQuestChainPanel(placed);
            }
        }

        function updateNpcQuestChainPanel(placed) {
            const panel = document.getElementById('npcQuestChainPanel');
            const list = document.getElementById('npcQuestChainList');
            if (!panel || !list) return;

            // Find all quests that reference this NPC
            const npcUid = placed.uid;
            if (!npcUid || !quests || quests.length === 0) {
                panel.style.display = 'none';
                return;
            }

            // Get quests where this NPC is the START NPC (these form the chain)
            const questsForNpc = [];
            quests.forEach((quest, index) => {
                if (quest.startNpcUid === npcUid) {
                    const roles = ['Start'];
                    if (quest.turnInNpcUid === npcUid) roles.push('Turn-in');
                    questsForNpc.push({
                        quest,
                        globalIndex: index,
                        roles: roles.join(' & ')
                    });
                } else if (quest.turnInNpcUid === npcUid) {
                    // Turn-in only (not part of this NPC's chain, just receives)
                    questsForNpc.push({
                        quest,
                        globalIndex: index,
                        roles: 'Turn-in only',
                        isTurnInOnly: true
                    });
                }
            });

            if (questsForNpc.length === 0) {
                panel.style.display = 'none';
                return;
            }

            panel.style.display = 'block';

            // Separate chain quests from turn-in only
            const chainQuests = questsForNpc.filter(q => !q.isTurnInOnly);
            const turnInOnlyQuests = questsForNpc.filter(q => q.isTurnInOnly);

            let html = '';

            // Show chain quests with per-NPC order numbers
            if (chainQuests.length > 0) {
                html += chainQuests.map((q, i) => {
                    const orderBadge = chainQuests.length > 1 ?
                        `<span style="background:#fa0; color:#000; padding:1px 5px; border-radius:3px; font-weight:bold; margin-right:5px;">${i + 1}</span>` : '';
                    return `<div style="margin-bottom:4px; padding:4px; background:#333; border-radius:3px;">
                        ${orderBadge}<span style="color:#fff;">${q.quest.name || q.quest.id}</span>
                    </div>`;
                }).join('');
            }

            // Show turn-in only quests separately
            if (turnInOnlyQuests.length > 0) {
                html += `<div style="font-size:9px; color:#888; margin-top:6px;">Turn-in for:</div>`;
                html += turnInOnlyQuests.map(q => {
                    return `<div style="margin-bottom:2px; padding:3px; background:#2a2a3a; border-radius:3px; font-size:10px;">
                        <span style="color:#aaa;">${q.quest.name || q.quest.id}</span>
                    </div>`;
                }).join('');
            }

            if (chainQuests.length > 1) {
                html += `<div style="font-size:9px; color:#fa0; margin-top:6px; font-style:italic;">
                    Chain order: #1 triggers first, then #2, etc.
                </div>`;
            }

            list.innerHTML = html;
        }

        function updateNpcEnemy() {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];

            const isEnemy = document.getElementById('npcIsEnemy').checked;
            const visionRadius = parseInt(document.getElementById('npcVisionRadius').value) || 5;
            const chaseSpeed = parseInt(document.getElementById('npcChaseSpeed').value) || 4;
            const attackMode = document.getElementById('npcAttackMode').value || 'touch';
            const damage = parseInt(document.getElementById('npcDamage').value) || 10;
            const attackCooldown = parseFloat(document.getElementById('npcAttackCooldown').value) || 1;
            const attackRange = parseInt(document.getElementById('npcAttackRange').value) || 2;
            const lungeSpeed = parseInt(document.getElementById('npcLungeSpeed').value) || 8;
            const slowdownPercent = parseInt(document.getElementById('npcSlowdownPercent').value);
            const slowdownDuration = parseFloat(document.getElementById('npcSlowdownDuration').value);

            // Update UI labels
            document.getElementById('npcEnemyOptions').style.display = isEnemy ? 'block' : 'none';
            document.getElementById('npcVisionValue').textContent = visionRadius + ' tiles';
            document.getElementById('npcChaseSpeedValue').textContent = chaseSpeed;
            document.getElementById('npcDamageValue').textContent = damage;
            document.getElementById('npcCooldownValue').textContent = attackCooldown.toFixed(1) + 's';
            document.getElementById('npcLungeOptions').style.display = attackMode === 'lunge' ? 'block' : 'none';
            document.getElementById('npcLungeRangeValue').textContent = attackRange + ' tiles';
            document.getElementById('npcLungeSpeedValue').textContent = lungeSpeed;
            document.getElementById('npcSlowdownValue').textContent = slowdownPercent + '%';
            document.getElementById('npcSlowdownDurationValue').textContent = slowdownDuration.toFixed(2) + 's';

            // Update placed NPC data
            placed.isEnemy = isEnemy;
            placed.visionRadius = visionRadius;
            placed.chaseSpeed = chaseSpeed;
            placed.attackMode = attackMode;
            placed.damage = damage;
            placed.attackCooldown = attackCooldown;
            placed.attackRange = attackRange;
            placed.lungeSpeed = lungeSpeed;
            placed.slowdownPercent = slowdownPercent;
            placed.slowdownDuration = slowdownDuration;

            // Broadcast to live sync
            broadcastEdit({
                editType: 'updatePlacedNpc',
                index: selectedPlacedNpcIndex,
                npc: placed
            });

            renderMap();
        }

        function updateNpcScale() {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];

            const scale = parseFloat(document.getElementById('npcScale').value) || 1;
            document.getElementById('npcScaleValue').textContent = scale.toFixed(1) + 'x';

            placed.scale = scale;

            // Broadcast to live sync
            broadcastEdit({
                editType: 'updatePlacedNpc',
                index: selectedPlacedNpcIndex,
                npc: placed
            });

            renderMap();
        }

        // Update placement scale display (before placing)
        function updateNpcPlacementScaleDisplay() {
            const scale = parseFloat(document.getElementById('npcPlacementScale').value) || 1;
            document.getElementById('npcPlacementScaleValue').textContent = scale.toFixed(1) + 'x';
        }

        // === NPC DROP ITEMS SYSTEM ===
        function renderNpcDropItems() {
            const container = document.getElementById('npcDropItemsList');
            if (!container) return;

            if (selectedPlacedNpcIndex < 0) {
                container.innerHTML = '<span style="color:#666; font-size:9px;">No NPC selected</span>';
                return;
            }

            const placed = placedNpcs[selectedPlacedNpcIndex];
            const dropItems = placed.dropItems || [];

            if (dropItems.length === 0) {
                container.innerHTML = '<span style="color:#666; font-size:9px;">No drops configured</span>';
                return;
            }

            container.innerHTML = dropItems.map((drop, i) => {
                const item = items[drop.itemIndex];
                const itemName = item ? item.name : 'Unknown';
                const qty = drop.quantity || 1;
                return `<div style="display:inline-flex; align-items:center; background:#3a2a3a; padding:2px 6px; margin:2px; border-radius:3px; font-size:9px;">
                    <span style="color:#a8a;">Give: ${itemName}${qty > 1 ? ' x' + qty : ''}</span>
                    <button onclick="removeNpcDropItem(${i})" style="margin-left:5px; background:#a55; border:none; color:#fff; padding:1px 4px; cursor:pointer; font-size:8px;">×</button>
                </div>`;
            }).join('');
        }

        function addNpcDropItem() {
            if (selectedPlacedNpcIndex < 0) return;
            if (items.length === 0) {
                alert('No items defined. Create items first in the Items tab.');
                return;
            }

            // Create item selection popup
            const popup = document.createElement('div');
            popup.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#222; border:2px solid #a4a; padding:15px; z-index:10000; border-radius:8px; max-height:80vh; overflow:auto;';
            popup.innerHTML = `
                <div style="color:#a8a; margin-bottom:10px; font-weight:bold;">Select Drop Item:</div>
                <div style="display:flex; align-items:center; margin-bottom:10px;">
                    <label style="color:#888; font-size:10px; margin-right:5px;">Quantity:</label>
                    <input type="number" id="dropItemQuantity" value="1" min="1" max="99" style="width:50px; background:#333; color:#fff; border:1px solid #555; padding:3px;">
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:5px; max-width:300px;">
                    ${items.map((item, i) => `
                        <div onclick="selectNpcDropItem(${i})" style="background:#333; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:10px; color:#fff; border:1px solid #555;">
                            ${item.name}
                        </div>
                    `).join('')}
                </div>
                <button onclick="this.parentElement.remove()" style="margin-top:10px; background:#555; color:#fff; border:none; padding:5px 15px; cursor:pointer;">Cancel</button>
            `;
            document.body.appendChild(popup);
            window.currentDropItemPopup = popup;
        }

        function selectNpcDropItem(itemIndex) {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];

            if (!placed.dropItems) placed.dropItems = [];

            const quantityInput = document.getElementById('dropItemQuantity');
            const quantity = parseInt(quantityInput?.value) || 1;

            placed.dropItems.push({ itemIndex: itemIndex, quantity: quantity });
            renderNpcDropItems();

            // Broadcast to live sync
            broadcastEdit({
                editType: 'updatePlacedNpc',
                index: selectedPlacedNpcIndex,
                npc: placed
            });

            // Close popup
            if (window.currentDropItemPopup) {
                window.currentDropItemPopup.remove();
                window.currentDropItemPopup = null;
            }
        }

        function removeNpcDropItem(index) {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];

            if (placed.dropItems && index >= 0 && index < placed.dropItems.length) {
                placed.dropItems.splice(index, 1);
                renderNpcDropItems();

                // Broadcast to live sync
                broadcastEdit({
                    editType: 'updatePlacedNpc',
                    index: selectedPlacedNpcIndex,
                    npc: placed
                });
            }
        }

        function hideNpcPathPanel() {
            document.getElementById('npcPathPanel').style.display = 'none';
            npcPathDrawing = false;
            updatePathDrawButton();
        }

        // Toggle NPC settings collapsible panel
        let npcSettingsExpanded = false;
        function toggleNpcSettingsPanel() {
            npcSettingsExpanded = !npcSettingsExpanded;
            const content = document.getElementById('npcSettingsContent');
            const toggle = document.getElementById('npcSettingsToggle');
            if (npcSettingsExpanded) {
                content.style.display = 'block';
                toggle.textContent = '-';
            } else {
                content.style.display = 'none';
                toggle.textContent = '+';
            }
        }

        function toggleNpcPathDrawing() {
            npcPathDrawing = !npcPathDrawing;
            if (npcPathDrawing) {
                npcPathEditing = false; // Disable edit mode when drawing
            }
            updatePathDrawButton();
        }

        function updatePathDrawButton() {
            const drawBtn = document.getElementById('npcDrawPathBtn');
            const editBtn = document.getElementById('npcEditPathBtn');
            const info = document.getElementById('npcPathInfo');

            if (npcPathDrawing) {
                drawBtn.textContent = 'Stop Drawing';
                drawBtn.style.background = '#a55';
                editBtn.style.background = '#47a';
                info.textContent = 'Click tiles to add waypoints. Right-click to undo.';
                info.style.color = '#4f4';
            } else if (npcPathEditing) {
                drawBtn.textContent = 'Draw Path';
                drawBtn.style.background = '#4a4';
                editBtn.textContent = 'Stop Editing';
                editBtn.style.background = '#a55';
                info.textContent = 'Drag waypoint markers to move them. Right-click to delete.';
                info.style.color = '#fa4';
            } else {
                drawBtn.textContent = 'Draw Path';
                drawBtn.style.background = '#4a4';
                editBtn.textContent = 'Edit Path';
                editBtn.style.background = '#47a';
                info.textContent = 'Click tiles to add waypoints';
                info.style.color = '#666';
            }
        }

        function toggleNpcPathEditing() {
            npcPathEditing = !npcPathEditing;
            if (npcPathEditing) {
                npcPathDrawing = false; // Disable draw mode when editing
            }
            npcDraggingWaypoint = -1;
            updatePathDrawButton();
        }

        // Find the nearest waypoint to a given position (within 1 tile distance)
        function findNearestWaypoint(x, y, path) {
            if (!path || path.length === 0) return -1;

            let nearest = -1;
            let minDist = 2; // Max distance of 2 tiles to select

            for (let i = 0; i < path.length; i++) {
                const wp = path[i];
                const dist = Math.abs(wp.x - x) + Math.abs(wp.y - y); // Manhattan distance
                if (dist < minDist) {
                    minDist = dist;
                    nearest = i;
                }
            }

            return nearest;
        }

        function addNpcWaypoint(x, y) {
            if (selectedPlacedNpcIndex < 0) return;

            const placed = placedNpcs[selectedPlacedNpcIndex];
            if (!placed.path) placed.path = [];

            // Don't add duplicate consecutive waypoints
            const last = placed.path[placed.path.length - 1];
            if (last && last.x === x && last.y === y) return;

            placed.path.push({ x, y });
            updateNpcWaypointList();
            renderMap();
            broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
        }

        function removeLastNpcWaypoint() {
            if (selectedPlacedNpcIndex < 0) return;

            const placed = placedNpcs[selectedPlacedNpcIndex];
            if (placed.path && placed.path.length > 0) {
                placed.path.pop();
                updateNpcWaypointList();
                renderMap();
                broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
            }
        }

        function clearNpcPath() {
            if (selectedPlacedNpcIndex < 0) return;

            const placed = placedNpcs[selectedPlacedNpcIndex];
            placed.path = [];
            updateNpcWaypointList();
            renderMap();
            broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
        }

        function updateNpcTrigger() {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            placed.trigger = document.getElementById('npcTriggerType').value;
            broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
        }

        function updateNpcSpeed() {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            const speed = parseFloat(document.getElementById('npcWalkSpeed').value);
            placed.speed = speed;
            document.getElementById('npcSpeedValue').textContent = speed;
            broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
        }

        function updateNpcAnimSpeed() {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            const fps = parseInt(document.getElementById('npcAnimSpeed').value);
            placed.animSpeed = fps;
            document.getElementById('npcAnimSpeedValue').textContent = fps + ' fps';
            broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
        }

        function updateNpcWaypointList() {
            const container = document.getElementById('npcWaypointList');
            if (selectedPlacedNpcIndex < 0) {
                container.innerHTML = 'No NPC selected';
                return;
            }

            const placed = placedNpcs[selectedPlacedNpcIndex];
            const path = placed.path || [];

            if (path.length === 0) {
                container.innerHTML = 'No waypoints - click Draw Path then click map';
                return;
            }

            // Get available animations for this NPC
            const npc = npcs[placed.npcIndex];
            const customAnims = [];
            if (npc && npc.animations) {
                Object.keys(npc.animations).forEach(key => {
                    if (!['walkDown', 'walkUp', 'walkLeft', 'walkRight', 'idle', 'attackDown', 'attackUp', 'attackLeft', 'attackRight'].includes(key)) {
                        customAnims.push(key);
                    }
                });
            }

            // Show list of waypoints with clear action controls
            let html = '<strong>Waypoints:</strong><div style="margin-top:8px;">';
            path.forEach((wp, i) => {
                const duration = wp.idleTime || 0;
                const action = wp.animation || 'walk';
                const hasStop = duration > 0;

                html += `<div style="background:#1a1a2e; border-radius:4px; padding:6px; margin-bottom:6px; border-left:3px solid ${wp.triggerProp ? '#fa0' : (hasStop ? '#4af' : '#444')};">`;

                // Header row: waypoint number and position
                html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">`;
                html += `<span style="font-weight:bold; color:#4af;">#${i + 1}</span>`;
                html += `<span style="color:#666; font-size:10px;">(${wp.x}, ${wp.y})</span>`;
                html += `</div>`;

                // Action row: what to do at this waypoint
                html += `<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">`;

                // Action dropdown
                html += `<select id="wpAction${i}" style="font-size:11px; padding:3px; background:#333; border:1px solid #555; color:#fff; border-radius:3px;" onchange="setWaypointAction(${i}, this.value)">`;
                html += `<option value="walk"${action === 'walk' ? ' selected' : ''}>Walk through</option>`;
                html += `<option value="idle"${action === 'idle' ? ' selected' : ''}>Stop & Idle</option>`;
                customAnims.forEach(anim => {
                    html += `<option value="${anim}"${action === anim ? ' selected' : ''}>Stop & ${anim}</option>`;
                });
                html += `</select>`;

                // Duration (only show if not walking through)
                if (action !== 'walk') {
                    html += `<span style="color:#888; font-size:10px;">for</span>`;
                    html += `<input type="number" min="1" max="60" value="${duration || 2}" style="width:40px; padding:3px; font-size:11px; background:#333; border:1px solid #555; color:#fff; border-radius:3px; text-align:center;" onchange="setWaypointDuration(${i}, this.value)">`;
                    html += `<span style="color:#888; font-size:10px;">sec</span>`;
                }

                html += `</div>`;

                // Trigger-prop control (only meaningful on stop waypoints)
                if (action !== 'walk') {
                    html += `<div style="margin-top:6px; padding-top:6px; border-top:1px solid #333;">`;
                    if (wp.triggerProp) {
                        const tc = layers[wp.triggerProp.layer] && layers[wp.triggerProp.layer][wp.triggerProp.y] && layers[wp.triggerProp.layer][wp.triggerProp.y][wp.triggerProp.x];
                        const pd = tc && animatedProps[tc.propIndex];
                        const pname = pd ? pd.name : 'prop (missing)';
                        html += `<span style="color:#fa0; font-size:10px;">⚙ Triggers: ${pname}</span> `;
                        html += `<button onclick="clearWaypointProp(${i})" style="font-size:10px; padding:1px 5px; background:#633; border:1px solid #855; color:#fff; border-radius:3px; cursor:pointer;">✕</button>`;
                    } else {
                        const arming = npcWaypointPropTarget === i;
                        html += `<button onclick="startWaypointPropTarget(${i})" style="font-size:10px; padding:2px 6px; background:${arming ? '#a70' : '#444'}; border:1px solid #666; color:#fff; border-radius:3px; cursor:pointer;">🎯 ${arming ? 'Click prop on map…' : 'Trigger a prop'}</button>`;
                    }
                    html += `</div>`;
                }

                html += `</div>`;
            });
            html += '</div>';
            container.innerHTML = html;
        }

        // ===== NPC waypoint -> interactive prop linking =====
        function startWaypointPropTarget(index) {
            if (selectedPlacedNpcIndex < 0) return;
            npcWaypointPropTarget = index;
            // Make sure we're not in draw/edit path mode (they share the map click)
            npcPathDrawing = false;
            npcPathEditing = false;
            updateNpcWaypointList();
            const info = document.getElementById('npcPathInfo');
            if (info) { info.textContent = 'Click an INTERACTIVE animated prop on the map to link it to this waypoint.'; info.style.color = '#fa0'; }
        }

        function clearWaypointProp(index) {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            if (placed.path && placed.path[index]) {
                delete placed.path[index].triggerProp;
                npcWaypointPropTarget = -1;
                updateNpcWaypointList();
                broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
            }
        }

        // Called by the map-click handler when a prop-link is armed. Returns true if it consumed the click.
        function tryLinkWaypointProp(x, y) {
            if (npcWaypointPropTarget < 0 || selectedPlacedNpcIndex < 0) return false;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            const wp = placed.path && placed.path[npcWaypointPropTarget];
            if (!wp) { npcWaypointPropTarget = -1; return true; }
            const hit = findAnimPropAt(x, y);
            const def = hit && hit.cell ? animatedProps[hit.cell.propIndex] : null;
            const info = document.getElementById('npcPathInfo');
            if (!def || def.type !== 'interactive') {
                if (info) { info.textContent = 'That tile is not an interactive prop. Click an interactive animated prop.'; info.style.color = '#f66'; }
                return true; // stay armed
            }
            wp.triggerProp = { x: hit.x, y: hit.y, layer: hit.layer };
            npcWaypointPropTarget = -1;
            if (info) { info.textContent = 'Linked! NPC will trigger "' + def.name + '" at this waypoint.'; info.style.color = '#4f4'; }
            updateNpcWaypointList();
            broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
            renderMap();
            return true;
        }

        function setWaypointAction(index, action) {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            if (placed.path && placed.path[index]) {
                placed.path[index].animation = action;
                // If switching from walk to an action, set default duration
                if (action !== 'walk' && !placed.path[index].idleTime) {
                    placed.path[index].idleTime = 2; // Default 2 seconds
                }
                // If switching to walk, clear duration
                if (action === 'walk') {
                    placed.path[index].idleTime = 0;
                }
                updateNpcWaypointList(); // Refresh to show/hide duration
                broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
            }
        }

        function setWaypointDuration(index, value) {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            if (placed.path && placed.path[index]) {
                placed.path[index].idleTime = Math.max(1, parseFloat(value) || 2);
                broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
            }
        }

        function setWaypointIdle(index, value) {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            if (placed.path && placed.path[index]) {
                placed.path[index].idleTime = parseFloat(value) || 0;
                broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
            }
        }

        function setWaypointAnim(index, value) {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            if (placed.path && placed.path[index]) {
                placed.path[index].animation = value || '';
                broadcastEdit({ editType: 'updatePlacedNpc', index: selectedPlacedNpcIndex, npc: placed });
            }
        }

        function updatePlacedNpcList() {
            const container = document.getElementById('placedNpcList');
            const currentMapNpcs = placedNpcs.filter(p => p.mapName === currentMapName);

            if (currentMapNpcs.length === 0) {
                container.innerHTML = 'No NPCs placed on this map';
                return;
            }

            container.innerHTML = '';
            currentMapNpcs.forEach((placed, localIdx) => {
                const globalIdx = placedNpcs.indexOf(placed);
                const npc = npcs[placed.npcIndex];
                const div = document.createElement('div');
                div.style.cssText = 'padding:4px; margin-bottom:3px; background:' +
                    (globalIdx === selectedPlacedNpcIndex ? '#2a5a8a' : '#333') +
                    '; border-radius:3px; cursor:pointer;';
                div.innerHTML = `<strong>${npc ? npc.name : 'Unknown'}</strong> at (${placed.x},${placed.y})` +
                    `<br><span style="font-size:9px; color:#888;">${placed.trigger} | ${placed.path?.length || 0} waypoints</span>`;
                div.onclick = () => selectPlacedNpc(globalIdx);
                container.appendChild(div);
            });
        }

        // ===== NPC PATH PREVIEW =====
        function toggleNpcPathPreview() {
            if (npcPathPreviewActive) {
                stopNpcPathPreview();
            } else {
                startNpcPathPreview();
            }
        }

        function startNpcPathPreview() {
            if (selectedPlacedNpcIndex < 0) return;

            const placed = placedNpcs[selectedPlacedNpcIndex];
            if (!placed.path || placed.path.length === 0) {
                alert('No path to preview. Draw a path first.');
                return;
            }

            npcPathPreviewActive = true;
            npcPreviewState = {
                x: placed.x,
                y: placed.y,
                waypointIndex: 0,
                direction: 'down',
                frame: 0,
                frameTimer: 0,
                idleUntil: 0,  // Timestamp when idle ends
                waypointAnimation: ''  // Current animation at waypoint
            };

            // Update button
            const btn = document.getElementById('npcPreviewPathBtn');
            btn.textContent = 'Edit';
            btn.style.background = '#a55';

            // Start animation loop
            npcPreviewAnimId = requestAnimationFrame(npcPathPreviewLoop);
        }

        function stopNpcPathPreview() {
            npcPathPreviewActive = false;
            if (npcPreviewAnimId) {
                cancelAnimationFrame(npcPreviewAnimId);
                npcPreviewAnimId = null;
            }
            npcPreviewState = null;

            // Update button
            const btn = document.getElementById('npcPreviewPathBtn');
            if (btn) {
                btn.textContent = '▶ Preview';
                btn.style.background = '#47a';
            }

            renderMap();
        }

        let lastPreviewTime = 0;
        function npcPathPreviewLoop(timestamp) {
            if (!npcPathPreviewActive || selectedPlacedNpcIndex < 0) {
                stopNpcPathPreview();
                return;
            }

            const deltaTime = timestamp - lastPreviewTime;
            lastPreviewTime = timestamp;

            const placed = placedNpcs[selectedPlacedNpcIndex];
            const path = placed.path || [];
            const speed = (placed.speed || 3) * 0.05; // Slower for editor preview

            if (path.length === 0) {
                stopNpcPathPreview();
                return;
            }

            // Check if currently idling at a waypoint
            if (npcPreviewState.idleUntil > 0) {
                if (timestamp < npcPreviewState.idleUntil) {
                    // Still idling - just animate, don't move
                    npcPreviewState.frameTimer++;
                    const npc = npcs[placed.npcIndex];
                    const fps = placed.animSpeed || npc?.fps || 8;
                    const animDelay = Math.max(1, Math.round(60 / fps));
                    if (npcPreviewState.frameTimer >= animDelay) {
                        npcPreviewState.frameTimer = 0;
                        npcPreviewState.frame = npcPreviewState.frame + 1; // uncapped; draw uses % anim.length
                    }
                    renderMap();
                    npcPreviewAnimId = requestAnimationFrame(npcPathPreviewLoop);
                    return;
                } else {
                    // Idle complete - advance to next waypoint
                    npcPreviewState.idleUntil = 0;
                    npcPreviewState.waypointAnimation = '';
                    npcPreviewState.waypointIndex++;

                    // Check if path complete
                    if (npcPreviewState.waypointIndex >= path.length) {
                        npcPreviewState.waypointIndex = 0;
                        npcPreviewState.x = placed.x;
                        npcPreviewState.y = placed.y;
                    }
                    renderMap();
                    npcPreviewAnimId = requestAnimationFrame(npcPathPreviewLoop);
                    return;
                }
            }

            // Get target waypoint
            const waypoint = path[npcPreviewState.waypointIndex];
            if (!waypoint) {
                // Loop back to start
                npcPreviewState.waypointIndex = 0;
                npcPreviewState.x = placed.x;
                npcPreviewState.y = placed.y;
                npcPreviewAnimId = requestAnimationFrame(npcPathPreviewLoop);
                return;
            }

            // Move towards waypoint
            const dx = waypoint.x - npcPreviewState.x;
            const dy = waypoint.y - npcPreviewState.y;
            const dist = Math.hypot(dx, dy);

            if (dist < speed) {
                // Reached waypoint
                npcPreviewState.x = waypoint.x;
                npcPreviewState.y = waypoint.y;

                // Check for waypoint action (idle time, animation)
                let idleTime = waypoint.idleTime || 0;
                const wpAnim = waypoint.animation || '';

                // If animation is set but not "walk", ensure minimum idle time
                if (wpAnim && wpAnim !== 'walk' && wpAnim !== '' && idleTime <= 0) {
                    idleTime = 2;
                }

                if (idleTime > 0) {
                    // Start idling at this waypoint
                    npcPreviewState.idleUntil = timestamp + (idleTime * 1000);
                    npcPreviewState.waypointAnimation = wpAnim;
                    // Don't advance waypoint yet
                } else {
                    // No idle - advance immediately
                    npcPreviewState.waypointIndex++;
                    if (npcPreviewState.waypointIndex >= path.length) {
                        npcPreviewState.waypointIndex = 0;
                        npcPreviewState.x = placed.x;
                        npcPreviewState.y = placed.y;
                    }
                }
            } else {
                // Move
                npcPreviewState.x += (dx / dist) * speed;
                npcPreviewState.y += (dy / dist) * speed;

                // Set direction
                if (Math.abs(dx) > Math.abs(dy)) {
                    npcPreviewState.direction = dx > 0 ? 'right' : 'left';
                } else {
                    npcPreviewState.direction = dy > 0 ? 'down' : 'up';
                }
            }

            // Update animation frame
            npcPreviewState.frameTimer++;
            const npc = npcs[placed.npcIndex];
            const fps = placed.animSpeed || npc?.fps || 8;
            const animDelay = Math.max(1, Math.round(60 / fps));
            if (npcPreviewState.frameTimer >= animDelay) {
                npcPreviewState.frameTimer = 0;
                npcPreviewState.frame = npcPreviewState.frame + 1; // uncapped; draw uses % anim.length
            }

            // Render
            renderMap();

            // Continue loop
            npcPreviewAnimId = requestAnimationFrame(npcPathPreviewLoop);
        }
