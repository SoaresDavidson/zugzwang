import { Chess } from 'chess.js'
import { Chessground } from 'chessground'
import type { Api } from 'chessground/api'
import type { Key } from 'chessground/types'
import { useEffect, useRef } from 'react'
import 'chessground/assets/chessground.base.css'
import 'chessground/assets/chessground.cburnett.css'
import type { Color } from '../../core/types'
import { LABEL } from '../messages'

export type BoardProps = {
  fen: string
  lastMove: [string, string] | null
  arrow: [string, string] | null
  movable: Color | null
  onMove?: (uci: string) => void
}

function legalDests(fen: string): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>()
  try {
    for (const m of new Chess(fen).moves({ verbose: true })) {
      const list = dests.get(m.from as Key) ?? []
      list.push(m.to as Key)
      dests.set(m.from as Key, list)
    }
  } catch { /* FEN inválido: sem destinos */ }
  return dests
}

/** Promoção sempre para dama: o retry não pergunta a peça. */
function toUci(fen: string, from: string, to: string): string {
  try {
    const promo = new Chess(fen).moves({ verbose: true }).some((m) => m.from === from && m.to === to && m.promotion)
    return `${from}${to}${promo ? 'q' : ''}`
  } catch {
    return `${from}${to}`
  }
}

const FULL = { w: 'white', b: 'black' } as const
const turnOf = (fen: string) => FULL[fen.split(' ')[1] === 'b' ? 'b' : 'w']

export function Board({ fen, lastMove, arrow, movable, onMove }: BoardProps) {
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<Api | null>(null)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove
  const fenRef = useRef(fen)
  fenRef.current = fen

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
      lastMove: lastMove ? (lastMove as Key[]) : undefined,
      viewOnly: movable === null,
      movable: {
        free: false,
        color: movable ? FULL[movable] : undefined,
        dests: movable ? legalDests(fen) : new Map(),
        showDests: true,
        events: { after: (from, to) => onMoveRef.current?.(toUci(fenRef.current, from, to)) },
      },
      drawable: {
        autoShapes: arrow ? [{ orig: arrow[0] as Key, dest: arrow[1] as Key, brush: 'green' }] : [],
      },
    })
  }, [fen, lastMove?.[0], lastMove?.[1], arrow?.[0], arrow?.[1], movable])

  return <div className="board-wrap" role="group" aria-label={LABEL.boardLabel}><div ref={host} className="board" /></div>
}
