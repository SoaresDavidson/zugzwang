import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { playerColorFor } from '../core/achievements'
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

function playedAt(headers: Record<string, string>): number | null {
  const m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(headers.UTCDate ?? headers.Date ?? '')
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null
}

export function useAnalysis(
  game: ParsedGame | null,
  engineFactory: () => Promise<Engine> = getEngine,
): AnalysisState {
  const [state, setState] = useState<AnalysisState>(IDLE)

  useEffect(() => {
    if (!game) {
      setState(IDLE)
      return
    }
    const ctrl = new AbortController()
    const { signal } = ctrl
    setState({ ...IDLE, status: 'running' })

    ;(async () => {
      try {
        const key = await cacheKey(game)
        const cached = await getCachedAnalysis(key)
        if (signal.aborted) return
        if (cached) {
          setState({ status: 'done', progress: null, analysis: cached, error: null, fromCache: true })
          return
        }
        const engine = await engineFactory()
        if (signal.aborted) return
        const analysis = await analyzeGame(
          game,
          engine,
          (progress) => { if (!signal.aborted) flushSync(() => setState((s) => ({ ...s, progress }))) },
          signal,
        )
        if (signal.aborted) return
        await putAnalysis(analysis)
        const color = playerColorFor(game.headers, await getProfile())
        if (color) {
          await putHistory({
            key: analysis.key,
            analyzedAt: Date.now(),
            playedAt: playedAt(game.headers),
            playerColor: color,
            counts: analysis.counts[color],
            accuracy: analysis.accuracy[color],
            ownMoves: analysis.moves.filter((m) => m.color === color).length,
          })
        }
        if (signal.aborted) return
        setState({ status: 'done', progress: null, analysis, error: null, fromCache: false })
      } catch (e) {
        if (signal.aborted || isAbortError(e)) return
        setState({ ...IDLE, status: 'error', error: ERROR_MESSAGE['engine-failed']() })
      }
    })()

    return () => ctrl.abort()
    // engineFactory é estável por contrato; a análise recomeça só quando a partida muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game])

  return state
}
