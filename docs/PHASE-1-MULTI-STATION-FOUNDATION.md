# Fase 1A — multi-station- og fartøjsfundament

**Version:** 0.8.0  
**Dato:** 5. november 2026

## Leveret i denne del

- Bagudkompatibel SQLite-migrering fra én hardkodet station til organisation, stationer og fartøjer.
- De 14 aktuelt offentliggjorte DSRS-stationer er oprettet som konfigurerbare poster.
- RS Køge og RHIB 01 er oprettet som de første fartøjer med selvstændige ID'er og minimumsbesætning.
- Telefonregistrering kræver valg af station og gemmer stationstilknytningen på abonnementet.
- Kontrolcentralen kan vælge ansvarlig station og stationens fartøjer.
- En alarm målrettes kun aktive telefoner på den valgte station.
- Alarmer kan være aktive parallelt på forskellige stationer.
- Afslutning sker på et entydigt alarm-ID i stedet for den seneste globale alarm.
- API-status kan filtreres pr. station og viser samlet antal aktive hændelser.

## Migreringsadfærd

Eksisterende abonnementer og alarmer uden `station_id` tilknyttes automatisk `station-koege`. Ingen eksisterende push-endpoints, leveringskvitteringer eller alarmhistorik slettes.

## Datamodel

```text
organization
  └─ station
       ├─ vessel
       ├─ subscription/device
       └─ alarm
            └─ delivery → subscription/device
```

ID'er er stabile og adskilt fra navne. Et stations- eller fartøjsnavn kan derfor ændres uden at bryde historik eller integrationer.

## Sikker afgrænsning

Stationskoden er fortsat en fælles pilotkode. Den er ikke den fremtidige identitets- eller rettighedsmodel. Før drift på flere stationer skal den erstattes af personligt login, medlemskaber, roller, MFA for operatører og stationsspecifik adgangskontrol.

Fartøjsvalget er i denne første del metadata for hændelsen. Push målrettes stationen, indtil personer også har eksplicitte fartøjs-, rolle- og kompetencetilknytninger.

## Næste del

1. Personligt login og medlemskab af én eller flere stationer.
2. Roller og kompetencer pr. person og fartøj.
3. Minimum sikkert crew og forklaring af manglende funktioner.
4. Svarmuligheden **På station om X minutter**.
5. Stationsspecifikke koder fjernes til fordel for invitation/onboarding.
