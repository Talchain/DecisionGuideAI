/**
 * THE ENTRY COPY TALKED USERS OUT OF A CAPABILITY THE PRODUCT SHIPS.
 *
 * CEE #1110 (`aa134eac`) is merged and live on deployed CEE `c24bfe37`. It
 * accepts OPEN STRATEGIC CHALLENGES: a statement of a problem with no decision
 * verb and no trailing `?` drafts a model because the classifier returns
 * `start_model`. Its own control case, from the CEE suite:
 *
 *   "Our enterprise renewal rates have been sliding for three quarters and
 *    leadership disagrees about why."
 *
 * Meanwhile the first lines a fresh user read were "Describe your DECISION…"
 * (first-use composer) and "Describe your DECISION, THE options you're
 * weighing…" (chat composer), with a goal tip of "State the DECISION you need
 * to make" and an options tip that DEMANDED "at least two alternatives".
 *
 * The runtime had been widened and the entry copy still steered users into the
 * narrow form the fix existed to remove — the product talking people out of a
 * capability it ships and has witnessed.
 *
 * ⚠ THE REGRESSION CONTROL IS NON-NEGOTIABLE AND IT IS THE FOUNDER'S OWN.
 * #1110 kept "Should we expand into the US this year?" undegraded — Olumi was
 * generalised WITHOUT costing decision reasoning. Copy that de-emphasised
 * decisions to make room for challenges would undo exactly that, so every case
 * below pins BOTH directions: a challenge is admitted, AND a decision leads.
 *
 * ⚠ WHAT IS DELIBERATELY NOT CHANGED. `SCAFFOLD_LABELS`' "the decision i'm
 * facing is:" is a DETECTION constant, not user-facing copy. Renaming it for
 * vocabulary consistency would stop recognising users who type that phrase —
 * an internal construct renamed for cosmetic reasons, which the founder's
 * language ruling forbids. Pinned below so a later tidy cannot do it silently.
 *
 * Read through the HOOK and the exported map that the composer actually uses,
 * never a retyped copy — `ChatComposer.spec` pins that the map reaches the
 * textarea, and `stagePlaceholder.spec` now imports it rather than mirroring it.
 */
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBriefSignals, detectGoal } from '../hooks/useBriefSignals'
import { useStageAwarePlaceholder } from '../../hooks/useStageAwarePlaceholder'
import { STAGE_PLACEHOLDERS } from '../zones/ChatComposer'
import { FIRST_USE_PLACEHOLDER } from '../../components/FirstUseComposer'

const BRIEF = 'We need to decide how to grow revenue next year.'

function tip(kind: 'goal' | 'options'): string {
  const { result } = renderHook(() => useBriefSignals(BRIEF, 'frame', BRIEF))
  const el = result.current?.elements.find(e => e.kind === kind)
  return el?.coachingTip ?? ''
}

const firstUseLine = () => renderHook(() => useStageAwarePlaceholder()).result.current

/** The FIRST-USE hero's own copy — it passes an explicit prop, so the hook never reaches it. */
const heroLine = () => FIRST_USE_PLACEHOLDER

/**
 * The PROPERTY: a decision and a challenge are offered as ALTERNATIVE things the
 * user can bring. The alternation is what a verb cannot satisfy.
 */
function admitsBoth(s: string): boolean {
  return /\bdecision\s+or\s+challenge\b/i.test(s)
}

/** Decision must be named, and named FIRST — the testable form of "not demoted". */
function decisionLeads(s: string): boolean {
  const l = s.toLowerCase()
  return l.includes('decision') && l.indexOf('decision') < l.indexOf('challenge')
}

describe('the entry copy invites a challenge as well as a decision', () => {
  it('PRECONDITION — every string under test is real and non-empty', () => {
    // A blank satisfies every "does not match" assertion below.
    for (const s of [STAGE_PLACEHOLDERS.frame, tip('goal'), tip('options'), firstUseLine(), heroLine()]) {
      expect(s.length).toBeGreaterThan(15)
    }
  })

  /*
   * ⛔⛔ THIS ASSERTION USED TO BE `/\bchallenge\b/i` AND IT PINNED NOTHING.
   *
   * "Challenge" is a VERB as well as a noun. Independent review reworded all
   * three surfaces back to decision-only framing — *"…and any assumption you
   * want to challenge"* — and the spec stayed 7/7 GREEN, regression control
   * included. The word was present; the INVITATION was gone. A different speech
   * act entirely, satisfying the same regex.
   *
   * The property is that the copy offers a decision and a challenge as
   * ALTERNATIVE THINGS THE USER CAN BRING, so it is the ALTERNATION that is
   * pinned, not the word. `admitsBoth` is exercised against the reviewer's own
   * attack strings below, so its discrimination is proven in-test rather than
   * assumed — the guard has to reject the thing that beat its predecessor.
   */
  it('⭐ ADMITS A CHALLENGE AS A THING YOU BRING — on all four entry surfaces', () => {
    for (const s of [STAGE_PLACEHOLDERS.frame, tip('goal'), firstUseLine(), heroLine()]) {
      expect(admitsBoth(s), `does not offer both: "${s}"`).toBe(true)
    }
  })

  it('⛔ THE GUARD REJECTS THE REWORDING THAT BEAT ITS PREDECESSOR', () => {
    // Verbatim shapes from the review that passed the old `/\bchallenge\b/i`.
    const attacks = [
      'Describe your decision, the options you\u2019re weighing, and any assumption you want to challenge.',
      'State the decision you need to make, and challenge your own assumptions.',
      'Describe your decision\u2026 then challenge it.',
    ]
    for (const a of attacks) {
      expect(/\bchallenge\b/i.test(a), 'precondition: the OLD guard passes this').toBe(true)
      expect(admitsBoth(a), `attack slipped through: "${a}"`).toBe(false)
    }
  })

  it('⛔ REGRESSION CONTROL — a decision is still named, and still leads', () => {
    expect(decisionLeads(STAGE_PLACEHOLDERS.frame)).toBe(true)
    expect(decisionLeads(tip('goal'))).toBe(true)
    expect(decisionLeads(firstUseLine())).toBe(true)
    expect(decisionLeads(heroLine())).toBe(true)
  })

  it('⛔ NEVER DEMANDS OPTIONS FROM A USER WHO HAS NONE', () => {
    // Old copy presupposed alternatives exist: "List at least two alternatives
    // you are considering" and "THE options you're weighing".
    expect(tip('options')).not.toMatch(/^list at least/i)
    expect(tip('options')).toMatch(/\bif\b/i)
    expect(STAGE_PLACEHOLDERS.frame).not.toMatch(/\bthe options\b/i)
  })

  it('still GUIDES the decision case — "two or more" survives as an invitation', () => {
    // Removing the demand must not remove the help: a user who IS choosing
    // between alternatives should still learn Olumi wants at least two.
    expect(tip('options')).toMatch(/two or more|at least two/i)
  })

  /*
   * ⚠ THIS CASE'S FIRST FIXTURE PASSED ON THE WRONG BRANCH, AND THE MUTANT
   * PROVED IT. `detectGoal` has THREE branches — `DECISION_FRAMING_PHRASES`,
   * `GOAL_VERBS`, and `SCAFFOLD_LABELS`. The original fixture ended
   * "…is: whether to rebuild or buy", and `'whether to'` is a framing phrase,
   * so it detected `true` via branch 1 no matter what the scaffold list said.
   * Renaming the scaffold constant left the suite GREEN 7/7 — the exact tidy
   * this case exists to forbid.
   *
   * The payload after the colon is now a bare noun phrase that trips NO other
   * branch, and the PAIR below proves it: without the scaffold prefix the same
   * text is NOT detected, so a `true` with it can only have come from branch 3.
   */
  it('⛔ INTERNAL DETECTION IS UNTOUCHED — and only the scaffold branch can explain it', () => {
    // PRECONDITION: the payload alone trips nothing. If this ever returns true,
    // the case below stops discriminating and must be re-fixtured.
    expect(detectGoal('HubSpot or Salesforce')).toBe(false)
    // …so this true is the SCAFFOLD LABEL's doing, and nothing else's.
    expect(detectGoal("The decision I'm facing is: HubSpot or Salesforce")).toBe(true)
  })

  it('DISCRIMINATING — the detector has not simply stopped discriminating', () => {
    // Without this the case above passes on a detector that returns true for
    // everything, which is how a guard goes quiet without going red.
    expect(detectGoal('')).toBe(false)
    expect(detectGoal('hello')).toBe(false)
    // …and it still detects a genuine goal through a DIFFERENT branch, so the
    // fixture above is narrow rather than the detector being broken.
    expect(detectGoal('We need to reach 20% margin')).toBe(true)
  })
})
