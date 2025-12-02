/**
 * Lógica Core - Scanner, Buscador Manual e Historial
 * Daruma Consulting SRL
 */

const CONFIG = {
    fps: 10,
    qrbox: 250,
    aspectRatio: 1.0,
    historyLimit: 5
};

let html5QrCode = null;
let isScanning = false;
let currentCameraId = null;
let cameras = [];
let cameraIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    initScanner();
    setupEvents();
    renderHistory();
});

function initScanner() {
    // Usamos Html5Qrcode (Pro API) en lugar de Html5QrcodeScanner para control total
    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
            cameras = devices;

            // Intentar encontrar cámara frontal (user)
            // A veces 'label' contiene 'front' o 'anterior'
            let frontCam = cameras.find(c => c.label.toLowerCase().includes('front') || c.label.toLowerCase().includes('anterior') || c.label.toLowerCase().includes('user'));

            // Si no encuentra explícitamente, usar la primera (que suele ser trasera en móviles, pero user pidió frontal)
            // Ojo: En móviles, getCameras devuelve todas.
            // Si queremos forzar frontal, podemos usar facingMode: "user" en start().

            // Estrategia: Guardar IDs y permitir switch.
            // Iniciar con la que parezca frontal o la primera.

            if (frontCam) {
                currentCameraId = frontCam.id;
                cameraIndex = cameras.indexOf(frontCam);
            } else {
                currentCameraId = cameras[0].id;
                cameraIndex = 0;
            }

            if (cameras.length > 1) {
                document.getElementById('btn-switch-camera').classList.remove('hidden');
            }

            startCamera(currentCameraId);
        } else {
            updateStatus("No se detectaron cámaras", "error");
        }
    }).catch(err => {
        console.error(err);
        updateStatus("Error al acceder a cámara", "error");
    });
}

function startCamera(cameraId) {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            startInstance(cameraId);
        }).catch(err => {
            // Si no estaba corriendo, limpiar e iniciar
            startInstance(cameraId);
        });
    } else {
        startInstance(cameraId);
    }
}

function startInstance(cameraId) {
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        cameraId,
        {
            fps: CONFIG.fps,
            qrbox: CONFIG.qrbox,
            aspectRatio: CONFIG.aspectRatio
        },
        (decodedText, decodedResult) => {
            if (isScanning) return; // Evitar múltiples lecturas seguidas
            onScanSuccess(decodedText, decodedResult);
        },
        (errorMessage) => {
            // Ignorar errores de frame
        }
    ).then(() => {
        isScanning = false; // Listo para escanear
        updateStatus("Escaneando...", "info");
    }).catch(err => {
        console.error(err);
        updateStatus("Error al iniciar cámara", "error");
    });
}

function switchCamera() {
    if (cameras.length < 2) return;

    cameraIndex = (cameraIndex + 1) % cameras.length;
    currentCameraId = cameras[cameraIndex].id;
    startCamera(currentCameraId);
}

// --- CORE SEARCH LOGIC ---

function performSearch(query) {
    if (!query || query.trim().length < 2) {
        updateStatus("Ingrese al menos 2 caracteres", "error");
        return;
    }

    // Pausar scanner visualmente (aunque ya no procesamos onScanSuccess)
    isScanning = true;
    updateStatus("Buscando...", "warning");

    fetch(`api/scan.php?code=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            if (data.found) {
                addToHistory(data);

                // AUTO OPEN PDF SI EXISTE
                if (data.pdf_available && data.pdf_url) {
                    openPdfViewer(data.pdf_url);
                    // Opcional: Mostrar resultado brevemente o resetear
                    // Si abrimos tab, el usuario vuelve y ve el resultado
                }

                showResult(data);
            } else {
                updateStatus("No encontrado: " + query, "error");
                // Permitir escanear de nuevo tras un breve delay
                setTimeout(() => { isScanning = false; }, 2000);
            }
        })
        .catch(err => {
            console.error(err);
            updateStatus("Error de conexión", "error");
            isScanning = false;
        });
}

function onScanSuccess(decodedText, decodedResult) {
    performSearch(decodedText);
}

// --- UI HANDLING ---

function showResult(data) {
    const resultDiv = document.getElementById('result-panel');
    const scannerDiv = document.getElementById('scanner-container');
    const searchDiv = document.querySelector('.search-container');

    // Ocultar búsqueda y scanner
    scannerDiv.classList.add('hidden');
    searchDiv.classList.add('hidden');
    resultDiv.classList.remove('hidden');

    // Render Datos
    const infoContainer = document.getElementById('info-content');
    const mainTitle = data.data[1] ? data.data[1] : data.data[0];
    const subTitle = data.data[0]; // Código

    let html = `
        <h2 class="result-title">${mainTitle}</h2>
        <div class="result-code">REF: ${subTitle}</div>
        <ul class="data-list">
    `;

    data.data.forEach((val, index) => {
        if (index > 1 && val.trim() !== "") {
            html += `<li><strong>Col ${index}:</strong> ${val}</li>`;
        }
    });
    html += `</ul>`;
    infoContainer.innerHTML = html;

    // Botón PDF
    const btnPdf = document.getElementById('btn-open-pdf');
    const pdfContainer = document.getElementById('pdf-container');

    if (data.pdf_available) {
        btnPdf.style.display = 'inline-flex';
        btnPdf.onclick = () => openPdfViewer(data.pdf_url);
        btnPdf.dataset.url = data.pdf_url;
    } else {
        btnPdf.style.display = 'none';
        pdfContainer.innerHTML = '<p class="no-pdf"><i class="fa fa-exclamation-triangle"></i> Sin PDF asociado</p>';
    }

    updateStatus("Datos cargados correctamente", "success");
}

function resetApp() {
    document.getElementById('result-panel').classList.add('hidden');
    document.querySelector('.search-container').classList.remove('hidden');
    document.getElementById('scanner-container').classList.remove('hidden');
    document.getElementById('manual-search-input').value = '';

    isScanning = false;
    updateStatus("Listo para buscar", "info");

    // Asegurar que la cámara siga corriendo o reiniciarla si se detuvo
    if (html5QrCode && !html5QrCode.isScanning) {
        startCamera(currentCameraId);
    }
}

// --- PDF VIEWER ---

function openPdfViewer(url) {
    window.open(url, '_blank');
}

// --- HISTORIAL (LOCAL STORAGE) ---

function addToHistory(data) {
    let history = JSON.parse(localStorage.getItem('scan_history') || '[]');

    const item = {
        code: data.code,
        title: data.data[1] || data.data[0],
        pdf_url: data.pdf_url,
        timestamp: new Date().getTime()
    };

    history = history.filter(h => h.code !== item.code);
    history.unshift(item);
    if (history.length > CONFIG.historyLimit) history.pop();

    localStorage.setItem('scan_history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const container = document.getElementById('history-list');
    const history = JSON.parse(localStorage.getItem('scan_history') || '[]');

    if (history.length === 0) {
        container.innerHTML = '<p class="text-muted">Sin historial reciente.</p>';
        return;
    }

    container.innerHTML = '';
    history.forEach(h => {
        const div = document.createElement('div');
        div.className = 'history-item';
        if (h.pdf_url) {
            div.onclick = () => openPdfViewer(h.pdf_url);
            div.innerHTML = `
                <div class="h-info">
                    <span class="h-title">${h.title}</span>
                    <span class="h-code">${h.code}</span>
                </div>
                <div class="h-icon"><i class="fa fa-file-pdf"></i></div>
            `;
        } else {
            div.classList.add('disabled');
            div.innerHTML = `
                <div class="h-info">
                    <span class="h-title">${h.title}</span>
                    <span class="h-code">${h.code}</span>
                </div>
                <div class="h-icon"><i class="fa fa-ban"></i></div>
            `;
        }
        container.appendChild(div);
    });
}

function clearHistory() {
    if (confirm('¿Borrar historial?')) {
        localStorage.removeItem('scan_history');
        renderHistory();
    }
}

// --- UTILS & EVENTS ---

function updateStatus(msg, type) {
    const el = document.getElementById('status-bar');
    if (el) {
        el.innerText = msg;
        el.className = `status-info status-${type}`;
    }
}

function setupEvents() {
    document.getElementById('btn-reset').addEventListener('click', resetApp);
    document.getElementById('btn-switch-camera').addEventListener('click', switchCamera);

    const searchBtn = document.getElementById('btn-manual-search');
    const searchInput = document.getElementById('manual-search-input');

    searchBtn.addEventListener('click', () => {
        performSearch(searchInput.value);
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch(searchInput.value);
    });
}
