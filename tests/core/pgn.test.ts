import { parsePgn } from '../../src/core/pgn';
import { GameError } from '../../src/core/types';
import type { GameErrorCode } from '../../src/core/types';

function expectCode(fn: () => unknown, code: GameErrorCode) {
  let caught: unknown;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(GameError);
  expect((caught as GameError).code).toBe(code);
}

const SCHOLAR = '[White "a"]\n[Black "b"]\n[Result "1-0"]\n\n1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0';

it('extrai plies com FEN antes/depois e UCI', () => {
  const g = parsePgn(SCHOLAR);
  expect(g.plies).toHaveLength(7);
  expect(g.plies[0]).toMatchObject({ index: 0, color: 'w', san: 'e4', uci: 'e2e4' });
  expect(g.plies[0].fenBefore).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  expect(g.plies[6].uci).toBe('h5f7');
  expect(g.headers.White).toBe('a');
});

it('usa só o primeiro jogo de vários colados', () => {
  expect(parsePgn(SCHOLAR + '\n\n' + SCHOLAR.replace('"a"', '"c"')).headers.White).toBe('a');
});

it('ignora comentários, relógio, NAGs, variações e CRLF', () => {
  const dirty = '[Result "*"]\r\n\r\n1. e4 { [%clk 0:03:00] } e5 $1 (1... c5 2. Nf3) 2. Nf3 *';
  expect(parsePgn(dirty).plies.map(p => p.san)).toEqual(['e4', 'e5', 'Nf3']);
});

it('recusa 960', () => expectCode(() => parsePgn('[Variant "Chess960"]\n\n1. e4 *'), 'variant-unsupported'));
it('recusa posição customizada', () =>
  expectCode(() => parsePgn('[SetUp "1"]\n[FEN "8/8/8/8/8/8/8/K6k w - - 0 1"]\n\n1. Kb1 *'), 'custom-position'));
it('recusa partida sem lances', () => expectCode(() => parsePgn('[White "a"]\n\n*'), 'empty'));
it('recusa lixo', () => expectCode(() => parsePgn('isso não é pgn'), 'invalid-pgn'));
it('recusa lance ilegal', () => expectCode(() => parsePgn('1. e5 *'), 'invalid-pgn'));

// Casos de borda coerentes com a SPEC e a Review Focus 2.
it('encadeia fenAfter de um ply em fenBefore do seguinte e alterna as cores', () => {
  const { plies } = parsePgn(SCHOLAR);
  plies.forEach((p, i) => {
    expect(p.index).toBe(i);
    expect(p.color).toBe(i % 2 === 0 ? 'w' : 'b');
    if (i > 0) expect(p.fenBefore).toBe(plies[i - 1].fenAfter);
  });
  expect(plies[0].fenAfter).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
});

it('aceita Variant "Standard"', () => {
  expect(parsePgn('[Variant "Standard"]\n\n1. e4 e5 *').plies).toHaveLength(2);
});

it('PGN sujo com vários jogos e CRLF usa a linha principal do primeiro', () => {
  const g1 = '[Event "x"]\r\n[White "a"]\r\n\r\n1. e4 { [%clk 0:03:00] } e5 $1 (1... c5 2. Nf3) 2. Nf3 *';
  const g2 = '[Event "y"]\r\n[White "c"]\r\n\r\n1. d4 d5 *';
  const g = parsePgn(g1 + '\r\n\r\n' + g2);
  expect(g.headers.White).toBe('a');
  expect(g.plies.map(p => p.san)).toEqual(['e4', 'e5', 'Nf3']);
});
