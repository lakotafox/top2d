        // ===== SAVE/LOAD =====
        async function saveProject() {
            // Use getProjectData() to ensure both save methods have identical data
            const data = getProjectData();
            console.log('Saving project - shops:', data.shops?.length || 0, 'items:', data.items?.length || 0, 'quests:', data.quests?.length || 0);
            console.log('Saving playerPreviewPos:', playerPreviewPos, 'on map:', spawnMapName);
            try {
                // Try IndexedDB first (much larger storage)
                await saveProjectToDB(data);
                alert('Saved! Player spawn: (' + playerPreviewPos.x + ', ' + playerPreviewPos.y + ')');
            } catch (e) {
                console.warn('IndexedDB save failed, trying localStorage:', e);
                // Fallback to localStorage for older browsers
                try {
                    localStorage.setItem('worldBuilderProject', JSON.stringify(data));
                    console.log('Project saved to localStorage (fallback)');
                    alert('Saved! Player spawn: (' + playerPreviewPos.x + ', ' + playerPreviewPos.y + ')');
                } catch (e2) {
                    if (e2.name === 'QuotaExceededError') {
                        alert('Project too large to save! Use "Download" to save to a file.');
                    } else {
                        throw e2;
                    }
                }
            }
            return data; // Return for file download
        }

        function downloadProject() {
            // Get save data
            const data = getProjectData();
            const json = JSON.stringify(data, null, 2);

            // Create download
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'world-project-' + new Date().toISOString().slice(0,10) + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function getProjectData() {
            // Save current map state to maps object before saving
            saveCurrentMapState();

            // Save current prop's collision masks before saving
            if (currentPropIndex >= 0 && props[currentPropIndex]) {
                props[currentPropIndex].collisionMasks = { ...propCollisionMasks };
            }

            // Save all tilesets
            const tilesetsData = tilesets.map(ts => ({ name: ts.name, data: ts.data }));

            // Save all props
            const propsData = props.map(p => ({
                name: p.name,
                data: p.data,
                collisionMasks: p.collisionMasks || {}
            }));

            // Save all animated props — spread-with-strip so new fields round-trip without drift.
            const animPropsData = animatedProps.map(prop => {
                const copy = { ...prop };
                delete copy._spriteImg;
                delete copy.img;
                return copy;
            });

            // Save sounds
            const soundsData = sounds.map(s => ({
                name: s.name,
                data: s.data,
                duration: s.duration,
                type: s.type
            }));
            console.log('getProjectData - sounds:', sounds.length, 'tileSounds:', Object.keys(tileSounds).length);

            // Debug: log all triggers being passed
            console.log('=== getProjectData TRIGGERS ===');
            placedTriggers.forEach((t, i) => {
                console.log('Trigger ' + i + ': Door ' + t.doorNumber + ' at (' + t.x + ',' + t.y + ') on "' + t.mapName + '" -> "' + t.targetMap + '" spawn (' + t.targetX + ',' + t.targetY + ')');
            });

            return {
                gridSize, mapCols, mapRows,
                layers, layerVisibility, layerNames, currentLayer,
                tileCollisions, collisionMasks,
                tileSplitLines, // Depth split lines for Y-sorting
                tileSplitLineFlipped, // Flipped split lines (bottom covers player)
                tilesets: tilesetsData,
                currentTilesetIndex,
                // Keep for backwards compatibility
                tilesetData: tilesets[0]?.data,
                // Save multiple props
                props: propsData,
                currentPropIndex,
                // Keep old format for backwards compatibility
                propImageData: props[0]?.data || null,
                propCollisionMasks: props[0]?.collisionMasks || {},
                // Save animated props
                animatedProps: animPropsData,
                currentAnimPropIndex,
                placedAnimProps,
                // Save NPCs — spread-with-strip (new fields round-trip automatically).
                npcs: npcs.map(npc => {
                    const copy = { ...npc };
                    delete copy._spriteImg;
                    delete copy._editorImg;
                    delete copy.img;
                    return copy;
                }),
                currentNpcIndex,
                placedNpcs,
                // Save player layer settings
                playerLayerIndex,
                playerPreviewPos,
                spawnMapName,
                playerPreviewVisible,
                // Save sound data
                sounds: soundsData,
                tileSounds,
                playerSounds,
                // Quest sounds library
                questSounds: questSounds.map(s => ({ name: s.name, data: s.data })),
                // Save lighting data
                lightingSettings,
                pointLights,
                polyLights,
                // Save player sprite (legacy)
                playerSpriteData,
                // Player characters — spread-with-strip so hitboxRange/hitboxWidth/etc. round-trip.
                playerCharacters: playerCharacters.map(c => {
                    const copy = { ...c };
                    delete copy._spriteImg;
                    delete copy._editorImg;
                    delete copy.img;
                    return copy;
                }),
                activePlayerIndex,
                // Multi-map support
                maps,
                currentMapName,
                placedTriggers,
                // Dialogs
                dialogs,
                placedDialogTiles,
                // Items — spread-with-strip.
                items: items.map(item => {
                    const copy = { ...item };
                    delete copy._spriteImg;
                    delete copy.img;
                    return copy;
                }),
                placedItems,
                // Fishing loot table (project-global): [{ itemIndex, weight }]
                fishingLoot: fishingLoot.map(e => ({ ...e })),
                // Static objects — spread-with-strip.
                staticObjects: staticObjects.map(obj => {
                    const copy = { ...obj };
                    delete copy._spriteImg;
                    delete copy.img;
                    return copy;
                }),
                placedStaticObjects,
                // Quests
                quests,
                // Shops
                shops,
                placedShops,
                startingGold,
                // Version tagging (Wave 1)
                version: SAVE_SCHEMA_VERSION,
                gameVersion: GAME_VERSION,
                savedAt: Date.now()
            };
        }

        // Lightweight world for phone "join by URL": same shape as getProjectData() but with the
        // heavy AUDIO stripped (sounds/questSounds base64 = ~90% of a real save). The engine still
        // gets the inline tile/sprite images it needs to render a viewport, so it boots unchanged
        // from this object. Audio is deferred (phones play silent for v1). Compact JSON of this is
        // ~MBs instead of ~200MB, so it ships in a single WebSocket frame and parses on a phone.
        function getLightweightWorld() {
            const d = getProjectData();
            if (Array.isArray(d.sounds)) {
                d.sounds = d.sounds.map(s => ({ name: s.name, duration: s.duration, type: s.type }));
            }
            if (Array.isArray(d.questSounds)) {
                d.questSounds = d.questSounds.map(s => ({ name: s.name }));
            }
            d.audioStripped = true;   // signals the join client that sounds carry no data
            d.lightweight = true;
            return d;
        }

        function uploadProject(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    // Save to IndexedDB so Test Map works
                    try {
                        await saveProjectToDB(data);
                        console.log('Uploaded project saved to IndexedDB');
                    } catch (dbErr) {
                        console.warn('IndexedDB save failed, trying localStorage:', dbErr);
                        try {
                            localStorage.setItem('worldBuilderProject', JSON.stringify(data));
                        } catch (storageErr) {
                            console.warn('localStorage also full, project loaded but not persisted');
                        }
                    }
                    // Load into editor
                    await loadProject(data);
                } catch (err) {
                    alert('Error loading file: ' + err.message);
                }
            };
            reader.readAsText(file);

            // Clear input so same file can be loaded again
            event.target.value = '';
        }

        // Load save and show mode selection
        let pendingSaveData = null;

        // Show save choice menu (demo vs own save)
        function showSaveChoice() {
            document.getElementById('mainMenu').style.display = 'none';
            document.getElementById('saveChoice').style.display = 'block';
        }

        // Load save menu HTML
        const saveChoiceOriginalHTML = `
            <h1>LOAD<br>SAVE</h1>
            <p>- SELECT SOURCE -</p>
            <div style="margin-top:20px;">
                <button class="retro-btn" onclick="playButtonSound(); document.getElementById('projectFileInputWelcome').click(); document.getElementById('saveChoice').style.display='none'; document.getElementById('mainMenu').style.display='block';">
                    > YOUR SAVE
                </button>
            </div>
            <div style="margin-top:10px;">
                <button class="retro-btn" onclick="playButtonSound(); document.getElementById('saveChoice').style.display='none'; document.getElementById('mainMenu').style.display='block';" style="font-size:10px;">
                    > BACK
                </button>
            </div>
        `;
        function loadSaveWithModeSelect(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    pendingSaveData = JSON.parse(e.target.result);
                    await saveProjectToDB(pendingSaveData);
                    document.getElementById('mainMenu').style.display = 'none';
                    document.getElementById('modeSelect').style.display = 'block';
                } catch (err) {
                    alert('Error: ' + err.message);
                }
            };
            reader.readAsText(file);
            event.target.value = '';
        }

        // Multiplayer prompt functions
        function showMultiplayerPrompt() {
            document.getElementById('modeSelect').style.display = 'none';
            document.getElementById('multiplayerPrompt').style.display = 'block';
            document.getElementById('mpPlayerName').focus();
        }

        function hideMultiplayerPrompt() {
            document.getElementById('multiplayerPrompt').style.display = 'none';
            document.getElementById('modeSelect').style.display = 'block';
        }

        // Craft multiplayer prompt functions
        function showCraftMultiplayerPrompt() {
            document.getElementById('modeSelect').style.display = 'none';
            document.getElementById('craftMultiplayerPrompt').style.display = 'block';
            // Focus is handled in showHostPrompt/showJoinPrompt
        }

        function hideCraftMultiplayerPrompt() {
            document.getElementById('craftMultiplayerPrompt').style.display = 'none';
            document.getElementById('modeSelect').style.display = 'block';
        }

        // Simple builder start - shows co-op prompt
        function startBuilder() {
            if (!pendingSaveData) {
                console.log('[START] No save data, returning');
                return;
            }

            // Hide mode select, show co-op prompt
            document.getElementById('modeSelect').style.display = 'none';
            document.getElementById('craftMultiplayerPrompt').style.display = 'block';
            // Focus is handled in showHostPrompt/showJoinPrompt
        }

        // === BUILDER MULTIPLAYER SYSTEM ===
        let builderSocket = null;
        let builderConnected = false;
        let builderPlayerName = 'Builder';
        let builderRoomCode = null;
        // Resilient co-op sync: track the latest server edit seq we've applied so we can
        // ask the server for exactly what we missed after a dropped/slept socket.
        let builderLastSeq = 0;            // highest server _seq applied
        let builderWantConnection = false; // true while user is in co-op mode (drives auto-reconnect)
        let builderReconnectDelay = 1000;
        let builderReconnectTimer = null;
        let builderVisibilityHooked = false;
        let testGameWindow = null; // Reference to test game window for solo live sync

        // Track who's editing what modal (to prevent conflicts)
        // Format: { 'npc:0': { username: 'Player1', socketId: 'abc123' }, 'item:2': {...} }
        let currentlyEditing = {};
        let myEditingKey = null; // What am I currently editing?

        // Check if something is being edited by someone else
        function isBeingEdited(type, index) {
            const key = type + ':' + index;
            return currentlyEditing[key] && currentlyEditing[key].username !== builderPlayerName;
        }

        // Get who is editing something
        function getEditor(type, index) {
            const key = type + ':' + index;
            return currentlyEditing[key] ? currentlyEditing[key].username : null;
        }

        // Start editing something
        function startEditing(type, index) {
            const key = type + ':' + index;
            myEditingKey = key;
            currentlyEditing[key] = { username: builderPlayerName };
            broadcastEdit({ editType: 'startEditing', editorType: type, editorIndex: index, username: builderPlayerName });
        }

        // Stop editing something
        function stopEditing() {
            if (myEditingKey) {
                const [type, index] = myEditingKey.split(':');
                delete currentlyEditing[myEditingKey];
                broadcastEdit({ editType: 'stopEditing', editorType: type, editorIndex: parseInt(index) });
                myEditingKey = null;
            }
        }

        // Clear all edits by a disconnected player
        function clearPlayerEdits(username) {
            for (const key in currentlyEditing) {
                if (currentlyEditing[key].username === username) {
                    delete currentlyEditing[key];
                }
            }
        }

        // Track game players visible in builder
        let gamePlayersInBuilder = new Map(); // id -> {x, y, name, direction, currentMap, animation, frame, lastFrameTime}
        let gamePlayerAnimInterval = null; // Animation loop for game players in builder
        let builderGameSocket = null; // socket to game server to see testers
        let builderPlaySocket = null; // read-only listener on the live PLAY party (shows URL viewers on the builder)
        let liveRoomCode = null;      // room the host is currently live in (set by goLive)

        // Track builder co-op players in the room
        let builderPlayersInRoom = new Map(); // id -> {name, joinedAt}
        let builderMyId = null;     // assigned by server in welcome
        let isBuilderHost = false;  // true if I arrived to an empty room

        function connectBuilderMultiplayer(name, roomCode) {
            console.log('[BUILDER MP DEBUG] connectBuilderMultiplayer called with name:', name, 'roomCode:', roomCode);

            if (!roomCode) {
                console.log('[BUILDER MP DEBUG] No room code, solo mode');
                return; // Solo mode
            }

            builderPlayerName = name;
            builderRoomCode = roomCode;
            builderWantConnection = true; // we intend to stay connected — drives auto-reconnect
            hookBuilderVisibility();
            const wsUrl = 'wss://multiplayer.lakotafox.partykit.dev/parties/builder/' + roomCode;
            console.log('[BUILDER MP DEBUG] Connecting to:', wsUrl);

            try {
                builderSocket = new WebSocket(wsUrl);
                console.log('[BUILDER MP DEBUG] WebSocket created, waiting for open...');

                builderSocket.onopen = () => {
                    console.log('[BUILDER MP DEBUG] WebSocket OPEN!');
                    builderConnected = true;
                    builderReconnectDelay = 1000; // reset backoff on a successful connect
                    const joinMsg = {
                        type: 'join',
                        name: builderPlayerName,
                        gameType: 'builder'
                    };
                    console.log('[BUILDER MP DEBUG] Sending join message:', joinMsg);
                    builderSocket.send(JSON.stringify(joinMsg));
                    showBuilderStatus('Connected: ' + roomCode);
                    console.log('[BUILDER MP DEBUG] builderConnected is now:', builderConnected);
                };

                builderSocket.onmessage = (event) => {
                    console.log('[BUILDER MP DEBUG] Raw message received:', event.data);
                    try {
                        const data = JSON.parse(event.data);
                        handleBuilderMessage(data);
                    } catch (e) {
                        console.error('[BUILDER MP DEBUG] Parse error:', e);
                    }
                };

                builderSocket.onclose = (event) => {
                    console.log('[BUILDER MP DEBUG] WebSocket CLOSED, code:', event.code, 'reason:', event.reason);
                    builderConnected = false;
                    // Also close game socket and clear players
                    if (builderGameSocket) {
                        builderGameSocket.close();
                        builderGameSocket = null;
                    }
                    gamePlayersInBuilder.clear();
                    renderMap();
                    // Backgrounded tabs drop sockets — auto-reconnect and catch up on missed edits.
                    if (builderWantConnection) {
                        showBuilderStatus('Reconnecting…');
                        scheduleBuilderReconnect();
                    } else {
                        showBuilderStatus('Disconnected');
                    }
                };

                builderSocket.onerror = (err) => {
                    console.error('[BUILDER MP DEBUG] WebSocket ERROR:', err);
                };
            } catch (e) {
                console.error('[BUILDER MP DEBUG] Connect failed:', e);
            }

            // Also connect to game server to see players testing the game
            connectToGameServerForBuilder(roomCode);
        }

        function connectToGameServerForBuilder(roomCode) {
            const gameWsUrl = 'wss://multiplayer.lakotafox.partykit.dev/party/' + roomCode;
            console.log('[BUILDER GAME] Connecting to game server:', gameWsUrl);
            builderGameSocket = new WebSocket(gameWsUrl);

            builderGameSocket.onopen = () => {
                console.log('[BUILDER GAME] Connected to game server!');
            };

            builderGameSocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'welcome' && data.players) {
                        data.players.forEach(p => {
                            if (p.gameType === 'game2d') {
                                p.frame = 0;
                                p.lastFrameTime = Date.now();
                                gamePlayersInBuilder.set(p.id, p);
                            }
                        });
                        startGamePlayerAnimLoop();
                        renderMap();
                    } else if (data.type === 'join' && data.player && data.player.gameType === 'game2d') {
                        console.log('[BUILDER] Game player joined:', data.player.name);
                        data.player.frame = 0;
                        data.player.lastFrameTime = Date.now();
                        gamePlayersInBuilder.set(data.player.id, data.player);
                        startGamePlayerAnimLoop();
                        renderMap();
                    } else if (data.type === 'update' && data.player && data.player.gameType === 'game2d') {
                        const existing = gamePlayersInBuilder.get(data.player.id);
                        data.player.frame = existing ? existing.frame : 0;
                        data.player.lastFrameTime = existing ? existing.lastFrameTime : Date.now();
                        gamePlayersInBuilder.set(data.player.id, data.player);
                    } else if (data.type === 'leave' && data.playerId) {
                        console.log('[BUILDER] Game player left');
                        gamePlayersInBuilder.delete(data.playerId);
                        if (gamePlayersInBuilder.size === 0) stopGamePlayerAnimLoop();
                        renderMap();
                    }
                } catch (e) {}
            };

            builderGameSocket.onclose = () => {
                console.log('[BUILDER GAME] Disconnected from game server');
                gamePlayersInBuilder.clear();
                stopGamePlayerAnimLoop();
            };
        }

        // Read-only listener on the live PLAY party so viewers who joined by URL show up on the
        // builder canvas (the play party is a separate room from the default game party watched by
        // connectToGameServerForBuilder). play.ts strips gameType, so we DON'T filter on it here —
        // that room only ever holds game2d viewers. Mirrors the tester listener otherwise.
        function connectBuilderToPlayParty(room) {
            if (!room) return;
            try { if (builderPlaySocket) builderPlaySocket.close(); } catch (e) {}
            const url = 'wss://multiplayer.lakotafox.partykit.dev/parties/play/' + encodeURIComponent(room);
            console.log('[BUILDER PLAY] Watching live viewers at', url);
            builderPlaySocket = new WebSocket(url);
            builderPlaySocket.onmessage = (event) => {
                let data; try { data = JSON.parse(event.data); } catch (e) { return; }
                if (data.type === 'welcome' && Array.isArray(data.players)) {
                    data.players.forEach(p => {
                        p.frame = 0; p.lastFrameTime = Date.now();
                        gamePlayersInBuilder.set(p.id, p);
                    });
                    if (data.players.length) { startGamePlayerAnimLoop(); renderMap(); }
                } else if (data.type === 'join' && data.player) {
                    data.player.frame = 0; data.player.lastFrameTime = Date.now();
                    gamePlayersInBuilder.set(data.player.id, data.player);
                    startGamePlayerAnimLoop(); renderMap();
                } else if (data.type === 'update' && data.player) {
                    const ex = gamePlayersInBuilder.get(data.player.id);
                    data.player.frame = ex ? ex.frame : 0;
                    data.player.lastFrameTime = ex ? ex.lastFrameTime : Date.now();
                    gamePlayersInBuilder.set(data.player.id, data.player);
                } else if (data.type === 'leave' && data.playerId) {
                    gamePlayersInBuilder.delete(data.playerId);
                    if (gamePlayersInBuilder.size === 0) stopGamePlayerAnimLoop();
                    renderMap();
                }
            };
            builderPlaySocket.onclose = () => { console.log('[BUILDER PLAY] Disconnected from play party'); };
            builderPlaySocket.onerror = () => { console.log('[BUILDER PLAY] Play party socket error'); };
        }

        // Animation loop for game players shown in builder
        function startGamePlayerAnimLoop() {
            if (gamePlayerAnimInterval) return; // Already running
            gamePlayerAnimInterval = setInterval(() => {
                if (gamePlayersInBuilder.size === 0) {
                    stopGamePlayerAnimLoop();
                    return;
                }
                const now = Date.now();
                let needsRender = false;
                gamePlayersInBuilder.forEach(p => {
                    // Advance frame every 150ms for walking players
                    if (p.animation === 'walk' && now - p.lastFrameTime > 150) {
                        p.frame = p.frame + 1; // uncapped; draw uses % frames.length
                        p.lastFrameTime = now;
                        needsRender = true;
                    } else if (p.animation !== 'walk') {
                        // Reset to idle frame
                        if (p.frame !== 0) needsRender = true;
                        p.frame = 0;
                    }
                });
                if (needsRender) renderMap();
            }, 100);
        }

        function stopGamePlayerAnimLoop() {
            if (gamePlayerAnimInterval) {
                clearInterval(gamePlayerAnimInterval);
                gamePlayerAnimInterval = null;
            }
        }

        // Auto-reconnect the co-op socket with capped backoff. The server keeps an
        // authoritative edit log, so on reconnect we ask for everything missed (requestSince).
        function scheduleBuilderReconnect() {
            if (!builderWantConnection || builderReconnectTimer) return;
            builderReconnectTimer = setTimeout(() => {
                builderReconnectTimer = null;
                if (builderWantConnection && (!builderSocket || builderSocket.readyState > 1)) {
                    console.log('[BUILDER MP] reconnecting (delay was ' + builderReconnectDelay + 'ms)…');
                    builderReconnectDelay = Math.min(builderReconnectDelay * 1.5, 15000);
                    connectBuilderMultiplayer(builderPlayerName, builderRoomCode);
                }
            }, builderReconnectDelay);
        }

        // When the tab comes back to the foreground: reconnect if the socket died, or
        // (if still open) ask the server for any edits that landed while we were away.
        function hookBuilderVisibility() {
            if (builderVisibilityHooked) return;
            builderVisibilityHooked = true;
            document.addEventListener('visibilitychange', () => {
                if (document.hidden || !builderWantConnection) return;
                if (!builderSocket || builderSocket.readyState > 1) {
                    builderReconnectDelay = 1000;
                    scheduleBuilderReconnect();
                } else if (builderSocket.readyState === 1) {
                    try {
                        builderSocket.send(JSON.stringify({ type: 'requestSince', since: builderLastSeq }));
                        console.log('[BUILDER MP] tab visible — requesting catch-up since', builderLastSeq);
                    } catch (e) {}
                }
            });
        }

        function handleBuilderMessage(data) {
            console.log('[BUILDER MP DEBUG] handleBuilderMessage received:', data);
            console.log('[BUILDER MP DEBUG] data.type:', data.type);

            // Track players joining/leaving for room info
            if (data.type === 'welcome') {
                builderMyId = data.yourId || null;
                // Initial player list when we join
                if (data.players) {
                    builderPlayersInRoom.clear();
                    data.players.forEach(p => {
                        builderPlayersInRoom.set(p.id, { name: p.name, joinedAt: Date.now() });
                    });
                    // Empty room = I'm the host (source of truth for late joiners)
                    isBuilderHost = (data.players.length === 0);
                    console.log('[BUILDER MP] Players in room:', builderPlayersInRoom.size, '| Host:', isBuilderHost, '| MyId:', builderMyId);
                }
                // Ask the server for every edit we missed (covers first join AND reconnect
                // after a slept tab). builderLastSeq persists across reconnects.
                if (typeof data.serverSeq === 'number' && data.serverSeq > builderLastSeq) {
                    try {
                        builderSocket.send(JSON.stringify({ type: 'requestSince', since: builderLastSeq }));
                        console.log('[BUILDER MP] welcome: requesting catch-up since', builderLastSeq, '(server at', data.serverSeq + ')');
                    } catch (e) {}
                }
                return;
            }

            if (data.type === 'join') {
                if (data.player) {
                    builderPlayersInRoom.set(data.player.id, { name: data.player.name, joinedAt: Date.now() });
                    console.log('[BUILDER MP] Player joined:', data.player.name, '- Total:', builderPlayersInRoom.size);
                    // NOTE: late joiners now catch up from the SERVER's authoritative edit log
                    // (they send requestSince on welcome), so we no longer host-replay here —
                    // doing both would double-apply edits (e.g. duplicate quests).
                }
                return;
            }

            if (data.type === 'leave') {
                if (data.playerId) {
                    // Clear any editing locks held by this player
                    const leavingPlayer = builderPlayersInRoom.get(data.playerId);
                    if (leavingPlayer && leavingPlayer.name) {
                        clearPlayerEdits(leavingPlayer.name);
                    }
                    builderPlayersInRoom.delete(data.playerId);
                    console.log('[BUILDER MP] Player left - Remaining:', builderPlayersInRoom.size);
                }
                return;
            }

            // Handle edit messages from other builders
            if (data.type === 'builderEdit' && data.editType) {
                // Directed message — skip if it's not meant for me
                if (data.targetId && data.targetId !== builderMyId) {
                    return;
                }
                console.log('[BUILDER MP DEBUG] >>> APPLYING REMOTE EDIT <<<', data.editType);
                // Advance our catch-up cursor so reconnects only re-request the gap.
                if (typeof data._seq === 'number' && data._seq > builderLastSeq) builderLastSeq = data._seq;
                applyRemoteEdit(data);
            }
        }

        // Resync Room button + host auto-resync-on-join. We do NOT send full project state
        // (base saves are shared out-of-band via file download/upload — see the Save button
        // in Tools menu). We replay only the session edit log: every broadcastEdit made
        // since this host connected. Tiny and fast.
        function sendFullProject(targetId) {
            if (!builderSocket || !builderConnected) return;
            if (!Array.isArray(sessionEditLog) || sessionEditLog.length === 0) {
                console.log('[BUILDER MP] No session edits to replay' + (targetId ? ' -> ' + targetId : ''));
                return;
            }
            // Chunk the log so individual messages stay under the WebSocket size cap.
            // Target ~8 KB per chunk to leave headroom; skip any single oversized edit.
            const TARGET_CHUNK_BYTES = 8 * 1024;
            const chunks = [];
            let cur = [];
            let curBytes = 0;
            for (const e of sessionEditLog) {
                const sz = JSON.stringify(e).length;
                if (sz > TARGET_CHUNK_BYTES * 1.5) {
                    // Single edit larger than chunk budget — send it alone if possible.
                    if (cur.length) { chunks.push(cur); cur = []; curBytes = 0; }
                    chunks.push([e]);
                    continue;
                }
                if (curBytes + sz > TARGET_CHUNK_BYTES && cur.length > 0) {
                    chunks.push(cur);
                    cur = [];
                    curBytes = 0;
                }
                cur.push(e);
                curBytes += sz;
            }
            if (cur.length) chunks.push(cur);

            console.log('[BUILDER MP] Replaying session log —',
                        sessionEditLog.length, 'edits in', chunks.length, 'chunk(s)',
                        targetId ? ('-> ' + targetId) : '(broadcast)');

            chunks.forEach((chunk, i) => {
                setTimeout(() => {
                    if (!builderSocket || !builderConnected) return;
                    const msg = JSON.stringify({
                        type: 'builderEdit',
                        editType: 'sessionLogReplay',
                        targetId: targetId || undefined,
                        edits: chunk
                    });
                    try {
                        builderSocket.send(msg);
                        console.log('[BUILDER MP] session chunk', (i + 1) + '/' + chunks.length,
                                    chunk.length, 'edits,', (msg.length / 1024).toFixed(1), 'KB');
                    } catch (err) {
                        console.error('[BUILDER MP] session chunk send failed:', err);
                    }
                }, 60 * i); // stagger so we don't blast the socket
            });
        }

        function loadFullProject(project) {
            console.log('[BUILDER MP] Loading full project with maps:', Object.keys(project.maps || {}));
            project = migrateProjectData(project);

            // Load maps — replace-not-merge so ghost maps from the previous session don't linger.
            if (project.maps && typeof project.maps === 'object') {
                maps = {};
                for (const mapName in project.maps) {
                    maps[mapName] = project.maps[mapName];
                }
            }

            // Load triggers, NPCs, sounds, lights
            placedTriggers = project.placedTriggers || [];
            ensureTriggerUids(placedTriggers); // Wave 7: stamp UIDs for MP-late-joiners with legacy data.
            placedNpcs = project.placedNpcs || [];
            // Ensure all placed NPCs have UIDs (for backwards compatibility)
            placedNpcs.forEach((npc, i) => {
                if (!npc.uid) {
                    npc.uid = 'npc_' + npc.npcIndex + '_' + i + '_' + Date.now();
                }
            });

            // Load static objects from multiplayer sync
            staticObjects = [];
            placedStaticObjects = project.placedStaticObjects || [];
            if (project.staticObjects && project.staticObjects.length > 0) {
                project.staticObjects.forEach((objData, i) => {
                    staticObjects[i] = {
                        ...objData,
                        _spriteImg: new Image()
                    };
                    staticObjects[i]._spriteImg.src = objData.spriteData;
                });
            }
            updateStaticObjectsList();

            tileSounds = project.tileSounds || {};
            normalizeTileSoundKeys(); // migrate legacy "x,y" keys -> "main:x,y"
            pointLights = project.pointLights || {};
            polyLights = project.polyLights || [];
            tileCollisions = project.tileCollisions || {};
            collisionMasks = project.collisionMasks || {};
            tileSplitLines = project.tileSplitLines || {};
            tileSplitLineFlipped = project.tileSplitLineFlipped || {};

            // Load animated props (need to reload images)
            animatedProps = project.animatedProps || [];
            animatedProps.forEach((prop, i) => {
                if (prop.spriteData) {
                    const img = new Image();
                    img.onload = () => {
                        animatedProps[i]._spriteImg = img;
                        updateAnimPropListDisplay();
                    };
                    img.src = prop.spriteData;
                }
            });

            // Load tilesets (need to reload images from base64)
            console.log('[BUILDER MP] Loading tilesets:', project.tilesets ? project.tilesets.length : 0);
            if (project.tilesets && project.tilesets.length > 0) {
                tilesets = [];
                project.tilesets.forEach((ts, i) => {
                    console.log('[BUILDER MP] Tileset', i, ts.name, 'data length:', ts.data ? ts.data.length : 'NO DATA');
                    if (!ts.data) {
                        console.error('[BUILDER MP] Tileset', ts.name, 'has no data!');
                        return;
                    }
                    const img = new Image();
                    img.onload = () => {
                        console.log('[BUILDER MP] Tileset loaded:', ts.name, img.width, 'x', img.height);
                        tilesets[i] = { name: ts.name, img: img, data: ts.data };
                        // Update tilesetImg if this is the current tileset
                        if (i === (project.currentTilesetIndex || 0)) {
                            tilesetImg = img;
                            currentTilesetIndex = i;
                        }
                        updateTilesetDropdown();
                        renderTilesetPanel();
                        renderMap();
                    };
                    img.onerror = (e) => {
                        console.error('[BUILDER MP] Failed to load tileset image:', ts.name, e);
                    };
                    img.src = ts.data;
                });
            } else {
                console.warn('[BUILDER MP] No tilesets in project!');
            }

            // Load NPC definitions (need to reload images from spriteData)
            if (project.npcs && project.npcs.length > 0) {
                npcs = [];
                project.npcs.forEach((npc, i) => {
                    npcs[i] = { ...npc };
                    if (npc.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            // Wave 8: canonical property is _editorImg (what the renderer reads).
                            npcs[i]._editorImg = img;
                            updateNpcList();
                        };
                        img.src = npc.spriteData;
                    }
                });
            }

            // Load dialogs
            if (project.dialogs) {
                dialogs = project.dialogs;
            }

            // Load shops
            if (project.shops) {
                shops = project.shops;
            }
            placedShops = project.placedShops || [];
            startingGold = project.startingGold !== undefined ? project.startingGold : 100;

            // Load player characters
            if (project.playerCharacters && project.playerCharacters.length > 0) {
                playerCharacters = [];
                project.playerCharacters.forEach((char, i) => {
                    playerCharacters[i] = { ...char };
                    if (char.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            playerCharacters[i]._spriteImg = img;
                            updatePlayerList();
                        };
                        img.src = char.spriteData;
                    }
                });
                activePlayerIndex = project.activePlayerIndex !== undefined ? project.activePlayerIndex : 0;
            }

            // Load spawn
            if (project.playerPreviewPos) {
                playerPreviewPos = project.playerPreviewPos;
            }
            spawnMapName = project.spawnMapName || spawnMapName;

            // ===== Wave 2 (R2): complete the field list that getProjectData serializes =====
            // Lighting settings — spread-with-defaults so future fields round-trip.
            if (project.lightingSettings) {
                lightingSettings = {
                    playerLight: false,
                    playerLightRadius: 4,
                    ...project.lightingSettings
                };
                const playerLightEl = document.getElementById('playerLight');
                const radiusEl = document.getElementById('playerLightRadius');
                const radiusVal = document.getElementById('playerLightRadiusVal');
                if (playerLightEl) playerLightEl.checked = !!lightingSettings.playerLight;
                if (radiusEl) radiusEl.value = lightingSettings.playerLightRadius;
                if (radiusVal) radiusVal.textContent = lightingSettings.playerLightRadius;
            }

            // Sounds library (with Audio decode) — was silently dropped before.
            sounds = [];
            if (Array.isArray(project.sounds)) {
                project.sounds.forEach((s, i) => {
                    sounds[i] = {
                        ...s, // preserve all saved fields — don't whitelist
                        name: s.name,
                        data: s.data,
                        duration: s.duration || 0,
                        type: s.type || 'ambient'
                    };
                });
            }
            if (project.playerSounds) {
                playerSounds = {
                    walk: { soundIndex: -1, interval: 200, volume: 0.5, pitchVariation: 0.1 },
                    attack: { soundIndex: -1, volume: 0.7, pitchVariation: 0.15, lengthVariation: 0 },
                    inventoryOpen: { soundIndex: -1, volume: 0.5 },
                    inventoryClose: { soundIndex: -1, volume: 0.5 },
                    ...project.playerSounds
                };
            }
            if (typeof updateSoundDropdown === 'function') updateSoundDropdown();
            if (typeof updatePlayerSoundAssignments === 'function') updatePlayerSoundAssignments();

            // Quest sounds library.
            if (Array.isArray(project.questSounds)) {
                questSounds = project.questSounds.map(s => ({ name: s.name, data: s.data }));
            }

            // Items + placed items.
            items = [];
            placedItems = Array.isArray(project.placedItems) ? project.placedItems : [];
            fishingLoot = Array.isArray(project.fishingLoot) ? project.fishingLoot.map(e => ({ ...e })) : [];
            if (typeof itemImages !== 'undefined') {
                for (const k of Object.keys(itemImages)) delete itemImages[k];
            }
            if (Array.isArray(project.items)) {
                project.items.forEach((itemData, i) => {
                    items[i] = {
                        ...itemData,
                        id: itemData.id || ('item_' + i)
                    };
                    if (itemData.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            if (typeof itemImages !== 'undefined') itemImages[i] = img;
                            if (typeof updateItemsList === 'function') updateItemsList();
                            if (typeof renderMap === 'function') renderMap();
                        };
                        img.src = itemData.spriteData;
                    }
                });
            }
            if (typeof updateItemsList === 'function') updateItemsList();

            // Placed dialog tiles (signs).
            placedDialogTiles = Array.isArray(project.placedDialogTiles) ? project.placedDialogTiles : [];

            // Quests.
            if (Array.isArray(project.quests)) {
                quests = project.quests;
                if (typeof renderQuestList === 'function') renderQuestList();
            }

            // Placed animated props.
            if (Array.isArray(project.placedAnimProps)) {
                placedAnimProps = project.placedAnimProps;
            }

            // Player layer index.
            if (typeof project.playerLayerIndex === 'number') {
                playerLayerIndex = project.playerLayerIndex;
            }
            // ===== end Wave 2 additions =====

            // Switch to the current map
            if (project.currentMapName && maps[project.currentMapName]) {
                currentMapName = project.currentMapName;
                loadMapState(maps[currentMapName]);
            }

            // Update all UI
            updateMapDropdowns();
            updateTriggerList();
            updatePlacedNpcList();
            updatePlacedSoundsList();
            updatePlacedLightsList();
            updatePolyLightsList();
            updateAnimPropListDisplay();
            updateDialogList();
            updatePlayerList();
            renderLayerList();
            renderMap();

            console.log('[BUILDER MP] Full project loaded successfully!');
            showBuilderStatus('Synced: ' + builderRoomCode);
        }

        // Idempotency guards: a catch-up replay or late-join resync can re-deliver a
        // place* edit that's already present. Without these, the receivers blind-push
        // and duplicate the entity. NPCs/triggers carry a uid; items dedup by position.
        function _placedNpcExists(npc) { return !!(npc && npc.uid && placedNpcs.some(n => n && n.uid === npc.uid)); }
        function _placedTriggerExists(t) { return !!(t && t.uid && placedTriggers.some(x => x && x.uid === t.uid)); }
        function _placedItemExists(it) { return !!(it && placedItems.some(p => p && p.x === it.x && p.y === it.y && p.mapName === it.mapName && p.itemIndex === it.itemIndex)); }

        function applyRemoteEdit(edit) {
            console.log('[BUILDER MP] Applying remote edit:', edit.editType);

            // Get the target map's layers
            let targetLayers;
            if (edit.mapName && edit.mapName !== currentMapName && maps[edit.mapName]) {
                // Edit is for a different map
                targetLayers = maps[edit.mapName].layers;
            } else {
                // Edit is for current map
                targetLayers = layers;
            }

            switch (edit.editType) {
                case 'batch':
                    // Apply batch of edits
                    let needsRender = false;
                    for (const e of edit.edits) {
                        // Apply each edit without rendering
                        applyRemoteEditNoRender(e);
                        if (!e.mapName || e.mapName === currentMapName) needsRender = true;
                    }
                    if (needsRender) renderMap();
                    break;

                case 'fullProject':
                    // Legacy full-project resync. Now vestigial — kept for backward compat
                    // with any peer still running older code.
                    if (edit.project) {
                        console.log('[BUILDER MP] Receiving full project resync (legacy path)');
                        loadFullProject(edit.project);
                        showBuilderStatus('Resynced from room');
                    }
                    break;

                case 'sessionLogReplay':
                    // Catch-up batch from the server's authoritative log (or a peer's session log).
                    // Base saves are shared out-of-band; this catches us up on in-session changes.
                    if (Array.isArray(edit.edits)) {
                        console.log('[BUILDER MP] Replaying', edit.edits.length, 'session edits');
                        let applied = 0, failed = 0;
                        for (const e of edit.edits) {
                            try {
                                applyRemoteEdit(e);
                                if (typeof e._seq === 'number' && e._seq > builderLastSeq) builderLastSeq = e._seq;
                                applied++;
                            }
                            catch (err) { failed++; console.warn('[MP] replay failed for', e?.editType, err); }
                        }
                        // Advance the cursor to the server's reported head so we don't re-request
                        // gaps (e.g. oversized edits the server didn't log).
                        if (typeof edit.serverSeq === 'number' && edit.serverSeq > builderLastSeq) builderLastSeq = edit.serverSeq;
                        if (applied) showBuilderStatus('Synced ' + applied + ' edits' + (failed ? ' (' + failed + ' failed)' : ''));
                    }
                    break;

                case 'tilesetSync':
                    if (edit.data) {
                        const tsImg = new Image();
                        tsImg.onload = () => {
                            tilesets[edit.index] = { name: edit.name, img: tsImg, data: edit.data };
                            if (edit.index === currentTilesetIndex) {
                                tilesetImg = tsImg;
                            }
                            updateTilesetDropdown();
                            renderTilesetPanel();
                            renderMap();
                            console.log('[BUILDER MP] Tileset synced:', edit.index, edit.name);
                        };
                        tsImg.src = edit.data;
                    }
                    break;

                // HOTFIX 2026-04-17 streaming receivers — fill in base64 assets that arrive
                // after the main (stripped) fullProject payload.
                case 'itemSpriteSync':
                    if (Array.isArray(items) && items[edit.index] && edit.data) {
                        items[edit.index].spriteData = edit.data;
                        const img = new Image();
                        img.onload = () => {
                            if (typeof itemImages !== 'undefined') itemImages[edit.index] = img;
                            if (typeof updateItemsList === 'function') updateItemsList();
                            renderMap();
                        };
                        img.src = edit.data;
                    }
                    break;
                case 'npcSpriteSync':
                    if (Array.isArray(npcs) && npcs[edit.index] && edit.data) {
                        npcs[edit.index].spriteData = edit.data;
                        const img = new Image();
                        img.onload = () => {
                            npcs[edit.index]._editorImg = img;
                            if (typeof updateNpcList === 'function') updateNpcList();
                            renderMap();
                        };
                        img.src = edit.data;
                    }
                    break;
                case 'animPropSpriteSync':
                    if (Array.isArray(animatedProps) && animatedProps[edit.index] && edit.data) {
                        animatedProps[edit.index].spriteData = edit.data;
                        const img = new Image();
                        img.onload = () => {
                            animatedProps[edit.index]._spriteImg = img;
                            if (typeof updateAnimPropListDisplay === 'function') updateAnimPropListDisplay();
                            renderMap();
                        };
                        img.src = edit.data;
                    }
                    break;
                case 'staticObjSpriteSync':
                    if (Array.isArray(staticObjects) && staticObjects[edit.index] && edit.data) {
                        staticObjects[edit.index].spriteData = edit.data;
                        const img = new Image();
                        img.onload = () => {
                            staticObjects[edit.index]._spriteImg = img;
                            if (typeof updateStaticObjectsList === 'function') updateStaticObjectsList();
                            renderMap();
                        };
                        img.src = edit.data;
                    }
                    break;
                case 'soundBlobSync':
                    if (Array.isArray(sounds) && sounds[edit.index] && edit.data) {
                        sounds[edit.index].data = edit.data;
                        if (typeof updateSoundDropdown === 'function') updateSoundDropdown();
                        if (typeof updatePlayerSoundAssignments === 'function') updatePlayerSoundAssignments();
                    }
                    break;
                case 'questSoundBlobSync':
                    if (Array.isArray(questSounds) && questSounds[edit.index] && edit.data) {
                        questSounds[edit.index].data = edit.data;
                    }
                    break;
                case 'playerCharSheetSync':
                    if (Array.isArray(playerCharacters) && playerCharacters[edit.index] && edit.data) {
                        const c = playerCharacters[edit.index];
                        if (edit.sheetIndex === -1 || edit.sheetIndex === undefined) {
                            c.spriteData = edit.data;
                            const img = new Image();
                            img.onload = () => {
                                c._spriteImg = img;
                                if (typeof updatePlayerList === 'function') updatePlayerList();
                            };
                            img.src = edit.data;
                        } else if (typeof edit.sheetIndex === 'number') {
                            if (!Array.isArray(c.spriteSheets)) c.spriteSheets = [];
                            c.spriteSheets[edit.sheetIndex] = edit.data;
                        }
                    }
                    break;

                case 'tile':
                    // Apply tile placement
                    if (!targetLayers[edit.layer]) targetLayers[edit.layer] = [];
                    if (!targetLayers[edit.layer][edit.y]) targetLayers[edit.layer][edit.y] = [];
                    targetLayers[edit.layer][edit.y][edit.x] = edit.cell;
                    if (!edit.mapName || edit.mapName === currentMapName) {
                        renderMap();
                    }
                    break;

                case 'eraseTile':
                    // Apply tile erasure
                    if (targetLayers[edit.layer] && targetLayers[edit.layer][edit.y]) {
                        targetLayers[edit.layer][edit.y][edit.x] = null;
                    }
                    if (!edit.mapName || edit.mapName === currentMapName) {
                        renderMap();
                    }
                    break;

                case 'tileSound':
                    // Apply tile sound placement
                    tileSounds[edit.key] = edit.sound;
                    updatePlacedSoundsList();
                    renderMap();
                    break;

                case 'removeTileSound':
                    // Remove tile sound
                    delete tileSounds[edit.key];
                    updatePlacedSoundsList();
                    renderMap();
                    break;

                case 'light':
                    // Apply light placement
                    pointLights[edit.key] = edit.light;
                    updatePlacedLightsList();
                    renderMap();
                    break;

                case 'removeLight':
                    // Remove light
                    delete pointLights[edit.key];
                    updatePlacedLightsList();
                    renderMap();
                    break;

                case 'addPolyLight':
                    // Add polygon light
                    polyLights.push(edit.light);
                    updatePolyLightsList();
                    renderMap();
                    break;

                case 'removePolyLight':
                    // Remove polygon light by ID
                    const polyIdx = polyLights.findIndex(pl => pl.id === edit.lightId);
                    if (polyIdx >= 0) {
                        polyLights.splice(polyIdx, 1);
                        updatePolyLightsList();
                        renderMap();
                    }
                    break;

                case 'placeNpc':
                    // Add NPC (guard against duplicate from catch-up replay / resync)
                    if (!_placedNpcExists(edit.npc)) placedNpcs.push(edit.npc);
                    updatePlacedNpcList();
                    renderMap();
                    break;

                case 'removeNpc':
                    // Remove NPC by index
                    if (edit.index >= 0 && edit.index < placedNpcs.length) {
                        placedNpcs.splice(edit.index, 1);
                        updatePlacedNpcList();
                        renderMap();
                    }
                    break;

                case 'placeTrigger':
                    // Add trigger (guard against duplicate from catch-up replay / resync)
                    if (!_placedTriggerExists(edit.trigger)) placedTriggers.push(edit.trigger);
                    updateTriggerList();
                    renderMap();
                    break;

                case 'removeTrigger': {
                    // Wave 7: prefer UID lookup, fall back to index for pre-UID peers.
                    let idx = (edit.uid) ? findTriggerByUid(edit.uid) : -1;
                    if (idx < 0 && typeof edit.index === 'number' && edit.index >= 0 && edit.index < placedTriggers.length) idx = edit.index;
                    if (idx >= 0 && idx < placedTriggers.length) {
                        placedTriggers.splice(idx, 1);
                        updateTriggerList();
                        renderMap();
                    } else if (edit.uid) {
                        console.warn('[MP] removeTrigger: uid', edit.uid, 'not found locally');
                    }
                    break;
                }

                case 'updateTrigger': {
                    // Wave 7: prefer UID lookup over fragile array-index.
                    let idx = (edit.uid) ? findTriggerByUid(edit.uid) : -1;
                    if (idx < 0 && edit.trigger && edit.trigger.uid) idx = findTriggerByUid(edit.trigger.uid);
                    if (idx < 0 && typeof edit.index === 'number' && edit.index >= 0 && edit.index < placedTriggers.length) idx = edit.index;
                    if (idx >= 0 && idx < placedTriggers.length && edit.trigger) {
                        placedTriggers[idx] = edit.trigger;
                        updateTriggerList();
                        renderMap();
                        console.log('[BUILDER MP] Remote trigger updated:', idx, edit.trigger.uid || '(no uid)');
                    } else if (edit.uid || (edit.trigger && edit.trigger.uid)) {
                        console.warn('[MP] updateTrigger: uid not found locally', edit.uid || edit.trigger.uid);
                    }
                    break;
                }

                case 'placeItem':
                    // Add item (guard against duplicate from catch-up replay / resync)
                    if (!_placedItemExists(edit.item)) placedItems.push(edit.item);
                    updatePlacedItemsList();
                    renderMap();
                    console.log('[BUILDER MP] Remote item placed');
                    break;

                case 'removeItem':
                    // Remove item by position
                    const itemIdx = placedItems.findIndex(p =>
                        p.x === edit.x && p.y === edit.y &&
                        (!p.mapName || p.mapName === edit.mapName)
                    );
                    if (itemIdx >= 0) {
                        placedItems.splice(itemIdx, 1);
                        updatePlacedItemsList();
                        renderMap();
                        console.log('[BUILDER MP] Remote item removed');
                    }
                    break;

                case 'updatePlacedAnimProp':
                    // Update placed anim prop (e.g., instance item override)
                    if (edit.index >= 0 && edit.index < placedAnimProps.length) {
                        placedAnimProps[edit.index] = edit.prop;
                        renderMap();
                        console.log('[BUILDER MP] Remote placed anim prop updated:', edit.index);
                    }
                    break;

                case 'collision':
                    // Apply collision change
                    if (edit.value) {
                        tileCollisions[edit.key] = true;
                    } else {
                        delete tileCollisions[edit.key];
                    }
                    break;

                case 'collisionMask':
                    // Apply collision mask
                    collisionMasks[edit.key] = edit.mask;
                    break;

                case 'addLayer':
                    // Add new layer (from another builder)
                    if (edit.mapName === currentMapName) {
                        addLayer(true); // true = from network, don't rebroadcast
                    } else if (maps[edit.mapName]) {
                        maps[edit.mapName].layers.push(createEmptyLayer());
                    }
                    break;

                case 'addMap':
                    // Another builder created a new map
                    if (!maps[edit.mapName]) {
                        createMapData(edit.mapName);
                        updateMapDropdowns();
                        console.log('[BUILDER MP] Remote map created:', edit.mapName);
                    }
                    break;

                case 'deleteMap':
                    // Another builder deleted a map
                    if (maps[edit.mapName]) {
                        deleteMap(edit.mapName);
                        updateMapDropdowns();
                        updateTriggerList();
                        renderMap();
                        console.log('[BUILDER MP] Remote map deleted:', edit.mapName);
                    }
                    break;

                case 'clearMap':
                    // Another builder cleared a map
                    if (edit.mapName === currentMapName) {
                        initMap();
                        mapInitialized = true;
                        renderMap();
                    } else if (maps[edit.mapName]) {
                        // Clear the other map's data
                        maps[edit.mapName].layers = [createEmptyLayer()];
                        maps[edit.mapName].tileCollisions = {};
                        maps[edit.mapName].collisionMasks = {};
                    }
                    console.log('[BUILDER MP] Remote map cleared:', edit.mapName);
                    break;

                case 'addAnimProp':
                    // Another builder added an animated prop
                    animatedProps.push(edit.prop);
                    // Load the sprite image
                    if (edit.prop.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            animatedProps[animatedProps.length - 1]._spriteImg = img;
                            updateAnimPropListDisplay();
                            renderMap();
                        };
                        img.src = edit.prop.spriteData;
                    }
                    updateAnimPropListDisplay();
                    console.log('[BUILDER MP] Remote anim prop added:', edit.prop.name);
                    break;

                case 'removeAnimProp':
                    // Another builder removed an animated prop
                    if (edit.index >= 0 && edit.index < animatedProps.length) {
                        animatedProps.splice(edit.index, 1);
                        // Wave 5: also reindex animTile cells across every map's layers.
                        reindexAnimPropReferences(edit.index);
                        updateAnimPropListDisplay();
                        renderMap();
                        console.log('[BUILDER MP] Remote anim prop removed:', edit.index);
                    }
                    break;

                case 'addStaticObj':
                    // Another builder created a static object
                    const newStaticObj = {
                        name: edit.obj.name,
                        spriteData: edit.obj.spriteData,
                        width: edit.obj.width,
                        height: edit.obj.height,
                        tilesetIndex: edit.obj.tilesetIndex,
                        sourceTiles: edit.obj.sourceTiles,
                        sourceOrigin: edit.obj.sourceOrigin,
                        _spriteImg: new Image()
                    };
                    newStaticObj._spriteImg.onload = () => {
                        updateStaticObjectsList();
                        renderMap();
                    };
                    newStaticObj._spriteImg.src = edit.obj.spriteData;
                    staticObjects.push(newStaticObj);
                    updateStaticObjectsList();
                    console.log('[BUILDER MP] Remote static object added:', edit.obj.name);
                    break;

                case 'removeStaticObj':
                    // Another builder removed a static object definition
                    if (edit.index >= 0 && edit.index < staticObjects.length) {
                        placedStaticObjects = placedStaticObjects.filter(p => p.objIndex !== edit.index);
                        placedStaticObjects.forEach(p => {
                            if (p.objIndex > edit.index) p.objIndex--;
                        });
                        staticObjects.splice(edit.index, 1);
                        if (currentStaticObjIndex >= staticObjects.length) {
                            currentStaticObjIndex = staticObjects.length - 1;
                        }
                        updateStaticObjectsList();
                        renderMap();
                        console.log('[BUILDER MP] Remote static object removed:', edit.index);
                    }
                    break;

                case 'placeStaticObj':
                    // Another builder placed a static object
                    if (edit.placed) {
                        placedStaticObjects.push(edit.placed);
                        renderMap();
                        console.log('[BUILDER MP] Remote static object placed at', edit.placed.x, edit.placed.y);
                    }
                    break;

                case 'removeStaticObjPlacement':
                    // Another builder removed a placed static object
                    placedStaticObjects = placedStaticObjects.filter(p =>
                        !(p.x === edit.x && p.y === edit.y && p.mapName === edit.mapName)
                    );
                    renderMap();
                    console.log('[BUILDER MP] Remote static object placement removed');
                    break;

                case 'updateStaticObjCollision':
                    // Another builder updated a static object's collision box
                    if (edit.index >= 0 && edit.index < placedStaticObjects.length) {
                        placedStaticObjects[edit.index].collisionBox = edit.collisionBox;
                        renderMap();
                        console.log('[BUILDER MP] Remote static object collision updated:', edit.index);
                    }
                    break;

                case 'updateAnimProp':
                    // Another builder updated an animated prop
                    if (edit.index >= 0 && edit.index < animatedProps.length) {
                        animatedProps[edit.index] = edit.prop;
                        // Load the sprite image
                        if (edit.prop.spriteData) {
                            const img = new Image();
                            img.onload = () => {
                                animatedProps[edit.index]._spriteImg = img;
                                updateAnimPropListDisplay();
                                renderMap();
                            };
                            img.src = edit.prop.spriteData;
                        }
                        updateAnimPropListDisplay();
                        console.log('[BUILDER MP] Remote anim prop updated:', edit.index);
                    }
                    break;

                case 'addTileset':
                    // Another builder added a tileset
                    if (edit.name && edit.data) {
                        const img = new Image();
                        img.onload = () => {
                            tilesets.push({ name: edit.name, img: img, data: edit.data });
                            updateTilesetDropdown();
                            renderMap();
                            console.log('[BUILDER MP] Remote tileset added:', edit.name);
                        };
                        img.src = edit.data;
                    }
                    break;

                case 'addNpc':
                    // Another builder added an NPC definition
                    if (edit.npc) {
                        npcs.push({ ...edit.npc });
                        const idx = npcs.length - 1;
                        if (edit.npc.spriteData) {
                            const img = new Image();
                            img.onload = () => {
                                npcs[idx]._editorImg = img; // Wave 8: canonical property.
                                updateNpcList();
                            };
                            img.src = edit.npc.spriteData;
                        }
                        updateNpcList();
                        console.log('[BUILDER MP] Remote NPC added:', edit.npc.name);
                    }
                    break;

                case 'updateNpc':
                    // Another builder updated an NPC definition
                    if (edit.index >= 0 && edit.index < npcs.length && edit.npc) {
                        npcs[edit.index] = { ...edit.npc };
                        if (edit.npc.spriteData) {
                            const img = new Image();
                            img.onload = () => {
                                npcs[edit.index]._editorImg = img; // Wave 8: canonical property.
                                updateNpcList();
                            };
                            img.src = edit.npc.spriteData;
                        }
                        updateNpcList();
                        console.log('[BUILDER MP] Remote NPC updated:', edit.npc.name);
                    }
                    break;

                case 'updatePlacedNpc':
                    // Another builder updated a placed NPC (enemy settings, path, speed, etc.)
                    if (edit.index >= 0 && edit.index < placedNpcs.length && edit.npc) {
                        placedNpcs[edit.index] = edit.npc;
                        // Refresh UI if this NPC is currently selected
                        if (selectedPlacedNpcIndex === edit.index) {
                            selectPlacedNpc(edit.index);
                        }
                        updatePlacedNpcList();
                        renderMap();
                        console.log('[BUILDER MP] Remote placed NPC updated at index:', edit.index);
                    }
                    break;

                case 'addDialog':
                    // Another builder added a dialog
                    if (edit.dialog) {
                        dialogs.push(edit.dialog);
                        updateDialogList();
                        console.log('[BUILDER MP] Remote dialog added:', edit.dialog.name);
                    }
                    break;

                case 'updateDialog':
                    // Another builder updated a dialog
                    if (edit.index >= 0 && edit.index < dialogs.length && edit.dialog) {
                        dialogs[edit.index] = edit.dialog;
                        updateDialogList();
                        console.log('[BUILDER MP] Remote dialog updated:', edit.dialog.name);
                    }
                    break;

                case 'deleteDialog':
                    // Another builder deleted a dialog
                    if (edit.index >= 0 && edit.index < dialogs.length) {
                        dialogs.splice(edit.index, 1);
                        // Wave 5: full cascade — placedDialogTiles, placedNpcs.dialogIndex,
                        // quest hook IDs, shops[].greetingDialogId.
                        reindexDialogReferences(edit.index);
                        updateDialogList();
                        if (typeof renderQuestList === 'function') renderQuestList();
                        if (typeof updateShopList === 'function') updateShopList();
                        renderMap();
                        console.log('[BUILDER MP] Remote dialog deleted:', edit.index);
                    }
                    break;

                case 'attachNpcDialog':
                    // Another builder attached a dialog to an NPC
                    if (edit.npcIndex >= 0 && edit.npcIndex < placedNpcs.length) {
                        placedNpcs[edit.npcIndex].dialogIndex = edit.dialogIndex;
                        if (edit.dialogTrigger) {
                            placedNpcs[edit.npcIndex].dialogTrigger = edit.dialogTrigger;
                        } else if (edit.dialogIndex < 0) {
                            delete placedNpcs[edit.npcIndex].dialogTrigger;
                        }
                        updateDialogNpcDropdown();
                        console.log('[BUILDER MP] Remote NPC dialog attached:', edit.npcIndex, '->', edit.dialogIndex);
                    }
                    break;

                case 'deleteLayer':
                    // Another builder deleted a layer
                    if (edit.mapName === currentMapName) {
                        deleteLayer(edit.index, true);
                    } else if (maps[edit.mapName]) {
                        maps[edit.mapName].layers.splice(edit.index, 1);
                        maps[edit.mapName].layerVisibility.splice(edit.index, 1);
                        maps[edit.mapName].layerNames.splice(edit.index, 1);
                    }
                    console.log('[BUILDER MP] Remote layer deleted:', edit.index);
                    break;

                case 'moveLayerUp':
                    // Another builder moved a layer up
                    if (edit.mapName === currentMapName) {
                        moveLayerUp(edit.index, true);
                    } else if (maps[edit.mapName] && edit.index > 0) {
                        const m = maps[edit.mapName];
                        [m.layers[edit.index], m.layers[edit.index-1]] = [m.layers[edit.index-1], m.layers[edit.index]];
                        [m.layerVisibility[edit.index], m.layerVisibility[edit.index-1]] = [m.layerVisibility[edit.index-1], m.layerVisibility[edit.index]];
                        [m.layerNames[edit.index], m.layerNames[edit.index-1]] = [m.layerNames[edit.index-1], m.layerNames[edit.index]];
                    }
                    break;

                case 'moveLayerDown':
                    // Another builder moved a layer down
                    if (edit.mapName === currentMapName) {
                        moveLayerDown(edit.index, true);
                    } else if (maps[edit.mapName] && edit.index < maps[edit.mapName].layers.length - 1) {
                        const m = maps[edit.mapName];
                        [m.layers[edit.index], m.layers[edit.index+1]] = [m.layers[edit.index+1], m.layers[edit.index]];
                        [m.layerVisibility[edit.index], m.layerVisibility[edit.index+1]] = [m.layerVisibility[edit.index+1], m.layerVisibility[edit.index]];
                        [m.layerNames[edit.index], m.layerNames[edit.index+1]] = [m.layerNames[edit.index+1], m.layerNames[edit.index]];
                    }
                    break;

                case 'renameLayer':
                    // Another builder renamed a layer
                    if (edit.mapName === currentMapName) {
                        renameLayer(edit.index, edit.name, true);
                    } else if (maps[edit.mapName]) {
                        maps[edit.mapName].layerNames[edit.index] = edit.name;
                    }
                    break;

                case 'renameMap':
                    // Wave 4: use shared cascade helper for complete coverage of .mapName-tagged
                    // arrays + prefix-keyed dicts (covers items, dialogTiles, animProps, staticObjects,
                    // shops, polyLights, tileSounds keys, pointLights keys).
                    if (maps[edit.oldName]) {
                        cascadeMapRename(edit.oldName, edit.newName);
                        updateMapDropdowns();
                        updateTriggerList();
                        if (typeof updatePlacedLightsList === 'function') updatePlacedLightsList();
                        if (typeof updatePolyLightsList === 'function') updatePolyLightsList();
                        if (typeof updatePlacedSoundsList === 'function') updatePlacedSoundsList();
                        renderMap();
                        console.log('[BUILDER MP] Remote map renamed:', edit.oldName, '->', edit.newName);
                    }
                    break;

                case 'cameraBounds':
                    // Another builder set/cleared camera bounds
                    if (edit.mapName === currentMapName) {
                        cameraBounds = edit.bounds;
                        updateCameraBoundsInfo();
                        renderMap();
                    } else if (maps[edit.mapName]) {
                        maps[edit.mapName].cameraBounds = edit.bounds;
                    }
                    break;

                case 'fishZones':
                    // Another builder added/cleared fish zones
                    if (edit.mapName === currentMapName) {
                        fishZones = (edit.zones || []).map(z => ({ ...z }));
                        updateFishZonesInfo();
                        renderMap();
                    } else if (maps[edit.mapName]) {
                        maps[edit.mapName].fishZones = (edit.zones || []).map(z => ({ ...z }));
                    }
                    break;

                case 'selectAllCollision':
                    // Another builder filled all collision for a tileset
                    selectAllCollision(true, edit.tilesetIndex);
                    break;

                case 'clearAllCollision':
                    // Another builder cleared all collision for a tileset
                    clearAllCollision(true, edit.tilesetIndex);
                    break;

                case 'splitLine':
                    // Another builder set a split line
                    console.log('[SYNC] Received splitLine:', edit.key, 'mask:', edit.mask);
                    if (edit.mask && Array.isArray(edit.mask)) {
                        tileSplitLines[edit.key] = edit.mask;
                    } else {
                        // Fallback: flat line at middle
                        tileSplitLines[edit.key] = new Array(16).fill(8);
                    }
                    drawCollisionTileset();
                    break;

                case 'clearSplitLine':
                    // Another builder cleared a split line
                    delete tileSplitLines[edit.key];
                    delete tileSplitLineFlipped[edit.key];
                    drawCollisionTileset();
                    break;

                case 'splitLineFlip':
                    // Another builder changed split line flip state
                    if (edit.flipped) {
                        tileSplitLineFlipped[edit.key] = true;
                    } else {
                        delete tileSplitLineFlipped[edit.key];
                    }
                    drawCollisionTileset();
                    break;

                case 'addPlayerCharacter':
                    // Another builder added a player character
                    if (edit.character) {
                        playerCharacters.push({ ...edit.character });
                        const idx = playerCharacters.length - 1;
                        if (edit.character.spriteData) {
                            const img = new Image();
                            img.onload = () => {
                                playerCharacters[idx]._spriteImg = img;
                                updatePlayerList();
                            };
                            img.src = edit.character.spriteData;
                        }
                        updatePlayerList();
                        console.log('[BUILDER MP] Remote player character added:', edit.character.name);
                    }
                    break;

                case 'updatePlayerCharacter':
                    // Another builder updated a player character
                    if (edit.index >= 0 && edit.index < playerCharacters.length && edit.character) {
                        playerCharacters[edit.index] = { ...edit.character };
                        if (edit.character.spriteData) {
                            const img = new Image();
                            img.onload = () => {
                                playerCharacters[edit.index]._spriteImg = img;
                                updatePlayerList();
                            };
                            img.src = edit.character.spriteData;
                        }
                        updatePlayerList();
                        console.log('[BUILDER MP] Remote player character updated:', edit.character.name);
                    }
                    break;

                case 'deletePlayerCharacter':
                    // Another builder deleted a player character
                    if (edit.index >= 0 && edit.index < playerCharacters.length) {
                        playerCharacters.splice(edit.index, 1);
                        if (activePlayerIndex >= playerCharacters.length) {
                            activePlayerIndex = playerCharacters.length - 1;
                        }
                        updatePlayerList();
                        console.log('[BUILDER MP] Remote player character deleted:', edit.index);
                    }
                    break;

                case 'setActivePlayer':
                    // Another builder changed active player
                    if (edit.index >= -1 && edit.index < playerCharacters.length) {
                        activePlayerIndex = edit.index;
                        updatePlayerList();
                        console.log('[BUILDER MP] Remote active player changed:', edit.index);
                    }
                    break;

                case 'addItem':
                    // Another builder added an item definition
                    if (edit.item) {
                        items.push(edit.item);
                        if (edit.item.spriteData) {
                            const img = new Image();
                            img.onload = () => {
                                itemImages[items.length - 1] = img;
                                updateItemList();
                            };
                            img.src = edit.item.spriteData;
                        }
                        updateItemList();
                        console.log('[BUILDER MP] Remote item definition added:', edit.item.name);
                    }
                    break;

                case 'updateItem':
                    // Another builder updated an item definition
                    if (edit.index >= 0 && edit.index < items.length && edit.item) {
                        items[edit.index] = edit.item;
                        if (edit.item.spriteData) {
                            const img = new Image();
                            img.onload = () => {
                                itemImages[edit.index] = img;
                                updateItemList();
                            };
                            img.src = edit.item.spriteData;
                        }
                        updateItemList();
                        console.log('[BUILDER MP] Remote item definition updated:', edit.item.name);
                    }
                    break;

                case 'deleteItem':
                    // Another builder deleted an item definition
                    if (edit.index >= 0 && edit.index < items.length) {
                        items.splice(edit.index, 1);
                        // Wave 5: fan-out reindex (placedItems, shops, animProps, NPC drops).
                        reindexItemReferences(edit.index);
                        // itemImages object-map cleanup: delete + shift higher keys.
                        delete itemImages[edit.index];
                        const keys = Object.keys(itemImages).map(k => parseInt(k, 10)).filter(Number.isFinite).sort((a,b)=>a-b);
                        for (const k of keys) {
                            if (k > edit.index) { itemImages[k - 1] = itemImages[k]; delete itemImages[k]; }
                        }
                        updateItemList();
                        if (typeof updatePlacedItemsList === 'function') updatePlacedItemsList();
                        if (typeof updateShopList === 'function') updateShopList();
                        renderMap();
                        console.log('[BUILDER MP] Remote item definition deleted:', edit.index);
                    }
                    break;

                // ===== QUEST SYNC HANDLERS =====
                case 'addQuest':
                    // Another builder added a quest. Dedup by id so catch-up replays are idempotent.
                    if (edit.quest) {
                        const existing = quests.findIndex(q => q.id === edit.quest.id);
                        if (existing >= 0) quests[existing] = edit.quest;
                        else quests.push(edit.quest);
                        renderQuestList();
                        console.log('[BUILDER MP] Remote quest added:', edit.quest.name);
                    }
                    break;

                case 'updateQuest':
                    // Another builder updated a quest field
                    if (edit.questId) {
                        const questIndex = quests.findIndex(q => q.id === edit.questId);
                        if (questIndex >= 0 && edit.quest) {
                            quests[questIndex] = edit.quest;
                            if (selectedQuestIndex === questIndex) {
                                loadQuestIntoEditor(questIndex);
                            }
                            renderQuestList();
                            console.log('[BUILDER MP] Remote quest updated:', edit.quest.name);
                        }
                    }
                    break;

                case 'deleteQuest':
                    // Another builder deleted a quest
                    if (edit.questId) {
                        const questIndex = quests.findIndex(q => q.id === edit.questId);
                        if (questIndex >= 0) {
                            quests.splice(questIndex, 1);
                            if (selectedQuestIndex === questIndex) {
                                selectedQuestIndex = -1;
                                document.getElementById('questEditorPanel').style.display = 'none';
                            } else if (selectedQuestIndex > questIndex) {
                                selectedQuestIndex--;
                            }
                            renderQuestList();
                            console.log('[BUILDER MP] Remote quest deleted:', edit.questId);
                        }
                    }
                    break;

                case 'addQuestSound':
                    // Another builder added a quest sound to library
                    if (edit.sound) {
                        questSounds.push({ name: edit.sound.name, data: edit.sound.data });
                        updateQuestSoundDropdown();
                        console.log('[BUILDER MP] Quest sound added:', edit.sound.name);
                    }
                    break;

                case 'deleteQuestSound':
                    // Another builder deleted a quest sound
                    if (edit.index >= 0 && edit.index < questSounds.length) {
                        questSounds.splice(edit.index, 1);
                        // Update quests that used this sound
                        quests.forEach(quest => {
                            if (quest.startSoundIndex === edit.index) {
                                quest.startSoundIndex = -1;
                            } else if (quest.startSoundIndex > edit.index) {
                                quest.startSoundIndex--;
                            }
                        });
                        updateQuestSoundDropdown();
                        console.log('[BUILDER MP] Quest sound deleted at index:', edit.index);
                    }
                    break;

                case 'reorderQuests':
                    // Another builder reordered quests
                    if (edit.quests && Array.isArray(edit.quests)) {
                        const newOrder = [];
                        edit.quests.forEach(questId => {
                            const quest = quests.find(q => q.id === questId);
                            if (quest) newOrder.push(quest);
                        });
                        // Add any quests that weren't in the reorder list (shouldn't happen but safety)
                        quests.forEach(q => {
                            if (!newOrder.find(nq => nq.id === q.id)) {
                                newOrder.push(q);
                            }
                        });
                        quests.length = 0;
                        quests.push(...newOrder);
                        renderQuestList();
                        console.log('[BUILDER MP] Quests reordered');
                    }
                    break;

                case 'expandMap':
                    // Another builder expanded a map
                    if (edit.direction && edit.mapName) {
                        if (edit.mapName === currentMapName) {
                            expandMap(edit.direction, true); // true = fromNetwork
                        } else if (maps[edit.mapName]) {
                            // Expand another map's data
                            const targetMap = maps[edit.mapName];
                            const dir = edit.direction;
                            const mapWidth = targetMap.layers[0][0].length;
                            const mapHeight = targetMap.layers[0].length;

                            targetMap.layers.forEach(layer => {
                                if (dir === 'right' || dir === 'left') {
                                    layer.forEach(row => {
                                        if (dir === 'right') row.push(null);
                                        else row.unshift(null);
                                    });
                                } else {
                                    const newRow = new Array(mapWidth + (dir === 'left' || dir === 'right' ? 1 : 0)).fill(null);
                                    if (dir === 'down') layer.push([...newRow]);
                                    else layer.unshift([...newRow]);
                                }
                            });
                        }
                        console.log('[BUILDER MP] Remote map expanded:', edit.mapName, edit.direction);
                    }
                    break;

                case 'deleteTileset':
                    // Another builder deleted a tileset
                    if (edit.index >= 0 && edit.index < tilesets.length) {
                        deleteTileset(true, edit.index); // true = fromNetwork
                        console.log('[BUILDER MP] Remote tileset deleted:', edit.index);
                    }
                    break;

                case 'startEditing':
                    // Another builder started editing something
                    if (edit.editorType && edit.editorIndex !== undefined && edit.username) {
                        const key = edit.editorType + ':' + edit.editorIndex;
                        currentlyEditing[key] = { username: edit.username };
                        console.log('[BUILDER MP] Remote user started editing:', key, 'by', edit.username);
                    }
                    break;

                case 'stopEditing':
                    // Another builder stopped editing something
                    if (edit.editorType && edit.editorIndex !== undefined) {
                        const key = edit.editorType + ':' + edit.editorIndex;
                        delete currentlyEditing[key];
                        console.log('[BUILDER MP] Remote user stopped editing:', key);
                    }
                    break;

                // Shop system
                case 'addShop':
                    if (edit.shop) {
                        shops.push(edit.shop);
                        if (mode === 'shop') {
                            updateShopList();
                            updateNpcShopList();
                        }
                        console.log('[BUILDER MP] Remote shop added:', edit.shop.name);
                    }
                    break;

                case 'updateShop':
                    if (edit.index >= 0 && edit.index < shops.length && edit.shop) {
                        shops[edit.index] = edit.shop;
                        if (mode === 'shop') {
                            updateShopList();
                            updateSelectedShopInfo();
                        }
                        console.log('[BUILDER MP] Remote shop updated:', edit.shop.name);
                    }
                    break;

                case 'deleteShop':
                    if (edit.index >= 0 && edit.index < shops.length) {
                        // Update NPC references
                        placedNpcs.forEach(p => {
                            if (p.shopIndex === edit.index) {
                                p.shopIndex = -1;
                            } else if (p.shopIndex > edit.index) {
                                p.shopIndex--;
                            }
                        });
                        // Update placed shops
                        placedShops = placedShops.filter(ps => ps.shopIndex !== edit.index);
                        placedShops.forEach(ps => { if (ps.shopIndex > edit.index) ps.shopIndex--; });

                        shops.splice(edit.index, 1);
                        if (selectedShopIndex === edit.index) selectedShopIndex = -1;
                        else if (selectedShopIndex > edit.index) selectedShopIndex--;

                        if (mode === 'shop') {
                            updateShopList();
                            updateSelectedShopInfo();
                            updateNpcShopList();
                        }
                        console.log('[BUILDER MP] Remote shop deleted');
                    }
                    break;

                case 'updateStartingGold':
                    if (edit.value !== undefined) {
                        startingGold = edit.value;
                        const goldInput = document.getElementById('startingGoldInput');
                        if (goldInput) goldInput.value = startingGold;
                        console.log('[BUILDER MP] Starting gold updated:', startingGold);
                    }
                    break;

                // ===== Wave 3 additions =====
                case 'setPlayerSpawn':
                    if (typeof edit.x === 'number' && typeof edit.y === 'number') {
                        playerPreviewPos = { x: edit.x, y: edit.y };
                        if (edit.mapName) spawnMapName = edit.mapName;
                        playerPreviewVisible = true;
                        renderMap();
                        console.log('[BUILDER MP] Spawn updated:', spawnMapName, edit.x, edit.y);
                    }
                    break;

                case 'lightingSettings':
                    if (edit.settings && typeof edit.settings === 'object') {
                        Object.assign(lightingSettings, edit.settings);
                        const playerLightEl = document.getElementById('playerLight');
                        const radiusEl = document.getElementById('playerLightRadius');
                        const radiusVal = document.getElementById('playerLightRadiusVal');
                        if (playerLightEl) playerLightEl.checked = !!lightingSettings.playerLight;
                        if (radiusEl) radiusEl.value = lightingSettings.playerLightRadius;
                        if (radiusVal) radiusVal.textContent = lightingSettings.playerLightRadius;
                        renderMap();
                    }
                    break;

                case 'placeDialogTile':
                    if (edit.tile) {
                        placedDialogTiles.push(edit.tile);
                        renderMap();
                    }
                    break;
                case 'updateDialogTile':
                    if (typeof edit.index === 'number' && edit.index >= 0 && edit.index < placedDialogTiles.length && edit.tile) {
                        placedDialogTiles[edit.index] = edit.tile;
                        renderMap();
                    }
                    break;
                case 'removeDialogTile':
                    if (typeof edit.index === 'number' && edit.index >= 0 && edit.index < placedDialogTiles.length) {
                        placedDialogTiles.splice(edit.index, 1);
                        renderMap();
                    }
                    break;

                case 'addSound':
                    if (edit.sound && edit.sound.name) {
                        const insertIdx = (typeof edit.index === 'number') ? edit.index : sounds.length;
                        sounds[insertIdx] = {
                            name: edit.sound.name,
                            data: edit.sound.data,
                            duration: edit.sound.duration || 0,
                            type: edit.sound.type || 'ambient'
                        };
                        if (typeof updateSoundDropdown === 'function') updateSoundDropdown();
                        if (typeof updatePlayerSoundAssignments === 'function') updatePlayerSoundAssignments();
                    }
                    break;
                case 'removeSound':
                    if (typeof edit.index === 'number' && edit.index >= 0 && edit.index < sounds.length) {
                        sounds.splice(edit.index, 1);
                        reindexSoundReferences(edit.index);
                        if (typeof updateSoundDropdown === 'function') updateSoundDropdown();
                        if (typeof updatePlayerSoundAssignments === 'function') updatePlayerSoundAssignments();
                        if (typeof updatePlacedSoundsList === 'function') updatePlacedSoundsList();
                        renderMap();
                    }
                    break;
                case 'setPlayerSound':
                    if (edit.action && edit.config) {
                        if (!playerSounds) playerSounds = {};
                        playerSounds[edit.action] = { ...(playerSounds[edit.action] || {}), ...edit.config };
                        if (typeof updatePlayerSoundAssignments === 'function') updatePlayerSoundAssignments();
                    }
                    break;

                case 'deleteNpc':
                    if (typeof edit.index === 'number' && edit.index >= 0 && edit.index < npcs.length) {
                        npcs.splice(edit.index, 1);
                        reindexNpcReferences(edit.index);
                        if (typeof updateNpcList === 'function') updateNpcList();
                        if (typeof updatePlacedNpcList === 'function') updatePlacedNpcList();
                        renderMap();
                        console.log('[BUILDER MP] NPC definition deleted:', edit.index);
                    }
                    break;
                // ===== end Wave 3 additions =====
            }
        }

        // Version without renderMap calls (for batching)
        function applyRemoteEditNoRender(edit) {
            let targetLayers = (edit.mapName && edit.mapName !== currentMapName && maps[edit.mapName])
                ? maps[edit.mapName].layers : layers;

            switch (edit.editType) {
                case 'tile':
                    if (!targetLayers[edit.layer]) targetLayers[edit.layer] = [];
                    if (!targetLayers[edit.layer][edit.y]) targetLayers[edit.layer][edit.y] = [];
                    targetLayers[edit.layer][edit.y][edit.x] = edit.cell;
                    break;
                case 'eraseTile':
                    if (targetLayers[edit.layer] && targetLayers[edit.layer][edit.y]) {
                        targetLayers[edit.layer][edit.y][edit.x] = null;
                    }
                    break;
                case 'tileSound':
                    tileSounds[edit.key] = edit.sound;
                    break;
                case 'removeTileSound':
                    delete tileSounds[edit.key];
                    break;
                case 'light':
                    pointLights[edit.key] = edit.light;
                    break;
                case 'removeLight':
                    delete pointLights[edit.key];
                    break;
                case 'placeNpc':
                    if (!_placedNpcExists(edit.npc)) placedNpcs.push(edit.npc);
                    break;
                case 'removeNpc':
                    if (edit.index >= 0 && edit.index < placedNpcs.length) {
                        placedNpcs.splice(edit.index, 1);
                    }
                    break;
                case 'placeTrigger':
                    if (!_placedTriggerExists(edit.trigger)) placedTriggers.push(edit.trigger);
                    break;
                case 'removeTrigger':
                    if (edit.index >= 0 && edit.index < placedTriggers.length) {
                        placedTriggers.splice(edit.index, 1);
                    }
                    break;
                case 'collision':
                    if (edit.value) tileCollisions[edit.key] = true;
                    else delete tileCollisions[edit.key];
                    break;
                case 'collisionMask':
                    collisionMasks[edit.key] = edit.mask;
                    break;
                default:
                    // Wave 2 (R1): unknown editTypes in a batch fall through to the full dispatcher.
                    // Previously these were silently dropped. Now they're applied correctly;
                    // the per-edit renderMap calls are minor perf cost in a 250ms batch window.
                    console.warn('[MP] batch delegating to full dispatcher:', edit.editType);
                    try { applyRemoteEdit(edit); } catch (e) { console.error('[MP] delegate failed:', e, edit); }
                    break;
            }
        }

        // Batching system for builder edits
        let editBatch = [];
        let batchTimeout = null;
        const BATCH_DELAY = 250; // ms to wait before sending batch (higher = less network traffic)

        // Session edit log — every broadcast we make locally. When a late joiner arrives,
        // the host replays this log so the joiner catches up. Users share BASE saves
        // out-of-band (download/upload). We only sync in-session deltas.
        let sessionEditLog = [];
        const SESSION_LOG_MAX = 5000; // safety cap

        function broadcastEdit(editData) {
            // Track this edit in the session log for late-joiner replay.
            if (sessionEditLog.length < SESSION_LOG_MAX) sessionEditLog.push(editData);

            // Send to test game window directly (works in solo mode)
            if (testGameWindow && !testGameWindow.closed) {
                try {
                    testGameWindow.postMessage({ type: 'builderEdit', edit: editData }, '*');
                } catch (e) {
                    // Window might be closed or cross-origin
                }
            }

            // Also broadcast via WebSocket if in CO-OP mode
            if (!builderConnected || !builderSocket) return;

            // Add to batch
            editBatch.push(editData);

            // If no pending send, schedule one
            if (!batchTimeout) {
                batchTimeout = setTimeout(flushEditBatch, BATCH_DELAY);
            }
        }

        function flushEditBatch() {
            batchTimeout = null;
            if (editBatch.length === 0 || !builderConnected || !builderSocket) return;

            if (editBatch.length === 1) {
                // Single edit - send normally
                builderSocket.send(JSON.stringify({
                    type: 'update',
                    ...editBatch[0],
                    gameType: 'builder'
                }));
            } else {
                // Multiple edits - send as batch
                builderSocket.send(JSON.stringify({
                    type: 'update',
                    editType: 'batch',
                    edits: editBatch,
                    gameType: 'builder'
                }));
            }
            editBatch = [];
        }

        // Warn before closing tab if in co-op mode
        window.addEventListener('beforeunload', (e) => {
            if (builderConnected) {
                e.preventDefault();
                e.returnValue = 'You are in a co-op session. Make sure to save your work!';
                return e.returnValue;
            }
        });

        function showBuilderStatus(msg) {
            // Show connection status in Tools dropdown menu
            const statusEl = document.getElementById('coopStatusInMenu');
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.textContent = 'CO-OP: ' + msg;
                if (msg.includes('Disconnected')) {
                    statusEl.className = 'coop-status-menu disconnected';
                } else {
                    statusEl.className = 'coop-status-menu connected';
                }
            }
            // Also update tools button to show connection indicator
            const toolsBtn = document.querySelector('.tools-toggle');
            if (toolsBtn) {
                if (msg.includes('Disconnected')) {
                    toolsBtn.innerHTML = '⚙ Tools ▼';
                } else {
                    toolsBtn.innerHTML = '⚙ Tools <span style="color:#0f0;">●</span> ▼';
                }
            }
        }

        function showRoomInfo() {
            // Create or update room info modal
            let modal = document.getElementById('roomInfoModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'roomInfoModal';
                modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:10000;';
                modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
                document.body.appendChild(modal);
            }

            // Build content - retro styled
            let html = '<div style="background:#1a1a1a;border:3px solid #fff;padding:25px;min-width:320px;max-width:500px;font-family:\'Press Start 2P\',monospace;">';
            html += '<h2 style="color:#fff;margin:0 0 20px 0;text-align:center;font-size:14px;letter-spacing:2px;">ROOM INFO</h2>';

            // Connection status
            if (builderConnected && builderRoomCode) {
                html += '<div style="background:#0a1a0a;color:#0f0;padding:10px;margin-bottom:15px;border:2px solid #0f0;text-align:center;font-size:8px;">';
                html += '> CONNECTED: <strong>' + builderRoomCode + '</strong></div>';
            } else {
                html += '<div style="background:#1a0a0a;color:#f00;padding:10px;margin-bottom:15px;border:2px solid #f00;text-align:center;font-size:8px;">';
                html += '> NOT CONNECTED</div>';
            }

            // Your name
            html += '<div style="color:#888;margin-bottom:12px;font-size:8px;"><span style="color:#f90;">PLAYER:</span> ' + builderPlayerName + '</div>';

            // Builder players in room
            html += '<div style="color:#4af;margin-bottom:8px;font-size:8px;">BUILDERS (' + builderPlayersInRoom.size + ')</div>';
            if (builderPlayersInRoom.size > 0) {
                html += '<div style="color:#666;margin:0 0 15px 10px;font-size:7px;">';
                builderPlayersInRoom.forEach((p, id) => {
                    html += '> ' + p.name + '<br>';
                });
                html += '</div>';
            } else {
                html += '<div style="color:#444;margin-bottom:15px;padding-left:10px;font-size:7px;">No other builders</div>';
            }

            // Game testers in room
            html += '<div style="color:#0ff;margin-bottom:8px;font-size:8px;">TESTERS (' + gamePlayersInBuilder.size + ')</div>';
            if (gamePlayersInBuilder.size > 0) {
                html += '<div style="color:#666;margin:0 0 15px 10px;font-size:7px;">';
                gamePlayersInBuilder.forEach((p, id) => {
                    html += '> ' + p.name + ' <span style="color:#444;">[' + (p.currentMap || '?') + ']</span><br>';
                });
                html += '</div>';
            } else {
                html += '<div style="color:#444;margin-bottom:15px;padding-left:10px;font-size:7px;">No game testers</div>';
            }

            // Project info
            html += '<div style="border-top:1px solid #333;padding-top:15px;margin-top:10px;">';
            html += '<div style="color:#a6f;margin-bottom:10px;font-size:8px;">PROJECT STATS</div>';
            html += '<div style="color:#666;margin-left:10px;font-size:7px;">';
            html += '<div style="margin:4px 0;">Maps........ ' + Object.keys(maps).length + '</div>';
            html += '<div style="margin:4px 0;">Tilesets.... ' + tilesets.length + '</div>';
            html += '<div style="margin:4px 0;">NPCs........ ' + npcs.length + '</div>';
            html += '<div style="margin:4px 0;">Triggers.... ' + placedTriggers.length + '</div>';
            html += '</div></div>';

            // Share save button (for host to share with late joiners)
            html += '<div style="border-top:1px solid #333;padding-top:15px;margin-top:15px;">';
            html += '<div style="color:#fd0;margin-bottom:8px;font-size:8px;">LATE JOINERS</div>';
            html += '<p style="color:#444;font-size:6px;margin:0 0 10px 0;">Download save to share with friends</p>';
            html += '<button onclick="downloadProject(); document.getElementById(\'roomInfoModal\').style.display=\'none\'" ';
            html += 'style="width:100%;padding:12px;background:#1a1a1a;color:#0f0;border:2px solid #0f0;cursor:pointer;font-family:\'Press Start 2P\',monospace;font-size:8px;">DOWNLOAD SAVE</button>';
            html += '</div>';

            // Close button
            html += '<button onclick="document.getElementById(\'roomInfoModal\').style.display=\'none\'" ';
            html += 'style="width:100%;margin-top:12px;padding:12px;background:#1a1a1a;color:#f55;border:2px solid #f55;cursor:pointer;font-family:\'Press Start 2P\',monospace;font-size:8px;">CLOSE</button>';

            html += '</div>';
            modal.innerHTML = html;
            modal.style.display = 'flex';
        }

        // Adventure mode - load project, open test, hide UI
        let launchAsAdventure = false;
        let multiplayerSettings = null; // Will be set from prompt

        async function startAdventure() {
            if (!pendingSaveData) return;

            // Get multiplayer settings from prompt
            const playerName = document.getElementById('mpPlayerName').value.trim() || 'Player';
            const roomCode = document.getElementById('mpRoomCode').value.trim();

            if (roomCode) {
                multiplayerSettings = { playerName, roomCode };
            } else {
                multiplayerSettings = null; // Solo mode
            }

            document.getElementById('multiplayerPrompt').style.display = 'none';
            document.getElementById('modeSelect').style.display = 'block';
            document.getElementById('modeSelect').innerHTML = '<h1>LOADING...</h1>';
            // Keep loadPhase visible during entire loading process
            keepLoadPhaseVisible = true;
            document.getElementById('loadPhase').style.zIndex = '9999';

            await loadProject(pendingSaveData);
            pendingSaveData = null;

            // Wait for tilesets to load
            setTimeout(() => {
                launchAsAdventure = true;
                testMap();
                launchAsAdventure = false;
                // Return to start menu after game opens
                setTimeout(() => {
                    keepLoadPhaseVisible = false;
                    document.getElementById('loadPhase').style.zIndex = '';
                    // Reset to start screen (not builder)
                    document.getElementById('modeSelect').style.display = 'none';
                    document.getElementById('mainMenu').style.display = 'block';
                    document.getElementById('loadPhase').classList.add('active');
                    setPhase('load');
                }, 2000);
            }, 1000);
        }

        // Show/hide prompt functions
        function showDirectJoinPrompt() {
            // Show join prompt directly from main menu (no save file needed)
            document.getElementById('mainMenu').style.display = 'none';
            document.getElementById('joinRoomPrompt').style.display = 'block';
        }

        function showHostPrompt() {
            document.getElementById('craftMultiplayerPrompt').style.display = 'none';
            document.getElementById('hostRoomPrompt').style.display = 'block';
            setTimeout(() => document.getElementById('hostPlayerName').focus(), 50);
        }

        function hideHostPrompt() {
            document.getElementById('hostRoomPrompt').style.display = 'none';
            document.getElementById('craftMultiplayerPrompt').style.display = 'block';
        }

        function showJoinPrompt() {
            document.getElementById('craftMultiplayerPrompt').style.display = 'none';
            document.getElementById('joinRoomPrompt').style.display = 'block';
            setTimeout(() => document.getElementById('joinPlayerName').focus(), 50);
        }

        function hideJoinPrompt() {
            document.getElementById('joinRoomPrompt').style.display = 'none';
            document.getElementById('mainMenu').style.display = 'block';
            joinSaveData = null;
            document.getElementById('joinSaveStatus').textContent = 'No file loaded';
        }

        // Handle save file loaded in Join Room prompt
        let joinSaveData = null;
        function handleJoinSaveFile(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    joinSaveData = JSON.parse(e.target.result);
                    document.getElementById('joinSaveStatus').textContent = 'Loaded: ' + file.name;
                    document.getElementById('joinSaveStatus').style.color = '#0f0';
                    console.log('[JOIN] Save file loaded:', file.name);
                } catch (err) {
                    alert('Invalid save file!');
                    joinSaveData = null;
                    document.getElementById('joinSaveStatus').textContent = 'Error loading file';
                    document.getElementById('joinSaveStatus').style.color = '#f00';
                }
            };
            reader.readAsText(file);
        }

        // SOLO MODE - Load local save, no multiplayer
        async function startCraftSolo() {
            console.log('[CRAFT] Starting SOLO mode');
            if (!pendingSaveData) {
                console.log('[CRAFT] No pendingSaveData, returning');
                return;
            }

            document.getElementById('craftMultiplayerPrompt').style.display = 'none';

            await loadProject(pendingSaveData);
            pendingSaveData = null;
            document.getElementById('modeSelect').style.display = 'none';
            document.getElementById('mainMenu').style.display = 'block';

            console.log('[CRAFT] Solo mode ready');
        }

        // HOST MODE - Load local save, then connect to room (others get your project)
        async function startCraftHost() {
            console.log('[CRAFT] Starting HOST mode');
            if (!pendingSaveData) {
                console.log('[CRAFT] No pendingSaveData, returning');
                return;
            }

            const playerName = document.getElementById('hostPlayerName').value.trim() || 'Host';
            const roomCode = document.getElementById('hostRoomCode').value.trim();

            if (!roomCode) {
                alert('Please enter a room code for others to join');
                return;
            }

            document.getElementById('hostRoomPrompt').style.display = 'none';

            // Load YOUR local project first (you're the host, your project is the map)
            await loadProject(pendingSaveData);
            pendingSaveData = null;
            document.getElementById('modeSelect').style.display = 'none';
            document.getElementById('mainMenu').style.display = 'block';

            // Connect to multiplayer - you're the host
            console.log('[CRAFT] Host connecting to room:', roomCode);
            connectBuilderMultiplayer(playerName, roomCode);

            console.log('[CRAFT] Host mode ready - share room code:', roomCode);
        }

        // JOIN MODE - Load same save as host, then connect for real-time sync
        async function startCraftJoin() {
            console.log('[CRAFT] Starting JOIN mode');

            const playerName = document.getElementById('joinPlayerName').value.trim() || 'Builder';
            const roomCode = document.getElementById('joinRoomCode').value.trim();

            if (!roomCode) {
                alert('Please enter a room code to join');
                return;
            }

            if (!joinSaveData) {
                alert('Please load the save file first!');
                return;
            }

            document.getElementById('joinRoomPrompt').style.display = 'none';

            // Load the save file
            console.log('[CRAFT] Loading save for co-op join');
            await loadProject(joinSaveData);
            joinSaveData = null;

            // Show the builder interface
            document.getElementById('loadPhase').classList.remove('active');
            document.getElementById('buildPhase').classList.add('active');
            setPhase('build');

            // Connect to multiplayer for real-time sync
            console.log('[CRAFT] Joining room:', roomCode);
            connectBuilderMultiplayer(playerName, roomCode);

            console.log('[CRAFT] Join mode ready - edits will sync with room');
        }

        // Initialize an empty project for joiners
        function initEmptyProject() {
            gridSize = 16;
            mapCols = 40;
            mapRows = 30;
            layers = [[]];
            layerVisibility = [true];
            layerNames = ['Layer 1'];
            currentLayer = 0;
            tileCollisions = {};
            collisionMasks = {};
            tileSplitLines = {};
            maps = { 'main': { layers: [[]], layerVisibility: [true], layerNames: ['Layer 1'], currentLayer: 0 }};
            currentMapName = 'main';
            placedTriggers = [];
            placedNpcs = [];
            npcs = [];
            tilesets = [];
            animatedProps = [];
            placedAnimProps = [];
            sounds = [];
            tileSounds = {};
            pointLights = {};
            polyLights = [];
            dialogs = [];
            placedDialogTiles = [];
            items = [];
            placedItems = [];
            staticObjects = [];
            placedStaticObjects = [];
            quests = [];
            questSounds = [];
            shops = [];
            placedShops = [];
            startingGold = 100;
            tileSplitLineFlipped = {};

            // Initialize empty layer grid
            for (let y = 0; y < mapRows; y++) {
                layers[0][y] = [];
                for (let x = 0; x < mapCols; x++) {
                    layers[0][y][x] = null;
                }
            }

            console.log('[CRAFT] Empty project initialized');
        }

        // Legacy function for backwards compatibility
        async function startCraft() {
            startCraftSolo();
        }

        async function loadProject(projectData) {
            // If no data passed, load from IndexedDB (or migrate from localStorage)
            let p;
            if (projectData) {
                p = migrateProjectData(projectData);
            } else {
                // Try IndexedDB first
                try {
                    const dbData = await loadProjectFromDB();
                    if (dbData) {
                        p = dbData;
                        console.log('Loaded project from IndexedDB');
                    }
                } catch (err) {
                    console.warn('IndexedDB load failed:', err);
                }

                // If no IndexedDB data, check localStorage for migration
                if (!p) {
                    const legacyData = localStorage.getItem('worldBuilderProject');
                    if (legacyData) {
                        try {
                            p = JSON.parse(legacyData);
                            console.log('Loaded project from localStorage, migrating to IndexedDB...');
                            // Migrate to IndexedDB
                            try {
                                await saveProjectToDB(p);
                                localStorage.removeItem('worldBuilderProject');
                                console.log('Migration complete, localStorage cleared');
                            } catch (migErr) {
                                console.warn('Migration to IndexedDB failed:', migErr);
                            }
                        } catch (parseErr) {
                            alert('Error parsing saved data: ' + parseErr.message);
                            return;
                        }
                    }
                }

                if (!p) {
                    alert('No saved project found in browser storage. Use "Load File" to load from a downloaded file.');
                    return;
                }
            }

            console.log('Loading project:', p);
            gridSize = p.gridSize || 16;
            mapCols = p.mapCols || 40;
            mapRows = p.mapRows || 30;
            tileCollisions = p.tileCollisions || {};
            collisionMasks = p.collisionMasks || {};
            tileSplitLines = p.tileSplitLines || {}; // Depth split lines for Y-sorting
            tileSplitLineFlipped = p.tileSplitLineFlipped || {}; // Flipped split lines

            // Load multiple props (new format)
            props = [];
            propImage = null;
            propImageData = null;
            propCollisionMasks = {};
            currentPropIndex = -1;

            if (p.props && p.props.length > 0) {
                console.log('Loading', p.props.length, 'props');
                let propsLoaded = 0;
                p.props.forEach((propData, i) => {
                    const img = new Image();
                    img.onload = () => {
                        props[i] = {
                            ...propData, // preserve all saved fields — don't whitelist
                            name: propData.name,
                            img: img,
                            data: propData.data,
                            collisionMasks: propData.collisionMasks || {}
                        };
                        propsLoaded++;
                        if (propsLoaded === p.props.length) {
                            // All props loaded
                            currentPropIndex = p.currentPropIndex >= 0 ? p.currentPropIndex : 0;
                            if (props[currentPropIndex]) {
                                propImage = props[currentPropIndex].img;
                                propImageData = props[currentPropIndex].data;
                                propCollisionMasks = props[currentPropIndex].collisionMasks;
                            }
                            updatePropDropdown();
                            updatePropUI();
                            drawPropTileset();
                            renderMap();
                        }
                    };
                    img.onerror = () => {
                        console.error('Failed to load prop', i);
                        propsLoaded++;
                    };
                    img.src = propData.data;
                });
            } else if (p.propImageData) {
                // Old format - single prop image (backwards compatibility)
                console.log('Loading single prop (old format)');
                const img = new Image();
                img.onload = () => {
                    props = [{
                        name: 'prop',
                        img: img,
                        data: p.propImageData,
                        collisionMasks: p.propCollisionMasks || {}
                    }];
                    currentPropIndex = 0;
                    propImage = img;
                    propImageData = p.propImageData;
                    propCollisionMasks = p.propCollisionMasks || {};
                    updatePropDropdown();
                    updatePropUI();
                    drawPropTileset();
                    renderMap();
                };
                img.onerror = () => console.error('Failed to load prop image');
                img.src = p.propImageData;
            } else {
                console.log('No props in saved project');
                updatePropDropdown();
                updatePropUI();
            }

            // Load animated props
            animatedProps = [];
            animPropSpriteSheet = null;
            animPropSpriteData = null;
            currentAnimPropIndex = -1;
            placedAnimProps = p.placedAnimProps || [];

            if (p.animatedProps && p.animatedProps.length > 0) {
                console.log('Loading', p.animatedProps.length, 'animated props');
                let propsLoaded = 0;
                p.animatedProps.forEach((propData, i) => {
                    // Spread-with-strip + legacy-compat migration for singular collisionMask
                    const legacyMask = (!propData.collisionMasks && propData.collisionMask)
                        ? { 0: propData.collisionMask } : null;
                    animatedProps[i] = {
                        ...propData,
                        frameWidth: propData.frameWidth || 16,
                        frameHeight: propData.frameHeight || 16,
                        frames: propData.frames || [],
                        type: propData.type || 'loop',
                        fps: propData.fps || 8,
                        collisionMasks: propData.collisionMasks || legacyMask,
                        splitLine: propData.splitLine || null,
                        giveItem: propData.giveItem || false,
                        giveItemIndex: propData.giveItemIndex ?? -1,
                        lockItemIndex: propData.lockItemIndex ?? -1,
                        lockConsume: propData.lockConsume !== false
                    };

                    // Load sprite sheet image if present
                    if (propData.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            animatedProps[i]._spriteImg = img;
                            propsLoaded++;
                            if (propsLoaded === p.animatedProps.length) {
                                currentAnimPropIndex = p.currentAnimPropIndex >= 0 ? p.currentAnimPropIndex : 0;
                                if (animatedProps[currentAnimPropIndex] && animatedProps[currentAnimPropIndex]._spriteImg) {
                                    animPropSpriteSheet = animatedProps[currentAnimPropIndex]._spriteImg;
                                    animPropSpriteData = animatedProps[currentAnimPropIndex].spriteData;
                                }
                                updateAnimPropListDisplay();
                                renderMap();
                            }
                        };
                        img.onerror = () => {
                            console.error('Failed to load animated prop sprite', i);
                            propsLoaded++;
                        };
                        img.src = propData.spriteData;
                    } else {
                        propsLoaded++;
                        if (propsLoaded === p.animatedProps.length) {
                            currentAnimPropIndex = p.currentAnimPropIndex >= 0 ? p.currentAnimPropIndex : 0;
                            updateAnimPropListDisplay();
                            renderMap();
                        }
                    }
                });
            } else {
                console.log('No animated props in saved project');
                updateAnimPropListDisplay();
            }

            // Load NPCs
            npcs = [];
            currentNpcIndex = -1;
            placedNpcs = p.placedNpcs || [];
            selectedPlacedNpcIndex = -1;
            npcPathDrawing = false;

            if (p.npcs && p.npcs.length > 0) {
                console.log('Loading', p.npcs.length, 'NPCs');
                p.npcs.forEach((npcData, i) => {
                    // Spread all saved fields to preserve collisionInsets, shadow settings, etc.
                    npcs[i] = {
                        ...npcData,
                        // Ensure required fields have defaults
                        frameWidth: npcData.frameWidth || 32,
                        frameHeight: npcData.frameHeight || 32,
                        animations: npcData.animations || { walkDown: [], walkUp: [], walkLeft: [], walkRight: [], idle: [], attackDown: [], attackUp: [], attackLeft: [], attackRight: [] },
                        animMirrors: npcData.animMirrors || {},
                        fps: npcData.fps || 8
                    };
                    // Preload sprite image
                    if (npcData.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            npcs[i]._editorImg = img;
                            renderMap();
                        };
                        img.src = npcData.spriteData;
                    }
                });
                currentNpcIndex = p.currentNpcIndex >= 0 ? p.currentNpcIndex : 0;
                updateNpcList();
                updatePlacedNpcList();
            } else {
                console.log('No NPCs in saved project');
                updateNpcList();
                updatePlacedNpcList();
            }

            // Load static objects
            staticObjects = [];
            currentStaticObjIndex = -1;
            placedStaticObjects = p.placedStaticObjects || [];

            if (p.staticObjects && p.staticObjects.length > 0) {
                console.log('Loading', p.staticObjects.length, 'static objects');
                p.staticObjects.forEach((objData, i) => {
                    staticObjects[i] = {
                        ...objData, // preserve all saved fields — don't whitelist
                        name: objData.name,
                        spriteData: objData.spriteData,
                        width: objData.width,
                        height: objData.height,
                        tilesetIndex: objData.tilesetIndex,
                        sourceTiles: objData.sourceTiles,
                        sourceOrigin: objData.sourceOrigin,
                        _spriteImg: new Image()
                    };
                    staticObjects[i]._spriteImg.src = objData.spriteData;
                });
            }
            updateStaticObjectsList();

            // Load layers (backwards compatible with old saves)
            if (p.layers) {
                layers = p.layers;
                layerVisibility = p.layerVisibility || layers.map(() => true);
                layerNames = p.layerNames || layers.map(() => '');
                currentLayer = p.currentLayer || 0;
            } else if (p.map) {
                // Old format - single map
                layers = [p.map];
                layerVisibility = [true];
                layerNames = [''];
                currentLayer = 0;
            } else {
                layers = [createEmptyLayer()];
                layerVisibility = [true];
                layerNames = [''];
                currentLayer = 0;
            }
            map = layers[currentLayer];

            // Load player layer settings
            playerLayerIndex = p.playerLayerIndex !== undefined ? p.playerLayerIndex : 1;
            playerPreviewPos = p.playerPreviewPos || { x: 5, y: 5 };
            spawnMapName = p.spawnMapName || 'main';
            playerPreviewVisible = p.playerPreviewVisible !== undefined ? p.playerPreviewVisible : true;

            // Load sounds
            sounds = [];
            tileSounds = p.tileSounds || {};
            normalizeTileSoundKeys(); // migrate legacy "x,y" keys -> "main:x,y" so the builder sees them
            playerSounds = p.playerSounds || {
                walk: { soundIndex: -1, interval: 200, volume: 0.5, pitchVariation: 0.1 },
                attack: { soundIndex: -1, volume: 0.7, pitchVariation: 0.15, lengthVariation: 0 },
                inventoryOpen: { soundIndex: -1, volume: 0.5 },
                inventoryClose: { soundIndex: -1, volume: 0.5 }
            };
            // Ensure inventory fields exist for older saves
            if (!playerSounds.inventoryOpen) playerSounds.inventoryOpen = { soundIndex: -1, volume: 0.5 };
            if (!playerSounds.inventoryClose) playerSounds.inventoryClose = { soundIndex: -1, volume: 0.5 };

            if (p.sounds && p.sounds.length > 0) {
                console.log('Loading', p.sounds.length, 'sounds');
                p.sounds.forEach((soundData, i) => {
                    sounds[i] = {
                        ...soundData, // preserve all saved fields — don't whitelist
                        name: soundData.name,
                        data: soundData.data,
                        duration: soundData.duration || 0,
                        type: soundData.type || 'ambient'
                    };
                });
                updateSoundDropdown();
                updatePlacedSoundsList();
                updatePlayerSoundAssignments();
            } else {
                console.log('No sounds in saved project');
                updateSoundDropdown();
                updatePlacedSoundsList();
                updatePlayerSoundAssignments();
            }

            // Load quest sounds library
            if (p.questSounds && p.questSounds.length > 0) {
                console.log('Loading', p.questSounds.length, 'quest sounds');
                questSounds = p.questSounds.map(s => ({ name: s.name, data: s.data }));
            } else {
                questSounds = [];
            }

            // Load lighting settings — spread with defaults so unknown keys round-trip.
            if (p.lightingSettings) {
                lightingSettings = {
                    playerLight: false,
                    playerLightRadius: 4,
                    ...p.lightingSettings
                };
                // Update UI to match loaded settings
                const playerLightEl = document.getElementById('playerLight');
                const radiusEl = document.getElementById('playerLightRadius');
                if (playerLightEl) playerLightEl.checked = lightingSettings.playerLight;
                if (radiusEl) {
                    radiusEl.value = lightingSettings.playerLightRadius;
                    document.getElementById('playerLightRadiusVal').textContent = lightingSettings.playerLightRadius;
                }
            }
            pointLights = p.pointLights || {};
            polyLights = p.polyLights || [];
            updatePlacedLightsList();
            updatePolyLightsList();

            // Load multi-map data
            if (p.maps && Object.keys(p.maps).length > 0) {
                maps = p.maps;
                currentMapName = p.currentMapName || 'main';
                console.log('Loaded', Object.keys(maps).length, 'maps');
            } else {
                // No multi-map data - will create 'main' map from current data after load
                maps = {};
                currentMapName = 'main';
            }

            // Load triggers
            placedTriggers = p.placedTriggers || [];
            ensureTriggerUids(placedTriggers); // Wave 7: stamp UIDs on legacy saves so runtime lookups work.
            console.log('Loaded', placedTriggers.length, 'triggers');
            updateDoorNumberDropdown();

            // Load dialogs
            dialogs = p.dialogs || [];
            placedDialogTiles = p.placedDialogTiles || [];
            console.log('Loaded', dialogs.length, 'dialogs,', placedDialogTiles.length, 'dialog tiles');
            updateDialogList();

            // Load items
            items = [];
            placedItems = p.placedItems || [];
            fishingLoot = (p.fishingLoot || []).map(e => ({ ...e }));
            currentItemIndex = -1;
            if (p.items && p.items.length > 0) {
                p.items.forEach((itemData, i) => {
                    items[i] = {
                        ...itemData, // preserve all fields (behavior/ability config etc.) — don't whitelist
                        id: itemData.id || ('item_' + i), // Ensure ID exists
                        name: itemData.name,
                        spriteData: itemData.spriteData,
                        frameWidth: itemData.frameWidth || 16,
                        frameHeight: itemData.frameHeight || 16,
                        frames: itemData.frames || [],
                        fps: itemData.fps || 8,
                        idleFrame: itemData.idleFrame || 0,
                        maxStack: itemData.maxStack || 99
                    };
                    delete items[i]._spriteImg; // re-created below
                    // Preload sprite image
                    if (itemData.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            items[i]._spriteImg = img;
                            renderMap();
                        };
                        img.src = itemData.spriteData;
                    }
                });
                console.log('Loaded', items.length, 'items,', placedItems.length, 'placed items');
            }
            updateItemList();
            updatePlacedItemsList();

            // Load quests
            quests = p.quests || [];
            selectedQuestIndex = -1;
            console.log('Loaded', quests.length, 'quests');
            renderQuestList();

            // Load shops
            shops = p.shops || [];
            placedShops = p.placedShops || [];
            startingGold = p.startingGold !== undefined ? p.startingGold : 100;
            console.log('Loaded', shops.length, 'shops, starting gold:', startingGold);
            updateShopList();
            // Update gold input display
            const goldInput = document.getElementById('startingGoldInput');
            if (goldInput) goldInput.value = startingGold;

            // Load player characters
            playerCharacters = [];
            activePlayerIndex = -1;
            if (p.playerCharacters && p.playerCharacters.length > 0) {
                p.playerCharacters.forEach((char, i) => {
                    playerCharacters[i] = { ...char };
                    // Wave 1: shadow-unit migration — player chars canonicalize on integer percent.
                    // Legacy decimal values (< 1) get multiplied by 100 and a console warn is logged.
                    const sw = playerCharacters[i].shadowWidth;
                    if (typeof sw === 'number' && sw > 0 && sw < 1) {
                        console.warn('[MIGRATE] player[' + i + '].shadowWidth', sw, '-> integer percent', Math.round(sw * 100));
                        playerCharacters[i].shadowWidth = Math.round(sw * 100);
                    }
                    const sh = playerCharacters[i].shadowHeight;
                    if (typeof sh === 'number' && sh > 0 && sh < 1) {
                        console.warn('[MIGRATE] player[' + i + '].shadowHeight', sh, '-> integer percent', Math.round(sh * 100));
                        playerCharacters[i].shadowHeight = Math.round(sh * 100);
                    }
                    if (char.spriteData) {
                        const img = new Image();
                        img.onload = () => {
                            playerCharacters[i]._spriteImg = img;
                            updatePlayerList();
                        };
                        img.src = char.spriteData;
                    }
                });
                activePlayerIndex = p.activePlayerIndex !== undefined ? p.activePlayerIndex : 0;
                console.log('Loaded', playerCharacters.length, 'player characters, active:', activePlayerIndex);
            }
            updatePlayerList();

            // ===== Wave 1 orphan-purge pass — runs after all state is loaded =====
            try {
                // Triggers: drop any whose targetMap references a non-existent map.
                if (Array.isArray(placedTriggers) && maps) {
                    const before = placedTriggers.length;
                    placedTriggers = placedTriggers.filter(t => {
                        if (!t) return false;
                        const homeOk = !t.mapName || maps[t.mapName];
                        const targetOk = !t.targetMap || maps[t.targetMap];
                        if (!homeOk || !targetOk) console.warn('[LOAD] purged orphan trigger:', t);
                        return homeOk && targetOk;
                    });
                    if (placedTriggers.length < before) console.warn('[LOAD] dropped', before - placedTriggers.length, 'orphan trigger(s)');
                }
                // spawnMapName: if it points at a deleted map, repair it.
                if (spawnMapName && maps && !maps[spawnMapName]) {
                    const remaining = Object.keys(maps);
                    const repair = remaining[0] || 'main';
                    console.warn('[LOAD] spawnMapName', spawnMapName, 'missing; repaired to', repair);
                    spawnMapName = repair;
                }
                // Dangling soundIndex refs: clamp to -1.
                const nSounds = Array.isArray(sounds) ? sounds.length : 0;
                if (typeof tileSounds === 'object' && tileSounds) {
                    for (const k of Object.keys(tileSounds)) {
                        const e = tileSounds[k];
                        if (e && typeof e.soundIndex === 'number' && (e.soundIndex < 0 || e.soundIndex >= nSounds)) {
                            if (e.soundIndex !== -1) console.warn('[LOAD] dangling tileSound key', k, '-> soundIndex', e.soundIndex);
                            e.soundIndex = -1;
                        }
                    }
                }
                if (typeof playerSounds === 'object' && playerSounds) {
                    for (const action of Object.keys(playerSounds)) {
                        const cfg = playerSounds[action];
                        if (cfg && typeof cfg.soundIndex === 'number' && (cfg.soundIndex < 0 || cfg.soundIndex >= nSounds)) {
                            if (cfg.soundIndex !== -1) console.warn('[LOAD] dangling playerSound', action, '-> soundIndex', cfg.soundIndex);
                            cfg.soundIndex = -1;
                        }
                    }
                }
            } catch (err) {
                console.error('[LOAD] orphan-purge pass failed:', err);
            }
            // ===== end Wave 1 orphan-purge =====

            // Load tilesets (new format with multiple tilesets)
            if (p.tilesets && p.tilesets.length > 0) {
                let loadedCount = 0;
                tilesets = [];
                p.tilesets.forEach((tsData, i) => {
                    const img = new Image();
                    img.onload = () => {
                        tilesets[i] = { name: tsData.name, img: img, data: tsData.data };
                        loadedCount++;
                        if (loadedCount === p.tilesets.length) {
                            // All tilesets loaded
                            currentTilesetIndex = p.currentTilesetIndex || 0;
                            tilesetImg = tilesets[currentTilesetIndex].img;
                            mapInitialized = true; // Mark map as loaded

                            // Initialize maps object if empty (old format project)
                            if (Object.keys(maps).length === 0) {
                                saveCurrentMapState();
                                console.log('Initialized maps object with current data');
                            } else if (maps[currentMapName]) {
                                // Load current map's state (including cameraBounds)
                                loadMapState(maps[currentMapName]);
                                console.log('Loaded current map state for:', currentMapName);
                            }

                            updateTilesetDropdown();
                            setPhase('build');
                            drawPaintTileset();
                            renderLayerList();
                            renderMap();
                            updateAnimPropListDisplay();
                            updateMapDropdowns();
                            updateTriggerList();
                            updateCameraBoundsInfo();
                        }
                    };
                    img.src = tsData.data;
                });
            } else if (p.tilesetData) {
                // Old format - single tileset
                const img = new Image();
                img.onload = () => {
                    tilesets = [{ name: 'tileset', img: img, data: p.tilesetData }];
                    currentTilesetIndex = 0;
                    tilesetImg = img;
                    mapInitialized = true; // Mark map as loaded

                    // Initialize maps object if empty (old format project)
                    if (Object.keys(maps).length === 0) {
                        saveCurrentMapState();
                        console.log('Initialized maps object with current data');
                    } else if (maps[currentMapName]) {
                        // Load current map's state (including cameraBounds)
                        loadMapState(maps[currentMapName]);
                        console.log('Loaded current map state for:', currentMapName);
                    }

                    updateTilesetDropdown();
                    setPhase('build');
                    drawPaintTileset();
                    renderLayerList();
                    renderMap();
                    updateAnimPropListDisplay();
                    updateMapDropdowns();
                    updateTriggerList();
                    updateCameraBoundsInfo();
                };
                img.src = p.tilesetData;
            } else {
                alert('No tileset data found in save');
            }
        }
