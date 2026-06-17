/**
 * Workspace tenancy migration contract tests (static, no database).
 *
 * These validate the DRAFT collaboration DDL structure and guardrails as TEXT.
 * They model the approach of src/canvas/analysis/__tests__/persistenceContract.spec.ts:
 * read the migration SQL and assert expected structural tokens.
 *
 * LIMITS (stated explicitly): a passing suite proves only that the draft SQL
 * contains the expected structural tokens and guardrails. It does NOT prove SQL
 * syntax validity, that the migration applies, RLS behavioural correctness,
 * SECURITY DEFINER execution safety, service-role workspace resolution, Realtime
 * channel security, or migration rollback/cutover safety. Syntactic and
 * behavioural validation are deferred to a rehearsal environment and the
 * executable SEC/TEN matrix. See docs/audits/collab-foundation-blocker-checklist-v1.md.
 *
 * The files under test are DRAFT, not for canonical application, not for merge/deploy.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations')

const foundationSql = readFileSync(
  resolve(MIGRATIONS_DIR, '20260617000000_workspaces_foundation_draft.sql'),
  'utf-8',
)
const cutoverSql = readFileSync(
  resolve(MIGRATIONS_DIR, '20260617000001_scenarios_workspace_cutover_draft.sql'),
  'utf-8',
)

// ---------------------------------------------------------------------------
// Guardrails required on BOTH draft files
// ---------------------------------------------------------------------------
describe.each([
  ['foundation', foundationSql],
  ['cutover', cutoverSql],
])('%s draft — safety guardrails', (_name, sql) => {
  it('has a loud DRAFT warning header', () => {
    expect(sql).toMatch(/DRAFT COLLABORATION/i)
    expect(sql).toMatch(/DO NOT APPLY/i)
  })

  it('contains an abort guard that fails safely if applied', () => {
    expect(sql).toContain('RAISE EXCEPTION')
    expect(sql).toContain('must not be applied')
    expect(sql).toMatch(/DO \$\$ BEGIN/)
  })

  it('states it is not for canonical application', () => {
    expect(sql).toMatch(/not for canonical application/i)
  })

  it('states it is not for merge or deploy', () => {
    expect(sql).toMatch(/not for merge or deploy/i)
  })
})

// ---------------------------------------------------------------------------
// Foundation file — additive workspace tables, helpers, lifecycle RPCs
// ---------------------------------------------------------------------------
describe('workspaces_foundation draft — structural contract', () => {
  const sql = foundationSql

  it('creates the three workspace tables', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS workspaces')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS workspace_members')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS workspace_invites')
  })

  it('enables and forces RLS on all three tables', () => {
    for (const t of ['workspaces', 'workspace_members', 'workspace_invites']) {
      expect(sql).toContain(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`)
      expect(sql).toContain(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY`)
    }
  })

  it('revokes anon access on all three tables (no anon grants)', () => {
    expect(sql).toContain('REVOKE ALL ON workspaces FROM anon')
    expect(sql).toContain('REVOKE ALL ON workspace_members FROM anon')
    expect(sql).toContain('REVOKE ALL ON workspace_invites FROM anon')
  })

  it('defines membership and role helpers as SECURITY DEFINER with explicit search_path', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION is_workspace_member')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION is_workspace_role')
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain('SET search_path = pg_catalog, public')
  })

  it('revokes EXECUTE from PUBLIC on helpers and RPCs', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION is_workspace_member\(uuid\) FROM PUBLIC/)
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION is_workspace_role\(uuid, text\) FROM PUBLIC/)
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION create_workspace\(text, boolean\) FROM PUBLIC/)
  })

  it('provides an owner-atomic create_workspace RPC that seeds an owner member', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION create_workspace')
    expect(sql).toMatch(/INSERT INTO workspace_members[\s\S]*'owner'/)
  })

  it('enumerates the role hierarchy in a CHECK constraint', () => {
    expect(sql).toMatch(/CHECK\s*\(\s*role\s+IN\s*\(\s*'owner'.*'admin'.*'editor'.*'viewer'/i)
  })

  it('represents the single-owner invariant via a partial unique index', () => {
    expect(sql).toContain('idx_workspace_members_single_owner')
    expect(sql).toMatch(/WHERE\s+role\s*=\s*'owner'/i)
  })

  it('represents the personal-workspace invariant', () => {
    expect(sql).toContain('is_personal')
    expect(sql).toMatch(/personal-workspace invariant/i)
  })

  it('stores a hashed invite token, not a raw token', () => {
    expect(sql).toContain('token_hash')
    expect(sql).toMatch(/hashed, not raw-token stored/i)
    // No raw "token text" column should exist.
    expect(sql).not.toMatch(/\btoken\s+text\b/i)
  })

  it('does not permit workspace deletion (no DELETE policy)', () => {
    expect(sql).not.toMatch(/FOR\s+DELETE/i)
  })

  it('exposes member and invite lifecycle RPC skeletons', () => {
    for (const fn of [
      'add_workspace_member',
      'remove_workspace_member',
      'change_workspace_member_role',
      'create_workspace_invite',
      'accept_workspace_invite',
      'revoke_workspace_invite',
    ]) {
      expect(sql).toContain(`CREATE OR REPLACE FUNCTION ${fn}`)
    }
    // admin cannot grant owner is represented
    expect(sql).toMatch(/cannot grant owner/i)
  })
})

// ---------------------------------------------------------------------------
// Cutover file — end-state tenancy cutover DDL (blocked)
// ---------------------------------------------------------------------------
describe('scenarios_workspace_cutover draft — structural contract', () => {
  const sql = cutoverSql

  it('is labelled end-state DDL, not the real application sequence', () => {
    expect(sql).toMatch(/END-STATE DDL/i)
    expect(sql).toMatch(/not the real application sequence/i)
  })

  it('names the v1.7 §20 phased process (expand, backfill, assert, switch, rehearse)', () => {
    expect(sql).toMatch(/expand[\s\S]*backfill[\s\S]*assert[\s\S]*switch[\s\S]*rehearse/i)
  })

  it('lists the blocked-until gates', () => {
    expect(sql).toMatch(/golden journey/i)
    expect(sql).toContain('VITE_SUPABASE_URL')
    expect(sql).toMatch(/rehearsal/i)
  })

  it('adds workspace_id to scenarios with a composite consistency key', () => {
    expect(sql).toMatch(/ALTER TABLE scenarios[\s\S]*ADD COLUMN IF NOT EXISTS workspace_id/i)
    expect(sql).toContain('UNIQUE (id, workspace_id)')
  })

  it('represents the child workspace_id consistency pattern via composite FK', () => {
    expect(sql).toContain('REFERENCES scenarios(id, workspace_id)')
  })

  it('represents workspace_id immutability', () => {
    expect(sql).toContain('enforce_workspace_id_immutable')
    expect(sql).toMatch(/workspace_id is immutable/i)
  })

  it('includes H-1+ hardening for both CEE per-user tables', () => {
    expect(sql).toContain('ALTER TABLE v5_conversation_turns FORCE ROW LEVEL SECURITY')
    expect(sql).toContain('ALTER TABLE v5_handler_facts FORCE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE ALL ON v5_conversation_turns FROM anon')
    expect(sql).toContain('REVOKE ALL ON v5_handler_facts FROM anon')
    expect(sql).toMatch(/TO authenticated/)
  })

  it('references the CEE service-role paths as a cross-repo blocker, not solved here', () => {
    expect(sql).toContain('append_turn_atomic')
    expect(sql).toContain('ensure_scenario_exists')
    expect(sql).toContain('store_draft_graph')
    expect(sql).toMatch(/CROSS-REPO BLOCKER/i)
    expect(sql).toMatch(/NOT SOLVED HERE/i)
  })
})
