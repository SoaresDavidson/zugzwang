import { Chess } from 'chess.js';
import { checkRetry } from '../../src/core/retry';
import { parseUci } from '../../src/core/moves';
import { ANALYSE_OPTIONS, GOOD_OR_BETTER } from '../../src/core/thresholds';
import type { PositionEval, Score } from '../../src/core/types';
import { cp, line, scriptedEngine } from '../fixtures/fakeEngine';

const START = new Chess().fen();

function after(fen: string, uci: string): string {
  const chess = new Chess(fen);
  chess.move(parseUci(uci));
  return chess.fen();
}

function evalAt(fen: string, move: string, score: Score): PositionEval {
  return { fen, lines: [line(move, score)] };
}

const BEFORE_START: PositionEval = {
  fen: START,
  lines: [line('e2e4', cp(30)), line('d2d4', cp(25))],
};

describe('checkRetry', () => {
  it('aceita lance bom e recusa ruim', async () => {
    const goodFen = after(START, 'd2d4');
    const badFen = after(START, 'a2a3');
    const engine = scriptedEngine({
      [goodFen]: evalAt(goodFen, 'g8f6', cp(25)),
      [badFen]: evalAt(badFen, 'd7d5', cp(-800)),
    });

    const good = await checkRetry(BEFORE_START, START, 'd2d4', 'w', engine);
    expect(good.accepted).toBe(true);
    expect(GOOD_OR_BETTER).toContain(good.category);

    const bad = await checkRetry(BEFORE_START, START, 'a2a3', 'w', engine);
    expect(bad.category).toBe('blunder');
    expect(bad.accepted).toBe(false);
    expect(engine.calls).toBe(2);
  });

  it('o melhor lance do motor é aceito como best', async () => {
    const fen = after(START, 'e2e4');
    const engine = scriptedEngine({ [fen]: evalAt(fen, 'e7e5', cp(30)) });
    expect(await checkRetry(BEFORE_START, START, 'e2e4', 'w', engine)).toEqual({ category: 'best', accepted: true });
  });

  it('isBook é sempre falso: 1.e4 (livro) volta como best, não book', async () => {
    const fen = after(START, 'e2e4');
    const engine = scriptedEngine({ [fen]: evalAt(fen, 'e7e5', cp(30)) });
    const r = await checkRetry(BEFORE_START, START, 'e2e4', 'w', engine);
    expect(r.category).not.toBe('book');
  });

  it('1.d4 também não vira book, mesmo estando no livro', async () => {
    const fen = after(START, 'd2d4');
    const engine = scriptedEngine({ [fen]: evalAt(fen, 'd7d5', cp(25)) });
    const r = await checkRetry(BEFORE_START, START, 'd2d4', 'w', engine);
    expect(r.category).not.toBe('book');
    expect(r.accepted).toBe(true);
  });

  it('categoria fora de GOOD_OR_BETTER é recusada (imprecisão)', async () => {
    const fen = after(START, 'h2h3');
    const engine = scriptedEngine({ [fen]: evalAt(fen, 'd7d5', cp(-100)) });
    const r = await checkRetry(BEFORE_START, START, 'h2h3', 'w', engine);
    expect(r.category).toBe('inaccuracy');
    expect(r.accepted).toBe(false);
    expect(GOOD_OR_BETTER).not.toContain(r.category);
  });

  it('accepted é exatamente GOOD_OR_BETTER.includes(category)', async () => {
    for (const [uci, score] of [['d2d4', 25], ['h2h3', -100], ['a2a3', -800], ['e2e4', 30]] as const) {
      const fen = after(START, uci);
      const engine = scriptedEngine({ [fen]: evalAt(fen, 'd7d5', cp(score)) });
      const r = await checkRetry(BEFORE_START, START, uci, 'w', engine);
      expect(r.accepted).toBe(GOOD_OR_BETTER.includes(r.category));
    }
  });

  it('analisa a posição depois do lance novo com ANALYSE_OPTIONS e repassa o signal', async () => {
    const fen = after(START, 'd2d4');
    const engine = scriptedEngine({ [fen]: evalAt(fen, 'd7d5', cp(25)) });
    const ac = new AbortController();
    await checkRetry(BEFORE_START, START, 'd2d4', 'w', engine, ac.signal);
    expect(engine.fensSeen).toEqual([fen]);
    expect(engine.optsSeen).toEqual([ANALYSE_OPTIONS]);
    expect(engine.signalsSeen).toEqual([ac.signal]);
  });

  it('funciona para as pretas (avaliação sempre do ponto de vista das brancas)', async () => {
    const fenBefore = after(START, 'e2e4');
    const before: PositionEval = {
      fen: fenBefore,
      lines: [line('e7e5', cp(30)), line('c7c5', cp(35))],
    };
    const okFen = after(fenBefore, 'c7c5');
    const badFen = after(fenBefore, 'f7f6');
    const engine = scriptedEngine({
      [okFen]: evalAt(okFen, 'g1f3', cp(35)),
      [badFen]: evalAt(badFen, 'd1h5', cp(900)),
    });
    const ok = await checkRetry(before, fenBefore, 'c7c5', 'b', engine);
    expect(ok.accepted).toBe(true);
    const bad = await checkRetry(before, fenBefore, 'f7f6', 'b', engine);
    expect(bad.category).toBe('blunder');
    expect(bad.accepted).toBe(false);
  });

  it('propaga a rejeição do motor (abort)', async () => {
    const engine = {
      async analyse(): Promise<PositionEval> {
        throw new DOMException('Aborted', 'AbortError');
      },
    };
    await expect(checkRetry(BEFORE_START, START, 'd2d4', 'w', engine)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
