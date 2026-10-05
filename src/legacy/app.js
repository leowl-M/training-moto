// Resto dell'applicazione originale (stato, layout, rendering, interfaccia, timeline, esportazione).
// Estratto senza modifiche alla logica: gli effetti, la matematica e i font vivono ora in src/core e src/effects.
import { $, toast } from '../core/dom';
import { clamp, lerp, D2R, TAU, hash, G, R, RS, HAS_FILTER, hexRGB, mixRGB } from '../core/math';
import { EZ, EZ_LIST } from '../core/easing';
import { FONTS, fontPool, fontCss, fontStr } from '../core/fonts';
import { rng, sel, bool, col, DIRS, DIR4, dv, pivot, PIV, CHARSETS, rChar } from '../effects/params';
import { fall, floorD, pieces } from '../effects/physics';
import { FX, LOOPS, FXMAP, LMAP, CATS } from '../effects';
import { clipCreativeReveal } from '../effects/studio';
import { favs, isFav, toggleFav, recents, pushRecent, isOpen, setOpen, onPrefsChange, exportPrefs, importPrefs, getUI, setUI } from '../ui/prefs';
import { initLayout, WORKSPACES } from '../ui/layout';
import { paletteRow } from '../ui/palettes';
import { initHandles, round1 } from '../ui/handles';
import { buildMarquee } from '../effects/marquee';
import { warpAt, repeatLines } from '../effects/textpath';
import { drawSvg, mkSvgLayer, svgEnd, svgPenTip, svgPartBox, svgShotsCam, defaultShots, SHOT_AREAS } from '../svg/render';
import { newShots, shotsLen, moveT, animTime } from '../svg/anim';
import { camPose, camMatrix, isIdent, newCamera, IDENT, mixPose } from '../camera/camera';
import { tracksOf, trackNum, addTrack, removeTrack, firstTrack, kindOfTrack, newSeq, uid, clipEnd, seqTotal, localT, visibleAt, splitClip, freeSlot, isActive, spd, setSpeed, drawRank } from '../seq/seq';
import { stretch } from '../seq/stretch';
import { analyzeChannels, applyChannels, describe as chDescribe } from '../seq/channels';
import { loudness, gainTo, limit, voiceRegions, duckPoints } from '../seq/mix';
import { findBeats } from '../seq/beats';
import { parseTC } from '../core/timecode';
import * as MED from '../seq/media';
import { SeqAudio, mixdown, encodeAac } from '../seq/audio';
import { VideoDecode, drawRotated } from '../seq/vdecode';
import { frameFor, framedRect } from '../seq/frame';
import { transitionAt, activeExt, prevAdjacent, trDur, TR_TYPES, TR_GROUPS, TR_DIR } from '../seq/trans';
import { initTimeline } from '../seq/timeline';
import { energy, voiceRuns, keepRanges, pausesIn, removePauses, mapTime, PAUSE_PRESETS } from '../seq/silence';
import { stateDelta, newStates, statesEnd, stateEnd, full, isId as isIdDelta, ID as ID_DELTA } from '../states/states';
import { svgDoc } from '../svg/parse';
import { fileLayers } from '../svg/layers';
import * as PF from '../project/file';
import { enhanceSelect } from '../ui/picker';
import { starButton, setStar } from '../ui/star';
import { initPalette } from '../ui/cmdk';
import { saveFont, listFonts, deleteFont } from '../ui/fontstore';
import { groupCues, cueSegments, subAt, retext, splitBefore, mergeNext, shiftCues, mergeCues, trimCue, removeCue, usedRanges, toSrt } from '../subs/model';
import { SUB_DEF, SUB_PRESETS, styleOf, yFor } from '../subs/style';
import { drawSubs } from '../subs/render';
import { to16k, transcribe } from '../subs/transcribe';
import { Grader, GRADE0, LOOKS, isNeutral } from '../seq/grade';
import { corrections as stabCorrections, corrAt, shake as stabShake } from '../seq/stab';
import { analyze as stabAnalyze, loadTrack, saveTrack } from '../seq/stabscan';

/* ============================================================ state */
const FMT={'16:9':[1920,1080],'9:16':[1080,1920],'1:1':[1080,1080],'4:5':[1080,1350]};
const mkSlot=(fx,extra={})=>({fx,split:'char',stagger:.4,order:'start',ease:'fx',invert:false,prms:{},...extra});
function defaults(){return{
 v:2,fmt:'16:9',res:1,fps:30,
 text:'Ogni dettaglio\nconta',font:0,wght:600,italic:false,fs:170,fit:true,fitW:74,track:-20,lh:1.02,align:'center',tcase:'none',
 color:'#efece6',colorB:'#ff4d00',bg:'#121212',transparent:false,stroke:false,strokeW:2,colorIn:false,
 anchor:'mm',margin:8,offX:0,offY:0,bscale:1,
 block:{keys:[],mode:'none',fx:0,fy:0,tx:0,ty:0,s0:1,s1:1.06,r0:0,r1:0,ease:'inOutSine',from:'tl',to:'br',rotm:'none',rang:0,spin:0,pace:'lin',pow:3,hold:.35,drift:4,arc:0,m:2},
 delay:.25,dIn:1.1,hold:1.4,dOut:.7,tail:.35,
 seed:7,cam:newCamera(),states:newStates(),seq:newSeq(),media:[],
 inS:mkSlot('mask',{stagger:.35,ease:'fx'}),
 outMode:'mirror',
 outS:mkSlot('fade',{split:'word',stagger:.25,ease:'inCubic'}),
 loop:{fx:'none',when:'hold',prms:{}},
 images:[],layers:[],imgH:1.25,imgTint:false,
 blocks:[],cur:0,
 timeline:{markers:[],range:{enabled:false,start:0,end:0}},
}}
let S=defaults();
function prmOf(slot,list){const fx=list[slot.fx]||list[Object.keys(list)[0]];if(!slot.prms)slot.prms={};if(!slot.prms[slot.fx])slot.prms[slot.fx]={};const o=slot.prms[slot.fx];for(const d of fx.p)if(o[d.k]===undefined)o[d.k]=d.v;return o}
// campi che appartengono a un singolo blocco di testo; il resto di S è globale (formato, fps, sfondo, immagini, livelli)
const TEXTK=['text','font','wght','italic','fs','fit','fitW','track','lh','align','tcase','color','colorB','stroke','strokeW','colorIn','anchor','margin','offX','offY','block','delay','dIn','hold','dOut','tail','inS','outMode','outS','loop','imgH','imgTint','bscale'];
const GLOBALK=['fmt','res','fps','bg','transparent','seed','images','layers','cam','states'];
const pickText=o=>{const r={};for(const k of TEXTK)r[k]=o[k];return r};
// senza testo in nessun blocco i tempi del testo non contano: la durata la danno grafica e stati
const noText=st=>!(st.text||'').trim()&&!(st.blocks||[]).some(b=>(b.text||'').trim());
function clipTotal(st=S){let m=noText(st)&&((st.layers||[]).length||(st.states&&st.states.on))?1:timing(st).total;if(st.blocks&&st.blocks.length>1)st.blocks.forEach((b,i)=>{if(i!==st.cur)m=Math.max(m,timing({...st,...b}).total)});(st.layers||[]).forEach(L=>{if(L&&L.kind==='svg'&&!L.hidden)m=Math.max(m,svgEnd(L)+.8);else if(L&&L.img&&!L.hidden)m=Math.max(m,L.end>0?L.end:timing(st).total)});if(st.states&&st.states.on)m=Math.max(m,statesEnd(st.states)+.8);return m}
function timing(S){const inS=S.delay,outS=S.delay+S.dIn+S.hold,on=S.outMode!=='none';return{inS,holdS:S.delay+S.dIn,outS,total:outS+(on?S.dOut:0)+S.tail,on}}

/* ============================================================ images */
const IMGS={};
function loadImg(rec){return new Promise(r=>{const im=new Image();im.onload=()=>{IMGS[rec.id]=im;r(im)};im.onerror=()=>r(null);im.src=rec.src})}
const TINT=new Map();
// ponytail: colori animati (mixRGB) quantizzati a passi di 8 per non creare una canvas per frame
const qcol=c=>{const m=/^rgb\((\d+),(\d+),(\d+)\)$/.exec(c);return m?`rgb(${m.slice(1).map(v=>Math.min(255,Math.round(v/8)*8)).join(',')})`:c};
function tinted(id,color){color=qcol(color);const k=id+'|'+color;let c=TINT.get(k);if(c)return c;const im=IMGS[id];const nw=im.naturalWidth||512,nh=im.naturalHeight||512,sc=Math.min(1,1024/Math.max(nw,nh));c=document.createElement('canvas');c.width=Math.max(1,Math.round(nw*sc));c.height=Math.max(1,Math.round(nh*sc));const x=c.getContext('2d');x.drawImage(im,0,0,c.width,c.height);x.globalCompositeOperation='source-in';x.fillStyle=color;x.fillRect(0,0,c.width,c.height);if(TINT.size>24)TINT.clear();TINT.set(k,c);return c}
const imgAR=id=>{const im=IMGS[id];return im&&im.naturalWidth?im.naturalHeight/im.naturalWidth:1};

/* ============================================================ layout */
// movimenti "su tracciato" con la parola ripetuta: quante copie metterne sulla riga (1 = nessuna ripetizione)
function tpRep(lp){const f=lp&&LMAP[lp.fx];if(!f||f.c!=='Tracciato')return 0;return Math.max(1,Math.round(prmOf(lp,LMAP).rep||1))}
function layout(S,ctx,W,H){
 if(S.fit){const L0=layout({...S,fit:false,loop:S.loop&&(S.loop.fx==='marquee'||tpRep(S.loop)>1)?{fx:'none',when:'hold',prms:{}}:S.loop},ctx,W,H);const hl=S.fitW>100?Infinity:.86*H/Math.max(1,L0.bh);const k=Math.min(S.fitW/100*W/Math.max(1,L0.bw),hl);S.fs=Math.max(4,Math.round(S.fs*k*10)/10)}
 ctx.font=fontStr(S);if('letterSpacing' in ctx)ctx.letterSpacing='0px';
 let txt=S.text||'';if(S.tcase==='upper')txt=txt.toUpperCase();else if(S.tcase==='lower')txt=txt.toLowerCase();
 let lines=txt.split('\n');const tr=S.track/1000*S.fs,lh=S.fs*S.lh;let mqP=null,mq=null;
 if(S.loop&&S.loop.fx==='marquee'){mq=prmOf(S.loop,LMAP);({lines,mqP}=buildMarquee(lines,mq,ctx,W,H,tr))}
 else if(tpRep(S.loop)>1){const o=prmOf(S.loop,LMAP);lines=repeatLines(lines,o.rep,o.sep)}
 const mH=ctx.measureText('H'),capH=mH.actualBoundingBoxAscent||S.fs*.7;
 const fm=ctx.measureText('Hgjpqy');const asc=fm.fontBoundingBoxAscent||S.fs*.92,desc=fm.fontBoundingBoxDescent||S.fs*.26;
 const imgs=S.images||[];
 const LD=lines.map(l=>{const a=[],xs=[],ws=[];let x=0,gi=0;
  l.split(/(\{\d+\})/).forEach(part=>{if(!part)return;const m=part.match(/^\{(\d+)\}$/),rec=m&&imgs[+m[1]-1];
   if(rec&&IMGS[rec.id]){const ih=capH*S.imgH,iw=ih/imgAR(rec.id);a.push({img:rec.id,iw,ih});xs.push(x+gi*tr);ws.push(iw);x+=iw;gi++;return}
   const arr=Array.from(part);let pre='';for(const ch of arr){xs.push(x+ctx.measureText(pre).width+gi*tr);ws.push(ctx.measureText(ch).width);a.push(ch);pre+=ch;gi++}x+=ctx.measureText(part).width});
  return{a,xs,ws,w:gi?x+(gi-1)*tr:0}});
 const bw=mq?Math.max(1,...mqP):Math.max(1,...LD.map(l=>l.w)),bh=Math.max(1,lines.length)*lh;
 const base=capH/2,padY=S.fs*.06;
 const chars=[];const AL=mq?'center':S.align;
 LD.forEach((l,k)=>{const x0=AL==='left'?-bw/2:AL==='right'?bw/2-l.w:-l.w/2,cy=-bh/2+lh*(k+.5);let wi=0,inW=false;l.a.forEach((e,i)=>{const im=typeof e==='object';const sp=!im&&/\s/.test(e);if(sp){if(inW)wi++;inW=false}else inW=true;chars.push({ch:im?'':e,img:im?e.img:null,iw:im?e.iw:0,ih:im?e.ih:0,x:x0+l.xs[i],w:l.ws[i],cy,line:k,word:k*10000+wi,sp})})});
 const vis=chars.filter(c=>!c.sp);
 const groups={char:vis.map(c=>[c]),word:[],line:[],all:vis.length?[vis]:[]};
 const gb=(key,arr)=>{const m=new Map();for(const c of vis){const k=c[key];if(!m.has(k))m.set(k,[]);m.get(k).push(c)}arr.push(...m.values())};
 gb('word',groups.word);gb('line',groups.line);
 const mg=S.margin/100*Math.min(W,H),ay=S.anchor[0],ax=S.anchor[1];
 const ox=(ax==='l'?mg+bw/2:ax==='r'?W-mg-bw/2:W/2)+S.offX/100*W;
 const oy=(ay==='t'?mg+bh/2:ay==='b'?H-mg-bh/2:H/2)+S.offY/100*H;
 const units={};
 for(const key in groups){const arr=groups[key].map((cs,i)=>{let mn=Infinity,mx=-Infinity,cyMin=Infinity,cyMax=-Infinity,ihm=0;for(const c of cs){mn=Math.min(mn,c.x);mx=Math.max(mx,c.x+c.w);cyMin=Math.min(cyMin,c.cy);cyMax=Math.max(cyMax,c.cy);if(c.img)ihm=Math.max(ihm,c.ih)}const cx=(mn+mx)/2,cy=(cyMin+cyMax)/2;
   const by0=Math.min(cyMin-cy+base-asc-padY,cyMin-cy-ihm/2-padY),by1=Math.max(cyMax-cy+base+desc+padY,cyMax-cy+ihm/2+padY);
   return{i,cx,cy,w:mx-mn,line:cs[0].line,chars:cs.map((c,j)=>({ch:c.ch,img:c.img,iw:c.iw,ih:c.ih,j,rx:c.x+c.w/2-cx,ry:c.cy-cy})),by0,by1,fx:ox+cx,fy:oy+cy}});
   arr.forEach(u=>u.n=arr.length);arr.maxX=Math.max(1,...arr.map(u=>Math.abs(u.cx)));units[key]=arr}
 return{units,bw,bh,ox,oy,lh,base,asc,desc,capH,font:fontStr(S),nl:lines.length,mqP}
}
function order(mode,u,arr,nl){const n=arr.length;switch(mode){case'end':return n>1?1-u.i/(n-1):0;case'center':return Math.abs(u.cx)/arr.maxX;case'edges':return 1-Math.abs(u.cx)/arr.maxX;case'random':return R(u,77);case'lines':return nl>1?u.line/(nl-1):0;default:return n>1?u.i/(n-1):0}}

/* ============================================================ render */
function newState(){return{x:0,y:0,sx:1,sy:1,rot:0,skx:0,op:1,blur:0,mix:0,px:0,py:0,clip:0,wipe:null,slices:null,vs:null,frag:null,roll:null,bar:null,rgb:0,wght:null,hooks:[],echo:null,outl:0,outlW:0,dwipe:null,hroll:null,glow:null,ext:null,dash:null,pth:null,reveal:null}}
function unitP(slot,tp,D,u,arr,nl,E){const Sg=clamp(slot.stagger,0,.99),Lx=D*(1-Sg),off=order(slot.order,u,arr,nl)*D*Sg;const l=Lx>1e-6?clamp((tp-off)/Lx):(tp>=off?1:0);return E(l)}
function easeOf(slot,list){const e=slot.ease==='fx'?(list[slot.fx]?.rec?.ease||'outCubic'):slot.ease;return EZ[e]||EZ.outCubic}
function pathProg(x,b){switch(b.pace){case'lin':return x;case'ease':return EZ.inOutSine(x);case'slow':{const y=2*x-1;return .5+.5*Math.sign(y)*Math.abs(y)**b.pow}
 default:{const h=clamp(b.hold,0,.95),a=(1-h)/2,d=b.drift/100;if(h<1e-3)return EZ.inOutCubic(x);if(x<a)return EZ.outCubic(x/a)*(.5-d/2);if(x>1-a)return .5+d/2+EZ.inCubic((x-(1-a))/a)*(.5-d/2);return .5-d/2+d*(x-a)/h}}}
function pathPt(code,W,H,hw,hh){return{x:code[1]==='l'?-hw:code[1]==='r'?W+hw:W/2,y:code[0]==='t'?-hh:code[0]==='b'?H+hh:H/2}}
function keyAt(keys,t){const K=[...keys].sort((a,b)=>a.t-b.t);if(!K.length)return{x:0,y:0,s:1,r:0,op:1};if(t<=K[0].t)return K[0];const L=K[K.length-1];if(t>=L.t)return L;let i=1;while(K[i].t<t)i++;const a=K[i-1],b=K[i],e=(EZ[b.ease]||EZ.linear)((t-a.t)/Math.max(1e-6,b.t-a.t));return{x:lerp(a.x,b.x,e),y:lerp(a.y,b.y,e),s:lerp(a.s,b.s,e),r:lerp(a.r,b.r,e),op:lerp(a.op,b.op,e)}}
function blockXf(S,Lay,t,T,W,H){const b=S.block;let bx=Lay.ox,by=Lay.oy,bs=1,br=0,op=1;
 if(b.mode==='keys'){const k=keyAt(b.keys||[],t);bx+=k.x/100*W;by+=k.y/100*H;bs=k.s;br=k.r;op=clamp(k.op)}
 if(b.mode==='free'){const e=(EZ[b.ease]||EZ.linear)(clamp(t/T.total));bx+=lerp(b.fx,b.tx,e)/100*W;by+=lerp(b.fy,b.ty,e)/100*H;bs=lerp(b.s0,b.s1,e);br=lerp(b.r0,b.r1,e)}
 else if(b.mode==='path'){const e=pathProg(clamp(t/T.total),b);const A0=pathPt(b.from,W,H,0,0),B0=pathPt(b.to,W,H,0,0);let ang=Math.atan2(B0.y-A0.y,B0.x-A0.x)/D2R;if(b.from===b.to)ang=0;
  let rot=0;if(b.rotm==='follow'){rot=ang;if(rot>90)rot-=180;if(rot<-90)rot+=180}else if(b.rotm==='v')rot=-90;else if(b.rotm==='v2')rot=90;else if(b.rotm==='custom')rot=b.rang;
  const sc=Math.max(b.s0,b.s1)*(S.bscale||1),c=Math.abs(Math.cos(rot*D2R)),sn=Math.abs(Math.sin(rot*D2R)),m=b.m/100*Math.min(W,H);
  const hw=(c*Lay.bw+sn*Lay.bh)/2*sc+m,hh=(sn*Lay.bw+c*Lay.bh)/2*sc+m;const A=pathPt(b.from,W,H,hw,hh),B=pathPt(b.to,W,H,hw,hh);
  bx=lerp(A.x,B.x,e)+S.offX/100*W;by=lerp(A.y,B.y,e)+S.offY/100*H;
  if(b.arc){const dx=B.x-A.x,dy=B.y-A.y,l=Math.hypot(dx,dy)||1,o=Math.sin(Math.PI*e)*b.arc/100*Math.min(W,H);bx+=-dy/l*o;by+=dx/l*o}
  bs=lerp(b.s0,b.s1,e);br=rot+b.spin*e}
 return{bx,by,bs:bs*(S.bscale||1),br,op}}

function renderFrame(ctx,S,Lay,t,W,H,res,opts={}){
 ctx.setTransform(res,0,0,res,0,0);ctx.globalAlpha=1;if(HAS_FILTER)ctx.filter='none';
 if(!opts.overlay){ctx.clearRect(0,0,W,H);
 if(!S.transparent){ctx.fillStyle=opts.bg||S.bg;ctx.fillRect(0,0,W,H)}else if(opts.checker)checker(ctx,W,H)}
 G.E=S.fs;G.F=Math.floor(t*S.fps+1e-6);G.W=W;G.H=H;G.seed=S.seed;G.lh=Lay.lh;G.capH=Lay.capH;G.res=res;G.wght=S.wght;G.t=t;
 const cA=hexRGB(S.color),cB=hexRGB(S.colorB),TL={...timing(S),total:clipTotal(S)};
 const CP=camAt(S,Lay,t,W,H),camOn=!isIdent(CP);if(camOn){ctx.save();const M=camMatrix(CP,W,H);ctx.transform(M[0],M[1],M[2],M[3],M[4],M[5])}
 if(S.layers&&S.layers.length)drawLayers(ctx,S,Lay,t,W,H,'below',cA,cB,TL);
 (opts.blocks||blockList(S,Lay)).forEach(([st,ly],i)=>drawText(ctx,st,ly,t,W,H,'block:'+i));
 if(S.layers&&S.layers.length)drawLayers(ctx,S,Lay,t,W,H,'above',cA,cB,TL);
 if(camOn)ctx.restore();
 if(opts.guides)guides(ctx,W,H,res);
}
/* ============================================================ sequenza (timeline completa)
   S è la scena della clip di grafica attiva (quella nel pannello); le altre clip di grafica tengono la loro scena in clip.scene.
   Le chiavi di progetto (formato, fps, sequenza, file collegati, immagini) non fanno parte delle scene. */
const PROJK=['v','fmt','res','fps','seq','media','images'];
function sceneOf(st){const o={};for(const k in st)if(!PROJK.includes(k))o[k]=st[k];return JSON.parse(JSON.stringify(o))}
const actClip=()=>S.seq&&S.seq.clips.find(c=>c.id===S.seq.act)||null;
// t è il tempo della scena nel pannello; sulla timeline la clip parte da start e scorre alla sua velocità
const TG=()=>{const c=actClip();return c?c.start+(t-c.inp)/spd(c):t};
function setTG(T){const c=actClip();t=c?c.inp+(T-c.start)*spd(c):T;dirty=true}
const seqTot=()=>Math.max(.04,seqTotal(S.seq||{clips:[]}));
function clipName(st){const tx=(st.text||'').split('\n')[0].trim();if(tx)return tx.slice(0,28);const L=(st.layers||[]).find(l=>l.kind==='svg');return L?L.name||'Grafica':'Grafica'}
/** Garantisce una sequenza valida: se manca, la scena attuale diventa la prima clip di grafica. */
function ensureSeq(){if(!S.seq||!Array.isArray(S.seq.clips))S.seq=newSeq();if(!Array.isArray(S.seq.markers))S.seq.markers=[];if(!Array.isArray(S.media))S.media=[];
 // progetto nuovo (sequenza vuota): la scena diventa la prima clip di grafica; se ci sono solo video e audio si resta senza grafica
 if(!S.seq.clips.length){const c={id:uid('c'),kind:'motion',track:'G1',name:clipName(S),start:0,dur:+clipTotal().toFixed(3),inp:0,bg:'auto',auto:true};S.seq.clips.unshift(c);S.seq.act=c.id}
 if(!actClip()){const m=S.seq.clips.find(c=>c.kind==='motion');S.seq.act=m?m.id:null}}
/** Apre nel pannello la scena di un'altra clip di grafica. */
function activateClip(id){const seq=S.seq;if(!seq||seq.act===id)return;const nx=seq.clips.find(c=>c.id===id&&c.kind==='motion');if(!nx)return;const T=TG();
 const cur=actClip();if(cur)cur.scene=sceneOf(S);
 const keep={};for(const k of PROJK)if(k in S)keep[k]=S[k];
 S=Object.assign(defaults(),nx.scene||{},keep);S.seq.act=id;nx.scene=null;SCL.delete(id);
 UI.selKey=null;UI.selSvg=null;SEL=false;buildInspector();relayout();markTiles();setTG(T)}
// layout delle clip di grafica non attive (calcolato una volta)
const SCL=new Map();
function sceneLay(c){let e=SCL.get(c.id);if(e&&e.fmt===S.fmt)return e;const[W,H]=dims(),sc=Object.assign(defaults(),c.scene||{},{fmt:S.fmt,res:S.res,fps:S.fps,images:S.images});
 const Lay2=layout(sc,ctx,W,H);const blocks=sc.blocks&&sc.blocks.length>1?sc.blocks.map((b,i)=>{const st=i===sc.cur?sc:{...sc,...b};return[st,i===sc.cur?Lay2:layout(st,ctx,W,H)]}):null;
 e={sc,Lay:Lay2,blocks,fmt:S.fmt};SCL.set(c.id,e);return e}
/** Disegna la sequenza all'istante T. vf = fotogrammi dei video già pronti (esportazione); senza, si usano i lettori dell'anteprima. */
// tempo nella sorgente di un video, dentro il file (durante una transizione la clip va oltre i suoi bordi: si ferma al primo o all'ultimo fotogramma)
const vidT=(c,T)=>{const d=mediaInfo(c.media)?.dur;return clamp(localT(c,T),0,d?Math.max(0,d-.04):Infinity)};
// transizioni: le due clip si disegnano in due tele di appoggio e poi si fondono con l'effetto scelto
const TRB=[document.createElement('canvas'),document.createElement('canvas'),document.createElement('canvas')],TRL=document.createElement('canvas');
const ioc=p=>p<.5?4*p*p*p:1-(-2*p+2)**3/2;
const DV={L:[-1,0],R:[1,0],U:[0,-1],D:[0,1]};
function trComposite(cx,a,b,tr,p,opaque,res){const Wp=a.width,Hp=a.height,e=ioc(p);cx.save();cx.setTransform(1,0,0,1,0,0);cx.globalAlpha=1;
 const img=(c,al=1,s=1,dx=0,dy=0,bl=0)=>{if(al<=.002)return;cx.globalAlpha=al;if(HAS_FILTER)cx.filter=bl>.3?`blur(${bl.toFixed(1)}px)`:'none';const w=Wp*s,h=Hp*s;cx.drawImage(c,(Wp-w)/2+dx,(Hp-h)/2+dy,w,h);if(HAS_FILTER)cx.filter='none'};
 switch(tr.type){
  case'dip':if(opaque){cx.fillStyle='#000';cx.fillRect(0,0,Wp,Hp)}p<.5?img(a,1-2*p):img(b,2*p-1);break;
  case'flash':{img(p<.5?a:b);const w=Math.pow(1-Math.abs(2*p-1),1.6);cx.globalAlpha=w*.95;cx.fillStyle='#fff';cx.fillRect(0,0,Wp,Hp);break}
  case'zoom':{if(opaque){cx.fillStyle='#000';cx.fillRect(0,0,Wp,Hp)}const q=p<.5?(p*2)**2:((1-p)*2)**2,s=1+q*1.2,bl=q*14*res;if(p<.5)img(a,1,s,0,0,bl);else img(b,1,s,0,0,bl);
   const m=1-Math.min(1,Math.abs(p-.5)/.08);if(m>0){cx.globalAlpha=m*.6;cx.fillStyle='#fff';cx.fillRect(0,0,Wp,Hp)}break}
  case'push':{const v={L:[-1,0],R:[1,0],U:[0,-1],D:[0,1]}[tr.dir||'L'];img(a,1,1,v[0]*e*Wp,v[1]*e*Hp);img(b,1,1,-v[0]*(1-e)*Wp,-v[1]*(1-e)*Hp);break}
  case'blur':{const bl=Math.sin(Math.PI*p)*22*res;if(opaque){img(a,1,1,0,0,bl);img(b,e,1,0,0,bl)}else{img(a,1-e,1,0,0,bl);img(b,e,1,0,0,bl)}break}
  // frusta: la prima clip parte di scatto, la seconda arriva dall'altro lato; scia di movimento (copie sfalsate)
  case'whip':{const v=DV[tr.dir||'L'],k=1/(1+Math.exp(-14*(p-.5))),k0=1/(1+Math.exp(7)),q=(k-k0)/(1-2*k0),sm=Math.pow(1-Math.abs(2*p-1),1.5)*.22,N=7;
   for(const[src,base]of[[a,q],[b,q-1]])for(let n=0;n<N;n++){const o=base+(n/(N-1)-.5)*sm;img(src,N>1?1.7/N:1,1,v[0]*o*Wp,v[1]*o*Hp)}break}
  // glitch: fasce orizzontali spostate a caso e separazione dei colori attorno al taglio
  case'glitch':{const src=p<.5?a:b,w=1-Math.min(1,Math.abs(p-.5)/.35);img(src);if(w<=0)break;let sd=Math.floor(p*40)*9973+7;const rnd=()=>((sd=(sd*16807)%2147483647)/2147483647);
   for(let k=0;k<14;k++){const y=rnd()*Hp,h=(.01+rnd()*.07)*Hp,dx=(rnd()-.5)*.25*Wp*w;cx.drawImage(src,0,y,Wp,h,dx,y,Wp,h)}
   cx.globalCompositeOperation='screen';cx.globalAlpha=.55*w;cx.drawImage(src,14*res*w,0);cx.fillStyle='rgba(255,0,60,.35)';cx.globalCompositeOperation='multiply';cx.fillRect(0,0,Wp,Hp);cx.globalCompositeOperation='screen';cx.globalAlpha=.4*w;cx.drawImage(src,-14*res*w,0);cx.globalCompositeOperation='source-over';cx.globalAlpha=1;break}
  // luminosità: la seconda clip entra prima dove la prima è più scura
  case'luma':{img(a);const lw=160,lh=Math.max(1,Math.round(lw*Hp/Wp));TRL.width=lw;TRL.height=lh;const lg=TRL.getContext('2d',{willReadFrequently:true});lg.drawImage(a,0,0,lw,lh);const id=lg.getImageData(0,0,lw,lh),d=id.data;const Ls=new Float32Array(d.length/4);for(let k=0;k<d.length;k+=4)Ls[k/4]=(.299*d[k]+.587*d[k+1]+.114*d[k+2])/255;const so=Float32Array.from(Ls).sort(),q=x=>so[Math.max(0,Math.min(so.length-1,Math.floor(x*so.length)))],span=Math.max(.04,q(.95)-q(.05)),th=p<=0?-1:p>=1?2:q(p);   // a metà transizione è rivelata metà dell'immagine, dalle zone più scure
   for(let k=0;k<d.length;k+=4){const L=(.299*d[k]+.587*d[k+1]+.114*d[k+2])/255,m=Math.max(0,Math.min(1,(th-L)/(.15*span)+.5));d[k]=d[k+1]=d[k+2]=255;d[k+3]=m*255}lg.putImageData(id,0,0);
   const t2=TRB[2];if(t2.width!==Wp||t2.height!==Hp){t2.width=Wp;t2.height=Hp}const g2=t2.getContext('2d');g2.globalCompositeOperation='source-over';g2.clearRect(0,0,Wp,Hp);g2.drawImage(b,0,0);g2.globalCompositeOperation='destination-in';g2.imageSmoothingEnabled=true;g2.drawImage(TRL,0,0,Wp,Hp);g2.globalCompositeOperation='source-over';cx.drawImage(t2,0,0);break}
  // pellicola bruciata: dissolvenza con una luce calda che si accende sul taglio
  case'burn':{if(opaque){img(a);img(b,e)}else{img(a,1-e);img(b,e)}const w=Math.sin(Math.PI*p);cx.globalCompositeOperation='screen';
   const g=cx.createRadialGradient(Wp*(.15+.7*p),Hp*.35,0,Wp*(.15+.7*p),Hp*.35,Math.max(Wp,Hp)*.9);g.addColorStop(0,`rgba(255,190,90,${.95*w})`);g.addColorStop(.35,`rgba(255,90,30,${.6*w})`);g.addColorStop(1,'rgba(120,10,0,0)');cx.globalAlpha=1;cx.fillStyle=g;cx.fillRect(0,0,Wp,Hp);
   cx.fillStyle=`rgba(255,240,210,${.35*w*w})`;cx.fillRect(0,0,Wp,Hp);cx.globalCompositeOperation='source-over';break}
  // rotazione: la prima gira e si ingrandisce sfocandosi, la seconda finisce il giro
  case'spin':{if(opaque){cx.fillStyle='#000';cx.fillRect(0,0,Wp,Hp)}const first=p<.5,q=first?(p*2)**2:((1-p)*2)**2,ang=(first?q:-q)*Math.PI*.75,src=first?a:b;cx.save();cx.translate(Wp/2,Hp/2);cx.rotate(ang);cx.translate(-Wp/2,-Hp/2);img(src,1,1+q*.8,0,0,q*10*res);cx.restore();break}
  // cerchio: la seconda clip si apre da un cerchio al centro
  case'iris':{img(a);cx.save();cx.beginPath();cx.arc(Wp/2,Hp/2,e*Math.hypot(Wp,Hp)/2,0,Math.PI*2);cx.clip();img(b);cx.restore();break}
  // tendina con bordo morbido
  case'wipe':{img(a);const v=DV[tr.dir||'L'],t2=TRB[2];if(t2.width!==Wp||t2.height!==Hp){t2.width=Wp;t2.height=Hp}const g2=t2.getContext('2d');g2.globalCompositeOperation='source-over';g2.clearRect(0,0,Wp,Hp);g2.drawImage(b,0,0);
   // il bordo parte dal lato opposto alla direzione e attraversa il quadro; dietro di lui si vede la seconda clip
   const hz=v[1]===0,len=hz?Wp:Hp,fw=len*.06,pos=e*(len+2*fw)-fw,neg=(hz?v[0]:v[1])<0,edge=neg?len-pos:pos,a0=edge-fw,a1=edge+fw;
   const gr=hz?g2.createLinearGradient(a0,0,a1,0):g2.createLinearGradient(0,a0,0,a1);gr.addColorStop(0,`rgba(0,0,0,${neg?0:1})`);gr.addColorStop(1,`rgba(0,0,0,${neg?1:0})`);
   g2.globalCompositeOperation='destination-in';g2.fillStyle=gr;g2.fillRect(0,0,Wp,Hp);g2.globalCompositeOperation='source-over';cx.drawImage(t2,0,0);break}
  // pixel: la prima si scompone in quadratoni, la seconda si ricompone
  case'pixel':{const first=p<.5,q=first?p*2:(1-p)*2,bs=Math.max(1,Math.round(1+q*q*60*res)),src=first?a:b,t2=TRB[2],sw=Math.max(1,Math.round(Wp/bs)),sh=Math.max(1,Math.round(Hp/bs));
   if(t2.width!==Wp||t2.height!==Hp){t2.width=Wp;t2.height=Hp}const g2=t2.getContext('2d');g2.clearRect(0,0,Wp,Hp);g2.imageSmoothingEnabled=true;g2.drawImage(src,0,0,sw,sh);cx.imageSmoothingEnabled=false;cx.drawImage(t2,0,0,sw,sh,0,0,Wp,Hp);cx.imageSmoothingEnabled=true;break}
  // fasce: la seconda clip entra a strisce, da lati alterni, una dopo l'altra
  case'slices':{img(a);const N=7,v=DV[tr.dir||'L'],hz=v[1]===0;for(let k=0;k<N;k++){const q=Math.max(0,Math.min(1,(p-k/N*.45)/.55)),ee=ioc(q),sgn=(k%2?-1:1)*(hz?v[0]:v[1]);if(ee<=0)continue;
    if(hz){const y=k*Hp/N,h=Math.ceil(Hp/N)+1;cx.drawImage(b,0,y,Wp,h,sgn*(1-ee)*Wp,y,Wp,h)}else{const x=k*Wp/N,w=Math.ceil(Wp/N)+1;cx.drawImage(b,x,0,w,Hp,x,sgn*(1-ee)*Hp,w,Hp)}}break}
  default:if(opaque){img(a);img(b,p)}else{img(a,1-p);img(b,p)}}
 cx.restore()}
function renderSeq(cx,T,W,H,res,opts={}){const seq=S.seq,vis=visibleAt(seq,T);
 cx.setTransform(res,0,0,res,0,0);cx.globalAlpha=1;if(HAS_FILTER)cx.filter='none';cx.clearRect(0,0,W,H);
 // per traccia, dal basso: una clip, oppure due durante una transizione
 const tracks=[...new Set(seq.clips.filter(c=>c.kind!=='audio'&&activeExt(seq,c,T)).map(c=>c.track))].sort((a,b)=>drawRank(a)-drawRank(b));
 const items=tracks.map(tk=>{const t=transitionAt(seq,tk,T);if(t&&!t.a.adj&&!t.b.adj)return{t};const c=vis.find(x=>x.track===tk);return c?{c}:null}).filter(Boolean);
 if(!items.length){if(!S.transparent){cx.fillStyle=S.bg;cx.fillRect(0,0,W,H)}else if(opts.checker)checker(cx,W,H)}
 items.forEach((it,i)=>{if(it.c)return drawClipAt(cx,it.c,T,i,W,H,res,opts);
  const Wp=Math.round(W*res),Hp=Math.round(H*res);for(const b of TRB){if(b.width!==Wp||b.height!==Hp){b.width=Wp;b.height=Hp}}
  [it.t.a,it.t.b].forEach((c,k)=>{const g=TRB[k].getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,Wp,Hp);drawClipAt(g,c,T,i,W,H,res,opts)});
  trComposite(cx,TRB[0],TRB[1],it.t.tr,it.t.p,it.t.a.kind==='video'&&it.t.b.kind==='video',res);cx.setTransform(res,0,0,res,0,0)});
 cx.setTransform(res,0,0,res,0,0);drawSubsAt(cx,T,W,H);if(opts.guides)guides(cx,W,H,res)}
function drawClipAt(cx,c,T,i,W,H,res,opts){const seq=S.seq,lt=localT(c,T);cx.setTransform(res,0,0,res,0,0);cx.globalAlpha=1;
  if(c.adj){applyAdjust(cx,c,T,opts);return}
  if(c.kind==='video'){if(i===0){cx.fillStyle='#000';cx.fillRect(0,0,W,H)}
   drawVid(cx,c,W,H,opts,true);
   // confronto prima/dopo (solo in anteprima, sulla clip selezionata): a sinistra della linea il video senza correzione
   if(!opts.vf&&UI.colCmp&&hasGrade(c)&&selSet().has(c.id)){cx.save();cx.beginPath();cx.rect(0,0,W/2,H);cx.clip();cx.fillStyle='#000';cx.fillRect(0,0,W/2,H);drawVid(cx,c,W,H,opts,false);cx.restore();cx.fillStyle='rgba(255,255,255,.85)';cx.fillRect(W/2-1,0,2,H)}
   return}
  const act=c.id===seq.act,e=act?null:sceneLay(c),sc=act?S:e.sc,ly=act?Lay:e.Lay;if(!ly)return;
  const bg=c.bg==='on'||(c.bg!=='off'&&i===0);
  renderFrame(cx,sc,ly,lt,W,H,res,{overlay:!bg||i>0,checker:opts.checker&&i===0,blocks:act?null:e.blocks})}
// lettori dell'anteprima. Ogni pezzo di video ha un "posto" (lettore): pezzi vicini dello stesso file usano lettori diversi,
// così il pezzo successivo può essere preparato (posizionato sul suo primo fotogramma) prima del taglio.
// In riproduzione i lettori seguono la testina, in pausa si posizionano sul fotogramma; quelli non usati si fermano.
let VSLOT=new Map();
const PREROLL=1.5;
function videoSlots(){const m=new Map(),by={};for(const c of S.seq.clips)if(c.kind==='video'&&c.media)(by[c.media]||(by[c.media]=[])).push(c);
 for(const id in by){const ends=[];for(const c of by[id].sort((a,b)=>a.start-b.start)){let k=0;while(ends[k]!=null&&ends[k]>c.start-PREROLL)k++;ends[k]=clipEnd(c);m.set(c.id,k)}}return m}
function syncVideos(T,play){if(!S.seq)return;VSLOT=videoSlots();const used=new Set();
 const list=S.seq.clips.filter(c=>c.kind==='video'&&c.media).map(c=>{const vis=activeExt(S.seq,c,T);return{c,vis,soon:!vis&&c.start>T-1e-6&&c.start-T<PREROLL}}).filter(x=>x.vis||x.soon).sort((a,b)=>(b.vis?1:0)-(a.vis?1:0));
 for(const{c,vis}of list){const slot=VSLOT.get(c.id)||0,key=c.media+'#'+slot;if(used.has(key))continue;const v=MED.videoOf(c.media,slot);if(!v)continue;used.add(key);
  if(!v._moto){v._moto=1;v.addEventListener('seeked',()=>{dirty=true});v.addEventListener('loadeddata',()=>{dirty=true})}
  if(vis){const lt=vidT(c,T);if(v.playbackRate!==spd(c))v.playbackRate=spd(c);if(play){if(v.paused)v.play().catch(()=>{});if(Math.abs(v.currentTime-lt)>.2)v.currentTime=lt}else{if(!v.paused)v.pause();if(Math.abs(v.currentTime-lt)>.5/S.fps&&!v.seeking)v.currentTime=lt}}
  else{if(!v.paused)v.pause();if(Math.abs(v.currentTime-c.inp)>.02&&!v.seeking)v.currentTime=c.inp}}
 for(const[k,v]of MED.allVideos())if(!used.has(k)&&!v.paused)v.pause()}
// copia dell'ultimo fotogramma buono di ogni lettore: si mostra mentre il lettore cerca il fotogramma successivo
// (testina spostata in pausa, frecce, trascinamento), così l'anteprima non lampeggia di nero. In riproduzione si aggiorna ogni tanto.
function keepFrame(v){if(playing&&((v._kf=(v._kf||0)+1)%6))return;if(v._keepT===shownT(v)&&v._keep)return;const vw=v.videoWidth,vh=v.videoHeight;if(!vw||!vh)return;
 let c=v._keep;if(!c){c=document.createElement('canvas');const k=Math.min(1,1080/Math.max(vw,vh));c.width=Math.max(1,Math.round(vw*k));c.height=Math.max(1,Math.round(vh*k));v._keep=c}
 c.getContext('2d').drawImage(v,0,0,c.width,c.height);v._keepT=shownT(v)}
/** Video stabilizzato in anteprima: il lettore spesso ha già un fotogramma più nuovo (20–40 ms) di quello che dicono currentTime
 *  e il callback dei fotogrammi; il fotogramma preso come VideoFrame porta il suo tempo esatto. Si disegna e si rilascia subito
 *  (tenerlo da parte, o copiarlo, faceva saltare fotogrammi al lettore). */
function drawStab(cx,v,c,W,H,fr,G){if(typeof VideoFrame==='undefined')return false;let f;try{f=new VideoFrame(v)}catch(e){return false}
 try{const t=f.timestamp/1e6,w=v.videoWidth,h=v.videoHeight,g=G(v,w,h);drawRotated(cx,g===v?f:g,g===v?f.displayWidth:w,g===v?f.displayHeight:h,0,W,H,c.fit||'cover',fr,stabAt(c,Math.abs(t-v.currentTime)<.5?t:v.currentTime))}finally{f.close()}return true}
/* correzione colore: c.color = { on, exp, con, hi, sh, temp, tint, sat, vib }; si calcola sulla scheda video (Grader) */
let GRD=null;const grader=()=>GRD||(GRD=new Grader());
/** Livello di regolazione (clip "Regolazione" su una traccia Video): corregge tutto ciò che è già disegnato sotto, cioè i video
 *  delle tracce più basse. Le dissolvenze della clip lo fanno entrare e uscire gradualmente. La grafica sta sopra e non si tocca. */
function applyAdjust(cx,c,T,opts){const g=c.color;if(!g||isNeutral(g)||!grader().ok)return;const cv=cx.canvas,w=cv.width,h=cv.height;
 const fi=c.fadeIn||0,fo=c.fadeOut||0,a=Math.max(0,Math.min(1,fi?(T-c.start)/fi:1,fo?(clipEnd(c)-T)/fo:1));if(a<=0)return;
 const out=grader().apply(cv,w,h,g,Math.max(w,h));if(!out)return;cx.save();cx.setTransform(1,0,0,1,0,0);cx.globalAlpha=a;cx.globalCompositeOperation='copy';
 if(a<1)cx.globalCompositeOperation='source-over';cx.drawImage(out,0,0,w,h);cx.restore()}
function newAdjustClip(){const T=TG(),seq=S.seq,vt=tracksOf(seq).filter(t=>t.kind==='video').sort((a,b)=>trackNum(b.id)-trackNum(a.id));
 // va sulla traccia video più alta; se lì alla testina c'è già qualcosa, su una traccia nuova sopra
 let tr=vt[0]?.id||'V1';if(seq.clips.some(c=>c.track===tr&&isActive(c,T))||vt.length<2&&seq.clips.some(c=>c.track===tr))tr=addTrack(seq,'video');
 const dur=Math.max(3,+(seqTot()-T).toFixed(3)),c={id:uid('c'),kind:'video',adj:true,track:tr,name:'Regolazione',start:0,dur,inp:0,fadeIn:0,fadeOut:0,color:{...GRADE0,on:true}};
 c.start=freeSlot(seq,tr,T,c.dur);seq.clips.push(c);setUI('clipTab','color');selectClip(c.id);seqCommit();showTab('prop');reveal(UI.clipSec);toast('Livello di regolazione: corregge i video sotto per tutta la sua durata. Allungalo o accorcialo come una clip')}
const hasGrade=c=>!!(c.color&&c.color.on&&!isNeutral(c.color));
/** Disegna il fotogramma della clip video (esportazione: fotogramma esatto; anteprima: lettore), con stabilizzazione e colore. */
function drawVid(cx,c,W,H,opts,useG){const fr=frameFor(c,S.fmt),sb=c.stab&&c.stab.on,gr=useG&&hasGrade(c)?c.color:null,f=opts.vf&&opts.vf.get(c.id),fit=c.fit||'cover';
 const G=(src,sw,sh)=>gr&&grader().ok?grader().apply(src,sw,sh,gr,opts.vf?4096:1920)||src:src;
 if(f){const w=f.frame.displayWidth,h=f.frame.displayHeight;drawRotated(cx,G(f.frame,w,h),w,h,f.rot,W,H,fit,fr,sb?stabAt(c,f.frame.timestamp/1e6):null);return}
 const v=MED.videoOf(c.media,VSLOT.get(c.id)||0);if(!v)return;
 if(v.readyState>=2&&!v.seeking){if(sb&&drawStab(cx,v,c,W,H,fr,G)){keepFrame(v);return}drawRotated(cx,G(v,v.videoWidth,v.videoHeight),v.videoWidth,v.videoHeight,0,W,H,fit,fr,sb?stabAt(c,shownT(v)):null);keepFrame(v)}
 else if(v._keep)drawRotated(cx,G(v._keep,v._keep.width,v._keep.height),v._keep.width,v._keep.height,0,W,H,fit,fr,sb?stabAt(c,v._keepT):null)}
/** Tempo del fotogramma che il lettore sta mostrando (dal callback dei fotogrammi; se manca, currentTime). */
const shownT=v=>v._mt!=null&&Math.abs(v._mt-v.currentTime)<.25?v._mt:v.currentTime;
const SA=new SeqAudio();
// canali del file (misurati una volta) e modalità della clip: auto = quella consigliata dalla misura
const CHI=new Map();
const chInfo=id=>{let i=CHI.get(id);if(i)return i;const b=MED.audioReady(id);if(!b)return null;i=analyzeChannels([...Array(b.numberOfChannels)].map((_,k)=>b.getChannelData(k)));CHI.set(id,i);return i};
const chMode=c=>c.ch&&c.ch!=='auto'?c.ch:(chInfo(c.media)?.use||'stereo');
// audio pronto da suonare: canali sistemati (voce su un lato copiata su entrambi…) e, a velocità diversa, tono della voce mantenuto.
// Si prepara una volta per file, canali e velocità.
const STR=new Map();
const bufOf=c=>{if(!c.media)return null;const b=MED.audioReady(c.media);if(!b)return null;const sp=spd(c),st=sp!==1&&c.keepPitch!==false,mode=chMode(c);if(!st&&mode==='stereo')return b;
 const k=c.media+'|'+mode+'|'+(st?sp:1);let o=STR.get(k);
 if(!o){let chs=applyChannels([...Array(b.numberOfChannels)].map((_,i)=>b.getChannelData(i)),mode);if(st){if(chs[0]===chs[1]){const[x]=stretch([chs[0]],b.sampleRate,sp);chs=[x,x]}else chs=stretch(chs,b.sampleRate,sp)}
  o=new AudioBuffer({length:chs[0].length,numberOfChannels:2,sampleRate:b.sampleRate});chs.forEach((d,i)=>o.copyToChannel(d,i));if(st)o._stretch=sp;STR.set(k,o)}return o};
// mix (impostazioni della sequenza in S.seq.mix): ogni file si livella (voce −16 LUFS, musica −20), la musica scende sotto la voce,
// poi il mix intero va al volume finale (Instagram: −14 LUFS) con un limitatore contro i picchi
const MIXD={norm:true,target:-14,limit:true,ceil:-1,duck:true,depth:12,attack:.25,release:.6};
const mixCfg=()=>S.seq.mix||(S.seq.mix={...MIXD});
const ROLE_T={voice:-16,music:-20},ROLE_N={voice:'voce',music:'musica',fx:'ambiente'};
const roleAuto=c=>c.kind==='audio'?'music':(chInfo(c.media)?.kind==='stereo'?'fx':'voice');
const roleOf=c=>c.role&&c.role!=='auto'?c.role:roleAuto(c);
const LOUD=new Map();
const loudOf=c=>{const b=MED.audioReady(c.media);if(!b)return null;const m=chMode(c),k=c.media+'|'+m;if(LOUD.has(k))return LOUD.get(k);const L=loudness(applyChannels([...Array(b.numberOfChannels)].map((_,i)=>b.getChannelData(i)),m),b.sampleRate);LOUD.set(k,L);return L};
const clipNormGain=c=>{if(c.norm===false||!c.media)return 1;const T=ROLE_T[roleOf(c)];if(T==null)return 1;const L=loudOf(c);return L==null?1:gainTo(L,T,20)};
const RUNS=new Map();
const runsOf=id=>{if(RUNS.has(id))return RUNS.get(id);const e=pzEnergy(id);if(!e)return null;const r=voiceRuns(e,.35,.35);RUNS.set(id,r);return r};
/** Dove si parla, sulla timeline (clip con la voce, non mute), con le pause brevi riempite. */
function voiceTL(){const out=[];for(const c of S.seq.clips){if(!c.media||c.mute||roleOf(c)!=='voice')continue;const r=runsOf(c.media);if(!r)continue;const sp=spd(c),a=c.inp,b=c.inp+c.dur*sp;
 for(const[x,y]of r){const u=Math.max(a,x),w=Math.min(b,y);if(w>u)out.push([c.start+(u-a)/sp,c.start+(w-a)/sp])}}return voiceRegions(out,.8)}
const mixOpts=()=>{const m=mixCfg(),reg=m.duck?voiceTL():null;return{gainOf:clipNormGain,duck:c=>reg&&reg.length&&roleOf(c)==='music'?duckPoints(reg,{depthDb:m.depth,attack:m.attack,release:m.release},c.start,clipEnd(c)):null}};
let MG=1,MIXL=null;
const saStart=T=>{const m=mixCfg();SA.start(S.seq,T,bufOf,mixOpts(),m.norm?MG:1,m.limit?m.ceil:null)};
// volume dell'intero mix: si misura poco dopo ogni modifica (serve a portarlo al volume finale anche nell'anteprima)
let mixTm=0;
function measureMix(){clearTimeout(mixTm);mixTm=setTimeout(async()=>{const tot=seqTot();if(!hasSeqAudio()||tot<.1){MIXL=null;MG=1;mixInfo();return}
 try{const mix=await mixdown(S.seq,tot,bufOf,mixOpts());MIXL=loudness([mix.getChannelData(0),mix.getChannelData(1)],mix.sampleRate);MG=gainTo(MIXL,mixCfg().target,12)}catch(e){MIXL=null;MG=1}
 SA.setGain(mixCfg().norm?MG:1);mixInfo()},600)}
function mixInfo(){const e=UI.mixInfo;if(!e)return;const m=mixCfg();if(MIXL==null||!isFinite(MIXL)){e.textContent=hasSeqAudio()?'Misuro il mix…':'Nessun audio nella sequenza.';return}
 const g=20*Math.log10(MG);e.innerHTML=`Mix: <b>${MIXL.toFixed(1)} LUFS</b>`+(m.norm?` → portato a ${m.target} (${g>=0?'+':''}${g.toFixed(1)} dB)`:'')}
function loadAudio(){for(const m of S.media||[])if(MED.hasFile(m.id))MED.audioOf(m.id,SA.ctx())}
/* camera: i target sono "block:<i>" (riquadro del testo), "svg:<id>:<parte>" (mark, naming, payoff, all) e "pen:<id>" (punta della penna) */
function camResolver(S,Lay,W,H){return(tg,tt)=>{const p=String(tg||'').split(':');
 if(p[0]==='block'){const e=blockList(S,Lay)[+p[1]||0];if(!e)return null;const[st,ly]=e,X=blockXfS(st,ly,tt,timing(st),W,H,'block:'+(+p[1]||0));return[X.bx-ly.bw*X.bs/2,X.by-ly.bh*X.bs/2,ly.bw*X.bs,ly.bh*X.bs]}
 const L=(S.layers||[]).find(l=>l.kind==='svg'&&l.id===p[1]);if(!L)return null;const ez=EZ[L.mvEase];
 if(p[0]==='pen'){const q=svgPenTip(L,tt,W,H,ez);return q?[q[0],q[1],0,0]:null}
 if(p[0]!=='svg')return null;const b=svgPartBox(L,p[2]||'all',tt,W,H,ez),d=stDelta(S,'svg:'+L.id,tt);if(!b||isIdDelta(d))return b;
 const cx=b[0]+b[2]/2+d.dx/100*W,cy=b[1]+b[3]/2+d.dy/100*H;return[cx-b[2]*d.s/2,cy-b[3]*d.s/2,b[2]*d.s,b[3]*d.s]}}
const camEase=n=>EZ[n]||EZ.inOutCubic;
// inquadratura della scena: camera del progetto, più le inquadrature degli SVG (riprese ravvicinate durante la costruzione)
function camAt(S,Lay,t,W,H){let P=S.cam&&S.cam.on?camPose(S.cam,t,W,H,camResolver(S,Lay,W,H),camEase):IDENT;
 for(const L of S.layers||[]){if(L.kind!=='svg'||L.hidden||!L.shots||!L.shots.on)continue;const ic=svgShotsCam(L,t,W,H,EZ[L.mvEase]);if(ic)P=mixPose(P,ic.pose,ic.w)}return P}
function normCam(c){const b=newCamera();if(!c||typeof c!=='object')return b;return{...b,...c,keys:Array.isArray(c.keys)?c.keys.filter(k=>k&&typeof k.t==='number'):[],follow:{...b.follow,...(c.follow||{})},shake:{...b.shake,...(c.shake||{})}}}
/* stati di layout: ogni elemento ha una chiave (block:<i>, svg:<id>, img:<id>); l'ordine delle chiavi dà l'ordine dello sfasamento */
function elemKeys(st){const o=[],n=st.blocks&&st.blocks.length>1?st.blocks.length:1;for(let i=0;i<n;i++)o.push('block:'+i);(st.layers||[]).forEach(L=>o.push((L.kind==='svg'?'svg:':'img:')+L.id));return o}
function stDelta(st,key,t){if(!st||!st.states||!st.states.on||!key)return ID_DELTA;return stateDelta(st.states,key,elemKeys(st),t,n=>EZ[n]||EZ.inOutCubic)}
function blockXfS(st,ly,t,T,W,H,key){const X=blockXf(st,ly,t,T,W,H),d=stDelta(st,key,t);if(isIdDelta(d))return X;return{bx:X.bx+d.dx/100*W,by:X.by+d.dy/100*H,bs:X.bs*d.s,br:X.br+d.r,op:X.op*d.op}}
// blocchi non attivi: stato + layout calcolati in relayout() (BL); quello attivo è S stesso
let BL=[];
function blockList(st,Lay){if(!st.blocks||st.blocks.length<2)return[[st,Lay]];return st.blocks.map((b,i)=>{if(i===st.cur)return[st,Lay];const e=BL[i];if(!e)return null;for(const k of GLOBALK)e.st[k]=st[k];return[e.st,e.lay]}).filter(Boolean)}
function drawText(ctx,S,Lay,t,W,H,key){
 G.E=S.fs;G.lh=Lay.lh;G.capH=Lay.capH;G.wght=S.wght;G.mqP=Lay.mqP||null;G.bw=Lay.bw;
 const T=timing(S);G.tot=T.total;const cA=hexRGB(S.color),cB=hexRGB(S.colorB);
 ctx.save();
 const X=blockXfS(S,Lay,t,T,W,H,key);
 ctx.translate(X.bx,X.by);if(X.br)ctx.rotate(X.br*D2R);if(X.bs!==1)ctx.scale(X.bs,X.bs);
 G.blk=ctx.getTransform();G.blkInv=G.blk.inverse();
 const out=T.on&&t>=T.outS,custom=out&&S.outMode==='custom';
 const slot=custom?S.outS:S.inS,fx=FXMAP[slot.fx]||FX[0],o=prmOf(slot,FXMAP),E=easeOf(slot,FXMAP);
 const arr=Lay.units[slot.split]||Lay.units.char;
 const D=out?S.dOut:S.dIn,inf={L:D*(1-clamp(slot.stagger,0,.99))};
 const lf=LMAP[S.loop.fx]||LOOPS[0],lo=prmOf(S.loop,LMAP);
 let env=1;if(S.loop.when==='hold'){const r=.35;env=clamp((t-T.holdS)/r)*(T.on?clamp((T.outS-t)/r):1)}
 const cols={A:S.color,B:S.colorB};
 if(lf.xf&&env>0)lf.xf(ctx,lo,t,env);
 const list=[];
 for(const u of arr){const s=newState();let p;
  if(!out)p=unitP(slot,t-T.inS,S.dIn,u,arr,Lay.nl,E);
  else if(!custom)p=unitP(slot,S.dOut-(t-T.outS),S.dOut,u,arr,Lay.nl,E);
  else p=1-unitP(slot,t-T.outS,S.dOut,u,arr,Lay.nl,E);
  if(Math.abs(p-1)>1e-6)fx.f(s,p,u,o,inf);
  if(custom&&slot.invert){s.x=-s.x;s.y=-s.y;s.rot=-s.rot;s.skx=-s.skx}
  if(S.colorIn)s.mix+=clamp(1-p);
  if(lf.id!=='none'&&env>0)lf.f(s,t,u,lo,env);
  list.push([u,s])}
 if(X.op!==1)for(const e of list)e[1].op*=X.op;
 for(const[u,s]of list)drawUnit(ctx,S,Lay,u,s,cA,cB);
 if(fx.post)fx.post(ctx,list,o,S,Lay,t,cols);
 ctx.restore();
}
// SVG con gli effetti della libreria (modo "Effetto"): il disegno, con i colori scelti, diventa un'immagine (intera o una per forma)
// e si anima come un livello immagine: stesse entrate, uscite e movimenti continui. A pezzi ogni forma entra con un piccolo ritardo.
const SVGR=new Map();
const lyrOf=doc=>doc._lyr||(doc._lyr=fileLayers(doc.els));
const lyrOn=(L,doc)=>{const ly=lyrOf(doc);return ly.length>1&&ly.some(l=>L.lyr&&L.lyr[l.key]&&L.lyr[l.key].on)};
function svgRaster(L,W){const doc=svgDoc(L.src);if(!doc)return null;const[vx,vy,vw,vh]=doc.vb;
 const pw=Math.min(4096,Math.max(256,Math.ceil(L.size/100*W*(G.res||1)*1.25/128)*128)),k=pw/vw;
 const lo=lyrOn(L,doc),key=[L.cMark,L.cMarkC,S.color,S.colorB,L.pieces?1:0,lo?1:0,pw].join('|');let r=SVGR.get(L.id);if(r&&r.key===key&&r.src===L.src)return r;
 const draw=(only,bb)=>{const c=document.createElement('canvas'),[bx,by,bw,bh]=bb;c.width=Math.max(1,Math.ceil(bw*k));c.height=Math.max(1,Math.ceil(bh*k));c.naturalWidth=c.width;c.naturalHeight=c.height;
  const fake={...L,mode:'none',shots:null,mv:false,lock:false,start:0,op:1,x:k*(vx+vw/2-bx)/c.width*100,y:k*(vy+vh/2-by)/c.height*100,size:k*vw/c.width*100};
  drawSvg(c.getContext('2d'),fake,0,c.width,c.height,S.color,S.colorB,undefined,undefined,only);return c};
 r={key,src:L.src,whole:{id:'svr:'+L.id,c:draw(e=>e.role!=='guide',doc.vb),bb:doc.vb},pieces:[]};
 if(L.pieces)doc.els.filter(e=>e.role!=='guide').forEach((e,i)=>{const pad=Math.max((e.sw||0)*2,vw*.004),bb=[e.bb[0]-pad,e.bb[1]-pad,e.bb[2]+pad*2,e.bb[3]+pad*2];r.pieces.push({id:'svr:'+L.id+':'+i,c:draw(x=>x===e,bb),bb})});
 r.layers=[];if(lo)lyrOf(doc).forEach((ly,i)=>{const set=new Set(ly.els),pad=vw*.006,bb=[ly.bb[0]-pad,ly.bb[1]-pad,ly.bb[2]+pad*2,ly.bb[3]+pad*2];r.layers.push({id:'svr:'+L.id+':L'+i,key:ly.key,c:draw(e=>set.has(e.i),bb),bb})});
 IMGS[r.whole.id]=r.whole.c;r.pieces.forEach(p=>IMGS[p.id]=p.c);r.layers.forEach(p=>IMGS[p.id]=p.c);TINT.clear();SVGR.set(L.id,r);return r}
const PORDER={lr:(a,b)=>a.bb[0]-b.bb[0],tb:(a,b)=>a.bb[1]-b.bb[1]};
function drawSvgFx(ctx,S,Lay,L,li,t,W,H,sd,cA,cB){const r=svgRaster(L,W);if(!r)return;const doc=svgDoc(L.src),[vx,vy,vw,vh]=doc.vb;
 const ti=t-(L.start||0);if(ti<0)return;const dIn=L.dIn??.8,dOut=L.dOut??.6,out=L.outMode==='mirror',ownL=Object.values(L.lyr||{}).filter(x=>x&&x.on),oS=Math.max(dIn,...ownL.map(x=>(x.at||0)+(x.dIn??.8)))+(L.hold??2);if(out&&ti>oS+Math.max(dOut,...ownL.map(x=>x.dOut??.6))+1e-6)return;
 const kk=L.size/100*W/vw*sd.s,x=W*(L.x+sd.dx)/100,y=H*(L.y+sd.dy)/100,fx=FXMAP[L.fx]||FXMAP.fade,o=prmOf(L,FXMAP),E=easeOf(L,FXMAP),E0=G.E;
 let parts=r.layers.length?[...r.layers]:L.pieces&&r.pieces.length?[...r.pieces]:[r.whole];
 if(parts.length>1){const cx0=vx+vw/2,cy0=vy+vh/2;if(L.porder==='center')parts.sort((a,b)=>Math.hypot(a.bb[0]+a.bb[2]/2-cx0,a.bb[1]+a.bb[3]/2-cy0)-Math.hypot(b.bb[0]+b.bb[2]/2-cx0,b.bb[1]+b.bb[3]/2-cy0));else if(PORDER[L.porder])parts.sort(PORDER[L.porder])}
 const gen=parts.filter(p=>!(p.key&&L.lyr&&L.lyr[p.key]&&L.lyr[p.key].on)),n=gen.length,sg=n>1&&L.pieces?clamp(L.pstag??.5,0,.95):0,win=d=>Math.max(1e-4,d*(1-sg));
 G.E=Math.max(vw,vh)*kk*.5;ctx.save();ctx.translate(x,y);if(L.rot||sd.r)ctx.rotate(((L.rot||0)+sd.r)*D2R);
 parts.forEach((pc,k)=>{const[bx,by,bw,bh]=pc.bb,w=bw*kk,h=bh*kk;
  const u={i:li*1000+500+k,n,cx:(bx+bw/2-(vx+vw/2))*kk,cy:(by+bh/2-(vy+vh/2))*kk,w,by0:-h/2,by1:h/2,fx:x,fy:y,line:0,chars:[{img:pc.id,j:0,rx:0,ry:0,iw:w,ih:h,tint:'none'}]};
  // livello del file con animazione propria: effetto, ritardo e durate suoi; gli altri seguono il logo (sfasati se "a pezzi")
  const own=pc.key&&L.lyr&&L.lyr[pc.key]&&L.lyr[pc.key].on?L.lyr[pc.key]:null,gi=gen.indexOf(pc),of2=own?0:(n>1?gi/(n-1)*sg:0),w2=own?(d=>Math.max(1e-4,d)):win;
  const F=own?FXMAP[own.fx]||FXMAP.fade:fx,O=own?prmOf(own,FXMAP):o,EE=own?easeOf(own,FXMAP):E,at=own?own.at||0:0,dI=own?own.dIn??.8:dIn,dO=own?own.dOut??.6:dOut,lp=own?own.lp:L.lp;
  let p=1,LL=dI;if(ti<at+dI)p=EE(clamp((ti-at-of2*dI)/w2(dI)));else if(out&&ti>oS){LL=dO;const q=clamp((ti-oS-of2*dO)/w2(dO));p=F.exit?1-EE(q):EE(1-q)}
  const s=newState();if(Math.abs(p-1)>1e-6)F.f(s,p,u,O,{L:LL});
  if(lp&&lp.fx!=='none'){const lf=LMAP[lp.fx];if(lf)lf.f(s,t,u,prmOf(lp,LMAP),1);s.pth=null}
  s.op*=(L.op??1)*sd.op;drawUnit(ctx,S,{base:0,capH:Lay?Lay.capH:H*.05,font:Lay?Lay.font:''},u,s,cA,cB)});
 ctx.restore();G.E=E0}
// impostazioni di partenza del modo Effetto (se mancano)
function svgFxInit(L){if(L.fx==null)Object.assign(L,{fx:'pop',dIn:.8,dOut:.6,outMode:'none',ease:'fx',prms:{},lp:{fx:'none',prms:{}},rot:0,pieces:false,pstag:.5,porder:'doc'});if(L.hold==null)L.hold=2;if(!L.lp)L.lp={fx:'none',prms:{}}}
function drawLayers(ctx,S,Lay,t,W,H,z,cA,cB,T){const E0=G.E;
 S.layers.forEach((L,li)=>{if(L.z!==z||L.hidden)return;const sd=stDelta(S,(L.kind==='svg'?'svg:':'img:')+L.id,t);if(L.kind==='svg'){if(L.mode==='fx')drawSvgFx(ctx,S,Lay,L,li,t,W,H,sd,cA,cB);else drawSvg(ctx,L,t,W,H,S.color,S.colorB,EZ[L.mvEase],isIdDelta(sd)?undefined:sd);return}const im=IMGS[L.img];if(!im||!im.naturalWidth)return;
  const end=L.end>0?L.end:T.total;if(t<L.start-1e-6)return;if(L.outMode!=='none'&&t>end+1e-6)return;
  const nw=im.naturalWidth,nh=im.naturalHeight;let dw,dh;if(L.mode==='cover'){const k=Math.max(W/nw,H/nh)*L.size/100;dw=nw*k;dh=nh*k}else{dw=W*L.size/100;dh=dw*nh/nw}
  dw*=sd.s;dh*=sd.s;const x=W*(L.x+sd.dx)/100,y=H*(L.y+sd.dy)/100;
  const u={i:li+500,n:1,cx:0,cy:0,w:dw,by0:-dh/2,by1:dh/2,fx:x,fy:y,line:0,chars:[{img:L.img,j:0,rx:0,ry:0,iw:dw,ih:dh,tint:L.tint}]};
  G.E=Math.max(dw,dh)*.5;
  const fx=FXMAP[L.fx]||FXMAP.fade,o=prmOf(L,FXMAP),E=easeOf(L,FXMAP);let p=1,LL=L.dIn;const ti=t-L.start;
  if(ti<L.dIn)p=E(clamp(ti/Math.max(1e-4,L.dIn)));else if(L.outMode!=='none'&&t>end-L.dOut){LL=L.dOut;p=fx.exit?1-E(clamp((t-(end-L.dOut))/Math.max(1e-4,L.dOut))):E(clamp((end-t)/Math.max(1e-4,L.dOut)))}
  const s=newState();if(Math.abs(p-1)>1e-6)fx.f(s,p,u,o,{L:LL});
  if(L.lp&&L.lp.fx!=='none'){const lf=LMAP[L.lp.fx];if(lf)lf.f(s,t,u,prmOf(L.lp,LMAP),1);s.pth=null}
  s.op*=L.op*sd.op;
  ctx.save();ctx.translate(x,y);if(L.rot||sd.r)ctx.rotate((L.rot+sd.r)*D2R);drawUnit(ctx,S,{base:0,capH:Lay.capH,font:Lay.font},u,s,cA,cB);ctx.restore()});
 G.E=E0}
function checker(ctx,W,H){const z=24;ctx.fillStyle='#1a1a1a';ctx.fillRect(0,0,W,H);ctx.fillStyle='#222';for(let y=0;y<H;y+=z)for(let x=(y/z)%2?z:0;x<W;x+=z*2)ctx.fillRect(x,y,z,z)}
function guides(ctx,W,H,res){ctx.save();ctx.setTransform(res,0,0,res,0,0);ctx.lineWidth=1.5;ctx.strokeStyle='rgba(255,77,0,.7)';ctx.setLineDash([8,6]);ctx.strokeRect(W*.05,H*.05,W*.9,H*.9);ctx.strokeStyle='rgba(255,255,255,.25)';ctx.strokeRect(W*.1,H*.1,W*.8,H*.8);ctx.setLineDash([]);ctx.strokeStyle='rgba(255,255,255,.14)';ctx.beginPath();for(const f of[1/3,2/3]){ctx.moveTo(W*f,0);ctx.lineTo(W*f,H);ctx.moveTo(0,H*f);ctx.lineTo(W,H*f)}ctx.stroke();ctx.strokeStyle='rgba(255,77,0,.9)';ctx.beginPath();ctx.moveTo(W/2-14,H/2);ctx.lineTo(W/2+14,H/2);ctx.moveTo(W/2,H/2-14);ctx.lineTo(W/2,H/2+14);ctx.stroke();ctx.restore()}

function drawUnit(ctx,S,Lay,u,s,cA,cB){
 if(s.op<=.003||Math.abs(s.sx)<1e-4||Math.abs(s.sy)<1e-4)return;
 ctx.save();ctx.globalAlpha=Math.min(1,s.op);
 if(s.blur>.15&&HAS_FILTER)ctx.filter=`blur(${(s.blur*G.res).toFixed(2)}px)`;
 const rc=s.pth?(a,b,c,d)=>warpRect(ctx,s.pth,a,b,c,d):(a,b,c,d)=>ctx.rect(a,b,c,d);
 const padX=G.E*.08,x0=u.cx-u.w/2-padX,w0=u.w+padX*2,y0=u.cy+u.by0,h0=u.by1-u.by0;
 if(s.clip){ctx.beginPath();rc(x0,y0,w0,h0);ctx.clip()}
 if(s.wipe){const a=s.wipe.a;if(a<=0){ctx.restore();return}ctx.beginPath();switch(s.wipe.d){case'L':rc(x0,y0,w0*a,h0);break;case'R':rc(x0+w0*(1-a),y0,w0*a,h0);break;case'T':rc(x0,y0,w0,h0*a);break;case'B':rc(x0,y0+h0*(1-a),w0,h0*a);break;default:rc(x0+w0*(1-a)/2,y0,w0*a,h0)}ctx.clip();if(s.wipe.soft>0)ctx.globalAlpha*=clamp(a/(s.wipe.soft*.6+1e-3))}
 if(s.dwipe&&s.pth){const a=s.dwipe.a;if(a<=0){ctx.restore();return}if(a<1){ctx.beginPath();rc(x0,y0,w0*a,h0);ctx.clip()}}else if(s.dwipe){const a=s.dwipe.a;if(a<=0){ctx.restore();return}if(a<1){const th=s.dwipe.ang*D2R,dx=Math.cos(th),dy=Math.sin(th),cx0=x0+w0/2,cy0=y0+h0/2,R0=Math.hypot(w0,h0)/2+2,pos=-R0+2*R0*a,px=cx0+dx*pos,py=cy0+dy*pos,nx=-dy,ny=dx,L=R0*4;ctx.beginPath();ctx.moveTo(px+nx*L,py+ny*L);ctx.lineTo(px-nx*L,py-ny*L);ctx.lineTo(px-nx*L-dx*L,py-ny*L-dy*L);ctx.lineTo(px+nx*L-dx*L,py+ny*L-dy*L);ctx.closePath();ctx.clip()}}
 ctx.translate(u.cx+s.x,u.cy+s.y);
 const pv=s.px||s.py;if(pv)ctx.translate(s.px,s.py);
 if(s.rot)ctx.rotate(s.rot*D2R);
 if(s.skx)ctx.transform(1,0,Math.tan(clamp(s.skx,-85,85)*D2R),1,0,0);
 if(s.sx!==1||s.sy!==1)ctx.scale(s.sx,s.sy);
 if(pv)ctx.translate(-s.px,-s.py);
 if(s.reveal&&s.reveal.a<1){if(s.reveal.a<=0){ctx.restore();return}clipCreativeReveal(ctx,u,s.reveal)}
 if(s.bar&&!s.pth){const b=s.bar,bx0=-u.w/2-b.pad*G.E,bw=u.w+b.pad*2*G.E,by0=u.by0,bh=u.by1-u.by0;let r;switch(b.d){case'R':r=[bx0+bw*(1-b.b),by0,bw*(b.b-b.a),bh];break;case'T':r=[bx0,by0+bh*b.a,bw,bh*(b.b-b.a)];break;case'B':r=[bx0,by0+bh*(1-b.b),bw,bh*(b.b-b.a)];break;default:r=[bx0+bw*b.a,by0,bw*(b.b-b.a),bh]}
  const ga=ctx.globalAlpha;ctx.globalAlpha=1;ctx.fillStyle=b.c==='A'?S.color:S.colorB;if(r[2]>0&&r[3]>0)ctx.fillRect(...r);ctx.globalAlpha=ga}
 if(s.glow&&s.glow.blur>.2){const gc=hexRGB(s.glow.c==='B'?S.colorB:S.color);ctx.shadowColor=`rgba(${gc[0]},${gc[1]},${gc[2]},${s.glow.a??1})`;ctx.shadowBlur=s.glow.blur*G.res}
 const main=mixRGB(cA,cB,clamp(s.mix));
 const paint=(dx,dy,colr,gl,copy)=>drawChars(ctx,S,Lay,u,s,colr,dx,dy,gl,copy);
 const body=(dx,dy,gl)=>{if(s.echo&&s.echo.a>.003){const e=s.echo,ga=ctx.globalAlpha;for(let k=e.n;k>=1;k--){ctx.globalAlpha=ga*e.a*(1-k/(e.n+1));paint(dx+e.dx*k,dy+e.dy*k,main,gl,false)}ctx.globalAlpha=ga}if(s.rgb>.3){const ga=ctx.globalAlpha;ctx.globalAlpha=ga*.9;paint(dx-s.rgb,dy,s.rgbA,gl,true);paint(dx+s.rgb,dy,s.rgbB,gl,true);ctx.globalAlpha=ga}
  if(s.ext){const e=s.ext,m=clamp(s.mix),base=[0,1,2].map(i=>Math.round(lerp(cA[i],cB[i],m)));for(let k=e.n;k>=1;k--){const f=k/e.n;paint(dx+e.dx*f,dy+e.dy*f,mixRGB(base,[0,0,0],e.shade*(.35+.65*f)),gl,false)}}
  paint(dx,dy,main,gl,false)};
 const L=-u.w/2-G.E*.2,Wd=u.w+G.E*.4;
 if(s.frag&&!s.pth){const F=s.frag,moving=[];ctx.beginPath();let still=0;
  for(const pc of F.pieces){const r=F.fn(pc);if(r.op<=.003)continue;if(!r.x&&!r.y&&!r.r&&r.op>=.999){const q=pc.poly;ctx.moveTo(q[0][0],q[0][1]);ctx.lineTo(q[1][0],q[1][1]);ctx.lineTo(q[2][0],q[2][1]);ctx.closePath();still++}else moving.push([pc,r])}
  if(still){ctx.save();ctx.clip();body(0,0);ctx.restore()}
  for(const[pc,r]of moving){ctx.save();ctx.globalAlpha*=r.op;ctx.translate(pc.cx+r.x,pc.cy+r.y);if(r.r)ctx.rotate(r.r*D2R);ctx.translate(-pc.cx,-pc.cy);const q=pc.poly;ctx.beginPath();ctx.moveTo(q[0][0],q[0][1]);ctx.lineTo(q[1][0],q[1][1]);ctx.lineTo(q[2][0],q[2][1]);ctx.closePath();ctx.clip();body(0,0);ctx.restore()}}
 else if(s.vs&&!s.pth){const n=s.vs.n,bw=Wd/n;for(let j=0;j<n;j++){ctx.save();ctx.beginPath();ctx.rect(L+bw*j-.5,u.by0-G.E*20,bw+1,u.by1-u.by0+G.E*40);ctx.clip();body(0,s.vs.off(j));ctx.restore()}}
 else if(s.slices&&!s.pth){const n=s.slices.n,top=u.by0,hh=(u.by1-u.by0)/n;for(let j=0;j<n;j++){ctx.save();ctx.beginPath();ctx.rect(-u.w/2-G.E,top+hh*j-.5,u.w+G.E*2,hh+1);ctx.clip();body(s.slices.off(j),0);ctx.restore()}}
 else if(s.roll&&!s.pth){const r=s.roll,hh=(u.by1-u.by0);const gk=k=>(c)=>k===0?c.ch:rChar(CHARSETS[r.set],u.i*53+c.j*7+k*101+G.seed,c.ch);body(0,r.frac*hh*r.dir,gk(r.k));body(0,(r.frac-1)*hh*r.dir,gk(r.k+1))}
 else if(s.hroll&&!s.pth){const r=s.hroll,ww=u.w+G.E*.2;const gk=k=>(c)=>k===0?c.ch:rChar(CHARSETS[r.set],u.i*53+c.j*7+k*101+G.seed,c.ch);body(r.frac*ww*r.dir,0,gk(r.k));body((r.frac-1)*ww*r.dir,0,gk(r.k+1))}
 else body(0,0);
 ctx.restore();
}
function drawChars(ctx,S,Lay,u,s,colr,dx,dy,gl,copy){
 ctx.textAlign='center';ctx.textBaseline='alphabetic';
 let cur='';const len=u.chars.length;
 const PW=s.pth&&G.blk?s.pth:null,m0=PW?ctx.getTransform():null,q=PW?G.blkInv.multiply(m0):null;
 for(const c of u.chars){
  if(c.img){const im=IMGS[c.img];if(!im)continue;const tm=c.tint!=null?c.tint:(S.imgTint?'A':'none');const tc=copy?colr:tm==='A'?colr:tm==='B'?S.colorB:null;
   if(PW){pathFrame(ctx,PW,q,c.rx+dx,c.ry+dy);ctx.drawImage(tc?tinted(c.img,tc):im,-c.iw/2,-c.ih/2,c.iw,c.ih);ctx.setTransform(m0)}else ctx.drawImage(tc?tinted(c.img,tc):im,c.rx+dx-c.iw/2,c.ry+dy-c.ih/2,c.iw,c.ih);continue}
  let g=gl?gl(c):c.ch,fam=null,w=s.wght,alt=false;
  for(const h of s.hooks){const r=h.fn(g,c.j,len,h.p,u,h.o);if(r){if(r.g!=null)g=r.g;if(r.font)fam=r.font;if(r.b)alt=true}}
  const f=(fam||w!=null)?fontStr(S,fam,w):Lay.font;if(f!==cur){ctx.font=f;cur=f}
  const col=alt&&!copy?S.colorB:colr;let x=c.rx+dx,y=Lay.base+c.ry+dy;if(PW){pathFrame(ctx,PW,q,x,c.ry+dy);x=0;y=Lay.base}
  if(S.stroke){ctx.strokeStyle=col;ctx.lineWidth=S.strokeW;ctx.lineJoin='round';ctx.strokeText(g,x,y)}else if(s.outl>0){const ga=ctx.globalAlpha;ctx.strokeStyle=col;ctx.lineWidth=s.outlW;ctx.lineJoin='round';ctx.globalAlpha=ga*clamp(s.outl*3);if(s.dash)ctx.setLineDash([s.dash.len*s.dash.f,s.dash.len*10]);ctx.strokeText(g,x,y);if(s.dash)ctx.setLineDash([]);ctx.globalAlpha=ga*(1-s.outl);ctx.fillStyle=col;ctx.fillText(g,x,y);ctx.globalAlpha=ga}else{ctx.fillStyle=col;ctx.fillText(g,x,y)}if(PW)ctx.setTransform(m0)}
}
// testo su tracciato: porta il centro del carattere (lx,ly, locali all'unità) sul tracciato e orienta il sistema di coordinate come la curva
const PTMP={x:0,y:0,a:0};
function pathFrame(ctx,W,q,lx,ly){const X=q.a*lx+q.c*ly+q.e,Y=q.b*lx+q.d*ly+q.f;warpAt(W.tb,W.shift,W.env,W.follow,X,Y,PTMP);
 const ca=Math.cos(PTMP.a),sa=Math.sin(PTMP.a),a=ca*q.a-sa*q.b,b=sa*q.a+ca*q.b,c=ca*q.c-sa*q.d,d=sa*q.c+ca*q.d,B=G.blk;
 ctx.setTransform(B.a*a+B.c*b,B.b*a+B.d*b,B.a*c+B.c*d,B.b*c+B.d*d,B.a*PTMP.x+B.c*PTMP.y+B.e,B.b*PTMP.x+B.d*PTMP.y+B.f)}
// rettangolo piegato sul tracciato (per le tendine): i lati lunghi sono divisi in tratti corti
function warpRect(ctx,W,x,y,w,h){const nx=Math.max(2,Math.min(160,Math.ceil(w/(G.E*.12)))),ny=3,P=(X,Y)=>{warpAt(W.tb,W.shift,W.env,0,X,Y,PTMP);return[PTMP.x,PTMP.y]};
 let p=P(x,y);ctx.moveTo(p[0],p[1]);for(let i=1;i<=nx;i++){p=P(x+w*i/nx,y);ctx.lineTo(p[0],p[1])}for(let j=1;j<=ny;j++){p=P(x+w,y+h*j/ny);ctx.lineTo(p[0],p[1])}
 for(let i=nx-1;i>=0;i--){p=P(x+w*i/nx,y+h);ctx.lineTo(p[0],p[1])}for(let j=ny-1;j>0;j--){p=P(x,y+h*j/ny);ctx.lineTo(p[0],p[1])}ctx.closePath()}


/* ============================================================ main canvas */
const cv=$('#cv'),ctx=cv.getContext('2d');
let Lay=null,t=0,playing=true,dirty=true,exporting=false,HND=null,HND0=null,LAY=null,SEL=false;
function dims(){return FMT[S.fmt]}
function relayout(){const[W,H]=dims();const want=[W*S.res,H*S.res];if(cv.width!==want[0]||cv.height!==want[1]){cv.width=want[0];cv.height=want[1];fitStage()}
 const before=S.fs;Lay=layout(S,ctx,W,H);if(S.fit&&before!==S.fs&&UI.fs)UI.fs._set(S.fs);
 BL=S.blocks&&S.blocks.length>1?S.blocks.map((b,i)=>{if(i===S.cur)return null;const st={...S,...b};return{st,lay:layout(st,ctx,W,H)}}):[];dirty=true;drawTimeline()}
function draw(){const[W,H]=dims();const T=TG();syncVideos(T,playing);renderSeq(ctx,T,W,H,S.res,{checker:true,guides:$('#cGuide').checked});HND&&HND.update()}
// zoom dell'anteprima: "Adatta" riempie lo spazio; le percentuali sono rispetto ai pixel veri del video (100% = un pixel per pixel)
const ZOOMS=[['fit','Adatta'],[.25,'25%'],[.5,'50%'],[.75,'75%'],[1,'100%'],[1.5,'150%'],[2,'200%']];
let VZ=getUI('viewZoom','fit');
function fitStage(){const wrap=$('#stageWrap'),r=wrap.getBoundingClientRect(),[W,H]=dims(),fs=!!document.fullscreenElement||document.body.classList.contains('pseudofull');const pad=fs?0:44,aw=Math.max(50,r.width-pad),ah=Math.max(50,r.height-pad),kf=Math.min(aw/W,ah/H);
 const k=VZ==='fit'||fs?kf:VZ*S.res/(window.devicePixelRatio||1);cv.style.width=Math.floor(W*k)+'px';cv.style.height=Math.floor(H*k)+'px';wrap.classList.toggle('zoomed',k>kf+1e-6);
 $('#stageInfo').textContent=`${W*S.res}×${H*S.res} · ${Math.round(k*100*(window.devicePixelRatio||1)/S.res)}%`;HND&&HND.update()}
function setViewZoom(v){VZ=v;setUI('viewZoom',v);const zs=$('#zoomSel');if(zs)zs.value=String(v);fitStage();if(v!=='fit'){const w=$('#stageWrap');w.scrollLeft=(w.scrollWidth-w.clientWidth)/2;w.scrollTop=(w.scrollHeight-w.clientHeight)/2}}
function stepZoom(d){const L=ZOOMS.slice(1).map(z=>z[0]),cur=VZ==='fit'?null:VZ;let i=cur==null?(d>0?L.findIndex(z=>z>=.5):-1):L.indexOf(cur)+d;if(cur==null&&d<0)return setViewZoom(L[0]);setViewZoom(L[Math.max(0,Math.min(L.length-1,i))])}
{const zs=$('#zoomSel');zs.innerHTML=ZOOMS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');zs.value=String(VZ);zs.onchange=()=>{setViewZoom(zs.value==='fit'?'fit':+zs.value);zs.blur()}}   // il menu lascia i tasti alla pagina
// schermo intero: solo l'anteprima (Esc per uscire)
// se il browser non concede lo schermo intero (per esempio nel browser integrato), l'anteprima riempie la finestra
const pseudoFull=on=>{document.body.classList.toggle('fullstage',on);document.body.classList.toggle('pseudofull',on);fitStage()};
function toggleFull(){const w=$('#stageWrap');if(document.fullscreenElement)return document.exitFullscreen();if(document.body.classList.contains('pseudofull'))return pseudoFull(false);
 let done=false;const fb=()=>{if(done||document.fullscreenElement)return;done=true;pseudoFull(true);toast('Anteprima a tutta finestra · Esc o F per tornare')};
 (w.requestFullscreen?w.requestFullscreen():Promise.reject()).then(()=>{done=true}).catch(fb);setTimeout(fb,500)}   // alcuni browser non rispondono: dopo mezzo secondo si usa la finestra intera
$('#bFull').onclick=toggleFull;document.addEventListener('fullscreenchange',()=>{document.body.classList.toggle('fullstage',!!document.fullscreenElement);fitStage()});
// anteprima esterna: una finestra con solo il video (da portare sul monitor esterno e mettere a schermo intero)
let EXTW=null,EXTS=null;
function openExternal(){if(EXTW&&!EXTW.closed){EXTW.focus();return}
 // la finestra si apre subito (serve il clic); poi, se il browser lo permette, si sposta sull'altro schermo
 const w=window.open('','motoAnteprima','popup,width=960,height=600');
 if(w&&window.getScreenDetails)window.getScreenDetails().then(sd=>{const o=sd.screens.find(x=>x!==sd.currentScreen);if(o){try{w.moveTo(o.availLeft,o.availTop);w.resizeTo(o.availWidth,o.availHeight)}catch(e){}}}).catch(()=>{});if(!w)return toast('Il browser ha bloccato la finestra: consenti i popup per questo sito');EXTW=w;
 w.document.title='MOTO · anteprima';w.document.body.style.cssText='margin:0;background:#000;height:100vh;display:grid;place-items:center;overflow:hidden;cursor:none';
 const v=w.document.createElement('video');v.autoplay=true;v.muted=true;v.playsInline=true;v.style.cssText='max-width:100vw;max-height:100vh;width:100%;height:100%;object-fit:contain';w.document.body.appendChild(v);
 const tip=w.document.createElement('div');tip.textContent='Doppio clic: schermo intero';tip.style.cssText='position:fixed;left:12px;bottom:10px;color:#777;font:12px system-ui;transition:opacity 1s';w.document.body.appendChild(tip);setTimeout(()=>tip.style.opacity=0,3000);
 w.document.addEventListener('dblclick',()=>{w.document.fullscreenElement?w.document.exitFullscreen():w.document.documentElement.requestFullscreen().catch(()=>{})});
 EXTS=cv.captureStream(Math.max(24,S.fps));v.srcObject=EXTS;dirty=true;
 w.addEventListener('beforeunload',()=>{EXTS&&EXTS.getTracks().forEach(t=>t.stop());EXTS=null;EXTW=null;$('#bExt').classList.remove('on')});$('#bExt').classList.add('on');
 toast('Anteprima aperta in una finestra: portala sul monitor esterno, doppio clic per lo schermo intero')}
$('#bExt').onclick=openExternal;
new ResizeObserver(fitStage).observe($('#stageWrap'));

let lastNow=performance.now();
function tick(now){requestAnimationFrame(tick);const dt=Math.min(.1,(now-lastNow)/1000);lastNow=now;
 if(!exporting){const tot=seqTot(),bounds=playbackBounds();if(playing){const now=SA.now();if(now!=null)setTG(now);else setTG(TG()+dt);if(TG()<bounds.start){setTG(bounds.start);saStart(bounds.start)}if(TG()>=bounds.end){if($('#cLoop').checked){setTG(bounds.start);saStart(bounds.start)}else{setTG(bounds.end);setPlay(false)}}dirty=true}
  if(TG()>tot+1e-6){setTG(tot);dirty=true}
  if(dirty||S.loop.fx!=='none'&&playing){dirty=false;draw();updHead();STL&&STL.head(playing)}
  if(!playing&&UI.ctxBar)syncSel()}}

/* ============================================================ timeline */
function fmtTC(t){const f=Math.floor(t*S.fps+1e-6),sec=Math.floor(f/S.fps),fr=f%S.fps;return`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}<span>:${String(fr).padStart(2,'0')}</span>`}
/* Timeline UI state is separate from the saved project. Times are in seconds. */
const TLD = {scale:0, zoom:1, snap:true, drag:null, marker:null, clipboard:null};
const SEGK = [['delay','Ritardo','',0],['dIn','Entrata','s-in',.05],['hold','Pausa','s-hold',0],['dOut','Uscita','s-out',.05],['tail','Coda','',0]];
const TL_LABEL = 136;
const frameTime = value => Math.round(value * S.fps) / S.fps;
const timelineDuration = () => TLD.scale || clipTotal();
const timelineWidth = () => Math.max(160, $('#tlScroll').clientWidth - TL_LABEL - 2) * TLD.zoom;
const textTracks = () => nBlocks() > 1 ? S.blocks.map((b,i) => i === S.cur ? S : b) : [S];
const safeText = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function normalizeTimeline() {
 const data = S.timeline || {};
 const total = clipTotal();
 S.timeline = {
  markers: (Array.isArray(data.markers) ? data.markers : []).filter(m => m && Number.isFinite(m.t)).map((m,i) => ({t:clamp(m.t,0,total),name:String(m.name || `Marker ${i+1}`).slice(0,60)})),
  range: {enabled:!!data.range?.enabled,start:clamp(Number(data.range?.start)||0,0,total),end:clamp(Number(data.range?.end)||0,0,total)}
 };
 if(S.timeline.range.end <= S.timeline.range.start) S.timeline.range.enabled = false;
}
function previewBounds() {
 const total = clipTotal(), r = S.timeline.range;
 const start = clamp(r.start,0,Math.max(0,total-1/S.fps));
 const end = clamp(r.end || total,start+1/S.fps,total);
 return r.enabled ? {start,end} : {start:0,end:total};
}
function timelinePoints(excludeBlock=-1, excludeLayer=-1, excludeKey=null, excludeMarker=null) {
 const points = [0,clipTotal()];
 textTracks().forEach((b,i) => {
  if(i !== excludeBlock) {const T=timing(b);points.push(T.inS,T.holdS,T.outS,T.total-(T.on?b.tail:0),T.total)}
  if(i !== excludeBlock || excludeKey) for(const k of b.block.keys||[]) if(k!==excludeKey) points.push(k.t);
 });
 S.layers.forEach((L,i) => {if(i!==excludeLayer)points.push(L.start||0,L.kind==='svg'?svgEnd(L):L.end||clipTotal())});
 S.timeline.markers.forEach(m => {if(m!==excludeMarker)points.push(m.t)});
 return points.filter(Number.isFinite);
}
function snapTimeline(value,e,points=timelinePoints()) {
 let result = frameTime(value);
 if(!TLD.snap || e?.altKey) return result;
 const tolerance = timelineDuration()/timelineWidth()*8;
 let best = tolerance;
 for(const point of points) if(Math.abs(point-value)<best) {best=Math.abs(point-value);result=point}
 return result;
}
function setTimelineZoom(value) {
 const scroll=$('#tlScroll'), oldWidth=timelineWidth();
 const anchor=clamp((scroll.scrollLeft+(scroll.clientWidth-TL_LABEL)/2)/oldWidth);
 TLD.zoom=clamp(value,1,16);drawTimeline();
 scroll.scrollLeft=anchor*timelineWidth()-(scroll.clientWidth-TL_LABEL)/2;
}
function phaseMarkup(b,pc) {
 let acc=0, html='';
 for(const [key,name,cls] of SEGK) {
  if(key==='dOut'&&b.outMode==='none')continue;
  const start=acc;acc+=b[key];
  if(key==='delay')continue;
  html+=`<span class="tl-phase ${cls}" style="left:${pc(start)}%;width:${pc(b[key])}%" title="${name}: ${b[key].toFixed(2)} s">${name}</span>`;
 }
 return html;
}
function drawTimeline() {
 const ac=actClip();if(ac&&ac.auto!==false){const duration=+(clipTotal()/spd(ac)).toFixed(3);if(Math.abs(ac.dur-duration)>1e-3){ac.dur=duration;STL&&STL.render()}}
 $('#motionEditor').hidden=!ac;
 $('#clipLab').textContent='Livelli della clip: '+(ac?.name||'Grafica');
 const D=timelineDuration(), width=timelineWidth(), pc=v=>v/D*100;
 const tracks=textTracks();
 const stepCandidates=[1/S.fps,2/S.fps,5/S.fps,.5,1,2,5,10,30,60,120,300,600];
 const step=stepCandidates.find(v=>v/D*width>=65)||Math.ceil(D/10);
 let ticks='';
 for(let i=0;i*step<=D+1e-6;i++) {const x=i*step;ticks+=`<span style="left:${pc(x)}%">${+x.toFixed(2)}s</span>`}
 const r=S.timeline.range, bounds=previewBounds();
 const rangeStart=clamp(r.start,0,D),rangeEnd=clamp(r.end||clipTotal(),rangeStart,D);
 let html=`<div class="tl-ruler"><div class="tl-label">TRACCE <span>${tracks.length+S.layers.length}</span></div><div class="tl-lane tl-ruler-lane"><div class="tl-ticks">${ticks}</div><div class="tl-range ${r.enabled?'enabled':''}" style="left:${pc(rangeStart)}%;width:${pc(rangeEnd-rangeStart)}%"><button data-range="start" class="tl-range-handle start" aria-label="Trascina inizio intervallo" title="Inizio anteprima"></button><button data-range="end" class="tl-range-handle end" aria-label="Trascina fine intervallo" title="Fine anteprima"></button></div></div></div>`;
 html+=`<div class="tl-marker-row"><div class="tl-label">MARKER</div><div class="tl-lane">${S.timeline.markers.map((m,i)=>`<button class="tl-marker ${TLD.marker===m?'selected':''}" data-marker="${i}" style="left:${pc(m.t)}%" title="${safeText(m.name)} · ${m.t.toFixed(2)} s" aria-label="${safeText(m.name)}"><span>◆</span>${safeText(m.name)}</button>`).join('')}</div></div>`;
 tracks.forEach((b,i)=>{
  const active=i===S.cur,T=timing(b);
  let acc=0,handles='';
  for(const [key,name] of SEGK) {if(key==='dOut'&&!T.on)continue;acc+=b[key];handles+=`<button type="button" class="tl-phase-handle" data-phase="${key}" style="left:clamp(5px,${pc(acc)}%,calc(100% - 5px))" title="Regola ${safeText(name.toLowerCase())}" aria-label="${safeText(name)}: regola con le frecce"></button>`}
  const keys=b.block.mode==='keys'?(b.block.keys||[]).map((k,j)=>`<button class="tl-key ${active&&k===UI.selKey?'selected':''}" data-key="${j}" style="left:${pc(k.t)}%" title="Keyframe ${k.t.toFixed(2)} s · trascina per spostare" aria-label="Keyframe a ${k.t.toFixed(2)} secondi"></button>`).join(''):'';
  html+=`<div class="tl-track ${active?'active':''}" data-block="${i}"><button class="tl-label tl-select" title="${safeText(blockName(i))}"><span class="tl-kind">T${i+1}</span><span class="tl-name">${safeText(blockName(i))}</span></button><div class="tl-lane"><div class="tl-clip" tabindex="0" role="button" aria-label="Sposta il testo con le frecce" data-move="text" style="left:${pc(b.delay)}%;width:${pc(T.total-b.delay)}%" title="Trascina per spostare il blocco con i suoi keyframe"></div>${phaseMarkup(b,pc)}${handles}<div class="tl-keys">${keys}</div></div></div>`;
 });
 S.layers.forEach((L,i)=>{
  const end=L.kind==='svg'?svgEnd(L):L.end||clipTotal(),name=L.name||S.images.find(im=>im.id===L.img)?.name||`Immagine ${i+1}`,start=L.start||0;
  html+=`<div class="tl-track tl-image-track" data-layer="${i}"><button class="tl-label tl-select" title="Apri i controlli di ${safeText(name)}"><span class="tl-kind">${L.kind==='svg'?'SVG':'IMG'}</span><span class="tl-name">${safeText(name)}</span></button><div class="tl-lane"><div class="tl-image-clip" tabindex="0" role="button" aria-label="Sposta il livello con le frecce" data-move="image" style="left:${pc(start)}%;width:${pc(Math.max(0,end-start))}%" title="Trascina per spostare l’immagine">${safeText(name)}${L.kind==='svg'||L.end?'':' · fino alla fine'}</div><button type="button" class="tl-phase-handle" aria-label="Inizio del livello: regola con le frecce" data-trim="start" style="left:clamp(5px,${pc(start)}%,calc(100% - 5px))" title="Inizio del livello"></button>${L.kind==='svg'?'':`<button type="button" class="tl-phase-handle" data-trim="end" style="left:clamp(5px,${pc(end)}%,calc(100% - 5px))" aria-label="Fine immagine: regola con le frecce" title="Fine immagine"></button>`}</div></div>`;
 });
 html+='<div class="tl-playhead" id="ph"></div>';
 const tl=$('#tl'),focused=document.activeElement;const focusRow=focused?.closest('.tl-track'),focusAttr=['data-key','data-marker','data-phase','data-trim','data-range','data-move'].find(a=>focused?.hasAttribute(a));
 const focusSelector=focusAttr?`${focusRow?.dataset.block!==undefined?`[data-block="${focusRow.dataset.block}"] `:focusRow?.dataset.layer!==undefined?`[data-layer="${focusRow.dataset.layer}"] `:''}[${focusAttr}="${focused.getAttribute(focusAttr)}"]`:null;
 tl.style.width=`${width+TL_LABEL}px`;tl.innerHTML=html;if(focusSelector)tl.querySelector(focusSelector)?.focus({preventScroll:true});
 $('#trackCount').textContent=`${tracks.length+S.layers.length} ${tracks.length+S.layers.length===1?'traccia':'tracce'}`;
 $('#zoomValue').textContent=`${Math.round(TLD.zoom*100)}%`;
 $('#zoomOut').disabled=TLD.zoom<=1;$('#zoomIn').disabled=TLD.zoom>=16;
 $('#rangeEnabled').checked=r.enabled;
 $('#rangeLabel').textContent=r.enabled?`${bounds.start.toFixed(2)}–${bounds.end.toFixed(2)}s`:'';
 $('#copyKey').disabled=!S.block.keys?.includes(UI.selKey);
 $('#pasteKey').disabled=!TLD.clipboard;
 $('#prevKey').disabled=$('#nextKey').disabled=S.block.mode!=='keys'||!S.block.keys.length;
 $('#markerEditor').hidden=!S.timeline.markers.includes(TLD.marker);
 if(TLD.marker&&document.activeElement!==$('#markerName'))$('#markerName').value=TLD.marker.name;
 updHead();
}
function updHead() {
 const ph=$('#ph');if(ph)ph.style.left=`${TL_LABEL+clamp(t/timelineDuration())*timelineWidth()}px`;
 if(!$('#tc').querySelector('input'))$('#tc').innerHTML=fmtTC(TG())+` <span>/ ${seqTot().toFixed(2)}s</span>`;
}
function playbackBounds() {
 const total=seqTot(),c=actClip();if(!c||!S.timeline.range.enabled)return {start:0,end:total};
 const b=previewBounds(),endClip=Math.min(total,clipEnd(c));
 const start=clamp(c.start+(b.start-c.inp)/spd(c),c.start,Math.max(c.start,endClip-1/S.fps));
 const end=clamp(c.start+(b.end-c.inp)/spd(c),start+1/S.fps,endClip);
 return {start,end};
}
function jumpKey(direction) {
 const keys=S.block.mode==='keys'?[...S.block.keys].sort((a,b)=>a.t-b.t):[];
 const key=direction>0?keys.find(k=>k.t>t+1e-6):keys.reverse().find(k=>k.t<t-1e-6);
 if(!key)return;setPlay(false);t=clamp(key.t,0,clipTotal());UI.selKey=key;TLD.marker=null;buildBlock();drawTimeline();dirty=true;
 $('#tlScroll').scrollLeft=Math.max(0,t/timelineDuration()*timelineWidth()-($('#tlScroll').clientWidth-TL_LABEL)/2);
}
function pasteTimelineKey(source=TLD.clipboard) {
 if(!source)return;
 histCommit();const b=S.block;b.mode='keys';b.keys=b.keys||[];
 const time=frameTime(t),existing=b.keys.find(k=>Math.abs(k.t-time)<.5/S.fps);
 const key={...source,t:time};
 if(existing)Object.assign(existing,key);else b.keys.push(key);
 UI.selKey=existing||key;TLD.marker=null;buildBlock();drawTimeline();dirty=true;histMark();
 toast(existing?'Keyframe aggiornato alla testina':'Keyframe incollato alla testina');
}
function copyTimelineKey() {
 if(!S.block.keys?.includes(UI.selKey))return false;
 TLD.clipboard={...UI.selKey};drawTimeline();toast('Keyframe copiato');return true;
}
function addTimelineMarker() {
 histCommit();const time=frameTime(t);
 let marker=S.timeline.markers.find(m=>Math.abs(m.t-time)<.5/S.fps);
 if(!marker){marker={t:time,name:`Marker ${S.timeline.markers.length+1}`};S.timeline.markers.push(marker)}
 TLD.marker=marker;UI.selKey=null;drawTimeline();histMark();
 $('#markerName').focus();$('#markerName').select();
}
function setPreviewEdge(edge) {
 histCommit();const r=S.timeline.range,total=clipTotal(),value=clamp(frameTime(t),0,total);
 if(edge==='start'){r.start=Math.min(value,total-1/S.fps);if(!r.end||r.end<=r.start)r.end=total}
 else {r.end=Math.max(1/S.fps,value);if(r.start>=r.end)r.start=0}
 r.enabled=true;drawTimeline();histMark();
}
function deleteTimelineSelection() {
 if(TLD.marker&&S.timeline.markers.includes(TLD.marker)) {
  histCommit();S.timeline.markers.splice(S.timeline.markers.indexOf(TLD.marker),1);TLD.marker=null;
 } else if(UI.selKey&&S.block.keys?.includes(UI.selKey)) {
  histCommit();S.block.keys.splice(S.block.keys.indexOf(UI.selKey),1);UI.selKey=null;buildBlock();dirty=true;
 } else return false;
 drawTimeline();histMark();return true;
}
function timelineKeydown(e,editing) {
 if(editing||e.target.closest('input,textarea,select,[contenteditable=true]')||$('#help').classList.contains('on')||exporting)return false;
 const key=e.key.toLowerCase(),mod=e.metaKey||e.ctrlKey;
 if(!TLD.drag&&!e.target.closest('#motionEditor'))return false;
 if((key==='arrowleft'||key==='arrowright')&&adjustMotionControl(e))return true;
 let handled=true;
 if(e.key==='Escape'&&TLD.drag)finishTimelineDrag(true);
 else if(mod&&key==='c')handled=copyTimelineKey();
 else if(mod&&key==='v'){handled=!!TLD.clipboard;if(handled)pasteTimelineKey()}
 else if(mod||e.altKey)return false;
 else if(key==='m')addTimelineMarker();
 else if(key==='i')setPreviewEdge('start');
 else if(key==='o')setPreviewEdge('end');
 else if(key==='[')jumpKey(-1);
 else if(key===']')jumpKey(1);
 else if(key==='+'||key==='=')setTimelineZoom(TLD.zoom*1.5);
 else if(key==='-')setTimelineZoom(TLD.zoom/1.5);
 else if(key==='0')setTimelineZoom(1);
 else if(key==='delete'||key==='backspace')handled=deleteTimelineSelection();
 else handled=false;
 if(handled)e.preventDefault();return handled;
}
function adjustMotionControl(e) {
 const el=e.target,blockRow=el.closest('[data-block]'),layerRow=el.closest('[data-layer]');
 const phase=el.dataset.phase,trim=el.dataset.trim,move=el.dataset.move,range=el.dataset.range;
 if(!phase&&!trim&&!move&&!range&&!el.hasAttribute('data-key')&&!el.hasAttribute('data-marker'))return false;
 histCommit();setPlay(false);if(blockRow&&+blockRow.dataset.block!==S.cur)selectBlock(+blockRow.dataset.block);
 const delta=(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?10:1)/S.fps;
 if(phase){const min=SEGK.find(s=>s[0]===phase)[3];S[phase]=Math.max(Math.ceil(min*S.fps)/S.fps,frameTime(S[phase]+delta));UI.time?.[phase]?._set(S[phase])}
 else if(el.hasAttribute('data-key')){const key=S.block.keys[+el.dataset.key],value=clamp(frameTime(key.t+delta),0,clipTotal());if(!S.block.keys.some(k=>k!==key&&Math.abs(k.t-value)<.5/S.fps))key.t=value;UI.selKey=key;TLD.marker=null;t=key.t;buildBlock()}
 else if(el.hasAttribute('data-marker')){TLD.marker=S.timeline.markers[+el.dataset.marker];TLD.marker.t=clamp(frameTime(TLD.marker.t+delta),0,clipTotal());t=TLD.marker.t}
 else if(range){const r=S.timeline.range;r.enabled=true;if(range==='start')r.start=clamp(frameTime(r.start+delta),0,(r.end||clipTotal())-1/S.fps);else r.end=clamp(frameTime((r.end||clipTotal())+delta),r.start+1/S.fps,clipTotal())}
 else if(move==='text'){const earliest=Math.min(S.delay,...S.block.keys.map(k=>k.t)),d=Math.max(-earliest,delta);S.delay+=d;S.block.keys.forEach(k=>k.t+=d)}
 else if(layerRow){const L=S.layers[+layerRow.dataset.layer],end=L.kind==='svg'?svgEnd(L):L.end||clipTotal();if(trim==='end')L.end=Math.max((L.start||0)+1/S.fps,frameTime(end+delta));else{const before=L.start||0;L.start=Math.max(0,frameTime(before+delta));if(move==='image'&&L.kind!=='svg')L.end=end+L.start-before;else if(trim==='start'&&L.kind!=='svg')L.start=Math.min(L.start,end-1/S.fps)}}
 dirty=true;relayout();histCommit();e.preventDefault();return true;
}

function finishTimelineDrag(cancel=false) {
 const drag=TLD.drag;if(!drag)return;
 TLD.drag=null;TLD.scale=0;
 if(cancel&&drag.before){S=JSON.parse(drag.before);SCL.clear();UI.selKey=null;TLD.marker=null;buildInspector()}
 if(drag.kind!=='scrub') {
  if(drag.kind==='key'||drag.kind==='text'||drag.kind==='phase') {buildBlock();for(const [key] of SEGK)UI.time?.[key]?._set(S[key])}
  if(drag.kind==='image'||drag.kind==='trim')buildImages();
  relayout();histCommit();
 }else drawTimeline();
}
function initMotionTimeline() {
 const scroll=$('#tlScroll');
 const xAt=e=>(e.clientX-$('#tl').getBoundingClientRect().left-TL_LABEL)/timelineWidth()*timelineDuration();
 $('#zoomIn').onclick=()=>setTimelineZoom(TLD.zoom*1.5);
 $('#zoomOut').onclick=()=>setTimelineZoom(TLD.zoom/1.5);
 $('#zoomFit').onclick=()=>setTimelineZoom(1);
 $('#tlSnap').onchange=e=>TLD.snap=e.target.checked;
 $('#tlAdd').onclick=()=>addBlock(false);$('#tlDuplicate').onclick=()=>addBlock(true);
 $('#prevKey').onclick=()=>jumpKey(-1);$('#nextKey').onclick=()=>jumpKey(1);
 $('#copyKey').onclick=copyTimelineKey;$('#pasteKey').onclick=()=>pasteTimelineKey();
 $('#addMarker').onclick=addTimelineMarker;
 $('#deleteMarker').onclick=deleteTimelineSelection;
 $('#markerName').oninput=e=>{if(TLD.marker){TLD.marker.name=e.target.value;drawTimeline();histMark()}};
 $('#markerName').onkeydown=e=>{if(e.key==='Enter')scroll.focus()};
 $('#rangeIn').onclick=()=>setPreviewEdge('start');$('#rangeOut').onclick=()=>setPreviewEdge('end');
 $('#rangeEnabled').onchange=e=>{const r=S.timeline.range;r.enabled=e.target.checked;if(r.end<=r.start){r.start=0;r.end=clipTotal()}drawTimeline();histMark()};
 scroll.addEventListener('click',e=>{
  if(e.detail!==0)return; // Pointer interactions are handled below; this is keyboard activation.
  const row=e.target.closest('[data-block]');
  if(row&&+row.dataset.block!==S.cur)selectBlock(+row.dataset.block);
  const layerRow=e.target.closest('[data-layer]');if(layerRow&&e.target.closest('.tl-select')){const L=S.layers[+layerRow.dataset.layer];UI.selSvg=L.id;SEL=true;UI.area='stage';reveal(L.kind==='svg'?UI.svgSec:UI.imgSec);applyCtx(true);HND&&HND.update()}
  const key=e.target.closest('[data-key]'),marker=e.target.closest('[data-marker]');
  if(key){UI.selKey=S.block.keys[+key.dataset.key];TLD.marker=null;t=UI.selKey.t;buildBlock()}
  if(marker){TLD.marker=S.timeline.markers[+marker.dataset.marker];UI.selKey=null;t=TLD.marker.t}
  if(key||marker){setPlay(false);dirty=true;drawTimeline()}
 });
 scroll.addEventListener('pointerdown',e=>{
  if(e.button!==0||exporting)return;
  const label=e.target.closest('.tl-select'), row=e.target.closest('.tl-track');
  const blockIndex=row?.dataset.block!==undefined?+row.dataset.block:-1;
  const layerIndex=row?.dataset.layer!==undefined?+row.dataset.layer:-1;
  if(e.target.closest('.tl-label')&&!label)return;
  if(e.target===scroll)return;
  const phase=e.target.closest('[data-phase]')?.dataset.phase;
  const keyIndex=e.target.closest('[data-key]')?.dataset.key;
  const markerIndex=e.target.closest('[data-marker]')?.dataset.marker;
  const range=e.target.closest('[data-range]')?.dataset.range;
  const trim=e.target.closest('[data-trim]')?.dataset.trim;
  const move=e.target.closest('[data-move]')?.dataset.move;
  histCommit();setPlay(false);
  if(blockIndex>=0&&blockIndex!==S.cur)selectBlock(blockIndex);
  if(label){if(layerIndex>=0){const L=S.layers[layerIndex];UI.selSvg=L.id;SEL=true;UI.area='stage';reveal(L.kind==='svg'?UI.svgSec:UI.imgSec);applyCtx(true);HND&&HND.update()}else{UI.selSvg=null;UI.area='stage';applyCtx(true)}return}
  e.preventDefault();scroll.focus({preventScroll:true});scroll.setPointerCapture(e.pointerId);
  TLD.scale=clipTotal();
  const drag={kind:'scrub',origin:xAt(e),before:JSON.stringify(S),blockIndex,layerIndex};
  if(markerIndex!==undefined){drag.kind='marker';drag.marker=S.timeline.markers[+markerIndex];drag.time=drag.marker.t;TLD.marker=drag.marker;UI.selKey=null;t=drag.marker.t}
  else if(range){drag.kind='range';drag.edge=range}
  else if(keyIndex!==undefined){drag.kind='key';drag.key=S.block.keys[+keyIndex];UI.selKey=drag.key;TLD.marker=null;t=drag.key.t}
  else if(phase){drag.kind='phase';drag.phase=phase;drag.start=0;for(const [key]of SEGK){if(key===phase)break;if(key!=='dOut'||S.outMode!=='none')drag.start+=S[key]}drag.time=drag.start+S[phase]}
  else if(trim){drag.kind='trim';drag.edge=trim;drag.layer=S.layers[layerIndex];drag.end=drag.layer.kind==='svg'?svgEnd(drag.layer):drag.layer.end||clipTotal();drag.time=trim==='start'?drag.layer.start:drag.end}
  else if(move==='text'){drag.kind='text';drag.delay=S.delay;drag.duration=timing(S).total-S.delay;drag.keys=S.block.keys.map(k=>({key:k,time:k.t}))}
  else if(move==='image'){drag.kind='image';drag.layer=S.layers[layerIndex];drag.start=drag.layer.start||0;drag.end=drag.layer.end||clipTotal()}
  else {UI.selKey=null;TLD.marker=null;t=clamp(snapTimeline(xAt(e),e),0,clipTotal())}
  TLD.drag=drag;dirty=true;drawTimeline();
 });
 scroll.addEventListener('pointermove',e=>{
  const d=TLD.drag;if(!d)return;
  const x=xAt(e),points=timelinePoints(d.blockIndex,d.layerIndex,d.key,d.marker);
  if(d.kind==='scrub')t=clamp(snapTimeline(x,e),0,clipTotal());
  else if(d.kind==='marker'){d.marker.t=clamp(snapTimeline(d.time+x-d.origin,e,points),0,clipTotal());t=d.marker.t}
  else if(d.kind==='range'){
   const r=S.timeline.range;r.enabled=true;
   if(d.edge==='start')r.start=clamp(snapTimeline(x,e,points),0,(r.end||clipTotal())-1/S.fps);
   else r.end=clamp(snapTimeline(x,e,points),r.start+1/S.fps,clipTotal());
  }else if(d.kind==='key'){
   const value=clamp(snapTimeline(x,e,points),0,clipTotal());
   if(!S.block.keys.some(k=>k!==d.key&&Math.abs(k.t-value)<.5/S.fps)){d.key.t=value;t=value}
  }else if(d.kind==='phase'){
   const min=SEGK.find(s=>s[0]===d.phase)[3];
   S[d.phase]=Math.max(Math.ceil(min*S.fps)/S.fps,snapTimeline(d.time+x-d.origin,e,points)-d.start);
   UI.time?.[d.phase]?._set(S[d.phase]);
  }else if(d.kind==='text'){
   const raw=d.delay+x-d.origin;
   let start=snapTimeline(raw,e,points);
   const endSnap=snapTimeline(raw+d.duration,e,points)-d.duration;
   if(Math.abs(endSnap-raw)<Math.abs(start-raw))start=endSnap;
   // Keys use absolute project time: move them together, without crossing zero.
   const earliest=Math.min(d.delay,...d.keys.map(k=>k.time));
   const delta=Math.max(-earliest,start-d.delay);
   S.delay=d.delay+delta;d.keys.forEach(k=>k.key.t=k.time+delta);
  }else if(d.kind==='image'){
   const delta=Math.max(-d.start,snapTimeline(d.start+x-d.origin,e,points)-d.start);
   d.layer.start=d.start+delta;if(d.layer.kind!=='svg')d.layer.end=d.end+delta;
  }else if(d.kind==='trim'){
   if(d.edge==='start')d.layer.start=clamp(snapTimeline(d.time+x-d.origin,e,points),0,d.end-1/S.fps);
   else d.layer.end=Math.max(d.layer.start+1/S.fps,snapTimeline(d.time+x-d.origin,e,points));
  }
  dirty=true;drawTimeline();
 });
 scroll.addEventListener('pointerup',()=>finishTimelineDrag());
 scroll.addEventListener('pointercancel',()=>finishTimelineDrag(true));
 scroll.addEventListener('lostpointercapture',()=>finishTimelineDrag());
 scroll.addEventListener('dblclick',e=>{if(!e.target.closest('.tl-marker-row .tl-lane')||e.target.closest('[data-marker]'))return;t=clamp(frameTime(xAt(e)),0,clipTotal());dirty=true;addTimelineMarker()});
 new ResizeObserver(()=>{drawTimeline()}).observe(scroll);
}

// tempo scritto a mano: clic sul tempo, scrivi (0:04:20, 4:20, 420, 4,5, +1:00…) e Invio; Esc annulla
function editTC(){const tc=$('#tc');if(tc.querySelector('input'))return;setPlay(false);const i=el('input','tcin');i.value=fmtTC(TG()).replace(/<\/?span>/g,'');i.setAttribute('aria-label','Vai al tempo');tc.innerHTML='';tc.appendChild(i);i.focus();i.select();let fin=false;
 const done=ok=>{if(fin)return;fin=true;const v=ok?parseTC(i.value,S.fps,TG()):null;tc.innerHTML='';if(ok&&v==null&&i.value.trim())toast('Tempo non valido: scrivi per esempio 0:04:20, 4:20 o 420');if(v!=null){seekTG(Math.round(v*S.fps)/S.fps);STL&&STL.head(true)}dirty=true;updHead()};
 i.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();done(true)}else if(e.key==='Escape'){e.preventDefault();done(false)}};i.onblur=()=>done(true)}
$('#tc').addEventListener('click',editTC);
$('#tc').addEventListener('keydown',e=>{if(e.target.id==='tc'&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();editTC()}});
function setPlay(v){const was=playing;playing=v;$('#bPlay').classList.toggle('on',v);if(v&&(!was||!SA.running))saStart(TG());if(!v)SA.stop();dirty=true}
// spostando la testina durante la riproduzione l'audio riparte dal nuovo punto
function seekTG(T){setTG(Math.max(0,Math.min(seqTot(),T)));if(playing)saStart(TG())}
const stepF=n=>{setPlay(false);setTG(clamp(Math.round(TG()*S.fps+n)/S.fps,0,seqTot()))};
$('#bPlay').onclick=()=>{const bounds=playbackBounds();if(!playing&&(TG()>=bounds.end-1e-6||TG()<bounds.start))setTG(bounds.start);setPlay(!playing)};
$('#bStart').onclick=()=>seekTG(0);$('#bPrev').onclick=()=>stepF(-1);$('#bNext').onclick=()=>stepF(1);
$('#cGuide').onchange=()=>dirty=true;
addEventListener('keydown',e=>{const mod=e.metaKey||e.ctrlKey,k=e.key.toLowerCase(),txt=e.target.closest('textarea,input[type=text],input[type=search],input[type=number],input.hex');
 if(timelineKeydown(e,txt))return;
 if(mod&&k==='z'&&!txt){e.preventDefault();e.shiftKey?redo():undo();return}
 if(mod&&k==='y'&&!txt){e.preventDefault();redo();return}
 if(mod&&!e.shiftKey&&!e.altKey&&!txt&&!e.target.closest('input,textarea,select')&&!(getSelection()+'')){if(k==='c'){e.preventDefault();doCopy();return}if(k==='v'){e.preventDefault();doPaste();return}if(k==='d'){e.preventDefault();doDup();return}}
 if(e.altKey&&e.shiftKey&&e.code==='KeyM'&&!mod&&!e.target.closest('input,textarea,select')){e.preventDefault();seqJumpMarker(-1);return}
 if(mod&&k==='a'&&!txt&&!e.target.closest('input,textarea,select')&&curCtx()==='sub'){e.preventDefault();subSelectAll();return}
 if(mod&&k==='s'){e.preventDefault();saveProject(e.shiftKey);return}
 if(mod&&k==='o'){e.preventDefault();openProject();return}
 if(mod&&k==='k'){e.preventDefault();PAL.toggle();return}
 if(e.key==='Escape'&&document.body.classList.contains('pseudofull')){e.preventDefault();pseudoFull(false);return}
 if(e.key==='Escape'){const was=$('#help').classList.contains('on')||menu.classList.contains('on');$('#help').classList.remove('on');menu.classList.remove('on');if(was)return;const ae=document.activeElement;if(ae&&ae!==document.body&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)){ae.blur();return}if(curCtx()==='sub'){selectSub(null);return}deselectAll();return}
 if(e.target.closest('input,textarea,select')||mod||e.altKey)return;
 if(e.key==='?'){e.preventDefault();$('#help').classList.toggle('on');return}
 if(e.key==='-'){e.preventDefault();stepZoom(-1);return}
 if(e.key==='='||e.key==='+'){e.preventDefault();stepZoom(1);return}
 if(e.key==='0'){e.preventDefault();setViewZoom('fit');return}
 if(k==='f'){e.preventDefault();toggleFull();return}
 if(e.key==='['){e.preventDefault();LAY.toggle('lib');return}
 if(e.key===']'){e.preventDefault();LAY.toggle('insp');return}
 if(k==='h'){e.preventDefault();const c=$('#cHand');c.checked=!c.checked;c.onchange();return}
 if(k==='e'){e.preventDefault();$('#bExport').click();return}
 if(e.code==='Space'){e.preventDefault();$('#bPlay').click()}else if(e.key==='ArrowLeft'){e.preventDefault();stepF(e.shiftKey?-10:-1)}else if(e.key==='ArrowRight'){e.preventDefault();stepF(e.shiftKey?10:1)}else if(e.key==='Home'){seekTG(0)}else if(e.key==='End'){seekTG(seqTot())}else if(k==='k'){addKey()}else if(k==='s'){e.preventDefault();seqSplit()}else if(k==='c'){e.preventDefault();setTool('razor')}else if(k==='v'){e.preventDefault();setTool('select')}else if(k==='m'){e.preventDefault();if(e.shiftKey)seqJumpMarker(1);else seqMarker()}else if(e.key==='Backspace'||e.key==='Delete'){if(curCtx()==='sub'){e.preventDefault();subRemoveSel()}else if(UI.selClip||UI.selMk||selSet().size){e.preventDefault();seqDelete()}}else if(k==='g'){const c=$('#cGuide');c.checked=!c.checked;dirty=true}});

/* ============================================================ controls */
const UI={};
let fieldId=0;
function el(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}
function field(d,obj,cb){
 if(obj[d.k]===undefined)obj[d.k]=d.v;
 const row=el('div','row'),lab=el('label');lab.textContent=d.l;row.appendChild(lab);
 const fire=()=>cb&&cb(d.k,obj[d.k]);
 if(d.t==='r'){row.style.gridTemplateColumns='';const r=el('input'),nm=el('input','num');r.type='range';nm.type='number';for(const x of[r,nm]){x.min=d.min;x.max=d.max;x.step=d.st}
  const show=v=>{r.value=v;nm.value=+(+v).toFixed(3)};show(obj[d.k]);
  r.oninput=()=>{obj[d.k]=+r.value;nm.value=+(+r.value).toFixed(3);fire()};
  nm.onchange=()=>{const v=+nm.value;if(isNaN(v))return show(obj[d.k]);obj[d.k]=v;r.value=v;fire()};
  lab.classList.add('rs');lab.title='Trascina per regolare (⇧ fine, ⌥ finissimo) · doppio clic per ripristinare'+(d.un?` · unità: ${d.un}`:'');lab.ondblclick=()=>{obj[d.k]=d.v;show(d.v);fire()};
  lab.addEventListener('pointerdown',e=>{if(r.disabled||e.button!==0)return;const x0=e.clientX,v0=+obj[d.k];let moved=false;lab.setPointerCapture(e.pointerId);
   const mv=ev=>{const dx=ev.clientX-x0;if(!moved&&Math.abs(dx)<3)return;moved=true;document.body.classList.add('scrubbing');const lo=+r.min,hi=+r.max,k=(hi-lo)/400*(ev.altKey?.05:ev.shiftKey?.2:1);
    let v=clamp(v0+dx*k,Math.min(lo,v0),Math.max(hi,v0));v=+(Math.round(v/d.st)*d.st).toFixed(6);if(v!==obj[d.k]){obj[d.k]=v;show(v);fire()}};
   const up=()=>{lab.removeEventListener('pointermove',mv);lab.removeEventListener('pointerup',up);lab.removeEventListener('pointercancel',up);document.body.classList.remove('scrubbing')};
   lab.addEventListener('pointermove',mv);lab.addEventListener('pointerup',up);lab.addEventListener('pointercancel',up)});
  row.append(r,nm);row._set=v=>{obj[d.k]=v;show(v)};row._range=(a,b)=>{r.min=nm.min=a;r.max=nm.max=b};row._dis=v=>{r.disabled=nm.disabled=v;row.style.opacity=v?.45:1}}
 else if(d.t==='s'){row.classList.add('w2');const s=el('select');s.innerHTML=d.o.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');s.value=obj[d.k];s.onchange=()=>{obj[d.k]=s.value;fire()};row.appendChild(s);if(d.k==='ease')enhanceSelect(s,{scope:'ease'});row._set=v=>{obj[d.k]=v;s.value=v;s._pk&&s._pk.sync()};row._sel=s}
 else if(d.t==='b'){row.classList.add('w2');const w=el('label','sw'),c=el('input');c.type='checkbox';c.checked=!!obj[d.k];w.append(c,el('span'));c.onchange=()=>{obj[d.k]=c.checked;fire()};row.appendChild(w);row._set=v=>{obj[d.k]=v;c.checked=v}}
 else if(d.t==='c'){row.classList.add('w2');const w=el('div','colw'),c=el('input'),h=el('input','hex');c.type='color';c.value=obj[d.k];h.value=obj[d.k];
  c.oninput=()=>{obj[d.k]=c.value;h.value=c.value;fire()};h.onchange=()=>{let v=h.value.trim();if(!v.startsWith('#'))v='#'+v;if(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)){if(v.length===4)v='#'+[...v.slice(1)].map(x=>x+x).join('');obj[d.k]=v.toLowerCase();c.value=obj[d.k];fire()}else h.value=obj[d.k]};
  w.append(c,h);row.appendChild(w);row._set=v=>{obj[d.k]=v;c.value=v;h.value=v}}
 const id='field-'+(++fieldId);lab.id=id;row.querySelectorAll('input,select').forEach((control,i)=>{control.id=id+'-'+i;control.setAttribute('aria-labelledby',id)});const primary=row.querySelector('input,select');if(primary)lab.htmlFor=primary.id;
 return row}
function segRow(label,opts,obj,key,cb){const row=el('div','row w2'),lab=el('label');lab.textContent=label;const sg=el('div','seg');opts.forEach(([v,l])=>{const b=el('button',obj[key]===v?'on':'',l);b.type='button';b.onclick=()=>{obj[key]=v;[...sg.children].forEach(x=>x.classList.toggle('on',x===b));cb&&cb()};sg.appendChild(b)});row.append(lab,sg);row._set=v=>{obj[key]=v;[...sg.children].forEach((x,i)=>x.classList.toggle('on',opts[i][0]===v))};return row}
const SECS={};
const TABOF={'Blocchi di testo':'prop',Testo:'prop',Colore:'prop',Posizione:'prop','Tempi del testo':'prop',Entrata:'prop',Uscita:'prop','Movimento continuo':'prop',Immagini:'prop','Grafica SVG':'prop',Clip:'prop',Camera:'scena','Stati di layout':'scena','Audio della clip':'audio',Sottotitolo:'prop','Stile dei sottotitoli':'prop','Comparsa dei sottotitoli':'prop','Audio della sequenza':'audio'};
// in Proprietà ogni sezione appartiene a un tipo di selezione (testo, svg, immagine, clip) e, per il testo, a una sotto-scheda
const SECTX={'Blocchi di testo':['never'],Testo:['text','testo'],Colore:['text','stile'],Posizione:['text','pos'],'Tempi del testo':['text','anim'],Entrata:['text','anim'],Uscita:['text','anim'],'Movimento continuo':['text','anim'],Immagini:['text img','testo'],'Grafica SVG':['svg'],Clip:['clip'],Sottotitolo:['sub','testo'],'Stile dei sottotitoli':['sub','stile'],'Comparsa dei sottotitoli':['sub','anim']};
const OLDTAB={stile:['prop','stile'],anim:['prop','anim'],grafica:['prop'],tempo:['prop'],scena:['scena'],prop:['prop'],audio:['audio']};
function showTab(k,noSave){const m=OLDTAB[k]||['prop'];k=m[0];if(m[1])UI.sub=m[1];const ins=$('#insp');ins.dataset.tab=k;ins.querySelectorAll('.itabs button').forEach(b=>{const on=b.dataset.tab===k;b.classList.toggle('on',on);b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1});if(!noSave)setUI('inspTab',k);if(typeof applyCtx==='function'&&UI.ctxBar)applyCtx(true)}
function reveal(sec){if(!sec)return;const cx=sec.d.dataset.ctx||'';
 // la sezione chiesta deve essere visibile: si porta la selezione sul tipo giusto
 if(cx==='svg'&&!(selSvg()&&!selSvg().img)){const L=S.layers.find(l=>l.kind==='svg'&&l.id===UI.svgOpen)||S.layers.find(l=>l.kind==='svg');if(L){UI.selSvg=L.id;SEL=true}}
 else if(cx.startsWith('text')&&!cx.includes('img')||cx==='text'){UI.selSvg=null;UI.area='stage'}
 else if(cx==='text img'&&sec===UI.imgSec&&UI.imgOpen){UI.selSvg=UI.imgOpen;SEL=true;UI.area='stage'}
 else if(cx==='clip')UI.area='tl';
 if(sec.d.dataset.sub){if(cx==='sub')UI.subSub=sec.d.dataset.sub;else UI.sub=sec.d.dataset.sub}showTab(sec.d.dataset.tab||'prop');applyCtx(true);sec.d.open=true;sec.d.scrollIntoView({block:'nearest',behavior:'smooth'})}
// contesto di Proprietà: cosa è selezionato (clip della timeline, SVG, immagine, testo) o niente
function curCtx(){if(UI.area==='tl'&&UI.selSub&&cuesNow().some(q=>q.id===UI.selSub))return'sub';if(UI.area==='tl'&&UI.selClip&&S.seq.clips.some(c=>c.id===UI.selClip))return'clip';const sv=selSvg();if(sv&&SEL)return sv.img?'img':'svg';return actClip()?'text':'none'}
const SUBS=[['anim','Animazione'],['testo','Testo'],['stile','Stile'],['pos','Posizione']],SUBS_CC=[['testo','Testo'],['stile','Stile'],['anim','Comparsa']];   // come per immagini e SVG: l'animazione per prima
let CTXSIG='';
function applyCtx(force){const ins=$('#insp');if(!ins)return;const cx=curCtx(),sub=cx==='sub'?UI.subSub||'testo':UI.sub||'anim',sv=selSvg(),sig=[cx,sub,UI.selSvg,UI.selClip,UI.selSub,UI.subSel?UI.subSel.size:0,S.cur,S.seq.act].join('|');if(!force&&sig===CTXSIG)return;CTXSIG=sig;ins.dataset.ctx=cx;
 ins.querySelectorAll(':scope>details[data-tab="prop"]').forEach(d=>{const c=(d.dataset.ctx||'').split(' ');d.hidden=!(c.includes(cx)&&(cx!=='text'&&cx!=='sub'||!d.dataset.sub||d.dataset.sub===sub))});
 {const vis=[...ins.querySelectorAll(':scope>details')].filter(d=>!d.hidden&&d.dataset.tab===ins.dataset.tab&&d.dataset.ctx!=='never');if(vis.length&&!vis.some(d=>d.open))vis[0].open=true}   // almeno una sezione aperta
 // testo: le sezioni della sotto-scheda diventano gruppi sempre aperti, come nelle schede di immagini e SVG
 ins.querySelectorAll(':scope>details[data-sub]').forEach(d=>{const flat=(cx==='text'||cx==='sub')&&!d.hidden;d.classList.toggle('flat',flat);if(flat)d.open=true});
 // nelle sezioni con più livelli si vede solo quello selezionato
 ins.querySelectorAll('[data-lid]').forEach(e=>{e.hidden=(cx==='svg'||cx==='img')?e.dataset.lid!==UI.selSvg:cx==='text'});
 ins.querySelectorAll('[data-imglib]').forEach(e=>{e.hidden=cx==='img'});
 if(SECS.Immagini){SECS.Immagini.s.firstChild.textContent=cx==='img'?'Immagine ':'Immagini nel testo ';const f=SECS.Immagini.s.querySelector('.fxn');if(f)f.hidden=cx==='img'}
 const bar=UI.ctxBar;if(!bar)return;bar.innerHTML='';const what={clip:()=>{const c=S.seq.clips.find(x=>x.id===UI.selClip);return'clip '+(c?.kind==='motion'?'di grafica':c?.kind==='audio'?'audio':'video')+' «'+(c?.name||'')+'»'},svg:()=>'SVG «'+(sv?.name||'')+'»',img:()=>'immagine «'+((S.images.find(r=>r.id===sv?.img)||{}).name||'')+'»',text:()=>'testo «'+blockName(S.cur)+'»',sub:()=>{const q=selCue(),t=q?cueText(q):'',n=subSelIds().size;if(n>1)return n+' sottotitoli';return'sottotitolo «'+(t.length>32?t.slice(0,30)+'…':t)+'»'},none:()=>'niente'}[cx]();
 const l=el('div','ctxl');l.innerHTML='Selezionato: <b></b>';l.querySelector('b').textContent=what;bar.appendChild(l);
 if(cx==='text'){const tb=el('div','seg subtabs');SUBS.forEach(([k,n])=>{const x=el('button',sub===k?'on':'',n);x.type='button';x.onclick=()=>{UI.sub=k;setUI('inspSub',k);applyCtx(true)};tb.appendChild(x)});bar.appendChild(tb)}
 if(cx==='sub'){const tb=el('div','seg subtabs');SUBS_CC.forEach(([k,n])=>{const x=el('button',sub===k?'on':'',n);x.type='button';x.onclick=()=>{UI.subSub=k;setUI('subSub',k);applyCtx(true)};tb.appendChild(x)});bar.appendChild(tb)}
 if(cx==='none'){bar.appendChild(el('div','note','Seleziona un livello a sinistra o sul quadro, o una clip nella timeline. Per cominciare: "+ Grafica" sopra la timeline, o trascina un file.'))}}
function section(title){const d=el('details');d.dataset.tab=TABOF[title]||'prop';if(SECTX[title]){d.dataset.ctx=SECTX[title][0];if(SECTX[title][1])d.dataset.sub=SECTX[title][1]}d.open=isOpen('insp:'+title,false);d.addEventListener('toggle',()=>setOpen('insp:'+title,d.open));const s=el('summary',null,title);const b=el('div','body');d.append(s,b);$('#insp').appendChild(d);return SECS[title]={d,s,b}}
const onL=()=>{relayout()};
const onR=()=>{dirty=true;drawTimeline()};

function buildInspector(){
 const ins=$('#insp');ins.innerHTML='';
 const tabs=el('div','itabs');tabs.setAttribute('role','tablist');[['prop','Proprietà'],['audio','Audio'],['scena','Scena']].forEach(([k,n])=>{const b=el('button',null,n);b.type='button';b.dataset.tab=k;b.setAttribute('role','tab');b.onclick=()=>showTab(k);tabs.appendChild(b)});ins.appendChild(tabs);UI.sub=UI.sub||getUI('inspSub','anim');if(UI.sub==='tempi')UI.sub='anim';showTab(getUI('inspTab','prop'),true);
 UI.ctxBar=el('div','ctxbar');ins.appendChild(UI.ctxBar);
 buildBlocksUI();
 /* Testo */
 {const{b}=section('Testo');const ta=el('textarea','ta');ta.value=S.text;ta.setAttribute('aria-label','Testo della clip');ta.placeholder='Scrivi il testo. Invio per andare a capo.';ta.oninput=()=>{S.text=ta.value;relayout();refreshBlocks()};b.appendChild(ta);UI.text=ta;
  const fr=el('div','row w2');fr.appendChild(el('label',null,'Font'));const fs=el('select');UI.fontSel=fs;fillFonts();fs.onchange=()=>{S.font=+fs.value;syncWeight();loadFonts().then(relayout);relayout()};fr.appendChild(fs);UI.fontPk=enhanceSelect(fs,{scope:'font',key:o=>o.dataset.name,preview:o=>(FONTS[+o.value]||{}).css,removable:o=>(FONTS[+o.value]||{}).g==='Caricati',onRemove:removeFont});b.appendChild(fr);
  const up=el('div','bline');const ub=el('button','btn sm','Carica un font (.ttf .otf .woff)');ub.type='button';const fi=el('input');fi.type='file';fi.accept='.ttf,.otf,.woff,.woff2';fi.hidden=true;ub.onclick=()=>fi.click();fi.onchange=()=>uploadFont(fi.files[0]);up.append(ub,fi);b.appendChild(up);
  UI.wght=field(rng('wght','Peso',100,900,600,1),S,onL);b.appendChild(UI.wght);syncWeight();
  b.appendChild(field(bool('italic','Corsivo',false),S,onL));
  UI.fs=field(rng('fs','Dimensione',8,2400,170,1,'px'),S,onL);b.appendChild(UI.fs);
  UI.fit=field(bool('fit','Adatta al formato',false),S,()=>{UI.fs._dis(S.fit);UI.fitW.style.display=S.fit?'':'none';relayout()});b.appendChild(UI.fit);
  UI.fitW=field(rng('fitW','Larghezza',10,400,74,1,'%'),S,onL);b.appendChild(UI.fitW);UI.fitW.style.display=S.fit?'':'none';UI.fs._dis(S.fit);
  b.appendChild(field(rng('track','Spaziatura',-200,800,-20,1,'‰ em'),S,onL));
  b.appendChild(field(rng('lh','Interlinea',.6,3,1.02,.01,'×'),S,onL));
  b.appendChild(segRow('Allineamento',[['left','Sinistra'],['center','Centro'],['right','Destra']],S,'align',onL));
  b.appendChild(segRow('Maiuscole',[['none','Come scritto'],['upper','AA'],['lower','aa']],S,'tcase',onL));}
 /* Colore */
 {const{b}=section('Colore');const cc=()=>{onR();UI.palRow&&UI.palRow._refresh&&UI.palRow._refresh()};UI.colRows={color:field(col('color','Testo','#efece6'),S,cc),colorB:field(col('colorB','Colore B','#ff4d00'),S,cc),bg:field(col('bg','Sfondo','#121212'),S,cc)};
  UI.palRow=paletteRow({current:()=>({color:S.color,colorB:S.colorB,bg:S.bg}),apply:p=>{for(const k of ['color','colorB','bg'])UI.colRows[k]._set(p[k]);onR();UI.palRow._refresh()}});b.appendChild(UI.palRow);
  b.appendChild(UI.colRows.color);b.appendChild(UI.colRows.colorB);b.appendChild(UI.colRows.bg);
  b.appendChild(field(bool('transparent','Sfondo trasparente',false),S,onR));
  b.appendChild(field(bool('colorIn','Entra dal colore B',false),S,onR));
  const sw=field(rng('strokeW','Spessore',.5,20,2,.1,'px'),S,onR);b.appendChild(field(bool('stroke','Solo contorno',false),S,()=>{sw.style.display=S.stroke?'':'none';onR()}));sw.style.display=S.stroke?'':'none';b.appendChild(sw);
  b.appendChild(el('div','note','Il colore B è usato dagli effetti di colore, dal cursore e dall\'evidenziatore.'))}
 /* Posizione */
 {const{b}=section('Posizione');const ar=el('div','row w2');ar.appendChild(el('label',null,'Ancoraggio'));const an=el('div','anchor');['tl','tm','tr','ml','mm','mr','bl','bm','br'].forEach(k=>{const bt=el('button',S.anchor===k?'on':'');bt.type='button';bt.title=k;bt.onclick=()=>{S.anchor=k;[...an.children].forEach(x=>x.classList.toggle('on',x===bt));relayout()};an.appendChild(bt)});ar.appendChild(an);b.appendChild(ar);
  b.appendChild(field(rng('margin','Margine',0,40,8,.5,'%'),S,onL));UI.offX=field(rng('offX','Spost. X',-100,100,0,.1,'%'),S,onL);b.appendChild(UI.offX);UI.offY=field(rng('offY','Spost. Y',-100,100,0,.1,'%'),S,onL);b.appendChild(UI.offY);UI.bscale=field(rng('bscale','Scala',.05,6,1,.01,'×'),S,onR);b.appendChild(UI.bscale);
  const sub=el('div','sub');UI.blockSub=sub;b.appendChild(sub);buildBlock()}
 /* Tempo */
 {const sec=section('Tempi del testo'),{b}=sec;if(noText(S))sec.s.innerHTML='Tempi del testo <span class="fxn">nessun testo in questa clip</span>';UI.time={};[rng('delay','Ritardo',0,5,.25,.01,'s'),rng('dIn','Entrata',.05,10,1.1,.01,'s'),rng('hold','Pausa',0,20,1.4,.01,'s'),rng('dOut','Uscita',.05,10,.7,.01,'s'),rng('tail','Coda',0,5,.35,.01,'s')].forEach(d=>{const r=field(d,S,onR);UI.time[d.k]=r;b.appendChild(r)});
  const sr=el('div','row w2');sr.appendChild(el('label',null,'Casualità'));const bl=el('div','bline');const rb=el('button','btn sm','Nuova variazione');rb.type='button';rb.onclick=()=>{S.seed=(S.seed*48271+11)%99991;dirty=true;buildThumbs()};bl.appendChild(rb);sr.appendChild(bl);b.appendChild(sr)}
 /* Entrata */
 {const sec=section('Entrata');UI.inSec=sec;buildSlot(sec,S.inS,'in')}
 /* Uscita */
 {const sec=section('Uscita');UI.outSec=sec;buildOut()}
 /* Loop */
 {const sec=section('Movimento continuo',false);UI.loopSec=sec;buildLoop()}
 {const sec=section('Immagini',S.images.length>0);UI.imgSec=sec;buildImages()}
 {const sec=section('Grafica SVG');UI.svgSec=sec;buildSvg()}
 {const sec=section('Camera');UI.camSec=sec;buildCam()}
 {const sec=section('Stati di layout');UI.stSec=sec;buildStates()}
 {const sec=section('Clip');UI.clipSec=sec;buildClipSec()}
 {const sec=section('Sottotitolo');UI.subSec=sec;const s2=section('Stile dei sottotitoli');UI.subStSec=s2;const s3=section('Comparsa dei sottotitoli');UI.subAnSec=s3;UI.subSub=UI.subSub||getUI('subSub','testo');buildSubSecs()}
 {const sec=section('Audio della clip');UI.clipAudSec=sec;sec.d.open=true;buildClipAudio()}
 {const sec=section('Audio della sequenza');UI.mixSec=sec;buildMixSec()}
 CTXSIG='';applyCtx(true);buildLayersPane()
}
function slotCommon(b,slot,withInvert){
 const fr=el('div','row w2');fr.appendChild(el('label',null,'Effetto'));const s=el('select');CATS.forEach(c=>{const g=el('optgroup');g.label=c;FX.filter(f=>f.c===c).forEach(f=>{const o=el('option',null,f.n);o.value=f.id;g.appendChild(o)});s.appendChild(g)});s.value=slot.fx;s.onchange=()=>setFx(slot,s.value);fr.appendChild(s);enhanceSelect(s,{scope:'fx'});b.appendChild(fr);
 b.appendChild(el('div','fxdesc',FXMAP[slot.fx].d));
 b.appendChild(segRow('Scomponi',[['char','Lettere'],['word','Parole'],['line','Righe'],['all','Tutto']],slot,'split',onR));
 b.appendChild(field(sel('ease','Curva',EZ_LIST,'fx'),slot,onR));
 // il resto (sfalsamento, ordine, parametri dell'effetto) in una voce chiusa, come per immagini e SVG
 const adv=el('details','fxadv');adv.open=!!UI.fxAdv;adv.addEventListener('toggle',()=>{UI.fxAdv=adv.open});adv.appendChild(el('summary',null,'Regolazioni dell\'effetto'));b.appendChild(adv);
 adv.appendChild(field(rng('stagger','Sfalsamento',0,.98,.4,.01),slot,onR));
 adv.appendChild(field(sel('order','Ordine',[['start','Dal primo'],['end','Dall\'ultimo'],['center','Dal centro'],['edges','Dai bordi'],['lines','Per riga'],['random','Casuale']],'start'),slot,onR));
 if(withInvert)adv.appendChild(field(bool('invert','Inverti direzione',false),slot,onR));
 const o=prmOf(slot,FXMAP);FXMAP[slot.fx].p.forEach(d=>adv.appendChild(field(d,o,onR)));
 const bl=el('div','bline');const rr=el('button','btn sm','Ripristina parametri');rr.type='button';rr.onclick=()=>{slot.prms[slot.fx]={};rebuildSlots();dirty=true};bl.appendChild(rr);adv.appendChild(bl)}
function buildSlot(sec,slot,which){sec.b.innerHTML='';sec.s.innerHTML=`${which==='in'?'Entrata':'Uscita'} <span class="fxn">${FXMAP[slot.fx].n}</span>`;slotCommon(sec.b,slot,which==='out')}
function buildOut(){const sec=UI.outSec;sec.b.innerHTML='';const lbl=S.outMode==='none'?'nessuna':S.outMode==='mirror'?'specchio di '+FXMAP[S.inS.fx].n.toLowerCase():FXMAP[S.outS.fx].n;sec.s.innerHTML=`Uscita <span class="fxn">${lbl}</span>`;
 sec.b.appendChild(segRow('Modalità',[['none','Nessuna'],['mirror','Specchio'],['custom','Altra']],S,'outMode',()=>{buildOut();onR();markTiles()}));
 if(S.outMode==='mirror')sec.b.appendChild(el('div','note','L\'entrata riprodotta al contrario, con gli stessi parametri. Scegli "Altra" per un\'uscita indipendente.'));
 if(S.outMode==='none')sec.b.appendChild(el('div','note','Il testo resta fermo fino alla fine della clip.'));
 if(S.outMode==='custom')slotCommon(sec.b,S.outS,true)}
function buildLoop(){const sec=UI.loopSec;sec.b.innerHTML='';const L=S.loop;sec.s.innerHTML=`Movimento continuo <span class="fxn">${LMAP[L.fx].id==='none'?'':LMAP[L.fx].n}</span>`;
 const fr=el('div','row w2');fr.appendChild(el('label',null,'Effetto'));const s=el('select');s.innerHTML=LOOPS.map(l=>`<option value="${l.id}">${l.n}</option>`).join('');s.value=L.fx;s.onchange=()=>setLoop(s.value,{show:false});fr.appendChild(s);enhanceSelect(s,{scope:'loop'});sec.b.appendChild(fr);
 if(L.fx==='none'){sec.b.appendChild(el('div','note','Aggiunge un movimento continuo sopra l\'animazione: onda, respiro, tremolio, neon.'));return}
 sec.b.appendChild(el('div','fxdesc',LMAP[L.fx].d));
 sec.b.appendChild(segRow('Attivo',[['hold','Solo in pausa'],['always','Sempre']],L,'when',onR));
 const ps=LMAP[L.fx].p;if(ps.length){const adv=el('details','fxadv');adv.open=!!UI.fxAdv;adv.addEventListener('toggle',()=>{UI.fxAdv=adv.open});adv.appendChild(el('summary',null,'Regolazioni dell\'effetto'));const o=prmOf(L,LMAP);ps.forEach(d=>adv.appendChild(field(d,o,d.layout?onL:onR)));sec.b.appendChild(adv)}}
// assegna un movimento continuo; alcuni (le righe scorrevoli) portano con sé impostazioni consigliate
const tpPassPreset=()=>{S.loop.when='always';S.inS=mkSlot('fade',{split:'all',stagger:0,ease:'fx'});S.outMode='none';S.dIn=.2;S.hold=Math.max(S.hold,3);buildInspector();toast('Passaggio rallentato: ho impostato movimento sempre attivo, entrata semplice e nessuna uscita (il passaggio dura quanto la clip). ⌘Z per annullare')};
const tpPreset=()=>{S.loop.when='always';S.inS=mkSlot('walkin',{split:'char',stagger:.35,order:'end',ease:'fx'});S.outMode='mirror';S.hold=Math.max(S.hold,2.5);buildInspector();toast('Testo su tracciato: ho impostato l\'entrata "Cammina" e il movimento sempre attivo. ⌘Z per annullare')};
const LOOPPRESET={...Object.fromEntries(LOOPS.filter(l=>l.c==='Tracciato').map(l=>[l.id,l.id==='tp_pass'?tpPassPreset:tpPreset])),marquee(){S.loop.when='always';S.fit=true;S.fitW=55;S.align='center';S.inS=mkSlot('rowsopp',{split:'line',stagger:.3,ease:'fx'});S.outMode='mirror';S.hold=Math.max(S.hold,3);buildInspector();toast('Righe scorrevoli: ho impostato adatta al formato, entrata "Righe opposte" e movimento sempre attivo. ⌘Z per annullare')}};
function setLoop(id,{show=true}={}){const prev=S.loop.fx;S.loop.fx=id;if(id!=='none'){pushRecent('loop',id);if(id!==prev&&LOOPPRESET[id])LOOPPRESET[id]()}if(show)reveal(UI.loopSec);buildLoop();markTiles();relayout()}
function rebuildSlots(){buildSlot(UI.inSec,S.inS,'in');buildOut();buildLoop();markTiles()}
function setFx(slot,id){pushRecent('fx',id);slot.fx=id;const r=FXMAP[id].rec||{};if(r.split)slot.split=r.split;if(r.stagger!=null)slot.stagger=r.stagger;slot.order=r.order||slot.order;slot.ease='fx';rebuildSlots();dirty=true;drawTimeline()}
function syncWeight(){const f=FONTS[S.font]||FONTS[0];UI.wght._range(f.min,f.max);S.wght=clamp(S.wght,f.min,f.max);UI.wght._set(S.wght)}
function fillFonts(){const fs=UI.fontSel;fs.innerHTML='';const gs=[...new Set(FONTS.filter(f=>!f.removed).map(f=>f.g))];gs.forEach(g=>{const og=el('optgroup');og.label=g;FONTS.forEach((f,i)=>{if(f.g===g&&!f.removed){const o=el('option',null,f.n+(f.g==='Variabili'?`  ${f.min}–${f.max}`:''));o.value=i;o.dataset.name=f.n;og.appendChild(o)}});fs.appendChild(og)});fs.value=S.font;UI.fontPk&&UI.fontPk.sync()}
// i font caricati restano salvati nel browser (IndexedDB) e tornano alla prossima apertura
async function uploadFont(file){if(!file)return;try{const buf=await file.arrayBuffer(),label=file.name.replace(/\.[^.]+$/,''),name='U-'+label.replace(/[^\w-]/g,'');const ff=new FontFace(name,buf.slice(0));await ff.load();document.fonts.add(ff);
 let i=FONTS.findIndex(f=>f.store===name);if(i<0){FONTS.push({n:label,g:'Caricati',css:`"${name}",sans-serif`,min:100,max:900,store:name});i=FONTS.length-1}else FONTS[i].removed=false;
 S.font=i;const saved=await saveFont({name,label,file:file.name,data:buf,added:Date.now()});fillFonts();syncWeight();relayout();histMark();toast(saved?'Font caricato e salvato nella libreria: '+file.name:'Font caricato (non salvabile in questo browser): '+file.name)}catch(e){toast('Font non leggibile. Prova un file .ttf, .otf o .woff')}}
async function restoreFonts(){const list=await listFonts();for(const f of list){try{if(FONTS.some(x=>x.store===f.name))continue;const ff=new FontFace(f.name,f.data.slice(0));await ff.load();document.fonts.add(ff);FONTS.push({n:f.label,g:'Caricati',css:`"${f.name}",sans-serif`,min:100,max:900,store:f.name})}catch(e){}}if(list.length&&UI.fontSel)fillFonts()}
function removeFont(o){const i=+o.value,f=FONTS[i];if(!f||!f.store)return;f.removed=true;deleteFont(f.store);if(S.font===i)S.font=0;fillFonts();syncWeight();relayout();histMark();toast('Font rimosso dalla libreria: '+f.n)}
function loadFonts(){const js=FONTS.map(f=>document.fonts.load(`${f.min===f.max?f.min:400} 40px ${f.css}`).catch(()=>{}));js.push(document.fonts.load(fontStr({...S,fs:40})).catch(()=>{}));return Promise.all(js)}


/* ============================================================ block / trajectory UI */
function gridPick(label,obj,key,cb,cls){const w=el('div');w.appendChild(el('span',null,label));const an=el('div','anchor');['tl','tm','tr','ml','mm','mr','bl','bm','br'].forEach(k=>{const bt=el('button',obj[key]===k?'on '+(cls||''):'');bt.type='button';bt.title=k;bt.onclick=()=>{obj[key]=k;[...an.children].forEach(x=>x.className=x===bt?'on '+(cls||''):'');cb()};an.appendChild(bt)});w.appendChild(an);return w}
const PATHS=[
 ['Diagonale ↘','tl','br','follow','lin'],['Diagonale dritta ↘','tl','br','none','lin'],['Diagonale ↗','bl','tr','follow','lin'],
 ['Orizzontale →','ml','mr','none','lin'],['Orizzontale ←','mr','ml','none','lin'],['Verticale ↑','bm','tm','v','lin'],['Verticale ↓','tm','bm','v2','lin'],
 ['Sosta al centro','ml','mr','none','hold'],['Rallenta al centro ↘','tl','br','follow','slow'],['Entra e resta','ml','mm','none','ease']];
function applyPath(pr){const b=S.block;Object.assign(b,{mode:'path',from:pr[1],to:pr[2],rotm:pr[3],pace:pr[4],spin:0,arc:0,s0:1,s1:1});
 S.fit=true;S.fitW=Math.max(S.fitW,150);S.outMode='none';S.inS=mkSlot('fade',{split:'all',stagger:0,ease:'linear'});S.delay=0;S.dIn=.12;S.tail=0;S.hold=Math.max(3.5,S.hold);S.loop.fx='none';
 buildInspector();relayout();markTiles();t=0;setPlay(true);toast('Traiettoria: '+pr[0])}
function buildBlock(){const sub=UI.blockSub;if(!sub)return;sub.innerHTML='';const bm=S.block;
 sub.appendChild(segRow('Movimento blocco',[['none','Fermo'],['free','Libero'],['path','Traiettoria'],['keys','Keyframe']],bm,'mode',()=>{if(bm.mode==='keys'&&!(bm.keys&&bm.keys.length))bm.keys=[{t:0,x:-20,y:0,s:1,r:0,op:0,ease:'linear'},{t:Math.min(1.2,clipTotal()),x:0,y:0,s:1,r:0,op:1,ease:'outExpo'}];buildBlock();onR()}));
 if(bm.mode==='keys'){buildKeys(sub,bm);return}
 if(bm.mode==='none'){sub.appendChild(el('div','note','Muove l\'intero testo lungo tutta la clip. Con "Traiettoria" il testo attraversa il fotogramma da un bordo all\'altro, anche inclinato o in verticale.'));return}
 if(bm.mode==='free'){[rng('fx','Da X',-150,150,0,.5,'%'),rng('fy','Da Y',-150,150,0,.5,'%'),rng('tx','A X',-150,150,0,.5,'%'),rng('ty','A Y',-150,150,0,.5,'%'),rng('s0','Scala da',.05,6,1,.01,'×'),rng('s1','Scala a',.05,6,1.06,.01,'×'),rng('r0','Rotaz. da',-360,360,0,.5,'°'),rng('r1','Rotaz. a',-360,360,0,.5,'°'),sel('ease','Curva',EZ_LIST.slice(1),'inOutSine')].forEach(d=>sub.appendChild(field(d,bm,onR)));return}
 const pl=el('div','bline');PATHS.forEach(pr=>{const x=el('button','btn sm',pr[0]);x.type='button';x.onclick=()=>applyPath(pr);pl.appendChild(x)});sub.appendChild(pl);
 sub.appendChild(el('div','note','I preset impostano anche testo gigante e uscita nessuna. Poi regola tutto da qui.'));
 const gr=el('div','grids');gr.appendChild(gridPick('Entra da',bm,'from',onR));gr.appendChild(gridPick('Esce da',bm,'to',onR,'to'));sub.appendChild(gr);
 const ang=field(rng('rang','Angolo',-180,180,0,.5,'°'),bm,onR);
 sub.appendChild(field(sel('rotm','Orientamento',[['none','Dritto'],['follow','Inclinato sul percorso'],['v','Verticale ↑'],['v2','Verticale ↓'],['custom','Angolo libero']],'none'),bm,()=>{ang.style.display=bm.rotm==='custom'?'':'none';onR()}));
 ang.style.display=bm.rotm==='custom'?'':'none';sub.appendChild(ang);
 const pw=field(rng('pow','Rallentamento',1,7,3,.1),bm,onR),hd=field(rng('hold','Durata sosta',0,.9,.35,.01),bm,onR),dr=field(rng('drift','Deriva in sosta',0,30,4,.1,'%'),bm,onR);
 const vis=()=>{pw.style.display=bm.pace==='slow'?'':'none';hd.style.display=dr.style.display=bm.pace==='hold'?'':'none'};
 sub.appendChild(field(sel('pace','Andatura',[['lin','Costante'],['ease','Morbida'],['slow','Rallenta al centro'],['hold','Sosta al centro']],'lin'),bm,()=>{vis();onR()}));
 sub.append(pw,hd,dr);vis();
 [rng('arc','Arco',-60,60,0,.5,'%'),rng('spin','Rotazione extra',-720,720,0,1,'°'),rng('s0','Scala in entrata',.05,6,1,.01,'×'),rng('s1','Scala in uscita',.05,6,1,.01,'×'),rng('m','Margine fuori campo',0,30,2,.5,'%')].forEach(d=>sub.appendChild(field(d,bm,onR)));
 sub.appendChild(el('div','note','Il percorso dura tutta la clip: allunga la Pausa nella sezione Tempo per rallentarlo.'))}

/* ============================================================ blocchi di testo */
function blockName(i){const tx=(i===S.cur?S.text:S.blocks[i]?.text)||'';return tx.split('\n')[0].trim()||'(vuoto)'}
function nBlocks(){return S.blocks&&S.blocks.length>1?S.blocks.length:1}
function ensureBlocks(){if(!S.blocks||S.blocks.length<2){S.blocks=[pickText(S)];S.cur=0}}
function selectBlock(j){SEL=true;HND&&HND.update();if(j===S.cur&&nBlocks()>1)return;ensureBlocks();S.blocks[S.cur]=pickText(S);Object.assign(S,S.blocks[j]);S.cur=j;UI.selKey=null;buildInspector();relayout();markTiles()}
function addBlock(copy){ensureBlocks();S.blocks[S.cur]=pickText(S);const base=copy?JSON.parse(JSON.stringify(pickText(S))):pickText({...defaults(),text:'Nuovo testo',fs:80,fit:false,anchor:'bm',delay:+(S.delay+S.dIn*.6).toFixed(2),inS:mkSlot('blurlift',{stagger:.3,ease:'fx'})});
 if(copy)base.offY=clamp(base.offY+10,-100,100);S.blocks.push(base);selectBlock(S.blocks.length-1);toast(copy?'Blocco duplicato':'Nuovo blocco di testo')}
function delBlock(){if(nBlocks()<2){if(!(S.text||'').trim())return;S.text='';if(UI.text)UI.text.value='';buildInspector();relayout();toast('Testo eliminato: la scena resta senza testo. Per rimetterlo scrivi nel campo Testo. ⌘Z per annullare');return}S.blocks.splice(S.cur,1);const j=Math.max(0,S.cur-1);Object.assign(S,S.blocks[j]);S.cur=j;if(S.blocks.length<2){S.blocks=[];S.cur=0}UI.selKey=null;buildInspector();relayout();markTiles();toast('Blocco eliminato. ⌘Z per annullare')}
function moveBlock(d){const j=S.cur+d;if(nBlocks()<2||j<0||j>=S.blocks.length)return;S.blocks[S.cur]=pickText(S);[S.blocks[S.cur],S.blocks[j]]=[S.blocks[j],S.blocks[S.cur]];S.cur=j;buildInspector();relayout()}
function refreshBlocks(){const box=UI.blkList;if(!box)return;box.innerHTML='';const n=nBlocks();
 for(let i=0;i<n;i++){const b=el('button','blk'+(i===S.cur?' on':''));b.type='button';const num=el('span','bn');num.textContent=i+1;const nm=el('span','bt');nm.textContent=blockName(i);b.append(num,nm);b.title=blockName(i);b.onclick=()=>selectBlock(i);box.appendChild(b)}
 UI.blkSec.s.innerHTML='Blocchi di testo <span class="fxn"></span>';UI.blkSec.s.querySelector('.fxn').textContent=n>1?`${S.cur+1}/${n} · ${blockName(S.cur)}`:blockName(S.cur);
 UI.blkDel.disabled=n<2&&!(S.text||'').trim();UI.blkUp.disabled=n<2||S.cur===0;UI.blkDn.disabled=n<2||S.cur===n-1}
function buildBlocksUI(){const sec=section('Blocchi di testo',true);UI.blkSec=sec;const b=sec.b;
 const list=el('div','blks');UI.blkList=list;b.appendChild(list);
 const bl=el('div','bline');const mk=(txt,fn,tip)=>{const x=el('button','btn sm',txt);x.type='button';x.onclick=fn;if(tip)x.title=tip;bl.appendChild(x);return x};
 mk('+ Nuovo',()=>addBlock(false),'Aggiunge un blocco di testo');mk('Duplica',()=>addBlock(true),'Copia il blocco selezionato');
 UI.blkUp=mk('↑',()=>moveBlock(-1),'Porta dietro');UI.blkDn=mk('↓',()=>moveBlock(1),'Porta davanti');UI.blkDel=mk('Elimina',delBlock,'Elimina il blocco selezionato');b.appendChild(bl);
 b.appendChild(el('div','note','Ogni blocco ha testo, stile, posizione, tempi ed effetti propri. Le sezioni sotto e la timeline modificano il blocco selezionato. L\'ultimo della lista sta davanti.'));
 refreshBlocks()}

/* ============================================================ keyframes UI */
function addKey(){const b=S.block;if(b.mode!=='keys'){b.mode='keys';b.keys=b.keys||[]}const ex=b.keys.find(k=>Math.abs(k.t-t)<.5/S.fps);
 if(ex)UI.selKey=ex;else{const c=keyAt(b.keys,t),k={t:+t.toFixed(3),x:c.x,y:c.y,s:c.s,r:c.r,op:c.op,ease:'inOutCubic'};b.keys.push(k);UI.selKey=k}
 if(UI.blockSub){const dd=UI.blockSub.closest('details');if(dd){UI.sub='pos';UI.selSvg=null;showTab('prop');applyCtx(true);dd.open=true}}buildBlock();onR();toast('Keyframe a '+t.toFixed(2)+' s')}
// keyframe alla testina, senza toccare l'interfaccia: serve alle maniglie (se non c'è, lo crea con i valori attuali)
function keyHere(){const b=S.block;b.keys=b.keys||[];const ex=b.keys.find(k=>Math.abs(k.t-t)<.5/S.fps);if(ex)return ex;const c=keyAt(b.keys,t),k={t:+t.toFixed(3),x:c.x,y:c.y,s:c.s,r:c.r,op:c.op,ease:'inOutCubic'};b.keys.push(k);toast('Keyframe creato a '+t.toFixed(2)+' s');return k}
function buildKeys(sub,bm){
 const bl=el('div','bline'),add=el('button','btn sm','+ Keyframe alla testina'),clr=el('button','btn sm','Elimina tutti');add.type=clr.type='button';add.onclick=addKey;clr.onclick=()=>{bm.keys=[];buildBlock();onR()};bl.append(add,clr);sub.appendChild(bl);
 sub.appendChild(el('div','note','Ogni keyframe fissa posizione, scala, rotazione e opacità del blocco in un istante. Tra due keyframe il testo si muove con la curva del keyframe di arrivo. Tasto K: aggiungi alla testina. I rombi sulla timeline sono i keyframe.'));
 [...bm.keys].sort((a,b)=>a.t-b.t).forEach((k,i)=>{const d=el('details','lyr');d.open=k===UI.selKey;const sm=el('summary',null,`Keyframe ${i+1} `),sn=el('span','fxn');const lbl=()=>sn.textContent=(+k.t).toFixed(2)+' s';lbl();sm.appendChild(sn);d.appendChild(sm);const lb=el('div','body');d.appendChild(lb);
  const cb=kk=>{if(kk==='t')lbl();onR()};
  [rng('t','Tempo',0,30,0,.01,'s'),rng('x','Spost. X',-150,150,0,.5,'%'),rng('y','Spost. Y',-150,150,0,.5,'%'),rng('s','Scala',0,6,1,.01,'×'),rng('r','Rotazione',-720,720,0,.5,'°'),rng('op','Opacità',0,1,1,.01),sel('ease','Curva in arrivo',EZ_LIST.slice(1),'inOutCubic')].forEach(x=>lb.appendChild(field(x,k,cb)));
  const bb=el('div','bline'),go=el('button','btn sm','Vai qui'),dup=el('button','btn sm','Duplica alla testina'),del=el('button','btn sm','Elimina');go.type=dup.type=del.type='button';
  go.onclick=()=>{setPlay(false);t=clamp(k.t,0,clipTotal());dirty=true;UI.selKey=k};
  dup.onclick=()=>{const n={...k,t:+t.toFixed(3)};bm.keys.push(n);UI.selKey=n;buildBlock();onR()};
  del.onclick=()=>{bm.keys.splice(bm.keys.indexOf(k),1);buildBlock();onR()};
  bb.append(go,dup,del);lb.appendChild(bb);sub.appendChild(d)})}

/* ============================================================ images UI */
async function fileToSrc(f){const url=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(f)});if(/svg/.test(f.type))return url;
 const im=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=url});if(!im)return url;const k=Math.min(1,2400/Math.max(im.naturalWidth,im.naturalHeight));if(k===1)return url;
 const c=document.createElement('canvas');c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c.toDataURL(/jpe?g/.test(f.type)?'image/jpeg':'image/png',.92)}
async function addImages(files){let n=0;for(const f of files){if(!/^image\//.test(f.type))continue;const rec={id:'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:f.name,src:await fileToSrc(f)};if(await loadImg(rec)){S.images.push(rec);n++}}
 if(n){buildImages();relayout();histMark();toast(n===1?'Immagine aggiunta':n+' immagini aggiunte')}else toast('Nessuna immagine leggibile')}
function mkLayer(img){return{id:'l'+Math.random().toString(36).slice(2,8),img,mode:'free',x:50,y:50,size:30,rot:0,op:1,z:'above',tint:'none',start:0,end:0,fx:'pop',dIn:.7,dOut:.5,outMode:'mirror',ease:'fx',prms:{},lp:{fx:'none',prms:{}}}}
function insertToken(n){const ta=UI.text,tok=`{${n}}`,a=ta.selectionStart??ta.value.length,b=ta.selectionEnd??a;ta.value=ta.value.slice(0,a)+tok+ta.value.slice(b);S.text=ta.value;ta.focus();ta.selectionStart=ta.selectionEnd=a+tok.length;relayout()}
function buildImages(){const sec=UI.imgSec;if(!sec)return;const b=sec.b;b.innerHTML='';sec.s.innerHTML=`Immagini <span class="fxn">${S.images.length?S.images.length:''}</span>`;
 // libreria delle immagini (serve soprattutto alle immagini nel testo, {1} {2}…): con un'immagine selezionata non si vede
 const lib=el('div','imglib');lib.dataset.imglib='1';b.appendChild(lib);
 const bl=el('div','bline');const ub=el('button','btn sm','Carica immagini');ub.type='button';const fi=el('input');fi.type='file';fi.accept='image/*';fi.multiple=true;fi.hidden=true;ub.onclick=()=>fi.click();fi.onchange=()=>{addImages([...fi.files]);fi.value=''};bl.append(ub,fi);lib.appendChild(bl);
 if(!S.images.length)lib.appendChild(el('div','note','Loghi, icone, foto. Puoi metterle dentro il testo, dove si animano come una lettera, oppure come livelli liberi (colonna Livelli › Immagine).'));
 else{const list=el('div','imgs');S.images.forEach((rec,i)=>{const r=el('div','imgrow');const th=el('div','th');th.style.backgroundImage=`url("${rec.src}")`;const nm=el('div','nm');nm.innerHTML=`<b>{${i+1}}</b>`;nm.appendChild(document.createTextNode(rec.name));nm.title=rec.name;
   const ac=el('div','acts');const t1=el('button','btn sm','Nel testo');t1.type='button';t1.title=`Inserisce {${i+1}} nel testo`;t1.onclick=()=>insertToken(i+1);const t2=el('button','btn sm','Livello');t2.type='button';t2.title='Mettila sul quadro come livello';t2.onclick=()=>{const L=mkLayer(rec.id);S.layers.push(L);UI.selSvg=L.id;UI.imgOpen=L.id;SEL=true;UI.area='stage';buildImages();onR();applyCtx(true)};const t3=el('button','btn sm','×');t3.type='button';t3.title='Elimina immagine';t3.onclick=()=>{S.images.splice(i,1);S.layers=S.layers.filter(l=>l.img!==rec.id);delete IMGS[rec.id];TINT.clear();const rn=tx=>tx.replace(/\{(\d+)\}/g,(m,k)=>+k===i+1?'':+k>i+1?`{${k-1}}`:m);S.text=rn(S.text);(S.blocks||[]).forEach((b,bi)=>{if(bi!==S.cur&&typeof b.text==='string')b.text=rn(b.text)});UI.text.value=S.text;buildImages();relayout()};
   ac.append(t1,t2,t3);r.append(th,nm,ac);list.appendChild(r)});lib.appendChild(list);
  lib.appendChild(el('div','note','Nel testo scrivi {1}, {2}… dove vuoi l\'immagine: segue lettere, parole ed effetti come un carattere.'));
  lib.appendChild(field(rng('imgH','Altezza nel testo',.2,5,1.25,.01,'× maiuscola'),S,onL));
  lib.appendChild(field(bool('imgTint','Colora come il testo',false),S,onR))}
 // livelli immagine: tre schede come per gli SVG (Animazione per prima)
 const tab=getUI('imgTab','anim'),re=()=>onR(),rb=()=>{buildImages();onR()};
 S.layers.forEach((L,li)=>{if(L.kind==='svg')return;const d=el('details','lyr svgc');d.dataset.lid=L.id;d.open=true;const rec=S.images.find(x=>x.id===L.img);
  const sm=el('summary',null,(rec?rec.name:'Immagine')+' '),sn=el('span','fxn');sn.textContent=(FXMAP[L.fx]?.n||'')+(L.mode==='cover'?' · sfondo pieno':'');sm.appendChild(sn);d.appendChild(sm);const lb=el('div','body');d.appendChild(lb);
  const tb=el('div','seg subtabs');[['anim','Animazione'],['look','Aspetto'],['pos','Posizione']].forEach(([k,n])=>{const x=el('button',tab===k?'on':'',n);x.type='button';x.onclick=()=>{setUI('imgTab',k);buildImages();applyCtx(true)};tb.appendChild(x)});lb.appendChild(tb);
  const pane=el('div','subpane');lb.appendChild(pane);const grp=t=>{const g=el('div','fxg');g.appendChild(el('div','sublab',t));pane.appendChild(g);return g};
  if(tab==='anim'){const a=grp('Entrata');a.appendChild(fxSelect(L,'Effetto',rb));[rng('start','Appare a',0,30,0,.01,'s'),rng('dIn','Durata',.01,10,.7,.01,'s')].forEach(x=>a.appendChild(field(x,L,re)));a.appendChild(field(sel('ease','Curva',EZ_LIST,'fx'),L,re));
   const ps=FXMAP[L.fx]?.p||[];if(ps.length){const dd=el('details','fxadv');dd.open=!!UI.fxAdv;dd.addEventListener('toggle',()=>{UI.fxAdv=dd.open});dd.appendChild(el('summary',null,'Regolazioni dell\'effetto'));const o=prmOf(L,FXMAP);ps.forEach(x=>dd.appendChild(field(x,o,re)));a.appendChild(dd)}
   const p=grp('Poi');p.appendChild(field(rng('end','Sparisce a',0,30,0,.01,'s (0 = fine clip)'),L,re));p.appendChild(segRow('Uscita',[['none','Resta'],['mirror','Esce']],L,'outMode',rb));if(L.outMode==='mirror')p.appendChild(field(rng('dOut','Durata uscita',.01,10,.5,.01,'s'),L,re));
   const c=grp('Movimento continuo');c.appendChild(loopSelect(L.lp,rb,re))}
  if(tab==='look'){const a=grp('Aspetto');a.appendChild(field(sel('tint','Colore',[['none','Originale'],['A','Colore testo'],['B','Colore B']],'none'),L,re));a.appendChild(field(rng('op','Opacità',0,1,1,.01),L,re));
   a.appendChild(segRow('Modo',[['free','Libero'],['cover','Sfondo pieno']],L,'mode',()=>{if(L.mode==='cover'){L.size=Math.max(L.size,100);L.x=50;L.y=50;L.z='below'}rb()}))}
  if(tab==='pos'){const a=grp('Posizione');[rng('x','X',-50,150,50,.1,'%'),rng('y','Y',-50,150,50,.1,'%'),rng('size',L.mode==='cover'?'Zoom':'Larghezza',1,400,30,.5,'%'),rng('rot','Rotazione',-180,180,0,.5,'°')].forEach(x=>a.appendChild(field(x,L,re)));
   a.appendChild(segRow('Livello',[['below','Sotto il testo'],['above','Sopra']],L,'z',re))}
  const bb=el('div','bline');const del=el('button','btn sm','Rimuovi livello');del.type='button';del.onclick=()=>{S.layers.splice(S.layers.indexOf(L),1);if(UI.selSvg===L.id){UI.selSvg=null;SEL=false}buildImages();onR();applyCtx(true)};const dup=el('button','btn sm','Duplica');dup.type='button';dup.onclick=()=>{const n=dupLayer(L,2);UI.selSvg=n.id;UI.imgOpen=n.id;buildImages();onR();applyCtx(true)};bb.append(dup,del);lb.appendChild(bb);
  b.appendChild(d)});applyCtx(true)}

/* ============================================================ SVG animati */
// livelli "Grafica SVG" (S.layers con kind 'svg'): costruzione del marchio, disegno dei tracciati, spostamento per fare spazio al nome
const svgLayers=()=>S.layers.filter(L=>L.kind==='svg');
function addSvg(src,name){const doc=svgDoc(src);if(!doc||!doc.els.length){toast('SVG non leggibile o senza tracciati disegnabili');return}
 const L=mkSvgLayer(src,name||'SVG');L.cMark='svg';L.cGuide='svg';if(!doc.nGuide&&!doc.lockup){L.mode='fx';svgFxInit(L)}   // ogni SVG parte con i colori del file; un logo finito con l'animazione Effetto
 S.layers.push(L);UI.svgOpen=L.id;UI.selSvg=L.id;SEL=true;UI.area='stage';buildSvg();reveal(UI.svgSec);onR();histMark();
 toast(L.mode==='fx'?`SVG caricato: entra con l'effetto «${FXMAP[L.fx].n}». Scegli l'animazione in Grafica › Tempi`:`SVG caricato: ${doc.nGuide} linee di costruzione, ${doc.nMark} elementi del marchio`)}
// marchio + nome: il marchio si costruisce grande al centro, poi si sposta e il testo entra accanto (16:9, 1:1) o sotto (9:16, 4:5)
// logo completo (marchio + naming + payoff in un solo file): proporzioni e distanze sono quelle del file; il marchio si costruisce grande
// al centro, poi l'inquadratura si allarga sulla composizione intera e naming e payoff entrano. Il blocco di testo non serve e si svuota.
const rgbOf=c=>{const m=/rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c||'');return m?[+m[1],+m[2],+m[3]]:hexRGB(c)};
const lumOf=c=>{const v=rgbOf(c).map(x=>{x/=255;return x<=.03928?x/12.92:((x+.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2]};
function svgLockupPreset(L,doc){const[W,H]=dims(),vert=H/W>1.1,mb=doc.parts.mark.bb||doc.vb,mar=mb[3]/mb[2],dar=doc.vb[3]/doc.vb[2];
 Object.assign(L,{lock:true,mode:doc.nGuide?'build':'draw',cMark:'svg',cGuide:'svg',start:0,gStart:0,gDur:2.2,gStag:.7,mStart:1.3,mDur:.8,oMode:'retract',oAt:3,oDur:.8,fAt:3.3,fDur:.6,
  mv:true,mvAt:4.1,mvDur:1.1,mvEase:'inOutCubic',nMode:'rise',nAt:4.7,nDur:1,nStag:.5,pMode:'rise',pAt:5.5,pDur:.9,pStag:.3,hold:1.5,x:50,y:50,x2:50,y2:50,extend:true});
 L.size=+(vert?64:Math.min(48,58*H/(W*mar))).toFixed(1);
 L.size2=+Math.min(vert?86:72,(vert?40:60)*H/(W*dar)).toFixed(1);
 // contrasto: se il colore del naming si legge male sullo sfondo, sfondo bianco (o nero se il logo è chiaro)
 const ne=doc.els.find(e=>e.part==='naming'&&e.fill)||doc.els.find(e=>e.role==='mark'&&e.fill);let bgMsg='';
 if(ne&&!S.transparent){const a=lumOf(ne.fill),b=lumOf(S.bg),cr=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);if(cr<3){S.bg=a<.4?'#ffffff':'#0d0d0d';bgMsg=' Sfondo '+(a<.4?'bianco':'scuro')+' per far leggere i colori del logo.'}}
 const hadText=!!S.text.trim();S.text='';
 buildInspector();relayout();reveal(UI.svgSec);histMark();
 toast('Logo completo: costruzione del marchio, poi la composizione intera con naming e payoff, con le misure del file.'+bgMsg+(hadText?' Il blocco di testo è stato svuotato.':'')+' ⌘Z per annullare')}
function svgBrandPreset(L){const doc=svgDoc(L.src);if(!doc)return;if(doc.lockup)return svgLockupPreset(L,doc);const[W,H]=dims(),ar=doc.vb[3]/doc.vb[2],vert=H/W>1.1;
 Object.assign(L,{mode:doc.nGuide&&doc.nMark?'build':'draw',start:0,gStart:0,gDur:2.2,gStag:.7,mStart:1.3,mDur:.8,oMode:'retract',oAt:3,oDur:.8,fAt:3.3,fDur:.6,mv:true,mvAt:4.1,mvDur:1,mvEase:'inOutCubic',x:50,y:50});
 L.size=+Math.min(vert?70:42,62*H/(W*ar)).toFixed(1);
 S.fit=false;S.align=vert?'center':'left';relayout();
 // proporzioni del "lockup": l'altezza delle maiuscole del nome è circa metà (orizzontale) o un terzo (verticale) dell'altezza del marchio
 const bs=S.bscale||1,capK=Lay.capH/S.fs,wPer=Lay.bw/S.fs,hPer=Lay.bh/S.fs;
 if(!vert){let lh=.28*H,fs=.5*lh/capK/bs;const gap=()=>.3*lh,tot=()=>lh/ar+gap()+wPer*fs*bs;
  if(tot()>.86*W){const f=.86*W/tot();lh*=f;fs*=f}S.fs=Math.max(8,Math.round(fs));
  const lw=lh/ar,tw=wPer*S.fs*bs,left=(W-(lw+gap()+tw))/2;L.size2=+(lw/W*100).toFixed(1);L.x2=+((left+lw/2)/W*100).toFixed(1);L.y2=50;S.anchor='ml';S.margin=0;S.offX=+((left+lw+gap())/W*100).toFixed(1);S.offY=0}
 else{let lw=.46*W,fs=.34*lw*ar/capK/bs;if(wPer*fs*bs>.86*W)fs=.86*W/(wPer*bs);S.fs=Math.max(8,Math.round(fs));
  const lh=lw*ar,gap=.18*lh,th=hPer*S.fs*bs,top=(H-(lh+gap+th))/2;L.size2=+(lw/W*100).toFixed(1);L.x2=50;L.y2=+((top+lh/2)/H*100).toFixed(1);S.anchor='tm';S.margin=0;S.offX=0;S.offY=+((top+lh+gap)/H*100).toFixed(1)}
 S.delay=+(shotsLen(L.shots)+L.mvAt+.35).toFixed(2);S.dIn=.9;S.inS=mkSlot('mask',{split:'char',stagger:.35,ease:'fx'});S.outMode='none';S.hold=Math.max(S.hold,2.5);S.tail=.3;
 buildInspector();relayout();reveal(UI.svgSec);histMark();toast('Marchio + nome: costruzione al centro, poi il marchio si sposta e il nome entra '+(vert?'sotto':'accanto')+'. ⌘Z per annullare')}
// modo Effetto: entrata e uscita della libreria, durata, a pezzi, movimento continuo
function svgFxPane(L,pane){svgFxInit(L);const re=()=>onR(),rb=()=>{buildSvg();onR()};
 const grp=t=>{const g=el('div','fxg');g.appendChild(el('div','sublab',t));pane.appendChild(g);return g};
 // entrata
 const a=grp('Entrata');a.appendChild(fxSelect(L,'Effetto',rb));
 [rng('start','Inizia a',0,60,0,.01,'s'),rng('dIn','Durata',.05,10,.8,.01,'s')].forEach(x=>a.appendChild(field(x,L,re)));a.appendChild(field(sel('ease','Curva',EZ_LIST,'fx'),L,re));
 const ps=FXMAP[L.fx]?.p||[];if(ps.length){const d=el('details','fxadv');d.open=!!UI.fxAdv;d.addEventListener('toggle',()=>{UI.fxAdv=d.open});d.appendChild(el('summary',null,'Regolazioni dell\'effetto'));const o=prmOf(L,FXMAP);ps.forEach(x=>d.appendChild(field(x,o,re)));a.appendChild(d)}
 a.appendChild(field(bool('pieces','A pezzi',false),L,rb));
 if(L.pieces){a.appendChild(field(rng('pstag','Sfasamento',0,.95,.5,.01),L,re));a.appendChild(segRow('Ordine',[['doc','File'],['lr','Sinistra'],['tb','Alto'],['center','Centro']],L,'porder',re))}
 // poi
 const b=grp('Poi');b.appendChild(field(rng('hold','Resta visibile',0,60,2,.05,'s'),L,re));b.appendChild(segRow('Uscita',[['none','Resta'],['mirror','Esce']],L,'outMode',rb));if(L.outMode==='mirror')b.appendChild(field(rng('dOut','Durata uscita',.05,10,.6,.01,'s'),L,re));
 // movimento continuo
 const c=grp('Movimento continuo');c.appendChild(loopSelect(L.lp,rb,re))}
// livelli del file (gruppi e forme con il nome di Figma): ognuno può avere la sua animazione; gli altri seguono il logo
function fxSelect(obj,label,rb){const fr=el('div','row w2');fr.appendChild(el('label',null,label));const se=el('select');CATS.forEach(c=>{const g=el('optgroup');g.label=c;FX.filter(f=>f.c===c).forEach(f=>{const o=el('option',null,f.n);o.value=f.id;g.appendChild(o)});se.appendChild(g)});se.value=obj.fx;se.onchange=()=>{obj.fx=se.value;obj.ease='fx';rb()};fr.appendChild(se);enhanceSelect(se,{scope:'fx'});return fr}
function loopSelect(lp,rb,re){const w=el('div');const lr=el('div','row w2');lr.appendChild(el('label',null,'Continuo'));const ls=el('select');ls.innerHTML=LOOPS.map(l=>`<option value="${l.id}">${l.n}</option>`).join('');ls.value=lp.fx;ls.onchange=()=>{lp.fx=ls.value;rb()};lr.appendChild(ls);enhanceSelect(ls,{scope:'loop'});w.appendChild(lr);
 if(lp.fx!=='none'){const lo=prmOf(lp,LMAP);LMAP[lp.fx].p.forEach(x=>w.appendChild(field(x,lo,re)))}return w}
function svgLyrPane(L,pane){const doc=svgDoc(L.src);if(!doc)return;const LY=lyrOf(doc);const box=el('div');
 if(LY.length<2){box.appendChild(el('div','note','Il file ha una sola forma (o un tracciato unito): per animare parti diverse, in Figma tienile separate o in gruppi con un nome prima di esportare.'));pane.appendChild(box);return}
 const re=()=>onR(),rb=()=>{buildSvg();onR()};if(!L.lyr)L.lyr={};
 LY.forEach(ly=>{const ov=L.lyr[ly.key]||(L.lyr[ly.key]={on:false});const d=el('details','lyr');d.open=UI.svgLyr===ly.key;d.addEventListener('toggle',()=>{if(d.open){UI.svgLyr=ly.key;HND&&HND.update();dirty=true}});
  const sm=el('summary',null,ly.key+' '),sn=el('span','fxn');sn.textContent=ov.on?(FXMAP[ov.fx]?.n||'')+' · da '+(+(ov.at||0)).toFixed(2)+' s':'come il logo';sm.appendChild(sn);d.appendChild(sm);const b=el('div','body');d.appendChild(b);
  b.appendChild(field(bool('on','Animazione propria',false),ov,()=>{if(ov.on&&!ov.fx)Object.assign(ov,{fx:L.fx||'pop',at:0,dIn:L.dIn??.8,dOut:L.dOut??.6,ease:'fx',prms:{},lp:{fx:'none',prms:{}}});UI.svgLyr=ly.key;rb()}));
  if(ov.on){b.appendChild(fxSelect(ov,'Entrata',rb));[rng('at','Ritardo',0,30,0,.01,'s'),rng('dIn','Durata entrata',.05,10,.8,.01,'s')].forEach(x=>b.appendChild(field(x,ov,re)));
   if(L.outMode==='mirror')b.appendChild(field(rng('dOut','Durata uscita',.05,10,.6,.01,'s'),ov,re));b.appendChild(field(sel('ease','Curva',EZ_LIST,'fx'),ov,re));
   const ps=FXMAP[ov.fx]?.p||[];if(ps.length){const dd=el('details','fxadv');dd.open=!!UI.fxAdv;dd.addEventListener('toggle',()=>{UI.fxAdv=dd.open});dd.appendChild(el('summary',null,'Regolazioni dell\'effetto'));const o=prmOf(ov,FXMAP);ps.forEach(x=>dd.appendChild(field(x,o,re)));b.appendChild(dd)}
   if(!ov.lp)ov.lp={fx:'none',prms:{}};b.appendChild(loopSelect(ov.lp,rb,re))}
  box.appendChild(d)});
 box.appendChild(el('div','note','Clic su una parte del logo nel quadro per aprirne il livello.'));
 pane.appendChild(box)}
// livello del file sotto il puntatore (punto nella scena): il più piccolo che lo contiene
function lyrAt(L,x,y){const doc=svgDoc(L.src);if(!doc||L.mode!=='fx')return null;const LY=lyrOf(doc);if(LY.length<2)return null;const b=svgBox(L,t);if(!b)return null;const[vx,vy,vw,vh]=doc.vb,k=b.w/vw,a=-(b.rot||0)*D2R,dx=x-b.cx,dy=y-b.cy;
 const X=vx+vw/2+(dx*Math.cos(a)-dy*Math.sin(a))/k,Y=vy+vh/2+(dx*Math.sin(a)+dy*Math.cos(a))/k;let best=null,ba=Infinity;
 for(const ly of LY){const[bx,by,bw,bh]=ly.bb;if(X>=bx&&X<=bx+bw&&Y>=by&&Y<=by+bh&&bw*bh<ba){ba=bw*bh;best=ly.key}}return best}
// pannello di un livello SVG: intestazione (animazione, Marchio + nome) e quattro schede interne (Tempi, Aspetto, Posizione, Riprese)
const SVGTABS=[['tempi','Tempi'],['aspetto','Aspetto'],['pos','Posizione'],['riprese','Riprese']];
// fasi dell'animazione, per la mini timeline: etichetta, intervallo (secondi dall'inizio del livello) e comandi
function svgPhases(L,doc,lk){const f=(k,label,a,b,fields,extra)=>({k,label,a,b,fields,extra}),P=[];
 if(L.mode==='build'){P.push(f('g','Linee',L.gStart,L.gStart+L.gDur,[rng('gStart','Partenza',0,30,0,.01,'s'),rng('gDur','Durata',.05,20,2.2,.01,'s'),rng('gStag','Sfasamento',0,.95,.7,.01)]));
  P.push(f('m','Bozza',L.mStart,L.mStart+L.mDur,[rng('mStart','Appare a',0,30,1.3,.01,'s'),rng('mDur','Durata',.05,10,.8,.01,'s')]));
  P.push(f('o',L.oMode==='none'?'Linee (restano)':'Linee via',L.oAt,L.oMode==='none'?L.oAt:L.oAt+L.oDur,L.oMode==='none'?[]:[rng('oAt','A',0,30,3,.01,'s'),rng('oDur','Durata',.05,10,.8,.01,'s')],'oMode'));
  P.push(f('f','Colore',L.fAt,L.fAt+L.fDur,[rng('fAt','A',0,30,3.3,.01,'s'),rng('fDur','Durata',.05,10,.6,.01,'s')]))}
 else if(L.mode==='draw'){P.push(f('g','Disegno',L.gStart,L.gStart+L.gDur,[rng('gStart','Partenza',0,30,0,.01,'s'),rng('gDur','Durata',.05,20,2.2,.01,'s'),rng('gStag','Sfasamento',0,.95,.7,.01)]));
  P.push(f('fd','Riempimento',L.gStart+L.gDur*(1-Math.min(.95,L.gStag)),L.gStart+L.gDur+L.fDur,[rng('fDur','Riempimento di ogni forma',.05,5,.6,.01,'s')]))}
 else if(L.mode==='fade')P.push(f('g','Dissolvenza',L.gStart,L.gStart+L.gDur,[rng('gStart','Partenza',0,30,0,.01,'s'),rng('gDur','Durata',.05,20,2.2,.01,'s')]));
 P.push(f('mv',lk?'Logo completo':'Spostamento',L.mvAt,L.mv?L.mvAt+L.mvDur:L.mvAt,L.mv?[rng('mvAt','A',0,60,4.1,.01,'s'),rng('mvDur','Durata',.05,10,1,.01,'s'),sel('mvEase','Curva',EZ_LIST.filter(e=>e[0]!=='fx'),'inOutCubic')]:[],'mv'));
 if(lk){for(const[pre,tit]of[['n','Naming'],['p','Payoff']]){if(!doc.parts[pre==='n'?'naming':'payoff'].n)continue;
   P.push(f(pre,tit,L[pre+'At'],L[pre+'At']+L[pre+'Dur'],[rng(pre+'At','A',0,60,4.7,.01,'s'),rng(pre+'Dur','Durata',.05,10,1,.01,'s'),rng(pre+'Stag','Sfasamento lettere',0,.95,.4,.01)],pre+'Mode'))}
  const e0=Math.max(...P.map(x=>x.b));P.push(f('h','Fermo alla fine',e0,e0+(L.hold||0),[rng('hold','Durata',0,20,1.5,.05,'s')]))}
 return P}
function phaseBars(L,doc,lk,host){const P=svgPhases(L,doc,lk),tot=Math.max(1,...P.map(x=>x.b))*1.04,act=(UI.svgPh||(UI.svgPh={}))[L.id];
 const wrap=el('div','phz'),segs={};const upd=()=>{for(const q of svgPhases(L,doc,lk)){const g=segs[q.k];if(!g)continue;g.style.left=(q.a/tot*100)+'%';g.style.width=Math.max(.6,(q.b-q.a)/tot*100)+'%';g.classList.toggle('pt',q.b<=q.a)}};const sc=el('div','phz-scale');for(let s=0;s<=tot;s+=tot>12?2:1)sc.appendChild(Object.assign(el('span',null,s+'s'),{style:`left:${s/tot*100}%`}));wrap.appendChild(Object.assign(el('div','phz-row phz-head'),{innerHTML:'<span></span>'})).appendChild(sc);
 P.forEach(p=>{const r=el('button','phz-row'+(act===p.k?' on':''));r.type='button';r.title='Clicca per regolare: '+p.label;const lab=el('span','phz-l',p.label),tr=el('span','phz-t'),sg=el('span','phz-s');
  sg.style.left=(p.a/tot*100)+'%';sg.style.width=Math.max(.6,(p.b-p.a)/tot*100)+'%';if(p.b<=p.a)sg.classList.add('pt');segs[p.k]=sg;tr.appendChild(sg);r.append(lab,tr);
  r.onclick=()=>{UI.svgPh[L.id]=act===p.k?null:p.k;buildSvg()};wrap.appendChild(r);
  if(act===p.k){const box=el('div','phz-box');const re=()=>onR(),rb=()=>{buildSvg();onR()};
   if(p.extra==='oMode')box.appendChild(segRow('Le linee',[['retract','Si ritirano'],['fade','Svaniscono'],['none','Restano']],L,'oMode',rb));
   if(p.extra==='mv')box.appendChild(field(bool('mv',lk?'Passaggio al logo completo':'Spostamento finale',false),L,rb));
   if(p.extra==='nMode'||p.extra==='pMode')box.appendChild(segRow('Entrata',[['rise','Dal basso'],['wipe','Tendina'],['draw','Disegnato'],['fade','Dissolvenza']],L,p.extra,re));
   p.fields.forEach(x=>box.appendChild(field(x,L,()=>{onR();upd()})));
   if(p.extra==='mv'&&L.mv)box.appendChild(el('div','note','Dove arriva: scheda Posizione.'));wrap.appendChild(box)}});
 host.appendChild(wrap);
 if(L.shots&&L.shots.on)host.appendChild(el('div','note','Con le riprese attive l\'animazione riparte a ogni stacco: i tempi qui sono quelli di ogni ripartenza.'))}
function buildSvg(){const sec=UI.svgSec;if(!sec)return;const b=sec.b;b.innerHTML='';const list=svgLayers();sec.s.innerHTML=`Grafica SVG <span class="fxn">${list.length?list.map(x=>x.name).join(', '):''}</span>`;
 const bl=el('div','bline');const ub=el('button','btn sm','Carica SVG');ub.type='button';const fi=el('input');fi.type='file';fi.accept='.svg,image/svg+xml';fi.hidden=true;UI.svgFile=fi;ub.onclick=()=>fi.click();fi.onchange=async()=>{const f=fi.files[0];fi.value='';if(f)addSvg(await f.text(),f.name.replace(/\.svg$/i,''))};bl.append(ub,fi);b.appendChild(bl);
 if(!list.length){b.appendChild(el('div','note','Carica un SVG, trascinalo sull\'anteprima o incollalo (in Figma: tasto destro › Copia come › Copia come SVG, poi ⌘V qui). Le linee di costruzione si disegnano, il marchio compare in bozza e poi si riempie, e può spostarsi per fare spazio al nome. Con i gruppi chiamati marchio, naming, payoff, linee e cerchi MOTO usa il logo completo con le misure del file.'));if(UI.camSec)buildCam();return}
 const re=()=>onR(),rb=()=>{buildSvg();onR()},CO=[['A','Colore testo'],['B','Colore B'],['svg','Originale'],['custom','Scelto']],tab=getUI('svgTab','tempi');
 list.forEach((L,li)=>{const doc=svgDoc(L.src);const d=el('details','lyr svgc');d.dataset.lid=L.id;d.open=UI.svgOpen?UI.svgOpen===L.id:li===list.length-1;d.addEventListener('toggle',()=>{if(d.open)UI.svgOpen=L.id});
  const MODEN={fx:'Effetto',build:'Costruzione',draw:'Disegno',fade:'Dissolvenza',none:'Ferma'};
  const sm=el('summary',null,(L.name||'SVG '+(li+1))+' '),sn=el('span','fxn');sn.textContent=MODEN[L.mode]+(L.lock?' · logo completo':'');sm.appendChild(sn);d.appendChild(sm);const lb=el('div','body');d.appendChild(lb);
  if(!doc){lb.appendChild(el('div','note','SVG non leggibile.'));b.appendChild(d);return}
  const lk=!!(L.lock&&doc.lockup);
  // intestazione: animazione e azione principale
  const fxm=L.mode==='fx';
  lb.appendChild(field(sel('mode','Animazione',[['fx','Effetto'],['build','Costruzione'],['draw','Disegno'],['fade','Dissolvenza'],['none','Ferma']],'fx'),L,()=>{if(L.mode==='fx')svgFxInit(L);rb()}));
  sm.title=`${doc.nGuide} linee · ${doc.nMark} forme`+(doc.lockup?` · naming ${doc.parts.naming.n} · payoff ${doc.parts.payoff.n}`:'')+'. '+(doc.named?'Livelli riconosciuti dai nomi del file.':'Livelli senza nome: riconosciuti dalla forma.');
  if(!fxm){const pb=el('div','bline');const p1=el('button','btn sm pri','Marchio + nome');p1.type='button';p1.title=doc.lockup?'Costruzione del marchio al centro, poi la composizione intera del file con naming e payoff':'Costruzione al centro, poi il marchio si sposta e il testo entra accanto o sotto, in base al formato';p1.onclick=()=>svgBrandPreset(L);pb.appendChild(p1);
  if(L.mode==='build'||L.mode==='draw'||doc.nGuide){const p2=el('button','btn sm','+ riprese');p2.type='button';p2.title='Marchio + nome, con due riprese ravvicinate prima (stacco netto, l\'animazione riparte a ogni stacco)';p2.onclick=()=>{L.shots={...defaultShots({...L,start:0,gStart:0,gDur:2.2}),on:true};svgBrandPreset(L);setUI('svgTab','riprese');buildSvg();onR();histMark()};pb.appendChild(p2)}
  lb.appendChild(pb)}
  if(doc.warn.length)lb.appendChild(el('div','note',doc.warn.join(' ')));
  // schede interne
  const TABS=fxm?[['tempi','Animazione'],...(lyrOf(doc).length>1?[['livelli','Livelli']]:[]),['aspetto','Colore'],['pos','Posizione']]:SVGTABS.filter(([k])=>k!=='riprese'||L.mode==='build'||L.mode==='draw');
  const tb=el('div','seg subtabs');TABS.forEach(([k,n])=>{const x=el('button',tab===k?'on':'',n+(k==='riprese'&&L.shots&&L.shots.on?' ●':'')+(k==='livelli'&&L.lyr&&Object.values(L.lyr).some(o=>o&&o.on)?' ●':''));x.type='button';x.onclick=()=>{setUI('svgTab',k);buildSvg()};tb.appendChild(x)});lb.appendChild(tb);
  const pane=el('div','subpane');lb.appendChild(pane);
  const T=TABS.some(([k])=>k===tab)?tab:'tempi';
  if(T==='tempi'&&fxm)svgFxPane(L,pane);
  else if(T==='livelli')svgLyrPane(L,pane);
  else if(T==='tempi'){if(L.mode==='none')pane.appendChild(el('div','note','Animazione ferma: il disegno è subito completo.'));phaseBars(L,doc,lk,pane);
   pane.appendChild(field(rng('start','Il livello inizia a',0,60,0,.01,'s'),L,re))}
  if(T==='aspetto'){
   if(L.mode==='build'){const g=el('div','sub');g.appendChild(el('div','sublab','Bozza (il marchio appena costruito)'));g.appendChild(field(col('skCol','Colore','#9a9a9a'),L,re));g.appendChild(field(rng('sketch','Opacità',0,1,.35,.01),L,re));pane.appendChild(g)}
   const m=el('div','sub');if(!fxm)m.appendChild(el('div','sublab',L.mode==='build'?'Marchio finito':'Marchio'));m.appendChild(field(sel('cMark','Colore',CO,'A'),L,rb));if(L.cMark==='custom')m.appendChild(field(col('cMarkC','Colore scelto','#e47724'),L,re));pane.appendChild(m);
   if(doc.nGuide&&!fxm){const g=el('div','sub');g.appendChild(el('div','sublab','Linee di costruzione'));g.appendChild(field(sel('cGuide','Colore',CO,'B'),L,rb));if(L.cGuide==='custom')g.appendChild(field(col('cGuideC','Colore scelto','#de5266'),L,re));
    [rng('gop','Opacità',0,1,.6,.01),rng('lw','Spessore',.2,6,1,.05,'×')].forEach(x=>g.appendChild(field(x,L,re)));g.appendChild(field(bool('extend','Fino ai bordi del quadro',true),L,re));pane.appendChild(g)}}
  if(T==='pos'){const a=el('div','sub');a.appendChild(el('div','sublab',lk?'All\'inizio (solo il marchio)':'Posizione'));
   [rng('x','X',-50,150,50,.1,'%'),rng('y','Y',-50,150,50,.1,'%'),rng('size','Larghezza',1,300,40,.5,'%'),...(fxm?[rng('rot','Rotazione',-180,180,0,.5,'°')]:[])].forEach(x=>a.appendChild(field(x,L,re)));pane.appendChild(a);
   if(fxm){}else if(L.mv){const z=el('div','sub');z.appendChild(el('div','sublab',lk?'Alla fine (logo completo)':'Dove arriva con lo spostamento'));[rng('x2','X',-50,150,30,.1,'%'),rng('y2','Y',-50,150,50,.1,'%'),rng('size2','Larghezza',1,300,24,.5,'%')].forEach(x=>z.appendChild(field(x,L,re)));pane.appendChild(z)}
   else pane.appendChild(el('div','note','Per farlo spostare a un certo punto: Tempi › Spostamento.'));
   const o=el('div','sub');o.appendChild(field(rng('op','Opacità',0,1,1,.01),L,re));o.appendChild(segRow('Livello',[['below','Sotto il testo'],['above','Sopra']],L,'z',re));pane.appendChild(o)}
  if(T==='riprese'){if(!L.shots)L.shots=newShots();const SH=L.shots;
   pane.appendChild(field(bool('on','Riprese ravvicinate',false),SH,()=>{if(SH.on&&!SH.list.length)Object.assign(SH,defaultShots(L),{on:true});buildSvg();onR()}));
   if(!SH.on)pane.appendChild(el('div','note','La camera mostra da vicino una zona del marchio mentre si anima, poi stacca su un\'altra, poi sul quadro intero; a ogni stacco l\'animazione può ripartire da capo.'));
   else{const AN=Object.fromEntries(SHOT_AREAS),L2=[...SH.list].sort((x,y)=>x.at-y.at);SH.list=L2;
    L2.forEach((sh,k)=>{const dd=el('details','lyr');dd.open=UI.shotOpen===sh;dd.addEventListener('toggle',()=>{if(dd.open)UI.shotOpen=sh});const s2=el('summary',null,'Ripresa '+(k+1)+' '),sn2=el('span','fxn');sn2.textContent=(AN[sh.area]||sh.area)+' · '+sh.at.toFixed(1)+'–'+(sh.at+sh.dur).toFixed(1)+' s';s2.appendChild(sn2);dd.appendChild(s2);const bb=el('div','body');dd.appendChild(bb);
     bb.appendChild(field(sel('area','Zona',SHOT_AREAS.filter(([v])=>(v!=='naming'&&v!=='payoff')||doc.parts[v].n),'tl'),sh,rb));
     [rng('at','Da',0,60,0,.01,'s'),rng('dur','Durata',.1,20,1,.01,'s'),rng('z','Zoom in più',.5,4,1,.01,'×')].forEach(x=>bb.appendChild(field(x,sh,re)));
     const x=el('button','btn sm','Togli');x.type='button';x.onclick=()=>{SH.list.splice(k,1);if(!SH.list.length)SH.on=false;buildSvg();onR()};const bl2=el('div','bline');bl2.appendChild(x);bb.appendChild(bl2);pane.appendChild(dd)});
    const ad=el('button','btn sm','Aggiungi una ripresa');ad.type='button';ad.onclick=()=>{const l=SH.list[SH.list.length-1],used=SH.list.map(x=>x.area),ar=['tl','br','tr','bl','c'].find(v=>!used.includes(v))||'c';SH.list.push({area:ar,at:l?+(l.at+l.dur).toFixed(2):0,dur:l?l.dur:1,z:1});buildSvg();onR()};const bl3=el('div','bline');bl3.appendChild(ad);pane.appendChild(bl3);
    const o=el('div','sub');o.appendChild(field(bool('restart','A ogni stacco l\'animazione riparte da capo',true),SH,re));o.appendChild(field(bool('cut','Stacco netto fra le riprese',true),SH,rb));if(!SH.cut)o.appendChild(field(rng('tr','Allargamento finale',.1,4,.6,.05,'s'),SH,re));
    o.appendChild(field(rng('push','Spinta in avanti',0,.5,.06,.01),SH,re));pane.appendChild(o)}}
  const bb=el('div','bline end');const dup=el('button','btn sm','Duplica');dup.type='button';dup.onclick=()=>{const c=JSON.parse(JSON.stringify(L));c.id='s'+Math.random().toString(36).slice(2,8);S.layers.push(c);UI.svgOpen=c.id;buildSvg();onR()};
  const del=el('button','btn sm','Rimuovi');del.type='button';del.onclick=()=>{S.layers.splice(S.layers.indexOf(L),1);buildSvg();onR()};bb.append(dup,del);lb.appendChild(bb);
  b.appendChild(d)});buildCam()}

/* ============================================================ camera */
// target che la camera può inquadrare o seguire: testi, parti degli SVG e la punta della penna mentre disegna
function camTargets(withPen){const o=[];const bl=nBlocks();for(let i=0;i<bl;i++){const st=i===S.cur?S:(S.blocks[i]||{});o.push(['block:'+i,'Testo '+(bl>1?(i+1)+': ':'')+((st.text||'').split('\n')[0].slice(0,18)||'(vuoto)')])}
 svgLayers().forEach(L=>{const d=svgDoc(L.src),nm=L.name||'SVG';if(withPen&&(L.mode==='build'||L.mode==='draw'))o.push(['pen:'+L.id,'Penna che disegna · '+nm]);
  o.push(['svg:'+L.id+':all','Tutto l\'SVG · '+nm]);if(d&&d.parts.mark.n&&(d.lockup||d.nGuide))o.push(['svg:'+L.id+':mark','Marchio · '+nm]);if(d&&d.parts.naming.n)o.push(['svg:'+L.id+':naming','Naming · '+nm]);if(d&&d.parts.payoff.n)o.push(['svg:'+L.id+':payoff','Payoff · '+nm])});return o}
function camPresets(){const C=S.cam,tot=clipTotal(),L=svgLayers()[0],o=[];
 o.push(['Zoom lento',()=>{C.keys=[{t:0,mode:'free',x:50,y:50,z:1,r:0,ease:'inOutSine'},{t:+tot.toFixed(2),mode:'free',x:50,y:50,z:1.12,r:0,ease:'inOutSine'}];C.follow.on=false}]);
 o.push(['Avvicinati e torna',()=>{const tg=L?'svg:'+L.id+':'+(svgDoc(L.src)?.parts.mark.n?'mark':'all'):'block:0';C.keys=[{t:0,mode:'fit',target:tg,margin:30,ease:'inOutCubic'},{t:+(tot*.45).toFixed(2),mode:'fit',target:tg,margin:12,ease:'inOutCubic'},{t:+(tot*.8).toFixed(2),mode:'free',x:50,y:50,z:1,r:0,ease:'inOutCubic'}];C.follow.on=false}]);
 return o}
function buildCam(){const sec=UI.camSec;if(!sec)return;if(!S.cam)S.cam=newCamera();const C=S.cam,b=sec.b;b.innerHTML='';sec.s.innerHTML='Camera <span class="fxn">'+(C.on?(C.keys.length?C.keys.length+' keyframe':'')+(C.follow.on?' · segue':''):'')+'</span>';
 const re=()=>{onR();sec.s.querySelector('.fxn').textContent=C.on?(C.keys.length?C.keys.length+' keyframe':'')+(C.follow.on?' · segue':''):''},rb=()=>{buildCam();onR()};
 b.appendChild(field(bool('on','Camera attiva',false),C,rb));
 if(!C.on){b.appendChild(el('div','note','Inquadra la scena come una telecamera: zoom e spostamenti con keyframe, inquadrature automatiche (marchio, naming, payoff, testo) e inseguimento della penna mentre disegna. Lo sfondo resta fermo.'));return}
 const pr=el('div','bline');camPresets().forEach(([n,f])=>{const x=el('button','btn sm',n);x.type='button';x.onclick=()=>{f();buildCam();onR();histMark();toast('Camera: '+n.toLowerCase()+'. ⌘Z per annullare')};pr.appendChild(x)});b.appendChild(pr);
 // keyframe
 const ks=el('div','sub');ks.appendChild(el('div','sublab','Keyframe'));
 const K=C.keys;K.sort((x,y)=>x.t-y.t);
 K.forEach((k,i)=>{const d=el('details','lyr');d.open=UI.camOpen===k;d.addEventListener('toggle',()=>{if(d.open)UI.camOpen=k});const sm=el('summary',null,'Keyframe '+(i+1)+' ');const sn=el('span','fxn');sn.textContent=k.t.toFixed(2)+' s · '+(k.mode==='fit'?'inquadra':'zoom '+(+(k.z??1)).toFixed(2)+'×');sm.appendChild(sn);d.appendChild(sm);const lb=el('div','body');d.appendChild(lb);
  lb.appendChild(field(rng('t','Tempo',0,120,0,.01,'s'),k,re));
  lb.appendChild(segRow('Tipo',[['free','Libero'],['fit','Inquadra']],k,'mode',()=>{if(k.mode==='fit'&&!k.target){const o=camTargets(false);k.target=o.length?o[0][0]:''}buildCam();onR()}));
  if(k.mode==='fit'){const o=camTargets(false);if(o.length){lb.appendChild(field(sel('target','Cosa inquadrare',o,o[0][0]),k,re));lb.appendChild(field(rng('margin','Margine',0,40,8,.5,'%'),k,re))}else lb.appendChild(el('div','note','Niente da inquadrare: aggiungi un testo o un SVG.'))}
  else [rng('x','Centro X',-50,150,50,.1,'%'),rng('y','Centro Y',-50,150,50,.1,'%'),rng('z','Zoom',.1,12,1,.01,'×')].forEach(x=>lb.appendChild(field(x,k,re)));
  lb.appendChild(field(rng('r','Rotazione',-180,180,0,.5,'°'),k,re));
  lb.appendChild(field(sel('ease','Curva per arrivarci',EZ_LIST.filter(e=>e[0]!=='fx'),'inOutCubic'),k,re));
  const bb=el('div','bline');const go=el('button','btn sm','Vai qui');go.type='button';go.onclick=()=>{t=k.t;setPlay(false);dirty=true;updHead()};const del=el('button','btn sm','Elimina');del.type='button';del.onclick=()=>{K.splice(K.indexOf(k),1);buildCam();onR()};bb.append(go,del);lb.appendChild(bb);ks.appendChild(d)});
 const ab=el('div','bline');const add=el('button','btn sm','Aggiungi keyframe alla testina');add.type='button';add.onclick=()=>{const[W,H]=dims(),P=camAt(S,Lay,t,W,H),k={t:+t.toFixed(2),mode:'free',x:+P.x.toFixed(1),y:+P.y.toFixed(1),z:+P.z.toFixed(3),r:+P.r.toFixed(1),ease:'inOutCubic'};K.push(k);UI.camOpen=k;buildCam();onR()};ab.appendChild(add);ks.appendChild(ab);
 if(!K.length)ks.appendChild(el('div','note','Senza keyframe l\'inquadratura è quella normale. Sposta la testina, aggiungi un keyframe e cambia zoom e centro; oppure scegli "Inquadra" per avvicinarti al marchio, al naming o a un testo.'));
 b.appendChild(ks);
 // inseguimento e camera a mano: opzioni meno usate, chiuse
 const more=el('details','lyr');more.open=!!UI.camMore||C.follow.on||C.shake.amt>0;more.addEventListener('toggle',()=>{UI.camMore=more.open});more.appendChild(el('summary',null,'Altre opzioni'));const mb=el('div','body');more.appendChild(mb);
 const fs=el('div','sub');fs.appendChild(field(bool('on','Segui un elemento',false),C.follow,rb));
 if(C.follow.on){const o=camTargets(true);if(!C.follow.target&&o.length)C.follow.target=o[0][0];if(o.length)fs.appendChild(field(sel('target','Cosa seguire',o,o[0][0]),C.follow,re));
  [rng('from','Da',0,120,0,.01,'s'),rng('to','A',0,120,4,.01,'s'),rng('z','Zoom',.2,12,2,.01,'×'),rng('smooth','Morbidezza',0,1.5,.35,.01,'s'),rng('ramp','Entrata e uscita',.05,3,.5,.01,'s')].forEach(x=>fs.appendChild(field(x,C.follow,re)))}
 mb.appendChild(fs);
 const ss=el('div','sub');ss.appendChild(el('div','sublab','Camera a mano'));[rng('amt','Tremolio',0,3,0,.01,'%'),rng('hz','Velocità',.1,6,1.2,.01,'Hz'),rng('rot','Rotazione',0,3,0,.01,'°')].forEach(x=>ss.appendChild(field(x,C.shake,re)));mb.appendChild(ss);b.appendChild(more);
 b.appendChild(el('div','note','Le maniglie del testo seguono la camera. Lo sfondo e le guide restano fermi.'))}

/* ============================================================ stati di layout */
// come lo Smart Animate di Figma: la disposizione iniziale è quella normale; ogni stato sposta, scala, ruota o attenua gli elementi
const editState=()=>UI.stEdit&&S.states&&S.states.on?S.states.list.find(x=>x.id===UI.stEdit)||null:null;
function elemName(key){const[k,id]=key.split(':');if(k==='block'){const i=+id,st=i===S.cur?S:(S.blocks[i]||{});return 'Testo'+(nBlocks()>1?' '+(i+1):'')+' · '+(((st.text||'').split('\n')[0]).slice(0,22)||'(vuoto)')}
 const L=S.layers.find(l=>l.id===id);return(k==='svg'?'SVG · ':'Immagine · ')+(L&&(L.name||(S.images.find(x=>x.id===L.img)||{}).name)||'')}
function buildStates(){const sec=UI.stSec;if(!sec)return;if(!S.states)S.states=newStates();const ST=S.states,b=sec.b;b.innerHTML='';const es=editState();
 sec.s.innerHTML='Stati di layout <span class="fxn">'+(ST.on&&ST.list.length?(ST.list.length+1)+' stati'+(es?' · modifica':''):'')+'</span>';
 const re=()=>onR(),rb=()=>{buildStates();onR()};
 b.appendChild(field(bool('on','Stati di layout attivi',false),ST,()=>{if(!ST.on)UI.stEdit=null;rb()}));
 if(!ST.on){b.appendChild(el('div','note','Come lo Smart Animate di Figma: oltre alla disposizione iniziale crei altri stati in cui testi, SVG e immagini sono spostati, ridimensionati o ruotati; a un tempo scelto la scena passa da uno stato all\'altro in modo fluido.'));return}
 const list=ST.list.sort((x,y)=>x.at-y.at);
 b.appendChild(el('div','note','<b>Iniziale</b>: la disposizione normale (pannelli Posizione, Grafica SVG, Immagini).'));
 list.forEach((st,i)=>{const d=el('details','lyr');d.open=UI.stOpen===st.id||es===st;d.addEventListener('toggle',()=>{if(d.open)UI.stOpen=st.id});
  const sm=el('summary',null,st.name+' '),sn=el('span','fxn');sn.textContent='da '+st.at.toFixed(2)+' s'+(es===st?' · in modifica':'');sm.appendChild(sn);d.appendChild(sm);const lb=el('div','body');d.appendChild(lb);
  const bl=el('div','bline');const ed=el('button','btn sm'+(es===st?' pri':''),es===st?'Fine modifica':'Modifica sul quadro');ed.type='button';
  ed.onclick=()=>{if(es===st){UI.stEdit=null}else{UI.stEdit=st.id;UI.stOpen=st.id;t=stateEnd(st);setPlay(false);SEL=true}buildStates();dirty=true;updHead();HND&&HND.update()};
  const go=el('button','btn sm','Vai qui');go.type='button';go.onclick=()=>{t=stateEnd(st);setPlay(false);dirty=true;updHead()};
  const del=el('button','btn sm','Elimina');del.type='button';del.onclick=()=>{list.splice(list.indexOf(st),1);if(UI.stEdit===st.id)UI.stEdit=null;buildStates();onR()};bl.append(ed,go,del);lb.appendChild(bl);
  if(es===st)lb.appendChild(el('div','note','Sposta e ridimensiona il testo con le maniglie: le modifiche valgono solo per questo stato. Gli altri elementi qui sotto.'));
  [rng('at','Parte a',0,120,0,.01,'s'),rng('dur','Durata del passaggio',.05,10,.8,.01,'s'),rng('stag','Sfasamento tra gli elementi',0,.95,0,.01)].forEach(x=>lb.appendChild(field(x,st,re)));
  lb.appendChild(field(sel('ease','Curva',EZ_LIST.filter(e=>e[0]!=='fx'),'inOutCubic'),st,re));
  lb.appendChild(el('div','sublab','Elementi in questo stato'));
  elemKeys(S).forEach(key=>{const o=st.d[key]||(st.d[key]={});const dd=el('details','lyr');dd.open=UI.stElOpen===st.id+key;dd.addEventListener('toggle',()=>{if(dd.open)UI.stElOpen=st.id+key});
   const sumTxt=()=>{const q=full(o),p=[];if(q.dx||q.dy)p.push('X '+(q.dx>0?'+':'')+q.dx+'% · Y '+(q.dy>0?'+':'')+q.dy+'%');if(q.s!==1)p.push('×'+q.s);if(q.r)p.push(q.r+'°');if(q.op!==1)p.push('opacità '+q.op);return p.join(' · ')||'come all\'inizio'};
   const s5=el('summary',null,elemName(key)+' '),sn5=el('span','fxn');sn5.textContent=sumTxt();s5.appendChild(sn5);dd.appendChild(s5);const bb=el('div','body');dd.appendChild(bb);
   [rng('dx','Spostamento X',-150,150,0,.1,'%'),rng('dy','Spostamento Y',-150,150,0,.1,'%'),rng('s','Scala',.05,6,1,.01,'×'),rng('r','Rotazione',-360,360,0,.5,'°'),rng('op','Opacità',0,1,1,.01)].forEach(x=>bb.appendChild(field(x,o,()=>{onR();sn5.textContent=sumTxt()})));
   const rs=el('button','btn sm','Come all\'inizio');rs.type='button';rs.onclick=()=>{st.d[key]={};buildStates();onR()};const bl5=el('div','bline');bl5.appendChild(rs);bb.appendChild(bl5);lb.appendChild(dd)});
  b.appendChild(d)});
 const ab=el('div','bline');const add=el('button','btn sm','Aggiungi uno stato');add.type='button';
 add.onclick=()=>{const last=list[list.length-1],at=+Math.max(t,last?stateEnd(last)+.5:1).toFixed(2),st={id:'st'+Math.random().toString(36).slice(2,7),name:'Stato '+(list.length+2),at,dur:.8,ease:'inOutCubic',stag:0,d:last?JSON.parse(JSON.stringify(last.d)):{}};
  list.push(st);UI.stEdit=st.id;UI.stOpen=st.id;t=stateEnd(st);setPlay(false);SEL=true;buildStates();onR();updHead();HND&&HND.update();toast(st.name+': sposta gli elementi come devono essere a '+st.at.toFixed(2)+' s. "Fine modifica" quando hai finito.')};
 ab.appendChild(add);b.appendChild(ab)}

/* ============================================================ sequenza: barra, timeline, clip */
const actVisible=()=>{const c=actClip();return !!c&&isActive(c,TG())};
let STL=null;
const mediaInfo=id=>(S.media||[]).find(m=>m.id===id);
// l'audio in riproduzione si riprogramma a ogni modifica (volume, dissolvenze, tagli, spostamenti)
const audioRefresh=()=>{if(playing)saStart(TG());measureMix()};
// battiti della musica: analisi una volta per file; i marker dei battiti si rifanno dalle clip (se la musica si sposta o si taglia, la seguono)
const BEATS=new Map();
const beatsOf=id=>{if(BEATS.has(id))return BEATS.get(id);const b=MED.audioReady(id);if(!b)return null;const r=findBeats([...Array(b.numberOfChannels)].map((_,i)=>b.getChannelData(i)),b.sampleRate);BEATS.set(id,r);return r};
function syncBeats(){const seq=S.seq;if(!seq)return;const add=[];
 for(const c of seq.clips){if(!c.beatEvery||!c.media)continue;const r=beatsOf(c.media);if(!r)return;   // audio non ancora letto: i marker restano come sono
  const sp=spd(c),a=c.inp,b=c.inp+c.dur*sp,ds=new Set(r.downbeats),d0=Math.max(0,r.beats.indexOf(r.downbeats[0])),k=c.beatEvery;
  r.beats.forEach((t,i)=>{if(t<a-1e-6||t>b+1e-6||(((i-d0)%k)+k)%k)return;add.push({id:'b'+c.id+'_'+i,t:+(c.start+(t-a)/sp).toFixed(4),label:'',beat:ds.has(t)?2:1,src:c.id})})}
 seq.markers=seq.markers.filter(m=>!m.beat).concat(add)}
function seqCommit(){syncBeats();histMark();STL&&STL.render();buildClipSec();audioRefresh();dirty=true}
const selSet=()=>UI.sel||(UI.sel=new Set());
function selectClip(id,mode='only'){const s=selSet();UI.selMk=null;UI.selSub=null;
 if(!id){s.clear();UI.selClip=null}else if(mode==='toggle'){if(s.has(id))s.delete(id);else s.add(id);UI.selClip=s.has(id)?id:[...s].at(-1)||null}else{s.clear();s.add(id);UI.selClip=id}
 const c=UI.selClip&&S.seq.clips.find(x=>x.id===UI.selClip);if(c&&c.kind==='motion'&&mode==='only')activateClip(c.id);STL&&STL.render();buildClipSec();if(c&&c.kind!=='motion'&&mode==='only')reveal(UI.clipSec)}
function selectMany(ids,add){const s=selSet();if(!add)s.clear();ids.forEach(i=>s.add(i));UI.selClip=ids.at(-1)||[...s].at(-1)||null;buildClipSec()}
// lama: taglia la clip nel punto cliccato
function razorAt(id,T){const seq=S.seq,c=seq.clips.find(x=>x.id===id);if(!c)return;const p=splitClip(c,T);if(!p)return;const i=seq.clips.indexOf(c);if(c.kind==='motion'){if(c.id===seq.act)p[1].scene=sceneOf(S);p[0].auto=false;p[1].auto=false}seq.clips.splice(i,1,p[0],p[1]);seqCommit()}
function setTool(k){UI.tool=k;STL&&STL.render();buildSeqBar();toast(k==='razor'?'Lama: clic su una clip per tagliarla in quel punto · V per tornare alla selezione':'Selezione')}
function newMotionClip(track,T){const c={id:uid('c'),kind:'motion',track,name:'Nuova grafica',start:0,dur:3,inp:0,bg:'auto',auto:true,scene:sceneOf({...defaults(),text:'Nuovo testo',fit:true,delay:0,dIn:.8,hold:1.4,dOut:.6,tail:0})};
 c.start=freeSlot(S.seq,track,T,c.dur);S.seq.clips.push(c);selectClip(c.id);seqCommit();toast('Nuova clip di grafica: scrivi il testo o carica un SVG nel pannello')}
function seqSplit(){const T=TG(),seq=S.seq,sel=selSet();let list=seq.clips.filter(c=>isActive(c,T)&&(!sel.size||sel.has(c.id)));if(!list.length)return toast('Niente da dividere alla testina');
 for(const c of list){const p=splitClip(c,T);if(!p)continue;const i=seq.clips.indexOf(c);if(c.kind==='motion'){if(c.id===seq.act){p[1].scene=sceneOf(S)}p[0].auto=false;p[1].auto=false}seq.clips.splice(i,1,p[0],p[1])}
 seqCommit();toast(list.length>1?'Clip divise alla testina':'Clip divisa alla testina')}
function seqDelete(){const seq=S.seq;if(UI.selMk){seq.markers=seq.markers.filter(m=>m.id!==UI.selMk);UI.selMk=null;return seqCommit()}
 const ids=selSet().size?[...selSet()]:UI.selClip?[UI.selClip]:[];let n=0,wasAct=false;
 for(const id of ids){const c=seq.clips.find(x=>x.id===id);if(!c)continue;if(c.id===seq.act)wasAct=true;seq.clips.splice(seq.clips.indexOf(c),1);n++}
 if(!n)return;selSet().clear();UI.selClip=null;if(wasAct){const m=seq.clips.find(x=>x.kind==='motion');seq.act=null;const keep={};for(const k of PROJK)if(k in S)keep[k]=S[k];
  // senza clip di grafica il pannello resta su una scena vuota, non collegata: "+ Grafica" ne crea una nuova
  S=Object.assign(defaults(),m?m.scene||{}:{text:'',layers:[]},keep);S.seq.act=m?m.id:null;if(m){m.scene=null;SCL.delete(m.id)}UI.selSvg=null;SEL=false;buildInspector();relayout()}
 seqCommit();toast((n>1?n+' clip eliminate':'Clip eliminata')+'. ⌘Z per annullare')}
// salto al marker precedente o successivo
function seqJumpMarker(dir){const T=TG(),eps=.5/S.fps,ms=S.seq.markers.filter(m=>!m.beat).map(m=>m.t).sort((a,b)=>a-b),x=dir>0?ms.find(m=>m>T+eps):[...ms].reverse().find(m=>m<T-eps);
 if(x==null)return toast(ms.length?(dir>0?'Nessun marker dopo la testina':'Nessun marker prima della testina'):'Nessun marker: premi M per aggiungerne uno');seekTG(x);STL&&STL.head(true)}
// duplicare e copiare: clip della timeline, livelli (SVG, immagini) e blocchi di testo sul quadro. ⌥ + trascina, ⌘C / ⌘V, ⌘D.
// ⌘C/⌘V valgono per l'ultima zona usata: la timeline o il quadro.
let CLIPB=null;
const newLayerId=L=>(L.kind==='svg'?'s':'l')+Math.random().toString(36).slice(2,8);
const cloneClip=c=>{const n=JSON.parse(JSON.stringify({...c,scene:c.id===S.seq.act?sceneOf(S):c.scene}));n.id=uid('c');return n};
const selClips=()=>S.seq.clips.filter(c=>selSet().has(c.id)).sort((a,b)=>a.start-b.start);
function dupLayer(L,off=0){const n=JSON.parse(JSON.stringify(L));n.id=newLayerId(L);if(off){n.x=+(n.x+off).toFixed(1);n.y=+(n.y+off).toFixed(1)}S.layers.splice(S.layers.indexOf(L)+1,0,n);return n}
function selectLayer(L){UI.selSvg=L.id;SEL=true;if(L.img){UI.imgOpen=L.id;buildImages()}else{UI.svgOpen=L.id;buildSvg()}onR();HND&&HND.update()}
function dupBlockHere(){ensureBlocks();S.blocks[S.cur]=pickText(S);S.blocks.splice(S.cur+1,0,JSON.parse(JSON.stringify(pickText(S))));selectBlock(S.cur+1);relayout()}
function selectClipsOnly(ids){const s=selSet();s.clear();ids.forEach(i=>s.add(i));UI.selClip=ids.at(-1)||null}
function doCopy(){if(UI.area==='tl'&&selSet().size){const cl=selClips();CLIPB={type:'clips',t0:cl[0].start,items:cl.map(cloneClip)};return toast(cl.length>1?cl.length+' clip copiate':'Clip copiata')}
 const sv=selSvg();if(sv&&SEL){CLIPB={type:'layer',item:JSON.parse(JSON.stringify(sv))};return toast(sv.img?'Immagine copiata':'SVG copiato')}
 if(SEL){CLIPB={type:'block',item:JSON.parse(JSON.stringify(pickText(S)))};return toast('Blocco di testo copiato')}
 toast('Niente da copiare: seleziona una clip, un livello o un testo')}
function doPaste(){if(!CLIPB)return toast('Niente da incollare');
 if(CLIPB.type==='clips'){const T=TG(),ids=[];for(const it of CLIPB.items){const n=JSON.parse(JSON.stringify(it));n.id=uid('c');if(!tracksOf(S.seq).some(t=>t.id===n.track))n.track=firstTrack(S.seq,n.kind);n.start=freeSlot(S.seq,n.track,T+(it.start-CLIPB.t0),n.dur);S.seq.clips.push(n);ids.push(n.id)}
  selectClipsOnly(ids);seqCommit();return toast(ids.length>1?ids.length+' clip incollate alla testina':'Clip incollata alla testina')}
 if(CLIPB.type==='layer'){const n=JSON.parse(JSON.stringify(CLIPB.item));n.id=newLayerId(n);n.x=+(n.x+2).toFixed(1);n.y=+(n.y+2).toFixed(1);S.layers.push(n);selectLayer(n);histMark();return toast(n.img?'Immagine incollata':'SVG incollato')}
 ensureBlocks();S.blocks[S.cur]=pickText(S);const b=JSON.parse(JSON.stringify(CLIPB.item));b.offY=clamp((b.offY||0)+4,-100,100);S.blocks.push(b);selectBlock(S.blocks.length-1);relayout();histMark();toast('Blocco di testo incollato')}
function doDup(){if(UI.area==='tl'&&selSet().size){const cl=selClips(),end=Math.max(...cl.map(clipEnd)),t0=cl[0].start,ids=[];
  for(const c of cl){const n=cloneClip(c);n.start=freeSlot(S.seq,n.track,end+(c.start-t0),n.dur);S.seq.clips.push(n);ids.push(n.id)}selectClipsOnly(ids);seqCommit();return toast(ids.length>1?'Clip duplicate':'Clip duplicata')}
 const sv=selSvg();if(sv&&SEL){selectLayer(dupLayer(sv,2));histMark();return toast('Duplicato')}
 if(SEL)addBlock(true)}
// ⌥ + trascina sulla timeline: appena si preme compare una copia al posto di ogni clip presa; le clip prese si spostano.
// Al rilascio una copia che si sovrappone alle clip spostate (per esempio se non le hai mosse) non resta.
function dupNow(ids){const out=[];for(const id of ids){const c=S.seq.clips.find(x=>x.id===id);if(!c)continue;const n=cloneClip(c);S.seq.clips.push(n);out.push(n.id)}return out}
function dupEnd(copies){const g=new Set(copies);let n=0;S.seq.clips=S.seq.clips.filter(c=>{if(!g.has(c.id))return true;const hit=S.seq.clips.some(o=>!g.has(o.id)&&o.track===c.track&&o.start<clipEnd(c)-1e-9&&clipEnd(o)>c.start+1e-9);if(!hit)n++;return !hit});
 toast(n?(n>1?n+' clip duplicate':'Clip duplicata'):'Copia annullata: si sovrapponeva');seqCommit()}
function seqMarker(){const T=+TG().toFixed(3);S.seq.markers.push({id:uid('k'),t:T,label:''});seqCommit();toast('Marker a '+T.toFixed(2)+' s · doppio clic per dargli un nome')}
async function addMediaToSeq(info,T,tr){const isV=info.kind==='video',kind=isV?'video':'audio',track=tr&&kindOfTrack(tr)===kind?tr:firstTrack(S.seq,kind);if(!(S.media||[]).some(m=>m.id===info.id))S.media.push(info);
 const c={id:uid('c'),kind:isV?'video':'audio',track,name:info.name.replace(/\.[^.]+$/,''),start:0,dur:+Math.max(.1,info.dur).toFixed(3),inp:0,media:info.id,vol:1,fadeIn:0,fadeOut:isV?0:0,fit:'cover'};
 c.start=freeSlot(S.seq,track,T??TG(),c.dur);S.seq.clips.push(c);MED.audioOf(info.id,SA.ctx()).then(b=>{const i=b&&chInfo(info.id);if(i&&(i.kind==='one-side'||i.kind==='safety'))toast(info.name+': '+chDescribe(i))});selectClip(c.id);seqCommit();buildSeqBar()}
async function addFiles(list,at){let n=0,T=at?at.T:undefined;for(const it of list){try{const f=it.file||(it.handle?await it.handle.getFile():null);if(!f||!MED.isMediaName(f.name))continue;const info=await MED.addFile(f,it.handle);await addMediaToSeq(info,T,at&&at.track);if(T!=null)T+=Math.max(.1,info.dur);n++}catch(e){toast('File non leggibile: '+(e.message||e))}}if(n)toast(n===1?'File aggiunto alla timeline':n+' file aggiunti alla timeline')}
// barra sopra le tracce: media, nuova grafica, dividi, elimina, marker, aggancio, adatta
function buildSeqBar(){const b=$('#seqbar');if(!b)return;b.innerHTML='';const mk=(txt,tip,fn,cls='')=>{const x=el('button','btn sm '+cls,txt);x.type='button';x.title=tip;x.onclick=fn;b.appendChild(x);return x};
 const t1=mk('Selezione','Seleziona e sposta le clip · V',()=>setTool('select')),t2=mk('Lama','Clic su una clip per tagliarla in quel punto · C',()=>setTool('razor'));t1.classList.toggle('on',(UI.tool||'select')==='select');t2.classList.toggle('on',UI.tool==='razor');
 const mb=mk('Media ▾','File video e audio della cartella collegata',e=>{e.stopPropagation();toggleMediaMenu(mb)});
 mk('+ Grafica','Nuova clip di grafica alla testina (anche: doppio clic su una traccia Grafica)',()=>newMotionClip('G1',TG()));
 mk('+ Regolazione','Livello di regolazione: una correzione colore che vale per tutti i video sotto, per la sua durata (come in Premiere)',newAdjustClip);
 mk('Dividi alla testina','Divide le clip selezionate (o quelle sotto la testina) alla testina · S',seqSplit);
 mk('Elimina','Elimina la clip o il marker selezionato · ⌫',seqDelete);
 {const cc=mk('Sottotitoli','Sottotitoli automatici dal parlato: crea, correggi, stile',openSubs);cc.classList.toggle('on',!!(S.seq.subs&&S.seq.subs.words.length&&S.seq.subs.on!==false))}
 mk('‹','Marker precedente · ⌥⇧M',()=>seqJumpMarker(-1),'mkn');mk('Marker','Marker alla testina · M',seqMarker);mk('›','Marker successivo · ⇧M',()=>seqJumpMarker(1),'mkn');
 const tb=mk('+ Traccia ▾','Aggiungi una traccia di grafica, video o audio',e=>{e.stopPropagation();let m=$('#trackMenu');if(m){m.remove();return}m=el('div','menu on mediamenu');m.id='trackMenu';m.style.left=tb.offsetLeft+'px';m.style.minWidth='200px';b.appendChild(m);
  [['motion','Grafica','layers'],['video','Video','film'],['audio','Audio','music']].forEach(([k,n,ic])=>{const x=el('button',null,'<span><i data-lucide="'+ic+'"></i>Traccia '+n+'</span>');x.type='button';x.onclick=()=>{const id=addTrack(S.seq,k);m.remove();seqCommit();toast('Nuova traccia: '+tracksOf(S.seq).find(t=>t.id===id).name)};m.appendChild(x)});
  const close=()=>{m.remove();removeEventListener('click',close)};setTimeout(()=>addEventListener('click',close));if(window.lucide)lucide.createIcons()});
 const sn=mk('Aggancio','Aggancio a clip, marker e testina (tieni ⌥ per staccarlo)',()=>{setUI('seqSnap',!getUI('seqSnap',true));sn.classList.toggle('on',getUI('seqSnap',true))});sn.classList.toggle('on',getUI('seqSnap',true));
 mk('Adatta','Mostra tutta la sequenza',()=>STL&&STL.zoomFit());
 if(UI.needGrant){const g=mk('Riattiva l\'accesso ai file','Il browser chiede un clic per rileggere i file collegati',async()=>{const n=await MED.regrant((S.media||[]).map(m=>m.id));UI.needGrant=false;loadAudio();buildSeqBar();STL&&STL.render();dirty=true;toast(n?n+' file di nuovo leggibili':'Nessun file riattivato')},'pri');g.style.marginLeft='auto'}
 const miss=(S.media||[]).filter(m=>!MED.hasFile(m.id)).length;if(miss&&!UI.needGrant){const g=mk(`Ricollega i file (${miss})`,'Scegli la cartella dei video e degli audio: i file mancanti si ritrovano dal percorso o da nome e dimensione',async()=>{try{const r=await MED.relinkFolder((S.media||[]).map(m=>({...m,...(PROJ.paths[m.id]||{}),id:m.id})));if(!r)return toast('Questo browser non permette di scegliere una cartella');loadAudio();buildSeqBar();STL&&STL.render();dirty=true;toast(r.missing?`${r.found} file ritrovati, ${r.missing} ancora mancanti`:`Tutti i file ritrovati (${r.found})`)}catch(e){}},'pri');g.style.marginLeft='auto'}}
// menu dei media: cartella collegata, elenco dei file, importa
async function toggleMediaMenu(btn){let m=$('#mediaMenu');if(m){m.remove();return}m=el('div','menu on mediamenu');m.id='mediaMenu';btn.parentElement.appendChild(m);m.style.left=btn.offsetLeft+'px';m.addEventListener('click',e=>e.stopPropagation());
 const close=()=>{m.remove();removeEventListener('click',close)};setTimeout(()=>addEventListener('click',close));
 const row=(html,fn,cls='')=>{const x=el('button',cls,html);x.type='button';x.onclick=fn;m.appendChild(x);return x};
 if(!MED.canLink()){m.appendChild(el('div','note','Questo browser non permette di collegare le cartelle: trascina i file sulla timeline.'));return}
 row('<span><i data-lucide="folder-open"></i>'+(MED.folderName()?'Cambia cartella ('+MED.folderName()+')':'Collega una cartella')+'</span><small>I file restano lì: MOTO li legge senza copiarli</small>',async()=>{try{await MED.linkFolder();close();toggleMediaMenu(btn)}catch(e){}});
 row('<span><i data-lucide="file-plus"></i>Aggiungi file…</span><small>Video e audio, anche fuori dalla cartella</small>',async()=>{try{const hs=await window.showOpenFilePicker({multiple:true,types:[{description:'Video e audio',accept:{'video/*':['.mp4','.mov','.m4v'],'audio/*':['.mp3','.wav','.m4a','.aac','.aif','.aiff']}}]});close();await addFiles(hs.map(h=>({handle:h})))}catch(e){}});
 const list=await MED.listFolder().catch(()=>[]);
 if(list.length){m.appendChild(el('div','sublab','File della cartella · clic per aggiungerli alla testina'));list.forEach(f=>{const isV=MED.kindOf(f.name)==='video';row('<span><i data-lucide="'+(isV?'film':'music')+'"></i>'+f.path+'</span>',async()=>{close();await addFiles([{handle:f.handle}])})})}
 else if(MED.folderName())m.appendChild(el('div','note','Nessun video o audio nella cartella.'));
 if(window.lucide)lucide.createIcons()}
// elimina pause: energia del file (calcolata una volta), parti da tenere con le impostazioni scelte, taglio
const PZE=new Map();
const pzOpt=()=>UI.pz||(UI.pz=Object.assign({preset:'media'},PAUSE_PRESETS.media,getUI('pz',{})));
const pzEnergy=id=>{let e=PZE.get(id);if(e)return e;const b=MED.audioReady(id);if(!b)return null;e=energy([...Array(b.numberOfChannels)].map((_,i)=>b.getChannelData(i)),b.sampleRate);PZE.set(id,e);return e};
function pzPlan(c){if(!c||!c.media)return null;const b=MED.audioReady(c.media);if(!b)return null;const e=pzEnergy(c.media);
 const o=pzOpt(),sp=spd(c),kept=keepRanges(voiceRuns(e,o.thr,o.minPause),b.duration,o),pz=pausesIn(kept,c.inp,c.inp+c.dur*sp);return{kept,pz,removed:pz.reduce((s,[a,b])=>s+b-a,0)/sp}}
// vale per tutte le clip selezionate con un file (per esempio i pezzi di un taglio precedente), altrimenti per quella nel pannello
const pzTargets=c=>{const s=selSet();return s.has(c.id)?S.seq.clips.filter(x=>s.has(x.id)&&x.media):[c]};
// pause = dentro la clip; bordi = silenzio tolto all'inizio o alla fine di una clip
function pzSum(c){let n=0,e=0,rm=0,dur=0;for(const x of pzTargets(c)){const p=pzPlan(x);if(!p)return null;for(const[a,b]of p.pz){if(a<=x.inp+1e-6||b>=x.inp+x.dur*spd(x)-1e-6)e++;else n++}rm+=p.removed;dur+=x.dur}return{n,e,rm,dur}}
function pzApply(c){const list=pzTargets(c).sort((a,b)=>b.start-a.start);let T=TG(),n=0,rm=0;const ids=[];
 for(const x of list){const p=pzPlan(x);if(!p)continue;const r=removePauses(S.seq,x.id,p.kept,()=>uid('c'));if(!r)continue;T=mapTime(T,r.gcuts);n+=r.cuts;rm+=r.removed;ids.push(...r.ids)}
 if(!n)return toast('Nessuna pausa da tagliare con queste impostazioni');
 UI.pzOpen=false;const s=selSet();s.clear();ids.forEach(i=>s.add(i));UI.selClip=ids.at(-1);seqCommit();seekTG(T);toast(`Pause tagliate: −${rm.toFixed(1)} s. ⌘Z per annullare`)}
function pzSection(c){const d=el('details','sub pzs');d.open=!!UI.pzOpen;d.appendChild(el('summary',null,'Elimina pause'));d.ontoggle=()=>{UI.pzOpen=d.open;STL&&STL.render()};
 const o=pzOpt(),body=el('div','pzb'),sum=el('div','note'),rows=[];d.appendChild(body);
 const upd=()=>{setUI('pz',{preset:o.preset,minPause:o.minPause,pad:o.pad,thr:o.thr});const p=pzSum(c),k=pzTargets(c).length;
  sum.innerHTML=!p?'Sto leggendo l\'audio…':p.n||p.e?`<b>${p.n} ${p.n===1?'pausa':'pause'}</b>${p.e?` e ${p.e} ${p.e===1?'bordo':'bordi'} di silenzio`:''} da tagliare: −${p.rm.toFixed(1)} s (${k>1?k+' clip: ':'la clip '}da ${p.dur.toFixed(1)} a ${(p.dur-p.rm).toFixed(1)} s). Sono le zone rosse sulla clip.`:'Nessuna pausa più lunga della soglia.';go.disabled=!p||!(p.n||p.e);STL&&STL.render()};
 const seg=segRow('Taglio',[['delicata','Delicato'],['media','Medio'],['serrata','Serrato']],o,'preset',()=>{Object.assign(o,PAUSE_PRESETS[o.preset]);rows.forEach(r=>r._set(o[r._k]));upd()});body.appendChild(seg);
 [rng('minPause','Taglia le pause oltre',.15,2,.35,.01,'s'),rng('pad','Margine attorno alle parole',0,.5,.15,.01,'s'),rng('thr','Soglia della voce',.15,.6,.35,.01)].forEach(x=>{const r=field(x,o,()=>{seg._set('');upd()});r._k=x.k;rows.push(r);body.appendChild(r)});
 body.appendChild(sum);const go=el('button','btn pri','Taglia le pause');go.type='button';go.onclick=()=>pzApply(c);body.appendChild(go);
 body.appendChild(el('div','note','Si taglia solo dove non c\'è voce. I pezzi restano clip normali (puoi allungarli o spostarli); grafica, b-roll e marker dopo i tagli si spostano indietro, la musica resta intera. Soglia della voce più alta: si tagliano anche respiri e rumori.'));
 if(!MED.audioReady(c.media))MED.audioOf(c.media,SA.ctx());upd();return d}
// audio della sequenza: volume finale, limitatore, musica sotto la voce
function buildMixSec(){const sec=UI.mixSec;if(!sec)return;const b=sec.b;b.innerHTML='';const m=mixCfg(),re=()=>{if(playing)saStart(TG());measureMix()};
 b.appendChild(field(bool('norm','Volume uniforme',true),m,re));
 b.appendChild(field(rng('target','Volume finale',-23,-9,-14,.5,'LUFS'),m,re));
 UI.mixInfo=el('div','note');b.appendChild(UI.mixInfo);mixInfo();
 b.appendChild(el('div','note','Instagram, TikTok e YouTube: −14 LUFS. Prima ogni file si livella (voce −16, musica −20: si può spegnere nella clip), poi il mix intero va al volume finale.'));
 const l=el('div','sub');l.appendChild(field(bool('limit','Limitatore',true),m,re));l.appendChild(field(rng('ceil','Picco massimo',-6,0,-1,.1,'dB'),m,re));l.appendChild(el('div','note','Nessun picco supera questo valore: niente distorsioni quando ridi o alzi la voce.'));b.appendChild(l);
 const d=el('div','sub');d.appendChild(field(bool('duck','Musica sotto la voce',true),m,re));[rng('depth','Quanto si abbassa',3,24,12,1,'dB'),rng('attack','Discesa',.05,1,.25,.05,'s'),rng('release','Risalita',.1,2,.6,.05,'s')].forEach(x=>d.appendChild(field(x,m,re)));
 d.appendChild(el('div','note','La musica (clip audio) scende mentre parli e risale nelle pause più lunghe di 0,8 s. Vale per le clip con il tipo "Musica"; la voce è quella delle clip di tipo "Voce".'));b.appendChild(d)}
// transizione in entrata della clip (dal taglio con la clip attaccata prima): tipo, durata in fotogrammi o in battiti, direzione
const beatLen=()=>{const m=S.seq.clips.find(c=>c.beatEvery&&c.media&&BEATS.get(c.media));const r=m&&BEATS.get(m.media);return r&&r.bpm?60/r.bpm/spd(m):0};
function trSec(c){const w=el('div');const a=prevAdjacent(S.seq,c);
 if(!a){w.appendChild(el('div','note','La transizione va sul taglio con una clip attaccata subito prima, sulla stessa traccia.'));return w}
 const set=fn=>{selTargets(c).forEach(x=>{if(prevAdjacent(S.seq,x))fn(x)});seqCommit()};
 const o={type:c.tr?c.tr.type:'none'};
 {const r=el('div','row w2');r.appendChild(el('label',null,'Dal taglio'));const se=el('select'),TN=Object.fromEntries(TR_TYPES);se.appendChild(Object.assign(el('option',null,'Stacco netto'),{value:'none'}));
  TR_GROUPS.forEach(([g,list])=>{const og=el('optgroup');og.label=g;list.forEach(k=>og.appendChild(Object.assign(el('option',null,TN[k]),{value:k})));se.appendChild(og)});se.value=o.type;
  se.onchange=()=>{o.type=se.value;set(x=>{if(o.type==='none')delete x.tr;else x.tr={dur:.5,...(x.tr||{}),type:o.type}})};r.appendChild(se);w.appendChild(r)}
 if(c.tr){const fr={f:Math.round(c.tr.dur*S.fps)};
  w.appendChild(field(rng('f','Durata',2,Math.round(4*S.fps),Math.round(.5*S.fps),1,'fotogrammi'),fr,()=>{selTargets(c).forEach(x=>{if(x.tr)x.tr.dur=fr.f/S.fps});STL&&STL.render();dirty=true}));
  const bl=el('div','bline'),bt=beatLen(),P=[[6/S.fps,'6 fot.'],[12/S.fps,'12 fot.'],...(bt?[[bt/2,'½ battito'],[bt,'1 battito']]:[])];
  P.forEach(([d,l])=>{const x=el('button','btn sm',l);x.type='button';x.onclick=()=>set(y=>{if(y.tr)y.tr.dur=+d.toFixed(4)});bl.appendChild(x)});w.appendChild(bl);
  if(TR_DIR.includes(c.tr.type))w.appendChild(segRow('Verso',[['L','Sinistra'],['R','Destra'],['U','Su'],['D','Giù']],c.tr,'dir',()=>set(y=>{if(y.tr)y.tr.dir=c.tr.dir})));
  const eff=trDur(S.seq,c);if(eff<c.tr.dur-1e-6)w.appendChild(el('div','note',`Accorciata a ${eff.toFixed(2)} s: non può durare più delle due clip.`));
  const all=el('button','btn sm','Uguale su tutti i tagli della traccia');all.type='button';all.onclick=()=>{let n=0;for(const x of S.seq.clips)if(x.track===c.track&&x!==c&&prevAdjacent(S.seq,x)){x.tr={...c.tr};n++}seqCommit();toast(n?`Transizione copiata su ${n} tagli`:'Nessun altro taglio su questa traccia')};const b2=el('div','bline');b2.appendChild(all);w.appendChild(b2)}
 return w}
// clip su cui agire: tutte le selezionate se quella nel pannello ne fa parte
const selTargets=c=>{const s=selSet();return s.has(c.id)?S.seq.clips.filter(x=>s.has(x.id)):[c]};
// velocità della clip (o delle clip selezionate). I pezzi uno dopo l'altro sulla stessa traccia restano attaccati
// (per esempio il parlato dopo Elimina pause); se una clip si allunga, quelle che seguono si spostano quanto serve.
function speedRow(c,cb){const w=el('div','sub');w.appendChild(el('div','sublab','Velocità'));const o={v:Math.round(spd(c)*100),p:String(Math.round(spd(c)*100))};
 const apply=v=>{const T0=TG(),list=selTargets(c).sort((a,b)=>a.start-b.start),glued=list.map((x,i)=>i>0&&x.track===list[i-1].track&&Math.abs(x.start-clipEnd(list[i-1]))<1e-6);
  list.forEach((x,i)=>{if(glued[i])x.start=clipEnd(list[i-1]);setSpeed(S.seq,x,v/100);if(x.kind==='motion')x.auto=false});setTG(T0);cb&&cb()};
 const seg=segRow('',[['25','25%'],['50','50%'],['100','100%'],['150','150%'],['200','200%']],o,'p',()=>{o.v=+o.p;rr._set(o.v);apply(o.v)});seg.querySelector('label').remove();seg.className='spdseg';w.appendChild(seg);
 const rr=field(rng('v','Velocità',10,400,100,1,'%'),o,()=>{seg._set(String(o.v));apply(o.v)});w.appendChild(rr);
 if(c.kind!=='motion')w.appendChild(field(bool('keepPitch','Mantieni il tono della voce',true),c,()=>{selTargets(c).forEach(x=>x.keepPitch=c.keepPitch);audioRefresh()}));
 w.title='La clip mostra sempre lo stesso pezzo, quindi cambia durata. I b-roll a 50p restano fluidi fino al 50% in un video a 25 fps.';
 return w}
// inquadratura della clip nel formato attuale (ogni formato ha la sua): punto al centro e zoom; si trascina anche sul quadro
function setFrame(c,f){const fm=S.fmt;if(!c.frame)c.frame={};c.frame[fm]={x:+f.x.toFixed(4),y:+f.y.toFixed(4),z:+f.z.toFixed(3)}}
function frameSec(c,re){const w=el('div','sub'),fm=S.fmt,f=frameFor(c,fm),o={x:Math.round(f.x*1000)/10,y:Math.round(f.y*1000)/10,z:Math.round(f.z*100)};
 w.appendChild(el('div','sublab',`Inquadratura nel ${fm}`));
 const up=()=>{setFrame(c,{x:o.x/100,y:o.y/100,z:o.z/100});re()};
 [rng('x','Orizzontale',0,100,50,.1,'%'),rng('y','Verticale',0,100,50,.1,'%'),rng('z','Zoom',50,400,100,1,'%')].forEach(x=>w.appendChild(field(x,o,up)));
 const bl=el('div','bline'),b1=el('button','btn sm','Centra');b1.type='button';b1.onclick=()=>{if(c.frame)delete c.frame[fm];buildClipSec();re()};
 const b2=el('button','btn sm','Uguale in tutti i formati');b2.type='button';b2.title='Copia questa inquadratura negli altri formati';b2.onclick=()=>{const cur=frameFor(c,fm);c.frame={};Object.keys(FMT).forEach(k=>c.frame[k]={...cur});toast('Inquadratura copiata in tutti i formati');re()};bl.append(b1,b2);w.appendChild(bl);
 const others=Object.keys(c.frame||{}).filter(k=>k!==fm);w.appendChild(el('div','note','Trascina il video sul quadro per scegliere cosa si vede, rotella per lo zoom. Ogni formato ha la sua inquadratura'+(others.length?` (già scelta anche per ${others.join(', ')})`:'')+'.'));
 return w}
// proprietà della clip selezionata (scheda Tempo)
// la clip selezionata: proprietà (scheda Proprietà) e audio (scheda Audio)
function buildClipSec(){buildClipProps();buildClipAudio()}
function buildClipProps(){const sec=UI.clipSec;if(!sec)return;const b=sec.b;b.innerHTML='';const c=UI.selClip&&S.seq.clips.find(x=>x.id===UI.selClip);
 const ns=selSet().size;sec.s.innerHTML='Clip <span class="fxn">'+(ns>1?ns+' selezionate':c?c.name:'')+'</span>';
 if(!c){b.appendChild(el('div','note','Seleziona una clip nella timeline. Doppio clic su una traccia Grafica per una clip nuova; trascina video e audio sulla timeline o usa Media.'));return}
 const re=()=>{STL&&STL.render();audioRefresh();dirty=true},rb=()=>{buildClipSec();re()},isM=c.kind==='motion',isA=!!c.adj,hasF=!isM&&!isA&&MED.hasFile(c.media);
 const nm=el('div','row w2');nm.appendChild(el('label',null,'Nome'));const ni=el('input','in');ni.value=c.name;ni.oninput=()=>{c.name=ni.value;STL&&STL.render()};nm.appendChild(ni);b.appendChild(nm);
 const info=el('div','note cinfo'),inf=()=>info.textContent=`${c.start.toFixed(2)}–${clipEnd(c).toFixed(2)} s · ${c.dur.toFixed(2)} s`+(isM||isA?'':` · dal file a ${c.inp.toFixed(2)} s`)+(spd(c)!==1?` · ${Math.round(spd(c)*100)}%`:'');inf();b.appendChild(info);
 if(!isM&&!isA&&!hasF)b.appendChild(el('div','note warn','File non leggibile: '+(mediaInfo(c.media)?.name||'')+'. Usa "Riattiva l\'accesso ai file" o ricollega la cartella.'));
 // schede: solo quelle che servono a questo tipo di clip
 const T=[['gen','Clip'],...(c.adj?[['color','Colore']]:c.kind==='video'?[['frame','Quadro'],['color','Colore'+(hasGrade(c)?' ●':'')],['stab','Stabilizza'+(c.stab&&c.stab.on?' ●':'')]]:[]),...(c.kind!=='audio'&&!c.adj?[['tr','Transizione'+(c.tr&&trDur(S.seq,c)?' ●':'')]]:[])];
 let tab=getUI('clipTab','gen');if(!T.some(([k])=>k===tab))tab='gen';
 const tb=el('div','seg subtabs');T.forEach(([k,n])=>{const x=el('button',tab===k?'on':'',n);x.type='button';x.onclick=()=>{setUI('clipTab',k);buildClipSec();STL&&STL.render()};tb.appendChild(x)});b.appendChild(tb);
 const pane=el('div','subpane');b.appendChild(pane);
 if(tab==='gen'&&isA)pane.appendChild(el('div','note','Livello di regolazione: la correzione colore (scheda Colore) vale per tutti i video delle tracce sotto, per la durata della clip. Le dissolvenze (quadratini negli angoli in alto della clip) la fanno entrare e uscire gradualmente. La grafica sta sopra e non viene corretta.'));
 if(tab==='gen'&&!isA){pane.appendChild(speedRow(c,()=>{inf();re()}));
  if(isM){pane.appendChild(segRow('Sfondo',[['auto','Automatico'],['on','Sempre'],['off','Mai']],c,'bg',re));pane.appendChild(field(bool('auto','Durata uguale all\'animazione',true),c,()=>{if(c.auto!==false&&c.id===S.seq.act)c.dur=+(clipTotal()/spd(c)).toFixed(3);rb()}))}
  if(c.kind==='video'&&!c.adj)pane.appendChild(segRow('Nel quadro',[['cover','Riempie'],['contain','Intero (bande)']],c,'fit',re))}
 if(tab==='frame')pane.appendChild(frameSec(c,re));
 if(tab==='stab')pane.appendChild(stabSec(c,re));
 if(tab==='color')pane.appendChild(colorSec(c,re));
 if(tab==='tr')pane.appendChild(trSec(c));
}
// scheda Audio: l'audio della clip selezionata (volume, canali, battiti, pause); il mix della sequenza è la sezione sotto
function buildClipAudio(){const sec=UI.clipAudSec;if(!sec)return;const b=sec.b;b.innerHTML='';const c=UI.selClip&&S.seq.clips.find(x=>x.id===UI.selClip);
 sec.s.innerHTML='Audio della clip <span class="fxn">'+(c&&c.kind!=='motion'?c.name:'')+'</span>';
 if(!c||c.kind==='motion'||c.adj){b.appendChild(el('div','note',c?(c.adj?'Il livello di regolazione non ha audio.':'Le clip di grafica non hanno audio.')+' Seleziona una clip video o audio nella timeline.':'Seleziona una clip video o audio nella timeline.'));UI.pzOpen=false;STL&&STL.render();return}
 const re=()=>{STL&&STL.render();audioRefresh();dirty=true},rb=()=>{buildClipSec();re()},hasF=MED.hasFile(c.media),music=roleOf(c)==='music';
 if(!hasF)b.appendChild(el('div','note warn','File non leggibile: '+(mediaInfo(c.media)?.name||'')+'. Usa "Riattiva l\'accesso ai file" o ricollega la cartella.'));
 const T=[['audio','Volume e canali'],...(hasF?[['tools',music?'Ritmo e pause':'Pause']]:[]),...(hasF&&!music?[['subs','Sottotitoli']]:[])];let tab=getUI('audTab','audio');if(!T.some(([k])=>k===tab))tab='audio';UI.pzOpen=tab==='tools'&&$('#insp').dataset.tab==='audio';
 const tb=el('div','seg subtabs');T.forEach(([k,n])=>{const x=el('button',tab===k?'on':'',n);x.type='button';x.onclick=()=>{setUI('audTab',k);buildClipAudio();STL&&STL.render()};tb.appendChild(x)});b.appendChild(tb);
 const pane=el('div','subpane');b.appendChild(pane);
 if(tab==='audio'){const grp=t=>{const g=el('div','fxg');g.appendChild(el('div','sublab',t));pane.appendChild(g);return g};
  const a=grp('Volume');a.appendChild(field(bool('mute','Muto',false),c,re));[rng('vol','Volume',0,2,1,.01,'×'),rng('fadeIn','Entrata',0,10,0,.05,'s'),rng('fadeOut','Uscita',0,10,0,.05,'s')].forEach(x=>a.appendChild(field(x,c,re)));
  const fc=field(sel('fadeCurve','Curva',[['eq','Dolce (come Premiere)'],['exp','In decibel (finali di musica)'],['lin','Lineare']],'eq'),c,()=>{selTargets(c).forEach(x=>{if(x.media)x.fadeCurve=c.fadeCurve});re()});fc.title='Le dissolvenze si trascinano anche dai quadratini negli angoli in alto della clip';a.appendChild(fc);
  const ci=chInfo(c.media),un={left:'sinistro',right:'destro',stereo:'stereo',mono:'mono'},k=grp('Canali e livello');
  const chr=field(sel('ch','Canali',[['auto','Automatico'+(ci?' ('+(ci.use==='stereo'?'stereo':'solo '+un[ci.use])+')':'')],['stereo','Stereo (come registrato)'],['left','Solo il sinistro, su entrambi i lati'],['right','Solo il destro, su entrambi i lati'],['mono','Mono (somma dei due)']],'auto'),c,()=>{selTargets(c).forEach(x=>{if(x.media)x.ch=c.ch});re()});if(ci)chr.title=chDescribe(ci);k.appendChild(chr);
  k.appendChild(field(sel('role','Tipo',[['auto','Automatico ('+ROLE_N[roleAuto(c)]+')'],['voice','Voce'],['music','Musica'],['fx','Ambiente / effetti']],'auto'),c,()=>{selTargets(c).forEach(x=>{if(x.media)x.role=c.role});rb()}));
  if(roleOf(c)!=='fx'){const nr=field(bool('norm','Uniforma il volume',true),c,()=>{selTargets(c).forEach(x=>{if(x.media)x.norm=c.norm});re()});const L=loudOf(c);if(L!=null&&isFinite(L)&&c.norm!==false){const g=20*Math.log10(clipNormGain(c));nr.title=`File: ${L.toFixed(1)} LUFS → ${ROLE_T[roleOf(c)]} come ${ROLE_N[roleOf(c)]} (${g>=0?'+':''}${g.toFixed(1)} dB)`}k.appendChild(nr)}}
 if(tab==='tools'){if(music){const bt=el('div','fxg');bt.appendChild(el('div','sublab','Battiti'));
   if(!c.beatEvery){const bl=el('div','bline'),go=el('button','btn sm pri','Trova i battiti');go.type='button';go.onclick=()=>{const r=beatsOf(c.media);if(!r)return toast('Sto leggendo l\'audio, riprova tra un attimo');if(!r.beats.length)return toast('Nessun battito regolare trovato in questa musica');c.beatEvery=1;seqCommit();toast(`${r.bpm} BPM: battiti segnati sul righello (più marcati i primi tempi)`)};bl.appendChild(go);bt.appendChild(bl)}
   else{const r=BEATS.get(c.media),o={v:String(c.beatEvery)};bt.appendChild(el('div','note',r?`<b>${r.bpm} BPM</b> · ${r.downbeats.length} misure da 4`:'Sto leggendo l\'audio…'));
    bt.appendChild(segRow('Marker',[['1','Ogni battito'],['2','Ogni 2'],['4','Misura'],['8','2 misure']],o,'v',()=>{c.beatEvery=+o.v;seqCommit()}));
    const bl=el('div','bline'),x=el('button','btn sm','Togli i battiti');x.type='button';x.onclick=()=>{delete c.beatEvery;seqCommit()};bl.appendChild(x);bt.appendChild(bl)}
   pane.appendChild(bt)}
  const pz=pzSection(c);pz.open=true;UI.pzOpen=true;pane.appendChild(pz)}
 if(tab==='subs')subGenPane(c,pane)}

/* ============================================================ correzione colore */
// scheda Colore della clip video: look pronti o salvati, luce (esposizione, contrasto, luci, ombre), colore (temperatura, tinta,
// saturazione, vividezza), confronto prima/dopo sull'anteprima. Le modifiche valgono per tutte le clip video selezionate.
function colorSec(c,re){const w=el('div','sub'),col=c.color||(c.color={...GRADE0,on:!!c.adj});if(c.adj)col.on=true;
 const sync=()=>{selTargets(c).forEach(x=>{if(x!==c&&x.kind==='video'&&!!x.adj===!!c.adj)x.color=JSON.parse(JSON.stringify(c.color))});dirty=true;histMark()},rb=()=>{sync();buildClipProps();re()};
 const on={v:!!col.on};if(!c.adj)w.appendChild(field(bool('v','Correzione colore',false),on,()=>{col.on=on.v;rb()}));
 if(!col.on){w.appendChild(el('div','note','Esposizione, contrasto, luci e ombre, bilanciamento del bianco, saturazione. Si vede in anteprima e nel video esportato. Con più clip selezionate vale per tutte.'));return w}
 const grp=t=>{const g=el('div','fxg');g.appendChild(el('div','sublab',t));w.appendChild(g);return g};
 // look
 const lk=grp('Look'),saved=getUI('colorLooks',[]),lo={v:''};
 lk.appendChild(field(sel('v','Look',[['','Scegli un look…'],...LOOKS.map(l=>['p:'+l.id,l.n]),...saved.map((x,k)=>['u:'+k,'★ '+x.n])],''),lo,()=>{if(!lo.v)return;const g=lo.v.startsWith('p:')?(LOOKS.find(l=>'p:'+l.id===lo.v)||{}).g:(saved[+lo.v.slice(2)]||{}).g;Object.assign(col,GRADE0,g||{},{on:true});rb()}));
 const bl=el('div','bline'),bt=(t,tip,fn,cls='')=>{const x=el('button','btn sm '+cls,t);x.type='button';x.title=tip;x.onclick=fn;bl.appendChild(x);return x};
 bt('Salva look…','Salva queste regolazioni per riusarle su altre clip (★ nell\'elenco)',()=>{const n=prompt('Nome del look','Il mio look');if(!n)return;const l=getUI('colorLooks',[]),g={};for(const k in GRADE0)g[k]=col[k]||0;l.push({n:n.trim(),g});setUI('colorLooks',l);buildClipProps();toast('Look salvato: lo trovi nell\'elenco (★)')});
 if(saved.length)bt('Gestisci…','Elimina un look salvato',()=>{const n=prompt('Look salvati:\n'+saved.map((x,k)=>(k+1)+'. '+x.n).join('\n')+'\n\nNumero del look da eliminare','');const k=parseInt(n,10)-1;if(!(k>=0&&k<saved.length))return;const l=getUI('colorLooks',[]);l.splice(k,1);setUI('colorLooks',l);buildClipProps()});
 bt('Azzera','Tutte le regolazioni a zero',()=>{Object.assign(col,GRADE0);rb()});
 const cmp=c.adj?null:bt(UI.colCmp?'Confronto: acceso':'Confronta prima/dopo','Sull\'anteprima: a sinistra della linea il video originale, a destra corretto',()=>{UI.colCmp=!UI.colCmp;dirty=true;buildClipProps()},UI.colCmp?'on':'');lk.appendChild(bl);
 const ch=()=>{sync();re();const t=$('#insp .subtabs button.on');if(t&&/^Colore/.test(t.textContent))t.textContent='Colore'+(hasGrade(c)?' ●':'')};
 const L=grp('Luce');[rng('exp','Esposizione',-3,3,0,.05,'stop'),rng('con','Contrasto',-100,100,0,1),rng('hi','Luci',-100,100,0,1),rng('sh','Ombre',-100,100,0,1)].forEach(x=>L.appendChild(field(x,col,ch)));
 const C=grp('Colore');[rng('temp','Temperatura',-100,100,0,1),rng('tint','Tinta',-100,100,0,1),rng('sat','Saturazione',-100,100,0,1),rng('vib','Vividezza',-100,100,0,1)].forEach(x=>C.appendChild(field(x,col,ch)));
 w.appendChild(el('div','note','Temperatura: verso destra più caldo (arancio), verso sinistra più freddo (blu). Tinta: verso destra più magenta, verso sinistra più verde. Doppio clic sul nome di una regolazione la riporta a zero.'));
 if(!grader().ok)w.appendChild(el('div','note warn','Questo browser non permette la correzione sulla scheda video (WebGL): le regolazioni non si vedono.'));
 return w}

/* ============================================================ stabilizzazione */
// Il movimento di ogni file si analizza una volta (in fila, uno alla volta) e si ricorda nel browser; la correzione si calcola
// per clip (intensità, rotazione, pezzo usato) e si applica al disegno del video, in anteprima e nell'esportazione.
const STB=new Map(),STBC=new Map(),STBQ=[];let STBJ=null;   // STB: id del file → percorso | 'load' | 'none'
const stabKey=id=>{const m=mediaInfo(id);return m?m.name+'|'+(m.size||0)+'|'+(+m.dur||0).toFixed(2):id};
function stabTrack(id){const v=STB.get(id);if(v&&typeof v==='object')return v;
 if(!v){STB.set(id,'load');loadTrack(stabKey(id)).then(tr=>{STB.set(id,tr||'none');if(tr){STBC.clear();dirty=true;stabUI(true)}else if(S.seq.clips.some(c=>c.media===id&&c.stab&&c.stab.on))stabRun(id)})}return null}
function stabEnsure(id){if(STB.get(id)==='none')stabRun(id);else stabTrack(id)}
function stabRun(id){if(STBJ&&STBJ.id===id||STBQ.includes(id))return;STBQ.push(id);stabUI(true);stabNext()}
async function stabNext(){if(STBJ||!STBQ.length)return;const id=STBQ.shift(),f=MED.fileOf(id);if(!f)return stabNext();const job=STBJ={id,p:0,t0:performance.now()};stabUI(true);
 try{const tr=await stabAnalyze(f,MED.urlOf(id),p=>{job.p=p;stabUI()},()=>job.stop);if(tr&&tr.t.length>2){STB.set(id,tr);saveTrack(stabKey(id),tr);STBC.clear();dirty=true;toast('Stabilizzazione pronta: '+(mediaInfo(id)?.name||''))}else if(!job.stop){STB.set(id,'none');toast('Non riesco a leggere i fotogrammi di questo video')}}
 catch(e){STB.set(id,'none');toast('Analisi non riuscita: '+(e&&e.message||e))}finally{STBJ=null;stabUI(true);stabNext()}}
/** Correzione della clip all'istante t del file (null se non c'è ancora l'analisi). */
function stabAt(c,t){const r=stabInfo(c);return r?corrAt(r.tr,r,t):null}
function stabInfo(c){if(!c.stab||!c.stab.on||!c.media)return null;const tr=stabTrack(c.media);if(!tr)return null;const sp=spd(c),a=c.stab.amount||'media',rot=!!c.stab.rot,k=[c.media,c.inp.toFixed(3),(c.dur*sp).toFixed(3),a,rot].join('|');
 let r=STBC.get(k);if(!r){if(STBC.size>200)STBC.clear();r=stabCorrections(tr,a,c.inp,c.inp+c.dur*sp,rot);r.tr=tr;STBC.set(k,r)}return r}
function stabUI(rebuild){const e=UI.stabProg;if(e&&e.isConnected&&!rebuild&&STBJ){const j=STBJ;e.querySelector('span').textContent=j?`Analizzo il movimento: ${Math.round(j.p*100)}%`:'';e.querySelector('i').style.width=Math.round((j?j.p:0)*100)+'%';return}
 if(UI.clipSec&&getUI('clipTab','gen')==='stab'&&UI.selClip)buildClipProps()}
function stabSec(c,re){const w=el('div','sub'),o={on:!!(c.stab&&c.stab.on)},hasF=MED.hasFile(c.media);
 const set=v=>{selTargets(c).forEach(x=>{if(x.kind==='video'&&x.media){x.stab={amount:'media',rot:false,...(x.stab||{}),...v}}});seqCommit();buildClipProps();re()};
 w.appendChild(field(bool('on','Stabilizza',false),o,()=>{set({on:o.on});if(o.on)stabEnsure(c.media)}));
 if(!c.stab||!c.stab.on){w.appendChild(el('div','note','Toglie il tremolio delle riprese a mano e tiene i movimenti voluti (panoramiche, carrellate). Per non mostrare i bordi il video si ingrandisce un po\': il ritaglio dipende da quanto trema. La prima volta MOTO analizza il movimento del file (qualche secondo), poi se lo ricorda.'));return w}
 if(!hasF){w.appendChild(el('div','note warn','File non leggibile: riattiva l\'accesso o ricollega la cartella per analizzarlo.'));return w}
 const st=c.stab;w.appendChild(segRow('Intensità',[['leggera','Leggera'],['media','Media'],['forte','Forte'],['ferma','Camera ferma']],st,'amount',()=>set({amount:st.amount})));
 {const rr=field(bool('rot','Correggi anche la rotazione',false),st,()=>set({rot:st.rot}));rr.title='Solo per riprese che ruotano parecchio (camminando, di corsa): su riprese normali la rotazione è minima e correggerla aggiunge tremolio';w.appendChild(rr)}
 const pr=el('div','subprog','<span></span><b><i></i></b>');UI.stabProg=pr;w.appendChild(pr);
 const busy=STBJ&&STBJ.id===c.media||STBQ.includes(c.media),r=stabInfo(c);pr.hidden=!busy;if(busy){const p=STBJ&&STBJ.id===c.media?STBJ.p:0;pr.querySelector('span').textContent=STBJ&&STBJ.id===c.media?`Analizzo il movimento: ${Math.round(p*100)}%`:'In attesa dell\'analisi…';pr.querySelector('i').style.width=Math.round(p*100)+'%'}else stabTrack(c.media);
 if(r){const n=r.c.length,X=r.tr.x.slice(r.i0,r.i0+n),Y=r.tr.y.slice(r.i0,r.i0+n),b0=stabShake(X)+stabShake(Y),b1=stabShake(X.map((x,i)=>x+r.c[i].tx))+stabShake(Y.map((y,i)=>y+r.c[i].ty));
  w.appendChild(el('div','note',`Ritaglio: <b>${(r.crop*100).toFixed(1)}%</b>${b0>1e-6?` · tremolio tolto: <b>${Math.round(Math.max(0,1-b1/b0)*100)}%</b>`:''}`+(r.zoom>=1.499?'<br>Trema molto: la correzione è stata ridotta per non ingrandire troppo.':'')));
  const bl=el('div','bline'),ra=el('button','btn sm','Rianalizza');ra.type='button';ra.title='Rifà l\'analisi del movimento di questo file';ra.onclick=()=>{STB.set(c.media,'none');STBC.clear();stabRun(c.media);buildClipProps()};bl.appendChild(ra);w.appendChild(bl)}
 else if(!busy&&STB.get(c.media)==='none'){const bl=el('div','bline'),go=el('button','btn sm pri','Analizza il movimento');go.type='button';go.onclick=()=>{stabRun(c.media);buildClipProps()};bl.appendChild(go);w.appendChild(bl)}
 w.appendChild(el('div','note','Leggera tiene di più il movimento della mano, Forte lo ammorbidisce molto, Camera ferma fa sembrare la ripresa su un cavalletto (con più ritaglio).'));
 return w}

/* ============================================================ sottotitoli */
// S.seq.subs = { words, style, on }: le parole stanno nel tempo dei file (seguono tagli e spostamenti), le frasi si ricavano ogni volta
// dalle parole e dallo stile (caratteri per riga, righe, divisioni fatte a mano).
const subsOf=()=>S.seq&&S.seq.subs||null;
const subStyle=()=>{const sb=subsOf();if(!sb)return styleOf(null);if(!sb.style||!sb.style.y)sb.style=styleOf(sb.style);return sb.style};
function cuesNow(){const sb=subsOf();if(!sb||!sb.words||!sb.words.length)return[];const st=subStyle();return groupCues(sb.words,{maxChars:st.mode==='parola'?14:st.maxChars,lines:st.mode==='parola'?1:st.lines})}
const subFam=st=>(FONTS.find(f=>f.n===st.font&&!f.removed)||FONTS[0]).css;
function drawSubsAt(cx,T,W,H){const sb=subsOf();if(!sb||sb.on===false||!sb.words||!sb.words.length)return;const at=subAt(S.seq,cuesNow(),T);if(!at)return;const st=subStyle();drawSubs(cx,W,H,at,st,subFam(st),S.fmt)}
const cueText=q=>q.w.map(w=>w.t).join(' ');
function selCue(){const id=UI.selSub;return id?cuesNow().find(q=>q.id===id)||null:null}
function subSegOf(id){return cueSegments(S.seq,cuesNow()).find(g=>g.cue.id===id)||null}
// selezione: UI.selSub è la frase aperta nel pannello, UI.subSel tutte quelle selezionate (⌘ clic, ⇧ clic, riquadro, ⌘A)
const subSelIds=()=>{const ok=new Set(cuesNow().map(q=>q.id)),s=UI.subSel||(UI.subSel=new Set());for(const i of[...s])if(!ok.has(i))s.delete(i);if(UI.selSub&&ok.has(UI.selSub))s.add(UI.selSub);return s};
function selectSub(id,seek=true,mode='only'){const set=UI.subSel||(UI.subSel=new Set());
 if(!id)set.clear();
 else if(mode==='toggle'){if(set.has(id)){set.delete(id);if(UI.selSub===id)UI.selSub=[...set].at(-1)||null;id=UI.selSub}else{set.add(id);UI.selSub=id}seek=false;if(!id){buildSubSecs();applyCtx(true);STL&&STL.render();return}}
 else if(mode==='range'){const cs=cuesNow(),b=cs.findIndex(q=>q.id===id);let a=cs.findIndex(q=>q.id===UI.selSub);if(a<0){set.clear();a=b}for(let i=Math.min(a,b);i<=Math.max(a,b);i++)set.add(cs[i].id);seek=false}
 else{set.clear();set.add(id)}
 UI.selSub=id||null;if(id){selSet().clear();UI.selClip=null;UI.area='tl';UI.subSub=UI.subSub||'testo';const g=subSegOf(id);if(seek&&g&&!playing&&(TG()<g.start-1e-6||TG()>=g.end))seekTG(g.start+1e-3)}
 buildSubSecs();if(id)reveal({testo:UI.subSec,stile:UI.subStSec,anim:UI.subAnSec}[UI.subSub]||UI.subSec);else applyCtx(true);STL&&STL.render();dirty=true}
function selectSubsMany(ids,add){const set=UI.subSel||(UI.subSel=new Set());if(!add)set.clear();ids.forEach(i=>set.add(i));const last=ids.at(-1)||[...set].at(-1)||null;if(last&&UI.selSub!==last){UI.selSub=last;selSet().clear();UI.selClip=null;UI.area='tl'}if(!set.size)UI.selSub=null;buildSubSecs();if(UI.selSub)reveal({testo:UI.subSec,stile:UI.subStSec,anim:UI.subAnSec}[UI.subSub]||UI.subSec);else applyCtx(true)}
function subSelectAll(){const cs=cuesNow();if(!cs.length)return;UI.subSel=new Set(cs.map(q=>q.id));if(!UI.selSub||!UI.subSel.has(UI.selSub))UI.selSub=cs[0].id;selSet().clear();UI.selClip=null;UI.area='tl';buildSubSecs();reveal({testo:UI.subSec,stile:UI.subStSec,anim:UI.subAnSec}[UI.subSub]||UI.subSec);STL&&STL.render();toast(cs.length+' sottotitoli selezionati')}
function subChanged(rebuild=true){histMark();STL&&STL.render();if(rebuild)buildSubSecs();dirty=true;buildSeqBar()}
// corsia della timeline: le frasi si spostano e si rifilano; i tempi cambiano nel file (dividendo per la velocità della clip)
let SUBD=null;
const subLane=()=>({segs:()=>{if(!subsOf())return[];return cueSegments(S.seq,cuesNow()).map(g=>({id:g.cue.id,key:g.cue.id+'|'+g.clip.id,start:g.start,end:g.end,text:cueText(g.cue),k:spd(g.clip)}))},
 isSel:id=>subSelIds().has(id),select:(id,mode)=>selectSub(id,true,mode||'only'),selectMany:selectSubsMany,
 drag:(id,mode,dt,ph)=>{const sb=subsOf();if(!sb)return;
  if(ph==='start'){const g=subSegOf(id),sel=subSelIds();SUBD={words:JSON.parse(JSON.stringify(sb.words)),k:g?spd(g.clip):1,ids:sel.has(id)?new Set(sel):new Set([id])};return}
  if(!SUBD)return;if(ph==='end'){SUBD=null;subChanged();return}
  sb.words=JSON.parse(JSON.stringify(SUBD.words));const cues=cuesNow(),q=cues.find(x=>x.id===id);if(!q)return;const d=dt*SUBD.k;
  if(mode==='move')shiftCues(cues,SUBD.ids,d);else trimCue(cues,id,mode,(mode==='l'?q.w[0].s:q.w[q.w.length-1].e)+d)},
 edit:id=>{selectSub(id);UI.subSub='testo';applyCtx(true);setTimeout(()=>{UI.subTa&&UI.subTa.focus();UI.subTa&&UI.subTa.select()},50)}});
function subRemoveSel(){const q=selCue(),sb=subsOf();if(!q||!sb)return;const cues=cuesNow(),ids=subSelIds(),del=cues.filter(x=>ids.has(x.id)),i=cues.findIndex(x=>ids.has(x.id));for(const c of del)sb.words=removeCue(sb.words,c);
 const nx=cuesNow()[Math.min(i,cuesNow().length-1)];UI.selSub=nx?nx.id:null;UI.subSel=new Set(UI.selSub?[UI.selSub]:[]);subChanged();toast((del.length>1?del.length+' sottotitoli eliminati':'Sottotitolo eliminato')+'. ⌘Z per annullare')}
// pulsante della barra: apre i sottotitoli, o la scheda per crearli sulla clip con la voce
function openSubs(){const q=cuesNow();if(q.length){const T=TG(),g=cueSegments(S.seq,q).find(x=>x.end>T)||cueSegments(S.seq,q)[0];return selectSub(g?g.cue.id:q[0].id,!g||g.start>T||g.end<=T)}
 const cur=UI.selClip&&S.seq.clips.find(c=>c.id===UI.selClip),c=cur&&cur.kind!=='motion'&&cur.media&&roleOf(cur)!=='music'?cur:S.seq.clips.find(x=>x.kind!=='motion'&&x.media&&MED.hasFile(x.media)&&roleOf(x)==='voice')||S.seq.clips.find(x=>x.kind==='video'&&x.media);
 if(!c)return toast('Prima metti sulla timeline il video (o l\'audio) con il parlato');setUI('audTab','subs');selectClip(c.id);showTab('audio');reveal(UI.clipAudSec)}
// creazione: Whisper sul tuo computer (il modello si scarica la prima volta), solo le parti del file usate nella timeline
function subJobText(){const j=UI.subJob;if(!j)return'';const el_=Math.round((performance.now()-j.t0)/1000);
 if(j.stage==='load')return j.total?`Scarico il modello di trascrizione: ${Math.round(j.loaded/1e6)} di ${Math.round(j.total/1e6)} MB (solo la prima volta)`:'Preparo il modello di trascrizione…';
 if(j.stage==='run')return`Trascrivo ${j.sec?Math.round(j.sec)+' s di parlato':''}… ${el_} s`;return'Preparo l\'audio…'}
function subJobUI(){const e=UI.subProg;if(!e||!e.isConnected)return;const j=UI.subJob;e.hidden=!j;if(!j)return;e.querySelector('span').textContent=subJobText();const b=e.querySelector('i');
 const f=j.stage==='load'&&j.total?j.loaded/j.total:j.stage==='run'&&j.sec?Math.min(.97,(performance.now()-j.tr)/1000/(j.sec/1.6+8)):.02;b.style.width=Math.round(f*100)+'%'}
async function genSubs(c){const m=c.media;if(UI.subJob)return toast('Sto già trascrivendo: aspetta che finisca');
 const b=await MED.audioOf(m,SA.ctx());if(!b)return toast('Audio del file non leggibile');
 const sb0=subsOf(),had=sb0&&sb0.words.some(w=>w.m===m);if(had&&!confirm('Rifare i sottotitoli di questo file? Le correzioni fatte a mano andranno perse.'))return;
 const job=UI.subJob={m,stage:'prep',t0:performance.now()},tm=setInterval(subJobUI,400);subJobUI();buildClipAudio();toast('Trascrizione avviata: puoi continuare a lavorare');
 try{const chs=applyChannels([...Array(b.numberOfChannels)].map((_,i)=>b.getChannelData(i)),chMode(c)),x=await to16k(chs[0]===chs[1]?[chs[0]]:chs,b.sampleRate);
  const lang=getUI('subLang','italian'),ws=await transcribe(x,usedRanges(S.seq,m,.5,b.duration),lang==='auto'?null:lang,p=>{if(p.stage==='run'&&job.stage!=='run')job.tr=performance.now();Object.assign(job,p);subJobUI()});
  if(!ws.length){toast('Non ho trovato parlato in questo file');return}
  const sb=S.seq.subs||(S.seq.subs={words:[],style:styleOf(null),on:true});sb.on=true;
  sb.words=sb.words.filter(w=>w.m!==m).concat(ws.map(w=>({id:uid('w'),m,t:w.t,s:w.s,e:w.e})));
  UI.subJob=null;clearInterval(tm);subChanged(false);const q=cuesNow().find(x=>x.m===m);if(q){UI.subSub='testo';selectSub(q.id)}toast(`Sottotitoli pronti: ${ws.length} parole. Controlla il testo e scegli lo stile`)}
 catch(e){const msg=String(e&&e.message||e);toast(msg==='nogpu'?'Per trascrivere serve un browser con WebGPU (Chrome o Arc aggiornati)':'Trascrizione non riuscita: '+msg)}
 finally{if(UI.subJob===job)UI.subJob=null;clearInterval(tm);subJobUI();if(UI.clipAudSec)buildClipAudio()}}
function subGenPane(c,pane){const sb=subsOf(),n=sb?sb.words.filter(w=>w.m===c.media).length:0,g=el('div','fxg');pane.appendChild(g);g.appendChild(el('div','sublab','Sottotitoli dal parlato'));
 g.appendChild(el('div','note',n?`Questo file ha <b>${n} parole</b> trascritte. Si correggono nella corsia Sottotitoli in cima alla timeline.`:'Trascrive il parlato delle parti di questo file che usi nella timeline. Tutto avviene sul tuo computer; la prima volta si scarica il modello (circa 560 MB, poi resta nel browser).'));
 const lo={v:getUI('subLang','italian')};g.appendChild(field(sel('v','Lingua',[['italian','Italiano'],['english','Inglese'],['spanish','Spagnolo'],['french','Francese'],['german','Tedesco'],['auto','Riconosci da sola']],'italian'),lo,()=>setUI('subLang',lo.v)));
 const pr=el('div','subprog','<span></span><b><i></i></b>');UI.subProg=pr;g.appendChild(pr);
 const bl=el('div','bline'),go=el('button','btn sm pri',UI.subJob?'Trascrizione in corso…':n?'Rifai i sottotitoli':'Crea i sottotitoli');go.type='button';go.disabled=!!UI.subJob;go.onclick=()=>genSubs(c);bl.appendChild(go);
 if(n){const ed=el('button','btn sm','Correggi e stile');ed.type='button';ed.onclick=openSubs;bl.appendChild(ed);const x=el('button','btn sm','Togli');x.type='button';x.title='Toglie i sottotitoli di questo file';x.onclick=()=>{if(!confirm('Togliere i sottotitoli di questo file?'))return;sb.words=sb.words.filter(w=>w.m!==c.media);UI.selSub=null;subChanged();buildClipAudio()};bl.appendChild(x)}
 g.appendChild(bl);subJobUI()}
// pannelli: Testo (frase selezionata e tutte le frasi), Stile, Comparsa
function buildSubSecs(){if(!UI.subSec)return;buildSubText();buildSubStyle();buildSubAnim();if(curCtx()==='sub')applyCtx(true)}
function buildSubText(){const{b,s}=UI.subSec;b.innerHTML='';UI.subTa=null;const sb=subsOf(),cues=cuesNow(),q=selCue();s.innerHTML='Sottotitolo';if(!sb||!q)return;
 const ids=subSelIds();if(ids.size>1)return buildSubMulti(b,cues,ids);
 const i=cues.indexOf(q),g=subSegOf(q.id);
 const top=el('div','fxg');b.appendChild(top);top.appendChild(el('div','sublab',`Frase ${i+1} di ${cues.length}`+(g?` · ${g.start.toFixed(2)}–${g.end.toFixed(2)} s`:'')));
 const ta=el('textarea','ta subta');ta.value=cueText(q);ta.rows=2;ta.placeholder='Testo del sottotitolo';UI.subTa=ta;
 ta.oninput=()=>{const sb2=subsOf(),q2=selCue();if(!sb2||!q2)return;if(!ta.value.trim())return;sb2.words=retext(sb2.words,q2,ta.value,()=>uid('w'));histMark();STL&&STL.render();dirty=true;subListSync()};
 ta.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();ta.blur()}};ta.onchange=()=>setTimeout(()=>{if(document.activeElement!==UI.subTa)buildSubText()},200);top.appendChild(ta);
 // parole: clic = la testina va lì; i pulsanti dividono e uniscono
 const chips=el('div','subwords');q.w.forEach((w,k)=>{const x=el('button','subw',w.t.replace(/</g,'&lt;'));x.type='button';x.title=`${w.s.toFixed(2)}–${w.e.toFixed(2)} s nel file · clic: la testina va qui${k?' · ⌥ clic: la frase si divide qui':''}`;
  x.onclick=e=>{if(e.altKey&&k){splitBefore(subsOf().words,w.id);UI.selSub=q.id;subChanged();return}const gg=subSegOf(q.id);if(gg)seekTG(gg.start+(Math.max(w.s,q.s)-Math.max(q.s,gg.clip.inp))/spd(gg.clip)+1e-3)};chips.appendChild(x)});top.appendChild(chips);
 const bl=el('div','bline'),bt=(t,tip,fn)=>{const x=el('button','btn sm',t);x.type='button';x.title=tip;x.onclick=fn;bl.appendChild(x);return x};
 bt('‹','Frase precedente',()=>cues[i-1]&&selectSub(cues[i-1].id));bt('›','Frase successiva',()=>cues[i+1]&&selectSub(cues[i+1].id));
 bt('Dividi alla testina','La frase si divide alla parola sotto la testina (anche: ⌥ clic su una parola)',()=>{const at=subAt(S.seq,cuesNow(),TG());if(!at||at.cue.id!==q.id||at.word<1)return toast('Porta la testina su una parola della frase (non la prima)');splitBefore(subsOf().words,q.w[at.word].id);subChanged()});
 const mg=bt('Unisci alla successiva','La frase dopo si unisce a questa',()=>{if(mergeNext(subsOf().words,cuesNow(),q.id))subChanged();else toast('Non c\'è una frase dopo da unire')});mg.disabled=!cues[i+1]||cues[i+1].m!==q.m;
 bt('Elimina','Elimina questa frase · ⌫',subRemoveSel);bt('Seleziona tutti','Seleziona tutti i sottotitoli (per eliminarli o spostarli insieme) · ⌘A',subSelectAll);top.appendChild(bl);
 subListUI(b,cues,q,sb)}
function buildSubMulti(b,cues,ids){const top=el('div','fxg');b.appendChild(top);const sel=cues.filter(q=>ids.has(q.id)),segs=sel.map(q=>subSegOf(q.id)).filter(Boolean);
 top.appendChild(el('div','sublab',`${sel.length} sottotitoli selezionati`+(segs.length?` · ${fmtS(Math.min(...segs.map(g=>g.start)))}–${fmtS(Math.max(...segs.map(g=>g.end)))}`:'')));
 top.appendChild(el('div','note','Trascinali nella corsia Sottotitoli per spostarli insieme. ⌘ clic aggiunge o toglie una frase, ⇧ clic seleziona fino a lì, ⌘A li seleziona tutti, Esc deseleziona.'));
 const bl=el('div','bline'),bt=(t,tip,fn)=>{const x=el('button','btn sm',t);x.type='button';x.title=tip;x.onclick=fn;bl.appendChild(x);return x};
 bt('Elimina ('+sel.length+')','Elimina i sottotitoli selezionati · ⌫',subRemoveSel);
 const mg=bt('Unisci in una frase','Le frasi selezionate (una dopo l\'altra) diventano una sola',()=>{if(mergeCues(subsOf().words,cuesNow(),ids)){UI.subSel=new Set([sel[0].id]);UI.selSub=sel[0].id;subChanged()}});mg.disabled=!mergeCues(JSON.parse(JSON.stringify(subsOf().words)),JSON.parse(JSON.stringify(cues)),ids);
 if(sel.length<cues.length)bt('Seleziona tutti','· ⌘A',subSelectAll);bt('Deseleziona','· Esc',()=>selectSub(null));top.appendChild(bl);
 subListUI(b,cues,selCue(),subsOf())}
function subListUI(b,cues,q,sb){const ids=subSelIds();
 // tutte le frasi, da correggere come un testo (clic sull'ora: ⌘ aggiunge, ⇧ fino a lì)
 const all=el('div','fxg');b.appendChild(all);all.appendChild(el('div','sublab','Tutte le frasi'));const list=el('div','sublist');all.appendChild(list);UI.subList=list;
 cues.forEach(c=>{const r=el('div','subrow'+(ids.has(c.id)?' on':''));r.dataset.id=c.id;const gg=subSegOf(c.id),tm=el('button','subt',gg?fmtS(gg.start):'—');tm.type='button';tm.title='Vai a questa frase';tm.onclick=e=>selectSub(c.id,true,e.metaKey?'toggle':e.shiftKey?'range':'only');
  const inp=el('input','in');inp.value=cueText(c);inp.onchange=()=>{const sb2=subsOf(),c2=cuesNow().find(x=>x.id===c.id);if(!sb2||!c2||!inp.value.trim())return;sb2.words=retext(sb2.words,c2,inp.value,()=>uid('w'));subChanged()};inp.onfocus=()=>{if(subSelIds().size>1)return;UI.selSub=c.id;UI.subSel=new Set([c.id]);list.querySelectorAll('.subrow').forEach(x=>x.classList.toggle('on',x.dataset.id===c.id));STL&&STL.render();const g2=subSegOf(c.id);if(g2&&!playing)seekTG(g2.start+1e-3)};
  r.append(tm,inp);list.appendChild(r)});
 const ex=el('div','bline'),srt=el('button','btn sm','Esporta .srt');srt.type='button';srt.title='File di sottotitoli con i tempi della timeline (per YouTube, Premiere…)';srt.onclick=()=>{const st=subStyle();saveBlob((PROJ.name||'sottotitoli')+'.srt',new Blob([toSrt(S.seq,cuesNow(),st.lines,st.maxChars)],{type:'text/plain'}))};ex.appendChild(srt);
 const on=el('button','btn sm'+(sb.on===false?'':' on'),sb.on===false?'Mostra sul video':'Nascondi dal video');on.type='button';on.onclick=()=>{sb.on=sb.on===false;subChanged()};ex.appendChild(on);all.appendChild(ex);
 requestAnimationFrame(()=>{const r=list.querySelector('.subrow.on');if(r)r.scrollIntoView({block:'nearest'})})}
const fmtS=t=>`${Math.floor(t/60)}:${(t%60).toFixed(1).padStart(4,'0')}`;
function subListSync(){const q=selCue(),l=UI.subList;if(!q||!l)return;const r=l.querySelector(`.subrow[data-id="${q.id}"] input`);if(r&&document.activeElement!==r)r.value=cueText(q)}
const SUB_MODES=[['karaoke','Parola evidenziata'],['frase','Frase intera'],['accumula','Si aggiungono'],['parola','Una alla volta']];
function buildSubStyle(){const{b}=UI.subStSec;b.innerHTML='';const sb=subsOf();if(!sb)return;const st=subStyle(),re=()=>{histMark();STL&&STL.render();dirty=true},rb=()=>{re();buildSubStyle()};
 const grp=t=>{const g=el('div','fxg');g.appendChild(el('div','sublab',t));b.appendChild(g);return g};
 // stili pronti e salvati
 const ps=grp('Stili'),saved=getUI('subStyles',[]),po={v:''};
 const opts=[['','Scegli uno stile…'],...SUB_PRESETS.map(p=>['p:'+p.id,p.n]),...saved.map((x,k)=>['u:'+k,'★ '+x.n])];
 ps.appendChild(field(sel('v','Stile',opts,''),po,()=>{const v=po.v;if(!v)return;let src=null;if(v.startsWith('p:'))src={...(SUB_PRESETS.find(p=>'p:'+p.id===v)||{}).s};else src=JSON.parse(JSON.stringify((saved[+v.slice(2)]||{}).s||{}));
  const keepY={...st.y};sb.style=styleOf(src);if(v.startsWith('p:'))sb.style.y=keepY;rb();toast('Stile applicato')}));
 const sl=el('div','bline'),sv=el('button','btn sm','Salva questo stile…');sv.type='button';sv.onclick=()=>{const n=prompt('Nome dello stile','Il mio stile');if(!n)return;const l=getUI('subStyles',[]);l.push({n:n.trim(),s:JSON.parse(JSON.stringify(st))});setUI('subStyles',l);buildSubStyle();toast('Stile salvato: lo trovi tra gli stili (★)')};sl.appendChild(sv);
 if(saved.length){const dl=el('button','btn sm','Gestisci…');dl.type='button';dl.title='Elimina uno stile salvato';dl.onclick=()=>{const n=prompt('Stili salvati:\n'+saved.map((x,k)=>(k+1)+'. '+x.n).join('\n')+'\n\nNumero dello stile da eliminare','');const k=parseInt(n,10)-1;if(!(k>=0&&k<saved.length))return;const l=getUI('subStyles',[]);l.splice(k,1);setUI('subStyles',l);buildSubStyle()};sl.appendChild(dl)}ps.appendChild(sl);
 const m=grp('Come compaiono');m.appendChild(segRow('Parole',SUB_MODES,st,'mode',rb));
 if(st.mode!=='parola'){m.appendChild(segRow('Righe',[[1,'Una'],[2,'Due']],st,'lines',re));m.appendChild(field(rng('maxChars','Caratteri per riga',8,48,22,1),st,re))}
 const t=grp('Carattere');const fo=el('div','row w2');fo.appendChild(el('label',null,'Font'));const fs=el('select');FONTS.filter(f=>!f.removed).forEach(f=>{const o=el('option',null,f.n);o.value=f.n;fs.appendChild(o)});fs.value=st.font;fs.onchange=()=>{st.font=fs.value;loadFonts().then(()=>{dirty=true});re()};fo.appendChild(fs);t.appendChild(fo);
 [rng('wght','Peso',100,900,800,50),rng('size','Dimensione',2,14,5.6,.1,'%')].forEach(x=>t.appendChild(field(x,st,re)));t.appendChild(field(bool('upper','Tutto maiuscolo',false),st,re));
 const c=grp('Colori');c.appendChild(field(col('color','Testo','#ffffff'),st,re));
 if(st.mode!=='frase'){c.appendChild(field(sel('hlMode','Parola detta',[['colore','Colorata'],['box','Su un riquadro'],['nessuna','Come le altre']],'colore'),st,rb));
  if(st.hlMode!=='nessuna'){c.appendChild(field(col('hl',st.hlMode==='box'?'Riquadro':'Colore','#ffd400'),st,re));if(st.hlMode==='box')c.appendChild(field(col('hlText','Testo sul riquadro','#111111'),st,re));c.appendChild(field(rng('hlScale','Ingrandita',1,1.5,1,.01,'×'),st,re))}}
 const o=grp('Contorno e ombra');[rng('stroke','Contorno',0,.3,.1,.01),].forEach(x=>o.appendChild(field(x,st,re)));o.appendChild(field(col('strokeCol','Colore del contorno','#000000'),st,re));o.appendChild(field(rng('shadow','Ombra',0,1,.6,.01),st,re));
 const bx=grp('Riquadro dietro');bx.appendChild(segRow('Riquadro',[['no','No'],['riga','Per riga'],['frase','Unico']],st,'box',rb));if(st.box!=='no'){bx.appendChild(field(col('boxCol','Colore','#000000'),st,re));bx.appendChild(field(rng('boxOp','Opacità',0,1,.65,.01),st,re))}
 const p=grp('Posizione ('+S.fmt+')'),yo={get y(){return yFor(st,S.fmt)},set y(v){st.y[S.fmt]=v}};p.appendChild(field(rng('y','Altezza',5,95,yFor(st,S.fmt),.5,'%'),yo,re));p.appendChild(field(rng('width','Larghezza massima',30,100,84,1,'%'),st,re));
 p.appendChild(el('div','note','L\'altezza vale per questo formato: negli altri formati si regola a parte. Nei reel conviene stare sopra il 75% (sotto ci sono didascalia e pulsanti di Instagram).'))}
function buildSubAnim(){const{b}=UI.subAnSec;b.innerHTML='';const sb=subsOf();if(!sb)return;const st=subStyle(),re=()=>{histMark();STL&&STL.render();dirty=true};
 const g=el('div','fxg');b.appendChild(g);g.appendChild(el('div','sublab','Comparsa'));
 g.appendChild(field(sel('anim','Animazione',[['pop','Pop (rimbalzo)'],['sale','Sale dal basso'],['scala','Si ingrandisce'],['dissolvenza','Dissolvenza'],['nessuna','Nessuna']],'pop'),st,re));
 g.appendChild(field(rng('animDur','Durata',.04,.6,.16,.01,'s'),st,re));
 g.appendChild(el('div','note',st.mode==='frase'||st.mode==='karaoke'?'La frase compare tutta insieme con questa animazione.':'Ogni parola compare con questa animazione quando viene detta.'))}

function initSeqUI(){$('#seqhost').addEventListener('pointerdown',()=>{UI.area='tl'},true);STL=initTimeline({host:$('#seqhost'),seq:()=>S.seq,total:seqTot,T:TG,setT:T=>seekTG(T),fps:()=>S.fps,isSelected:id=>selSet().has(id),selection:()=>[...selSet()],select:(id,mode)=>selectClip(id,mode),selectMany,tool:()=>UI.tool||'select',razor:razorAt,activeMotion:()=>S.seq.act,
 label:c=>c.name||(c.kind==='motion'?'Grafica':'Clip'),peaks:(c,n)=>c.media?MED.peaksOf(c.media,n):null,srcDur:c=>c.kind==='motion'||c.adj?Infinity:(mediaInfo(c.media)?.dur||c.inp+c.dur),
 newMotion:(tr,T)=>newMotionClip(tr,T),commit:seqCommit,live:()=>{dirty=true},snapOn:()=>getUI('seqSnap',true),selMarker:()=>UI.selMk||null,selectMarker:id=>{UI.selMk=id},
 renameMarker:id=>{const m=S.seq.markers.find(x=>x.id===id);if(!m)return;const v=prompt('Nome del marker',m.label||'');if(v!=null){m.label=v.trim();seqCommit()}},
 removeTrack:id=>{if(removeTrack(S.seq,id))seqCommit()},canRemove:id=>!S.seq.clips.some(c=>c.track===id)&&tracksOf(S.seq).filter(t=>t.kind===kindOfTrack(id)).length>1,
 dupNow,dupEnd,dropFiles:async(dt,track,T)=>{const files=[...dt.files];if(await dropMedia(dt,{track,T}))return;dropGraphics(files,track,T)},grip:$('#gTl'),subs:subLane(),pauses:c=>{if(!UI.pzOpen||!c.media)return null;const cur=S.seq.clips.find(x=>x.id===UI.selClip);return cur&&pzTargets(cur).includes(c)?(pzPlan(c)?.pz||null):null}});
 MED.onMediaChange(()=>{syncBeats();STL&&STL.render();buildSeqBar();if(UI.clipSec)buildClipSec();measureMix();dirty=true});buildSeqBar();measureMix()}
// file trascinati dal Finder (sulla finestra o su una traccia): si tengono gli handle per riaprirli nelle sessioni successive
async function dropMedia(dt,at){const all=[...dt.files],items=[...dt.items].filter(i=>i.kind==='file'),med=all.map((f,i)=>({f,i})).filter(x=>MED.isMediaName(x.f.name));if(!med.length)return false;
 const hs=await Promise.all(items.map(i=>i.getAsFileSystemHandle?i.getAsFileSystemHandle().catch(()=>null):null));await addFiles(med.map(x=>({file:x.f,handle:hs[x.i]||null})),at);return true}
// SVG e immagini trascinati sulla timeline: su una clip di grafica si aggiungono a quella, nel vuoto diventano una clip di grafica nuova
async function dropGraphics(files,track,T){const sv=files.filter(f=>/\.svg$/i.test(f.name)||f.type==='image/svg+xml'),im=files.filter(f=>/^image\//.test(f.type)&&!sv.includes(f));
 if(!sv.length&&!im.length)return toast('Sulla timeline vanno video, audio, SVG e immagini');
 const tr=kindOfTrack(track)==='motion'?track:firstTrack(S.seq,'motion'),on=S.seq.clips.find(c=>c.kind==='motion'&&c.track===tr&&isActive(c,T));
 if(on)selectClip(on.id);
 else{const c={id:uid('c'),kind:'motion',track:tr,name:(sv[0]||im[0]).name.replace(/\.[^.]+$/,''),start:0,dur:3,inp:0,bg:'auto',auto:true,scene:sceneOf({...defaults(),text:''})};c.start=freeSlot(S.seq,tr,T,c.dur);S.seq.clips.push(c);selectClip(c.id)}
 for(const f of sv)addSvg(await f.text(),f.name.replace(/\.svg$/i,''));
 if(im.length){const before=new Set(S.images.map(r=>r.id));await addImages(im);S.images.filter(r=>!before.has(r.id)).forEach(r=>S.layers.push(mkLayer(r.id)));buildImages();onR()}
 seqCommit();toast(on?'Aggiunto alla clip di grafica «'+on.name+'»':'Nuova clip di grafica con '+(sv.length?'l\'SVG':'l\'immagine')+': animazione in Grafica')}
async function restoreMedia(){const ids=(S.media||[]).map(m=>m.id);if(!ids.length){UI.needGrant=false;buildSeqBar();return}const r=await MED.restore(ids);UI.needGrant=r.needsGrant;loadAudio();buildSeqBar();STL&&STL.render();dirty=true}

/* ============================================================ colonna Livelli */
// tutto quello che c'è nella clip di grafica aperta: camera, testi, SVG (con i livelli del file), immagini.
// In alto ciò che sta davanti. Clic = seleziona (e Proprietà mostra le sue schede); occhio = nascondi; trascina = riordina.
function layerName(L){return L.kind==='svg'?(L.name||'SVG'):((S.images.find(r=>r.id===L.img)||{}).name||'Immagine')}
// SVG con più livelli: chiusi di partenza; si apre da solo quello di cui è selezionato un livello interno
const isOpenLyr=L=>{const o=getUI('lyrOpen',{});if(L.id in o)return!!o[L.id];return UI.selSvg===L.id&&!!UI.svgLyr&&getUI('svgTab','tempi')==='livelli'};
function buildLayersPane(){const p=$('#layersPane');if(!p)return;p.innerHTML='';const ac=actClip();
 const head=el('div','lyrhead'),hc=el('div','lyrclip');hc.innerHTML=ac?'Clip di grafica <b></b>':'Nessuna clip di grafica aperta';if(ac)hc.querySelector('b').textContent=ac.name||'Grafica';head.appendChild(hc);
 const add=el('div','lyradd');const mk=(ic,txt,fn,tip)=>{const x=el('button','btn sm','<i data-lucide="'+ic+'"></i>'+txt);x.type='button';x.title=tip;x.onclick=fn;add.appendChild(x)};
 if(ac){mk('type','Testo',()=>{UI.selSvg=null;UI.area='stage';addBlock(false)},'Nuovo blocco di testo');mk('pen-tool','SVG',()=>UI.svgFile&&UI.svgFile.click(),'Carica un SVG');mk('image','Immagine',()=>{const fi=el('input');fi.type='file';fi.accept='image/*';fi.multiple=true;fi.onchange=async()=>{const before=new Set(S.images.map(r=>r.id));await addImages([...fi.files]);const nw=S.images.filter(r=>!before.has(r.id));nw.forEach(r=>S.layers.push(mkLayer(r.id)));if(nw.length){const L=S.layers[S.layers.length-1];UI.selSvg=L.id;UI.imgOpen=L.id;SEL=true;UI.area='stage';buildImages();onR();histMark()}};fi.click()},'Carica un\'immagine come livello')}
 else mk('plus','Grafica',()=>newMotionClip('G1',TG()),'Nuova clip di grafica alla testina');
 head.appendChild(add);p.appendChild(head);if(!ac){p.appendChild(el('div','note lyrnote','Seleziona una clip di grafica nella timeline, o creane una.'));if(window.lucide)lucide.createIcons();return}
 const cx=curCtx(),list=el('div','lyrlist');p.appendChild(list);
 const row=(o)=>{const r=el('div','lyrrow'+(o.sub?' sub':'')+(o.sel?' sel':'')+(o.off?' off':'')+(o.caret?' hascar':''));r.innerHTML=(o.caret?'<button type="button" class="lyrcar'+(o.caret.open?' open':'')+'" title="'+(o.caret.open?'Chiudi':'Apri')+' i livelli del file"><i data-lucide="chevron-right"></i></button>':'')+(o.icon?'<span class="lic"><i data-lucide="'+o.icon+'"></i></span>':'')+'<span class="ln"></span>'+(o.tag?'<span class="ltag">'+o.tag+'</span>':'');r.querySelector('.ln').textContent=o.name;r.title=o.tip||o.name;r.onclick=o.click;if(o.caret)r.querySelector('.lyrcar').onclick=ev=>{ev.stopPropagation();o.caret.toggle()};
  if(o.eye){const e=el('button','lyreye','<i data-lucide="'+(o.off?'eye-off':'eye')+'"></i>');e.type='button';e.title=o.off?'Mostra':'Nascondi';e.onclick=ev=>{ev.stopPropagation();o.eye()};r.appendChild(e)}
  if(o.dup){const x=el('button','lyreye','<i data-lucide="copy"></i>');x.type='button';x.title='Duplica';x.onclick=ev=>{ev.stopPropagation();o.dup()};r.appendChild(x)}
  if(o.del){const x=el('button','lyreye','<i data-lucide="trash-2"></i>');x.type='button';x.title='Elimina';x.onclick=ev=>{ev.stopPropagation();o.del()};r.appendChild(x)}
  if(o.drag){r.draggable=true;r.addEventListener('dragstart',ev=>{ev.dataTransfer.setData('text/x-moto-layer',o.drag);r.classList.add('drag')});r.addEventListener('dragend',()=>r.classList.remove('drag'));
   r.addEventListener('dragover',ev=>{if([...ev.dataTransfer.types].includes('text/x-moto-layer')){ev.preventDefault();r.classList.add('over')}});r.addEventListener('dragleave',()=>r.classList.remove('over'));
   r.addEventListener('drop',ev=>{r.classList.remove('over');const from=ev.dataTransfer.getData('text/x-moto-layer');if(!from)return;ev.preventDefault();reorderLayer(from,o.drag)})}
  list.appendChild(r)};
 const C=S.cam;row({icon:'video',name:'Camera',off:!(C&&C.on),sel:UI.lyrCam,click:()=>{UI.lyrCam=true;showTab('scena');reveal(UI.camSec);buildLayersPane()},eye:()=>{if(!S.cam)S.cam=newCamera();S.cam.on=!S.cam.on;buildCam&&buildCam();onR();buildLayersPane();histMark()},tip:'Camera: si regola nella scheda Scena'});
 const lay=L=>{const isS=L.kind==='svg',sel=(cx==='svg'||cx==='img')&&UI.selSvg===L.id;
  const nl=isS&&L.mode==='fx'?(()=>{const d=svgDoc(L.src);return d?lyrOf(d).length:0})():0;
  row({icon:isS?'pen-tool':'image',tag:isS?(nl>1?nl+' livelli':'SVG'):'IMG',name:layerName(L),caret:nl>1?{open:isOpenLyr(L),toggle:()=>{const o=getUI('lyrOpen',{});o[L.id]=!isOpenLyr(L);setUI('lyrOpen',o);buildLayersPane()}}:null,sel:sel&&!(isS&&UI.svgLyr&&cx==='svg'&&getUI('svgTab','tempi')==='livelli'),off:!!L.hidden,drag:'L:'+L.id,
   click:()=>{UI.lyrCam=false;UI.selSvg=L.id;SEL=true;UI.area='stage';if(isS){UI.svgOpen=L.id;buildSvg()}else{UI.imgOpen=L.id;buildImages()}showTab('prop');applyCtx(true);HND&&HND.update();buildLayersPane()},
   eye:()=>{L.hidden=!L.hidden;onR();buildLayersPane();histMark()},dup:()=>{const n=dupLayer(L,2);UI.selSvg=n.id;SEL=true;UI.area='stage';buildSvg();buildImages();onR();applyCtx(true);buildLayersPane();histMark();toast('Duplicato')},del:()=>{S.layers.splice(S.layers.indexOf(L),1);if(UI.selSvg===L.id){UI.selSvg=null;SEL=false}buildSvg();buildImages();onR();applyCtx(true);buildLayersPane();histMark();toast((isS?'SVG':'Immagine')+' eliminato. ⌘Z per annullare')}});
  if(isS&&L.mode==='fx'&&isOpenLyr(L)){const d=svgDoc(L.src),LY=d?lyrOf(d):[];if(LY.length>1)LY.forEach(ly=>row({sub:true,name:ly.key,sel:cx==='svg'&&UI.selSvg===L.id&&UI.svgLyr===ly.key&&getUI('svgTab','tempi')==='livelli',
   click:()=>{UI.lyrCam=false;UI.selSvg=L.id;SEL=true;UI.area='stage';UI.svgOpen=L.id;UI.svgLyr=ly.key;setUI('svgTab','livelli');buildSvg();showTab('prop');applyCtx(true);buildLayersPane()},tip:'Livello del file: può avere un\'animazione sua'}))}};
 // davanti: livelli "sopra il testo" (l'ultimo in cima), poi i testi (l'ultimo blocco davanti), poi i livelli sotto
 const ab=S.layers.filter(L=>L.z!=='below').reverse(),be=S.layers.filter(L=>L.z==='below').reverse();ab.forEach(lay);
 const n=nBlocks();for(let i=n-1;i>=0;i--)row({icon:'type',tag:'TESTO',name:blockName(i)||'Testo vuoto',sel:cx==='text'&&S.cur===i,drag:n>1?'B:'+i:null,click:()=>{UI.lyrCam=false;UI.selSvg=null;UI.area='stage';selectBlock(i);SEL=true;showTab('prop');applyCtx(true);HND&&HND.update();buildLayersPane()},
  dup:()=>{if(i!==S.cur)selectBlock(i);addBlock(true);applyCtx(true);buildLayersPane()},del:()=>{if(i!==S.cur)selectBlock(i);delBlock();applyCtx(true);buildLayersPane()},tip:'Blocco di testo '+(i+1)});
 be.forEach(lay);
 p.appendChild(el('div','note lyrnote','Trascina per cambiare l\'ordine: in alto ciò che sta davanti.'));
 if(window.lucide)lucide.createIcons()}
// riordino nella colonna Livelli (dentro lo stesso gruppo: livelli fra loro, blocchi di testo fra loro)
function reorderLayer(from,to){if(from===to)return;const[fk,fv]=from.split(':'),[tk,tv]=to.split(':');
 if(fk==='L'&&tk==='L'){const a=S.layers.findIndex(L=>L.id===fv),b=S.layers.findIndex(L=>L.id===tv);if(a<0||b<0)return;const[L]=S.layers.splice(a,1);L.z=S.layers[b>a?b-1:b]?.z||L.z;S.layers.splice(b,0,L)}
 else if(fk==='B'&&tk==='B'){let a=+fv;const b=+tv;ensureBlocks();S.blocks[S.cur]=pickText(S);const cur=S.blocks[S.cur];const[x]=S.blocks.splice(a,1);S.blocks.splice(b,0,x);S.cur=S.blocks.indexOf(cur);Object.assign(S,S.blocks[S.cur]);buildInspector();relayout()}
 else return toast('Si riordina dentro lo stesso gruppo: testi con testi, SVG e immagini fra loro');
 onR();buildLayersPane();histMark()}
// schede della colonna di sinistra: Livelli o Effetti
function showLeft(k){setUI('leftTab',k);$('#lTabs').querySelectorAll('button').forEach(b=>{const on=b.dataset.l===k;b.classList.toggle('on',on);b.setAttribute('role','tab');b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1});$('#layersPane').hidden=k!=='layers';$('#fxPane').hidden=k!=='fx';if(k==='layers')buildLayersPane()}
$('#lTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)showLeft(b.dataset.l)});
setInterval(()=>{if(UI.ctxBar&&!exporting)syncSel()},250);
// la selezione cambia da tante parti (quadro, timeline, pannelli): Proprietà e Livelli si aggiornano quando cambia
let LYRSIG='';
function syncSel(){applyCtx();const sig=[curCtx(),UI.selSvg,S.cur,S.seq.act,S.layers.map(L=>L.id+(L.hidden?'h':'')+L.z+(L.mode||'')).join(','),nBlocks(),SEL,!!(S.cam&&S.cam.on),UI.svgLyr,getUI('svgTab','tempi')].join('|');if(sig!==LYRSIG){LYRSIG=sig;if(!$('#layersPane').hidden)buildLayersPane()}}
/* ============================================================ library + thumbnails */
let TGT='in';
$('#tgtSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;TGT=b.dataset.t;[...$('#tgtSeg').children].forEach(x=>x.classList.toggle('on',x===b))};
/* libreria effetti: sezioni a fisarmonica (chiuse di default, ricordate), Preferiti e Recenti in cima, stella su ogni effetto */
const LIBSEC=[];let FAVONLY=false,QACTIVE=false;
function libSection(key,title,count){const d=el('div','libsec'),h=el('button','libsec-h'),b=el('div','libsec-b');h.type='button';h.innerHTML=`<span class="car"></span><span class="tt">${title}</span><em>${count}</em>`;
 const set=v=>{d.classList.toggle('open',v);h.setAttribute('aria-expanded',v)};const pk='lib:'+key;set(isOpen(pk,false));
 h.onclick=()=>{const v=!d.classList.contains('open');set(v);if(!QACTIVE)setOpen(pk,v)};d.append(h,b);d._set=set;d._key=pk;d._count=h.querySelector('em');d._body=b;LIBSEC.push(d);return d}
function buildLib(){const lib=$('#lib');lib.innerHTML='';LIBSEC.length=0;hov=null;
 const fav=libSection('fav','Preferiti',0);fav.classList.add('fav','special');lib.appendChild(fav);
 const rec=libSection('rec','Recenti',0);rec.classList.add('special');lib.appendChild(rec);
 CATS.forEach(c=>{const list=FX.filter(f=>f.c===c),s=libSection('c:'+c,c,list.length),g=el('div','tiles');list.forEach(f=>g.appendChild(tile(f,false)));s._body.appendChild(g);lib.appendChild(s)});
 {const mk=(key,name,list)=>{const s=libSection(key,name,list.length),g=el('div','tiles');list.forEach(f=>g.appendChild(tile(f,true)));s._body.appendChild(g);lib.appendChild(s)};
  mk('c:loop','Movimento continuo',LOOPS.slice(1).filter(f=>f.c!=='Tracciato'));mk('c:tpath','Testo su tracciato',LOOPS.filter(f=>f.c==='Tracciato'))}
 fillSpecial();buildThumbs();markTiles();filterLib()}
// Preferiti e Recenti: stessi riquadri, ricostruiti quando cambiano le preferenze
function specialItems(kind){const get=kind==='fav'?favs:recents,lim=kind==='fav'?99:6;
 return [...get('fx').slice(0,lim).map(id=>[FXMAP[id],false]),...get('loop').slice(0,lim).map(id=>[LMAP[id],true])].filter(x=>x[0]&&x[0].id!=='none')}
function fillSpecial(){hov=null;for(const d of LIBSEC){if(!d.classList.contains('special'))continue;const kind=d.classList.contains('fav')?'fav':'rec',items=specialItems(kind);d._body.innerHTML='';
  if(items.length){const g=el('div','tiles');items.forEach(([f,l])=>g.appendChild(tile(f,l)));d._body.appendChild(g)}
  else if(kind==='fav')d._body.appendChild(el('div','note libnote','Nessun preferito. Tocca la stella su un effetto per tenerlo qui in cima.'));
  d._count.textContent=items.length;d.classList.toggle('empty',kind==='rec'&&!items.length)}}
let favT=0;onPrefsChange(()=>{cancelAnimationFrame(favT);favT=requestAnimationFrame(()=>{if(!LIBSEC.length)return;fillSpecial();document.querySelectorAll('#lib .tile .star').forEach(s=>setStar(s,isFav(s.dataset.sc,s.dataset.id)));buildThumbs();markTiles();filterLib()})});
function filterLib(){const q=$('#q').value.trim().toLowerCase();QACTIVE=!!q||FAVONLY;
 document.querySelectorAll('#lib .tile').forEach(b=>{const isL=!!b.dataset.loop,okQ=!q||b.dataset.q.includes(q),okF=!FAVONLY||isFav(isL?'loop':'fx',b.dataset.id);b.style.display=okQ&&okF?'':'none'});
 for(const d of LIBSEC){const vis=[...d._body.querySelectorAll('.tile')].some(x=>x.style.display!=='none');
  if(QACTIVE){const dup=d.classList.contains('special');d.style.display=vis&&!dup?'':'none';d._set(vis&&!dup)}
  else{d.style.display=d.classList.contains('empty')?'none':'';d._set(isOpen(d._key,false))}}}
$('#q').oninput=filterLib;
$('#bFavOnly').onclick=()=>{FAVONLY=!FAVONLY;const b=$('#bFavOnly');b.classList.toggle('on',FAVONLY);b.setAttribute('aria-pressed',FAVONLY);filterLib()};
function tile(f,isLoop){const b=el('div','tile');b.setAttribute('role','button');b.tabIndex=0;b.dataset.id=f.id;b.dataset.loop=isLoop?1:'';b.title=f.d||'';b.dataset.q=(f.n+' '+(f.d||'')).toLowerCase();
 const c=el('canvas');c.width=252;c.height=104;b.append(c,el('span','nm',f.n),el('span','bd'));
 const sc=isLoop?'loop':'fx',st=starButton(isFav(sc,f.id),()=>toggleFav(sc,f.id),'Preferito: '+f.n);st.classList.add('tstar');st.dataset.sc=sc;st.dataset.id=f.id;b.appendChild(st);
 b.onclick=()=>{if(isLoop){setLoop(S.loop.fx===f.id?'none':f.id)}else if(TGT==='in'&&!f.exit)setFx(S.inS,f.id);else{S.outMode='custom';setFx(S.outS,f.id);reveal(UI.outSec);if(TGT==='in')toast('Effetto di uscita: assegnato all\'uscita. Dal menu Entrata puoi usarlo al contrario')}};
 b.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target===b){e.preventDefault();b.onclick()}};
 c.setAttribute('aria-hidden','true');b.setAttribute('aria-label',f.n);b.onpointerenter=()=>startHover(b,f,isLoop);b.onpointerleave=()=>stopHover(b);b.onfocus=()=>startHover(b,f,isLoop);b.onblur=()=>stopHover(b);return b}
function markTiles(){document.querySelectorAll('.tile').forEach(b=>{const id=b.dataset.id,isL=!!b.dataset.loop;const iin=!isL&&S.inS.fx===id,iout=!isL&&S.outMode==='custom'&&S.outS.fx===id,il=isL&&S.loop.fx===id;b.classList.toggle('in',iin||il);b.classList.toggle('out',iout&&!iin);b.querySelector('.bd').innerHTML=(iin?'<i class="i">IN</i>':'')+(iout?'<i class="o">OUT</i>':'')+(il?'<i class="l">LOOP</i>':'')})}
function thumbState(f,isLoop){const r=f.rec||{};const T={...defaults(),text:'Aa',font:0,wght:700,fs:40,fit:false,track:-10,lh:1,color:'#ebe8e3',colorB:'#ff4d00',bg:'#0d0d0d',margin:0,seed:S.seed,fps:30,delay:0,dIn:1,hold:.7,dOut:.8,tail:.3,outMode:'mirror'};
 if(isLoop){T.inS=mkSlot('fade',{split:'char',stagger:0});T.dIn=.01;T.delay=0;T.hold=3;T.outMode='none';T.tail=0;T.loop={fx:f.id,when:'always',prms:{}};const o=prmOf(T.loop,LMAP);if(o.amp!=null&&f.id==='wave')o.amp=.18;if(f.id==='jitter')o.amp=4;if(f.id==='marquee'){T.fs=17;T.inS=mkSlot('fade',{split:'line',stagger:0});o.rows=4;o.angle=-12;o.speed=2}if(f.c==='Tracciato'){T.text='MOTO IN MOTO';T.fs=13;T.track=0;T.wght=600;if(o.speed!=null)o.speed=Math.min(o.speed,.6)}if(f.id==='neon')o.prob=.25;if(f.id==='tglitch')o.prob=.2;if(f.id==='breathe')o.amp=.12;if(f.id==='float')o.amp=.12}
 else if(f.exit){T.inS=mkSlot('fade',{split:'all',stagger:0});T.dIn=.15;T.hold=.35;T.outMode='custom';T.outS=mkSlot(f.id,{split:'char',stagger:Math.min(.5,r.stagger??.3),order:'start'});T.dOut=1.8;T.tail=.4}
 else{T.inS=mkSlot(f.id,{split:r.split==='word'||r.split==='line'?'char':(r.split||'char'),stagger:r.stagger??.4,order:r.order||'start'});if(f.id==='type'||f.id==='scramble'){T.inS.stagger=.9}}
 return T}
const tctxCache=new WeakMap();
function drawThumb(c,f,isLoop,tt){let ctx2=tctxCache.get(c);if(!ctx2){ctx2=c.getContext('2d');tctxCache.set(c,ctx2)}const T=c._T||(c._T=thumbState(f,isLoop));T.seed=S.seed;const W=126,H=52;if(!c._L)c._L=layout(T,ctx2,W,H);renderFrame(ctx2,T,c._L,tt,W,H,2)}
function buildThumbs(){document.querySelectorAll('.tile').forEach(b=>{const c=b.querySelector('canvas');c._L=null;const isL=!!b.dataset.loop,f=isL?LMAP[b.dataset.id]:FXMAP[b.dataset.id];drawThumb(c,f,isL,thumbT(f,isL))})}
let hov=null,hoverFrame=0;
function startHover(b,f,isLoop){cancelAnimationFrame(hoverFrame);if(document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)return;hov={b,f,isLoop,t0:performance.now()};const loop=()=>{if(!hov||hov.b!==b||document.hidden)return;const c=b.querySelector('canvas'),T=c._T,tot=timing(T).total;drawThumb(c,f,isLoop,((performance.now()-hov.t0)/1000)%(isLoop?3:tot));hoverFrame=requestAnimationFrame(loop)};hoverFrame=requestAnimationFrame(loop)}
function stopHover(b){if(hov&&hov.b===b){cancelAnimationFrame(hoverFrame);hoverFrame=0;hov=null;const c=b.querySelector('canvas'),isL=!!b.dataset.loop;const f=isL?LMAP[b.dataset.id]:FXMAP[b.dataset.id];drawThumb(c,f,isL,thumbT(f,isL))}}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&hov)stopHover(hov.b)});
function thumbT(f,isL){return isL?.45:f.exit?1.25:f.id==='land'?.62:.5}

/* ============================================================ top bar */
function buildTop(){const fs=$('#fmtSeg');fs.innerHTML='';Object.keys(FMT).forEach(k=>{const b=el('button',S.fmt===k?'on':'',k);b.type='button';b.title=FMT[k].join('×');b.onclick=()=>{S.fmt=k;[...fs.children].forEach(x=>x.classList.toggle('on',x===b));relayout();fitStage()};fs.appendChild(b)});
 const rs=$('#resSeg');rs.innerHTML='';[[1,'HD'],[2,'4K']].forEach(([v,l])=>{const b=el('button',S.res===v?'on':'',l);b.type='button';b.title=v===1?'1920 px sul lato lungo':'3840 px sul lato lungo';b.onclick=()=>{S.res=v;[...rs.children].forEach(x=>x.classList.toggle('on',x===b));relayout();fitStage()};rs.appendChild(b)});
 const fp=$('#fpsSel');fp.innerHTML=[24,25,30,50,60].map(v=>`<option ${v===S.fps?'selected':''}>${v}</option>`).join('');fp.onchange=()=>{S.fps=+fp.value;drawTimeline();dirty=true}}

/* ============================================================ save / export */
let DLNS=null,dlP=null;
function dlReady(){if(!dlP)dlP=(async()=>{try{if(window.claude&&typeof claude.use==='function')DLNS=await claude.use('downloads')}catch(e){DLNS=null}return DLNS})();return dlP}
async function saveBlob(name,blob){
 if(import.meta.env&&import.meta.env.DEV&&window.__motoSave)return window.__motoSave(name,blob);
 if(window.claude&&typeof claude.use==='function'){await dlReady();if(DLNS){try{await DLNS.save({filename:name,data:blob});toast('Salvato: '+name)}catch(e){const c=e&&e.code;toast(c==='declined'?'Salvataggio annullato':c==='rate_limited'?'C\'è già un salvataggio in attesa':c==='too_large'?'File troppo grande: prova HD o meno frame':'Salvataggio non disponibile in questa vista')}return}}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);toast('Scaricato: '+name)}
const fname=ext=>`moto_${(S.text.trim()||(svgLayers()[0]||{}).name||'testo').split('\n')[0].toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,24)||'clip'}_${S.fmt.replace(':','x')}.${ext}`;
const exportPreset=()=>{const data={...S};data.fontName=FONTS[S.font]?.n;saveBlob(fname('json'),new Blob([JSON.stringify(data,null,2)],{type:'application/json'}))};
/* ============================================================ file di progetto .moto */
// il progetto aperto: il suo file (se è stato salvato), il nome, se ci sono modifiche non ancora scritte nel file
const PROJ={handle:null,key:null,name:'Senza titolo',dirty:false,paths:{}};
function updProjTitle(){const e=$('#projName');if(e)e.textContent=PROJ.name+(PROJ.dirty&&PROJ.handle?' •':'')+(PROJ.handle?'':' · non salvato');document.title=PROJ.name+' — MOTO v2 beta'}
const saveProjMeta=()=>{try{localStorage.setItem('moto:proj',JSON.stringify({name:PROJ.name,key:PROJ.key,paths:PROJ.paths}))}catch(e){}};
// tutto il progetto in un oggetto: scene e sequenza, immagini e SVG dentro, font caricati dentro, video e audio come percorso nella cartella
async function projectData(){snapNorm();const st=PF.fontsToNames(JSON.parse(JSON.stringify(S)),i=>FONTS[i]?.n);
 const used=new Set([S.font,...(S.blocks||[]).map(b=>b.font),...S.seq.clips.filter(c=>c.scene).flatMap(c=>[c.scene.font,...(c.scene.blocks||[]).map(b=>b.font)])]),stored=await listFonts(),fonts=[];
 for(const i of used){const f=FONTS[i];if(!f||!f.store)continue;const r=stored.find(x=>x.name===f.store);if(r)fonts.push({name:r.name,label:r.label,file:r.file,data:PF.toB64(r.data)})}
 const media=await Promise.all((S.media||[]).map(async m=>({...m,path:(await MED.pathOf(m.id))||PROJ.paths[m.id]?.path||null})));
 media.forEach(m=>{PROJ.paths[m.id]={path:m.path,name:m.name,size:m.size}});
 return{format:PF.FORMAT,version:PF.VERSION,app:'MOTO v2 beta',saved:new Date().toISOString(),name:PROJ.name,state:st,fonts,media}}
async function writeProject(quiet){if(!PROJ.handle)return false;
 try{if(quiet&&(await PROJ.handle.queryPermission?.({mode:'readwrite'}))!=='granted')return false;const data=await projectData(),w=await PROJ.handle.createWritable();await w.write(JSON.stringify(data));await w.close();PROJ.dirty=false;updProjTitle();saveProjMeta();return true}
 catch(e){if(isNotAllowed(e)){setUI('fsBroken',true);PROJ.handle=null;updProjTitle()}else if(!quiet)toast('Salvataggio non riuscito: '+(e.message||e));return false}}
async function saveProject(as){
 if(fsBroken())return downloadProject();
 if(as||!PROJ.handle){if(!window.showSaveFilePicker){const data=await projectData();await saveBlob(PROJ.name+'.moto',new Blob([JSON.stringify(data)],{type:'application/json'}));PROJ.dirty=false;updProjTitle();return}
  try{const h=await window.showSaveFilePicker({suggestedName:(PROJ.name||'Senza titolo')+'.moto',id:'moto-progetti',types:[{description:'Progetto MOTO',accept:{'application/json':['.moto']}}]});PROJ.handle=h;PROJ.name=PF.projectName(h.name);PROJ.key=await PF.addRecent(h)}catch(e){return}}
 else if(PROJ.handle.queryPermission&&(await PROJ.handle.queryPermission({mode:'readwrite'}).catch(()=>null))!=='granted'){const p=await PROJ.handle.requestPermission({mode:'readwrite'}).catch(()=>null);
  // il browser non lascia riscrivere quel file: si sceglie di nuovo dove salvare (di solito lo stesso file)
  if(p!=='granted'){PROJ.handle=null;return saveProject(true)}}
 const ok=await writeProject(false);if(ok){await PF.addRecent(PROJ.handle,PROJ.key);toast('Salvato: '+PROJ.name+'.moto')}else if(fsBroken())downloadProject()}
async function downloadProject(){const data=await projectData();await saveBlob(PROJ.name+'.moto',new Blob([JSON.stringify(data)],{type:'application/json'}));PROJ.dirty=false;updProjTitle();toast('Progetto scaricato: '+PROJ.name+'.moto. In Chrome o Arc si salva direttamente nel file')}
// salvataggio automatico anche nel file (se il browser ha già il permesso), poco dopo ogni modifica
let projTm=0;function projChanged(){if(HIST.busy)return;PROJ.dirty=true;updProjTitle();clearTimeout(projTm);if(PROJ.handle)projTm=setTimeout(()=>writeProject(true),1500)}
async function loadProjectData(d,handle,fileName){const k=PF.kindOfFile(d);if(!k)return toast('File non riconosciuto: non è un progetto MOTO');
 clearTimeout(HIST.tm);histCommit();
 if(k==='preset'){await applyPreset(d);return}
 for(const f of d.fonts||[]){if(FONTS.some(x=>x.store===f.name&&!x.removed))continue;try{const buf=PF.fromB64(f.data),ff=new FontFace(f.name,buf.slice(0));await ff.load();document.fonts.add(ff);FONTS.push({n:f.label,g:'Caricati',css:`"${f.name}",sans-serif`,min:100,max:900,store:f.name});await saveFont({name:f.name,label:f.label,file:f.file,data:buf,added:Date.now()})}catch(e){}}
 fillFonts();const st=PF.namesToFonts(d.state,n=>FONTS.findIndex(x=>x.n===n&&!x.removed));
 PROJ.paths=Object.fromEntries((d.media||[]).map(m=>[m.id,{path:m.path,name:m.name,size:m.size}]));if(Array.isArray(d.media))st.media=d.media.map(({path,...m})=>m);
 HIST.busy=true;try{await applyPreset(st,true)}finally{HIST.busy=false}
 PROJ.handle=handle;PROJ.name=handle?PF.projectName(handle.name):fileName||d.name||'Senza titolo';PROJ.key=handle?await PF.addRecent(handle):null;PROJ.dirty=false;saveProjMeta();updProjTitle();
 HIST.last=snap();histUI();autosave();await restoreMedia();const miss=(S.media||[]).filter(m=>!MED.hasFile(m.id)).length;
 toast(miss&&!UI.needGrant?`Progetto aperto: ${miss} file da ricollegare (pulsante sopra la timeline)`:'Progetto aperto: '+PROJ.name)}
// all'apertura il file si legge soltanto; il permesso di scrivere si chiede quando si salva (alcuni browser non lo concedono qui)
async function readHandle(h){try{return await h.getFile()}catch(e){if(h.requestPermission&&(await h.requestPermission({mode:'read'}).catch(()=>null))==='granted')return await h.getFile();throw e}}
// alcuni browser (per esempio quello integrato di Claude) danno la finestra moderna ma non lasciano leggere né scrivere i file:
// la prima volta che succede MOTO se lo ricorda e usa la scelta classica dei file (e per salvare scarica il file)
const fsBroken=()=>getUI('fsBroken',false);
const isNotAllowed=e=>e&&(e.name==='NotAllowedError'||/not allowed/i.test(e.message||''));
function openClassic(){const i=el('input');i.type='file';i.accept='.moto,.json,application/json';i.onchange=async()=>{const f=i.files[0];if(!f)return;try{const d=JSON.parse(await f.text());await loadProjectData(d,null,PF.projectName(f.name))}catch(e){toast('Progetto non leggibile: '+(e.message||e))}};i.click()}
async function openProject(h,noRetry){if(!h&&(fsBroken()||!window.showOpenFilePicker))return openClassic();const recent=!!h&&!noRetry;try{if(!h){if(!window.showOpenFilePicker){$('#fLoad').click();return}[h]=await window.showOpenFilePicker({id:'moto-progetti',types:[{description:'Progetto MOTO',accept:{'application/json':['.moto','.json']}}]})}
  const d=JSON.parse(await (await readHandle(h)).text());await loadProjectData(d,PF.kindOfFile(d)==='project'?h:null)}
 catch(e){if(e&&e.name==='AbortError')return;
  // un recente che il browser non lascia più leggere: si apre la scelta del file nella sua cartella
  if(recent&&window.showOpenFilePicker){try{const[h2]=await window.showOpenFilePicker({startIn:h,types:[{description:'Progetto MOTO',accept:{'application/json':['.moto','.json']}}]});return openProject(h2,true)}catch(e2){if(e2&&e2.name==='AbortError')return}}
  if(isNotAllowed(e)&&!fsBroken()){setUI('fsBroken',true);return toast('Questo browser non lascia leggere i file scelti così: premi di nuovo Apri, userò la scelta classica dei file')}
  toast('Progetto non leggibile: '+(e.message||e))}}
function newProject(){PROJ.handle=null;PROJ.key=null;PROJ.name='Senza titolo';PROJ.paths={};PROJ.dirty=false;saveProjMeta();updProjTitle()}
// menu a comparsa sotto un pulsante
function popMenu(btn,items){let m=$('#popMenu');if(m){const same=m._for===btn;m.remove();if(same)return}m=el('div','menu on popmenu');m.id='popMenu';m._for=btn;const r=btn.getBoundingClientRect();m.style.cssText=`position:fixed;top:${r.bottom+6}px;left:${Math.max(8,Math.min(innerWidth-270,r.left))}px;right:auto`;
 items.forEach(it=>{if(it==='-'){m.appendChild(el('div','msep'));return}if(it.label&&!it.fn){m.appendChild(el('div','sublab',it.label));return}const b=el('button',null,`<span><i data-lucide="${it.icon||'dot'}"></i>${it.text}</span>`+(it.hint?`<small>${it.hint}</small>`:''));b.type='button';b.onclick=()=>{m.remove();it.fn()};m.appendChild(b)});
 document.body.appendChild(m);if(window.lucide)lucide.createIcons();setTimeout(()=>{const close=e=>{if(!m.contains(e.target)){m.remove();removeEventListener('pointerdown',close,true)}};addEventListener('pointerdown',close,true)})}
const ago=t=>{const s=(Date.now()-t)/1000;return s<3600?Math.max(1,Math.round(s/60))+' min fa':s<86400?Math.round(s/3600)+' ore fa':new Date(t).toLocaleDateString('it-IT',{day:'numeric',month:'short'})};
$('#bSave').onclick=()=>popMenu($('#bSave'),[{icon:'save',text:'Salva',hint:PROJ.handle?'Nel file '+PROJ.name+'.moto · ⌘S':'Scegli dove salvare il progetto · ⌘S',fn:()=>saveProject(false)},{icon:'copy-plus',text:'Salva con nome…',hint:'⇧⌘S',fn:()=>saveProject(true)},'-',{icon:'file-json',text:'Esporta come preset (.json)',hint:'Solo la scena aperta, come prima',fn:exportPreset}]);
$('#bLoad').onclick=async()=>{const rec=fsBroken()?[]:(await PF.listRecent()).slice(0,8);popMenu($('#bLoad'),[{icon:'folder-open',text:'Apri progetto…',hint:'File .moto · ⌘O',fn:()=>openProject()},...(rec.length?['-',{label:'Recenti'},...rec.map(r=>({icon:'file',text:r.name,hint:ago(r.when),fn:()=>openProject(r.handle)}))]:[]),'-',{icon:'file-json',text:'Importa un preset (.json)',fn:()=>$('#fLoad').click()}])};
$('#fLoad').onchange=()=>{const f=$('#fLoad').files[0];$('#fLoad').value='';if(f)loadPreset(f)};
async function loadPreset(f){try{await applyPreset(JSON.parse(await f.text()))}catch(e){toast('File preset non valido')}}
async function applyPreset(d,quiet){{const base=defaults();if(d.block&&d.block.on&&!d.block.mode)d.block.mode='free';const N=Object.assign(base,d,{block:{...base.block,...(d.block||{})},loop:{...base.loop,...(d.loop||{})},inS:{...base.inS,...(d.inS||{})},outS:{...base.outS,...(d.outS||{})}});const fi=FONTS.findIndex(x=>x.n===d.fontName);N.font=fi>=0?fi:0;if(!FXMAP[N.inS.fx])N.inS.fx='mask';if(!FXMAP[N.outS.fx])N.outS.fx='fade';if(!LMAP[N.loop.fx])N.loop.fx='none';delete N.fontName;
  if(!FMT[N.fmt])N.fmt=base.fmt;if(N.res!==1&&N.res!==2)N.res=1;if(![24,25,30,50,60].includes(+N.fps))N.fps=30;N.fps=+N.fps;
  N.images=Array.isArray(N.images)?N.images.filter(x=>x&&typeof x.id==='string'&&typeof x.src==='string'&&x.src.startsWith('data:image/')):[];N.layers=Array.isArray(N.layers)?N.layers:[];N.cam=normCam(d.cam);N.seq=d.seq&&Array.isArray(d.seq.clips)?{...d.seq,clips:d.seq.clips.filter(c=>c&&c.id&&c.kind&&typeof c.start==='number'),markers:Array.isArray(d.seq.markers)?d.seq.markers:[],act:d.seq.act}:newSeq();if(N.seq.subs&&!Array.isArray(N.seq.subs.words))delete N.seq.subs;else if(N.seq.subs)N.seq.subs.words=N.seq.subs.words.filter(w=>w&&w.id&&typeof w.t==='string'&&typeof w.s==='number'&&typeof w.e==='number');N.media=Array.isArray(d.media)?d.media:[];N.states=d.states&&Array.isArray(d.states.list)?{on:!!d.states.on,list:d.states.list.filter(x=>x&&typeof x.at==='number').map(x=>({...x,d:x.d&&typeof x.d==='object'?x.d:{}}))}:newStates();N.block.keys=Array.isArray(N.block.keys)?N.block.keys.filter(k=>k&&['t','x','y','s','r','op'].every(f=>typeof k[f]==='number')):[];
  if(Array.isArray(d.blocks)&&d.blocks.length>1){N.blocks=d.blocks.filter(b=>b&&typeof b==='object').map(b=>{const o=Object.assign(pickText(base),b,{block:{...base.block,...(b.block||{})},loop:{...base.loop,...(b.loop||{})},inS:{...base.inS,...(b.inS||{})},outS:{...base.outS,...(b.outS||{})}});
   if(typeof o.text!=='string')o.text='';if(!FXMAP[o.inS.fx])o.inS.fx='mask';if(!FXMAP[o.outS.fx])o.outS.fx='fade';if(!LMAP[o.loop.fx])o.loop.fx='none';o.block.keys=Array.isArray(o.block.keys)?o.block.keys.filter(k=>k&&['t','x','y','s','r','op'].every(f=>typeof k[f]==='number')):[];if(typeof o.font!=='number'||!FONTS[o.font])o.font=0;return o});
   N.cur=clamp(Math.round(+N.cur||0),0,N.blocks.length-1);if(N.blocks.length<2){N.blocks=[];N.cur=0}}else{N.blocks=[];N.cur=0}
  await Promise.all(N.images.map(loadImg));S=N;ensureSeq();normalizeTimeline();TLD.marker=null;TLD.drag=null;TLD.scale=0;UI.selKey=null;SCL.clear();UI.selClip=null;buildTop();buildInspector();restoreMedia();loadFonts().then(relayout);relayout();markTiles();buildThumbs();t=0;histMark();if(!quiet)toast(d.fontName&&fi<0?'Preset caricato. Font "'+d.fontName+'" non trovato, sostituito':'Preset caricato')}}

/* ============================================================ history + autosave */
// ponytail: snapshot JSON dell'intero stato, immagini escluse (restano in IMGS). Tetto 80 passi.
const HIST={u:[],r:[],last:null,busy:false,tm:0},AUTOSAVE='moto:autosave';
// il render riempie i parametri di default (prmOf) e ricalcola fs con "Adatta": normalizzo prima del confronto
function snapNorm(){prmOf(S.inS,FXMAP);prmOf(S.outS,FXMAP);prmOf(S.loop,LMAP);(S.blocks||[]).forEach(b=>{if(b.inS)prmOf(b.inS,FXMAP);if(b.outS)prmOf(b.outS,FXMAP);if(b.loop)prmOf(b.loop,LMAP)});S.layers.forEach(L=>{if(L.kind==='svg')return;prmOf(L,FXMAP);if(L.lp)prmOf(L.lp,LMAP)})}
const snap=()=>{snapNorm();return JSON.stringify({...S,images:S.images.map(x=>({id:x.id,name:x.name})),fontName:FONTS[S.font]?.n})};
const snapKey=j=>{const o=JSON.parse(j);if(o.fit)delete o.fs;return JSON.stringify(o)};
function histMark(){clearTimeout(HIST.tm);HIST.tm=setTimeout(histCommit,350)}
function histCommit(){if(HIST.busy||exporting||TLD.drag)return;const cur=snap();if(HIST.last!==null&&snapKey(cur)===snapKey(HIST.last)){HIST.last=cur;return}if(HIST.last!==null){HIST.u.push(HIST.last);if(HIST.u.length>80)HIST.u.shift();HIST.r.length=0}HIST.last=cur;histUI();autosave()}
function histUI(){$('#bUndo').disabled=!HIST.u.length;$('#bRedo').disabled=!HIST.r.length}
async function histGo(from,to,msg){clearTimeout(HIST.tm);histCommit();if(!from.length)return;to.push(HIST.last);const st=from.pop();HIST.busy=true;
 try{const d=JSON.parse(st);d.images=d.images.filter(x=>IMGS[x.id]).map(x=>({...x,src:IMGS[x.id].src}));await applyPreset(d,true)}finally{HIST.busy=false}
 HIST.last=snap();histUI();autosave();toast(msg)}
const undo=()=>histGo(HIST.u,HIST.r,'Annullato'),redo=()=>histGo(HIST.r,HIST.u,'Ripristinato');
function autosave(){projChanged();const full=JSON.stringify({...S,fontName:FONTS[S.font]?.n});try{localStorage.setItem(AUTOSAVE,full)}catch(e){try{localStorage.setItem(AUTOSAVE,snap());if(!autosave.warned){autosave.warned=1;toast('Salvataggio automatico senza immagini: troppo pesanti per il browser')}}catch(e2){}}}
['input','change','click','dblclick','drop','paste','keyup','pointerup'].forEach(ev=>document.addEventListener(ev,histMark,true));
$('#bUndo').onclick=undo;$('#bRedo').onclick=redo;
$('#bNew').onclick=async()=>{if(PROJ.dirty&&PROJ.handle)await writeProject(true);clearTimeout(HIST.tm);histCommit();await applyPreset(defaults(),true);newProject();toast('Nuovo progetto. ⌘Z per tornare indietro')};
$('#bKey').onclick=()=>addKey();
$('#bHelp').onclick=()=>$('#help').classList.add('on');$('#helpClose').onclick=()=>$('#help').classList.remove('on');
$('#help').onclick=e=>{if(e.target.id==='help')$('#help').classList.remove('on')};

/* ============================================================ export estimates */
const EST_LIMIT=1.5e9;
const mb=b=>b>=1e9?(b/1e9).toFixed(1)+' GB':Math.max(1,Math.round(b/1e6))+' MB';
async function estimate(){const T={total:seqTot()},n=Math.max(1,Math.round(T.total*S.fps));{const[W,H]=dims();renderSeq(ctx,TG(),W,H,S.res,{})}const b=await new Promise(r=>cv.toBlob(r,'image/png'));dirty=true;
 const png=(b?b.size:cv.width*cv.height*.5)*1.15*n,vid=(S.res===2?60e6:24e6)/8*T.total;return{n,png,vid,total:T.total}}

const menu=$('#expMenu');$('#bExport').onclick=async e=>{e.stopPropagation();menu.classList.toggle('on');if(!menu.classList.contains('on'))return;const m=pickMime();loadMuxer().catch(()=>{});const fc=await fastCfg().catch(()=>null);
 $('#vidHint').textContent=fc?'MP4 H.264 · codifica veloce':(m?.ext.toUpperCase()||'Video')+' in tempo reale'+(S.transparent?'. La trasparenza può non essere mantenuta: usa la sequenza PNG':'');$('#seqHint').textContent='Calcolo peso…';$('#seqHint').classList.remove('warn');
 const E=await estimate();$('#vidHint').textContent+=` · ${E.total.toFixed(1)} s · circa ${mb(fc?fastRate()/8*E.total:E.vid)}`;
 const sh=$('#seqHint');sh.textContent=`${E.n} frame ${cv.width}×${cv.height} · circa ${mb(E.png)}`+(E.png>EST_LIMIT?' · troppo pesante: riduci durata, FPS o usa HD':'. Ideale per After Effects');sh.classList.toggle('warn',E.png>EST_LIMIT)};
addEventListener('click',e=>{if(!e.target.closest('#expMenu'))menu.classList.remove('on')});
menu.onclick=e=>{const b=e.target.closest('button');if(!b)return;menu.classList.remove('on');({video:exportVideo,multi:multiDialog,seq:exportSeq,frame:exportFrame})[b.dataset.x]()};
// stesso montaggio in più formati: si scelgono i formati, poi una cartella; i video si fanno uno dopo l'altro (ognuno con la sua inquadratura)
function multiDialog(){let d=$('#multiDlg');if(d){d.remove();return}d=el('div','multidlg');d.id='multiDlg';const sel0=new Set(getUI('multiFmt',['16:9','9:16']));
 d.appendChild(el('div','mdt','Video in più formati'));
 Object.keys(FMT).forEach(k=>{const r=el('label','mdr'),c=el('input');c.type='checkbox';c.checked=sel0.has(k);c.onchange=()=>{c.checked?sel0.add(k):sel0.delete(k)};r.append(c,document.createTextNode(` ${k}  `),el('small',null,FMT[k].map(v=>v*S.res).join('×')));d.appendChild(r)});
 d.appendChild(el('div','note',`Qualità ${S.res===2?'4K':'HD'} e ${S.fps} fps come adesso. Ogni formato usa la sua inquadratura dei video.`));
 const bl=el('div','bline'),go=el('button','btn pri','Esporta'),no=el('button','btn','Annulla');go.type=no.type='button';no.onclick=()=>d.remove();
 go.onclick=()=>{const list=Object.keys(FMT).filter(k=>sel0.has(k));if(!list.length)return toast('Scegli almeno un formato');setUI('multiFmt',list);d.remove();exportMulti(list)};bl.append(no,go);d.appendChild(bl);document.body.appendChild(d)}
async function exportMulti(list){if(!(await fastCfg().catch(()=>null)))return toast('Questo browser non ha la codifica veloce: esporta un formato alla volta');
 let dir=null;if(window.showDirectoryPicker){try{dir=await showDirectoryPicker({id:'moto-export',mode:'readwrite'})}catch(e){return}}
 const prev=S.fmt,done=[];let fail=null;
 try{for(let i=0;i<list.length;i++){S.fmt=list[i];SCL.clear();relayout();fitStage();await new Promise(r=>requestAnimationFrame(r));const cfg=await fastCfg();if(!cfg)throw new Error('codifica non disponibile per '+list[i]);
   const blob=await exportFast(cfg,{ret:true,label:`${list[i]} (${i+1} di ${list.length})`});if(!blob)break;const name=fname('mp4');
   if(dir){const fh=await dir.getFileHandle(name,{create:true}),w=await fh.createWritable();await w.write(blob);await w.close()}else await saveBlob(name,blob);done.push(name)}}
 catch(e){fail=e}finally{S.fmt=prev;SCL.clear();buildTop();relayout();fitStage();dirty=true}
 if(fail)toast('Esportazione interrotta: '+(fail.message||fail)+(done.length?'. Fatti: '+done.join(', '):''));
 else toast(done.length?`${done.length} video esportati${dir?' nella cartella '+dir.name:''}: ${done.join(', ')}`:'Esportazione annullata')}
function pickMime(){if(typeof MediaRecorder==='undefined')return null;const c=[['video/mp4;codecs=avc1.640033','mp4'],['video/mp4;codecs=avc1','mp4'],['video/mp4','mp4'],['video/webm;codecs=vp9','webm'],['video/webm;codecs=vp8','webm'],['video/webm','webm']];if(S.transparent)c.unshift(['video/webm;codecs=vp9','webm']);for(const[m,ext]of c)if(MediaRecorder.isTypeSupported(m))return{m,ext};return null}
let cancel=false;
function modal(on,title,note){$('#modal').classList.toggle('on',on);if(title)$('#mTitle').textContent=title;if(note!=null)$('#mNote').textContent=note;$('#mBar').style.width='0%'}
$('#mCancel').onclick=()=>{cancel=true};
const frameAt=f=>f/S.fps;
// esportazione: la sequenza intera; i video con il decoder WebCodecs (fotogrammi esatti), in mancanza con il lettore
const EXD=new Map();
async function prepExport(){EXD.clear();VSLOT=videoSlots();const keys=[...new Set(S.seq.clips.filter(c=>c.kind==='video'&&c.media).map(c=>c.media+'#'+(VSLOT.get(c.id)||0)))];
 for(const k of keys){const f=MED.fileOf(k.split('#')[0]);if(!f)continue;const d=new VideoDecode(f);if(await d.init())EXD.set(k,d)}}
function endExport(){for(const d of EXD.values())d.close();EXD.clear()}
async function renderExport(T){const[W,H]=dims(),vf=new Map();
 for(const c of S.seq.clips){if(c.kind!=='video'||!c.media||!activeExt(S.seq,c,T))continue;const lt=vidT(c,T),d=EXD.get(c.media+'#'+(VSLOT.get(c.id)||0));
  if(d){const fr=await d.frameAt(lt);if(fr)vf.set(c.id,{frame:fr,rot:d.rot});continue}
  const v=MED.videoOf(c.media);if(v){v.pause();if(Math.abs(v.currentTime-lt)>1e-3){v.currentTime=lt;await new Promise(r=>{const f=()=>{v.removeEventListener('seeked',f);r()};v.addEventListener('seeked',f);setTimeout(f,2000)})}}}
 renderSeq(ctx,T,W,H,S.res,{vf})}
const hasSeqAudio=()=>S.seq.clips.some(c=>c.kind!=='motion'&&!c.mute&&(c.vol??1)>0&&c.media&&MED.hasFile(c.media));
async function seqMix(total){const ids=[...new Set(S.seq.clips.filter(c=>c.kind!=='motion'&&c.media&&MED.hasFile(c.media)).map(c=>c.media))];await Promise.all(ids.map(id=>MED.audioOf(id,SA.ctx())));
 const m=mixCfg(),mix=await mixdown(S.seq,total,bufOf,mixOpts());let chs=[mix.getChannelData(0),mix.getChannelData(1)];
 // volume finale: guadagno, limitatore, poi una correzione (il limitatore toglie un po' di volume) e di nuovo il limitatore
 const sr=mix.sampleRate,src=chs;let g=m.norm?gainTo(loudness(src,sr),m.target,12):1;
 for(let k=0;k<3;k++){chs=src.map(c=>c.map(v=>v*g));if(m.limit)chs=limit(chs,sr,m.ceil);if(!m.norm)break;const L=loudness(chs,sr);if(!isFinite(L)||Math.abs(L-m.target)<.15)break;g*=gainTo(L,m.target,6)}
 const out=new AudioBuffer({length:mix.length,numberOfChannels:2,sampleRate:mix.sampleRate});chs.forEach((d,i)=>out.copyToChannel(d,i));return out}
async function exportFrame(){exporting=true;let b=null;try{await prepExport();await renderExport(TG());endExport();b=await new Promise(r=>cv.toBlob(r,'image/png'))}catch(e){}finally{exporting=false;dirty=true}if(!b)return toast('Frame non esportato: canvas troppo grande o non leggibile');await saveBlob(fname('png').replace('.png',`_f${Math.round(t*S.fps)}.png`),b)}
async function exportSeq(){const E=await estimate();if(E.n>65535)return toast('Troppi frame per uno ZIP: accorcia la clip o abbassa gli FPS');if(E.png>EST_LIMIT&&!confirm(`L'archivio peserà circa ${mb(E.png)} e potrebbe bloccare il browser. Continuare?`))return;const n=E.n;cancel=false;exporting=true;setPlay(false);modal(true,'Sequenza PNG',`${n} frame a ${cv.width}×${cv.height}`);const files=[];
 try{await prepExport();for(let f=0;f<n;f++){if(cancel)break;await renderExport(frameAt(f));const b=await new Promise(r=>cv.toBlob(r,'image/png'));files.push({name:`moto_${String(f).padStart(5,'0')}.png`,data:new Uint8Array(await b.arrayBuffer())});$('#mBar').style.width=((f+1)/n*100)+'%';if(f%4===0)await new Promise(r=>setTimeout(r))}
  endExport();if(!cancel){$('#mNote').textContent='Compressione archivio…';await new Promise(r=>setTimeout(r,30));const z=zip(files);modal(false);exporting=false;dirty=true;await saveBlob(fname('zip'),z);return}}
 catch(e){toast('Esportazione interrotta: '+e.message)}
 modal(false);exporting=false;dirty=true}
async function exportRealtime(){const mm=pickMime();if(!mm||!cv.captureStream){toast('Questo browser non registra video: usa la sequenza PNG');return}
 const n=Math.max(1,Math.round(seqTot()*S.fps));cancel=false;exporting=true;setPlay(false);modal(true,'Video '+mm.ext.toUpperCase(),`${n} frame, ${seqTot().toFixed(2)} s in tempo reale, senza audio. Lascia la scheda in primo piano.`);await prepExport();
 let stream,track,manual=true,chunks=[];try{try{stream=cv.captureStream(0);track=stream.getVideoTracks()[0];if(!track.requestFrame){stream=cv.captureStream(S.fps);track=stream.getVideoTracks()[0];manual=false}}catch(e){stream=cv.captureStream(S.fps);track=stream.getVideoTracks()[0];manual=false}
 const rec=new MediaRecorder(stream,{mimeType:mm.m,videoBitsPerSecond:S.res===2?60e6:24e6});rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};const done=new Promise(r=>rec.onstop=r);
 await renderExport(0);rec.start(250);const t0=performance.now(),fd=1000/S.fps;
 for(let f=0;f<n;f++){if(cancel)break;await renderExport(frameAt(f));if(manual)track.requestFrame();$('#mBar').style.width=((f+1)/n*100)+'%';const wait=t0+(f+1)*fd-performance.now();await new Promise(r=>setTimeout(r,Math.max(0,wait)))}
 rec.stop();await done}catch(e){toast('Registrazione non riuscita: '+e.message);cancel=true}finally{track?.stop();endExport();modal(false);exporting=false;dirty=true}
 if(cancel)return;if(!chunks.length)return toast('Il video è vuoto: prova la sequenza PNG');await saveBlob(fname(mm.ext),new Blob(chunks,{type:mm.m.split(';')[0]}))}
/* ============================================================ export video veloce (WebCodecs + mp4-muxer) */
const MUX_URL='https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.min.js';let MUX=null;
function loadMuxer(){return MUX||(MUX=new Promise((ok,ko)=>{if(window.Mp4Muxer)return ok(window.Mp4Muxer);const sc=document.createElement('script');sc.src=MUX_URL;sc.onload=()=>window.Mp4Muxer?ok(window.Mp4Muxer):ko(new Error('libreria MP4 non valida'));sc.onerror=()=>{MUX=null;ko(new Error('libreria MP4 non raggiungibile'))};document.head.appendChild(sc)}))}
const fastRate=()=>S.res===2?40e6:16e6;
async function fastCfg(){if(S.transparent||typeof VideoEncoder==='undefined'||typeof VideoFrame==='undefined')return null;
 for(const codec of['avc1.640033','avc1.4d0033','avc1.42003e']){const c={codec,width:cv.width,height:cv.height,bitrate:fastRate(),framerate:S.fps,avc:{format:'avc'}};try{if((await VideoEncoder.isConfigSupported(c)).supported)return c}catch(e){}}return null}
async function exportFast(cfg,o={}){const M=await loadMuxer(),total=seqTot(),n=Math.max(1,Math.round(total*S.fps)),us=1e6/S.fps,withA=hasSeqAudio()&&typeof AudioEncoder!=='undefined';
 cancel=false;exporting=true;setPlay(false);modal(true,'Video MP4'+(o.label?' · '+o.label:''),`${n} frame ${cv.width}×${cv.height}`+(withA?' con audio':'')+' · codifica veloce, puoi cambiare scheda');
 const muxer=new M.Muxer({target:new M.ArrayBufferTarget(),video:{codec:'avc',width:cv.width,height:cv.height,frameRate:S.fps},audio:withA?{codec:'aac',numberOfChannels:2,sampleRate:48000}:undefined,fastStart:'in-memory'});
 let err=null,enc=null;
 try{$('#mNote').textContent='Preparazione dei video…';await prepExport();enc=new VideoEncoder({output:(c,m)=>muxer.addVideoChunk(c,m),error:e=>{err=e}});enc.configure(cfg);
  for(let f=0;f<n;f++){if(cancel||err)break;await renderExport(frameAt(f));const vf=new VideoFrame(cv,{timestamp:Math.round(f*us),duration:Math.round(us)});enc.encode(vf,{keyFrame:f%(S.fps*2)===0});vf.close();
   $('#mBar').style.width=((f+1)/n*100)+'%';while(enc.encodeQueueSize>6&&!err)await new Promise(r=>setTimeout(r,2));if(f%8===0)await new Promise(r=>setTimeout(r))}
  if(!cancel&&!err){$('#mNote').textContent='Finalizzazione…';await enc.flush();if(err)throw err;
   if(withA){$('#mNote').textContent='Mix e codifica dell\'audio…';const mix=await seqMix(total);await encodeAac(mix,(c,m)=>muxer.addAudioChunk(c,m))}
   muxer.finalize()}}
 catch(e){err=err||e}finally{endExport();try{if(enc&&enc.state!=='closed')enc.close()}catch(e){}modal(false);exporting=false;dirty=true}
 if(err)throw err;if(cancel)return;
 const buf=muxer.target.buffer;if(!buf||!buf.byteLength)throw new Error('file vuoto');const blob=new Blob([buf],{type:'video/mp4'});if(o.ret)return blob;await saveBlob(fname('mp4'),blob)}
async function exportVideo(){const cfg=await fastCfg().catch(()=>null);if(cfg){try{return await exportFast(cfg)}catch(e){toast('Codifica veloce non riuscita ('+(e.message||e)+'): registro in tempo reale');await new Promise(r=>setTimeout(r,900))}}return exportRealtime()}

/* minimal ZIP (store) */
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u){let c=0xffffffff;for(let i=0;i<u.length;i++)c=CRC[(c^u[i])&255]^(c>>>8);return(c^0xffffffff)>>>0}
function zip(files){const enc=new TextEncoder(),parts=[],cen=[];let off=0;
 for(const f of files){const nm=enc.encode(f.name),crc=crc32(f.data),sz=f.data.length;
  const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(8,0,true);h.setUint16(10,0,true);h.setUint16(12,33,true);h.setUint32(14,crc,true);h.setUint32(18,sz,true);h.setUint32(22,sz,true);h.setUint16(26,nm.length,true);
  parts.push(h.buffer,nm,f.data);
  const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(12,0,true);c.setUint16(14,33,true);c.setUint32(16,crc,true);c.setUint32(20,sz,true);c.setUint32(24,sz,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
  cen.push(c.buffer,nm);off+=30+nm.length+sz}
 const cs=cen.reduce((a,b)=>a+b.byteLength,0);const e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
 return new Blob([...parts,...cen,e.buffer],{type:'application/zip'})}

/* ============================================================ boot */
addEventListener('dragover',e=>{if([...e.dataTransfer.items].some(i=>i.kind==='file'))e.preventDefault()});
addEventListener('drop',async e=>{const all=[...e.dataTransfer.files];if(!all.length)return;e.preventDefault();
 if(all.some(f=>MED.isMediaName(f.name))){await dropMedia(e.dataTransfer);return}const sv=all.filter(f=>/\.svg$/i.test(f.name)||f.type==='image/svg+xml');if(sv.length){sv.forEach(async f=>addSvg(await f.text(),f.name.replace(/\.svg$/i,'')));return}const fs=all.filter(f=>/^image\//.test(f.type)),js=all.find(f=>/\.json$/i.test(f.name)||f.type==='application/json');if(fs.length){reveal(UI.imgSec);addImages(fs)}else if(js)loadPreset(js);else toast('Formato non supportato: trascina immagini o un preset .json')});
addEventListener('paste',e=>{if(e.target.closest('input,textarea'))return;const fs=[...(e.clipboardData?.files||[])].filter(f=>/^image\//.test(f.type));if(fs.length){reveal(UI.imgSec);addImages(fs)}else{const tx=e.clipboardData?.getData('text/plain')||'';if(/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)?<svg[\s>]/i.test(tx)){e.preventDefault();addSvg(tx.trim(),'SVG incollato')}}});
/* ============================================================ ricerca ovunque (⌘K) */
function buildCommands(){const C=[];const add=(group,title,run,o={})=>C.push({id:group+':'+title,group,title,run,...o});const click=id=>()=>$(id).click();
 add('Azioni','Esporta video',()=>exportVideo(),{keywords:'mp4 render webm',hint:'E'});
 add('Azioni','Esporta sequenza PNG (.zip)',()=>exportSeq(),{keywords:'frame png zip after effects trasparenza'});
 add('Azioni','Esporta frame corrente (.png)',()=>exportFrame(),{keywords:'immagine fotogramma'});
 add('Azioni','Salva preset',click('#bSave'),{hint:'⌘S',keywords:'json'});add('Azioni','Apri preset…',click('#bLoad'),{keywords:'carica json'});add('Azioni','Nuovo progetto',click('#bNew'));
 add('Azioni','Annulla',click('#bUndo'),{hint:'⌘Z'});add('Azioni','Ripeti',click('#bRedo'),{hint:'⇧⌘Z'});
 add('Azioni','Play / pausa',click('#bPlay'),{hint:'Spazio'});add('Azioni','Vai all\'inizio',click('#bStart'),{hint:'Home'});
 add('Azioni','Aggiungi keyframe alla testina',click('#bKey'),{hint:'K'});
 add('Azioni','Mostra / nascondi guide',()=>{const c=$('#cGuide');c.checked=!c.checked;dirty=true},{hint:'G',keywords:'aree sicure'});
 add('Azioni','Scorciatoie da tastiera',click('#bHelp'),{hint:'?'});
 add('Azioni','Nuovo blocco di testo',()=>addBlock(false));add('Azioni','Duplica blocco di testo',()=>addBlock(true));
 Object.keys(FMT).forEach(k=>add('Formato','Formato '+k,()=>{const b=[...$('#fmtSeg').children].find(x=>x.textContent===k);b&&b.click()},{keywords:'proporzioni '+FMT[k].join('x')}));
 [['HD','Qualità HD'],['4K','Qualità 4K']].forEach(([t,n])=>add('Formato',n,()=>{const b=[...$('#resSeg').children].find(x=>x.textContent===t);b&&b.click()}));
 FX.forEach(f=>{const kw=f.c+' '+(f.d||'');
  if(!f.exit)add('Effetti','Entrata: '+f.n,()=>setFx(S.inS,f.id),{fav:{scope:'fx',id:f.id},keywords:kw});
  add('Effetti','Uscita: '+f.n,()=>{S.outMode='custom';setFx(S.outS,f.id);reveal(UI.outSec)},{fav:{scope:'fx',id:f.id},keywords:kw})});
 LOOPS.forEach(l=>{if(l.id==='none')return;add(l.c==='Tracciato'?'Testo su tracciato':'Movimento continuo',l.c==='Tracciato'?l.n:'Movimento continuo: '+l.n,()=>setLoop(l.id),{fav:{scope:'loop',id:l.id},keywords:l.d||''})});
 add('Movimento continuo','Movimento continuo: nessuno',()=>setLoop('none'));
 FONTS.forEach((f,i)=>{if(f.removed)return;add('Font','Font: '+f.n,()=>{S.font=i;fillFonts();syncWeight();loadFonts().then(relayout);relayout()},{fav:{scope:'font',id:f.n},keywords:f.g})});
 add('Azioni','Salva copia dei preferiti (.json)',()=>saveBlob('moto_preferiti.json',new Blob([exportPrefs()],{type:'application/json'})),{keywords:'backup esporta stelle'});
 add('Azioni','Ripristina i preferiti da una copia (.json)',()=>{const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=async()=>{try{importPrefs(await i.files[0].text());toast('Preferiti ripristinati')}catch(e){toast('File dei preferiti non valido')}};i.click()},{keywords:'backup importa stelle'});
 Object.keys(SECS).forEach(t=>add('Vai a','Apri sezione: '+t,()=>reveal(SECS[t])));
 if(nBlocks()>1)for(let i=0;i<nBlocks();i++)add('Blocchi','Vai al blocco '+(i+1)+': '+blockName(i),()=>selectBlock(i));
 WORKSPACES.forEach(w=>add('Area di lavoro','Area di lavoro: '+w.name,()=>LAY.setWorkspace(w.id),{keywords:w.hint+' layout pannelli'}));
 add('Area di lavoro','Mostra / nascondi la libreria',()=>LAY.toggle('lib'),{hint:'[',keywords:'pannello sinistra effetti'});
 add('Area di lavoro','Mostra / nascondi le proprietà',()=>LAY.toggle('insp'),{hint:']',keywords:'pannello destra'});
 add('Area di lavoro','Mostra / nascondi le maniglie sul quadro',()=>{const c=$('#cHand');c.checked=!c.checked;c.onchange()},{hint:'H',keywords:'sposta ridimensiona'});
 [['stile','Stile'],['anim','Animazione'],['grafica','Grafica'],['scena','Scena'],['tempo','Tempo']].forEach(([k,n])=>add('Area di lavoro','Proprietà: scheda '+n,()=>showTab(k)));
 return C}
const PAL=initPalette(buildCommands);
HND=initHandles({host:$('#stageWrap'),canvas:cv,frame:()=>dims(),
 box:()=>{if(!Lay)return null;const[W,H]=dims(),sv=selSvg();let b;if(sv){b=svgBox(sv,t);if(!b)return null}else{const X=blockXfS(S,Lay,t,timing(S),W,H,'block:'+(S.cur||0));b={cx:X.bx,cy:X.by,w:Lay.bw*X.bs,h:Lay.bh*X.bs,rot:X.br}}const P=camAt(S,Lay,t,W,H);if(isIdent(P))return b;const M=camMatrix(P,W,H);return{cx:M[0]*b.cx+M[2]*b.cy+M[4],cy:M[1]*b.cx+M[3]*b.cy+M[5],w:b.w*P.z,h:b.h*P.z,rot:b.rot+P.r}},
 interactive:()=>true,enabled:()=>$('#cHand').checked&&!exporting&&SEL&&actVisible(),
 onStart:()=>{setPlay(false);const es=editState(),sv=selSvg();if(sv&&!es){const fin=sv.mv&&svgMovePart(sv,t)>=.5;HND0={svg:sv,fin,x0:fin?sv.x2:sv.x,y0:fin?sv.y2:sv.y,s0:fin?sv.size2:sv.size};return}if(es){const key=sv?(sv.img?'img:':'svg:')+sv.id:'block:'+(S.cur||0),d=es.d[key]||(es.d[key]={});HND0={st:es,d,d0:full(d)};return}const k=S.block.mode==='keys'?keyHere():null;HND0={ox:S.offX,oy:S.offY,bs:S.bscale||1,k,kx:k&&k.x,ky:k&&k.y,ks:k&&k.s}},
 onMove:(dx0,dy0)=>{const[dx,dy]=camDelta(dx0,dy0);if(HND0.svg){const L=HND0.svg,kx=HND0.fin?'x2':'x',ky=HND0.fin?'y2':'y';L[kx]=round1(HND0.x0+dx);L[ky]=round1(HND0.y0+dy);dirty=true;return`${L.name||(L.img?'Immagine':'SVG')} · ${HND0.fin?(L.lock?'logo completo':'arrivo'):(L.lock?'marchio, inizio':'posizione')} · X ${L[kx]}% · Y ${L[ky]}%`}if(HND0.st){HND0.d.dx=round1(HND0.d0.dx+dx);HND0.d.dy=round1(HND0.d0.dy+dy);dirty=true;return`${HND0.st.name} · X ${HND0.d.dx}% · Y ${HND0.d.dy}%`}if(HND0.k){HND0.k.x=round1(HND0.kx+dx);HND0.k.y=round1(HND0.ky+dy);UI.selKey=HND0.k;dirty=true;drawTimeline();return`Keyframe · X ${HND0.k.x}% · Y ${HND0.k.y}%`}S.offX=clamp(round1(HND0.ox+dx),-100,100);S.offY=clamp(round1(HND0.oy+dy),-100,100);UI.offX&&UI.offX._set(S.offX);UI.offY&&UI.offY._set(S.offY);relayout();return`X ${S.offX}% · Y ${S.offY}%`},
 onScale:f=>{if(HND0.svg){const L=HND0.svg,k=HND0.fin?'size2':'size';L[k]=clamp(+(HND0.s0*f).toFixed(1),1,300);dirty=true;return`${L.name||(L.img?'Immagine':'SVG')} · larghezza ${L[k]}%`}if(HND0.st){HND0.d.s=clamp(+(HND0.d0.s*f).toFixed(3),.05,6);dirty=true;return`${HND0.st.name} · Scala ${Math.round(HND0.d.s*100)}%`}if(HND0.k){HND0.k.s=clamp(+(HND0.ks*f).toFixed(3),.05,6);dirty=true;return`Scala ${Math.round(HND0.k.s*100)}%`}S.bscale=clamp(Math.round(HND0.bs*f*1000)/1000,.05,6);UI.bscale&&UI.bscale._set(S.bscale);dirty=true;return`Scala ${Math.round(S.bscale*100)}%`},
 onEnd:()=>{if(HND0&&HND0.svg)HND0.svg.img?buildImages():buildSvg();else if(HND0&&HND0.st)buildStates();else if(HND0&&HND0.k)buildBlock();histMark()}});
// SVG sul quadro: riquadro di ciò che si vede (il marchio prima del passaggio al logo completo, poi tutto), con stato di layout; in pixel della scena
// livello grafico selezionato sul quadro: SVG o immagine
const selSvg=()=>UI.selSvg?S.layers.find(l=>(l.kind==='svg'||l.img)&&l.id===UI.selSvg)||null:null;
function svgMovePart(L,tt){const tl=tt-(L.start||0);return L.mv?moveT(L,animTime(L.shots,tl),EZ[L.mvEase]):0}
function svgBox(L,tt){const[W,H]=dims();
 if(L.img){if(L.mode==='cover'||!IMGS[L.img])return null;const d=stDelta(S,'img:'+L.id,tt),w=L.size/100*W*d.s,h=w*imgAR(L.img);return{cx:(L.x+d.dx)/100*W,cy:(L.y+d.dy)/100*H,w,h,rot:(L.rot||0)+d.r}}
 const doc=svgDoc(L.src);if(!doc)return null;
 if(L.mode==='fx'){const d=stDelta(S,'svg:'+L.id,tt),w=L.size/100*W*d.s,h=w*doc.vb[3]/doc.vb[2];return{cx:(L.x+d.dx)/100*W,cy:(L.y+d.dy)/100*H,w,h,rot:(L.rot||0)+d.r}}const part=L.lock&&doc.lockup&&svgMovePart(L,tt)<.5?'mark':'all';const b=svgPartBox(L,part,tt,W,H,EZ[L.mvEase]);if(!b)return null;
 const d=stDelta(S,'svg:'+L.id,tt),cx=b[0]+b[2]/2+d.dx/100*W,cy=b[1]+b[3]/2+d.dy/100*H;return{cx,cy,w:b[2]*d.s,h:b[3]*d.s,rot:d.r}}
function hitSvg(px,py,z,tol){const[W,H]=dims(),[x,y]=camInv(px,py);for(let i=S.layers.length-1;i>=0;i--){const L=S.layers[i];if((L.kind!=='svg'&&!L.img)||L.hidden||(z&&L.z!==z))continue;if(t<(L.start||0))continue;if(L.img&&L.end>0&&t>L.end)continue;const b=svgBox(L,t);if(!b)continue;
  const dx=x-b.cx,dy=y-b.cy,a=-b.rot*D2R,rx=dx*Math.cos(a)-dy*Math.sin(a),ry=dx*Math.sin(a)+dy*Math.cos(a);if(Math.abs(rx)<=b.w/2+tol&&Math.abs(ry)<=b.h/2+tol)return L}return null}
// selezione dei blocchi sul quadro: un clic sul testo lo seleziona (e si può subito trascinare), un clic nel vuoto o Esc deseleziona tutto
function deselectAll(){SEL=false;UI.selSvg=null;if(UI.selKey){UI.selKey=null;drawTimeline()}HND&&HND.update()}
// spostamento sullo schermo (in % del quadro) → spostamento nella scena, attraverso zoom e rotazione della camera
function camDelta(dx,dy){const[W,H]=dims(),P=camAt(S,Lay,t,W,H);if(isIdent(P))return[dx,dy];const r=-P.r*D2R,c=Math.cos(r),s=Math.sin(r),px=dx/100*W,py=dy/100*H;return[round1((c*px-s*py)/P.z/W*100),round1((s*px+c*py)/P.z/H*100)]}
function camInv(px,py){const[W,H]=dims(),P=camAt(S,Lay,t,W,H);if(isIdent(P))return[px,py];const M=camMatrix(P,W,H),det=M[0]*M[3]-M[1]*M[2],x=px-M[4],y=py-M[5];return[(M[3]*x-M[2]*y)/det,(-M[1]*x+M[0]*y)/det]}
function hitBlock(px0,py0,tolPx){const[W,H]=dims(),[px,py]=camInv(px0,py0);for(let i=nBlocks()-1;i>=0;i--){const e=i===S.cur?[S,Lay]:(BL[i]?[BL[i].st,BL[i].lay]:null);if(!e)continue;const[st,ly]=e,X=blockXfS(st,ly,t,timing(st),W,H,'block:'+i);
  if(st.loop&&st.loop.fx==='marquee')return i;
  const dx=px-X.bx,dy=py-X.by,a=-X.br*D2R,rx=dx*Math.cos(a)-dy*Math.sin(a),ry=dx*Math.sin(a)+dy*Math.cos(a);
  if(Math.abs(rx)<=ly.bw*X.bs/2+tolPx&&Math.abs(ry)<=ly.bh*X.bs/2+tolPx)return i}return-1}
$('#stageWrap').addEventListener('pointerdown',()=>{UI.area='stage'},true);
// inquadratura sul quadro: con una clip video selezionata nella timeline, trascinando nel vuoto si sceglie cosa si vede, la rotella fa lo zoom
const frameClip=()=>{const c=UI.selClip&&S.seq.clips.find(x=>x.id===UI.selClip);return c&&c.kind==='video'&&!c.adj&&isActive(c,TG())?c:null};
const vidSize=c=>{const v=MED.videoOf(c.media,VSLOT.get(c.id)||0);return v&&v.videoWidth?[v.videoWidth,v.videoHeight]:null};
function panVideo(e,k){const c=frameClip();if(!c)return false;const sz=vidSize(c);if(!sz)return false;const[W,H]=dims(),f=frameFor(c,S.fmt),r0=framedRect(sz[0],sz[1],W,H,c.fit||'cover',f),x0=e.clientX,y0=e.clientY;
 setPlay(false);document.body.classList.add('panning');
 const mv=ev=>{const nx=r0.fx-(ev.clientX-x0)/k/r0.rw,ny=r0.fy-(ev.clientY-y0)/k/r0.rh,r=framedRect(sz[0],sz[1],W,H,c.fit||'cover',{x:nx,y:ny,z:f.z});setFrame(c,{x:r.fx,y:r.fy,z:f.z});dirty=true};
 const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);document.body.classList.remove('panning');buildClipSec();histMark()};
 addEventListener('pointermove',mv);addEventListener('pointerup',up);return true}
let frameTm=0;
$('#stageWrap').addEventListener('wheel',e=>{const c=frameClip();if(!c||exporting)return;const sz=vidSize(c);if(!sz)return;e.preventDefault();const[W,H]=dims(),f=frameFor(c,S.fmt),z=clamp(f.z*Math.exp(-e.deltaY*.0015),.5,4),r=framedRect(sz[0],sz[1],W,H,c.fit||'cover',{...f,z});
 setFrame(c,{x:r.fx,y:r.fy,z});dirty=true;clearTimeout(frameTm);frameTm=setTimeout(()=>{buildClipSec();histMark()},250)},{passive:false});
$('#stageWrap').addEventListener('pointerdown',e=>{if(e.button!==0||exporting||e.target.closest('.hnd-box'))return;
 const r=cv.getBoundingClientRect(),[W,H]=dims();
 if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){deselectAll();return}
 if(!actVisible()){if(panVideo(e,r.width/W))return;deselectAll();return}
 const k=r.width/W,px=(e.clientX-r.left)/k,py=(e.clientY-r.top)/k;let sv=hitSvg(px,py,'above',4/k)||(hitBlock(px,py,6/k)<0?hitSvg(px,py,'below',4/k):null);
 // ⌥ + trascina: si sposta una copia, l'originale resta dov'è
 if(sv&&e.altKey){sv=dupLayer(sv);UI.selSvg=null;histMark();toast('Duplicato')}
 if(sv&&!sv.img){const[sx,sy]=camInv(px,py),lk=lyrAt(sv,sx,sy);if(lk&&lk!==UI.svgLyr){UI.svgLyr=lk;setUI('svgTab','tempi');if(UI.selSvg===sv.id)buildSvg()}}
 if(sv){const was=UI.selSvg;UI.selSvg=sv.id;SEL=true;if(was!==sv.id){const tb=$('#insp').dataset.tab;if(tb!=='grafica'&&tb!=='scena')showTab('grafica');if(sv.img){UI.imgOpen=sv.id;buildImages();reveal(UI.imgSec)}else{UI.svgOpen=sv.id;buildSvg()}}HND.update();HND.beginMove(e);return}
 const i=hitBlock(px,py,6/k);
 if(i<0){if(panVideo(e,k))return;deselectAll();return}
 UI.selSvg=null;if(i!==S.cur)selectBlock(i);else SEL=true;
 if(e.altKey){dupBlockHere();histMark();toast('Blocco duplicato')}
 HND.update();HND.beginMove(e)});
$('#cHand').checked=getUI('hand',true);$('#cHand').onchange=()=>{setUI('hand',$('#cHand').checked);HND.update()};
$('#bCmd').onclick=()=>PAL.toggle();
ensureSeq();normalizeTimeline();initMotionTimeline();buildTop();buildInspector();buildLib();initSeqUI();showLeft(getUI('leftTab','layers'));
LAY=initLayout({main:$('main'),onTab:k=>showTab(k),onResize:()=>{fitStage()}});
relayout();fitStage();setPlay(!matchMedia('(prefers-reduced-motion: reduce)').matches);requestAnimationFrame(tick);
if(window.lucide)lucide.createIcons();
(async()=>{try{const pm=JSON.parse(localStorage.getItem('moto:proj')||'null');if(pm){PROJ.name=pm.name||'Senza titolo';PROJ.key=pm.key||null;PROJ.paths=pm.paths||{};const r=pm.key&&await PF.getRecent(pm.key);if(r)PROJ.handle=r.handle}}catch(e){}updProjTitle();
 await restoreFonts();let d=null;try{d=JSON.parse(localStorage.getItem(AUTOSAVE)||'null')}catch(e){}
 if(d){try{await applyPreset(d,true);toast('Progetto ripristinato dall\'ultima sessione')}catch(e){S=defaults();buildInspector();relayout()}}
 HIST.last=snap();histUI()})();
loadFonts().then(()=>{relayout();buildThumbs()});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{relayout();buildThumbs()});

/* ============================================================ hook di sviluppo (solo server di sviluppo): test di parità */
if (import.meta.env && import.meta.env.DEV) {
  (window).__moto = { motionApi:{TLD,HIST,drawTimeline,addBlock,selectBlock,addKey,copyTimelineKey,pasteTimelineKey,addTimelineMarker,setPreviewEdge,previewBounds,playbackBounds,setTimelineZoom,applyPreset,undo,redo,histCommit,setTime:v=>{t=v;dirty=true;updHead()},getTime:()=>t,getPlaying:()=>playing}, seqApi: { addFiles, addMediaToSeq, renderSeq, activateClip, seqSplit, seqTot, TG, setTG, selectClip, ensureSeq, MED, SA, bufOf, chInfo, seqMix, voiceTL, mixCfg, projectData, loadProjectData, PROJ, snap, cuesNow, selectSub, genSubs, stabAt, stabInfo, STB }, buildStates, mkSvgLayer, svgDoc, addSvg, svgBrandPreset, renderFrame, layout, defaults, mkSlot, timing, clipTotal, dims, relayout, loadFonts, FONTS, uploadFont, exportVideo, exportSeq, setPlay, buildInspector, setLoop, FXMAP, LMAP, FX, LOOPS, G, getS: () => S, setS: (v) => { S = v; } };
}
