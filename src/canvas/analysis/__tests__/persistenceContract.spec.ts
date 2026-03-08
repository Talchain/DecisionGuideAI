/**
 * Persistence contract tests — scenario_snapshots + conversation_turns.
 *
 * These are schema contract tests that validate the migration SQL structure
 * and RPC contracts. They do NOT require a live Supabase connection.
 * CI integration tests (with real Supabase) are in a separate suite.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const MIGRATIONS_DIR = resolve(__dirname, '../../../../supabase/migrations')

describe('scenario_snapshots migration contract', () => {
  const sql = readFileSync(resolve(MIGRATIONS_DIR, '20260309000000_scenario_snapshots.sql'), 'utf-8')

  it('creates scenario_snapshots table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS scenario_snapshots')
  })

  it('has required columns', () => {
    expect(sql).toContain('scenario_id')
    expect(sql).toContain('user_id')
    expect(sql).toContain('graph')
    expect(sql).toContain('analysis')
    expect(sql).toContain('brief_text')
    expect(sql).toContain('brief_hash')
    expect(sql).toContain('seed')
    expect(sql).toContain('quality_mode')
    expect(sql).toContain('graph_hash')
    expect(sql).toContain('created_at')
  })

  it('enables ROW LEVEL SECURITY', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('FORCE ROW LEVEL SECURITY')
  })

  it('has SELECT and INSERT policies only (immutable — no UPDATE)', () => {
    expect(sql).toContain('select_own_snapshots')
    expect(sql).toContain('insert_own_snapshots')
    // No UPDATE policy should exist
    expect(sql).not.toMatch(/FOR\s+UPDATE/i)
    // No DELETE policy (cascade from scenarios handles cleanup)
    expect(sql).not.toMatch(/FOR\s+DELETE/i)
  })

  it('creates create_snapshot RPC with SECURITY DEFINER', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION create_snapshot')
    expect(sql).toContain('SECURITY DEFINER')
  })

  it('create_snapshot includes ownership check', () => {
    expect(sql).toContain('user_id = auth.uid()')
    expect(sql).toMatch(/forbidden/i)
  })

  it('cascades on scenario delete', () => {
    expect(sql).toContain('ON DELETE CASCADE')
  })

  it('revokes public access from create_snapshot', () => {
    expect(sql).toContain('REVOKE ALL ON FUNCTION create_snapshot FROM PUBLIC')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION create_snapshot TO authenticated')
  })
})

describe('conversation_turns migration contract', () => {
  const sql = readFileSync(resolve(MIGRATIONS_DIR, '20260309000001_conversation_turns.sql'), 'utf-8')

  it('creates conversation_turns table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS conversation_turns')
  })

  it('has required columns', () => {
    expect(sql).toContain('scenario_id')
    expect(sql).toContain('user_id')
    expect(sql).toContain('snapshot_id')
    expect(sql).toContain('analysis_snapshot_id')
    expect(sql).toContain('role')
    expect(sql).toContain('content')
    expect(sql).toContain('structured_blocks')
    expect(sql).toContain('client_turn_id')
    expect(sql).toContain('created_at')
  })

  it('enforces role check constraint', () => {
    expect(sql).toMatch(/CHECK\s*\(\s*role\s+IN\s*\(\s*'user'.*'assistant'.*'system'/i)
  })

  it('enables ROW LEVEL SECURITY', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('FORCE ROW LEVEL SECURITY')
  })

  it('has SELECT and INSERT policies only (append-only — no UPDATE)', () => {
    expect(sql).toContain('select_own_turns')
    expect(sql).toContain('insert_own_turns')
    expect(sql).not.toMatch(/FOR\s+UPDATE/i)
  })

  it('has idempotency index on client_turn_id', () => {
    expect(sql).toContain('idx_turns_idempotency')
    expect(sql).toContain('client_turn_id')
    expect(sql).toMatch(/WHERE\s+client_turn_id\s+IS\s+NOT\s+NULL/i)
  })

  it('creates insert_conversation_turn RPC with ownership check', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION insert_conversation_turn')
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain('user_id = auth.uid()')
    expect(sql).toMatch(/forbidden/i)
  })

  it('insert_conversation_turn uses ON CONFLICT DO NOTHING for idempotency', () => {
    expect(sql).toContain('ON CONFLICT')
    expect(sql).toContain('DO NOTHING')
  })

  it('cascades on scenario delete', () => {
    expect(sql).toContain('ON DELETE CASCADE')
  })
})

describe('scenarios_analysis_summary migration contract', () => {
  const sql = readFileSync(resolve(MIGRATIONS_DIR, '20260309000002_scenarios_analysis_summary.sql'), 'utf-8')

  it('adds latest_analysis_summary column', () => {
    expect(sql).toContain('latest_analysis_summary')
    expect(sql).toContain('jsonb')
  })

  it('uses ADD COLUMN IF NOT EXISTS for idempotency', () => {
    expect(sql).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i)
  })

  it('column is nullable (no NOT NULL constraint)', () => {
    // The column definition must not force NOT NULL
    expect(sql).not.toMatch(/latest_analysis_summary\s+jsonb\s+NOT\s+NULL/i)
  })

  it('documents the column purpose via COMMENT', () => {
    expect(sql).toContain('COMMENT ON COLUMN scenarios.latest_analysis_summary')
  })
})
