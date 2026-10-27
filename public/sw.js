/**
 * public/sw.js
 * Minimalny, odporny Service Worker dla CyberEvolution.
 * Używa strategii Network-First: pobiera zawsze najświeższe pliki z serwera,
 * a w razie braku sieci sięga do pamięci podręcznej (offline support).
 */

const CACHE_NAME = 'cyberevolution-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Ignorujemy zapytania o schemacie innym niż http/https (np. chrome-extension:)
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Klonujemy odpowiedź sieciową do pamięci podręcznej w tle
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback offline z cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Brak połączenia z siecią.', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
