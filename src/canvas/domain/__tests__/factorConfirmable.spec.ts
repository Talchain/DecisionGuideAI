/**
 * ⭐⭐ ONE PREDICATE FOR "N TO VERIFY" — and it is the WRITE AUTHORITY'S, not a
 * display predicate that happens to agree.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE EXISTS TO CATCH
 * ─────────────────────────────────────────────────────────────────────────────
 * Five surfaces render "N to verify" (`StatusBar`, `WorkspaceShellTabStrip`,
 * `ModelHealthSection`, `FactorsSection`'s accordion label, and v2's attention
 * chip) and two offer the Confirm affordance (`FactorCard`, `ModelRowView`).
 * They were answering ONE question with FOUR predicates, which diverged on two
 * REACHABLE factor shapes IN OPPOSITE DIRECTIONS:
 *
 *   · the bare `factorNeedsVerification` OVER-counts a factor with no value at
 *     all — an enabled Confirm the authority silently declines;
 *   · any `raw_value`-based guard (`getPrimaryValue`, `row.primaryValue`)
 *     UNDER-counts a capped factor carrying only `observedState.value`, which is
 *     a staging-witnessed wire shape (`conversation/factorValueEdit.ts:145`).
 *
 * ⚠⚠ A CORPUS POINTED AT ONE DIRECTION CANNOT SEE BOTH (trap 22b). The fix that
 * closed the over-count opened the under-count, and every suite stayed green.
 * So every case below is written as an OPPOSITE-DIRECTION PAIR: `FAC_NO_VALUE`
 * (only the bare form counts it) against `FAC_MODEL_SCALE` (only the
 * `raw_value` forms miss it), with `FAC_BOTH` as the agreement control that
 * stops a predicate returning `false` for everything from passing.
 *
 * ⚠ THE ORACLE IS THE PRODUCER, NOT THIS FILE'S OPINION (trap 13c). The
 * authority pin below does not restate the refusal condition — it DRIVES
 * `proposeFactorConfirmation` over the same corpus and asserts the predicate
 * partitions it exactly as the writer does. A mutant kit can only prove a test
 * DETECTS a change; this is what makes the EXPECTATION right, and it goes red
 * if the authority's condition ever moves out from under the surfaces.
 *
 * Every assertion binds by IDENTITY (factor id), never by a value predicate
 * another factor could satisfy (trap 19).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Node } from '@xyflow/react'
// ⚠ COMMENTS STRIPPED BEFORE EVERY SCAN BELOW. This file's own prose QUOTES the
// competitor expressions it forbids, so a raw read matches itself and the guard
// fails for a reason that has nothing to do with the code (measured, 19 Aug).
// `stripComments`, not `blankNonCode` — the sibling scan records why.
import { stripComments } from '../../../../tests/helpers/stripSourceComments'

vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => undefined }
})

import {
  factorHasConfirmableValue,
  factorIsConfirmable,
  factorNeedsVerification,
} from '../valueProvenance'
import { countFactorsToVerify } from '../../components/model-tab/utils'
import { toModelRows, toRepairQueueItems } from '../../model-tab-v2/adapters'
import { useModelEditAuthority } from '../../hooks/useModelEditAuthority'
import { useCanvasStore } from '../../store'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', '..', '..')

// ── The corpus, by identity ─────────────────────────────────────────────────

/** Agreement control: every predicate ever used here counts this one. */
const FAC_BOTH = 'fac_both_scales'
/** ⚠ DIRECTION 1 — only the BARE predicate counts it. Nothing to ratify. */
const FAC_NO_VALUE = 'fac_no_value_at_all'
/** ⚠ DIRECTION 2 — only the `raw_value` guards MISS it. Wire-real. */
const FAC_MODEL_SCALE = 'fac_model_scale_only'
/** Already ratified — no predicate may count it. */
const FAC_CONFIRMED = 'fac_already_confirmed'
/** The WIRE spelling of an unratified estimate. Reading camelCase under-counts. */
const FAC_SNAKE = 'fac_snake_case_wire'
/** A value that is present but NOT a finite number — the authority refuses it. */
const FAC_NAN = 'fac_non_finite'

function factor(id: string, observedState: unknown, snake = false): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: `Label for ${id}`,
      type: 'factor',
      ...(snake ? { observed_state: observedState } : { observedState }),
    },
  } as Node
}

const CORPUS: Node[] = [
  factor(FAC_BOTH, { value: 0.5, raw_value: 15000, unit: '£', cap: 30000, source: 'cee_inference' }),
  factor(FAC_NO_VALUE, { source: 'cee_inference' }),
  factor(FAC_MODEL_SCALE, { value: 0.7, source: 'cee_inference' }),
  factor(FAC_CONFIRMED, { value: 0.5, raw_value: 15000, source: 'user_confirmed' }),
  factor(FAC_SNAKE, { value: 0.25, raw_value: 4, source: 'cee_inference' }, true),
  factor(FAC_NAN, { value: Number.NaN, raw_value: 9, source: 'cee_inference' }),
]

/** The answer, stated once, by identity. Every surface below must reproduce it. */
const CONFIRMABLE = [FAC_BOTH, FAC_MODEL_SCALE, FAC_SNAKE]

const ids = (ns: ReadonlyArray<{ id: string }>) => ns.map(n => n.id)

const projection = () => ({
  nodes: CORPUS,
  edges: [],
  goalThreshold: null,
  robustness: null,
})

// ─────────────────────────────────────────────────────────────────────────────

describe('⭐⭐ factorIsConfirmable — the canonical "to verify" predicate', () => {
  it('partitions the corpus by IDENTITY, in both directions at once', () => {
    expect(ids(CORPUS.filter(n => factorIsConfirmable(n.data)))).toEqual(CONFIRMABLE)
  })

  it('⚠ DIRECTION 1 — it is NARROWER than the bare predicate (the over-count)', () => {
    // The bare form counts a factor with nothing to ratify. Named, not implied:
    // if this ever stops differing, the narrowing has been reverted.
    expect(factorNeedsVerification(CORPUS.find(n => n.id === FAC_NO_VALUE)!.data)).toBe(true)
    expect(factorIsConfirmable(CORPUS.find(n => n.id === FAC_NO_VALUE)!.data)).toBe(false)
    expect(ids(CORPUS.filter(n => factorNeedsVerification(n.data)))).toContain(FAC_NO_VALUE)
    expect(CONFIRMABLE).not.toContain(FAC_NO_VALUE)
  })

  it('⚠ DIRECTION 2 — it is WIDER than any `raw_value` guard (the under-count)', () => {
    const modelScale = CORPUS.find(n => n.id === FAC_MODEL_SCALE)!
    const obs = (modelScale.data as Record<string, unknown>).observedState as Record<string, unknown>
    // The shape that makes this reachable, asserted rather than assumed: a
    // capped factor off the wire carries `value` and no `raw_value`.
    expect(obs.raw_value).toBeUndefined()
    expect(obs.value).toBe(0.7)
    // A `raw_value` guard would drop it. The canonical predicate keeps it.
    expect(factorIsConfirmable(modelScale.data)).toBe(true)
    expect(CONFIRMABLE).toContain(FAC_MODEL_SCALE)
  })

  it('a non-finite value is not a value (the authority refuses it too)', () => {
    expect(factorHasConfirmableValue(CORPUS.find(n => n.id === FAC_NAN)!.data)).toBe(false)
    expect(CONFIRMABLE).not.toContain(FAC_NAN)
  })

  it('reads BOTH spellings — the wire uses snake_case', () => {
    expect(CONFIRMABLE).toContain(FAC_SNAKE)
    expect(factorIsConfirmable(CORPUS.find(n => n.id === FAC_SNAKE)!.data)).toBe(true)
  })

  it('the partition is non-trivial in both directions (positive control)', () => {
    // Without this, a predicate returning `false` for everything — or `true` for
    // everything — could satisfy an equality above (trap 13).
    expect(CONFIRMABLE.length).toBeGreaterThan(0)
    expect(CONFIRMABLE.length).toBeLessThan(CORPUS.length)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('⭐⭐ THE ORACLE — the predicate IS the write authority, driven', () => {
  beforeEach(() => {
    useCanvasStore.setState({ nodes: CORPUS as never, edges: [] as never }, false)
  })

  /**
   * ⚠⚠ THE AUTHORITY AND THE OFFER ARE TWO QUESTIONS, AND THIS TEST'S FIRST
   * VERSION CONFLATED THEM — refuted by driving the producer (trap 13c, on the
   * author). It asserted the authority honours exactly `factorIsConfirmable`.
   * It does not: `proposeFactorConfirmation` HONOURED an already-`user_confirmed`
   * factor, because it asks *"can I record this?"* and never *"does this need
   * recording?"*. Two questions under similar names (trap 21), so they get two
   * assertions rather than one averaged expectation:
   *
   *   · the authority honours exactly `factorHasConfirmableValue`;
   *   · `factorIsConfirmable` is a SUBSET of that — which is the property the
   *     surfaces need, i.e. nothing is ever OFFERED that the writer declines.
   */
  const drive = (id: string) =>
    renderHook(() => useModelEditAuthority(id)).result.current.proposeFactorConfirmation()

  it('the authority HONOURS exactly `factorHasConfirmableValue` — its own condition', () => {
    const honoured: string[] = []
    for (const n of CORPUS) {
      const outcome = drive(n.id)
      if (outcome === 'committed') honoured.push(n.id)
      expect(`${n.id}: ${outcome}`).toBe(
        `${n.id}: ${factorHasConfirmableValue(n.data) ? 'committed' : 'not_encodable'}`,
      )
    }
    // Stated as a set too, so a loop that silently ran zero times cannot pass
    // (trap 20 — a probe returning the same answer for every item).
    expect(honoured).toEqual([FAC_BOTH, FAC_MODEL_SCALE, FAC_CONFIRMED, FAC_SNAKE])
  })

  it('⭐ NOTHING IS OFFERED THAT THE WRITER DECLINES — the property the chips need', () => {
    for (const n of CORPUS) {
      if (!factorIsConfirmable(n.data)) continue
      // Bound by identity, and asserted per factor so a failure names the row.
      expect(`${n.id}: ${drive(n.id)}`).toBe(`${n.id}: committed`)
    }
    // The offered set is a STRICT subset — an equality here would re-introduce
    // the conflation this pair exists to keep apart.
    const honoured = CORPUS.filter(n => factorHasConfirmableValue(n.data)).map(n => n.id)
    expect(honoured.length).toBeGreaterThan(CONFIRMABLE.length)
    for (const id of CONFIRMABLE) expect(honoured).toContain(id)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('⭐⭐ THE TWO COUNTERS AGREE — one derivation, not two that match today', () => {
  it('v1 count === v2 queue length === the confirmable set, by identity', () => {
    const v1Count = countFactorsToVerify(CORPUS)
    const v2Queue = toRepairQueueItems(projection(), 'confirm-estimates')

    // The NUMBERS, which is what the user reads on two chips saying "N to verify".
    expect(`v1=${v1Count} v2=${v2Queue.length}`).toBe(
      `v1=${CONFIRMABLE.length} v2=${CONFIRMABLE.length}`,
    )
    // And the IDENTITIES, because two wrong counts can agree (trap 19).
    expect(v2Queue.map(i => i.rowId)).toEqual(CONFIRMABLE)
  })

  it('⚠ the OLD bare predicate would have made them disagree — pinned, not assumed', () => {
    // The concrete divergence the adversarial review named: a graph with a
    // factor needing verification but no value set. If this ever stops being a
    // real gap, the corpus has lost the case that makes the convergence mean
    // something.
    const bare = CORPUS.filter(n => factorNeedsVerification(n.data)).length
    expect(bare).toBeGreaterThan(CONFIRMABLE.length)
    expect(countFactorsToVerify(CORPUS)).not.toBe(bare)
  })

  it("⚠ and #782's `raw_value` conjunct would have made them disagree the OTHER way", () => {
    // `getPrimaryValue` reads `raw_value` only, so this is the exact set the
    // superseded queue filter produced. It is SHORT by a real, confirmable
    // factor — the direction a one-sided corpus cannot see.
    const viaRawValue = CORPUS.filter(n => {
      const d = n.data as Record<string, unknown>
      const obs = (d.observedState ?? d.observed_state) as Record<string, unknown> | undefined
      return factorNeedsVerification(n.data) && obs?.raw_value !== undefined
    })
    expect(ids(viaRawValue)).not.toEqual(CONFIRMABLE)
    expect(ids(viaRawValue)).not.toContain(FAC_MODEL_SCALE)
    expect(CONFIRMABLE).toContain(FAC_MODEL_SCALE)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe("⭐ the outline's row marker is the same predicate, so the chip cannot disagree", () => {
  it('`unconfirmed-estimate` marks exactly the confirmable rows, by id', () => {
    const rows = toModelRows(projection())
    const marked = rows.filter(r => r.attention.includes('unconfirmed-estimate')).map(r => r.id)
    expect(marked).toEqual(CONFIRMABLE)
  })

  it('⚠ `no-value` is a DIFFERENT question and keeps its own predicate (trap 21)', () => {
    // Display vs write. `FAC_MODEL_SCALE` has a confirmable value and NO
    // displayable one, so it legitimately carries both reasons. Pinned so a
    // later tidy-up cannot "reconcile" two questions into one.
    const rows = toModelRows(projection())
    const modelScale = rows.find(r => r.id === FAC_MODEL_SCALE)!
    expect(modelScale.attention).toContain('unconfirmed-estimate')
    expect(modelScale.attention).toContain('no-value')

    const noValue = rows.find(r => r.id === FAC_NO_VALUE)!
    expect(noValue.attention).toContain('no-value')
    expect(noValue.attention).not.toContain('unconfirmed-estimate')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ ONE definition, and no surface re-expresses the conjunction', () => {
  const read = (rel: string) => stripComments(readFileSync(join(SRC, rel), 'utf8'), rel)
  /** Unstripped, for the control that proves the stripper is not blanking everything. */
  const readRaw = (rel: string) => readFileSync(join(SRC, rel), 'utf8')

  it('the predicate is DEFINED exactly once in the tree', () => {
    const DEFINITION = /export function factorIsConfirmable\s*\(/
    const VALUE_GUARD = /export function factorHasConfirmableValue\s*\(/
    const domain = read('canvas/domain/valueProvenance.ts')

    // POSITIVE CONTROL: the matcher can see a definition when one is present,
    // otherwise every "absent here" below is reported by a blind regex.
    expect(DEFINITION.test(domain)).toBe(true)
    expect(VALUE_GUARD.test(domain)).toBe(true)

    for (const rel of [
      'canvas/model-tab-v2/adapters.ts',
      'canvas/model-tab-v2/ModelRowView.tsx',
      'canvas/components/model-tab/utils.ts',
      'canvas/components/model-tab/FactorsSection.tsx',
      'canvas/hooks/useModelEditAuthority.ts',
    ]) {
      const src = read(rel)
      expect(`${rel}: ${DEFINITION.test(src)}`).toBe(`${rel}: false`)
      expect(`${rel}: ${VALUE_GUARD.test(src)}`).toBe(`${rel}: false`)
      // A re-export keeps the name reachable from several places with one owner
      // — the shim this convergence exists to refuse.
      expect(`${rel}: ${/export\s*\{[^}]*factorIsConfirmable/.test(src)}`).toBe(`${rel}: false`)
    }
  })

  it('⚠ the CONSUMERS hold no local value guard beside the predicate', () => {
    /*
     * Each row: the file, the COMPETITOR shape that must be gone, and the
     * CONTRAST that must be present in the same file — the consumption that
     * replaced it. A per-file contrast, not one shared pattern: `ModelRowView`
     * consumes the predicate INDIRECTLY, through the `unconfirmed-estimate`
     * attention reason, and asserting it names `factorIsConfirmable` would be
     * asserting the wrong thing (it would pass only on a comment).
     */
    const COMPETITORS: ReadonlyArray<readonly [string, RegExp, RegExp]> = [
      [
        'canvas/model-tab-v2/adapters.ts',
        /factorValue\(n\.data\)\s*!==\s*null/,
        /factorIsConfirmable\(/,
      ],
      [
        'canvas/model-tab-v2/ModelRowView.tsx',
        /row\.primaryValue\s*!==\s*null/,
        /attention\.includes\('unconfirmed-estimate'\)/,
      ],
      [
        'canvas/components/model-tab/utils.ts',
        /filter\(n => factorNeedsVerification\(n\.data\)\)/,
        /factorIsConfirmable\(/,
      ],
      [
        'canvas/components/model-tab/FactorsSection.tsx',
        /primaryValue\s*!==\s*null\s*\|\|\s*normalisedValue\s*!==\s*null/,
        /factorIsConfirmable\(/,
      ],
    ]

    for (const [rel, competitor, contrast] of COMPETITORS) {
      const code = read(rel)
      // The competitor is gone …
      expect(`${rel} competitor: ${competitor.test(code)}`).toBe(`${rel} competitor: false`)
      // … and the replacement is there, in the SAME sweep, through the SAME
      // stripper. An absence is only evidence when a contrast reads non-zero
      // beside it (trap 13e) — and a stripper that blanked the file would make
      // every `false` above vacuous.
      expect(`${rel} contrast: ${contrast.test(code)}`).toBe(`${rel} contrast: true`)
      expect(`${rel} non-empty: ${code.trim().length > 0}`).toBe(`${rel} non-empty: true`)
    }

    // ⚠ AND THE STRIPPER IS LOAD-BEARING, PINNED. The competitor shapes are
    // still QUOTED in this repo's prose (including in this file), so an
    // UNSTRIPPED read finds them. If a later tidy-up drops `stripComments`, this
    // goes red rather than the guard reporting a defect that is only a comment.
    expect(/row\.primaryValue\s*!==\s*null/.test(readRaw('canvas/model-tab-v2/ModelRowView.tsx'))).toBe(
      true,
    )
  })
})
