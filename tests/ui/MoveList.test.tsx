// @vitest-environment jsdom
/*
 * Contrato: src/ui/review/MoveList.tsx exporta (nomeado)
 *   MoveList({ moves: AnalyzedMove[]; selected: number; onSelect(index: number): void })
 * - um item por lance: número do lance (1. para brancas; pretas também mostram o número),
 *   SAN localizado (localizeSan) e CategoryBadge do lance.
 * - item selecionado (index === selected) tem aria-current="true" (só ele).
 * - clicar num item chama onSelect(index) (index no array `moves`).
 * O item é um <li> ou <button> (ou role listitem/option) que contém SAN, número e badge.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { analyzeGame } from '../../src/core/analyzeGame'
import { CATEGORY_LABEL } from '../../src/core/explain'
import { parsePgn } from '../../src/core/pgn'
import { MoveList } from '../../src/ui/review/MoveList'
import { scriptedEngine } from '../fixtures/fakeEngine'
import { SCHOLAR, SCHOLAR_EVALS } from '../fixtures/scholarEvals'

const user = userEvent.setup()
const analysis = await analyzeGame(parsePgn(SCHOLAR), scriptedEngine(SCHOLAR_EVALS))
const { moves } = analysis
const itemOf = (text: RegExp) => screen.getByText(text).closest('li,button,[role="listitem"],[role="option"]')!

describe('MoveList', () => {
  it('mostra SAN localizado com número do lance', () => {
    render(<MoveList moves={moves} selected={0} onSelect={() => {}} />)
    expect(screen.getByText(/Cf6/)).toBeInTheDocument()
    expect(screen.getByText(/Dxf7#/)).toBeInTheDocument()
    expect(screen.queryByText(/Nf6/)).toBeNull()
    expect(screen.queryByText(/Qxf7/)).toBeNull()
    expect(itemOf(/Dxf7#/).textContent).toMatch(/4/)
    expect(itemOf(/Cf6/).textContent).toMatch(/3/)
    expect(itemOf(/Bc4/).textContent).toMatch(/2/)
  })

  it('mostra o badge de cada lance', () => {
    render(<MoveList moves={moves} selected={0} onSelect={() => {}} />)
    const cats = new Set(moves.map((m) => m.category))
    for (const c of cats) {
      const expected = moves.filter((m) => m.category === c).length
      expect(screen.getAllByLabelText(CATEGORY_LABEL[c])).toHaveLength(expected)
    }
  })

  it('item selecionado tem aria-current="true" e só ele', () => {
    const { container } = render(<MoveList moves={moves} selected={5} onSelect={() => {}} />)
    const current = container.querySelectorAll('[aria-current="true"]')
    expect(current).toHaveLength(1)
    expect(current[0].textContent).toContain('Cf6')
  })

  it('clicar chama onSelect com o índice do lance', async () => {
    const onSelect = vi.fn()
    render(<MoveList moves={moves} selected={0} onSelect={onSelect} />)
    await user.click(screen.getByText(/Dxf7#/))
    expect(onSelect).toHaveBeenLastCalledWith(6)
    await user.click(screen.getByText(/Cf6/))
    expect(onSelect).toHaveBeenLastCalledWith(5)
    await user.click(screen.getByText(/e4/))
    expect(onSelect).toHaveBeenLastCalledWith(0)
  })
})
