import { G, hash } from '../core/math';

export function fall(tt,v0,g,d,rest){let t=tt,y=0,v=v0,first=-1,lastI=-1,lastV=0;if(g<=0||d===Infinity)return{y:v*t+.5*g*t*t,first,lastI,lastV};
 for(let k=0;k<30;k++){const th=(-v+Math.sqrt(Math.max(0,v*v+2*g*(d-y))))/g;if(t<=th)return{y:y+v*t+.5*g*t*t,first,lastI,lastV};
  const vi=v+g*th;y=d;t-=th;lastI=tt-t;lastV=vi;if(first<0)first=lastI;v=-vi*rest;if(Math.abs(v)<g*.012)return{y:d,first,lastI,lastV}}return{y:d,first,lastI,lastV}}
export function floorD(u,o){return o.floor==='none'?Infinity:Math.max(0,G.H*o.fl/100-(u.fy+u.by1))}
export const PIECES: Map<string, any[]> = new Map();
export function pieces(u,n){n=Math.round(n);const key=`${u.i}|${n}|${u.w.toFixed(1)}|${u.by0.toFixed(1)}|${u.by1.toFixed(1)}|${G.seed}`;let P:any=PIECES.get(key);if(P)return P;
 const x0=-u.w/2-G.E*.06,x1=u.w/2+G.E*.06,y0=u.by0,y1=u.by1,w=x1-x0,h=y1-y0;const cols=Math.max(1,Math.round(Math.sqrt(n/2*w/h))),rows=Math.max(1,Math.round(n/2/cols));
 const V:any[]=[];for(let r=0;r<=rows;r++){V[r]=[];for(let c=0;c<=cols;c++){let x=x0+w*c/cols,y=y0+h*r/rows;if(c>0&&c<cols)x+=(hash(u.i*97+r*31+c*7+G.seed)-.5)*w/cols*.75;if(r>0&&r<rows)y+=(hash(u.i*89+r*13+c*17+G.seed+5)-.5)*h/rows*.75;V[r][c]=[x,y]}}
 P=[];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const a=V[r][c],b=V[r][c+1],cc=V[r+1][c+1],d=V[r+1][c];const tr2=hash(u.i*5+r*3+c+G.seed)<.5?[[a,b,cc],[a,cc,d]]:[[a,b,d],[b,cc,d]];for(const tr of tr2)P.push({poly:tr,cx:(tr[0][0]+tr[1][0]+tr[2][0])/3,cy:(tr[0][1]+tr[1][1]+tr[2][1])/3,k:P.length})}
 if(PIECES.size>3000)PIECES.clear();PIECES.set(key,P);return P}
