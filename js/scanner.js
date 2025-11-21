let html5Qrcode;
let scannerActivo = false;
const API_BASE = "api/";
let appConfig = { timeout_segundos: 30 };
let inactivityTimer;

// PDF State
let pdfDoc = null,
  pageNum = 1,
  pageRendering = false,
  pageNumPending = null;
const pdfScale = 1.5;
let pdfCanvas,
  pdfCtx,
  pdfControls,
  pdfPrevBtn,
  pdfNextBtn,
  pdfPageNumSpan,
  pdfPageCountSpan;

let scannerView, resultView, manualInput;

document.addEventListener("DOMContentLoaded", function () {
  cargarConfig();
  
  // Initialize PDF.js worker
  if (typeof pdfjsLib !== "undefined") {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "js/libs/pdf.worker.min.js";
  }

  initUI();
  initScanner();
  updateHistory();

  // Activity listeners to reset timer
  ["mousemove", "keypress", "touchstart", "click"].forEach((e) =>
    document.addEventListener(e, resetTimer)
  );

  // Manual Input Events
  document.getElementById("manualCodeButton").addEventListener("click", handleManualSearch);
  manualInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleManualSearch();
  });

  // Reset/Back Button
  document
    .getElementById("scan-new-button")
    .addEventListener("click", () => {
        resetInterface();
    });

  // Clear History
  const btnClear = document.getElementById("limpiar-historial");
  if (btnClear)
    btnClear.addEventListener("click", () => {
      if(confirm('¿Borrar todo el historial?')) {
          localStorage.removeItem("scanned_codes");
          updateHistory();
      }
    });

  // PDF Controls
  pdfPrevBtn.addEventListener("click", onPrev);
  pdfNextBtn.addEventListener("click", onNext);
});

function handleManualSearch() {
    const val = manualInput.value.trim();
    if (val) {
      buscar(val);
      manualInput.value = "";
      manualInput.blur();
    }
}

function cargarConfig() {
  fetch(API_BASE + "admin.php?action=get_config")
    .then((r) => r.json())
    .then((c) => {
      if (c.timeout_segundos) {
        appConfig.timeout_segundos = parseInt(c.timeout_segundos);
        // Only set timer if we are already in result view (unlikely on load but good practice)
        if (resultView && resultView.style.display === "flex") {
            resetTimer();
        }
      }
    })
    .catch(console.error);
}

function resetTimer() {
  clearTimeout(inactivityTimer);
  if (resultView && resultView.style.display === "flex") {
    inactivityTimer = setTimeout(
      () => resetInterface(),
      appConfig.timeout_segundos * 1000
    );
  }
}

function resetInterface() {
    resultView.style.display = "none";
    scannerView.style.display = "flex"; // or block depending on css
    
    // Clear PDF
    pdfDoc = null;
    pdfCtx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
    
    // Restart Scanner if needed
    if (!scannerActivo) {
        startScanner();
    }
}

function initUI() {
  scannerView = document.getElementById("scanner-view-container");
  resultView = document.getElementById("result-view-container");
  manualInput = document.getElementById("manualCodeInput");
  
  pdfCanvas = document.getElementById("pdf-canvas");
  pdfCtx = pdfCanvas.getContext("2d");
  pdfControls = document.getElementById("pdf-controls");
  pdfPrevBtn = document.getElementById("pdf-prev");
  pdfNextBtn = document.getElementById("pdf-next");
  pdfPageNumSpan = document.getElementById("pdf-page-num");
  pdfPageCountSpan = document.getElementById("pdf-page-count");
}

function initScanner() {
  if (typeof Html5Qrcode === "undefined") {
    console.error("Html5Qrcode no está cargado");
    return;
  }
  
  const scannerElement = document.getElementById("scanner-region");
  if (!scannerElement) return;
  
  html5Qrcode = new Html5Qrcode("scanner-region");
  startScanner();
}

function startScanner() {
    if(scannerActivo) return;
    
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    // Prefer back camera
    html5Qrcode.start(
        { facingMode: "environment" }, 
        config, 
        (txt) => {
            // Success callback
            buscar(txt.trim());
        },
        (err) => {
            // Error callback (scanning...)
            // console.log(err); 
        }
    ).then(() => {
        scannerActivo = true;
        document.querySelector(".scanner-placeholder").style.display = "none";
    }).catch(err => {
        console.error("Error starting scanner", err);
        document.querySelector(".scanner-placeholder").innerHTML = "<p>Error al iniciar cámara. <br>Verifique permisos.</p>";
    });
}

function stopScanner() {
    if(scannerActivo && html5Qrcode) {
        html5Qrcode.stop().then(() => {
            scannerActivo = false;
            document.querySelector(".scanner-placeholder").style.display = "flex";
        }).catch(err => console.error("Failed to stop scanner", err));
    }
}

function updateHistory() {
  const cont = document.getElementById("historial-container");
  if (!cont) return;
  
  const list = JSON.parse(localStorage.getItem("scanned_codes") || "[]");
  
  if (list.length === 0) {
    cont.innerHTML = '<div class="history-empty">No hay búsquedas recientes</div>';
    return;
  }
  
  cont.innerHTML = list
    .map(
      (i) =>
        `<div class="history-item" onclick="buscar('${i.code}')">
            <div>
                <strong>${i.code}</strong>
                <div style="font-size:0.8em; color:#666">${i.desc || ''}</div>
            </div>
            <small style="color:#999">${i.date_short || ''}</small>
         </div>`
    )
    .join("");
}

function addToHistory(code, desc) {
    try {
        let list = JSON.parse(localStorage.getItem("scanned_codes") || "[]");
        // Remove if exists to move to top
        list = list.filter(i => i.code !== code);
        
        const now = new Date();
        const dateShort = now.getHours() + ":" + (now.getMinutes()<10?'0':'') + now.getMinutes();
        
        list.unshift({ 
            code: code, 
            desc: desc,
            date: now.toLocaleString(),
            date_short: dateShort
        });
        
        if (list.length > 10) list.pop();
        localStorage.setItem("scanned_codes", JSON.stringify(list));
        updateHistory();
    } catch (e) { console.error(e); }
}

// --- PDF Functions ---

function loadPDF(url) {
  // Show loading state if needed
  pdfjsLib
    .getDocument(url)
    .promise.then((doc) => {
      pdfDoc = doc;
      pdfPageCountSpan.textContent = pdfDoc.numPages;
      renderPage((pageNum = 1));
      resetTimer();
    })
    .catch((e) => {
        console.error(e);
        alert("Error al cargar el PDF.");
    });
}

function renderPage(num) {
  pageRendering = true;
  pdfPageNumSpan.textContent = num;
  
  // Update buttons state
  pdfPrevBtn.disabled = num <= 1;
  pdfNextBtn.disabled = num >= pdfDoc.numPages;
  pdfPrevBtn.style.opacity = num <= 1 ? "0.5" : "1";
  pdfNextBtn.style.opacity = num >= pdfDoc.numPages ? "0.5" : "1";

  pdfDoc.getPage(num).then((page) => {
    const viewport = page.getViewport({ scale: pdfScale });
    pdfCanvas.height = viewport.height;
    pdfCanvas.width = viewport.width;

    const renderContext = {
      canvasContext: pdfCtx,
      viewport: viewport,
    };
    
    const renderTask = page.render(renderContext);

    renderTask.promise.then(() => {
      pageRendering = false;
      if (pageNumPending !== null) {
        renderPage(pageNumPending);
        pageNumPending = null;
      }
    });
  });
}

function onPrev() {
  if (pageNum <= 1) return;
  renderPage(--pageNum);
  resetTimer();
}
function onNext() {
  if (pageNum >= pdfDoc.numPages) return;
  renderPage(++pageNum);
  resetTimer();
}

// --- Search Logic ---

async function buscar(code) {
  // Show loading or something?
  
  try {
    const res = await fetch(
      `${API_BASE}buscar.php?codigo=${encodeURIComponent(code)}`
    );
    const data = await res.json();

    if (data.encontrado) {
        // Stop scanner to save battery/resources
        stopScanner();
        
        // Switch view
        scannerView.style.display = "none";
        resultView.style.display = "flex";
        
        const info = document.getElementById("ficha-info");
        info.innerHTML = `
            <div style="font-weight:700; color:var(--primary)">${data.producto.codigo}</div>
            <div style="font-size:0.9em; color:var(--text-muted)">${data.producto.descripcion}</div>
        `;
        
        // Add to history
        addToHistory(data.producto.codigo, data.producto.descripcion);

        if (data.pdf) {
            loadPDF(`${API_BASE}ver_pdf.php?archivo=${encodeURIComponent(data.pdf)}`);
        } else {
            // No PDF found but product exists
            pdfCtx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
            pdfCtx.font = "20px Arial";
            pdfCtx.fillText("PDF no encontrado", 50, 50);
            alert("Producto encontrado pero no tiene PDF asociado.");
        }
        
        resetTimer();
        
    } else {
        // Not found
        alert(`Producto no encontrado: ${code}`);
        // Don't stop scanner, let them try again
    }
    
  } catch (e) {
    console.error(e);
    alert("Error de conexión con el servidor.");
  }
}
