# Fase 1C — koordinatorer og alarmsikkerhed

## Leveret i pilotversionen

- Koordinatorer er egne, stationsopdelte poster med navn, telefon, breddegrad og længdegrad.
- Kontrolcentralen kan oprette eller redigere en koordinator og vælge vedkommende i alarmformularen.
- Køge har en tydeligt mærket testkoordinator (`[TESTDATA]`), som aldrig må forveksles med en operativ kontakt.
- Hvis ingen koordinator vælges, skal operatøren vælge alarmpositionen på det klikbare kort. Et kortklik rydder koordinatorvalget og gemmer decimal-koordinater samt kilden `map` på alarmen.
- Alarmen gemmer et uforanderligt øjebliksbillede af kontaktoplysningerne. En senere rettelse af koordinatoren ændrer derfor ikke historiske alarmer.
- Koordinatoren sendes kun til den valgte stations registrerede alarmmodtagere og vises med klikbart telefonnummer i besætningsappen.
- Forgrundslyden gentages, indtil redderen svarer, eller kontrolcentralen afslutter alarmen.
- Kontrolcentralen viser en markant driftsadvarsel, hvis der ingen registrerede modtagere er, eller hvis ingen telefon efter 15 sekunder har bekræftet, at notifikationen blev vist.

## Data- og adgangsgrænser

Koordinatorlisten kræver kontrolcentral-login og udleveres ikke i det offentlige konfigurationskald. Koordinatorens kontaktoplysninger medtages i en alarm, fordi de er operative alarmdata, men alarmen er stadig afgrænset til én station. Telefon og koordinater skrives ikke i auditloggens metadata.

Stationskoden og det fælles pilotlogin er fortsat midlertidige. Entra ID skal senere autentificere brugerne, mens DSRS' egen datamodel fortsat afgør stationsadgang og operative roller.

## Integration fra den eksterne alarm-app

Den eksisterende alarm-app kan senere oprette eller opdatere koordinatorer via et integrationskald med følgende forretningsfelter:

```json
{
  "externalId": "alarm-app-123",
  "stationId": "station-koege",
  "name": "Navn",
  "phone": "+45 12 34 56 78",
  "latitude": 55.4583,
  "longitude": 12.1833
}
```

Der er bevidst ikke åbnet et offentligt skrive-endpoint endnu. Før det gøres, skal leverandørens API-dokumentation og autentificering være kendt. Produktionsvalget bør være Entra/OAuth 2.0 client credentials med kortlivede tokens; en signeret webhook med replay-beskyttelse kan bruges, hvis leverandøren ikke understøtter OAuth. En permanent nøgle i mobilappen er ikke acceptabel.

## Hvad webappen ikke kan garantere

Web Push kan stadig blive dæmpet af lydløs, Fokus, Forstyr ikke, batterisparefunktioner eller producentens baggrundsbegrænsninger. Vedvarende lyd gælder, når PWA'en er åben og browseren tillader afspilning. En sikker produktionskæde kræver:

1. Native Android-kanal med høj vigtighed, lyd/vibration og eksplicit policy-adgang, hvor det er tilladt.
2. Native iOS-app med Apple-godkendt Critical Alerts-entitlement.
3. Serverstyret eskalation: gentagelse, SMS, automatisk opkald og/eller radio efter fast SLA, indtil et menneske har kvitteret.
4. Overvågning af inaktive enheder, udløbne push-tokens og seneste vellykkede alarmtest.
5. Dokumenteret manuel fallback, som operatøren straks kan aktivere fra kontrolcentralens advarsel.

Kontrolcentralens visningskvittering er et sikkerhedsnet og ikke et bevis på, at telefonens højttaler faktisk kunne høres.
