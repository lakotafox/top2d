        // ===== INDEXEDDB STORAGE =====
        let projectDB = null;

        function initProjectDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open('WorldBuilderDB', 1);
                request.onerror = () => {
                    console.error('IndexedDB error:', request.error);
                    reject(request.error);
                };
                request.onsuccess = () => {
                    projectDB = request.result;
                    console.log('IndexedDB opened successfully');
                    resolve(projectDB);
                };
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('projects')) {
                        db.createObjectStore('projects');
                        console.log('Created projects object store');
                    }
                };
            });
        }

        async function saveProjectToDB(data) {
            try {
                if (!projectDB) await initProjectDB();
                return new Promise((resolve, reject) => {
                    const tx = projectDB.transaction('projects', 'readwrite');
                    const store = tx.objectStore('projects');
                    const request = store.put(data, 'current');
                    request.onsuccess = () => {
                        console.log('Project saved to IndexedDB');
                        resolve();
                    };
                    request.onerror = () => {
                        console.error('IndexedDB save error:', request.error);
                        reject(request.error);
                    };
                });
            } catch (err) {
                console.error('saveProjectToDB error:', err);
                throw err;
            }
        }

        async function loadProjectFromDB() {
            try {
                if (!projectDB) await initProjectDB();
                return new Promise((resolve, reject) => {
                    const tx = projectDB.transaction('projects', 'readonly');
                    const store = tx.objectStore('projects');
                    const request = store.get('current');
                    request.onsuccess = () => {
                        resolve(request.result);
                    };
                    request.onerror = () => {
                        console.error('IndexedDB load error:', request.error);
                        reject(request.error);
                    };
                });
            } catch (err) {
                console.error('loadProjectFromDB error:', err);
                throw err;
            }
        }

        // ===== Wave 3 feature: named builder saves (multiple IndexedDB slots) =====
        function _slotKey(name) { return 'named:' + name; }

        async function saveNamedProjectToDB(name, data) {
            if (!name) throw new Error('save name required');
            if (!projectDB) await initProjectDB();
            return new Promise((resolve, reject) => {
                const tx = projectDB.transaction('projects', 'readwrite');
                tx.objectStore('projects').put(data, _slotKey(name));
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }

        async function loadNamedProjectFromDB(name) {
            if (!projectDB) await initProjectDB();
            return new Promise((resolve, reject) => {
                const tx = projectDB.transaction('projects', 'readonly');
                const request = tx.objectStore('projects').get(_slotKey(name));
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async function deleteNamedProjectFromDB(name) {
            if (!projectDB) await initProjectDB();
            return new Promise((resolve, reject) => {
                const tx = projectDB.transaction('projects', 'readwrite');
                tx.objectStore('projects').delete(_slotKey(name));
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }

        async function listNamedProjects() {
            if (!projectDB) await initProjectDB();
            return new Promise((resolve, reject) => {
                const tx = projectDB.transaction('projects', 'readonly');
                const request = tx.objectStore('projects').getAllKeys();
                request.onsuccess = () => {
                    const all = request.result || [];
                    resolve(all.filter(k => typeof k === 'string' && k.startsWith('named:'))
                               .map(k => k.slice('named:'.length)));
                };
                request.onerror = () => reject(request.error);
            });
        }

        // Public: Save As… prompts for a name and writes to a new slot.
        async function saveProjectAs() {
            const defaultName = (typeof currentSaveName === 'string' && currentSaveName) ? currentSaveName : '';
            const raw = prompt('Name this save:', defaultName);
            if (raw === null) return;
            const name = raw.trim();
            if (!name) { alert('Name cannot be empty.'); return; }
            try {
                const existing = await loadNamedProjectFromDB(name);
                if (existing && !confirm(`"${name}" already exists. Overwrite?`)) return;
                const data = getProjectData();
                data.saveName = name;
                await saveNamedProjectToDB(name, data);
                currentSaveName = name;
                console.log('[SAVE] Saved as:', name);
                alert('Saved as "' + name + '"');
            } catch (e) {
                console.error('[SAVE] saveProjectAs error:', e);
                alert('Save failed — see console.');
            }
        }

        // Public: opens a picker listing named saves with load/delete controls.
        async function showNamedSavesPicker() {
            try {
                const names = (await listNamedProjects()).sort();
                if (names.length === 0) { alert('No named saves yet. Use "Save As…" to create one.'); return; }
                const picker = document.getElementById('namedSavesPicker');
                if (!picker) return;
                // Build DOM programmatically to avoid string-escaping pitfalls.
                picker.innerHTML = '';
                for (const n of names) {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex; gap:6px; margin:4px 0; align-items:center;';
                    const label = document.createElement('span');
                    label.style.cssText = 'flex:1; color:#4af; font-size:10px;';
                    label.textContent = n;
                    const loadBtn = document.createElement('button');
                    loadBtn.className = 'retro-btn';
                    loadBtn.style.cssText = 'font-size:9px; padding:3px 6px;';
                    loadBtn.textContent = 'LOAD';
                    loadBtn.onclick = () => loadNamedProject(n);
                    const delBtn = document.createElement('button');
                    delBtn.className = 'retro-btn';
                    delBtn.style.cssText = 'font-size:9px; padding:3px 6px; background:#a55;';
                    delBtn.textContent = '×';
                    delBtn.onclick = () => deleteNamedProject(n);
                    row.appendChild(label);
                    row.appendChild(loadBtn);
                    row.appendChild(delBtn);
                    picker.appendChild(row);
                }
                picker.style.display = 'block';
            } catch (e) { console.error(e); }
        }

        async function loadNamedProject(name) {
            try {
                const data = await loadNamedProjectFromDB(name);
                if (!data) { alert('Save "' + name + '" not found.'); return; }
                currentSaveName = name;
                await loadProject(data);
                const picker = document.getElementById('namedSavesPicker');
                if (picker) picker.style.display = 'none';
            } catch (e) {
                console.error('[LOAD] loadNamedProject error:', e);
                alert('Load failed — see console.');
            }
        }

        async function deleteNamedProject(name) {
            if (!confirm('Delete save "' + name + '"? This cannot be undone.')) return;
            try {
                await deleteNamedProjectFromDB(name);
                if (currentSaveName === name) currentSaveName = '';
                showNamedSavesPicker();
            } catch (e) { console.error(e); }
        }

        let currentSaveName = '';
        // ===== end Wave 3 named-saves feature =====

        async function showStorageInfo() {
            const data = getProjectData();
            const json = JSON.stringify(data);
            const totalMB = (json.length / 1000000).toFixed(2);

            // Get storage quota (if available)
            let quotaInfo = 'Unknown';
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                const usedMB = (estimate.usage / 1000000).toFixed(2);
                const quotaMB = (estimate.quota / 1000000).toFixed(0);
                quotaInfo = usedMB + 'MB / ' + quotaMB + 'MB';
            }

            // Breakdown by component
            const soundsSize = JSON.stringify(data.sounds || []).length;
            const tilesetsSize = JSON.stringify(data.tilesets || []).length;
            const propsSize = JSON.stringify(data.props || []).length;
            const animPropsSize = JSON.stringify(data.animatedProps || []).length;
            const npcsSize = JSON.stringify(data.npcs || []).length;
            const mapSize = JSON.stringify(data.layers || []).length;

            alert('Project Size: ' + totalMB + 'MB\n' +
                'Browser Storage: ' + quotaInfo + '\n\n' +
                'Breakdown:\n' +
                '- Sounds: ' + (soundsSize/1000000).toFixed(2) + 'MB\n' +
                '- Tilesets: ' + (tilesetsSize/1000000).toFixed(2) + 'MB\n' +
                '- Props: ' + (propsSize/1000000).toFixed(2) + 'MB\n' +
                '- Animated Props: ' + (animPropsSize/1000000).toFixed(2) + 'MB\n' +
                '- NPCs: ' + (npcsSize/1000000).toFixed(2) + 'MB\n' +
                '- Map Data: ' + (mapSize/1000000).toFixed(2) + 'MB');
        }

        // Initialize IndexedDB on page load
        initProjectDB().catch(err => console.warn('IndexedDB init failed, will use localStorage:', err));
