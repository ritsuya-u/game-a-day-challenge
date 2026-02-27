const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const stagedEl = document.getElementById("staged");
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("start");
const body = document.body;
const root = document.documentElement;

const enemyImages = {
  day: new Image(),
  night: new Image(),
};
enemyImages.day.src = "./images/day_enemy.png";
enemyImages.night.src = "./images/night_enemy.png";

const TAU = Math.PI * 2;
const CENTER = { x: canvas.width / 2, y: canvas.height / 2 };
const FIELD_RADIUS = 340;
const CLOCK_RADIUS = 96;
const ENEMY_SIZE = 40;
const BULLET_RADIUS = 5;
const BULLET_SPEED = 580;
const FIRE_INTERVAL = 0.24;
const BASE_SPAWN_INTERVAL = 3.0;
const MIN_SPAWN_INTERVAL = 0.85;
const ENEMY_TRAVEL_TIME = 9;
const BASE_ENEMY_SPEED = FIELD_RADIUS / ENEMY_TRAVEL_TIME;
const ANGULAR_SPEED = 2.4;
const TIME_CONTROL_SPEED = 1.35;
const HOUR_HAND_RATIO = 1 / 12;
const INITIAL_HAND_ANGLE = -Math.PI / 2;
const THEME_TRANSITION_SPEED = 2.4;
const SCORE_ROLL_DURATION = 1;
const SPAWN_ACCELERATION_PER_TURN = 0.16;

const state = {
  running: false,
  score: 0,
  stagedScore: 0,
  displayedScore: 0,
  displayedStagedScore: 0,
  scoreAnim: null,
  stagedScoreAnim: null,
  hp: 5,
  gameTime: 0,
  aimAngle: INITIAL_HAND_ANGLE,
  themeInverted: false,
  themeMix: 0,
  totalForwardRotation: 0,
  bullets: [],
  enemies: [],
  fireCooldown: 0,
  spawnCooldown: 0,
  lastFrame: 0,
  keys: new Set(),
  draggingPointerId: null,
  pointerAngle: null,
  pendingPointerDelta: 0,
};

function resetGame() {
  state.running = true;
  state.score = 0;
  state.stagedScore = 0;
  state.displayedScore = 0;
  state.displayedStagedScore = 0;
  state.scoreAnim = null;
  state.stagedScoreAnim = null;
  state.hp = 5;
  state.gameTime = 0;
  state.aimAngle = INITIAL_HAND_ANGLE;
  state.themeInverted = false;
  state.themeMix = 0;
  state.totalForwardRotation = 0;
  state.bullets = [];
  state.enemies = [];
  state.fireCooldown = 0;
  state.spawnCooldown = 0.4;
  state.lastFrame = performance.now();
  state.keys.clear();
  state.draggingPointerId = null;
  state.pointerAngle = null;
  state.pendingPointerDelta = 0;
  syncTheme();
  updateHud();
}

function updateHud() {
  scoreEl.textContent = `${Math.round(state.displayedScore)}`;
  const stagedValue = Math.round(state.displayedStagedScore);
  stagedEl.textContent = stagedValue > 0 ? `+${stagedValue}` : "+0";
}

function beginNumberAnimation(currentValue, nextValue) {
  return {
    from: currentValue,
    to: nextValue,
    elapsed: 0,
  };
}

function stepNumberAnimation(animation, dt) {
  if (!animation) {
    return null;
  }

  animation.elapsed += dt;
  if (animation.elapsed >= SCORE_ROLL_DURATION) {
    return null;
  }

  return animation;
}

function getAnimatedValue(animation) {
  if (!animation) {
    return null;
  }

  const progress = Math.min(1, animation.elapsed / SCORE_ROLL_DURATION);
  return lerp(animation.from, animation.to, progress);
}

function animateScoreDisplays(dt) {
  if (state.scoreAnim && state.scoreAnim.to !== state.score) {
    state.scoreAnim = beginNumberAnimation(state.displayedScore, state.score);
  } else if (!state.scoreAnim && state.displayedScore !== state.score) {
    state.scoreAnim = beginNumberAnimation(state.displayedScore, state.score);
  }

  if (state.stagedScoreAnim && state.stagedScoreAnim.to !== state.stagedScore) {
    state.stagedScoreAnim = beginNumberAnimation(state.displayedStagedScore, state.stagedScore);
  } else if (!state.stagedScoreAnim && state.displayedStagedScore !== state.stagedScore) {
    state.stagedScoreAnim = beginNumberAnimation(state.displayedStagedScore, state.stagedScore);
  }

  state.scoreAnim = stepNumberAnimation(state.scoreAnim, dt);
  state.stagedScoreAnim = stepNumberAnimation(state.stagedScoreAnim, dt);

  const animatedScore = getAnimatedValue(state.scoreAnim);
  const animatedStagedScore = getAnimatedValue(state.stagedScoreAnim);

  if (animatedScore === null) {
    state.displayedScore = state.score;
  } else {
    state.displayedScore = animatedScore;
  }

  if (animatedStagedScore === null) {
    state.displayedStagedScore = state.stagedScore;
  } else {
    state.displayedStagedScore = animatedStagedScore;
  }
}

function spawnEnemy() {
  state.enemies.push({
    angle: Math.random() * TAU,
    radius: FIELD_RADIUS,
    hit: false,
  });
}

function fireBullet() {
  const angle = state.aimAngle;
  const spawnRadius = 48;
  state.bullets.push({
    x: CENTER.x + Math.cos(angle) * spawnRadius,
    y: CENTER.y + Math.sin(angle) * spawnRadius,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    alive: true,
  });
}

function getEnemyRadius(enemy) {
  return enemy.radius;
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function getSpawnInterval() {
  const turns = state.totalForwardRotation / TAU;
  return Math.max(MIN_SPAWN_INTERVAL, BASE_SPAWN_INTERVAL - turns * SPAWN_ACCELERATION_PER_TURN);
}

function getHourHandAngle() {
  return INITIAL_HAND_ANGLE + (state.aimAngle - INITIAL_HAND_ANGLE) * HOUR_HAND_RATIO;
}

function isThemeInverted() {
  const halfTurnsFromStart = Math.floor(Math.abs(getHourHandAngle() - INITIAL_HAND_ANGLE) / Math.PI);
  return halfTurnsFromStart % 2 === 1;
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function mixColor(from, to, amount) {
  return `rgb(${Math.round(lerp(from[0], to[0], amount))}, ${Math.round(lerp(from[1], to[1], amount))}, ${Math.round(lerp(from[2], to[2], amount))})`;
}

function mixAlphaColor(from, to, amount) {
  return `rgba(${Math.round(lerp(from[0], to[0], amount))}, ${Math.round(lerp(from[1], to[1], amount))}, ${Math.round(lerp(from[2], to[2], amount))}, ${lerp(from[3], to[3], amount)})`;
}

function updateThemeStyles() {
  root.style.setProperty("--bg", mixColor([2, 2, 2], [243, 243, 243], state.themeMix));
  root.style.setProperty("--fg", mixColor([244, 244, 244], [17, 17, 17], state.themeMix));
  root.style.setProperty("--panel-border", mixAlphaColor([255, 255, 255, 0.16], [0, 0, 0, 0.14], state.themeMix));
  root.style.setProperty("--panel-bg", mixAlphaColor([255, 255, 255, 0.04], [0, 0, 0, 0.04], state.themeMix));
  root.style.setProperty("--overlay-border", mixAlphaColor([255, 255, 255, 0.14], [0, 0, 0, 0.14], state.themeMix));
  root.style.setProperty("--overlay-bg", mixAlphaColor([10, 10, 10, 0.92], [255, 255, 255, 0.94], state.themeMix));
}

function syncTheme() {
  const inverted = isThemeInverted();
  if (inverted !== state.themeInverted) {
    state.score += state.stagedScore;
    state.stagedScore = 0;
    state.themeInverted = inverted;
  }
  body.classList.toggle("inverted", inverted);
}

function applyRotationDelta(aimDelta) {
  if (aimDelta === 0) {
    return;
  }

  state.aimAngle += aimDelta;
  state.totalForwardRotation = Math.max(0, state.totalForwardRotation + aimDelta);
}

function getPointerAngle(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX - CENTER.x;
  const y = (event.clientY - rect.top) * scaleY - CENTER.y;
  return Math.atan2(y, x);
}

function update(dt) {
  let rotateInput = 0;
  if (state.keys.has("ArrowLeft") || state.keys.has("KeyA")) {
    rotateInput -= 1;
  }
  if (state.keys.has("ArrowRight") || state.keys.has("KeyD")) {
    rotateInput += 1;
  }

  const keyboardAimDelta = rotateInput * ANGULAR_SPEED * dt;
  const pointerAimDelta = state.pendingPointerDelta;
  const totalAimDelta = keyboardAimDelta + pointerAimDelta;
  state.pendingPointerDelta = 0;
  applyRotationDelta(totalAimDelta);
  const timeControlInput = dt > 0 ? totalAimDelta / (ANGULAR_SPEED * dt) : 0;
  state.gameTime += (1 + timeControlInput * TIME_CONTROL_SPEED) * dt;
  syncTheme();
  const targetThemeMix = state.themeInverted ? 1 : 0;
  state.themeMix = lerp(state.themeMix, targetThemeMix, Math.min(1, dt * THEME_TRANSITION_SPEED));
  updateThemeStyles();
  animateScoreDisplays(dt);

  state.fireCooldown -= dt;
  if (state.fireCooldown <= 0) {
    fireBullet();
    state.fireCooldown += FIRE_INTERVAL;
  }

  state.spawnCooldown -= dt;
  if (state.spawnCooldown <= 0) {
    spawnEnemy();
    state.spawnCooldown += getSpawnInterval();
  }

  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    const dx = bullet.x - CENTER.x;
    const dy = bullet.y - CENTER.y;
    if (Math.hypot(dx, dy) > FIELD_RADIUS + 80) {
      bullet.alive = false;
    }
  }

  for (const enemy of state.enemies) {
    if (enemy.hit) {
      continue;
    }
    enemy.radius -= (BASE_ENEMY_SPEED + timeControlInput * BASE_ENEMY_SPEED * TIME_CONTROL_SPEED) * dt;
    const radius = getEnemyRadius(enemy);
    if (radius <= 12) {
      enemy.hit = true;
      state.hp -= 1;
      if (state.hp <= 0) {
        endGame();
        return;
      }
    } else if (radius > FIELD_RADIUS + 30) {
      enemy.hit = true;
    }
  }

  for (const bullet of state.bullets) {
    if (!bullet.alive) {
      continue;
    }
    for (const enemy of state.enemies) {
      if (enemy.hit) {
        continue;
      }
      const radius = getEnemyRadius(enemy);
      if (radius <= 0 || radius > FIELD_RADIUS) {
        continue;
      }
      const ex = CENTER.x + Math.cos(enemy.angle) * radius;
      const ey = CENTER.y + Math.sin(enemy.angle) * radius;
      if (Math.hypot(bullet.x - ex, bullet.y - ey) <= ENEMY_SIZE * 0.38 + BULLET_RADIUS) {
        bullet.alive = false;
        enemy.hit = true;
        state.stagedScore += 100;
        break;
      }
    }
  }

  state.bullets = state.bullets.filter((bullet) => bullet.alive);
  state.enemies = state.enemies.filter((enemy) => !enemy.hit);
  updateHud();
}

function drawField() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const reverse = (state.keys.has("ArrowLeft") || state.keys.has("KeyA")) && !(state.keys.has("ArrowRight") || state.keys.has("KeyD"));
  const backgroundColor = mixColor([2, 2, 2], [243, 243, 243], state.themeMix);
  const handColor = mixColor([247, 247, 247], [17, 17, 17], state.themeMix);
  const ringColor = mixAlphaColor([255, 255, 255, 0.12], [0, 0, 0, 0.18], state.themeMix);
  const tickColor = mixAlphaColor([255, 255, 255, 0.9], [0, 0, 0, 0.92], state.themeMix);

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(CENTER.x, CENTER.y);

  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, FIELD_RADIUS + 100);
  glow.addColorStop(0, reverse ? "rgba(90, 214, 255, 0.12)" : "rgba(255, 200, 87, 0.08)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, FIELD_RADIUS + 100, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, FIELD_RADIUS, 0, TAU);
  ctx.stroke();

  for (let i = 0; i < 12; i += 1) {
    const angle = -Math.PI / 2 + (i / 12) * TAU;
    const inner = CLOCK_RADIUS + 10;
    const outer = CLOCK_RADIUS + (i % 3 === 0 ? 44 : 30);
    ctx.strokeStyle = tickColor;
    ctx.lineWidth = i % 3 === 0 ? 4 : 2.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }

  ctx.save();
  ctx.rotate(state.aimAngle);
  ctx.strokeStyle = handColor;
  ctx.lineCap = "square";

  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(CLOCK_RADIUS * 0.78, 0);
  ctx.stroke();

  ctx.rotate(getHourHandAngle() - state.aimAngle);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(CLOCK_RADIUS * 0.54, 0);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = handColor;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawBullets() {
  ctx.fillStyle = "#5ad6ff";
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, BULLET_RADIUS, 0, TAU);
    ctx.fill();
  }
}

function drawEnemies() {
  const enemyImage = isThemeInverted() ? enemyImages.day : enemyImages.night;
  for (const enemy of state.enemies) {
    const radius = getEnemyRadius(enemy);
    if (radius <= 0 || radius > FIELD_RADIUS) {
      continue;
    }
    const x = CENTER.x + Math.cos(enemy.angle) * radius;
    const y = CENTER.y + Math.sin(enemy.angle) * radius;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(enemy.angle + Math.PI / 2);
    ctx.drawImage(enemyImage, -ENEMY_SIZE / 2, -ENEMY_SIZE / 2, ENEMY_SIZE, ENEMY_SIZE);
    ctx.restore();
  }
}

function drawCenterWarning() {
  if (state.hp > 2) {
    return;
  }
  const pulse = 0.5 + Math.sin(performance.now() / 140) * 0.5;
  ctx.save();
  ctx.translate(CENTER.x, CENTER.y);
  ctx.strokeStyle = `rgba(255, 93, 115, ${0.2 + pulse * 0.4})`;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 28 + pulse * 22, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function render() {
  drawField();
  drawEnemies();
  drawBullets();
  drawCenterWarning();
}

function loop(now) {
  if (!state.running) {
    render();
    return;
  }

  const dt = Math.min((now - state.lastFrame) / 1000, 0.033);
  state.lastFrame = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function endGame() {
  state.running = false;
  state.keys.clear();
  syncTheme();
  startButton.textContent = "Retry";
  overlay.hidden = false;
  overlay.querySelector("p").textContent = `Score ${state.score} / Time ${state.gameTime.toFixed(1)}。時間操作で敵をずらしつつ再挑戦できます。`;
  updateHud();
}

window.addEventListener("keydown", (event) => {
  if (event.code === "ArrowLeft" || event.code === "ArrowRight" || event.code === "KeyA" || event.code === "KeyD") {
    event.preventDefault();
    state.keys.add(event.code);
  }
});

window.addEventListener("keyup", (event) => {
  state.keys.delete(event.code);
});

canvas.addEventListener("pointerdown", (event) => {
  if (!state.running) {
    return;
  }
  state.draggingPointerId = event.pointerId;
  state.pointerAngle = getPointerAngle(event);
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (state.draggingPointerId !== event.pointerId || state.pointerAngle === null) {
    return;
  }

  const nextAngle = getPointerAngle(event);
  const delta = normalizeAngle(nextAngle - state.pointerAngle);
  state.pendingPointerDelta += delta;
  state.pointerAngle = nextAngle;
});

function stopPointerDrag(event) {
  if (state.draggingPointerId !== event.pointerId) {
    return;
  }

  state.draggingPointerId = null;
  state.pointerAngle = null;
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

canvas.addEventListener("pointerup", stopPointerDrag);
canvas.addEventListener("pointercancel", stopPointerDrag);

startButton.addEventListener("click", () => {
  overlay.hidden = true;
  resetGame();
  requestAnimationFrame(loop);
});

enemyImages.day.addEventListener("load", render);
enemyImages.night.addEventListener("load", render);
updateThemeStyles();
render();
