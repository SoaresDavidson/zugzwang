// @vitest-environment jsdom
/*
 * Contrato: src/ui/review/Board.tsx exporta
 *   type BoardProps = { fen: string; lastMove: [string, string] | null; arrow: [string, string] | null;
 *                       movable: 'w' | 'b' | null; onMove?: (uci: string) => void }
 * Contrato: src/ui/review/MoveDetail.tsx exporta (nomeado)
 *   MoveDetail({ move: AnalyzedMove; before: PositionEval;
 *                BoardComponent?: (p: BoardProps) => JSX (padrão Board);
 *                retry?: (before, fenBefore, uci, color) => Promise<{category: MoveCategory|null; accepted: boolean}>
 *                        (padrão: checkRetry com getEngine) })
 * MoveDetail renderiza o tabuleiro (BoardComponent), badge, move.explanation e o retry.
 * - Modo normal: fen = move.fenAfter, lastMove = [from,to] de move.uci, movable = null,
 *   arrow = [from,to] de move.bestUci quando a categoria não é book/brilliant/great/best e há bestUci; senão null.
 * - Modo retry (após "Tentar de novo"): fen = move.fenBefore, movable = move.color, arrow = null.
 * - "Tentar de novo" só em inaccuracy|mistake|blunder|missedMate.
 * - Lance feito no board chama retry(before, move.fenBefore, uci, move.color).
 *   Aceito: "Boa! {CATEGORY_LABEL[category]}." Recusado (ou category null): "Ainda não. Tente outro lance."
 *   com botões "Tentar de novo" e "Mostrar melhor"; "Mostrar melhor" põe a seta [from,to] de bestUci.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { analyzeGame } from '../../src/core/analyzeGame'
import { CATEGORY_LABEL } from '../../src/core/explain'
import { parsePgn } from '../../src/core/pgn'
import type { AnalyzedMove, MoveCategory } from '../../src/core/types'
import type { BoardProps } from '../../src/ui/review/Board'
import { MoveDetail } from '../../src/ui/review/MoveDetail'
import { scriptedEngine } from '../fixtures/fakeEngine'
import { SCHOLAR, SCHOLAR_EVALS } from '../fixtures/scholarEvals'

const user = userEvent.setup()
const analysis = await analyzeGame(parsePgn(SCHOLAR), scriptedEngine(SCHOLAR_EVALS))
const before = analysis.evals[5]
const base = analysis.moves[5]
const mk = (category: MoveCategory, extra: Partial<AnalyzedMove> = {}): AnalyzedMove => ({
  ...base, category, bestUci: 'g7g6', bestSan: 'g6', explanation: `Explicação de teste ${category}.`, ...extra,
})
const pair = (uci: string): [string, string] => [uci.slice(0, 2), uci.slice(2, 4)]
const noRetry = async () => ({ category: null, accepted: false })

let seen: BoardProps[] = []
const StubBoard = (p: BoardProps) => {
  seen.push(p)
  return <button onClick={() => p.onMove?.('d2d4')}>jogar d2d4</button>
}
const lastProps = () => seen[seen.length - 1]
beforeEach(() => { seen = [] })

const RETRYABLE: MoveCategory[] = ['inaccuracy', 'mistake', 'blunder', 'missedMate']
const ALL: MoveCategory[] = [
  'book', 'brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder', 'missedMate',
]

describe('MoveDetail', () => {
  it('retry recusado mostra opção de ver o melhor', async () => {
    render(<MoveDetail move={mk('blunder')} before={before} BoardComponent={StubBoard}
      retry={async () => ({ category: 'mistake', accepted: false })} />)
    await user.click(screen.getByText('Tentar de novo'))
    await user.click(screen.getByText('jogar d2d4'))
    expect(await screen.findByText('Ainda não. Tente outro lance.')).toBeVisible()
    expect(screen.getByText('Mostrar melhor')).toBeVisible()
  })

  it('mostra a explicação do lance', () => {
    const move = mk('blunder')
    render(<MoveDetail move={move} before={before} BoardComponent={StubBoard} retry={noRetry} />)
    expect(screen.getByText(move.explanation)).toBeVisible()
  })

  it.each(ALL)('%s: botão "Tentar de novo" só nas categorias de erro', (category) => {
    render(<MoveDetail move={mk(category)} before={before} BoardComponent={StubBoard} retry={noRetry} />)
    const btn = screen.queryByText('Tentar de novo')
    if (RETRYABLE.includes(category)) expect(btn).toBeInTheDocument()
    else expect(btn).toBeNull()
  })

  it('modo normal: tabuleiro em fenAfter, lastMove, sem movable e sem seta', () => {
    const move = mk('blunder')
    render(<MoveDetail move={move} before={before} BoardComponent={StubBoard} retry={noRetry} />)
    expect(lastProps()).toMatchObject({
      fen: move.fenAfter, lastMove: pair(move.uci), movable: null, arrow: null,
    })
  })

  it('lance que já é o melhor não mostra seta', () => {
    render(<MoveDetail move={mk('best', { bestUci: base.uci })} before={before} BoardComponent={StubBoard} retry={noRetry} />)
    expect(lastProps().arrow).toBeNull()
  })

  it('modo retry: tabuleiro em fenBefore com a cor do lance móvel e sem seta', async () => {
    const move = mk('blunder')
    render(<MoveDetail move={move} before={before} BoardComponent={StubBoard} retry={noRetry} />)
    await user.click(screen.getByText('Tentar de novo'))
    expect(lastProps()).toMatchObject({ fen: move.fenBefore, movable: move.color, arrow: null })
  })

  it('retry recebe (before, fenBefore, uci, color)', async () => {
    const move = mk('mistake')
    const retry = vi.fn(async () => ({ category: 'good' as MoveCategory | null, accepted: true }))
    render(<MoveDetail move={move} before={before} BoardComponent={StubBoard} retry={retry} />)
    await user.click(screen.getByText('Tentar de novo'))
    await user.click(screen.getByText('jogar d2d4'))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(retry).toHaveBeenCalledWith(before, move.fenBefore, 'd2d4', move.color, expect.any(AbortSignal))
  })

  it('retry aceito mostra "Boa! {Rótulo}."', async () => {
    render(<MoveDetail move={mk('blunder')} before={before} BoardComponent={StubBoard}
      retry={async () => ({ category: 'excellent', accepted: true })} />)
    await user.click(screen.getByText('Tentar de novo'))
    await user.click(screen.getByText('jogar d2d4'))
    expect(await screen.findByText(`Boa! ${CATEGORY_LABEL.excellent}.`)).toBeVisible()
    expect(screen.queryByText('Ainda não. Tente outro lance.')).toBeNull()
  })

  it('retry recusado oferece "Tentar de novo" e "Mostrar melhor"', async () => {
    render(<MoveDetail move={mk('blunder')} before={before} BoardComponent={StubBoard}
      retry={async () => ({ category: 'mistake', accepted: false })} />)
    await user.click(screen.getByText('Tentar de novo'))
    await user.click(screen.getByText('jogar d2d4'))
    await screen.findByText('Ainda não. Tente outro lance.')
    expect(screen.getByText('Tentar de novo')).toBeVisible()
    expect(screen.getByText('Mostrar melhor')).toBeVisible()
  })

  it('"Mostrar melhor" põe a seta do melhor lance no tabuleiro', async () => {
    const move = mk('blunder', { bestUci: 'g7g6' })
    render(<MoveDetail move={move} before={before} BoardComponent={StubBoard}
      retry={async () => ({ category: 'mistake', accepted: false })} />)
    await user.click(screen.getByText('Tentar de novo'))
    await user.click(screen.getByText('jogar d2d4'))
    await user.click(await screen.findByText('Mostrar melhor'))
    expect(lastProps().arrow).toEqual(['g7', 'g6'])
  })

  it('category null (lance ilegal) mostra a mensagem de recusa', async () => {
    render(<MoveDetail move={mk('blunder')} before={before} BoardComponent={StubBoard} retry={noRetry} />)
    await user.click(screen.getByText('Tentar de novo'))
    await user.click(screen.getByText('jogar d2d4'))
    expect(await screen.findByText('Ainda não. Tente outro lance.')).toBeVisible()
    expect(screen.getByText('Mostrar melhor')).toBeVisible()
  })
})
