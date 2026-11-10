/*
 * Contrato (Task 15, calibração):
 * - scripts/calibration.ts (puro):
 *   interface CalibrationFixture { pgn: string; expected: (MoveCategory | null)[] }
 *   interface CategoryStats { expected: number; predicted: number; agreed: number }
 *   compareCategories(fixtures: { expected: (MoveCategory|null)[]; actual: MoveCategory[] }[]):
 *     { perCategory: Record<MoveCategory, CategoryStats>; overall: { compared: number; agreed: number } }
 *     - ignora posições com `expected` null (não contam em nada);
 *     - `expected` com tamanho diferente de `actual` lança erro que menciona o índice da fixture.
 *   formatReport(result): string — uma linha por categoria com recall (agreed/expected) e
 *     precisão (agreed/predicted) em %, mais a concordância geral; sem ocorrências mostra "—".
 * - scripts/nodeEngine.ts: createNodeEngine(): Promise<Engine & { quit(): void }>.
 */
import { compareCategories, formatReport } from '../../scripts/calibration';
import type { MoveCategory } from '../../src/core/types';

const CATS: MoveCategory[] = [
  'book', 'brilliant', 'great', 'best', 'excellent', 'good',
  'inaccuracy', 'mistake', 'blunder', 'missedMate',
];

describe('compareCategories', () => {
  it('conta expected, predicted e agreed por categoria', () => {
    const r = compareCategories([
      {
        expected: ['best', 'best', 'blunder', 'good'],
        actual: ['best', 'good', 'blunder', 'good'],
      },
    ]);
    expect(r.perCategory.best).toEqual({ expected: 2, predicted: 1, agreed: 1 });
    expect(r.perCategory.good).toEqual({ expected: 1, predicted: 2, agreed: 1 });
    expect(r.perCategory.blunder).toEqual({ expected: 1, predicted: 1, agreed: 1 });
    expect(r.perCategory.book).toEqual({ expected: 0, predicted: 0, agreed: 0 });
    expect(r.overall).toEqual({ compared: 4, agreed: 3 });
  });

  it('tem todas as categorias no resultado', () => {
    const r = compareCategories([]);
    expect(Object.keys(r.perCategory).sort()).toEqual([...CATS].sort());
    expect(r.overall).toEqual({ compared: 0, agreed: 0 });
  });

  it('ignora posições com expected null', () => {
    const r = compareCategories([
      { expected: [null, 'best', null], actual: ['blunder', 'best', 'mistake'] },
    ]);
    expect(r.overall).toEqual({ compared: 1, agreed: 1 });
    expect(r.perCategory.blunder.predicted).toBe(0);
    expect(r.perCategory.mistake.predicted).toBe(0);
    expect(r.perCategory.best).toEqual({ expected: 1, predicted: 1, agreed: 1 });
  });

  it('soma várias fixtures', () => {
    const r = compareCategories([
      { expected: ['book', 'best'], actual: ['book', 'good'] },
      { expected: ['best'], actual: ['best'] },
    ]);
    expect(r.perCategory.best).toEqual({ expected: 2, predicted: 1, agreed: 1 });
    expect(r.overall).toEqual({ compared: 3, agreed: 2 });
  });

  it('lança com o índice da fixture quando os tamanhos divergem', () => {
    expect(() =>
      compareCategories([
        { expected: ['best'], actual: ['best'] },
        { expected: ['best', 'good'], actual: ['best'] },
      ]),
    ).toThrow(/1/);
  });

  it('concordância total e nula', () => {
    const all = compareCategories([{ expected: ['best', 'blunder'], actual: ['best', 'blunder'] }]);
    expect(all.overall).toEqual({ compared: 2, agreed: 2 });
    const none = compareCategories([{ expected: ['best', 'blunder'], actual: ['good', 'mistake'] }]);
    expect(none.overall).toEqual({ compared: 2, agreed: 0 });
    expect(none.perCategory.best.agreed).toBe(0);
  });
});

describe('formatReport', () => {
  const line = (out: string, cat: string) => {
    const l = out.split('\n').find((x) => x.includes(cat));
    expect(l).toBeDefined();
    return l as string;
  };

  it('mostra recall, precisão e concordância geral em %', () => {
    const out = formatReport(
      compareCategories([{ expected: ['best', 'best', 'blunder', 'good'], actual: ['best', 'good', 'blunder', 'good'] }]),
    );
    expect(line(out, 'best')).toContain('1/2');
    expect(line(out, 'best')).toContain('50%');
    expect(line(out, 'best')).toContain('1/1');
    expect(line(out, 'best')).toContain('100%');
    expect(line(out, 'good')).toContain('1/2');
    expect(out).toContain('75%');
    expect(out).toContain('3/4');
  });

  it('categorias sem ocorrências mostram —', () => {
    const out = formatReport(compareCategories([{ expected: ['best'], actual: ['best'] }]));
    expect(line(out, 'brilliant')).toContain('—');
    expect(out).not.toContain('NaN');
  });

  it('0% quando nada concorda', () => {
    const out = formatReport(compareCategories([{ expected: ['best'], actual: ['good'] }]));
    expect(line(out, 'best')).toContain('0%');
    expect(out).toContain('0/1');
  });

  it('100% quando tudo concorda', () => {
    const out = formatReport(compareCategories([{ expected: ['best', 'good'], actual: ['best', 'good'] }]));
    expect(out).toContain('100%');
  });

  it('uma linha por categoria', () => {
    const out = formatReport(compareCategories([]));
    for (const c of CATS) expect(out).toContain(c);
  });
});
