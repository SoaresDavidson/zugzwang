import { moverWin, scoreToCp, winPercent } from '../../src/core/winPercent';

it('win% de 0 cp é 50', () => expect(winPercent(0)).toBeCloseTo(50, 5));
it('win% de +100 cp', () => expect(winPercent(100)).toBeCloseTo(59.10, 1));
it('win% de -100 cp', () => expect(winPercent(-100)).toBeCloseTo(40.90, 1));
it('mate vira MATE_CP com sinal', () => {
  expect(scoreToCp({ kind: 'mate', value: 3 })).toBe(10000);
  expect(scoreToCp({ kind: 'mate', value: -2 })).toBe(-10000);
});
it('cp passa direto', () => expect(scoreToCp({ kind: 'cp', value: -42 })).toBe(-42));
it('moverWin mantém para as brancas', () =>
  expect(moverWin({ kind: 'cp', value: 100 }, 'w')).toBeCloseTo(59.10, 1));
it('moverWin inverte para as pretas', () =>
  expect(moverWin({ kind: 'cp', value: 100 }, 'b')).toBeCloseTo(40.90, 1));
it('mate dá win% perto de 100 para quem dá mate', () =>
  expect(moverWin({ kind: 'mate', value: 1 }, 'w')).toBeGreaterThan(99.9));
