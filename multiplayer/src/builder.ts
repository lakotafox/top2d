import type * as Party from "partykit/server";

interface BuilderPlayer {
  id: string;
  name: string;
}

const MAX_BUILDERS = 4;

export default class BuilderServer implements Party.Server {
  players: Map<string, BuilderPlayer> = new Map();

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`Builder connecting: ${conn.id} to room: ${this.room.id}`);

    if (this.players.size >= MAX_BUILDERS) {
      conn.send(JSON.stringify({
        type: 'error',
        message: 'Room is full (max 4 builders)'
      }));
      conn.close();
      return;
    }

    conn.send(JSON.stringify({
      type: 'welcome',
      yourId: conn.id,
      players: Array.from(this.players.values()),
      message: `Welcome! You are builder ${this.players.size + 1}/${MAX_BUILDERS}`
    }));
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'join': {
          const player: BuilderPlayer = {
            id: sender.id,
            name: data.name || `Builder${sender.id.slice(0, 4)}`
          };
          this.players.set(sender.id, player);

          // Broadcast join to others
          this.room.broadcast(JSON.stringify({
            type: 'join',
            player
          }), [sender.id]);

          console.log(`Builder joined: ${player.name} (${this.players.size}/${MAX_BUILDERS})`);
          break;
        }

        case 'update':
        case 'builderEdit': {
          // Builder edit - passthrough all fields so future editTypes work
          // without server changes. Overwrite type/senderId for consistency.
          const payload = { ...data, type: 'builderEdit', senderId: sender.id };

          if (data.targetId && typeof data.targetId === 'string') {
            // Directed message (e.g. host auto-resync to a specific late joiner)
            const target = [...this.room.getConnections()].find(c => c.id === data.targetId);
            if (target) target.send(JSON.stringify(payload));
          } else {
            this.room.broadcast(JSON.stringify(payload), [sender.id]);
          }

          const sizeKb = (JSON.stringify(payload).length / 1024).toFixed(1);
          console.log(`Builder edit: ${data.editType}${data.edits ? ` (batch of ${data.edits.length})` : ''}${data.targetId ? ` -> ${data.targetId}` : ''} [${sizeKb}KB]`);
          break;
        }

        case 'sync': {
          sender.send(JSON.stringify({
            type: 'sync',
            players: Array.from(this.players.values())
          }));
          break;
        }
      }
    } catch (e) {
      console.error('Error parsing builder message:', e);
    }
  }

  onClose(conn: Party.Connection) {
    const player = this.players.get(conn.id);
    if (player) {
      this.players.delete(conn.id);

      this.room.broadcast(JSON.stringify({
        type: 'leave',
        playerId: conn.id
      }));

      console.log(`Builder left: ${player.name} (${this.players.size}/${MAX_BUILDERS})`);
    }
  }
}

BuilderServer satisfies Party.Worker;
