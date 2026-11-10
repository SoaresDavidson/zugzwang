# Fixtures de calibração

Cada arquivo `.json` desta pasta é uma partida que já passou pelo Game Review do chess.com. `npm run calibrate` analisa o PGN com o motor local e compara com a classificação transcrita.

## Formato

```json
{
  "pgn": "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0",
  "expected": ["book", "book", "book", "book", null, "blunder", "best"]
}
```

- `expected` tem uma entrada por ply (meio-lance), na ordem da partida: brancas, pretas, brancas...
- Use `null` quando o rótulo não aparece no print. Essa posição é ignorada.
- Um tamanho diferente do número de plies do PGN faz a fixture ser rejeitada.

## Como transcrever um print

1. Abra o Game Review da partida e anote o ícone de cada lance, na ordem.
2. Troque cada ícone pelo nome em inglês da tabela abaixo.
3. Cole o PGN da partida e salve como `nome.json`.

## Categorias

| `MoveCategory` | Rótulo no chess.com (pt-BR) |
| --- | --- |
| `book` | Livro |
| `brilliant` | Brilhante |
| `great` | Ótimo |
| `best` | Melhor |
| `excellent` | Excelente |
| `good` | Bom |
| `inaccuracy` | Imprecisão |
| `mistake` | Erro |
| `blunder` | Erro grave |
| `missedMate` | Mate perdido (lance que deixa escapar um mate; no chess.com costuma aparecer como erro grave ou erro) |
