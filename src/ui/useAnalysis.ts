import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { historyEntryFor, playerColorFor } from '../core/achievements'
import { analyzeGame, cacheKey } from '../core/analyzeGame'
import type { AnalysisProgress } from '../core/analyzeGame'
import { isAbortError } from '../core/abort'
import type { Engine, GameAnalysis, ParsedGame } from '../core/types'
import { getEngine } from '../engine/stockfishEngine'
import { getCachedAnalysis, getProfile, putAnalysis, putHistory } from '../storage/db'
import { ERROR_MESSAGE } from './messages'

export interface AnalysisState {
  status: 'idle' | 'running' | 'done' | 'error'
  progress: AnalysisProgress | null
  analysis: GameAnalysis | null
  error: string | null
  fromCache: boolean
}

const IDLE: AnalysisState = { status: 'idle', progress: null, analysis: null, error: null, fromCache: false }

/** Armazenamento é opcional (IndexedDB bloqueado, modo privado, cota): falha vira `fallback`. */
async function safely<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

/** Identidade por conteúdo: reparsear o mesmo PGN a cada render não reinicia a análise. */
function gameId(game: ParsedGame | null): string | null {
  return game ? `${JSON.stringify(game.headers)}|${game.plies.map((p) => p.uci).join(' ')}` : null
}

export function useAnalysis(
  game: ParsedGame | null,
  engineFactory: () => Promise<Engine> = getEngine,
): AnalysisState {
  const [state, setState] = useState<AnalysisState>(IDLE)
  const latest = useRef({ game, engineFactory })
  latest.current = { game, engineFactory }
  const id = gameId(game)

  useEffect(() => {
    const { game: current, engineFactory: factory } = latest.current
    if (!current) {
      setState(IDLE)
      return
    }
    const ctrl = new AbortController()
    const { signal } = ctrl
    setState({ ...IDLE, status: 'running' })

    async function saveHistory(analysis: GameAnalysis) {
      const color = playerColorFor(analysis.headers, await safely(getProfile, {}))
      if (color) await safely(() => putHistory(historyEntryFor(analysis, color, Date.now())), undefined)
    }

    ;(async () => {
      try {
        const key = await cacheKey(current)
        const cached = await safely(() => getCachedAnalysis(key), undefined)
        if (signal.aborted) return
        if (cached) {
          await saveHistory(cached)
          if (signal.aborted) return
          setState({ status: 'done', progress: null, analysis: cached, error: null, fromCache: true })
          return
        }
        const engine = await Promise.resolve().then(factory).catch((e: unknown) => {
          throw isAbortError(e) ? e : new Error('engine-failed')
        })
        if (signal.aborted) return
        const analysis = await analyzeGame(
          current,
          engine,
          // flushSync: o React agrupa setState feitos fora de eventos; sem ele, posições que o
          // motor devolve em sequência rápida colapsariam num único render e a barra pularia.
          (progress) => { if (!signal.aborted) flushSync(() => setState((s) => ({ ...s, progress }))) },
          signal,
        )
        if (signal.aborted) return
        await safely(() => putAnalysis(analysis), undefined)
        await saveHistory(analysis)
        if (signal.aborted) return
        setState({ status: 'done', progress: null, analysis, error: null, fromCache: false })
      } catch (e) {
        if (signal.aborted || isAbortError(e)) return
        const code = e instanceof Error && e.message === 'engine-failed' ? 'engine-failed' : 'analysis-failed'
        setState({ ...IDLE, status: 'error', error: ERROR_MESSAGE[code]() })
      }
    })()

    return () => ctrl.abort()
  }, [id])

  return state
}
