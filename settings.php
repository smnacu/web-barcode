<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuracion Daruma</title>
    <link rel="stylesheet" href="css/styles.css">
    <style>
        /* Login styles */
        #loginSection {
            max-width: 400px;
            margin: 50px auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        #settingsSection {
            display: none;
        }
        .hidden {
            display: none !important;
        }
    </style>
</head>
<body style="background: #f3f4f6;">

<!-- LOGIN SECTION -->
<div id="loginSection">
    <h2>Acceso Admin</h2>
    <p>Ingrese contraseña para continuar</p>
    <form id="loginForm">
        <div class="form-group">
            <input type="password" id="adminPassword" name="password" placeholder="Contraseña" required style="width: 100%; padding: 10px; margin-bottom: 10px;">
            <button type="submit" class="btn btn-primary" style="width: 100%;">Ingresar</button>
        </div>
        <div id="loginMsg" class="status-msg"></div>
    </form>
    <div style="margin-top: 20px;">
        <a href="index.html" style="color: var(--primary); text-decoration: none;">&larr; Volver al Scanner</a>
    </div>
</div>

<!-- SETTINGS SECTION -->
<div id="settingsSection" class="settings-container">
    <div style="display: flex; justify-content: space-between; align-items: center;">
        <a href="index.html" style="color: var(--primary); text-decoration: none; font-weight: 700;">&larr; Volver</a>
        <button id="logoutBtn" class="btn btn-secondary" style="padding: 5px 10px;">Cerrar Sesión</button>
    </div>

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

    <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
    <h3>✏️ Editar CSVs</h3>
    <div class="form-group">
        <label>Seleccionar Archivo:</label>
        <select id="csvFileSelect" style="width: 100%; padding: 5px; margin-bottom: 10px;">
            <option value="">-- Seleccione --</option>
        </select>
        <button type="button" class="btn btn-secondary" onclick="loadCsvContent()" style="margin-bottom: 10px;">Cargar</button>
    </div>
    <div class="form-group">
        <label>Contenido:</label>
        <textarea id="csvContent" rows="10" style="width: 100%; font-family: monospace;"></textarea>
    </div>
    <button type="button" class="btn btn-success" onclick="saveCsvContent()">Guardar Cambios</button>
    <div id="edit_csv_status" class="status-msg"></div>
</div>

<script>
    const API_URL = 'api/admin.php';

    document.addEventListener('DOMContentLoaded', () => {
        checkAuth();
    });

    function checkAuth() {
        fetch(API_URL + '?action=check_auth')
            .then(r => r.json())
            .then(d => {
                if (d.logged_in) {
                    showSettings();
                } else {
                    showLogin();
                }
            })
            .catch(e => showLogin());
    }

    function showLogin() {
        document.getElementById('loginSection').style.display = 'block';
        document.getElementById('settingsSection').style.display = 'none';
    }

    function showSettings() {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('settingsSection').style.display = 'block';
        loadConfig();
        loadCsvList();
    }

    function loadConfig() {
        fetch(API_URL + '?action=get_config')
            .then(r => {
                if (r.status === 401) {
                    showLogin();
                    throw new Error('Unauthorized');
                }
                return r.json();
            })
            .then(d => {
                document.getElementById('ruta_pdf').value = d.ruta_pdf;
                document.getElementById('ruta_csv').value = d.ruta_csv;
                document.getElementById('timeout_segundos').value = d.timeout_segundos;
            })
            .catch(e => console.error(e));
    }

    document.getElementById('loginForm').addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        fd.append('action', 'login');

        fetch(API_URL, {method: 'POST', body: fd})
            .then(r => r.json())
            .then(d => {
                if (d.success) {
                    showSettings();
                    document.getElementById('loginMsg').textContent = '';
                } else {
                    document.getElementById('loginMsg').textContent = d.msg;
                    document.getElementById('loginMsg').className = 'status-msg error';
                }
            })
            .catch(e => {
                console.error(e);
                document.getElementById('loginMsg').textContent = "Error de conexión";
                document.getElementById('loginMsg').className = 'status-msg error';
            });
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        const fd = new FormData();
        fd.append('action', 'logout');
        fetch(API_URL, {method: 'POST', body: fd})
            .then(r => r.json())
            .then(d => {
                if (d.success) {
                    showLogin();
                }
            });
    });

    function testPath(id, type) {
        const p = document.getElementById(id).value;
        const m = document.getElementById('msg_' + id);
        m.textContent = 'Verificando...'; m.className='status-msg';
        const fd = new FormData(); fd.append('action','test_path'); fd.append('path',p); fd.append('type',type);
        fetch(API_URL, {method:'POST', body:fd})
            .then(r => {
                if(r.status === 401) { showLogin(); throw new Error('Unauthorized'); }
                return r.json();
            })
            .then(d => {
                m.textContent = d.msg; m.className = 'status-msg ' + (d.success?'success':'error');
            });
    }

    document.getElementById('configForm').addEventListener('submit', e => {
        e.preventDefault();
        fetch(API_URL, {method:'POST', body:new FormData(e.target)})
            .then(r => {
                if(r.status === 401) { showLogin(); throw new Error('Unauthorized'); }
                return r.json();
            })
            .then(d => {
                alert(d.msg);
            });
    });

    document.getElementById('uploadForm').addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(e.target); fd.append('action','upload_csv');
        document.getElementById('upload_status').textContent = "Subiendo...";
        fetch(API_URL, {method:'POST', body:fd})
            .then(r => {
                if(r.status === 401) { showLogin(); throw new Error('Unauthorized'); }
                return r.json();
            })
            .then(d => {
                const s = document.getElementById('upload_status');
                s.textContent = d.msg; s.className = 'status-msg ' + (d.success?'success':'error');
            });
    });

    function loadCsvList() {
        fetch(API_URL + '?action=list_csvs')
            .then(r => r.json())
            .then(d => {
                if(d.success) {
                    const sel = document.getElementById('csvFileSelect');
                    sel.innerHTML = '<option value="">-- Seleccione --</option>';
                    d.files.forEach(f => {
                        const opt = document.createElement('option');
                        opt.value = f;
                        opt.textContent = f;
                        sel.appendChild(opt);
                    });
                }
            });
    }

    function loadCsvContent() {
        const filename = document.getElementById('csvFileSelect').value;
        if(!filename) return;

        fetch(API_URL + '?action=get_csv_content&filename=' + encodeURIComponent(filename))
            .then(r => r.json())
            .then(d => {
                if(d.success) {
                    document.getElementById('csvContent').value = d.content;
                    document.getElementById('edit_csv_status').textContent = "";
                } else {
                    alert(d.msg);
                }
            });
    }

    function saveCsvContent() {
        const filename = document.getElementById('csvFileSelect').value;
        const content = document.getElementById('csvContent').value;
        if(!filename) {
            alert("Seleccione un archivo");
            return;
        }

        const fd = new FormData();
        fd.append('action', 'save_csv_content');
        fd.append('filename', filename);
        fd.append('content', content);

        document.getElementById('edit_csv_status').textContent = "Guardando...";

        fetch(API_URL, {method: 'POST', body: fd})
            .then(r => r.json())
            .then(d => {
                const s = document.getElementById('edit_csv_status');
                s.textContent = d.msg;
                s.className = 'status-msg ' + (d.success ? 'success' : 'error');
            });
    }
</script>
</body>
</html>