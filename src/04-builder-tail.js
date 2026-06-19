
            if (window.__joinMode) {
                // Join the live world IN-PAGE via a full-screen iframe (mobile blocks popups).
                // The engine signals 'ready' to window.parent (this page) and we reply with the world.
                let frame = document.getElementById('joinGameFrame');
                if (!frame) {
                    frame = document.createElement('iframe');
                    frame.id = 'joinGameFrame';
                    // Use dvh (dynamic viewport height) so the iframe fits the VISIBLE area, not the
                    // area behind Safari's toolbar (which would push the on-screen controls off-screen).
                    // Note: not using inset:0 — top+bottom:0 would force 100vh and ignore the height.
                    frame.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;border:0;z-index:99999;background:#000;';
                    frame.setAttribute('allow', 'autoplay; fullscreen');
                    document.body.appendChild(frame);
                }
                const doc = frame.contentWindow.document;
                doc.open();
                doc.write(loaderHTML);
                doc.close();
                testGameWindow = frame.contentWindow;
                // The engine binds keydown to the iframe's document, so without focus the player
                // can't walk until they tap/click the frame. Grab focus now (we're inside the JOIN
                // click gesture) and re-grab it on any tap so keyboard control works immediately.
                const focusGame = () => { try { frame.contentWindow.focus(); } catch (e) {} };
                focusGame();
                setTimeout(focusGame, 100); // after the engine parses/attaches listeners
                frame.contentWindow.addEventListener('pointerdown', focusGame);
                frame.contentWindow.addEventListener('touchstart', focusGame, { passive: true });
                logTestEvent('Joined live world (in-page)');
            } else {
                // Desktop test: open in a popup window.
                // Data is streamed via postMessage after the page loads (prevents iPad memory crash)
                const testWindow = window.open('', '_blank');
                if (testWindow) {
                    testWindow.document.write(loaderHTML);
                    testWindow.document.close();
                    testGameWindow = testWindow; // Store reference for live sync
                    logTestEvent('Test window opened (live sync enabled)');
                } else {
                    logTestEvent('Failed to open test window - popup blocked?', 'error');
                    alert('Could not open test window. Please allow popups for this site.');
                }
            }
        }

        // ===== LIVE WORLD: GO LIVE (host) + JOIN ROOM (viewer) =====
        let playSocket = null;

        // Host: upload the lightweight world to the play server, then show a share link.
        function goLive() {
            const suggested = builderRoomCode || ('live' + Math.floor(Math.random() * 9000 + 1000));
            const room = (prompt('Room code for your live world:', suggested) || '').trim();
            if (!room) return;
            let lwJson;
            try { lwJson = JSON.stringify(getLightweightWorld()); }
            catch (e) { alert('Could not build the world: ' + e.message); return; }
            const sizeMB = (lwJson.length / 1048576).toFixed(2);
            showGoLiveInfo(room, null, sizeMB, 'Uploading…');
            try { if (playSocket) playSocket.close(); } catch (e) {}
            const ws = new WebSocket('wss://multiplayer.lakotafox.partykit.dev/parties/play/' + encodeURIComponent(room));
            playSocket = ws;
            let done = false;
            // Watchdog: if the server never confirms, don't spin forever — tell the host.
            const watchdog = setTimeout(() => {
                if (!done) showGoLiveInfo(room, null, sizeMB, '⚠ Upload stalled — close (✕) and try again');
            }, 30000);
            ws.onopen = () => {
                const CHUNK = 120 * 1024;
                const total = Math.ceil(lwJson.length / CHUNK);
                ws.send(JSON.stringify({ type: 'world-upload-begin', chunks: total }));
                for (let i = 0; i < total; i++) {
                    ws.send(JSON.stringify({ type: 'world-upload-chunk', i, data: lwJson.slice(i * CHUNK, (i + 1) * CHUNK) }));
                }
                ws.send(JSON.stringify({ type: 'world-upload-end' }));
            };
            ws.onmessage = (ev) => {
                let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
                if (m.type === 'world-ready') {
                    done = true; clearTimeout(watchdog);
                    const url = location.origin + location.pathname + '?room=' + encodeURIComponent(room);
                    showGoLiveInfo(room, url, sizeMB, null);
                    // Remember we're live + start watching the play party so viewers show on the builder,
                    // and so Test Map joins the SAME live room (host & viewers together in-game).
                    liveRoomCode = room;
                    connectBuilderToPlayParty(room);
                } else if (m.type === 'error') {
                    done = true; clearTimeout(watchdog);
                    showGoLiveInfo(room, null, sizeMB, '⚠ ' + (m.message || 'upload error') + ' — close (✕) and retry');
                }
            };
            ws.onerror = () => { if (!done) showGoLiveInfo(room, null, sizeMB, '⚠ Could not reach the live server — close (✕) and retry'); };
        }

        function showGoLiveInfo(room, url, sizeMB, statusText) {
            let box = document.getElementById('goLiveInfo');
            if (!box) {
                box = document.createElement('div');
                box.id = 'goLiveInfo';
                // Bottom-center so it never covers the toolbar; always dismissable.
                box.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:100000;background:#001018;border:3px solid #0ff;color:#fff;font-family:monospace;padding:16px 22px 14px;text-align:center;max-width:92vw;box-shadow:0 0 24px rgba(0,255,255,.5);';
                document.body.appendChild(box);
            }
            const closeBtn = '<button title="dismiss" onclick="document.getElementById(\'goLiveInfo\').remove()" style="position:absolute;top:1px;right:7px;background:none;border:none;color:#0ff;font-size:16px;cursor:pointer;line-height:1;">✕</button>';
            if (url) {
                box.innerHTML = closeBtn
                    + '<div style="color:#0ff;font-weight:bold;margin-bottom:8px;">🔴 LIVE — world uploaded (' + sizeMB + 'MB)</div>'
                    + '<div style="font-size:12px;margin-bottom:6px;">Share this link / room: <b>' + room + '</b></div>'
                    + '<input id="goLiveUrl" readonly value="' + url + '" onclick="this.select()" style="width:min(440px,82vw);padding:8px;background:#000;color:#0f0;border:1px solid #0f0;font-family:monospace;text-align:center;">'
                    + '<div style="margin-top:10px;">'
                    + '<button onclick="if(navigator.clipboard){navigator.clipboard.writeText(document.getElementById(\'goLiveUrl\').value);this.textContent=\'COPIED\';}" style="padding:8px 14px;margin-right:8px;cursor:pointer;">COPY LINK</button>'
                    + '<button onclick="document.getElementById(\'goLiveInfo\').remove()" style="padding:8px 14px;cursor:pointer;">CLOSE</button>'
                    + '</div>';
            } else {
                box.innerHTML = closeBtn + '<div style="color:#0ff;">' + (statusText || 'Uploading…') + ' (' + sizeMB + 'MB)</div>';
            }
        }

        // Host: wipe ALL live rooms at once (asks the registry to clear every registered room).
        function cleanupAllRooms() {
            if (!confirm('Wipe ALL your live rooms? Anyone currently in them gets kicked. This cannot be undone.')) return;
            // No Content-Type header => simple request, no CORS preflight; registry still parses JSON.
            fetch('https://multiplayer.lakotafox.partykit.dev/parties/registry/main', {
                method: 'POST',
                body: JSON.stringify({ action: 'clearAll' })
            }).then(r => r.json()).then(d => {
                alert('Cleaned up ' + (d.cleared || 0) + ' of ' + (d.total || 0) + ' room(s).');
            }).catch(e => alert('Cleanup failed: ' + e.message));
        }

        // Viewer: join a live room by code/URL — boots the game in-page from the network world.
        function joinLiveRoom(roomArg) {
            const params = new URLSearchParams(location.search);
            let room = (roomArg || params.get('room') || '').trim();
            if (!room) { room = (prompt('Enter room code:') || '').trim(); }
            if (!room) return;
            const nameEl = document.getElementById('viewerName');
            const name = ((nameEl && nameEl.value.trim()) || 'Viewer' + Math.floor(Math.random() * 1000)).slice(0, 14);
            let booted = false;
            let delay = 1000;
            const url = 'wss://multiplayer.lakotafox.partykit.dev/parties/play/' + encodeURIComponent(room);
            showJoinStatus('Connecting…');
            (function connect() {
                if (booted) return;
                const ws = new WebSocket(url);
                ws.onopen = () => {
                    delay = 1000; // reset backoff once connected
                    ws.send(JSON.stringify({ type: 'requestSnapshot' }));
                    showJoinStatus('Loading world…');
                };
                ws.onmessage = (ev) => {
                    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
                    if (m.type === 'world-snapshot' && m.world && !booted) {
                        booted = true;
                        try { ws.close(); } catch (e) {} // engine opens its own play-party socket for positions
                        hideJoinStatus();
                        window.__joinMode = true;
                        window.__joinRoom = room;
                        window.__joinName = name;
                        window.__joinWorld = m.world;
                        testMap();
                    } else if (m.type === 'waiting') {
                        showJoinStatus('Waiting for the host to go live…');
                    } else if (m.type === 'error') {
                        showJoinStatus('Error: ' + (m.message || 'unknown'));
                    }
                };
                // Retry with backoff until we've booted (covers flaky connects / host-not-live-yet).
                ws.onclose = () => {
                    if (booted) return;
                    showJoinStatus('Reconnecting…');
                    setTimeout(connect, Math.min(delay, 10000) + Math.random() * 500);
                    delay = Math.min(delay * 2, 10000);
                };
                ws.onerror = () => { try { ws.close(); } catch (e) {} };
            })();
        }

        function showJoinStatus(text) {
            let box = document.getElementById('joinStatus');
            if (!box) {
                box = document.createElement('div');
                box.id = 'joinStatus';
                box.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.85);color:#0ff;font-family:\'Press Start 2P\',monospace;font-size:12px;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;';
                document.body.appendChild(box);
            }
            box.textContent = text;
        }
        function hideJoinStatus() {
            const box = document.getElementById('joinStatus');
            if (box) box.remove();
        }

        // Stream sounds via postMessage (called when test game signals ready)
        function streamSoundsToWindow(targetWindow, sounds) {
            logTestEvent('Starting to stream ' + sounds.length + ' sounds...');
            let index = 0;

            function sendNext() {
                if (index >= sounds.length) {
                    logTestEvent('All sounds streamed');
                    targetWindow.postMessage({ type: 'sounds-complete' }, '*');
                    return;
                }

                const sound = sounds[index];
                logTestEvent('Streaming sound ' + (index + 1) + '/' + sounds.length + ': ' + sound.name);
                targetWindow.postMessage({
                    type: 'sound-data',
                    index: index,
                    data: sound.data,
                    name: sound.name
                }, '*');

                index++;
                // Delay between sounds to let iPad breathe
                setTimeout(sendNext, 500);
            }

            sendNext();
        }