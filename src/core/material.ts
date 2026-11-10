import { Chess } from 'chess.js';
import { parseUci } from './moves';
import { PIECE_VALUE, SACRIFICE_MIN, SACRIFICE_WINDOW_PLIES } from './thresholds';
import type { Color } from './types';

function material(chess: Chess, color: Color): number {
  let sum = 0;
  for (const row of chess.board()) {
    for (const sq of row) if (sq && sq.color === color) sum += PIECE_VALUE[sq.type];
  }
  return sum;
}

/** Material de `color` menos o do adversário. */
function balance(chess: Chess, color: Color): number {
  return material(chess, color) - material(chess, color === 'w' ? 'b' : 'w');
}

function play(chess: Chess, uci: string): boolean {
  try {
    chess.move(parseUci(uci));
    return true;
  } catch {
    return false;
  }
}

/** Material de quem moveu depois de `uci` e dos primeiros `plies` lances da PV, menos o material antes. */
export function materialSwing(
  fenBefore: string,
  uci: string,
  pvAfter: string[],
  plies: number = SACRIFICE_WINDOW_PLIES,
): number {
  const chess = new Chess(fenBefore);
  const mover = chess.turn();
  const before = balance(chess, mover);
  if (!play(chess, uci)) return 0;
  for (const m of pvAfter.slice(0, plies)) {
    if (!play(chess, m)) break;
  }
  return balance(chess, mover) - before;
}

export function isSacrifice(fenBefore: string, uci: string, pvAfter: string[]): boolean {
  return materialSwing(fenBefore, uci, pvAfter) <= -SACRIFICE_MIN;
}
