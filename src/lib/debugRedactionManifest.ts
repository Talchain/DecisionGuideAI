/**
 * Debug redaction manifest — surfaces which paths in the bundle were
 * redacted or omitted, and which paths the analytical-preservation
 * policy declares as kept-verbatim.
 *
 * The brief requires path-aware semantics rather than a generic
 * key-name allowlist. The existing `redactPayload` already uses
 * key-scoped allowlists (`neverRedactKeys: ['observed_state',
 * 'constraint_analysis', 'goal_constraints']`) and does NOT globally
 * allowlist generic scalars like `value` / `mean` / `std`. This module
 * makes that policy *visible* and *auditable* in every export.
 *
 * Pure module. Reads the assembled bundle post-redaction and produces a
 * summary section — does not modify or re-walk the payloads.
 */

/**
 * Declarative policy: paths under which analytical numeric fields are
 * preserved by the existing redactor. Used in the manifest to document
 * what the policy claims; tests check that the listed paths exist in
 * the bundle when their parents are present.
 */
export const PRESERVED_ANALYTICAL_PATHS: readonly string[] = [
  'payloads.plot_request.graph.nodes[*].data.observed_state.*',
  'payloads.plot_request.graph.edges[*].data.strength',
  'payloads.plot_request.graph.edges[*].data.exists_probability',
  'payloads.plot_request.graph.edges[*].data.function_params.*',
  'payloads.plot_request.parameter_uncertainties[*]',
  'payloads.plot_response.option_comparison[*]',
  'payloads.plot_response.factor_sensitivity[*]',
  'payloads.plot_response.m1_coaching.evidence_gaps[*]',
  'payloads.plot_response.flip_thresholds[*]',
  'payloads.plot_response.flip_thresholds_status',
  'payloads.plot_response.factor_sensitivity[*].confidence_provenance',
  'payloads.plot_response.auto_noise_provenance',
  'payloads.plot_response.auto_noise_applied',
  'payloads.plot_response.value_of_information',
  'payloads.plot_response.evpi',
  'payloads.plot_response.evpi_percentage_points',
]

export interface RedactedEntry {
  path: string
  reason: string
}

export interface OmittedEntry {
  path: string
  reason: string
}

export interface DebugRedactionManifest {
  redacted: RedactedEntry[]
  omitted: OmittedEntry[]
  preserved_analytical_paths: string[]
  /**
   * Declared-but-absent paths, each with what it answers and why it is missing.
   * ALWAYS emitted, empty array included — see `collectAbsentExpected`.
   */
  absent_expected: AbsentExpectedEntry[]
}

/**
 * Walk a bundle subtree and collect every redaction marker placed by
 * `redactPayload`. Path uses dot/bracket notation:
 *   payloads.cee_request.headers.authorization
 *   payloads.plot_response.option_comparison[0].interventions
 *
 * Markers detected:
 *   - String value '[REDACTED]'        → reason: 'sensitive_key'
 *   - Object { __redacted: true }      → reason: 'max_depth' | 'unserialisable'
 *   - Object { __truncated: true }     → reason: 'array_capped'
 *   - Object { __sizeLimitExceeded:true} → reason: 'size_limit'
 *   - Object { __circular: true }      → reason: 'circular_reference'
 *   - String containing '[truncated_by: …]' suffix → reason: 'string_truncated'
 */
export function collectRedactedPaths(
  root: unknown,
  rootPath = '',
  out: RedactedEntry[] = [],
  visited: WeakSet<object> = new WeakSet(),
): RedactedEntry[] {
  if (root === null || root === undefined) return out

  // Strings — only check for truncation suffix or '[REDACTED]'.
  if (typeof root === 'string') {
    if (root === '[REDACTED]') {
      out.push({ path: rootPath, reason: 'sensitive_key' })
    } else if (root.includes('[truncated_by:')) {
      out.push({ path: rootPath, reason: 'string_truncated' })
    }
    return out
  }

  if (typeof root !== 'object') return out
  if (visited.has(root as object)) return out
  visited.add(root as object)

  if (Array.isArray(root)) {
    root.forEach((item, idx) => {
      collectRedactedPaths(item, `${rootPath}[${idx}]`, out, visited)
    })
    return out
  }

  // Object markers.
  const obj = root as Record<string, unknown>
  if (obj.__redacted === true) {
    out.push({ path: rootPath, reason: 'max_depth_or_unserialisable' })
    return out
  }
  if (obj.__truncated === true) {
    out.push({ path: rootPath, reason: 'array_capped' })
    // Walk the surviving items so we still catch redactions inside them.
    const items = obj.items
    if (Array.isArray(items)) {
      items.forEach((item, idx) => {
        collectRedactedPaths(item, `${rootPath}[${idx}]`, out, visited)
      })
    }
    return out
  }
  if (obj.__sizeLimitExceeded === true) {
    out.push({ path: rootPath, reason: 'size_limit' })
    return out
  }
  if (obj.__circular === true) {
    out.push({ path: rootPath, reason: 'circular_reference' })
    return out
  }

  // Generic object walk.
  for (const key of Object.keys(obj)) {
    const childPath = rootPath ? `${rootPath}.${key}` : key
    collectRedactedPaths(obj[key], childPath, out, visited)
  }
  return out
}

/**
 * Detect optional bundle sections that ended up unassembled. Each
 * `omitted` entry carries a stable reason code so consumers can tell
 * "v5_canonical_turn_diagnostics not present because assembler bailed"
 * from "v5_canonical_turn_diagnostics not present because canonical
 * flag was off and there was no V5 capture".
 */
export interface OmittedSectionProbe {
  path: string
  present: boolean
  reason_if_omitted: string
}

export function collectOmittedSections(
  probes: ReadonlyArray<OmittedSectionProbe>,
): OmittedEntry[] {
  const out: OmittedEntry[] = []
  for (const p of probes) {
    if (!p.present) {
      out.push({ path: p.path, reason: p.reason_if_omitted })
    }
  }
  return out
}

/**
 * Build the full manifest. Inputs are the already-redacted bundle root
 * plus a list of optional-section probes. The function does no further
 * mutation of the bundle.
 */
// ── CAPTURE COMPLETENESS ────────────────────────────────────────────────────

/**
 * ⭐⭐ WHY THIS EXISTS — A SILENT `null` AND A DELIBERATE OMISSION LOOK IDENTICAL.
 *
 * MEASURED on two real support bundles (18 and 19 Sep 2026), and the counts were
 * the same in both, so this is the steady state rather than one bad export:
 *
 *   the assembled prompt   zone1_prompt_id · zone2_assembly · zone2_assembly_keys
 *                          tool_policy · structured_output_config · streaming_metrics
 *                          -> ALL null or absent
 *   the LLM call           llm_raw · provider_resolution · draft_quality
 *                          pipeline_outcome  -> ALL null or empty
 *   pipeline internals     cee_pipeline_path · cee_strp_mutations_count
 *                          cee_observability -> ALL null
 *   the client             console_logs (stripped at build) · render capture
 *                          (never implemented)
 *
 * Seventeen carriers, every one an indistinguishable `null`. A reader cannot
 * tell "the producer does not populate this" from "this turn legitimately had
 * none" from "this was removed for safety" — so a capability can be dark for
 * months and every bundle looks the same.
 *
 * ⭐ THE ONE GAP THAT WAS FINDABLE PROVES THE POINT. The brief arrived carrying
 * `[truncated_by: bundle_redaction, 1140 chars total]`, so a reader learns
 * immediately that 86 characters of the user's own words are missing and why.
 * **That is the only absence in the bundle that announced itself, and it is the
 * only one that did not need a human to go looking.** This section gives every
 * other absence the same property.
 *
 * ⚠ IT REPORTS, IT NEVER REMOVES. Nothing here changes what the bundle carries.
 * An entry means "declared, and here is why it is not here" — never a decision
 * to leave something out.
 */
export type AbsenceCause =
  /** The producer exists and this turn legitimately had nothing to report. */
  | 'no_value_this_turn'
  /** No producer writes this field yet — the carrier is declared and unfilled. */
  | 'producer_never_populated'
  /** The call sites are removed by the build, so nothing can be captured. */
  | 'stripped_at_build'
  /** No capture producer has been implemented for this surface. */
  | 'not_implemented'
  /** Present upstream, withheld here on purpose. */
  | 'withheld_by_policy'
  /** Declared expectation, and the cause could not be determined. */
  | 'unknown'

export interface ExpectedPath {
  /** Dot/bracket path into the bundle. */
  readonly path: string
  /** What a reader loses when it is absent. Plain language, no jargon. */
  readonly answers: string
  /**
   * The cause, when it is KNOWN from evidence rather than guessed.
   *
   * ⚠ Left `undefined` deliberately where nobody has established it. An
   * `'unknown'` that is honest is worth more than a plausible cause that sends
   * the next reader to the wrong producer — this estate has lost whole
   * afternoons to exactly that.
   */
  readonly known_cause?: AbsenceCause
}

/**
 * What a bundle is EXPECTED to carry, with what each answers.
 *
 * ⚠ A HAND-MAINTAINED LIST, STATED AS SUCH. It is the drift class this estate
 * pays for most, and it is accepted here for one reason: the alternative is
 * deriving expectations from the bundle itself, which cannot see a field no
 * producer ever wrote — the exact defect this section exists to surface. So the
 * list is explicit, every entry says what it answers, and a stale entry shows up
 * as a reported absence rather than as silence.
 */
export const EXPECTED_BUNDLE_PATHS: readonly ExpectedPath[] = [
  {
    path: 'pipeline.zone2_assembly',
    answers: 'which context sections were assembled, and how large each was',
    known_cause: 'producer_never_populated',
  },
  {
    path: 'zone1_prompt_id',
    answers: 'which prompt served the first zone of this turn',
  },
  {
    path: 'zone2_assembly_keys',
    answers: 'the ordered section keys the context pack was built from',
  },
  {
    path: 'tool_policy',
    answers: 'which tools the model was permitted to call on this turn',
  },
  {
    path: 'structured_output_config',
    answers: 'the grammar attached to the call — the schema the model had to satisfy',
  },
  {
    path: 'pipeline.llm_raw',
    answers: "the model's unparsed response, before any adapter touched it",
  },
  {
    path: 'pipeline.cee_pipeline_path',
    answers: 'which pipeline branch this turn took',
  },
  {
    path: 'draft_quality',
    answers: 'the drafter\'s own quality signals for this graph',
  },
  {
    path: 'pipeline_outcome',
    answers: 'how the pipeline finished, and what it repaired on the way',
  },
  {
    path: 'console_logs',
    answers: 'what the client logged while producing this turn',
    known_cause: 'stripped_at_build',
  },
  {
    path: 'render_summary',
    answers: 'what the user actually saw rendered, as opposed to what was sent',
    known_cause: 'not_implemented',
  },
]

export interface AbsentExpectedEntry {
  readonly path: string
  readonly answers: string
  readonly cause: AbsenceCause
}

/** Resolve a dot/bracket path against the bundle. Absent and `null` differ. */
function readPath(root: unknown, path: string): { found: boolean; value: unknown } {
  let cur: unknown = root
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return { found: false, value: undefined }
    const rec = cur as Record<string, unknown>
    if (!(seg in rec)) return { found: false, value: undefined }
    cur = rec[seg]
  }
  return { found: true, value: cur }
}

/**
 * Which expected paths this bundle does not carry, and why.
 *
 * ⚠ AN EMPTY ARRAY IS A REAL RESULT AND MUST NOT BE READ AS "NOT CHECKED".
 * The manifest always emits the key, so absence of entries means every declared
 * path was present — never that the check did not run. That distinction is the
 * whole point of this section and it is why the field is not omitted when empty.
 */
export function collectAbsentExpected(
  bundleRoot: unknown,
  expected: readonly ExpectedPath[] = EXPECTED_BUNDLE_PATHS,
): AbsentExpectedEntry[] {
  const out: AbsentExpectedEntry[] = []
  for (const e of expected) {
    const { found, value } = readPath(bundleRoot, e.path)
    const empty =
      !found ||
      value === null ||
      value === undefined ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === 'object' && value !== null && !Array.isArray(value) &&
        Object.keys(value as object).length === 0)
    if (!empty) continue
    out.push({
      path: e.path,
      answers: e.answers,
      // A declared cause is EVIDENCE someone established; anything else is
      // reported as unknown rather than guessed from the shape of the absence.
      cause: e.known_cause ?? 'unknown',
    })
  }
  return out
}

export function buildDebugRedactionManifest(
  bundleRoot: unknown,
  omittedProbes: ReadonlyArray<OmittedSectionProbe>,
): DebugRedactionManifest {
  // Only scan within payloads.* by default — the rest of the bundle is
  // already diagnostic and unlikely to contain analytical-numeric
  // material. Scanning the whole bundle would surface noise from
  // synthesised diagnostic objects that are designed to look like
  // markers (e.g. counts named __redacted_count). Scoping to payloads
  // keeps the manifest focused.
  const bundle =
    bundleRoot && typeof bundleRoot === 'object' && !Array.isArray(bundleRoot)
      ? (bundleRoot as Record<string, unknown>)
      : null

  const redacted: RedactedEntry[] = []
  if (bundle?.payloads) {
    collectRedactedPaths(bundle.payloads, 'payloads', redacted)
  }
  // Also scan `analysis_evidence_trace.response_body` (workstream:
  // DGAI debug output, 2026-05-23). The body is a raw CEE response
  // recovered from the trace store, which applies the same redactor
  // at record time as the bodies in `bundle.payloads.*`. Scanning it
  // here surfaces concrete redaction markers in the manifest so
  // reviewers can verify the recovered body did not bypass redaction
  // — instead of having to take it on trust. Only the
  // `'recovered_earlier_cee_turn'` case carries a non-null body; the
  // other source states leave `response_body = null`, so this scan is
  // a no-op in those cases.
  const evidenceTrace = bundle?.analysis_evidence_trace
  if (
    evidenceTrace &&
    typeof evidenceTrace === 'object' &&
    !Array.isArray(evidenceTrace)
  ) {
    const evidenceBody = (evidenceTrace as Record<string, unknown>).response_body
    if (
      evidenceBody !== null &&
      evidenceBody !== undefined &&
      typeof evidenceBody === 'object'
    ) {
      collectRedactedPaths(
        evidenceBody,
        'analysis_evidence_trace.response_body',
        redacted,
      )
    }
  }

  return {
    redacted,
    omitted: collectOmittedSections(omittedProbes),
    preserved_analytical_paths: [...PRESERVED_ANALYTICAL_PATHS],
    // ⚠ Scanned against the WHOLE bundle, not `payloads`. The redaction scan is
    // deliberately scoped to `payloads` (see its note above), but every path a
    // reader loses lives OUTSIDE it — `pipeline.*`, `console_logs`,
    // `render_summary`, `draft_quality`. Reusing that scope here would report an
    // empty list for a bundle missing all seventeen, which is the exact silence
    // this section exists to end.
    absent_expected: collectAbsentExpected(bundleRoot),
  }
}
