<?php
// admin.php - Gestiona CSV, Configuración y SEGURIDAD
session_start(); // Iniciamos sesión para guardar el estado del login
header('Content-Type: application/json');

$config_file = __DIR__ . '/config.json';
$PASSWORD = 'queija1234'; // La clave maestra

// Acciones que no requieren login
$action = $_POST['action'] ?? '';

// 1. LOGIN
if ($action === 'login') {
    $pass = $_POST['password'] ?? '';
    if ($pass === $PASSWORD) {
        $_SESSION['auth'] = true;
        echo json_encode(['status' => 'ok', 'success' => true]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Contraseña incorrecta', 'success' => false, 'msg' => 'Contraseña incorrecta']);
    }
    exit;
}

// 2. CHECK LOGIN (Para verificar al cargar la página)
if ($action === 'check_auth') {
    $logged = isset($_SESSION['auth']) && $_SESSION['auth'] === true;
    echo json_encode(['auth' => $logged, 'logged_in' => $logged]);
    exit;
}

// 3. LOGOUT
if ($action === 'logout') {
    session_destroy();
    echo json_encode(['status' => 'ok', 'success' => true]);
    exit;
}

// --- ZONA PROTEGIDA ---
// Si no está logueado, cortamos acá.
if (!isset($_SESSION['auth']) || $_SESSION['auth'] !== true) {
    http_response_code(401); // Changed to 401 for frontend handling
    echo json_encode(['status' => 'error', 'message' => 'No autorizado']);
    exit;
}

// Funciones Helper
function loadConfig() {
    global $config_file;
    if (file_exists($config_file)) {
        return json_decode(file_get_contents($config_file), true);
    }
    // Valores por defecto con claves correctas que JS espera
    return ['pdf_path' => '../Pdf/', 'active_csv' => '0codigos.csv'];
}

function saveConfig($data) {
    global $config_file;
    file_put_contents($config_file, json_encode($data, JSON_PRETTY_PRINT));
}

function readCSV($filename) {
    $rows = [];
    // Handle both full path or just filename
    $path = $filename;
    if (strpos($path, '/') === false && strpos($path, '\\') === false) {
        $path = "../csv/" . $filename;
    }
    // Resolve absolute path if needed
    if (!file_exists($path) && file_exists(__DIR__ . '/' . $path)) {
        $path = __DIR__ . '/' . $path;
    }
    
    if (file_exists($path) && ($handle = fopen($path, "r")) !== FALSE) {
        while (($data = fgetcsv($handle, 1000, ";")) !== FALSE) { // Changed delimiter to semicolon
            $rows[] = $data;
        }
        fclose($handle);
    }
    return $rows;
}

function writeCSV($filename, $data) {
    $path = $filename;
    if (strpos($path, '/') === false && strpos($path, '\\') === false) {
        $path = "../csv/" . $filename;
    }
    if (!file_exists(dirname($path))) {
        // Try to use __DIR__ relative
        $path = __DIR__ . '/../csv/' . $filename;
    }

    if ($fp = fopen($path, 'w')) {
        foreach ($data as $fields) {
            fputcsv($fp, $fields, ";"); // Changed delimiter to semicolon
        }
        fclose($fp);
        return true;
    }
    return false;
}

// Cargar configuración actual
$config = loadConfig();
// Si viene un archivo específico en el POST (para editar uno que no es el activo), lo usamos
$target_csv = $_POST['target_csv'] ?? basename($config['ruta_csv']);

switch ($action) {
    case 'get_config':
        // Escaneamos la carpeta CSV real en el servidor
        $csv_files = [];
        $csv_dir = __DIR__ . '/../csv/';
        if (is_dir($csv_dir)) {
            $files = scandir($csv_dir);
            foreach($files as $f) {
                if($f !== '.' && $f !== '..' && strpos($f, '.csv') !== false) {
                    $csv_files[] = $f;
                }
            }
        }
        sort($csv_files); // Ordenar alfabéticamente para consistencia
        
        // Asegurar que config tiene las claves correctas que JS espera
        if (!isset($config['pdf_path'])) $config['pdf_path'] = '../Pdf/';
        if (!isset($config['active_csv'])) $config['active_csv'] = isset($csv_files[0]) ? $csv_files[0] : '0codigos.csv';
        
        echo json_encode(['config' => $config, 'csv_files' => $csv_files]);
        break;

    case 'save_config':
        $new_config = [
            'pdf_path' => $_POST['pdf_path'] ?? '../Pdf/',
            'active_csv' => $_POST['active_csv'] ?? '0codigos.csv'
        ];
        saveConfig($new_config);
        echo json_encode(['status' => 'ok', 'success' => true, 'msg' => 'Configuración guardada', 'config' => $new_config]);
        break;

    case 'get_data':
        $data = readCSV($target_csv);
        echo json_encode(['data' => $data, 'file' => $target_csv]);
        break;

    case 'update_row':
        $rowIndex = (int)$_POST['index'];
        $newData = $_POST['row_data']; 
        $allData = readCSV($target_csv);
        
        if (isset($allData[$rowIndex])) {
            $allData[$rowIndex] = $newData;
            writeCSV($target_csv, $allData);
            echo json_encode(['status' => 'ok']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Fila no encontrada']);
        }
        break;

    case 'add_row':
        $newData = $_POST['row_data'];
        $allData = readCSV($target_csv);
        $allData[] = $newData;
        writeCSV($target_csv, $allData);
        echo json_encode(['status' => 'ok']);
        break;

    case 'delete_row':
        $rowIndex = (int)$_POST['index'];
        $allData = readCSV($target_csv);
        if (isset($allData[$rowIndex])) {
            array_splice($allData, $rowIndex, 1);
            writeCSV($target_csv, $allData);
            echo json_encode(['status' => 'ok']);
        } else {
            echo json_encode(['status' => 'error']);
        }
        break;

    case 'upload_csv':
        if (isset($_FILES['file'])) {
            $target = "../csv/" . basename($_FILES['file']['name']);
            if (move_uploaded_file($_FILES['file']['tmp_name'], $target)) {
                echo json_encode(['status' => 'ok', 'filename' => basename($_FILES['file']['name'])]);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Fallo al subir']);
            }
        }
        break;

    default:
        echo json_encode(['status' => 'error', 'message' => 'Accion no valida']);
        break;
}
?>
