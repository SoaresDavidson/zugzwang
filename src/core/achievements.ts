import type { CategoryCounts, Color } from './types'

export interface Profile { lichess?: string; chesscom?: string }

export interface HistoryEntry {
  key: string
  analyzedAt: number
  playedAt: number | null
  playerColor: Color
  counts: CategoryCounts
  accuracy: number
  ownMoves: number
}

export interface Achievement {
  id: string
  title: string
  description: string
  unlocked: boolean
  unlockedAt: number | null
}

export function playerColorFor(headers: Record<string, string>, profile: Profile): Color | null {
  const names = [profile.lichess, profile.chesscom]
    .filter((n): n is string => !!n)
    .map((n) => n.toLowerCase())
  if (names.length === 0) return null
  if (headers.White && names.includes(headers.White.toLowerCase())) return 'w'
  if (headers.Black && names.includes(headers.Black.toLowerCase())) return 'b'
  return null
}

const monthOf = (t: number) => {
  const d = new Date(t)
  return d.getUTCFullYear() * 12 + d.getUTCMonth()
}

export function evaluateAchievements(history: HistoryEntry[], now: number): Achievement[] {
  const byAnalyzed = [...history].sort((a, b) => a.analyzedAt - b.analyzedAt)
  const nowMonth = monthOf(now)

  const firstWhere = (pred: (e: HistoryEntry) => boolean): number | null =>
    byAnalyzed.find(pred)?.analyzedAt ?? null

  const nth = (n: number): number | null => byAnalyzed[n - 1]?.analyzedAt ?? null

  let brilliantSum = 0
  let firstBrilliant: number | null = null
  let monthSum = 0
  let monthUnlock: number | null = null
  for (const e of byAnalyzed) {
    brilliantSum += e.counts.brilliant
    if (firstBrilliant === null && brilliantSum >= 1) firstBrilliant = e.analyzedAt
    if (monthOf(e.analyzedAt) === nowMonth) {
      monthSum += e.counts.brilliant
      if (monthUnlock === null && monthSum >= 5) monthUnlock = e.analyzedAt
    }
  }

  const byPlayed = [...history].sort(
    (a, b) => (a.playedAt ?? a.analyzedAt) - (b.playedAt ?? b.analyzedAt),
  )
  let streak = 0
  let streakUnlock: number | null = null
  for (const e of byPlayed) {
    streak = e.accuracy >= 80 ? streak + 1 : 0
    if (streak >= 3) { streakUnlock = e.analyzedAt; break }
  }

  const defs: [string, string, string, number | null][] = [
    ['primeira-revisao', 'Primeira revisão', 'Revise a sua primeira partida.', nth(1)],
    ['dez-revisoes', 'Dez revisões', 'Revise 10 partidas.', nth(10)],
    ['primeiro-brilhante', 'Primeiro brilhante', 'Faça pelo menos um lance brilhante em alguma partida.', firstBrilliant],
    ['cinco-brilhantes-mes', 'Mês brilhante', 'Acumule 5 lances brilhantes em partidas revisadas no mesmo mês.', monthUnlock],
    ['precisao-90', 'Precisão cirúrgica', 'Termine uma partida com precisão de 90% ou mais.', firstWhere((e) => e.accuracy >= 90)],
    ['sem-capivarada', 'Partida limpa', 'Jogue 20 lances ou mais sem nenhum erro grave nem mate perdido.',
      firstWhere((e) => e.ownMoves >= 20 && e.counts.blunder === 0 && e.counts.missedMate === 0)],
    ['sequencia-3', 'Em sequência', 'Tenha precisão de 80% ou mais em 3 partidas seguidas.', streakUnlock],
  ]
  return defs.map(([id, title, description, at]) => ({
    id, title, description, unlocked: at !== null, unlockedAt: at,
  }))
}
