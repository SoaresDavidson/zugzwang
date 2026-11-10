import { Chess } from 'chess.js';

export function parseUci(uci: string): { from: string; to: string; promotion?: string } {
  const move: { from: string; to: string; promotion?: string } = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
  if (uci.length > 4) move.promotion = uci[4];
  return move;
}

/** Destinos legais por casa de origem. FEN inválido: mapa vazio. */
export function legalDests(fen: string): Map<string, string[]> {
  const dests = new Map<string, string[]>();
  try {
    for (const m of new Chess(fen).moves({ verbose: true })) {
      const list = dests.get(m.from) ?? [];
      if (!list.includes(m.to)) list.push(m.to);
      dests.set(m.from, list);
    }
  } catch { /* FEN inválido: sem destinos */ }
  return dests;
}

/** UCI de um lance feito no tabuleiro. Promoção sempre para dama. */
export function uciFromMove(fen: string, from: string, to: string): string {
  try {
    const promo = new Chess(fen).moves({ verbose: true }).some((m) => m.from === from && m.to === to && m.promotion);
    return `${from}${to}${promo ? 'q' : ''}`;
  } catch {
    return `${from}${to}`;
  }
}
