import { RATING } from './thresholds';
import { moverPct } from './winPercent';

const MOVE_WEIGHT_MIN = 0.5;
const MOVE_WEIGHT_MAX = 12;
const WINDOW_MIN = 2;
const WINDOW_MAX = 8;
const WINDOW_DIVISOR = 10;
const WINDOW_WARMUP_OFFSET = 2;

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Precisão de um lance (método do Lichess). Win% do ponto de vista de quem moveu. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const loss = Math.max(0, winBefore - winAfter);
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * loss) - 3.166924740191411;
  return Math.min(100, clamp(raw, 0, 100) + 1);
}

function stdDev(xs: number[]): number {
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
}

/** Piso usado na média harmônica para evitar divisão por zero (moveAccuracy já devolve >= 1). */
const HARMONIC_FLOOR = 0.001;

function combine(accs: number[], weights: number[]): number {
  if (accs.length === 0) return 100;
  const wSum = weights.reduce((s, w) => s + w, 0);
  const weighted = accs.reduce((s, a, i) => s + a * weights[i], 0) / wSum;
  const harmonic = accs.length / accs.reduce((s, a) => s + 1 / Math.max(a, HARMONIC_FLOOR), 0);
  return (weighted + harmonic) / 2;
}

/** `whiteWins[i]` = win% das brancas na posição `i` (plies + 1 entradas). */
export function gameAccuracy(whiteWins: number[]): { w: number; b: number } {
  const len = whiteWins.length;
  const n = len - 1;
  if (n < 1) return { w: 100, b: 100 };
  const windowSize = clamp(Math.floor(n / WINDOW_DIVISOR), WINDOW_MIN, WINDOW_MAX);
  const size = Math.min(windowSize, len);
  const windows: number[][] = [];
  for (let k = 0; k < windowSize - WINDOW_WARMUP_OFFSET; k++) windows.push(whiteWins.slice(0, size));
  for (let i = 0; i + size <= len; i++) windows.push(whiteWins.slice(i, i + size));

  const accuracies = { w: [] as number[], b: [] as number[] };
  const weights = { w: [] as number[], b: [] as number[] };
  for (let i = 0; i < n; i++) {
    const weight = clamp(stdDev(windows[Math.min(i, windows.length - 1)]), MOVE_WEIGHT_MIN, MOVE_WEIGHT_MAX);
    const color = i % 2 === 0 ? 'w' : 'b';
    accuracies[color].push(moveAccuracy(moverPct(whiteWins[i], color), moverPct(whiteWins[i + 1], color)));
    weights[color].push(weight);
  }
  return { w: combine(accuracies.w, weights.w), b: combine(accuracies.b, weights.b) };
}

export function estimateRating(accuracy: number): number {
  return clamp(Math.round(RATING.intercept + RATING.slope * accuracy), RATING.min, RATING.max);
}
