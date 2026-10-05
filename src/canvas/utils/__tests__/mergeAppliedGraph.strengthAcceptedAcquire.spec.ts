/**
 * ⭐ GATE 5 ITEM 2 — AN ACCEPTED OLUMI STRENGTH SAYS SO, AFTER THE APPROVAL AND AFTER A RELOAD (DL 0df0e1, 5 Oct 2026).
 *
 * Joined-witness GAP-1: after the user approved Olumi's suggested strength, the canvas still read "Olumi's estimate"
 * with an `est.` marker whose own sentence is "Estimate not yet confirmed", while Compare said "You accepted Olumi's
 * estimate…". CEE records the approval as review (`provenance.reviewed_by_user` confirm, authorship byte-identical,
 * served 8feb2617 `adjust-edge-strength.ts:466-479`); the canvas dropped it, and an approval moves no number, so the
 * merge (rightly) never restated who supplied the unchanged value.
 *
 * CORPUS: served cold-read edges, copied verbatim (`../../domain/__tests__/fixtures/servedLinkSizing.20261005.json`,
 * sources in its `_source`). The pre-approval edge is the served accepted edge minus its review — the bytes CEE held
 * before the confirm, since the confirm writes only that key. Driven through the real `mapDraftEdgeToCanvas`,
 * `reconcileAppliedGraph` (the approval receipt) and `mergeServerGraphOnHydrate` (the reload), bound by from → to.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import served from '../../domain/__tests__/fixtures/servedLinkSizing.20261005.json'
import { reconcileAppliedGraph } from '../mergeAppliedGraph'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import { mapDraftEdgeToCanvas } from '../applyDraftResult'
import { useCanvasStore } from '../../store'
import { counts, seedCanvas } from './__helpers__/mergeAppliedGraphHarness'
import { strengthIsHumanSettled } from '../../domain/edgeStrengthSettlement'
import { edgeValueSource } from '../../domain/edgeValueProvenance'
import { edgeSizePhrase } from '../../edges/edgeSizePhrase'
import { linkStrengthSourceWords } from '../../components/hoverCard/LinkHoverCard'
import { buildExamineLinkView } from '../../ui/inspector-v2/examine/examineLinkView'
import { resolveEdgeValuesProvenance } from '../../ui/inspector-v2/coachingConfig'
import { isStrengthAccepted } from '../../domain/strengthAccepted'

type WireEdge = Record<string, unknown> & { from: string; to: string; provenance: Record<string, unknown> }
const ACCEPTED = served.accepted as unknown as WireEdge
const { reviewed_by_user: _review, ...PRE_APPROVAL_PROVENANCE } = ACCEPTED.provenance
const PRE_APPROVAL: WireEdge = { ...ACCEPTED, provenance: PRE_APPROVAL_PROVENANCE }
const FROM = ACCEPTED.from
const TO = ACCEPTED.to

const NODES = [
  { id: FROM, type: 'factor', position: { x: 40, y: 200 }, data: { kind: 'factor', label: 'Sprint capacity for integration fix' } },
  { id: TO, type: 'factor', position: { x: 400, y: 200 }, data: { kind: 'factor', label: 'Integration step bug resolution' } },
]
const WIRE_NODES = [
  { id: FROM, kind: 'factor', label: 'Sprint capacity for integration fix' },
  { id: TO, kind: 'factor', label: 'Integration step bug resolution' },
]
const ACCEPTED_WORDS = "Olumi's estimate, accepted" // DL 0df0e1 words: Compare's `sizingWords('olumi_accepted')`

const theEdge = (): any => useCanvasStore.getState().edges.find((e: any) => e.source === FROM && e.target === TO)

/** What each link surface says about whose strength this is, read through its own production function. */
function surfaces(data: Record<string, unknown>) {
  const settled = strengthIsHumanSettled(data)
  const source = edgeValueSource(data, 'weight')
  return {
    settled,
    hover: linkStrengthSourceWords(settled, source ?? 'cee', false, edgeSizePhrase(data)?.usersFigure === true),
    examine: buildExamineLinkView({ sourceLabel: 'A', targetLabel: 'B', data, structural: false, fragile: false }),
    inspector: resolveEdgeValuesProvenance({
      strength: source,
      existence: edgeValueSource(data, 'beliefExists'),
      strengthAccepted: data.strengthAccepted !== undefined && settled,
    } as Parameters<typeof resolveEdgeValuesProvenance>[0]),
  }
}

describe('⭐ the approval receipt: Olumi’s estimate, now accepted', () => {
  beforeEach(() => {
    const mapped = mapDraftEdgeToCanvas({ ...PRE_APPROVAL } as never, 0)
    expect(mapped.data.strengthAccepted).toBeUndefined() // PRECONDITION: before the confirm
    seedCanvas(NODES, [mapped])
  })

  it('acquires strengthAccepted, counts no update and writes no history', () => {
    const history = useCanvasStore.getState().history
    const before = theEdge()
    const result = reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [{ ...ACCEPTED }] } as any)
    expect(theEdge().data.strengthAccepted).toBe(0.25)
    expect(result).toEqual(counts())
    expect(useCanvasStore.getState().history).toBe(history)
    const { strengthAccepted: _acquired, ...rest } = theEdge().data
    expect(rest).toEqual(before.data)
  })

  it('⭐ then the hover, the examine pane and the inspector all say accepted — and nothing calls it unconfirmed', () => {
    expect(surfaces(theEdge().data).hover).toBe('Olumi’s estimate') // PRECONDITION: before the receipt
    reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [{ ...ACCEPTED }] } as any)
    const s = surfaces(theEdge().data)
    expect(s.settled).toBe(true) // the `est.` marker ("Estimate not yet confirmed") is gated on !settled
    expect(s.hover).toBe(ACCEPTED_WORDS)
    expect(s.examine?.basis).toBe('accepted')
    expect(s.examine?.why).toBe('You accepted Olumi’s estimate. It is still an estimate, not a measurement.')
    expect(s.inspector.startsWith('You accepted Olumi’s estimate of this strength.')).toBe(true)
  })

  /**
   * METADATA-ONLY, not merely acquired (the `strengthPlaceholderAcquire` twin): otherwise the label's arrival reads as a
   * changed value, the whole receipt is spread over the edge, and a stamp the canvas holds on an UNCHANGED value is
   * rewritten — a counted update and a history entry. The case above cannot see that, so the canvas holds a stamp the
   * receipt does not carry.
   */
  it('acquiring it never rewrites a stamp the canvas holds on an unchanged value', () => {
    useCanvasStore.setState({
      edges: useCanvasStore.getState().edges.map((e: any) =>
        e.source === FROM && e.target === TO ? { ...e, data: { ...e.data, beliefExistsSource: 'user' } } : e,
      ),
    })
    const before = theEdge()
    expect(before.data.beliefExistsSource).toBe('user') // PRECONDITION: the canvas stamp
    expect(mapDraftEdgeToCanvas({ ...ACCEPTED } as never, 0).data.beliefExistsSource).not.toBe('user') // PRECONDITION
    const history = useCanvasStore.getState().history
    const result = reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [{ ...ACCEPTED }] } as any)
    expect(theEdge().data.strengthAccepted).toBe(0.25)
    expect(theEdge().data.beliefExistsSource).toBe('user')
    expect(result).toEqual(counts())
    expect(useCanvasStore.getState().history).toBe(history)
  })

  it('a later receipt that no longer records the review drops the label (absence is the server’s truth)', () => {
    reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [{ ...ACCEPTED }] } as any)
    expect(theEdge().data.strengthAccepted).toBe(0.25) // PRECONDITION
    const result = reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [{ ...PRE_APPROVAL }] } as any)
    expect(theEdge().data.strengthAccepted).toBeUndefined()
    expect(result).toEqual(counts())
  })

  it('the person’s own edit retires it with nothing written (staleness by construction)', () => {
    reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [{ ...ACCEPTED }] } as any)
    const edited = { ...theEdge().data, weight: 0.6, weightSource: 'user' }
    expect(edited.strengthAccepted).toBe(0.25) // the key is still there…
    const s = surfaces(edited)
    expect(s.hover).toBe('Set by you') // …but the person's figure speaks
    expect(s.examine).toBeNull()
  })

  it('…even when the person sets the very same number: it is theirs now, not an accepted estimate', () => {
    reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [{ ...ACCEPTED }] } as any)
    expect(isStrengthAccepted(theEdge().data)).toBe(true) // PRECONDITION
    expect(isStrengthAccepted({ ...theEdge().data, weightSource: 'user' })).toBe(false)
  })
})

describe('⭐ the reload: the boot read acquires it too, and it is not a changed value', () => {
  it('a canvas saved before the approval, reloaded onto the accepted server edge', () => {
    seedCanvas(NODES, [mapDraftEdgeToCanvas({ ...PRE_APPROVAL } as never, 0)])
    const result = mergeServerGraphOnHydrate({ nodes: WIRE_NODES, edges: [{ ...ACCEPTED }] })
    expect(result.accepted).toBe(true)
    expect(theEdge().data.strengthAccepted).toBe(0.25)
    // `updatedEdgeCount` counts any store change on the boot path, acquisitions included (as for `naturalEffect` and
    // `strengthPlaceholder`). "Not an edit" is the value-change set (`comparableReadback`): no undo entry, no pulse.
    expect(useCanvasStore.getState().history.past).toHaveLength(0)
    expect(surfaces(theEdge().data).hover).toBe(ACCEPTED_WORDS)
  })
})

describe('controls: the classes that are NOT accepted keep their own words', () => {
  it('Olumi’s estimate with no review stays Olumi’s estimate, open to examine', () => {
    const data = mapDraftEdgeToCanvas({ ...(served.olumi as object) } as never, 0).data
    expect(data.strengthAccepted).toBeUndefined()
    const s = surfaces(data)
    expect(s.settled).toBe(false)
    expect(s.hover).toBe('Olumi’s estimate')
    expect(s.examine?.basis).toBe('olumi_estimate')
  })

  it('a review that is not a confirm (e.g. a pairing quote) is not an acceptance', () => {
    const pairing = { ...ACCEPTED, provenance: { ...PRE_APPROVAL_PROVENANCE, reviewed_by_user: { intent: 'confirm_pairing' } } }
    expect(mapDraftEdgeToCanvas(pairing as never, 0).data.strengthAccepted).toBeUndefined()
  })

  it('the user’s own strength (user_specified) is never "accepted", whatever magnitude rides with it (CEE’s rule order)', () => {
    const userSet = served.userSet as unknown as WireEdge
    const withReview = {
      ...userSet,
      provenance: { ...userSet.provenance, magnitude: 'olumi_estimate', reviewed_by_user: { intent: 'confirm' } },
    }
    const data = mapDraftEdgeToCanvas(withReview as never, 0).data
    expect(data.strengthAccepted).toBeUndefined()
    expect(surfaces(data).hover).toBe('Set by you')
  })
})

describe('⭐ C2 — a strength sized from the user’s own figure is not "Olumi estimated" (RA 21-j4-49)', () => {
  const data = () => mapDraftEdgeToCanvas({ ...(served.userStated as object) } as never, 0).data

  it('the examine pane does not challenge it as Olumi’s estimate', () => {
    expect(edgeSizePhrase(data())?.usersFigure).toBe(true) // PRECONDITION: the served user_stated link
    expect(surfaces(data()).examine).toBeNull()
  })

  it('…unless the last Run found it fragile, on that basis', () => {
    expect(buildExamineLinkView({ sourceLabel: 'A', targetLabel: 'B', data: data(), structural: false, fragile: true })?.basis)
      .toBe('analysis')
  })

  it('control: the hover keeps "from your figure" (Beat 1, unchanged)', () => {
    expect(surfaces(data()).hover).toBe('from your figure')
  })
})
