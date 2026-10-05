/**
 * GATE 5 ITEM 2, ROUND 2 — the classes Codex r1 found on #2499 @692984b3, each driven through its real entry point.
 *
 *   P1-1 the Model tab's relationship rows (`toModelRows`): an accepted or stated strength is not an unconfirmed estimate.
 *   P1-2 the user's own figure WITHOUT a sayable size phrase: still never "Olumi's" (`strengthStated`).
 *   P1-3 the canvas pills (`<EdgePills>` rendered): acceptance and authorship said apart.
 *   P1-4 the two boundaries that merge raw data onto an existing edge: the strength acknowledgement
 *        (`parseV5Response` → `applyV5State`) and `applyAutoApplyPatch`'s `update_edge`.
 *
 * CORPUS: the served cold-read edges (`../../domain/__tests__/fixtures/servedLinkSizing.20261005.json`). Variants are
 * named where made: the user-stated edge WITHOUT its natural effect (the partial-metadata case Codex reproduced), and
 * `provenance_display: 'ai_inferred'` (CEE's V3 display for a `cee_hypothesis` link) where the Model tab keys on it.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import served from '../../domain/__tests__/fixtures/servedLinkSizing.20261005.json'
import { mapDraftEdgeToCanvas } from '../applyDraftResult'
import { useCanvasStore } from '../../store'
import { seedCanvas } from './__helpers__/mergeAppliedGraphHarness'
import { applyAutoApplyPatch } from '../../conversation/utils/applyPatch'
import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import { parseV5Response } from '../../../v5/responseParser'
import { EdgePills } from '../../nodes/shared/EdgePills'
import { toModelRows } from '../../model-tab-v2/adapters'
import { edgeSizePhrase } from '../../edges/edgeSizePhrase'
import { isStrengthAccepted } from '../../domain/strengthAccepted'
import { isStrengthStated } from '../../domain/strengthStated'
import { buildExamineLinkView } from '../../ui/inspector-v2/examine/examineLinkView'
import { resolveEdgeValuesProvenance } from '../../ui/inspector-v2/coachingConfig'
import { edgeValueSource, resolveEdgeDirectionDisplay, resolveEdgeSignedStrengthDisplay } from '../../domain/edgeValueProvenance'
import { LinkHoverCard } from '../../components/hoverCard/LinkHoverCard'

type WireEdge = Record<string, unknown> & { from: string; to: string; provenance: Record<string, unknown> }
const ACCEPTED = served.accepted as unknown as WireEdge
const OLUMI = served.olumi as unknown as WireEdge
const STATED = served.userStated as unknown as WireEdge
const { reviewed_by_user: _r, ...PRE_PROV } = ACCEPTED.provenance
const PRE_APPROVAL: WireEdge = { ...ACCEPTED, provenance: PRE_PROV }
/** Variant: the served user-stated edge with its natural effect withheld — no size phrase can be said. */
const { natural_effect: _ne, ...STATED_PROV_NO_EFFECT } = STATED.provenance
const STATED_NO_PHRASE: WireEdge = { ...STATED, provenance: STATED_PROV_NO_EFFECT }
const ACCEPTED_WORDS = "Olumi's estimate, accepted"

const nodesFor = (e: WireEdge, targetType = 'outcome') => [
  { id: e.from, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: `Source ${e.from}` } },
  { id: e.to, type: targetType, position: { x: 300, y: 0 }, data: { kind: targetType, label: `Target ${e.to}` } },
]
const edgeOf = (e: WireEdge): any =>
  useCanvasStore.getState().edges.find((x: any) => x.source === e.from && x.target === e.to)

describe('P1-2 — the user’s own figure with NO sayable size phrase is still never "Olumi’s"', () => {
  const data = () => mapDraftEdgeToCanvas({ ...STATED_NO_PHRASE } as never, 0).data as Record<string, unknown>
  it('the typed fact is stored though the phrase is null', () => {
    expect(edgeSizePhrase(data())).toBeNull() // PRECONDITION: the phrase cannot be said
    expect(isStrengthStated(data())).toBe(true)
  })
  it('examine does not challenge it as Olumi’s, and the inspector says it is from the user’s figure', () => {
    expect(buildExamineLinkView({ sourceLabel: 'A', targetLabel: 'B', data: data(), structural: false, fragile: false })).toBeNull()
    const sentence = resolveEdgeValuesProvenance({
      strength: edgeValueSource(data(), 'weight'),
      existence: edgeValueSource(data(), 'beliefExists'),
      strengthStated: true,
    } as Parameters<typeof resolveEdgeValuesProvenance>[0])
    expect(sentence.startsWith('From your figure.')).toBe(true)
    expect(sentence).not.toMatch(/Olumi estimated this strength/)
  })
  it('a user’s own link-effect edit ({source: user_specified, magnitude: user_stated}, CEE link-effect-edit.ts:233) is SET by them, not "stated"', () => {
    const edited = { ...STATED, provenance: { ...STATED.provenance, source: 'user_specified' } }
    const data = mapDraftEdgeToCanvas(edited as never, 0).data as Record<string, unknown>
    expect(data.strengthStated).toBeUndefined()
    expect(edgeValueSource(data, 'weight')).toBe('user')
  })
  it('control: Olumi’s own unreviewed estimate is not stated', () => {
    expect(isStrengthStated(mapDraftEdgeToCanvas({ ...OLUMI } as never, 0).data as Record<string, unknown>)).toBe(false)
  })
})

describe('P1-3 — the pills say acceptance and authorship apart (rendered <EdgePills>)', () => {
  it('⭐ accepted: "Olumi’s estimate, accepted", never "set by a person"', () => {
    seedCanvas(nodesFor(ACCEPTED), [mapDraftEdgeToCanvas({ ...ACCEPTED } as never, 0)])
    render(<EdgePills nodeId={ACCEPTED.from} />)
    const id = edgeOf(ACCEPTED).id
    const pill = screen.getByTestId(`edge-pill-strength-accepted-${id}`)
    expect(pill.getAttribute('title')).toContain(ACCEPTED_WORDS)
    expect(pill.getAttribute('title')).not.toMatch(/set by a person/)
  })
  it('⭐ stated (no phrase): "from your figure", never "est. … not yet confirmed"', () => {
    seedCanvas(nodesFor(STATED_NO_PHRASE), [mapDraftEdgeToCanvas({ ...STATED_NO_PHRASE } as never, 0)])
    render(<EdgePills nodeId={STATED_NO_PHRASE.from} />)
    const id = edgeOf(STATED_NO_PHRASE).id
    expect(screen.getByTestId(`edge-pill-strength-stated-${id}`).getAttribute('title')).toContain('from your figure')
    expect(screen.queryByTestId(`edge-pill-strength-estimate-${id}`)).toBeNull()
  })
  it('control: Olumi’s unreviewed estimate keeps its "est." pill', () => {
    seedCanvas(nodesFor(OLUMI), [mapDraftEdgeToCanvas({ ...OLUMI } as never, 0)])
    render(<EdgePills nodeId={OLUMI.from} />)
    expect(screen.getByTestId(`edge-pill-strength-estimate-${edgeOf(OLUMI).id}`)).toBeTruthy()
  })
})

describe('P1-1 — the Model tab: an accepted or stated strength is not an unconfirmed estimate (toModelRows)', () => {
  /** Variant: CEE's V3 display for a `cee_hypothesis` link, the field the Model tab's attention keys on. */
  const withDisplay = (e: WireEdge) => ({ ...e, provenance_display: 'ai_inferred' })
  const rowFor = (e: WireEdge) => {
    const edge = mapDraftEdgeToCanvas(withDisplay(e) as never, 0)
    const rows = toModelRows({ nodes: nodesFor(e, 'factor') as never, edges: [edge] as never, goalThreshold: null })
    return rows.find((r) => r.kind === 'relationship' && r.id === edge.id)!
  }
  it('control: Olumi’s unreviewed estimate IS offered for confirmation', () => {
    expect(rowFor(OLUMI).attention).toContain('unconfirmed-estimate')
  })
  it('⭐ accepted: not offered again, and marked accepted', () => {
    const row = rowFor(ACCEPTED)
    expect(row.attention).not.toContain('unconfirmed-estimate')
    expect(row.provenanceAccepted).toBe(true)
  })
  it('⭐ stated: not offered as Olumi’s estimate, and its mark reads as the user’s brief', () => {
    const row = rowFor(STATED_NO_PHRASE)
    expect(row.attention).not.toContain('unconfirmed-estimate')
    expect(row.provenanceSource).toBe('brief_extraction')
  })
})

describe('P1-4 — update_edge: the labels are never taken from a payload key, and provenance decides them', () => {
  beforeEach(() => seedCanvas(nodesFor(ACCEPTED, 'factor'), [mapDraftEdgeToCanvas({ ...PRE_APPROVAL } as never, 0)]))
  const update = (data: Record<string, unknown>) =>
    act(() => { applyAutoApplyPatch({ operations: [{ op: 'update_edge', target_id: edgeOf(ACCEPTED).id, data }] } as never) })

  it('a spoofed strengthAccepted key with no provenance is dropped', () => {
    update({ strengthAccepted: 0.25 })
    expect(edgeOf(ACCEPTED).data.strengthAccepted).toBeUndefined()
  })
  it('an update carrying the confirm review acquires it', () => {
    update({ provenance: ACCEPTED.provenance })
    expect(isStrengthAccepted(edgeOf(ACCEPTED).data)).toBe(true)
  })
  it('an update carrying provenance WITHOUT the review removes it; one carrying none leaves it', () => {
    update({ provenance: ACCEPTED.provenance })
    update({ exists_probability: 0.8 }) // no provenance: says nothing about the label
    expect(isStrengthAccepted(edgeOf(ACCEPTED).data)).toBe(true)
    update({ provenance: PRE_PROV })
    expect(edgeOf(ACCEPTED).data.strengthAccepted).toBeUndefined()
  })
  // Codex r2 P1-2: provenance about one number never labels another.
  it('r3 · provenance arriving with a DIFFERENT strength (strength_mean / strength.mean) labels nothing', () => {
    update({ provenance: ACCEPTED.provenance, strength: { mean: 0.9, std: 0.1 } })
    expect(edgeOf(ACCEPTED).data.strengthAccepted).toBeUndefined()
    expect(isStrengthAccepted(edgeOf(ACCEPTED).data)).toBe(false)
    update({ provenance: ACCEPTED.provenance, strength_mean: 0.9 })
    expect(edgeOf(ACCEPTED).data.strengthAccepted).toBeUndefined()
  })
  it('r3 · control: provenance arriving with the SAME strength still labels it', () => {
    update({ provenance: ACCEPTED.provenance, strength: { mean: 0.25, std: 0.125 } })
    expect(isStrengthAccepted(edgeOf(ACCEPTED).data)).toBe(true)
  })
})

// Codex r2 P1-3: an acceptance of A→B is not an acceptance of A→C.
describe('r3 · update_edge REWIRE: the labels belong to the relationship, not the edge id', () => {
  let id = ''
  beforeEach(() => {
    seedCanvas(nodesFor(ACCEPTED, 'factor'), [mapDraftEdgeToCanvas({ ...ACCEPTED } as never, 0)])
    id = edgeOf(ACCEPTED).id
    expect(isStrengthAccepted(edgeOf(ACCEPTED).data)).toBe(true) // PRECONDITION
  })
  const update = (data: Record<string, unknown>) =>
    act(() => { applyAutoApplyPatch({ operations: [{ op: 'update_edge', target_id: id, data }] } as never) })
  const byId = (): any => useCanvasStore.getState().edges.find((x: any) => x.id === id)
  it.each([
    ['target only', { to: 'elsewhere' }],
    ['source only', { from: 'elsewhere' }],
    ['both', { from: 'elsewhere_a', to: 'elsewhere_b' }],
    ['target only (canvas spelling)', { target: 'elsewhere' }],
  ])('%s, with no provenance → cleared', (_n, data) => {
    update(data)
    expect(byId().data.strengthAccepted).toBeUndefined()
  })
  it('control: the same endpoints restated → kept', () => {
    update({ from: ACCEPTED.from, to: ACCEPTED.to })
    expect(isStrengthAccepted(byId().data)).toBe(true)
  })
  it('control: a rewire CARRYING the confirm review → labelled for the new relationship', () => {
    update({ to: 'elsewhere', provenance: ACCEPTED.provenance })
    expect(isStrengthAccepted(byId().data)).toBe(true)
  })
})

describe('P1-4 — the strength acknowledgement (parseV5Response → applyV5State)', () => {
  const target = `${ACCEPTED.from}→${ACCEPTED.to}`
  async function receive(after: Record<string, unknown>) {
    const body = {
      response_version: 2, assistant_text: '', suggested_actions: [], insights: [], stage_indicator: 'frame',
      blocks: [{
        type: 'graph_patch', operation: 'adjust_edge_strength', status: 'applied', target_id: target,
        before: { from: ACCEPTED.from, to: ACCEPTED.to, strength: ACCEPTED.strength, effect_direction: ACCEPTED.effect_direction },
        after,
      }],
    }
    const parsed = await parseV5Response(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }))
    expect(parsed.kind).toBe('response') // PRECONDITION: the producer-shaped body parses
    act(() => {
      const state = useCanvasStore.getState()
      // The real store operations, the `applyV5State.edgeAcknowledgement` spec's own set.
      const store: V5ApplicatorStore = {
        nodes: state.nodes, edges: state.edges,
        setCurrentStage: state.setCurrentStage,
        updateNode: state.updateNode,
        updateEdgeData: state.updateEdgeData,
        setRunMeta: state.setRunMeta,
        setCeeAnalysisReady: state.setCeeAnalysisReady,
      }
      applyV5State((parsed as any).response, store)
    })
  }
  beforeEach(() => seedCanvas(nodesFor(ACCEPTED, 'factor'), [mapDraftEdgeToCanvas({ ...PRE_APPROVAL } as never, 0)]))

  it('⭐ a signed acknowledgement carrying the confirm review acquires the label (it is no longer dropped)', async () => {
    expect(isStrengthAccepted(edgeOf(ACCEPTED).data)).toBe(false) // PRECONDITION
    await receive({ from: ACCEPTED.from, to: ACCEPTED.to, strength: ACCEPTED.strength, effect_direction: ACCEPTED.effect_direction, provenance: ACCEPTED.provenance })
    expect(isStrengthAccepted(edgeOf(ACCEPTED).data)).toBe(true)
  })
  it('a legacy-shaped acknowledgement never carries a payload strengthAccepted key onto the edge', async () => {
    await receive({ weight: 0.25, strengthAccepted: 0.25 })
    expect(edgeOf(ACCEPTED).data.strengthAccepted).toBeUndefined()
  })
  // Codex r2 P1-1: the clear must survive `updateEdgeData`'s shallow merge onto the stored data.
  const signed = { from: ACCEPTED.from, to: ACCEPTED.to, strength: ACCEPTED.strength, effect_direction: ACCEPTED.effect_direction }
  it('r3 · SIGNED: accepted, then a same-strength acknowledgement WITHOUT the review → no longer accepted', async () => {
    await receive({ ...signed, provenance: ACCEPTED.provenance })
    expect(isStrengthAccepted(edgeOf(ACCEPTED).data)).toBe(true) // PRECONDITION
    await receive({ ...signed, provenance: PRE_PROV })
    expect(edgeOf(ACCEPTED).data.strengthAccepted).toBeUndefined()
  })
  it('r3 · LEGACY: accepted, then a same-weight acknowledgement WITHOUT the review → no longer accepted', async () => {
    await receive({ ...signed, provenance: ACCEPTED.provenance })
    expect(isStrengthAccepted(edgeOf(ACCEPTED).data)).toBe(true) // PRECONDITION
    await receive({ weight: 0.25, provenance: PRE_PROV })
    expect(edgeOf(ACCEPTED).data.strengthAccepted).toBeUndefined()
  })
  it('r3 · class switch: accepted → stated holds ONE label, not both', async () => {
    await receive({ ...signed, provenance: ACCEPTED.provenance })
    await receive({ ...signed, provenance: { ...PRE_PROV, magnitude: 'user_stated' } })
    const data = edgeOf(ACCEPTED).data
    expect(data.strengthAccepted).toBeUndefined()
    expect(isStrengthStated(data)).toBe(true)
  })
})

// Codex r2 P1-5: `strengthStated` is a STRENGTH fact; it never credits the direction to the user.
describe('r3 · the hover card\'s Direction row (rendered <LinkHoverCard>)', () => {
  const directionWords = (wire: WireEdge) => {
    seedCanvas(nodesFor(wire), [mapDraftEdgeToCanvas({ ...wire } as never, 0)])
    const data = edgeOf(wire).data
    render(
      <LinkHoverCard
        edgeId={edgeOf(wire).id} labelX={0} labelY={0} zoom={1} surfaceRef={{ current: document.body as never }}
        arrowSentence="" doubtSentence={null} direction={resolveEdgeDirectionDisplay(data)} disputedSentence={null}
        strength={resolveEdgeSignedStrengthDisplay(data)} strengthSettled={false} strengthStated={isStrengthStated(data)}
        placeholderSentence={null} fragileSentence={null} size={edgeSizePhrase(data)}
      />,
    )
    const out = { stated: isStrengthStated(data), phrase: edgeSizePhrase(data), words: screen.getByTestId('edge-hover-direction').textContent }
    cleanup()
    return out
  }
  it('control: the served stated link (sign agrees) → "from your figure"', () => {
    const r = directionWords(STATED)
    expect(r.phrase?.usersFigure).toBe(true) // PRECONDITION: the phrase speaks
    expect(r.words).toContain('from your figure')
  })
  it('⭐ the stated figure with a CONTRADICTORY sign → the phrase refuses and the direction is NOT "from your figure"', () => {
    const flipped: WireEdge = { ...STATED, strength: { ...(STATED.strength as Record<string, unknown>), mean: 0.8 }, effect_direction: 'positive' }
    const r = directionWords(flipped)
    expect(r.stated).toBe(true) // PRECONDITION: the strength fact still holds
    expect(r.phrase).toBeNull() // PRECONDITION: the phrase refuses
    expect(r.words).not.toContain('from your figure')
  })
})
