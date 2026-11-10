import { ACHIEVEMENT_RULES as R } from './thresholds';
import type { CategoryCounts, Color } from './types';

export interface Profile { lichess?: string; chesscom?: string }

export interface HistoryEntry {
  key: string;
  analyzedAt: number;
  playedAt: number | null;
  playerColor: Color;
  counts: CategoryCounts;
  accuracy: number;
  ownMoves: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt: number | null;
}

export function playerColorFor(headers: Record<string, string>, profile: Profile): Color | null {
  const names = [profile.lichess, profile.chesscom]
    .filter((n): n is string => !!n)
    .map((n) => n.toLowerCase());
  if (names.length === 0) return null;
  if (headers.White && names.includes(headers.White.toLowerCase())) return 'w';
  if (headers.Black && names.includes(headers.Black.toLowerCase())) return 'b';
  return null;
}

/** Mês civil no fuso local. */
const monthOf = (t: number) => {
  const d = new Date(t);
  return d.getFullYear() * 12 + d.getMonth();
};

interface Definition {
  id: string;
  title: string;
  description: string;
  unlockedAt: number | null;
}

export function evaluateAchievements(history: HistoryEntry[], now: number): Achievement[] {
  const byAnalyzed = [...history].sort((a, b) => a.analyzedAt - b.analyzedAt);
  const nowMonth = monthOf(now);

  const firstWhere = (pred: (e: HistoryEntry) => boolean): number | null =>
    byAnalyzed.find(pred)?.analyzedAt ?? null;

  const nth = (n: number): number | null => byAnalyzed[n - 1]?.analyzedAt ?? null;

  let brilliantSum = 0;
  let firstBrilliant: number | null = null;
  let monthSum = 0;
  let monthUnlock: number | null = null;
  for (const e of byAnalyzed) {
    brilliantSum += e.counts.brilliant;
    if (firstBrilliant === null && brilliantSum >= 1) firstBrilliant = e.analyzedAt;
    if (monthOf(e.analyzedAt) === nowMonth) {
      monthSum += e.counts.brilliant;
      if (monthUnlock === null && monthSum >= R.monthBrilliants) monthUnlock = e.analyzedAt;
    }
  }

  const byPlayed = [...history].sort(
    (a, b) => (a.playedAt ?? a.analyzedAt) - (b.playedAt ?? b.analyzedAt),
  );
  let streak = 0;
  let streakUnlock: number | null = null;
  for (const e of byPlayed) {
    streak = e.accuracy >= R.streakAccuracy ? streak + 1 : 0;
    if (streak >= R.streakLength) { streakUnlock = e.analyzedAt; break; }
  }

  const defs: Definition[] = [
    {
      id: 'primeira-revisao',
      title: 'Primeira revisão',
      description: 'Revise a sua primeira partida.',
      unlockedAt: nth(1),
    },
    {
      id: 'dez-revisoes',
      title: 'Dez revisões',
      description: `Revise ${R.reviewsForTen} partidas.`,
      unlockedAt: nth(R.reviewsForTen),
    },
    {
      id: 'primeiro-brilhante',
      title: 'Primeiro brilhante',
      description: 'Faça pelo menos um lance brilhante em alguma partida.',
      unlockedAt: firstBrilliant,
    },
    {
      id: 'cinco-brilhantes-mes',
      title: 'Mês brilhante',
      description: `Acumule ${R.monthBrilliants} lances brilhantes em partidas revisadas no mesmo mês.`,
      unlockedAt: monthUnlock,
    },
    {
      id: 'precisao-90',
      title: 'Precisão cirúrgica',
      description: `Termine uma partida com precisão de ${R.surgicalAccuracy}% ou mais.`,
      unlockedAt: firstWhere((e) => e.accuracy >= R.surgicalAccuracy),
    },
    {
      id: 'sem-capivarada',
      title: 'Partida limpa',
      description: `Jogue ${R.cleanGameMoves} lances ou mais sem nenhum erro grave nem mate perdido.`,
      unlockedAt: firstWhere(
        (e) => e.ownMoves >= R.cleanGameMoves && e.counts.blunder === 0 && e.counts.missedMate === 0,
      ),
    },
    {
      id: 'sequencia-3',
      title: 'Em sequência',
      description: `Tenha precisão de ${R.streakAccuracy}% ou mais em ${R.streakLength} partidas seguidas.`,
      unlockedAt: streakUnlock,
    },
  ];
  return defs.map(({ id, title, description, unlockedAt }) => ({
    id, title, description, unlocked: unlockedAt !== null, unlockedAt,
  }));
}
