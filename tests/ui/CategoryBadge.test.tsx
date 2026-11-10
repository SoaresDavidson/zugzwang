// @vitest-environment jsdom
/*
 * Contrato: src/ui/review/CategoryBadge.tsx exporta (nomeado)
 *   CategoryBadge({ category: MoveCategory })
 * Renderiza o glifo da categoria como texto, com aria-label = CATEGORY_LABEL[category]
 * e a cor do token CSS `--cat-{category}` (var(--cat-x) no style inline ou classe equivalente
 * que referencie o token; o teste só confere que o nome do token aparece no HTML).
 */
import { render, screen } from '@testing-library/react'
import { CATEGORY_LABEL } from '../../src/core/explain'
import type { MoveCategory } from '../../src/core/types'
import { CategoryBadge } from '../../src/ui/review/CategoryBadge'

const GLYPH: Record<MoveCategory, string> = {
  book: '≡', brilliant: '!!', great: '!', best: '★', excellent: '✓✓',
  good: '✓', inaccuracy: '?!', mistake: '?', blunder: '??', missedMate: '#',
}

describe('CategoryBadge', () => {
  it.each(Object.keys(GLYPH) as MoveCategory[])('%s: glifo exato e aria-label pt-BR', (category) => {
    render(<CategoryBadge category={category} />)
    const el = screen.getByLabelText(CATEGORY_LABEL[category])
    expect(el.textContent?.trim()).toBe(GLYPH[category])
  })

  it.each(Object.keys(GLYPH) as MoveCategory[])('%s: usa o token de cor --cat-%s', (category) => {
    const { container } = render(<CategoryBadge category={category} />)
    expect(container.innerHTML).toContain(`--cat-${category}`)
  })
})
