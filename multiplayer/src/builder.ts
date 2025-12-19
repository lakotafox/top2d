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

        case 'update': {
          // Builder edit - broadcast to all other clients
          this.room.broadcast(JSON.stringify({
            type: 'builderEdit',
            senderId: sender.id,
            editType: data.editType,
            layer: data.layer,
            x: data.x,
            y: data.y,
            cell: data.cell,
            mapName: data.mapName,
            sound: data.sound,
            light: data.light,
            prop: data.prop,
            npc: data.npc,
            trigger: data.trigger,
            triggerId: data.triggerId,
            collision: data.collision
          }), [sender.id]);

          console.log(`Builder edit: ${data.editType} from ${sender.id}`);
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
