import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { isAbortError } from '../../core/abort'
import { CATEGORY_POLICY } from '../../core/categories'
import { CATEGORY_LABEL } from '../../core/explain'
import { parseUci } from '../../core/moves'
import { checkRetry } from '../../core/retry'
import type { AnalyzedMove, Color, MoveCategory, PositionEval } from '../../core/types'
import { getEngine } from '../../engine/stockfishEngine'
import { LABEL, errorMessage, retryAccepted } from '../messages'
import { Board } from './Board'
import type { BoardProps } from './Board'
import { CategoryBadge } from './CategoryBadge'

type Result = { category: MoveCategory | null; accepted: boolean }

export type RetryFn = (
  before: PositionEval, fenBefore: string, uci: string, color: Color, signal: AbortSignal,
) => Promise<Result>

const defaultRetry: RetryFn = async (before, fenBefore, uci, color, signal) =>
  checkRetry(before, fenBefore, uci, color, await getEngine(), signal)

const pair = (uci: string): [string, string] => {
  const { from, to } = parseUci(uci)
  return [from, to]
}

interface Props {
  move: AnalyzedMove
  before: PositionEval
  BoardComponent?: (p: BoardProps) => ReactNode
  retry?: RetryFn
  /** Ponto de extensão (Task 13: som da categoria). */
  onRetryResult?: (r: Result) => void
}

export function MoveDetail({ move, before, BoardComponent = Board, retry = defaultRetry, onRetryResult }: Props) {
  const [retrying, setRetrying] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [showBest, setShowBest] = useState(false)
  const [viewBest, setViewBest] = useState(false)
  const ticket = useRef(0)
  const pending = useRef<AbortController | null>(null)

  // Trocar de lance recomeça do modo normal.
  const identity = `${move.index}|${move.uci}|${move.fenBefore}`
  const [seen, setSeen] = useState(identity)
  if (seen !== identity) {
    setSeen(identity)
    setRetrying(false); setResult(null); setRetryError(null); setShowBest(false); setViewBest(false)
  }

  function cancelPending() {
    ticket.current++
    pending.current?.abort()
    pending.current = null
  }
  // Desmontar ou trocar de lance aborta o retry pendente.
  useEffect(() => cancelPending, [identity])

  const policy = CATEGORY_POLICY[move.category]
  const bestPair = move.bestUci ? pair(move.bestUci) : null
  const canShowBest = policy.showBest && bestPair !== null && move.bestUci !== move.uci

  function startRetry() {
    cancelPending()
    setRetrying(true); setResult(null); setRetryError(null); setShowBest(false); setViewBest(false)
    setAttempt((a) => a + 1)
  }
  function stopRetry() {
    cancelPending()
    setRetrying(false); setResult(null); setRetryError(null); setShowBest(false)
  }
  async function onMove(uci: string) {
    cancelPending()
    const mine = ticket.current
    const ctrl = new AbortController()
    pending.current = ctrl
    try {
      const r = await retry(before, move.fenBefore, uci, move.color, ctrl.signal)
      if (mine !== ticket.current) return
      setResult(r)
      onRetryResult?.(r)
    } catch (err) {
      if (mine !== ticket.current || isAbortError(err)) return
      setRetryError(errorMessage(err, 'analysis-failed'))
      setRetrying(false); setResult(null); setShowBest(false)
    } finally {
      if (pending.current === ctrl) pending.current = null
    }
  }

  const onBest = viewBest && !retrying
  const fen = retrying || onBest ? move.fenBefore : move.fenAfter
  const lastMove = retrying || onBest ? null : pair(move.uci)
  const arrow = retrying ? (showBest ? bestPair : null) : onBest ? bestPair : null

  return (
    <section className="detail" aria-labelledby="detail-heading">
      <h2 id="detail-heading">{LABEL.moveHeading}</h2>
      <BoardComponent
        key={attempt}
        fen={fen}
        lastMove={lastMove}
        arrow={arrow}
        movable={retrying ? move.color : null}
        onMove={retrying ? onMove : undefined}
      />
      <div className="detail-text">
        <p className="detail-head"><CategoryBadge category={move.category} /> <span>{move.explanation}</span></p>
        {retryError && <p className="error" role="alert">{retryError}</p>}
        {!retrying && (policy.retryable || canShowBest) && (
          <div className="row">
            {policy.retryable && <button type="button" className="btn" onClick={startRetry}>{LABEL.retry}</button>}
            {canShowBest && (
              <button type="button" className="btn secondary" onClick={() => setViewBest((v) => !v)}>
                {viewBest ? LABEL.backToMove : LABEL.showBest}
              </button>
            )}
          </div>
        )}
        {retrying && !result && <p className="muted">{LABEL.retryPrompt}</p>}
        {result && (
          <div className="stack" role="status">
            <p className={result.accepted ? 'ok' : 'muted'}>
              {result.accepted && result.category ? retryAccepted(CATEGORY_LABEL[result.category]) : LABEL.retryRefused}
            </p>
          </div>
        )}
        {retrying && result && (
          <div className="row">
            <button type="button" className="btn" onClick={startRetry}>{LABEL.retry}</button>
            {!result.accepted && <button type="button" className="btn secondary" onClick={() => setShowBest(true)}>{LABEL.showBest}</button>}
            <button type="button" className="btn secondary" onClick={stopRetry}>{LABEL.backToMove}</button>
          </div>
        )}
      </div>
    </section>
  )
}
