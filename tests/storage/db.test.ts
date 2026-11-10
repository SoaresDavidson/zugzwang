// @vitest-environment node
import 'fake-indexeddb/auto'
import type { HistoryEntry } from '../../src/core/achievements'
import type { CategoryCounts, GameAnalysis } from '../../src/core/types'
import {
  closeDb,
  getCachedAnalysis,
  getProfile,
  listHistory,
  putAnalysis,
  putHistory,
  setProfile,
} from '../../src/storage/db'

/*
 * Exigência de interface para o implementador: `src/storage/db.ts` deve exportar
 * `closeDb(): Promise<void>`, que fecha a conexão aberta e descarta o cache da
 * promessa de conexão (a próxima chamada reabre o banco). O teste chama `closeDb()`
 * e depois `indexedDB.deleteDatabase('zugzwang')` a cada beforeEach; sem fechar a
 * conexão o delete ficaria bloqueado. Banco `zugzwang`, versão 1, stores
 * `analyses` (chave `key`), `history` (chave `key`) e `profile`.
 */

const zeros = (): CategoryCounts => ({
  book: 0, brilliant: 0, great: 0, best: 0, excellent: 0, good: 0,
  inaccuracy: 0, mistake: 0, blunder: 0, missedMate: 0,
})

function analysis(key: string): GameAnalysis {
  return {
    key,
    headers: { White: 'a', Black: 'b' },
    opening: { eco: 'C20', name: 'King Pawn Game' },
    moves: [],
    evals: [],
    accuracy: { w: 87.4, b: 60 },
    rating: { w: 2059, b: 1500 },
    counts: { w: zeros(), b: zeros() },
  }
}
const hist = (key: string, o: Partial<HistoryEntry> = {}): HistoryEntry => ({
  key, analyzedAt: 1000, playedAt: null, playerColor: 'w',
  counts: zeros(), accuracy: 80, ownMoves: 30, ...o,
})

beforeEach(async () => {
  await closeDb()
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('zugzwang')
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('deleteDatabase bloqueado: conexão não fechada'))
  })
})
afterAll(async () => { await closeDb() })

describe('analyses', () => {
  it('putAnalysis e getCachedAnalysis ida e volta', async () => {
    const a = analysis('abc')
    await putAnalysis(a)
    expect(await getCachedAnalysis('abc')).toEqual(a)
  })
  it('chave inexistente retorna undefined', async () => {
    expect(await getCachedAnalysis('nao-existe')).toBeUndefined()
  })
  it('putAnalysis com a mesma key substitui', async () => {
    await putAnalysis(analysis('abc'))
    await putAnalysis({ ...analysis('abc'), accuracy: { w: 10, b: 20 } })
    expect((await getCachedAnalysis('abc'))?.accuracy).toEqual({ w: 10, b: 20 })
  })
})

describe('history', () => {
  it('listHistory vazio retorna []', async () => {
    expect(await listHistory()).toEqual([])
  })
  it('listHistory lista tudo', async () => {
    await putHistory(hist('a'))
    await putHistory(hist('b', { playedAt: 5 }))
    await putHistory(hist('c'))
    const list = await listHistory()
    expect(list).toHaveLength(3)
    expect(list.map((e) => e.key).sort()).toEqual(['a', 'b', 'c'])
    expect(list.find((e) => e.key === 'b')?.playedAt).toBe(5)
  })
  it('putHistory com a mesma key substitui', async () => {
    const e1 = hist('a')
    await putHistory(e1)
    await putHistory({ ...e1, accuracy: 10 })
    const list = await listHistory()
    expect(list).toHaveLength(1)
    expect(list[0].accuracy).toBe(10)
  })
})

describe('profile', () => {
  it('getProfile vazio retorna {}', async () => {
    expect(await getProfile()).toEqual({})
  })
  it('setProfile e getProfile', async () => {
    await setProfile({ lichess: 'davi', chesscom: 'davi_cc' })
    expect(await getProfile()).toEqual({ lichess: 'davi', chesscom: 'davi_cc' })
  })
  it('setProfile substitui o anterior', async () => {
    await setProfile({ lichess: 'davi' })
    await setProfile({ chesscom: 'x' })
    expect(await getProfile()).toEqual({ chesscom: 'x' })
  })
})

describe('isolamento', () => {
  it('dados de um teste não vazam para o próximo', async () => {
    expect(await listHistory()).toEqual([])
    expect(await getProfile()).toEqual({})
    expect(await getCachedAnalysis('abc')).toBeUndefined()
  })
})
