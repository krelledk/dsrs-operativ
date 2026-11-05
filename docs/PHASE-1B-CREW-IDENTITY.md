# Fase 1B — person-, medlemskabs- og kompetencegrundlag

**Version:** 0.9.0
**Dato:** 5. november 2026

## Leveret i denne del

- Stabilt person-ID adskilt fra navn, enhed og push-abonnement.
- Mange-til-mange-grundlag mellem personer og stationer via stationsmedlemskaber.
- Primær rolle pr. person og station.
- Kompetencekatalog og personkompetencer med eksplicit verifikationsstatus.
- Push-enheder kobles til en personprofil i stedet for kun et frit tekstnavn.
- Roller og kompetencer vises sammen med leverings- og svarstatus i kontrolcentralen.
- Eksisterende enheder migreres bagudkompatibelt til personprofiler og standardrollen **Besætningsmedlem**.
- Datagrundlag til fartøjsspecifikke kompetencekrav uden at opfinde operative DSRS-krav.

## Sikker afgrænsning

Rolle og kompetencer vælges af brugeren i pilotfasen og gemmes som `self_declared`. De må derfor ikke bruges til at erklære et fartøj sikkert bemandet. Verificering, gyldighedsperioder og godkendelse skal administreres af DSRS, før crew-gating aktiveres.

Personmatching på navn er kun en bagudkompatibel pilotmekanisme. Navn er ikke en loginidentitet, og navnesammenfald kan ikke håndteres sikkert uden et autoritativt identitetssystem.

## Microsoft Entra ID

Datamodellen indeholder en separat `person_identities`-tabel. En person kan derfor senere kobles til Microsoft Entra ID med:

- identity provider (`entra`),
- Entra tenant-ID,
- stabilt eksternt subject/object-ID.

Navn, mail og telefonnummer må ikke være permanent login-nøgle. Når Entra-integrationen etableres, skal OIDC/OAuth 2.0, MFA/Conditional Access og gruppe-/rolleclaims mappes til DSRS' egne medlemskaber og operative roller. Entra skal autentificere personen; DSRS-datamodellen skal fortsat eje stationstilknytning, fartøjsroller og operative kompetencer.

## Næste del

1. Entra-baseret loginarkitektur og invitation/onboarding.
2. Administrativ verificering af medlemskab, roller og kompetencer.
3. DSRS-godkendte minimumsbemandingsprofiler pr. fartøj.
4. Beregnet crew-klarhed baseret på accepterede, verificerede personer.
5. Svaret **På station om X minutter** og forventet afgang.
