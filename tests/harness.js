// 가짜 브라우저: data.js + game.js를 실행하고 버튼을 눌러 볼 수 있게 해 줌
// (진짜 브라우저 없이 Node.js로 게임 코드를 돌려 보는 테스트 도구. 게임 자체에는 쓰이지 않음)
const fs = require("fs");
const vm = require("vm");
const path = require("path");

// 게임 폴더 = 이 파일(tests/)의 한 단계 위
const GAME_DIR = path.resolve(__dirname, "..");
const CODE = fs.readFileSync(path.join(GAME_DIR, "data.js"), "utf8") + "\n" + fs.readFileSync(path.join(GAME_DIR, "game.js"), "utf8");
const SAVE_KEY = "monster-idle-save";
const BACKUP_KEY = "monster-idle-save-v1-backup";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// 공유 저장소와 시계 (새로고침 = openPage를 다시 부르기)
const env = { store: {}, now: 1_800_000_000_000, storageBroken: false };
const localStorage = {
  getItem: (k) => { if (env.storageBroken) throw new Error("blocked"); return k in env.store ? env.store[k] : null; },
  setItem: (k, v) => { if (env.storageBroken) throw new Error("blocked"); env.store[k] = String(v); },
  removeItem: (k) => { if (env.storageBroken) throw new Error("blocked"); delete env.store[k]; },
};

function fakeEl(tag) {
  const classes = new Set();
  let text = "";
  const el = {
    tag, hidden: false, disabled: false, offsetWidth: 0, children: [], type: "",
    style: { setProperty(k, v) { this[k] = v; } },
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      contains: (c) => classes.has(c),
      toggle: (c, on) => (on === undefined ? (classes.has(c) ? classes.delete(c) : classes.add(c)) : on ? classes.add(c) : classes.delete(c)),
    },
    addEventListener(t, f) { this["on" + t] = f; },
    appendChild(c) { this.children.push(c); return c; },
    remove() {},
  };
  Object.defineProperty(el, "className", { get: () => [...classes].join(" "), set: (v) => { classes.clear(); String(v).split(" ").filter(Boolean).forEach((x) => classes.add(x)); } });
  Object.defineProperty(el, "textContent", { get: () => text, set: (v) => { text = String(v); if (text === "") el.children = []; } });
  return el;
}

function openPage(options = {}) {
  const els = {};
  let timers = [];
  let intervalFn = null;
  const doc = {
    visibilityState: "visible",
    getElementById: (id) => (els[id] = els[id] || fakeEl("div")),
    createElement: (t) => fakeEl(t),
    addEventListener(t, f) { this["on" + t] = f; },
  };
  // index.html에서 처음부터 hidden인 요소들
  for (const id of ["offline-popup", "gacha-popup", "dex-popup", "detail-popup", "gacha-result"]) {
    els[id] = fakeEl("div");
    els[id].hidden = true;
  }
  const warnings = [];
  const ctx = {
    document: doc, localStorage,
    Date: Object.assign(function (...a) { return new Date(...a); }, { now: () => env.now }),
    setTimeout: (f) => { timers.push(f); return timers.length; }, clearTimeout() {},
    setInterval: (f) => { intervalFn = f; }, confirm: () => (options.confirm ?? true),
    console: { warn: (...a) => warnings.push(a.map(String).join(" ")), log: console.log },
    navigator: {}, window: { isSecureContext: false },
  };
  vm.createContext(ctx);
  vm.runInContext(options.code || CODE, ctx);
  const run = (js) => vm.runInContext(js, ctx);
  const p = {
    els, run, warnings,
    forceRandom: (values) => { ctx.__values = values.slice(); run("Math.random = () => __values.shift()"); },
    flushTimers: () => { const t = timers; timers = []; t.forEach((f) => f()); },
    tap: (n = 1) => { for (let i = 0; i < n; i++) els["monster-area"].onpointerdown(); },
    feed: () => els["feed-btn"].onclick(),
    egg: () => els["egg-btn"].onclick(),
    eggFull: () => { els["egg-btn"].onclick(); p.flushTimers(); p.flushTimers(); },
    useDrawn: () => els["gacha-use-btn"].onclick(),
    closeGacha: () => els["gacha-close-btn"].onclick(),
    plusExp: () => els["add-exp-btn"].onclick(),
    plusCoins: () => els["add-coins-btn"].onclick(),
    skip: () => els["skip-time-btn"].onclick(),
    reset: () => els["reset-btn"].onclick(),
    okOffline: () => els["offline-ok-btn"].onclick(),
    hide: () => { doc.visibilityState = "hidden"; doc.onvisibilitychange(); },
    show: () => { doc.visibilityState = "visible"; doc.onvisibilitychange(); },
    tick: () => intervalFn(),
    // 화면 읽기
    coins: () => els.coins.textContent,
    level: () => Number(els.level.textContent),
    exp: () => els["exp-text"].textContent,
    look: () => els.monster.textContent + " " + els["monster-name"].textContent,
    screen: () => `${els.monster.textContent} ${els["monster-name"].textContent} Lv${els.level.textContent} ${els["exp-text"].textContent} 🪙${els.coins.textContent}`,
    msg: () => els.message.textContent,
    popup: () => (els["offline-popup"].hidden ? "팝업없음" : "팝업 " + els["offline-coins"].textContent),
    // 도감
    openDex: () => els["dex-btn"].onclick(),
    dexView: () => {
      const kids = els["dex-sections"].children;
      const parts = [];
      for (let i = 0; i < kids.length; i += 2) {
        const items = kids[i + 1].children.map((c) => {
          const sil = c.children[0].classList.contains("silhouette") ? "(실루엣)" : "";
          return c.children.map((x) => x.textContent).join(" ") + sil + (c.classList.contains("selected") ? "★" : "");
        });
        parts.push(kids[i].textContent + ": " + items.join(", "));
      }
      return parts;
    },
    dexItem: (section, index) => els["dex-sections"].children[section * 2 + 1].children[index],
    detail: () => {
      const e = els;
      return {
        emoji: e["detail-emoji"].textContent + (e["detail-emoji"].classList.contains("silhouette") ? "(실루엣)" : ""),
        name: e["detail-name"].textContent,
        rarity: e["detail-rarity"].textContent,
        level: e["detail-records"].hidden ? "-" : e["detail-level"].textContent,
        first: e["detail-records"].hidden ? "-" : e["detail-first"].textContent,
        count: e["detail-records"].hidden ? "-" : e["detail-count"].textContent,
        tree: e["detail-tree"].hidden ? "-" : e["detail-tree"].children.map((c) => c.tag === "span" || c.className === "tree-arrow" ? "→" : c.children.map((x) => x.textContent).join(" ") + (c.classList.contains("current") ? "◀" : "")).join(" "),
        unknown: !e["detail-unknown"].hidden,
        useBtn: !e["detail-use-btn"].hidden,
        current: !e["detail-current"].hidden,
      };
    },
    detailUse: () => els["detail-use-btn"].onclick(),
    detailBack: () => els["detail-back-btn"].onclick(),
    // 저장 읽기
    saved: () => JSON.parse(env.store[SAVE_KEY]),
  };
  return p;
}

let pass = 0, fail = 0;
function expect(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}: ${JSON.stringify(got)}${ok ? "" : `\n       기대: ${JSON.stringify(want)}`}`);
}
function section(title) { console.log(`\n=== ${title} ===`); }
function done() { console.log(`\n통과 ${pass} / 실패 ${fail}`); if (fail) process.exitCode = 1; }
// 저장 칸에 글자 그대로 넣기 (새로 시작하는 저장소)
function setSave(objOrText) {
  env.store = { [SAVE_KEY]: typeof objOrText === "string" ? objOrText : JSON.stringify(objOrText) };
}

module.exports = { env, openPage, expect, section, done, setSave, GAME_DIR, SAVE_KEY, BACKUP_KEY, MIN, HOUR };
