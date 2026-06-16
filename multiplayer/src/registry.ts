import type * as Party from "partykit/server";

// Registry: a single room ('main') that tracks which play rooms currently hold an uploaded world,
// so the host can list or wipe ALL of them at once. play rooms register/unregister themselves.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default class RegistryServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  private async getRooms(): Promise<string[]> {
    return (await this.room.storage.get<string[]>("rooms")) || [];
  }
  private async setRooms(rooms: string[]) {
    await this.room.storage.put("rooms", rooms);
  }

  async onRequest(req: Party.Request) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    let body: any = {};
    try { body = await req.json(); } catch (e) {}
    const json = (obj: any, status = 200) => Response.json(obj, { status, headers: CORS });

    switch (body.action) {
      case "register": {
        if (!body.room) return json({ ok: false }, 400);
        const rooms = await this.getRooms();
        if (!rooms.includes(body.room)) { rooms.push(body.room); await this.setRooms(rooms); }
        return json({ ok: true, count: rooms.length });
      }
      case "unregister": {
        const rooms = (await this.getRooms()).filter((r) => r !== body.room);
        await this.setRooms(rooms);
        return json({ ok: true, count: rooms.length });
      }
      case "list":
        return json({ rooms: await this.getRooms() });
      case "clearAll": {
        const rooms = await this.getRooms();
        let cleared = 0;
        for (const r of rooms) {
          try {
            await this.room.context.parties.play.get(r).fetch({
              method: "POST",
              body: JSON.stringify({ action: "clear" }),
            });
            cleared++;
          } catch (e) {}
        }
        await this.setRooms([]);
        return json({ ok: true, cleared, total: rooms.length });
      }
      default:
        return json({ ok: false, error: "unknown action" }, 400);
    }
  }
}

RegistryServer satisfies Party.Worker;
