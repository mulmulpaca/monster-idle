// ===== 1. 게임 상태 (데이터) =====
// 게임에서 기억해야 하는 숫자들을 한곳에 모아 둠
const state = {
  level: 1,            // 현재 레벨
  exp: 0,              // 현재 레벨에서 모은 경험치
  coins: 0,            // 가진 코인
  lastSeen: Date.now(), // 마지막으로 게임을 보고 있던 시각 (방치 보상 계산용)
};

// 보상 숫자표: 게임 밸런스를 바꿀 때는 여기만 고치면 됨
const REWARDS = {
  expPerTap: 1,            // 탭 1번에 얻는 경험치
  coinPerTap: 1,           // 탭 1번에 얻는 코인
  offlineCoinPerMinute: 1, // 자리 비운 1분마다 "레벨 × 이 값" 만큼 코인
  offlineMaxHours: 8,      // 방치 보상은 최대 이 시간까지만 쌓임
  feedCost: 50,            // 먹이 1번 가격 (코인)
  feedExp: 30,             // 먹이 1번에 얻는 경험치
};

// 개발용 버튼 숫자 (게임 규칙이 아니라 테스트용)
const DEV = {
  addExp: 100,   // "경험치 +100" 버튼
  skipHours: 1,  // "1시간 지난 것처럼" 버튼
};

// 시간 계산용 상수 (컴퓨터는 시간을 1/1000초 단위로 셈)
const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;

// 진화 단계표: 모습·이름을 바꿀 때는 여기만 고치면 됨
// - minLevel: 이 레벨부터 이 모습이 됨 (위에서 아래로 레벨이 커지는 순서로 적기)
// - 나중에 그림으로 바꿀 때는 각 줄에 image: "images/파일이름.png" 를 추가할 예정
const EVOLUTIONS = [
  { minLevel: 1,  emoji: "🐣", name: "꼬물이" },
  { minLevel: 5,  emoji: "🦎", name: "도마돌이" },
  { minLevel: 10, emoji: "🐊", name: "악어왕" },
  { minLevel: 20, emoji: "🐉", name: "드래곤" },
];

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

// ===== 3. 저장 / 불러오기 =====
// 브라우저의 localStorage(로컬 스토리지)라는 작은 보관함에 글자로 저장함
// 이 이름표(키)로 보관함에서 우리 게임 데이터를 찾음
const SAVE_KEY = "monster-idle-save";

// 지금 상태를 보관함에 저장
// 저장할 때마다 "지금 게임을 보고 있다"는 뜻으로 lastSeen을 지금 시각으로 바꿈
function saveGame() {
  state.lastSeen = Date.now();
  try {
    // 객체 → 글자로 바꿔서 저장 (예: {"level":2,"exp":5,"coins":30,"lastSeen":…})
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

    // 코인·시각은 예전 저장 데이터에 없을 수 있음
    // → 없거나 이상하면 레벨은 살리고 이것만 기본값(0코인, 지금 시각)으로 둠
    if (isWholeNumber(data.coins)) {
      state.coins = data.coins;
    }
    if (isWholeNumber(data.lastSeen)) {
      state.lastSeen = data.lastSeen;
    }
  } catch (error) {
    console.warn("저장 데이터를 읽지 못해서 처음부터 시작해요:", error);
  }
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
  closeOfflinePopup();
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
const addExpBtnEl = document.getElementById("add-exp-btn");
const skipTimeBtnEl = document.getElementById("skip-time-btn");
const resetBtnEl = document.getElementById("reset-btn");
const offlinePopupEl = document.getElementById("offline-popup");
const offlineCoinsEl = document.getElementById("offline-coins");
const offlineOkBtnEl = document.getElementById("offline-ok-btn");

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

  // 레벨에 맞는 진화 모습과 이름
  const stage = getStage(state.level);
  monsterEl.textContent = stage.emoji;
  monsterNameEl.textContent = stage.name;

  // 코인이 모자라면 먹이 버튼을 못 누르게 함
  feedBtnEl.disabled = state.coins < REWARDS.feedCost;
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
  const stageAfter = getStage(state.level);
  if (stageAfter !== stageBefore) {
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

// ===== 8. 효과들 =====

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

// ===== 9. 시작 =====
// 몬스터 영역에 손가락이 닿는 순간(pointerdown) onTap 실행
monsterAreaEl.addEventListener("pointerdown", onTap);

// 먹이 주기 버튼 (가격은 REWARDS에서 가져와서 글자로 보여 줌)
feedBtnEl.textContent = "🍖 먹이 주기 (" + REWARDS.feedCost + "코인)";
feedBtnEl.addEventListener("click", feed);

// 방치 보상 팝업의 "받기" 버튼
offlineOkBtnEl.addEventListener("click", closeOfflinePopup);

// 개발용: 경험치 +100 버튼
addExpBtnEl.textContent = "🔧 경험치 +" + DEV.addExp;
addExpBtnEl.addEventListener("click", function () {
  gainExp(DEV.addExp);
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

// 저장된 데이터를 불러오고, 꺼 둔 동안의 보상을 받은 뒤 화면 그리기
loadGame();
collectOfflineReward(); // 안에서 render()까지 함
