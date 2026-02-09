(() => {
  // -----------------------------
  // DOM
  // -----------------------------
  const $ = (id) => document.getElementById(id);

  const screenTitle  = $("screenTitle");
  const screenPlay   = $("screenPlay");
  const screenResult = $("screenResult");

  const btnStart = $("btnStart");
  const btnBack  = $("btnBack");

  const countdownEl = $("countdown");
  const jpPhraseEl  = $("jpPhrase");
  const romaLineEl  = $("romaLine");
  const timeBarEl   = $("timeBar");

  const playUIEl = document.getElementById("playUI");

  const resultCountEl   = $("resultCount");
  const resultCommentEl = $("resultComment");

  // -----------------------------
  // Helpers
  // -----------------------------
  const clamp = (v,a,b)=>Math.max(a, Math.min(b,v));
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--){
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const norm = (s) => (s || "")
    .toLowerCase()
    .replace(/\s+/g, "");

  // typedの表示用：先頭typedLenだけ灰色にするため
  function renderRoma(targetCanonical, typedLen){
    const t = targetCanonical;
    const a = t.slice(0, typedLen);
    const b = t.slice(typedLen);
    // aを薄いグレーに（「打った字はグレー」）
    romaLineEl.innerHTML =
      `<span style="color:#555">${escapeHtml(a)}</span><span style="color:#111">${escapeHtml(b)}</span>`;
  }

  function escapeHtml(str){
    return str.replace(/[&<>"']/g, m => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[m]));
  }

  function showOnly(target){
    [screenTitle, screenPlay, screenResult].forEach(s => s.classList.remove("show"));
    target.classList.add("show");
  }

  // -----------------------------
  // Phrases (JP + romaji candidates)
  // ※ 漢字があるので必ずromajiを持つ
  // -----------------------------
const PHRASES = [
  // =========================
  // Lv1（2〜5）
  // =========================
  { lv:1, jp:"なんでや", roma:["nandeya"] },
  { lv:1, jp:"ほんまか", roma:["honmaka","honnmaka"] },
  { lv:1, jp:"ちゃうで", roma:["tyaude","tyaude"] },
  { lv:1, jp:"ええで", roma:["eede"] },
  { lv:1, jp:"あかん", roma:["akan"] },
  { lv:1, jp:"いやや", roma:["iyaya"] },
  { lv:1, jp:"ほな", roma:["hona"] },
  { lv:1, jp:"そやな", roma:["soyana"] },
  { lv:1, jp:"ほんまに", roma:["honmani"] },
  { lv:1, jp:"おおきに", roma:["ookini"] },
  { lv:1, jp:"しらんけど", roma:["sirankedo","sirankedo"] },
  { lv:1, jp:"そらそやろ", roma:["sorasoyaro"] },
  { lv:1, jp:"すまんな", roma:["sumanna"] },
  { lv:1, jp:"どやった", roma:["doyatta"] },
  { lv:1, jp:"そやから", roma:["soyakara"] },
  { lv:1, jp:"もうええわ", roma:["mooeewa","mouee wa".replace(/\s/g,"")] },

  // =========================
  // Lv2（6〜10）
  // =========================
  { lv:2, jp:"なんでやねん", roma:["nandeyanen","nandeyanenn"] },
  { lv:2, jp:"ほんまかいな", roma:["honmakaina"] },
  { lv:2, jp:"ちゃうちゃう", roma:["tyautyau","tyautyau"] },
  { lv:2, jp:"ええかげんにせえよ", roma:["eekagennniseeyo","eekagenniseeyo"] },
  { lv:2, jp:"どないすんねん", roma:["donaisunnen","donaisunnnenn"] },
  { lv:2, jp:"それはあかん", roma:["sorehaakan"] },
  { lv:2, jp:"もうええやろ", roma:["mooeeyaro","moueyaro"] },
  { lv:2, jp:"なにしてんねん", roma:["nanisitennen","nanishitennnenn"] },
  { lv:2, jp:"ほな行こか", roma:["honaikoka"] },
  { lv:2, jp:"やってくれたの", roma:["yattekuretano"] },
  { lv:2, jp:"だいじょうぶや", roma:["daijoubuya","daijobuya"] },
  { lv:2, jp:"ちゃいまんねん", roma:["tyaimannen"] },
  { lv:2, jp:"何言うてまんのや", roma:["naniiutemannoya"] },
  { lv:2, jp:"そんな殺生な", roma:["sonnasessyouna","sonnaseshouna"] },
  { lv:2, jp:"おはようさん", roma:["ohayousan"] },
  { lv:2, jp:"どないでっしゃろ", roma:["donaidessharo"] },
  { lv:2, jp:"どちらはん", roma:["dotirahan"] },
  { lv:2, jp:"困りますがな", roma:["komarimasugana"] },
  { lv:2, jp:"なんやとはなんや", roma:["nanyatohananya"] },
  { lv:2, jp:"やる気あるん", roma:["yarukiarun"] },
  { lv:2, jp:"かんにんしてくれ", roma:["kanninisitekure"] },
  { lv:2, jp:"ぎょうさんおるがな", roma:["gyousanorgana","gyosanorgana"] },
  { lv:2, jp:"しばいたろか", roma:["sibaitaroka","sibaitaroka"] },
  { lv:2, jp:"いてまうぞ", roma:["itemauzo"] },
  { lv:2, jp:"大阪や", roma:["oosakaya","osakaya"] },

  // =========================
  // Lv3（11〜15）
  // =========================
  { lv:3, jp:"それはちゃうと思うでんな", roma:["sorehatyautoomoudenna"] },
  { lv:3, jp:"どないなっとんねんな", roma:["donainattonnenna"] },
  { lv:3, jp:"さっきも言うたやろが", roma:["sakkimoiutayaroga"] },
  { lv:3, jp:"ほんまにそれ言うんかな", roma:["honmanisoreiunkana"] },
  { lv:3, jp:"もうええ加減にしてや", roma:["moueekagennnisiteya"] },
  { lv:3, jp:"話ちゃんと聞いてるか", roma:["hanasityantokiiteruka"] },
  { lv:3, jp:"それ今言うことちゃう", roma:["soreimaiukototyau"] },
  { lv:3, jp:"なんでそうなるんやろ", roma:["nandesounarunyaro"] },
  { lv:3, jp:"そこは気にせんでええ", roma:["sokohakinisenndeee"] },
  { lv:3, jp:"ちょっと落ち着きやほんま", roma:["tyottootitukiyahonma"] },
  { lv:3, jp:"約束が違うやんか", roma:["yakusokugatigauyanka"] },
  { lv:3, jp:"そんな無茶言うたらあかんわ", roma:["sonnamutyaiutaraakanwa"] },
  { lv:3, jp:"どうぞまあ入っておくんなはれ", roma:["douzomaahaitteokunnahare"] },
  { lv:3, jp:"人の心とか無いんか", roma:["hitonokokorotokanainka"] },
  { lv:3, jp:"ガキの使いやあらへんで", roma:["gakinotukaiyaarahende"] },

  // =========================
  // Lv4（16〜20）
  // =========================
  { lv:4, jp:"それ前にも言うた話やろ", roma:["soremaenimoiutahanasiyaro"] },
  { lv:4, jp:"何回同じこと言わせんねん", roma:["nankaionajikotoiwasennen"] },
  { lv:4, jp:"いやだからちゃう言うてるやん", roma:["iyadakaratyauiuteruyan"] },
  { lv:4, jp:"そない簡単な話ちゃうで", roma:["sonaikantannahanashityaude"] },
  { lv:4, jp:"ちゃんと最初から説明せえ", roma:["tyantosaisyokarasetumeisee"] },
  { lv:4, jp:"その言い方はあかんと思う", roma:["sonoiikatahaakantoomou"] },
  { lv:4, jp:"今それ言われても困るわ", roma:["imasoreiwaretemokomaruwa"] },
  { lv:4, jp:"話の流れ読んでほしいねん", roma:["hanasinonagareyondehosiinen"] },
  { lv:4, jp:"なんで毎回そうなんねん", roma:["nandemaikaisounannen"] },
  { lv:4, jp:"なに眠たいこと言うてんねん", roma:["naninemutaikotoiutennen"] },

  // =========================
  // Lv5（21〜）
  // =========================
  { lv:5, jp:"なんぼなんでもそれはあかん思うで正直", roma:["nanbonandemosorehaakantoomoudesyoujiki"] },
  { lv:5, jp:"それさっきから何回も説明してるやろ", roma:["soresakkikaranankaimosetumeisiteruyaro"] },
  { lv:5, jp:"いや今の流れでそれ言うのはちゃうやん", roma:["iyaimanonagaredesoreiunohatyauyan"] },
  { lv:5, jp:"ちゃんと考えた上で言うてるんそれ", roma:["tyantokangaetauedeiuterunsore"] },
  { lv:5, jp:"もうええ言うてるのにまだ続けるんか", roma:["mooeeiuterunonimadatuzukerunka"] },
  { lv:5, jp:"それ冗談で言うてるんやったら寒いで", roma:["sorejoudandeiuterunyattarasamuide"] },
  { lv:5, jp:"話聞いてへんのが一番腹立つねん", roma:["hanasikiitehennogaichibanharatatunnen"] },
  { lv:5, jp:"金融とは良心を売って金を儲ける商売なんや", roma:["kinyuutoharyousinwouttekanewomoukerusyoubainanya".replace(/\s/g,"")] },
];


  // -----------------------------
  // Game State
  // -----------------------------
  const STATE = {
    playing:false,
    starting:false,
    cleared:0,
    lv:1,
    timeLimit:3.0,
    timeLeft:3.0,
    phrase:null,
    typed:"",
    candidates:[],
    miss:0,
    raf:0,
    lastT:0,
  };

  const FIXED_TIME_LIMIT = 7.0; // 秒（好みで調整）


  // Lv進行：クリア数で段階UP（好みで調整してOK）
  function calcLvByCleared(c){
    if (c >= 24) return 5;
    if (c >= 18)  return 4;
    if (c >= 12)  return 3;
    if (c >= 6)  return 2;
    return 1;
  }

  // 文字数ベースで時間決定（“はよ打てや”圧）
  //function calcTimeLimitByPhrase(jp){
    //const n = jp.length;
    // 長いほど少し増やすが、増えすぎない（テンポゲー）
    //return clamp(1.8 + n * 0.08, 2.0, 5.0);
  //}

  function pickPhrase(lv){
    const pool = PHRASES.filter(p => p.lv === lv);
    return pool[(Math.random() * pool.length) | 0];
  }

  function setPhrase(p){
    STATE.phrase = p;
    STATE.typed = "";
    // candidates: 正規化して持つ
    STATE.candidates = p.roma.map(norm);
    // 表示は最初の候補を採用
    jpPhraseEl.textContent = p.jp;
    renderRoma(STATE.candidates[0], 0);

    STATE.timeLimit = FIXED_TIME_LIMIT;
    STATE.timeLeft = FIXED_TIME_LIMIT;
    updateBar();
  }

  function updateBar(){
    const r = clamp(STATE.timeLeft / STATE.timeLimit, 0, 1);
    // timeBarは横幅で表現（黒バー）
    timeBarEl.style.transform = `scaleX(${r})`;
  }

  function endGame(){
    STATE.playing = false;
    cancelAnimationFrame(STATE.raf);

    const c = STATE.cleared;
    resultCountEl.textContent = String(c);

    // コメント（適当でOK、後で増やせる）
    let comment = "やるやん！";
    if (c <= 5) comment = "やる気あるん？";
    else if (c <= 15) comment = "まあまあやな";
    else if (c <= 30) comment = "ええやん！";
    else comment = "完全に関西人やん！";

    resultCommentEl.textContent = comment;
    showOnly(screenResult);
  }

  function loop(t){
    if (!STATE.playing) return;
    if (!STATE.lastT) STATE.lastT = t;
    const dt = (t - STATE.lastT) / 1000;
    STATE.lastT = t;

    STATE.timeLeft -= dt;
    updateBar();

    if (STATE.timeLeft <= 0){
      endGame();
      return;
    }

    STATE.raf = requestAnimationFrame(loop);
  }

  // -----------------------------
  // Input
  // -----------------------------
  function onKeyDown(e){
    if (!STATE.playing) return;

    if (e.key === "Escape"){
      STATE.playing = false;
      cancelAnimationFrame(STATE.raf);
      showOnly(screenTitle);
      return;
    }

    // 英数字のみ（ローマ字入力）
    const k = e.key;
    if (k.length !== 1) return;
    if (!/[a-zA-Z]/.test(k)) return;

    const ch = k.toLowerCase();
    const next = STATE.typed + ch;

    // 候補を絞る
    const filtered = STATE.candidates.filter(s => s.startsWith(next));
    if (filtered.length === 0){
      // ミス：typedは更新しない
      // （必要ならSE/揺れ演出ここ）
      return;
    }

    STATE.typed = next;
    STATE.candidates = filtered;

    // 表示更新（canonicalは candidates[0]）
    renderRoma(STATE.candidates[0], STATE.typed.length);

    // 完了判定：候補のどれかに完全一致
    const done = STATE.candidates.some(s => s === STATE.typed);
    if (done){
      STATE.cleared += 1;
      STATE.lv = calcLvByCleared(STATE.cleared);
      setPhrase(pickPhrase(STATE.lv));
    }
  }

  // -----------------------------
  // Countdown -> Start
  // -----------------------------
async function countdownAndStart(){

  if (STATE.starting || STATE.playing) return;

  STATE.starting = true;


  showOnly(screenPlay);

  // ★カウントダウン中はプレイUIを非表示
  playUIEl.classList.add("hide");

  countdownEl.classList.remove("hide");
  const seq = ["3","2","1"];
  for (const s of seq){
    countdownEl.textContent = s;
    await wait(650);
  }
  countdownEl.textContent = "START";
  await wait(450);
  countdownEl.classList.add("hide");

  // ★ここでプレイUIを表示
  playUIEl.classList.remove("hide");

  // init
  STATE.playing = true;
  STATE.starting = false;
  STATE.cleared = 0;
  STATE.lv = 1;
  STATE.lastT = 0;

  setPhrase(pickPhrase(1));
  STATE.raf = requestAnimationFrame(loop);
}


  function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

  // -----------------------------
  // Events
  // -----------------------------
  btnStart.addEventListener("click", () => {
    countdownAndStart();
  });

  btnBack.addEventListener("click", () => {
    showOnly(screenTitle);
  });

window.addEventListener("keydown", (e) => {

  // -------------------------
  // タイトル画面：Spaceでスタート
  // -------------------------
  if (
    e.code === "Space" &&
    screenTitle.classList.contains("show")
  ){
    e.preventDefault(); // スクロール防止
    countdownAndStart();
    return;
  }

  // -------------------------
  // プレイ中の入力処理
  // -------------------------
  onKeyDown(e);
});


  // 既存のプレイ中キー処理はこの下


  // 初期
  showOnly(screenTitle);
})();
