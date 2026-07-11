# Workspace & Identity — Schema + Security Contract v1 (GATE 1)

**Status:** Draft for A1 adversarial review (+ security review — everything here is RLS/grants/RPC-shaped). SPEC ONLY: no DDL in this PR executes anything; Gate 2 authors the migration files from this contract; execution is a separate Paul/A1-batched gate.
**Lane:** Workspace & Identity (ROADMAP 3.9), Charter v2. **Authorization:** `parallel-briefs/A1-GATE0-VERDICT-workspace-2026-07-12.md` — Gate 1 on the unblocked surface; org-spine + strategy-tree sections below are explicitly **PENDING-CQ** and not buildable until the Paul docket returns.
**Sources of record:** `parallel-briefs/WORKSPACE-IDENTITY-DESIGN-v1.md` (ratified, Batch-A) · `RULING-BATCH-A-2026-07-11.md` (phasing dropped — one integrated model) · tenancy-collab-migration-spec v1.7 (DGAI commit `6db51cc3`; column detail restated here self-contained — nothing adopted by pointer) · Gate 0 audits `WORKSTREAM-UPDATE-workspace-1/2.md` + evidence pack `parallel-briefs/workspace-lane-evidence/gate0/` · A4 collab-tenancy audit `docs-designs/COLLAB-TENANCY-AUDIT-2026-07-11/` (XQ-1/2 answered in §7 per A1 order).
**House pattern (every function herein unless stated):** `SECURITY DEFINER`, owner `postgres`, `SET search_path = pg_catalog, public`, `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` then explicit grants, typed SQLSTATE errors, FORCE RLS on every table, tenant/subject derived from locked rows or `auth.uid()` — **never from caller parameters** (the decision_records `p_workspace_id` deviation is quarantined in §6.4).

---

## §0 Scope map

| Slice | Contents | Status |
|---|---|---|
| S-1 Tenancy core (M1) | workspaces, workspace_members, workspace_invites (dark), helpers, create_workspace, personal provisioning | **SPECIFIED — buildable** |
| S-2 Scenario scoping (M2) | scenarios.workspace_id, stamping trigger, immutability trigger, 18-row backfill | **SPECIFIED — buildable** |
| S-3 Sensitive substrate (M5) | person_profiles, profile_consent_events, has_active_consent, get_coaching_profile, delete_person_profile, Gate-2b disposition | **SPECIFIED — buildable** (F4/F8 A2 legs sequence execution, not authoring) |
| S-4 Org spine (M3) | orgs, org_members, org_teams, org_team_members, workspace_team_grants, workspaces.org_id+FK | **PENDING-CQ** (drafted §8; ratified defaults applied) |
| S-5 Strategy layer (M4) | strategies, strategy_bets, strategy_scenario_links | **PENDING-CQ** for tree/parenting; tables drafted §8 with integrity constraints |
| S-6 Child columns + late policies (M6/M7) | child workspace_id columns, decision_participants, snapshots reserve, DR workspace policy | **SPECIFIED as shapes**; sequencing per M-map v2 |

Role vocabulary (one vocabulary owns the words — §7 XQ-2): `owner > admin > editor > viewer`, encoded once:
`role_rank(role) := CASE role WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END`.

---

## §1 S-1 — Tenancy core DDL

### 1.1 `workspaces`
```sql
CREATE TABLE public.workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  is_personal BOOLEAN NOT NULL DEFAULT false,
  created_by  UUID NOT NULL,          -- authorship snapshot; NO FK to auth.users (decision_records
                                      -- posture: authorship outlives accounts; CQ-5/CQ-10 governs lifecycle)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
- **No `org_id` in M1.** Per the Gate-0 verdict, `org_id UUID NULL REFERENCES orgs(id)` + `CHECK (NOT is_personal OR org_id IS NULL)` (ratified default: personal workspaces carry no org) land **atomically in M3**.
- **Immutable columns:** `id`, `created_by`, `is_personal`, `created_at` — enforced by trigger `workspaces_update_guard` (BEFORE UPDATE, rejects any change to those columns, SQLSTATE `WS001`). UPDATE allowlist = `name`, `updated_at` only (v1.7 §8.2: "the allowlist is the contract"; `description` is deliberately not shipped — additive later is free).
- **Personal-workspace invariants** (v1.7 §8.2, enforced in triggers + RPCs, tested in Gate 4): exactly one per user (partial unique index `UNIQUE (created_by) WHERE is_personal`), single owner member, no invites, `is_personal` immutable, DELETE forbidden.
- RLS (FORCE): `SELECT` → `is_workspace_member(id)` · `UPDATE` → `is_workspace_role(id,'admin')` USING+CHECK (column guard via trigger) · **no INSERT policy** (creation only via `create_workspace`/provisioning — DEFINER paths) · **no DELETE policy** (forbidden in MVP).
- Grants: `REVOKE ALL FROM PUBLIC, anon, authenticated;` `GRANT SELECT, UPDATE TO authenticated;` `GRANT ALL TO service_role;` (+ the F9 lesson: grants are stated explicitly precisely because default-privilege sprawl exists — see §5.4 baseline).

### 1.2 `workspace_members`
```sql
CREATE TABLE public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- membership is ACCESS, not
                                                                           -- authorship: dies with account
  role         TEXT NOT NULL CHECK (role IN ('owner','admin','editor','viewer')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE UNIQUE INDEX workspace_members_one_owner_idx
  ON public.workspace_members (workspace_id) WHERE role = 'owner';   -- at-most-one owner
CREATE INDEX workspace_members_user_idx ON public.workspace_members (user_id);
```
- **Exactly-one-owner** (v1.7 invariant): at-most-one via the partial unique index; at-least-one via trigger `workspace_members_owner_guard` (BEFORE UPDATE OR DELETE): blocks removing/demoting the owner row (SQLSTATE `WM409`) **except** (i) when the parent workspace row is being deleted in the same transaction (unreachable in MVP), or (ii) `is_personal` workspace cascade from account deletion — personal workspace and its membership die with the account. **Interim rule, explicitly CQ-5-pending:** an auth-account deletion whose owner row belongs to a *shared* workspace is BLOCKED by this guard (deletion RPC must surface "transfer ownership first"); Paul's CQ-5 answer supersedes.
- RLS (FORCE): `SELECT` → `is_workspace_member(workspace_id)` (members see the roster). **No INSERT/UPDATE/DELETE policies** — membership lifecycle is RPC-only (v1.7 §15.2; the RPCs are Gate-3 product functions except what §1.5 ships).
- Grants: `REVOKE ALL …; GRANT SELECT TO authenticated; GRANT ALL TO service_role;`

### 1.3 `workspace_invites` (ships in M1 **dark** — no send/accept surface until P9 confirmation + login flip)
```sql
CREATE TABLE public.workspace_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email        TEXT NOT NULL CHECK (position('@' IN email) > 1),
  role         TEXT NOT NULL CHECK (role IN ('admin','editor','viewer')),   -- never 'owner' by invite
  token_hash   TEXT NOT NULL UNIQUE,          -- sha256 of a single-use token; raw token never stored
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  invited_by   UUID NOT NULL,                 -- authorship snapshot, no FK
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  accepted_by  UUID NULL,
  accepted_at  TIMESTAMPTZ NULL
);
```
- Trigger `workspace_invites_personal_guard` (BEFORE INSERT): reject invites to `is_personal` workspaces (`WI001`).
- RLS (FORCE): `SELECT` → `is_workspace_role(workspace_id,'admin') OR lower(email) = lower(coalesce(auth.jwt()->>'email',''))` (v1.7 member-or-invitee visibility, non-member inference prevented — token_hash is excluded from the invitee's view via the Gate-3 read RPC; direct SELECT grant withheld: **no table SELECT grant to authenticated**; reads go through a projection RPC so `token_hash` can never leak). Writes RPC-only.
- Grants: `REVOKE ALL …; GRANT ALL TO service_role;` (authenticated interacts only via Gate-3 RPCs — invite lifecycle = accept-by-verified-email under the user's JWT + admin issue/revoke).

### 1.4 Helpers (schema-integrity class — ship in M1)
```sql
CREATE FUNCTION public.is_workspace_member(p_workspace UUID) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members
                 WHERE workspace_id = p_workspace AND user_id = auth.uid());
$$;
CREATE FUNCTION public.is_workspace_role(p_workspace UUID, p_min_role TEXT) RETURNS boolean …
  -- same shell; body: member row exists AND role_rank(role) >= role_rank(p_min_role)
```
- EXECUTE: `REVOKE FROM PUBLIC, anon;` `GRANT TO authenticated, service_role;`. DEFINER-reads bypass workspace_members RLS internally — no policy recursion (v1.7 §8/§14). **These two helper bodies are the single evolution point** (org/team grants extend `is_workspace_member` in S-4; the RLS cutover swaps scenarios' policies to call them; policies never change shape — the idiom A4's XQ-6 asked us to confirm, §7).
- `role_rank(TEXT) RETURNS int` — `IMMUTABLE`, plain INVOKER, pure CASE; EXECUTE to authenticated + service_role.

### 1.5 `create_workspace` + personal provisioning (schema-integrity class — tables must not exist without their lifecycle enforcement)
- `create_workspace(p_name TEXT) RETURNS jsonb` — DEFINER; EXECUTE to **authenticated only** (service_role excluded: workspace creation is a user act; CEE has no business creating workspaces in v1). Derives creator from `auth.uid()` (refuses NULL → `WS401`); inserts `workspaces (is_personal=false)` + owner membership row atomically; returns `{workspace_id, name, role:'owner'}`.
- `provision_personal_workspace()` — trigger fn (DEFINER) on `auth.users` AFTER INSERT, alongside the existing `on_auth_user_created→ensure_user_profile()`: creates the personal workspace (`is_personal=true`, name from email local-part, creator = NEW.id) + its single owner membership. Idempotent (`ON CONFLICT` on the partial unique index → no-op).
- **Backfill (M1, one-time):** the 16 existing `auth.users` rows get personal workspaces via the same function body (executed in the migration transaction; count-verified in-transaction 16→16).
- Guest scenarios (609 rows, `user_id NULL`) have **no workspace until claim** — by design (P4 claim-on-first-login).

---

## §2 S-2 — Scenario scoping (M2)

```sql
ALTER TABLE public.scenarios ADD COLUMN workspace_id UUID NULL REFERENCES public.workspaces(id);
CREATE INDEX scenarios_workspace_idx ON public.scenarios (workspace_id) WHERE workspace_id IS NOT NULL;
```
- **At-birth stamping — trigger-derived** (v1.7 §20 dual-compatible path, chosen because it is single-repo and covers *every* writer including the three CEE service-role RPCs and `store_draft_graph` (Gate-0 F6) without cross-repo code changes):
  `scenarios_stamp_workspace` BEFORE INSERT: `IF NEW.workspace_id IS NULL AND NEW.user_id IS NOT NULL THEN NEW.workspace_id := (SELECT id FROM workspaces WHERE created_by = NEW.user_id AND is_personal);` — guests stay NULL; a caller-supplied `workspace_id` is **overridden unless the inserting role's membership validates** (MVP: always overridden to the personal workspace — callers do not choose tenancy until shared workspaces open).
- **Immutability** (v1.7 §10): `scenarios_workspace_immutable` BEFORE UPDATE — reject any change where `OLD.workspace_id IS NOT NULL AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id` (`WS010`). NULL→value is permitted exactly once (claim-time stamping). The deferred transfer RPC is the only future exception (CQ-14/v1.7).
- **Claim-time stamping:** `claim_guest_scenario` gains one statement (stamp claimer's personal workspace under its existing `FOR UPDATE` lock). That migration file lives in **CEE** (META-FLAG: one DB, two homes — A1's ledger ruling governs which repo hosts the amendment; the spec is identical either way). Named follow-up alongside A1's queued CEE caller fix.
- **Historical backfill:** the **18 owned rows only** — `UPDATE scenarios SET workspace_id = personal(user_id) WHERE user_id IS NOT NULL AND workspace_id IS NULL` in-transaction with count assertion (=18 at authoring; re-counted at execution). 609 guest rows untouched.
- **RLS on scenarios: UNCHANGED in M2** (owner-only policies stay byte-identical — P3 ratified posture; the Tier-3 cutover later swaps them to helper-based with no data migration).

---

## §3 S-3 — Sensitive substrate (M5; own migration file; sequenced after A2's F4/F8 UI legs for the disposition part)

### 3.1 `person_profiles`
```sql
CREATE TABLE public.person_profiles (
  user_id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_appetite          JSONB NULL,   -- envelope {band, score?, provenance, captured_at} (design §2.1.3)
  psychometrics          JSONB NULL,   -- instrument-keyed; P5 ratified: NOT collected in v1 (column exists, no UI)
  expertise              JSONB NULL,   -- [{domain, level, evidence?}]
  decision_style         JSONB NULL,
  profile_schema_version INT  NOT NULL DEFAULT 1,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
- **RLS (FORCE): owner-only, permanently, at table level** — `ALL` policy `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` to authenticated. **There is no cross-user policy and there never will be** (Gate-0-amended ruling resolving design §2.1.3 vs §2.5: cross-user access happens ONLY through narrowly-typed projection RPCs — `can_view_profile()` is an authorisation predicate *inside* future projections, never a table policy). No anon anything.
- Grants: `REVOKE ALL FROM PUBLIC, anon; GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated;` (writes ride the **user's JWT** — design §2.1, the structural fence against the pre-login-flip trust hole) `GRANT SELECT TO service_role;` — service_role gets **no direct write grant**; its only sanctioned read is via `get_coaching_profile` anyway, but SELECT remains for operational reads under A1 authority.

### 3.2 `profile_consent_events` — the immutable ledger (adopted by Gate-0 verdict; supersedes design §2.1.4 mechanics; Paul ratification queued)
```sql
CREATE TABLE public.profile_consent_events (
  event_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL,               -- soft ref (NO FK): pseudonymise doctrine — identity severed
                                                -- on account deletion, events retained (CQ-6 retention window)
  action           TEXT NOT NULL CHECK (action IN ('grant','withdraw')),
  scope            TEXT NOT NULL CHECK (scope IN ('coaching_tone','team_aggregate','view_card','view_profile',
                                                  'contact','dissent_visibility')),  -- last two: §3.5, §7 XQ-3
  audience_type    TEXT NOT NULL CHECK (audience_type IN ('self','team','org')),
  audience_team_id UUID NULL,
  audience_org_id  UUID NULL,
  consent_version  TEXT NOT NULL,               -- versioned copy the user was shown
  actor            TEXT NOT NULL CHECK (actor IN ('self','system','admin_erasure')),
  source           TEXT NOT NULL,               -- UI surface / RPC / migration tag
  idempotency_key  TEXT NOT NULL UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pce_audience_target CHECK (
       (audience_type = 'self' AND audience_team_id IS NULL AND audience_org_id IS NULL)
    OR (audience_type = 'team' AND audience_team_id IS NOT NULL AND audience_org_id IS NULL)
    OR (audience_type = 'org'  AND audience_org_id  IS NOT NULL AND audience_team_id IS NULL)),
  CONSTRAINT pce_scope_audience CHECK (          -- CQ-16 proposal; Paul may amend the matrix
       (scope = 'coaching_tone'      AND audience_type = 'self')
    OR (scope = 'team_aggregate'     AND audience_type = 'team')
    OR (scope IN ('view_card','view_profile') AND audience_type IN ('team','org'))
    OR (scope = 'contact'            AND audience_type = 'self')
    OR (scope = 'dissent_visibility' AND audience_type = 'team'))   -- reserved; not active in v1
);
CREATE INDEX pce_fold_idx ON public.profile_consent_events (user_id, scope, audience_type,
  coalesce(audience_team_id,'00000000-0000-0000-0000-000000000000'),
  coalesce(audience_org_id,'00000000-0000-0000-0000-000000000000'), created_at DESC);
```
- **Append-only as hardware:** RLS (FORCE): `SELECT` own rows (`auth.uid() = user_id`); `INSERT` own rows (`WITH CHECK auth.uid() = user_id AND actor = 'self'`). **No UPDATE/DELETE policy for anyone**, and — the load-bearing part — `REVOKE UPDATE, DELETE, TRUNCATE FROM service_role` too (service_role bypasses RLS; only the grant layer binds it; system/admin_erasure events are INSERTed by DEFINER functions, not by service_role DML). `GRANT SELECT, INSERT TO authenticated; GRANT SELECT, INSERT TO service_role;`
- **Effective consent = deterministic fold:** latest event by `(created_at, event_id)` per `(user_id, scope, audience_type, audience-target)`; `grant` ⇒ active, `withdraw` ⇒ inactive; **absence = deny**. Same-user events serialise via `pg_advisory_xact_lock(hashtext(user_id::text))` taken in every consent-writing RPC — total order is well-defined.
- **Account deletion:** deletion path INSERTs a terminal `withdraw` per active scope (`actor='system', source='account_deletion'`) then severs identity (person_profiles CASCADE); events persist pseudonymously (user_id no longer resolves). Retention window = **CQ-6, Paul**.

### 3.3 `has_active_consent(p_user UUID, p_scope TEXT, p_audience_type TEXT, p_team UUID DEFAULT NULL, p_org UUID DEFAULT NULL) RETURNS boolean`
DEFINER, STABLE, pinned search_path; **EXECUTE to service_role ONLY** (a boolean about another user's consent is still a probe surface; owners read their own events directly under RLS). Body = the §3.2 fold. This is the single enforcement primitive — every projection and Lock-0 read calls it inside its own transaction.

### 3.4 `get_coaching_profile` — Lock 0
- Shape A (design of record): `get_coaching_profile(p_user_id UUID) RETURNS jsonb` — DEFINER, **EXECUTE to service_role only**; returns `'{}'::jsonb` unless `has_active_consent(p_user_id,'coaching_tone','self')`; on consent returns ONLY the `CoachingProfileHints` projection (tone/band/domains — never raw psychometrics).
- Shape B (defence-in-depth, Gate-1 review decision per the verdict): `get_coaching_profile_for_scenario(p_scenario_id UUID)` — derives the subject from the **locked** scenario row (`SELECT user_id … FOR SHARE`), refuses guest scenarios. **Recommendation: ship B as the only granted entry point** (CEE's call site is always turn-scoped today; A's trusted-parameter surface then never exists), keep A unshipped. A1 review decides; both are fully specified so the decision is a one-line grant choice.
- Either shape: the wire projection is `CoachingProfileHintsSchema` (Gate-3 contract; dark until `PROFILE_COACHING_ENABLED` exists AND pin-verified — Locks 1–3 unchanged from the design).

### 3.5 Gate-2b — `user_profiles` disposition matrix (P12 **EXTENDED** per verdict; every row carries its Gate-0 evidence)
| Column(s) | Live data | Disposition | Conditions |
|---|---|---|---|
| bias_susceptibility, challenge_tolerance, coaching_style, calibration_tendency | 0 non-default rows (measured twice) | **DROP** (+ their CHECKs) | in-transaction zero-data re-verification; abort on any non-default value |
| research_consent, consent_version | 0 true / 0 set; toggle provably broken (F8) | **DROP** + `chk_user_profiles_consent_version` DROP; consent capability re-lands as ledger scope | A2 UI leg (F4/F8) merged first |
| contact_consent | 5 true rows — real consent data | **MIGRATE → ledger** (`grant` events, scope `contact`, `actor='system'`, `consent_version='legacy-import-2026-07'`, source=migration tag) **then DROP** | Paul ratification (consent-data migration) |
| phone_number, address, age_bracket, gender | 2 rows real PII | **DROP** (destroy) | Paul approval naming the 2 subjects' rows as destroyable (they are also erasable-on-request data); A2 removes ProfileForm fields first |
| decisions_completed | counter, derivable from decision_records | **DROP** | A1 concurrence (cheap either way) |
| pilot_metrics | 0 non-default | **KEEP** (non-sensitive, pilot instrumentation owns it) | — |
| first/last/display_name, email, avatar_url, onboarding_*, preferences | display anchor | **KEEP** — this is what makes "non-sensitive display anchor" true afterwards | — |
| Policy `"Users can view accessible profiles"` | live cross-user read (F3) | **DROP** — under the separate F3 containment order (STOPPED pending the Analysis.tsx reader ruling; see WORKSTREAM-UPDATE-workspace-3) | A1 disposition |
| Legacy profile-touching RPCs (`sync_*`, `initialize_user_profile`, `check_user_profile`) | body hashes in evidence pack | **NO-TOUCH in M5**; listed for the 1.40 revoke batch | F9 scope |

**Reversibility:** every DROP here is **irreversible-by-design**; the rollback script recreates *columns* (nullable, no data) purely for schema-shape compatibility and is documented as NON-RESTORATIVE — a rollback must never recreate destroyed sensitive data (charter; trivially satisfiable — §Gate-0: zero non-default data exists).

### 3.6 `delete_person_profile() RETURNS jsonb`
DEFINER; EXECUTE **authenticated only**; subject = `auth.uid()` — **takes no subject parameter** (charter: identity server-derived). Atomically: advisory lock → terminal withdraw events per active scope → `DELETE FROM person_profiles WHERE user_id = auth.uid()` → returns `{deleted: true, consents_closed: n}`. Erasure-completeness sweep (telemetry/logs/context-packs) = Gate-4 acceptance evidence; the DGAI `delete-account` Edge Function gains a call to this RPC (A2 leg, Gate 5 spec). Collab-tables hook (A4 XQ-4): this RPC is the **single erasure orchestration point** — the collab lane's stance name-detach registers here as a step, not as a second path.

---

## §4 Function-access matrix (every function this lane ships or amends)

| Function | Class | Security | search_path | EXECUTE grants | Subject/tenant derivation |
|---|---|---|---|---|---|
| is_workspace_member(uuid) | schema-integrity (M1) | DEFINER, STABLE | pinned | authenticated, service_role | `auth.uid()` inside body |
| is_workspace_role(uuid,text) | schema-integrity (M1) | DEFINER, STABLE | pinned | authenticated, service_role | `auth.uid()` inside body |
| role_rank(text) | pure util (M1) | INVOKER, IMMUTABLE | n/a | authenticated, service_role | none |
| create_workspace(text) | schema-integrity (M1) | DEFINER | pinned | **authenticated only** | creator = `auth.uid()`, refuse NULL |
| provision_personal_workspace() | trigger fn (M1) | DEFINER | pinned | none (trigger-owned) | NEW.id from auth.users insert |
| scenarios_stamp_workspace() | trigger fn (M2) | DEFINER | pinned | none | NEW.user_id → personal workspace |
| scenarios_workspace_immutable() | trigger fn (M2) | DEFINER | pinned | none | row-local |
| workspaces_update_guard() / workspace_members_owner_guard() / workspace_invites_personal_guard() | trigger fns (M1) | DEFINER | pinned | none | row-local |
| upsert_person_profile(jsonb) | product (Gate 3 spec, Gate 4 impl) | **INVOKER** (rides owner RLS) | pinned | authenticated | `auth.uid()` via RLS |
| record_consent_event(…) | product (Gate 3/4) | **INVOKER** (RLS: own INSERT, actor='self') | pinned | authenticated | `auth.uid()` via RLS CHECK |
| has_active_consent(…) | enforcement primitive (M5) | DEFINER, STABLE | pinned | **service_role only** | parameterised — called only from DEFINER bodies |
| get_coaching_profile[_for_scenario] | Lock 0 (M5, dark) | DEFINER | pinned | **service_role only** | Shape B: locked scenario row (recommended); Shape A: parameter (documented trust boundary) |
| delete_person_profile() | erasure (M5) | DEFINER | pinned | **authenticated only** | `auth.uid()` — no subject param |
| claim_guest_scenario (amendment) | existing, +stamping | DEFINER (unchanged) | pinned | service_role only (unchanged) | locked scenario row `FOR UPDATE` |
| create_decision_record (amendment, CEE queue) | existing | DEFINER (unchanged) | pinned | service_role only (unchanged) | **workspace from locked scenario row; caller p_workspace_id refused once scenarios carry tenancy** (verdict ruling) |

**Bans carried from the collab audit (apply to every endpoint this lane ever specs):** no `extractJwtSub`-style client-supplied identity anywhere; the CI forbidden-pattern grep (`docs-designs/COLLAB-TENANCY-AUDIT-2026-07-11/tests/forbidden-patterns.sh`) is adopted into this lane's Gate-4 test pack verbatim.

## §5 RLS policy matrix + grants baseline

### 5.1 Policy matrix (per table × cmd × role; FORCE RLS everywhere; absence = deny)
| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| workspaces | member | — (RPC) | admin+ (allowlist-guarded) | — |
| workspace_members | member (roster) | — (RPC) | — (RPC) | — (RPC) |
| workspace_invites | — (no table grant; projection RPC: admin-or-invitee, token_hash never returned) | — | — | — |
| scenarios | **unchanged owner-only** (cutover later swaps to member via helpers) | unchanged | unchanged | unchanged |
| person_profiles | owner | owner | owner | owner |
| profile_consent_events | owner | owner (actor='self') | **nobody** | **nobody** |
| decision_records | unchanged owner-only; `+ visibility='workspace' AND is_workspace_member(workspace_id)` policy = M7, cutover-gated | — | — | — |

### 5.2 Grants baseline (F9): every new table starts `REVOKE ALL FROM PUBLIC, anon, authenticated` then grants the §1–3 minima; `profile_consent_events` additionally revokes UPDATE/DELETE/TRUNCATE **from service_role**. The 53-table legacy anon-DML sprawl is registered under ROADMAP 1.40 (authoring may ride Gate 2 per the verdict; execution Paul-batched).

### 5.3 Migration classification (charter Gate-1 requirement)
| File | Class | Rollback posture |
|---|---|---|
| M1 tenancy core | reversible | full DROP script (tables empty of user value pre-adoption) |
| M2 scenarios.workspace_id | reversible pre-cutover | drop triggers + column (backfill re-derivable from user_id) |
| M3 org spine | reversible | PENDING-CQ |
| M4 strategies | reversible while unlinked; **forward-fix-only once links exist** (links are product history) | staged |
| M5 person_profiles + ledger | tables reversible while empty; **Gate-2b drops irreversible-by-design** (§3.5) | non-restorative shape-only rollback, documented |
| M6/M7 child cols + late policies | reversible | column/policy drops |

### 5.4 Ledger reconciliation (hard blocker, verdict-confirmed): no M-file executes until the Gate-6 runbook lands the canonical-history plan (three divergence classes + the `20260226010000` cross-repo collision, evidence-pack registry) and A1 approves ledger-row insertion for exactly the file-hashes proven live-equivalent. Gate-2 CI addition: reject any migration version already present in the sibling repo.

---

## §6 Cross-cutting integrity rules

1. **Child-consistency (v1.7 §9, restated):** any row carrying both `scenario_id` and `workspace_id` derives `workspace_id` server-side from `scenarios.workspace_id` (composite FK `(scenario_id, workspace_id) → scenarios(id, workspace_id)` — requires `UNIQUE(id, workspace_id)` on scenarios, added in M2 — or validating trigger where the FK is impossible). Applies at M6 to: shared_snapshots, v5_conversation_turns, v5_handler_facts, scenario_snapshots; **model_versions is specified here but MM ratifies** (charter fence — one source of truth per fact; this lane adds no graph-truth writers).
2. **workspace_id immutability everywhere once set** (§2 trigger pattern replicated per table); the only future exception is the dedicated transfer RPC (deferred; CQ-14 governs strategy-link behaviour under transfer).
3. **Strategy-layer integrity (drafted, S-5):** `strategy_bets UNIQUE(id, strategy_id)`; links carry composite FKs `(strategy_id, workspace_id) → strategies(id, workspace_id)` **and** `(bet_id, strategy_id) → strategy_bets(id, strategy_id)`; the link-creation RPC locks strategy AND scenario and refuses `workspace_id` mismatch (`SL409`) — making the design-vs-v1.7 derivation conflict unreachable rather than picking a side. Parent-strategy FK form (same-workspace composite vs cross-workspace org→team tree) = **CQ-1/2, unbuildable until ruled**.
4. **decision_records:** verdict ruling encoded — workspace derives from the locked scenario at write time; `p_workspace_id` becomes refused-if-supplied post-M2 (amendment spec ready; CEE caller currently passes 6/8 args and gets NULL — named follow-up on A1's CEE queue).

## §7 Answers to the collab-tenancy audit (per verdict order)

- **XQ-1 — one membership fabric or two? ANSWER: (b)+(a) union, one fabric with a narrow-grant escape.** Workspace membership is the primary fabric: membership ⇒ scenario access, role-mapped, via the same two helpers (§1.4) — that is what M1/M2 + the cutover build. `scenario_collaborators` remains as the **narrower-than-workspace / cross-workspace grant** (a person invited to ONE scenario without workspace membership — the external-collaborator case), so effective access = `is_workspace_member(ws) OR is_scenario_collaborator(scenario_id, uid)`. Pre-cutover it is the bridge; post-cutover it is the targeted-share mechanism, permanent fabric. It is never an intersection (option c) — that would make workspace membership meaningless for shared scenarios. **Ratification-queued with the CQ batch** (A1 ordered the answer here; Paul confirms).
- **XQ-2 — role vocabulary: the v1.7 set owns the words** (Paul-signed matrix). Mapping: host→`owner`-of-grant (scenario-grant issuer must hold `editor+` in the owning workspace), collaborator→`editor`, viewer→`viewer`. COLLAB surfaces rename to the v1.7 vocabulary before any UI ships both.
- XQ-3: yes — expressible as the reserved `dissent_visibility` scope (§3.2), team-audience, target-required; not active in v1; Neil/N2 rider applies before any dissent surface reads it.
- XQ-4: confirmed — `delete_person_profile()` is the single erasure orchestration point (§3.6); the collab name-detach registers as a step in it; no second erasure path.
- XQ-5: confirmed binding; §5.4 is the shared machinery; home-repo META-FLAG stays with A1.
- XQ-6: confirmed — the helper idiom here is exactly "swap the membership source in ONE function body, never the policy shape" (§1.4).

## §8 PENDING-CQ drafts (org spine + strategy tree — shapes complete, constraints awaiting the Paul docket; ratified defaults already applied: team⊆org enforced by trigger `org_team_members_subset_guard`; `CHECK (NOT is_personal OR org_id IS NULL)`)

Drafted DDL for `orgs`, `org_members` (+`external_id` SSO seam), `org_teams`, `org_team_members`, `workspace_team_grants`, `strategies`, `strategy_bets`, `strategy_scenario_links` follows the design §2.3/§2.4 shapes with §6.3 integrity additions — reproduced in full in the Gate-2 PR only after CQ-1/2/3/5/7 (strategy residence, org-departure, multi-org, account-deletion×owner, cross-org grants) return. Nothing in S-1..S-3 depends on any of these answers (verified: no FK, no helper body, no policy above references an org/team object — the org extension point is one column + one helper-body clause).

## §9 Gate-4 test-pack obligations (forward reference; charter list + additions)
Clean-db apply · upgrade against representative rows (627-scenario copy) · per-policy-matrix-row allow AND deny · JWT-vs-service-role per §4 row · consent grant/withdraw/fold determinism + concurrency (advisory-lock race test) · deletion + membership-loss behaviours · exactly-one-owner guard races · stamping-trigger coverage incl. all three CEE service-role RPC paths + store_draft_graph · index/query-plan checks (membership reads, pce_fold_idx) · negative cross-tenant + cross-audience adversarial suite · alignment with the collab audit's N-suite + forbidden-patterns CI · in-transaction P12 re-verification rehearsal.
