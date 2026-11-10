import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { Engine } from '../src/core/types';
import { UciSession } from '../src/engine/uciSession';

const ENGINE_PATH = 'node_modules/stockfish/bin/stockfish-19-lite-single.js';

/** Adaptador fino: processo do Stockfish <-> UciSession. */
export async function createNodeEngine(): Promise<Engine & { quit(): void }> {
  const proc = spawn('node', [ENGINE_PATH], { stdio: ['pipe', 'pipe', 'ignore'] });
  let closed = false;
  const send = (cmd: string) => {
    if (closed || proc.stdin.destroyed || proc.stdin.writableEnded) return;
    proc.stdin.write(`${cmd}\n`);
  };
  const session = new UciSession(send);
  let onHandshakeLine: ((line: string) => void) | null = null;

  createInterface({ input: proc.stdout }).on('line', (l) => {
    if (onHandshakeLine) onHandshakeLine(l.trim());
    else session.feed(l);
  });
  proc.stdin.on('error', () => {});

  const handshake = new Promise<void>((resolve, reject) => {
    let uciok = false;
    onHandshakeLine = (l) => {
      if (l === 'uciok' && !uciok) { uciok = true; send('isready'); }
      else if (l === 'readyok' && uciok) { onHandshakeLine = null; resolve(); }
    };
    proc.once('error', reject);
    proc.once('exit', () => reject(new Error('stockfish encerrou')));
  });
  const die = () => { closed = true; session.kill(new Error('engine-failed')); };
  proc.on('error', die);
  proc.on('exit', die);
  send('uci');
  await handshake;

  return {
    analyse: (fen, opts, signal) => session.analyse(fen, opts, signal),
    quit() {
      session.kill(new Error('engine-failed'));
      send('quit');
      if (!proc.stdin.writableEnded) proc.stdin.end();
      setTimeout(() => proc.kill(), 500).unref();
    },
  };
}
