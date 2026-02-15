const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const startBtn = document.getElementById("startBtn");

const PADDLE_WIDTH = 120;
const PADDLE_HEIGHT = 14;
const PADDLE_SPEED = 8;

const BALL_RADIUS = 8;
const BALL_SPEED = 4.4;

const BRICK_ROWS = 6;
const BRICK_COLS = 10;
const BRICK_WIDTH = 68;
const BRICK_HEIGHT = 22;
const BRICK_PADDING = 8;
const BRICK_OFFSET_TOP = 55;
const BRICK_OFFSET_LEFT = 20;

const MAX_LIVES = 3;
const BLOCK_SE_VOLUME = 0.75;
const BLOCK_SE_POOL_SIZE = 2;
const audioFiles = Array.from({ length: 42 }, (_, i) => `audio/${i + 1}.mp3`);

const blockSePool = audioFiles.map((src) =>
  Array.from({ length: BLOCK_SE_POOL_SIZE }, () => {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = BLOCK_SE_VOLUME;
    return audio;
  })
);

let score = 0;
let lives = MAX_LIVES;
let running = false;
let gameOver = false;
let win = false;

let paddleX = (canvas.width - PADDLE_WIDTH) / 2;
let rightPressed = false;
let leftPressed = false;

let ballX = canvas.width / 2;
let ballY = canvas.height - 60;
let dx = BALL_SPEED;
let dy = -BALL_SPEED;

let bricks = [];

function preloadBlockSounds() {
  for (const sounds of blockSePool) {
    for (const sound of sounds) {
      sound.load();
    }
  }
}

function createBricks() {
  bricks = [];
  for (let row = 0; row < BRICK_ROWS; row++) {
    const line = [];
    for (let col = 0; col < BRICK_COLS; col++) {
      line.push({ x: 0, y: 0, alive: true });
    }
    bricks.push(line);
  }
}

function resetBallAndPaddle() {
  paddleX = (canvas.width - PADDLE_WIDTH) / 2;
  ballX = canvas.width / 2;
  ballY = canvas.height - 60;

  const dir = Math.random() > 0.5 ? 1 : -1;
  dx = BALL_SPEED * dir;
  dy = -BALL_SPEED;
}

function resetGame() {
  score = 0;
  lives = MAX_LIVES;
  gameOver = false;
  win = false;
  running = true;

  createBricks();
  resetBallAndPaddle();
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(score);
  livesEl.textContent = String(lives);
}

function playRandomBlockSound() {
  const sounds = blockSePool[Math.floor(Math.random() * blockSePool.length)];
  const reusable = sounds.find((sound) => sound.paused || sound.ended) || sounds[0];

  reusable.currentTime = 0;
  reusable.play().catch(() => {
    // Ignore autoplay/promise errors after state changes.
  });
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = "#ffcad4";
  ctx.fill();
  ctx.closePath();
}

function drawPaddle() {
  ctx.fillStyle = "#66c7f4";
  ctx.fillRect(paddleX, canvas.height - PADDLE_HEIGHT - 12, PADDLE_WIDTH, PADDLE_HEIGHT);
}

function brickColor(row, col) {
  const hue = 10 + (row * BRICK_COLS + col) * 5;
  return `hsl(${hue % 360} 75% 60%)`;
}

function drawBricks() {
  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      const brick = bricks[row][col];
      if (!brick.alive) {
        continue;
      }

      const x = col * (BRICK_WIDTH + BRICK_PADDING) + BRICK_OFFSET_LEFT;
      const y = row * (BRICK_HEIGHT + BRICK_PADDING) + BRICK_OFFSET_TOP;

      brick.x = x;
      brick.y = y;

      ctx.fillStyle = brickColor(row, col);
      ctx.fillRect(x, y, BRICK_WIDTH, BRICK_HEIGHT);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.strokeRect(x, y, BRICK_WIDTH, BRICK_HEIGHT);
    }
  }
}

function drawMessage() {
  if (running && !gameOver && !win) {
    return;
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";

  if (!running && !gameOver && !win) {
    ctx.font = "bold 34px sans-serif";
    ctx.fillText("Startでゲーム開始", canvas.width / 2, canvas.height / 2 - 12);
    ctx.font = "22px sans-serif";
    ctx.fillText("ブロックを壊して音を鳴らそう", canvas.width / 2, canvas.height / 2 + 28);
  } else if (win) {
    ctx.font = "bold 40px sans-serif";
    ctx.fillText("YOU WIN!", canvas.width / 2, canvas.height / 2 - 4);
    ctx.font = "20px sans-serif";
    ctx.fillText("Start / Restartで再挑戦", canvas.width / 2, canvas.height / 2 + 30);
  } else if (gameOver) {
    ctx.font = "bold 40px sans-serif";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 4);
    ctx.font = "20px sans-serif";
    ctx.fillText("Start / Restartで再挑戦", canvas.width / 2, canvas.height / 2 + 30);
  }
}

function detectBrickCollision() {
  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      const brick = bricks[row][col];
      if (!brick.alive) {
        continue;
      }

      const hitX = ballX > brick.x && ballX < brick.x + BRICK_WIDTH;
      const hitY = ballY > brick.y && ballY < brick.y + BRICK_HEIGHT;

      if (hitX && hitY) {
        brick.alive = false;
        dy = -dy;
        score += 1;
        updateHud();
        playRandomBlockSound();

        if (score === BRICK_ROWS * BRICK_COLS) {
          running = false;
          win = true;
        }
        return;
      }
    }
  }
}

function movePaddle() {
  if (rightPressed && paddleX < canvas.width - PADDLE_WIDTH) {
    paddleX += PADDLE_SPEED;
  }
  if (leftPressed && paddleX > 0) {
    paddleX -= PADDLE_SPEED;
  }
}

function updateBall() {
  if (ballX + dx > canvas.width - BALL_RADIUS || ballX + dx < BALL_RADIUS) {
    dx = -dx;
  }

  if (ballY + dy < BALL_RADIUS) {
    dy = -dy;
  } else if (ballY + dy > canvas.height - BALL_RADIUS - PADDLE_HEIGHT - 12) {
    const paddleTop = canvas.height - PADDLE_HEIGHT - 12;
    const withinPaddle = ballX > paddleX && ballX < paddleX + PADDLE_WIDTH;

    if (ballY < paddleTop + BALL_RADIUS + 2 && withinPaddle) {
      dy = -Math.abs(dy);

      const hitPos = (ballX - (paddleX + PADDLE_WIDTH / 2)) / (PADDLE_WIDTH / 2);
      dx = BALL_SPEED * hitPos;
    } else if (ballY + dy > canvas.height - BALL_RADIUS) {
      lives -= 1;
      updateHud();

      if (lives <= 0) {
        running = false;
        gameOver = true;
      } else {
        resetBallAndPaddle();
      }
      return;
    }
  }

  ballX += dx;
  ballY += dy;
}

function drawFrame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBricks();
  drawBall();
  drawPaddle();
  drawMessage();
}

function tick() {
  if (running) {
    movePaddle();
    updateBall();
    detectBrickCollision();
  }

  drawFrame();
  requestAnimationFrame(tick);
}

function pointerMove(clientX) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  paddleX = Math.max(0, Math.min(x - PADDLE_WIDTH / 2, canvas.width - PADDLE_WIDTH));
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Right" || event.key === "ArrowRight") {
    rightPressed = true;
  } else if (event.key === "Left" || event.key === "ArrowLeft") {
    leftPressed = true;
  }
});

document.addEventListener("keyup", (event) => {
  if (event.key === "Right" || event.key === "ArrowRight") {
    rightPressed = false;
  } else if (event.key === "Left" || event.key === "ArrowLeft") {
    leftPressed = false;
  }
});

canvas.addEventListener("mousemove", (event) => {
  pointerMove(event.clientX);
});

canvas.addEventListener("touchmove", (event) => {
  if (!event.touches[0]) {
    return;
  }
  pointerMove(event.touches[0].clientX);
  event.preventDefault();
}, { passive: false });

startBtn.addEventListener("click", () => {
  resetGame();
});

preloadBlockSounds();
createBricks();
updateHud();
tick();
