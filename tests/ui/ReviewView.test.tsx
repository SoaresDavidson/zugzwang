// @vitest-environment jsdom
/*
 * Contrato: src/ui/review/ReviewView.tsx exporta (nomeado)
 *   ReviewView({ game: ParsedGame; onBack(): void; analysisState?: AnalysisState;
 *                BoardComponent?: (p: BoardProps) => JSX })
 * - analysisState (opcional) substitui useAnalysis(game); sem ele usa o hook.
 * - BoardComponent é repassado ao MoveDetail (padrão Board). O stub do teste renderiza
 *   data-testid="board" com data-fen = props.fen.
 * - running: texto progressText(evaluated, total) e MoveList com progress.moves.
 * - done: lance selecionado = índice em analysis.moves; tabuleiro em moves[i].fenAfter.
 *   Clicar item da lista -> seleciona; clicar no ponto ply-N do gráfico -> seleciona o lance N;
 *   ArrowLeft/ArrowRight -1/+1 (limitados a [0, n-1]); Home -> 0; End -> n-1.
 * - error: mostra analysisState.error num role="alert".
 * - Botão LABEL.back chama onBack.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { analyzeGame } from '../../src/core/analyzeGame'
import { parsePgn } from '../../src/core/pgn'
import type { BoardProps } from '../../src/ui/review/Board'
import { ReviewView } from '../../src/ui/review/ReviewView'
import { LABEL, progressText } from '../../src/ui/messages'
import type { AnalysisState } from '../../src/ui/useAnalysis'
import { scriptedEngine } from '../fixtures/fakeEngine'
import { SCHOLAR, SCHOLAR_EVALS } from '../fixtures/scholarEvals'

const user = userEvent.setup()
const game = parsePgn(SCHOLAR)
const analysis = await analyzeGame(game, scriptedEngine(SCHOLAR_EVALS))
const moves = analysis.moves
const StubBoard = ({ fen }: BoardProps) => <div data-testid="board" data-fen={fen} />
const fen = () => screen.getByTestId('board').getAttribute('data-fen')

const done: AnalysisState = { status: 'done', progress: null, analysis, error: null, fromCache: false }
const running: AnalysisState = {
  status: 'running', analysis: null, error: null, fromCache: false,
  progress: { evaluated: 3, total: 8, moves: moves.slice(0, 2) },
}

function renderDone(onBack = () => {}) {
  render(<ReviewView game={game} onBack={onBack} analysisState={done} BoardComponent={StubBoard} />)
}

describe('ReviewView', () => {
  it('durante a análise mostra "Analisando X de Y" e a lista parcial', () => {
    render(<ReviewView game={game} onBack={() => {}} analysisState={running} BoardComponent={StubBoard} />)
    expect(screen.getByText(progressText(3, 8))).toBeInTheDocument()
    expect(screen.getByText(/e4/)).toBeInTheDocument()
    expect(screen.getByText(/e5/)).toBeInTheDocument()
    expect(screen.queryByText(/Dxf7#/)).toBeNull()
  })

  it('a lista se preenche conforme progress.moves cresce', () => {
    const { rerender } = render(<ReviewView game={game} onBack={() => {}} analysisState={running} BoardComponent={StubBoard} />)
    expect(screen.queryByText(/Cf6/)).toBeNull()
    rerender(<ReviewView game={game} onBack={() => {}} BoardComponent={StubBoard}
      analysisState={{ ...running, progress: { evaluated: 7, total: 8, moves: moves.slice(0, 6) } }} />)
    expect(screen.getByText(progressText(7, 8))).toBeInTheDocument()
    expect(screen.getByText(/Cf6/)).toBeInTheDocument()
  })

  it('erro de análise aparece num alert', () => {
    render(<ReviewView game={game} onBack={() => {}} BoardComponent={StubBoard}
      analysisState={{ status: 'error', progress: null, analysis: null, error: 'Algo deu errado', fromCache: false }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado')
  })

  it('clicar na lista seleciona o lance e o tabuleiro mostra fenAfter', async () => {
    renderDone()
    await user.click(screen.getByText(/Cf6/))
    expect(fen()).toBe(moves[5].fenAfter)
  })

  it('clicar no gráfico seleciona o lance', async () => {
    renderDone()
    await user.click(screen.getByTestId('ply-2'))
    expect(fen()).toBe(moves[2].fenAfter)
  })

  it('setas do teclado mudam o lance selecionado, com limites', async () => {
    renderDone()
    await user.click(screen.getByText(/Cf6/))
    await user.keyboard('{ArrowLeft}')
    expect(fen()).toBe(moves[4].fenAfter)
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(fen()).toBe(moves[6].fenAfter)
    await user.keyboard('{ArrowRight}')
    expect(fen()).toBe(moves[6].fenAfter)
  })

  it('Home e End vão ao início e ao fim', async () => {
    renderDone()
    await user.click(screen.getByText(/Cf6/))
    await user.keyboard('{Home}')
    expect(fen()).toBe(moves[0].fenAfter)
    await user.keyboard('{ArrowLeft}')
    expect(fen()).toBe(moves[0].fenAfter)
    await user.keyboard('{End}')
    expect(fen()).toBe(moves[moves.length - 1].fenAfter)
  })

  it('mostra a explicação do lance selecionado', async () => {
    renderDone()
    await user.click(screen.getByText(/Cf6/))
    expect(screen.getByText(moves[5].explanation)).toBeVisible()
  })

  it('botão Voltar chama onBack', async () => {
    const onBack = vi.fn()
    renderDone(onBack)
    await user.click(screen.getByRole('button', { name: LABEL.back }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
