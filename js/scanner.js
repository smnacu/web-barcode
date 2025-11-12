let html5Qrcode;
let scannerActivo = false;
let currentCameraId = null;

const API_BASE = 'api/';

// PDF.js
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
const pdfScale = 1.5;
let pdfCanvas, pdfCtx, pdfControls, pdfPrevBtn, pdfNextBtn, pdfPageNumSpan, pdfPageCountSpan;

// Elementos de la UI
let fichaInfoElement, pdfViewerElement, logContainer, manualInput, manualButton, 
    scannerRegion, cameraContainer, cameraSelector, limpiarHistorialBtn;

// ¡CAMBIO! Elementos para la UI Limpia
let scannerViewContainer, resultViewContainer, scanNewButton, settingsBtn, settingsModal, 
    settingsCloseBtn, cameraSelectorWrapper;

document.addEventListener("DOMContentLoaded", function() {
    // Worker local
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/libs/pdf.worker.min.js';
    }

    inicializarElementos();
    inicializarScanner(); // Inicia el escáner y la lógica de cámaras
    actualizarHistorial();
    
    manualButton.addEventListener("click", () => {
        const code = manualInput.value.trim();
        if (code) {
            buscarProducto(code);
            manualInput.value = ''; // Limpia al buscar
        }
    });

    manualInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            manualButton.click(); 
        }
    });

    // ¡CAMBIO! Este botón ahora recarga la página
    scanNewButton.addEventListener("click", () => {
        location.reload();
    });

    if (limpiarHistorialBtn) {
        limpiarHistorialBtn.addEventListener("click", () => {
            localStorage.removeItem('codigosEscaneados');
            actualizarHistorial();
            log("Historial limpiado");
        });
    }

    // Eventos de PDF
    pdfPrevBtn.addEventListener('click', onPrevPage);
    pdfNextBtn.addEventListener('click', onNextPage);

    // Eventos del Modal de Configuración
    settingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'flex';
    });

    settingsCloseBtn.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });
    
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });
});

function inicializarElementos() {
    // Vistas principales
    scannerViewContainer = document.getElementById("scanner-view-container");
    resultViewContainer = document.getElementById("result-view-container");

    // Ficha de producto (ahora es el header de resultado)
    fichaInfoElement = document.getElementById("ficha-info");
    pdfViewerElement = document.getElementById("pdf-viewer-container");

    // Visor PDF
    pdfCanvas = document.getElementById('pdf-canvas');
    pdfCtx = pdfCanvas.getContext('2d');
    pdfControls = document.getElementById('pdf-controls');
    pdfPrevBtn = document.getElementById('pdf-prev');
    pdfNextBtn = document.getElementById('pdf-next');
    pdfPageNumSpan = document.getElementById('pdf-page-num');
    pdfPageCountSpan = document.getElementById('pdf-page-count');

    // Scanner
    logContainer = document.getElementById("log-container");
    manualInput = document.getElementById("manualCodeInput");
    manualButton = document.getElementById("manualCodeButton");
    scannerRegion = document.getElementById("scanner-region");
    limpiarHistorialBtn = document.getElementById("limpiar-historial");
    
    // Botón de "Escanear Otro"
    scanNewButton = document.getElementById("scan-new-button");

    // Modal de Configuración
    settingsBtn = document.getElementById("settings-btn");
    settingsModal = document.getElementById("settings-modal");
    settingsCloseBtn = document.getElementById("settings-close-btn");
    cameraSelectorWrapper = document.getElementById("camera-selector-wrapper");
    
    // (El cameraSelector se crea dinámicamente)

    if (typeof Html5Qrcode === 'undefined') {
        log("ERROR: Libreria html5-qrcode no cargada");
        mostrarError("Error de Sistema", "No se pudo cargar la libreria de escaneo");
        return;
    }
     if (typeof pdfjsLib === 'undefined') {
        log("ERROR: Libreria pdf.js no cargada (pdf.min.js)");
        mostrarError("Error de Sistema", "No se pudo cargar la libreria de PDF");
        return;
    }

    log("Sistema inicializado correctamente");
}

// Esta función se llama ANTES de una nueva búsqueda
function limpiarVistaDeResultado() {
    if (fichaInfoElement) {
        fichaInfoElement.innerHTML = '';
    }
    if (pdfViewerElement) {
        pdfViewerElement.style.display = 'none';
    }
    if (pdfControls) {
        pdfControls.style.display = 'none';
    }
    pdfDoc = null;
    pageNum = 1;
}
// NO la hacemos global

function log(mensaje) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${mensaje}`;
    console.log(logMessage);
    
    if (logContainer) {
        const logEntry = document.createElement("div");
        logEntry.className = "log-entry";
        logEntry.textContent = logMessage;
        logContainer.insertBefore(logEntry, logContainer.firstChild);
        
        while (logContainer.children.length > 10) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }
}

function logError(err) {
    log("Error: " + err);
}

function mostrarError(titulo, mensaje) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        max-width: 400px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    content.innerHTML = `
        <h3 style="color: #e74c3c; margin-top: 0;">${titulo}</h3>
        <p>${mensaje}</p>
        <button onclick="this.parentElement.parentElement.remove()" style="
            background: #3498db;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
        ">Cerrar</button>
    `;
    modal.appendChild(content);
    document.body.appendChild(modal);
}

function inicializarScanner() {
    html5Qrcode = new Html5Qrcode("scanner-region");
    
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices()
            .then(devices => {
                const videoDevices = devices.filter(device => device.kind === 'videoinput');
                
                if (videoDevices.length > 0) {
                    cameraSelectorWrapper.innerHTML = ''; 
                    
                    if (videoDevices.length > 1) {
                        const label = document.createElement('label');
                        label.htmlFor = 'cameraSelector';
                        label.innerText = 'Seleccionar Camara: ';
                        cameraSelectorWrapper.appendChild(label);

                        cameraSelector = document.createElement('select');
                        cameraSelector.id = 'cameraSelector';
                        cameraSelectorWrapper.appendChild(cameraSelector);
                    
                        videoDevices.forEach(device => {
                            const option = document.createElement('option');
                            option.value = device.deviceId;
                            option.textContent = device.label || `Camara ${device.deviceId.substr(0, 8)}...`;
                            cameraSelector.appendChild(option);
                        });

                        cameraSelector.addEventListener("change", () => {
                            currentCameraId = cameraSelector.value; // Actualizamos el ID
                            if (scannerActivo) {
                                // Si el scanner está andando, lo reiniciamos con la nueva cámara
                                html5Qrcode.stop().then(() => {
                                    iniciarScanner();
                                }).catch(logError);
                            }
                        });
                    } else {
                         cameraSelectorWrapper.innerHTML = '<p>Se detectó 1 cámara.</p>';
                    }

                } else {
                    cameraSelectorWrapper.innerHTML = '<p>No se encontraron cámaras.</p>';
                }
                
                // Iniciar scanner automáticamente
                iniciarScanner();

            })
            .catch(err => {
                log("Error al enumerar dispositivos: " + err);
                cameraSelectorWrapper.innerHTML = `<p style="color:var(--danger-color)">Error al listar cámaras.</p>`;
            });
    } else {
        cameraSelectorWrapper.innerHTML = `<p style="color:var(--danger-color)">Error: MediaDevices no soportado.</p>`;
    }
}

function iniciarScanner() {
    // Si ya está activo, no hacemos nada (evita doble inicio)
    if (scannerActivo) return;

    const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
    
    const successCallback = (decodedText, decodedResult) => {
        log(`Codigo detectado: ${decodedText}`);
        html5Qrcode.stop();
        scannerActivo = false;
        scannerRegion.style.display = "none";
        
        const codigoLimpio = decodedText.trim();
        buscarProducto(codigoLimpio);
    };
    
    const errorCallback = (error) => {
        // Silenciamos el error "No QR code found"
        if (!error.includes('No MultiFormat Readers were able to detect the code') && !error.includes('not found')) {
            console.warn('Scanner error:', error);
        }
    };
    
    // Usar la cámara seleccionada si existe
    if (cameraSelector) {
        currentCameraId = cameraSelector.value;
    }
    const cameraConfig = currentCameraId ? { deviceId: { exact: currentCameraId } } : { facingMode: "environment" };
    
    html5Qrcode.start(
        cameraConfig,
        config,
        successCallback,
        errorCallback
    ).then(() => {
        scannerActivo = true;
        log("Scanner iniciado correctamente");
        scannerRegion.style.display = "block";
        document.querySelector('.scanner-placeholder').style.display = 'none';
    }).catch(err => {
        log("Error al iniciar scanner: " + err);
        document.querySelector('.scanner-placeholder').innerHTML = 'Error al iniciar cámara. Revise permisos.';
        document.querySelector('.scanner-placeholder').style.display = 'flex';
        scannerRegion.style.display = 'block'; // Mostramos el scanner region con el error
    });
}

function actualizarHistorial() {
    const historialContainer = document.getElementById("historial-container");
    if (!historialContainer) return;
    
    const codigos = JSON.parse(localStorage.getItem('codigosEscaneados') || '[]');
    
    if (codigos.length === 0) {
        historialContainer.innerHTML = '<p class="history-empty">No hay códigos escaneados</p>';
        return;
    }
    
    let html = '';
    codigos.forEach(item => {
        const codigoEscapado = item.codigo.replace(/'/g, "\\'").replace(/"/g, '\\"');
        html += `
            <div class="history-item" onclick="buscarProducto('${codigoEscapado}')">
                <strong>${item.codigo}</strong>
                <small>${item.fecha}</small>
            </div>
        `;
    });
    
    historialContainer.innerHTML = html;
}

// --- Funciones de PDF.js (sin cambios) ---

function cargarPDF(url) {
    pdfViewerElement.style.display = 'flex'; // ¡CAMBIO! display 'flex'
    pdfControls.style.display = 'flex';
    
    pdfjsLib.getDocument(url).promise.then(function(pdfDoc_) {
        pdfDoc = pdfDoc_;
        pdfPageCountSpan.textContent = pdfDoc.numPages;
        pageNum = 1;
        renderPage(pageNum);
    }).catch(function(err) {
        logError("Error al cargar PDF: " + err.message);
        fichaInfoElement.innerHTML += `<p style="color: var(--danger-color);">Error al cargar el PDF.</p>`;
        pdfViewerElement.style.display = 'none';
        pdfControls.style.display = 'none';
    });
}

function renderPage(num) {
    pageRendering = true;
    pdfPageNumSpan.textContent = num;

    pdfPrevBtn.disabled = (num <= 1);
    pdfNextBtn.disabled = (num >= pdfDoc.numPages);

    pdfDoc.getPage(num).then(function(page) {
        const viewport = page.getViewport({ scale: pdfScale });
        pdfCanvas.height = viewport.height;
        pdfCanvas.width = viewport.width;

        const renderContext = {
            canvasContext: pdfCtx,
            viewport: viewport
        };
        const renderTask = page.render(renderContext);

        renderTask.promise.then(function() {
            pageRendering = false;
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    });
}

function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

function onPrevPage() {
    if (pageNum <= 1) {
        return;
    }
    pageNum--;
    queueRenderPage(pageNum);
}
window.onPrevPage = onPrevPage; 

function onNextPage() {
    if (pdfDoc === null || pageNum >= pdfDoc.numPages) {
        return;
    }
    pageNum++;
    queueRenderPage(pageNum);
}
window.onNextPage = onNextPage; 

// --- Fin Funciones PDF.js ---


function mostrarResultado(data) {
    // ¡CAMBIO! Ocultar la vista del scanner y mostrar la del resultado
    scannerViewContainer.style.display = 'none';
    resultViewContainer.style.display = 'flex'; // ¡CAMBIO! display 'flex'
    
    // Detener el scanner si está activo (por si fue búsqueda manual)
    if (scannerActivo) {
        html5Qrcode.stop().then(() => {
            scannerActivo = false;
            scannerRegion.style.display = "none";
        }).catch(logError);
    }

    let fichaHTML = '';
    // Limpiamos el visor de PDF y la info anterior
    limpiarVistaDeResultado();

    if (data.encontrado) {
        if (data.pdf) {
            const pdfUrl = `Pdf/${data.pdf}`;
            log(`Cargando PDF desde: ${pdfUrl}`);
            cargarPDF(pdfUrl);
        }
        
        // ¡CAMBIO! Ficha de info compacta
        fichaHTML = `
            <p>
                <strong>${data.producto.codigo}</strong>
                <span>(${data.producto.ean})</span>
                - ${data.producto.descripcion}
                <i>[Fuente: ${data.fuente}]</i>
            </p>
        `;
    } else {
            fichaHTML = `
            <p style="color: var(--danger-color);">
                <strong>Código no encontrado:</strong> ${data.codigo_buscado}
            </p>
        `;
    }
    
    fichaInfoElement.innerHTML = fichaHTML;
    // (fichaElement ya no existe)
    
    // ¡Sin Timeout!
}

async function buscarProducto(code) {
    // Limpiamos la vista de resultado anterior (por si hacemos clic en el historial)
    limpiarVistaDeResultado();
    log(`Buscando producto: "${code}"`);

    // ¡ARREGLO CACHÉ! Guardamos CUALQUIER búsqueda en el historial
    try {
        const codigos = JSON.parse(localStorage.getItem('codigosEscaneados') || '[]');
        
        if (codigos.length === 0 || codigos[0].codigo !== code) {
            codigos.unshift({
                codigo: code,
                fecha: new Date().toLocaleString()
            });
            if (codigos.length > 10) codigos.pop();
            localStorage.setItem('codigosEscaneados', JSON.stringify(codigos));
            actualizarHistorial();
        }
    } catch (e) {
        logError("Error al guardar historial: " + e);
    }
    
    try {
        const response = await fetch(`${API_BASE}buscar.php?codigo=${encodeURIComponent(code)}`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            log(`Error en API: ${data.mensaje}`);
            mostrarError("Error", data.mensaje);
            return;
        }
        
        mostrarResultado(data);
        log(`Producto ${data.encontrado ? 'encontrado' : 'no encontrado'}`);
        
    } catch (error) {
        log("Error de conexión: " + error);
        mostrarError("Error de Conexión", "No se puede conectar con el servidor.");
    }
}