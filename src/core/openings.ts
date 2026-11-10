import type { Opening } from './types';
import book from './data/openings.json';

const BOOK = book as unknown as Record<string, [string, string]>;

/** Os 4 primeiros campos da FEN (sem contadores de lance). */
export function toEpd(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

export function lookupOpening(fen: string): Opening | null {
  const hit = BOOK[toEpd(fen)];
  return hit ? { eco: hit[0], name: hit[1] } : null;
}

export function isBookFen(fen: string): boolean {
  return toEpd(fen) in BOOK;
}
