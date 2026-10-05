// ===== 서비스 워커 (창고지기) =====
// 게임 파일을 폰 안의 창고(캐시)에 보관해 두고, 인터넷이 끊기면 창고에서 꺼내 줌
// 방식: "인터넷이 되면 항상 새 파일부터, 안 되면 창고 것" (네트워크 우선)
// → 게임을 고쳐서 올리면, 인터넷이 되는 상태로 앱을 열 때 새 버전이 보임

// 창고 이름 (창고 구조를 크게 바꿀 때만 숫자를 올리면 됨. 게임 버전은 data.js의 APP_VERSION)
const CACHE_NAME = "monster-idle-v1";

// 처음 설치할 때 미리 창고에 넣어 둘 파일들 (게임에 파일을 추가하면 여기에도 적기!)
const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./game.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

// ① 설치: 게임 파일을 전부 창고에 넣기
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_FILES);
    })
  );
  self.skipWaiting(); // 새 창고지기가 기다리지 않고 바로 일을 시작하게
});

// ② 일 시작: 이름이 다른 옛날 창고는 치우기
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (name) {
            return name !== CACHE_NAME;
          })
          .map(function (name) {
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim(); // 이미 열려 있는 게임 화면도 바로 맡기
});

// ③ 파일 요청이 올 때마다: 인터넷에서 먼저 받아 보고, 실패하면 창고에서 꺼내 줌
self.addEventListener("fetch", function (event) {
  const request = event.request;

  // 우리 게임 주소의 파일 읽기(GET)만 맡음 (다른 사이트 요청은 건드리지 않음)
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request, { cache: "no-cache" }) // 브라우저가 기억해 둔 옛 파일 말고 서버에 새로 확인
      .then(function (response) {
        // 받아 온 새 파일은 창고에도 복사해 둠 (다음에 인터넷이 끊겼을 때 쓰려고)
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      })
      .catch(function () {
        // 인터넷이 안 됨 → 창고에서 찾기 (주소 뒤에 ?가 붙어도 같은 파일로 봄)
        return caches.match(request, { ignoreSearch: true });
      })
  );
});
