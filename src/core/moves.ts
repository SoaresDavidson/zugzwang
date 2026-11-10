export function parseUci(uci: string): { from: string; to: string; promotion?: string } {
  const move: { from: string; to: string; promotion?: string } = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
  if (uci.length > 4) move.promotion = uci[4];
  return move;
}
