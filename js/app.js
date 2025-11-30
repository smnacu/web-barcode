/**
 * Lógica Core - Scanner, Buscador Manual e Historial
 * Daruma Consulting SRL
 */

const CONFIG = {
    fps: 10,
    qrbox: 250,
    aspectRatio: 1.0,
    historyLimit: 5 // Cuántos items guardamos en historial
};

let html5QrcodeScanner = null;
let isScanning = false;

document.addEventListener('DOMContentLoaded', () => {
    initScanner();
    setupEvents();
    renderHistory(); // Cargar historial al iniciar
});

function initScanner() {
    if(html5QrcodeScanner) {
        try { html5QrcodeScanner.clear(); } catch(e) {}
    }

    html5QrcodeScanner = new Html5QrcodeScanner(
        "reader", 
        { 
            fps: CONFIG.fps, 
            qrbox: CONFIG.qrbox,
            aspectRatio: CONFIG.aspectRatio,
            rememberLastUsedCamera: true,
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        },
        false
    );

    html5QrcodeScanner.render(onScanSuccess, (err) => { /* ignorar fallos de frame */ });
    isScanning = true;
}

// --- CORE SEARCH LOGIC ---

function performSearch(query) {
    if (!query || query.trim().length < 2) {
        updateStatus("Ingrese al menos 2 caracteres", "error");
        return;
    }

    // Pausar scanner si estaba activo para ahorrar recursos
    if (isScanning && html5QrcodeScanner) {
        html5QrcodeScanner.pause(true);
        isScanning = false;
    }

    updateStatus("Buscando...", "warning");

    fetch(`api/scan.php?code=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            if (data.found) {
                showResult(data);
                addToHistory(data); // <--- GUARDAR EN HISTORIAL
            } else {
                updateStatus("No encontrado: " + query, "error");
                // Si fue manual, no reiniciamos scanner auto, dejamos que el user decida.
                // Si fue por scan, reiniciamos.
            }
        })
        .catch(err => {
            console.error(err);
            updateStatus("Error de conexión", "error");
        });
}

function onScanSuccess(decodedText, decodedResult) {
    if (!isScanning) return;
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
    // Usamos la columna 1 como Título principal (ej: Descripción), o la 0 si no hay más
    const mainTitle = data.data[1] ? data.data[1] : data.data[0];
    const subTitle = data.data[0]; // Código

    let html = `
        <h2 class="result-title">${mainTitle}</h2>
        <div class="result-code">REF: ${subTitle}</div>
        <ul class="data-list">
    `;
    
    data.data.forEach((val, index) => {
        if(index > 1 && val.trim() !== "") { 
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
        // Guardamos URL en el elemento para reuso fácil
        btnPdf.dataset.url = data.pdf_url;
    } else {
        btnPdf.style.display = 'none';
        pdfContainer.innerHTML = '<p class="no-pdf"><i class="fa fa-exclamation-triangle"></i> Sin PDF asociado</p>';
    }
    
    updateStatus("Datos cargados correctamente", "success");
}

function resetApp() {
    closePdfViewer();
    document.getElementById('result-panel').classList.add('hidden');
    document.querySelector('.search-container').classList.remove('hidden');
    document.getElementById('scanner-container').classList.remove('hidden');
    document.getElementById('manual-search-input').value = '';
    
    if(html5QrcodeScanner) {
        html5QrcodeScanner.resume();
        isScanning = true;
        updateStatus("Listo para buscar", "info");
    }
}

// --- PDF VIEWER ---

function openPdfViewer(url) {
    const viewer = document.getElementById('pdf-modal');
    const iframe = document.getElementById('pdf-iframe');
    iframe.src = `${url}?t=${new Date().getTime()}`;
    viewer.classList.remove('hidden');
}

function closePdfViewer() {
    const viewer = document.getElementById('pdf-modal');
    const iframe = document.getElementById('pdf-iframe');
    iframe.src = "about:blank";
    viewer.classList.add('hidden');
}

// --- HISTORIAL (LOCAL STORAGE) ---

function addToHistory(data) {
    let history = JSON.parse(localStorage.getItem('scan_history') || '[]');
    
    // Objeto a guardar (simplificado)
    const item = {
        code: data.code,
        title: data.data[1] || data.data[0], // Descripción o Código
        pdf_url: data.pdf_url,
        timestamp: new Date().getTime()
    };

    // Evitar duplicados recientes (borrar si existe para ponerlo primero)
    history = history.filter(h => h.code !== item.code);
    
    // Agregar al principio
    history.unshift(item);
    
    // Limitar cantidad
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
        // Si tiene PDF, habilitamos click
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
    if(confirm('¿Borrar historial?')) {
        localStorage.removeItem('scan_history');
        renderHistory();
    }
}

// --- UTILS & EVENTS ---

function updateStatus(msg, type) {
    const el = document.getElementById('status-bar');
    if(el) {
        el.innerText = msg;
        el.className = `status-info status-${type}`; // Mantiene clase base y agrega tipo
    }
}

function setupEvents() {
    // Botones UI
    document.getElementById('btn-reset').addEventListener('click', resetApp);
    document.getElementById('btn-close-pdf').addEventListener('click', closePdfViewer);
    
    // Buscador Manual
    const searchBtn = document.getElementById('btn-manual-search');
    const searchInput = document.getElementById('manual-search-input');
    
    searchBtn.addEventListener('click', () => {
        performSearch(searchInput.value);
    });
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch(searchInput.value);
    });
}
