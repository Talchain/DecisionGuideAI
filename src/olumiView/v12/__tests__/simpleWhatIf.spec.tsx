/**
 * Codex 006 (what-if, non-blocking): Simple drew only the SAVED figure while another was tried, and the what-if panel said "No chance yet"
 * with no aim beside another aim's result. Bound on core's REAL what-if answer (fixtures/v11/consulting-whatif-priya.json, base 18) over the
 * View it was asked on (consulting-chain), through the real card (CoreCard, Simple) and the real panel (WhatIfShown). By card and aim id.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<object>('@xyflow/react')), Handle: () => null }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { clearWhatIf, useWhatIf, type WhatIfAnswer } from '../../whatif'
import { CoreCard } from '../../previous/CoreCard'
import { WhatIfShown } from '../../ViewChances'
import { setDefaultLevel, useSimpleLevel } from '../simpleStore'

const DIR = path.resolve('src/olumiView/fixtures/v11')
const view = JSON.parse(readFileSync(path.join(DIR, 'consulting-chain.view3.json'), 'utf8')) as View
const answer = JSON.parse(readFileSync(path.join(DIR, 'consulting-whatif-priya.json'), 'utf8')) as WhatIfAnswer
const variant = answer.variants[0]!
const Q = 'diagnostic_time_to_contract', TYPED = '6 to 12 months'
const card = (id: string) => view.model!.cards.find((c) => c.id === id)!
const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
const props = (id: string): NodeProps => ({ id, type: 'viewCard', data: { card: card(id) }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
  positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)
const draw = (id: string) => render(<ReactFlowProvider><Node {...props(id)} /></ReactFlowProvider>).container

beforeEach(() => {
  window.localStorage.clear(); useSimpleLevel.setState({ levels: {} }); setDefaultLevel('simple')
  useViewStore.setState({ view, sid: view.id, uuid: null, status: 'ready', error: null })
})
afterEach(() => { cleanup(); clearWhatIf(); setDefaultLevel('simple'); useViewStore.setState(useViewStore.getInitialState(), true) })

describe('What if in Simple: the card says what is tried and what is saved', () => {
  it('W1 the tried card says "Trying" and the figure as typed, and names the saved figure beside it', () => {
    act(() => { useWhatIf.setState({ shown: { sid: view.id, base: 18, quantity: Q, typed: TYPED, variant } }) })
    const c = draw(Q), saved = card(Q).figure!.text
    expect(saved, 'precondition: a saved figure to name').not.toBe('')
    expect(c.querySelector(`[data-simple-try="${Q}"]`)?.textContent).toContain(`Trying ${TYPED}`)
    expect(c.querySelector(`[data-simple-saved="${Q}"]`)?.textContent).toBe(`Saved: ${saved}`)
    expect(c.querySelector('[data-simple-face="figure"]'), 'the saved figure alone is not the face while it is tried').toBeNull()
  })
  it('W2 CONTRAST: with nothing tried, the card draws its saved figure and no try', () => {
    const c = draw(Q)
    expect(c.querySelector(`[data-simple-try="${Q}"]`)).toBeNull()
    expect(c.querySelector('[data-simple-face="figure"]')?.textContent).toBe(card(Q).figure!.text)
  })
  it('W3 CONTRAST: a what-if on another version draws nothing on the card', () => {
    act(() => { useWhatIf.setState({ shown: { sid: view.id, base: 17, quantity: Q, typed: TYPED, variant } }) })
    expect(draw(Q).querySelector(`[data-simple-try="${Q}"]`)).toBeNull()
  })
})

describe('the what-if panel names the aim of a row with no chance', () => {
  const aim = view.model!.cards.find((c) => c.family === 'goal')!
  it('W4 a "none" row is said with its aim\'s own heading; a chance row is not given a second name', () => {
    const o = variant.rows[0]!
    const none = { kind: 'none', aim_id: aim.id, text: 'No chance yet', title: 'Not worked out for this aim' }
    const tried = { ...variant, rows: [{ ...o, rows: [...o.rows, none] }, ...variant.rows.slice(1)] } as typeof variant
    act(() => { useWhatIf.setState({ shown: { sid: view.id, base: 18, quantity: Q, typed: TYPED, variant: tried } }) })
    const box = render(<WhatIfShown model={view.model!} />).container
    const named = box.querySelectorAll(`[data-whatif-aim="${aim.id}"]`)
    expect(named).toHaveLength(1)
    expect(named[0]!.textContent).toBe(`${aim.heading}No chance yet`)
    // Every named row is a "none" row with an aim (the fixture's own and the one added); no chance row is wrapped.
    const nones = tried.rows.flatMap((r) => r.rows).filter((r) => r.kind === 'none' && (r as { aim_id?: string | null }).aim_id != null).length
    expect(box.querySelectorAll('[data-whatif-aim]').length).toBe(nones)
    expect(tried.rows.flatMap((r) => r.rows).some((r) => r.kind === 'chance'), 'CONTRAST: chance rows are present, and none is named').toBe(true)
  })
})
