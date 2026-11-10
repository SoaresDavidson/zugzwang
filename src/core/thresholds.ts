import type { PieceSymbol } from 'chess.js';
import type { AnalyseOptions, MoveCategory } from './types';

/** Sobe a cada mudança de regra de classificação. Invalida o cache. */
export const RULES_VERSION = 1;
export const ENGINE_FILE_MULTI = 'stockfish-19-lite.js';
export const ENGINE_FILE_SINGLE = 'stockfish-19-lite-single.js';
export const ANALYSE_OPTIONS: AnalyseOptions = { movetimeMs: 500, multipv: 2 };
export const ENGINE_ID = `${ENGINE_FILE_MULTI.replace(/\.js$/, '')}-${ANALYSE_OPTIONS.movetimeMs}ms-mpv${ANALYSE_OPTIONS.multipv}`;

/** Configuração do motor. */
export const ENGINE_HANDSHAKE_TIMEOUT_MS = 10_000;
export const ENGINE_HASH_MB = 32;
export const ENGINE_MAX_THREADS = 4;

/** Máximo de partidas devolvidas por busca de usuário. */
export const MAX_GAMES = 50;

/** Limiares das conquistas. */
export const ACHIEVEMENT_RULES = {
  reviewsForTen: 10,
  monthBrilliants: 5,
  surgicalAccuracy: 90,
  cleanGameMoves: 20,
  streakAccuracy: 80,
  streakLength: 3,
} as const;

/** Centipeões equivalentes a um mate. */
export const MATE_CP = 10000;

/** Perda de win% (ponto de vista de quem moveu) que define cada categoria. */
export const LOSS = { excellent: 2, good: 5, inaccuracy: 10, mistake: 20, blunder: 30 } as const;

/** Diferença mínima de win% entre 1º e 2º lance do motor para "ótimo". */
export const GREAT_GAP = 20;
/** Win% máximo (ponto de vista de quem move) da segunda linha para o lance ser "ótimo"; acima disso as alternativas ainda ganham. Calibrar na Task 15. */
export const GREAT_MAX_SECOND_WIN = 70;
export const BRILLIANT_MAX_LOSS = 2;
export const BRILLIANT_MAX_WIN_BEFORE = 90;
export const SACRIFICE_MIN = 2;
export const SACRIFICE_WINDOW_PLIES = 4;

/** Regressão linear provisória precisão → rating. Calibrar (Task 15). */
export const RATING = { intercept: -1000, slope: 35, min: 400, max: 3200 } as const;

export const GOOD_OR_BETTER: MoveCategory[] = ['book', 'brilliant', 'great', 'best', 'excellent', 'good'];

/** Valor de material de cada peça, em peões. */
export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
