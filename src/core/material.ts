import { Chess } from 'chess.js';
import type { PieceSymbol } from 'chess.js';
import { SACRIFICE_MIN, SACRIFICE_WINDOW_PLIES } from './thresholds';

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function material(chess: Chess, color: 'w' | 'b'): number {
  let sum = 0;
  for (const row of chess.board()) {
    for (const sq of row) if (sq && sq.color === color) sum += VALUE[sq.type];
  }
  return sum;
}

function play(chess: Chess, uci: string): boolean {
  try {
    chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    });
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
  const before = material(chess, mover) - material(chess, mover === 'w' ? 'b' : 'w');
  if (!play(chess, uci)) return 0;
  for (const m of pvAfter.slice(0, plies)) {
    if (!play(chess, m)) break;
  }
  return material(chess, mover) - material(chess, mover === 'w' ? 'b' : 'w') - before;
}

export function isSacrifice(fenBefore: string, uci: string, pvAfter: string[]): boolean {
  return materialSwing(fenBefore, uci, pvAfter) <= -SACRIFICE_MIN;
}
