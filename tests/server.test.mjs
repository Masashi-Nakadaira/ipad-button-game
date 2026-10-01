import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { createGameServer } from '../server.mjs';

async function fixture(t, options = {}) {
  const dist = await mkdtemp(path.join(os.tmpdir(), 'button-game-'));
  await writeFile(path.join(dist, 'index.html'), '<h1>Ready</h1>');
  const game = createGameServer({ port: 0, host: '127.0.0.1', base: '/', dist, ...options });
  const { port } = await game.listen();
  t.after(async () => { await game.close(); await rm(dist, { recursive: true, force: true }); });
  return { base: `http://127.0.0.1:${port}`, port, dist };
}

function connect(port, role, room = 'main') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?role=${role}&room=${room}`);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function message(ws, predicate, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.off('message', onMessage); reject(new Error('message timeout')); }, timeout);
    function onMessage(raw) {
      const data = JSON.parse(raw.toString());
      if (!predicate(data)) return;
      clearTimeout(timer); ws.off('message', onMessage); resolve(data);
    }
    ws.on('message', onMessage);
  });
}

test('serves the built page and local connection information', async t => {
  const { base, port } = await fixture(t);
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Ready/);
  const info = await (await fetch(`${base}/api/info`)).json();
  assert.equal(info.appId, 'button-game');
  assert.equal(info.port, port);
  assert.equal(info.wsPath, '/ws');
  assert.ok(info.urls.some(url => url.endsWith(`:${port}/`)));
  assert.equal((await fetch(`${base}/../server.mjs`)).status, 404);
});

test('serves PWA files under a configured base with correct MIME and cache policy', async t => {
  const { base, dist } = await fixture(t, { base: '/games/' });
  await mkdir(path.join(dist, 'assets'));
  await writeFile(path.join(dist, 'sw.js'), 'self.addEventListener("install",()=>{})');
  await writeFile(path.join(dist, 'manifest.webmanifest'), '{}');
  await writeFile(path.join(dist, 'assets', 'index-abcdefgh.js'), 'export default 1');
  const redirect = await fetch(`${base}/games`, { redirect: 'manual' });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), '/games/');
  const page = await fetch(`${base}/games/?controller=1`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('cache-control'), /no-cache/);
  const manifest = await fetch(`${base}/games/manifest.webmanifest`);
  assert.match(manifest.headers.get('content-type'), /application\/manifest\+json/);
  const sw = await fetch(`${base}/games/sw.js`);
  assert.match(sw.headers.get('cache-control'), /no-cache/);
  const script = await fetch(`${base}/games/assets/index-abcdefgh.js`);
  assert.match(script.headers.get('cache-control'), /immutable/);
  assert.equal((await fetch(`${base}/games/play`, { headers: { Accept: 'text/html' } })).status, 200);
  assert.equal((await fetch(`${base}/games/api/missing`, { headers: { Accept: 'text/html' } })).status, 404);
  assert.equal((await fetch(`${base}/games/ws`, { headers: { Accept: 'text/html' } })).status, 404);
});

test('relays ordered presses only to the matching room and acknowledges controller', async t => {
  const { port } = await fixture(t);
  const display = await connect(port, 'display', 'living');
  const other = await connect(port, 'display', 'other');
  const controller = await connect(port, 'controller', 'living');
  t.after(() => { display.close(); other.close(); controller.close(); });
  const press = message(display, data => data.type === 'press');
  const ack = message(controller, data => data.type === 'ack');
  controller.send(JSON.stringify({ type: 'press', button: 2, eventId: 'event-1', deviceId: 'pad-1' }));
  const event = await press;
  assert.equal(event.room, 'living');
  assert.equal(event.button, 2);
  assert.equal(event.sequence, 1);
  assert.ok(Date.parse(event.receivedAt));
  assert.deepEqual(await ack, { type: 'ack', eventId: 'event-1', accepted: true, sequence: 1 });
  await assert.rejects(message(other, data => data.type === 'press', 150), /timeout/);
  const duplicate = message(controller, data => data.type === 'ack');
  controller.send(JSON.stringify({ type: 'press', button: 2, eventId: 'event-1', deviceId: 'pad-1' }));
  assert.equal((await duplicate).reason, 'duplicate');
});

test('HTTP press reaches display, rejects invalid, duplicate, rapid, and foreign origin', async t => {
  const { base, port } = await fixture(t);
  const display = await connect(port, 'display', 'main');
  t.after(() => display.close());
  const send = (body, headers = {}) => fetch(`${base}/api/press?room=main`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body)
  });
  const input = { type: 'press', button: 0, eventId: 'one', deviceId: 'esp32-1' };
  const received = message(display, data => data.type === 'press');
  assert.equal((await send(input)).status, 202);
  assert.equal((await received).deviceId, 'esp32-1');
  assert.equal((await send(input)).status, 409);
  assert.equal((await send({ ...input, eventId: 'two' })).status, 429);
  // Distinct physical buttons may be pressed at the same instant.
  const secondButton = message(display, data => data.type === 'press' && data.button === 1);
  assert.equal((await send({ ...input, eventId: 'simultaneous', button: 1 })).status, 202);
  assert.equal((await secondButton).button, 1);
  assert.equal((await send({ ...input, eventId: 'three', button: 4 })).status, 400);
  assert.equal((await send({ ...input, eventId: 'four' }, { Origin: 'http://evil.example' })).status, 403);
  assert.equal((await fetch(`${base}/api/press`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(3000) })).status, 413);
});

test('oversized WebSocket frame closes that client without stopping the server', async t => {
  const { base, port } = await fixture(t);
  const controller = await connect(port, 'controller');
  const closed = new Promise(resolve => controller.once('close', resolve));
  controller.send('x'.repeat(3000));
  await closed;
  assert.equal((await fetch(`${base}/api/info`)).status, 200);
});

test('controller can reconnect, but display cannot inject presses', async t => {
  const { port } = await fixture(t);
  const display = await connect(port, 'display');
  let controller = await connect(port, 'controller');
  controller.close();
  await new Promise(resolve => controller.once('close', resolve));
  controller = await connect(port, 'controller');
  t.after(() => { display.close(); controller.close(); });
  const eventPromise = message(display, data => data.type === 'press');
  controller.send(JSON.stringify({ type: 'press', button: 3, eventId: 'reconnected', deviceId: 'pad-2' }));
  assert.equal((await eventPromise).button, 3);
  const error = message(display, data => data.type === 'error');
  display.send(JSON.stringify({ type: 'press', button: 1, eventId: 'bad' }));
  assert.equal((await error).error, 'display_is_read_only');
});
