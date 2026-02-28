const FINAL_LEVEL = 5;
const GROWTH_STEPS = [25, 50, 75, 100];
const text1 = "単細胞が届いたよ！\nかわいがって成長させよう！";
const text2 = "あれ、ての様子が…！";
const text3 = "てが成長したよ！\nさらにかわいがってもっと成長させよう！";
const text4 = "てが一人前になったよ！\nては家を出てたくましく生きるようです。";
const text5 = "『たくさん遊んでくれてありがとう！\n僕はもっと成長してきっと戻ってくるよ！』";

const titleScreen = document.getElementById("titleScreen");
const playScreen = document.getElementById("playScreen");
const startButton = document.getElementById("startButton");
const arena = document.getElementById("arena");
const creature = document.getElementById("creature");
const messageText = document.getElementById("messageText");
const endingOverlay = document.getElementById("endingOverlay");
const endingText = document.getElementById("endingText");

let clicks = 0;
let level = 1;
let phase = "title";
let isFinalSequence = false;
let isEvolving = false;
let position = { x: 50, y: 58 };
let moveState = {
  active: false,
  dx: 0,
  dy: 0,
  remaining: 0,
  wait: 120
};

const MOVE_BOUNDS = {
  minX: 30,
  maxX: 70,
  minY: 26,
  maxY: 68
};

function imageForLevel(nextLevel) {
  return `./images/level_${nextLevel}.png`;
}

function requiredClicksForLevel(currentLevel) {
  let total = 0;

  for (let index = 0; index < currentLevel - 1; index += 1) {
    total += GROWTH_STEPS[index] || 0;
  }

  return total;
}

function setScreen(nextPhase) {
  phase = nextPhase;
  titleScreen.classList.toggle("active", nextPhase === "title");
  playScreen.classList.toggle("active", nextPhase === "play");
  document.body.classList.toggle("playing", nextPhase === "play");
}

function setMessage(text) {
  messageText.textContent = text;
}

function updateHud() {
  return;
}

function setCreatureLevel(nextLevel) {
  creature.src = imageForLevel(nextLevel);
  creature.alt = `レベル${nextLevel}のて`;
}

function pulseCreature(className, duration) {
  creature.classList.add(className);
  window.setTimeout(() => {
    creature.classList.remove(className);
  }, duration);
}

function runEnding() {
  if (isFinalSequence) {
    return;
  }

  isFinalSequence = true;
  isEvolving = false;
  setMessage(text4);
  updateHud();

  window.setTimeout(() => {
    setMessage(text5);
    arena.classList.add("finished");
  }, 5000);
}

function evolve() {
  if (level >= FINAL_LEVEL || isEvolving) {
    return;
  }

  isEvolving = true;
  setMessage(text2);
  pulseCreature("evolving", 2000);

  window.setTimeout(() => {
    level += 1;
    setCreatureLevel(level);
    updateHud();

    if (level >= FINAL_LEVEL) {
      runEnding();
    } else {
      setMessage(text3);
      isEvolving = false;
    }
  }, 2000);
}

function handleCreatureClick() {
  if (phase !== "play" || isFinalSequence || isEvolving) {
    return;
  }

  clicks += 1;
  updateHud();
  pulseCreature("pulse", 180);

  if (level < FINAL_LEVEL && clicks >= requiredClicksForLevel(level + 1)) {
    evolve();
  }
}

function clampPosition() {
  position.x = Math.max(MOVE_BOUNDS.minX, Math.min(MOVE_BOUNDS.maxX, position.x));
  position.y = Math.max(MOVE_BOUNDS.minY, Math.min(MOVE_BOUNDS.maxY, position.y));
}

function beginShortMove() {
  const angle = Math.random() * Math.PI * 2;
  const distance = 4 + Math.random() * 4;
  const frames = 300;

  moveState.active = true;
  moveState.dx = Math.cos(angle) * (distance / frames);
  moveState.dy = Math.sin(angle) * (distance / frames);
  moveState.remaining = frames;
}

function tick() {
  if (phase === "play" && !isFinalSequence) {
    if (moveState.active) {
      position.x += moveState.dx;
      position.y += moveState.dy;
      moveState.remaining -= 1;

      if (position.x <= MOVE_BOUNDS.minX || position.x >= MOVE_BOUNDS.maxX) {
        moveState.dx *= -1;
      }

      if (position.y <= MOVE_BOUNDS.minY || position.y >= MOVE_BOUNDS.maxY) {
        moveState.dy *= -1;
      }

      if (moveState.remaining <= 0) {
        moveState.active = false;
        moveState.wait = 120 + Math.floor(Math.random() * 110);
      }
    } else {
      moveState.wait -= 1;
      if (moveState.wait <= 0) {
        beginShortMove();
      }
    }

    clampPosition();
    creature.style.left = `${position.x}%`;
    creature.style.top = `${position.y}%`;
  }

  window.requestAnimationFrame(tick);
}

function resetGame() {
  clicks = 0;
  level = 1;
  isFinalSequence = false;
  isEvolving = false;
  position = { x: 50, y: 58 };
  moveState = {
    active: false,
    dx: 0,
    dy: 0,
    remaining: 0,
    wait: 120
  };

  arena.classList.remove("finished");
  endingOverlay.classList.remove("show");
  endingOverlay.setAttribute("aria-hidden", "true");
  endingText.textContent = "";

  setCreatureLevel(level);
  creature.style.left = `${position.x}%`;
  creature.style.top = `${position.y}%`;
  setMessage(text1);
  updateHud();
}

startButton.addEventListener("click", () => {
  resetGame();
  setScreen("play");
});

creature.addEventListener("click", handleCreatureClick);

resetGame();
tick();
