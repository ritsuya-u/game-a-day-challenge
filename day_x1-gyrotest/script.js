'use strict';

const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');

const btnStart = document.getElementById('btnStart');
const btnReset = document.getElementById('btnReset');
const statusEl = document.getElementById('status');
const debugEl = document.getElementById('debug');

function fit() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  cv.width = Math.floor(innerWidth * dpr);
  cv.height = Math.floor(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 以降はCSS pxで描画
}
addEventListener('resize', fit);
fit();

// --- 物理っぽいパラメータ ---
const world = {
  // 傾き（重力ベクトル） [-1..1]
  tiltX: 0,
  tiltY: 0,
  // センサー由来の目標傾き
  targetX: 0,
  targetY: 0,
  // 入力の“なまる”係数
  smoothing: 0.12,
  // 重力強さ
  g: 1200, // px/s^2 相当
  // 摩擦
  friction: 0.985
};

// --- ボール ---
const ball = {
  x: 0, y: 0,
  vx: 0, vy: 0,
  r: 14
};

// --- ステージ（障害物は簡易的に線分として扱う） ---
let goal = { x: 0, y: 0, r: 20 };
let walls = []; // {x1,y1,x2,y2}
let message = '';

function reset() {
  const w = innerWidth, h = innerHeight;

  // ボール初期位置
  ball.x = w * 0.18;
  ball.y = h * 0.25;
  ball.vx = 0;
  ball.vy = 0;

  // ゴール
  goal.x = w * 0.82;
  goal.y = h * 0.78;

  // 壁（四角い枠 + 中に2本くらい）
  const pad = 26;
  walls = [
    // 枠
    {x1: pad, y1: pad, x2: w - pad, y2: pad},
    {x1: w - pad, y1: pad, x2: w - pad, y2: h - pad},
    {x1: w - pad, y1: h - pad, x2: pad, y2: h - pad},
    {x1: pad, y1: h - pad, x2: pad, y2: pad},

    // 中の障害物（斜め）
    {x1: w*0.25, y1: h*0.55, x2: w*0.65, y2: h*0.45},
    {x1: w*0.35, y1: h*0.25, x2: w*0.75, y2: h*0.30},
  ];

  message = '';
}
reset();

btnReset.addEventListener('click', reset);

// --- ジャイロ許可 & センサー開始 ---
let sensorOn = false;

btnStart.addEventListener('click', async () => {
  try {
    // iOS Safari はユーザー操作後に requestPermission 必要
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') {
        statusEl.textContent = 'センサー許可が必要です（許可されませんでした）';
        return;
      }
    }

    if (typeof DeviceOrientationEvent === 'undefined') {
      statusEl.textContent = 'この環境では DeviceOrientationEvent が使えません（PCならドラッグで代用）';
      sensorOn = false;
      return;
    }

    addEventListener('deviceorientation', onOrientation, { passive: true });
    sensorOn = true;
    statusEl.textContent = 'センサーON：端末を傾けて操作できます（PCはドラッグ代用も可）';
  } catch (e) {
    statusEl.textContent = 'センサー開始に失敗しました：' + (e?.message || e);
    sensorOn = false;
  }
});

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

// event.beta: 前後（-180..180）  event.gamma: 左右（-90..90）
function onOrientation(e) {
  // 端末の持ち方で符号が変わるので、直感に合う向きに調整
  const beta = e.beta ?? 0;   // 前後
  const gamma = e.gamma ?? 0; // 左右

  // 角度 -> [-1..1] へ正規化（感度はここで調整）
  const tx = clamp(gamma / 35, -1, 1);
  const ty = clamp(beta  / 35, -1, 1);

  world.targetX = tx;
  world.targetY = ty;
}

// --- PC代替：ドラッグで傾きを決める ---
let dragging = false;
let dragStart = {x:0,y:0};
let dragBase = {x:0,y:0};

cv.addEventListener('pointerdown', (e) => {
  dragging = true;
  cv.setPointerCapture(e.pointerId);
  dragStart.x = e.clientX;
  dragStart.y = e.clientY;
  dragBase.x = world.targetX;
  dragBase.y = world.targetY;
});
cv.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = (e.clientX - dragStart.x) / 220;
  const dy = (e.clientY - dragStart.y) / 220;
  // ドラッグは上下で前後傾きっぽく
  world.targetX = clamp(dragBase.x + dx, -1, 1);
  world.targetY = clamp(dragBase.y + dy, -1, 1);
});
cv.addEventListener('pointerup', () => dragging = false);
cv.addEventListener('pointercancel', () => dragging = false);

// --- 線分との簡易衝突（ボール中心 -> 線分最近点） ---
function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1;
  const wx = px - x1, wy = py - y1;
  const len2 = vx*vx + vy*vy || 1e-9;
  let t = (wx*vx + wy*vy) / len2;
  t = clamp(t, 0, 1);
  return { x: x1 + t*vx, y: y1 + t*vy, t };
}

function resolveBallVsSegment(seg) {
  const p = closestPointOnSegment(ball.x, ball.y, seg.x1, seg.y1, seg.x2, seg.y2);
  const dx = ball.x - p.x;
  const dy = ball.y - p.y;
  const dist = Math.hypot(dx, dy);
  const minDist = ball.r + 2; // 少し余白

  if (dist < minDist) {
    // 押し戻し
    const nx = (dist === 0) ? 1 : dx / dist;
    const ny = (dist === 0) ? 0 : dy / dist;
    const push = (minDist - dist);
    ball.x += nx * push;
    ball.y += ny * push;

    // 反射（簡易）
    const vn = ball.vx*nx + ball.vy*ny;
    if (vn < 0) {
      const restitution = 0.45;
      ball.vx -= (1 + restitution) * vn * nx;
      ball.vy -= (1 + restitution) * vn * ny;
    }
  }
}

// --- ループ ---
let last = performance.now();

function tick(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  // 傾きをなめらかに追従（センサーの揺れを吸収）
  world.tiltX += (world.targetX - world.tiltX) * world.smoothing;
  world.tiltY += (world.targetY - world.tiltY) * world.smoothing;

  // 加速度 = 重力ベクトル
  const ax = world.tiltX * world.g;
  const ay = world.tiltY * world.g;

  // 速度更新
  ball.vx += ax * dt;
  ball.vy += ay * dt;

  // 摩擦
  ball.vx *= Math.pow(world.friction, dt * 60);
  ball.vy *= Math.pow(world.friction, dt * 60);

  // 位置更新
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // 壁衝突
  for (const seg of walls) resolveBallVsSegment(seg);

  // ゴール判定
  const gx = ball.x - goal.x;
  const gy = ball.y - goal.y;
  if (!message && Math.hypot(gx, gy) < ball.r + goal.r) {
    message = 'GOAL!';
  }

  draw(dt);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// --- 描画 ---
function draw() {
  const w = innerWidth, h = innerHeight;

  // 背景
  ctx.clearRect(0, 0, w, h);

  // 薄いグリッド
  ctx.globalAlpha = 0.08;
  ctx.beginPath();
  for (let x = 0; x < w; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0; y < h; y += 40) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 壁
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  for (const s of walls) {
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  }
  ctx.stroke();

  // ゴール
  ctx.beginPath();
  ctx.arc(goal.x, goal.y, goal.r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(120, 255, 190, 0.18)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(120, 255, 190, 0.65)';
  ctx.stroke();

  // ボール
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(230, 240, 255, 0.9)';
  ctx.fill();

  // 傾き表示（矢印）
  const cx = 70, cy = h - 70;
  const vx = world.tiltX * 45;
  const vy = world.tiltY * 45;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + vx, cy + vy);
  ctx.stroke();

  // 矢印先端
  const ang = Math.atan2(vy, vx);
  const hx = cx + vx, hy = cy + vy;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx - 10*Math.cos(ang - 0.6), hy - 10*Math.sin(ang - 0.6));
  ctx.lineTo(hx - 10*Math.cos(ang + 0.6), hy - 10*Math.sin(ang + 0.6));
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fill();

  // ゴール表示
  if (message) {
    ctx.font = '900 56px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(120, 255, 190, 0.95)';
    ctx.fillText(message, w/2, h*0.22);

    ctx.font = '700 16px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('リセットでやり直し', w/2, h*0.22 + 52);
  }

  // デバッグ
  debugEl.textContent =
    `tiltX=${world.tiltX.toFixed(2)}  tiltY=${world.tiltY.toFixed(2)}\n` +
    `sensor=${sensorOn ? 'ON' : 'OFF'}  (iPhoneはボタンで許可が必要)\n` +
    `PCはドラッグで傾き代用`;
}