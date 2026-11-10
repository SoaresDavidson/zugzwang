import { estimateRating, gameAccuracy, moveAccuracy } from '../../src/core/accuracy';

describe('moveAccuracy', () => {
  it('lance perfeito ≈ 100', () => expect(moveAccuracy(50, 50)).toBeCloseTo(100, 0));
  it('queda de 10 pontos', () => expect(moveAccuracy(60, 50)).toBeCloseTo(64.58, 1));
  it('nunca negativo', () => expect(moveAccuracy(100, 0)).toBeGreaterThanOrEqual(0));
  it('queda total vale 1 (piso da fórmula, mais 1)', () => expect(moveAccuracy(100, 0)).toBeCloseTo(1, 5));
  it('queda de 30 pontos', () => expect(moveAccuracy(80, 50)).toBeCloseTo(25.77, 1));
  it('só depende da perda, não do nível', () =>
    expect(moveAccuracy(50, 40)).toBeCloseTo(moveAccuracy(60, 50), 8));
  it('ganho de win% não passa de 100', () => {
    expect(moveAccuracy(40, 60)).toBeLessThanOrEqual(100);
    expect(moveAccuracy(40, 60)).toBeCloseTo(100, 5);
  });
  it('0 → 0 e 100 → 100 ficam em 100', () => {
    expect(moveAccuracy(0, 0)).toBeCloseTo(100, 5);
    expect(moveAccuracy(100, 100)).toBeCloseTo(100, 5);
  });
});

describe('gameAccuracy', () => {
  it('partida sem erros ≈ 100 para os dois', () => {
    const r = gameAccuracy(Array(41).fill(50));
    expect(r.w).toBeGreaterThan(99);
    expect(r.b).toBeGreaterThan(99);
  });

  it('capivarada das pretas derruba só a precisão delas', () => {
    const W = [...Array(20).fill(50), 95, ...Array(20).fill(95)];
    const r = gameAccuracy(W);
    expect(r.w).toBeGreaterThan(95);
    expect(r.b).toBeLessThan(r.w);
  });

  it('capivarada das brancas derruba só a precisão delas', () => {
    const W = [...Array(21).fill(50), ...Array(20).fill(5)];
    const r = gameAccuracy(W);
    expect(r.b).toBeGreaterThan(95);
    expect(r.w).toBeLessThan(r.b);
  });

  it('simetria: trocar W por 100-W troca as precisões de w e b', () => {
    const W = Array.from({ length: 41 }, (_, i) => 50 + 30 * Math.sin(i / 3) + (i % 5) * 2);
    const flipped = W.map((x) => 100 - x);
    const a = gameAccuracy(W);
    const b = gameAccuracy(flipped);
    expect(b.w).toBeCloseTo(a.b, 6);
    expect(b.b).toBeCloseTo(a.w, 6);
  });

  it('partida curta (2 plies) não lança e devolve valores válidos', () => {
    const r = gameAccuracy([50, 55, 50]);
    for (const v of [r.w, r.b]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('partida curta (3 plies) não lança e devolve valores válidos', () => {
    const r = gameAccuracy([50, 60, 40, 50]);
    for (const v of [r.w, r.b]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe('estimateRating', () => {
  it('limitado', () => {
    expect(estimateRating(0)).toBe(400);
    expect(estimateRating(100)).toBe(2500);
  });
  it('regressão linear arredondada no meio da faixa', () => {
    expect(estimateRating(60)).toBe(1100);
    expect(estimateRating(75.5)).toBe(Math.round(-1000 + 35 * 75.5));
  });
});
