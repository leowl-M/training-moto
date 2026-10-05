# Registro di MOTO v2 beta

Elenco di tutte le novità, migliorie e correzioni, in ordine di lavoro (la più recente in alto).
Per ogni voce: cosa cambia **per chi usa MOTO**, e (in "Dietro le quinte") cosa è cambiato nel codice.
Gli identificativi tra parentesi sono i salvataggi git (`git log`).

Legenda: **Nuovo** funzione che prima non c'era · **Migliorato** funzione che già c'era · **Corretto** difetto sistemato · **Interno** non si vede ma rende il progetto più solido.

---

## MOTO online (richiesta tua)

**Nuovo**
- Il progetto è su **GitHub** in un repository privato (`sebastianocullemi/moto-v2`) e pubblicato su **Vercel** all'indirizzo **https://moto-v2-nine.vercel.app** (progetto `moto-v2`): MOTO si apre da qualsiasi computer, senza avviare niente. Ogni volta che il lavoro viene inviato a GitHub, Vercel lo ripubblica da solo.
- Online non vanno mai i tuoi file: video, audio e font si leggono dal computer che stai usando, i progetti restano nel browser e nei file .moto. Salvataggio automatico, preferiti e font caricati sono separati da quelli di localhost.

---

## Correzione colore e livello di regolazione (Step 5, parte 3)

**Nuovo**
- Clip video › scheda **Colore**: interruttore **Correzione colore**, poi
  - **Luce**: esposizione (in stop), contrasto, luci, ombre;
  - **Colore**: temperatura (caldo/freddo), tinta (magenta/verde), saturazione, vividezza (spinge di più i colori spenti, meno la pelle e i colori già saturi);
  - **Look pronti** (Luminoso e pulito, Caldo, Freddo, Contrastato, Morbido, Cinema, Bianco e nero), **Salva look…** per i tuoi (★ nell'elenco), **Azzera**;
  - **Confronta prima/dopo**: sull'anteprima una linea divide il video, a sinistra originale e a destra corretto.
  Con più clip selezionate le regolazioni valgono per tutte. Doppio clic sul nome di una regolazione la riporta a zero.
- **+ Regolazione** (sopra la timeline, richiesta tua): un **livello di regolazione** come in Premiere. È una clip viola a righe su una traccia Video (la più alta, o una nuova sopra) che corregge **tutti i video sotto** per la sua durata; si allunga, accorcia, sposta e taglia come le altre clip, e con le **dissolvenze** (quadratini negli angoli) la correzione entra ed esce gradualmente. La grafica sta sopra e non viene corretta. Si somma alle correzioni delle singole clip.
- Si vede in anteprima e nel video esportato. Il calcolo si fa sulla scheda video (WebGL), quindi l'anteprima resta fluida anche in 4K.

**Interno**
- `src/seq/grade.ts`: formula di riferimento in JavaScript (`gradePixel`, esposizione e bilanciamento sulla luce lineare, il resto sui valori visti) e lo stesso calcolo come shader (`Grader`). Verificato che la scheda video dà lo stesso risultato (differenza massima 0,5 su 255) e che i video verticali restano dritti. 4 prove nuove, 138 in tutto. Il livello di regolazione è una clip video senza file (`adj: true`) che corregge ciò che è già disegnato sotto.

---

## Livelli: SVG con più livelli apribili e chiudibili (richiesta tua)

**Migliorato**
- Nella colonna Livelli gli SVG con più livelli interni hanno una **freccina** a sinistra: chiusi di partenza, un clic li apre o li chiude, e lo stato si ricorda. Accanto al nome si legge quanti livelli ha il file (per esempio "3 livelli"). Se selezioni un livello interno dal pannello, l'SVG si apre da solo.

---

## Stabilizzazione: l'anteprima ora come l'esportazione (segnalato da te: "in anteprima si vede come prima", "nell'esportazione si vede senza tremolio")

**Corretto**
- **Tempi sfasati di 2 fotogrammi**: nel tuo file Sony (come in molti video con fotogrammi B, anche iPhone) i tempi dei fotogrammi letti direttamente partono da 0,04 s, mentre il lettore del browser parte da 0. L'analisi usava i primi, l'anteprima i secondi, quindi ogni immagine riceveva la correzione di due fotogrammi prima. Ora i tempi partono da 0 ovunque. Questo corregge anche l'**esportazione**, dove il video era in ritardo di 2 fotogrammi (40 ms) rispetto all'audio.
- **Il tempo del fotogramma mostrato** si legge dal fotogramma stesso nel momento in cui si disegna: il lettore ha spesso già un fotogramma più nuovo (20–40 ms) di quello che dicono il suo orologio e il callback dei fotogrammi.
- **Niente fotogrammi persi**: la correzione precedente copiava ogni fotogramma 4K e faceva saltare al lettore 80 fotogrammi su 199 (la panoramica andava a scatti). Ora il fotogramma si legge e si rilascia subito: 0 fotogrammi persi.
- Misura nell'anteprima vera durante la riproduzione, sul tuo b-roll: tremolio tolto **56%** (Media) e **48%** (Forte), contro il 17% di prima. La misura dal vivo conta anche l'irregolarità di un video a 50 fotogrammi su uno schermo a 60 Hz, quindi il valore reale è più vicino a quello dell'esportazione (74%). Le analisi fatte prima si rifanno da sole.

---

## Stabilizzazione più efficace (segnalato da te: "si vede tanto il tremolio")

**Corretto**
- **Anteprima**: la correzione si sceglieva in base al tempo del lettore video, che durante la riproduzione è avanti o indietro fino a un fotogramma e mezzo rispetto all'immagine mostrata (misurato: in metà dei fotogrammi). Ogni fotogramma riceveva la correzione del vicino e il tremolio restava quasi tutto. Ora, con la stabilizzazione accesa, ogni fotogramma nuovo del lettore si copia insieme al suo tempo esatto e l'anteprima disegna quella copia: immagine e correzione sono sempre accoppiate. L'esportazione usava già i fotogrammi esatti.
- **Analisi**: nelle panoramiche veloci (come il tuo b-roll) l'immagine si spostava tra due fotogrammi più dell'area in cui la cercavo, quindi il movimento veniva tagliato e misurato male. Ora la ricerca parte dal movimento del fotogramma prima e va dal grossolano al fine (120 → 240 → 480 px): più precisa e anche più veloce (circa 3 secondi per il tuo b-roll).

**Migliorato**
- Intensità più efficaci: **Leggera** 0,25 s, **Media** 0,4 s, **Forte** 0,7 s di ammorbidimento. Sul tuo b-roll (misura sui fotogrammi esatti): Media toglie il **74%** del tremolio (prima circa 50%) con il 12% di ritaglio; più di così l'analisi non permette, oltre cresce solo il ritaglio. Le analisi fatte prima si rifanno da sole.
- Confronto da guardare: `Campioni/risultati-test/step5_stabilizzazione_confronto.mp4` (da sinistra: originale, Media, Forte).

---

## Sottotitoli: selezione multipla (richiesta tua)

**Nuovo**
- Nella corsia Sottotitoli si possono selezionare **più frasi**: **⌘ clic** aggiunge o toglie, **⇧ clic** seleziona fino a lì, **riquadro** trascinando nel vuoto della corsia, **⌘A** (o "Seleziona tutti" nel pannello) le seleziona tutte, **Esc** deseleziona. Anche dall'elenco "Tutte le frasi", con ⌘ o ⇧ sul tempo.
- **Spostarle insieme**: trascinando una frase selezionata si sposta tutto il gruppo, che si ferma contro le frasi non selezionate.
- **Eliminarle insieme**: ⌫ o "Elimina (N)". ⌘Z le riporta.
- **Unisci in una frase**: le frasi selezionate una dopo l'altra diventano una sola.

---

## Stabilizzazione (Step 5, parte 2)

**Nuovo**
- Clip video › scheda **Stabilizza**: interruttore **Stabilizza** e intensità **Leggera / Media / Forte / Camera ferma**. Toglie il tremolio delle riprese a mano e tiene i movimenti voluti (panoramiche, carrellate). Per non mostrare i bordi il video si ingrandisce un po': il pannello dice il **ritaglio** e quanto tremolio è stato tolto. Vale per le clip selezionate insieme.
- La prima volta MOTO **analizza il movimento del file** (barra di avanzamento; sul tuo b-roll 4K da 5,8 s circa 7 secondi) e se lo ricorda nel browser: le altre clip dello stesso file, anche in altri progetti, sono subito pronte. **Rianalizza** la rifà.
- Si vede nell'anteprima e nel video esportato, in ogni formato e insieme all'inquadratura per formato.
- **Correggi anche la rotazione** (spenta di base): utile solo per riprese che ruotano parecchio; sulle riprese normali la rotazione è minima e correggerla aggiunge tremolio.
- Se una ripresa trema troppo, la correzione si riduce per non ingrandire oltre il 50%.
- Verificato rianalizzando il video già stabilizzato (misura indipendente): tremolio tolto **29%** (leggera, ritaglio 7,8%), **64%** (media, 11,2%), **78%** (forte, 12,4%); nessun bordo scoperto in nessun fotogramma.

**Interno**
- `src/seq/stab.ts` (movimento tra fotogrammi con block matching e scarto dei punti che si muovono per conto loro, percorso ammorbidito con regressione locale, correzioni, zoom minimo) con 3 prove; `src/seq/stabscan.ts` (analisi con WebCodecs o, se il file non si decodifica così, facendo scorrere il video; memoria in IndexedDB); `drawRotated` accetta la correzione. Lo zoom della mano non si corregge: la sua misura è quasi solo rumore.

---

## Sottotitoli automatici dal parlato (Step 5, parte 1)

**Nuovo**
- **Crea i sottotitoli**: pulsante **Sottotitoli** sopra la timeline, oppure scheda **Audio › Sottotitoli** della clip con la voce. Trascrive il parlato delle parti del file che usi nella timeline, **sul tuo computer** (Whisper large-v3-turbo sulla scheda video). La prima volta scarica il modello (circa 560 MB, con la barra di avanzamento), poi resta nel browser. Lingua: italiano, inglese, spagnolo, francese, tedesco o automatica. Mentre trascrive puoi continuare a lavorare.
- **Tempi precisi**: prima trovo dove si parla, tolgo le pause, trascrivo l'audio compresso e riporto i tempi sul file; così le parole non si "allungano" nelle pause. Sul tuo `parlato in cam`: 71 parole, testo giusto, circa 35 s la prima volta compreso il download, poi circa 20 s per 30 s di audio.
- **Frasi automatiche**: si va a capo dopo i punti, sulle pause lunghe (se la frase ha già un po' di testo) e quando la frase non ci sta più, nel punto migliore (dopo una virgola, **mai dopo un articolo o una preposizione**). Le due righe si dividono in modo equilibrato con le stesse regole.
- **Corsia "Sottotitoli"** in cima alla timeline: ogni frase è un blocco da **trascinare** (sposta i tempi) o da **rifilare** dai bordi; doppio clic per correggere il testo. I sottotitoli seguono i tagli, gli spostamenti, la velocità e "Elimina pause", perché sono legati al file e non alla posizione nella timeline.
- **Scheda Testo**: la frase selezionata da correggere (con lo stesso numero di parole i tempi restano, altrimenti si ridistribuiscono), le parole come pulsanti (clic = la testina va lì, **⌥ clic = la frase si divide lì**), **Dividi alla testina**, **Unisci alla successiva**, **Elimina** (anche ⌫), frase precedente/successiva, e **Tutte le frasi** da correggere come un testo. **Esporta .srt** (per YouTube, Premiere…) e **Nascondi dal video**.
- **Scheda Stile**: come compaiono (**parola evidenziata**, **frase intera**, **parole che si aggiungono**, **una parola alla volta**), una o due righe, caratteri per riga, font, peso, dimensione, maiuscolo, colore del testo, parola detta colorata o **su un riquadro** (con colore del testo sul riquadro) e ingrandita, contorno, ombra, riquadro dietro (per riga o unico) con colore e opacità, **altezza per formato** (il 9:16 e il 16:9 si regolano a parte) e larghezza massima.
- **Stili pronti** (Reel con parola evidenziata, Pulito, Una parola alla volta, Parole che si aggiungono, Riquadro scuro) e **Salva questo stile…** per riusare i tuoi (★ nell'elenco).
- **Scheda Comparsa**: pop con rimbalzo, sale dal basso, si ingrandisce, dissolvenza o nessuna, con la durata. Nelle modalità a parole ogni parola compare quando viene detta.
- I sottotitoli si vedono nell'anteprima e finiscono nel **video esportato** (anche in "Video in più formati", ognuno con la sua altezza).

**Corretto**
- **Annulla / ripristina e apertura dei progetti perdevano parte della sequenza**: tenevano solo clip e marker, quindi sparivano le tracce aggiunte e le impostazioni del mix (ora anche i sottotitoli). Ora la sequenza resta intera.

**Interno**
- `src/subs/`: `model.ts` (parole nel tempo del file, frasi, righe, dall'audio compresso al file, posizione sulla timeline, modifiche, .srt), `style.ts` (stili), `render.ts` (disegno), `transcribe.ts` + `worker.ts` (audio a 16 kHz, compressione delle pause, Whisper in un worker con WebGPU). La timeline ha una corsia opzionale (`subs` nelle dipendenze). 7 prove nuove, 130 in tutto; parità invariata.

---

## File di progetto .moto

**Nuovo**
- **Salva** (⌘S) scrive il progetto in un file **.moto** dove vuoi; **Salva con nome…** (⇧⌘S) ne fa una copia; **Apri** (⌘O) lo riapre. Il nome del progetto è in alto accanto a MOTO (con "•" se ci sono modifiche non ancora nel file, "non salvato" se non ha ancora un file).
- Nel file c'è **tutto**: le scene di ogni clip di grafica, la sequenza, marker e impostazioni, immagini e SVG, e i **font caricati** da te (su un altro computer si reinstallano da soli). Video e audio restano nella loro cartella: nel file c'è il loro **percorso dentro la cartella collegata**.
- **Salvataggio automatico anche nel file**: dopo ogni modifica, se il browser ha già il permesso di scrivere (lo chiede la prima volta che salvi). Resta anche il salvataggio automatico nel browser.
- **Apri › Recenti**: gli ultimi progetti aperti o salvati, con quando. **Apri › Importa un preset (.json)** apre i vecchi preset come prima; **Salva › Esporta come preset** li crea ancora.
- **Ricollega i file (N)**, sopra la timeline, quando video o audio non si trovano (progetto aperto su un altro Mac o cartella spostata): scegli la cartella e i file si ritrovano dal **percorso**, anche se hai scelto la cartella sopra o quella dentro, oppure da **nome e dimensione** se sono stati spostati.
- **Corretto subito dopo (segnalato da te):** aprendo un file compariva "Progetto non leggibile": appena scelto il file chiedevo anche il permesso di scriverci, che il browser integrato non concede, e il file non si lasciava più leggere. Ora all'apertura il file si legge soltanto; il permesso di scrittura si chiede al salvataggio e, se il browser lo rifiuta, MOTO chiede di nuovo dove salvare. Un progetto recente che non si lascia più leggere apre la scelta del file nella sua cartella.
- **Corretto ancora:** il browser integrato di Claude mostra la finestra moderna per scegliere i file ma poi non lascia leggerli né scriverli. Ora MOTO se ne accorge e se lo ricorda: per aprire usa la **scelta classica dei file** (funziona ovunque) e per salvare **scarica** il file .moto; in quel browser i "Recenti" non compaiono. In Chrome e Arc si salva direttamente nel file, con i recenti e il salvataggio automatico.
- Verificato: progetto salvato, svuotato e riaperto identico in ogni campo; un font caricato viaggia dentro il file (891 KB) e su un "altro computer" senza quel font torna con il suo font.

**Interno**
- `src/project/file.ts` (formato, ricerca dei media, font per nome, recenti) con 3 prove; `media.ts`: percorso nella cartella e ricollegamento. 123 prove superate.

---

## Scheda del testo riordinata

**Migliorato**
- Con un testo selezionato le schede sono **Animazione · Testo · Stile · Posizione**, con l'**Animazione per prima** come per immagini e SVG:
  - **Animazione**: Tempi del testo (ritardo, entrata, pausa, uscita, coda), **Entrata**, **Uscita**, **Movimento continuo**;
  - **Testo**: testo, font, dimensioni… e Immagini nel testo; **Stile**: colori; **Posizione**: ancoraggio, spostamenti, scala, movimento del blocco e keyframe.
- Le sezioni sono **gruppi sempre aperti** (niente più fisarmoniche da aprire una a una).
- In Entrata e Uscita restano in vista **Effetto**, descrizione, **Scomponi** e **Curva**; sfasamento, ordine, inverti e i parametri particolari dell'effetto stanno in "Regolazioni dell'effetto", chiusa (con "Ripristina parametri"). Lo stesso per il movimento continuo. Tutta l'animazione del testo sta in una schermata.
- Il tasto K (keyframe) apre la sotto-scheda Posizione.

---

## Scheda dell'immagine riordinata

**Migliorato**
- Selezionando un'immagine (nei Livelli o sul quadro) la scheda ha tre schede come gli SVG, con l'**Animazione per prima**: **Entrata** (effetto, appare a, durata, curva; le regolazioni particolari dell'effetto chiuse), **Poi** (sparisce a, uscita), **Movimento continuo**. **Aspetto**: colore, opacità, modo (libero o sfondo pieno). **Posizione**: X, Y, larghezza o zoom, rotazione, sopra o sotto il testo. Duplica e Rimuovi in fondo.
- Con un'immagine selezionata non compare più la libreria delle immagini: resta nel testo (Proprietà › Testo, "Immagini nel testo") per inserire {1}, {2}… e caricarne di nuove; "Livello" dalla libreria seleziona subito l'immagine messa sul quadro.

---

## Anteprima: zoom, schermo intero, monitor esterno

**Nuovo**
- **Zoom dell'anteprima** (menu nell'angolo in alto a destra del quadro, come in Premiere): **Adatta**, 25%, 50%, 75%, **100%** (un pixel del video per pixel dello schermo), 150%, 200%; oltre lo spazio disponibile l'anteprima scorre e le maniglie seguono. Tasti **-** e **=** per rimpicciolire e ingrandire, **0** per Adatta.
- **Schermo intero** (pulsante accanto, o tasto **F**): solo l'anteprima, Esc per uscire. Dove il browser non lo concede (per esempio il browser integrato di Claude) l'anteprima riempie la finestra: Esc o F per tornare.
- **Anteprima in una finestra a parte** (pulsante con lo schermo): una finestra con solo il video, da portare sul **monitor esterno**; doppio clic per lo schermo intero. Se il browser permette di vedere gli schermi (Chrome e Arc lo chiedono la prima volta) la finestra va da sola sull'altro schermo. Il browser integrato di Claude blocca le finestre nuove: questa funzione va usata in Chrome o in Arc.
- Aggiunti alla finestra delle scorciatoie (?).

---

## Interfaccia riorganizzata: Livelli, Proprietà, Audio, Scena

**Migliorato**
- **Colonna Livelli** (a sinistra, accanto a **Effetti**): tutto quello che c'è nella clip di grafica aperta, come in Figma: Camera, SVG (con i **livelli del file** annidati), immagini, testi. In alto ciò che sta davanti. Clic = seleziona; **occhio** = nascondi (camera accesa/spenta); **Duplica** ed **Elimina** su ogni riga; **trascina** per riordinare (testi fra testi, SVG e immagini fra loro). In alto **+ Testo · + SVG · + Immagine** (o "+ Grafica" se non c'è una clip di grafica).
- **Pannello di destra con tre schede: Proprietà · Audio · Scena.**
  - **Proprietà segue la selezione** (nei Livelli, sul quadro o nella timeline) e mostra solo le schede di quell'oggetto: testo → **Testo · Stile · Animazione · Tempi**; SVG → le sue schede (Animazione, Livelli, Colore, Posizione); immagine → il suo livello; clip della timeline → **Clip · Quadro · Transizione**. In alto c'è scritto cosa è selezionato.
  - **Audio**: l'audio della clip selezionata (**Volume e canali**, **Ritmo e pause** con battiti ed Elimina pause) e l'**Audio della sequenza** (volume finale, limitatore, musica sotto la voce).
  - **Scena**: Camera e Stati di layout.
  - Quando una sotto-scheda ha tutte le sezioni chiuse, la prima si apre da sola.
- Barra in alto più pulita: tolti il selettore delle **aree** e la scritta "kit di animazione tipografica"; **Formato · Qualità · FPS** al centro.
- **Nessun comando perso:** confrontate, una per una, tutte le voci del pannello della versione di prima e di quella nuova (161 voci): ci sono tutte; cambiano solo i nomi delle vecchie schede in alto. I comandi dei "Blocchi di testo" (nuovo, duplica, su/giù, elimina) sono nella colonna Livelli.

---

## Nove transizioni nuove e pannello Tempo riordinato

**Nuovo**
- Transizioni in più, scelte dopo una ricerca sulle tendenze 2026 (frusta, glitch, luma, pellicola, tendine, rotazioni, effetto pellicola retrò):
  - **Frusta** (whip pan): un colpo di camera velocissimo con la scia di movimento, nelle 4 direzioni;
  - **Glitch**: fasce spostate e colori separati attorno al taglio;
  - **Luminosità** (luma fade): la seconda clip entra prima dalle zone più scure della prima; a metà transizione ne è rivelata metà;
  - **Pellicola bruciata**: dissolvenza con una luce calda arancione che si accende sul taglio;
  - **Rotazione**, **Cerchio** (si apre dal centro), **Tendina** (bordo morbido, 4 direzioni), **Pixel** (si scompone in quadratoni e si ricompone), **Fasce** (a strisce da lati alterni).
  - Il menu "Dal taglio" è diviso in **Classiche**, **Movimento** ed **Effetti**. Totale: 15 transizioni.
- Misurate tra il tuo parlato e il b-roll (luminosità attorno al taglio): tutte fanno il passaggio senza fotogrammi neri imprevisti.

**Migliorato**
- **Pannello Clip a schede**: Clip (velocità, sfondo o "Nel quadro") · Quadro (inquadratura, solo video) · Transizione (con un pallino se c'è) · Audio (volume e dissolvenze; canali, tipo, volume uniforme) · Pause o Ritmo (battiti della musica ed Elimina pause). Si vedono solo le schede che servono a quel tipo di clip; nome e tempi della clip restano in alto su una riga; le spiegazioni lunghe sono diventate suggerimenti.
- Nella scheda Tempo la **Clip** sta in cima; la sezione dei tempi del testo si chiama **Tempi del testo** e dice "nessun testo in questa clip" quando non serve; i **Blocchi di testo** non compaiono più in questa scheda.

---

## Step 4 (parte 3): transizioni sui tagli

**Nuovo**
- **Transizione** (scheda Tempo › Clip, per la clip che entra): sul taglio con la clip attaccata subito prima, sulla stessa traccia. Tipi: **Dissolvenza**, **Al nero**, **Flash** (lampo bianco sul taglio), **Zoom** (la prima clip corre verso di te, la seconda arriva da vicino, con sfocatura di movimento), **Scorrimento** (verso sinistra, destra, su, giù), **Sfocatura**.
  - **Durata** in fotogrammi, con scelte rapide 6 e 12 fotogrammi e, se la musica ha i battiti, **½ battito** e **1 battito**.
  - La transizione è **centrata sul taglio** (metà prima, metà dopo), come in Premiere: la clip che entra mostra i fotogrammi prima del suo inizio e quella che esce continua oltre la sua fine; se nel file non ci sono, resta fermo il primo o l'ultimo fotogramma. Non dura più delle due clip.
  - **Uguale su tutti i tagli della traccia** in un clic; vale anche per tutte le clip selezionate.
  - Sulla timeline un **segno sul taglio**, largo quanto la transizione; un clic apre la clip.
  - Funziona tra video, tra clip di grafica, in anteprima e nell'esportazione (anche tra due pezzi dello stesso file). Dividendo una clip o tagliando le pause, la transizione resta solo sul primo pezzo.
- Misurato tra il tuo parlato e il b-roll (luminosità dell'anteprima attorno al taglio): ogni tipo fa il passaggio previsto (al nero arriva a 0 sul taglio, il flash a 248); esportazione 9:16 con lo scorrimento in 3 s.
- Non ancora: l'audio sul taglio resta netto (niente dissolvenza incrociata del suono).

**Interno**
- `src/seq/trans.ts` (tagli, durate, allungamento delle clip, transizione in corso) con 3 prove: 120 prove superate. Test visivo invariato.

---

## Step 4 (parte 2): un progetto, più formati

**Nuovo**
- **Inquadratura per formato** dei video: ogni clip video ha un'inquadratura sua in ogni formato (16:9, 9:16, 1:1, 4:5). Con la clip selezionata nella timeline:
  - **trascina il video sul quadro** per scegliere cosa si vede (con "Riempie" si ferma al bordo: niente vuoti), **rotella** per lo zoom (dal 50% al 400%);
  - oppure, nel pannello della clip, **Inquadratura nel …** con Orizzontale, Verticale e Zoom, **Centra** e **Uguale in tutti i formati**; la nota dice per quali altri formati l'hai già scelta.
  - Cambiando formato dalla barra in alto, ogni video passa alla sua inquadratura di quel formato. Senza scelte resta centrato, come prima.
- **Esporta › Video in più formati**: scegli i formati (si ricordano; di base 16:9 e 9:16), poi una cartella; i video si fanno uno dopo l'altro, ognuno con le sue inquadrature e con la grafica ridisposta per il formato, e si salvano con il formato nel nome (`…_16x9.mp4`, `…_9x16.mp4`). Alla fine il progetto torna al formato di prima.
- Provato con il tuo parlato verticale: nel 16:9 trascinato verso il basso (si vede più in alto) e zoom al 157%; esportati 16:9 1920×1080 e 9:16 1080×1920 in 3 s.

**Interno**
- `src/seq/frame.ts` (inquadratura: punto al centro, zoom, limiti) con 2 prove: 117 prove superate. Test visivo invariato.

---

## Pannello SVG più ordinato

**Migliorato**
- **Animazione** in un menu (Effetto, Costruzione, Disegno, Dissolvenza, Ferma) invece di cinque pulsanti che andavano a capo; i pulsanti "Marchio + nome" e "+ riprese" compaiono solo nei modi dove servono (non con Effetto); il conteggio di linee e forme è nel suggerimento sul nome.
- Con **Effetto** le schede sono **Animazione · Livelli · Colore · Posizione** (Livelli solo se il file ne ha più di uno, con un pallino se qualcuno ha l'animazione propria):
  - **Animazione** in tre gruppi: **Entrata** (effetto, inizia a, durata, curva, "A pezzi"), **Poi** (resta visibile, uscita), **Movimento continuo**. Le regolazioni particolari di ogni effetto sono in "Regolazioni dell'effetto", chiusa; tolte le note lunghe.
  - **Livelli** ha la sua scheda (prima era in fondo all'animazione), con le stesse regolazioni chiuse.
  - **Colore** mostra solo il colore del logo (le linee di costruzione con Effetto non si disegnano); **Posizione** ha anche la rotazione.
- Gli altri modi restano come prima (Tempi · Aspetto · Posizione · Riprese).

---

## SVG: livelli del file con animazioni diverse

**Nuovo**
- **Livelli del file** (Grafica › SVG › animazione Effetto › Tempi, in fondo): l'elenco delle parti del file con i **nomi di Figma**. Ogni livello può avere la sua **animazione propria**: entrata, ritardo, durata, curva, parametri dell'effetto, uscita e movimento continuo. Quelli senza animazione propria seguono il logo (anche "a pezzi").
  - Esempio provato (icona con cerchio, freccia e punto): cerchio Pop subito, freccia Scorrimento da 0,5 s, punto Dissolvenza da 1 s; ognuno compare al suo momento.
  - **Clic su una parte del logo nel quadro**: si apre il suo livello nel pannello.
  - Cosa diventa un livello: un gruppo con un nome che raccoglie più forme (per esempio "freccia" con due tracciati) è un livello solo; il gruppo che contiene tutta l'icona non conta; una forma da sola usa il suo nome. Se l'icona è un unico tracciato unito, c'è un livello solo: in Figma vanno tenute separate le parti da animare.
  - L'uscita parte per tutti insieme, quando il logo ha finito di restare visibile; la clip dura quanto serve all'ultimo livello.

**Interno**
- `src/svg/layers.ts` (livelli dai gruppi, con la catena dei gruppi letta dal file) con 3 prove: 115 prove superate. Test visivo invariato.

---

## Duplicare, copiare e incollare

**Nuovo**
- **⌥ + trascina** duplica, come negli altri programmi:
  - sulla **timeline**: **appena premi** compare una copia al posto della clip presa, e la clip si trascina dove vuoi (anche più clip selezionate insieme; con ⌥ l'aggancio resta attivo). La copia fa da ostacolo: la clip trascinata si ferma accanto. Con ⌥ + clic senza muovere la copia non resta. *(Prima versione: la copia compariva solo al rilascio; cambiato su tua richiesta.)*
  - sul **quadro**: SVG, immagini e blocchi di testo; si trascina la copia, l'originale resta fermo.
- **⌘C / ⌘V**: copia e incolla. Valgono per l'ultima zona che hai toccato: dalla **timeline** si copiano le clip selezionate e si incollano **alla testina** (stesse tracce e distanze, senza sovrapporsi); dal **quadro** si copiano il livello SVG o immagine o il blocco di testo selezionato, e si incollano un poco spostati (anche in un'altra clip di grafica).
- **⌘D**: duplica la selezione (le clip subito dopo, i livelli un poco spostati, i testi come "Duplica").
- Aggiunti alla finestra delle scorciatoie (?).

---

## Step 4 (parte 1): battiti della musica

**Nuovo**
- **Trova i battiti** (scheda Tempo › clip della musica › Audio › Battiti): MOTO trova il tempo (BPM), ogni battito e il primo tempo di ogni misura da 4, e li segna sul righello: tacche sottili sui battiti, più alte sui primi tempi, con una linea leggera su tutte le tracce a ogni misura.
  - **Marker**: ogni battito, ogni 2, ogni misura, ogni 2 misure. "Togli i marker dei battiti" li toglie.
  - Tagli, clip, marker e testina **si agganciano** ai battiti (come agli altri marker; ⌥ per staccare).
  - I marker dei battiti **seguono la musica**: se sposti, tagli o rallenti la clip della musica si ricalcolano. ⇧M / ⌥⇧M saltano solo tra i tuoi marker, non tra i battiti.
- Sulla tua `magnific-feel-the-beat`: **120 BPM**, 265 battiti, 66 misure, analisi in 0,6 s. Per verificarlo a orecchio: `Campioni/risultati-test/step4_battiti_120bpm_clic.m4a` (la musica con un clic su ogni battito, più acuto sul primo tempo).
- **Corretto subito dopo (segnalato da te):** la prima versione slittava: giusta all'inizio, a metà brano anticipava di 20–50 ms, perché l'analisi lavora a passi di 11,6 ms e il brano non è esattamente al tempo trovato. Ora ogni battito si aggancia al colpo vero con precisione di circa 1 ms (dove il colpo è debole si ricava dai vicini): sul tuo brano l'energia salta esattamente sul battito dall'inizio fino a 100 s. Anche il **primo tempo** era sbagliato (cadeva sul 2, dove il rullante è più forte): ora si sceglie dove la cassa è più forte e dove cominciano le sezioni, e sul tuo brano parte da 0. Il file di ascolto è stato rifatto.

**Interno**
- `src/seq/beats.ts` (flusso spettrale, tempo per autocorrelazione, battiti con programmazione dinamica, primi tempi) con 4 prove: ritmi a 96, 120 e 140 BPM e un brano lungo a 119,7 BPM (battiti entro 12 ms fino alla fine): 112 prove superate.

---

## Corretto: gli SVG non si caricavano più

**Corretto**
- Dopo la modifica "SVG con i colori originali" nessun SVG veniva aggiunto alla scena, né da "Carica SVG", né trascinato sull'anteprima o sulla timeline: compariva l'avviso "SVG caricato" (e sulla timeline la clip nuova) ma il logo non c'era. Era un commento finito sulla stessa riga dell'istruzione che aggiunge il livello. Verificato in una scheda di prova separata: SVG trascinato sulla traccia Grafica 2 → clip nuova con il logo, visibile, e il pannello Grafica lo apre.

---

## Si può eliminare anche l'ultima clip di grafica

**Corretto**
- L'ultima clip di grafica rimasta non si poteva eliminare ("Serve almeno una clip di grafica"). Ora si elimina come le altre (⌫ o Elimina, ⌘Z per annullare): la sequenza può avere solo video e audio. "+ Grafica" (o doppio clic su una traccia Grafica, o un SVG trascinato sulla timeline) crea una clip nuova. Un progetto nuovo e vuoto parte ancora con una clip di grafica.

---

## Loghi e immagini: entrate, uscite e movimenti della libreria

**Nuovo**
- **SVG, animazione "Effetto"** (Grafica › SVG › Animazione): il logo finito entra con **le stesse 84 entrate e uscite** degli effetti di testo (Pop, Dissolvenza, Sfocatura che sale, Maschera, Scivola…), con durata, curva e parametri dell'effetto, **"Resta visibile"** per quanto rimane fermo, **uscita** con animazione o no, e **movimento continuo** (galleggia, pulsa, oscilla…).
  - **A pezzi**: ogni forma del logo entra per conto suo, con lo sfasamento e l'ordine scelti (del file, da sinistra, dall'alto, dal centro). Sul logo undef con "Sfocatura che sale" a pezzi da sinistra le lettere arrivano una dopo l'altra.
  - I colori sono quelli della scheda Aspetto (originali, colore testo, colore B o scelto), la posizione e la larghezza quelle della scheda Posizione; funziona con camera e stati di layout.
  - Un SVG **senza linee di costruzione** (un logo finito) parte già con "Effetto" e Pop; quelli con le linee restano in Costruzione.
  - **Ogni SVG** caricato parte con i **suoi colori** (Aspetto › Colore: Originale, anche per le linee di costruzione). Prima prendeva il colore del testo e su sfondo scuro diventava tutto bianco.
- **SVG e immagini trascinati sulla timeline:** su una clip di grafica si aggiungono a quella; nel vuoto di una traccia diventano una **clip di grafica nuova** in quel punto (su una traccia video o audio vanno sulla prima traccia di grafica). Prima la timeline accettava solo video e audio.
- **Immagini (PNG, JPG…)**: i livelli liberi con entrata, uscita e movimento continuo c'erano già (sezione Immagini › "Livello"). Ora la sezione Immagini sta nella scheda **Grafica** accanto agli SVG, e le immagini si **selezionano e si spostano sul quadro** con le maniglie, come gli SVG; il pannello apre il livello cliccato.

**Corretto**
- Una clip con solo immagini (senza testo) durava 1 s: ora dura quanto i suoi livelli immagine.

**Interno**
- Test visivo invariato (1.990 fotogrammi, digest `1e3f03a7`; i 1.376 dell'originale identici). 108 prove superate.

---

## Dissolvenze: curve e maniglie sulla timeline

**Nuovo**
- **Curva delle dissolvenze** (Audio della clip): **Dolce** (potenza costante, come in Premiere: a metà −3 dB, predefinita), **In decibel** (scende in modo uniforme all'orecchio: la più naturale per i finali di musica; a metà −30 dB), **Lineare** (com'era prima: a metà −6 dB). Vale per tutte le clip selezionate, in anteprima e nell'esportazione (misurato sul mix).
- **Maniglie delle dissolvenze:** quadratini bianchi negli angoli in alto delle clip audio e video (si vedono passando sopra o con la clip selezionata): si trascinano verso l'interno per allungare la dissolvenza, senza aprire il pannello.
- Sulla clip la dissolvenza si disegna con la sua curva vera (zona scura e linea), e l'onda segue la stessa forma.

---

## Onde audio nitide

**Migliorato**
- Le onde di audio e video nella timeline non sono più pixelate: si disegnano alla densità dello schermo (anche Retina), con 200 valori al secondo di audio (prima 2000 su tutto il file), ogni colonna prende il picco di tutto il suo tratto e il contorno è pieno e simmetrico. Non si stirano più dentro il bordo della clip.
- L'onda segue volume e **dissolvenze**: si vede la curva di entrata e di uscita.

---

## Step 3 (parte 2): volume uniforme, limitatore, musica sotto la voce

**Nuovo**
- **Audio della sequenza** (nuova sezione nella scheda Tempo):
  - **Volume uniforme**: il mix intero va al **volume finale** scelto, di base **−14 LUFS**, quello di Instagram, TikTok e YouTube. Il volume si misura come lo misurano le piattaforme (norma EBU R128 / ITU BS.1770: verificata con il segnale di riferimento, errore sotto 0,1 dB). Il pannello mostra il volume attuale del mix e la correzione.
  - **Limitatore**: nessun picco supera il "Picco massimo" (di base −1 dB), anche quando ridi o alzi la voce.
  - **Musica sotto la voce**: la musica scende mentre parli (di base 12 dB, discesa 0,25 s, risalita 0,6 s) e risale nelle pause più lunghe di 0,8 s.
- **Nella clip** (Audio):
  - **Tipo**: Voce, Musica o Ambiente / effetti. "Automatico" lo deduce: le clip audio sono musica, i video con il microfono (voce su un lato, traccia di sicurezza, mono) sono voce, i video con lo stereo della camera sono ambiente.
  - **Uniforma il volume del file**: prima del mix ogni file si livella (voce −16 LUFS, musica −20 LUFS), così riprese diverse suonano uguali; il pannello dice di quanto. L'ambiente resta al suo volume e non abbassa la musica.
- Vale in anteprima e nell'esportazione. Prova sul tuo parlato con una musica di prova: esportazione a −14,09 LUFS, picco −1,0 dB, musica 12 dB più bassa mentre parli e di nuovo su nelle pause; calcolo del mix 0,4 s per 32 s.

**Interno**
- `src/seq/mix.ts` (volume percepito, limitatore con anticipo, punti di abbassamento della musica) con 3 prove nuove: 108 prove superate.

---

## Step 3 (parte 2): canali audio (microfono DJI)

**Nuovo**
- **Canali** (scheda Tempo → Audio della clip): MOTO misura i due canali del file e capisce come è stato registrato.
  - **Voce su un lato solo** (ricevitore in stereo con un solo trasmettitore): la voce si copia su entrambi i lati. È il caso del tuo `parlato in cam`: sinistro −19,3 dB, destro vuoto (−68,7 dB).
  - **Traccia di sicurezza** (stessa voce più bassa sull'altro canale): si usa la principale su entrambi i lati.
  - **Mono** o **stereo vero** (microfono della camera, musica): resta com'è. Il tuo b-roll è riconosciuto come stereo vero.
- "Automatico" è la scelta di base e dice cosa ha deciso, per esempio "Automatico (solo sinistro)"; si può forzare Stereo, Solo il sinistro, Solo il destro o Mono (somma). Vale per tutte le clip selezionate.
- Quando aggiungi un file con la voce su un lato o con la traccia di sicurezza, un avviso dice cosa è stato riconosciuto.
- Vale in anteprima e nell'esportazione, anche insieme alla velocità con il tono mantenuto.

**Interno**
- `src/seq/channels.ts` (misura e preparazione dei canali) con 2 prove nuove: 105 prove superate.

---

## Velocità delle clip, tempo da scrivere, salto tra i marker

**Nuovo**
- **Velocità** (scheda Tempo, proprietà della clip): pulsanti 25% · 50% · 100% · 150% · 200% oppure qualunque valore dal 10% al 400%. Vale per **video, audio e grafica** (la grafica velocizza o rallenta la sua animazione).
  - La clip mostra sempre lo stesso pezzo di file, quindi cambia durata (al 50% dura il doppio); il nome sulla timeline dice la velocità ("broll · 50%"). Se si allunga, le clip che seguono sulla stessa traccia si spostano quanto serve.
  - Vale per **tutte le clip selezionate**: i pezzi uno dopo l'altro restano attaccati (per esempio il parlato dopo Elimina pause portato al 110%).
  - **Mantieni il tono della voce** (attivo di base): la voce più veloce o più lenta non diventa acuta o cupa. Sul tuo parlato: tono 219 Hz all'originale, 221 Hz al 125%, 211 Hz all'80%; le parole cadono dove devono (entro 0,04 s); il ricalcolo dura circa 0,1 s per 30 s di audio. Spento: l'audio cambia tono come un nastro.
  - I b-roll a 50p rallentati al 50% (in un video a 25 fps) restano fluidi: ogni fotogramma del file viene mostrato.
- **Tempo da scrivere:** clic sul tempo accanto ai pulsanti di riproduzione e scrivi dove andare, poi Invio (Esc annulla): `0:04:20` (minuti:secondi:fotogrammi), `4:20`, `420` (come in Premiere), `4,5` (secondi), `+1:00` o `-10` per spostarti rispetto a dove sei.
- **Salto tra i marker:** pulsanti **‹** e **›** accanto a "Marker" sopra la timeline, oppure **⇧M** (successivo) e **⌥⇧M** (precedente). Aggiunti alla finestra delle scorciatoie (?) insieme a M, S, C, V.

**Interno**
- Velocità nel modello della sequenza (`speed`, `setSpeed`, `unoverlap`), audio a tono costante `src/seq/stretch.ts` (WSOLA), lettura del tempo `src/core/timecode.ts`: 103 prove superate.

---

## Step 3 (parte 2): Elimina pause

**Nuovo**
- **Elimina pause** (scheda Tempo, seleziona una clip video o audio → "Elimina pause"): MOTO trova la voce nell'audio e mostra in **rosso sulla clip** le pause che taglierebbe, con il riepilogo (quante pause e quanti secondi in meno).
  - Tre tagli pronti: **Delicato** (pause oltre 0,6 s, lascia 0,25 s), **Medio** (0,35 s / 0,15 s), **Serrato** (0,25 s / 0,08 s), oppure regoli a mano "Taglia le pause oltre", "Margine attorno alle parole" e "Soglia della voce" (più alta: si tagliano anche respiri e rumori).
  - **Taglia le pause**: la clip diventa più pezzi uno dopo l'altro, che restano clip normali (si allungano, si spostano, si ritagliano). Grafica, b-roll e marker dopo i tagli si spostano indietro; la musica resta intera; sulla stessa traccia niente sovrapposizioni. ⌘Z annulla tutto in un colpo.
  - Vale per **tutte le clip selezionate**: dopo un primo taglio i pezzi restano selezionati e si può ripassare con un taglio più serrato.
  - Respiri, schiocchi e rumori brevi e isolati non contano come voce; con il microfono DJI su un solo canale la voce si legge comunque.
- Sul tuo `parlato in cam` (30,7 s): Delicato −8,2 s, **Medio −9,3 s (21,4 s, 6 pezzi)**, Serrato −10,5 s. Riproduzione sui tagli: 0 fotogrammi neri su 498 misurati.

**Interno**
- Modulo `src/seq/silence.ts` (energia ogni 10 ms, voce con soglia adattiva, parti da tenere, ricompattamento della timeline) con 5 prove nuove: 98 prove superate.

---

## Timeline: linea della lama, testina ferma, altezza regolabile

**Nuovo**
- **Linea della lama:** con la Lama (C) una **linea rossa verticale** segue il puntatore su tutte le tracce e mostra il tempo esatto (minuti:secondi:fotogrammi) dove cadrà il taglio. È agganciata come il taglio vero (testina, marker, bordi; ⌥ per staccare).
- **Altezza della timeline:** trascina il **bordo tra l'anteprima e la barra di riproduzione** per alzarla o abbassarla (anche frecce ↑ ↓ con il bordo selezionato). Se c'è spazio le tracce si allargano (fino a 2,5 volte, onde più leggibili); se è bassa le tracce **scorrono in verticale** con le loro etichette, e il righello resta in alto. Doppio clic sul bordo: torna all'altezza automatica. L'altezza si ricorda.

**Corretto**
- **Spostando una clip si spostava anche la testina:** succedeva con la clip di grafica aperta nel pannello, perché la testina era legata al suo tempo interno. Ora la testina resta ferma su qualunque clip che sposti (anche durante la riproduzione).

**Interno**
- `trackHeights` (altezze delle tracce nello spazio dato) con la sua prova: 93 prove superate.

---

## Anteprima video senza lampi neri

**Corretto**
- **Sfarfallio:** la causa vera non era solo il lettore condiviso tra due metà dello stesso video (già corretto). In pausa, ogni spostamento della testina (frecce, trascinamento, tagli) fa cercare al lettore il nuovo fotogramma; con il parlato 4:2:2 la ricerca dura circa 0,2 s e nel frattempo l'anteprima disegnava **nero**. Ora ogni lettore tiene **l'ultimo fotogramma buono** e lo mostra mentre cerca il successivo.
- **Taglio tra due clip:** il lettore della clip successiva si **prepara 1,5 s prima** (posizionato sul suo primo fotogramma); due pezzi vicini dello stesso file usano lettori diversi, così anche un salto nello stesso file è pronto.
- Verificato sui tuoi file, misurando la luminosità dell'anteprima a ogni fotogramma: **0 fotogrammi neri** in due riproduzioni complete (358 fotogrammi, con un salto nello stesso file e un cambio di file) e in 60 passi fotogramma per fotogramma sui tagli. Al cambio di file restano al massimo un paio di fotogrammi saltati (piccolo scatto, non nero).

---

## Step 3: selezione multipla, lama, audio subito, niente sfarfallio

**Nuovo**
- **Selezione multipla:** trascinando **nel vuoto delle tracce** disegni un riquadro che seleziona le clip che tocca (non sposta più la testina: la testina si sposta dal righello). **⇧ o ⌘ + clic** aggiunge o toglie una clip. Le clip selezionate **si spostano insieme** (senza sovrapporsi alle altre) e **si eliminano insieme** (⌫); "Dividi alla testina" (S) divide quelle selezionate.
- **Lama (come in Premiere):** tasto **C** (o pulsante "Lama"): un clic su una clip la **taglia in quel punto** (si aggancia a testina, marker e bordi; ⌥ per staccare). Tasto **V** (o "Selezione") per tornare a selezionare.

**Corretto**
- **Sfarfallio dopo un taglio:** le due metà dello stesso video si contendevano un unico lettore (uno lo avviava, l'altro lo fermava). Ora ogni pezzo visibile ha il suo lettore.
- **Volume e dissolvenze** in anteprima si applicavano solo al play successivo: ora l'audio si aggiorna subito, anche durante la riproduzione (e dopo spostamenti e tagli). Verificato sul mix: volume 0,25 = −12 dB, 1,39 = +2,9 dB, dissolvenze in entrata e in uscita corrette. Nell'esportazione erano già giusti.
- "Nel quadro" ora dice **Riempie (taglia i bordi)** / **Intero (con bande)**, con una nota: conta quando il video ha proporzioni diverse dal formato.

**Interno**
- Test visivo invariato.

---

## Step 3: trascinamento delle clip corretto, più tracce, file rilasciati sulla traccia

**Corretto**
- **Spostare e rifilare le clip non funzionava con il mouse:** al primo movimento la timeline si ridisegnava e il gesto si perdeva. Ora il trascinamento segue il puntatore su tutta la finestra: spostare, rifilare l'inizio e la fine, spostare i marker funzionano (verificato con il mouse vero, non simulato).

**Nuovo**
- **Più tracce:** "+ Traccia" aggiunge tracce di **Grafica**, **Video** o **Audio** (Grafica 3, Video 2, Audio 2…). Le tracce vuote in più si tolgono con la × accanto al nome. Video 2 sta sopra Video 1; la grafica sta sempre sopra i video. Le clip si spostano tra tracce dello stesso tipo trascinandole.
- **Trascinare i file dal Finder su una traccia:** il file va **su quella traccia, nel punto in cui lo rilasci** (più file uno dopo l'altro). Rilasciati altrove, vanno alla testina sulla prima traccia del loro tipo. L'accesso al file viene ricordato.
- Le tracce si chiamano ora Grafica 1/2…, Video 1/2…, Audio 1/2….

**Interno**
- `tracksOf`, `addTrack`, `removeTrack`, `firstTrack` in `seq.ts` (prova nuova; 92 in tutto).

---

## Step 3 (parte 1): timeline completa, video, audio, esportazione con audio

**Nuovo**
- **Timeline a tracce** sotto l'anteprima: **Grafica 2**, **Grafica 1**, **Video**, **Musica**, più il righello con i **marker**. Il progetto che avevi diventa la prima clip di grafica.
- **Clip di grafica:** ognuna è una scena MOTO completa (testi, SVG, camera, stati). **Cliccandola si apre nel pannello**; doppio clic su una traccia Grafica (o "+ Grafica") ne crea una nuova. La durata segue l'animazione, finché non la rifili a mano. Sopra un video la grafica non disegna lo sfondo (Sfondo: Automatico, Sempre, Mai).
- **Video e audio collegati dalla cartella:** "Media" › **Collega una cartella** (i file restano lì, MOTO li legge senza copiarli) e clic su un file per metterlo alla testina; oppure **Aggiungi file…** o **trascina i file** sulla finestra. MOTO ricorda l'accesso; a ogni nuova sessione il browser chiede un clic ("Riattiva l'accesso ai file"). I video verticali della Sony e dell'iPhone si girano da soli.
- **Montaggio:** trascini le clip per spostarle (si agganciano a clip, marker e testina; ⌥ per staccarle; le clip non si sovrappongono), trascini i **bordi per rifilare**, **Dividi** (S) alla testina, **Elimina** (⌫), **Marker** (M; trascinali, doppio clic per il nome), zoom con ⌘ + rotella, **Adatta** per vedere tutto. Le grafiche passano tra Grafica 1 e Grafica 2 trascinandole.
- **Audio:** onda disegnata nelle clip; per ogni clip video o audio **volume**, **muto**, **dissolvenza in entrata e in uscita** (sezione **Clip**, scheda Tempo); video **Riempie / Intero** nel quadro.
- **Riproduzione sincronizzata:** l'orologio dell'audio guida la testina, così voce, musica, video e grafica restano allineati.
- **Esportazione con audio:** MP4 H.264 + **AAC stereo 48 kHz** della sequenza intera, con i fotogrammi esatti dei video (decodifica WebCodecs). Prova: `Campioni/risultati-test/step3_prova_sequenza_9x16.mp4` (parlato tagliato, b-roll, logo sopra, musica con dissolvenze): 12,8 s esportati in circa 4 s.
- La striscia dei tempi sotto la timeline ora mostra i **tempi della clip di grafica attiva** (con il suo nome).

**Da sapere**
- La registrazione "in tempo reale" (quando la codifica veloce non è disponibile) esporta senza audio.
- Non ancora: elimina pause, canali del DJI, normalizzazione, abbassamento automatico della musica (parte 2).

**Interno**
- Nuovi `src/seq/seq.ts` (puro, 7 prove; 91 in tutto), `media.ts`, `audio.ts`, `vdecode.ts`, `timeline.ts`. Verificato sui tuoi file: il lettore del browser riproduce H.264 4:2:2 10-bit e HEVC 4K e applica la rotazione; il decoder dà lo stesso fotogramma (scarto medio 2/255). Test visivo degli effetti invariato.

---

## Aree di lavoro più distinte, elimina anche l'unico testo

**Migliorato**
- **Aree di lavoro:** ora sono quattro e si vede la differenza: **Completo** (tutto a vista, scheda Stile), **Testo** (prima "Motion": libreria degli effetti larga, scheda Animazione), **Grafica** (nuova: libreria chiusa, pannello largo sulla scheda Grafica, anteprima grande), **Montaggio** (libreria chiusa, scheda Tempo; diventerà l'area della timeline completa). Prima Completo e Motion differivano di pochi pixel e sembrava che il clic non facesse nulla.
- **Elimina con un solo blocco di testo:** prima il pulsante era spento; ora svuota il testo e la scena resta con la sola grafica. Senza testo, la durata della clip la danno grafica e stati di layout (non più i tempi del testo). ⌘Z per annullare.

**Interno**
- Test visivo invariato.

---

## SVG selezionabili sul quadro e "+ riprese"

**Nuovo**
- **Gli SVG si selezionano sul quadro:** un clic sull'SVG lo seleziona (il pannello passa alla scheda Grafica, sul suo livello) e mostra il riquadro con le maniglie. **Trascini** per spostarlo, **gli angoli** lo ridimensionano; tieni ⌥ per non agganciarti al centro. Esc o un clic nel vuoto deseleziona.
- **Cosa cambia dipende dalla testina:** prima dello spostamento finale modifichi la **posizione iniziale** (con un logo completo: il solo marchio); dopo, **dove arriva** (il logo completo). Con uno **stato di layout in modifica** le maniglie scrivono nello stato. Le maniglie seguono anche la camera.
- **Ordine dei clic:** gli SVG "sopra il testo" vincono sul testo; quelli "sotto" si selezionano dove non c'è testo.
- **"+ riprese"** accanto a "Marchio + nome": in un clic ricrea l'effetto con le **due riprese ravvicinate** e l'animazione che riparte a ogni stacco.

**Interno**
- Test visivo invariato.

---

## Pannello riordinato: schede Grafica e Scena

**Migliorato**
- **Due schede nuove** nel pannello di destra: **Stile · Animazione · Grafica · Scena · Tempo**. In *Grafica* gli SVG; in *Scena* Camera e Stati di layout, che valgono per tutta la scena. In queste due schede non compare il selettore dei blocchi di testo (non serve).
- **Ogni SVG ha quattro schede interne:** **Tempi · Aspetto · Posizione · Riprese**, invece di un'unica lista lunga. In cima restano l'animazione (Costruzione, Disegno, Dissolvenza, Ferma), il pulsante **Marchio + nome** e un riassunto del file (linee, marchio, naming, payoff).
- **Tempi come mini timeline:** una barra per ogni fase (Linee, Bozza, Linee via, Colore, Logo completo o Spostamento, Naming, Payoff, Fermo alla fine). Clicchi una fase e sotto compaiono solo i suoi comandi; trascinando i cursori la barra si sposta subito.
- **Aspetto** raggruppa bozza, marchio e linee di costruzione; **Posizione** distingue l'inizio e dove arriva; **Riprese** mostra ogni ripresa in una riga ("Marchio, in alto a sinistra · 0–2 s").
- **Camera:** inseguimento e camera a mano in "Altre opzioni", chiuse se non usate.
- **Stati di layout:** ogni elemento di uno stato è una riga che riassume cosa cambia ("X +18% · Y 0% · ×0.7") e si apre solo se serve, con "Come all'inizio" per azzerarlo.

**Interno**
- Nessun cambiamento al disegno: test visivo identico (1.990 frame).

---

## Step 2 (parte 3): stati di layout

**Nuovo**
- **Stati di layout** (sezione nella scheda Animazione), come lo Smart Animate di Figma: la disposizione **iniziale** è quella normale; con **Aggiungi uno stato** ne crei altre, in cui **testi, SVG e immagini** sono spostati, ridimensionati, ruotati o attenuati. A un tempo scelto la scena **passa fluida** da uno stato al successivo.
- Per ogni stato: **quando parte**, **durata del passaggio**, **curva** e **sfasamento** tra gli elementi (partono uno dopo l'altro).
- **Modifica sul quadro:** con uno stato in modifica la testina va al momento in cui lo stato è completo e **le maniglie del testo scrivono nello stato** (la disposizione iniziale non cambia). SVG e immagini si regolano con i cursori dello stato. Un nuovo stato parte dalla disposizione del precedente.
- La clip si allunga da sola fino alla fine dell'ultimo passaggio. Le inquadrature "Inquadra" della camera seguono gli elementi anche quando uno stato li sposta.
- Video di prova: `Campioni/risultati-test/step2_stati_layout_16x9.mp4` (marchio e nome che si ricompongono in tre disposizioni).

**Interno**
- Nuovo `src/states/states.ts` (funzioni pure) con 5 prove (84 in tutto). Test visivo: frame precedenti identici; base 1.990 frame con una prova di stati.

---

## Step 2 (parte 2 bis): inquadrature durante la costruzione

**Nuovo**
- **Inquadrature della camera** (sezione Grafica SVG): mentre si disegnano le linee la camera mostra una **zona del marchio da vicino**, poi **stacca netta** su un'altra zona, poi **stacca sul quadro intero** e l'animazione continua come prima. L'animazione non cambia: cambia solo dove guarda la camera.
- Le riprese si scelgono per **zona** (angoli in alto/basso a sinistra/destra, centro, marchio intero, naming, payoff), con **inizio**, **durata** e **zoom in più**. Si aggiungono o tolgono riprese.
- **Stacco netto** di serie (senza spostamenti); in alternativa un movimento morbido. Durante ogni ripresa una leggera **spinta in avanti** (regolabile, anche zero).
- Proposta di partenza: angolo in alto a sinistra, poi in basso a destra, mentre si disegnano le linee.
- **Riprese più lunghe** (2 s ciascuna di serie) e, **a ogni stacco l'animazione riparte da capo**: nella prima ripresa, nella seconda e di nuovo sul quadro intero si vede l'animazione dall'inizio (interruttore "A ogni stacco l'animazione riparte da capo"; spento, l'animazione scorre senza ripartire).
- Video di prova: `Campioni/risultati-test/step2_undef_inquadrature_16x9.mp4` (12,7 s).

**Tolto**
- La prova "camera che segue la punta delle linee" non è stata tenuta (non convinceva). Nella sezione Camera tolta anche la partenza rapida "Segui la penna" (l'inseguimento resta disponibile a mano).

**Interno**
- `shotPhase` (puro, con prova), `areaBox`, `svgShotsCam`; 79 prove. Test visivo: frame precedenti identici; base 1.980 frame con una prova di inquadrature a stacco.

---

## Step 2 (parte 2): camera 2D

**Nuovo**
- **Camera** (nuova sezione, scheda Animazione): inquadra la scena come una telecamera. **Lo sfondo resta fermo**, testo e grafica si muovono.
- **Keyframe della camera:** tempo, centro (X, Y), **zoom**, **rotazione** e curva per arrivarci. "Aggiungi keyframe alla testina" prende l'inquadratura di quel momento; "Vai qui" porta la testina sul keyframe.
- **Keyframe "Inquadra":** invece dei numeri scegli cosa inquadrare (**marchio**, **naming**, **payoff**, **tutto l'SVG** o un **testo**) e il margine: la camera calcola da sola centro e zoom, anche se l'elemento si sta muovendo.
- **Segui un elemento:** per un tratto di tempo la camera segue un elemento con zoom e **morbidezza**, con entrata e uscita graduali. Con un SVG in costruzione si può seguire **la penna che disegna** (la media delle punte delle linee che si stanno tracciando).
- **Camera a mano:** tremolio leggero (ampiezza, velocità, rotazione), sempre uguale a ogni esportazione.
- **Partenze rapide:** Zoom lento, Avvicinati e torna.
- Lo zoom tra due inquadrature è uniforme (si avvicina sempre alla stessa velocità) e non "sbanda" di lato.
- **Maniglie e clic sul testo** seguono la camera: con lo zoom il riquadro resta sopra il testo e trascinare sposta il testo della quantità giusta.
- Video di prova: `Campioni/risultati-test/step2_undef_camera_16x9.mp4` (la camera segue la penna, poi si allarga sul logo completo).

**Interno**
- Nuovo `src/camera/camera.ts` (funzioni pure) con 8 prove (78 in tutto). Negli SVG: punti campionati lungo i tracciati, `svgPenTip`, `svgPartBox`.
- Test visivo: originale e frame precedenti identici; nuova base di 1.970 frame con due situazioni di camera (keyframe con rotazione e tremolio; inquadra + segui la penna).

---

## Step 2: colori di linee e bozza

**Nuovo**
- **Colore delle linee** di costruzione: oltre a colore del testo, colore B e originale, ora anche **un colore scelto** a piacere (con la sua opacità).
- **Colore della bozza:** il colore del marchio appena costruito, prima del colore vero (prima era un grigio fisso), con la sua **opacità**.
- **Colore finale del marchio:** anche qui un colore scelto, oltre a quelli del progetto e del file.

**Migliorato**
- La bozza ora è sempre un colore a sé che sfuma nel colore finale, anche senza logo completo (prima era il colore finale più trasparente).

**Interno**
- Test visivo: originale e frame precedenti identici, tranne le due prove SVG in costruzione (cambia la bozza, voluto); base aggiornata (1.950 frame).

---

## Step 2 (parte 1 bis): logo completo con naming e payoff

**Nuovo**
- **Logo completo da un solo file:** se l'SVG ha i gruppi `marchio`, `naming` e `payoff` (più `linee`/`cerchi` per la costruzione), MOTO usa **le posizioni e le distanze del file**: niente misure inventate. Provato con il logo undef (`Group 166.svg`).
- **"Marchio + nome" con il logo completo:** il marchio si costruisce grande al centro (linee, bozza **grigia**, riempimento nel suo colore), poi l'inquadratura **si allarga sulla composizione intera** (zoom morbido) e **naming** e **payoff** entrano uno dopo l'altro, da sinistra a destra. Usa i **colori del file** e, se il naming si leggerebbe male sullo sfondo, mette uno sfondo chiaro o scuro. Il blocco di testo viene svuotato (il nome è nell'SVG). ⌘Z per annullare.
- **Entrate di naming e payoff**, ognuna con tempo, durata e sfasamento delle lettere: **Dal basso** (salgono da una maschera), **Tendina**, **Disegnato** (contorno e poi riempimento), **Dissolvenza**. Più **Resta fermo alla fine**.
- Nel pannello, con un logo completo, Posizione/Larghezza dicono "Marchio" (inquadratura iniziale) e "Logo completo" (finale).
- Le linee guida che partono da un bordo del file si allungano fino ai bordi del quadro (prima solo se toccavano due bordi).
- Un contorno senza riempimento dello stesso colore delle linee guida è considerato costruzione anche se sta nel gruppo del marchio (si ritira con le linee).
- Esportando senza testo, il nome del file è quello dell'SVG.
- Video di prova: `Campioni/risultati-test/step2_undef_logo_16x9.mp4` e `step2_undef_logo_9x16.mp4` (8,7 s).

**Da sapere**
- In 9:16 il logo orizzontale viene piccolo (è largo 2,5 volte l'altezza): per i reel conviene una versione verticale del logo, con gli stessi nomi dei gruppi.

**Interno**
- `partOf`, `enterState`, `unionBox`; 70 prove. Test visivo: frame precedenti identici (originale 1.376, v2 1.940); nuova base 1.950 con un logo completo di prova, stabile su due esecuzioni.

---

## Step 2 (parte 1): grafica SVG e costruzione del marchio

**Nuovo**
- **Grafica SVG** (nuova sezione, scheda Animazione): carichi un SVG con il pulsante, **trascinandolo sull'anteprima** o **incollandolo** (in Figma: tasto destro › Copia come › Copia come SVG, poi ⌘V in MOTO). MOTO riconosce da solo **linee di costruzione** (linee, cerchi, raccordi, contorni) e **marchio** (forme piene). Se in Figma attivi "Includi attributo id" nell'esportazione, valgono i nomi dei livelli (per esempio "costruzione", "logo").
- **Quattro animazioni:** **Costruzione** (le linee si disegnano una dopo l'altra, il marchio compare in **bozza** in un tono chiaro, le linee **si ritirano** o svaniscono, il marchio **si riempie**), **Disegno** (ogni tracciato si disegna e le forme si riempiono appena il contorno è chiuso: per loghi e icone senza costruzione), **Dissolvenza**, **Ferma**. Tutti i tempi sono regolabili (partenza, durata, sfasamento di ogni fase).
- **Linee fino ai bordi del quadro:** le linee guida che nel file vanno da un bordo all'altro attraversano tutto il quadro, come in un foglio di costruzione.
- **Spostamento finale:** il marchio si sposta e cambia dimensione (posizione e larghezza finali, curva) per fare spazio al nome.
- **Marchio + nome** (un pulsante): costruzione grande al centro, poi il marchio si sposta e il nome entra **accanto** (16:9, 1:1) o **sotto** (9:16, 4:5), con proporzioni da logotipo (altezza delle maiuscole circa metà del marchio). Imposta anche ritardo ed entrata del testo. ⌘Z per annullare.
- **Colori:** marchio e costruzione possono usare il colore del testo, il colore B o i colori originali del file; tono della bozza, opacità e spessore delle linee regolabili. Posizione, larghezza, opacità, inizio e livello (sopra/sotto il testo).
- La clip si allunga da sola per contenere tutta l'animazione dell'SVG.
- Video di prova: `Campioni/risultati-test/step2_marchio_nome_16x9.mp4` (il tuo marchio, 8 s).

**Limiti per ora**
- Gradienti resi con il loro primo colore; maschere, ritagli, ombre, testo e immagini dentro l'SVG ignorati (la sezione lo segnala).
- Niente maniglie sul quadro per gli SVG (si regolano dal pannello) e niente keyframe liberi: arrivano con la camera e la timeline.

**Interno**
- Nuovi `src/svg/geom.ts`, `anim.ts`, `parse.ts`, `render.ts`; 9 prove (69 in tutto).
- Test visivo: 1.376 frame dell'originale e 1.920 del salvataggio precedente **identici**; nuova base di 1.940 frame con due situazioni SVG (costruzione con spostamento, disegno con colori originali), verificata stabile dopo un ricaricamento.

---

## Step 1 (quater): testo su tracciato, passaggio rallentato, Esporta a destra

**Nuovo**
- **Testo su tracciato** (nuova sezione della libreria, 10 voci): il testo si dispone **lungo una forma** e può **camminarci sopra**. Forme: **Arco** (verso l'alto o il basso, fino a 360°), **Cerchio** (anche ellisse; con dimensione 100% il testo fa un giro intero), **Onda**, **Zigzag** (con morbidezza), **Spirale**, **Ricci**, **Otto** (infinito), **Cuore**, **Capsula**. Per ognuna: **Cammino** (velocità in lunghezze al secondo, anche all'indietro, anche avanti e indietro), **Partenza**, **Rotazione delle lettere** (da "dritte" a "seguono la curva"), **Rotazione del tracciato**, **Rovescia sopra/sotto**, **Ripetizioni della parola** con separatore. Il testo si piega davvero lettera per lettera (anche con parole, righe o tutto il testo insieme) e il blocco resta dov'è: le maniglie lavorano sul riquadro del testo disteso.
- **Entrate "Cammina"** (categoria "Su tracciato", 4 effetti): **Cammina** (le lettere entrano in fila lungo la forma, la lettera di testa per prima), **Si apre sul tracciato** (partono tutte dallo stesso punto e si distribuiscono), **Rotola** (arrivano rotolando come ruote), **Salta lungo il tracciato** (a saltelli). In uscita l'effetto si ripete al contrario. Scegliendo una forma, MOTO imposta da solo l'entrata "Cammina", l'uscita a specchio e il movimento sempre attivo (⌘Z per annullare). Anche gli effetti che spostano le lettere in orizzontale (scorrimento, scala…) ora **percorrono la forma**; quelli verticali diventano spostamenti rispetto al tracciato.
- **Passaggio rallentato**: la parola **si ripete** e attraversa il tracciato: **entra veloce, rallenta a metà** (quando si legge) **e riparte veloce per uscire**. Regolabili: forma, ripetizioni, separatore, distanza percorsa, quanto rallentare al centro, numero di passaggi nella clip, verso. Dura quanto la clip (allunga la "Pausa" per un passaggio più lento).
- **Esporta a destra:** Esporta sta all'estremità destra dell'intestazione. Se la finestra è larga (da circa 1760 px) è sulla stessa riga di tutto il resto; altrimenti l'intestazione va su due righe: sopra tutto com'era (con Nuovo / Apri / Salva a destra), sotto i pulsanti dei pannelli e della tastiera **a sinistra** ed **Esporta a destra**, sotto Salva.

**Migliorato**
- La categoria "Traiettorie" (lettere che volano lungo una curva) è stata rinominata **"Voli curvi"**: gli effetti restano uguali e i progetti salvati continuano a funzionare. Il vecchio "Testo ad arco" ora si chiama **"Arco semplice"** (rigido, lettera per lettera) e rimanda al nuovo "Testo su arco".
- Con il testo su tracciato le tendine (maschere) e le rivelazioni seguono la curva. Non la seguono: frammenti, strisce, rullo, barre, sottolineatura.

**Interno**
- Nuovo `src/effects/textpath.ts` (forme, campionamento a passo costante, cammino, passaggio, ripetizione), 12 prove (60 in tutto).
- Motore: `drawChars` disegna ogni carattere sul tracciato (matrice per carattere), `drawUnit` piega i ritagli, `layout()` ripete la parola; nuovo `G.tot` (durata della clip) e `G.blk` (matrice del blocco).
- Test visivo: 1.376 frame dell'originale e i 1.760 del salvataggio precedente restano **identici**; nuova base di 1.920 frame (`tests/parity/baseline-v2.json`) con 4 situazioni nuove (tendine, tendina diagonale, bagliore con contorno, cammino in pausa su tracciato). La base precedente era stata registrata un attimo prima di una modifica ai valori iniziali: ricreata e verificata stabile su tre esecuzioni.

---

## Step 1 (ter): traiettorie e Scala (5dc666c)

**Nuovo**
- **Nuova categoria "Traiettorie"** (poi rinominata "Voli curvi") con 5 effetti di entrata/uscita in cui il testo arriva (o se ne va) lungo una curva: **Arco**, **Onda**, **Cerchio** (uno o più giri, come un anello), **Curva a S**, **Zigzag**. Si può scegliere la **provenienza** (da sinistra, da destra, dall'alto, dal basso, le quattro diagonali, alternata, casuale) oppure un **angolo libero** di marcia. Regolabili distanza, curvatura/ampiezza/raggio (in % del quadro, così si vede sempre il movimento), numero di onde o giri, "segue la curva" (le lettere ruotano lungo il percorso), "alterna il lato" e dissolvenza. Funzionano su lettere, parole, righe o tutto il testo insieme (per far attraversare il quadro a un titolo intero). In uscita, "Specchio" li ripete al contrario; con "Altra" puoi usare una forma diversa per l'uscita.
- **Scala del blocco** (sezione Posizione, "Scala", da 0,05× a 6×): ridimensiona tutto il testo come in un programma di grafica, in ogni modalità di movimento, e si salva per blocco.
- **Maniglie: la Scala funziona sempre.** Prima i quattro angoli cambiavano "Larghezza" o "Dimensione" e con "Adatta al formato" si fermavano al limite dell'altezza; ora trascinando un angolo cambia la **Scala** (e il cursore nel pannello). Con i keyframe cambia la scala del keyframe alla testina.
- **Etichetta durante il trascinamento:** "Scala 117%" mentre ridimensioni, "X 9,6% · Y 5,7%" mentre sposti.

**Interno**
- Nuovo `src/effects/paths.ts` (forme delle traiettorie, funzioni pure) con 8 prove. 48 prove automatiche in tutto.
- Effetti esistenti identici all'originale (1.376 frame) e al salvataggio precedente (1.660); nuova base di 1.760 frame (`tests/parity/baseline-v2.json`).

---

## Step 1: nuovi effetti di testo e selezione sul quadro (90ce1f1)

**Nuovo**
- **Righe scorrevoli** (nel Movimento continuo): il testo si ripete su più righe che scorrono **in senso opposto**, con **angolo regolabile**. Impostazioni: numero di righe (1–24), separatore (spazio, punto, trattino, barra, stella), velocità, direzioni (opposte / tutte a destra / tutte a sinistra), variazione di velocità tra le righe, angolo, rotazione continua, righe alterne **a contorno** o attenuate. Scrivendo più righe di testo, si alternano. Scegliendolo, MOTO imposta da solo "adatta al formato", l'entrata "Righe opposte" e il movimento sempre attivo (⌘Z per annullare).
- **Nuova categoria "Cinetica"** con 12 effetti di entrata/uscita: **Righe opposte** (le righe entrano da lati opposti, anche in diagonale), **Tendine opposte**, **Rivelazione diagonale**, **Scossa che si calma**, **Rullo orizzontale**, **Piega**, **Impulso ritmico**, **Taglio con flash** (per sottotitoli), **Sottolineatura** (la linea si disegna sotto il testo e resta), **Contorno disegnato** (il contorno si traccia e poi si riempie), **Giro sfocato**, **Bagliore** (il testo si accende con un alone). Ispirati ai preset di Jitter (Text Extrusion, Blurry Text Spin…) e alle tendenze di motion design (3D, riflettori, bagliori).
- **11 nuovi movimenti continui** (con le Righe scorrevoli): **Rimbalzo continuo**, **Oscillazione 3D**, **Pulsazione a ritmo** (battiti al minuto, per la musica), **Scintillio colore**, **Testo ad arco** (curvatura e ondeggiamento), **Riflettore** (un fascio di luce accende le lettere e attenua le altre), **Alone luminoso** (bagliore che pulsa), **Aberrazione continua** (canali RGB che si separano), **Gelatina continua**, **Estrusione 3D** (spessore solido con angolo che può girare).
- **Maniglie anche con il movimento attivo:** se il blocco ha **keyframe**, trascinare (o ridimensionare) crea o modifica il keyframe alla testina, senza toccare gli altri; con **movimento libero** o **traiettoria** sposta l'intero percorso. Prima il riquadro diventava tratteggiato e non si poteva spostare.
- **Selezione sul quadro:** un clic sul testo lo seleziona e mostra le maniglie (si può trascinare con lo stesso gesto); un clic nel vuoto dell'anteprima o fuori dal quadro, oppure **Esc**, deseleziona tutto (anche il keyframe selezionato). I clic nei pannelli non deselezionano, così puoi modificare le proprietà. Con un campo di testo attivo, il primo Esc esce dal campo.

**Corretto**
- Le icone per chiudere i pannelli erano scure su sfondo scuro: ora sono chiare (e più tenui quando il pannello è chiuso).
- Il numero degli effetti di entrata/uscita prima del lavoro era 63 (non 61 come scritto in precedenza): ora sono 80, più 20 movimenti continui.

**Dietro le quinte**
- Nuovo `src/effects/marquee.ts` (calcolo delle righe e dello scorrimento senza salti), con 7 prove. Nel motore: ganci `xf` (trasformazione del blocco), tendina diagonale e rullo orizzontale; il layout accetta righe generate dal movimento.
- 40 prove automatiche. Il test visivo sugli effetti esistenti è identico all'originale (1.376 frame); seconda base con i nuovi effetti (`tests/parity/baseline-v2.json`, 1.660 frame).
- Nuove capacità di disegno: bagliore (ombra con sfocatura), estrusione a copie, tratteggio progressivo del contorno, sottolineatura disegnata dopo il testo; gli effetti conoscono la larghezza del blocco (`G.bw`).
- Solo con il server di sviluppo: i test possono intercettare i salvataggi (usato per creare i video di prova).

---

## Fase 0b, parte 2: layout e strumenti di lavoro (c5c767b)

**Nuovo**
- **Proprietà a schede:** il pannello di destra è diviso in **Stile** (Testo, Colore, Posizione, Immagini), **Animazione** (Entrata, Uscita, Movimento continuo) e **Tempo**. Il selettore dei blocchi di testo resta sempre in cima e, anche da chiuso, mostra il blocco attivo. Cliccando un effetto la scheda giusta si apre da sola. La scheda scelta si ricorda.
- **Aree di lavoro:** un selettore in alto (**Completo**, **Motion**, **Montaggio**) che sistema pannelli e scheda in un colpo solo. *Completo*: tutto a vista. *Motion*: libreria larga e scheda Animazione. *Montaggio*: libreria chiusa e scheda Tempo. L'area scelta si ricorda. *Sottotitoli* e *Audio* arrivano insieme alle rispettive funzioni.
- **Pannelli ridimensionabili:** trascini il bordo della libreria o delle proprietà per allargarli; trascinando quasi a zero si chiudono; doppio clic sul bordo li chiude o li riapre. Larghezze ricordate. L'anteprima non scende sotto una larghezza minima.
- **Mostra/nascondi i pannelli** dai due pulsanti in alto, o con i tasti **[** e **]**.
- **Maniglie sul quadro:** il testo ha un riquadro con quattro angoli. Trascini il riquadro per **spostarlo** (si aggancia al centro del quadro, con linee guida; tieni ⌥ per non agganciare) e trascini un angolo per **ridimensionarlo**. I cursori del pannello (Spost. X/Y, Larghezza o Dimensione) si aggiornano insieme e **Annulla** funziona. Se il blocco si muove da solo (movimento libero, traiettoria, keyframe) il riquadro è tratteggiato e non si può trascinare. Interruttore "Maniglie" sotto l'anteprima e tasto **H**.
- **Palette di colori:** nella sezione Colore, sei palette di partenza (MOTO, Carta e inchiostro, Notte elettrica, Menta, Mono chiaro, Sabbia) e **le tue**: "Salva palette" salva testo, colore B e sfondo con un nome. **Stella** per metterle tra i preferiti (vanno in cima), × per eliminare le tue. La palette in uso è evidenziata.
- **Da ⌘K:** "Area di lavoro: …", mostra/nascondi libreria, proprietà e maniglie, scheda Stile/Animazione/Tempo.

**Migliorato**
- La copia di sicurezza delle preferenze ora comprende anche larghezze dei pannelli, area di lavoro, scheda attiva, maniglie e palette.
- Nel pannello i bordi tra le aree sono una sola linea sottile, come prima, ma trascinabile.

**Dietro le quinte**
- Nuovi moduli `src/ui/layout.ts`, `palettes.ts`, `handles.ts`; `prefs.ts` ricorda anche valori dell'interfaccia e dati personali.
- 33 prove automatiche (erano 17). Il test visivo sui 1.376 frame resta identico all'originale.
- Non verificato: il layout a colonna singola degli schermi molto stretti (sotto 860 px).

---

## Fase 0b, parte 1: preferiti, ricerca e sezioni chiuse (2d4fd21)

**Nuovo**
- **Preferiti sugli effetti:** una stella su ogni effetto di entrata, uscita e movimento continuo. I preferiti stanno in una sezione "Preferiti" in cima alla libreria.
- **Recenti:** gli ultimi effetti usati compaiono in una sezione "Recenti" in cima alla libreria.
- **Filtro "solo preferiti"** accanto alla ricerca degli effetti.
- **Ricerca ovunque (⌘K):** effetti, comandi (esporta, salva, formati, guide…), font, sezioni del pannello e blocchi di testo. Pulsante "Cerca" nell'intestazione.
- **Selettori con ricerca, preferiti e recenti** nei menu di effetto, movimento continuo, curve di animazione e font. Ogni font è scritto con il proprio carattere.
- **Libreria dei font personali:** i font caricati restano salvati nel browser e tornano alla prossima apertura; si possono rimuovere dalla libreria.
- **Copia di sicurezza dei preferiti** (da ⌘K): salva e ripristina i preferiti su file.

**Migliorato**
- **Sezioni chiuse di default:** tutte le sezioni del pannello di destra e le categorie degli effetti partono chiuse, e MOTO ricorda quali apri.
- La ricerca degli effetti apre da sola le categorie con risultati e poi ripristina lo stato di prima.

**Dietro le quinte**
- Nuovi moduli `src/ui/` (preferenze, selettore, stella, ricerca ovunque, libreria font). 17 prove automatiche. Il test visivo sui 1.376 frame resta identico all'originale.

---

## Avvio più robusto (89dc435)

**Corretto**
- L'app non si apriva se il server non era acceso o la porta era occupata: `Avvia MOTO.command` ora aspetta che il server sia pronto, riconosce se MOTO è già acceso, segnala la porta occupata e apre `http://localhost:5173`.

---

## Fase 0: fondamenta (1479692)

**Nuovo**
- **Modello dati per le funzioni future:** progetto → scene → livelli (testo, SVG, immagine, video, audio, forme di costruzione, cursore, gruppo), camera, stati di layout, template con slot, marker sui tempi. Con controllo di coerenza e importazione dei preset di MOTO v1.
- **Avvio a doppio clic** (`Avvia MOTO.command`) e comandi `npm run dev`, `npm test`, `npm run build`.

**Interno**
- Codice riorganizzato in moduli TypeScript (effetti, matematica, curve, font) invece di un unico file.
- **Test di parità visiva:** confronta 1.376 frame (tutti gli effetti, i loop, il movimento del blocco, vari stili) con l'originale: identici.
- Documentazione: `README.md`, `ARCHITETTURA.md`.

---

## Avvio del progetto (bfb06c9, 52f8d29)

- Copia di partenza identica a `training-motion-main` (l'originale non si tocca mai).
- **Nuovo:** etichetta **v2 beta** accanto al nome, con lo stesso design.
