        // === MULTIPLAYER SYSTEM ===
        let mpSocket = null;
        let mpConnected = false;
        let mpPlayerName = 'Player';
        let mpLastSendTime = 0;
        const otherPlayers = new Map(); // id -> {x, y, targetX, targetY, direction, animation, name, frame, frameTimer}

        // Initialize multiplayer if settings provided
        if (projectData.multiplayer) {
            mpPlayerName = projectData.multiplayer.playerName || 'Player';
            const roomCode = projectData.multiplayer.roomCode;
            // Default desktop play uses the game party (/party/); the "join the live world"
            // path points at the authoritative play party (/parties/play/) which relays
            // positions the same way and also serves the world snapshot.
            const partyPath = projectData.multiplayer.partyPath || 'party';
            console.log('[MP] Connecting as', mpPlayerName, 'to room', roomCode);

            // Resilient reconnect: phones drop sockets on background/network blips. Back off with
            // jitter, re-join on reconnect, and clear stale avatars so we don't accumulate ghosts.
            let mpReconnectDelay = 1000;
            let mpReconnectTimer = null;
            function scheduleMpReconnect() {
                if (mpReconnectTimer) return;
                const delay = Math.min(mpReconnectDelay, 15000) + Math.random() * 500;
                mpReconnectTimer = setTimeout(() => {
                    mpReconnectTimer = null;
                    mpReconnectDelay = Math.min(mpReconnectDelay * 2, 15000);
                    connectMpSocket();
                }, delay);
            }
            function connectMpSocket() {
                try {
                    mpSocket = new WebSocket('wss://multiplayer.lakotafox.partykit.dev/' + partyPath + '/' + roomCode);

                    mpSocket.onopen = () => {
                        console.log('[MP] Connected to server');
                        mpConnected = true;
                        mpReconnectDelay = 1000; // reset backoff on a good connection
                        mpSocket.send(JSON.stringify({
                            type: 'join',
                            name: mpPlayerName,
                            x: player.x,
                            y: player.y,
                            direction: player.direction,
                            animation: 'idle',
                            currentMap: currentGameMap,
                            gameType: 'game2d'
                        }));
                    };

                    mpSocket.onmessage = (event) => {
                        try {
                            const data = JSON.parse(event.data);
                            logNetworkEvent(data.type || 'unknown', 'recv', data, event.data.length);
                            handleMpMessage(data);
                        } catch (e) {
                            console.error('[MP] Error parsing message:', e);
                        }
                    };

                    mpSocket.onclose = () => {
                        console.log('[MP] Disconnected');
                        mpConnected = false;
                        otherPlayers.clear(); // drop ghosts; roster is rebuilt from welcome on reconnect
                        scheduleMpReconnect();
                    };

                    mpSocket.onerror = (err) => {
                        console.error('[MP] WebSocket error:', err);
                    };
                } catch (e) {
                    console.error('[MP] Failed to connect:', e);
                    scheduleMpReconnect();
                }
            }
            connectMpSocket();

            // Mobile browsers silently kill backgrounded sockets — reconnect on return to foreground.
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && (!mpSocket || mpSocket.readyState > 1)) {
                    mpReconnectDelay = 1000;
                    scheduleMpReconnect();
                }
            });
        }

        function handleMpMessage(data) {
            switch (data.type) {
                case 'welcome':
                    console.log('[MP] Welcome:', data.message);
                    // Spawn existing players (only game2d ones)
                    if (data.players) {
                        data.players.filter(p => p.gameType === 'game2d').forEach(p => {
                            otherPlayers.set(p.id, {
                                x: p.x, y: p.y,
                                targetX: p.x, targetY: p.y,
                                prevX: p.x, prevY: p.y,  // Previous position for velocity calc
                                vx: 0, vy: 0,           // Estimated velocity
                                lastUpdateTime: Date.now(),
                                direction: p.direction || 'down',
                                animation: p.animation || 'idle',
                                name: p.name || 'Player',
                                currentMap: p.currentMap || 'main',
                                inTavern: p.inTavern || false,
                                frame: 0, frameTimer: 0
                            });
                            console.log('[MP] Added existing player:', p.name, 'on map:', p.currentMap);
                        });
                    }
                    break;

                case 'join':
                    if (data.player && data.player.gameType === 'game2d') {
                        otherPlayers.set(data.player.id, {
                            x: data.player.x, y: data.player.y,
                            targetX: data.player.x, targetY: data.player.y,
                            prevX: data.player.x, prevY: data.player.y,
                            vx: 0, vy: 0,
                            lastUpdateTime: Date.now(),
                            direction: data.player.direction || 'down',
                            animation: data.player.animation || 'idle',
                            name: data.player.name || 'Player',
                            currentMap: data.player.currentMap || 'main',
                            inTavern: data.player.inTavern || false,
                            frame: 0, frameTimer: 0
                        });
                        console.log('[MP] Player joined:', data.player.name, 'on map:', data.player.currentMap);
                    }
                    break;

                case 'update':
                    if (data.player && data.player.gameType === 'game2d') {
                        const other = otherPlayers.get(data.player.id);
                        if (other) {
                            const now = Date.now();
                            const dt = (now - other.lastUpdateTime) / 1000; // Time since last update in seconds

                            // Calculate velocity from position change
                            if (dt > 0 && dt < 1) { // Ignore if too long (probably reconnect)
                                other.vx = (data.player.x - other.prevX) / dt;
                                other.vy = (data.player.y - other.prevY) / dt;
                            }

                            // Store previous target as prev position
                            other.prevX = other.targetX;
                            other.prevY = other.targetY;

                            // Set new target position
                            other.targetX = data.player.x;
                            other.targetY = data.player.y;
                            other.lastUpdateTime = now;

                            other.direction = data.player.direction || other.direction;
                            other.animation = data.player.animation || other.animation;
                            other.attackFrame = data.player.attackFrame || 0;
                            other.currentMap = data.player.currentMap || other.currentMap;
                            other.inTavern = data.player.inTavern || false;
                        }
                    }
                    break;

                case 'leave':
                    if (data.playerId) {
                        const leaving = otherPlayers.get(data.playerId);
                        if (leaving) {
                            console.log('[MP] Player left:', leaving.name);
                            otherPlayers.delete(data.playerId);
                        }
                    }
                    break;

                case 'builderEdit':
                    // Received a builder edit relayed from another player
                    if (data.edit) {
                        console.log('[MP] Received builder edit from other player');
                        applyLiveEdit(data.edit, true); // true = from multiplayer, don't relay again
                    }
                    break;

                case 'itemInteract':
                    // Another player interacted with an item
                    if (data.itemIndex !== undefined && itemStates[data.itemIndex]) {
                        const state = itemStates[data.itemIndex];
                        if (!state.used && !state.animating) {
                            state.animating = true;
                            state.frame = 0;
                            state.frameTimer = 0;
                            console.log('[MP] Remote player opened item at', data.x, data.y);
                        }
                    }
                    break;

                case 'propInteract':
                    // Another player interacted with an animated prop
                    if (data.key) {
                        if (!interactivePropStates[data.key]) {
                            interactivePropStates[data.key] = { used: false, animating: false, frame: 0, gaveItem: false };
                        }
                        const state = interactivePropStates[data.key];
                        if (!state.used && !state.animating) {
                            state.animating = true;
                            state.frame = 0;
                            console.log('[MP] Remote player opened prop at', data.originX, data.originY);
                        }
                    }
                    break;
            }
        }

        function sendMpUpdate() {
            if (!mpConnected || !mpSocket) return;
            const now = Date.now();
            if (now - mpLastSendTime < 100) return; // Throttle to 10/sec
            mpLastSendTime = now;

            // Determine animation state
            let animState = 'idle';
            if (player.attacking && player.attackAnim) {
                animState = 'attack';
            } else if (player.moving) {
                animState = 'walk';
            }

            mpSocket.send(JSON.stringify({
                type: 'update',
                x: player.x,
                y: player.y,
                direction: player.direction,
                animation: animState,
                attackFrame: player.attackFrame || 0,
                currentMap: currentGameMap,
                inTavern: inTavernMode
            }));
        }
