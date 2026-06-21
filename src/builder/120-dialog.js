        // ===== DIALOG SYSTEM =====
        const dialogStylePresets = {
            1: { name: 'Classic NES', bg: '#000000', border: '#ffffff', text: '#ffffff', accent: '#ffffff', radius: 0, borderW: 4 },
            2: { name: 'Final Fantasy', bg: '#000088', border: '#ffffff', text: '#ffffff', accent: '#ffff00', radius: 0, borderW: 2 },
            3: { name: 'Pokemon', bg: '#f8f8f8', border: '#303030', text: '#303030', accent: '#e03030', radius: 8, borderW: 3 },
            4: { name: 'Earthbound', bg: '#000000', border: '#a080ff', text: '#ffffff', accent: '#ffff00', radius: 0, borderW: 2 },
            5: { name: 'Chrono Trigger', bg: '#1a1a4e', border: '#8888ff', text: '#ffffff', accent: '#ffcc00', radius: 4, borderW: 2 },
            6: { name: 'Modern Pixel', bg: '#2d2d2d', border: '#4a9eff', text: '#ffffff', accent: '#4a9eff', radius: 6, borderW: 2 }
        };

        let dialogEditorPages = [{ speaker: '', text: '' }];
        let dialogEditorPageIndex = 0;
        let dialogEditingIndex = -1; // -1 = new dialog
        let dialogAutoAttachNpcIndex = -1; // NPC to auto-attach dialog to after saving

        // Add dialog to currently selected NPC - switches to dialog tab and opens editor
        function addDialogToSelectedNpc() {
            if (selectedPlacedNpcIndex < 0) {
                alert('No NPC selected! Select an NPC first.');
                return;
            }

            const npc = placedNpcs[selectedPlacedNpcIndex];
            const npcDef = npcs[npc.npcIndex];
            const npcName = npcDef?.name || 'NPC ' + selectedPlacedNpcIndex;

            // Store which NPC to attach to
            dialogAutoAttachNpcIndex = selectedPlacedNpcIndex;

            // Switch to dialog mode
            setMode('dialog');

            // Open dialog editor for new dialog with NPC name pre-filled
            openDialogEditor(-1);
            document.getElementById('dialogNameInput').value = npcName + ' Dialog';

            console.log('[DIALOG] Adding dialog for NPC:', npcName);
        }

        function openDialogEditor(index) {
            dialogEditingIndex = index;

            if (index >= 0 && dialogs[index]) {
                // Editing existing dialog
                const d = dialogs[index];
                document.getElementById('dialogNameInput').value = d.name || '';
                document.getElementById('dialogStyleSelect').value = d.style || 1;
                document.getElementById('dialogBgColor').value = d.colors?.background || '#000000';
                document.getElementById('dialogBorderColor').value = d.colors?.border || '#ffffff';
                document.getElementById('dialogTextColor').value = d.colors?.text || '#ffffff';
                document.getElementById('dialogAccentColor').value = d.colors?.accent || '#ffffff';
                document.getElementById('dialogWidth').value = d.width || 280;
                document.getElementById('dialogHeight').value = d.height || 80;
                document.getElementById('dialogTypeSpeed').value = d.typeSpeed ?? 30;
                document.getElementById('dialogTypeSpeedVal').textContent = d.typeSpeed == 0 ? 'Instant' : (d.typeSpeed ?? 30);
                dialogEditorPages = d.pages ? JSON.parse(JSON.stringify(d.pages)) : [{ speaker: '', text: '' }];
            } else {
                // New dialog
                document.getElementById('dialogNameInput').value = '';
                document.getElementById('dialogStyleSelect').value = '1';
                applyDialogStylePreset(1);
                document.getElementById('dialogWidth').value = 280;
                document.getElementById('dialogHeight').value = 80;
                document.getElementById('dialogTypeSpeed').value = 30;
                document.getElementById('dialogTypeSpeedVal').textContent = '30';
                dialogEditorPages = [{ speaker: '', text: '' }];
            }

            dialogEditorPageIndex = 0;
            loadDialogPage(0, true);
            updateDialogPagesListEditor();
            updateDialogPreview();

            document.getElementById('dialogModal').classList.add('visible');
        }

        function closeDialogEditor() {
            document.getElementById('dialogModal').classList.remove('visible');
            dialogAutoAttachNpcIndex = -1; // Reset auto-attach
        }

        function applyDialogStylePreset(style) {
            const preset = dialogStylePresets[style];
            if (preset) {
                document.getElementById('dialogBgColor').value = preset.bg;
                document.getElementById('dialogBorderColor').value = preset.border;
                document.getElementById('dialogTextColor').value = preset.text;
                document.getElementById('dialogAccentColor').value = preset.accent;
            }
        }

        function loadDialogPage(index, skipSave = false) {
            // Save current page first (including choices)
            if (!skipSave && dialogEditorPages[dialogEditorPageIndex]) {
                dialogEditorPages[dialogEditorPageIndex] = {
                    speaker: document.getElementById('dialogSpeaker').value,
                    text: document.getElementById('dialogTextInput').value,
                    choices: dialogEditorPages[dialogEditorPageIndex].choices || null
                };
            }

            dialogEditorPageIndex = index;
            const page = dialogEditorPages[index] || { speaker: '', text: '' };
            document.getElementById('dialogSpeaker').value = page.speaker || '';
            document.getElementById('dialogTextInput').value = page.text || '';
            renderDialogChoicesList();
            updateDialogPagesListEditor();
            updateDialogPreview();
        }

        // Dialog choices management
        function renderDialogChoicesList() {
            const container = document.getElementById('dialogChoicesList');
            if (!container) return;

            const page = dialogEditorPages[dialogEditorPageIndex];
            const choices = page?.choices || [];

            if (choices.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px;">No choices (auto-advance)</div>';
                return;
            }

            container.innerHTML = choices.map((choice, i) => {
                const actionLabel = {
                    'accept': 'Accept Quest',
                    'decline': 'Decline Quest',
                    'goto': 'Go to Dialog',
                    'shop': 'Open Shop',
                    'close': 'Close Dialog'
                }[choice.action] || choice.action;

                return `<div style="display:flex; gap:4px; align-items:center; margin-bottom:4px; padding:4px; background:#333; border-radius:3px;">
                    <input type="text" value="${choice.text || ''}" onchange="updateDialogChoice(${i}, 'text', this.value)" style="flex:1; padding:3px; font-size:10px;" placeholder="Choice text...">
                    <select onchange="updateDialogChoice(${i}, 'action', this.value)" style="padding:3px; font-size:9px; width:80px;">
                        <option value="accept" ${choice.action === 'accept' ? 'selected' : ''}>Accept</option>
                        <option value="decline" ${choice.action === 'decline' ? 'selected' : ''}>Decline</option>
                        <option value="goto" ${choice.action === 'goto' ? 'selected' : ''}>Go to</option>
                        <option value="shop" ${choice.action === 'shop' ? 'selected' : ''}>Shop</option>
                        <option value="close" ${choice.action === 'close' ? 'selected' : ''}>Close</option>
                    </select>
                    <button onclick="removeDialogChoice(${i})" style="padding:2px 5px; font-size:9px; background:#a55;">X</button>
                </div>`;
            }).join('');
        }

        function addDialogChoice() {
            const page = dialogEditorPages[dialogEditorPageIndex];
            if (!page.choices) page.choices = [];

            page.choices.push({
                text: 'Choice ' + (page.choices.length + 1),
                action: 'accept'
            });

            renderDialogChoicesList();
        }

        function updateDialogChoice(index, field, value) {
            const page = dialogEditorPages[dialogEditorPageIndex];
            if (page?.choices && page.choices[index]) {
                page.choices[index][field] = value;
            }
        }

        function removeDialogChoice(index) {
            const page = dialogEditorPages[dialogEditorPageIndex];
            if (page?.choices) {
                page.choices.splice(index, 1);
                if (page.choices.length === 0) {
                    page.choices = [];
                }
                renderDialogChoicesList();
            }
        }

        function selectDialogPageEditor(index) {
            loadDialogPage(index);
        }

        function addDialogPage() {
            // Save current page
            const existingChoices = dialogEditorPages[dialogEditorPageIndex]?.choices || null;
            dialogEditorPages[dialogEditorPageIndex] = {
                speaker: document.getElementById('dialogSpeaker').value,
                text: document.getElementById('dialogTextInput').value,
                choices: existingChoices
            };

            dialogEditorPages.push({ speaker: '', text: '', choices: null });
            loadDialogPage(dialogEditorPages.length - 1);
        }

        function removeCurrentDialogPage() {
            if (dialogEditorPages.length <= 1) {
                alert('Cannot delete the only page');
                return;
            }

            dialogEditorPages.splice(dialogEditorPageIndex, 1);
            if (dialogEditorPageIndex >= dialogEditorPages.length) {
                dialogEditorPageIndex = dialogEditorPages.length - 1;
            }
            loadDialogPage(dialogEditorPageIndex);
        }

        function updateDialogPagesListEditor() {
            const container = document.getElementById('dialogPagesList');
            container.innerHTML = dialogEditorPages.map((page, i) => {
                const active = i === dialogEditorPageIndex ? 'active' : '';
                const preview = (page.text || 'Empty').substring(0, 15);
                return `<div class="dialog-page ${active}" onclick="selectDialogPageEditor(${i})">${i + 1}</div>`;
            }).join('');
        }

        function updateDialogPreview() {
            const canvas = document.getElementById('dialogPreviewCanvas');
            if (!canvas) return;

            const width = parseInt(document.getElementById('dialogWidth').value) || 280;
            const height = parseInt(document.getElementById('dialogHeight').value) || 80;
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            const bgColor = document.getElementById('dialogBgColor').value;
            const borderColor = document.getElementById('dialogBorderColor').value;
            const textColor = document.getElementById('dialogTextColor').value;
            const accentColor = document.getElementById('dialogAccentColor').value;
            const style = parseInt(document.getElementById('dialogStyleSelect').value);
            const preset = dialogStylePresets[style];

            // Draw background
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, width, height);

            // Draw border
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = preset?.borderW || 2;
            const radius = preset?.radius || 0;

            if (radius > 0) {
                ctx.beginPath();
                ctx.roundRect(2, 2, width - 4, height - 4, radius);
                ctx.stroke();
            } else {
                ctx.strokeRect(2, 2, width - 4, height - 4);
            }

            // Draw speaker name
            const speaker = document.getElementById('dialogSpeaker').value;
            const text = document.getElementById('dialogTextInput').value;

            ctx.font = '12px monospace';
            let y = 18;

            if (speaker) {
                ctx.fillStyle = accentColor;
                ctx.fillText(speaker, 12, y);
                y += 16;
            }

            // Draw text (simple word wrap)
            ctx.fillStyle = textColor;
            const words = text.split(' ');
            let line = '';
            const maxWidth = width - 24;

            for (const word of words) {
                const testLine = line + word + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && line) {
                    ctx.fillText(line, 12, y);
                    line = word + ' ';
                    y += 14;
                    if (y > height - 10) break;
                } else {
                    line = testLine;
                }
            }
            if (y <= height - 10) {
                ctx.fillText(line, 12, y);
            }
        }

        function saveDialog() {
            // Save current page (preserving choices)
            const existingChoices = dialogEditorPages[dialogEditorPageIndex]?.choices || null;
            dialogEditorPages[dialogEditorPageIndex] = {
                speaker: document.getElementById('dialogSpeaker').value,
                text: document.getElementById('dialogTextInput').value,
                choices: existingChoices
            };

            const name = document.getElementById('dialogNameInput').value.trim() || 'Dialog ' + (dialogs.length + 1);
            const style = parseInt(document.getElementById('dialogStyleSelect').value);

            const dialogData = {
                name: name,
                style: style,
                width: parseInt(document.getElementById('dialogWidth').value) || 280,
                height: parseInt(document.getElementById('dialogHeight').value) || 80,
                typeSpeed: parseInt(document.getElementById('dialogTypeSpeed').value) || 30,
                colors: {
                    background: document.getElementById('dialogBgColor').value,
                    border: document.getElementById('dialogBorderColor').value,
                    text: document.getElementById('dialogTextColor').value,
                    accent: document.getElementById('dialogAccentColor').value
                },
                pages: JSON.parse(JSON.stringify(dialogEditorPages))
            };

            if (dialogEditingIndex >= 0) {
                dialogs[dialogEditingIndex] = dialogData;
                broadcastEdit({ editType: 'updateDialog', index: dialogEditingIndex, dialog: dialogData });
            } else {
                dialogs.push(dialogData);
                broadcastEdit({ editType: 'addDialog', dialog: dialogData });

                // Auto-attach to NPC if we came from NPC panel
                if (dialogAutoAttachNpcIndex >= 0 && dialogAutoAttachNpcIndex < placedNpcs.length) {
                    const newDialogIndex = dialogs.length - 1;
                    placedNpcs[dialogAutoAttachNpcIndex].dialogIndex = newDialogIndex;
                    placedNpcs[dialogAutoAttachNpcIndex].dialogTrigger = 'interact'; // Default to interact trigger
                    broadcastEdit({ editType: 'attachNpcDialog', npcIndex: dialogAutoAttachNpcIndex, dialogIndex: newDialogIndex, dialogTrigger: 'interact' });
                    console.log('[DIALOG] Auto-attached dialog to NPC', dialogAutoAttachNpcIndex);
                    dialogAutoAttachNpcIndex = -1; // Reset
                }

                // Auto-attach to quest if we came from quest dialog picker
                if (typeof questDialogPickerType !== 'undefined' && questDialogPickerType) {
                    attachNewDialogToQuest(dialogs.length - 1);
                }
            }

            closeDialogEditor();
            updateDialogList();
            // Refresh quest dialog dropdowns in case name changed
            if (typeof updateQuestDialogDropdowns === 'function') {
                updateQuestDialogDropdowns();
            }
            console.log('[DIALOG] Saved dialog:', name);
        }

        function deleteDialog(index) {
            if (!confirm('Delete dialog "' + dialogs[index].name + '"?')) return;

            // Check if any NPC uses this dialog
            const usedBy = placedNpcs.filter(n => n.dialogIndex === index);
            if (usedBy.length > 0) {
                alert('Cannot delete: This dialog is attached to ' + usedBy.length + ' NPC(s)');
                return;
            }

            // Check if any shop uses this dialog (shop.dialogId)
            const usedByShops = (typeof shops !== 'undefined' && Array.isArray(shops))
                ? shops.filter(s => s && parseInt(s.dialogId) === index) : [];
            if (usedByShops.length > 0) {
                alert('Cannot delete: This dialog is assigned to ' + usedByShops.length + ' shop(s). Reassign the shop first.');
                return;
            }

            dialogs.splice(index, 1);

            // Wave 5: cascade reindex — placedDialogTiles, placedNpcs.dialogIndex,
            // quest hook IDs (startDialogId/activeDialogId/completeDialogId/declineDialogId),
            // shops[].dialogId.
            reindexDialogReferences(index);

            broadcastEdit({ editType: 'deleteDialog', index: index });
            updateDialogList();
            if (typeof renderQuestList === 'function') renderQuestList();
            if (typeof updateShopList === 'function') updateShopList();
            renderMap();
        }

        function updateDialogList() {
            const container = document.getElementById('dialogList');
            if (!container) return;

            if (dialogs.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:12px; text-align:center; padding:20px;">No dialogs created yet</div>';
                return;
            }

            // Gather info about each dialog
            const dialogInfo = dialogs.map((d, i) => {
                const pageCount = d.pages?.length || 1;
                const attachedTo = [];
                const questUsage = [];

                // Check which NPCs use this dialog
                placedNpcs.forEach((n, npcIdx) => {
                    if (n.dialogIndex === i) {
                        const npcDef = npcs[n.npcIndex];
                        const npcName = npcDef?.name || 'NPC ' + npcIdx;
                        const trigger = n.dialogTrigger === 'auto' ? ' (auto)' : '';
                        attachedTo.push('NPC: ' + npcName + trigger);
                    }
                });

                // Check which signs use this dialog
                placedDialogTiles.forEach((tile, tileIdx) => {
                    if (tile.dialogIndex === i) {
                        attachedTo.push('Sign at (' + tile.x + ',' + tile.y + ')');
                    }
                });

                // Check which quests use this dialog (all FOUR slots — declineDialogId was missing,
                // which mislabeled decline-only dialogs as "regular").
                quests.forEach(quest => {
                    if (parseInt(quest.startDialogId) === i) {
                        questUsage.push({ quest: quest.name || quest.id, type: 'Start' });
                    }
                    if (parseInt(quest.activeDialogId) === i) {
                        questUsage.push({ quest: quest.name || quest.id, type: 'Active' });
                    }
                    if (parseInt(quest.completeDialogId) === i) {
                        questUsage.push({ quest: quest.name || quest.id, type: 'Complete' });
                    }
                    if (parseInt(quest.declineDialogId) === i) {
                        questUsage.push({ quest: quest.name || quest.id, type: 'Decline' });
                    }
                });

                // Check which shops use this dialog (shop.dialogId)
                const shopUsage = [];
                if (typeof shops !== 'undefined' && Array.isArray(shops)) {
                    shops.forEach((shop, sIdx) => {
                        if (shop && parseInt(shop.dialogId) === i) {
                            shopUsage.push({ shop: shop.name || 'Shop ' + (sIdx + 1) });
                        }
                    });
                }

                return {
                    dialog: d,
                    index: i,
                    pageCount,
                    attachedTo,
                    questUsage,
                    shopUsage,
                    isShopDialog: shopUsage.length > 0,
                    isQuestDialog: questUsage.length > 0
                };
            });

            // Separate into shop / quest / regular dialogs (precedence: shop > quest > regular)
            const shopDialogs = dialogInfo.filter(d => d.isShopDialog);
            const questDialogs = dialogInfo.filter(d => d.isQuestDialog && !d.isShopDialog);
            const regularDialogs = dialogInfo.filter(d => !d.isQuestDialog && !d.isShopDialog);

            let html = '';

            // Shop Dialogs section
            if (shopDialogs.length > 0) {
                html += '<div style="font-size:11px; color:#8f8; font-weight:bold; margin:8px 0 4px 0; border-bottom:1px solid #8f8; padding-bottom:2px;">SHOP DIALOGS</div>';
                html += shopDialogs.map(info => renderDialogItem(info)).join('');
            }

            // Quest Dialogs section
            if (questDialogs.length > 0) {
                html += '<div style="font-size:11px; color:#fa0; font-weight:bold; margin:8px 0 4px 0; border-bottom:1px solid #fa0; padding-bottom:2px;">QUEST DIALOGS</div>';
                html += questDialogs.map(info => renderDialogItem(info)).join('');
            }

            // Regular Dialogs section
            if (regularDialogs.length > 0) {
                html += '<div style="font-size:11px; color:#8cf; font-weight:bold; margin:8px 0 4px 0; border-bottom:1px solid #8cf; padding-bottom:2px;">REGULAR DIALOGS</div>';
                html += regularDialogs.map(info => renderDialogItem(info)).join('');
            }

            container.innerHTML = html;

            // Also update the dialog dropdown for attaching
            updateDialogDropdown();
            updateDialogTileDropdown();
            updatePlacedDialogTilesList();
        }

        function renderDialogItem(info) {
            const { dialog, index, pageCount, attachedTo, questUsage, shopUsage } = info;
            const isSelected = currentDialogTileIndex === index;
            const bgColor = isSelected ? '#4a7c59' : '#333';
            const borderStyle = isSelected ? '2px solid #8f8' : '2px solid transparent';

            // Build usage text
            let usageText = '';
            if (shopUsage && shopUsage.length > 0) {
                usageText = '🛒 ' + shopUsage.map(s => s.shop).join(', ');
            } else if (questUsage.length > 0) {
                usageText = questUsage.map(q => q.quest + ' (' + q.type + ')').join(', ');
            } else if (attachedTo.length > 0) {
                usageText = attachedTo.join(', ');
            } else {
                usageText = '<span style="color:#f88;">Not attached</span>';
            }

            return `<div onclick="selectDialogForPlacement(${index})" style="display:flex; align-items:center; gap:8px; padding:8px; margin-bottom:5px; background:${bgColor}; border-radius:4px; cursor:pointer; border:${borderStyle};">
                <div style="flex:1; min-width:0;">
                    <div style="font-size:12px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${dialog.name}</div>
                    <div style="font-size:10px; color:#888;">${pageCount} page${pageCount > 1 ? 's' : ''}${isSelected ? ' - SELECTED' : ''}</div>
                    <div style="font-size:9px; color:#aaa; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${usageText}</div>
                </div>
                <button onclick="event.stopPropagation(); openDialogEditor(${index})" style="padding:4px 8px; font-size:11px; background:#448;">Edit</button>
                <button onclick="event.stopPropagation(); deleteDialog(${index})" style="padding:4px 8px; font-size:11px; background:#644;">X</button>
            </div>`;
        }

        function updateDialogDropdown() {
            const select = document.getElementById('dialogToAttach');
            if (!select) return;

            select.innerHTML = '<option value="">Select a dialog...</option>' +
                dialogs.map((d, i) => `<option value="${i}">${d.name}</option>`).join('');
        }

        function updateDialogNpcDropdown() {
            const select = document.getElementById('dialogNpcSelect');
            if (!select) return;

            select.innerHTML = '<option value="">Select an NPC...</option>' +
                placedNpcs.map((n, i) => {
                    const npcDef = npcs[n.npcIndex];
                    const name = npcDef?.name || 'NPC ' + i;
                    const hasDialog = n.dialogIndex >= 0 ? ' (has dialog)' : '';
                    return `<option value="${i}">${name}${hasDialog}</option>`;
                }).join('');
        }

        function attachDialogToNpc() {
            const npcIdx = parseInt(document.getElementById('dialogNpcSelect').value);
            const dialogIdx = parseInt(document.getElementById('dialogToAttach').value);
            const triggerType = document.getElementById('dialogNpcTrigger').value;

            if (isNaN(npcIdx) || npcIdx < 0) {
                alert('Please select an NPC');
                return;
            }
            if (isNaN(dialogIdx) || dialogIdx < 0) {
                alert('Please select a dialog');
                return;
            }

            placedNpcs[npcIdx].dialogIndex = dialogIdx;
            placedNpcs[npcIdx].dialogTrigger = triggerType; // 'interact' or 'auto'
            broadcastEdit({ editType: 'attachNpcDialog', npcIndex: npcIdx, dialogIndex: dialogIdx, dialogTrigger: triggerType });

            alert('Dialog attached to NPC!');
            updateDialogNpcDropdown();
        }

        // ===== DIALOG TILE PLACEMENT (Signs) =====
        function selectDialogForPlacement(index) {
            // Toggle selection
            if (currentDialogTileIndex === index) {
                currentDialogTileIndex = -1; // Deselect
            } else {
                currentDialogTileIndex = index;
            }
            updateDialogList();
            // Also update dropdown if it exists
            const select = document.getElementById('dialogTileSelect');
            if (select) select.value = currentDialogTileIndex;
        }

        function selectDialogForTile(value) {
            currentDialogTileIndex = parseInt(value);
            updateDialogList();
        }

        function updateDialogTileDropdown() {
            const select = document.getElementById('dialogTileSelect');
            if (!select) return;
            select.innerHTML = '<option value="-1">Select a dialog...</option>' +
                dialogs.map((d, i) => `<option value="${i}">${d.name}</option>`).join('');
            select.value = currentDialogTileIndex;
        }

        function updatePlacedDialogTilesList() {
            const list = document.getElementById('placedDialogTilesList');
            if (!list) return;

            const tilesOnMap = placedDialogTiles.filter(t => t.mapName === currentMapName);
            if (tilesOnMap.length === 0) {
                list.innerHTML = '<div style="color:#666; font-size:11px; text-align:center; padding:10px;">No dialog tiles placed</div>';
                return;
            }

            list.innerHTML = tilesOnMap.map((t, i) => {
                const globalIdx = placedDialogTiles.indexOf(t);
                const dialogName = dialogs[t.dialogIndex]?.name || 'Unknown';
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:4px; margin:2px 0; background:#333; border-radius:3px; font-size:11px;">
                    <span>(${t.x}, ${t.y}) - ${dialogName}</span>
                    <button onclick="removeDialogTileByIndex(${globalIdx})" style="padding:2px 6px; font-size:10px; background:#a33;">x</button>
                </div>`;
            }).join('');
        }

        function placeDialogTileAt(x, y) {
            if (currentDialogTileIndex < 0) {
                alert('Select a dialog first');
                return;
            }

            // Check if already has dialog tile at this position
            const existing = findDialogTileAt(x, y);
            if (existing >= 0) {
                // Update existing
                placedDialogTiles[existing].dialogIndex = currentDialogTileIndex;
                broadcastEdit({ editType: 'updateDialogTile', index: existing, tile: placedDialogTiles[existing] });
            } else {
                // Add new
                const tile = { x, y, mapName: currentMapName, dialogIndex: currentDialogTileIndex };
                placedDialogTiles.push(tile);
                broadcastEdit({ editType: 'placeDialogTile', tile });
            }

            updatePlacedDialogTilesList();
            renderMap();
        }

        function removeDialogTileAt(x, y) {
            const idx = findDialogTileAt(x, y);
            if (idx >= 0) {
                placedDialogTiles.splice(idx, 1);
                broadcastEdit({ editType: 'removeDialogTile', index: idx });
                updatePlacedDialogTilesList();
                renderMap();
            }
        }

        function removeDialogTileByIndex(idx) {
            if (idx >= 0 && idx < placedDialogTiles.length) {
                placedDialogTiles.splice(idx, 1);
                broadcastEdit({ editType: 'removeDialogTile', index: idx });
                updatePlacedDialogTilesList();
                renderMap();
            }
        }

        function findDialogTileAt(x, y) {
            return placedDialogTiles.findIndex(t => t.x === x && t.y === y && t.mapName === currentMapName);
        }
