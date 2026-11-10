import type { MoveCategory } from '../src/core/types';

export interface CalibrationFixture { pgn: string; expected: (MoveCategory | null)[] }
export interface CategoryStats { expected: number; predicted: number; agreed: number }
export interface CalibrationResult {
  perCategory: Record<MoveCategory, CategoryStats>;
  overall: { compared: number; agreed: number };
}

const CATEGORIES: MoveCategory[] = [
  'book', 'brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder', 'missedMate',
];

export function compareCategories(
  fixtures: { expected: (MoveCategory | null)[]; actual: MoveCategory[] }[],
): CalibrationResult {
  const perCategory = Object.fromEntries(
    CATEGORIES.map((c) => [c, { expected: 0, predicted: 0, agreed: 0 }]),
  ) as Record<MoveCategory, CategoryStats>;
  const overall = { compared: 0, agreed: 0 };
  fixtures.forEach((f, idx) => {
    if (f.expected.length !== f.actual.length) {
      throw new Error(`fixture ${idx}: expected tem ${f.expected.length} lances, actual tem ${f.actual.length}`);
    }
    f.expected.forEach((exp, i) => {
      if (exp === null) return;
      const act = f.actual[i];
      overall.compared++;
      perCategory[exp].expected++;
      perCategory[act].predicted++;
      if (exp === act) {
        perCategory[exp].agreed++;
        overall.agreed++;
      }
    });
  });
  return { perCategory, overall };
}

const pct = (a: number, b: number) => (b === 0 ? '—' : `${Math.round((a / b) * 100)}%`);

export function formatReport(result: CalibrationResult): string {
  const rows = CATEGORIES.map((c) => {
    const s = result.perCategory[c];
    return `${c.padEnd(12)} recall ${`${s.agreed}/${s.expected}`.padEnd(8)} ${pct(s.agreed, s.expected).padStart(5)}   precisão ${`${s.agreed}/${s.predicted}`.padEnd(8)} ${pct(s.agreed, s.predicted).padStart(5)}`;
  });
  const { agreed, compared } = result.overall;
  rows.push('', `Concordância geral: ${agreed}/${compared} ${pct(agreed, compared)}`);
  return rows.join('\n');
}
