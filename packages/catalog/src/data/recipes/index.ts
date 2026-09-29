import { hot } from './hot.ts';
import { long } from './long.ts';
import { shaken } from './shaken.ts';
import { stirred } from './stirred.ts';
import { zeroProof } from './zero-proof.ts';

export const recipes = [...stirred, ...shaken, ...long, ...hot, ...zeroProof];
