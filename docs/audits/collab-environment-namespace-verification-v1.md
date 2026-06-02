# Collaboration environment and namespace verification

**Brief:** COLLAB-ENVIRONMENT-NAMESPACE-VERIFICATION-v1
**Date:** 2026-06-02
**Branch:** `claude/collab-environment-namespace-verification`, cut from `claude/tenancy-rls-migration-spec-v1_3` (`7b2ce689`)
**Type:** Read-only verification. No code, schema, migration, prompt, package, lockfile, config, or test changes. Single deliverable is this file.
**Purpose:** close, or clearly state what remains blocked on, the two hard gates the Tenancy and RLS migration spec v1.3 requires before any migration SQL: the environment identity gate and the namespace/orphan-table gate.
**Method:** read-only Supabase MCP introspection (`pg_class`, `pg_policies`, `pg_proc`, `information_schema`, `auth.users` counts only) plus repo inspection. No row payloads exfiltrated; only counts, schema metadata, and one function body. Inputs read: the v1.3 spec (present on this branch) and the three prior audits (phase-0 `1e1028bf`, surface-recon `5c98a57c`, teams disposition `a9d80d12`), whose content is carried in this work.

---

## 1. Executive summary

Both gates can be substantially closed, but **the v1.3 spec must be amended before it proceeds to Codex/security review**, because live introspection contradicts two of its assumptions and surfaces hardening and drift items it does not yet name.

- **Environment identity: target resolved, formal label partially resolved, rehearsal environment confirmed absent.** Three Supabase projects are visible. Only `etmmuzwxtcjipwphdola` ("Olumi") holds canonical V5 data and the CEE service-role RPCs; it is the sole viable migration target. Its user base is tiny and stale (16 auth users, about 8 obvious test accounts, 7 domains, no signups since 2025-07-19), and the deployed front end's CSP points at staging backends, so it is best classified as shared dev/staging with early-pilot data, not a distinct high-volume production system. The other active project ("Olumi-EarlyAccess") is an empty stub, and the third is inactive. There is therefore **no separate rehearsal environment**, which the migration plan needs.
- **Namespace gate: pass, with a conceptual-collision caveat.** No planned name exists live: there is no `workspaces`, `workspace_members`, `workspace_invites`, or `element_comments` table. The only collisions are conceptual: legacy `organisations`/`organisation_members` overlap `workspaces`/`workspace_members`, and `canvas_presence`/`canvas_comments` overlap planned presence/comments. Choosing the fresh `workspaces*` and `element_comments` names avoids any direct clash.
- **Orphan-table gate: pass, with actions.** The orphan tables (`canvas_*`, `organisations`, `organisation_members`) are real, data-bearing, fully RLS-policied, with cascade FKs, but have no migration provenance in this repo and no application code. They do not block the migration; each conceptually-overlapping orphan needs a recorded disposition, and their provenance should be confirmed.
- **Two corrections to v1.3 (live contradicts the spec):**
  1. `scenarios.thread` does **not exist** in the live database, and the `append_thread_entries`/`update_thread_block_state` RPCs are **absent** (migration `20260308000000_thread_persistence.sql` was never applied). The spec's conversation-thread privacy concern (§11/T-1) is therefore **inert today**, not live; the code reads a column that is not there. The durable per-user conversation store is `v5_conversation_turns`.
  2. The live `create_shared_brief` body is the **CEE-repo variant** (it declares `v_shared_id`), resolving the duplicate-migration question.
- **Hardening confirmed and expanded (H-1+):** `v5_conversation_turns` and `v5_handler_facts` lack FORCE RLS, their single SELECT policy targets role `public` rather than `authenticated`, and `anon` holds full table-level DML grants on both. The exposure is currently contained by RLS being enabled with no permissive write policy (anon has a null `auth.uid()`), but this is a real defence-in-depth gap to close in the same step that adds workspace policies.

**Verdict:** environment identity gate, resolved enough to name the target, with two confirmations Paul must make. Namespace gate, pass. Orphan gate, pass with actions. FORCE RLS hardening, confirmed needed. Conversation privacy risk, reframed to latent. The v1.3 spec **cannot progress unchanged**; required amendments are in §8.

---

## 2. Environment identity

| Project | Ref | Region | Status | Apparent role | Canonical V5 data? | Collaboration/legacy data? | Migration target? |
|---|---|---|---|---|---|---|---|
| Olumi | `etmmuzwxtcjipwphdola` | us-east-1 | active | Shared dev/staging plus early-pilot (see evidence) | Yes (sole holder) | Yes (orphan canvas/org stack plus V1 teams/decisions) | Yes (only viable) |
| Olumi-EarlyAccess | `ewyskeampbmbagyclvfn` | eu-west-2 | active | Empty stub | No | No | No |
| sb1-8t1bpc | `vaslbdceyqwcgzjlftgi` | us-east-1 | inactive | Unknown (not introspected; not woken) | Unknown | Unknown | No |

Evidence for the "Olumi" classification:
- It is the only project containing V5 data: 391 `scenarios`, 1543 `v5_conversation_turns`, 496 `v5_handler_facts`, and the CEE service-role RPCs (`append_turn_atomic`, `ensure_scenario_exists`, `store_draft_graph`) all live here, which also confirms the UI and CEE share this single project.
- Tiny, stale user base: `auth.users` has 16 rows, about 8 of which match test patterns (`test`/`invayo`/`example`), across 7 distinct email domains, with the newest signup on 2025-07-19 and the oldest on 2025-02-03. No new signups in roughly ten months.
- The deployed front end's `netlify.toml` CSP `connect-src` lists staging backends (`cee-staging.onrender.com`, `plot-lite-service-staging.onrender.com`, `isl-staging.onrender.com`), indicating the deployed tier is staging.
- Repo scripts default `SUPABASE_URL` to `https://etmmuzwxtcjipwphdola.supabase.co` (`test-email-service.js`, `test-edge-function.js`).
- "Olumi-EarlyAccess" contains only `early_access` (0 rows), so it is not a production data store.

Residual items for Paul (the gate cannot fully close without these):
- Confirm the deployed application's `VITE_SUPABASE_URL` (it is injected via environment, not committed, so introspection cannot prove which project the live site uses). This finalises the prod/staging label.
- Confirm whether a separate production environment exists or is planned elsewhere.
- Decide how to obtain a rehearsal environment, since none exists. A destructive tenancy migration should be rehearsed on a clone or a fresh project before touching the canonical data.

Verdict: target project resolved (`etmmuzwxtcjipwphdola`). Formal prod/staging label partially resolved (evidence points to shared dev/staging plus early-pilot). Rehearsal environment resolved as absent.

---

## 3. Public schema and namespace inventory

The live public schema of `etmmuzwxtcjipwphdola` contains 54 base tables. None of the planned collaboration names exist:
- `workspaces`: absent.
- `workspace_members`: absent.
- `workspace_invites`: absent.
- `element_comments`: absent.

So there is **no direct name collision** with the planned tenancy or collaboration tables.

Tables present that are conceptually adjacent to planned names (collision is conceptual, not direct):

| Live table | Conceptually overlaps planned | Nature |
|---|---|---|
| `organisations` | `workspaces` | Legacy tenant model (id, name, slug, owner_id, settings, plan_type) |
| `organisation_members` | `workspace_members` | Legacy membership (organisation_id, user_id, role) |
| `canvas_presence` | new presence table | Legacy presence (cursor_position, last_seen, editing_block_id) |
| `canvas_comments` | `element_comments` | Legacy threaded per-block comments |

Choosing the fresh `workspaces` / `workspace_members` / `workspace_invites` / `element_comments` names sidesteps the conceptual overlap cleanly; the legacy `organisations`/`canvas_*` namespace can be left in place.

---

## 4. Orphan and collision assessment

All figures live-verified 2026-06-02. None of these tables has a `CREATE TABLE` in this repo's `supabase/migrations/`, and none is referenced by application code in `src/` (greps return nothing). They are remnants of an earlier product generation that shared this Supabase project.

| Table | Rows | RLS | FORCE RLS | Policies | Key FKs (delete rule) | Repo provenance | Code refs | Disposition |
|---|---|---|---|---|---|---|---|---|
| `organisations` | 11 | yes | yes | 4 | (owner_id) | none | none | Leave untouched; conceptual overlap with `workspaces`; investigate provenance; decommission later |
| `organisation_members` | 14 | yes | yes | 3 | organisation_id→organisations (CASCADE), user_id→user_profiles (CASCADE) | none | none | Leave untouched; overlaps `workspace_members`; decommission later |
| `canvases` | 23 | yes | yes | 4 | (organisation_id, team_id, user_id, template_id) | none | none | Leave untouched; avoid name reuse |
| `canvas_blocks` | 164 | yes | yes | 4 | (canvas_id, organisation_id) | none | none | Leave untouched |
| `canvas_comments` | 36 | yes | yes | 1 | block_id→canvas_blocks, canvas_id→canvases, organisation_id→organisations, parent_id→self, user_id→user_profiles (CASCADE), resolved_by→user_profiles (SET NULL) | none | none | Leave untouched; overlaps `element_comments`; prior art |
| `canvas_versions` | 46 | yes | yes | 1 | (canvas_id, organisation_id) | none | none | Leave untouched |
| `canvas_version_comments` | 10 | yes | yes | 5 | (version_id, user_id, parent_id) | none | none | Leave untouched |
| `canvas_permissions` | 24 | yes | yes | 4 | (canvas_id, user_id, team_id) | none | none | Leave untouched |
| `canvas_presence` | 3 | yes | yes | 1 | canvas_id→canvases (CASCADE), editing_block_id→canvas_blocks (SET NULL), user_id→user_profiles (CASCADE) | none | none | Leave untouched; prior art for presence/edit-lock |

Observations:
- The legacy stack is a complete tenant-plus-collaboration system (organisations as tenant with `plan_type`, organisation_members as membership, canvases as per-org documents, plus presence, comments, versions, and permissions). It is fully RLS-policied and FORCE-enabled, so it was a real shipped product, not a sketch.
- It references `user_profiles` (not `auth.users` directly) and cascades cleanly within itself, so it is self-contained and safe to leave frozen.
- Provenance is unknown from this repo. It was created by another codebase or directly. The migration must not assume a clean public namespace and must not create a table named `organisations`/`organisation_members`/`canvas_*`.

No destructive action is proposed. Disposition for each is leave untouched now, decide archive/decommission in the separate V1 decommission workstream.

---

## 5. Six V5 tables verification (live 2026-06-02)

| Table | Rows | Cols | RLS | FORCE | Policies (predicate) | Grants | Trigger | Key FKs |
|---|---|---|---|---|---|---|---|---|
| `scenarios` | 391 | 22 | yes | yes | 4: SELECT/INSERT/UPDATE/DELETE, all `auth.uid() = user_id`, role authenticated | authenticated, service_role (no anon) | `scenarios_updated_at` BEFORE UPDATE | source_scenario_id→scenarios (SET NULL) |
| `shared_briefs` | 0 | 10 | yes | yes | 1: SELECT `auth.uid() = user_id`, authenticated | authenticated, service_role | none | scenario_id→scenarios (CASCADE) |
| `scenario_snapshots` | 0 | 11 | yes | yes | 2: SELECT/INSERT `auth.uid() = user_id`, authenticated | authenticated, service_role | none | scenario_id→scenarios (CASCADE) |
| `conversation_turns` | 0 | 10 | yes | yes | 2: SELECT/INSERT `auth.uid() = user_id`, authenticated | authenticated, service_role | none | scenario_id→scenarios (CASCADE), snapshot/analysis_snapshot→scenario_snapshots (NO ACTION) |
| `v5_conversation_turns` | 1543 | 12 | yes | **no** | 1: SELECT `auth.uid() = user_id`, **role public** | **anon**, authenticated, service_role | none | scenario_id→scenarios (CASCADE) |
| `v5_handler_facts` | 496 | 10 | yes | **no** | 1: SELECT `auth.uid() = user_id`, **role public** | **anon**, authenticated, service_role | none | v5_conversation_turn_id→v5_conversation_turns (CASCADE), scenario_id→scenarios (CASCADE) |

Findings:
- `conversation_turns` is at full shape (10 columns, RLS, FORCE, 2 policies) but has **0 rows**: the read path is unwired (surface-recon §2) and the V5 turn flow does not write it.
- `scenarios.thread` column is **absent** live (see §6), so the shared-thread privacy path in the spec is inert.
- `v5_conversation_turns` and `v5_handler_facts` carry the live per-user conversation and fact data and are the privacy-sensitive tables under SEC-10, yet they are the two that lack FORCE RLS, target role `public` in their SELECT policy, and grant `anon` full DML. This is the hardening cluster H-1+ (see §8).
- All eleven in-scope policies use `auth.uid() = user_id`, confirming the single-user baseline the migration must convert to workspace membership.

---

## 6. Function and RPC verification

Of the 15 RPCs the spec tracks, **13 are present** in the live public schema (all SECURITY DEFINER). Signatures confirmed for: `append_scenario_event`, `append_turn_atomic`, `apply_patch_and_log`, `create_shared_brief`, `create_snapshot`, `ensure_scenario_exists`, `get_shared_brief_by_slug`, `insert_conversation_turn`, `set_stage_and_log`, `store_analysis_and_log`, `store_analysis_failure`, `store_brief_and_log`, `store_draft_graph`.

**Two are absent:** `append_thread_entries` and `update_thread_block_state`. No thread-named function exists, and the `scenarios.thread` column is absent. This means migration `20260308000000_thread_persistence.sql` (which adds the column and both RPCs) was **never applied** to this project. This is a concrete repo-versus-live drift.

Consequence: the conversation thread persistence the surface-recon audit and spec §11 describe does not function live. Durable conversation history exists only server-side in `v5_conversation_turns` (per-user). The UI conversation is effectively in-memory live, because neither persistence path is active (the `scenarios.thread` writer RPC is absent, and `conversation_turns` is unwritten).

**`create_shared_brief` duplicate resolved:** the live body declares `v_scenario scenarios%ROWTYPE; v_shared_id UUID; v_slug TEXT;` and uses `RETURNING id INTO v_shared_id`. Per phase-0 §3.3, the `v_shared_id` local variable is the marker of the `olumi-assistants-service` (CEE) variant, not the UI variant. So the **CEE-repo definition is the one live**. Its ownership check is `WHERE id = p_scenario_id AND user_id = auth.uid()`, which is the predicate the workspace migration must convert (§8 of the spec).

**CEE service-role RPCs present here:** `append_turn_atomic`, `ensure_scenario_exists`, `store_draft_graph` all exist in `etmmuzwxtcjipwphdola`, confirming the CEE writes to this same project with the service-role key and that the spec's §9 caller-layer requirements apply to live code paths.

---

## 7. Migration-readiness verdict

- Environment identity: **resolved enough to name the target** (`etmmuzwxtcjipwphdola`); formal prod/staging label and rehearsal-environment provisioning are pending Paul (§2).
- Namespace gate: **pass.** No planned name exists live; only conceptual overlaps, avoidable by using the fresh names.
- Orphan-table gate: **pass with actions.** Orphans do not collide directly or block; record a disposition per overlapping orphan and confirm provenance.
- FORCE RLS hardening confirmed: **yes.** `v5_conversation_turns` and `v5_handler_facts` lack FORCE RLS (plus public-role policy and anon grants, H-1+).
- `conversation_turns` privacy risk confirmed: **reframed to latent, not live.** The shared `scenarios.thread` column does not exist live, so the per-scenario-shared-thread leak is inert today; the code is primed to activate it only if that column is later added. The per-user store `v5_conversation_turns` holds the real data and needs the H-1+ hardening before multi-tenancy.
- Can the Tenancy and RLS migration spec v1.3 progress to Codex/security review unchanged? **No.** It must be amended first (§8). The corrections are material (an assumed column and two RPCs do not exist live; the hardening surface is larger than stated; no rehearsal environment exists).

---

## 8. Required spec changes (v1.3 amendments)

1. **Correct §11 / T-1 (conversation thread).** State that `scenarios.thread` and the `append_thread_entries`/`update_thread_block_state` RPCs are absent live (migration `20260308000000` unapplied), so the per-scenario-shared-thread risk is latent, not live. Reframe the precondition: the durable per-user conversation store is `v5_conversation_turns`; if `scenarios.thread` is ever introduced, it must be per-user or not rendered as the private thread. Do not assume `conversation_turns` is in use (0 rows).
2. **Expand H-1 to H-1+ (hardening cluster).** In the switch step, for `v5_conversation_turns` and `v5_handler_facts`: add FORCE RLS, change the SELECT policy role from `public` to `authenticated`, revoke `anon` table grants, and add explicit per-command policies (or keep writes service-role-only with no anon grant). Today's containment relies on RLS being enabled with no permissive write policy; make it defence-in-depth.
3. **Record the migration drift in the §3.3 checklist outcome.** `20260308000000_thread_persistence.sql` is unapplied. Decide whether `scenarios.thread` and its RPCs are part of the forward plan or abandoned, and reconcile the repo migration set with live before writing tenancy SQL. The expand/backfill/switch plan must be written against the live schema, not the repo migration files.
4. **Resolve the duplicate `create_shared_brief` (§3.3).** The live body is the CEE variant (`v_shared_id`). Record this and align the canonical definition before the switch touches `create_shared_brief`.
5. **Strengthen the environment identity gate (§3.1).** Add that no rehearsal environment exists (Olumi-EarlyAccess is an empty stub; the third project is inactive), so a clone or fresh staging project must be provisioned before destructive steps. Add the requirement to confirm the deployed `VITE_SUPABASE_URL`.
6. **Close the namespace gate (§3.2) with the result.** No direct collision; conceptual overlaps with `organisations`/`organisation_members`/`canvas_presence`/`canvas_comments`; the fresh names avoid clashes; orphan dispositions deferred to V1 decommission but recorded.
7. **Note the shared-project fact.** UI and CEE share `etmmuzwxtcjipwphdola`, so the §9 caller-layer enforcement applies to live CEE paths and must land with the policy switch.
8. **Carry forward the `cee_prompt_observations` item.** RLS disabled (0 rows); out of tenancy scope but on the security backlog.

---

## 9. Risks and open decisions

- **No rehearsal environment (highest operational risk).** A destructive tenancy migration would run against the only project holding canonical V5 data. Provision a clone or fresh project first.
- **Environment label unconfirmed.** Until the deployed `VITE_SUPABASE_URL` is confirmed, the prod/staging label rests on inference (staging backends, tiny stale half-test user base). The evidence is consistent and strong, but the final label is Paul's to confirm.
- **Migration drift.** `20260308000000_thread_persistence.sql` is unapplied; the repo migration history does not match live. Other migrations may also diverge; the §3.3 checklist should be run in full before any SQL, not sampled.
- **Orphan provenance unknown.** The `canvas_*` and `organisations` stack has no repo origin. Confirm which codebase created it before any future decommission, to avoid breaking an unknown consumer of the shared project.
- **Anon DML grants on the per-user CEE tables.** Contained today by RLS, but a latent exposure if RLS is ever disabled (FORCE is already off). Fix in H-1+.
- **`cee_prompt_observations` RLS disabled.** 0 rows; latent; security backlog.

---

## Appendix A: base commit and method

- **Branch:** `claude/collab-environment-namespace-verification`, cut from `claude/tenancy-rls-migration-spec-v1_3` (`7b2ce689`), itself from staging `eab0365f`. This audit adds exactly one file. No push.
- **Supabase MCP:** available; used read-only. Projects: `etmmuzwxtcjipwphdola` (deep introspection), `ewyskeampbmbagyclvfn` (table list only, stub), `vaslbdceyqwcgzjlftgi` (inactive, not introspected, not woken).
- **Introspection performed:** `pg_class` (RLS/FORCE/approx rows for all public tables), exact `COUNT(*)` for orphan and V5 tables, `pg_policies` (predicates and roles), `pg_proc` (signatures and SECURITY DEFINER for 15 RPCs), `pg_get_functiondef` for `create_shared_brief`, `information_schema` columns/FKs/triggers/grants, and `auth.users` counts only.
- **PII:** none reproduced. Only counts, dates, domains-count, schema metadata, and one function body (no user data).
- **Constraints honoured:** read-only; no implementation; no SQL migration files; no code/prompt/config/generated edits; no push; British English; sentence case; no em dashes.

## Appendix B: raw query outputs (redacted)

**Projects (list_projects):** `etmmuzwxtcjipwphdola` (Olumi, us-east-1, active), `ewyskeampbmbagyclvfn` (Olumi-EarlyAccess, eu-west-2, active), `vaslbdceyqwcgzjlftgi` (sb1-8t1bpc, inactive). Olumi-EarlyAccess public tables: `early_access` (0 rows).

**auth.users (Olumi):** total 16, probable test about 8, distinct domains 7, oldest signup 2025-02-03, newest 2025-07-19.

**Exact counts (Olumi):** canvases 23, canvas_blocks 164, canvas_comments 36, canvas_versions 46, canvas_version_comments 10, canvas_permissions 24, canvas_presence 3, organisations 11, organisation_members 14, scenarios 391, shared_briefs 0, scenario_snapshots 0, conversation_turns 0, v5_conversation_turns 1543, v5_handler_facts 496.

**RLS/FORCE for V5 tables:** scenarios (yes/yes, 4 pol), shared_briefs (yes/yes, 1), scenario_snapshots (yes/yes, 2), conversation_turns (yes/yes, 2), v5_conversation_turns (yes/**no**, 1, role public, anon DML grant), v5_handler_facts (yes/**no**, 1, role public, anon DML grant).

**RPCs present (13/15):** append_scenario_event, append_turn_atomic, apply_patch_and_log, create_shared_brief, create_snapshot, ensure_scenario_exists, get_shared_brief_by_slug, insert_conversation_turn, set_stage_and_log, store_analysis_and_log, store_analysis_failure, store_brief_and_log, store_draft_graph. **Absent:** append_thread_entries, update_thread_block_state. **scenarios.thread column:** absent.

**create_shared_brief (live):** SECURITY DEFINER, `search_path = pg_catalog, public`, declares `v_shared_id` (CEE variant), ownership check `id = p_scenario_id AND user_id = auth.uid()`, inserts into `shared_briefs`, returns `{id, slug}`.

**Orphan provenance:** no `CREATE TABLE` for `canvas_*`/`organisations`/`organisation_members` in `supabase/migrations/`; no `src/` references.

---

*End of audit*
