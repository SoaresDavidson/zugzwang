import { abortError } from '../core/abort';
import { ENGINE_HANDSHAKE_TIMEOUT_MS, ENGINE_HASH_MB } from '../core/thresholds';
import { parseUciInfo } from '../core/uci';
import type { AnalyseOptions, Color, Engine, EngineLine, PositionEval } from '../core/types';
import { pickEngineBuild } from './build';

export type WorkerLike = {
  postMessage(msg: string): void;
  onmessage: ((e: { data: string }) => void) | null;
  onerror?: ((e: unknown) => void) | null;
  terminate(): void;
};

function realWorker(url: string): WorkerLike {
  return new Worker(url) as unknown as WorkerLike;
}

export class StockfishEngine implements Engine {
  private queue: Promise<unknown> = Promise.resolve();

  private readonly pending = new Set<(e: Error) => void>();

  private dead = false;

  /** Chamado uma vez quando o motor morre (erro do worker ou terminate). */
  onDead: (() => void) | null = null;

  private readonly worker: WorkerLike;

  private constructor(worker: WorkerLike) {
    this.worker = worker;
    worker.onerror = () => this.kill();
  }

  private kill(): void {
    if (this.dead) return;
    this.dead = true;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    for (const reject of [...this.pending]) reject(new Error('engine-failed'));
    this.pending.clear();
    this.onDead?.();
  }

  static create(workerFactory?: (url: string) => WorkerLike): Promise<StockfishEngine> {
    const g = globalThis as { crossOriginIsolated?: boolean; navigator?: { hardwareConcurrency?: number } };
    const { url, threads } = pickEngineBuild({
      crossOriginIsolated: g.crossOriginIsolated === true,
      hardwareConcurrency: g.navigator?.hardwareConcurrency ?? 1,
    });
    return new Promise<StockfishEngine>((resolve, reject) => {
      let worker: WorkerLike;
      try {
        worker = (workerFactory ?? realWorker)(url);
      } catch {
        reject(new Error('engine-failed'));
        return;
      }
      let done = false;
      let uciok = false;
      const fail = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        worker.onmessage = null;
        worker.onerror = null;
        worker.terminate();
        reject(new Error('engine-failed'));
      };
      const timer = setTimeout(fail, ENGINE_HANDSHAKE_TIMEOUT_MS);
      worker.onerror = fail;
      worker.onmessage = (e) => {
        if (done) return;
        const line = String(e.data).trim();
        if (line === 'uciok') uciok = true;
        else if (line === 'readyok' && uciok) {
          done = true;
          clearTimeout(timer);
          worker.onmessage = null;
          resolve(new StockfishEngine(worker));
        }
      };
      worker.postMessage('uci');
      worker.postMessage(`setoption name Threads value ${threads}`);
      worker.postMessage(`setoption name Hash value ${ENGINE_HASH_MB}`);
      worker.postMessage('isready');
    });
  }

  analyse(fen: string, opts: AnalyseOptions, signal?: AbortSignal): Promise<PositionEval> {
    if (this.dead) return Promise.reject(new Error('engine-failed'));
    const run = () => (this.dead ? Promise.reject(new Error('engine-failed')) : this.run(fen, opts, signal));
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return new Promise<PositionEval>((resolve, reject) => {
      this.pending.add(reject);
      p.then(resolve, reject).finally(() => this.pending.delete(reject));
    });
  }

  private run(fen: string, opts: AnalyseOptions, signal?: AbortSignal): Promise<PositionEval> {
    if (signal?.aborted) return Promise.reject(abortError());
    const side = (fen.split(' ')[1] === 'b' ? 'b' : 'w') as Color;
    const worker = this.worker;
    return new Promise<PositionEval>((resolve, reject) => {
      const best = new Map<number, EngineLine>();
      let aborted = false;
      const onAbort = () => {
        if (aborted) return;
        aborted = true;
        worker.postMessage('stop');
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      worker.onmessage = (e) => {
        const line = String(e.data).trim();
        if (line.startsWith('bestmove')) {
          worker.onmessage = null;
          signal?.removeEventListener('abort', onAbort);
          if (aborted || signal?.aborted) { reject(abortError()); return; }
          const lines = [...best.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l);
          resolve({ fen, lines });
        } else if (line.startsWith('info')) {
          const info = parseUciInfo(line, side);
          if (info) best.set(info.multipv, { move: info.pv[0], score: info.score, pv: info.pv });
        }
      };
      worker.postMessage(`setoption name MultiPV value ${opts.multipv}`);
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go movetime ${opts.movetimeMs}`);
      if (signal?.aborted) onAbort();
    });
  }

  terminate(): void {
    this.worker.terminate();
    this.kill();
  }
}

let singleton: Promise<StockfishEngine> | null = null;

export function getEngine(): Promise<StockfishEngine> {
  if (!singleton) {
    const p: Promise<StockfishEngine> = StockfishEngine.create().then(
      (engine) => {
        engine.onDead = () => { if (singleton === p) singleton = null; };
        return engine;
      },
      (err) => { if (singleton === p) singleton = null; throw err; },
    );
    singleton = p;
  }
  return singleton;
}
