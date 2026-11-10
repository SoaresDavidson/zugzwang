import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { checkRetry } from '../../core/retry'
import { CATEGORY_LABEL } from '../../core/explain'
import type { AnalyzedMove, Color, MoveCategory, PositionEval } from '../../core/types'
import { getEngine } from '../../engine/stockfishEngine'
import { LABEL, retryAccepted } from '../messages'
import { Board } from './Board'
import type { BoardProps } from './Board'
import { CategoryBadge } from './CategoryBadge'

export type RetryFn = (
  before: PositionEval, fenBefore: string, uci: string, color: Color,
) => Promise<{ category: MoveCategory | null; accepted: boolean }>

const defaultRetry: RetryFn = async (before, fenBefore, uci, color) =>
  checkRetry(before, fenBefore, uci, color, await getEngine())

const RETRYABLE: ReadonlySet<MoveCategory> = new Set(['inaccuracy', 'mistake', 'blunder', 'missedMate'])
const NO_ARROW: ReadonlySet<MoveCategory> = new Set(['book', 'brilliant', 'great', 'best'])
const pair = (uci: string): [string, string] => [uci.slice(0, 2), uci.slice(2, 4)]

interface Props {
  move: AnalyzedMove
  before: PositionEval
  BoardComponent?: (p: BoardProps) => ReactNode
  retry?: RetryFn
  /** Ponto de extensão (Task 13: som da categoria). */
  onRetryResult?: (r: { category: MoveCategory | null; accepted: boolean }) => void
}

type Result = { category: MoveCategory | null; accepted: boolean }

export function MoveDetail({ move, before, BoardComponent = Board, retry = defaultRetry, onRetryResult }: Props) {
  const [retrying, setRetrying] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [showBest, setShowBest] = useState(false)
  const ticket = useRef(0)

  const canRetry = RETRYABLE.has(move.category)
  const bestPair = move.bestUci ? pair(move.bestUci) : null

  function startRetry() {
    ticket.current++
    setRetrying(true); setResult(null); setShowBest(false); setAttempt((a) => a + 1)
  }
  function stopRetry() {
    ticket.current++
    setRetrying(false); setResult(null); setShowBest(false)
  }
  async function onMove(uci: string) {
    const mine = ++ticket.current
    const r = await retry(before, move.fenBefore, uci, move.color)
    if (mine !== ticket.current) return
    setResult(r)
    onRetryResult?.(r)
  }

  const arrow = retrying
    ? (showBest ? bestPair : null)
    : (!NO_ARROW.has(move.category) && move.bestUci && move.bestUci !== move.uci ? bestPair : null)

  return (
    <div className="detail">
      <BoardComponent
        key={attempt}
        fen={retrying ? move.fenBefore : move.fenAfter}
        lastMove={retrying ? null : pair(move.uci)}
        arrow={arrow}
        movable={retrying ? move.color : null}
        onMove={retrying ? onMove : undefined}
      />
      <div className="detail-text">
        <p className="detail-head"><CategoryBadge category={move.category} /> <strong>{CATEGORY_LABEL[move.category]}</strong></p>
        <p>{move.explanation}</p>
        {canRetry && !retrying && (
          <button type="button" className="btn" onClick={startRetry}>{LABEL.retry}</button>
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
            {!result.accepted && <button type="button" className="btn" onClick={() => setShowBest(true)}>{LABEL.showBest}</button>}
            <button type="button" className="btn" onClick={stopRetry}>{LABEL.backToMove}</button>
          </div>
        )}
      </div>
    </div>
  )
}
