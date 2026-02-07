(() => {
  // ======================
  // Data
  // ======================
  const DESCS = [
    { id:"0", title:"【 0 】", content:"人類史上最も偉大な発明のひとつ。物理学、天文学、コンピューター科学、さらには哲学にいたるまで、現代のすべての礎になっている。" },
    { id:"1", title:"【 1 】", content:"存在を示す原初的な記号。最も小さな自然数であり、ちょうど1個の正整数で割り切れる唯一の数。確率が取りうる最大値。" },
    { id:"2", title:"【 2 】", content:"最初の素数であり、素数の中では唯一の偶数。コンピューター世界の底。対の関係を生み、閉鎖的だが魅惑的な構造を持つ数。" },
    { id:"3", title:"【 3 】", content:"我々が認識できるこの世界の次元数。循環構造を生み出せる最小の数。人々は納得や決着の基準として、この数を選びがち。" },
    { id:"4", title:"【 4 】", content:"2の平方数。四方、四季、四肢などに現れる数。すべてそろうと完成された印象をもつ。日本では死を連想させる。" },
    { id:"5", title:"【 5 】", content:"片手の指の数、または正の画数。平日の数。きりがよいとされることが多い。中心が存在し、スター性が強い数。" },
    { id:"6", title:"【 6 】", content:"最小の完全数。安定を生む正六角形の構造は、蜂の巣や雪の結晶にみられる。立方体の面の数。" },
    { id:"7", title:"【 7 】", content:"幸運を象徴する数。曜日の数。1オクターブに含まれる音の数。また日本においては、虹の色。震度の最大値。" },
    { id:"8", title:"【 8 】", content:"2の立方数。デジタル表記で最も多くの線を使う数。八重桜や八百万に見られるように、漠然と数が多いことを表す。" },
    { id:"9", title:"【 9 】", content:"3の平方数。また、奇数の最小の合成数。日本では4と並んで忌み嫌われる。日本国憲法9条では戦争の放棄を謳っている。" },
    { id:"A", title:"【 A 】", content:"いつからガチャの中身が10進数だと思っていた？" },
  ];
  const ID_0_9 = ["0","1","2","3","4","5","6","7","8","9"];
  const ID_0_A = ["0","1","2","3","4","5","6","7","8","9","A"];

  const LS_KEY = "gatyakon_collection_v1";
  const LS_LAST = "gatyakon_last_v1";

  // ======================
  // DOM
  // ======================
  const $ = (q)=>document.querySelector(q);

  const screenLoading = $("#screenLoading");
  const screenTitle = $("#screenTitle");
  const screenGatyakon = $("#screenGatyakon");
  const screenCollection = $("#screenCollection");
  const screenDetail = $("#screenDetail");

  const imgTitle = $("#imgTitle");
  const imgMachine = $("#imgMachine");
  const imgHandle = $("#imgHandle");
  const imgCapsule = $("#imgCapsule");
  const imgOutlet = $("#imgOutlet");

  const handleHit = $("#handleHit");

  const btnToGatyakon = $("#btnToGatyakon");
  const btnToCollection = $("#btnToCollection");
  const btnBackFromGatyakon = $("#btnBackFromGatyakon");
  const btnBackFromCollection = $("#btnBackFromCollection");
  const btnCloseDetail = $("#btnCloseDetail");

  const collectionGrid = $("#collectionGrid");

  const reveal = $("#reveal");
  const revealChar = $("#revealChar");
  const revealLabel = $("#revealLabel");
  const btnRevealClose = $("#btnRevealClose");

  const detailChar = $("#detailChar");
  const detailTitle = $("#detailTitle");
  const detailContent = $("#detailContent");

  // ======================
  // Screen control
  // ======================
  function showScreen(which){
    [screenLoading, screenTitle, screenGatyakon, screenCollection, screenDetail].forEach(s=>s.classList.remove("show"));
    which.classList.add("show");
  }

  // ======================
  // Assets preload
  // ======================
  const ASSETS = {
    title: "./images/num_title.webp",
    machine: "./images/num_gatyakon.webp",
    handle: "./images/hundle.webp",
    outlet: "./images/outlet.webp",
    capsule: "./images/kapsel.webp",
  };

  function preloadAll(){
    const entries = Object.entries(ASSETS);
    return Promise.all(entries.map(([,src])=>{
      return new Promise((resolve,reject)=>{
        const im = new Image();
        im.onload = resolve;
        im.onerror = reject;
        im.src = src;
      });
    }));
  }

  // ======================
  // Collection storage
  // ======================
  function loadCollection(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    }catch(e){
      return new Set();
    }
  }
  function saveCollection(set){
    localStorage.setItem(LS_KEY, JSON.stringify([...set]));
  }

  function isComplete09(set){
    return ID_0_9.every(id => set.has(id));
  }

  // ======================
  // Gacha draw rule
  // ======================
  function drawId(){
    const set = loadCollection();
    const pool = isComplete09(set) ? ID_0_A : ID_0_9;
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
  }

  function getDesc(id){
    return DESCS.find(d=>d.id===id);
  }

  // ======================
  // Collection UI
  // ======================
  function buildCollection(){
    const set = loadCollection();
    collectionGrid.innerHTML = "";

    const mkRow = (ids, two=false) => {
      const row = document.createElement("div");
      row.className = "row" + (two ? " two" : "");
      ids.forEach(id=>{
        const cell = document.createElement("div");
        cell.className = "cell";

        const owned = set.has(id);
        if(!owned) cell.classList.add("disabled");

        const ch = document.createElement("div");
        ch.className = "char";
        ch.textContent = owned ? id : "？";
        cell.appendChild(ch);

        if(owned){
          cell.addEventListener("click", ()=> openDetail(id));
        }
        row.appendChild(cell);
      });
      return row;
    };

    const hr = ()=> {
      const d = document.createElement("div");
      d.className = "hr";
      return d;
    };

    collectionGrid.appendChild(mkRow(["0","1","2"]));
    collectionGrid.appendChild(hr());
    collectionGrid.appendChild(mkRow(["3","4","5"]));
    collectionGrid.appendChild(hr());
    collectionGrid.appendChild(mkRow(["6","7","8"]));
    collectionGrid.appendChild(hr());
    collectionGrid.appendChild(mkRow(["9","A"], true));
  }

  // ======================
  // Detail screen
  // ======================
  function openDetail(id){
    const d = getDesc(id);
    if(!d) return;
    detailChar.textContent = id;
    detailTitle.textContent = d.title;
    detailContent.textContent = d.content;
    showScreen(screenDetail);
  }

  // ======================
  // Gacha machine interaction (rotate 360 while holding tip)
  // ======================
  const STATE = {
    dragging:false,
    lastAngle:0,
    accum:0,
    handleDeg:0,
    busy:false,
  };

  function getCenter(el){
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }

  function angleFromCenter(cx, cy, px, py){
    return Math.atan2(py - cy, px - cx) * 180 / Math.PI;
  }

  function normDelta(d){
    while(d > 180) d -= 360;
    while(d < -180) d += 360;
    return d;
  }

  // ★ 回転はCSS変数に渡す（translate/scaleを壊さない）
  function setHandleRotation(deg){
    STATE.handleDeg = deg;
    imgHandle.style.setProperty("--handle-deg", `${deg}deg`);
  }

  function resetHandle(){
    STATE.accum = 0;
    setHandleRotation(0);
  }

function capsuleReset(){
  imgCapsule.classList.remove("show","drop1","drop2","drop3");
  imgCapsule.style.opacity = "";
  // transformはCSSで管理するので触らない
}


  async function dispense(){
    if(STATE.busy) return;
    STATE.busy = true;

    const id = drawId();
    localStorage.setItem(LS_LAST, id);

    capsuleReset();
    imgCapsule.classList.add("show","drop1");
    await wait(200);
    imgCapsule.classList.remove("drop1");
    imgCapsule.classList.add("drop2");
    await wait(220);
    imgCapsule.classList.remove("drop2");
    imgCapsule.classList.add("drop3");
    await wait(260);

    const set = loadCollection();
    set.add(id);
    saveCollection(set);

    const d = getDesc(id);
    revealChar.textContent = id;
    revealLabel.textContent = d ? d.title : `【 ${id} 】`;
    reveal.classList.add("show");

    STATE.busy = false;
  }

  function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

  function pointerDown(e){
    if(STATE.busy) return;
    e.preventDefault();

    const c = getCenter(imgHandle);
    const a = angleFromCenter(c.x, c.y, e.clientX, e.clientY);

    STATE.dragging = true;
    STATE.lastAngle = a;
    STATE.accum = 0;

    handleHit.setPointerCapture(e.pointerId);
  }

  function pointerMove(e){
    if(!STATE.dragging || STATE.busy) return;
    e.preventDefault();

    const c = getCenter(imgHandle);
    const a = angleFromCenter(c.x, c.y, e.clientX, e.clientY);

    let d = normDelta(a - STATE.lastAngle);
    STATE.lastAngle = a;

    const next = STATE.handleDeg + d;
    setHandleRotation(next);

    STATE.accum += Math.abs(d);

    if(STATE.accum >= 360){
      STATE.dragging = false;
      resetHandle();
      dispense();
    }
  }

  function pointerUp(e){
    if(!STATE.dragging) return;
    e.preventDefault();
    STATE.dragging = false;

    // ふわっと戻す（回転だけ）
    imgHandle.style.transition = "transform 220ms ease";
    setHandleRotation(0);
    setTimeout(()=>{ imgHandle.style.transition = ""; }, 240);
  }

  // ======================
  // Navigation
  // ======================
  btnToGatyakon.addEventListener("click", ()=>{
    capsuleReset();
    resetHandle();
    reveal.classList.remove("show");
    showScreen(screenGatyakon);
  });

  btnToCollection.addEventListener("click", ()=>{
    buildCollection();
    showScreen(screenCollection);
  });

  btnBackFromGatyakon.addEventListener("click", ()=>{
    reveal.classList.remove("show");
    showScreen(screenTitle);
  });

  btnBackFromCollection.addEventListener("click", ()=>{
    showScreen(screenTitle);
  });

  btnCloseDetail.addEventListener("click", ()=>{
    buildCollection();
    showScreen(screenCollection);
  });

  btnRevealClose.addEventListener("click", ()=>{
    reveal.classList.remove("show");
    setTimeout(()=> capsuleReset(), 180);
  });

  // handle events
  handleHit.addEventListener("pointerdown", pointerDown);
  handleHit.addEventListener("pointermove", pointerMove);
  handleHit.addEventListener("pointerup", pointerUp);
  handleHit.addEventListener("pointercancel", pointerUp);

  // ======================
  // Boot
  // ======================
  showScreen(screenLoading);
  preloadAll()
    .then(()=>{
      imgTitle.src = ASSETS.title;
      imgMachine.src = ASSETS.machine;
      imgHandle.src = ASSETS.handle;
      imgOutlet.src = ASSETS.outlet;
      imgCapsule.src = ASSETS.capsule;

      capsuleReset();
      resetHandle();
      reveal.classList.remove("show");

      showScreen(screenTitle);
    })
    .catch((err)=>{
      console.error(err);
      alert("画像の読み込みに失敗しました。ファイル名・拡張子・パスを確認してください。");
    });

})();
