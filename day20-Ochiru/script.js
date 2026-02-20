'use strict';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const screenTitle = document.getElementById('screenTitle');
const screenPlay = document.getElementById('screenPlay');
const screenResult = document.getElementById('screenResult');

const btnStart = document.getElementById('btnStart');
const btnBackTitle = document.getElementById('btnBackTitle');

const resultTextEl = document.getElementById('resultText');

const STATE = {
  TITLE: 'title',
  PLAY: 'play',
  RESULT: 'result',
};

const PLAY_SECONDS = 30;
const BALL_R = 40;
const GRAVITY = 1400;
const BOUNCE = 0.74;
const AIR = 0.998;
const MAX_BALLS = 44;
const SPAWN_INTERVAL = 0.20;
const RAMP_GAP = 120;
const HOLE_SPEED = 560;
const GIRL_RATE = 0.05;

const WORD_A = ['成績', '単位', '評判', '信頼'];
const WORD_B = ['受験', '闇', '地獄'];
const WORD_POOL = [
  ...WORD_A.map((word) => ({ kind: 'wordA', word })),
  ...WORD_B.map((word) => ({ kind: 'wordB', word })),
];

let state = STATE.TITLE;

let w = innerWidth;
let h = innerHeight;
let dpr = 1;

let holeX = w * 0.5;
let moveLeft = false;
let moveRight = false;
let pointerActive = false;

let balls = [];
let spawnTimer = 0;
let playTime = 0;

let girlDropped = 0;
let droppedA = [];
let droppedB = [];

function resize() {
  w = innerWidth;
  h = innerHeight;
  dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  holeX = clamp(holeX, RAMP_GAP * 0.5 + 40, w - RAMP_GAP * 0.5 - 40);
}

function setScreen(next) {
  state = next;

  screenTitle.classList.toggle('hidden', next !== STATE.TITLE);
  screenPlay.classList.toggle('hidden', next !== STATE.PLAY);
  screenResult.classList.toggle('hidden', next !== STATE.RESULT);
}

function resetPlay() {
  balls = [];
  spawnTimer = 0;
  playTime = 0;

  holeX = w * 0.5;
  moveLeft = false;
  moveRight = false;
  pointerActive = false;

  girlDropped = 0;
  droppedA = [];
  droppedB = [];

  for (let i = 0; i < 18; i += 1) {
    spawnBall(Math.random() * w, Math.random() * -h * 1.1);
  }
}

function startGame() {
  resetPlay();
  setScreen(STATE.PLAY);
}

function backToTitle() {
  setScreen(STATE.TITLE);
}

function endGame() {
  buildResultText();
  setScreen(STATE.RESULT);
}

function spawnBall(x = Math.random() * w, y = -BALL_R - 10) {
  if (balls.length >= MAX_BALLS) return;

  const isGirl = Math.random() < GIRL_RATE;
  let kind = 'girl';
  let word = '';

  if (!isGirl) {
    const picked = WORD_POOL[(Math.random() * WORD_POOL.length) | 0];
    kind = picked.kind;
    word = picked.word;
  }

  balls.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 140,
    vy: Math.random() * 120,
    r: BALL_R,
    judged: false,
    kind,
    word,
  });
}

function rampSegments() {
  const topY = h * 0.68;
  const bottomY = h * 0.9;
  const centerX = holeX;
  const gapHalf = RAMP_GAP * 0.5;

  return [
    { x1: -50, y1: bottomY, x2: centerX - gapHalf, y2: topY },
    { x1: centerX + gapHalf, y1: topY, x2: w + 50, y2: bottomY },
  ];
}

function collideBallSegment(ball, seg) {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const len2 = dx * dx + dy * dy;

  if (len2 <= 0.0001) return;

  const px = ball.x - seg.x1;
  const py = ball.y - seg.y1;
  const t = clamp((px * dx + py * dy) / len2, 0, 1);

  const cx = seg.x1 + dx * t;
  const cy = seg.y1 + dy * t;
  const nx = ball.x - cx;
  const ny = ball.y - cy;
  const dist2 = nx * nx + ny * ny;

  if (dist2 >= ball.r * ball.r) return;

  const dist = Math.max(0.0001, Math.sqrt(dist2));
  const unx = nx / dist;
  const uny = ny / dist;
  const overlap = ball.r - dist;

  ball.x += unx * overlap;
  ball.y += uny * overlap;

  const vn = ball.vx * unx + ball.vy * uny;
  if (vn < 0) {
    ball.vx -= (1 + BOUNCE) * vn * unx;
    ball.vy -= (1 + BOUNCE) * vn * uny;
    ball.vx *= 0.985;
  }
}

function pushUnique(arr, word) {
  if (!arr.includes(word)) arr.push(word);
}

function stepPlay(dt) {
  if (moveLeft) holeX -= HOLE_SPEED * dt;
  if (moveRight) holeX += HOLE_SPEED * dt;
  holeX = clamp(holeX, RAMP_GAP * 0.5 + 40, w - RAMP_GAP * 0.5 - 40);

  playTime += dt;

  if (playTime >= PLAY_SECONDS) {
    endGame();
    return;
  }

  spawnTimer += dt;
  while (spawnTimer >= SPAWN_INTERVAL) {
    spawnTimer -= SPAWN_INTERVAL;
    spawnBall();
  }

  const segs = rampSegments();
  const gapLeft = holeX - RAMP_GAP * 0.5;
  const gapRight = holeX + RAMP_GAP * 0.5;
  const gateY = h * 0.68 + BALL_R;

  for (let i = balls.length - 1; i >= 0; i -= 1) {
    const b = balls[i];
    const prevY = b.y;

    b.vy += GRAVITY * dt;
    b.vx *= AIR;
    b.vy *= AIR;

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    collideBallSegment(b, segs[0]);
    collideBallSegment(b, segs[1]);

    if (!b.judged && prevY <= gateY && b.y > gateY) {
      b.judged = true;
      const inHole = b.x > gapLeft && b.x < gapRight;

      if (inHole) {
        if (b.kind === 'girl') {
          girlDropped += 1;
        } else if (b.kind === 'wordA') {
          pushUnique(droppedA, b.word);
        } else {
          pushUnique(droppedB, b.word);
        }
      }
    }

    if (b.y - b.r > h + 140 || b.x + b.r < -140 || b.x - b.r > w + 140) {
      balls.splice(i, 1);
    }
  }
}

function drawGirlFace(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ff3b4d';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x - r * 0.28, y - r * 0.16, r * 0.11, 0, Math.PI * 2);
  ctx.arc(x + r * 0.28, y - r * 0.16, r * 0.11, 0, Math.PI * 2);
  ctx.fillStyle = '#3a0f19';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y + r * 0.02, r * 0.36, 0.18 * Math.PI, 0.82 * Math.PI);
  ctx.strokeStyle = '#3a0f19';
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawPlay() {
  ctx.clearRect(0, 0, w, h);

  const segs = rampSegments();
  const remain = Math.max(0, PLAY_SECONDS - playTime);
  const remainInt = Math.ceil(remain);

  ctx.fillStyle = '#e5e5e5';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#000000';
  ctx.font = `900 ${Math.floor(Math.min(w, h) * 0.34)}px "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(remainInt), w * 0.5, h * 0.46);
  ctx.restore();

  ctx.strokeStyle = '#010101';
  ctx.lineWidth = 14;
  ctx.lineCap = 'butt';

  ctx.beginPath();
  ctx.moveTo(segs[0].x1, segs[0].y1);
  ctx.lineTo(segs[0].x2, segs[0].y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(segs[1].x1, segs[1].y1);
  ctx.lineTo(segs[1].x2, segs[1].y2);
  ctx.stroke();

  for (const b of balls) {
    if (b.kind === 'girl') {
      drawGirlFace(b.x, b.y, b.r);
      continue;
    }

    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = '#00115e';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 22px "Segoe UI", "Noto Sans JP", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.word, b.x, b.y);
  }
}

function buildSentence(words, middleChunk, endChunk) {
  if (words.length === 0) return '';
  let text = '';
  for (let i = 0; i < words.length; i += 1) {
    const isLast = i === words.length - 1;
    text += words[i] + (isLast ? endChunk : middleChunk);
  }
  return text;
}

function appendResultLine(text) {
  if (!text) return;
  const p = document.createElement('p');
  p.textContent = text;
  resultTextEl.appendChild(p);
}

function buildResultText() {
  resultTextEl.innerHTML = '';

  const totalDropped = girlDropped + droppedA.length + droppedB.length;
  if (totalDropped === 0) {
    appendResultLine('あなたは人生でなにも落としませんでした。');
    return;
  }

  appendResultLine(`あなたは${girlDropped}人の女の子を落としました！`);

  if (droppedA.length > 0 || droppedB.length > 0) {
    appendResultLine('しかし…');
  }

  const sentenceA = buildSentence(droppedA, 'を落とし、', 'を落としました。');
  appendResultLine(sentenceA);

  if (droppedB.length > 0) {
    if (droppedA.length > 0) appendResultLine('そして、');
    const sentenceB = buildSentence(droppedB, 'に落ちて、', 'に落ちました。');
    appendResultLine(sentenceB);
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

addEventListener('resize', resize);

addEventListener('keydown', (e) => {
  if (state !== STATE.PLAY) return;
  if (e.key === 'ArrowLeft') moveLeft = true;
  if (e.key === 'ArrowRight') moveRight = true;
  if (e.key.toLowerCase() === 'r') resetPlay();
});

addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') moveLeft = false;
  if (e.key === 'ArrowRight') moveRight = false;
});

canvas.addEventListener('pointerdown', (e) => {
  if (state !== STATE.PLAY) return;
  pointerActive = true;
  holeX = clamp(e.clientX, RAMP_GAP * 0.5 + 40, w - RAMP_GAP * 0.5 - 40);
});

canvas.addEventListener('pointermove', (e) => {
  if (state !== STATE.PLAY || !pointerActive) return;
  holeX = clamp(e.clientX, RAMP_GAP * 0.5 + 40, w - RAMP_GAP * 0.5 - 40);
});

addEventListener('pointerup', () => {
  pointerActive = false;
});

addEventListener('pointercancel', () => {
  pointerActive = false;
});

btnStart.addEventListener('click', startGame);
btnBackTitle.addEventListener('click', backToTitle);

resize();
setScreen(STATE.TITLE);

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (state === STATE.PLAY) {
    stepPlay(dt);
    drawPlay();
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
