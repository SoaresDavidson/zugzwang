import { Chess } from 'chess.js';
import { estimateRating, gameAccuracy } from './accuracy';
import { classifyMove } from './classify';
import { explainMove } from './explain';
import { isSacrifice, materialSwing } from './material';
import { parseUci } from './moves';
import { isBookFen, lookupOpening } from './openings';
import { ANALYSE_OPTIONS, ENGINE_ID, MATE_CP, RULES_VERSION } from './thresholds';
import type {
  AnalyzedMove, CategoryCounts, Color, Engine, GameAnalysis, MoveCategory, Opening, ParsedGame, PositionEval,
} from './types';
import { isMateFor, moverWin, scoreToCp, winPercent } from './winPercent';

export interface AnalysisProgress { evaluated: number; total: number; moves: AnalyzedMove[] }

const CATEGORIES: MoveCategory[] = [
  'book', 'brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder', 'missedMate',
];

function emptyCounts(): CategoryCounts {
  return Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as CategoryCounts;
}

export async function cacheKey(game: ParsedGame): Promise<string> {
  const text = `${ENGINE_ID}|${RULES_VERSION}|${game.plies.map((p) => p.uci).join(' ')}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Mate: cp ±MATE_CP contra quem está em mate. Afogamento/material insuficiente: cp 0. */
export function terminalEval(fen: string): PositionEval | null {
  const chess = new Chess(fen);
  let value: number;
  if (chess.isCheckmate()) value = chess.turn() === 'w' ? -MATE_CP : MATE_CP;
  else if (chess.isStalemate() || chess.isInsufficientMaterial()) value = 0;
  else return null;
  return { fen, lines: [{ move: '', score: { kind: 'cp', value }, pv: [] }] };
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

export async function analyzeGame(
  game: ParsedGame,
  engine: Engine,
  onProgress?: (p: AnalysisProgress) => void,
  signal?: AbortSignal,
): Promise<GameAnalysis> {
  const { plies } = game;
  const total = plies.length + 1;
  const fens = [...plies.map((p) => p.fenBefore), plies[plies.length - 1].fenAfter];
  const evals: PositionEval[] = [];
  const moves: AnalyzedMove[] = [];
  let allBook = true;
  let opening: Opening | null = null;

  for (let k = 0; k < total; k++) {
    if (signal?.aborted) throw abortError();
    const fen = fens[k];
    const ev = terminalEval(fen) ?? (await engine.analyse(fen, ANALYSE_OPTIONS, signal));
    if (signal?.aborted) throw abortError();
    evals.push(ev);
    if (k === 0) continue;

    const i = k - 1;
    const ply = plies[i];
    const before = evals[i];
    const after = ev;
    const pv = after.lines[0]?.pv ?? [];
    const isBook: boolean = allBook && isBookFen(ply.fenAfter);
    allBook = isBook;
    if (isBook) opening = lookupOpening(ply.fenAfter);

    const category = classifyMove({
      color: ply.color,
      uci: ply.uci,
      before,
      after,
      isBook,
      isSacrifice: isSacrifice(ply.fenBefore, ply.uci, pv),
    });

    const bestUci = before.lines[0]?.move || null;
    let bestSan: string | null = null;
    if (bestUci) {
      try {
        bestSan = new Chess(ply.fenBefore).move(parseUci(bestUci)).san;
      } catch {
        bestSan = null;
      }
    }

    const afterScore = after.lines[0].score;
    const beforeScore = before.lines[0].score;
    const allowsMateIn =
      afterScore.kind === 'mate' && !isMateFor(afterScore, ply.color) ? Math.abs(afterScore.value) : null;
    const missedMateIn = category === 'missedMate' && beforeScore.kind === 'mate' ? Math.abs(beforeScore.value) : null;

    moves.push({
      ...ply,
      category,
      winBefore: moverWin(beforeScore, ply.color),
      winAfter: moverWin(afterScore, ply.color),
      bestUci,
      bestSan,
      explanation: explainMove({
        category,
        bestSan,
        materialDelta: materialSwing(ply.fenBefore, ply.uci, pv),
        allowsMateIn,
        missedMateIn,
      }),
    });
    onProgress?.({ evaluated: k + 1, total, moves: [...moves] });
  }

  const accuracy = gameAccuracy(evals.map((e) => winPercent(scoreToCp(e.lines[0].score))));
  const counts = { w: emptyCounts(), b: emptyCounts() };
  for (const m of moves) counts[m.color satisfies Color][m.category] += 1;

  return {
    key: await cacheKey(game),
    headers: game.headers,
    opening,
    moves,
    evals,
    accuracy,
    rating: { w: estimateRating(accuracy.w), b: estimateRating(accuracy.b) },
    counts,
  };
}
