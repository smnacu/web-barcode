/**
 * Lógica principal de Scanner para Producción
 * Prioridad: Gestión de Memoria y UX en Tablet
 */

const CONFIG = {
    fps: 10,
    qrbox: 250,
    aspectRatio: 1.0
};

let html5QrcodeScanner = null;
let isScanning = false;

document.addEventListener('DOMContentLoaded', () => {
    initScanner();
    setupEvents();
});

function initScanner() {
    // Limpieza preventiva
    if(html5QrcodeScanner) {
        try { html5QrcodeScanner.clear(); } catch(e) {}
    }

    html5QrcodeScanner = new Html5QrcodeScanner(
        "reader", 
        { 
            fps: CONFIG.fps, 
            qrbox: CONFIG.qrbox,
            aspectRatio: CONFIG.aspectRatio,
            rememberLastUsedCamera: true
        },
        /* verbose= */ false
    );

    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    isScanning = true;
    updateStatus("Esperando código...", "info");
}

function onScanSuccess(decodedText, decodedResult) {
    if (!isScanning) return;

    // CRITICO: Pausar el scanner inmediatamente para liberar recursos
    console.log(`Código escaneado: ${decodedText}`);
    html5QrcodeScanner.pause(true); 
    isScanning = false;

    updateStatus("Procesando...", "warning");
    
    // Consultar API
    fetch(`api/scan.php?code=${encodeURIComponent(decodedText)}`)
        .then(response => response.json())
        .then(data => {
            if (data.found) {
                showResult(data);
            } else {
                updateStatus(`Código ${decodedText} no encontrado`, "error");
                setTimeout(resumeScanner, 2000); // Reintentar en 2s
            }
        })
        .catch(err => {
            console.error(err);
            updateStatus("Error de conexión", "error");
            setTimeout(resumeScanner, 3000);
        });
}

function onScanFailure(error) {
    // No hacer nada, ruido de log
}

function showResult(data) {
    const resultDiv = document.getElementById('result-panel');
    const scannerDiv = document.getElementById('scanner-container');
    
    // Ocultar scanner visualmente
    scannerDiv.classList.add('hidden');
    resultDiv.classList.remove('hidden');

    // Renderizar datos del CSV
    const infoContainer = document.getElementById('info-content');
    let html = `<h3>Código: ${data.code}</h3><ul class="data-list">`;
    
    // Asumiendo que data.data es el array del CSV
    data.data.forEach((val, index) => {
        if(index > 0 && val.trim() !== "") { // Saltamos el código que es index 0
            html += `<li><strong>Dato ${index}:</strong> ${val}</li>`;
        }
    });
    html += `</ul>`;
    infoContainer.innerHTML = html;

    // Manejo del PDF
    const pdfContainer = document.getElementById('pdf-container');
    const btnPdf = document.getElementById('btn-open-pdf');
    
    if (data.pdf_available) {
        btnPdf.style.display = 'inline-block';
        btnPdf.onclick = () => openPdfViewer(data.pdf_url);
        // Auto abrir si es preferencia (opcional)
        // openPdfViewer(data.pdf_url); 
    } else {
        btnPdf.style.display = 'none';
        pdfContainer.innerHTML = '<p class="no-pdf">Sin PDF asociado (Intranet)</p>';
    }
}

function openPdfViewer(url) {
    // CRITICO: Para tablets viejas, usar iframe simple o window.open
    // Usamos un iframe dentro de un modal para mantener contexto
    const viewer = document.getElementById('pdf-modal');
    const iframe = document.getElementById('pdf-iframe');
    
    // Agregar timestamp para evitar cache agresivo
    iframe.src = `${url}?t=${new Date().getTime()}`;
    viewer.classList.remove('hidden');
}

function closePdfViewer() {
    const viewer = document.getElementById('pdf-modal');
    const iframe = document.getElementById('pdf-iframe');
    
    iframe.src = "about:blank"; // Liberar memoria del PDF
    viewer.classList.add('hidden');
}

function resetApp() {
    closePdfViewer();
    document.getElementById('result-panel').classList.add('hidden');
    document.getElementById('scanner-container').classList.remove('hidden');
    
    resumeScanner();
}

function resumeScanner() {
    if(html5QrcodeScanner) {
        html5QrcodeScanner.resume();
        isScanning = true;
        updateStatus("Listo para escanear", "info");
    }
}

function updateStatus(msg, type) {
    const el = document.getElementById('status-bar');
    el.innerText = msg;
    el.className = `status-${type}`;
}

function setupEvents() {
    document.getElementById('btn-reset').addEventListener('click', resetApp);
    document.getElementById('btn-close-pdf').addEventListener('click', closePdfViewer);
}