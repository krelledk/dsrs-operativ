# DSRS Operativ — produktbenchmark, maritim funktionskortlægning og roadmap

**Version:** 1.0  
**Dato:** 5. november 2026  
**Status:** Strategisk arbejdsgrundlag; tidsestimater skal valideres efter pilotstation, integrationer og driftskrav er afklaret.

**Skaleringskrav:** Platformen skal fra datamodellens første produktionsversion understøtte mindst 14 aktive redningsstationer, flere fartøjer pr. station og tværgående indsættelser. Tallet 14 er et minimum og må ikke implementeres som en teknisk øvre grænse.

## 1. Konklusion

DSRS bør ikke bygge en dansk kopi af et brandvæsenssystem. Produktet bør kombinere de bedste mønstre fra FireServiceRota og Alarm Dispatcher med et maritimt operationslag, der er bygget omkring fartøjer, farvand, kvalificeret minimumsbesætning, vejr, tidevand, position og samarbejde med JRCC.

Produktet bør organiseres omkring fire sammenhængende operative kredsløb:

1. **Beredskab:** Hvem kan møde, med hvilke kompetencer, til hvilket fartøj og hvornår?
2. **Mobilisering:** Er alarmen leveret, set og besvaret, og er der en sikker minimumsbesætning?
3. **SAR/assistance:** Hvor er hændelsen, redderne og fartøjerne, hvad er planen, og hvad ændrer sig undervejs?
4. **Afslutning og læring:** Hvem afslutter, hvad blev gjort, og hvordan dokumenteres indsatsen, materiellet og læringen?

Det vigtigste produktvalg er at gøre **pålidelig alarmering og bemandingsbeslutning** fejlsikker før der bygges bred HR-, løn- eller administrationsfunktionalitet. En operatør skal på få sekunder kunne se, om alarmkæden virker, om en kvalificeret besætning er på vej, og hvilken eskalation der er nødvendig.

### 1.1 Ikke-forhandlingsbart skaleringsprincip

- **Én fælles DSRS-platform:** Stationerne er organisatoriske enheder i samme system, ikke 14 separate installationer.
- **Ingen hardkodning:** Station, fartøj, alarmgruppe, rolle, mødested og operationsområde er konfigurerbare data med stabile ID'er.
- **Flere fartøjer pr. station:** Hvert fartøj har egen type, kaldesignal, hjemme-/aktuel station, status, minimumsbesætning, kompetencekrav og materielprofil.
- **Mange-til-mange:** En person kan være tilknyttet flere stationer og roller; et fartøj kan midlertidigt flyttes eller udlånes; en hændelse kan involvere flere stationer og fartøjer.
- **Lokal og central adgang:** Stationer ser som udgangspunkt egne data, mens autoriserede centrale roller kan se og koordinere på tværs.
- **Politikarv:** DSRS kan definere fælles regler, som en station kun kan afvige fra, hvor det udtrykkeligt er tilladt og auditeret.
- **Tværgående eskalation:** En alarm kan eskalere til nabostationer ud fra operationsområde, fartøjstype, kompetencemangel, afstand og forventet afgang.
- **Samtidige hændelser:** Systemet skal håndtere flere aktive alarmer på forskellige stationer uden at overskrive eller sammenblande data.

Den nuværende MVP er bevidst en enkeltstationspilot. Den må ikke betragtes som klar til netværksdrift, før ovenstående er implementeret og belastningstestet.

## 2. Researchmetode og afgrænsning

Kortlægningen bygger på offentligt tilgængelige primærkilder: leverandørernes produktsider, hjælpecentre, manualer og tekniske beskrivelser samt DSRS-, JRCC- og IMO-materiale. FireServiceRotas officielle YouTube-kanal er gennemgået som indgang, men de verificerbare funktionsdetaljer nedenfor kommer primært fra FireServiceRotas officielle produkt- og hjælpesider.

Dette er en bred markeds- og produktkortlægning, ikke en juridisk certificering, en indkøbsanalyse eller en garanti for, at alle funktioner findes i alle abonnementer og lande.

## 3. Hovedbenchmark

### 3.1 FireServiceRota

FireServiceRota samler vagtplan, tilgængelighed, kompetencer, varsling og ledelsesoverblik i én platform. Dets stærkeste differentiering er, at bemanding ikke blot vises her og nu, men også kan forudsiges.

**Stærke funktioner**

- Realtids- og prognosevisning af stationers og køretøjers operative tilgængelighed.
- Selvbetjent tilgængelighed i 15-minutters intervaller og geofence-advarsel, hvis en redder er for langt fra stationen.
- Vagtplaner til frivillige, on-call, fastansatte og blandede tjenesteformer.
- Kvalifikationer og funktioner koblet til køretøjssæder og minimumsbemanding.
- Smart alarmeringspolitik, deadline for svar og automatisk eskalation ved utilstrækkelig bemanding.
- Fair besætningsforslag baseret på vagtstatus, historisk deltagelse og de kompetencer, der kræves.
- Live hændelsesvisning med svar, reaktionstid, kompetencebadges og komplet auditlog.
- Leveringsdiagnostik pr. kanal og enhed, herunder batteri, netværk, signalstyrke, appversion og enhedsmodel.
- Station display, som skifter til hændelsestilstand, samt lokalt udstyr til lyd, tale, lys, porte og printer.
- Rapporter, BI, REST API, integration til CAD/control room, HR, løn og incident management.
- Informationssikkerhed med blandt andet ISO 27001:2022, penetrationstest, backup og redundant drift.

**Mønstre DSRS bør tage med**

- Fartøjsberedskab skal beregnes ud fra kvalificeret minimumsbesætning, ikke blot antal accepterede.
- Operatøren skal kunne se både status nu og forventet status senere på dagen.
- Leveringskæden skal være synlig helt ned på den enkelte telefon.
- Eskalation skal være regelstyret og kunne ske automatisk, men altid være forståelig for operatøren.
- Fordeling af udkald bør på sigt være retfærdig og kompetencebaseret.

Kilder: [FireServiceRota – funktioner](https://www.fireservicerota.com/features), [on-call planlægning](https://www.fireservicerota.com/on-call), [scheduling](https://www.fireservicerota.com/scheduling), [rapportering](https://www.fireservicerota.com/reporting), [API](https://www.fireservicerota.com/api), [stationsudstyr](https://www.fireservicerota.com/station-end-equipment), [informationssikkerhed](https://www.fireservicerota.com/information-security), [alarmeringsforløb](https://help.fireservicerota.com/nl/article/hoe-werkt-een-alarmering), [hændelsesdetaljer](https://help.fireservicerota.com/nl/article/incident-detailoverzicht), [fair crew suggestion](https://help.fireservicerota.com/nl/article/hoe-werkt-het-nieuwe-eerlijk-inzetvoorstel).

### 3.2 Alarm Dispatcher

Alarm Dispatcher er stærk på hurtig alarmering, simple kvitteringer, mange indgående og udgående kanaler, organisationsadministration og stationshardware.

**Stærke funktioner**

- Push-alarm med **Ja**, **Senere** og **Nej**; svar kan ændres inden deadline.
- Konfigurerbare “senere”-tider og prioritering af svar.
- Funktions- og kvalifikationsgrupper, så ledelsen ser brugbar bemanding frem for et råt persontal.
- Alarmindtag via e-mail, SMS, telefon, web push, API, kontrolcentral, sensorer og manuel oprettelse.
- Push, SMS og opkald som udgående kanaler samt fallback til enheder uden pålidelig push.
- Brugerdefineret lyd, vibration og mulighed for at tilsidesætte lydløs/Forstyr ikke, hvor mobilplatformen tillader det.
- Ferietilstand med automatisk afvisning og slutdato.
- Kalender, øvelser, møder, RSVP og automatisk forespørgsel om tilgængelighed.
- Medlemsadministration, rettigheder, alarmgrupper, funktionsgrupper og overordnede organisationer.
- Stationsmonitor, printer, tekst-til-tale og styring af lys, porte og andet bygningsudstyr.
- Live webadministration med alarmhistorik, svar, filtre og rollebaseret adgang.
- Alarm Connect kan samle opdateringer på samme hændelsesnummer i stedet for at skabe dubletter.

**Mønstre DSRS bør tage med**

- Behold de meget tydelige kvitteringsvalg, men oversæt “Senere” til et konkret estimat: **På stationen om 8 min.**
- Giv besætningen mulighed for at ændre svar og rutevalg, indtil alarmen låses eller afsluttes.
- Gør lyd- og fallbackpolitikken synlig og testbar pr. enhed.
- Gør kalender, ferie og vagtstatus enkel nok til frivillige.
- Stationens fysiske alarmering bør være en kanal i samme hændelseslog som mobilen.

Kilder: [Alarm Dispatcher App](https://alarm-dispatcher.de/en/app/), [hardware](https://alarm-dispatcher.de/en/hardware/), [alarmer og svar](https://support.alarm-dispatcher.de/help/de-de/1-alarm-dispatcher-app/14-alarme-und-ruckmeldungen), [alarmindstillinger](https://support.alarm-dispatcher.de/help/de-de/29-menu-app/117-alarmeinstellungen-konfigurieren), [lyd og enhedsindstillinger](https://support.alarm-dispatcher.de/help/de-de/1-alarm-dispatcher-app/19-einstellungen), [ferietilstand](https://support.alarm-dispatcher.de/help/de-de/1-alarm-dispatcher-app/56-urlaubsmodus), [medlemsstyring](https://support.alarm-dispatcher.de/help/de-de/1-alarm-dispatcher-app/16-verwalten-von-mitgliedern), [kalender](https://support.alarm-dispatcher.de/help/de-de/1-alarm-dispatcher-app/27-termine-verwalten-und-synchronisieren), [push-begrænsninger og fallback](https://support.alarm-dispatcher.de/help/de-de/1-alarm-dispatcher-app/50-gerat-unterstutzt-keine-push-nachrichten).

## 4. Andre relevante produkter

| Produkt | Det er særligt godt til | Relevant læring for DSRS |
|---|---|---|
| **GroupAlarm** | Fleksible alarmkilder, eskalationsflows, roller, cockpit, kort og hændelseslog | Et visuelt “operationscockpit” og genbrugelige playbooks til forskellige alarmtyper |
| **IamResponding** | Mobil dispatch, tilgængelighed, vagtplaner, køretøjsstatus, kort og intern besked | Én enkel frivillig-app til alarm, vagt, køretøj og intern kommunikation |
| **Active911** | Dispatch, kritiske varsler, preplans, markeringslag, live position og radioaudio | Kortlag, præcis hændelsesposition og adskillelse mellem alarm, team og kommunikation |
| **DIVERA 24/7** | Tilgængelighed, geofence, tærskler, planlægning, chat, formularer og ETA | Kombinationen af beredskabstærskel, estimeret fremmøde og efterfølgende rapport |
| **eDispatches** | CAD/audio, push/SMS/opkald, availability og live responder-bevægelse | Automatisk fallback og positionsdeling, der stopper automatisk efter hændelsen |
| **D4H** | Bred emergency management: kvalifikationer, udstyr, vedligehold, øvelser, logs og rapporter | Senere driftslag til kompetencer, øvelser, kontrol af materiel og debrief |

Kilder: [GroupAlarm Apps](https://www.groupalarm.com/en/apps/), [GroupAlarm alarmflows](https://docs.groupalarm.com/en/article/alarms-1qbxdvq/), [GroupAlarm Cockpit](https://docs.groupalarm.com/en/article/groupalarm-cockpit-b390h3/), [IamResponding mobiloversigt](https://support.iamresponding.com/hc/en-us/articles/31710735543188-Mobile-App-Menu-Overview), [IamResponding scheduling](https://support.iamresponding.com/hc/en-us/articles/31457951468820-Scheduling), [Active911](https://active911.com/), [Active911 personnel and units](https://active911.atlassian.net/wiki/spaces/AED/pages/3553427458/Personnel+and+Unit+Sheets), [DIVERA 24/7 funktionsoversigt](https://www.divera247.com/downloads/DIVERA247_funktionen_und_vorteile_alarmierungs_verfuegbarkeitssystem.pdf), [eDispatches](https://www.edispatches.com/), [eDispatches availability](https://support.edispatches.com/hc/en-us/articles/27910552773652-Availability), [D4H personnel/training](https://help.d4h.com/article/307-d4h-personnel-training-guide), [D4H equipment](https://help.d4h.com/article/260-equipment-dashboard-overview).

## 5. Maritime input og DSRS-kontekst

DSRS har et distribueret stationsnet med forskellige operationsområder. Frivillige skal kunne nå stationen omtrent 15–20 minutter efter alarm, og kvalifikationer som VHF/SRC, duelighed, førstehjælp, bådfører og lokale uddannelsesforløb er relevante for bemandingen. DSRS’ offentlige assistanceflow indsamler præcis position, hændelsestype, antal ombordværende og personskade.

JRCC leder den danske SAR-tjeneste og koordinerer alle indsatte ressourcer i SAR-operationer. SAR Cooperation Plan beskriver blandt andet fartøjsnavn/kaldesignal, position, vejr, antal involverede og tilskadekomne, situation, ønsket assistance og allerede iværksatte tiltag som centrale oplysninger. Det betyder, at DSRS-platformens datamodel og hændelseslog bør kunne udveksle denne struktur uden at påstå at erstatte JRCC’s operative ledelse.

Kilder: [DSRS stationer og operationsområder](https://www.dsrs.dk/stationer), [DSRS frivillige og fremmødetid](https://www.dsrs.dk/bliv-frivillig), [DSRS hjælp på vandet](https://dsrs.dk/hjaelp), [JRCC Danmark](https://www.forsvaret.dk/da/organisation/soevaernet/nationalt-maritimt-operationscenter/joint-rescue-coordination-center/), [SAR Cooperation Plan 2026](https://www.forsvaret.dk/globalassets/fko---sovarnet/svk/dokumenter/jrcc/-sar-cooperation-plan-2026-final-.pdf), [Søfartsstyrelsen om VHF](https://www.soefartsstyrelsen.dk/fritidssejlads/fritidsfartoejer/radio-i-fritidsfartoejer).

Maritime inspirationsprodukter som SafeTrx og ClearBase fremhæver rejseplan/ETA, nødposition, maritime kortlag, vejr, tidevand, kystnære risici, live tracking og SAR-tasking. Disse elementer hører til i de senere maritime mission-faser, ikke i første alarmerings-MVP. Kilder: [SafeTrx Active](https://safetrxactive.com/safetrx-active), [NSRI SafeTrx](https://www.nsri.org.za/water-safety/safetrx/), [ClearBase](https://cosmolabs.co.uk/clearbase).

## 6. Fra landberedskab til maritim DSRS-model

| Generisk/landbaseret begreb | DSRS-begreb og produktadfærd |
|---|---|
| Station | Redningsstation med operationsområde, slæbesteder, havn og lokale procedurer |
| Brandbil/appliance | Redningsfartøj, RHIB/FRB, trailerbåd, støttebil eller landhold |
| Sæde/funktion | Bådfører/skipper, navigatør, maskinansvarlig, søredder, medic/førstehjælp, dykker, dronepilot, stationsleder |
| Minimumsbemanding | Minimum sikkert crew pr. fartøj og hændelsestype, inklusive obligatoriske kompetencer |
| Adresse | WGS84-position, farvand, waypoint, kurs/afstand, What3Words som supplement og evt. adresse/slæbested |
| Kørevej | Rute til station/slæbested og derefter søvej, afstand, ETA, dybde- og farvandskontekst |
| Hydranter og preplans | Havneplaner, slæbesteder, brændstof, pumpe/materiel, kendte grunde, broer, lavvand, adgangskoder og lokale SOP’er |
| Vejr ved hændelse | Vind, bølge, sigt, strøm, tidevand, vandtemperatur og varsler med kilde/tidspunkt |
| CAD-dispatch | JRCC/112/VHF/telefon/API-kilde med tydelig afsender, validering og manuel operatørbekræftelse |
| Fremmøde station/scene | På station, ved slæbested, direkte til position, ombord på andet fartøj eller fjernstøtte |
| Køretøjsstatus | Fartøj klar, begrænset, ude af drift, brændstof, batteri, navigation, VHF/AIS og kritisk materiel |
| Incident commander | Operativ stationsleder/indsatsansvarlig med tydeligt forhold til JRCC’s SAR-koordinering |
| Afslut alarm | Demobilisering, hjemkomst, fartøj genmeldt klar, materielafvigelser, log og debrief |

## 7. Samlet funktionskort

### A. Alarmering og sikker levering

- Oprettelse fra kontrolcentral, mobil, API og senere indgående integrationer.
- Alarmtyper, prioritet, geografisk område og målgrupper.
- Push via APNs/FCM, synlig leveringsstatus og kritisk lyd, hvor platformen understøtter det.
- Kvittering: **Accepteret**, **På vej / ETA**, **Kan ikke** og mulighed for at ændre svar.
- Deadline, reminder, retry og automatisk eskalation.
- SMS og automatiseret opkald som dokumenteret fallback.
- Testalarm, enhedstest og ugentlig selvtest uden at skabe alarmtræthed.
- Afslut/luk alarm, annullering, superseded-version og automatisk rydning af aktive notifikationer.
- Dubletkontrol via hændelses-ID og audit af alle ændringer.

### B. Beredskab, vagt og kompetencer

- Tilgængelig nu, senere eller utilgængelig med udløbstid.
- Vagtplan, ferie, øvelser, møder og kalenderintegration.
- Geofence/forventet transporttid til station med samtykke og privatlivsbegrænsning.
- Roller, certifikater, lokale godkendelser og udløbsdatoer.
- Beregnet fartøjsklarhed ud fra minimumsbesætning og kompetencer.
- Varsel om kommende huller i beredskabet.
- Fair besætningsforslag og belastningsbalance.

### C. Maritim mission

- Position, farvand, personer ombord, skader, fartøjstype/kaldesignal, situation og ønsket assistance.
- Nautisk kort, søvej, vejr/tidevand/strøm og lokale farer med tidsstemplede kilder.
- Ressourcekort med frivilligt positionssamtykke og automatisk stop efter hændelsen.
- Tildelt fartøj, rollebesætning, launch-/departure-tid og ETA.
- Tidslinje, checkpoints, opgaver, meddelelser, billeder og dokumenter.
- Stationsskærm i hændelsestilstand med stor tekst, tale og tydelige statusser.
- Log over kommunikation og overlevering til/fra JRCC uden at forveksle platformen med SAR-ledelsen.

### D. Afslutning, kvalitet og drift

- Kontrolleret afslutning af operativ alarm og demobilisering.
- Fartøj/materiel tilbage i beredskab eller markeret ude af drift.
- Hændelsesrapport, deltagere, tider, kilometer/sømile, brændstof og noter.
- Personskade/nærved-hændelse og adgangsbegrænset dokumentation.
- Debrief, læringspunkter og opgaver med ejer/deadline.
- Rapporter om responstid, leveringskvalitet, bemanding og tilgængelighed.
- Uforanderlig auditlog, datalivscyklus, rollebaseret adgang og eksport.

## 8. Prioriteret roadmap

Tidsangivelserne er retningsgivende fra godkendt start med et lille fokuseret produktteam. Faser kan overlappe, men **pilot-sikker alarmering må være gate før bred udrulning**.

### Fase 0 — Prototype-hærdning (nu til 4 uger)

**Mål:** Bevis hele alarmkæden på én station og gør prototypens begrænsninger synlige.

- Kontrolcentral og mobilvisning på aktuelle iOS-/Android-størrelser samt web.
- Alarmoprettelse, push, modtaget/vist, accepteret/afvist, lydtest og afslut alarm.
- Enhedsregistrering og simpelt stationsmedlemskab.
- Basis auditlog, fejltilstande, genforsøg og tydelig “demo/pilot”-status.
- Testmatrix for browser, installeret PWA, låst skærm, lydløs, strømbesparelse og manglende netværk.
- Første operatørtest med DSRS Køge og dokumenteret feedback.

**Gate:** Mindst 50 kontrollerede testalarmer uden tab af hændelser; kendte platformbegrænsninger er dokumenteret.

### Fase 1 — Pilot-sikker alarmering (1–3 måneder)

**Mål:** En driftbar pilot, hvor alarmkæden og ansvaret er entydigt.

- Rigtig identitet, MFA for operatører, roller og stationsadskillelse.
- Produktionsdatamodel med organisation, station, fartøj, medlemskaber og samtidige hændelser — dimensioneret til 14+ stationer fra start.
- Serverbaseret alarmmotor, idempotente hændelser, robust database og audit.
- Native push via FCM/APNs; iOS Critical Alerts kræver særskilt Apple-godkendelse.
- Leveringsdiagnostik pr. telefon og klar operatørstatus: sendt, modtaget, vist, svar, offline/ukendt.
- **Accepteret**, **På station om X min.**, **Kan ikke** samt svarændring.
- Deadline, reminders, eskalation og SMS/opkaldsfallback efter godkendt politik.
- Kompetencer, roller og minimum sikkert crew pr. fartøj.
- Afslut, annullér og genåbn med rettigheder og begrundelse.
- Monitoring, backup, incident response, databehandleraftaler og pilot-support.

**Gate:** Pilotstationen kan gennemføre alarm, bemanding, eskalation og afslutning uden parallel manuel liste; fallback er øvet.

**Arkitekturgate:** Ingen produktionskode må længere antage `koege`, ét fartøj eller én global aktiv alarm. Alle forespørgsler og hændelser skal være scoped med organisation/station og entydigt alarm-ID.

### Fase 2 — Beredskab og besætningsplan (3–6 måneder)

**Mål:** Forudse om station og fartøj kan rykke sikkert ud.

- Vagt, tilgængelighed, ferie og kalender/øvelser.
- Kompetenceudløb og fartøjsspecifikke bemandingsregler.
- Realtids- og prognosevisning af fartøjsklarhed.
- Geofence/transporttid som frivillig opt-in og kun til operativt formål.
- Fartøjs- og kritisk materielstatus.
- Stationsdisplay, tale og lokale lyd-/lysrelæer som særskilte kanaler.
- Multi-station og nabostationseskalation.
- Fælles ressourcemap med hjemme-/aktuel station og mulighed for midlertidigt udlånte fartøjer.

**Gate:** Systemet kan advare om et fremtidigt beredskabshul og forklare præcis hvilken rolle/kompetence der mangler.

### Fase 3 — Maritim missionsstøtte (6–9 måneder)

**Mål:** Understøt fra alarm til fartøjet er hjemme og klar igen.

- Struktureret maritim hændelsesformular baseret på DSRS/JRCC-relevante data.
- Nautisk kort, launch point, position, kurs/afstand og deling til navigation.
- Vejr, tidevand, strøm, sigt og vandtemperatur med kilde og opdateringstid.
- Live position af responder/fartøj med samtykke, kort retention og automatisk stop.
- Operativ tidslinje, checkpoints, task board og beskeder.
- Lokale SOP’er, havneplaner, slæbesteder og kendte farer.
- Kontrolleret afslutning, fartøj genmeldt klar og debrief.

**Gate:** En realistisk øvelse kan dokumenteres fra første alarm til afsluttet debrief med fuld tidslinje.

### Fase 4 — Organisationsplatform (9–15 måneder)

**Mål:** Aktivér fuld netværksdrift på mindst 14 stationer uden at miste lokal fleksibilitet.

- Hierarki: DSRS → region/område → station → fartøj → hold/person.
- Central politik med lokale undtagelser.
- Integration til relevante DSRS-systemer og, hvor aftaler tillader det, JRCC-/dispatch-kilder.
- Kvalifikationer, træning, øvelser og dokumentation.
- Materiel, service, fejl, checklister og vedligehold.
- Rapporter, BI, statistik, fairness og kapacitetsplanlægning.
- Standardiseret onboarding, support og datamigrering.

**Gate:** Mindst 14 stationer og deres fartøjer kan driftes med samme platform, adskilte rettigheder, sammenlignelige data og samtidige hændelser.

### Fase 5 — Robusthed, sikkerhed og certificering (overlapper 6–18 måneder)

**Mål:** Gør platformen egnet til kritisk beredskabsdrift.

- Redundant drift i EU/EØS, dokumenteret disaster recovery og regelmæssige restore-tests.
- SLO/SLA, syntetiske alarmtests, vagtordning og leverandøruafhængig nødprocedure.
- Penetrationstest, secure SDLC, dependency scanning og security logging.
- ISO 27001-forberedelse eller tilsvarende dokumenteret ISMS efter DSRS’ risikovurdering.
- Dataklassifikation, retention, rettigheder, revisionsspor og privacy impact assessment.
- Belastnings- og chaos-tests af alarmkæden.

## 9. UI/UX-koncept

### 9.1 Designprincipper

1. **Beslutning før data:** Første skærm viser “Har vi sikkert crew?” og “Hvad kræver handling nu?”
2. **Status må aldrig kun være farve:** Brug ikon, ord, tid og farve sammen.
3. **Stor betjening under pres:** Primære handlinger mindst 48 px, høj kontrast og én-håndsbetjening.
4. **Progressiv detalje:** Alarmens kerne først; vejr, log, dokumenter og administration foldes ud efter behov.
5. **Tydelig autoritet:** Vis hvem der oprettede, ændrede og afsluttede alarmen, og om opgaven er DSRS-assistance eller JRCC-koordineret SAR.
6. **Fejl er en tilstand:** “Push ukendt — SMS sendt” er mere nyttigt end en grøn systemlampe.
7. **Maritim nattilstand:** Mørk base, lav blænding og høj læsbarhed; ingen små grå tekster på kritiske flader.
8. **Privatliv som standard:** Position deles kun, når formålet er tydeligt, med synlig indikator og automatisk stop.

### 9.2 Kontrolcentral — foreslået informationshierarki

```text
┌ DSRS OPERATIV ─ Aktiv alarm #KØG-042 ─ 14:49 ─ Kæde: Push OK / SMS 1 ┐
│ PERSON I VANDET     55°27.90'N 12°12.45'E     JRCC-koordineret SAR │
├───────────────────────────────┬─────────────────────────────────────┤
│ KORT / POSITION / VEJR        │ BEMANDING                           │
│ mål · station · fartøj · ETA  │ RS Køge: KLAR 4/4                   │
│ vind · bølge · sigt · strøm   │ ✓ bådfører ✓ VHF ✓ medic ✓ redder  │
├───────────────────────────────┼─────────────────────────────────────┤
│ ALARMKÆDE                     │ HANDLING                            │
│ 8 sendt · 7 modtaget · 6 vist│ [Eskaler] [Opdater] [Afslut alarm] │
│ 4 accepteret · 1 +8 min · 1 nej                                   │
├─────────────────────────────────────────────────────────────────────┤
│ TIDSLINJE 14:49 oprettet · 14:50 crew klar · 14:57 forventet afgang│
└─────────────────────────────────────────────────────────────────────┘
```

Operatøren skal kunne åbne en person og se enhedens leveringsdiagnostik, men cockpit-visningen bør som udgangspunkt aggregere på: **besætning klar**, **mangler rolle**, **enheder uden levering** og **næste eskalation**.

### 9.3 Besætningsapp — alarm

```text
┌ DSRS Operativ                         ● alarmlyd aktiv ┐
│ STATION KØGE · DU ER I BEREDSKAB                        │
├─────────────────────────────────────────────────────────┤
│ KRITISK SAR · 14:49                         #KØG-042    │
│ PERSON I VANDET                                        │
│ 55°27.90'N · 12°12.45'E · Køge Bugt                    │
│ 3 personer · 1 i vandet · vind 8 m/s V · vand 10 °C    │
│ RS KØGE · rollebehov: bådfører, VHF, medic, søredder    │
├─────────────────────────────────────────────────────────┤
│ [ ✓ ACCEPTERET ] [ PÅ STATION OM 8 MIN ]                │
│ [ × KAN IKKE ]                                          │
├─────────────────────────────────────────────────────────┤
│ Din tildeling: SØREDDER 2 · Mødested: RS Køge           │
│ [Navigér til station] [Vis position] [Ring operatør]     │
└ Alarm ─ Vagt ─ Status ─ Mere ───────────────────────────┘
```

Når alarmen afsluttes, fjernes den aktive alarmflade og erstattes af: **“Alarm afsluttet 16:23 — fartøj endnu ikke genmeldt klar”** eller **“Hændelse afsluttet — ingen handling nødvendig.”** Historik må ikke ligne en aktiv alarm.

### 9.4 Vagt og beredskab

- 24-timers tidslinje med ens egen tilgængelighed og stationens beregnede fartøjsklarhed.
- Hurtig vælger: Klar / Senere / Ikke tilgængelig med udløbstid.
- Rollebadges og advarsel før certifikat udløber.
- Ferie- og kalenderkobling, men uden at skjule manuelle undtagelser.
- “Hvorfor er vi ikke klar?” viser konkrete mangler, fx “Bådfører mangler 18:00–22:00”.

### 9.5 Stationsskærm

- Normalt: klokke, fartøjsklarhed, næste beredskabshul og kritisk materielstatus.
- Alarm: fuldskærm med hændelse, position, mødested, fartøj, roller, svar og forventet afgang.
- Høj kontrast og læsbar på afstand; ingen personfølsomme oplysninger uden operativt behov.
- Tale/lyd, lys og porte vises som kvitterede outputkanaler i alarmkæden.

### 9.6 Efter hændelsen

- Trin 1: Demobiliser personer.
- Trin 2: Genmeld eller begræns fartøjet.
- Trin 3: Registrér tider, deltagere, forbrug og afvigelser.
- Trin 4: Debrief/læringspunkt og evt. nærved-hændelse.
- Trin 5: Godkend og lås rapporten med revisionsspor.

## 10. Foreslået informationsarkitektur

**Besætningsapp**

- Alarm
- Vagt
- Status
  - Egen status
  - Station/fartøj
  - Kompetencer
- Mere
  - Kalender/øvelser
  - Alarmtest og enhedsstatus
  - Historik
  - Dokumenter/SOP
  - Privatliv og position
  - Support

**Kontrolcentral/web**

- SAR-central
- Aktive hændelser
- Beredskab
- Stationer og fartøjer
- Vagt og kalender
- Personer og kompetencer
- Materiel
- Rapporter
- Administration
- Systemstatus og alarmtests

## 11. Teknisk produktmodel

Kerneobjekter bør mindst være:

- Organisation, område, station, naborelation og operationsområde.
- Fartøj/enhed, hjemme-/aktuel station, status, minimumsbesætning og kritisk materiel.
- Person, rolle, kompetence, certifikat, stationstilknytning og privatlivssamtykke.
- Medlemskab mellem person og station med lokale roller, alarmeringsgrupper og gyldighedsperiode.
- Tilgængelighedsinterval, vagt, ferie og kalenderhændelse.
- Alarm/hændelse med ekstern reference, version, prioritet, maritim position og koordinerende myndighed.
- Opgave/tasking med fartøj, roller og mødested/launch point.
- Leveringsforsøg pr. kanal/enhed og kvitteringsstadie.
- Respons med status, ETA, rutevalg og ændringshistorik.
- Position sample med formål, retention og automatisk stop.
- Operativ tidslinje, kommunikationslog og vedhæftning.
- Afslutning, fartøjs-genmelding, rapport, debrief og action item.
- Uforanderlig audit event med actor, tidspunkt, før/efter og korrelations-ID.

Alle domæneobjekter skal have stabile, ikke-betydningsbærende ID'er. Stationsnavn og fartøjsnavn må ændres uden at bryde historik eller integrationer.

### 11.1 Kapacitets- og isolationstest

Før netværksdrift skal testmiljøet mindst simulere:

- 20 stationer, så designet har margin over det kendte krav på 14+.
- 5 fartøjer pr. station og forskellige minimumsbemandingsprofiler.
- 1.000 registrerede enheder og samtidige push-/fallbackforsøg.
- Flere samtidige alarmer med overlappende stationer, personer og fartøjer.
- En nabostation, der overtager eller supplerer en hændelse.
- At en stationsbruger aldrig kan læse eller ændre en anden stations data uden tildelt tværgående rolle.

## 12. Build-versus-buy

**Byg selv**

- DSRS’ maritime arbejdsgange, cockpits, fartøjsberedskab og rollebaserede besætningsregler.
- Hændelsesmodel, operativ tidslinje og afslutningsflow.
- Brugeroplevelsen på dansk og DSRS’ visuelle/operationelle identitet.
- Integrationsoverflade og leveringsstatus, så DSRS ikke låses til én kanal.

**Køb eller integrér som standardkomponent**

- SMS og automatiseret telefoni.
- APNs/FCM-infrastruktur og en professionel notifikationsleverandør, hvis den giver bedre sporbarhed/fallback.
- Kort, nautiske data, vejr, tidevand og AIS, hvor licenser og ansvar er afklaret.
- Identitetsleverandør/MFA, overvågning, logging og backup.

**Udskyd**

- Løn, fuld HR, avanceret BI og bred asset management.
- Egen radio-/pagerhardware.
- Automatisk operativ beslutningstagning baseret på AI. AI kan senere assistere med opsummering og datakvalitet, men må ikke være skjult beslutningstager i kritiske flows.

## 13. Mål og KPI’er

### Alarmkæde

- Tid fra oprettet til første enhed modtaget, vist og besvaret.
- Andel leveret via primær kanal og andel, der kræver fallback.
- Antal ukendte leveringsstatusser efter 30/60/120 sekunder.
- Testalarm-success pr. enhedsmodel og OS-version.

### Mobilisering

- Tid til kvalificeret minimumsbesætning.
- Tid til afgang og forskel mellem estimeret og faktisk afgang.
- Antal eskalationer og årsag: ingen levering, intet svar eller manglende kompetence.

### Beredskab

- Timer med fuldt/ufuldt fartøjsberedskab.
- Hvor tidligt kommende huller opdages og afhjælpes.
- Kompetence- og certifikatdækning pr. station/fartøj.

### Kvalitet

- Hændelser med komplet tidslinje og godkendt afslutning.
- Antal fejl, nærved-hændelser og forbedringspunkter lukket til tiden.
- Brugeroplevet belastning, fejltryk og tid til at forstå den aktive alarm.

## 14. Beslutninger før fase 1

1. Hvilken station er pilot, og hvilke konkrete alarmtyper indgår?
2. Hvem har autoritet til at oprette, opdatere, annullere og afslutte en alarm?
3. Hvilken minimumsbesætning og hvilke kompetencer gælder pr. fartøj?
4. Hvad er eskalationsfristerne, og hvornår må SMS/opkald bruges?
5. Hvilke alarmer er JRCC-koordinerede, og hvordan vises denne grænse tydeligt?
6. Hvilke person- og positionsdata må lagres, hvor længe og med hvilket samtykke?
7. Skal fase 1 være en native app, eller kan PWA fortsætte som kontrolleret prototype, mens native bygges?
8. Hvad er acceptabel nedetid, og hvilken manuel nødprocedure anvendes ved platformfejl?
9. Hvilke eksterne systemer og datakilder er reelt tilgængelige med aftaler/API’er?
10. Hvem ejer produkt, drift, sikkerhed, databeskyttelse og support efter overdragelse til DSRS?

## 15. Anbefalet næste sprint

1. Gennemfør en 90-minutters arbejdsworkshop med operatør, stationsleder, bådfører og to søreddere.
2. Beskriv tre realistiske scenarier: assistance/motorstop, akut SAR/person i vandet og falsk/annulleret alarm.
3. Fastlæg minimumsbesætning og eskalationspolitik for RS Køge og RHIB 01.
4. Test prototypen på mindst to Android- og to iPhone-generationer i låst, lydløs og strømbesparende tilstand.
5. Design og implementér “På vej / ETA” og rollebaseret besætningsklarhed som næste synlige produktfunktion.
6. Udarbejd risikoanalyse og beslutning om PWA kontra native app for pilotdrift.
7. Opret GitHub-repository under DSRS-kontrolleret ejerskab eller en midlertidig, dokumenteret privat ejer med planlagt overdragelse.

---

### Kildeprincip

Produktnavne og kendetegn tilhører deres respektive ejere. Kortlægningen bruger offentlige oplysninger til sammenligning og produktplanlægning; der er ikke kopieret proprietær kode eller grafisk materiale.
