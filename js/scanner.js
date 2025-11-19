let html5Qrcode;
let scannerActivo = false;
const API_BASE = "api/";
let appConfig = { timeout_segundos: 30 };
let inactivityTimer;

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
  if (typeof pdfjsLib !== "undefined")
    pdfjsLib.GlobalWorkerOptions.workerSrc = "js/libs/pdf.worker.min.js";

  initUI();
  initScanner();
  updateHistory();

  ["mousemove", "keypress", "touchstart", "click"].forEach((e) =>
    document.addEventListener(e, resetTimer)
  );

  document.getElementById("manualCodeButton").addEventListener("click", () => {
    if (manualInput.value.trim()) {
      buscar(manualInput.value.trim());
      manualInput.value = "";
    }
  });

  manualInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") document.getElementById("manualCodeButton").click();
  });
  document
    .getElementById("scan-new-button")
    .addEventListener("click", () => location.reload());

  const btnClear = document.getElementById("limpiar-historial");
  if (btnClear)
    btnClear.addEventListener("click", () => {
      localStorage.removeItem("scanned_codes");
      updateHistory();
    });

  pdfPrevBtn.addEventListener("click", onPrev);
  pdfNextBtn.addEventListener("click", onNext);
});

function cargarConfig() {
  fetch(API_BASE + "admin.php?action=get_config")
    .then((r) => r.json())
    .then((c) => {
      if (c.timeout_segundos) {
        appConfig.timeout_segundos = parseInt(c.timeout_segundos);
        resetTimer();
      }
    })
    .catch(console.error);
}

function resetTimer() {
  clearTimeout(inactivityTimer);
  if (resultView && resultView.style.display === "flex") {
    inactivityTimer = setTimeout(
      () => location.reload(),
      appConfig.timeout_segundos * 1000
    );
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
  if (typeof Html5Qrcode === "undefined") return;
  html5Qrcode = new Html5Qrcode("scanner-region");
  if (!scannerActivo) {
    html5Qrcode
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (txt) => buscar(txt.trim()),
        () => {}
      )
      .then(() => {
        scannerActivo = true;
        document.getElementById("scanner-region").style.display = "block";
        document.querySelector(".scanner-placeholder").style.display = "none";
      })
      .catch(console.warn);
  }
}

function updateHistory() {
  const cont = document.getElementById("historial-container");
  if (!cont) return;
  const list = JSON.parse(localStorage.getItem("scanned_codes") || "[]");
  if (list.length === 0) {
    cont.innerHTML = '<p class="history-empty">Sin historial</p>';
    return;
  }
  cont.innerHTML = list
    .map(
      (i) =>
        `<div class="history-item" onclick="buscar('${i.code}')"><strong>${i.code}</strong><small>${i.date}</small></div>`
    )
    .join("");
}

function loadPDF(url) {
  document.getElementById("pdf-viewer-container").style.display = "flex";
  pdfControls.style.display = "flex";
  pdfjsLib
    .getDocument(url)
    .promise.then((doc) => {
      pdfDoc = doc;
      pdfPageCountSpan.textContent = pdfDoc.numPages;
      renderPage((pageNum = 1));
      resetTimer();
    })
    .catch((e) => console.error(e));
}

function renderPage(num) {
  pageRendering = true;
  pdfPageNumSpan.textContent = num;
  pdfPrevBtn.disabled = num <= 1;
  pdfNextBtn.disabled = num >= pdfDoc.numPages;
  pdfDoc.getPage(num).then((page) => {
    const viewport = page.getViewport({ scale: pdfScale });
    pdfCanvas.height = viewport.height;
    pdfCanvas.width = viewport.width;
    page
      .render({ canvasContext: pdfCtx, viewport: viewport })
      .promise.then(() => {
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

async function buscar(code) {
  try {
    const list = JSON.parse(localStorage.getItem("scanned_codes") || "[]");
    if (!list.length || list[0].code !== code) {
      list.unshift({ code: code, date: new Date().toLocaleString() });
      if (list.length > 10) list.pop();
      localStorage.setItem("scanned_codes", JSON.stringify(list));
      updateHistory();
    }
  } catch (e) {}

  try {
    const res = await fetch(
      `${API_BASE}buscar.php?codigo=${encodeURIComponent(code)}`
    );
    const data = await res.json();

    scannerView.style.display = "none";
    resultView.style.display = "flex";
    if (scannerActivo)
      html5Qrcode.stop().then(() => {
        scannerActivo = false;
        document.getElementById("scanner-region").style.display = "none";
      });

    const info = document.getElementById("ficha-info");
    if (data.encontrado) {
      if (data.pdf)
        loadPDF(
          `${API_BASE}ver_pdf.php?archivo=${encodeURIComponent(data.pdf)}`
        );
      info.innerHTML = `<p><strong>${data.producto.codigo}</strong> - ${data.producto.descripcion}</p>`;
    } else {
      info.innerHTML = `<p style="color:var(--danger-color)">No encontrado: ${data.codigo_buscado}</p>`;
      resetTimer();
    }
  } catch (e) {
    alert("Error de conexión");
  }
}
