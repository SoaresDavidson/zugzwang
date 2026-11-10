# Zugzwang MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Site estático que recebe uma partida (PGN colado ou busca por username no Lichess/Chess.com), analisa com Stockfish WASM no navegador e mostra uma revisão gamificada lance a lance em pt-BR.

**Architecture:** Núcleo em TypeScript puro (`src/core/`, sem React e sem DOM) faz parsing, classificação, precisão, texto, conquistas e acesso às APIs, testado com Vitest. O motor roda num Web Worker (`src/engine/`) atrás da interface `Engine` do núcleo. A UI React (`src/ui/`) só consome o núcleo, e o IndexedDB (`src/storage/`) guarda cache, histórico e perfil.

**Tech Stack:** Vite 8, React 19, TypeScript, Vitest, `chess.js` 1.4, `chessground` 9, `stockfish` 19.0.1 (npm, builds `lite`), `idb` 8, `vite-plugin-pwa` 2, Playwright (smoke), Cloudflare Pages.

**Spec:** `SPEC.md` (raiz do repositório). Leia antes de qualquer tarefa.

## Global Constraints

- Toda string visível ao usuário em pt-BR. Textos gerados por lance (`CATEGORY_LABEL`, `explainMove`) ficam em `src/core/explain.ts`; o resto da UI em `src/ui/messages.ts`.
- SAN exibido com letras portuguesas: N→C, B→B, R→T, Q→D, K→R (`localizeSan`, Task 1).
- Nenhum asset, ícone, som ou cor copiado do chess.com. Sons sintetizados com Web Audio no MVP (provisórios, serão trocados por sons próprios depois), ícones em SVG/texto próprios.
- `src/core/` não importa React, DOM, `window`, `indexedDB` nem `Worker`. `fetch` e `crypto.subtle` são permitidos (existem no Node 24).
- Avaliações (`Score`) sempre do ponto de vista das brancas. Conversão para o ponto de vista de quem moveu só via `moverWin`, `moverCp` e `isMateFor` de `src/core/winPercent.ts`.
- Invariante de `Score`: `mate` nunca vale 0. Quem produz avaliações (`parseUciInfo`, `terminalEval`) converte posição de mate em `cp ±MATE_CP`. Todo `PositionEval` passado a `classifyMove` tem ao menos uma linha.
- Parsing de UCI só via `parseUci` (`src/core/moves.ts`); EPD só via `toEpd` (`src/core/epd.ts`); valores de peça só via `PIECE_VALUE` (`thresholds.ts`).
- Todos os limiares e versões em `src/core/thresholds.ts`. Nenhum número mágico de classificação fora dele.
- Orçamento do motor: `movetime 500`, `MultiPV 2`.
- Só xadrez padrão a partir da posição inicial.
- Nenhum recurso de terceiros em runtime além das APIs do Lichess/Chess.com e do beacon do Cloudflare Web Analytics. Fontes auto-hospedadas (`@fontsource`).
- Headers `Cross-Origin-Opener-Policy: same-origin` e `Cross-Origin-Embedder-Policy: require-corp` em todas as rotas.
- Licença GPL-3.0-or-later.
- Gerenciador de pacotes: npm.

## Review Focus

1. **PGN que termina em mate ou afogamento**: a posição final não tem lances para o motor. Esperado: nada trava, o lance de mate é classificado como "melhor" e a precisão considera vitória total. Teste em Task 8 (`analyzeGame` com Mate do Pastor).
2. **PGN "sujo"**: vários jogos colados juntos, comentários `{ [%clk 0:03:00] }`, NAGs (`$1`), variações entre parênteses, quebras de linha do Windows. Esperado: usa a linha principal do primeiro jogo. Teste em Task 2.
3. **Navegador sem `SharedArrayBuffer`** (Safari antigo, iOS, COEP quebrado por algum recurso): esperado cair para o build `lite-single` sem erro. Teste em Task 9 (`pickEngineBuild`) e verificação manual em Task 14.
4. **Usuário troca de partida no meio da análise**: esperado abortar a análise anterior, mandar `stop` ao motor e não misturar progresso de duas partidas. Teste em Task 8 (abort) e Task 11 (`useAnalysis`).
5. **Username com maiúsculas, inexistente ou API com 429**: esperado mensagem clara por caso e casamento de jogador sem diferenciar maiúsculas (conquistas não podem falhar por "Davi" vs "davi"). Testes em Task 7 e Task 10.

## Execution Waves

Ordem de execução por dependência. Cada leva roda em paralelo, uma tarefa por worktree.

| Leva | Tasks | Depende de |
|---|---|---|
| L0 | 1 | nenhuma (executada pelo agente principal, sem divisão teste/código) |
| L1 | 2, 3, 4, 5, 6 | L0 |
| L2 | 7, 8, 9, 10 | 8 depende de 2-6; 7, 9, 10 só de 1 |
| L3 | 11, 15 | 11: 2, 7, 8, 9, 10; 15: 8, 9 |
| L4 | 12 | 11 |
| L5 | 13 | 10, 12 |
| L6 | 14 | 13 |

Ciclo de cada leva:
1. Agente `sonnet` de testes por tarefa escreve só os testes da tarefa (os do plano, mais os da Review Focus atribuídos a ela). Commit com os testes falhando.
2. Agente `sonnet` de código por tarefa implementa até passar. Não altera testes.
3. Merge dos worktrees na `main` e `npm test` completo.
4. Skill `code-review` sobre o diff da leva. Nas levas L4 e L5, também `blind-reviewer`.
5. Para cada bug confirmado, o agente principal escreve um teste que o reproduz, fora do worktree do corretor.
6. Agente `sonnet` corretor recebe a descrição do bug, sem o teste. O agente principal roda o teste oculto e devolve só a mensagem de falha. Máximo de 3 voltas; depois disso o bug sobe para o modelo principal.
7. Teste oculto entra no repositório junto com a correção.

---

## File Structure

```
SPEC.md
LICENSE                          GPL-3 texto integral
README.md                        como rodar, deploy, calibração
index.html
vite.config.ts                   React + PWA + headers do dev server
vitest.config.ts
playwright.config.ts
public/_headers                  COOP/COEP para Cloudflare Pages
public/stockfish/                cópia de bin/stockfish-19-lite*.{js,wasm} (gerada por script)
scripts/copy-stockfish.mjs       postinstall: copia o motor para public/stockfish
scripts/build-openings.ts        baixa lichess-org/chess-openings e gera openings.json
scripts/calibrate.ts             roda fixtures de calibração com o motor em Node
scripts/nodeEngine.ts            Engine via processo Node + stockfish CLI
src/core/types.ts                tipos compartilhados
src/core/thresholds.ts           limiares, versões, constantes
src/core/winPercent.ts           cp→win%, moverWin
src/core/san.ts                  localizeSan
src/core/pgn.ts                  parsePgn
src/core/material.ts             materialSwing, isSacrifice
src/core/openings.ts             lookupOpening, isBookFen
src/core/data/openings.json      gerado
src/core/classify.ts             classifyMove
src/core/accuracy.ts             moveAccuracy, gameAccuracy, estimateRating
src/core/explain.ts              explainMove
src/core/uci.ts                  parseUciInfo
src/core/analyzeGame.ts          orquestração + cacheKey
src/core/retry.ts                checkRetry
src/core/sources/lichess.ts      fetchLichessGames
src/core/sources/chesscom.ts     fetchChesscomGames
src/core/achievements.ts         playerColorFor, evaluateAchievements
src/engine/stockfishEngine.ts    Engine no navegador (Worker)
src/engine/build.ts              pickEngineBuild
src/storage/db.ts                IndexedDB: análises, histórico, perfil
src/ui/messages.ts               textos pt-BR
src/ui/tokens.css                cores, tipografia, espaçamento
src/ui/App.tsx                   alterna entre entrada e revisão
src/ui/input/PgnPaste.tsx
src/ui/input/UserSearch.tsx
src/ui/review/ReviewView.tsx
src/ui/review/Board.tsx          wrapper do chessground
src/ui/review/EvalGraph.tsx      SVG próprio
src/ui/review/MoveList.tsx
src/ui/review/MoveDetail.tsx     linha de explicação + retry
src/ui/review/Summary.tsx        placar, precisão, rating aproximado
src/ui/review/CategoryBadge.tsx
src/ui/achievements/AchievementsPanel.tsx
src/ui/useAnalysis.ts
src/ui/sound.ts                  Web Audio
tests/core/*.test.ts
tests/ui/*.test.tsx
tests/fixtures/                  respostas de API, PGNs
tests/fixtures/calibration/      partidas do autor com veredito do chess.com
e2e/smoke.spec.ts
```

---

### Task 1: Scaffold, tipos e limiares

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `index.html`, `LICENSE`, `.gitignore`, `public/_headers`, `scripts/copy-stockfish.mjs`, `src/main.tsx`, `src/core/types.ts`, `src/core/thresholds.ts`, `src/core/winPercent.ts`, `src/core/san.ts`
- Test: `tests/core/winPercent.test.ts`, `tests/core/san.test.ts`

**Interfaces:**
- Produces (`src/core/types.ts`):
  ```ts
  export type Color = 'w' | 'b';
  export type Score = { kind: 'cp'; value: number } | { kind: 'mate'; value: number }; // ponto de vista das brancas; mate > 0 = brancas dão mate
  export interface EngineLine { move: string; score: Score; pv: string[] } // UCI
  export interface PositionEval { fen: string; lines: EngineLine[] }      // lines[0] = melhor
  export type MoveCategory = 'book' | 'brilliant' | 'great' | 'best' | 'excellent' | 'good'
    | 'inaccuracy' | 'mistake' | 'blunder' | 'missedMate';
  export interface Ply { index: number; color: Color; san: string; uci: string; fenBefore: string; fenAfter: string }
  export interface ParsedGame { headers: Record<string, string>; plies: Ply[] }
  export interface Opening { eco: string; name: string }
  export interface AnalyzedMove extends Ply {
    category: MoveCategory; winBefore: number; winAfter: number; // ponto de vista de quem moveu
    bestUci: string | null; bestSan: string | null; explanation: string;
  }
  export type CategoryCounts = Record<MoveCategory, number>;
  export interface GameAnalysis {
    key: string; headers: Record<string, string>; opening: Opening | null;
    moves: AnalyzedMove[]; evals: PositionEval[];
    accuracy: { w: number; b: number }; rating: { w: number; b: number };
    counts: { w: CategoryCounts; b: CategoryCounts };
  }
  export interface AnalyseOptions { movetimeMs: number; multipv: number }
  export interface Engine { analyse(fen: string, opts: AnalyseOptions, signal?: AbortSignal): Promise<PositionEval> }
  export type GameErrorCode = 'invalid-pgn' | 'variant-unsupported' | 'custom-position' | 'empty'
    | 'user-not-found' | 'rate-limited' | 'network';
  export class GameError extends Error { constructor(public code: GameErrorCode, message?: string) }
  ```
- Produces (`src/core/thresholds.ts`): `RULES_VERSION = 1`, `ENGINE_ID = 'sf19-lite-500ms-mpv2'`, `ANALYSE_OPTIONS: AnalyseOptions = { movetimeMs: 500, multipv: 2 }`, `MATE_CP = 10000`, `LOSS = { excellent: 2, good: 5, inaccuracy: 10, mistake: 20, blunder: 30 }`, `GREAT_GAP = 20`, `BRILLIANT_MAX_LOSS = 2`, `BRILLIANT_MAX_WIN_BEFORE = 90`, `SACRIFICE_MIN = 2`, `SACRIFICE_WINDOW_PLIES = 4`, `RATING = { intercept: -1000, slope: 35, min: 400, max: 3200 }`, `GOOD_OR_BETTER: MoveCategory[] = ['book','brilliant','great','best','excellent','good']`.
- Produces (`src/core/winPercent.ts`): `scoreToCp(s: Score): number`, `winPercent(cp: number): number`, `moverWin(s: Score, color: Color): number`.
- Produces (`src/core/san.ts`): `localizeSan(san: string): string`.

- [ ] **Step 1: Scaffold**

`git init`; `npm create vite@latest . -- --template react-ts`; instalar `chess.js@1.4.0 chessground@9.2.1 stockfish@19.0.1 idb@8.0.4 @fontsource-variable/inter` e dev `vitest @testing-library/react @testing-library/user-event jsdom fake-indexeddb vite-plugin-pwa@2.0.0 @playwright/test tsx`. `package.json`: `"license": "GPL-3.0-or-later"`, scripts `test` (`vitest run`), `postinstall` (`node scripts/copy-stockfish.mjs`), `build-openings` (`tsx scripts/build-openings.ts`), `calibrate` (`tsx scripts/calibrate.ts`), `e2e` (`playwright test`). `LICENSE` com o texto da GPL-3. `scripts/copy-stockfish.mjs` copia `node_modules/stockfish/bin/stockfish-19-lite{,-single}.{js,wasm}` para `public/stockfish/`; `public/stockfish/` vai no `.gitignore`. `vite.config.ts` define `server.headers` e `preview.headers` com COOP/COEP. `public/_headers`:

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

`vitest.config.ts`: `environment: 'node'` por padrão. Arquivos em `tests/ui/` que renderizam React começam com `// @vitest-environment jsdom`.

- [ ] **Step 2: Escrever os testes**

```ts
// tests/core/winPercent.test.ts
it('win% de 0 cp é 50', () => expect(winPercent(0)).toBeCloseTo(50, 5));
it('win% de +100 cp', () => expect(winPercent(100)).toBeCloseTo(59.10, 1));
it('win% de -100 cp', () => expect(winPercent(-100)).toBeCloseTo(40.90, 1));
it('mate vira MATE_CP com sinal', () => {
  expect(scoreToCp({ kind: 'mate', value: 3 })).toBe(10000);
  expect(scoreToCp({ kind: 'mate', value: -2 })).toBe(-10000);
});
it('moverWin inverte para as pretas', () => {
  expect(moverWin({ kind: 'cp', value: 100 }, 'b')).toBeCloseTo(40.90, 1);
});
// tests/core/san.test.ts
it.each([['Nxe5','Cxe5'],['Qh5','Dh5'],['Rxa1','Txa1'],['Kf1','Rf1'],['Bb5','Bb5'],
  ['O-O','O-O'],['O-O-O+','O-O-O+'],['e8=Q+','e8=D+'],['exd5','exd5']])('%s → %s', (a, b) =>
  expect(localizeSan(a)).toBe(b));
```

- [ ] **Step 3: Rodar e ver falhar** — `npx vitest run tests/core` → FAIL (módulos inexistentes).
- [ ] **Step 4: Implementar** `types.ts`, `thresholds.ts`, `winPercent.ts` (fórmula da SPEC; `scoreToCp` de mate = `sign(value) * MATE_CP`), `san.ts` (troca caractere a caractere pelo mapa, sem mexer em `O-O`).
- [ ] **Step 5: Rodar** — `npx vitest run tests/core` → PASS. `npm run build` → sucesso. `ls public/stockfish` → 4 arquivos.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "chore: scaffold, tipos do núcleo e win%"`

---

### Task 2: Parsing de PGN

**Files:**
- Create: `src/core/pgn.ts`
- Test: `tests/core/pgn.test.ts`, `tests/fixtures/pgn/*.pgn`

**Interfaces:**
- Consumes: `ParsedGame`, `Ply`, `GameError` (Task 1).
- Produces: `parsePgn(text: string): ParsedGame` em `src/core/pgn.ts`.

- [ ] **Step 1: Escrever os testes**

```ts
const SCHOLAR = '[White "a"]\n[Black "b"]\n[Result "1-0"]\n\n1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0';
it('extrai plies com FEN antes/depois e UCI', () => {
  const g = parsePgn(SCHOLAR);
  expect(g.plies).toHaveLength(7);
  expect(g.plies[0]).toMatchObject({ index: 0, color: 'w', san: 'e4', uci: 'e2e4' });
  expect(g.plies[0].fenBefore).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  expect(g.plies[6].uci).toBe('h5f7');
  expect(g.headers.White).toBe('a');
});
it('usa só o primeiro jogo de vários colados', () => {
  expect(parsePgn(SCHOLAR + '\n\n' + SCHOLAR.replace('"a"', '"c"')).headers.White).toBe('a');
});
it('ignora comentários, relógio, NAGs, variações e CRLF', () => {
  const dirty = '[Result "*"]\r\n\r\n1. e4 { [%clk 0:03:00] } e5 $1 (1... c5 2. Nf3) 2. Nf3 *';
  expect(parsePgn(dirty).plies.map(p => p.san)).toEqual(['e4', 'e5', 'Nf3']);
});
it('recusa 960', () => expectCode(() => parsePgn('[Variant "Chess960"]\n\n1. e4 *'), 'variant-unsupported'));
it('recusa posição customizada', () =>
  expectCode(() => parsePgn('[SetUp "1"]\n[FEN "8/8/8/8/8/8/8/K6k w - - 0 1"]\n\n1. Kb1 *'), 'custom-position'));
it('recusa partida sem lances', () => expectCode(() => parsePgn('[White "a"]\n\n*'), 'empty'));
it('recusa lixo', () => expectCode(() => parsePgn('isso não é pgn'), 'invalid-pgn'));
it('recusa lance ilegal', () => expectCode(() => parsePgn('1. e5 *'), 'invalid-pgn'));
```

(`expectCode` é um helper do arquivo de teste que captura e confere `err.code`.)

- [ ] **Step 2: Rodar** — `npx vitest run tests/core/pgn.test.ts` → FAIL.
- [ ] **Step 3: Implementar `parsePgn`.** Normalizar `\r\n`; separar jogos por linha em branco seguida de `[Event`/`[`-tag após movetext e pegar o primeiro; checar `Variant` (aceita ausente ou `Standard`) e `SetUp`/`FEN` antes de chamar `Chess.loadPgn`; reconstruir os plies com `history({ verbose: true })` (que traz `before`, `after`, `lan`). Qualquer exceção do chess.js vira `GameError('invalid-pgn')`.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `feat(core): parsing de PGN com recusa de variantes`

---

### Task 3: Material e sacrifício

**Files:**
- Create: `src/core/material.ts`
- Test: `tests/core/material.test.ts`

**Interfaces:**
- Consumes: `Color`, `SACRIFICE_MIN`, `SACRIFICE_WINDOW_PLIES`.
- Produces:
  - `materialSwing(fenBefore: string, uci: string, pvAfter: string[], plies = SACRIFICE_WINDOW_PLIES): number` — material de quem moveu (P1 C3 B3 T5 D9) depois de jogar `uci` e os primeiros `plies` lances de `pvAfter`, menos o material antes. Para em lance ilegal da PV.
  - `isSacrifice(fenBefore: string, uci: string, pvAfter: string[]): boolean` — `materialSwing(...) <= -SACRIFICE_MIN`.

- [ ] **Step 1: Testes**

```ts
const F = '4k3/8/4p3/8/8/8/8/3QK3 w - - 0 1';
it('dama entregue é sacrifício', () => {
  expect(materialSwing(F, 'd1d5', ['e6d5'])).toBe(-9);
  expect(isSacrifice(F, 'd1d5', ['e6d5'])).toBe(true);
});
it('lance quieto não é sacrifício', () => expect(isSacrifice(F, 'd1d2', ['e8d7'])).toBe(false));
it('troca equilibrada não é sacrifício', () =>
  expect(materialSwing('4k3/3p4/4n3/8/3N4/8/8/4K3 w - - 0 1', 'd4e6', ['d7e6'])).toBe(0));
it('respeita a janela de plies', () =>
  expect(materialSwing(F, 'd1d2', ['e8d7', 'd2d7'], 1)).toBe(0));
it('para em PV ilegal sem lançar', () => expect(materialSwing(F, 'd1d2', ['a1a2'])).toBe(0));
```

- [ ] **Step 2: Rodar** → FAIL. **Step 3:** implementar com `chess.js` (`move({from,to,promotion})` em try/catch). **Step 4:** → PASS.
- [ ] **Step 5: Commit** — `feat(core): balanço de material e detecção de sacrifício`

---

### Task 4: Livro de aberturas

**Files:**
- Create: `scripts/build-openings.ts`, `src/core/data/openings.json` (gerado e versionado), `src/core/openings.ts`
- Test: `tests/core/openings.test.ts`

**Interfaces:**
- Produces:
  - `toEpd(fen: string): string` — os 4 primeiros campos da FEN.
  - `lookupOpening(fen: string): Opening | null`.
  - `isBookFen(fen: string): boolean`.

- [ ] **Step 1: Script.** `scripts/build-openings.ts` baixa `https://raw.githubusercontent.com/lichess-org/chess-openings/master/{a,b,c,d,e}.tsv` (colunas `eco`, `name`, `pgn`), joga cada `pgn` com chess.js e grava `{ [epd]: [eco, name] }` em `src/core/data/openings.json`. Em EPD repetida, fica a entrada de linha mais longa. Rodar `npm run build-openings` e conferir que o JSON tem mais de 3000 chaves.
- [ ] **Step 2: Testes**

```ts
it('Ruy Lopez', () =>
  expect(lookupOpening('r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3'))
    .toEqual({ eco: 'C60', name: 'Ruy Lopez' }));
it('ignora contadores de lance', () =>
  expect(isBookFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')).toBe(true));
it('posição fora do livro', () => expect(lookupOpening('8/8/8/8/8/8/8/K6k w - - 0 1')).toBeNull());
```

- [ ] **Step 3:** FAIL → implementar → PASS.
- [ ] **Step 4: Commit** — `feat(core): livro de aberturas embutido`

---

### Task 5: Classificação

**Files:**
- Create: `src/core/classify.ts`
- Test: `tests/core/classify.test.ts`

**Interfaces:**
- Consumes: `moverWin`, `LOSS`, `GREAT_GAP`, `BRILLIANT_MAX_LOSS`, `BRILLIANT_MAX_WIN_BEFORE`.
- Produces:
  ```ts
  export interface ClassifyInput {
    color: Color; uci: string; before: PositionEval; after: PositionEval;
    isBook: boolean; isSacrifice: boolean;
  }
  export function moveLoss(i: ClassifyInput): number; // moverWin(before.lines[0]) - moverWin(after.lines[0]), mínimo 0
  export function classifyMove(i: ClassifyInput): MoveCategory;
  ```

Ordem das regras (primeira que casar vence):

```
1. isBook                                                         → book
2. before.lines[0] é mate a favor de quem move, after.lines[0] não é mate a favor de quem move
   e não é o mate já dado (scoreToCp do ponto de vista de quem moveu < MATE_CP) → missedMate
3. loss ≤ BRILLIANT_MAX_LOSS && isSacrifice && winBefore < BRILLIANT_MAX_WIN_BEFORE → brilliant
4. uci == before.lines[0].move && lines[1] existe
   && moverWin(lines[0]) - moverWin(lines[1]) ≥ GREAT_GAP         → great
5. uci == before.lines[0].move                                    → best
6. loss ≥ 30 blunder; ≥ 20 mistake; ≥ 10 inaccuracy; < 2 excellent; senão good
```

- [ ] **Step 1: Testes** (helper `ev(lines: [move, cp|{mate:n}][])` monta `PositionEval`; `fen` irrelevante aqui)

```ts
const base = { color: 'w' as const, isBook: false, isSacrifice: false };
it('book vence tudo', () => expect(classifyMove({ ...base, isBook: true, uci: 'a2a3',
  before: ev([['e2e4', 30]]), after: ev([['x', -800]]) })).toBe('book'));
it('best', () => expect(classifyMove({ ...base, uci: 'e2e4',
  before: ev([['e2e4', 30], ['d2d4', 25]]), after: ev([['e7e5', 30]]) })).toBe('best'));
it('great: único lance bom', () => expect(classifyMove({ ...base, uci: 'g1f3',
  before: ev([['g1f3', 0], ['e2e4', -300]]), after: ev([['x', 0]]) })).toBe('great'));
it('brilliant', () => expect(classifyMove({ ...base, isSacrifice: true, uci: 'd1d5',
  before: ev([['d1d5', 50], ['e2e4', 40]]), after: ev([['x', 50]]) })).toBe('brilliant'));
it('sem brilhante quando já ganhava fácil', () => expect(classifyMove({ ...base, isSacrifice: true, uci: 'd1d5',
  before: ev([['d1d5', 700], ['e2e4', 690]]), after: ev([['x', 700]]) })).toBe('best'));
it.each([[20, 'excellent'], [-20, 'good'], [-120, 'inaccuracy'], [-250, 'mistake'], [-800, 'blunder']])
  ('depois %i cp → %s', (cp, cat) => expect(classifyMove({ ...base, uci: 'a2a3',
    before: ev([['e2e4', 30]]), after: ev([['x', cp]]) })).toBe(cat));
it('perspectiva das pretas', () => expect(classifyMove({ ...base, color: 'b', uci: 'a7a6',
  before: ev([['e7e5', -30]]), after: ev([['x', 200]]) })).toBe('mistake'));
it('missedMate', () => expect(classifyMove({ ...base, uci: 'a2a3',
  before: ev([['d1h5', { mate: 3 }]]), after: ev([['x', 500]]) })).toBe('missedMate'));
it('mate ainda disponível não é missedMate', () => expect(classifyMove({ ...base, uci: 'd1h5',
  before: ev([['d1h5', { mate: 3 }]]), after: ev([['x', { mate: 2 }]]) })).toBe('best'));
it('dar o mate não é missedMate', () => expect(classifyMove({ ...base, uci: 'h5f7',
  before: ev([['h5f7', { mate: 1 }]]), after: ev([['', 10000]]) })).toBe('best'));
```

- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(core): classificação de lances`

---

### Task 6: Precisão, rating estimado e texto

**Files:**
- Create: `src/core/accuracy.ts`, `src/core/explain.ts`
- Test: `tests/core/accuracy.test.ts`, `tests/core/explain.test.ts`

**Interfaces:**
- Produces (`accuracy.ts`):
  - `moveAccuracy(winBefore: number, winAfter: number): number` — ponto de vista de quem moveu.
  - `gameAccuracy(whiteWins: number[]): { w: number; b: number }` — `whiteWins[i]` = win% das brancas na posição `i` (tamanho = plies + 1).
  - `estimateRating(accuracy: number): number` — `clamp(round(RATING.intercept + RATING.slope * accuracy), RATING.min, RATING.max)`.
- Produces (`explain.ts`):
  ```ts
  export interface ExplainFacts {
    category: MoveCategory; bestSan: string | null; materialDelta: number;
    allowsMateIn: number | null; missedMateIn: number | null;
  }
  export function explainMove(f: ExplainFacts): string;
  ```

Algoritmo de `moveAccuracy` e `gameAccuracy` (método do Lichess, `lila/modules/analyse/AccuracyPercent.scala`):

```
moveAccuracy(b, a) = min(100, clamp(103.1668100711649 * exp(-0.04354415386753951 * max(0, b - a)) - 3.166924740191411, 0, 100) + 1)

gameAccuracy(W):
  n = W.length - 1;  windowSize = clamp(floor(n / 10), 2, 8)
  windows = (windowSize - 2) cópias de W[0..windowSize) ++ janelas deslizantes de tamanho windowSize sobre W
  weight[i] = clamp(desvioPadrão(windows[i]), 0.5, 12)
  para cada ply i (par = brancas, ímpar = pretas):
    (antes, depois) = (W[i], W[i+1]) para brancas, (100-W[i], 100-W[i+1]) para pretas
    acc[i] = moveAccuracy(antes, depois)
  por cor: (média ponderada de acc por weight + média harmônica de acc) / 2
```

Textos de `explainMove` (montados nesta ordem, separados por espaço):
- rótulo + ".": `book` "Livro", `brilliant` "Brilhante", `great` "Ótimo", `best` "Melhor", `excellent` "Excelente", `good` "Bom", `inaccuracy` "Imprecisão", `mistake` "Erro", `blunder` "Capivarada", `missedMate` "Mate perdido". Os rótulos moram em `src/core/explain.ts` como `CATEGORY_LABEL` e são reexportados pela UI.
- `missedMateIn` → "Deixa escapar mate em N."; senão `allowsMateIn` → "Permite mate em N."; senão, se a categoria for `inaccuracy|mistake|blunder` e `materialDelta ≤ -1` → "Perde " + {1: "um peão", 2: "a qualidade", 3: "uma peça", 5: "a torre", 9: "a dama"}[-delta] ?? "material" + ".".
- `brilliant` → "Sacrifício correto."; `great` → "Único lance que mantém a avaliação."
- se `bestSan` e categoria fora de `book|brilliant|great|best` → "Melhor: " + `localizeSan(bestSan)` + ".".

- [ ] **Step 1: Testes**

```ts
it('lance perfeito ≈ 100', () => expect(moveAccuracy(50, 50)).toBeCloseTo(100, 0));
it('queda de 10 pontos', () => expect(moveAccuracy(60, 50)).toBeCloseTo(64.58, 1));
it('nunca negativo', () => expect(moveAccuracy(100, 0)).toBeGreaterThanOrEqual(0));
it('partida sem erros ≈ 100 para os dois', () => {
  const r = gameAccuracy(Array(41).fill(50));
  expect(r.w).toBeGreaterThan(99); expect(r.b).toBeGreaterThan(99);
});
it('capivarada das pretas derruba só a precisão delas', () => {
  const W = [...Array(20).fill(50), 95, ...Array(20).fill(95)];
  const r = gameAccuracy(W);
  expect(r.w).toBeGreaterThan(95); expect(r.b).toBeLessThan(r.w);
});
it('rating limitado', () => { expect(estimateRating(0)).toBe(400); expect(estimateRating(100)).toBe(2500); });

it('erro com peça perdida', () => expect(explainMove({ category: 'mistake', bestSan: 'Nxe5',
  materialDelta: -3, allowsMateIn: null, missedMateIn: null })).toBe('Erro. Perde uma peça. Melhor: Cxe5.'));
it('mate perdido', () => expect(explainMove({ category: 'missedMate', bestSan: 'Qh5',
  materialDelta: 0, allowsMateIn: null, missedMateIn: 3 })).toBe('Mate perdido. Deixa escapar mate em 3. Melhor: Dh5.'));
it('permite mate', () => expect(explainMove({ category: 'blunder', bestSan: 'g3',
  materialDelta: 0, allowsMateIn: 2, missedMateIn: null })).toBe('Capivarada. Permite mate em 2. Melhor: g3.'));
it('brilhante', () => expect(explainMove({ category: 'brilliant', bestSan: null,
  materialDelta: -9, allowsMateIn: null, missedMateIn: null })).toBe('Brilhante. Sacrifício correto.'));
it('melhor sem sugestão', () => expect(explainMove({ category: 'best', bestSan: 'e4',
  materialDelta: 0, allowsMateIn: null, missedMateIn: null })).toBe('Melhor.'));
```

- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(core): precisão, rating estimado e texto por lance`

---

### Task 7: APIs do Lichess e Chess.com

**Files:**
- Create: `src/core/sources/types.ts`, `src/core/sources/lichess.ts`, `src/core/sources/chesscom.ts`
- Test: `tests/core/sources.test.ts`, `tests/fixtures/api/lichess.ndjson`, `tests/fixtures/api/chesscom-archives.json`, `tests/fixtures/api/chesscom-2026-10.json`, `tests/fixtures/api/chesscom-2026-11.json`

**Interfaces:**
- Consumes: `GameError`.
- Produces:
  ```ts
  export type Source = 'lichess' | 'chesscom';
  export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'classical';
  export interface GameSummary {
    id: string; source: Source; url: string;
    white: { name: string; rating: number | null }; black: { name: string; rating: number | null };
    result: '1-0' | '0-1' | '1/2-1/2' | '*'; timeClass: TimeClass; playedAt: number; pgn: string;
  }
  export function fetchLichessGames(username: string, signal?: AbortSignal, fetchFn = fetch): Promise<GameSummary[]>;
  export function fetchChesscomGames(username: string, signal?: AbortSignal, fetchFn = fetch): Promise<GameSummary[]>;
  ```

Regras:
- Lichess: `GET https://lichess.org/api/games/user/{username}?max=50&pgnInJson=true&perfType=ultraBullet,bullet,blitz,rapid,classical,correspondence`, header `Accept: application/x-ndjson`. Filtra `variant === 'standard'`. `speed`: `ultraBullet→bullet`, `correspondence→classical`. `playedAt = createdAt`. `url = https://lichess.org/{id}`.
- Chess.com: `GET https://api.chess.com/pub/player/{username.toLowerCase()}/games/archives`, depois os meses do mais recente para o mais antigo até juntar 50. Filtra `rules === 'chess'` e PGN sem `[SetUp "1"]`. `time_class`: `daily→classical`. `playedAt = end_time * 1000`. `id = uuid`.
- `result` vem do header `[Result "..."]` do PGN nas duas fontes.
- Saída ordenada por `playedAt` decrescente, no máximo 50.
- HTTP 404 → `GameError('user-not-found')`; 429 → `'rate-limited'`; falha de rede ou outro status → `'network'`. `AbortError` é repassado sem conversão.

- [ ] **Step 1: Fixtures.** Gravar respostas reais pequenas (3-4 partidas cada, incluindo uma `chess960`/`fromPosition` e uma `daily`/`correspondence`) com `curl`, e editar à mão para o tamanho mínimo.
- [ ] **Step 2: Testes** (`fetchFn` falso que serve as fixtures por URL)

```ts
it('lichess: filtra variantes e normaliza ritmo', async () => {
  const g = await fetchLichessGames('Davi', undefined, fakeFetch);
  expect(g.every(x => x.source === 'lichess')).toBe(true);
  expect(g.some(x => x.pgn.includes('Chess960'))).toBe(false);
  expect(g.map(x => x.timeClass)).not.toContain('correspondence');
});
it('chess.com: usa username minúsculo e junta meses do mais recente', async () => {
  const g = await fetchChesscomGames('Davi', undefined, fakeFetch);
  expect(fakeFetch.urls[0]).toBe('https://api.chess.com/pub/player/davi/games/archives');
  expect(g[0].playedAt).toBeGreaterThan(g.at(-1)!.playedAt);
});
it.each([[404, 'user-not-found'], [429, 'rate-limited'], [500, 'network']])('HTTP %i → %s', async (status, code) => {
  await expect(fetchLichessGames('x', undefined, statusFetch(status))).rejects.toMatchObject({ code });
});
```

- [ ] **Step 3:** FAIL → implementar → PASS.
- [ ] **Step 4: Commit** — `feat(core): busca de partidas no Lichess e Chess.com`

---

### Task 8: Orquestração da análise, cache key e retry

**Files:**
- Create: `src/core/analyzeGame.ts`, `src/core/retry.ts`
- Test: `tests/core/analyzeGame.test.ts`, `tests/core/retry.test.ts`

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces (`analyzeGame.ts`):
  ```ts
  export interface AnalysisProgress { evaluated: number; total: number; moves: AnalyzedMove[] }
  export function cacheKey(game: ParsedGame): Promise<string>; // sha256 hex de `${ENGINE_ID}|${RULES_VERSION}|${ucis.join(' ')}`
  export function terminalEval(fen: string): PositionEval | null; // mate: cp ±MATE_CP contra quem está em mate; afogamento/material insuficiente: cp 0
  export function analyzeGame(game: ParsedGame, engine: Engine,
    onProgress?: (p: AnalysisProgress) => void, signal?: AbortSignal): Promise<GameAnalysis>;
  ```
- Produces (`retry.ts`):
  ```ts
  export function checkRetry(before: PositionEval, fenBefore: string, uci: string, color: Color,
    engine: Engine, signal?: AbortSignal): Promise<{ category: MoveCategory; accepted: boolean }>;
  ```

`analyzeGame` avalia as `plies.length + 1` posições em sequência com `ANALYSE_OPTIONS` (ou `terminalEval` quando aplicável, sem chamar o motor). Depois de cada posição `i+1`, classifica o ply `i` e chama `onProgress`. `isBook` do ply `i` = `isBookFen(fenAfter)` e todos os plies anteriores foram `book`. `isSacrifice` e `materialDelta` usam `after.lines[0]?.pv ?? []`. `bestSan` vem de converter `before.lines[0].move` com chess.js. `allowsMateIn` = valor absoluto do mate em `after.lines[0]` quando ele é contra quem moveu. `opening` = `lookupOpening` do último ply `book`. Checa `signal.aborted` entre posições e lança `DOMException('Aborted', 'AbortError')`.

`checkRetry` analisa a posição depois do lance novo e classifica com `isBook: false`; `accepted = GOOD_OR_BETTER.includes(category)`.

- [ ] **Step 1: Testes**

```ts
// analyzeGame.test.ts — FakeEngine devolve avaliações roteirizadas por FEN e conta chamadas
it('Mate do Pastor: termina sem chamar o motor na posição final', async () => {
  const fake = scriptedEngine(SCHOLAR_EVALS); // 7 posições (0..6), a 8ª é mate
  const a = await analyzeGame(parsePgn(SCHOLAR), fake);
  expect(fake.calls).toBe(7);
  expect(a.moves[6].category).toBe('best');
  expect(a.moves[5].category).toBe('blunder');      // 3...Nf6?? permite Dxf7#
  expect(a.moves[5].explanation).toContain('Permite mate em 1.');
  expect(a.moves[0].category).toBe('book');
  expect(a.opening?.eco).toBeDefined();
});
it('progresso cresce de 1 em 1 até o total', async () => {
  const seen: number[] = [];
  await analyzeGame(parsePgn(SCHOLAR), scriptedEngine(SCHOLAR_EVALS), p => seen.push(p.evaluated));
  expect(seen).toEqual([2, 3, 4, 5, 6, 7, 8]);
});
it('abort interrompe', async () => {
  const ac = new AbortController();
  const p = analyzeGame(parsePgn(SCHOLAR), scriptedEngine(SCHOLAR_EVALS, { onCall: n => n === 2 && ac.abort() }),
    undefined, ac.signal);
  await expect(p).rejects.toMatchObject({ name: 'AbortError' });
});
it('cacheKey estável e sensível aos lances', async () => {
  expect(await cacheKey(parsePgn(SCHOLAR))).toBe(await cacheKey(parsePgn(SCHOLAR.replace('"a"', '"z"'))));
  expect(await cacheKey(parsePgn(SCHOLAR))).not.toBe(await cacheKey(parsePgn('1. d4 *')));
});

// retry.test.ts
it('aceita lance bom e recusa ruim', async () => { /* before: e2e4 30; engine devolve 25 para d2d4 e -800 para a2a3 */ });
```

`SCHOLAR_EVALS` fica em `tests/fixtures/scholarEvals.ts`, com avaliações plausíveis: posições 0-5 por volta de +30, posição 5 (antes de 3...Nf6) com `lines[0]` = `g7g6` e cp +40, posição 6 com `lines[0]` = `h5f7` e `mate 1`.

- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(core): orquestração da análise, cache key e retry`

---

### Task 9: Motor no navegador

**Files:**
- Create: `src/core/uci.ts`, `src/engine/build.ts`, `src/engine/stockfishEngine.ts`
- Test: `tests/core/uci.test.ts`, `tests/engine/build.test.ts`

**Interfaces:**
- Consumes: `Engine`, `AnalyseOptions`, `Score`, `Color`.
- Produces (`uci.ts`):
  - `parseUciInfo(line: string, sideToMove: Color): { multipv: number; depth: number; score: Score; pv: string[] } | null` — `null` para linhas sem `score` ou sem `pv`. Converte para o ponto de vista das brancas.
- Produces (`src/engine/`):
  - `pickEngineBuild(env: { crossOriginIsolated: boolean; hardwareConcurrency: number }): { url: string; threads: number }` — isolado: `/stockfish/stockfish-19-lite.js`, `threads = clamp(hardwareConcurrency - 1, 1, 4)`; senão `/stockfish/stockfish-19-lite-single.js`, `threads = 1`.
  - `class StockfishEngine implements Engine { static create(): Promise<StockfishEngine>; analyse(...); terminate(): void }` e `getEngine(): Promise<StockfishEngine>` (singleton por aba).

`create` abre o `Worker`, manda `uci`, `setoption name Threads value N`, `setoption name Hash value 32`, `isready` e espera `readyok`. `analyse` serializa as chamadas numa fila, manda `setoption name MultiPV value N`, `position fen F`, `go movetime T` e guarda a última linha `info` de cada `multipv` até `bestmove`. Abort manda `stop` e rejeita com `AbortError` depois do `bestmove` correspondente. Falha ao carregar o worker vira `Error('engine-failed')`.

- [ ] **Step 1: Testes**

```ts
// tests/core/uci.test.ts
it('converte score das pretas para o ponto de vista das brancas', () =>
  expect(parseUciInfo('info depth 12 multipv 1 score cp 35 nodes 1 pv e7e5 g1f3', 'b'))
    .toEqual({ multipv: 1, depth: 12, score: { kind: 'cp', value: -35 }, pv: ['e7e5', 'g1f3'] }));
it('mate', () => expect(parseUciInfo('info depth 5 multipv 2 score mate -2 pv a1a2', 'w')!.score)
  .toEqual({ kind: 'mate', value: -2 }));
it('ignora linha sem pv', () => expect(parseUciInfo('info depth 1 currmove e2e4', 'w')).toBeNull());
it('mate 0 vira cp contra quem está em mate', () =>
  expect(parseUciInfo('info depth 1 multipv 1 score mate 0 pv a1a1', 'b')!.score).toEqual({ kind: 'cp', value: 10000 }));

// tests/engine/build.test.ts
it('com isolamento usa multi-thread', () =>
  expect(pickEngineBuild({ crossOriginIsolated: true, hardwareConcurrency: 8 }))
    .toEqual({ url: '/stockfish/stockfish-19-lite.js', threads: 4 }));
it('sem SharedArrayBuffer cai para single', () =>
  expect(pickEngineBuild({ crossOriginIsolated: false, hardwareConcurrency: 8 }))
    .toEqual({ url: '/stockfish/stockfish-19-lite-single.js', threads: 1 }));
```

- [ ] **Step 2:** FAIL → implementar `uci.ts` e `build.ts` → PASS.
- [ ] **Step 3: Implementar `StockfishEngine`.** O comportamento real é verificado no smoke da Task 14.
- [ ] **Step 4: Verificação manual.** `npm run dev`, abrir o console do navegador e rodar `(await (await import('/src/engine/stockfishEngine.ts')).getEngine()).analyse('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', {movetimeMs: 500, multipv: 2})`. Esperado: 2 linhas, `crossOriginIsolated === true`.
- [ ] **Step 5: Commit** — `feat(engine): Stockfish WASM em Web Worker`

---

### Task 10: Persistência e conquistas

**Files:**
- Create: `src/storage/db.ts`, `src/core/achievements.ts`
- Test: `tests/core/achievements.test.ts`, `tests/ui/db.test.ts` (usa `fake-indexeddb/auto`)

**Interfaces:**
- Produces (`achievements.ts`):
  ```ts
  export interface Profile { lichess?: string; chesscom?: string }
  export interface HistoryEntry {
    key: string; analyzedAt: number; playedAt: number | null; playerColor: Color;
    counts: CategoryCounts; accuracy: number; ownMoves: number;
  }
  export interface Achievement { id: string; title: string; description: string; unlocked: boolean; unlockedAt: number | null }
  export function playerColorFor(headers: Record<string, string>, profile: Profile): Color | null; // compara sem diferenciar maiúsculas
  export function evaluateAchievements(history: HistoryEntry[], now: number): Achievement[];
  ```
- Produces (`db.ts`): `getCachedAnalysis(key): Promise<GameAnalysis | undefined>`, `putAnalysis(a: GameAnalysis): Promise<void>`, `putHistory(e: HistoryEntry): Promise<void>` (chave `key`, então reanalisar não duplica), `listHistory(): Promise<HistoryEntry[]>`, `getProfile(): Promise<Profile>`, `setProfile(p: Profile): Promise<void>`. Banco `zugzwang`, versão 1, stores `analyses`, `history`, `profile`.

Conquistas fixas (`unlockedAt` = `analyzedAt` da entrada que completou a condição; histórico avaliado em ordem de `analyzedAt`):

| id | título | condição |
|---|---|---|
| `primeira-revisao` | Primeira revisão | 1 entrada |
| `dez-revisoes` | Dez revisões | 10 entradas |
| `primeiro-brilhante` | Primeiro brilhante | soma de `brilliant` ≥ 1 |
| `cinco-brilhantes-mes` | Mês brilhante | ≥ 5 `brilliant` em entradas do mesmo mês civil de `now` |
| `precisao-90` | Precisão cirúrgica | alguma `accuracy` ≥ 90 |
| `sem-capivarada` | Partida limpa | alguma entrada com `ownMoves` ≥ 20, `blunder` 0 e `missedMate` 0 |
| `sequencia-3` | Em sequência | 3 entradas seguidas (ordem de `playedAt ?? analyzedAt`) com `accuracy` ≥ 80 |

- [ ] **Step 1: Testes**

```ts
it('casa jogador sem diferenciar maiúsculas', () =>
  expect(playerColorFor({ White: 'DaviS', Black: 'x' }, { lichess: 'davis' })).toBe('w'));
it('partida alheia não conta', () => expect(playerColorFor({ White: 'a', Black: 'b' }, { lichess: 'davis' })).toBeNull());
it('cinco brilhantes no mês corrente', () => {
  const now = Date.UTC(2026, 10, 20);
  const h = [entry({ analyzedAt: Date.UTC(2026, 10, 1), brilliant: 3 }), entry({ analyzedAt: Date.UTC(2026, 10, 15), brilliant: 2 })];
  expect(find(evaluateAchievements(h, now), 'cinco-brilhantes-mes').unlocked).toBe(true);
  expect(find(evaluateAchievements(h, Date.UTC(2026, 11, 1)), 'cinco-brilhantes-mes').unlocked).toBe(false);
});
it('sequência quebrada não conta', () => { /* acc 85, 70, 85, 85 → false; 85, 85, 85 → true */ });
// db.test.ts
it('putHistory com a mesma key substitui', async () => {
  await putHistory(e1); await putHistory({ ...e1, accuracy: 10 });
  expect(await listHistory()).toHaveLength(1);
});
```

- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3: Commit** — `feat: persistência local e conquistas`

---

### Task 11: UI de entrada e hook de análise

Use a skill `frontend-design:frontend-design` antes de escrever CSS. Direção: identidade própria, tema claro/escuro pelo sistema, tokens em `src/ui/tokens.css`, contraste mínimo 4.5:1 em texto.

**Files:**
- Create: `src/ui/messages.ts`, `src/ui/tokens.css`, `src/ui/App.tsx`, `src/ui/input/PgnPaste.tsx`, `src/ui/input/UserSearch.tsx`, `src/ui/useAnalysis.ts`
- Modify: `src/main.tsx`
- Test: `tests/ui/UserSearch.test.tsx`, `tests/ui/useAnalysis.test.tsx`

**Interfaces:**
- Consumes: `parsePgn`, `GameError`, `fetchLichessGames`, `fetchChesscomGames`, `analyzeGame`, `cacheKey`, `getEngine`, storage e `playerColorFor`.
- Produces:
  - `messages.ts`: `ERROR_MESSAGE: Record<GameErrorCode | 'engine-failed', (source?: string) => string>` com os textos abaixo, e os rótulos da UI.
  - `useAnalysis(game: ParsedGame | null, engineFactory = getEngine): { status: 'idle' | 'running' | 'done' | 'error'; progress: AnalysisProgress | null; analysis: GameAnalysis | null; error: string | null; fromCache: boolean }`. Procura no cache, senão analisa; no fim grava `putAnalysis` e, se `playerColorFor` retornar cor, grava `putHistory`. Aborta a análise anterior quando `game` muda ou o componente desmonta.
  - `App` mantém `game: ParsedGame | null` e alterna entre entrada e `ReviewView`.

Textos de erro (exatos):
- `invalid-pgn`: "Não consegui ler esse PGN. Confira se colou a partida inteira."
- `variant-unsupported`: "Por enquanto só analiso xadrez padrão. Xadrez 960 e outras variantes ficam de fora."
- `custom-position`: "Essa partida começa de uma posição personalizada. Por enquanto só analiso partidas a partir da posição inicial."
- `empty`: "Essa partida não tem lances."
- `user-not-found`: "Não achei esse usuário no {fonte}."
- `rate-limited`: "O {fonte} pediu uma pausa. Tente de novo em um minuto."
- `network`: "Falha de conexão com o {fonte}."
- `engine-failed`: "O motor de análise não carregou neste navegador."

`{fonte}` = "Lichess" ou "Chess.com".

Tela de entrada: duas abas, "Colar PGN" e "Buscar partidas". A busca tem seletor Lichess/Chess.com, campo de username e botão "Buscar"; a lista mostra jogadores, ratings, resultado, ritmo e data, com filtros "Todas", "Bullet", "Blitz", "Rápida", "Clássica". Uma busca bem-sucedida grava o username em `setProfile`.

- [ ] **Step 1: Testes**

```ts
it('filtro de ritmo esconde as outras partidas', async () => {
  render(<UserSearch fetchers={{ lichess: async () => [blitz, rapid] }} onPick={vi.fn()} />);
  await user.type(screen.getByLabelText('Usuário'), 'davi'); await user.click(screen.getByText('Buscar'));
  await user.click(screen.getByRole('button', { name: 'Blitz' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
});
it('mostra mensagem de usuário inexistente', async () => { /* fetcher rejeita GameError('user-not-found') → texto "Não achei esse usuário no Lichess." */ });
it('useAnalysis: troca de partida aborta a anterior', async () => { /* engine lento; rerender com outro game; analysis final pertence ao segundo */ });
it('useAnalysis: usa o cache sem chamar o motor', async () => { /* putAnalysis antes; engineFactory não é chamada; fromCache true */ });
```

`UserSearch` recebe `fetchers` por prop, com padrão nas funções reais, para permitir o teste.

- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3: Commit** — `feat(ui): entrada por PGN e busca por usuário`

---

### Task 12: Tela de revisão

**Files:**
- Create: `src/ui/review/ReviewView.tsx`, `Board.tsx`, `EvalGraph.tsx`, `MoveList.tsx`, `MoveDetail.tsx`, `Summary.tsx`, `CategoryBadge.tsx`
- Test: `tests/ui/EvalGraph.test.tsx`, `tests/ui/MoveDetail.test.tsx`

**Interfaces:**
- Consumes: `useAnalysis`, `checkRetry`, `getEngine`, `CATEGORY_LABEL`, `localizeSan`.
- Produces:
  - `CategoryBadge({ category })`: glifo + cor do token `--cat-{category}`. Glifos: book "≡", brilliant "!!", great "!", best "★", excellent "✓✓", good "✓", inaccuracy "?!", mistake "?", blunder "??", missedMate "#". `aria-label` = rótulo pt-BR.
  - `Board({ fen, lastMove, arrow, movable, onMove })` sobre `chessground`. `arrow` = `[from, to] | null` desenhado com `autoShapes`. `movable` = cor que pode mover (modo retry) ou `null`.
  - `EvalGraph({ whiteWins: number[], categories: (MoveCategory | null)[], selected: number, onSelect(ply: number) })`: SVG, eixo x = ply, eixo y = win% das brancas (0-100), área das brancas preenchida, marcadores em `brilliant|great|mistake|blunder|missedMate`.
  - `ReviewView({ game, onBack })`.

Comportamento:
- Durante a análise: barra "Analisando X de Y", gráfico e lista se preenchendo com `progress.moves`.
- Navegação: clique na lista ou no gráfico, setas ← → do teclado, botões início/fim.
- Ply selecionado: tabuleiro em `fenAfter`, seta do melhor lance da posição `fenBefore` quando o jogado não for o melhor, badge + `explanation` em `MoveDetail`.
- Retry: em `inaccuracy|mistake|blunder|missedMate`, botão "Tentar de novo" põe o tabuleiro em `fenBefore` com a cor certa móvel. Lance feito chama `checkRetry`. Aceito: "Boa! {Rótulo}." e som da categoria. Recusado: "Ainda não. Tente outro lance." com botões "Tentar de novo" e "Mostrar melhor".

- [ ] **Step 1: Testes**

```ts
it('clicar num ponto seleciona o ply', async () => {
  const onSelect = vi.fn();
  render(<EvalGraph whiteWins={[50, 55, 40]} categories={[null, 'blunder']} selected={0} onSelect={onSelect} />);
  await user.click(screen.getByTestId('ply-1'));
  expect(onSelect).toHaveBeenCalledWith(1);
});
it('retry recusado mostra opção de ver o melhor', async () => {
  const StubBoard = ({ onMove }: BoardProps) => <button onClick={() => onMove?.('d2d4')}>jogar d2d4</button>;
  render(<MoveDetail move={blunderMove} BoardComponent={StubBoard}
    retry={async () => ({ category: 'mistake', accepted: false })} />);
  await user.click(screen.getByText('Tentar de novo'));
  await user.click(screen.getByText('jogar d2d4'));
  expect(await screen.findByText('Ainda não. Tente outro lance.')).toBeVisible();
  expect(screen.getByText('Mostrar melhor')).toBeVisible();
});
```

`MoveDetail` recebe `BoardComponent` (padrão `Board`) e `retry` (padrão `checkRetry` com `getEngine`) por prop, para o teste não depender do `chessground` no jsdom. `BoardProps` é exportado por `Board.tsx`.

- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3: Verificação manual.** `npm run dev`, colar o Mate do Pastor, conferir navegação por teclado, seta, retry em 3...Nf6.
- [ ] **Step 4: Commit** — `feat(ui): tela de revisão com tabuleiro, gráfico e retry`

---

### Task 13: Gamificação

**Files:**
- Create: `src/ui/sound.ts`, `src/ui/achievements/AchievementsPanel.tsx`
- Modify: `src/ui/review/Summary.tsx`, `src/ui/review/ReviewView.tsx`, `src/ui/App.tsx`
- Test: `tests/ui/Summary.test.tsx`, `tests/ui/sound.test.ts`

**Interfaces:**
- Consumes: `GameAnalysis`, `evaluateAchievements`, `listHistory`.
- Produces:
  - `playCategory(category: MoveCategory): void` e `setMuted(m: boolean)`, `isMuted(): boolean` (persistido em `localStorage` com try/catch). Sons sintetizados com Web Audio. Só tocam `brilliant`, `great`, `best`, `mistake`, `blunder`, `missedMate`. Cria o `AudioContext` só depois de um gesto do usuário. Os sons sintetizados são provisórios (SPEC, "Fora do MVP"): escreva `sound.ts` de modo que trocar a síntese por arquivos de áudio depois mude só o corpo de `playCategory`.
  - `Summary({ analysis, animate: boolean })`: por cor, precisão (uma casa decimal), "Rating da partida ≈ {n}" com nota "estimativa aproximada", e contagem por categoria com `CategoryBadge`.
  - `AchievementsPanel()`: lê o histórico, mostra as 7 conquistas com estado travado/destravado. Acessível pela tela inicial e pelo fim da revisão.

Revelação: quando a análise termina (ou vem do cache), `Summary` com `animate` conta de 0 até o valor em 1200 ms; depois os lances `brilliant` e `great` aparecem um a um a cada 150 ms com o som da categoria. Com `prefers-reduced-motion: reduce`, mostra os valores finais direto e sem som automático. Uma conquista destravada por esta partida aparece num aviso no fim da revelação.

- [ ] **Step 1: Testes**

```ts
it('sem animação mostra valores finais', () => {
  render(<Summary analysis={fixtureAnalysis} animate={false} />);
  expect(screen.getByText('87,4')).toBeVisible();          // precisão formatada pt-BR
  expect(screen.getByText(/Rating da partida ≈ 2059/)).toBeVisible();
});
it('categorias silenciosas não tocam', () => {
  const ctx = mockAudioContext(); playCategory('good'); expect(ctx.createOscillator).not.toHaveBeenCalled();
});
it('mudo não toca', () => { setMuted(true); const ctx = mockAudioContext(); playCategory('brilliant');
  expect(ctx.createOscillator).not.toHaveBeenCalled(); });
```

(`fixtureAnalysis` tem `accuracy.w = 87.4`; `estimateRating(87.4)` = 2059.)

- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3: Commit** — `feat(ui): revelação animada, sons e conquistas`

---

### Task 14: PWA, deploy e smoke

**Files:**
- Modify: `vite.config.ts`, `index.html`, `README.md`
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`, `public/icon-192.png`, `public/icon-512.png`

**Interfaces:** nenhuma nova.

- `vite-plugin-pwa` com `registerType: 'autoUpdate'`, manifesto (`name: 'Zugzwang'`, `lang: 'pt-BR'`), precache do app sem `stockfish/**`, `runtimeCaching` `CacheFirst` para `/stockfish/`.
- Cloudflare Web Analytics: `<script defer crossorigin="anonymous" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"%VITE_CF_BEACON_TOKEN%"}'>`, só incluído quando `VITE_CF_BEACON_TOKEN` existir (plugin de `transformIndexHtml`).
- README: rodar local, `npm test`, `npm run e2e`, deploy (`npx wrangler pages deploy dist`), calibração (Task 15), licença.

- [ ] **Step 1: Smoke**

```ts
test('analisa o Mate do Pastor no navegador real', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  await page.getByRole('tab', { name: 'Colar PGN' }).click();
  await page.getByRole('textbox').fill('1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0');
  await page.getByRole('button', { name: 'Analisar' }).click();
  await expect(page.getByText(/Rating da partida/).first()).toBeVisible({ timeout: 30_000 });
  await page.getByText('Nf6').or(page.getByText('Cf6')).first().click();
  await expect(page.getByText(/Capivarada/)).toBeVisible();
});
```

`playwright.config.ts` usa `webServer: { command: 'npm run build && npm run preview', port: 4173 }`.

- [ ] **Step 2: Rodar** — `npx playwright install chromium && npm run e2e` → PASS.
- [ ] **Step 3: Fallback single-thread.** Rodar o smoke com um projeto Playwright extra que sobe o preview sem COOP/COEP (variável `NO_COI=1` lida no `vite.config.ts`). Esperado: PASS com `crossOriginIsolated === false`.
- [ ] **Step 4: Deploy de teste.** `npx wrangler pages deploy dist --project-name zugzwang`. Na URL publicada, conferir no DevTools: headers COOP/COEP presentes, `crossOriginIsolated === true`, beacon do analytics sem erro de CORP. Se o beacon for bloqueado pelo COEP, remover o script e ativar o Web Analytics pelo painel do Pages, que injeta pelo próprio edge; registrar no README qual opção ficou.
- [ ] **Step 5: Commit** — `feat: PWA, analytics, smoke e deploy`

---

### Task 15: Calibração

**Files:**
- Create: `scripts/nodeEngine.ts`, `scripts/calibrate.ts`, `tests/fixtures/calibration/README.md`
- Test: execução do script sobre uma fixture de exemplo

**Interfaces:**
- Consumes: `Engine`, `parseUciInfo`, `parsePgn`, `analyzeGame`.
- Produces:
  - `createNodeEngine(): Promise<Engine & { quit(): void }>` — processo `node node_modules/stockfish/bin/stockfish-19-lite-single.js`, UCI em stdin/stdout. Antes de implementar, confirmar com `echo -e "uci\nisready\nquit" | node node_modules/stockfish/bin/stockfish-19-lite-single.js` que imprime `uciok` e `readyok`; se não imprimir, usar `node_modules/stockfish/scripts/cli.js`.
  - Formato da fixture `tests/fixtures/calibration/<nome>.json`: `{ "pgn": string, "expected": (MoveCategory | null)[] }`, um item por ply, `null` quando o print não mostra.
  - `npm run calibrate` imprime, por categoria, quantas vezes o chess.com marcou, quantas o Zugzwang concordou (recall) e quantas o Zugzwang marcou sem o chess.com concordar (precisão), e a concordância geral.

- [ ] **Step 1:** criar uma fixture de exemplo a partir do Mate do Pastor, com `expected` preenchido à mão.
- [ ] **Step 2:** implementar e rodar `npm run calibrate` → tabela impressa, concordância geral > 0.
- [ ] **Step 3:** `tests/fixtures/calibration/README.md` explica como transcrever um print do Game Review para a fixture.
- [ ] **Step 4: Commit** — `feat: harness de calibração das classificações`

Ajustar os limiares em `thresholds.ts` com as 20 partidas do autor fica fora deste plano, porque depende dos prints. Cada ajuste sobe `RULES_VERSION`, o que invalida o cache.
