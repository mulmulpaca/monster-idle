// 예전 저장 → 새 구조 옮기기 테스트
// git 기록에서 예전 버전 코드를 꺼내 "진짜로" 플레이시켜 만든 저장 데이터를 새 코드로 열어 봄
const { execSync } = require("child_process");
const { env, openPage, expect, section, done, setSave, GAME_DIR, SAVE_KEY, BACKUP_KEY, MIN, HOUR } = require("./harness");

// git 명령 실행 (게임 폴더 기준)
const git = (args) => execSync(`git -C "${GAME_DIR}" ${args}`, { encoding: "utf8" });

// 그 커밋 시점의 data.js(있으면) + game.js 코드 꺼내기
function oldCode(commit) {
  const tree = git(`ls-tree --name-only ${commit}`).split("\n");
  const data = tree.includes("data.js") ? git(`show ${commit}:data.js`) : "";
  return data + "\n" + git(`show ${commit}:game.js`);
}
const OLD = {
  save: oldCode("aa97391"),    // 2번 저장하기: { level, exp }
  evolve: oldCode("8d7933c"),  // 3번 진화: { level, exp }
  coins: oldCode("2a7e5cc"),   // 4번 코인: + coins, lastSeen
  gacha: oldCode("465c86f"),   // 5번 뽑기: + owned, skin
  dex: oldCode("71eda52"),     // 6번 도감: + collection
  pwa: oldCode("03d0991"),     // 7번 PWA (v1.0.0, 몬스터마다 키우기 직전 버전)
};

// 새 저장의 몬스터 카드에서 시각은 빼고 비교하기 쉽게
const cards = (saved) => Object.fromEntries(Object.entries(saved.monsters).map(([id, r]) => [id, `Lv${r.level} exp${r.exp} ${r.firstAt === null ? "날짜없음" : "날짜있음"} ${r.count}번${r.legacy ? " legacy" : ""}`]));

// ───────────────────────────────────────────
section("1. 저장하기 버전(2번)에서 플레이한 저장");
env.store = {}; env.now = 1_800_000_000_000;
let old = openPage({ code: OLD.save });
old.tap(37); // Lv1 10 + Lv2 20 = 30 → Lv3, 7
let original = env.store[SAVE_KEY];
expect("예전 저장 모양", JSON.parse(original), { level: 3, exp: 7 });
let p = openPage();
expect("새 화면: 1호 Lv3 경험치 7 그대로", p.screen(), "🐣 꼬물이 Lv3 7 / 30 🪙0");
expect("새 저장 구조", [p.saved().version, p.saved().activeId, cards(p.saved())], [2, "starter", { starter: "Lv3 exp7 날짜없음 1번" }]);
expect("백업 = 원본 글자 그대로", env.store[BACKUP_KEY], original);

// ───────────────────────────────────────────
section("2. 진화 버전(3번): Lv5 넘은 저장 → 진화 모습 유지");
env.store = {};
old = openPage({ code: OLD.evolve });
old.plusExp(); old.plusExp(); // 200 → Lv6 50
original = env.store[SAVE_KEY];
p = openPage();
expect("1호 Lv6 🦎 도마돌이", p.screen(), "🦎 도마돌이 Lv6 50 / 60 🪙0");

// ───────────────────────────────────────────
section("3. 코인 버전(4번): 코인·방치 보상");
env.store = {}; env.now = 1_800_000_000_000;
old = openPage({ code: OLD.coins });
old.plusExp(); old.plusExp(); old.plusExp(); // 300 → Lv8 20
old.tap(50); // 코인 50, 경험치 +50 → Lv8 70
original = env.store[SAVE_KEY];
expect("예전 저장 모양", Object.keys(JSON.parse(original)), ["level", "exp", "coins", "lastSeen"]);
env.now += 2 * HOUR; // 2시간 뒤에 새 버전으로 열기
p = openPage();
expect("코인 50 + 방치 보상(120분 × 1호 Lv8 = 960)", [p.screen(), p.popup()], ["🦎 도마돌이 Lv8 70 / 80 🪙1,010", "팝업 960"]);
p = openPage();
expect("다시 열어도 보상 두 번 안 받음", [p.coins(), p.popup()], ["1,010", "팝업없음"]);
expect("두 번째 열 때는 백업 그대로(원본)", env.store[BACKUP_KEY], original);

// ───────────────────────────────────────────
section("4. 뽑기 버전(5번): owned + skin");
env.store = {}; env.now = 1_800_000_000_000;
old = openPage({ code: OLD.gacha });
for (let i = 0; i < 12; i++) old.plusExp(); // 1200 → 정확히 Lv16 0
old.plusCoins(); // 1000코인
old.forceRandom([0.96, 0.9, 0.8, 0.1, 0.1, 0.3, 0.8, 0.1]); // 바다왕, 불꼬리, 느릿이, 불꼬리(중복)
old.egg(); old.egg(); old.egg(); old.egg();
old.run('setSkin("fox")');
original = env.store[SAVE_KEY];
const o4 = JSON.parse(original);
expect("예전 저장: owned·skin", [o4.level, o4.exp, o4.coins, o4.owned, o4.skin], [16, 0, 630, ["whale", "fox", "snail"], "fox"]);
p = openPage();
expect("새 화면: 겉모습(fox) 대신 레벨을 가진 1호 (Lv16 🐊)", p.screen(), "🐊 악어왕 Lv16 0 / 160 🪙630");
expect("몬스터 카드: 뽑은 3마리 Lv1, legacy", cards(p.saved()), {
  starter: "Lv16 exp0 날짜없음 1번",
  snail: "Lv1 exp0 날짜없음 1번 legacy",
  fox: "Lv1 exp0 날짜없음 1번 legacy",
  whale: "Lv1 exp0 날짜없음 1번 legacy",
});
expect("키우는 몬스터 = 1호, 예전 owned/skin/level 칸 없어짐", [p.saved().activeId, "owned" in p.saved(), "skin" in p.saved(), "level" in p.saved()], ["starter", false, false, false]);

// ───────────────────────────────────────────
section("5. 도감 버전(6번): collection (날짜·횟수·legacy)");
env.store = {}; env.now = 1_800_000_000_000;
// 먼저 뽑기 버전에서 owned를 만들고 → 도감 버전으로 열어 legacy 기록을 만든 뒤 → 더 뽑기
old = openPage({ code: OLD.gacha });
old.plusCoins(); old.forceRandom([0.8, 0.0]); old.egg(); // 불꼬리 (owned)
old = openPage({ code: OLD.dex });
for (let i = 0; i < 8; i++) old.plusExp(); // 800 → Lv12 140? 계산은 게임이 함
old.forceRandom([0.8, 0.0, 0.1, 0.0, 0.1, 0.0, 0.1, 0.0]); // 불꼬리 또, 개굴이 3번
old.egg(); old.egg(); old.egg(); old.egg();
old.run('setSkin("frog")');
original = env.store[SAVE_KEY];
const o5 = JSON.parse(original);
expect("예전 저장: collection", o5.collection, { fox: { firstAt: null, count: 2, legacy: true }, frog: { firstAt: env.now, count: 3 } });
const oldLevel = o5.level, oldExp = o5.exp, oldCoins = o5.coins;
p = openPage();
expect("1호 레벨·경험치·코인 그대로", [p.level(), p.exp(), p.coins()], [oldLevel, `${oldExp} / ${oldLevel * 10}`, oldCoins.toLocaleString("ko-KR")]);
expect("카드: 날짜·횟수·legacy 유지, Lv1", cards(p.saved()), {
  starter: `Lv${oldLevel} exp${oldExp} 날짜없음 1번`,
  frog: "Lv1 exp0 날짜있음 3번",
  fox: "Lv1 exp0 날짜없음 2번 legacy",
});
expect("개굴이 처음 얻은 시각 정확히 유지", p.saved().monsters.frog.firstAt, o5.collection.frog.firstAt);

// ───────────────────────────────────────────
section("6. PWA 버전(v1.0.0)에서 플레이한 저장 = v1.1.0으로 올리기 직전 폰·PC에 있던 모양");
env.store = {}; env.now = 1_800_000_000_000;
old = openPage({ code: OLD.pwa });
for (let i = 0; i < 25; i++) old.plusExp(); // 2500 → Lv22 🐉
old.plusCoins(); old.plusCoins();
old.forceRandom([0.96, 0.1, 0.5, 0.5, 0.8, 0.9, 0.97, 0.2]); // 별빛뿔, 찍찍이, 먹물이, 별빛뿔(중복)
old.egg(); old.egg(); old.egg(); old.egg();
old.run('setSkin("unicorn")');
original = env.store[SAVE_KEY];
const o6 = JSON.parse(original);
env.now += 30 * MIN;
p = openPage();
expect("1호 Lv22 🐉 드래곤 (겉모습 별빛뿔 대신)", p.look(), "🐉 드래곤");
expect("코인 그대로 + 30분 × Lv22 = 660", p.coins(), (o6.coins + 660).toLocaleString("ko-KR"));
expect("카드", cards(p.saved()), {
  starter: `Lv${o6.level} exp${o6.exp} 날짜없음 1번`,
  mouse: "Lv1 exp0 날짜있음 1번",
  octopus: "Lv1 exp0 날짜있음 1번",
  unicorn: "Lv1 exp0 날짜있음 2번",
});
expect("백업 = 원본", env.store[BACKUP_KEY], original);
p.openDex();
expect("도감에 옮긴 몬스터들 (지금 모습·Lv)", p.dexView(), [
  "1호: 🐉 드래곤 Lv22★",
  "일반: 🫧 ???(실루엣), 🐚 ???(실루엣), 🐭 찍찍이 Lv1, 🐰 ???(실루엣), 🪨 ???(실루엣)",
  "레어: 🐾 ???(실루엣), 🪶 ???(실루엣), 💧 물방울이 Lv1",
  "전설: 🐴 망아지 Lv1, 🐟 ???(실루엣)",
]);

// ───────────────────────────────────────────
section("7. 옮긴 뒤 여러 번 열기 = 다시 옮기지 않음");
const afterFirst = p.saved();
env.now += 5 * 1000; // 5초 뒤 (보상 없음)
p = openPage(); const second = p.saved();
p = openPage(); const third = p.saved();
const strip = (s) => ({ ...s, lastSeen: 0 });
expect("두 번째·세 번째 저장이 첫 번째와 같음 (시각 제외)", [strip(second), strip(third)], [strip(afterFirst), strip(afterFirst)]);
expect("백업은 여전히 처음 원본", env.store[BACKUP_KEY], original);
p.tap(5);
p = openPage();
expect("새 구조에서 플레이 후 새로고침 → 그대로", p.screen().split(" 🪙")[0], `🐉 드래곤 Lv22 ${o6.exp + 5} / 220`);

// ───────────────────────────────────────────
section("8. 백업 칸이 이미 있으면 덮어쓰지 않음");
env.store = { [SAVE_KEY]: JSON.stringify({ level: 9, exp: 1 }), [BACKUP_KEY]: "가장 처음 원본" };
p = openPage();
expect("레벨은 옮겨지고 백업은 그대로", [p.level(), env.store[BACKUP_KEY]], [9, "가장 처음 원본"]);

// ───────────────────────────────────────────
section("9. 깨진 예전 저장");
const brokenOld = [
  ["글자 깨짐", "{level: 망가짐", "🐣 꼬물이 Lv1 0 / 10 🪙0"],
  ["null", "null", "🐣 꼬물이 Lv1 0 / 10 🪙0"],
  ["숫자 하나", "5", "🐣 꼬물이 Lv1 0 / 10 🪙0"],
  ["레벨이 글자, 코인은 정상", JSON.stringify({ level: "3", exp: 0, coins: 77 }), "🐣 꼬물이 Lv1 0 / 10 🪙77"],
  ["음수 경험치", JSON.stringify({ level: 4, exp: -5 }), "🐣 꼬물이 Lv4 0 / 40 🪙0"],
  ["경험치 과다", JSON.stringify({ level: 1, exp: 35 }), "🐣 꼬물이 Lv3 5 / 30 🪙0"],
  ["빈 객체", "{}", "🐣 꼬물이 Lv1 0 / 10 🪙0"],
  ["배열", "[1,2,3]", "🐣 꼬물이 Lv1 0 / 10 🪙0"],
];
for (const [name, text, want] of brokenOld) {
  setSave(text);
  let shown;
  try { shown = openPage().screen(); } catch (e) { shown = "멈춤: " + e.message; }
  expect(`${name}`, shown, want);
  expect(`${name} → 백업에 원본`, env.store[BACKUP_KEY], text);
}
setSave({ level: 5, exp: 0, collection: { frog: "망가짐", fox: { firstAt: "어제", count: 0 }, dragon: { count: 1 }, constructor: {} }, owned: ["whale"] });
p = openPage();
expect("깨진 collection 칸 → 버리거나 고침, 모르는 id 버림", cards(p.saved()), { starter: "Lv5 exp0 날짜없음 1번", fox: "Lv1 exp0 날짜없음 1번" });
setSave({ level: 5, exp: 0, collection: "망가짐", owned: ["whale", "nope", 3] });
expect("collection이 글자면 owned 사용", cards(openPage().saved()), { starter: "Lv5 exp0 날짜없음 1번", whale: "Lv1 exp0 날짜없음 1번 legacy" });

// ───────────────────────────────────────────
section("10. 깨진 새 구조(version 2) 저장");
const v2 = (extra) => ({ version: 2, coins: 10, lastSeen: env.now, activeId: "fox", monsters: { starter: { level: 7, exp: 3, firstAt: null, count: 1 }, fox: { level: 4, exp: 2, firstAt: 1, count: 2 } }, ...extra });
setSave(v2({}));
expect("정상 v2 → fox Lv4는 아직 1단계 꼬마발",openPage().screen(), "🐾 꼬마발 Lv4 2 / 40 🪙10");
setSave(v2({ activeId: "whale" }));
expect("안 가진 몬스터를 키우는 중 → 1호", openPage().screen(), "🦎 도마돌이 Lv7 3 / 70 🪙10");
setSave(v2({ activeId: "toString" }));
expect("이상한 activeId → 1호", openPage().look(), "🦎 도마돌이");
setSave(v2({ monsters: { fox: { level: 4, exp: 2, firstAt: 1, count: 2 } } }));
p = openPage();
expect("1호 카드 없음 → 1호 Lv1 생성, 불꼬리 유지", [p.screen(), cards(p.saved())], ["🐾 꼬마발 Lv4 2 / 40 🪙10", { starter: "Lv1 exp0 날짜없음 1번", fox: "Lv4 exp2 날짜있음 2번" }]);
setSave(v2({ monsters: { starter: "망가짐", fox: { level: 0, exp: "많이", firstAt: -1, count: "두번" }, unicorn: { level: 3, exp: 999 }, dragon: { level: 9 } } }));
p = openPage();
expect("깨진 카드들 → 그 카드만 기본값, 경험치 과다는 레벨업", cards(p.saved()), {
  starter: "Lv1 exp0 날짜없음 1번",
  fox: "Lv1 exp0 날짜없음 1번",
  unicorn: "Lv14 exp119 날짜없음 1번",
});
setSave(v2({ monsters: null }));
expect("monsters가 null → 1호 Lv1, 멈추지 않음", openPage().screen(), "🐣 꼬물이 Lv1 0 / 10 🪙10");
setSave(v2({}));
openPage();
expect("v2 저장은 백업하지 않음", BACKUP_KEY in env.store, false);

// ───────────────────────────────────────────
section("11. 저장소가 막힌 경우 (시크릿 모드)");
env.storageBroken = true;
let shownBlocked;
try { p = openPage(); p.tap(10); shownBlocked = p.screen(); } catch (e) { shownBlocked = "멈춤: " + e.message; }
expect("저장을 못 읽으면 새로 시작, 플레이 가능 (탭 10번 = 10코인)", shownBlocked, "🐣 꼬물이 Lv2 0 / 20 🪙10");
env.storageBroken = false;

done();
