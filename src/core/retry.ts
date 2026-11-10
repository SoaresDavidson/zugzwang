import { Chess } from 'chess.js';
import { classifyMove } from './classify';
import { isSacrifice } from './material';
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
): Promise<{ category: MoveCategory; accepted: boolean }> {
  const chess = new Chess(fenBefore);
  chess.move(parseUci(uci));
  const after = await engine.analyse(chess.fen(), ANALYSE_OPTIONS, signal);
  const category = classifyMove({
    color,
    uci,
    before,
    after,
    isBook: false,
    isSacrifice: isSacrifice(fenBefore, uci, after.lines[0]?.pv ?? []),
  });
  return { category, accepted: GOOD_OR_BETTER.includes(category) };
}
