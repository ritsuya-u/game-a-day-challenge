const SCREENS = {
  title: document.getElementById("screen-title"),
  setup: document.getElementById("screen-setup"),
  play: document.getElementById("screen-play"),
  result: document.getElementById("screen-result")
};

const ASSETS = {
  npc: {
    male: "./images/male.png",
    female: "./images/female.png"
  },
  doors: {
    male: {
      empty: "./images/toilet_male_empty.png",
      occupied: "./images/toilet_male_occupied.png"
    },
    female: {
      empty: "./images/toilet_female_empty.png",
      occupied: "./images/toilet_female_occupied.png"
    }
  }
};

const ui = {
  startButton: document.getElementById("start-button"),
  beginEventButton: document.getElementById("begin-event"),
  backTitleButton: document.getElementById("back-title"),
  setupMessage: document.getElementById("setup-message"),
  infoVisitors: document.getElementById("info-visitors"),
  infoMaleRatio: document.getElementById("info-male-ratio"),
  infoFemaleRatio: document.getElementById("info-female-ratio"),
  infoDuration: document.getElementById("info-duration"),
  maleCount: document.getElementById("male-count"),
  femaleCount: document.getElementById("female-count"),
  hudTime: document.getElementById("hud-time"),
  hudVisitors: document.getElementById("hud-visitors"),
  hudMaleRatio: document.getElementById("hud-male-ratio"),
  hudFemaleRatio: document.getElementById("hud-female-ratio"),
  hudFail: document.getElementById("hud-fail"),
  hudWait: document.getElementById("hud-wait"),
  queueMale: document.getElementById("queue-male"),
  queueFemale: document.getElementById("queue-female"),
  queueMaleCount: document.getElementById("queue-male-count"),
  queueFemaleCount: document.getElementById("queue-female-count"),
  doorsMale: document.getElementById("doors-male"),
  doorsFemale: document.getElementById("doors-female"),
  resultTitle: document.getElementById("result-title"),
  resultRate: document.getElementById("result-rate"),
  resultMaleRate: document.getElementById("result-male-rate"),
  resultFemaleRate: document.getElementById("result-female-rate"),
  resultFail: document.getElementById("result-fail"),
  resultWait: document.getElementById("result-wait"),
  resultComment: document.getElementById("result-comment"),
  resultScoreLine: document.getElementById("result-score-line"),
  resultSubLineUtil: document.getElementById("result-util-line"),
  resultSubLineRef: document.getElementById("result-ref-line"),
  resultCommentTitle: document.querySelector(".result-comment-title")
};

const state = {
  setup: {
    totalVisitors: 0,
    maleRatio: 0,
    femaleRatio: 0,
    durationSec: 0,
    maleToiletCount: 2,
    femaleToiletCount: 2
  },
  sim: null,
  timerId: null
};

const WALK_CHANCE_PER_SEC = 0.01;
const SWEAT_START_LEVEL = 50;
const WOBBLE_START_LEVEL = 75;

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function showScreen(name) {
  Object.entries(SCREENS).forEach(([key, node]) => {
    node.classList.toggle("active", key === name);
  });
}

function createRandomEvent() {
  const totalVisitors = Math.floor(rand(100, 400));
  const maleRatio = Math.floor(rand(10, 90));
  const femaleRatio = 100 - maleRatio;
  const durationSec = Math.floor(rand(45, 91));
  state.setup.totalVisitors = totalVisitors;
  state.setup.maleRatio = maleRatio;
  state.setup.femaleRatio = femaleRatio;
  state.setup.durationSec = durationSec;
  state.setup.maleToiletCount = 2;
  state.setup.femaleToiletCount = 2;
}

function renderSetupInfo() {
  ui.infoVisitors.textContent = state.setup.totalVisitors;
  ui.infoMaleRatio.textContent = state.setup.maleRatio;
  ui.infoFemaleRatio.textContent = state.setup.femaleRatio;
  ui.infoDuration.textContent = state.setup.durationSec;
  ui.maleCount.textContent = state.setup.maleToiletCount;
  ui.femaleCount.textContent = state.setup.femaleToiletCount;
  ui.setupMessage.textContent = "";
}

function adjustToiletCount(target, step) {
  const current = target === "male" ? state.setup.maleToiletCount : state.setup.femaleToiletCount;
  const other = target === "male" ? state.setup.femaleToiletCount : state.setup.maleToiletCount;
  const next = current + step;
  if (next < 1) {
    return;
  }
  if (next + other > 10) {
    ui.setupMessage.textContent = "合計10基までです";
    return;
  }
  ui.setupMessage.textContent = "";
  if (target === "male") {
    state.setup.maleToiletCount = next;
  } else {
    state.setup.femaleToiletCount = next;
  }
  renderSetupInfo();
}

function makeNpc(id, gender) {
  const isMale = gender === "male";
  return {
    id,
    gender,
    peeLevel: rand(4, 32),
    peeSpeed: isMale ? rand(0.8, 1.6) : rand(0.9, 1.7),
    standThreshold: rand(42, 80),
    toiletTime: isMale ? rand(1, 3) : rand(3, 9),
    state: "seated",
    walkRemain: 0,
    waitStart: null,
    waitTimeSum: 0,
    failedAt: null
  };
}

function createDoors(gender, count) {
  const doors = [];
  for (let i = 0; i < count; i += 1) {
    doors.push({
      id: `${gender}-${i + 1}`,
      gender,
      pos: { x: i, y: gender === "male" ? 0 : 1 },
      capacity: 1,
      state: "empty",
      occupantId: null,
      useTimer: 0,
      useDuration: 0,
      useSum: 0
    });
  }
  return doors;
}

function initSimulation() {
  const visitors = [];
  const maleCount = Math.round((state.setup.totalVisitors * state.setup.maleRatio) / 100);
  const femaleCount = state.setup.totalVisitors - maleCount;

  let id = 1;
  for (let i = 0; i < maleCount; i += 1) {
    visitors.push(makeNpc(id, "male"));
    id += 1;
  }
  for (let i = 0; i < femaleCount; i += 1) {
    visitors.push(makeNpc(id, "female"));
    id += 1;
  }

  state.sim = {
    npcs: visitors,
    queue: {
      male: [],
      female: []
    },
    doors: {
      male: createDoors("male", state.setup.maleToiletCount),
      female: createDoors("female", state.setup.femaleToiletCount)
    },
    remainTime: state.setup.durationSec,
    duration: state.setup.durationSec,
    failCount: 0,
    failed: false,
    failNpcId: null,
    waitSamples: []
  };
}

function getQueuePressure(gender) {
  const qlen = state.sim.queue[gender].length;
  if (qlen <= 2) {
    return 1;
  }
  if (qlen <= 5) {
    return 1.12;
  }
  if (qlen <= 10) {
    return 1.28;
  }
  return 1.48;
}

function pushWaitingQueue(npc) {
  const q = state.sim.queue[npc.gender];
  if (!q.includes(npc.id)) {
    q.push(npc.id);
    npc.waitStart = state.setup.durationSec - state.sim.remainTime;
  }
}

function assignQueuesToDoors() {
  ["male", "female"].forEach((gender) => {
    const queue = state.sim.queue[gender];
    const emptyDoors = state.sim.doors[gender].filter((door) => door.state === "empty");
    emptyDoors.sort((a, b) => a.pos.x - b.pos.x);
    emptyDoors.forEach((door) => {
      const npcId = queue.shift();
      if (!npcId) {
        return;
      }
      const npc = state.sim.npcs.find((item) => item.id === npcId);
      if (!npc || npc.state !== "waiting") {
        return;
      }
      door.state = "occupied";
      door.occupantId = npc.id;
      door.useTimer = 0;
      door.useDuration = npc.toiletTime;
      npc.state = "using";
      if (typeof npc.waitStart === "number") {
        const waited = Math.max(0, state.setup.durationSec - state.sim.remainTime - npc.waitStart);
        state.sim.waitSamples.push(waited);
        npc.waitTimeSum += waited;
      }
      npc.waitStart = null;
    });
  });
}

function updateDoors(dt) {
  ["male", "female"].forEach((gender) => {
    state.sim.doors[gender].forEach((door) => {
      if (door.state !== "occupied") {
        return;
      }
      door.useTimer += dt;
      door.useSum += dt;
      if (door.useTimer >= door.useDuration) {
        const npc = state.sim.npcs.find((item) => item.id === door.occupantId);
        if (npc) {
          npc.state = "done";
        }
        door.state = "empty";
        door.occupantId = null;
        door.useTimer = 0;
        door.useDuration = 0;
      }
    });
  });
}

function updateNpcs(dt) {
  const elapsed = state.setup.durationSec - state.sim.remainTime;
  for (let i = 0; i < state.sim.npcs.length; i += 1) {
    const npc = state.sim.npcs[i];
    if (npc.state === "done" || npc.state === "using" || npc.state === "fail") {
      continue;
    }

    if (npc.state === "seated") {
      // seated中はpeeLevelを増やさず、一定確率でwalkingへ遷移する。
      const walkChance = WALK_CHANCE_PER_SEC * dt;
      if (Math.random() < walkChance) {
        npc.state = "walking";
        npc.walkRemain = rand(1, 4);
      }
      continue;
    }

    const pressure = npc.state === "waiting" || npc.state === "walking" ? getQueuePressure(npc.gender) : 1;
    npc.peeLevel += npc.peeSpeed * pressure * dt;

    if (npc.peeLevel >= 100) {
      npc.state = "fail";
      npc.failedAt = elapsed;
      state.sim.failCount += 1;
      state.sim.failed = true;
      state.sim.failNpcId = npc.id;
      return;
    }

    if (npc.state === "walking") {
      npc.walkRemain -= dt;
      if (npc.walkRemain <= 0) {
        npc.state = "waiting";
        pushWaitingQueue(npc);
      }
      continue;
    }
  }
}

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const min = Math.floor(s / 60);
  const rem = s % 60;
  return `${min}:${String(rem).padStart(2, "0")}`;
}

function average(arr) {
  if (!arr.length) {
    return 0;
  }
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

function npcVisualClass(npc) {
  const cls = ["npc", npc.gender, `state-${npc.state}`];
  if (npc.peeLevel >= SWEAT_START_LEVEL && npc.state !== "done" && npc.state !== "fail") {
    cls.push("is-sweating");
  }
  if (npc.peeLevel >= WOBBLE_START_LEVEL && npc.state !== "done" && npc.state !== "fail") {
    cls.push("is-limit");
  }
  return cls.join(" ");
}

function makeNpcNode(npc) {
  const outer = document.createElement("div");
  outer.className = npcVisualClass(npc);
  outer.innerHTML = `
    <img class="sprite" src="${ASSETS.npc[npc.gender]}" alt="${npc.gender}">
    <span class="sweat-layer"></span>
  `;
  return outer;
}

function renderQueue(gender, mount) {
  const queue = state.sim.queue[gender];
  mount.innerHTML = "";
  const showMax = 10;
  for (let i = 0; i < Math.min(showMax, queue.length); i += 1) {
    const npc = state.sim.npcs.find((n) => n.id === queue[i]);
    if (!npc) {
      continue;
    }
    mount.appendChild(makeNpcNode(npc));
  }
  if (queue.length > showMax) {
    const more = document.createElement("span");
    more.className = "queue-more";
    more.textContent = `+${queue.length - showMax}`;
    mount.appendChild(more);
  }
}

function renderDoors(gender, mount) {
  mount.innerHTML = "";
  const doors = state.sim.doors[gender];
  doors.forEach((door) => {
    const doorNode = document.createElement("div");
    doorNode.className = "door-slot";
    const img = document.createElement("img");
    img.src = ASSETS.doors[gender][door.state === "empty" ? "empty" : "occupied"];
    img.alt = `${gender}-${door.id}-${door.state}`;
    doorNode.appendChild(img);

    if (door.state === "occupied" && door.occupantId !== null) {
      const npc = state.sim.npcs.find((n) => n.id === door.occupantId);
      if (npc) {
        const wrap = document.createElement("div");
        wrap.className = "door-occupant";
        wrap.appendChild(makeNpcNode(npc));
        doorNode.appendChild(wrap);
      }
    }
    mount.appendChild(doorNode);
  });
}

function renderHud() {
  ui.hudTime.textContent = formatTime(state.sim.remainTime);
  ui.hudVisitors.textContent = state.setup.totalVisitors;
  ui.hudMaleRatio.textContent = state.setup.maleRatio;
  ui.hudFemaleRatio.textContent = state.setup.femaleRatio;
  ui.hudFail.textContent = state.sim.failCount;
  ui.hudWait.textContent = average(state.sim.waitSamples).toFixed(1);
  ui.queueMaleCount.textContent = state.sim.queue.male.length;
  ui.queueFemaleCount.textContent = state.sim.queue.female.length;
  renderQueue("male", ui.queueMale);
  renderQueue("female", ui.queueFemale);
  renderDoors("male", ui.doorsMale);
  renderDoors("female", ui.doorsFemale);
}

function utilizationOf(gender) {
  const doors = state.sim.doors[gender];
  const totalUse = doors.reduce((sum, door) => sum + door.useSum, 0);
  const denom = doors.length * state.sim.duration;
  return denom > 0 ? totalUse / denom : 0;
}

function getManagerComment(scorePercent) {
  if (scorePercent <= 30) {
    return "トイレあまりすぎ！お金がもったいない！";
  }
  if (scorePercent <= 50) {
    return "もうちょっとトイレ減らせたんじゃない？";
  }
  if (scorePercent <= 70) {
    return "まあ、こんなものか";
  }
  if (scorePercent <= 90) {
    return "いい仕事だったよ、よくやった";
  }
  return "なんというトイレ感覚！すばらしい！";
}

function endSimulation() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }

  const maleU = utilizationOf("male");
  const femaleU = utilizationOf("female");
  const totalUse = state.sim.doors.male.concat(state.sim.doors.female).reduce((sum, d) => sum + d.useSum, 0);
  const totalDoorCount = state.sim.doors.male.length + state.sim.doors.female.length;
  const totalU = totalDoorCount > 0 ? totalUse / (totalDoorCount * state.sim.duration) : 0;

  const scorePercent = Math.round(totalU * 100);

  if (state.sim.failed) {
    SCREENS.result.classList.add("failed-layout");
    ui.resultTitle.textContent = "失敗：お漏らす者が出てしまった…";
    if (ui.resultScoreLine) ui.resultScoreLine.style.display = "none";
    if (ui.resultSubLineUtil) ui.resultSubLineUtil.style.display = "none";
    if (ui.resultSubLineRef) ui.resultSubLineRef.style.display = "none";
    if (ui.resultCommentTitle) ui.resultCommentTitle.style.display = "block";
    ui.resultComment.textContent = "こら！お客さんにお漏らしさせたらだめでしょ！";
  } else {
    SCREENS.result.classList.remove("failed-layout");
    ui.resultTitle.textContent = "成功：イベント完走";
    if (ui.resultScoreLine) ui.resultScoreLine.style.display = "block";
    if (ui.resultSubLineUtil) ui.resultSubLineUtil.style.display = "block";
    if (ui.resultSubLineRef) ui.resultSubLineRef.style.display = "block";
    if (ui.resultCommentTitle) ui.resultCommentTitle.style.display = "block";
    ui.resultRate.textContent = String(scorePercent);
    ui.resultMaleRate.textContent = (maleU * 100).toFixed(1);
    ui.resultFemaleRate.textContent = (femaleU * 100).toFixed(1);
    ui.resultFail.textContent = String(state.sim.failCount);
    ui.resultWait.textContent = average(state.sim.waitSamples).toFixed(1);
    ui.resultComment.textContent = getManagerComment(scorePercent);
  }
  showScreen("result");
}

function tick() {
  if (!state.sim || state.sim.failed) {
    endSimulation();
    return;
  }

  const dt = 1;
  updateNpcs(dt);
  if (state.sim.failed) {
    renderHud();
    endSimulation();
    return;
  }

  updateDoors(dt);
  assignQueuesToDoors();
  state.sim.remainTime -= dt;
  renderHud();

  if (state.sim.remainTime <= 0) {
    endSimulation();
  }
}

function startSimulation() {
  initSimulation();
  showScreen("play");
  renderHud();
  state.timerId = setInterval(tick, 1000);
}

function bindEvents() {
  ui.startButton.addEventListener("click", () => {
    createRandomEvent();
    renderSetupInfo();
    showScreen("setup");
  });

  document.querySelectorAll(".counter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.target;
      const step = Number(button.dataset.step);
      adjustToiletCount(target, step);
    });
  });

  ui.beginEventButton.addEventListener("click", () => {
    const total = state.setup.maleToiletCount + state.setup.femaleToiletCount;
    if (state.setup.maleToiletCount < 1 || state.setup.femaleToiletCount < 1 || total > 10) {
      ui.setupMessage.textContent = "男子・女子とも1以上、合計10以下で設定してください";
      return;
    }
    startSimulation();
  });

  ui.backTitleButton.addEventListener("click", () => {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    state.sim = null;
    showScreen("title");
  });
}

bindEvents();
showScreen("title");
