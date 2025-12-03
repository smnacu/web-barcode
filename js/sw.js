// ============================================================================
// SERVICE WORKER - Soporte offline y caché de PWA
// ============================================================================

const CACHE_NAME = 'barcodeC-v1';
const RUNTIME_CACHE = 'barcodeC-runtime-v1';

// URLs esenciales a cachear en instalación
const urlsToCache = [
    './',
    '../index.html',
    '../manifest.json',
    '../css/styles.css',
    '../js/app.js',
    '../js/libs/html5-qrcode.min.js',
    '../js/libs/pdf.min.js',
    '../js/libs/pdf.worker.min.js'
];

// ============================================================================
// EVENTO: INSTALL
// ============================================================================

self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker instalando...');
    
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache).catch(err => {
                console.warn('⚠️ Error cacheando URLs:', err);
            });
        }).then(() => {
            console.log('✅ Caché de instalación completado');
            return self.skipWaiting();
        })
    );
});

// ============================================================================
// EVENTO: ACTIVATE
// ============================================================================

self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker activando...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                        console.log('🗑️ Limpiando caché antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ Service Worker activo');
            return self.clients.claim();
        })
    );
});

// ============================================================================
// EVENTO: FETCH
// ============================================================================

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Solo GET
    if (request.method !== 'GET') {
        return;
    }

    // Excluir APIs - siempre red
    if (request.url.includes('/api/') || request.url.includes('settings.php')) {
        event.respondWith(fetch(request).catch(() => {
            // Si falla la red, intentar caché
            return caches.match(request);
        }));
        return;
    }

    // ===== CACHE FIRST: Assets estáticos
    event.respondWith(
        caches.match(request).then((response) => {
            if (response) {
                return response;
            }

            return fetch(request)
                .then((response) => {
                    if (!response || response.status !== 200) {
                        return response;
                    }

                    const responseToCache = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => {
                        cache.put(request, responseToCache);
                    });

                    return response;
                })
                .catch((err) => {
                    console.warn('❌ Offline:', url.pathname);
                    // Fallback a index.html si es documento
                    if (request.destination === 'document') {
                        return caches.match('../index.html');
                    }
                });
        })
    );
});

// ============================================================================
// MANEJO DE MENSAJES
// ============================================================================

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('✅ Service Worker listo');

