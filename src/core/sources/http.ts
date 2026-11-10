import { GameError } from '../types'
import type { GameResult, GameSummary } from './types'

export const MAX_GAMES = 50

/** GET com tradução de erros: AbortError passa; o resto vira GameError. */
export async function getText(
  url: string,
  fetchFn: typeof fetch,
  signal?: AbortSignal,
  headers?: Record<string, string>,
): Promise<string> {
  let res: Response
  try {
    res = await fetchFn(url, { signal, headers })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e
    throw new GameError('network')
  }
  if (res.status === 404) throw new GameError('user-not-found')
  if (res.status === 429) throw new GameError('rate-limited')
  if (!res.ok) throw new GameError('network')
  try {
    return await res.text()
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e
    throw new GameError('network')
  }
}

export function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    throw new GameError('network')
  }
}

export function readResult(pgn: string): GameResult {
  const m = /\[Result\s+"([^"]*)"\]/.exec(pgn)
  const r = m?.[1]
  return r === '1-0' || r === '0-1' || r === '1/2-1/2' ? r : '*'
}

/** Mais recentes primeiro, no máximo MAX_GAMES. */
export function sortAndCap(games: GameSummary[]): GameSummary[] {
  return [...games].sort((a, b) => b.playedAt - a.playedAt).slice(0, MAX_GAMES)
}
