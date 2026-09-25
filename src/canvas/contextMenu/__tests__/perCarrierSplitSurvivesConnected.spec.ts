/**
 * ⭐⭐ THE PER-CARRIER SPLIT MUST SURVIVE `connected: true`.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * `applyContextMenuMutationAuthority` carried a global
 * `if (connected) return entries` above its walk until 13 Sep 2026. It was
 * literally outside the walk — and it bypassed the per-id split entirely
 * whenever `connected` was true, because `menuIdIsAuthorised` read the
 * constants itself and never saw that value.
 *
 * ⛔ THE REASON IT SURVIVED REVIEW IS THE REASON THIS FILE IS NEEDED: the whole
 * existing suite stayed at 147/147 with the early-return both present AND
 * removed. The injected parameter had exactly ONE possible effect — return
 * everything — so no spec could discriminate per-id behaviour in the connected
 * state. A seam with one possible answer is not a seam, and a fix whose
 * reversal turns nothing red is not tested (CLAUDE.md trap 11).
 *
 * ── WHAT WOULD HAVE TO BE TRUE FOR THIS TO PASS WHILE THE PROPERTY FAILS ───
 * The test injects `connected: true` AND sets `canvasNodeAddWithServerHash` to
 * `'disabled'` — a combination the early-return could not express. With the
 * split intact, `add-node` is judged by ITS OWN carrier and must be withheld.
 * With the early-return restored, every entry returns unfiltered and `add-node`
 * renders. The two arms differ on exactly the line under test.
 *
 * ⚠ The live posture is NOT this: `canvasNodeAddWithServerHash` is
 * `'server_graph'` today and the door is open. This file pins the RELATIONSHIP
 * — each id judged by its own carrier — not the current values.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MenuEntry } from '../types'

const nodeAdd = { current: 'server_graph' as string }
const semantic = { current: 'disabled' as string }

vi.mock('../../mutations/mutationAuthority', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../mutations/mutationAuthority')>()
  return {
    ...actual,
    get CANONICAL_EDIT_AUTHORITY() {
      return {
        ...actual.CANONICAL_EDIT_AUTHORITY,
        canvasNodeAddWithServerHash: nodeAdd.current,
        canvasSemanticMutations: semantic.current,
      }
    },
  }
})

const { applyContextMenuMutationAuthority } = await import('../useMenuItems')

/**
 * A minimal menu carrying one durable-add id, one carrierless id, one neutral.
 *
 * ⚠ `paste` STOOD HERE AS THE CARRIERLESS ID UNTIL A20 (25 Sep 2026), WHEN IT
 * LEFT BOTH `LOCAL_SEMANTIC_CONTEXT_MENU_IDS` AND
 * `KEYBOARD_REACHABLE_SEMANTIC_IDS` — the row it stood in for is gone from
 * every real menu, not merely re-judged. Using it here now would test nothing:
 * an id in neither set is authorised unconditionally (`menuIdIsAuthorised`'s
 * own fallback), so it would render exactly like the neutral `ask-ai` id and
 * the split this file exists to pin would go unobserved. `cut` replaces it —
 * still in both sets, so it is still surfaced-and-inert under the same rules.
 */
function entries(): MenuEntry[] {
  return [
    { id: 'add-node', label: 'Add node', enabled: true, action: () => {} },
    { id: 'cut', label: 'Cut', enabled: true, action: () => {} },
    { id: 'ask-ai', label: 'Ask AI', enabled: true, action: () => {} },
  ] as unknown as MenuEntry[]
}
const idsOf = (list: MenuEntry[]) =>
  new Set(list.flatMap(e => ('type' in e ? [] : [(e as { id: string }).id])))
/**
 * ⚠ `cut` is KEYBOARD-REACHABLE, so an unauthorised `cut` is SURFACED AND
 * INERT, never absent — #1304's whole point. Asserting absence for it is the
 * same mistake #1538's spec made and this PR's rebase corrected; the property
 * is "not ACTIONABLE", not "not PRESENT". This helper reads the right one.
 */
const actionable = (list: MenuEntry[], id: string): boolean => {
  const hit = list.find(e => !('type' in e) && (e as { id: string }).id === id) as
    | { enabled?: boolean }
    | undefined
  return hit?.enabled === true
}

beforeEach(() => {
  nodeAdd.current = 'server_graph'
  semantic.current = 'disabled'
})

describe('the per-carrier split survives an injected connected=true', () => {
  it('CONTRAST CONTROL: the probe can see a menu at all', () => {
    // Without this, every absence assertion below would pass on an empty list.
    const out = applyContextMenuMutationAuthority(entries(), { connected: true })
    expect(idsOf(out).has('ask-ai'), 'neutral id must always survive').toBe(true)
  })

  it('⭐ withholds a durable-add id whose OWN carrier is disabled, even when connected', () => {
    nodeAdd.current = 'disabled'
    const out = applyContextMenuMutationAuthority(entries(), { connected: true })
    // THE LINE UNDER TEST. Under the global early-return this was `true`.
    expect(idsOf(out).has('add-node'), 'add-node judged by its own carrier').toBe(false)
    // ...and the connected state still admits the carrierless id, so the failure
    // above cannot be a blanket "nothing renders".
    expect(idsOf(out).has('ask-ai')).toBe(true)
  })

  it('OPPOSITE DIRECTION: admits the durable-add id when its own carrier is live', () => {
    nodeAdd.current = 'server_graph'
    const out = applyContextMenuMutationAuthority(entries(), { connected: false })
    expect(idsOf(out).has('add-node'), 'own carrier live ⇒ renders').toBe(true)
    // ...while a carrierless id is withheld in the SAME call, which is what
    // makes this a split rather than a global switch.
    expect(actionable(out, 'cut'), 'carrierless id inert in the same menu').toBe(false)
  })

  it('the injected value drives the carrierless id, not the module constant', () => {
    semantic.current = 'disabled'
    const shut = applyContextMenuMutationAuthority(entries(), { connected: false })
    const open = applyContextMenuMutationAuthority(entries(), { connected: true })
    expect(actionable(shut, 'cut'), 'connected:false ⇒ inert').toBe(false)
    expect(actionable(open, 'cut'), 'connected:true ⇒ actionable').toBe(true)
  })
})
