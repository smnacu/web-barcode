<?php
// API de búsqueda optimizada sin dependencias de extensiones
header('Content-Type: application/json; charset=utf-8');

/**
 * Función de limpieza de strings más potente.
 */
function limpiarString($texto) {
    if ($texto === null) {
        return null;
    }
    $texto = trim($texto);
    $texto = str_replace("\xC2\xA0", '', $texto);
    $texto = str_replace("\xA0", '', $texto);
    $texto = preg_replace('/^\x{FEFF}/u', '', $texto);
    return $texto;
}

function simpleJsonEncode($data) {
    if (is_array($data)) {
        $parts = [];
        $isList = true;
        $keys = array_keys($data);
        if (!empty($keys) && $keys !== range(0, count($data) - 1)) {
            $isList = false;
        }
        
        foreach ($data as $key => $value) {
            $part = '';
            if (!$isList) {
                 $part = '"' . addslashes($key) . '":';
            }
            
            if (is_array($value)) {
                $part .= simpleJsonEncode($value);
            } elseif (is_bool($value)) {
                $part .= ($value ? 'true' : 'false');
            } elseif (is_numeric($value) && !is_string($value)) {
                $part .= $value;
            } elseif ($value === null) {
                $part .= 'null';
            } else {
                $part .= '"' . addslashes((string)$value) . '"';
            }
            $parts[] = $part;
        }
        
        if ($isList) {
            return '[' . implode(',', $parts) . ']';
        } else {
            return '{' . implode(',', $parts) . '}';
        }

    } elseif (is_bool($data)) {
        return $data ? 'true' : 'false';
    } elseif (is_numeric($data) && !is_string($value)) {
        return $data;
    } elseif ($data === null) {
        return 'null';
    } else {
        return '"' . addslashes((string)$data) . '"';
    }
}

function buscarProducto($codigo, $debug_handle) {
    $codigo = limpiarString($codigo);
    $resultado = ['encontrado' => false, 'producto' => null, 'pdf' => null, 'fuente' => null];

    if ($debug_handle) fwrite($debug_handle, "=== INICIANDO BÚSQUEDA COMPLETA ===\n");
    if ($debug_handle) fwrite($debug_handle, "Código limpio para buscar: '" . $codigo . "' | Hex: " . bin2hex($codigo) . "\n");
    
    $resultado = buscarEnLibro($codigo, $debug_handle);
    if (!$resultado['encontrado']) {
        if ($debug_handle) fwrite($debug_handle, "No encontrado en Libro.csv, buscando en 0codigos.csv\n");
        $resultado = buscarEnCodigos($codigo, $debug_handle);
    }

    if ($resultado['encontrado']) {
        $resultado['pdf'] = buscarPDF($codigo, $resultado['producto']);
    }

    return $resultado;
}

function buscarEnLibro($codigo, $debug_handle = null) {
    $csv_path = '../csv/Libro.csv'; // Corregido: Subir un nivel
    if (!file_exists($csv_path)) {
        if ($debug_handle) fwrite($debug_handle, "ERROR: Archivo Libro.csv no encontrado en " . realpath(dirname(__FILE__)) . '/' . $csv_path . "\n");
        return ['encontrado' => false, 'producto' => null, 'fuente' => null];
    }

    $handle = fopen($csv_path, 'r');
    if (!$handle) {
        if ($debug_handle) fwrite($debug_handle, "ERROR: No se pudo abrir Libro.csv\n");
        return ['encontrado' => false, 'producto' => null, 'fuente' => null];
    }

    if ($debug_handle) fwrite($debug_handle, "Archivo Libro.csv abierto correctamente\n");
    
    $header = fgetcsv($handle); // Saltar header
    
    $linea_num = 2; 
    while (($data = fgetcsv($handle, 1000, ',')) !== false) {
        if ($debug_handle) fwrite($debug_handle, "\n--- LÍNEA $linea_num ---\n");
        
        if (count($data) >= 3) {
            $codArt = limpiarString($data[0]);
            $descripcion = limpiarString($data[1]);
            $ean = limpiarString($data[2]);

            if ($debug_handle) fwrite($debug_handle, "Campos leídos (limpios): codArt='$codArt', ean='$ean'\n");
            
            $match_codart = ($codArt === $codigo);
            $match_ean = ($ean === $codigo);

            if ($match_codart || $match_ean) {
                if ($debug_handle) fwrite($debug_handle, "✅ ¡ENCONTRADO! en línea $linea_num\n");
                fclose($handle);
                return [
                    'encontrado' => true,
                    'producto' => ['codigo' => $codArt, 'descripcion' => $descripcion, 'ean' => $ean],
                    'fuente' => 'Libro.csv'
                ];
            }
        } else {
            if ($debug_handle) fwrite($debug_handle, "ADVERTENCIA: Línea $linea_num con menos de 3 campos.\n");
        }
        $linea_num++;
    }
    
    if ($debug_handle) fwrite($debug_handle, "\n=== CÓDIGO NO ENCONTRADO EN LIBRO.CSV ===\n");
    fclose($handle);
    return ['encontrado' => false, 'producto' => null, 'fuente' => null];
}

function buscarEnCodigos($codigo, $debug_handle) {
    $csv_path = '../csv/0codigos.csv'; // Corregido: Subir un nivel
    if (!file_exists($csv_path)) {
        if ($debug_handle) fwrite($debug_handle, "ERROR: Archivo 0codigos.csv no encontrado.\n");
        return ['encontrado' => false, 'producto' => null, 'fuente' => null];
    }

    $handle = fopen($csv_path, 'r');
    if (!$handle) {
        if ($debug_handle) fwrite($debug_handle, "ERROR: No se pudo abrir 0codigos.csv\n");
        return ['encontrado' => false, 'producto' => null, 'fuente' => null];
    }

    if ($debug_handle) fwrite($debug_handle, "=== BÚSQUEDA EN 0CODIGOS.CSV ===\n");
    fgetcsv($handle, 1000, ';'); // saltar header
    
    while (($line = fgets($handle)) !== false) {
        if (empty(limpiarString($line))) continue;
        
        $data = explode(';', $line);
        
        if (count($data) >= 3) {
            $codProducto = limpiarString($data[0]);
            $descripcion = limpiarString($data[1]);
            $ean = limpiarString($data[2]);

            if ($debug_handle) fwrite($debug_handle, "0codigos - Comparando: '$codProducto' === '$codigo' o '$ean' === '$codigo'\n");
            
            if ($codProducto === $codigo || $ean === $codigo) {
                if ($debug_handle) fwrite($debug_handle, "✅ ENCONTRADO en 0codigos.csv\n");
                fclose($handle);
                return [
                    'encontrado' => true,
                    'producto' => ['codigo' => $codProducto, 'descripcion' => $descripcion, 'ean' => $ean],
                    'fuente' => '0codigos.csv'
                ];
            }
        }
    }
    
    if ($debug_handle) fwrite($debug_handle, "=== NO ENCONTRADO EN 0CODIGOS.CSV ===\n");
    fclose($handle);
    return ['encontrado' => false, 'producto' => null, 'fuente' => null];
}

function buscarPDF($codigo, $producto) {
    $pdf_dir = '../Pdf/'; // Corregido: Subir un nivel
    if (!is_dir($pdf_dir)) return null;

    $pdfs = glob($pdf_dir . '*.{pdf,PDF}', GLOB_BRACE);
    
    $codigoBusqueda = $producto['codigo'];
    $eanBusqueda = $producto['ean'];

    $busquedas = [];
    if (!empty($eanBusqueda)) {
        $busquedas[] = normalizar($eanBusqueda);
    }
    if (!empty($codigoBusqueda) && $codigoBusqueda !== $eanBusqueda) {
         $busquedas[] = normalizar($codigoBusqueda);
    }
    
    if (empty($busquedas)) return null;

    foreach ($pdfs as $pdfPath) {
        $nombreArchivo = basename($pdfPath);
        $nombreNormalizado = normalizar(pathinfo($nombreArchivo, PATHINFO_FILENAME));

        foreach($busquedas as $busquedaNorm) {
             if (strpos($nombreNormalizado, $busquedaNorm) !== false) {
                return $nombreArchivo;
            }
        }
    }

    return null;
}

function normalizar($texto) {
    return preg_replace('/[^a-z0-9]/', '', strtolower($texto));
}

// --- INICIO DEL SCRIPT ---

// ***** CAMBIO: Desactivar logs *****
$debug_handle = null; 
// $debug_log_file = 'debug_busqueda_' . date('Y-m-d_H-i-s') . '.log';
// $debug_handle = fopen($debug_log_file, 'w');
// ***** FIN CAMBIO *****

$codigo = '';
if (isset($_GET['codigo'])) {
    $codigo = $_GET['codigo'];
} elseif (isset($_POST['codigo'])) {
    $codigo = $_POST['codigo'];
}

if ($debug_handle) {
    fwrite($debug_handle, "=== NUEVA BÚSQUEDA ===\n");
    fwrite($debug_handle, "Código original (raw): '" . $codigo . "'\n");
    fwrite($debug_handle, "Hex dump (raw): " . bin2hex($codigo) . "\n");
}

$codigo_limpio = limpiarString($codigo);

if (empty($codigo_limpio)) {
    if ($debug_handle) fwrite($debug_handle, "ERROR: Código vacío después de la limpieza\n");
    if ($debug_handle) fclose($debug_handle);
    http_response_code(400);
    echo simpleJsonEncode(['error' => true, 'mensaje' => 'Codigo requerido']);
    exit;
}

$resultado = buscarProducto($codigo_limpio, $debug_handle);

$final_result = ($resultado['encontrado'] ? 'SI' : 'NO');
if ($debug_handle) fwrite($debug_handle, "=== RESULTADO FINAL ===\n");
if ($debug_handle) fwrite($debug_handle, "Encontrado: " . $final_result . "\n");

if ($resultado['encontrado']) {
    if ($debug_handle) {
        // ... (logs de resultado) ...
    }
    echo simpleJsonEncode([
        'error' => false,
        'encontrado' => true,
        'producto' => $resultado['producto'],
        'pdf' => $resultado['pdf'],
        'fuente' => $resultado['fuente']
    ]);
} else {
    if ($debug_handle) fwrite($debug_handle, "Producto no encontrado para código: '" . $codigo_limpio . "'\n");
    
    $respuesta = [
        'error' => false,
        'encontrado' => false,
        'mensaje' => 'Producto no encontrado',
        'codigo_buscado' => $codigo_limpio
    ];
    echo simpleJsonEncode($respuesta);
}

if ($debug_handle) fclose($debug_handle);
?>