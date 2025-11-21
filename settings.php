<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuración - Daruma</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>

<!-- LOGIN SECTION -->
<div id="loginSection" class="container login-card">
    <div style="margin-bottom: 20px;">
        <img src="img/logo.png" alt="Daruma" style="height: 50px;">
    </div>
    <h2>Acceso Admin</h2>
    <p class="subtitle" style="margin-bottom: 20px;">Ingrese contraseña para continuar</p>
    <form id="loginForm">
        <div class="form-group">
            <input type="password" id="adminPassword" name="password" placeholder="Contraseña" required>
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;">Ingresar</button>
        <div id="loginMsg" class="status-msg"></div>
    </form>
    <div style="margin-top: 20px;">
        <a href="index.html" style="color: var(--primary); text-decoration: none; font-size: 0.9em;">&larr; Volver al Scanner</a>
    </div>
</div>

<!-- SETTINGS SECTION -->
<div id="settingsSection" class="container settings-container" style="display: none;">
    <header>
        <div class="logo-container">
            <img src="img/logo.png" alt="Daruma" class="logo-img">
            <div class="header-text">
                <h1>Panel de Control</h1>
                <p class="subtitle">Configuración del sistema</p>
            </div>
        </div>
        <div style="display: flex; gap: 10px;">
            <a href="index.html" class="btn btn-secondary" style="font-size: 0.9em;">Volver</a>
            <button id="logoutBtn" class="btn btn-danger" style="font-size: 0.9em;">Salir</button>
        </div>
    </header>

    <div class="main-content">
        <form id="configForm">
            <div class="form-group">
                <label>📂 Ruta Carpeta PDF</label>
                <p style="font-size:0.8em; color:var(--text-muted); margin-bottom: 5px;">Ruta local o de red donde se alojan los archivos PDF.</p>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="ruta_pdf" name="ruta_pdf" placeholder="../Pdf/">
                    <button type="button" class="btn btn-secondary" onclick="testPath('ruta_pdf', 'dir')">Probar</button>
                </div>
                <div id="msg_ruta_pdf" class="status-msg"></div>
            </div>

            <div class="form-group">
                <label>📄 Ruta Archivo CSV</label>
                <p style="font-size:0.8em; color:var(--text-muted); margin-bottom: 5px;">Ubicación del archivo de base de datos.</p>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="ruta_csv" name="ruta_csv" placeholder="../csv/Libro.csv">
                    <button type="button" class="btn btn-secondary" onclick="testPath('ruta_csv', 'file')">Probar</button>
                </div>
                <div id="msg_ruta_csv" class="status-msg"></div>
            </div>

            <div class="form-group">
                <label>⏱️ Timeout (Segundos)</label>
                <input type="number" id="timeout_segundos" name="timeout_segundos" min="5" placeholder="30">
            </div>
            
            <div class="form-group">
                <label>🔑 Cambiar Contraseña Admin</label>
                <input type="password" id="new_admin_password" name="admin_password" placeholder="Dejar vacío para mantener la actual">
            </div>

            <button type="submit" class="btn btn-success" style="width:100%">Guardar Configuración</button>
        </form>

        <hr>

        <h3>📥 Actualizar Base de Datos</h3>
        <p style="font-size:0.9em; color:var(--text-muted);">Subir un nuevo archivo .CSV para reemplazar el actual.</p>
        
        <form id="uploadForm">
            <div class="form-group">
                <div style="display:flex; gap:10px; align-items: center;">
                    <input type="file" id="archivo_csv" name="archivo_csv" accept=".csv,.txt" style="background:white; padding: 8px;">
                    <button type="submit" class="btn btn-primary">Subir</button>
                </div>
                <div id="upload_status" class="status-msg"></div>
            </div>
        </form>

        <hr>

        <h3>✏️ Editor Rápido CSV</h3>
        <div class="form-group">
            <label>Seleccionar Archivo:</label>
            <div style="display: flex; gap: 10px;">
                <select id="csvFileSelect" style="flex-grow: 1;">
                    <option value="">-- Seleccione --</option>
                </select>
                <button type="button" class="btn btn-secondary" onclick="loadCsvContent()">Cargar</button>
            </div>
        </div>
        <div class="form-group">
            <textarea id="csvContent" rows="15" style="width: 100%; font-family: monospace; font-size: 0.9em; white-space: pre; overflow-x: auto;"></textarea>
        </div>
        <button type="button" class="btn btn-primary" onclick="saveCsvContent()">Guardar Cambios en CSV</button>
        <div id="edit_csv_status" class="status-msg"></div>
    </div>
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
        document.body.style.alignItems = 'center';
        document.body.style.justifyContent = 'center';
    }

    function showSettings() {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('settingsSection').style.display = 'flex';
        document.body.style.alignItems = 'stretch';
        document.body.style.justifyContent = 'flex-start';
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
                    e.target.reset();
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
        const fd = new FormData(e.target);
        fd.append('action', 'save_config');
        
        fetch(API_URL, {method:'POST', body:fd})
            .then(r => {
                if(r.status === 401) { showLogin(); throw new Error('Unauthorized'); }
                return r.json();
            })
            .then(d => {
                alert(d.msg);
                if(d.success) {
                    document.getElementById('new_admin_password').value = ''; // Clear password field
                }
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
                if(d.success) loadCsvList();
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

        if(!confirm("¿Está seguro de guardar los cambios? Esto sobrescribirá el archivo original.")) return;

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