# DSRS Operativ MVP

En buildless statisk prototype til Dansk Søredningsselskab med tre visninger:

- SAR-kontrolcentral til at oprette og udsende maritime alarmer med leveringskvitteringer.
- Installerbar besætnings-PWA med position, situationsmelding, lokal browsernotifikation og valget Accepteret / Ej accepteret.
- Projektmapping fra prototype til robust, integreret alarmplatform.

## Demoens tekniske afgrænsning

Alarmdeling mellem faner bruger `localStorage` og `BroadcastChannel`. Det er en interaktionsprototype, ikke en produktionsklar alarmeringskanal. Fjern-push på tværs af enheder kræver backend, bruger-/enhedsregistrering og APNs/FCM eller en valgt pushleverandør.

Planlagt produktionsdomæne: `alarm.hansenlabs.dk`.

## Ejerskab og versionering

Projektet er gjort klar til et privat DSRS-ejet Git-repository med CI-validering og eksplicit udelukkelse af PEM-filer og andre hemmeligheder. Se [docs/OWNERSHIP-AND-HANDOVER.md](docs/OWNERSHIP-AND-HANDOVER.md).

## Lokal kørsel

Servér `dist/` over HTTP, fx med `npx serve dist`. Service worker og browsernotifikationer kræver en sikker kontekst (`https` eller `localhost`).
