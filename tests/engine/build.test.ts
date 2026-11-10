import { pickEngineBuild } from '../../src/engine/build';

const MULTI = '/stockfish/stockfish-19-lite.js';
const SINGLE = '/stockfish/stockfish-19-lite-single.js';

describe('pickEngineBuild', () => {
  it('com isolamento usa multi-thread', () =>
    expect(pickEngineBuild({ crossOriginIsolated: true, hardwareConcurrency: 8 })).toEqual({ url: MULTI, threads: 4 }));

  it('sem SharedArrayBuffer cai para single', () =>
    expect(pickEngineBuild({ crossOriginIsolated: false, hardwareConcurrency: 8 })).toEqual({ url: SINGLE, threads: 1 }));

  it.each([[1, 1], [2, 1], [3, 2], [4, 3], [5, 4], [8, 4], [64, 4]])(
    'isolado com %i núcleos usa %i threads', (hc, threads) =>
      expect(pickEngineBuild({ crossOriginIsolated: true, hardwareConcurrency: hc })).toEqual({ url: MULTI, threads }));

  it('sem isolamento threads é 1 mesmo com 64 núcleos', () =>
    expect(pickEngineBuild({ crossOriginIsolated: false, hardwareConcurrency: 64 })).toEqual({ url: SINGLE, threads: 1 }));
});
