import { ENGINE_FILE_MULTI, ENGINE_FILE_SINGLE, ENGINE_MAX_THREADS } from '../core/thresholds';

export interface EngineEnv { crossOriginIsolated: boolean; hardwareConcurrency: number }

export function pickEngineBuild(env: EngineEnv): { url: string; threads: number } {
  if (!env.crossOriginIsolated) return { url: `/stockfish/${ENGINE_FILE_SINGLE}`, threads: 1 };
  const threads = Math.min(ENGINE_MAX_THREADS, Math.max(1, Math.floor(env.hardwareConcurrency) - 1));
  return { url: `/stockfish/${ENGINE_FILE_MULTI}`, threads };
}
