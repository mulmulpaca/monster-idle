// 숫자표·몬스터 목록(APP_VERSION, REWARDS, DEV, GACHA, RARITIES, STARTER_ID, MONSTERS)은 data.js에 있음

// ===== 1. 게임 상태 (데이터) =====
// 게임에서 기억해야 하는 것들을 한곳에 모아 둠
// 몬스터 기록 카드 하나: { level, exp, firstAt(처음 얻은 시각), count(뽑힌 횟수) }
//   도감 기능 전에 얻은 몬스터는 날짜를 몰라서 { …, firstAt: null, legacy: true }
function newRecord(firstAt) {
  return { level: 1, exp: 0, firstAt: firstAt, count: 1 };
}

const state = {
  version: 2,             // 저장 구조 번호 (예전 저장과 구별하려고 붙임)
  coins: 0,               // 가진 코인
  lastSeen: Date.now(),   // 마지막으로 게임을 보고 있던 시각 (방치 보상 계산용)
  activeId: STARTER_ID,   // 지금 키우는 몬스터 id
  monsters: {},           // 가진 몬스터마다 기록 카드 (못 모은 몬스터는 카드가 없음)
};
state.monsters[STARTER_ID] = newRecord(null); // 1호는 처음부터 함께함

// 시간 계산용 상수 (컴퓨터는 시간을 1/1000초 단위로 셈)
const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;

// ===== 2. 규칙 =====
// 다음 레벨까지 필요한 경험치: 레벨 × 10 (Lv1은 10, Lv2는 20, Lv3은 30 …) — 모든 몬스터 같음
function requiredExp(level) {
  return level * 10;
}

// 기록 카드의 경험치가 필요 경험치를 넘었으면 레벨업시킴
// (while을 쓰면 경험치가 많이 들어와도 여러 번 레벨업할 수 있음)
// 레벨업을 한 번이라도 했으면 true를 돌려줌
function applyLevelUps(record) {
  let leveledUp = false;
  while (record.exp >= requiredExp(record.level)) {
    record.exp -= requiredExp(record.level); // 남는 경험치는 다음 레벨로 넘김
    record.level += 1;
    leveledUp = true;
  }
  return leveledUp;
}

// id로 몬스터 찾기 (없으면 undefined)
function findMonster(id) {
  return MONSTERS.find(function (monster) {
    return monster.id === id;
  });
}

// id로 등급 찾기
function findRarity(id) {
  return RARITIES.find(function (rarity) {
    return rarity.id === id;
  });
}

// 뽑기에 나오는 등급인지 (1호 전용 등급은 chance가 0)
function isGachaRarity(rarity) {
  return rarity.chance > 0;
}

// 몬스터의 레벨에 맞는 진화 단계를 찾아 줌
// 단계표를 위에서부터 보면서, minLevel 조건을 만족하는 "마지막" 단계를 고름
// 예: 개굴이 Lv7 → 1 이상 ✔, 5 이상 ✔, 10 이상 ✘ → 🐸 개굴이
function getStage(monsterId, level) {
  const stages = findMonster(monsterId).stages;
  let stage = stages[0];
  for (const candidate of stages) {
    if (level >= candidate.minLevel) {
      stage = candidate;
    }
  }
  return stage;
}

// 이 몬스터를 가지고 있나? (기록 카드가 있는지 확인)
// hasOwnProperty: 객체에 "직접" 들어 있는 것만 확인 (자바스크립트가 기본으로 넣어 둔 이름에 속지 않게)
function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isOwned(id) {
  return hasOwn(state.monsters, id);
}

// 지금 키우는 몬스터의 정보 묶음
function getActive() {
  const record = state.monsters[state.activeId];
  const monster = findMonster(state.activeId);
  return {
    id: state.activeId,
    monster: monster,
    record: record,
    rarity: findRarity(monster.rarity),
    stage: getStage(state.activeId, record.level),
  };
}

// 뽑기 몬스터 중 가진 수 (등급 id를 주면 그 등급만 셈)
function countOwned(rarityId) {
  return MONSTERS.filter(function (monster) {
    const rarity = findRarity(monster.rarity);
    return isGachaRarity(rarity) && isOwned(monster.id) && (rarityId === undefined || monster.rarity === rarityId);
  }).length;
}

// 뽑기 몬스터 수 (등급 id를 주면 그 등급만 셈)
function countGachaMonsters(rarityId) {
  return MONSTERS.filter(function (monster) {
    const rarity = findRarity(monster.rarity);
    return isGachaRarity(rarity) && (rarityId === undefined || monster.rarity === rarityId);
  }).length;
}

// ===== 3. 저장 / 불러오기 =====
// 브라우저의 localStorage(로컬 스토리지)라는 작은 보관함에 글자로 저장함
// 이 이름표(키)로 보관함에서 우리 게임 데이터를 찾음
const SAVE_KEY = "monster-idle-save";
// 예전 구조의 저장을 새 구조로 옮기기 전에, 원본 글자를 그대로 복사해 두는 곳 (안전장치)
const BACKUP_KEY = "monster-idle-save-v1-backup";

// 지금 상태를 보관함에 저장
// 저장할 때마다 "지금 게임을 보고 있다"는 뜻으로 lastSeen을 지금 시각으로 바꿈
function saveGame() {
  state.lastSeen = Date.now();
  try {
    // 객체 → 글자로 바꿔서 저장
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
// 데이터가 없거나 깨져 있으면 처음 상태(1호 Lv1)로 시작
function loadGame() {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (text === null) {
      return; // 저장된 게 없음 (처음 하는 사람)
    }

    let data;
    try {
      // 글자 → 객체로 되돌리기 (글자가 깨져 있으면 여기서 오류가 남)
      data = JSON.parse(text);
    } catch (error) {
      backupOldSave(text); // 깨진 글자라도 혹시 모르니 보관
      console.warn("저장 데이터를 읽지 못해서 처음부터 시작해요:", error);
      return;
    }
    if (!data || typeof data !== "object") {
      backupOldSave(text);
      console.warn("저장 데이터가 이상해서 처음부터 시작해요:", data);
      return;
    }

    if (data.version === 2) {
      loadVersion2(data);
    } else {
      backupOldSave(text); // 옮기기 전에 원본부터 복사해 둠
      migrateOldSave(data);
    }
  } catch (error) {
    console.warn("저장 데이터를 불러오지 못했어요:", error);
  }
}

// 예전 저장 원본을 백업 칸에 복사 (이미 백업이 있으면 덮어쓰지 않음 → 가장 처음 원본을 지킴)
function backupOldSave(text) {
  try {
    if (localStorage.getItem(BACKUP_KEY) === null) {
      localStorage.setItem(BACKUP_KEY, text);
    }
  } catch (error) {
    console.warn("예전 저장을 백업하지 못했어요:", error);
  }
}

// 코인·시각 불러오기 (예전·새 구조 공통). 이상하면 기본값(0코인, 지금 시각) 그대로
function loadCoinsAndTime(data) {
  if (isWholeNumber(data.coins)) {
    state.coins = data.coins;
  }
  if (isWholeNumber(data.lastSeen)) {
    state.lastSeen = data.lastSeen;
  }
}

// 저장된 기록 카드 하나를 검사해서 안전한 카드로 만들기
// - level·exp가 있으면 검사 (이상하면 Lv1 / 경험치 0), 없으면 Lv1 / 0 (예전 도감 기록)
// - 날짜가 이상하면 null, 횟수가 이상하면(0, 음수, 글자) 1
function readRecord(saved) {
  const record = newRecord(null);
  if (isWholeNumber(saved.level) && saved.level >= 1) {
    record.level = saved.level;
    if (isWholeNumber(saved.exp)) {
      record.exp = saved.exp;
    }
  }
  if (isWholeNumber(saved.firstAt)) {
    record.firstAt = saved.firstAt;
  }
  if (isWholeNumber(saved.count) && saved.count >= 1) {
    record.count = saved.count;
  }
  if (saved.legacy === true) {
    record.legacy = true;
  }
  applyLevelUps(record); // 경험치가 너무 많이 저장돼 있으면 맞게 레벨업
  return record;
}

// 새 구조(version 2) 불러오기
function loadVersion2(data) {
  loadCoinsAndTime(data);

  const saved = data.monsters && typeof data.monsters === "object" ? data.monsters : {};
  for (const monster of MONSTERS) {
    // 몬스터 목록에 있는 것만 보므로, 모르는 id는 자연히 버려짐
    const raw = hasOwn(saved, monster.id) ? saved[monster.id] : null;
    if (raw && typeof raw === "object") {
      state.monsters[monster.id] = readRecord(raw);
    }
  }
  // 1호 카드가 없거나 망가졌으면 1호 Lv1로 (위에서 만든 기본 카드가 그대로 남음)
  if (!isOwned(STARTER_ID)) {
    state.monsters[STARTER_ID] = newRecord(null);
  }

  // 키우던 몬스터가 가진 몬스터가 아니면 1호
  state.activeId = isOwned(data.activeId) ? data.activeId : STARTER_ID;
}

// 예전 구조(몬스터별 레벨이 없던 때) → 새 구조로 옮기기
// 예전 모양들: { level, exp, coins, lastSeen, collection 또는 owned, skin }
function migrateOldSave(data) {
  // ① 맨 위 레벨·경험치 → 1호 몬스터 (그동안 키운 레벨이 여기 있음)
  state.monsters[STARTER_ID] = readRecord({ level: data.level, exp: data.exp });

  // ② 코인·시각은 그대로
  loadCoinsAndTime(data);

  // ③ 뽑은 몬스터 → 각자 Lv1 기록 카드 (날짜·횟수·legacy 표시는 그대로)
  for (const monster of MONSTERS) {
    if (monster.id === STARTER_ID) {
      continue;
    }
    if (data.collection && typeof data.collection === "object") {
      // 도감 기능 때의 기록 { firstAt, count, legacy }
      const raw = hasOwn(data.collection, monster.id) ? data.collection[monster.id] : null;
      if (raw && typeof raw === "object") {
        state.monsters[monster.id] = readRecord({ firstAt: raw.firstAt, count: raw.count, legacy: raw.legacy });
      }
    } else if (Array.isArray(data.owned) && data.owned.includes(monster.id)) {
      // 도감 기능 전의 기록 ["frog", "fox"] → 날짜를 모르므로 legacy
      state.monsters[monster.id] = { level: 1, exp: 0, firstAt: null, count: 1, legacy: true };
    }
  }

  // ④ 예전 겉모습(skin)은 버리고, 레벨을 가진 1호를 키우는 중으로
  state.activeId = STARTER_ID;
}

// 저장 데이터를 지우고 처음 상태로 되돌리기 (개발용, 백업 칸은 건드리지 않음)
function resetGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    console.warn("저장 데이터를 지우지 못했어요:", error);
  }
  state.coins = 0;
  state.lastSeen = Date.now();
  state.activeId = STARTER_ID;
  state.monsters = {};
  state.monsters[STARTER_ID] = newRecord(null);
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
const dexSectionsEl = document.getElementById("dex-sections");
const dexCloseBtnEl = document.getElementById("dex-close-btn");
// 몬스터 상세 팝업
const detailPopupEl = document.getElementById("detail-popup");
const detailEmojiEl = document.getElementById("detail-emoji");
const detailNameEl = document.getElementById("detail-name");
const detailRarityEl = document.getElementById("detail-rarity");
const detailRecordsEl = document.getElementById("detail-records");
const detailLevelEl = document.getElementById("detail-level");
const detailFirstEl = document.getElementById("detail-first");
const detailCountEl = document.getElementById("detail-count");
const detailTreeEl = document.getElementById("detail-tree");
const detailUnknownEl = document.getElementById("detail-unknown");
const detailCurrentEl = document.getElementById("detail-current");
const detailUseBtnEl = document.getElementById("detail-use-btn");
const detailBackBtnEl = document.getElementById("detail-back-btn");

// ===== 5. 화면 그리기 =====
// 큰 숫자에 쉼표 넣기 (1260 → "1,260")
function formatNumber(n) {
  return n.toLocaleString("ko-KR");
}

// state(데이터)를 보고 화면을 최신 상태로 맞춤 (화면에는 키우는 몬스터가 보임)
function render() {
  const active = getActive();
  const need = requiredExp(active.record.level);

  coinsEl.textContent = formatNumber(state.coins);
  levelEl.textContent = active.record.level;
  expTextEl.textContent = active.record.exp + " / " + need;

  // 바 길이 = 모은 경험치 ÷ 필요 경험치 (예: 3 / 10 → 30%)
  expFillEl.style.width = (active.record.exp / need) * 100 + "%";

  // 키우는 몬스터의 지금 진화 모습과 이름
  monsterEl.textContent = active.stage.emoji;
  monsterNameEl.textContent = active.stage.name;

  // 코인이 모자라면 버튼을 못 누르게 함
  feedBtnEl.disabled = state.coins < REWARDS.feedCost;
  eggBtnEl.disabled = state.coins < GACHA.eggCost;
}

// ===== 6. 경험치 얻기 =====
// 몬스터 한 마리에게 경험치 주기 (화면은 건드리지 않고, 무슨 일이 있었는지만 돌려줌)
function gainExpTo(monsterId, amount) {
  const record = state.monsters[monsterId];
  const levelBefore = record.level;
  const stageBefore = getStage(monsterId, record.level);

  record.exp += amount;
  const leveledUp = applyLevelUps(record);
  const stageAfter = getStage(monsterId, record.level);

  return {
    levelBefore: levelBefore,
    levelAfter: record.level,
    leveledUp: leveledUp,
    evolved: stageAfter !== stageBefore, // 진화 단계가 바뀌었으면 진화!
    stageAfter: stageAfter,
  };
}

// 키우는 몬스터에게 경험치 주고 → 저장 → 화면 갱신 → 효과
// 탭이든 먹이든 개발용 버튼이든 모두 여기를 거침
function gainExp(amount) {
  const result = gainExpTo(state.activeId, amount);
  saveGame();
  render();

  // 진화 메시지가 레벨업보다 우선
  if (result.evolved) {
    playAnimation(monsterAreaEl, "evolve");
    showMessage("✨ " + result.stageAfter.name + withRo(result.stageAfter.name) + " 진화했다!");
  } else if (result.leveledUp) {
    showMessage("레벨 업! 🎉");
  }

  showFloatText("+" + amount);
}

// 탭했을 때: 등급별 코인 받고 경험치 받기 (1호·일반 1, 레어 2, 전설 3)
function onTap() {
  playAnimation(monsterEl, "bounce");
  state.coins += getActive().rarity.tapCoins;
  gainExp(REWARDS.expPerTap); // 여기서 저장·화면 갱신까지 함
}

// 먹이 주기: 코인을 내고 키우는 몬스터가 경험치 받기
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

  // ③ 코인 = 분 × 키우는 몬스터 레벨 × 1분당 코인
  const coins = minutes * getActive().record.level * REWARDS.offlineCoinPerMinute;

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
//    칸 수 = chance → 일반 0~70칸, 레어 70~95칸, 전설 95~100칸 (1호 등급은 0칸이라 절대 안 맞음)
function pickRarity(roll) {
  const gachaRarities = RARITIES.filter(isGachaRarity);
  let total = 0;
  for (const rarity of gachaRarities) {
    total += rarity.chance;
  }

  let dart = roll * total; // 0 ~ 100 사이 어딘가에 다트가 꽂힘
  for (const rarity of gachaRarities) {
    if (dart < rarity.chance) {
      return rarity; // 이 등급 칸 안에 꽂힘
    }
    dart -= rarity.chance; // 이 등급 칸을 지나침 → 다음 등급 칸에서 다시 확인
  }
  return gachaRarities[gachaRarities.length - 1]; // (소수 계산 오차 대비) 마지막 등급
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
  let expResult = null;
  if (isNew) {
    // 새 몬스터 → Lv1 기록 카드 만들기 (지금 시각, 1번)
    state.monsters[monster.id] = newRecord(Date.now());
  } else {
    // 이미 있음 → 뽑힌 횟수 +1, 그 몬스터에게 경험치
    state.monsters[monster.id].count += 1;
    expResult = gainExpTo(monster.id, GACHA.duplicateExp);
  }

  saveGame();
  render();
  playGachaShow(monster, isNew, expResult);
}

// 뽑기 연출: 🥚 흔들흔들(1.2초) → 💥 팡(0.3초) → 결과 카드
const SHAKE_TIME = 1200;
const CRACK_TIME = 300;
let gachaTimers = [];
let lastDrawn = null; // "이 몬스터 키우기"에서 쓸 방금 뽑은 몬스터

function playGachaShow(monster, isNew, expResult) {
  lastDrawn = monster;
  const rarity = findRarity(monster.rarity);
  const stage = getStage(monster.id, state.monsters[monster.id].level); // 지금 모습

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
  gachaMonsterEl.textContent = stage.emoji;
  gachaNameEl.textContent = stage.name;
  gachaNewEl.hidden = !isNew;
  gachaUseBtnEl.hidden = state.activeId === monster.id; // 이미 키우는 중이면 버튼 숨김
  if (isNew) {
    gachaNoteEl.textContent = "새 몬스터가 도감에 등록됐어요!";
  } else {
    let note = "이미 가진 몬스터예요. 경험치 +" + GACHA.duplicateExp + "!";
    if (expResult.leveledUp) {
      note += " (Lv" + expResult.levelBefore + " → Lv" + expResult.levelAfter + ")";
    }
    if (expResult.evolved) {
      note += " ✨ " + stage.name + withRo(stage.name) + " 진화!";
    }
    gachaNoteEl.textContent = note;
  }

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

// ===== 9. 키울 몬스터 고르기와 도감 =====
// 키울 몬스터 바꾸기 (각자의 레벨·경험치는 그대로)
function setActive(id) {
  if (!isOwned(id) || id === state.activeId) {
    return; // 가지지 않은 몬스터는 고를 수 없음, 이미 키우는 중이면 그대로
  }
  state.activeId = id;
  saveGame();
  render();
  showMessage(getActive().stage.name + " 키우기 시작!");
}

// 시각 → "2026년 10월 5일"
function formatDate(time) {
  const date = new Date(time);
  return date.getFullYear() + "년 " + (date.getMonth() + 1) + "월 " + date.getDate() + "일";
}

// 글자를 담은 작은 요소 만들기 (도감 칸·진화 트리에서 반복해서 씀)
function createSpan(className, text) {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = text;
  return el;
}

// 도감 칸 하나 만들기
// 가졌으면 지금 모습·이름·레벨, 못 모았으면 Lv1 모습의 검은 실루엣·"???"
function createDexItem(monster) {
  const owned = isOwned(monster.id);

  const item = document.createElement("button");
  item.type = "button";
  item.className = "dex-item";
  if (state.activeId === monster.id) {
    item.classList.add("selected"); // 지금 키우는 몬스터에 테두리 + ★
  }
  item.style.setProperty("--rarity-color", findRarity(monster.rarity).color);

  if (owned) {
    const record = state.monsters[monster.id];
    const stage = getStage(monster.id, record.level);
    item.appendChild(createSpan("dex-emoji", stage.emoji));
    item.appendChild(createSpan("dex-name", stage.name));
    item.appendChild(createSpan("dex-level", "Lv" + record.level));
  } else {
    item.appendChild(createSpan("dex-emoji silhouette", monster.stages[0].emoji));
    item.appendChild(createSpan("dex-name", "???"));
  }

  item.addEventListener("click", function () {
    openDetail(monster.id);
  });
  return item;
}

// 도감 창 내용 그리기
function renderDex() {
  // ① 전체 수집률 (뽑기 몬스터 기준, 1호 제외. 예: 4 / 10 (40%))
  const owned = countOwned();
  const total = countGachaMonsters();
  const percent = Math.round((owned / total) * 100);
  dexTotalEl.textContent = owned + " / " + total + " (" + percent + "%)";

  // ② 등급별 수집률 (예: 일반 3/5 · 레어 1/3 · 전설 0/2)
  const summary = RARITIES.filter(isGachaRarity).map(function (rarity) {
    return rarity.name + " " + countOwned(rarity.id) + "/" + countGachaMonsters(rarity.id);
  });
  dexRaritySummaryEl.textContent = summary.join(" · ");

  // ③ 등급마다 제목 + 몬스터 칸들 (1호 등급이 맨 위)
  dexSectionsEl.textContent = ""; // 이전 내용 비우기
  for (const rarity of RARITIES) {
    const monsters = MONSTERS.filter(function (monster) {
      return monster.rarity === rarity.id;
    });
    if (monsters.length === 0) {
      continue;
    }

    const title = document.createElement("h3");
    title.className = "dex-section-title";
    title.style.setProperty("--rarity-color", rarity.color);
    title.textContent = rarity.name;
    dexSectionsEl.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "dex-grid";
    for (const monster of monsters) {
      grid.appendChild(createDexItem(monster));
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

// 진화 트리 그리기: 이미 본 단계(레벨이 도달한 단계)는 모습·이름, 못 본 단계는 ❔ ???
// 예: 🫧 퐁당이 Lv1 → 🐸 개굴이 Lv5 → ❔ ??? Lv10
function renderTree(monster, level) {
  detailTreeEl.textContent = ""; // 이전 내용 비우기
  monster.stages.forEach(function (stage, index) {
    if (index > 0) {
      detailTreeEl.appendChild(createSpan("tree-arrow", "→"));
    }
    const seen = level >= stage.minLevel;
    const box = document.createElement("div");
    box.className = seen ? "tree-stage" : "tree-stage unseen";
    if (stage === getStage(monster.id, level)) {
      box.classList.add("current"); // 지금 단계 강조
    }
    box.appendChild(createSpan("tree-emoji", seen ? stage.emoji : "❔"));
    box.appendChild(createSpan("tree-name", seen ? stage.name : "???"));
    box.appendChild(createSpan("tree-level", "Lv" + stage.minLevel));
    detailTreeEl.appendChild(box);
  });
}

// 몬스터 상세 창 열기: 지금 모습, 등급, 레벨, 처음 얻은 날, 뽑힌 횟수, 진화 트리
let detailId = null; // 지금 상세 창에 보이는 몬스터 id
function openDetail(id) {
  detailId = id;
  const monster = findMonster(id);
  const rarity = findRarity(monster.rarity);
  const owned = isOwned(id);

  detailRarityEl.textContent = "등급: " + rarity.name;
  detailRarityEl.style.setProperty("--rarity-color", rarity.color);

  // 가진 몬스터만 기록·진화 트리를 보여 줌
  detailRecordsEl.hidden = !owned;
  detailTreeEl.hidden = !owned;
  detailUnknownEl.hidden = owned;

  if (owned) {
    const record = state.monsters[id];
    const stage = getStage(id, record.level);
    detailEmojiEl.textContent = stage.emoji;
    detailEmojiEl.classList.remove("silhouette");
    detailNameEl.textContent = stage.name;
    detailLevelEl.textContent = "Lv" + record.level;

    if (id === STARTER_ID) {
      detailFirstEl.textContent = "처음부터 함께했어요";
      detailCountEl.textContent = "뽑기로 얻지 않음";
    } else if (record.legacy) {
      // 도감 기능 전에 얻은 몬스터: 날짜를 모르고, 그동안의 중복은 세지 않았음
      detailFirstEl.textContent = "도감 기능 전에 얻음";
      detailCountEl.textContent = record.count + "번 이상";
    } else {
      detailFirstEl.textContent = record.firstAt === null ? "기록 없음" : formatDate(record.firstAt);
      detailCountEl.textContent = record.count + "번";
    }
    renderTree(monster, record.level);
  } else {
    detailEmojiEl.textContent = monster.stages[0].emoji;
    detailEmojiEl.classList.add("silhouette");
    detailNameEl.textContent = "???";
  }

  // 버튼: 가졌고 키우는 중이 아니면 "키우기", 키우는 중이면 안내 문구
  detailUseBtnEl.hidden = !owned || state.activeId === id;
  detailCurrentEl.hidden = !owned || state.activeId !== id;

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
  setActive(lastDrawn.id);
  closeGachaPopup();
});
dexCloseBtnEl.addEventListener("click", closeDex);
detailUseBtnEl.addEventListener("click", function () {
  setActive(detailId);
  closeDetail();
  renderDex(); // 도감의 ★ 위치 다시 그리기
});
detailBackBtnEl.addEventListener("click", closeDetail);

// 개발용: 경험치 +100 버튼 (키우는 몬스터에게)
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

// 저장된 데이터를 불러오고(예전 저장이면 새 구조로 옮기고), 꺼 둔 동안의 보상을 받은 뒤 화면 그리기
loadGame();
collectOfflineReward(); // 안에서 저장·render()까지 함
