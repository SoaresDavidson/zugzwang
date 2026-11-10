import { Chess } from 'chess.js';
import { isBookFen, lookupOpening, toEpd } from '../../src/core/openings';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function fenAfter(sans: string): string {
  const chess = new Chess();
  for (const san of sans.split(/\s+/)) chess.move(san);
  return chess.fen();
}

describe('toEpd', () => {
  it('mantém só os 4 primeiros campos da FEN', () =>
    expect(toEpd(START)).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'));
  it('descarta contadores de lance', () =>
    expect(toEpd('r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3')).toBe(
      'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -',
    ));
});

describe('lookupOpening', () => {
  it('Ruy Lopez', () =>
    expect(lookupOpening('r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3')).toEqual({
      eco: 'C60',
      name: 'Ruy Lopez',
    }));
  it("1. e4 é King's Pawn Game (B00)", () =>
    expect(lookupOpening(fenAfter('e4'))).toEqual({ eco: 'B00', name: "King's Pawn Game" }));
  it('1. e4 c5 é Sicilian Defense (B20)', () =>
    expect(lookupOpening(fenAfter('e4 c5'))).toEqual({ eco: 'B20', name: 'Sicilian Defense' }));
  it('ignora contadores de lance', () =>
    expect(lookupOpening('r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 99 42')).toEqual({
      eco: 'C60',
      name: 'Ruy Lopez',
    }));
  it('posição fora do livro', () => expect(lookupOpening('8/8/8/8/8/8/8/K6k w - - 0 1')).toBeNull());
  it('posição inicial não é abertura', () => expect(lookupOpening(START)).toBeNull());

  // Cobertura do JSON gerado (> 3000 posições) via comportamento observável:
  // uma abertura conhecida de cada letra ECO, confirmadas nas tabelas do lichess.
  it.each([
    ['A04', 'Zukertort Opening', 'Nf3'],
    ['A10', 'English Opening', 'c4'],
    ['C42', "Petrov's Defense", 'e4 e5 Nf3 Nf6'],
    ['D06', "Queen's Gambit", 'd4 d5 c4'],
    ['E70', "King's Indian Defense: Normal Variation", 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6'],
  ])('livro cobre %s (%s)', (eco, name, sans) =>
    expect(lookupOpening(fenAfter(sans))).toEqual({ eco, name }));
});

describe('isBookFen', () => {
  it('ignora contadores de lance', () =>
    expect(isBookFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')).toBe(true));
  it('posição fora do livro', () => expect(isBookFen('8/8/8/8/8/8/8/K6k w - - 0 1')).toBe(false));
});
