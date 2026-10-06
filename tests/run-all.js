// 테스트 전부 실행하기
// 사용법 (monster-idle 폴더에서): node tests/run-all.js
// 게임을 고친 뒤 이걸 돌려서 "예전 기능이 망가지지 않았나" 확인함
const { execFileSync } = require("child_process");
const path = require("path");

const TESTS = [
  "test-migrate.js", // 예전 저장 → 새 구조 옮기기
  "test-play.js",    // 탭·먹이·방치 보상·진화·뽑기 동작
  "test-dex.js",     // 1만 번 뽑기 확률·진화표·도감
];

let failedFiles = 0;
for (const file of TESTS) {
  try {
    const output = execFileSync(process.execPath, [path.join(__dirname, file)], { encoding: "utf8" });
    const summary = output.trim().split("\n").pop(); // 마지막 줄: "통과 N / 실패 0"
    console.log(`✅ ${file}: ${summary}`);
  } catch (error) {
    // 실패가 있으면 그 테스트의 실패 줄만 보여 줌
    failedFiles += 1;
    const output = String(error.stdout || "") + String(error.stderr || "");
    const failLines = output.split("\n").filter((line) => line.startsWith("FAIL") || line.includes("기대:") || line.includes("Error"));
    console.log(`❌ ${file}: ${output.trim().split("\n").pop()}`);
    for (const line of failLines) {
      console.log("   " + line.trim());
    }
  }
}

console.log(failedFiles === 0 ? "\n모든 테스트 통과 🎉" : `\n실패한 테스트 파일 ${failedFiles}개`);
process.exitCode = failedFiles === 0 ? 0 : 1;
