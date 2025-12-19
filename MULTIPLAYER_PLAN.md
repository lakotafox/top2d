# Multiplayer Implementation Plan

## Project Overview
Zelda-style game builder with:
- **2D canvas game** (world-builder.html) - pixel art, top-down view
- **3D tavern** (tavern/test-3d-tavern.html) - Three.js, first-person

Both share the **same PartyKit room** but each only renders players in their own world (`gameType` filter).

---

## PartyKit Server (DEPLOYED)

**URL:** `wss://multiplayer.lakotafox.partykit.dev/party/ROOM_CODE`

**Server code:** `/multiplayer/src/server.ts`

### Message Protocol

```javascript
// Connect to room
const ws = new WebSocket(`wss://multiplayer.lakotafox.partykit.dev/party/${roomCode}`);

// Join (send after connection opens)
ws.send(JSON.stringify({
  type: 'join',
  name: 'PlayerName',
  x: 100, y: 200,
  direction: 'down',
  animation: 'idle',
  gameType: 'game2d'  // or 'tavern3d'
}));

// Send position updates
ws.send(JSON.stringify({
  type: 'update',
  x: 150, y: 250,
  direction: 'right',
  animation: 'walk'
}));

// Incoming messages:
ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  // data.type can be:
  // 'welcome' - { players: [...], message: '...' }
  // 'join' - { player: {...} }
  // 'update' - { player: {...} }
  // 'leave' - { playerId: '...' }
  // 'error' - { message: '...' }
};
```

### Player State Shape
```typescript
interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  currentMap: string;
  animation: string;
  gameType: 'game2d' | 'tavern3d';
}
```

### Key Rule
**Only render players where `gameType` matches your world:**
- 2D game: `if (player.gameType === 'game2d') { ... }`
- 3D tavern: `if (player.gameType === 'tavern3d') { ... }`

---

## Claude 2's Task: 2D Game Multiplayer

**File:** `/world-builder.html`

### What to Add

1. **Multiplayer UI** (after ADVENTURE mode selected)
   - Name input + room code input
   - Add to `startAdventure()` flow

2. **WebSocket connection** in test game
   - Connect when game initializes
   - Send `join` with `gameType: 'game2d'`

3. **Track other players**
   ```javascript
   const otherPlayers = new Map(); // id -> {x, y, direction, animation, name}
   ```

4. **Send position updates** in `update()` function
   - Throttle to ~10 updates/second
   - Send when position or direction changes

5. **Draw other players** in `drawYSortedEntities()`
   - Use same player sprite
   - Draw nametag above each

6. **Handle messages**
   - `welcome`: spawn existing players
   - `join`: add new player
   - `update`: move existing player
   - `leave`: remove player

### Key Locations in world-builder.html
| What | Line | Description |
|------|------|-------------|
| `startAdventure()` | ~8451 | Add multiplayer prompt here |
| `initGame()` | ~10286 | Initialize WebSocket connection |
| `player` object | ~10522 | Player state (x, y, direction, etc) |
| `update()` | ~11797 | Movement logic - send updates here |
| `drawYSortedEntities()` | ~12708 | Add other players to entities array |
| `drawPlayer()` | ~13200 | Reference for drawing player sprite |
| `gameLoop()` | ~13390 | Main loop |

---

## Claude 1's Task: 3D Tavern Multiplayer

**File:** `/tavern/test-3d-tavern.html`

### Critical Understanding: First Person vs Other Players

The tavern has a first-person camera system:
- **Local player sees:** floating arms (`fp_arms_low_poly.glb`) attached to camera
- **Local player toggle:** can switch to third person to see their own body
- **Other players:** ALWAYS rendered as full `Hooded Adventurer.glb` models

```
YOU (local) see:     Your arms (first person) OR your body (third person toggle)
OTHERS see you as:   Full Hooded Adventurer 3D model
YOU see others as:   Full Hooded Adventurer 3D model
```

### What to Add

1. **Multiplayer UI** (before entering tavern)
   ```html
   <div id="multiplayerPrompt">
     <input id="playerNameInput" placeholder="Your Name">
     <input id="roomCodeInput" placeholder="Room Code">
     <button onclick="joinTavern()">JOIN</button>
   </div>
   ```

2. **WebSocket connection**
   ```javascript
   let ws;
   const otherPlayers = new Map(); // id -> {model, mixer, animations, nameTag}

   function connectMultiplayer(name, roomCode) {
     ws = new WebSocket(`wss://multiplayer.lakotafox.partykit.dev/party/${roomCode}`);
     ws.onopen = () => {
       ws.send(JSON.stringify({
         type: 'join',
         name: name,
         x: camera.position.x,
         y: camera.position.z,  // 3D z = message y
         direction: 'down',
         animation: 'idle',
         gameType: 'tavern3d'
       }));
     };
     ws.onmessage = handleServerMessage;
   }
   ```

3. **Spawn other players** (load Hooded Adventurer.glb)
   ```javascript
   function spawnOtherPlayer(playerData) {
     const loader = new GLTFLoader();
     loader.load('../Hooded Adventurer.glb', (gltf) => {
       const model = gltf.scene;
       model.scale.setScalar(1.0);
       model.position.set(playerData.x, 0, playerData.y);
       model.visible = true;
       scene.add(model);

       const mixer = new THREE.AnimationMixer(model);
       const animations = {};
       gltf.animations.forEach(clip => {
         animations[clip.name] = mixer.clipAction(clip);
       });

       const nameTag = createNameTag(playerData.name);
       otherPlayers.set(playerData.id, { model, mixer, animations, nameTag });
     });
   }
   ```

4. **Update other players**
   ```javascript
   function updateOtherPlayer(playerData) {
     const other = otherPlayers.get(playerData.id);
     if (!other) return;

     other.model.position.set(playerData.x, 0, playerData.y);

     // Rotation based on direction
     const rotations = {
       'down': 0,
       'left': Math.PI / 2,
       'up': Math.PI,
       'right': -Math.PI / 2
     };
     other.model.rotation.y = rotations[playerData.direction] || 0;
   }
   ```

5. **Remove players on disconnect**
   ```javascript
   function removeOtherPlayer(playerId) {
     const other = otherPlayers.get(playerId);
     if (other) {
       scene.remove(other.model);
       if (other.nameTag) other.nameTag.remove();
       otherPlayers.delete(playerId);
     }
   }
   ```

6. **Send position updates** (in animation loop)
   ```javascript
   let lastSendTime = 0;
   function sendPositionUpdate() {
     const now = Date.now();
     if (now - lastSendTime < 100) return; // Throttle to 10/sec
     lastSendTime = now;

     if (ws && ws.readyState === WebSocket.OPEN) {
       ws.send(JSON.stringify({
         type: 'update',
         x: camera.position.x,
         y: camera.position.z,
         direction: currentDirection,
         animation: isMoving ? 'walk' : 'idle'
       }));
     }
   }
   ```

7. **Update mixers in render loop**
   ```javascript
   // In animate() function
   const delta = clock.getDelta();
   otherPlayers.forEach(other => {
     other.mixer.update(delta);
   });
   ```

8. **Nametag (HTML overlay)**
   ```javascript
   function createNameTag(name) {
     const div = document.createElement('div');
     div.className = 'nametag';
     div.textContent = name;
     div.style.cssText = 'position:absolute;color:white;font-family:monospace;text-shadow:1px 1px 2px black;pointer-events:none;';
     document.body.appendChild(div);
     return div;
   }

   function updateNameTagPosition(other) {
     const pos = other.model.position.clone();
     pos.y += 2; // Above head
     pos.project(camera);
     const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
     const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;
     other.nameTag.style.left = x + 'px';
     other.nameTag.style.top = y + 'px';
   }
   ```

### Key Locations in test-3d-tavern.html
| What | Line | Description |
|------|------|-------------|
| First person arms | ~1105 | `fp_arms_low_poly.glb` loaded here |
| Third person model | ~1143 | `Hooded Adventurer.glb` loaded for local player toggle |
| Player position | ~863 | `playerPos` variable |
| Animation loop | varies | `animate()` function |

### File Paths
| File | Purpose |
|------|---------|
| `tavern/test-3d-tavern.html` | Main tavern file to modify |
| `view-model.html` | Reference for loading Hooded Adventurer with animations |
| `Hooded Adventurer.glb` | 3D model for other players |
| `tavern/tavern_assets3d/fp_arms_low_poly.glb` | First person arms (local only) |

---

## Summary

| Task | Owner | gameType | File |
|------|-------|----------|------|
| 2D multiplayer | Claude 2 | `game2d` | world-builder.html |
| 3D tavern multiplayer | Claude 1 | `tavern3d` | tavern/test-3d-tavern.html |

Both connect to the same PartyKit server. Each filters players by `gameType`.

**Max 4 players per room (total across both worlds).**
