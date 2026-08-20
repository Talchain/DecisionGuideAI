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
 * `DetailToggleContext` — the same provider `ModelTabHeader` uses — rather than
 * a local stub, so a fix that invents a second gate cannot make these pass.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Node, Edge } from '@xyflow/react'
import { FactorsSection } from '../FactorsSection'
import { OptionsSection } from '../OptionsSection'
import { ContestedEdgeCard } from '../ContestedEdgeCard'
import { ModelTabHeader } from '../ModelTabHeader'
import { DetailToggleContext } from '../DetailToggleContext'
import {
  normalisedScaleSuffix,
  priorRangeLabel,
  estimateGapText,
} from '../statisticalNotation'
import type { ValidationMetadata } from '../../../domain/validation'
import { useContext } from 'react'

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

/** Observable factor whose value exists ONLY in model space (no raw_value/unit). */
function normalisedFactor(id: string, label: string): Node {
  return {
    id, type: 'factor', position: { x: 0, y: 0 },
    data: {
      label, kind: 'factor', category: 'observable',
      observedState: { value: 0.5, source: 'cee_inference' },
    },
  }
}

/** External factor carrying a prior range and NO unit. */
function externalFactorWithPrior(id: string, label: string): Node {
  return {
    id, type: 'factor', position: { x: 0, y: 0 },
    data: {
      label, kind: 'factor', category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      observedState: { source: 'cee_inference' },
    },
  }
}

function optionWithNormalisedIntervention(): { option: Node; factor: Node } {
  const factor: Node = {
    id: 'f1', type: 'factor', position: { x: 0, y: 0 },
    data: { label: 'Ad spend', observedState: { raw_value: 10000, unit: '£', value: 100 } },
  }
  const option: Node = {
    id: 'opt1', type: 'option', position: { x: 0, y: 0 },
    data: { label: 'Campaign', interventions: { f1: 0.8 } },
  }
  return { option, factor }
}

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

// ── 2. FactorsSection — (normalised) on a model-space value ─────────────────

describe('FactorsSection: a model-space value names its scale in words by default', () => {
  it('expert OFF — the suffix is plain English and does NOT say (normalised)', () => {
    withDetail(false, <FactorsSection factorNodes={[normalisedFactor('f1', 'Score')]} />)
    const el = screen.getByTestId('factor-f1-normalised-label')
    expect(el).toHaveTextContent(normalisedScaleSuffix(false))
    expect(el.textContent).not.toMatch(/normalised/i)
  })

  it('expert ON — the technical term is RESTORED, not deleted', () => {
    withDetail(true, <FactorsSection factorNodes={[normalisedFactor('f1', 'Score')]} />)
    expect(screen.getByTestId('factor-f1-normalised-label')).toHaveTextContent('(normalised)')
  })

  it('the quantity itself survives in BOTH registers — the number is never hidden', () => {
    const { unmount } = withDetail(false, <FactorsSection factorNodes={[normalisedFactor('f1', 'Score')]} />)
    expect(screen.getByTestId('factor-f1-value-display')).toBeInTheDocument()
    unmount()
    withDetail(true, <FactorsSection factorNodes={[normalisedFactor('f1', 'Score')]} />)
    expect(screen.getByTestId('factor-f1-value-display')).toBeInTheDocument()
  })
})

// ── 3. FactorsSection — Prior label + prior-range (normalised) ──────────────

describe('FactorsSection: a prior is named as the starting estimate by default', () => {
  it('expert OFF — the label is plain and the word "Prior" is absent from the row', () => {
    withDetail(false, <FactorsSection factorNodes={[externalFactorWithPrior('x1', 'Market growth')]} />)
    const el = screen.getByTestId('factor-x1-prior-label')
    expect(el).toHaveTextContent(priorRangeLabel(false))
    expect(el.textContent).not.toMatch(/\bPrior\b/)
  })

  it('expert ON — "Prior" is RESTORED', () => {
    withDetail(true, <FactorsSection factorNodes={[externalFactorWithPrior('x1', 'Market growth')]} />)
    expect(screen.getByTestId('factor-x1-prior-label')).toHaveTextContent('Prior')
  })

  it('expert OFF — the prior RANGE suffix is plain English', () => {
    withDetail(false, <FactorsSection factorNodes={[externalFactorWithPrior('x1', 'Market growth')]} />)
    const el = screen.getByTestId('factor-x1-normalised-range')
    expect(el).toHaveTextContent(normalisedScaleSuffix(false))
    expect(el.textContent).not.toMatch(/normalised/i)
  })

  it('expert ON — the prior RANGE suffix restores (normalised)', () => {
    withDetail(true, <FactorsSection factorNodes={[externalFactorWithPrior('x1', 'Market growth')]} />)
    expect(screen.getByTestId('factor-x1-normalised-range')).toHaveTextContent('(normalised)')
  })

  it('the range bounds themselves survive in BOTH registers', () => {
    const { unmount } = withDetail(false, <FactorsSection factorNodes={[externalFactorWithPrior('x1', 'M')]} />)
    expect(screen.getByTestId('factor-x1-prior-min-display')).toBeInTheDocument()
    expect(screen.getByTestId('factor-x1-prior-max-display')).toBeInTheDocument()
    unmount()
    withDetail(true, <FactorsSection factorNodes={[externalFactorWithPrior('x1', 'M')]} />)
    expect(screen.getByTestId('factor-x1-prior-min-display')).toBeInTheDocument()
    expect(screen.getByTestId('factor-x1-prior-max-display')).toBeInTheDocument()
  })
})

// ── 4. OptionsSection — normalised intervention target ──────────────────────

describe('OptionsSection: a normalised intervention target names its scale in words', () => {
  it('expert OFF — the target reads plainly and does NOT say (normalised)', () => {
    const { option, factor } = optionWithNormalisedIntervention()
    withDetail(false, <OptionsSection optionNodes={[option]} allNodes={[factor]} />)
    const el = screen.getByTestId('intervention-opt1-f1-display')
    expect(el).toHaveTextContent('0.80')
    expect(el).toHaveTextContent(normalisedScaleSuffix(false))
    expect(el.textContent).not.toMatch(/normalised/i)
  })

  it('expert ON — (normalised) is RESTORED alongside the same number', () => {
    const { option, factor } = optionWithNormalisedIntervention()
    withDetail(true, <OptionsSection optionNodes={[option]} allNodes={[factor]} />)
    const el = screen.getByTestId('intervention-opt1-f1-display')
    expect(el).toHaveTextContent('0.80')
    expect(el).toHaveTextContent('(normalised)')
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
  function Probe() {
    const { showDetail } = useContext(DetailToggleContext)
    return <span data-testid="probe">{String(showDetail)}</span>
  }

  it('ModelTabHeader is the provider, and it forwards its showDetail prop verbatim', () => {
    const { unmount } = render(
      <ModelTabHeader factorCount={1} edgeCount={1} showDetail={false}><Probe /></ModelTabHeader>,
    )
    expect(screen.getByTestId('probe')).toHaveTextContent('false')
    unmount()
    render(<ModelTabHeader factorCount={1} edgeCount={1} showDetail><Probe /></ModelTabHeader>)
    expect(screen.getByTestId('probe')).toHaveTextContent('true')
  })

  it('ModelTabBody binds that prop to expertMode — fails loud if the flag path moves', () => {
    // The estate has twice shipped a feature dark because tests targeted a
    // component the deployed posture does not render. This asserts the LINK
    // between the persisted `olumi.expertMode` state and the context above it,
    // so moving the flag REDs here instead of silently un-gating the copy.
    const here = dirname(fileURLToPath(import.meta.url))
    const body = readFileSync(join(here, '..', '..', 'ModelTabBody.tsx'), 'utf8')
    expect(body).toMatch(/showDetail=\{\s*expertMode\s*\?\?\s*false\s*\}/)
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
    expect(names).toContain('FactorsSection.tsx')
    expect(names).toContain('OptionsSection.tsx')
    expect(names).toContain('ContestedEdgeCard.tsx')
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
