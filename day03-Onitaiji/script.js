// ONITAIJI
// - Title: weapon select (left/right), description, radar, PLAY
// - Battle: player left moves up/down, shoot (space)
// - Oni right moves up/down, throws rotating kanabou
// - Win if defeat Oni within time, else lose
// - Result: ONIWASOTO!! / ONIWAUCHI…

const $ = (id) => document.getElementById(id);

// Screens
const screenTitle = $("screenTitle");
const screenBattle = $("screenBattle");
const screenResult = $("screenResult");

// Title UI
const beanNameEl = $("beanName");
const beanDescEl = $("beanDesc");
const beanImgEl = $("beanImg");
const radarCanvas = $("radar");
const radarCtx = radarCanvas.getContext("2d");
const btnPrev = $("btnPrev");
const btnNext = $("btnNext");
const btnPlay = $("btnPlay");

// Battle UI
const gameCanvas = $("game");
const g = gameCanvas.getContext("2d");
const timeLeftEl = $("timeLeft");
const hpYouEl = $("hpYou");
const hpOniEl = $("hpOni");

// Result UI
const resultTextEl = $("resultText");
const btnBack = $("btnBack");

// Assets
const IMG = {};
function loadImage(key, src){
  const im = new Image();
  im.src = src;
  IMG[key] = im;
  return im;
}

// Preload (filenames exactly as requested)
const PATH = "./images/";
loadImage("oni", PATH + "oni.webp");
loadImage("kanabou", PATH + "kanabou.webp");
loadImage("dangan", PATH + "dangan.webp");
loadImage("juu", PATH + "juu.webp");

// beans (player sprite = saya, bullet = mame)
const WEAPONS = [
  {
    key: "daizu",
    name: "ダイズ",
    desc:
`言わずとしれた豆の王様。豆腐、納豆、味噌、醤油など日本の食卓を語るには欠かせない。
畑の肉と言われるほどの生命力を考えれば、鬼退治に担ぎ出されるのも頷けるだろう。`,
    saya: PATH + "daizu_saya.webp",
    mame: PATH + "daizu_mam.webp",
    stats: { pow:5, spd:5, rof:4, size:6, hp:5 },
  },
  {
    key: "azuki",
    name: "アズキ",
    desc:
`赤飯や餡子、お手玉の中の材料にもなっている。
ほのかな甘みと上品な色合いを持つ彼女は、まさに豆界のヒロインである。`,
    saya: PATH + "azuki_saya.webp",
    mame: PATH + "azuki_mame.webp",
    stats: { pow:1, spd:6, rof:10, size:2, hp:2 },
  },
  {
    key: "ingen",
    name: "インゲンマメ",
    desc:
`中南米を故郷に持つフランス料理の名脇役。豆類としては世界最大の生産量を誇る。
しかし、生産量が多いのと鬼退治に役立つことはまた別のお話。`,
    saya: PATH + "ingenmame_saya.webp",
    mame: PATH + "ingenmame_mame.webp",
    stats: { pow:2, spd:5, rof:8, size:3, hp:3 },
  },
  {
    key: "endou",
    name: "エンドウマメ",
    desc:
`メンデルの実験でお馴染みエンドウ豆。
古代エジプトや古代ギリシアでの記録もあり、世界最古の農作物と呼び声高い。`,
    saya: PATH + "endoumame_saya.webp",
    mame: PATH + "endoumame_mame.webp",
    stats: { pow:3, spd:3, rof:7, size:4, hp:6 },
  },
  {
    key: "hiyoko",
    name: "ヒヨコマメ",
    desc:
`豆の形からその名がつけられたインド食。
つい数十年前に日本へきたばかりのひよっこに、果たして鬼退治ができるのだろうか。`,
    saya: PATH + "hiyokomame_saya.webp",
    mame: PATH + "hiyokomame_mame.webp",
    stats: { pow:7, spd:2, rof:3, size:7, hp:5 },
  },
  {
    key: "sora",
    name: "ソラマメ",
    desc:
`さやが空に向かって伸びる向上心の塊。
しかし美味しいのは三日だけ。
そんな勇ましくも刹那的なソラマメは、
鬼退治への切り札とも呼べるだろう。`,
    saya: PATH + "soramame_saya.webp",
    mame: PATH + "soramame_mame.webp",
    stats: { pow:12, spd:2, rof:1, size:10, hp:4 },
  },
  {
    key: "rakkasei",
    name: "ラッカセイ",
    desc:
`地上で咲いて地下で実る豆の異端児。
高カロリー高スタミナな存在として、
多くのものを支えてきた実績あり。`,
    saya: PATH + "rakkasei_saya.webp",
    mame: PATH + "rakkasei_mame.webp",
    stats: { pow:8, spd:4, rof:3, size:8, hp:8 },
  },
  {
    key: "juu",
    name: "銃",
    desc:
`火薬の燃焼で生じる高圧ガスで弾丸を高速で発射する武器。
弾丸は高い運動エネルギーを持ち、強い殺傷能力や破壊能力を持つ。`,
    saya: PATH + "juu.webp",
    mame: PATH + "dangan.webp",
    stats: { pow:100, spd:100, rof:100, size:2, hp:100 },
  },
];

for (const w of WEAPONS){
  loadImage(w.key + "_saya", w.saya);
  loadImage(w.key + "_mame", w.mame);
}

let selectIndex = 0;

// ---------- Radar ----------
function drawRadar(stats){
  // 5 axes: pow, spd, rof, size, hp
  const axes = [
    { key:"pow",  label:"威力" },
    { key:"spd",  label:"弾速" },
    { key:"rof",  label:"連射速度" },
    { key:"size", label:"大きさ" },
    { key:"hp",   label:"体力" },
  ];

  const vals = axes.map(a => stats[a.key]);

  // レーダーのスケール（銃=100でも潰れないように）
  // 「豆は最大10」っぽい見せ方をしたいなら max を 10 に固定してもOK
  const max = Math.max(...vals, 10);

  const cw = radarCanvas.width;
  const ch = radarCanvas.height;

  const cx = cw / 2;
  const cy = ch / 2 + 6;

  const r = 82; // 本体半径
  const rings = 5;

  const USE_TIME_LIMIT = false; // true にすると時間制限あり


  radarCtx.clearRect(0,0,cw,ch);

  radarCtx.save();
  radarCtx.translate(cx, cy);

  // --- grid ---
  radarCtx.strokeStyle = "rgba(0,0,0,0.18)";
  radarCtx.lineWidth = 1;

  for (let i=1;i<=rings;i++){
    const rr = (r*i)/rings;
    radarCtx.beginPath();
    for (let a=0;a<5;a++){
      const ang = (-Math.PI/2) + (Math.PI*2*a/5);
      const x = Math.cos(ang) * rr;
      const y = Math.sin(ang) * rr;
      if (a===0) radarCtx.moveTo(x,y);
      else radarCtx.lineTo(x,y);
    }
    radarCtx.closePath();
    radarCtx.stroke();
  }

  // axes
  for (let a=0;a<5;a++){
    const ang = (-Math.PI/2) + (Math.PI*2*a/5);
    radarCtx.beginPath();
    radarCtx.moveTo(0,0);
    radarCtx.lineTo(Math.cos(ang)*r, Math.sin(ang)*r);
    radarCtx.stroke();
  }

  // --- polygon ---
  radarCtx.fillStyle = "rgba(218, 175, 68, 0.55)";
  radarCtx.strokeStyle = "rgba(218, 175, 68, 0.95)";
  radarCtx.lineWidth = 2;

  radarCtx.beginPath();
  for (let a=0;a<5;a++){
    const ang = (-Math.PI/2) + (Math.PI*2*a/5);
    const t = vals[a] / max;
    const x = Math.cos(ang) * r * t;
    const y = Math.sin(ang) * r * t;
    if (a===0) radarCtx.moveTo(x,y);
    else radarCtx.lineTo(x,y);
  }
  radarCtx.closePath();
  radarCtx.fill();
  radarCtx.stroke();

  // --- labels on corners ---
  // 角の少し外側にラベルを置く
  const labelR = r + 22;

  radarCtx.fillStyle = "rgba(0,0,0,0.55)";
  radarCtx.font = "12px system-ui, sans-serif";

  for (let a=0;a<5;a++){
    const ang = (-Math.PI/2) + (Math.PI*2*a/5);
    const x = Math.cos(ang) * labelR;
    const y = Math.sin(ang) * labelR;

    // 位置に応じてアンカーを変える（見切れ防止）
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);

    let align = "center";
    if (cos > 0.35) align = "left";
    else if (cos < -0.35) align = "right";

    let baseline = "middle";
    if (sin > 0.35) baseline = "top";
    else if (sin < -0.35) baseline = "bottom";

    radarCtx.textAlign = align;
    radarCtx.textBaseline = baseline;
    radarCtx.fillText(axes[a].label, x, y);
  }

  radarCtx.restore();

  // ✅ 数字（目盛り）は描かない：ここで何も描画しない
}


// ---------- Title update ----------
function updateTitle(){
  const w = WEAPONS[selectIndex];
  beanNameEl.textContent = w.name;
  beanDescEl.textContent = w.desc;

  const sayaImg = IMG[w.key + "_saya"];
  beanImgEl.src = sayaImg?.src || "";

  drawRadar(w.stats);

  updateNavButtons();
}



btnPrev.addEventListener("click", () => {
  if (selectIndex <= 0) return; // ダイズなら動かない
  selectIndex--;
  updateTitle();
});

btnNext.addEventListener("click", () => {
  if (selectIndex >= WEAPONS.length - 1) return; // 銃なら動かない
  selectIndex++;
  updateTitle();
});

updateTitle();

// ---------- Game state ----------
let state = "title"; // title | battle | result
let resultKind = "win"; // win | lose

// Battle constants
const W = gameCanvas.width;
const H = gameCanvas.height;

const TIME_LIMIT = Infinity;

// Convert "stats" to actual gameplay numbers
function buildTuning(stats){
  return {
    // 威力: direct damage, but slightly scaled so low values still matter
    dmg: stats.pow,

    // 弾速: pixel per second
    bulletSpeed: 220 + stats.spd * 35, // gun becomes crazy fast

    // 連射速度: bullets per second-ish
    fireInterval: Math.max(0.06, 0.55 - stats.rof * 0.045), // higher rof -> smaller interval
    // gun -> very small, but clamp by 0.06 sec

    // 大きさ: hitbox + sprite scale
    sizeScale: 0.55 + stats.size * 0.10,

    // 体力: HP pool
    hp: Math.round(40 + stats.hp * 35),
  };
}

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

function circleHit(a,b){
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rr = a.r + b.r;
  return dx*dx + dy*dy <= rr*rr;
}

// Entities
let you, oni, bullets, clubs;
let tLeft = TIME_LIMIT;
let lastShot = 0;
let lastOniShot = 0;

// Input
const keys = { up:false, down:false, space:false };
window.addEventListener("keydown", (e)=>{
  if (e.code === "ArrowUp") keys.up = true;
  if (e.code === "ArrowDown") keys.down = true;
  if (e.code === "Space") { keys.space = true; e.preventDefault(); }
});
window.addEventListener("keyup", (e)=>{
  if (e.code === "ArrowUp") keys.up = false;
  if (e.code === "ArrowDown") keys.down = false;
  if (e.code === "Space") keys.space = false;
});

// Start battle
btnPlay.addEventListener("click", ()=>{
  startBattle();
});

function updateNavButtons() {
  const isDaizu = (selectIndex === 0);
  const isGun   = (selectIndex === WEAPONS.length - 1);

  btnPrev.classList.toggle("isHidden", isDaizu);
  btnNext.classList.toggle("isHidden", isGun);
}


// Back to title
btnBack.addEventListener("click", ()=>{
  showTitle();
});

function showTitle(){
  state = "title";
  screenTitle.classList.remove("hidden");
  screenBattle.classList.add("hidden");
  screenResult.classList.add("hidden");
}

function showBattle(){
  state = "battle";
  screenTitle.classList.add("hidden");
  screenBattle.classList.remove("hidden");
  screenResult.classList.add("hidden");
}

function showResult(kind){
  state = "result";
  resultKind = kind;
  screenTitle.classList.add("hidden");
  screenBattle.classList.add("hidden");
  screenResult.classList.remove("hidden");
  resultTextEl.textContent = (kind === "win") ? "ONIWASOTO!!" : "ONIWAUCHI…";
}

function startBattle(){
  const w = WEAPONS[selectIndex];
  const tune = buildTuning(w.stats);

  you = {
    weapon: w,
    tune,
    x: 110,
    y: H/2,
    vy: 0,
    speed: 320,
    r: 18 * tune.sizeScale,
    hp: tune.hp,
    hpMax: tune.hp,
  };

  oni = {
    x: W - 140,
    y: H/2,
    t: 0,
    r: 28,
    hp: 280,    // Oni HP fixed (so beans matter)
    hpMax: 280,
  };

  // balance note: gun is still absurd (as per stats), and will melt Oni fast—intended “チート枠”として動きます。
  bullets = [];
  clubs = [];
  tLeft = TIME_LIMIT;
  lastShot = -999;
  lastOniShot = -999;

  updateHud();
  showBattle();
}

// HUD
function setHpBar(el, cur, max){
  const p = clamp(cur / max, 0, 1);
  el.style.transform = `scaleX(${p})`;
}
function updateHud(){
  timeLeftEl.textContent = tLeft.toFixed(1);
  setHpBar(hpYouEl, you.hp, you.hpMax);
  setHpBar(hpOniEl, oni.hp, oni.hpMax);
}

// Draw helpers
function drawSprite(img, x, y, w, h, rot=0){
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  if (img && img.complete && img.naturalWidth > 0){
    g.drawImage(img, -w/2, -h/2, w, h);
  } else {
    g.fillStyle = "rgba(0,0,0,0.12)";
    g.fillRect(-w/2, -h/2, w, h);
    g.strokeStyle = "rgba(0,0,0,0.25)";
    g.strokeRect(-w/2, -h/2, w, h);
  }
  g.restore();
}

function drawScene(){
  // clear
  g.clearRect(0,0,W,H);

  // minimal stage
  g.fillStyle = "#ffffff";
  g.fillRect(0,0,W,H);

  // center faint line
  g.strokeStyle = "rgba(0,0,0,0.08)";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(W/2, 20);
  g.lineTo(W/2, H-20);
  g.stroke();

  // YOU
  const youImg = IMG[you.weapon.key + "_saya"];
  const youW = 160 * you.tune.sizeScale;
  const youH = 95 * you.tune.sizeScale;
  drawSprite(youImg, you.x, you.y, youW, youH, 0);

  // ONI
  drawSprite(IMG.oni, oni.x, oni.y, 190, 190, 0);

  // bullets
  for (const b of bullets){
    const im = IMG[you.weapon.key + "_mame"];
    drawSprite(im, b.x, b.y, b.w, b.h, 0);
  }

  // clubs (kanabou) rotate while flying
  for (const c of clubs){
    drawSprite(IMG.kanabou, c.x, c.y, c.w, c.h, c.rot);
  }
}

function spawnBullet(now){
  const w = you.weapon;
  const t = you.tune;

  const img = IMG[w.key + "_mame"];
  const isGun = (w.key === "juu");

  const bw = isGun ? 48 : 34 * t.sizeScale;
  const bh = isGun ? 18 : 22 * t.sizeScale;

  bullets.push({
    x: you.x + 40,
    y: you.y,
    vx: t.bulletSpeed,
    r: 10 * (isGun ? 1 : t.sizeScale),
    w: bw,
    h: bh,
    dmg: t.dmg,
  });

  lastShot = now;
}

function spawnKanabou(now){
  const base = 260; // px/s
  const vx = -base - Math.random()*140;
  const vy = (Math.random()*2 - 1) * 90;

  clubs.push({
    x: oni.x - 60,
    y: oni.y + (Math.random()*2 - 1) * 10,
    vx,
    vy,
    rot: 0,
    rotSpd: 6 + Math.random()*4, // rad/s
    r: 18,
    w: 110,
    h: 40,
    dmg: 100,
  });

  lastOniShot = now;
}

// Main loop
let lastTs = 0;
function loop(ts){
  requestAnimationFrame(loop);
  const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0);
  lastTs = ts;

  if (state !== "battle") return;

// time
 tLeft -= dt;
  if (tLeft <= 0){
    tLeft = 0;
    updateHud();
    showResult("lose");
    return;
  }



  // YOU movement
  const dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  you.y += dy * you.speed * dt;
  you.y = clamp(you.y, 40, H - 40);

  // shooting
  if (keys.space){
    const interval = you.tune.fireInterval;
    const now = ts/1000;
    if ((now - lastShot) >= interval){
      spawnBullet(now);
    }
  }

  // ONI movement (smooth + reactive)
  oni.t += dt;
  const wave = Math.sin(oni.t * 1.6) * 130;
  const chase = clamp((you.y - oni.y) * 0.35, -90, 90);
  oni.y += (wave + chase) * dt * 0.8;
  oni.y = clamp(oni.y, 70, H - 70);

  // ONI attack cadence
  const now = ts/1000;
  const oniInterval = 0.9; // seconds
  if ((now - lastOniShot) >= oniInterval){
    spawnKanabou(now);
  }

  // update bullets
  for (const b of bullets){
    b.x += b.vx * dt;
  }
  bullets = bullets.filter(b => b.x < W + 80);

  // update clubs
  for (const c of clubs){
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.rot += c.rotSpd * dt;
  }
  clubs = clubs.filter(c => c.x > -120 && c.y > -120 && c.y < H + 120);

  // collisions: bullets -> oni
  for (const b of bullets){
    if (!b.dead && circleHit({x:b.x,y:b.y,r:b.r},{x:oni.x,y:oni.y,r:oni.r})){
      b.dead = true;
      oni.hp -= b.dmg;
    }
  }
  bullets = bullets.filter(b => !b.dead);

  // collisions: clubs -> you
  for (const c of clubs){
    if (!c.dead && circleHit({x:c.x,y:c.y,r:c.r},{x:you.x,y:you.y,r:you.r})){
      c.dead = true;
      you.hp -= c.dmg;
    }
  }
  clubs = clubs.filter(c => !c.dead);

  // end checks
  if (oni.hp <= 0){
    oni.hp = 0;
    updateHud();
    showResult("win");
    return;
  }
  if (you.hp <= 0){
    you.hp = 0;
    updateHud();
    showResult("lose");
    return;
  }

  updateHud();
  drawScene();
}

requestAnimationFrame(loop);

// If someone reloads while battle screen hidden, still draw title preview
drawRadar(WEAPONS[selectIndex].stats);

// Make canvas crisp on HiDPI (optional, lightweight)
(function setupHiDPI(){
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const cw = 960, ch = 540;
  gameCanvas.width = Math.round(cw * dpr);
  gameCanvas.height = Math.round(ch * dpr);
  gameCanvas.style.width = cw + "px";
  gameCanvas.style.maxWidth = "100%";
  gameCanvas.style.height = "auto";
  g.setTransform(dpr,0,0,dpr,0,0);
})();

