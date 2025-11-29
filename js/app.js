/**
 * Lógica Scanner - Optimización para Producción
 * Daruma Consulting SRL
 */

const CONFIG = {
    fps: 10,
    qrbox: 250,
    aspectRatio: 1.0
};

let html5QrcodeScanner = null;
let isScanning = false;

// Evento principal: intenta arrancar apenas carga la página
document.addEventListener('DOMContentLoaded', () => {
    initScanner();
    setupEvents();
});

function initScanner() {
    // Si ya existe instancia, limpiamos
    if(html5QrcodeScanner) {
        try { html5QrcodeScanner.clear(); } catch(e) { console.warn(e); }
    }

    // Configuración del Scanner
    html5QrcodeScanner = new Html5QrcodeScanner(
        "reader", 
        { 
            fps: CONFIG.fps, 
            qrbox: CONFIG.qrbox,
            aspectRatio: CONFIG.aspectRatio,
            rememberLastUsedCamera: true, // CLAVE: Recuerda la cámara elegida
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        },
        /* verbose= */ false
    );

    // Renderiza el scanner. 
    // NOTA: La primera vez requiere click del usuario por seguridad del navegador.
    // Las siguientes veces, si 'rememberLastUsedCamera' funciona en el dispositivo,
    // debería entrar derecho.
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    
    isScanning = true;
    updateStatus("Cámara lista. Apunte al código.", "info");
}

function onScanSuccess(decodedText, decodedResult) {
    if (!isScanning) return;

    // DETENER scanner para liberar RAM inmediatamente
    console.log(`Detectado: ${decodedText}`);
    html5QrcodeScanner.pause(true); 
    isScanning = false;

    updateStatus("Procesando...", "warning");
    
    // Llamada a la API
    fetch(`api/scan.php?code=${encodeURIComponent(decodedText)}`)
        .then(response => response.json())
        .then(data => {
            if (data.found) {
                showResult(data);
            } else {
                updateStatus(`Código ${decodedText} NO encontrado`, "error");
                // Breve pausa y retomamos escaneo
                setTimeout(resumeScanner, 2500); 
            }
        })
        .catch(err => {
            console.error(err);
            updateStatus("Error de conexión con API", "error");
            setTimeout(resumeScanner, 3000);
        });
}

function onScanFailure(error) {
    // Ruido de log, ignorar para performance
}

function showResult(data) {
    const resultDiv = document.getElementById('result-panel');
    const scannerDiv = document.getElementById('scanner-container');
    
    // Swap de pantallas
    scannerDiv.classList.add('hidden');
    resultDiv.classList.remove('hidden');

    // Llenar datos
    const infoContainer = document.getElementById('info-content');
    let html = `<h3>Código: ${data.code}</h3><ul class="data-list">`;
    
    // Renderizamos las columnas del CSV
    data.data.forEach((val, index) => {
        // Ignoramos la col 0 (código) y las vacías
        if(index > 0 && val.trim() !== "") { 
            html += `<li><strong>Dato ${index}:</strong> ${val}</li>`;
        }
    });
    html += `</ul>`;
    infoContainer.innerHTML = html;

    // Botón de PDF
    const btnPdf = document.getElementById('btn-open-pdf');
    const pdfContainer = document.getElementById('pdf-container');
    
    if (data.pdf_available) {
        btnPdf.style.display = 'inline-flex'; // Flex para el icono
        btnPdf.onclick = () => openPdfViewer(data.pdf_url);
    } else {
        btnPdf.style.display = 'none';
        pdfContainer.innerHTML = '<p class="no-pdf">Sin documento asociado</p>';
    }
}

function openPdfViewer(url) {
    const viewer = document.getElementById('pdf-modal');
    const iframe = document.getElementById('pdf-iframe');
    
    // Cache bust para evitar versiones viejas
    iframe.src = `${url}?t=${new Date().getTime()}`;
    viewer.classList.remove('hidden');
}

function closePdfViewer() {
    const viewer = document.getElementById('pdf-modal');
    const iframe = document.getElementById('pdf-iframe');
    
    iframe.src = "about:blank"; // Liberar memoria CRÍTICO
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
        // Resume el scanner pausado
        html5QrcodeScanner.resume();
        isScanning = true;
        updateStatus("Listo para escanear", "info");
    }
}

function updateStatus(msg, type) {
    const el = document.getElementById('status-bar');
    if(el) {
        el.innerText = msg;
        el.className = `status-${type}`;
    }
}

function setupEvents() {
    const btnReset = document.getElementById('btn-reset');
    if(btnReset) btnReset.addEventListener('click', resetApp);
    
    const btnClose = document.getElementById('btn-close-pdf');
    if(btnClose) btnClose.addEventListener('click', closePdfViewer);
}
