# Legacy teams/decisions disposition and workspace reuse audit

**Brief:** COLLAB-TEAMS-DISPOSITION-AUDIT-v1
**Date:** 2026-06-02
**Branch:** `claude/collab-teams-disposition-audit`, cut from staging head `eab0365f`
**Type:** Read-only investigation. No code, schema, prompt, package, lockfile, config, or test changes. Single deliverable is this file.
**Method:** Source, migration, route, and test inspection (`rg`, file reads, `git show`) plus live read-only Supabase introspection via MCP (`COUNT` and `information_schema` only). Companion documents (verified, not relied on as authority): `docs/audits/collab-surface-recon-v1.md` (branch `claude/collab-surface-recon`, commit `5c98a57c`) and `docs/audits/collab-phase0-audit-v1.md` (branch `claude/collab-phase0-audit`, commit `1e1028bf`). Load-bearing claims (reachability and row counts) were re-verified fresh for this audit.

---

## 1. Executive summary

The legacy `teams` / `team_members` / `decisions` / `invitations` surface is **dead in the shipped product**. The live application is `AppPoC` (`src/main.tsx:108,206` mounts it; `App.tsx` is imported by nothing and is an unmounted legacy shell). `AppPoC` defines no `/teams` or `/decision` route (`src/poc/AppPoC.tsx:911-931`) and is wrapped only in `AuthProvider`, never `TeamsProvider` or `DecisionProvider`. Every teams and decisions component, the teams Navbar link, and the `InviteCollaborators` modal are reachable only inside the unmounted `App.tsx` tree. There is no V5 coupling and no test depends on the teams or decisions contexts.

Live data exists but is developer or test and dormant: 5 teams (newest 2025-06-24), 3 team members across 2 users, 213 decisions across 4 users (newest 2025-10-31), 3 decision collaborators (all the auditee's own accounts, never joined), 6 invitations. No real end-user usage is evident.

**Recommended option: C-lite.** Leave the legacy surface frozen (it already is, de facto), do not migrate it into V5 workspaces, and harvest only useful design and data-model patterns for fresh V5 workspace collaboration. C-lite survived an active falsification attempt: there is no live reachability, no real usage, no V5 coupling, and no value in migrating developer/test data out of dead code.

Environment identity is stated in §5 and is partially unresolved (the active project is named "Olumi"; project notes label it staging; it carries the live V5 data), so this audit avoids absolute production-usage claims.

This decision does not block finalising the Tenancy and RLS Migration Spec. The spec should treat the legacy surface as non-blocking and out of the workspace migration (§9).

---

## 2. Recommendation

**Recommended option: C-lite** (freeze or leave frozen, do not migrate, harvest patterns only).

**Reasoning (evidence-based):** the surface is unreachable in the live app (§3), has no real usage (§5), has no dependency from the V5 scenario flow (§6), and no test or account-deletion path depends on it (§6). Freezing is therefore already true in practice and costs nothing. Migrating it (C-full) would move developer and test data out of dead code into the new model with no user benefit and real schema and role-mapping cost, and it risks contaminating the V5 MVP timeline. Pure B discards genuinely useful UX and data-model patterns that would otherwise be rebuilt from scratch.

**Minimum safe action before collaboration MVP implementation:**
- Confirm the legacy surface stays unmounted (do not re-route `App.tsx` or wire `TeamsProvider`/`DecisionProvider` into `AppPoC`).
- Record in the migration spec that legacy teams/decisions are out of the workspace migration and non-blocking (§9).
- Do not delete anything yet; deletion belongs to a separate V1 decommission workstream. Snapshot the legacy tables before any future drop.

**What not to do (anti-recommendations):**
- Do not port any teams or decisions component as-is. Every one carries V1 assumptions (admin/member roles, decision-scoped sharing, `decisions.team_ids`, the overloaded `invitations` schema).
- Do not migrate `decisions.team_ids`.
- Do not reuse `TeamsContext` or `DecisionContext`.
- Do not treat `canvas_presence` or `decision_collaborators` as canonical collaboration MVP tables. They are prior art only and need a fresh V5 review (§7.3).
- Do not block the migration spec on V1 decommission.

**Migration spec impact (summary; detail in §9):** the spec should state that it does not migrate legacy `teams` into `workspaces`, does not migrate `decisions.team_ids`, treats legacy teams/decisions as non-blocking for workspace tenancy, uses the old member and invite UX as pattern reference only, and leaves V1 decommission as a separate future workstream.

### 2.1 Design guidance for fresh V5 collaboration (decision-grade)

**Patterns genuinely worth harvesting (as reference, rebuilt fresh, see §7):**
- The `ManageTeamMembersModal` member-management UX: tabbed invite (by email and by directory), pending-invite management, multi-email entry, and an edge-function health check. This is the most reusable interaction skeleton for a workspace members panel.
- The `send-team-invite` Edge Function as the invite-email delivery pattern (Brevo), portable with payload and template changes.
- The `decision_collaborators` data model as prior art for a granular permission model: a role plus a `permissions` JSONB (`can_rate`, `can_comment`, `can_suggest`) plus an invite lifecycle (`invited` then `joined`). Prior art only.
- The `canvas_presence` shape as prior art for presence and edit-lock: `cursor_position`, `last_seen`, and `editing_block_id` (a per-element editing signal). Prior art only.
- The `manage_team_invite` / `get_team_invitations` RPC shape as a precedent for an invite-lifecycle RPC.

**Old assumptions that must not be carried forward:**
- The admin/member binary role model. Workspaces need a richer hierarchy (owner/admin/editor/viewer).
- Decision-scoped collaboration. V5 is scenario-scoped; `decision_collaborators` and `InviteCollaborators` bind sharing to a `decisionId`, which does not map to scenarios.
- The `decisions.team_ids uuid[]` sharing model: an array with no foreign key and no RLS-enforced membership. Tenancy must be enforced through `workspace_members` and RLS, not array membership.
- Conflating "team member" with "decision collaborator". `InviteCollaborators` invites someone to a decision through the teams context; the two concepts are merged in V1 and must be separated in V5.
- The overloaded unified `invitations` table (one table mixing `team_id`, `decision_role`, and `organisation_id`). Workspace invites should be a clean `workspace_invites` table.

**What fresh V5-aligned architecture should do instead:**
- Build `workspaces` / `workspace_members` / `workspace_invites` fresh (phase-0 Branch B), with membership enforced by RLS and a `is_workspace_member()` helper.
- Scope membership to scenarios through the workspace, not to a legacy decision.
- Build presence greenfield (a fresh table or a Supabase Realtime channel per scenario), informed by the `canvas_presence` shape. Note the live app has no Supabase Realtime today; the only realtime is SSE for streaming (companion audit §5).
- Implement suggest-mode through the existing validate-patch and event-log plumbing (`apply_patch_and_log`), with a single-host edit lock, never CRDT. Note the canvas event log is currently fed only by AI patches, not manual edits (companion audit §3); that is a separate P1 to resolve in the canvas brief.
- Build per-element comments as a new `element_comments` table (it does not exist anywhere today), informed by the `canvas_comments` shape (`block_id`, `parent_id`, `position`, `resolved_by`) but built fresh.

**What feeds which upcoming brief:**
- Workspace UI brief: `ManageTeamMembersModal`, `MyTeams`, `TeamDetails` UX patterns; a tenant switcher pattern from `MyTeams`.
- Presence brief: the `canvas_presence` schema as prior art (cursor, last seen, editing-block lock signal).
- Suggestion queue brief: a dead `decision_suggestions` table exists as prior art; the queue itself should ride the patch and event-log model.
- Comments brief: the `canvas_comments` schema as prior art; `element_comments` is a fresh table.
- Snapshots brief: `scenario_snapshots` already exists in V5 and is unrelated to teams; out of scope here.

**What to keep out of the collaboration MVP:**
- Any migration of teams/decisions data.
- `TeamsContext` and `DecisionContext`.
- `decisions.team_ids`.
- Binding collaboration to the legacy decisions flow.
- Reuse of the overloaded `invitations` schema.
- V1 decommission work (removing routes from `App.tsx`, dropping legacy tables). That is a separate future workstream.

---

## 3. Route and reachability inventory (Q1)

Headline: the live app is `AppPoC`. The legacy teams and decisions routes exist only in the unmounted `App.tsx`. There is no reachable back-door. This was tested adversarially (redirects, navigation, modals, deep links, onboarding, settings, command palette) and no path was found.

| Path / entry point | Component | Linked from live nav? | Deep-link only? | Auth required? | Still active in live app? | Evidence |
|---|---|---|---|---|---|---|
| `/teams` | `MyTeams` | No | No (route absent in live app) | n/a | No | Route defined in `App.tsx:252` (unmounted); `AppPoC` routes have no `/teams` (`src/poc/AppPoC.tsx:911-931`) |
| `/teams/:teamId` | `TeamDetails` | No | No | n/a | No | `App.tsx:262` (unmounted) |
| `/decision*` (V1 decision flow) | DecisionList, DecisionForm, etc. | No | No | n/a | No | Decision routes in `App.tsx` only; absent from `AppPoC` |
| Teams nav link | `navigation/Navbar.tsx:150` `<NavLink to="/teams">` | No | n/a | n/a | No | `Navbar.tsx` imported only by `App.tsx:16`; `AppPoC` renders no such nav |
| Invite collaborators modal | `InviteCollaborators` | No | n/a | n/a | No | Imported only by `GoalClarificationScreen.tsx` and `OptionsIdeation.tsx`, both in the unmounted `App.tsx` decision flow |
| Live app entry | `AppPoC` | n/a | n/a | Yes (AuthProvider) | Yes | `src/main.tsx:108,206`; routes are scenario/canvas/brief/sandbox only |

Falsification attempts and results:
- Redirect or `<Navigate>` to `/teams` or `/decision` in the live tree: **none** (only sandbox-guide text mentioning "options/decisions" as graph semantics, not routes).
- `TeamsProvider`/`DecisionProvider` mounted by `AppPoC`: **no** (only `AuthProvider`, `src/poc/AppPoC.tsx:894-897`).
- `InviteCollaborators`/`ManageTeamMembersModal`/`MyTeams`/`TeamDetails` rendered in the live tree: **no** (App.tsx tree only).
- Command palette, onboarding, settings/profile link into teams: **none found**.

---

## 4. Legacy schema and RPC inventory (Q3)

| Item | Type | Purpose | Status | Evidence |
|---|---|---|---|---|
| `teams` | Table | Team container | Legacy, live rows (dev/test) | `supabase/migrations/20250512143948_stark_coast.sql` |
| `team_members` | Table | Membership (role admin/member) | Legacy, live rows | same migration; `team_id` FK `ON DELETE CASCADE` |
| `decisions` | Table | V1 decision records | Legacy, live rows | `20250125182637_quiet_mountain.sql` |
| `decisions.team_ids` | Column `uuid[]` | Team-scoped sharing (no FK) | Legacy | `20250512143948_stark_coast.sql:49` |
| `decision_collaborators` | Table | Per-decision collaborators (role, permissions JSONB, invite lifecycle) | Legacy, live rows | columns: `role`, `status`, `permissions`, `invited_at`, `joined_at` |
| `invitations` | Table | Unified invites (`team_id`, `role`, `decision_role`, `organisation_id`) | Legacy, live rows | the live invite table; **no `team_invitations` table exists** |
| `invitation_logs` | Table | Invite delivery tracking | Legacy, 0 rows | `information_schema` |
| `is_team_admin(team_uuid)` | RPC, SECURITY DEFINER | Admin check | Legacy | `20250514134121_misty_rain.sql:36` (and earlier defs) |
| `is_team_member(team_uuid)` | RPC | Membership check | Legacy | `20250512173154_empty_fountain.sql:45` |
| `check_team_admin_access(team_uuid)` | RPC | Admin access | Legacy | `20250514144647_steep_lab.sql:27` |
| `check_team_member_access(team_uuid)` | RPC | Member access | Legacy | `20250514144647_steep_lab.sql:46` |
| `get_team_invitations(team_uuid)` | RPC | List invites | Legacy | `20250513222840_calm_sky.sql:18`, `20250513224608_fancy_block.sql:29` |
| `manage_team_invite(...)` | RPC | Create/accept/reject invite | Legacy | `20250513224608_fancy_block.sql:77`, `20250513230302_falling_glade.sql:19` |
| `add_team_member(...)` | RPC | Add member | Legacy | `20250514151624_floral_band.sql:18` |
| `send-team-invite` | Edge Function | Invite email via Brevo | Legacy, invoked only from unmounted UI | `supabase/functions/send-team-invite/index.ts` |
| `TeamsContext` (312 ln) | React context | Teams CRUD, members, invites | Legacy, mounts in `App.tsx` only | `src/contexts/TeamsContext.tsx` |
| `DecisionContext` (280 ln) | React context | V1 decision state plus a `decision_collaborators` Supabase Realtime subscription | Legacy, mounts in `App.tsx` only | `src/contexts/DecisionContext.tsx` |
| Teams components | UI | MyTeams (201), TeamDetails (175), CreateTeamModal (115), EditTeamModal (116), ManageTeamMembersModal (452), UserDirectoryTab, DirectoryUserCard | Legacy | `src/components/teams/` |
| `InviteCollaborators` (123 ln) | UI modal | Invite to a decision via teams context | Legacy | `src/components/InviteCollaborators.tsx` |
| Decisions components | UI | DecisionList (768), DecisionForm (379), DecisionEdit (236), decision-flow screens | Legacy | `src/components/decisions/`, `src/components/` |

Note the only live Supabase Realtime subscriptions in the repo are in `DecisionContext` (`decision_collaborators`) and `useDecisionOptions` (`options`), both in the unmounted tree, so neither runs in the shipped app.

---

## 5. Live usage and row counts (Q2)

**Supabase environment identity.** The queried project is named **"Olumi"** (ref `etmmuzwxtcjipwphdola`, us-east-1, ACTIVE_HEALTHY, created 2025-02-02). It is the single active project holding the live V5 data (scenarios active to 2026-05-30). Project notes label it "staging", but it carries the real V5 usage, so its formal staging-versus-production status is **not definitively resolved from MCP**. This audit therefore avoids absolute production-usage claims. A separate active project, "Olumi-EarlyAccess" (`ewyskeampbmbagyclvfn`, eu-west-2), is a stub with one `early_access` table and 0 rows, so it holds no teams or decisions data. A third project is inactive and was not queried.

**Counts (live-verified, Olumi, read-only):**

| Table | Rows | Distinct users | Newest | Note |
|---|---|---|---|---|
| `teams` | 5 | 3 creators | 2025-06-24 | 3 named "test 1/2/3", 2 empty "Default Team" |
| `team_members` | 3 | 2 | n/a | developer/test accounts only |
| `decisions` | 213 | 4 | 2025-10-31 | 176 carry `team_ids` |
| `decision_collaborators` | 3 | 3 | n/a | one decision, all "invited", never joined |
| `invitations` | 6 | n/a | n/a | unified invite table |
| `invitation_logs` | 0 | n/a | n/a | empty |

**Usage classification.** All rows trace to developer or test accounts (the team creators are a test account and the developer's own accounts; the decision collaborators are the auditee's own accounts, all stuck at "invited"). The newest team is roughly 11 months old and the newest decision roughly 7 months old. The honest characterisation is **developer/test and dormant**, with **no real end-user usage evident**. This is live-verified, not code-reachability only. PII is not reproduced here; only counts, account-class, and dates are reported.

---

## 6. Code dependency and breakage analysis (Q4)

Freezing means leaving the surface unmounted (its current state). Nothing in the live app or the test suite depends on it.

| Surface / data | Impact if frozen or hidden | Risk | Mitigation | Evidence |
|---|---|---|---|---|
| `/teams`, `/teams/:teamId`, `/decision*` routes | None; already absent from the live app | None | None needed | `AppPoC` routes (`src/poc/AppPoC.tsx:911-931`) |
| Teams nav link | None; rendered only by unmounted `Navbar` | None | None | `navigation/Navbar.tsx:150`, imported by `App.tsx` only |
| `send-team-invite` Edge Function | None; invoked only from unmounted `ManageTeamMembersModal` | None | Leave deployed or retire with V1 decommission | import trace |
| Account deletion | None; `delete-account` does not reference teams | None | None | `supabase/functions/delete-account/` (no team refs) |
| Tests | None; **zero tests import `useTeams`/`useDecision`/the contexts** | None | None | repo-wide grep; "decisions" test hits are V5 canvas/results UI text |
| `decisions.team_ids` | Becomes inert `uuid[]` referencing frozen teams | None | None (no FK, no RLS dependency) | `stark_coast.sql:49` |
| V5 scenario flow dependency on teams/decisions | None; no import or table access from `src/poc`, `src/routes/CanvasMVP.tsx`, `src/canvas/**`, `src/components/results/**` | None | None | grep returns no coupling |

Conclusion: freezing breaks nothing. Even deletion would break no test, though deletion belongs to the separate V1 decommission workstream, not this decision.

---

## 7. Component reuse map (Q5)

Verdict scale: port as-is, port with changes, pattern reuse only, discard. The strict rule applies: do not recommend porting any component carrying V1 `decisions`, `team_ids`, admin/member-only roles, or decision-scoped assumptions.

| Component | What it does | Workspace MVP equivalent | Reuse verdict | Why | Effort | Evidence |
|---|---|---|---|---|---|---|
| `ManageTeamMembersModal` | Tabbed invite (email/directory), pending-invite management, edge-function health check, dual team+decision roles | Members panel and invite flow | Pattern reuse only | Best UX skeleton, but bound to `useTeams`, `Team`, `Invitation`, dual-role model | L | `src/components/teams/ManageTeamMembersModal.tsx` (452 ln) |
| `MyTeams` | List of teams | Tenant switcher / workspace list | Pattern reuse only | Listing and switching pattern reusable; backing query rebuilt | M | `src/components/teams/MyTeams.tsx` (201 ln) |
| `TeamDetails` | Team detail, members, actions | Workspace detail | Pattern reuse only | Layout reusable; roles and data rebuilt | M | `src/components/teams/TeamDetails.tsx` (175 ln) |
| `CreateTeamModal` | Create team | Create workspace | Pattern reuse only | Trivial form; rebuild against workspace model | S | `src/components/teams/CreateTeamModal.tsx` (115 ln) |
| `EditTeamModal` | Edit team | Edit workspace | Pattern reuse only | As above | S | `src/components/teams/EditTeamModal.tsx` (116 ln) |
| `InviteCollaborators` | Single-email invite to a decision via `useTeams().inviteTeamMember(decisionId, ...)` | Invite flow | Pattern reuse only | UX shell reusable; logic is decision-scoped and conflates member/collaborator | S | `src/components/InviteCollaborators.tsx` (123 ln) |
| `TeamsContext` | Teams CRUD, members, invites | Workspace context | Discard | Bound to teams tables, admin/member roles, `get_team_invitations`; rebuild clean | M | `src/contexts/TeamsContext.tsx` (312 ln) |
| `DecisionContext` | V1 decision state plus `decision_collaborators` realtime | (none) | Discard | Decision-scoped; V5 is scenario-scoped | M | `src/contexts/DecisionContext.tsx` (280 ln) |
| `send-team-invite` (Edge Function) | Brevo invite email | Workspace invite email | Port with changes | Email send reusable; change payload (`team_id` to `workspace_id`) and template | S | `supabase/functions/send-team-invite/` |

### 7.3 Data-model prior art (reference only, fresh V5 review required)

Per the brief, treat these as prior art, not as canonical MVP tables:
- `decision_collaborators` (role + `permissions` JSONB `{can_rate, can_comment, can_suggest}` + `invited`/`joined` lifecycle) is a useful precedent for a granular workspace and element permission model. Do not adopt it as the workspace membership table; design `workspace_members` fresh with the owner/admin/editor/viewer hierarchy.
- `canvas_presence` (`cursor_position`, `last_seen`, `editing_block_id`) is a useful precedent for presence and a single-host or per-element edit lock. Do not adopt it as the V5 presence table without a fresh review; it belongs to an orphaned earlier product generation (companion audit §8) and the new presence layer should be designed against the V5 canvas store.

---

## 8. Disposition options (Q6)

| Dimension | B: freeze/hide | C-lite: freeze/hide + harvest patterns | C-full: migrate into workspaces |
|---|---|---|---|
| Implementation simplicity | Highest (already frozen) | High (no migration; reference only) | Low (data migration, role mapping, `team_ids` handling) |
| Product clarity | Good | Good | Mixed (carries V1 concepts forward) |
| Data retention | Retained frozen | Retained frozen | Migrated (dev/test data) |
| Risk | Lowest | Low | Higher (timeline contamination, V1 assumptions leak into V5) |
| Routes/nav/tests/Edge Functions | Already inert | Already inert; patterns referenced | Must rebuild and migrate |
| Collaboration MVP impact | Neutral | Positive (accelerates fresh UX via patterns) | Negative (delay and contamination risk) |
| Migration spec impact | Exclude legacy | Exclude legacy; cite patterns as reference | Include a teams-to-workspaces migration |

Falsification of C-lite (actively attempted):
- Live reachability that would force handling before freeze: **none** (§3).
- Real usage that would justify migration: **none evident**; all developer/test, dormant (§5).
- V5 coupling that would force coordinated change: **none** (§6).
- A reason to migrate rather than rebuild: **none**; the data is dev/test and the role model differs.

C-lite is not overturned by the evidence.

---

## 9. Migration spec impact (provisional, pending v1.2 documents)

The named v1.2 documents (`olumi-collaboration-mvp-scope-contract-v1_2.md`, `olumi-tenancy-rls-migration-spec-v1_2.md`, `olumi-cc-development-standards-v3.md`) are not on disk. Per the agreed approach, this section is intent-level and tagged provisional; it will be made section-referenced once the spec is supplied.

Provisional, intent-level deltas the Tenancy and RLS Migration Spec should adopt:
- **MS-1.** State explicitly that the spec does **not** migrate legacy `teams`/`team_members` into `workspaces`/`workspace_members`. Build the workspace tables fresh (Branch B).
- **MS-2.** State that the spec does **not** migrate `decisions.team_ids`. It is a `uuid[]` with no foreign key and no RLS-enforced membership, and all rows are developer/test. Leave it inert.
- **MS-3.** Record that legacy `teams`/`decisions` are **non-blocking** for workspace tenancy: they are unmounted, unreachable, and have no V5 coupling, so the spec can finalise without resolving them.
- **MS-4.** Note that the old member and invite UX is **pattern reference only**; no legacy component or context is reused as-is (§7).
- **MS-5.** Record that **V1 decommission** (removing the dead `App.tsx` routes, dropping `teams`/`team_members`/`decisions`/`invitations`/`decision_collaborators`, retiring `send-team-invite`) is a **separate future workstream**, sequenced after V1 sunset, not part of the tenancy migration.
- **MS-6 (schema hygiene, cross-reference).** The spec's any "expand then backfill then switch" plan should note that the live "Olumi" project also carries orphaned tables with no migration provenance in this repo (`canvas_*`, `organisations`, `organisation_members`; companion audit §8), which collide by name with the planned schema (`canvas_presence`, `canvas_comments` versus `element_comments`, `organisations` versus `workspaces`). The namespace is not clean.

Nothing here blocks finalising the spec; these are inclusions and exclusions, not open blockers.

---

## 10. Risks, unknowns, and open decisions

- **Environment identity unresolved.** The active project is named "Olumi" and carries live V5 data; project notes call it staging. Its formal production-versus-staging status is not resolved from MCP. The developer/test-and-dormant characterisation of teams/decisions holds regardless of this label, but absolute production claims are avoided.
- **Orphaned, data-bearing legacy tables (cross-reference).** `canvas_*` and `organisations` tables exist live with no repo provenance and no current code (companion audit §8). They are out of this audit's teams/decisions scope but matter for naming collisions during the workspace migration (MS-6).
- **Dead-code ballast.** The unmounted `App.tsx` and its teams/decisions subtree remain in the repo. Leaving them is low-risk (they do not run) but they are confusing. Removal is the V1 decommission workstream, not this decision.
- **If real usage is later found.** No real end-user usage is evident. If any is later discovered on `teams` or `decisions`, the minimum safe path is freeze and hide (do not delete), snapshot the tables before any structural change, and gate any drop on explicit confirmation that no row belongs to a real user.
- **Out of scope but noted (cross-reference).** The companion audit flagged `cee_prompt_observations` with RLS disabled (0 rows, latent). Not a teams/decisions concern; recorded for the security backlog.

---

## Appendix A: base commit and method

- **Branch:** `claude/collab-teams-disposition-audit`, created from staging head `eab0365f5ac25da83efa74300c12d98f60c0179f`. Working tree clean at branch creation. This audit adds exactly one file. No push.
- **Supabase MCP:** available and used read-only (`COUNT`, `information_schema`). Project queried: "Olumi" (`etmmuzwxtcjipwphdola`). Live counts were measured (not code-reachability only).
- **Companion documents:** `docs/audits/collab-surface-recon-v1.md` (commit `5c98a57c`), `docs/audits/collab-phase0-audit-v1.md` (commit `1e1028bf`), boundary contract v1.1 (`olumi-assistants-service/Docs/v5/`). Load-bearing claims re-verified fresh against code and DB.
- **Method:** route and provider tracing from `src/main.tsx`, `rg` over `src/` and `supabase/`, migration reads, and read-only SQL. No code, schema, prompt, package, lockfile, config, or test files changed.

## Appendix B: raw query and search outputs

**Live counts (Olumi, single read-only query):**
```
teams=5 teams_newest=2025-06-24
team_members=3 team_member_users=2
decisions=213 decision_users=4 decisions_newest=2025-10-31 decisions_with_team_ids=176
decision_collaborators=3
invitations=6 invitation_logs=0
```

**Reachability and inventory greps:**
```
src/main.tsx:108,206                         mounts AppPoC (App.tsx imported by nothing)
src/poc/AppPoC.tsx:911-931                    live routes: no /teams, no /decision
src/poc/AppPoC.tsx:894-897                    wrapped only in AuthProvider
InviteCollaborators imported by              GoalClarificationScreen.tsx, OptionsIdeation.tsx (App.tsx tree only)
live-tree /teams|/decision references         none (only sandbox-guide graph-semantics text)
navigation/Navbar.tsx:150                     <NavLink to="/teams"> (imported by App.tsx only)
RPCs: is_team_admin                           20250514134121_misty_rain.sql:36 (and earlier)
      get_team_invitations                    20250513222840_calm_sky.sql:18; 20250513224608_fancy_block.sql:29
      check_team_admin_access/member_access   20250514144647_steep_lab.sql:27,46
      add_team_member                         20250514151624_floral_band.sql:18
      manage_team_invite                      20250513224608_fancy_block.sql:77; 20250513230302_falling_glade.sql:19
team_invitations CREATE TABLE                 none (invites live in 'invitations')
decisions.team_ids                            20250512143948_stark_coast.sql:49 (uuid[] DEFAULT '{}')
tests importing useTeams/useDecision/contexts none
V5 -> teams/decisions coupling                none (src/poc, src/routes/CanvasMVP, src/canvas, src/components/results)
```

---

*End of audit*
