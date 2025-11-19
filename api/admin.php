<?php
header('Content-Type: application/json; charset=utf-8');

$configFile = __DIR__ . '/config.json';
$csvDefaultPath = __DIR__ . '/../csv/Libro.csv';

$action = $_REQUEST['action'] ?? '';

if ($action === 'get_config') {
    if (file_exists($configFile)) {
        echo file_get_contents($configFile);
    } else {
        echo json_encode([
            "ruta_csv" => "../csv/Libro.csv",
            "ruta_pdf" => "../Pdf/",
            "timeout_segundos" => 30
        ]);
    }
    exit;
}

if ($action === 'save_config') {
    $data = [
        "ruta_csv" => $_POST['ruta_csv'] ?? '../csv/Libro.csv',
        "ruta_pdf" => $_POST['ruta_pdf'] ?? '../Pdf/',
        "timeout_segundos" => intval($_POST['timeout_segundos'] ?? 30)
    ];
    
    if (file_put_contents($configFile, json_encode($data, JSON_PRETTY_PRINT))) {
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
    if (!file_exists($testPath) && file_exists(__DIR__ . '/' . $testPath)) {
        $testPath = __DIR__ . '/' . $testPath;
    }
    
    if (file_exists($testPath)) {
        if ($type === 'dir' && is_dir($testPath)) {
             $files = glob(rtrim($testPath, '/\\') . '/*.{pdf,PDF}', GLOB_BRACE);
             $count = count($files);
             echo json_encode(["success" => true, "msg" => "OK. Accesible. Archivos: $count"]);
        } elseif ($type === 'file' && is_file($testPath)) {
             echo json_encode(["success" => true, "msg" => "OK. Archivo encontrado."]);
        } else {
             echo json_encode(["success" => false, "msg" => "Ruta existe pero tipo incorrecto."]);
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

        $currentConfig = json_decode(file_get_contents($configFile), true);
        $targetPath = $currentConfig['ruta_csv'] ?? $csvDefaultPath;
        
        if (!file_exists(dirname($targetPath))) {
             $targetPath = __DIR__ . '/' . $targetPath;
        }

        if (move_uploaded_file($tmpName, $targetPath)) {
            echo json_encode(["success" => true, "msg" => "Base de datos actualizada."]);
        } else {
            echo json_encode(["success" => false, "msg" => "Error al mover el archivo."]);
        }

    } else {
        echo json_encode(["success" => false, "msg" => "Error en la subida."]);
    }
    exit;
}
?>