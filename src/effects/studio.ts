import { clamp, G, TAU } from '../core/math';
import { EZ } from '../core/easing';
import { sel, rng, bool, DIR4, dv, pivot, PIV } from './params';
import type { EffectDef, LoopDef, Unit } from './types';

// Extra effects share the existing parameter, preview, preset and export pipeline.
export function extraTransitions(): EffectDef[] {
 return [
  {id:'slingshot',n:'Fionda',c:'Studio · ingressi',d:'Arretra per prendere slancio, poi scatta al suo posto con un breve assestamento.',rec:{split:'char',stagger:.35,ease:'linear'},
   p:[sel('dir','Provenienza',DIR4,'L'),rng('dist','Distanza',.2,6,1.8,.05,'em'),rng('pull','Carica',0,1,.25,.01),rng('tilt','Inclinazione',-45,45,12,1,'°')],
   f(s,p,u,o){const c=clamp(p),v=c<.2?1+o.pull*Math.sin(c/.2*Math.PI/2):(1+o.pull)*(1-EZ.outBack((c-.2)/.8)),[x,y]=dv(o.dir,u);s.x+=x*o.dist*G.E*v;s.y+=y*o.dist*G.E*v;s.rot+=o.tilt*v;s.op*=clamp(c*8)}},
  {id:'zigzag',n:'Zig-zag',c:'Studio · ingressi',d:'Segue una traiettoria a zig-zag che si restringe avvicinandosi alla posizione finale.',rec:{split:'char',stagger:.4,ease:'linear'},
   p:[sel('dir','Provenienza',DIR4,'B'),rng('dist','Distanza',.2,6,2,.05,'em'),rng('amp','Ampiezza laterale',0,2,.45,.01,'em'),rng('turns','Deviazioni',1,8,3,1)],
   f(s,p,u,o){const c=clamp(p),q=1-c,[x,y]=dv(o.dir,u),z=2/Math.PI*Math.asin(Math.sin(c*TAU*o.turns))*q*o.amp*G.E;s.x+=x*o.dist*G.E*q-y*z;s.y+=y*o.dist*G.E*q+x*z;s.op*=clamp(c*5)}},
  {id:'fan',n:'Ventaglio',c:'Studio · ingressi',d:'Le lettere si aprono a ventaglio attorno a un perno comune alla base del testo.',rec:{split:'char',stagger:.15,ease:'outCubic',order:'center'},
   p:[rng('angle','Apertura',0,150,65,1,'°'),rng('spread','Compressione',0,1,.7,.01),rng('rise','Sollevamento',0,2,.3,.01,'em')],
   f(s,p,u,o){const c=clamp(p),q=1-c,side=u.n>1?2*u.i/(u.n-1)-1:1;s.px=-u.cx;s.py=u.by1;s.rot+=side*o.angle*q;s.x-=u.cx*o.spread*q;s.y+=o.rise*G.E*q;s.op*=clamp(c*4)}},
  {id:'origami',n:'Origami',c:'Studio · ingressi',d:'Si dispiega da una piega diagonale, alternando il verso tra le lettere.',rec:{split:'char',stagger:.45,ease:'outCubic'},
   p:[rng('angle','Piega',0,65,45,1,'°'),rng('lift','Altezza',0,2,.45,.01,'em'),bool('alternate','Piega alternata',true)],
   f(s,p,u,o){const c=clamp(p),q=1-c,side=o.alternate&&u.i%2?-1:1;s.sy*=Math.max(.001,Math.sin(c*Math.PI/2));s.sx*=.3+.7*c;s.skx+=side*o.angle*q;s.rot-=side*o.angle*.4*q;s.y+=o.lift*G.E*q;pivot(s,'B',u);s.op*=clamp(c*5)}},
  {id:'stepped',n:'Passi meccanici',c:'Studio · ingressi',d:'Avanza per scatti regolari con una piccola oscillazione a ogni passo.',rec:{split:'char',stagger:.25,ease:'linear'},
   p:[sel('dir','Provenienza',DIR4,'L'),rng('steps','Passi',2,16,6,1),rng('dist','Distanza',.2,5,1.8,.05,'em'),rng('angle','Oscillazione',0,30,8,1,'°')],
   f(s,p,u,o){const c=clamp(p),n=Math.round(o.steps),k=Math.floor(c*n),a=k/n,q=1-a,[x,y]=dv(o.dir,u);s.x+=x*o.dist*G.E*q;s.y+=y*o.dist*G.E*q;s.rot+=(k%2?1:-1)*o.angle*q;s.op*=clamp(c*6)}},
  {id:'rubberband',n:'Elastico laterale',c:'Studio · ingressi',d:'Si allarga e si contrae lateralmente mentre viene richiamato verso il centro.',rec:{split:'word',stagger:.3,ease:'linear'},
   p:[rng('dist','Distanza',.2,5,1.8,.05,'em'),rng('cycles','Oscillazioni',1,5,2,1),rng('stretch','Elasticità',0,.8,.45,.01),bool('alternate','Alterna lato',true)],
   f(s,p,u,o){const c=clamp(p),q=(1-c)**2,side=o.alternate&&u.i%2?1:-1,w=Math.cos(c*TAU*o.cycles)*q;s.x+=side*o.dist*G.E*w;s.sx*=1+o.stretch*w;s.sy*=1/(1+o.stretch*w);s.op*=clamp(c*6)}},
  {id:'conveyor',n:'Nastro trasportatore',c:'Studio · ingressi',d:'Rotola da un lato e si raddrizza progressivamente, come un oggetto su un nastro.',rec:{split:'char',stagger:.45,ease:'outCubic'},
   p:[sel('dir','Provenienza',[['L','Da sinistra'],['R','Da destra']],'L'),rng('dist','Distanza',.2,8,2.5,.05,'em'),rng('turns','Giri',.25,3,.75,.05),rng('lift','Sobbalzo',0,1,.15,.01,'em')],
   f(s,p,u,o){const c=clamp(p),q=1-c,side=o.dir==='L'?-1:1;s.x+=side*o.dist*G.E*q;s.rot+=side*o.turns*360*q;s.y-=Math.abs(Math.sin(c*o.turns*TAU))*o.lift*G.E*q;pivot(s,'B',u);s.op*=clamp(c*5)}},
  {id:'weave',n:'Intreccio',c:'Studio · ingressi',d:'Due file alternate si incrociano lungo archi opposti e si ricompongono nel testo.',rec:{split:'char',stagger:.15,ease:'inOutCubic'},
   p:[rng('width','Apertura orizzontale',0,3,.7,.01,'em'),rng('height','Apertura verticale',0,3,1,.01,'em'),rng('twist','Torsione',0,90,20,1,'°')],
   f(s,p,u,o){const c=clamp(p),q=1-c,side=u.i%2?1:-1;s.x+=side*Math.sin(c*Math.PI)*o.width*G.E*q;s.y+=side*Math.cos(c*Math.PI)*o.height*G.E*q;s.rot+=side*o.twist*Math.sin(c*Math.PI)*q;s.op*=clamp(c*4)}},
  {id:'iris',n:'Iride',c:'Studio · maschere',d:'Un’apertura circolare rivela il testo a partire da un punto regolabile.',rec:{split:'word',stagger:.25,ease:'inOutCubic'},
   p:[rng('cx','Centro X',0,1,.5,.01),rng('cy','Centro Y',0,1,.5,.01)],
   f(s,p,u,o){s.reveal={kind:'iris',a:clamp(p),...o}}},
  {id:'diamond',n:'Diamante',c:'Studio · maschere',d:'Una finestra a rombo si espande dal centro fino a scoprire l’intero testo.',rec:{split:'word',stagger:.3,ease:'inOutCubic'},
   p:[rng('cx','Centro X',0,1,.5,.01),rng('cy','Centro Y',0,1,.5,.01)],
   f(s,p,u,o){s.reveal={kind:'diamond',a:clamp(p),...o}}},
  {id:'diagonal',n:'Taglio diagonale',c:'Studio · maschere',d:'Una diagonale attraversa le lettere da un angolo al suo opposto.',rec:{split:'word',stagger:.25,ease:'inOutCubic'},
   p:[bool('reverse','Parte dal basso a destra',false),rng('tint','Colore B sul passaggio',0,1,.35,.01)],
   f(s,p,u,o){const c=clamp(p);s.reveal={kind:'diagonal',a:c,...o};s.mix+=o.tint*(1-c)}},
  {id:'blinds',n:'Veneziana',c:'Studio · maschere',d:'Lamelle parallele si aprono contemporaneamente, in orizzontale o verticale.',rec:{split:'word',stagger:.2,ease:'inOutSine'},
   p:[rng('n','Lamelle',2,16,6,1),sel('axis','Asse',[['h','Orizzontale'],['v','Verticale']],'h')],
   f(s,p,u,o){s.reveal={kind:'blinds',a:clamp(p),...o}}},
  {id:'checker',n:'Scacchiera',c:'Studio · maschere',d:'Piccole finestre quadrate si aprono in due gruppi alternati come una scacchiera.',rec:{split:'word',stagger:.2,ease:'linear'},
   p:[rng('n','Colonne',2,12,8,1),rng('offset','Ritardo alternato',0,.6,.25,.01)],
   f(s,p,u,o){s.reveal={kind:'checker',a:clamp(p),...o}}},
  {id:'comb',n:'Pettine',c:'Studio · maschere',d:'Strisce verticali scoprono il testo alternando la salita e la discesa.',rec:{split:'word',stagger:.25,ease:'inOutCubic'},
   p:[rng('n','Denti',2,20,10,1),rng('offset','Sfalsamento',0,.6,.2,.01),bool('reverse','Inverti alternanza',false)],
   f(s,p,u,o){s.reveal={kind:'comb',a:clamp(p),...o}}},
 ];
}

export function extraLoops(): LoopDef[] {
 return [
  {id:'orbit',n:'Orbita ellittica',d:'Ogni lettera percorre un’ellisse con raggi e sfasamento regolabili.',
   p:[rng('rx','Raggio X',0,1,.12,.005,'em'),rng('ry','Raggio Y',0,1,.06,.005,'em'),rng('hz','Velocità',0,3,.4,.01,'Hz'),rng('phase','Sfasamento',0,2,.4,.01)],
   f(s,t,u,o,e){const a=t*TAU*o.hz+u.i*o.phase;s.x+=Math.cos(a)*o.rx*G.E*e;s.y+=Math.sin(a)*o.ry*G.E*e}},
  {id:'figure8',n:'Figura a otto',d:'Un movimento continuo a forma di infinito, con ampiezza e velocità regolabili.',
   p:[rng('amp','Ampiezza',0,1,.15,.005,'em'),rng('hz','Velocità',0,3,.35,.01,'Hz'),rng('phase','Sfasamento',0,2,.25,.01)],
   f(s,t,u,o,e){const a=t*TAU*o.hz+u.i*o.phase;s.x+=Math.sin(a)*o.amp*G.E*e;s.y+=Math.sin(2*a)*o.amp*G.E*.5*e}},
  {id:'heartbeat',n:'Battito',d:'Due impulsi ravvicinati seguiti da una pausa, come un battito cardiaco.',
   p:[rng('amp','Intensità',0,.5,.12,.005),rng('bpm','Battiti al minuto',20,180,72,1,'BPM'),rng('tint','Accento colore B',0,1,.35,.01)],
   f(s,t,u,o,e){const a=((t*o.bpm/60)%1+1)%1,pulse=(at,w)=>Math.abs(a-at)<w?Math.cos((a-at)/w*Math.PI/2)**2:0,v=pulse(.16,.1)+.65*pulse(.4,.1),k=1+v*o.amp*e;s.sx*=k;s.sy*=k;s.mix+=v*o.tint*e}},
  {id:'turntable',n:'Rotazione continua',d:'Rotazione regolare attorno al perno scelto, con verso e velocità regolabili.',
   p:[rng('speed','Velocità',-180,180,24,1,'°/s'),sel('pivot','Perno',PIV,'C'),rng('phase','Sfasamento',0,45,0,1,'°')],
   f(s,t,u,o,e){s.rot+=(t*o.speed+u.i*o.phase)*e;if(!s.px&&!s.py)pivot(s,o.pivot,u)}},
  {id:'shearwave',n:'Onda di taglio',d:'Un’onda inclina e comprime le lettere, creando un movimento da bandiera.',
   p:[rng('angle','Inclinazione',0,35,12,1,'°'),rng('hz','Velocità',0,3,.5,.01,'Hz'),rng('phase','Sfasamento',0,2,.5,.01),rng('squeeze','Compressione',0,.4,.08,.01)],
   f(s,t,u,o,e){const v=Math.sin(t*TAU*o.hz-u.i*o.phase)*e;s.skx+=o.angle*v;s.sy*=1-o.squeeze*v;pivot(s,'B',u)}},
  {id:'interference',n:'Interferenza',d:'Onde orizzontali attraversano il testo a fasce, come un segnale analogico.',
   p:[rng('amp','Ampiezza',0,.3,.035,.005,'em'),rng('n','Fasce',3,24,10,1),rng('hz','Velocità',0,3,.65,.01,'Hz'),rng('wave','Densità onde',.1,2,.65,.05)],
   f(s,t,u,o,e){if(e<=0)return;const n=Math.round(o.n);s.slices={n,off:j=>Math.sin(j*o.wave-t*TAU*o.hz+u.i*.3)*o.amp*G.E*e}}},
 ];
}

// Build a single clipping path for every mask; works with text, strokes and images.
export function clipCreativeReveal(ctx: CanvasRenderingContext2D, u: Pick<Unit, 'w' | 'by0' | 'by1'>, r: any) {
 const a=clamp(r.a),pad=G.E*.12,x=-u.w/2-pad,y=u.by0-G.E*.04,w=u.w+pad*2,h=u.by1-u.by0+G.E*.08;
 ctx.beginPath();
 if(r.kind==='iris') {
  const cx=x+w*r.cx,cy=y+h*r.cy;
  const radius=Math.hypot(Math.max(r.cx,1-r.cx)*w,Math.max(r.cy,1-r.cy)*h)*a;
  ctx.arc(cx,cy,radius,0,TAU);
 }else if(r.kind==='diamond') {
  const cx=x+w*r.cx,cy=y+h*r.cy,radius=(Math.max(r.cx,1-r.cx)*w+Math.max(r.cy,1-r.cy)*h)*a;
  ctx.moveTo(cx,cy-radius);ctx.lineTo(cx+radius,cy);ctx.lineTo(cx,cy+radius);ctx.lineTo(cx-radius,cy);ctx.closePath();
 }else if(r.kind==='diagonal') {
  const point=(nx,ny,first=false)=>ctx[first?'moveTo':'lineTo'](x+w*(r.reverse?1-nx:nx),y+h*(r.reverse?1-ny:ny));
  point(0,0,true);point(2*a,0);point(0,2*a);ctx.closePath();
 }else if(r.kind==='blinds') {
  const n=Math.round(r.n);
  for(let j=0;j<n;j++)if(r.axis==='h')ctx.rect(x,y+h/n*(j+(1-a)/2),w,h/n*a);else ctx.rect(x+w/n*(j+(1-a)/2),y,w/n*a,h);
 }else if(r.kind==='checker') {
  const cols=Math.round(r.n),rows=Math.max(2,Math.min(12,Math.round(cols*h/w))),cw=w/cols,ch=h/rows;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {
   const k=clamp((a-((row+col)%2)*r.offset)/(1-r.offset));
   ctx.rect(x+cw*(col+(1-k)/2),y+ch*(row+(1-k)/2),cw*k,ch*k);
  }
 }else if(r.kind==='comb') {
  const n=Math.round(r.n),cw=w/n;
  for(let j=0;j<n;j++){const k=clamp((a-(j%2)*r.offset)/(1-r.offset)),reverse=!!(j%2)!==r.reverse;ctx.rect(x+cw*j,y+(reverse?1-k:0)*h,cw,h*k)}
 }
 ctx.clip();
}
