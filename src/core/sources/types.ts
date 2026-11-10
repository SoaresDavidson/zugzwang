export type Source = 'lichess' | 'chesscom'
export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'classical'
export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*'

export interface GameSummary {
  id: string
  source: Source
  url: string
  white: { name: string; rating: number | null }
  black: { name: string; rating: number | null }
  result: GameResult
  timeClass: TimeClass
  playedAt: number
  pgn: string
}
