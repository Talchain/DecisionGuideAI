/**
 * ⭐⭐ V2 GAP 34 — THE RE-ANALYSE FOOTER BAR USES AN AMBER ONE-SIDED TOP BORDER,
 * AN 11PX SQUARE BUTTON AND FADED TEXT.
 *
 * `FIDELITY-GAPS-INDEX-20260924.txt` #34 (medium/quick). The design
 * authority's footer divider is neutral
 * (`.composer:before{background:var(--border-default)}`), and its primary
 * button is a 12px, ≥30px-tall PILL (`.primary{font-size:12px;
 * min-height:30px;border-radius:99px}`) — staleness is carried by the
 * SENTENCE's ink (`.stale{color:var(--warning-ink)}`), not by tinting the
 * bar's own edge. `AnalysisReadinessBar.tsx`, the sibling bar sharing this
 * shell's footer slot, already renders this way; before this fix the two
 * bars disagreed with each other (amber rule + 11px grey text + 6px-radius
 * button vs neutral rule + 12px text + pill).
 *
 * Four independent assertions, each bound to its own production edit so a
 * mutant reverting any ONE of them REDs only its own line:
 *   1. the bar's top rule is neutral, never amber.
 *   2. the stale headline is 12px ink (`panelBody` + `--warning-ink`), not
 *      11px grey.
 *   3. the blocked-reason subline carries no EXTRA fade on top of its own
 *      colour token.
 *   4. the button is a ≥30px pill at 12px, not an 11px, 6px-radius rectangle.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReanalyseBar } from '../ReanalyseBar'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockFreshness: any = null
let mockDirty = false

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ analysisFreshness: mockFreshness, analysisFreshnessDirty: mockDirty }),
  ),
}))

const NO_GATE = { canRun: undefined, blockedReason: undefined, isAnalysing: undefined } as const

function classTokens(el: Element): string[] {
  return el.className.split(/\s+/).filter(Boolean)
}

describe('1. the footer divider is neutral, not amber', () => {
  it('carries border-panel-border, never border-warning', () => {
    mockFreshness = { freshness: 'stale' }
    mockDirty = false
    render(<ReanalyseBar {...NO_GATE} />)
    const tokens = classTokens(screen.getByTestId('reanalyse-bar'))
    expect(tokens).toContain('border-panel-border')
    expect(tokens.some(t => t.startsWith('border-warning'))).toBe(false)
  })
})

describe('2. the stale headline is 12px ink, not 11px grey', () => {
  it('the headline text sits in a panelBody span carrying --warning-ink', () => {
    mockFreshness = { freshness: 'stale' }
    mockDirty = false
    render(<ReanalyseBar {...NO_GATE} />)
    const headline = screen.getByText(/Model changed/)
    expect(headline.className).toContain('text-[color:var(--warning-ink)]')
    // panelBody ('text-xs leading-relaxed', 12px) not panelMeta
    // ('text-[11px] leading-snug', 11px) — bound by the ABSENCE of
    // panelMeta's own 11px marker class (`typography.ts:262-263`).
    expect(headline.className).toContain('leading-relaxed')
    expect(headline.className).not.toContain('text-[11px]')
  })
})

describe('3. the blocked-reason subline carries no extra fade', () => {
  it('renders at plain text-text-light — never the additional /80 alpha', () => {
    mockFreshness = { freshness: 'fresh' }
    mockDirty = true
    render(
      <ReanalyseBar
        canRun={false}
        blockedReason="Analysis is held on a saved example."
        isAnalysing={undefined}
      />,
    )
    const reason = screen.getByTestId('reanalyse-blocked-reason')
    const tokens = classTokens(reason)
    expect(tokens).toContain('text-text-light')
    expect(tokens).not.toContain('text-text-light/80')
  })
})

describe('4. the button is a ≥30px pill at panelBody, not an 11px rectangle', () => {
  it('rounded-full, min-h-[30px], panelBody — never rounded-md/panelMeta', () => {
    mockFreshness = { freshness: 'stale' }
    mockDirty = false
    render(<ReanalyseBar {...NO_GATE} />)
    const button = screen.getByTestId('reanalyse-button')
    const tokens = classTokens(button)
    expect(tokens).toContain('rounded-full')
    expect(tokens).toContain('min-h-[30px]')
    expect(tokens).not.toContain('rounded-md')
  })
})
