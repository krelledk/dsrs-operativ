# DSRS Operativ MVP

En buildless pilot til Dansk Søredningsselskab med kontrolcentral, installerbar besætnings-PWA og PHP/SQLite-backend:

- SAR-kontrolcentral til at oprette og udsende maritime alarmer med leveringskvitteringer.
- Installerbar besætnings-PWA med Web Push, systemlyd/vibration, SAR-tone, position, situationsmelding og valget Accepteret / Ej accepteret.
- Aktiv alarm kan afsluttes fra kontrolcentralen; den fjernes derefter automatisk i registrerede apps.
- Projektmapping fra prototype til robust, integreret alarmplatform.

Det færdige produkt har et bindende skaleringskrav på mindst 14 aktive stationer, flere fartøjer pr. station, samtidige hændelser og tværgående nabostationsindsats. Den nuværende MVP er fortsat en enkeltstationspilot; produktionsdatamodellen skal fjerne alle antagelser om én station, ét fartøj eller én global aktiv alarm.

## Pilotens tekniske afgrænsning

Fjern-push, enhedsregistrering og kvitteringer kører via pilotbackenden på Simply. `localStorage` og `BroadcastChannel` bevares som lokal demo/fallback. Løsningen er fortsat en pilot og må ikke stå alene som operativ alarmeringskanal, før redundans, overvågning, adgangsstyring og SMS/telefon-fallback er etableret.

Pilotdomæne: `https://alarm.hansenlabs.dk`.

Se [mobil-, web- og pushkompatibilitet](docs/MOBILE-AND-PUSH-COMPATIBILITY.md) og den samlede [produktbenchmark, maritime funktionskortlægning og roadmap](docs/PRODUCT-BENCHMARK-AND-ROADMAP.md).

Fase 1 er påbegyndt med det [bagudkompatible multi-station- og fartøjsfundament](docs/PHASE-1-MULTI-STATION-FOUNDATION.md).

## Ejerskab og versionering

Projektet er gjort klar til et privat DSRS-ejet Git-repository med CI-validering og eksplicit udelukkelse af PEM-filer og andre hemmeligheder. Se [docs/OWNERSHIP-AND-HANDOVER.md](docs/OWNERSHIP-AND-HANDOVER.md).

## Lokal kørsel

Servér `dist/` over HTTP, fx med `npx serve dist`. Service worker og browsernotifikationer kræver en sikker kontekst (`https` eller `localhost`).
