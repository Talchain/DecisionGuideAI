/**
 * THE AUTO-RECOVERED GRAPH KEEPS ITS OWN SCENARIO — the silent-data-loss guard.
 *
 * ⚠ THE DEFECT THIS PINS, MEASURED ON THE DEPLOYED BUILD (staging `a206cca9`,
 * 31 Aug 2026, guest, scenario `73c56180-195c-46f4-b910-e89aded4fc26`):
 *
 * The boot arbiter restored the autosaved GRAPH and then resolved its scenario
 * identity from a DIFFERENT record — `localStorage['olumi-canvas-current-
 * scenario-id']` — calling `clearCurrentScenarioId()` when that pointer was
 * missing, even though the record it had just restored carried its own
 * `scenarioId`. `useConversation.sendTurn` then minted a fresh UUID, and every
 * later turn was addressed to a scenario CEE holds no graph for. A
 * `factor_value_edit` left the browser perfectly formed, matched no node at the
 * server, and the optimistic value was reverted minutes later with no
 * explanation. The user's number was silently lost.
 *
 * One variable, opposite outcomes, both captured at the wire:
 *   pointer ABSENT  → `scenario_id: e2b272ba…` (0 nodes server-side); the graph
 *                     on screen (`73c56180…`) stayed at `value 0.5,
 *                     cee_inference`.
 *   pointer PRESENT → `scenario_id: 73c56180…`; cold read after the identical
 *                     click: `raw_value 0.85, source user_override`.
 *
 * ⚠⚠ WHY THIS FILE DRIVES THE BOOT FUNCTION INSTEAD OF SCANNING FOR IT, and it
 * is this lane's own measured lesson rather than an inherited principle.
 *
 * The first cut of this guard pinned the wiring with `expect(branch).toContain(
 * 'autosave.scenarioId')`. That string ALREADY occurred twice inside the same
 * brace-matched branch — the legacy results-restore a few lines below — so the
 * assertion was satisfied by a different object entirely, and it said nothing
 * whatever about the argument that IS the fix. Measured, applied-check exactly
 * one file each, at the pristine PR head:
 *
 *   · second argument replaced by `null` (behaviourally IDENTICAL to the
 *     original defect — the record fallback can never fire) → **8/8 GREEN**;
 *   · second argument replaced by `autosave.selectedGoalNode`  → **8/8 GREEN**.
 *
 * The P0 was fully restorable with the entire spec passing. `toContain` on a
 * string that occurs elsewhere in the scanned region is not a binding — it is
 * trap 19 (a test passing on a different object) reached through a substring.
 *
 * So the load-bearing work moved behind `bindRestoredScenarioId`, and §2 below
 * EXECUTES it against the real `useCanvasStore` and real `localStorage`. That is
 * this file's own precedent: `reactFlowGraph.restoreFreshnessOnBoot.spec.ts`
 * records that `resolveRestoredFreshnessUpdate` had a 10/10 unit kit with five
 * biting mutants and DELETING ITS SOLE PRODUCTION CALL SITE survived that kit
 * and a 1,122-test sweep with zero reds. A pure function with a perfect unit kit
 * is not evidence that the product calls the unit.
 *
 *   §1 UNIT      — the rule itself, including the case the defect lived in.
 *   §2 DRIVEN    — the real boot function, real store, real localStorage: what
 *                  it binds, what it re-persists, what it clears.
 *   §3 CALL SITE — the one step §2 cannot execute, and only that step.
 *   §4 DELETE    — the resurrection hazard the §1 fallback opens, closed at the
 *                  delete and guarded here.
 *
 * ⚠ WHAT §3 DOES **NOT** PROVE, stated so nobody reads more into it: it is a
 * SOURCE scan. It cannot show the branch RUNS at boot — that branch is gated on
 * `import.meta.env.PROD` and therefore never executes under vitest, which is
 * exactly why extract-and-drive is the strongest instrument available here. The
 * execution evidence for the defect itself is the deployed-wire measurement
 * quoted above, not this file.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveRestoredScenarioId, bindRestoredScenarioId } from '../ReactFlowGraph'
import { useCanvasStore } from '../store'
import * as scenarios from '../store/scenarios'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE_PATH = join(HERE, '..', 'ReactFlowGraph.tsx')

/**
 * The id the RECORD carries — the graph that was actually on screen in the
 * incident. This one is used verbatim, because it is the object the fix
 * protects.
 */
const GRAPH_OWN_ID = '73c56180-195c-46f4-b910-e89aded4fc26'

/**
 * ⚠ A NEUTRAL pointer id, deliberately NOT the incident's `e2b272ba…`.
 *
 * The precedence case below pins "pointer wins". Pinning it with the incident's
 * OWN fork id would have the suite assert that the 0-node scenario CEE had never
 * seen is the correct answer in the very case under repair — endorsing the harm
 * in the guard written to prevent it. The rule being pinned is general; the
 * fixture should not smuggle in a specific case it gets wrong.
 */
const LIVE_POINTER_ID = 'c41d9f02-7a63-4f8e-9b21-0d5e6c8a3417'

// ─── §1 THE RULE ──────────────────────────────────────────────────────────────

describe('resolveRestoredScenarioId', () => {
  /**
   * ⭐ THE DEFECT CASE. Before the fix this resolved to `null` and the boot path
   * went on to CLEAR the pointer — orphaning a graph that knew its own id.
   */
  it('falls back to the id carried IN the restored record when the pointer is missing', () => {
    expect(resolveRestoredScenarioId(null, GRAPH_OWN_ID)).toBe(GRAPH_OWN_ID)
  })

  it('falls back to the record when the pointer is a legacy non-UUID', () => {
    expect(resolveRestoredScenarioId('scenario-1712345678-ab12', GRAPH_OWN_ID)).toBe(GRAPH_OWN_ID)
  })

  /**
   * PRECEDENCE, and the argument is STRUCTURAL rather than statistical: every
   * writer of `autosave.scenarioId` projects the store's `currentScenarioId`
   * (`autosaveProjection.ts:199`, `useAutosave.ts:330`, `crashFlush.ts:201`
   * whose fallback IS the pointer), and the mint writes the pointer first
   * (`useConversation.ts:3677-3678`). The record is therefore at or behind the
   * pointer and can never be ahead, so a disagreement at boot means the
   * projection has not caught up — not that the pointer is wrong.
   *
   * Neutral ids, for the reason given at LIVE_POINTER_ID.
   */
  it('prefers the pointer over the record when both are well-formed and DIFFER', () => {
    expect(resolveRestoredScenarioId(LIVE_POINTER_ID, GRAPH_OWN_ID)).toBe(LIVE_POINTER_ID)
  })

  /**
   * The "drop into draft mode" behaviour the original branch was written for
   * SURVIVES — it is narrowed to the case where nothing anywhere states an id,
   * not removed. `null` here is what makes the caller clear the pointer.
   */
  it('returns null when neither record states a usable id', () => {
    expect(resolveRestoredScenarioId(null, undefined)).toBeNull()
    expect(resolveRestoredScenarioId(null, null)).toBeNull()
    expect(resolveRestoredScenarioId('', '')).toBeNull()
    expect(resolveRestoredScenarioId('scenario-1712345678-ab12', 'scenario-99-zz')).toBeNull()
  })
})

// ─── shared fixtures ─────────────────────────────────────────────────────────

/**
 * A real autosave record, written through the REAL `saveAutosave` so the
 * localStorage bytes are the ones boot would actually read.
 *
 * `timestamp` is varied per call because `saveAutosave` skips a byte-identical
 * payload (module-level `lastAutosavePayload`, which `localStorage.clear()` does
 * not reset). Every caller asserts the write LANDED rather than assuming it —
 * a fixture that silently no-ops makes every assertion after it vacuous.
 */
let autosaveNonce = 0
function writeAutosave(scenarioId: string | undefined, timestamp = Date.now()): void {
  autosaveNonce += 1
  scenarios.saveAutosave({
    timestamp,
    scenarioId,
    nodes: [{ id: `n${autosaveNonce}`, position: { x: 0, y: 0 }, data: {} }] as never,
    edges: [],
    selectedGoalNode: 'goal_from_the_record',
  })
  const landed = scenarios.loadAutosave()
  if (!landed) throw new Error('fixture precondition failed: autosave did not persist')
  if (landed.scenarioId !== scenarioId) {
    throw new Error(`fixture precondition failed: autosave carries ${landed.scenarioId}`)
  }
}

function resetPersistence(): void {
  localStorage.clear()
  sessionStorage.clear()
  useCanvasStore.setState({ currentScenarioId: null })
}

// ─── §2 THE BOOT FUNCTION, DRIVEN ────────────────────────────────────────────

/**
 * ⭐ THE MUTATION-SENSITIVE SECTION. These drive `bindRestoredScenarioId` for
 * real, so the two mutants that survived the previous guard — second argument
 * `null`, second argument `autosave.selectedGoalNode` — both go RED here:
 * neither can produce `GRAPH_OWN_ID` in the store, and `selectedGoalNode` is not
 * even UUID-shaped, so it lands in the clear branch.
 */
describe('bindRestoredScenarioId (driven against the real store and localStorage)', () => {
  beforeEach(resetPersistence)
  afterEach(resetPersistence)

  it('⭐ binds the RECORD\'S OWN id when the pointer is missing, and re-persists it', () => {
    writeAutosave(GRAPH_OWN_ID)
    const autosave = scenarios.loadAutosave()!

    // Precondition pinned in-test: the pointer really is absent, so the outcome
    // below is the fallback's doing and not a leftover pointer's.
    expect(scenarios.getCurrentScenarioId()).toBeNull()

    const bound = bindRestoredScenarioId(scenarios.getCurrentScenarioId(), autosave)

    expect(bound).toBe(GRAPH_OWN_ID)
    expect(useCanvasStore.getState().currentScenarioId).toBe(GRAPH_OWN_ID)
    // RECONVERGENCE: without this the branch re-runs on every reload.
    expect(scenarios.getCurrentScenarioId()).toBe(GRAPH_OWN_ID)
  })

  it('binds the record\'s id when the pointer is a legacy non-UUID', () => {
    writeAutosave(GRAPH_OWN_ID)
    scenarios.setCurrentScenarioId('scenario-1712345678-ab12')
    const autosave = scenarios.loadAutosave()!

    expect(bindRestoredScenarioId(scenarios.getCurrentScenarioId(), autosave)).toBe(GRAPH_OWN_ID)
    expect(useCanvasStore.getState().currentScenarioId).toBe(GRAPH_OWN_ID)
    expect(scenarios.getCurrentScenarioId()).toBe(GRAPH_OWN_ID)
  })

  /**
   * The precedence arm, driven. The precondition — that the two records
   * genuinely DISAGREE — is asserted rather than assumed, so this cannot pass by
   * the fixture quietly collapsing them into one id (trap 13b).
   */
  it('keeps the live pointer when both are well-formed and differ', () => {
    writeAutosave(GRAPH_OWN_ID)
    scenarios.setCurrentScenarioId(LIVE_POINTER_ID)
    const autosave = scenarios.loadAutosave()!
    expect(autosave.scenarioId).not.toBe(scenarios.getCurrentScenarioId())

    expect(bindRestoredScenarioId(scenarios.getCurrentScenarioId(), autosave)).toBe(LIVE_POINTER_ID)
    expect(useCanvasStore.getState().currentScenarioId).toBe(LIVE_POINTER_ID)
  })

  /**
   * DRAFT MODE SURVIVES. A record stating no id must still clear both halves —
   * this is the behaviour the original branch existed for, and the fix narrows
   * it rather than removing it.
   */
  it('clears BOTH records when nothing states a usable id', () => {
    writeAutosave(undefined)
    scenarios.setCurrentScenarioId('scenario-1712345678-ab12')
    useCanvasStore.setState({ currentScenarioId: 'scenario-1712345678-ab12' })
    const autosave = scenarios.loadAutosave()!

    expect(bindRestoredScenarioId(scenarios.getCurrentScenarioId(), autosave)).toBeNull()
    expect(useCanvasStore.getState().currentScenarioId).toBeNull()
    expect(scenarios.getCurrentScenarioId()).toBeNull()
  })
})

// ─── §3 THE ONE STEP §2 CANNOT EXECUTE ───────────────────────────────────────

/**
 * Extract the body of the `loadSource === 'autosave'` branch by brace-matching
 * from its own condition, so the scan reads THAT branch and not the whole file.
 * Returns null when the anchor is absent — which the tests treat as a failure,
 * never as a clean sweep (an extractor that finds nothing agrees with every
 * other extractor that finds nothing).
 */
function autosaveRestoreBranch(source: string): string | null {
  const anchor = source.indexOf("if (loadSource === 'autosave' && autosave)")
  if (anchor === -1) return null
  const open = source.indexOf('{', anchor)
  if (open === -1) return null
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  return null
}

describe('the boot branch calls the driven function, with the record', () => {
  const source = readFileSync(SOURCE_PATH, 'utf8')
  const branch = autosaveRestoreBranch(source)

  it('the extractor found a NON-EMPTY branch (instrument check, not a claim)', () => {
    expect(branch).not.toBeNull()
    expect((branch as string).length).toBeGreaterThan(500)
  })

  /**
   * ⚠ BOUND BY IDENTITY, WITH A NEGATIVE CONTROL — because the assertion this
   * replaces (`toContain('autosave.scenarioId')`) was satisfied by an unrelated
   * occurrence of the same substring elsewhere in this very branch.
   *
   * A matcher that only proves it can SEE something proves nothing about what it
   * saw; the negative controls below are what make a hit meaningful, and they
   * also pin the F5 repair (the pointer is REUSED from the load-source decision,
   * not re-read across the synchronous `hydrateGraphSlice`).
   */
  it('passes the load-source pointer AND the autosave record, by identity', () => {
    const callsWithRecord = (text: string) =>
      /bindRestoredScenarioId\(\s*currentId\s*,\s*autosave\s*\)/.test(text)

    // POSITIVE CONTROL — the matcher can see the shape when it is present.
    expect(callsWithRecord('bindRestoredScenarioId(currentId, autosave)')).toBe(true)

    // NEGATIVE CONTROLS — it REJECTS the mutations that defeated the old guard,
    // and the re-read F5 asks us to remove.
    expect(callsWithRecord('bindRestoredScenarioId(currentId, null)')).toBe(false)
    expect(callsWithRecord('bindRestoredScenarioId(currentId, autosave.selectedGoalNode)')).toBe(false)
    expect(callsWithRecord('bindRestoredScenarioId(scenarios.getCurrentScenarioId(), autosave)')).toBe(false)

    expect(callsWithRecord(branch as string)).toBe(true)
  })

  /**
   * The defect in its exact original spelling. Its return would mean the branch
   * had gone back to reading only the pointer.
   *
   * POSITIVE CONTROL: the same matcher, over the same kind of input, MUST see
   * the string when it is genuinely present — otherwise this assertion passes by
   * being unable to look.
   */
  it('no longer resolves the id from the pointer ALONE', () => {
    const readsPointerOnly = (text: string) =>
      /const\s+persistedScenarioId\s*=\s*scenarios\.getCurrentScenarioId\(\)/.test(text)

    expect(
      readsPointerOnly('const persistedScenarioId = scenarios.getCurrentScenarioId()\n'),
    ).toBe(true)

    expect(readsPointerOnly(branch as string)).toBe(false)
  })
})

// ─── §4 THE RESURRECTION HAZARD THE FALLBACK OPENS ───────────────────────────

/**
 * ⭐⭐ A DELETED DECISION MUST NOT COME BACK.
 *
 * The §1 fallback reads an id out of the autosave record. `deleteScenario`
 * removed the RECORD and the POINTER but left the autosave — so local delete was
 * the one enumerated production path that produced this fallback's trigger state
 * (autosave holding a live UUID, pointer missing), and it is precisely the path
 * where restoring that id is WRONG. The boot path then re-persists what it
 * resolves, which would make the resurrection durable where before it was not.
 *
 * `useScenario.deleteScenario:984-985` already cleared both for the server-backed
 * path, citing this exact harm. Two delete paths asking one question must not
 * answer it differently, so the invariant now lives in `scenarios.deleteScenario`
 * — next to the record it guards, and covering every caller.
 *
 * ⚠ An EXISTENCE TEST in the resolver was considered as the alternative and
 * rejected on evidence: on the guest path this defect was measured on there are
 * no local scenario records at all, so "never saved" and "deleted" are
 * indistinguishable by existence, and requiring the id to resolve would make the
 * fallback refuse exactly the case it exists for.
 */
describe('a locally deleted decision does not come back on the next boot', () => {
  beforeEach(resetPersistence)
  afterEach(resetPersistence)

  /**
   * Reproduces the boot arbiter's load-source decision and binding, in the same
   * order `ReactFlowGraph`'s init effect does. It is a REPRODUCTION, not the
   * effect itself — the effect is gated on `import.meta.env.PROD` and cannot run
   * here. What it does prove is that the state the delete LEAVES BEHIND cannot
   * feed the fallback, which is where the harm lives.
   */
  function rebootAndBind(): string | null {
    const currentId = scenarios.getCurrentScenarioId()
    const autosave = scenarios.loadAutosave()
    const scenario = currentId ? scenarios.getScenario(currentId) : null

    let loadSource: 'autosave' | 'scenario' | 'none' = 'none'
    if (autosave && scenario) {
      loadSource = autosave.timestamp > scenario.updatedAt ? 'autosave' : 'scenario'
    } else if (autosave) {
      loadSource = 'autosave'
    } else if (scenario) {
      loadSource = 'scenario'
    }

    if (loadSource === 'autosave' && autosave) return bindRestoredScenarioId(currentId, autosave)
    return null
  }

  it('⭐ delete → reboot: the deleted id is not rebound, re-persisted, or restored', () => {
    const created = scenarios.createScenario({
      id: GRAPH_OWN_ID,
      name: 'A decision the user deletes',
      nodes: [],
      edges: [],
    })
    // `createScenario` sets the pointer; the autosave is stamped with the same
    // id, exactly as the projection does while the decision is open.
    writeAutosave(created.id, created.updatedAt + 1000)

    // PRECONDITIONS, pinned — this test is only about a delete if all three hold.
    expect(scenarios.getCurrentScenarioId()).toBe(GRAPH_OWN_ID)
    expect(scenarios.getScenario(GRAPH_OWN_ID)).toBeDefined()
    expect(scenarios.loadAutosave()?.scenarioId).toBe(GRAPH_OWN_ID)

    scenarios.deleteScenario(GRAPH_OWN_ID)

    // The record and the pointer are gone — this much was already true.
    expect(scenarios.getScenario(GRAPH_OWN_ID)).toBeUndefined()
    expect(scenarios.getCurrentScenarioId()).toBeNull()

    // ⭐ AND THE AUTOSAVE MUST NOT STILL BE CARRYING IT. This is the assertion
    // that REDs against the unrepaired code.
    expect(scenarios.loadAutosave()?.scenarioId).not.toBe(GRAPH_OWN_ID)

    // Reboot. Nothing may rebind the deleted decision, in memory or on disk.
    expect(rebootAndBind()).not.toBe(GRAPH_OWN_ID)
    expect(useCanvasStore.getState().currentScenarioId).not.toBe(GRAPH_OWN_ID)
    expect(scenarios.getCurrentScenarioId()).not.toBe(GRAPH_OWN_ID)
  })

  /**
   * DISCRIMINATING TWIN. Deleting some OTHER decision must NOT throw away the
   * autosave of the one still open — otherwise the guard above would be bought
   * by clearing the autosave unconditionally, which loses the user's live work.
   * The pair is what proves the clear is keyed on identity.
   */
  it('deleting a DIFFERENT decision leaves the open one\'s autosave intact', () => {
    const other = scenarios.createScenario({ name: 'Some other decision', nodes: [], edges: [] })
    scenarios.createScenario({ id: GRAPH_OWN_ID, name: 'The open one', nodes: [], edges: [] })
    writeAutosave(GRAPH_OWN_ID)

    expect(scenarios.loadAutosave()?.scenarioId).toBe(GRAPH_OWN_ID)

    scenarios.deleteScenario(other.id)

    expect(scenarios.loadAutosave()?.scenarioId).toBe(GRAPH_OWN_ID)
    expect(scenarios.getScenario(GRAPH_OWN_ID)).toBeDefined()
  })
})
