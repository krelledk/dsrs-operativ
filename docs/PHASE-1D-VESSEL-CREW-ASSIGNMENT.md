# Fase 1D — fartøjsspecifik besætningsudvælgelse

## Leveret i pilotversionen

Hvert fartøj har nu sin egen minimums- og maksimumsbemanding samt en liste over pladser, der skal dækkes. Når en person accepterer alarmen, bliver vedkommende kandidat til besætningen. Landkoordinatoren kan vælge konkrete personer, få systemet til at foreslå den mindste sikre besætning og derefter godkende, at assistancen starter.

Auto-start er som udgangspunkt slået fra. Ved en alarm med prioriteten MAYDAY er den slået til som standard, men landkoordinatoren kan ændre valget før udsendelse. Auto-start sker kun, når alle valgte fartøjers minimum og krævede pladser kan dækkes af personer, der har accepteret alarmen.

## Rollehierarki

Pilotens hierarki er:

1. Bådfører, niveau 4
2. Redder, niveau 3
3. Redderassistent, niveau 2
4. Aspirant, niveau 1

En person på et højere niveau kan udfylde en plads på et lavere niveau. Det omvendte er ikke tilladt. Algoritmen besætter de højeste krav først og bruger så vidt muligt den lavest kvalificerede egnede person, så højere kompetencer ikke forbruges unødigt.

## Pilotdata, som DSRS skal godkende

Følgende værdier er alene indsat for at gøre arbejdsgangen testbar:

- RS Køge: minimum 4, maksimum 6; 1 bådfører, 2 reddere og 1 redderassistent.
- RHIB 01: minimum 2, maksimum 4; 1 bådfører og 1 redder.

De må ikke betragtes som DSRS' godkendte operative bemandingskrav. Før produktionsbrug skal hvert fartøj på alle stationer have en ejer, en godkendt bemandingsprofil, gyldighedsdato og revisionsspor.

## Sikkerhedsafgrænsning

Rolle- og kompetencedata er fortsat pilotoplysninger og kan være selvangivet. De må derfor ikke være eneste grundlag for at sende et fartøj. Produktionsversionen skal hente identitet fra Microsoft Entra og roller/kompetencer fra en DSRS-ejet autoritativ kilde. Entra skal autentificere personen; DSRS' operative system skal afgøre, hvilke pladser personen må besidde.

Auto-start betyder i denne pilot, at systemet registrerer en godkendt besætning og viser den i kontrolcentral og app. Det starter ikke et fartøj fysisk og erstatter ikke landkoordinatorens, bådførerens eller JRCC's operative beslutninger.

## Næste trin

- Administrationsside til fartøjer, minimum, maksimum og pladsprofiler.
- Verificerede roller og kompetencer med udløbsdatoer.
- Tydelig indkaldelse til valgt/ikke valgt person efter besætningsgodkendelse.
- Genplanlægning ved afbud og ændring af fartøj.
- Nabostationer og personer med flere stationsmedlemskaber.
- Entra-login, DSRS-rolleforvaltning og revisionsgodkendelse.
