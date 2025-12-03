// ============================================================================
// VARIABLES GLOBALES Y CONSTANTES
// ============================================================================

let html5QrcodeScanner = null;
let isProcessing = false;
let currentFacingMode = "user"; // Arranca con la frontal (Selfie)

// Control de deduplicación de escaneos
let lastScannedEAN = null;
let lastScanTime = 0;
const SCAN_COOLDOWN_MS = 3000; // 3 segundos entre escaneos iguales

// Persistencia en Storage
const STORAGE_KEY = 'barcodeC_history';
const MAX_HISTORY_ITEMS = 30;

// Sonido "Beep" corto y profesional
const beep = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU');

// ============================================================================
// UTILIDADES DE STORAGE
// ============================================================================

/**
 * Cargar historial desde localStorage
 */
function loadHistoryFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.warn('⚠️ LocalStorage no disponible:', e.message);
        return [];
    }
}

/**
 * Guardar historial en localStorage
 */
function saveHistoryToStorage(items) {
    try {
        // Mantener máximo 30 items
        const limited = items.slice(0, MAX_HISTORY_ITEMS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
    } catch (e) {
        console.error('❌ Error guardando historial:', e.message);
    }
}

/**
 * Limpiar historial completamente
 */
function clearHistory() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        document.getElementById('history-list').innerHTML = '';
    } catch (e) {
        console.warn('Error limpiando storage:', e.message);
    }
}

/**
 * Asegurar compatibilidad con Android 11+
 */
function ensureAndroidCompatibility() {
    // Fix viewport para tablets
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.setAttribute('content', 
            'width=device-width, initial-scale=1.0, maximum-scale=1.0, ' +
            'user-scalable=no, viewport-fit=cover'
        );
    }

    // Prevenir zoom accidental en inputs
    document.addEventListener('touchstart', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            e.preventDefault();
        }
    }, { passive: false });

    // Deshabilitar pull-to-refresh en Android
    document.body.addEventListener('touchmove', (e) => {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando aplicación...');
    
    // Asegurar compatibilidad
    ensureAndroidCompatibility();
    
    // Registrar Service Worker para PWA offline
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('✅ Service Worker registrado:', reg.scope))
            .catch(err => console.warn('⚠️ Error registrando SW:', err.message));
    }
    
    // Detectar si se ejecuta como PWA
    if (window.navigator.standalone === true) {
        console.log('📱 Ejecutándose como PWA instalada');
    }
    
    // Cargar historial guardado
    const stored = loadHistoryFromStorage();
    const historyList = document.getElementById('history-list');
    
    stored.forEach(item => {
        renderHistoryItem(historyList, item.ean, item.desc, item.url, item.success);
    });
    
    // Intentar pedir permiso y arrancar scanner automáticamente
    requestCameraPermission();
});

/**
 * Request camera permission explicitly to trigger browser prompt
 * and then start the scanner if permission is granted.
 */
async function requestCameraPermission() {
    const startScreen = document.getElementById('start-screen');
    const errorMsg = document.getElementById('error-msg');

    // Ocultar mensaje de error por defecto
    if (errorMsg) errorMsg.classList.add('hidden');

    // Algunos navegadores requieren un gesto del usuario para abrir permisos.
    // Usamos Permissions API cuando esté disponible para detectar el estado
    // y minimizar llamadas fallidas a getUserMedia.
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('🔒 getUserMedia no disponible en este navegador');
        if (startScreen) startScreen.classList.remove('hidden');
        if (errorMsg) {
            errorMsg.innerText = '❌ Tu navegador no soporta acceso a cámara';
            errorMsg.classList.remove('hidden');
        }
        return;
    }
    try {
        // Si Permissions API está disponible, pedir estado primero
        if (navigator.permissions && navigator.permissions.query) {
            try {
                const res = await navigator.permissions.query({ name: 'camera' });
                console.log('📍 Permissions API status:', res.state);
                if (res.state === 'denied') {
                    // Usuario negó la cámara previamente
                    if (startScreen) startScreen.classList.remove('hidden');
                    if (errorMsg) {
                        errorMsg.innerText = 'Permiso de cámara negado. Habilítalo en los ajustes.';
                        errorMsg.classList.remove('hidden');
                    }
                    return;
                }
                // Si state es 'prompt' o 'granted', intentamos getUserMedia
            } catch (permErr) {
                // Algunos navegadores pueden fallar al consultar 'camera' — ignorar
                console.debug('Permissions API camera query falló:', permErr && permErr.message);
            }
        }

        console.log('🎯 Intentando getUserMedia con constraints:', { video: { facingMode: currentFacingMode } });
        const constraints = { video: { facingMode: currentFacingMode } };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Permiso concedido: detener stream temporal y arrancar scanner
        stream.getTracks().forEach(t => t.stop());
        console.log('✅ Permiso de cámara concedido. Iniciando scanner...');

        if (startScreen) startScreen.classList.add('hidden');

        // Arrancar scanner (Html5Qrcode solicitará de nuevo acceso si fuese necesario)
        await startScanner();

    } catch (err) {
        console.warn('⚠️ Error en requestCameraPermission:', {
            name: err && err.name,
            message: err && err.message,
            code: err && err.code
        });
        if (startScreen) startScreen.classList.remove('hidden');
        if (errorMsg) {
            let msg = 'No se pudo acceder a la cámara.';
            if (err && err.name === 'NotAllowedError') msg = 'Permiso denegado. Habilita la cámara en los ajustes del navegador.';
            else if (err && err.name === 'NotFoundError') msg = 'No se encontró cámara en este dispositivo.';
            else if (err && err.name === 'AbortError') msg = 'Solicitando permiso fue abortado.';
            else if (err && err.message) msg = `Error: ${err.message}`;
            errorMsg.innerText = msg;
            errorMsg.classList.remove('hidden');
        }
    }
}

async function startScanner() {
    const startScreen = document.getElementById('start-screen');
    const scannerContainer = document.getElementById('scanner-container');
    const errorMsg = document.getElementById('error-msg');
    const statusBadge = document.getElementById('scan-status');

    errorMsg.classList.add('hidden');
    
    // Si ya existe instancia, matar para reiniciar (útil para rotar cámara)
    if (html5QrcodeScanner) {
        try { 
            await html5QrcodeScanner.stop(); 
            html5QrcodeScanner.clear(); 
        } catch (e) {
            console.warn('⚠️ Error limpiando scanner anterior:', e.message);
        }
    }

    try {
        startScreen.classList.add('hidden');
        scannerContainer.classList.remove('hidden');

        html5QrcodeScanner = new Html5Qrcode("reader");

        const config = { 
            fps: 15,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0,
            disableFlip: false,
            formatsToSupport: [
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8
            ]
        };

        let triedSimple = false;

        async function tryStart(constraints) {
            const startPromise = html5QrcodeScanner.start(
                constraints,
                config,
                onScanSuccess,
                onScanFailure
            );

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout iniciando cámara (10s)')), 10000)
            );

            return Promise.race([startPromise, timeoutPromise]);
        }

        // Primero intentar con facingMode ideal
        try {
            console.log('🎬 Intento 1: Constraints con facingMode ideal:', currentFacingMode);
            const constraints = { facingMode: { ideal: currentFacingMode } };
            await tryStart(constraints);
            console.log('✅ Scanner iniciado exitosamente');
        } catch (firstErr) {
            console.warn('⚠️ Intento 1 falló. Detalle:', firstErr && firstErr.message);
            // Intentar fallback simple { video: true } una sola vez
            triedSimple = true;
            try {
                console.log('🎬 Intento 2: Fallback con { video: true }');
                await tryStart({ video: true });
                console.log('✅ Scanner iniciado en fallback');
            } catch (secondErr) {
                // Re-lanzar el error original para manejo final
                console.error('❌ Intento 2 también falló');
                throw secondErr || firstErr;
            }
        }

        statusBadge.innerHTML = '<span class="w-2 h-2 bg-black rounded-full animate-pulse"></span> ACTIVO';
        statusBadge.className = "bg-green-500/90 text-black text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1";

    } catch (err) {
        console.error("❌ Error iniciando cámara:", err);
        scannerContainer.classList.add('hidden');
        startScreen.classList.remove('hidden');
        
        // Log detallado para debugging
        const errDetail = {
            name: err && err.name || 'unknown',
            message: err && err.message || 'no message',
            code: err && err.code || 'no code',
            toString: err && err.toString && err.toString()
        };
        console.error('📋 Detalle completo del error:', errDetail);
        
        let msg = 'Error desconocido.';
        
        if (err && (err.name === 'NotAllowedError' || (err.message && err.message.toLowerCase().includes('permission')))) {
            msg = '🔐 Permiso denegado. Habilita cámara en ajustes del navegador.';
        } else if (err && (err.name === 'NotFoundError' || (err.message && err.message.toLowerCase().includes('device')))) {
            msg = '📷 No se encontró cámara en este dispositivo.';
        } else if (err && err.name === 'NotReadableError') {
            msg = '⚠️ Cámara en uso. Cierra otras apps que la usen.';
        } else if (err && err.message && err.message.toLowerCase().includes('timeout')) {
            msg = '⏱️ Timeout: cámara tardó demasiado en iniciar.';
        } else if (err && err.message && err.message.toLowerCase().includes('https')) {
            msg = '🔒 Se requiere HTTPS o localhost para cámara.';
        } else if (err && err.message) {
            msg = `❌ Error: ${err.message}`;
        } else if (errDetail.name && errDetail.name !== 'unknown') {
            msg = `❌ Error (${errDetail.name})`;
        }
        
        errorMsg.innerText = msg;
        errorMsg.classList.remove('hidden');
        
        // Actualizar scan-log con error para visibilidad rápida
        updateScanLog(msg);
    }
}

async function switchCamera() {
    // Feedback visual en el botón
    const btnIcon = document.querySelector('button[onclick="switchCamera()"] i');
    btnIcon.classList.add('animate-spin');
    setTimeout(() => btnIcon.classList.remove('animate-spin'), 500);

    currentFacingMode = (currentFacingMode === "user") ? "environment" : "user";
    await startScanner();
}

async function onScanSuccess(decodedText, decodedResult) {
    // Deduplicación: Si es el mismo EAN en menos de 3s, ignorar
    const now = Date.now();
    if (decodedText === lastScannedEAN && (now - lastScanTime) < SCAN_COOLDOWN_MS) {
        console.log('⏸️ Escaneo duplicado ignorado:', decodedText);
        return;
    }

    if (isProcessing) return;
    isProcessing = true;

    lastScannedEAN = decodedText;
    lastScanTime = now;

    // Feedback inmediato
    beep.play().catch(e => console.log('🔇 Audio bloqueado en este dispositivo'));
    
    // Cambiar estado visualmente
    const statusBadge = document.getElementById('scan-status');
    statusBadge.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> PROCESANDO';
    statusBadge.className = "bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1";

    try {
        const response = await fetch(`api/buscar.php?ean=${encodeURIComponent(decodedText)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();

        if (data.found) {
            handleFound(data);
        } else {
            handleNotFound(decodedText);
        }
    } catch (error) {
        console.error('❌ Error en búsqueda:', error);
        addToHistory(decodedText, `Error de Red: ${error.message}`, null, false);
    } finally {
        // Pausa para no escanear lo mismo múltiples veces
        setTimeout(() => { 
            isProcessing = false;
            // Restaurar estado
            const statusBadge = document.getElementById('scan-status');
            statusBadge.innerHTML = '<span class="w-2 h-2 bg-black rounded-full animate-pulse"></span> ACTIVO';
            statusBadge.className = "bg-green-500/90 text-black text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1";
        }, SCAN_COOLDOWN_MS);
    }
}

function onScanFailure(error) {
    // Nada, ruido de fondo
}

function handleFound(data) {
    // Construir la URL completa del PDF
    const fullUrl = data.pdf_base_url + data.pdf_name + '.pdf';
    
    // Agregar al historial (ÉXITO)
    addToHistory(data.ean, data.descripcion, fullUrl, true);

    // Log para debugging (servidor local = sin validación)
    console.log('📄 PDF enlazado (confíe en el enlace del historial):', {
        ean: data.ean,
        url: fullUrl,
        timestamp: new Date().toISOString()
    });

    // Intentar abrir en nueva pestaña
    // Nota: Como es servidor local, no hay validación si se abre o no
    const win = window.open(fullUrl, '_blank');
    if (!win || win.closed) {
        console.log('ℹ️ Popup no se abrió. PDF disponible en historial.');
    }
    // Actualizar log visual en header
    updateScanLog(`OK · ${data.ean} · ${data.descripcion}`);
}

function handleNotFound(ean) {
    addToHistory(ean, '❌ No encontrado en base de datos', null, false);
    console.log('⚠️ EAN no encontrado:', ean);
    updateScanLog(`NO · ${ean} · No encontrado`);
}

/**
 * Actualiza el log visible en el header (`#scan-log`) con mensaje y timestamp
 */
function updateScanLog(message) {
    try {
        const el = document.getElementById('scan-log');
        if (!el) return;
        const now = new Date();
        const ts = now.toLocaleTimeString();
        el.innerText = `${ts} — ${message}`;
    } catch (e) {
        console.warn('updateScanLog error', e);
    }
}

function renderHistoryItem(list, ean, desc, url, success) {
    const item = document.createElement('div');
    
    item.className = "history-item bg-gray-800 rounded-lg p-3 flex justify-between items-center border border-gray-700 shadow-sm relative overflow-hidden group";
    
    const colorClass = success ? "bg-green-500" : "bg-red-500";
    
    let actionButton = '';
    if (success && url) {
        actionButton = `
            <a href="${url}" target="_blank" class="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-bold text-xs transition-colors shadow-lg z-10" onclick="handlePdfClick('${ean}', '${url}'); return true;">
                <span>ABRIR</span>
                <i class="ph-bold ph-arrow-square-out text-lg"></i>
            </a>
        `;
    } else {
        actionButton = `<span class="text-gray-600 text-xs font-mono px-2">---</span>`;
    }

    item.innerHTML = `
        <div class="absolute left-0 top-0 bottom-0 w-1 ${colorClass}"></div>
        
        <div class="flex flex-col overflow-hidden mr-3 pl-2">
            <span class="text-[10px] text-gray-400 font-mono tracking-wider uppercase mb-0.5">EAN: ${ean}</span>
            <span class="text-sm font-medium text-gray-100 truncate leading-tight" title="${desc}">${desc}</span>
        </div>
        
        <div class="shrink-0">
            ${actionButton}
        </div>
    `;

    list.insertBefore(item, list.firstChild);
}

function addToHistory(ean, desc, url, success) {
    const list = document.getElementById('history-list');
    
    // Renderizar en UI
    renderHistoryItem(list, ean, desc, url, success);
    
    // Guardar en localStorage
    const newItem = {
        ean,
        desc,
        url,
        success,
        timestamp: new Date().toISOString()
    };
    
    const existing = loadHistoryFromStorage();
    const updated = [newItem, ...existing];
    saveHistoryToStorage(updated);
    
    // Limpiar UI (máx 30 items)
    while (list.children.length > MAX_HISTORY_ITEMS) {
        list.removeChild(list.lastChild);
    }
}

/**
 * Callback cuando se abre un PDF desde el historial
 * Como es servidor local, no hay forma de validar si se abrió
 */
function handlePdfClick(ean, url) {
    console.log('🔗 Abriendo PDF (servidor local - sin validación):', {
        ean,
        url,
        timestamp: new Date().toISOString(),
        note: 'El navegador abrirá el PDF en nueva pestaña'
    });
}