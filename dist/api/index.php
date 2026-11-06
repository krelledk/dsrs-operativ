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
        respond(['ok' => true, 'service' => 'DSRS SAR pilotbackend', 'version' => '0.5.0', 'time' => now()]);
    }

    if ($action === 'config' && $method === 'GET') {
        respond(['ok' => true, 'vapidPublicKey' => $config['vapid_public'], 'backendVersion' => '0.5.0', 'stations' => publicStations($db), 'crewProfile' => crewProfileOptions($db)]);
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

    if ($action === 'coordinators' && $method === 'GET') {
        requireAdmin();
        $stationId = clean((string) ($_GET['stationId'] ?? ''), 80);
        $statement = $db->prepare('SELECT id,name,phone,latitude,longitude,is_test FROM coordinators WHERE station_id=:station_id AND active=1 ORDER BY is_test DESC,name');
        $statement->execute([':station_id' => $stationId]);
        respond(['ok' => true, 'coordinators' => array_map('coordinatorPayload', $statement->fetchAll())]);
    }

    if ($action === 'coordinator-save' && $method === 'POST') {
        requireAdmin();
        requireCsrf();
        $body = body();
        $id = clean((string) ($body['id'] ?? ''), 100);
        $stationId = clean((string) ($body['stationId'] ?? ''), 80);
        $name = clean((string) ($body['name'] ?? ''), 100);
        $phone = clean((string) ($body['phone'] ?? ''), 40);
        $latitude = filter_var($body['latitude'] ?? null, FILTER_VALIDATE_FLOAT);
        $longitude = filter_var($body['longitude'] ?? null, FILTER_VALIDATE_FLOAT);
        $stationStatement = $db->prepare('SELECT id FROM stations WHERE id=:id AND active=1 LIMIT 1');
        $stationStatement->execute([':id' => $stationId]);
        if (!$stationStatement->fetch()) respond(['ok' => false, 'error' => 'Den valgte station findes ikke.'], 422);
        if ($name === '' || !preg_match('/^[+0-9() .-]{6,40}$/', $phone)) respond(['ok' => false, 'error' => 'Angiv navn og et gyldigt telefonnummer.'], 422);
        if ($latitude === false || $longitude === false || $latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) respond(['ok' => false, 'error' => 'Koordinatorens koordinater er ugyldige.'], 422);
        $now = now();
        if ($id !== '') {
            $existingStatement = $db->prepare('SELECT id FROM coordinators WHERE id=:id AND station_id=:station_id LIMIT 1');
            $existingStatement->execute([':id' => $id, ':station_id' => $stationId]);
            if (!$existingStatement->fetch()) respond(['ok' => false, 'error' => 'Koordinatoren findes ikke på den valgte station.'], 404);
            $db->prepare('UPDATE coordinators SET name=:name,phone=:phone,latitude=:latitude,longitude=:longitude,active=1,updated_at=:updated_at WHERE id=:id AND station_id=:station_id')->execute([':name' => $name, ':phone' => $phone, ':latitude' => $latitude, ':longitude' => $longitude, ':updated_at' => $now, ':id' => $id, ':station_id' => $stationId]);
        } else {
            $id = 'coordinator-' . bin2hex(random_bytes(10));
            $db->prepare('INSERT INTO coordinators(id,station_id,name,phone,latitude,longitude,active,created_at,updated_at) VALUES(:id,:station_id,:name,:phone,:latitude,:longitude,1,:created_at,:updated_at)')->execute([':id' => $id, ':station_id' => $stationId, ':name' => $name, ':phone' => $phone, ':latitude' => $latitude, ':longitude' => $longitude, ':created_at' => $now, ':updated_at' => $now]);
        }
        audit($db, 'coordinator_saved', null, ['coordinatorId' => $id, 'stationId' => $stationId]);
        $savedStatement = $db->prepare('SELECT id,name,phone,latitude,longitude,is_test FROM coordinators WHERE id=:id LIMIT 1');
        $savedStatement->execute([':id' => $id]);
        respond(['ok' => true, 'coordinator' => coordinatorPayload($savedStatement->fetch())]);
    }

    if ($action === 'subscribe' && $method === 'POST') {
        $body = body();
        $stationCode = strtolower(trim((string) ($body['stationCode'] ?? '')));
        $stationId = clean((string) ($body['stationId'] ?? 'station-koege'), 80);
        $crewName = clean((string) ($body['crewName'] ?? ''), 80);
        $deviceId = clean((string) ($body['deviceId'] ?? ''), 100);
        $roleId = clean((string) ($body['roleId'] ?? ''), 80);
        $competencyIdsProvided = array_key_exists('competencyIds', $body);
        $competencyIds = array_values(array_unique(array_slice(array_filter(array_map(fn($value) => clean((string) $value, 80), (array) ($body['competencyIds'] ?? []))), 0, 20)));
        $previousDeviceToken = trim((string) ($body['deviceToken'] ?? ''));
        $renewedSubscription = null;
        if ($previousDeviceToken !== '') {
            $renewalStatement = $db->prepare('SELECT * FROM subscriptions WHERE device_token_hash=:token_hash ORDER BY id DESC LIMIT 1');
            $renewalStatement->execute([':token_hash' => hash('sha256', $previousDeviceToken)]);
            $renewedSubscription = $renewalStatement->fetch() ?: null;
            if ($renewedSubscription && ($renewedSubscription['device_id'] !== $deviceId || $renewedSubscription['station_id'] !== $stationId)) {
                $renewedSubscription = null;
            }
        }
        if (!$renewedSubscription && !password_verify($stationCode, $config['station_code_hash'])) {
            usleep(350000);
            respond(['ok' => false, 'error' => 'Forkert stationskode.'], 401);
        }
        $stationStatement = $db->prepare('SELECT id,slug,name FROM stations WHERE id=:id AND active=1 LIMIT 1');
        $stationStatement->execute([':id' => $stationId]);
        $station = $stationStatement->fetch();
        if (!$station) respond(['ok' => false, 'error' => 'Den valgte station findes ikke eller er ikke aktiv.'], 422);
        $subscription = $body['subscription'] ?? null;
        $endpoint = is_array($subscription) ? (string) ($subscription['endpoint'] ?? '') : '';
        if ($crewName === '' || $deviceId === '' || !is_array($subscription) || !filter_var($endpoint, FILTER_VALIDATE_URL)) {
            respond(['ok' => false, 'error' => 'Ugyldige enhedsoplysninger.'], 422);
        }
        $person = ensureCrewProfile($db, $crewName, $station['id'], $roleId, $competencyIds, $renewedSubscription, $competencyIdsProvided);
        $deviceToken = token(32);
        $statement = $db->prepare('INSERT INTO subscriptions(endpoint, subscription_json, device_id, device_token_hash, crew_name, station, station_id, person_id, active, created_at, updated_at, last_seen_at) VALUES(:endpoint,:subscription,:device_id,:token_hash,:crew_name,:station,:station_id,:person_id,1,:now,:now,:now) ON CONFLICT(endpoint) DO UPDATE SET subscription_json=excluded.subscription_json, device_id=excluded.device_id, device_token_hash=excluded.device_token_hash, crew_name=excluded.crew_name, station=excluded.station, station_id=excluded.station_id, person_id=excluded.person_id, active=1, updated_at=excluded.updated_at, last_seen_at=excluded.last_seen_at');
        $statement->execute([
            ':endpoint' => $endpoint,
            ':subscription' => json_encode($subscription, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            ':device_id' => $deviceId,
            ':token_hash' => hash('sha256', $deviceToken),
            ':crew_name' => $crewName,
            ':station' => $station['slug'],
            ':station_id' => $station['id'],
            ':person_id' => $person['id'],
            ':now' => now(),
        ]);
        audit($db, $renewedSubscription ? 'device_subscription_renewed' : 'device_subscribed', null, ['personId' => $person['id'], 'crewName' => $person['name'], 'deviceId' => $deviceId, 'stationId' => $station['id'], 'roleId' => $person['role']['id']]);
        respond(['ok' => true, 'deviceToken' => $deviceToken, 'crewName' => $person['name'], 'renewed' => (bool) $renewedSubscription, 'person' => $person, 'station' => ['id' => $station['id'], 'name' => $station['name']]]);
    }

    if ($action === 'current' && $method === 'GET') {
        $subscription = requireDevice($db);
        $statement = $db->prepare('SELECT a.*, s.name AS station_name, d.delivery_token, d.push_sent_at, d.app_received_at, d.notification_shown_at, d.response, d.response_at FROM alarms a LEFT JOIN deliveries d ON d.alarm_id=a.id AND d.subscription_id=:subscription_id LEFT JOIN stations s ON s.id=a.station_id WHERE a.station_id=:station_id AND a.completed_at IS NULL ORDER BY a.created_at DESC LIMIT 1');
        $statement->execute([':subscription_id' => $subscription['id'], ':station_id' => $subscription['station_id']]);
        $row = $statement->fetch();
        if ($row && empty($row['delivery_token'])) {
            $deliveryToken = token(32);
            $db->prepare('INSERT INTO deliveries(alarm_id,subscription_id,delivery_token,token_hash,created_at) VALUES(:alarm_id,:subscription_id,:delivery_token,:token_hash,:created_at)')->execute([
                ':alarm_id' => $row['id'], ':subscription_id' => $subscription['id'], ':delivery_token' => $deliveryToken, ':token_hash' => hash('sha256', $deliveryToken), ':created_at' => now(),
            ]);
            $row['delivery_token'] = $deliveryToken;
            $row['push_sent_at'] = null;
            $row['app_received_at'] = null;
            $row['notification_shown_at'] = null;
            $row['response'] = null;
            $row['response_at'] = null;
            audit($db, 'active_alarm_recovered_by_app', (string) $row['id'], ['subscriptionId' => (int) $subscription['id']]);
        }
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
        $coordinatorId = clean((string) ($body['coordinatorId'] ?? ''), 100);
        $coordinator = null;
        if ($coordinatorId !== '') {
            $coordinatorStatement = $db->prepare('SELECT id,name,phone,latitude,longitude,is_test FROM coordinators WHERE id=:id AND station_id=:station_id AND active=1 LIMIT 1');
            $coordinatorStatement->execute([':id' => $coordinatorId, ':station_id' => $stationId]);
            $coordinatorRow = $coordinatorStatement->fetch();
            if (!$coordinatorRow) respond(['ok' => false, 'error' => 'Den valgte koordinator tilhører ikke stationen.'], 422);
            $coordinator = coordinatorPayload($coordinatorRow);
        }
        $positionBody = is_array($body['position'] ?? null) ? $body['position'] : [];
        $latitude = filter_var($positionBody['latitude'] ?? null, FILTER_VALIDATE_FLOAT);
        $longitude = filter_var($positionBody['longitude'] ?? null, FILTER_VALIDATE_FLOAT);
        $positionSource = clean((string) ($positionBody['source'] ?? 'manual'), 30);
        if ($coordinator) {
            $latitude = $coordinator['latitude'];
            $longitude = $coordinator['longitude'];
            $positionSource = 'coordinator';
        }
        if ($latitude !== false && ($latitude < -90 || $latitude > 90)) respond(['ok' => false, 'error' => 'Breddegraden er ugyldig.'], 422);
        if ($longitude !== false && ($longitude < -180 || $longitude > 180)) respond(['ok' => false, 'error' => 'Længdegraden er ugyldig.'], 422);
        if (!in_array($positionSource, ['coordinator', 'map', 'manual', 'api'], true)) $positionSource = 'manual';
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
            'coordinator' => $coordinator,
            'position' => ($latitude !== false && $longitude !== false) ? ['latitude' => (float) $latitude, 'longitude' => (float) $longitude, 'source' => $positionSource] : null,
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
        $db->prepare('INSERT INTO alarms(id,station_id,coordinator_id,coordinator_snapshot_json,latitude,longitude,position_source,vessel_ids_json,type,priority,location,message,units_json,created_at,created_by) VALUES(:id,:station_id,:coordinator_id,:coordinator_snapshot,:latitude,:longitude,:position_source,:vessel_ids,:type,:priority,:location,:message,:units,:created_at,:created_by)')->execute([
            ':id' => $alarm['id'], ':station_id' => $stationId, ':coordinator_id' => $coordinatorId ?: null, ':coordinator_snapshot' => $coordinator ? json_encode($coordinator, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) : null, ':latitude' => $alarm['position']['latitude'] ?? null, ':longitude' => $alarm['position']['longitude'] ?? null, ':position_source' => $alarm['position']['source'] ?? 'manual', ':vessel_ids' => json_encode($vesselIds, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), ':type' => $alarm['type'], ':priority' => $alarm['priority'], ':location' => $alarm['location'], ':message' => $alarm['message'], ':units' => json_encode($alarm['units'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), ':created_at' => $alarm['createdAt'], ':created_by' => 'control',
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
        audit($db, 'alarm_dispatched', $alarm['id'], ['stationId' => $stationId, 'coordinatorId' => $coordinatorId ?: null, 'positionSource' => $alarm['position']['source'] ?? 'manual', 'vesselIds' => $vesselIds, 'subscriptions' => count($subscriptions), 'sent' => $sent, 'failed' => $failed]);
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
        $statement = $db->prepare("SELECT d.push_sent_at,d.app_received_at,d.notification_shown_at,d.response,d.response_at,d.last_error,s.crew_name,s.device_id,s.person_id,COALESCE(p.display_name,s.crew_name) AS person_name,COALESCE(r.name,'Rolle ikke angivet') AS role_name,COALESCE(sm.role_status,'unverified') AS role_status,COALESCE((SELECT group_concat(c.name,' · ') FROM person_competencies pc JOIN competencies c ON c.id=pc.competency_id WHERE pc.person_id=s.person_id),'') AS competency_names FROM deliveries d JOIN subscriptions s ON s.id=d.subscription_id LEFT JOIN people p ON p.id=s.person_id LEFT JOIN station_memberships sm ON sm.person_id=s.person_id AND sm.station_id=:station_id AND sm.active=1 LEFT JOIN roles r ON r.id=sm.role_id WHERE d.alarm_id=:alarm_id ORDER BY person_name,s.device_id");
        $statement->execute([':alarm_id' => $alarm['id'], ':station_id' => $alarm['station_id']]);
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
    $db->exec('CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);');
    $db->exec('CREATE TABLE IF NOT EXISTS competencies (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);');
    $db->exec('CREATE TABLE IF NOT EXISTS people (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name_key TEXT NOT NULL, display_name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organization_id,name_key), FOREIGN KEY(organization_id) REFERENCES organizations(id));');
    $db->exec('CREATE TABLE IF NOT EXISTS person_identities (id INTEGER PRIMARY KEY AUTOINCREMENT, person_id TEXT NOT NULL, provider TEXT NOT NULL, tenant_id TEXT NOT NULL DEFAULT \'\', external_subject TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(provider,tenant_id,external_subject), FOREIGN KEY(person_id) REFERENCES people(id));');
    $db->exec('CREATE TABLE IF NOT EXISTS station_memberships (id INTEGER PRIMARY KEY AUTOINCREMENT, person_id TEXT NOT NULL, station_id TEXT NOT NULL, role_id TEXT NOT NULL, role_status TEXT NOT NULL DEFAULT \'unverified\', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(person_id,station_id), FOREIGN KEY(person_id) REFERENCES people(id), FOREIGN KEY(station_id) REFERENCES stations(id), FOREIGN KEY(role_id) REFERENCES roles(id));');
    $db->exec('CREATE TABLE IF NOT EXISTS person_competencies (person_id TEXT NOT NULL, competency_id TEXT NOT NULL, verification_status TEXT NOT NULL DEFAULT \'self_declared\', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(person_id,competency_id), FOREIGN KEY(person_id) REFERENCES people(id), FOREIGN KEY(competency_id) REFERENCES competencies(id));');
    $db->exec('CREATE TABLE IF NOT EXISTS vessel_competency_requirements (vessel_id TEXT NOT NULL, competency_id TEXT NOT NULL, required_count INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(vessel_id,competency_id), FOREIGN KEY(vessel_id) REFERENCES vessels(id), FOREIGN KEY(competency_id) REFERENCES competencies(id));');
    $db->exec('CREATE TABLE IF NOT EXISTS coordinators (id TEXT PRIMARY KEY, station_id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, is_test INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(station_id) REFERENCES stations(id));');
    $db->exec('CREATE TABLE IF NOT EXISTS subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, endpoint TEXT NOT NULL UNIQUE, subscription_json TEXT NOT NULL, device_id TEXT NOT NULL, device_token_hash TEXT NOT NULL, crew_name TEXT NOT NULL, station TEXT NOT NULL, station_id TEXT, person_id TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_seen_at TEXT);');
    $db->exec('CREATE TABLE IF NOT EXISTS alarms (id TEXT PRIMARY KEY, station_id TEXT, coordinator_id TEXT, coordinator_snapshot_json TEXT, latitude REAL, longitude REAL, position_source TEXT NOT NULL DEFAULT \'manual\', vessel_ids_json TEXT NOT NULL DEFAULT \'[]\', type TEXT NOT NULL, priority TEXT NOT NULL, location TEXT NOT NULL, message TEXT NOT NULL, units_json TEXT NOT NULL, created_at TEXT NOT NULL, created_by TEXT NOT NULL, completed_at TEXT, completed_by TEXT);');
    $db->exec('CREATE TABLE IF NOT EXISTS deliveries (id INTEGER PRIMARY KEY AUTOINCREMENT, alarm_id TEXT NOT NULL, subscription_id INTEGER NOT NULL, delivery_token TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, push_sent_at TEXT, app_received_at TEXT, notification_shown_at TEXT, response TEXT, response_at TEXT, last_error TEXT, FOREIGN KEY(alarm_id) REFERENCES alarms(id), FOREIGN KEY(subscription_id) REFERENCES subscriptions(id));');
    $db->exec('CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, alarm_id TEXT, metadata_json TEXT NOT NULL, created_at TEXT NOT NULL);');

    $alarmColumns = array_column($db->query('PRAGMA table_info(alarms)')->fetchAll(), 'name');
    if (!in_array('completed_at', $alarmColumns, true)) $db->exec('ALTER TABLE alarms ADD COLUMN completed_at TEXT');
    if (!in_array('completed_by', $alarmColumns, true)) $db->exec('ALTER TABLE alarms ADD COLUMN completed_by TEXT');
    if (!in_array('station_id', $alarmColumns, true)) $db->exec('ALTER TABLE alarms ADD COLUMN station_id TEXT');
    if (!in_array('coordinator_id', $alarmColumns, true)) $db->exec('ALTER TABLE alarms ADD COLUMN coordinator_id TEXT');
    if (!in_array('coordinator_snapshot_json', $alarmColumns, true)) $db->exec('ALTER TABLE alarms ADD COLUMN coordinator_snapshot_json TEXT');
    if (!in_array('latitude', $alarmColumns, true)) $db->exec('ALTER TABLE alarms ADD COLUMN latitude REAL');
    if (!in_array('longitude', $alarmColumns, true)) $db->exec('ALTER TABLE alarms ADD COLUMN longitude REAL');
    if (!in_array('position_source', $alarmColumns, true)) $db->exec("ALTER TABLE alarms ADD COLUMN position_source TEXT NOT NULL DEFAULT 'manual'");
    if (!in_array('vessel_ids_json', $alarmColumns, true)) $db->exec("ALTER TABLE alarms ADD COLUMN vessel_ids_json TEXT NOT NULL DEFAULT '[]'");
    $coordinatorColumns = array_column($db->query('PRAGMA table_info(coordinators)')->fetchAll(), 'name');
    if (!in_array('is_test', $coordinatorColumns, true)) $db->exec('ALTER TABLE coordinators ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0');
    $subscriptionColumns = array_column($db->query('PRAGMA table_info(subscriptions)')->fetchAll(), 'name');
    if (!in_array('station_id', $subscriptionColumns, true)) $db->exec('ALTER TABLE subscriptions ADD COLUMN station_id TEXT');
    if (!in_array('person_id', $subscriptionColumns, true)) $db->exec('ALTER TABLE subscriptions ADD COLUMN person_id TEXT');

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
    $db->prepare('INSERT OR IGNORE INTO coordinators(id,station_id,name,phone,latitude,longitude,is_test,active,created_at,updated_at) VALUES(:id,:station_id,:name,:phone,:latitude,:longitude,1,1,:created_at,:updated_at)')->execute([
        ':id' => 'coordinator-test-koege', ':station_id' => 'station-koege', ':name' => 'Koordinator Køge', ':phone' => '+45 00 00 00 00', ':latitude' => 55.45830, ':longitude' => 12.18330, ':created_at' => '2026-11-06T09:00:00Z', ':updated_at' => '2026-11-06T09:00:00Z',
    ]);
    $vesselInsert = $db->prepare('INSERT OR IGNORE INTO vessels(id,station_id,slug,name,type,crew_required,active) VALUES(:id,:station_id,:slug,:name,:type,:crew_required,1)');
    $vesselInsert->execute([':id' => 'vessel-rs-koege', ':station_id' => 'station-koege', ':slug' => 'rs-koege', ':name' => 'RS Køge', ':type' => 'Redningsfartøj', ':crew_required' => 4]);
    $vesselInsert->execute([':id' => 'vessel-rhib-01', ':station_id' => 'station-koege', ':slug' => 'rhib-01', ':name' => 'RHIB 01', ':type' => 'RHIB', ':crew_required' => 2]);

    $roleInsert = $db->prepare('INSERT OR IGNORE INTO roles(id,code,name,active) VALUES(:id,:code,:name,1)');
    foreach ([
        ['role-crew','crew','Besætningsmedlem'],['role-rescuer','rescuer','Søredder'],['role-boatmaster','boatmaster','Bådfører'],['role-navigator','navigator','Navigatør'],['role-medic','medic','Førstehjælper'],['role-engineer','engineer','Maskinansvarlig'],['role-station-lead','station-lead','Stationsleder'],
    ] as [$id,$code,$name]) $roleInsert->execute([':id' => $id, ':code' => $code, ':name' => $name]);
    $competencyInsert = $db->prepare('INSERT OR IGNORE INTO competencies(id,code,name,active) VALUES(:id,:code,:name,1)');
    foreach ([
        ['competency-vhf-src','vhf-src','VHF/SRC'],['competency-first-aid','first-aid','Førstehjælp'],['competency-boatmaster','boatmaster','Bådfører'],['competency-navigation','navigation','Navigation'],['competency-engine','engine','Maskinansvarlig'],['competency-local-water','local-water','Lokalkendskab'],
    ] as [$id,$code,$name]) $competencyInsert->execute([':id' => $id, ':code' => $code, ':name' => $name]);

    $db->exec("UPDATE subscriptions SET station_id='station-koege' WHERE station_id IS NULL OR station_id=''");
    $db->exec("UPDATE alarms SET station_id='station-koege' WHERE station_id IS NULL OR station_id=''");
    $legacySubscriptions = $db->query("SELECT id,crew_name,station_id FROM subscriptions WHERE person_id IS NULL OR person_id='' ORDER BY id")->fetchAll();
    foreach ($legacySubscriptions as $legacySubscription) {
        $profile = ensureCrewProfile($db, (string) $legacySubscription['crew_name'], (string) $legacySubscription['station_id'], 'role-crew', [], null, false);
        $db->prepare('UPDATE subscriptions SET person_id=:person_id WHERE id=:id')->execute([':person_id' => $profile['id'], ':id' => $legacySubscription['id']]);
    }
    $db->exec('CREATE INDEX IF NOT EXISTS idx_subscriptions_token ON subscriptions(device_token_hash); CREATE INDEX IF NOT EXISTS idx_subscriptions_station ON subscriptions(station_id,active); CREATE INDEX IF NOT EXISTS idx_subscriptions_person ON subscriptions(person_id,active); CREATE INDEX IF NOT EXISTS idx_memberships_station ON station_memberships(station_id,active); CREATE INDEX IF NOT EXISTS idx_coordinators_station ON coordinators(station_id,active,name); CREATE INDEX IF NOT EXISTS idx_alarms_station_active ON alarms(station_id,completed_at,created_at); CREATE INDEX IF NOT EXISTS idx_deliveries_alarm ON deliveries(alarm_id);');
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
    $coordinator = json_decode((string) ($row['coordinator_snapshot_json'] ?? ''), true);
    $hasPosition = isset($row['latitude'], $row['longitude']) && is_numeric($row['latitude']) && is_numeric($row['longitude']);
    $payload = ['id' => $row['id'], 'stationId' => $row['station_id'] ?? 'station-koege', 'stationName' => $row['station_name'] ?? 'DSRS Køge', 'coordinator' => is_array($coordinator) ? $coordinator : null, 'position' => $hasPosition ? ['latitude' => (float) $row['latitude'], 'longitude' => (float) $row['longitude'], 'source' => $row['position_source'] ?? 'manual'] : null, 'vesselIds' => json_decode((string) ($row['vessel_ids_json'] ?? '[]'), true) ?: [], 'type' => $row['type'], 'priority' => $row['priority'], 'location' => $row['location'], 'message' => $row['message'], 'units' => json_decode($row['units_json'], true) ?: [], 'createdAt' => $row['created_at']];
    if ($deliveryToken !== null) $payload['deliveryToken'] = $deliveryToken;
    return $payload;
}

function coordinatorPayload(array $row): array
{
    return ['id' => (string) $row['id'], 'name' => (string) $row['name'], 'phone' => (string) $row['phone'], 'latitude' => (float) $row['latitude'], 'longitude' => (float) $row['longitude'], 'testData' => !empty($row['is_test'])];
}

function crewProfileOptions(PDO $db): array
{
    $roles = array_map(static fn(array $row): array => ['id' => $row['id'], 'name' => $row['name']], $db->query('SELECT id,name FROM roles WHERE active=1 ORDER BY name')->fetchAll());
    $competencies = array_map(static fn(array $row): array => ['id' => $row['id'], 'name' => $row['name']], $db->query('SELECT id,name FROM competencies WHERE active=1 ORDER BY name')->fetchAll());
    return ['roles' => $roles, 'competencies' => $competencies, 'verification' => 'self_declared'];
}

function ensureCrewProfile(PDO $db, string $crewName, string $stationId, string $roleId, array $competencyIds, ?array $renewedSubscription, bool $competenciesProvided): array
{
    $normalizedName = preg_replace('/\s+/u', ' ', trim($crewName)) ?: trim($crewName);
    $nameKey = mb_strtolower($normalizedName, 'UTF-8');
    $person = null;
    $renewedPersonId = clean((string) ($renewedSubscription['person_id'] ?? ''), 100);
    if ($renewedPersonId !== '') {
        $personStatement = $db->prepare('SELECT * FROM people WHERE id=:id AND active=1 LIMIT 1');
        $personStatement->execute([':id' => $renewedPersonId]);
        $person = $personStatement->fetch() ?: null;
    }
    if (!$person) {
        $personStatement = $db->prepare('SELECT * FROM people WHERE organization_id=:organization_id AND name_key=:name_key AND active=1 LIMIT 1');
        $personStatement->execute([':organization_id' => 'org-dsrs', ':name_key' => $nameKey]);
        $person = $personStatement->fetch() ?: null;
    }
    if (!$person) {
        $personId = 'person-' . substr(hash('sha256', 'org-dsrs|' . $nameKey), 0, 20);
        $db->prepare('INSERT INTO people(id,organization_id,name_key,display_name,active,created_at,updated_at) VALUES(:id,:organization_id,:name_key,:display_name,1,:now,:now)')->execute([
            ':id' => $personId, ':organization_id' => 'org-dsrs', ':name_key' => $nameKey, ':display_name' => $normalizedName, ':now' => now(),
        ]);
        $person = ['id' => $personId, 'display_name' => $normalizedName];
    } else {
        $db->prepare('UPDATE people SET display_name=:display_name,updated_at=:updated_at WHERE id=:id')->execute([':display_name' => $normalizedName, ':updated_at' => now(), ':id' => $person['id']]);
        $person['display_name'] = $normalizedName;
    }

    $membershipStatement = $db->prepare('SELECT * FROM station_memberships WHERE person_id=:person_id AND station_id=:station_id LIMIT 1');
    $membershipStatement->execute([':person_id' => $person['id'], ':station_id' => $stationId]);
    $membership = $membershipStatement->fetch() ?: null;
    if ($roleId === '') $roleId = (string) ($membership['role_id'] ?? 'role-crew');
    $roleStatement = $db->prepare('SELECT id FROM roles WHERE id=:id AND active=1 LIMIT 1');
    $roleStatement->execute([':id' => $roleId]);
    if (!$roleStatement->fetch()) respond(['ok' => false, 'error' => 'Den valgte rolle findes ikke.'], 422);
    $db->prepare("INSERT INTO station_memberships(person_id,station_id,role_id,role_status,active,created_at,updated_at) VALUES(:person_id,:station_id,:role_id,'self_declared',1,:now,:now) ON CONFLICT(person_id,station_id) DO UPDATE SET role_id=excluded.role_id,role_status=CASE WHEN station_memberships.role_status='verified' THEN station_memberships.role_status ELSE excluded.role_status END,active=1,updated_at=excluded.updated_at")->execute([
        ':person_id' => $person['id'], ':station_id' => $stationId, ':role_id' => $roleId, ':now' => now(),
    ]);

    if ($competenciesProvided) {
        if ($competencyIds !== []) {
            $placeholders = implode(',', array_fill(0, count($competencyIds), '?'));
            $competencyStatement = $db->prepare("SELECT id FROM competencies WHERE active=1 AND id IN ($placeholders)");
            $competencyStatement->execute($competencyIds);
            if (count($competencyStatement->fetchAll()) !== count($competencyIds)) respond(['ok' => false, 'error' => 'En eller flere valgte kompetencer findes ikke.'], 422);
        }
        $db->prepare("DELETE FROM person_competencies WHERE person_id=:person_id AND verification_status='self_declared'")->execute([':person_id' => $person['id']]);
        $competencyInsert = $db->prepare("INSERT INTO person_competencies(person_id,competency_id,verification_status,created_at,updated_at) VALUES(:person_id,:competency_id,'self_declared',:now,:now) ON CONFLICT(person_id,competency_id) DO UPDATE SET updated_at=excluded.updated_at");
        foreach ($competencyIds as $competencyId) $competencyInsert->execute([':person_id' => $person['id'], ':competency_id' => $competencyId, ':now' => now()]);
    }
    return personProfile($db, (string) $person['id'], $stationId);
}

function personProfile(PDO $db, string $personId, string $stationId): array
{
    $statement = $db->prepare("SELECT p.id,p.display_name,r.id AS role_id,r.name AS role_name,sm.role_status FROM people p JOIN station_memberships sm ON sm.person_id=p.id AND sm.station_id=:station_id AND sm.active=1 JOIN roles r ON r.id=sm.role_id WHERE p.id=:person_id AND p.active=1 LIMIT 1");
    $statement->execute([':station_id' => $stationId, ':person_id' => $personId]);
    $person = $statement->fetch();
    if (!$person) respond(['ok' => false, 'error' => 'Personprofilen kunne ikke oprettes.'], 500);
    $competencyStatement = $db->prepare('SELECT c.id,c.name,pc.verification_status FROM person_competencies pc JOIN competencies c ON c.id=pc.competency_id WHERE pc.person_id=:person_id AND c.active=1 ORDER BY c.name');
    $competencyStatement->execute([':person_id' => $personId]);
    return [
        'id' => $person['id'],
        'name' => $person['display_name'],
        'role' => ['id' => $person['role_id'], 'name' => $person['role_name'], 'verificationStatus' => $person['role_status']],
        'competencies' => array_map(static fn(array $row): array => ['id' => $row['id'], 'name' => $row['name'], 'verificationStatus' => $row['verification_status']], $competencyStatement->fetchAll()),
    ];
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
