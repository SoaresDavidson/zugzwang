import { MAX_GAMES } from '../thresholds';
import { getText, readResult, sortAndCap } from './http';
import type { GameSummary, Player, TimeClass } from './types';

interface LichessPlayer { user?: { name?: string }; rating?: number; aiLevel?: number }
interface LichessGame {
  id: string;
  variant: string;
  speed: string;
  createdAt: number;
  players?: { white?: LichessPlayer; black?: LichessPlayer };
  pgn: string;
}

const SPEED: Record<string, TimeClass> = {
  ultraBullet: 'bullet',
  bullet: 'bullet',
  blitz: 'blitz',
  rapid: 'rapid',
  classical: 'classical',
  correspondence: 'classical',
};

const player = (p: LichessPlayer): Player => ({
  name: p.user?.name ?? null,
  rating: p.rating ?? null,
  aiLevel: p.aiLevel ?? null,
});

export async function fetchLichessGames(
  username: string,
  signal?: AbortSignal,
  fetchFn: typeof fetch = fetch,
): Promise<GameSummary[]> {
  const url = `https://lichess.org/api/games/user/${username}?max=${MAX_GAMES}&pgnInJson=true&perfType=ultraBullet,bullet,blitz,rapid,classical,correspondence`;
  const text = await getText(url, fetchFn, signal, { Accept: 'application/x-ndjson' });
  const games: GameSummary[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let g: LichessGame;
    try {
      g = JSON.parse(line) as LichessGame;
    } catch {
      continue;
    }
    const white = g?.players?.white;
    const black = g?.players?.black;
    if (!white || !black) continue;
    const timeClass = SPEED[g.speed];
    if (g.variant !== 'standard' || !timeClass) continue;
    games.push({
      id: g.id,
      source: 'lichess',
      url: `https://lichess.org/${g.id}`,
      white: player(white),
      black: player(black),
      result: readResult(g.pgn),
      timeClass,
      playedAt: g.createdAt,
      pgn: g.pgn,
    });
  }
  return sortAndCap(games);
}
