# DSRS Operativ MVP

En buildless pilot til Dansk Søredningsselskab med kontrolcentral, installerbar besætnings-PWA og PHP/SQLite-backend:

- SAR-kontrolcentral til at oprette og udsende maritime alarmer med leveringskvitteringer.
- Stationsopdelt koordinatorvalg og alternativt positionsvalg direkte i et klikbart kort.
- Installerbar besætnings-PWA med Web Push, systemlyd/vibration, SAR-tone, position, situationsmelding og valget Accepteret / Ej accepteret.
- Aktiv alarm kan afsluttes fra kontrolcentralen; den fjernes derefter automatisk i registrerede apps.
- Fartøjsspecifik minimums- og maksimumsbemanding med hierarkiske pladser, manuel besætningsgodkendelse og valgfri automatisk start ved sikker minimumsbesætning.
- Valgfrit AI-testhold med tydeligt mærkede fiktive roller, kompetencer, svartider og både accepterede og afviste testsvar.
- Tydeligt tretrinsforløb fra alarm til sikker besætning og startet assistance samt særskilt udtagningsbesked til accepterede personer.
- Besætningsappen viser installeret version/build, kontrollerer serverens seneste version og kan hente en opdatering uden at slette parring eller push-token.
- Projektmapping fra prototype til robust, integreret alarmplatform.

Det færdige produkt har et bindende skaleringskrav på mindst 14 aktive stationer, flere fartøjer pr. station, samtidige hændelser og tværgående nabostationsindsats. MVP'en har nu et multi-stationsfundament, men kun Køge har konfigurerede pilotfartøjer og aktiv afprøvning.

## Pilotens tekniske afgrænsning

Fjern-push, enhedsregistrering og kvitteringer kører via pilotbackenden på Simply. `localStorage` og `BroadcastChannel` bevares som lokal demo/fallback. Løsningen er fortsat en pilot og må ikke stå alene som operativ alarmeringskanal, før redundans, overvågning, adgangsstyring og SMS/telefon-fallback er etableret.

Pilotdomæne: `https://alarm.hansenlabs.dk`.

Se [mobil-, web- og pushkompatibilitet](docs/MOBILE-AND-PUSH-COMPATIBILITY.md) og den samlede [produktbenchmark, maritime funktionskortlægning og roadmap](docs/PRODUCT-BENCHMARK-AND-ROADMAP.md).

Fase 1 er påbegyndt med det [bagudkompatible multi-station- og fartøjsfundament](docs/PHASE-1-MULTI-STATION-FOUNDATION.md), [person-, medlemskabs- og kompetencegrundlaget](docs/PHASE-1B-CREW-IDENTITY.md), [stationskoordinatorer og alarmsikkerhed](docs/PHASE-1C-COORDINATORS-AND-ALARM-SAFETY.md), [fartøjsspecifik besætningsudvælgelse](docs/PHASE-1D-VESSEL-CREW-ASSIGNMENT.md), [simuleret AI-testbesætning](docs/PHASE-1E-AI-TEST-CREW.md) og [assistancetrin med udtagningsbeskeder](docs/PHASE-1F-ASSISTANCE-STAGES-AND-CREW-NOTICES.md).

## Ejerskab og versionering

Projektet er gjort klar til et privat DSRS-ejet Git-repository med CI-validering og eksplicit udelukkelse af PEM-filer og andre hemmeligheder. Se [docs/OWNERSHIP-AND-HANDOVER.md](docs/OWNERSHIP-AND-HANDOVER.md).

## Lokal kørsel

Servér `dist/` over HTTP, fx med `npx serve dist`. Service worker og browsernotifikationer kræver en sikker kontekst (`https` eller `localhost`).
