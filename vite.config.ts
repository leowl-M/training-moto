import { defineConfig } from 'vite';

// Porta fissa: il browser salva preferenze e progetto automatico per indirizzo, quindi l'indirizzo non deve cambiare.
export default defineConfig({
  // Gli stessi file compilati funzionano anche sotto /training-moto/ su GitHub Pages.
  base: './',
  server: { port: 5173, strictPort: true, host: 'localhost' },
  build: { target: 'es2022' },
});
