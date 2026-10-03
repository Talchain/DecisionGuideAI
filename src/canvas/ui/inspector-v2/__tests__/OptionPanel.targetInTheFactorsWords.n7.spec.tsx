/**
 * ⭐⭐ THE INSPECTOR STATES A TARGET IN THE FACTOR'S OWN WORDS — never a bare
 * 0–1 model figure where the factor card shows a word (side-by-side DIFF N7,
 * 28 Sep 2026; contract v3.1 `checks.factor` "no bare internal model scale").
 *
 * SERVED `b40d5436` (`sbs3/interact.json`, vendor-selection "Adopt Segment",
 * `+5 more` → the inspector): "Operational Overhead on Data Team — This option
 * sets 0.5"; market-entry: "Localisation and Compliance Cost — This option sets
 * 0.5". Both factors' cards read "Medium" for the same 0.5 — the producer wrote
 * `0.5 scale`, the row dropped the placeholder word, and a bare model number
 * was left.
 *
 * Now (`optionTargetReading`): the row's own reading, except a bare 0–1 figure
 * on a factor with no real unit, which takes the factor card's band word in the
 * estate's tier-reading form, `Medium (0.5)`. Pinned on BOTH factor kinds:
 *   · BANDED — `fac_ops_overhead` / `fac_localisation_cost` (`scale`, no map):
 *     "Medium (0.5)", the card's word first;
 *   · BINARY — `fac_segment` / `fac_rudderstack` (`encoding_map` 0/1): the
 *     map's word ("Adopted", "Not adopted"), unchanged; and
 *     `fac_gdpr_compliance` (0/1 map, a 0.5 target the map does not name):
 *     CEE's own band reading "Moderate (0.5)", unchanged.
 * Controls: a real unit keeps its figure ("£60k"); a PERSON'S bare number is
 * left as they typed it.
 *
 * HOW IT BINDS: the deployed chain (`InspectorModal` → `InspectorRouter` →
 * `OptionPanel` → `InterventionRow`) on the REAL store, seeded with the shipped
 * starters the way a draft lands; every row by its factor id (trap 19).
 *
 * CLAIM SCOPE (trap 3): jsdom text and test ids.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, within, cleanup } from '@testing-library/react'

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }) }
})
vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Handle: () => null,
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

import { InspectorModal } from '../../../components/InspectorModal'
import { useCanvasStore } from '../../../store'
import { backfillInterventionsOntoOptionNodes, mapDraftNodeToCanvas, mapDraftEdgeToCanvas } from '../../../utils/applyDraftResult'
import { qualitativeTierLabel } from '../../../utils/labelUtils'
import { optionTargetReading } from '../../../nodes/shared/optionTargetDisplay'
import vendorStarter from '../../../starters/data/vendor-selection.draft.json'
import marketEntryStarter from '../../../starters/data/market-entry.draft.json'

const NODE_INSPECTOR = 'div[role="dialog"][aria-label="Node inspector"]'
type Draft = { nodes: unknown[]; edges: unknown[]; analysis_ready: unknown }

/**
 * The starter as it lands: nodes mapped, then the analysis_ready targets mirrored
 * onto the option nodes (`backfillInterventionsOntoOptionNodes`, the landing
 * path's own step — the served inspector listed all six vendor targets).
 */
function seedStarter(draft: Draft) {
  const nodes = draft.nodes.map(mapDraftNodeToCanvas) as Array<{ id: string; data: Record<string, unknown> }>
  useCanvasStore.setState({
    nodes: nodes as never[],
    edges: draft.edges.map(mapDraftEdgeToCanvas) as never[],
    results: { status: 'idle' },
    ceeAnalysisReady: draft.analysis_ready,
    lastServerGraphHash: 'gh-starter',
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: { x: 0, y: 0 } },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
  backfillInterventionsOntoOptionNodes(draft.analysis_ready as never)
}

function openInspector(optionId: string): HTMLElement {
  const utils = render(<InspectorModal nodeId={optionId} edgeId={null} onClose={vi.fn()} />)
  const dialog = utils.container.querySelector(NODE_INSPECTOR)
  expect(dialog, 'PRECONDITION: the node inspector dialog must be mounted').not.toBeNull()
  return dialog as HTMLElement
}

/** "This option sets <reading>" → the reading, for THIS factor's row. */
function reading(dialog: HTMLElement, factorId: string): string {
  const row = within(dialog).getByTestId(`inspector-intervention-${factorId}`)
  const readout = within(row).getByTestId(`intervention-readout-${factorId}`)
  expect(within(readout).getByTestId(`intervention-sets-${factorId}`).textContent).toBe('This option sets')
  return (readout.textContent ?? '').replace(/^This option sets\s*/, '').trim()
}

const BARE_FIGURE = /^-?(\d+(\.\d+)?|\.\d+)$/

afterEach(() => cleanup())

describe('DIFF N7 — vendor-selection "Adopt Segment": every target in its factor\'s words', () => {
  it('BANDED factor (`0.5 scale`, no map): "Medium (0.5)" — the factor card\'s word first, never a bare "0.5"', () => {
    seedStarter(vendorStarter as unknown as Draft)
    const dialog = openInspector('opt_segment')
    const r = reading(dialog, 'fac_ops_overhead')
    expect(r).not.toMatch(BARE_FIGURE)
    // The word the factor card prints for its own bare 0.5 (`FactorNode`'s
    // `factor-value-tier-*`, `qualitativeTierLabel`).
    expect(r).toBe(`${qualitativeTierLabel(0.5)} (0.5)`)
    expect(r).toBe('Medium (0.5)')
  })

  it('BINARY factors (0/1 encoding map): the map\'s words, unchanged', () => {
    seedStarter(vendorStarter as unknown as Draft)
    const dialog = openInspector('opt_segment')
    expect(reading(dialog, 'fac_segment')).toBe('Adopted')
    expect(reading(dialog, 'fac_rudderstack')).toBe('Not adopted')
    expect(reading(dialog, 'fac_snowflake_build')).toBe('Not adopted')
  })

  it('BINARY factor with a target its map does not name (0.5): CEE\'s band reading, word first, unchanged', () => {
    seedStarter(vendorStarter as unknown as Draft)
    const dialog = openInspector('opt_segment')
    expect(reading(dialog, 'fac_gdpr_compliance')).toBe('Moderate (0.5)')
  })

  it('CONTROL — a real unit keeps its figure: "£60k"', () => {
    seedStarter(vendorStarter as unknown as Draft)
    const dialog = openInspector('opt_segment')
    expect(reading(dialog, 'fac_annual_cost')).toBe('£60k')
  })

  it('no target on any vendor option reads as a bare number', () => {
    for (const option of ['opt_segment', 'opt_rudderstack', 'opt_snowflake', 'opt_status_quo']) {
      seedStarter(vendorStarter as unknown as Draft)
      const dialog = openInspector(option)
      const rows = [...dialog.querySelectorAll('[data-testid^="intervention-readout-"]')]
      expect(rows.length, `PRECONDITION: ${option} lists its targets`).toBe(6)
      for (const el of rows) {
        const text = (el.textContent ?? '').replace(/^This option sets\s*/, '').trim()
        expect(text, `${option} ${el.getAttribute('data-testid')}`).not.toMatch(BARE_FIGURE)
      }
      cleanup()
    }
  })
})

describe('DIFF N7 — market-entry: the localisation cost reads in words on every option', () => {
  for (const option of ['opt_germany', 'opt_nordics', 'opt_uk_fs']) {
    it(`${option}: fac_localisation_cost reads "Medium (0.5)"`, () => {
      seedStarter(marketEntryStarter as unknown as Draft)
      const dialog = openInspector(option)
      expect(reading(dialog, 'fac_localisation_cost')).toBe('Medium (0.5)')
    })
  }
})

describe('CONTROL — the re-wording gate, as a discriminating pair on `optionTargetReading`', () => {
  // The reading a row carries for a bare figure on a `scale` factor, and the
  // factor node's own data (unit `scale`, a placeholder) — the served shape.
  const factorData = { observedState: { value: 0.5, unit: 'scale' } }
  const row = (kind: 'you' | 'olumi' | 'brief', target = '0.2') => ({
    factorId: 'fac_ops_overhead', label: 'x', fullLabel: 'x', change: `→ ${target}`, fullChange: `→ ${target}`,
    target, reference: 'none' as const, estimated: kind === 'olumi',
    targetSource: { kind, label: kind } as never, sameAsReference: false,
  })

  it('a PERSON\'s bare number is left as they gave it; Olumi\'s or the brief\'s gets the card\'s word', () => {
    expect(optionTargetReading(row('you'), factorData)).toBe('0.2')
    expect(optionTargetReading(row('olumi'), factorData)).toBe('Very low (0.2)')
    expect(optionTargetReading(row('brief'), factorData)).toBe('Very low (0.2)')
  })

  it('a figure in a REAL unit is not re-worded (the card prints the unit and figure)', () => {
    expect(optionTargetReading(row('olumi', '0.2'), { observedState: { value: 0.5, unit: '£' } })).toBe('0.2')
  })

  it('a figure outside 0–1 is not a model value and is not re-worded', () => {
    expect(optionTargetReading(row('olumi', '3'), factorData)).toBe('3')
  })
})
