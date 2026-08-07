# Collaboration MVP Phase 0 audit

**Brief:** COLLAB-PHASE0-AUDIT-v1
**Date:** 2026-05-09
**Branch:** `claude/collab-phase0-audit` (DecisionGuideAI)
**Status:** Complete; read-only investigation
**Method:** Migration-file and source inspection. Live database state was not introspected (Supabase MCP not available in this environment); see §7.

---

## 1. Executive summary

### Branch decision

**Recommendation: Branch B.** The Tenancy and RLS Migration Spec v1.1 should be finalised as written, with new `workspaces`, `workspace_members`, and `workspace_invites` tables. The existing `teams` / `team_members` / `team_invitations` infrastructure is V1-era, wired only to the legacy `decisions` flow, and does not cover any V5 path (`scenarios`, `shared_briefs`, `v5_conversation_turns`, `v5_handler_facts`, `conversation_turns`, `scenario_snapshots`). Branch A's reuse criterion ("live tenancy tables present, used by V5 paths, with usable role concept") is not met.

The teams system is, however, non-trivial: live UI under `/teams/*`, dedicated context, invite Edge Function, three migration files for invitations. It must be addressed as a separate decision (see §7, item 1).

### `v5_handler_facts` privacy decision

**Recommendation: per-user scope (default in spec). Do not widen.** Phase 1 exploration suggested the payloads were deterministic handler outputs and therefore workspace-shareable. Closer inspection of the typed payload schemas (`olumi-schemas/src/orchestrator/handler-results.ts`) shows that `RunAnalysisResult.summary`, `ExplainResultResult.narrative`, `CompareOptionsResult.narrative`, and `WhatWouldFlipResult.narrative` are AI-generated free-text fields shaped by the user's question on that turn. Plus `enrichment` is an open record of unknown structure. This places handler-fact narratives in the same privacy class as `v5_conversation_turns` content under SEC-10 (scope contract §10): "User A's row appears in User B's context - must be impossible." Workspace-wide widening is not safe.

A consequence not in the spec: the CEE turn-context builder (`build-turn-context.ts:355-407`) currently reads all facts for a scenario regardless of user. Once scenarios are multi-tenant, this must filter to the current user, not just rely on RLS - service-role calls bypass RLS. See §7, item 6.

### Branch decision table

| Tenancy concept | Classification | Evidence | Consequence for migration spec |
|---|---|---|---|
| `teams` + `team_members` | Live, **not reusable for V5** | `supabase/migrations/20250512143948_stark_coast.sql`, `20250514144647_steep_lab.sql`; `src/contexts/TeamsContext.tsx`; tied to `decisions` table only | Branch B. Teams stay as parallel V1 system or get deprecated; see §7 |
| `team_invitations` + `send-team-invite` Edge Function | Live, **not reusable for V5** | `supabase/migrations/20250513213526_foggy_pebble.sql` and two more; `supabase/functions/send-team-invite/index.ts` | Branch B. Workspace invites are a new system; the existing invite plumbing is V1-only |
| `decisions` (with `team_ids` UUID array) | Live but legacy | `supabase/migrations/20250125182637_quiet_mountain.sql`; queried by `src/components/Analysis.tsx`, `src/components/decisions/DecisionEdit.tsx` | Out of V5 scope; not migrated |
| `user_profiles` | Live, no tenancy fields | `supabase/migrations/20250125185608_tight_garden.sql`; `20260306000000_auth_hub_profiles.sql:11-16` | Not tenancy. Personal preferences only |
| Anything in `olumi-schemas` | None | grep across `src/` returns no tenancy types | Schemas package is tenancy-free; safe to extend |
| Anything in `plot-lite-service` | None | grep across repo | PLoT is tenancy-blind by design |
| Anything in `Inference-Service-Layer` | None | grep across repo | ISL is tenancy-blind by design |

### Headline counts (V5-relevant tables only)

| Surface | Count | Notes |
|---|---|---|
| Tables in scope | 6 | `scenarios`, `shared_briefs`, `scenario_snapshots`, `conversation_turns` (UI), `v5_conversation_turns` (CEE), `v5_handler_facts` (CEE) |
| RLS policies using `auth.uid() = user_id` | 11 | scenarios×4, shared_briefs×1, scenario_snapshots×2, conversation_turns×2, v5_conversation_turns×1, v5_handler_facts×1 |
| `SECURITY DEFINER` RPCs requiring rewrite | 12 user-callable + 3 service-role | UI-side use `auth.uid()`; CEE-side derive `user_id` from `scenarios.user_id` and use service-role grants |
| Client filter sites with explicit `.eq('user_id', …)` (V5-relevant) | 1 | `src/services/scenarioService.ts:107` |
| Client direct `.from()` queries on V5 tables | 11 (UI) + 4 (CEE) | UI relies on RLS; CEE bypasses RLS as service-role |
| Code paths impacted (UI + CEE) | ~25 files | See §6 |
| Storage buckets with user-scoped access | 0 | None defined in migrations |
| Edge Functions with user-scoped logic | 1 of 5 | `delete-account` queries by user_id |

### Blocks migration spec finalisation: **No**

The spec can be finalised on Branch B as written, with three non-blocking augmentations described in §7:

1. The teams-system disposition (decision required, not blocker)
2. CEE service-role RPCs need a different rewrite pattern than the spec's helper-substitution model, because they don't use `auth.uid()`
3. CEE turn-context builder needs an explicit per-user filter at service-role level, not relying on RLS

These are findings the spec should incorporate, not reasons to delay sign-off.

---

## 2. Existing tenancy inventory (Question A)

### 2.1 `teams` and `team_members`

Created by `supabase/migrations/20250512143948_stark_coast.sql:29-46`. Iteratively hardened across May 2025:

- `20250512143948_stark_coast.sql` - initial table, RLS, policies
- `20250512152206_odd_king.sql` - adds `is_team_admin(team_id uuid)` helper
- `20250512183000_fix_teams_select_policy.sql` - policy fix
- `20250513173826_gentle_shrine.sql`, `20250513204516_broad_ember.sql`, `20250514144647_steep_lab.sql` - non-recursive policies, `check_team_admin_access` and `check_team_member_access` helper functions

**Schema (final state):**

```
teams (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL → auth.users(id),
  created_at timestamptz, updated_at timestamptz
)

team_members (
  id uuid PRIMARY KEY,
  team_id uuid NOT NULL → teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL → auth.users(id),
  role text NOT NULL CHECK (role IN ('admin','member')),
  joined_at timestamptz,
  UNIQUE (team_id, user_id)
)
```

**RLS:** enabled on both. Helpers `check_team_admin_access(team_uuid)` and `check_team_member_access(team_uuid)` exist and follow the `EXISTS (SELECT 1 FROM team_members WHERE … AND user_id = auth.uid())` pattern that the migration spec's `is_workspace_member()` would replace.

**UI integration:** active. `src/contexts/TeamsContext.tsx` provides the React context. Dedicated UI under `src/components/teams/` (CreateTeamModal, EditTeamModal, TeamDetails, MyTeams, ManageTeamMembersModal). Routes mounted in `src/App.tsx:250-262` (`/teams`, `/teams/:teamId`).

### 2.2 `team_invitations`

Three migration files: `20250513213526_foggy_pebble.sql`, `20250513221801_misty_wave.sql`, `20250514133805_jade_wood.sql`. Live RPC `get_team_invitations(team_uuid)` referenced from `src/contexts/TeamsContext.tsx:238`. Email delivery through Edge Function `supabase/functions/send-team-invite/index.ts`, which uses Brevo API and reads `team_id`, `team_name`, `inviter_id` from the request body.

### 2.3 `decisions` (legacy)

`supabase/migrations/20250125182637_quiet_mountain.sql` defines the V1 `decisions` table. Migration `20250512143948_stark_coast.sql:49` adds `decisions.team_ids uuid[]` for team-scoped decision sharing. Queried by `src/components/Analysis.tsx`, `src/components/decisions/DecisionEdit.tsx`, `src/lib/database.test.ts`, `src/lib/supabase.ts`. The V1 invite UX (`src/components/InviteCollaborators.tsx:9-29`) takes a `decisionId` and calls `useTeams().inviteTeamMember(decisionId, email, 'member', role)` - note the parameter name `decisionId`.

### 2.4 V5 path tenancy: absent

No 2026 migration adds `team_id`, `workspace_id`, `organisation_id`, or `tenant_id` to any V5 table:

- `scenarios` v2 (`20260226000000_scenario_schema_v2.sql:8-27`): only `user_id`. Confirmed by grep across all `2026*.sql`.
- ALTER TABLE on scenarios after v2: only `last_turn_nonce`, `is_pinned`, `is_archived`, `source_scenario_id`, `thread`, `latest_analysis_summary`, plus `user_id` default = `auth.uid()` and FORCE RLS.
- `shared_briefs`, `scenario_snapshots`, `conversation_turns`, `v5_conversation_turns`, `v5_handler_facts`: all `user_id`-only.
- No code path co-references `scenarios` and `team_id` (grep `scenarios.*team_id|team_id.*scenarios` returns nothing across UI and CEE source).

### 2.5 Other repos

- `olumi-assistants-service` (CEE): comments mention "tenant drift" and "cross-tenant ownership check" (`20260421000000_v5_ensure_scenario_exists.sql:17,74`; `20260422000000_v5_guest_mode_nullable_user_id.sql:108`) but these refer to the single-user `scenarios.user_id` boundary. No tenancy tables.
- `plot-lite-service`: no tenancy keywords.
- `Inference-Service-Layer`: no tenancy keywords.
- `olumi-schemas`: grep for `WorkspaceId|TeamId|MembershipRole|workspace_id|team_id` returns nothing in `src/`.

### 2.6 Conclusion (Question A)

Existing tenancy infrastructure is real, role-aware, and live. It does not satisfy Branch A's "used by V5 paths" criterion. Branch B is the recommendation, with the teams-system disposition handled separately as a deferred decision (§7, item 1).

---

## 3. Access-control inventory (Question B, part 1)

### 3.1 RLS predicates on V5-relevant tables

All policies below filter by `auth.uid() = user_id` (or its `user_id = auth.uid()` reverse form in RPC bodies). Listed in the order the migrations apply.

| Table | Command | Policy name | Predicate | Source migration:line | Roles | Notes |
|---|---|---|---|---|---|---|
| `scenarios` | SELECT | "Users can read own scenarios" | `auth.uid() = user_id` | `DecisionGuideAI/supabase/migrations/20260307000000_rls_audit_hardening.sql:26` | `authenticated` only | Hardened; replaced original |
| `scenarios` | INSERT | "Users can insert own scenarios" | `auth.uid() = user_id` (WITH CHECK) | …`20260307000000_rls_audit_hardening.sql:33` | `authenticated` | |
| `scenarios` | UPDATE | "Users can update own scenarios" | `auth.uid() = user_id` (USING + WITH CHECK) | …`20260307000000_rls_audit_hardening.sql:40-41` | `authenticated` | WITH CHECK prevents user_id reassignment |
| `scenarios` | DELETE | "Users can delete own scenarios" | `auth.uid() = user_id` | …`20260307000000_rls_audit_hardening.sql:48` | `authenticated` | |
| `shared_briefs` | SELECT | "Users can read own shared briefs" | `auth.uid() = user_id` | …`20260307000000_rls_audit_hardening.sql:55` | `authenticated` | No INSERT/UPDATE policy - write via `create_shared_brief` RPC only |
| `scenario_snapshots` | SELECT | `select_own_snapshots` | `auth.uid() = user_id` | …`20260309000000_scenario_snapshots.sql:33` | `authenticated` | FORCE RLS |
| `scenario_snapshots` | INSERT | `insert_own_snapshots` | `auth.uid() = user_id` | …`20260309000000_scenario_snapshots.sql:35` | `authenticated` | Immutable; no UPDATE/DELETE policy by design |
| `conversation_turns` | SELECT | `select_own_turns` | `auth.uid() = user_id` | …`20260309000001_conversation_turns.sql:32` | `authenticated` | FORCE RLS |
| `conversation_turns` | INSERT | `insert_own_turns` | `auth.uid() = user_id` | …`20260309000001_conversation_turns.sql:34` | `authenticated` | Append-only; no UPDATE/DELETE |
| `v5_conversation_turns` | SELECT | "Users can read own v5 conversation turns" | `auth.uid() = user_id` | `olumi-assistants-service/supabase/migrations/20260417160000_v5_session_store.sql:84` | (default - public) | ENABLE only, **no FORCE** |
| `v5_handler_facts` | SELECT | "Users can read own v5 handler facts" | `auth.uid() = user_id` | …`20260417160000_v5_session_store.sql:89` | (default - public) | ENABLE only, **no FORCE** |

**Total:** 11 policies. All use `auth.uid() = user_id`.

**`anon` access:** revoked on `scenarios`, `shared_briefs`, `scenario_snapshots`, `conversation_turns` (`20260307000000:11-12`, `20260309000000:42`, `20260309000001:45`). Not explicitly revoked on `v5_conversation_turns` and `v5_handler_facts`, though RLS makes them unreadable to `anon` regardless.

**FORCE RLS posture:** asymmetric. UI-side V5 tables and `scenarios`, `shared_briefs`, `user_profiles`, `turn_observations` use FORCE RLS (`20260306000000_auth_hub_profiles.sql:107-113`; `20260309000000:28`; `20260309000001:27`). CEE-side `v5_conversation_turns` and `v5_handler_facts` use ENABLE only (`20260417160000:78-79`). This is a hardening gap independent of the migration; flagged in §7, item 7.

No predicates use `created_by`, `owner_id`, `profile_id`, `current_setting`, `request.jwt.claim.sub`, or `auth.jwt()` as primary access keys for V5-relevant tables. The pattern is uniformly `auth.uid() = user_id` (where `user_id` is the column). Helpers `check_team_admin_access` and `check_team_member_access` exist but only for V1 teams; they don't apply to scenarios.

### 3.2 `SECURITY DEFINER` RPCs requiring rewrite

V5-relevant only. The UI repo has many other V1-era SDFs (teams, decisions, profile triggers, the auth-hub trigger) that are out of migration scope.

**UI-callable (caller has user JWT; RPC asserts ownership via `auth.uid()`):**

| # | Function | Source:line | Ownership predicate | Touches | Caller |
|---|---|---|---|---|---|
| 1 | `append_scenario_event` | `DecisionGuideAI/supabase/migrations/20260226000000_scenario_schema_v2.sql:84` | `WHERE id = p_scenario_id AND user_id = auth.uid()` | `scenarios.events`, `scenarios.event_seq` | `src/services/scenarioService.ts:72,412` |
| 2 | `apply_patch_and_log` | …`20260226000000:149` | same | `scenarios.graph` + events | `src/services/scenarioService.ts:381` |
| 3 | `store_analysis_and_log` | …`20260226000000:185` | same | `scenarios.analysis*` + events | `src/services/scenarioService.ts:270` |
| 4 | `store_analysis_failure` | …`20260226000000:237` | same | `scenarios.analysis_error` + events | `src/services/scenarioService.ts:300` |
| 5 | `store_brief_and_log` | …`20260226000000:275` | same | `scenarios.brief` + events | `src/services/scenarioService.ts:326` |
| 6 | `set_stage_and_log` | …`20260226000000:307` | same | `scenarios.stage` + events | `src/services/scenarioService.ts:352` |
| 7 | `create_shared_brief` | …`20260226000000:358` and `20260226010000:21` | `WHERE id = p_scenario_id AND user_id = auth.uid()` | `shared_briefs` insert | `src/services/scenarioService.ts:457` |
| 8 | `get_shared_brief_by_slug` | …`20260226000000:412` | **none** - slug + expiry only | reads `shared_briefs` | `src/services/scenarioService.ts:480`; granted to `anon` and `authenticated` |
| 9 | `create_snapshot` | …`20260309000000_scenario_snapshots.sql:51` | inner check `WHERE id = p_scenario_id AND user_id = auth.uid()` (line 69) | `scenario_snapshots` insert | `src/services/threadService.ts:111` |
| 10 | `append_thread_entries` | …`20260308000000_thread_persistence.sql:27` | (uses scenarios with `auth.uid()`) | `scenarios.thread` JSONB | `src/services/threadService.ts:37` |
| 11 | `update_thread_block_state` | …`20260308000000:102` | same | `scenarios.thread` JSONB | `src/services/threadService.ts:74` |
| 12 | `insert_conversation_turn` | …`20260309000001_conversation_turns.sql:53` | inner check (line 70) | `conversation_turns` insert | `src/services/threadService.ts:161` |

All twelve are GRANTed to `authenticated` and REVOKEd from `PUBLIC`/`anon` (`20260226000000:445-475`; equivalent grants per file for the others). `get_shared_brief_by_slug` is the only one granted to `anon` - by design, for the public `/brief/:slug` route. Its body returns `brief, graph_hash, seed_used, response_hash, created_at, expires_at` only (no `user_id`, `scenario_id`, `workspace_id`); already SEC-17 compliant in the spec's terminology.

**CEE service-role-only (no `auth.uid()`; trusted caller passes IDs):**

| # | Function | Source:line | Ownership pattern | Touches | Caller |
|---|---|---|---|---|---|
| 13 | `append_turn_atomic` | latest version: `olumi-assistants-service/supabase/migrations/20260505120000_v5_pending_actions.sql:112` | `SELECT user_id FROM scenarios WHERE id = p_scenario_id` then writes that derived `v_user_id` to v5 tables | `v5_conversation_turns`, `v5_handler_facts`, `scenarios.graph` | `olumi-assistants-service/src/orchestrator-v5/session/supabase-store.ts:103-116` (via `serialiseHandlerFacts` adapter) |
| 14 | `ensure_scenario_exists` | latest: `olumi-assistants-service/supabase/migrations/20260422000000_v5_guest_mode_nullable_user_id.sql:71` | takes `p_user_id` as arg; idempotent upsert | `scenarios` | service-role only (`REVOKE FROM PUBLIC; GRANT TO service_role`) |
| 15 | `store_draft_graph` | `olumi-assistants-service/supabase/migrations/20260422120000_v5_store_draft_graph.sql:29` | (same service-role pattern) | `scenarios.graph` | service-role only |

These three do not reference `auth.uid()` because the CEE invokes them with the service-role key. Membership semantics must be enforced in the CEE caller layer (`supabase-store.ts`), not in the RPC body. The spec's helper-substitution rewrite (`is_workspace_member(workspace_id)`) does not apply directly to them; the rewrite for these is "CEE asserts membership for the authenticated end-user before calling the RPC."

The migration spec's §6 RPC inventory should add this distinction: user-callable vs service-role-only, with two different rewrite patterns. See §7, item 5.

**Total V5-relevant SDFs needing rewrite or scope-confirm: 15** (12 user-callable, 3 service-role).

### 3.3 Same-name migration in two repos

`20260226010000_scenario_schema_v2_0_1_hardening.sql` exists in **both** `DecisionGuideAI/supabase/migrations/` and `olumi-assistants-service/supabase/migrations/`. The bodies differ slightly:

- UI version has a "Depends on:" line; CEE version does not
- CEE version declares an additional local variable `v_shared_id`

Both define `create_shared_brief` with `CREATE OR REPLACE`. When applied to the same Supabase project in different orders, one definition wins; subsequent migrations from the other repo could redefine the function differently. This is a hygiene risk now and a migration risk during cutover. See §7, item 8.

### 3.4 Client filter sites with explicit `.eq('user_id', …)`

V5-relevant: 1 site.

| File:line | Context | Notes |
|---|---|---|
| `src/services/scenarioService.ts:107` | scenario fetch | the only place V5 client code filters by `user_id` directly |

Out-of-V5-scope: 3 sites.

| File:line | Context | Notes |
|---|---|---|
| `src/contexts/TeamsContext.tsx:141,158` | V1 teams membership query | follows teams-decision in §7 |
| `src/lib/supabase.ts:238` | typed-cast utility | branded ID cast, not access-control |

### 3.5 Direct `.from()` queries on V5 tables

Relies on RLS for filtering, no explicit `user_id` predicate.

**UI** (`src/services/scenarioService.ts`): 11 `.from('scenarios')` sites at lines 53, 105, 130, 157, 179, 200, 221, 243, 436, 504, 522.

**CEE** (`src/orchestrator-v5/session/supabase-store.ts`):
- `v5_conversation_turns`: lines 156, 371
- `v5_handler_facts`: line 229
- `scenarios`: line 338

CEE uses the service-role key; RLS is bypassed. Membership enforcement must therefore live in the CEE service code, not rely on RLS. See §7, item 6.

### 3.6 Schemas package, Storage, Edge Functions

- **`olumi-schemas`**: no tenancy assumptions. `WorkspaceId`, `TeamId`, `MembershipRole`, `workspace_id`, `team_id` all return nothing under `src/`. The package is tenancy-blind and can be extended with workspace types non-disruptively.
- **Storage:** no `storage.objects` or `storage.buckets` policies in any migration. No buckets defined. No user-scoped storage assumptions.
- **Edge Functions** (`DecisionGuideAI/supabase/functions/`):
 - `assist-proxy`, `models-proxy`, `openai-proxy`: no `user_id` access patterns; relay LLM calls
 - `delete-account` (lines 87, 111): queries by `user_id` for cleanup. After migration, must also resolve workspace membership cascade (a user being removed is not necessarily the deletion of their workspaces)
 - `send-team-invite`: V1 teams flow, follows the teams decision

---

## 4. Current schema snapshot (Question B, part 2)

Each subsection lists current columns, RLS state, grants, and a privacy classification.

### 4.1 `scenarios` (UI)

```
scenarios (
  id                       uuid PK,
  user_id                  uuid NOT NULL → auth.users(id), DEFAULT auth.uid(),
  title                    text,
  scenario_schema_version  int  NOT NULL DEFAULT 1,
  stage                    text NOT NULL CHECK ∈ {frame,ideate,evaluate,decide,optimise},
  graph                    jsonb,
  framing                  jsonb,
  analysis_status          text NOT NULL CHECK ∈ {none,running,ready,failed},
  analysis                 jsonb,
  analysis_error           jsonb,
  analysis_provenance      jsonb,
  events                   jsonb NOT NULL DEFAULT '[]'::jsonb,
  event_seq                int  NOT NULL DEFAULT 0,
  brief                    jsonb,
  is_pinned                bool NOT NULL DEFAULT false,
  is_archived              bool NOT NULL DEFAULT false,
  source_scenario_id       uuid → scenarios(id) ON DELETE SET NULL,
  thread                   jsonb NOT NULL DEFAULT '[]'::jsonb,
  latest_analysis_summary  jsonb,
  last_turn_nonce          int  NOT NULL DEFAULT 0,
  brief_text               text,  -- V5 brief persistence
  created_at, updated_at   timestamptz
)
```

Indexes: `idx_scenarios_user_id`, `idx_scenarios_updated_at`. Trigger: `scenarios_updated_at` (BEFORE UPDATE → `update_updated_at()`).

RLS: enabled, FORCE. 4 policies (§3.1). REVOKE ALL FROM `anon` applied (`20260307000000:11`).

**Privacy classification: workspace-shared after migration.** Scenario content (graph, framing, analysis, brief, stage) is the collaborative artefact. All workspace members must be able to read it.

### 4.2 `shared_briefs` (UI)

```
shared_briefs (
  id              uuid PK,
  scenario_id     uuid NOT NULL → scenarios(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL → auth.users(id),
  brief           jsonb NOT NULL,
  graph_hash      text  NOT NULL,
  seed_used       int   NOT NULL,
  response_hash   text  NOT NULL,
  slug            text  UNIQUE NOT NULL,
  created_at      timestamptz NOT NULL,
  expires_at      timestamptz
)
```

RLS: enabled, FORCE. 1 SELECT policy. INSERT only via `create_shared_brief` RPC. REVOKE from `anon`.

**Privacy classification: public-by-RPC (slug-keyed) + workspace-shared (authenticated reads).** The public route uses `get_shared_brief_by_slug` which already excludes `user_id`/`scenario_id` (SEC-17). After migration: workspace members can read the row; public-by-slug behaviour preserved.

### 4.3 `scenario_snapshots` (UI)

```
scenario_snapshots (
  id              uuid PK,
  scenario_id     uuid NOT NULL → scenarios(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL → auth.users(id),
  graph           jsonb NOT NULL,
  analysis        jsonb,
  brief_text      text,
  brief_hash      text,
  seed            bigint,
  quality_mode    text,
  graph_hash      text,
  created_at      timestamptz NOT NULL
)
```

Index: `idx_snapshots_scenario(scenario_id, created_at DESC)`. RLS: enabled, FORCE. 2 policies (SELECT, INSERT - no UPDATE/DELETE; immutable; cascade from scenarios). REVOKE from `anon`.

**Privacy classification: workspace-shared after migration.** Snapshots are the immutable review artefact (scope contract §4.5). Reviewer permission requires read access.

### 4.4 `conversation_turns` (UI, BIL Phase 1, Mar 2026)

```
conversation_turns (
  id                   uuid PK,
  scenario_id          uuid NOT NULL → scenarios(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL → auth.users(id),
  snapshot_id          uuid → scenario_snapshots(id),
  analysis_snapshot_id uuid → scenario_snapshots(id),
  role                 text NOT NULL CHECK ∈ {user,assistant,system},
  content              text,
  structured_blocks    jsonb,
  client_turn_id       text,  -- idempotency key
  created_at           timestamptz NOT NULL
)
```

Indexes: `idx_turns_scenario(scenario_id, created_at ASC)`, `idx_turns_idempotency(scenario_id, client_turn_id) WHERE client_turn_id IS NOT NULL`. RLS: enabled, FORCE. 2 policies (SELECT, INSERT - append-only; no UPDATE/DELETE; cascade). REVOKE from `anon`.

**Privacy classification: per-user.** `content` is free text (user message or AI response), keyed to one user's session. SEC-10 applies directly: User A's turn must not surface in User B's context. Per-user RLS retained even after multi-tenancy.

### 4.5 `v5_conversation_turns` (CEE, V5 session store, Apr 2026)

```
v5_conversation_turns (
  id               uuid PK,
  scenario_id      uuid NOT NULL → scenarios(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL,            -- denormalised; no FK constraint
  turn_id          text NOT NULL,
  turn_class       text NOT NULL,
  handler_id       text,
  request_hash     text NOT NULL,
  response_emitted bool NOT NULL DEFAULT TRUE,
  llm_calls_used   int  NOT NULL DEFAULT 0,
  duration_ms      int  NOT NULL DEFAULT 0,
  pending_actions  jsonb,                    -- added 20260505120000
  created_at       timestamptz NOT NULL,
  UNIQUE (scenario_id, turn_id)
)
```

Indexes: `(scenario_id, created_at DESC)`, `(user_id, created_at DESC)`. RLS: ENABLE only (**no FORCE**). 1 SELECT policy. No INSERT/UPDATE/DELETE policy - writes via `append_turn_atomic` RPC granted to `service_role` only.

**Privacy classification: per-user (same class as `conversation_turns`).** This is the orchestrator's session store. Each row is keyed to one user's turn; under SEC-10, must not be readable across users.

### 4.6 `v5_handler_facts` (CEE)

```
v5_handler_facts (
  id                       uuid PK,
  v5_conversation_turn_id  uuid NOT NULL → v5_conversation_turns(id) ON DELETE CASCADE,
  scenario_id              uuid NOT NULL → scenarios(id) ON DELETE CASCADE,
  user_id                  uuid NOT NULL,
  handler_id               text NOT NULL,
  action_type              text NOT NULL,
  fact_version             int  NOT NULL DEFAULT 1,
  noop                     bool NOT NULL DEFAULT FALSE,
  payload                  jsonb NOT NULL,
  created_at               timestamptz NOT NULL
)
```

Indexes: `(v5_conversation_turn_id)`, `(scenario_id, handler_id, created_at DESC)`. RLS: ENABLE only (**no FORCE**). 1 SELECT policy. No INSERT/UPDATE/DELETE - writes via `append_turn_atomic`.

**Privacy classification: per-user.** See §5 for the falsification trail. Payloads carry AI-generated narrative shaped by the user's question.

### 4.7 SDF RPC inventory

Listed in §3.2. All twelve user-callable RPCs use `auth.uid() = user_id` against `scenarios` (or `shared_briefs`) as the ownership check, except `get_shared_brief_by_slug` which is intentionally public. The three CEE-side RPCs are service-role only and derive `user_id` from the row.

### 4.8 Resolution: `conversation_turns` vs `v5_conversation_turns`

**Both are live, with overlapping but distinct purposes.**

The `v5_session_store.sql` header (`olumi-assistants-service/supabase/migrations/20260417160000_v5_session_store.sql:7-11`) records that introspection on 2026-04-17 found "an unrelated, incompatible public.conversation_turns sketch (4/11 columns, 0 rows, unknown provenance)" and chose the `v5_` prefix to avoid touching it. That observation reflects the live database state at that moment - it does not say `conversation_turns` is dead. The UI migration `20260309000001_conversation_turns.sql` defines the full 11-column schema, and the UI client uses it actively via `src/services/threadService.ts:161` (`insert_conversation_turn` RPC).

**Current understanding:**

- `conversation_turns` (UI): BIL Phase 1, snapshot-anchored audit trail. Used by UI for thread persistence and snapshot linkage. Linked to `scenario_snapshots` via two FKs.
- `v5_conversation_turns` (CEE): V5 orchestrator session store. Used by CEE for turn-by-turn idempotency, request hashing, llm_calls accounting, pending_actions queue.

These serve different consumers (UI thread persistence vs CEE turn orchestration). They will both need workspace_id added; both keep per-user RLS for content/turn privacy. The "4/11 columns" observation at Apr 17 may indicate the UI migration had not yet been applied to the staging DB visible to CEE introspection at that date, or the staging DB diverged from the migration files. **Verifying live state requires Supabase MCP, which was not available for this audit (§7, item 4).**

---

## 5. `v5_handler_facts` privacy assessment (Question C)

### 5.1 Schema

See §4.6. The relevant column is `payload jsonb NOT NULL`, plus `handler_id`/`action_type`/`fact_version`/`noop` for filtering and `user_id` for RLS.

### 5.2 Write call sites

- `olumi-assistants-service/src/orchestrator-v5/commit.ts:160-173` - `commitDirectAnswer` calls `store.append({…, handler_facts: metadata.handler_facts})`
- `olumi-assistants-service/src/orchestrator-v5/session/supabase-store.ts:103-116` - `SupabaseSessionStore.append()` invokes `append_turn_atomic` RPC with `p_handler_facts: serialiseHandlerFacts(write.handler_facts)`
- `olumi-assistants-service/src/orchestrator-v5/session/supabase-store.ts:496-511` - `serialiseHandlerFacts` adapter splits HandlerFact wire shape: `{handler_id, action_type, noop, payload: {fact_type, fact_version, result}}`
- `olumi-assistants-service/supabase/migrations/20260505120000_v5_pending_actions.sql` (latest `append_turn_atomic`) - RPC body iterates `p_handler_facts` JSONB array and inserts rows in the same transaction as the turn
- `olumi-assistants-service/src/orchestrator-v5/build-turn-context.ts:401-407` - read path: `store.readFactsWithTurnFor(handlerRowIds)` for context building

### 5.3 Payload characterisation by `fact_type`

The discriminated union is defined in `olumi-schemas/src/orchestrator/handler-fact.ts:103-114` and the per-handler result schemas live in `olumi-schemas/src/orchestrator/handler-results.ts`. There are nine fact_types.

| `fact_type` | Result-schema fields | Free-text fields | Notes |
|---|---|---|---|
| `run_analysis` | scenario_id, leading_option_id, win_probabilities, **summary**, enrichment, graph_hash_at_run, computed_at | **summary: z.string()** | AI-generated narrative summary of the analysis |
| `explain_result` (deprecated) | **narrative**, referenced_option_ids, enrichment | **narrative: z.string()** | Free-text explanation; retained for historic rows |
| `explain_results` | precondition_unmet, option_count, answer_source, fallback_reason, answer_text_length, staleness_prefixed | none | Diagnostic metadata only - narrative lives in conversation_turns, not here |
| `explain_from_structure` | option_count, answer_source, fallback_reason, answer_text_length | none | Diagnostic metadata only |
| `compare_options` | options[option_id, label, win_probability, attributes], **narrative (optional)** | **narrative: z.string()** | Narrative is optional; option labels are shared workspace data |
| `what_would_flip` | precondition_unmet, option_count, **narrative (optional)**, flip_scenarios[…], enrichment, answer_source, fallback_reason, answer_text_length, staleness_prefixed | **narrative: z.string()** | Narrative is optional; flip_scenarios are deterministic |
| `set_factor_value`, `add_constraint`, `adjust_edge_strength` | target_id, status (applied/noop), before, after | none | Graph-edit before/after snapshots; no narrative |

**enrichment** is `z.record(z.string(), z.unknown())` on `run_analysis`, `explain_result` (deprecated), and `what_would_flip`. Open-record. The schemas package comment (`handler-results.ts:19-22`) says enrichment carries PLoT-derived fields (factor_sensitivity, flip_thresholds, edge_e_values, m1_coaching, conditional_probabilities). Today these are scenario-level analytical outputs; tomorrow's enrichment fields are not constrained.

### 5.4 Falsification result

Phase 1 exploration concluded "workspace-wide eligible" because the typed schemas excluded an obvious free-text user-input field. That conclusion does not survive close reading.

**Falsifying evidence:**

1. Four fact_types carry AI-generated narrative strings (`run_analysis.summary`, `explain_result.narrative`, `compare_options.narrative`, `what_would_flip.narrative`). These are AI responses to a user's question on that turn. Even when the narrative describes scenario state, the **choice** of which narrative exists (compare X vs Y, what would flip Z) reveals what each user asked. SEC-10 (scope contract §10) states: "User A's `v5_conversation_turns` row appears in User B's context - must be impossible." The narrative content of handler-facts is functionally a response artefact of those turns; the same invariant must apply.

2. `enrichment` is an open record with unspecified future content. Defaulting to per-user is the safer posture against future fields that may carry user-conditioning state.

3. Server-side context-building (`olumi-assistants-service/src/orchestrator-v5/build-turn-context.ts:355-407`) currently reads ALL prior facts for a scenario regardless of user, because today's single-user-per-scenario model makes that equivalent to "this user's facts." After migration, the same call will mix users' facts on a multi-tenant scenario. RLS is bypassed by service-role; the filter must be added in code. See §7, item 6.

### 5.5 Recommendation

**Per-user scope, gated as the spec describes.** Migration spec v1.1 §5.3 should be retained:

```sql
CREATE POLICY "Users read own facts in workspace" ON v5_handler_facts
  FOR SELECT USING (auth.uid() = user_id AND is_workspace_member(workspace_id));
```

The "audit gate" sentence in spec §5.3 ("if Phase 0 audit confirms handler facts contain no private/conversational user context, policies may be widened…") should be **closed**: this audit confirms handler-fact narratives ARE conversational context for SEC-10 purposes. Workspace-wide widening is not safe under the current handler design.

A future audit can revisit this if the narrative-bearing handlers are refactored so the narrative lives in `v5_conversation_turns.content` only (the deprecated `explain_result` already does this; `explain_results`, `explain_from_structure` already do this - only `run_analysis.summary`, `compare_options.narrative`, `what_would_flip.narrative` keep narrative on the fact today).

---

## 6. Code path impact map (Question B, part 3)

### 6.1 UI repo (DecisionGuideAI)

| File | Function / component | Current assumption | Required change | Code effort | Notes |
|---|---|---|---|---|---|
| `src/services/scenarioService.ts` | All scenario CRUD + RPC wrappers | Single-user `auth.uid()` ownership; 11 `.from('scenarios')` sites; 7 RPC calls; 1 explicit `.eq('user_id')` at line 107 | Add `workspace_id` to inputs/outputs; remove `.eq('user_id')` (RLS will handle); update RPC signatures | M | Primary surface |
| `src/services/threadService.ts` | Thread + snapshot + turn persistence | Same single-user assumption; 4 RPC calls (`append_thread_entries`, `update_thread_block_state`, `create_snapshot`, `insert_conversation_turn`) | Update RPC signatures and pass `workspace_id` | M | |
| `src/hooks/useScenario.ts` | Scenario fetch hook | Reads via service; relies on RLS | Trivial - works once RLS rewrites | S | |
| `src/hooks/useAsk.ts` | Ask flow | Per-scenario; relies on RLS | Trivial - verify post-migration | S | |
| `src/hooks/hydrateAnalysis.ts` | Analysis hydration | Reads via service | Trivial - verify | S | |
| `src/canvas/store/scenarios.ts` | Scenario store (zustand) | Holds scenario state | Verify workspace context propagation | S | |
| `src/canvas/conversation/useConversation.ts` | Conversation flow | Calls `insert_conversation_turn`, reads thread | Pass workspace context | M | |
| `src/canvas/conversation/hooks/useThreadPersistence.ts` | Thread persistence | Wraps threadService | Trivial - works once service rewrites | S | |
| `src/canvas/ReactFlowGraph.tsx` | Canvas component | Receives scenario via props | Trivial | S | |
| `src/canvas/store.ts` | Canvas state | Per-scenario state | Trivial | S | |
| `src/components/ResultsPanel.tsx`, `SandboxStreamPanel.tsx`, `StreamParametersPanel.tsx` | Results/stream panels | Per-scenario; relies on services | Trivial | S | |
| `src/lib/supabase.ts` | Supabase client + helpers (`.eq('user_id')` at 238) | Branded ID typing | Trivial review; not access-control | S | |
| `src/contexts/TeamsContext.tsx` + `src/components/teams/*` | V1 teams system | Tied to `decisions`, not V5 | Depends on teams decision (§7, item 1) | - | Not part of V5 migration |

UI total: ~13 files in V5 path, plus ~7 in V1 teams (out of V5 scope).

### 6.2 CEE repo (olumi-assistants-service)

| File | Function | Current assumption | Required change | Code effort | RPC-signature impact |
|---|---|---|---|---|---|
| `src/orchestrator-v5/session/supabase-store.ts` | `append()`, `readFactsFor*`, `readPriorTurns`, `getOwner` | Service-role bypasses RLS; trusted IDs; `getOwner` returns `{user_id}` only | Pass `workspace_id` to `append_turn_atomic`; resolve membership for caller before write; add workspace_id to scenarios reads | M | **Args change** - `append_turn_atomic` adds `p_workspace_id`; `ensure_scenario_exists` adds `p_workspace_id` |
| `src/orchestrator-v5/build-turn-context.ts` | `loadPriorFacts`, context assembly | Reads ALL facts for scenario; today equivalent to "this user's facts" because scenarios are single-user | After migration, must filter facts by `user_id = current_user` even at service-role level | M | **None** (caller-side filter) |
| `src/orchestrator-v5/commit.ts` | `commitDirectAnswer`, fact emission | Calls store.append; doesn't directly touch tenancy | Receives workspace_id via context | S | None |
| `src/orchestrator-v5/compose.ts` | Response composition | Reads `prior_facts` from context | Trivial | S | None |
| `src/orchestrator-v5/turn-executor.ts` | Turn execution loop | Receives scenario context | Pass workspace_id through | S | None |
| `src/orchestrator-v5/turn-outcome.ts` | Outcome envelope | Carries handler facts | Trivial | S | None |
| `src/orchestrator-v5/types/handler-fact.ts`, `tools/handler-outcome.ts`, `tools/registry.ts` | Type definitions, registry | Tenancy-blind | None | S | None |

CEE total: ~7 files. Two with non-trivial change (`supabase-store.ts`, `build-turn-context.ts`), the rest pass-through.

### 6.3 PLoT and ISL repos

No changes required. Both services receive scenario+graph payloads and return analysis. Tenancy-blind by design. Confirmed by grep across both repos.

### 6.4 Edge Functions

| Function | Current assumption | Required change | Effort |
|---|---|---|---|
| `delete-account` | Cleans up by `user_id` (lines 87, 111) | Resolve workspace memberships on user deletion (remove from workspaces, transfer ownership of personal-tenant scenarios per spec, etc.) | M |
| `assist-proxy`, `models-proxy`, `openai-proxy` | None | None | - |
| `send-team-invite` | V1 teams flow | Follows teams decision | - |

### 6.5 olumi-schemas

No changes required for the migration itself. The package will need new tenancy types (`WorkspaceId`, `MembershipRole`, etc.) added when the implementation brief dispatches; the audit confirms there are no conflicting existing types.

---

## 7. Risk and unknowns

### 7.1 Disposition of the existing teams system

The teams + team_members + team_invitations + send-team-invite ecosystem is live, well-developed (admin/member roles, RLS helpers, dedicated UI under `/teams`), and tied exclusively to the legacy `decisions` flow. The V5 collaboration MVP introduces a parallel `workspaces` model. Three options for Paul:

| Option | What it means | Pros | Cons |
|---|---|---|---|
| **A: Leave as-is** | Workspaces ships parallel to teams. Teams stays for the V1 decisions flow | Lowest migration risk; no rework on V1 surfaces | Two parallel "groups of users" concepts; user confusion; UX duplication; no path to consolidation |
| **B: Deprecate teams** | Hide `/teams` UI, freeze invites, plan removal once decisions are sunset | Cleaner long-term; signals direction | Requires V1 decisions deprecation timeline; users on teams may feel abandoned |
| **C: Fold teams into workspaces** | Migrate `teams` → `workspaces` (rename), `team_members` → `workspace_members` (rename + role mapping admin/member → owner/admin/editor/viewer), `team_invitations` → `workspace_invites`, port `send-team-invite` | Single canonical tenancy model; preserves existing UX investment | Requires backfill mapping; the legacy `decisions.team_ids` array becomes orphan data unless decisions also map to workspaces; more migration work |

The audit lays out the options. Choosing one is a product/architecture decision outside the audit's scope. The migration spec can finalise on Branch B independent of the choice; the teams decision can be sequenced after.

### 7.2 Phase 1 finding for `v5_handler_facts` was wrong

Phase 1 leaned toward "workspace-wide eligible." Closer inspection of the typed payload schemas (`olumi-schemas/src/orchestrator/handler-results.ts`) shows narrative free-text on four fact_types. The audit's recommendation is per-user scope (matching the spec default). **Spec §5.3 should drop the "audit gate" sentence that contemplated widening.**

### 7.3 Tables not in the migration spec inventory

The migration spec §4.3 names `scenarios`, `shared_briefs`, `v5_conversation_turns`, `v5_handler_facts`. The audit found two more user-scoped tables that need workspace_id and policy rewrites:

- `conversation_turns` (UI, BIL Phase 1) - full RLS, RPC, active client usage
- `scenario_snapshots` (UI, BIL Phase 1) - full RLS, immutable, active client usage

Both must be added to spec §4.3 and §5 with the same expand → backfill → switch pattern.

### 7.4 Live database state was not introspected

This audit is migration-file based. Supabase MCP was not available in this environment, so live state was not verified. Specific items requiring confirmation before sign-off:

- Whether `conversation_turns` (UI) is at the full 11-column schema or the "4/11 column sketch" the CEE introspection observed at 2026-04-17. Migration files describe the full schema; live state may differ.
- Whether the same-name `20260226010000_scenario_schema_v2_0_1_hardening.sql` was applied from UI or CEE last (which body wins for `create_shared_brief` in production).
- Confirmation that all RLS predicates listed in §3.1 match `pg_policies` exactly.
- Approximate row counts per table (helps size backfill effort).

A 30-minute Supabase introspection session would close this gap.

### 7.5 CEE service-role RPCs need a different rewrite pattern

The migration spec's §6 RPC inventory implicitly assumes the rewrite is "swap `auth.uid() = user_id` for `is_workspace_member(workspace_id)`." That pattern works for the 12 user-callable RPCs. For the 3 service-role-only RPCs (`append_turn_atomic`, `ensure_scenario_exists`, `store_draft_graph`), `auth.uid()` is not available; the membership check must move to the CEE caller layer (`supabase-store.ts`). The spec should make this distinction explicit.

### 7.6 CEE turn-context builder needs an explicit per-user filter

`olumi-assistants-service/src/orchestrator-v5/build-turn-context.ts:355-407` reads facts for ALL prior turns of a scenario, irrespective of user. Today this is fine because scenarios are single-user. After multi-tenancy, this will mix users' fact streams unless code filters explicitly. RLS does not protect because the CEE uses service-role. The migration's CEE work item must include this filter; SEC-10 enforcement at service-role level depends on it.

### 7.7 RLS hardening asymmetry on V5 tables

`v5_conversation_turns` and `v5_handler_facts` use `ENABLE ROW LEVEL SECURITY` only, **not** `FORCE`. UI-side V5 tables (`scenarios`, `shared_briefs`, `scenario_snapshots`, `conversation_turns`, plus `user_profiles`, `turn_observations`) all use FORCE. The migration is the natural moment to add FORCE to the CEE V5 tables.

### 7.8 Same-name migration file in two repos with different bodies

`20260226010000_scenario_schema_v2_0_1_hardening.sql` exists in both `DecisionGuideAI/supabase/migrations/` and `olumi-assistants-service/supabase/migrations/` with subtly different bodies (UI has "Depends on:" line; CEE adds `v_shared_id` declaration). Both define `create_shared_brief` with `CREATE OR REPLACE`. This is a hygiene issue: which body is the canonical one in production depends on application order. Should be resolved (one repo, or a renamed migration in the other) before the migration ships.

### 7.9 plot-lite-service is on a feature branch

`plot-lite-service` HEAD `635f6dc…` is on `claude-cee-plot/c1a-categorical-integrity`, not `staging`. The audit captured no V5-relevant tenancy hits in PLoT, and PLoT is tenancy-blind by design - but findings reflect the feature branch state, not main-line. Reproducible by checking out the recorded HEAD.

### 7.10 4-hour cap

No task exceeded the cap.

### 7.11 Open questions for Paul

1. Teams disposition (A, B, or C in §7.1)
2. Confirm spec §5.3 audit gate is closed (per-user is final, not transitional)
3. Should the migration spec be revised to add `conversation_turns` and `scenario_snapshots` to §4.3 and §5 before sign-off, or treated as in-scope augmentations during implementation?
4. Live-state verification via Supabase MCP: do this before spec finalisation, or as part of the Switch-phase rehearsal?

---

## 8. Appendix A - Rewrite targets, copy-paste ready

For every RLS policy and `SECURITY DEFINER` RPC found, this table maps to the migration spec v1.1 helpers (`is_workspace_member`, `can_edit_workspace`, `can_admin_workspace`, `can_publish_workspace`).

### A.1 RLS policy rewrites

| Object | Current predicate | Target predicate | Risk | Test |
|---|---|---|---|---|
| `scenarios` SELECT | `auth.uid() = user_id` | `is_workspace_member(workspace_id)` | Low | TEN-1, SEC-1, SEC-9 |
| `scenarios` INSERT | `auth.uid() = user_id` (WITH CHECK) | `can_edit_workspace(workspace_id)` (WITH CHECK) | Low | SEC-7 |
| `scenarios` UPDATE | `auth.uid() = user_id` (USING + WITH CHECK) | `can_edit_workspace(workspace_id)` (USING + WITH CHECK) | Low | SEC-5, SEC-7 |
| `scenarios` DELETE | `auth.uid() = user_id` | `can_admin_workspace(workspace_id)` | Low | TEN-4 (personal tenant non-deletable) |
| `shared_briefs` SELECT | `auth.uid() = user_id` | `is_workspace_member(workspace_id)` | Low | SEC-2, SEC-12 |
| `scenario_snapshots` SELECT | `auth.uid() = user_id` | `is_workspace_member(workspace_id)` | Low | SEC-4 |
| `scenario_snapshots` INSERT | `auth.uid() = user_id` (WITH CHECK) | `can_edit_workspace(workspace_id)` (WITH CHECK) | Low | SEC-16 |
| `conversation_turns` SELECT | `auth.uid() = user_id` | `auth.uid() = user_id AND is_workspace_member(workspace_id)` (per-user retained) | Medium - content is conversational | SEC-10 |
| `conversation_turns` INSERT | `auth.uid() = user_id` (WITH CHECK) | `auth.uid() = user_id AND is_workspace_member(workspace_id)` (WITH CHECK) | Medium | SEC-10 |
| `v5_conversation_turns` SELECT | `auth.uid() = user_id` | `auth.uid() = user_id AND is_workspace_member(workspace_id)` (per-user retained) | Medium | SEC-10 |
| `v5_handler_facts` SELECT | `auth.uid() = user_id` | `auth.uid() = user_id AND is_workspace_member(workspace_id)` (per-user retained per §5) | Medium - narrative is conversational | SEC-10 |

### A.2 `SECURITY DEFINER` RPC rewrites

User-callable (caller has user JWT):

| RPC | Current ownership check | Target | Risk | Test |
|---|---|---|---|---|
| `append_scenario_event` | `WHERE id = p_scenario_id AND user_id = auth.uid()` | replace with `is_workspace_member` lookup keyed off `scenarios.workspace_id` | Low | SEC-8 |
| `apply_patch_and_log` | same | same + `can_edit_workspace` | Low | SEC-7, SEC-8 |
| `store_analysis_and_log` | same | same + `can_edit_workspace` | Low | SEC-7 |
| `store_analysis_failure` | same | same + `can_edit_workspace` | Low | SEC-7 |
| `store_brief_and_log` | same | same + `can_edit_workspace` | Low | SEC-7 |
| `set_stage_and_log` | same | same + `can_edit_workspace` | Low | SEC-7 |
| `create_shared_brief` | same | same + `can_publish_workspace` (publish gate) | Medium - publish authority change | SEC-14 |
| `get_shared_brief_by_slug` | none (slug + expiry) | unchanged; verify returns no `user_id`/`workspace_id`/`scenario_id` | Low | SEC-17, SEC-18 |
| `create_snapshot` | inner `WHERE … user_id = auth.uid()` | replace with `is_workspace_member` + `can_edit_workspace` | Low | SEC-16 |
| `append_thread_entries` | uses scenarios with `auth.uid()` | replace ownership check with membership | Low | SEC-7 |
| `update_thread_block_state` | same | same | Low | SEC-7 |
| `insert_conversation_turn` | inner `WHERE … user_id = auth.uid()` | `is_workspace_member` + per-user invariant retained | Medium | SEC-10 |

Service-role-only (CEE caller):

| RPC | Current pattern | Target | Risk | Test |
|---|---|---|---|---|
| `append_turn_atomic` | derives `v_user_id` from `scenarios.user_id` | accept `p_workspace_id`, persist on row; CEE caller asserts membership for end-user before call | High - service-role path; cannot rely on RLS | SEC-10, SEC-11 |
| `ensure_scenario_exists` | takes `p_user_id` | additionally take `p_workspace_id`; idempotent upsert keyed on (id, workspace_id) | Medium | TEN-1 |
| `store_draft_graph` | service-role pattern | accept `p_workspace_id`; CEE caller asserts `can_edit_workspace` | Medium | SEC-7 |

### A.3 CEE caller-layer assertions

These are not migrations but code changes the CEE work item must include:

- `olumi-assistants-service/src/orchestrator-v5/session/supabase-store.ts:103-116` - before calling `append_turn_atomic`, assert that the authenticated user is a member of the scenario's workspace
- `olumi-assistants-service/src/orchestrator-v5/build-turn-context.ts:401-407` - filter `factsWithTurn` by `user_id = current_user` before returning, regardless of RLS

---

## 9. Appendix B - Base commits

Recorded `git rev-parse HEAD` at audit start. Findings are reproducible from these commits.

| Repo | Branch | HEAD | Working-tree state |
|---|---|---|---|
| `DecisionGuideAI` | `claude/collab-phase0-audit` (created from `staging` `ee04eb7`) | `ee04eb7b4ea5a29e61629ade90edfff0dd8f2af3` | clean at start; this audit is the only change |
| `olumi-assistants-service` | `staging` | `46b7d3abf9310c6f11395fe9b75ca80c4d338342` | pre-existing untracked `node_modules/` churn (pnpm install state); source clean |
| `plot-lite-service` | `claude-cee-plot/c1a-categorical-integrity` | `635f6dcffabb2a84d371325a7d3e0b38cc23211b` | clean; on a feature branch, not staging |
| `Inference-Service-Layer` | `staging` | `e2ada702cb5ec77932cc32bfafe0058e429ca124` | pre-existing untracked baseline files (`coverage-baseline.txt`, `pre-push-baseline.txt`, `.coverage 4`); source clean |
| `olumi-schemas` | `main` | `9f279cbbec5dbb7b93dac57797b587ad7c186df9` | pre-existing untracked Finder-copy duplicates (`* 2.ts`, `CHANGELOG 2.md`); source clean |

Per audit user direction (2026-05-09), pre-existing dirty state in CEE/ISL/olumi-schemas was non-substantive (no source files affected) and the audit proceeded.

---

## 10. Appendix C - Raw search outputs

### C.1 Tenancy keyword sweep (Question A)

Migration files containing tenancy keywords (`organi[sz]ations?|orgs|teams|memberships?|tenants?|workspaces?|workspace_members`):

```
DecisionGuideAI/supabase/migrations/20250512143948_stark_coast.sql        ← teams + team_members origin
DecisionGuideAI/supabase/migrations/20250512152206_odd_king.sql           ← is_team_admin helper
DecisionGuideAI/supabase/migrations/20250512183000_fix_teams_select_policy.sql
DecisionGuideAI/supabase/migrations/20250513173826_gentle_shrine.sql
DecisionGuideAI/supabase/migrations/20250513204516_broad_ember.sql
DecisionGuideAI/supabase/migrations/20250513213526_foggy_pebble.sql       ← team_invitations
DecisionGuideAI/supabase/migrations/20250513221801_misty_wave.sql
DecisionGuideAI/supabase/migrations/20250514133805_jade_wood.sql
DecisionGuideAI/supabase/migrations/20250514144647_steep_lab.sql          ← team_members consolidation
… (further teams hardening migrations through May–July 2025)
```

Tenancy keywords AFTER scenarios v2 (Feb 2026): **none**.

### C.2 V5 RLS policy hits

See §3.1 table. All 11 policies use `auth.uid() = user_id` exclusively.

### C.3 V5 RPC hits

See §3.2 table. 12 user-callable + 3 service-role-only.

### C.4 Client filter sites

```
$ grep -rnE "\.eq\('user_id'" DecisionGuideAI/src/ olumi-assistants-service/src/

DecisionGuideAI/src/contexts/TeamsContext.tsx:141  ← V1 teams (out of V5 scope)
DecisionGuideAI/src/contexts/TeamsContext.tsx:158  ← V1 teams (out of V5 scope)
DecisionGuideAI/src/lib/supabase.ts:238            ← typed-cast utility (out of scope)
DecisionGuideAI/src/services/scenarioService.ts:107 ← V5: 1 site
```

### C.5 Edge Functions surveyed

```
DecisionGuideAI/supabase/functions/
├── assist-proxy/        (no user_id checks)
├── delete-account/      (uses user_id at lines 87, 111 for cleanup)
├── models-proxy/        (no user_id checks)
├── openai-proxy/        (no user_id checks)
└── send-team-invite/    (V1 teams; uses team_id, team_name, inviter_id)
```

### C.6 Storage buckets

No `storage.objects` or `storage.buckets` policies in any migration. Confirmed by grep.

### C.7 olumi-schemas tenancy types

```
$ grep -rnE "WorkspaceId|TeamId|MembershipRole|workspace_id|team_id" olumi-schemas/src/
(no matches)
```

---

*End of audit*
