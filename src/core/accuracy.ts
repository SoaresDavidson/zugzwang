import { RATING } from './thresholds';

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
  const windowSize = clamp(Math.floor(n / 10), 2, 8);
  const size = Math.min(windowSize, len);
  const windows: number[][] = [];
  for (let k = 0; k < windowSize - 2; k++) windows.push(whiteWins.slice(0, size));
  for (let i = 0; i + size <= len; i++) windows.push(whiteWins.slice(i, i + size));

  const acc = { w: [] as number[], b: [] as number[] };
  const wt = { w: [] as number[], b: [] as number[] };
  for (let i = 0; i < n; i++) {
    const weight = clamp(stdDev(windows[Math.min(i, windows.length - 1)]), 0.5, 12);
    const white = i % 2 === 0;
    const [before, after] = white
      ? [whiteWins[i], whiteWins[i + 1]]
      : [100 - whiteWins[i], 100 - whiteWins[i + 1]];
    const c = white ? 'w' : 'b';
    acc[c].push(moveAccuracy(before, after));
    wt[c].push(weight);
  }
  return { w: combine(acc.w, wt.w), b: combine(acc.b, wt.b) };
}

export function estimateRating(accuracy: number): number {
  return clamp(Math.round(RATING.intercept + RATING.slope * accuracy), RATING.min, RATING.max);
}
