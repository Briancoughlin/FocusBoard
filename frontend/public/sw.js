const CACHE = 'focusboard-v2';

// On install — cache the app shell and offline recovery page
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(['/', '/index.html', '/offline.html'])
    )
  );
  self.skipWaiting();
});

// On activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, friendly recovery page if server is down
self.addEventListener('fetch', e => {
  // Skip API calls — always go to network
  if (e.request.url.includes('/api/')) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          // Cache successful navigation responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() =>
          // Server is down — show friendly recovery page
          caches.match('/offline.html')
            .then(cached => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
