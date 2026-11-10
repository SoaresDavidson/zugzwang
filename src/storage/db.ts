import { openDB, type IDBPDatabase } from 'idb'
import type { HistoryEntry, Profile } from '../core/achievements'
import type { GameAnalysis } from '../core/types'

const PROFILE_KEY = 'me'
let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  dbPromise ??= openDB('zugzwang', 1, {
    upgrade(db) {
      db.createObjectStore('analyses', { keyPath: 'key' })
      db.createObjectStore('history', { keyPath: 'key' })
      db.createObjectStore('profile')
    },
  })
  return dbPromise
}

export async function closeDb(): Promise<void> {
  const p = dbPromise
  dbPromise = null
  if (p) (await p).close()
}

export async function getCachedAnalysis(key: string): Promise<GameAnalysis | undefined> {
  return (await getDb()).get('analyses', key)
}
export async function putAnalysis(a: GameAnalysis): Promise<void> {
  await (await getDb()).put('analyses', a)
}
export async function putHistory(e: HistoryEntry): Promise<void> {
  await (await getDb()).put('history', e)
}
export async function listHistory(): Promise<HistoryEntry[]> {
  return (await getDb()).getAll('history')
}
export async function getProfile(): Promise<Profile> {
  return ((await (await getDb()).get('profile', PROFILE_KEY)) as Profile | undefined) ?? {}
}
export async function setProfile(p: Profile): Promise<void> {
  await (await getDb()).put('profile', p, PROFILE_KEY)
}
