export type Source = 'lichess' | 'chesscom';
export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'classical';
export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export interface Player {
  name: string | null;
  rating: number | null;
  aiLevel: number | null;
}

export interface GameSummary {
  id: string;
  source: Source;
  url: string;
  white: Player;
  black: Player;
  result: GameResult;
  timeClass: TimeClass;
  playedAt: number;
  pgn: string;
}
