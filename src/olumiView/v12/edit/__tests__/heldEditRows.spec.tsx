/**
 * A1, NEVER HIDE AN EDIT (Paul's UI plan 24 Nov, PL c5e39da9): while Olumi's proposal is held, core takes no edit (`model.edit_base` null), so
 * every edit row is DRAWN DISABLED with core's reason and "Review Olumi’s proposal.", never omitted and never acting. Every other no-edit
 * reason (no saved model, an earlier version, another person's page) still omits its rows (Paul, 19 Nov). Frozen text: lane-authored.
 */
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '../../../../canvas/ToastContext'
import { CanvasContextMenu } from '../../../../canvas/contextMenu/CanvasContextMenu'
import { buildLaneMenu, type LaneMenuCtx } from '../../../../canvas/contextMenu/laneMenu'
import { useLaneCtx } from '../../../../canvas/contextMenu/useLaneMenu'
import { isMenuItem, type ContextTarget, type MenuItemDef, type MenuEntry } from '../../../../canvas/contextMenu/types'
import { useUIStore } from '../../../../stores/uiStore'
import { chooseRedo, chooseUndo, clearLayoutUndo } from '../undo'
import { editGateNow } from '../editGate'
import { LaneEditingLayer } from '../LaneEditingLayer'
import { useLaneInspector } from '../inspectorStore'
import { useViewStore } from '../../../store'
import { useProposalAsk } from '../../chat/proposalAsk'
import * as proposalAsk from '../../chat/proposalAsk'
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
  gate, reviewVersion: null, model, undo: noUndo, level: 'simple', mode: 'select', questionId: QUESTION,
  act: { open: (s) => opened.push(s), openDetails: () => undefined, ask: () => undefined, pressUndo: () => undefined, autoArrange: () => undefined, toggleLevel: () => undefined },
})
const pane: ContextTarget = { kind: 'pane', screenPos: { x: 10, y: 10 } }
const fig = 'starting_customers'
const nodeT = (id: string): ContextTarget => ({ kind: 'node', nodeId: id, nodeType: 'factor', node: { id, position: { x: 0, y: 0 }, data: {} } as never, screenPos: { x: 10, y: 10 } })
const edgeT = (index: number): ContextTarget => ({ kind: 'edge', edgeId: 'e', isStructural: false, screenPos: { x: 10, y: 10 }, edge: { id: 'e', data: { link: approved().model!.links[index] } } as never })
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

describe('reviewing a held proposal from the menu', () => {
  const menus = [
    { name: 'card', target: nodeT(fig), firstEdit: 'rename' },
    { name: 'link', target: edgeT(1), firstEdit: 'size' },
    { name: 'pane', target: pane, firstEdit: 'add' },
  ]

  it.each(menus)('the $name menu offers one enabled Review row immediately before its edits', ({ target, firstEdit }) => {
    const review = vi.fn(), c = ctx(HELD)
    const menu = buildLaneMenu(target, { ...c, act: { ...c.act, review } })
    const rows = flat(menu).filter((row) => row.id === 'review-proposal')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ iconId: 'olumi-mark', tooltip: WHY, enabled: true })
    expect(menu[menu.indexOf(rows[0]!) + 1]).toMatchObject({ id: firstEdit })
    rows[0]!.action()
    expect(review).toHaveBeenCalledTimes(1)
    expect(opened).toHaveLength(0)
  })

  it('keeps the held link edits disabled with the same reason and offers Review even on a link without edits', () => {
    const review = vi.fn(), c = ctx(HELD)
    const withReview = { ...c, act: { ...c.act, review } }
    const editable = buildLaneMenu(edgeT(1), withReview)
    for (const id of ['size', 'remove-link']) {
      const row = byId(editable, id)!
      expect(row).toMatchObject({ enabled: false, disabledReason: REASON })
      row.action()
    }
    expect(opened).toHaveLength(0)
    expect(review).not.toHaveBeenCalled()
    const plain = buildLaneMenu(edgeT(0), withReview)
    expect(byId(plain, 'size')).toBeUndefined()
    expect(byId(plain, 'remove-link')).toBeUndefined()
    expect(flat(plain).filter((row) => row.id === 'review-proposal')).toHaveLength(1)
  })

  it('omits Review if editing is allowed, the refusal is unrelated, or there is no review action', () => {
    const allowed = ctx({ ok: true, sid: SID, base: BASE }), refused = ctx({ ok: false, why: WHY })
    const review = vi.fn()
    for (const { target } of menus) {
      for (const c of [allowed, refused]) {
        expect(byId(buildLaneMenu(target, { ...c, act: { ...c.act, review } }), 'review-proposal')).toBeUndefined()
      }
      expect(byId(buildLaneMenu(target, ctx(HELD)), 'review-proposal')).toBeUndefined()
    }
  })
})

describe('A1 mounted: held rows are reachable, say why, and do nothing', () => {
  let stub: Stub
  beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1'); stub = install(heldView()); clearLayoutUndo() })
  afterEach(() => { cleanup(); uninstall(); vi.unstubAllEnvs(); useLaneInspector.setState({ current: null }); useProposalAsk.setState(useProposalAsk.getInitialState()) })
  const Host = (): JSX.Element => {
    const target = useLaneInspector((s) => (s.current !== null && s.current.kind === 'menu' ? s.current.target : null))
    return <ToastProvider>{target === null ? null : <CanvasContextMenu target={target} onClose={() => useLaneInspector.getState().close('menu')} screenToFlowPosition={(p) => p} interactionMode="select" onSetInteractionMode={() => undefined} />}<LaneEditingLayer /></ToastProvider>
  }
  it('pressing Review from the graph asks for the held proposal and closes the menu', async () => {
    render(<Host />)
    act(() => useLaneInspector.getState().show({ kind: 'menu', target: nodeT(fig) }))
    const row = await waitFor(() => {
      const item = screen.getByRole('menu').querySelector('[data-menu-row="review-proposal"]')
      expect(item).toBeInTheDocument()
      return item!
    })
    fireEvent.click(row)
    expect(useProposalAsk.getState().id).toBe(heldView().proposal!.id)
    expect(useLaneInspector.getState().current).toBeNull()
    expect(stub.posts()).toHaveLength(0)
  })
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

describe('saved version review menus', () => {
  const saved: View = JSON.parse(readFileSync('src/olumiView/golden/capacity-v3.view.json', 'utf8'))
  const changes = [
    { id: 'goal', top: true, text: 'Set the capacity goal.', detail: 'The threshold is per week.', family: 'aim', olumi: null },
    { id: 'demand', top: false, text: 'Add weekend demand.', detail: '', family: 'quantity', olumi: { glyph: '✦', title: 'Olumi estimated demand' } },
    { id: 'staff', top: false, text: 'Add the staffing constraint.', detail: '', family: 'limit', olumi: null },
  ]
  const version = { ...saved.version!, review: { changes, groups: null } }
  const reviewed = { ...saved, proposal: null, version }
  const pending = { ...reviewed, proposal: heldView().proposal, model: { ...reviewed.model!, edit_base: null } }
  const targets = [nodeT(saved.model!.cards[0]!.id), edgeT(1), pane]
  const options = { showToast: vi.fn(), onClose: vi.fn(), openForm: vi.fn() }
  const reviewRows = (target: ContextTarget, c: LaneMenuCtx) => flat(buildLaneMenu(target, c)).filter(({ id }) => id === 'review-proposal' || id === 'review-version')

  beforeEach(() => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    options.onClose.mockClear()
    install(reviewed)
    useUIStore.setState({ activeOutputTab: 'results' })
  })
  afterEach(() => {
    cleanup()
    uninstall()
    vi.unstubAllEnvs()
    useProposalAsk.setState(useProposalAsk.getInitialState())
    const ask = proposalAsk.useVersionAsk
    ask?.setState(ask.getInitialState())
    useUIStore.setState(useUIStore.getInitialState())
  })

  it('offers one saved Review row in the card, link and board menus, gives held proposals their own action, and omits Review without either', () => {
    const { result } = renderHook(() => useLaneCtx(options))
    for (const target of targets) {
      const rows = reviewRows(target, result.current)
      expect(rows).toMatchObject([{ id: 'review-version', label: 'Review the changes', iconId: 'version-tag', enabled: true }])
      const n = proposalAsk.useVersionAsk.getState().n
      act(() => rows[0]!.action())
      expect(proposalAsk.useVersionAsk.getState()).toEqual({ id: version.id, n: n + 1 })
      expect(useProposalAsk.getState().id).toBeNull()
      expect(useUIStore.getState().activeOutputTab).toBe('olumi')
    }

    act(() => useViewStore.setState({ view: pending }))
    const savedAsk = proposalAsk.useVersionAsk.getState()
    for (const target of targets) {
      const rows = reviewRows(target, result.current)
      expect(rows).toMatchObject([{ id: 'review-proposal', label: 'Review Olumi’s proposal', iconId: 'olumi-mark', enabled: true }])
      const n = useProposalAsk.getState().n
      act(() => rows[0]!.action())
      expect(useProposalAsk.getState()).toEqual({ id: pending.proposal!.id, n: n + 1 })
      expect(proposalAsk.useVersionAsk.getState()).toBe(savedAsk)
    }
    expect(options.onClose).toHaveBeenCalledTimes(2 * targets.length)

    act(() => useViewStore.setState({ view: { ...saved, proposal: null } }))
    for (const target of targets) expect(reviewRows(target, result.current)).toEqual([])
  })

  it('binds each drawn card, link and board Review action to its version through a replacement or a pending proposal', () => {
    const { result } = renderHook(() => useLaneCtx(options))
    const rows = targets.map((target) => {
      const row = byId(buildLaneMenu(target, result.current), 'review-version')
      expect(row).toBeDefined()
      return row!
    })

    const newer = { ...version, id: version.id + 1, label: 'version 2', review: { changes: [...changes].reverse(), groups: null } }
    for (const view of [{ ...reviewed, version: newer }, pending]) {
      act(() => useViewStore.setState({ view }))
      const savedAsk = proposalAsk.useVersionAsk.getState()
      const heldAsk = useProposalAsk.getState()
      const ui = useUIStore.getState()
      for (const row of rows) {
        act(() => row.action())
        expect(proposalAsk.useVersionAsk.getState()).toBe(savedAsk)
        expect(useProposalAsk.getState()).toBe(heldAsk)
        expect(useProposalAsk.getState().id).toBeNull()
        expect(useUIStore.getState()).toBe(ui)
        expect(useUIStore.getState().activeOutputTab).toBe('results')
      }
    }

    act(() => useViewStore.setState({ view: reviewed }))
    for (const row of rows) {
      const n = proposalAsk.useVersionAsk.getState().n
      act(() => row.action())
      expect(proposalAsk.useVersionAsk.getState()).toEqual({ id: version.id, n: n + 1 })
      expect(useProposalAsk.getState().id).toBeNull()
      expect(useUIStore.getState().activeOutputTab).toBe('olumi')
    }
  })
})
