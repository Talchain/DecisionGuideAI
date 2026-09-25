/**
 * ⭐⭐ AN OBSERVABLE FACTOR'S VALUE IS EDITABLE IN THE MOUNTED INSPECTOR, AND THE
 * EDIT REACHES THE MODEL THROUGH THE ONE CARRIER EVERY OTHER VALUE EDIT USES.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────
 * `'factor-observable'` was not in `InspectorRouter`'s `AUTHORITY_OWNING_PANELS`,
 * so the whole panel — its headline value included — sat inside the Router's
 * `<fieldset disabled>`. One whole factor category had zero editable surface
 * (EDITABILITY-MATRIX-20260924, "Observable — everything"). And even unfenced,
 * its value control called a bare `mutations.setObservedValue` — a local store
 * write with no wire carrier, lost on the next server rehydrate.
 *
 * ── THE FIX ──────────────────────────────────────────────────────────────────
 * The headline value commits through `useModelEditAuthority.proposeFactorValue`
 * — the shared writer the factor card, the Model tab and the Reasoning tab
 * already use — which builds the event with `buildFactorValueEditEvent` (the
 * scale contract, keyed on `resolveValueInputSeed`) and sends
 * `factor_value_edit`. The panel opts into `AUTHORITY_OWNING_PANELS` and fences
 * its own carrier-less writers (description, advanced editor), exactly as
 * `FactorControllablePanel` does.
 *
 * ── WHAT THIS FILE ASKS, THROUGH THE REAL ROUTER ─────────────────────────────
 *   1. the value control is operable (userEvent, which refuses a disabled
 *      target);
 *   2. a changed value SENDS `factor_value_edit` — kind, target id bound by the
 *      node's identity, and the value on BOTH scales, derived from the fixture's
 *      own cap via the canonical `normaliseRawFactorValue` rather than a literal
 *      bound;
 *   3. NEGATIVE CONTROL: an unchanged value sends nothing;
 *   4. CONTRAST: the description and the advanced editor stay fenced;
 *   5. CONTRAST: a panel that took on no duty (an unresolved node kind, via
 *      `GenericNodePanel`) keeps the Router's wrap.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Node } from '@xyflow/react'

const sendSystemEvent = vi.fn()

vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))
// Spread the real module — a bare factory would silently drop every other
// export the subtree imports (CLAUDE.md trap 12).
vi.mock('../../../conversation/ConversationContext', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useOptionalConversationContext: () => ({ sendSystemEvent }),
}))

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'
import { normaliseRawFactorValue } from '../../../utils/observedStateHelpers'
import { resolveValueInputSeed } from '../../../conversation/factorValueEdit'

const FACTOR_ID = 'fac_competitor_price'
const FACTOR_LABEL = 'Competitor list price'
const RISK_ID = 'risk_churn'
/** The factor's OWN scale — every expected number below is derived from it. */
const CAP = 200
const RAW = 49
const TYPED = 60

function observableFactor(): Node {
  return {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      kind: 'factor',
      category: 'observable',
      label: FACTOR_LABEL,
      // A description, so the fenced description writer is a real <textarea>.
      description: 'What the main competitor charges.',
      observedState: { value: RAW / CAP, raw_value: RAW, cap: CAP, unit: '£' },
    },
  } as unknown as Node
}

function seed() {
  useCanvasStore.setState({
    nodes: [
      observableFactor(),
      // ⚠ `risk` joined `AUTHORITY_OWNING_PANELS` (A10, 25 Sep 2026) — its two
      // writers now fence themselves inside `RiskPanel`, so it can no longer
      // stand in for "a panel that took on no duty". An unresolved node kind
      // falls through to `GenericNodePanel`, still blanket-wrapped.
      { id: RISK_ID, type: 'milestone', position: { x: 0, y: 0 }, data: { kind: 'milestone', label: 'Churn spikes', description: 'No bespoke panel exists for this node kind yet.' } },
    ] as never[],
    edges: [] as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

function isInert(el: Element | null): boolean {
  if (el === null) return true
  if (el.hasAttribute('disabled')) return true
  return el.closest('fieldset[disabled]') !== null
}

function openFactor() {
  return render(<InspectorRouter nodeId={FACTOR_ID} edgeId={null} onClose={vi.fn()} />)
}

/** Open the value editor, replace its text, commit with Enter (which blurs). */
async function commitValue(text: string) {
  const user = userEvent.setup()
  await user.click(screen.getByTestId('observable-value-display'))
  const input = screen.getByTestId('observable-value-input')
  await user.clear(input)
  await user.type(input, `${text}{Enter}`)
}

beforeEach(() => {
  sendSystemEvent.mockReset()
  sendSystemEvent.mockResolvedValue(undefined)
  seed()
})
afterEach(cleanup)

describe('the observable factor\'s value is operable through the mounted Router', () => {
  it('the value control is NOT inert', () => {
    const { container } = openFactor()
    const display = screen.getByTestId('observable-value-display')
    expect(isInert(display), 'the value control is inert — no user can edit it').toBe(false)
    expect(container.querySelector('[data-authority="disabled"]'),
      'the Router still wraps the observable panel in its blanket fence').toBeNull()
  })

  it('opens seeded with the scale rule\'s own seed (the user-unit magnitude)', async () => {
    openFactor()
    await userEvent.click(screen.getByTestId('observable-value-display'))
    const seeded = resolveValueInputSeed(observableFactor().data).seed
    expect(seeded).toBe(RAW)
    expect((screen.getByTestId('observable-value-input') as HTMLInputElement).value).toBe(String(seeded))
  })
})

describe('a committed value SENDS factor_value_edit through the shared carrier', () => {
  it('emits exactly one factor_value_edit, id-addressed, on both scales', async () => {
    openFactor()
    await commitValue(String(TYPED))

    expect(sendSystemEvent, 'no turn was sent — the edit stayed local').toHaveBeenCalledTimes(1)
    const event = sendSystemEvent.mock.calls[0][0] as { type: string; payload: Record<string, unknown> }
    expect(event.type).toBe('factor_value_edit')
    expect(event.payload.target_id).toBe(FACTOR_ID)
    expect(event.payload.target_id).not.toBe(FACTOR_LABEL)
    expect(event.payload.field).toBe('value')
    // The typed number is a USER-UNIT magnitude (the seed was `raw_value`), so
    // the wire carries it as `raw_value` and the MODEL-scale `value` derived
    // from the factor's own cap — never the typed magnitude in the 0-1 slot.
    expect(event.payload.raw_value).toBe(TYPED)
    expect(event.payload.value).toBeCloseTo(normaliseRawFactorValue(TYPED, CAP), 10)
    expect(event.payload.value).not.toBe(TYPED)
    expect(event.payload.unit).toBe('£')
  })

  it('says what happened, in the shared value-edit register — never "Updated"', async () => {
    openFactor()
    await commitValue(String(TYPED))
    expect(screen.getByText('Sent to Olumi. The shared model updates when it answers.')).toBeTruthy()
    expect(screen.queryByText('Updated')).toBeNull()
  })

  it('NEGATIVE CONTROL — committing the unchanged value sends nothing', async () => {
    openFactor()
    await commitValue(String(RAW))
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })
})

describe('every other writer on the panel stays fenced', () => {
  it('fences the DESCRIPTION — it has no carrier', () => {
    const { container } = openFactor()
    const fence = container.querySelector('fieldset[data-writer-fence="description"]')
    expect(fence, 'the description writer must sit behind its own fence').not.toBeNull()
    const textarea = within(fence as HTMLElement).getByRole('textbox')
    expect(isInert(textarea), 'the description writer is live with no carrier').toBe(true)
  })

  it('fences the ADVANCED EDITOR — its setters are bare store writes', async () => {
    const { container } = openFactor()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Show technical detail' }))
    await user.click(screen.getByRole('button', { name: /Show model detail/i }))
    const fence = container.querySelector('fieldset[data-writer-fence="advanced-editor"]')
    expect(fence, 'the advanced editor must sit behind its own fence').not.toBeNull()
    // Bound by identity to the editor's own "Normalised value" field, which
    // writes the SAME slot as the headline control WITHOUT the wire send.
    const normalised = within(fence as HTMLElement).getByLabelText('Normalised value')
    expect(isInert(normalised), 'the advanced editor writes the value with no carrier').toBe(true)
  })

  it('CONTRAST — a panel that owns no fence keeps the Router wrap', () => {
    const { container } = render(<InspectorRouter nodeId={RISK_ID} edgeId={null} onClose={vi.fn()} />)
    expect(container.querySelector('[data-authority="disabled"]')).not.toBeNull()
  })
})
