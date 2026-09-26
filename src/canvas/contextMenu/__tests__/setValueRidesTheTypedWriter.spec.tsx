/**
 * ⭐⭐ THE CONTEXT MENU'S "SET VALUE" RIDES THE CARD'S WRITER — ONE WRITER, NOT TWO.
 *
 * THE GAP (26 Sep 2026). Right-click → Set value ▸ Best case / Worst case /
 * Reset to observed / Custom value wrote through `commitValidatedMutation(ops,
 * () => store.updateNode(...))` — the LOCAL canvas store only — and stashed a
 * UI-only `_baseline_snapshot` on the node. The card's inline value editor and
 * the Model tab write the same number through `useModelEditAuthority
 * .proposeFactorValue` → `factor_value_edit`, which carries provenance, CEE's
 * receipt and the edit-delivery hold. So a menu value looked set on the card
 * and was not in CEE's model; the next Run or reload disagreed with the screen.
 *
 * WHAT IS PINNED, BY IDENTITY:
 *   · the menu's Best case / Worst case / Custom call the SAME authority the
 *     card does, keyed to THIS node id, with the exact number, and write
 *     nothing locally of their own (the spy writer writes nothing, so any store
 *     change is a second writer);
 *   · the contrast row: the card's inline editor produces the IDENTICAL call —
 *     and, with the real writer and a mounted conversation, the identical wire
 *     event;
 *   · a refusal says what the card says, where the user acted;
 *   · Reset is gone (no truthful restore target exists without the UI-only
 *     snapshot — omit, never invent);
 *   · a range bound is MODEL scale and is proposed only where that is the scale
 *     the writer reads. On a capped £ factor the writer reads £, so "0.5" would
 *     land as £0.50 — the P0 class `FactorNode.inlineEditorSeedsTheCommitScale`
 *     records. There the row is withheld with a reason.
 *
 * ⚠ THE ROW IS WITHHELD ON SERVED MENUS TODAY. `set-value` sits in
 * `LOCAL_SEMANTIC_CONTEXT_MENU_IDS` and `canvasSemanticMutations` is
 * `'disabled'`, so `applyContextMenuMutationAuthority` hides it. This spec opens
 * that one key so the ACTION can be exercised through the real menu host; it
 * says nothing about whether the row is shown in production.
 *
 * CLAIM SCOPE: jsdom — the writer call, the wire event and the store; not layout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import { CanvasContextMenu } from '../CanvasContextMenu'
import { FactorNode } from '../../nodes/FactorNode'
import type { NodeTarget } from '../types'
import { VALUE_COMMIT_SETTLEMENT_COPY } from '../../conversation/valueCommitSettlement'
import * as settlementModule from '../../conversation/valueCommitSettlement'
import * as scaleModule from '../../conversation/factorValueEdit'
import * as actionsModule from '../actions'

// ── the host's toast ────────────────────────────────────────────────────────
const toast = vi.hoisted(() => ({ spy: vi.fn() }))
vi.mock('../../ToastContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../ToastContext')>()),
  useShowToast: () => toast.spy,
  useShowToastSafe: () => toast.spy,
}))

// ── open the ONE key that withholds the row on served menus (see header) ───
vi.mock('../../mutations/mutationAuthority', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../mutations/mutationAuthority')>()
  return {
    ...actual,
    CANONICAL_EDIT_AUTHORITY: { ...actual.CANONICAL_EDIT_AUTHORITY, canvasSemanticMutations: 'server_graph' },
  }
})

// ── the writer: a spy by default, the REAL authority for the wire rows ──────
type WriterOutcome = 'dispatched' | 'local_only' | 'not_encodable'
const writer = vi.hoisted(() => ({
  mode: 'spy' as 'spy' | 'real',
  calls: [] as Array<{ nodeId: string | null; typedValue: number }>,
  outcome: 'dispatched' as 'dispatched' | 'local_only' | 'not_encodable',
  settle: null as null | 'sent' | 'queued' | 'blocked' | 'refused' | 'unverified',
}))
vi.mock('../../hooks/useModelEditAuthority', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useModelEditAuthority')>()
  return {
    ...actual,
    useModelEditAuthority: (activeNodeId: string | null, activeEdgeId: string | null = null) => {
      // Always call the real hook so hook order is identical in both modes.
      const live = actual.useModelEditAuthority(activeNodeId, activeEdgeId)
      if (writer.mode === 'real') return live
      return {
        ...live,
        proposeFactorValue: (
          typedValue: number,
          opts?: { onSendSettled?: (s: NonNullable<typeof writer.settle>) => void },
        ): WriterOutcome => {
          writer.calls.push({ nodeId: activeNodeId, typedValue })
          if (writer.outcome === 'dispatched' && writer.settle) opts?.onSendSettled?.(writer.settle)
          return writer.outcome
        },
      }
    },
  }
})

// ── a conversation, only for the wire rows ──────────────────────────────────
const conversation = vi.hoisted(() => ({ mounted: false, send: vi.fn() }))
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../conversation/ConversationContext')>()
  return {
    ...actual,
    useOptionalConversationContext: () =>
      conversation.mounted ? { sendSystemEvent: conversation.send } : null,
  }
})

// ── FactorNode's render-only dependencies (the contrast rows) ───────────────
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))
vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))
vi.mock('../../nodes/shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// ── fixtures ────────────────────────────────────────────────────────────────
const ADOPTION_ID = 'fac_adoption'
/**
 * Model scale IS the field's scale: capless, unitless, `raw_value === value` —
 * the pair CEE itself persists for such a factor, and one the card renders
 * (a bare `value` with no raw is suppressed on the card as unanchored, so it
 * could not serve as the contrast row; the predicate table covers that shape).
 */
const ADOPTION = {
  label: 'Adoption rate', kind: 'factor', category: 'controllable',
  observedState: { value: 0.5, raw_value: 0.5 },
  prior: { range_min: 0.2, range_max: 0.9 },
}
const PRICE_ID = 'fac_price'
/** The witnessed P0 shape: the field reads £ (raw 49), the model holds 0.245. */
const PRICE = {
  label: 'Pro monthly price', kind: 'factor', category: 'controllable',
  observedState: { value: 0.245, raw_value: 49, cap: 200, unit: '£/month' },
  prior: { range_min: 0.1, range_max: 0.5 },
}
const RISK_ID = 'risk_churn'
const RISK = { label: 'Churn spike', kind: 'risk', prior: { range_min: 0.1, range_max: 0.4 } }

function nodeOf(id: string, type: string, data: Record<string, unknown>): Node {
  return { id, type, position: { x: 0, y: 0 }, data: structuredClone(data) } as Node
}

function seedStore() {
  useCanvasStore.setState({
    nodes: [
      nodeOf(ADOPTION_ID, 'factor', ADOPTION),
      nodeOf(PRICE_ID, 'factor', PRICE),
      nodeOf(RISK_ID, 'risk', RISK),
    ],
    edges: [],
  })
}

function storeData(id: string): Record<string, any> {
  return useCanvasStore.getState().nodes.find(n => n.id === id)!.data as Record<string, any>
}

function targetFor(id: string, nodeType: string): NodeTarget {
  const node = useCanvasStore.getState().nodes.find(n => n.id === id)!
  return { kind: 'node', nodeId: id, nodeType: nodeType as NodeTarget['nodeType'], node, screenPos: { x: 10, y: 10 } }
}

const onClose = vi.fn()

function openMenu(id: string, nodeType = 'factor') {
  return render(
    <CanvasContextMenu target={targetFor(id, nodeType)} onClose={onClose} screenToFlowPosition={p => p} />,
  )
}

function menuItem(name: RegExp): HTMLElement {
  return screen.getByRole('menuitem', { name })
}

async function clickSetValue(label: RegExp) {
  fireEvent.click(menuItem(/^Set value/))
  fireEvent.click(menuItem(label))
  // The menu's `wrap` fires the action without awaiting it.
  await act(async () => { await Promise.resolve() })
}

/** The card's inline editor — the reference path the menu must match. */
function renderCard(id: string) {
  const node = useCanvasStore.getState().nodes.find(n => n.id === id)!
  return render(
    <ReactFlowProvider>
      <FactorNode
        id={id} type="factor" data={node.data as any} selected={false} isConnectable
        positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0}
        deletable selectable draggable
      />
    </ReactFlowProvider>,
  )
}

async function commitOnCard(id: string, typed: string) {
  const { container } = renderCard(id)
  const button = container.querySelector<HTMLElement>(`[data-testid="node-value-editor-${id}"]`)
  expect(button, 'precondition: the card renders its inline editor on a controllable factor').not.toBeNull()
  fireEvent.click(button!)
  const input = container.querySelector<HTMLInputElement>('input')!
  fireEvent.change(input, { target: { value: typed } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await act(async () => { await Promise.resolve() })
  return container
}

beforeEach(() => {
  cleanup()
  writer.mode = 'spy'
  writer.calls.length = 0
  writer.outcome = 'dispatched'
  writer.settle = null
  conversation.mounted = false
  conversation.send.mockReset()
  toast.spy.mockReset()
  onClose.mockReset()
  seedStore()
})
afterEach(() => cleanup())

describe('Set value ▸ Best / Worst case ride the card writer, keyed to this node', () => {
  it('Best case proposes the range top through the writer and writes nothing of its own', async () => {
    openMenu(ADOPTION_ID)
    await clickSetValue(/^Best case/)

    expect(writer.calls, 'the typed writer was called, keyed to THIS node, with the bound').toEqual([
      { nodeId: ADOPTION_ID, typedValue: 0.9 },
    ])
    // The spy writer writes nothing — so an unchanged store proves the menu
    // action made no local-only value write of its own.
    expect(storeData(ADOPTION_ID).observedState.value).toBe(0.5)
    expect(storeData(ADOPTION_ID)).not.toHaveProperty('_baseline_snapshot')
  })

  it('Worst case proposes the range floor, same writer, same node', async () => {
    openMenu(ADOPTION_ID)
    await clickSetValue(/^Worst case/)
    expect(writer.calls).toEqual([{ nodeId: ADOPTION_ID, typedValue: 0.2 }])
    expect(storeData(ADOPTION_ID).observedState.value).toBe(0.5)
  })

  it('CONTRAST — the card\'s inline editor makes the identical writer call', async () => {
    openMenu(ADOPTION_ID)
    await clickSetValue(/^Best case/)
    const fromMenu = [...writer.calls]
    cleanup()
    writer.calls.length = 0

    await commitOnCard(ADOPTION_ID, '0.9')
    const fromCard = [...writer.calls]

    expect(fromMenu, 'non-vacuity: the menu called the writer').toHaveLength(1)
    expect(fromMenu).toEqual(fromCard)
  })
})

describe('with the REAL writer — the wire event is the card\'s wire event', () => {
  beforeEach(() => {
    writer.mode = 'real'
    conversation.mounted = true
    conversation.send.mockImplementation(() => Promise.resolve('ok'))
  })

  it('Best case sends factor_value_edit for this node with the bound, as the card does', async () => {
    openMenu(ADOPTION_ID)
    await clickSetValue(/^Best case/)
    expect(conversation.send).toHaveBeenCalledTimes(1)
    const fromMenu = conversation.send.mock.calls[0][0]
    expect(fromMenu).toEqual({
      type: 'factor_value_edit',
      // `raw_value` because the field reads raw (the one scale rule); no `unit`
      // because the factor declares none.
      payload: { target_id: ADOPTION_ID, value: 0.9, field: 'value', raw_value: 0.9 },
    })
    // The undo travels with the send — the receipt/revert machinery owns it.
    expect(conversation.send.mock.calls[0][1]).toHaveProperty('optimisticFactorEdit')
    // Sent and kept: the card shows the value, so there is no word to say.
    expect(toast.spy).not.toHaveBeenCalled()

    cleanup()
    seedStore()
    conversation.send.mockClear()
    await commitOnCard(ADOPTION_ID, '0.9')
    expect(conversation.send).toHaveBeenCalledTimes(1)
    expect(conversation.send.mock.calls[0][0]).toEqual(fromMenu)
  })

  it('with NO conversation mounted the write is local_only and says so in the card\'s words', async () => {
    conversation.mounted = false
    openMenu(ADOPTION_ID)
    await clickSetValue(/^Best case/)
    expect(storeData(ADOPTION_ID).observedState.value).toBe(0.9)
    expect(storeData(ADOPTION_ID).observedState.raw_value).toBe(0.9)
    // The writer's own local_only stamp — the number is truthfully the user's.
    expect(storeData(ADOPTION_ID).observedState.source).toBe('user_override')
    expect(toast.spy).toHaveBeenCalledWith(VALUE_COMMIT_SETTLEMENT_COPY.local_only.message, 'info')

    cleanup()
    seedStore()
    const card = await commitOnCard(ADOPTION_ID, '0.9')
    const refusal = card.querySelector(`[data-testid="node-value-editor-${ADOPTION_ID}-refusal"]`)
    expect(refusal?.textContent).toBe(VALUE_COMMIT_SETTLEMENT_COPY.local_only.message)
  })
})

describe('a refusal is shown where the user acted, in the card\'s words', () => {
  it('not_encodable → the card\'s "cannot be sent" sentence, as a toast', async () => {
    writer.outcome = 'not_encodable'
    openMenu(ADOPTION_ID)
    await clickSetValue(/^Best case/)
    expect(toast.spy).toHaveBeenCalledWith(settlementModule.VALUE_NOT_ENCODABLE_COPY, 'warning')

    cleanup()
    const card = await commitOnCard(ADOPTION_ID, '0.9')
    const refusal = card.querySelector(`[data-testid="node-value-editor-${ADOPTION_ID}-refusal"]`)
    expect(refusal?.textContent, 'the card says the same sentence').toBe(settlementModule.VALUE_NOT_ENCODABLE_COPY)
  })

  it('a server refusal after dispatch → "Not saved", the card\'s settlement word', async () => {
    writer.settle = 'refused'
    openMenu(ADOPTION_ID)
    await clickSetValue(/^Best case/)
    expect(toast.spy).toHaveBeenCalledWith(VALUE_COMMIT_SETTLEMENT_COPY.not_applied.message, 'warning')
  })

  it('sent, but the value reads unchanged → "Not saved" — the card\'s own revert rule', async () => {
    writer.settle = 'sent'
    openMenu(ADOPTION_ID)
    await clickSetValue(/^Best case/)
    // The spy wrote nothing, so the value reads unchanged after a 'sent' — which
    // on the card's rule (`didValueCommitRevert`) is a 200 that wrote nothing.
    expect(toast.spy).toHaveBeenCalledWith(VALUE_COMMIT_SETTLEMENT_COPY.not_applied.message, 'warning')
  })
})

describe('Custom value rides the same writer, seeded by the same rule', () => {
  it('Custom… opens a field seeded like the card, and Apply proposes through the writer', async () => {
    openMenu(ADOPTION_ID)
    fireEvent.click(menuItem(/^Set value/))
    fireEvent.click(menuItem(/^Custom/))
    const input = screen.getByLabelText('Custom value') as HTMLInputElement
    expect(input.value, 'seeded with the number the writer reads').toBe('0.5')
    fireEvent.change(input, { target: { value: '0.42' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    await act(async () => { await Promise.resolve() })

    expect(writer.calls).toEqual([{ nodeId: ADOPTION_ID, typedValue: 0.42 }])
    expect(storeData(ADOPTION_ID).observedState.value).toBe(0.5)
    expect(screen.queryByLabelText('Custom value'), 'closed on dispatch').toBeNull()
  })

  it('on a capped £ factor the field shows the £ figure (49), not the model scale, and no model-scale range', () => {
    openMenu(PRICE_ID)
    fireEvent.click(menuItem(/^Set value/))
    fireEvent.click(menuItem(/^Custom/))
    const input = screen.getByLabelText('Custom value') as HTMLInputElement
    expect(input.value).toBe('49')
    expect(screen.queryByText(/^Range:/), 'a 0.1–0.5 hint beside a £ field is the P0 invitation').toBeNull()
  })

  it('a refused Custom stays open with the card\'s sentence, never reading as a save', async () => {
    writer.outcome = 'not_encodable'
    openMenu(ADOPTION_ID)
    fireEvent.click(menuItem(/^Set value/))
    fireEvent.click(menuItem(/^Custom/))
    const input = screen.getByLabelText('Custom value') as HTMLInputElement
    fireEvent.change(input, { target: { value: '0.42' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    await act(async () => { await Promise.resolve() })
    expect(screen.getByLabelText('Custom value'), 'stays open').toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe(settlementModule.VALUE_NOT_ENCODABLE_COPY)
  })
})

describe('what the menu no longer offers', () => {
  it('Reset to observed is gone — no truthful restore target without a UI-only snapshot', () => {
    openMenu(ADOPTION_ID)
    fireEvent.click(menuItem(/^Set value/))
    // Non-vacuity: the submenu did open.
    expect(menuItem(/^Best case/)).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /Reset to observed/ })).toBeNull()
    expect((actionsModule as Record<string, unknown>).setValueReset).toBeUndefined()
  })

  it('a risk is offered no Set value — factor_value_edit is a FACTOR carrier', () => {
    openMenu(RISK_ID, 'risk')
    // Non-vacuity: the risk menu rendered.
    expect(menuItem(/^Open details/)).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /^Set value/ })).toBeNull()
  })

  it('on a capped £ factor Best case is withheld with a reason — the bound is model scale, the field is £', async () => {
    openMenu(PRICE_ID)
    fireEvent.click(menuItem(/^Set value/))
    const best = menuItem(/^Best case/)
    expect(best.getAttribute('aria-disabled')).toBe('true')
    expect(within(best).getByText(/\(.+\)/), 'the row says why').toBeTruthy()
    fireEvent.click(best)
    await act(async () => { await Promise.resolve() })
    expect(writer.calls, '0.5 would have landed as £0.50').toEqual([])
    expect(storeData(PRICE_ID).observedState.value).toBe(0.245)
  })

  it('the action itself refuses the same shape, from the same derivation (not only the row)', () => {
    const calls: number[] = []
    const fake = {
      nodeId: PRICE_ID,
      propose: (v: number) => { calls.push(v); return 'dispatched' as const },
    }
    ;(actionsModule as any).setValueBestCase(PRICE_ID, fake, toast.spy)
    expect(calls).toEqual([])
    expect(toast.spy).toHaveBeenCalledTimes(1)
    expect(storeData(PRICE_ID).observedState.value).toBe(0.245)
  })

  it('a writer keyed to a DIFFERENT node fails closed rather than writing the wrong factor', () => {
    const calls: number[] = []
    const fake = { nodeId: PRICE_ID, propose: (v: number) => { calls.push(v); return 'dispatched' as const } }
    ;(actionsModule as any).setValueBestCase(ADOPTION_ID, fake, toast.spy)
    expect(calls).toEqual([])
    expect(toast.spy).toHaveBeenCalledWith(settlementModule.VALUE_NOT_ENCODABLE_COPY, 'warning')
  })
})

describe('modelScaleValueIsTheTypedScale — when a MODEL-scale number is what the field reads', () => {
  const fn = (d: unknown) => (scaleModule as any).modelScaleValueIsTheTypedScale(d) as boolean
  it.each([
    ['no raw_value: the field shows `value` itself', { observedState: { value: 0.5 } }, true],
    ['capless, unitless, raw === value (CEE persists this pair)', { observedState: { value: 0.5, raw_value: 0.5 } }, true],
    ['empty, capless, unitless', { observedState: {} }, true],
    ['capped with raw: the field reads user units', { observedState: { value: 0.245, raw_value: 49, cap: 200, unit: '£' } }, false],
    ['capped, empty field: typed number is divided by the cap', { observedState: { cap: 200 } }, false],
    ['magnitude-scaled (unit, no cap): value IS a magnitude', { observedState: { value: 40000, raw_value: 40000, unit: '£' } }, false],
    ['magnitude-scaled with no raw: still a magnitude', { observedState: { value: 40000, unit: '£' } }, false],
    ['capless framed pair (raw ≠ value): the pair carries a frame', { observedState: { value: 7, raw_value: 70 } }, false],
  ])('%s → %s', (_label, data, expected) => {
    expect(fn(data)).toBe(expected)
  })
})
