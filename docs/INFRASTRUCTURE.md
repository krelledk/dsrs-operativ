# Infrastruktur og miljøer

## Nuværende pilot

- Frontend/PWA: `https://alarm.hansenlabs.dk` på Simply.
- Backend: PHP 8.5, SQLite og standardsbaseret Web Push.
- Backendafhængigheder og runtime-data ligger uden for subdomænets webroot.
- TLS er aktivt på pilotdomænet.
- Et privat Sites-deployment kan fortsat bruges som designfallback.

## Hansen Labs-server

Der findes SSH-adgang via en privat PEM-nøgle. Pilotfrontend og backend blev deployet 4. november 2026.

### Bekræftet inventar

- SSH-host: `ssh.simply.com`.
- SSH-bruger: `hansenlabs.dk`.
- Hjemmemappe: `/var/www/hansenlabs.dk`.
- Platform: Linux/CloudLinux-baseret Simply-miljø.
- Node.js: 24.22.2.
- PHP CLI: 8.5.12.
- Disk ved inventering: 78 % anvendt, cirka 180 GB ledigt på det delte mount.
- Eksisterende mapper omfatter `public_html`, `hansenlabs-staging-app` og `Dev-dsrs`.
- `Dev-dsrs` ligner en eksisterende Drupal-kodebase og er ikke ændret.

Før operativ produktion skal følgende stadig fastlægges:

- Serverens ejer og ansvarlige driftskontakt.
- Operativsystem, patchniveau og backupstatus.
- Hvilke komponenter serveren skal hoste: frontend, API, database, kø eller reverse proxy.
- Firewall, TLS, logning, monitorering og rollback-procedure.

PEM-filen må ikke lægges i repositoryet, kopieres til en server uden behov eller deles via chat/e-mail. Ved overdragelse bør den erstattes af en DSRS-ejet deployidentitet med roterbar nøgle og mindst mulige rettigheder.

Piloten er deployet til subdomænets mappe `/var/www/hansenlabs.dk/alarm`. Eksisterende `public_html` og `Dev-dsrs` er ikke ændret.

## Foreslåede miljøer

| Miljø | Formål | Adgang |
|---|---|---|
| Lokal | Udvikling og UI-test | Udvikler |
| Test | Integration, push-sandbox og pilotdata | Projektteam |
| Produktion | Operativ DSRS-platform | Begrænset DSRS-drift |

Test og produktion skal have separate databaser, push-credentials, domæner, nøgler og logdestinationer.
