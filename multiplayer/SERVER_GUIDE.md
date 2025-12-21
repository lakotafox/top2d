# PartyKit Server Guide for Claude 1

## Server Location
`/multiplayer/src/server.ts`

**Deployed at:** `wss://multiplayer.lakotafox.partykit.dev/party/{roomCode}`

## Current Message Types (DO NOT BREAK)

The server handles these message types - they are critical for 2D game + tavern:

| Type | Purpose | Used By |
|------|---------|---------|
| `join` | Player joins room | 2D game, tavern |
| `update` | Position/state updates | 2D game, tavern |
| `leave` | Player disconnects | Auto on close |
| `sync` | Request all players | Both |
| `welcome` | Sent on connect | Server -> client |

## PlayerState Fields (DO NOT REMOVE)

```typescript
interface PlayerState {
  id: string;           // Connection ID
  name: string;         // Player name
  x: number;            // Position X
  y: number;            // Position Y
  direction: string;    // up/down/left/right
  currentMap: string;   // Map name
  animation: string;    // idle/walk
  gameType: 'game2d' | 'tavern3d';  // Which world
  inTavern?: boolean;   // NEW - hides player in 2D when in tavern
}
```

## Adding Farkle Support

To add Farkle messages, add a NEW case in the switch statement. **DO NOT modify existing cases.**

### Option 1: Add Farkle Case (Recommended)

```typescript
case 'farkle': {
  // Just broadcast to all other players in room
  this.room.broadcast(JSON.stringify({
    type: 'farkle',
    senderId: sender.id,
    farkleType: data.farkleType,  // 'start', 'join', 'roll', 'keep', 'bank', etc.
    payload: data.payload
  }), [sender.id]);
  break;
}
```

### Option 2: Generic Broadcast (More Flexible)

Add a catch-all for unknown types:

```typescript
default: {
  // Forward unknown message types as-is
  this.room.broadcast(JSON.stringify({
    ...data,
    senderId: sender.id
  }), [sender.id]);
  break;
}
```

## Deploy Command

After changes, deploy with:
```bash
cd /Users/khabefox/zelda-game/multiplayer
npx partykit deploy
```

## Builder Server (SEPARATE)

There's also a builder server at `/multiplayer/src/builder.ts` for co-op building.
**URL:** `wss://multiplayer.lakotafox.partykit.dev/parties/builder/{roomCode}`

Don't confuse them!

## Testing

1. Make changes to `server.ts`
2. Run `npx partykit deploy`
3. Test in browser - both tabs should see messages
4. Check browser console for `[WS]` or `[FARKLE]` logs
