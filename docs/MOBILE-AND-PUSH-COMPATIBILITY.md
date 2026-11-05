# Mobil-, web- og pushkompatibilitet

Senest kontrolleret: 5. november 2026.

## Understøttede mål

| Platform | Installation | Baggrundspush | Alarmlyd |
|---|---|---|---|
| Android med Chrome, Edge eller Samsung Internet | Installer PWA fra browseren | Web Push via service worker | Systemets notifikationslyd og vibration; SAR-tone når appen er åben |
| iPhone/iPad med iOS/iPadOS 16.4 eller nyere | Skal føjes til hjemmeskærmen og åbnes derfra | Web Push til hjemmeskærmsappen | Systemets notifikationsadfærd; SAR-tone når appen er åben og lyd er klargjort |
| Windows/macOS med en moderne browser | Kan bruges som web eller installeret PWA | Web Push, når browser/OS tillader notifikationer | Systemets notifikationslyd; SAR-tone i en åben fane/app |
| Browser uden Push API | Webvisning | Ingen sikker baggrundspush | Åben app poller backend hvert 15. sekund og afspiller SAR-tone ved ny alarm |

## Implementerede sikkerhedsnet

- Feature detection for Notification, Service Worker og Push Manager.
- Dynamisk viewport, safe-area-understøttelse og korrektion af Androids desktop-viewport.
- Network-first navigation og versionsstyret app-shell-cache.
- Krypteret standardsbaseret Web Push med leveringskvitteringer.
- Systemlyd anmodes med `silent: false`; kompatible Android-enheder får vibrationsmønster.
- Gentaget SAR-tone i forgrunden via en genereret WAV/HTML-audiofil med Web Audio som fallback.
- Lydtest i appen klargør browserens lydkontekst efter en brugerhandling.
- Fallback-polling hvert 15. sekund, når appen er åben.
- Alarmlyd og vibration stoppes ved Accepteret/Ej accepteret.
- Kontrolcentralen kan afslutte den aktive alarm; åbne apps rydder den straks eller ved næste 15-sekunders synkronisering, og lukkede apps rydder den ved næste åbning.

## Platformbegrænsninger

En PWA kan ikke tilsidesætte telefonens lydløs-, Fokus- eller Forstyr ikke-indstillinger. Web Push giver heller ikke en standardiseret mulighed for en egen lydfil i baggrunden. Derfor kombineres operativsystemets notifikationslyd med appens egen SAR-tone, når appen er åben.

iPhone/iPad kræver iOS/iPadOS 16.4 eller nyere og en installeret hjemmeskærmsapp for Web Push. Brugeren skal selv give notifikationstilladelse fra en direkte handling i appen.

## Minimumstest før pilotdrift

1. Android Chrome med appen lukket, i baggrunden og åben.
2. Samsung Internet med appen lukket og åben.
3. iPhone med aktuel iOS, appen installeret og Fokus slået henholdsvis fra og til.
4. Desktop Chrome/Edge og Safari/Firefox, hvor de er relevante.
5. Test af Accepteret/Ej accepteret og alle fire kvitteringstrin.
6. Kontrol af lydløs/Fokus-scenarier og dokumenteret SMS/telefon-fallback.

## Referencer

- WebKit: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- MDN `showNotification`: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification
