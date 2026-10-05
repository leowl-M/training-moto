# Architettura di MOTO v2 beta

## Struttura

```
src/
  core/        matematica, numeri casuali ripetibili (hash con seed), easing, font, utilità DOM
  effects/     libreria effetti: params, physics, hooks, transitions (entrata/uscita), loops (movimento continuo)
  model/       modello dati: Progetto → Scene → Livelli (solo tipi + creazione, controllo, migrazione da v1)
  ui/          componenti dell'interfaccia: preferiti e sezioni aperte (prefs), selettore con ricerca (picker), stella, ricerca ovunque (cmdk), libreria font (fontstore), pannelli e aree di lavoro (layout), palette (palettes), maniglie sul quadro (handles)
  legacy/      il resto dell'app originale (stato, layout, rendering, interfaccia, timeline, esportazione), invariato
  main.ts      punto d'ingresso
tests/         prove del modello (node --test) e test di parità visiva con l'originale
```

`legacy/` si svuota man mano: ogni fase sposta in moduli tipizzati la parte che tocca.

## Principi

- **Il rendering è una funzione pura**: `renderFrame(ctx, stato, layout, t, …)` produce sempre lo stesso frame per lo stesso `t`.
  Il casuale deriva da un hash con seed. Per questo l'esportazione è esatta e si può testare confrontando i frame.
- **Gli effetti sono dati**: ogni effetto dichiara parametri (che generano da soli il pannello) e una funzione `f(s, p, u, o)`
  che modifica lo stato di un'unità (lettera, parola, riga, tutto). `p` va da 0 (nascosto) a 1 (a riposo).
- **Tempi in secondi, posizioni in % del quadro**: un progetto vale per ogni formato.
- **Valori animabili**: un numero fisso oppure un elenco di keyframe (`Animated<T>`).

## Aggiungere un effetto di entrata

In `src/effects/transitions.ts`, nell'array `FX`:

```ts
{ id:'esempio', n:'Esempio', c:'Movimento', d:'Descrizione breve.',
  rec:{ split:'char', stagger:.4, ease:'outCubic' },          // valori consigliati
  p:[ rng('dist','Distanza',0,6,.7,.01,'em'), bool('fade','Dissolvenza',true) ],   // parametri → pannello
  f(s,p,u,o){ const q=1-p; s.y+=o.dist*G.E*q; if(o.fade) s.op*=clamp(p) } }
```

Poi si verifica con il test di parità (nessun effetto esistente deve cambiare).

I **voli curvi** (`effects/paths.ts`, categoria "Voli curvi") sono funzioni pure: `pathPoint` dà la posizione sul percorso con due assi locali (lungo la marcia e di traverso); l'effetto le traduce in pixel usando le dimensioni del quadro (`G.W`, `G.H`), quindi distanza e curvatura sono in % del quadro.
Il **testo su tracciato** (`effects/textpath.ts`) piega il testo su una forma (arco, cerchio, onda, zigzag, spirale, ricci, otto, cuore, capsula). `buildTable` campiona la forma a passo costante (con cache), `sampleTable` dà punto e direzione a una distanza `s` (le forme aperte proseguono dritte, quelle chiuse e periodiche si ripetono), `warpAt` porta un punto (X, Y) del testo disteso sul tracciato (X = distanza lungo il tracciato più lo scorrimento, Y = distanza dal tracciato). I movimenti continui con `c: 'Tracciato'` impostano `s.pth` (tracciato, scorrimento, quanto è piegato); `drawChars` disegna ogni carattere sul tracciato (`pathFrame`) e `drawUnit` piega anche i ritagli rettangolari delle tendine (`warpRect`). Poiché lo scorrimento in orizzontale diventa un cammino lungo la forma, gli effetti "Cammina" (categoria "Su tracciato") sono semplici scivolamenti. `passOffset` dà il cammino a passaggio (veloce, lento a metà, veloce) sull'intera durata della clip (`G.tot`); `repeatLines` ripete la parola nel layout (`tpRep` in `layout()`). Frammenti, strisce, rullo e barre non seguono la forma (vengono ignorati con `s.pth`).
La **scala** del blocco è `S.bscale` (per blocco, in `TEXTK`): `blockXf` la moltiplica a ogni modalità di movimento; le maniglie la modificano.

Un effetto continuo (`LOOPS`) può anche avere `xf(ctx, o, t, env)`, che trasforma l'intero blocco prima di disegnare le unità (le righe scorrevoli lo usano per l'angolo),
e parametri con `layout: true` quando cambiano la disposizione del testo (il pannello ricalcola il layout). Le righe scorrevoli costruiscono le righe in `layout()` tramite `effects/marquee.ts`.

## Grafica SVG (src/svg)

Livelli `S.layers` con `kind: 'svg'` (accanto ai livelli immagine), con il testo dell'SVG dentro il livello (`src`).
- `parse.ts` (serve il browser): monta l'SVG fuori dallo schermo per un istante e ne ricava ogni tracciato con stile calcolato (riempimento, contorno, opacità dei gruppi), trasformazione, lunghezza e riquadro; i risultati sono ricordati per testo (`svgDoc`).
- `geom.ts` (puro): forme → tracciati, riconoscimento di linee dritte e cerchi, tipo (`line`, `circle`, `dot`, `shape`, `outline`) e ruolo (`guide` = costruzione, `mark` = marchio; i nomi dei livelli di Figma, se presenti, hanno la precedenza), linee allungate fino ai bordi del quadro.
- `anim.ts` (puro): coreografia in funzione del tempo. Modi: `build` (le linee si disegnano, bozza del marchio, le linee si ritirano o svaniscono, riempimento pieno), `draw` (ogni tracciato si disegna e le forme si riempiono a contorno chiuso), `fade`, `none`; più lo spostamento finale.
- `render.ts`: disegno sul canvas (tratteggio progressivo per il disegno dei tracciati), livello nuovo (`mkSvgLayer`) e durata (`svgEnd`, usata da `clipTotal`).
Logo completo (`lock`): se i gruppi si chiamano naming/payoff (`partOf`) l'inquadratura va dal riquadro del solo marchio a quello dell'intero documento (`svgPlace`, zoom geometrico) e naming e payoff entrano con `enterState` (dal basso con maschera, tendina, disegnati, dissolvenza), da sinistra a destra. Le distanze sono quelle del file perché tutto resta nello stesso sistema di coordinate.
Nel motore: `drawLayers` disegna i livelli SVG, l'ispettore ha la sezione "Grafica SVG" (scheda Animazione) e il pulsante "Marchio + nome" compone marchio e testo in base al formato.

## Camera 2D (src/camera)

`S.cam` (globale, come formato e livelli): `camPose(cam, t, W, H, resolve, ease)` dà la posa (punto al centro del quadro in %, zoom, rotazione) da keyframe liberi o "inquadra" (riquadro con margine, `fitPose`), mescolati con l'inseguimento di un punto (media pesata negli istanti precedenti: ripetibile, niente stato) e con un tremolio a sinusoidi fisse. Lo zoom si interpola in modo geometrico e il centro segue lo zoom (`mixPose`). Il motore risolve i target con `camResolver`: `block:<i>`, `svg:<id>:<mark|naming|payoff|all>` (`svgPartBox`) e `pen:<id>` (`svgPenTip`: media delle punte dei tracciati che si stanno disegnando, dai punti campionati in `parse.ts`). Ogni livello SVG può avere delle **inquadrature** (`L.shots`): riprese ravvicinate su zone del disegno (`areaBox`: angoli e centro del marchio, marchio, naming, payoff) con stacchi netti (`shotPhase`, `svgShotsCam`), mescolate alla camera del progetto in `camAt`. In `renderFrame` la matrice (`camMatrix`) avvolge livelli e testo; sfondo e guide restano fermi. Maniglie e clic sul quadro passano per la camera (`camDelta`, `camInv`).

## Stati di layout (src/states)

`S.states` (globale): la disposizione iniziale sono le proprietà normali; ogni stato (`at`, `dur`, `ease`, `stag`) dà a ogni elemento uno spostamento rispetto a quella (`dx`, `dy` in % del quadro, scala, rotazione, opacità). `stateDelta` calcola la disposizione all'istante t passando da uno stato al successivo (scala geometrica, sfasamento nell'ordine di `elemKeys`). Il motore la applica ai testi (`blockXfS`, anche per maniglie, clic e camera), agli SVG (`drawSvg(..., sd)`) e alle immagini. In "Modifica sul quadro" le maniglie scrivono nello stato invece che nelle proprietà normali.

## Sequenza (src/seq)

Il progetto è una **sequenza** (`S.seq`: clip su tracce Grafica 2, Grafica 1, Video, Musica, più marker). `S` resta la scena della **clip di grafica attiva** (quella nel pannello); le altre clip di grafica tengono la loro scena in `clip.scene` e `activateClip` le scambia (le chiavi di progetto `PROJK` — formato, fps, sequenza, file, immagini — non fanno parte delle scene). Il tempo `t` resta quello locale della clip attiva; il tempo globale è `TG() = t + start − inp`.
- `seq.ts` (puro): tagli, rifilature, aggancio, posizionamento senza sovrapposizioni, volumi con dissolvenze, picchi dell'onda.
- `media.ts`: file collegati con il File System Access (handle ricordati in IndexedDB, riattivazione con un clic), lettori `<video>` per l'anteprima, audio decodificato e onde.
- `audio.ts`: riproduzione con WebAudio (l'orologio dell'audio guida la testina), mix con OfflineAudioContext, codifica AAC.
- `vdecode.ts`: fotogrammi esatti per l'esportazione con WebCodecs + mp4box.js (caricato al bisogno), rotazione letta dalla matrice della traccia.
- `timeline.ts`: la timeline a tracce (disegno e gesti).
`renderSeq` compone la sequenza (video sotto, grafica sopra; le clip di grafica sopra un video non disegnano lo sfondo), `renderFrame` accetta `overlay` e blocchi già calcolati. L'esportazione veloce scrive video H.264 e audio AAC nello stesso MP4.

## Stabilizzazione e colore (src/seq/stab.ts, stabscan.ts, grade.ts)

Stabilizzazione: `stabscan.ts` analizza il file (WebCodecs, 480 px, piramide 120→240→480 con previsione dal fotogramma prima) e salva il percorso in IndexedDB; `stab.ts` ammorbidisce il percorso e calcola correzione e zoom per clip; `drawRotated(..., st)` la applica. In anteprima il fotogramma si prende come `VideoFrame` dal lettore per leggerne il tempo esatto (il lettore è spesso più avanti di `currentTime`); i tempi del decoder partono da 0 come quelli del lettore (`VideoDecode.t0`).
Colore: `c.color` (per clip) e le clip `adj` (livello di regolazione, clip video senza file) usano `Grader` (WebGL) con la formula di `gradePixel`. `drawVid` disegna una clip video con stabilizzazione e colore; `applyAdjust` corregge il canvas già disegnato.

## Sottotitoli (src/subs)

`S.seq.subs = { words, style, on }`. Le **parole** (`{id, m, t, s, e}`) stanno nel tempo del **file** `m`, non della timeline: si vedono attraverso le clip video/audio di quel file (`cueSegments`, `subAt` usano `localT`), quindi seguono tagli, spostamenti, velocità ed "Elimina pause". Le **frasi** non si salvano: `groupCues` le ricava ogni volta da parole e stile (caratteri per riga, righe) più i segni a mano sulle parole (`br` = frase nuova, `nb` = niente divisione). `transcribe.ts` porta l'audio a 16 kHz, trova la voce (`voiceRuns`), toglie le pause (`compressMap`), trascrive in `worker.ts` (transformers.js da CDN, Whisper large-v3-turbo timestamped q4f16, WebGPU) e riporta i tempi (`mapWords`). `render.ts` disegna sopra la sequenza in `renderSeq` (anteprima ed esportazione); l'altezza è per formato (`style.y[fmt]`).

## Modello dati (src/model)

Progetto → Scene → Livelli. Tipi di livello: testo, SVG, immagine, video, audio, forma (linee di costruzione), cursore, gruppo.
Ogni livello ha inizio, durata, trasformazione animabile, effetti di entrata/uscita/continuo e può avere un genitore.
La scena ha una camera (pose a keyframe, inseguimento di un bersaglio), marker sui tempi, stati di layout e le transizioni tra stati.
I template sono scene con slot e regole automatiche (adatta, ordine di disegno, punti di zoom).
I preset di MOTO v1 si importano con `legacyPresetToProject`.

## Piano di lavoro

0. Fondamenta (fatta): moduli, TypeScript, test di parità, modello dati.
0b. Nuova interfaccia. Parte 1 (fatta): sezioni chiuse di default e ricordate, libreria con Preferiti e Recenti, selettori con preferiti (effetti, loop, curve, font), libreria font personale, ricerca ovunque (⌘K).
    Parte 2 (fatta): proprietà a schede (Stile / Animazione / Tempo), aree di lavoro (Completo, Motion, Montaggio; Sottotitoli e Audio con le rispettive funzioni), pannelli ridimensionabili, maniglie sul quadro (sposta e ridimensiona), palette salvabili con preferiti.
1. Nuovi effetti di testo (fatto: righe scorrevoli, categoria Cinetica con 12 entrate, categoria Voli curvi con 5 entrate lungo arco/onda/cerchio/S/zigzag, 11 nuovi movimenti continui, bagliore, estrusione, contorno disegnato, testo su tracciato con 9 forme e il passaggio rallentato, 4 entrate "Cammina").
2. Motion graphic (in corso: SVG che si disegna, costruzione del marchio, logo completo, camera 2D e stati di layout fatti): SVG vettoriale, camera 2D, linee di costruzione, stati di layout, cursore, mockup con slot, template, timeline leggera.
3. Timeline completa e strumenti (in corso: sequenza, video, audio di base ed esportazione con audio fatti): video di base, tagli, marker sui tempi, audio (volume, dissolvenze, canali, abbassamento automatico), elimina pause, esportazione con audio.
4. Showreel: scene, transizioni, 4K, brand kit, varianti.
5. Sottotitoli, stabilizzazione, colore, rifinitura dei reel.

## Preferiti e preferenze (src/ui)

- `prefs.ts`: preferiti per ambito (`fx`, `loop`, `ease`, `font`, …), recenti (ultimi 8) e sezioni aperte/chiuse. Si salvano nel browser per indirizzo
  (`localhost:5173`, porta fissa). Copia di sicurezza: comandi "Salva copia dei preferiti" / "Ripristina i preferiti" nella ricerca ovunque (⌘K).
- `picker.ts`: `enhanceSelect(select, { scope, key?, preview?, removable? })` trasforma un <select> in un selettore con ricerca, Preferiti e Recenti in cima.
  Il <select> resta nel documento (nascosto), quindi il codice che lo usa non cambia. Per aggiungere i preferiti a un nuovo menu basta chiamarla.
- `cmdk.ts`: ricerca ovunque. I comandi si costruiscono a ogni apertura (`buildCommands` in legacy/app.js).
- `fontstore.ts`: i font caricati restano in IndexedDB e tornano alla prossima apertura.
- Le sezioni del pannello e le categorie della libreria sono chiuse di default; lo stato di apertura si ricorda per ogni sezione.

## Pannelli, aree di lavoro, maniglie e palette (src/ui)

- `layout.ts`: `WORKSPACES` descrive le aree di lavoro come dati (larghezze + scheda): aggiungerne una è aggiungere una riga. `clampWidth` (pura) tiene i pannelli entro i limiti e l'anteprima sopra il minimo.
  `initLayout` collega bordi trascinabili, pulsanti e area attiva; le larghezze si ricordano in `prefs` (`w:lib`, `w:insp`, `ws`).
- `handles.ts`: matematica pura (aggancio, spostamento in % del quadro, fattore di scala) e il livello sopra il canvas. Le maniglie lavorano su `offX`/`offY` e `fitW`/`fs` del blocco attivo, quindi passano dalla stessa cronologia di Annulla/Ripeti dei cursori.
- `palettes.ts`: palette di base + personali (in `prefs.data.palettes`), ordinamento con preferiti, riga con chip nel pannello Colore.
- Le sezioni del pannello hanno `data-tab` (`stile`, `anim`, `tempo`, `all`): `reveal(sezione)` in legacy/app.js apre la scheda giusta.
