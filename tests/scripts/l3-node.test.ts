// Regressão L3: robustez do motor em Node. Oculto do corretor.
import { createNodeEngine } from '../../scripts/nodeEngine'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const FAST = { movetimeMs: 30, multipv: 1 }

describe('H10: motor Node robusto', () => {
  it('muitas análises seguidas não vazam listeners', async () => {
    const warnings: string[] = []
    const onWarn = (w: Error) => warnings.push(w.name)
    process.on('warning', onWarn)
    const e = await createNodeEngine()
    for (let i = 0; i < 14; i++) await e.analyse(START, FAST)
    e.quit()
    await new Promise((r) => setTimeout(r, 50))
    process.off('warning', onWarn)
    expect(warnings).not.toContain('MaxListenersExceededWarning')
  }, 30_000)

  it('quit com análises pendentes rejeita todas', async () => {
    const e = await createNodeEngine()
    const p1 = e.analyse(START, { movetimeMs: 2000, multipv: 1 })
    const p2 = e.analyse(START, { movetimeMs: 2000, multipv: 1 })
    await new Promise((r) => setTimeout(r, 100))
    e.quit()
    const r = await Promise.allSettled([p1, p2])
    expect(r.map((x) => x.status)).toEqual(['rejected', 'rejected'])
  }, 10_000)

  it('analyse depois de quit rejeita', async () => {
    const e = await createNodeEngine()
    e.quit()
    await expect(e.analyse(START, FAST)).rejects.toThrow()
  }, 10_000)

  it('análise abortada enquanto estava na fila não roda', async () => {
    const e = await createNodeEngine()
    const t0 = Date.now()
    const p1 = e.analyse(START, { movetimeMs: 1000, multipv: 1 })
    const ac = new AbortController()
    const p2 = e.analyse(START, { movetimeMs: 1000, multipv: 1 }, ac.signal)
    const r2 = expect(p2).rejects.toMatchObject({ name: 'AbortError' })
    ac.abort()
    await p1
    await r2
    expect(Date.now() - t0).toBeLessThan(1700)
    e.quit()
  }, 10_000)
})
