import {
  evaluateAchievements,
  playerColorFor,
  type Achievement,
  type HistoryEntry,
} from '../../src/core/achievements'
import type { CategoryCounts, MoveCategory } from '../../src/core/types'

const CATEGORIES: MoveCategory[] = [
  'book', 'brilliant', 'great', 'best', 'excellent', 'good',
  'inaccuracy', 'mistake', 'blunder', 'missedMate',
]
const IDS = [
  'primeira-revisao', 'dez-revisoes', 'primeiro-brilhante', 'cinco-brilhantes-mes',
  'precisao-90', 'sem-capivarada', 'sequencia-3',
]

type EntryOpts = Partial<Omit<HistoryEntry, 'counts'>> & Partial<CategoryCounts>

let seq = 0
function entry(o: EntryOpts = {}): HistoryEntry {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as CategoryCounts
  for (const c of CATEGORIES) if (o[c] !== undefined) counts[c] = o[c] as number
  seq += 1
  return {
    key: o.key ?? `k${seq}`,
    analyzedAt: o.analyzedAt ?? 1_000 + seq,
    playedAt: o.playedAt === undefined ? null : o.playedAt,
    playerColor: o.playerColor ?? 'w',
    counts,
    accuracy: o.accuracy ?? 50,
    ownMoves: o.ownMoves ?? 10,
  }
}
const find = (list: Achievement[], id: string) => {
  const a = list.find((x) => x.id === id)
  if (!a) throw new Error(`conquista ausente: ${id}`)
  return a
}
const NOW = Date.UTC(2026, 10, 20)
const many = (n: number, o: EntryOpts = {}) =>
  Array.from({ length: n }, (_, i) => entry({ analyzedAt: 100 + i, ...o }))

describe('playerColorFor', () => {
  it('casa jogador sem diferenciar maiúsculas', () =>
    expect(playerColorFor({ White: 'DaviS', Black: 'x' }, { lichess: 'davis' })).toBe('w'))
  it('partida alheia não conta', () =>
    expect(playerColorFor({ White: 'a', Black: 'b' }, { lichess: 'davis' })).toBeNull())
  it('Profile vazio retorna null', () =>
    expect(playerColorFor({ White: 'a', Black: 'b' }, {})).toBeNull())
  it('casa as pretas', () =>
    expect(playerColorFor({ White: 'a', Black: 'DAVIS' }, { chesscom: 'davis' })).toBe('b'))
  it('com os dois usernames, qualquer um casa', () => {
    const p = { lichess: 'davi', chesscom: 'davi_cc' }
    expect(playerColorFor({ White: 'x', Black: 'Davi' }, p)).toBe('b')
    expect(playerColorFor({ White: 'DAVI_CC', Black: 'x' }, p)).toBe('w')
  })
  it('header ausente não quebra', () => {
    expect(playerColorFor({}, { lichess: 'davi' })).toBeNull()
    expect(playerColorFor({ White: 'davi' }, { lichess: 'davi' })).toBe('w')
    expect(playerColorFor({ Black: 'davi' }, { lichess: 'davi' })).toBe('b')
    expect(playerColorFor({ Black: 'x' }, { lichess: 'davi' })).toBeNull()
  })
})

describe('evaluateAchievements', () => {
  it('histórico vazio: 7 travadas, unlockedAt null', () => {
    const r = evaluateAchievements([], NOW)
    expect(r).toHaveLength(7)
    for (const a of r) {
      expect(a.unlocked).toBe(false)
      expect(a.unlockedAt).toBeNull()
      expect(a.title).toBeTruthy()
      expect(a.description).toBeTruthy()
    }
  })

  it('ordem estável dos ids', () => {
    expect(evaluateAchievements([], NOW).map((a) => a.id)).toEqual(IDS)
    expect(evaluateAchievements(many(12, { brilliant: 1, accuracy: 95 }), NOW).map((a) => a.id)).toEqual(IDS)
  })

  it('primeira-revisao com 1 entrada, unlockedAt = analyzedAt', () => {
    const r = evaluateAchievements([entry({ analyzedAt: 555 })], NOW)
    expect(find(r, 'primeira-revisao')).toMatchObject({ unlocked: true, unlockedAt: 555 })
    expect(find(r, 'dez-revisoes').unlocked).toBe(false)
  })

  it('dez-revisoes: 9 não, 10 sim, unlockedAt da décima por analyzedAt', () => {
    expect(find(evaluateAchievements(many(9), NOW), 'dez-revisoes').unlocked).toBe(false)
    const ten = many(10)
    const r = find(evaluateAchievements(ten, NOW), 'dez-revisoes')
    expect(r).toMatchObject({ unlocked: true, unlockedAt: 109 })
    const shuffled = [...ten].reverse()
    expect(find(evaluateAchievements(shuffled, NOW), 'dez-revisoes').unlockedAt).toBe(109)
    expect(find(evaluateAchievements(ten, NOW), 'primeira-revisao').unlockedAt).toBe(100)
  })

  it('primeiro-brilhante: soma >= 1', () => {
    expect(find(evaluateAchievements([entry()], NOW), 'primeiro-brilhante').unlocked).toBe(false)
    const h = [entry({ analyzedAt: 10 }), entry({ analyzedAt: 20, brilliant: 1 }), entry({ analyzedAt: 30, brilliant: 4 })]
    expect(find(evaluateAchievements(h, NOW), 'primeiro-brilhante')).toMatchObject({ unlocked: true, unlockedAt: 20 })
  })

  it('cinco brilhantes no mês corrente', () => {
    const h = [entry({ analyzedAt: Date.UTC(2026, 10, 1), brilliant: 3 }), entry({ analyzedAt: Date.UTC(2026, 10, 15), brilliant: 2 })]
    expect(find(evaluateAchievements(h, NOW), 'cinco-brilhantes-mes').unlocked).toBe(true)
    expect(find(evaluateAchievements(h, Date.UTC(2026, 11, 1)), 'cinco-brilhantes-mes').unlocked).toBe(false)
  })

  it('cinco-brilhantes-mes: 4 não, 5 sim; unlockedAt da entrada que completou', () => {
    const a = entry({ analyzedAt: Date.UTC(2026, 10, 10), brilliant: 2 })
    const b = entry({ analyzedAt: Date.UTC(2026, 10, 12), brilliant: 2 })
    expect(find(evaluateAchievements([a, b], NOW), 'cinco-brilhantes-mes').unlocked).toBe(false)
    const c = entry({ analyzedAt: Date.UTC(2026, 10, 14), brilliant: 1 })
    expect(find(evaluateAchievements([a, b, c], NOW), 'cinco-brilhantes-mes'))
      .toMatchObject({ unlocked: true, unlockedAt: Date.UTC(2026, 10, 14) })
  })

  it('cinco-brilhantes-mes ignora brilhantes de outros meses', () => {
    const h = [
      entry({ analyzedAt: Date.UTC(2026, 9, 20), brilliant: 3 }),
      entry({ analyzedAt: Date.UTC(2026, 10, 12), brilliant: 2 }),
    ]
    expect(find(evaluateAchievements(h, NOW), 'cinco-brilhantes-mes').unlocked).toBe(false)
  })

  it('precisao-90: 89.9 não, 90 sim', () => {
    expect(find(evaluateAchievements([entry({ accuracy: 89.9 })], NOW), 'precisao-90').unlocked).toBe(false)
    const h = [entry({ analyzedAt: 1, accuracy: 89.9 }), entry({ analyzedAt: 2, accuracy: 90 })]
    expect(find(evaluateAchievements(h, NOW), 'precisao-90')).toMatchObject({ unlocked: true, unlockedAt: 2 })
  })

  it('sem-capivarada: 19 lances não, 20 sim', () => {
    expect(find(evaluateAchievements([entry({ ownMoves: 19 })], NOW), 'sem-capivarada').unlocked).toBe(false)
    expect(find(evaluateAchievements([entry({ analyzedAt: 77, ownMoves: 20 })], NOW), 'sem-capivarada'))
      .toMatchObject({ unlocked: true, unlockedAt: 77 })
  })

  it('sem-capivarada: blunder ou missedMate impedem', () => {
    expect(find(evaluateAchievements([entry({ ownMoves: 30, blunder: 1 })], NOW), 'sem-capivarada').unlocked).toBe(false)
    expect(find(evaluateAchievements([entry({ ownMoves: 30, missedMate: 1 })], NOW), 'sem-capivarada').unlocked).toBe(false)
  })

  it('sem-capivarada: basta uma entrada limpa entre várias sujas', () => {
    const h = [entry({ ownMoves: 30, blunder: 2 }), entry({ analyzedAt: 9999, ownMoves: 25 })]
    expect(find(evaluateAchievements(h, NOW), 'sem-capivarada')).toMatchObject({ unlocked: true, unlockedAt: 9999 })
  })

  it('sequência quebrada não conta', () => {
    const mk = (accs: number[]) =>
      accs.map((accuracy, i) => entry({ analyzedAt: 100 + i, accuracy }))
    expect(find(evaluateAchievements(mk([85, 70, 85, 85]), NOW), 'sequencia-3').unlocked).toBe(false)
    expect(find(evaluateAchievements(mk([85, 85, 85]), NOW), 'sequencia-3'))
      .toMatchObject({ unlocked: true, unlockedAt: 102 })
  })

  it('sequencia-3: 79.9 quebra, 80 conta', () => {
    const mk = (accs: number[]) => accs.map((accuracy, i) => entry({ analyzedAt: 100 + i, accuracy }))
    expect(find(evaluateAchievements(mk([80, 79.9, 80]), NOW), 'sequencia-3').unlocked).toBe(false)
    expect(find(evaluateAchievements(mk([80, 80, 80]), NOW), 'sequencia-3').unlocked).toBe(true)
  })

  it('sequencia-3 ordena por playedAt ?? analyzedAt', () => {
    // Ordem por analyzedAt seria 85,85,70,85 (sem sequência de 3 boas),
    // mas por playedAt é 85,70,85,85 (também sem sequência): deve ser false.
    const a = entry({ analyzedAt: 1, playedAt: 10, accuracy: 85 })
    const b = entry({ analyzedAt: 2, playedAt: 30, accuracy: 85 })
    const c = entry({ analyzedAt: 3, playedAt: 20, accuracy: 70 })
    const d = entry({ analyzedAt: 4, playedAt: 40, accuracy: 85 })
    expect(find(evaluateAchievements([a, b, c, d], NOW), 'sequencia-3').unlocked).toBe(false)
    // Por analyzedAt: 85,85,70,85 (quebrada). Por playedAt: 85,85,85,70 (sequência).
    const e = entry({ analyzedAt: 1, playedAt: 10, accuracy: 85 })
    const f = entry({ analyzedAt: 2, playedAt: 20, accuracy: 85 })
    const g = entry({ analyzedAt: 3, playedAt: 40, accuracy: 70 })
    const h = entry({ analyzedAt: 4, playedAt: 30, accuracy: 85 })
    expect(find(evaluateAchievements([e, f, g, h], NOW), 'sequencia-3').unlocked).toBe(true)
  })

  it('sequencia-3 usa analyzedAt quando playedAt é null', () => {
    const h = [
      entry({ analyzedAt: 3, accuracy: 85 }),
      entry({ analyzedAt: 1, accuracy: 85 }),
      entry({ analyzedAt: 2, accuracy: 85 }),
    ]
    expect(find(evaluateAchievements(h, NOW), 'sequencia-3').unlocked).toBe(true)
  })
})
