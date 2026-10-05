#!/bin/bash
# Avvia MOTO v2 beta: installa le dipendenze la prima volta, aspetta che il server sia pronto, poi apre l'app in Arc (o nel browser predefinito).
# Lascia aperta questa finestra mentre lavori: se la chiudi, l'app smette di funzionare.
cd "$(dirname "$0")"
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fine() { echo; read -n 1 -s -r -p "Premi un tasto per chiudere"; exit "${1:-0}"; }
command -v node >/dev/null 2>&1 || { echo "Node non trovato. Installalo da https://nodejs.org e riprova."; fine 1; }

PORT=5173; URL="http://localhost:$PORT"
apri() { open -a "Arc" "$URL" 2>/dev/null || open "$URL"; }

if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  if curl -s -m 2 "$URL" | grep -q "MOTO v2 beta"; then echo "MOTO è già acceso: apro il browser."; apri; exit 0; fi
  echo "La porta $PORT è occupata da un altro programma:"; lsof -nP -iTCP:$PORT -sTCP:LISTEN | tail -n +2
  echo "Chiudilo e riprova."; fine 1
fi

[ -d node_modules ] || { echo "Prima installazione: scarico le dipendenze (circa 60 MB)..."; npm install || fine 1; }

( for i in $(seq 1 60); do curl -s -o /dev/null -m 1 "$URL" && break; sleep 0.5; done; apri ) &
echo "MOTO v2 beta su $URL"
echo "Lascia aperta questa finestra mentre lavori. Ctrl+C per fermare."
echo
npm run dev
echo "Il server si è fermato."; fine 1
