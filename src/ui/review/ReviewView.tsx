import { useEffect, useMemo, useState } from 'react'
import type { AnalyzedMove, MoveCategory, ParsedGame } from '../../core/types'
import { winPercent, scoreToCp } from '../../core/winPercent'
import { LABEL, progressText } from '../messages'
import { useAnalysis } from '../useAnalysis'
import type { AnalysisState } from '../useAnalysis'
import { Board } from './Board'
import type { BoardProps } from './Board'
import { EvalGraph } from './EvalGraph'
import { MoveDetail } from './MoveDetail'
import { MoveList } from './MoveList'
import { Summary } from './Summary'
import type { ReactNode } from 'react'

interface Props {
  game: ParsedGame
  onBack(): void
  analysisState?: AnalysisState
  BoardComponent?: (p: BoardProps) => ReactNode
}

const NEGATIVE: MoveCategory[] = ['blunder', 'mistake', 'missedMate', 'inaccuracy']

function firstNegative(moves: AnalyzedMove[]): number {
  for (const c of NEGATIVE) {
    const i = moves.findIndex((m) => m.category === c)
    if (i >= 0) return i
  }
  return Math.max(0, moves.length - 1)
}

export function ReviewView({ game, onBack, analysisState, BoardComponent = Board }: Props) {
  const hook = useAnalysis(analysisState ? null : game)
  const state = analysisState ?? hook
  const analysis = state.status === 'done' ? state.analysis : null
  const moves = analysis?.moves ?? []
  const [picked, setPicked] = useState<number | null>(null)
  const initial = useMemo(() => firstNegative(moves), [moves])
  const selected = Math.min(picked ?? initial, Math.max(0, moves.length - 1))

  const whiteWins = useMemo(
    () => (analysis ? analysis.evals.slice(1).map((e) => winPercent(scoreToCp(e.lines[0].score))) : []),
    [analysis],
  )
  const categories = useMemo(() => moves.map((m) => m.category), [moves])

  useEffect(() => {
    if (!analysis) return
    const last = moves.length - 1
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const cur = picked ?? initial
      let next: number
      if (e.key === 'ArrowLeft') next = cur - 1
      else if (e.key === 'ArrowRight') next = cur + 1
      else if (e.key === 'Home') next = 0
      else if (e.key === 'End') next = last
      else return
      e.preventDefault()
      setPicked(Math.min(last, Math.max(0, next)))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [analysis, moves.length, picked, initial])

  const white = game.headers.White ?? LABEL.unnamedPlayer
  const black = game.headers.Black ?? LABEL.unnamedPlayer
  const total = state.progress?.total ?? game.plies.length + 1
  const evaluated = state.progress?.evaluated ?? 0
  const listMoves = analysis ? moves : state.progress?.moves ?? []
  const move = analysis ? moves[selected] : undefined
  const go = (n: number) => setPicked(Math.min(moves.length - 1, Math.max(0, n)))

  return (
    <section className="review">
      <div className="row">
        <button className="btn" type="button" onClick={onBack}>{LABEL.back}</button>
        <span className="muted">{white} {LABEL.versus} {black}</span>
      </div>
      {state.status === 'error' && <p className="error" role="alert">{state.error}</p>}
      {state.status === 'running' && (
        <div className="stack">
          <p className="muted">{progressText(evaluated, total)}</p>
          <progress className="bar" max={total} value={evaluated} aria-label={LABEL.analyzing} />
        </div>
      )}
      {state.status === 'done' && state.fromCache && <p className="muted">{LABEL.fromCache}</p>}
      {state.status !== 'error' && (
        <div className="review-grid">
          <div className="review-main">
            {analysis && move && (
              <>
                <MoveDetail
                  key={selected}
                  move={move}
                  before={analysis.evals[selected]}
                  BoardComponent={BoardComponent}
                />
                <div className="nav row" role="group" aria-label={LABEL.navLabel}>
                  <button type="button" className="btn" onClick={() => go(0)} aria-label={LABEL.first}>⏮</button>
                  <button type="button" className="btn" onClick={() => go(selected - 1)} aria-label={LABEL.prev}>◀</button>
                  <button type="button" className="btn" onClick={() => go(selected + 1)} aria-label={LABEL.next}>▶</button>
                  <button type="button" className="btn" onClick={() => go(moves.length - 1)} aria-label={LABEL.last}>⏭</button>
                </div>
              </>
            )}
            {analysis && (
              <EvalGraph
                whiteWins={whiteWins}
                categories={categories}
                selected={selected}
                onSelect={go}
              />
            )}
          </div>
          <div className="review-side">
            {analysis && <Summary analysis={analysis} />}
            <MoveList moves={listMoves} selected={analysis ? selected : -1} onSelect={go} />
          </div>
        </div>
      )}
    </section>
  )
}
