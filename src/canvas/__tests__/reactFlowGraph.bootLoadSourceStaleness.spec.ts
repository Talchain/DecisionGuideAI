/**
 * ⭐ A STALE AUTOSAVE MUST NOT BE PUT ON SCREEN UNDER A FRESH IDENTITY.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT — TWO CORRECT RULES THAT CONTRADICT EACH OTHER
 * ═══════════════════════════════════════════════════════════════════════════
 * Boot resolved the GRAPH and the IDENTITY through two independent rules:
 *
 *   LOAD SOURCE  (the init effect)        "show whichever is NEWER"
 *   BINDING      (resolveRestoredScenarioId) "prefer the POINTER"
 *
 * Each is defensible alone. Composed, a newer autosave carrying decision A
 * supplies the graph while a well-formed pointer naming decision B supplies the
 * identity — so the canvas DISPLAYS A while every subsequent edit is ADDRESSED
 * TO B. The user's edit lands somewhere they cannot see: the silent-discard
 * class, and the worst failure this product has.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE FIX IS NOT "DISPLAY WINS" — the measurement that refuted it
 * ═══════════════════════════════════════════════════════════════════════════
 * The obvious repair is to make binding follow the graph on screen. It is
 * WRONG, for a structural reason, and this suite exists partly to stop it being
 * reintroduced as an "obvious" simplification:
 *
 *   `useAutosave` stamps `scenarioId: currentScenarioId` — the autosave's id is
 *   a COPY OF THE POINTER — and the mint writes the pointer FIRST
 *   (`useConversation.ts`). The autosave is therefore BY CONSTRUCTION at or
 *   behind the pointer and can never be ahead.
 *
 * So a well-formed disagreement can only mean the autosave is STALE, and
 * display-wins would adopt the stale side EVERY TIME — binding the user back to
 * the scenario they deliberately switched away from. It would ship the same
 * harm it was written to prevent, through the other door.
 *
 * The window is real: `store.ts`'s `loadScenario` never calls `clearAutosave()`,
 * and `useAutosave` skips its replacement write while the existing slot is
 * younger than `DEBOUNCE_MS` (500ms), on an unchanged hash, or when
 * `mayPersistGraphNow` declines.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RUNG THIS SUITE REACHES — TESTED. NOT MOUNTED. NOT WIRE-WITNESSED.
 * ═══════════════════════════════════════════════════════════════════════════
 * The boot effect is gated on `import.meta.env.PROD` and NEVER EXECUTES under
 * vitest, so no test in this repo can prove the deployed build takes this path.
 * What is proven here is the PREDICATE, driven directly, plus a source-level pin
 * that the effect calls it. The remaining step is a DEPLOYED CAPTURE: switch
 * A -> B, reload inside the window, and read the outbound `scenario_id` of the
 * first edit against the graph on screen. Until that exists, no claim above
 * TESTED may be made for this fix — and the conflict case has NO live witness in
 * either direction (the binding docblock's own measurement covers the
 * pointer-ABSENT arm and says so: "the forked browser was never read for
 * `autosave.scenarioId` itself").
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { resolveBootLoadSource } from '../ReactFlowGraph'

const SOURCE_PATH = resolve(__dirname, '../ReactFlowGraph.tsx')

/** Two well-formed, DIFFERENT scenario ids. */
const POINTER_ID = 'bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb'
const STALE_AUTOSAVE_ID = 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa'
const LEGACY_ID = 'scenario-1712345678-ab12'

/** A record for the pointer, older than the autosave — so "newest wins" would pick the autosave. */
const OLDER_RECORD = { updatedAt: 1_000 }
const NEWER_AUTOSAVE = (scenarioId: string | null | undefined) => ({
  timestamp: 9_000,
  scenarioId,
})

describe('resolveBootLoadSource — a well-formed disagreement is STALENESS, not a tie', () => {
  it('⭐ THE DEFECT: a NEWER autosave naming a DIFFERENT decision is refused; the pointer’s record is rendered', () => {
    // Precondition pinned in-test: "newest wins" genuinely WOULD have chosen the
    // autosave here. Without this the case could pass on a state where the two
    // rules never disagreed, which is the branch that already worked.
    expect(NEWER_AUTOSAVE(STALE_AUTOSAVE_ID).timestamp).toBeGreaterThan(OLDER_RECORD.updatedAt)
    expect(STALE_AUTOSAVE_ID).not.toBe(POINTER_ID)

    expect(
      resolveBootLoadSource(POINTER_ID, NEWER_AUTOSAVE(STALE_AUTOSAVE_ID), OLDER_RECORD),
      'a stale autosave was put on screen while the identity stayed on the pointer — every edit ' +
        'after this restore is addressed to a decision the user is not looking at',
    ).toBe('scenario')
  })

  it('⭐ TWIN 1 (a MATCHING pair is completely unaffected): same id, newer autosave, still the autosave', () => {
    // This is the whole crash-recovery purpose of the slot. A fix that refused
    // the autosave whenever it was newer would silently destroy unsaved work —
    // the mirror defect, and strictly worse than the one being fixed.
    expect(
      resolveBootLoadSource(POINTER_ID, NEWER_AUTOSAVE(POINTER_ID), OLDER_RECORD),
      'unsaved work for the decision the user is actually in was dropped on boot',
    ).toBe('autosave')
  })

  it('TWIN 1b: a matching pair with an OLDER autosave still prefers the record (rule unchanged)', () => {
    expect(
      resolveBootLoadSource(POINTER_ID, { timestamp: 500, scenarioId: POINTER_ID }, OLDER_RECORD),
    ).toBe('scenario')
  })

  it('⭐ TWIN 2 (POINTER ABSENT keeps today’s behaviour): the autosave is still taken', () => {
    // The guest / never-saved path. `olumi-canvas-scenarios` is routinely absent
    // there, so refusing the autosave would refuse exactly the case the
    // fallback exists for.
    expect(resolveBootLoadSource(null, NEWER_AUTOSAVE(STALE_AUTOSAVE_ID), null)).toBe('autosave')
    expect(resolveBootLoadSource(null, NEWER_AUTOSAVE(STALE_AUTOSAVE_ID), OLDER_RECORD)).toBe(
      'autosave',
    )
  })

  it('TWIN 3 (a LEGACY id on either side is not a well-formed disagreement): newest-wins still applies', () => {
    // The staleness inference rests on both sides stating a real id. A legacy
    // non-UUID states nothing, so it may not trigger a refusal.
    expect(resolveBootLoadSource(LEGACY_ID, NEWER_AUTOSAVE(STALE_AUTOSAVE_ID), OLDER_RECORD)).toBe(
      'autosave',
    )
    expect(resolveBootLoadSource(POINTER_ID, NEWER_AUTOSAVE(LEGACY_ID), OLDER_RECORD)).toBe(
      'autosave',
    )
    expect(resolveBootLoadSource(POINTER_ID, NEWER_AUTOSAVE(undefined), OLDER_RECORD)).toBe(
      'autosave',
    )
  })

  it('SCOPE PIN — the divergence REMAINS OPEN when the pointer names no local record', () => {
    // Stated as a test so the residual is visible rather than inferred from a
    // comment. `scenario === null` means there is no renderable alternative, so
    // the stale slot is still taken and display/identity can still disagree.
    // If this ever flips, the residual has been closed and the report that says
    // it is open has gone stale.
    expect(
      resolveBootLoadSource(POINTER_ID, NEWER_AUTOSAVE(STALE_AUTOSAVE_ID), null),
      'if this is no longer "autosave", the guest/never-saved fallback has changed',
    ).toBe('autosave')
  })

  it('no source at all → none', () => {
    expect(resolveBootLoadSource(null, null, null)).toBe('none')
    expect(resolveBootLoadSource(POINTER_ID, null, null)).toBe('none')
  })
})

/**
 * A pure function with a perfect unit kit is not evidence that the product
 * calls the unit — this file's own recorded lesson (`restoreCeeAnalysisReady`,
 * `reactFlowGraph.restoreFreshnessOnBoot.spec.ts`). The effect cannot be
 * executed here, so the call site is pinned by source, WITH controls: a matcher
 * that only proves it can see something proves nothing about what it saw.
 */
describe('the boot effect calls the driven predicate (source pin, with controls)', () => {
  const source = readFileSync(SOURCE_PATH, 'utf8')

  it('the extractor found a non-empty source (instrument check, not a claim)', () => {
    expect(source.length).toBeGreaterThan(1000)
  })

  it('the load source is DRIVEN, not re-derived inline', () => {
    const drives = (text: string) =>
      /const\s+loadSource\s*=\s*resolveBootLoadSource\(\s*currentId\s*,\s*autosave\s*,\s*scenario\s*\)/.test(
        text,
      )

    // POSITIVE CONTROL — the matcher can see the shape when present.
    expect(drives('const loadSource = resolveBootLoadSource(currentId, autosave, scenario)')).toBe(
      true,
    )
    // NEGATIVE CONTROLS — it rejects the arguments that would defeat the fix.
    expect(drives('const loadSource = resolveBootLoadSource(null, autosave, scenario)')).toBe(false)
    expect(drives('const loadSource = resolveBootLoadSource(currentId, autosave, null)')).toBe(false)

    expect(drives(source)).toBe(true)
  })

  it('the ORIGINAL inline newest-wins comparison is gone', () => {
    // Its return would mean the effect had stopped consulting the predicate.
    const inlineNewestWins = (text: string) =>
      /if\s*\(\s*autosave\.timestamp\s*>\s*scenario\.updatedAt\s*\)\s*\{[\s\S]{0,80}loadSource\s*=\s*'autosave'/.test(
        text,
      )

    // POSITIVE CONTROL over the same kind of input.
    expect(
      inlineNewestWins("if (autosave.timestamp > scenario.updatedAt) {\n  loadSource = 'autosave'"),
    ).toBe(true)

    expect(inlineNewestWins(source)).toBe(false)
  })
})
