/**
 * THE KEY'S CONNECTOR ROWS MATCH THE REAL ENCODING — Paul's 23 Sep contract
 * feedback, points 4, 9 and 12.
 *
 *   · the sign glyphs are drawn as the canvas draws them: a CHARACTER in body
 *     ink (`StyledEdge`'s polarity glyph is `text-text-body font-semibold`), so
 *     the key does not teach a coloured mark the canvas never paints;
 *   · the orange row carries the "±" the canvas now draws on a sign-disputed
 *     connection (point 9: Warning/amber + `±`);
 *   · the fragility row draws the canvas's own neutral mark (not the warning
 *     triangle) and states the cue's own sentence, never "Sensitive" (point 4).
 *
 * Only the EDGE rows are asserted here; node rows belong to another file.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CanvasLegendPopover } from '../CanvasLegendPopover'
import { useCanvasStore } from '../../store'
import { FRAGILE_CUE_SENTENCE, LEGEND_ORANGE_CAPTION } from '../../edges/connectorCopy'

function setPhase(status: 'idle' | 'complete'): void {
  useCanvasStore.setState({
    results: { status, progress: 0 },
    nodes: [],
    optionNumbering: {},
    viewMode: 'standard',
  } as never)
}

function open(): HTMLElement {
  render(<CanvasLegendPopover />)
  fireEvent.click(screen.getByTestId('btn-canvas-legend'))
  return screen.getByTestId('canvas-legend-popover')
}

/** The row element that holds a caption — the LegendGroup row, by structure. */
function rowOf(caption: string): HTMLElement {
  return screen.getByText(caption).parentElement as HTMLElement
}

afterEach(() => {
  cleanup()
  setPhase('idle')
})

describe('the sign rows draw the sign as the canvas does — a character, in body ink', () => {
  it.each([
    ['Raises', '+'],
    ['Lowers', '−'],
  ])('the "%s" row carries the character "%s" in body ink, semibold', (caption, ch) => {
    open()
    const mark = rowOf(caption).querySelector('[data-testid="legend-polarity-mark"]') as HTMLElement | null
    expect(mark, `the ${caption} row draws no sign character`).not.toBeNull()
    expect(mark!.textContent).toBe(ch)
    expect(mark!.style.color).toBe('var(--text-body)')
    expect(mark!.style.fontWeight).toBe('600')
  })

  it('the orange (AI sign disagreement) row carries the "±" the canvas draws', () => {
    open()
    const mark = rowOf(LEGEND_ORANGE_CAPTION).querySelector('[data-testid="legend-polarity-mark"]') as HTMLElement | null
    expect(mark, 'the sign-disagreement row has no ± mark').not.toBeNull()
    expect(mark!.textContent).toBe('±')
    // The line itself is still the canvas's amber.
    const line = rowOf(LEGEND_ORANGE_CAPTION).querySelector('svg line')
    expect(line?.getAttribute('stroke') ?? '').toContain('--semantic-warning')
  })

  it('CONTROL: the grey "not set" row draws NO sign character (the canvas draws none)', () => {
    open()
    expect(rowOf('Grey: direction not set yet').querySelector('[data-testid="legend-polarity-mark"]')).toBeNull()
  })
})

describe('the fragility row keys the ONE discreet cue the canvas draws', () => {
  it('post-run: the neutral mark, the cue\'s own sentence, the budget — no triangle, no "Sensitive"', () => {
    setPhase('complete')
    open()
    const row = screen.getByTestId('legend-fragile-cue')
    const icon = row.querySelector('svg')
    expect(icon).not.toBeNull()
    expect(icon!.getAttribute('class') ?? '').toMatch(/lucide-activity/)
    expect(icon!.getAttribute('class') ?? '').not.toMatch(/triangle/)
    expect(row.textContent).toContain(FRAGILE_CUE_SENTENCE)
    expect(row.textContent).toMatch(/Standard view marks only/)
    expect(row.textContent).not.toMatch(/^Sensitive|Sensitive:/)
    expect(row.textContent).not.toMatch(/\d/)
  })
})
