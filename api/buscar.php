<?php
header('Content-Type: application/json; charset=utf-8');

$configFile = __DIR__ . '/config.json';
$config = [
    'ruta_csv' => '../csv/Libro.csv',
    'ruta_pdf' => '../Pdf/'
];

if (file_exists($configFile)) {
    $loaded = json_decode(file_get_contents($configFile), true);
    if ($loaded) $config = array_merge($config, $loaded);
}

function limpiarString($texto) {
    if ($texto === null) return null;
    // Remove BOM and weird spaces
    $texto = preg_replace('/^\x{FEFF}/u', '', $texto);
    $texto = str_replace(["\xC2\xA0", "\xA0"], ' ', $texto);
    return trim($texto);
}

function simpleJsonEncode($data) {
    // Simple JSON encoder to avoid issues with some encodings if standard json_encode fails,
    // though standard json_encode is usually preferred. Keeping this for compatibility 
    // but improving it slightly.
    return json_encode($data); 
}

function buscarEnLibro($codigo, $config) {
    $csv_path = $config['ruta_csv'];
    // Handle relative paths
    if (!file_exists($csv_path) && file_exists(__DIR__ . '/' . $csv_path)) {
        $csv_path = __DIR__ . '/' . $csv_path;
    }

    if (!file_exists($csv_path)) return ['encontrado' => false, 'error' => 'Archivo CSV no encontrado'];

    $handle = fopen($csv_path, 'r');
    if (!$handle) return ['encontrado' => false, 'error' => 'No se pudo abrir CSV'];

    // Detect delimiter (simple check)
    $line = fgets($handle);
    rewind($handle);
    $delimiter = (strpos($line, ';') !== false) ? ';' : ',';

    // Skip header
    fgetcsv($handle, 0, $delimiter);
    
    $codigo = strtolower($codigo);

    while (($data = fgetcsv($handle, 1000, $delimiter)) !== false) {
        if (count($data) >= 3) {
            $codArt = limpiarString($data[0]);
            $descripcion = limpiarString($data[1]);
            $ean = limpiarString($data[2]);

            if (strtolower($codArt) === $codigo || strtolower($ean) === $codigo) {
                fclose($handle);
                return [
                    'encontrado' => true,
                    'producto' => ['codigo' => $codArt, 'descripcion' => $descripcion, 'ean' => $ean],
                    'fuente' => basename($csv_path)
                ];
            }
        }
    }
    fclose($handle);
    return ['encontrado' => false];
}

function buscarPDF($producto, $config) {
    $pdf_dir = $config['ruta_pdf'];
    if (!is_dir($pdf_dir) && is_dir(__DIR__ . '/' . $pdf_dir)) {
        $pdf_dir = __DIR__ . '/' . $pdf_dir;
    }
    $pdf_dir = rtrim($pdf_dir, '/\\') . DIRECTORY_SEPARATOR;

    if (!is_dir($pdf_dir)) return null;
    
    // Normalize search terms
    $busquedas = [];
    if (!empty($producto['ean'])) $busquedas[] = preg_replace('/[^a-z0-9]/', '', strtolower($producto['ean']));
    if (!empty($producto['codigo'])) $busquedas[] = preg_replace('/[^a-z0-9]/', '', strtolower($producto['codigo']));
    
    // Get all PDFs
    $pdfs = glob($pdf_dir . '*.{pdf,PDF}', GLOB_BRACE);
    if (!$pdfs) return null;

    foreach ($pdfs as $pdfPath) {
        $filename = pathinfo($pdfPath, PATHINFO_FILENAME);
        $nombreNorm = preg_replace('/[^a-z0-9]/', '', strtolower($filename));
        
        foreach($busquedas as $b) {
             // Check if the search term is contained in the filename
             // This is a loose match. For exact match, use ===
             if (strpos($nombreNorm, $b) !== false) {
                 return basename($pdfPath);
             }
        }
    }
    return null;
}

$codigo = limpiarString($_REQUEST['codigo'] ?? '');

if (empty($codigo)) {
    http_response_code(400);
    echo json_encode(['error' => true, 'mensaje' => 'Codigo requerido']);
    exit;
}

$res = buscarEnLibro($codigo, $config);

if ($res['encontrado']) {
    $pdf = buscarPDF($res['producto'], $config);
    echo json_encode([
        'error' => false,
        'encontrado' => true,
        'producto' => $res['producto'],
        'pdf' => $pdf,
        'fuente' => $res['fuente']
    ]);
} else {
    echo json_encode([
        'error' => false,
        'encontrado' => false,
        'mensaje' => 'Producto no encontrado',
        'codigo_buscado' => $codigo
    ]);
}
?>