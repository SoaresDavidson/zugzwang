/*
 * CONTRATO que o implementador de src/engine/stockfishEngine.ts deve seguir
 * (este arquivo não pode ser alterado):
 *
 *   export type WorkerLike = {
 *     postMessage(msg: string): void;
 *     onmessage: ((e: { data: string }) => void) | null;
 *     terminate(): void;
 *   };
 *   StockfishEngine.create(workerFactory?: (url: string) => WorkerLike): Promise<StockfishEngine>
 *     - sem factory, usa `new Worker(url)` real; url vem de pickEngineBuild.
 *     - o worker entrega mensagens como { data: string } (uma linha UCI por mensagem).
 *     - define `worker.onmessage` antes de enviar a primeira mensagem.
 *     - handshake, nesta ordem: 'uci', 'setoption name Threads value N',
 *       'setoption name Hash value 32', 'isready'. Espera 'uciok' e 'readyok'.
 *     - timeout de 10 000 ms (setTimeout) sem 'readyok': chama worker.terminate() e
 *       rejeita com Error('engine-failed').
 *     - factory que lança: rejeita com Error('engine-failed'). Na implementação real
 *       (Worker de verdade), `worker.onerror` também deve rejeitar com 'engine-failed';
 *       o teste não cobre isso porque WorkerLike mínimo não tem onerror.
 *   analyse(fen, { movetimeMs, multipv }, signal?):
 *     - chamadas serializadas numa fila: a próxima só envia mensagens após o 'bestmove' da anterior.
 *     - envia 'setoption name MultiPV value N', 'position fen F', 'go movetime T'.
 *     - guarda a última 'info' parseável de cada multipv até 'bestmove'; devolve
 *       { fen, lines } ordenado por multipv, score no ponto de vista das brancas (parseUciInfo),
 *       EngineLine = { move: pv[0], score, pv }.
 *     - abort durante o go: envia 'stop', espera o 'bestmove' e então rejeita com
 *       um erro de name === 'AbortError'. Signal já abortado antes de começar: rejeita com
 *       AbortError sem enviar 'position'.
 *   terminate(): chama worker.terminate().
 */
import { StockfishEngine } from '../../src/engine/stockfishEngine';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const BLACK_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

class FakeWorker {
  sent: string[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  terminated = false;
  silent = false; // não responde ao handshake
  autoGo = false; // responde sozinho ao go
  url: string;
  constructor(url: string) { this.url = url; }
  emit(line: string) { this.onmessage?.({ data: line }); }
  postMessage(msg: string) {
    this.sent.push(msg);
    if (this.silent) return;
    if (msg === 'uci') this.emit('uciok');
    else if (msg === 'isready') this.emit('readyok');
    else if (msg.startsWith('go') && this.autoGo) this.finishGo();
  }
  terminate() { this.terminated = true; }
  /** Emite duas linhas (multipv 1 e 2) e o bestmove, do ponto de vista de quem move. */
  finishGo(cp1 = 30, cp2 = 10) {
    this.emit('info string NNUE evaluation enabled');
    this.emit(`info depth 5 multipv 1 score cp ${cp1 - 5} pv e2e4`);
    this.emit(`info depth 10 multipv 1 score cp ${cp1} pv e2e4 e7e5`);
    this.emit(`info depth 10 multipv 2 score cp ${cp2} pv d2d4 d7d5`);
    this.emit('bestmove e2e4');
  }
  count(prefix: string) { return this.sent.filter((m) => m.startsWith(prefix)).length; }
}

async function make(setup?: (w: FakeWorker) => void) {
  let worker!: FakeWorker;
  const engine = await StockfishEngine.create((url) => {
    worker = new FakeWorker(url);
    setup?.(worker);
    return worker;
  });
  return { engine, worker };
}

describe('StockfishEngine.create', () => {
  it('faz o handshake na ordem: uci, Threads, Hash, isready', async () => {
    const { worker } = await make();
    expect(worker.sent[0]).toBe('uci');
    expect(worker.sent[1]).toMatch(/^setoption name Threads value \d+$/);
    expect(worker.sent[2]).toBe('setoption name Hash value 32');
    expect(worker.sent[3]).toBe('isready');
  });

  it('passa a url de um dos builds do stockfish à factory', async () => {
    const { worker } = await make();
    expect(worker.url).toMatch(/^\/stockfish\/stockfish-19-lite(-single)?\.js$/);
  });

  it('rejeita com engine-failed se o worker nunca responde uciok (timeout 10 s)', async () => {
    vi.useFakeTimers();
    try {
      let worker!: FakeWorker;
      const p = StockfishEngine.create((url) => { worker = new FakeWorker(url); worker.silent = true; return worker; });
      const assertion = expect(p).rejects.toThrow('engine-failed');
      await vi.advanceTimersByTimeAsync(10_000);
      await assertion;
      expect(worker.terminated).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejeita com engine-failed se a factory lança', async () => {
    await expect(StockfishEngine.create(() => { throw new Error('boom'); })).rejects.toThrow('engine-failed');
  });
});

describe('StockfishEngine.analyse', () => {
  it('devolve 2 linhas no ponto de vista das brancas, com fen', async () => {
    const { engine, worker } = await make((w) => { w.autoGo = true; });
    const r = await engine.analyse(START, { movetimeMs: 500, multipv: 2 });
    expect(r.fen).toBe(START);
    expect(r.lines).toEqual([
      { move: 'e2e4', score: { kind: 'cp', value: 30 }, pv: ['e2e4', 'e7e5'] },
      { move: 'd2d4', score: { kind: 'cp', value: 10 }, pv: ['d2d4', 'd7d5'] },
    ]);
    expect(worker.sent).toContain('setoption name MultiPV value 2');
    expect(worker.sent).toContain(`position fen ${START}`);
    expect(worker.sent).toContain('go movetime 500');
  });

  it('com pretas a mover, inverte o sinal dos scores', async () => {
    const { engine } = await make((w) => { w.autoGo = true; });
    const r = await engine.analyse(BLACK_FEN, { movetimeMs: 500, multipv: 2 });
    expect(r.fen).toBe(BLACK_FEN);
    expect(r.lines.map((l) => l.score)).toEqual([{ kind: 'cp', value: -30 }, { kind: 'cp', value: -10 }]);
  });

  it('duas chamadas simultâneas são serializadas', async () => {
    const { engine, worker } = await make();
    const p1 = engine.analyse(START, { movetimeMs: 500, multipv: 2 });
    const p2 = engine.analyse(BLACK_FEN, { movetimeMs: 500, multipv: 2 });
    await vi.waitFor(() => expect(worker.count('go')).toBe(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(worker.sent.filter((m) => m.startsWith('position'))).toEqual([`position fen ${START}`]);
    expect(worker.count('go')).toBe(1);

    worker.finishGo();
    expect((await p1).fen).toBe(START);
    await vi.waitFor(() => expect(worker.count('go')).toBe(2));
    expect(worker.sent.filter((m) => m.startsWith('position'))).toEqual([
      `position fen ${START}`, `position fen ${BLACK_FEN}`,
    ]);
    worker.finishGo();
    expect((await p2).fen).toBe(BLACK_FEN);
  });

  it('abort manda stop e rejeita com AbortError só depois do bestmove', async () => {
    const { engine, worker } = await make();
    const ac = new AbortController();
    const p = engine.analyse(START, { movetimeMs: 500, multipv: 2 }, ac.signal);
    let settled = false;
    p.then(() => { settled = true; }, () => { settled = true; });
    await vi.waitFor(() => expect(worker.count('go')).toBe(1));

    ac.abort();
    await vi.waitFor(() => expect(worker.sent).toContain('stop'));
    await new Promise((r) => setTimeout(r, 20));
    expect(settled).toBe(false);

    worker.emit('bestmove e2e4');
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('signal já abortado rejeita com AbortError sem enviar position', async () => {
    const { engine, worker } = await make();
    const ac = new AbortController();
    ac.abort();
    await expect(engine.analyse(START, { movetimeMs: 500, multipv: 2 }, ac.signal))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.count('position')).toBe(0);
  });

  it('depois de um abort, a próxima análise funciona', async () => {
    const { engine, worker } = await make();
    const ac = new AbortController();
    const p1 = engine.analyse(START, { movetimeMs: 500, multipv: 2 }, ac.signal);
    const p1done = p1.catch(() => {});
    await vi.waitFor(() => expect(worker.count('go')).toBe(1));
    ac.abort();
    worker.emit('bestmove e2e4');
    await p1done;

    const p2 = engine.analyse(BLACK_FEN, { movetimeMs: 500, multipv: 2 });
    await vi.waitFor(() => expect(worker.count('go')).toBe(2));
    worker.finishGo();
    expect((await p2).fen).toBe(BLACK_FEN);
  });

  it('terminate encerra o worker', async () => {
    const { engine, worker } = await make();
    engine.terminate();
    expect(worker.terminated).toBe(true);
  });
});
