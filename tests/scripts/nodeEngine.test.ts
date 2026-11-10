import { createNodeEngine } from '../../scripts/nodeEngine';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// 1. f3 e5 2. g4, pretas dão mate com Dh4
const MATE_IN_1 = 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2';

describe('createNodeEngine (stockfish real)', () => {
  it('analisa a posição inicial com multipv 2', async () => {
    const engine = await createNodeEngine();
    try {
      const ev = await engine.analyse(START, { movetimeMs: 200, multipv: 2 });
      expect(ev.fen).toBe(START);
      expect(ev.lines).toHaveLength(2);
      for (const l of ev.lines) {
        expect(l.move).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
        expect(l.pv[0]).toBe(l.move);
      }
      const best = ev.lines[0].score;
      expect(best.kind).toBe('cp');
      // ponto de vista das brancas: posição inicial não é ruim para as brancas
      if (best.kind === 'cp') expect(best.value).toBeGreaterThan(-100);
    } finally {
      engine.quit();
    }
  }, 20_000);

  it('acha mate em 1 das pretas com score do ponto de vista das brancas', async () => {
    const engine = await createNodeEngine();
    try {
      const ev = await engine.analyse(MATE_IN_1, { movetimeMs: 200, multipv: 1 });
      expect(ev.lines[0].move).toBe('d8h4');
      expect(ev.lines[0].score).toEqual({ kind: 'mate', value: -1 });
    } finally {
      engine.quit();
    }
  }, 20_000);

  it('quit() encerra o processo sem travar', async () => {
    const engine = await createNodeEngine();
    await engine.analyse(START, { movetimeMs: 50, multipv: 1 });
    expect(() => engine.quit()).not.toThrow();
  }, 20_000);
});
