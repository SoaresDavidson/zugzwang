// Testes de regressão do code review da L2. Ficam ocultos do agente corretor.
process.env.TZ = 'America/Sao_Paulo';
import { Chess } from 'chess.js';
import { checkRetry } from '../../src/core/retry';
import { fetchLichessGames } from '../../src/core/sources/lichess';
import { fetchChesscomGames } from '../../src/core/sources/chesscom';
import { evaluateAchievements } from '../../src/core/achievements';
import type { HistoryEntry } from '../../src/core/achievements';
import { StockfishEngine } from '../../src/engine/stockfishEngine';
import { GameError } from '../../src/core/types';
import type { CategoryCounts, PositionEval } from '../../src/core/types';
import { scriptedEngine } from '../fixtures/fakeEngine';

function respond(routes: Record<string, { status?: number; body: string }>) {
  return (async (input: unknown) => {
    const url = String(input);
    const r = routes[url];
    if (!r) return new Response('', { status: 404 });
    return new Response(r.body, { status: r.status ?? 200 });
  }) as typeof fetch;
}
const LI_URL = (u: string) =>
  `https://lichess.org/api/games/user/${u}?max=50&pgnInJson=true&perfType=ultraBullet,bullet,blitz,rapid,classical,correspondence`;
const liGame = (id: string, black: object, createdAt = 1_700_000_000_000) => JSON.stringify({
  id, variant: 'standard', speed: 'blitz', createdAt,
  players: { white: { user: { name: 'davi' }, rating: 1500 }, black },
  pgn: '[Result "1-0"]\n\n1. e4 1-0',
});

describe('G1: Lichess tolera linhas inválidas', () => {
  it('linha truncada é ignorada e as válidas voltam', async () => {
    const body = liGame('ok1', { user: { name: 'x' }, rating: 1400 }) + '\n{"id":"trunc';
    const games = await fetchLichessGames('davi', undefined, respond({ [LI_URL('davi')]: { body } }));
    expect(games.map((g) => g.id)).toEqual(['ok1']);
  });
  it('partida sem players é ignorada', async () => {
    const body = JSON.stringify({ id: 'bad', variant: 'standard', speed: 'blitz', createdAt: 1, pgn: '' }) + '\n'
      + liGame('ok2', { user: { name: 'x' } });
    const games = await fetchLichessGames('davi', undefined, respond({ [LI_URL('davi')]: { body } }));
    expect(games.map((g) => g.id)).toEqual(['ok2']);
  });
});

describe('G6: jogador IA ou anônimo no Lichess', () => {
  it('IA traz aiLevel e nome nulo; core não inventa texto', async () => {
    const body = liGame('ai', { aiLevel: 3 }) + '\n' + liGame('anon', {}, 1_600_000_000_000);
    const [ai, anon] = await fetchLichessGames('davi', undefined, respond({ [LI_URL('davi')]: { body } }));
    expect(ai.black).toEqual({ name: null, rating: null, aiLevel: 3 });
    expect(anon.black).toEqual({ name: null, rating: null, aiLevel: null });
    expect(ai.white).toEqual({ name: 'davi', rating: 1500, aiLevel: null });
  });
});

describe('G2: Chess.com com mês problemático', () => {
  const base = 'https://api.chess.com/pub/player/davi/games';
  const ccGame = (uuid: string, end: number) => ({
    uuid, url: `https://www.chess.com/game/live/${uuid}`, rules: 'chess', time_class: 'blitz', end_time: end,
    white: { username: 'davi', rating: 1500 }, black: { username: 'x', rating: 1400 }, pgn: '[Result "0-1"]\n\n1. e4 0-1',
  });
  it.each([404, 500])('mês com HTTP %i é pulado e as partidas já juntadas voltam', async (status) => {
    const games = await fetchChesscomGames('davi', undefined, respond({
      [`${base}/archives`]: { body: JSON.stringify({ archives: [`${base}/2026/09`, `${base}/2026/10`] }) },
      [`${base}/2026/10`]: { body: JSON.stringify({ games: [ccGame('g1', 1_760_000_000)] }) },
      [`${base}/2026/09`]: { status, body: '' },
    }));
    expect(games.map((g) => g.id)).toEqual(['g1']);
  });
  it('mês com HTTP 429 propaga rate-limited em vez de devolver lista incompleta', async () => {
    const err = await fetchChesscomGames('davi', undefined, respond({
      [`${base}/archives`]: { body: JSON.stringify({ archives: [`${base}/2026/09`, `${base}/2026/10`] }) },
      [`${base}/2026/10`]: { status: 429, body: '' },
      [`${base}/2026/09`]: { body: JSON.stringify({ games: [ccGame('g0', 1_750_000_000)] }) },
    })).catch((e) => e);
    expect(err).toBeInstanceOf(GameError);
    expect(err.code).toBe('rate-limited');
  });
  it('archives sem a lista vira GameError network', async () => {
    const err = await fetchChesscomGames('davi', undefined, respond({ [`${base}/archives`]: { body: '{}' } })).catch((e) => e);
    expect(err).toBeInstanceOf(GameError);
    expect(err.code).toBe('network');
  });
});

describe('G3/G4: checkRetry', () => {
  // 1. f3 e5 2. g4 — pretas a mover, Dh4# disponível
  const c = new Chess(); c.move('f3'); c.move('e5'); c.move('g4');
  const fenBefore = c.fen();
  const before: PositionEval = { fen: fenBefore, lines: [{ move: 'd8h4', score: { kind: 'mate', value: -1 }, pv: ['d8h4'] }] };
  it('lance que dá mate não consulta o motor e é aceito', async () => {
    const engine = scriptedEngine({});
    const r = await checkRetry(before, fenBefore, 'd8h4', 'b', engine);
    expect(engine.calls).toBe(0);
    expect(r).toEqual({ category: 'best', accepted: true });
  });
  it.each(['e2e5', 'zz', 'd8h9'])('UCI ilegal ou malformado %s → recusado sem categoria', async (uci) => {
    const engine = scriptedEngine({});
    const r = await checkRetry(before, fenBefore, uci, 'b', engine);
    expect(r).toEqual({ category: null, accepted: false });
    expect(engine.calls).toBe(0);
  });
});

describe('G5: motor morre ou é encerrado com análise pendente', () => {
  class DyingWorker {
    sent: string[] = [];
    onmessage: ((e: { data: string }) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    terminated = false;
    postMessage(msg: string) {
      this.sent.push(msg);
      if (msg === 'uci') this.onmessage?.({ data: 'uciok' });
      else if (msg === 'isready') this.onmessage?.({ data: 'readyok' });
    }
    terminate() { this.terminated = true; }
  }
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  it('erro do worker no meio da análise rejeita com engine-failed', async () => {
    let w!: DyingWorker;
    const engine = await StockfishEngine.create(() => (w = new DyingWorker()));
    const p = engine.analyse(START, { movetimeMs: 500, multipv: 2 });
    await vi.waitFor(() => expect(w.sent.some((m) => m.startsWith('go'))).toBe(true));
    w.onerror?.(new Event('error'));
    await expect(p).rejects.toThrow('engine-failed');
  });
  it('terminate rejeita a análise em curso e as da fila', async () => {
    let w!: DyingWorker;
    const engine = await StockfishEngine.create(() => (w = new DyingWorker()));
    const p1 = engine.analyse(START, { movetimeMs: 500, multipv: 2 });
    const p2 = engine.analyse(START, { movetimeMs: 500, multipv: 2 });
    await vi.waitFor(() => expect(w.sent.some((m) => m.startsWith('go'))).toBe(true));
    engine.terminate();
    await expect(p1).rejects.toThrow('engine-failed');
    await expect(p2).rejects.toThrow('engine-failed');
    expect(w.terminated).toBe(true);
  });
});

describe('G7: mês civil no fuso do usuário', () => {
  const counts = (brilliant: number): CategoryCounts => ({
    book: 0, brilliant, great: 0, best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0, missedMate: 0,
  });
  const entry = (key: string, at: Date, brilliant: number): HistoryEntry => ({
    key, analyzedAt: at.getTime(), playedAt: null, playerColor: 'w', counts: counts(brilliant), accuracy: 70, ownMoves: 30,
  });
  it('31/10 às 22h (horário local) ainda é outubro', () => {
    const h = [entry('a', new Date(2026, 9, 31, 22, 0), 3), entry('b', new Date(2026, 10, 2, 12, 0), 2)];
    const r = evaluateAchievements(h, new Date(2026, 10, 20, 12, 0).getTime());
    expect(r.find((a) => a.id === 'cinco-brilhantes-mes')!.unlocked).toBe(false);
  });
  it('1/11 às 01h (horário local) é novembro', () => {
    const h = [entry('a', new Date(2026, 10, 1, 1, 0), 3), entry('b', new Date(2026, 10, 2, 12, 0), 2)];
    const r = evaluateAchievements(h, new Date(2026, 10, 20, 12, 0).getTime());
    expect(r.find((a) => a.id === 'cinco-brilhantes-mes')!.unlocked).toBe(true);
  });
});
