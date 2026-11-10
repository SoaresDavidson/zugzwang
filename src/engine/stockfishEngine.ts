import { ENGINE_HANDSHAKE_TIMEOUT_MS, ENGINE_HASH_MB } from '../core/thresholds';
import type { AnalyseOptions, Engine, PositionEval } from '../core/types';
import { pickEngineBuild } from './build';
import { UciSession } from './uciSession';

export type WorkerLike = {
  postMessage(msg: string): void;
  onmessage: ((e: { data: string }) => void) | null;
  onerror?: ((e: unknown) => void) | null;
  terminate(): void;
};

function realWorker(url: string): WorkerLike {
  return new Worker(url) as unknown as WorkerLike;
}

/** Adaptador fino: Worker do navegador <-> UciSession. */
export class StockfishEngine implements Engine {
  private readonly session: UciSession;

  private dead = false;

  /** Chamado uma vez quando o motor morre (erro do worker ou terminate). */
  onDead: (() => void) | null = null;

  private readonly worker: WorkerLike;

  private constructor(worker: WorkerLike) {
    this.worker = worker;
    this.session = new UciSession((line) => worker.postMessage(line));
    worker.onmessage = (e) => this.session.feed(String(e.data));
    worker.onerror = () => this.kill();
  }

  private kill(): void {
    if (this.dead) return;
    this.dead = true;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.session.kill(new Error('engine-failed'));
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
    return this.session.analyse(fen, opts, signal);
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
