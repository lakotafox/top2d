        // ===== QUEST SYSTEM FUNCTIONS =====

        function generateQuestId() {
            return 'quest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }

        function addNewQuest() {
            const newQuest = {
                id: generateQuestId(),
                name: 'New Quest ' + (quests.length + 1),
                description: '',
                conditions: [],
                onComplete: {
                    giveItems: [],
                    removeItems: []
                },
                startNpcUid: '',
                turnInNpcUid: '',
                startDialogId: '',    // Dialog shown when offering quest
                activeDialogId: '',   // Dialog shown while quest is active (reminder)
                completeDialogId: '', // Dialog shown when turning in quest
                prerequisites: [],
                autoStart: false,
                isRepeatable: false
            };
            quests.push(newQuest);
            broadcastEdit({ editType: 'addQuest', quest: newQuest });
            renderQuestList();
            selectQuest(quests.length - 1);
        }

        function selectQuest(index) {
            selectedQuestIndex = index;
            renderQuestList();

            const panel = document.getElementById('questEditorPanel');
            if (index < 0 || index >= quests.length) {
                panel.style.display = 'none';
                return;
            }

            panel.style.display = 'block';
            loadQuestIntoEditor(index);
        }

        function loadQuestIntoEditor(index) {
            const quest = quests[index];
            if (!quest) return;

            // The "Add Condition" type dropdown is a global control for what to add NEXT — it isn't
            // tied to the quest. Reset it on every quest switch so a stale value (e.g. "Kill") doesn't
            // look like it's this quest's condition.
            const condTypeSel = document.getElementById('conditionType');
            if (condTypeSel) condTypeSel.selectedIndex = 0;

            document.getElementById('questName').value = quest.name || '';
            document.getElementById('questDescription').value = quest.description || '';
            document.getElementById('questAutoStart').checked = quest.autoStart || false;
            document.getElementById('questRepeatable').checked = quest.isRepeatable || false;

            // Load quest start sound from library
            updateQuestSoundDropdown();

            // Update NPC display names
            updateQuestNpcDisplayNames();

            // Update dialog dropdowns
            updateQuestDialogDropdowns();

            // Update prerequisites
            updateQuestPrereqDropdown();
            renderQuestPrerequisites();

            renderQuestConditions();
            renderQuestRewards();
        }

        // Populate quest dialog dropdowns with available dialogs
        function updateQuestDialogDropdowns() {
            const startSelect = document.getElementById('questStartDialog');
            const activeSelect = document.getElementById('questActiveDialog');
            const completeSelect = document.getElementById('questCompleteDialog');
            const declineSelect = document.getElementById('questDeclineDialog');
            if (!startSelect || !activeSelect || !completeSelect) return;

            // Build dialog options
            let options = '<option value="">(None - skip)</option>';
            dialogs.forEach((d, i) => {
                const name = d.name || 'Dialog ' + (i + 1);
                options += '<option value="' + i + '">' + name + '</option>';
            });

            startSelect.innerHTML = options;
            activeSelect.innerHTML = options;
            completeSelect.innerHTML = options;
            if (declineSelect) declineSelect.innerHTML = options;

            // Set selected values from current quest
            const quest = quests[selectedQuestIndex];
            if (quest) {
                if (quest.startDialogId !== undefined && quest.startDialogId !== '') {
                    startSelect.value = quest.startDialogId;
                }
                if (quest.activeDialogId !== undefined && quest.activeDialogId !== '') {
                    activeSelect.value = quest.activeDialogId;
                }
                if (quest.completeDialogId !== undefined && quest.completeDialogId !== '') {
                    completeSelect.value = quest.completeDialogId;
                }
                if (declineSelect && quest.declineDialogId !== undefined && quest.declineDialogId !== '') {
                    declineSelect.value = quest.declineDialogId;
                }
            }
        }

        // Edit existing dialog from quest tab
        function editQuestDialog(type) {
            const selectMap = {
                'start': 'questStartDialog',
                'active': 'questActiveDialog',
                'complete': 'questCompleteDialog',
                'decline': 'questDeclineDialog'
            };
            const select = document.getElementById(selectMap[type]);
            if (!select) return;

            const dialogIndex = parseInt(select.value);
            if (isNaN(dialogIndex) || dialogIndex < 0 || dialogIndex >= dialogs.length) {
                alert('No dialog selected. Use + to create one first.');
                return;
            }

            // Open the dialog editor with the selected dialog
            openDialogEditor(dialogIndex);
        }

        // Open dialog creator/picker for quest dialog
        let questDialogPickerType = null; // 'start', 'active', or 'complete'

        function openDialogPickerForQuest(type) {
            questDialogPickerType = type;
            // Open the dialog editor with a new dialog
            openDialogEditor(-1);
            // Show hint to user
            const typeLabels = { start: 'Offer Quest', active: 'While Active', complete: 'Turn In', decline: 'If Declined' };
            setTimeout(() => {
                const nameInput = document.getElementById('dialogName');
                if (nameInput) {
                    const quest = quests[selectedQuestIndex];
                    const questName = quest?.name || 'Quest';
                    nameInput.value = questName + ' - ' + typeLabels[type];
                }
            }, 100);
        }

        // Hook into dialog save to auto-attach to quest
        function attachNewDialogToQuest(dialogIndex) {
            if (questDialogPickerType && selectedQuestIndex >= 0) {
                const fieldMap = {
                    'start': 'startDialogId',
                    'active': 'activeDialogId',
                    'complete': 'completeDialogId',
                    'decline': 'declineDialogId'
                };
                const field = fieldMap[questDialogPickerType];
                if (field) {
                    updateQuestField(field, dialogIndex.toString());
                    updateQuestDialogDropdowns();
                }
                questDialogPickerType = null;
            }
        }

        function updateQuestField(field, value) {
            if (selectedQuestIndex < 0 || selectedQuestIndex >= quests.length) return;
            const quest = quests[selectedQuestIndex];
            quest[field] = value;
            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
            if (field === 'name') renderQuestList();
        }

        // Quest start sound library functions
        let questSoundPreviewAudio = null;

        function updateQuestSoundDropdown() {
            const select = document.getElementById('questStartSound');
            if (!select) return;

            // Build options from questSounds library
            let options = '<option value="-1">None</option>';
            questSounds.forEach((sound, i) => {
                options += '<option value="' + i + '">' + sound.name + '</option>';
            });
            select.innerHTML = options;

            // Set current quest's sound index
            const quest = quests[selectedQuestIndex];
            if (quest && quest.startSoundIndex !== undefined && quest.startSoundIndex >= 0) {
                select.value = quest.startSoundIndex;
            }

            // Update count label
            const countEl = document.getElementById('questSoundCount');
            if (countEl) {
                countEl.textContent = questSounds.length + ' sound(s) in library';
            }
        }

        function previewQuestStartSound() {
            const select = document.getElementById('questStartSound');
            const index = parseInt(select?.value);
            if (index < 0 || index >= questSounds.length) return;

            // Stop any playing preview
            if (questSoundPreviewAudio) {
                questSoundPreviewAudio.pause();
                questSoundPreviewAudio = null;
            }

            const sound = questSounds[index];
            if (sound && sound.data) {
                questSoundPreviewAudio = new Audio(sound.data);
                questSoundPreviewAudio.volume = 0.7;
                questSoundPreviewAudio.play().catch(e => console.log('Preview failed:', e));
            }
        }

        function uploadQuestSound() {
            document.getElementById('questSoundUpload').click();
        }

        function handleQuestSoundUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                const name = file.name.replace(/\.[^/.]+$/, ''); // Remove extension

                // Add to library
                questSounds.push({ name: name, data: dataUrl });
                const newIndex = questSounds.length - 1;

                // Broadcast to other builders
                broadcastEdit({ editType: 'addQuestSound', sound: { name: name, data: dataUrl } });

                // Update dropdown and select new sound
                updateQuestSoundDropdown();
                document.getElementById('questStartSound').value = newIndex;
                updateQuestField('startSoundIndex', newIndex);

                console.log('[QUEST SOUND] Added:', name);
            };
            reader.readAsDataURL(file);

            // Reset file input
            event.target.value = '';
        }

        function deleteQuestSound() {
            const select = document.getElementById('questStartSound');
            const index = parseInt(select?.value);
            if (index < 0 || index >= questSounds.length) return;

            const soundName = questSounds[index].name;
            if (!confirm('Delete sound "' + soundName + '" from library?')) return;

            // Remove from library
            questSounds.splice(index, 1);

            // Broadcast deletion
            broadcastEdit({ editType: 'deleteQuestSound', index: index });

            // Update all quests that used this or higher indices
            quests.forEach(quest => {
                if (quest.startSoundIndex === index) {
                    quest.startSoundIndex = -1;
                } else if (quest.startSoundIndex > index) {
                    quest.startSoundIndex--;
                }
            });

            // Update UI
            updateQuestSoundDropdown();
            console.log('[QUEST SOUND] Deleted:', soundName);
        }

        function deleteCurrentQuest() {
            if (selectedQuestIndex < 0 || selectedQuestIndex >= quests.length) return;
            if (!confirm('Delete quest "' + quests[selectedQuestIndex].name + '"?')) return;

            const questId = quests[selectedQuestIndex].id;
            quests.splice(selectedQuestIndex, 1);
            broadcastEdit({ editType: 'deleteQuest', questId: questId });
            selectedQuestIndex = -1;
            renderQuestList();
            document.getElementById('questEditorPanel').style.display = 'none';
        }

        // Quest prerequisites - require specific quests to be completed
        function updateQuestPrereqDropdown() {
            const select = document.getElementById('questPrereqSelect');
            if (!select) return;

            const currentQuest = quests[selectedQuestIndex];
            if (!currentQuest) return;

            // Show all other quests except current one and already added prereqs
            const prereqs = currentQuest.prerequisites || [];
            let options = '<option value="">Select quest...</option>';
            quests.forEach((q, i) => {
                if (i === selectedQuestIndex) return; // Can't require itself
                if (prereqs.includes(q.id)) return; // Already a prereq
                options += '<option value="' + q.id + '">' + (q.name || 'Quest ' + (i + 1)) + '</option>';
            });
            select.innerHTML = options;
        }

        function renderQuestPrerequisites() {
            const container = document.getElementById('questPrereqList');
            if (!container) return;

            const quest = quests[selectedQuestIndex];
            if (!quest || !quest.prerequisites || quest.prerequisites.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px;">None (available from start)</div>';
                return;
            }

            container.innerHTML = quest.prerequisites.map((prereqId, i) => {
                const prereqQuest = quests.find(q => q.id === prereqId);
                const name = prereqQuest ? (prereqQuest.name || prereqId) : prereqId + ' (not found)';
                return '<div style="display:flex; justify-content:space-between; align-items:center; padding:3px; margin:2px 0; background:#333; border-radius:3px; font-size:10px;">' +
                    '<span style="color:#fa0;">' + name + '</span>' +
                    '<button onclick="removeQuestPrerequisite(' + i + ')" style="padding:1px 5px; font-size:9px; background:#a55; border:none; color:#fff; cursor:pointer;">×</button>' +
                '</div>';
            }).join('');
        }

        function addQuestPrerequisite() {
            if (selectedQuestIndex < 0) return;
            const select = document.getElementById('questPrereqSelect');
            const prereqId = select.value;
            if (!prereqId) return;

            const quest = quests[selectedQuestIndex];
            if (!quest.prerequisites) quest.prerequisites = [];
            if (quest.prerequisites.includes(prereqId)) return;

            quest.prerequisites.push(prereqId);
            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });

            updateQuestPrereqDropdown();
            renderQuestPrerequisites();
        }

        function removeQuestPrerequisite(index) {
            if (selectedQuestIndex < 0) return;
            const quest = quests[selectedQuestIndex];
            if (!quest.prerequisites) return;

            quest.prerequisites.splice(index, 1);
            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });

            updateQuestPrereqDropdown();
            renderQuestPrerequisites();
        }

        function renderQuestList() {
            const container = document.getElementById('questList');
            if (!container) return;

            if (quests.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:11px; text-align:center; padding:10px;">No quests created</div>';
                return;
            }

            // Find NPCs with multiple quests
            const npcQuestCounts = {};
            quests.forEach(q => {
                if (q.startNpcUid) {
                    npcQuestCounts[q.startNpcUid] = (npcQuestCounts[q.startNpcUid] || 0) + 1;
                }
            });

            container.innerHTML = quests.map((q, i) => {
                const isSelected = i === selectedQuestIndex;
                const condCount = q.conditions?.length || 0;
                const prereqCount = q.prerequisites?.length || 0;
                const hasMultiQuestNpc = q.startNpcUid && npcQuestCounts[q.startNpcUid] > 1;
                const multiQuestBadge = hasMultiQuestNpc ?
                    '<span style="background:#fa0; color:#000; padding:1px 4px; border-radius:3px; font-size:9px; font-weight:bold; margin-left:5px;" title="This NPC has multiple quests - order matters!">#' + (i + 1) + '</span>' : '';
                const prereqBadge = prereqCount > 0 ?
                    '<span style="background:#a80; color:#fff; padding:1px 4px; border-radius:3px; font-size:9px; margin-left:5px;" title="Requires ' + prereqCount + ' quest(s) completed first">🔒' + prereqCount + '</span>' : '';
                const npcName = getNpcNameByUid(q.startNpcUid);
                const npcInfo = npcName ? '<span style="color:#8cf;"> → ' + npcName + '</span>' : '';

                return '<div draggable="true" ondragstart="questDragStart(event, ' + i + ')" ondragover="questDragOver(event)" ondrop="questDrop(event, ' + i + ')" onclick="selectQuest(' + i + ')" style="padding:8px; margin:3px 0; background:' + (isSelected ? '#4a4a7a' : '#333') + '; border-radius:4px; cursor:pointer; border:2px solid ' + (isSelected ? '#a8f' : 'transparent') + '; display:flex; align-items:center; gap:8px;">' +
                    '<span style="cursor:grab; color:#666; font-size:14px;" title="Drag to reorder">⋮⋮</span>' +
                    '<div style="flex:1;">' +
                        '<div style="font-size:12px; color:#fff;">' + (q.name || 'Unnamed Quest') + multiQuestBadge + prereqBadge + '</div>' +
                        '<div style="font-size:10px; color:#888;">' + condCount + ' condition' + (condCount !== 1 ? 's' : '') + npcInfo + '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
        }

        // Helper to get NPC name by UID
        function getNpcNameByUid(uid) {
            if (!uid) return null;
            const placed = placedNpcs.find(p => p.uid === uid);
            if (!placed) return null;
            const npcDef = npcs[placed.npcIndex];
            return npcDef?.name || 'NPC';
        }

        // Quest drag and drop for reordering
        let questDragIndex = -1;

        function questDragStart(e, index) {
            questDragIndex = index;
            e.dataTransfer.effectAllowed = 'move';
            e.target.style.opacity = '0.5';
        }

        function questDragOver(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        }

        function questDrop(e, dropIndex) {
            e.preventDefault();
            e.target.style.opacity = '1';

            if (questDragIndex < 0 || questDragIndex === dropIndex) return;

            // Reorder quests array
            const draggedQuest = quests[questDragIndex];
            quests.splice(questDragIndex, 1);
            quests.splice(dropIndex, 0, draggedQuest);

            // Update selection if needed
            if (selectedQuestIndex === questDragIndex) {
                selectedQuestIndex = dropIndex;
            } else if (selectedQuestIndex > questDragIndex && selectedQuestIndex <= dropIndex) {
                selectedQuestIndex--;
            } else if (selectedQuestIndex < questDragIndex && selectedQuestIndex >= dropIndex) {
                selectedQuestIndex++;
            }

            // Broadcast the reorder
            broadcastEdit({ editType: 'reorderQuests', quests: quests.map(q => q.id) });

            questDragIndex = -1;
            renderQuestList();
        }

        function updateQuestNpcDropdowns() {
            const startSelect = document.getElementById('questStartNpc');
            const turnInSelect = document.getElementById('questTurnInNpc');
            if (!startSelect || !turnInSelect) return;

            // Build NPC options from placed NPCs
            let options = '<option value="">(None)</option>';
            placedNpcs.forEach((placed, i) => {
                const npcDef = npcs[placed.npcIndex];
                const name = npcDef?.name || 'NPC ' + i;
                const uid = placed.uid || 'npc_' + i;  // Generate UID if not present
                if (!placed.uid) placed.uid = uid;  // Store it
                options += '<option value="' + uid + '">' + name + ' at (' + placed.x + ',' + placed.y + ')</option>';
            });

            startSelect.innerHTML = options;
            turnInSelect.innerHTML = '<option value="">(Same as quest giver)</option>' + options.substring(options.indexOf('</option>') + 9);
        }

        function renderQuestConditions() {
            const container = document.getElementById('questConditions');
            if (!container) return;

            const quest = quests[selectedQuestIndex];
            if (!quest || !quest.conditions || quest.conditions.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px;">No conditions</div>';
                return;
            }

            container.innerHTML = quest.conditions.map((c, i) => {
                const typeLabels = { enemyDefeated: 'Kill', talkedToNpc: 'Talk', locationVisited: 'Visit', hasItem: 'Has Item' };
                const isBroken = c.broken;
                // hasItem and enemyDefeated need a quantity — show an editable count so "3 pineapples"
                // is ONE condition (count:3), not three duplicate "have ≥1" conditions.
                const usesCount = (c.type === 'hasItem' || c.type === 'enemyDefeated');
                const countInput = usesCount
                    ? '<span style="color:#888; margin-left:6px;">×</span>' +
                      '<input type="number" min="1" value="' + (c.count || 1) + '" title="how many required" ' +
                      'onchange="updateConditionCount(' + i + ', this.value)" ' +
                      'style="width:42px; margin:0 4px; font-size:10px; background:#222; color:#0ff; border:1px solid #555; border-radius:3px; text-align:center;">'
                    : '';
                return '<div style="display:flex; justify-content:space-between; align-items:center; padding:4px; margin:2px 0; background:' + (isBroken ? '#4a2a2a' : '#333') + '; border-radius:3px; font-size:10px;">' +
                    '<span style="color:' + (isBroken ? '#f88' : '#fff') + '; flex:1;">' + (typeLabels[c.type] || c.type) + ': ' + (c.displayName || 'Unknown') + '</span>' +
                    countInput +
                    '<button onclick="removeQuestCondition(' + i + ')" style="padding:2px 6px; font-size:9px; background:#a55;">×</button>' +
                '</div>';
            }).join('');
        }

        function updateConditionCount(index, value) {
            if (selectedQuestIndex < 0) return;
            const quest = quests[selectedQuestIndex];
            if (!quest.conditions || !quest.conditions[index]) return;
            quest.conditions[index].count = Math.max(1, parseInt(value) || 1);
            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
        }

        function removeQuestCondition(index) {
            if (selectedQuestIndex < 0) return;
            const quest = quests[selectedQuestIndex];
            if (!quest.conditions) return;
            quest.conditions.splice(index, 1);
            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
            renderQuestConditions();
        }

        function renderQuestRewards() {
            const container = document.getElementById('questRewards');
            if (!container) return;

            const quest = quests[selectedQuestIndex];
            let giveItems = quest?.onComplete?.giveItems || [];

            // Normalize old format (array of strings) to new format (array of objects with quantity)
            giveItems = normalizeQuestRewards(giveItems);

            if (giveItems.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px;">No rewards</div>';
                return;
            }

            container.innerHTML = giveItems.map((reward, i) => {
                const itemId = typeof reward === 'string' ? reward : reward.itemId;
                const quantity = typeof reward === 'object' ? (reward.quantity || 1) : 1;
                const item = items.find(it => it.id === itemId) || { name: 'Unknown Item' };
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:4px; margin:2px 0; background:#2a3a2a; border-radius:3px; font-size:10px;">
                    <span style="color:#4f8;">Give: ${item.name || itemId}</span>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <span style="color:#888;">x</span>
                        <input type="number" value="${quantity}" min="1" max="99" style="width:40px; background:#333; color:#fff; border:1px solid #555; padding:2px; font-size:10px;" onchange="updateQuestRewardQuantity(${i}, this.value)">
                        <button onclick="removeQuestReward(${i})" style="padding:2px 6px; font-size:9px; background:#a55;">×</button>
                    </div>
                </div>`;
            }).join('');
        }

        // Normalize old format rewards to new format
        function normalizeQuestRewards(giveItems) {
            if (!giveItems || giveItems.length === 0) return [];
            return giveItems.map(item => {
                if (typeof item === 'string') {
                    return { itemId: item, quantity: 1 };
                }
                return item;
            });
        }

        function addQuestReward() {
            if (selectedQuestIndex < 0) return;
            if (items.length === 0) {
                alert('Create some items first in the Items tab!');
                return;
            }

            // Show item picker popup with quantity input
            let html = '<div style="position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#222; padding:20px; border-radius:8px; border:2px solid #4f8; z-index:10000; max-height:80vh; overflow:auto;">';
            html += '<h3 style="margin:0 0 10px 0; color:#4f8;">Select Item to Give</h3>';
            html += '<div style="margin-bottom:10px; display:flex; align-items:center; gap:5px;">';
            html += '<label style="color:#888; font-size:10px;">Quantity:</label>';
            html += '<input type="number" id="rewardQuantityInput" value="1" min="1" max="99" style="width:50px; background:#333; color:#fff; border:1px solid #555; padding:3px;">';
            html += '</div>';
            items.forEach((item, i) => {
                const itemId = item.id || 'item_' + i;
                if (!item.id) item.id = itemId;
                html += '<div onclick="selectRewardItem(\'' + itemId + '\')" style="padding:8px; margin:5px 0; background:#333; border-radius:4px; cursor:pointer;">' + (item.name || 'Item ' + i) + '</div>';
            });
            html += '<button onclick="closeItemPickerPopup()" style="margin-top:10px; width:100%;">Cancel</button>';
            html += '</div><div id="itemPickerOverlay" onclick="closeItemPickerPopup()" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:9999;"></div>';

            const popup = document.createElement('div');
            popup.id = 'itemPickerPopup';
            popup.innerHTML = html;
            document.body.appendChild(popup);
        }

        function selectRewardItem(itemId) {
            if (selectedQuestIndex < 0) return;
            const quest = quests[selectedQuestIndex];
            if (!quest.onComplete) quest.onComplete = {};
            if (!quest.onComplete.giveItems) quest.onComplete.giveItems = [];

            // Get quantity from input
            const quantityInput = document.getElementById('rewardQuantityInput');
            const quantity = parseInt(quantityInput?.value) || 1;

            // Normalize existing rewards and add new one
            quest.onComplete.giveItems = normalizeQuestRewards(quest.onComplete.giveItems);
            quest.onComplete.giveItems.push({ itemId: itemId, quantity: quantity });

            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
            closeItemPickerPopup();
            renderQuestRewards();
        }

        function updateQuestRewardQuantity(index, value) {
            if (selectedQuestIndex < 0) return;
            const quest = quests[selectedQuestIndex];
            if (!quest.onComplete?.giveItems) return;

            // Normalize and update quantity
            quest.onComplete.giveItems = normalizeQuestRewards(quest.onComplete.giveItems);
            if (quest.onComplete.giveItems[index]) {
                quest.onComplete.giveItems[index].quantity = parseInt(value) || 1;
                broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
            }
        }

        function removeQuestReward(index) {
            if (selectedQuestIndex < 0) return;
            const quest = quests[selectedQuestIndex];
            if (!quest.onComplete?.giveItems) return;
            quest.onComplete.giveItems.splice(index, 1);
            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
            renderQuestRewards();
        }

        function closeItemPickerPopup() {
            const popup = document.getElementById('itemPickerPopup');
            if (popup) popup.remove();
        }

        // Condition setting mode
        function toggleSetCondition() {
            const type = document.getElementById('conditionType').value;

            if (settingConditionMode) {
                cancelSettingCondition();
                return;
            }

            if (!type) {
                const s = document.getElementById('conditionStatus');
                if (s) s.textContent = 'Pick a condition type first.';
                return;
            }

            if (type === 'hasItem') {
                showItemConditionPicker();
                return;
            }

            settingConditionMode = true;
            settingConditionType = type;

            const btn = document.getElementById('setConditionBtn');
            btn.textContent = 'CANCEL';
            btn.style.background = '#f55';

            const statusTexts = {
                'kill': 'Click on an ENEMY NPC on the map...',
                'talk': 'Click on any NPC on the map...',
                'visit': 'Click on a tile on the map...'
            };
            document.getElementById('conditionStatus').textContent = statusTexts[type] || 'Click on map...';

            renderMap();
        }

        function cancelSettingCondition() {
            settingConditionMode = false;
            settingConditionType = null;

            const btn = document.getElementById('setConditionBtn');
            btn.textContent = 'SET CONDITION';
            btn.style.background = 'linear-gradient(135deg, #0ff, #a8f)';
            document.getElementById('conditionStatus').textContent = '';

            renderMap();
        }

        function showItemConditionPicker() {
            if (items.length === 0) {
                alert('Create some items first in the Items tab!');
                return;
            }

            let html = '<div style="position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#222; padding:20px; border-radius:8px; border:2px solid #0ff; z-index:10000;">';
            html += '<h3 style="margin:0 0 10px 0; color:#0ff;">Select Required Item</h3>';
            items.forEach((item, i) => {
                const itemId = item.id || 'item_' + i;
                if (!item.id) item.id = itemId;
                html += '<div onclick="addItemCondition(\'' + itemId + '\', \'' + (item.name || 'Item ' + i).replace(/'/g, "\\'") + '\')" style="padding:8px; margin:5px 0; background:#333; border-radius:4px; cursor:pointer;">' + (item.name || 'Item ' + i) + '</div>';
            });
            html += '<button onclick="closeItemPickerPopup()" style="margin-top:10px; width:100%;">Cancel</button>';
            html += '</div><div id="itemPickerOverlay" onclick="closeItemPickerPopup()" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:9999;"></div>';

            const popup = document.createElement('div');
            popup.id = 'itemPickerPopup';
            popup.innerHTML = html;
            document.body.appendChild(popup);
        }

        function addItemCondition(itemId, itemName) {
            if (selectedQuestIndex < 0) return;
            const quest = quests[selectedQuestIndex];
            if (!quest.conditions) quest.conditions = [];

            quest.conditions.push({
                type: 'hasItem',
                targetUid: itemId,
                count: 1,
                displayName: itemName
            });

            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
            closeItemPickerPopup();
            renderQuestConditions();
        }

        function handleMapClickForCondition(tileX, tileY) {
            if (!settingConditionMode || selectedQuestIndex < 0) return false;

            const quest = quests[selectedQuestIndex];
            if (!quest.conditions) quest.conditions = [];

            const typeMap = { 'kill': 'enemyDefeated', 'talk': 'talkedToNpc', 'visit': 'locationVisited' };
            const internalType = typeMap[settingConditionType];

            if (settingConditionType === 'visit') {
                // Location visit condition
                quest.conditions.push({
                    type: 'locationVisited',
                    mapName: currentMapName,
                    x: tileX,
                    y: tileY,
                    displayName: 'Visit (' + tileX + ',' + tileY + ') on ' + currentMapName
                });
            } else {
                // NPC-based condition - find NPC at click position
                const npcIndex = findPlacedNpcAt(tileX, tileY);
                if (npcIndex < 0) {
                    document.getElementById('conditionStatus').textContent = 'No NPC there! Click on an NPC...';
                    return true;
                }

                const placed = placedNpcs[npcIndex];
                const npcDef = npcs[placed.npcIndex];
                const isEnemy = placed.isEnemy || npcDef?.isEnemy;

                if (settingConditionType === 'kill' && !isEnemy) {
                    document.getElementById('conditionStatus').textContent = 'That NPC is not an enemy! Click on an enemy...';
                    return true;
                }

                // Ensure NPC has a UID
                if (!placed.uid) placed.uid = 'npc_' + npcIndex + '_' + Date.now();

                const npcName = npcDef?.name || 'NPC';
                quest.conditions.push({
                    type: internalType,
                    targetUid: placed.uid,
                    displayName: (settingConditionType === 'kill' ? 'Kill ' : 'Talk to ') + npcName + ' at (' + placed.x + ',' + placed.y + ')'
                });
            }

            broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
            cancelSettingCondition();
            renderQuestConditions();
            return true;
        }

        function findPlacedNpcAt(tileX, tileY) {
            for (let i = 0; i < placedNpcs.length; i++) {
                const placed = placedNpcs[i];
                if (placed.mapName && placed.mapName !== currentMapName) continue;
                if (placed.x === tileX && placed.y === tileY) return i;
            }
            return -1;
        }

        // ===== QUEST GIVER / TURN-IN NPC CLICK SELECTION =====
        let settingQuestGiverMode = false;
        let settingQuestTurnInMode = false;

        function toggleSetQuestGiver() {
            if (settingQuestGiverMode) {
                cancelSetQuestGiver();
                return;
            }
            // Cancel other modes
            if (settingConditionMode) cancelSettingCondition();
            if (settingQuestTurnInMode) cancelSetQuestTurnIn();

            settingQuestGiverMode = true;
            document.getElementById('setQuestGiverBtn').textContent = 'CANCEL';
            document.getElementById('setQuestGiverBtn').style.background = '#f44';
            document.getElementById('questGiverStatus').textContent = 'Click on an NPC on the map...';
            renderMap();
        }

        function cancelSetQuestGiver() {
            settingQuestGiverMode = false;
            document.getElementById('setQuestGiverBtn').textContent = 'CLICK NPC TO SET QUEST GIVER';
            document.getElementById('setQuestGiverBtn').style.background = 'linear-gradient(135deg, #fa0, #f80)';
            document.getElementById('questGiverStatus').textContent = '';
            renderMap();
        }

        function toggleSetQuestTurnIn() {
            if (settingQuestTurnInMode) {
                cancelSetQuestTurnIn();
                return;
            }
            // Cancel other modes
            if (settingConditionMode) cancelSettingCondition();
            if (settingQuestGiverMode) cancelSetQuestGiver();

            settingQuestTurnInMode = true;
            document.getElementById('setQuestTurnInBtn').textContent = 'CANCEL';
            document.getElementById('setQuestTurnInBtn').style.background = '#f44';
            document.getElementById('questTurnInStatus').textContent = 'Click on an NPC on the map...';
            renderMap();
        }

        function cancelSetQuestTurnIn() {
            settingQuestTurnInMode = false;
            document.getElementById('setQuestTurnInBtn').textContent = 'CLICK NPC TO SET TURN-IN';
            document.getElementById('setQuestTurnInBtn').style.background = 'linear-gradient(135deg, #4a4, #282)';
            document.getElementById('questTurnInStatus').textContent = '';
            renderMap();
        }

        function handleMapClickForQuestNpc(tileX, tileY) {
            if (!settingQuestGiverMode && !settingQuestTurnInMode) return false;
            if (selectedQuestIndex < 0) return false;

            const npcIndex = findPlacedNpcAt(tileX, tileY);
            if (npcIndex < 0) {
                const statusEl = settingQuestGiverMode ? 'questGiverStatus' : 'questTurnInStatus';
                document.getElementById(statusEl).textContent = 'No NPC there! Click on an NPC...';
                return true;
            }

            const placed = placedNpcs[npcIndex];
            const npcDef = npcs[placed.npcIndex];
            const npcName = npcDef?.name || 'NPC';

            // Ensure NPC has a UID
            if (!placed.uid) placed.uid = 'npc_' + npcIndex + '_' + Date.now();

            const quest = quests[selectedQuestIndex];

            if (settingQuestGiverMode) {
                quest.startNpcUid = placed.uid;
                quest._startNpcName = npcName + ' at (' + placed.x + ',' + placed.y + ')';
                document.getElementById('questGiverName').textContent = quest._startNpcName;
                broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
                cancelSetQuestGiver();
            } else if (settingQuestTurnInMode) {
                quest.turnInNpcUid = placed.uid;
                quest._turnInNpcName = npcName + ' at (' + placed.x + ',' + placed.y + ')';
                document.getElementById('questTurnInName').textContent = quest._turnInNpcName;
                broadcastEdit({ editType: 'updateQuest', questId: quest.id, quest: quest });
                cancelSetQuestTurnIn();
            }

            return true;
        }

        function updateQuestNpcDisplayNames() {
            const quest = quests[selectedQuestIndex];
            if (!quest) return;

            // Find and display quest giver name
            if (quest.startNpcUid) {
                const npcIndex = placedNpcs.findIndex(p => p.uid === quest.startNpcUid);
                if (npcIndex >= 0) {
                    const placed = placedNpcs[npcIndex];
                    const npcDef = npcs[placed.npcIndex];
                    document.getElementById('questGiverName').textContent = (npcDef?.name || 'NPC') + ' at (' + placed.x + ',' + placed.y + ')';
                } else {
                    document.getElementById('questGiverName').textContent = '(NPC not found)';
                }
            } else {
                document.getElementById('questGiverName').textContent = '(None)';
            }

            // Find and display turn-in name
            if (quest.turnInNpcUid) {
                const npcIndex = placedNpcs.findIndex(p => p.uid === quest.turnInNpcUid);
                if (npcIndex >= 0) {
                    const placed = placedNpcs[npcIndex];
                    const npcDef = npcs[placed.npcIndex];
                    document.getElementById('questTurnInName').textContent = (npcDef?.name || 'NPC') + ' at (' + placed.x + ',' + placed.y + ')';
                } else {
                    document.getElementById('questTurnInName').textContent = '(NPC not found)';
                }
            } else {
                document.getElementById('questTurnInName').textContent = '(Same as giver)';
            }
        }
