# Pubblicare MOTO su GitHub Pages

La cartella contiene ora sia il sito pronto sia tutti i sorgenti per continuare a lavorarci in due.

## Caricamento diretto

1. Apri [il repository](https://github.com/leowl-M/training-moto) e usa **Add file → Upload files**.
2. Per sistemare subito il sito già caricato, carica **index.html e la cartella assets/** dalla nuova cartella `MOTO-CARICAMENTO-DIRETTO`, nella radice del repository. Conferma la sostituzione del vecchio `index.html` con **Commit changes**. Non caricare una cartella esterna o soltanto lo ZIP.
3. In **Settings → Pages** scegli **Source → Deploy from a branch**, branch **main** e cartella **/(root)**. Premi **Save**. Se questa impostazione è già attiva, lasciala così.
4. Attendi che **Actions → pages build and deployment** termini con il risultato verde. Apri [il sito](https://leowl-m.github.io/training-moto/) e aggiorna con **⌘⇧R**.
5. Completa anche il caricamento dei sorgenti aggiornati: carica **src/**, **scripts/**, **vite.config.ts**, **package.json**, **package-lock.json**, **tsconfig.json**, **style.css**, i documenti e il file di avvio. Carica **tests/** separatamente. È importante sostituire i file omonimi: la pagina sorgente ora è `src/index.html`.

Per partire da un repository vuoto, carica tutto il contenuto della cartella tranne **tests/** e poi **tests/** in un secondo caricamento: GitHub consente fino a 100 file per caricamento. `index.html`, `assets/`, `src/` e `package.json` devono essere visibili subito nella radice del repository.

La cartella nascosta `.github` è facoltativa per questa modalità. Puoi mostrarla nel Finder con **⌘⇧.** se vuoi caricare anche il workflow. Non occorre eliminare gli altri file del repository.

## Lavorare in due e aggiornare il sito

Usate un unico repository e branch separati, unendo le modifiche su `main` tramite pull request. La pagina da modificare è **src/index.html**; il codice e gli stili sono in **src/** e **style.css**.

Per lavorare localmente, con Node.js installato, usa **Avvia MOTO.command** oppure:

```sh
npm ci
npm run dev
```

Prima di pubblicare le modifiche esegui:

```sh
npm test
npm run build
```

La compilazione aggiorna **index.html e assets/** nella radice, pronti per il caricamento diretto, oltre a creare **dist/**. Pubblicate i sorgenti e i file compilati dello stesso aggiornamento. Non modificate a mano i file compilati.

## Pubblicazione automatica facoltativa

Per compilare automaticamente a ogni aggiornamento del branch `main`, includete **.github/workflows/deploy-pages.yml** nel repository e scegliete **Settings → Pages → Source → GitHub Actions**. Il workflow installa le dipendenze, esegue i test, compila e pubblica **dist/**. Se l’impostazione Pages è stata cambiata dopo il caricamento, avviate **Actions → Pubblica MOTO su GitHub Pages → Run workflow**.

## Riferimenti

- [Pubblicazione di Vite](https://vite.dev/guide/static-deploy.html)
- [Sorgente di pubblicazione per GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Caricamento di file su GitHub e limite di 100 file](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
