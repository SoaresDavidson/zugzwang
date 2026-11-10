import { classifyMove, moveLoss, type ClassifyInput } from '../../src/core/classify';
import type { PositionEval } from '../../src/core/types';

type Cp = number | { mate: number };

function ev(lines: [string, Cp][]): PositionEval {
  return {
    fen: '',
    lines: lines.map(([move, s]) => ({
      move,
      pv: [move],
      score: typeof s === 'number' ? { kind: 'cp' as const, value: s } : { kind: 'mate' as const, value: s.mate },
    })),
  };
}

const base = { color: 'w' as const, isBook: false, isSacrifice: false };

describe('classifyMove', () => {
  it('book vence tudo', () => expect(classifyMove({ ...base, isBook: true, uci: 'a2a3',
    before: ev([['e2e4', 30]]), after: ev([['x', -800]]) })).toBe('book'));
  it('best', () => expect(classifyMove({ ...base, uci: 'e2e4',
    before: ev([['e2e4', 30], ['d2d4', 25]]), after: ev([['e7e5', 30]]) })).toBe('best'));
  it('great: único lance bom', () => expect(classifyMove({ ...base, uci: 'g1f3',
    before: ev([['g1f3', 0], ['e2e4', -300]]), after: ev([['x', 0]]) })).toBe('great'));
  it('brilliant', () => expect(classifyMove({ ...base, isSacrifice: true, uci: 'd1d5',
    before: ev([['d1d5', 50], ['e2e4', 40]]), after: ev([['x', 50]]) })).toBe('brilliant'));
  it('sem brilhante quando já ganhava fácil', () => expect(classifyMove({ ...base, isSacrifice: true, uci: 'd1d5',
    before: ev([['d1d5', 700], ['e2e4', 690]]), after: ev([['x', 700]]) })).toBe('best'));
  it.each([[20, 'excellent'], [-20, 'good'], [-120, 'inaccuracy'], [-250, 'mistake'], [-800, 'blunder']])
    ('depois %i cp → %s', (cp, cat) => expect(classifyMove({ ...base, uci: 'a2a3',
      before: ev([['e2e4', 30]]), after: ev([['x', cp]]) })).toBe(cat));
  it('perspectiva das pretas', () => expect(classifyMove({ ...base, color: 'b', uci: 'a7a6',
    before: ev([['e7e5', -30]]), after: ev([['x', 200]]) })).toBe('mistake'));
  it('missedMate', () => expect(classifyMove({ ...base, uci: 'a2a3',
    before: ev([['d1h5', { mate: 3 }]]), after: ev([['x', 500]]) })).toBe('missedMate'));
  it('mate ainda disponível não é missedMate', () => expect(classifyMove({ ...base, uci: 'd1h5',
    before: ev([['d1h5', { mate: 3 }]]), after: ev([['x', { mate: 2 }]]) })).toBe('best'));
  it('dar o mate não é missedMate', () => expect(classifyMove({ ...base, uci: 'h5f7',
    before: ev([['h5f7', { mate: 1 }]]), after: ev([['', 10000]]) })).toBe('best'));
});

describe('moveLoss', () => {
  const input = (beforeCp: number, afterCp: number): ClassifyInput => ({ ...base, uci: 'a2a3',
    before: ev([['e2e4', beforeCp]]), after: ev([['x', afterCp]]) });

  it('perda positiva quando a avaliação cai', () => expect(moveLoss(input(30, -120))).toBeCloseTo(13.63, 1));
  it('perda das pretas usa o ponto de vista delas', () => expect(moveLoss({ ...base, color: 'b', uci: 'a7a6',
    before: ev([['e7e5', -30]]), after: ev([['x', 200]]) })).toBeCloseTo(20.38, 1));
  it('nunca negativa quando a avaliação sobe', () => expect(moveLoss(input(-100, 300))).toBe(0));
  it('zero quando a avaliação não muda', () => expect(moveLoss(input(30, 30))).toBe(0));
  it('nunca negativa para as pretas', () => expect(moveLoss({ ...base, color: 'b', uci: 'a7a6',
    before: ev([['e7e5', 100]]), after: ev([['x', -300]]) })).toBe(0));
});
