import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { fetchChesscomGames } from '../../core/sources/chesscom'
import { fetchLichessGames } from '../../core/sources/lichess'
import type { GameSummary, Source, TimeClass } from '../../core/sources/types'
import { GameError } from '../../core/types'
import { getProfile, setProfile } from '../../storage/db'
import { ERROR_MESSAGE, LABEL, TIME_CLASS_LABEL, playerLabel } from '../messages'

type Fetcher = (username: string, signal?: AbortSignal, fetchFn?: typeof fetch) => Promise<GameSummary[]>

const SOURCE_NAME: Record<Source, string> = { lichess: 'Lichess', chesscom: 'Chess.com' }
const FILTERS: Array<TimeClass | 'all'> = ['all', 'bullet', 'blitz', 'rapid', 'classical']

const fmtDate = (t: number) => new Date(t).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
const side = (p: GameSummary['white']) => (p.rating !== null ? `${playerLabel(p)} (${p.rating})` : playerLabel(p))

export function UserSearch({
  onPick,
  fetchers = { lichess: fetchLichessGames, chesscom: fetchChesscomGames },
}: {
  onPick: (g: GameSummary) => void
  fetchers?: { lichess: Fetcher; chesscom: Fetcher }
}) {
  const [source, setSource] = useState<Source>('lichess')
  const [username, setUsername] = useState('')
  const [games, setGames] = useState<GameSummary[] | null>(null)
  const [filter, setFilter] = useState<TimeClass | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = useRef<AbortController | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const name = username.trim()
    if (!name) return
    current.current?.abort()
    const ctrl = new AbortController()
    current.current = ctrl
    const stale = () => current.current !== ctrl
    setLoading(true)
    setError(null)
    try {
      const result = await fetchers[source](name, ctrl.signal)
      if (stale()) return
      setGames(result)
      setFilter('all')
      setLoading(false)
      getProfile().then((p) => setProfile({ ...p, [source]: name })).catch(() => {})
    } catch (err) {
      if (stale()) return
      setGames(null)
      setError(ERROR_MESSAGE[err instanceof GameError ? err.code : 'network'](SOURCE_NAME[source]))
    } finally {
      if (!stale()) setLoading(false)
    }
  }

  const shown = games?.filter((g) => filter === 'all' || g.timeClass === filter) ?? []

  return (
    <div className="stack">
      <form className="stack" onSubmit={submit}>
        <div className="seg" role="radiogroup" aria-label="Fonte">
          {(Object.keys(SOURCE_NAME) as Source[]).map((s) => (
            <label key={s} className={source === s ? 'seg-item on' : 'seg-item'}>
              <input
                type="radio"
                name="source"
                checked={source === s}
                onChange={() => setSource(s)}
              />
              {SOURCE_NAME[s]}
            </label>
          ))}
        </div>
        <label className="field">
          <span className="field-label">{LABEL.userField}</span>
          <input
            className="input"
            value={username}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <div className="row">
          <button className="btn primary" type="submit" disabled={loading}>{LABEL.search}</button>
          {loading && <span className="muted" role="status">{LABEL.searching}</span>}
        </div>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {games && (
        <>
          <div className="chips">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={filter === f ? 'chip on' : 'chip'}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? LABEL.all : TIME_CLASS_LABEL[f]}
              </button>
            ))}
          </div>
          {shown.length === 0 && <p className="muted">{LABEL.noGames}</p>}
          <ul className="games">
            {shown.map((g) => (
              <li key={g.id}>
                <button type="button" className="game" onClick={() => onPick(g)}>
                  <span className="game-players">
                    <span>{side(g.white)}</span>
                    <span className="vs">contra</span>
                    <span>{side(g.black)}</span>
                  </span>
                  <span className="game-meta">
                    <b className="result">{g.result}</b>
                    <span>{TIME_CLASS_LABEL[g.timeClass]}</span>
                    <span>{fmtDate(g.playedAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
