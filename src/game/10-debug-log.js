        // Debug log for iPad (captures console output)
        const debugLogEl = document.getElementById('debugLog');
        let debugLogVisible = false;

        function toggleDebugLog() {
            debugLogVisible = !debugLogVisible;
            debugLogEl.classList.toggle('visible', debugLogVisible);
            document.getElementById('toggleLogBtn').textContent = debugLogVisible ? 'Hide Log' : 'Show Log';
        }

        function logToScreen(msg, type = 'log') {
            const line = document.createElement('div');
            line.className = type;
            line.textContent = new Date().toLocaleTimeString() + ' ' + msg;
            debugLogEl.appendChild(line);
            debugLogEl.scrollTop = debugLogEl.scrollHeight;
            // Keep only last 50 lines
            while (debugLogEl.children.length > 50) {
                debugLogEl.removeChild(debugLogEl.firstChild);
            }
        }

        // Capture console methods
        const origLog = console.log;
        const origWarn = console.warn;
        const origError = console.error;
        console.log = (...args) => { origLog(...args); logToScreen(args.join(' '), 'log'); };
        console.warn = (...args) => { origWarn(...args); logToScreen(args.join(' '), 'warn'); };
        console.error = (...args) => { origError(...args); logToScreen(args.join(' '), 'error'); };

        // Capture uncaught errors
        window.onerror = (msg, url, line, col, error) => {
            logToScreen('ERROR: ' + msg + ' at line ' + line, 'error');
        };
        window.onunhandledrejection = (e) => {
            logToScreen('PROMISE ERROR: ' + e.reason, 'error');
        };

        logToScreen('Debug log initialized');