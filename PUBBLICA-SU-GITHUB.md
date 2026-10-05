# Pubblicare MOTO su GitHub Pages

Questo progetto usa Vite e TypeScript. GitHub Pages deve pubblicare la versione compilata, non l’HTML dei sorgenti: pubblicare direttamente `index.html` insieme a `src/` lascia l’interfaccia senza funzionamento.

## Primo caricamento dal browser

1. Apri il repository `https://github.com/leowl-M/training-moto` e usa **Add file → Upload files**.
2. Carica il **contenuto** della cartella `MOTO-per-GitHub`, nella radice del repository. `index.html`, `package.json` e `src/` devono essere subito visibili, senza una cartella esterna `MOTO-per-GitHub`.
3. Su Mac premi **⌘⇧.** nel Finder per mostrare i file nascosti. Includi `.github` e `.gitignore`. GitHub consente al massimo 100 file per caricamento: carica prima tutto tranne `tests/`, poi carica `tests/` in un secondo caricamento nella stessa radice. Conferma ogni caricamento con **Commit changes** sul branch `main`.
4. Apri **Settings → Pages**. In **Build and deployment → Source** scegli **GitHub Actions**. Non scegliere la pubblicazione diretta dal branch.
5. Apri **Actions → Pubblica MOTO su GitHub Pages**. Una prima esecuzione può fallire mentre il caricamento dei file è ancora incompleto o prima di cambiare l’impostazione Pages. Dopo aver completato entrambi, usa **Run workflow → main → Run workflow** per ripeterla. Attendi il risultato verde.
6. Apri `https://leowl-m.github.io/training-moto/`. Se mostra ancora la pagina precedente, ricarica con **⌘⇧R**.

Non caricare soltanto lo ZIP: GitHub non lo estrae. Estrai i file e caricane il contenuto. Il workflow deve essere presente come `.github/workflows/deploy-pages.yml` nel repository.

## Aggiornamenti successivi e lavoro in due

La pubblicazione si ripete automaticamente a ogni aggiornamento del branch `main`: installa le dipendenze, esegue i test, compila e pubblica `dist/`. Non occorre caricare `node_modules/` o `dist/` nel repository.

Usate entrambi questo repository e branch separati per le modifiche. Unite il lavoro su `main` tramite pull request. Se rinominate il repository, i percorsi relativi della build continuano a funzionare; cambia soltanto l’indirizzo pubblico del sito.

## Avvio sul computer

Usa **Avvia MOTO.command** su Mac oppure `npm ci` e `npm run dev`. Aprire `index.html` con un doppio clic non avvia il progetto. Per controllare localmente la versione compilata usa `npm run build` e `npm run preview`.

## Riferimenti

- [Pubblicazione di Vite su GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages)
- [Workflow personalizzati di GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Caricamento di file su GitHub e limite di 100 file](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
