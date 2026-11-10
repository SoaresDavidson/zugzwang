import { Chessground } from 'chessground'
import type { Api } from 'chessground/api'
import type { Key } from 'chessground/types'
import { useEffect, useRef } from 'react'
import 'chessground/assets/chessground.base.css'
import 'chessground/assets/chessground.cburnett.css'
import { legalDests, uciFromMove } from '../../core/moves'
import type { Color } from '../../core/types'
import { LABEL } from '../messages'

export type BoardProps = {
  fen: string
  lastMove: [string, string] | null
  arrow: [string, string] | null
  movable: Color | null
  onMove?: (uci: string) => void
}

const FULL = { w: 'white', b: 'black' } as const
const squares = (k: string): Key[] => [k.slice(0, 2) as Key, k.slice(2, 4) as Key]
const turnOf = (fen: string) => FULL[fen.split(' ')[1] === 'b' ? 'b' : 'w']

export function Board({ fen, lastMove, arrow, movable, onMove }: BoardProps) {
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<Api | null>(null)
  const onMoveRef = useRef(onMove)
  useEffect(() => { onMoveRef.current = onMove })
  // Casas como texto ("e2e4"): o pai pode recriar os arrays a cada render sem reconfigurar o tabuleiro.
  const last = lastMove ? lastMove.join('') : ''
  const arrowKey = arrow ? arrow.join('') : ''

  useEffect(() => {
    const el = host.current
    if (!el) return
    const cg = Chessground(el, {
      coordinates: true,
      animation: { duration: 160 },
      draggable: { showGhost: true },
      highlight: { lastMove: true, check: true },
    })
    api.current = cg
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => cg.redrawAll())
    ro?.observe(el)
    return () => {
      ro?.disconnect()
      cg.destroy()
      api.current = null
    }
  }, [])

  useEffect(() => {
    api.current?.set({
      fen,
      turnColor: turnOf(fen),
      lastMove: last ? squares(last) : undefined,
      viewOnly: movable === null,
      movable: {
        free: false,
        color: movable ? FULL[movable] : undefined,
        dests: movable ? (legalDests(fen) as Map<Key, Key[]>) : new Map(),
        showDests: true,
        events: { after: (from, to) => onMoveRef.current?.(uciFromMove(fen, from, to)) },
      },
      drawable: {
        autoShapes: arrowKey ? [{ orig: squares(arrowKey)[0], dest: squares(arrowKey)[1], brush: 'green' }] : [],
      },
    })
  }, [fen, last, arrowKey, movable])

  return <div className="board-wrap" role="group" aria-label={LABEL.boardLabel}><div ref={host} className="board" /></div>
}
