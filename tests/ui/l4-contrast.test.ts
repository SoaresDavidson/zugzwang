// Regressão L4: contraste dos tokens nos dois temas. Oculto do corretor.
import { readFileSync } from 'node:fs'

const css = readFileSync('src/ui/tokens.css', 'utf8')
function block(src: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of src.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2]
  return out
}
const light = block(css.slice(css.indexOf(':root'), css.indexOf('@media (prefers-color-scheme: dark)')))
const darkSrc = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'))
const dark = { ...light, ...block(darkSrc.slice(0, darkSrc.indexOf('}\n}') + 3)) }
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const CATS = ['book', 'brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder', 'missedMate']

describe.each([['claro', light], ['escuro', dark]])('tema %s', (_n, t) => {
  it.each(CATS)('--cat-%s ≥ 4.5:1 sobre --bg e --surface', (c) => {
    expect(ratio(t[`cat-${c}`], t.bg)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(t[`cat-${c}`], t.surface)).toBeGreaterThanOrEqual(4.5)
  })
  it('borda de controles ≥ 3:1', () => {
    expect(ratio(t['control-border'], t.bg)).toBeGreaterThanOrEqual(3)
    expect(ratio(t['control-border'], t.surface)).toBeGreaterThanOrEqual(3)
  })
  it('coordenadas legíveis nas duas casas', () => {
    expect(ratio(t['coord-on-light'], t['board-light'])).toBeGreaterThanOrEqual(4.5)
    expect(ratio(t['coord-on-dark'], t['board-dark'])).toBeGreaterThanOrEqual(4.5)
  })
  it('casas distinguíveis entre si', () => {
    expect(ratio(t['board-light'], t['board-dark'])).toBeGreaterThanOrEqual(1.8)
  })
})
