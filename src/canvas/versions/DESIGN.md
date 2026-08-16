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
| What Changed panel | `WhatChangedPanel.tsx` | built + tested (13 cases, jsdom) |
| Mount host | `VersionsPanelHost.tsx` | built |

Mounted at `src/routes/CanvasMVP.tsx` (one lazy import, one JSX element), which
serves both `/canvas` and `/scenario/:id`. No feature flag: the surface ships on,
per programme doctrine.

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

**Recommendation for the estate:** retire `src/canvas/snapshots/` and its flag once
this surface is witnessed, or explicitly re-scope it to visual/layout snapshots so
the two are not competing answers to one question. Not actioned here — out of lane.

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
