import { createHash } from 'node:crypto';
import { Chess } from 'chess.js';
import { analyzeGame, cacheKey, terminalEval } from '../../src/core/analyzeGame';
import { estimateRating, gameAccuracy } from '../../src/core/accuracy';
import { explainMove } from '../../src/core/explain';
import { parseUci } from '../../src/core/moves';
import { lookupOpening } from '../../src/core/openings';
import { parsePgn } from '../../src/core/pgn';
import { ANALYSE_OPTIONS, ENGINE_ID, MATE_CP, RULES_VERSION } from '../../src/core/thresholds';
import type { AnalysisProgress } from '../../src/core/analyzeGame';
import type { MoveCategory } from '../../src/core/types';
import { moverWin, scoreToCp, winPercent } from '../../src/core/winPercent';
import { buildEvals, scriptedEngine } from '../fixtures/fakeEngine';
import { SCHOLAR, SCHOLAR_EVALS } from '../fixtures/scholarEvals';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function fenAfter(sans: string): string {
  const chess = new Chess();
  for (const san of sans.split(/\s+/)) chess.move(san);
  return chess.fen();
}

describe('terminalEval', () => {
  it('brancas dão mate: cp +MATE_CP', () => {
    const fen = fenAfter('e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#');
    const e = terminalEval(fen)!;
    expect(e).not.toBeNull();
    expect(e.fen).toBe(fen);
    expect(e.lines.length).toBeGreaterThanOrEqual(1);
    expect(e.lines[0].score).toEqual({ kind: 'cp', value: 10000 });
    expect(MATE_CP).toBe(10000);
  });

  it('pretas dão mate (mate do louco): cp -MATE_CP', () => {
    const e = terminalEval(fenAfter('f3 e5 g4 Qh4#'))!;
    expect(e.lines[0].score).toEqual({ kind: 'cp', value: -10000 });
  });

  it('afogamento: cp 0', () => {
    const fen = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
    const e = terminalEval(fen)!;
    expect(e).not.toBeNull();
    expect(e.fen).toBe(fen);
    expect(e.lines[0].score).toEqual({ kind: 'cp', value: 0 });
  });

  it('material insuficiente: cp 0', () => {
    const e = terminalEval('8/8/8/4k3/8/8/4K3/8 w - - 0 1')!;
    expect(e).not.toBeNull();
    expect(e.lines[0].score).toEqual({ kind: 'cp', value: 0 });
  });

  it('posição normal: null', () => {
    expect(terminalEval(START)).toBeNull();
    expect(terminalEval(fenAfter('e4 e5 Qh5'))).toBeNull();
  });

  it('nunca produz score mate (invariante de Score)', () => {
    for (const fen of [fenAfter('f3 e5 g4 Qh4#'), '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1']) {
      expect(terminalEval(fen)!.lines[0].score.kind).toBe('cp');
    }
  });
});

describe('cacheKey', () => {
  it('é sha256 hex (64 chars)', async () => {
    expect(await cacheKey(parsePgn(SCHOLAR))).toMatch(/^[0-9a-f]{64}$/);
  });

  it('segue o formato ENGINE_ID|RULES_VERSION|ucis', async () => {
    const game = parsePgn(SCHOLAR);
    const expected = createHash('sha256')
      .update(`${ENGINE_ID}|${RULES_VERSION}|${game.plies.map(p => p.uci).join(' ')}`)
      .digest('hex');
    expect(await cacheKey(game)).toBe(expected);
  });

  it('estável e sensível aos lances', async () => {
    expect(await cacheKey(parsePgn(SCHOLAR))).toBe(await cacheKey(parsePgn(SCHOLAR.replace('"a"', '"z"'))));
    expect(await cacheKey(parsePgn(SCHOLAR))).not.toBe(await cacheKey(parsePgn('1. d4 *')));
  });
});

describe('analyzeGame: Mate do Pastor', () => {
  it('termina sem chamar o motor na posição final', async () => {
    const fake = scriptedEngine(SCHOLAR_EVALS); // 7 posições (0..6), a 8ª é mate
    const a = await analyzeGame(parsePgn(SCHOLAR), fake);
    expect(fake.calls).toBe(7);
    expect(a.moves).toHaveLength(7);
    expect(a.moves[6].category).toBe('best');
    expect(a.moves[5].category).toBe('blunder'); // 3...Nf6?? permite Dxf7#
    expect(a.moves[5].explanation).toContain('Permite mate em 1.');
    expect(a.moves[0].category).toBe('book');
    expect(a.opening?.eco).toBeDefined();
  });

  it('evals tem plies + 1 posições e a última é a terminal', async () => {
    const game = parsePgn(SCHOLAR);
    const a = await analyzeGame(game, scriptedEngine(SCHOLAR_EVALS));
    expect(a.evals).toHaveLength(8);
    expect(a.evals.map(e => e.fen)).toEqual([...game.plies.map(p => p.fenBefore), game.plies[6].fenAfter]);
    expect(a.evals[7].lines[0].score).toEqual({ kind: 'cp', value: 10000 });
    for (const e of a.evals) expect(e.lines.length).toBeGreaterThanOrEqual(1);
  });

  it('o lance de mate tem winAfter total e a precisão das brancas é quase máxima', async () => {
    const a = await analyzeGame(parsePgn(SCHOLAR), scriptedEngine(SCHOLAR_EVALS));
    expect(a.moves[6].winAfter).toBeGreaterThan(99);
    expect(a.accuracy.w).toBeGreaterThanOrEqual(95);
    expect(a.accuracy.w).toBeGreaterThan(a.accuracy.b);
  });

  it('progresso cresce de 1 em 1 até o total', async () => {
    const seen: number[] = [];
    await analyzeGame(parsePgn(SCHOLAR), scriptedEngine(SCHOLAR_EVALS), p => seen.push(p.evaluated));
    expect(seen).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  it('progresso informa total e os lances já classificados', async () => {
    const seen: AnalysisProgress[] = [];
    await analyzeGame(parsePgn(SCHOLAR), scriptedEngine(SCHOLAR_EVALS), p =>
      seen.push({ ...p, moves: [...p.moves] }));
    expect(seen.every(p => p.total === 8)).toBe(true);
    expect(seen.map(p => p.moves.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(seen[6].moves[5].category).toBe('blunder');
  });

  it('repassa ANALYSE_OPTIONS e o signal ao motor', async () => {
    const ac = new AbortController();
    const fake = scriptedEngine(SCHOLAR_EVALS);
    await analyzeGame(parsePgn(SCHOLAR), fake, undefined, ac.signal);
    expect(fake.optsSeen).toHaveLength(7);
    for (const o of fake.optsSeen) expect(o).toEqual(ANALYSE_OPTIONS);
    for (const s of fake.signalsSeen) expect(s).toBe(ac.signal);
  });

  it('avalia as posições em sequência, uma FEN por lance', async () => {
    const game = parsePgn(SCHOLAR);
    const fake = scriptedEngine(SCHOLAR_EVALS);
    await analyzeGame(game, fake);
    expect(fake.fensSeen).toEqual(game.plies.map(p => p.fenBefore));
  });

  it('bestUci = before.lines[0].move e bestSan em SAN inglês', async () => {
    const game = parsePgn(SCHOLAR);
    const a = await analyzeGame(game, scriptedEngine(SCHOLAR_EVALS));
    a.moves.forEach((m, i) => {
      const best = a.evals[i].lines[0].move;
      expect(m.bestUci).toBe(best);
      expect(m.bestSan).toBe(new Chess(game.plies[i].fenBefore).move(parseUci(best)).san);
    });
    expect(a.moves[5].bestUci).toBe('g7g6');
    expect(a.moves[5].bestSan).toBe('g6');
    expect(a.moves[6].bestSan).toBe('Qxf7#');
  });

  it('mantém os campos do ply e calcula win% de quem moveu', async () => {
    const game = parsePgn(SCHOLAR);
    const a = await analyzeGame(game, scriptedEngine(SCHOLAR_EVALS));
    a.moves.forEach((m, i) => expect(m).toMatchObject(game.plies[i]));
    const m5 = a.moves[5]; // pretas: +40 para as brancas antes, mate em 1 das brancas depois
    expect(m5.winBefore).toBeCloseTo(moverWin(a.evals[5].lines[0].score, 'b'), 5);
    expect(m5.winAfter).toBeCloseTo(moverWin(a.evals[6].lines[0].score, 'b'), 5);
    expect(m5.winAfter).toBeLessThan(1);
    expect(a.moves[0].winBefore).toBeCloseTo(winPercent(30), 5);
  });

  it('explanation vem de explainMove', async () => {
    const a = await analyzeGame(parsePgn(SCHOLAR), scriptedEngine(SCHOLAR_EVALS));
    expect(a.moves[0].explanation).toBe(
      explainMove({ category: 'book', bestSan: 'e4', materialDelta: 0, allowsMateIn: null, missedMateIn: null }),
    );
    expect(a.moves[5].explanation).toBe(
      explainMove({ category: 'blunder', bestSan: 'g6', materialDelta: -1, allowsMateIn: 1, missedMateIn: null }),
    );
    expect(a.moves[6].explanation).toBe('Melhor.');
  });

  it('accuracy, rating e counts coerentes', async () => {
    const game = parsePgn(SCHOLAR);
    const a = await analyzeGame(game, scriptedEngine(SCHOLAR_EVALS));

    const wins = a.evals.map(e => winPercent(scoreToCp(e.lines[0].score)));
    const acc = gameAccuracy(wins);
    expect(a.accuracy.w).toBeCloseTo(acc.w, 5);
    expect(a.accuracy.b).toBeCloseTo(acc.b, 5);
    expect(a.rating).toEqual({ w: estimateRating(a.accuracy.w), b: estimateRating(a.accuracy.b) });

    const sum = (c: Record<MoveCategory, number>): number => Object.values(c).reduce((s, n) => s + n, 0);
    expect(sum(a.counts.w)).toBe(game.plies.filter(p => p.color === 'w').length);
    expect(sum(a.counts.b)).toBe(game.plies.filter(p => p.color === 'b').length);
    expect(sum(a.counts.w)).toBe(4);
    expect(sum(a.counts.b)).toBe(3);
    expect(a.counts.b.blunder).toBe(1);
    expect(a.counts.w.best).toBeGreaterThanOrEqual(1);
    expect(a.counts.w.blunder).toBe(0);
    for (const c of [a.counts.w, a.counts.b]) {
      for (const k of ['book', 'brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder', 'missedMate']) {
        expect(typeof c[k as MoveCategory]).toBe('number');
      }
    }
  });

  it('headers e key', async () => {
    const game = parsePgn(SCHOLAR);
    const a = await analyzeGame(game, scriptedEngine(SCHOLAR_EVALS));
    expect(a.headers).toEqual(game.headers);
    expect(a.key).toBe(await cacheKey(game));
  });

  it('allowsMateIn: o lance 3...Nf6 permite mate em 1; os demais não', async () => {
    const a = await analyzeGame(parsePgn(SCHOLAR), scriptedEngine(SCHOLAR_EVALS));
    expect(a.moves[5].explanation).toContain('Permite mate em 1.');
    for (const i of [0, 1, 2, 3, 4, 6]) expect(a.moves[i].explanation).not.toContain('Permite mate');
  });
});

describe('analyzeGame: abort', () => {
  it('abort interrompe', async () => {
    const ac = new AbortController();
    const fake = scriptedEngine(SCHOLAR_EVALS, { onCall: n => n === 2 && ac.abort() });
    const p = analyzeGame(parsePgn(SCHOLAR), fake, undefined, ac.signal);
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(fake.calls).toBeLessThan(7);
    expect(fake.calls).toBeLessThanOrEqual(3);
  });

  it('não reporta progresso depois do abort', async () => {
    const ac = new AbortController();
    const seen: number[] = [];
    const fake = scriptedEngine(SCHOLAR_EVALS, { onCall: n => n === 3 && ac.abort() });
    await expect(
      analyzeGame(parsePgn(SCHOLAR), fake, p => seen.push(p.evaluated), ac.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(Math.max(0, ...seen)).toBeLessThanOrEqual(3);
  });

  it('signal já abortado rejeita com AbortError', async () => {
    const ac = new AbortController();
    ac.abort();
    const fake = scriptedEngine(SCHOLAR_EVALS);
    await expect(analyzeGame(parsePgn(SCHOLAR), fake, undefined, ac.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fake.calls).toBeLessThanOrEqual(1);
  });
});

describe('analyzeGame: livro só enquanto a sequência é contínua', () => {
  // 1.Nf3 d5 2.g3 Nf6 3.Bg2 e6: os 4 primeiros plies são livro, 3.Bg2 sai, 3...e6 volta ao livro (A07).
  const PGN = '[Event "x"]\n\n1. Nf3 d5 2. g3 Nf6 3. Bg2 e6 *';
  const SANS = ['Nf3', 'd5', 'g3', 'Nf6', 'Bg2', 'e6'];

  it('lance fora do livro seguido de posição que volta ao livro não é book', async () => {
    const game = parsePgn(PGN);
    // premissa do cenário: a posição depois de 3...e6 está no livro
    expect(lookupOpening(game.plies[5].fenAfter)).not.toBeNull();
    expect(lookupOpening(game.plies[4].fenAfter)).toBeNull();

    const a = await analyzeGame(game, scriptedEngine(buildEvals(SANS)));
    expect(a.moves.slice(0, 4).map(m => m.category)).toEqual(['book', 'book', 'book', 'book']);
    expect(a.moves[4].category).not.toBe('book');
    expect(a.moves[5].category).not.toBe('book');
    expect(a.counts.w.book).toBe(2);
    expect(a.counts.b.book).toBe(2);
  });

  it('opening é a do último ply book, não a do retorno ao livro', async () => {
    const game = parsePgn(PGN);
    const a = await analyzeGame(game, scriptedEngine(buildEvals(SANS)));
    expect(a.opening).toEqual(lookupOpening(game.plies[3].fenAfter));
    expect(a.opening).not.toEqual(lookupOpening(game.plies[5].fenAfter));
  });

  it('opening do Mate do Pastor é a do último lance de livro (3 plies)', async () => {
    const game = parsePgn(SCHOLAR);
    const a = await analyzeGame(game, scriptedEngine(SCHOLAR_EVALS));
    expect(a.opening).toEqual(lookupOpening(game.plies[2].fenAfter));
    expect(a.moves[3].category).not.toBe('book');
  });

  it('só o primeiro lance no livro: opening é a dele e o resto não é book', async () => {
    const sans = ['Nh3', 'd5', 'd4', 'Nf6'];
    const game = parsePgn('[Event "x"]\n\n1. Nh3 d5 2. d4 Nf6 *');
    const a = await analyzeGame(game, scriptedEngine(buildEvals(sans)));
    expect(a.moves[0].category).toBe('book');
    expect(a.moves.slice(1).some(m => m.category === 'book')).toBe(false);
    expect(a.opening).toEqual(lookupOpening(game.plies[0].fenAfter));
  });
});
