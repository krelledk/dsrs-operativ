# Fase 1E — simuleret AI-testbesætning

## Formål

Kontrolcentralen kan tilføje otte fiktive testpersoner til en alarm. De har forskellige roller, kompetencer og svartider, så alarmering, leveringsstatus, besætningsvalg og auto-start kan afprøves uden otte fysiske telefoner.

Testholdet aktiveres automatisk som forslag ved prioriteten **Øvelse/test** og kan også slås til eller fra manuelt inden udsendelse. Alarmen og hver testperson markeres tydeligt med **TESTDATA · AI**.

## Profiler

| Testperson | Rolle | Automatisk svar | Eksempler på kompetencer |
| --- | --- | --- | --- |
| AI-test Ida Holm | Bådfører | Accepterer efter ca. 3 sek. | VHF/SRC, bådfører, navigation, lokalkendskab |
| AI-test Morten Dahl | Bådfører | Accepterer efter ca. 5 sek. | VHF/SRC, bådfører, maskinansvarlig |
| AI-test Sara Lind | Redder | Accepterer efter ca. 4 sek. | Førstehjælp, VHF/SRC |
| AI-test Yasin Noor | Redder | Accepterer efter ca. 6 sek. | Navigation, lokalkendskab |
| AI-test Freja Madsen | Redder | Accepterer efter ca. 8 sek. | Førstehjælp, maskinansvarlig |
| AI-test Jonas Beck | Redderassistent | Accepterer efter ca. 7 sek. | Førstehjælp, lokalkendskab |
| AI-test Alma Friis | Aspirant | Accepterer efter ca. 10 sek. | Førstehjælp |
| AI-test Noah Storm | Redderassistent | Afviser efter ca. 9 sek. | VHF/SRC |

Svarene er deterministiske og reproducerbare. “AI” betyder her en simuleret testaktør med en adfærdsprofil; der kaldes ikke en ekstern sprogmodel under en alarm.

## Sikkerhedsgrænse

- Testpersoner oprettes som særskilte testidentiteter og testabonnementer.
- Der sendes aldrig Web Push til testabonnementerne.
- De medtages kun, når landkoordinatoren eksplicit har valgt AI-testpersoner på alarmen.
- Testdata er synligt mærket i alarmoversigt, svarliste og besætningsvalg.
- Funktionen er et testværktøj og må ikke bruges som dokumentation for virkelig bemanding.

## Næste trin

- Valg mellem faste scenarier, eksempelvis “hurtigt fuldt hold”, “mangler bådfører” og “mange afbud”.
- Administrationsside til testprofiler og svartider.
- Automatisk testrapport med tid til levering, svar og sikker minimumsbesætning.
- Særskilt testmiljø, så øvelser aldrig deler aktive hændelser med skarp drift.
