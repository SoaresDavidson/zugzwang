import type { Opening } from './types';
import book from './data/openings.json';
import { toEpd } from './epd';

export { toEpd } from './epd';

const BOOK = book as unknown as Record<string, [string, string]>;

export function lookupOpening(fen: string): Opening | null {
  const hit = BOOK[toEpd(fen)];
  return hit ? { eco: hit[0], name: hit[1] } : null;
}

export function isBookFen(fen: string): boolean {
  return toEpd(fen) in BOOK;
}
