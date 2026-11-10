/** Os 4 primeiros campos da FEN (sem contadores de lance). */
export function toEpd(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}
