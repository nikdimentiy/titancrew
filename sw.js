const CACHE = 'titan-crew-v10';

const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/variables.css',
    './css/base.css',
    './css/layout.css',
    './css/components.css',
    './css/auth.css',
    './css/tabs.css',
    './css/workout.css',
    './css/mobile.css',
    './js/app.js',
    './js/data/exercises.js',
    './js/data/storage.js',
    './js/modules/ui.js',
    './js/modules/widgets.js',
    './js/modules/form.js',
    './js/modules/history.js',
    './js/modules/metrics.js',
    './js/modules/auth.js',
    './js/modules/cardio.js',
    './js/modules/body.js',
    './js/modules/plan.js',
    './js/modules/workout.js',
    './favicon/favicon.ico',
    './favicon/favicon-32x32.png',
    './favicon/favicon-16x16.png',
    './favicon/apple-touch-icon.png',
    './favicon/android-chrome-192x192.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
];

// Stale-while-revalidate applies to HTML, JS, and CSS.
// Images and manifests use plain cache-first (they rarely change).
function isDynamic(url) {
    const p = url.pathname;
    return p.endsWith('.html') || p.endsWith('.js') || p.endsWith('.css') || p === '/';
}

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    // Only handle same-origin GETs; let Appwrite / CDN calls pass through.
    if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;

    const url = new URL(e.request.url);

    if (isDynamic(url)) {
        // Stale-while-revalidate: serve cached copy immediately,
        // fetch fresh copy in the background and update the cache.
        e.respondWith(
            caches.open(CACHE).then(cache =>
                cache.match(e.request).then(cached => {
                    const networkFetch = fetch(e.request)
                        .then(response => {
                            if (response && response.ok) {
                                cache.put(e.request, response.clone());
                            }
                            return response;
                        })
                        .catch(() => cached); // network down → stale is fine

                    // Return cached instantly; network fetch happens in background.
                    return cached || networkFetch;
                })
            )
        );
    } else {
        // Cache-first for images, icons, manifest.
        e.respondWith(
            caches.match(e.request).then(cached => cached || fetch(e.request))
        );
    }
});
