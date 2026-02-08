(() => {
  // =========================
  // DATASET
  // =========================
  const NAME_PAIRS = [
    ["ロドリゲス", "モーリシャス"],
  ];

const SCORE_TEXT = {
  S: "完璧な判断でした。またよろしくお願いします。",
  A: "非常に良い判断です。さすがですね。",
  B: "妥当な当確です。",
  C: "かなり危険な当確です。今回は結果が味方しました。",
  D: "危険すぎます。ほぼ事故です。再現性のある判断とは言えません。",
  FAIL: "当選確実を外しました。我が社の信用はガタ落ちです。",
  LATE: "遅すぎです。誰が見ても確定してから出す当確に価値はありません。"
};


  // =========================
  // DOM
  // =========================
  const screenLoading = document.getElementById("screenLoading");
  const screenTitle   = document.getElementById("screenTitle");
  const screenGame    = document.getElementById("screenGame");
  const screenResult  = document.getElementById("screenResult");

  const imgTitle = document.getElementById("imgTitle");
  const btnStart = document.getElementById("btnStart");

  const uiClock  = document.getElementById("uiClock");
  const uiRate   = document.getElementById("uiRate");
  const uiRemain = document.getElementById("uiRemain");

  const nameA = document.getElementById("nameA");
  const nameB = document.getElementById("nameB");
  const labelA = document.getElementById("labelA");
  const labelB = document.getElementById("labelB");

  const uiVotesA = document.getElementById("uiVotesA");
  const uiVotesB = document.getElementById("uiVotesB");
  const uiOpened = document.getElementById("uiOpened");
  const uiDiff   = document.getElementById("uiDiff");

  const barA = document.getElementById("barA");
  const barB = document.getElementById("barB");

  const btnCallA = document.getElementById("btnCallA");
  const btnCallB = document.getElementById("btnCallB");

  const uiToast = document.getElementById("uiToast");

  const uiGrade = document.getElementById("uiGrade");
  const uiWinnerLine = document.getElementById("uiWinnerLine");
  const uiScore = document.getElementById("uiScore");
  const uiZoneLine = document.getElementById("uiZoneLine");
  const uiComment = document.getElementById("uiComment");
  const uiCall = document.getElementById("uiCall");
  const uiWinProb = document.getElementById("uiWinProb");
  const btnBack = document.getElementById("btnBack");

  // =========================
  // HELPERS
  // =========================
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rndInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function showScreen(which){
    [screenLoading, screenTitle, screenGame, screenResult].forEach(s => s.classList.remove("show"));
    which.classList.add("show");
  }

  function fmt(n){
    return n.toLocaleString("ja-JP");
  }

  function toast(msg){
    uiToast.textContent = msg;
    uiToast.classList.add("show");
    setTimeout(()=>uiToast.classList.remove("show"), 900);
  }

  // -------------------------
  // Beta sampling (Gamma trick)
  // -------------------------
  function randNormal(){
    // Box-Muller
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function gammaSample(k){
    // Marsaglia and Tsang for k >= 1
    // for k < 1 use boost method
    if (k < 1){
      const u = Math.random();
      return gammaSample(k + 1) * Math.pow(u, 1 / k);
    }
    const d = k - 1/3;
    const c = 1 / Math.sqrt(9*d);
    while(true){
      let x = randNormal();
      let v = 1 + c*x;
      if (v <= 0) continue;
      v = v*v*v;
      const u = Math.random();
      if (u < 1 - 0.0331*(x*x)*(x*x)) return d*v;
      if (Math.log(u) < 0.5*x*x + d*(1 - v + Math.log(v))) return d*v;
    }
  }

  function betaSample(a, b){
    const x = gammaSample(a);
    const y = gammaSample(b);
    return x / (x + y);
  }

  function binomialSample(n, p){
    // simple loop (n is not huge per batch; remaining can be huge but here used in MC; still ok)
    // For MC we keep n moderate by sim count; loop would be heavy if n big.
    // We'll approximate with normal for large n.
    if (n <= 50){
      let c = 0;
      for(let i=0;i<n;i++) if (Math.random() < p) c++;
      return c;
    }
    const mean = n*p;
    const varr = n*p*(1-p);
    const sd = Math.sqrt(varr);
    // normal approx with clamp
    const z = randNormal();
    const x = Math.round(mean + z*sd);
    return clamp(x, 0, n);
  }

  // =========================
  // GAME STATE
  // =========================
  const STATE = {
    running:false,
    fastForward:false,
    done:false,

    // zone / hidden true p
    zoneName:"",
    p_true:0, // hidden: never shown
    totalVotes:0,

    // counts
    a:0,
    b:0,
    opened:0,
    remain:0,

    // time display
    t0:0, // real start timestamp
    simSeconds:0,

    // sure timing
    sureAtOpened:null, // first time abs(diff)>remain
    isSure:false,

    // call record
    called:false,
    calledName:"",
    calledSide:null, // "A" | "B"
    calledWinProb:0,
    calledAfterSure:false,
    calledAfterFinish:false,

  };

  // =========================
  // ZONE + p_true
  // =========================
  function chooseZone(){
    // 出現率（実装側定義）
    const r = Math.random();
    if (r < 0.40) return "激戦";
    if (r < 0.85) return "普通";
    return "一方的";
  }

  function choosePTrue(zone){
    if (zone === "激戦"){
      return 0.45 + Math.random() * 0.10; // 0.45-0.55
    }
    if (zone === "普通"){
      return 0.40 + Math.random() * 0.20; // 0.40-0.60
    }
    // 一方的：片側に寄せる
    if (Math.random() < 0.5){
      return 0.10 + Math.random() * 0.20; // 0.10-0.30
    }else{
      return 0.70 + Math.random() * 0.20; // 0.70-0.90
    }
  }

  // =========================
  // MONTE CARLO winProb
  //  - Posterior: Beta(1+A, 1+B)
  //  - simulate remaining votes
  // =========================
  function estimateWinProbA(simN = 1200){
    const A = STATE.a;
    const B = STATE.b;
    const R = STATE.remain;

    // if no remaining -> deterministic
    if (R <= 0){
      if (A > B) return 1.0;
      if (A < B) return 0.0;
      return 0.5;
    }

    const alpha = 1 + A;
    const beta = 1 + B;

    let win = 0;
    for(let i=0;i<simN;i++){
      const p = betaSample(alpha, beta);
      const addA = binomialSample(R, p);
      const finalA = A + addA;
      const finalB = B + (R - addA);
      if (finalA > finalB) win++;
      else if (finalA === finalB) win += 0.5; // tie half
    }
    return win / simN;
  }

  // =========================
  // SCORE (片側山型)
  // =========================
  function calcScore(success, w){
    let base = 0;

    if (w < 0.8) base = 0;
    else if (w >= 1.0) base = 0; // risk=0 -> 遅すぎ（FAIL）
    else if (w <= 0.95) base = (w - 0.8) / 0.15;
    else base = 1 - (w - 0.95) / 0.05;

    const raw = (success ? 1 : 0) * base;
    const score = Math.floor(raw * 10000);
    return score;
  }

function gradeFromScore(score, success){
  if (!success) return "FAIL";   // ★外したときだけFAIL

  if (score >= 9000) return "S";
  if (score >= 7000) return "A";
  if (score >= 4000) return "B";
  if (score >= 1000) return "C";
  return "D";                    // ★0点でも当てていればD
}


  // =========================
  // SIMULATION (batch)
  // =========================
  function initRound(){
    const [Aname, Bname] = pick(NAME_PAIRS);

    const zone = chooseZone();
    const p = choosePTrue(zone);

    STATE.running = false;
    STATE.fastForward = false;
    STATE.done = false;

    STATE.zoneName = zone;
    STATE.p_true = p;

    STATE.totalVotes = rndInt(250, 350);
    STATE.a = 0;
    STATE.b = 0;
    STATE.opened = 0;
    STATE.remain = STATE.totalVotes;

    STATE.t0 = performance.now();
    STATE.simSeconds = 0;

    STATE.sureAtOpened = null;
    STATE.isSure = false;

    STATE.called = false;
    STATE.calledName = "";
    STATE.calledSide = null;
    STATE.calledWinProb = 0;
    STATE.calledAfterSure = false;

    // UI names
    nameA.textContent = Aname;
    nameB.textContent = Bname;
    labelA.textContent = `${Aname}（A）`;
    labelB.textContent = `${Bname}（B）`;
    btnCallA.textContent = `${Aname} 当選確実`;
    btnCallB.textContent = `${Bname} 当選確実`;
  }

    function nextBatchSize(){
        return STATE.remain > 0 ? 3 : 0; // ★常に1票ずつ
     }


  function applyBatch(n){
    if (n <= 0) return;

    // p_true で票生成（内部パラメータ）
    const addA = binomialSample(n, STATE.p_true);
    const addB = n - addA;

    STATE.a += addA;
    STATE.b += addB;
    STATE.opened += n;
    STATE.remain -= n;

    // 勝敗確定タイミング：票差 > 残り票 が初めて成立
    const diff = Math.abs(STATE.a - STATE.b);
    if (!STATE.isSure && diff > STATE.remain){
      STATE.isSure = true;
      STATE.sureAtOpened = STATE.opened;
    }

    if (STATE.remain <= 0){
      STATE.remain = 0;
      STATE.done = true;
      STATE.running = false;
    }
  }

  function updateClock(){
    // 20:00 開始。現実時間をそれっぽく進める（スコアには不使用）
    // 1秒(実) = 6秒(表示) くらいで動かす
    const now = performance.now();
    const elapsed = (now - STATE.t0) / 1000;
    const speed = STATE.fastForward ? 18 : 6;
    STATE.simSeconds = Math.floor(elapsed * speed);

    const base = 20 * 3600; // 20:00:00
    const t = base + STATE.simSeconds;

    const hh = String(Math.floor(t/3600)).padStart(2,"0");
    const mm = String(Math.floor((t%3600)/60)).padStart(2,"0");
    const ss = String(t%60).padStart(2,"0");
    uiClock.textContent = `${hh}:${mm}:${ss}`;
  }

  function render(){
    updateClock();

    const opened = STATE.opened;
    const total = STATE.totalVotes;
    const rate = total > 0 ? Math.floor((opened / total) * 1000) / 10 : 0; // 0.1%刻み
    uiRate.textContent = `${rate.toFixed(1)}%`;
    uiRemain.textContent = fmt(STATE.remain);

    uiVotesA.textContent = fmt(STATE.a);
    uiVotesB.textContent = fmt(STATE.b);
    uiOpened.textContent = fmt(opened);

    const diff = STATE.a - STATE.b;
    uiDiff.textContent = (diff >= 0 ? "+" : "") + fmt(diff);

    // bars: opened votes share
    const denom = Math.max(1, STATE.a + STATE.b);
    const shareA = STATE.a / denom;
    const shareB = STATE.b / denom;

    barA.style.width = `${clamp(shareA * 100, 0, 100)}%`;
    barB.style.width = `${clamp(shareB * 100, 0, 100)}%`;
  }

  let tickTimer = null;

function startLoop(){
  if (tickTimer) clearInterval(tickTimer);

  STATE.running = true;

  // ★ 1票ずつなので、更新自体を高速に回す
  // 通常：20ms（= 約50票/秒）
  // 早送り：1ms（= 爆速）
  const intervalMs = STATE.fastForward ? 10 : 700;

  tickTimer = setInterval(() => {
    if (!STATE.running) return;

    const n = nextBatchSize(); // 1
    applyBatch(n);
    render();

    if (STATE.done){
      clearInterval(tickTimer);
      tickTimer = null;
      finishToResult();
    }
  }, intervalMs);
}


  // =========================
  // CALL (player action)
  // =========================
  function lockButtons(){
    btnCallA.disabled = true;
    btnCallB.disabled = true;
  }
  function unlockButtons(){
    btnCallA.disabled = false;
    btnCallB.disabled = false;
  }

function onCall(side){
  if (STATE.called) return;
  STATE.called = true;

  const wA = estimateWinProbA(800);
  const w = (side === "A") ? wA : (1 - wA);

  STATE.calledSide = side;
  STATE.calledWinProb = w;
  STATE.calledName = (side === "A") ? nameA.textContent : nameB.textContent;

  // ★ 追加
  STATE.calledAfterFinish = (STATE.remain === 0);

  lockButtons();

  STATE.fastForward = true;
  toast("当確を出しました。開票を早送りします…");
  startLoop();
}


  // =========================
  // RESULT
  // =========================
  function finishToResult(){
    // 最終勝者（実現値）
    let winnerSide = "A";
    if (STATE.a > STATE.b) winnerSide = "A";
    else if (STATE.b > STATE.a) winnerSide = "B";
    else winnerSide = (Math.random() < 0.5 ? "A" : "B"); // 同票はランダム決着（稀）

    const winnerName = (winnerSide === "A") ? nameA.textContent : nameB.textContent;

    // 成否：当確した側が勝者なら成功
    const success = (STATE.calledSide === winnerSide);

    // risk=0（winProb=1.0）なら遅すぎ（FAIL扱い）
    const w = STATE.calledWinProb;
    const EPS = 1e-9;
    const tooLate = (!STATE.called) || STATE.calledAfterFinish || (STATE.called && w >= 1.0 - EPS);




    const score = calcScore(success && !tooLate, w);
    let grade = gradeFromScore(score, success && !tooLate);


    // ★ 追加：95%超えは最大Bまで
    if (w > 0.95 && grade !== "FAIL") {
    grade = "B";
}


    // リザルト表示内容
    uiWinnerLine.textContent = `${winnerName} が勝った！`;
    uiScore.textContent = String(score);

    uiZoneLine.textContent = `${STATE.zoneName}でした。`;

    // コメント：失敗 or 遅すぎ は FAIL
        let commentKey;

        if (tooLate){
        commentKey = "LATE";          // ★ 遅すぎ
        }else if (!success){
        commentKey = "FAIL";          // ★ 外した
        }else{
        commentKey = grade;           // ★ 成功（S〜D）
        }

        uiComment.textContent = SCORE_TEXT[commentKey];


    uiGrade.textContent = grade;

    if (!STATE.called){
        uiCall.textContent = "未発表";
        uiWinProb.textContent = "-";
        } else {
        uiCall.textContent = `${STATE.calledName} 当選確実`;
        uiWinProb.textContent = `${Math.round(w * 1000) / 10}%`;
        }


    showScreen(screenResult);
  }

  // =========================
  // FLOW
  // =========================
  async function preload(){
    // images/title.webp
    const p = new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = "images/title.webp";
    });
    const im = await p;
    imgTitle.src = im.src;
  }

  function startGame(){
    initRound();
    showScreen(screenGame);
    unlockButtons();
    render();
    startLoop();
  }

  // =========================
  // EVENTS
  // =========================
  btnStart.addEventListener("click", () => startGame());
  btnCallA.addEventListener("click", () => onCall("A"));
  btnCallB.addEventListener("click", () => onCall("B"));
  btnBack.addEventListener("click", () => location.reload());

  // =========================
  // BOOT
  // =========================
  (async () => {
    showScreen(screenLoading);
    try{
      await preload();
      showScreen(screenTitle);
    }catch(e){
      // 画像が無い/壊れてても遊べるように
      imgTitle.alt = "当確発表～!!";
      showScreen(screenTitle);
    }
  })();

})();
