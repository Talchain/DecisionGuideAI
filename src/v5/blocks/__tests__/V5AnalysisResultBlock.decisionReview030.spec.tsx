/**
 * V5AnalysisResultBlock — the 0.30 decision-review prose reaches the DOM
 * (ROADMAP 2.154).
 *
 * ## What this file pins
 *
 * CEE spends a real ~8-9s `gpt-4.1` call per analysis turn producing five
 * prose fields that no other wire block delivers — `narrative_summary`,
 * `robustness_explanation`, `readiness_rationale`, `story_headlines`,
 * `scenario_contexts`. Until this lane the adapter validated a retired shape
 * and returned `null`, so all five were dropped and this card fell to
 * summary-only. These render pins are therefore RENDER-level on purpose: they
 * assert the five fields' actual text in the DOM, not that a function returned
 * an object. A view-model pin alone would not have caught the original defect
 * either, because the original defect was downstream of a green adapter suite.
 *
 * The prose is CEE-authored and has already passed CEE's own egress gate. The
 * UI renders it verbatim and never rewrites it — so every text assertion below
 * quotes the LIVE captured bytes, and there is no UI-authored copy to assert.
 *
 * ## Fixtures
 *
 * The verbatim captured `blocks[0]` of two live `POST /proxy/v5/turn` analysis
 * responses (deployed pair UI 1e320e5c / CEE 76d2e1c), committed unmodified —
 * see each fixture's `__source__`/`__notes__` for the source file and sha256.
 * Pinned to those historical artefacts permanently; never refresh them to
 * track a current payload.
 *
 * ## Scope of the claim (CLAUDE.md trap 3)
 *
 * jsdom proves presence, text content, DOM order and attributes. It does NOT
 * prove visibility, layout, above-the-fold position or that anything is
 * actually legible to a user — no `toBeVisible`-style claim is made here and
 * none should be read in. The live-browser probe of these five fields is
 * DECLARED UNDONE by this lane.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../../canvas/conversation/types'
import r1Block from '../../__tests__/fixtures/live-decision-review-0_30.r1-cee-76d2e1c.json'
import r3Block from '../../__tests__/fixtures/live-decision-review-0_30.r3-cee-76d2e1c.json'

afterEach(cleanup)

/** The fixture's provenance keys (see the JSON's own header), not wire fields. */
const PROVENANCE_KEYS = ['__source__', '__captured_at__', '__captured_against__', '__notes__']

/** Strip the fixture's provenance keys; what remains is the captured block. */
function asBlock(fixture: unknown): V5AnalysisResultBlockType {
  const block = Object.fromEntries(
    Object.entries(fixture as Record<string, unknown>).filter(
      ([k]) => !PROVENANCE_KEYS.includes(k),
    ),
  )
  return block as unknown as V5AnalysisResultBlockType
}

function reviewOf(fixture: unknown): Record<string, unknown> {
  const block = asBlock(fixture) as unknown as { enrichment: Record<string, unknown> }
  return block.enrichment.decision_review as Record<string, unknown>
}

const R1 = asBlock(r1Block)
const R3 = asBlock(r3Block)
const LIVE: Array<[string, V5AnalysisResultBlockType, Record<string, unknown>]> = [
  ['r1', R1, reviewOf(r1Block)],
  ['r3', R3, reviewOf(r3Block)],
]

/** A block whose enrichment carries the given decision_review, nothing else. */
function blockWithReview(decision_review: unknown): V5AnalysisResultBlockType {
  return {
    type: 'analysis_result',
    summary: 'Analysis summary from the parent block.',
    leading_option_id: 'opt_a',
    win_probabilities: { 'Option A': 0.6, 'Option B': 0.4 },
    enrichment: { decision_review, option_comparison: [] },
  } as unknown as V5AnalysisResultBlockType
}

/** A block whose enrichment has NO decision_review key at all. */
function blockWithoutReviewKey(): V5AnalysisResultBlockType {
  return {
    type: 'analysis_result',
    summary: 'Analysis summary from the parent block.',
    leading_option_id: 'opt_a',
    win_probabilities: { 'Option A': 0.6, 'Option B': 0.4 },
    enrichment: { option_comparison: [], robustness: { level: 'stable' } },
  } as unknown as V5AnalysisResultBlockType
}

// ───────────────────────────────────────────────────────────────────────────
// The value win: the five orphaned fields, in the DOM, verbatim
// ───────────────────────────────────────────────────────────────────────────

describe('the five orphaned prose fields reach the DOM on a live payload', () => {
  it.each(LIVE)('%s renders narrative_summary verbatim', (_tag, block, dr) => {
    render(<V5AnalysisResultBlock block={block} />)
    expect(screen.getByTestId('v5-analysis-result-narrative-summary')).toHaveTextContent(
      dr.narrative_summary as string,
    )
  })

  it.each(LIVE)('%s renders readiness_rationale verbatim', (_tag, block, dr) => {
    render(<V5AnalysisResultBlock block={block} />)
    expect(screen.getByTestId('v5-analysis-result-readiness-rationale')).toHaveTextContent(
      dr.readiness_rationale as string,
    )
  })

  it.each(LIVE)(
    '%s renders robustness_explanation — summary, primary_risk and BOTH factor lists',
    (_tag, block, dr) => {
      render(<V5AnalysisResultBlock block={block} />)
      const re = dr.robustness_explanation as Record<string, unknown>
      const section = screen.getByTestId('v5-analysis-result-robustness-explanation')
      expect(within(section).getByTestId('v5-analysis-result-robustness-summary')).toHaveTextContent(
        re.summary as string,
      )
      expect(
        within(section).getByTestId('v5-analysis-result-robustness-primary-risk'),
      ).toHaveTextContent(re.primary_risk as string)

      const stability = within(section).getAllByTestId('v5-analysis-result-stability-factor')
      expect(stability.map((n) => n.textContent)).toEqual(re.stability_factors)
      const fragility = within(section).getAllByTestId('v5-analysis-result-fragility-factor')
      expect(fragility.map((n) => n.textContent)).toEqual(re.fragility_factors)
    },
  )

  it.each(LIVE)(
    '%s renders one story headline per option, in wire order, text verbatim',
    (_tag, block, dr) => {
      render(<V5AnalysisResultBlock block={block} />)
      const wire = dr.story_headlines as Record<string, string>
      const rows = screen.getAllByTestId('v5-analysis-result-story-headline')
      expect(rows).toHaveLength(Object.keys(wire).length)
      Object.entries(wire).forEach(([optionId, headline], i) => {
        expect(rows[i]).toHaveAttribute('data-option-id', optionId)
        expect(rows[i]).toHaveTextContent(headline)
      })
    },
  )

  it.each(LIVE)(
    '%s renders one scenario context per trigger, trigger AND consequence verbatim',
    (_tag, block, dr) => {
      render(<V5AnalysisResultBlock block={block} />)
      const wire = dr.scenario_contexts as Record<string, Record<string, string>>
      const rows = screen.getAllByTestId('v5-analysis-result-scenario-context')
      expect(rows).toHaveLength(Object.keys(wire).length)
      Object.entries(wire).forEach(([id, ctx], i) => {
        expect(rows[i]).toHaveAttribute('data-scenario-id', id)
        expect(rows[i]).toHaveTextContent(ctx.trigger_description)
        expect(rows[i]).toHaveTextContent(ctx.consequence)
      })
    },
  )

  it('a story headline is keyed by option LABEL when the payload resolves one, else the raw id', () => {
    // Identity resolution over the SAME payload (`enrichment.option_comparison`,
    // falling back to `enrichment.decision_brief.options`) — the chain the pills
    // already use. Not a second hand-maintained mapping, and not invented copy.
    render(<V5AnalysisResultBlock block={R1} />)
    const rows = screen.getAllByTestId('v5-analysis-result-story-headline')
    const first = rows.find((n) => n.getAttribute('data-option-id') === 'opt_status_quo')
    expect(first).toBeDefined()
    expect(first!).toHaveTextContent('Keep Current Setup (Status Quo)')
  })

  it('an unresolvable option id falls back to the raw id rather than rendering nothing', () => {
    render(
      <V5AnalysisResultBlock
        block={blockWithReview({
          produced_at: '2026-07-30T00:00:00.000Z',
          story_headlines: { opt_unknown: 'A headline with no matching option entry.' },
        })}
      />,
    )
    const row = screen.getByTestId('v5-analysis-result-story-headline')
    expect(row).toHaveAttribute('data-option-id', 'opt_unknown')
    expect(row).toHaveTextContent('opt_unknown')
    expect(row).toHaveTextContent('A headline with no matching option entry.')
  })

  it.each(LIVE)('%s marks the card as carrying a 0.30 review', (_tag, block) => {
    render(<V5AnalysisResultBlock block={block} />)
    const card = screen.getByTestId('v5-analysis-result')
    expect(card).toHaveAttribute('data-has-decision-review', 'true')
    expect(card).toHaveAttribute('data-decision-review-state', 'v0_30')
  })

  it.each(LIVE)(
    '%s keeps the pre-existing summary and probability pills alongside the new prose',
    (_tag, block) => {
      render(<V5AnalysisResultBlock block={block} />)
      expect(screen.getByTestId('v5-analysis-result-summary')).toHaveTextContent(
        (block as unknown as { summary: string }).summary,
      )
      expect(screen.getByTestId('v5-analysis-result-probabilities')).toBeTruthy()
    },
  )

  it('r1 and r3 render DIFFERENT prose — the render is not reading a constant', () => {
    render(<V5AnalysisResultBlock block={R1} />)
    const a = screen.getByTestId('v5-analysis-result-narrative-summary').textContent
    cleanup()
    render(<V5AnalysisResultBlock block={R3} />)
    const b = screen.getByTestId('v5-analysis-result-narrative-summary').textContent
    expect(a).not.toBe(b)
    expect(a).toBeTruthy()
  })

  it('the six fields that already arrive via enricher blocks are NOT rendered here again', () => {
    // Guard against duplicating what the 11 `decision_review_enricher` wire
    // blocks already deliver. r1's key_assumptions / evidence_enhancements /
    // decision_quality_prompts prose must NOT appear in this card.
    render(<V5AnalysisResultBlock block={R1} />)
    const card = screen.getByTestId('v5-analysis-result')
    const text = card.textContent ?? ''
    const dr = reviewOf(r1Block)
    const assumption = (dr.key_assumptions as string[])[0]
    const prompt = (dr.decision_quality_prompts as Array<Record<string, string>>)[0].question
    const evidence = (
      dr.evidence_enhancements as Record<string, Record<string, string>>
    ).fac_team_size.specific_action
    expect(assumption).toBeTruthy()
    expect(text).not.toContain(assumption)
    expect(text).not.toContain(prompt)
    expect(text).not.toContain(evidence)
    expect(screen.queryByTestId('v5-analysis-result-key-assumptions')).toBeNull()
  })
})

// ───────────────────────────────────────────────────────────────────────────
// The three-state table — absent / degraded(null) / malformed
// ───────────────────────────────────────────────────────────────────────────

describe('the marker mounts on malformed input ONLY (absence arms)', () => {
  it('key ABSENT → no marker, no prose, state=absent', () => {
    render(<V5AnalysisResultBlock block={blockWithoutReviewKey()} />)
    expect(screen.queryByTestId('v5-analysis-result-enrichment-invalid')).toBeNull()
    expect(screen.queryByTestId('v5-analysis-result-decision-review')).toBeNull()
    expect(screen.queryByTestId('v5-analysis-result-narrative-summary')).toBeNull()
    const card = screen.getByTestId('v5-analysis-result')
    expect(card).toHaveAttribute('data-decision-review-state', 'absent')
    expect(card).toHaveAttribute('data-has-decision-review', 'false')
    // The summary card still renders — absence is by design, not a failure.
    expect(screen.getByTestId('v5-analysis-result-summary')).toBeTruthy()
  })

  it('decision_review === null → no marker, no prose, state=degraded', () => {
    render(<V5AnalysisResultBlock block={blockWithReview(null)} />)
    expect(screen.queryByTestId('v5-analysis-result-enrichment-invalid')).toBeNull()
    expect(screen.queryByTestId('v5-analysis-result-decision-review')).toBeNull()
    const card = screen.getByTestId('v5-analysis-result')
    expect(card).toHaveAttribute('data-decision-review-state', 'degraded')
    expect(card).toHaveAttribute('data-has-decision-review', 'false')
    expect(screen.getByTestId('v5-analysis-result-summary')).toBeTruthy()
  })

  it.each(LIVE)('%s populated → no marker', (_tag, block) => {
    render(<V5AnalysisResultBlock block={block} />)
    expect(screen.queryByTestId('v5-analysis-result-enrichment-invalid')).toBeNull()
  })

  // ⭐ POSITIVE CONTROL. A marker that can no longer fire is not a fixed
  // marker, it is a removed one. These prove it still fires — and the suite
  // above proves it no longer fires on the live payload. Both halves are
  // required; either alone is vacuous.
  it.each([
    ['an empty object', {}],
    ['a produced_at of the wrong type', { produced_at: 123, narrative_summary: 'x' }],
    ['prose with no produced_at at all', { narrative_summary: 'x' }],
    ['a half-written M1 payload', { intent: 'selection', blocks: 'not-an-array' }],
    ['a bare string', 'decision_review as a string'],
    ['an array', [] as unknown],
  ])('POSITIVE CONTROL — the marker still fires on %s', (_label, payload) => {
    render(<V5AnalysisResultBlock block={blockWithReview(payload)} />)
    expect(screen.getByTestId('v5-analysis-result-enrichment-invalid')).toBeTruthy()
    expect(screen.getByTestId('v5-analysis-result')).toHaveAttribute(
      'data-decision-review-state',
      'malformed',
    )
    expect(screen.queryByTestId('v5-analysis-result-decision-review')).toBeNull()
  })
})

describe('per-field absence arms — a missing field renders nothing, never a placeholder', () => {
  const AT = '2026-07-30T00:00:00.000Z'

  it('a 0.30 payload with no prose at all renders no prose section and no marker', () => {
    render(
      <V5AnalysisResultBlock
        block={blockWithReview({ produced_at: AT, bias_findings: [], flip_thresholds: [] })}
      />,
    )
    expect(screen.queryByTestId('v5-analysis-result-decision-review')).toBeNull()
    expect(screen.queryByTestId('v5-analysis-result-enrichment-invalid')).toBeNull()
    expect(screen.getByTestId('v5-analysis-result')).toHaveAttribute(
      'data-decision-review-state',
      'v0_30',
    )
  })

  it('narrative_summary only → that node exists and the other four do not', () => {
    render(
      <V5AnalysisResultBlock
        block={blockWithReview({ produced_at: AT, narrative_summary: 'Only this.' })}
      />,
    )
    expect(screen.getByTestId('v5-analysis-result-narrative-summary')).toHaveTextContent(
      'Only this.',
    )
    expect(screen.queryByTestId('v5-analysis-result-readiness-rationale')).toBeNull()
    expect(screen.queryByTestId('v5-analysis-result-robustness-explanation')).toBeNull()
    expect(screen.queryByTestId('v5-analysis-result-story-headline')).toBeNull()
    expect(screen.queryByTestId('v5-analysis-result-scenario-context')).toBeNull()
  })

  it('readiness_rationale only → that node exists and the other four do not', () => {
    render(
      <V5AnalysisResultBlock
        block={blockWithReview({ produced_at: AT, readiness_rationale: 'Ready enough.' })}
      />,
    )
    expect(screen.getByTestId('v5-analysis-result-readiness-rationale')).toHaveTextContent(
      'Ready enough.',
    )
    expect(screen.queryByTestId('v5-analysis-result-narrative-summary')).toBeNull()
    expect(screen.queryByTestId('v5-analysis-result-robustness-explanation')).toBeNull()
  })

  it('a robustness_explanation with only a summary renders no risk line and no factor lists', () => {
    render(
      <V5AnalysisResultBlock
        block={blockWithReview({
          produced_at: AT,
          robustness_explanation: { summary: 'Holds under most variation.' },
        })}
      />,
    )
    expect(screen.getByTestId('v5-analysis-result-robustness-summary')).toHaveTextContent(
      'Holds under most variation.',
    )
    expect(screen.queryByTestId('v5-analysis-result-robustness-primary-risk')).toBeNull()
    expect(screen.queryByTestId('v5-analysis-result-stability-factor')).toBeNull()
    expect(screen.queryByTestId('v5-analysis-result-fragility-factor')).toBeNull()
  })

  it('a scenario context missing its consequence still renders its trigger', () => {
    render(
      <V5AnalysisResultBlock
        block={blockWithReview({
          produced_at: AT,
          scenario_contexts: { s1: { trigger_description: 'If X rises,' } },
        })}
      />,
    )
    const row = screen.getByTestId('v5-analysis-result-scenario-context')
    expect(row).toHaveTextContent('If X rises,')
    expect(row).toHaveAttribute('data-scenario-id', 's1')
  })
})
