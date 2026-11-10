import { readFileSync } from 'node:fs'
import { fetchChesscomGames } from '../../src/core/sources/chesscom'
import { fetchLichessGames } from '../../src/core/sources/lichess'
import { GameError } from '../../src/core/types'

const fx = (name: string) => readFileSync(new URL(`../fixtures/api/${name}`, import.meta.url), 'utf8')
const LICHESS_ND = fx('lichess.ndjson')
const CC_ARCHIVES = fx('chesscom-archives.json')
const CC_10 = fx('chesscom-2026-10.json')
const CC_11 = fx('chesscom-2026-11.json')

type Call = { url: string; init?: RequestInit }
type FakeFetch = ((input: unknown, init?: RequestInit) => Promise<Response>) & { urls: string[]; calls: Call[] }

/** fetch falso: serve `routes` por URL exata; qualquer outra URL responde 404. */
function makeFetch(routes: Record<string, string | number | (() => Response)>): FakeFetch {
  const calls: Call[] = []
  const fn = (async (input: unknown, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const r = routes[url]
    if (r === undefined) return new Response('not found', { status: 404 })
    if (typeof r === 'function') return r()
    if (typeof r === 'number') return new Response('', { status: r })
    return new Response(r, { status: 200 })
  }) as FakeFetch
  fn.calls = calls
  Object.defineProperty(fn, 'urls', { get: () => calls.map(c => c.url) })
  return fn
}

const LICHESS_URL =
  'https://lichess.org/api/games/user/Davi?max=50&pgnInJson=true&perfType=ultraBullet,bullet,blitz,rapid,classical,correspondence'
const CC_ARCH_URL = 'https://api.chess.com/pub/player/davi/games/archives'
const CC_M10 = 'https://api.chess.com/pub/player/erik/games/2026/10'
const CC_M11 = 'https://api.chess.com/pub/player/erik/games/2026/11'

const fakeFetch = makeFetch({
  [LICHESS_URL]: LICHESS_ND,
  [CC_ARCH_URL]: CC_ARCHIVES,
  'https://api.chess.com/pub/player/erik/games/archives': CC_ARCHIVES,
  [CC_M10]: CC_10,
  [CC_M11]: CC_11,
}) as FakeFetch & { urls: string[] }

/** fetch falso que responde sempre com o mesmo status. */
const statusFetch = (status: number) => (async () => new Response('', { status })) as unknown as typeof fetch
const rejectingFetch = (err: unknown) => (async () => { throw err }) as unknown as typeof fetch

const asFetch = (f: FakeFetch) => f as unknown as typeof fetch

// ---------- builders sintéticos ----------

function pgnWith(result: string, extra = ''): string {
  return `[Event "x"]\n[White "a"]\n[Black "b"]\n[Result "${result}"]\n${extra}\n1. e4 e5 ${result}\n\n`
}

function lichessGame(id: string, createdAt: number, over: Record<string, unknown> = {}) {
  return {
    id,
    variant: 'standard',
    speed: 'blitz',
    createdAt,
    players: { white: { user: { name: 'a' }, rating: 1500 }, black: { user: { name: 'b' }, rating: 1500 } },
    pgn: pgnWith('1-0'),
    ...over,
  }
}
const nd = (games: unknown[]) => games.map(g => JSON.stringify(g)).join('\n') + '\n'

function ccGame(uuid: string, endTime: number, over: Record<string, unknown> = {}) {
  return {
    uuid,
    url: `https://www.chess.com/game/live/${uuid}`,
    rules: 'chess',
    time_class: 'blitz',
    end_time: endTime,
    white: { username: 'a', rating: 1500 },
    black: { username: 'b', rating: 1500 },
    pgn: pgnWith('1-0'),
    ...over,
  }
}

const ccMonthUrl = (user: string, ym: string) => `https://api.chess.com/pub/player/${user}/games/${ym}`
const ccArchivesUrl = (user: string) => `https://api.chess.com/pub/player/${user}/games/archives`
const lichessUrl = (user: string) =>
  `https://lichess.org/api/games/user/${user}?max=50&pgnInJson=true&perfType=ultraBullet,bullet,blitz,rapid,classical,correspondence`

// ---------- Lichess ----------

describe('fetchLichessGames', () => {
  it('lichess: filtra variantes e normaliza ritmo', async () => {
    const g = await fetchLichessGames('Davi', undefined, asFetch(fakeFetch))
    expect(g.every(x => x.source === 'lichess')).toBe(true)
    expect(g.some(x => x.pgn.includes('Chess960'))).toBe(false)
    expect(g.map(x => x.timeClass)).not.toContain('correspondence')
  })

  it('pede a URL e o header Accept do plano', async () => {
    const f = makeFetch({ [LICHESS_URL]: LICHESS_ND })
    await fetchLichessGames('Davi', undefined, asFetch(f))
    expect(f.calls).toHaveLength(1)
    expect(f.calls[0].url).toBe(LICHESS_URL)
    expect(new Headers(f.calls[0].init?.headers).get('accept')).toBe('application/x-ndjson')
  })

  it('fixture: 5 partidas padrão em ordem decrescente de playedAt (a chess960 sai)', async () => {
    const g = await fetchLichessGames('Davi', undefined, asFetch(fakeFetch))
    expect(g.map(x => x.id)).toEqual(['jifSy3J0', 'sKeE9m5r', 'rlpjN84W', '3HEvNONw', 'gvBTv47J'])
    expect(g.map(x => x.playedAt)).toEqual([
      1793809937398, 1793809317425, 1781987017731, 1769256670657, 1729185224330,
    ])
  })

  it('ordena por playedAt decrescente mesmo com entrada embaralhada', async () => {
    const f = makeFetch({
      [lichessUrl('u')]: nd([lichessGame('b', 200), lichessGame('c', 300), lichessGame('a', 100)]),
    })
    const g = await fetchLichessGames('u', undefined, asFetch(f))
    expect(g.map(x => x.id)).toEqual(['c', 'b', 'a'])
  })

  it('limita a 50 partidas, mantendo as mais recentes', async () => {
    const games = Array.from({ length: 60 }, (_, i) => lichessGame(`g${i}`, 1_000_000 + i))
    const f = makeFetch({ [lichessUrl('u')]: nd(games) })
    const g = await fetchLichessGames('u', undefined, asFetch(f))
    expect(g).toHaveLength(50)
    expect(g[0].id).toBe('g59')
    expect(g.at(-1)!.id).toBe('g10')
  })

  it('mapeia ultraBullet→bullet e correspondence→classical', async () => {
    const g = await fetchLichessGames('Davi', undefined, asFetch(fakeFetch))
    const byId = Object.fromEntries(g.map(x => [x.id, x.timeClass]))
    expect(byId['3HEvNONw']).toBe('bullet')
    expect(byId['gvBTv47J']).toBe('bullet')
    expect(byId['rlpjN84W']).toBe('classical')
    expect(byId['jifSy3J0']).toBe('blitz')
  })

  it('mantém bullet, blitz, rapid e classical como estão', async () => {
    const speeds = ['bullet', 'blitz', 'rapid', 'classical']
    const f = makeFetch({
      [lichessUrl('u')]: nd(speeds.map((s, i) => lichessGame(s, i + 1, { speed: s }))),
    })
    const g = await fetchLichessGames('u', undefined, asFetch(f))
    for (const x of g) expect(x.timeClass).toBe(x.id)
  })

  it('exclui qualquer variante diferente de standard', async () => {
    const f = makeFetch({
      [lichessUrl('u')]: nd([
        lichessGame('ok', 5),
        lichessGame('fp', 4, { variant: 'fromPosition' }),
        lichessGame('c9', 3, { variant: 'chess960' }),
        lichessGame('at', 2, { variant: 'atomic' }),
      ]),
    })
    const g = await fetchLichessGames('u', undefined, asFetch(f))
    expect(g.map(x => x.id)).toEqual(['ok'])
  })

  it('url de cada partida é https://lichess.org/{id}', async () => {
    const g = await fetchLichessGames('Davi', undefined, asFetch(fakeFetch))
    expect(g.length).toBeGreaterThan(0)
    for (const x of g) expect(x.url).toBe(`https://lichess.org/${x.id}`)
  })

  it('lê o result do header [Result] do PGN', async () => {
    const g = await fetchLichessGames('Davi', undefined, asFetch(fakeFetch))
    const byId = Object.fromEntries(g.map(x => [x.id, x.result]))
    expect(byId).toEqual({
      jifSy3J0: '1-0',
      sKeE9m5r: '0-1',
      rlpjN84W: '0-1',
      '3HEvNONw': '0-1',
      gvBTv47J: '1-0',
    })
  })

  it('result vem do PGN, não de winner/status (empate e em andamento)', async () => {
    const f = makeFetch({
      [lichessUrl('u')]: nd([
        lichessGame('d', 2, { pgn: pgnWith('1/2-1/2'), status: 'draw' }),
        lichessGame('s', 1, { pgn: pgnWith('*'), status: 'started' }),
      ]),
    })
    const g = await fetchLichessGames('u', undefined, asFetch(f))
    expect(g.map(x => x.result)).toEqual(['1/2-1/2', '*'])
  })

  it('preenche jogadores, ratings e pgn; rating ausente vira null', async () => {
    const f = makeFetch({
      [lichessUrl('u')]: nd([
        lichessGame('x', 1, {
          players: { white: { user: { name: 'Alice' }, rating: 1777 }, black: { user: { name: 'Bob' } } },
        }),
      ]),
    })
    const [x] = await fetchLichessGames('u', undefined, asFetch(f))
    expect(x.white).toEqual({ name: 'Alice', rating: 1777, aiLevel: null })
    expect(x.black.name).toBe('Bob')
    expect(x.black.rating).toBeNull()
    expect(x.pgn).toContain('[Result "1-0"]')
  })

  it('adversário anônimo/IA na fixture (correspondence) tem rating null', async () => {
    const g = await fetchLichessGames('Davi', undefined, asFetch(fakeFetch))
    const c = g.find(x => x.id === 'rlpjN84W')!
    expect(c.white).toEqual({ name: 'equili01', rating: 1500, aiLevel: null })
    expect(c.black.rating).toBeNull()
  })

  it('resposta vazia vira lista vazia', async () => {
    const f = makeFetch({ [lichessUrl('u')]: '' })
    expect(await fetchLichessGames('u', undefined, asFetch(f))).toEqual([])
  })

  it.each([[404, 'user-not-found'], [429, 'rate-limited'], [500, 'network']])('HTTP %i → %s', async (status, code) => {
    await expect(fetchLichessGames('x', undefined, statusFetch(status))).rejects.toMatchObject({ code })
  })

  it('outros status (403, 503) também viram network', async () => {
    for (const s of [403, 503]) {
      await expect(fetchLichessGames('x', undefined, statusFetch(s))).rejects.toMatchObject({ code: 'network' })
    }
  })

  it('erro vem como GameError', async () => {
    await expect(fetchLichessGames('x', undefined, statusFetch(404))).rejects.toBeInstanceOf(GameError)
  })

  it('falha de rede (fetch rejeita) → network', async () => {
    await expect(fetchLichessGames('x', undefined, rejectingFetch(new TypeError('Failed to fetch'))))
      .rejects.toMatchObject({ code: 'network' })
    await expect(fetchLichessGames('x', undefined, rejectingFetch(new TypeError('Failed to fetch'))))
      .rejects.toBeInstanceOf(GameError)
  })

  it('AbortError é repassado sem virar GameError', async () => {
    const abort = new DOMException('Aborted', 'AbortError')
    const p = fetchLichessGames('x', undefined, rejectingFetch(abort))
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
    await expect(fetchLichessGames('x', undefined, rejectingFetch(abort))).rejects.not.toBeInstanceOf(GameError)
  })

  it('passa o signal ao fetch e respeita signal já abortado', async () => {
    const ac = new AbortController()
    const f = makeFetch({ [LICHESS_URL]: LICHESS_ND })
    await fetchLichessGames('Davi', ac.signal, asFetch(f))
    expect(f.calls[0].init?.signal).toBe(ac.signal)

    ac.abort()
    const p = fetchLichessGames('Davi', ac.signal, asFetch(makeFetch({ [LICHESS_URL]: LICHESS_ND })))
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
  })
})

// ---------- Chess.com ----------

describe('fetchChesscomGames', () => {
  it('chess.com: usa username minúsculo e junta meses do mais recente', async () => {
    const f = makeFetch({
      [CC_ARCH_URL]: CC_ARCHIVES,
      [CC_M10]: CC_10,
      [CC_M11]: CC_11,
    })
    // O arquivo de arquivos aponta para os meses de "erik"; o username 'Davi' só muda a primeira URL.
    const g = await fetchChesscomGames('Davi', undefined, asFetch(f))
    expect(f.urls[0]).toBe('https://api.chess.com/pub/player/davi/games/archives')
    expect(g[0].playedAt).toBeGreaterThan(g.at(-1)!.playedAt)
  })

  it('com o fetch compartilhado: primeira chamada é a de archives em minúsculas', async () => {
    const before = fakeFetch.urls.length
    const g = await fetchChesscomGames('Davi', undefined, asFetch(fakeFetch))
    expect(fakeFetch.urls[before]).toBe('https://api.chess.com/pub/player/davi/games/archives')
    expect(g[0].playedAt).toBeGreaterThan(g.at(-1)!.playedAt)
  })

  it('busca o mês mais recente antes do mais antigo', async () => {
    const f = makeFetch({
      [ccArchivesUrl('erik')]: CC_ARCHIVES,
      [CC_M10]: CC_10,
      [CC_M11]: CC_11,
    })
    await fetchChesscomGames('Erik', undefined, asFetch(f))
    expect(f.urls).toEqual([ccArchivesUrl('erik'), CC_M11, CC_M10])
  })

  it('para de buscar meses quando já juntou 50 partidas', async () => {
    const m = (n: number, base: number) => ({
      games: Array.from({ length: n }, (_, i) => ccGame(`${base}-${i}`, base + i)),
    })
    const f = makeFetch({
      [ccArchivesUrl('u')]: JSON.stringify({
        archives: [ccMonthUrl('u', '2026/09'), ccMonthUrl('u', '2026/10'), ccMonthUrl('u', '2026/11')],
      }),
      [ccMonthUrl('u', '2026/11')]: JSON.stringify(m(55, 3000)),
      [ccMonthUrl('u', '2026/10')]: JSON.stringify(m(55, 2000)),
      [ccMonthUrl('u', '2026/09')]: JSON.stringify(m(55, 1000)),
    })
    const g = await fetchChesscomGames('u', undefined, asFetch(f))
    expect(g).toHaveLength(50)
    expect(f.urls).toEqual([ccArchivesUrl('u'), ccMonthUrl('u', '2026/11')])
    expect(g[0].id).toBe('3000-54')
    expect(g.at(-1)!.id).toBe('3000-5')
  })

  it('completa com o mês anterior quando o mais recente tem menos de 50 e corta em 50', async () => {
    const m = (n: number, base: number) => ({
      games: Array.from({ length: n }, (_, i) => ccGame(`${base}-${i}`, base + i)),
    })
    const f = makeFetch({
      [ccArchivesUrl('u')]: JSON.stringify({ archives: [ccMonthUrl('u', '2026/10'), ccMonthUrl('u', '2026/11')] }),
      [ccMonthUrl('u', '2026/11')]: JSON.stringify(m(30, 3000)),
      [ccMonthUrl('u', '2026/10')]: JSON.stringify(m(30, 2000)),
    })
    const g = await fetchChesscomGames('u', undefined, asFetch(f))
    expect(g).toHaveLength(50)
    expect(g.slice(0, 30).every(x => x.id.startsWith('3000-'))).toBe(true)
    expect(g.slice(30).every(x => x.id.startsWith('2000-'))).toBe(true)
    expect(g.map(x => x.playedAt)).toEqual([...g.map(x => x.playedAt)].sort((a, b) => b - a))
  })

  it('fixture: 6 partidas padrão, ordem decrescente, com playedAt = end_time * 1000', async () => {
    const g = await fetchChesscomGames('erik', undefined, asFetch(fakeFetch))
    expect(g.map(x => x.playedAt)).toEqual([
      1794242268000, 1793544444000, 1793540394000, 1793293766000, 1791006449000, 1790845181000,
    ])
  })

  it('exclui chess960 e demais regras diferentes de chess', async () => {
    const g = await fetchChesscomGames('erik', undefined, asFetch(fakeFetch))
    expect(g).toHaveLength(6)
    expect(g.some(x => x.pgn.includes('Chess960'))).toBe(false)
    expect(g.every(x => !x.pgn.includes('[SetUp "1"]'))).toBe(true)
    expect(g.some(x => x.id.startsWith('98f089fa'))).toBe(false)
  })

  it('exclui partida rules=chess com [SetUp "1"] (posição personalizada)', async () => {
    const f = makeFetch({
      [ccArchivesUrl('u')]: JSON.stringify({ archives: [ccMonthUrl('u', '2026/11')] }),
      [ccMonthUrl('u', '2026/11')]: JSON.stringify({
        games: [
          ccGame('ok', 2),
          ccGame('setup', 3, { pgn: pgnWith('1-0', '[SetUp "1"]\n[FEN "8/8/8/8/8/8/8/K1k5 w - - 0 1"]\n') }),
          ccGame('odds', 1, { rules: 'oddschess' }),
        ],
      }),
    })
    const g = await fetchChesscomGames('u', undefined, asFetch(f))
    expect(g.map(x => x.id)).toEqual(['ok'])
  })

  it('mapeia daily→classical e mantém bullet/rapid', async () => {
    const g = await fetchChesscomGames('erik', undefined, asFetch(fakeFetch))
    const byEnd = Object.fromEntries(g.map(x => [x.playedAt, x.timeClass]))
    expect(byEnd[1793540394000]).toBe('classical') // daily
    expect(byEnd[1793544444000]).toBe('classical') // daily
    expect(byEnd[1794242268000]).toBe('rapid')
    expect(byEnd[1793293766000]).toBe('bullet')
    expect(g.map(x => x.timeClass)).not.toContain('daily')
  })

  it('mantém blitz como blitz', async () => {
    const f = makeFetch({
      [ccArchivesUrl('u')]: JSON.stringify({ archives: [ccMonthUrl('u', '2026/11')] }),
      [ccMonthUrl('u', '2026/11')]: JSON.stringify({ games: [ccGame('b', 1, { time_class: 'blitz' })] }),
    })
    expect((await fetchChesscomGames('u', undefined, asFetch(f)))[0].timeClass).toBe('blitz')
  })

  it('id = uuid, source = chesscom e url = url da partida', async () => {
    const raw = [...JSON.parse(CC_10).games, ...JSON.parse(CC_11).games] as { uuid: string; url: string; rules: string }[]
    const byUuid = new Map(raw.map(r => [r.uuid, r]))
    const g = await fetchChesscomGames('erik', undefined, asFetch(fakeFetch))
    expect(g.length).toBeGreaterThan(0)
    for (const x of g) {
      expect(x.source).toBe('chesscom')
      expect(byUuid.has(x.id)).toBe(true)
      expect(x.url).toBe(byUuid.get(x.id)!.url)
      expect(x.url).toMatch(/^https:\/\/www\.chess\.com\/game\/(live|daily)\/\d+$/)
    }
  })

  it('lê o result do header [Result] do PGN', async () => {
    const f = makeFetch({
      [ccArchivesUrl('u')]: JSON.stringify({ archives: [ccMonthUrl('u', '2026/11')] }),
      [ccMonthUrl('u', '2026/11')]: JSON.stringify({
        games: [
          // `white.result` etc. dizem outra coisa; vale o PGN.
          ccGame('w', 3, { pgn: pgnWith('1-0'), white: { username: 'a', rating: 1, result: 'resigned' } }),
          ccGame('d', 2, { pgn: pgnWith('1/2-1/2') }),
          ccGame('s', 1, { pgn: pgnWith('0-1') }),
        ],
      }),
    })
    const g = await fetchChesscomGames('u', undefined, asFetch(f))
    expect(g.map(x => x.result)).toEqual(['1-0', '1/2-1/2', '0-1'])
  })

  it('fixture: results vêm do PGN', async () => {
    const g = await fetchChesscomGames('erik', undefined, asFetch(fakeFetch))
    const byEnd = Object.fromEntries(g.map(x => [x.playedAt, x.result]))
    expect(byEnd).toEqual({
      1794242268000: '1-0',
      1793544444000: '0-1',
      1793540394000: '0-1',
      1793293766000: '0-1',
      1791006449000: '1-0',
      1790845181000: '1-0',
    })
  })

  it('preenche jogadores, ratings e pgn', async () => {
    const g = await fetchChesscomGames('erik', undefined, asFetch(fakeFetch))
    const x = g.find(y => y.playedAt === 1794242268000)!
    expect(x.white).toEqual({ name: '0_0_KING_0_0', rating: 1919, aiLevel: null })
    expect(x.black).toEqual({ name: 'erik', rating: 1875, aiLevel: null })
    expect(x.pgn).toContain('[Result "1-0"]')
  })

  it('ordena por playedAt decrescente mesmo com meses e jogos fora de ordem', async () => {
    const f = makeFetch({
      [ccArchivesUrl('u')]: JSON.stringify({ archives: [ccMonthUrl('u', '2026/10'), ccMonthUrl('u', '2026/11')] }),
      [ccMonthUrl('u', '2026/11')]: JSON.stringify({ games: [ccGame('n1', 500), ccGame('n2', 900), ccGame('n3', 700)] }),
      [ccMonthUrl('u', '2026/10')]: JSON.stringify({ games: [ccGame('o1', 100), ccGame('o2', 300)] }),
    })
    const g = await fetchChesscomGames('u', undefined, asFetch(f))
    expect(g.map(x => x.id)).toEqual(['n2', 'n3', 'n1', 'o2', 'o1'])
  })

  it('sem arquivos devolve lista vazia', async () => {
    const f = makeFetch({ [ccArchivesUrl('u')]: JSON.stringify({ archives: [] }) })
    expect(await fetchChesscomGames('u', undefined, asFetch(f))).toEqual([])
    expect(f.urls).toEqual([ccArchivesUrl('u')])
  })

  it.each([[404, 'user-not-found'], [429, 'rate-limited'], [500, 'network']])('HTTP %i → %s', async (status, code) => {
    await expect(fetchChesscomGames('x', undefined, statusFetch(status))).rejects.toMatchObject({ code })
  })

  it('erro vem como GameError', async () => {
    await expect(fetchChesscomGames('x', undefined, statusFetch(404))).rejects.toBeInstanceOf(GameError)
  })

  it('HTTP 429 na busca de um mês → rate-limited', async () => {
    const f = makeFetch({
      [ccArchivesUrl('u')]: JSON.stringify({ archives: [ccMonthUrl('u', '2026/10'), ccMonthUrl('u', '2026/11')] }),
      [ccMonthUrl('u', '2026/11')]: 429,
      [ccMonthUrl('u', '2026/10')]: JSON.stringify({ games: [ccGame('n', 2)] }),
    })
    await expect(fetchChesscomGames('u', undefined, asFetch(f))).rejects.toMatchObject({ code: 'rate-limited' })
  })

  it.each([[404, 'user-not-found'], [500, 'network']])(
    'HTTP %i na busca de um mês → mês pulado (%s ignorado)',
    async (status) => {
      const f = makeFetch({
        [ccArchivesUrl('u')]: JSON.stringify({ archives: [ccMonthUrl('u', '2026/10'), ccMonthUrl('u', '2026/11')] }),
        [ccMonthUrl('u', '2026/11')]: status,
        [ccMonthUrl('u', '2026/10')]: JSON.stringify({ games: [ccGame('n', 2)] }),
      })
      const g = await fetchChesscomGames('u', undefined, asFetch(f))
      expect(g.map(x => x.id)).toEqual(['n'])
    },
  )

  it('falha de rede (fetch rejeita) → network', async () => {
    await expect(fetchChesscomGames('x', undefined, rejectingFetch(new TypeError('Failed to fetch'))))
      .rejects.toMatchObject({ code: 'network' })
  })

  it('falha de rede no segundo mês → network', async () => {
    const f = makeFetch({
      [ccArchivesUrl('u')]: JSON.stringify({ archives: [ccMonthUrl('u', '2026/10'), ccMonthUrl('u', '2026/11')] }),
      [ccMonthUrl('u', '2026/11')]: JSON.stringify({ games: [ccGame('n', 2)] }),
      [ccMonthUrl('u', '2026/10')]: () => { throw new TypeError('Failed to fetch') },
    })
    await expect(fetchChesscomGames('u', undefined, asFetch(f))).rejects.toMatchObject({ code: 'network' })
  })

  it('AbortError é repassado sem virar GameError', async () => {
    const abort = new DOMException('Aborted', 'AbortError')
    await expect(fetchChesscomGames('x', undefined, rejectingFetch(abort))).rejects.toMatchObject({ name: 'AbortError' })
    await expect(fetchChesscomGames('x', undefined, rejectingFetch(abort))).rejects.not.toBeInstanceOf(GameError)
  })

  it('AbortError durante a busca de um mês também é repassado', async () => {
    const abort = new DOMException('Aborted', 'AbortError')
    const f = makeFetch({
      [ccArchivesUrl('u')]: JSON.stringify({ archives: [ccMonthUrl('u', '2026/11')] }),
      [ccMonthUrl('u', '2026/11')]: () => { throw abort },
    })
    const p = fetchChesscomGames('u', undefined, asFetch(f))
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
    await expect(fetchChesscomGames('u', undefined, asFetch(f))).rejects.not.toBeInstanceOf(GameError)
  })

  it('passa o signal ao fetch', async () => {
    const ac = new AbortController()
    const f = makeFetch({ [ccArchivesUrl('u')]: JSON.stringify({ archives: [] }) })
    await fetchChesscomGames('u', ac.signal, asFetch(f))
    expect(f.calls[0].init?.signal).toBe(ac.signal)
  })
})
