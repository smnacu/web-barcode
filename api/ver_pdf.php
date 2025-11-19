<?php
$configFile = __DIR__ . '/config.json';
if (!file_exists($configFile)) die("Error config.");
$config = json_decode(file_get_contents($configFile), true);

$archivo = basename($_GET['archivo'] ?? '');
if (empty($archivo)) die("Error archivo.");

$rutaBase = $config['ruta_pdf'];
if (!file_exists($rutaBase) && file_exists(__DIR__ . '/' . $rutaBase)) {
    $rutaBase = __DIR__ . '/' . $rutaBase;
}
$rutaBase = rtrim($rutaBase, '/\\') . DIRECTORY_SEPARATOR;
$rutaCompleta = $rutaBase . $archivo;

if (!file_exists($rutaCompleta)) {
    header("HTTP/1.0 404 Not Found");
    die("No encontrado.");
}

header('Content-Type: application/pdf');
header('Content-Disposition: inline; filename="' . $archivo . '"');
header('Content-Length: ' . filesize($rutaCompleta));
header('Cache-Control: private, max-age=0, must-revalidate');

if (ob_get_length()) ob_clean();
flush();
readfile($rutaCompleta);
exit;
?>