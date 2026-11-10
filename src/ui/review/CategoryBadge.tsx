import { CATEGORY_LABEL } from '../../core/explain'
import type { MoveCategory } from '../../core/types'

export const CATEGORY_GLYPH: Record<MoveCategory, string> = {
  book: '≡', brilliant: '!!', great: '!', best: '★', excellent: '✓✓',
  good: '✓', inaccuracy: '?!', mistake: '?', blunder: '??', missedMate: '#',
}

/** Glifo da categoria na cor do token `--cat-{categoria}`. O glifo carrega o sentido; a cor reforça. */
export function CategoryBadge({ category }: { category: MoveCategory }) {
  return (
    <span className="badge" role="img" aria-label={CATEGORY_LABEL[category]} style={{ color: `var(--cat-${category})` }}>
      {CATEGORY_GLYPH[category]}
    </span>
  )
}
