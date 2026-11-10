import { localizeSan } from './san';
import type { MoveCategory } from './types';

export const CATEGORY_LABEL: Record<MoveCategory, string> = {
  book: 'Livro', brilliant: 'Brilhante', great: 'Ótimo', best: 'Melhor', excellent: 'Excelente',
  good: 'Bom', inaccuracy: 'Imprecisão', mistake: 'Erro', blunder: 'Capivarada', missedMate: 'Mate perdido',
};

export interface ExplainFacts {
  category: MoveCategory; bestSan: string | null; materialDelta: number;
  allowsMateIn: number | null; missedMateIn: number | null;
}

const LOST: Record<number, string> = { 1: 'um peão', 2: 'a qualidade', 3: 'uma peça', 5: 'a torre', 9: 'a dama' };

export function explainMove(f: ExplainFacts): string {
  const parts = [`${CATEGORY_LABEL[f.category]}.`];
  if (f.missedMateIn !== null) parts.push(`Deixa escapar mate em ${f.missedMateIn}.`);
  else if (f.allowsMateIn !== null) parts.push(`Permite mate em ${f.allowsMateIn}.`);
  else if ((f.category === 'inaccuracy' || f.category === 'mistake' || f.category === 'blunder') && f.materialDelta <= -1) {
    parts.push(`Perde ${LOST[-f.materialDelta] ?? 'material'}.`);
  }
  if (f.category === 'brilliant') parts.push('Sacrifício correto.');
  if (f.category === 'great') parts.push('Único lance que mantém a avaliação.');
  if (f.bestSan && !['book', 'brilliant', 'great', 'best'].includes(f.category)) {
    parts.push(`Melhor: ${localizeSan(f.bestSan)}.`);
  }
  return parts.join(' ');
}
