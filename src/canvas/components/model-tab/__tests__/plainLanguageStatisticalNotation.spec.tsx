/**
 * PLAIN-LANGUAGE STATISTICAL NOTATION — both directions, bound to the ONE gate.
 *
 * ## What this pins
 *
 * A UX gate on the frozen deployed build (UI `2b6ec553`), fresh guest, expert
 * mode OFF, read `(normalised)` ×5, `Prior` ×2 and `Δ` ×13 off the Model
 * surface. Three render sites, all UI copy, all sitting OUTSIDE the expert gate
 * their own components already consumed.
 *
 * ## Why every case is a PAIR
 *
 * The inverse harm is the dangerous one. A test that only asserts "the default
 * does not say `Δ`" is satisfied by a fix that DELETES the quantity — which
 * would leave a bare number whose meaning depends on the term just removed, and
 * that damages the scientific credibility the surface exists to carry. So every
 * leak gets expert-OFF **and** expert-ON, and the ON case asserts the technical
 * term is still there. Neither direction alone is evidence.
 *
 * ## Binding
 *
 * Assertions bind by `data-testid` IDENTITY, never by a value predicate another
 * element could satisfy — `(normalised)` appears on several rows at once, so
 * `getByText` would silently pass on a sibling. `describe` blocks drive the REAL
 * `DetailToggleContext` — the same provider `ModelTabBody` supplies — rather than
 * a local stub, so a fix that invents a second gate cannot make these pass.
 *
 * ⚠ NARROWED 2026-09-11 (v1 Model-stack removal). Three of the original five
 * render sites — two in `FactorsSection`, one in `OptionsSection` — were deleted
 * with the v1 stack, along with `ModelTabHeader`. Their cases are gone because
 * their SUBJECTS are gone, not because the rule relaxed: the derived scan in
 * section 7 still bans the tokens across the whole surviving directory, so a
 * reintroduction anywhere in `model-tab/` REDs without needing a named case.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Node, Edge } from '@xyflow/react'
import { ContestedEdgeCard } from '../ContestedEdgeCard'
import { DetailToggleContext } from '../DetailToggleContext'
import {
  normalisedScaleSuffix,
  priorRangeLabel,
  estimateGapText,
} from '../statisticalNotation'
import type { ValidationMetadata } from '../../../domain/validation'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const mockUpdateNode = vi.fn()
const mockGraph: { nodes: unknown[]; edges: unknown[] } = { nodes: [], edges: [] }

vi.mock('../../../store', () => {
  const useCanvasStore = Object.assign(
    vi.fn((selector: (s: unknown) => unknown) => selector({ updateNode: mockUpdateNode })),
    { getState: () => ({ ...mockGraph, updateNode: mockUpdateNode }) },
  )
  return { useCanvasStore }
})

vi.mock('../../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../../utils/evidenceCoverage', () => ({
  NON_EVIDENCE_PROVENANCE: ['assumption', 'template', 'ai-suggested'],
}))

vi.mock('../../../ui/inspector/SignedStrengthSlider', () => ({
  SignedStrengthSlider: ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <input type="range" data-testid="mock-strength-slider" defaultValue={value} onChange={e => onChange(parseFloat(e.target.value))} />
  ),
}))

const mockStorage = new Map<string, string>()
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => mockStorage.get(k) ?? null,
  setItem: (k: string, v: string) => mockStorage.set(k, v),
  removeItem: (k: string) => mockStorage.delete(k),
  clear: () => mockStorage.clear(),
  length: 0,
  key: () => null,
})

// ── Fixtures ────────────────────────────────────────────────────────────────

function withDetail(showDetail: boolean, ui: React.ReactNode) {
  return render(
    <DetailToggleContext.Provider value={{ showDetail }}>{ui}</DetailToggleContext.Provider>,
  )
}

/*
 * ⚠ THREE FIXTURES REMOVED 2026-09-11 — `normalisedFactor`,
 * `externalFactorWithPrior` and `optionWithNormalisedIntervention`. They existed
 * only to drive `FactorsSection` and `OptionsSection`, both deleted with the v1
 * Model stack. They are not retained as dead helpers: an unused fixture is the
 * next session's false map of what this file still covers.
 */
function contestedFixture() {
  const validation: ValidationMetadata = {
    status: 'contested',
    contested_reasons: ['strength_band_change'],
    pass1: { strength_mean: 0.6, strength_std: 0.08, exists_probability: 0.7 },
    pass2: {
      strength_mean: 0.35, strength_std: 0.12, exists_probability: 0.7,
      reasoning: 'Typical B2B ROI shows moderate conversion effects',
      basis: 'domain_prior', needs_user_input: false,
    },
    max_divergence: 0.5, distance_to_goal: 1, evoi_rank: null, evoi_impact: null,
    was_shown: false, user_action: 'pending', resolved_value: null, resolved_by: 'default',
  }
  const edge: Edge = {
    id: 'e1', source: 'a', target: 'b',
    data: { weight: 0.6, direction: 'positive', beliefExists: 0.7, provenance: 'assumption', validation },
  }
  const nodes: Node[] = [
    { id: 'a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Ad spend' } },
    { id: 'b', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Revenue' } },
  ]
  // |0.6 − 0.35| = 0.25 — the exact magnitude the copy must carry, both ways.
  return { edge, nodes, validation, expected: '0.25' }
}

// ── 1. The wording table itself ─────────────────────────────────────────────

describe('the wording table says the same thing in two registers', () => {
  it('never returns an empty or bare-number form in either register', () => {
    // A "plain English" fix that returns '' would satisfy every OFF-direction
    // assertion below. Pin that the default is SUBSTANTIVE, not deleted.
    expect(normalisedScaleSuffix(false).trim().length).toBeGreaterThan(3)
    expect(priorRangeLabel(false).trim().length).toBeGreaterThan(3)
    expect(estimateGapText(0.25, false)).toMatch(/0\.25/)
    expect(estimateGapText(0.25, false).replace('0.25', '').trim().length).toBeGreaterThan(3)
  })

  it('reserves the technical term for expert mode, and keeps it there', () => {
    expect(normalisedScaleSuffix(true)).toBe('(normalised)')
    expect(priorRangeLabel(true)).toBe('Prior')
    expect(estimateGapText(0.25, true)).toBe('Δ 0.25')
  })

  it('the default register carries NONE of the three technical tokens', () => {
    for (const plain of [normalisedScaleSuffix(false), priorRangeLabel(false), estimateGapText(0.25, false)]) {
      expect(plain).not.toMatch(/normalised/i)
      expect(plain).not.toMatch(/Δ/)
      expect(plain).not.toMatch(/\bPrior\b/)
    }
  })

  it('the gap text asserts no direction — the producer is a signed-free magnitude', () => {
    // ContestedEdgeCard.tsx:267 is Math.abs(pass1Mean - pass2Mean). Copy that
    // said "increased by"/"fell by" would invent information (trap 13c).
    expect(estimateGapText(0.25, false)).not.toMatch(/increase|decrease|higher|lower|rose|fell|up|down/i)
  })
})

// ── 5. ContestedEdgeCard — the Δ glyph ──────────────────────────────────────

describe('ContestedEdgeCard: the estimate gap is described in words by default', () => {
  it('expert OFF — the card carries the magnitude in words and NO Δ glyph', () => {
    const { edge, nodes, validation, expected } = contestedFixture()
    withDetail(false, <ContestedEdgeCard edge={edge} nodes={nodes} validation={validation} isFragile={false} onResolve={vi.fn()} />)
    const el = screen.getByTestId('contested-estimate-gap-e1')
    expect(el).toHaveTextContent(estimateGapText(0.25, false))
    expect(el).toHaveTextContent(expected)
    expect(el.textContent).not.toMatch(/Δ/)
  })

  it('expert ON — the Δ glyph is RESTORED with the same magnitude', () => {
    const { edge, nodes, validation, expected } = contestedFixture()
    withDetail(true, <ContestedEdgeCard edge={edge} nodes={nodes} validation={validation} isFragile={false} onResolve={vi.fn()} />)
    const el = screen.getByTestId('contested-estimate-gap-e1')
    expect(el).toHaveTextContent('Δ')
    expect(el).toHaveTextContent(expected)
  })

  it('the magnitude is never dropped — it is present in BOTH registers', () => {
    const { edge, nodes, validation, expected } = contestedFixture()
    const { unmount } = withDetail(false, <ContestedEdgeCard edge={edge} nodes={nodes} validation={validation} isFragile={false} onResolve={vi.fn()} />)
    expect(screen.getByTestId('contested-estimate-gap-e1').textContent).toContain(expected)
    unmount()
    withDetail(true, <ContestedEdgeCard edge={edge} nodes={nodes} validation={validation} isFragile={false} onResolve={vi.fn()} />)
    expect(screen.getByTestId('contested-estimate-gap-e1').textContent).toContain(expected)
  })
})

// ── 6. THE MOUNT PATH — bind to the gate that actually ships ────────────────

describe('the gate these sections read is the one the deployed flag feeds', () => {
  // ⚠ NARROWED 2026-09-11. This block also rendered `ModelTabHeader` with a
  // context `Probe` to prove it forwarded `showDetail` verbatim. `ModelTabHeader`
  // was deleted with the v1 Model stack, and `ModelTabBody` now provides
  // `DetailToggleContext` itself. The remaining case is the one that still
  // guards a live path: the binding from the persisted flag to that provider.
  it('ModelTabBody binds that prop to expertMode — fails loud if the flag path moves', () => {
    // The estate has twice shipped a feature dark because tests targeted a
    // component the deployed posture does not render. This asserts the LINK
    // between the persisted `olumi.expertMode` state and the context above it,
    // so moving the flag REDs here instead of silently un-gating the copy.
    const here = dirname(fileURLToPath(import.meta.url))
    const body = readFileSync(join(here, '..', '..', 'ModelTabBody.tsx'), 'utf8')

    // ⚠ PATTERN UPDATED 2026-09-11, and the SHAPE of the binding changed, not the
    // fact of it. It used to match the JSX attribute `showDetail={expertMode ??
    // false}` that `ModelTabBody` passed to `ModelTabHeader`, which was the
    // provider. `ModelTabHeader` was deleted with the v1 Model stack and
    // `ModelTabBody` now supplies `DetailToggleContext` directly, so the same
    // link is expressed as the provider's value.
    expect(
      body,
      '\nThe persisted expert flag no longer reaches DetailToggleContext.\n' +
        'Moving that link silently un-gates the technical notation this file bans.\n',
    ).toMatch(/<DetailToggleContext\.Provider\s+value=\{\{\s*showDetail:\s*expertMode\s*\?\?\s*false\s*\}\}/)

    // Precondition, in-test: the file really was read. A path slip would make the
    // regex above fail for the wrong reason, or an empty read pass a negation.
    expect(body.length, 'ModelTabBody.tsx read as empty — this assertion is void').toBeGreaterThan(1000)
  })
})

// ── 7. DERIVED GUARD — no ungated technical notation left in model-tab ──────

describe('the notation lives in ONE place, derived rather than mirrored', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const DIR = join(here, '..')
  const OWNER = 'statisticalNotation.ts'

  function sourceFiles(): string[] {
    return readdirSync(DIR, { withFileTypes: true })
      .filter(e => e.isFile() && /\.tsx?$/.test(e.name))
      .map(e => join(DIR, e.name))
  }

  /** Strip block/line comments so this file's own prose cannot trip the scan. */
  function codeOnly(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  }

  it('POSITIVE CONTROL: the scan detects the tokens it bans', () => {
    const sample = 'const a = "(normalised)"\nconst b = <span>Δ {x}</span>\n'
    expect(codeOnly(sample)).toMatch(/\(normalised\)/)
    expect(codeOnly(sample)).toMatch(/Δ/)
  })

  it('CONTRAST CONTROL: it does not fire on the plain forms', () => {
    const honest = `const a = "${normalisedScaleSuffix(false)}"\nconst b = "${estimateGapText(0.25, false)}"\n`
    expect(codeOnly(honest)).not.toMatch(/\(normalised\)/)
    expect(codeOnly(honest)).not.toMatch(/Δ/)
  })

  it('the corpus is non-empty and contains the components under test, BY NAME', () => {
    // An empty or mis-filtered directory would make the absence below vacuous.
    const names = sourceFiles().map(f => basename(f))
    expect(names.length).toBeGreaterThan(5)
    // ⚠ NAMES UPDATED 2026-09-11. This list used to name `FactorsSection.tsx`
    // and `OptionsSection.tsx`; both were deleted with the v1 Model stack. The
    // surviving named anchors are the card still under test and the wording
    // table that owns the tokens — the point of the case is unchanged: the scan
    // must be looking at a real corpus that contains its own subjects.
    expect(names).toContain('ContestedEdgeCard.tsx')
    expect(names).toContain('ModelHealthSection.tsx')
    expect(names).toContain(OWNER)
  })

  it('`(normalised)` and `Δ` appear in NO model-tab source but the wording table', () => {
    const offenders = sourceFiles()
      .filter(f => basename(f) !== OWNER)
      .filter(f => /\(normalised\)|Δ/.test(codeOnly(readFileSync(f, 'utf8'))))
      .map(f => basename(f))
    expect(offenders).toEqual([])
  })
})
