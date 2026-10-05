// ===== 게임 데이터 표 =====
// 숫자(밸런스)나 몬스터 목록을 바꾸고 싶으면 이 파일만 고치면 됨
// (game.js보다 먼저 읽히도록 index.html에서 이 파일을 위에 연결해 둠)

// 보상 숫자표
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
  addExp: 100,    // "경험치 +100" 버튼
  addCoins: 1000, // "코인 +1000" 버튼
  skipHours: 1,   // "1시간 지난 것처럼" 버튼
};

// 기본 몬스터 진화 단계표
// - minLevel: 이 레벨부터 이 모습이 됨 (위에서 아래로 레벨이 커지는 순서로 적기)
// - 나중에 그림으로 바꿀 때는 각 줄에 image: "images/파일이름.png" 를 추가할 예정
const EVOLUTIONS = [
  { minLevel: 1,  emoji: "🐣", name: "꼬물이" },
  { minLevel: 5,  emoji: "🦎", name: "도마돌이" },
  { minLevel: 10, emoji: "🐊", name: "악어왕" },
  { minLevel: 20, emoji: "🐉", name: "드래곤" },
];

// 알 뽑기 설정
const GACHA = {
  eggCost: 100,        // 알 1개 가격 (코인)
  duplicateRefund: 30, // 이미 가진 몬스터가 나오면 돌려주는 코인

  // 등급표
  // - chance: 뽑기 판에서 "몇 칸을 차지하나" (합이 100이 아니어도 됨, 칸 수 비율대로 나옴)
  // - color: 결과 화면 배경색
  // - 등급마다 MONSTERS에 몬스터가 최소 1마리는 있어야 함
  rarities: [
    { id: "common", name: "일반", chance: 70, color: "#8bbf6a" },
    { id: "rare",   name: "레어", chance: 25, color: "#5b9bd5" },
    { id: "legend", name: "전설", chance: 5,  color: "#f2b632" },
  ],
};

// 뽑기 몬스터 목록
// - id: 저장용 이름표 (영어, 한번 정하면 바꾸지 않기! 바꾸면 이미 뽑은 몬스터가 사라짐)
// - rarity: 위 GACHA.rarities의 id 중 하나
// - emoji / name: 보이는 모습과 이름 (언제든 바꿔도 됨)
// 같은 등급 안에서는 모두 같은 확률로 나옴
const MONSTERS = [
  { id: "frog",      rarity: "common", emoji: "🐸", name: "개굴이" },
  { id: "snail",     rarity: "common", emoji: "🐌", name: "느릿이" },
  { id: "mouse",     rarity: "common", emoji: "🐭", name: "찍찍이" },
  { id: "rabbit",    rarity: "common", emoji: "🐰", name: "깡총이" },
  { id: "turtle",    rarity: "common", emoji: "🐢", name: "느긋이" },
  { id: "fox",       rarity: "rare",   emoji: "🦊", name: "불꼬리" },
  { id: "owl",       rarity: "rare",   emoji: "🦉", name: "밤눈이" },
  { id: "octopus",   rarity: "rare",   emoji: "🐙", name: "먹물이" },
  { id: "unicorn",   rarity: "legend", emoji: "🦄", name: "별빛뿔" },
  { id: "whale",     rarity: "legend", emoji: "🐳", name: "바다왕" },
];
