# World Hub - Static Netlify Site

## Concept
Simple retro-styled website where users browse and download "worlds" (.json save files). No accounts, no complex backend.

**Domain idea:** `worlds.yourdomain.com` or `hub.yourdomain.com`

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    worlds.example.com                    │
│                   (Netlify Static Site)                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   ╔═══════════════════════════════════════════════════╗ │
│   ║            ★ WORLD HUB ★                          ║ │
│   ║         Community Worlds for Builder               ║ │
│   ╚═══════════════════════════════════════════════════╝ │
│                                                          │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│   │ Tavern  │ │ Castle  │ │ Forest  │ │ Village │      │
│   │ World   │ │ Quest   │ │ Maze    │ │ Life    │      │
│   │         │ │         │ │         │ │         │      │
│   │ by Fox  │ │ by Anon │ │ by Joe  │ │ by Sara │      │
│   │[DOWNLOAD]│ │[DOWNLOAD]│ │[DOWNLOAD]│ │[DOWNLOAD]│   │
│   └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
│                                                          │
│   ┌─────────────────────────────────────────────────┐   │
│   │  Want to share your world?                       │   │
│   │  [SUBMIT YOUR WORLD]                             │   │
│   └─────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## File Structure

```
world-hub/
├── index.html          # Main browse page (retro styled)
├── submit.html         # Upload/submit form
├── style.css           # Retro CSS (same vibe as builder)
├── worlds/
│   ├── index.json      # Manifest of all worlds
│   ├── tavern-adventure.json
│   ├── castle-quest.json
│   ├── forest-maze.json
│   └── ...
├── thumbnails/         # Optional preview images
│   ├── tavern-adventure.png
│   └── ...
└── netlify.toml        # Netlify config
```

---

## worlds/index.json (Manifest)

```json
{
  "worlds": [
    {
      "id": "tavern-adventure",
      "name": "Tavern Adventure",
      "author": "LakotaFox",
      "description": "Explore a cozy tavern with secrets",
      "file": "tavern-adventure.json",
      "thumbnail": "tavern-adventure.png",
      "downloads": 42,
      "added": "2025-01-15"
    },
    {
      "id": "castle-quest",
      "name": "Castle Quest",
      "author": "Anonymous",
      "description": "Storm the castle and defeat the boss",
      "file": "castle-quest.json",
      "added": "2025-01-10"
    }
  ]
}
```

---

## index.html

```html
<!DOCTYPE html>
<html>
<head>
    <title>World Hub</title>
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            background: #0a0a1a;
            color: #fff;
            font-family: 'Press Start 2P', monospace;
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1000px;
            margin: 0 auto;
        }

        header {
            text-align: center;
            padding: 40px 0;
            border-bottom: 4px solid #4af;
            margin-bottom: 40px;
        }

        h1 {
            font-size: 24px;
            color: #4af;
            text-shadow: 0 0 20px #4af;
            margin-bottom: 10px;
        }

        .subtitle {
            font-size: 10px;
            color: #888;
        }

        .world-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .world-card {
            background: linear-gradient(180deg, #1a1a2e 0%, #16162a 100%);
            border: 2px solid #333;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            transition: all 0.2s;
        }

        .world-card:hover {
            border-color: #4af;
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(68, 170, 255, 0.3);
        }

        .world-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }

        .world-name {
            font-size: 11px;
            color: #fff;
            margin-bottom: 8px;
        }

        .world-author {
            font-size: 8px;
            color: #888;
            margin-bottom: 12px;
        }

        .world-desc {
            font-size: 8px;
            color: #666;
            margin-bottom: 15px;
            line-height: 1.6;
        }

        .download-btn {
            background: #4a7c59;
            border: none;
            color: white;
            padding: 10px 20px;
            font-family: 'Press Start 2P', monospace;
            font-size: 8px;
            cursor: pointer;
            border-radius: 4px;
            transition: background 0.2s;
        }

        .download-btn:hover {
            background: #5a9c69;
        }

        .submit-section {
            background: #1a1a2e;
            border: 2px dashed #4af;
            border-radius: 8px;
            padding: 30px;
            text-align: center;
            margin-top: 40px;
        }

        .submit-section h2 {
            font-size: 12px;
            color: #4af;
            margin-bottom: 15px;
        }

        .submit-section p {
            font-size: 8px;
            color: #888;
            margin-bottom: 20px;
        }

        .submit-btn {
            background: #c84;
            border: none;
            color: white;
            padding: 12px 24px;
            font-family: 'Press Start 2P', monospace;
            font-size: 10px;
            cursor: pointer;
            border-radius: 4px;
        }

        .submit-btn:hover {
            background: #ea6;
        }

        footer {
            text-align: center;
            padding: 40px 0;
            font-size: 8px;
            color: #444;
        }

        footer a {
            color: #4af;
            text-decoration: none;
        }

        .loading {
            text-align: center;
            padding: 60px;
            color: #4af;
            font-size: 10px;
        }

        @keyframes blink {
            50% { opacity: 0.5; }
        }

        .loading::after {
            content: '...';
            animation: blink 1s infinite;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>★ WORLD HUB ★</h1>
            <p class="subtitle">Community Worlds for Builder</p>
        </header>

        <div id="worldGrid" class="world-grid">
            <div class="loading">Loading worlds</div>
        </div>

        <div class="submit-section">
            <h2>Share Your World</h2>
            <p>Created something cool? Submit it to the hub!</p>
            <a href="submit.html"><button class="submit-btn">> SUBMIT WORLD</button></a>
        </div>

        <footer>
            <p>Made for <a href="https://yourbuilder.com">World Builder</a></p>
            <p style="margin-top:10px;">Download a world, then load it in the builder!</p>
        </footer>
    </div>

    <script>
        const ICONS = ['🗺️', '🏰', '🌲', '🏠', '⚔️', '🌊', '🏔️', '🌙', '🔥', '💎'];

        async function loadWorlds() {
            try {
                const response = await fetch('worlds/index.json');
                const data = await response.json();
                renderWorlds(data.worlds);
            } catch (err) {
                document.getElementById('worldGrid').innerHTML =
                    '<p style="color:#f44; grid-column:1/-1; text-align:center;">Failed to load worlds</p>';
            }
        }

        function renderWorlds(worlds) {
            const grid = document.getElementById('worldGrid');

            if (!worlds || worlds.length === 0) {
                grid.innerHTML = '<p style="color:#888; grid-column:1/-1; text-align:center;">No worlds yet. Be the first to submit!</p>';
                return;
            }

            grid.innerHTML = worlds.map((world, i) => `
                <div class="world-card">
                    <div class="world-icon">${ICONS[i % ICONS.length]}</div>
                    <div class="world-name">${escapeHtml(world.name)}</div>
                    <div class="world-author">by ${escapeHtml(world.author)}</div>
                    <div class="world-desc">${escapeHtml(world.description || '')}</div>
                    <button class="download-btn" onclick="downloadWorld('${world.file}', '${escapeHtml(world.name)}')">
                        DOWNLOAD
                    </button>
                </div>
            `).join('');
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text || '';
            return div.innerHTML;
        }

        function downloadWorld(file, name) {
            const a = document.createElement('a');
            a.href = 'worlds/' + file;
            a.download = file;
            a.click();
        }

        loadWorlds();
    </script>
</body>
</html>
```

---

## submit.html (Using Netlify Forms)

```html
<!DOCTYPE html>
<html>
<head>
    <title>Submit World - World Hub</title>
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
    <style>
        /* Same base styles as index.html */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0a0a1a;
            color: #fff;
            font-family: 'Press Start 2P', monospace;
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 600px; margin: 0 auto; }
        header { text-align: center; padding: 40px 0; margin-bottom: 40px; }
        h1 { font-size: 18px; color: #c84; margin-bottom: 10px; }

        .form-card {
            background: #1a1a2e;
            border: 2px solid #c84;
            border-radius: 8px;
            padding: 30px;
        }

        label {
            display: block;
            font-size: 10px;
            color: #c84;
            margin-bottom: 8px;
        }

        input, textarea {
            width: 100%;
            padding: 12px;
            margin-bottom: 20px;
            background: #0a0a1a;
            border: 2px solid #333;
            color: #fff;
            font-family: 'Press Start 2P', monospace;
            font-size: 10px;
            border-radius: 4px;
        }

        input:focus, textarea:focus {
            outline: none;
            border-color: #c84;
        }

        textarea { min-height: 80px; resize: vertical; }

        input[type="file"] {
            padding: 10px;
            cursor: pointer;
        }

        .submit-btn {
            background: #4a7c59;
            border: none;
            color: white;
            padding: 15px 30px;
            font-family: 'Press Start 2P', monospace;
            font-size: 10px;
            cursor: pointer;
            border-radius: 4px;
            width: 100%;
        }

        .submit-btn:hover { background: #5a9c69; }

        .back-link {
            display: block;
            text-align: center;
            margin-top: 20px;
            color: #4af;
            font-size: 10px;
            text-decoration: none;
        }

        .note {
            font-size: 8px;
            color: #666;
            margin-top: 20px;
            line-height: 1.8;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>SUBMIT WORLD</h1>
        </header>

        <div class="form-card">
            <!-- Netlify Forms - just add data-netlify="true" -->
            <form name="world-submission" method="POST" data-netlify="true" enctype="multipart/form-data">
                <input type="hidden" name="form-name" value="world-submission">

                <label>World Name</label>
                <input type="text" name="worldName" required placeholder="My Awesome World">

                <label>Your Name / Alias</label>
                <input type="text" name="author" required placeholder="Anonymous">

                <label>Description</label>
                <textarea name="description" placeholder="What's your world about?"></textarea>

                <label>World File (.json)</label>
                <input type="file" name="worldFile" accept=".json" required>

                <label>Contact (optional, for questions)</label>
                <input type="email" name="email" placeholder="your@email.com">

                <button type="submit" class="submit-btn">> SUBMIT FOR REVIEW</button>
            </form>

            <p class="note">
                * Submissions are reviewed before being added.<br>
                * Please don't include offensive content.<br>
                * By submitting, you agree to share your world publicly.
            </p>
        </div>

        <a href="index.html" class="back-link">> BACK TO HUB</a>
    </div>
</body>
</html>
```

---

## netlify.toml

```toml
[build]
  publish = "."

# Allow downloading JSON files
[[headers]]
  for = "/worlds/*.json"
  [headers.values]
    Content-Type = "application/json"
    Content-Disposition = "attachment"

# Form notifications
[build.environment]
  NODE_VERSION = "18"
```

---

## Submission Flow

1. **User fills form** → Netlify captures it
2. **You get email notification** from Netlify
3. **Review the world file** they attached
4. **If approved**:
   - Add `.json` to `worlds/` folder
   - Update `worlds/index.json` manifest
   - Push to repo → Netlify auto-deploys

---

## Setup Steps

1. **Create repo** for the hub site
2. **Add the files** above
3. **Connect to Netlify**:
   - New site from Git
   - Set publish directory: `.`
4. **Enable Netlify Forms** (free tier: 100/month)
5. **Add custom domain** in Netlify settings
6. **Create initial `worlds/index.json`** with your first world

---

## Link from Builder

In `world-builder.html` main menu, add:

```html
<button class="retro-btn" onclick="playButtonSound(); window.open('https://worlds.yourdomain.com', '_blank');">
    > WORLD HUB
</button>
```

---

## Costs

| Service | Free Tier | Notes |
|---------|-----------|-------|
| Netlify Hosting | 100GB bandwidth/month | More than enough |
| Netlify Forms | 100 submissions/month | Manual review anyway |
| Domain | ~$12/year | Optional, can use `.netlify.app` |

**Total: $0-12/year**

---

## Pros vs PartyKit Approach

| | Netlify Static | PartyKit Hub |
|--|----------------|--------------|
| Cost | Free | Counts toward limits |
| Complexity | Very simple | More code |
| Submissions | Manual review | Instant (risky) |
| Search | No (just browse) | Could add |
| Download tracking | No (could add analytics) | Yes |
| Moderation | Built-in (manual) | Need to build |

---

## Future Enhancements

- [ ] Add screenshot thumbnails for each world
- [ ] Categories/tags for filtering
- [ ] Download counter (use simple analytics)
- [ ] Discord webhook for new submissions
- [ ] Auto-generate preview from world JSON
