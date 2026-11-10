import type { AnalyzedMove } from '../../core/types'
import { localizeSan } from '../../core/san'
import { CategoryBadge } from './CategoryBadge'

interface Props { moves: AnalyzedMove[]; selected: number; onSelect(index: number): void }

export function MoveList({ moves, selected, onSelect }: Props) {
  return (
    <ol className="movelist">
      {moves.map((m, i) => (
        <li key={i}>
          <button type="button" className="move" aria-current={i === selected ? 'true' : undefined} onClick={() => onSelect(i)}>
            <span className="move-no">{Math.floor(m.index / 2) + 1}{m.color === 'w' ? '.' : '...'}</span>
            <span className="move-san">{localizeSan(m.san)}</span>
            <CategoryBadge category={m.category} />
          </button>
        </li>
      ))}
    </ol>
  )
}
