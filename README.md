# MOTO — progetto unificato

Una sola applicazione: la base funzionale di `moto-v2` con interfaccia, estetica, timeline dei livelli ed effetti di `training-motion`.

## Avvio

Su Mac, doppio clic su **Avvia MOTO.command**. Il comando avvia MOTO su http://localhost:5173 e apre il browser. Lascia aperta la finestra di avvio mentre lavori.

Per l’avvio dal terminale, con Node.js installato:

```sh
npm ci
npm run dev
```

Per eseguire anche i test usa Node.js 24 o successivo. Chrome e gli altri browser Chromium offrono il supporto più completo per video e file locali.

## Funzioni integrate

- Montaggio multitraccia di video, audio e clip grafiche; transizioni, velocità, effetti colore, stabilizzazione, sottotitoli, camera e SVG della versione del collega.
- Stile scuro Training, tipografia di sistema, layout adattivo e correzioni di dimensionamento del tuo progetto.
- Timeline dei livelli dentro ogni clip grafica: testi, immagini e SVG, trascinamento, fasi, aggancio, zoom, marker, keyframe, copia/incolla e intervallo di anteprima.
- I tuoi 20 effetti Studio: 14 transizioni e maschere, più 6 movimenti continui. Sono disponibili nella libreria, nei preset, nelle immagini e nel rendering di esportazione.
- Controlli delle proprietà con etichette accessibili; navigazione da tastiera; finestre modali con gestione del focus; rispetto della preferenza per ridurre il movimento.

La timeline superiore monta le clip. **Livelli della clip** modifica testi e grafica della clip selezionata. La sezione si può richiudere per dare più spazio all’anteprima.

Nei livelli della clip: `[` / `]` raggiungono i keyframe; `I` / `O` impostano l’intervallo di anteprima; `+` / `−` / `0` regolano lo zoom. Le frecce modificano il controllo selezionato di un fotogramma; con Maiusc di dieci fotogrammi. Fuori da questa sezione rimangono le scorciatoie della versione del collega.

L’intervallo limita la riproduzione di anteprima; l’esportazione usa l’intero montaggio. Marker e intervallo dei livelli sono indipendenti per ogni clip grafica. Il salvataggio automatico, annulla/ripeti e i file `.moto` li conservano insieme alle altre funzioni. I preset JSON del tuo progetto restano caricabili.

## Verifica e build

```sh
npm test
npm run typecheck
npm run build
```

La build pronta per un servizio di hosting è in `dist/` dopo `npm run build`.

Il test nel browser richiede Playwright e Chromium. Con il server di sviluppo acceso, in un secondo terminale:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:integration
```

È possibile passare a `node tests/integration.cjs` il percorso di una copia di Playwright già installata. Il test verifica effetti, timeline, annulla/ripeti, salvataggio, media, esportazione PNG, tastiera, schermi piccoli e movimento ridotto. Le immagini di verifica sono in `tests/tmp/`, esclusa dalla distribuzione dei sorgenti.

## Documentazione

- [INTEGRAZIONE.md](INTEGRAZIONE.md): provenienza, modifiche e risultati della verifica.
- [ARCHITETTURA.md](ARCHITETTURA.md): struttura dei moduli della base v2.
- [REGISTRO.md](REGISTRO.md): cronologia delle funzionalità aggiunte dal collega.

Questa è la versione locale unificata. Gli indirizzi online e i repository di origine non vengono aggiornati automaticamente da questa cartella.
