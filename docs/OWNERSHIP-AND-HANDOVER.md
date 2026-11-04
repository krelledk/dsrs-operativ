# Ejerskab og overdragelse til DSRS

## Anbefalet mål

Kildekoden placeres i et privat Git-repository ejet af Dansk Søredningsselskab. Personlige konti må ikke være eneste ejer af repository, domæne, hosting, push-certifikater eller produktionshemmeligheder.

## Platformvalg

### Anbefaling: GitHub under DSRS

Vælg GitHub, hvis DSRS ønsker enkel versionsstyring, pull requests, Actions/CI, god adgang for eksterne udviklere og mulighed for senere open source-komponenter. Organisationens login og livscyklus kan på relevante GitHub-planer kobles til Microsoft Entra.

### Alternativ: Azure DevOps / Azure Repos

Vælg Azure Repos, hvis DSRS allerede driver udvikling i Azure DevOps og vil samle kode, Boards, Pipelines og rettigheder samme sted. Repositoryet er standard Git og kan flyttes senere.

### Ikke egnet til kildekode: SharePoint / OneDrive

SharePoint kan bruges til krav, referater, risikovurderinger, databehandleraftaler og driftsprocedurer. Det bør ikke være primær versionsstyring for kildekode.

## Foreslået repository

- Organisation: DSRS-ejet GitHub-organisation eller Azure DevOps-organisation.
- Repository: `dsrs-operativ`.
- Standardgren: `main`, beskyttet mod direkte push.
- Ændringer: pull request med mindst én DSRS-godkender.
- CI: obligatorisk `npm run check` før merge.
- Releases: semantiske versionsnumre og dokumenterede ændringer.
- Adgang: navngivne brugere via DSRS-identitet; ingen delte konti.
- Secrets: GitHub Actions Secrets, Azure Key Vault eller tilsvarende — aldrig i Git.

## Overdragelsestrin

1. DSRS udpeger produktejer og teknisk repository-ejer.
2. DSRS vælger GitHub eller Azure DevOps og opretter organisation/projekt.
3. Dette repository spejles med fuld Git-historik til den DSRS-ejede remote.
4. Branch protection, MFA/SSO, reviewerkrav og secret scanning aktiveres.
5. Domæne, DNS, hosting og pushkonti registreres med DSRS som ejer.
6. En testrelease deployes fra DSRS-repositoryets pipeline.
7. Adgang for midlertidige udviklere reduceres efter accepteret overdragelse.

## Nøgler og serveradgang

`Alarm_Hansen.pem` eller andre private nøgler må ikke kopieres ind i repositoryet. Hvis nøglen skal bruges til en eksisterende server, bør den først identificeres, adgangsniveauet afklares og derefter erstattes af en DSRS-ejet, roterbar deployidentitet med mindst mulige rettigheder.

Se også [INFRASTRUCTURE.md](INFRASTRUCTURE.md) for de oplysninger, der skal være på plads før SSH-adgang eller serverdeployment.
