import type { GameErrorCode } from '../core/types'
import type { Player, TimeClass } from '../core/sources/types'

export const ERROR_MESSAGE: Record<GameErrorCode | 'engine-failed', (source?: string) => string> = {
  'invalid-pgn': () => 'Não consegui ler esse PGN. Confira se colou a partida inteira.',
  'variant-unsupported': () => 'Por enquanto só analiso xadrez padrão. Xadrez 960 e outras variantes ficam de fora.',
  'custom-position': () =>
    'Essa partida começa de uma posição personalizada. Por enquanto só analiso partidas a partir da posição inicial.',
  empty: () => 'Essa partida não tem lances.',
  'user-not-found': (source) => `Não achei esse usuário no ${source}.`,
  'rate-limited': (source) => `O ${source} pediu uma pausa. Tente de novo em um minuto.`,
  network: (source) => `Falha de conexão com o ${source}.`,
  'engine-failed': () => 'O motor de análise não carregou neste navegador.',
}

export function playerLabel(p: Player): string {
  if (p.name) return p.name
  if (p.aiLevel !== null) return `Stockfish nível ${p.aiLevel}`
  return 'Anônimo'
}

export const TIME_CLASS_LABEL: Record<TimeClass, string> = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rápida',
  classical: 'Clássica',
}

export const LABEL = {
  appName: 'Zugzwang',
  tagline: 'Cole uma partida ou busque pelo seu usuário. A análise roda no seu navegador.',
  tabPaste: 'Colar PGN',
  tabSearch: 'Buscar partidas',
  pgnField: 'PGN da partida',
  pgnPlaceholder: '1. e4 e5 2. Cf3 Cc6 ...',
  analyze: 'Analisar',
  userField: 'Usuário',
  search: 'Buscar',
  searching: 'Buscando...',
  all: 'Todas',
  noGames: 'Nenhuma partida nesse ritmo.',
  back: 'Voltar',
  analyzing: 'Analisando',
  analysisDone: 'Análise pronta',
  fromCache: 'Resultado guardado neste navegador.',
  reviewSoon: 'A tela de revisão chega na próxima etapa.',
}
