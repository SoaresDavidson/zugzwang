import { MAX_GAMES } from '../thresholds';
import { GameError } from '../types';
import { getText, HttpError, parseJson, readResult, sortAndCap } from './http';
import type { GameSummary, Player, TimeClass } from './types';

interface CcPlayer { username: string; rating?: number }
interface CcGame {
  uuid: string;
  url: string;
  rules: string;
  time_class: string;
  end_time: number;
  white: CcPlayer;
  black: CcPlayer;
  pgn: string;
}

const CLASS: Record<string, TimeClass> = {
  bullet: 'bullet',
  blitz: 'blitz',
  rapid: 'rapid',
  daily: 'classical',
};

const player = (p: CcPlayer): Player => ({ name: p.username, rating: p.rating ?? null, aiLevel: null });

export async function fetchChesscomGames(
  username: string,
  signal?: AbortSignal,
  fetchFn: typeof fetch = fetch,
): Promise<GameSummary[]> {
  const base = `https://api.chess.com/pub/player/${username.toLowerCase()}/games`;
  const index = parseJson<{ archives?: unknown }>(await getText(`${base}/archives`, fetchFn, signal));
  const archives = index?.archives;
  if (!Array.isArray(archives)) throw new GameError('network');
  const games: GameSummary[] = [];
  for (const monthUrl of [...(archives as string[])].reverse()) {
    if (games.length >= MAX_GAMES) break;
    let month: { games?: CcGame[] };
    try {
      month = parseJson<{ games?: CcGame[] }>(await getText(monthUrl, fetchFn, signal));
    } catch (e) {
      if (e instanceof HttpError && e.code !== 'rate-limited') continue;
      throw e;
    }
    for (const g of month?.games ?? []) {
      const timeClass = CLASS[g.time_class];
      if (g.rules !== 'chess' || !timeClass || /\[SetUp\s+"1"\]/.test(g.pgn)) continue;
      games.push({
        id: g.uuid,
        source: 'chesscom',
        url: g.url,
        white: player(g.white),
        black: player(g.black),
        result: readResult(g.pgn),
        timeClass,
        playedAt: g.end_time * 1000,
        pgn: g.pgn,
      });
    }
  }
  return sortAndCap(games);
}
