# 🔫 DEATHMATCH SERVER

WebSocket multiplayer server for the 3D WebGL Deathmatch game.

## Deploy to Railway

1. Create a free account at [railway.app](https://railway.app)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Push this folder to a GitHub repo, then connect it
   — OR — use **"Deploy from local"** with the Railway CLI:
   ```
   npm install -g @railway/cli
   railway login
   railway init
   railway up
   ```
4. Railway will auto-detect Node.js and deploy
5. Go to your project → **Settings** → **Networking** → **Generate Domain**
6. Copy your domain (e.g. `deathmatch-server-production.up.railway.app`)
7. Paste it into the game client when prompted!

## Environment Variables
None required — Railway sets `PORT` automatically.

## What it does
- Handles WebSocket connections for all players
- Broadcasts movement, shooting, hits, kills, respawns
- Manages health, kill/death tracking, chat
- Auto-respawns players after 3 seconds
