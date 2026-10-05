// Matematica, numeri casuali ripetibili (hash con seed) e colori. Copiato dall'originale.
export const clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v;
export const lerp=(a,b,t)=>a+(b-a)*t;
export const D2R=Math.PI/180, TAU=Math.PI*2;
export function hash(n){n=(n|0)^0x9e3779b9;n=Math.imul(n^(n>>>16),0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);n^=n>>>16;return (n>>>0)/4294967296}
export const G={E:100,F:0,W:1920,H:1080,seed:7,t:0,lh:100,capH:70,res:1,wght:600,mqP:null as number[]|null,bw:100,blk:null as any,blkInv:null as any,tot:3};
export const R=(u,k)=>hash(u.i*7919+k*104729+G.seed*15485863);
export const RS=(u,k)=>R(u,k)*2-1;
export const HAS_FILTER=typeof CanvasRenderingContext2D!=='undefined'&&'filter' in CanvasRenderingContext2D.prototype;
export function hexRGB(h){h=(h||'#000').replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16)||0;return[(n>>16)&255,(n>>8)&255,n&255]}
export function mixRGB(a,b,t){if(t<=0)return`rgb(${a[0]},${a[1]},${a[2]})`;return`rgb(${Math.round(lerp(a[0],b[0],t))},${Math.round(lerp(a[1],b[1],t))},${Math.round(lerp(a[2],b[2],t))})`}
