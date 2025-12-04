/**
 * app.js - Scanner de codigos de barras (Modular)
 * Estructura modular compatible con Android 11+
 */

// ============================================================================
// 1. MODULO DE INTERFAZ (UI)
// ============================================================================
var UI = {
    elements: {},

    init: function () {
        this.elements = {
            statusBar: document.getElementById('status-bar'),
            statusText: document.getElementById('status-text'),
            logContent: document.getElementById('log-content'),
            historyList: document.getElementById('history-list'),
            manualInput: document.getElementById('manual-search'),
            searchResults: document.getElementById('search-results'),
            resultsList: document.getElementById('results-list')
        };
    },

    setStatus: function (message, type) {
        type = type || 'scanning';
        if (this.elements.statusBar && this.elements.statusText) {
            this.elements.statusBar.className = 'status-message ' + type;
            this.elements.statusText.textContent = message;
        }
        this.addLog(message, type);
    },

    addLog: function (message, type) {
        type = type || 'info';
        if (!this.elements.logContent) return;

        var time = new Date().toLocaleTimeString();
        var entry = document.createElement('div');
        entry.className = 'log-entry ' + type;
        entry.textContent = '[' + time + '] ' + message;

        this.elements.logContent.insertBefore(entry, this.elements.logContent.firstChild);
        if (this.elements.logContent.children.length > 50) {
            this.elements.logContent.removeChild(this.elements.logContent.lastChild);
        }
        console.log('[' + type.toUpperCase() + '] ' + message);
    },

    addHistoryItem: function (item, prepend) {
        if (!this.elements.historyList) return;

        var empty = this.elements.historyList.querySelector('.empty-history');
        if (empty) empty.remove();

        var el = document.createElement('div');
        el.className = 'history-item ' + (item.success ? 'success' : 'error');

        var actionBtn = (item.success && item.url)
            ? '<a href="' + item.url + '" target="_blank" class="open-pdf-btn">ABRIR</a>'
            : '';

        el.innerHTML =
            '<div class="history-item-info">' +
            '<div class="history-item-code">' + this.escapeHtml(item.ean) + '</div>' +
            '<div class="history-item-desc">' + this.escapeHtml(item.desc) + '</div>' +
            '</div>' + actionBtn;

        if (prepend) {
            this.elements.historyList.insertBefore(el, this.elements.historyList.firstChild);
        } else {
            this.elements.historyList.appendChild(el);
        }
    },

    clearHistoryUI: function () {
        if (this.elements.historyList) {
            this.elements.historyList.innerHTML = '<div class="empty-history">Sin escaneos</div>';
        }
    },

    flashEffect: function (color) {
        color = color || '#22c55e';
        var container = document.querySelector('.scanner-container');
        if (container) {
            container.style.borderColor = color;
            container.style.boxShadow = '0 0 20px ' + color;
            setTimeout(function () {
                container.style.borderColor = '#333';
                container.style.boxShadow = '';
            }, 500);
        }
    },

    toggleSearch: function (show) {
        if (this.elements.searchResults) {
            if (show) this.elements.searchResults.classList.add('visible');
            else this.elements.searchResults.classList.remove('visible');
        }
    },

    escapeHtml: function (text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// ============================================================================
// 2. MODULO DE AUDIO & FEEDBACK
// ============================================================================
var AudioHandler = {
    context: null,

    init: function () {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Audio API no soportada');
        }
    },

    resume: function () {
        if (this.context && this.context.state === 'suspended') {
            this.context.resume();
        }
    },

    beep: function (type) {
        if (!this.context) return;
        type = type || 'success';

        try {
            var osc = this.context.createOscillator();
            var gain = this.context.createGain();
            osc.connect(gain);
            gain.connect(this.context.destination);

            if (type === 'success') {
                osc.frequency.value = 1800;
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.3, this.context.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.15);
                osc.start(this.context.currentTime);
                osc.stop(this.context.currentTime + 0.15);
            } else {
                osc.frequency.value = 200;
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(0.4, this.context.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.25);
                osc.start(this.context.currentTime);
                osc.stop(this.context.currentTime + 0.25);
            }
        } catch (e) { }
    },

    vibrate: function (pattern) {
        if ('vibrate' in navigator) {
            try { navigator.vibrate(pattern); } catch (e) { }
        }
    }
};

// ============================================================================
// 3. MODULO DE DATOS (History & API)
// ============================================================================
var DataManager = {
    STORAGE_KEY: 'barcodeC_history',
    MAX_ITEMS: 30,

    loadHistory: function () {
        try {
            var stored = localStorage.getItem(this.STORAGE_KEY);
            var items = stored ? JSON.parse(stored) : [];

            if (items.length === 0) {
                UI.clearHistoryUI();
            } else {
                for (var i = 0; i < items.length; i++) {
                    UI.addHistoryItem(items[i], false);
                }
            }
        } catch (e) { }
    },

    saveItem: function (ean, desc, url, success) {
        var newItem = {
            ean: ean,
            desc: desc,
            url: url,
            success: success,
            timestamp: new Date().toISOString()
        };

        UI.addHistoryItem(newItem, true);

        try {
            var stored = localStorage.getItem(this.STORAGE_KEY);
            var existing = stored ? JSON.parse(stored) : [];
            var updated = [newItem].concat(existing).slice(0, this.MAX_ITEMS);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
        } catch (e) { }
    },

    clearHistory: function () {
        localStorage.removeItem(this.STORAGE_KEY);
        UI.clearHistoryUI();
    },

    searchCode: function (code) {
        return fetch('api/buscar.php?codigo=' + encodeURIComponent(code))
            .then(function (res) { return res.json(); });
    },

    searchList: function (query) {
        var fd = new FormData();
        fd.append('codigo', query);
        fd.append('modo', 'lista');
        return fetch('api/buscar.php', { method: 'POST', body: fd })
            .then(function (res) { return res.json(); });
    }
};

// ============================================================================
// 4. MODULO DE ESCANER
// ============================================================================
var Scanner = {
    instance: null,
    isBusy: false,
    isProcessing: false,
    facingMode: "environment",
    lastScan: { code: null, time: 0 },
    COOLDOWN: 2000,

    start: function () {
        var self = this;

        if (this.isBusy) {
            UI.setStatus('Camara ocupada...', 'scanning');
            return;
        }
        this.isBusy = true;
        UI.setStatus('Abriendo camara...', 'scanning');

        this.stop().then(function () {
            return new Promise(function (resolve) { setTimeout(resolve, 300); });
        }).then(function () {
            var reader = document.getElementById('reader');
            if (!reader) {
                UI.setStatus('ERROR: No se encontro el visor', 'error');
                self.isBusy = false;
                return Promise.reject('No reader');
            }
            reader.innerHTML = '';

            self.instance = new Html5Qrcode("reader");

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

            return self.instance.start(
                { facingMode: self.facingMode },
                config,
                function (text, res) { self.onScan(text, res); },
                function () { }
            );
        }).then(function () {
            UI.setStatus('Listo - Apunta el codigo', 'success');
            self.isBusy = false;
        }).catch(function (err) {
            UI.addLog('Error camara: ' + err, 'error');
            // Fallback
            if (self.instance) {
                self.instance.start("environment", { fps: 10, qrbox: 250 },
                    function (t, r) { self.onScan(t, r); },
                    function () { }
                ).then(function () {
                    UI.setStatus('Modo compatibilidad', 'warning');
                    self.isBusy = false;
                }).catch(function (e) {
                    UI.setStatus('ERROR CAMARA', 'error');
                    self.isBusy = false;
                });
            } else {
                self.isBusy = false;
            }
        });
    },

    stop: function () {
        var self = this;
        return new Promise(function (resolve) {
            if (!self.instance) return resolve();

            try {
                var state = self.instance.getState();
                if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
                    self.instance.stop().then(function () {
                        try { self.instance.clear(); } catch (e) { }
                        self.instance = null;
                        resolve();
                    }).catch(function () {
                        self.instance = null;
                        resolve();
                    });
                } else {
                    try { self.instance.clear(); } catch (e) { }
                    self.instance = null;
                    resolve();
                }
            } catch (e) {
                self.instance = null;
                resolve();
            }
        });
    },

    switchCamera: function () {
        if (this.isBusy) return;
        this.facingMode = (this.facingMode === "user") ? "environment" : "user";
        UI.setStatus('Cambiando camara...', 'scanning');
        this.start();
    },

    onScan: function (decodedText, decodedResult) {
        var self = this;
        var now = Date.now();
        var formatName = decodedResult.result && decodedResult.result.format
            ? decodedResult.result.format.formatName
            : 'UNKNOWN';

        UI.addLog('DETECTADO: ' + decodedText + ' (' + formatName + ')', 'scan');

        // Evitar escaneos repetidos
        if (decodedText === this.lastScan.code && (now - this.lastScan.time) < this.COOLDOWN) {
            return;
        }
        if (this.isProcessing) return;

        this.isProcessing = true;
        this.lastScan = { code: decodedText, time: now };

        // Feedback inmediato
        AudioHandler.vibrate(200);
        AudioHandler.beep('success');
        UI.flashEffect('#22c55e');
        UI.setStatus('Buscando: ' + decodedText + '...', 'scanning');

        // Buscar en API
        DataManager.searchCode(decodedText)
            .then(function (data) {
                if (data.encontrado) {
                    var desc = data.producto ? data.producto.descripcion : 'Encontrado';
                    var code = data.producto ? (data.producto.ean || data.producto.codigo) : decodedText;
                    var pdfUrl = data.pdf_url;

                    if (!pdfUrl && data.pdf) {
                        pdfUrl = data.pdf.indexOf('http') === 0
                            ? data.pdf
                            : 'api/ver_pdf.php?file=' + encodeURIComponent(data.pdf);
                    }

                    UI.setStatus('OK: ' + desc, 'success');
                    AudioHandler.vibrate([100, 50, 100]);
                    DataManager.saveItem(code, desc, pdfUrl, true);

                    // Abrir PDF - "acto de fe"
                    if (pdfUrl) {
                        UI.addLog('PDF: ' + pdfUrl, 'info');
                        window.open(pdfUrl, '_blank');
                    }
                } else {
                    UI.setStatus('NO EN CSV: ' + decodedText, 'error');
                    UI.flashEffect('#ef4444');
                    AudioHandler.vibrate([50, 100, 50, 100]);
                    AudioHandler.beep('error');
                    DataManager.saveItem(decodedText, 'No encontrado en CSV', null, false);
                }
            })
            .catch(function (err) {
                UI.setStatus('ERROR RED: ' + err.message, 'error');
                UI.flashEffect('#ef4444');
                AudioHandler.vibrate([300]);
                AudioHandler.beep('error');
                DataManager.saveItem(decodedText, 'Error de conexion', null, false);
            })
            .finally(function () {
                setTimeout(function () {
                    self.isProcessing = false;
                    UI.setStatus('Listo - Apunta el codigo', 'success');
                }, self.COOLDOWN);
            });
    }
};

// ============================================================================
// 5. MODULO DE BUSQUEDA MANUAL
// ============================================================================
var ManualSearch = {
    timeout: null,

    init: function () {
        var self = this;
        if (!UI.elements.manualInput) return;

        UI.elements.manualInput.addEventListener('input', function (e) {
            var query = e.target.value.trim();
            clearTimeout(self.timeout);

            if (query.length < 2) {
                UI.toggleSearch(false);
                return;
            }

            self.timeout = setTimeout(function () {
                self.search(query);
            }, 400);
        });
    },

    search: function (query) {
        DataManager.searchList(query)
            .then(function (data) {
                if (!UI.elements.resultsList) return;
                UI.elements.resultsList.innerHTML = '';

                if (!data.resultados || data.resultados.length === 0) {
                    UI.elements.resultsList.innerHTML = '<div class="result-item">Sin resultados</div>';
                    UI.toggleSearch(true);
                    return;
                }

                for (var i = 0; i < data.resultados.length; i++) {
                    (function (item) {
                        var el = document.createElement('div');
                        el.className = 'result-item';
                        el.innerHTML =
                            '<div class="result-item-title">' + UI.escapeHtml(item.descripcion) + '</div>' +
                            '<div class="result-item-code">EAN: ' + UI.escapeHtml(item.ean) + '</div>';

                        el.onclick = function () {
                            UI.toggleSearch(false);
                            UI.elements.manualInput.value = '';
                            Scanner.onScan(item.codigo, { result: { format: { formatName: 'MANUAL' } } });
                        };
                        UI.elements.resultsList.appendChild(el);
                    })(data.resultados[i]);
                }

                UI.toggleSearch(true);
            })
            .catch(function (err) {
                UI.addLog('Error busqueda: ' + err, 'error');
            });
    }
};

// ============================================================================
// 6. INICIALIZACION (Main)
// ============================================================================
document.addEventListener('DOMContentLoaded', function () {
    // Inicializar modulos
    UI.init();
    UI.setStatus('Inicializando...', 'scanning');

    AudioHandler.init();
    DataManager.loadHistory();
    ManualSearch.init();

    // Verificar libreria
    if (typeof Html5Qrcode === 'undefined') {
        UI.setStatus('ERROR: Libreria no cargada', 'error');
        return;
    }

    // Habilitar audio en primer toque (iOS/Android)
    document.body.addEventListener('touchstart', function () { AudioHandler.resume(); }, { once: true });
    document.body.addEventListener('click', function () { AudioHandler.resume(); }, { once: true });

    // Arrancar scanner
    setTimeout(function () { Scanner.start(); }, 500);
});

// ============================================================================
// 7. FUNCIONES GLOBALES (para onclick en HTML)
// ============================================================================
function switchCamera() { Scanner.switchCamera(); }
function clearHistory() { DataManager.clearHistory(); }
function closeSearch() { UI.toggleSearch(false); } 