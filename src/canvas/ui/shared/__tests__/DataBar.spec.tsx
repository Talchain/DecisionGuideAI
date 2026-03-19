/**
 * DataBar component tests
 * Section I: size modes, colour overrides, accessibility, showPercent guard
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DataBar } from '../DataBar'

describe('DataBar', () => {
  // I4: value=0 renders bar (not hidden)
  it('renders a progressbar element when value=0', () => {
    const { container } = render(<DataBar value={0} label="Empty" />)
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar).not.toBeNull()
    expect(bar?.getAttribute('aria-valuenow')).toBe('0')
  })

  // I5: value=1 renders full bar
  it('aria-valuenow is 100 when value=1', () => {
    const { container } = render(<DataBar value={1} label="Full" />)
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute('aria-valuenow')).toBe('100')
  })

  // I6: value=0.5 renders half bar
  it('aria-valuenow is 50 when value=0.5', () => {
    const { container } = render(<DataBar value={0.5} label="Half" />)
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute('aria-valuenow')).toBe('50')
  })

  // J8: Accessibility — aria-label and aria-valuenow present
  it('has aria-label matching the label prop', () => {
    const { container } = render(<DataBar value={0.7} label="Confidence" />)
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute('aria-label')).toBe('Confidence')
  })

  it('has aria-valuemin=0 and aria-valuemax=100', () => {
    const { container } = render(<DataBar value={0.5} label="Test" />)
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute('aria-valuemin')).toBe('0')
    expect(bar?.getAttribute('aria-valuemax')).toBe('100')
  })

  // I7: colourVar override — fill uses backgroundColor style, not CSS class
  it('uses backgroundColor from colourVar when provided', () => {
    const { container } = render(
      <DataBar value={0.5} label="Custom" colourVar="var(--info)" />
    )
    const bar = container.querySelector('[role="progressbar"]')
    const fill = bar?.firstElementChild as HTMLElement | null
    expect(fill?.style.backgroundColor).toBe('var(--info)')
    // Must not apply COLOUR_CLASS (e.g. bg-info) when colourVar overrides
    expect(fill?.className).not.toContain('bg-info')
  })

  // I8: Evaluative thresholds auto colour (no override)
  it('applies bg-danger for value < 0.4', () => {
    const { container } = render(<DataBar value={0.3} label="Low" />)
    const bar = container.querySelector('[role="progressbar"]')
    const fill = bar?.firstElementChild as HTMLElement | null
    expect(fill?.className).toContain('bg-danger')
  })

  it('applies bg-warning for value 0.4 to 0.69', () => {
    const { container } = render(<DataBar value={0.55} label="Mid" />)
    const bar = container.querySelector('[role="progressbar"]')
    const fill = bar?.firstElementChild as HTMLElement | null
    expect(fill?.className).toContain('bg-warning')
  })

  it('applies bg-success for value >= 0.7', () => {
    const { container } = render(<DataBar value={0.75} label="High" />)
    const bar = container.querySelector('[role="progressbar"]')
    const fill = bar?.firstElementChild as HTMLElement | null
    expect(fill?.className).toContain('bg-success')
  })

  // I8 boundary: 0.4 → warning
  it('applies bg-warning at exactly 0.4 (lower threshold boundary)', () => {
    const { container } = render(<DataBar value={0.4} label="Boundary" />)
    const bar = container.querySelector('[role="progressbar"]')
    const fill = bar?.firstElementChild as HTMLElement | null
    expect(fill?.className).toContain('bg-warning')
  })

  // I8 boundary: 0.7 → success
  it('applies bg-success at exactly 0.7 (upper threshold boundary)', () => {
    const { container } = render(<DataBar value={0.7} label="Boundary" />)
    const bar = container.querySelector('[role="progressbar"]')
    const fill = bar?.firstElementChild as HTMLElement | null
    expect(fill?.className).toContain('bg-success')
  })

  // Colour override takes priority over evaluative colour
  it('uses supplied colour prop instead of evaluative threshold', () => {
    const { container } = render(<DataBar value={0.2} label="Override" colour="goal" />)
    const bar = container.querySelector('[role="progressbar"]')
    const fill = bar?.firstElementChild as HTMLElement | null
    // value=0.2 would auto-select bg-danger, but colour="goal" overrides
    expect(fill?.className).toContain('bg-goal')
    expect(fill?.className).not.toContain('bg-danger')
  })

  // I1: compact size (default) — max-w-[60px] on track, h-1.5
  it('compact size uses h-1.5 track and max-w-[60px]', () => {
    const { container } = render(<DataBar value={0.5} label="Compact" />)
    const bar = container.querySelector('[role="progressbar"]')
    // compact track: h-1.5 and max-w-[60px]
    expect(bar?.className).toContain('h-1.5')
    expect(bar?.className).toContain('max-w-[60px]')
  })

  // I2: standard size — full width, h-1.5 (or h-2 with showPercent)
  it('standard size does not apply max-w-[60px]', () => {
    const { container } = render(<DataBar value={0.5} label="Standard" size="standard" />)
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.className).not.toContain('max-w-[60px]')
  })

  // I3: showPercent is silently ignored in compact mode — no % text shown
  it('showPercent is ignored in compact mode — no percentage text rendered', () => {
    render(<DataBar value={0.72} label="Compact pct" showPercent />)
    // percent would be "72%" — should not appear in compact
    expect(screen.queryByText('72%')).toBeNull()
  })

  // I3 positive: showPercent=true in standard mode DOES show the percentage
  it('showPercent=true in standard mode renders percentage text', () => {
    render(<DataBar value={0.72} label="Standard pct" size="standard" showPercent />)
    expect(screen.getByText('72%')).toBeDefined()
  })

  // trailingLabel shown in compact mode
  it('trailingLabel renders when provided in compact mode', () => {
    render(<DataBar value={0.8} label="Influence" trailingLabel="High" />)
    expect(screen.getByText('High')).toBeDefined()
  })

  // trailingLabel shown in standard mode
  it('trailingLabel renders in standard mode', () => {
    render(<DataBar value={0.6} label="Stability" size="standard" trailingLabel="Moderate" />)
    expect(screen.getByText('Moderate')).toBeDefined()
  })

  // Values clamped at boundaries
  it('clamps value above 1 to 100%', () => {
    const { container } = render(<DataBar value={1.5} label="Over" />)
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute('aria-valuenow')).toBe('100')
  })

  it('clamps negative value to 0%', () => {
    const { container } = render(<DataBar value={-0.5} label="Negative" />)
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute('aria-valuenow')).toBe('0')
  })
})
