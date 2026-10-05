import { TAU } from './math';

export const bOut=t=>{const n=7.5625,d=2.75;if(t<1/d)return n*t*t;if(t<2/d)return n*(t-=1.5/d)*t+.75;if(t<2.5/d)return n*(t-=2.25/d)*t+.9375;return n*(t-=2.625/d)*t+.984375};
export const EZ={
 linear:t=>t,
 inSine:t=>1-Math.cos(t*Math.PI/2),outSine:t=>Math.sin(t*Math.PI/2),inOutSine:t=>-(Math.cos(Math.PI*t)-1)/2,
 inQuad:t=>t*t,outQuad:t=>1-(1-t)**2,inOutQuad:t=>t<.5?2*t*t:1-(-2*t+2)**2/2,
 inCubic:t=>t**3,outCubic:t=>1-(1-t)**3,inOutCubic:t=>t<.5?4*t**3:1-(-2*t+2)**3/2,
 inQuart:t=>t**4,outQuart:t=>1-(1-t)**4,inOutQuart:t=>t<.5?8*t**4:1-(-2*t+2)**4/2,
 inQuint:t=>t**5,outQuint:t=>1-(1-t)**5,inOutQuint:t=>t<.5?16*t**5:1-(-2*t+2)**5/2,
 inExpo:t=>t===0?0:2**(10*t-10),outExpo:t=>t===1?1:1-2**(-10*t),inOutExpo:t=>t===0?0:t===1?1:t<.5?2**(20*t-10)/2:(2-2**(-20*t+10))/2,
 inCirc:t=>1-Math.sqrt(1-t*t),outCirc:t=>Math.sqrt(1-(t-1)**2),inOutCirc:t=>t<.5?(1-Math.sqrt(1-(2*t)**2))/2:(Math.sqrt(1-(-2*t+2)**2)+1)/2,
 inBack:t=>2.70158*t**3-1.70158*t*t,outBack:t=>1+2.70158*(t-1)**3+1.70158*(t-1)**2,
 inOutBack:t=>{const c=1.70158*1.525;return t<.5?((2*t)**2*((c+1)*2*t-c))/2:((2*t-2)**2*((c+1)*(t*2-2)+c)+2)/2},
 inElastic:t=>t===0?0:t===1?1:-(2**(10*t-10))*Math.sin((t*10-10.75)*(TAU/3)),
 outElastic:t=>t===0?0:t===1?1:2**(-10*t)*Math.sin((t*10-.75)*(TAU/3))+1,
 inBounce:t=>1-bOut(1-t),outBounce:bOut,
};
export const EZ_LIST=[['fx','Consigliata dall\'effetto'],['linear','Lineare'],['outSine','Out Sine'],['inOutSine','In-Out Sine'],['outQuad','Out Quad'],['inOutQuad','In-Out Quad'],['outCubic','Out Cubic'],['inOutCubic','In-Out Cubic'],['outQuart','Out Quart'],['inOutQuart','In-Out Quart'],['outQuint','Out Quint'],['inOutQuint','In-Out Quint'],['outExpo','Out Expo'],['inOutExpo','In-Out Expo'],['outCirc','Out Circ'],['inOutCirc','In-Out Circ'],['outBack','Out Back (rimbalzo leggero)'],['inOutBack','In-Out Back'],['outElastic','Out Elastic'],['outBounce','Out Bounce'],['inSine','In Sine'],['inCubic','In Cubic'],['inQuart','In Quart'],['inExpo','In Expo'],['inBack','In Back'],['inElastic','In Elastic'],['inBounce','In Bounce']];
