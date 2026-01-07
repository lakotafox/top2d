# Quest System Implementation Plan

## Overview

Add a Quest system to `world-builder.html` with:
- Builder UI (new Quests tab)
- Click-on-map condition targeting
- Runtime evaluation in test game
- Dialog integration (conditional text)
- Multiplayer sync
- Click-to-attach enhancement for dialogs

---

## Data Structures

### Quest Definition
```javascript
let quests = [];

// Quest structure:
{
  id: 'quest_001',                    // Unique identifier (auto-generated)
  name: 'Find the Lost Sword',        // Display name
  description: 'Help the blacksmith', // Description text

  stages: [{                          // Array for multi-stage (MVP: single stage)
    stageIndex: 0,
    description: 'Find the sword',
    conditions: [{
      type: 'hasItem' | 'talkedToNpc' | 'enemyDefeated' | 'locationVisited',
      target: number | string,        // itemIndex, placedNpcIndex, or mapName
      x: number,                      // Tile X (for locationVisited)
      y: number,                      // Tile Y (for locationVisited)
      mapName: string,                // Map name where target is
      count: 1                        // How many required (items/enemies)
    }],
    onComplete: {
      giveItems: [itemIndex],         // Items to give player
      removeItems: [itemIndex],       // Items to take from player
      unlockQuests: [questId],        // Quest IDs to make available
      showDialog: dialogIndex | null  // Dialog to trigger on completion
    }
  }],

  prerequisites: [questId],           // Quest IDs that must be completed first
  autoStart: false,                   // Start automatically when prerequisites met
  startNpcIndex: placedNpcIndex,      // NPC that gives this quest (null = auto)
  turnInNpcIndex: placedNpcIndex,     // NPC to turn in quest (null = same as giver)
  isRepeatable: false                 // Can be done multiple times
}
```

### Inventory (NEW)
```javascript
let playerInventory = [];             // Test game runtime

// Structure:
{ itemIndex: number, quantity: number }
```

### Game Progress (NEW)
```javascript
let gameProgress = {
  npcsSpokenTo: [],                   // Array of placedNpcIndex values
  enemiesDefeated: {},                // { placedNpcIndex: count }
  locationsVisited: [],               // Array of mapName strings
  questStates: {}                     // { questId: { status, currentStage } }
};

const QUEST_STATUS = {
  LOCKED: 'locked',                   // Prerequisites not met
  AVAILABLE: 'available',             // Can be started
  ACTIVE: 'active',                   // In progress
  COMPLETED: 'completed'
};
```

### Dialog Page Conditions (Extension)
```javascript
// Extend existing dialog page structure:
page.conditions = [{
  type: 'questStatus' | 'hasItem',
  questId: string,                    // For questStatus
  status: 'available' | 'active' | 'completed' | 'locked',
  itemIndex: number                   // For hasItem
}];
page.fallbackPageIndex = number;      // Show this page if conditions not met
```

---

## Quest Editor UX (Click-on-Map Approach)

### User Flow for Adding a Condition:

1. **Select condition type** from dropdown:
   - Kill NPC
   - Talk to NPC
   - Visit Location
   - Has Item

2. **Click "SET CONDITION" button**
   - Big retro button (cyan/purple gradient, like main menu)
   - Glowing/pulsing animation

3. **Button enters active state**
   - Button pulses with cyan glow
   - Status text shows: "Click on an NPC..." or "Click on a tile..."

4. **Map shows visual feedback**
   - Kill NPC: Enemy NPCs get red glow outline
   - Talk to NPC: All NPCs get cyan glow outline
   - Visit Location: Grid overlay appears (like trigger placement)
   - Has Item: Item dropdown popup appears (no map click)

5. **Click on target**
   - Condition added to list
   - Mode automatically exits
   - Shows: "Kill: Goblin at (5,3) on forest"

6. **Cancel**: Press ESC or click button again

### Visual Mockup:
```
┌─────────────────────────────────────────────────────────────┐
│  QUESTS TAB                                                 │
├──────────────┬──────────────────────────────────────────────┤
│ Quest List   │  Quest Editor                                │
│              │                                              │
│ > Find Sword │  ID:   [quest_1703345678    ]               │
│   Rescue Cat │  Name: [Find the Lost Sword ]               │
│   Kill Gobs  │  Desc: [The blacksmith lost...]             │
│              │                                              │
│              │  ── Quest Giver ──                           │
│              │  Given by: [Blacksmith ▼] [PICK ON MAP]     │
│              │  Turn in:  [Same ▼]                          │
│              │                                              │
│              │  ── Add Condition ──                         │
│              │  Type: [Kill NPC ▼]                          │
│              │                                              │
│              │  ╔════════════════════════════════════╗      │
│              │  ║        SET CONDITION               ║      │
│              │  ║   (cyan/purple glow animation)     ║      │
│              │  ╚════════════════════════════════════╝      │
│              │  Status: Click on an enemy NPC...            │
│              │                                              │
│              │  ── Active Conditions ──                     │
│              │  ┌──────────────────────────────────────┐    │
│              │  │ Kill: Goblin at (5,3) "forest"   [X] │    │
│              │  │ Talk: Smith at (2,1) "main"      [X] │    │
│              │  │ Visit: (10,15) "dungeon"         [X] │    │
│              │  │ Has Item: Rusty Sword x1         [X] │    │
│              │  └──────────────────────────────────────┘    │
│              │                                              │
│              │  ── Rewards ──                               │
│              │  ┌──────────────────────────────────────┐    │
│              │  │ Give: Gold Coin                  [X] │    │
│              │  │ Remove: Rusty Sword              [X] │    │
│              │  └──────────────────────────────────────┘    │
│              │  [+ Give Item] [+ Remove Item]               │
│              │                                              │
│ [+ NEW QUEST]│  [DELETE QUEST]                              │
└──────────────┴──────────────────────────────────────────────┘
```

---

## Dialog Tab Enhancement: Click-to-Attach

Same click-on-map pattern for attaching dialogs to NPCs:

1. Select dialog from list
2. Click **"ATTACH TO NPC"** button (same retro style)
3. Button enters active state, NPCs highlight on map
4. Click on NPC → dialog attached
5. Shows confirmation, mode exits

This gives users OPTIONS - dropdown method still works, but now they can also click on map.

---

## Implementation Phases

### Phase 1: Inventory System (Prerequisite)
**Location: ~line 17000-17100 (test game runtime), ~19900-20000 (functions)**

Required for "has item" quest conditions.

```javascript
// Add variable
let playerInventory = [];

// Add functions
function addToInventory(itemIndex, quantity = 1) {
    const existing = playerInventory.find(inv => inv.itemIndex === itemIndex);
    if (existing) {
        existing.quantity += quantity;
    } else {
        playerInventory.push({ itemIndex, quantity });
    }
    checkQuestConditions();  // Trigger quest evaluation
}

function removeFromInventory(itemIndex, quantity = 1) {
    const existing = playerInventory.find(inv => inv.itemIndex === itemIndex);
    if (existing) {
        existing.quantity -= quantity;
        if (existing.quantity <= 0) {
            playerInventory = playerInventory.filter(inv => inv.itemIndex !== itemIndex);
        }
        return true;
    }
    return false;
}

function hasInventoryItem(itemIndex, quantity = 1) {
    const existing = playerInventory.find(inv => inv.itemIndex === itemIndex);
    return existing && existing.quantity >= quantity;
}

function getInventoryCount(itemIndex) {
    const existing = playerInventory.find(inv => inv.itemIndex === itemIndex);
    return existing ? existing.quantity : 0;
}
```

**Modify `startReceivingItem()` (~line 19924):**
```javascript
// After pickup animation starts, add:
addToInventory(itemIndex, 1);
```

### Phase 2: Quest Tab UI
**Location: ~line 1401-1412 (buttons), ~2038-2066 (content area), ~334-741 (CSS)**

1. **Add sidebar button** (after dialog button, ~line 1411):
```html
<button id="questMode" onclick="setMode('quest')">Quests</button>
```

2. **Add toolbar button** (~line 2084):
```html
<button id="questMode2" onclick="setMode('quest')">Quest</button>
```

3. **Add content div** (after itemModeContent, ~line 2066):
```html
<!-- QUESTS MODE -->
<div id="questModeContent" style="display:none;">
    <div class="quest-container">
        <div class="quest-list-panel">
            <h3>Quests</h3>
            <div id="questList" class="item-list"></div>
            <button onclick="addNewQuest()" class="retro-btn quest-btn">+ NEW QUEST</button>
        </div>
        <div class="quest-editor-panel" id="questEditorPanel" style="display:none;">
            <!-- Quest editor content here -->
        </div>
    </div>
</div>
```

4. **Add CSS** (~line 737, after other mode styles):
```css
/* Quest tab colors */
#questMode:hover, #questMode.active { border-color: #a8f; color: #a8f; background: #1a0a1f; }
#questMode2:hover, #questMode2.active { border-color: #a8f; color: #a8f; background: #1a0a1f; }

/* SET CONDITION button */
.set-condition-btn {
    background: linear-gradient(135deg, #0ff, #a8f);
    border: 2px solid #0ff;
    color: #000;
    font-family: 'Press Start 2P', monospace;
    font-size: 12px;
    padding: 15px 30px;
    cursor: pointer;
    transition: all 0.3s;
    text-shadow: 0 0 5px #fff;
}

.set-condition-btn:hover {
    box-shadow: 0 0 20px #0ff, 0 0 40px #a8f;
    transform: scale(1.05);
}

.set-condition-btn.active {
    animation: conditionPulse 1s infinite;
    box-shadow: 0 0 30px #0ff;
}

@keyframes conditionPulse {
    0%, 100% { box-shadow: 0 0 20px #0ff, 0 0 40px #a8f; }
    50% { box-shadow: 0 0 40px #0ff, 0 0 60px #a8f; }
}

/* Quest container layout */
.quest-container {
    display: flex;
    gap: 20px;
    height: 100%;
}

.quest-list-panel {
    width: 200px;
    flex-shrink: 0;
}

.quest-editor-panel {
    flex: 1;
    overflow-y: auto;
    padding: 15px;
    background: #1a1a2e;
    border: 2px solid #444;
    border-radius: 8px;
}

/* Condition list items */
.condition-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: #252540;
    border-radius: 4px;
    margin-bottom: 5px;
}

.condition-item .condition-type {
    color: #a8f;
    min-width: 60px;
}

.condition-item .condition-target {
    flex: 1;
    color: #fff;
}

.condition-item .remove-btn {
    background: #f55;
    border: none;
    color: #fff;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    cursor: pointer;
}
```

5. **Update setMode()** (~line 4893-4966):
```javascript
// Add to button toggles:
document.getElementById('questMode').classList.toggle('active', m === 'quest');
document.getElementById('questMode2').classList.toggle('active', m === 'quest');

// Add to content visibility:
document.getElementById('questModeContent').style.display = m === 'quest' ? 'block' : 'none';

// Add to labels object:
quest: 'Quests',

// Add to mode initialization:
if (m === 'quest') {
    renderQuestList();
    if (selectedQuestIndex >= 0) {
        loadQuestIntoEditor(selectedQuestIndex);
    }
}
```

### Phase 3: Quest Editor Functions
**Location: ~line 12700 (after dialog editor functions)**

```javascript
// ============== QUEST EDITOR ==============

let selectedQuestIndex = -1;
let settingConditionMode = false;
let settingConditionType = null;  // 'kill', 'talk', 'visit', 'hasItem'

// Generate unique quest ID
function generateQuestId() {
    return 'quest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Create new quest
function addNewQuest() {
    const newQuest = {
        id: generateQuestId(),
        name: 'New Quest',
        description: '',
        stages: [{
            stageIndex: 0,
            description: 'Complete the objective',
            conditions: [],
            onComplete: {
                giveItems: [],
                removeItems: [],
                unlockQuests: [],
                showDialog: null
            }
        }],
        prerequisites: [],
        autoStart: false,
        startNpcIndex: null,
        turnInNpcIndex: null,
        isRepeatable: false
    };

    quests.push(newQuest);
    selectedQuestIndex = quests.length - 1;
    renderQuestList();
    loadQuestIntoEditor(selectedQuestIndex);

    broadcastEdit({
        editType: 'addQuest',
        quest: newQuest,
        index: selectedQuestIndex
    });
}

// Render quest list
function renderQuestList() {
    const listEl = document.getElementById('questList');
    if (!listEl) return;

    listEl.innerHTML = '';

    quests.forEach((quest, index) => {
        const item = document.createElement('div');
        item.className = 'quest-list-item' + (index === selectedQuestIndex ? ' selected' : '');
        item.innerHTML = `
            <span class="quest-name">${quest.name || 'Unnamed Quest'}</span>
            <span class="quest-id">${quest.id}</span>
        `;
        item.onclick = () => selectQuest(index);
        listEl.appendChild(item);
    });
}

// Select a quest
function selectQuest(index) {
    selectedQuestIndex = index;
    renderQuestList();
    loadQuestIntoEditor(index);
}

// Load quest into editor
function loadQuestIntoEditor(index) {
    const quest = quests[index];
    const panel = document.getElementById('questEditorPanel');

    if (!quest) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';

    // Populate fields
    document.getElementById('questId').value = quest.id || '';
    document.getElementById('questName').value = quest.name || '';
    document.getElementById('questDescription').value = quest.description || '';
    document.getElementById('questAutoStart').checked = quest.autoStart || false;

    // Populate NPC dropdowns
    populateQuestNpcDropdowns();
    document.getElementById('questStartNpc').value = quest.startNpcIndex ?? '';
    document.getElementById('questTurnInNpc').value = quest.turnInNpcIndex ?? '';

    // Render conditions
    renderQuestConditions();

    // Render rewards
    renderQuestRewards();
}

// Populate NPC dropdowns
function populateQuestNpcDropdowns() {
    const startSelect = document.getElementById('questStartNpc');
    const turnInSelect = document.getElementById('questTurnInNpc');

    const npcOptions = placedNpcs.map((pnpc, i) => {
        const npc = npcs[pnpc.npcIndex];
        const name = npc ? npc.name : `NPC ${i}`;
        const map = pnpc.mapName || currentMapName;
        return `<option value="${i}">${name} (${map})</option>`;
    }).join('');

    startSelect.innerHTML = '<option value="">-- None (Auto-start) --</option>' + npcOptions;
    turnInSelect.innerHTML = '<option value="">-- Same as giver --</option>' + npcOptions;
}

// Update quest field
function updateQuestField(field, value) {
    if (selectedQuestIndex < 0) return;

    const quest = quests[selectedQuestIndex];

    if (field === 'startNpcIndex' || field === 'turnInNpcIndex') {
        quest[field] = value === '' ? null : parseInt(value);
    } else {
        quest[field] = value;
    }

    if (field === 'name') renderQuestList();

    broadcastEdit({
        editType: 'updateQuest',
        index: selectedQuestIndex,
        field,
        value: quest[field]
    });
}

// ============== CONDITION SETTING (CLICK-ON-MAP) ==============

function startSettingCondition(type) {
    if (!selectedQuestIndex < 0) {
        alert('Select a quest first');
        return;
    }

    settingConditionMode = true;
    settingConditionType = type;

    // Update button state
    const btn = document.getElementById('setConditionBtn');
    btn.classList.add('active');
    btn.textContent = 'CANCEL';

    // Update status text
    const statusTexts = {
        'kill': 'Click on an enemy NPC on the map...',
        'talk': 'Click on an NPC on the map...',
        'visit': 'Click on a tile on the map...',
        'hasItem': ''  // Handled separately
    };
    document.getElementById('conditionStatus').textContent = statusTexts[type] || '';

    // For hasItem, show item picker popup instead
    if (type === 'hasItem') {
        showItemPickerPopup();
        return;
    }

    // Redraw map with highlights
    renderMap();
}

function cancelSettingCondition() {
    settingConditionMode = false;
    settingConditionType = null;

    // Reset button state
    const btn = document.getElementById('setConditionBtn');
    btn.classList.remove('active');
    btn.textContent = 'SET CONDITION';

    document.getElementById('conditionStatus').textContent = '';

    renderMap();
}

function handleMapClickForCondition(tileX, tileY) {
    if (!settingConditionMode) return false;

    const quest = quests[selectedQuestIndex];
    if (!quest) return false;

    const stage = quest.stages[0];  // MVP: single stage

    if (settingConditionType === 'kill') {
        // Find enemy NPC at this position
        const npcIdx = findPlacedNpcAt(tileX, tileY, true);  // true = enemies only
        if (npcIdx >= 0) {
            const pnpc = placedNpcs[npcIdx];
            const npc = npcs[pnpc.npcIndex];
            stage.conditions.push({
                type: 'enemyDefeated',
                target: npcIdx,
                x: pnpc.x,
                y: pnpc.y,
                mapName: pnpc.mapName || currentMapName,
                displayName: npc?.name || `Enemy ${npcIdx}`,
                count: 1
            });
            cancelSettingCondition();
            renderQuestConditions();
            broadcastConditionUpdate();
            return true;
        }
    }

    if (settingConditionType === 'talk') {
        // Find any NPC at this position
        const npcIdx = findPlacedNpcAt(tileX, tileY, false);
        if (npcIdx >= 0) {
            const pnpc = placedNpcs[npcIdx];
            const npc = npcs[pnpc.npcIndex];
            stage.conditions.push({
                type: 'talkedToNpc',
                target: npcIdx,
                x: pnpc.x,
                y: pnpc.y,
                mapName: pnpc.mapName || currentMapName,
                displayName: npc?.name || `NPC ${npcIdx}`
            });
            cancelSettingCondition();
            renderQuestConditions();
            broadcastConditionUpdate();
            return true;
        }
    }

    if (settingConditionType === 'visit') {
        // Use clicked tile position
        stage.conditions.push({
            type: 'locationVisited',
            target: currentMapName,
            x: tileX,
            y: tileY,
            mapName: currentMapName
        });
        cancelSettingCondition();
        renderQuestConditions();
        broadcastConditionUpdate();
        return true;
    }

    return false;
}

function findPlacedNpcAt(tileX, tileY, enemiesOnly = false) {
    for (let i = 0; i < placedNpcs.length; i++) {
        const pnpc = placedNpcs[i];
        if (pnpc.mapName && pnpc.mapName !== currentMapName) continue;
        if (enemiesOnly && !pnpc.isEnemy) continue;

        // Check if click is within NPC bounds (accounting for size)
        const npc = npcs[pnpc.npcIndex];
        const npcWidth = npc?.frameWidth || 32;
        const npcHeight = npc?.frameHeight || 32;
        const npcTileW = Math.ceil(npcWidth / tileSize);
        const npcTileH = Math.ceil(npcHeight / tileSize);

        if (tileX >= pnpc.x && tileX < pnpc.x + npcTileW &&
            tileY >= pnpc.y && tileY < pnpc.y + npcTileH) {
            return i;
        }
    }
    return -1;
}

function showItemPickerPopup() {
    // Create popup for item selection
    const popup = document.createElement('div');
    popup.id = 'itemPickerPopup';
    popup.className = 'item-picker-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <h3>Select Item</h3>
            <select id="itemPickerSelect">
                ${items.map((item, i) =>
                    `<option value="${i}">${item.name || 'Item ' + i}</option>`
                ).join('')}
            </select>
            <label>
                Quantity: <input type="number" id="itemPickerQty" value="1" min="1" style="width:60px;">
            </label>
            <div class="popup-buttons">
                <button onclick="confirmItemPick()">ADD</button>
                <button onclick="cancelItemPick()">CANCEL</button>
            </div>
        </div>
    `;
    document.body.appendChild(popup);
}

function confirmItemPick() {
    const itemIdx = parseInt(document.getElementById('itemPickerSelect').value);
    const qty = parseInt(document.getElementById('itemPickerQty').value) || 1;

    const quest = quests[selectedQuestIndex];
    const stage = quest.stages[0];
    const item = items[itemIdx];

    stage.conditions.push({
        type: 'hasItem',
        target: itemIdx,
        displayName: item?.name || `Item ${itemIdx}`,
        count: qty
    });

    document.getElementById('itemPickerPopup').remove();
    cancelSettingCondition();
    renderQuestConditions();
    broadcastConditionUpdate();
}

function cancelItemPick() {
    document.getElementById('itemPickerPopup').remove();
    cancelSettingCondition();
}

// Render conditions list
function renderQuestConditions() {
    const container = document.getElementById('questConditions');
    if (!container) return;

    const quest = quests[selectedQuestIndex];
    if (!quest) return;

    const stage = quest.stages[0];
    container.innerHTML = '';

    (stage.conditions || []).forEach((cond, i) => {
        const div = document.createElement('div');
        div.className = 'condition-item';

        let label = '';
        switch (cond.type) {
            case 'hasItem':
                label = `Has Item: ${cond.displayName} x${cond.count}`;
                break;
            case 'talkedToNpc':
                label = `Talk: ${cond.displayName} at (${cond.x},${cond.y})`;
                break;
            case 'enemyDefeated':
                label = `Kill: ${cond.displayName} at (${cond.x},${cond.y})`;
                break;
            case 'locationVisited':
                label = `Visit: (${cond.x},${cond.y}) on "${cond.mapName}"`;
                break;
        }

        div.innerHTML = `
            <span class="condition-target">${label}</span>
            <button class="remove-btn" onclick="removeQuestCondition(${i})">X</button>
        `;
        container.appendChild(div);
    });
}

function removeQuestCondition(index) {
    const quest = quests[selectedQuestIndex];
    if (!quest) return;

    quest.stages[0].conditions.splice(index, 1);
    renderQuestConditions();
    broadcastConditionUpdate();
}

function broadcastConditionUpdate() {
    const quest = quests[selectedQuestIndex];
    broadcastEdit({
        editType: 'updateQuestStageConditions',
        questIndex: selectedQuestIndex,
        stageIndex: 0,
        conditions: quest.stages[0].conditions
    });
}

// Map rendering additions for condition highlights
function renderQuestConditionHighlights(ctx) {
    if (!settingConditionMode) return;

    if (settingConditionType === 'kill') {
        // Highlight enemy NPCs with red glow
        placedNpcs.forEach((pnpc, i) => {
            if (!pnpc.isEnemy) return;
            if (pnpc.mapName && pnpc.mapName !== currentMapName) return;

            const px = pnpc.x * tileSize - scrollX;
            const py = pnpc.y * tileSize - scrollY;

            ctx.save();
            ctx.strokeStyle = '#f55';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#f55';
            ctx.shadowBlur = 15;
            ctx.strokeRect(px - 2, py - 2, tileSize + 4, tileSize + 4);
            ctx.restore();
        });
    }

    if (settingConditionType === 'talk') {
        // Highlight all NPCs with cyan glow
        placedNpcs.forEach((pnpc, i) => {
            if (pnpc.mapName && pnpc.mapName !== currentMapName) return;

            const px = pnpc.x * tileSize - scrollX;
            const py = pnpc.y * tileSize - scrollY;

            ctx.save();
            ctx.strokeStyle = '#0ff';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#0ff';
            ctx.shadowBlur = 15;
            ctx.strokeRect(px - 2, py - 2, tileSize + 4, tileSize + 4);
            ctx.restore();
        });
    }

    if (settingConditionType === 'visit') {
        // Show grid overlay for tile selection
        ctx.save();
        ctx.strokeStyle = 'rgba(168, 255, 0, 0.3)';
        ctx.lineWidth = 1;

        const startX = Math.floor(scrollX / tileSize);
        const startY = Math.floor(scrollY / tileSize);
        const endX = startX + Math.ceil(mapCanvas.width / tileSize) + 1;
        const endY = startY + Math.ceil(mapCanvas.height / tileSize) + 1;

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const px = x * tileSize - scrollX;
                const py = y * tileSize - scrollY;
                ctx.strokeRect(px, py, tileSize, tileSize);
            }
        }
        ctx.restore();
    }
}

// Delete quest
function deleteCurrentQuest() {
    if (selectedQuestIndex < 0) return;
    if (!confirm('Delete this quest?')) return;

    const deletedIndex = selectedQuestIndex;
    quests.splice(selectedQuestIndex, 1);
    selectedQuestIndex = -1;

    renderQuestList();
    document.getElementById('questEditorPanel').style.display = 'none';

    broadcastEdit({ editType: 'deleteQuest', index: deletedIndex });
}

// Rewards (similar pattern)
function renderQuestRewards() {
    // Implementation for give/remove item rewards
}

function addQuestReward(type) {
    // Add give or remove item
}

function removeQuestReward(index) {
    // Remove reward
}
```

### Phase 4: Hook into Map Click Handler
**Location: ~line 6800-7000 (where map click is handled)**

```javascript
// In the existing map canvas click handler, add at the beginning:
if (settingConditionMode) {
    const rect = mapCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left + scrollX) / zoom;
    const y = (event.clientY - rect.top + scrollY) / zoom;
    const tileX = Math.floor(x / tileSize);
    const tileY = Math.floor(y / tileSize);

    if (handleMapClickForCondition(tileX, tileY)) {
        return;  // Condition was set, don't process other clicks
    }
}

// In renderMap(), add call to render highlights:
renderQuestConditionHighlights(mapCtx);
```

### Phase 5: Dialog Tab Click-to-Attach Enhancement
**Location: ~line 1990-2035 (dialog content), ~line 16860-16880 (attach functions)**

Add similar click-on-map functionality for attaching dialogs:

```javascript
let attachDialogMode = false;
let attachDialogIndex = -1;

function startAttachDialogToNpc() {
    if (selectedDialogIndex < 0) {
        alert('Select a dialog first');
        return;
    }

    attachDialogMode = true;
    attachDialogIndex = selectedDialogIndex;

    document.getElementById('attachDialogBtn').classList.add('active');
    document.getElementById('attachDialogBtn').textContent = 'CANCEL';
    document.getElementById('attachDialogStatus').textContent = 'Click on an NPC on the map...';

    renderMap();
}

function cancelAttachDialog() {
    attachDialogMode = false;
    attachDialogIndex = -1;

    document.getElementById('attachDialogBtn').classList.remove('active');
    document.getElementById('attachDialogBtn').textContent = 'ATTACH TO NPC';
    document.getElementById('attachDialogStatus').textContent = '';

    renderMap();
}

function handleMapClickForDialogAttach(tileX, tileY) {
    if (!attachDialogMode) return false;

    const npcIdx = findPlacedNpcAt(tileX, tileY, false);
    if (npcIdx >= 0) {
        // Attach dialog to NPC
        placedNpcs[npcIdx].dialogIndex = attachDialogIndex;

        const npc = npcs[placedNpcs[npcIdx].npcIndex];
        console.log(`[DIALOG] Attached dialog ${attachDialogIndex} to ${npc?.name || 'NPC'}`);

        broadcastEdit({
            editType: 'attachNpcDialog',
            placedNpcIndex: npcIdx,
            dialogIndex: attachDialogIndex
        });

        cancelAttachDialog();
        return true;
    }

    return false;
}

// Add to renderMap for dialog attach highlights:
function renderDialogAttachHighlights(ctx) {
    if (!attachDialogMode) return;

    placedNpcs.forEach((pnpc, i) => {
        if (pnpc.mapName && pnpc.mapName !== currentMapName) return;

        const px = pnpc.x * tileSize - scrollX;
        const py = pnpc.y * tileSize - scrollY;

        ctx.save();
        ctx.strokeStyle = '#f6a';  // Pink for dialogs
        ctx.lineWidth = 3;
        ctx.shadowColor = '#f6a';
        ctx.shadowBlur = 15;
        ctx.strokeRect(px - 2, py - 2, tileSize + 4, tileSize + 4);
        ctx.restore();
    });
}
```

### Phase 6: Runtime Quest System (Test Game)
**Location: ~line 17000-17100 (runtime vars), ~line 20200-20300 (logic)**

```javascript
// Initialize on game start
function initializeQuestStates() {
    questsData.forEach(quest => {
        if (!gameProgress.questStates[quest.id]) {
            const prereqsMet = checkQuestPrerequisites(quest);
            gameProgress.questStates[quest.id] = {
                status: prereqsMet ? 'available' : 'locked',
                currentStage: 0
            };

            if (quest.autoStart && prereqsMet && !quest.startNpcIndex) {
                gameProgress.questStates[quest.id].status = 'active';
            }
        }
    });
}

function checkQuestPrerequisites(quest) {
    if (!quest.prerequisites || quest.prerequisites.length === 0) return true;
    return quest.prerequisites.every(prereqId => {
        const state = gameProgress.questStates[prereqId];
        return state && state.status === 'completed';
    });
}

function checkQuestConditions() {
    questsData.forEach(quest => {
        const state = gameProgress.questStates[quest.id];
        if (!state || state.status !== 'active') return;

        const stage = quest.stages[state.currentStage];
        if (!stage) return;

        const allConditionsMet = stage.conditions.every(cond => {
            switch (cond.type) {
                case 'hasItem':
                    return hasInventoryItem(cond.target, cond.count || 1);
                case 'talkedToNpc':
                    return gameProgress.npcsSpokenTo.includes(cond.target);
                case 'enemyDefeated':
                    return (gameProgress.enemiesDefeated[cond.target] || 0) >= (cond.count || 1);
                case 'locationVisited':
                    return gameProgress.locationsVisited.includes(cond.target);
                default:
                    return false;
            }
        });

        if (allConditionsMet) {
            completeQuestStage(quest, state.currentStage);
        }
    });
}

function completeQuestStage(quest, stageIndex) {
    const stage = quest.stages[stageIndex];
    const state = gameProgress.questStates[quest.id];

    // Apply rewards
    if (stage.onComplete) {
        (stage.onComplete.giveItems || []).forEach(idx => addToInventory(idx, 1));
        (stage.onComplete.removeItems || []).forEach(idx => removeFromInventory(idx, 1));
    }

    // Advance or complete
    if (stageIndex + 1 < quest.stages.length) {
        state.currentStage = stageIndex + 1;
        showQuestNotification('Quest Updated: ' + quest.name);
    } else {
        state.status = 'completed';
        showQuestNotification('Quest Complete: ' + quest.name);
    }
}

// Tracking hooks
function onNpcInteraction(placedNpcIndex) {
    if (!gameProgress.npcsSpokenTo.includes(placedNpcIndex)) {
        gameProgress.npcsSpokenTo.push(placedNpcIndex);
        checkQuestConditions();
    }
}

function onEnemyDefeated(placedNpcIndex) {
    gameProgress.enemiesDefeated[placedNpcIndex] =
        (gameProgress.enemiesDefeated[placedNpcIndex] || 0) + 1;
    checkQuestConditions();
}

function onMapEnter(mapName) {
    if (!gameProgress.locationsVisited.includes(mapName)) {
        gameProgress.locationsVisited.push(mapName);
        checkQuestConditions();
    }
}

function showQuestNotification(message) {
    const notif = document.createElement('div');
    notif.className = 'quest-notification';
    notif.textContent = message;
    notif.style.cssText = `
        position: fixed; top: 100px; left: 50%;
        transform: translateX(-50%);
        background: rgba(168, 0, 255, 0.9);
        color: white; padding: 15px 30px;
        border-radius: 8px; font-family: monospace;
        font-size: 16px; z-index: 9999;
        animation: questNotifFade 3s forwards;
    `;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}
```

### Phase 7: Save/Load
**Location: ~line 12850 (getProjectData), ~line 13000-13200 (loadProject)**

```javascript
// In getProjectData():
quests: quests,

// In loadProject():
quests = data.quests || [];
```

### Phase 8: Multiplayer Sync
**Location: ~line 13400-13500 (handleBuilderMessage)**

```javascript
case 'addQuest':
    quests.push(data.quest);
    renderQuestList();
    break;

case 'updateQuest':
    if (quests[data.index]) {
        quests[data.index][data.field] = data.value;
        if (data.index === selectedQuestIndex) loadQuestIntoEditor(selectedQuestIndex);
        renderQuestList();
    }
    break;

case 'updateQuestStageConditions':
    if (quests[data.questIndex]?.stages[data.stageIndex]) {
        quests[data.questIndex].stages[data.stageIndex].conditions = data.conditions;
        if (data.questIndex === selectedQuestIndex) renderQuestConditions();
    }
    break;

case 'deleteQuest':
    quests.splice(data.index, 1);
    if (selectedQuestIndex === data.index) {
        selectedQuestIndex = -1;
        document.getElementById('questEditorPanel').style.display = 'none';
    }
    renderQuestList();
    break;
```

---

## Implementation Order

1. **Inventory system** - Required for "has item" conditions
2. **Quest tab HTML/CSS** - UI with SET CONDITION button
3. **setMode() updates** - Tab switching
4. **Quest editor functions** - CRUD + click-on-map condition setting
5. **Map click handler integration** - Hook condition setting into map clicks
6. **Map rendering highlights** - Show valid targets when setting conditions
7. **Dialog tab enhancement** - ATTACH TO NPC button (same pattern)
8. **Runtime variables** - gameProgress tracking
9. **Quest evaluation logic** - Check conditions, complete stages
10. **Tracking hooks** - NPC talks, enemy kills, map visits
11. **Save/load** - Persist quest definitions
12. **Multiplayer sync** - Broadcast quest edits

---

## Key Line Number References

| Component | Approx Lines |
|-----------|-------------|
| Global vars (editor) | ~3200-3300 |
| CSS styling | ~334-341, ~729-737 |
| Tab buttons sidebar | ~1401-1412 |
| Tab buttons toolbar | ~2074-2085 |
| Tab content area | ~2038-2066 |
| setMode() function | ~4893-4966 |
| Map click handler | ~6800-7000 |
| Dialog editor | ~12500 |
| Save getProjectData() | ~12850 |
| Load loadProject() | ~13000-13200 |
| Multiplayer handleBuilderMessage() | ~13400-13500 |
| Test game runtime vars | ~17000-17100 |
| Test game initGame() | ~17443 |
| Item pickup startReceivingItem() | ~19924 |

---

## Future Expansion Points

1. **Multi-stage quests** - stages[] array already supports it
2. **Branching/choices** - Add choices[] to stages
3. **Quest log UI** - In-game panel showing active/completed
4. **Quest markers on map** - Show objective locations
5. **Timed quests** - Add timeLimit field
6. **Repeatable quests** - Use isRepeatable flag with cooldown
