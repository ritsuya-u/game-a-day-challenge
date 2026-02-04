const app = document.getElementById("app");

/* =====================
  設定
===================== */
const QUESTIONS = [
  "好きな方を選んでください",
  "かわいい方を選んでください",
  "かっこいい方を選んでください",
  "飼いたい方を選んでください",
  "見ていて飽きない方を選んでください",
  "一緒に暮らす姿が想像できる方を選んでください",
  "触りたい方を選んでください",
  "家に帰ったときにいて欲しい方を選んでください",
  "なんだか惹かれる方を選んでください",
  "相棒にしたい方を選んでください",
  "心が反応する方を選んでください"
];

const LEVELS = [
  {min:-1.0, text:"配偶者に私と犬どっちが大事なのと聞かれ、犬と即答する", type:"犬派"},
  {min:-0.9, text:"犬の写真がスマホの容量を圧迫している", type:"犬派"},
  {min:-0.75,text:"魅力的な犬がいたら図々しくも触らせてもらう", type:"犬派"},
  {min:-0.5, text:"普通の", type:"犬派"},
  {min:-0.25,text:"世話をしないくせに懐かれたいと思っている", type:"犬派"},
  {min:-0.1, text:"正直どっちでもいいと思ってる", type:"犬派"},
  {min:0.0,  text:"正直どっちでもいいと思ってる", type:"猫派"},
  {min:0.1,  text:"世話をしないくせにもふもふしたいと思っている", type:"猫派"},
  {min:0.25, text:"普通の", type:"猫派"},
  {min:0.5,  text:"ショート動画で一日中猫の動画をみている", type:"猫派"},
  {min:0.75, text:"作業中、猫にPCの上を占領されるもどかす厳しさを持てない甘ったれの", type:"猫派"},
  {min:0.9,  text:"猫の前では人に見せられない言動をしている", type:"猫派"},
];

/* =====================
  状態
===================== */
let qIndex = 0;
let catCount = 0;
let dogCount = 0;
let startTime = 0;
let totalTime = 0;
let images = [];

/* =====================
  画面描画
===================== */
function showTitle(){
  app.innerHTML = `
    <h1>本質診断</h1>
    <p>あなたの”本質”を診断いたします。</p>
    <button id="start">診断する</button>
  `;
  document.getElementById("start").onclick = showConfirm;
}

function showConfirm(){
  preloadImages();
  typeText(
`これから行う診断は、 
あなた自身が気づいていない
判断傾向を明らかにします。

軽い気持ちで始めることはおすすめしません。

それでも、診断を開始しますか？`,
  () => {
    app.innerHTML += `
      <div class="btnRow">
        <button id="no">いいえ</button>
        <button id="yes">はい</button>
      </div>
    `;
    document.getElementById("no").onclick = showTitle;
    document.getElementById("yes").onclick = () => {
      typeText("承知いたしました。 \n\nそれでは、次の設問に正直にお答えください。",()=>{
        setTimeout(showQuestion,1000);
      });
    };
  });
}

function showQuestion(){
  startTime = Date.now();
  const q = QUESTIONS[qIndex];
  const pair = images[qIndex];

  app.innerHTML = `
    <p>${q}</p>
    <div class="choice">
      <img src="${pair.left.src}" data-type="${pair.left.type}">
      <img src="${pair.right.src}" data-type="${pair.right.type}">
    </div>
  `;

  document.querySelectorAll(".choice img").forEach(img=>{
    img.onclick = ()=>{
      const elapsed = (Date.now()-startTime)/1000;
      totalTime += elapsed;
      img.dataset.type === "cat" ? catCount++ : dogCount++;
      qIndex++;
      qIndex < QUESTIONS.length ? showQuestion() : showResult();
    };
  });
}

function showResult(){
  const avg = totalTime / QUESTIONS.length;
  const diff = catCount - dogCount;
  const strength = diff / QUESTIONS.length;
  const tNorm = Math.min(avg / 10, 1);
  const index = strength * (1 - 0.4 * tNorm);

  const level = LEVELS.slice().reverse().find(l=>index>=l.min);

 typeText("あなたの”本質”がわかりました。", () => {
  setTimeout(() => {

    // ① あなたは…
    typeText("あなたは…", () => {
      setTimeout(() => {

        // ② 形容
         typeText(`\n${level.text}\n${level.type}です。`, () => {
  app.innerHTML += `
    <p class="notice">
      ※この診断結果は、統計・心理学・その他あらゆる学問的根拠に基づいていません。
    </p>
    <button onclick="location.reload()">タイトルに戻る</button>
  `;
});


      }, 1200);      // ← 「あなたは…」の溜め
    });

  }, 800);
});

}

/* =====================
  補助
===================== */
function typeText(text,cb){
  app.innerHTML = "<p></p>";
  const p = app.querySelector("p");
  let i=0;
  const timer = setInterval(()=>{
    p.textContent += text[i++];
    if(i>=text.length){
      clearInterval(timer);
      cb && cb();
    }
  },70);
}

function preloadImages(){
  const cats = shuffle([...Array(30)].map((_,i)=>`./images/cat_${String(i+1).padStart(2,"0")}.webp`)).slice(0,11);
  const dogs = shuffle([...Array(30)].map((_,i)=>`./images/dog_${String(i+1).padStart(2,"0")}.webp`)).slice(0,11);

  images = cats.map((c,i)=>{
    const pair = shuffle([
      {src:c,type:"cat"},
      {src:dogs[i],type:"dog"}
    ]);
    pair.forEach(p=>{const img=new Image();img.src=p.src;});
    return {left:pair[0], right:pair[1]};
  });
}

function shuffle(arr){
  return arr.sort(()=>Math.random()-0.5);
}

/* ===================== */
showTitle();
