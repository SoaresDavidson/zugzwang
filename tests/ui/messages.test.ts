// @vitest-environment jsdom
/*
 * Contrato: src/ui/messages.ts exporta
 *   ERROR_MESSAGE: Record<GameErrorCode | 'engine-failed', (source?: string) => string>
 *   playerLabel(p: Player): string
 * `source` é o nome já legível da fonte ("Lichess" ou "Chess.com").
 */
import type { Player } from '../../src/core/sources/types'
import { ERROR_MESSAGE, playerLabel } from '../../src/ui/messages'

describe('ERROR_MESSAGE', () => {
  it('textos fixos', () => {
    expect(ERROR_MESSAGE['invalid-pgn']()).toBe('Não consegui ler esse PGN. Confira se colou a partida inteira.')
    expect(ERROR_MESSAGE['variant-unsupported']()).toBe(
      'Por enquanto só analiso xadrez padrão. Xadrez 960 e outras variantes ficam de fora.',
    )
    expect(ERROR_MESSAGE['custom-position']()).toBe(
      'Essa partida começa de uma posição personalizada. Por enquanto só analiso partidas a partir da posição inicial.',
    )
    expect(ERROR_MESSAGE.empty()).toBe('Essa partida não tem lances.')
    expect(ERROR_MESSAGE['engine-failed']()).toBe('O motor de análise não carregou neste navegador.')
  })

  it.each(['Lichess', 'Chess.com'])('textos com fonte: %s', (f) => {
    expect(ERROR_MESSAGE['user-not-found'](f)).toBe(`Não achei esse usuário no ${f}.`)
    expect(ERROR_MESSAGE['rate-limited'](f)).toBe(`O ${f} pediu uma pausa. Tente de novo em um minuto.`)
    expect(ERROR_MESSAGE.network(f)).toBe(`Falha de conexão com o ${f}.`)
  })

  it('tem exatamente as 9 chaves', () => {
    expect(Object.keys(ERROR_MESSAGE).sort()).toEqual([
      'analysis-failed',
      'custom-position', 'empty', 'engine-failed', 'invalid-pgn',
      'network', 'rate-limited', 'user-not-found', 'variant-unsupported',
    ])
  })
})

describe('playerLabel', () => {
  const p = (o: Partial<Player>): Player => ({ name: null, rating: null, aiLevel: null, ...o })
  it('usa o nome quando existe', () => expect(playerLabel(p({ name: 'davi', rating: 1500 }))).toBe('davi'))
  it('IA vira Stockfish nível N', () => expect(playerLabel(p({ aiLevel: 3 }))).toBe('Stockfish nível 3'))
  it('sem nome e sem IA é Anônimo', () => expect(playerLabel(p({}))).toBe('Anônimo'))
})
