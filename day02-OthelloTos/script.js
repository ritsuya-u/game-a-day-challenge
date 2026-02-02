const SIZE = 8;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

const DIRS = [
  [-1,-1], [0,-1], [1,-1],
  [-1, 0],         [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

const $board = document.getElementById("board");
const $turn = document.getElementById("turn");
const $info = document.getElementById("info");
const $blackCount = document.getElementById("blackCount");
const $whiteCount = document.getElementById("whiteCount");
const $reset = document.getElementById("reset");

let board;          // 2D array
let currentPlayer;  // 1 or 2 (player id), stones are random so this is "who acts"
let gameOver = false;

function init() {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));

  // 初期配置（通常オセロと同じ）
  const mid = SIZE / 2;
  board[mid - 1][mid - 1] = WHITE;
  board[mid][mid] = WHITE;
  board[mid - 1][mid] = BLACK;
  board[mid][mid - 1] = BLACK;

  currentPlayer = 1;
  gameOver = false;

  buildBoardDOM();
  render();
}

function buildBoardDOM() {
  $board.innerHTML = "";
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);

      const stone = document.createElement("div");
      stone.className = "stone";
      cell.appendChild(stone);

      cell.addEventListener("click", onCellClick);
      $board.appendChild(cell);
    }
  }
}

function onCellClick(e) {
  if (gameOver) return;

  const cell = e.currentTarget;
  const x = Number(cell.dataset.x);
  const y = Number(cell.dataset.y);

  if (board[y][x] !== EMPTY) return;

  // 置ける条件：白で裏返る or 黒で裏返る
  const flipsW = getFlips(board, x, y, WHITE);
  const flipsB = getFlips(board, x, y, BLACK);
  const canPlace = (flipsW.length > 0) || (flipsB.length > 0);
  if (!canPlace) return;

  // 50/50で石色確定
  const placedColor = Math.random() < 0.5 ? BLACK : WHITE;

  // 確定した色で裏返しを実行（0枚でも置ける）
  const flips = getFlips(board, x, y, placedColor);
  board[y][x] = placedColor;
  for (const [fx, fy] of flips) {
    board[fy][fx] = placedColor;
  }

  $info.textContent =
    `${placedColor === BLACK ? "黒" : "白"}が置かれた！`;

  // 次手番
  currentPlayer = currentPlayer === 1 ? 2 : 1;

  // もう置ける場所がなければ終了（どのプレイヤーでも合法手は同じなので一回でOK）
  if (getAllLegalMoves(board).length === 0) {
    gameOver = true;
    $turn.textContent = "Game Over";
  }

  render();
}

function getFlips(bd, x, y, color) {
  if (bd[y][x] !== EMPTY) return [];
  const opp = (color === BLACK) ? WHITE : BLACK;
  const flips = [];

  for (const [dx, dy] of DIRS) {
    let cx = x + dx;
    let cy = y + dy;
    const line = [];

    // まず相手石が連続している必要がある
    while (inBounds(cx, cy) && bd[cy][cx] === opp) {
      line.push([cx, cy]);
      cx += dx;
      cy += dy;
    }

    // その先に自分石があれば挟めている
    if (line.length > 0 && inBounds(cx, cy) && bd[cy][cx] === color) {
      flips.push(...line);
    }
  }

  return flips;
}

function getAllLegalMoves(bd) {
  const moves = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (bd[y][x] !== EMPTY) continue;
      const w = getFlips(bd, x, y, WHITE).length;
      const b = getFlips(bd, x, y, BLACK).length;
      if (w > 0 || b > 0) moves.push([x, y]);
    }
  }
  return moves;
}

function inBounds(x, y) {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

function countStones() {
  let b = 0, w = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] === BLACK) b++;
      else if (board[y][x] === WHITE) w++;
    }
  }
  return { b, w };
}

function render() {
  // 手番表示
  if (!gameOver) {
    $turn.textContent = `Turn: Player ${currentPlayer}`;
  }

  // 石数
  const { b, w } = countStones();
  $blackCount.textContent = String(b);
  $whiteCount.textContent = String(w);

  // 置ける場所（灰点）
  const legal = new Set(getAllLegalMoves(board).map(([x, y]) => `${x},${y}`));

  // DOM反映
  const cells = $board.querySelectorAll(".cell");
  cells.forEach((cell) => {
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    const v = board[y][x];

    cell.classList.remove("black", "white", "hint");

    if (v === BLACK) cell.classList.add("black");
    if (v === WHITE) cell.classList.add("white");

    if (!gameOver && v === EMPTY && legal.has(`${x},${y}`)) {
      cell.classList.add("hint");
    }
  });

  // 終了メッセージ
  if (gameOver) {
    const { b: bb, w: ww } = countStones();
    const winner =
      bb === ww ? "Draw" : (bb > ww ? "BLACK wins" : "WHITE wins");
    if(bb + ww === 64){
          $info.textContent = ` ${winner} (BLACK:${bb} / WHITE:${ww})`;
    }else{
        $info.textContent = `置けなくなってしまった…`;
    }
  }
}

$reset.addEventListener("click", init);

init();
