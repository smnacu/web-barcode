/**
 * Service Worker - Caché básico para PWA
 * Versión simplificada para compatibilidad Android 11
 */

var CACHE_NAME = 'barcodeC-v2';

// Solo archivos esenciales que existen
var urlsToCache = [
    './',
    './index.html',
    './admin.html',
    './manifest.json',
    './css/styles.css',
    './app.js',
    './libs/html5-qrcode.min.js',
    '../img/logo_bw.png'
];

// Instalación
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            // Intentar cachear pero no fallar si alguno no existe
            return Promise.all(
                urlsToCache.map(function (url) {
                    return cache.add(url).catch(function (err) {
                        console.warn('No se pudo cachear:', url);
                    });
                })
            );
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

// Activación - limpiar cachés viejos
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames.filter(function (cacheName) {
                    return cacheName !== CACHE_NAME;
                }).map(function (cacheName) {
                    return caches.delete(cacheName);
                })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

// Fetch - Network first para API, cache first para assets
self.addEventListener('fetch', function (event) {
    var request = event.request;

    // Solo GET
    if (request.method !== 'GET') return;

    // APIs siempre desde red
    if (request.url.indexOf('/api/') !== -1) {
        event.respondWith(
            fetch(request).catch(function () {
                return new Response(JSON.stringify({ error: true, mensaje: 'Sin conexión' }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // Assets: cache first, luego red
    event.respondWith(
        caches.match(request).then(function (response) {
            if (response) return response;

            return fetch(request).then(function (response) {
                // No cachear respuestas fallidas
                if (!response || response.status !== 200) {
                    return response;
                }

                var responseToCache = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(request, responseToCache);
                });

                return response;
            });
        })
    );
});
