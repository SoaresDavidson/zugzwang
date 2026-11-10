import { isSacrifice, materialSwing } from '../../src/core/material';

const F = '4k3/8/4p3/8/8/8/8/3QK3 w - - 0 1';

it('dama entregue é sacrifício', () => {
  expect(materialSwing(F, 'd1d5', ['e6d5'])).toBe(-9);
  expect(isSacrifice(F, 'd1d5', ['e6d5'])).toBe(true);
});
it('lance quieto não é sacrifício', () => expect(isSacrifice(F, 'd1d2', ['e8d7'])).toBe(false));
it('troca equilibrada não é sacrifício', () =>
  expect(materialSwing('4k3/3p4/4n3/8/3N4/8/8/4K3 w - - 0 1', 'd4e6', ['d7e6'])).toBe(0));
it('respeita a janela de plies', () =>
  expect(materialSwing(F, 'd1d2', ['e8d7', 'd2d7'], 1)).toBe(0));
it('para em PV ilegal sem lançar', () => expect(materialSwing(F, 'd1d2', ['a1a2'])).toBe(0));

// Casos de borda adicionais (todos os lances conferidos como legais com chess.js).
it('janela de plies corta captura além do limite e inclui dentro dele', () => {
  const pv = ['e8d8', 'e2e6'];
  expect(materialSwing(F, 'd1e2', pv, 1)).toBe(0);
  expect(materialSwing(F, 'd1e2', pv, 2)).toBe(1);
  expect(materialSwing(F, 'd1e2', pv)).toBe(1);
});
it('PV vazia só conta o lance jogado', () => {
  expect(materialSwing(F, 'd1d5', [])).toBe(0);
});
it('promoção conta o ganho líquido (dama menos peão)', () =>
  expect(materialSwing('7k/P7/8/8/8/8/8/K7 w - - 0 1', 'a7a8q', [])).toBe(8));
it('captura en passant conta o peão capturado', () =>
  expect(materialSwing('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', 'e5d6', [])).toBe(1));
it('pretas movendo: dama entregue é sacrifício', () => {
  const fen = '3qk3/8/8/8/8/8/8/4K3 b - - 0 1';
  expect(materialSwing(fen, 'd8d2', ['e1d2'])).toBe(-9);
  expect(isSacrifice(fen, 'd8d2', ['e1d2'])).toBe(true);
});
it('pretas movendo: captura de peão dá ganho e não é sacrifício', () => {
  const fen = '4k3/8/8/3P4/8/8/8/3qK3 b - - 0 1';
  expect(materialSwing(fen, 'd1d5', [])).toBe(1);
  expect(isSacrifice(fen, 'd1d5', [])).toBe(false);
});
