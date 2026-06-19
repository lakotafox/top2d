import type * as Party from "partykit/server";

interface BuilderPlayer {
  id: string;
  name: string;
}

const MAX_BUILDERS = 4;
const LOG_MAX = 5000;                       // cap the in-memory edit log
const MAX_LOGGED_EDIT_BYTES = 256 * 1024;   // don't log huge asset edits (relay only)
const CATCHUP_CHUNK = 40;                    // edits per catch-up message

export default class BuilderServer implements Party.Server {
  players: Map<string, BuilderPlayer> = new Map();
  // Authoritative, sequence-numbered edit log so clients that miss live edits
  // (e.g. a backgrounded tab whose socket dropped) can catch up on reconnect.
  // In-memory: survives individual client tab-sleeps because the room (Durable
  // Object) stays alive while anyone is connected. Cleared only if the room is
  // fully evicted, at which point peers reload from a shared save anyway.
  editLog: Array<{ seq: number; payload: any }> = [];
  seq = 0;

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
      serverSeq: this.seq, // latest edit seq — client uses this to request catch-up
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

        case 'requestSince': {
          // A (re)connecting client asks for every edit it missed since `since`.
          // CRITICAL: never replay the requester's OWN edits back to it. The client
          // already applied those locally, and its seq cursor does not advance on its
          // own sends (the server excludes the sender from broadcasts), so without this
          // filter a tab-switch would re-apply the client's own edits and DUPLICATE
          // every placed NPC/trigger/item. Genuinely-missed peer edits still replay;
          // the cursor self-heals to serverSeq via the reply below.
          const since = typeof data.since === 'number' ? data.since : 0;
          const missed = this.editLog.filter(e => e.seq > since && (!e.payload || e.payload.senderId !== sender.id));
          console.log(`Catch-up: ${sender.id.slice(0, 4)} since ${since} -> ${missed.length} edits (serverSeq ${this.seq})`);
          for (let i = 0; i < missed.length; i += CATCHUP_CHUNK) {
            const slice = missed.slice(i, i + CATCHUP_CHUNK);
            sender.send(JSON.stringify({
              type: 'builderEdit',
              editType: 'sessionLogReplay',
              edits: slice.map(e => e.payload),
              serverSeq: this.seq
            }));
          }
          if (missed.length === 0) {
            // Nothing missed, but still hand back the cursor so the client can advance it.
            sender.send(JSON.stringify({ type: 'builderEdit', editType: 'sessionLogReplay', edits: [], serverSeq: this.seq }));
          }
          break;
        }

        case 'update':
        case 'builderEdit': {
          // Builder edit - passthrough all fields so future editTypes work
          // without server changes. Overwrite type/senderId for consistency.
          // Stamp a monotonic seq so clients can detect/replay gaps.
          const seq = ++this.seq;
          const payload = { ...data, type: 'builderEdit', senderId: sender.id, _seq: seq };

          // Log it for catch-up (skip oversized asset edits — those are shared
          // out-of-band via save files; logging them would bloat memory).
          const bytes = message.length;
          // Don't durably log the replay traffic itself, or catch-up would echo forever.
          if (data.editType !== 'sessionLogReplay' && data.editType !== 'fullProject' && bytes <= MAX_LOGGED_EDIT_BYTES) {
            this.editLog.push({ seq, payload });
            if (this.editLog.length > LOG_MAX) this.editLog = this.editLog.slice(-LOG_MAX);
          }

          if (data.targetId && typeof data.targetId === 'string') {
            // Directed message (e.g. host auto-resync to a specific late joiner)
            const target = [...this.room.getConnections()].find(c => c.id === data.targetId);
            if (target) target.send(JSON.stringify(payload));
          } else {
            this.room.broadcast(JSON.stringify(payload), [sender.id]);
          }

          const sizeKb = (JSON.stringify(payload).length / 1024).toFixed(1);
          console.log(`Builder edit #${seq}: ${data.editType}${data.edits ? ` (batch of ${data.edits.length})` : ''}${data.targetId ? ` -> ${data.targetId}` : ''} [${sizeKb}KB]`);
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
