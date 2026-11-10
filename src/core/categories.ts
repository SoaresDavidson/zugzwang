import type { AnalyzedMove, MoveCategory } from './types';

export interface CategoryPolicy {
  /** Oferece "Tentar de novo". */
  retryable: boolean;
  /** Oferece "Mostrar melhor". */
  showBest: boolean;
  /** Ganha marcador no gráfico. */
  markOnGraph: boolean;
  /** Ordena a escolha do lance inicial: maior primeiro. */
  severity: number;
}

const p = (retryable: boolean, showBest: boolean, markOnGraph: boolean, severity: number): CategoryPolicy =>
  ({ retryable, showBest, markOnGraph, severity });

export const CATEGORY_POLICY: Record<MoveCategory, CategoryPolicy> = {
  book: p(false, false, false, 0),
  brilliant: p(false, false, true, 0),
  great: p(false, false, true, 0),
  best: p(false, false, false, 0),
  excellent: p(false, true, false, 0),
  good: p(false, true, false, 0),
  inaccuracy: p(true, true, false, 1),
  mistake: p(true, true, true, 3),
  blunder: p(true, true, true, 4),
  missedMate: p(true, true, true, 2),
};

/** Lance aberto ao carregar a revisão: o primeiro do maior grau de severidade; sem erros, o último. */
export function initialMoveIndex(moves: ReadonlyArray<Pick<AnalyzedMove, 'category'>>): number {
  let found = -1;
  let top = 0;
  moves.forEach((m, i) => {
    const s = CATEGORY_POLICY[m.category].severity;
    if (s > top) { found = i; top = s; }
  });
  return found >= 0 ? found : Math.max(0, moves.length - 1);
}
