        // === SOUND SYSTEM ===
        let soundsData = projectData.sounds || []; // 'let' so we can receive streamed sounds
        // Use outer scope tileSounds for live sync
        tileSounds = projectData.tileSounds || {};
        const playerSoundsData = projectData.playerSounds || {
            walk: { soundIndex: -1, interval: 200, volume: 0.5, pitchVariation: 0.1 },
            attack: { soundIndex: -1, volume: 0.7, pitchVariation: 0.15, lengthVariation: 0 },
            inventoryOpen: { soundIndex: -1, volume: 0.5 },
            inventoryClose: { soundIndex: -1, volume: 0.5 }
        };
        // Ensure inventory fields exist for older saves
        if (!playerSoundsData.inventoryOpen) playerSoundsData.inventoryOpen = { soundIndex: -1, volume: 0.5 };
        if (!playerSoundsData.inventoryClose) playerSoundsData.inventoryClose = { soundIndex: -1, volume: 0.5 };
        const soundsWillStream = projectData.soundsWillStream || false;
        let soundsStreamedCount = 0;

        console.log('=== SOUND DATA LOADED ===');
        console.log('Sounds array:', soundsData.length, soundsData);
        console.log('Sounds will stream:', soundsWillStream);
        console.log('Tile sounds:', Object.keys(tileSounds).length, tileSounds);
        console.log('Player sounds:', playerSoundsData);

        // === TRIGGER/MAP SYSTEM ===
        // Use outer scope placedTriggers for live sync
        placedTriggers = projectData.placedTriggers || [];
        // Wave 7: stamp missing UIDs so game-side updateTrigger/removeTrigger lookups work.
        if (typeof ensureTriggerUids === 'function') ensureTriggerUids(placedTriggers);
        const mapsData = projectData.maps || {};
        const spawnMapNameData = projectData.spawnMapName || 'main';
        currentGameMap = spawnMapNameData; // Start on the map where spawn is set
        onMapEnter(currentGameMap);  // Track initial map for quest conditions
        console.log('Triggers:', placedTriggers.length, 'Maps:', Object.keys(mapsData).length, 'SpawnMap:', spawnMapNameData);

        // === DIALOG SYSTEM ===
        const dialogs = projectData.dialogs || [];
        const placedDialogTiles = projectData.placedDialogTiles || [];
        console.log('Dialogs:', dialogs.length, 'Dialog tiles:', placedDialogTiles.length);

        // NPC Talk Sound - lazy-loaded once audio is unlocked (the AudioContext doesn't exist at
        // startup, so the old eager decode silently produced no buffer -> no typing sound).
        let npcTalkSoundBuffer = null;
        let npcTalkLoading = false;
        let lastTalkSoundTime = 0;
        const TALK_SOUND_MIN_INTERVAL = 50; // Minimum ms between sounds

        function ensureTalkSound() {
            if (npcTalkSoundBuffer || npcTalkLoading || !audioContext) return;
            npcTalkLoading = true;
            const base = (typeof projectData !== 'undefined' && projectData && projectData.baseUrl) ? projectData.baseUrl : '';
            fetch(base + 'talkingnpcsound.mp3')
                .then(r => r.arrayBuffer())
                .then(ab => audioContext.decodeAudioData(ab))
                .then(buf => { npcTalkSoundBuffer = buf; console.log('[NPC TALK] Sound loaded'); })
                .catch(err => { npcTalkLoading = false; console.log('[NPC TALK] Could not load:', err.message); });
        }

        // Short synth blip for UI (dialog choice move/confirm). No asset, never lags.
        function uiBlip(freq, dur, vol, type) {
            if (!audioContext) return;
            const o = audioContext.createOscillator(), g = audioContext.createGain();
            o.type = type || 'square'; o.frequency.value = freq;
            g.gain.setValueAtTime(vol || 0.12, audioContext.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + (dur || 0.06));
            o.connect(g); g.connect(audioContext.destination);
            o.start(); o.stop(audioContext.currentTime + (dur || 0.06));
        }
        function dialogMoveSound() { uiBlip(520, 0.05, 0.1); }
        function dialogSelectSound() { uiBlip(440, 0.05, 0.13); setTimeout(() => uiBlip(680, 0.08, 0.13), 55); }

        // Play NPC talk sound with pitch/length variation based on character
        function playNpcTalkSound(char) {
            ensureTalkSound();
            if (!audioContext || !npcTalkSoundBuffer) return;

            const now = performance.now();
            if (now - lastTalkSoundTime < TALK_SOUND_MIN_INTERVAL) return;
            lastTalkSoundTime = now;

            // Skip spaces and punctuation (silent pause)
            if (/[\s.,!?;:\-]/.test(char)) return;

            // Create buffer source
            const source = audioContext.createBufferSource();
            source.buffer = npcTalkSoundBuffer;

            // Pitch variation based on character code (gives each letter a slightly different pitch)
            const charCode = char.toLowerCase().charCodeAt(0);
            const basePitch = 0.9 + (charCode % 26) / 26 * 0.4; // Range 0.9 to 1.3
            const randomVariation = (Math.random() - 0.5) * 0.2; // ±0.1 random
            source.playbackRate.value = basePitch + randomVariation;

            // Gain node for volume
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 0.3; // Keep it subtle

            source.connect(gainNode);
            gainNode.connect(audioContext.destination);

            source.start(0);
        }

        // === ITEMS SYSTEM (interactive objects like chests) ===
        itemsData = projectData.items || []; // assigns hoisted top-level var (see decl near playerInventory)
        var fishingLoot = projectData.fishingLoot || []; // fishing loot table: [{ itemIndex, weight }]
        const placedItemsData = projectData.placedItems || [];
        const itemImages = {}; // Preloaded item sprite images
        const itemStates = {}; // Runtime state for each placed item: { used: false, animating: false, frame: 0 }

        // Preload item sprites
        itemsData.forEach((item, i) => {
            if (item.spriteData) {
                const img = new Image();
                img.src = item.spriteData;
                itemImages[i] = img;
            }
        });

        // Initialize item states
        placedItemsData.forEach((placed, i) => {
            if (!placed) return; // Skip null entries
            itemStates[i] = {
                used: placed.used || false,
                animating: false,
                frame: itemsData[placed.itemIndex]?.idleFrame || 0,
                frameTimer: 0
            };
        });
        console.log('Items:', itemsData.length, 'Placed items:', placedItemsData.length);

        // === INVENTORY SYSTEM ===
        const INVENTORY_SIZE = 40;  // Total slots (4 rows x 10 columns)
        const HOTBAR_SIZE = 10;     // First 10 slots shown in HUD
        const SLOT_SIZE = 40;       // Pixel size of each slot in UI
        inventorySlots = [];    // assigns hoisted top-level var (see decl near playerInventory)
        let cursorItem = null;      // Item held on cursor: { itemIndex, quantity } or null
        let inventoryOpen = false;  // Is full inventory popup open
        let selectedHotbarSlot = 0; // Currently selected hotbar slot (0-9)
