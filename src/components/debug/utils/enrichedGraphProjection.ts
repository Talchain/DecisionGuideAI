/**
 * ENRICHED-GRAPH PROJECTION — the spec table, the resolver, and the manifest.
 *
 * ## Why this module exists
 *
 * `full_graph` in the debug bundle is NOT a dump of the canvas store. It is a
 * **projection**: a fixed set of output keys, several of them RE-KEYED from a
 * differently-spelled input, and everything not named is dropped. Until this
 * module the projection was an object literal, so the bundle was *silently*
 * lossy — and a sweep of a bundle for an input spelling returned zero **by
 * construction**, which reads exactly like a finding about the product.
 *
 * It has already produced two false P0s in one afternoon:
 *
 *  1. **"the UI drops CEE's edge uncertainty."** The projection reads
 *     `edge.data.strengthStd` and writes it as `strength_std`. A sweep for the
 *     camelCase spelling can never hit. The UI does not drop it;
 *     `mapDraftEdgeToCanvas` handles it correctly.
 *  2. **"`goal_threshold_frame` is absent, so the contract's UNATTESTED
 *     fail-closed trigger has fired."** The goal family went through a
 *     four-key allowlist that never contained `goal_threshold_frame`, so the
 *     field could not appear whatever the producer sent. A committed
 *     passthrough export (`codex-export-2026-08-05.canvas.json`) carries
 *     `goal_threshold_frame: "level"` in `node.data`, proving the field is real
 *     and the zero was the instrument.
 *
 * Both absences were read as facts about the product. Neither was. **A silently
 * lossy diagnostic is worse than a loud one**, so the projection now states
 * what it renamed and what it dropped, in the bundle, every time.
 *
 * ## The anti-mirror rule this module exists to obey
 *
 * A hand-written list of "keys the bundle drops" would drift from the transform
 * within weeks, and the drift would read as green — this estate's dominant
 * defect. So there is **ONE source of truth**: the spec tables below. The
 * transform builds its output from them, and the manifest is emitted from the
 * same arrays. The allowlist in the manifest IS the allowlist the transform
 * applied; the renames in the manifest ARE the renames it performed. They
 * cannot desync, because there is only one of each.
 *
 * `dropped_source_keys` goes one better: it is not a list at all, it is
 * **measured on the graph being exported** — every key actually present on
 * `node.data` / `edge.data` that no spec consumes. A key added upstream
 * tomorrow shows up in tomorrow's bundle with no edit here.
 *
 * ## ⚠ NAMED APART FROM `debug_redaction_manifest` — DO NOT RECONCILE THEM
 *
 * Two manifests answering similar-sounding questions look like an
 * inconsistency to fix. They are not. Write down the question each answers:
 *
 *  - `debug_redaction_manifest` (`src/lib/debugRedactionManifest.ts`) answers
 *    *"what did the REDACTOR suppress under `payloads.*`, and why?"* — subject:
 *    the captured wire payloads; mechanism: a walk collecting redaction markers;
 *    reason space: `sensitive_key` / `max_depth` / `array_capped` /
 *    `size_limit` / `circular_reference`. It is a SAFETY surface.
 *  - `debug_projection_manifest` (this module) answers *"what did the
 *    `full_graph` PROJECTION rename or drop, and under which spelling should I
 *    search?"* — subject: `full_graph`; mechanism: a fixed spec table; reason
 *    space: `renamed` / `not_in_allowlist`. It is a FIDELITY surface.
 *
 * Nothing redacted the fields this manifest reports; nothing this manifest
 * reports was withheld for safety. Merging them would produce one section that
 * answers neither question. Keep them apart.
 *
 * ⚠ This manifest records KEY NAMES ONLY and never a value, so it cannot
 * re-introduce anything the redactor removed.
 */

/**
 * One projected field.
 *
 * `from` is the fallback chain in `??` order, resolved against the node's or
 * edge's `.data`. A dotted entry (`observedState.display_value`) reads a nested
 * path. `fromRoot` is the same, resolved against the node/edge object itself.
 */
export interface EnrichedFieldSpec {
  /** The key as it appears in the bundle. */
  readonly to: string
  /** Source keys on `.data`, in `??` fallback order. */
  readonly from: readonly string[]
  /** Source keys on the node/edge root, tried after `from`. */
  readonly fromRoot?: readonly string[]
  /**
   * What the projection writes when every source is nullish.
   *
   * `'null'` keys are ALWAYS present in the JSON. Keys with no fallback settle
   * to `undefined`, and `JSON.stringify` DELETES undefined keys — so on those,
   * an absent value leaves **no trace whatsoever** in the bundle. That
   * asymmetry is why an edge-side absence sweep returns a clean-looking zero,
   * and it is reported as `absent_when_missing`.
   */
  readonly fallback?: 'null' | 'empty-string' | 'undefined'
  /** Mirrors `typeof x === 'number' ? x : fallback`; only `from[0]` is read. */
  readonly numberOnly?: boolean
  /** Emitted for backwards compatibility; not the canonical spelling. */
  readonly deprecated?: boolean
  /** Why this field is worth knowing about when reading a bundle. */
  readonly note?: string
}

/**
 * Node fields projected out of `node.data`.
 *
 * ⭐ `goal_threshold_frame` was added 18 Sep 2026. The CEE contract makes it
 * decisive — *"Absence means UNATTESTED and consumers MUST fail closed (no goal
 * probability)"* — and the estate could not see the field it needed in order to
 * reason about that rule, because this allowlist had four goal keys and this
 * was not one of them. Its absence from a bundle was therefore evidence about
 * this array, never about the producer.
 */
export const NODE_PROJECTION: readonly EnrichedFieldSpec[] = [
  { to: 'label', from: ['label'], fallback: 'empty-string' },
  { to: 'kind', from: ['kind'], fallback: 'undefined' },
  { to: 'description', from: ['description'] },
  { to: 'observed_state', from: ['observedState'], fallback: 'null' },
  { to: 'category', from: ['category'], fallback: 'null' },
  { to: 'interventions', from: ['interventions'], fallback: 'null' },
  { to: 'interventionKeys', from: ['interventionKeys'], fallback: 'null' },
  // V3 factor fields
  {
    to: 'display_value',
    from: ['display_value', 'observedState.display_value'],
    fallback: 'null',
  },
  { to: 'intercept', from: ['intercept'], fallback: 'null', numberOnly: true },
  { to: 'encoding_map', from: ['encoding_map'], fallback: 'null' },
  // V3 option fields
  { to: 'is_baseline', from: ['is_baseline'], fallback: 'null' },
  // V3 goal fields
  {
    to: 'goal_threshold',
    from: ['goal_threshold', 'success_threshold'],
    fallback: 'null',
    note:
      'Not a single scale. Measured across committed payloads it is raw/cap in '
      + 'some (250000/312500 = 0.8) and raw/100 in others — the shipped '
      + 'pricing-model starter carries goal_threshold 1.1 with raw 110, unit '
      + '"%", cap 140, i.e. 110% as a fraction, legitimately above 1. '
      + 'goal_threshold_frame is the field that discriminates, which is why it '
      + 'is now projected.',
  },
  { to: 'goal_threshold_raw', from: ['goal_threshold_raw'], fallback: 'null' },
  { to: 'goal_threshold_unit', from: ['goal_threshold_unit'], fallback: 'null' },
  { to: 'goal_threshold_cap', from: ['goal_threshold_cap'], fallback: 'null' },
  {
    to: 'goal_threshold_frame',
    from: ['goal_threshold_frame'],
    fallback: 'null',
    note:
      'Contract: absence means UNATTESTED and consumers MUST fail closed (no '
      + 'goal probability). Projected since 18 Sep 2026 — before that, absence '
      + 'in a bundle was a fact about the allowlist, not about the producer.',
  },
]

/**
 * Edge fields projected out of `edge.data`.
 *
 * ⚠ `strength_mean` PREFERS `weight`. When an edge carries both and they
 * disagree, the bundle reports `weight`'s value under the name `strength_mean`,
 * so a bundle-vs-wire comparison of `strength_mean` is not comparing the same
 * field. Recorded here rather than discovered again.
 */
export const EDGE_PROJECTION: readonly EnrichedFieldSpec[] = [
  { to: 'label', from: ['label'], fromRoot: ['label'] },
  { to: 'strength', from: ['strength_mean', 'strength', 'confidence'] },
  {
    to: 'strength_mean',
    from: ['weight', 'strength_mean'],
    note: 'Prefers weight; a disagreeing strength_mean is shadowed.',
  },
  {
    to: 'strength_std',
    from: ['strength_std', 'strengthStd'],
    note:
      'Re-keyed from the camelCase canvas spelling strengthStd. A bundle sweep '
      + 'for "strengthStd" returns zero by construction — the false P0 of '
      + '18 Sep 2026.',
  },
  { to: 'belief_exists', from: ['belief_exists', 'beliefExists'] },
  { to: 'effect_direction', from: ['effect_direction', 'direction'] },
  { to: 'weight', from: ['weight'], deprecated: true },
  { to: 'direction', from: ['direction'] },
  { to: 'beliefStrength', from: ['beliefStrength'] },
  // V3 edge metadata
  { to: 'edge_type', from: ['edge_type'] },
  { to: 'provenance_source', from: ['provenance_source'] },
  { to: 'exists_probability', from: ['exists_probability', 'beliefExists'] },
  // F7: carried verbatim. Absent stamp => absent field => "nothing proves this
  // was set" — the honest state, and the same reading the canvas uses.
  { to: 'weight_source', from: ['weightSource'] },
  { to: 'belief_exists_source', from: ['beliefExistsSource'] },
]

/**
 * Data keys the transform consumes OUTSIDE the spec tables, so the manifest
 * does not misreport them as dropped. `type` is a computed classification
 * (`kind ?? type ?? 'factor'`, lower-cased) that also routes a node into
 * `factors` or `options`; it is not a passthrough field.
 */
export const NODE_COMPUTED_SOURCE_KEYS: readonly string[] = ['kind', 'type']

/** Read a plain or dotted path off a record. */
function readPath(source: unknown, path: string): unknown {
  if (source === null || source === undefined) return undefined
  if (!path.includes('.')) {
    return typeof source === 'object'
      ? (source as Record<string, unknown>)[path]
      : undefined
  }
  let cursor: unknown = source
  for (const segment of path.split('.')) {
    if (cursor === null || typeof cursor !== 'object') return undefined
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  return cursor
}

/**
 * Resolve one spec. Reproduces the `??` chain exactly, including the detail
 * that a chain ending on an explicit `null` yields `null` (a present key) while
 * one ending on `undefined` yields `undefined` (a key `JSON.stringify` drops).
 */
export function projectField(
  spec: EnrichedFieldSpec,
  data: Record<string, unknown> | undefined,
  root?: Record<string, unknown>,
): unknown {
  if (spec.numberOnly) {
    const value = readPath(data, spec.from[0])
    if (typeof value === 'number') return value
    return spec.fallback === 'null' ? null : undefined
  }

  let last: unknown = undefined
  for (const key of spec.from) {
    const value = readPath(data, key)
    if (value !== undefined && value !== null) return value
    last = value
  }
  for (const key of spec.fromRoot ?? []) {
    const value = readPath(root, key)
    if (value !== undefined && value !== null) return value
    last = value
  }

  if (spec.fallback === 'null') return last ?? null
  if (spec.fallback === 'empty-string') return last ?? ''
  if (spec.fallback === 'undefined') return last ?? undefined
  return last
}

/** Build one projected object from a spec table. */
export function projectBySpecs(
  specs: readonly EnrichedFieldSpec[],
  data: Record<string, unknown> | undefined,
  root?: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const spec of specs) out[spec.to] = projectField(spec, data, root)
  return out
}

/** Every `.data` key a spec table reads (dotted paths count by their root). */
export function consumedSourceKeys(
  specs: readonly EnrichedFieldSpec[],
  extra: readonly string[] = [],
): string[] {
  const keys = new Set<string>(extra)
  for (const spec of specs) {
    for (const from of spec.from) keys.add(from.split('.')[0])
  }
  return [...keys].sort()
}

/** A key that reaches the bundle under a different name than it was read by. */
export interface ProjectionRename {
  /** Spelling on `node.data` / `edge.data` — what the canvas calls it. */
  readonly from: string
  /** Spelling in the bundle — the only spelling a bundle sweep can hit. */
  readonly to: string
  readonly note?: string
}

/** Per-surface projection report. Key names only; never a value. */
export interface ProjectionSurfaceManifest {
  /** The allowlist, emitted from the spec table that enforced it. */
  emitted_keys: string[]
  /** Every input spelling the projection reads. */
  consumed_source_keys: string[]
  /** Read under one spelling, emitted under another. Search by `to`. */
  renamed: ProjectionRename[]
  /** Emitted for compatibility; prefer the canonical spelling. */
  deprecated_keys: string[]
  /**
   * Keys that VANISH from the JSON when their sources are nullish, because
   * they settle to `undefined` and `JSON.stringify` deletes undefined. On
   * these, "not in the bundle" carries no information at all.
   */
  absent_when_missing: string[]
  /** Measured on THIS graph: present on `.data`, consumed by no spec. */
  dropped_source_keys: string[]
  /** How many objects carried each dropped key. */
  dropped_key_counts: Record<string, number>
  /** How many nodes/edges were inspected to produce the two fields above. */
  inspected_count: number
  /** Field-level notes worth reading before trusting a comparison. */
  notes: Record<string, string>
}

export interface EnrichedProjectionManifest {
  what_this_answers: string
  not_the_same_as: string
  node: ProjectionSurfaceManifest
  edge: ProjectionSurfaceManifest
}

function buildSurfaceManifest(
  specs: readonly EnrichedFieldSpec[],
  extraConsumed: readonly string[],
  observed: Array<Record<string, unknown> | undefined>,
): ProjectionSurfaceManifest {
  const consumed = consumedSourceKeys(specs, extraConsumed)
  const consumedSet = new Set(consumed)

  const renamed: ProjectionRename[] = []
  const notes: Record<string, string> = {}
  const deprecated: string[] = []
  const absentWhenMissing: string[] = []

  for (const spec of specs) {
    if (spec.deprecated) deprecated.push(spec.to)
    if (spec.fallback === undefined || spec.fallback === 'undefined') {
      absentWhenMissing.push(spec.to)
    }
    if (spec.note) notes[spec.to] = spec.note
    for (const from of spec.from) {
      if (from !== spec.to) {
        renamed.push({ from, to: spec.to, ...(spec.note ? { note: spec.note } : {}) })
      }
    }
  }

  const droppedCounts: Record<string, number> = {}
  let inspected = 0
  for (const data of observed) {
    if (!data || typeof data !== 'object') continue
    inspected += 1
    for (const key of Object.keys(data)) {
      if (consumedSet.has(key)) continue
      droppedCounts[key] = (droppedCounts[key] ?? 0) + 1
    }
  }

  return {
    emitted_keys: specs.map((s) => s.to),
    consumed_source_keys: consumed,
    renamed,
    deprecated_keys: deprecated,
    absent_when_missing: absentWhenMissing,
    dropped_source_keys: Object.keys(droppedCounts).sort(),
    dropped_key_counts: droppedCounts,
    inspected_count: inspected,
    notes,
  }
}

/**
 * Build the projection manifest for the graph being exported.
 *
 * Every field is derived: the allowlist and the renames come from the same spec
 * tables the transform ran, and the dropped keys are measured on the real
 * `node.data` / `edge.data` of this export.
 */
export function buildEnrichedProjectionManifest(
  nodeData: Array<Record<string, unknown> | undefined>,
  edgeData: Array<Record<string, unknown> | undefined>,
): EnrichedProjectionManifest {
  return {
    what_this_answers:
      'What full_graph RENAMED and DROPPED when it projected the canvas graph. '
      + 'A key absent from full_graph is not evidence the product lost it — '
      + 'check `renamed` for the bundle spelling and `dropped_source_keys` for '
      + 'what this projection never carries.',
    not_the_same_as:
      'debug_redaction_manifest, which answers what the REDACTOR suppressed '
      + 'under payloads.* and why (sensitive_key / max_depth / array_capped / '
      + 'size_limit / circular_reference). That is a safety surface over the '
      + 'captured wire; this is a fidelity surface over full_graph. Different '
      + 'questions — do not reconcile them.',
    node: buildSurfaceManifest(NODE_PROJECTION, NODE_COMPUTED_SOURCE_KEYS, nodeData),
    edge: buildSurfaceManifest(EDGE_PROJECTION, [], edgeData),
  }
}
