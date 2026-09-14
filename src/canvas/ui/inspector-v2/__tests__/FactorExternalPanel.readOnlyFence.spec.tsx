/**
 * ⭐ THE PRIOR-RANGE EDITOR BECOMES OPERABLE, AND THE PANEL PAYS FOR IT.
 *
 * ── WHAT WAS WRONG ────────────────────────────────────────────────────────
 * `setPriorRange` was built, wired and tested, and no user could reach it.
 * `InspectorRouter`'s blanket `<fieldset disabled>` wrapped the whole external
 * factor pane, and a disabled fieldset inerts every form control beneath it —
 * so the quick-set buttons and the tech-mode Min/Max inputs all rendered and
 * all did nothing. `analyticalNodeFields.ts` recorded it in terms: a factor's
 * prior range is analysis-affecting and was "NOT user-editable today".
 *
 * The deployed consequence, driven on staging before this change: an analysis
 * REFUSES when a factor is "recorded as a bare amount with no range for me to
 * measure it against" — and the product then offered no control to supply one.
 * A refusal that names a remedy the UI does not provide is a dead end wearing
 * an explanation.
 *
 * ── WHY THIS PANEL IS ALLOWED OUT, AND THE TEST IT HAD TO PASS ────────────
 * The Router's rule is a CARRIER test, not a preference: does the control reach
 * something that survives the next server rehydrate? `setPriorRange` does, on
 * two independent legs — `updateNode(data.prior)` whose autosave round-trip is
 * pinned in `useAutosave.analysisFieldPersist.spec.ts` (hash flips, save fires,
 * load rehydrates), and a `prior_range_edit` emission to CEE.
 *
 * ── WHY FOUR CASES ────────────────────────────────────────────────────────
 * Opting a panel out of the blanket is only safe if the panel fences its own
 * carrier-less writers, so this file asserts BOTH directions. Each plausible
 * wrong implementation fails at least one case:
 *
 *   · panel still wrapped by the Router (change not applied) → CASE 1 REDs
 *   · blanket deleted for EVERY panel, not just this one     → CASE 2 REDs
 *   · opted out but fences nothing (`setDescription` live)   → CASE 4 REDs
 *   · fences everything, including the range editor          → CASE 3 REDs
 *
 * CASE 3 is the one that carries the user-facing capability; CASE 4 is what
 * stops the opt-in being a licence. Neither alone is enough — a panel can pass
 * either by fencing nothing or by fencing everything.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { InspectorModal } from '../../../components/InspectorModal'
import { useCanvasStore } from '../../../store'

// importOriginal-spread, NOT a hand-listed factory: `vi.mock` REPLACES the
// module, so a bare factory silently removes every other @xyflow/react export
// the subtree imports (CLAUDE.md trap 12).
vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

const NODE_INSPECTOR = 'div[role="dialog"][aria-label="Node inspector"]'
const EXT_ID = 'fac_market_rate'
const RISK_ID = 'risk_churn'

function seed() {
  useCanvasStore.setState({
    nodes: [
      {
        id: EXT_ID,
        type: 'factor',
        position: { x: 0, y: 0 },
        data: {
          kind: 'factor',
          category: 'external',
          label: 'Market rate',
          description: 'What the wider market is doing.',
          observedState: { value: 0.5 },
        },
      },
      {
        id: RISK_ID,
        type: 'risk',
        position: { x: 0, y: 0 },
        data: { kind: 'risk', label: 'Churn spikes' },
      },
    ] as never[],
    edges: [] as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: { x: 0, y: 0 } },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

function openExternal() {
  const utils = render(<InspectorModal nodeId={EXT_ID} edgeId={null} onClose={vi.fn()} />)
  // PRECONDITION: without the deployed chain mounted, every assertion below is
  // about a component the product does not render (CLAUDE.md trap 3b).
  expect(
    utils.container.querySelector(NODE_INSPECTOR),
    'PRECONDITION: the node inspector dialog must be mounted',
  ).not.toBeNull()
  return utils
}

/**
 * ⚠ `fieldset[disabled]` INERTS ITS DESCENDANTS WITHOUT SETTING `disabled` ON
 * THEM, so asking a control whether it is disabled answers about the control and
 * not about the blanket over it. Every enabled-ness assertion walks up too.
 */
function isInert(el: Element | null): boolean {
  if (el === null) return true
  if (el.hasAttribute('disabled')) return true
  return el.closest('fieldset[disabled]') !== null
}

const quickSetButton = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll('button')].find(b => (b.textContent || '').trim() === label) ?? null

beforeEach(seed)

describe('the external-factor panel owns its authority boundary', () => {
  it('CASE 1 — it is NOT wrapped by the Router blanket any more', () => {
    const { container } = openExternal()
    expect(
      container.querySelector('[data-authority="disabled"]'),
      'the Router still wrapped this panel; the prior-range editor stays dead',
    ).toBeNull()
  })

  it('CASE 2 — CONTRAST: a panel that owns no fence KEEPS the Router wrap', () => {
    // ⭐ Without this, CASE 1 passes on a change that deleted the blanket
    // EVERYWHERE, silently un-fencing panels that took on no duty at all.
    const { container } = render(
      <InspectorModal nodeId={RISK_ID} edgeId={null} onClose={vi.fn()} />,
    )
    expect(container.querySelector(NODE_INSPECTOR)).not.toBeNull()
    expect(
      container.querySelector('[data-authority="disabled"]'),
      'a non-opted-in panel lost the Router wrap — it owns no fence of its own',
    ).not.toBeNull()
  })
})

describe('the writer that saves is live, and the writer that does not is fenced', () => {
  it('CASE 3 — the quick-set range buttons are OPERABLE: this is the capability', () => {
    const { container } = openExternal()
    // Bound by their exact rendered label, not by position or class — a
    // different button cannot satisfy this.
    for (const label of ['Low', 'Moderate', 'High', 'Uncertain']) {
      const btn = quickSetButton(container, label)
      expect(btn, `the "${label}" quick-set button must be rendered`).not.toBeNull()
      expect(
        isInert(btn),
        `the "${label}" quick-set button is inert — the range still cannot be set`,
      ).toBe(false)
    }
  })

  it('CASE 4 — the description writer stays FENCED, and at least one fence is declared', () => {
    const { container } = openExternal()
    const fences = [...container.querySelectorAll('fieldset[data-writer-fence]')]
    // ⚠ A sweep over an empty set passes vacuously: a panel that opted out of
    // the blanket and then declared no fence at all would satisfy a bare
    // forEach. Pin the count first.
    expect(
      fences.length,
      'the panel declared NO writer fence — opting out of the blanket is a duty, not a licence',
    ).toBeGreaterThan(0)
    for (const f of fences) {
      expect(
        f.hasAttribute('disabled'),
        `fence "${f.getAttribute('data-writer-fence')}" is not disabled — a carrier-less writer is live`,
      ).toBe(true)
    }
  })
})
