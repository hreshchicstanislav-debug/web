// Service Worker для PWA
const CACHE_NAME = 'timetrack-v1';
// Получаем базовый путь (для GitHub Pages может быть /repo-name/)
const BASE_PATH = self.location.pathname.replace(/\/service-worker\.js$/, '') || '/';
const urlsToCache = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}app.js`,
  `${BASE_PATH}manifest.webmanifest`,
  `${BASE_PATH}icon-192.png`,
  `${BASE_PATH}icon-512.png`
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Кэш открыт');
        return cache.addAll(urlsToCache);
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Возвращаем из кэша, если есть, иначе загружаем из сети
        return response || fetch(event.request);
      })
  );
});

