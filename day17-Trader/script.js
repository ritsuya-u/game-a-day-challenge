const START_CASH = 1_000_000;
const START_PRICE = 10_000;
const TIME_LIMIT_MS = 60_000;
const PRICE_FLOOR = 1;

const VOL_SETTINGS = {
  Low: { pct: 0.002, shiftChance: 0.02 },
  Mid: { pct: 0.008, shiftChance: 0.05 },
  High: { pct: 0.02, shiftChance: 0.08 }
};
const VOL_KEYS = Object.keys(VOL_SETTINGS);
const VOL_PICK_WEIGHT = {
  Low: 1,
  Mid: 3,
  High: 3
};

const titleScreen = document.getElementById("titleScreen");
const gameScreen = document.getElementById("gameScreen");
const resultScreen = document.getElementById("resultScreen");

const startButton = document.getElementById("startButton");
const retryButton = document.getElementById("retryButton");
const titleButton = document.getElementById("titleButton");

const timeDisplay = document.getElementById("timeDisplay");
const priceDisplay = document.getElementById("priceDisplay");
const cashDisplay = document.getElementById("cashDisplay");
const amountDisplay = document.getElementById("amountDisplay");
const finalCash = document.getElementById("finalCash");
const profitRate = document.getElementById("profitRate");
const bossComment = document.getElementById("bossComment");
const message = document.getElementById("message");

const qtyInput = document.getElementById("qtyInput");
const buyButton = document.getElementById("buyButton");
const sellButton = document.getElementById("sellButton");

const chart = document.getElementById("priceChart");
const ctx = chart.getContext("2d");

const state = {
  running: false,
  startTime: 0,
  lastTickTime: 0,
  price: START_PRICE,
  cash: START_CASH,
  amount: 0,
  volatility: "Mid",
  priceHistory: []
};

function formatYen(value) {
  return `¥${Math.floor(value).toLocaleString("ja-JP")}`;
}

function formatTime(remainingMs) {
  const totalSec = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function showScreen(screen) {
  titleScreen.classList.remove("active");
  gameScreen.classList.remove("active");
  resultScreen.classList.remove("active");
  screen.classList.add("active");
}

function resetGame() {
  state.running = false;
  state.startTime = 0;
  state.lastTickTime = 0;
  state.price = START_PRICE;
  state.cash = START_CASH;
  state.amount = 0;
  state.volatility = "Mid";
  state.priceHistory = [{ time: 0, price: START_PRICE }];
  qtyInput.value = "1";
  message.textContent = "";
  updateUI(TIME_LIMIT_MS);
  drawChart();
}

function getQty() {
  const value = Number.parseInt(qtyInput.value, 10);
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }
  return Math.floor(value);
}

function setMessage(text) {
  message.textContent = text;
}

function updateUI(remainingMs) {
  timeDisplay.textContent = formatTime(remainingMs);
  priceDisplay.textContent = formatYen(state.price);
  cashDisplay.textContent = formatYen(state.cash);
  amountDisplay.textContent = `${state.amount.toLocaleString("ja-JP")}株`;
}

function drawChart() {
  const w = chart.width;
  const h = chart.height;
  ctx.clearRect(0, 0, w, h);

  const history = state.priceHistory;
  if (history.length < 1) {
    return;
  }

  const prices = history.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(1, max - min);
  const pad = 20;
  const baseY = h - pad - ((START_PRICE - min) / range) * (h - pad * 2);

  if (baseY >= pad && baseY <= h - pad) {
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(w, baseY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = "#cab116";
  ctx.lineWidth = 5;
  ctx.beginPath();

  history.forEach((point, i) => {
    const x = (point.time / TIME_LIMIT_MS) * w;
    const y = h - pad - ((point.price - min) / range) * (h - pad * 2);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
}

function maybeShiftVolatility() {
  const nowSetting = VOL_SETTINGS[state.volatility];
  if (Math.random() < nowSetting.shiftChance) {
    const candidates = VOL_KEYS.filter((v) => v !== state.volatility);
    const total = candidates.reduce((sum, key) => sum + VOL_PICK_WEIGHT[key], 0);
    let roll = Math.random() * total;
    for (const key of candidates) {
      roll -= VOL_PICK_WEIGHT[key];
      if (roll <= 0) {
        state.volatility = key;
        break;
      }
    }
  }
}

function tickPrice(elapsedMs) {
  maybeShiftVolatility();
  const pct = VOL_SETTINGS[state.volatility].pct;
  const deltaRate = (Math.random() * 2 - 1) * pct;
  state.price = Math.max(PRICE_FLOOR, Math.round(state.price * (1 + deltaRate)));

  state.priceHistory.push({
    time: Math.min(TIME_LIMIT_MS, elapsedMs),
    price: state.price
  });
}

function buy() {
  if (!state.running) {
    return;
  }
  const qty = getQty();
  const cost = qty * state.price;
  if (cost > state.cash) {
    setMessage("現金が不足しています");
    return;
  }

  state.cash -= cost;
  state.amount += qty;
  setMessage(`${qty} 個を購入しました`);
  updateUI(Math.max(0, TIME_LIMIT_MS - (performance.now() - state.startTime)));
}

function sell() {
  if (!state.running) {
    return;
  }
  const qty = getQty();
  if (qty > state.amount) {
    setMessage("保有数が不足しています");
    return;
  }

  state.cash += qty * state.price;
  state.amount -= qty;
  setMessage(`${qty} 個を売却しました`);
  updateUI(Math.max(0, TIME_LIMIT_MS - (performance.now() - state.startTime)));
}

function endGame() {
  state.running = false;
  finalCash.textContent = formatYen(state.cash);
  const rate = ((state.cash - START_CASH) / START_CASH) * 100;
  const sign = rate >= 0 ? "+" : "";
  profitRate.textContent = `${sign}${rate.toFixed(2)}%`;
  if (rate < 0) {
    bossComment.textContent = "君はクビだ！";
  } else if (rate < 3) {
    bossComment.textContent = "君は市場が開いている間寝ていたのか？";
  } else if (rate < 10) {
    bossComment.textContent = "インデックスより大きくなければ君の価値ないよ";
  } else {
    bossComment.textContent = "君には才能がある";
  }
  showScreen(resultScreen);
}

function gameLoop(now) {
  if (!state.running) {
    return;
  }

  const elapsed = now - state.startTime;
  const remaining = Math.max(0, TIME_LIMIT_MS - elapsed);

  if (now - state.lastTickTime >= 250) {
    tickPrice(elapsed);
    state.lastTickTime = now;
  }

  updateUI(remaining);
  drawChart();

  if (remaining <= 0) {
    endGame();
    return;
  }

  requestAnimationFrame(gameLoop);
}

function startGame() {
  resetGame();
  state.running = true;
  state.startTime = performance.now();
  state.lastTickTime = state.startTime;
  showScreen(gameScreen);
  requestAnimationFrame(gameLoop);
}

startButton.addEventListener("click", startGame);
retryButton.addEventListener("click", startGame);
titleButton.addEventListener("click", () => {
  resetGame();
  showScreen(titleScreen);
});

qtyInput.addEventListener("change", () => {
  qtyInput.value = String(getQty());
});

buyButton.addEventListener("click", buy);
sellButton.addEventListener("click", sell);

resetGame();
showScreen(titleScreen);
