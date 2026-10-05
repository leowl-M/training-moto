# Integrazione MOTO — 5 ottobre 2026

## Provenienza

- Base: archivio `moto-v2-main.zip` del collega, commit `0134a48451eb46b1728e1f7895a4154619b9ef93`.
- Interfaccia ed effetti: `leowl-M/training-motion`, branch `main`, commit `138d3bd3224bdc981329f6992ac6c19979f3b89c`.

## Scelte di integrazione

La struttura a moduli, il motore v2 e le funzioni di montaggio del collega sono mantenuti. I moduli di video, audio, SVG, sottotitoli, camera e salvataggio restano alla base dell’app.

Le due versioni condividono già i colori e la tipografia del design Training. Le correzioni di dimensionamento e la timeline dei livelli del progetto di Leonardo vengono applicate a questa base. La timeline di montaggio resta disponibile sopra quella dei livelli, che è richiudibile. Zoom e tracce numerose scorrono dentro il pannello senza spostare i comandi fuori dallo schermo.

I 20 effetti aggiuntivi sono in `src/effects/studio.ts`: registrati insieme agli effetti v2, conservano i loro identificatori nei preset. Le maschere entrano nel motore di rendering condiviso, quindi funzionano su testi, immagini e SVG in modalità effetto.

Tempi locali dei livelli e tempi globali del montaggio sono collegati alla posizione e alla velocità della clip attiva. L’intervallo di anteprima è locale alla clip e non riduce il contenuto dell’esportazione. Le scorciatoie della timeline dei livelli vengono attivate quando il focus è in quella sezione, per convivere con quelle del montaggio.

Le nuove etichette dei controlli, la navigazione fra schede, il focus delle finestre modali e la preferenza per ridurre il movimento sono applicati anche ai controlli v2. L’animazione delle miniature interrompe il lavoro quando termina l’interazione o la pagina è nascosta.

## Verifiche

- Tutti i 138 test esistenti della base v2 passano.
- Controllo TypeScript e build di produzione completati.
- 20 effetti Studio: rendering, entrata, uscita speculare e personalizzata, limiti dei parametri, identificatori senza duplicati.
- Tracce di testo: creazione, duplicazione, selezione, spostamento coordinato dei keyframe, annulla/ripeti e annullamento con Esc.
- Zoom e modifica da tastiera delle fasi, con mantenimento del focus.
- Marker, copia/incolla senza duplicati e intervallo di anteprima.
- Scene indipendenti; conversione fra tempi locali e globali; salvataggio e riapertura `.moto`.
- Maschere sulle immagini, durata estesa e tracce SVG.
- Importazione di video MP4 e audio WAV generati nel test; esportazione PNG della sequenza.
- Focus delle finestre modali, navigazione fra schede, etichette dei controlli, timecode da tastiera.
- Layout a 1440×1000, 1280×720 e 390×844, senza scorrimento orizzontale della pagina; preferenza di movimento ridotto; nessun errore JavaScript nel browser.

La trascrizione automatica Whisper e le combinazioni di codec e formati di esportazione diverse da quelle elencate non sono state eseguite nel test di integrazione.

## Correzione della pubblicazione su GitHub Pages

Il sito pubblico caricava l’HTML dei sorgenti con un riferimento a `/src/main.ts`, anziché la versione compilata. La pubblicazione dal branch con la configurazione precedente non compila TypeScript. Inoltre la build usava percorsi assoluti `/assets/`, incompatibili con il sito sotto `/training-moto/`.

La configurazione Vite ora genera percorsi relativi. Il workflow `.github/workflows/deploy-pages.yml` installa le dipendenze, verifica i test e pubblica solo `dist/`. Occorre impostare GitHub Pages su **GitHub Actions**. Le istruzioni per il caricamento, compresi i file nascosti e il limite di 100 file per volta, sono in `PUBBLICA-SU-GITHUB.md`.

Il controllo della vera build in un browser, servita da un hosting statico sia alla radice sia sotto `/training-moto/`, passa: caricamento di JavaScript e CSS, rendering dell’anteprima, creazione dei livelli, annulla, selezione degli effetti, tastiera, esportazione PNG e disponibilità del worker. Non sono stati rilevati errori JavaScript o file dell’app mancanti. La verifica locale non costituisce una pubblicazione online.

Nel caricamento successivo la cartella nascosta `.github` non era presente nel repository e il sito continuava a pubblicare i sorgenti. Il pacchetto ora include direttamente `index.html` compilato e `assets/`, mantenendo la pagina modificabile in `src/index.html`. Vite usa `src/` come radice di sviluppo; `npm run build` aggiorna sia `dist/` sia il sito pronto nella radice tramite `scripts/prepare-site.mjs`. Il caricamento diretto funziona con GitHub Pages da `main` e `/(root)`, mentre il workflow rimane disponibile per chi vuole la compilazione automatica. Nessuna funzione del motore è stata cambiata da questa correzione.

Il controllo statico è stato eseguito direttamente sulla cartella `MOTO-CARICAMENTO-DIRETTO`, senza trasformazioni dei sorgenti sul server, sia alla radice sia sotto `/training-moto/`: entrambi i casi passano. La cartella conserva anche codice, documenti e test per il lavoro condiviso.

## Lavorare in due

Usate questa versione come base di un unico repository condiviso. Create un branch per ogni lavoro e integrate le modifiche nel branch principale tramite pull request. Evitate di continuare a modificare due copie indipendenti dello stesso progetto.

L’archivio originale del collega è conservato nella cartella locale come riferimento. Non è incluso nello ZIP della versione unificata. Nessun repository remoto e nessun deployment è stato modificato durante questa integrazione.
