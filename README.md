# Alarmberedskab MVP

En buildless statisk prototype med tre visninger:

- Kontrolcentral til at oprette og udsende alarmer med leveringskvitteringer.
- Installerbar mandskabs-PWA med lokal browsernotifikation og valget Accepteret / Ej accepteret.
- Projektmapping fra prototype til robust, integreret alarmplatform.

## Demoens tekniske afgrænsning

Alarmdeling mellem faner bruger `localStorage` og `BroadcastChannel`. Det er en interaktionsprototype, ikke en produktionsklar alarmeringskanal. Fjern-push på tværs af enheder kræver backend, bruger-/enhedsregistrering og APNs/FCM eller en valgt pushleverandør.

Planlagt produktionsdomæne: `alarm.hansenlabs.dk`.

## Lokal kørsel

Servér `dist/` over HTTP, fx med `npx serve dist`. Service worker og browsernotifikationer kræver en sikker kontekst (`https` eller `localhost`).
