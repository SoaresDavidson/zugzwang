// @vitest-environment jsdom
// Testes de regressão do code review da L4. Ficam ocultos do agente corretor.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { analyzeGame } from '../../src/core/analyzeGame'
import { CATEGORY_POLICY } from '../../src/core/categories'
import { legalDests, uciFromMove } from '../../src/core/moves'
import { parsePgn } from '../../src/core/pgn'
import { whiteWinSeries } from '../../src/core/winPercent'
import type { AnalyzedMove, MoveCategory } from '../../src/core/types'
import type { BoardProps } from '../../src/ui/review/Board'
import { EvalGraph } from '../../src/ui/review/EvalGraph'
import { MoveDetail } from '../../src/ui/review/MoveDetail'
import { MoveList } from '../../src/ui/review/MoveList'
import { ReviewView } from '../../src/ui/review/ReviewView'
import { ERROR_MESSAGE } from '../../src/ui/messages'
import type { AnalysisState } from '../../src/ui/useAnalysis'
import { scriptedEngine } from '../fixtures/fakeEngine'
import { SCHOLAR, SCHOLAR_EVALS } from '../fixtures/scholarEvals'

const user = userEvent.setup()
const game = parsePgn(SCHOLAR)
const analysis = await analyzeGame(game, scriptedEngine(SCHOLAR_EVALS))
const moves = analysis.moves
const before = analysis.evals[5]
const mk = (category: MoveCategory, extra: Partial<AnalyzedMove> = {}): AnalyzedMove => ({
  ...moves[5], category, bestUci: 'g7g6', bestSan: 'g6', explanation: 'x', ...extra,
})
let seen: BoardProps[] = []
const Stub = (p: BoardProps) => { seen.push(p); return <button data-testid="board" data-fen={p.fen} onClick={() => p.onMove?.('d2d4')}>jogar</button> }
const last = () => seen[seen.length - 1]
beforeEach(() => { seen = [] })

describe('J1: clique na lista durante a análise', () => {
  it('lance clicado continua selecionado quando a análise termina', async () => {
    const running: AnalysisState = { status: 'running', analysis: null, error: null, fromCache: false,
      progress: { evaluated: 3, total: 8, moves: moves.slice(0, 2) } }
    const done: AnalysisState = { status: 'done', progress: null, analysis, error: null, fromCache: false }
    const { rerender } = render(<ReviewView game={game} onBack={() => {}} analysisState={running} BoardComponent={Stub} />)
    await user.click(screen.getAllByText(/e5/)[0])
    rerender(<ReviewView game={game} onBack={() => {}} analysisState={done} BoardComponent={Stub} />)
    expect(screen.getByTestId('board')).toHaveAttribute('data-fen', moves[1].fenAfter)
  })
})

describe('J2: retry com motor falhando', () => {
  it('mostra o erro e sai do modo retry', async () => {
    render(<MoveDetail move={mk('blunder')} before={before} BoardComponent={Stub}
      retry={async () => { throw new Error('engine-failed') }} />)
    await user.click(screen.getByText('Tentar de novo'))
    await user.click(screen.getByTestId('board'))
    expect(await screen.findByText(ERROR_MESSAGE['engine-failed']())).toBeInTheDocument()
    await waitFor(() => expect(last().movable).toBeNull())
  })
})

describe('J3: retry pendente ao trocar de lance', () => {
  it('desmontar aborta o retry e não dispara onRetryResult', async () => {
    let signal: AbortSignal | undefined
    let resolve!: (v: { category: MoveCategory; accepted: boolean }) => void
    const onRetryResult = vi.fn()
    const { unmount } = render(<MoveDetail move={mk('blunder')} before={before} BoardComponent={Stub}
      onRetryResult={onRetryResult}
      retry={(_b, _f, _u, _c, s) => { signal = s; return new Promise((r) => { resolve = r }) }} />)
    await user.click(screen.getByText('Tentar de novo'))
    await user.click(screen.getByTestId('board'))
    await waitFor(() => expect(signal).toBeDefined())
    unmount()
    expect(signal!.aborted).toBe(true)
    resolve({ category: 'best', accepted: true })
    await new Promise((r) => setTimeout(r, 20))
    expect(onRetryResult).not.toHaveBeenCalled()
  })
})

describe('J4: seta do melhor lance na posição certa', () => {
  it('modo normal mostra o lance jogado sem seta; "Mostrar melhor" mostra a posição anterior com a seta', async () => {
    render(<MoveDetail move={mk('blunder')} before={before} BoardComponent={Stub} retry={async () => ({ category: null, accepted: false })} />)
    expect(last().fen).toBe(moves[5].fenAfter)
    expect(last().arrow).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Mostrar melhor' }))
    expect(last().fen).toBe(moves[5].fenBefore)
    expect(last().arrow).toEqual(['g7', 'g6'])
  })
  it('lance que já é o melhor não oferece "Mostrar melhor"', () => {
    render(<MoveDetail move={mk('best')} before={before} BoardComponent={Stub} />)
    expect(screen.queryByRole('button', { name: 'Mostrar melhor' })).toBeNull()
  })
})

describe('J5/J6: gráfico', () => {
  it('um lance só ainda desenha a linha', () => {
    render(<EvalGraph whiteWins={[60]} categories={[null]} selected={0} onSelect={() => {}} />)
    expect(screen.getByTestId('graph-line')).toBeInTheDocument()
  })
  it('gráfico aparece e cresce durante a análise', () => {
    const running: AnalysisState = { status: 'running', analysis: null, error: null, fromCache: false,
      progress: { evaluated: 4, total: 8, moves: moves.slice(0, 3) } }
    render(<ReviewView game={game} onBack={() => {}} analysisState={running} BoardComponent={Stub} />)
    expect(screen.getByTestId('ply-2')).toBeInTheDocument()
    expect(screen.queryByTestId('ply-3')).toBeNull()
  })
})

describe('J7: nome acessível dos lances', () => {
  it('botão do lance diz número, lance e categoria', () => {
    render(<MoveList moves={moves} selected={0} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /3\.\.\. Cf6, Capivarada/ })).toBeInTheDocument()
  })
})

describe('J8: núcleo concentra regras de tabuleiro e categoria', () => {
  it('legalDests e uciFromMove', () => {
    const d = legalDests('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    expect(d.get('g1')?.sort()).toEqual(['f3', 'h3'])
    expect(d.get('e2')?.sort()).toEqual(['e3', 'e4'])
    expect(uciFromMove('8/P7/8/8/8/8/8/k6K w - - 0 1', 'a7', 'a8')).toBe('a7a8q')
    expect(uciFromMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2', 'e4')).toBe('e2e4')
  })
  it('whiteWinSeries devolve um ponto por lance', () => {
    const s = whiteWinSeries(analysis.evals)
    expect(s).toHaveLength(moves.length)
    expect(s[s.length - 1]).toBeGreaterThan(99)
  })
  it('CATEGORY_POLICY', () => {
    const retryable = Object.entries(CATEGORY_POLICY).filter(([, p]) => p.retryable).map(([c]) => c).sort()
    expect(retryable).toEqual(['blunder', 'inaccuracy', 'missedMate', 'mistake'])
    expect(CATEGORY_POLICY.best.showBest).toBe(false)
    expect(CATEGORY_POLICY.blunder.showBest).toBe(true)
    expect(CATEGORY_POLICY.brilliant.markOnGraph).toBe(true)
    expect(CATEGORY_POLICY.good.markOnGraph).toBe(false)
  })
})
