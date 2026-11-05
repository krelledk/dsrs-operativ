<?php
declare(strict_types=1);

use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$dataDirectory = dirname(__DIR__, 2) . '/alarm-data';
$configFile = $dataDirectory . '/config.php';
if (!is_file($configFile)) {
    respond(['ok' => false, 'error' => 'Backend er ikke konfigureret endnu.'], 503);
}

$backendRoot = dirname(__DIR__, 2) . '/alarm-backend';
require $backendRoot . '/vendor/autoload.php';
$config = require $configFile;
$db = database($dataDirectory . '/alarm.sqlite');

session_name('dsrs_sar_control');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

$action = (string) ($_GET['action'] ?? 'health');
$method = (string) $_SERVER['REQUEST_METHOD'];

try {
    if ($action === 'health' && $method === 'GET') {
        respond(['ok' => true, 'service' => 'DSRS SAR pilotbackend', 'version' => '0.2.0', 'time' => now()]);
    }

    if ($action === 'config' && $method === 'GET') {
        respond(['ok' => true, 'vapidPublicKey' => $config['vapid_public'], 'backendVersion' => '0.2.0', 'stations' => publicStations($db)]);
    }

    if ($action === 'session' && $method === 'GET') {
        respond(['ok' => true, 'authenticated' => !empty($_SESSION['admin']), 'csrfToken' => $_SESSION['csrf'] ?? null]);
    }

    if ($action === 'login' && $method === 'POST') {
        $body = body();
        $code = strtolower(trim((string) ($body['code'] ?? '')));
        if (!password_verify($code, $config['admin_code_hash'])) {
            usleep(350000);
            audit($db, 'login_failed', null, ['ip' => clientIp()]);
            respond(['ok' => false, 'error' => 'Forkert kontrolcentral-kode.'], 401);
        }
        session_regenerate_id(true);
        $_SESSION['admin'] = true;
        $_SESSION['csrf'] = token(24);
        audit($db, 'login_success', null, ['ip' => clientIp()]);
        respond(['ok' => true, 'csrfToken' => $_SESSION['csrf']]);
    }

    if ($action === 'logout' && $method === 'POST') {
        requireAdmin();
        requireCsrf();
        $_SESSION = [];
        session_destroy();
        respond(['ok' => true]);
    }

    if ($action === 'subscribe' && $method === 'POST') {
        $body = body();
        $stationCode = strtolower(trim((string) ($body['stationCode'] ?? '')));
        $stationId = clean((string) ($body['stationId'] ?? 'station-koege'), 80);
        if (!password_verify($stationCode, $config['station_code_hash'])) {
            usleep(350000);
            respond(['ok' => false, 'error' => 'Forkert stationskode.'], 401);
        }
        $stationStatement = $db->prepare('SELECT id,slug,name FROM stations WHERE id=:id AND active=1 LIMIT 1');
        $stationStatement->execute([':id' => $stationId]);
        $station = $stationStatement->fetch();
        if (!$station) respond(['ok' => false, 'error' => 'Den valgte station findes ikke eller er ikke aktiv.'], 422);
        $crewName = clean((string) ($body['crewName'] ?? ''), 80);
        $deviceId = clean((string) ($body['deviceId'] ?? ''), 100);
        $subscription = $body['subscription'] ?? null;
        $endpoint = is_array($subscription) ? (string) ($subscription['endpoint'] ?? '') : '';
        if ($crewName === '' || $deviceId === '' || !is_array($subscription) || !filter_var($endpoint, FILTER_VALIDATE_URL)) {
            respond(['ok' => false, 'error' => 'Ugyldige enhedsoplysninger.'], 422);
        }
        $deviceToken = token(32);
        $statement = $db->prepare('INSERT INTO subscriptions(endpoint, subscription_json, device_id, device_token_hash, crew_name, station, station_id, active, created_at, updated_at, last_seen_at) VALUES(:endpoint,:subscription,:device_id,:token_hash,:crew_name,:station,:station_id,1,:now,:now,:now) ON CONFLICT(endpoint) DO UPDATE SET subscription_json=excluded.subscription_json, device_id=excluded.device_id, device_token_hash=excluded.device_token_hash, crew_name=excluded.crew_name, station=excluded.station, station_id=excluded.station_id, active=1, updated_at=excluded.updated_at, last_seen_at=excluded.last_seen_at');
        $statement->execute([
            ':endpoint' => $endpoint,
            ':subscription' => json_encode($subscription, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            ':device_id' => $deviceId,
            ':token_hash' => hash('sha256', $deviceToken),
            ':crew_name' => $crewName,
            ':station' => $station['slug'],
            ':station_id' => $station['id'],
            ':now' => now(),
        ]);
        audit($db, 'device_subscribed', null, ['crewName' => $crewName, 'deviceId' => $deviceId, 'stationId' => $station['id']]);
        respond(['ok' => true, 'deviceToken' => $deviceToken, 'crewName' => $crewName, 'station' => ['id' => $station['id'], 'name' => $station['name']]]);
    }

    if ($action === 'current' && $method === 'GET') {
        $subscription = requireDevice($db);
        $statement = $db->prepare('SELECT a.*, s.name AS station_name, d.delivery_token, d.push_sent_at, d.app_received_at, d.notification_shown_at, d.response, d.response_at FROM alarms a JOIN deliveries d ON d.alarm_id=a.id LEFT JOIN stations s ON s.id=a.station_id WHERE d.subscription_id=:subscription_id AND a.completed_at IS NULL ORDER BY a.created_at DESC LIMIT 1');
        $statement->execute([':subscription_id' => $subscription['id']]);
        $row = $statement->fetch();
        respond(['ok' => true, 'alarm' => $row ? alarmPayload($row, $row['delivery_token']) : null, 'delivery' => $row ? deliveryPayload($row) : null]);
    }

    if ($action === 'receipt' && $method === 'POST') {
        $body = body();
        $deliveryToken = (string) ($body['deliveryToken'] ?? '');
        $stage = (string) ($body['stage'] ?? '');
        $response = (string) ($body['response'] ?? '');
        if ($deliveryToken === '') respond(['ok' => false, 'error' => 'Leveringstoken mangler.'], 422);
        $statement = $db->prepare('SELECT id, alarm_id FROM deliveries WHERE token_hash=:token_hash LIMIT 1');
        $statement->execute([':token_hash' => hash('sha256', $deliveryToken)]);
        $delivery = $statement->fetch();
        if (!$delivery) respond(['ok' => false, 'error' => 'Ukendt leveringstoken.'], 404);
        if ($stage === 'received') {
            $db->prepare('UPDATE deliveries SET app_received_at=COALESCE(app_received_at,:now) WHERE id=:id')->execute([':now' => now(), ':id' => $delivery['id']]);
        } elseif ($stage === 'shown') {
            $db->prepare('UPDATE deliveries SET app_received_at=COALESCE(app_received_at,:now), notification_shown_at=COALESCE(notification_shown_at,:now) WHERE id=:id')->execute([':now' => now(), ':id' => $delivery['id']]);
        } elseif ($stage === 'response' && in_array($response, ['accepted', 'rejected'], true)) {
            $db->prepare('UPDATE deliveries SET response=:response, response_at=:now WHERE id=:id')->execute([':response' => $response, ':now' => now(), ':id' => $delivery['id']]);
        } else {
            respond(['ok' => false, 'error' => 'Ugyldig kvittering.'], 422);
        }
        audit($db, 'delivery_' . $stage, (string) $delivery['alarm_id'], ['response' => $response ?: null]);
        respond(['ok' => true]);
    }

    if ($action === 'dispatch' && $method === 'POST') {
        requireAdmin();
        requireCsrf();
        $body = body();
        $stationId = clean((string) ($body['stationId'] ?? 'station-koege'), 80);
        $stationStatement = $db->prepare('SELECT id,slug,name FROM stations WHERE id=:id AND active=1 LIMIT 1');
        $stationStatement->execute([':id' => $stationId]);
        $station = $stationStatement->fetch();
        if (!$station) respond(['ok' => false, 'error' => 'Den valgte station findes ikke eller er ikke aktiv.'], 422);
        $vesselIds = array_values(array_unique(array_slice(array_filter(array_map(fn($value) => clean((string) $value, 80), (array) ($body['vesselIds'] ?? []))), 0, 20)));
        if ($vesselIds !== []) {
            $placeholders = implode(',', array_fill(0, count($vesselIds), '?'));
            $vesselStatement = $db->prepare("SELECT id FROM vessels WHERE station_id=? AND active=1 AND id IN ($placeholders)");
            $vesselStatement->execute(array_merge([$stationId], $vesselIds));
            if (count($vesselStatement->fetchAll()) !== count($vesselIds)) respond(['ok' => false, 'error' => 'Et eller flere valgte fartøjer tilhører ikke stationen.'], 422);
        }
        $alarm = [
            'id' => bin2hex(random_bytes(12)),
            'stationId' => $station['id'],
            'stationName' => $station['name'],
            'vesselIds' => $vesselIds,
            'type' => clean((string) ($body['type'] ?? ''), 100),
            'priority' => clean((string) ($body['priority'] ?? 'high'), 20),
            'location' => clean((string) ($body['location'] ?? ''), 220),
            'message' => clean((string) ($body['message'] ?? ''), 1500),
            'units' => array_values(array_slice(array_filter(array_map(fn($value) => clean((string) $value, 80), (array) ($body['units'] ?? []))), 0, 20)),
            'createdAt' => now(),
        ];
        if ($alarm['type'] === '' || $alarm['location'] === '' || $alarm['units'] === []) {
            respond(['ok' => false, 'error' => 'Alarmtype, position og mindst en enhed er paakraevet.'], 422);
        }
        $db->beginTransaction();
        $db->prepare("UPDATE alarms SET completed_at=:completed_at, completed_by='superseded' WHERE completed_at IS NULL AND station_id=:station_id")->execute([':completed_at' => now(), ':station_id' => $stationId]);
        $db->prepare('INSERT INTO alarms(id,station_id,vessel_ids_json,type,priority,location,message,units_json,created_at,created_by) VALUES(:id,:station_id,:vessel_ids,:type,:priority,:location,:message,:units,:created_at,:created_by)')->execute([
            ':id' => $alarm['id'], ':station_id' => $stationId, ':vessel_ids' => json_encode($vesselIds, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), ':type' => $alarm['type'], ':priority' => $alarm['priority'], ':location' => $alarm['location'], ':message' => $alarm['message'], ':units' => json_encode($alarm['units'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), ':created_at' => $alarm['createdAt'], ':created_by' => 'control',
        ]);
        $subscriptionStatement = $db->prepare('SELECT * FROM subscriptions WHERE active=1 AND station_id=:station_id ORDER BY id');
        $subscriptionStatement->execute([':station_id' => $stationId]);
        $subscriptions = $subscriptionStatement->fetchAll();
        $deliveryByEndpoint = [];
        foreach ($subscriptions as $subscription) {
            $deliveryToken = token(32);
            $db->prepare('INSERT INTO deliveries(alarm_id,subscription_id,delivery_token,token_hash,created_at) VALUES(:alarm_id,:subscription_id,:delivery_token,:token_hash,:created_at)')->execute([
                ':alarm_id' => $alarm['id'], ':subscription_id' => $subscription['id'], ':delivery_token' => $deliveryToken, ':token_hash' => hash('sha256', $deliveryToken), ':created_at' => now(),
            ]);
            $deliveryByEndpoint[$subscription['endpoint']] = ['id' => (int) $db->lastInsertId(), 'token' => $deliveryToken, 'subscription' => $subscription];
        }
        $db->commit();

        $webPush = new WebPush(['VAPID' => ['subject' => $config['vapid_subject'], 'publicKey' => $config['vapid_public'], 'privateKey' => $config['vapid_private']]], ['TTL' => 300, 'urgency' => 'high']);
        foreach ($deliveryByEndpoint as $endpoint => $delivery) {
            $payload = [
                'title' => 'DSRS SAR-ALARM · ' . $alarm['type'],
                'body' => $alarm['location'] . "\n" . $alarm['message'],
                'tag' => $alarm['id'],
                'url' => '/#responder?delivery=' . rawurlencode($delivery['token']) . '&alert=1',
                'alarm' => $alarm,
                'deliveryToken' => $delivery['token'],
            ];
            $webPush->queueNotification(Subscription::create(json_decode($delivery['subscription']['subscription_json'], true, 512, JSON_THROW_ON_ERROR)), json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), ['TTL' => 300, 'urgency' => 'high', 'topic' => substr($alarm['id'], 0, 32)]);
        }
        $sent = 0;
        $failed = 0;
        foreach ($webPush->flush() as $report) {
            $endpoint = (string) $report->getRequest()->getUri();
            $delivery = $deliveryByEndpoint[$endpoint] ?? null;
            if (!$delivery) continue;
            if ($report->isSuccess()) {
                $sent++;
                $db->prepare('UPDATE deliveries SET push_sent_at=:now WHERE id=:id')->execute([':now' => now(), ':id' => $delivery['id']]);
            } else {
                $failed++;
                $db->prepare('UPDATE deliveries SET last_error=:error WHERE id=:id')->execute([':error' => substr($report->getReason(), 0, 500), ':id' => $delivery['id']]);
                if ($report->isSubscriptionExpired()) $db->prepare('UPDATE subscriptions SET active=0 WHERE id=:id')->execute([':id' => $delivery['subscription']['id']]);
            }
        }
        audit($db, 'alarm_dispatched', $alarm['id'], ['stationId' => $stationId, 'vesselIds' => $vesselIds, 'subscriptions' => count($subscriptions), 'sent' => $sent, 'failed' => $failed]);
        respond(['ok' => true, 'alarm' => $alarm, 'delivery' => ['recipients' => count($subscriptions), 'sent' => $sent, 'failed' => $failed]]);
    }

    if ($action === 'status' && $method === 'GET') {
        requireAdmin();
        $stationId = clean((string) ($_GET['stationId'] ?? 'station-koege'), 80);
        $alarmStatement = $db->prepare('SELECT a.*,s.name AS station_name FROM alarms a LEFT JOIN stations s ON s.id=a.station_id WHERE a.completed_at IS NULL AND a.station_id=:station_id ORDER BY a.created_at DESC LIMIT 1');
        $alarmStatement->execute([':station_id' => $stationId]);
        $alarm = $alarmStatement->fetch();
        $activeCount = (int) $db->query('SELECT COUNT(*) FROM alarms WHERE completed_at IS NULL')->fetchColumn();
        if (!$alarm) respond(['ok' => true, 'alarm' => null, 'deliveries' => [], 'activeCount' => $activeCount]);
        $statement = $db->prepare('SELECT d.push_sent_at,d.app_received_at,d.notification_shown_at,d.response,d.response_at,d.last_error,s.crew_name,s.device_id FROM deliveries d JOIN subscriptions s ON s.id=d.subscription_id WHERE d.alarm_id=:alarm_id ORDER BY s.crew_name');
        $statement->execute([':alarm_id' => $alarm['id']]);
        respond(['ok' => true, 'alarm' => alarmPayload($alarm), 'deliveries' => $statement->fetchAll(), 'activeCount' => $activeCount]);
    }

    if ($action === 'complete' && $method === 'POST') {
        requireAdmin();
        requireCsrf();
        $body = body();
        $alarmId = clean((string) ($body['alarmId'] ?? ''), 100);
        if ($alarmId === '') {
            $stationId = clean((string) ($body['stationId'] ?? 'station-koege'), 80);
            $fallbackStatement = $db->prepare('SELECT id FROM alarms WHERE completed_at IS NULL AND station_id=:station_id ORDER BY created_at DESC LIMIT 1');
            $fallbackStatement->execute([':station_id' => $stationId]);
            $row = $fallbackStatement->fetch();
            $alarmId = (string) ($row['id'] ?? '');
        }
        if ($alarmId === '') respond(['ok' => false, 'error' => 'Der er ingen aktiv alarm.'], 404);
        $completedAt = now();
        $statement = $db->prepare('UPDATE alarms SET completed_at=:completed_at, completed_by=:completed_by WHERE id=:id AND completed_at IS NULL');
        $statement->execute([':completed_at' => $completedAt, ':completed_by' => 'control', ':id' => $alarmId]);
        if ($statement->rowCount() !== 1) respond(['ok' => false, 'error' => 'Alarmen er allerede afsluttet eller findes ikke.'], 409);
        audit($db, 'alarm_completed', $alarmId, ['completedBy' => 'control']);
        respond(['ok' => true, 'alarmId' => $alarmId, 'completedAt' => $completedAt]);
    }

    respond(['ok' => false, 'error' => 'Ukendt API-kald.'], 404);
} catch (Throwable $error) {
    if ($db->inTransaction()) $db->rollBack();
    error_log('DSRS SAR API: ' . $error->getMessage());
    respond(['ok' => false, 'error' => 'Intern serverfejl.'], 500);
}

function database(string $path): PDO
{
    $db = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    $db->exec('CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);');
    $db->exec('CREATE TABLE IF NOT EXISTS stations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, short_name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, display_order INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(organization_id) REFERENCES organizations(id));');
    $db->exec('CREATE TABLE IF NOT EXISTS vessels (id TEXT PRIMARY KEY, station_id TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, type TEXT NOT NULL, crew_required INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1, FOREIGN KEY(station_id) REFERENCES stations(id));');
    $db->exec('CREATE TABLE IF NOT EXISTS subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, endpoint TEXT NOT NULL UNIQUE, subscription_json TEXT NOT NULL, device_id TEXT NOT NULL, device_token_hash TEXT NOT NULL, crew_name TEXT NOT NULL, station TEXT NOT NULL, station_id TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_seen_at TEXT);');
    $db->exec('CREATE TABLE IF NOT EXISTS alarms (id TEXT PRIMARY KEY, station_id TEXT, vessel_ids_json TEXT NOT NULL DEFAULT \'[]\', type TEXT NOT NULL, priority TEXT NOT NULL, location TEXT NOT NULL, message TEXT NOT NULL, units_json TEXT NOT NULL, created_at TEXT NOT NULL, created_by TEXT NOT NULL, completed_at TEXT, completed_by TEXT);');
    $db->exec('CREATE TABLE IF NOT EXISTS deliveries (id INTEGER PRIMARY KEY AUTOINCREMENT, alarm_id TEXT NOT NULL, subscription_id INTEGER NOT NULL, delivery_token TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, push_sent_at TEXT, app_received_at TEXT, notification_shown_at TEXT, response TEXT, response_at TEXT, last_error TEXT, FOREIGN KEY(alarm_id) REFERENCES alarms(id), FOREIGN KEY(subscription_id) REFERENCES subscriptions(id));');
    $db->exec('CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, alarm_id TEXT, metadata_json TEXT NOT NULL, created_at TEXT NOT NULL);');

    $alarmColumns = array_column($db->query('PRAGMA table_info(alarms)')->fetchAll(), 'name');
    if (!in_array('completed_at', $alarmColumns, true)) $db->exec('ALTER TABLE alarms ADD COLUMN completed_at TEXT');
    if (!in_array('completed_by', $alarmColumns, true)) $db->exec('ALTER TABLE alarms ADD COLUMN completed_by TEXT');
    if (!in_array('station_id', $alarmColumns, true)) $db->exec('ALTER TABLE alarms ADD COLUMN station_id TEXT');
    if (!in_array('vessel_ids_json', $alarmColumns, true)) $db->exec("ALTER TABLE alarms ADD COLUMN vessel_ids_json TEXT NOT NULL DEFAULT '[]'");
    $subscriptionColumns = array_column($db->query('PRAGMA table_info(subscriptions)')->fetchAll(), 'name');
    if (!in_array('station_id', $subscriptionColumns, true)) $db->exec('ALTER TABLE subscriptions ADD COLUMN station_id TEXT');

    $db->prepare('INSERT OR IGNORE INTO organizations(id,slug,name,active) VALUES(:id,:slug,:name,1)')->execute([':id' => 'org-dsrs', ':slug' => 'dsrs', ':name' => 'Dansk Søredningsselskab']);
    $stations = [
        ['station-helsingoer','helsingoer','DSRS Helsingør','Helsingør'],
        ['station-bregnoer','bregnoer','DSRS Bregnør','Bregnør'],
        ['station-lynaes','lynaes','DSRS Lynæs','Lynæs'],
        ['station-rudkoebing','rudkoebing','DSRS Rudkøbing','Rudkøbing'],
        ['station-juelsminde','juelsminde','DSRS Juelsminde','Juelsminde'],
        ['station-koebenhavn','koebenhavn','DSRS København','København'],
        ['station-loegstoer','loegstoer','DSRS Løgstør','Løgstør'],
        ['station-vordingborg','vordingborg','DSRS Vordingborg','Vordingborg'],
        ['station-koege','koege','DSRS Køge','Køge'],
        ['station-kerteminde','kerteminde','DSRS Kerteminde','Kerteminde'],
        ['station-assens-lillebaelt','assens-lillebaelt','DSRS Assens-Lillebælt','Assens-Lillebælt'],
        ['station-faaborg','faaborg','DSRS Faaborg','Faaborg'],
        ['station-struer','struer','DSRS Struer','Struer'],
        ['station-faxe-ladeplads','faxe-ladeplads','DSRS Faxe Ladeplads','Faxe Ladeplads'],
    ];
    $stationInsert = $db->prepare('INSERT OR IGNORE INTO stations(id,organization_id,slug,name,short_name,active,display_order) VALUES(:id,\'org-dsrs\',:slug,:name,:short_name,1,:display_order)');
    foreach ($stations as $order => [$id,$slug,$name,$shortName]) $stationInsert->execute([':id' => $id, ':slug' => $slug, ':name' => $name, ':short_name' => $shortName, ':display_order' => $order + 1]);
    $vesselInsert = $db->prepare('INSERT OR IGNORE INTO vessels(id,station_id,slug,name,type,crew_required,active) VALUES(:id,:station_id,:slug,:name,:type,:crew_required,1)');
    $vesselInsert->execute([':id' => 'vessel-rs-koege', ':station_id' => 'station-koege', ':slug' => 'rs-koege', ':name' => 'RS Køge', ':type' => 'Redningsfartøj', ':crew_required' => 4]);
    $vesselInsert->execute([':id' => 'vessel-rhib-01', ':station_id' => 'station-koege', ':slug' => 'rhib-01', ':name' => 'RHIB 01', ':type' => 'RHIB', ':crew_required' => 2]);

    $db->exec("UPDATE subscriptions SET station_id='station-koege' WHERE station_id IS NULL OR station_id=''");
    $db->exec("UPDATE alarms SET station_id='station-koege' WHERE station_id IS NULL OR station_id=''");
    $db->exec('CREATE INDEX IF NOT EXISTS idx_subscriptions_token ON subscriptions(device_token_hash); CREATE INDEX IF NOT EXISTS idx_subscriptions_station ON subscriptions(station_id,active); CREATE INDEX IF NOT EXISTS idx_alarms_station_active ON alarms(station_id,completed_at,created_at); CREATE INDEX IF NOT EXISTS idx_deliveries_alarm ON deliveries(alarm_id);');
    return $db;
}

function body(): array
{
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw ?: '{}', true);
    if (!is_array($decoded)) respond(['ok' => false, 'error' => 'Ugyldig JSON.'], 400);
    return $decoded;
}

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

function requireAdmin(): void
{
    if (empty($_SESSION['admin'])) respond(['ok' => false, 'error' => 'Login paakraevet.'], 401);
}

function requireCsrf(): void
{
    $header = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (empty($_SESSION['csrf']) || !hash_equals((string) $_SESSION['csrf'], $header)) respond(['ok' => false, 'error' => 'Ugyldig sikkerhedstoken.'], 403);
}

function requireDevice(PDO $db): array
{
    $authorization = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (!preg_match('/^Bearer\s+(.+)$/i', $authorization, $matches)) respond(['ok' => false, 'error' => 'Enhedstoken paakraevet.'], 401);
    $statement = $db->prepare('SELECT * FROM subscriptions WHERE device_token_hash=:token_hash AND active=1 LIMIT 1');
    $statement->execute([':token_hash' => hash('sha256', trim($matches[1]))]);
    $subscription = $statement->fetch();
    if (!$subscription) respond(['ok' => false, 'error' => 'Ugyldig enhedstoken.'], 401);
    $db->prepare('UPDATE subscriptions SET last_seen_at=:now WHERE id=:id')->execute([':now' => now(), ':id' => $subscription['id']]);
    return $subscription;
}

function alarmPayload(array $row, ?string $deliveryToken = null): array
{
    $payload = ['id' => $row['id'], 'stationId' => $row['station_id'] ?? 'station-koege', 'stationName' => $row['station_name'] ?? 'DSRS Køge', 'vesselIds' => json_decode((string) ($row['vessel_ids_json'] ?? '[]'), true) ?: [], 'type' => $row['type'], 'priority' => $row['priority'], 'location' => $row['location'], 'message' => $row['message'], 'units' => json_decode($row['units_json'], true) ?: [], 'createdAt' => $row['created_at']];
    if ($deliveryToken !== null) $payload['deliveryToken'] = $deliveryToken;
    return $payload;
}

function publicStations(PDO $db): array
{
    $stations = $db->query('SELECT id,slug,name,short_name FROM stations WHERE active=1 ORDER BY display_order,name')->fetchAll();
    $vesselStatement = $db->prepare('SELECT id,slug,name,type,crew_required FROM vessels WHERE station_id=:station_id AND active=1 ORDER BY name');
    foreach ($stations as &$station) {
        $vesselStatement->execute([':station_id' => $station['id']]);
        $station['vessels'] = array_map(static fn(array $vessel): array => [
            'id' => $vessel['id'],
            'slug' => $vessel['slug'],
            'name' => $vessel['name'],
            'type' => $vessel['type'],
            'crewRequired' => (int) $vessel['crew_required'],
        ], $vesselStatement->fetchAll());
        $station['shortName'] = $station['short_name'];
        unset($station['short_name']);
    }
    unset($station);
    return $stations;
}

function deliveryPayload(array $row): array
{
    return ['pushSentAt' => $row['push_sent_at'], 'appReceivedAt' => $row['app_received_at'], 'notificationShownAt' => $row['notification_shown_at'], 'response' => $row['response'], 'responseAt' => $row['response_at']];
}

function audit(PDO $db, string $event, ?string $alarmId, array $metadata): void
{
    $db->prepare('INSERT INTO audit_log(event,alarm_id,metadata_json,created_at) VALUES(:event,:alarm_id,:metadata,:created_at)')->execute([':event' => $event, ':alarm_id' => $alarmId, ':metadata' => json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), ':created_at' => now()]);
}

function token(int $bytes): string
{
    return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
}

function clean(string $value, int $maxLength): string
{
    return mb_substr(trim($value), 0, $maxLength);
}

function now(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

function clientIp(): string
{
    return substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64);
}
