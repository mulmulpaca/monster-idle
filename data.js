// ===== 게임 데이터 표 =====
// 숫자(밸런스)나 몬스터 목록을 바꾸고 싶으면 이 파일만 고치면 됨
// (game.js보다 먼저 읽히도록 index.html에서 이 파일을 위에 연결해 둠)

// 게임 버전: 고친 게임을 올릴 때마다 숫자를 올리기 (화면 맨 아래에 보임)
// 예: 작은 수정 1.0.0 → 1.0.1, 새 기능 1.0.1 → 1.1.0
const APP_VERSION = "1.1.0";

// 보상 숫자표 (탭 코인은 등급마다 달라서 아래 RARITIES의 tapCoins에 있음)
const REWARDS = {
  expPerTap: 1,            // 탭 1번에 얻는 경험치
  offlineCoinPerMinute: 1, // 자리 비운 1분마다 "키우는 몬스터 레벨 × 이 값" 만큼 코인
  offlineMaxHours: 8,      // 방치 보상은 최대 이 시간까지만 쌓임
  feedCost: 50,            // 먹이 1번 가격 (코인)
  feedExp: 30,             // 먹이 1번에 얻는 경험치
};

// 개발용 버튼 숫자 (게임 규칙이 아니라 테스트용)
const DEV = {
  addExp: 100,    // "경험치 +100" 버튼
  addCoins: 1000, // "코인 +1000" 버튼
  skipHours: 1,   // "1시간 지난 것처럼" 버튼
};

// 알 뽑기 설정
const GACHA = {
  eggCost: 100,     // 알 1개 가격 (코인)
  duplicateExp: 50, // 이미 가진 몬스터가 또 나오면 그 몬스터가 얻는 경험치
};

// 등급표
// - chance: 뽑기 판에서 "몇 칸을 차지하나" (합이 100이 아니어도 됨, 칸 수 비율대로 나옴)
//           0이면 뽑기에 절대 안 나옴 (1호 전용 등급)
// - tapCoins: 이 등급 몬스터를 키울 때 탭 1번에 얻는 코인
// - color: 결과 화면 배경색, 도감 테두리 색
// - 뽑기 등급(chance가 0보다 큰 등급)마다 MONSTERS에 몬스터가 최소 1마리는 있어야 함
const RARITIES = [
  { id: "starter", name: "1호", chance: 0,  tapCoins: 1, color: "#c9a27a" },
  { id: "common",  name: "일반", chance: 70, tapCoins: 1, color: "#8bbf6a" },
  { id: "rare",    name: "레어", chance: 25, tapCoins: 2, color: "#5b9bd5" },
  { id: "legend",  name: "전설", chance: 5,  tapCoins: 3, color: "#f2b632" },
];

// 처음부터 함께하는 1호 몬스터의 id
const STARTER_ID = "starter";

// 몬스터 목록 + 진화 단계 (1호까지 모든 몬스터가 여기 있음)
// - id: 저장용 이름표 (영어, 한번 정하면 바꾸지 않기! 바꾸면 이미 가진 몬스터가 사라짐)
// - rarity: 위 RARITIES의 id 중 하나
// - stages: 진화 단계. minLevel(이 레벨부터 이 모습)이 작은 것부터 차례로 적기
//   emoji / name은 언제든 바꿔도 됨. 나중에 그림으로 바꿀 때는 image: "images/파일.png" 를 추가할 예정
// 같은 등급 안에서는 모두 같은 확률로 뽑힘
const MONSTERS = [
  // ── 1호 (뽑기에 안 나옴) ──
  { id: "starter", rarity: "starter", stages: [
    { minLevel: 1,  emoji: "🐣", name: "꼬물이" },
    { minLevel: 5,  emoji: "🦎", name: "도마돌이" },
    { minLevel: 10, emoji: "🐊", name: "악어왕" },
    { minLevel: 20, emoji: "🐉", name: "드래곤" },
  ] },

  // ── 일반: Lv1 → 5 → 10 ──
  { id: "frog", rarity: "common", stages: [
    { minLevel: 1,  emoji: "🫧", name: "퐁당이" },
    { minLevel: 5,  emoji: "🐸", name: "개굴이" },
    { minLevel: 10, emoji: "🐲", name: "개굴룡" },
  ] },
  { id: "snail", rarity: "common", stages: [
    { minLevel: 1,  emoji: "🐚", name: "소라알" },
    { minLevel: 5,  emoji: "🐌", name: "느릿이" },
    { minLevel: 10, emoji: "🦪", name: "진주왕" },
  ] },
  { id: "mouse", rarity: "common", stages: [
    { minLevel: 1,  emoji: "🐭", name: "찍찍이" },
    { minLevel: 5,  emoji: "🐁", name: "날쌘쥐" },
    { minLevel: 10, emoji: "🐀", name: "대장쥐" },
  ] },
  { id: "rabbit", rarity: "common", stages: [
    { minLevel: 1,  emoji: "🐰", name: "깡총이" },
    { minLevel: 5,  emoji: "🐇", name: "날쌘토끼" },
    { minLevel: 10, emoji: "🦘", name: "점프왕" },
  ] },
  { id: "turtle", rarity: "common", stages: [
    { minLevel: 1,  emoji: "🪨", name: "바위알" },
    { minLevel: 5,  emoji: "🐢", name: "느긋이" },
    { minLevel: 10, emoji: "🦕", name: "거북룡" },
  ] },

  // ── 레어: Lv1 → 8 → 15 ──
  { id: "fox", rarity: "rare", stages: [
    { minLevel: 1,  emoji: "🐾", name: "꼬마발" },
    { minLevel: 8,  emoji: "🦊", name: "불꼬리" },
    { minLevel: 15, emoji: "🐺", name: "달빛여우" },
  ] },
  { id: "owl", rarity: "rare", stages: [
    { minLevel: 1,  emoji: "🪶", name: "깃털이" },
    { minLevel: 8,  emoji: "🦉", name: "밤눈이" },
    { minLevel: 15, emoji: "🦅", name: "폭풍날개" },
  ] },
  { id: "octopus", rarity: "rare", stages: [
    { minLevel: 1,  emoji: "💧", name: "물방울이" },
    { minLevel: 8,  emoji: "🐙", name: "먹물이" },
    { minLevel: 15, emoji: "🦑", name: "크라켄" },
  ] },

  // ── 전설: Lv1 → 10 → 20 → 30 ──
  { id: "unicorn", rarity: "legend", stages: [
    { minLevel: 1,  emoji: "🐴", name: "망아지" },
    { minLevel: 10, emoji: "🐎", name: "질풍마" },
    { minLevel: 20, emoji: "🦄", name: "별빛뿔" },
    { minLevel: 30, emoji: "🌈", name: "무지개뿔" },
  ] },
  { id: "whale", rarity: "legend", stages: [
    { minLevel: 1,  emoji: "🐟", name: "피라미" },
    { minLevel: 10, emoji: "🐬", name: "돌핀이" },
    { minLevel: 20, emoji: "🐋", name: "큰고래" },
    { minLevel: 30, emoji: "🐳", name: "바다왕" },
  ] },
];
