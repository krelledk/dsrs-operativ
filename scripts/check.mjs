import { access, readFile } from 'node:fs/promises';

const required = [
  '.openai/hosting.json',
  'dist/index.html',
  'dist/styles.css',
  'dist/app.js',
  'dist/service-worker.js',
  'dist/manifest.webmanifest',
  'dist/icon.svg'
];

await Promise.all(required.map((file) => access(file)));
const hosting = JSON.parse(await readFile('.openai/hosting.json', 'utf8'));
const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
const html = await readFile('dist/index.html', 'utf8');

if (hosting.static?.directory !== 'dist') throw new Error('Hosting skal pege på dist/.');
if (!manifest.name?.includes('DSRS')) throw new Error('PWA-navnet mangler DSRS.');
for (const marker of ['DSRS', 'SAR kontrolcentral', 'Accepteret', 'Ej accepteret']) {
  if (!html.includes(marker)) throw new Error(`Påkrævet UI-markør mangler: ${marker}`);
}

console.log('DSRS Operativ: statiske checks bestået.');
