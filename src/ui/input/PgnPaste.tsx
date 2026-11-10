import { useState } from 'react'
import type { FormEvent } from 'react'
import { parsePgn } from '../../core/pgn'
import { GameError } from '../../core/types'
import type { ParsedGame } from '../../core/types'
import { ERROR_MESSAGE, LABEL } from '../messages'

export function PgnPaste({ onGame }: { onGame: (g: ParsedGame) => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const game = parsePgn(text)
      setError(null)
      onGame(game)
    } catch (err) {
      setError(ERROR_MESSAGE[err instanceof GameError ? err.code : 'invalid-pgn']())
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label className="field">
        <span className="field-label">{LABEL.pgnField}</span>
        <textarea
          className="input pgn"
          rows={9}
          value={text}
          placeholder={LABEL.pgnPlaceholder}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button className="btn primary" type="submit" disabled={text.trim() === ''}>{LABEL.analyze}</button>
      </div>
    </form>
  )
}
