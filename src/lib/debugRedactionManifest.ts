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

  return {
    redacted,
    omitted: collectOmittedSections(omittedProbes),
    preserved_analytical_paths: [...PRESERVED_ANALYTICAL_PATHS],
  }
}
