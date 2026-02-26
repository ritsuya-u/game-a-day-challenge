// DOM references
const titleScreen = document.getElementById("titleScreen");
const playScreen = document.getElementById("playScreen");
const resultScreen = document.getElementById("resultScreen");

const startBtn = document.getElementById("startBtn");
const backTitleBtn = document.getElementById("backTitleBtn");
const remainTimeEl = document.getElementById("remainTime");
const resultText = document.getElementById("resultText");

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Field geometry
const W = canvas.width;
const H = canvas.height;
const FIELD = { left: 56, right: W - 56, top: 56, bottom: H - 56 };
const GATE = { width: 168, depth: 36 };
GATE.left = (FIELD.left + FIELD.right - GATE.width) / 2;
GATE.right = GATE.left + GATE.width;

const SHEEP_TOTAL = 12;
const TIME_LIMIT = 30;

// Game state
const sheep = [];
let escaped = 0;
let remainTime = TIME_LIMIT;
let speedScale = 0.1;
let scene = "title";

// Sheep movement tuning
const cursor = { x: 0, y: 0, active: false };
const FEAR_RADIUS = 170;
const REPULSE = 0.08;
const MAX_SPEED = 0.58;

// Assets
const sheepImg = new Image();
let sheepImageReady = false;
sheepImg.onload = () => {
  sheepImageReady = true;
};
sheepImg.src = "images/sheep.png";

function rnd(min, max) {
  return min + Math.random() * (max - min);
}

// Switch visible screen: title / play / result
function setScene(next) {
  scene = next;
  titleScreen.classList.toggle("hidden", next !== "title");
  playScreen.classList.toggle("hidden", next !== "play");
  resultScreen.classList.toggle("hidden", next !== "result");
}

// Initialize one play session
function resetPlay() {
  sheep.length = 0;
  escaped = 0;
  remainTime = TIME_LIMIT;
  cursor.active = false;

  for (let i = 0; i < SHEEP_TOTAL; i++) {
    sheep.push({
      x: rnd(FIELD.left + 90, FIELD.right - 90),
      y: rnd(FIELD.top + 70, FIELD.bottom - 80),
      vx: rnd(-0.06, 0.06),
      vy: rnd(-0.06, 0.06),
      escaped: false,
      jitter: Math.random() * Math.PI * 2,
      size: rnd(0.9, 1.08),
    });
  }

  remainTimeEl.textContent = String(TIME_LIMIT);
}

// Update one sheep with idle drift + cursor repulsion
function updateSheep(s, dt) {
  if (s.escaped) return;

  s.jitter += dt * 0.0014;
  s.vx += Math.cos(s.jitter) * 0.00055 * dt;
  s.vy += Math.sin(s.jitter * 1.3) * 0.00055 * dt;

  if (cursor.active) {
    const dx = s.x - cursor.x;
    const dy = s.y - cursor.y;
    const d = Math.hypot(dx, dy) || 0.001;
    if (d < FEAR_RADIUS) {
      const force = (1 - d / FEAR_RADIUS) * REPULSE * dt;
      s.vx += (dx / d) * force;
      s.vy += (dy / d) * force;
    }
  }

  const speed = Math.hypot(s.vx, s.vy);
  if (speed > MAX_SPEED) {
    const k = MAX_SPEED / speed;
    s.vx *= k;
    s.vy *= k;
  }

  s.vx *= 0.982;
  s.vy *= 0.982;

  s.x += s.vx * dt;
  s.y += s.vy * dt;

  const r = 20 * s.size;

  if (s.x < FIELD.left + r) {
    s.x = FIELD.left + r;
    s.vx = Math.abs(s.vx) * 0.72;
  }
  if (s.x > FIELD.right - r) {
    s.x = FIELD.right - r;
    s.vx = -Math.abs(s.vx) * 0.72;
  }
  if (s.y < FIELD.top + r) {
    s.y = FIELD.top + r;
    s.vy = Math.abs(s.vy) * 0.72;
  }

  if (s.y > FIELD.bottom - r) {
    if (s.x > GATE.left + 6 && s.x < GATE.right - 6) {
      if (s.y > H + 28) {
        s.escaped = true;
        escaped += 1;
      }
    } else {
      s.y = FIELD.bottom - r;
      s.vy = -Math.abs(s.vy) * 0.72;
    }
  }
}

// Draw fence with opening at bottom center (gate)
function drawFence() {
  ctx.strokeStyle = "#f7f7f7";
  ctx.lineWidth = 10;
  ctx.lineCap = "square";

  ctx.beginPath();
  ctx.moveTo(FIELD.left, FIELD.top);
  ctx.lineTo(FIELD.right, FIELD.top);
  ctx.moveTo(FIELD.left, FIELD.top);
  ctx.lineTo(FIELD.left, FIELD.bottom);
  ctx.moveTo(FIELD.right, FIELD.top);
  ctx.lineTo(FIELD.right, FIELD.bottom);
  ctx.moveTo(FIELD.left, FIELD.bottom);
  ctx.lineTo(GATE.left, FIELD.bottom);
  ctx.moveTo(GATE.right, FIELD.bottom);
  ctx.lineTo(FIELD.right, FIELD.bottom);
  ctx.stroke();
}

// Draw sheep sprite; facing is intentionally inverted to movement direction
function drawSheep(s) {
  if (s.escaped) return;

  const dir = s.vx >= 0 ? -1 : 1;
  const drawW = 74 * s.size;
  const drawH = 56 * s.size;

  ctx.save();
  ctx.translate(s.x, s.y);

  if (dir < 0) {
    ctx.scale(-1, 1);
  }

  if (sheepImageReady) {
    ctx.drawImage(sheepImg, -drawW / 2, -drawH / 2, drawW, drawH);
  } else {
    ctx.fillStyle = "#f7f7f7";
    ctx.beginPath();
    ctx.ellipse(0, 0, drawW * 0.36, drawH * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// Play scene rendering
function drawPlay() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#7fd557";
  ctx.fillRect(0, 0, W, H);

  drawFence();
  sheep.forEach(drawSheep);
}

// Build result text and transition
function toResult() {
  resultText.textContent = `${escaped}時間睡眠`;
  setScene("result");
}

let last = 0;
// Main loop
function frame(ts) {
  if (!last) last = ts;
  const dt = Math.min(32, ts - last);
  last = ts;

  if (scene === "play") {
    remainTime = Math.max(0, remainTime - dt / 1000);
    remainTimeEl.textContent = String(Math.ceil(remainTime));

    const sheepDt = dt * speedScale;
    sheep.forEach((s) => updateSheep(s, sheepDt));
    drawPlay();

    if (remainTime <= 0) {
      toResult();
    }
  }

  requestAnimationFrame(frame);
}

// Convert pointer coordinates to canvas space
function updatePointer(clientX, clientY) {
  if (scene !== "play") return;
  const rect = canvas.getBoundingClientRect();
  cursor.x = ((clientX - rect.left) / rect.width) * W;
  cursor.y = ((clientY - rect.top) / rect.height) * H;
  cursor.active = true;
}

// Input events
canvas.addEventListener("pointermove", (e) => updatePointer(e.clientX, e.clientY));
canvas.addEventListener("pointerdown", (e) => updatePointer(e.clientX, e.clientY));
canvas.addEventListener("pointerleave", () => {
  cursor.active = false;
});

startBtn.addEventListener("click", () => {
  resetPlay();
  setScene("play");
});

backTitleBtn.addEventListener("click", () => {
  setScene("title");
});

// Boot
setScene("title");
requestAnimationFrame(frame);
