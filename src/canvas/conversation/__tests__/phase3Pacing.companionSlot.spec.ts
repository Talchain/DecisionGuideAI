/**
 * ROADMAP 2.242 — the lens companion card's guaranteed default-expanded slot.
 *
 * ## The defect these pins hold
 * The companion card (`v5_exercise`) is the structured artefact CEE attaches
 * beside the lens `selectLens` actually chose — derived at the CEE bytes
 * (tip `6766b540`, `compose/phase3-blocks.ts::buildLensCompanionBlocks`,
 * typed `readonly ExerciseBlock[]`, compile-exhaustive over `LensId`, at most
 * one per turn). ROADMAP 2.211 §2 gave it a finite rank —
 * `max(review_card rank) + 0.5` — but rank is not visibility: two card
 * families outrank the WHOLE review-card group it anchors to (producer
 * `evidence` at ranks 1-3, and the deterministic `strengthen` coaching card
 * at rank 15, against review cards at 10-73), so the companion lands well
 * past the default-expanded cap of 6 and renders `null` — not merely below
 * the fold, but absent from the DOM.
 *
 * ⚠ THAT RANK IS UI-INVENTED, NOT THE PRODUCER'S. CEE emits this block with
 * NO `priority_rank` field — `buildPreMortemExerciseBlock` builds exactly
 * twelve keys and none is a rank — and appends it LAST in its own phase-3
 * array (`compose.ts`, `[...built, ...lensCompanions]`); the contract
 * reserves the 200+ band for calibration prompts / exercises. The
 * `max(review)+0.5` position is `EXERCISE_RANK_AFTER_REVIEW_CARDS` in
 * `useConversation.ts`, a UI derivation that HOISTS the card above the
 * coaching band. Naming it "the producer's rank" would be the false-label
 * defect (platform traps 12/14). Direction of that correction: it
 * UNDERSTATES the burial — producer-positional order puts the card last,
 * 16 of 16, not 11. The 2.242 premise holds under either number.
 *
 * ## Measured, not assumed — 12 REAL captured analysis payloads
 * Replayed through the shipped parse -> extract -> compose -> pace pipeline
 * at staging tip `db795411` (the measurement is recorded in the PR body).
 * The companion lands at phase-3 position 5, 6, 8, 8, 9, 9, 9, 9, 10, 10, 10,
 * 11 — behind the cap on 10 of the 12.
 *
 * ## Fixture provenance, stated plainly
 * `cee-analysis-turn-probe2154-2026-07-31.json` is a REAL `/proxy/v5/turn`
 * wire body captured on staging 2026-07-31 (probe 2.154, UI `15c48143` /
 * CEE `5fe615b`), byte-identical to
 * `PHASE0-EVIDENCE-2026-07-28/probe-2154-shots/decisive-turn-wire-body.json`
 * (sha256 f1563dde…). Every card, every producer `priority_rank` and the
 * whole enrichment record in it are the producer's. (The companion spliced
 * into it below carries no rank of its own — see the warning above.)
 *
 * ⚠ THE ONE SYNTHETIC ELEMENT, DISCLOSED: no captured payload in the
 * programme's evidence corpus carries a producer-emitted `exercise` block —
 * 0 of 14 captures here, 0/12 on the 2 Aug walk, 0/7 on its predecessor,
 * because the lens race meant `pre_mortem` never won a turn whose pre-mortem
 * review card also survived. The companion card is therefore SPLICED in, and
 * a fixture built to demonstrate a property cannot hunt for its absence. What
 * that splice does NOT invent is the thing being measured: the companion's
 * POSITION is a function of the real cards' real producer ranks and the
 * shipped (UI) derivation rule, not of the spliced block. The splice supplies
 * the card's existence; the real capture supplies everything that buries it.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parseV5Response } from '../../../v5/responseParser'
import { extractPhase3FromV5Response } from '../../../v5/extractPhase3FromV5Response'
import { composePhase3BridgedBlocks } from '../useConversation'
import { mapV5Blocks } from '../../../v5/blocks/mapV5Blocks'
import {
  computePhase3Pacing,
  isPhase3CardBlock,
  isLensCompanionBlock,
  PHASE3_DEFAULT_EXPANDED,
  RESERVED_COMPANION_SLOTS,
} from '../phase3Pacing'
import type { ConversationBlock } from '../types'
import {
  coaching,
  companionExercise,
  enumerateCompanionAbsentShapes,
  evidence,
  factBlock,
  reviewCard,
} from './fixtures/phase3PacingShapes'

const FIXTURES = resolve(__dirname, '../../../v5/__tests__/fixtures')
const REAL_CAPTURE = 'cee-analysis-turn-probe2154-2026-07-31.json'
const REPO_LIVE_FIXTURE = 'cee-response-b82c89dd-trimmed.json'

interface Baseline {
  _cap_at_recording: number
  realCaptures: Record<string, PacingRecord & { blockTypes: string[] }>
  shapes: Record<string, PacingRecord>
}
interface PacingRecord {
  pacingActive: boolean
  phase3Count: number
  collapsedCount: number
  collapsedIndices: number[]
  affordanceIndex: number
  biasSignalExemptIndices: number[]
}

const BASELINE = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/phase3Pacing.pre-2242-baseline.json'), 'utf8'),
) as Baseline

function readCapture(name: string): { blocks: Array<Record<string, unknown>> } {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf8')) as {
    blocks: Array<Record<string, unknown>>
  }
}

/** The producer's own exercise block, verbatim from the repo's schema-validated fixture. */
const PRODUCER_EXERCISE = (
  JSON.parse(
    readFileSync(resolve(FIXTURES, 'phase3-evidence-exercise.bundle-shaped.json'), 'utf8'),
  ) as { blocks: Array<Record<string, unknown>> }
).blocks.find((b) => b.type === 'exercise' && b.exercise_kind === 'pre_mortem')!

async function runPipeline(body: unknown): Promise<ConversationBlock[]> {
  const parsed = await parseV5Response(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  if (parsed.kind !== 'response') throw new Error(`parse failed: ${parsed.kind}`)
  const phase3 = extractPhase3FromV5Response(parsed.response)
  const mapped = mapV5Blocks(parsed.response.blocks, parsed.response.suggested_actions)
  return composePhase3BridgedBlocks(true, phase3.rawBlocks, mapped)
}

function toRecord(blocks: readonly ConversationBlock[]): PacingRecord {
  const p = computePhase3Pacing(blocks)
  return {
    pacingActive: p.pacingActive,
    phase3Count: p.phase3Count,
    collapsedCount: p.collapsedCount,
    collapsedIndices: [...p.collapsedIndices],
    affordanceIndex: p.affordanceIndex,
    biasSignalExemptIndices: [...p.biasSignalExemptIndices],
  }
}

/** 1-based position of a block among the turn's paced phase-3 cards. */
function phase3Position(blocks: readonly ConversationBlock[], blockIndex: number): number {
  const exempt = computePhase3Pacing(blocks).biasSignalExemptIndices
  let pos = 0
  for (let i = 0; i < blocks.length; i++) {
    if (!isPhase3CardBlock(blocks[i]) || exempt.has(i)) continue
    pos++
    if (i === blockIndex) return pos
  }
  return -1
}

function companionIndex(blocks: readonly ConversationBlock[]): number {
  return blocks.findIndex((b) => isLensCompanionBlock(b))
}

// ─────────────────────────────────────────────────────────────────────────
// A. The defect, on a real captured payload
// ─────────────────────────────────────────────────────────────────────────

describe('2.242 — the real capture buries the lens companion card', () => {
  it('CONTROL: the capture is real and paced — 15 phase-3 cards, 9 collapsed, no companion of its own', async () => {
    // Trap 13: before asserting a card is buried, prove the harness sees the
    // turn at all, and prove the fixture has not silently lost its cards.
    const blocks = await runPipeline(readCapture(REAL_CAPTURE))
    const pacing = computePhase3Pacing(blocks)
    expect(pacing.phase3Count).toBe(15)
    expect(pacing.pacingActive).toBe(true)
    expect(pacing.collapsedCount).toBe(9)
    expect(blocks.some(isLensCompanionBlock)).toBe(false)
  })

  it('RED-FIRST: with the lens companion emitted, the composed order puts it at phase-3 position 11 — past the cap of 6', async () => {
    const body = readCapture(REAL_CAPTURE)
    const blocks = await runPipeline({ ...body, blocks: [...body.blocks, PRODUCER_EXERCISE] })
    const ci = companionIndex(blocks)
    expect(ci).toBeGreaterThan(-1)
    // The position is not chosen by this test: it is where the shipped rank
    // derivation lands the card over the capture's real producer ranks. (The
    // derivation itself is the UI's — see the header. Under CEE's own
    // append-last order the card would be 16 of 16.)
    expect(phase3Position(blocks, ci)).toBe(11)
    expect(phase3Position(blocks, ci)).toBeGreaterThan(PHASE3_DEFAULT_EXPANDED)
    // …and the fix is what keeps it out of the collapsed set.
    expect(computePhase3Pacing(blocks).collapsedIndices.has(ci)).toBe(false)
  })

  it('RED-FIRST: the same is true of the repo live fixture, at position 5 (already visible — the guarantee must not disturb it)', async () => {
    const body = readCapture(REPO_LIVE_FIXTURE)
    const blocks = await runPipeline({ ...body, blocks: [...body.blocks, PRODUCER_EXERCISE] })
    const ci = companionIndex(blocks)
    expect(phase3Position(blocks, ci)).toBe(5)
    const pacing = computePhase3Pacing(blocks)
    expect(pacing.collapsedIndices.has(ci)).toBe(false)
    // A companion already inside the default set takes NO slot: the 6th card
    // stays expanded, so collapsed is still exactly count - cap.
    expect(pacing.collapsedCount).toBe(pacing.phase3Count - PHASE3_DEFAULT_EXPANDED)
    expect(pacing.affordanceIndex).toBe(
      [...pacing.collapsedIndices].sort((a, b) => a - b)[0],
    )
  })

  it('the guarantee costs exactly one slot: the displaced card is the LAST that would have been expanded, and the total stays at the cap', async () => {
    const body = readCapture(REAL_CAPTURE)
    const withCompanion = await runPipeline({
      ...body,
      blocks: [...body.blocks, PRODUCER_EXERCISE],
    })
    const pacing = computePhase3Pacing(withCompanion)
    const expandedPhase3 = withCompanion.filter(
      (b, i) =>
        isPhase3CardBlock(b) &&
        !pacing.biasSignalExemptIndices.has(i) &&
        !pacing.collapsedIndices.has(i),
    )
    expect(expandedPhase3).toHaveLength(PHASE3_DEFAULT_EXPANDED)
    expect(expandedPhase3.filter(isLensCompanionBlock)).toHaveLength(RESERVED_COMPANION_SLOTS)
    // Composed order is untouched — the companion is still exactly where
    // composition put it (position 11), it is merely not collapsed.
    expect(phase3Position(withCompanion, companionIndex(withCompanion))).toBe(11)
    // The card that lost its slot is the 6th, so the affordance moves from
    // the 7th card to the 6th and reading order on reveal is still exact.
    const collapsedAsc = [...pacing.collapsedIndices].sort((a, b) => a - b)
    expect(pacing.affordanceIndex).toBe(collapsedAsc[0])
    expect(phase3Position(withCompanion, pacing.affordanceIndex)).toBe(
      PHASE3_DEFAULT_EXPANDED,
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────
// B. No companion emitted ⇒ byte-identical to pre-2.242
// ─────────────────────────────────────────────────────────────────────────

describe('2.242 — companion absent ⇒ byte-identical to the frozen pre-change recording', () => {
  it('the baseline was recorded at the same cap it is being compared under', () => {
    // Guards the comparison itself: if the cap ever moves, every "identical"
    // below would be comparing against a recording of a different rule.
    expect(BASELINE._cap_at_recording).toBe(PHASE3_DEFAULT_EXPANDED)
  })

  it('468 enumerated companion-absent shapes reproduce the pre-2.242 output exactly', () => {
    const shapes = enumerateCompanionAbsentShapes()
    expect(shapes).toHaveLength(468)
    expect(Object.keys(BASELINE.shapes)).toHaveLength(468)
    for (const s of shapes) {
      expect(s.blocks.some(isLensCompanionBlock)).toBe(false)
      expect({ id: s.id, ...toRecord(s.blocks) }).toEqual({ id: s.id, ...BASELINE.shapes[s.id] })
    }
  })

  it('both real captures, as captured, reproduce the pre-2.242 output exactly', async () => {
    for (const name of [REAL_CAPTURE, REPO_LIVE_FIXTURE]) {
      const blocks = await runPipeline(readCapture(name))
      expect(blocks.some(isLensCompanionBlock)).toBe(false)
      const { blockTypes, ...recorded } = BASELINE.realCaptures[name]
      expect({ name, ...toRecord(blocks) }).toEqual({ name, ...recorded })
      // The composed block sequence itself is part of "byte-identical":
      // a change that reordered producer content would pass the pacing
      // comparison alone.
      expect(blocks.map((b) => b.type)).toEqual(blockTypes)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────
// C. The rule at its boundaries (unit level, over the pure function)
// ─────────────────────────────────────────────────────────────────────────

describe('2.242 — the reservation rule at its boundaries', () => {
  const six = () => [
    evidence(1), evidence(2), reviewCard(1), reviewCard(2), reviewCard(3), coaching(1),
  ]

  it('no pacing (<= cap phase-3 cards): a companion changes nothing — everything is expanded already', () => {
    const blocks: ConversationBlock[] = [...six().slice(0, 5), companionExercise()]
    const p = computePhase3Pacing(blocks)
    expect(p.phase3Count).toBe(6)
    expect(p.pacingActive).toBe(false)
    expect(p.collapsedIndices.size).toBe(0)
    expect(p.affordanceIndex).toBe(-1)
  })

  it('BOUNDARY: 7 cards where the 7th is the companion — it is expanded and the 6th collapses ("Show 1 more" is still 1)', () => {
    const blocks: ConversationBlock[] = [...six(), companionExercise()]
    const p = computePhase3Pacing(blocks)
    expect(p.pacingActive).toBe(true)
    expect(p.collapsedCount).toBe(1)
    expect(p.collapsedIndices.has(6)).toBe(false) // the companion
    expect(p.collapsedIndices.has(5)).toBe(true) // the displaced 6th card
    expect(p.affordanceIndex).toBe(5)
  })

  it('the companion is promoted from ANY overflow depth, not only the last position', () => {
    const blocks: ConversationBlock[] = [
      ...six(), coaching(2), companionExercise(), coaching(3), coaching(4),
    ]
    const p = computePhase3Pacing(blocks)
    expect(p.phase3Count).toBe(10)
    expect(p.collapsedCount).toBe(4)
    expect(p.collapsedIndices.has(7)).toBe(false) // companion at block index 7
    expect(p.collapsedIndices.has(5)).toBe(true) // displaced last-expanded card
  })

  it('CAP HOLDS under two companions: only RESERVED_COMPANION_SLOTS is promoted, never a seventh card', () => {
    // CEE emits at most one (buildLensCompanionBlocks). This pins what
    // happens if that ever stops being true: the cap wins.
    const blocks: ConversationBlock[] = [
      ...six(), coaching(2), companionExercise(1), coaching(3), companionExercise(2),
    ]
    const p = computePhase3Pacing(blocks)
    const expandedCount = blocks.filter(
      (b, i) => isPhase3CardBlock(b) && !p.biasSignalExemptIndices.has(i) && !p.collapsedIndices.has(i),
    ).length
    expect(expandedCount).toBe(PHASE3_DEFAULT_EXPANDED)
    expect(p.collapsedIndices.has(7)).toBe(false) // first companion promoted
    expect(p.collapsedIndices.has(9)).toBe(true) // second stays collapsed
  })

  it('bias-signal exemption is untouched: exempt cards are still outside both budgets', () => {
    const bias = { ...coaching(9), block_id: 'bias_1', coaching_kind: 'bias_signal' as const }
    const blocks: ConversationBlock[] = [bias, ...six(), coaching(2), companionExercise()]
    const p = computePhase3Pacing(blocks)
    expect([...p.biasSignalExemptIndices]).toEqual([0])
    expect(p.phase3Count).toBe(8) // 6 + coaching + companion; the bias card is exempt
    expect(p.collapsedIndices.has(0)).toBe(false)
    expect(p.collapsedIndices.has(8)).toBe(false) // the companion
  })

  it('INVARIANT: the default-expanded count is exactly the cap on every paced shape, companion or not', () => {
    const withCompanion = enumerateCompanionAbsentShapes().map((s) => ({
      id: `${s.id}+companion`,
      blocks: [...s.blocks, companionExercise()],
    }))
    for (const s of [...enumerateCompanionAbsentShapes(), ...withCompanion]) {
      const p = computePhase3Pacing(s.blocks)
      const expanded = s.blocks.filter(
        (b, i) =>
          isPhase3CardBlock(b) && !p.biasSignalExemptIndices.has(i) && !p.collapsedIndices.has(i),
      ).length
      if (p.pacingActive) {
        expect(expanded, s.id).toBe(PHASE3_DEFAULT_EXPANDED)
        expect(p.collapsedCount, s.id).toBe(p.phase3Count - PHASE3_DEFAULT_EXPANDED)
        expect(p.affordanceIndex, s.id).toBe([...p.collapsedIndices].sort((a, b) => a - b)[0])
      } else {
        expect(expanded, s.id).toBe(p.phase3Count)
        expect(p.collapsedCount, s.id).toBe(0)
      }
    }
  })

  it('EVERY paced shape carrying a companion renders it by default (6-in-6, the ruling)', () => {
    let paced = 0
    for (const s of enumerateCompanionAbsentShapes()) {
      const blocks = [...s.blocks, companionExercise()]
      const p = computePhase3Pacing(blocks)
      if (!p.pacingActive) continue
      paced++
      const ci = blocks.findIndex(isLensCompanionBlock)
      expect(p.collapsedIndices.has(ci), s.id).toBe(false)
    }
    // Positive control for the assertion above: it must have had paced turns
    // to look at (an absence over an empty set proves nothing). 261 is the
    // exact count derived from the grid — shapes whose phase-3 group exceeds
    // the cap once the companion is added (n >= 6 at bias <= 2, n >= 5 at
    // bias = 3, where the third bias card is no longer exempt).
    expect(paced).toBe(261)
  })

  it('non-phase-3 blocks never consume or receive the reservation', () => {
    const blocks: ConversationBlock[] = [factBlock(1), factBlock(2), ...six(), coaching(2), companionExercise()]
    const p = computePhase3Pacing(blocks)
    expect(p.phase3Count).toBe(8)
    // Fact blocks sit at 0,1 and are governed by the legacy budget only.
    expect(p.collapsedIndices.has(0)).toBe(false)
    expect(p.collapsedIndices.has(1)).toBe(false)
  })
})
