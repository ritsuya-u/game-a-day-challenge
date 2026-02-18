const stages = [
  {
    shape: "cylinder",
    shapeName: "円柱",
    targetLevel: 0.62,
    startDelay: 0.28,
    stopDelay: 0.44,
    flowRate: 0.46
  },
  {
    shape: "wide",
    shapeName: "広口",
    targetLevel: 0.56,
    startDelay: 0.36,
    stopDelay: 0.52,
    flowRate: 0.42
  },
  {
    shape: "narrow",
    shapeName: "細口",
    targetLevel: 0.66,
    startDelay: 0.24,
    stopDelay: 0.58,
    flowRate: 0.4
  },
  {
    shape: "flask",
    shapeName: "フラスコ",
    targetLevel: 0.6,
    startDelay: 0.5,
    stopDelay: 0.35,
    flowRate: 0.48
  }
];

const SCORE_COEFF = 2;
const FAIL_ERROR_PERCENT = 20;
const MAX_OVERFLOW_VOLUME = 1.06;

const shapeDefs = {
  cylinder: {
    widthAt: () => 0.68
  },
  wide: {
    widthAt: (t) => 0.52 + 0.34 * t
  },
  narrow: {
    widthAt: (t) => {
      if (t < 0.7) {
        return 0.82 - 0.04 * t;
      }
      return 0.55 - 0.12 * ((t - 0.7) / 0.3);
    }
  },
  flask: {
    widthAt: (t) => 0.48 + 0.4 * Math.sin(Math.PI * t)
  }
};

function buildShapeCache(shapeKey) {
  const shape = shapeDefs[shapeKey];
  const steps = 280;
  const levels = new Array(steps + 1);
  const cumulative = new Array(steps + 1);

  levels[0] = 0;
  cumulative[0] = 0;

  let area = 0;
  for (let i = 1; i <= steps; i += 1) {
    const t1 = (i - 1) / steps;
    const t2 = i / steps;
    const w = (shape.widthAt(t1) + shape.widthAt(t2)) * 0.5;
    area += w * (1 / steps);
    levels[i] = t2;
    cumulative[i] = area;
  }

  for (let i = 0; i <= steps; i += 1) {
    cumulative[i] /= area;
  }

  return {
    levels,
    cumulative,
    widthAt: shape.widthAt
  };
}

const shapeCache = Object.fromEntries(
  Object.keys(shapeDefs).map((key) => [key, buildShapeCache(key)])
);

function levelFromVolume(shapeKey, volumeFraction) {
  const cache = shapeCache[shapeKey];
  const v = Math.max(0, Math.min(1, volumeFraction));
  if (v <= 0) return 0;
  if (v >= 1) return 1;

  const arr = cache.cumulative;
  let lo = 0;
  let hi = arr.length - 1;

  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < v) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const v0 = arr[lo];
  const v1 = arr[hi];
  const t = v1 === v0 ? 0 : (v - v0) / (v1 - v0);
  const l0 = cache.levels[lo];
  const l1 = cache.levels[hi];
  return l0 + (l1 - l0) * t;
}

const titleScreen = document.getElementById("titleScreen");
const gameScreen = document.getElementById("gameScreen");
const resultScreen = document.getElementById("resultScreen");

const startButton = document.getElementById("startButton");
const pourButton = document.getElementById("pourButton");
const primaryButton = document.getElementById("primaryButton");
const secondaryButton = document.getElementById("secondaryButton");

const resultTitle = document.getElementById("resultTitle");
const resultTarget = document.getElementById("resultTarget");
const resultActual = document.getElementById("resultActual");
const resultError = document.getElementById("resultError");
const resultScore = document.getElementById("resultScore");
const resultComment = document.getElementById("resultComment");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const game = {
  selectedStage: null,
  running: false,
  lastFrame: 0,
  phase: "title",
  stage: null
};

function showScreen(screen) {
  titleScreen.classList.remove("active");
  gameScreen.classList.remove("active");
  resultScreen.classList.remove("active");
  screen.classList.add("active");
}

function percentText(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function createStageRuntime(stageData) {
  return {
    data: stageData,
    volume: 0,
    currentLevel: 0,
    pressStarted: false,
    buttonHeld: false,
    released: false,
    waterFlowing: false,
    pendingStartAt: Infinity,
    pendingStopAt: Infinity,
    finished: false,
    readyForResult: false,
    overflow: false,
    evalDone: false
  };
}

function startStage() {
  game.phase = "playing";
  game.running = true;
  game.stage = createStageRuntime(game.selectedStage);
  game.lastFrame = performance.now();
  pourButton.disabled = false;
  pourButton.textContent = "給水";
  showScreen(gameScreen);
  requestAnimationFrame(loop);
}

function startGame() {
  game.selectedStage = stages[Math.floor(Math.random() * stages.length)];
  startStage();
}

function getCupPoints(shapeKey, cupCx, cupTop, cupBottom, cupHalfMax) {
  const cache = shapeCache[shapeKey];
  const left = [];
  const right = [];
  const steps = 64;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const y = cupBottom - t * (cupBottom - cupTop);
    const half = cupHalfMax * cache.widthAt(t);
    left.push({ x: cupCx - half, y });
    right.push({ x: cupCx + half, y });
  }

  return { left, right };
}

function drawGame() {
  const stage = game.stage;
  const stageData = stage.data;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const machineW = 300;
  const machineH = 110;
  const machineX = (canvas.width - machineW) / 2;
  const machineY = 12;
  ctx.fillStyle = "#b3b8c0";
  ctx.fillRect(machineX, machineY, machineW, machineH);

  const nozzleW = 58;
  const nozzleH = 74;
  const nozzleX = canvas.width / 2 - nozzleW / 2;
  const nozzleY = machineY + machineH;
  ctx.fillStyle = "#7e7e7e";
  ctx.fillRect(nozzleX, nozzleY, nozzleW, nozzleH);

  const cupCx = canvas.width / 2;
  const cupTop = 305;
  const cupBottom = 560;
  const cupHalfMax = 122;

  const cup = getCupPoints(stageData.shape, cupCx, cupTop, cupBottom, cupHalfMax);

  const waterLevel = levelFromVolume(stageData.shape, Math.min(stage.volume, 1));
  stage.currentLevel = waterLevel;

  const waterY = cupBottom - waterLevel * (cupBottom - cupTop);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cup.left[0].x, cup.left[0].y);
  for (let i = 1; i < cup.left.length; i += 1) {
    ctx.lineTo(cup.left[i].x, cup.left[i].y);
  }
  for (let i = cup.right.length - 1; i >= 0; i -= 1) {
    ctx.lineTo(cup.right[i].x, cup.right[i].y);
  }
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = "#66b4e5";
  ctx.fillRect(cupCx - cupHalfMax - 20, waterY, (cupHalfMax + 20) * 2, cupBottom - waterY + 2);
  ctx.restore();

  const targetY = cupBottom - stageData.targetLevel * (cupBottom - cupTop);
  ctx.strokeStyle = "#d9534f";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(cupCx - cupHalfMax - 10, targetY);
  ctx.lineTo(cupCx + cupHalfMax + 10, targetY);
  ctx.stroke();
  ctx.setLineDash([]);

  if (stage.waterFlowing) {
    ctx.fillStyle = "#66b4e5";
    const streamX = canvas.width / 2 - 14;
    const streamTop = nozzleY + nozzleH;
    const streamBottom = Math.max(cupTop + 8, waterY);
    ctx.fillRect(streamX, streamTop, 28, streamBottom - streamTop);
  }

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(cup.left[0].x, cup.left[0].y);
  for (let i = 1; i < cup.left.length; i += 1) {
    ctx.lineTo(cup.left[i].x, cup.left[i].y);
  }
  ctx.moveTo(cup.right[0].x, cup.right[0].y);
  for (let i = 1; i < cup.right.length; i += 1) {
    ctx.lineTo(cup.right[i].x, cup.right[i].y);
  }
  ctx.moveTo(cup.left[0].x, cup.left[0].y);
  ctx.lineTo(cup.right[0].x, cup.right[0].y);
  ctx.stroke();

}

function evaluateStage() {
  const stage = game.stage;
  if (!stage || stage.evalDone) return;

  stage.evalDone = true;

  const target = stage.data.targetLevel;
  const actual = Math.min(1, stage.currentLevel);
  const error = Math.abs(target - actual);
  const errorPercent = error * 100;

  let score = Math.max(0, Math.round(100 - errorPercent * SCORE_COEFF));
  let comment = "";
  let title = "結果";
  let failed = false;

  if (stage.overflow || stage.volume > 1) {
    failed = true;
    score = 0;
    title = "ゲームオーバー";
    comment = "水は大切にしないとだめだよ？";
  } else if (errorPercent >= FAIL_ERROR_PERCENT) {
    failed = true;
    title = "失敗";
    comment = "下手すぎやろ。貸せ俺がやる";
  } else if (errorPercent < 3) {
    comment = "プロやん！";
  } else if (errorPercent < 8) {
    comment = "うまいな。";
  } else {
    comment = "給水機の遅延を考えろって";
  }

  resultTitle.textContent = title;
  resultTarget.textContent = percentText(target);
  resultActual.textContent = percentText(actual);
  resultError.textContent = `${errorPercent.toFixed(2)}%`;
  resultScore.textContent = String(score);
  resultComment.textContent = comment;
  primaryButton.textContent = "もう一度";

  showScreen(resultScreen);
  game.phase = "result";
  game.running = false;
}

function finalizeAfterWaterStop() {
  if (!game.stage || game.stage.finished) return;
  game.stage.finished = true;
  game.stage.readyForResult = true;
  game.running = false;
  pourButton.disabled = false;
  pourButton.textContent = "結果を見る";
}

function stepStage(nowMs, dtSec) {
  const stage = game.stage;
  if (!stage || stage.finished) return;

  if (!stage.waterFlowing && stage.pressStarted && nowMs >= stage.pendingStartAt) {
    stage.waterFlowing = true;
  }

  if (stage.waterFlowing) {
    stage.volume += stage.data.flowRate * dtSec;
    if (stage.volume >= 1) {
      stage.overflow = true;
    }
    if (stage.volume > MAX_OVERFLOW_VOLUME) {
      stage.volume = MAX_OVERFLOW_VOLUME;
    }
  }

  if (stage.released && stage.waterFlowing && nowMs >= stage.pendingStopAt) {
    stage.waterFlowing = false;
  }

  if (stage.overflow) {
    finalizeAfterWaterStop();
    return;
  }

  if (stage.released && !stage.waterFlowing && nowMs >= stage.pendingStopAt && nowMs >= stage.pendingStartAt) {
    finalizeAfterWaterStop();
  }
}

function loop(now) {
  if (!game.running || game.phase !== "playing") {
    return;
  }

  const dt = Math.min(0.04, (now - game.lastFrame) / 1000);
  game.lastFrame = now;

  stepStage(now, dt);
  drawGame();

  if (game.running && game.phase === "playing") {
    requestAnimationFrame(loop);
  }
}

function onPressStart(event) {
  event.preventDefault();
  const stage = game.stage;
  if (!stage || stage.finished || stage.released) return;
  if (stage.readyForResult) return;
  if (stage.buttonHeld) return;

  const now = performance.now();
  stage.buttonHeld = true;
  if (!stage.pressStarted) {
    stage.pressStarted = true;
    stage.pendingStartAt = now + stage.data.startDelay * 1000;
  }

  pourButton.textContent = "給水中";
}

function onPressEnd(event) {
  event.preventDefault();
  const stage = game.stage;
  if (!stage || stage.finished || !stage.buttonHeld) return;
  if (stage.readyForResult) return;

  stage.buttonHeld = false;
  stage.released = true;
  stage.pendingStopAt = performance.now() + stage.data.stopDelay * 1000;
  pourButton.disabled = true;
  pourButton.textContent = "停止待ち";
}

function bindPourEvents() {
  const opts = { passive: false };

  pourButton.addEventListener("mousedown", onPressStart);
  pourButton.addEventListener("touchstart", onPressStart, opts);

  pourButton.addEventListener("mouseup", onPressEnd);
  pourButton.addEventListener("mouseleave", (event) => {
    if (game.stage && game.stage.buttonHeld) {
      onPressEnd(event);
    }
  });
  pourButton.addEventListener("touchend", onPressEnd, opts);
  pourButton.addEventListener("touchcancel", onPressEnd, opts);
}

startButton.addEventListener("click", startGame);

pourButton.addEventListener("click", () => {
  const stage = game.stage;
  if (!stage || !stage.readyForResult) {
    return;
  }
  evaluateStage();
});

primaryButton.addEventListener("click", () => {
  startGame();
});

secondaryButton.addEventListener("click", () => {
  game.running = false;
  game.phase = "title";
  showScreen(titleScreen);
});

bindPourEvents();
showScreen(titleScreen);
