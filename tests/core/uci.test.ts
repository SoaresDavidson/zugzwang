import { parseUciInfo } from '../../src/core/uci';

describe('parseUciInfo', () => {
  it('converte score das pretas para o ponto de vista das brancas', () =>
    expect(parseUciInfo('info depth 12 multipv 1 score cp 35 nodes 1 pv e7e5 g1f3', 'b')).toEqual({
      multipv: 1, depth: 12, score: { kind: 'cp', value: -35 }, pv: ['e7e5', 'g1f3'],
    }));

  it('mantém o score das brancas', () =>
    expect(parseUciInfo('info depth 12 multipv 1 score cp 35 pv e2e4', 'w')!.score).toEqual({ kind: 'cp', value: 35 }));

  it('mate', () =>
    expect(parseUciInfo('info depth 5 multipv 2 score mate -2 pv a1a2', 'w')!.score).toEqual({ kind: 'mate', value: -2 }));

  it('mate com pretas a mover inverte o sinal (mate 3 vira mate -3)', () =>
    expect(parseUciInfo('info depth 9 multipv 1 score mate 3 pv a1a2', 'b')!.score).toEqual({ kind: 'mate', value: -3 }));

  it('ignora linha sem pv', () => expect(parseUciInfo('info depth 1 currmove e2e4', 'w')).toBeNull());

  it('ignora linha com pv mas sem score', () =>
    expect(parseUciInfo('info depth 1 multipv 1 pv e2e4', 'w')).toBeNull());

  it('ignora linha com score mas sem pv', () =>
    expect(parseUciInfo('info depth 1 multipv 1 score cp 10', 'w')).toBeNull());

  it('info string vira null, mesmo contendo palavras-chave', () => {
    expect(parseUciInfo('info string NNUE evaluation using nn-abc.nnue', 'w')).toBeNull();
    expect(parseUciInfo('info string score cp 10 pv e2e4', 'w')).toBeNull();
  });

  it('mate 0 com pretas a mover: pretas estão em mate, vira cp +10000', () =>
    expect(parseUciInfo('info depth 1 multipv 1 score mate 0 pv a1a1', 'b')!.score).toEqual({ kind: 'cp', value: 10000 }));

  it('mate 0 com brancas a mover: brancas estão em mate, vira cp -10000', () =>
    expect(parseUciInfo('info depth 1 multipv 1 score mate 0 pv a1a1', 'w')!.score).toEqual({ kind: 'cp', value: -10000 }));

  it('nunca devolve mate 0', () => {
    for (const side of ['w', 'b'] as const) {
      const r = parseUciInfo('info depth 1 score mate 0 pv a1a1', side)!;
      expect(r.score.kind === 'mate' && r.score.value === 0).toBe(false);
    }
  });

  // Decisão: lowerbound/upperbound são aceitos e o valor é usado como está.
  it('score cp com lowerbound é aceito e usa o valor', () =>
    expect(parseUciInfo('info depth 10 multipv 1 score cp 42 lowerbound nodes 5 pv e2e4', 'w')!.score)
      .toEqual({ kind: 'cp', value: 42 }));

  it('score cp com upperbound é aceito e usa o valor (pretas invertem)', () =>
    expect(parseUciInfo('info depth 10 multipv 1 score cp 42 upperbound nodes 5 pv e7e5', 'b')!.score)
      .toEqual({ kind: 'cp', value: -42 }));

  it('multipv ausente vale 1', () =>
    expect(parseUciInfo('info depth 8 score cp 0 pv e2e4', 'w')!.multipv).toBe(1));

  it('pv com promoção', () =>
    expect(parseUciInfo('info depth 20 multipv 1 score cp 900 pv a7a8q h2h1n', 'w')!.pv).toEqual(['a7a8q', 'h2h1n']));

  it('campos depois do pv fazem parte do pv', () =>
    expect(parseUciInfo('info depth 3 multipv 2 score cp -5 nodes 100 nps 9 time 3 pv d2d4 d7d5 c2c4', 'w')).toEqual({
      multipv: 2, depth: 3, score: { kind: 'cp', value: -5 }, pv: ['d2d4', 'd7d5', 'c2c4'],
    }));
});
