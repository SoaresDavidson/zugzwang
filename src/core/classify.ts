import { isSacrifice } from './material';
import { BRILLIANT_MAX_LOSS, BRILLIANT_MAX_WIN_BEFORE, GREAT_GAP, GREAT_MAX_SECOND_WIN, LOSS, MATE_CP } from './thresholds';
import type { Color, MoveCategory, PositionEval } from './types';
import { isMateFor, moverCp, moverWin } from './winPercent';

export interface ClassifyInput {
  color: Color;
  uci: string;
  before: PositionEval;
  after: PositionEval;
  isBook: boolean;
  isSacrifice: boolean;
}

/** Perda de win% de quem moveu (melhor linha antes menos melhor linha depois), mínimo 0. */
export function moveLoss(i: ClassifyInput): number {
  const before = moverWin(i.before.lines[0].score, i.color);
  const after = moverWin(i.after.lines[0].score, i.color);
  return Math.max(0, before - after);
}

export interface ClassifyPlyInput {
  color: Color;
  uci: string;
  fenBefore: string;
  before: PositionEval;
  after: PositionEval;
  isBook: boolean;
}

/** Classifica um ply: o sinal de sacrifício vem da linha principal depois do lance. */
export function classifyPly(i: ClassifyPlyInput): MoveCategory {
  return classifyMove({
    color: i.color,
    uci: i.uci,
    before: i.before,
    after: i.after,
    isBook: i.isBook,
    isSacrifice: isSacrifice(i.fenBefore, i.uci, i.after.lines[0]?.pv ?? []),
  });
}

export function classifyMove(i: ClassifyInput): MoveCategory {
  if (i.isBook) return 'book';

  const bestBefore = i.before.lines[0];
  const bestAfter = i.after.lines[0];

  if (
    isMateFor(bestBefore.score, i.color) &&
    !isMateFor(bestAfter.score, i.color) &&
    moverCp(bestAfter.score, i.color) < MATE_CP
  ) return 'missedMate';

  const loss = moveLoss(i);
  const winBefore = moverWin(bestBefore.score, i.color);

  if (loss <= BRILLIANT_MAX_LOSS && i.isSacrifice && winBefore < BRILLIANT_MAX_WIN_BEFORE) return 'brilliant';

  if (i.uci === bestBefore.move) {
    const second = i.before.lines[1];
    if (second) {
      const secondWin = moverWin(second.score, i.color);
      if (winBefore - secondWin >= GREAT_GAP && secondWin < GREAT_MAX_SECOND_WIN) return 'great';
    }
    return 'best';
  }

  if (loss >= LOSS.blunder) return 'blunder';
  if (loss >= LOSS.mistake) return 'mistake';
  if (loss >= LOSS.inaccuracy) return 'inaccuracy';
  if (loss < LOSS.excellent) return 'excellent';
  return 'good';
}
