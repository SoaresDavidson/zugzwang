import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { parsePgn } from '../core/pgn'
import type { GameSummary } from '../core/sources/types'
import type { ParsedGame } from '../core/types'
import { PgnPaste } from './input/PgnPaste'
import { UserSearch } from './input/UserSearch'
import { LABEL, errorMessage } from './messages'

// Revisão (com chessground e o CSS do tabuleiro) só carrega quando há partida.
const ReviewView = lazy(() => import('./review/ReviewView').then((m) => ({ default: m.ReviewView })))

type Tab = 'paste' | 'search'
const TABS: ReadonlyArray<readonly [Tab, string]> = [['paste', LABEL.tabPaste], ['search', LABEL.tabSearch]]
const tabId = (t: Tab) => `tab-${t}`
const PANEL_ID = 'tabpanel-entrada'

export function App() {
  const [game, setGame] = useState<ParsedGame | null>(null)
  const [tab, setTab] = useState<Tab>('paste')
  const [pickError, setPickError] = useState<string | null>(null)
  const hadGame = useRef(false)

  // Ao voltar da revisão, o foco vai para a aba ativa.
  useEffect(() => {
    if (hadGame.current && !game) document.getElementById(tabId(tab))?.focus()
    hadGame.current = game !== null
  }, [game, tab])

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
    <main className={game ? 'shell wide' : 'shell'}>
      <header className="masthead">
        <div className="strip" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => <i key={i} />)}
        </div>
        <h1>{LABEL.appName}</h1>
        {!game && <p className="muted">{LABEL.tagline}</p>}
      </header>
      {game && (
        <Suspense fallback={<p className="muted" role="status">{LABEL.loading}</p>}>
          <ReviewView game={game} onBack={() => setGame(null)} />
        </Suspense>
      )}
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
