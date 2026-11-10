// @vitest-environment jsdom
/*
 * Contrato: src/ui/input/UserSearch.tsx exporta (nomeado)
 *   UserSearch({ onPick, fetchers? }: {
 *     onPick: (g: GameSummary) => void
 *     fetchers?: { lichess: F; chesscom: F }   // F = formato de fetchLichessGames: (username, signal?, fetchFn?) => Promise<GameSummary[]>
 *   })
 * Padrão de fetchers: fetchLichessGames / fetchChesscomGames.
 * Rótulos: campo "Usuário" dentro de um <form> (submit dispara a busca); fonte como dois botões ou
 * rádios "Lichess" e "Chess.com" (Lichess começa selecionado); botão "Buscar"; filtros (botões)
 * "Todas", "Bullet", "Blitz", "Rápida", "Clássica"; cada partida é um `listitem` (nada mais usa esse
 * papel) com playerLabel dos jogadores e rating como texto. Clicar na partida (ou num botão dentro
 * do item) chama onPick(summary). Erros de busca: texto de ERROR_MESSAGE[code](nome da fonte).
 * Busca bem-sucedida grava o username em setProfile (chave da fonte escolhida).
 * Enquanto busca, o botão "Buscar" fica desabilitado, mas o submit do form continua tratado:
 * uma busca nova invalida a anterior (resultado antigo descartado).
 */
import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameError } from '../../src/core/types'
import type { GameSummary, Player, TimeClass } from '../../src/core/sources/types'
import { closeDb, getProfile } from '../../src/storage/db'
import { UserSearch } from '../../src/ui/input/UserSearch'
import { ERROR_MESSAGE } from '../../src/ui/messages'

const pl = (name: string | null, rating: number | null, aiLevel: number | null = null): Player => ({
  name, rating, aiLevel,
})

function game(id: string, timeClass: TimeClass, over: Partial<GameSummary> = {}): GameSummary {
  return {
    id, source: 'lichess', url: `https://lichess.org/${id}`,
    white: pl('davi', 1511), black: pl('rival' + id, 1622),
    result: '1-0', timeClass, playedAt: Date.UTC(2026, 10, 1), pgn: '1. e4 e5 *',
    ...over,
  }
}

const blitz = game('blz', 'blitz')
const rapid = game('rpd', 'rapid')

beforeEach(async () => {
  await closeDb()
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('zugzwang')
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('deleteDatabase bloqueado'))
  })
})
afterAll(async () => { await closeDb() })

/** Fonte pode ser botão ou rádio. */
const sourcePicker = (name: string) =>
  screen.queryByRole('radio', { name }) ?? screen.getByRole('button', { name })

async function search(user: ReturnType<typeof userEvent.setup>, name = 'davi') {
  await user.type(screen.getByLabelText('Usuário'), name)
  await user.click(screen.getByRole('button', { name: 'Buscar' }))
}

describe('UserSearch', () => {
  it('filtro de ritmo esconde as outras partidas', async () => {
    const user = userEvent.setup()
    render(<UserSearch fetchers={{ lichess: async () => [blitz, rapid], chesscom: async () => [] }} onPick={vi.fn()} />)
    await search(user)
    expect(await screen.findAllByRole('listitem')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Blitz' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Todas' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('mostra mensagem de usuário inexistente', async () => {
    const user = userEvent.setup()
    const lichess = vi.fn().mockRejectedValue(new GameError('user-not-found'))
    render(<UserSearch fetchers={{ lichess, chesscom: vi.fn() }} onPick={vi.fn()} />)
    await search(user)
    expect(await screen.findByText('Não achei esse usuário no Lichess.')).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('rate-limited mostra o texto com o nome da fonte', async () => {
    const user = userEvent.setup()
    const chesscom = vi.fn().mockRejectedValue(new GameError('rate-limited'))
    render(<UserSearch fetchers={{ lichess: vi.fn(), chesscom }} onPick={vi.fn()} />)
    await user.click(sourcePicker('Chess.com'))
    await search(user)
    expect(await screen.findByText(ERROR_MESSAGE['rate-limited']('Chess.com'))).toBeInTheDocument()
    expect(screen.getByText('O Chess.com pediu uma pausa. Tente de novo em um minuto.')).toBeInTheDocument()
  })

  it('seletor de fonte troca o fetcher chamado', async () => {
    const user = userEvent.setup()
    const lichess = vi.fn().mockResolvedValue([blitz])
    const chesscom = vi.fn().mockResolvedValue([rapid])
    render(<UserSearch fetchers={{ lichess, chesscom }} onPick={vi.fn()} />)
    await search(user)
    await screen.findAllByRole('listitem')
    expect(lichess).toHaveBeenCalledTimes(1)
    expect(lichess.mock.calls[0][0]).toBe('davi')
    expect(chesscom).not.toHaveBeenCalled()

    await user.click(sourcePicker('Chess.com'))
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(chesscom).toHaveBeenCalledTimes(1))
    expect(chesscom.mock.calls[0][0]).toBe('davi')
    expect(lichess).toHaveBeenCalledTimes(1)
  })

  it('enquanto busca, o botão fica desabilitado', async () => {
    const user = userEvent.setup()
    let release!: (g: GameSummary[]) => void
    const lichess = vi.fn(() => new Promise<GameSummary[]>((r) => { release = r }))
    render(<UserSearch fetchers={{ lichess, chesscom: vi.fn() }} onPick={vi.fn()} />)
    await search(user)
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled()
    release([blitz])
    await screen.findAllByRole('listitem')
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled()
  })

  it('clicar numa partida chama onPick com o resumo', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(<UserSearch fetchers={{ lichess: async () => [blitz, rapid], chesscom: vi.fn() }} onPick={onPick} />)
    await search(user)
    const items = await screen.findAllByRole('listitem')
    const target = items.find((li) => li.textContent?.includes('rivalrpd'))!
    await user.click(within(target).queryByRole('button') ?? target)
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith(rapid)
  })

  it('busca bem-sucedida grava o username no perfil', async () => {
    const user = userEvent.setup()
    render(<UserSearch fetchers={{ lichess: async () => [blitz], chesscom: vi.fn() }} onPick={vi.fn()} />)
    await search(user)
    await screen.findAllByRole('listitem')
    await waitFor(async () => expect(await getProfile()).toEqual({ lichess: 'davi' }))
  })

  it('busca com erro não grava o perfil', async () => {
    const user = userEvent.setup()
    const lichess = vi.fn().mockRejectedValue(new GameError('network'))
    render(<UserSearch fetchers={{ lichess, chesscom: vi.fn() }} onPick={vi.fn()} />)
    await search(user)
    await screen.findByText('Falha de conexão com o Lichess.')
    expect(await getProfile()).toEqual({})
  })

  it('lista mostra jogadores (playerLabel) e rating', async () => {
    const user = userEvent.setup()
    const ia = game('ia1', 'blitz', { white: pl('davi', 1511), black: pl(null, null, 4) })
    const anon = game('an1', 'blitz', { white: pl(null, 1200), black: pl('davi', 1300) })
    render(<UserSearch fetchers={{ lichess: async () => [ia, anon], chesscom: vi.fn() }} onPick={vi.fn()} />)
    await search(user)
    const [first, second] = await screen.findAllByRole('listitem')
    expect(first).toHaveTextContent('davi')
    expect(first).toHaveTextContent('1511')
    expect(first).toHaveTextContent('Stockfish nível 4')
    expect(second).toHaveTextContent('Anônimo')
    expect(second).toHaveTextContent('1200')
    expect(second).toHaveTextContent('1300')
  })

  it('nova busca antes da anterior terminar descarta o resultado antigo', async () => {
    const user = userEvent.setup()
    const resolvers: Array<(g: GameSummary[]) => void> = []
    const lichess = vi.fn(() => new Promise<GameSummary[]>((r) => { resolvers.push(r) }))
    render(<UserSearch fetchers={{ lichess, chesscom: vi.fn() }} onPick={vi.fn()} />)
    await search(user, 'davi')
    await waitFor(() => expect(resolvers).toHaveLength(1))
    // Segunda busca pelo submit do form (o botão está desabilitado).
    fireEvent.submit(screen.getByLabelText('Usuário').closest('form')!)
    await waitFor(() => expect(resolvers).toHaveLength(2))
    resolvers[1]([game('new', 'blitz')])
    await screen.findAllByRole('listitem')
    resolvers[0]([game('old', 'blitz')])
    await new Promise((r) => setTimeout(r, 30))
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('rivalnew')
    expect(screen.queryByText(/rivalold/)).toBeNull()
  })
})
