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

describe('every "ask Olumi" instruction names the chat as its route', () => {
  it.each([
    ['risk inspector notice', INSPECTOR_RISK_REASON],
    ['edge with no strength basis', INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON],
    ['drawn link with no strength', STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE],
  ])('%s', (_name, copy) => {
    expect(copy, 'the fixture really is an ask-Olumi instruction').toMatch(/ask olumi/i)
    expect(copy).toMatch(/in the chat/i)
  })
})
