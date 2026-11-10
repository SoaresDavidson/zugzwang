import type { PieceSymbol } from 'chess.js';
import type { AnalyseOptions, MoveCategory } from './types';

/** Sobe a cada mudança de regra de classificação. Invalida o cache. */
export const RULES_VERSION = 1;
export const ENGINE_ID = 'sf19-lite-500ms-mpv2';
export const ANALYSE_OPTIONS: AnalyseOptions = { movetimeMs: 500, multipv: 2 };

/** Centipeões equivalentes a um mate. */
export const MATE_CP = 10000;

/** Perda de win% (ponto de vista de quem moveu) que define cada categoria. */
export const LOSS = { excellent: 2, good: 5, inaccuracy: 10, mistake: 20, blunder: 30 } as const;

/** Diferença mínima de win% entre 1º e 2º lance do motor para "ótimo". */
export const GREAT_GAP = 20;
export const BRILLIANT_MAX_LOSS = 2;
export const BRILLIANT_MAX_WIN_BEFORE = 90;
export const SACRIFICE_MIN = 2;
export const SACRIFICE_WINDOW_PLIES = 4;

/** Regressão linear provisória precisão → rating. Calibrar (Task 15). */
export const RATING = { intercept: -1000, slope: 35, min: 400, max: 3200 } as const;

export const GOOD_OR_BETTER: MoveCategory[] = ['book', 'brilliant', 'great', 'best', 'excellent', 'good'];

/** Valor de material de cada peça, em peões. */
export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
