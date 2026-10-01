import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';
import { WebSocket, WebSocketServer } from 'ws';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const DEFAULT_PORT = 8787;
const MAX_BODY = 2048;
const ROOM_RE = /^[A-Za-z0-9_-]{1,24}$/;
const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function localAddresses() {
  const addresses = new Set(['localhost']);
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.add(entry.address);
    }
  }
  return [...addresses];
}

function allowedOrigin(req) {
  // ESP32/other non-browser clients do not send Origin. Browser clients must
  // come from the page served by this same LAN server.
  if (!req.headers.origin) return true;
  try {
    const origin = new URL(req.headers.origin);
    const requestedHost = new URL(`http://${req.headers.host || ''}`).hostname;
    return ['http:', 'https:'].includes(origin.protocol) && origin.hostname === requestedHost;
  } catch { return false; }
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) {
      const error = new Error('body_too_large'); error.status = 413; throw error;
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const error = new Error('invalid_json'); error.status = 400; throw error; }
}

export function createGameServer({ port = DEFAULT_PORT, host = '0.0.0.0', dist = DIST, now = Date.now,
  base = process.env.APP_BASE || '/' } = {}) {
  const segment = String(base).replace(/^\/+|\/+$/g, '');
  const basePath = segment ? `/${segment}/` : '/';
  const rooms = new Map();
  const seen = new Map();
  const lastPress = new Map();
  let sequence = 0;
  let clientNumber = 0;

  function roomClients(room) {
    if (!rooms.has(room)) rooms.set(room, new Set());
    return rooms.get(room);
  }

  function broadcast(room, message, role) {
    const payload = JSON.stringify(message);
    for (const client of rooms.get(room) ?? []) {
      if ((!role || client.role === role) && client.ws.readyState === WebSocket.OPEN) client.ws.send(payload);
    }
  }

  function peers(room) {
    const clients = [...(rooms.get(room) ?? [])];
    broadcast(room, { type: 'peers', room, controllers: clients.filter(x => x.role === 'controller').length,
      displays: clients.filter(x => x.role === 'display').length });
  }

  function acceptPress(input, room, sourceId) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || input.type !== 'press' ||
        !Number.isInteger(input.button) || input.button < 0 || input.button > 3 ||
        typeof input.eventId !== 'string' || !ID_RE.test(input.eventId) ||
        (input.deviceId !== undefined && (typeof input.deviceId !== 'string' || !ID_RE.test(input.deviceId)))) {
      return { accepted: false, reason: 'invalid_press', status: 400 };
    }
    const current = now();
    const deviceId = input.deviceId ?? sourceId;
    const key = `${room}\0${deviceId}`;
    const buttonKey = `${key}\0${input.button}`;
    const eventKey = `${key}\0${input.eventId}`;
    if (seen.size > 5000) {
      for (const [id, time] of seen) if (current - time > 60_000) seen.delete(id);
      while (seen.size > 5000) seen.delete(seen.keys().next().value);
    }
    if (seen.has(eventKey) && current - seen.get(eventKey) < 60_000) return { accepted: false, reason: 'duplicate', status: 409 };
    // Store the ID before the rate check, so retries of a rejected event stay rejected.
    seen.set(eventKey, current);
    if (current - (lastPress.get(buttonKey) ?? -Infinity) < 65) return { accepted: false, reason: 'too_fast', status: 429 };
    lastPress.set(buttonKey, current);
    if (lastPress.size > 5000) {
      for (const [id, time] of lastPress) if (current - time > 60_000) lastPress.delete(id);
      while (lastPress.size > 5000) lastPress.delete(lastPress.keys().next().value);
    }
    const event = { type: 'press', button: input.button, eventId: input.eventId,
      deviceId, room, sequence: ++sequence, receivedAt: new Date(current).toISOString() };
    broadcast(room, event, 'display');
    return { accepted: true, event, status: 202 };
  }

  const server = http.createServer(async (req, res) => {
    let url;
    try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); }
    catch { return json(res, 400, { error: 'invalid_url' }); }
    if (url.pathname === '/api/info' && req.method === 'GET') {
      const actualPort = server.address()?.port ?? port;
      return json(res, 200, { appId: 'button-game', port: actualPort, host, urls: localAddresses().map(address => `http://${address}:${actualPort}${basePath}`),
        wsPath: '/ws', rooms: [...rooms.keys()] });
    }
    if (url.pathname === '/api/press') {
      if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
      if (!allowedOrigin(req)) return json(res, 403, { error: 'origin_not_allowed' });
      const room = url.searchParams.get('room') ?? 'main';
      if (!ROOM_RE.test(room)) return json(res, 400, { error: 'invalid_room' });
      if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'json_required' });
      try {
        const input = await readJson(req);
        const result = acceptPress(input, room, req.socket.remoteAddress || 'http');
        return result.accepted ? json(res, 202, result.event) : json(res, result.status, { error: result.reason });
      } catch (error) { return json(res, error.status ?? 400, { error: error.message }); }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method_not_allowed' });
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { return json(res, 400, { error: 'invalid_path' }); }
    if (pathname.includes('\0')) return json(res, 400, { error: 'invalid_path' });
    if (basePath !== '/' && pathname === basePath.slice(0, -1)) {
      res.writeHead(308, { Location: `${basePath}${url.search}`, 'Cache-Control': 'no-store' });
      return res.end();
    }
    const relative = basePath === '/' ? pathname : pathname.startsWith(basePath) ? pathname.slice(basePath.length - 1) : null;
    if (relative === null) return json(res, 404, { error: 'not_found' });
    const candidate = path.resolve(dist, `.${relative === '/' ? '/index.html' : relative}`);
    if (!candidate.startsWith(`${path.resolve(dist)}${path.sep}`)) return json(res, 403, { error: 'forbidden' });
    try {
      const file = await stat(candidate);
      if (!file.isFile()) throw new Error('not_file');
      const data = await readFile(candidate);
      const asset = relative.startsWith('/assets/') && /-[A-Za-z0-9_-]{8,}\./.test(path.basename(candidate));
      res.writeHead(200, { 'Content-Type': MIME[path.extname(candidate)] ?? 'application/octet-stream',
        'Content-Length': data.length, 'Cache-Control': asset ? 'public, max-age=31536000, immutable' : 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      if (!path.extname(relative) && !/^\/(?:api|ws)(?:\/|$)/.test(relative) && req.headers.accept?.includes('text/html')) {
        try {
          const data = await readFile(path.join(dist, 'index.html'));
          res.writeHead(200, { 'Content-Type': MIME['.html'], 'Content-Length': data.length, 'Cache-Control': 'no-cache' });
          return res.end(req.method === 'HEAD' ? undefined : data);
        } catch {}
      }
      json(res, 404, { error: 'not_found', hint: 'Run npm run build first.' });
    }
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_BODY, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    let url;
    try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); } catch { socket.destroy(); return; }
    const role = url.searchParams.get('role');
    const room = url.searchParams.get('room') ?? 'main';
    if (url.pathname !== '/ws' || !['display', 'controller'].includes(role) || !ROOM_RE.test(room) || !allowedOrigin(req)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, { role, room, req }));
  });
  wss.on('connection', (ws, { role, room, req }) => {
    const client = { ws, role, room, id: `ws-${++clientNumber}`, alive: true };
    roomClients(room).add(client);
    ws.send(JSON.stringify({ type: 'hello', role, room, serverTime: new Date(now()).toISOString(), sequence }));
    peers(room);
    ws.on('pong', () => { client.alive = true; });
    // ws emits an error before closing oversized or malformed frames.
    ws.on('error', () => {});
    ws.on('message', raw => {
      if (role !== 'controller') return ws.send(JSON.stringify({ type: 'error', error: 'display_is_read_only' }));
      let input;
      try { input = JSON.parse(raw.toString()); } catch { return ws.send(JSON.stringify({ type: 'error', error: 'invalid_json' })); }
      const result = acceptPress(input, room, client.id);
      ws.send(JSON.stringify(result.accepted
        ? { type: 'ack', eventId: input.eventId, accepted: true, sequence: result.event.sequence }
        : { type: 'ack', eventId: typeof input?.eventId === 'string' ? input.eventId : null,
            accepted: false, reason: result.reason }));
    });
    ws.on('close', () => {
      rooms.get(room)?.delete(client);
      if (!rooms.get(room)?.size) rooms.delete(room);
      else peers(room);
    });
  });
  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      const record = [...rooms.values()].flatMap(set => [...set]).find(x => x.ws === client);
      if (!record) continue;
      if (!record.alive) { client.terminate(); continue; }
      record.alive = false; client.ping();
    }
  }, 30_000);
  heartbeat.unref();
  return {
    server,
    async listen() { await new Promise(resolve => server.listen(port, host, resolve)); return server.address(); },
    async close() {
      clearInterval(heartbeat);
      for (const client of wss.clients) client.terminate();
      await new Promise(resolve => wss.close(resolve));
      if (server.listening) await new Promise(resolve => server.close(resolve));
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const game = createGameServer({ port: Number(process.env.PORT) || DEFAULT_PORT });
  game.listen().then(address => {
    console.log(`ボタンゲーム: http://localhost:${address.port}`);
    for (const url of localAddresses()) if (url !== 'localhost') console.log(`iPad: http://${url}:${address.port}`);
  }).catch(error => { console.error('起動できません:', error.message); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => game.close().then(() => process.exit(0)));
}
