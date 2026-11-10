import { Chess } from 'chess.js';
import { GameError } from './types';
import type { ParsedGame, Ply } from './types';

/** Isola o primeiro jogo: corta antes de uma tag que segue o movetext. */
function firstGame(text: string): string {
  const lines = text.split('\n');
  let seenMoves = false;
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('[') && /^\[\s*\w+\s+".*"\s*\]$/.test(t)) {
      if (seenMoves) break;
    } else if (t !== '') {
      seenMoves = true;
    }
    out.push(line);
  }
  return out.join('\n');
}

export function parsePgn(text: string): ParsedGame {
  const src = firstGame(text.replace(/\r\n?/g, '\n').trim());
  const variant = /\[\s*Variant\s+"([^"]*)"\s*\]/i.exec(src)?.[1];
  if (variant && variant.trim().toLowerCase() !== 'standard') throw new GameError('variant-unsupported');
  if (/\[\s*SetUp\s+"1"\s*\]/i.test(src) || /\[\s*FEN\s+"/i.test(src)) throw new GameError('custom-position');
  const chess = new Chess();
  try {
    chess.loadPgn(src);
  } catch {
    throw new GameError('invalid-pgn');
  }
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(chess.getHeaders())) {
    if (typeof v === 'string') headers[k] = v;
  }

  const plies: Ply[] = chess.history({ verbose: true }).map((m, index) => ({
    index,
    color: m.color,
    san: m.san,
    uci: m.lan,
    fenBefore: m.before,
    fenAfter: m.after,
  }));
  if (plies.length === 0) {
    if (!/\[\s*\w+\s+"/.test(src) && !/\*|1-0|0-1|1\/2-1\/2/.test(src)) throw new GameError('invalid-pgn');
    throw new GameError('empty');
  }
  return { headers, plies };
}
