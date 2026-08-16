# Versioned workspace — design notes

Scope of this document: what was BUILT in the first slice, what was deliberately
DESIGNED-NOT-BUILT, and the precise asks that unblock the rest. British English
throughout.

Status rung of every claim below is stated explicitly. "Built" means code exists
and is tested; it does not mean deployed, mounted or user-witnessed.

---

## What is built

| Piece | File | Status |
|---|---|---|
| Shared types | `types.ts` | built + tested |
| **The one diff authority** | `diffModelVersions.ts` | built + tested (28 cases) |
| Capture projection | `captureModelVersion.ts` | built + tested (25 cases) |
| Storage (localStorage, guest-working) | `versionStorage.ts` | built + tested (18 cases) |
| Plain-language captions | `describeChange.ts` | built + tested (24 cases) |
| Pre-ingest auto-capture | `autoCapture.ts` | built + tested (9 cases) |
| Version-history panel | `WhatChangedPanel.tsx` | built + tested (jsdom) |
| Panel mount host | `VersionsPanelHost.tsx` | built |
| Trigger (no positioning) | `VersionsTrigger.tsx` | built + tested |
| Open/closed state | `versionsPanelStore.ts` | built + tested |
| Panel vocabulary + origin labels | `versionLabels.ts` | built + tested |

The PANEL is mounted at `src/routes/CanvasMVP.tsx` (one lazy import, one JSX
element), which serves both `/canvas` and `/scenario/:id`. No feature flag: the
surface ships on, per programme doctrine.

The TRIGGER is mounted separately, and that separation is the point of R4 (see
below). Its homes:

- `src/components/layout/TopBar.tsx` — the primary one, beside share and the
  model name;
- the analysis panel header — one line for the cockpit lane:
  `<VersionsTrigger variant="icon" />`.

## R4 — one home for history, and no floating pill

Paul ruled on 16 Aug 2026 that the floating "Versions" pill dies. What it cost
while it lived (ledger L-08): it was `position: absolute; z-[1500]`, offset from
the viewport's right edge by a `calc()` over the OutputsDock's expanded width in
BOTH dock states, so with the dock collapsed it hovered ~350px out over open
canvas, attached to nothing. An entire module (`versionsTriggerPosition.ts`,
~124 lines of derived-offset arithmetic and overlap geometry) existed to stop
one floating control landing on another floating control.

That module is DELETED, and `VersionsTrigger` carries no positioning of its own —
no `absolute`, no `fixed`, no `z-index`, no inset. Layout belongs to the header
row that mounts it. **Do not give this component a position.** The defect was
never the arithmetic; it was a control with no home, and better arithmetic
would only have hidden it.

The consequence for state: trigger and panel are no longer in one subtree, so
the open flag moved from host-local `useState` to `versionsPanelStore` — a
dedicated store, deliberately NOT `uiStore.activeOverlaySurface`, whose one-slot
exclusivity would make opening the kebab menu silently close version history.

Meanwhile the TopBar already had a "Version history" button that dispatched a
toast reading *"Version history is coming soon."* — a control denying a
capability that was mounted 57px below it. That button is now the real trigger.

⚠ jsdom proves presence and text, never visibility. Nothing here is
journey-witnessed. A browser witness on staging is still owed.

---

## One diff — the rule this namespace exists to hold

`diffModelVersions` is the ONLY implementation of model comparison in this
namespace, and every surface consumes the `ModelChangeset` it returns:
What Changed today; restore and variants when they land.

This matters because the estate already pays for the opposite pattern. There are
two same-named `generateGraphHash` functions — one seed-bearing
(`store/runHistory.ts:72`), one seedless (`canvas/utils/graphHash.ts:19`) —
producing mutually incomparable values, and a third `computeGraphHash` in
`hooks/useAutosave.ts:133`. Do not add a second diff. If a surface needs a
different VIEW of a change, add a projection over `ModelChangeset`, not another
comparison.

Known adjacent implementations, deliberately not built on:

- `compare-tab/graphChangeDiff.ts` — inside the Compare tab, which is
  mid-retirement by the cutover train. Out of bounds.
- `snapshots/VisualDiff.tsx` + `snapshots/useVisualDiff.ts` — part of the
  unwired Snapshots v2 module (see below).

---

## Why a new namespace rather than wiring Snapshots v2

`src/canvas/snapshots/` already implements named, timestamped, localStorage,
FIFO-bounded snapshots with save/restore/delete, behind `VITE_FEATURE_SNAPSHOTS_V2`
(default OFF). It has zero importers outside its own directory. On the face of it
that is this feature, already built and dark.

It was not used, and the reason is substantive rather than territorial: its stored
shape is **lossy in exactly the dimension this feature needs**
(`snapshots/snapshots.ts:26-39`):

```ts
nodes: Array<{ id; label; x; y; type? }>
edges: Array<{ from; to; label?; weight? }>
```

No values, no observed state, no belief or direction, no provenance. A field-level
diff over that can only ever report renames and positions — it structurally cannot
answer "what did I change about my reasoning?". Capturing into it would have meant
either flattening user data away or widening its schema, and widening the schema of
a flag-off module with a `VisualDiff` of its own would have produced a second diff
authority by the back door.

**Recommendation ACTIONED, 16 Aug 2026 — partially, and the remainder is named.**
Re-derived at `f15bccaf` with a same-shape contrast control (`snapshots/types` →
7 importers, so the probe can see importers when they exist):

- `snapshots/snapshots.ts`, `SnapshotPanel.tsx`, `VisualDiff.tsx`,
  `useVisualDiff.ts` and `__tests__/snapshots.spec.ts` formed a CLOSED island —
  they import each other and **nothing outside the directory imports any of
  them**. Deleted, with `e2e/snapshots-v2.spec.ts` (its only other reference).
- `snapshots/types.ts` is NOT dead — 7 live importers, including
  `canvas/store.ts`. **Kept.** The earlier note above that the whole directory
  had "zero importers outside its own directory" was measured against the
  MODULE, not the directory, and is corrected here.
- `VITE_FEATURE_SNAPSHOTS_V2` / `flags.snapshotsV2` / `isSnapshotsV2Enabled` are
  now orphaned (only `tests/__helpers__/mockFlags.ts` references them). NOT
  removed here: `src/flags.ts` is high-collision shared state and a required CI
  job reports flag drift against the deployed set. Reported for a flags lane.
- `src/lib/snapshots.ts` (a THIRD, unrelated `Snapshot` type) is **live** —
  `components/SandboxStreamPanel.tsx` imports it. Not touched.
- `canvas/components/SnapshotManager.tsx` (a FOURTH concept, over
  `canvas/persist`) is **live and user-reachable** from the TopBar kebab as
  "Snapshots". It overlaps this feature conceptually and its removal is a
  material change to a visible surface, so it is REPORTED for Paul's ruling,
  not removed.

---

## Why versions are NOT sourced from run history

`store/runHistory.ts:1-8` carries an explicit prohibition:

> this local run history (client graph hashes + graph snapshots "for computing
> deltas") must NEVER back a "What changed" surface or any freshness signal —
> versioned comparison is producer-owned and absent from every contract today.
> [...] Do not wire this in.

Honoured in full. Nothing in this namespace imports run history, and nothing
computes a graph hash.

The distinction that makes this feature legitimate rather than a workaround: the
prohibition is about ANALYSIS comparison — claims about what the engine now thinks,
which are producer-owned. This feature compares **two snapshots the user authored
themselves** and answers "what did I change?". It renders no freshness claim, no
"your analysis is out of date", and no statement about analysis at all.

If that distinction is ever judged too fine, the correct response is to withdraw
the surface, not to soften the prohibition.

---

## Storage: localStorage-first, and the honest consequence

Versions are stored in `localStorage` under `olumi-canvas-model-versions-v1`, for
every session class, with **no identity check anywhere in the module**.

That is deliberate. The nearest comparable surface hydrates through
`compare-tab/useCompareHistoryHydration.ts:79`:

```ts
const { userId } = await getSessionIdentity()
if (cancelled || !userId) return
```

Staging serves sessions as guest, so that surface is permanently empty for the
people actually testing the product. The server alternative cannot fix it either:
`v5_handler_facts` is RLS-scoped to `auth.uid()`, so guest rows are invisible by
construction (`services/analysisRunHistoryService.ts:33-38` records that 643 of 773
live run facts are guest rows invisible to that query).

**What the user is told, on screen, in the panel:** versions are stored in this
browser only, are not shared with collaborators, and are lost if site data is
cleared. Stated rather than hidden.

**Bounds:** 20 versions, newest-first, FIFO. On a quota error the store sheds
oldest-first and reports what it kept; if even one version will not fit it fails
loudly rather than reporting a save that did not happen.

### Migration path to durable storage

1. Keep `ModelVersion` and the `VersionedPayload` envelope exactly as they are —
   the payload is already schema-versioned (`canvas.versions.v1`), so a server
   table can adopt the same shape without a translation layer.
2. Add a server-backed implementation behind the SAME module interface
   (`loadVersions` / `appendVersion` / `deleteVersion`), selected at the storage
   boundary, never at the surface.
3. **Do not gate the local path off when the server path lands.** Guests must keep
   working. The correct end state is local-first with server sync for signed-in
   users, not server-only — otherwise the guest-blind defect returns wearing a
   different hat.
4. On first sign-in, offer to import local versions (precedent:
   `lib/loginDraftImport.ts`).

---

## Designed, not built

### Restore — blocked on the canonical transaction API

Restoring a version is a WRITE to the canvas graph, and it is exactly the class of
write that must go through Codex's canonical transaction API rather than a bare
`setState`. Same gating as the model editor. Not built here.

**The precise ask, stated so it can be actioned without this context:**

> Restore needs a single transactional entry point that accepts a complete target
> graph (`nodes`, `edges`) and applies it as ONE atomic, undoable, history-pushing
> mutation, with the same external-mutation fencing that
> `beginExternalGraphMutation` / `endExternalGraphMutation` provide — so a restore
> cannot interleave with a streamed draft apply or an applied-edit reconcile.
>
> Signature shape wanted:
> `applyGraphTransaction({ nodes, edges }, { label: string, source: 'version_restore' }): Result`
>
> Why a bare `setState` is not acceptable: `applyDraftResult` fires twice per
> streamed turn and `reconcileAppliedGraph` can delete elements. A restore that
> lands between them would be silently overwritten, and the user would be told
> their model was restored when it was not — a false claim about their own data,
> which is the worst failure this feature could have.

Until that exists, the panel deliberately offers **no restore button**. An
affordance that cannot keep its promise is worse than its absence.

### Variants

A variant is a version that is deliberately kept live as an alternative rather
than as history — "what if we assumed demand held flat?". The data model already
supports it: `VersionOrigin` is a union, and a `'variant'` member plus an optional
`parentVersionId` would carry the branch relationship. What is NOT designed is the
canvas affordance for switching between variants, which needs the same transaction
API as restore and a decision about whether variants are comparable across
branches (they are, using the same one diff — the changeset does not care whether
two versions are sequential).

Deferred until restore lands. Building variant capture without variant switching
would be capability that reaches no user.

### Analysis difference via `graph_hash`

`ModelVersion.graphHash` exists on the type and `CaptureOptions.graphHash` is
accepted, but **nothing supplies it today and nothing renders it**. This is stated
plainly because a field that looks wired but is not is exactly how a dark
capability gets recorded as shipped.

Why it is unwired: there is no `graphHash` field on `useCanvasStore` at all. The
two places a hash is actually held are both unavailable — the compare-tab snapshot
store (mid-retirement) and local run history (prohibited above). Computing one here
would mean choosing between the seeded and seedless twins, which produce mutually
incomparable values; picking either would bake in a hash regime by accident.

**The ask that unblocks it:** a single canonical, seedless model hash exposed on the
canvas store and stamped onto analysis facts by the producer, so a version can
record "this is the model the engine actually analysed". With that, a future
surface could honestly say *"the model has changed since this analysis ran"* —
which remains a producer-owned claim and must arrive with producer backing, not be
derived client-side.

### Known gaps in the capture projection

Captured fields are DERIVED (every own scalar, minus a presentation denylist), so
new domain fields appear automatically. Not captured, deliberately:

- `interventions`, `functionParams`, `causal_claims`, `validation`, and the object
  form of `prior` — nested structures that cannot be compared or captioned honestly
  at field level yet. A nested diff is a real piece of work, not a one-line
  extension, and half-doing it would produce confident wrong captions.
- Node POSITION. Moving a node is not a change to the reasoning.

The trade-off of a denylist over an allowlist: a newly added presentation field
nobody denylists will surface as a visible "change" row. That failure direction is
chosen on purpose — a visible wrong row gets fixed; a silently omitted user edit
does not.

---

## Invariants any future change must preserve

1. **One diff.** No second comparison implementation. Projections over
   `ModelChangeset`, never a parallel diff.
2. **Pair by identity.** Nodes and edges pair by `id` only. Never by label, never
   by a value predicate — two nodes routinely share a label.
3. **Never fabricate, never re-stamp.** Capture applies no defaults. The four edge
   `*Source` markers mean "absent ⇒ defaulted"; stamping one launders a UI default
   into a claim about the user.
4. **Encode before caption.** Sentences come only from `describeChange.ts`, only
   from the changeset. No summaries, scores or judgements.
5. **Guests work.** No identity check in the storage path, ever.
6. **Auto-capture cannot break ingest.** Every failure swallowed with a warning.
7. **A version is not an analysis run, and the copy must say so.** A VERSION is
   a snapshot the USER authored; an ANALYSIS RUN is a computation the ENGINE
   performed. Two surfaces both said "What changed" and answered those two
   different questions, which taught readers they were one thing (trap 21). The
   panel names versions; the run-over-run chip
   (`canvas/components/WhatChangedChip.tsx`) names analysis runs. Panel
   vocabulary lives in `versionLabels.ts` — change it there, not inline.
8. **The trigger carries no positioning.** See R4 above.
9. **No comparison UI until there is something to compare.** With fewer than two
   versions the panel renders its honest empty state and NOTHING else — no
   selects, no comparison section (ledger L-11). An affordance that cannot keep
   its promise is worse than its absence; this is the same rule that keeps
   `restore` unbuilt.
10. **Automatic captures are labelled.** A row the user did not create must say
    so, or the list is a mystery rather than a history.
