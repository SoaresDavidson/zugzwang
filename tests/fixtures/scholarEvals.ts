import type { PositionEval } from '../../src/core/types';
import { buildEvals, cp, line, mate } from './fakeEngine';

/** Mate do Pastor: 7 plies. As posições 0-6 têm avaliação; a 7ª (depois de Dxf7#) é mate. */
export const SCHOLAR_SANS = ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'];

export const SCHOLAR = `[Event "a"]
[White "a"]
[Black "b"]
[Result "1-0"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0`;

/**
 * Posições 0-5 por volta de +30. A 5 (antes de 3...Nf6??) tem g7g6 como melhor, +40.
 * A 6 (brancas a jogar) tem h5f7 com mate em 1.
 */
export const SCHOLAR_EVALS: Record<string, PositionEval> = buildEvals(SCHOLAR_SANS, {
  5: [line('g7g6', cp(40)), line('d8e7', cp(30))],
  6: [line('h5f7', mate(1)), line('c4f7', cp(300))],
});
