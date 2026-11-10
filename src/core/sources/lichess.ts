import { getText, readResult, sortAndCap } from './http'
import type { GameSummary, TimeClass } from './types'

interface LichessPlayer { user?: { name?: string }; rating?: number }
interface LichessGame {
  id: string
  variant: string
  speed: string
  createdAt: number
  players: { white: LichessPlayer; black: LichessPlayer }
  pgn: string
}

const SPEED: Record<string, TimeClass> = {
  ultraBullet: 'bullet',
  bullet: 'bullet',
  blitz: 'blitz',
  rapid: 'rapid',
  classical: 'classical',
  correspondence: 'classical',
}

const player = (p: LichessPlayer) => ({ name: p.user?.name ?? 'Anônimo', rating: p.rating ?? null })

export async function fetchLichessGames(
  username: string,
  signal?: AbortSignal,
  fetchFn: typeof fetch = fetch,
): Promise<GameSummary[]> {
  const url = `https://lichess.org/api/games/user/${username}?max=50&pgnInJson=true&perfType=ultraBullet,bullet,blitz,rapid,classical,correspondence`
  const text = await getText(url, fetchFn, signal, { Accept: 'application/x-ndjson' })
  const games: GameSummary[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const g = JSON.parse(line) as LichessGame
    const timeClass = SPEED[g.speed]
    if (g.variant !== 'standard' || !timeClass) continue
    games.push({
      id: g.id,
      source: 'lichess',
      url: `https://lichess.org/${g.id}`,
      white: player(g.players.white),
      black: player(g.players.black),
      result: readResult(g.pgn),
      timeClass,
      playedAt: g.createdAt,
      pgn: g.pgn,
    })
  }
  return sortAndCap(games)
}
