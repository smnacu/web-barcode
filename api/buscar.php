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
    $texto = trim($texto);
    $texto = str_replace(["\xC2\xA0", "\xA0"], '', $texto);
    $texto = preg_replace('/^\x{FEFF}/u', '', $texto);
    return $texto;
}

function simpleJsonEncode($data) {
    if (is_array($data)) {
        $parts = [];
        $isList = array_keys($data) === range(0, count($data) - 1);
        foreach ($data as $key => $value) {
            $part = $isList ? '' : '"' . addslashes($key) . '":';
            if (is_array($value)) $part .= simpleJsonEncode($value);
            elseif (is_bool($value)) $part .= ($value ? 'true' : 'false');
            elseif (is_numeric($value) && !is_string($value)) $part .= $value;
            elseif ($value === null) $part .= 'null';
            else $part .= '"' . addslashes((string)$value) . '"';
            $parts[] = $part;
        }
        return $isList ? '[' . implode(',', $parts) . ']' : '{' . implode(',', $parts) . '}';
    }
    return '"' . addslashes((string)$data) . '"';
}

function buscarEnLibro($codigo, $config) {
    $csv_path = $config['ruta_csv'];
    
    // 1. Try exact path
    if (!file_exists($csv_path)) {
        // 2. Try relative to __DIR__
        if (file_exists(__DIR__ . '/' . $csv_path)) {
            $csv_path = __DIR__ . '/' . $csv_path;
        }
        // 3. Try in ../csv/ folder if it's just a filename
        elseif (file_exists(__DIR__ . '/../csv/' . basename($csv_path))) {
            $csv_path = __DIR__ . '/../csv/' . basename($csv_path);
        }
    }

    if (!file_exists($csv_path)) return ['encontrado' => false];

    $handle = fopen($csv_path, 'r');
    if (!$handle) return ['encontrado' => false];

    fgetcsv($handle);
    
    $codigo = mb_strtolower($codigo, 'UTF-8');

    while (($data = fgetcsv($handle, 1000, ';')) !== false) {
        if (count($data) >= 3) {
            $codArt = limpiarString($data[0]);
            $descripcion = limpiarString($data[1]);
            $ean = limpiarString($data[2]);
            
            $codArtNorm = mb_strtolower($codArt, 'UTF-8');
            $eanNorm = mb_strtolower($ean, 'UTF-8');
            $descNorm = mb_strtolower($descripcion, 'UTF-8');

            if ($codArtNorm === $codigo || $eanNorm === $codigo || strpos($descNorm, $codigo) !== false) {
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
    $pdf_path_config = $config['ruta_pdf'];
    
    // Caso 1: URL HTTP/HTTPS
    if (preg_match('/^https?:\/\//i', $pdf_path_config)) {
        $pdf_path_config = rtrim($pdf_path_config, '/') . '/';
        
        $candidates = [];
        if (!empty($producto['ean'])) $candidates[] = $producto['ean'];
        if (!empty($producto['codigo'])) $candidates[] = $producto['codigo'];
        
        foreach ($candidates as $code) {
            $url = $pdf_path_config . $code . '.pdf';
            // Verificar si existe (HEAD request)
            $headers = @get_headers($url);
            if ($headers && strpos($headers[0], '200') !== false) {
                return $url;
            }
        }
        return null;
    }

    // Caso 2: Ruta Local / Red
    if (!is_dir($pdf_path_config) && is_dir(__DIR__ . '/' . $pdf_path_config)) {
        $pdf_path_config = __DIR__ . '/' . $pdf_path_config;
    }
    $pdf_path_config = rtrim($pdf_path_config, '/\\') . DIRECTORY_SEPARATOR;

    if (!is_dir($pdf_path_config)) return null;
    $pdfs = glob($pdf_path_config . '*.{pdf,PDF}', GLOB_BRACE);
    
    $busquedas = [];
    if (!empty($producto['ean'])) $busquedas[] = preg_replace('/[^a-z0-9]/', '', strtolower($producto['ean']));
    if (!empty($producto['codigo'])) $busquedas[] = preg_replace('/[^a-z0-9]/', '', strtolower($producto['codigo']));
    
    foreach ($pdfs as $pdfPath) {
        $nombreNorm = preg_replace('/[^a-z0-9]/', '', strtolower(pathinfo($pdfPath, PATHINFO_FILENAME)));
        foreach($busquedas as $b) {
             if (strpos($nombreNorm, $b) !== false) return basename($pdfPath);
        }
    }
    return null;
}

$codigo = limpiarString($_REQUEST['codigo'] ?? '');
if (empty($codigo)) {
    http_response_code(400);
    echo simpleJsonEncode(['error' => true, 'mensaje' => 'Codigo requerido']);
    exit;
}

$res = buscarEnLibro($codigo, $config);

if ($res['encontrado']) {
    $pdf = buscarPDF($res['producto'], $config);
    
    $pdf_url = null;
    $pdf_available = false;
    
    if ($pdf) {
        $pdf_available = true;
        if (preg_match('/^https?:\/\//i', $pdf)) {
            $pdf_url = $pdf;
        } else {
            $pdf_url = 'api/ver_pdf.php?file=' . urlencode($pdf);
        }
    }

    echo simpleJsonEncode([
        'error' => false,
        'encontrado' => true,
        'producto' => $res['producto'],
        'pdf' => $pdf,
        'pdf_available' => $pdf_available,
        'pdf_url' => $pdf_url,
        'fuente' => $res['fuente']
    ]);
} else {
    echo simpleJsonEncode([
        'error' => false,
        'encontrado' => false,
        'mensaje' => 'Producto no encontrado',
        'codigo_buscado' => $codigo
    ]);
}
?>