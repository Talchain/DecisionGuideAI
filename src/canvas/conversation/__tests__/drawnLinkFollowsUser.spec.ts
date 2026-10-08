/**
 * ⛔ THE USER'S LINK IS NEVER QUEUED BEHIND OLUMI'S PROPOSAL (DL 58e392, 8 Oct; witnessed on staging 26cf0d86).
 * A drawn link's `structural_add_edge` can only be sent once the user states a strength. Pressing the drawn-link
 * proposal at draw time put an LLM turn in the one-turn pipe exactly while they chose it, their add was DEFERRED into a
 * memory-only buffer behind that turn, and a reload in that window lost the link. The proposal now FOLLOWS the user.
 * Bound by edge identity; the propose function is injected so every row names exactly what was (not) pressed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { proposeWhenLeftUnsized } from '../drawnLinkProposal'
import type { AskAiResult } from '../askAi'
import { useCanvasStore } from '../../store'
import { useInspectorPresenceStore } from '../../stores/inspectorPresenceStore'
import { canvasEdgePairKey } from '../../utils/graphIdentity'

const EDGE = 'e-drawn'
const unsized = { structuralAddStandDown: 'strength_not_stated', weightSource: 'default' }
const node = (id: string, type: string) => ({ id, type, position: { x: 0, y: 0 }, data: { label: id } })
function seed(data: Record<string, unknown> = unsized, selected = true) {
  useCanvasStore.setState({
    nodes: [node('fac_a', 'factor'), node('out_b', 'outcome')],
    edges: [{ id: EDGE, source: 'fac_a', target: 'out_b', data }],
    lastAuthoritativeGraph: { edgePairs: [] },
    selection: { nodeIds: new Set(), edgeIds: new Set(selected ? [EDGE] : []), anchorPosition: null },
  } as never)
}
const select = (ids: string[]) => useCanvasStore.setState(s => ({ selection: { ...s.selection, edgeIds: new Set(ids) } }) as never)
const setOpen = (open: boolean) => useInspectorPresenceStore.getState().setOpen(open)
let propose: ReturnType<typeof vi.fn<[string], AskAiResult>>

beforeEach(() => {
  setOpen(false)
  seed()
  propose = vi.fn<[string], AskAiResult>(() => 'sent' as AskAiResult)
})

describe('the drawn-link proposal follows the user, never their write', () => {
  it('is NOT pressed while the strength editor is in front of them', () => {
    const cancel = proposeWhenLeftUnsized(EDGE, propose)
    setOpen(true)
    useCanvasStore.setState(s => ({ nodes: [...s.nodes] }) as never) // an unrelated store change
    expect(propose).not.toHaveBeenCalled()
    cancel()
  })

  it('the user states a strength → nothing is proposed, ever (their figure wins; their add meets an idle pipe)', () => {
    proposeWhenLeftUnsized(EDGE, propose)
    setOpen(true)
    useCanvasStore.setState(s => ({ edges: s.edges.map(e => e.id === EDGE ? { ...e, data: { ...e.data, weightSource: 'user', structuralAddStandDown: undefined } } : e) }) as never)
    setOpen(false); select([])
    expect(propose).not.toHaveBeenCalled()
  })

  it('they LEAVE the link unsized (inspector closes) → ONE proposal, for that edge', () => {
    proposeWhenLeftUnsized(EDGE, propose)
    setOpen(true)
    setOpen(false)
    useCanvasStore.setState(s => ({ nodes: [...s.nodes] }) as never)
    expect(propose.mock.calls).toEqual([[EDGE]])
  })

  it('the selection moves off the link before the inspector ever raised → ONE proposal', () => {
    proposeWhenLeftUnsized(EDGE, propose)
    select(['other'])
    expect(propose.mock.calls).toEqual([[EDGE]])
  })

  it('the inspector has not raised yet (async) → a store change alone does not count as leaving', () => {
    proposeWhenLeftUnsized(EDGE, propose)
    useCanvasStore.setState(s => ({ nodes: [...s.nodes] }) as never)
    expect(propose).not.toHaveBeenCalled()
  })

  it('the link is removed → nothing is proposed', () => {
    proposeWhenLeftUnsized(EDGE, propose)
    setOpen(true)
    useCanvasStore.setState({ edges: [] } as never)
    setOpen(false)
    expect(propose).not.toHaveBeenCalled()
  })

  it('CONTROL: the server now holds the pair (sent) → nothing is proposed', () => {
    proposeWhenLeftUnsized(EDGE, propose)
    setOpen(true)
    useCanvasStore.setState({ lastAuthoritativeGraph: { edgePairs: [canvasEdgePairKey({ source: 'fac_a', target: 'out_b' })] } } as never)
    setOpen(false)
    expect(propose).not.toHaveBeenCalled()
  })
})
