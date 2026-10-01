import React, { useCallback, useEffect, useRef, useState } from 'react';
import { COLORS, GAMES, QUIZ } from './gameData.js';
import { getQuizPool, getTotalRounds, newRound, normalizeGameScore, reactionGrade, redScore, rpsAnswer, rpsResult, shuffle, teamScore, tenGrade } from './gameEngine.js';
import { beep, speak, startMelody, stopAudio, unlockAudio } from './audio.js';
import { useConnection } from './useConnection.js';
import { usePwa } from './usePwa.js';
import GameDisplay from './GameDisplay.jsx';
import DailyDashboard from './DailyDashboard.jsx';
import { appendHistory, dailyGameIds, localDateKey, readHistory } from './daily.js';
import { changeTenDistractor, createTenDistractors } from './tenDistraction.js';

const RPS = ['グー', 'チョキ', 'パー'];
const DEFAULT_SETTINGS = { players: 2, pace: 'normal', sound: true, room: 'main', rpsMode: 'random' };
const TIMEOUT = { rps: 16000, quiz: 22000, count: 15000, bigger: 15000, red: 2500, light: 4500, sound: 5500, team: 6000, memory: 20000 };
const AUTO_GAMES = new Set(['rps', 'quiz', 'bigger', 'memory', 'light', 'sound', 'count']);
function quizOrder(previous = [], difficulty = 'normal') {
  const order = shuffle(getQuizPool(difficulty));
  if (previous.length && order.slice(0, 5).every(i => previous.slice(0, 5).includes(i))) [order[0], order[5]] = [order[5], order[0]];
  return order;
}

function Icon({ name, size = 48 }) {
  if (name === 'buttons') return <span className="icon-buttons" aria-hidden="true">{COLORS.map((color, i) => <i key={i} style={{ background: color.hex }} />)}</span>;
  if (name === 'clock') return <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true"><circle cx="50" cy="50" r="39" stroke="currentColor" strokeWidth="4"/><path d="M50 15v7M50 78v7M15 50h7M78 50h7" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><text x="50" y="62" fill="currentColor" textAnchor="middle" fontSize="31" fontWeight="800">10</text></svg>;
  if (name === 'hand') return <svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M37 56V20c0-7 9-7 9 0v24-31c0-7 10-7 10 0v31-25c0-7 10-7 10 0v27-18c0-7 10-7 10 0v30c0 19-12 29-29 29-10 0-17-4-22-12L13 59c-5-7 4-13 10-8l14 14"/></svg>;
  const symbols = { sun: '☀', music: '♫', question: '?', red: '●', numbers: '1₂₃', bars: '▥', grid: '▦' };
  return <span className={`symbol symbol-${name}`} aria-hidden="true">{symbols[name]}</span>;
}
function Arrow() { return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>; }
function ColorDots() { return <span className="brand-dots" aria-hidden="true">{COLORS.map((c, i) => <i key={i} style={{ background: c.hex }}/>)}</span>; }
function controllerLink(info, room) {
  if (!info) return null;
  const lan = info.urls.find(value => { const host = new URL(value).hostname; return host !== 'localhost' && host !== '127.0.0.1'; });
  const base = lan || (!['localhost', '127.0.0.1'].includes(location.hostname) ? location.origin : null);
  return base ? `${base.replace(/\/$/, '')}/?controller=1&room=${encodeURIComponent(room)}` : null;
}
function MainButton({ button, label, onClick, disabled = false, selected = false, large = false }) {
  const color = COLORS[button];
  return <button className={`color-button ${large ? 'large' : ''} ${selected ? 'selected' : ''}`} style={{ '--button-color': color.hex }} onClick={onClick} disabled={disabled} aria-label={label || `${color.name}ボタン`}><span className="color-button-face"/><span className="color-button-label">{label || color.name}</span></button>;
}
function useKeyboard(onPress) {
  const callback = useRef(onPress); callback.current = onPress;
  useEffect(() => {
    function keydown(event) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
      const map = { '1': 0, a: 0, A: 0, '2': 1, s: 1, S: 1, '3': 2, d: 2, D: 2, '4': 3, f: 3, F: 3, ' ': 0 };
      if (map[event.key] === undefined) return;
      event.preventDefault(); callback.current(map[event.key], { source: 'keyboard' });
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
}

function PwaStatus({ pwa, compact = false }) {
  const message = pwa.status === 'ready' ? 'オフラインで遊べる準備ができました' :
    pwa.status === 'installing' ? 'オフライン用の画面を保存中…' :
      pwa.status === 'update' ? '新しい版を使えます' :
        pwa.status === 'error' ? 'オフライン保存を確認できませんでした' :
          !pwa.secure ? 'HTTPSで開くとオフライン保存できます' : 'この環境ではオフライン保存を利用できません';
  return <div className={`pwa-status ${compact ? 'compact' : ''} pwa-${pwa.status}`} role="status"><span className="pwa-indicator" aria-hidden="true"/><span>{message}</span>{pwa.needRefresh && <button className="pwa-update-button" onClick={pwa.updateApp} disabled={!pwa.canUpdate}>いま更新する</button>}</div>;
}

function Setup({ settings, setSettings, close, connection, controllerUrl, testButton, testSignal, pwa }) {
  const [copied, setCopied] = useState(false);
  const [testValue, setTestValue] = useState(null);
  const change = (key, value) => setSettings(current => ({ ...current, [key]: value }));
  async function copy() { if (!controllerUrl) return; try { await navigator.clipboard.writeText(controllerUrl); setCopied(true); } catch { setCopied(false); } }
  const wifiReady = connection.mode === 'wifi' && connection.status === '接続済み';
  return <div className="dialog-scrim" onClick={close}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={e => e.stopPropagation()}>
    <div className="dialog-heading"><h2 id="settings-title">接続・設定</h2><button className="text-control" onClick={close}>閉じる</button></div>
    <div className="form-grid"><label>参加人数 <select value={settings.players} onChange={e => change('players', Number(e.target.value))}><option value="2">2人</option><option value="3">3人</option><option value="4">4人</option></select></label><label>難易度 <select value={settings.pace} onChange={e => change('pace', e.target.value)}><option value="slow">やさしい</option><option value="normal">ふつう</option><option value="challenge">挑戦</option></select></label></div><label className="room-label">じゃんけんのお題 <select value={settings.rpsMode} onChange={e => change('rpsMode', e.target.value)}><option value="random">ランダム</option><option value="win">勝って</option><option value="lose">負けて</option></select></label>
    <label className="switch-row">音声・効果音 <input type="checkbox" checked={settings.sound} onChange={e => change('sound', e.target.checked)}/></label>
    <label className="room-label">おへやの名前 <input value={settings.room} maxLength="12" onChange={e => change('room', e.target.value.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase())}/></label>
    <div className="connection-box"><strong>通信状態：{wifiReady ? 'Wi-Fiボタン接続済み' : connection.mode === 'wifi' ? connection.status : connection.mode === 'checking' ? '送信機を確認中' : '単体モード'}</strong>{wifiReady ? <><span>コントローラー {connection.peers.controllers} 台 接続中</span>{controllerUrl ? <><p>同じ Wi‑Fi のスマートフォンで下のアドレスを開いてください。</p><code className="url-box">{controllerUrl}</code><button className="small-action" onClick={copy}>{copied ? 'コピーしました' : 'アドレスをコピー'}</button><small>コピーできない場合は、上のアドレスをスマートフォンに入力してください。</small></> : <p>送信機は接続されています。スマートフォン用のアドレスを確認できませんでした。</p>}</> : <p>{connection.mode === 'solo' ? 'この端末の画面のボタンで、すべてのゲームを遊べます。' : '画面のボタンでは、接続を待たずに遊べます。'}</p>}{connection.reason && !wifiReady && <small>{connection.reason}</small>}<button className="small-action" onClick={connection.reconnect}>Wi-Fi接続を再確認</button></div>
    {wifiReady && <div className="test-area"><strong>ボタン接続テスト</strong><p>コントローラーの色ボタンを押してください。</p><div className="test-dots">{COLORS.map((c, i) => <button key={i} title={`${c.name}を試す`} className={(testSignal ?? testValue) === i ? 'lit' : ''} style={{ background: c.hex }} onClick={() => { setTestValue(i); testButton(i); }} />)}</div><small>最後に押した色：{(testSignal ?? testValue) === null ? 'まだありません' : COLORS[testSignal ?? testValue].name}</small></div>}
    <div className="pwa-help"><strong>ホーム画面で使う</strong><PwaStatus pwa={pwa} compact/><p>iPad・iPhoneではSafariの共有から「ホーム画面に追加」。追加したアイコンから一度オンラインで開き、準備完了を確認してください。その後、通信をオフにして同じアイコンから起動できるか確かめられます。</p><small>記録はこのブラウザーまたは追加したホーム画面アプリ内に保存されます。</small></div>
  </section></div>;
}

function Controller({ room, settings }) {
  const [last, setLast] = useState(null);
  const connection = useConnection('controller', room);
  useKeyboard(button => { if (connection.send(button)) setLast(button); });
  function press(button) { unlockAudio(); if (connection.send(button)) { setLast(button); if (settings.sound) beep(350 + button * 100); } }
  const connected = connection.mode === 'wifi' && connection.status === '接続済み';
  return <main className="controller-page"><header className="controller-header"><div className="brand"><ColorDots/><b>ボタンゲーム</b></div><span className={`status ${connected ? 'online' : ''}`}>{connection.status}</span></header><div className="controller-copy"><h1>色のボタンを<br/>押してね。</h1><p>おへや：{room}　・　{connected ? '画面を見ながら遊ぼう' : '送信先を確認できません'}</p></div><div className="controller-grid">{COLORS.map((c, i) => <MainButton key={i} button={i} onClick={() => press(i)} selected={last === i} disabled={!connected} large />)}</div><p className="controller-help">{connected ? 'ボタンを押すと、ゲームの画面に届きます。' : 'ゲーム画面では、端末の画面のボタンだけで遊べます。'}</p>{!connected && <button className="small-action controller-retry" onClick={connection.reconnect}>Wi-Fi接続を再確認</button>}</main>;
}

function Home({ openGame, openSettings, startDaily, openRecords, settings, setSettings, pwa }) {
  const featured = GAMES.slice(0, 3);
  const rest = GAMES.slice(3);
  const today = localDateKey();
  const dailyGames = dailyGameIds(today).map(id => GAMES.find(game => game.id === id));
  return <main className="home">
    <header className="site-header"><div className="brand"><ColorDots/><b>ボタンゲーム</b></div><div className="header-actions"><button className="outline-action" onClick={() => setSettings(s => ({ ...s, sound: !s.sound }))}>{settings.sound ? '◖)) 音声 オン' : '音声 オフ'}</button><button className="outline-action" onClick={openSettings}>⚙ <span>接続・設定</span></button></div></header>
    <PwaStatus pwa={pwa}/>
    <section className="daily-today" aria-label="本日のゲーム"><div><h2>本日のゲーム</h2><p>{today}　3つのゲームで、300点に挑戦しよう。</p></div><div className="daily-list">{dailyGames.map((game, index) => <span key={game.id}>{index + 1}. {game.title}</span>)}</div><button className="daily-start" onClick={startDaily}>今日の3ゲームをはじめる <Arrow/></button></section>
    <button className="daily-record-link" onClick={openRecords}>これまでの記録を見る</button>
    <section className="hero"><h1>一緒に、ポンと楽しもう。</h1><p>好きなゲームを選んで、ボタンを押すだけ。</p></section>
    <section className="featured" aria-label="おすすめのあそび">{featured.map(game => <button key={game.id} className={`featured-card ${game.tone}`} onClick={() => openGame(game.id)}><span className="featured-icon"><Icon name={game.icon} size={150}/></span><strong>{game.id === 'rps' ? <><span className="title-word">あと出し</span><wbr/><span className="title-word">じゃんけん</span></> : game.title}</strong><span className="card-subtitle">{game.subtitle}</span><span className="card-bottom"><span>{game.meta}</span><span className="round-arrow"><Arrow/></span></span></button>)}</section>
    <section className="more-games"><h2>ほかのあそび</h2><div className="game-list">{rest.map(game => <button key={game.id} className="game-row" onClick={() => openGame(game.id)}><span className={`row-icon icon-${game.icon}`}><Icon name={game.icon} size={38}/></span><strong>{game.title}</strong><span className="row-meta">{game.meta}</span><span className="round-arrow"><Arrow/></span></button>)}</div></section><footer>画面のボタンでも遊べます。</footer>
  </main>;
}

export default function App() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('button-game-settings') || '{}');
      if (!localStorage.getItem('button-game-settings-v2')) {
        if (saved.rpsMode === 'win') saved.rpsMode = 'random';
        localStorage.setItem('button-game-settings-v2', '1');
      }
      return { ...DEFAULT_SETTINGS, ...saved };
    } catch { return DEFAULT_SETTINGS; }
  });
  const [setup, setSetup] = useState(false);
  const [selected, setSelected] = useState(null);
  const [state, setState] = useState(null);
  const [testSignal, setTestSignal] = useState(null);
  const [history, setHistory] = useState(() => readHistory());
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [dashboardRecord, setDashboardRecord] = useState(null);
  const [dashboardSaveFailed, setDashboardSaveFailed] = useState(false);
  const [dailySession, setDailySessionState] = useState(null);
  const pwa = usePwa();
  const stateRef = useRef(null);
  const selectedRef = useRef(null);
  const nextRef = useRef(null);
  const dailyRef = useRef(null);
  const timers = useRef([]);
  const tenGeneration = useRef(0);
  const room = (settings.room || 'main').trim() || 'main';
  const controllerMode = new URLSearchParams(location.search).get('controller') === '1';
  useEffect(() => { try { localStorage.setItem('button-game-settings', JSON.stringify(settings)); } catch {} if (!settings.sound) stopAudio(); }, [settings]);
  const setGameState = useCallback(updater => { const next = typeof updater === 'function' ? updater(stateRef.current) : updater; stateRef.current = next; setState(next); }, []);
  const setDailySession = useCallback(updater => { const next = typeof updater === 'function' ? updater(dailyRef.current) : updater; dailyRef.current = next; setDailySessionState(next); }, []);
  const schedule = (fn, ms) => { const timer = setTimeout(fn, ms); timers.current.push(timer); return timer; };
  const clearTimers = () => { tenGeneration.current++; timers.current.forEach(clearTimeout); timers.current = []; stopAudio(); };
  useEffect(() => () => clearTimers(), []);
  const sound = useCallback((kind = 'good') => { if (!settings.sound) return; unlockAudio(); beep(kind === 'good' ? 660 : 330, 0.17); }, [settings.sound]);
  const completeDailyGame = useCallback((id, rawScore) => {
    const session = dailyRef.current;
    if (!session || session.gameIds[session.position] !== id || session.games.length !== session.position) return;
    const entry = { id, score: normalizeGameScore(id, rawScore), durationMs: Math.max(0, Date.now() - (session.gameStartedAt || session.startedAt)) };
    const updated = { ...session, games: [...session.games, entry] };
    if (updated.games.length === 3) {
      const completedAt = Date.now();
      const record = { id: session.id, date: session.date, difficulty: session.difficulty, games: updated.games, total: updated.games.reduce((sum, game) => sum + game.score, 0), startedAt: session.startedAt, completedAt };
      const saved = appendHistory(record);
      setHistory(saved.records);
      setDashboardRecord(record);
      setDashboardSaveFailed(!saved.saved);
      updated.record = record;
    }
    setDailySession(updated);
  }, [setDailySession]);
  const finish = useCallback((title, detail, points = 0) => {
    clearTimers();
    sound(points > 0 ? 'good' : 'soft');
    const automatic = AUTO_GAMES.has(selectedRef.current);
    setGameState(s => ({ ...s, phase: 'feedback', active: false, feedback: { title, detail, points }, feedbackRemaining: automatic ? 3 : null, score: selectedRef.current === 'team' ? Math.max(s.score, points) : s.score + points }));
    if (automatic) {
      const until = performance.now() + 3000;
      const tick = setInterval(() => setGameState(s => s?.phase === 'feedback' ? ({ ...s, feedbackRemaining: Math.max(0, Math.ceil((until - performance.now()) / 1000)) }) : s), 200);
      timers.current.push(tick);
      schedule(() => { if (stateRef.current?.phase === 'feedback') nextRef.current?.(); }, 3000);
    }
  }, [sound, setGameState]);
  const beginTenMeasurement = useCallback(generation => {
    if (generation !== tenGeneration.current || selectedRef.current !== 'ten' || stateRef.current?.phase !== 'preparing') return;
    const startAt = performance.now();
    const difficulty = dailyRef.current?.difficulty || settings.pace;
    setGameState(s => ({ ...s, phase: 'play', active: true, startAt, prepCount: null, tenCards: createTenDistractors(difficulty) }));
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      const changeCard = () => {
        if (generation !== tenGeneration.current || stateRef.current?.phase !== 'play') return;
        setGameState(s => ({ ...s, tenCards: changeTenDistractor(s.tenCards) }));
        schedule(changeCard, 650 + Math.random() * 1550);
      };
      schedule(changeCard, 800 + Math.random() * 1100);
    }
    schedule(() => { if (generation === tenGeneration.current && stateRef.current?.phase === 'play') finish('じっくり数えたね', '20秒たったので、次へ進もう。'); }, 20000);
  }, [finish, setGameState, settings.pace]);
  const startTenVisual = useCallback(() => {
    if (selectedRef.current !== 'ten' || stateRef.current?.phase !== 'preparing') return;
    clearTimers();
    const generation = tenGeneration.current;
    setGameState(s => ({ ...s, prepCount: 3, showTenFallback: false }));
    schedule(() => { if (generation === tenGeneration.current && stateRef.current?.phase === 'preparing') setGameState(s => ({ ...s, prepCount: 2 })); }, 450);
    schedule(() => { if (generation === tenGeneration.current && stateRef.current?.phase === 'preparing') setGameState(s => ({ ...s, prepCount: 1 })); }, 900);
    schedule(() => beginTenMeasurement(generation), 1350);
  }, [beginTenMeasurement, setGameState]);
  const beginRound = useCallback((id, index, previous = {}, reuseRound = false) => {
    clearTimers();
    window.scrollTo(0, 0);
    const difficulty = dailyRef.current?.difficulty || settings.pace;
    if (index === 0 && !reuseRound && dailyRef.current?.gameIds[dailyRef.current.position] === id) setDailySession(session => ({ ...session, gameStartedAt: Date.now() }));
    const round = reuseRound ? { ...previous, count: 0, currentItems: [], feint: false } : newRound(id, { index, difficulty, rpsMode: settings.rpsMode, usedKinds: stateRef.current?.usedKinds || [], usedDirections: stateRef.current?.usedDirections || [], ...(id === 'memory' ? { previousSequence: previous.sequence } : {}), ...(id === 'quiz' ? { question: stateRef.current?.quizOrder?.[index] ?? index % QUIZ.length } : {}) });
    if (id === 'quiz' && !reuseRound) round.options = shuffle(QUIZ[round.question].answers);
    const phase = id === 'memory' ? 'watch' : id === 'ten' ? 'preparing' : 'play';
    setGameState(s => ({ ...s, phase, index, round, active: false, startAt: null, prepCount: null, showTenFallback: false, tenCards: [], cueAt: null, presses: [], watchIndex: id === 'memory' ? 0 : -1, inputIndex: 0, feedback: null, feedbackRemaining: null, redIndex: 0, redPressedIndices: [], redPoints: 0, redCue: null, redRemainingMs: id === 'red' ? round.sequence?.reduce((sum, item) => sum + item.durationMs, 0) : null, score: id === 'red' && reuseRound ? 0 : s.score, usedKinds: id === 'bigger' && !reuseRound ? [...(s.usedKinds || []), round.comparison?.kind].filter(Boolean) : s.usedKinds, usedDirections: id === 'bigger' && !reuseRound ? [...(s.usedDirections || []), round.comparison?.direction].filter(Boolean) : s.usedDirections }));
    const pace = difficulty === 'slow' ? 1.55 : difficulty === 'challenge' ? .72 : 1;
    if (id === 'ten') {
      const generation = tenGeneration.current;
      if (settings.sound) {
        const fallbackAt = performance.now() + 30000;
        speak('動く数字に惑わされず、10秒と思ったら押してね。用意、スタート', { onEnd: () => beginTenMeasurement(generation), onError: () => { if (generation === tenGeneration.current) startTenVisual(); } });
        const checkSpeech = () => {
          if (generation !== tenGeneration.current || stateRef.current?.phase !== 'preparing') return;
          if (performance.now() >= fallbackAt) { startTenVisual(); return; }
          if (typeof speechSynthesis !== 'undefined' && (speechSynthesis.speaking || speechSynthesis.pending)) {
            setGameState(s => ({ ...s, showTenFallback: true }));
            schedule(checkSpeech, 1000);
          } else startTenVisual();
        };
        schedule(checkSpeech, 9000);
      } else startTenVisual();
    }
    if (settings.sound && id !== 'sound' && id !== 'ten') { const prompt = id === 'rps' ? `相手は${RPS[round.opponent]}。${round.instruction}` : id === 'quiz' ? QUIZ[round.question].q : id === 'team' ? 'メーターが真ん中に来たら押してね' : id === 'count' ? `${round.item}だけ${round.targetCount || 5}個になったら押してね` : id === 'red' ? '左右が同じ色なら押してね' : id === 'bigger' ? round.comparison?.prompt || 'くらべて選んでね' : null; if (prompt) schedule(() => speak(prompt), 100); }
    if (id === 'light') {
      const feints = round.feintCount ?? 1;
      for (let i = 0; i < feints; i++) {
        const at = round.delay * pace * (.25 + i * .45 / feints);
        schedule(() => setGameState(s => ({ ...s, round: { ...s.round, feint: true } })), at);
        schedule(() => setGameState(s => ({ ...s, round: { ...s.round, feint: false } })), at + 190 * pace);
      }
      schedule(() => { const cueAt = performance.now(); setGameState(s => ({ ...s, active: true, cueAt })); if (settings.sound) beep(710); schedule(() => finish('次もやってみよう', '合図に間に合わなくても大丈夫。'), 3600 * pace); }, round.delay * pace);
    }
    if (id === 'sound') { if (settings.sound) { unlockAudio(); startMelody(); } schedule(() => { stopAudio(); const cueAt = performance.now(); setGameState(s => ({ ...s, active: true, cueAt })); schedule(() => finish('次もやってみよう', '音が止まったら押してね。'), 3600 * pace); }, round.delay * pace); }
    if (id === 'team') schedule(() => { const startAt = Date.now(); setGameState(s => ({ ...s, active: true, startAt })); const ticker = setInterval(() => setGameState(s => s?.phase === 'play' && s.active ? ({ ...s, meterPosition: (Math.sin((Date.now() - startAt) / 650) + 1) / 2 }) : s), 40); timers.current.push(ticker); if (settings.sound) beep(700); schedule(() => finish('いいチーム！', 'また中央をねらってみよう。'), 6000 * pace); }, 1200 * pace);
    if (id === 'count') {
      const base = difficulty === 'slow' ? 1200 : difficulty === 'challenge' ? 630 : 880;
      let elapsed = 0;
      for (let i = 0; i < round.steps.length; i++) {
        const step = round.steps[i];
        elapsed += base + [-80, 90, -30, 120, -70, 70, 0, 100, -50][i % 9];
        schedule(() => {
          setGameState(s => ({ ...s, round: { ...s.round, count: step.targetCount, currentItems: step.items, stepIndex: i } }));
          if (i === round.steps.length - 1) schedule(() => finish('いい挑戦！', `${round.targetCount}個になったら押してみよう。`), 350);
        }, elapsed);
      }
    }
    if (id === 'red') {
      const totalMs = round.sequence.reduce((sum, item) => sum + item.durationMs, 0);
      const startedAt = performance.now();
      let elapsed = 0;
      round.sequence.forEach((stimulus, i) => { schedule(() => setGameState(s => ({ ...s, redIndex: i, redCue: null })), elapsed); elapsed += stimulus.durationMs; });
      const ticker = setInterval(() => setGameState(s => s?.phase === 'play' ? ({ ...s, redRemainingMs: Math.max(0, totalMs - (performance.now() - startedAt)) }) : s), 150);
      timers.current.push(ticker);
      schedule(() => { const result = redScore(round.sequence, stateRef.current?.redPressedIndices || []); clearTimers(); setGameState(s => ({ ...s, phase: 'summary', active: false, score: result.points, redResult: result, redRemainingMs: 0 })); completeDailyGame('red', result.points); }, totalMs);
    }
    if (id === 'memory') round.sequence.forEach((_, i) => schedule(() => { setGameState(s => ({ ...s, watchIndex: i })); if (settings.sound) beep(350 + round.sequence[i] * 100); }, i * 900 * pace));
    if (id === 'memory') schedule(() => setGameState(s => ({ ...s, phase: 'play', watchIndex: -1 })), round.sequence.length * 900 * pace);
    if (['rps', 'quiz', 'bigger', 'memory'].includes(id)) schedule(() => finish('ゆっくりで大丈夫', '次の問題に進もう。'), (TIMEOUT[id] || 15000) * pace + (id === 'memory' ? round.sequence.length * 1100 * pace : 0));
  }, [finish, setGameState, setDailySession, completeDailyGame, beginTenMeasurement, startTenVisual, settings.pace, settings.sound, settings.rpsMode]);
  const start = useCallback(() => { const id = selectedRef.current; if (!id) return; unlockAudio(); beginRound(id, 0); }, [beginRound]);
  const next = useCallback(() => { const s = stateRef.current; const id = selectedRef.current; if (!s || !id) return; const total = id === 'red' ? 1 : getTotalRounds(id); window.scrollTo(0, 0); if (s.index + 1 >= total) { clearTimers(); setGameState(x => ({ ...x, phase: 'summary' })); completeDailyGame(id, s.score); } else beginRound(id, s.index + 1, s.round); }, [beginRound, setGameState, completeDailyGame]);
  nextRef.current = next;
  const restart = useCallback(() => { clearTimers(); window.scrollTo(0, 0); setGameState(s => ({ ...s, phase: 'intro', index: 0, score: 0, round: {}, feedback: null, active: false, presses: [], usedKinds: [], usedDirections: [], quizOrder: quizOrder(s.quizOrder, dailyRef.current?.difficulty || settings.pace) })); }, [setGameState, settings.pace]);
  const replay = useCallback(() => { const id = selectedRef.current; if (!id) return; clearTimers(); window.scrollTo(0, 0); setGameState(s => ({ ...s, phase: 'intro', index: 0, score: 0, round: {}, feedback: null, active: false, presses: [], usedKinds: [], usedDirections: [], quizOrder: quizOrder(s.quizOrder, settings.pace) })); beginRound(id, 0); }, [beginRound, setGameState, settings.pace]);
  const openGame = useCallback(id => { clearTimers(); window.scrollTo(0, 0); unlockAudio(); selectedRef.current = id; setSelected(id); setGameState({ phase: 'intro', index: 0, score: 0, round: {}, feedback: null, active: false, presses: [], usedKinds: [], usedDirections: [], quizOrder: quizOrder([], dailyRef.current?.difficulty || settings.pace) }); if (settings.sound) speak(id === 'ten' ? '動く数字に惑わされず、10秒と思ったら押してね。' : GAMES.find(g => g.id === id)?.guide || ''); }, [setGameState, settings.sound, settings.pace]);
  const startDaily = useCallback(() => { const date = localDateKey(); const gameIds = dailyGameIds(date); const session = { id: `${date}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, date, difficulty: settings.pace, gameIds, position: 0, games: [], startedAt: Date.now(), gameStartedAt: null }; setDailySession(session); setDashboardRecord(null); setDashboardSaveFailed(false); setDashboardOpen(false); openGame(gameIds[0]); }, [openGame, setDailySession, settings.pace]);
  const openIndividualGame = useCallback(id => { setDailySession(null); setDashboardRecord(null); openGame(id); }, [openGame, setDailySession]);
  const back = useCallback(() => { clearTimers(); window.scrollTo(0, 0); selectedRef.current = null; setSelected(null); setGameState(null); setDailySession(null); }, [setGameState, setDailySession]);
  const nextDailyGame = useCallback(() => { const session = dailyRef.current; if (!session || session.games.length !== session.position + 1) return; if (session.position === 2) { clearTimers(); selectedRef.current = null; setSelected(null); setGameState(null); setDashboardOpen(true); setDashboardRecord(session.record || null); setDailySession(null); window.scrollTo(0, 0); return; } const nextPosition = session.position + 1; setDailySession({ ...session, position: nextPosition, gameStartedAt: null }); openGame(session.gameIds[nextPosition]); }, [openGame, setDailySession, setGameState]);
  const closeDashboard = useCallback(() => { setDashboardOpen(false); setDashboardRecord(null); window.scrollTo(0, 0); }, []);
  const resume = useCallback(() => { const s = stateRef.current; if (s?.phase !== 'paused') return; if (s.pausedFrom === 'feedback') next(); else beginRound(selectedRef.current, s.index, s.round, true); }, [next, beginRound]);
  const press = useCallback((button, event = {}) => {
    if (setup && !controllerMode) { setTestSignal(button); return; }
    const s = stateRef.current; const id = selectedRef.current;
    if (!s || !id) return;
    unlockAudio();
    if (s.phase === 'intro') { start(); return; }
    if (s.phase === 'feedback') { if (!AUTO_GAMES.has(id)) next(); return; }
    if (s.phase === 'summary') { if (dailyRef.current) nextDailyGame(); else replay(); return; }
    if (s.phase === 'paused') { resume(); return; }
    if (s.phase !== 'play') return;
    if (id === 'ten') { const grade = tenGrade(performance.now() - s.startAt); finish(grade.phrase, `${grade.seconds}秒！ 10秒との差は ${grade.difference}秒。`, grade.points); return; }
    if (id === 'rps') { if (button > 2) return; const right = rpsResult(s.round.opponent, s.round.instruction, button); finish(right ? '大正解！' : '次も楽しもう', `答えは ${RPS[rpsAnswer(s.round.opponent, s.round.instruction)]}。`, right ? 20 : 0); return; }
    if (id === 'team') { if (!s.active || button >= settings.players || s.presses.some(x => x.button === button)) return; const at = Date.now(); const position = (Math.sin((at - s.startAt) / 650) + 1) / 2; const presses = [...s.presses, { button, at, position }]; if (presses.length >= settings.players) { const result = teamScore(presses, settings.players); finish(result.points === 100 ? '100点！ ぴったり！' : result.points >= 92 ? 'すごいチーム！' : 'みんなで100点に挑戦！', '中央に近いほど高得点。', result.points); } else setGameState(x => ({ ...x, presses })); return; }
    if (id === 'light' || id === 'sound') { if (!s.active || s.cueAt == null) { finish(id === 'light' ? 'おっと、まだだったね' : 'おっと、まだ音が鳴っていたね', '合図を待ってみよう。'); return; } const difficulty = dailyRef.current?.difficulty || settings.pace; const grade = reactionGrade(performance.now() - s.cueAt, 3600 * (difficulty === 'slow' ? 1.55 : difficulty === 'challenge' ? .72 : 1)); finish(grade.phrase, `合図から ${grade.seconds}秒！`, grade.points); return; }
    if (id === 'quiz') { if (button > 2) return; const question = QUIZ[s.round.question]; const answer = s.round.options[button]; const correct = question.answers[question.correct]; const right = answer === correct; finish(right ? 'よく知ってるね！' : 'なるほど、そうなんだ', `答えは「${correct}」。${question.explanation || ''}`, right ? 20 : 0); return; }
    if (id === 'red') { const stimulus = s.round.sequence?.[s.redIndex]; if (!stimulus || s.redPressedIndices.includes(s.redIndex)) return; const redPressedIndices = [...s.redPressedIndices, s.redIndex]; const result = redScore(s.round.sequence, redPressedIndices); setGameState(x => ({ ...x, redPressedIndices, redPoints: result.points, redCue: stimulus.left === stimulus.right ? 'そろった！' : 'ちがう色だよ' })); return; }
    if (id === 'count') { const target = s.round.targetCount || 5; const right = s.round.count === target; finish(right ? `${target}個を見つけたね！` : 'もう一度数えてみよう', `押したときは ${s.round.count}個だったよ。`, right ? 16 : 0); return; }
    if (id === 'bigger') { if (button > 1) return; const comparison = s.round.comparison; const right = button === (comparison?.correctIndex ?? (s.round.left > s.round.right ? 0 : 1)); finish(right ? 'そのとおり！' : '次も見てみよう', comparison?.explanation || `${Math.max(s.round.left, s.round.right)} のほうが大きいよ。`, right ? 20 : 0); return; }
    if (id === 'memory') { const right = button === s.round.sequence[s.inputIndex]; if (!right) { finish('いい挑戦！', `順番は ${s.round.sequence.map(i => COLORS[i].name).join(' → ')}。`); return; } if (s.inputIndex + 1 === s.round.sequence.length) { finish('全部おぼえたね！', `${s.round.sequence.length}色の順番、ばっちり。`, 25); } else setGameState(x => ({ ...x, inputIndex: x.inputIndex + 1 })); }
  }, [setup, controllerMode, start, next, replay, nextDailyGame, resume, finish, settings.players, settings.pace, setGameState]);
  const connection = useConnection('display', room, press, !controllerMode);
  const controllerUrl = connection.mode === 'wifi' && connection.status === '接続済み' ? controllerLink(connection.serverInfo, room) : null;
  useKeyboard(press);
  useEffect(() => { function pause() { const phase = stateRef.current?.phase; if (phase && !['intro', 'summary', 'paused'].includes(phase)) { clearTimers(); setGameState(s => ({ ...s, phase: 'paused', pausedFrom: phase, active: false })); } } function visibility() { if (document.hidden) pause(); } document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', pause); return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pause); }; }, [setGameState]);
  if (controllerMode) return <Controller room={new URLSearchParams(location.search).get('room') || room} settings={settings}/>;
  const game = GAMES.find(x => x.id === selected);
  return <>{dashboardOpen ? <DailyDashboard current={dashboardRecord} records={history} initialDifficulty={settings.pace} saveFailed={dashboardSaveFailed} onBack={closeDashboard}/> : game && state ? <GameDisplay game={game} state={state} settings={settings} press={press} start={start} next={next} resume={resume} startVisualTen={startTenVisual} replay={replay} back={back} restart={restart} daily={dailySession} onDailyNext={nextDailyGame} normalizedScore={normalizeGameScore(game.id, state.score)}/> : <Home openGame={openIndividualGame} startDaily={startDaily} openRecords={() => { setHistory(readHistory()); setDashboardOpen(true); setDashboardRecord(null); setDashboardSaveFailed(false); window.scrollTo(0, 0); }} openSettings={() => setSetup(true)} settings={settings} setSettings={setSettings} pwa={pwa}/ >}{setup && <Setup settings={settings} setSettings={setSettings} close={() => setSetup(false)} connection={connection} controllerUrl={controllerUrl} pwa={pwa} testButton={setTestSignal} testSignal={testSignal}/>}</>;
}
