<?php
declare(strict_types=1);

use Minishlink\WebPush\VAPID;

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/vendor/autoload.php';

$adminCode = (string) getenv('DSRS_ADMIN_CODE');
$stationCode = (string) getenv('DSRS_STATION_CODE');
if (strlen($adminCode) < 8 || strlen($stationCode) < 8 || hash_equals($adminCode, $stationCode)) {
    fwrite(STDERR, "Kontrolcentral- og stationskode skal vaere forskellige og mindst 8 tegn.\n");
    exit(1);
}

$dataDirectory = dirname(__DIR__) . '/alarm-data';
$configFile = $dataDirectory . '/config.php';
if (is_file($configFile)) {
    fwrite(STDERR, "Konfiguration findes allerede; ingen aendringer foretaget.\n");
    exit(2);
}

if (!is_dir($dataDirectory) && !mkdir($dataDirectory, 0700, true) && !is_dir($dataDirectory)) {
    throw new RuntimeException('Kunne ikke oprette datamappen.');
}

$keys = VAPID::createVapidKeys();
$config = [
    'version' => 1,
    'vapid_subject' => 'https://alarm.hansenlabs.dk',
    'vapid_public' => $keys['publicKey'],
    'vapid_private' => $keys['privateKey'],
    'admin_code_hash' => password_hash($adminCode, PASSWORD_DEFAULT),
    'station_code_hash' => password_hash($stationCode, PASSWORD_DEFAULT),
];

$contents = "<?php\ndeclare(strict_types=1);\nreturn " . var_export($config, true) . ";\n";
if (file_put_contents($configFile, $contents, LOCK_EX) === false) {
    throw new RuntimeException('Kunne ikke gemme konfigurationen.');
}
chmod($configFile, 0600);
file_put_contents($dataDirectory . '/.htaccess', "Require all denied\n", LOCK_EX);
chmod($dataDirectory . '/.htaccess', 0600);
fwrite(STDOUT, "DSRS SAR backend konfigureret.\n");
