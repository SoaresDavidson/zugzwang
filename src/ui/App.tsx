import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { parsePgn } from '../core/pgn'
import type { GameSummary } from '../core/sources/types'
import type { ParsedGame } from '../core/types'
import { PgnPaste } from './input/PgnPaste'
import { UserSearch } from './input/UserSearch'
import { LABEL, errorMessage, progressText } from './messages'
import { useAnalysis } from './useAnalysis'

function ReviewPlaceholder({ game, onBack }: { game: ParsedGame; onBack: () => void }) {
  const { status, progress, error, fromCache } = useAnalysis(game)
  const total = progress?.total ?? game.plies.length + 1
  const done = status === 'done' ? total : (progress?.evaluated ?? 0)
  const white = game.headers.White ?? LABEL.unnamedPlayer
  const black = game.headers.Black ?? LABEL.unnamedPlayer
  return (
    <section className="stack">
      <div className="row">
        <button className="btn" type="button" onClick={onBack}>{LABEL.back}</button>
        <span className="muted">{white} {LABEL.versus} {black}</span>
      </div>
      {status === 'error' ? (
        <p className="error" role="alert">{error}</p>
      ) : (
        <>
          {/* Região viva só com início e fim; o andamento fica fora dela. */}
          <p role="status">{status === 'done' ? LABEL.analysisDone : LABEL.analyzing}</p>
          {status !== 'done' && <p className="muted">{progressText(done, total)}</p>}
          <progress className="bar" max={total} value={done} aria-label={LABEL.analyzing} />
          {fromCache && <p className="muted">{LABEL.fromCache}</p>}
          {status === 'done' && <p className="muted">{LABEL.reviewSoon}</p>}
        </>
      )}
    </section>
  )
}

type Tab = 'paste' | 'search'
const TABS: ReadonlyArray<readonly [Tab, string]> = [['paste', LABEL.tabPaste], ['search', LABEL.tabSearch]]
const tabId = (t: Tab) => `tab-${t}`
const PANEL_ID = 'tabpanel-entrada'

export function App() {
  const [game, setGame] = useState<ParsedGame | null>(null)
  const [tab, setTab] = useState<Tab>('paste')
  const [pickError, setPickError] = useState<string | null>(null)

  function pick(s: GameSummary) {
    try {
      setPickError(null)
      setGame(parsePgn(s.pgn))
    } catch (err) {
      setPickError(errorMessage(err, 'invalid-pgn'))
    }
  }

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    const i = TABS.findIndex(([id]) => id === tab)
    let next: number
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return
    e.preventDefault()
    const id = TABS[next][0]
    setTab(id)
    document.getElementById(tabId(id))?.focus()
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
      {game && <ReviewPlaceholder game={game} onBack={() => setGame(null)} />}
      {/* A entrada fica montada e só escondida, para "Voltar" devolver tudo como estava. */}
      <div hidden={game !== null}>
        <div className="tabs" role="tablist" aria-label={LABEL.tabsLabel}>
          {TABS.map(([id, label]) => (
            <button
              key={id}
              id={tabId(id)}
              role="tab"
              type="button"
              className={tab === id ? 'tab on' : 'tab'}
              aria-selected={tab === id}
              aria-controls={PANEL_ID}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={onTabKey}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={PANEL_ID} aria-labelledby={tabId(tab)}>
          <div hidden={tab !== 'paste'}>
            <PgnPaste onGame={setGame} />
          </div>
          <div hidden={tab !== 'search'}>
            <UserSearch onPick={pick} />
            {pickError && <p className="error" role="alert">{pickError}</p>}
          </div>
        </div>
      </div>
    </main>
  )
}
