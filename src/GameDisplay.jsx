import React from 'react';
import { COLORS, QUIZ } from './gameData.js';
import NatureArt from './NatureArt.jsx';

const HANDS = ['グー', 'チョキ', 'パー'];
const HAND_EMOJI = ['✊', '✌️', '✋'];
const SINGLE_BUTTON_GAMES = new Set(['ten', 'light', 'sound', 'red', 'count']);
const INLINE_CHOICES = new Set(['rps', 'quiz', 'bigger']);

function Arrow() {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>;
}
function ColorDots() {
  return <span className="brand-dots" aria-hidden="true">{COLORS.map((color, index) => <i key={index} style={{ background: color.hex }}/>)}</span>;
}
function ClockIcon() {
  return <svg width="150" height="150" viewBox="0 0 100 100" fill="none" aria-hidden="true"><circle cx="50" cy="50" r="39" stroke="currentColor" strokeWidth="4"/><path d="M50 15v7M50 78v7M15 50h7M78 50h7" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><text x="50" y="62" fill="currentColor" textAnchor="middle" fontSize="31" fontWeight="800">10</text></svg>;
}
function PhysicalChoice({ button, title, visual, onClick }) {
  const color = COLORS[button];
  return <button className="answer-card" onClick={() => onClick(button)} style={{ '--answer-color': color.hex }}>
    <span className="answer-content">{visual}{title}</span>
    <span className="choice-color-name">{color.name}ボタン</span>
  </button>;
}
function ComparisonVisual({ visual }) {
  if (!visual) return null;
  if (visual.type === 'bar') return <svg className="comparison-bar" viewBox="0 0 240 82" role="img" aria-label="長さを示す棒"><rect x="10" y="21" width={Math.max(20, 220 * (visual.widthPercent || 0) / 100)} height="40" rx="10" fill="#71ba83" stroke="#203d35" strokeWidth="4"/></svg>;
  if (visual.type === 'number') return <strong className="comparison-number">{visual.value}</strong>;
  const label = String(visual.value);
  const timeParts = label.match(/^(.+?から)(.+)$/);
  return <strong className={`comparison-text ${label.length >= 11 ? 'long' : ''}`}>{timeParts ? <><span className="comparison-chunk">{timeParts[1]}</span><span className="comparison-chunk">{timeParts[2]}</span></> : label}</strong>;
}
function TenScene({ cards }) {
  return <div className="ten-scene" aria-hidden="true">{cards.map(card => <span key={card.id} className={`ten-float ten-tone-${card.tone}`} style={{ '--x': `${card.x}%`, '--y': `${card.y}%`, '--size': `${card.size}px`, '--font-size': `${Math.round(card.size * .45)}px`, '--drift-x': `${card.driftX}px`, '--drift-y': `${card.driftY}px`, '--float-duration': `${card.duration}s` }}>{card.value}</span>)}</div>;
}
function ChoicePanel({ game, round, press, zoomStage = 0 }) {
  if (game.id === 'rps') return <div className="answer-grid three">{HANDS.map((hand, i) => <PhysicalChoice key={i} button={i} title={<span className="answer-title">{hand}</span>} visual={<span className="hand-choice" aria-hidden="true">{HAND_EMOJI[i]}</span>} onClick={press}/>)}</div>;
  if (game.id === 'quiz') return <div className="answer-grid two nature-grid">{round.options?.map((option, i) => <button key={`${option.assetId}-${i}`} className={`answer-card nature-answer zoom-stage-${zoomStage}`} style={{ '--answer-color': COLORS[i].hex }} aria-label={`${i === 0 ? '左' : '右'}の絵、${COLORS[i].name}ボタン`} onClick={() => press(i)}><span className="nature-window"><NatureArt assetId={option.assetId}/></span><span className="choice-color-name">{i === 0 ? '左' : '右'}・{COLORS[i].name}ボタン</span></button>)}</div>;
  if (game.id === 'bigger') return <div className="answer-grid two">{(round.comparison?.choices || []).map((choice, i) => <PhysicalChoice key={i} button={i} title={choice.visual?.type === 'bar' ? <span className="answer-title">{choice.label}</span> : null} visual={<ComparisonVisual visual={choice.visual}/>} onClick={press}/>)}</div>;
  return null;
}
function BottomButton({ button, label, onClick, disabled, selected }) {
  const color = COLORS[button];
  return <button className={`color-button ${selected ? 'selected' : ''}`} style={{ '--button-color': color.hex }} onClick={onClick} disabled={disabled} aria-label={label}><span className="color-button-face"/><span className="color-button-label">{label}</span></button>;
}

export default function GameDisplay({ game, state, settings, press, start, next, resume, startVisualTen, replay, back, restart, daily, onDailyNext, normalizedScore }) {
  const { phase, round, index, score, feedback, active, presses = [], watchIndex = -1, inputIndex = 0 } = state;
  const total = game.id === 'red' ? 24 : game.id === 'count' ? 6 : game.id === 'memory' ? 4 : ['ten', 'team'].includes(game.id) ? 3 : 5;
  const targetCount = round.targetCount || 5;
  const isPlaying = phase === 'play';
  const hasInlineChoices = isPlaying && INLINE_CHOICES.has(game.id);
  const automaticFeedback = phase === 'feedback' && state.feedbackRemaining != null;
  const redStimulus = round.sequence?.[state.redIndex || 0];
  let prompt = '', detail = '', badge = '';

  if (phase === 'intro') {
    prompt = game.id === 'ten' ? '心の中で、10秒。' : game.title;
    detail = game.id === 'ten' ? '動く数字に惑わされず、10秒と思ったら押してね。' : game.id === 'team' ? `${settings.players}人で遊びます。赤から順に一人ずつ色を担当してね。` : game.guide;
  } else if (phase === 'countdown') {
    prompt = <span className="countdown-number">{state.countdown}</span>;
    detail = game.id === 'ten' ? '「1」の次から、心の中で10秒を数えてね。' : 'もうすぐ始まるよ。ボタンはまだ押さないでね。';
  } else if (phase === 'preparing') {
    prompt = state.prepCount ? String(state.prepCount) : '説明をきいてね';
    detail = '説明が終わると、3・2・1の合図が出ます。';
  } else if (phase === 'paused') {
    prompt = '一時停止中';
    detail = state.pausedFrom === 'feedback' ? 'つづけると、次のお題に進みます。' : game.id === 'red' ? 'つづけると、このゲームを最初から始めます。' : 'つづけると、今の問題を準備から始めます。';
  } else if (phase === 'play' || phase === 'watch') {
    switch (game.id) {
      case 'ten': prompt = <><span className="ten-prompt-part">10秒だと思ったら、</span><span className="ten-prompt-part">ポン！</span></>; detail = '数字は時間と関係ありません。'; break;
      case 'rps': prompt = `${round.instruction}！`; detail = `相手は「${HANDS[round.opponent]}」`; break;
      case 'team': prompt = active ? '真ん中で、ポン！' : '合図を待ってね…'; detail = `${presses.length} / ${settings.players} 人が押しました`; badge = `一人25点、合計を100点に換算　${COLORS.slice(0, settings.players).map((color, i) => `${i + 1}人目：${color.name}`).join('　')}`; break;
      case 'light': prompt = active ? 'いまだ！' : round.feint ? 'まだだよ…' : 'よーく見て…'; detail = active ? 'どのボタンでも押そう' : '本当の合図を待ってね。'; break;
      case 'sound': prompt = active ? '音が止まった！' : '音をきいてね…'; detail = active ? '今、押そう！' : '画面にも合図が出ます。'; break;
      case 'quiz': prompt = QUIZ[round.question]?.q || ''; detail = ['よく見てね。少しずつ全体が見えます。', '少し見えてきたよ。', '全体を見て選ぼう。'][state.zoomStage || 0]; break;
      case 'red': prompt = '同じ色なら、ポン！'; detail = ''; break;
      case 'count': prompt = `${round.item}だけ数えよう`; detail = `${targetCount}個になったらポン！`; break;
      case 'bigger': prompt = round.comparison?.prompt || 'くらべて選ぼう！'; detail = '左は赤、右は青。'; break;
      case 'memory': prompt = phase === 'watch' ? '順番を覚えてね' : '順番どおりに押してね'; detail = phase === 'watch' ? `${watchIndex + 1} / ${round.sequence.length} 個目` : `${inputIndex + 1} / ${round.sequence.length} 個目`; break;
    }
  } else if (phase === 'feedback') {
    prompt = feedback?.title || 'いいね！'; detail = feedback?.detail || '';
  } else if (phase === 'summary') {
    prompt = game.id === 'team' ? score === 100 ? '100点、ぴったり！' : score >= 98 ? '金のチーム！' : score >= 92 ? '銀のチーム！' : 'みんなで遊べたね！' : 'おつかれさま！';
    detail = game.id === 'ten' ? '何度でも、心の時計に挑戦してね。' : game.id === 'team' ? '3回のうち、いちばん高い点数です。100点を目指そう！' : game.id === 'red' ? `同じ色で押せた回数 ${state.redResult?.matchHits || 0} / ${state.redResult?.matchCount || 0}、ちがう色で押した回数 ${state.redResult?.falsePresses || 0}。` : daily ? 'このゲームは100点満点に換算しました。' : `${total}回のあそびが終わりました。`;
  }

  return <main className="play-page">
    <header className="play-header"><button className="back-button" onClick={back}>← あそびを選ぶ</button><div className="brand"><ColorDots/><b>ボタンゲーム</b></div>{!(daily && phase === 'summary') && <button className="text-control" onClick={restart}>やり直し</button>}</header>
    <div className="play-top"><span className="game-name">{game.title}{daily && <small className="daily-step-label">本日の {daily.position + 1} / 3 ゲーム</small>}</span><span className="round-count">{phase === 'summary' ? 'おしまい' : game.id === 'red' ? `${(state.redIndex || 0) + 1} / 24 色` : `${index + 1} / ${total} 回`}</span></div>
    <section className={`play-stage ${phase} tone-${game.tone} ${hasInlineChoices ? 'choice-stage' : ''} ${game.id === 'red' ? 'red-stage' : ''} ${game.id === 'ten' ? 'ten-stage' : ''} ${game.id === 'count' ? 'count-stage' : ''}`} aria-live="polite"><div className="stage-main">
      {game.id === 'ten' && phase === 'intro' && <div className="intro-clock"><ClockIcon/></div>}
      {game.id === 'ten' && isPlaying && <TenScene cards={state.tenCards || []}/>}
      {game.id === 'light' && isPlaying && (active || round.feint) && <span className={`stage-color ${round.feint && !active ? 'feint' : ''}`} style={{ background: active ? '#39b463' : '#f0b82c' }}/ >}
      {game.id === 'red' && isPlaying && <><div className="red-pair" aria-label={`左は${COLORS[redStimulus?.left || 0].name}、右は${COLORS[redStimulus?.right || 0].name}`}><div className="red-side"><span className="red-circle" style={{ background: COLORS[redStimulus?.left || 0].hex }}/><span>左・{COLORS[redStimulus?.left || 0].name}</span></div><div className="red-side"><span className="red-circle" style={{ background: COLORS[redStimulus?.right || 0].hex }}/><span>右・{COLORS[redStimulus?.right || 0].name}</span></div></div><div className="red-status"><span>残り {Math.ceil((state.redRemainingMs || 0) / 1000)}秒</span><span>いま {state.redPoints || 0}点</span></div>{state.redCue && <div className="red-cue">{state.redCue}</div>}</>}
      {game.id === 'memory' && phase === 'watch' && watchIndex >= 0 && <span className="stage-color" style={{ background: COLORS[round.sequence[watchIndex]].hex }}/ >}
      {game.id === 'count' && isPlaying && <><div className="target-sample"><span>{round.targetEmoji}</span><b>これだけ数えてね</b></div><div className="count-items mixed" aria-label={`${round.item}が${round.count}個`}>{round.currentItems?.map(item => <span key={item.id} aria-label={item.kind === 'target' ? round.item : '別のもの'}>{item.emoji}</span>)}</div></>}
      {game.id === 'rps' && isPlaying && <span className="rps-symbol">{HAND_EMOJI[round.opponent]}</span>}
      {game.id === 'team' && isPlaying && <div className="team-meter"><span className="meter-mid"/><span className="meter-cursor" style={{ left: `${(state.meterPosition ?? 0) * 100}%` }}/>{presses.map(hit => <span key={hit.button} className="meter-hit" style={{ left: `${hit.position * 100}%`, background: COLORS[hit.button].hex }}/>)}</div>}
      {phase === 'summary' && <div className="summary-score">{daily ? normalizedScore : score}<small>{daily ? ' / 100点' : 'ポイント'}</small></div>}
      <h1>{prompt}</h1><p>{detail}</p>
      {badge && <div className="instruction-badge">{badge}</div>}
      {hasInlineChoices && <ChoicePanel game={game} round={round} press={press} zoomStage={state.zoomStage}/>}
      {phase === 'feedback' && feedback?.points !== undefined && <div className="feedback-points">+{feedback.points} ポイント</div>}
    </div></section>
    <section className={`input-panel ${hasInlineChoices ? 'compact-input' : ''} ${game.id === 'red' ? 'red-input' : ''}`}>
      {phase === 'intro' || phase === 'summary' || phase === 'paused' || (phase === 'feedback' && !automaticFeedback) ? <>
        <div className="input-heading">{phase === 'intro' ? 'はじめる' : phase === 'summary' ? daily ? daily.position === 2 ? '本日の結果へ' : '次のゲームへ' : 'もう一回' : phase === 'paused' ? '準備ができたら' : '次へ進む'}</div>
        <button className="wide-action" onClick={phase === 'intro' ? start : phase === 'summary' ? daily ? onDailyNext : replay : phase === 'paused' ? resume : next}>{phase === 'intro' ? 'スタート' : phase === 'summary' ? daily ? daily.position === 2 ? '本日の結果へ' : '次のゲームへ' : 'もう一回あそぶ' : phase === 'paused' ? 'つづける' : index + 1 >= total ? '結果を見る' : game.id === 'ten' ? '次の10秒をはじめる' : '次の問題'} <Arrow/></button>
      </> : phase === 'countdown' ? <div className="watch-note">数字が終わってから押そう</div> : phase === 'preparing' ? <><div className="watch-note">計測前です。ボタンはまだ押さないでね。</div>{settings.sound && state.showTenFallback && !state.prepCount && <button className="small-action ten-visual-start" onClick={startVisualTen}>音声が終わらないときは画面の合図で始める</button>}</> : automaticFeedback ? <div className="auto-next" role="status">{index + 1 >= total ? '結果' : '次のお題'}まで {state.feedbackRemaining} 秒 <span className="auto-next-bar"/></div> : phase === 'watch' ? <div className="watch-note">光る順番を見よう</div> : hasInlineChoices ? <p className="input-note">選択肢か、同じ色の物理ボタンを押してください。</p> : SINGLE_BUTTON_GAMES.has(game.id) ? <><div className="input-heading">ボタンを押そう</div><button className="wide-action one-press" onClick={() => press(0)}>ポン！</button></> : <><div className="input-heading">色のボタンを押そう</div><div className="play-buttons">{COLORS.map((color, i) => <BottomButton key={i} button={i} label={color.name} onClick={() => press(i)} disabled={!isPlaying || (game.id === 'team' && i >= settings.players)} selected={game.id === 'team' && presses.some(hit => hit.button === i)}/>)}</div></>}
      {!hasInlineChoices && !['feedback','preparing','countdown'].includes(phase) && <p className="input-note">画面のボタンでも、つながったボタンでも遊べます。</p>}
    </section>
  </main>;
}
