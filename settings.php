<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuracion Daruma</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body style="background: #f3f4f6;">
<div class="settings-container">
    <a href="index.html" style="color: var(--primary); text-decoration: none; font-weight: 700;">&larr; Volver</a>
    <h1>Panel de Control</h1>
    <p class="subtitle">Configuracion del sistema</p>
    <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;">

    <form id="configForm">
        <div class="form-group">
            <label>📂 Ruta PDF</label>
            <p style="font-size:0.8em; color:#666">Ej: <code>../Pdf/</code>, <code>D:\Planos\</code> o <code>\\SRV01\Docs\</code></p>
            <div style="display:flex; gap:10px;">
                <input type="text" id="ruta_pdf" name="ruta_pdf">
                <button type="button" class="btn btn-primary" onclick="testPath('ruta_pdf', 'dir')">Probar</button>
            </div>
            <div id="msg_ruta_pdf" class="status-msg"></div>
        </div>

        <div class="form-group">
            <label>📄 Ruta CSV</label>
            <p style="font-size:0.8em; color:#666">Ej: <code>../csv/Libro.csv</code></p>
            <div style="display:flex; gap:10px;">
                <input type="text" id="ruta_csv" name="ruta_csv">
                <button type="button" class="btn btn-primary" onclick="testPath('ruta_csv', 'file')">Probar</button>
            </div>
            <div id="msg_ruta_csv" class="status-msg"></div>
        </div>

        <div class="form-group">
            <label>⏱️ Timeout (Segundos)</label>
            <input type="number" id="timeout_segundos" name="timeout_segundos" min="5">
        </div>

        <button type="submit" class="btn btn-success" style="width:100%">Guardar</button>
    </form>

    <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
    <h3>📥 Cargar Datos</h3>
    <p style="font-size:0.9em; color:#666;">Formato requerido: <strong>CSV</strong>.</p>
    
    <form id="uploadForm">
        <div class="form-group">
            <div style="display:flex; gap:10px;">
                <input type="file" id="archivo_csv" name="archivo_csv" accept=".csv,.txt" style="background:white;">
                <button type="submit" class="btn btn-primary">Subir</button>
            </div>
            <div id="upload_status" class="status-msg"></div>
        </div>
    </form>
</div>

<script>
    const API_URL = 'api/admin.php';
    document.addEventListener('DOMContentLoaded', () => {
        fetch(API_URL + '?action=get_config').then(r => r.json()).then(d => {
            document.getElementById('ruta_pdf').value = d.ruta_pdf;
            document.getElementById('ruta_csv').value = d.ruta_csv;
            document.getElementById('timeout_segundos').value = d.timeout_segundos;
        });
    });
    function testPath(id, type) {
        const p = document.getElementById(id).value;
        const m = document.getElementById('msg_' + id);
        m.textContent = 'Verificando...'; m.className='status-msg';
        const fd = new FormData(); fd.append('action','test_path'); fd.append('path',p); fd.append('type',type);
        fetch(API_URL, {method:'POST', body:fd}).then(r=>r.json()).then(d=>{
            m.textContent = d.msg; m.className = 'status-msg ' + (d.success?'success':'error');
        });
    }
    document.getElementById('configForm').addEventListener('submit', e => {
        e.preventDefault();
        fetch(API_URL, {method:'POST', body:new FormData(e.target)}).then(r=>r.json()).then(d=>{alert(d.msg); if(d.success) location.reload();});
    });
    document.getElementById('uploadForm').addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(e.target); fd.append('action','upload_csv');
        document.getElementById('upload_status').textContent = "Subiendo...";
        fetch(API_URL, {method:'POST', body:fd}).then(r=>r.json()).then(d=>{
            const s = document.getElementById('upload_status');
            s.textContent = d.msg; s.className = 'status-msg ' + (d.success?'success':'error');
        });
    });
</script>
</body>
</html>