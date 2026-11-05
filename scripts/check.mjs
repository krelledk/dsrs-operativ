import { access, readFile } from 'node:fs/promises';

const required = [
  '.openai/hosting.json',
  'dist/index.html',
  'dist/styles.css',
  'dist/app.js',
  'dist/service-worker.js',
  'dist/manifest.webmanifest',
  'dist/api/index.php',
  'server/setup.php',
  'server/composer.json',
  'server/composer.lock',
  'docs/MOBILE-AND-PUSH-COMPATIBILITY.md',
  'docs/PRODUCT-BENCHMARK-AND-ROADMAP.md',
  'docs/PHASE-1-MULTI-STATION-FOUNDATION.md',
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

if (hosting.static?.directory !== 'dist') throw new Error('Hosting skal pege på dist/.');
if (!manifest.name?.includes('DSRS')) throw new Error('PWA-navnet mangler DSRS.');
if (manifest.display !== 'standalone') throw new Error('PWA skal åbne i standalone-tilstand.');
if (!manifest.scope || !manifest.start_url) throw new Error('PWA scope/start_url mangler.');
for (const size of ['192x192', '512x512']) {
  if (!manifest.icons?.some((icon) => icon.sizes === size && icon.type === 'image/png')) throw new Error(`PWA-ikon mangler: ${size}`);
}
if (!manifest.icons?.some((icon) => icon.purpose === 'maskable')) throw new Error('Maskable PWA-ikon mangler.');
for (const marker of ['DSRS', 'SAR kontrolcentral', 'Accepteret', 'Ej accepteret', 'Test lyd', 'Afslut alarm', 'FireServiceRota', 'Maritim mission', 'Minimum sikkert crew', '14+ stationer', 'Samtidige hændelser']) {
  if (!html.includes(marker)) throw new Error(`Påkrævet UI-markør mangler: ${marker}`);
}
for (const marker of ['startAlarmSound', 'primeAlarmSound', 'createAlarmWav', 'completeRemoteAlarm', 'loadCurrentAlarm(true)']) {
  if (!app.includes(marker)) throw new Error(`Alarmlyd/fallback mangler: ${marker}`);
}
const api = await readFile('dist/api/index.php', 'utf8');
for (const marker of ["$action === 'complete'", 'completed_at IS NULL', 'alarm_completed', "completed_by='superseded'", 'station_id', 'publicStations', 'vessel_ids_json', 'station-faxe-ladeplads']) {
  if (!api.includes(marker)) throw new Error(`Alarm-afslutning mangler: ${marker}`);
}
for (const marker of ['silent:false', 'vibrate:', 'setAppBadge']) {
  if (!serviceWorker.includes(marker)) throw new Error(`Push-alarmering mangler: ${marker}`);
}

console.log('DSRS Operativ: statiske checks bestået.');
