// 뽑기 확률 + 도감 테스트
const { env, openPage, expect, section, done, setSave } = require("./harness");

const T0 = 1_800_000_000_000;
env.now = T0;

section("1만 번 뽑기 (1호는 절대 안 나옴)");
env.store = {};
let p = openPage();
const N = 10000;
const counts = { starter: 0, common: 0, rare: 0, legend: 0 };
const per = {};
for (let i = 0; i < N; i++) {
  const m = p.run("drawMonster()");
  counts[m.rarity]++;
  per[m.id] = (per[m.id] || 0) + 1;
}
expect("1호가 나온 횟수", counts.starter, 0);
const table = { common: 0.7, rare: 0.25, legend: 0.05 };
for (const [id, prob] of Object.entries(table)) {
  const got = counts[id] / N;
  const allowed = 3 * Math.sqrt((prob * (1 - prob)) / N);
  const ok = Math.abs(got - prob) <= allowed;
  expect(`${id} ${(got * 100).toFixed(2)}% (목표 ${prob * 100}% ± ${(allowed * 100).toFixed(2)}%)`, ok, true);
}
const monsters = p.run("MONSTERS").filter((m) => m.rarity !== "starter");
for (const m of monsters) {
  const same = monsters.filter((x) => x.rarity === m.rarity).length;
  const prob = table[m.rarity] / same;
  const got = (per[m.id] || 0) / N;
  const allowed = 3.5 * Math.sqrt((prob * (1 - prob)) / N);
  expect(`  ${m.id} ${(got * 100).toFixed(2)}% (목표 ${(prob * 100).toFixed(2)}%)`, Math.abs(got - prob) <= allowed, true);
}
for (const [roll, want] of [[0, "common"], [0.6999, "common"], [0.7, "rare"], [0.9499, "rare"], [0.95, "legend"], [0.99999, "legend"]]) {
  expect(`다트 경계 ${roll}`, p.run(`pickRarity(${roll}).id`), want);
}

section("진화표 모양 검사 (data.js)");
const all = p.run("MONSTERS");
const wantLevels = { starter: [1, 5, 10, 20], common: [1, 5, 10], rare: [1, 8, 15], legend: [1, 10, 20, 30] };
for (const m of all) {
  expect(`${m.id} 단계 레벨`, m.stages.map((s) => s.minLevel), wantLevels[m.rarity]);
}
const emojis = all.flatMap((m) => m.stages.map((s) => s.emoji));
expect("모든 단계 이모지가 서로 다름", new Set(emojis).size, emojis.length);
expect("뽑기 몬스터 수 (일반 5, 레어 3, 전설 2)", ["common", "rare", "legend"].map((r) => all.filter((m) => m.rarity === r).length), [5, 3, 2]);

section("도감 화면");
const card = (level, extra = {}) => ({ level, exp: 0, firstAt: T0, count: 1, ...extra });
setSave({ version: 2, coins: 0, lastSeen: T0, activeId: "frog", monsters: {
  starter: card(12, { firstAt: null }),
  frog: card(6, { count: 3 }),
  mouse: card(1),
  fox: card(1, { firstAt: null, legacy: true, count: 2 }),
  whale: card(31),
} });
p = openPage();
p.openDex();
expect("수집률 (1호 제외)", [p.els["dex-total"].textContent, p.els["dex-rarity-summary"].textContent], ["4 / 10 (40%)", "일반 2/5 · 레어 1/3 · 전설 1/2"]);
expect("칸: 현재 모습·이름·Lv, 키우는 중 ★, 못 모은 건 Lv1 실루엣", p.dexView(), [
  "1호: 🐊 악어왕 Lv12",
  "일반: 🐸 개굴이 Lv6★, 🐚 ???(실루엣), 🐭 찍찍이 Lv1, 🐰 ???(실루엣), 🪨 ???(실루엣)",
  "레어: 🐾 꼬마발 Lv1, 🪶 ???(실루엣), 💧 ???(실루엣)",
  "전설: 🐴 ???(실루엣), 🐳 바다왕 Lv31",
]);

section("상세 창 + 진화 트리");
p.dexItem(1, 0).onclick();
expect("개굴이 Lv6: 본 단계 2개, 못 본 단계 ???", p.detail(), {
  emoji: "🐸", name: "개굴이", rarity: "등급: 일반", level: "Lv6",
  first: "2027년 1월 15일", count: "3번",
  tree: "🫧 퐁당이 Lv1 → 🐸 개굴이 Lv5◀ → ❔ ??? Lv10",
  unknown: false, useBtn: false, current: true,
});
p.detailBack();
p.dexItem(0, 0).onclick();
expect("1호 상세", p.detail(), {
  emoji: "🐊", name: "악어왕", rarity: "등급: 1호", level: "Lv12",
  first: "처음부터 함께했어요", count: "뽑기로 얻지 않음",
  tree: "🐣 꼬물이 Lv1 → 🦎 도마돌이 Lv5 → 🐊 악어왕 Lv10◀ → ❔ ??? Lv20",
  unknown: false, useBtn: true, current: false,
});
p.detailBack();
p.dexItem(2, 0).onclick();
expect("예전에 얻은 fox (legacy)", [p.detail().first, p.detail().count, p.detail().tree], ["도감 기능 전에 얻음", "2번 이상", "🐾 꼬마발 Lv1◀ → ❔ ??? Lv8 → ❔ ??? Lv15"]);
p.detailBack();
p.dexItem(3, 1).onclick();
expect("바다왕 Lv31: 4단계 모두 봄", p.detail().tree, "🐟 피라미 Lv1 → 🐬 돌핀이 Lv10 → 🐋 큰고래 Lv20 → 🐳 바다왕 Lv30◀");
p.detailBack();
p.dexItem(3, 0).onclick();
expect("못 모은 별빛뿔(unicorn)", p.detail(), {
  emoji: "🐴(실루엣)", name: "???", rarity: "등급: 전설", level: "-", first: "-", count: "-", tree: "-",
  unknown: true, useBtn: false, current: false,
});
p.detailBack();
p.dexItem(1, 2).onclick();
expect("못 모은 것 본 다음 가진 것 → 실루엣 풀림", p.detail().emoji, "🐭");

section("도감에서 키울 몬스터 바꾸기");
p.detailUse(); // 찍찍이
expect("상세 닫히고 도감 ★ 이동, 화면 바뀜", [p.els["detail-popup"].hidden, p.els["dex-popup"].hidden, p.dexView()[1], p.screen()], [
  true, false, "일반: 🐸 개굴이 Lv6, 🐚 ???(실루엣), 🐭 찍찍이 Lv1★, 🐰 ???(실루엣), 🪨 ???(실루엣)", "🐭 찍찍이 Lv1 0 / 10 🪙0",
]);
p.dexItem(0, 0).onclick(); p.detailUse();
expect("1호로 돌아가기", [p.look(), p.saved().activeId, p.dexView()[0]], ["🐊 악어왕", "starter", "1호: 🐊 악어왕 Lv12★"]);

section("뽑으면 도감에 바로 반영");
p.run("state.coins = 100");
p.forceRandom([0.96, 0.1]); // unicorn
p.eggFull(); p.closeGacha();
p.openDex();
expect("별빛뿔 라인 Lv1 등장", [p.dexView()[3], p.els["dex-total"].textContent], ["전설: 🐴 망아지 Lv1, 🐳 바다왕 Lv31", "5 / 10 (50%)"]);

done();
