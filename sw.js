// Service Worker para Portal Apoderados - Escuela Villa Las Peñas
const CACHE_NAME = 'villa-las-penas-apoderados-v5';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css?v=4',
  './js/app.js?v=4',
  './manifest.json',
  './assets/insignia.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Cache addAll warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network first, fallback to cache for static assets, network only for API
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('supabase.co')) {
    // Permitir que el navegador maneje las peticiones a Supabase directamente
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Guardar copia en cache si es estático válido
        if (response.status === 200 && event.request.method === 'GET') {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Notificaciones Push Web ──────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'Escuela Villa Las Peñas';
  const options = {
    body: data.body || 'Aviso importante de inspectoría',
    icon: './assets/insignia.png',
    badge: './assets/insignia.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || './'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('portal-apoderados-vlp') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
