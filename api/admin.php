<?php
// admin.php - Gestiona CSV y Configuración
// Sanitizado y optimizado para producción

header('Content-Type: application/json');
$config_file = 'config.json';
$csv_path = '../csv/nov25.csv'; // Default, se puede sobreescribir en config

// Funciones Helper
function loadConfig() {
    global $config_file;
    if (file_exists($config_file)) {
        return json_decode(file_get_contents($config_file), true);
    }
    return ['pdf_path' => '../Pdf/', 'active_csv' => 'nov25.csv'];
}

function saveConfig($data) {
    global $config_file;
    file_put_contents($config_file, json_encode($data, JSON_PRETTY_PRINT));
}

function readCSV($filename) {
    $rows = [];
    if (($handle = fopen("../csv/" . $filename, "r")) !== FALSE) {
        while (($data = fgetcsv($handle, 1000, ";")) !== FALSE) {
            $rows[] = $data;
        }
        fclose($handle);
    }
    return $rows;
}

function writeCSV($filename, $data) {
    if ($fp = fopen("../csv/" . $filename, 'w')) {
        foreach ($data as $fields) {
            fputcsv($fp, $fields, ";");
        }
        fclose($fp);
        return true;
    }
    return false;
}

$action = $_POST['action'] ?? '';
$config = loadConfig();
$current_csv = $config['active_csv'] ?? 'nov25.csv';

switch ($action) {
    case 'get_config':
        echo json_encode(['config' => $config, 'csv_files' => array_diff(scandir('../csv/'), ['.', '..'])]);
        break;

    case 'save_config':
        $new_config = [
            'pdf_path' => rtrim($_POST['pdf_path'], '/') . '/',
            'active_csv' => $_POST['active_csv']
        ];
        saveConfig($new_config);
        echo json_encode(['status' => 'ok']);
        break;

    case 'get_data':
        $data = readCSV($current_csv);
        echo json_encode(['data' => $data]);
        break;

    case 'update_row':
        $rowIndex = (int)$_POST['index'];
        $newData = $_POST['row_data']; // Array
        $allData = readCSV($current_csv);
        
        if (isset($allData[$rowIndex])) {
            $allData[$rowIndex] = $newData;
            writeCSV($current_csv, $allData);
            echo json_encode(['status' => 'ok']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Fila no encontrada']);
        }
        break;

    case 'add_row':
        $newData = $_POST['row_data'];
        $allData = readCSV($current_csv);
        $allData[] = $newData;
        writeCSV($current_csv, $allData);
        echo json_encode(['status' => 'ok']);
        break;

    case 'delete_row':
        $rowIndex = (int)$_POST['index'];
        $allData = readCSV($current_csv);
        if (isset($allData[$rowIndex])) {
            array_splice($allData, $rowIndex, 1);
            writeCSV($current_csv, $allData);
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