import { R, TAU, hash } from '../core/math';
import type { ParamDef } from './types';

export const rng=(k,l,min,max,v,st=.01,un='')=>({k,l,t:'r',min,max,v,st,un});
export const sel=(k,l,o,v)=>({k,l,t:'s',o,v});
export const bool=(k,l,v)=>({k,l,t:'b',v});
export const col=(k,l,v)=>({k,l,t:'c',v});
export const DIRS=[['B','Dal basso'],['T','Dall\'alto'],['L','Da sinistra'],['R','Da destra'],['TL','Alto sinistra'],['TR','Alto destra'],['BL','Basso sinistra'],['BR','Basso destra'],['ALT','Alternata'],['RND','Casuale']];
export const DIR4=[['B','Dal basso'],['T','Dall\'alto'],['L','Da sinistra'],['R','Da destra']];
export function dv(d,u){const s=.70710678;switch(d){case'L':return[-1,0];case'R':return[1,0];case'T':return[0,-1];case'B':return[0,1];case'TL':return[-s,-s];case'TR':return[s,-s];case'BL':return[-s,s];case'BR':return[s,s];case'ALT':return u.i%2?[0,-1]:[0,1];default:{const a=R(u,91)*TAU;return[Math.cos(a),Math.sin(a)]}}}
export function pivot(s,w,u){switch(w){case'B':s.py=u.by1;break;case'T':s.py=u.by0;break;case'L':s.px=-u.w/2;break;case'R':s.px=u.w/2;break}}
export const PIV=[['C','Centro'],['B','Base'],['T','Alto'],['L','Sinistra'],['R','Destra']];
export const CHARSETS={AZ:'ABCDEFGHIJKLMNOPQRSTUVWXYZ',n09:'0123456789',sym:'!<>-_\\/[]{}=+*^?#%&',bin:'01',blk:'░▒▓█▚▞▙▟'};
export function rChar(set,seed,orig){const c=set[Math.floor(hash(seed)*set.length)];return (orig&&orig===orig.toLowerCase()&&orig!==orig.toUpperCase())?c.toLowerCase():c}
