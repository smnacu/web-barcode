<?php
// scan.php - Búsqueda Flexible (Texto, Código, Art) + Verificación PDF
// Optimizado para Daruma Consulting

header('Content-Type: application/json');

$query = $_GET['code'] ?? ''; // Ahora recibimos 'query' genérico, no solo 'code'
$query = trim($query);

if (empty($query)) {
    echo json_encode(['found' => false, 'message' => 'Búsqueda vacía']);
    exit;
}

// Cargar config
$config_file = 'config.json';
// Configuración default por si falla la lectura
$config = ['pdf_path' => '../Pdf/', 'active_csv' => 'nov25.csv'];

if (file_exists($config_file)) {
    $loaded_config = json_decode(file_get_contents($config_file), true);
    if($loaded_config) $config = array_merge($config, $loaded_config);
}

$csvFile = "../csv/" . $config['active_csv'];
$pdfDir = $config['pdf_path'];

// 1. Buscar en CSV (Búsqueda Flexible)
$foundData = null;
$matchType = 'exact'; // exact | partial

if (file_exists($csvFile)) {
    if (($handle = fopen($csvFile, "r")) !== FALSE) {
        while (($data = fgetcsv($handle, 1000, ";")) !== FALSE) {
            
            // Lógica de Búsqueda:
            // Recorremos todas las columnas de la fila
            foreach ($data as $index => $cell) {
                // Normalizamos a minúsculas para comparar sin importar mayúsculas
                $cellStr = mb_strtolower(trim($cell));
                $queryStr = mb_strtolower($query);

                // 1. Coincidencia Exacta (Prioridad) - Ideal para códigos cortos
                if ($cellStr === $queryStr) {
                    $foundData = $data;
                    break 2; // Salimos de ambos bucles
                }

                // 2. Coincidencia Parcial (Si escribe "Twingo" y la celda es "Radiador Twingo")
                // Solo si la query tiene al menos 3 caracteres para evitar falsos positivos
                if (strlen($queryStr) >= 3 && strpos($cellStr, $queryStr) !== false) {
                    $foundData = $data;
                    // No hacemos break acá, seguimos buscando por si aparece una exacta más adelante.
                    // Pero guardamos esta como "candidata". 
                    // (Para simplificar este script, tomamos la primera parcial que aparezca si no hay exactas).
                    break 2; 
                }
            }
        }
        fclose($handle);
    }
}

// Si no encontramos datos en el CSV, cortamos acá (o podrías decidir buscar PDF igual)
if (!$foundData) {
    echo json_encode(['found' => false, 'message' => 'No se encontraron coincidencias en la base de datos.']);
    exit;
}

// El código principal se asume que está en la columna 0 (para buscar el PDF)
$mainCode = $foundData[0]; 

// 2. Verificar PDF (Lógica Intranet/Local)
$pdfUrl = null;
$pdfName = $mainCode . ".pdf";

// Ajuste de ruta relativa para chequear existencia física desde /api/
// Si $pdfDir es "../Pdf/", entonces __DIR__ . "/../" . "Pdf/" ...
// Limpiamos los ../ para construir la ruta absoluta del sistema de archivos
$cleanPdfDir = str_replace('../', '', $pdfDir);
$localPdfPath = __DIR__ . "/../" . $cleanPdfDir . $pdfName;

// Normalización de rutas
if (file_exists($localPdfPath)) {
    $pdfUrl = $pdfDir . $pdfName;
}

echo json_encode([
    'found' => true,
    'code' => $mainCode, // Devolvemos el código oficial, no lo que tipeó el usuario
    'query_used' => $query,
    'data' => $foundData,
    'pdf_available' => ($pdfUrl !== null),
    'pdf_url' => $pdfUrl
]);
?>
