// Screen nodes used for scene switching.
const screens = {
  title: document.getElementById("screen-title"),
  playIntro: document.getElementById("screen-play-intro"),
  playing: document.getElementById("screen-playing"),
  playEnd: document.getElementById("screen-play-end"),
  result: document.getElementById("screen-result"),
};

const toPlayIntroBtn = document.getElementById("toPlayIntroBtn");
const startPlayBtn = document.getElementById("startPlayBtn");
const toResultBtn = document.getElementById("toResultBtn");
const resultLinesEl = document.getElementById("resultLines");
const resultBackBtn = document.getElementById("resultBackBtn");

// Canvas setup and sprite assets.
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const assets = {
  player1: new Image(),
  player2: new Image(),
  handkerchief: new Image(),
};
assets.player1.src = "images/1.webp";
assets.player2.src = "images/2.webp";
assets.handkerchief.src = "images/handkerchief.webp";

// Input flags and core game state.
const keys = { left: false, right: false };
const game = {
  timeLimit: 30,
  remaining: 30,
  picked: 0,
  running: false,
  playerX: 640,
  playerY: 500,
  playerW: 204,
  playerH: 296,
  playerBaseH: 296,
  playerSpeed: 430,
  frameIndex: 0,
  frameTimer: 0,
  frameMs: 150,
  spawnTimer: 0,
  spawnMs: 400,
  handkerchiefs: [],
  ended: false,
};

const resultTimers = [];

// Show one screen and hide the others.
function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
  document.body.classList.toggle("result-mode", name === "result");
}

// Initialize a fresh play session.
function resetGame() {
  game.remaining = game.timeLimit;
  game.picked = 0;
  game.running = true;
  game.playerX = canvas.width / 2;
  game.playerY = 400;
  game.frameIndex = 0;
  game.frameTimer = 0;
  game.spawnTimer = 0;
  game.handkerchiefs = [];
  game.ended = false;
  keys.left = false;
  keys.right = false;
}

// Spawn a falling handkerchief with random x/speed.
function spawnHandkerchief() {
  const size = 96;
  const x = 40 + Math.random() * (canvas.width - 80 - size);
  const speed = 320 + Math.random() * 300;
  game.handkerchiefs.push({ x, y: -size, w: size, h: size, speed });
}

// Resolve facing/idle direction from current keys.
function getDirection() {
  if (keys.right) return "right";
  if (keys.left) return "left";
  return "idle";
}

// Keep sprite ratio while scaling player height.
function getPlayerSize(frameImage) {
  const h = game.playerBaseH;
  if (!frameImage.naturalWidth || !frameImage.naturalHeight) {
    return { w: game.playerW, h };
  }
  const w = Math.round((frameImage.naturalWidth / frameImage.naturalHeight) * h);
  return { w, h };
}

// Toggle 1.webp / 2.webp while moving.
function updatePlayerAnimation(dt) {
  const direction = getDirection();
  if (direction === "idle") {
    game.frameIndex = 0;
    game.frameTimer = 0;
    return;
  }
  game.frameTimer += dt;
  if (game.frameTimer >= game.frameMs) {
    game.frameTimer = 0;
    game.frameIndex = game.frameIndex === 0 ? 1 : 0;
  }
}

// AABB collision helper.
function intersects(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// Advance timer, movement, spawns, and pickups.
function updateGame(dt) {
  if (!game.running) return;

  game.remaining -= dt / 1000;
  if (game.remaining <= 0) {
    game.remaining = 0;
    game.running = false;
    game.ended = true;
    showScreen("playEnd");
    return;
  }

  const sec = dt / 1000;
  const frameImage = game.frameIndex === 0 ? assets.player1 : assets.player2;
  const playerSize = getPlayerSize(frameImage);
  game.playerW = playerSize.w;
  game.playerH = playerSize.h;

  if (keys.left) game.playerX -= game.playerSpeed * sec;
  if (keys.right) game.playerX += game.playerSpeed * sec;
  game.playerX = Math.max(20, Math.min(canvas.width - game.playerW - 20, game.playerX));

  updatePlayerAnimation(dt);

  game.spawnTimer += dt;
  if (game.spawnTimer >= game.spawnMs) {
    game.spawnTimer = 0;
    spawnHandkerchief();
  }

  const playerHitbox = {
    x: game.playerX + 8,
    y: game.playerY + 20,
    w: game.playerW - 16,
    h: game.playerH - 22,
  };

  for (let i = game.handkerchiefs.length - 1; i >= 0; i -= 1) {
    const h = game.handkerchiefs[i];
    h.y += h.speed * sec;
    if (intersects(playerHitbox, h)) {
      game.picked += 1;
      game.handkerchiefs.splice(i, 1);
      continue;
    }
    if (h.y > canvas.height + h.h) {
      game.handkerchiefs.splice(i, 1);
    }
  }
}

// Render gameplay HUD, player, and falling items.
function drawGame() {
  if (!screens.playing.classList.contains("active")) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ececd7";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const h of game.handkerchiefs) {
    ctx.drawImage(assets.handkerchief, h.x, h.y, h.w, h.h);
  }

  const direction = getDirection();
  const frameImage = game.frameIndex === 0 ? assets.player1 : assets.player2;

  if (direction === "left") {
    ctx.save();
    ctx.translate(game.playerX + game.playerW, game.playerY);
    ctx.scale(-1, 1);
    ctx.drawImage(frameImage, 0, 0, game.playerW, game.playerH);
    ctx.restore();
  } else {
    ctx.drawImage(frameImage, game.playerX, game.playerY, game.playerW, game.playerH);
  }

  ctx.fillStyle = "#111";
  ctx.font = "48px 'MS Gothic', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`0:${Math.ceil(game.remaining).toString().padStart(2, "0")}`, canvas.width - 38, 72);

  ctx.textAlign = "left";
  ctx.font = "34px 'MS Gothic', sans-serif";
  ctx.fillText(`拾った個数: ${game.picked}`, 30, canvas.height - 24);
}

// Convert pickup count to chocolate count + comment.
function scoreFromPicked(h) {
  if (h === 1) {
    return {
      c: 1,
      comment: "あのときはハンカチを拾ってくれてありがとう！お返しだよ^^",
    };
  }
  if (h >= 10) {
    return {
      c: 0,
      comment: "チョコレートが欲しいからって必死になりすぎじゃない？",
    };
  }
  if (h >= 2) {
    return {
      c: 0,
      comment: "どうせ他の女にも優しくしてるんでしょ？",
    };
  }
  return {
    c: 0,
    comment: "えっと、誰ですか？",
  };
}

// Cleanup queued line-reveal timers.
function clearResultTimers() {
  while (resultTimers.length) {
    clearTimeout(resultTimers.pop());
  }
}

// Build and reveal result lines in sequence.
function showResult() {
  clearResultTimers();
  resultLinesEl.innerHTML = "";
  resultBackBtn.classList.remove("visible");

  const score = scoreFromPicked(game.picked);
  const lines = [
    { text: "2月14日...", className: "result-line-date" },
    { text: "もらったチョコレートの数", className: "result-line-label" },
    { text: `${score.c}コ`, className: "result-line-score" },
    { text: "女子からのコメント", className: "result-line-label" },
    { text: score.comment, className: "result-line-comment" },
  ];

  lines.forEach((line, idx) => {
    const item = document.createElement("div");
    item.className = `result-line ${line.className}`;
    item.textContent = line.text;
    resultLinesEl.appendChild(item);

    const timer = setTimeout(() => {
      item.classList.add("visible");
      if (idx === lines.length - 1) {
        const btnTimer = setTimeout(() => {
          resultBackBtn.classList.add("visible");
        }, 450);
        resultTimers.push(btnTimer);
      }
    }, 420 + idx * 760);
    resultTimers.push(timer);
  });
}

// Start gameplay from intro screen.
function startPlayFlow() {
  resetGame();
  showScreen("playing");
}

// Screen button handlers.
toPlayIntroBtn.addEventListener("click", () => {
  showScreen("playIntro");
});

startPlayBtn.addEventListener("click", () => {
  startPlayFlow();
});

toResultBtn.addEventListener("click", () => {
  showScreen("result");
  showResult();
});

resultBackBtn.addEventListener("click", () => {
  clearResultTimers();
  showScreen("title");
});

// Arrow key mapping helper.
function keyToName(event) {
  if (event.key === "ArrowLeft") return "left";
  if (event.key === "ArrowRight") return "right";
  return null;
}

// Keyboard input listeners.
window.addEventListener("keydown", (event) => {
  if (!game.running) return;
  const keyName = keyToName(event);
  if (!keyName) return;
  event.preventDefault();
  keys[keyName] = true;
});

window.addEventListener("keyup", (event) => {
  const keyName = keyToName(event);
  if (!keyName) return;
  event.preventDefault();
  keys[keyName] = false;
});

window.addEventListener("blur", () => {
  keys.left = false;
  keys.right = false;
});

// Main animation loop.
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(40, now - lastTime);
  lastTime = now;
  updateGame(dt);
  drawGame();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);


