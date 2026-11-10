import { Chess } from 'chess.js';
import { terminalEval } from './analyzeGame';
import { classifyPly } from './classify';
import { parseUci } from './moves';
import { ANALYSE_OPTIONS, GOOD_OR_BETTER } from './thresholds';
import type { Color, Engine, MoveCategory, PositionEval } from './types';

export async function checkRetry(
  before: PositionEval,
  fenBefore: string,
  uci: string,
  color: Color,
  engine: Engine,
  signal?: AbortSignal,
): Promise<{ category: MoveCategory | null; accepted: boolean }> {
  const chess = new Chess(fenBefore);
  try {
    chess.move(parseUci(uci));
  } catch {
    return { category: null, accepted: false };
  }
  const fenAfter = chess.fen();
  const after = terminalEval(fenAfter) ?? (await engine.analyse(fenAfter, ANALYSE_OPTIONS, signal));
  const category = classifyPly({ color, uci, fenBefore, before, after, isBook: false });
  return { category, accepted: GOOD_OR_BETTER.includes(category) };
}
