import { G, hash, clamp } from '../core/math';
import { rChar, CHARSETS } from './params';
import { fontPool } from '../core/fonts';

export function scrHook(c,j,len,p,u,o){if(c===' ')return;const settle=len<=1?.9:.1+.85*(j/(len-1));if(p>=settle)return;const k=Math.floor(G.F/o.rate);return{g:rChar(CHARSETS[o.set],u.i*977+j*131+k*7+G.seed*3,c),b:o.colB}}
export function fontHook(c,j,len,p,u,o){if(p>=1-o.hold)return;const k=Math.floor(G.F/o.rate),pool=fontPool();return{font:pool[Math.floor(hash(u.i*31+j*17+k*11+G.seed)*pool.length)]}}
export function flapHook(c,j,len,kk,u,o){if(c===' ')return;return{g:rChar(CHARSETS[o.set],u.i*613+j*29+kk*47+G.seed,c)}}
export function rainHook(c,j,len,p,u,o){if(c===' '||p>.9)return;const k=Math.floor(G.F/o.rate);return{g:rChar(CHARSETS[o.set],u.i*419+j*61+k*13+G.seed,c),b:o.colB}}
export function cntHook(c,j,len,p,u,o){const st=Math.round(clamp(1-p)*(o.spins*10+j));if(!st)return;if(/[0-9]/.test(c))return{g:String((((+c-st)%10)+10)%10)};const up=/[A-Z]/.test(c);if(!up&&!/[a-z]/.test(c))return;const b=up?65:97;return{g:String.fromCharCode(b+(((c.charCodeAt(0)-b-st)%26)+26)%26)}}
export function blkHook(c,j,len,p,u,o){if(c===' ')return;const st=Math.round(o.steps),kk=Math.floor(clamp(1-p+(hash(u.i*11+j*7+G.seed)-.5)*.3)*(st+1));if(kk<=0)return;return{g:'░▒▓█'[Math.min(3,kk-1+4-st)],b:o.colB}}
export function tgHook(c,j,len,e,u,o){const k=Math.floor(G.t*o.hz);if(hash(u.i*71+j*13+k*29+G.seed)<o.prob*e)return{g:rChar(CHARSETS[o.set],u.i*3+j*7+k,c)}}
