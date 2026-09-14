/**
 * PC4 — THE MODEL TAB'S GOAL ROWS PRINTED THE SAME STRING FIVE TIMES
 * (ROADMAP 2.334).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE DEFECT
 * ─────────────────────────────────────────────────────────────────────────
 * The walk's run scored five options at `probability_of_goal` 0.0007,
 * 0.0001, 0.0004, 0 and 0.0002. Every one of them rendered
 *
 *     Option N — < 1% likely to reach target
 *
 * because the goal register's formatter was floor-only. The rows were
 * correctly ordered, correctly sourced and completely unreadable: a user
 * could not tell which option was best, could not see that the status quo
 * came LAST, and had no way to know the five numbers differed at all. The
 * data was on the wire the whole time — `option_probabilities[id].outcome.
 * n_valid_samples` was 10000 for every option — and the row builder simply
 * did not carry it.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE PINS
 * ─────────────────────────────────────────────────────────────────────────
 *  1. `buildGoalFitRows` CARRIES `nValidSamples` off the producer entry,
 *     through the same positive-integer guard the response mapper uses.
 *  2. `GoalSection` SPENDS it — the rows render five distinct readouts, and
 *     their value ordering is legible in the rendered strings.
 *
 * Both halves are needed: a row builder that carries the count to a section
 * that ignores it is the "threaded but unspent" failure, and a section that
 * would spend a count it is never given is the "spent but unthreaded" one.
 * A mutant for each is in the slice's mutant set.
 *
 * Scope limit (trap 3): string content and DOM order only — no layout,
 * visibility or above-the-fold claim.
 */

import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { buildGoalFitRows } from '../buildGoalFitRows'

/** The walk's measured quintet, in producer order, with its sample count. */
const WALK_QUINTET = [0.0007, 0.0001, 0.0004, 0, 0.0002] as const
const WALK_N = 10000

/**
 * The producer shape: `probability_of_goal` + `outcome.n_valid_samples`.
 *
 * ⚠ `nValid` is `number | null`, NOT an optional with a default. A default
 * parameter is applied when the argument is `undefined`, so `producerEntry(p,
 * undefined)` would silently mean "the walk's count" rather than "no count" —
 * which is exactly the fixture a no-resolution test needs and exactly what it
 * would NOT get. `null` is the explicit absence sentinel here for that reason.
 */
function producerEntry(p: number, nValid: number | null = WALK_N) {
  return {
    probability_of_goal: p,
    outcome: {
      mean: 1_000_000,
      ...(nValid === null ? {} : { n_valid_samples: nValid }),
    },
  }
}

function optionNodes(count: number): Node[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `opt_${i}`,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { label: `Option ${i}` },
  }))
}

function walkReport(nValid: number | null = WALK_N) {
  return Object.fromEntries(
    WALK_QUINTET.map((p, i) => [`opt_${i}`, producerEntry(p, nValid)]),
  )
}

/*
 * ⚠ `goalNodeWithTarget()` REMOVED 2026-09-11. It supplied the goal node to the
 * deleted `GoalSection` render cases; the builder cases below take options and a
 * producer map, not a goal node. An unused fixture is the next session's false
 * map of what this file still covers.
 */

describe('buildGoalFitRows — carries the wire sample count (ROADMAP 2.334)', () => {
  it('positive control: the builder resolves the walk fixture to five complete rows', () => {
    // The builder is complete-field gated — it returns null unless EVERY
    // option carries an admissible figure. If the fixture stopped reaching
    // that branch, the assertions below would run against `null`.
    const rows = buildGoalFitRows(optionNodes(5), walkReport())
    expect(rows).not.toBeNull()
    expect(rows).toHaveLength(5)
    expect(rows?.map((r) => r.probability)).toEqual([...WALK_QUINTET])
  })

  it('reads n_valid_samples off the producer entry onto every row', () => {
    const rows = buildGoalFitRows(optionNodes(5), walkReport())
    expect(rows?.map((r) => r.nValidSamples)).toEqual([WALK_N, WALK_N, WALK_N, WALK_N, WALK_N])
  })

  it('yields null nValidSamples when the producer omits the count', () => {
    // Absent ≠ zero, and absent ≠ "assume a default". A run without the
    // count must fall back to the register floor, not invent a resolution.
    const rows = buildGoalFitRows(optionNodes(5), walkReport(null))
    expect(rows).not.toBeNull()
    expect(rows?.every((r) => r.nValidSamples == null)).toBe(true)
  })

  it('rejects a non-positive or non-integer count rather than trusting it', () => {
    // The same `positiveIntegerOrNull` discipline the response mapper
    // applies: a zero sample count would make the resolution threshold
    // infinite, and a fractional one is not a sample count at all.
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      const rows = buildGoalFitRows(optionNodes(1), { opt_0: producerEntry(0.0007, bad) })
      expect(rows?.[0]?.nValidSamples ?? null).toBeNull()
    }
  })
})

/**
 * ⚠⚠ NARROWED 2026-09-11 — THE RENDER HALF'S SUBJECT WAS DELETED.
 *
 * `describe('T-2334-1 — GoalSection renders the ordering it was always given')`
 * was here, with five cases driving `GoalSection` through
 * `const { GoalSection } = await import('../GoalSection')`. `GoalSection.tsx` was
 * deleted with the v1 Model stack (Paul's ruling): it rendered only inside
 * `ModelTabBody`'s `LEGACY_DETAILED_EDITOR_MOUNTED = false` gate and had no other
 * production importer.
 *
 * ⭐ THE BUILDER HALF ABOVE IS UNCHANGED AND STILL PASSES — BUT IT DOES NOT GUARD A
 * LIVE PATH, AND SAYING THAT IT DOES WOULD DEFEAT THE TRIGGER THIS COMMIT ADDS.
 * `buildGoalFitRows.ts` survives the deletion PRODUCTION-ORPHANED. Measured at this
 * head, repo-wide, with a contrast control in each sweep:
 *   · its only non-spec mention anywhere is the doctrine COMMENT at
 *     `ModelTabBody.tsx:27` — a `//` line, not an import (same file: 26 real
 *     `import` statements, and `buildCanvasLabelMap` imported AND called, so the
 *     sweep can plainly tell a call site from a mention);
 *   · no `import()`, `require()` or `vi.mock()` form reaches it either;
 *   · `src/canvas/model-tab-v2/` contains ZERO references to it — so it does not
 *     feed the v2 outline. (v2 does import `strengthBands`, `utils` and
 *     `ModelHealthSection` from this directory. It has never imported this module.)
 * Its only executable callers are three specs: this file,
 * `l62GoalFitWithheld.surfaces` and `notAnalysedQuantifiers`. The module's own
 * header says the same thing — keep the two in agreement rather than reconciling
 * them in the optimistic direction.
 *
 * ⭐ SO WHAT THIS FILE IS FOR NOW. It pins the builder's BEHAVIOUR — the ROADMAP
 * 2.334 wire-count carriage — so the module cannot rot silently while it is parked.
 * That is worth keeping. It is NOT evidence that the module is wanted, and its
 * greenness is not a reason to keep the file. THE THING TO ACT ON IS THE RE-SURFACE
 * TRIGGER on `buildGoalFitRows.ts`: (a) any file under `src/canvas/model-tab-v2/`
 * growing a per-option goal-probability or goal-fit surface, or (b) 2026-12-11 —
 * whichever comes first. Limb (a) had NOT fired when this was written (zero
 * `goalProbability` / `probability_of_goal` / `goal_probability` /
 * `probability_of_joint_goal` under that directory, against 17 live `probability`
 * matches in the same sweep). When it fires, the module is wired or deleted — and
 * these four cases go with it if it is deleted.
 *
 * ⚠ WHAT IS GENUINELY NO LONGER COVERED, NAMED RATHER THAN IMPLIED CLOSED: that
 * the five distinct percentages are legible ON SCREEN. The builder cases prove the
 * numbers reach the rows; nothing here now proves a renderer prints them distinctly.
 * At this head no renderer consumes these rows at all, so there is nothing to cover
 * yet — the gap becomes real the moment trigger limb (a) fires, and it belongs to
 * whoever builds that v2 surface.
 *
 * ⚠ AND A METHOD NOTE WORTH KEEPING. This importer was invisible to a
 * `from '...'` regex sweep because it is a DYNAMIC `await import()`. It was caught
 * by the typecheck gate, not by the manifest. Any future importer sweep in this
 * estate must cover `import()`, `require()` and `vi.mock()`, not just `from`.
 */
