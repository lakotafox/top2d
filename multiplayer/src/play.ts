import type * as Party from "partykit/server";

// PLAY party — "join the live world by URL".
// Responsibilities (v1, small scale):
//   1. Store the host-uploaded LIGHTWEIGHT world (audio stripped, ~MBs) — persisted so it
//      survives the host disconnecting / the Durable Object being evicted.
//   2. Send the world snapshot to each phone on join (no file load on the device).
//   3. Relay player positions (join/update/leave) — same model as the existing game party.
// Deferred to a later stage: server-authoritative movement/collision, viewport streaming.

interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: string;
  currentMap: string;
  animation: string;
}

const MAX_PLAYERS = 8;
const STORAGE_CHUNK = 120 * 1024; // < Durable Object 128 KiB per-value limit

export default class PlayServer implements Party.Server {
  players: Map<string, PlayerState> = new Map();
  world: any = null;             // parsed lightweight world, kept in memory for fast snapshots
  private uploadChunks: string[] = [];

  constructor(readonly room: Party.Room) {}

  // Rehydrate a persisted world on cold start so reconnecting viewers still get a snapshot
  // even after the host has closed their laptop.
  async onStart() {
    try {
      const meta = await this.room.storage.get<{ chunks: number }>("world:meta");
      if (meta && meta.chunks > 0) {
        let s = "";
        for (let i = 0; i < meta.chunks; i++) {
          const c = await this.room.storage.get<string>(`world:chunk:${i}`);
          if (c == null) { s = ""; break; }
          s += c;
        }
        if (s) {
          this.world = JSON.parse(s);
          console.log(`[play] rehydrated world (${(s.length / 1048576).toFixed(2)}MB)`);
        }
      }
    } catch (e) {
      console.error("[play] onStart rehydrate failed", e);
    }
  }

  onConnect(conn: Party.Connection) {
    if (this.players.size >= MAX_PLAYERS) {
      conn.send(JSON.stringify({ type: "error", message: "Room is full (max 8 players)" }));
      conn.close();
      return;
    }
    conn.send(JSON.stringify({
      type: "welcome",
      playerId: conn.id,
      players: Array.from(this.players.values()),
      worldLoaded: !!this.world
    }));
  }

  private sendSnapshot(conn: Party.Connection) {
    if (this.world) {
      conn.send(JSON.stringify({
        type: "world-snapshot",
        world: this.world,
        players: Array.from(this.players.values())
      }));
    } else {
      conn.send(JSON.stringify({ type: "waiting", message: "Host hasn't gone live yet." }));
    }
  }

  async onMessage(message: string, sender: Party.Connection) {
    let data: any;
    try { data = JSON.parse(message); } catch { return; }

    switch (data.type) {
      case "join": {
        const player: PlayerState = {
          id: sender.id,
          name: data.name || `Player${sender.id.slice(0, 4)}`,
          x: data.x || 0,
          y: data.y || 0,
          direction: data.direction || "down",
          currentMap: data.currentMap || "main",
          animation: data.animation || "idle"
        };
        this.players.set(sender.id, player);
        this.room.broadcast(JSON.stringify({ type: "join", player }), [sender.id]);
        this.sendSnapshot(sender); // hand the joiner the world immediately
        break;
      }

      case "requestSnapshot": {
        this.sendSnapshot(sender);
        break;
      }

      case "update": {
        const ex = this.players.get(sender.id);
        if (ex) {
          const up: PlayerState = {
            ...ex,
            x: data.x ?? ex.x,
            y: data.y ?? ex.y,
            direction: data.direction ?? ex.direction,
            currentMap: data.currentMap ?? ex.currentMap,
            animation: data.animation ?? ex.animation
          };
          this.players.set(sender.id, up);
          this.room.broadcast(JSON.stringify({ type: "update", player: up }), [sender.id]);
        }
        break;
      }

      case "sync": {
        sender.send(JSON.stringify({ type: "sync", players: Array.from(this.players.values()) }));
        break;
      }

      // ---- Host world upload (chunked; reassembled then persisted) ----
      case "world-upload-begin": {
        this.uploadChunks = new Array(data.chunks).fill("");
        console.log(`[play] world upload begin: ${data.chunks} chunks`);
        break;
      }

      case "world-upload-chunk": {
        if (typeof data.i === "number" && data.i < this.uploadChunks.length) {
          this.uploadChunks[data.i] = data.data || "";
        }
        break;
      }

      case "world-upload-end": {
        const assembled = this.uploadChunks.join("");
        try {
          this.world = JSON.parse(assembled);
        } catch (e) {
          sender.send(JSON.stringify({ type: "error", message: "World JSON parse failed on server" }));
          return;
        }
        await this.persistWorld(assembled);
        this.uploadChunks = [];
        sender.send(JSON.stringify({ type: "world-ready" }));
        // Push the new world to everyone already connected/waiting.
        for (const c of this.room.getConnections()) this.sendSnapshot(c);
        console.log(`[play] world ready (${(assembled.length / 1048576).toFixed(2)}MB)`);
        break;
      }
    }
  }

  private async persistWorld(s: string) {
    const chunks = Math.ceil(s.length / STORAGE_CHUNK);
    await this.room.storage.deleteAll(); // this party stores only world:* keys
    const puts: Promise<void>[] = [];
    for (let i = 0; i < chunks; i++) {
      puts.push(this.room.storage.put(`world:chunk:${i}`, s.slice(i * STORAGE_CHUNK, (i + 1) * STORAGE_CHUNK)));
    }
    await Promise.all(puts);
    await this.room.storage.put("world:meta", { chunks });
  }

  onClose(conn: Party.Connection) {
    if (this.players.delete(conn.id)) {
      this.room.broadcast(JSON.stringify({ type: "leave", playerId: conn.id }));
    }
  }
}

PlayServer satisfies Party.Worker;
