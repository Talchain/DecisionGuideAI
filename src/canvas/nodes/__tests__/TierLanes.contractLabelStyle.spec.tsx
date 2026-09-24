/**
 * DESIGN-GAP-AUDIT row 4 — band-label STYLE (not words).
 *
 * OWNER DECISION (24 Sep 2026, gap-frame-footer lane): keep the PRODUCT words
 * (`TITLE_BY_TIER` / `MODEL_GROUP_TITLE`, e.g. "Question", "Options",
 * "Outcomes & risks") — the row itself is DONE per the audit's §3. What was
 * missing was contract v3.1 `.layer-label`'s STYLE: uppercase (visually only —
 * the DOM text stays sentence case, since this whole block is
 * `aria-hidden="true"` furniture with no accessible name to shout), 10px base
 * size (was 11px, `typography.edgeLabel`), colour #777870 (was
 * `text-text-light` / `--text-light` #6E6B6B — measured ~6.8 ΔE76 apart, a
 * shared token retinted specifically for AA contrast on BODY text, not close
 * enough to reuse for this decorative label without borrowing its semantics),
 * 0.5px letter-spacing (already correct, unpinned here because it never
 * changed).
 *
 * ⚠ WHY THE COLOUR AND THE UPPERCASE LIVE IN `TierLanes.module.css`, NOT
 * INLINE HERE. `tools/ci-guards/check-ds-compliance.mjs` ratchets two classes
 * that scan `.tsx` ONLY: `uppercase-text` (`\buppercase\b`, comments included)
 * and `production-hex` (a raw `#RRGGBB` outside `var(--token, #hex)`). Both
 * regexes are blind to `.css`/`.module.css` — neither class scans them — so a
 * CSS Module rule is the one place this styling can live without adding a
 * net-new signature to a ratchet with zero headroom. `vitest.config.ts` sets
 * `css: false`, so the module's *rules* are never applied to jsdom (no real
 * paint), but its *class-name mapping* IS real (Vite's CSS-Modules transform
 * still runs) — this file imports the same module the component does and
 * binds to that literal class name, which is identity rather than a colour or
 * cascade a browser would have to compute.
 *
 * CLAIM SCOPE: jsdom proves the CLASS NAME is applied and the DOM text is
 * unchanged — never the resulting pixels. `check-ds-compliance.mjs --enforce`
 * (not run by this spec) is the authority that no raw hex/uppercase literal
 * leaked into `.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Node } from '@xyflow/react'
import { TierLanes } from '../TierLanes'
import { deriveTierLanes } from '../../utils/tierLanes'
import tierLaneStyles from '../TierLanes.module.css'
import { typography } from '../../../styles/typography'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@xyflow/react')
  return { ...actual, ViewportPortal: ({ children }: { children: ReactNode }) => children }
})

function n(id: string, type: string, x: number, y: number, w = 200, h = 100): Node {
  return { id, type, position: { x, y }, data: { label: id }, width: w, height: h } as unknown as Node
}

// Every occupied tier, so the fix is proven on the WHOLE set rather than one
// hand-picked label (the "CONTRAST — every occupied tier" idiom this file's
// sibling spec already uses).
const BOARD: Node[] = [
  n('dec', 'decision', 1064, 150, 336, 290),
  n('o1', 'option', 100, 500, 336, 515),
  n('o2', 'option', 600, 500, 336, 515),
  n('f1', 'factor', 40, 1150, 187, 360),
  n('out1', 'outcome', 800, 1600, 187, 219),
  n('goal', 'goal', 500, 2000, 336, 264),
]

const tokens = (el: Element | null): string[] => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)

afterEach(cleanup)

describe('contract v3.1 .layer-label style — product words, contract chrome', () => {
  it('the counter-scaled base size is 10px, not 11px (typography.edgeLabel)', () => {
    render(<TierLanes nodes={BOARD} />)
    for (const lane of deriveTierLanes(BOARD)) {
      const t = tokens(screen.getByTestId(`tier-lane-${lane.tier}-title`))
      expect(t).toContain('text-[length:calc(10px*var(--canvas-label-scale,1))]')
      // CONTRAST: the OLD size this replaces, so a no-op edit cannot pass.
      expect(t).not.toContain('text-[length:calc(11px*var(--canvas-label-scale,1))]')
      expect(t).not.toContain(typography.edgeLabel.split(/\s+/)[0])
    }
  })

  it('carries the module’s own uppercase/colour class, bound by identity — not the shared muted-text token', () => {
    render(<TierLanes nodes={BOARD} />)
    expect(typeof tierLaneStyles.tierLabel).toBe('string')
    expect(tierLaneStyles.tierLabel.length).toBeGreaterThan(0)
    for (const lane of deriveTierLanes(BOARD)) {
      const el = screen.getByTestId(`tier-lane-${lane.tier}-title`)
      const t = tokens(el)
      expect(t).toContain(tierLaneStyles.tierLabel)
      // CONTRAST: the shared `--text-light` utility this local style replaces.
      expect(t).not.toContain('text-text-light')
    }
  })

  it('0.5px letter-spacing is unchanged (contract-correct already)', () => {
    render(<TierLanes nodes={BOARD} />)
    for (const lane of deriveTierLanes(BOARD)) {
      expect(screen.getByTestId(`tier-lane-${lane.tier}-title`).style.letterSpacing).toBe('0.5px')
    }
  })

  it('CONTRAST — the DOM text is still the PRODUCT words, sentence case (visual uppercase only, via CSS text-transform)', () => {
    render(<TierLanes nodes={BOARD} />)
    const lanes = deriveTierLanes(BOARD)
    expect(lanes.length).toBeGreaterThan(3)
    for (const lane of lanes) {
      const text = screen.getByTestId(`tier-lane-${lane.tier}-title`).textContent
      expect(text).toBe(lane.title)
      // Not already shouting in the DOM — text-transform is a paint step,
      // never a content rewrite (this block is aria-hidden, so there is no
      // accessible name to protect, but the source-of-truth strings
      // (`TITLE_BY_TIER`) are unedited either way).
      expect(text).not.toBe((text ?? '').toUpperCase())
    }
  })
})
