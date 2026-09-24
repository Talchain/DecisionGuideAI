/**
 * ⭐⭐ THE DECISION IS RIGHT; THIS ASKS WHETHER IT IS WIRED TO THE RIGHT FACT.
 *
 * `tierInvitationContrastOnTintedGround.spec.ts` proves the token chosen for a
 * tinted ground clears 4.5:1. That is a claim about a FUNCTION. If `BaseNode`
 * passed the wrong fact into it, the function would still be right and the
 * defect would still ship — a guard agreeing with itself.
 *
 * So two bindings, and they fail for different reasons:
 *   1. RENDER — the button's class actually carries the chosen token.
 *   2. SOURCE — the mount binds to `evidenceBgStyle`, the same expression that
 *      PAINTS the tint, rather than to a second reading of the lens.
 *
 * ⚠ Why (2) is not pedantry: `isEvidenceLens` and `evidenceBgStyle !== undefined`
 * differ on exactly one class — `na`, which the lens leaves UNtinted. Binding to
 * the lens would darken the link on a card that was never repainted, which is a
 * different defect in the opposite direction, and no contrast test could see it.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TierInvitationRow, invitationTextToken } from '../shared/TierInvitation'

vi.mock('../../stores/guidanceStore', () => ({
  useGuidanceStore: (sel: (s: unknown) => unknown) =>
    sel({ askTarget: 'composer', composerRegistered: true, drawerRegistered: true }),
}))
vi.mock('../../ui/inspector-v2/askSemantic', () => ({
  requestAsk: vi.fn(),
  canReceiveAsk: () => true,
}))

const INVITATIONS = [
  { anchorNodeId: 'fac_1', label: 'What else drives this?', prompt: 'p', tier: 'factor' as const },
]

function renderAt(onTintedGround: boolean) {
  const r = render(
    <TierInvitationRow invitations={INVITATIONS} nodeId="fac_1" onTintedGround={onTintedGround} />,
  )
  // Positive control before any class is read: the row mounted at all. Without
  // this, a `canAsk` gate closing silently would make every assertion below pass
  // by querying nothing (trap 13).
  expect(screen.getByTestId('tier-invitations'), 'the invitation row did not mount').toBeTruthy()
  return r
}

describe('the invitation is wired to the ground it is standing on', () => {
  it('⭐ on a TINTED card the button carries the tint-safe token', () => {
    renderAt(true)
    const cls = screen.getByTestId('tier-invitation-factor').className
    expect(cls).toContain(invitationTextToken(true))
  })

  it('⛔ CONTRAST: on an UNTINTED card it carries the link colour, not the tint-safe token', () => {
    /*
     * The pair is the point. The first test alone passes if BOTH branches return
     * the safe token — which would lose `--info` everywhere, the surface's own
     * designated link colour, at 4.78:1 where it is entirely correct.
     */
    renderAt(false)
    const cls = screen.getByTestId('tier-invitation-factor').className
    expect(cls).toContain(invitationTextToken(false))
    expect(cls).not.toContain(invitationTextToken(true))
  })

  it('⭐ the mount binds to the expression that PAINTS the tint, not to the lens', () => {
    const src = readFileSync(join(__dirname, '../BaseNode.tsx'), 'utf8')
    const mount = /<TierInvitationRow[\s\S]*?\/>/.exec(src)
    expect(mount, 'TierInvitationRow is no longer mounted in BaseNode').toBeTruthy()
    // contract v3.1 T15: the line-rung KIND FILL is a tinted ground too, read
    // from `lodKindFillClass` — the same expression that paints that fill — so
    // the binding stays "what paints the tint", now for both tints.
    expect(mount![0]).toContain("onTintedGround={evidenceBgStyle !== undefined || lodKindFillClass !== ''}")
    // CONTRAST CONTROL on the scan itself: the regex really did capture the
    // mount and not an empty match, so `toContain` is answering a real question.
    expect(mount![0]).toContain('invitations={myInvitations}')
  })
})
