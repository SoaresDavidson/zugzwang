const PIECE_PT: Record<string, string> = { N: 'C', B: 'B', R: 'T', Q: 'D', K: 'R' };

/** Troca as letras das peças do SAN em inglês pelas portuguesas. Roque fica igual. */
export function localizeSan(san: string): string {
  return san.replace(/[NBRQK]/g, (c) => PIECE_PT[c]);
}
