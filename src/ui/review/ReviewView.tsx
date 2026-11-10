import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { initialMoveIndex } from '../../core/categories'
import type { ParsedGame } from '../../core/types'
import { whiteWinAfterMoves, whiteWinSeries } from '../../core/winPercent'
import { LABEL, progressText } from '../messages'
import { useAnalysis } from '../useAnalysis'
import type { AnalysisState } from '../useAnalysis'
import { Board } from './Board'
import type { BoardProps } from './Board'
import { EvalGraph } from './EvalGraph'
import { MoveDetail } from './MoveDetail'
import { MoveList } from './MoveList'
import { Summary } from './Summary'

interface Props {
  game: ParsedGame
  onBack(): void
  analysisState?: AnalysisState
  BoardComponent?: (p: BoardProps) => ReactNode
}

export function ReviewView({ game, onBack, analysisState, BoardComponent = Board }: Props) {
  const hook = useAnalysis(analysisState ? null : game)
  const state = analysisState ?? hook
  const analysis = state.status === 'done' ? state.analysis : null
  const moves = analysis?.moves ?? []
  const listMoves = analysis ? moves : state.progress?.moves ?? []
  const count = listMoves.length
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const initial = useMemo(() => initialMoveIndex(moves), [moves])
  // Único ponto que limita a seleção a [0, n-1].
  const clamp = (i: number) => Math.min(Math.max(0, i), Math.max(0, count - 1))
  const selected = picked !== null ? clamp(picked) : analysis ? clamp(initial) : -1
  const go = (i: number) => setPicked(clamp(i))

  const whiteWins = useMemo(
    () => (analysis ? whiteWinSeries(analysis.evals) : whiteWinAfterMoves(listMoves)),
    [analysis, listMoves],
  )
  const categories = useMemo(() => listMoves.map((m) => m.category), [listMoves])

  useEffect(() => { titleRef.current?.focus() }, [])

  useEffect(() => {
    if (!analysis) return
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      let next: number
      if (e.key === 'ArrowLeft') next = selected - 1
      else if (e.key === 'ArrowRight') next = selected + 1
      else if (e.key === 'Home') next = 0
      else if (e.key === 'End') next = count - 1
      else return
      e.preventDefault()
      setPicked(clamp(next))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const white = game.headers.White ?? LABEL.unnamedPlayer
  const black = game.headers.Black ?? LABEL.unnamedPlayer
  const total = state.progress?.total ?? game.plies.length + 1
  const evaluated = state.progress?.evaluated ?? 0
  const move = analysis ? moves[selected] : undefined

  return (
    <section className="review" aria-labelledby="review-title">
      <div className="review-bar">
        <button className="btn secondary" type="button" onClick={onBack}>{LABEL.back}</button>
        <h2 id="review-title" className="review-title" tabIndex={-1} ref={titleRef}>
          {white} {LABEL.versus} {black}
        </h2>
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
                <div className="nav" role="group" aria-label={LABEL.navLabel}>
                  <button type="button" className="btn secondary" onClick={() => go(0)} aria-label={LABEL.first}>⏮</button>
                  <button type="button" className="btn secondary" onClick={() => go(selected - 1)} aria-label={LABEL.prev}>◀</button>
                  <button type="button" className="btn secondary" onClick={() => go(selected + 1)} aria-label={LABEL.next}>▶</button>
                  <button type="button" className="btn secondary" onClick={() => go(count - 1)} aria-label={LABEL.last}>⏭</button>
                </div>
              </>
            )}
            {whiteWins.length > 0 && (
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
            <section className="moves-section" aria-labelledby="moves-heading">
              <h2 id="moves-heading">{LABEL.movesHeading}</h2>
              <MoveList moves={listMoves} selected={selected} onSelect={go} />
            </section>
          </div>
        </div>
      )}
    </section>
  )
}
