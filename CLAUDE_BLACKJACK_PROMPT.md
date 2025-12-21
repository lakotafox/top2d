# Claude 4 Prompt: Create Blackjack Table for 3D Tavern

## Project Overview

This is a 2D Zelda-like game with a **3D tavern** interior. Players can enter the tavern from the 2D overworld and experience a first-person 3D environment built with THREE.js. The tavern has interactive elements including a Farkle dice game table.

**Live site:** The game is deployed on Netlify (synced to GitHub main branch)
**Multiplayer server:** PartyKit at `wss://multiplayer.lakotafox.partykit.dev/party/{roomCode}`

## Key Files

| File | Purpose |
|------|---------|
| `/tavern/test-3d-tavern.html` | Main 3D tavern file (THREE.js, ~8000 lines) |
| `/multiplayer/src/server.ts` | PartyKit WebSocket server |
| `/multiplayer/SERVER_GUIDE.md` | Server documentation |

## How the 3D Tavern Works

- **Renderer:** THREE.js with WebGLRenderer
- **Camera:** First-person (and optional third-person toggle with T key)
- **Controls:** WASD movement, mouse look (pointer lock)
- **Physics:** Cannon.js for dice physics
- **Lighting:** Ambient + point lights, torches with flicker effect

## Existing Farkle Table Implementation

The Farkle table is a good reference for creating the blackjack table:

### Table Creation (~line 4400-4500)
```javascript
function createFarkleTable(x, z, rotation = 0) {
    const group = new THREE.Group();
    // Creates wooden table mesh with felt surface
    // Stores feltSurfaceY for dice positioning
    // Returns { mesh: group, position, rotation }
}
```

### Key Farkle Variables
- `farkleTables` - Array of all Farkle tables in the tavern
- `activeFarkleTable` - Currently active table
- `farkleGameActive` - Boolean for game state
- `farkleDice` - Array of 6 dice objects with physics bodies

### Interaction System
- Tables have a proximity check (distance < 3 units)
- Press E to interact when "Press E to play Farkle" prompt appears
- Game locks pointer and shows game UI

### Multiplayer Structure
```javascript
let farkleMultiplayer = {
    active: false,
    players: [],        // { id, name, score }
    currentTurnIndex: 0,
    isMyTurn: false,
    hostId: null,
    gameId: null
};
```

### Message Types (sent via WebSocket)
- `farkle_lobby_join` - Player joins table lobby
- `farkle_lobby_sync` - Sync player list
- `farkle_game_begin` - Table leader starts game
- `farkle_roll` - Dice roll with values
- `farkle_keep` - Dice kept/selected
- `farkle_bank` - Player banks points
- `farkle_next_turn` - Turn advancement

## Your Task: Create Blackjack Table

### Requirements

1. **Create a blackjack table mesh** similar to Farkle table but shaped for cards
   - Semicircular or rectangular felt surface
   - Betting positions for up to 4 players
   - Dealer position

2. **Card system**
   - Create card meshes (can be simple planes with textures or colored rectangles)
   - Standard 52-card deck
   - Cards can be face-up or face-down

3. **Game logic**
   - Standard blackjack rules (hit, stand, double, split optional)
   - Dealer hits on 16, stands on 17
   - Each player has their own hand vs dealer
   - Betting system with chips (start each player with 100 chips)

4. **Multiplayer support**
   - Use same WebSocket connection as Farkle
   - Message types: `blackjack_join`, `blackjack_bet`, `blackjack_hit`, `blackjack_stand`, `blackjack_deal`, etc.
   - All players play against the dealer simultaneously
   - Table leader controls when to deal

5. **UI Elements**
   - Show player's cards and dealer's cards (one face down)
   - Hit/Stand/Double buttons
   - Chip count display
   - Current bet display

### Code Structure Suggestion

```javascript
// Blackjack state
let blackjackTables = [];
let activeBlackjackTable = null;
let blackjackGameActive = false;
let blackjackMultiplayer = {
    active: false,
    players: [],
    tableLeaderId: null,
    dealerHand: [],
    phase: 'betting' // 'betting', 'playing', 'dealer', 'payout'
};

// Create table
function createBlackjackTable(x, z, rotation = 0) { ... }

// Card creation
function createCard(suit, value) { ... }
function createDeck() { ... }
function shuffleDeck(deck) { ... }

// Game actions
function dealBlackjack() { ... }
function hitBlackjack() { ... }
function standBlackjack() { ... }
function calculateHandValue(cards) { ... }

// Multiplayer handlers
function handleBlackjackJoin(data) { ... }
function handleBlackjackDeal(data) { ... }
function handleBlackjackHit(data) { ... }
function handleBlackjackStand(data) { ... }
```

### Placement

Add the blackjack table near the Farkle table but on a different side of the tavern. The tavern interior is roughly centered around (0, 0) with tables scattered around.

### Tips

1. Look at how Farkle handles the lobby system - reuse that pattern
2. The `sendFarkleMessage` function can be renamed/copied to `sendBlackjackMessage`
3. Add cases in `handleMultiplayerMessage` switch for blackjack message types
4. Use `showFarkleMessage()` as reference for showing game messages (rename for blackjack)
5. The server already forwards all unknown message types, so no server changes needed

### Testing

1. Start local server: `cd /path/to/zelda-game && python3 -m http.server 8000`
2. Open two browser tabs to `http://localhost:8000/tavern/test-3d-tavern.html`
3. Both players walk to blackjack table and press E
4. Test betting, dealing, hitting, standing
5. Check browser console for `[BLACKJACK]` debug logs

Good luck! Reference the existing Farkle code heavily - it's the best template for how multiplayer table games work in this tavern.
