export const INFO_TIMEOUT_MS = 1500;
export const PROBE_RETRY_DELAY_MS = 2500;
export const MAX_PROBE_ATTEMPTS = 2;

export function isGameServerInfo(info) {
  if (!info || typeof info !== 'object' || Array.isArray(info)) return false;
  if (info.appId !== 'button-game' || info.wsPath !== '/ws') return false;
  if (!Number.isInteger(info.port) || info.port < 1 || info.port > 65535) return false;
  if (typeof info.host !== 'string' || !info.host) return false;
  if (!Array.isArray(info.urls) || !info.urls.length) return false;
  return info.urls.every(value => {
    if (typeof value !== 'string') return false;
    try { return ['http:', 'https:'].includes(new URL(value).protocol); }
    catch { return false; }
  });
}
