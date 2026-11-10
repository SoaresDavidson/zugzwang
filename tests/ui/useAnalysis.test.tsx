// @vitest-environment jsdom
/*
 * Contrato: src/ui/useAnalysis.ts exporta (nomeado)
 *   useAnalysis(game: ParsedGame | null, engineFactory: () => Promise<Engine> = getEngine):
 *     { status: 'idle'|'running'|'done'|'error'; progress: AnalysisProgress | null;
 *       analysis: GameAnalysis | null; error: string | null; fromCache: boolean }
 * Cache hit: status 'done', fromCache true, engineFactory não é chamada.
 * No fim grava putAnalysis; se playerColorFor(headers, perfil) devolver cor, grava putHistory.
 * Falha de motor (factory rejeita com Error('engine-failed')): status 'error' e
 * error = ERROR_MESSAGE['engine-failed'](). `game` null: 'idle'. Troca de partida aborta a anterior.
 */
import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { analyzeGame, cacheKey } from '../../src/core/analyzeGame'
import { parsePgn } from '../../src/core/pgn'
import type { Engine, ParsedGame } from '../../src/core/types'
import {
  closeDb, getCachedAnalysis, getProfile, listHistory, putAnalysis, setProfile,
} from '../../src/storage/db'
import { useAnalysis } from '../../src/ui/useAnalysis'
import { buildEvals, scriptedEngine } from '../fixtures/fakeEngine'
import { SCHOLAR, SCHOLAR_EVALS } from '../fixtures/scholarEvals'

const GAME_A = parsePgn(SCHOLAR) // brancas "a", pretas "b"
const SHORT_SANS = ['d4', 'd5']
const GAME_B = parsePgn('[White "c"]\n[Black "d"]\n[Result "*"]\n\n1. d4 d5 *')
const SHORT_EVALS = buildEvals(SHORT_SANS)

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

const factoryFor = (engine: Engine) => vi.fn(async () => engine)

/** Motor com atraso por chamada que respeita o AbortSignal. */
function slowEngine(evals: Parameters<typeof scriptedEngine>[0], delayMs = 15) {
  const inner = scriptedEngine(evals)
  const signals: (AbortSignal | undefined)[] = []
  const engine: Engine = {
    async analyse(fen, opts, signal) {
      signals.push(signal)
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, delayMs)
        signal?.addEventListener('abort', () => {
          clearTimeout(t)
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
      return inner.analyse(fen, opts, signal)
    },
  }
  return { engine, signals }
}

describe('useAnalysis', () => {
  it('game null fica idle', () => {
    const factory = vi.fn()
    const { result } = renderHook(() => useAnalysis(null, factory))
    expect(result.current.status).toBe('idle')
    expect(result.current.analysis).toBeNull()
    expect(result.current.progress).toBeNull()
    expect(result.current.error).toBeNull()
    expect(factory).not.toHaveBeenCalled()
  })

  it('status vai idle, running, done; progress cresce; key é a cacheKey', async () => {
    const log: { status: string; evaluated: number }[] = []
    const factory = factoryFor(scriptedEngine(SCHOLAR_EVALS))
    const { result } = renderHook(() => {
      const r = useAnalysis(GAME_A, factory)
      log.push({ status: r.status, evaluated: r.progress?.evaluated ?? 0 })
      return r
    })
    await waitFor(() => expect(result.current.status).toBe('done'))

    const statuses = log.map((l) => l.status)
    expect(statuses[0]).toBe('idle')
    expect(statuses.indexOf('running')).toBeGreaterThan(-1)
    expect(statuses.indexOf('running')).toBeLessThan(statuses.lastIndexOf('done'))
    expect(new Set(statuses)).toEqual(new Set(['idle', 'running', 'done']))

    const evals = log.map((l) => l.evaluated).filter((n) => n > 0)
    expect(evals.length).toBeGreaterThan(1)
    for (let i = 1; i < evals.length; i++) expect(evals[i]).toBeGreaterThanOrEqual(evals[i - 1])
    expect(Math.max(...evals)).toBe(GAME_A.plies.length + 1)

    expect(result.current.fromCache).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.analysis!.key).toBe(await cacheKey(GAME_A))
    expect(result.current.analysis!.moves).toHaveLength(GAME_A.plies.length)
  })

  it('perfil identifica o jogador: grava histórico e cache', async () => {
    await setProfile({ lichess: 'A' }) // maiúscula: casamento sem diferenciar caixa
    const { result } = renderHook(() => useAnalysis(GAME_A, factoryFor(scriptedEngine(SCHOLAR_EVALS))))
    await waitFor(() => expect(result.current.status).toBe('done'))
    const key = result.current.analysis!.key
    await waitFor(async () => expect(await listHistory()).toHaveLength(1))
    const [entry] = await listHistory()
    expect(entry.key).toBe(key)
    expect(entry.playerColor).toBe('w')
    expect(await getCachedAnalysis(key)).toBeDefined()
  })

  it('partida alheia não grava histórico, mas grava o cache', async () => {
    await setProfile({ lichess: 'zed' })
    const { result } = renderHook(() => useAnalysis(GAME_A, factoryFor(scriptedEngine(SCHOLAR_EVALS))))
    await waitFor(() => expect(result.current.status).toBe('done'))
    const key = result.current.analysis!.key
    await waitFor(async () => expect(await getCachedAnalysis(key)).toBeDefined())
    expect(await listHistory()).toEqual([])
    expect(await getProfile()).toEqual({ lichess: 'zed' })
  })

  it('usa o cache sem chamar o motor', async () => {
    const cached = await analyzeGame(GAME_A, scriptedEngine(SCHOLAR_EVALS))
    await putAnalysis(cached)
    const factory = vi.fn(async () => scriptedEngine({}) as Engine)
    const { result } = renderHook(() => useAnalysis(GAME_A, factory))
    await waitFor(() => expect(result.current.status).toBe('done'))
    expect(result.current.fromCache).toBe(true)
    expect(result.current.analysis!.key).toBe(cached.key)
    expect(factory).not.toHaveBeenCalled()
  })

  it('troca de partida aborta a anterior e o resultado final é da segunda', async () => {
    const { engine, signals } = slowEngine({ ...SCHOLAR_EVALS, ...SHORT_EVALS })
    const factory = factoryFor(engine)
    const { result, rerender } = renderHook(({ g }: { g: ParsedGame }) => useAnalysis(g, factory), {
      initialProps: { g: GAME_A },
    })
    await waitFor(() => expect(signals.length).toBeGreaterThan(0))
    const firstSignal = signals[0]
    rerender({ g: GAME_B })
    await waitFor(() => expect(result.current.status).toBe('done'))
    expect(firstSignal?.aborted).toBe(true)
    expect(result.current.analysis!.key).toBe(await cacheKey(GAME_B))
    expect(result.current.analysis!.moves).toHaveLength(GAME_B.plies.length)
    expect(result.current.analysis!.moves.map((m) => m.san)).toEqual(SHORT_SANS)
    expect(result.current.error).toBeNull()
    // Nada da partida A foi gravado no cache.
    expect(await getCachedAnalysis(await cacheKey(GAME_A))).toBeUndefined()
  })

  it('desmontar aborta a análise em andamento', async () => {
    const { engine, signals } = slowEngine(SCHOLAR_EVALS)
    const { unmount } = renderHook(() => useAnalysis(GAME_A, factoryFor(engine)))
    await waitFor(() => expect(signals.length).toBeGreaterThan(0))
    unmount()
    expect(signals[0]?.aborted).toBe(true)
  })

  it('motor que rejeita com engine-failed vira status error com a mensagem do plano', async () => {
    const factory = vi.fn(async (): Promise<Engine> => { throw new Error('engine-failed') })
    const { result } = renderHook(() => useAnalysis(GAME_A, factory))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('O motor de análise não carregou neste navegador.')
    expect(result.current.analysis).toBeNull()
    expect(await listHistory()).toEqual([])
  })

  it('game volta a null: idle', async () => {
    const { result, rerender } = renderHook(({ g }: { g: ParsedGame | null }) =>
      useAnalysis(g, factoryFor(scriptedEngine(SCHOLAR_EVALS))), { initialProps: { g: GAME_A as ParsedGame | null } })
    await waitFor(() => expect(result.current.status).toBe('done'))
    rerender({ g: null })
    await waitFor(() => expect(result.current.status).toBe('idle'))
    expect(result.current.analysis).toBeNull()
  })
})
