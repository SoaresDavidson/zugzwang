import { CATEGORY_LABEL, explainMove, type ExplainFacts } from '../../src/core/explain';
import type { MoveCategory } from '../../src/core/types';

const facts = (o: Partial<ExplainFacts> & { category: MoveCategory }): ExplainFacts => ({
  bestSan: null, materialDelta: 0, allowsMateIn: null, missedMateIn: null, ...o,
});

describe('CATEGORY_LABEL', () => {
  it.each([
    ['book', 'Livro'], ['brilliant', 'Brilhante'], ['great', 'Ótimo'], ['best', 'Melhor'],
    ['excellent', 'Excelente'], ['good', 'Bom'], ['inaccuracy', 'Imprecisão'],
    ['mistake', 'Erro'], ['blunder', 'Capivarada'], ['missedMate', 'Mate perdido'],
  ] as [MoveCategory, string][])('%s → %s', (cat, label) => {
    expect(CATEGORY_LABEL[cat]).toBe(label);
  });
  it('cobre exatamente as 10 categorias', () => expect(Object.keys(CATEGORY_LABEL)).toHaveLength(10));
});

describe('explainMove', () => {
  it('erro com peça perdida', () => expect(explainMove({ category: 'mistake', bestSan: 'Nxe5',
    materialDelta: -3, allowsMateIn: null, missedMateIn: null })).toBe('Erro. Perde uma peça. Melhor: Cxe5.'));
  it('mate perdido', () => expect(explainMove({ category: 'missedMate', bestSan: 'Qh5',
    materialDelta: 0, allowsMateIn: null, missedMateIn: 3 })).toBe('Mate perdido. Deixa escapar mate em 3. Melhor: Dh5.'));
  it('permite mate', () => expect(explainMove({ category: 'blunder', bestSan: 'g3',
    materialDelta: 0, allowsMateIn: 2, missedMateIn: null })).toBe('Capivarada. Permite mate em 2. Melhor: g3.'));
  it('brilhante', () => expect(explainMove({ category: 'brilliant', bestSan: null,
    materialDelta: -9, allowsMateIn: null, missedMateIn: null })).toBe('Brilhante. Sacrifício correto.'));
  it('melhor sem sugestão', () => expect(explainMove({ category: 'best', bestSan: 'e4',
    materialDelta: 0, allowsMateIn: null, missedMateIn: null })).toBe('Melhor.'));

  it.each([
    ['book', 'Livro.'], ['good', 'Bom.'], ['excellent', 'Excelente.'],
    ['inaccuracy', 'Imprecisão.'], ['mistake', 'Erro.'], ['blunder', 'Capivarada.'],
    ['missedMate', 'Mate perdido.'], ['best', 'Melhor.'],
  ] as [MoveCategory, string][])('só rótulo e ponto: %s', (category, text) => {
    expect(explainMove(facts({ category }))).toBe(text);
  });

  it('great tem frase própria', () =>
    expect(explainMove(facts({ category: 'great', bestSan: 'Qd8' }))).toBe('Ótimo. Único lance que mantém a avaliação.'));

  describe('perda de material', () => {
    it.each([
      [-1, 'um peão'], [-2, 'a qualidade'], [-3, 'uma peça'], [-5, 'a torre'], [-9, 'a dama'],
      [-4, 'material'], [-12, 'material'],
    ])('delta %i → Perde %s', (materialDelta, txt) => {
      expect(explainMove(facts({ category: 'blunder', materialDelta }))).toBe(`Capivarada. Perde ${txt}.`);
    });
    it.each(['inaccuracy', 'mistake', 'blunder'] as MoveCategory[])('aparece em %s', (category) => {
      expect(explainMove(facts({ category, materialDelta: -1 }))).toBe(`${CATEGORY_LABEL[category]}. Perde um peão.`);
    });
    it('delta 0 ou positivo não gera frase', () => {
      expect(explainMove(facts({ category: 'mistake', materialDelta: 0 }))).toBe('Erro.');
      expect(explainMove(facts({ category: 'mistake', materialDelta: 3 }))).toBe('Erro.');
    });
    it.each(['book', 'great', 'best', 'excellent', 'good', 'missedMate'] as MoveCategory[])(
      'ignorado em %s', (category) => {
        expect(explainMove(facts({ category, materialDelta: -3 }))).not.toContain('Perde');
      });
    it('ignorado em brilliant (só a frase própria)', () => {
      expect(explainMove(facts({ category: 'brilliant', materialDelta: -3 }))).toBe('Brilhante. Sacrifício correto.');
    });
  });

  describe('precedência', () => {
    it('missedMate vence allowsMate e material', () => {
      expect(explainMove(facts({ category: 'blunder', materialDelta: -9, missedMateIn: 2, allowsMateIn: 1 })))
        .toBe('Capivarada. Deixa escapar mate em 2.');
    });
    it('allowsMate vence material', () => {
      expect(explainMove(facts({ category: 'blunder', materialDelta: -9, allowsMateIn: 1 })))
        .toBe('Capivarada. Permite mate em 1.');
    });
    it('frases de mate valem mesmo em categoria que não é de erro', () => {
      expect(explainMove(facts({ category: 'good', allowsMateIn: 4 }))).toBe('Bom. Permite mate em 4.');
    });
  });

  describe('Melhor: omitido', () => {
    it.each(['book', 'brilliant', 'great', 'best'] as MoveCategory[])('em %s', (category) => {
      expect(explainMove(facts({ category, bestSan: 'Nf3' }))).not.toContain('Melhor:');
    });
    it.each(['excellent', 'good', 'inaccuracy', 'mistake', 'blunder', 'missedMate'] as MoveCategory[])(
      'presente em %s', (category) => {
        expect(explainMove(facts({ category, bestSan: 'Bb5' }))).toBe(`${CATEGORY_LABEL[category]}. Melhor: Bb5.`);
      });
    it('localiza o SAN e preserva o roque', () => {
      expect(explainMove(facts({ category: 'good', bestSan: 'Rxe8+' }))).toBe('Bom. Melhor: Txe8+.');
      expect(explainMove(facts({ category: 'good', bestSan: 'O-O' }))).toBe('Bom. Melhor: O-O.');
    });
    it('sem bestSan não há "Melhor:"', () => {
      expect(explainMove(facts({ category: 'mistake' }))).toBe('Erro.');
    });
  });

  it('ordem completa: rótulo, material, melhor', () => {
    expect(explainMove(facts({ category: 'mistake', materialDelta: -5, bestSan: 'Qxd5' })))
      .toBe('Erro. Perde a torre. Melhor: Dxd5.');
  });
});
