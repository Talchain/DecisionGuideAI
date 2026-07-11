# Workspace & Identity — Schema + Security Contract v1.2 (GATE 1 — PASS-WITH-CONDITIONS, conditions folded)

**Status:** Gate-1 verdict = **PASS-WITH-CONDITIONS** (`A1-RULING-F3-AND-GATE1-2026-07-12.md`); this v1.2 folds all four conditions + the two accepted hardenings. **Gate 2 is OPEN scoped to M1+M2 authoring only; M5 (S-3) is HELD** pending CQ-6/R-1/R-2. SPEC governs the Gate-2 DDL; execution stays Paul/A1-batched.
**v1.2 (12 Jul, post-verdict):** C1 consent-closure moves into the auth.users delete-trigger path (§1.6) · C2 account-deletion ownership race closed (advisory-lock serialisation vs create_workspace + BEFORE-DELETE re-assert, §1.6) · C3 provenance fence extended to ALL projected envelopes (§3.1) · C4 Shape A deleted as an object — `get_coaching_profile_for_scenario` is the only coaching read that will ever exist (§3.4) · hardenings: server-set `updated_at`/`profile_schema_version` trigger (§3.1) · riders: idempotency-replay action match (§3.2), org-spine naming-vs-live-data reconciliation (§8) · **implementation subtlety found while folding (neither review caught it): PG15 `CREATEROLE` cannot mint `BYPASSRLS`, so `wsid_definer` under FORCE RLS needs explicit `TO wsid_definer` policies mirroring §4's needs column — added to §5.1a; better than BYPASSRLS anyway (visible, per-table, least-privilege)**.
**v1.1 (12 Jul):** least-privilege overhaul (dedicated definer owner, service-role DML revoked), consent writes RPC-only with server-controlled ordering, exact RLS/grant matrix, account-deletion orchestration, stamping guards, composite-key fix, fold/index contract, full child-table disposition, P12 forward-fix-only. Adjudication log: `parallel-briefs/WORKSTREAM-UPDATE-workspace-4.md`.
**Lane:** Workspace & Identity (ROADMAP 3.9), Charter v2. **Authorization:** `A1-GATE0-VERDICT-workspace-2026-07-12.md`. Org-spine + strategy-tree = **PENDING-CQ**.
**Sources of record:** `WORKSPACE-IDENTITY-DESIGN-v1.md` (ratified) · `RULING-BATCH-A-2026-07-11.md` · tenancy-collab-migration-spec v1.7 (DGAI `6db51cc3`; restated self-contained) · Gate-0 audits + evidence pack `parallel-briefs/workspace-lane-evidence/gate0/` · collab-tenancy audit (XQ answers §7).

**House pattern v1.1 (delta from the live pattern is deliberate and review-flagged):**
- Every DEFINER function is owned by a dedicated **`wsid_definer` NOLOGIN role** created in M1 (v1.7 §14's non-superuser-owner requirement; the live postgres-owned pattern is a known hazard this lane stops propagating). `wsid_definer` receives exactly the object privileges its function bodies need — enumerated per function in §4 — and nothing else.
- `SET search_path = pg_catalog, public` on every function; `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` then explicit grants; typed SQLSTATEs; FORCE RLS on every table.
- **Least-privilege grants:** `service_role` gets **no DML on any table this lane creates** (SELECT only where §5 says so). All mutation flows through DEFINER RPCs and triggers. This deviates from the legacy `GRANT ALL TO service_role` house pattern on purpose: service_role bypasses RLS, so table grants are its only fence (Gate-0 F9).
- Subject/tenant derived from locked rows or `auth.uid()` — never caller parameters.
- Triggers fire for ALL roles including service_role; invariant guards below are therefore binding even on privileged paths, but grants are minimised anyway (belt AND braces).

---

## §0 Scope map

| Slice | Contents | Status |
|---|---|---|
| S-1 Tenancy core (M1) | workspaces, workspace_members, helpers, create_workspace, personal provisioning, account-deletion hooks | **SPECIFIED — buildable** |
| S-1b Invites | workspace_invites | **PENDING-P9** (spec §1.3 complete; excluded from the M1 build list until Paul confirms) |
| S-2 Scenario scoping (M2) | scenarios.workspace_id + UNIQUE(id,workspace_id), stamping + immutability triggers, 18-row backfill | **SPECIFIED — buildable** |
| S-3 Sensitive substrate (M5) | person_profiles, profile_consent_events, record_consent_event, has_active_consent, get_coaching_profile_for_scenario, delete_person_profile, Gate-2b disposition | **M5 HELD by the Gate-1 verdict** pending CQ-6/R-1/R-2 (ledger identity column depends on the severance ruling); A2 legs F4/F8 additionally sequence execution |
| S-4 Org spine (M3) | orgs, org_members, org_teams, org_team_members, workspace_team_grants, workspaces.org_id+FK | **PENDING-CQ** — shapes referenced (design §2.3 + §6.3 integrity additions); full DDL text lands in the post-CQ revision of THIS document, not in Gate 2 first |
| S-5 Strategy layer (M4) | strategies, strategy_bets, strategy_scenario_links | **PENDING-CQ** for tree/parenting; same treatment as S-4 |
| S-6 Child columns + late policies (M6/M7) | complete child-table disposition §6.5, decision_participants, snapshots reserve, DR workspace policy | shapes specified |

Role vocabulary: `owner > admin > editor > viewer`; `role_rank(role)` = 4/3/2/1 (single encoding).

---

## §1 S-1 — Tenancy core

### 1.1 `workspaces`
```sql
CREATE TABLE public.workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  is_personal BOOLEAN NOT NULL DEFAULT false,
  created_by  UUID NOT NULL,          -- authorship snapshot; NO FK (records-outlive-accounts posture);
                                      -- personal-workspace lifecycle is handled by §1.6, not by FK cascade
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX workspaces_one_personal_per_user_idx
  ON public.workspaces (created_by) WHERE is_personal;
```
- No `org_id` in M1 (lands atomically with the org spine + `CHECK (NOT is_personal OR org_id IS NULL)` in M3 — ratified default).
- Trigger `workspaces_update_guard` (BEFORE UPDATE): rejects change to `id, created_by, is_personal, created_at` (`WS001`). UPDATE allowlist = `name`, `updated_at`.
- Personal-workspace invariants: one per user (index above) · single owner member (§1.2 guards) · no invites (§1.3 guard) · deletion only via the account-deletion path (§1.6) — enforced by absence of any DELETE grant/policy plus trigger `workspaces_delete_guard` (BEFORE DELETE: allow only when `pg_trigger_depth() > 0` from the §1.6 path or under the M-runbook role; else `WS002`).

### 1.2 `workspace_members`
```sql
CREATE TABLE public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('owner','admin','editor','viewer')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE UNIQUE INDEX workspace_members_one_owner_idx
  ON public.workspace_members (workspace_id) WHERE role = 'owner';
CREATE INDEX workspace_members_user_idx ON public.workspace_members (user_id);
```
- `workspace_members_owner_guard` (BEFORE UPDATE OR DELETE): blocks removing/demoting the owner row (`WM409`) except from the §1.6 account-deletion orchestration (session sentinel `app.wsid_deletion` set by that DEFINER path only).
- **`workspace_members_personal_guard` (BEFORE INSERT OR UPDATE)** — closes the second-member hole: on an `is_personal` workspace, only ONE membership row may ever exist and it must be `role='owner'` with `user_id = workspaces.created_by`; anything else → `WM410`. Binds service_role too (trigger, not policy).
- Lifecycle is RPC-only: **no INSERT/UPDATE/DELETE grants to authenticated OR service_role** (§5).

### 1.3 `workspace_invites` — **PENDING-P9** (excluded from the M1 build list; spec retained so P9 is a one-word unblock)
Shape as v1: id / workspace_id FK CASCADE / email / role CHECK (`admin|editor|viewer`) / `token_hash` UNIQUE / status / invited_by (soft ref) / created_at / `expires_at NOT NULL` / accepted_by / accepted_at. `workspace_invites_personal_guard` (BEFORE INSERT → `WI001` on personal). **No table grants to authenticated at all** (admin-or-invitee reads go through a Gate-3 projection RPC that never returns `token_hash`); no service_role DML.

### 1.4 Helpers
`is_workspace_member(p_workspace UUID)` / `is_workspace_role(p_workspace UUID, p_min_role TEXT)` — `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public`, **owner `wsid_definer`**; EXECUTE → authenticated, service_role. Bodies: membership existence / `role_rank(role) >= role_rank(p_min_role)` for `auth.uid()`. Single evolution point (org/team grants extend the member body in S-4; the RLS cutover re-points scenarios' policies here; policy shapes never change — XQ-6). `role_rank(text)`: INVOKER, IMMUTABLE.

### 1.5 `create_workspace` + provisioning
- `create_workspace(p_name TEXT) RETURNS jsonb` — DEFINER (`wsid_definer`); EXECUTE **authenticated only**; creator = `auth.uid()` (NULL → `WS401`); atomically inserts workspace (`is_personal=false`) + owner membership.
- `provision_personal_workspace()` — trigger fn on `auth.users` AFTER INSERT: inserts the personal workspace with exact arbiter syntax
  `INSERT INTO public.workspaces (name, is_personal, created_by) VALUES (v_name, true, NEW.id) ON CONFLICT (created_by) WHERE is_personal DO NOTHING;`
  where `v_name := coalesce(nullif(split_part(NEW.email,'@',1),''), 'Personal workspace')` (non-email accounts — phone/SSO — get the fallback), then the single owner-membership row (idempotent on PK).
- **M1 backfill:** run the same body over `auth.users`; in-transaction assertion is **dynamic** — `count(personal workspaces) = count(auth.users)` at execution time, not a hardcoded 16.

### 1.6 Account-deletion orchestration — v1.2: conditions C1 + C2 folded. The invariants now live in the **auth.users trigger pair**, so every deletion path (RPC, GoTrue admin API, dashboard) is covered — the RPC is a convenience wrapper, not the enforcement point.
- **`auth_users_delete_precheck` (BEFORE DELETE ON auth.users, DEFINER wsid_definer) — C2:** takes `pg_advisory_xact_lock(hashtext(OLD.id::text))` (the SAME lock `create_workspace` takes for its creator — the interleave race is serialised at the DB, not in app code), then re-checks inside the deletion transaction: any surviving **non-personal** owner membership → refuse the deletion (`WM412 transfer_required`). Personal-owner rows pass.
- **`auth_users_delete_cleanup` (AFTER DELETE ON auth.users, DEFINER wsid_definer) — C1:** (i) deletes the personal workspace row (memberships already CASCADEd; sentinel `app.wsid_deletion` satisfies the §1.1/§1.2 guards); (ii) **consent closure fires HERE, not only in the RPC**: terminal `withdraw` events per active stream (actor `system`, source `account_deletion`) + the §3.4a severance hook. *M-sequencing:* M1 ships the trigger with the workspace-cleanup body; **M5 extends the SAME trigger with the consent-closure + severance steps** (the events table does not exist before M5 — the contract binds the trigger body extension to M5's file so no window exists where profiles cascade but ledger closure is RPC-only).
- `account_deletion_orchestrate()` (DEFINER, authenticated-only, subject = `auth.uid()`) remains the user-facing path: it performs the §3.6 profile deletion, then deletes the auth.users row — which fires the trigger pair above. Direct admin deletions get identical invariant enforcement by construction.
- Scenarios' `workspace_id` FK is `ON DELETE SET NULL` — a deleted personal workspace returns its scenarios to the unscoped state, preserving content + authorship (records-outlive-container doctrine).
**CQ-5 remains an M1-semantics question** — the interim transfer-required refusal is explicit and Paul's answer supersedes it.

---

## §2 S-2 — Scenario scoping (M2)

```sql
ALTER TABLE public.scenarios ADD COLUMN workspace_id UUID NULL
  REFERENCES public.workspaces(id) ON DELETE SET NULL;          -- §1.6(2) doctrine
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_id_workspace_key UNIQUE (id, workspace_id);
  -- composite-FK target for §6 child tables (v1 omission — automated finding 1, fixed)
CREATE INDEX scenarios_workspace_idx ON public.scenarios (workspace_id) WHERE workspace_id IS NOT NULL;
```
- **Stamping trigger** `scenarios_stamp_workspace` (BEFORE INSERT), revised guards:
  - `NEW.user_id IS NULL` (guest) → `workspace_id := NULL` (stays unscoped until claim).
  - `NEW.user_id IS NOT NULL` → `workspace_id :=` that user's personal workspace; **if none exists → `WS020` abort** (a non-guest user without a personal workspace is an invariant breach, not a silent NULL — v1 gap fixed).
  - Caller-supplied `NEW.workspace_id` is overridden unconditionally in MVP (callers do not choose tenancy until shared workspaces open).
  - **Trust boundary stated plainly:** the trigger derives from `NEW.user_id`, which on service-role paths is application-supplied. It guarantees *consistency*, not *identity truth* — identity truth is the verified-JWT rule (login 3.4) + v1.7 §20's cross-repo verification of CEE's derivation, which **remains a named Tier-3 cutover blocker**, not replaced by this trigger.
- **Immutability trigger** `scenarios_workspace_immutable` (BEFORE UPDATE): value→different-value rejected (`WS010`); value→NULL rejected except via §1.6(2)'s FK SET NULL (fires as system action, not an UPDATE through this trigger); **NULL→value permitted ONLY in the claim shape** — same statement transitions `user_id` NULL→non-NULL AND the new `workspace_id` equals the claimer's personal workspace; any other NULL→value → `WS011` (v1 allowed arbitrary NULL→value — fixed).
- Backfill: the owned rows (18 at authoring; **recounted dynamically at execution**) stamped to their owners' personal workspaces in-transaction.
- `claim_guest_scenario` amendment (CEE-repo file, META-FLAG): stamps under its existing `FOR UPDATE` lock — the sanctioned NULL→value writer.
- **Scenarios RLS: byte-unchanged in M2** (P3 posture; cutover later re-points policies at the helpers).

---

## §3 S-3 — Sensitive substrate (M5)

### 3.1 `person_profiles`
Shape as v1 (risk_appetite/psychometrics/expertise/decision_style JSONB envelopes + schema_version), plus — **C3: the provenance fence covers ALL projected envelopes**, not just risk_appetite (v1.1 fenced one envelope while expertise/decision_style/psychometrics project to team/org audiences unfenced):
```sql
CONSTRAINT pp_provenance_v1 CHECK (
      (risk_appetite  IS NULL OR risk_appetite->>'provenance' = 'self_reported')
  AND (decision_style IS NULL OR coalesce(decision_style->>'provenance','self_reported') = 'self_reported')
  AND (expertise      IS NULL OR NOT jsonb_path_exists(expertise,
        '$[*].provenance ? (@ != "self_reported")'))
  AND (psychometrics  IS NULL OR NOT jsonb_path_exists(psychometrics,
        '$[*].provenance ? (@ != "self_reported")'))
)   -- 'assessed'/'inferred' RESERVED everywhere until an assessment pathway exists
```
- **Hardening (verdict-adopted): trigger `pp_server_fields` (BEFORE INSERT OR UPDATE)** — forces `updated_at := now()` and `profile_schema_version :=` the server-side current version constant; caller-supplied values for either are overwritten, never trusted.
- RLS (FORCE): owner-only `SELECT/INSERT/UPDATE` policies (`auth.uid() = user_id`). **No DELETE policy and no DELETE grant** — deletion happens ONLY through `delete_person_profile()` (v1 allowed direct DELETE, bypassing consent closure + erasure orchestration — fixed).
- Writes stay **user-JWT direct** (INSERT/UPDATE under owner RLS): this is the ratified design's structural fence (sensitive writes never ride service role) and is retained **deliberately against the reviewer's RPC-only preference** — validation rides CHECK constraints (above + envelope-shape CHECKs), not a DEFINER chokepoint that would reintroduce a service-side trust surface. A1 review may overrule.
- Grants: `REVOKE ALL FROM PUBLIC, anon, service_role;` (**service_role raw SELECT revoked** — v1 granted it; the only sanctioned service read is `get_coaching_profile`, and letting service_role dump raw psychometrics contradicted Lock 0) `GRANT SELECT, INSERT, UPDATE TO authenticated;`

### 3.2 `profile_consent_events` — immutable ledger, **RPC-only writes** (v1's direct authenticated INSERT made every ledger guarantee spoofable: caller-controlled created_at/event_id/version/source, fold manipulation, advisory-lock bypass, cross-user idempotency probes — all closed here)
```sql
CREATE TABLE public.profile_consent_events (
  seq              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,  -- server-controlled TOTAL ORDER;
                                                                     -- the fold orders by seq, nothing else
  event_id         UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id          UUID NOT NULL,               -- soft ref; severance per §3.4a (PENDING mechanism)
  action           TEXT NOT NULL CHECK (action IN ('grant','withdraw','legacy_import')),
  scope            TEXT NOT NULL CHECK (scope IN ('coaching_tone','team_aggregate','view_card',
                                                  'view_profile','contact','dissent_visibility')),
  audience_type    TEXT NOT NULL CHECK (audience_type IN ('self','team','org')),
  audience_team_id UUID NULL,
  audience_org_id  UUID NULL,
  consent_version  TEXT NOT NULL,
  notice_hash      TEXT NOT NULL,               -- sha256 of the exact notice copy shown (verdict: version AND hash)
  actor            TEXT NOT NULL CHECK (actor IN ('self','system','admin_erasure')),
  source           TEXT NOT NULL,               -- server-derived surface tag, from an allowlist
  idempotency_key  TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),               -- informational; NEVER the order
  CONSTRAINT pce_idem UNIQUE (user_id, idempotency_key),             -- per-subject, not global (v1 was a
                                                                     -- cross-user collision probe — fixed)
  CONSTRAINT pce_audience_target CHECK ( … as v1 … ),
  CONSTRAINT pce_scope_audience  CHECK ( … as v1, CQ-16 …)
);
CREATE INDEX pce_fold_idx ON public.profile_consent_events
  (user_id, scope, audience_type,
   coalesce(audience_team_id,'00000000-0000-0000-0000-000000000000'),
   coalesce(audience_org_id, '00000000-0000-0000-0000-000000000000'), seq DESC);
```
- **Fold/index contract (automated finding 2):** the effective-consent query is DEFINED as using the identical `coalesce(...)` expressions as `pce_fold_idx` (expression indexes match only expression-identical predicates); one query, latest-`seq`-wins, `grant`⇒active, `withdraw`⇒inactive, **`legacy_import`⇒NEVER active** (§3.5); Gate-4 carries an `EXPLAIN` assertion that the fold uses the index.
- **Append-only, four layers:** (1) no UPDATE/DELETE policies; (2) `REVOKE INSERT, UPDATE, DELETE, TRUNCATE FROM authenticated, service_role` — **no direct DML for anyone**; SELECT-own via RLS for authenticated, no service_role SELECT (the fold primitive is DEFINER); (3) rejection trigger `pce_immutable` (BEFORE UPDATE OR DELETE → `PC403`, fires even for table-owner paths); (4) owner `wsid_definer` holds INSERT — events enter ONLY through the two DEFINER writers below.
- `record_consent_event(p_action TEXT, p_scope TEXT, p_audience_type TEXT, p_team UUID, p_org UUID, p_consent_version TEXT, p_notice_hash TEXT, p_source TEXT, p_idempotency_key TEXT) RETURNS jsonb` — DEFINER (`wsid_definer`), EXECUTE **authenticated only**; **derives** `user_id = auth.uid()` (NULL → `PC401`), `actor := 'self'`, `created_at := now()`, validates `p_source` against an allowlist and `p_action IN ('grant','withdraw')` (`legacy_import` is migration-only); takes `pg_advisory_xact_lock(hashtext(auth.uid()::text))`. **Idempotent replay (verdict rider): the replayed row must match the requested `(action, scope, audience_type, targets)` — a key-collision with DIFFERENT semantics raises `PC409` instead of silently returning someone's earlier, different event.**
- System writers (terminal-withdraw in §1.6/§3.6, the §3.5 legacy import): DEFINER bodies only — service_role never touches the table.

### 3.3 `has_active_consent(...)` — unchanged shell (DEFINER, service_role-only EXECUTE), body = the §3.2 fold as ONE query (reads need no lock; writers serialise via advisory lock + identity `seq`).

### 3.4 `get_coaching_profile_for_scenario(p_scenario_id UUID)` — the ONLY coaching read (C4: **Shape A is deleted from this contract as an object, not merely ungranted** — an ungranted DEFINER function is a future grant-bug exposure; standing ruling: the trusted-parameter variant must never exist). DEFINER (`wsid_definer`), EXECUTE **service_role only**; derives the subject from the **locked** scenario row (`SELECT user_id FROM scenarios WHERE id = p_scenario_id FOR SHARE`), refuses guest scenarios (`CP404`); returns `'{}'::jsonb` unless `has_active_consent(subject,'coaching_tone','self')`; on consent returns ONLY the `CoachingProfileHints` projection. Dark until Locks 1–3 exist (unchanged).

### 3.4a Identity severance — **PENDING (CQ-6 retention + R-1/R-2 pseudonymise doctrine); S-3 is NOT fully buildable until ruled** (v1 overclaimed "pseudonymous"):
Retaining the auth UUID in events is **linkable-pseudonymous at best** — the same UUID persists in `workspaces.created_by`, `decision_records.owner_user_id`, and other P11-retained records. Options for the ruling:
- **S-A (recommended):** `consent_subjects(subject_id PK, user_id UNIQUE NULL)` indirection; events carry `subject_id`; deletion nulls the mapping (severs linkage while preserving Art.-7 demonstrability); mapping-destruction is the recorded erasure act.
- **S-B:** retain `user_id` and *document* linkable-pseudonymity as the accepted posture given P11 (honest, cheaper, weaker).
The deletion RPC ships either way (severance step is a hook); the events table gains `subject_id` from birth if S-A is chosen — **which is why this ruling precedes M5 execution**.

### 3.5 Gate-2b disposition matrix — v1.1 corrections
As v1 with four changes:
1. **contact_consent → `legacy_import` events, NOT active grants** (v1 overstated: importing old-notice consent as active modern consent claims evidence we don't have). The 5 `true` values import as `action='legacy_import'` (fold-inert, evidence-preserving, `consent_version='legacy-2025-notice'`, `notice_hash='unavailable:pre-ledger'`); **fresh consent through the real UX is required to activate the scope**. Product/legal approval flagged to Paul explicitly.
2. **Classification: the whole P12 file is `forward-fix-only`** — the v1 "shape-only rollback recreates empty columns" is withdrawn: recreating dropped sensitive columns would re-enable dormant writers and re-create the unsafe locus. No rollback recreates them. (v1's "trivially satisfiable" line is also withdrawn — it was true of the four science columns only; contact_consent carries 5 real values and the PII columns 2 rows, and their destruction is exactly why the in-transaction re-verification + Paul's named approval exist.)
3. Wording: user_profiles' end state is a **lower-sensitivity identity/display table** (names + email are personal data; "non-sensitive" was wrong). `pilot_metrics` KEEP is conditional on the pilot-instrumentation lane publishing a key allowlist + writer inventory (flagged to that lane; currently `{}` everywhere).
4. The F3 policy row now cross-references the containment order's own thread (`WORKSTREAM-UPDATE-workspace-3/4`).

### 3.6 `delete_person_profile()` — as v1 (DEFINER, authenticated-only, subject = `auth.uid()`, no subject param), now explicitly a **step inside §1.6's orchestration** (also callable standalone: profile-only deletion without account deletion), with the §3.4a severance hook and the collab name-detach registration (XQ-4).

---

## §4 Function-access matrix (v1.1 — owner column added; `wsid_definer` object-privilege set listed per function)

| Function | Class | Security | Owner | EXECUTE | Subject/tenant derivation | wsid_definer needs |
|---|---|---|---|---|---|---|
| is_workspace_member / is_workspace_role | integrity (M1) | DEFINER STABLE | wsid_definer | authenticated, service_role | auth.uid() in body | SELECT workspace_members |
| role_rank | util | INVOKER IMMUTABLE | wsid_definer | authenticated, service_role | none | — |
| create_workspace | integrity (M1) | DEFINER | wsid_definer | **authenticated only** | auth.uid(), NULL→WS401 | INSERT workspaces, workspace_members |
| provision_personal_workspace | trigger (M1) | DEFINER | wsid_definer | none | NEW.id | INSERT workspaces, workspace_members |
| account_deletion_orchestrate | integrity (M1) | DEFINER | wsid_definer | **authenticated only** (self) + A1-runbook path | auth.uid(); sentinel app.wsid_deletion | DELETE workspaces/members (guarded), INSERT consent events |
| workspaces_update/delete_guard · members_owner/personal_guard · invites_personal_guard · pce_immutable | triggers | DEFINER | wsid_definer | none | row-local | — |
| scenarios_stamp_workspace / scenarios_workspace_immutable | triggers (M2) | DEFINER | wsid_definer | none | NEW.user_id → personal ws; WS020 abort | SELECT workspaces |
| upsert_person_profile | product (G3/G4) | **INVOKER** | n/a | authenticated | auth.uid() via RLS | — |
| record_consent_event | ledger writer (M5) | DEFINER | wsid_definer | **authenticated only** | auth.uid()→PC401; actor/source/time server-set | INSERT profile_consent_events |
| has_active_consent | primitive (M5) | DEFINER STABLE | wsid_definer | **service_role only** | parameterised, DEFINER-internal callers | SELECT profile_consent_events |
| get_coaching_profile_for_scenario (the ONLY coaching read — C4) | Lock 0 (M5 dark) | DEFINER | wsid_definer | **service_role only** | locked scenario row FOR SHARE | SELECT scenarios, person_profiles + has_active_consent |
| delete_person_profile | erasure (M5) | DEFINER | wsid_definer | **authenticated only** | auth.uid(); no subject param | DELETE person_profiles, INSERT consent events |
| claim_guest_scenario (amendment; CEE file) | existing | DEFINER | unchanged (postgres — legacy scope) | service_role only | locked row FOR UPDATE | — |
| create_decision_record (amendment; A1 CEE queue) | existing | DEFINER | unchanged | service_role only | **workspace from locked scenario; caller p_workspace_id refused post-M2** | — |

Bans carried: no client-supplied identity anywhere (`extractJwtSub` class); collab audit's `forbidden-patterns.sh` adopted into Gate-4 CI.

## §5 Exact RLS + grants matrix (charter-form: named policies, exact USING / WITH CHECK, per-role privileges)

### 5.1a `wsid_definer` under FORCE RLS — the policy layer that makes the owner pattern work (v1.2)
`wsid_definer` is a plain NOLOGIN role: it has no `BYPASSRLS` (PG15 `CREATEROLE` cannot mint one — only superusers can, and Supabase's `postgres` is not one), and FORCE RLS applies to non-owners unconditionally. Its DEFINER functions therefore need **explicit role-scoped policies**, one per (table × command) in §4's needs column — e.g. `ws_definer_insert ON workspaces FOR INSERT TO wsid_definer WITH CHECK (true)`, `wm_definer_all ON workspace_members FOR ALL TO wsid_definer USING (true) WITH CHECK (true)`, `pce_definer_insert/select`, `pp_definer_select/delete`, `ws_definer_select ON workspaces/workspace_members FOR SELECT TO wsid_definer USING (true)` (helpers + stamping trigger). These policies are invisible to JWT roles (policies are per-role), keep deny-by-default intact for anon/authenticated/service_role, and are *more* auditable than BYPASSRLS: the definer's reach is enumerated in pg_policies. The trigger guards (§1.1/§1.2) still bind these paths — policy grants access, triggers enforce invariants.

### 5.1 Policies (all tables FORCE RLS; absence of a row = command denied for JWT roles; §5.1a's `TO wsid_definer` rows omitted here for brevity — they mirror §4's needs column exactly)
| Table | Policy (cmd, TO) | USING | WITH CHECK |
|---|---|---|---|
| workspaces | `ws_select_member` (SELECT, authenticated) | `is_workspace_member(id)` | — |
| workspaces | `ws_update_admin` (UPDATE, authenticated) | `is_workspace_role(id,'admin')` | `is_workspace_role(id,'admin')` (column allowlist via trigger WS001) |
| workspace_members | `wm_select_roster` (SELECT, authenticated) | `is_workspace_member(workspace_id)` | — |
| workspace_invites | *(no policies — no JWT-role access at all; Gate-3 RPC only)* | — | — |
| scenarios | **unchanged** (owner-only set, byte-identical pre-cutover) | `auth.uid() = user_id` (existing) | existing |
| person_profiles | `pp_select_own` / `pp_insert_own` / `pp_update_own` (authenticated) | `auth.uid() = user_id` | `auth.uid() = user_id` |
| person_profiles | *(no DELETE policy — RPC-only)* | — | — |
| profile_consent_events | `pce_select_own` (SELECT, authenticated) | `auth.uid() = user_id` | — |
| profile_consent_events | *(no INSERT/UPDATE/DELETE policies — DEFINER-writer-only)* | — | — |
| decision_records | unchanged owner-only; M7 adds `dr_select_workspace` (SELECT, authenticated): `visibility='workspace' AND is_workspace_member(workspace_id)` | | |

### 5.2 Table privileges (after `REVOKE ALL FROM PUBLIC, anon, authenticated, service_role` on every new table)
| Table | anon | authenticated | service_role (RLS-BYPASSING — grants are its only fence) | wsid_definer |
|---|---|---|---|---|
| workspaces | — | SELECT, UPDATE | SELECT | SELECT, INSERT, DELETE |
| workspace_members | — | SELECT | SELECT | SELECT, INSERT, UPDATE, DELETE |
| workspace_invites | — | — | — | SELECT, INSERT, UPDATE |
| person_profiles | — | SELECT, INSERT, UPDATE | — (raw SELECT revoked; Lock-0 RPC is the read) | SELECT, DELETE |
| profile_consent_events | — | SELECT | — | SELECT, INSERT |
| scenarios | unchanged (legacy grants; 1.40 sweep owns the cleanup) | | | + SELECT (stamping trigger) |

### 5.3 Migration classification — v1.1: M5/Gate-2b = **forward-fix-only** (§3.5.2); M1/M2 reversible as v1; M4 forward-fix-only once links exist; ledger-reconciliation hard blocker unchanged (§5.4). **F9's 53-table legacy revoke sweep: recommended to A1 as its OWN bounded security PR** — the verdict permits riding Gate 2, but its compatibility surface (53 tables × legacy readers) deserves separate review; this lane's Gate 2 carries only its own tables' grants.

### 5.4 Ledger reconciliation (unchanged blocker) + one addition: equivalence proof = full catalog diff (tables, columns, constraints, policies, grants, functions, triggers, indexes, comments) against each candidate file — **function-body hashes alone are insufficient**; the Gate-6 runbook designs this; Gate-2 CI rejects cross-repo version collisions.

## §6 Cross-cutting integrity
1–4 as v1 (child-consistency composite FKs · workspace_id immutability · strategy composite-FK set · decision_records derive-from-locked-row), plus:

### 6.5 Complete child-table disposition (v1 omitted two v1.7-named tables — fixed)
| Table | Disposition |
|---|---|
| shared_snapshots | M6: `workspace_id` (composite FK, stamped from parent) |
| v5_conversation_turns / v5_handler_facts | M6: same; per-user privacy class retained (workspace-shared NEVER by default — v1.7 SEC-10) |
| scenario_snapshots | M6: same |
| **shared_briefs** | M6: same (v1.7 §9 names it; 0 rows live) |
| **conversation_turns** | M6: column added for consistency; NOTE v1.7 §18 leaves this table's conversation-scoping decision open — column is inert until that ruling |
| model_versions | M6 spec, **MM lane ratifies** (fence) |
| turn_observations | NO workspace column — per-user science-POC telemetry, owner-scoped, purge-governed; reason recorded |
| backup_013c2_scenarios_graph | no-touch (frozen backup artifact) |
| decision_records | already carries workspace_id; M7 policy only |

## §7 Collab-audit answers — XQ-1 expanded (v1.1; all still **ratification-pending**, and now marked as such in the scope map — not a settled build contract)
**XQ-1 = union, one PRIMARY fabric + one supplementary grant type.** Sub-answers the union must carry (proposals):
- A scenario collaborator does NOT acquire workspace/org membership, workspace browse, strategy access, or decision-record access (records stay owner-only + workspace-visibility; collaborators are outside both).
- Child-row visibility: graph/analysis/coaching surfaces of THAT scenario only; **never** other users' `v5_conversation_turns`/`v5_handler_facts` (per-user privacy class).
- Graph mutation: held_proposal propose-don't-write ONLY (COLLAB-V0 §5) — a collaborator grant is never a write grant.
- Independence: workspace-membership loss does not revoke scenario grants, and vice versa; each revocable at its own surface; both feed ONE helper — `can_access_scenario(p_scenario, p_uid) := is_workspace_member(ws) OR is_scenario_collaborator(...)` — which owns the union (single evolution point, same idiom as §1.4).
- Why this isn't the rejected Design-2 `scenario_grants` model: there, per-scenario ACLs were the PRIMARY tenancy; here workspace tenancy is primary and grants are a bounded share-this-one-thing mechanism (the Google-Docs-link class), with the workspace fabric owning defaults, roles, and lifecycle.
XQ-2/3/4/5/6 as v1.

## §8 PENDING-CQ (org spine + strategy tree)
Shapes referenced (design §2.3/§2.4 + §6.3 additions); ratified defaults applied (team⊆org guard trigger; `is_personal×org_id` CHECK). **Honest status: full DDL text is NOT in this revision** — it lands as a post-CQ revision of THIS contract, and only then does Gate 2 pick it up. Nothing in S-1..S-3 references any org/team object (verified: no FK, helper body, or policy above does).
**Verdict rider (naming vs live DATA):** the new names (`orgs`/`org_members`/`org_teams`) avoid the live *namespace* (`organisations`/`organisation_members`/`teams` — Gate-0 preflight), but the live tables carry real rows (11/14/5 + 3 team_members). The S-4 revision must state the DATA disposition — migrate legacy org/team rows into the new spine vs frozen-forever parallel history — **surfaced to the CQ docket so Paul rules with the collision visible.**

## §9 Gate-4 test-pack obligations — v1 list plus: per-policy tests written against §5.1's EXACT expressions · fold `EXPLAIN` index-use assertion · append-only attack tests (direct INSERT/UPDATE/DELETE as authenticated AND service_role must all fail) · personal-guard race (concurrent second-member INSERT) · account-deletion orchestration walkthrough incl. transfer_required refusal · stamping WS020/WS011 negative cases · claim-shape NULL→value acceptance.

## §10 Review-question dispositions (v1.2 — all ruled in `A1-RULING-F3-AND-GATE1-2026-07-12.md`)
1. ~~Shape A vs B~~ → **Shape B only; Shape A deleted as an object (C4).**
2. ~~JWT-direct vs RPC-only profile writes~~ → **RESOLVED IN FAVOUR of JWT-direct + hardenings** (security reviewer attacked it hardest, no cross-user exploit; server-set-fields trigger + extended provenance CHECK adopted, §3.1).
3. §3.4a S-A vs S-B severance → **still open with Paul (CQ-6/R-1/R-2); M5 HELD on it.**
4. ~~F9 placement~~ → **separate 1.40 revoke batch, confirmed.**
5. ~~v1.7 §22 supersession~~ → **accepted subject to review pass — now satisfied by the Gate-1 verdict.**
6. ~~wsid_definer pattern~~ → **accepted** (see §5.1a for the FORCE-RLS policy mechanics).
**Still open:** #3 above (Paul) · the CQ docket (incl. the §8 data-disposition rider) · P9 · contact_consent legacy-import approval.
