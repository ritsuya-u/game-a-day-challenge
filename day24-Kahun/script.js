(() => {
  const GAME_TIME = 30;
  const POLLEN_COUNT = 30;
  const GOAL_RATIO = 0.08;
  const MAX_POLLEN_RADIUS = 10;
  const MIN_HAIR_GAP = MAX_POLLEN_RADIUS + 2;

  const titleScreen = document.getElementById("title-screen");
  const playScreen = document.getElementById("play-screen");
  const resultScreen = document.getElementById("result-screen");

  const startButton = document.getElementById("start-button");
  const backButton = document.getElementById("back-button");
  const timerEl = document.getElementById("timer");
  const resultTextEl = document.getElementById("result-text");

  const titleLogo = document.getElementById("title-logo");
  const titleKahun = document.getElementById("title-kahun");

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const pointer = {
    x: 0,
    y: 0,
    active: false,
  };

  let pollenList = [];
  let noseHairs = [];
  let reachedCount = 0;
  let timeLeft = GAME_TIME;
  let running = false;
  let lastTimestamp = 0;

  function safeImageFallback(img, fallbackText) {
    img.addEventListener("error", () => {
      img.replaceWith(createFallbackTitle(fallbackText));
    });
  }

  function createFallbackTitle(text) {
    const el = document.createElement("h1");
    el.textContent = text;
    el.style.fontSize = "clamp(48px, 8vw, 94px)";
    el.style.margin = "0";
    el.style.fontWeight = "900";
    return el;
  }

  safeImageFallback(titleLogo, "花粉の大冒険");
  safeImageFallback(titleKahun, "☀");

  function switchScreen(target) {
    titleScreen.classList.remove("active");
    playScreen.classList.remove("active");
    resultScreen.classList.remove("active");
    target.classList.add("active");
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));
    if (running) {
      noseHairs = generateNoseHairs(canvas.width, canvas.height);
    }
  }

  function formatTime(sec) {
    const whole = Math.max(0, Math.ceil(sec));
    const m = Math.floor(whole / 60);
    const s = whole % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function createPollen(width, height) {
    const startX = random(16, width * 0.16);
    const startY = random(height * 0.25, height * 0.75);
    return {
      x: startX,
      y: startY,
      vx: random(-20, 20),
      vy: random(-20, 20),
      r: random(7, 10),
      variation: random(0.82, 1.18),
      alive: true,
    };
  }

  function generateNoseHairs(width, height) {
    const hairs = [];
    const perSide = 6;
    const xMin = width * 0.22;
    const xMax = width * 0.9;
    const usedX = [];

    function pickX() {
      for (let tries = 0; tries < 120; tries += 1) {
        const x = random(xMin, xMax);
        let ok = true;
        for (const used of usedX) {
          if (Math.abs(used - x) < MIN_HAIR_GAP) {
            ok = false;
            break;
          }
        }
        if (ok) {
          usedX.push(x);
          return x;
        }
      }
      const fallback = random(xMin, xMax);
      usedX.push(fallback);
      return fallback;
    }

    for (let i = 0; i < perSide * 2; i += 1) {
      const fromTop = i < perSide;
      const x = pickX();
      const segs = [];
      const steps = 12;
      const length = random(height * 0.28, height * 0.62);
      const yStart = fromTop ? 0 : height;
      const yEnd = fromTop ? Math.min(height, length) : Math.max(0, height - length);
      let prev = { x, y: yStart };

      for (let j = 1; j <= steps; j += 1) {
        const t = j / steps;
        const y = yStart + (yEnd - yStart) * t;
        const wave = Math.sin(t * Math.PI * 5 + i) * random(4, 10);
        const nx = x + wave;
        const cur = { x: nx, y };
        segs.push({ a: prev, b: cur });
        prev = cur;
      }

      hairs.push({ segs });
    }
    return hairs;
  }

  function initGame() {
    resizeCanvas();
    reachedCount = 0;
    timeLeft = GAME_TIME;
    timerEl.textContent = formatTime(timeLeft);
    pollenList = Array.from({ length: POLLEN_COUNT }, () =>
      createPollen(canvas.width, canvas.height)
    );
    noseHairs = generateNoseHairs(canvas.width, canvas.height);
  }

  function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const abLen2 = abx * abx + aby * aby;
    if (abLen2 === 0) {
      return { x: ax, y: ay, t: 0 };
    }
    let t = ((px - ax) * abx + (py - ay) * aby) / abLen2;
    t = Math.max(0, Math.min(1, t));
    return { x: ax + abx * t, y: ay + aby * t, t };
  }

  function handleHairCollision(p) {
    const hairThickness = 6;
    for (const hair of noseHairs) {
      for (const seg of hair.segs) {
        const c = closestPointOnSegment(
          p.x,
          p.y,
          seg.a.x,
          seg.a.y,
          seg.b.x,
          seg.b.y
        );
        let nx = p.x - c.x;
        let ny = p.y - c.y;
        let d2 = nx * nx + ny * ny;
        if (d2 < 0.0001) {
          nx = 1;
          ny = 0;
          d2 = 1;
        }
        const d = Math.sqrt(d2);
        const hitDist = p.r + hairThickness * 0.5;
        if (d < hitDist) {
          const inv = 1 / d;
          nx *= inv;
          ny *= inv;

          const overlap = hitDist - d;
          p.x += nx * overlap;
          p.y += ny * overlap;

          const vn = p.vx * nx + p.vy * ny;
          if (vn < 0) {
            const restitution = 0.6;
            p.vx -= (1 + restitution) * vn * nx;
            p.vy -= (1 + restitution) * vn * ny;
          }
        }
      }
    }
  }

  function handleWallCollision(p) {
    const restitution = 0.7;
    if (p.y < p.r) {
      p.y = p.r;
      if (p.vy < 0) p.vy = -p.vy * restitution;
    } else if (p.y > canvas.height - p.r) {
      p.y = canvas.height - p.r;
      if (p.vy > 0) p.vy = -p.vy * restitution;
    }
  }

  function getCentroid() {
    let sx = 0;
    let sy = 0;
    let c = 0;
    for (const p of pollenList) {
      if (!p.alive) continue;
      sx += p.x;
      sy += p.y;
      c += 1;
    }
    if (c === 0) {
      return { x: canvas.width * 0.1, y: canvas.height * 0.5, count: 0 };
    }
    return { x: sx / c, y: sy / c, count: c };
  }

  function update(dt) {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      endGame();
      return;
    }
    timerEl.textContent = formatTime(timeLeft);

    const centroid = getCentroid();
    let pullX = 0;
    let pullY = 0;

    if (pointer.active && centroid.count > 0) {
      const dx = pointer.x - centroid.x;
      const dy = pointer.y - centroid.y;
      const len = Math.hypot(dx, dy) || 1;
      const strength = 400;
      pullX = (dx / len) * strength;
      pullY = (dy / len) * strength;
    }

    const goalX = canvas.width * (1 - GOAL_RATIO);

    for (const p of pollenList) {
      if (!p.alive) continue;

      p.vx += (pullX * p.variation + random(-50, 50)) * dt;
      p.vy += (pullY * p.variation + random(-50, 50)) * dt;

      p.vx *= 0.985;
      p.vy *= 0.985;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      handleHairCollision(p);
      handleWallCollision(p);

      if (p.x >= goalX) {
        p.alive = false;
        reachedCount += 1;
        continue;
      }

      if (
        p.x < -p.r ||
        p.x > canvas.width + p.r
      ) {
        p.alive = false;
      }
    }
  }

  function drawPollen(p) {
    const spikes = 8;
    ctx.save();
    ctx.translate(p.x, p.y);

    ctx.strokeStyle = "#d98600";
    ctx.lineWidth = 2;
    for (let i = 0; i < spikes; i += 1) {
      const a = (Math.PI * 2 * i) / spikes;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (p.r - 1), Math.sin(a) * (p.r - 1));
      ctx.lineTo(Math.cos(a) * (p.r + 4), Math.sin(a) * (p.r + 4));
      ctx.stroke();
    }

    const grad = ctx.createRadialGradient(-2, -2, 1, 0, 0, p.r + 2);
    grad.addColorStop(0, "#fff38f");
    grad.addColorStop(0.5, "#ffd724");
    grad.addColorStop(1, "#f3b300");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ee9298";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(0, 0, canvas.width * 0.12, canvas.height);

    const goalX = canvas.width * (1 - GOAL_RATIO);
    ctx.fillStyle = "#50a9df";
    ctx.fillRect(goalX, 0, canvas.width - goalX, canvas.height);

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 7;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    for (const hair of noseHairs) {
      ctx.beginPath();
      const first = hair.segs[0].a;
      ctx.moveTo(first.x, first.y);
      for (const seg of hair.segs) {
        ctx.lineTo(seg.b.x, seg.b.y);
      }
      ctx.stroke();
    }

    for (const p of pollenList) {
      if (p.alive) drawPollen(p);
    }
  }

  function loop(ts) {
    if (!running) return;
    if (!lastTimestamp) lastTimestamp = ts;
    const dt = Math.min((ts - lastTimestamp) / 1000, 0.033);
    lastTimestamp = ts;

    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function endGame() {
    running = false;
    pointer.active = false;
    lastTimestamp = 0;

    if (reachedCount === 0) {
      resultTextEl.textContent = "くしゃみは起こらなかった";
    } else {
      resultTextEl.textContent = `くしゃみ${reachedCount}連発`;
    }
    switchScreen(resultScreen);
  }

  function startGame() {
    switchScreen(playScreen);
    initGame();
    running = true;
    lastTimestamp = 0;
    requestAnimationFrame(loop);
  }

  function updatePointerFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = clientX - rect.left;
    pointer.y = clientY - rect.top;
  }

  startButton.addEventListener("click", startGame);
  backButton.addEventListener("click", () => {
    switchScreen(titleScreen);
  });

  window.addEventListener("resize", resizeCanvas);

  canvas.addEventListener("mousemove", (e) => {
    updatePointerFromClient(e.clientX, e.clientY);
  });
  canvas.addEventListener("mouseenter", () => {
    pointer.active = true;
  });
  canvas.addEventListener("mouseleave", () => {
    pointer.active = false;
  });
  canvas.addEventListener("mousedown", () => {
    pointer.active = true;
  });
  window.addEventListener("mouseup", () => {
    pointer.active = false;
  });

  canvas.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      updatePointerFromClient(t.clientX, t.clientY);
      pointer.active = true;
      e.preventDefault();
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      updatePointerFromClient(t.clientX, t.clientY);
      pointer.active = true;
      e.preventDefault();
    },
    { passive: false }
  );

  canvas.addEventListener("touchend", () => {
    pointer.active = false;
  });

  switchScreen(titleScreen);
})();

