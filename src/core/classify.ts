import { BRILLIANT_MAX_LOSS, BRILLIANT_MAX_WIN_BEFORE, GREAT_GAP, LOSS, MATE_CP } from './thresholds';
import type { Color, MoveCategory, PositionEval, Score } from './types';
import { moverWin, scoreToCp } from './winPercent';

export interface ClassifyInput {
  color: Color;
  uci: string;
  before: PositionEval;
  after: PositionEval;
  isBook: boolean;
  isSacrifice: boolean;
}

/** cp (mate = ±MATE_CP) do ponto de vista de quem move. */
function moverCp(s: Score, color: Color): number {
  const cp = scoreToCp(s);
  return color === 'w' ? cp : -cp;
}

function isMateForMover(s: Score, color: Color): boolean {
  return s.kind === 'mate' && (color === 'w' ? s.value > 0 : s.value < 0);
}

/** Perda de win% de quem moveu (melhor linha antes menos melhor linha depois), mínimo 0. */
export function moveLoss(i: ClassifyInput): number {
  const before = moverWin(i.before.lines[0].score, i.color);
  const after = moverWin(i.after.lines[0].score, i.color);
  return Math.max(0, before - after);
}

export function classifyMove(i: ClassifyInput): MoveCategory {
  if (i.isBook) return 'book';

  const b0 = i.before.lines[0];
  const a0 = i.after.lines[0];

  if (
    isMateForMover(b0.score, i.color) &&
    !isMateForMover(a0.score, i.color) &&
    moverCp(a0.score, i.color) < MATE_CP
  ) return 'missedMate';

  const loss = moveLoss(i);
  const winBefore = moverWin(b0.score, i.color);

  if (loss <= BRILLIANT_MAX_LOSS && i.isSacrifice && winBefore < BRILLIANT_MAX_WIN_BEFORE) return 'brilliant';

  if (i.uci === b0.move) {
    const second = i.before.lines[1];
    if (second && winBefore - moverWin(second.score, i.color) >= GREAT_GAP) return 'great';
    return 'best';
  }

  if (loss >= LOSS.blunder) return 'blunder';
  if (loss >= LOSS.mistake) return 'mistake';
  if (loss >= LOSS.inaccuracy) return 'inaccuracy';
  if (loss < LOSS.excellent) return 'excellent';
  return 'good';
}
