        // ===== SOUND MANAGEMENT =====
        function loadSound(event, soundType = 'ambient') {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                const audio = new Audio(e.target.result);
                audio.addEventListener('loadedmetadata', function() {
                    sounds.push({
                        name: file.name,
                        data: e.target.result,
                        duration: audio.duration || 0,
                        type: soundType
                    });
                    updateSoundDropdown();
                    currentSoundIndex = sounds.length - 1;
                    // Update the appropriate dropdown based on type
                    if (soundType === 'ambient') {
                        const selectEl = document.getElementById('soundSelect');
                        const controlsEl = document.getElementById('soundControls');
                        if (selectEl) selectEl.value = currentSoundIndex;
                        if (controlsEl) controlsEl.style.display = 'block';
                    } else if (soundType === 'player') {
                        const selectEl = document.getElementById('playerSoundSelect');
                        if (selectEl) selectEl.value = currentSoundIndex;
                        updatePlayerSoundsList();
                    } else if (soundType === 'music') {
                        updateMusicSoundsList();
                    }
                });
                audio.addEventListener('error', function() {
                    console.error('Failed to load audio metadata');
                    sounds.push({
                        name: file.name,
                        data: e.target.result,
                        duration: 0,
                        type: soundType
                    });
                    updateSoundDropdown();
                    currentSoundIndex = sounds.length - 1;
                    if (soundType === 'ambient') {
                        const selectEl = document.getElementById('soundSelect');
                        const controlsEl = document.getElementById('soundControls');
                        if (selectEl) selectEl.value = currentSoundIndex;
                        if (controlsEl) controlsEl.style.display = 'block';
                    } else if (soundType === 'player') {
                        const selectEl = document.getElementById('playerSoundSelect');
                        if (selectEl) selectEl.value = currentSoundIndex;
                        updatePlayerSoundsList();
                    } else if (soundType === 'music') {
                        updateMusicSoundsList();
                    }
                });
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        }

        function updatePlayerSoundsList() {
            const container = document.getElementById('playerSoundsList');
            if (!container) return;
            const playerSoundsList = sounds.filter(s => s.type === 'player');
            if (playerSoundsList.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px;">No player sounds loaded</div>';
            } else {
                container.innerHTML = playerSoundsList.map((s, i) => {
                    const realIdx = sounds.findIndex(snd => snd === s);
                    return `<div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0; border-bottom:1px solid #333;">
                        <span style="color:#8f8; font-size:10px;">${s.name}</span>
                        <button onclick="deleteSound(${realIdx})" style="padding:1px 5px; font-size:9px; background:#633;">×</button>
                    </div>`;
                }).join('');
            }
        }

        function updateMusicSoundsList() {
            const container = document.getElementById('musicSoundsList');
            if (!container) return;
            const musicList = sounds.filter(s => s.type === 'music');
            if (musicList.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:10px;">No music loaded</div>';
            } else {
                container.innerHTML = musicList.map((s, i) => {
                    const realIdx = sounds.findIndex(snd => snd === s);
                    return `<div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0; border-bottom:1px solid #333;">
                        <span style="color:#fa0; font-size:10px;">${s.name}</span>
                        <button onclick="deleteSound(${realIdx})" style="padding:1px 5px; font-size:9px; background:#633;">×</button>
                    </div>`;
                }).join('');
            }
        }

        function deleteSound(idx) {
            if (idx < 0 || idx >= sounds.length) return;
            if (!confirm('Delete "' + sounds[idx].name + '"?')) return;
            sounds.splice(idx, 1);
            // Update indices in playerSounds
            ['walk', 'attack', 'inventoryOpen', 'inventoryClose'].forEach(action => {
                if (playerSounds[action] && playerSounds[action].soundIndex === idx) {
                    playerSounds[action].soundIndex = -1;
                } else if (playerSounds[action] && playerSounds[action].soundIndex > idx) {
                    playerSounds[action].soundIndex--;
                }
            });
            // Update tileSounds indices
            Object.keys(tileSounds).forEach(key => {
                if (tileSounds[key].soundIndex === idx) {
                    delete tileSounds[key];
                } else if (tileSounds[key].soundIndex > idx) {
                    tileSounds[key].soundIndex--;
                }
            });
            updateSoundDropdown();
            updatePlayerSoundsList();
            updateMusicSoundsList();
            updatePlayerSoundAssignments();
            updatePlacedSoundsList();
        }

        function switchSound() {
            const selectEl = document.getElementById('soundSelect');
            const controlsEl = document.getElementById('soundControls');
            currentSoundIndex = selectEl ? parseInt(selectEl.value) : -1;
            if (controlsEl) controlsEl.style.display = currentSoundIndex >= 0 ? 'block' : 'none';
            stopPreview();
        }

        function updateSoundDropdown() {
            // Update main sound dropdown (ambient only for tile sounds)
            updateFilteredSoundDropdown('soundSelect', 'ambient');
            // Update player sound dropdown
            updateFilteredSoundDropdown('playerSoundSelect', 'player');
            // Update shop music dropdown
            updateFilteredSoundDropdown('shopEditorMusic', 'music');
        }

        function updateFilteredSoundDropdown(selectId, typeFilter) {
            const select = document.getElementById(selectId);
            if (!select) return;
            const currentVal = select.value;
            select.innerHTML = '<option value="-1">-- Select Sound --</option>';
            sounds.forEach((sound, idx) => {
                if (!typeFilter || sound.type === typeFilter) {
                    const opt = document.createElement('option');
                    opt.value = idx;
                    opt.textContent = sound.name;
                    select.appendChild(opt);
                }
            });
            // Restore selection if still valid
            if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
                select.value = currentVal;
            }
        }

        function previewSound() {
            if (currentSoundIndex < 0 || !sounds[currentSoundIndex]) return;
            stopPreview();
            previewAudio = new Audio(sounds[currentSoundIndex].data);
            const volumeEl = document.getElementById('soundVolume');
            previewAudio.volume = volumeEl ? volumeEl.value / 100 : 0.5;
            previewAudio.play();
        }

        function stopPreview() {
            if (previewAudio) {
                previewAudio.pause();
                previewAudio.currentTime = 0;
                previewAudio = null;
            }
        }

        function setSoundAttachMode(attachMode) {
            soundAttachMode = attachMode;
            // Tile mode is now the only mode in Sound tab
            // Player sounds moved to Player tab
            renderMap();
        }

        function assignPlayerSound() {
            const playerSoundSelectEl = document.getElementById('playerSoundSelect');
            const selectedSoundIndex = playerSoundSelectEl ? parseInt(playerSoundSelectEl.value) : -1;

            if (selectedSoundIndex < 0) {
                alert('Select a sound first');
                return;
            }
            const actionEl = document.getElementById('playerActionSelect');
            const volumeEl = document.getElementById('playerSoundVolume');
            const intervalEl = document.getElementById('walkInterval');
            const walkPitchEl = document.getElementById('walkPitch');
            const attackPitchEl = document.getElementById('attackPitch');
            const attackLengthEl = document.getElementById('attackLength');

            const action = actionEl ? actionEl.value : 'walk';
            playerSounds[action].soundIndex = selectedSoundIndex;
            playerSounds[action].volume = volumeEl ? volumeEl.value / 100 : 0.5;
            if (action === 'walk') {
                playerSounds.walk.interval = intervalEl ? parseInt(intervalEl.value) : 200;
                playerSounds.walk.pitchVariation = walkPitchEl ? parseInt(walkPitchEl.value) / 100 : 0.1;
            } else if (action === 'attack') {
                playerSounds.attack.pitchVariation = attackPitchEl ? parseInt(attackPitchEl.value) / 100 : 0.15;
                playerSounds.attack.lengthVariation = attackLengthEl ? parseInt(attackLengthEl.value) / 100 : 0;
            }
            updatePlayerSoundAssignments();
        }

        function updatePlayerSoundAssignments() {
            const container = document.getElementById('playerSoundAssignments');
            if (!container) return;
            let html = '';
            if (playerSounds.walk.soundIndex >= 0) {
                html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span>Walk: ${sounds[playerSounds.walk.soundIndex]?.name || 'Unknown'}</span>
                    <button onclick="clearPlayerSound('walk')" style="background:#a33; border:none; color:#fff; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px;">X</button>
                </div>`;
            }
            if (playerSounds.attack.soundIndex >= 0) {
                html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span>Attack: ${sounds[playerSounds.attack.soundIndex]?.name || 'Unknown'}</span>
                    <button onclick="clearPlayerSound('attack')" style="background:#a33; border:none; color:#fff; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px;">X</button>
                </div>`;
            }
            if (playerSounds.inventoryOpen && playerSounds.inventoryOpen.soundIndex >= 0) {
                html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span>Inv Open: ${sounds[playerSounds.inventoryOpen.soundIndex]?.name || 'Unknown'}</span>
                    <button onclick="clearPlayerSound('inventoryOpen')" style="background:#a33; border:none; color:#fff; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px;">X</button>
                </div>`;
            }
            if (playerSounds.inventoryClose && playerSounds.inventoryClose.soundIndex >= 0) {
                html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span>Inv Close: ${sounds[playerSounds.inventoryClose.soundIndex]?.name || 'Unknown'}</span>
                    <button onclick="clearPlayerSound('inventoryClose')" style="background:#a33; border:none; color:#fff; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px;">X</button>
                </div>`;
            }
            container.innerHTML = html || '<div style="color:#888;">None assigned</div>';
        }

        function clearPlayerSound(action) {
            if (playerSounds[action]) {
                playerSounds[action].soundIndex = -1;
            }
            updatePlayerSoundAssignments();
        }

        function updatePlayerSoundUI() {
            const actionSelect = document.getElementById('playerActionSelect');
            const walkSettings = document.getElementById('walkSoundSettings');
            const attackSettings = document.getElementById('attackSoundSettings');
            if (!actionSelect) return;
            const action = actionSelect.value;
            if (walkSettings) walkSettings.style.display = action === 'walk' ? 'block' : 'none';
            if (attackSettings) attackSettings.style.display = action === 'attack' ? 'block' : 'none';

            // Update volume slider to current value for selected action
            const volumeSlider = document.getElementById('playerSoundVolume');
            const volumeVal = document.getElementById('playerSoundVolumeVal');

            if (playerSounds[action] && playerSounds[action].soundIndex >= 0) {
                const vol = Math.round((playerSounds[action].volume || 0.5) * 100);
                if (volumeSlider) volumeSlider.value = vol;
                if (volumeVal) volumeVal.textContent = vol;
            }

            if (action === 'attack' && playerSounds.attack.soundIndex >= 0) {
                // Update attack-specific sliders
                const pitchSlider = document.getElementById('attackPitch');
                const pitchVal = document.getElementById('attackPitchVal');
                const lengthSlider = document.getElementById('attackLength');
                const lengthVal = document.getElementById('attackLengthVal');
                if (pitchSlider) pitchSlider.value = playerSounds.attack.pitchVariation || 15;
                if (pitchVal) pitchVal.textContent = playerSounds.attack.pitchVariation || 15;
                if (lengthSlider) lengthSlider.value = playerSounds.attack.lengthVariation || 0;
                if (lengthVal) lengthVal.textContent = playerSounds.attack.lengthVariation || 0;
            }
        }

        function placeTileSound(gridX, gridY) {
            if (currentSoundIndex < 0) {
                alert('Select a sound first');
                return;
            }
            const radiusEl = document.getElementById('soundRadius');
            const loopEl = document.getElementById('soundLoop');
            const volumeEl = document.getElementById('soundVolume');
            const fadeEl = document.getElementById('soundFade');
            const key = `${currentMapName}:${gridX},${gridY}`;
            tileSounds[key] = {
                soundIndex: currentSoundIndex,
                radius: radiusEl ? parseInt(radiusEl.value) : 3,
                loop: loopEl ? loopEl.checked : true,
                volume: volumeEl ? volumeEl.value / 100 : 0.5,
                fadePercent: fadeEl ? parseInt(fadeEl.value) / 100 : 0.5
            };
            console.log('Placed tile sound:', key, tileSounds[key]);
            console.log('Total tile sounds:', Object.keys(tileSounds).length);
            // Broadcast to co-op builders
            broadcastEdit({ editType: 'tileSound', key: key, sound: tileSounds[key] });
            updatePlacedSoundsList();
            renderMap();
        }

        function removeTileSound(key) {
            delete tileSounds[key];
            // Broadcast to co-op builders
            broadcastEdit({ editType: 'removeTileSound', key: key });
            updatePlacedSoundsList();
            renderMap();
        }

        // Legacy saves stored main-map tile sounds as bare "x,y" keys (no map prefix). The runtime
        // treats those as the main map, but the builder UI filters by "mapName:". Normalize them to
        // "main:x,y" so the placed-sounds list and click-to-edit find them.
        function normalizeTileSoundKeys() {
            if (!tileSounds || typeof tileSounds !== 'object') return;
            for (const key of Object.keys(tileSounds)) {
                if (key.indexOf(':') === -1) {
                    if (!tileSounds['main:' + key]) tileSounds['main:' + key] = tileSounds[key];
                    delete tileSounds[key];
                }
            }
        }

        function updatePlacedSoundsList() {
            normalizeTileSoundKeys();
            const container = document.getElementById('placedSoundsList');
            if (!container) return;
            const keys = Object.keys(tileSounds).filter(k => k.startsWith(currentMapName + ':'));
            if (keys.length === 0) {
                container.innerHTML = '<div style="color:#888;">No sounds placed</div>';
                return;
            }
            container.innerHTML = keys.map(key => {
                const ts = tileSounds[key];
                const coords = key.split(':')[1]; // Get "x,y" part after map name
                const soundName = sounds[ts.soundIndex]?.name || 'Unknown';
                const isSelected = key === selectedTileSoundKey;
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:4px; margin:2px 0; background:${isSelected ? '#4a7c59' : '#333'}; border-radius:3px; cursor:pointer;" onclick="selectTileSound('${key}')">
                    <span style="flex:1;">📍 ${coords}: ${soundName}</span>
                    <button onclick="event.stopPropagation(); removeTileSound('${key}')" style="padding:2px 6px;">×</button>
                </div>`;
            }).join('');
        }

        function selectTileSound(key) {
            if (!tileSounds[key]) return;
            selectedTileSoundKey = key;
            const ts = tileSounds[key];

            // Populate UI with current values
            const radiusEl = document.getElementById('soundRadius');
            const loopEl = document.getElementById('soundLoop');
            const volumeEl = document.getElementById('soundVolume');
            const fadeEl = document.getElementById('soundFade');
            const selectEl = document.getElementById('soundSelect');

            if (radiusEl) {
                radiusEl.value = ts.radius || 3;
                document.getElementById('soundRadiusVal').textContent = ts.radius || 3;
            }
            if (loopEl) loopEl.checked = ts.loop !== false;
            if (volumeEl) {
                volumeEl.value = (ts.volume || 0.5) * 100;
                document.getElementById('soundVolumeVal').textContent = Math.round((ts.volume || 0.5) * 100);
            }
            if (fadeEl) {
                fadeEl.value = (ts.fadePercent !== undefined ? ts.fadePercent : 0.5) * 100;
                document.getElementById('soundFadeVal').textContent = Math.round((ts.fadePercent !== undefined ? ts.fadePercent : 0.5) * 100);
            }
            if (selectEl) selectEl.value = ts.soundIndex;
            currentSoundIndex = ts.soundIndex;

            // Show edit mode indicator
            document.getElementById('soundEditMode').style.display = 'block';
            document.getElementById('editingSoundKey').textContent = key;

            updatePlacedSoundsList();
            renderMap();
        }

        function deselectTileSound() {
            selectedTileSoundKey = null;
            document.getElementById('soundEditMode').style.display = 'none';
            updatePlacedSoundsList();
            renderMap();
        }

        function saveSelectedSound() {
            if (!selectedTileSoundKey || !tileSounds[selectedTileSoundKey]) {
                alert('No sound selected to save');
                return;
            }
            if (currentSoundIndex < 0) {
                alert('Select a sound first');
                return;
            }

            const radiusEl = document.getElementById('soundRadius');
            const loopEl = document.getElementById('soundLoop');
            const volumeEl = document.getElementById('soundVolume');
            const fadeEl = document.getElementById('soundFade');

            tileSounds[selectedTileSoundKey] = {
                soundIndex: currentSoundIndex,
                radius: radiusEl ? parseInt(radiusEl.value) : 3,
                loop: loopEl ? loopEl.checked : true,
                volume: volumeEl ? volumeEl.value / 100 : 0.5,
                fadePercent: fadeEl ? parseInt(fadeEl.value) / 100 : 0.5
            };

            console.log('Updated tile sound:', selectedTileSoundKey, tileSounds[selectedTileSoundKey]);
            broadcastEdit({ editType: 'tileSound', key: selectedTileSoundKey, sound: tileSounds[selectedTileSoundKey] });
            updatePlacedSoundsList();
            renderMap();
        }
