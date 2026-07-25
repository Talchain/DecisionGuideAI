/**
 * addOptionRequest — the UI PRODUCER seam for the `add_option` intent.
 *
 * WHY THIS EXISTS. Everything downstream of an `add_option` chip has been live
 * and probe-proven on staging for months: CEE's zero-LLM `add_option` transaction
 * (`orchestrator-v5/routing/add-option-transaction.ts`) atomically holds
 * add_node(option) + add_edge(decision→option) + N × add_edge(option→factor),
 * the hold→consent→apply flow works, and the applied receipt carries a
 * `draft_graph` the canvas reconciles. The UI's wire gate is open
 * (`CEE_ACCEPTED_INTENTS = {'add_option'}`) and the parameter builder
 * (`buildAddOptionParameters`) is spec-pinned.
 *
 * The ONLY missing piece was a surface that produces the chip. This module is
 * the pure half of that surface: it decides WHETHER a typed message is an
 * add-option request, and turns a resolved (label, changes) pair into the exact
 * `dispatchAction` argument. No React, no store, no I/O — so every rule here is
 * directly testable and the seam can be exercised end-to-end through the REAL
 * `buildChipMeta` → `buildV5Payload` chain.
 *
 * THREE HARD RULES, each with a mechanism and a test that goes RED without it:
 *
 *  1. **IDS COME FROM THE LIVE CANVAS, NEVER FROM PROSE.** Verified on the wire
 *     2026-07-25: a chip carrying a `parent_decision_id` or `factor_id` that is
 *     not in the persisted graph does NOT fail — CEE silently falls through to
 *     the LLM edit lane (`exit_path: 'edit_graph'`, 18–27s, `llm_calls` non-empty)
 *     and an LLM authors the edit instead. Same 200, same `held_proposal` shape,
 *     so the degradation is INVISIBLE at the boundary. `buildAddOptionDispatch`
 *     therefore REFUSES any id it cannot find on the canvas rather than emit a
 *     chip that will quietly take the slow, non-deterministic path.
 *
 *  2. **DETECTION IS HIGH-PRECISION AND NEVER LOSES THE USER'S TEXT.** A false
 *     positive costs the user a dismissable panel and their message is still
 *     sent verbatim; a false negative costs nothing (the message goes to the
 *     existing free-text lane exactly as today). So the rules are tuned for
 *     precision: an imperative add-verb, a SINGULAR option noun, an extractable
 *     label, and no question mark. Ambiguous deliberation ("should I add an
 *     option?", "add more options") is deliberately NOT matched.
 *
 *  3. **THE PRODUCER NEVER CLAIMS AN OUTCOME.** This module builds a REQUEST.
 *     It has no vocabulary for success — the only truthful receipt is CEE's own
 *     hold/confirm copy, which names every operation. See
 *     `NO_OUTCOME_CLAIM_VOCABULARY` and the test that pins it.
 */

import type { Node } from '@xyflow/react'

import {
  ADD_OPTION_INTENT,
  MAX_ADD_OPTION_INTERVENTIONS,
  buildAddOptionParameters,
  type AddOptionInterventionInput,
  type AddOptionParameters,
  type ChipParametersFailReason,
} from '../../v5/chipParameters'
import { getObservedState, normaliseRawFactorValue } from '../utils/observedStateHelpers'
import { computeGraphFacts } from '../components/pre-analysis-v3/selectors/graphFacts'

// ---------------------------------------------------------------------------
// 1. Natural-language detection
// ---------------------------------------------------------------------------

export interface AddOptionDetection {
  /**
   * The label the user named, verbatim and trimmed. This is a PREFILL, not a
   * commitment — the panel renders it in an editable field, which is why a
   * slightly-off extraction is an ergonomics cost and never a correctness one.
   */
  readonly label: string
}

/**
 * Courtesy / framing prefixes stripped before the imperative test, so
 * "Can you add an option called X" is treated the same as "Add an option
 * called X". Deliberately SMALL: every entry widens the match, and the
 * deliberative openers ("should I", "what if", "do you think", "is it worth")
 * are absent on purpose — those are questions for the coach, not commands.
 */
const COURTESY_PREFIX =
  /^(?:please\s+|can\s+you\s+|could\s+you\s+|i\s+want\s+to\s+|i'?d\s+like\s+to\s+|i\s+would\s+like\s+to\s+|let'?s\s+)+/i

/**
 * The imperative core. `option|alternative|choice` is matched with a trailing
 * `\b` and NO plural alternative, so "add more options" / "add some
 * alternatives" (brainstorm requests, which belong to the coach) do not match
 * while "add an option" does.
 */
const ADD_OPTION_IMPERATIVE =
  /^(?:add|create|include)\s+(?:a|an|another|one|the)?\s*(?:new\s+)?(?:option|alternative|choice)\b/i

/** Straight and curly quotes, double and single. Group 2 is the content. */
const QUOTED_LABEL = /(["'“‘])([^"'“”‘’]{1,120})(["'”’])/

/** `called X` / `named X` / `titled X` — the unquoted naming forms. */
const NAMED_LABEL = /\b(?:called|named|titled)\s+(.{1,120})$/i

/**
 * Trailing relative clauses that describe the option rather than name it.
 * "…called Hybrid that cuts cost" must yield "Hybrid", not the whole tail.
 */
const LABEL_TAIL_CLAUSE = /\s+(?:that|which|where|who|so\s+that|in\s+order)\b.*$/i

function trimLabel(raw: string): string {
  return raw
    .replace(LABEL_TAIL_CLAUSE, '')
    .replace(/[\s.,;:!]+$/u, '')
    .trim()
}

/**
 * Decide whether a composer message is an add-option request, and extract the
 * option's label. Returns `null` for anything that is not an unambiguous
 * request — the caller then sends the message through the existing free-text
 * lane, byte-identical to today.
 *
 * Pure. Never throws.
 */
export function detectAddOptionRequest(text: string): AddOptionDetection | null {
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (trimmed.length === 0) return null

  // A question is deliberation, not an instruction. "Should I add an option
  // called X?" must reach the coach, not open a form.
  if (trimmed.endsWith('?')) return null

  const imperative = trimmed.replace(COURTESY_PREFIX, '')
  if (!ADD_OPTION_IMPERATIVE.test(imperative)) return null

  const quoted = QUOTED_LABEL.exec(imperative)
  if (quoted) {
    const label = trimLabel(quoted[2])
    return label.length > 0 ? { label } : null
  }

  const named = NAMED_LABEL.exec(imperative)
  if (named) {
    const label = trimLabel(named[1])
    return label.length > 0 ? { label } : null
  }

  // An add-option request with no nameable label ("add an option") is a real
  // request but not a resolved one — hand it to the free-text lane rather than
  // open a form with an empty, unexplained field.
  return null
}

// ---------------------------------------------------------------------------
// 2. Canvas resolution
// ---------------------------------------------------------------------------

export interface AddOptionFactorTarget {
  readonly id: string
  readonly label: string
  /**
   * The factor's current value in the SAME terms the panel will ask the user to
   * type — raw units when the factor carries an honest scale (a positive cap),
   * model-space otherwise. `null` when the factor has no value yet.
   */
  readonly currentRaw: number | null
  readonly unit: string | undefined
  /** Positive, finite cap when one exists — the raw→model-space divisor. */
  readonly cap: number | undefined
}

export interface AddOptionCanvasTargets {
  readonly decisionId: string | null
  readonly decisionLabel: string | null
  readonly factors: readonly AddOptionFactorTarget[]
}

function labelOf(node: Node): string {
  const raw = (node.data as Record<string, unknown> | undefined)?.label
  return typeof raw === 'string' && raw.length > 0 ? raw : node.id
}

/**
 * Derive the add-option targets from the live canvas. DERIVED, never mirrored:
 * `computeGraphFacts` is the repo's single kind-resolver (it handles the
 * `data.kind` vs `type` divergence that the ad-hoc `n.type === 'decision'`
 * filters get wrong), so this cannot drift from how the rest of the UI counts
 * decisions and factors.
 */
export function resolveAddOptionTargets(nodes: ReadonlyArray<Node>): AddOptionCanvasTargets {
  const facts = computeGraphFacts(nodes)
  const factors = facts.factorNodes.map((node): AddOptionFactorTarget => {
    const observed = getObservedState(node.data)
    const cap = typeof observed.cap === 'number' && Number.isFinite(observed.cap) && observed.cap > 0
      ? observed.cap
      : undefined
    const rawCandidate = typeof observed.raw_value === 'number' ? observed.raw_value : undefined
    const modelValue = typeof observed.value === 'number' ? observed.value : undefined
    // Present whatever the user would type: the raw figure when we have one,
    // else the raw figure implied by the cap, else the model-space value.
    const currentRaw =
      rawCandidate !== undefined && Number.isFinite(rawCandidate)
        ? rawCandidate
        : cap !== undefined && modelValue !== undefined && Number.isFinite(modelValue)
          ? modelValue * cap
          : modelValue !== undefined && Number.isFinite(modelValue)
            ? modelValue
            : null
    return {
      id: node.id,
      label: labelOf(node),
      currentRaw,
      unit: typeof observed.unit === 'string' && observed.unit.length > 0 ? observed.unit : undefined,
      cap,
    }
  })
  return {
    decisionId: facts.decisionNode?.id ?? null,
    decisionLabel: facts.decisionNode ? labelOf(facts.decisionNode) : null,
    factors,
  }
}

// ---------------------------------------------------------------------------
// 3. Dispatch construction
// ---------------------------------------------------------------------------

/** One factor the user says this option changes, in the units they typed. */
export interface AddOptionChange {
  readonly factorId: string
  /** The number the user typed, in the factor's own displayed units. */
  readonly rawValue: number
}

export type AddOptionRefusal =
  | { readonly kind: 'label_required' }
  | { readonly kind: 'no_decision_node' }
  | { readonly kind: 'unknown_factor'; readonly factorId: string }
  | { readonly kind: 'too_many_changes'; readonly max: number }
  | { readonly kind: 'parameters'; readonly reason: ChipParametersFailReason }

/**
 * The exact `dispatchAction` argument. Structurally a subset of
 * `DispatchActionOpts` so the compiler pins the two together.
 */
export interface AddOptionDispatchRequest {
  readonly id: string
  readonly intent: typeof ADD_OPTION_INTENT
  readonly parameters: AddOptionParameters
  readonly label: string
  readonly message: string
}

export type AddOptionDispatchResult =
  | { readonly ok: true; readonly dispatch: AddOptionDispatchRequest }
  | { readonly ok: false; readonly refusal: AddOptionRefusal }

/** Chip identity for the composer-originated add-option request. */
export const ADD_OPTION_CHIP_ID = 'ui_add_option_form'

function quoteList(labels: readonly string[]): string {
  if (labels.length === 0) return ''
  if (labels.length === 1) return `"${labels[0]}"`
  return `${labels.slice(0, -1).map((l) => `"${l}"`).join(', ')} and "${labels[labels.length - 1]}"`
}

/**
 * Build the add-option chip from a label plus the changes the user configured.
 *
 * REFUSES rather than degrades. In particular every `factorId` must resolve to
 * a node the canvas currently classifies as a factor: an id CEE cannot find is
 * not an error on the wire, it is a silent fall-through to the LLM edit lane
 * (rule 1 in the module docstring), which is precisely the failure this surface
 * exists to avoid.
 */
export function buildAddOptionDispatch(input: {
  readonly label: string
  readonly changes: readonly AddOptionChange[]
  readonly nodes: ReadonlyArray<Node>
}): AddOptionDispatchResult {
  const label = input.label.trim()
  if (label.length === 0) return { ok: false, refusal: { kind: 'label_required' } }

  const targets = resolveAddOptionTargets(input.nodes)
  if (!targets.decisionId) return { ok: false, refusal: { kind: 'no_decision_node' } }

  if (input.changes.length > MAX_ADD_OPTION_INTERVENTIONS) {
    return { ok: false, refusal: { kind: 'too_many_changes', max: MAX_ADD_OPTION_INTERVENTIONS } }
  }

  const byId = new Map(targets.factors.map((f) => [f.id, f]))
  const interventions: AddOptionInterventionInput[] = []
  const changedLabels: string[] = []
  for (const change of input.changes) {
    const target = byId.get(change.factorId)
    if (!target) return { ok: false, refusal: { kind: 'unknown_factor', factorId: change.factorId } }
    const normalised = normaliseRawFactorValue(change.rawValue, target.cap)
    interventions.push({
      factorId: target.id,
      value: normalised,
      // Carry the raw figure and its unit alongside the model-space value, the
      // same pairing every other value-edit path in the UI persists, so the
      // user's real-world number is never lost to the normalisation.
      ...(target.cap !== undefined ? { rawValue: change.rawValue } : {}),
      ...(target.cap !== undefined && target.unit !== undefined ? { unit: target.unit } : {}),
    })
    changedLabels.push(target.label)
  }

  const built = buildAddOptionParameters({
    parentDecisionId: targets.decisionId,
    label,
    interventions,
  })
  if (!built.ok) return { ok: false, refusal: { kind: 'parameters', reason: built.reason } }

  const message =
    changedLabels.length > 0
      ? `Add an option called "${label}" that changes ${quoteList(changedLabels)}.`
      : `Add an option called "${label}".`

  return {
    ok: true,
    dispatch: {
      id: ADD_OPTION_CHIP_ID,
      intent: ADD_OPTION_INTENT,
      parameters: built.parameters,
      label: `Add option "${label}"`,
      message,
    },
  }
}

/**
 * User-facing text for a refusal. Names WHICH part was refused and WHY, in the
 * product's own vocabulary — never a code, never a generic "something went
 * wrong".
 */
export function describeAddOptionRefusal(refusal: AddOptionRefusal): string {
  switch (refusal.kind) {
    case 'label_required':
      return 'Give the option a name first.'
    case 'no_decision_node':
      return 'This model has no decision node yet, so there is nothing to add an option to.'
    case 'unknown_factor':
      return `One of the factors you picked is no longer on the canvas, so it was not included. Close this and try again.`
    case 'too_many_changes':
      return `An option can change at most ${refusal.max} factors in one go. Remove some and add the rest afterwards.`
    case 'parameters':
      return describeParametersRefusal(refusal.reason)
  }
}

function describeParametersRefusal(reason: ChipParametersFailReason): string {
  switch (reason) {
    case 'label_required':
      return 'Give the option a name first.'
    case 'value_not_finite':
    case 'raw_value_not_finite':
      return 'Every factor you tick needs a number.'
    case 'duplicate_factor':
      return 'The same factor is listed twice.'
    case 'too_many_interventions':
      return `An option can change at most ${MAX_ADD_OPTION_INTERVENTIONS} factors in one go.`
    case 'parent_decision_id_required':
      return 'This model has no decision node yet, so there is nothing to add an option to.'
    default:
      // Every remaining reason belongs to a different builder (edge/constraint
      // chips) and is unreachable here; say so honestly rather than invent copy.
      return `This request could not be built (${reason}).`
  }
}

/**
 * Words this surface must never use about a change it has only REQUESTED.
 *
 * The estate has shipped receipts claiming changes that never happened, so the
 * producer is held to a mechanical rule: it proposes, CEE reports. The panel
 * spec asserts none of these appear in any string this surface renders, which
 * is why the list lives here (next to the code it constrains) rather than in
 * the test file.
 */
export const NO_OUTCOME_CLAIM_VOCABULARY: readonly string[] = [
  'added',
  'created',
  'saved',
  'applied',
  'updated',
  'done',
  'success',
]
