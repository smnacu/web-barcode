/**
 * app.js - Scanner de codigos de barras
 * Con vibracion, beep, barra de estado y manejo de PDF "acto de fe"
 */

// ============================================================================
// BARRA DE ESTADO Y LOG
// ============================================================================
function setStatus(message, type) {
    type = type || 'scanning';
    var statusBar = document.getElementById('status-bar');
    var statusText = document.getElementById('status-text');

    if (statusBar && statusText) {
        statusBar.className = 'status-message ' + type;
        statusText.textContent = message;
    }

    addLog(message, type);
}

function addLog(message, type) {
    type = type || 'info';
    var logContent = document.getElementById('log-content');
    if (!logContent) return;

    var time = new Date().toLocaleTimeString();
    var entry = document.createElement('div');
    entry.className = 'log-entry ' + type;
    entry.textContent = '[' + time + '] ' + message;
    logContent.insertBefore(entry, logContent.firstChild);

    while (logContent.children.length > 50) {
        logContent.removeChild(logContent.lastChild);
    }

    console.log('[' + type.toUpperCase() + '] ' + message);
}

// ============================================================================
// CONFIGURACION
// ============================================================================
var html5QrcodeScanner = null;
var isProcessing = false;
var isCameraBusy = false;
var currentFacingMode = "environment";
var lastScannedEAN = null;
var lastScanTime = 0;

// Cooldown reducido para flujo mas rapido
var SCAN_COOLDOWN_MS = 2000;
var STORAGE_KEY = 'barcodeC_history';
var MAX_HISTORY_ITEMS = 30;

// ============================================================================
// AUDIO - Beep funcional con Web Audio API
// ============================================================================
var audioContext = null;

function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('Audio no disponible');
    }
}

function playBeep() {
    if (!audioContext) return;

    try {
        var oscillator = audioContext.createOscillator();
        var gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 1800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
    } catch (e) { }
}

// ============================================================================
// VIBRACION
// ============================================================================
function vibrate(pattern) {
    if ('vibrate' in navigator) {
        try {
            navigator.vibrate(pattern);
        } catch (e) { }
    }
}

// ============================================================================
// INICIALIZACION
// ============================================================================
document.addEventListener('DOMContentLoaded', function () {
    setStatus('Iniciando...', 'scanning');
    loadHistory();
    initAudio();

    if (typeof Html5Qrcode === 'undefined') {
        setStatus('ERROR: Libreria no cargada', 'error');
        return;
    }

    // Activar audio al primer toque (requerido por iOS/Android)
    document.body.addEventListener('touchstart', function () {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }, { once: true });

    setTimeout(function () {
        startScanner();
    }, 500);
});

// ============================================================================
// SCANNER
// ============================================================================
function startScanner() {
    if (isCameraBusy) {
        setStatus('Camara ocupada...', 'scanning');
        return;
    }
    isCameraBusy = true;
    setStatus('Abriendo camara...', 'scanning');

    var cleanup = Promise.resolve();
    if (html5QrcodeScanner) {
        cleanup = stopCurrentScanner();
    }

    cleanup.then(function () {
        return new Promise(function (resolve) { setTimeout(resolve, 300); });
    }).then(function () {
        var reader = document.getElementById('reader');
        if (!reader) {
            setStatus('ERROR: No se encontro el visor', 'error');
            isCameraBusy = false;
            return Promise.reject('No reader');
        }
        reader.innerHTML = '';

        html5QrcodeScanner = new Html5Qrcode("reader");

        var config = {
            fps: 15,
            qrbox: { width: 280, height: 80 },
            aspectRatio: 1.777,
            disableFlip: true,
            formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39
            ]
        };

        return html5QrcodeScanner.start(
            { facingMode: currentFacingMode },
            config,
            onScanSuccess,
            function () { }
        ).catch(function (err) {
            addLog('Intento 1 fallo: ' + err, 'error');
            return html5QrcodeScanner.start("environment", config, onScanSuccess, function () { });
        }).catch(function (err) {
            addLog('Intento 2 fallo: ' + err, 'error');
            return html5QrcodeScanner.start("user", config, onScanSuccess, function () { });
        });
    }).then(function () {
        setStatus('Listo - Apunta el codigo', 'success');
        isCameraBusy = false;
    }).catch(function (err) {
        setStatus('ERROR camara: ' + (err.message || err), 'error');
        isCameraBusy = false;
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
                }).catch(function () {
                    html5QrcodeScanner = null;
                    resolve();
                });
            } else {
                try { html5QrcodeScanner.clear(); } catch (e) { }
                html5QrcodeScanner = null;
                resolve();
            }
        } catch (e) {
            html5QrcodeScanner = null;
            resolve();
        }
    });
}

function switchCamera() {
    if (isCameraBusy) return;
    currentFacingMode = (currentFacingMode === "user") ? "environment" : "user";
    setStatus('Cambiando camara...', 'scanning');
    startScanner();
}

// ============================================================================
// ESCANEO EXITOSO
// ============================================================================
function onScanSuccess(decodedText, decodedResult) {
    var now = Date.now();
    var formatName = decodedResult.result.format ? decodedResult.result.format.formatName : 'UNKNOWN';

    addLog('DETECTADO: ' + decodedText + ' (' + formatName + ')', 'scan');

    // Evitar escaneos repetidos
    if (decodedText === lastScannedEAN && (now - lastScanTime) < SCAN_COOLDOWN_MS) {
        return;
    }
    if (isProcessing) return;

    isProcessing = true;
    lastScannedEAN = decodedText;
    lastScanTime = now;

    // Feedback inmediato: vibracion + beep
    vibrate(200);
    playBeep();

    // Flash verde visual
    var container = document.querySelector('.scanner-container');
    if (container) {
        container.style.borderColor = '#22c55e';
        container.style.boxShadow = '0 0 20px #22c55e';
        setTimeout(function () {
            container.style.borderColor = '#333';
            container.style.boxShadow = '';
        }, 500);
    }

    setStatus('Buscando: ' + decodedText + '...', 'scanning');

    // Buscar en CSV
    fetch('api/buscar.php?codigo=' + encodeURIComponent(decodedText))
        .then(function (response) { return response.json(); })
        .then(function (data) {
            if (data.encontrado) {
                var desc = data.producto ? data.producto.descripcion : 'Encontrado';
                setStatus('OK: ' + desc, 'success');
                vibrate([100, 50, 100]);
                handleFound(data);
            } else {
                setStatus('NO EN CSV: ' + decodedText, 'error');
                vibrate([50, 100, 50, 100, 50]);
                handleNotFound(decodedText);
            }
        })
        .catch(function (error) {
            setStatus('ERROR RED: ' + error.message, 'error');
            vibrate([300]);
            addToHistory(decodedText, 'Error de conexion', null, false);
        })
        .finally(function () {
            // Siempre volver a estado listo despues del cooldown
            setTimeout(function () {
                isProcessing = false;
                setStatus('Listo - Apunta el codigo', 'success');
            }, SCAN_COOLDOWN_MS);
        });
}

// ============================================================================
// MANEJO DE RESULTADOS - "Acto de Fe" para PDFs en LAN
// ============================================================================
function handleFound(data) {
    // Construir URL del PDF
    var fullUrl = data.pdf_url;
    if (!fullUrl && data.pdf) {
        if (data.pdf.indexOf('http') === 0) {
            fullUrl = data.pdf;
        } else {
            fullUrl = 'api/ver_pdf.php?file=' + encodeURIComponent(data.pdf);
        }
    }

    var title = (data.producto && data.producto.descripcion) ? data.producto.descripcion : 'Encontrado';
    var code = (data.producto && (data.producto.ean || data.producto.codigo)) || '';

    // Agregar al historial como exito (lo encontramos en CSV)
    addToHistory(code, title, fullUrl, true);

    // Abrir PDF en nueva pestana - "ACTO DE FE"
    // El PDF esta en un servidor LAN al que Ferozo no puede acceder
    // Simplemente abrimos la URL y confiamos en que el navegador local pueda llegar
    if (fullUrl) {
        setStatus('Abriendo plano...', 'success');
        addLog('PDF: ' + fullUrl, 'info');

        // Abrir en nueva pestana, no bloqueamos ni esperamos respuesta
        window.open(fullUrl, '_blank');
    } else {
        setStatus('Sin plano: ' + code, 'warning');
        addLog('Producto sin PDF asociado', 'warning');
    }
}

function handleNotFound(code) {
    addToHistory(code, 'No encontrado en CSV', null, false);
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
                list.innerHTML = '<div class="empty-history">Sin escaneos</div>';
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
        actionBtn = '<a href="' + item.url + '" target="_blank" class="open-pdf-btn">ABRIR</a>';
    }

    el.innerHTML =
        '<div class="history-item-info">' +
        '<div class="history-item-code">' + escapeHtml(item.ean) + '</div>' +
        '<div class="history-item-desc">' + escapeHtml(item.desc) + '</div>' +
        '</div>' + actionBtn;

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
        list.innerHTML = '<div class="empty-history">Sin escaneos</div>';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// BUSQUEDA MANUAL
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
        .catch(function (err) { addLog('Error busqueda: ' + err, 'error'); });
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
            '<div class="result-item-code">EAN: ' + escapeHtml(item.ean) + '</div>';

        el.onclick = function () {
            onScanSuccess(item.codigo, { result: { format: { formatName: 'MANUAL' } } });
            closeSearch();
            if (searchInput) searchInput.value = '';
        };
        resultsList.appendChild(el);
    });

    if (searchResults) searchResults.classList.add('visible');
}