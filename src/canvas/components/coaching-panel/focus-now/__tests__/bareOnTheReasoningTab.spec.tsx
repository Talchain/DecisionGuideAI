/**
 * ⭐ REASONING V2 — "Focus now" is flat rows on the panel, not a nested card.
 *
 * Fidelity gap 9 (`output/panel-lane/reasoning-v2/FIDELITY-WORKFLOW-RESULT-20260924.json`):
 * the prototype has no cards; rows sit on the panel, icons are 16px, and AI
 * acts use the Olumi glyph. Staging drew `rounded-2xl border shadow-sm` with
 * its own h2 "Strengthen your model" under the zone's "Focus now" label, i.e.
 * two headings over one list.
 *
 * `bare` is passed ONLY by the Reasoning tab; the Analysis tab's mount
 * (`ResultsBody.tsx`) is unchanged, which the contrast case pins.
 */
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FocusNowPanel } from '../FocusNowPanel'
import { buildFocusRows } from '../buildFocusRows'
import { FOCUS_COPY } from '../focusConstants'
import type { FocusNowProps } from '../focusTypes'

const rows = buildFocusRows({}).rows
const renderPanel = (bare: boolean) => {
  const props: FocusNowProps = { summary: null, rows, banner: { kind: 'none' }, onPrefill: () => {} }
  return render(<FocusNowPanel {...props} bare={bare} />)
}
afterEach(cleanup)

describe('"Focus now" on the Reasoning tab', () => {
  it('PRECONDITION: the fixture has rows', () => {
    expect(rows.length).toBeGreaterThan(0)
  })

  it('bare: no card chrome and no second heading; rows sit on the panel with 16px icons', () => {
    renderPanel(true)
    const panel = screen.getByTestId('focus-now-panel')
    for (const cls of ['rounded-2xl', 'shadow-sm', 'border']) expect(panel.className.split(/\s+/)).not.toContain(cls)
    expect(screen.queryByRole('heading', { name: FOCUS_COPY.header })).toBeNull()
    // The list keeps its accessible name even without the visible heading.
    expect(panel).toHaveAttribute('aria-label', FOCUS_COPY.panelAria)
    const firstRow = panel.querySelector('li button') as HTMLElement
    expect(firstRow.className).toContain('px-0')
    expect(firstRow.className).not.toContain('px-3.5')
    const icon = firstRow.querySelector('svg') as SVGElement
    expect(icon.getAttribute('class')).toContain('h-4')
  })

  it('bare: an opened row\'s AI act uses the Olumi glyph, not Sparkles', () => {
    renderPanel(true)
    const panel = screen.getByTestId('focus-now-panel')
    fireEvent.click(panel.querySelector('li button') as HTMLElement)
    const lucideSparkles = panel.querySelector('svg.lucide-sparkles')
    expect(lucideSparkles).toBeNull()
  })

  it('CONTRAST: without bare (the Analysis tab) the card and its heading are unchanged', () => {
    renderPanel(false)
    const panel = screen.getByTestId('focus-now-panel')
    for (const cls of ['rounded-2xl', 'shadow-sm', 'border']) expect(panel.className.split(/\s+/)).toContain(cls)
    expect(screen.getByRole('heading', { name: FOCUS_COPY.header })).toBeInTheDocument()
  })

  it('only the Reasoning tab passes bare', () => {
    const root = resolve(__dirname, '../../../../../..')
    const body = readFileSync(resolve(root, 'src/components/results/analysisNew/AnalysisNewTabBody.tsx'), 'utf8')
    const legacy = readFileSync(resolve(root, 'src/components/results/ResultsBody.tsx'), 'utf8')
    expect(body).toMatch(/<FocusNowContainer[^>]*\bbare\b/)
    expect(legacy).not.toMatch(/<FocusNowContainer[^>]*\bbare\b/)
  })
})
