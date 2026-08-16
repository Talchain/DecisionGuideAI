/**
 * Versioned workspace — shared types.
 * British English: visualisation, colour, initialise.
 *
 * WHAT A VERSION IS, AND WHAT IT IS NOT
 * -------------------------------------
 * A `ModelVersion` is a snapshot of THE USER'S OWN MODEL — the nodes, edges,
 * labels, values and provenance fields a user can see and author on the canvas.
 * It is a record of authorship, not of analysis.
 *
 * ⚠ IT IS DELIBERATELY NOT SOURCED FROM RUN HISTORY. `store/runHistory.ts:1-8`
 * carries an explicit prohibition: that module's client graph hashes and graph
 * snapshots "must NEVER back a 'What changed' surface or any freshness signal —
 * versioned comparison is producer-owned and absent from every contract today."
 * That prohibition is honoured here in full and is the reason this namespace
 * exists rather than a wiring of `loadRuns()`:
 *   - nothing in `src/canvas/versions/**` imports run history;
 *   - nothing here computes a graph hash (`generateGraphHash` is not called —
 *     note it is also one of the two same-named twins CLAUDE.md trap #10 warns
 *     about, the seed-bearing one);
 *   - `graphHash` below is only ever COPIED from an analysis fact that already
 *     carried one, as an opaque bridge for a future producer-owned
 *     analysis-difference feature. Nothing in this slice renders it, and no
 *     freshness or "your analysis is out of date" claim is derived from it.
 * The distinction that makes this feature legitimate: the user authored both
 * sides of this comparison. It answers "what did I change?", never "what does
 * the engine now think?".
 *
 * STORAGE CLASS, STATED HONESTLY
 * ------------------------------
 * localStorage only, for every session class — guest AND signed-in. That is a
 * deliberate PoC choice, not an oversight:
 *   - it makes the feature work for GUESTS, which staging serves by default;
 *   - it avoids repeating the defect at
 *     `compare-tab/useCompareHistoryHydration.ts:79`, where hydration
 *     early-returns on a missing `userId` so guests see a permanently empty
 *     surface;
 *   - the server-side alternative (`v5_handler_facts`) is RLS-scoped to
 *     `auth.uid()`, so it is structurally incapable of serving guests.
 * CONSEQUENCE THE USER MUST BE TOLD: versions live in ONE browser on ONE
 * device, are not shared, and are lost when site data is cleared. The panel
 * says so on screen. See DESIGN.md for the durable-storage migration path.
 */

/**
 * A scalar field value that can be compared and rendered without
 * interpretation. Anything richer (nested CEE objects, arrays, validation
 * metadata) is deliberately EXCLUDED from the comparable projection rather
 * than flattened — see `captureModelVersion.ts`. A field we cannot compare
 * honestly is a field we do not claim to compare.
 */
export type FieldValue = string | number | boolean | null

/**
 * A node as captured for versioning: stable identity plus the comparable
 * user-visible fields.
 *
 * `id` is the canvas node id and is the ONLY thing used to pair nodes across
 * versions. Never pair by label or by value — two distinct nodes routinely
 * share a label, and pairing by a value predicate is exactly the defect
 * CLAUDE.md trap #19 names (a test, or a diff, that resolves the wrong object).
 */
export interface VersionedNode {
  id: string
  /** Node taxonomy member (goal | decision | option | factor | risk | ...). */
  kind: string
  label: string
  fields: Readonly<Record<string, FieldValue>>
}

/**
 * An edge as captured for versioning.
 *
 * `id` is the canvas edge id. `from`/`to` are carried for RENDERING a readable
 * caption ("Price → Revenue"); they are NOT the pairing key, because an edge
 * can be re-pointed while keeping its identity.
 */
export interface VersionedEdge {
  id: string
  from: string
  to: string
  label?: string
  fields: Readonly<Record<string, FieldValue>>
}

/** How a version came to be captured. */
export type VersionOrigin = 'manual' | 'pre-ingest'

export interface ModelVersion {
  id: string
  /** User-supplied name for a manual save; a generated description otherwise. */
  name: string
  /** Unix ms. */
  createdAt: number
  origin: VersionOrigin
  /**
   * Opaque analysis graph hash, COPIED from an analysis fact when one was
   * present at capture time. Never computed here, never rendered, never used
   * to derive a freshness claim. See the header note.
   */
  graphHash?: string
  nodes: VersionedNode[]
  edges: VersionedEdge[]
}

/** Identity of a version, as carried on a changeset. */
export interface VersionRef {
  id: string
  name: string
  createdAt: number
}

/** One field that differs between two versions of the same element. */
export interface FieldChange {
  field: string
  before: FieldValue
  after: FieldValue
}

/** A node present in both versions whose comparable fields differ. */
export interface NodeChange {
  id: string
  /** Label in the LATER version — what the user would look for now. */
  label: string
  kind: string
  fields: FieldChange[]
}

/** An edge present in both versions whose comparable fields differ. */
export interface EdgeChange {
  id: string
  from: string
  to: string
  /** Label in the LATER version. */
  label?: string
  fields: FieldChange[]
}

/**
 * The typed result of comparing two model versions.
 *
 * THE SINGLE CANONICAL CHANGESET. Every surface that wants to say what
 * changed — the What Changed panel today, restore/variants later — consumes
 * this shape and no other. There is deliberately no second diff in this
 * namespace and none should be added elsewhere (see DESIGN.md §"One diff").
 */
export interface ModelChangeset {
  from: VersionRef
  to: VersionRef
  addedNodes: VersionedNode[]
  removedNodes: VersionedNode[]
  modifiedNodes: NodeChange[]
  addedEdges: VersionedEdge[]
  removedEdges: VersionedEdge[]
  modifiedEdges: EdgeChange[]
  /** True when every collection above is empty. Derived, never set by hand. */
  isEmpty: boolean
}
