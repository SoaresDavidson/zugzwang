// @vitest-environment jsdom
/*
 * Contrato: src/ui/review/EvalGraph.tsx exporta (nomeado)
 *   EvalGraph({ whiteWins: number[]; categories: (MoveCategory | null)[];
 *               selected: number; onSelect(ply: number): void })
 * - whiteWins: win% das brancas (0-100) por ponto; um ponto clicável por item,
 *   data-testid="ply-N" com N de 0 a whiteWins.length - 1.
 * - categories[N]: categoria associada ao ponto N (pode ter menos itens que whiteWins);
 *   marcador data-testid="marker-N" só se categories[N] for
 *   brilliant|great|mistake|blunder|missedMate.
 * - ponto `selected` tem aria-current="true" (os demais não).
 * - SVG com role="img" e aria-label que menciona "avaliação".
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MoveCategory } from '../../src/core/types'
import { EvalGraph } from '../../src/ui/review/EvalGraph'

const user = userEvent.setup()

describe('EvalGraph', () => {
  it('clicar num ponto seleciona o ply', async () => {
    const onSelect = vi.fn()
    render(<EvalGraph whiteWins={[50, 55, 40]} categories={[null, 'blunder']} selected={0} onSelect={onSelect} />)
    await user.click(screen.getByTestId('ply-1'))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('um ponto clicável por ply, de 0 a plies-1', async () => {
    const onSelect = vi.fn()
    const wins = [50, 52, 60, 58, 30]
    render(<EvalGraph whiteWins={wins} categories={[]} selected={0} onSelect={onSelect} />)
    for (let i = 0; i < wins.length; i++) {
      await user.click(screen.getByTestId(`ply-${i}`))
      expect(onSelect).toHaveBeenLastCalledWith(i)
    }
    expect(screen.queryByTestId(`ply-${wins.length}`)).toBeNull()
    expect(onSelect).toHaveBeenCalledTimes(wins.length)
  })

  it('marcadores só nas categorias de destaque', () => {
    const cats: (MoveCategory | null)[] = [
      'book', 'brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder', 'missedMate', null,
    ]
    const marked = new Set([1, 2, 7, 8, 9])
    render(<EvalGraph whiteWins={cats.map(() => 50)} categories={cats} selected={0} onSelect={() => {}} />)
    cats.forEach((_, i) => {
      if (marked.has(i)) expect(screen.getByTestId(`marker-${i}`)).toBeInTheDocument()
      else expect(screen.queryByTestId(`marker-${i}`)).toBeNull()
    })
  })

  it('ply selecionado tem aria-current="true" e só ele', () => {
    render(<EvalGraph whiteWins={[50, 55, 40, 45]} categories={[]} selected={2} onSelect={() => {}} />)
    expect(screen.getByTestId('ply-2')).toHaveAttribute('aria-current', 'true')
    for (const i of [0, 1, 3]) {
      expect(screen.getByTestId(`ply-${i}`)).not.toHaveAttribute('aria-current', 'true')
    }
  })

  it('SVG acessível com rótulo que menciona avaliação', () => {
    render(<EvalGraph whiteWins={[50, 55]} categories={[]} selected={0} onSelect={() => {}} />)
    const img = screen.getByRole('img')
    expect(img.tagName.toLowerCase()).toBe('svg')
    expect(img.getAttribute('aria-label')).toMatch(/avalia[çc][ãa]o/i)
  })
})
