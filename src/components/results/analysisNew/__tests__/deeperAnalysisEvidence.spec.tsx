/**
 * Analysis (New) — "Deeper analysis and evidence": the honesty contract.
 *
 * This section's job is not to display more. It is to be straight about what
 * the analysis can and cannot support. Three of those obligations were being
 * missed, and each is pinned here by IDENTITY (producer code, exact constant),
 * never by a value predicate another row could satisfy (CLAUDE.md trap 19).
 *
 *   1. ENGINE CRITIQUES REACHED NO SCREEN ON THIS TAB. `ResultsBody` mounts
 *      `CritiqueWarningStrip` over `confidence.humanisedCritiques` in its
 *      UNCONDITIONAL current-view group. `OutputsDock` branches on
 *      `effectiveActiveTab`, so the `analysisNew` branch never mounts
 *      `ResultsBody` — and a sweep for `humanisedCritiques` under
 *      `analysisNew/` returned zero (contrast control in the same sweep:
 *      `inferenceWarnings`, present). The product knew something and did not
 *      say it.
 *
 *   2. THE ADAPTER RENDERED THE PRODUCER'S RAW `message`, past the guard
 *      written to stop exactly that. `__tests__/no-message-render.spec.ts`
 *      scans `/\.tsx$/` under `src/components/results/`;
 *      `buildAnalysisNewViewModel.ts` is a `.ts` file, and what it produced was
 *      rendered as `{r.value}`, which the brace scanner cannot recognise as a
 *      message read either. Both halves intact, the leak between them.
 *
 *   3. THE STANDING METHOD DISCLOSURE WAS ABSENT. The existing tab states it on
 *      every run; without it this panel is quietly more confident than the
 *      analysis warrants.
 *
 * ⚠ EXPECTATIONS ARE DERIVED FROM THE PRODUCER-SIDE AUTHORITY, NOT RESTATED
 * (trap 13c). The humanised sentence is compared against
 * `humaniseInferenceWarningTitle` called on the same entry, and the disclosure
 * against the exported constant — so a test that agrees with a wrong template
 * is not possible here. What IS asserted independently is the negative: no raw
 * message, no internal node id.
 */

import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { DeeperAnalysis } from '../sections/DeeperAnalysis'
import { SCIENCE_LIMITATIONS_DISCLOSURE } from '../../analysisMethodCopy'
import { humaniseInferenceWarningTitle } from '../../utils/humaniseInferenceWarning'
import type { ConfidenceSectionData, InferenceWarning } from '../../types'
import { genuineDecision, makeData, manyFragileEdges } from './analysisNewFixtures'

const build = (data: ReturnType<typeof makeData>, over: Record<string, unknown> = {}) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'run_x',
    ...over,
  })

const deeperOf = (data: ReturnType<typeof makeData>, over: Record<string, unknown> = {}) =>
  build(data, over).deeper

/** Render the section exactly as `AnalysisNewTabBody` mounts it. */
const renderDeeper = (data: ReturnType<typeof makeData>, over: Record<string, unknown> = {}) =>
  render(<DeeperAnalysis deeper={deeperOf(data, over)} />)

// ── The real capture. `manyFragileEdges()` carries the three inference
//    warnings measured on deployed staging `a9fc1564`, including the raw node
//    ids that were reaching the screen. Bound as literals because the LEAK is
//    literal — a structural assertion would pass again the moment a different
//    id leaked.
const LEAKED_NODE_ID = 'e4ec3415'
const LEAKED_RAW_MESSAGE = "No observed value provided for root node 'e4ec3415'; defaulted to 0.0."

/** A run carrying one WARNING-severity engine critique with CEE-owned copy. */
function withCritique(
  over: Partial<NonNullable<ConfidenceSectionData['humanisedCritiques']>[number]> = {},
) {
  return makeData({
    confidence: {
      evidenceGapsAssessed: true,
      humanisedCritiques: [
        {
          code: 'LOW_EFFECTIVE_SAMPLES',
          title: 'ignored by the strip',
          description: 'ignored by the strip',
          displayText: 'Fewer usable simulations than requested, so the ordering is less settled.',
          suggestion: 'Simplify the model or rerun.',
          ...over,
        },
      ],
    } as Partial<ConfidenceSectionData>,
  })
}

// ═══════════════════════════════════════════════════════════════════════════
describe('an engine critique reaches the screen on this tab', () => {
  it('PRECONDITION — the fixture carries one, and its twin provably carries none', () => {
    // Without this the visibility case below could pass on an empty strip that
    // renders nothing for the right reason and nothing for the wrong one
    // (trap 13 — an absence probe with no positive control).
    expect(deeperOf(withCritique()).critiques).toHaveLength(1)
    expect(deeperOf(genuineDecision()).critiques).toHaveLength(0)
  })

  it('carries it into the view model BY PRODUCER CODE, not by position', () => {
    const [entry] = deeperOf(withCritique()).critiques
    expect(entry.code).toBe('LOW_EFFECTIVE_SAMPLES')
  })

  it('renders it WITHOUT the reader opening anything', () => {
    // The whole defect, in one assertion. On the existing tab this set is
    // mounted in an unconditional group; a chevron between the reader and an
    // engine warning is a demotion, and a demotion nobody opens is a deletion.
    renderDeeper(withCritique())
    const entry = screen.getByTestId('critique-warning-strip-entry')
    // Bound by the producer's own identity anchor. A text match would pass on
    // any other row that happened to carry the same sentence.
    expect(entry).toHaveAttribute('data-critique-code', 'LOW_EFFECTIVE_SAMPLES')
  })

  it('renders NO strip on a run the engine raised nothing about', () => {
    // The discriminating twin: proves the case above is reading the critique
    // set and not a container that is always present.
    renderDeeper(genuineDecision())
    expect(screen.queryByTestId('critique-warning-strip')).toBeNull()
  })

  it("carries the producer's own remediation, and invents none where there is none", () => {
    renderDeeper(withCritique())
    expect(screen.getByText('Simplify the model or rerun.')).toBeInTheDocument()
  })

  it('invents no remediation for a critique the producer sent none for', () => {
    const vm = deeperOf(withCritique({ suggestion: undefined }))
    expect(vm.critiques[0].suggestion).toBeUndefined()
  })

  it('honours humaniseCritique\'s exclude verdict — a null displayText renders nothing', () => {
    // `displayText: null` is the producer-side "this code has no clean copy"
    // verdict. Fail closed: no fabricated sentence from `code` alone.
    const vm = deeperOf(withCritique({ displayText: null }))
    expect(vm.critiques).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('an inference warning is humanised by code — never echoed raw', () => {
  it('CONTRAST CONTROL — the warning IS present, so the absence below is not blindness', () => {
    // Trap 13e: an absence claim needs a same-family symbol that reads
    // non-zero in the same probe. The producer's code is the row label, so the
    // entry provably reached the section.
    const group = deeperOf(manyFragileEdges()).groups.find(
      (g) => g.title === 'Model gaps the analysis worked around',
    )
    expect(group, 'the warnings were dropped, not demoted').toBeTruthy()
    expect(group!.rows.map((r) => r.label)).toContain('ROOT_NODE_DEFAULT_VALUE')
  })

  it('the internal node id reaches NO part of the deeper slice', () => {
    expect(JSON.stringify(deeperOf(manyFragileEdges()))).not.toContain(LEAKED_NODE_ID)
  })

  it('the raw producer message reaches NO part of the deeper slice', () => {
    expect(JSON.stringify(deeperOf(manyFragileEdges()))).not.toContain(LEAKED_RAW_MESSAGE)
  })

  it('the internal node id reaches no part of the rendered DOM either', () => {
    const { container } = renderDeeper(manyFragileEdges())
    fireEvent.click(screen.getByTestId('analysis-new-deeper-toggle'))
    expect(container.textContent ?? '').not.toContain(LEAKED_NODE_ID)
  })

  it('renders EVERY entry the engine raised, including two under one code', () => {
    // The producer repeats a code when it raises the same condition about two
    // different nodes, as the `a9fc1564` capture did. Counted in the DOM, not
    // in the view model — the view model already held all three, and the
    // question here is whether all three reach a reader.
    //
    // ⚠ THIS CASE IS AN INVARIANT, NOT A REGRESSION PIN, AND SAYING SO IS THE
    // HONEST LABEL. Reverting the row key to `r.label` (the duplicate-key
    // shape) leaves it GREEN — measured, a surviving mutant. React declines to
    // guarantee that behaviour, so the unique key stays; but no dropped row was
    // witnessed, and a comment claiming one would be a hunch wearing a
    // measurement's clothes.
    renderDeeper(manyFragileEdges())
    fireEvent.click(screen.getByTestId('analysis-new-deeper-toggle'))
    const labels = Array.from(screen.getAllByRole('term')).map((n) => n.textContent)
    expect(labels.filter((l) => l === 'ROOT_NODE_DEFAULT_VALUE')).toHaveLength(2)
  })

  it('the value IS the shared humaniser\'s output for that same entry', () => {
    // Derived from the producer-side authority rather than restated, so this
    // cannot certify a sentence this spec invented.
    const warning = (manyFragileEdges().confidence.inferenceWarnings ?? []).find(
      (w) => w.affected_nodes?.[0] === LEAKED_NODE_ID,
    )
    expect(warning, 'fixture must carry the captured warning').toBeTruthy()

    const group = deeperOf(manyFragileEdges()).groups.find(
      (g) => g.title === 'Model gaps the analysis worked around',
    )!
    const rendered = group.rows.filter((r) => r.label === 'ROOT_NODE_DEFAULT_VALUE')
    expect(rendered.length).toBeGreaterThan(0)
    for (const r of rendered) {
      expect(r.value).toBe(humaniseInferenceWarningTitle(warning as InferenceWarning))
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('severity is not flattened — the split the existing tab makes', () => {
  const warningSeverity: InferenceWarning = {
    code: 'ROOT_NODE_DEFAULT_VALUE',
    affected_nodes: ['n_alpha'],
    message: "No observed value provided for root node 'n_alpha'; defaulted to 0.0.",
    severity: 'warning',
  }
  // Byte-identical apart from the one field under test, so the pair discriminates
  // on SEVERITY and on nothing else.
  const noSeverity: InferenceWarning = { ...warningSeverity, severity: undefined }

  const withWarnings = (warnings: InferenceWarning[]) =>
    makeData({
      confidence: { evidenceGapsAssessed: true, inferenceWarnings: warnings } as Partial<ConfidenceSectionData>,
    })

  it('a warning-severity entry goes to the always-visible caveats, NOT the collapsed group', () => {
    const vm = deeperOf(withWarnings([warningSeverity]))
    expect(vm.caveats.map((w) => w.code)).toEqual(['ROOT_NODE_DEFAULT_VALUE'])
    expect(vm.groups.find((g) => g.title === 'Model gaps the analysis worked around')).toBeUndefined()
  })

  it('its severity-less twin goes to the collapsed group, NOT the caveats', () => {
    // The other direction. One case alone shows the set is non-empty; the pair
    // shows the predicate is discriminating on the field it claims to.
    const vm = deeperOf(withWarnings([noSeverity]))
    expect(vm.caveats).toHaveLength(0)
    expect(
      vm.groups.find((g) => g.title === 'Model gaps the analysis worked around')!.rows,
    ).toHaveLength(1)
  })

  it('renders the warning-severity entry before any click, humanised', () => {
    render(<DeeperAnalysis deeper={deeperOf(withWarnings([warningSeverity]))} />)
    const entry = screen.getByTestId('inference-warning-strip-entry')
    expect(entry).toHaveAttribute('data-warning-code', 'ROOT_NODE_DEFAULT_VALUE')
    expect(entry.textContent ?? '').not.toContain('n_alpha')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('the standing method disclosure', () => {
  it('is stated, and is the shared constant rather than a second wording', () => {
    renderDeeper(genuineDecision())
    fireEvent.click(screen.getByTestId('analysis-new-deeper-toggle'))
    expect(screen.getByTestId('analysis-new-deeper-science-limitations')).toHaveTextContent(
      SCIENCE_LIMITATIONS_DISCLOSURE,
    )
  })

  it('exists exactly once as a literal in the tree — both tabs import it', () => {
    // ⚠ THE MIRROR CHECK, and it is the point of extracting the sentence at
    // all. Two spellings of one disclosure is the defect; a constant only
    // prevents it while nobody types the words again. The only literal
    // occurrence permitted is the constant's own definition.
    const SRC = resolve(__dirname, '../../../..')
    const NEEDLE = 'simplified structural causal model'
    const OWNER = 'components/results/analysisMethodCopy.ts'

    const hits: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(ts|tsx)$/.test(entry) && readFileSync(full, 'utf-8').includes(NEEDLE)) {
          hits.push(full.slice(SRC.length + 1))
        }
      }
    }
    walk(SRC)

    // Positive control: the scanner can see the sentence at all. A walker that
    // silently found nothing would certify a clean tree (trap 13).
    expect(hits, 'the scanner found no occurrence at all — it is blind').toContain(OWNER)
    // Specs may quote it; source may not.
    const inSource = hits.filter((h) => !/__tests__|\.spec\.|\.test\./.test(h))
    expect(inSource).toEqual([OWNER])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('readiness signals are the producer\'s numbers, and absence is not zero', () => {
  const withDims = (dims: { evidence: number; robustness: number; clarity: number } | undefined) =>
    makeData({
      recommendation: { ...genuineDecision().recommendation, coachingReadinessDimensions: dims },
      confidence: { evidenceGapsAssessed: true },
    })

  it('renders each dimension under the existing tab\'s label', () => {
    // `clarity` is shown as "Framing" on the existing tab. A second name for
    // one dimension across two surfaces is the defect, not the fix.
    const group = deeperOf(withDims({ evidence: 0.72, robustness: 0.4, clarity: 0.5 })).groups.find(
      (g) => g.title === 'Readiness signals',
    )
    expect(group!.rows).toEqual([
      { label: 'Evidence', value: '72%' },
      { label: 'Robustness', value: '40%' },
      { label: 'Framing', value: '50%' },
    ])
  })

  it('renders NO group when the producer sent no dimensions', () => {
    expect(
      deeperOf(withDims(undefined)).groups.find((g) => g.title === 'Readiness signals'),
    ).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('the section never renders an affordance that lies', () => {
  it('renders nothing at all pre-run', () => {
    const { container } = render(
      <DeeperAnalysis deeper={deeperOf(genuineDecision(), { isPreRun: true })} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the strip but NO expander when there is a warning and nothing to inspect', () => {
    // An expander over an empty region promises content it does not have. The
    // warning still has to reach the reader, so the two decisions are separate.
    const vm = deeperOf(withCritique())
    render(<DeeperAnalysis deeper={{ ...vm, groups: [] }} />)
    expect(screen.getByTestId('critique-warning-strip')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-deeper-toggle')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('the dock floor — long unbreakable tokens cannot widen the panel', () => {
  it('wraps both the label and the value of every inspect row', () => {
    // ⚠ A STRUCTURAL CLAIM, NOT A LAYOUT ONE. jsdom cannot prove visibility or
    // overflow (CLAUDE.md trap 3); what it can prove is that the wrap contract
    // is present on the cells that carry unbreakable producer tokens — the run
    // hash and node labels. A real-browser check is what would settle the
    // rendered width, and this does not claim to be one.
    renderDeeper(genuineDecision(), { responseHash: 'a'.repeat(64) })
    fireEvent.click(screen.getByTestId('analysis-new-deeper-toggle'))
    const hash = screen.getByText('a'.repeat(64))
    expect(hash.className).toContain('break-words')
  })
})
