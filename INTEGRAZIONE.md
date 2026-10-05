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

## Lavorare in due

Usate questa versione come base di un unico repository condiviso. Create un branch per ogni lavoro e integrate le modifiche nel branch principale tramite pull request. Evitate di continuare a modificare due copie indipendenti dello stesso progetto.

L’archivio originale del collega è conservato nella cartella locale come riferimento. Non è incluso nello ZIP della versione unificata. Nessun repository remoto e nessun deployment è stato modificato durante questa integrazione.
