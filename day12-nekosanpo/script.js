'use strict';

let gameStarted = false;

const titleScreen = document.getElementById("titleScreen");
const btnStart = document.getElementById("btnStart");


btnStart.addEventListener("click", () => {
  gameStarted = true;
  titleScreen.style.display = "none";
});



const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;

  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

fitCanvas();
window.addEventListener("resize", fitCanvas);


 const titleCat = document.getElementById("titleCat");

let frameIndex = 0;
const catFrames = [
  'images/white_1.png',
  'images/white_2.png',
  'images/white_3.png',
  'images/white_4.png'
];

// タイトル猫アニメ（1回だけ開始）
let titleCatTimer = null;
if (titleCat) {
  titleCatTimer = setInterval(() => {
    if (gameStarted) return; // ゲーム開始後は更新しない
    frameIndex = (frameIndex + 1) % catFrames.length;
    titleCat.src = catFrames[frameIndex];
  }, 200);
}

btnStart.addEventListener("click", () => {
  gameStarted = true;
  titleScreen.style.display = "none";

  // 完全に止めたいなら（どっちでもOK）
  if (titleCatTimer) clearInterval(titleCatTimer);
});



let frame = 0;
let frameTimer = 0;
const frameInterval = 6; // 6フレームごとに切り替え

let facingLeft = false;



const playerImages = [];
for (let i = 1; i <=4; i++){
    const img = new Image();
    img.src = `images/white_${i}.png`;
    playerImages.push(img)
}

// ===== タイル設定 =====
const TILE = 40;

// ===== マップデータ（16行 × 120列）=====
const map = [
  "0000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001111111111111111111",
  "0000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000001111111111",
  "0000001000000000000000000000000000000000000000000000000000000000000000000000000000000000100010000100010000000001000000021111111111",
  "0000001000000000000000000000000000000000000000000000000000000000000000000000000000001000100010000100010001000000000000221111111111",
  "0000001000000000000000000000000000000000000000000000000000000001100000011000000110001000100010000100010001000000000000221111111111",
  "0000001000000000000000000000000000000000000000001000000110000000100000010000000010001000100010000100010001000000000002221111111111",
  "0000001000000000000000000000000110000000100000001000000110000000100000000001000110001000100010000100010001000004343434341111111111",
  "0000001000000000000001111100000110000001100000011001000110000001100000011000000110001000100010000100010000000000000000001111111111",
  "0000001000001111000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001111111111",
  "0000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001111111111",
  "0000001111000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001111111111",
  "0000000000001100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001111111111",
  "0000000000000110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000111100000001111111111",
  "0000000000000011000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000111111111111",
  "0000000000000011111111100000000000000111100000000000000000011111000000000000000011110000011001111111111100000000000001111111111111",
  "0000000000000000000000011111111100000010001111111111000110000000000100111110111100001111111110000000000011111110000111111111111111",
  "0000000000000000000000000000111111111101110000000000111001111111111011000001000000000000001100011100000000000000111111111111111111",
  "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011000111111111111111111111111111111111111",
  "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001111100000000000000000000001111111111",
  "0000000000000000000000000000000011111000000000110000000000000000000000000000000000000111110000000000000000000000000000021111111111",
  "0000000000000000011110000000000001110000000000110000000111000000000000000000000000000000000000000000000000000000000000221111111111",
  "1111111111111111111111111111111100000011111111111111111111111110000000111111111111111111111111111100000011111111111111111111111111",
  "1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111"
];


// ===== プレイヤー =====
const player = {
  x: 100,
  y: 0,
  w: 30,
  h: 30,
  vx: 0,
  vy: 0,
  speed: 4,
  jump: -16,
  onGround: false,

    // 見た目（スプライト）の描画サイズとオフセット
  spriteW: 50,
  spriteH: 50,
  spriteOx: -10,
  spriteOy: -10,
};

const gravity = 0.6;

// ===== キー入力 =====
const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// ===== 衝突判定 =====
function isSolid(x, y) {
  const col = Math.floor(x / TILE);
  const row = Math.floor(y / TILE);
  if (!map[row]) return false;
  return map[row][col] === "1" || map[row][col] === "2" || map[row][col] === "3" || map[row][col] === "4";
}

function resolveCollision() {
  player.onGround = false;

  // 横移動
  player.x += player.vx;

  if (player.vx > 0) {
    if (isSolid(player.x + player.w, player.y) ||
        isSolid(player.x + player.w, player.y + player.h - 1)) {
      player.x = Math.floor((player.x + player.w) / TILE) * TILE - player.w;
    }
  }

  if (player.vx < 0) {
    if (isSolid(player.x, player.y) ||
        isSolid(player.x, player.y + player.h - 1)) {
      player.x = Math.floor(player.x / TILE + 1) * TILE;
    }
  }

  // 縦移動
  player.y += player.vy;

  if (player.vy > 0) {
    if (isSolid(player.x + 1, player.y + player.h) ||
        isSolid(player.x + player.w - 1, player.y + player.h)) {
      player.y = Math.floor((player.y + player.h) / TILE) * TILE - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  }

  if (player.vy < 0) {
    if (isSolid(player.x + 1, player.y) ||
        isSolid(player.x + player.w - 1, player.y)) {
      player.y = Math.floor(player.y / TILE + 1) * TILE;
      player.vy = 0;
    }
  }
}

// ===== カメラ =====
let cameraX = 0;

function updateCamera() {
  cameraX = player.x - canvas.width / 2;
  cameraX = Math.max(0, cameraX);
}

// ===== 更新 =====
function update() {

  // 左右移動
  if (keys["ArrowRight"]) player.vx = player.speed;
  else if (keys["ArrowLeft"]) player.vx = -player.speed;
  else player.vx = 0;

  // ジャンプ
  if (keys["ArrowUp"] && player.onGround) {
    player.vy = player.jump;
  }

  if (player.vx !== 0) {
  frameTimer++;
  if (frameTimer >= frameInterval) {
    frame = (frame + 1) % 4;
    frameTimer = 0;
  }
} else {
  frame = 1; // 止まったら1枚目
}

if (player.vx > 0) facingLeft = false;
if (player.vx < 0) facingLeft = true;


  player.vy += gravity;

  resolveCollision();
  updateCamera();
}

// ===== 描画 =====
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  ctx.save();
  ctx.translate(-cameraX, 0);

  // タイル描画
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < map[r].length; c++) {
      if (map[r][c] === "1") {
        ctx.fillStyle = "#0e7333";
        ctx.fillRect(c*TILE, r*TILE, TILE, TILE);
      }else if (map[r][c] === "2") {
        ctx.fillStyle = "#ba9510";
        ctx.fillRect(c*TILE, r*TILE, TILE, TILE);
      }else if (map[r][c] === "3") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(c*TILE, r*TILE, TILE, TILE);
      }else if (map[r][c] === "4") {
        ctx.fillStyle = "#000000";
        ctx.fillRect(c*TILE, r*TILE, TILE, TILE);
      }
    }
  }



if (facingLeft) {
  ctx.scale(-1, 1);
  ctx.drawImage(
    playerImages[frame],
    -((player.x + player.spriteOx) + player.spriteW), // 左向き用X
    player.y + player.spriteOy,
    player.spriteW,
    player.spriteH
  );
} else {
  ctx.drawImage(
    playerImages[frame],
    player.x + player.spriteOx,
    player.y + player.spriteOy,
    player.spriteW,
    player.spriteH
  );
}

ctx.restore();

}

// ===== ループ =====
function loop() {
  if (gameStarted) {
    update();
    draw();
  }
 
  requestAnimationFrame(loop);
}


loop();
