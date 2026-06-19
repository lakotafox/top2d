# Map Hub Implementation Plan

## Goal
Add a "Hub" button to the builder main menu where users can **share** and **download** maps (.json save files).

---

## Current Infrastructure

| Component | Technology | Notes |
|-----------|------------|-------|
| Server | PartyKit (Cloudflare edge) | `multiplayer.lakotafox.partykit.dev` |
| Game Server | `server.ts` | Player positions, Farkle |
| Builder Server | `builder.ts` | Co-op editing sync |
| Save Format | JSON | Stored in IndexedDB locally |

**PartyKit Capabilities:**
- WebSocket rooms (real-time)
- HTTP endpoints (can handle REST)
- Durable Objects (persistent storage per room)
- Room listing API

---

## Realistic Options

### Option A: PartyKit Room Storage (Recommended)
**Complexity: Medium | No external services needed**

Use PartyKit's Durable Objects to store maps as "rooms". Each uploaded map becomes a persistent room.

**Pros:**
- Uses existing infrastructure
- No external DB needed
- Built-in persistence
- Can list rooms via API

**Cons:**
- Limited search/filtering
- PartyKit room limits (check your plan)

---

### Option B: Cloudflare R2 + D1
**Complexity: High | Best for scale**

Use Cloudflare R2 (S3-like storage) for map files and D1 (SQLite) for metadata/search.

**Pros:**
- Proper database queries
- Unlimited storage
- Search, tags, pagination

**Cons:**
- More setup
- Additional Cloudflare services
- More code to write

---

### Option C: GitHub Gist Integration
**Complexity: Low | Quick hack**

Upload maps as GitHub Gists. Browse recent gists.

**Pros:**
- Very simple
- No backend changes
- Free hosting

**Cons:**
- Requires GitHub account (or your account for all)
- Limited discovery
- Not a real "hub" experience

---

## Recommended: Option A (PartyKit Room Storage)

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    world-builder.html                    │
├─────────────────────────────────────────────────────────┤
│  Main Menu                                               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ NEW     │ │ LOAD    │ │  HUB    │ │ ABOUT   │       │
│  │ GAME    │ │ SAVE    │ │  ←NEW   │ │         │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                      Hub Screen                          │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐   │
│  │  🔍 Search...                    [Upload Map]    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ 🗺️ Tavern   │ │ 🏰 Castle   │ │ 🌲 Forest   │       │
│  │ by Fox      │ │ by Builder1 │ │ by Anon     │       │
│  │ ⬇️ 42       │ │ ⬇️ 128      │ │ ⬇️ 17       │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ 🏠 Village  │ │ ⚔️ Dungeon  │ │ 🌊 Beach    │       │
│  │ ...        │ │ ...        │ │ ...        │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                          │
│  [< Prev]                              [Next >]         │
│                           [Back to Menu]                 │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                PartyKit Hub Server                       │
│                multiplayer/src/hub.ts                    │
├─────────────────────────────────────────────────────────┤
│  HTTP Endpoints:                                         │
│  - GET  /parties/hub/list     → List all maps           │
│  - GET  /parties/hub/map/:id  → Download map JSON       │
│  - POST /parties/hub/upload   → Upload new map          │
│                                                          │
│  Storage (Durable Objects):                              │
│  - this.room.storage.put('maps', [...])                 │
│  - this.room.storage.put('map:abc123', {...})           │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Hub Server (`multiplayer/src/hub.ts`)

```typescript
import type * as Party from "partykit/server";

interface MapMeta {
  id: string;
  name: string;
  author: string;
  description: string;
  downloads: number;
  uploadedAt: number;
  size: number;  // bytes
  preview?: string; // base64 thumbnail (optional)
}

export default class HubServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  // Handle HTTP requests (REST API)
  async onRequest(req: Party.Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // GET /parties/hub/main - List all maps
    if (req.method === "GET" && path.endsWith("/main")) {
      const mapIndex = await this.room.storage.get<MapMeta[]>("mapIndex") || [];
      // Sort by downloads or uploadedAt
      const sorted = mapIndex.sort((a, b) => b.downloads - a.downloads);
      return new Response(JSON.stringify({ maps: sorted }), { headers });
    }

    // GET /parties/hub/main/map/:id - Get specific map
    if (req.method === "GET" && path.includes("/map/")) {
      const id = path.split("/map/")[1];
      const mapData = await this.room.storage.get(`map:${id}`);
      if (!mapData) {
        return new Response(JSON.stringify({ error: "Map not found" }), {
          status: 404, headers
        });
      }

      // Increment download count
      const mapIndex = await this.room.storage.get<MapMeta[]>("mapIndex") || [];
      const meta = mapIndex.find(m => m.id === id);
      if (meta) {
        meta.downloads++;
        await this.room.storage.put("mapIndex", mapIndex);
      }

      return new Response(JSON.stringify(mapData), { headers });
    }

    // POST /parties/hub/main/upload - Upload new map
    if (req.method === "POST" && path.endsWith("/upload")) {
      try {
        const body = await req.json() as {
          name: string;
          author: string;
          description: string;
          mapData: any;
        };

        const id = crypto.randomUUID().slice(0, 8);
        const meta: MapMeta = {
          id,
          name: body.name || "Untitled",
          author: body.author || "Anonymous",
          description: body.description || "",
          downloads: 0,
          uploadedAt: Date.now(),
          size: JSON.stringify(body.mapData).length
        };

        // Store the map data
        await this.room.storage.put(`map:${id}`, body.mapData);

        // Update index
        const mapIndex = await this.room.storage.get<MapMeta[]>("mapIndex") || [];
        mapIndex.push(meta);
        await this.room.storage.put("mapIndex", mapIndex);

        console.log(`[HUB] Map uploaded: ${meta.name} by ${meta.author} (${id})`);

        return new Response(JSON.stringify({ success: true, id }), { headers });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Upload failed" }), {
          status: 400, headers
        });
      }
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404, headers
    });
  }

  // WebSocket not needed for hub, but required by interface
  onConnect(conn: Party.Connection) {
    conn.close();
  }
}

HubServer satisfies Party.Worker;
```

---

### Step 2: Update PartyKit Config

In `multiplayer/partykit.json` (create if needed):

```json
{
  "name": "multiplayer",
  "main": "src/server.ts",
  "parties": {
    "builder": "src/builder.ts",
    "hub": "src/hub.ts"
  }
}
```

---

### Step 3: Add Hub UI to Builder Main Menu

**Location**: `world-builder.html` main menu section

Add new button:
```html
<button class="retro-btn" onclick="playButtonSound(); showHub();">
    > MAP HUB
</button>
```

Add hub screen HTML:
```html
<div id="hubScreen" class="menu-section" style="display:none;">
    <h1>MAP HUB</h1>
    <p>- COMMUNITY MAPS -</p>

    <div id="hubLoading" style="display:none;">Loading...</div>

    <div id="hubMapGrid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; max-width:600px; margin:20px auto;">
        <!-- Maps loaded dynamically -->
    </div>

    <div style="margin-top:20px;">
        <button class="retro-btn" onclick="playButtonSound(); showUploadDialog();">
            > UPLOAD YOUR MAP
        </button>
    </div>
    <div style="margin-top:10px;">
        <button class="retro-btn" onclick="playButtonSound(); hideHub();" style="font-size:10px;">
            > BACK
        </button>
    </div>
</div>

<!-- Upload Dialog -->
<div id="uploadDialog" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#1a1a2e; padding:30px; border-radius:10px; border:2px solid #4af; z-index:1000;">
    <h2 style="color:#4af; margin-bottom:20px;">Upload Map</h2>
    <div style="margin-bottom:15px;">
        <label style="color:#aaa;">Map Name:</label><br>
        <input type="text" id="uploadMapName" style="width:100%; padding:8px; background:#222; border:1px solid #444; color:white; margin-top:5px;">
    </div>
    <div style="margin-bottom:15px;">
        <label style="color:#aaa;">Author:</label><br>
        <input type="text" id="uploadAuthor" style="width:100%; padding:8px; background:#222; border:1px solid #444; color:white; margin-top:5px;">
    </div>
    <div style="margin-bottom:15px;">
        <label style="color:#aaa;">Description:</label><br>
        <textarea id="uploadDescription" rows="3" style="width:100%; padding:8px; background:#222; border:1px solid #444; color:white; margin-top:5px;"></textarea>
    </div>
    <div style="display:flex; gap:10px;">
        <button onclick="uploadToHub()" style="flex:1; padding:10px; background:#4a4; border:none; color:white; cursor:pointer;">Upload</button>
        <button onclick="hideUploadDialog()" style="flex:1; padding:10px; background:#a44; border:none; color:white; cursor:pointer;">Cancel</button>
    </div>
</div>
```

---

### Step 4: Add Hub JavaScript Functions

```javascript
const HUB_URL = 'https://multiplayer.lakotafox.partykit.dev/parties/hub/main';

async function showHub() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('hubScreen').style.display = 'block';
    document.getElementById('hubLoading').style.display = 'block';
    document.getElementById('hubMapGrid').innerHTML = '';

    try {
        const response = await fetch(HUB_URL);
        const data = await response.json();
        renderHubMaps(data.maps || []);
    } catch (err) {
        console.error('Failed to load hub:', err);
        document.getElementById('hubMapGrid').innerHTML = '<p style="color:#f44;">Failed to load maps</p>';
    }

    document.getElementById('hubLoading').style.display = 'none';
}

function renderHubMaps(maps) {
    const grid = document.getElementById('hubMapGrid');

    if (maps.length === 0) {
        grid.innerHTML = '<p style="color:#888; grid-column:1/-1;">No maps yet. Be the first to upload!</p>';
        return;
    }

    grid.innerHTML = maps.map(map => `
        <div style="background:#2a2a3e; padding:15px; border-radius:8px; text-align:center; cursor:pointer;" onclick="downloadHubMap('${map.id}', '${map.name.replace(/'/g, "\\'")}')">
            <div style="font-size:24px; margin-bottom:8px;">🗺️</div>
            <div style="color:#fff; font-weight:bold; margin-bottom:4px;">${escapeHtml(map.name)}</div>
            <div style="color:#888; font-size:11px;">by ${escapeHtml(map.author)}</div>
            <div style="color:#4f8; font-size:10px; margin-top:8px;">⬇️ ${map.downloads}</div>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function downloadHubMap(id, name) {
    if (!confirm(`Download "${name}"?`)) return;

    try {
        const response = await fetch(`${HUB_URL}/map/${id}`);
        const mapData = await response.json();

        // Save to IndexedDB and load
        await saveProjectToDB(mapData);
        pendingSaveData = mapData;

        // Show mode select
        hideHub();
        document.getElementById('modeSelect').style.display = 'block';
    } catch (err) {
        alert('Failed to download map: ' + err.message);
    }
}

function hideHub() {
    document.getElementById('hubScreen').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'block';
}

function showUploadDialog() {
    document.getElementById('uploadDialog').style.display = 'block';
    document.getElementById('uploadMapName').value = '';
    document.getElementById('uploadAuthor').value = '';
    document.getElementById('uploadDescription').value = '';
}

function hideUploadDialog() {
    document.getElementById('uploadDialog').style.display = 'none';
}

async function uploadToHub() {
    const name = document.getElementById('uploadMapName').value.trim();
    const author = document.getElementById('uploadAuthor').value.trim();
    const description = document.getElementById('uploadDescription').value.trim();

    if (!name) {
        alert('Please enter a map name');
        return;
    }

    // Get current project data
    const mapData = getProjectData();

    try {
        const response = await fetch(`${HUB_URL}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                author: author || 'Anonymous',
                description,
                mapData
            })
        });

        const result = await response.json();

        if (result.success) {
            alert('Map uploaded successfully!');
            hideUploadDialog();
            showHub(); // Refresh list
        } else {
            alert('Upload failed: ' + (result.error || 'Unknown error'));
        }
    } catch (err) {
        alert('Upload failed: ' + err.message);
    }
}
```

---

## Deployment Steps

1. **Create `hub.ts`** in `multiplayer/src/`
2. **Update/create `partykit.json`** with hub party
3. **Deploy**: `cd multiplayer && npx partykit deploy`
4. **Add UI** to world-builder.html
5. **Test** upload and download

---

## Future Enhancements

- [ ] Map thumbnails (auto-generate from first map layer)
- [ ] Search/filter by name or author
- [ ] Categories/tags
- [ ] Rating system
- [ ] Delete your own maps (requires auth)
- [ ] Report inappropriate content
- [ ] Pagination for large lists
- [ ] Map previews before download

---

## Size Limits

PartyKit Durable Object storage has limits. Consider:
- Max map size check before upload (~5MB reasonable limit)
- Total storage limits per account
- Cleanup old/unused maps periodically

```javascript
// In uploadToHub()
const mapJSON = JSON.stringify(mapData);
if (mapJSON.length > 5 * 1024 * 1024) {
    alert('Map too large (max 5MB)');
    return;
}
```

---

## Security Considerations

1. **No auth** - Anyone can upload. Consider rate limiting.
2. **XSS** - Always escape user-provided names/descriptions
3. **Spam** - May need moderation tools later
4. **Malicious JSON** - Validate structure server-side

For MVP, these are acceptable tradeoffs. Add auth/moderation if abuse occurs.
