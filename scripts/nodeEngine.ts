import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { parseUciInfo } from '../src/core/uci';
import type { AnalyseOptions, Color, Engine, EngineLine, PositionEval } from '../src/core/types';

const ENGINE_PATH = 'node_modules/stockfish/bin/stockfish-19-lite-single.js';

export async function createNodeEngine(): Promise<Engine & { quit(): void }> {
  const proc = spawn('node', [ENGINE_PATH], { stdio: ['pipe', 'pipe', 'ignore'] });
  const listeners = new Set<(line: string) => void>();
  createInterface({ input: proc.stdout }).on('line', (l) => listeners.forEach((fn) => fn(l)));
  const send = (cmd: string) => proc.stdin.write(`${cmd}\n`);

  const waitFor = (pred: (line: string) => boolean) =>
    new Promise<void>((resolve, reject) => {
      const fn = (l: string) => {
        if (pred(l)) { listeners.delete(fn); resolve(); }
      };
      listeners.add(fn);
      proc.once('error', reject);
      proc.once('exit', () => reject(new Error('stockfish encerrou')));
    });

  const uciok = waitFor((l) => l.trim() === 'uciok');
  send('uci');
  await uciok;
  const ready = waitFor((l) => l.trim() === 'readyok');
  send('isready');
  await ready;

  let chain: Promise<unknown> = Promise.resolve();

  const run = (fen: string, opts: AnalyseOptions, signal?: AbortSignal) =>
    new Promise<PositionEval>((resolve, reject) => {
      const side = (fen.split(' ')[1] ?? 'w') as Color;
      const byPv = new Map<number, EngineLine>();
      const fn = (l: string) => {
        if (l.startsWith('bestmove')) {
          listeners.delete(fn);
          const lines = [...byPv.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
          resolve({ fen, lines });
          return;
        }
        const info = parseUciInfo(l, side);
        if (info) byPv.set(info.multipv, { move: info.pv[0], score: info.score, pv: info.pv });
      };
      listeners.add(fn);
      signal?.addEventListener('abort', () => send('stop'), { once: true });
      send(`setoption name MultiPV value ${opts.multipv}`);
      send(`position fen ${fen}`);
      send(`go movetime ${opts.movetimeMs}`);
      proc.once('exit', () => reject(new Error('stockfish encerrou')));
    });

  return {
    analyse(fen, opts, signal) {
      const p = chain.then(() => run(fen, opts, signal));
      chain = p.catch(() => undefined);
      return p;
    },
    quit() {
      try { send('quit'); } catch { /* já encerrado */ }
      proc.stdin.end();
      setTimeout(() => proc.kill(), 500).unref();
    },
  };
}
