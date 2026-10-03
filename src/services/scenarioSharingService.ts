/**
 * ACCOUNTS "Invite a colleague to this decision" (viewer only) — the client of
 * the sharing RPCs (DL GO #85 5947426886; ACCOUNTS lease 5947474393).
 *
 * Every call runs as the SIGNED-IN user against SECURITY DEFINER functions; the
 * server enforces who may do what (owner-only share/unshare/list-members). This
 * module only maps answers to typed outcomes, and never throws.
 *
 * Privacy contract: `share_scenario` answers the same whether or not the email
 * has an Olumi account, so nothing here (or in the UI copy) may claim either.
 *
 * Error codes raised by the functions (PostgREST surfaces them as `error.code`):
 * SM403 not the owner · SM400 bad email (or your own) · SM429 over the member cap.
 */

import { supabase } from '../lib/supabase'

export type SharingFailure = 'not_owner' | 'bad_email' | 'member_cap' | 'unavailable'
export type ScenarioAccess = 'owner' | 'viewer' | 'none'

export interface ScenarioMember {
  email: string
  createdAt: string
}

export interface SharedScenario {
  scenarioId: string
  title: string
  updatedAt: string
  sharedAt: string
  ownerName: string | null
}

type Outcome<T> = ({ ok: true } & T) | { ok: false; failure: SharingFailure }

const BASIC_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Trimmed + lower-cased: the server keys members by lower-cased email. */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

function failureOf(error: { code?: string } | null | undefined): SharingFailure {
  switch (error?.code) {
    case 'SM403':
      return 'not_owner'
    case 'SM400':
      return 'bad_email'
    case 'SM429':
      return 'member_cap'
    default:
      return 'unavailable'
  }
}

async function call(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { code?: string } | null }> {
  try {
    const { data, error } = await supabase.rpc(fn, args)
    return { data, error }
  } catch {
    return { data: null, error: { code: 'network' } }
  }
}

export async function shareScenario(scenarioId: string, email: string): Promise<Outcome<Record<never, never>>> {
  const normalised = normaliseEmail(email)
  if (!BASIC_EMAIL.test(normalised)) return { ok: false, failure: 'bad_email' }
  const { error } = await call('share_scenario', { p_scenario_id: scenarioId, p_email: normalised })
  return error ? { ok: false, failure: failureOf(error) } : { ok: true }
}

export async function unshareScenario(scenarioId: string, email: string): Promise<Outcome<{ revoked: boolean }>> {
  const { data, error } = await call('unshare_scenario', { p_scenario_id: scenarioId, p_email: normaliseEmail(email) })
  if (error) return { ok: false, failure: failureOf(error) }
  return { ok: true, revoked: (data as { revoked?: unknown } | null)?.revoked === true }
}

export async function listScenarioMembers(scenarioId: string): Promise<Outcome<{ members: ScenarioMember[] }>> {
  const { data, error } = await call('list_scenario_members', { p_scenario_id: scenarioId })
  if (error) return { ok: false, failure: failureOf(error) }
  const rows = Array.isArray(data) ? data : []
  const members = rows
    .filter((r): r is { email: string; created_at: string } => typeof r?.email === 'string')
    .map((r) => ({ email: r.email, createdAt: typeof r.created_at === 'string' ? r.created_at : '' }))
  return { ok: true, members }
}

export async function listSharedScenarios(): Promise<Outcome<{ items: SharedScenario[] }>> {
  const { data, error } = await call('list_shared_scenarios', {})
  if (error) return { ok: false, failure: failureOf(error) }
  const rows = Array.isArray(data) ? data : []
  const items = rows
    .filter((r): r is Record<string, unknown> & { scenario_id: string } => typeof r?.scenario_id === 'string')
    .map((r) => ({
      scenarioId: r.scenario_id,
      title: typeof r.title === 'string' && r.title.trim() !== '' ? r.title : 'Untitled decision',
      updatedAt: typeof r.updated_at === 'string' ? r.updated_at : '',
      sharedAt: typeof r.shared_at === 'string' ? r.shared_at : '',
      ownerName: typeof r.owner_name === 'string' && r.owner_name.trim() !== '' ? r.owner_name : null,
    }))
  return { ok: true, items }
}

/**
 * The caller's role on a scenario. Anything unrecognised — including a failed
 * call — is `none`: the UI must never offer an owner's controls on a guess.
 */
export async function getScenarioAccess(scenarioId: string): Promise<ScenarioAccess> {
  const { data, error } = await call('scenario_access', { p_scenario_id: scenarioId })
  if (error) return 'none'
  return data === 'owner' || data === 'viewer' ? data : 'none'
}
