<?php
// scan.php - Busca el código y verifica existencia física del PDF
// Devuelve JSON puro para que el JS maneje la UI

header('Content-Type: application/json');

$code = $_GET['code'] ?? '';
if (empty($code)) {
    echo json_encode(['found' => false, 'message' => 'Codigo vacio']);
    exit;
}

// Cargar config
$config_file = 'config.json';
$config = ['pdf_path' => '../Pdf/', 'active_csv' => 'nov25.csv'];
if (file_exists($config_file)) {
    $config = json_decode(file_get_contents($config_file), true);
}

$csvFile = "../csv/" . $config['active_csv'];
$pdfDir = $config['pdf_path'];

// 1. Buscar en CSV
$foundData = null;
if (file_exists($csvFile)) {
    if (($handle = fopen($csvFile, "r")) !== FALSE) {
        while (($data = fgetcsv($handle, 1000, ";")) !== FALSE) {
            // Asumimos que la columna 0 es el código. Ajustar si es otra.
            if (isset($data[0]) && trim($data[0]) === $code) {
                $foundData = $data;
                break;
            }
        }
        fclose($handle);
    }
}

// 2. Verificar PDF (Lógica Intranet/Local)
// Buscamos coincidencia exacta o con extension .pdf
$pdfUrl = null;
$pdfName = $code . ".pdf";
// Verificar ruta relativa desde el script PHP
$localPdfPath = __DIR__ . "/../" . str_replace('../', '', $pdfDir) . $pdfName;

// Normalización de rutas para chequeo seguro
if (file_exists($localPdfPath)) {
    $pdfUrl = $pdfDir . $pdfName;
} else {
    // Intento secundario: buscar archivo que contenga el codigo
    // (Opcional, consume más recursos, desactivar si es muy lento)
    /* $files = scandir(dirname($localPdfPath));
    foreach($files as $file) {
        if(strpos($file, $code) !== false && strpos($file, '.pdf') !== false) {
             $pdfUrl = $pdfDir . $file;
             break;
        }
    }
    */
}

if ($foundData) {
    echo json_encode([
        'found' => true,
        'code' => $code,
        'data' => $foundData, // Array con toda la info de la fila
        'pdf_available' => ($pdfUrl !== null),
        'pdf_url' => $pdfUrl
    ]);
} else {
    echo json_encode([
        'found' => false,
        'message' => 'Código no encontrado en base de datos.'
    ]);
}
?>