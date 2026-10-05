# Test di parità visiva

Confronta pixel per pixel i frame prodotti da due versioni dell'app (circa 1.400: tutti gli effetti di entrata e uscita,
i loop, il movimento del blocco e vari stili). Serve a verificare che una riorganizzazione del codice non cambi il risultato.

- `parity.js`: genera i frame e ne calcola l'impronta. `window.runParity(api)` restituisce `{ n, digest, frames }`.
- `baseline-originale.json`: impronte prodotte dall'app originale (`training-motion-main`): 1.376 frame, digest `175377f5`. Gli effetti che esistevano già devono restare **identici**: si confrontano i soli frame presenti in questo file.
- `baseline-v2.json`: impronte attuali, nuovi effetti compresi (1.990 frame, digest `1e3f03a7`). Serve a rilevare cambiamenti non voluti da qui in avanti; va rigenerato quando si aggiungono effetti.

Come si usa (con il server di sviluppo acceso): nella console della pagina eseguire il contenuto di `parity.js`
e poi `await runParity(window.__moto)`. Per l'originale si confrontano i frame uno a uno (`frames[k] === base.frames[k]` per ogni chiave della baseline); per `baseline-v2.json` deve coincidere anche il `digest`.
`window.__moto` esiste solo con `npm run dev`.
