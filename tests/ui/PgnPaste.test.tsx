// @vitest-environment jsdom
/*
 * Contrato: src/ui/input/PgnPaste.tsx exporta (nomeado) `PgnPaste({ onGame }: { onGame: (g: ParsedGame) => void })`.
 * Rótulos: campo de texto com label "PGN da partida"; botão "Analisar" (desabilitado com campo vazio).
 * Erros de parsePgn aparecem como texto com a mensagem de ERROR_MESSAGE e onGame não é chamado.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { parsePgn } from '../../src/core/pgn'
import { ERROR_MESSAGE } from '../../src/ui/messages'
import { PgnPaste } from '../../src/ui/input/PgnPaste'
import { SCHOLAR } from '../fixtures/scholarEvals'

const PGN_960 = `[Event "x"]
[Variant "Chess960"]
[Result "*"]

1. e4 e5 *`

async function paste(text: string) {
  const user = userEvent.setup()
  const onGame = vi.fn()
  render(<PgnPaste onGame={onGame} />)
  await user.click(screen.getByLabelText('PGN da partida'))
  await user.paste(text)
  return { user, onGame }
}

describe('PgnPaste', () => {
  it('PGN válido chama onGame com a partida lida', async () => {
    const { user, onGame } = await paste(SCHOLAR)
    await user.click(screen.getByRole('button', { name: 'Analisar' }))
    expect(onGame).toHaveBeenCalledTimes(1)
    expect(onGame).toHaveBeenCalledWith(parsePgn(SCHOLAR))
  })

  it('PGN inválido mostra a mensagem e não chama onGame', async () => {
    const { user, onGame } = await paste('isto não é um pgn @@@')
    await user.click(screen.getByRole('button', { name: 'Analisar' }))
    expect(screen.getByText(ERROR_MESSAGE['invalid-pgn']())).toBeInTheDocument()
    expect(onGame).not.toHaveBeenCalled()
  })

  it('xadrez 960 mostra variant-unsupported', async () => {
    const { user, onGame } = await paste(PGN_960)
    await user.click(screen.getByRole('button', { name: 'Analisar' }))
    expect(screen.getByText(ERROR_MESSAGE['variant-unsupported']())).toBeInTheDocument()
    expect(onGame).not.toHaveBeenCalled()
  })

  it('campo vazio deixa o botão desabilitado', async () => {
    const user = userEvent.setup()
    render(<PgnPaste onGame={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Analisar' })).toBeDisabled()
    await user.click(screen.getByLabelText('PGN da partida'))
    await user.paste('1. e4')
    expect(screen.getByRole('button', { name: 'Analisar' })).toBeEnabled()
  })
})
