export type Color = 'w' | 'b';

/** Avaliação sempre do ponto de vista das brancas. `mate > 0` = brancas dão mate. */
export type Score = { kind: 'cp'; value: number } | { kind: 'mate'; value: number };

/** Uma linha do motor. `move` e `pv` em UCI. */
export interface EngineLine { move: string; score: Score; pv: string[] }

/** `lines[0]` é a melhor linha. */
export interface PositionEval { fen: string; lines: EngineLine[] }

export type MoveCategory =
  | 'book' | 'brilliant' | 'great' | 'best' | 'excellent' | 'good'
  | 'inaccuracy' | 'mistake' | 'blunder' | 'missedMate';

export interface Ply {
  index: number;
  color: Color;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
}

export interface ParsedGame { headers: Record<string, string>; plies: Ply[] }

export interface Opening { eco: string; name: string }

export interface AnalyzedMove extends Ply {
  category: MoveCategory;
  /** win% de quem moveu, antes e depois do lance. */
  winBefore: number;
  winAfter: number;
  bestUci: string | null;
  bestSan: string | null;
  explanation: string;
}

export type CategoryCounts = Record<MoveCategory, number>;

export interface GameAnalysis {
  key: string;
  headers: Record<string, string>;
  opening: Opening | null;
  moves: AnalyzedMove[];
  evals: PositionEval[];
  accuracy: { w: number; b: number };
  rating: { w: number; b: number };
  counts: { w: CategoryCounts; b: CategoryCounts };
}

export interface AnalyseOptions { movetimeMs: number; multipv: number }

export interface Engine {
  analyse(fen: string, opts: AnalyseOptions, signal?: AbortSignal): Promise<PositionEval>;
}

export type GameErrorCode =
  | 'invalid-pgn' | 'variant-unsupported' | 'custom-position' | 'empty'
  | 'user-not-found' | 'rate-limited' | 'network';

export class GameError extends Error {
  readonly code: GameErrorCode;
  constructor(code: GameErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'GameError';
    this.code = code;
  }
}
