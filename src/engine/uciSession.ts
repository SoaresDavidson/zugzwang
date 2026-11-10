import { abortError } from '../core/abort';
import { parseUciInfo } from '../core/uci';
import type { AnalyseOptions, Color, EngineLine, PositionEval } from '../core/types';

interface Current {
  side: Color;
  best: Map<number, EngineLine>;
  fen: string;
  finish: (r: PositionEval | Error) => void;
  aborted: () => boolean;
}

/**
 * Protocolo UCI sem I/O: recebe `send(line)` para falar com o motor e é alimentado
 * com as linhas recebidas via `feed`. Não conhece DOM, Worker nem processos.
 */
export class UciSession {
  private queue: Promise<unknown> = Promise.resolve();

  private readonly pending = new Set<(e: Error) => void>();

  private current: Current | null = null;

  private isDead = false;

  private readonly send: (line: string) => void;

  constructor(send: (line: string) => void) {
    this.send = send;
  }

  get dead(): boolean {
    return this.isDead;
  }

  /** Alimenta a sessão com uma linha recebida do motor. */
  feed(raw: string): void {
    const cur = this.current;
    if (!cur) return;
    const line = raw.trim();
    if (line.startsWith('bestmove')) {
      this.current = null;
      if (cur.aborted()) cur.finish(abortError());
      else {
        const lines = [...cur.best.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l);
        cur.finish({ fen: cur.fen, lines });
      }
    } else if (line.startsWith('info')) {
      const info = parseUciInfo(line, cur.side);
      if (info) cur.best.set(info.multipv, { move: info.pv[0], score: info.score, pv: info.pv });
    }
  }

  /** O transporte morreu: rejeita tudo que está pendente e recusa novas análises. */
  kill(error: Error = new Error('engine-failed')): void {
    if (this.isDead) return;
    this.isDead = true;
    const cur = this.current;
    this.current = null;
    for (const fail of [...this.pending]) fail(error);
    this.pending.clear();
    cur?.finish(error);
  }

  analyse(fen: string, opts: AnalyseOptions, signal?: AbortSignal): Promise<PositionEval> {
    if (this.isDead) return Promise.reject(new Error('engine-failed'));
    if (signal?.aborted) return Promise.reject(abortError());
    return new Promise<PositionEval>((resolve, reject) => {
      let started = false;
      let settled = false;
      const cleanup = () => {
        this.pending.delete(fail);
        signal?.removeEventListener('abort', onQueuedAbort);
      };
      const fail = (e: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(e);
      };
      const onQueuedAbort = () => { if (!started) fail(abortError()); };
      signal?.addEventListener('abort', onQueuedAbort, { once: true });
      this.pending.add(fail);
      this.queue = this.queue.then(() => {
        if (settled) return undefined;
        if (this.isDead) { fail(new Error('engine-failed')); return undefined; }
        if (signal?.aborted) { fail(abortError()); return undefined; }
        started = true;
        return this.run(fen, opts, signal).then(
          (r) => { if (!settled) { settled = true; cleanup(); resolve(r); } },
          fail,
        );
      });
    });
  }

  private run(fen: string, opts: AnalyseOptions, signal?: AbortSignal): Promise<PositionEval> {
    const side: Color = fen.split(' ')[1] === 'b' ? 'b' : 'w';
    return new Promise<PositionEval>((resolve, reject) => {
      let aborted = false;
      const onAbort = () => {
        if (aborted) return;
        aborted = true;
        if (!this.isDead) this.send('stop');
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      this.current = {
        side,
        fen,
        best: new Map(),
        aborted: () => aborted || signal?.aborted === true,
        finish: (r) => {
          signal?.removeEventListener('abort', onAbort);
          if (r instanceof Error) reject(r);
          else resolve(r);
        },
      };
      this.send(`setoption name MultiPV value ${opts.multipv}`);
      this.send(`position fen ${fen}`);
      this.send(`go movetime ${opts.movetimeMs}`);
      if (signal?.aborted) onAbort();
    });
  }
}
