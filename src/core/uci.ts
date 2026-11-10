import { MATE_CP } from './thresholds';
import type { Color, Score } from './types';

export interface UciInfo { multipv: number; depth: number; score: Score; pv: string[] }

/** Converte uma linha `info` do motor. Score no ponto de vista das brancas. */
export function parseUciInfo(line: string, sideToMove: Color): UciInfo | null {
  const t = line.trim().split(/\s+/);
  if (t[0] !== 'info' || t[1] === 'string') return null;
  const sign = sideToMove === 'w' ? 1 : -1;
  const flip = (n: number) => (n === 0 ? 0 : n * sign);
  let multipv = 1;
  let depth = 0;
  let score: Score | null = null;
  let pv: string[] | null = null;
  for (let i = 1; i < t.length; i++) {
    const k = t[i];
    if (k === 'pv') { pv = t.slice(i + 1); break; }
    if (k === 'multipv') multipv = Number(t[++i]);
    else if (k === 'depth') depth = Number(t[++i]);
    else if (k === 'score') {
      const kind = t[++i];
      const v = Number(t[++i]);
      if (Number.isNaN(v)) return null;
      if (kind === 'cp') score = { kind: 'cp', value: flip(v) };
      else if (kind === 'mate') {
        // mate 0: o lado a mover já está em mate. Nunca devolver mate 0.
        score = v === 0 ? { kind: 'cp', value: -sign * MATE_CP } : { kind: 'mate', value: flip(v) };
      } else return null;
    }
  }
  if (!score || !pv || pv.length === 0) return null;
  return { multipv, depth, score, pv };
}
