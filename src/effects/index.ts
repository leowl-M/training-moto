import { FX as baseFX } from './transitions';
import { LOOPS as baseLoops } from './loops';
import { extraTransitions, extraLoops } from './studio';

// Gli identificatori dei due progetti restano stabili nei preset e nei file .moto.
export const FX = [...extraTransitions(), ...baseFX];
export const LOOPS = [baseLoops[0], ...extraLoops(), ...baseLoops.slice(1)];
export const FXMAP=Object.fromEntries(FX.map(f=>[f.id,f])),LMAP=Object.fromEntries(LOOPS.map(f=>[f.id,f]));
export const CATS=[...new Set(FX.map(f=>f.c))];
