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
import {
  V0_30_ENRICHER_OWNED_KEYS,
  V0_30_PROJECTED_KEYS,
} from '../../decisionReviewAdapter'
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

/**
 * A block whose enrichment carries the given decision_review, nothing else.
 *
 * `extraEnrichment` overlays the default `{option_comparison: []}` — used by the
 * R-4 cases, which need to control what the label chain can resolve.
 */
function blockWithReview(
  decision_review: unknown,
  extraEnrichment: Record<string, unknown> = {},
): V5AnalysisResultBlockType {
  return {
    type: 'analysis_result',
    summary: 'Analysis summary from the parent block.',
    leading_option_id: 'opt_a',
    win_probabilities: { 'Option A': 0.6, 'Option B': 0.4 },
    enrichment: { decision_review, option_comparison: [], ...extraEnrichment },
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

  // ─────────────────────────────────────────────────────────────────────────
  // ⭐ R-4 — THE OPTION-LABEL POLICY. A BEHAVIOUR FIX, WITH THE OLD BEHAVIOUR'S
  // PIN REPLACED RATHER THAN DELETED.
  //
  // These two cases used to read "…else the raw id" and "falls back to the raw
  // id RATHER THAN RENDERING NOTHING". That was a real pin on real behaviour:
  // when `option_comparison` missed, this card printed `opt_status_quo` to the
  // user as copy. It can miss — the wire ships a sibling
  // `option_comparison_status` field precisely because the array is not
  // guaranteed — and the live payloads' `story_headlines` keys are exactly the
  // `opt_*` shape `RAW_ID_PATTERN` exists to catch.
  //
  // Both sibling blocks in `src/v5/blocks` already refuse to print an
  // identifier, through the shared `resolveCanvasLabel` policy that returns
  // `null` instead of the id. This card is now the third consumer of that one
  // policy rather than a third policy.
  //
  // The absence assertion below is paired with the presence it denies (trap 13):
  // the labelled case immediately above proves the same harness DOES render a
  // label when one resolves, so "no raw id in the DOM" measures a real absence.
  // ─────────────────────────────────────────────────────────────────────────

  it('a story headline is keyed by option LABEL when the payload resolves one', () => {
    // THE LABELLED CONTROL for the two absence cases below. Identity resolution
    // over the SAME payload (`enrichment.option_comparison`, falling back to
    // `enrichment.decision_brief.options`, then to the canvas store) — the chain
    // the pills already use. Not a second hand-maintained mapping, and not
    // invented copy.
    render(<V5AnalysisResultBlock block={R1} />)
    const rows = screen.getAllByTestId('v5-analysis-result-story-headline')
    const first = rows.find((n) => n.getAttribute('data-option-id') === 'opt_status_quo')
    expect(first).toBeDefined()
    expect(first!).toHaveTextContent('Keep Current Setup (Status Quo)')
  })

  it('⭐ an unresolvable option id renders NO raw id — the headline stands alone', () => {
    render(
      <V5AnalysisResultBlock
        block={blockWithReview({
          produced_at: '2026-07-30T00:00:00.000Z',
          story_headlines: { opt_unknown: 'A headline with no matching option entry.' },
        })}
      />,
    )
    const row = screen.getByTestId('v5-analysis-result-story-headline')
    // The id survives as the MACHINE reference — the use the field-coverage
    // allowlist permits, and what the two sibling blocks also keep.
    expect(row).toHaveAttribute('data-option-id', 'opt_unknown')
    // …and nowhere in the user-visible text.
    expect(row.textContent).not.toContain('opt_unknown')
    // Nothing the producer paid for is dropped: the headline still renders. This
    // is why the row is kept rather than omitted (the `V5FlipAnalysisBlock`
    // reason), while the unnameable LABEL is omitted (the `V5ExplanationBlock`
    // reason). No substitute copy is invented either.
    expect(row).toHaveTextContent('A headline with no matching option entry.')
    expect(row.textContent).not.toContain('—')
  })

  it('⭐ rejects a resolved label that is ITSELF a raw id (RAW_ID_PATTERN)', () => {
    // The leak one hop upstream. Upstream sometimes seeds an option's label from
    // its own id; without the pattern guard inside `resolveCanvasLabel` the raw
    // id would arrive as a "resolved label" and print anyway. This is the half of
    // the shared policy a bespoke `map.get(id) ?? id` cannot express at all.
    render(
      <V5AnalysisResultBlock
        block={blockWithReview(
          {
            produced_at: '2026-07-30T00:00:00.000Z',
            story_headlines: { opt_status_quo: 'A headline whose option is labelled by its id.' },
          },
          {
            option_comparison: [
              { id: 'opt_status_quo', option_label: 'opt_status_quo', win_probability: 0.5 },
            ],
          },
        )}
      />,
    )
    const row = screen.getByTestId('v5-analysis-result-story-headline')
    expect(row).toHaveAttribute('data-option-id', 'opt_status_quo')
    expect(row.textContent).not.toContain('opt_status_quo')
    expect(row).toHaveTextContent('A headline whose option is labelled by its id.')
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

  it('the live payload does not re-render the enricher-owned prose it carries', () => {
    // The real-bytes half. r1's own key_assumptions / decision_quality_prompts /
    // evidence_enhancements text must not appear in this card. Necessary but
    // NOT sufficient — see the structural block below for why.
    render(<V5AnalysisResultBlock block={R1} />)
    const text = screen.getByTestId('v5-analysis-result').textContent ?? ''
    const dr = reviewOf(r1Block)
    const assumption = (dr.key_assumptions as string[])[0]
    const prompt = (dr.decision_quality_prompts as Array<Record<string, string>>)[0].question
    const evidence = (
      dr.evidence_enhancements as Record<string, Record<string, string>>
    ).fac_team_size.specific_action
    for (const s of [assumption, prompt, evidence]) {
      expect(s).toBeTruthy()
      expect(text).not.toContain(s)
    }
  })
})

describe('prose wrapping — the producer’s own line breaks survive, long tokens wrap', () => {
  const AT = '2026-07-30T00:00:00.000Z'

  /**
   * ⚠ SCOPE. These assert the emitted CLASSES. jsdom does not lay out or paint,
   * so this proves the component ASKS for pre-wrap and break-words — NOT that
   * paragraph breaks visibly survive or that a long token actually wraps. That
   * needs the live-browser probe, which this lane declares undone.
   */
  const EVERY_PROSE_TESTID = [
    'v5-analysis-result-narrative-summary',
    'v5-analysis-result-readiness-rationale',
    'v5-analysis-result-robustness-summary',
    'v5-analysis-result-robustness-primary-risk',
    'v5-analysis-result-stability-factor',
    'v5-analysis-result-fragility-factor',
    'v5-analysis-result-story-headline',
    'v5-analysis-result-scenario-context',
  ]

  function fullPayload() {
    return {
      produced_at: AT,
      narrative_summary: 'Line one.\nLine two after a break.',
      readiness_rationale: 'Ready.\n\nAfter a paragraph break.',
      robustness_explanation: {
        summary: 'Stable.',
        primary_risk: 'A risk.',
        stability_factors: ['Holds.'],
        fragility_factors: ['Could shift.'],
      },
      story_headlines: { opt_a: 'A headline.' },
      scenario_contexts: { s1: { trigger_description: 'If X,', consequence: 'then Y.' } },
    }
  }

  it.each(EVERY_PROSE_TESTID)('%s asks for pre-wrap and break-words', (testid) => {
    render(<V5AnalysisResultBlock block={blockWithReview(fullPayload())} />)
    const nodes = screen.getAllByTestId(testid)
    expect(nodes.length).toBeGreaterThan(0)
    for (const n of nodes) {
      expect(n.className).toContain('whitespace-pre-wrap')
      expect(n.className).toContain('break-words')
    }
  })

  it('the newline characters are preserved in the DOM text, not stripped', () => {
    // Independent of CSS: the text node itself must still contain the breaks.
    // (`toHaveTextContent` normalises whitespace, so this reads textContent
    // directly — the assertion would otherwise pass on flattened text.)
    render(<V5AnalysisResultBlock block={blockWithReview(fullPayload())} />)
    expect(screen.getByTestId('v5-analysis-result-narrative-summary').textContent).toBe(
      'Line one.\nLine two after a break.',
    )
    expect(screen.getByTestId('v5-analysis-result-readiness-rationale').textContent).toBe(
      'Ready.\n\nAfter a paragraph break.',
    )
  })

  it('BYTE-EXACT — a live field’s text node equals the wire string exactly', () => {
    // The render assertions elsewhere in this file use `toHaveTextContent`,
    // which is SUBSTRING + whitespace-normalised. These two are the byte-exact
    // render pins; full byte-exactness per field is pinned at the ADAPTER.
    render(<V5AnalysisResultBlock block={R1} />)
    const dr = reviewOf(r1Block)
    expect(screen.getByTestId('v5-analysis-result-narrative-summary').textContent).toBe(
      dr.narrative_summary as string,
    )
    expect(screen.getByTestId('v5-analysis-result-readiness-rationale').textContent).toBe(
      dr.readiness_rationale as string,
    )
  })
})

// ───────────────────────────────────────────────────────────────────────────
// ⭐ NON-DUPLICATION, STRUCTURALLY — one plant-control per enricher-owned field.
//
// The completion review showed the first version of this guard was only
// STRUCTURALLY PARTIAL: it named three literal strings taken from r1 while its
// title claimed six fields, and `flip_thresholds` / `bias_findings` are `[]` in
// BOTH live fixtures, so they carried no strings to look for. Planting a
// `bias_findings` + `flip_thresholds` render into the new section left the suite
// 33/33 GREEN. A guard that names examples tests the examples.
//
// So this iterates the DERIVED list (`V0_30_ENRICHER_OWNED_KEYS`, which the
// adapter composes into `V0_30_CONTENT_KEYS` so a new field must be classified
// before it can exist), plants a unique sentinel inside each field, and asserts
// the sentinel never reaches the card. The obvious follow-up lane — "also show
// bias_findings here" — must turn this RED rather than ship a duplicate.
// ───────────────────────────────────────────────────────────────────────────

describe('non-duplication — derived, one plant-control per enricher-owned field', () => {
  const AT = '2026-07-30T00:00:00.000Z'
  /** Distinctive enough that an accidental substring match is implausible. */
  const S = (k: string) => `SENTINEL_DO_NOT_RENDER_${k.toUpperCase()}_7Q3X`

  /**
   * A payload placing a sentinel string inside each enricher-owned field, in
   * the shape the live wire uses for that field (array of strings, array of
   * objects, or record of objects).
   */
  const PLANTS: Record<string, () => Record<string, unknown>> = {
    evidence_enhancements: () => ({
      evidence_enhancements: {
        fac_x: {
          specific_action: S('evidence_enhancements'),
          rationale: S('evidence_enhancements'),
          evidence_type: 'internal_data',
          decision_hygiene: S('evidence_enhancements'),
        },
      },
    }),
    flip_thresholds: () => ({
      flip_thresholds: [
        { id: 'ft1', label: S('flip_thresholds'), description: S('flip_thresholds') },
      ],
    }),
    bias_findings: () => ({
      bias_findings: [{ id: 'b1', bias: S('bias_findings'), description: S('bias_findings') }],
    }),
    key_assumptions: () => ({ key_assumptions: [S('key_assumptions')] }),
    decision_quality_prompts: () => ({
      decision_quality_prompts: [
        {
          question: S('decision_quality_prompts'),
          principle: S('decision_quality_prompts'),
          applies_because: S('decision_quality_prompts'),
        },
      ],
    }),
  }

  it('FAIL-LOUD ON DRIFT — every derived enricher-owned key has a plant', () => {
    // Without this, adding a sixth enricher-owned field to the adapter would
    // silently go unguarded — the hand-maintained-mirror defect this whole
    // block exists to avoid.
    expect(Object.keys(PLANTS).sort()).toEqual([...V0_30_ENRICHER_OWNED_KEYS].sort())
    expect(V0_30_ENRICHER_OWNED_KEYS.length).toBe(5)
  })

  it('the two halves are disjoint and neither is empty', () => {
    const overlap = (V0_30_PROJECTED_KEYS as readonly string[]).filter((k) =>
      (V0_30_ENRICHER_OWNED_KEYS as readonly string[]).includes(k),
    )
    expect(overlap).toEqual([])
    expect(V0_30_PROJECTED_KEYS.length).toBe(5)
  })

  it.each(V0_30_ENRICHER_OWNED_KEYS)(
    'PLANT-CONTROL — a sentinel inside %s never reaches this card',
    (key) => {
      render(
        <V5AnalysisResultBlock
          block={blockWithReview({
            produced_at: AT,
            // Real prose so the card DOES render its section — otherwise the
            // absence below would be satisfied by an empty card.
            narrative_summary: 'Genuine narrative that must render.',
            ...PLANTS[key](),
          })}
        />,
      )
      const card = screen.getByTestId('v5-analysis-result')
      expect(screen.getByTestId('v5-analysis-result-narrative-summary')).toBeTruthy()
      expect(card.textContent ?? '').not.toContain(S(key))
    },
  )

  it('⭐ POSITIVE CONTROL — the sentinel scan CAN see a planted string', () => {
    // Trap 13: an absence assertion must first prove it can detect a presence.
    // Same sentinel form, same scan, but planted in a field the card DOES render.
    const sentinel = S('positive_control')
    render(
      <V5AnalysisResultBlock
        block={blockWithReview({ produced_at: AT, narrative_summary: sentinel })}
      />,
    )
    expect(screen.getByTestId('v5-analysis-result').textContent ?? '').toContain(sentinel)
  })

  it('all five planted at once — no mount point and no sentinel for any of them', () => {
    // A second, independent witness: even if a render escaped the text scan
    // (e.g. via an aria-label), it would still need a mount point.
    render(
      <V5AnalysisResultBlock
        block={blockWithReview({
          produced_at: AT,
          narrative_summary: 'Genuine narrative.',
          ...Object.values(PLANTS).reduce((acc, f) => ({ ...acc, ...f() }), {}),
        })}
      />,
    )
    const text = screen.getByTestId('v5-analysis-result').textContent ?? ''
    for (const key of V0_30_ENRICHER_OWNED_KEYS) {
      expect(screen.queryByTestId(`v5-analysis-result-${key.replace(/_/g, '-')}`)).toBeNull()
      expect(text).not.toContain(S(key))
    }
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

// ───────────────────────────────────────────────────────────────────────────
// ⭐ A1 AT THE RENDER — the alarm was INVERTED, proven here on the DOM.
//
// The adversarial review of PR #535 showed the first cut lit the lamp on a
// merely missing `produced_at` (no user content lost) while staying DARK on an
// all-wrong-typed payload whose five fields were therefore all discarded. The
// dark half is the original 2.154 defect returning for the type-error case, so
// it gets render-level proof, not just adapter-level: the marker in the DOM,
// and the five fields absent from it.
// ───────────────────────────────────────────────────────────────────────────

describe('A1 — a wrong-typed payload lights the marker AND renders no prose', () => {
  const AT = '2026-07-30T00:00:00.000Z'

  const WELL_TYPED = {
    narrative_summary: 'Status quo leads.',
    readiness_rationale: 'Readiness is high.',
    robustness_explanation: { summary: 'Stable.' },
    story_headlines: { opt_a: 'A headline.' },
    scenario_contexts: { s1: { trigger_description: 'If X,', consequence: 'then Y.' } },
  }

  /** Every node the five fields would occupy. */
  const PROSE_TESTIDS = [
    'v5-analysis-result-decision-review',
    'v5-analysis-result-narrative-summary',
    'v5-analysis-result-readiness-rationale',
    'v5-analysis-result-robustness-explanation',
    'v5-analysis-result-story-headline',
    'v5-analysis-result-scenario-context',
  ]

  it.each([
    ['narrative_summary as a nested object (the case A1 named)', { narrative_summary: { nested: 'object' } }],
    ['readiness_rationale as a number', { readiness_rationale: 42 }],
    ['robustness_explanation as a string', { robustness_explanation: 'not an object' }],
    ['story_headlines as an array', { story_headlines: ['not a record'] }],
    ['scenario_contexts as a number', { scenario_contexts: 3 }],
  ])(
    'POSITIVE CONTROL — the marker fires on %s, and no prose is rendered',
    (_label, wrong) => {
      render(
        <V5AnalysisResultBlock
          block={blockWithReview({ produced_at: AT, ...WELL_TYPED, ...wrong })}
        />,
      )
      expect(screen.getByTestId('v5-analysis-result-enrichment-invalid')).toBeTruthy()
      expect(screen.getByTestId('v5-analysis-result')).toHaveAttribute(
        'data-decision-review-state',
        'malformed',
      )
      for (const id of PROSE_TESTIDS) expect(screen.queryByTestId(id)).toBeNull()
    },
  )

  it('ALL FIVE wrong-typed → marker fires and all five fields are absent from the DOM', () => {
    render(
      <V5AnalysisResultBlock
        block={blockWithReview({
          produced_at: AT,
          narrative_summary: { nested: 'object' },
          readiness_rationale: 42,
          robustness_explanation: 'not an object',
          story_headlines: ['not a record'],
          scenario_contexts: 3,
        })}
      />,
    )
    expect(screen.getByTestId('v5-analysis-result-enrichment-invalid')).toBeTruthy()
    for (const id of PROSE_TESTIDS) expect(screen.queryByTestId(id)).toBeNull()
    // The summary card is untouched — the alarm does not blank the card.
    expect(screen.getByTestId('v5-analysis-result-summary')).toBeTruthy()
  })

  it('NEGATIVE CONTROL — the same payload WELL-typed renders all five and no marker', () => {
    // Without this, the block above would pass on a component that had simply
    // stopped rendering prose at all.
    render(<V5AnalysisResultBlock block={blockWithReview({ produced_at: AT, ...WELL_TYPED })} />)
    expect(screen.queryByTestId('v5-analysis-result-enrichment-invalid')).toBeNull()
    expect(screen.getByTestId('v5-analysis-result-narrative-summary')).toHaveTextContent(
      'Status quo leads.',
    )
    expect(screen.getByTestId('v5-analysis-result-readiness-rationale')).toHaveTextContent(
      'Readiness is high.',
    )
    expect(screen.getByTestId('v5-analysis-result-robustness-summary')).toHaveTextContent(
      'Stable.',
    )
    expect(screen.getAllByTestId('v5-analysis-result-story-headline')).toHaveLength(1)
    expect(screen.getAllByTestId('v5-analysis-result-scenario-context')).toHaveLength(1)
  })

  it('an ABSENT field is not an alarm — four present, one missing, no marker', () => {
    const rest = Object.fromEntries(
      Object.entries(WELL_TYPED).filter(([k]) => k !== 'narrative_summary'),
    )
    render(<V5AnalysisResultBlock block={blockWithReview({ produced_at: AT, ...rest })} />)
    expect(screen.queryByTestId('v5-analysis-result-enrichment-invalid')).toBeNull()
    expect(screen.queryByTestId('v5-analysis-result-narrative-summary')).toBeNull()
    expect(screen.getByTestId('v5-analysis-result-readiness-rationale')).toBeTruthy()
  })

  it('absent + wrong-typed in one payload → marker fires (wrong-typed dominates)', () => {
    render(
      <V5AnalysisResultBlock
        block={blockWithReview({
          produced_at: AT,
          // narrative_summary ABSENT
          readiness_rationale: 'Readiness is high.',
          robustness_explanation: 'not an object', // WRONG-TYPED
        })}
      />,
    )
    expect(screen.getByTestId('v5-analysis-result-enrichment-invalid')).toBeTruthy()
    expect(screen.queryByTestId('v5-analysis-result-readiness-rationale')).toBeNull()
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
