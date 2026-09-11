/**
 * EVERY STRUCTURAL DRAIN IS MOUNTED IN BOTH POSTURES — asserted by DERIVATION.
 *
 * ── THE DEFECT THIS EXISTS FOR, AND IT SHIPPED ──────────────────────────────
 * `StructuralAddEdgeDrainHost.tsx` opens *"⚠⚠ BOTH HOSTS FROM THE START, because
 * a sibling's capability shipped DARK once already… Copying the mistake and
 * fixing it later would be the estate paying twice for one lesson."*
 *
 * It then shipped with ONE host. `useStructuralAddEdgeEvents` was mounted in
 * `StructuralAddEdgeDrainHost` (the `aiPanelV2`-ON posture) and nowhere else,
 * while both siblings are mounted in `DraftChat` as well. Found post-merge by an
 * independent review of #1478.
 *
 * CAPTURE is posture-INDEPENDENT — it lives in the store — so an add-edge intent
 * queues either way and only the DRAIN was gated. With the flag off, intents
 * would queue and never send: the connection lost on reload, AFTER the deferred
 * notice told the user it would be saved with their next message.
 *
 * ── WHY THIS IS DERIVED AND NOT A LIST ──────────────────────────────────────
 * A hand-written list of "hooks that must be mounted twice" is the estate's
 * hand-maintained mirror: the next drain added would simply not be on it, and
 * the guard would pass by not looking. So the SET is derived from the filesystem
 * — every `useStructural*Events` module in this directory — and each member is
 * then required to appear in both hosts. A new drain joins the guard by
 * existing.
 *
 * ⚠ IT ASSERTS A MOUNT, NOT A BEHAVIOUR. A hook named in a file it does not
 * call would satisfy this. That is accepted: the defect being guarded is a
 * missing CALL SITE, and the behavioural half is covered by each drain's own
 * spec. Stated so a green run is not read as more than it is.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const CONVERSATION_DIR = join(__dirname, '..')
const FLAG_OFF_HOST = join(CONVERSATION_DIR, '../components/DraftChat.tsx')

/** Every structural drain hook that exists, derived — never listed. */
function derivedDrainHooks(): string[] {
  return readdirSync(CONVERSATION_DIR)
    .filter(f => /^useStructural[A-Za-z]*Events\.ts$/.test(f))
    .map(f => f.replace(/\.ts$/, ''))
    .sort()
}

describe('structural drains mount in both postures', () => {
  it('PRECONDITION — the derivation finds the drains, so the guard is not vacuous', () => {
    const hooks = derivedDrainHooks()
    // ⚠ Without this, an empty set would make every assertion below pass by
    // iterating nothing — the classic vacuous guard.
    expect(hooks.length).toBeGreaterThanOrEqual(4)
    expect(hooks).toContain('useStructuralAddEdgeEvents')
    expect(hooks).toContain('useStructuralAddEvents')
    expect(hooks).toContain('useStructuralDeleteEvents')
  })

  it('every derived drain is called in the flag-OFF host (DraftChat)', () => {
    const draftChat = readFileSync(FLAG_OFF_HOST, 'utf8')
    const missing = derivedDrainHooks().filter(h => !draftChat.includes(`${h}(`))
    // Named, not counted — a failure must say WHICH drain is dark.
    expect(missing).toEqual([])
  })

  it('every derived drain is called in some flag-ON host', () => {
    const hostFiles = readdirSync(CONVERSATION_DIR)
      .filter(f => /DrainHost\.tsx$/.test(f))
      .map(f => readFileSync(join(CONVERSATION_DIR, f), 'utf8'))
      .join('\n')
    const missing = derivedDrainHooks().filter(h => !hostFiles.includes(`${h}(`))
    expect(missing).toEqual([])
  })

  it('CONTROL — the check can SEE a missing mount', () => {
    // Anti-vacuity: prove the predicate discriminates rather than always
    // returning []. A name no host calls must be reported as missing.
    const draftChat = readFileSync(FLAG_OFF_HOST, 'utf8')
    expect(draftChat.includes('useStructuralNeverMountedEvents(')).toBe(false)
  })
})
