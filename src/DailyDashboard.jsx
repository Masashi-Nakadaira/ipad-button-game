import React, { useState } from 'react';
import { GAMES } from './gameData.js';
import { previousRun, ranking, trend } from './daily.js';

const DIFFICULTIES = { slow: 'やさしい', normal: 'ふつう', challenge: '挑戦' };
const names = Object.fromEntries(GAMES.map(game => [game.id, game.title]));

export default function DailyDashboard({ current, records, initialDifficulty, saveFailed = false, onBack }) {
  const [difficulty, setDifficulty] = useState(current?.difficulty || initialDifficulty);
  const ranks = ranking(records, difficulty).slice(0, 10);
  const days = trend(records, difficulty, 21);
  const previous = current ? previousRun(records, current) : null;
  const delta = previous ? current.total - previous.total : null;
  const latest = records.filter(record => record.difficulty === difficulty).sort((a, b) => b.completedAt - a.completedAt)[0];

  return <main className="daily-results">
    <header className="play-header"><button className="back-button" onClick={onBack}>← ホームへ</button><h1>本日のゲーム</h1><span className="results-date">{current?.date || 'これまでの記録'}</span></header>
    {current ? <section className="daily-score-card" aria-label="本日の結果"><div className="daily-score-top"><span>{DIFFICULTIES[current.difficulty]} ／ 3ゲーム</span><strong>{current.total}<small> / 300点</small></strong></div><div className="daily-score-games">{current.games.map((entry, i) => <div key={entry.id}><span>{i + 1}. {names[entry.id]}</span><b>{entry.score} / 100</b></div>)}</div><p>{delta === null ? 'この難易度での最初の記録です。' : delta >= 0 ? `前回より +${delta}点` : `前回との差 ${delta}点`}</p></section> : latest ? <section className="daily-score-card compact"><span>この難易度の直近の記録</span><strong>{latest.total}<small> / 300点</small></strong><p>{latest.date}</p></section> : <section className="daily-score-card compact empty"><strong>まだ記録がありません</strong><p>本日の3ゲームを遊ぶと、ここに残ります。</p></section>}
    <div className="records-heading"><h2>記録を見る</h2><label>難易度 <select value={difficulty} onChange={event => setDifficulty(event.target.value)}><option value="slow">やさしい</option><option value="normal">ふつう</option><option value="challenge">挑戦</option></select></label></div>
    <div className="records-columns"><section className="records-panel"><h3>日別ベストランキング</h3>{ranks.length ? <ol className="rank-list">{ranks.map(record => <li key={record.date}><span>{record.date}</span><strong>{record.total}点</strong></li>)}</ol> : <p>この難易度の記録はまだありません。</p>}</section><section className="records-panel"><h3>日付順の推移</h3>{days.length ? <div className="trend-list">{days.map(record => <div className="trend-row" key={record.date}><time>{record.date.slice(5)}</time><span className="trend-track"><i style={{ width: `${record.total / 3}%` }}/></span><b>{record.total}</b></div>)}</div> : <p>3ゲームを遊ぶと推移が見られます。</p>}</section></div>
    <p className={`storage-note ${saveFailed ? 'save-error' : ''}`}>{saveFailed ? 'このブラウザーに記録を保存できませんでした。今回の結果は再読み込みすると消えます。' : '記録はこのブラウザーに保存されます。'}</p>
  </main>;
}
