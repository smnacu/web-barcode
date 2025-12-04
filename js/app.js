/**
 * app.js - Scanner de códigos de barras EAN-13
 * Optimizado para Android 11 de bajos recursos
 */

// ============================================================================
// CONFIGURACIÓN
// ============================================================================
var html5QrcodeScanner = null;
var isProcessing = false;
var isCameraBusy = false;
var currentFacingMode = "environment";
var lastScannedEAN = null;
var lastScanTime = 0;

var SCAN_COOLDOWN_MS = 3000;
var STORAGE_KEY = 'barcodeC_history';
var MAX_HISTORY_ITEMS = 30;

// Audio beep simple
var beep = null;
try {
    beep = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU');
} catch (e) { }

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', function () {
    loadHistory();
    // Pequeño delay para asegurar que el DOM esté listo
    setTimeout(function () {
        startScanner();
    }, 500);
});

// ============================================================================
// SCANNER
// ============================================================================
function startScanner() {
    if (isCameraBusy) {
        console.log('Camera busy, skipping start');
        return;
    }
    isCameraBusy = true;

    var errorMsg = document.getElementById('error-msg');
    if (errorMsg) errorMsg.classList.remove('visible');

    // Limpiar instancia previa
    var cleanup = Promise.resolve();
    if (html5QrcodeScanner) {
        cleanup = stopCurrentScanner();
    }

    cleanup.then(function () {
        return new Promise(function (resolve) { setTimeout(resolve, 300); });
    }).then(function () {
        var reader = document.getElementById('reader');
        if (reader) reader.innerHTML = '';

        html5QrcodeScanner = new Html5Qrcode("reader");

        // Config OPTIMIZADA para EAN-13 (códigos de barras)
        // qrbox ancho y bajo para capturar barras horizontales
        var config = {
            fps: 15,
            qrbox: { width: 300, height: 80 },
            aspectRatio: 1.777,
            disableFlip: true,
            formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39
            ]
        };

        // IMPORTANTE: Solo pasar facingMode
        return html5QrcodeScanner.start(
            { facingMode: currentFacingMode },
            config,
            onScanSuccess,
            function () { }
        ).catch(function (err) {
            console.warn('Trying fallback with environment facing mode', err);
            return html5QrcodeScanner.start(
                "environment",
                config,
                onScanSuccess,
                function () { }
            );
        }).catch(function (err) {
            console.warn('Trying fallback with user facing mode', err);
            return html5QrcodeScanner.start(
                "user",
                config,
                onScanSuccess,
                function () { }
            );
        });
    }).then(function () {
        console.log('Scanner started successfully');
        isCameraBusy = false;
    }).catch(function (err) {
        console.error("Error cámara:", err);
        isCameraBusy = false;
        if (errorMsg) {
            var msg = err.message || String(err);
            if (msg.indexOf('transition') === -1) {
                errorMsg.textContent = 'Cámara: ' + msg;
                errorMsg.classList.add('visible');
            }
        }
    });
}

function stopCurrentScanner() {
    return new Promise(function (resolve) {
        if (!html5QrcodeScanner) {
            resolve();
            return;
        }

        try {
            var state = html5QrcodeScanner.getState();
            if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
                html5QrcodeScanner.stop().then(function () {
                    try { html5QrcodeScanner.clear(); } catch (e) { }
                    html5QrcodeScanner = null;
                    resolve();
                }).catch(function (e) {
                    console.warn("Error stopping scanner:", e);
                    html5QrcodeScanner = null;
                    resolve();
                });
            } else {
                try { html5QrcodeScanner.clear(); } catch (e) { }
                html5QrcodeScanner = null;
                resolve();
            }
        } catch (e) {
            console.warn("Error in stopCurrentScanner:", e);
            html5QrcodeScanner = null;
            resolve();
        }
    });
}

function switchCamera() {
    if (isCameraBusy) return;
    currentFacingMode = (currentFacingMode === "user") ? "environment" : "user";
    startScanner();
}

function onScanSuccess(decodedText) {
    var now = Date.now();
    if (decodedText === lastScannedEAN && (now - lastScanTime) < SCAN_COOLDOWN_MS) return;
    if (isProcessing) return;

    isProcessing = true;
    lastScannedEAN = decodedText;
    lastScanTime = now;

    // Feedback visual y sonoro
    if (beep) try { beep.play(); } catch (e) { }
    showStatus(true);

    // Flash verde en el scanner
    var scannerContainer = document.querySelector('.scanner-container');
    if (scannerContainer) {
        scannerContainer.style.boxShadow = '0 0 30px #22c55e';
        setTimeout(function () {
            scannerContainer.style.boxShadow = '';
        }, 500);
    }

    fetch('api/buscar.php?codigo=' + encodeURIComponent(decodedText))
        .then(function (response) { return response.json(); })
        .then(function (data) {
            if (data.encontrado) {
                handleFound(data);
            } else {
                handleNotFound(decodedText);
            }
        })
        .catch(function (error) {
            addToHistory(decodedText, 'Error: ' + error.message, null, false);
        })
        .finally(function () {
            setTimeout(function () {
                isProcessing = false;
                showStatus(false);
            }, SCAN_COOLDOWN_MS);
        });
}

function showStatus(processing) {
    var badge = document.getElementById('scan-status');
    if (!badge) return;
    if (processing) {
        badge.classList.add('active');
    } else {
        badge.classList.remove('active');
    }
}

function handleFound(data) {
    var fullUrl = data.pdf_url;
    if (!fullUrl && data.pdf) {
        if (data.pdf.indexOf('http') === 0) {
            fullUrl = data.pdf;
        } else {
            fullUrl = 'api/ver_pdf.php?file=' + encodeURIComponent(data.pdf);
        }
    }

    var title = (data.producto && data.producto.descripcion) ? data.producto.descripcion : 'Producto encontrado';
    var code = (data.producto && (data.producto.ean || data.producto.codigo)) || '';

    addToHistory(code, title, fullUrl, true);

    if (fullUrl) {
        window.open(fullUrl, '_blank');
    }
}

function handleNotFound(code) {
    addToHistory(code, 'No encontrado', null, false);
}

// ============================================================================
// HISTORIAL
// ============================================================================
function loadHistory() {
    try {
        var stored = localStorage.getItem(STORAGE_KEY);
        var items = stored ? JSON.parse(stored) : [];
        var list = document.getElementById('history-list');
        if (list) {
            if (items.length === 0) {
                list.innerHTML = '<div class="empty-history">Sin escaneos recientes</div>';
            } else {
                list.innerHTML = '';
                items.forEach(function (item) { renderHistoryItem(list, item); });
            }
        }
    } catch (e) { }
}

function addToHistory(ean, desc, url, success) {
    var list = document.getElementById('history-list');
    if (!list) return;

    var empty = list.querySelector('.empty-history');
    if (empty) empty.remove();

    var newItem = {
        ean: ean,
        desc: desc,
        url: url,
        success: success,
        timestamp: new Date().toISOString()
    };
    renderHistoryItem(list, newItem, true);

    try {
        var stored = localStorage.getItem(STORAGE_KEY);
        var existing = stored ? JSON.parse(stored) : [];
        var updated = [newItem].concat(existing).slice(0, MAX_HISTORY_ITEMS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) { }
}

function renderHistoryItem(list, item, prepend) {
    var el = document.createElement('div');
    el.className = 'history-item ' + (item.success ? 'success' : 'error');

    var actionBtn = '';
    if (item.success && item.url) {
        actionBtn = '<a href="' + item.url + '" target="_blank" class="open-pdf-btn">ABRIR ↗</a>';
    }

    el.innerHTML =
        '<div class="history-item-info">' +
        '<div class="history-item-code">' + escapeHtml(item.ean) + '</div>' +
        '<div class="history-item-desc">' + escapeHtml(item.desc) + '</div>' +
        '</div>' +
        '<div>' + actionBtn + '</div>';

    if (prepend) {
        list.insertBefore(el, list.firstChild);
    } else {
        list.appendChild(el);
    }
}

function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    var list = document.getElementById('history-list');
    if (list) {
        list.innerHTML = '<div class="empty-history">Sin escaneos recientes</div>';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// BÚSQUEDA MANUAL
// ============================================================================
var searchInput = document.getElementById('manual-search');
var searchResults = document.getElementById('search-results');
var resultsList = document.getElementById('results-list');
var searchTimeout = null;

if (searchInput) {
    searchInput.addEventListener('input', function (e) {
        var query = e.target.value.trim();
        clearTimeout(searchTimeout);

        if (query.length < 2) {
            closeSearch();
            return;
        }

        searchTimeout = setTimeout(function () { performManualSearch(query); }, 400);
    });
}

function closeSearch() {
    if (searchResults) searchResults.classList.remove('visible');
}

function performManualSearch(query) {
    var fd = new FormData();
    fd.append('codigo', query);
    fd.append('modo', 'lista');

    fetch('api/buscar.php', { method: 'POST', body: fd })
        .then(function (res) { return res.json(); })
        .then(function (data) { renderSearchResults(data); })
        .catch(function (err) { console.error(err); });
}

function renderSearchResults(data) {
    if (!resultsList) return;
    resultsList.innerHTML = '';

    if (!data.encontrado || !data.resultados || data.resultados.length === 0) {
        resultsList.innerHTML = '<div class="result-item"><span class="result-item-title">Sin resultados</span></div>';
        if (searchResults) searchResults.classList.add('visible');
        return;
    }

    data.resultados.forEach(function (item) {
        var el = document.createElement('div');
        el.className = 'result-item';
        el.innerHTML =
            '<div class="result-item-title">' + escapeHtml(item.descripcion) + '</div>' +
            '<div class="result-item-code">Código: ' + escapeHtml(item.codigo) + ' | EAN: ' + escapeHtml(item.ean) + '</div>';

        el.onclick = function () {
            onScanSuccess(item.codigo);
            closeSearch();
            if (searchInput) searchInput.value = '';
        };
        resultsList.appendChild(el);
    });

    if (searchResults) searchResults.classList.add('visible');
}

function goToAdmin() {
    window.location.href = 'admin.html';
}