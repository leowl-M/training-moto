import { defineConfig } from 'vite';

// Porta fissa: il browser salva preferenze e progetto automatico per indirizzo, quindi l'indirizzo non deve cambiare.
export default defineConfig({
  server: { port: 5173, strictPort: true, host: 'localhost' },
  build: { target: 'es2022' },
});
