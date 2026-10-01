import test from 'node:test';
import assert from 'node:assert/strict';
import { INFO_TIMEOUT_MS, isGameServerInfo, MAX_PROBE_ATTEMPTS } from '../src/connectionProbe.js';

const valid = { appId: 'button-game', port: 8787, host: '0.0.0.0', urls: ['http://localhost:8787', 'http://192.168.1.2:8787'], wsPath: '/ws' };

test('only the expected game backend info authorizes a WebSocket', () => {
  assert.equal(isGameServerInfo(valid), true);
  for (const change of [
    { appId: 'other-app' }, { wsPath: '//foreign/ws' }, { wsPath: '/another' },
    { port: 0 }, { urls: [] }, { urls: ['javascript:alert(1)'] }, { host: '' },
  ]) assert.equal(isGameServerInfo({ ...valid, ...change }), false);
  assert.equal(isGameServerInfo('<html>not JSON</html>'), false);
  assert.equal(isGameServerInfo(null), false);
});

test('probe has a short timeout and finite attempts', () => {
  assert.ok(INFO_TIMEOUT_MS <= 2000);
  assert.ok(MAX_PROBE_ATTEMPTS >= 1 && MAX_PROBE_ATTEMPTS <= 3);
});
