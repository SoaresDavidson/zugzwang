// @vitest-environment jsdom
// Regressão L3: falha de armazenamento não pode virar erro de motor. Oculto do corretor.
import { renderHook, waitFor } from '@testing-library/react'
import { parsePgn } from '../../src/core/pgn'
import { useAnalysis } from '../../src/ui/useAnalysis'
import { ERROR_MESSAGE } from '../../src/ui/messages'
import { scriptedEngine } from '../fixtures/fakeEngine'
import { SCHOLAR, SCHOLAR_EVALS } from '../fixtures/scholarEvals'

vi.mock('../../src/storage/db', () => {
  const fail = () => Promise.reject(new Error('IndexedDB indisponível'))
  return {
    getCachedAnalysis: fail, putAnalysis: fail, putHistory: fail, listHistory: fail,
    getProfile: fail, setProfile: fail, closeDb: async () => {},
  }
})

describe('H2: armazenamento indisponível degrada sem erro', () => {
  it('analisa e mostra o resultado mesmo sem IndexedDB', async () => {
    const { result } = renderHook(() => useAnalysis(parsePgn(SCHOLAR), async () => scriptedEngine(SCHOLAR_EVALS)))
    await waitFor(() => expect(result.current.status).toBe('done'))
    expect(result.current.analysis?.moves).toHaveLength(7)
    expect(result.current.error).toBeNull()
  })
})

describe('H3: erro que não é do motor tem mensagem própria', () => {
  it('bug na análise não aparece como motor que não carregou', async () => {
    const broken = { analyse: async () => { throw new Error('boom') } }
    const { result } = renderHook(() => useAnalysis(parsePgn(SCHOLAR), async () => broken))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('Algo deu errado durante a análise. Tente de novo.')
    expect(ERROR_MESSAGE['analysis-failed']()).toBe('Algo deu errado durante a análise. Tente de novo.')
  })
})
