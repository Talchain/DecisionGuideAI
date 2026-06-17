# Collaboration foundation blocker checklist v1

**Lane:** Collaboration MVP infrastructure acceleration (DDL and static SEC/TEN validation only)
**Date:** 2026-06-17
**Branch:** `claude/collab-ddl-static-contracts` (cut from `origin/staging`). **NOT FOR MERGE OR DEPLOY.**
**Type:** Control-surface record. No runtime product code, no UI, no flags, no canvas, no Realtime. Only draft DDL, static tests, and this checklist.

This checklist is the single live control surface for park and unpark decisions on the collaboration workstream. Nothing beyond draft DDL and static contract tests advances until the relevant gates below are green. The collaboration workstream stays parked from product implementation until the V5 single-user golden journey is clean.

---

## What the static SEC/TEN suite does and does not prove

A passing static SEC/TEN contract suite (`tests/contracts/workspaceMigrationContract.spec.ts`) proves only that the draft SQL contains the expected structural tokens and guardrails **as text**.

It does **not** prove any of:

- SQL syntax validity;
- that the migration applies;
- RLS behavioural correctness;
- SECURITY DEFINER safety in execution;
- service-role workspace resolution;
- Realtime channel security;
- migration rollback or cutover safety.

Syntactic validation and behavioural security validation are deferred to the rehearsal environment and the executable behavioural SEC/TEN matrix. The static suite is a low-cost structural guardrail, not a security sign-off.

---

## Codex review status (honest record)

- The Codex delta-check on tenancy/collaboration spec v1.7 returned **approve with minor documentation amendments**.
- Those amendments were applied in commit `6db51cc3` on the PR #190 branch (`claude/tenancy-collab-spec-v1_6`).
- This lane still treats v1.7 as a **draft validation baseline** until Paul and ChatGPT explicitly bank PR #190 as the collaboration spec and design baseline.
- No independent live-security approval is claimed from Codex. The delta-check reviewed documentation, not a running system; it did not validate RLS behaviour, SECURITY DEFINER execution, service-role resolution, or any live security property.

---

## Blocker register

| # | Blocker | Status | Exact next action | Owner |
|---|---|---|---|---|
| 1 | Corrected Codex approval for v1.7 (bank PR #190 as baseline) | Open | Paul and ChatGPT decide whether to bank PR #190 as the collaboration spec and design baseline; until then v1.7 is a draft validation baseline | Paul / ChatGPT |
| 2 | Deployed `VITE_SUPABASE_URL` confirmation | Open | Read the baked env from the deployed AppPoC bundle (curl the deployed chunk) and confirm against the `netlify.toml` CSP backends; finalise the prod and staging label | Paul |
| 3 | Rehearsal Supabase environment or approved clone | Open (none exists today) | Provision a fresh Supabase project, or run a local stack (`supabase init` then `supabase start`) and load the migration set; required for any apply, for syntactic validation, and for behavioural SEC/TEN | Paul / infra |
| 4 | Cross-repo CEE service-role workspace-resolution verification | Open (cannot be cleared from this branch) | Verify in `olumi-assistants-service` that `append_turn_atomic`, `ensure_scenario_exists`, and `store_draft_graph` derive `workspace_id` server-side (verifying membership, never trusting a client value), including during the migration window | CEE owner |
| 5 | Executable behavioural SEC/TEN matrix | Partial | Static tier runnable now (this lane). Behavioural tier (RLS denial, SECURITY DEFINER, cross-user, anon, channel authorisation) needs the rehearsal environment (blocker 3) before it can run and go green | This repo (static); infra (behavioural) |
| 6 | Realtime private-channel authorisation spike | Open | Prove a Supabase Realtime authorisation (RLS-backed channel policy) pattern against `workspace_members`; no in-repo precedent exists. Gates production presence; out of this lane's scope | This repo, against rehearsal |
| 7 | V5 single-user golden journey gate | Open (controlling product gate) | Paul confirms the single-user PoC and V5 golden journey is clean on staging before any collaboration implementation begins | Paul |

Do not attempt to clear the cross-repo (blocker 4) or environment (blockers 2, 3) items from this branch unless explicitly asked.

---

## Unpark conditions (must all be green before implementation advances)

1. V5 single-user golden journey clean on staging (blocker 7).
2. Deployed `VITE_SUPABASE_URL` confirmed (blocker 2).
3. Rehearsal environment available (blocker 3).
4. Cross-repo CEE service-role verification complete (blocker 4).
5. Behavioural SEC/TEN matrix executable and green (blocker 5).

The draft DDL and static tests in this lane are explicitly **not** implementation-ready and **not** for merge or deploy. They de-risk the substrate structurally at low review cost while the gates above remain the controlling conditions.

---

## Artefacts in this lane

- `supabase/migrations/20260617000000_workspaces_foundation_draft.sql`: additive foundation draft (workspaces, members, invites, helpers, lifecycle RPC skeletons). Abort-guarded. Not applied.
- `supabase/migrations/20260617000001_scenarios_workspace_cutover_draft.sql`: end-state tenancy cutover draft (scenarios `workspace_id`, child consistency, membership RLS switch, `workspace_id` immutability, H-1+ hardening, CEE cross-repo blocker note). Abort-guarded. Blocked. Not applied.
- `tests/contracts/workspaceMigrationContract.spec.ts`: static, no-database structural contract tests for both drafts.
- `docs/audits/collab-foundation-blocker-checklist-v1.md`: this control surface.
