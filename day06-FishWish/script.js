(() => {
    const IS_DEBUG = true; // ← テスト中は true / 本番は false

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const titleScreen = document.getElementById("titleScreen");
  const btnStart = document.getElementById("btnStart");
  const resultScreen = document.getElementById("resultScreen");
  const resultScore = document.getElementById("resultScore");
  const btnToTitle = document.getElementById("btnToTitle");
  const pcOnly = document.getElementById("pcOnly");

  // -----------------------
  // PC only (not smartphone)
  // -----------------------
  function checkPCOnly(){
    const tooSmall = window.innerWidth < 1024 || window.innerHeight < 600;
    pcOnly.classList.toggle("hidden", !tooSmall);
    return !tooSmall;
  }

  // -----------------------
  // Resize
  // -----------------------
  function resize(){
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  // -----------------------
  // Assets
  // -----------------------
  const IMG = {};
  const imageList = [
    ["title", "./images/title.webp"],
    ["btn_start", "./images/btn_start.webp"],
    ["btn_title", "./images/btn_title.webp"],
    ["player", "./images/player.webp"],
    ["2_mijinko", "./images/2_mijinko.webp"],
    ["3_okiami", "./images/3_okiami.webp"],
    ["4_shirasu", "./images/4_shirasu.webp"],
    ["5_iwashi", "./images/5_iwashi.webp"],
    ["6_haze", "./images/6_haze.webp"],
    ["7_aji", "./images/7_aji.webp"],
    ["8_kasago", "./images/8_kasago.webp"],
    ["9_katsuo", "./images/9_katsuo.webp"],
    ["10_buri", "./images/10_buri.webp"],
    ["11_maguro", "./images/11_maguro.webp"],
    ["12_kajiki", "./images/12_kajiki.webp"],
    ["13_same", "./images/13_same.webp"],
    ["14_zinbeezame", "./images/14_zinbeezame.webp"],
    ["15_shironagasukuzira", "./images/15_shironagasukuzira.webp"],
  ];

  function loadImages(){
    let loaded = 0;
    return new Promise((resolve, reject) => {
      for (const [key, src] of imageList){
        const img = new Image();
        img.onload = () => {
          IMG[key] = img;
          loaded++;
          if (loaded === imageList.length) resolve();
        };
        img.onerror = () => reject(new Error("image load failed: " + src));
        img.src = src;
      }
    });
  }

  // -----------------------
  // Fish data (size/point)
  // 「食べれる条件」: player.size > fish.size（同値不可）
  // -----------------------
  const FISH = {
    1: { name:"マリンスノー", key:null,  size:  1,  point:  1,  type:"snow" },
    2: { name:"ミジンコ",     key:"2_mijinko", size: 10, point:  2, type:"drift" },
    3: { name:"オキアミ",     key:"3_okiami",  size: 30, point:  4, type:"side" },
    4: { name:"イワシ稚魚",   key:"4_shirasu", size: 80, point:  10, type:"side" },
    5: { name:"イワシ",       key:"5_iwashi",  size: 200, point: 20, type:"side" },
    6: { name:"ハゼ",         key:"6_haze",    size: 500, point: 40, type:"side" },
    7: { name:"アジ",         key:"7_aji",     size: 1000, point: 100, type:"side" },
    8: { name:"カサゴ",       key:"8_kasago",  size:2000, point: 200, type:"side" },
    9: { name:"カツオ",       key:"9_katsuo",  size:5000, point: 400, type:"side" },
    10:{ name:"ブリ",         key:"10_buri",   size:10000, point: 800, type:"side" },
    11:{ name:"マグロ",       key:"11_maguro", size:20000, point: 1600, type:"side" },
    12:{ name:"カジキ",       key:"12_kajiki", size:40000, point:3000, type:"side" },
    13:{ name:"サメ",         key:"13_same",   size:100000, point:5000, type:"side" },
    14:{ name:"ジンベエザメ", key:"14_zinbeezame", size:300000, point:10000, type:"side" },
    15:{ name:"シロナガスクジラ", key:"15_shironagasukuzira", size:1000000, point:20000, type:"side" },
  };

  // -----------------------
  // World & Phase
  // 視野拡大: zoom を下げる（=広く見える）
const PHASES = [
  null,

  // フェーズ1：導入（密度高め・視野狭め）
  {
    id: 1,
    maxLv: 6,
    zoom: 2.0,
    spawnMul: 1.0,
    worldW: 1800,
    worldH: 1000,
  },

  // フェーズ2：中盤（少し広く・高Lvはまだレア）
  {
    id: 2,
    maxLv: 11,
    zoom: 0.7,
    spawnMul: 0.95,
    worldW: 3000,
    worldH: 1700,
  },

  // フェーズ3：終盤（超巨大生物の海）
  {
    id: 3,
    maxLv: 15,
    zoom: 0.15,
    spawnMul: 0.9,
    worldW: 20000,
    worldH: 12000,
  },
];

  // -----------------------
  // Game state
  // -----------------------
  const keys = new Set();
  let running = false;
  let phase = 1;

  const player = {
    x: 900, y: 500,
    size: 30,           // 初期：Lv4(26)まで食える。Lv5(38)は最初は無理。
    dir: -1,            // -1: left, +1: right
    speed: 260,         // px/sec
  };

  let score = 0;
  let fishes = [];
  let lastT = 0;

  function currentPhase(){ return PHASES[phase]; }

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function rand(a,b){ return a + Math.random()*(b-a); }
  function choice(arr){ return arr[(Math.random()*arr.length)|0]; }

  // size -> radius (collision/draw scaling)
  function sizeToRadius(sz){
    return 10 + Math.sqrt(sz) * 3;
  }

  // -----------------------
  // Spawning
  // -----------------------
  let spawnAcc = 0;

  // 高レベルほど出にくい（重み）

  function pickLevel(maxLv){
  // フェーズ2だけ、かなり低Lv寄りにする
  const decay =
    (phase === 2) ? 0.58 :   // ← ここが効く（Lv9,10激減）
    (phase === 3) ? 0.75 :
    0.78;

  const levels = [];
  const weights = [];
  let sum = 0;

  for (let lv=1; lv<=maxLv; lv++){
    const w = Math.pow(decay, lv-1);
    levels.push(lv);
    weights.push(w);
    sum += w;
  }

  let r = Math.random() * sum;
  for (let i=0;i<levels.length;i++){
    r -= weights[i];
    if (r <= 0) return levels[i];
  }
  return levels[levels.length-1];
}


  function makeFish(lv){
    const info = FISH[lv];
    const P = currentPhase();

    // spawn position / velocity
    let x,y,vx,vy,dir;
    const r = sizeToRadius(info.size);

    if (info.type === "snow"){
      // anywhere, slow float
      x = rand(r, P.worldW - r);
      y = rand(r, P.worldH - r);
      const a = rand(0, Math.PI*2);
      const sp = rand(10, 22);
      vx = Math.cos(a)*sp;
      vy = Math.sin(a)*sp;
      dir = -1;
    } else if (info.type === "drift"){
      x = rand(r, P.worldW - r);
      y = rand(r, P.worldH - r);
      const a = rand(0, Math.PI*2);
      const sp = rand(18, 34);
      vx = Math.cos(a)*sp;
      vy = Math.sin(a)*sp;
      dir = -1;
    } else {
      // side swimmers: from left or right, horizontal
      const from = Math.random() < 0.5 ? "L" : "R";
      y = rand(r+10, P.worldH - 40);
      vy = rand(-8, 8) / P.zoom;

      // bigger is slower + randomness
      const base = 260 / (1 + Math.sqrt(info.size)/14);
      

      let sp = base * rand(0.85, 1.18);

        // 高レベルほど少しだけ速くする（Lv6以降から効く）
            const boost = 1 + Math.max(0, (lv - 6)) * 0.07; // Lv7:1.07, Lv10:1.28, Lv15:1.63
        sp *= boost;
        sp = Math.min(sp, 180); // 速すぎない上限（好みで 160〜220）


      if (from === "L"){
        x = -r - 40;
        vx = sp / P.zoom;   // ★ zoom補正

        dir = +1; // moving right
      } else {
        x = P.worldW + r + 40;
        vx = -sp / P.zoom;

        dir = -1; // moving left
      }
    }

    return {
      lv,
      ...info,
      x,y,vx,vy,dir,
      r,
      alive:true,
    };
  }

function spawn(dt){
  const P = currentPhase();

  // フェーズ3は「世界が広い＋魚がデカい」ので、全体レートをガッツリ落とす
  const baseRate =
    (phase === 1) ? 10 :
    (phase === 2) ? 25  :
    50;

  const targetRate = baseRate * P.spawnMul; // fish/sec
  spawnAcc += dt * targetRate;

  while (spawnAcc >= 1){
    spawnAcc -= 1;

    const lv = pickLevel(P.maxLv);

    // マリンスノー増量（フェーズ3では控えめ）
    if (lv === 1){
      const extra =
        (phase === 3) ? ((Math.random() < 0.35) ? 1 : 0) :
        (Math.random() < 0.85 ? 2 : 1);
      for (let i=0; i<extra; i++) fishes.push(makeFish(1));
    }

    // 出現の間引き
    const thinBase =
      (phase === 1) ? 0.89 :
      (phase === 2) ? 0.85 :
      0.83;

    let thin = Math.pow(thinBase, lv - 1);



    if (Math.random() > thin) continue;

    fishes.push(makeFish(lv));
  }

  // ★これが必要（上限）
  const maxCount =
    (phase === 1) ? 100000 :
    (phase === 2) ? 100000 :
    100000;

  if (fishes.length > maxCount){
    fishes.splice(0, fishes.length - maxCount);
  }
}

function maybeAdvancePhase(eatenLv){
  if (phase === 1 && eatenLv === 5) {
    phase = 2;

    // フェーズ2に入った瞬間の初期位置（任意）
    const P = PHASES[2];
    player.x = P.worldW * 0.5;
    player.y = P.worldH * 0.55;
  }

  if (phase === 2 && eatenLv === 10) {
    phase = 3;

    const P = PHASES[3];
    player.x = P.worldW * 0.5;
    player.y = P.worldH * 0.55;
  }
}



  // -----------------------
  // Input
  // -----------------------
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();

  // ===== デバッグ用：フェーズ即切り替え =====
  if (IS_DEBUG){
    if (k === "2") {
      phase = 2;
      const P = PHASES[2];
      player.x = P.worldW * 0.5;
      player.y = P.worldH * 0.55;
      player.size = 1200; // フェーズ2で最低限動けるサイズ
    }
    if (k === "3") {
      phase = 3;
      const P = PHASES[3];
      player.x = P.worldW * 0.5;
      player.y = P.worldH * 0.55;
      player.size = 25000; // フェーズ3テスト用
    }
  }
  // ========================================

  if (["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"].includes(k)) {
    e.preventDefault();
  }
  keys.add(k);
}, {passive:false});

  window.addEventListener("keyup", (e) => {
    keys.delete(e.key.toLowerCase());
  });

  function getMove(){
    let dx=0, dy=0;
    if (keys.has("w") || keys.has("arrowup")) dy -= 1;
    if (keys.has("s") || keys.has("arrowdown")) dy += 1;
    if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
    if (keys.has("d") || keys.has("arrowright")) dx += 1;

    if (dx !== 0 || dy !== 0){
      const len = Math.hypot(dx,dy);
      dx /= len; dy /= len;
    }
    return {dx,dy};
  }

  // -----------------------
  // Collision
  // -----------------------
  function dist2(ax,ay,bx,by){
    const dx=ax-bx, dy=ay-by;
    return dx*dx+dy*dy;
  }

  function eatFish(f){
    score += f.point;
    player.size += f.point;

    maybeAdvancePhase(f.lv);

    // whale eaten => result
    if (f.lv === 15){
      endGame(true);
    }
  }

  function endGame(win){
    running = false;
    resultScore.textContent = String(score);
    resultScreen.classList.remove("hidden");
    // win/loseの見た目を変えたければここで分岐可能（今回は要件なしなので統一）
  }

  // -----------------------
  // Update
  // -----------------------
  function update(dt){
    const P = currentPhase();

    // player move
    const {dx,dy} = getMove();
    const sp = player.speed * (0.88 + 1 / (1 + Math.sqrt(player.size)/16)); // 大きいほど少し重く
        player.x += dx * sp * dt / P.zoom;
        player.y += dy * sp * dt / P.zoom;


    if (dx > 0.01) player.dir = +1;
    if (dx < -0.01) player.dir = -1;

    const pr = sizeToRadius(player.size)*0.72;
    player.x = clamp(player.x, pr, P.worldW - pr);
    player.y = clamp(player.y, pr, P.worldH - pr);

    // spawn
    spawn(dt);

    // fish move
    for (const f of fishes){
      if (!f.alive) continue;
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      // drift bounce
      if (f.type === "snow" || f.type === "drift"){
        const r = f.r;
        if (f.x < r){ f.x = r; f.vx *= -1; }
        if (f.x > P.worldW - r){ f.x = P.worldW - r; f.vx *= -1; }
        if (f.y < r){ f.y = r; f.vy *= -1; }
        if (f.y > P.worldH - r){ f.y = P.worldH - r; f.vy *= -1; }
      } else {
        // side swimmers: if far out, respawn fresh
       // side swimmers: remove only when far outside horizontally
        const margin = Math.max(180, f.r + 60);
        if (f.x < -margin || f.x > P.worldW + margin){
        f.alive = false;
        }

// y ははみ出したら反射 or クランプ（どっちでもOK）
if (f.y < f.r) { f.y = f.r; f.vy *= -1; }
if (f.y > P.worldH - f.r) { f.y = P.worldH - f.r; f.vy *= -1; }


      }
    }
    // remove dead
    fishes = fishes.filter(f => f.alive);

    // collision
    for (const f of fishes){
      const rr = pr + f.r*0.4;
      if (dist2(player.x, player.y, f.x, f.y) <= rr*rr){
        // eatable?
        if (player.size > f.size){
          f.alive = false;
          eatFish(f);
          break;
        } else {
          // hit bigger => game over
          endGame(false);
          break;
        }
      }
    }
  }

 // -----------------------
// Draw
// -----------------------
function draw() {
  const P = currentPhase();
  const cw = window.innerWidth;
  const ch = window.innerHeight;

  ctx.clearRect(0, 0, cw, ch);

  // -----------------------
  // Camera follow
  // -----------------------
  const zoom = P.zoom;
  const halfW = cw / 2;
  const halfH = ch / 2;

  const camX = clamp(player.x, halfW / zoom, P.worldW - halfW / zoom);
  const camY = clamp(player.y, halfH / zoom, P.worldH - halfH / zoom);

  // -----------------------
  // Background particles
  // -----------------------
  ctx.save();
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 60; i++) {
    const x = (i * 97 + camX * 0.08) % cw;
    const y = (i * 53 + camY * 0.06) % ch;
    ctx.beginPath();
    ctx.arc(x, y, (i % 3) + 1, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }
  ctx.restore();

  // -----------------------
  // World -> Screen
  // -----------------------
  function worldToScreen(x, y) {
    return {
      sx: (x - camX) * zoom + halfW,
      sy: (y - camY) * zoom + halfH,
    };
  }

  // -----------------------
  // Fish
  // -----------------------
  for (const f of fishes) {
    const { sx, sy } = worldToScreen(f.x, f.y);
    const r = f.r * zoom;

    // snow particle
    if (f.type === "snow") { // ★ sow → snow
      const rr = r * 0.2;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(sx, sy, rr, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.restore();
      continue;
    }

    const img = f.key ? IMG[f.key] : null;
    if (!img) continue;

    // scale image based on radius
    const w = r * 3.5;
    const h = w * (img.height / img.width);

    ctx.save();
    ctx.translate(sx, sy);

    // 画像は「左向き」固定。右向きに泳ぐときは左右反転
    const face = (f.dir > 0) ? -1 : 1; // moving right => flip
    ctx.scale(face, 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);

    ctx.restore();
  }

  // -----------------------
  // Player
  // -----------------------
  {
    const { sx, sy } = worldToScreen(player.x, player.y);
    const pr = sizeToRadius(player.size) * zoom;
    const img = IMG.player;

    const w = pr * 2.6;
    const h = w * (img.height / img.width);

    ctx.save();
    ctx.translate(sx, sy);

    // 右移動時は右向き（=反転）
    const face = (player.dir > 0) ? -1 : 1;
    ctx.scale(face, 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);

    ctx.restore();
  }

  // -----------------------
  // HUD
  // -----------------------
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "700 18px system-ui, -apple-system, 'Noto Sans JP', sans-serif";
  ctx.fillText(`Score: ${score}`, 16, 28); // ★テンプレ文字列
  ctx.font = "600 14px system-ui, -apple-system, 'Noto Sans JP', sans-serif";
  ctx.globalAlpha = 0.7;
  ctx.fillText(`Phase: ${phase}`, 16, 48); // ★テンプレ文字列
  ctx.restore();
}


  // -----------------------
  // Loop
  // -----------------------
  function loop(t){
    if (!running) return;
    const now = t/1000;
    const dt = Math.min(0.033, now - lastT);
    lastT = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  // -----------------------
  // Start/Reset
  // -----------------------
  function resetGame(){
    phase = 1;
    score = 0;
    fishes = [];
    spawnAcc = 0;
    player.x = PHASES[1].worldW * 0.5;
    player.y = PHASES[1].worldH * 0.55;
    player.size = 10;
    player.dir = -1;
  }

  function startGame(){
    if (!checkPCOnly()) return;

      // ★タイトル中は隠してたcanvasを出す
    canvas.classList.remove("hidden");

    resultScreen.classList.add("hidden");

    // title slide out then run
    titleScreen.classList.add("titleSlideOut");
    setTimeout(() => {
      titleScreen.classList.add("hidden");
      resetGame();
      running = true;
      lastT = performance.now()/1000;
      requestAnimationFrame(loop);
    }, 430);
  }

  function backToTitle(){
    running = false;

    // ★プレイ画面を消す（最後の描画が残らない）
    canvas.classList.add("hidden");
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); // 念のため

    // ★内部状態もリセットしておくと安心
    fishes = [];
    spawnAcc = 0;
    resultScreen.classList.add("hidden");
    titleScreen.classList.remove("hidden");
    titleScreen.classList.remove("titleSlideOut");
  }

  // -----------------------
  // Boot
  // -----------------------
  async function boot(){
    checkPCOnly();
    resize();

    // 画像ロードが遅い場合に備えて、タイトルを先に出しつつロード
    try{
      await loadImages();
    }catch(e){
      alert("画像の読み込みに失敗しました。\nimagesフォルダとファイル名を確認してください。\n\n" + e.message);
      return;
    }

    btnStart.addEventListener("click", startGame);
    btnToTitle.addEventListener("click", backToTitle);

    window.addEventListener("resize", () => {
      resize();
      checkPCOnly();
    });

    // タイトル魚：ちょいフワフワ
    const tf = document.getElementById("imgTitleFish");
    let a = 0;
    setInterval(() => {
      a += 0.08;
      tf.style.transform = `translateY(${Math.sin(a)*6}px)`;
    }, 16);

    canvas.classList.add("hidden");

  }

  boot();
})();
