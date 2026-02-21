(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const titleScreen = document.getElementById("titleScreen");
  const resultScreen = document.getElementById("resultScreen");
  const hud = document.getElementById("hud");

  const distanceValue = document.getElementById("distanceValue");
  const hitsValue = document.getElementById("hitsValue");
  const resultTitle = document.getElementById("resultTitle");
  const resultDistance = document.getElementById("resultDistance");

  const startButton = document.getElementById("startButton");
  const retryButton = document.getElementById("retryButton");
  const titleButton = document.getElementById("titleButton");

  const GAME_STATE = {
    TITLE: "title",
    PLAYING: "playing",
    RESULT: "result",
  };

  let state = GAME_STATE.TITLE;
  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.max(1, window.devicePixelRatio || 1);

  let lastTime = performance.now();
  let elapsed = 0;
  let cameraShakeTime = 0;

  const GOAL_DISTANCE = 5200;
  const DISTANCE_SCALE = 20;
  const PLAYER_RADIUS = 24;

  const inputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    touchPointerId: null,
    touchDirection: 0,
    pendingQueue: [],
    delayedFrames: 8,
  };

  const player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    hits: 0,
    nextDamageTime: 0,
  };

  const drunk = {
    smoothNoise: 0,
    noiseTarget: 0,
    noiseTimer: 0,
    eventActiveUntil: 0,
    nextEventTime: 7,
    invertControl: false,
    intensityMul: 1,
  };

  const course = {
    obstacles: [],
  };

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function centerAt(y) {
    return Math.sin(y * 0.0032) * 95 + Math.sin(y * 0.0015 + 1.3) * 68;
  }

  function widthAt(y) {
    return 320 + Math.sin(y * 0.0025 + 0.8) * 42;
  }

  function leftWall(y) {
    return centerAt(y) - widthAt(y) * 0.5;
  }

  function rightWall(y) {
    return centerAt(y) + widthAt(y) * 0.5;
  }

  function createObstacles() {
    course.obstacles = [];
    let y = 720;

    while (y < GOAL_DISTANCE - 260) {
      const roadW = widthAt(y);
      const center = centerAt(y);
      const isLeft = Math.random() < 0.5;
      const obstacleW = roadW * 0.52;
      const obstacleH = 118;
      const x = isLeft
        ? center - roadW * 0.5 + obstacleW * 0.5
        : center + roadW * 0.5 - obstacleW * 0.5;

      course.obstacles.push({
        x,
        y,
        w: obstacleW,
        h: obstacleH,
      });

      y += 460 + Math.random() * 300;
    }
  }

  function toDisplayDistance(worldDistance) {
    return Math.max(0, Math.floor(worldDistance / DISTANCE_SCALE));
  }

  function showScreen(nextState) {
    state = nextState;
    titleScreen.classList.toggle("active", state === GAME_STATE.TITLE);
    resultScreen.classList.toggle("active", state === GAME_STATE.RESULT);
    hud.classList.toggle("active", state === GAME_STATE.PLAYING);
  }

  function resetRun() {
    player.x = 0;
    player.y = 0;
    player.vx = 0;
    player.vy = 0;
    player.hits = 0;
    player.nextDamageTime = 0;

    inputState.pendingQueue = [];

    drunk.smoothNoise = 0;
    drunk.noiseTarget = 0;
    drunk.noiseTimer = 0;
    drunk.eventActiveUntil = 0;
    drunk.nextEventTime = 6.5 + Math.random() * 4;
    drunk.invertControl = false;
    drunk.intensityMul = 1;

    elapsed = 0;
    cameraShakeTime = 0;

    createObstacles();
    updateHud();
  }

  function startGame() {
    resetRun();
    showScreen(GAME_STATE.PLAYING);
  }

  function backToTitle() {
    showScreen(GAME_STATE.TITLE);
  }

  function finishGame(cleared) {
    showScreen(GAME_STATE.RESULT);
    resultTitle.textContent = cleared ? "泥酔ゴール" : "転倒";
    resultDistance.textContent = toDisplayDistance(player.y);
  }

  function updateHud() {
    distanceValue.textContent = toDisplayDistance(player.y);
    hitsValue.textContent = player.hits;
  }

  function queueInput() {
    const x = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
    const y = (inputState.up ? 1 : 0) - (inputState.down ? 1 : 0);
    inputState.pendingQueue.push({ x, y });
    if (inputState.pendingQueue.length > inputState.delayedFrames + 1) {
      return inputState.pendingQueue.shift();
    }
    return { x: 0, y: 0 };
  }

  function updateDrunk(dt) {
    drunk.noiseTimer -= dt;
    if (drunk.noiseTimer <= 0) {
      drunk.noiseTimer = 0.45 + Math.random() * 0.9;
      drunk.noiseTarget = (Math.random() - 0.5) * 0.85;
    }
    drunk.smoothNoise += (drunk.noiseTarget - drunk.smoothNoise) * dt * 2.4;

    if (elapsed >= drunk.nextEventTime) {
      const duration = 1.3 + Math.random() * 0.8;
      drunk.eventActiveUntil = elapsed + duration;
      drunk.invertControl = Math.random() < 0.45;
      drunk.nextEventTime = elapsed + 7 + Math.random() * 6;
    }

    if (elapsed < drunk.eventActiveUntil) {
      drunk.intensityMul = 1.85;
    } else {
      drunk.intensityMul = 1;
      drunk.invertControl = false;
    }
  }

  function applyPhysics(dt) {
    const delayed = queueInput();
    const controlX = drunk.invertControl ? -delayed.x : delayed.x;
    const controlY = delayed.y;

    const rawAx = controlX * 620;
    const rawAy = 340 + controlY * 280;

    const noiseAngle = drunk.smoothNoise + Math.sin(elapsed * 0.8) * 0.12;
    const cos = Math.cos(noiseAngle);
    const sin = Math.sin(noiseAngle);

    let ax = rawAx * cos - rawAy * sin;
    let ay = rawAx * sin + rawAy * cos;

    const driftX =
      Math.sin(elapsed * 1.1) * 220 +
      Math.sin(elapsed * 2.0 + 1.8) * 140;
    const driftY = Math.sin(elapsed * 1.4 + 2.3) * 40;

    ax += driftX * drunk.intensityMul;
    ay += driftY * drunk.intensityMul;

    player.vx += ax * dt;
    player.vy += ay * dt;

    player.vx *= Math.pow(0.2, dt);
    player.vy *= Math.pow(0.1, dt);

    const minForward = 145;
    if (player.vy < minForward) {
      player.vy = minForward;
    }

    player.x += player.vx * dt;
    player.y += player.vy * dt;
  }

  function circleRectCollision(cx, cy, r, rect) {
    const closestX = Math.max(rect.x - rect.w * 0.5, Math.min(cx, rect.x + rect.w * 0.5));
    const closestY = Math.max(rect.y - rect.h * 0.5, Math.min(cy, rect.y + rect.h * 0.5));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= r * r;
  }

  function runCollision() {
    const lw = leftWall(player.y);
    const rw = rightWall(player.y);

    if (player.x - PLAYER_RADIUS < lw || player.x + PLAYER_RADIUS > rw) {
      finishGame(false);
      return;
    }

    for (const obstacle of course.obstacles) {
      if (Math.abs(obstacle.y - player.y) > 130) {
        continue;
      }
      if (!circleRectCollision(player.x, player.y, PLAYER_RADIUS, obstacle)) {
        continue;
      }
      if (elapsed < player.nextDamageTime) {
        continue;
      }

      player.nextDamageTime = elapsed + 0.55;
      player.hits += 1;
      player.vx *= -0.45;
      player.vy *= 0.6;

      if (player.hits >= 4) {
        finishGame(false);
        return;
      }
    }

    if (player.y >= GOAL_DISTANCE) {
      finishGame(true);
    }
  }

  function worldToScreen(wx, wy, cameraY) {
    const anchorX = width * 0.5;
    const anchorY = height * 0.72;
    return {
      x: anchorX + wx,
      y: anchorY - (wy - cameraY),
    };
  }

  function drawCourse(cameraY) {
    const step = 34;
    const startY = cameraY - height * 0.9;
    const endY = cameraY + height * 1.2;

    ctx.beginPath();
    let first = true;
    for (let y = startY; y <= endY; y += step) {
      const p = worldToScreen(leftWall(y), y, cameraY);
      if (first) {
        ctx.moveTo(p.x, p.y);
        first = false;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    for (let y = endY; y >= startY; y -= step) {
      const p = worldToScreen(rightWall(y), y, cameraY);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = "#020202";
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = "#f3f3f3";
    ctx.beginPath();
    first = true;
    for (let y = startY; y <= endY; y += step) {
      const p = worldToScreen(leftWall(y), y, cameraY);
      if (first) {
        ctx.moveTo(p.x, p.y);
        first = false;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();

    ctx.beginPath();
    first = true;
    for (let y = startY; y <= endY; y += step) {
      const p = worldToScreen(rightWall(y), y, cameraY);
      if (first) {
        ctx.moveTo(p.x, p.y);
        first = false;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();

    for (const obstacle of course.obstacles) {
      if (obstacle.y < startY - 120 || obstacle.y > endY + 120) {
        continue;
      }
      const p = worldToScreen(obstacle.x, obstacle.y, cameraY);
      ctx.fillStyle = "#ffd400";
      ctx.fillRect(
        p.x - obstacle.w * 0.5,
        p.y - obstacle.h * 0.5,
        obstacle.w,
        obstacle.h
      );
    }

    const goalY = GOAL_DISTANCE;
    if (goalY > startY - 50 && goalY < endY + 50) {
      const c = centerAt(goalY);
      const w = widthAt(goalY);
      const p = worldToScreen(c, goalY, cameraY);
      ctx.fillStyle = "#6df08e";
      ctx.fillRect(p.x - w * 0.5, p.y - 8, w, 16);
      ctx.fillStyle = "#d6ffe2";
      ctx.font = "700 18px 'Yu Gothic UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GOAL", p.x, p.y - 14);
    }
  }

  function drawPlayer(cameraY) {
    const p = worldToScreen(player.x, player.y, cameraY);
    const r = PLAYER_RADIUS;

    ctx.fillStyle = "#ff3b57";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1d1d1d";
    ctx.beginPath();
    ctx.arc(p.x - r * 0.24, p.y - r * 0.15, r * 0.09, 0, Math.PI * 2);
    ctx.arc(p.x + r * 0.24, p.y - r * 0.15, r * 0.09, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = "#1d1d1d";
    ctx.beginPath();
    ctx.arc(p.x, p.y + r * 0.08, r * 0.34, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();

    if (drunk.eventActiveUntil > elapsed) {
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 8 + Math.sin(elapsed * 18) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function render() {
    ctx.clearRect(0, 0, width, height);

    if (state === GAME_STATE.TITLE) {
      return;
    }

    const cameraY = player.y;
    const shakeStrength = drunk.eventActiveUntil > elapsed ? 5 : 2.8;
    const shakeX = Math.sin(cameraShakeTime * 1.1) * shakeStrength;
    const shakeY = Math.sin(cameraShakeTime * 1.7 + 1.6) * shakeStrength;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawCourse(cameraY);
    drawPlayer(cameraY);

    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;

    if (state === GAME_STATE.PLAYING) {
      elapsed += dt;
      cameraShakeTime += dt;
      updateDrunk(dt);
      applyPhysics(dt);
      runCollision();
      updateHud();
    }

    render();
    requestAnimationFrame(frame);
  }

  function setDirectionByTouch(clientX) {
    inputState.left = clientX < width * 0.5;
    inputState.right = !inputState.left;
    inputState.touchDirection = inputState.left ? -1 : 1;
  }

  function clearTouchDirection() {
    inputState.touchDirection = 0;
    inputState.left = false;
    inputState.right = false;
  }

  window.addEventListener("resize", resize);

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key)) {
      event.preventDefault();
    }

    if (state === GAME_STATE.TITLE && (key === " " || key === "enter")) {
      startGame();
      return;
    }

    if (key === "a" || key === "arrowleft") inputState.left = true;
    if (key === "d" || key === "arrowright") inputState.right = true;
    if (key === "w" || key === "arrowup") inputState.up = true;
    if (key === "s" || key === "arrowdown") inputState.down = true;
  });

  document.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key === "a" || key === "arrowleft") inputState.left = false;
    if (key === "d" || key === "arrowright") inputState.right = false;
    if (key === "w" || key === "arrowup") inputState.up = false;
    if (key === "s" || key === "arrowdown") inputState.down = false;
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (state === GAME_STATE.PLAYING) {
      inputState.touchPointerId = event.pointerId;
      setDirectionByTouch(event.clientX);
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (state !== GAME_STATE.PLAYING) return;
    if (inputState.touchPointerId !== event.pointerId) return;
    setDirectionByTouch(event.clientX);
  });

  const endPointer = (event) => {
    if (inputState.touchPointerId !== event.pointerId) return;
    inputState.touchPointerId = null;
    clearTouchDirection();
  };

  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  startButton.addEventListener("click", startGame);
  titleScreen.addEventListener("click", (event) => {
    if (state !== GAME_STATE.TITLE) return;
    if (event.target.closest("button")) return;
    startGame();
  });
  retryButton.addEventListener("click", startGame);
  titleButton.addEventListener("click", backToTitle);

  resize();
  showScreen(GAME_STATE.TITLE);
  requestAnimationFrame(frame);
})();
