import { access, readFile } from 'node:fs/promises';

const required = [
  '.openai/hosting.json',
  'dist/index.html',
  'dist/styles.css',
  'dist/crew.css',
  'dist/app.js',
  'dist/service-worker.js',
  'dist/version.json',
  'dist/vendor/leaflet/leaflet.css',
  'dist/vendor/leaflet/leaflet.js',
  'dist/vendor/leaflet/LICENSE',
  'dist/manifest.webmanifest',
  'dist/api/index.php',
  'server/setup.php',
  'server/composer.json',
  'server/composer.lock',
  'docs/MOBILE-AND-PUSH-COMPATIBILITY.md',
  'docs/PRODUCT-BENCHMARK-AND-ROADMAP.md',
  'docs/PHASE-1-MULTI-STATION-FOUNDATION.md',
  'docs/PHASE-1B-CREW-IDENTITY.md',
  'docs/PHASE-1C-COORDINATORS-AND-ALARM-SAFETY.md',
  'docs/PHASE-1D-VESSEL-CREW-ASSIGNMENT.md',
  'dist/icon.svg',
  'dist/icon-192.png',
  'dist/icon-512.png',
  'dist/icon-maskable-512.png',
  'dist/apple-touch-icon.png'
];

await Promise.all(required.map((file) => access(file)));
const hosting = JSON.parse(await readFile('.openai/hosting.json', 'utf8'));
const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
const html = await readFile('dist/index.html', 'utf8');
const app = await readFile('dist/app.js', 'utf8');
const serviceWorker = await readFile('dist/service-worker.js', 'utf8');

if (html.includes('id="mobile-clock"') || html.includes('class="phone-status"')) throw new Error('Den kunstige mobilstatuslinje må ikke vises.');

if (hosting.static?.directory !== 'dist') throw new Error('Hosting skal pege på dist/.');
if (!manifest.name?.includes('DSRS')) throw new Error('PWA-navnet mangler DSRS.');
if (manifest.display !== 'standalone') throw new Error('PWA skal åbne i standalone-tilstand.');
if (!manifest.scope || !manifest.start_url) throw new Error('PWA scope/start_url mangler.');
for (const size of ['192x192', '512x512']) {
  if (!manifest.icons?.some((icon) => icon.sizes === size && icon.type === 'image/png')) throw new Error(`PWA-ikon mangler: ${size}`);
}
if (!manifest.icons?.some((icon) => icon.purpose === 'maskable')) throw new Error('Maskable PWA-ikon mangler.');
for (const marker of ['DSRS', 'SAR kontrolcentral', 'Accepteret', 'Ej accepteret', 'Test lyd', 'Afslut alarm', 'Par denne mobil', 'APPVERSION', 'Søg efter opdatering', 'Vælg alarmposition på kort', 'Ingen position valgt', 'Koordinator', 'Tilføj / redigér', 'Primær rolle', 'Kompetencer', 'Start assistance ved sikker minimumsbesætning', 'Vælg sikker besætning', 'Foreslå minimum', 'FireServiceRota', 'Maritim mission', 'Minimum sikkert crew', '14+ stationer', 'Samtidige hændelser']) {
  if (!html.includes(marker)) throw new Error(`Påkrævet UI-markør mangler: ${marker}`);
}
for (const marker of ['APP_VERSION', 'APP_BUILD', 'checkAppVersion', 'updateAppToLatest', 'dsrs.appUpdated.v1', 'initialiseAlarmMap', 'setAlarmPosition', 'selectedAlarmPosition', 'tile.openstreetmap.org', 'startAlarmSound', 'alarmSoundPersistent', 'renderDeliveryWarning', 'loadCoordinators', 'coordinator-save', 'primeAlarmSound', 'createAlarmWav', 'completeRemoteAlarm', 'buildCrewPlan', 'startAssistance', 'autoStartAssistance', 'loadCurrentAlarm(true)', 'renewDeviceRegistration', 'freshPushSubscription(true)', 'updateMobilePairing', 'populateCrewProfile', 'storePersonProfile', 'isResponderApp()){write(STORAGE.current,null)', 'isResponderApp()&&width>480']) {
  if (!app.includes(marker)) throw new Error(`Alarmlyd/fallback mangler: ${marker}`);
}
const api = await readFile('dist/api/index.php', 'utf8');
for (const marker of ["$action === 'complete'", "$action === 'crew-start'", "$action === 'coordinators'", "$action === 'coordinator-save'", 'coordinator-test-koege', 'is_test', 'position_source', 'coordinator_snapshot_json', 'auto_start_assistance', 'assistance_started_at', 'selected_crew_json', 'vessel_crew_requirements', 'crew_level', 'tryAutoStartAssistance', 'completed_at IS NULL', 'alarm_completed', "completed_by='superseded'", 'station_id', 'publicStations', 'vessel_ids_json', 'station-faxe-ladeplads', 'device_subscription_renewed', 'active_alarm_recovered_by_app', 'person_identities', 'station_memberships', 'person_competencies', 'vessel_competency_requirements', 'ensureCrewProfile', 'crewProfileOptions']) {
  if (!api.includes(marker)) throw new Error(`Alarm-afslutning mangler: ${marker}`);
}
for (const marker of ['silent:false', 'vibrate:', 'setAppBadge']) {
  if (!serviceWorker.includes(marker)) throw new Error(`Push-alarmering mangler: ${marker}`);
}

console.log('DSRS Operativ: statiske checks bestået.');
