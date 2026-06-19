        // === SHOP SYSTEM (Test Game) ===
        // playerGold already loaded above with projectData.startingGold
        let shopOpen = false;       // Is shop UI open
        let activeShopIndex = -1;   // Index of currently open shop
        let shopTab = 'buy';        // 'buy' or 'sell'
        let shopSelectedIndex = 0;  // Selected item in shop list
        // shops already loaded above with projectData.shops

        // Initialize empty inventory slots
        function initInventory() {
            inventorySlots = [];
            for (let i = 0; i < INVENTORY_SIZE; i++) {
                inventorySlots.push(null);
            }
            cursorItem = null;
            inventoryOpen = false;
            selectedHotbarSlot = 0;
            console.log('[INVENTORY] Initialized with', INVENTORY_SIZE, 'slots');
        }

        // Get max stack size for an item (default 99)
        function getMaxStack(itemIndex) {
            const item = itemsData[itemIndex];
            return item?.maxStack || 99;
        }

        // Find slot with existing stack that has room
        function getStackableSlot(itemIndex) {
            const maxStack = getMaxStack(itemIndex);
            for (let i = 0; i < inventorySlots.length; i++) {
                const slot = inventorySlots[i];
                if (slot && slot.itemIndex === itemIndex && slot.quantity < maxStack) {
                    return i;
                }
            }
            return -1;
        }

        // Find first empty slot
        function getEmptySlot() {
            for (let i = 0; i < inventorySlots.length; i++) {
                if (inventorySlots[i] === null) {
                    return i;
                }
            }
            return -1;
        }

        // Add item to inventory - returns true if successful
        function addToInventory(itemIndex, quantity = 1) {
            const maxStack = getMaxStack(itemIndex);
            let remaining = quantity;

            // First, try to stack with existing items
            while (remaining > 0) {
                const stackSlot = getStackableSlot(itemIndex);
                if (stackSlot >= 0) {
                    const slot = inventorySlots[stackSlot];
                    const canAdd = Math.min(remaining, maxStack - slot.quantity);
                    slot.quantity += canAdd;
                    remaining -= canAdd;
                } else {
                    break;
                }
            }

            // Then, put remaining in empty slots
            while (remaining > 0) {
                const emptySlot = getEmptySlot();
                if (emptySlot >= 0) {
                    const toAdd = Math.min(remaining, maxStack);
                    inventorySlots[emptySlot] = { itemIndex: itemIndex, quantity: toAdd };
                    remaining -= toAdd;
                } else {
                    console.log('[INVENTORY] Full! Could not add', remaining, 'items');
                    return false; // Inventory full
                }
            }

            const item = itemsData[itemIndex];
            // Auto-equip the first weapon/ability picked up so the attack button works immediately.
            if (item && item.behavior && item.behavior !== 'none') {
                const activeSlot = inventorySlots[selectedHotbarSlot];
                const activeDef = activeSlot ? itemsData[activeSlot.itemIndex] : null;
                const activeUsable = activeDef && activeDef.behavior && activeDef.behavior !== 'none';
                if (!activeUsable) {
                    for (let s = 0; s < 10 && s < inventorySlots.length; s++) {
                        if (inventorySlots[s] && inventorySlots[s].itemIndex === itemIndex) { selectedHotbarSlot = s; break; }
                    }
                }
            }
            console.log('[INVENTORY] Added', quantity, 'x', item?.name || 'Item ' + itemIndex);
            return true;
        }

        // Remove items from a specific slot
        function removeFromSlot(slotIndex, quantity = 1) {
            if (slotIndex < 0 || slotIndex >= inventorySlots.length) return false;
            const slot = inventorySlots[slotIndex];
            if (!slot) return false;

            slot.quantity -= quantity;
            if (slot.quantity <= 0) {
                inventorySlots[slotIndex] = null;
            }
            return true;
        }

        // Get item in selected hotbar slot
        function getSelectedItem() {
            if (selectedHotbarSlot < 0 || selectedHotbarSlot >= HOTBAR_SIZE) return null;
            return inventorySlots[selectedHotbarSlot];
        }

        // Remove item by itemIndex (for quest rewards) - removes from first stack found
        function removeFromInventory(itemIndex, quantity = 1) {
            let remaining = quantity;
            for (let i = 0; i < inventorySlots.length && remaining > 0; i++) {
                const slot = inventorySlots[i];
                if (slot && slot.itemIndex === itemIndex) {
                    const toRemove = Math.min(remaining, slot.quantity);
                    slot.quantity -= toRemove;
                    remaining -= toRemove;
                    if (slot.quantity <= 0) {
                        inventorySlots[i] = null;
                    }
                }
            }
            return remaining === 0;
        }

        // Check if player has item in inventory
        function hasItem(itemIndex, quantity = 1) {
            let count = 0;
            for (const slot of inventorySlots) {
                if (slot && slot.itemIndex === itemIndex) {
                    count += slot.quantity;
                    if (count >= quantity) return true;
                }
            }
            return false;
        }

        // Convert itemId (string like "item_0") to numeric index
        function itemIdToIndex(itemId) {
            if (typeof itemId === 'number') return itemId;
            if (typeof itemId === 'string') {
                // Try "item_N" format first
                if (itemId.startsWith('item_')) {
                    return parseInt(itemId.substring(5));
                }
                // Try direct number string
                const parsed = parseInt(itemId);
                if (!isNaN(parsed)) return parsed;
                // Search by id property
                for (let i = 0; i < itemsData.length; i++) {
                    if (itemsData[i].id === itemId) return i;
                }
            }
            return -1;
        }

        // Initialize inventory on game start
        initInventory();

        // Debug: log all received triggers
        console.log('=== TEST GAME RECEIVED TRIGGERS ===');
        placedTriggers.forEach((t, i) => {
            console.log('Trigger ' + i + ': Door ' + t.doorNumber + ' at (' + t.x + ',' + t.y + ') on "' + t.mapName + '" -> "' + t.targetMap + '" spawn (' + t.targetX + ',' + t.targetY + ')');
        });

        // Listen for streamed sound data from builder (mobile only)
        if (soundsWillStream) {
            console.log('Waiting for sound data to stream from builder...');
            window.addEventListener('message', function(e) {
                if (e.data && e.data.type === 'sound-data') {
                    const { index, data, name } = e.data;
                    if (soundsData[index]) {
                        soundsData[index].data = data;
                        soundsStreamedCount++;
                        console.log('Received sound', index, name, '(' + soundsStreamedCount + '/' + soundsData.length + ')');
                    }
                } else if (e.data && e.data.type === 'sounds-complete') {
                    console.log('All sounds received from builder');
                }
            });
        }
