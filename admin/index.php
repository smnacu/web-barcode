<?php
session_start();
// If not logged in, show login form
if (!isset($_SESSION['logged_in']) || !$_SESSION['logged_in']) {
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - Daruma</title>
    <link rel="stylesheet" href="../css/styles.css">
    <style>
        body { display: flex; justify-content: center; align-items: center; height: 100vh; background: #f3f4f6; }
        .login-card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
        .login-card h2 { margin-top: 0; text-align: center; color: var(--primary); }
    </style>
</head>
<body>
    <div class="login-card">
        <h2>Acceso Admin</h2>
        <form id="loginForm">
            <div class="form-group">
                <label>Contraseña</label>
                <input type="password" id="password" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Ingresar</button>
            <p id="loginMsg" class="status-msg" style="margin-top: 1rem;"></p>
        </form>
    </div>
    <script>
        document.getElementById('loginForm').addEventListener('submit', e => {
            e.preventDefault();
            const pass = document.getElementById('password').value;
            const fd = new FormData();
            fd.append('action', 'login');
            fd.append('password', pass);

            fetch('../api/admin.php', { method: 'POST', body: fd })
                .then(r => r.json())
                .then(d => {
                    if (d.success) {
                        location.reload();
                    } else {
                        const m = document.getElementById('loginMsg');
                        m.textContent = d.msg;
                        m.className = 'status-msg error';
                    }
                });
        });
    </script>
</body>
</html>
<?php
    exit;
}
// If logged in, show admin panel
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel Admin - Daruma</title>
    <link rel="stylesheet" href="../css/styles.css">
    <style>
        .nav-tabs { display: flex; border-bottom: 1px solid #ddd; margin-bottom: 20px; }
        .nav-item { padding: 10px 20px; cursor: pointer; border-bottom: 2px solid transparent; }
        .nav-item.active { border-bottom-color: var(--primary); color: var(--primary); font-weight: bold; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .csv-editor textarea { width: 100%; height: 400px; font-family: monospace; white-space: pre; }
    </style>
</head>
<body style="background: #f3f4f6;">
<div class="settings-container" style="max-width: 900px;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
        <a href="../index.html" style="color: var(--primary); text-decoration: none; font-weight: 700;">&larr; Volver a la App</a>
        <button id="logoutBtn" class="btn btn-danger btn-sm">Cerrar Sesión</button>
    </div>

    <h1>Panel de Control</h1>

    <div class="nav-tabs">
        <div class="nav-item active" data-tab="config">Configuración</div>
        <div class="nav-item" data-tab="csv">Editor CSV</div>
    </div>

    <!-- Config Tab -->
    <div id="tab-config" class="tab-content active">
        <p class="subtitle">Configuración del sistema</p>
        <form id="configForm">
            <div class="form-group">
                <label>📂 Ruta PDF</label>
                <p style="font-size:0.8em; color:#666">Ej: <code>../Pdf/</code>, <code>D:\Planos\</code></p>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="ruta_pdf" name="ruta_pdf">
                    <button type="button" class="btn btn-primary" onclick="testPath('ruta_pdf', 'dir')">Probar</button>
                </div>
                <div id="msg_ruta_pdf" class="status-msg"></div>
            </div>

            <div class="form-group">
                <label>📄 Ruta CSV Principal</label>
                <p style="font-size:0.8em; color:#666">Usado para búsquedas</p>
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

            <button type="submit" class="btn btn-success" style="width:100%">Guardar Configuración</button>
        </form>

        <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
        <h3>📥 Subir Archivo CSV</h3>
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

    <!-- CSV Editor Tab -->
    <div id="tab-csv" class="tab-content">
        <p class="subtitle">Editar archivos en carpeta <code>csv/</code></p>
        <div class="form-group">
            <label>Seleccionar Archivo:</label>
            <select id="csvFileSelect" style="width: 100%; padding: 10px; margin-bottom: 10px;">
                <option value="">-- Seleccionar --</option>
            </select>
            <button id="loadCsvBtn" class="btn btn-primary btn-sm">Cargar</button>
        </div>

        <div id="editorContainer" style="display:none;">
            <div class="csv-editor">
                <textarea id="csvContent"></textarea>
            </div>
            <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
                <button id="saveCsvBtn" class="btn btn-success">Guardar Cambios</button>
            </div>
            <div id="csvMsg" class="status-msg"></div>
        </div>
    </div>

</div>

<script>
    const API_URL = '../api/admin.php';

    // Tabs
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            item.classList.add('active');
            document.getElementById('tab-' + item.dataset.tab).classList.add('active');
        });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        fetch(API_URL + '?action=logout').then(() => location.reload());
    });

    // Load Config
    function loadConfig() {
        fetch(API_URL + '?action=get_config').then(r => r.json()).then(d => {
            document.getElementById('ruta_pdf').value = d.ruta_pdf;
            document.getElementById('ruta_csv').value = d.ruta_csv;
            document.getElementById('timeout_segundos').value = d.timeout_segundos;
        });
    }
    loadConfig();

    // Config Handlers
    window.testPath = function(id, type) {
        const p = document.getElementById(id).value;
        const m = document.getElementById('msg_' + id);
        m.textContent = 'Verificando...'; m.className='status-msg';
        const fd = new FormData(); fd.append('action','test_path'); fd.append('path',p); fd.append('type',type);
        fetch(API_URL, {method:'POST', body:fd}).then(r=>r.json()).then(d=>{
            m.textContent = d.msg; m.className = 'status-msg ' + (d.success?'success':'error');
        });
    };

    document.getElementById('configForm').addEventListener('submit', e => {
        e.preventDefault();
        fetch(API_URL, {method:'POST', body:new FormData(e.target)})
            .then(r=>r.json())
            .then(d=>{alert(d.msg); if(d.success) loadConfig();});
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

    // CSV Editor Handlers
    function loadCsvList() {
        fetch(API_URL + '?action=list_csvs').then(r => r.json()).then(d => {
            if (d.success) {
                const sel = document.getElementById('csvFileSelect');
                sel.innerHTML = '<option value="">-- Seleccionar --</option>';
                d.files.forEach(f => {
                    const opt = document.createElement('option');
                    opt.value = f;
                    opt.textContent = f;
                    sel.appendChild(opt);
                });
            }
        });
    }
    loadCsvList();

    document.getElementById('loadCsvBtn').addEventListener('click', () => {
        const filename = document.getElementById('csvFileSelect').value;
        if (!filename) return;

        const fd = new FormData();
        fd.append('action', 'read_csv');
        fd.append('filename', filename);

        fetch(API_URL, {method:'POST', body:fd}).then(r=>r.json()).then(d => {
            if(d.success) {
                document.getElementById('csvContent').value = d.content;
                document.getElementById('editorContainer').style.display = 'block';
                document.getElementById('csvMsg').textContent = '';
            } else {
                alert(d.msg);
            }
        });
    });

    document.getElementById('saveCsvBtn').addEventListener('click', () => {
        const filename = document.getElementById('csvFileSelect').value;
        const content = document.getElementById('csvContent').value;

        if(!filename) return;

        const fd = new FormData();
        fd.append('action', 'save_csv_data');
        fd.append('filename', filename);
        fd.append('content', content);

        const msg = document.getElementById('csvMsg');
        msg.textContent = 'Guardando...';
        msg.className = 'status-msg';

        fetch(API_URL, {method:'POST', body:fd}).then(r=>r.json()).then(d => {
            msg.textContent = d.msg;
            msg.className = 'status-msg ' + (d.success ? 'success' : 'error');
        });
    });

</script>
</body>
</html>
