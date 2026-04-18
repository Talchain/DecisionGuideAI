# Follow-up: top-evidence IA dedup (from Brief 5 Task 5)

**Source:** Deferred out of [Brief 5](../brief-5-preflight-findings.md) Phase 0 per Paul's gate decision on 2026-04-18.
**Deferred because:** UI-side cross-source dedupe would require semantic synthesis, which Brief 5's stop rule forbids.

## Problem

On the Analysis tab's Top-3 evidence/actions list, rank 1 and rank 2 can render two visibly different card shapes for what users perceive as the same factor. Example (from Paul's QA screenshot):

- Rank 1: "User Adoption R..." — AI-estimate pill, influence %, EVPI pp, inline Set-value input, pencil/check, More chevron. (Rich factor card.)
- Rank 2: "Gather evidence on User Adoption Readiness" — headline-style title, description sentence, pencil icon only. (Coaching-prompt card.)

Two cards, same underlying factor, different visual shapes → users feel the IA is inconsistent.

## Why Brief 5 couldn't fix it in UI

Trace completed in Phase 1 exploration (see `docs/brief-5-preflight-findings.md` §Task 5):

| Field | Evidence gaps (source 1) | Next actions (source 2) |
|-------|--------------------------|-------------------------|
| Upstream source | `m1Coaching.evidence_gaps` | `m1Coaching.next_actions` |
| Dedupe key within source | `factor_id` | `action` text + `target_id` |
| **Cross-source dedupe key** | **none** | **none** |
| Semantic intent | "Gather evidence on this factor" | "Do this higher-order action" |

Next-action `target_id` is generic (can be an edge id, option id, or factor id) and is NOT guaranteed to equal an evidence-gap `factor_id`. UI has no upstream contract that says "these two arrays may refer to the same factor, and when they do, suppress the duplicate."

Merging them inside the UI would require the client to decide semantic equivalence — which belongs upstream.

## Proposed paths (pick one)

### Option A — Unified schema (preferred)

PLoT emits a single `m1_coaching.top_evidence_items[]` array where each item declares its own `kind` (`evidence_gap` | `next_action`). Dedupe happens upstream so the UI never sees two entries for the same factor at the same rank. Rank + kind together drive the card shape.

Migration: back-compat by keeping the old `evidence_gaps[]` / `next_actions[]` during transition, add the new field, flip the UI when present.

### Option B — Cross-source dedupe hint

PLoT keeps the two arrays but emits a boolean `suppress_in_top_evidence: true` on any `next_action` whose `target_id` matches a `factor_id` in `evidence_gaps`. UI reads the hint and filters. Minimal upstream change.

### Option C — UI extracts canonical factor_id from next-action `target_id`

Not recommended. Requires UI to classify `target_id` strings semantically (factor vs edge vs option) — that's the synthesis Brief 5's stop rule forbids. Keep out.

## Acceptance for the follow-up brief

- When the top-evidence list contains an evidence-gap and a next-action referring to the same factor, the user sees one card (with the evidence gap's rich shape) and the next-action's copy — if still relevant — appears as an inline secondary line within that same card (pattern: the Validate / Research chips shown on existing factor cards).
- No UI-side synthesis of `target_id` → `factor_id` equivalence.
- Existing single-source dedupe continues to work.
- Regression tests: render fixtures where both sources reference the same factor and assert the merged card; render fixtures where they don't and assert both cards remain.

## Out of scope for the follow-up brief

- Visual redesign of the cards beyond the dedupe merge.
- Changing the EVPI ranking logic.
- Scope creep into other m1_coaching fields.

## Dependencies

- PLoT / CEE team confirmation that Option A or Option B is shippable, plus a schema update owner.
- Coordination with any ongoing Signal Registry v3 work (not in scope for Brief 5 but may intersect with the canonical factor schema).

## Status

- **2026-04-18** — Deferred from Brief 5 Phase 0. Awaiting upstream team assignment.
