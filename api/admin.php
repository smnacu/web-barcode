<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

$configFile = __DIR__ . '/config.json';
$csvDefaultPath = __DIR__ . '/../csv/Libro.csv';

// Helper to load config
function getConfig() {
    global $configFile;
    $defaultConfig = [
        "ruta_csv" => "../csv/Libro.csv",
        "ruta_pdf" => "../Pdf/",
        "timeout_segundos" => 30,
        "admin_password" => "queija1234"
    ];
    
    if (file_exists($configFile)) {
        $loaded = json_decode(file_get_contents($configFile), true);
        if ($loaded) {
            return array_merge($defaultConfig, $loaded);
        }
    }
    return $defaultConfig;
}

$config = getConfig();
$action = $_REQUEST['action'] ?? '';

function isAuthenticated() {
    return isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;
}

// --- Public Actions ---

if ($action === 'login') {
    $pass = $_POST['password'] ?? '';
    if ($pass === $config['admin_password']) {
        $_SESSION['logged_in'] = true;
        echo json_encode(["success" => true, "msg" => "Login exitoso"]);
    } else {
        echo json_encode(["success" => false, "msg" => "Contraseña incorrecta"]);
    }
    exit;
}

if ($action === 'logout') {
    session_destroy();
    echo json_encode(["success" => true, "msg" => "Sesión cerrada"]);
    exit;
}

if ($action === 'check_auth') {
    echo json_encode(["success" => true, "logged_in" => isAuthenticated()]);
    exit;
}

// --- Protected Actions ---

if (!isAuthenticated()) {
    http_response_code(401);
    echo json_encode(["success" => false, "msg" => "No autorizado"]);
    exit;
}

if ($action === 'get_config') {
    echo json_encode($config);
    exit;
}

if ($action === 'save_config') {
    $newConfig = $config;
    $newConfig['ruta_csv'] = $_POST['ruta_csv'] ?? $config['ruta_csv'];
    $newConfig['ruta_pdf'] = $_POST['ruta_pdf'] ?? $config['ruta_pdf'];
    $newConfig['timeout_segundos'] = intval($_POST['timeout_segundos'] ?? $config['timeout_segundos']);
    
    if (!empty($_POST['admin_password'])) {
        $newConfig['admin_password'] = $_POST['admin_password'];
    }
    
    if (file_put_contents($configFile, json_encode($newConfig, JSON_PRETTY_PRINT))) {
        echo json_encode(["success" => true, "msg" => "Configuracion guardada."]);
    } else {
        echo json_encode(["success" => false, "msg" => "Error de escritura en config.json."]);
    }
    exit;
}

if ($action === 'test_path') {
    $path = $_POST['path'] ?? '';
    $type = $_POST['type'] ?? 'dir';
    
    $testPath = $path;
    // Check relative to script if not absolute
    if (!file_exists($testPath) && file_exists(__DIR__ . '/' . $testPath)) {
        $testPath = __DIR__ . '/' . $testPath;
    }
    
    if (file_exists($testPath)) {
        if ($type === 'dir' && is_dir($testPath)) {
             $files = glob(rtrim($testPath, '/\\') . '/*.{pdf,PDF}', GLOB_BRACE);
             $count = is_array($files) ? count($files) : 0;
             echo json_encode(["success" => true, "msg" => "OK. Accesible. Archivos PDF encontrados: $count"]);
        } elseif ($type === 'file' && is_file($testPath)) {
             echo json_encode(["success" => true, "msg" => "OK. Archivo encontrado."]);
        } else {
             echo json_encode(["success" => false, "msg" => "Ruta existe pero no es un " . ($type==='dir'?'directorio':'archivo')]);
        }
    } else {
        echo json_encode(["success" => false, "msg" => "Ruta no encontrada o sin acceso."]);
    }
    exit;
}

if ($action === 'upload_csv') {
    if (isset($_FILES['archivo_csv']) && $_FILES['archivo_csv']['error'] === UPLOAD_ERR_OK) {
        $tmpName = $_FILES['archivo_csv']['tmp_name'];
        $name = $_FILES['archivo_csv']['name'];
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));

        if ($ext !== 'csv' && $ext !== 'txt') {
            echo json_encode(["success" => false, "msg" => "Solo se permiten archivos .CSV"]);
            exit;
        }

        $targetPath = $config['ruta_csv'];
        
        // Handle relative paths
        if (!file_exists(dirname($targetPath)) && file_exists(__DIR__ . '/' . dirname($targetPath))) {
             $targetPath = __DIR__ . '/' . $targetPath;
        }

        if (move_uploaded_file($tmpName, $targetPath)) {
            echo json_encode(["success" => true, "msg" => "Base de datos actualizada exitosamente."]);
        } else {
            echo json_encode(["success" => false, "msg" => "Error al mover el archivo al destino: $targetPath"]);
        }

    } else {
        echo json_encode(["success" => false, "msg" => "Error en la subida del archivo."]);
    }
    exit;
}

$csvDir = __DIR__ . '/../csv/';

if ($action === 'list_csvs') {
    $files = glob($csvDir . '*.csv');
    $fileNames = [];
    if ($files) {
        foreach($files as $f) {
            $fileNames[] = basename($f);
        }
    }
    echo json_encode(["success" => true, "files" => $fileNames]);
    exit;
}

if ($action === 'get_csv_content') {
    $filename = $_GET['filename'] ?? '';
    $filename = basename($filename); // Security: prevent directory traversal
    $path = $csvDir . $filename;

    if (file_exists($path) && is_readable($path)) {
        echo json_encode(["success" => true, "content" => file_get_contents($path)]);
    } else {
        echo json_encode(["success" => false, "msg" => "Archivo no encontrado o no legible."]);
    }
    exit;
}

if ($action === 'save_csv_content') {
    $filename = $_POST['filename'] ?? '';
    $content = $_POST['content'] ?? '';

    $filename = basename($filename);
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

    if ($ext !== 'csv') {
        echo json_encode(["success" => false, "msg" => "Solo se permiten archivos .CSV"]);
        exit;
    }

    $path = $csvDir . $filename;

    if (empty($filename)) {
        echo json_encode(["success" => false, "msg" => "Nombre de archivo vacío."]);
        exit;
    }

    if (file_put_contents($path, $content) !== false) {
         echo json_encode(["success" => true, "msg" => "Archivo guardado correctamente."]);
    } else {
         echo json_encode(["success" => false, "msg" => "No se puede escribir el archivo."]);
    }
    exit;
}
?>