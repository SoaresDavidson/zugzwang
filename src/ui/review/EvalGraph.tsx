import type { MoveCategory } from '../../core/types'
import { LABEL } from '../messages'

const W = 600
const H = 120
const MARKED: ReadonlySet<MoveCategory> = new Set(['brilliant', 'great', 'mistake', 'blunder', 'missedMate'])

interface Props {
  whiteWins: number[]
  categories: (MoveCategory | null)[]
  selected: number
  onSelect(ply: number): void
}

/** Eixo x = lance, eixo y = chance de vitória das brancas (topo = 100%). Área das brancas preenchida. */
export function EvalGraph({ whiteWins, categories, selected, onSelect }: Props) {
  const n = whiteWins.length
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W)
  const y = (v: number) => H - (Math.min(100, Math.max(0, v)) / 100) * H
  const line = whiteWins.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = n > 0 ? `M${x(0)},${H} L${line.replaceAll(' ', ' L')} L${x(n - 1)},${H} Z` : ''
  const colW = n <= 1 ? W : W / (n - 1)
  return (
    <svg className="graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={LABEL.graphLabel} preserveAspectRatio="none">
      <rect className="graph-black" x={0} y={0} width={W} height={H} />
      <path className="graph-white" d={area} />
      <line className="graph-mid" x1={0} x2={W} y1={H / 2} y2={H / 2} />
      {whiteWins.map((v, i) => {
        const cat = categories[i]
        return (
          <g key={i}>
            <rect
              data-testid={`ply-${i}`}
              className="graph-hit"
              x={x(i) - colW / 2} y={0} width={colW} height={H}
              aria-current={i === selected ? 'true' : undefined}
              onClick={() => onSelect(i)}
            />
            {cat && MARKED.has(cat) && (
              <circle data-testid={`marker-${i}`} cx={x(i)} cy={y(v)} r={4} fill={`var(--cat-${cat})`} className="graph-marker" />
            )}
          </g>
        )
      })}
      {n > 0 && <line className="graph-cursor" x1={x(selected)} x2={x(selected)} y1={0} y2={H} />}
    </svg>
  )
}
