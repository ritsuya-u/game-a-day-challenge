const BOT_WORDS = window.BOT_WORDS_RAW.map(([surface, reading], i) => ({ id: i, surface, reading }));

const readingBySurface = new Map(BOT_WORDS.map((w) => [w.surface, w.reading]));
const usedReadings = new Set();
const usedBotIds = new Set();

let requiredHeadKey = "";
let requiredHeadLabel = "";
let turnCount = 0;
let gameOver = false;
let isThinking = false;
let moodTimerId = null;
let ambientMoodTimerId = null;

const FACE_MOODS = ["neutral", "thinking", "annoyed", "intense", "surprised", "happy", "defeated"];
const AMBIENT_MOODS = ["neutral", "annoyed", "intense", "surprised", "happy", "defeated"];

const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");
const resultEl = document.getElementById("result");
const turnInfoEl = document.getElementById("turnInfo");
const formEl = document.getElementById("form");
const inputEl = document.getElementById("input");
const submitEl = document.getElementById("submit");
const faceEl = document.getElementById("face");

const toHiragana = (text) => {
  return text
    .normalize("NFKC")
    .replace(/[\u30A1-\u30F6]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0x60));
};

const VOWEL_MAP = {
  "あ": "あ", "か": "あ", "さ": "あ", "た": "あ", "な": "あ", "は": "あ", "ま": "あ", "や": "あ", "ら": "あ", "わ": "あ", "が": "あ", "ざ": "あ", "だ": "あ", "ば": "あ", "ぱ": "あ",
  "い": "い", "き": "い", "し": "い", "ち": "い", "に": "い", "ひ": "い", "み": "い", "り": "い", "ぎ": "い", "じ": "い", "ぢ": "い", "び": "い", "ぴ": "い",
  "う": "う", "く": "う", "す": "う", "つ": "う", "ぬ": "う", "ふ": "う", "む": "う", "ゆ": "う", "る": "う", "ぐ": "う", "ず": "う", "づ": "う", "ぶ": "う", "ぷ": "う", "ゔ": "う",
  "え": "え", "け": "え", "せ": "え", "て": "え", "ね": "え", "へ": "え", "め": "え", "れ": "え", "げ": "え", "ぜ": "え", "で": "え", "べ": "え", "ぺ": "え",
  "お": "お", "こ": "お", "そ": "お", "と": "お", "の": "お", "ほ": "お", "も": "お", "よ": "お", "ろ": "お", "を": "お", "ご": "お", "ぞ": "お", "ど": "お", "ぼ": "お", "ぽ": "お",
  "ぁ": "あ", "ぃ": "い", "ぅ": "う", "ぇ": "え", "ぉ": "お"
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const containsEnglish = (text) => /[A-Za-zＡ-Ｚａ-ｚ]/.test(text);

const clearMoodTimer = () => {
  if (moodTimerId) {
    clearTimeout(moodTimerId);
    moodTimerId = null;
  }
};

const clearAmbientMoodTimer = () => {
  if (ambientMoodTimerId) {
    clearTimeout(ambientMoodTimerId);
    ambientMoodTimerId = null;
  }
};

const setFaceMood = (mood) => {
  FACE_MOODS.forEach((name) => faceEl.classList.remove(name));
  faceEl.classList.add(mood);
};

const scheduleAmbientMood = () => {
  clearAmbientMoodTimer();
  if (gameOver) return;

  const delay = 450 + Math.floor(Math.random() * 950);
  ambientMoodTimerId = setTimeout(() => {
    if (!gameOver && !isThinking) {
      clearMoodTimer();
      const mood = AMBIENT_MOODS[Math.floor(Math.random() * AMBIENT_MOODS.length)];
      setFaceMood(mood);
    }
    scheduleAmbientMood();
  }, delay);
};

const pulseFaceMood = (mood, ms = 700) => {
  if (gameOver || isThinking) return;
  clearMoodTimer();
  setFaceMood(mood);
  moodTimerId = setTimeout(() => {
    if (!gameOver && !isThinking) {
      setFaceMood("neutral");
    }
    moodTimerId = null;
  }, ms);
};

const setThinking = (thinking) => {
  isThinking = thinking;
  if (thinking) {
    clearMoodTimer();
    setFaceMood("thinking");
  } else if (!gameOver) {
    setFaceMood("neutral");
  }
  submitEl.disabled = gameOver || thinking;
  inputEl.disabled = gameOver || thinking;
};

const normalizeEdges = (reading) => {
  let value = reading;
  while (value.endsWith("ー")) {
    const prev = value[value.length - 2] || "";
    const vowel = VOWEL_MAP[prev] || prev || "";
    value = value.slice(0, -1) + vowel;
  }
  if (value.endsWith("っ")) {
    value = value.slice(0, -1) + "つ";
  }
  return value;
};

const normalizeReading = (raw) => {
  const text = raw.replace(/[\s　]+/g, "");
  const direct = readingBySurface.get(text);
  const base = direct || toHiragana(text);
  return normalizeEdges(base);
};

const removeVoicingMarks = (text) => {
  return text
    .normalize("NFD")
    .replace(/[\u3099\u309A]/g, "")
    .normalize("NFC")
    .replace(/[゛゜]/g, "");
};

const getHead = (reading) => reading[0] || "";
const getTail = (reading) => reading[reading.length - 1] || "";
const getHeadKey = (reading) => removeVoicingMarks(getHead(reading));
const getTailKey = (reading) => removeVoicingMarks(getTail(reading));
const getWordKey = (reading) => removeVoicingMarks(reading);

const addLog = (role, text) => {
  const row = document.createElement("div");
  row.className = `row ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  row.appendChild(bubble);
  logEl.appendChild(row);
  logEl.scrollTop = logEl.scrollHeight;
};

const setStatus = (text) => {
  statusEl.textContent = text;
};

const endGame = (winner, reason) => {
  gameOver = true;
  clearMoodTimer();
  clearAmbientMoodTimer();
  setThinking(false);
  setFaceMood(winner === "チャットボット" ? "happy" : "defeated");
  resultEl.textContent = `勝者: ${winner}`;
  addLog("system", `ゲーム終了: ${reason}`);
  setStatus(reason);
};

const chooseBotWord = (head) => {
  const candidates = BOT_WORDS.filter((w) => {
    if (usedBotIds.has(w.id)) return false;
    const reading = normalizeEdges(w.reading);
    return getHeadKey(reading) === head;
  });
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
};

const onPlayerWord = async (raw) => {
  if (gameOver || isThinking) return;

  const cleaned = raw.trim();
  if (!cleaned) {
    pulseFaceMood("annoyed");
    setStatus("単語を入力してください。");
    return;
  }
  if (containsEnglish(cleaned)) {
    pulseFaceMood("annoyed");
    setStatus("英語は入力できません。日本語で入力してください。");
    return;
  }

  const reading = normalizeReading(cleaned);
  const readingKey = getWordKey(reading);

  if (reading.length < 2) {
    pulseFaceMood("annoyed");
    setStatus("2文字以上で入力してください。");
    return;
  }

  if (requiredHeadKey && getHeadKey(reading) !== requiredHeadKey) {
    pulseFaceMood("surprised");
    setStatus(`先頭は「${requiredHeadLabel}」で始めてください。`);
    return;
  }

  if (usedReadings.has(readingKey)) {
    pulseFaceMood("annoyed");
    setStatus("既出単語は使えません。");
    return;
  }

  usedReadings.add(readingKey);
  turnCount += 1;
  turnInfoEl.textContent = `総ターン数: ${turnCount}`;
  addLog("player", `${cleaned}（${reading}）`);

  const playerTail = getTail(reading);
  const playerTailKey = getTailKey(reading);

  if (playerTail === "ん") {
    endGame("チャットボット", "プレイヤーが「ん」で終わる語を入力しました。プレイヤーの敗北です。");
    return;
  }

  try {
    clearAmbientMoodTimer();
    setThinking(true);
    setStatus("チャットボットが考えています...");
    await sleep(700 + Math.floor(Math.random() * 700));

    const botWord = chooseBotWord(playerTailKey);

    if (!botWord) {
      endGame("プレイヤー", `「${playerTail}」で始まる語彙がないため、チャットボットの敗北です。`);
      return;
    }

    const botReading = normalizeEdges(botWord.reading);
    usedBotIds.add(botWord.id);
    usedReadings.add(getWordKey(botReading));

    turnCount += 1;
    turnInfoEl.textContent = `総ターン数: ${turnCount}`;
    addLog("bot", `${botWord.surface}（${botReading}）`);

    const botTail = getTail(botReading);
    if (botTail === "ん") {
      endGame("プレイヤー", "チャットボットが「ん」で終わる語を返したため、チャットボットの敗北です。");
      return;
    }

    requiredHeadKey = getTailKey(botReading);
    requiredHeadLabel = botTail;
    setStatus(`次は「${requiredHeadLabel}」で始まる単語を入力してください。`);

    if (usedBotIds.size >= BOT_WORDS.length) {
      endGame("プレイヤー", "チャットボットが語彙を使い切ったため、チャットボットの敗北です。");
      return;
    }
  } finally {
    if (!gameOver) {
      setThinking(false);
      clearMoodTimer();
      setFaceMood("intense");
      await sleep(650);
      if (!gameOver) {
        setFaceMood("neutral");
      }
      scheduleAmbientMood();
      inputEl.focus();
    }
  }
};

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = inputEl.value;
  inputEl.value = "";
  await onPlayerWord(value);
});

setFaceMood("neutral");
scheduleAmbientMood();
addLog("system", "開始: 最初の単語を入力してください。");
