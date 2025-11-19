const CACHE_NAME = "daruma-app-v2";
const urlsToCache = [
  "../",
  "../index.html",
  "../settings.php",
  "../css/styles.css",
  "../js/scanner.js",
  "../js/libs/html5-qrcode.min.js",
  "../js/libs/pdf.min.js",
  "../js/libs/pdf.worker.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(urlsToCache)));
});

self.addEventListener("fetch", (event) => {
  if (
    event.request.url.includes("api/") ||
    event.request.url.includes("settings.php")
  ) {
    event.respondWith(fetch(event.request));
  } else {
    event.respondWith(
      caches.match(event.request).then((r) => r || fetch(event.request))
    );
  }
});
