export interface EngineEnv { crossOriginIsolated: boolean; hardwareConcurrency: number }

export function pickEngineBuild(env: EngineEnv): { url: string; threads: number } {
  if (!env.crossOriginIsolated) return { url: '/stockfish/stockfish-19-lite-single.js', threads: 1 };
  const threads = Math.min(4, Math.max(1, Math.floor(env.hardwareConcurrency) - 1));
  return { url: '/stockfish/stockfish-19-lite.js', threads };
}
