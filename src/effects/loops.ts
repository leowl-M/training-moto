import { G, R, RS, clamp, lerp, TAU, D2R } from '../core/math';
import { rng, sel, bool, col, PIV, pivot } from './params';
import { tgHook } from './hooks';
import { rowDir, wrapOffset } from './marquee';
import { buildTable, walkOffset, passOffset } from './textpath';
import type { TpShape } from './textpath';
import type { LoopDef, ParamDef } from './types';

/* effetti continui: f(s,t,u,o,env), applicati sopra la transizione */
/* --- Testo su tracciato: il testo è disposto lungo una forma e può camminarci sopra --- */
const SEPSEL = sel('sep','Separatore',[['space','Spazio'],['dot','Punto'],['dash','Trattino'],['slash','Barra'],['star','Stella']],'dot');
const TPC = (speed: number): ParamDef[] => [rng('speed','Cammino',-12,12,speed,.05,'em/s'),bool('pp','Avanti e indietro',false),rng('start','Partenza',-100,100,0,1,'% testo'),
  rng('follow','Rotazione lettere',0,1,1,.01),rng('rot','Rotazione del tracciato',-180,180,0,1,'°'),bool('flip','Rovescia sopra/sotto',false),
  {...rng('rep','Ripetizioni della parola',1,12,1,1),layout:true},{...SEPSEL,layout:true}];
let memo: { shape: string; w: any } | null = null;
/** Tracciato e scorrimento per questo fotogramma: si ricalcolano con la prima unità del blocco e valgono per tutte le altre. */
function tpWarp(shape: TpShape, o: Record<string, any>, t: number, e: number, first: boolean, pass = false) {
  if (memo && memo.shape === shape && !first) return memo.w;
  const L = Math.max(1, G.bw), E = G.E, tb = buildTable(shape, (pass ? { ...o, cyc: o.wcyc, n: o.wcyc, L, E } : { ...o, L, E }) as any), span = L + 2.5 * Math.hypot(G.W, G.H);
  const w = { tb, shift: pass ? passOffset(o as any, t, G.tot, L) : walkOffset(o, t, L, E, tb.kind, span), env: e, follow: o.follow };
  memo = { shape, w };
  return w;
}
const tp = (shape: TpShape, id: string, n: string, d: string, speed: number, ext: ParamDef[]): LoopDef => ({
  id, n, c: 'Tracciato', d, p: [...ext, ...TPC(speed)],
  f(s, t, u, o, e) { s.pth = tpWarp(shape, o, t, e, u.i === 0); },
});
const SHAPES: [string, string][] = [['arc','Arco'],['wave','Onda'],['zig','Zigzag'],['loop','Ricci'],['circle','Cerchio'],['spiral','Spirale'],['eight','Otto'],['heart','Cuore'],['pill','Capsula']];
const tpPass: LoopDef = {
  id: 'tp_pass', n: 'Passaggio rallentato', c: 'Tracciato',
  d: 'La parola si ripete e attraversa il tracciato: entra veloce, rallenta a metà (quando si legge) e riparte veloce per uscire. Scegli la forma, quante ripetizioni e quanto rallentare. Dura quanto la clip: allunga la "Pausa" per un passaggio più lento.',
  p: [sel('shape','Forma',SHAPES,'arc'),{...rng('rep','Ripetizioni della parola',1,12,3,1),layout:true},{...SEPSEL,layout:true},
    rng('dist','Distanza percorsa',.2,4,1.4,.05,'× testo'),rng('slow','Rallentamento al centro',1,8,3,.1),rng('pass','Passaggi nella clip',1,6,1,1),bool('rev','Verso opposto',false),
    rng('curve','Curvatura (arco)',-360,360,90,1,'°'),rng('amp','Altezza (onda, zigzag)',0,3,.7,.01,'em'),rng('wcyc','Onde, zig o ricci sul testo',.25,8,1.5,.25),rng('size','Dimensione (cerchio, spirale, otto…)',30,400,110,1,'%'),
    rng('start','Partenza',-100,100,0,1,'% testo'),rng('follow','Rotazione lettere',0,1,1,.01),rng('rot','Rotazione del tracciato',-180,180,0,1,'°'),bool('flip','Rovescia sopra/sotto',false)],
  f(s, t, u, o, e) { s.pth = tpWarp(o.shape as TpShape, o, t, e, u.i === 0, true); },
};
const TP_NOTE = ' Con le entrate "Cammina" le lettere ci salgono sopra camminando; "Cammino" le fa scorrere di continuo. Frammenti, strisce e rullo non seguono la forma.';

/* effetti continui: f(s,t,u,o,env), applicati sopra la transizione */
export const LOOPS: LoopDef[]=[
{id:'none',n:'Nessuno',p:[],f(){}},
{id:'marquee',n:'Righe scorrevoli',d:'Il testo si ripete su più righe che scorrono in senso opposto, con un angolo regolabile. Scrivi più righe di testo per alternarle.',
 p:[{...rng('rows','Righe',1,24,6,1),layout:true},{...sel('sep','Separatore',[['space','Spazio'],['dot','Punto'],['dash','Trattino'],['slash','Barra'],['star','Stella']],'dot'),layout:true},
  rng('speed','Velocità',0,12,2.2,.05,'em/s'),sel('dir','Direzioni',[['alt','Opposte'],['right','Tutte a destra'],['left','Tutte a sinistra']],'alt'),rng('vari','Variazione di velocità',0,1,.25,.01),
  rng('angle','Angolo',-90,90,-12,.5,'°'),rng('drift','Rotazione continua',-30,30,0,.1,'°/s'),bool('outl','Righe alterne a contorno',false),rng('dim','Righe alterne attenuate',0,1,0,.01)],
 f(s,t,u,o,e){const P=G.mqP&&G.mqP[u.line];if(!P)return;const v=rowDir(o.dir,u.line)*o.speed*G.E*(1+o.vari*RS({i:u.line},95));s.x+=wrapOffset(v,t,P)*e;
  if(u.line%2){if(o.outl){s.outl=1;s.outlW=Math.max(.8,G.E*.025)}if(o.dim)s.op*=1-o.dim}},
 xf(ctx,o,t,env){const a=(o.angle+o.drift*t)*env;if(a)ctx.rotate(a*D2R)}},
{id:'wave',n:'Onda continua',d:'Ondulazione continua lungo il testo.',p:[rng('amp','Ampiezza',0,1,.1,.005,'em'),rng('hz','Velocità',0,4,.7,.01,'Hz'),rng('ph','Sfasamento',0,2,.35,.01),sel('ax','Asse',[['y','Verticale'],['x','Orizzontale'],['r','Rotazione']],'y')],
 f(s,t,u,o,e){const v=Math.sin(TAU*o.hz*t-u.i*o.ph)*e;if(o.ax==='y')s.y+=v*o.amp*G.E;else if(o.ax==='x')s.x+=v*o.amp*G.E;else s.rot+=v*o.amp*60}},
{id:'float',n:'Galleggiamento',d:'Movimento organico lento, ogni pezzo con la sua fase.',p:[rng('amp','Ampiezza',0,.5,.04,.005,'em'),rng('sp','Velocità',0,2,.35,.01,'Hz'),rng('rot','Rotazione',0,20,2,.1,'°')],
 f(s,t,u,o,e){const w=TAU*o.sp*t;s.x+=Math.sin(w*.7+R(u,20)*TAU)*o.amp*G.E*.6*e;s.y+=Math.sin(w+R(u,21)*TAU)*o.amp*G.E*e;s.rot+=Math.sin(w*.8+R(u,22)*TAU)*o.rot*e}},
{id:'jitter',n:'Tremolio',d:'Micro vibrazione a scatti, effetto disegnato a mano.',p:[rng('amp','Ampiezza',0,10,1.2,.05,'%em'),rng('hz','Frequenza',1,30,10,1,'Hz'),rng('rot','Rotazione',0,10,.8,.1,'°')],
 f(s,t,u,o,e){const k=Math.floor(t*o.hz);s.x+=RS(u,k*3+31)*o.amp*G.E*.01*e;s.y+=RS(u,k*3+32)*o.amp*G.E*.01*e;s.rot+=RS(u,k*3+33)*o.rot*e}},
{id:'breathe',n:'Respiro',d:'La scala pulsa lentamente come un respiro.',p:[rng('amp','Ampiezza',0,.5,.04,.005),rng('sp','Velocità',0,3,.5,.01,'Hz'),rng('ph','Sfasamento',0,2,.2,.01)],
 f(s,t,u,o,e){const k=1+o.amp*Math.sin(TAU*o.sp*t-u.i*o.ph)*e;s.sx*=k;s.sy*=k}},
{id:'wobble',n:'Oscillazione',d:'Leggera rotazione avanti e indietro.',p:[rng('deg','Angolo',0,45,4,.1,'°'),rng('sp','Velocità',0,3,.6,.01,'Hz'),rng('ph','Sfasamento',0,2,.3,.01),sel('piv','Perno',PIV,'B')],
 f(s,t,u,o,e){s.rot+=o.deg*Math.sin(TAU*o.sp*t-u.i*o.ph)*e;if(!s.px&&!s.py)pivot(s,o.piv,u)}},
{id:'cpulse',n:'Pulsazione colore',d:'Il colore B scorre ciclicamente lungo il testo.',p:[rng('amt','Intensità',0,1,1,.01),rng('sp','Velocità',0,3,.5,.01,'Hz'),rng('ph','Sfasamento',0,2,.25,.01),rng('sharp','Nitidezza',1,12,1,.1)],
 f(s,t,u,o,e){const v=.5-.5*Math.cos(TAU*o.sp*t-u.i*o.ph);s.mix+=o.amt*Math.pow(v,o.sharp)*e}},
{id:'wpulse',n:'Pulsazione peso',d:'Il peso del font respira tra due valori (font variabili).',p:[rng('min','Peso minimo',100,900,200,1),rng('max','Peso massimo',100,900,900,1),rng('sp','Velocità',0,3,.5,.01,'Hz'),rng('ph','Sfasamento',0,2,.3,.01)],
 f(s,t,u,o,e){const v=.5-.5*Math.cos(TAU*o.sp*t-u.i*o.ph);s.wght=lerp(s.wght??G.wght,lerp(o.min,o.max,v),e)}},
{id:'neon',n:'Neon',d:'Qualche lettera sfarfalla ogni tanto, come un\'insegna.',p:[rng('prob','Probabilità',0,.5,.06,.005),rng('hz','Frequenza',1,30,14,1,'Hz'),rng('dim','Luminosità spenta',0,1,.15,.01)],
 f(s,t,u,o,e){const k=Math.floor(t*o.hz);if(R(u,k*13+41)<o.prob*e)s.op*=o.dim}},
{id:'tglitch',n:'Glitch testuale',d:'Ogni tanto un carattere viene sostituito per un istante.',p:[rng('prob','Probabilità',0,.5,.04,.005),rng('hz','Frequenza',1,30,12,1,'Hz'),sel('set','Caratteri',[['AZ','Lettere'],['sym','Simboli'],['bin','Binario'],['blk','Blocchi']],'sym')],
 f(s,t,u,o,e){s.hooks.push({fn:tgHook,p:e,o})}},
{id:'bounce',n:'Rimbalzo continuo',d:'Le lettere saltellano una dopo l\'altra, con una piccola schiacciata a terra.',p:[rng('amp','Altezza',0,1,.18,.005,'em'),rng('hz','Velocità',0,4,1.2,.01,'Hz'),rng('ph','Sfasamento',0,2,.4,.01),rng('sq','Schiacciamento',0,.5,.12,.01)],
 f(s,t,u,o,e){const w=Math.abs(Math.sin(Math.PI*o.hz*t-u.i*o.ph*.5));s.y-=w*o.amp*G.E*e;const k=o.sq*(1-w)*e;s.sy*=1-k;s.sx*=1+k*.6;pivot(s,'B',u)}},
{id:'tilt',n:'Oscillazione 3D',d:'Le lettere ruotano avanti e indietro come carte su un perno verticale.',p:[rng('amt','Intensità',0,1,.7,.01),rng('sp','Velocità',0,3,.5,.01,'Hz'),rng('ph','Sfasamento',0,2,.3,.01),rng('shade','Ombra',0,1,.4,.01)],
 f(s,t,u,o,e){const c=Math.abs(Math.cos(TAU*o.sp*t-u.i*o.ph));s.sx*=Math.max(.02,c*o.amt*e+(1-o.amt*e));s.op*=1-(1-c)*o.shade*e}},
{id:'beat',n:'Pulsazione a ritmo',d:'La scala pulsa a tempo di musica (battiti al minuto) con un colpo secco che si spegne.',p:[rng('bpm','Battiti al minuto',40,200,120,1),rng('amp','Intensità',0,.6,.12,.005),rng('decay','Decadimento',.5,8,3,.1),rng('ph','Sfasamento lettere',0,1,0,.01)],
 f(s,t,u,o,e){const ph=((t*o.bpm/60-u.i*o.ph*.1)%1+1)%1,k=1+o.amp*Math.pow(1-ph,o.decay)*e;s.sx*=k;s.sy*=k}},
{id:'sparkle',n:'Scintillio colore',d:'Alcune lettere passano per un istante al colore B, a caso.',p:[rng('prob','Probabilità',0,1,.15,.01),rng('hz','Frequenza',1,30,8,1,'Hz')],
 f(s,t,u,o,e){const k=Math.floor(t*o.hz);if(R(u,k*7+51)<o.prob*e)s.mix+=1}},
{id:'arc',n:'Arco semplice',d:'Il testo segue una curva: un arco verso l\'alto o verso il basso, con un lento ondeggiamento opzionale. Per un testo che cammina sull\'arco usa "Testo su arco".',p:[rng('curve','Curvatura',-1,1,.35,.01),rng('sway','Ondeggiamento',0,1,0,.01),rng('sp','Velocità ondeggiamento',0,2,.3,.01,'Hz')],
 f(s,t,u,o,e){const c=(o.curve+o.sway*Math.sin(TAU*o.sp*t))*e;if(Math.abs(c)<1e-3)return;const R=G.E*3/Math.abs(c),th=u.cx/R,sg=Math.sign(c);s.x+=R*Math.sin(th)-u.cx;s.y+=sg*R*(1-Math.cos(th));s.rot+=sg*th/D2R}},
{id:'spot',n:'Riflettore',d:'Un fascio di luce attraversa il testo: le lettere nel fascio si accendono nel colore B e le altre si attenuano.',p:[rng('sp','Velocità',0,3,.4,.01,'Hz'),rng('w','Larghezza',.2,6,1.4,.01,'em'),rng('dim','Attenuazione',0,1,.55,.01),rng('lit','Accensione colore B',0,1,1,.01),sel('ax','Percorso',[['pp','Avanti e indietro'],['loop','Sempre nello stesso verso']],'pp')],
 f(s,t,u,o,e){const half=Math.max(G.bw||1,1)/2+G.E,pos=o.ax==='pp'?Math.sin(TAU*o.sp*t*.5)*half:((((t*o.sp*.5)+.5)%1+1)%1-.5)*2*half,k=clamp(1-Math.abs(u.cx-pos)/(o.w*G.E)),sm=k*k*(3-2*k);s.op*=1-o.dim*(1-sm)*e;s.mix+=o.lit*sm*e}},
{id:'halo',n:'Alone luminoso',d:'Il testo emette un bagliore che pulsa.',p:[rng('blur','Bagliore',0,3,.9,.01,'em'),rng('sp','Velocità',0,3,.5,.01,'Hz'),rng('pulse','Pulsazione',0,1,.5,.01),sel('col','Colore',[['B','Colore B'],['A','Colore testo']],'B')],
 f(s,t,u,o,e){const k=1-o.pulse+o.pulse*(.5+.5*Math.sin(TAU*o.sp*t-u.i*.3));s.glow={blur:o.blur*G.E*k*e,c:o.col,a:1}}},
{id:'chromaloop',n:'Aberrazione continua',d:'I canali di colore si separano e si ricompongono a ritmo, come un segnale disturbato.',p:[rng('rgb','Separazione',0,40,8,.5,'px'),rng('sp','Velocità',0,4,.7,.01,'Hz'),rng('ph','Sfasamento',0,2,.2,.01),col('ca','Canale 1','#ff2a55'),col('cb','Canale 2','#00e1ff')],
 f(s,t,u,o,e){s.rgb=o.rgb*(.5+.5*Math.sin(TAU*o.sp*t-u.i*o.ph))*e;s.rgbA=o.ca;s.rgbB=o.cb}},
{id:'jellyloop',n:'Gelatina continua',d:'Le lettere si schiacciano e si allungano come gelatina, una dopo l\'altra.',p:[rng('amt','Intensità',0,.6,.14,.005),rng('sp','Velocità',0,3,.8,.01,'Hz'),rng('ph','Sfasamento',0,2,.35,.01)],
 f(s,t,u,o,e){const w=Math.sin(TAU*o.sp*t-u.i*o.ph)*o.amt*e;s.sx*=1+w;s.sy*=1-w;pivot(s,'B',u)}},
{id:'extrude',n:'Estrusione 3D',d:'Il testo diventa solido: copie sfalsate formano uno spessore, e l\'angolo può girare lentamente.',p:[rng('depth','Profondità',0,1.5,.35,.01,'em'),rng('angle','Angolo',-180,180,45,1,'°'),rng('spin','Rotazione',-90,90,0,.5,'°/s'),rng('shade','Ombra',0,1,.55,.01),rng('n','Passaggi',3,40,14,1)],
 f(s,t,u,o,e){const a=(o.angle+o.spin*t)*D2R,D=o.depth*G.E*e;s.ext={n:Math.round(o.n),dx:Math.cos(a)*D,dy:Math.sin(a)*D,shade:o.shade}}},
tp('arc','tp_arc','Testo su arco','Il testo si dispone su un arco, verso l\'alto o verso il basso, e può camminarci sopra.'+TP_NOTE,0,[rng('curve','Curvatura',-360,360,140,1,'°')]),
tp('circle','tp_circle','Testo su cerchio','Il testo gira attorno a un cerchio (o a un\'ellisse): con dimensione 100% fa un giro intero.'+TP_NOTE,1.2,[rng('size','Dimensione del giro',30,400,110,1,'%'),rng('squash','Schiacciamento',0,.8,0,.01)]),
tp('wave','tp_wave','Testo su onda','Il testo ondeggia lungo una sinusoide che scorre.'+TP_NOTE,1,[rng('amp','Altezza onda',0,3,.7,.01,'em'),rng('cyc','Onde sul testo',.25,8,1.5,.25)]),
tp('zig','tp_zig','Testo a zigzag','Il testo sale e scende a zigzag; la morbidezza arrotonda gli angoli.'+TP_NOTE,1,[rng('amp','Altezza zigzag',0,3,.7,.01,'em'),rng('cyc','Zig sul testo',.25,8,2,.25),rng('soft','Morbidezza',0,1,.15,.01)]),
tp('spiral','tp_spiral','Testo a spirale','Il testo si avvolge a spirale, dal centro verso l\'esterno.'+TP_NOTE,0,[rng('turns','Giri',.5,5,2,.25),rng('inner','Raggio interno',3,90,28,1,'%'),rng('size','Lunghezza della spirale',50,300,100,1,'%')]),
tp('loop','tp_loop','Testo a ricci','Il testo percorre dei ricci, come un nastro che si arrotola.'+TP_NOTE,1.2,[rng('n','Ricci sul testo',.5,8,2,.5),rng('rr','Ampiezza dei ricci',.5,3,1.6,.05)]),
tp('eight','tp_eight','Testo a otto','Il testo percorre un otto (il simbolo dell\'infinito).'+TP_NOTE,1.2,[rng('size','Dimensione del giro',30,400,150,1,'%')]),
tp('heart','tp_heart','Testo a cuore','Il testo segue il contorno di un cuore.'+TP_NOTE,1.2,[rng('size','Dimensione del giro',30,400,130,1,'%')]),
tpPass,
tp('pill','tp_pill','Testo su capsula','Il testo corre attorno a una capsula (un rettangolo con i lati tondi), come un\'insegna.'+TP_NOTE,1.2,[rng('size','Dimensione del giro',30,400,120,1,'%'),rng('asp','Allungamento',1,8,3,.1,'×')]),
];
