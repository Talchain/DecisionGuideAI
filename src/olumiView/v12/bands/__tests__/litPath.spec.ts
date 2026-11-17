/**
 * The lit path on the cards (R1, 16 Nov: production's rule): the cards off the path of the hovered card, else of the selected one, fade to 0.25 and
 * only then; nothing is faded at rest. The link side is bound in v12/links/__tests__/links.spec.tsx ('the lit path'); this is the card side,
 * on the pure functions ViewCanvas uses (focusPath.ts), bound by node id.
 */
import { describe, expect, it } from 'vitest'
import { CARD_OFF_PATH_OPACITY, fadeOffPath, focusIdOf, type Fadeable } from '../focusPath'

const Q = 'page:question', CARD = 'viewCard'
const nodes: Fadeable[] = [
  { id: Q, type: 'viewQuestion' }, { id: 'a', type: CARD }, { id: 'b', type: CARD }, { id: 'c', type: CARD, selected: true },
  { id: 'idea:1', type: 'viewIdea' }, { id: 'group:inputs', type: 'viewFold' },
]
const faded = (out: Fadeable[]) => out.filter((n) => n.style?.opacity !== undefined).map((n) => n.id)

describe('which card lights the path', () => {
  it('LP1 the hovered card, else the selected one; hover wins over selection', () => {
    expect([focusIdOf(nodes, 'a', CARD), focusIdOf(nodes, null, CARD)]).toEqual(['a', 'c'])
  })
  it('LP1 CONTRAST: nothing hovered and nothing selected lights nothing; hovering the question, an idea or a fold lights nothing of its own (the selected card still does)', () => {
    const none = nodes.map((n) => ({ ...n, selected: false }))
    expect(focusIdOf(none, null, CARD)).toBeNull()
    expect([focusIdOf(none, Q, CARD), focusIdOf(none, 'idea:1', CARD), focusIdOf(none, 'group:inputs', CARD)]).toEqual([null, null, null])
    expect(focusIdOf(nodes, Q, CARD), 'the question hovered: the selected card still lights its path').toBe('c')
  })
})

describe('which cards fade', () => {
  it('LP2 at rest (no path) no node carries an opacity or the off-path class, and the same array comes back', () => {
    const out = fadeOffPath(nodes, null, Q)
    expect([out === nodes, faded(out), out.some((n) => (n.className ?? '').includes('v12-off-path'))]).toEqual([true, [], false])
  })
  it('LP2 with a path lit: every node off it fades to 0.25 (class v12-off-path); the question and the nodes on the path never do', () => {
    const out = fadeOffPath(nodes, new Set(['a', 'b']), Q)
    expect(faded(out)).toEqual(['c', 'idea:1', 'group:inputs'])
    expect(out.find((n) => n.id === 'c')!.style!.opacity, 'production\'s own 0.25').toBe(0.25)
    expect(CARD_OFF_PATH_OPACITY).toBe(0.25)
    expect(out.find((n) => n.id === 'c')!.className).toContain('v12-off-path')
    for (const id of [Q, 'a', 'b']) expect(out.find((n) => n.id === id)!.style?.opacity, `${id} stays`).toBeUndefined()
  })
  it('LP2 a kept idea and the folded inputs\' group are on no causal path, so they fade with the rest while a path is lit (deliberate: they are not the lit card\'s reasoning); a node\'s own style and class are kept', () => {
    const out = fadeOffPath([{ id: 'x', type: CARD, className: 'mine', style: { color: 'red' } }, { id: 'idea:1', type: 'viewIdea' }], new Set(['z']), Q)
    expect(out[0]).toMatchObject({ id: 'x', className: 'mine v12-off-path', style: { color: 'red', opacity: 0.25 } })
    expect(faded(out)).toEqual(['x', 'idea:1'])
  })
})
