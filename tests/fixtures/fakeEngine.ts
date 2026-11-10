import { Chess } from 'chess.js';
import type { AnalyseOptions, Engine, EngineLine, PositionEval, Score } from '../../src/core/types';

export interface ScriptedEngine extends Engine {
  /** Número de chamadas a `analyse` (inclui a que lançou, se houver). */
  calls: number;
  fensSeen: string[];
  optsSeen: AnalyseOptions[];
  signalsSeen: (AbortSignal | undefined)[];
}

export interface ScriptedEngineOptions {
  /** Chamado no início de cada `analyse`, com o contador já incrementado (1 na primeira chamada). */
  onCall?: (n: number) => void;
}

/** Motor falso: devolve a avaliação roteirizada da FEN e lança se a FEN estiver fora do roteiro. */
export function scriptedEngine(
  evalsByFen: Record<string, PositionEval>,
  opts: ScriptedEngineOptions = {},
): ScriptedEngine {
  const engine: ScriptedEngine = {
    calls: 0,
    fensSeen: [],
    optsSeen: [],
    signalsSeen: [],
    async analyse(fen, options, signal) {
      engine.calls += 1;
      engine.fensSeen.push(fen);
      engine.optsSeen.push(options);
      engine.signalsSeen.push(signal);
      opts.onCall?.(engine.calls);
      const hit = evalsByFen[fen];
      if (!hit) throw new Error(`scriptedEngine: FEN fora do roteiro: ${fen}`);
      return hit;
    },
  };
  return engine;
}

export const cp = (value: number): Score => ({ kind: 'cp', value });
export const mate = (value: number): Score => ({ kind: 'mate', value });
export const line = (move: string, score: Score): EngineLine => ({ move, score, pv: [move] });

/**
 * Monta o roteiro de uma partida a partir dos SANs (FENs geradas com chess.js).
 * Por padrão `lines[0]` é o lance jogado e `lines[1]` outro lance legal, ambos com `baseCp`
 * (ponto de vista das brancas). `overrides[i]` substitui as linhas da posição `i`.
 * A posição final é omitida quando a partida acabou (mate, afogamento, material insuficiente).
 */
export function buildEvals(
  sans: string[],
  overrides: Record<number, EngineLine[]> = {},
  baseCp = 30,
): Record<string, PositionEval> {
  const chess = new Chess();
  const out: Record<string, PositionEval> = {};
  for (let i = 0; i <= sans.length; i++) {
    if (!chess.isGameOver()) {
      const fen = chess.fen();
      let lines = overrides[i];
      if (!lines) {
        const legal = chess.moves({ verbose: true });
        const played = i < sans.length ? new Chess(fen).move(sans[i]).lan : legal[0].lan;
        const other = legal.find(m => m.lan !== played)!.lan;
        lines = [line(played, cp(baseCp)), line(other, cp(baseCp - 10))];
      }
      out[fen] = { fen, lines };
    }
    if (i < sans.length) chess.move(sans[i]);
  }
  return out;
}
