// 숫자표·몬스터 목록(REWARDS, DEV, EVOLUTIONS, GACHA, MONSTERS)은 data.js에 있음

// ===== 1. 게임 상태 (데이터) =====
// 게임에서 기억해야 하는 것들을 한곳에 모아 둠
const state = {
  level: 1,             // 현재 레벨
  exp: 0,               // 현재 레벨에서 모은 경험치
  coins: 0,             // 가진 코인
  lastSeen: Date.now(), // 마지막으로 게임을 보고 있던 시각 (방치 보상 계산용)
  // 도감 기록: 가진 몬스터마다 기록 카드 하나 (못 모은 몬스터는 카드가 없음)
  // 예: { fox: { firstAt: 처음 얻은 시각, count: 뽑힌 횟수 } }
  // 도감 기능 전에 얻은 몬스터는 날짜를 모르므로 { firstAt: null, count: 1, legacy: true }
  collection: {},
  skin: null,           // 고른 겉모습 몬스터 id (null이면 기본 모습)
};

// 시간 계산용 상수 (컴퓨터는 시간을 1/1000초 단위로 셈)
const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;

// ===== 2. 규칙 =====
// 다음 레벨까지 필요한 경험치: 레벨 × 10 (Lv1은 10, Lv2는 20, Lv3은 30 …)
function requiredExp(level) {
  return level * 10;
}

// 경험치가 필요 경험치를 넘었으면 레벨업시킴
// (while을 쓰면 경험치가 많이 들어와도 여러 번 레벨업할 수 있음)
// 레벨업을 한 번이라도 했으면 true를 돌려줌
function applyLevelUps() {
  let leveledUp = false;
  while (state.exp >= requiredExp(state.level)) {
    state.exp -= requiredExp(state.level); // 남는 경험치는 다음 레벨로 넘김
    state.level += 1;
    leveledUp = true;
  }
  return leveledUp;
}

// 레벨에 맞는 진화 단계를 찾아 줌
// 표를 위에서부터 보면서, minLevel 조건을 만족하는 "마지막" 단계를 고름
// 예: Lv7 → 1 이상 ✔, 5 이상 ✔, 10 이상 ✘ → 🦎 도마돌이
function getStage(level) {
  let stage = EVOLUTIONS[0];
  for (const candidate of EVOLUTIONS) {
    if (level >= candidate.minLevel) {
      stage = candidate;
    }
  }
  return stage;
}

// id로 몬스터 찾기 (없으면 undefined)
function findMonster(id) {
  return MONSTERS.find(function (monster) {
    return monster.id === id;
  });
}

// id로 등급 찾기
function findRarity(id) {
  return GACHA.rarities.find(function (rarity) {
    return rarity.id === id;
  });
}

// 이 몬스터를 가지고 있나? (도감 기록 카드가 있는지 확인)
// hasOwnProperty: 객체에 "직접" 들어 있는 것만 확인 (자바스크립트가 기본으로 넣어 둔 이름에 속지 않게)
function isOwned(id) {
  return Object.prototype.hasOwnProperty.call(state.collection, id);
}

// 가진 몬스터 수 (등급 id를 주면 그 등급만 셈)
function countOwned(rarityId) {
  return MONSTERS.filter(function (monster) {
    return isOwned(monster.id) && (rarityId === undefined || monster.rarity === rarityId);
  }).length;
}

// 지금 화면에 보일 모습: 겉모습을 골랐으면 그 몬스터, 아니면 레벨에 맞는 진화 모습
function getAppearance() {
  if (state.skin !== null) {
    return findMonster(state.skin);
  }
  return getStage(state.level);
}

// ===== 3. 저장 / 불러오기 =====
// 브라우저의 localStorage(로컬 스토리지)라는 작은 보관함에 글자로 저장함
// 이 이름표(키)로 보관함에서 우리 게임 데이터를 찾음
const SAVE_KEY = "monster-idle-save";

// 지금 상태를 보관함에 저장
// 저장할 때마다 "지금 게임을 보고 있다"는 뜻으로 lastSeen을 지금 시각으로 바꿈
function saveGame() {
  state.lastSeen = Date.now();
  try {
    // 객체 → 글자로 바꿔서 저장 (예: {"level":2,"exp":5,"coins":30,…})
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (error) {
    // 시크릿 모드 등에서 저장이 막혀도 게임은 계속 진행
    console.warn("저장하지 못했어요:", error);
  }
}

// 0 이상의 정수(0, 1, 2 …)인지 확인
function isWholeNumber(value) {
  return Number.isInteger(value) && value >= 0;
}

// 보관함에서 불러와서 state에 넣기
// 데이터가 없거나 깨져 있으면 아무것도 바꾸지 않음 → 처음 상태(Lv1)로 시작
function loadGame() {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (text === null) {
      return; // 저장된 게 없음 (처음 하는 사람)
    }

    // 글자 → 객체로 되돌리기 (글자가 깨져 있으면 여기서 오류가 나서 catch로 감)
    const data = JSON.parse(text);

    // 레벨·경험치가 이상하면(글자, 음수, 소수, 레벨 0 등) 쓰지 않음
    if (!data || !isWholeNumber(data.level) || data.level < 1 || !isWholeNumber(data.exp)) {
      console.warn("저장 데이터가 이상해서 처음부터 시작해요:", data);
      return;
    }

    state.level = data.level;
    state.exp = data.exp;
    applyLevelUps(); // 경험치가 너무 많이 저장돼 있으면 맞게 레벨업

    // 아래 값들은 예전 저장 데이터에 없을 수 있음
    // → 없거나 이상하면 레벨은 살리고 그 값만 기본값으로 둠
    if (isWholeNumber(data.coins)) {
      state.coins = data.coins;
    }
    if (isWholeNumber(data.lastSeen)) {
      state.lastSeen = data.lastSeen;
    }
    if (data.collection && typeof data.collection === "object") {
      state.collection = loadCollection(data.collection);
    } else if (Array.isArray(data.owned)) {
      state.collection = migrateOwned(data.owned); // 도감 기능 전의 예전 저장
    }
    // 가진 몬스터의 모습만 고를 수 있음 (아니면 기본 모습)
    if (isOwned(data.skin)) {
      state.skin = data.skin;
    }
  } catch (error) {
    console.warn("저장 데이터를 읽지 못해서 처음부터 시작해요:", error);
  }
}

// 저장된 도감 기록 검사하기
// 몬스터 목록(MONSTERS)에 있는 몬스터만 확인하므로, 모르는 id는 자연히 버려짐
function loadCollection(saved) {
  const collection = {};
  for (const monster of MONSTERS) {
    const record = Object.prototype.hasOwnProperty.call(saved, monster.id) ? saved[monster.id] : null;
    if (!record || typeof record !== "object") {
      continue; // 기록 없음 → 아직 못 모은 몬스터
    }
    collection[monster.id] = {
      // 날짜가 이상하면 null (화면에는 "기록 없음")
      firstAt: isWholeNumber(record.firstAt) ? record.firstAt : null,
      // 횟수가 이상하면(0, 음수, 글자) 1번으로
      count: isWholeNumber(record.count) && record.count >= 1 ? record.count : 1,
    };
    if (record.legacy === true) {
      collection[monster.id].legacy = true;
    }
  }
  return collection;
}

// 예전 저장(owned: ["frog", "fox"])을 새 도감 기록으로 옮기기
// 예전에는 날짜·중복 횟수를 기록하지 않았으므로 legacy(예전 것) 표시를 붙여 둠
function migrateOwned(owned) {
  const collection = {};
  for (const monster of MONSTERS) {
    if (owned.includes(monster.id)) {
      collection[monster.id] = { firstAt: null, count: 1, legacy: true };
    }
  }
  return collection;
}

// 저장 데이터를 지우고 처음 상태로 되돌리기 (개발용)
function resetGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    console.warn("저장 데이터를 지우지 못했어요:", error);
  }
  state.level = 1;
  state.exp = 0;
  state.coins = 0;
  state.lastSeen = Date.now();
  state.collection = {};
  state.skin = null;
  closeOfflinePopup();
  closeGachaPopup();
  closeDetail();
  closeDex();
  render();
}

// ===== 4. 화면 요소 찾아 두기 =====
// index.html에서 id로 이름표를 붙여 둔 요소들을 가져옴
const coinsEl = document.getElementById("coins");
const levelEl = document.getElementById("level");
const expFillEl = document.getElementById("exp-fill");
const expTextEl = document.getElementById("exp-text");
const monsterAreaEl = document.getElementById("monster-area");
const monsterEl = document.getElementById("monster");
const monsterNameEl = document.getElementById("monster-name");
const messageEl = document.getElementById("message");
const feedBtnEl = document.getElementById("feed-btn");
const eggBtnEl = document.getElementById("egg-btn");
const dexBtnEl = document.getElementById("dex-btn");
const addExpBtnEl = document.getElementById("add-exp-btn");
const addCoinsBtnEl = document.getElementById("add-coins-btn");
const skipTimeBtnEl = document.getElementById("skip-time-btn");
const resetBtnEl = document.getElementById("reset-btn");
// 방치 보상 팝업
const offlinePopupEl = document.getElementById("offline-popup");
const offlineCoinsEl = document.getElementById("offline-coins");
const offlineOkBtnEl = document.getElementById("offline-ok-btn");
// 뽑기 팝업
const gachaPopupEl = document.getElementById("gacha-popup");
const gachaBoxEl = document.getElementById("gacha-box");
const gachaEggEl = document.getElementById("gacha-egg");
const gachaResultEl = document.getElementById("gacha-result");
const gachaRarityEl = document.getElementById("gacha-rarity");
const gachaMonsterEl = document.getElementById("gacha-monster");
const gachaNameEl = document.getElementById("gacha-name");
const gachaNewEl = document.getElementById("gacha-new");
const gachaNoteEl = document.getElementById("gacha-note");
const gachaUseBtnEl = document.getElementById("gacha-use-btn");
const gachaCloseBtnEl = document.getElementById("gacha-close-btn");
// 도감 팝업
const dexPopupEl = document.getElementById("dex-popup");
const dexTotalEl = document.getElementById("dex-total");
const dexRaritySummaryEl = document.getElementById("dex-rarity-summary");
const dexBasicBtnEl = document.getElementById("dex-basic-btn");
const dexSectionsEl = document.getElementById("dex-sections");
const dexCloseBtnEl = document.getElementById("dex-close-btn");
// 몬스터 상세 팝업
const detailPopupEl = document.getElementById("detail-popup");
const detailEmojiEl = document.getElementById("detail-emoji");
const detailNameEl = document.getElementById("detail-name");
const detailRarityEl = document.getElementById("detail-rarity");
const detailRecordsEl = document.getElementById("detail-records");
const detailFirstEl = document.getElementById("detail-first");
const detailCountEl = document.getElementById("detail-count");
const detailUnknownEl = document.getElementById("detail-unknown");
const detailCurrentEl = document.getElementById("detail-current");
const detailUseBtnEl = document.getElementById("detail-use-btn");
const detailBackBtnEl = document.getElementById("detail-back-btn");

// ===== 5. 화면 그리기 =====
// 큰 숫자에 쉼표 넣기 (1260 → "1,260")
function formatNumber(n) {
  return n.toLocaleString("ko-KR");
}

// state(데이터)를 보고 화면을 최신 상태로 맞춤
function render() {
  const need = requiredExp(state.level);

  coinsEl.textContent = formatNumber(state.coins);
  levelEl.textContent = state.level;
  expTextEl.textContent = state.exp + " / " + need;

  // 바 길이 = 모은 경험치 ÷ 필요 경험치 (예: 3 / 10 → 30%)
  expFillEl.style.width = (state.exp / need) * 100 + "%";

  // 지금 모습과 이름 (겉모습을 골랐으면 그 몬스터, 아니면 진화 모습)
  const appearance = getAppearance();
  monsterEl.textContent = appearance.emoji;
  monsterNameEl.textContent = appearance.name;

  // 코인이 모자라면 버튼을 못 누르게 함
  feedBtnEl.disabled = state.coins < REWARDS.feedCost;
  eggBtnEl.disabled = state.coins < GACHA.eggCost;
}

// ===== 6. 경험치 얻기 =====
// 탭이든 먹이든 개발용 버튼이든 경험치는 모두 여기를 거침
function gainExp(amount) {
  // ① 받기 전의 진화 단계를 기억해 둠
  const stageBefore = getStage(state.level);

  // ② 경험치 올리고, 필요 경험치를 넘었으면 레벨업
  state.exp += amount;
  const leveledUp = applyLevelUps();

  // ③ 저장하고 화면 갱신
  saveGame();
  render();

  // ④ 받은 후의 단계와 비교 → 달라졌으면 진화! (진화 메시지가 레벨업보다 우선)
  //    단, 다른 겉모습을 쓰는 중이면 보이는 모습이 그대로라서 "레벨 업!"만 보여 줌
  const stageAfter = getStage(state.level);
  if (stageAfter !== stageBefore && state.skin === null) {
    playAnimation(monsterAreaEl, "evolve");
    showMessage("✨ " + stageAfter.name + withRo(stageAfter.name) + " 진화했다!");
  } else if (leveledUp) {
    showMessage("레벨 업! 🎉");
  }

  showFloatText("+" + amount);
}

// 탭했을 때: 코인 받고 경험치 받기
function onTap() {
  playAnimation(monsterEl, "bounce");
  state.coins += REWARDS.coinPerTap;
  gainExp(REWARDS.expPerTap); // 여기서 저장·화면 갱신까지 함
}

// 먹이 주기: 코인을 내고 경험치 받기
function feed() {
  if (state.coins < REWARDS.feedCost) {
    return; // 코인이 모자라면 아무것도 안 함
  }
  state.coins -= REWARDS.feedCost;
  playAnimation(monsterEl, "bounce");
  gainExp(REWARDS.feedExp);
}

// ===== 7. 방치 보상 =====
// 마지막으로 본 시각(lastSeen)부터 지금까지 흐른 시간만큼 코인을 줌
function collectOfflineReward() {
  // ① 흐른 시간 계산: 음수(폰 시계를 되돌림)면 0, 최대 시간보다 길면 최대 시간으로 자름
  let awayTime = Date.now() - state.lastSeen;
  awayTime = Math.max(awayTime, 0);
  awayTime = Math.min(awayTime, REWARDS.offlineMaxHours * ONE_HOUR);

  // ② 분으로 바꾸기 (1분이 안 되는 자투리는 버림)
  const minutes = Math.floor(awayTime / ONE_MINUTE);

  // ③ 코인 = 분 × 레벨 × 1분당 코인
  const coins = minutes * state.level * REWARDS.offlineCoinPerMinute;

  // ④ 바로 지갑에 넣고 저장 (lastSeen도 지금으로 바뀌므로 두 번 받을 일이 없음)
  state.coins += coins;
  saveGame();
  render();

  // ⑤ 받은 게 있으면 팝업으로 알려 줌
  if (coins > 0) {
    showOfflinePopup(coins);
  }
}

// 팝업 보여 주기 (이미 떠 있으면 금액을 더해서 보여 줌)
let popupCoins = 0;
function showOfflinePopup(coins) {
  popupCoins += coins;
  offlineCoinsEl.textContent = formatNumber(popupCoins);
  offlinePopupEl.hidden = false;
}

function closeOfflinePopup() {
  popupCoins = 0;
  offlinePopupEl.hidden = true;
}

// 화면을 보고 있는지 확인 (다른 앱·탭으로 가면 "hidden"이 됨)
function isWatching() {
  return document.visibilityState === "visible";
}

// ===== 8. 알 뽑기 =====
// 무작위 원리: Math.random()은 0 이상 1 미만의 아무 숫자를 하나 줌 (매번 다름)

// ① 등급 정하기: roll(0~1 사이 숫자)로 "다트"를 던져서 맞은 칸의 등급을 고름
//    칸 수 = chance → 일반 0~70칸, 레어 70~95칸, 전설 95~100칸
function pickRarity(roll) {
  let total = 0;
  for (const rarity of GACHA.rarities) {
    total += rarity.chance;
  }

  let dart = roll * total; // 0 ~ 100 사이 어딘가에 다트가 꽂힘
  for (const rarity of GACHA.rarities) {
    if (dart < rarity.chance) {
      return rarity; // 이 등급 칸 안에 꽂힘
    }
    dart -= rarity.chance; // 이 등급 칸을 지나침 → 다음 등급 칸에서 다시 확인
  }
  return GACHA.rarities[GACHA.rarities.length - 1]; // (소수 계산 오차 대비) 마지막 등급
}

// ② 몬스터 정하기: 그 등급의 몬스터들 중 하나를 똑같은 확률로 고름
//    예: 일반 5종이면 roll × 5 → 0.0~4.99… → 버림하면 0,1,2,3,4 번째 중 하나
function pickMonster(rarityId, roll) {
  const candidates = MONSTERS.filter(function (monster) {
    return monster.rarity === rarityId;
  });
  return candidates[Math.floor(roll * candidates.length)];
}

// 알 하나 깨기: 등급 → 몬스터 순서로 무작위 뽑기
function drawMonster() {
  const rarity = pickRarity(Math.random());
  return pickMonster(rarity.id, Math.random());
}

// 알 사기: 코인 내기 → 뽑기 → 결과 반영 → 저장 → 연출
// (연출 도중에 새로고침해도 결과가 날아가지 않도록 저장을 먼저 함)
function buyEgg() {
  if (state.coins < GACHA.eggCost) {
    return; // 코인이 모자라면 아무것도 안 함
  }
  state.coins -= GACHA.eggCost;

  const monster = drawMonster();
  const isNew = !isOwned(monster.id);
  if (isNew) {
    // 새 몬스터 → 도감에 기록 카드 만들기 (지금 시각, 1번)
    state.collection[monster.id] = { firstAt: Date.now(), count: 1 };
  } else {
    state.collection[monster.id].count += 1; // 뽑힌 횟수 +1
    state.coins += GACHA.duplicateRefund;    // 이미 있음 → 코인 일부 돌려줌
  }

  saveGame();
  render();
  playGachaShow(monster, isNew);
}

// 뽑기 연출: 🥚 흔들흔들(1.2초) → 💥 팡(0.3초) → 결과 카드
const SHAKE_TIME = 1200;
const CRACK_TIME = 300;
let gachaTimers = [];
let lastDrawn = null; // "이 모습으로 키우기"에서 쓸 방금 뽑은 몬스터

function playGachaShow(monster, isNew) {
  lastDrawn = monster;
  const rarity = findRarity(monster.rarity);

  // 처음 화면: 알만 보이고 결과는 숨김
  gachaBoxEl.classList.remove("revealed", "is-legend");
  gachaEggEl.textContent = "🥚";
  gachaEggEl.className = "gacha-egg shake";
  gachaEggEl.hidden = false;
  gachaResultEl.hidden = true;
  gachaPopupEl.hidden = false;

  // 결과 내용은 미리 채워 둠 (아직 안 보임)
  gachaBoxEl.style.setProperty("--rarity-color", rarity.color);
  gachaRarityEl.textContent = rarity.name;
  gachaMonsterEl.textContent = monster.emoji;
  gachaNameEl.textContent = monster.name;
  gachaNewEl.hidden = !isNew;
  gachaUseBtnEl.hidden = !isNew;
  gachaNoteEl.textContent = isNew
    ? "새 몬스터가 도감에 등록됐어요!"
    : "이미 가진 몬스터예요. " + GACHA.duplicateRefund + "코인을 돌려받았어요.";

  // 시간에 맞춰 장면 바꾸기
  clearGachaTimers();
  gachaTimers.push(setTimeout(function () {
    gachaEggEl.textContent = "💥";
    gachaEggEl.className = "gacha-egg crack";
  }, SHAKE_TIME));
  gachaTimers.push(setTimeout(function () {
    gachaEggEl.hidden = true;
    gachaResultEl.hidden = false;
    gachaBoxEl.classList.add("revealed"); // 배경이 등급 색으로 바뀜
    if (rarity.id === "legend") {
      gachaBoxEl.classList.add("is-legend"); // 전설은 반짝반짝
    }
  }, SHAKE_TIME + CRACK_TIME));
}

function clearGachaTimers() {
  for (const timer of gachaTimers) {
    clearTimeout(timer);
  }
  gachaTimers = [];
}

function closeGachaPopup() {
  clearGachaTimers();
  gachaPopupEl.hidden = true;
}

// ===== 9. 도감과 겉모습 =====
// 겉모습 바꾸기 (null이면 기본 모습). 레벨·경험치는 그대로
function setSkin(id) {
  if (id !== null && !isOwned(id)) {
    return; // 가지지 않은 몬스터는 고를 수 없음
  }
  state.skin = id;
  saveGame();
  render();
}

// 시각 → "2026년 10월 5일"
function formatDate(time) {
  const date = new Date(time);
  return date.getFullYear() + "년 " + (date.getMonth() + 1) + "월 " + date.getDate() + "일";
}

// 도감 칸 하나 만들기: 가졌으면 이모지·이름, 못 모았으면 검은 실루엣·"???"
function createDexItem(monster) {
  const owned = isOwned(monster.id);

  const item = document.createElement("button");
  item.type = "button";
  item.className = "dex-item";
  if (state.skin === monster.id) {
    item.classList.add("selected"); // 지금 쓰는 모습에 테두리
  }
  item.style.setProperty("--rarity-color", findRarity(monster.rarity).color);

  const emojiEl = document.createElement("span");
  emojiEl.className = owned ? "dex-emoji" : "dex-emoji silhouette";
  emojiEl.textContent = monster.emoji;
  const nameEl = document.createElement("span");
  nameEl.className = "dex-name";
  nameEl.textContent = owned ? monster.name : "???";
  item.appendChild(emojiEl);
  item.appendChild(nameEl);

  item.addEventListener("click", function () {
    openDetail(monster.id);
  });
  return item;
}

// 도감 창 내용 그리기
function renderDex() {
  // ① 전체 수집률 (예: 4 / 10 (40%))
  const owned = countOwned();
  const percent = Math.round((owned / MONSTERS.length) * 100);
  dexTotalEl.textContent = owned + " / " + MONSTERS.length + " (" + percent + "%)";

  // ② 등급별 수집률 (예: 일반 3/5 · 레어 1/3 · 전설 0/2)
  const summary = GACHA.rarities.map(function (rarity) {
    const total = MONSTERS.filter(function (monster) {
      return monster.rarity === rarity.id;
    }).length;
    return rarity.name + " " + countOwned(rarity.id) + "/" + total;
  });
  dexRaritySummaryEl.textContent = summary.join(" · ");

  // ③ 기본 모습 버튼 (지금 레벨의 진화 모습)
  const stage = getStage(state.level);
  dexBasicBtnEl.textContent = stage.emoji + " 기본 모습";
  dexBasicBtnEl.classList.toggle("selected", state.skin === null);

  // ④ 등급마다 제목 + 몬스터 칸들
  dexSectionsEl.textContent = ""; // 이전 내용 비우기
  for (const rarity of GACHA.rarities) {
    const title = document.createElement("h3");
    title.className = "dex-section-title";
    title.style.setProperty("--rarity-color", rarity.color);
    title.textContent = rarity.name;
    dexSectionsEl.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "dex-grid";
    for (const monster of MONSTERS) {
      if (monster.rarity === rarity.id) {
        grid.appendChild(createDexItem(monster));
      }
    }
    dexSectionsEl.appendChild(grid);
  }
}

function openDex() {
  renderDex();
  dexPopupEl.hidden = false;
}

function closeDex() {
  dexPopupEl.hidden = true;
}

// 몬스터 상세 창 열기: 등급, 처음 얻은 날, 뽑힌 횟수
let detailId = null; // 지금 상세 창에 보이는 몬스터 id
function openDetail(id) {
  detailId = id;
  const monster = findMonster(id);
  const rarity = findRarity(monster.rarity);
  const record = state.collection[id];
  const owned = isOwned(id);

  detailEmojiEl.textContent = monster.emoji;
  detailEmojiEl.classList.toggle("silhouette", !owned);
  detailNameEl.textContent = owned ? monster.name : "???";
  detailRarityEl.textContent = "등급: " + rarity.name;
  detailRarityEl.style.setProperty("--rarity-color", rarity.color);

  // 가진 몬스터만 기록을 보여 줌
  detailRecordsEl.hidden = !owned;
  detailUnknownEl.hidden = owned;
  if (owned) {
    if (record.legacy) {
      // 도감 기능 전에 얻은 몬스터: 날짜를 모르고, 그동안의 중복은 세지 않았음
      detailFirstEl.textContent = "도감 기능 전에 얻음";
      detailCountEl.textContent = record.count + "번 이상";
    } else {
      detailFirstEl.textContent = record.firstAt === null ? "기록 없음" : formatDate(record.firstAt);
      detailCountEl.textContent = record.count + "번";
    }
  }

  // 겉모습 버튼: 가졌고 지금 모습이 아니면 "키우기", 지금 모습이면 안내 문구
  detailUseBtnEl.hidden = !owned || state.skin === id;
  detailCurrentEl.hidden = !owned || state.skin !== id;

  detailPopupEl.hidden = false;
}

function closeDetail() {
  detailPopupEl.hidden = true;
}

// ===== 10. 효과들 =====

// 요소에 애니메이션 클래스를 붙여서 효과를 재생 (통 튀기, 반짝임 등)
function playAnimation(el, className) {
  el.classList.remove(className);
  void el.offsetWidth; // 브라우저에게 "지금 한 번 다시 계산해"라고 시켜서, 연달아 불러도 매번 애니메이션이 다시 시작되게 함
  el.classList.add(className);
}

// "+1" 글자가 위로 떠오르다 사라지는 효과
function showFloatText(text) {
  const el = document.createElement("div");
  el.className = "float-text";
  el.textContent = text;
  monsterAreaEl.appendChild(el);

  // 애니메이션이 끝나면 글자를 지워서 화면에 쌓이지 않게 함
  el.addEventListener("animationend", function () {
    el.remove();
  });
}

// 이름 뒤에 "로"와 "으로" 중 맞는 것을 골라 줌
// 받침이 없거나 ㄹ 받침이면 "로", 나머지 받침이면 "으로" (예: 꼬물이로, 악어왕으로)
function withRo(name) {
  const code = name.charCodeAt(name.length - 1) - 0xac00; // 한글 "가"부터 몇 번째 글자인지
  if (code < 0 || code > 11171) {
    return "로"; // 한글이 아니면 그냥 "로"
  }
  const batchim = code % 28; // 0이면 받침 없음, 8이면 ㄹ 받침
  return batchim === 0 || batchim === 8 ? "로" : "으로";
}

// 안내 문구를 잠깐 바꿔서 보여 주기 (레벨 업, 진화 등)
let messageTimer = null;
function showMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.add("level-up");

  // 연달아 불리면 이전 타이머는 취소하고 새로 1.5초를 셈
  clearTimeout(messageTimer);
  messageTimer = setTimeout(function () {
    messageEl.textContent = "몬스터를 탭하세요!";
    messageEl.classList.remove("level-up");
  }, 1500);
}

// ===== 11. 시작 =====
// 몬스터 영역에 손가락이 닿는 순간(pointerdown) onTap 실행
monsterAreaEl.addEventListener("pointerdown", onTap);

// 먹이 주기·알 뽑기 버튼 (가격은 data.js에서 가져와서 글자로 보여 줌)
feedBtnEl.textContent = "🍖 먹이 주기 (" + REWARDS.feedCost + "코인)";
feedBtnEl.addEventListener("click", feed);
eggBtnEl.textContent = "🥚 알 뽑기 (" + GACHA.eggCost + "코인)";
eggBtnEl.addEventListener("click", buyEgg);
dexBtnEl.addEventListener("click", openDex);

// 팝업 버튼들
offlineOkBtnEl.addEventListener("click", closeOfflinePopup);
gachaCloseBtnEl.addEventListener("click", closeGachaPopup);
gachaUseBtnEl.addEventListener("click", function () {
  setSkin(lastDrawn.id);
  closeGachaPopup();
});
dexCloseBtnEl.addEventListener("click", closeDex);
dexBasicBtnEl.addEventListener("click", function () {
  setSkin(null); // 기본 모습으로
  renderDex();   // 테두리 위치 다시 그리기
});
detailUseBtnEl.addEventListener("click", function () {
  setSkin(detailId);
  closeDetail();
  renderDex(); // 도감의 테두리 위치 다시 그리기
});
detailBackBtnEl.addEventListener("click", closeDetail);

// 개발용: 경험치 +100 버튼
addExpBtnEl.textContent = "🔧 경험치 +" + DEV.addExp;
addExpBtnEl.addEventListener("click", function () {
  gainExp(DEV.addExp);
});

// 개발용: 코인 +1000 버튼
addCoinsBtnEl.textContent = "🔧 코인 +" + DEV.addCoins;
addCoinsBtnEl.addEventListener("click", function () {
  state.coins += DEV.addCoins;
  saveGame();
  render();
});

// 개발용: 마지막으로 본 시각을 1시간 앞으로 당긴 뒤, 진짜 방치 보상과 같은 함수를 부름
skipTimeBtnEl.textContent = "🔧 " + DEV.skipHours + "시간 지난 것처럼";
skipTimeBtnEl.addEventListener("click", function () {
  state.lastSeen -= DEV.skipHours * ONE_HOUR;
  collectOfflineReward();
});

// 초기화 버튼: 실수로 누르지 않게 한 번 더 물어봄
resetBtnEl.addEventListener("click", function () {
  if (confirm("저장 데이터를 지우고 처음부터 다시 할까요?")) {
    resetGame();
  }
});

// 다른 앱·탭으로 갔다가 돌아오는 것 감지
document.addEventListener("visibilitychange", function () {
  if (isWatching()) {
    collectOfflineReward(); // 돌아옴 → 자리 비운 만큼 보상
  } else {
    saveGame(); // 떠남 → 떠난 시각을 저장
  }
});

// 보고 있는 동안에는 10초마다 "아직 보고 있음"을 저장
// (켜 놓고 가만히 있는 시간은 방치 보상에 들어가지 않게)
setInterval(function () {
  if (isWatching()) {
    saveGame();
  }
}, 10 * 1000);

// 화면 맨 아래에 게임 버전 표시
document.getElementById("app-version").textContent = "v" + APP_VERSION;

// PWA: 창고지기(sw.js) 등록 → 인터넷이 끊겨도 게임이 열리게 함
// (https 주소나 localhost에서만 동작. 그 밖의 주소에서는 조용히 건너뜀)
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("sw.js").catch(function (error) {
    console.warn("창고지기를 등록하지 못했어요:", error);
  });
}

// 저장된 데이터를 불러오고, 꺼 둔 동안의 보상을 받은 뒤 화면 그리기
loadGame();
collectOfflineReward(); // 안에서 render()까지 함
