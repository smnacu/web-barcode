// ============================================================================
// CONFIGURACIÓN Y VARIABLES
// ============================================================================
let html5QrcodeScanner = null;
let isProcessing = false;
let currentFacingMode = "environment"; // Default: Trasera
let lastScannedEAN = null;
let lastScanTime = 0;
const SCAN_COOLDOWN_MS = 3000;
const STORAGE_KEY = 'barcodeC_history';
const MAX_HISTORY_ITEMS = 30;
const beep = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU');

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    ensureAndroidCompatibility();
    loadHistory();
    startScanner(); // Auto-start
});

function ensureAndroidCompatibility() {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    }
}

// ============================================================================
// LÓGICA DEL ESCÁNER
// ============================================================================
async function startScanner() {
    const errorMsg = document.getElementById('error-msg');
    if (errorMsg) errorMsg.classList.add('hidden');

    if (html5QrcodeScanner) {
        try { await html5QrcodeScanner.stop(); html5QrcodeScanner.clear(); } catch (e) { }
        html5QrcodeScanner = null;
    }

    try {
        const reader = document.getElementById('reader');
        if (reader) reader.innerHTML = '';

        html5QrcodeScanner = new Html5Qrcode("reader");

        // Configuración optimizada para rendimiento
        const config = {
            fps: 10, // Reducido para mejorar rendimiento
            qrbox: { width: 200, height: 200 }, // Caja más pequeña
            aspectRatio: 1.0,
            disableFlip: false,
            formatsToSupport: [
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.EAN_13
            ]
        };

        const constraints = {
            facingMode: currentFacingMode,
            width: { ideal: 640 }, // Limitar resolución
            height: { ideal: 480 }
        };

        try {
            await html5QrcodeScanner.start(constraints, config, onScanSuccess, () => { });
        } catch (err) {
            console.warn('Fallback video mode');
            await html5QrcodeScanner.start({ video: true }, config, onScanSuccess, () => { });
        }

    } catch (err) {
        console.error("Error cámara:", err);
        if (errorMsg) {
            errorMsg.innerText = 'Error: ' + (err.message || err);
            errorMsg.classList.remove('hidden');
        }
    }
}

async function switchCamera() {
    const btnIcon = document.querySelector('button[onclick="switchCamera()"] i');
    if (btnIcon) btnIcon.classList.add('animate-spin');
    currentFacingMode = (currentFacingMode === "user") ? "environment" : "user";
    await startScanner();
    if (btnIcon) setTimeout(() => btnIcon.classList.remove('animate-spin'), 500);
}

async function onScanSuccess(decodedText) {
    const now = Date.now();
    if (decodedText === lastScannedEAN && (now - lastScanTime) < SCAN_COOLDOWN_MS) return;
    if (isProcessing) return;

    isProcessing = true;
    lastScannedEAN = decodedText;
    lastScanTime = now;
    beep.play().catch(() => { });

    showStatus(true);

    try {
        const response = await fetch(`api/buscar.php?codigo=${encodeURIComponent(decodedText)}`);
        const data = await response.json();

        if (data.encontrado) {
            handleFound(data);
        } else {
            handleNotFound(decodedText);
        }
    } catch (error) {
        addToHistory(decodedText, `Error: ${error.message}`, null, false);
    } finally {
        setTimeout(() => {
            isProcessing = false;
            showStatus(false);
        }, SCAN_COOLDOWN_MS);
    }
}

function showStatus(processing) {
    const badge = document.getElementById('scan-status');
    if (!badge) return;
    if (processing) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function handleFound(data) {
    let fullUrl = data.pdf_url;
    if (!fullUrl && data.pdf) {
        fullUrl = data.pdf.startsWith('http') ? data.pdf : 'api/ver_pdf.php?file=' + encodeURIComponent(data.pdf);
    }
    const title = data.producto.descripcion || 'Producto encontrado';
    const code = data.producto.ean || data.producto.codigo;

    addToHistory(code, title, fullUrl, true);
    if (fullUrl) window.open(fullUrl, '_blank');
}

function handleNotFound(code) {
    addToHistory(code, 'No encontrado', null, false);
}

// ============================================================================
// HISTORIAL
// ============================================================================
function loadHistory() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const items = stored ? JSON.parse(stored) : [];
        const list = document.getElementById('history-list');
        if (list) {
            list.innerHTML = '';
            items.forEach(item => renderHistoryItem(list, item));
        }
    } catch (e) { }
}

function addToHistory(ean, desc, url, success) {
    const list = document.getElementById('history-list');
    if (!list) return;

    const newItem = { ean, desc, url, success, timestamp: new Date().toISOString() };
    renderHistoryItem(list, newItem, true);

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const existing = stored ? JSON.parse(stored) : [];
        const updated = [newItem, ...existing].slice(0, MAX_HISTORY_ITEMS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) { }
}

function renderHistoryItem(list, item, prepend = false) {
    const el = document.createElement('div');
    const colorClass = item.success ? "bg-green-500" : "bg-red-500";
    const actionBtn = (item.success && item.url) ?
        `<a href="${item.url}" target="_blank" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-lg flex items-center gap-1">ABRIR <i class="ph-bold ph-arrow-square-out"></i></a>` :
        ``;

    el.className = "bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 flex justify-between items-center relative overflow-hidden group";
    el.innerHTML = `
        <div class="absolute left-0 top-0 bottom-0 w-1 ${colorClass}"></div>
        <div class="flex flex-col pl-2 overflow-hidden mr-2">
            <span class="text-[10px] text-gray-500 font-mono uppercase">${item.ean}</span>
            <span class="text-xs font-medium text-gray-200 truncate">${item.desc}</span>
        </div>
        <div class="shrink-0">${actionBtn}</div>
    `;

    if (prepend) list.insertBefore(el, list.firstChild);
    else list.appendChild(el);
}

function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    const list = document.getElementById('history-list');
    if (list) list.innerHTML = '';
}

// ============================================================================
// BÚSQUEDA MANUAL
// ============================================================================
const searchInput = document.getElementById('manual-search');
const searchResults = document.getElementById('search-results');
const resultsList = document.getElementById('results-list');
let searchTimeout = null;

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(searchTimeout);

        if (query.length < 2) {
            closeSearch();
            return;
        }

        searchTimeout = setTimeout(() => performManualSearch(query), 400);
    });
}

function closeSearch() {
    if (searchResults) searchResults.classList.add('hidden');
}

async function performManualSearch(query) {
    try {
        const fd = new FormData();
        fd.append('codigo', query);
        fd.append('modo', 'lista');

        const res = await fetch('api/buscar.php', { method: 'POST', body: fd });
        const data = await res.json();
        renderSearchResults(data);
    } catch (err) {
        console.error(err);
    }
}

function renderSearchResults(data) {
    if (!resultsList) return;
    resultsList.innerHTML = '';

    if (!data.encontrado || !data.resultados || data.resultados.length === 0) {
        resultsList.innerHTML = '<div class="text-gray-500 text-xs text-center p-3">Sin resultados</div>';
        if (searchResults) searchResults.classList.remove('hidden');
        return;
    }

    data.resultados.forEach(item => {
        const el = document.createElement('div');
        el.className = 'p-3 border-b border-gray-800 hover:bg-white/5 cursor-pointer flex flex-col gap-0.5 transition-colors';
        el.innerHTML = `
            <div class="flex justify-between items-start">
                <span class="font-medium text-gray-200 text-xs">${item.descripcion}</span>
                <span class="text-[10px] bg-gray-800 text-gray-400 px-1.5 rounded border border-gray-700">${item.codigo}</span>
            </div>
            <span class="text-[10px] text-gray-500">EAN: ${item.ean}</span>
        `;
        el.onclick = () => {
            onScanSuccess(item.codigo);
            closeSearch();
            if (searchInput) searchInput.value = '';
        };
        resultsList.appendChild(el);
    });

    if (searchResults) searchResults.classList.remove('hidden');
}