import { MATE_CP } from './thresholds';
import type { Color, Score } from './types';

export function scoreToCp(s: Score): number {
  return s.kind === 'cp' ? s.value : Math.sign(s.value) * MATE_CP;
}

/** Chance de vitória (0-100) para centipeões do ponto de vista de quem se avalia. */
export function winPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** win% de `color` dada uma avaliação do ponto de vista das brancas. */
export function moverWin(s: Score, color: Color): number {
  return winPercent(moverCp(s, color));
}

/** cp (mate = ±MATE_CP) do ponto de vista de `color`. */
export function moverCp(s: Score, color: Color): number {
  const cp = scoreToCp(s);
  return color === 'w' ? cp : -cp;
}

/** true só para mate a favor de `color`. */
export function isMateFor(s: Score, color: Color): boolean {
  return s.kind === 'mate' && (color === 'w' ? s.value > 0 : s.value < 0);
}

/** Converte um win% das brancas para o ponto de vista de `color`. */
export function moverPct(whitePct: number, color: Color): number {
  return color === 'w' ? whitePct : 100 - whitePct;
}
