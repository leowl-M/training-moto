// Punto d'ingresso di MOTO v2 beta.
// Per ora avvia l'applicazione originale (src/legacy), che verrà spostata in moduli man mano.
import './legacy/app.js';
import './ui/motion-timeline.css';
import { initAccessibility } from './ui/accessibility';

initAccessibility();
