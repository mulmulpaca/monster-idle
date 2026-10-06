// 게임 동작 테스트: 등급별 탭 코인, 먹이·방치 보상 기준, 진화 레벨, 중복 경험치, 키울 몬스터 바꾸기
const { env, openPage, expect, section, done, setSave, MIN, HOUR } = require("./harness");

const T0 = 1_800_000_000_000;
// 새 구조 저장 만들기 도우미
function v2(activeId, monsters, coins = 0) {
  return { version: 2, coins, lastSeen: env.now, activeId, monsters };
}
const card = (level, exp = 0) => ({ level, exp, firstAt: T0, count: 1 });

section("처음 시작");
env.store = {}; env.now = T0;
let p = openPage();
expect("1호 Lv1", p.screen(), "🐣 꼬물이 Lv1 0 / 10 🪙0");
expect("새 저장 구조", [p.saved().version, p.saved().activeId, Object.keys(p.saved().monsters)], [2, "starter", ["starter"]]);

section("등급별 탭 코인 (1호 1 · 일반 1 · 레어 2 · 전설 3)");
for (const [id, want] of [["starter", 1], ["mouse", 1], ["owl", 2], ["whale", 3]]) {
  setSave(v2(id, { starter: card(1), [id]: card(1) }));
  p = openPage();
  p.tap(5);
  expect(`${id} 5탭 → 코인 ${want * 5}, 경험치 5`, [p.coins(), p.exp()], [String(want * 5), "5 / 10"]);
}

section("탭·먹이·방치 보상은 키우는 몬스터 기준");
setSave(v2("fox", { starter: card(12, 40), fox: card(3, 0) }, 100));
p = openPage();
p.tap(1);
p.feed();
expect("불꼬리(fox)만 성장: 1 + 30 = 31 → Lv3에서 Lv4 1", [p.saved().monsters.fox.level, p.saved().monsters.fox.exp], [4, 1]);
expect("1호는 그대로 Lv12 40", [p.saved().monsters.starter.level, p.saved().monsters.starter.exp], [12, 40]);
expect("코인: 100 + 2(레어 탭) - 50(먹이)", p.coins(), "52");
p.skip(); // 1시간
expect("방치 보상 = 60분 × 키우는 fox Lv4 = 240", p.popup(), "팝업 240");
p.okOffline();
setSave(v2("fox", { starter: card(12, 40), fox: card(4, 0) }));
env.now += 2 * HOUR;
expect("다시 열 때 방치 보상도 키우는 몬스터(Lv4) 기준: 120 × 4", openPage().popup(), "팝업 480");
env.now = T0;

section("각 몬스터 진화 레벨");
const evolveAt = {
  starter: [[4, 5, "🦎 도마돌이"], [9, 10, "🐊 악어왕"], [19, 20, "🐉 드래곤"]],
  frog: [[4, 5, "🐸 개굴이"], [9, 10, "🐲 개굴룡"]],
  turtle: [[4, 5, "🐢 느긋이"], [9, 10, "🦕 거북룡"]],
  fox: [[7, 8, "🦊 불꼬리"], [14, 15, "🐺 달빛여우"]],
  octopus: [[7, 8, "🐙 먹물이"], [14, 15, "🦑 크라켄"]],
  unicorn: [[9, 10, "🐎 질풍마"], [19, 20, "🦄 별빛뿔"], [29, 30, "🌈 무지개뿔"]],
  whale: [[9, 10, "🐬 돌핀이"], [19, 20, "🐋 큰고래"], [29, 30, "🐳 바다왕"]],
};
for (const [id, steps] of Object.entries(evolveAt)) {
  for (const [from, to, look] of steps) {
    setSave(v2(id, { starter: card(1), [id]: card(from, from * 10 - 1) }));
    p = openPage();
    const before = p.look();
    p.tap(1);
    const ok = p.level() === to && p.look() === look && p.msg().includes("진화했다") && p.els["monster-area"].classList.contains("evolve");
    expect(`${id} Lv${from}→${to}: ${before} → ${look} (반짝임·메시지)`, ok ? "진화" : `${p.level()} ${p.look()} ${p.msg()}`, "진화");
  }
}
setSave(v2("fox", { starter: card(1), fox: card(5, 49) }));
p = openPage(); p.tap(1);
expect("진화 레벨이 아니면 레벨 업만 (fox Lv5→6)", [p.look(), p.msg(), p.els["monster-area"].classList.contains("evolve")], ["🐾 꼬마발", "레벨 업! 🎉", false]);

section("키울 몬스터 바꾸기 (각자 레벨 유지)");
setSave(v2("starter", { starter: card(12, 40), frog: card(6, 3) }));
p = openPage();
expect("처음엔 1호", p.screen(), "🐊 악어왕 Lv12 40 / 120 🪙0");
p.run('setActive("frog")');
expect("개굴이로 바꾸면 화면이 개굴이 것", [p.screen(), p.msg()], ["🐸 개굴이 Lv6 3 / 60 🪙0", "개굴이 키우기 시작!"]);
p.tap(2);
p.run('setActive("starter")');
expect("1호로 돌아가면 1호 레벨 그대로", p.screen(), "🐊 악어왕 Lv12 40 / 120 🪙2");
expect("개굴이 경험치는 따로 쌓임", p.saved().monsters.frog.exp, 5);
p.run('setActive("whale")');
expect("안 가진 몬스터는 못 고름", p.look(), "🐊 악어왕");
expect("새로고침해도 키우는 몬스터 유지", (p.run('setActive("frog")'), openPage().look()), "🐸 개굴이");

section("뽑기: 새 몬스터 / 중복 = 경험치 +50");
setSave(v2("starter", { starter: card(3) }, 500));
p = openPage();
p.forceRandom([0.8, 0.0]); // 레어 첫 번째 = fox
p.eggFull();
expect("새 몬스터 → Lv1 카드, 100코인 차감, NEW", [p.saved().monsters.fox.level, p.coins(), p.els["gacha-new"].hidden, p.els["gacha-monster"].textContent, p.els["gacha-name"].textContent], [1, "400", false, "🐾", "꼬마발"]);
expect("결과 카드: 키우기 버튼 보임, 안내", [p.els["gacha-use-btn"].hidden, p.els["gacha-note"].textContent], [false, "새 몬스터가 도감에 등록됐어요!"]);
p.closeGacha();
p.forceRandom([0.8, 0.0]);
p.eggFull();
expect("중복 → 코인 환급 없음, 횟수 2, Lv1 + 경험치 50 → Lv3 20 (10+20 쓰고 20 남음)", [p.coins(), p.saved().monsters.fox.count, p.saved().monsters.fox.level, p.saved().monsters.fox.exp], ["300", 2, 3, 20]);
expect("중복 안내: 경험치·레벨 변화", p.els["gacha-note"].textContent, "이미 가진 몬스터예요. 경험치 +50! (Lv1 → Lv3)");
expect("중복이어도 키우기 버튼 보임 (키우는 중이 아니니까)", p.els["gacha-use-btn"].hidden, false);
p.useDrawn();
expect("이 몬스터 키우기 → 화면이 fox", p.screen(), "🐾 꼬마발 Lv3 20 / 30 🪙300");
p.forceRandom([0.8, 0.0]);
p.eggFull();
expect("키우는 중인 몬스터가 중복 → 버튼 숨김", p.els["gacha-use-btn"].hidden, true);
p.closeGacha();
// 중복으로 진화
setSave(v2("starter", { starter: card(1), frog: card(4, 39) }, 100));
p = openPage();
p.forceRandom([0.1, 0.0]); // frog
p.eggFull();
expect("중복 경험치로 진화 → 결과 카드에 진화 모습·안내", [p.els["gacha-monster"].textContent, p.els["gacha-name"].textContent, p.els["gacha-note"].textContent], ["🐸", "개굴이", "이미 가진 몬스터예요. 경험치 +50! (Lv4 → Lv5) ✨ 개굴이로 진화!"]);
expect("화면(1호)은 그대로", p.look(), "🐣 꼬물이");
setSave(v2("starter", { starter: card(1), frog: card(20, 0) }, 100));
p = openPage(); p.forceRandom([0.1, 0.0]); p.eggFull();
expect("레벨업 안 할 만큼만 받으면 레벨 표시 없이", p.els["gacha-note"].textContent, "이미 가진 몬스터예요. 경험치 +50!");
setSave(v2("starter", { starter: card(1) }, 99));
p = openPage();
p.egg();
expect("99코인 → 뽑기 불가", [p.coins(), p.els["gacha-popup"].hidden, p.els["egg-btn"].disabled], ["99", true, true]);

section("개발용·초기화");
setSave(v2("whale", { starter: card(12), whale: card(2) }, 50));
p = openPage();
p.plusExp();
expect("+100은 키우는 몬스터에게", [p.saved().monsters.whale.level, p.saved().monsters.starter.level], [5, 12]);
p.reset();
expect("초기화 → 1호 Lv1만, 0코인", [p.screen(), Object.keys(JSON.parse(JSON.stringify(p.run("state.monsters"))))], ["🐣 꼬물이 Lv1 0 / 10 🪙0", ["starter"]]);

section("켜 놓고 가만히 vs 다른 앱");
setSave(v2("starter", { starter: card(5) }));
p = openPage();
for (let i = 0; i < 360; i++) { env.now += 10 * 1000; p.tick(); }
expect("켜 놓고 1시간 → 보상 없음", openPage().coins(), "0");
p = openPage(); p.hide(); env.now += HOUR; p.show();
expect("다른 앱 1시간 → 60 × 5", p.popup(), "팝업 300");

done();
