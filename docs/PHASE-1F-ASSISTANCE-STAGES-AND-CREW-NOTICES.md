# Fase 1F — assistancetrin og udtagningsbeskeder

## Tre operative trin

Kontrolcentralen viser alarmens tilstand som et fast tretrinsforløb:

1. **Alarm startet** — alarmen er oprettet og udsendt.
2. **Afventer besætning** — svar og kompetencer indsamles, indtil en sikker besætning kan vælges.
3. **Assistance startet** — konkrete personer er udtaget, og beskedfordelingen er iværksat.

Trinvisningen viser alarmtidspunkt, antal accepterede i forhold til minimum og til sidst antal udtagne personer.

## Besked ved start af assistance

Når assistancen startes manuelt eller automatisk, klassificeres alle personer, der har svaret **Accepteret**:

- **Udtaget:** Pushbeskeden angiver fartøj og plads samt beder personen køre til stationen og følge landkoordinatorens besked.
- **Ikke udtaget:** Pushbeskeden siger udtrykkeligt, at personen ikke skal køre til stationen, medmindre landkoordinatoren kontakter vedkommende.

Kontrolcentralen viser både klassifikationen og om udtagningsbeskeden blev sendt eller fejlede. Personer, der afviste eller endnu ikke har svaret, modtager ikke en udtagningsbesked.

## Sikkerhed og sporbarhed

- Udtagningsbeskeder bruger høj prioritet, systemnotifikation og vibration, hvor platformen tillader det.
- Den oprindelige alarmnotifikation erstattes på telefonen af den endelige udtagningsbesked for samme alarm.
- Resultatet gemmes pr. levering med status, afsendelsestidspunkt og eventuel fejl.
- AI-testpersoner får en simuleret udtagningsstatus i kontrolcentralen, men ingen virkelig Web Push.
- En fejlet udtagningsbesked skal være synlig for landkoordinatoren og håndteres med den aftalte telefon-/SMS-/radiofallback.

## Produktionskrav

Web Push er fortsat pilotkanal. Produktionsversionen skal have overvågning, genforsøg, eskalation og dokumenteret fallback, så en person ikke alene er afhængig af én browsernotifikation for at vide, om vedkommende er udtaget.
