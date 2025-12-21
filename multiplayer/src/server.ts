import type * as Party from "partykit/server";

interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: string;
  currentMap: string;
  animation: string;
  gameType: 'game2d' | 'tavern3d';
  inTavern?: boolean;
}

interface ServerMessage {
  type: 'join' | 'update' | 'leave' | 'sync' | 'error' | 'welcome';
  player?: PlayerState;
  players?: PlayerState[];
  playerId?: string;
  message?: string;
}

const MAX_PLAYERS = 4;

export default class Server implements Party.Server {
  players: Map<string, PlayerState> = new Map();

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`Player connecting: ${conn.id} to room: ${this.room.id}`);

    // Check player limit
    if (this.players.size >= MAX_PLAYERS) {
      conn.send(JSON.stringify({
        type: 'error',
        message: 'Room is full (max 4 players)'
      } as ServerMessage));
      conn.close();
      return;
    }

    // Send welcome with current players AND the player's own ID
    conn.send(JSON.stringify({
      type: 'welcome',
      playerId: conn.id,
      players: Array.from(this.players.values()),
      message: `Welcome! You are player ${this.players.size + 1}/${MAX_PLAYERS}`
    } as ServerMessage));
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'join': {
          // Player joining with initial state
          const player: PlayerState = {
            id: sender.id,
            name: data.name || `Player${sender.id.slice(0, 4)}`,
            x: data.x || 0,
            y: data.y || 0,
            direction: data.direction || 'down',
            currentMap: data.currentMap || 'main',
            animation: data.animation || 'idle',
            gameType: data.gameType || 'game2d'
          };

          this.players.set(sender.id, player);

          // Broadcast join to all other players
          this.room.broadcast(JSON.stringify({
            type: 'join',
            player
          } as ServerMessage), [sender.id]);

          console.log(`Player joined: ${player.name} (${this.players.size}/${MAX_PLAYERS})`);
          break;
        }

        case 'update': {
          // Player position/state update
          const existing = this.players.get(sender.id);
          if (existing) {
            const updated: PlayerState = {
              ...existing,
              x: data.x ?? existing.x,
              y: data.y ?? existing.y,
              direction: data.direction ?? existing.direction,
              currentMap: data.currentMap ?? existing.currentMap,
              animation: data.animation ?? existing.animation,
              gameType: data.gameType ?? existing.gameType,
              inTavern: data.inTavern ?? existing.inTavern ?? false
            };
            this.players.set(sender.id, updated);

            // Broadcast to all other players
            this.room.broadcast(JSON.stringify({
              type: 'update',
              player: updated
            } as ServerMessage), [sender.id]);
          }
          break;
        }

        case 'sync': {
          // Request full sync of all players
          sender.send(JSON.stringify({
            type: 'sync',
            players: Array.from(this.players.values())
          } as ServerMessage));
          break;
        }

        default: {
          // Forward unknown message types (Farkle, etc.) to all other players
          const player = this.players.get(sender.id);
          this.room.broadcast(JSON.stringify({
            ...data,
            playerId: sender.id,
            playerName: player?.name || 'Unknown'
          }), [sender.id]);
          break;
        }
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  }

  onClose(conn: Party.Connection) {
    const player = this.players.get(conn.id);
    if (player) {
      this.players.delete(conn.id);

      // Broadcast leave to all remaining players
      this.room.broadcast(JSON.stringify({
        type: 'leave',
        playerId: conn.id
      } as ServerMessage));

      console.log(`Player left: ${player.name} (${this.players.size}/${MAX_PLAYERS})`);
    }
  }
}

Server satisfies Party.Worker;
