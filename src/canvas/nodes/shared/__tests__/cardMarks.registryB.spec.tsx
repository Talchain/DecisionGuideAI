import { CanvasLegendPopover } from '../../../components/CanvasLegendPopover'
import { useCanvasStore } from '../../../store'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { FactorDriverLine } from '../FactorDriverLine'
import { afterEach, expect, it } from 'vitest'
import { CARD_MARKS, RENDERED_CARD_MARKS } from '../cardMarks'
afterEach(cleanup)
it('every rendered registry entry has a distinct glyph or visual', () => {
  const seen = new Map<unknown, string>()
  const glyphs = new Map<unknown, string>()
  for (const mark of RENDERED_CARD_MARKS) {
    expect(glyphs.get(mark.Icon), `${mark.id} duplicates glyph ${glyphs.get(mark.Icon)}`).toBeUndefined()
    glyphs.set(mark.Icon, mark.id)
    const shape = 'visual' in mark && mark.visual ? mark.visual : mark.Icon
    expect(seen.get(shape), `${mark.id} duplicates ${seen.get(shape)}`).toBeUndefined()
    seen.set(shape, mark.id)
  }
  for (const id of ['factor-tier', 'driver', 'outcome-unquantified', 'risk-unset', 'target-not-captured', 'assumptions-open', 'evidence-priority']) expect(RENDERED_CARD_MARKS.some(m => m.id === id)).toBe(true)
})
it('pre-run, the bottom-left Key lists the working-assumption mark the factor card draws (G1/G2 slice; the Key-pill fold is the next slice)', () => {
  expect(CARD_MARKS.find(m => m.id === 'working-assumption')?.rendered).toBe(true)
  useCanvasStore.setState({ nodes: [{ id: 'factor', type: 'factor', data: { type: 'factor', label: 'factor' }, position: { x: 0, y: 0 } }], edges: [], results: { status: 'idle', report: null } } as never)
  render(<CanvasLegendPopover />)
  fireEvent.click(screen.getByTestId('btn-canvas-legend'))
  expect(screen.getByTestId('legend-card-mark-working-assumption')).toHaveTextContent('Working assumption')
  // Phase gate control: a run-only mark is not listed before a Run.
  expect(screen.queryByTestId('legend-card-mark-driver')).toBeNull()
})
it.each([1, 2, 3])('driver %s: numeral, short bar and the unchanged caption in aria, with no native title', rank => {
  render(<FactorDriverLine nodeId="driver" rank={{ rank, setSize: 3 }} value={.4} inSlot />)
  const caption = screen.getByTestId('factor-driver-line-caption')
  expect(caption.textContent).toBe(String(rank))
  expect(caption).toHaveAttribute('aria-label', `Driver ${rank} of 3 ranked`)
  expect(caption.getAttribute('title') ?? '').toBe('')
  expect(screen.getByTestId('factor-driver-line').getAttribute('aria-label')).toMatch(new RegExp(`^Driver ${rank} of 3 ranked in this run\\. `))
  expect(screen.getByTestId('factor-driver-line-bar-fill').style.width).toBe('max(4px, 40%)')
  expect(screen.queryByTestId('factor-driver-line-history')).toBeNull()
})
it('last-run driver uses the same numeral and bar, muted, with History; no figure is the bar absence control', () => {
  render(<FactorDriverLine nodeId="driver" rank={{ rank: 2, setSize: 3 }} value={.4} inSlot fromLastRun />)
  expect(screen.getByTestId('factor-driver-line-caption')).toHaveTextContent('2')
  expect(screen.getByTestId('factor-driver-line-caption')).toHaveAttribute('aria-label', 'Last run · Driver 2 of 3')
  expect(screen.getByTestId('factor-driver-line')).toHaveClass('opacity-50')
  expect(screen.getByTestId('factor-driver-line-history').classList).toContain('lucide-history')
  cleanup(); render(<FactorDriverLine nodeId="driver" rank={{ rank: 2, setSize: 3 }} value={null} inSlot noValueYet />)
  expect(screen.getByTestId('factor-driver-line-caption')).toHaveTextContent('2')
  expect(screen.getByTestId('factor-driver-line').getAttribute('aria-label')).toContain('no value yet')
  expect(screen.queryByTestId('factor-driver-line-bar')).toBeNull()
})

// Re-pointed 7 Oct 2026 from the removed bottom-right pill to the ONE Key (bottom-left, Paul): same rows, same words,
// same drawn shapes. POSITIVE CONTROL: the loop below iterates a non-empty registry.
it('the Key draws every registered visual and glyph beside its existing words', () => {
  expect(RENDERED_CARD_MARKS.length).toBeGreaterThan(10)
  // After a Run, so the run-only marks (driver, share status) are listed too.
  useCanvasStore.setState({ nodes: ['factor', 'option', 'outcome', 'risk', 'goal', 'decision'].map(type => ({ id: type, type, data: { type, label: type }, position: { x: 0, y: 0 } })), edges: [], results: { status: 'complete', report: null } } as never)
  render(<CanvasLegendPopover />)
  fireEvent.click(screen.getByTestId('btn-canvas-legend'))
  for (const mark of RENDERED_CARD_MARKS) {
    const row = screen.getByTestId(`legend-card-mark-${mark.id}`)
    expect(row).toHaveTextContent(mark.keyText.trim())
    expect(row.querySelector('svg, [data-risk-cell], [data-level-step], [aria-hidden]')).not.toBeNull()
  }
})
