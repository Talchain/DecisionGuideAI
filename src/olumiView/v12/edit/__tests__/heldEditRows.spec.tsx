/**
 * A1, NEVER HIDE AN EDIT (Paul's UI plan 24 Nov, PL c5e39da9): while Olumi's proposal is held, core takes no edit (`model.edit_base` null), so
 * every edit row is DRAWN DISABLED with core's reason and "Review Olumi’s proposal.", never omitted and never acting. Every other no-edit
 * reason (no saved model, an earlier version, another person's page) still omits its rows (Paul, 19 Nov). Frozen text: lane-authored.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from '../../../../canvas/ToastContext'
import { CanvasContextMenu } from '../../../../canvas/contextMenu/CanvasContextMenu'
import { buildLaneMenu, type LaneMenuCtx } from '../../../../canvas/contextMenu/laneMenu'
import { isMenuItem, type ContextTarget, type MenuItemDef, type MenuEntry } from '../../../../canvas/contextMenu/types'
import { chooseRedo, chooseUndo, clearLayoutUndo } from '../undo'
import { editGateNow } from '../editGate'
import { LaneEditingLayer } from '../LaneEditingLayer'
import { useLaneInspector } from '../inspectorStore'
import { useViewStore } from '../../../store'
import { TIP_DELAY } from '../../../look/Tip'
import { QUESTION } from '../../../layout'
import { BASE, SID, approved, install, uninstall, type Stub } from './harness'
import type { View } from '../../../client'

const WHY = 'Set aside the pending change first.'
const REASON = `${WHY} Review Olumi’s proposal.`
const flat = (es: MenuEntry[]): MenuItemDef[] => es.flatMap((e) => (isMenuItem(e) ? [e, ...(e.submenuItems ? flat(e.submenuItems) : [])] : []))
const byId = (es: MenuEntry[], id: string) => flat(es).find((i) => i.id === id)
const noUndo = { undo: chooseUndo({ undo: [], savedSeq: 0 }, null), redo: chooseRedo({ redo: [] }) }
const opened: unknown[] = []
const ctx = (gate: LaneMenuCtx['gate'], model = approved().model!): LaneMenuCtx => ({
  gate, model, undo: noUndo, level: 'simple', mode: 'select', questionId: QUESTION,
  act: { open: (s) => opened.push(s), openDetails: () => undefined, ask: () => undefined, pressUndo: () => undefined, autoArrange: () => undefined, toggleLevel: () => undefined },
})
const pane: ContextTarget = { kind: 'pane', screenPos: { x: 10, y: 10 } }
const fig = 'starting_customers'
const nodeT = (id: string): ContextTarget => ({ kind: 'node', nodeId: id, nodeType: 'factor', node: { id, position: { x: 0, y: 0 }, data: {} } as never, screenPos: { x: 10, y: 10 } })
const heldView = (): View => {
  const v = approved()
  return { ...v, proposal: { id: 4, base: 1, heading: 'A change', on: 'x' }, model: { ...v.model!, edit_base: null }, model_words: { ...(v.model_words ?? {}), withdrawnHeld: WHY } } as never
}
const HELD = { ok: false, why: WHY, held: true } as const
beforeEach(() => { opened.length = 0 })

describe('A1: the gate names a held proposal', () => {
  afterEach(() => { useViewStore.setState({ view: null, sid: null }) })
  it('while Olumi\'s change is held the gate says core\'s words and that a proposal is held', () => {
    useViewStore.setState({ sid: SID, view: heldView(), at: null, error: null, stale: false } as never)
    expect(editGateNow()).toEqual(HELD)
  })
})

describe('A1: the builder draws held edits disabled, with the reason', () => {
  it('the card menu keeps Rename and Add a claim, disabled, each with core\'s reason and "Review Olumi’s proposal."; pressing one opens nothing', () => {
    const m = buildLaneMenu(nodeT(fig), ctx(HELD))
    for (const id of ['rename', 'add-claim']) {
      expect(byId(m, id), id).toMatchObject({ enabled: false, disabledReason: REASON })
      byId(m, id)!.action()
    }
    expect(opened).toHaveLength(0)
  })
  it('the canvas menu keeps Add and every Add row, disabled with the same reason (the held reason wins over "Add a figure first")', () => {
    const m = buildLaneMenu(pane, ctx(HELD))
    expect(byId(m, 'add')).toBeDefined()
    for (const id of ['add-factor', 'add-option', 'add-risk', 'add-claim', 'add-question']) expect(byId(m, id), id).toMatchObject({ enabled: false, disabledReason: REASON })
    const none = buildLaneMenu(pane, ctx(HELD, { ...approved().model!, cards: [] }))
    expect(byId(none, 'add-risk')).toMatchObject({ enabled: false, disabledReason: REASON })
  })
  it('CONTRAST: a no-edit reason that is not a held proposal still omits the rows', () => {
    const m = buildLaneMenu(pane, ctx({ ok: false, why: 'There is no saved model to change yet.' }))
    for (const id of ['add', 'add-factor', 'add-option']) expect(byId(m, id), id).toBeUndefined()
    expect(byId(buildLaneMenu(nodeT(fig), ctx({ ok: false, why: 'x' })), 'rename')).toBeUndefined()
  })
  it('CONTRAST: with an edit open to core the same rows act', () => {
    const m = buildLaneMenu(nodeT(fig), ctx({ ok: true, sid: SID, base: BASE }))
    expect(byId(m, 'add-claim')).toMatchObject({ enabled: true })
    byId(m, 'add-claim')!.action()
    expect(opened).toHaveLength(1)
  })
})

describe('A1 mounted: held rows are reachable, say why, and do nothing', () => {
  let stub: Stub
  beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1'); stub = install(heldView()); clearLayoutUndo() })
  afterEach(() => { cleanup(); uninstall(); vi.unstubAllEnvs(); useLaneInspector.setState({ current: null }) })
  const Host = (): JSX.Element => {
    const target = useLaneInspector((s) => (s.current !== null && s.current.kind === 'menu' ? s.current.target : null))
    return <ToastProvider>{target === null ? null : <CanvasContextMenu target={target} onClose={() => useLaneInspector.getState().close('menu')} screenToFlowPosition={(p) => p} interactionMode="select" onSetInteractionMode={() => undefined} />}<LaneEditingLayer /></ToastProvider>
  }
  it('the right-click Rename row is drawn aria-disabled, says the reason on hover, and pressing it opens no editor', async () => {
    render(<Host />)
    act(() => useLaneInspector.getState().show({ kind: 'menu', target: nodeT(fig) }))
    const row = await screen.findByRole('menuitem', { name: /Rename/ })
    expect(row).toHaveAttribute('aria-disabled', 'true')
    // DS Button.md:24 and Paul's no-fade gate (noFadeAtRest): a disabled row is light ink, never reduced opacity.
    expect(row.className.split(/\s+/)).toContain('text-text-light')
    expect(row.className, 'no opacity token').not.toMatch(/(^|\s)opacity-\d+(\s|$)/)
    vi.useFakeTimers(); fireEvent.pointerEnter(row); act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect(screen.getByRole('tooltip').textContent, 'the reason is said on the row').toContain(REASON)
    vi.useRealTimers()
    fireEvent.click(row)
    expect(screen.queryByTestId('lane-inspector-name')).toBeNull()
    expect(screen.queryByTestId('lane-edit-form')).toBeNull()
    expect(stub.posts()).toHaveLength(0)
  })
  it('the details box keeps its edit chips: aria-disabled, focusable, saying the reason, and pressing one opens nothing', () => {
    render(<Host />)
    act(() => useLaneInspector.getState().open({ kind: 'card', id: fig }))
    fireEvent.click(screen.getByTestId('lane-inspector-more'))
    const chip = screen.getByTestId('lane-inspector-add-claim')
    expect(chip).toHaveAttribute('aria-disabled', 'true')
    expect(chip).not.toHaveAttribute('disabled')
    // DS Button.md:24, a disabled control reads as disabled by token, not opacity: the lane recipe styles aria-disabled, not only :disabled.
    for (const k of ['aria-disabled:text-text-light', 'aria-disabled:cursor-not-allowed']) expect(chip.className.split(/\s+/), k).toContain(k)
    vi.useFakeTimers(); fireEvent.pointerEnter(chip); act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect(screen.getByRole('tooltip').textContent, 'the reason is said on the chip').toContain(REASON)
    vi.useRealTimers()
    fireEvent.click(chip)
    expect(screen.queryByTestId('lane-edit-form')).toBeNull()
    expect(stub.posts()).toHaveLength(0)
  })
})
