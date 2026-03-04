const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'DEATHMATCH SERVER ONLINE', players: Object.keys(players).length }));
  }
});

const wss = new WebSocket.Server({ server });

const players = {};
const MAP_SIZE = 80;
const RESPAWN_DELAY = 3000;

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function randomSpawn() {
  return {
    x: (Math.random() - 0.5) * (MAP_SIZE - 10),
    y: 1.8,
    z: (Math.random() - 0.5) * (MAP_SIZE - 10)
  };
}

function broadcast(data, excludeId = null) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      const player = Object.values(players).find(p => p.ws === client);
      if (player && player.id !== excludeId) {
        client.send(msg);
      }
    }
  });
}

function sendTo(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

wss.on('connection', (ws) => {
  const id = generateId();
  const spawn = randomSpawn();
  const colors = ['#ff4444','#44ff44','#4444ff','#ffff44','#ff44ff','#44ffff','#ff8844','#8844ff'];
  const color = colors[Math.floor(Math.random() * colors.length)];

  players[id] = {
    id,
    ws,
    x: spawn.x, y: spawn.y, z: spawn.z,
    rotY: 0,
    health: 100,
    kills: 0,
    deaths: 0,
    color,
    name: `Player_${id.substr(0,4)}`,
    alive: true,
    lastUpdate: Date.now()
  };

  console.log(`[+] Player ${id} connected. Total: ${Object.keys(players).length}`);

  // Send welcome with own ID and all current players
  const currentPlayers = {};
  Object.values(players).forEach(p => {
    if (p.id !== id) {
      currentPlayers[p.id] = { id: p.id, x: p.x, y: p.y, z: p.z, rotY: p.rotY, health: p.health, kills: p.kills, deaths: p.deaths, color: p.color, name: p.name, alive: p.alive };
    }
  });

  sendTo(ws, {
    type: 'welcome',
    id,
    color,
    spawn,
    players: currentPlayers
  });

  // Notify others of new player
  broadcast({
    type: 'player_joined',
    player: { id, x: spawn.x, y: spawn.y, z: spawn.z, rotY: 0, health: 100, kills: 0, deaths: 0, color, name: players[id].name, alive: true }
  }, id);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const p = players[id];
    if (!p) return;

    switch (msg.type) {
      case 'move':
        p.x = msg.x; p.y = msg.y; p.z = msg.z; p.rotY = msg.rotY;
        p.lastUpdate = Date.now();
        broadcast({ type: 'player_moved', id, x: p.x, y: p.y, z: p.z, rotY: p.rotY }, id);
        break;

      case 'shoot':
        // Broadcast bullet to all other players
        broadcast({ type: 'bullet', shooterId: id, x: msg.x, y: msg.y, z: msg.z, dirX: msg.dirX, dirY: msg.dirY, dirZ: msg.dirZ, color: p.color }, id);
        break;

      case 'hit':
        const target = players[msg.targetId];
        if (target && target.alive) {
          target.health -= msg.damage || 25;
          if (target.health <= 0) {
            target.health = 0;
            target.alive = false;
            target.deaths++;
            p.kills++;

            // Broadcast kill
            wss.clients.forEach(client => {
              const pl = Object.values(players).find(pp => pp.ws === client);
              if (pl) {
                sendTo(client, {
                  type: 'kill',
                  killerId: id,
                  killerName: p.name,
                  victimId: target.id,
                  victimName: target.name,
                  killerKills: p.kills,
                  victimDeaths: target.deaths
                });
              }
            });

            // Respawn after delay
            setTimeout(() => {
              if (players[target.id]) {
                const newSpawn = randomSpawn();
                target.health = 100;
                target.alive = true;
                target.x = newSpawn.x; target.y = newSpawn.y; target.z = newSpawn.z;
                wss.clients.forEach(client => {
                  const pl = Object.values(players).find(pp => pp.ws === client);
                  if (pl) {
                    sendTo(client, { type: 'respawn', id: target.id, x: newSpawn.x, y: newSpawn.y, z: newSpawn.z });
                  }
                });
              }
            }, RESPAWN_DELAY);
          } else {
            // Broadcast damage
            broadcast({ type: 'damage', targetId: target.id, health: target.health }, null);
            sendTo(target.ws, { type: 'you_hit', health: target.health, damage: msg.damage || 25, attackerId: id });
          }
        }
        break;

      case 'set_name':
        p.name = msg.name.substr(0, 16).replace(/[^a-zA-Z0-9_\-]/g, '') || p.name;
        broadcast({ type: 'player_renamed', id, name: p.name }, null);
        break;

      case 'chat':
        const chatMsg = msg.text.substr(0, 100);
        broadcast({ type: 'chat', id, name: p.name, text: chatMsg, color: p.color }, null);
        // Also send to self
        sendTo(ws, { type: 'chat', id, name: p.name, text: chatMsg, color: p.color });
        break;
    }
  });

  ws.on('close', () => {
    console.log(`[-] Player ${id} disconnected.`);
    broadcast({ type: 'player_left', id }, id);
    delete players[id];
  });

  ws.on('error', () => {
    delete players[id];
  });
});

// Cleanup stale connections
setInterval(() => {
  const now = Date.now();
  Object.values(players).forEach(p => {
    if (now - p.lastUpdate > 30000) {
      p.ws.terminate();
    }
  });
}, 10000);

server.listen(PORT, () => {
  console.log(`🔫 Deathmatch server running on port ${PORT}`);
});
