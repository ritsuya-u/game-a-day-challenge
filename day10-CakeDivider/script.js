(() => {
  // =========================
  // Assets
  // =========================
  const IMG = {};
  const ASSETS = {
    title: "images/title.webp",
    btn_divide: "images/btn_dividecake.webp",
    btn_stop: "images/btn_stop.webp",
    btn_more: "images/btn_saranikiru.webp",
    btn_finish: "images/btn_owaru.webp",
    btn_back: "images/btn_backtitle.webp",
  };

  const loadImage = (key, src) => new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => { IMG[key] = im; resolve(); };
    im.onerror = () => reject(new Error("Failed to load: " + src));
    im.src = src;
  });

  // =========================
  // DOM
  // =========================
  const screenLoading = document.getElementById("screenLoading");
  const screenTitle   = document.getElementById("screenTitle");
  const screenPlay    = document.getElementById("screenPlay");
  const screenResult  = document.getElementById("screenResult");

  const imgTitle = document.getElementById("imgTitle");
  const imgBtnDivide = document.getElementById("imgBtnDivide");
  const imgBtnStop   = document.getElementById("imgBtnStop");
  const imgBtnMore   = document.getElementById("imgBtnMore");
  const imgBtnFinish = document.getElementById("imgBtnFinish");
  const imgBtnBack   = document.getElementById("imgBtnBack");

  const btnToPlay = document.getElementById("btnToPlay");
  const btnStop   = document.getElementById("btnStop");
  const btnMore   = document.getElementById("btnMore");
  const btnFinish = document.getElementById("btnFinish");
  const btnBackTitle = document.getElementById("btnBackTitle");

  const btnRowPlay1 = document.getElementById("btnRowPlay1");
  const btnRowPlay2 = document.getElementById("btnRowPlay2");

  const orderText = document.getElementById("orderText");

  const resN = document.getElementById("resN");
  const resK = document.getElementById("resK");
  const resErr = document.getElementById("resErr");
  const resComment = document.getElementById("resComment");

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const showScreen = (which) => {
    [screenLoading, screenTitle, screenPlay, screenResult].forEach(s => s.classList.remove("show"));
    which.classList.add("show");
  };

  // =========================
  // Helpers
  // =========================
  const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
  const randInt = (a,b)=> Math.floor(a + Math.random()*(b-a+1));

  // 直線 n·p = d の表現を [0,π) に正規化（dも同時に整合）
  function normalizeLine(theta, dN){
    const k = Math.floor(theta / Math.PI);
    theta = theta - k * Math.PI;
    if ((k % 2) !== 0) dN = -dN;

    if (theta < 0){ theta += Math.PI; dN = -dN; }
    if (theta >= Math.PI){ theta -= Math.PI; dN = -dN; }

    return { theta, dN };
  }

  // 入力（ズレ防止：押した瞬間で確定）
  function bindInstant(el, handler){
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      handler(e);
    }, { passive:false });
  }

  // =========================
  // Geometry (cake-space is unit circle)
  // =========================
  // cake-space: center (0,0), radius = 1
  // a cut is: thetaLocal in [0,π), dN in (-1,1), i.e. cosθ x + sinθ y = dN

  function chordEndpointsUnit(theta, dN){
    // returns endpoints in unit circle coordinates
    const nx = Math.cos(theta), ny = Math.sin(theta);
    const tx = -ny, ty = nx;

    const d = dN;
    const half = Math.sqrt(Math.max(0, 1 - d*d));
    const px = nx * d;
    const py = ny * d;

    return {
      ax: px + tx*half, ay: py + ty*half,
      bx: px - tx*half, by: py - ty*half,
    };
  }

  function segmentIntersection(a,b,c,d){
    const EPS = 1e-10;
    const r = { x: b.x-a.x, y: b.y-a.y };
    const s = { x: d.x-c.x, y: d.y-c.y };
    const rxs = r.x*s.y - r.y*s.x;
    if (Math.abs(rxs) < EPS) return null;

    const q_p = { x: c.x-a.x, y: c.y-a.y };
    const t = (q_p.x*s.y - q_p.y*s.x) / rxs;
    const u = (q_p.x*r.y - q_p.y*r.x) / rxs;

    // exclude endpoints (stability)
    if (t <= 1e-6 || t >= 1-1e-6 || u <= 1e-6 || u >= 1-1e-6) return null;
    return { x: a.x + t*r.x, y: a.y + t*r.y };
  }

  function countPiecesExact(cuts){
    // pieces = 1 + Σ( intersections_i + 1 )
    let pieces = 1;
    const segments = [];
    const EPS_PT = 1e-3; // unit space

    for (const cut of cuts){
      const e = chordEndpointsUnit(cut.thetaLocal, cut.dN);
      const A = {x:e.ax, y:e.ay};
      const B = {x:e.bx, y:e.by};

      const pts = [];
      for (const seg of segments){
        const P = segmentIntersection(A,B, seg.A, seg.B);
        if (!P) continue;

        let dup = false;
        for (const q of pts){
          const dx = P.x-q.x, dy = P.y-q.y;
          if (dx*dx + dy*dy < EPS_PT*EPS_PT){ dup = true; break; }
        }
        if (!dup) pts.push(P);
      }

      pieces += (pts.length + 1);
      segments.push({A,B});
    }
    return pieces;
  }

  // seeded RNG (stable)
  function mulberry32(seed){
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function maxErrorEstimate(n, cuts){
    // Monte Carlo in unit circle
    const ideal = 1 / n;
    const rng = mulberry32(0xC0FFEE ^ (cuts.length * 1337) ^ (n * 97));

    // sample count
    const N = 45000; // stable & still fast
    const counts = new Map();
    let inside = 0;

    for (let i=0;i<N;i++){
      // sample in square [-1,1]^2 then reject
      const x = rng()*2 - 1;
      const y = rng()*2 - 1;
      if (x*x + y*y > 1) continue;
      inside++;

      let key = "";
      for (const c of cuts){
        const s = Math.cos(c.thetaLocal)*x + Math.sin(c.thetaLocal)*y - c.dN;
        key += (s>=0 ? "1":"0");
      }
      counts.set(key, (counts.get(key)||0) + 1);
    }

    if (inside === 0) return 0;

    let maxErr = 0;
    for (const cnt of counts.values()){
      const frac = cnt / inside;
      const err = Math.abs(frac - ideal) / ideal * 100;
      if (err > maxErr) maxErr = err;
    }
    return isFinite(maxErr) ? maxErr : 0;
  }

  // =========================
  // Result comment rules
  // =========================
  function commentFor(n,k,maxErr){
    if (n > k) return "全員分用意されず喧嘩が起きました。最低なお店です。";
    if (n < k) return "余りがでてそれをめぐり喧嘩が起きました。最低なお店です。";
    if (maxErr < 5) return "ケーキをめぐって喧嘩しなかったのは10年ぶりです。素晴らしい。";
    if (maxErr < 15) return "なかなか正確なお店ですね。またきます。";
    if (maxErr < 30) return "もっと丁寧に切り分けてほしかったです。";
    if (maxErr < 50) return "小さいケーキを食べる人の気持ちを考えたことはありますか";
    if (maxErr < 100) return "不公平なケーキは争いを生みます。二度と来ません。";
    return "ケーキをめぐって喧嘩が起き、家庭が崩壊しました。最低なお店です。";
  }

  // =========================
  // Game State
  // =========================
  const STATE = {
    phase: "title", // title | angle | offset | choice | result
    n: 7,
    cuts: [],       // {thetaLocal, dN}

    // rotation (visual)
    rot: 0,
    rotSpeed: 1.5,

    // selection
    cakeRotLocked: 0, // locked rotation at STOP (angle)
    dLockedN: 0,      // in unit space (-1..1) during offset
    offsetT: 0,
    offsetSpeed: 2.2,

    // view
    lastTS: 0,
  };

  // =========================
  // View / Canvas scaling
  // =========================
  const VIEW = {
    size: 600, // css px
    dpr: 1,
    cx: 0, cy: 0,
    Rpx: 180,
  };

  const GUIDE_THETA_SCREEN = Math.PI * 0.25; // 点線は画面固定

  function resizeCanvas(){
    const cssSize = Math.min(680, Math.floor(Math.min(window.innerWidth*0.92, window.innerHeight*0.62)));
    VIEW.size = Math.max(320, cssSize);
    VIEW.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    canvas.style.width = VIEW.size + "px";
    canvas.style.height = VIEW.size + "px";
    canvas.width = Math.floor(VIEW.size * VIEW.dpr);
    canvas.height = Math.floor(VIEW.size * VIEW.dpr);

    ctx.setTransform(VIEW.dpr,0,0,VIEW.dpr,0,0);

    VIEW.cx = VIEW.size/2;
    VIEW.cy = VIEW.size/2;
    VIEW.Rpx = Math.min(210, VIEW.size*0.33);
  }

  function toScreen(xu, yu){
    // unit -> px
    return {
      x: VIEW.cx + xu * VIEW.Rpx,
      y: VIEW.cy + yu * VIEW.Rpx
    };
  }

  function clear(){
    ctx.clearRect(0,0,VIEW.size,VIEW.size);
  }

function drawCake(rot){
  const {cx,cy,Rpx} = VIEW;

  // cake
  ctx.save();
  ctx.translate(cx,cy);

  ctx.beginPath();
  ctx.arc(0,0,Rpx,0,Math.PI*2);
  ctx.fillStyle = "#fff";
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle = "#8bb3c7";
  ctx.stroke();

  // strawberries
  ctx.save();
  ctx.rotate(rot);
  for (let i=0;i<8;i++){
    const a = (i/8)*Math.PI*2 + 0.25;
    const rr = Rpx*0.72;
    const x = Math.cos(a)*rr;
    const y = Math.sin(a)*rr;
    ctx.beginPath();
    ctx.arc(x,y,Rpx*0.085,0,Math.PI*2);
    ctx.fillStyle = "#ff5454";
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
}


  function drawCutLine(thetaScreen, dN, dashed){
    // line defined in unit: cosθ x + sinθ y = dN
    // but thetaScreen is in screen coords; we just draw in screen using unit->px
    const nx = Math.cos(thetaScreen), ny = Math.sin(thetaScreen);
    const tx = -ny, ty = nx;
    const d = dN;

    const half = Math.sqrt(Math.max(0, 1 - d*d));
    const px = nx * d;
    const py = ny * d;

    const a = { x: px + tx*half, y: py + ty*half };
    const b = { x: px - tx*half, y: py - ty*half };

    const A = toScreen(a.x, a.y);
    const B = toScreen(b.x, b.y);

    ctx.save();
    ctx.lineWidth = dashed ? 6 : 4;
    ctx.strokeStyle = "#1b2a66";
    if (dashed) ctx.setLineDash([14,10]);
    else ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawCommittedCuts(cakeRot){
    // cuts are stored in cake coords; to draw them on rotated cake:
    // thetaScreen = thetaLocal + cakeRot
    for (const c of STATE.cuts){
      drawCutLine(c.thetaLocal + cakeRot, c.dN, false);
    }
  }

  function drawFrame(){
    clear();

    const cakeRot = (STATE.phase === "angle") ? STATE.rot : STATE.cakeRotLocked;

    drawCake(cakeRot);
    drawCommittedCuts(cakeRot);

    if (STATE.phase === "angle"){
      // 点線固定、ケーキだけ回転
      drawCutLine(GUIDE_THETA_SCREEN, 0, true);
    } else if (STATE.phase === "offset"){
      // 点線固定、位置だけ動く
      drawCutLine(GUIDE_THETA_SCREEN, STATE.dLockedN, true);
    }
  }

  // =========================
  // Flow
  // =========================
  function newOrder(){
    STATE.n = randInt(2,10);
    STATE.cuts = [];
    STATE.rot = 0;
    STATE.cakeRotLocked = 0;
    STATE.dLockedN = 0;
    STATE.offsetT = 0;
    orderText.textContent = `${STATE.n}等分して！`;
  }

  function enterTitle(){
    STATE.phase = "title";
    showScreen(screenTitle);
  }

  function enterPlayAngle(){
    STATE.phase = "angle";
    btnRowPlay1.classList.add("show");
    btnRowPlay2.classList.remove("show");
    showScreen(screenPlay);
    orderText.textContent = `${STATE.n}等分して！`;
  }

  function enterPlayOffset(){
    STATE.phase = "offset";
    // angle STOP: lock cake rotation NOW
    STATE.cakeRotLocked = STATE.rot;
    STATE.dLockedN = 0;
    STATE.offsetT = 0;
  }

  function enterChoice(){
    STATE.phase = "choice";
    btnRowPlay1.classList.remove("show");
    btnRowPlay2.classList.add("show");
  }

  function commitCut(){
    // guide line is fixed in screen (GUIDE_THETA_SCREEN)
    // convert to cake coords by subtracting locked cake rotation
    let thetaLocal = GUIDE_THETA_SCREEN - STATE.cakeRotLocked;
    let dN = clamp(STATE.dLockedN, -0.98, 0.98);

    const nd = normalizeLine(thetaLocal, dN);
    thetaLocal = nd.theta;
    dN = nd.dN;

    // optional: ignore nearly same cut (prevents double-tap duplicates)
    const EPS_TH = 0.01;
    const EPS_DN = 0.01;
    for (const c of STATE.cuts){
      const dt = Math.min(
        Math.abs(c.thetaLocal - thetaLocal),
        Math.abs((c.thetaLocal + Math.PI) - thetaLocal),
        Math.abs(c.thetaLocal - (thetaLocal + Math.PI))
      );
      if (dt < EPS_TH && Math.abs(c.dN - dN) < EPS_DN){
        return; // too similar -> ignore
      }
    }

    STATE.cuts.push({ thetaLocal, dN });
  }

  function enterResult(){
    const k = countPiecesExact(STATE.cuts);

    let maxErr = 0;
    if (k === STATE.n){
      maxErr = maxErrorEstimate(STATE.n, STATE.cuts);
    }

    const comment = commentFor(STATE.n, k, maxErr);

    resN.textContent = String(STATE.n);
    resK.textContent = String(k);

    if (k !== STATE.n){
      resErr.textContent = "--";
    } else {
      resErr.textContent = (Math.round(maxErr*10)/10).toFixed(1);
    }

    resComment.textContent = comment;

    STATE.phase = "result";
    showScreen(screenResult);
  }

  // =========================
  // Loop
  // =========================
  function tick(ts){
    const dt = STATE.lastTS ? (ts - STATE.lastTS)/1000 : 0;
    STATE.lastTS = ts;

    if (STATE.phase === "angle"){
      STATE.rot += STATE.rotSpeed * dt;
    } else if (STATE.phase === "offset"){
      STATE.offsetT += STATE.offsetSpeed * dt;
      // oscillate d in unit space
      STATE.dLockedN = Math.sin(STATE.offsetT) * 0.82;
    }

    if (STATE.phase === "angle" || STATE.phase === "offset" || STATE.phase === "choice"){
      drawFrame();
    }

    requestAnimationFrame(tick);
  }

  // =========================
  // Events
  // =========================
  bindInstant(btnToPlay, () => {
    newOrder();
    enterPlayAngle();
  });

  bindInstant(btnStop, () => {
    if (STATE.phase === "angle"){
      enterPlayOffset();
      return;
    }
    if (STATE.phase === "offset"){
      commitCut();
      enterChoice();
      return;
    }
  });

  bindInstant(btnMore, () => {
    if (STATE.phase !== "choice") return;
    btnRowPlay2.classList.remove("show");
    btnRowPlay1.classList.add("show");
    STATE.phase = "angle";
  });

  bindInstant(btnFinish, () => {
    if (STATE.phase !== "choice") return;
    enterResult();
  });

  bindInstant(btnBackTitle, () => {
    enterTitle();
  });

  window.addEventListener("resize", () => {
    resizeCanvas();
    if (STATE.phase === "angle" || STATE.phase === "offset" || STATE.phase === "choice"){
      drawFrame();
    }
  });

  // =========================
  // Boot
  // =========================
  async function boot(){
    showScreen(screenLoading);
    resizeCanvas();

    for (const [k, src] of Object.entries(ASSETS)){
      await loadImage(k, src);
    }

    imgTitle.src = IMG.title.src;
    imgBtnDivide.src = IMG.btn_divide.src;
    imgBtnStop.src   = IMG.btn_stop.src;
    imgBtnMore.src   = IMG.btn_more.src;
    imgBtnFinish.src = IMG.btn_finish.src;
    imgBtnBack.src   = IMG.btn_back.src;

    enterTitle();
    requestAnimationFrame(tick);
  }

  boot().catch(err => {
    console.error(err);
    alert("画像の読み込みに失敗しました。\nimagesフォルダ配置とファイル名を確認してください。");
  });
})();
