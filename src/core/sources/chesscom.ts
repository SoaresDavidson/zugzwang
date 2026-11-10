import { getText, MAX_GAMES, parseJson, readResult, sortAndCap } from './http'
import type { GameSummary, TimeClass } from './types'

interface CcPlayer { username: string; rating?: number }
interface CcGame {
  uuid: string
  url: string
  rules: string
  time_class: string
  end_time: number
  white: CcPlayer
  black: CcPlayer
  pgn: string
}

const CLASS: Record<string, TimeClass> = {
  bullet: 'bullet',
  blitz: 'blitz',
  rapid: 'rapid',
  daily: 'classical',
}

const player = (p: CcPlayer) => ({ name: p.username, rating: p.rating ?? null })

export async function fetchChesscomGames(
  username: string,
  signal?: AbortSignal,
  fetchFn: typeof fetch = fetch,
): Promise<GameSummary[]> {
  const base = `https://api.chess.com/pub/player/${username.toLowerCase()}/games`
  const { archives } = parseJson<{ archives: string[] }>(await getText(`${base}/archives`, fetchFn, signal))
  const games: GameSummary[] = []
  for (const monthUrl of [...archives].reverse()) {
    if (games.length >= MAX_GAMES) break
    const month = parseJson<{ games?: CcGame[] }>(await getText(monthUrl, fetchFn, signal))
    for (const g of month.games ?? []) {
      const timeClass = CLASS[g.time_class]
      if (g.rules !== 'chess' || !timeClass || /\[SetUp\s+"1"\]/.test(g.pgn)) continue
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
      })
    }
  }
  return sortAndCap(games)
}
