import { CATEGORY_POLICY } from '../../core/categories'
import type { MoveCategory } from '../../core/types'
import { LABEL } from '../messages'

const W = 600
const H = 120
const START = 50

interface Props {
  whiteWins: number[]
  categories: (MoveCategory | null)[]
  selected: number
  onSelect(ply: number): void
}

/**
 * Eixo x = lance, eixo y = chance de vitória das brancas (topo = 100%). A curva parte de 50%
 * (posição inicial) e tem um ponto por lance. Os retângulos clicáveis são atalho de ponteiro:
 * ficam fora da árvore de acessibilidade, o teclado usa as setas da revisão.
 */
export function EvalGraph({ whiteWins, categories, selected, onSelect }: Props) {
  const n = whiteWins.length
  const x = (i: number) => ((i + 1) / n) * W // ply i fica no vértice i + 1; o vértice 0 é a posição inicial
  const y = (v: number) => H - (Math.min(100, Math.max(0, v)) / 100) * H
  const vertices = n > 0 ? [`0,${y(START).toFixed(1)}`, ...whiteWins.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)] : []
  const points = vertices.join(' ')
  const area = n > 0 ? `M0,${H} L${vertices.join(' L')} L${W},${H} Z` : ''
  const colW = n > 0 ? W / n : W
  return (
    <svg className="graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={LABEL.graphLabel} preserveAspectRatio="none">
      <rect className="graph-black" x={0} y={0} width={W} height={H} />
      <path className="graph-white" d={area} />
      <line className="graph-mid" x1={0} x2={W} y1={H / 2} y2={H / 2} />
      {n > 0 && <polyline data-testid="graph-line" className="graph-line" points={points} />}
      {whiteWins.map((v, i) => {
        const cat = categories[i]
        const left = Math.max(0, x(i) - colW / 2)
        const right = Math.min(W, x(i) + colW / 2)
        return (
          <g key={i}>
            <rect
              data-testid={`ply-${i}`}
              className="graph-hit"
              aria-hidden="true"
              x={left} y={0} width={right - left} height={H}
              aria-current={i === selected ? 'true' : undefined}
              onClick={() => onSelect(i)}
            />
            {cat && CATEGORY_POLICY[cat].markOnGraph && (
              <circle data-testid={`marker-${i}`} cx={x(i)} cy={y(v)} r={4} fill={`var(--cat-${cat})`} className="graph-marker" />
            )}
          </g>
        )
      })}
      {selected >= 0 && selected < n && <line className="graph-cursor" x1={x(selected)} x2={x(selected)} y1={0} y2={H} />}
    </svg>
  )
}
