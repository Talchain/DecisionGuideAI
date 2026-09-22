/**
 * A gap row offers a way to act, and it is NOT gated on mutation authority.
 *
 * `handleSetValueForGap` is one navigation call and nothing else — it writes no
 * model value.
 *
 * ⚠ THIS GUARD USED TO PIN THE HELPER'S NAME (`openNodeInspector`) AND THAT WAS
 * THE WRONG PROPERTY (20 Sep 2026). The destination legitimately moved to the
 * Model tab — the Inspector serves only two of the three factor categories, so
 * an `observable` factor landed on a read-only fieldset. A guard pinned to one
 * spelling REDs on a correct change and says nothing about the property it
 * exists to protect. It now pins the property: the handler delegates to one of
 * the SANCTIONED NAVIGATION OWNERS and contains no writer. It was gated on `preAnalysisFactorValue`, a MUTATION
 * authority key, so a user looking at an unfilled factor was offered no way to
 * act, on the grounds that an edit could not be saved, by a handler that does
 * not edit.
 *
 * ⚠ THE PRECEDENT IS ALREADY IN THE TREE. `TriageActionCardsBody.tsx` fixed
 * this on the POST-RUN surface and stated the rule: *"Navigation is not a
 * mutation, so this is not governed by CANONICAL_EDIT_AUTHORITY at all."* This
 * pins the same rule on the pre-analysis surface.
 *
 * ⛔ THE DISCRIMINATING PAIR, and the reason this file is not a tautology.
 * There are two ways to make a gap row appear: ungate the navigation (right),
 * or flip `preAnalysisFactorValue` to `'server_graph'` (WRONG — it would assert
 * a capability the inline editor does not have, since `handleInlineEditValue`
 * does one local `updateNode` and emits nothing). Arm 1 requires the navigation
 * ungated; arm 2 requires the key STILL `'disabled'`. A flag flip passes arm 1
 * and REDS arm 2, so the pair distinguishes the two remedies — which asserting
 * either one alone cannot do.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CANONICAL_EDIT_AUTHORITY } from '../../../mutations/mutationAuthority'

const PANEL = resolve(__dirname, '../PreAnalysisPanel.tsx')
const src = readFileSync(PANEL, 'utf8')

describe('the gap row can be acted on', () => {
  it('precondition — this really is the panel that wires the gap row', () => {
    expect(src).toContain('handleSetValueForGap')
    expect(src).toContain('PRE_ANALYSIS_FACTOR_VALUE_CONNECTED')
  })

  /**
   * The navigation owners this handler may delegate to. Each opens a surface
   * and writes nothing to the model: `openModelValueEditor` moves the output
   * tab, requests an outline section and focuses a row; `openNodeInspector`
   * selects a node and raises the inspector. Adding a name here is a decision
   * to be defended — it is not a place to park a writer.
   */
  const NAVIGATION_OWNERS = ['openModelValueEditor', 'openNodeInspector'] as const

  it('the navigation handler still only navigates — it must not have gained a write', () => {
    const body = src.slice(src.indexOf('const handleSetValueForGap'))
    const decl = body.slice(0, body.indexOf('}, ['))
    const owner = NAVIGATION_OWNERS.find(n => decl.includes(`${n}(`)) ?? null
    expect(
      owner,
      `handleSetValueForGap delegates to none of ${NAVIGATION_OWNERS.join(', ')} — `
        + 'either it stopped navigating, or a new owner arrived without being reasoned about here.',
    ).not.toBeNull()
    // Exactly one, so a handler cannot satisfy this by opening two surfaces.
    expect(NAVIGATION_OWNERS.filter(n => decl.includes(`${n}(`))).toHaveLength(1)
    for (const writer of ['updateNode(', 'updateEdge(', 'sendSystemEvent(', 'setGoal(']) {
      expect(decl, `handleSetValueForGap gained ${writer} — it is no longer navigation`).not.toContain(writer)
    }
  })

  it('ARM 1 — navigation is not gated on the mutation-authority key', () => {
    expect(src).toContain('onEdit: handleSetValueForGap')
    expect(
      src,
      'the gap-row navigation is gated on a mutation-authority key again',
    ).not.toContain('onEdit: PRE_ANALYSIS_FACTOR_VALUE_CONNECTED')
  })

  /**
   * ⛔ ARM 2 — the fix must NOT have been a flag flip. `preAnalysisFactorValue`
   * governs the inline editor, whose writer emits nothing; flipping it would
   * license that editor to present itself as a saved shared-model edit.
   */
  it('ARM 2 — the mutation key stays disabled, and the inline editor stays gated', () => {
    expect(CANONICAL_EDIT_AUTHORITY.preAnalysisFactorValue).toBe('disabled')
    expect(
      src.includes('PRE_ANALYSIS_FACTOR_VALUE_CONNECTED &&'),
      'the inline editor is no longer gated — that asserts a capability it does not have',
    ).toBe(true)
  })

  it('the inline editor’s writer is still local-only, which is WHY it stays gated', () => {
    const body = src.slice(src.indexOf('const handleInlineEditValue'))
    const decl = body.slice(0, body.indexOf('}, ['))
    expect(decl).toContain('updateNode')
    expect(decl, 'if this gained a carrier, arm 2 needs rethinking rather than keeping').not.toContain('sendSystemEvent')
  })
})
