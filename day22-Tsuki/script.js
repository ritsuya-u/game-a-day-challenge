'use strict';

// 画面セクションの参照
const screens = {
  title: document.getElementById('screen-title'),
  opening: document.getElementById('screen-opening'),
  play: document.getElementById('screen-play'),
  result: document.getElementById('screen-result')
};

const startBtn = document.getElementById('start-btn');
const retryBtn = document.getElementById('retry-btn');
const openingLine = document.getElementById('opening-line');
const resultWrap = document.querySelector('.result-wrap');
const replyEl = document.getElementById('reply');
const scoreEl = document.getElementById('score');

const drawCanvas = document.getElementById('draw-canvas');
const drawCtx = drawCanvas.getContext('2d');
const moonCanvas = document.getElementById('moon-canvas');
const moonCtx = moonCanvas.getContext('2d');

const openingLines = [
  '「今日は楽しかったね」',
  '「すっかり日が暮れちゃったね」',
  '「夜空をみてごらん」'
];

const commentTable = [
  { limit: 50, text: 'んなわけねぇだろ目ェ歪んでんのか' },
  { limit: 65, text: 'うーん、私はそう思わないな' },
  { limit: 80, text: 'そ、そうかな？まあ、きれい…かも？' },
  { limit: 95, text: 'きれいだね！これからもよろしくね！' },
  { limit: 100, text: '私も同じことを思っていました' }
];

const successThreshold = 80;

// プレイ中の入力状態
const state = {
  drawing: false,
  didDraw: false,
  points: []
};

function setScreen(target) {
  Object.values(screens).forEach((el) => el.classList.remove('is-active'));
  screens[target].classList.add('is-active');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setupCanvas() {
  // 高DPI端末でも線がぼやけないよう、内部解像度を調整
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const rect = drawCanvas.getBoundingClientRect();
  drawCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
  drawCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
  drawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';
  drawCtx.lineWidth = Math.max(8, Math.min(rect.width, rect.height) * 0.02);
  clearDrawCanvas();
}

function clearDrawCanvas() {
  drawCtx.clearRect(0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
}

function setupMoonCanvas() {
  // リザルト用の月キャンバスも同様に解像度調整
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const rect = moonCanvas.getBoundingClientRect();
  moonCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
  moonCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
  moonCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function getCanvasPoint(ev) {
  const rect = drawCanvas.getBoundingClientRect();
  return {
    x: ev.clientX - rect.left,
    y: ev.clientY - rect.top
  };
}

function beginDraw(ev) {
  if (!screens.play.classList.contains('is-active')) return;
  // 描き始めで前回データをクリア
  state.points = [];
  state.drawing = true;
  state.didDraw = false;
  drawCtx.clearRect(0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
  const p = getCanvasPoint(ev);
  state.points.push(p);
  state.didDraw = true;
  drawCtx.beginPath();
  drawCtx.moveTo(p.x, p.y);
}

function moveDraw(ev) {
  if (!state.drawing) return;
  // ポインタ移動ごとに点を記録し、軌跡をリアルタイム描画
  const p = getCanvasPoint(ev);
  state.points.push(p);
  drawCtx.strokeStyle = '#f8c304';
  drawCtx.lineTo(p.x, p.y);
  drawCtx.stroke();
}

function endDraw() {
  if (!state.drawing) return;
  state.drawing = false;
  if (state.points.length < 10) return;
  // 軌跡を閉じて塗りつぶし、少し待って判定へ
  fillDrawnShape(state.points);
  setTimeout(() => finalizeRound(), 800);
}

function fillDrawnShape(points) {
  drawCtx.save();
  drawCtx.globalAlpha = 0.28;
  drawCtx.fillStyle = '#f8c304';
  drawCtx.beginPath();
  drawCtx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    drawCtx.lineTo(points[i].x, points[i].y);
  }
  drawCtx.closePath();
  drawCtx.fill();
  drawCtx.restore();
}

function calcScore(points) {
  // 1) 点列の重心
  const n = points.length;
  const center = points.reduce(
    (acc, p) => ({ x: acc.x + p.x / n, y: acc.y + p.y / n }),
    { x: 0, y: 0 }
  );
  // 2) 重心から各点までの半径
  const radii = points.map((p) => Math.hypot(p.x - center.x, p.y - center.y));
  const meanRadius = radii.reduce((sum, r) => sum + r, 0) / n;
  if (meanRadius <= 0) return 0;
  // 3) 半径の標準偏差（ばらつき）
  const variance =
    radii.reduce((sum, r) => sum + (r - meanRadius) * (r - meanRadius), 0) / n;
  const stdDev = Math.sqrt(variance);
  // 4) ばらつきを 0..1 の円らしさへ変換
  const ratio = stdDev / meanRadius;
  const roundedness = Math.max(0, 1 - ratio * 1.5);
  // 5) 閉じ具合とサイズ妥当性で補正
  const closurePenalty = closureScore(points);
  const sizePenalty = sizeScore(points, meanRadius);
  const score = roundedness * closurePenalty * sizePenalty * 100;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function closureScore(points) {
  // 始点と終点が離れている線を減点
  const first = points[0];
  const last = points[points.length - 1];
  const endDistance = Math.hypot(last.x - first.x, last.y - first.y);
  const bbox = getBounds(points);
  const span = Math.max(1, Math.max(bbox.w, bbox.h));
  const normalized = Math.min(1, endDistance / span);
  return 1 - normalized * 0.55;
}

function sizeScore(points, meanRadius) {
  // 極端に小さい/大きい入力や細すぎる形を減点
  const bbox = getBounds(points);
  const minSize = Math.min(drawCanvas.clientWidth, drawCanvas.clientHeight);
  const target = minSize * 0.24;
  const dist = Math.abs(meanRadius - target) / target;
  const penalty = Math.min(0.3, dist * 0.25);
  const thinPenalty = bbox.w < 30 || bbox.h < 30 ? 0.35 : 0;
  return Math.max(0.45, 1 - penalty - thinPenalty);
}

function getBounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function getReply(score) {
  const matched = commentTable.find((row) => score <= row.limit);
  return matched ? matched.text : commentTable[commentTable.length - 1].text;
}

function renderMoon(points) {
  // 描いた軌跡をリザルト用キャンバス中央にスケーリング描画
  setupMoonCanvas();
  const w = moonCanvas.clientWidth;
  const h = moonCanvas.clientHeight;
  moonCtx.clearRect(0, 0, w, h);

  if (!points.length) return;
  const bounds = getBounds(points);
  const scale = Math.min((w * 0.82) / Math.max(1, bounds.w), (h * 0.82) / Math.max(1, bounds.h));
  const offsetX = (w - bounds.w * scale) / 2 - bounds.minX * scale;
  const offsetY = (h - bounds.h * scale) / 2 - bounds.minY * scale;

  moonCtx.beginPath();
  moonCtx.moveTo(points[0].x * scale + offsetX, points[0].y * scale + offsetY);
  for (let i = 1; i < points.length; i += 1) {
    moonCtx.lineTo(points[i].x * scale + offsetX, points[i].y * scale + offsetY);
  }
  moonCtx.closePath();
  moonCtx.fillStyle = '#f8c304';
  moonCtx.fill();
  moonCtx.lineWidth = 3;
  moonCtx.strokeStyle = '#d9a702';
  moonCtx.stroke();
}

function finalizeRound() {
  // 未入力ならダミー円を表示し、スコアは0扱い
  const hasStroke = state.didDraw && state.points.length >= 10;
  const judgedPoints = hasStroke ? state.points : buildFallbackMoon();
  const score = hasStroke ? calcScore(judgedPoints) : 0;
  const reply = getReply(score);

  setScreen('result');
  // 表示後に描画しないと、非表示時の 0x0 サイズを拾うことがある
  requestAnimationFrame(() => {
    renderMoon(judgedPoints);
  });
  replyEl.textContent = `「${reply}」`;
  scoreEl.textContent = `円の完成度：${score}%`;
  resultWrap.classList.remove('success');

  if (score >= successThreshold) {
    resultWrap.classList.add('success');
  }
}

async function runOpening() {
  // セリフを順番にフェード表示
  setScreen('opening');
  openingLine.textContent = '';
  openingLine.classList.remove('show');

  for (const line of openingLines) {
    openingLine.classList.remove('show');
    await sleep(220);
    openingLine.textContent = line;
    openingLine.classList.add('show');
    await sleep(1700);
  }

  openingLine.classList.remove('show');
  await sleep(420);
  startPlay();
}

function startPlay() {
  setScreen('play');
  // play表示後にキャンバスサイズを確定
  setupCanvas();
}

function resetGame() {
  state.points = [];
  state.drawing = false;
  state.didDraw = false;
  resultWrap.classList.remove('success');
  replyEl.textContent = '';
  scoreEl.textContent = '';
  clearDrawCanvas();
  setupMoonCanvas();
  moonCtx.clearRect(0, 0, moonCanvas.clientWidth, moonCanvas.clientHeight);
  setScreen('title');
}

function bindEvents() {
  // pointerイベントでマウス/タッチを共通処理
  startBtn.addEventListener('click', () => {
    resetForRound();
    runOpening();
  });

  retryBtn.addEventListener('click', () => resetGame());

  drawCanvas.addEventListener('pointerdown', (ev) => {
    drawCanvas.setPointerCapture(ev.pointerId);
    beginDraw(ev);
  });
  drawCanvas.addEventListener('pointermove', moveDraw);
  drawCanvas.addEventListener('pointerup', endDraw);
  drawCanvas.addEventListener('pointercancel', endDraw);

  window.addEventListener('resize', () => {
    setupCanvas();
    setupMoonCanvas();
  });
}

function resetForRound() {
  state.points = [];
  state.drawing = false;
  state.didDraw = false;
  resultWrap.classList.remove('success');
  replyEl.textContent = '';
  scoreEl.textContent = '';
  clearDrawCanvas();
}

function buildFallbackMoon() {
  // 入力なし時に表示する簡易円
  const points = [];
  const cx = drawCanvas.clientWidth * 0.5;
  const cy = drawCanvas.clientHeight * 0.5;
  const r = Math.min(drawCanvas.clientWidth, drawCanvas.clientHeight) * 0.22;
  const step = Math.PI * 2 / 36;
  for (let a = 0; a < Math.PI * 2; a += step) {
    points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return points;
}

function init() {
  setupCanvas();
  setupMoonCanvas();
  bindEvents();
  resetGame();
}

init();
