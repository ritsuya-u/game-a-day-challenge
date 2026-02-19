const titleScreen = document.getElementById("titleScreen");
const playScreen = document.getElementById("playScreen");
const resultScreen = document.getElementById("resultScreen");

const startButton = document.getElementById("startButton");
const shutterButton = document.getElementById("shutterButton");
const toResultButton = document.getElementById("toResultButton");
const backTitleButton = document.getElementById("backTitleButton");

const likesValue = document.getElementById("likesValue");

const cameraFrame = document.getElementById("cameraFrame");
const playPengin = document.getElementById("playPengin");
const resultShot = document.getElementById("resultShot");
const resultPengin = document.getElementById("resultPengin");

const state = {
  screen: "title",
  waiting: true,
  canShoot: true,
  penginVisible: false,
  appearAt: 0,
  moveStartAt: 0,
  moveDuration: 0,
  rafId: 0,
  penginX: 0,
  captureX: 0,
  captureVisible: false,
  likes: 0
};

const WAIT_MIN_MS = 9000;
const WAIT_MAX_MS = 11000;
const SWIM_MIN_MS = 600;
const SWIM_MAX_MS = 1200;

function showScreen(name) {
  titleScreen.classList.remove("active");
  playScreen.classList.remove("active");
  resultScreen.classList.remove("active");

  if (name === "title") titleScreen.classList.add("active");
  if (name === "play") playScreen.classList.add("active");
  if (name === "result") resultScreen.classList.add("active");

  state.screen = name;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getFrameMetrics() {
  const frameWidth = cameraFrame.clientWidth;
  const penginWidth = playPengin.getBoundingClientRect().width;
  return { frameWidth, penginWidth };
}

function setPenginX(px, target) {
  target.style.left = `${px}px`;
}

function resetPlay() {
  cancelAnimationFrame(state.rafId);

  const now = performance.now();
  state.waiting = true;
  state.canShoot = true;
  state.penginVisible = false;
  state.appearAt = now + randomRange(WAIT_MIN_MS, WAIT_MAX_MS);
  state.moveStartAt = 0;
  state.moveDuration = randomRange(SWIM_MIN_MS, SWIM_MAX_MS);
  state.captureX = 0;
  state.captureVisible = false;
  state.likes = 0;

  const { frameWidth } = getFrameMetrics();
  state.penginX = frameWidth + 24;
  setPenginX(state.penginX, playPengin);
  playPengin.classList.add("hidden");

  shutterButton.disabled = false;
  shutterButton.classList.remove("hidden");
  toResultButton.classList.add("hidden");
}

function startSwim(now) {
  const { frameWidth } = getFrameMetrics();

  state.waiting = false;
  state.penginVisible = true;
  state.moveStartAt = now;
  state.penginX = frameWidth + 24;
  setPenginX(state.penginX, playPengin);
  playPengin.classList.remove("hidden");
}

function updatePengin(now) {
  if (state.waiting) {
    if (now >= state.appearAt) {
      startSwim(now);
    }
    return;
  }

  if (!state.penginVisible) {
    return;
  }

  const { frameWidth, penginWidth } = getFrameMetrics();
  const elapsed = now - state.moveStartAt;
  const t = clamp(elapsed / state.moveDuration, 0, 1);

  const startX = frameWidth + 24;
  const endX = -penginWidth - 24;
  state.penginX = startX + (endX - startX) * t;
  setPenginX(state.penginX, playPengin);

  if (t >= 1) {
    state.penginVisible = false;
    playPengin.classList.add("hidden");
  }
}

function calcLikes(captureCenterX, frameWidth) {
  const frameCenter = frameWidth / 2;
  const maxDistance = frameWidth / 2;
  const error = Math.abs(captureCenterX - frameCenter);
  const normalized = clamp(error / maxDistance, 0, 1);
  const steepness = 5;
  return Math.round(10000 * Math.exp(-steepness * normalized));
}

function shoot() {
  if (!state.canShoot || state.screen !== "play") {
    return;
  }

  state.canShoot = false;
  shutterButton.disabled = true;

  const { frameWidth, penginWidth } = getFrameMetrics();
  const captureCenterX = state.penginX + penginWidth / 2;
  state.captureX = state.penginX;
  state.captureVisible = state.penginVisible;

  if (!state.captureVisible) {
    state.likes = 0;
  } else {
    state.likes = calcLikes(captureCenterX, frameWidth);
  }

  toResultButton.classList.remove("hidden");
}

function updateLoop(now) {
  updatePengin(now);
  if (state.screen === "play") {
    state.rafId = requestAnimationFrame(updateLoop);
  }
}

function openResult() {
  likesValue.textContent = String(state.likes);

  if (state.captureVisible) {
    resultPengin.classList.remove("hidden");
    setPenginX(state.captureX, resultPengin);
  } else {
    resultPengin.classList.add("hidden");
  }

  showScreen("result");
}

function startGame() {
  showScreen("play");
  resetPlay();
  state.rafId = requestAnimationFrame(updateLoop);
}

startButton.addEventListener("click", startGame);
shutterButton.addEventListener("click", shoot);
toResultButton.addEventListener("click", openResult);
backTitleButton.addEventListener("click", () => {
  cancelAnimationFrame(state.rafId);
  showScreen("title");
});

window.addEventListener("resize", () => {
  if (state.screen !== "play" || !state.penginVisible) {
    return;
  }
  setPenginX(state.penginX, playPengin);
});

resultShot.addEventListener("click", () => {
  // Result image is static; click intentionally ignored.
});

showScreen("title");
