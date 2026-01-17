const tg = window.Telegram?.WebApp;
if (tg) tg.expand();

const WHEEL_EU = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

let history = JSON.parse(localStorage.getItem("history") || "[]"); // kalıcı olsun diye
const MAX_STORE = 200;

const gridEl = document.getElementById("grid");
const histEl = document.getElementById("history");
const recsEl = document.getElementById("recs");
const hintEl = document.getElementById("hint");

hintEl.textContent = "Not: Bu ekran tahmin/garanti vermez; yalnızca girilen geçmişe göre istatistiksel öneri gösterir.";

function freqMap(history, windowSize=50) {
  const slice = history.slice(-windowSize);
  const m = new Map();
  for (let i=0;i<=36;i++) m.set(i, 0);
  for (const n of slice) m.set(n, (m.get(n)||0)+1);
  return m;
}
function recencyMap(history) {
  const m = new Map();
  for (let i=0;i<=36;i++) m.set(i, Infinity);
  for (let idx=history.length-1; idx>=0; idx--) {
    const n = history[idx];
    if (m.get(n) === Infinity) m.set(n, history.length-1-idx);
  }
  return m;
}
function wheelNeighbors(n, k=2) {
  const i = WHEEL_EU.indexOf(n);
  if (i < 0) return [];
  const res = [];
  for (let d=1; d<=k; d++) {
    res.push(WHEEL_EU[(i+d) % WHEEL_EU.length]);
    res.push(WHEEL_EU[(i-d + WHEEL_EU.length) % WHEEL_EU.length]);
  }
  return [...new Set(res)];
}
function recommendNumbers(history, {
  windowSize=50, topK=8, wCold=1.0, wRecency=1.2, wNeighbors=0.8
} = {}) {
  if (history.length === 0) return [];
  const freq = freqMap(history, windowSize);
  const rec = recencyMap(history);
  const last = history[history.length-1];
  const neigh = new Set(wheelNeighbors(last, 2));

  let maxF = 0;
  for (const v of freq.values()) maxF = Math.max(maxF, v);

  let maxR = 0;
  for (const v of rec.values()) {
    const vv = (v === Infinity) ? history.length : v;
    maxR = Math.max(maxR, vv);
  }

  const scored = [];
  for (let n=0; n<=36; n++) {
    const f = freq.get(n) ?? 0;
    const rRaw = rec.get(n);
    const r = (rRaw === Infinity) ? history.length : rRaw;

    const cold = (maxF === 0) ? 0 : (maxF - f) / maxF;
    const recency = (maxR === 0) ? 0 : r / maxR;
    const neighbor = neigh.has(n) ? 1 : 0;

    const score = wCold*cold + wRecency*recency + wNeighbors*neighbor;
    scored.push({ n, score, f, r, neighbor });
  }

  scored.sort((a,b) => b.score - a.score);
  return scored.slice(0, topK);
}

function save() {
  localStorage.setItem("history", JSON.stringify(history.slice(-MAX_STORE)));
}
function render() {
  // history chips
  histEl.innerHTML = "";
  const last = history.slice(-30);
  for (const n of last) {
    const d = document.createElement("div");
    d.className = "chip";
    d.textContent = n;
    histEl.appendChild(d);
  }

  // recommendations
  recsEl.innerHTML = "";
  const recs = recommendNumbers(history, { windowSize: 50, topK: 8 });
  for (const x of recs) {
    const d = document.createElement("div");
    d.className = "chip";
    d.textContent = `${x.n}  (f:${x.f}, r:${x.r}${x.neighbor ? ", komşu" : ""})`;
    recsEl.appendChild(d);
  }

  // Telegram main button (opsiyonel)
  if (tg) {
    tg.MainButton.setText("Sonuçları Bota Gönder");
    tg.MainButton.show();
    tg.MainButton.onClick(() => {
      tg.sendData(JSON.stringify({ type: "history", history: history.slice(-100) }));
    });
  }
}

function addNumber(n) {
  history.push(n);
  save();
  render();
}

function buildGrid() {
  gridEl.innerHTML = "";
  for (let n=0; n<=36; n++) {
    const b = document.createElement("button");
    b.className = "btnnum";
    b.textContent = n;
    b.onclick = () => addNumber(n);
    gridEl.appendChild(b);
  }
}

document.getElementById("undo").onclick = () => {
  history.pop();
  save();
  render();
};
document.getElementById("clear").onclick = () => {
  history = [];
  save();
  render();
};

buildGrid();
render();
