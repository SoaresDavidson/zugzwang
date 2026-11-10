import { vi } from 'vitest';
import { classifyMove, moveLoss, type ClassifyInput } from '../../src/core/classify';
import type { PositionEval } from '../../src/core/types';

// moverWin simplificado: o valor `cp` da linha vale como win% das brancas, para fixar perdas exatas.
vi.mock('../../src/core/winPercent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/winPercent')>();
  return {
    ...actual,
    moverWin: (s: { kind: 'cp' | 'mate'; value: number }, color: 'w' | 'b') => {
      const v = s.kind === 'cp' ? s.value : Math.sign(s.value) * 100;
      return color === 'w' ? v : 100 - v;
    },
  };
});

function ev(lines: [string, number][]): PositionEval {
  return { fen: '', lines: lines.map(([move, v]) => ({ move, pv: [move], score: { kind: 'cp' as const, value: v } })) };
}

const base = { color: 'w' as const, isBook: false, isSacrifice: false };
// Antes 50 (win% mockado), depois 50 - loss. Lance diferente do melhor, para cair na regra 6.
const withLoss = (loss: number): ClassifyInput => ({ ...base, uci: 'a2a3',
  before: ev([['e2e4', 50]]), after: ev([['x', 50 - loss]]) });

describe('fronteiras dos limiares (regra 6)', () => {
  it.each([
    [0, 'excellent'], [1.99, 'excellent'], [2, 'good'], [4.99, 'good'], [9.99, 'good'],
    [10, 'inaccuracy'], [19.99, 'inaccuracy'], [20, 'mistake'], [29.99, 'mistake'],
    [30, 'blunder'], [45, 'blunder'],
  ])('perda %f → %s', (loss, cat) => expect(classifyMove(withLoss(loss))).toBe(cat));

  it('moveLoss devolve a perda exata', () => expect(moveLoss(withLoss(10))).toBe(10));
  it('moveLoss nunca é negativo', () => expect(moveLoss(withLoss(-25))).toBe(0));
});

describe('fronteiras de brilhante', () => {
  const sac = (loss: number, winBefore: number): ClassifyInput => ({ ...base, isSacrifice: true, uci: 'd1d5',
    before: ev([['d1d5', winBefore], ['e2e4', winBefore - 1]]), after: ev([['x', winBefore - loss]]) });

  it('perda exatamente 2 ainda é brilhante', () => expect(classifyMove(sac(2, 50))).toBe('brilliant'));
  it('perda acima de 2 não é brilhante', () => expect(classifyMove(sac(2.01, 50))).toBe('best'));
  it('win% antes exatamente 90 não é brilhante', () => expect(classifyMove(sac(0, 90))).toBe('best'));
  it('win% antes logo abaixo de 90 é brilhante', () => expect(classifyMove(sac(0, 89.99))).toBe('brilliant'));
  it('sem sacrifício não é brilhante', () => expect(classifyMove({ ...sac(0, 50), isSacrifice: false })).toBe('best'));
});

describe('fronteira de great', () => {
  const gap = (g: number): ClassifyInput => ({ ...base, uci: 'g1f3',
    before: ev([['g1f3', 50], ['e2e4', 50 - g]]), after: ev([['x', 50]]) });

  it('diferença exatamente 20 é great', () => expect(classifyMove(gap(20))).toBe('great'));
  it('diferença abaixo de 20 é best', () => expect(classifyMove(gap(19.99))).toBe('best'));
  it('sem segunda linha é best', () => expect(classifyMove({ ...base, uci: 'g1f3',
    before: ev([['g1f3', 50]]), after: ev([['x', 50]]) })).toBe('best'));
});
