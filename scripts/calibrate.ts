import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyzeGame } from '../src/core/analyzeGame';
import { parsePgn } from '../src/core/pgn';
import { ANALYSE_OPTIONS } from '../src/core/thresholds';
import type { MoveCategory } from '../src/core/types';
import { compareCategories, formatReport, type CalibrationFixture } from './calibration';
import { createNodeEngine } from './nodeEngine';

void ANALYSE_OPTIONS; // analyzeGame já usa ANALYSE_OPTIONS ao chamar o motor.

const DIR = 'tests/fixtures/calibration';

async function main() {
  const files = (await readdir(DIR)).filter((f) => f.endsWith('.json')).sort();
  const engine = await createNodeEngine();
  const results: { expected: (MoveCategory | null)[]; actual: MoveCategory[] }[] = [];
  try {
    for (const file of files) {
      try {
        const fx = JSON.parse(await readFile(join(DIR, file), 'utf8')) as CalibrationFixture;
        if (typeof fx.pgn !== 'string' || !Array.isArray(fx.expected)) throw new Error('formato inválido');
        const game = parsePgn(fx.pgn);
        const analysis = await analyzeGame(game, engine);
        const actual = analysis.moves.map((m) => m.category);
        compareCategories([{ expected: fx.expected, actual }]);
        results.push({ expected: fx.expected, actual });
        console.log(`ok: ${file}`);
      } catch (e) {
        console.error(`fixture inválida: ${file}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } finally {
    engine.quit();
  }
  console.log(formatReport(compareCategories(results)));
}

main().catch((e) => { console.error(e); process.exit(1); });
