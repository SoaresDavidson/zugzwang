// @vitest-environment jsdom
// Testes de regressão do code review da L3. Ficam ocultos do agente corretor.
import 'fake-indexeddb/auto'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { analyzeGame } from '../../src/core/analyzeGame'
import { historyEntryFor } from '../../src/core/achievements'
import { parsePgn } from '../../src/core/pgn'
import type { GameSummary } from '../../src/core/sources/types'
import { closeDb, listHistory, putAnalysis, setProfile } from '../../src/storage/db'
import { App } from '../../src/ui/App'
import { UserSearch } from '../../src/ui/input/UserSearch'
import { useAnalysis } from '../../src/ui/useAnalysis'
import { scriptedEngine } from '../fixtures/fakeEngine'
import { SCHOLAR, SCHOLAR_EVALS } from '../fixtures/scholarEvals'

beforeEach(async () => {
  await closeDb()
  await new Promise<void>((res, rej) => {
    const r = indexedDB.deleteDatabase('zugzwang'); r.onsuccess = () => res(); r.onerror = () => rej(r.error)
  })
})
afterAll(async () => { await closeDb() })

const summary = (id: string): GameSummary => ({
  id, source: 'lichess', url: `https://lichess.org/${id}`,
  white: { name: 'davi', rating: 1500, aiLevel: null }, black: { name: 'x', rating: 1400, aiLevel: null },
  result: '1-0', timeClass: 'blitz', playedAt: 1, pgn: '1. e4 *',
})

describe('H1: cache hit também grava histórico quando o jogador é identificado', () => {
  it('reabrir partida do cache depois de informar o perfil grava HistoryEntry', async () => {
    const game = parsePgn(SCHOLAR)
    await putAnalysis(await analyzeGame(game, scriptedEngine(SCHOLAR_EVALS)))
    await setProfile({ lichess: 'A' })
    const factory = vi.fn()
    const { result } = renderHook(() => useAnalysis(game, factory))
    await waitFor(() => expect(result.current.status).toBe('done'))
    expect(result.current.fromCache).toBe(true)
    expect(factory).not.toHaveBeenCalled()
    await waitFor(async () => expect(await listHistory()).toHaveLength(1))
  })
})

describe('H6/H7: historyEntryFor no núcleo', () => {
  it('monta a entrada a partir da análise e da cor', async () => {
    const a = await analyzeGame(parsePgn(SCHOLAR), scriptedEngine(SCHOLAR_EVALS))
    const e = historyEntryFor({ ...a, headers: { ...a.headers, UTCDate: '2026.11.01', UTCTime: '12:00:00' } }, 'w', 99)
    expect(e).toEqual({
      key: a.key, analyzedAt: 99, playedAt: Date.UTC(2026, 10, 1, 12), playerColor: 'w',
      counts: a.counts.w, accuracy: a.accuracy.w, ownMoves: 4,
    })
    expect(historyEntryFor(a, 'b', 1).playedAt).toBeNull()
    expect(historyEntryFor(a, 'b', 1).ownMoves).toBe(3)
  })
})

describe('H4: trocar a fonte limpa a lista', () => {
  it('lista do Lichess some ao escolher Chess.com', async () => {
    const user = userEvent.setup()
    render(<UserSearch onPick={vi.fn()} fetchers={{ lichess: async () => [summary('g1')], chesscom: async () => [] }} />)
    await user.type(screen.getByLabelText('Usuário'), 'davi')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await screen.findAllByRole('listitem')
    await user.click(screen.queryByRole('radio', { name: 'Chess.com' }) ?? screen.getByRole('button', { name: 'Chess.com' }))
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })
})

describe('H5: desmontar a busca aborta o fetch', () => {
  it('signal fica aborted ao desmontar', async () => {
    const user = userEvent.setup()
    let seen: AbortSignal | undefined
    const pending = (_u: string, signal?: AbortSignal) => { seen = signal; return new Promise<GameSummary[]>(() => {}) }
    const { unmount } = render(<UserSearch onPick={vi.fn()} fetchers={{ lichess: pending, chesscom: pending }} />)
    await user.type(screen.getByLabelText('Usuário'), 'davi')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(seen).toBeDefined())
    unmount()
    expect(seen!.aborted).toBe(true)
  })
})

describe('H8: voltar preserva o que foi digitado', () => {
  it('PGN colado continua no campo depois de Voltar', async () => {
    const user = userEvent.setup()
    render(<App />)
    const pgn = '1. e4 e5 2. Nf3 *'
    fireEvent.change(screen.getByLabelText('PGN da partida'), { target: { value: pgn } })
    await user.click(screen.getByRole('button', { name: 'Analisar' }))
    await user.click(await screen.findByRole('button', { name: /Voltar/ }))
    expect(screen.getByLabelText('PGN da partida')).toHaveValue(pgn)
  })
})

describe('H9: abas seguem o padrão WAI-ARIA', () => {
  it('aba ligada ao painel e navegação por setas', async () => {
    render(<App />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    const panel = screen.getByRole('tabpanel')
    expect(tabs[0]).toHaveAttribute('aria-controls', panel.id)
    expect(panel).toHaveAttribute('aria-labelledby', tabs[0].id)
    expect(tabs[1]).toHaveAttribute('tabindex', '-1')
    act(() => tabs[0].focus())
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' })
    await waitFor(() => expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true'))
    expect(document.activeElement).toBe(screen.getAllByRole('tab')[1])
    expect(screen.getByLabelText('Usuário')).toBeInTheDocument()
  })
})
