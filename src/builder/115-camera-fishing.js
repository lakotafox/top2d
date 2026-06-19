        // ===== CAMERA BOUNDS =====
        let settingCameraBounds = false;
        let cameraBoundsDragStart = null;
        let cameraBoundsDragEnd = null;

        function toggleCameraBoundsMode() {
            settingCameraBounds = !settingCameraBounds;
            const btn = document.getElementById('setCameraBoundsBtn');
            if (settingCameraBounds) {
                btn.textContent = '✓ Done';
                btn.style.background = '#8a4';
            } else {
                btn.textContent = 'Set Bounds';
                btn.style.background = '#484';
                cameraBoundsDragStart = null;
                cameraBoundsDragEnd = null;
            }
            updateCameraBoundsInfo();
            renderMap();
        }

        function clearCameraBounds(fromNetwork = false) {
            cameraBounds = null;
            cameraBoundsDragStart = null;
            cameraBoundsDragEnd = null;
            settingCameraBounds = false;
            document.getElementById('setCameraBoundsBtn').textContent = 'Set Bounds';
            document.getElementById('setCameraBoundsBtn').style.background = '#484';
            if (!fromNetwork) {
                broadcastEdit({ editType: 'cameraBounds', bounds: null, mapName: currentMapName });
            }
            updateCameraBoundsInfo();
            renderMap();
        }

        function setCameraBoundsFromDrag() {
            if (!cameraBoundsDragStart || !cameraBoundsDragEnd) return;

            const x1 = Math.min(cameraBoundsDragStart.x, cameraBoundsDragEnd.x);
            const y1 = Math.min(cameraBoundsDragStart.y, cameraBoundsDragEnd.y);
            const x2 = Math.max(cameraBoundsDragStart.x, cameraBoundsDragEnd.x);
            const y2 = Math.max(cameraBoundsDragStart.y, cameraBoundsDragEnd.y);

            if (cameraBounds) {
                // Expand existing bounds to include new selection
                const oldX2 = cameraBounds.x + cameraBounds.width - 1;
                const oldY2 = cameraBounds.y + cameraBounds.height - 1;
                const newX1 = Math.min(cameraBounds.x, x1);
                const newY1 = Math.min(cameraBounds.y, y1);
                const newX2 = Math.max(oldX2, x2);
                const newY2 = Math.max(oldY2, y2);

                cameraBounds = {
                    x: newX1,
                    y: newY1,
                    width: newX2 - newX1 + 1,
                    height: newY2 - newY1 + 1
                };
            } else {
                // First selection
                cameraBounds = {
                    x: x1,
                    y: y1,
                    width: x2 - x1 + 1,
                    height: y2 - y1 + 1
                };
            }

            console.log('Camera bounds expanded:', cameraBounds);
            broadcastEdit({ editType: 'cameraBounds', bounds: cameraBounds, mapName: currentMapName });

            // Stay in bounds mode for more selections
            cameraBoundsDragStart = null;
            cameraBoundsDragEnd = null;
            updateCameraBoundsInfo();
            renderMap();
        }

        function updateCameraBoundsInfo() {
            const info = document.getElementById('cameraBoundsInfo');
            if (!info) return;

            if (settingCameraBounds) {
                if (cameraBounds) {
                    info.innerHTML = `${cameraBounds.width}x${cameraBounds.height} tiles - drag to expand`;
                } else {
                    info.innerHTML = 'Drag on map to select area';
                }
                info.style.color = '#fa0';
            } else if (cameraBounds) {
                info.innerHTML = `Bounds: ${cameraBounds.width}x${cameraBounds.height} tiles`;
                info.style.color = '#8f8';
            } else {
                info.innerHTML = 'No bounds (camera follows player)';
                info.style.color = '#aaa';
            }
        }

        // ===== FISH ZONES TOOL (mirrors camera bounds, but a per-map ARRAY of zones) =====
        let settingFishZones = false;
        let fishZoneDragStart = null;
        let fishZoneDragEnd = null;

        function toggleFishZonesMode() {
            settingFishZones = !settingFishZones;
            const btn = document.getElementById('setFishZonesBtn');
            if (settingFishZones) {
                if (mode !== 'fish') setMode('fish'); // ensure the map-drag handlers are armed
                btn.textContent = '✓ Done';
                btn.style.background = '#8a4';
            } else {
                btn.textContent = 'Add Zone';
                btn.style.background = '#484';
                fishZoneDragStart = null;
                fishZoneDragEnd = null;
            }
            updateFishZonesInfo();
            renderMap();
        }

        function clearFishZones(fromNetwork = false) {
            fishZones = [];
            fishZoneDragStart = null;
            fishZoneDragEnd = null;
            settingFishZones = false;
            const btn = document.getElementById('setFishZonesBtn');
            if (btn) { btn.textContent = 'Add Zone'; btn.style.background = '#484'; }
            if (!fromNetwork) {
                broadcastEdit({ editType: 'fishZones', zones: [], mapName: currentMapName });
            }
            updateFishZonesInfo();
            renderMap();
        }

        function setFishZoneFromDrag() {
            if (!fishZoneDragStart || !fishZoneDragEnd) return;
            const x1 = Math.min(fishZoneDragStart.x, fishZoneDragEnd.x);
            const y1 = Math.min(fishZoneDragStart.y, fishZoneDragEnd.y);
            const x2 = Math.max(fishZoneDragStart.x, fishZoneDragEnd.x);
            const y2 = Math.max(fishZoneDragStart.y, fishZoneDragEnd.y);

            const nz = { x: x1, y: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 };
            // Like camera bounds: a drag that OVERLAPS existing zone(s) expands/merges them
            // into one big area (great for a whole river); a separate drag makes a new pond.
            const overlaps = (a, b) => a.x <= b.x + b.width - 1 && a.x + a.width - 1 >= b.x && a.y <= b.y + b.height - 1 && a.y + a.height - 1 >= b.y;
            const touched = fishZones.filter(z => overlaps(z, nz));
            if (touched.length) {
                let mx1 = nz.x, my1 = nz.y, mx2 = nz.x + nz.width - 1, my2 = nz.y + nz.height - 1;
                touched.forEach(z => { mx1 = Math.min(mx1, z.x); my1 = Math.min(my1, z.y); mx2 = Math.max(mx2, z.x + z.width - 1); my2 = Math.max(my2, z.y + z.height - 1); });
                fishZones = fishZones.filter(z => !touched.includes(z));
                fishZones.push({ x: mx1, y: my1, width: mx2 - mx1 + 1, height: my2 - my1 + 1 });
            } else {
                fishZones.push(nz);
            }
            broadcastEdit({ editType: 'fishZones', zones: fishZones, mapName: currentMapName });

            fishZoneDragStart = null;
            fishZoneDragEnd = null;
            updateFishZonesInfo();
            renderMap();
        }

        function updateFishZonesInfo() {
            const info = document.getElementById('fishZonesInfo');
            if (!info) return;
            const n = fishZones.length;
            if (settingFishZones) {
                info.innerHTML = n ? `${n} zone${n > 1 ? 's' : ''} - drag to add another` : 'Drag on the map over water';
                info.style.color = '#fa0';
            } else if (n) {
                info.innerHTML = `${n} fish zone${n > 1 ? 's' : ''}`;
                info.style.color = '#8f8';
            } else {
                info.innerHTML = 'No fish zones';
                info.style.color = '#aaa';
            }
        }

        // ===== FISHING LOOT TABLE (project-global) =====
        function renderFishingLoot() {
            const list = document.getElementById('fishingLootList');
            if (!list) return;
            if (!fishingLoot.length) {
                list.innerHTML = '<p style="font-size:10px; color:#666; margin:0;">No catches yet — add items the player can fish up.</p>';
                return;
            }
            const opts = items.map((it, i) => `<option value="${i}">${it.name || ('Item ' + i)}</option>`).join('');
            list.innerHTML = fishingLoot.map((e, idx) =>
                `<div style="display:flex; gap:4px; align-items:center; margin-bottom:4px;">
                    <select onchange="setFishingLootItem(${idx}, this.value)" style="flex:1; font-size:11px; padding:3px;">
                        <option value="-1">— item —</option>${opts}
                    </select>
                    <input type="number" min="1" value="${e.weight || 1}" title="weight (higher = more common)" onchange="setFishingLootWeight(${idx}, this.value)" style="width:48px; font-size:11px; padding:3px;">
                    <button onclick="removeFishingLootRow(${idx})" style="background:#622; color:#fff; border:none; padding:3px 7px; cursor:pointer;">✕</button>
                </div>`
            ).join('');
            const selects = list.querySelectorAll('select');
            fishingLoot.forEach((e, idx) => { if (selects[idx]) selects[idx].value = (e.itemIndex != null ? e.itemIndex : -1); });
        }
        function addFishingLootRow() { fishingLoot.push({ itemIndex: items.length ? 0 : -1, weight: 1 }); renderFishingLoot(); }
        function removeFishingLootRow(i) { fishingLoot.splice(i, 1); renderFishingLoot(); }
        function setFishingLootItem(i, v) { if (fishingLoot[i]) fishingLoot[i].itemIndex = parseInt(v); }
        function setFishingLootWeight(i, v) { if (fishingLoot[i]) fishingLoot[i].weight = Math.max(1, parseInt(v) || 1); }
