import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const basePath = (process.env.APP_BASE || '').replace(/^\/+|\/+$/g, '');
const base = basePath ? `/${basePath}/` : '/';

async function files(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) found.push(...await files(path.join(directory, entry.name), `${name}/`));
    else found.push(name);
  }
  return found;
}

test('built service worker precaches every game asset without API runtime caching', async () => {
  const sw = await readFile(path.join(dist, 'sw.js'), 'utf8');
  const emitted = (await files(dist)).filter(name => !name.startsWith('workbox-') && name !== 'sw.js');
  const precached = [...sw.matchAll(/url:"([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(precached).size, precached.length);
  assert.deepEqual(new Set(precached), new Set(emitted));
  assert.match(sw, /cleanupOutdatedCaches/);
  assert.match(sw, /NavigationRoute/);
  assert.match(sw, /SKIP_WAITING/);
  assert.doesNotMatch(sw, /NetworkFirst|StaleWhileRevalidate|CacheFirst/);
});

test('manifest and Apple icon have installable names, scope, and real PNG dimensions', async () => {
  const manifest = JSON.parse(await readFile(path.join(dist, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'みんなのボタンゲーム');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.lang, 'ja');
  assert.equal(manifest.id, base);
  assert.equal(manifest.start_url, base);
  assert.equal(manifest.scope, base);
  const icons = [['icons/icon-192.png', 192], ['icons/icon-512.png', 512], ['icons/apple-touch-icon.png', 180]];
  for (const [name, size] of icons) {
    const png = await readFile(path.join(dist, name));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  assert.match(html, /rel="apple-touch-icon"/);
  assert.match(html, /rel="manifest"/);
  for (const match of html.matchAll(/(?:src|href)="(\/[^\"]+)"/g)) {
    assert.ok(match[1].startsWith(base), `asset outside application base: ${match[1]}`);
  }
  const sw = await readFile(path.join(dist, 'sw.js'), 'utf8');
  assert.ok(sw.includes(`${base}index.html`), 'offline navigation must use the application base');
});
