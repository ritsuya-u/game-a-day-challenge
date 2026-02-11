'use strict';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: true });

// ====== ユーティリティ ======
function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }
function dist2(ax, ay, bx, by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }
function nowSec(){ return performance.now()/1000; }
function radNorm(a){
  while(a <= -Math.PI) a += Math.PI*2;
  while(a >  Math.PI) a -= Math.PI*2;
  return a;
}

function fitCanvas(){
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width  = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0); // 以後はCSS pxで描ける
}
window.addEventListener('resize', fitCanvas, { passive:true });
fitCanvas();

// ====== 画像読み込み（images/ と直下の両対応） ======
function loadImageTry(paths){
  return new Promise((resolve, reject) => {
    const img = new Image();
    let i = 0;

    const tryNext = () => {
      if(i >= paths.length) return reject(new Error('image load failed: '+paths.join(',')));
      img.src = paths[i++];
    };

    img.onload = () => resolve(img);
    img.onerror = () => tryNext();
    tryNext();
  });
}

async function loadCatFrames(baseName, count){
  const frames = [];
  for(let i=1;i<=count;i++){
    const fn = `${baseName}_${i}.png`;
    const img = await loadImageTry([`./images/${fn}`, `./${fn}`]);
    frames.push(img);
  }
  return frames;
}

// ====== 音楽 ======
const audio = new Audio('./audio/Omoide_Ha_Zutto-1(Slow).mp3');
audio.loop = true;
audio.preload = 'auto';

function audioStart(){
  if(audio.paused){
    audio.play().catch(()=>{});
  }
}
function audioStop(){
  if(!audio.paused){
    audio.pause();
  }
}

// ====== 歯車設定 ======
const G = {
  big:    { x:0, y:0, r:160, hole:90, teeth:14, angle:0, w:0 },
  mid:    { x:0, y:0, r:120, hole:70, teeth:12, angle:0, w:0 },
  small:  { x:0, y:0, r:60,  hole:28, teeth:10, angle:0, w:0 },
};

// 画面に合わせて配置
function layout(){
  const rect = canvas.getBoundingClientRect();
  const w = rect.width, h = rect.height;

  const cx = w * 0.43;
  const cy = h * 0.42;

  G.big.x = cx - 80;
  G.big.y = cy - 80;

  G.mid.x = G.big.x + G.big.r * 0.95;
  G.mid.y = G.big.y + G.big.r * 0.62 + 90;

  G.small.x = G.mid.x - G.mid.r * 0.45;
  G.small.y = G.mid.y + G.mid.r * 0.95 + 40;
}
layout();
window.addEventListener('resize', layout, { passive:true });

// ====== ブロック歯の歯車描画 ======
function drawGear_BlockTeeth(gear, fill='black'){
  const { x,y,r,hole,teeth,angle } = gear;

  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(angle);

  ctx.fillStyle = fill;

  // 歯の高さ（これを上げるとゴツくなる）
  const toothH = r * 0.20;
  // 歯の根元半径
  const baseR  = r - toothH;

  // 角度刻み
  const step   = (Math.PI*2) / teeth;

  // 歯と歯の間の「隙間」（増やすと歯が短く見える）
  const gap    = step * 0.4;
  const toothA = step - gap;

  // 根元の円板
  ctx.beginPath();
  ctx.arc(0,0, baseR, 0, Math.PI*2);
  ctx.fill();

  // 歯：外周(r)と根元(baseR)で角度区間を作って埋める
  for(let i=0;i<teeth;i++){
    const a0 = i*step - toothA/2;
    const a1 = i*step + toothA/2;

    ctx.beginPath();
    ctx.arc(0,0, r, a0, a1);
    ctx.arc(0,0, baseR, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }

  // 穴（くり抜き）
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(0,0, hole, 0, Math.PI*2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.restore();
}

// ====== 猫（位置固定で足踏みアニメ） ======
const Cat = {
  black: { frames:null, idx:0, acc:0, fps:6, x:0, y:0, scale:1, flip:false },
  white: { frames:null, idx:0, acc:0, fps:6, x:0, y:0, scale:1, flip:true }, // ← true に
};


function setCatPositions(){
  Cat.black.x = G.big.x ;
  Cat.black.y = G.big.y + 74;

  Cat.white.x = G.mid.x + 5;
  Cat.white.y = G.mid.y + 55;

  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  Cat.black.scale = w < 520 ? 1.05 : 1.0;
  Cat.white.scale = w < 520 ? 1.05 : 1.0;
}
setCatPositions();
window.addEventListener('resize', setCatPositions, { passive:true });

function drawCat(cat){
  if(!cat.frames) return;
  const img = cat.frames[cat.idx % cat.frames.length];

  const drawW = img.width  * 1.5 * cat.scale;
  const drawH = img.height * 1.5 * cat.scale;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(cat.x, cat.y);

    if(cat.flip){
    ctx.scale(-1, 1); // ← 横反転
  }
  ctx.drawImage(img, -drawW/2, -drawH/2, drawW, drawH);
  ctx.restore();
}

function updateCatAnim(cat, dt, speed){
  // speed: rad/s（絶対値でOK）
  // 「どのくらい回したら最大に近いか」を決める基準
  const SPEED_REF = 10.0; // ← 小さくすると少し回すだけで速くなる

  // 0〜1に正規化
  const s = clamp(speed / SPEED_REF, 0, 1);

  // カーブ（連動感を強める）：1.8〜3.0くらいが気持ちいい
  const curve = 1.8;
  const t = Math.pow(s, curve);

  // fpsレンジ（ここが歩きの速さ）
  const FPS_MIN = 0.0;   // 0なら完全停止（止めたくないなら 3 とか）
  const FPS_MAX = 40.0;  // 速くしたいなら上げる

  cat.fps = FPS_MIN + (FPS_MAX - FPS_MIN) * t;

  // speedが小さいときは止める（カクつき防止）
  if(cat.fps < 0.2) return;

  cat.acc += dt * cat.fps;
  while(cat.acc >= 1){
    cat.acc -= 1;
    cat.idx = (cat.idx + 1) % cat.frames.length;
  }
}


// ====== 入力：小歯車を押しながら回す ======
let dragging = false;
let lastPointerAng = 0;
let lastT = nowSec();

function pointerPos(ev){
  const rect = canvas.getBoundingClientRect();
  return {
    x: ev.clientX - rect.left,
    y: ev.clientY - rect.top
  };
}

function hitSmallGear(px, py){
  const d = dist2(px,py, G.small.x, G.small.y);
  const outer = (G.small.r * 1.05) ** 2;
  const inner = (G.small.hole * 0.85) ** 2;
  return (d <= outer && d >= inner);
}

function setDragging(on){
  dragging = on;
  if(!on){
    G.small.w = 0; // 離したら止める
  }
}

canvas.addEventListener('pointerdown', (ev) => {
  canvas.setPointerCapture(ev.pointerId);
  const {x,y} = pointerPos(ev);
  if(hitSmallGear(x,y)){
    audioStart();
    setDragging(true);

    lastPointerAng = Math.atan2(y - G.small.y, x - G.small.x);
    lastT = nowSec();
  }
});

canvas.addEventListener('pointermove', (ev) => {
  if(!dragging) return;
  const {x,y} = pointerPos(ev);

  const ang = Math.atan2(y - G.small.y, x - G.small.x);
  const t = nowSec();
  const dt = Math.max(1/240, t - lastT);

  let dAng = radNorm(ang - lastPointerAng);
  if(Math.abs(dAng) < 0.0005) dAng = 0;

  // 角度更新
  G.small.angle += dAng;

  // 角速度
  const w = dAng / dt;
  G.small.w = clamp(w, -10, 10);

  lastPointerAng = ang;
  lastT = t;
});

canvas.addEventListener('pointerup', () => setDragging(false));
canvas.addEventListener('pointercancel', () => setDragging(false));

// ====== 歯車の連動（回転比率） ======
function syncGears(){
  G.mid.w  = -G.small.w * (G.small.r / G.mid.r);
  G.big.w  = -G.mid.w   * (G.mid.r   / G.big.r);
}

function anyRotating(){
  return dragging || (Math.abs(G.small.w) > 0.02);
}

// ====== メインループ ======
let tPrev = nowSec();

function update(){
  const t = nowSec();
  const dt = clamp(t - tPrev, 0, 1/15);
  tPrev = t;

  // 押してないときは止める寄り（惰性を残したければ 0.86 を 0.93 とかに）
  if(!dragging){
    G.small.w *= 0.86;
    if(Math.abs(G.small.w) < 0.02) G.small.w = 0;
  }

  syncGears();

  G.small.angle += G.small.w * dt;
  G.mid.angle   += G.mid.w   * dt;
  G.big.angle   += G.big.w   * dt;

  if(anyRotating()){
    const sp = clamp(0.9 + Math.abs(G.small.w) * 0.03, 0.9, 1.2);
    audio.playbackRate = sp;
    audioStart();
  }else{
    audioStop();
  }

const STOP_EPS = 0.03; // この値を上げると「止まった扱い」が早くなる

const bigSpeed = Math.abs(G.big.w);
const midSpeed = Math.abs(G.mid.w);

if(Cat.black.frames){
  if(bigSpeed > STOP_EPS) updateCatAnim(Cat.black, dt, bigSpeed);
  // 止まってる時は何もしない＝フレーム固定
}
if(Cat.white.frames){
  if(midSpeed > STOP_EPS) updateCatAnim(Cat.white, dt, midSpeed);
}


  draw();
  requestAnimationFrame(update);
}

// ====== 描画 ======
function clear(){
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0,0, rect.width, rect.height);
}

function draw(){
  clear();

  // 歯車（B案）
  drawGear_BlockTeeth(G.big, 'black');
  drawGear_BlockTeeth(G.mid, 'black');
  drawGear_BlockTeeth(G.small, 'black');

  // 猫（回転しない）
  drawCat(Cat.black);
  drawCat(Cat.white);
}

// ====== 起動 ======
(async function main(){
  draw();

  try{
    Cat.black.frames = await loadCatFrames('black', 4);
    Cat.white.frames = await loadCatFrames('white', 4);
  }catch(e){
    console.warn(e);
  }

  requestAnimationFrame(update);
})();
