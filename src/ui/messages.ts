import { GameError } from '../core/types'
import type { GameErrorCode } from '../core/types'
import type { Player, Source, TimeClass } from '../core/sources/types'

export const ERROR_MESSAGE: Record<GameErrorCode | 'engine-failed' | 'analysis-failed',(source?: string) => string> = {
  'invalid-pgn': () => 'Não consegui ler esse PGN. Confira se colou a partida inteira.',
  'variant-unsupported': () => 'Por enquanto só analiso xadrez padrão. Xadrez 960 e outras variantes ficam de fora.',
  'custom-position': () =>
    'Essa partida começa de uma posição personalizada. Por enquanto só analiso partidas a partir da posição inicial.',
  empty: () => 'Essa partida não tem lances.',
  'user-not-found': (source) => `Não achei esse usuário no ${source}.`,
  'rate-limited': (source) => `O ${source} pediu uma pausa. Tente de novo em um minuto.`,
  network: (source) => `Falha de conexão com o ${source}.`,
  'engine-failed': () => 'O motor de análise não carregou neste navegador.',
  'analysis-failed': () => 'Algo deu errado durante a análise. Tente de novo.',
}

/** Traduz um erro em mensagem; erros que não são GameError usam `fallback`. */
export function errorMessage(err: unknown, fallback: GameErrorCode, source?: string): string {
  return ERROR_MESSAGE[err instanceof GameError ? err.code : fallback](source);
}

export const SOURCE_NAME: Record<Source, string> = { lichess: 'Lichess', chesscom: 'Chess.com' };

export const progressText = (done: number, total: number) =>
  `Analisando ${done} de ${total} posições`;

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
  versus: 'contra',
  sourceField: 'Fonte',
  unnamedPlayer: '?',
  tabsLabel: 'Como informar a partida',
  analyzing: 'Analisando',
  analysisDone: 'Análise pronta',
  fromCache: 'Resultado guardado neste navegador.',
  boardLabel: 'Tabuleiro',
  graphLabel: 'Gráfico de avaliação da partida. Clique para ir a um lance.',
  navLabel: 'Navegar pelos lances',
  first: 'Primeiro lance',
  prev: 'Lance anterior',
  next: 'Próximo lance',
  last: 'Último lance',
  retry: 'Tentar de novo',
  retryPrompt: 'Faça no tabuleiro o lance que você jogaria.',
  retryRefused: 'Ainda não. Tente outro lance.',
  showBest: 'Mostrar melhor',
  backToMove: 'Ver o lance jogado',
  summary: 'Resumo da partida',
  accuracy: 'de precisão',
  white: 'Brancas',
  black: 'Pretas',
}

export const retryAccepted = (label: string) => `Boa! ${label}.`
