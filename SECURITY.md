# Sikkerhed

Dette repository må aldrig indeholde produktionshemmeligheder, private nøgler, push-certifikater, enhedstokens eller persondata.

## Hemmeligheder

- PEM-, KEY-, P12- og PFX-filer er udelukket via `.gitignore`.
- Produktionshemmeligheder skal opbevares i den valgte platforms secret store.
- Lokale udviklingsværdier placeres i en ignoreret `.env` eller `.dev.vars`.
- Hvis en hemmelighed ved en fejl bliver committed, skal den straks roteres; det er ikke tilstrækkeligt kun at slette filen i en senere commit.

## Rapportering

Indtil DSRS har fastlagt en sikkerhedskontakt, rapporteres sårbarheder direkte til projektets udpegede ejer og ikke som et offentligt issue.

## Prototypeafgrænsning

Den nuværende PWA er en interaktionsprototype. Den må ikke anvendes som eneste eller primære alarmeringskanal i operative SAR-hændelser.
