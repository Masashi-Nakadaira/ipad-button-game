import { useCallback, useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

const secure = typeof window !== 'undefined' && window.isSecureContext === true;
const supported = import.meta.env.PROD && secure &&
  typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'caches' in window;

export function usePwa() {
  const [offlineReady, setOfflineReady] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [error, setError] = useState(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const updater = useRef(null);
  const approvedReload = useRef(false);
  const newWorkerControlling = useRef(false);
  const reloadStarted = useRef(false);
  const [standalone, setStandalone] = useState(() =>
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true));

  useEffect(() => {
    const connectionChanged = () => setOnline(navigator.onLine);
    window.addEventListener('online', connectionChanged);
    window.addEventListener('offline', connectionChanged);
    const displayMode = window.matchMedia?.('(display-mode: standalone)');
    const modeChanged = () => setStandalone(displayMode.matches || navigator.standalone === true);
    displayMode?.addEventListener?.('change', modeChanged);
    return () => {
      window.removeEventListener('online', connectionChanged);
      window.removeEventListener('offline', connectionChanged);
      displayMode?.removeEventListener?.('change', modeChanged);
    };
  }, []);

  useEffect(() => {
    if (!supported) return;
    let alive = true;
    let registration;
    let installing;
    let activeAtRegistration;
    let installWatchdog;
    let controller = navigator.serviceWorker.controller;
    const newController = () => {
      if (!alive) return;
      if (approvedReload.current) {
        if (!reloadStarted.current) {
          reloadStarted.current = true;
          window.location.reload();
        }
      } else {
        newWorkerControlling.current = true;
        setNeedRefresh(true);
      }
    };
    const controllerChanged = () => {
      const next = navigator.serviceWorker.controller;
      if (controller && next && controller !== next) newController();
      controller = next;
    };
    navigator.serviceWorker.addEventListener('controllerchange', controllerChanged);
    const confirmCachedShell = async () => {
      try {
        await navigator.serviceWorker.ready;
        const shell = new URL(`${import.meta.env.BASE_URL}index.html`, window.location.origin);
        const cached = await window.caches.match(shell.href, { ignoreSearch: true });
        if (alive && cached?.ok) { setOfflineReady(true); setError(null); }
        else if (alive) setError('オフライン用の画面を保存できませんでした。');
      } catch {
        if (alive) setError('オフライン用の保存を確認できませんでした。');
      }
    };
    const workerChanged = () => {
      if (!alive || !registration || !installing) return;
      if (installing.state === 'installed' && registration.active) setNeedRefresh(true);
      if (installing.state === 'activated') {
        if (activeAtRegistration && activeAtRegistration !== installing) newController();
        confirmCachedShell();
      }
      if (installing.state === 'redundant' && !registration.active) setError('オフライン用の保存に失敗しました。');
    };
    const watchInstalling = () => {
      installing?.removeEventListener('statechange', workerChanged);
      installing = registration?.installing;
      installing?.addEventListener('statechange', workerChanged);
      workerChanged();
    };
    updater.current = registerSW({
      immediate: true,
      onOfflineReady: confirmCachedShell,
      onNeedRefresh: () => { if (alive) setNeedRefresh(true); },
      onNeedReload: () => {
        newController();
      },
      onRegisteredSW: (_, current) => {
        if (!alive || !current) return;
        registration = current;
        activeAtRegistration = current.active;
        registration.addEventListener('updatefound', watchInstalling);
        watchInstalling();
        if (registration.waiting && registration.active) setNeedRefresh(true);
        if (navigator.serviceWorker.controller && registration.active &&
            navigator.serviceWorker.controller !== registration.active) newController();
        if (registration.active) confirmCachedShell();
        else installWatchdog = setTimeout(() => {
          if (alive && !registration.active && !registration.installing && !registration.waiting) {
            setError('オフライン用の保存に失敗しました。');
          }
        }, 12000);
      },
      onRegisterError: () => { if (alive) setError('オフラインの準備に失敗しました。'); }
    });
    return () => {
      alive = false;
      clearTimeout(installWatchdog);
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged);
      registration?.removeEventListener('updatefound', watchInstalling);
      installing?.removeEventListener('statechange', workerChanged);
      updater.current = null;
    };
  }, []);

  const updateApp = useCallback(async () => {
    if (!needRefresh || !online || !updater.current) return false;
    approvedReload.current = true;
    try {
      if (newWorkerControlling.current) {
        if (!reloadStarted.current) {
          reloadStarted.current = true;
          window.location.reload();
        }
        return true;
      }
      const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
      if (registration?.waiting) {
        const waiting = registration.waiting;
        await new Promise((resolve, reject) => {
          const finish = () => {
            if (waiting.state !== 'activated' && registration.active !== waiting) return;
            clearInterval(poll);
            clearTimeout(timeout);
            waiting.removeEventListener('statechange', finish);
            resolve();
          };
          const poll = setInterval(finish, 100);
          const timeout = setTimeout(() => {
            clearInterval(poll);
            waiting.removeEventListener('statechange', finish);
            reject(new Error('update_timeout'));
          }, 10000);
          waiting.addEventListener('statechange', finish);
          waiting.postMessage({ type: 'SKIP_WAITING' });
          finish();
        });
        if (!reloadStarted.current) {
          reloadStarted.current = true;
          window.location.reload();
        }
      } else if (!reloadStarted.current) {
        // An uncontrolled first visit or another tab can activate the update
        // before this button is pressed; no waiting worker remains to message.
        reloadStarted.current = true;
        window.location.reload();
      }
      return true;
    } catch {
      approvedReload.current = false;
      setError('更新できませんでした。接続を確認してください。');
      return false;
    }
  }, [needRefresh, online]);

  const status = !supported ? 'unavailable' : error ? 'error' : needRefresh ? 'update' : offlineReady ? 'ready' : 'installing';
  return { status, offlineReady, needRefresh, updateApp, error, standalone, supported, secure,
    online, canUpdate: supported && needRefresh && online };
}
