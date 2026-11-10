// Testes de regressão do code review da L1. Ficam ocultos do agente corretor.
import { parsePgn } from '../../src/core/pgn';
import { GameError } from '../../src/core/types';
import { moverCp, isMateFor } from '../../src/core/winPercent';
import { toEpd as toEpdShared } from '../../src/core/epd';
import { toEpd as toEpdOpenings } from '../../src/core/openings';
import { parseUci } from '../../src/core/moves';
import { PIECE_VALUE } from '../../src/core/thresholds';
import { materialSwing } from '../../src/core/material';

function codeOf(fn: () => unknown): string | undefined {
  try { fn(); } catch (e) { return e instanceof GameError ? e.code : 'not-game-error'; }
  return undefined;
}

describe('F1: variante e posição customizada são checadas antes do chess.js', () => {
  it('960 com FEN e roque de 960 → variant-unsupported', () =>
    expect(codeOf(() => parsePgn('[Variant "Chess960"]\n[SetUp "1"]\n[FEN "bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w HFhf - 0 1"]\n\n1. g3 *')))
      .toBe('variant-unsupported'));
  it('Crazyhouse com drop → variant-unsupported', () =>
    expect(codeOf(() => parsePgn('[Variant "Crazyhouse"]\n\n1. e4 d5 2. exd5 Qxd5 3. N@f3 *'))).toBe('variant-unsupported'));
  it('960 com lance que seria ilegal no padrão → variant-unsupported', () =>
    expect(codeOf(() => parsePgn('[Variant "Chess960"]\n\n1. e5 *'))).toBe('variant-unsupported'));
  it('posição customizada com lances ilegais no padrão → custom-position', () =>
    expect(codeOf(() => parsePgn('[SetUp "1"]\n[FEN "8/8/8/8/8/8/8/K6k w - - 0 1"]\n\n1. Kb1 Kh2 2. e4 *'))).toBe('custom-position'));
  it('Variant "Standard" continua aceito', () =>
    expect(parsePgn('[Variant "Standard"]\n\n1. e4 *').plies).toHaveLength(1));
});

describe('F2: troca de ponto de vista centralizada em winPercent', () => {
  it('moverCp', () => {
    expect(moverCp({ kind: 'cp', value: 100 }, 'w')).toBe(100);
    expect(moverCp({ kind: 'cp', value: 100 }, 'b')).toBe(-100);
    expect(moverCp({ kind: 'mate', value: -2 }, 'b')).toBe(10000);
  });
  it('isMateFor', () => {
    expect(isMateFor({ kind: 'mate', value: 3 }, 'w')).toBe(true);
    expect(isMateFor({ kind: 'mate', value: 3 }, 'b')).toBe(false);
    expect(isMateFor({ kind: 'mate', value: -1 }, 'b')).toBe(true);
    expect(isMateFor({ kind: 'cp', value: 10000 }, 'w')).toBe(false);
  });
});

describe('F3: toEpd em um só lugar', () => {
  it('epd.ts e openings.ts expõem a mesma função', () => {
    expect(toEpdShared).toBe(toEpdOpenings);
    expect(toEpdShared('8/8/8/8/8/8/8/K6k w - - 12 40')).toBe('8/8/8/8/8/8/8/K6k w - -');
  });
});

describe('F4: parsing de UCI em um só lugar', () => {
  it('lance simples', () => expect(parseUci('e2e4')).toEqual({ from: 'e2', to: 'e4' }));
  it('promoção', () => expect(parseUci('a7a8q')).toEqual({ from: 'a7', to: 'a8', promotion: 'q' }));
});

describe('F5: valores de peça em thresholds', () => {
  it('PIECE_VALUE', () => expect(PIECE_VALUE).toEqual({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }));
  it('materialSwing segue usando os mesmos valores', () =>
    expect(materialSwing('4k3/8/4p3/8/8/8/8/3QK3 w - - 0 1', 'd1d5', ['e6d5'])).toBe(-9));
});
