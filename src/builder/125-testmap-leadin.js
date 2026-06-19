        // ===== TEST MAP =====
        let testLogs = []; // Logs saved to localStorage for crash recovery

        function logTestEvent(msg, type = 'info') {
            const entry = { time: Date.now(), msg, type };
            testLogs.push(entry);
            localStorage.setItem('testGameCrashLog', JSON.stringify(testLogs));
            console.log('[TestMap]', msg);

            // Add to visible console
            const logsDiv = document.getElementById('testConsoleLogs');
            if (logsDiv) {
                const time = new Date().toLocaleTimeString();
                const div = document.createElement('div');
                div.className = type;
                div.innerHTML = '<span class="time">' + time + '</span>' + msg;
                logsDiv.appendChild(div);
                logsDiv.scrollTop = logsDiv.scrollHeight; // Auto-scroll
            }
        }

        function openTestConsole() {
            const console = document.getElementById('testConsole');
            const logsDiv = document.getElementById('testConsoleLogs');
            if (console) console.classList.add('visible');
            if (logsDiv) logsDiv.innerHTML = ''; // Clear previous logs
        }

        function testMap() {
            if (typeof stopLandingTheme === 'function') stopLandingTheme(); // game launching — fade menu theme
            // Open visible console and clear previous logs (skip on the public join path).
            if (!window.__joinMode) openTestConsole();
            testLogs = [];
            logTestEvent('Starting test game...');

            // Get project data. When joining a live room (mobile "join the world"), use the
            // world snapshot received over the network; otherwise build it from the local editor.
            const projectDataForTest = (window.__joinMode && window.__joinWorld) ? window.__joinWorld : getProjectData();
            // Add base URL so external doors can resolve relative paths
            projectDataForTest.baseUrl = window.location.href.replace(/\/[^\/]*$/, '/');
            if (launchAsAdventure) {
                projectDataForTest.autoHideUI = true;
            }
            // Add multiplayer settings if set
            if (multiplayerSettings) {
                projectDataForTest.multiplayer = {
                    playerName: multiplayerSettings.playerName,
                    roomCode: multiplayerSettings.roomCode
                };
                logTestEvent('Multiplayer: ' + multiplayerSettings.playerName + ' in room ' + multiplayerSettings.roomCode);
            }
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

            logTestEvent('Mobile: ' + isMobile + ', Sounds: ' + (projectDataForTest.sounds?.length || 0));

            // On mobile, strip sound data - will stream via postMessage.
            // Skip in join mode: the network world already has audio stripped (silent for v1).
            let soundsToStream = [];
            if (!window.__joinMode && isMobile && projectDataForTest.sounds && projectDataForTest.sounds.length > 0) {
                soundsToStream = projectDataForTest.sounds.map(s => ({ ...s }));
                projectDataForTest.sounds = projectDataForTest.sounds.map(s => ({
                    name: s.name, duration: s.duration, type: s.type
                }));
                projectDataForTest.soundsWillStream = true;
                logTestEvent('Stripped ' + soundsToStream.length + ' sounds for streaming');
            }

            const projectDataJSON = JSON.stringify(projectDataForTest);
            const dataSize = projectDataJSON.length;
            const sizeMB = (dataSize / 1000000).toFixed(1);
            logTestEvent('Project size: ' + sizeMB + 'MB');

            // Setup message listener for test game communication
            window.testGameData = { projectDataJSON, soundsToStream };
            window.onmessage = (e) => {
                if (e.data.type === 'log') {
                    logTestEvent('[Game] ' + e.data.msg, e.data.level || 'info');
                } else if (e.data.type === 'ready') {
                    logTestEvent('Test game ready, sending data...');
                    // Include room code so the engine can auto-join multiplayer.
                    const payload = { type: 'project-data', data: projectDataJSON };
                    if (window.__joinMode && window.__joinRoom) {
                        // Joining a live room: sync positions through the play party.
                        payload.autoMultiplayer = {
                            roomCode: window.__joinRoom,
                            playerName: window.__joinName || ('Viewer' + Math.floor(Math.random() * 1000)),
                            partyPath: 'parties/play'
                        };
                    } else if (builderConnected && builderRoomCode) {
                        payload.autoMultiplayer = {
                            roomCode: builderRoomCode,
                            playerName: builderPlayerName + '-tester'
                        };
                        // Also pass builder room for live sync of edits
                        payload.builderSync = {
                            roomCode: builderRoomCode
                        };
                    }
                    e.source.postMessage(payload, '*');
                    // Stream sounds with delay
                    if (soundsToStream.length > 0) {
                        streamSoundsToWindow(e.source, soundsToStream);
                    }
                }
            };

            logTestEvent('Opening test window...');

            // Create minimal loader HTML