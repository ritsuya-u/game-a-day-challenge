const COLS = 12;
const ROWS = 24;
const TRI = 30;
const W = COLS * TRI;
const H = ROWS * TRI;
const BG = "#111a28";

const COLORS = ["#ef4444", "#22c55e", "#3b82f6", "#eab308", "#a855f7", "#f97316", "#14b8a6"];
const SHAPES = [
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[2, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[1, 0], [2, 0], [0, 1], [1, 1]],
  [[1, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
];

const boardCanvas = document.getElementById("board");
const ctx = boardCanvas.getContext("2d");
boardCanvas.width = W;
boardCanvas.height = H;

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");

const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const downBtn = document.getElementById("downBtn");
const rotLBtn = document.getElementById("rotLBtn");
const rotRBtn = document.getElementById("rotRBtn");
const restartBtn = document.getElementById("restartBtn");

let board = makeBoard();
let piece = null;
let score = 0;
let lines = 0;
let level = 1;
let last = 0;
let dropTimer = 0;
let gameOver = false;

function makeBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const shape = SHAPES[(Math.random() * SHAPES.length) | 0].map(([x, y]) => ({ x, y }));
  return {
    x: ((COLS / 2) | 0) - 2,
    y: 0,
    cells: shape,
    color: COLORS[(Math.random() * COLORS.length) | 0],
  };
}

function rotateCells(cells, dir) {
  const rotated = cells.map(({ x, y }) => (dir > 0 ? { x: -y, y: x } : { x: y, y: -x }));
  let minX = Infinity;
  let minY = Infinity;
  for (const c of rotated) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
  }
  return rotated.map((c) => ({ x: c.x - minX, y: c.y - minY }));
}

function canPlace(test) {
  for (const c of test.cells) {
    const x = test.x + c.x;
    const y = test.y + c.y;
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
    if (board[y][x]) return false;
  }
  return true;
}

function spawn() {
  piece = randomPiece();
  if (!canPlace(piece)) {
    gameOver = true;
  }
}

function mergePiece() {
  for (const c of piece.cells) {
    board[piece.y + c.y][piece.x + c.x] = piece.color;
  }
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared++;
      y++;
    }
  }
  if (!cleared) return;
  lines += cleared;
  level = Math.min(15, 1 + ((lines / 8) | 0));
  score += [0, 100, 300, 500, 800][cleared] * level;
  refreshPanel();
}

function lockAndNext() {
  mergePiece();
  clearLines();
  spawn();
}

function move(dx, dy) {
  if (gameOver) return false;
  const test = { ...piece, x: piece.x + dx, y: piece.y + dy };
  if (!canPlace(test)) return false;
  piece = test;
  return true;
}

function rotate(dir) {
  if (gameOver) return;
  const test = { ...piece, cells: rotateCells(piece.cells, dir) };
  const kicks = [0, -1, 1, -2, 2];
  for (const k of kicks) {
    const shifted = { ...test, x: test.x + k };
    if (canPlace(shifted)) {
      piece = shifted;
      return;
    }
  }
}

function hardDrop() {
  if (gameOver) return;
  while (move(0, 1));
  lockAndNext();
}

function tick(dt) {
  if (gameOver) return;
  dropTimer += dt;
  const interval = Math.max(90, 760 - (level - 1) * 55);
  if (dropTimer >= interval) {
    dropTimer = 0;
    if (!move(0, 1)) lockAndNext();
  }
}

function drawTriangle(x, y, up, fill) {
  const px = x * TRI;
  const py = y * TRI;
  ctx.beginPath();
  if (up) {
    ctx.moveTo(px, py + TRI);
    ctx.lineTo(px + TRI, py + TRI);
    ctx.lineTo(px + TRI / 2, py);
  } else {
    ctx.moveTo(px, py);
    ctx.lineTo(px + TRI, py);
    ctx.lineTo(px + TRI / 2, py + TRI);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.stroke();
}

function drawBoard() {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const color = board[y][x];
      const up = ((x + y) & 1) === 0;
      drawTriangle(x, y, up, color || "rgba(120,145,175,0.12)");
    }
  }
}

function drawPiece() {
  if (!piece || gameOver) return;
  for (const c of piece.cells) {
    const x = piece.x + c.x;
    const y = piece.y + c.y;
    const up = ((x + y) & 1) === 0;
    drawTriangle(x, y, up, piece.color);
  }
}

function drawGameOver() {
  if (!gameOver) return;
  ctx.fillStyle = "rgba(3, 8, 18, 0.74)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 42px Verdana";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", W / 2, H / 2 - 10);
  ctx.font = "20px Verdana";
  ctx.fillText("Press Restart", W / 2, H / 2 + 32);
}

function render() {
  drawBoard();
  drawPiece();
  drawGameOver();
}

function refreshPanel() {
  scoreEl.textContent = String(score);
  linesEl.textContent = String(lines);
  levelEl.textContent = String(level);
}

function reset() {
  board = makeBoard();
  score = 0;
  lines = 0;
  level = 1;
  last = 0;
  dropTimer = 0;
  gameOver = false;
  refreshPanel();
  spawn();
}

function frame(ts) {
  if (!last) last = ts;
  tick(ts - last);
  last = ts;
  render();
  requestAnimationFrame(frame);
}

document.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " "].includes(e.key) || e.code === "Space") {
    e.preventDefault();
  }
  if (e.key === "ArrowLeft") move(-1, 0);
  else if (e.key === "ArrowRight") move(1, 0);
  else if (e.key === "ArrowDown") {
    if (!move(0, 1)) lockAndNext();
  } else if (e.key === "z" || e.key === "Z") rotate(-1);
  else if (e.key === "x" || e.key === "X" || e.key === "ArrowUp") rotate(1);
  else if (e.code === "Space") hardDrop();
});

leftBtn.addEventListener("click", () => move(-1, 0));
rightBtn.addEventListener("click", () => move(1, 0));
downBtn.addEventListener("click", () => {
  if (!move(0, 1)) lockAndNext();
});
rotLBtn.addEventListener("click", () => rotate(-1));
rotRBtn.addEventListener("click", () => rotate(1));
restartBtn.addEventListener("click", () => reset());

reset();
requestAnimationFrame(frame);
