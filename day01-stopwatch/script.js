// ストップウォッチチャレンジ
// - 25~35秒（整数）を提示
// - 表示は小数第2位
// - 開始3秒後に時計がフェードアウト
// - フェード後、同じ場所に妨害コメント（1文字ずつ）
// - Stop時点で妨害コメントは即消える
// - 記録コメントは指定のルール
// - 連続成功は特別メッセージ（n>=2）

const $ = (id) => document.getElementById(id);

const timeEl = $("time");
const talkEl = $("talk");
const btnEl = $("btn");
const targetEl = $("targetSec");
const resultEl = $("result");
const streakEl = $("streak");
const retryEl = $("retry");

const SETTINGS = {
  minTarget: 25,
  maxTarget: 35,
  fadeAfterSec: 3,
  // 連続判定：±0.10秒以内を「成功」とする（連続メッセージ用）
  successAbsSec: 0.10,
  // 妨害コメントが出始めるまで（フェード後すぐ〜ちょい遅れ）
  heckleFirstDelayMs: [400, 1000],
  // 次の妨害コメントまでの間隔
  heckleIntervalMs: [3500, 5500],
  // 1文字表示スピード
  typeSpeedMs: 100,
};

const HECKLES = [
  "もしかして体を揺らしながら数えてる？  気を付けて、傍からみたらすごく滑稽だよ。",
  "このチャレンジに成功したら何もらえるか知ってる？  別になにももらえないよ。",
  "どしたん、話きこか？  うん、それはあっちが悪いわ。  僕ならそんな思いさせないのに。",
  "大丈夫、失敗しても君の価値は変わらないよ。  成功しても変わらないけど。",
  "0,1,1,2,3,5,8,13,21…  あ、これはフィボナッチ数列だった。",
  "「私は天才ではありません。  ただ、人よりも長く一つのことと向き合っただけです。」（アインシュタイン）",
  "失敗しても大丈夫。 時が早く過ぎただけだ。",
  "落ち着けば大丈夫。  一回深呼吸しよう。",
  "目をつぶろうとなんてしちゃだめだよ。  僕と向き合ってチャレンジを成功させるんだ。",
  "月がきれいですね。",
  "チャレンジ成功するまでやるよな？  まさか逃げないよな？",
  "ねむい。",
  "君は宇宙人っていると思う？",
  "1億円あったら何する？  僕はたらふくたまごボーロが食べたいなぁ。",
  "大学生活は約1億秒あるんだって。  貴重だよねぇ。",
  "エッフェル塔の高さは夏と冬で変わるらしいよ。",
  "日本の歯医者の数はコンビニの数より多いらしいよ。",
  "自分の背中を見ることはできない",
  "イルカとクジラの違い知ってる？           ググレカス。"
];

// -------------------------
// 状態
// -------------------------
let state = "idle"; // idle | playing
let targetSec = 0;

let startPerf = 0;
let rafId = 0;

let faded = false;

// 妨害コメント関連
let heckleTimerId = 0;      // 次コメント予約
let typingTimerId = 0;      // 1文字表示のsetTimeout
let currentTypingAbort = null;

// 連続成功
let streak = 0;

// -------------------------
// ユーティリティ
// -------------------------
function randInt(min, max) {
  // 両端含む
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randBetween(min, max) {
  return min + Math.random() * (max - min);
}
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let heckleDeck = [];

function nextHeckleText() {
  if (heckleDeck.length === 0) {
    heckleDeck = shuffle([...HECKLES]); // 全文をシャッフルして山札作成
  }
  return heckleDeck.pop(); // 1枚引く
}

function fmt2(n) {
  return n.toFixed(2);
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// -------------------------
// ゲーム初期化 / 目標更新
// -------------------------
function newTarget() {
  targetSec = randInt(SETTINGS.minTarget, SETTINGS.maxTarget);
  targetEl.textContent = String(targetSec);
  setIdleView();
  resultEl.textContent = "";
}

function setIdleView() {
  state = "idle";
  btnEl.textContent = "スタート";
  btnEl.disabled = false;

  // 表示リセット
  timeEl.textContent = "0.00";
  timeEl.classList.remove("faded");
  faded = false;

  // 妨害コメントを消す
  stopHeckles(true);
  talkEl.classList.remove("show");
  talkEl.textContent = "";

  // 連続表示
  streakEl.textContent = streak >= 2 ? `${streak}連続中！` : "";
}

// -------------------------
// タイマー開始 / 停止
// -------------------------
function start() {
  if (state !== "idle") return;

  state = "playing";
  btnEl.textContent = "ストップ";
  resultEl.textContent = "";
  stopHeckles(true); // 念のため
  talkEl.classList.remove("show");
  talkEl.textContent = "";

  timeEl.classList.remove("faded");
  faded = false;

  startPerf = performance.now();
  rafId = requestAnimationFrame(tick);
}

function stop() {
  if (state !== "playing") return;

  // タイマー停止
  cancelAnimationFrame(rafId);
  rafId = 0;

  const endPerf = performance.now();
  const elapsedSec = (endPerf - startPerf) / 1000;

  // 妨害コメント即消し
  stopHeckles(true);
  talkEl.classList.remove("show");
  talkEl.textContent = "";

  // フェード解除（結果の時は見せてもいいけど、ここは残してもOK）
  // ただUI的に「記録が出た感」を出すため、時間を一瞬だけ戻して表示
  timeEl.classList.remove("faded");

  // 結果出し
  const diff = elapsedSec - targetSec; // +なら遅い / -なら早い
  const abs = Math.abs(diff);

  // 連続成功の判定（±0.10秒以内）
  const isSuccess = abs <= SETTINGS.successAbsSec;
  if (isSuccess) streak += 1;
  else streak = 0;

  // 表示更新
  timeEl.textContent = fmt2(elapsedSec);

  const comment = buildRecordComment(diff);
  const streakMsg = streak >= 2 ? `　<span class="good">${streak}連続中！</span>` : "";
  streakEl.textContent = streak >= 2 ? `${streak}連続中！` : "";

  const diffText = diff >= 0 ? `+${fmt2(diff)}` : `${fmt2(diff)}`;

  resultEl.innerHTML =
    `記録：<strong>${fmt2(elapsedSec)}</strong> 秒（目標 ${targetSec} 秒）<br/>` +
    `ズレ：<strong>${diffText}</strong> 秒　—　` +
    `<span class="${isSuccess ? "good" : "bad"}">${comment}</span>` +
    streakMsg;

  // 状態を戻す
  state = "idle";
  btnEl.textContent = "スタート";
}

// -------------------------
// メインループ（表示のみ）
// -------------------------
function tick(now) {
  if (state !== "playing") return;

  const elapsed = (now - startPerf) / 1000;
  timeEl.textContent = fmt2(elapsed);

  // 3秒あたりからフェードアウト
  if (!faded && elapsed >= SETTINGS.fadeAfterSec) {
    faded = true;
    timeEl.classList.add("faded");

    // フェード後に妨害開始
    scheduleFirstHeckle();
  }

  rafId = requestAnimationFrame(tick);
}

// -------------------------
// 記録コメント（指定ルール）
// diff = elapsed - target
// -------------------------
function buildRecordComment(diff) {
  const abs = Math.abs(diff);

  // 指定に「±0.1：おしい！」と「±0：君はpunctualだ！」があるので
  // まず完全一致 -> 次に0.1以内 -> 次に0.5以内…の順で判定
  // （浮動小数の誤差を考え、超小さい範囲を「0扱い」にする）
  const nearZero = 0.005; // 5ms以内を「±0」扱い
  if (abs <= nearZero) return "君はpunctualだ！";
  if (abs <= 0.10) return "おしい！";
  if (abs <= 0.50) return "まだまだだね";

  // ここからは「遅い/早い」方向で分ける
  if (diff >= 0) {
    if (abs >= 10) return "1秒って知ってる？";
    if (abs >= 5) return "もしかして：遅刻魔";
    if (abs >= 1) return "君の時間はずいぶんゆっくりだね";
    // 0.5より上はここに落ちないはずだが保険
    return "まだまだだね";
  } else {
    // diff < 0（早い）
    // 指定は -1以上: はやいよ。 / -5以上: 君はせっかちなのかい？
    // 「-5以上」は abs>=5 の方向で適用
    if (abs >= 5) return "君はせっかちなのかい？";
    if (abs >= 1) return "はやいよ。";
    return "まだまだだね";
  }
}

// -------------------------
// 妨害コメント（1文字ずつ）
// -------------------------
function scheduleFirstHeckle() {
  // 既に止められてたら出さない
  if (state !== "playing") return;

  const d = randBetween(SETTINGS.heckleFirstDelayMs[0], SETTINGS.heckleFirstDelayMs[1]);
  heckleTimerId = window.setTimeout(() => {
    showHeckle();
  }, d);
}

function scheduleNextHeckle() {
  if (state !== "playing") return;

  const d = randBetween(SETTINGS.heckleIntervalMs[0], SETTINGS.heckleIntervalMs[1]);
  heckleTimerId = window.setTimeout(() => {
    showHeckle();
  }, d);
}

function showHeckle() {
  if (state !== "playing") return;

  // しゃべりを表示
  talkEl.classList.add("show");

  // 前のタイピングが残ってたら中止
  abortTyping();

 const text = nextHeckleText();

  typeText(talkEl, text, () => {
    // 打ち終わったら次を予約
    scheduleNextHeckle();
  });
}

function typeText(el, text, onDone) {
  el.textContent = "";

  let i = 0;
  let aborted = false;
  currentTypingAbort = () => { aborted = true; };

  const step = () => {
    if (aborted) return;
    if (state !== "playing") return;

    el.textContent += text[i];
    i += 1;

    if (i >= text.length) {
      currentTypingAbort = null;
      if (typeof onDone === "function") onDone();
      return;
    }

    typingTimerId = window.setTimeout(step, SETTINGS.typeSpeedMs);
  };

  step();
}


function abortTyping() {
  if (currentTypingAbort) currentTypingAbort();
  currentTypingAbort = null;
  if (typingTimerId) window.clearTimeout(typingTimerId);
  typingTimerId = 0;
}

function stopHeckles(hard = false) {
  if (heckleTimerId) window.clearTimeout(heckleTimerId);
  heckleTimerId = 0;

  abortTyping();

  if (hard) {
    talkEl.textContent = "";
  }
}

// -------------------------
// イベント
// -------------------------
btnEl.addEventListener("click", () => {
  if (state === "idle") start();
  else stop();
});

retryEl.addEventListener("click", () => {
  if (state === "playing") return;
  newTarget();
});

// 初期化
newTarget();
