/**
 * CEE rendering-claims harness.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * CEE's field-coverage allowlist (`tests/contract/field-coverage.allowlist.json`
 * in Talchain/olumi-assistants-service) justifies every non-audited wire field
 * with a prose claim. Those claims have TWO halves:
 *
 *   1. DISTRIBUTION — "is this path actually on the wire?" CEE machine-checks
 *      this half itself.
 *   2. RENDERING — "the UI dispatches on this value; it is never rendered as
 *      text", "never user-facing", "the sibling label is the rendered text".
 *      **CEE cannot enforce this half and says so.** The render sites are in
 *      THIS repo.
 *
 * Until this file existed, the rendering half was hand-verified prose with a
 * date on it. Hand-verified prose about another repo is this platform's
 * dominant defect class: it reads green, it drifts silently, and nobody
 * re-checks it. When CEE last swept these claims by hand, FOUR were already
 * false at the DGAI SHA they were verified against — including
 * `referenced_option_ids`, whose "never rendered as text" justification sat
 * next to a component printing exactly that id as visible chip text.
 *
 * This harness converts the claims into executable assertions, so a DGAI
 * change that starts rendering a machine identifier as user-visible text
 * fails CI here rather than reaching users.
 *
 * ── HOW IT WORKS ─────────────────────────────────────────────────────────
 * - The allowlist is SYNCED, not hand-copied: `scripts/fetch-cee-contracts.sh`
 *   copies it into `contracts/cee/`, and
 *   `.github/workflows/contract-validation.yml` re-fetches CEE's live `staging`
 *   tip on every run and executes this suite against the FETCHED bytes. The
 *   committed copy is a local-dev convenience, not the source of truth.
 * - Coverage is EXHAUSTIVE AND BIDIRECTIONAL. Every allowlist entry must be
 *   classified in `COVERAGE`; every `COVERAGE` key must exist in the
 *   allowlist. A new CEE entry fails this suite until a human classifies it.
 *   There is deliberately no "unknown entries are fine" default.
 * - Probes plant a distinctive sentinel in the field under test, render the
 *   REAL production component, and assert the sentinel never reaches the
 *   user-facing surface (text + aria labels). React keys, `data-testid` and
 *   class names are deliberately NOT part of that surface — those are the
 *   legitimate machine uses the allowlist permits, and conflating them would
 *   make the correct pattern indistinguishable from the defect.
 * - Every probe carries a witness that must be PRESENT (trap 13), and the
 *   suite self-tests its own detector so a green run means "no leak found"
 *   rather than "probe never fired".
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  idSentinel,
  expectSentinelNotRendered,
  expectSentinelIsRendered,
} from '../../src/test/helpers/expectSentinelNotRendered'

// ---------------------------------------------------------------------------
// Canvas store mock — the label source the block components resolve against.
// ---------------------------------------------------------------------------

/**
 * Mutable per-test canvas contents. Options are canvas nodes (there is no
 * separate option entity), so a single node list serves both option-id and
 * factor-id resolution.
 */
let mockNodes: Array<{ id: string; data: { label: string } }> = []
let mockEdges: Array<{ id: string; source?: string; target?: string }> = []

vi.mock('../../src/canvas/store', () => ({
  useCanvasStore: (selector: (s: unknown) => unknown) =>
    selector({ nodes: mockNodes, edges: mockEdges }),
}))

// Imported AFTER the mock declaration; vi.mock is hoisted so this is safe.
import { V5ExplanationBlock } from '../../src/v5/blocks/V5ExplanationBlock'
import { V5FlipAnalysisBlock } from '../../src/v5/blocks/V5FlipAnalysisBlock'
import { V5ComparisonBlock } from '../../src/v5/blocks/V5ComparisonBlock'

afterEach(() => {
  cleanup()
  mockNodes = []
  mockEdges = []
})

// ---------------------------------------------------------------------------
// Allowlist loading — tolerant of both CEE shapes.
// ---------------------------------------------------------------------------

const ALLOWLIST_PATH = resolve(
  __dirname,
  '../../contracts/cee/field-coverage.allowlist.json',
)

/**
 * CEE ships two shapes for this file:
 *   v1              — value is the justification string.
 *   PR #689 onwards — value is `{ wire, why, ... }`.
 * Normalise both; assume neither.
 */
interface AllowlistEntry {
  category: string
  key: string
  why: string
  wire?: string
}

/**
 * Categories whose entries assert something about RENDERING, and are
 * therefore this harness's business. `audited_fields` is a plain array of
 * fields that ARE rendered — the opposite claim — and is excluded by name.
 */
const RENDERING_CLAIM_CATEGORIES = [
  'diagnostic_allowed',
  'machine_routing_allowed',
  'structured_pointer_allowed',
  'currently_unrendered_but_intentional',
] as const

/** Documentation keys, not entries. Anything else is a hard error. */
const NON_ENTRY_KEYS = new Set([
  '_doc',
  '_wire_values',
  '_corrections_2026_07_25',
  'audited_fields',
])

function loadAllowlist(): {
  raw: Record<string, unknown>
  entries: AllowlistEntry[]
} {
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as Record<
    string,
    unknown
  >

  const entries: AllowlistEntry[] = []
  for (const category of RENDERING_CLAIM_CATEGORIES) {
    const bucket = raw[category]
    if (bucket === undefined) continue
    if (typeof bucket !== 'object' || bucket === null || Array.isArray(bucket)) {
      throw new Error(
        `CEE allowlist category "${category}" is not an object map — the ` +
          `allowlist shape changed in a way this harness does not understand. ` +
          `Read the upstream file before editing this test.`,
      )
    }
    for (const [key, value] of Object.entries(bucket)) {
      if (typeof value === 'string') {
        entries.push({ category, key, why: value })
      } else if (typeof value === 'object' && value !== null) {
        const v = value as Record<string, unknown>
        entries.push({
          category,
          key,
          why: typeof v.why === 'string' ? v.why : '',
          wire: typeof v.wire === 'string' ? v.wire : undefined,
        })
      } else {
        throw new Error(
          `CEE allowlist entry ${category}.${key} has an unrecognised value ` +
            `type (${typeof value}).`,
        )
      }
    }
  }
  return { raw, entries }
}

// ---------------------------------------------------------------------------
// Coverage registry.
// ---------------------------------------------------------------------------

/**
 * How this harness treats each allowlist entry. Every disposition other than
 * `probed` is an explicit, reasoned admission of what is NOT machine-checked —
 * the honest-coverage requirement. There is deliberately no default.
 */
type Disposition =
  /** A render probe in this repo executes the claim. */
  | 'probed'
  /**
   * The path never reaches a DGAI production render surface — consumed by
   * CEE-internal code, telemetry, an admin/debug surface, or nothing at all.
   */
  | 'not-a-dgai-render-surface'
  /**
   * The claim IS about a DGAI production surface but this harness cannot
   * execute it (needs a full canvas/results mount, or a real browser).
   * NOT assume-good: counted and listed in the coverage report below.
   */
  | 'uncovered'
  /**
   * The claim is KNOWN FALSE or known-contested at a recorded SHA and the
   * fix is owned elsewhere. Recorded rather than omitted so the gap stays
   * visible instead of being silently dropped.
   */
  | 'documented-violation-not-owned-here'

interface CoverageRecord {
  disposition: Disposition
  reason: string
}

/**
 * ── THE COVERAGE REGISTRY ────────────────────────────────────────────────
 * Keyed by the EXACT allowlist key. Exact-match is deliberate: CEE PR #689
 * re-anchors every bare leaf key (`factor_id`) to a fully-qualified path
 * (`blocks[].enrichment.flip_thresholds[].factor_id`) precisely because the
 * bare keys matched nothing. When that lands, these keys will fail the
 * exhaustiveness check and force a re-map — the harness working, not
 * breaking.
 */
const COVERAGE: Record<string, CoverageRecord> = {
  // ── structured_pointer_allowed — the id-pointer claims. ────────────────
  'blocks[].referenced_option_ids': {
    disposition: 'probed',
    reason:
      'Rendered by V5ExplanationBlock. This entry is the harness positive ' +
      'control: its v1 "never rendered as text" claim was FALSE, and CEE #689 ' +
      'corrected it to record that the UI printed each id as visible chip ' +
      'text. Fixed here; the probe keeps it fixed.',
  },
  'blocks[].enrichment.flip_thresholds[].factor_id': {
    disposition: 'probed',
    reason:
      'The sibling V5 flip_analysis block rendered this id raw as each row\'s ' +
      'visible label (V5FlipAnalysisBlock) — the hazard CEE #689 flags on this ' +
      'entry. Fixed here; the probe keeps it fixed.',
  },
  'blocks[].enrichment.option_comparison[].option_id': {
    disposition: 'documented-violation-not-owned-here',
    reason:
      'PARTIALLY probed. V5ComparisonBlock is clean and IS probed here — it ' +
      'uses option_id as React key + data-testid and renders the sibling ' +
      'label, the reference implementation. But the same wire path reaches a ' +
      'SECOND surface that is NOT clean: inspector-v2/panels/OutcomePanel.tsx:101 ' +
      'renders `{opt.option_label ?? opt.option_id}`, and the same fallback ' +
      'appears in RiskAdvancedEditor.tsx:32, OutcomeAdvancedEditor.tsx:32 and ' +
      'OptionPanel.tsx:167 — all verified reaching visible text at 0dfb075d. ' +
      'Those are inspector-panel surfaces needing a canvas/store mount; not ' +
      'fixed by this lane and deliberately recorded rather than dropped.',
  },
  'blocks[].enrichment.factor_sensitivity[].factor_id': {
    disposition: 'documented-violation-not-owned-here',
    reason:
      'KNOWN FALSE and not fixed here. components/results/useResultsSectionData.ts:2051-2056 ' +
      'prettifies the raw key into displayLabel when both canvasLabel and ' +
      'f.raw.label are absent, and :2735 does `gap.factor_label ?? gap.factor_id`. ' +
      'Both reach visible text (DriversSection, V7SignalRow, ChallengeSection, ' +
      'StressTestSection, TriageActionCardsBody). ChallengeSection.tsx:97-99 ' +
      'carries a THIRD independent id-prettifying fallback. Verified at ' +
      '0dfb075d. Each needs its own copy decision ("unnamed factor" vs omit), ' +
      'so this belongs in a lane that can carry them properly.',
  },
  'coaching.bias_signals[].target': {
    disposition: 'uncovered',
    reason:
      'Coaching bias-signal targets drive a canvas highlight rather than a ' +
      'self-contained block component; probing needs a full canvas mount, ' +
      'which jsdom cannot render faithfully (trap 3). Not swept here.',
  },
  'analysis_ready.model_adjustments[].node_id': {
    disposition: 'uncovered',
    reason:
      'Re-anchored by CEE #689 from the removed coaching.widening_log[] shape. ' +
      'The consuming surface needs a results/analysis-ready mount. Not swept.',
  },
  'goal_constraints[].node_id': {
    disposition: 'uncovered',
    reason:
      'CEE #689 states the rendering half of this entry was NOT individually ' +
      'swept on the DGAI side either. It remains unswept — recorded honestly ' +
      'rather than inheriting CEE\'s unverified assumption.',
  },
  'blocks[].enrichment.robustness.fragile_edges[].edge_id': {
    disposition: 'uncovered',
    reason:
      'Fragile-edge pointers inside decision-review enrichment. The consuming ' +
      'surface resolves edges via endpoint labels, but reaching it needs a ' +
      'full results-store mount. Not swept here.',
  },

  // ── machine_routing_allowed. ───────────────────────────────────────────
  'coaching.strengthen_items[].action_type': {
    disposition: 'not-a-dgai-render-surface',
    reason:
      'Already enforced, and more strictly than this harness would: ' +
      'src/test/helpers/expectNoChipMetadataLeaks.ts blocklists every ' +
      'action_type literal against chip outerHTML, attributes included.',
  },
  'suggested_actions[].action_type': {
    disposition: 'not-a-dgai-render-surface',
    reason:
      'Same as coaching.strengthen_items[].action_type — covered by the ' +
      'existing chip-metadata blocklist against outerHTML.',
  },
  'coaching.strengthen_items[].id': {
    disposition: 'uncovered',
    reason:
      'Chip ids are deliberately present in data-testid (expectNoChipMetadataLeaks ' +
      'documents this as the contract), so the existing helper cannot ' +
      'distinguish id-in-testid from id-as-text. A sentinel probe on the chip ' +
      'row could, and does not exist yet. Not swept.',
  },
  'suggested_actions[].id': {
    disposition: 'uncovered',
    reason: 'Same as coaching.strengthen_items[].id — not swept.',
  },
  'nodes[].id': {
    disposition: 'uncovered',
    reason:
      'Canvas node identifiers. Probing needs a real canvas mount; jsdom ' +
      'cannot prove what a canvas node visually renders (trap 3). Not swept.',
  },
  'options[].id': {
    disposition: 'uncovered',
    reason:
      'Canvas option-node identifiers, same constraint as nodes[].id. Note ' +
      'the inspector-panel fallbacks recorded under ' +
      'blocks[].enrichment.option_comparison[].option_id are the live hazard ' +
      'for option identifiers. Not swept.',
  },
  'blocks[].error_code': {
    disposition: 'documented-violation-not-owned-here',
    reason:
      'src/v5/TypedErrorRenderer.tsx:82 renders the failure-type literal ' +
      'ungated as visible text, but the component has ZERO non-test importers ' +
      'and is mounted on no route — unreachable rather than leaking. Complete ' +
      'importer manifest verified at 0dfb075d. Recorded so the claim is not ' +
      'silently dropped if it is ever mounted.',
  },
}

/**
 * Every `diagnostic_allowed` entry is a CEE-internal telemetry / admin-debug
 * path. Registered programmatically FROM THE ALLOWLIST rather than hand-listed,
 * so a newly-added diagnostic entry cannot slip past the exhaustiveness check
 * against a stale hand-written row. It still cannot be probed, and the
 * coverage report counts it as unswept.
 */
const DIAGNOSTIC_DISPOSITION: CoverageRecord = {
  disposition: 'not-a-dgai-render-surface',
  reason:
    'diagnostic_allowed entries are telemetry / admin-debug paths (trace.*, ' +
    '_meta.*). NOTE: CEE #689 found trace.repair_summary and trace.pipeline ' +
    'ARE rendered on a DGAI DEBUG surface. A debug-gated render is not a ' +
    'production rendering violation — DebugPanelV2 requires VITE_APP_ENV in ' +
    '{staging,development} AND (?diag OR window.__OLUMI_DEBUG); DebugDrawer ' +
    'requires import.meta.env.DEV. Not swept here.',
}

const { raw, entries } = loadAllowlist()

function coverageFor(entry: AllowlistEntry): CoverageRecord | undefined {
  if (entry.category === 'diagnostic_allowed') return DIAGNOSTIC_DISPOSITION
  return COVERAGE[entry.key]
}

// ---------------------------------------------------------------------------
// Structure + drift guards.
// ---------------------------------------------------------------------------

describe('CEE field-coverage allowlist — structure', () => {
  it('parses and yields entries', () => {
    expect(entries.length).toBeGreaterThan(0)
  })

  it('contains no top-level key this harness does not understand', () => {
    const unknown = Object.keys(raw).filter(
      (k) =>
        !NON_ENTRY_KEYS.has(k) &&
        !(RENDERING_CLAIM_CATEGORIES as readonly string[]).includes(k),
    )
    expect(
      unknown,
      `CEE added top-level allowlist key(s) this harness does not classify: ` +
        `${unknown.join(', ')}. Decide whether they carry rendering claims and ` +
        `update RENDERING_CLAIM_CATEGORIES / NON_ENTRY_KEYS. Failing loud ` +
        `rather than assuming they are harmless.`,
    ).toEqual([])
  })
})

describe('CEE rendering claims — coverage is exhaustive both ways', () => {
  it('every allowlist entry is classified', () => {
    const unclassified = entries
      .filter((e) => coverageFor(e) === undefined)
      .map((e) => `${e.category}.${e.key}`)
    expect(
      unclassified,
      `CEE's allowlist carries entr(ies) with no disposition in this harness's ` +
        `COVERAGE registry:\n  ${unclassified.join('\n  ')}\n\n` +
        `This is the drift guard firing, and it is working as intended. Either ` +
        `add a probe, or classify the entry with an honest reason. Do NOT add ` +
        `a blanket default — an unclassified rendering claim that silently ` +
        `passes is exactly the failure mode this file exists to prevent.`,
    ).toEqual([])
  })

  it('every COVERAGE key still exists in the allowlist', () => {
    const live = new Set(entries.map((e) => e.key))
    const stale = Object.keys(COVERAGE).filter((k) => !live.has(k))
    expect(
      stale,
      `COVERAGE registry has entr(ies) CEE no longer ships:\n  ` +
        `${stale.join('\n  ')}\n\nRemove them, or — if CEE re-anchored the key ` +
        `to a fully-qualified path (PR #689 does exactly this) — re-key the ` +
        `registry and re-verify each probe against the new path.`,
    ).toEqual([])
  })

  it('reports its own honest coverage', () => {
    const byDisposition = new Map<Disposition, string[]>()
    for (const e of entries) {
      const c = coverageFor(e)
      if (c === undefined) continue
      const list = byDisposition.get(c.disposition) ?? []
      list.push(`${e.category}.${e.key}`)
      byDisposition.set(c.disposition, list)
    }
    const lines = [`CEE rendering-claim coverage (${entries.length} entries):`]
    for (const d of [
      'probed',
      'documented-violation-not-owned-here',
      'uncovered',
      'not-a-dgai-render-surface',
    ] as Disposition[]) {
      const list = byDisposition.get(d) ?? []
      lines.push(`  ${d}: ${list.length}`)
      for (const k of list) lines.push(`    - ${k}`)
    }
    console.info(lines.join('\n'))

    // The one hard floor: if the probe set ever empties, this suite would be
    // green while executing zero rendering claims.
    const probed = byDisposition.get('probed') ?? []
    expect(
      probed.length,
      'no allowlist entry is actually probed — the harness would be green ' +
        'while checking nothing',
    ).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// The detector's own positive control.
// ---------------------------------------------------------------------------

describe('harness self-test — the leak detector can SEE a leak', () => {
  it('detects a sentinel that IS rendered as visible text', () => {
    const sentinel = idSentinel('opt')
    // V5ComparisonBlock renders `label` as text by design. Planting the
    // sentinel THERE must trip the detector. If this fails, every absence
    // assertion in this file is vacuous.
    const { container } = render(
      <V5ComparisonBlock
        block={{
          type: 'v5_comparison',
          narrative: 'Comparing the options.',
          options: [
            { option_id: 'opt_real', label: sentinel, win_probability: 0.6 },
          ],
        }}
      />,
    )
    expectSentinelIsRendered({
      element: container.firstElementChild as HTMLElement,
      sentinel,
      witness: sentinel,
      claim: 'self-test',
    })
  })

  it('the witness guard fails loudly when nothing rendered', () => {
    const empty = document.createElement('div')
    expect(() =>
      expectSentinelNotRendered({
        element: empty,
        sentinel: idSentinel('opt'),
        witness: 'this text is not present',
        claim: 'self-test — vacuity guard',
      }),
    ).toThrow(/POSITIVE CONTROL FAILED/)
  })
})

// ---------------------------------------------------------------------------
// The probes.
// ---------------------------------------------------------------------------

describe('rendering claim: blocks[].referenced_option_ids', () => {
  const NARRATIVE = 'Hiring in London wins on resilience.'

  it('does not render a referenced option id as text when the option is on canvas', () => {
    const sentinel = idSentinel('opt')
    mockNodes = [{ id: sentinel, data: { label: 'Hire in London' } }]

    const { container } = render(
      <V5ExplanationBlock
        block={{
          type: 'v5_explanation',
          narrative: NARRATIVE,
          referenced_option_ids: [sentinel],
        }}
      />,
    )

    expectSentinelNotRendered({
      element: container.firstElementChild as HTMLElement,
      sentinel,
      witness: NARRATIVE,
      claim: 'structured_pointer_allowed.blocks[].referenced_option_ids',
    })
  })

  it('does not render a referenced option id as text when NO label resolves', () => {
    // The harder case: the producer cites an option the canvas does not know.
    // A resolver that falls back to the raw id would leak here.
    const sentinel = idSentinel('opt')
    mockNodes = []

    const { container } = render(
      <V5ExplanationBlock
        block={{
          type: 'v5_explanation',
          narrative: NARRATIVE,
          referenced_option_ids: [sentinel],
        }}
      />,
    )

    expectSentinelNotRendered({
      element: container.firstElementChild as HTMLElement,
      sentinel,
      witness: NARRATIVE,
      claim:
        'structured_pointer_allowed.blocks[].referenced_option_ids (unresolvable label)',
    })
  })
})

describe('rendering claim: blocks[].enrichment.flip_thresholds[].factor_id', () => {
  const NARRATIVE = 'Two factors could flip the result.'

  it('does not render a factor id as text when the factor is on canvas', () => {
    const sentinel = idSentinel('fac')
    mockNodes = [{ id: sentinel, data: { label: 'Team morale' } }]

    const { container } = render(
      <V5FlipAnalysisBlock
        block={{
          type: 'v5_flip_analysis',
          narrative: NARRATIVE,
          flip_scenarios: [
            {
              factor_id: sentinel,
              current_value: 0.5,
              flip_threshold: 0.7,
              from_option_id: 'opt_a',
              to_option_id: 'opt_b',
              fragile: false,
            },
          ],
        }}
      />,
    )

    expectSentinelNotRendered({
      element: container.firstElementChild as HTMLElement,
      sentinel,
      witness: NARRATIVE,
      claim: 'structured_pointer_allowed.blocks[].enrichment.flip_thresholds[].factor_id',
    })
  })

  it('does not render a factor id as text when NO label resolves', () => {
    const sentinel = idSentinel('fac')
    mockNodes = []

    const { container } = render(
      <V5FlipAnalysisBlock
        block={{
          type: 'v5_flip_analysis',
          narrative: NARRATIVE,
          flip_scenarios: [
            {
              factor_id: sentinel,
              current_value: 0.5,
              flip_threshold: 0.7,
              from_option_id: null,
              to_option_id: null,
              fragile: true,
            },
          ],
        }}
      />,
    )

    expectSentinelNotRendered({
      element: container.firstElementChild as HTMLElement,
      sentinel,
      witness: NARRATIVE,
      claim:
        'structured_pointer_allowed.blocks[].enrichment.flip_thresholds[].factor_id (unresolvable label)',
    })
  })
})

describe('rendering claim: blocks[].enrichment.option_comparison[].option_id', () => {
  const NARRATIVE = 'London leads on win probability.'

  it('renders the sibling label, never the option id', () => {
    const sentinel = idSentinel('opt')

    const { container } = render(
      <V5ComparisonBlock
        block={{
          type: 'v5_comparison',
          narrative: NARRATIVE,
          options: [
            {
              option_id: sentinel,
              label: 'Hire in London',
              win_probability: 0.62,
            },
          ],
        }}
      />,
    )

    const element = container.firstElementChild as HTMLElement

    // The id IS expected in machine attributes — that is the allowlist's
    // permitted use, and asserting otherwise would forbid correct code.
    expect(
      element.outerHTML,
      'precondition: this probe is only meaningful while the component still ' +
        'uses option_id as a key/testid — otherwise it proves nothing about ' +
        'the text/attribute distinction',
    ).toContain(sentinel)

    expectSentinelNotRendered({
      element,
      sentinel,
      witness: 'Hire in London',
      claim:
        'structured_pointer_allowed.blocks[].enrichment.option_comparison[].option_id',
    })
  })
})
