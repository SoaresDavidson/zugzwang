import { useState } from 'react'
import { parsePgn } from '../core/pgn'
import type { GameSummary } from '../core/sources/types'
import { GameError } from '../core/types'
import type { ParsedGame } from '../core/types'
import { PgnPaste } from './input/PgnPaste'
import { UserSearch } from './input/UserSearch'
import { ERROR_MESSAGE, LABEL } from './messages'
import { useAnalysis } from './useAnalysis'

function ReviewPlaceholder({ game, onBack }: { game: ParsedGame; onBack: () => void }) {
  const { status, progress, error, fromCache } = useAnalysis(game)
  const total = progress?.total ?? game.plies.length + 1
  const done = status === 'done' ? total : (progress?.evaluated ?? 0)
  return (
    <section className="stack" aria-live="polite">
      <div className="row">
        <button className="btn" type="button" onClick={onBack}>{LABEL.back}</button>
        <span className="muted">{game.headers.White ?? '?'} contra {game.headers.Black ?? '?'}</span>
      </div>
      {status === 'error' ? (
        <p className="error" role="alert">{error}</p>
      ) : (
        <>
          <p>{status === 'done' ? LABEL.analysisDone : `${LABEL.analyzing}: ${done} de ${total} posições`}</p>
          <progress className="bar" max={total} value={done} aria-label={LABEL.analyzing} />
          {fromCache && <p className="muted">{LABEL.fromCache}</p>}
          {status === 'done' && <p className="muted">{LABEL.reviewSoon}</p>}
        </>
      )}
    </section>
  )
}

export function App() {
  const [game, setGame] = useState<ParsedGame | null>(null)
  const [tab, setTab] = useState<'paste' | 'search'>('paste')
  const [pickError, setPickError] = useState<string | null>(null)

  function pick(s: GameSummary) {
    try {
      setPickError(null)
      setGame(parsePgn(s.pgn))
    } catch (err) {
      setPickError(ERROR_MESSAGE[err instanceof GameError ? err.code : 'invalid-pgn']())
    }
  }

  return (
    <main className="shell">
      <header className="masthead">
        <div className="strip" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => <i key={i} />)}
        </div>
        <h1>{LABEL.appName}</h1>
        <p className="muted">{LABEL.tagline}</p>
      </header>
      {game ? (
        <ReviewPlaceholder game={game} onBack={() => setGame(null)} />
      ) : (
        <>
          <div className="tabs" role="tablist">
            {([['paste', LABEL.tabPaste], ['search', LABEL.tabSearch]] as const).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                type="button"
                className={tab === id ? 'tab on' : 'tab'}
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === 'paste' ? (
              <PgnPaste onGame={setGame} />
            ) : (
              <>
                <UserSearch onPick={pick} />
                {pickError && <p className="error" role="alert">{pickError}</p>}
              </>
            )}
          </div>
        </>
      )}
    </main>
  )
}
