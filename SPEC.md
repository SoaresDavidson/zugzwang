# Zugzwang: especificação do MVP

Zugzwang recebe uma partida de xadrez e devolve uma revisão lance a lance, no estilo do Game Review do chess.com, com identidade visual própria. A análise roda no navegador do usuário com Stockfish compilado para WASM. O MVP é um site estático, sem backend.

## Produto

- Público aberto, com intenção de crescer. Sem monetização no MVP. O plano futuro é freemium, com as partes pagas (histórico em conta, relatórios agregados, análise no servidor) num backend fechado.
- Licença GPL-3, repositório público no GitHub. A licença é obrigatória porque o site distribui o Stockfish (GPL-3) e o `chessground` (GPL-3) ao navegador.
- Interface só em pt-BR.
- Web responsiva, instalável como PWA.
- Identidade visual própria: ícones desenhados para o projeto, sons com licença CC0, paleta própria. Nenhum asset, ícone ou som do chess.com. Os nomes genéricos de categoria ("brilhante", "erro") são livres.

## Entrada da partida

1. **PGN colado** num campo de texto.
2. **Busca por username** no Lichess ou no Chess.com:
   - lista as últimas 50 partidas, com filtro por ritmo (bullet, blitz, rápida, clássica);
   - Lichess: `GET https://lichess.org/api/games/user/{username}` (NDJSON, com `pgnInJson=true`);
   - Chess.com: `GET https://api.chess.com/pub/player/{username}/games/archives`, seguido dos arquivos mensais mais recentes até juntar 50 partidas;
   - as duas APIs respondem com `access-control-allow-origin: *`, então o navegador chama direto.
3. Só xadrez padrão. Partidas de xadrez 960 ou com posição inicial customizada (tag `SetUp`/`FEN`) são recusadas com mensagem explicando o motivo.

## Análise

- Stockfish WASM (build *lite*, multi-thread quando o navegador permitir) num Web Worker.
- Orçamento de ~0,5 s por posição, com profundidade adaptativa. MultiPV 2, porque as regras de "ótimo" e "brilhante" precisam do segundo melhor lance.
- O resultado aparece aos poucos: gráfico, classificações e precisão se preenchem enquanto a análise avança.
- Sempre analisa localmente. Avaliações já existentes no Lichess (`evals=true`) não são usadas no MVP.
- Livro de aberturas embutido, a partir da base `lichess-org/chess-openings` (domínio público). Serve para o nome da abertura e para a categoria "livro".
- Multi-thread exige `SharedArrayBuffer`, que exige os headers `Cross-Origin-Opener-Policy: same-origin` e `Cross-Origin-Embedder-Policy: require-corp`. Sem eles, o worker cai para single-thread.

## Classificação dos lances

A avaliação em centipeões vira chance de vitória do ponto de vista de quem jogou:

```
win% = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
```

Mate é convertido para um cp grande antes da fórmula. A perda do lance é `win%_antes - win%_depois`, do ponto de vista de quem moveu.

| Categoria | Regra inicial |
|---|---|
| Livro | posição resultante está na base de aberturas |
| Brilhante | lance é o melhor ou quase o melhor, sacrifica material, e o jogador não estava já ganhando com folga antes do lance |
| Ótimo | lance é o melhor e o segundo melhor perde muito mais win% (único lance bom) |
| Melhor | igual ao primeiro lance do motor |
| Excelente | perda < 2 |
| Bom | perda < 5 |
| Imprecisão | perda ≥ 10 |
| Erro | perda ≥ 20 |
| Capivarada | perda ≥ 30 |
| Mate perdido | havia mate forçado antes do lance e deixou de haver |

A faixa entre 5 e 10 fica como "bom" até a calibração dizer o contrário. Todos os limiares ficam como constantes num único módulo.

### Calibração

O autor separa ~20 partidas próprias que já passaram pelo Game Review do chess.com e guarda prints da classificação. Cada uma vira uma fixture (PGN + classificação esperada por lance). O teste mede a taxa de concordância por categoria, não exige igualdade exata, e serve para ajustar os limiares.

## Precisão e rating estimado

- Precisão por jogador no método do Lichess: cada lance recebe uma nota a partir da queda de win%, e a precisão da partida combina média harmônica e média ponderada por volatilidade.
- Rating estimado da partida: regressão simples sobre a precisão. A interface mostra o número como aproximado.

## O que a revisão mostra

1. Classificação de cada lance, com ícone e cor próprios.
2. Precisão de cada jogador.
3. Gráfico de avaliação ao longo da partida, clicável para pular ao lance.
4. Tabuleiro navegável (`chessground`), com seta indicando o melhor lance do motor na posição.
5. Uma linha de texto por lance selecionado, gerada por template a partir dos fatos calculados pelo motor. Exemplo: "Erro. Perde o cavalo. Melhor: Cxe5." Fatos de partida: material ganho ou perdido na linha principal, peça pendurada, mate permitido ou perdido, melhor lance.
6. **Retry**: em lances classificados como imprecisão, erro, capivarada ou mate perdido, o usuário pode tentar de novo. É aceito qualquer lance que seria classificado como "bom" ou melhor.

## Gamificação

- Revelação animada da revisão: contadores subindo, lances especiais aparecendo um a um.
- Sons por categoria, sintetizados no navegador com Web Audio (sem arquivos de áudio no MVP).
- Placar resumo por jogador com a contagem de cada categoria, a precisão e o rating estimado.
- Conquistas e sequências (ex: "5 brilhantes no mês"). Só contam partidas em que o usuário é um dos jogadores, identificado pelo username informado na busca.

## Persistência

- IndexedDB no navegador guarda o cache das análises (chave: hash do PGN normalizado + versão do motor + versão das regras), o histórico de partidas analisadas e as conquistas.
- Quando o login existir, esses dados migram para a conta.

## Stack

- React + Vite + TypeScript.
- `chessground` (tabuleiro), `chess.js` (regras e PGN), Stockfish WASM via npm.
- Núcleo de análise em `src/core/`: TypeScript puro, sem React e sem DOM. Contém win%, classificação, precisão, rating estimado, gerador de texto, regras de conquista e parsers de PGN/APIs. Testado com Vitest.
- A UI em React só consome o núcleo.
- Hospedagem no Cloudflare Pages, com headers COOP/COEP configurados em `public/_headers`.
- Cloudflare Web Analytics, sem cookie.

## Fora do MVP

- Login e contas, com sincronização de histórico e conquistas.
- Interface em inglês e i18n.
- Coach com personagem.
- Sons definitivos: criar ou obter sons próprios (gravados, encomendados ou CC0) para substituir os sintetizados. A troca fica restrita a `src/ui/sound.ts`, que mantém a interface `playCategory(category)`.
- Comentário longo por lance e resumo textual da partida.
- Texto gerado por LLM a partir dos fatos.
- Eventos de uso próprios (exigem backend).
- Reaproveitar avaliações do Lichess.
- Análise no servidor (plano pago).
- Jogar contra o motor a partir de uma posição.
- App nativo.
- Xadrez 960 e posições customizadas.
