// Aggiorna il sito caricabile direttamente su GitHub Pages insieme ai sorgenti.
import { cp, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const html = await readFile(path.join(dist, 'index.html'), 'utf8');
if (/src=["'][^"']*\.ts["']/.test(html) || !html.includes('./assets/')) {
  throw new Error('La pagina compilata deve caricare gli asset relativi, non i sorgenti TypeScript.');
}
await mkdir(path.join(root, 'assets'), { recursive: true });
await cp(path.join(dist, 'assets'), path.join(root, 'assets'), { recursive: true });
await cp(path.join(dist, 'index.html'), path.join(root, 'index.html'));
console.log('Sito pronto per il caricamento diretto: index.html + assets/. Sorgenti conservati in src/.');
