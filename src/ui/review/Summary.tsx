import type { GameAnalysis, MoveCategory } from '../../core/types'
import { CATEGORY_LABEL } from '../../core/explain'
import { LABEL } from '../messages'
import { CategoryBadge } from './CategoryBadge'

const ORDER: MoveCategory[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder', 'missedMate']

export function Summary({ analysis }: { analysis: GameAnalysis }) {
  const side = (c: 'w' | 'b', name: string) => (
    <div className="sum-col">
      <h3>{name}</h3>
      <p className="sum-acc">{analysis.accuracy[c].toFixed(1).replace('.', ',')}<span className="muted"> {LABEL.accuracy}</span></p>
      <ul className="sum-counts">
        {ORDER.filter((k) => analysis.counts[c][k] > 0).map((k) => (
          <li key={k}><CategoryBadge category={k} /> <span>{CATEGORY_LABEL[k]}</span> <span className="sum-n">{analysis.counts[c][k]}</span></li>
        ))}
      </ul>
    </div>
  )
  return (
    <section className="summary" aria-label={LABEL.summary}>
      {side('w', analysis.headers.White ?? LABEL.white)}
      {side('b', analysis.headers.Black ?? LABEL.black)}
    </section>
  )
}
