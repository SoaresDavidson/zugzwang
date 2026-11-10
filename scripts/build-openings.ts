import { Chess } from 'chess.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toEpd } from '../src/core/epd';

const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/core/data/openings.json');

const book: Record<string, [string, string]> = {};
const lengths = new Map<string, number>();

for (const letter of ['a', 'b', 'c', 'd', 'e']) {
  const res = await fetch(`${BASE}/${letter}.tsv`);
  if (!res.ok) throw new Error(`${letter}.tsv: HTTP ${res.status}`);
  const lines = (await res.text()).split('\n').slice(1);
  for (const line of lines) {
    if (!line.trim()) continue;
    const [eco, name, pgn] = line.split('\t');
    const chess = new Chess();
    chess.loadPgn(pgn);
    const plies = chess.history().length;
    const epd = toEpd(chess.fen());
    // Linha mais longa vence; em empate, fica a primeira.
    if (plies > (lengths.get(epd) ?? -1)) {
      lengths.set(epd, plies);
      book[epd] = [eco, name];
    }
  }
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(book));
console.log(`${Object.keys(book).length} posições em ${OUT}`);
