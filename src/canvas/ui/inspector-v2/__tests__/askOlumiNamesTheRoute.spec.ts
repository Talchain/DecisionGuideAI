/**
 * R6 (C10, #2084 review 5843330067): an instruction to "ask Olumi" must name the
 * route the person can actually take. The one-click routes ("Change this", the
 * hover chip) are gone, so these sentences told the user to do something no
 * control on screen does. The route that remains is typing in the chat.
 */
import { describe, expect, it } from 'vitest'
import { INSPECTOR_RISK_REASON } from '../panels/RiskPanel'
import { INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON } from '../useInspectorMutations'
import { STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE } from '../../../mutations/structuralAddEdge'

/*
 * ⚠ 27 Sep 2026 (canvas audit edit-structure/F3): the drawn-link toast LEFT this
 * table because it stopped being an ask-Olumi instruction, not because the rule
 * relaxed. It now names the one-click add-control in the link panel
 * (`edge-state-strength-for-save`), pinned against the rendered control in
 * `structuralAddEdge.needsStrengthNoticeIsExecutable.spec.tsx`. Kept as a row
 * below would fail this table's own precondition ("the fixture really is an
 * ask-Olumi instruction"). The case at the bottom still applies this rule
 * to it if an "ask Olumi" ever returns to that sentence.
 */

describe('every "ask Olumi" instruction names the chat as its route', () => {
  it.each([
    ['risk inspector notice', INSPECTOR_RISK_REASON],
    ['edge with no strength basis', INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON],
  ])('%s', (_name, copy) => {
    expect(copy, 'the fixture really is an ask-Olumi instruction').toMatch(/ask olumi/i)
    expect(copy).toMatch(/in the chat/i)
  })
})

describe('the drawn-link toast names the panel control, not the chat', () => {
  it('any "ask Olumi" in it would still have to name the chat; today it names the link panel', () => {
    expect(STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE).toMatch(/link panel/i)
    if (/ask olumi/i.test(STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE)) {
      expect(STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE).toMatch(/in the chat/i)
    }
  })
})
