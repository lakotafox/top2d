        // ===== SHOP SYSTEM =====
        function generateShopId() {
            return 'shop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }

        function updateShopList() {
            const container = document.getElementById('shopList');
            if (!container) return;

            if (shops.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:11px; text-align:center; padding:10px;">No shops created</div>';
                return;
            }

            container.innerHTML = shops.map((shop, i) => {
                const isSelected = i === selectedShopIndex;
                const itemCount = shop.inventory ? shop.inventory.length : 0;
                const buyCount = shop.buyList ? shop.buyList.length : 0;
                return '<div onclick="selectShop(' + i + ')" style="padding:8px; margin:3px 0; background:' + (isSelected ? '#4a5a2a' : '#333') + '; border-radius:4px; cursor:pointer; border:2px solid ' + (isSelected ? '#fa0' : 'transparent') + ';">' +
                    '<div style="font-size:12px; color:#fff;">' + (shop.name || 'Unnamed Shop') + '</div>' +
                    '<div style="font-size:10px; color:#888;">' + itemCount + ' item(s) for sale, buys ' + buyCount + ' type(s)</div>' +
                '</div>';
            }).join('');
        }

        function selectShop(index) {
            // Toggle selection - click again to unselect
            if (selectedShopIndex === index) {
                selectedShopIndex = -1;
            } else {
                selectedShopIndex = index;
            }
            updateShopList();
            updateSelectedShopInfo();
        }

        function unselectShop() {
            selectedShopIndex = -1;
            updateShopList();
            updateSelectedShopInfo();
        }

        function updateSelectedShopInfo() {
            const infoPanel = document.getElementById('selectedShopInfo');
            if (!infoPanel) return;

            if (selectedShopIndex < 0 || !shops[selectedShopIndex]) {
                infoPanel.style.display = 'none';
                return;
            }

            infoPanel.style.display = 'block';
            const shop = shops[selectedShopIndex];
            infoPanel.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <strong style="color:#fa0;">${shop.name || 'Unnamed Shop'}</strong>
                    <button onclick="unselectShop()" style="background:none; border:none; color:#888; cursor:pointer; font-size:14px;" title="Unselect">✕</button>
                </div>
                <div style="font-size:10px; color:#aaa; margin-bottom:8px;">
                    ${shop.inventory?.length || 0} items for sale<br>
                    Buys ${shop.buyList?.length || 0} item types<br>
                    Default sell rate: ${shop.defaultSellRate || 50}%
                </div>
                <div style="display:flex; gap:5px;">
                    <button onclick="openShopEditor(selectedShopIndex)" style="flex:1; padding:6px; background:#4a7c59; color:#fff; border:none; border-radius:3px; cursor:pointer;">Edit</button>
                    <button onclick="deleteShop(selectedShopIndex)" style="padding:6px 10px; background:#a55; color:#fff; border:none; border-radius:3px; cursor:pointer;">X</button>
                </div>
                <div style="margin-top:8px; font-size:10px; color:#aaa;">
                    Click an NPC to attach this shop
                </div>
            `;
        }

        function updateNpcShopList() {
            const container = document.getElementById('npcShopList');
            if (!container) return;

            const npcsWithShops = placedNpcs.filter((p, i) => p.shopIndex >= 0 && p.shopIndex < shops.length);

            if (npcsWithShops.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px;">No NPCs have shops attached</div>';
                return;
            }

            container.innerHTML = npcsWithShops.map(placed => {
                const npcDef = npcs[placed.npcIndex];
                const shop = shops[placed.shopIndex];
                return '<div style="padding:4px; margin:2px 0; background:#333; border-radius:3px; font-size:10px;">' +
                    '<span style="color:#8cf;">' + (npcDef?.name || 'NPC') + '</span> → ' +
                    '<span style="color:#fa0;">' + (shop?.name || 'Shop') + '</span>' +
                '</div>';
            }).join('');
        }

        function addNewShop() {
            const newShop = {
                id: generateShopId(),
                name: 'Shop ' + (shops.length + 1),
                inventory: [],      // Items for sale: { itemIndex, buyPrice, stock }
                buyList: [],        // Items shop buys: { itemIndex, sellPrice }
                defaultSellRate: 50,
                dialogId: -1,
                musicIndex: -1,
                uiStyle: {
                    borderColor: '#ffaa00',
                    panelBg: '#1e1e28',
                    forSaleBg: '#284028',
                    inventoryBg: '#1e1e32',
                    cartBg: '#32281e',
                    textColor: '#ffffff',
                    accentColor: '#ffaa00'
                }
            };
            shops.push(newShop);
            selectedShopIndex = shops.length - 1;
            broadcastEdit({ editType: 'addShop', shop: newShop });
            updateShopList();
            updateSelectedShopInfo();
            openShopEditor(selectedShopIndex);
        }

        function deleteShop(index) {
            if (index < 0 || index >= shops.length) return;
            if (!confirm('Delete this shop?')) return;

            // Remove shop attachment from any NPCs
            placedNpcs.forEach(p => {
                if (p.shopIndex === index) {
                    p.shopIndex = -1;
                } else if (p.shopIndex > index) {
                    p.shopIndex--;
                }
            });

            // Remove from placedShops
            placedShops = placedShops.filter(ps => ps.shopIndex !== index);
            placedShops.forEach(ps => { if (ps.shopIndex > index) ps.shopIndex--; });

            shops.splice(index, 1);
            selectedShopIndex = -1;

            broadcastEdit({ editType: 'deleteShop', index: index });
            updateShopList();
            updateSelectedShopInfo();
            updateNpcShopList();
        }

        let editingShopIndex = -1;

        function openShopEditor(index) {
            // Create new shop if index is -1
            if (index < 0) {
                const newShop = {
                    id: 'shop_' + Date.now(),
                    name: 'New Shop',
                    inventory: [],
                    buyList: [],
                    defaultSellRate: 50,
                    dialogId: -1,
                    musicIndex: -1,
                    uiStyle: {
                        borderColor: '#ffaa00',
                        panelBg: '#1e1e28',
                        forSaleBg: '#284028',
                        inventoryBg: '#1e1e32',
                        cartBg: '#32281e',
                        textColor: '#ffffff',
                        accentColor: '#ffaa00'
                    }
                };
                shops.push(newShop);
                index = shops.length - 1;
                broadcastEdit({ editType: 'addShop', shop: newShop });
                updateShopList();
            }
            if (index >= shops.length) return;
            editingShopIndex = index;
            selectedShopIndex = index;
            const shop = shops[index];

            document.getElementById('shopEditorName').value = shop.name || '';
            const sellRate = shop.defaultSellRate || 50;
            document.getElementById('shopEditorSellRate').value = sellRate;
            document.getElementById('sellRateDisplay').textContent = sellRate;

            // Populate the greeting-dialog dropdown (+ "create new" option) and select shop.dialogId
            const dlgSelect = document.getElementById('shopEditorDialog');
            if (dlgSelect) {
                let opts = '<option value="-1">➕ (Create new shop dialog)</option>';
                dialogs.forEach((d, di) => {
                    opts += '<option value="' + di + '">' + (d.name || ('Dialog ' + di)) + '</option>';
                });
                dlgSelect.innerHTML = opts;
                const did = (shop.dialogId !== undefined && shop.dialogId !== null && shop.dialogId !== '') ? parseInt(shop.dialogId) : -1;
                dlgSelect.value = (!isNaN(did) && did >= 0 && did < dialogs.length) ? String(did) : '-1';
            }

            // Populate music dropdown
            const musicSelect = document.getElementById('shopEditorMusic');
            musicSelect.innerHTML = '<option value="-1">(None)</option>';
            sounds.forEach((s, i) => {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = s.name || ('Sound ' + i);
                musicSelect.appendChild(opt);
            });
            musicSelect.value = shop.musicIndex !== undefined ? shop.musicIndex : -1;

            updateShopItemDropdowns();
            renderShopInventoryEditor();
            renderShopBuyListEditor();

            document.getElementById('shopModal').style.display = 'flex';
            updateSelectedShopInfo();
        }

        function closeShopEditor() {
            document.getElementById('shopModal').style.display = 'none';
            editingShopIndex = -1;
        }

        function saveShopEditor() {
            if (editingShopIndex < 0) return;
            const shop = shops[editingShopIndex];

            shop.name = document.getElementById('shopEditorName').value || 'Unnamed Shop';
            shop.defaultSellRate = parseInt(document.getElementById('shopEditorSellRate').value) || 50;
            shop.musicIndex = parseInt(document.getElementById('shopEditorMusic').value);

            // Assign the greeting dialog (shop.dialogId) + ensure it can open the shop.
            ensureShopDialog(shop);

            broadcastEdit({ editType: 'updateShop', index: editingShopIndex, shop: shop });
            closeShopEditor();
            updateShopList();
            updateSelectedShopInfo();
            if (typeof updateDialogList === 'function') updateDialogList();
        }

        // Build a minimal shop dialog (matches the dialog editor's save shape) with the two
        // required choices: Yes -> open shop, no -> close.
        function makeShopDialog(name, text) {
            return {
                name: name,
                style: 1,
                width: 280,
                height: 80,
                typeSpeed: 30,
                colors: { background: '#1a1a2e', border: '#fa0', text: '#ffffff', accent: '#fa0' },
                pages: [{
                    speaker: name,
                    text: text,
                    choices: [
                        { text: 'Yes', action: 'shop' },
                        { text: 'no', action: 'close' }
                    ]
                }]
            };
        }

        // Resolve the shop's greeting dialog from the dropdown; create one if none, and
        // auto-inject the Open Shop / Leave choices so the shop is always openable.
        function ensureShopDialog(shop) {
            const select = document.getElementById('shopEditorDialog');
            let did = select ? parseInt(select.value) : -1;

            if (isNaN(did) || did < 0 || did >= dialogs.length) {
                // Create a fresh shop dialog (placeholder text the creator can edit later)
                const dlg = makeShopDialog((shop.name || 'Shop') + ' Shop', "(please set up this shop's dialog)");
                dialogs.push(dlg);
                did = dialogs.length - 1;
                broadcastEdit({ editType: 'addDialog', dialog: dlg });
            } else {
                // Existing dialog: ensure an 'shop' choice + a 'close' choice exist somewhere.
                const dlg = dialogs[did];
                if (!dlg.pages || dlg.pages.length === 0) {
                    dlg.pages = [{ speaker: shop.name || 'Shop', text: 'do you want to open shop?' }];
                }
                const hasShop = dlg.pages.some(p => (p.choices || []).some(c => c.action === 'shop'));
                const hasClose = dlg.pages.some(p => (p.choices || []).some(c => c.action === 'close'));
                if (!hasShop || !hasClose) {
                    const lastPage = dlg.pages[dlg.pages.length - 1];
                    if (!lastPage.choices) lastPage.choices = [];
                    if (!lastPage.text && !hasShop) lastPage.text = 'do you want to open shop?';
                    if (!hasShop) lastPage.choices.push({ text: 'Yes', action: 'shop' });
                    if (!hasClose) lastPage.choices.push({ text: 'no', action: 'close' });
                    broadcastEdit({ editType: 'updateDialog', index: did, dialog: dlg });
                }
            }
            shop.dialogId = did;
            // Drop legacy ad-hoc greeting fields
            delete shop.greeting;
            delete shop.greetingDialogId;
        }

        // "Edit" button next to the dropdown — open the dialog editor for the assigned dialog.
        function editShopDialog() {
            const select = document.getElementById('shopEditorDialog');
            const did = select ? parseInt(select.value) : -1;
            if (!isNaN(did) && did >= 0 && did < dialogs.length && typeof openDialogEditor === 'function') {
                openDialogEditor(did);
            } else {
                alert('Pick an existing dialog to edit, or just Save to auto-create one.');
            }
        }

        function deleteShopFromEditor() {
            if (editingShopIndex < 0) return;
            if (!confirm('Delete this shop?')) return;
            const indexToDelete = editingShopIndex;
            closeShopEditor();
            deleteShop(indexToDelete);
        }

        function previewShopUI() {
            if (editingShopIndex < 0) return;
            const shop = shops[editingShopIndex];
            if (!shop) return;

            // Create overlay
            const overlay = document.createElement('div');
            overlay.id = 'shopPreviewOverlay';
            overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.9); z-index:3000; display:flex; justify-content:center; align-items:center; flex-direction:column;';

            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 450;
            canvas.style.cssText = 'border:2px solid #fa0; border-radius:4px;';

            // Button container
            const btnContainer = document.createElement('div');
            btnContainer.style.cssText = 'margin-top:15px; display:flex; gap:10px;';

            // Edit button
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit UI Style';
            editBtn.style.cssText = 'padding:10px 25px; background:#448; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:14px;';
            editBtn.onclick = () => {
                overlay.remove();
                openShopUIEditor();
            };

            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close Preview';
            closeBtn.style.cssText = 'padding:10px 25px; background:#444; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:14px;';
            closeBtn.onclick = () => overlay.remove();

            btnContainer.appendChild(editBtn);
            btnContainer.appendChild(closeBtn);
            overlay.appendChild(canvas);
            overlay.appendChild(btnContainer);
            document.body.appendChild(overlay);

            const ctx = canvas.getContext('2d');
            const SLOT_SIZE = 40;
            const cols = 10;
            const padding = 12;
            const slotGap = 2;
            const shopInv = shop.inventory || [];

            // Preload item images then draw
            const itemImages = {};
            let imagesToLoad = 0;
            let imagesLoaded = 0;

            shopInv.forEach(inv => {
                const item = items[inv.itemIndex];
                if (item && item.spriteData && !itemImages[inv.itemIndex]) {
                    imagesToLoad++;
                    const img = new Image();
                    img.onload = () => {
                        imagesLoaded++;
                        itemImages[inv.itemIndex] = img;
                        if (imagesLoaded >= imagesToLoad) drawPreview();
                    };
                    img.onerror = () => {
                        imagesLoaded++;
                        if (imagesLoaded >= imagesToLoad) drawPreview();
                    };
                    img.src = item.spriteData;
                }
            });

            // Draw immediately if no images to load
            if (imagesToLoad === 0) drawPreview();

            function drawPreview() {
                // Get custom styles or defaults
                const style = shop.uiStyle || {
                    borderColor: '#ffaa00',
                    panelBg: '#1e1e28',
                    forSaleBg: '#284028',
                    inventoryBg: '#1e1e32',
                    cartBg: '#32281e',
                    textColor: '#ffffff',
                    accentColor: '#ffaa00'
                };

                // Background
                ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const shopRows = Math.max(2, Math.ceil(shopInv.length / cols));
                const playerRows = 4;
                const sectionH = playerRows * SLOT_SIZE + (playerRows - 1) * slotGap + 30;
                const shopSectionH = shopRows * SLOT_SIZE + (shopRows - 1) * slotGap + 30;

                const panelW = cols * SLOT_SIZE + (cols - 1) * slotGap + padding * 2 + 100;
                const panelH = shopSectionH + sectionH + 80;
                const panelX = (canvas.width - panelW) / 2;
                const panelY = (canvas.height - panelH) / 2;

                // Main panel
                ctx.fillStyle = style.panelBg;
                ctx.fillRect(panelX, panelY, panelW, panelH);
                ctx.strokeStyle = style.borderColor;
                ctx.lineWidth = 3;
                ctx.strokeRect(panelX, panelY, panelW, panelH);

                // Header
                ctx.fillStyle = style.accentColor;
                ctx.font = 'bold 16px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(shop.name || 'Shop', panelX + panelW / 2, panelY + 22);

                // Gold display
                ctx.fillStyle = '#fc0';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('Gold: 100', panelX + 15, panelY + 22);

                // Shop inventory section
                const shopAreaX = panelX + padding;
                const shopAreaY = panelY + 35;
                const shopAreaW = panelW - padding * 2 - 90;

                ctx.fillStyle = style.forSaleBg;
                ctx.fillRect(shopAreaX, shopAreaY, shopAreaW, shopSectionH);
                ctx.strokeStyle = '#4a7c59';
                ctx.lineWidth = 2;
                ctx.strokeRect(shopAreaX, shopAreaY, shopAreaW, shopSectionH);

                ctx.fillStyle = '#8f8';
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('FOR SALE', shopAreaX + 8, shopAreaY + 16);

                // Draw shop item slots
                for (let i = 0; i < Math.max(shopInv.length, cols * 2); i++) {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    if (row >= shopRows) break;

                    const slotX = shopAreaX + padding + col * (SLOT_SIZE + slotGap);
                    const slotY = shopAreaY + 22 + row * (SLOT_SIZE + slotGap);

                    const inv = shopInv[i];
                    ctx.fillStyle = inv ? '#2a3a2a' : '#1a1a1a';
                    ctx.fillRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                    ctx.strokeStyle = inv ? '#4a5a4a' : '#333';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);

                    if (inv) {
                        const item = items[inv.itemIndex];
                        const img = itemImages[inv.itemIndex];

                        // Draw item sprite if available
                        if (img && item && item.frames && item.frames.length > 0) {
                            const frame = item.frames[item.idleFrame || 0];
                            if (frame) {
                                const scale = Math.min((SLOT_SIZE - 4) / frame.w, (SLOT_SIZE - 4) / frame.h);
                                const drawW = frame.w * scale;
                                const drawH = frame.h * scale;
                                const drawX = slotX + (SLOT_SIZE - drawW) / 2;
                                const drawY = slotY + (SLOT_SIZE - drawH) / 2;
                                ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
                            }
                        } else {
                            // Fallback to name abbreviation
                            ctx.fillStyle = '#fff';
                            ctx.font = '9px monospace';
                            ctx.textAlign = 'center';
                            const abbrev = item ? item.name.substring(0, 4) : '?';
                            ctx.fillText(abbrev, slotX + SLOT_SIZE/2, slotY + SLOT_SIZE/2 + 3);
                        }

                        // Price below
                        ctx.fillStyle = '#fc0';
                        ctx.font = '9px monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText(inv.buyPrice + 'g', slotX + SLOT_SIZE/2, slotY + SLOT_SIZE + 10);
                    }
                }

                // Player inventory section
                const invAreaX = panelX + padding;
                const invAreaY = shopAreaY + shopSectionH + 8;

                ctx.fillStyle = style.inventoryBg;
                ctx.fillRect(invAreaX, invAreaY, shopAreaW, sectionH);
                ctx.strokeStyle = '#557';
                ctx.lineWidth = 2;
                ctx.strokeRect(invAreaX, invAreaY, shopAreaW, sectionH);

                ctx.fillStyle = '#aaf';
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('YOUR INVENTORY', invAreaX + 8, invAreaY + 16);

                // Draw empty player inventory slots
                for (let i = 0; i < cols * playerRows; i++) {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    const slotX = invAreaX + padding + col * (SLOT_SIZE + slotGap);
                    const slotY = invAreaY + 22 + row * (SLOT_SIZE + slotGap);

                    ctx.fillStyle = i < 10 ? '#3a3a4a' : '#333';
                    ctx.fillRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                    ctx.strokeStyle = i < 10 ? '#666' : '#444';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                }

                // Cart area
                const cartX = shopAreaX + shopAreaW + 8;
                const cartY = shopAreaY;
                const cartW = 80;
                const cartH = shopSectionH + sectionH + 8;

                ctx.fillStyle = style.cartBg;
                ctx.fillRect(cartX, cartY, cartW, cartH);
                ctx.strokeStyle = '#a86';
                ctx.lineWidth = 2;
                ctx.strokeRect(cartX, cartY, cartW, cartH);

                ctx.fillStyle = '#fa8';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('CART', cartX + cartW/2, cartY + 16);

                ctx.fillStyle = '#666';
                ctx.font = '10px monospace';
                ctx.fillText('Cart empty', cartX + cartW/2, cartY + cartH/2);

                // Confirm button area
                const btnY = panelY + panelH - 35;
                ctx.fillStyle = '#4a4';
                ctx.fillRect(panelX + panelW/2 - 50, btnY, 100, 25);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('CONFIRM', panelX + panelW/2, btnY + 17);

                // Preview label
                ctx.fillStyle = '#888';
                ctx.font = '10px monospace';
                ctx.fillText('[ PREVIEW ]', panelX + panelW/2, panelY + panelH - 8);
            }
        }

        function openShopUIEditor() {
            if (editingShopIndex < 0) return;
            const shop = shops[editingShopIndex];
            if (!shop) return;

            // Initialize uiStyle if not present
            if (!shop.uiStyle) {
                shop.uiStyle = {
                    borderColor: '#ffaa00',
                    panelBg: '#1e1e28',
                    forSaleBg: '#284028',
                    inventoryBg: '#1e1e32',
                    cartBg: '#32281e',
                    textColor: '#ffffff',
                    accentColor: '#ffaa00'
                };
            }

            // Store original values for cancel
            const originalStyle = JSON.parse(JSON.stringify(shop.uiStyle));

            const overlay = document.createElement('div');
            overlay.id = 'shopUIEditorOverlay';
            overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.95); z-index:3000; display:flex; justify-content:center; align-items:center; gap:30px;';

            // Left panel - controls
            const controlPanel = document.createElement('div');
            controlPanel.style.cssText = 'background:#2a2a2a; padding:20px; border-radius:8px; border:2px solid #448; width:280px;';
            controlPanel.innerHTML = `
                <h3 style="margin:0 0 15px 0; color:#4af;">Shop UI Style</h3>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <label style="color:#aaa; font-size:11px;">Border:
                        <input type="color" id="shopUIBorder" value="${shop.uiStyle.borderColor}" style="width:100%; height:28px; margin-top:4px; cursor:pointer;">
                    </label>
                    <label style="color:#aaa; font-size:11px;">Panel BG:
                        <input type="color" id="shopUIPanel" value="${shop.uiStyle.panelBg}" style="width:100%; height:28px; margin-top:4px; cursor:pointer;">
                    </label>
                    <label style="color:#aaa; font-size:11px;">For Sale:
                        <input type="color" id="shopUIForSale" value="${shop.uiStyle.forSaleBg}" style="width:100%; height:28px; margin-top:4px; cursor:pointer;">
                    </label>
                    <label style="color:#aaa; font-size:11px;">Inventory:
                        <input type="color" id="shopUIInventory" value="${shop.uiStyle.inventoryBg}" style="width:100%; height:28px; margin-top:4px; cursor:pointer;">
                    </label>
                    <label style="color:#aaa; font-size:11px;">Cart:
                        <input type="color" id="shopUICart" value="${shop.uiStyle.cartBg}" style="width:100%; height:28px; margin-top:4px; cursor:pointer;">
                    </label>
                    <label style="color:#aaa; font-size:11px;">Accent:
                        <input type="color" id="shopUIAccent" value="${shop.uiStyle.accentColor}" style="width:100%; height:28px; margin-top:4px; cursor:pointer;">
                    </label>
                </div>
                <div style="margin-top:20px; display:flex; flex-direction:column; gap:8px;">
                    <button id="shopUIReset" style="padding:10px; background:#633; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">Reset to Defaults</button>
                    <div style="display:flex; gap:8px;">
                        <button id="shopUICancel" style="flex:1; padding:10px; background:#444; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">Cancel</button>
                        <button id="shopUISave" style="flex:1; padding:10px; background:#484; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">Save</button>
                    </div>
                </div>
            `;

            // Right panel - live preview canvas
            const previewPanel = document.createElement('div');
            previewPanel.style.cssText = 'display:flex; flex-direction:column; align-items:center;';

            const previewLabel = document.createElement('div');
            previewLabel.style.cssText = 'color:#888; font-size:12px; margin-bottom:8px;';
            previewLabel.textContent = 'Live Preview';

            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 450;
            canvas.style.cssText = 'border:2px solid #fa0; border-radius:4px;';

            previewPanel.appendChild(previewLabel);
            previewPanel.appendChild(canvas);

            overlay.appendChild(controlPanel);
            overlay.appendChild(previewPanel);
            document.body.appendChild(overlay);

            const ctx = canvas.getContext('2d');
            const SLOT_SIZE = 40;
            const cols = 10;
            const padding = 12;
            const slotGap = 2;
            const shopInv = shop.inventory || [];

            // Preload item images
            const itemImages = {};
            let imagesToLoad = 0;
            let imagesLoaded = 0;

            shopInv.forEach(inv => {
                const item = items[inv.itemIndex];
                if (item && item.spriteData && !itemImages[inv.itemIndex]) {
                    imagesToLoad++;
                    const img = new Image();
                    img.onload = () => {
                        imagesLoaded++;
                        itemImages[inv.itemIndex] = img;
                        if (imagesLoaded >= imagesToLoad) drawPreview();
                    };
                    img.onerror = () => {
                        imagesLoaded++;
                        if (imagesLoaded >= imagesToLoad) drawPreview();
                    };
                    img.src = item.spriteData;
                }
            });

            if (imagesToLoad === 0) drawPreview();

            function drawPreview() {
                const style = {
                    borderColor: document.getElementById('shopUIBorder').value,
                    panelBg: document.getElementById('shopUIPanel').value,
                    forSaleBg: document.getElementById('shopUIForSale').value,
                    inventoryBg: document.getElementById('shopUIInventory').value,
                    cartBg: document.getElementById('shopUICart').value,
                    textColor: '#ffffff',
                    accentColor: document.getElementById('shopUIAccent').value
                };

                ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const shopRows = Math.max(2, Math.ceil(shopInv.length / cols));
                const playerRows = 4;
                const sectionH = playerRows * SLOT_SIZE + (playerRows - 1) * slotGap + 30;
                const shopSectionH = shopRows * SLOT_SIZE + (shopRows - 1) * slotGap + 30;

                const panelW = cols * SLOT_SIZE + (cols - 1) * slotGap + padding * 2 + 100;
                const panelH = shopSectionH + sectionH + 80;
                const panelX = (canvas.width - panelW) / 2;
                const panelY = (canvas.height - panelH) / 2;

                // Main panel
                ctx.fillStyle = style.panelBg;
                ctx.fillRect(panelX, panelY, panelW, panelH);
                ctx.strokeStyle = style.borderColor;
                ctx.lineWidth = 3;
                ctx.strokeRect(panelX, panelY, panelW, panelH);

                // Header
                ctx.fillStyle = style.accentColor;
                ctx.font = 'bold 16px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(shop.name || 'Shop', panelX + panelW / 2, panelY + 22);

                ctx.fillStyle = '#fc0';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('Gold: 100', panelX + 15, panelY + 22);

                // Shop inventory section
                const shopAreaX = panelX + padding;
                const shopAreaY = panelY + 35;
                const shopAreaW = panelW - padding * 2 - 90;

                ctx.fillStyle = style.forSaleBg;
                ctx.fillRect(shopAreaX, shopAreaY, shopAreaW, shopSectionH);
                ctx.strokeStyle = '#4a7c59';
                ctx.lineWidth = 2;
                ctx.strokeRect(shopAreaX, shopAreaY, shopAreaW, shopSectionH);

                ctx.fillStyle = '#8f8';
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('FOR SALE', shopAreaX + 8, shopAreaY + 16);

                for (let i = 0; i < Math.max(shopInv.length, cols * 2); i++) {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    if (row >= shopRows) break;

                    const slotX = shopAreaX + padding + col * (SLOT_SIZE + slotGap);
                    const slotY = shopAreaY + 22 + row * (SLOT_SIZE + slotGap);

                    const inv = shopInv[i];
                    ctx.fillStyle = inv ? '#2a3a2a' : '#1a1a1a';
                    ctx.fillRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                    ctx.strokeStyle = inv ? '#4a5a4a' : '#333';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);

                    if (inv) {
                        const item = items[inv.itemIndex];
                        const img = itemImages[inv.itemIndex];

                        if (img && item && item.frames && item.frames.length > 0) {
                            const frame = item.frames[item.idleFrame || 0];
                            if (frame) {
                                const scale = Math.min((SLOT_SIZE - 4) / frame.w, (SLOT_SIZE - 4) / frame.h);
                                const drawW = frame.w * scale;
                                const drawH = frame.h * scale;
                                const drawX = slotX + (SLOT_SIZE - drawW) / 2;
                                const drawY = slotY + (SLOT_SIZE - drawH) / 2;
                                ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
                            }
                        } else {
                            ctx.fillStyle = '#fff';
                            ctx.font = '9px monospace';
                            ctx.textAlign = 'center';
                            const abbrev = item ? item.name.substring(0, 4) : '?';
                            ctx.fillText(abbrev, slotX + SLOT_SIZE/2, slotY + SLOT_SIZE/2 + 3);
                        }

                        ctx.fillStyle = '#fc0';
                        ctx.font = '9px monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText(inv.buyPrice + 'g', slotX + SLOT_SIZE/2, slotY + SLOT_SIZE + 10);
                    }
                }

                // Player inventory section
                const invAreaX = panelX + padding;
                const invAreaY = shopAreaY + shopSectionH + 8;

                ctx.fillStyle = style.inventoryBg;
                ctx.fillRect(invAreaX, invAreaY, shopAreaW, sectionH);
                ctx.strokeStyle = '#557';
                ctx.lineWidth = 2;
                ctx.strokeRect(invAreaX, invAreaY, shopAreaW, sectionH);

                ctx.fillStyle = '#aaf';
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('YOUR INVENTORY', invAreaX + 8, invAreaY + 16);

                for (let i = 0; i < cols * playerRows; i++) {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    const slotX = invAreaX + padding + col * (SLOT_SIZE + slotGap);
                    const slotY = invAreaY + 22 + row * (SLOT_SIZE + slotGap);

                    ctx.fillStyle = i < 10 ? '#3a3a4a' : '#333';
                    ctx.fillRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                    ctx.strokeStyle = i < 10 ? '#666' : '#444';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(slotX, slotY, SLOT_SIZE, SLOT_SIZE);
                }

                // Cart area
                const cartX = shopAreaX + shopAreaW + 8;
                const cartY = shopAreaY;
                const cartW = 80;
                const cartH = shopSectionH + sectionH + 8;

                ctx.fillStyle = style.cartBg;
                ctx.fillRect(cartX, cartY, cartW, cartH);
                ctx.strokeStyle = '#a86';
                ctx.lineWidth = 2;
                ctx.strokeRect(cartX, cartY, cartW, cartH);

                ctx.fillStyle = '#fa8';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('CART', cartX + cartW/2, cartY + 16);

                ctx.fillStyle = '#666';
                ctx.font = '10px monospace';
                ctx.fillText('Cart empty', cartX + cartW/2, cartY + cartH/2);

                const btnY = panelY + panelH - 35;
                ctx.fillStyle = '#4a4';
                ctx.fillRect(panelX + panelW/2 - 50, btnY, 100, 25);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('CONFIRM', panelX + panelW/2, btnY + 17);
            }

            // Add live update listeners to all color pickers
            ['shopUIBorder', 'shopUIPanel', 'shopUIForSale', 'shopUIInventory', 'shopUICart', 'shopUIAccent'].forEach(id => {
                document.getElementById(id).oninput = drawPreview;
            });

            document.getElementById('shopUICancel').onclick = () => {
                shop.uiStyle = originalStyle;
                overlay.remove();
            };

            document.getElementById('shopUIReset').onclick = () => {
                const defaults = {
                    borderColor: '#ffaa00',
                    panelBg: '#1e1e28',
                    forSaleBg: '#284028',
                    inventoryBg: '#1e1e32',
                    cartBg: '#32281e',
                    textColor: '#ffffff',
                    accentColor: '#ffaa00'
                };
                document.getElementById('shopUIBorder').value = defaults.borderColor;
                document.getElementById('shopUIPanel').value = defaults.panelBg;
                document.getElementById('shopUIForSale').value = defaults.forSaleBg;
                document.getElementById('shopUIInventory').value = defaults.inventoryBg;
                document.getElementById('shopUICart').value = defaults.cartBg;
                document.getElementById('shopUIAccent').value = defaults.accentColor;
                drawPreview();
            };

            document.getElementById('shopUISave').onclick = () => {
                shop.uiStyle = {
                    borderColor: document.getElementById('shopUIBorder').value,
                    panelBg: document.getElementById('shopUIPanel').value,
                    forSaleBg: document.getElementById('shopUIForSale').value,
                    inventoryBg: document.getElementById('shopUIInventory').value,
                    cartBg: document.getElementById('shopUICart').value,
                    textColor: '#ffffff',
                    accentColor: document.getElementById('shopUIAccent').value
                };
                overlay.remove();
            };
        }

        function renderShopInventoryEditor() {
            const container = document.getElementById('shopInventoryList');
            if (!container || editingShopIndex < 0) return;

            const shop = shops[editingShopIndex];
            const inventory = shop.inventory || [];

            if (inventory.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px; text-align:center; padding:5px;">No items for sale</div>';
                return;
            }

            // Column headers
            let html = '<div style="display:flex; justify-content:space-between; align-items:center; padding:2px 4px; font-size:9px; color:#888; border-bottom:1px solid #444;">' +
                '<span style="flex:1;">Item</span>' +
                '<span style="width:50px; text-align:center; margin:0 4px;">Price</span>' +
                '<span style="width:40px; text-align:center; margin:0 4px;">Stock</span>' +
                '<span style="width:26px;"></span>' +
                '</div>';

            html += inventory.map((inv, i) => {
                const item = items[inv.itemIndex];
                const itemName = item ? item.name : '(Unknown)';
                return '<div style="display:flex; justify-content:space-between; align-items:center; padding:4px; margin:2px 0; background:#333; border-radius:3px; font-size:10px;">' +
                    '<span style="flex:1; color:#fff;">' + itemName + '</span>' +
                    '<input type="number" value="' + (inv.buyPrice || 0) + '" onchange="updateShopInventoryPrice(' + i + ', this.value)" style="width:50px; margin:0 4px; text-align:center;">' +
                    '<input type="number" value="' + (inv.stock === -1 ? -1 : (inv.stock || 1)) + '" onchange="updateShopInventoryStock(' + i + ', this.value)" style="width:40px; margin:0 4px; text-align:center;">' +
                    '<button onclick="removeShopInventoryItem(' + i + ')" style="padding:2px 6px; font-size:9px; background:#a55;">×</button>' +
                '</div>';
            }).join('');

            container.innerHTML = html;
        }

        function updateShopInventoryPrice(index, value) {
            if (editingShopIndex < 0) return;
            const shop = shops[editingShopIndex];
            if (shop.inventory && shop.inventory[index]) {
                shop.inventory[index].buyPrice = parseInt(value) || 0;
            }
        }

        function updateShopInventoryStock(index, value) {
            if (editingShopIndex < 0) return;
            const shop = shops[editingShopIndex];
            if (shop.inventory && shop.inventory[index]) {
                shop.inventory[index].stock = parseInt(value);
            }
        }

        function removeShopInventoryItem(index) {
            if (editingShopIndex < 0) return;
            const shop = shops[editingShopIndex];
            if (shop.inventory) {
                shop.inventory.splice(index, 1);
                renderShopInventoryEditor();
            }
        }

        function shopAddInventoryItem() {
            if (editingShopIndex < 0) return;
            const select = document.getElementById('shopAddItemSelect');
            const priceInput = document.getElementById('shopAddItemPrice');
            const stockInput = document.getElementById('shopAddItemStock');
            const itemIndex = parseInt(select.value);
            if (isNaN(itemIndex) || itemIndex < 0) return;

            const shop = shops[editingShopIndex];
            if (!shop.inventory) shop.inventory = [];
            if (!shop.buyList) shop.buyList = [];

            // Check if item already exists
            if (shop.inventory.find(inv => inv.itemIndex === itemIndex)) {
                alert('This item is already in the shop inventory');
                return;
            }

            // Get values from inputs
            const buyPrice = parseInt(priceInput.value) || 10;
            const stock = parseInt(stockInput.value);

            shop.inventory.push({
                itemIndex: itemIndex,
                buyPrice: buyPrice,
                stock: isNaN(stock) ? -1 : stock
            });

            // Auto-add to buyList if not already there (shop will also buy this item)
            if (!shop.buyList.find(b => b.itemIndex === itemIndex)) {
                const sellRate = shop.defaultSellRate || 50;
                const sellPrice = Math.floor(buyPrice * sellRate / 100);
                shop.buyList.push({
                    itemIndex: itemIndex,
                    sellPrice: sellPrice
                });
                renderShopBuyListEditor();
            }

            renderShopInventoryEditor();
            select.value = '';
        }

        function renderShopBuyListEditor() {
            const container = document.getElementById('shopBuyList');
            if (!container || editingShopIndex < 0) return;

            const shop = shops[editingShopIndex];
            const buyList = shop.buyList || [];

            if (buyList.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px; text-align:center; padding:5px;">Shop doesn\'t buy anything</div>';
                return;
            }

            // Column headers
            let html = '<div style="display:flex; justify-content:space-between; align-items:center; padding:2px 4px; font-size:9px; color:#888; border-bottom:1px solid #444;">' +
                '<span style="flex:1;">Item</span>' +
                '<span style="width:50px; text-align:center; margin:0 4px;">Pays</span>' +
                '<span style="width:26px;"></span>' +
                '</div>';

            html += buyList.map((buy, i) => {
                const item = items[buy.itemIndex];
                const itemName = item ? item.name : '(Unknown)';
                return '<div style="display:flex; justify-content:space-between; align-items:center; padding:4px; margin:2px 0; background:#333; border-radius:3px; font-size:10px;">' +
                    '<span style="flex:1; color:#fff;">' + itemName + '</span>' +
                    '<input type="number" value="' + (buy.sellPrice || 0) + '" onchange="updateShopBuyPrice(' + i + ', this.value)" style="width:50px; margin:0 4px; text-align:center;">' +
                    '<button onclick="removeShopBuyItem(' + i + ')" style="padding:2px 6px; font-size:9px; background:#a55;">×</button>' +
                '</div>';
            }).join('');

            container.innerHTML = html;
        }

        function updateShopBuyPrice(index, value) {
            if (editingShopIndex < 0) return;
            const shop = shops[editingShopIndex];
            if (shop.buyList && shop.buyList[index]) {
                shop.buyList[index].sellPrice = parseInt(value) || 0;
            }
        }

        function removeShopBuyItem(index) {
            if (editingShopIndex < 0) return;
            const shop = shops[editingShopIndex];
            if (shop.buyList) {
                shop.buyList.splice(index, 1);
                renderShopBuyListEditor();
            }
        }

        function shopAddBuyListItem() {
            if (editingShopIndex < 0) return;
            const select = document.getElementById('shopAddBuyItemSelect');
            const priceInput = document.getElementById('shopAddBuyItemPrice');
            const itemIndex = parseInt(select.value);
            if (isNaN(itemIndex) || itemIndex < 0) return;

            const shop = shops[editingShopIndex];
            if (!shop.buyList) shop.buyList = [];

            // Check if item already exists
            if (shop.buyList.find(b => b.itemIndex === itemIndex)) {
                alert('This item is already in the buy list');
                return;
            }

            // Get price from input
            const sellPrice = parseInt(priceInput.value) || 5;

            shop.buyList.push({
                itemIndex: itemIndex,
                sellPrice: sellPrice
            });

            renderShopBuyListEditor();
            select.value = '';
        }

        function updateShopItemDropdowns() {
            const addItemSelect = document.getElementById('shopAddItemSelect');
            const addBuySelect = document.getElementById('shopAddBuyItemSelect');

            let options = '<option value="">(Select item)</option>';
            items.forEach((item, i) => {
                options += '<option value="' + i + '">' + (item.name || 'Item ' + i) + '</option>';
            });

            if (addItemSelect) addItemSelect.innerHTML = options;
            if (addBuySelect) addBuySelect.innerHTML = options;
        }

        function updateStartingGold(value) {
            startingGold = parseInt(value) || 100;
            broadcastEdit({ editType: 'updateStartingGold', value: startingGold });
        }

        // NPC Shop attachment functions
        function updateNpcShopDropdown() {
            const select = document.getElementById('npcShopSelect');
            if (!select) return;

            let options = '<option value="-1">(None)</option>';
            shops.forEach((shop, i) => {
                options += '<option value="' + i + '">' + (shop.name || 'Shop ' + i) + '</option>';
            });
            select.innerHTML = options;
        }

        function updateNpcShopInfo(placed) {
            const info = document.getElementById('npcShopInfo');
            if (!info) return;

            if (placed.shopIndex >= 0 && placed.shopIndex < shops.length) {
                const shop = shops[placed.shopIndex];
                info.innerHTML = '<span style="color:#fa0;">' + (shop.name || 'Shop') + '</span> - ' +
                    (shop.inventory?.length || 0) + ' items';
            } else {
                info.textContent = '(No shop attached)';
            }
        }

        function attachShopToNpc() {
            if (selectedPlacedNpcIndex < 0) return;
            const placed = placedNpcs[selectedPlacedNpcIndex];
            const select = document.getElementById('npcShopSelect');
            const shopIndex = parseInt(select.value);

            placed.shopIndex = shopIndex;

            broadcastEdit({
                editType: 'updatePlacedNpc',
                index: selectedPlacedNpcIndex,
                npc: placed
            });

            updateNpcShopInfo(placed);
            if (mode === 'shop') {
                updateNpcShopList();
            }
            renderMap(); // Re-render to show shop indicator
        }
