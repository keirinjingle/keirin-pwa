const CACHE_NAME = "keirin-cache-v1.55";

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        './',
        './index.html',
        './main.js?v=1.5',
        './manifest.json',
        './icon.png'
      ]);
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

// ✅ Push通知を受け取ったときの処理を追加
self.addEventListener('push', event => {
  console.log('[ServiceWorker] Push イベント受信');

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    console.warn('Push通知のデータがJSONでありません:', e);
  }

  const title = data.title || "通知";
  const options = {
    body: data.body || "通知本文がありません",
    icon: "./icon.png",
    badge: "./icon.png",
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});
