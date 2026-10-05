// ===== 1. 게임 상태 (데이터) =====
// 게임에서 기억해야 하는 숫자들을 한곳에 모아 둠
const state = {
  level: 1, // 현재 레벨
  exp: 0,   // 현재 레벨에서 모은 경험치
};

// 탭 1번에 얻는 경험치
const EXP_PER_TAP = 1;

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

// ===== 3. 저장 / 불러오기 =====
// 브라우저의 localStorage(로컬 스토리지)라는 작은 보관함에 글자로 저장함
// 이 이름표(키)로 보관함에서 우리 게임 데이터를 찾음
const SAVE_KEY = "monster-idle-save";

// 지금 상태를 보관함에 저장
function saveGame() {
  try {
    // 객체 → 글자로 바꿔서 저장 (예: {"level":2,"exp":5})
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

    // 숫자가 이상하면(글자, 음수, 소수, 레벨 0 등) 쓰지 않음
    if (!data || !isWholeNumber(data.level) || data.level < 1 || !isWholeNumber(data.exp)) {
      console.warn("저장 데이터가 이상해서 처음부터 시작해요:", data);
      return;
    }

    state.level = data.level;
    state.exp = data.exp;
    applyLevelUps(); // 경험치가 너무 많이 저장돼 있으면 맞게 레벨업
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
  render();
}

// ===== 4. 화면 요소 찾아 두기 =====
// index.html에서 id로 이름표를 붙여 둔 요소들을 가져옴
const levelEl = document.getElementById("level");
const expFillEl = document.getElementById("exp-fill");
const expTextEl = document.getElementById("exp-text");
const monsterAreaEl = document.getElementById("monster-area");
const monsterEl = document.getElementById("monster");
const messageEl = document.getElementById("message");
const resetBtnEl = document.getElementById("reset-btn");

// ===== 5. 화면 그리기 =====
// state(데이터)를 보고 화면을 최신 상태로 맞춤
function render() {
  const need = requiredExp(state.level);

  levelEl.textContent = state.level;
  expTextEl.textContent = state.exp + " / " + need;

  // 바 길이 = 모은 경험치 ÷ 필요 경험치 (예: 3 / 10 → 30%)
  expFillEl.style.width = (state.exp / need) * 100 + "%";
}

// ===== 6. 탭했을 때 =====
function onTap() {
  // ① 경험치 올리기
  state.exp += EXP_PER_TAP;

  // ② 필요 경험치를 넘었는지 확인 → 넘었으면 레벨업
  const leveledUp = applyLevelUps();

  // ③ 저장하고 화면 갱신
  saveGame();
  render();

  // ④ 효과 보여 주기
  playBounce();
  showFloatText("+" + EXP_PER_TAP);
  if (leveledUp) {
    showLevelUpMessage();
  }
}

// ===== 7. 효과들 =====

// 몬스터가 통 튀는 효과
function playBounce() {
  monsterEl.classList.remove("bounce");
  void monsterEl.offsetWidth; // 브라우저에게 "지금 한 번 다시 계산해"라고 시켜서, 연타해도 매번 애니메이션이 다시 시작되게 함
  monsterEl.classList.add("bounce");
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

// 안내 문구를 잠깐 "레벨 업!"으로 바꾸기
let messageTimer = null;
function showLevelUpMessage() {
  messageEl.textContent = "레벨 업! 🎉";
  messageEl.classList.add("level-up");

  // 연속으로 레벨업하면 이전 타이머는 취소하고 새로 1.5초를 셈
  clearTimeout(messageTimer);
  messageTimer = setTimeout(function () {
    messageEl.textContent = "몬스터를 탭하세요!";
    messageEl.classList.remove("level-up");
  }, 1500);
}

// ===== 8. 시작 =====
// 몬스터 영역에 손가락이 닿는 순간(pointerdown) onTap 실행
monsterAreaEl.addEventListener("pointerdown", onTap);

// 초기화 버튼: 실수로 누르지 않게 한 번 더 물어봄
resetBtnEl.addEventListener("click", function () {
  if (confirm("저장 데이터를 지우고 처음부터 다시 할까요?")) {
    resetGame();
  }
});

// 저장된 데이터를 불러온 뒤 처음 화면 그리기
loadGame();
render();
