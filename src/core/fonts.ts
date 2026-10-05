export interface FontDef { n: string; g: string; css?: string; min: number; max: number; store?: string; removed?: boolean }
export const FONTS: FontDef[]=[
 {n:'Inter Tight',g:'Variabili',min:100,max:900},{n:'Archivo',g:'Variabili',min:100,max:900},{n:'Space Grotesk',g:'Variabili',min:300,max:700},
 {n:'Syne',g:'Variabili',min:400,max:800},{n:'Unbounded',g:'Variabili',min:200,max:900},{n:'Bricolage Grotesque',g:'Variabili',min:200,max:800},
 {n:'Big Shoulders Display',g:'Variabili',min:100,max:900},{n:'Fraunces',g:'Variabili',min:100,max:900},{n:'Playfair Display',g:'Variabili',min:400,max:900},
 {n:'JetBrains Mono',g:'Variabili',min:100,max:800},
 {n:'Archivo Black',g:'Statici',min:400,max:400},{n:'Anton',g:'Statici',min:400,max:400},{n:'Instrument Serif',g:'Statici',min:400,max:400},
 {n:'DM Serif Display',g:'Statici',min:400,max:400},{n:'IBM Plex Mono',g:'Statici',min:300,max:700},
 {n:'Helvetica',g:'Sistema',css:'"Helvetica Neue",Helvetica,Arial,sans-serif',min:100,max:900},
 {n:'Georgia',g:'Sistema',css:'Georgia,"Times New Roman",serif',min:400,max:700},
];
FONTS.forEach(f=>{if(!f.css)f.css=`"${f.n}",system-ui,sans-serif`});
export const fontPool=()=>FONTS.filter(f=>f.g!=='Sistema'&&!f.removed).map(f=>f.css);
export function fontCss(i){return (FONTS[i]||FONTS[0]).css}
export function fontStr(S,fam,w){return`${S.italic?'italic ':''}${Math.round(w??S.wght)} ${S.fs}px ${fam||fontCss(S.font)}`}
