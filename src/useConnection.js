import { useCallback, useEffect, useRef, useState } from 'react';
import { uniqueEvent } from './gameEngine.js';
import { INFO_TIMEOUT_MS, isGameServerInfo, MAX_PROBE_ATTEMPTS, PROBE_RETRY_DELAY_MS } from './connectionProbe.js';

const DEVICE_KEY = 'button-game-device';
function deviceId() {
  try { let id = localStorage.getItem(DEVICE_KEY); if (!id) { id = uniqueEvent(); localStorage.setItem(DEVICE_KEY, id); } return id; }
  catch { return uniqueEvent(); }
}

export function useConnection(role, room, onPress, enabled = true) {
  const [mode, setMode] = useState('checking');
  const [status, setStatus] = useState('接続先を確認中');
  const [reason, setReason] = useState('');
  const [peers, setPeers] = useState({ controllers: 0, displays: 0 });
  const [serverInfo, setServerInfo] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const socket = useRef(null);
  const lastEvents = useRef(new Set());
  const callback = useRef(onPress);
  callback.current = onPress;
  const id = useRef(null);
  if (!id.current) id.current = deviceId();
  const reconnect = useCallback(() => setRetryKey(value => value + 1), []);

  useEffect(() => {
    if (!enabled || import.meta.env.VITE_STATIC_HOST === 'true') {
      setMode('solo'); setStatus('単体モード');
      setReason(import.meta.env.VITE_STATIC_HOST === 'true' ? '公開版は画面のボタン、または接続済みのBluetoothキーボードで遊べます。Wi-Fiボタン中継はローカルサーバー版で使えます。' : '');
      setPeers({ controllers: 0, displays: 0 }); setServerInfo(null);
      return;
    }
    let stopped = false;
    let suspended = false;
    let probeAttempt = 0;
    let socketAttempt = 0;
    let probeAbort;
    let probeTimeout;
    let retryTimer;
    let socketTimeout;
    let ws;
    lastEvents.current.clear();
    setPeers({ controllers: 0, displays: 0 });
    setServerInfo(null);
    setMode('checking');
    setStatus('接続先を確認中');
    setReason('');

    function clearPending() {
      clearTimeout(probeTimeout);
      clearTimeout(retryTimer);
      clearTimeout(socketTimeout);
    }
    function solo(message) {
      if (stopped) return;
      setMode('solo');
      setStatus('単体モード');
      setReason(message);
      setServerInfo(null);
      setPeers({ controllers: 0, displays: 0 });
      socket.current = null;
    }
    function retrySocket(info) {
      if (stopped || suspended) return;
      setStatus('切断中');
      setPeers({ controllers: 0, displays: 0 });
      const delay = Math.min(15000, 1500 * 2 ** Math.min(socketAttempt++, 4));
      retryTimer = setTimeout(() => openSocket(info), delay);
    }
    function openSocket(info) {
      if (stopped || suspended) return;
      setMode('wifi');
      setStatus('接続中');
      setReason('');
      const address = new URL(info.wsPath, location.href);
      address.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      address.searchParams.set('role', role);
      address.searchParams.set('room', room);
      try { ws = new WebSocket(address); }
      catch { retrySocket(info); return; }
      const current = ws;
      socket.current = current;
      socketTimeout = setTimeout(() => { if (current.readyState === WebSocket.CONNECTING) current.close(); }, 4000);
      current.onopen = () => {
        if (stopped || suspended || current !== ws) { current.close(); return; }
        clearTimeout(socketTimeout);
        socketAttempt = 0;
        setStatus('接続済み');
      };
      current.onmessage = event => {
        if (stopped || suspended || current !== ws) return;
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'peers' && message.room === room) setPeers({ controllers: message.controllers ?? 0, displays: message.displays ?? 0 });
        if (message.type === 'press' && role === 'display' && message.room === room && Number.isInteger(message.button) && message.button >= 0 && message.button <= 3) {
          const key = `${message.deviceId}:${message.eventId}`;
          if (lastEvents.current.has(key)) return;
          lastEvents.current.add(key);
          if (lastEvents.current.size > 300) lastEvents.current.clear();
          callback.current?.(message.button, message);
        }
      };
      current.onclose = () => {
        clearTimeout(socketTimeout);
        if (socket.current === current) socket.current = null;
        if (stopped || suspended || current !== ws) return;
        retrySocket(info);
      };
      current.onerror = () => current.close();
    }
    async function probe() {
      if (stopped || suspended) return;
      if (navigator.onLine === false) { solo('ネットワークがオフラインです。'); return; }
      probeAttempt++;
      setMode('checking');
      setStatus('接続先を確認中');
      probeAbort = new AbortController();
      const controller = probeAbort;
      probeTimeout = setTimeout(() => controller.abort(), INFO_TIMEOUT_MS);
      try {
        const response = await fetch('/api/info', { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
        if (stopped || suspended) return;
        if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('application/json')) { solo('Wi-Fi送信機がないため、画面のボタンだけで遊べます。'); return; }
        let info;
        try { info = await response.json(); }
        catch { solo('Wi-Fi送信機がないため、画面のボタンだけで遊べます。'); return; }
        if (stopped || suspended) return;
        if (!isGameServerInfo(info)) { solo('Wi-Fi送信機がないため、画面のボタンだけで遊べます。'); return; }
        setServerInfo(info);
        openSocket(info);
      } catch {
        if (stopped || suspended) return;
        if (navigator.onLine === false) { solo('ネットワークがオフラインです。'); return; }
        if (probeAttempt < MAX_PROBE_ATTEMPTS) retryTimer = setTimeout(probe, PROBE_RETRY_DELAY_MS * probeAttempt);
        else solo('Wi-Fi送信機を確認できませんでした。');
      } finally { clearTimeout(probeTimeout); }
    }
    function offline() {
      suspended = true;
      clearPending();
      probeAbort?.abort();
      ws?.close();
      solo('ネットワークがオフラインです。');
    }
    function online() { if (!stopped) setRetryKey(value => value + 1); }
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    probe();
    return () => {
      stopped = true;
      suspended = true;
      clearPending();
      probeAbort?.abort();
      ws?.close();
      if (socket.current === ws) socket.current = null;
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, [role, room, enabled, retryKey]);

  const send = useCallback(button => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(JSON.stringify({ type: 'press', button, eventId: uniqueEvent(), deviceId: id.current }));
    return true;
  }, []);
  return { mode, status, reason, peers, serverInfo, reconnect, send, deviceId: id.current };
}
