#!/usr/bin/env node
/**
 * PR4 TWO-PERSON COLLABORATION WITNESS — wire-level, fresh-session.
 *
 * ── WHAT IT WITNESSES ─────────────────────────────────────────────────────
 * The PR4 journey end to end, at the wire, against a DEPLOYED environment:
 *
 *   OWNER (a real Supabase identity)   mints a round over two targets
 *   PARTICIPANT (a round-scoped token) fetches a BLIND packet
 *   PARTICIPANT                        submits a belief plus their own words
 *   OWNER                              closes the round
 *   OWNER                              reads the reveal and sees ATTRIBUTION
 *
 * ── THE TWO IDENTITIES, NAMED PRECISELY ───────────────────────────────────
 * ⚠ The journey needs ONE Supabase login, not two. The participant is
 * deliberately NOT a Supabase session: `/panel/:round_id` is mounted OUTSIDE
 * `AuthGuard` (see src/poc/AppPoC.tsx and collabParticipantRouteIsPublic.spec)
 * because a participant holds a per-round bearer capability instead. Anyone
 * scripting "two logins" is testing a product that does not exist.
 *
 * ── STATE-CLASS ───────────────────────────────────────────────────────────
 * FRESH, two-identity. The owner account is created by this run and used once;
 * the participant token is minted by this run. Nothing is replayed and nothing
 * is seeded. `--dry-run` is a DIFFERENT state-class (replayed) and says so in
 * its own verdict — it exercises the assertions, never the product.
 *
 * ── WHAT IT WILL NOT DO ───────────────────────────────────────────────────
 * It never weakens a check to make a leg pass. A refusal is a RESULT: the
 * verdict names the leg, the HTTP status and the service's own error code, so
 * a BLOCKED run is evidence rather than a failure to produce evidence.
 *
 * ── SECRETS ───────────────────────────────────────────────────────────────
 * Access tokens and participant tokens are never printed, never written to the
 * evidence file, and never put in a URL. Only lengths and SHA-256 prefixes.
 * The Supabase anon key is public by construction (it is in the shipped
 * bundle) but is still taken from the environment, never committed here.
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... \
 *   node scripts/witness/pr4-two-person-collab-witness.mjs \
 *     --origin https://staging--olumi.netlify.app \
 *     --scenario <uuid owned by the owner>        # optional; see leg 2
 *
 *   node scripts/witness/pr4-two-person-collab-witness.mjs --dry-run
 */

import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.join(HERE, 'fixtures', 'pr4-two-person-collab.json')

const argv = process.argv.slice(2)
const arg = name => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const DRY_RUN = argv.includes('--dry-run')
const ORIGIN = arg('origin') ?? 'https://staging--olumi.netlify.app'
const SCENARIO_ID = arg('scenario') ?? null
const OUT = arg('out') ?? null

const sha = s => createHash('sha256').update(String(s)).digest('hex').slice(0, 16)

/* ── the assertion layer ──────────────────────────────────────────────────
 * Pure functions over payloads, so `--dry-run` exercises EXACTLY the checks a
 * live run does. A dry run that used different assertions would prove nothing
 * about the live one.
 */

export function assertPacketIsBlind(packet, targetCount) {
  const problems = []
  if (packet?.status !== 'open') problems.push(`packet.status is ${packet?.status}, expected "open"`)
  if (!Array.isArray(packet?.targets) || packet.targets.length !== targetCount) {
    problems.push(`packet.targets has ${packet?.targets?.length}, expected ${targetCount}`)
  }
  // Blindness is the capability. It is a SERVER property; this asserts the
  // wire actually shows it, rather than trusting the type that describes it.
  for (const forbidden of ['responses', 'model_value_at_version', 'per_target', 'roster', 'response_count']) {
    if (packet && Object.prototype.hasOwnProperty.call(packet, forbidden)) {
      problems.push(`packet leaks "${forbidden}" — the blind packet must carry no sibling answers, no model value, no counts`)
    }
  }
  for (const t of packet?.targets ?? []) {
    for (const forbidden of ['value', 'model_value', 'responses']) {
      if (Object.prototype.hasOwnProperty.call(t, forbidden)) {
        problems.push(`packet.targets[].${forbidden} leaks a value into a blind packet`)
      }
    }
  }
  if (typeof packet?.self?.participant_id !== 'string') {
    problems.push('packet.self.participant_id missing — the participant cannot be attributed')
  }
  return problems
}

export function assertRevealCarriesAttribution(reveal, expected) {
  const problems = []
  const perTarget = reveal?.per_target ?? []
  if (perTarget.length !== expected.targetCount) {
    problems.push(`reveal.per_target has ${perTarget.length}, expected ${expected.targetCount}`)
  }
  let attributedResponses = 0
  for (const pt of perTarget) {
    for (const r of pt.responses ?? []) {
      attributedResponses += 1
      // ATTRIBUTION, bound by identity: the response must name WHO, and carry
      // their own words. A number with no author is the thing this capability
      // exists to replace.
      if (typeof r.participant_id !== 'string' || r.participant_id.length === 0) {
        problems.push(`a response on target "${pt.target?.id}" has no participant_id`)
      }
      if (typeof r.display_label !== 'string' || r.display_label.length === 0) {
        problems.push(`a response on target "${pt.target?.id}" has no display_label — unattributed`)
      }
      if (expected.participantId && r.participant_id !== expected.participantId) {
        problems.push(
          `response attributed to ${sha(r.participant_id)} but the submitting participant was ${sha(expected.participantId)}`,
        )
      }
      if (expected.expressions && r.expression_raw !== null) {
        if (!expected.expressions.includes(r.expression_raw)) {
          problems.push(`expression_raw "${r.expression_raw}" is not one of the words the participant actually wrote`)
        }
      }
    }
  }
  if (attributedResponses < expected.minResponses) {
    problems.push(`only ${attributedResponses} attributed responses, expected at least ${expected.minResponses}`)
  }
  return problems
}

/* ── the wire ─────────────────────────────────────────────────────────── */

const legs = []
function leg(name, status, detail) {
  legs.push({ leg: name, status, ...detail })
  const mark = status === 'PASS' ? 'PASS' : status === 'BLOCKED' ? 'BLOCKED' : 'FAIL'
  console.log(`[${mark}] ${name}${detail?.because ? ` — ${detail.because}` : ''}`)
  return status === 'PASS'
}

async function json(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

async function liveRun() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    leg('0. environment', 'BLOCKED', {
      because: 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set (both are public; take them from the deployed bundle or netlify.toml)',
    })
    return
  }

  // ── leg 1: which sign-in methods does this project actually complete? ───
  // Derived, never assumed: the public settings endpoint is the source of
  // truth for what a real user can do today.
  const settingsRes = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: anonKey } })
  const settings = await json(settingsRes)
  const capability = {
    email_provider: settings?.external?.email ?? null,
    google_provider: settings?.external?.google ?? null,
    anonymous_users: settings?.external?.anonymous_users ?? null,
    disable_signup: settings?.disable_signup ?? null,
    mailer_autoconfirm: settings?.mailer_autoconfirm ?? null,
  }
  leg('1. auth capability derived', settingsRes.ok ? 'PASS' : 'FAIL', { capability })

  // ── leg 2: a REAL Supabase identity for the owner ──────────────────────
  // Throwaway, clearly labelled, reserved-TLD address. Never a real account.
  const nonce = `${Date.now()}-${randomUUID().slice(0, 8)}`
  const ownerEmail = `olumi-witness+owner-${nonce}@example.test`
  const ownerPassword = `Olumi-Witness-${nonce}-Aa1!`
  const signupRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
  })
  const signup = await json(signupRes)
  const accessToken = signup?.access_token ?? null
  if (!accessToken) {
    leg('2. owner identity (real Supabase session)', 'BLOCKED', {
      http: signupRes.status,
      code: signup?.error_code ?? signup?.code ?? null,
      because: signup?.msg ?? 'no session returned',
      remedy: 'Supabase → Authentication → Providers → Email: allow sign-ups, or pre-provision the witness account.',
    })
    return
  }
  leg('2. owner identity (real Supabase session)', 'PASS', {
    owner_email: ownerEmail,
    owner_user_id: signup?.user?.id ?? null,
    access_token_sha256_prefix: sha(accessToken),
    method: 'email+password (auto-confirmed)',
  })

  // ── leg 3: the CONTROL, run before the acceptance path ─────────────────
  // An acceptance run with no failing control proves less than it looks. A
  // round over a scenario this owner does not own MUST be refused.
  const controlRes = await fetch(`${ORIGIN}/bff/collab/rounds`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenario_id: randomUUID(),
      context_note: 'PR4 witness CONTROL — must be refused',
      targets: [],
      participants: [],
    }),
  })
  const control = await json(controlRes)
  leg('3. CONTROL: round over an unowned scenario is refused', controlRes.ok ? 'FAIL' : 'PASS', {
    http: controlRes.status,
    code: control?.code ?? null,
    because: control?.message ?? null,
  })

  if (controlRes.status === 401 && control?.code === 'verification_unavailable') {
    // The control refused for the WRONG reason: the credential never reached
    // an ownership check at all. Saying "control passed" here would be a lie
    // by omission, so the run stops and names the blocker.
    leg('4. owner mints the round', 'BLOCKED', {
      http: 401,
      code: 'verification_unavailable',
      because:
        'CEE cannot verify the Supabase access token, so no owner call can reach an ownership check. ' +
        'The token is HS256, and CEE returns verification_unavailable only when SUPABASE_JWT_SECRET is unset ' +
        '(src/utils/supabase-user-jwt.ts — an incorrect secret would answer invalid_token instead).',
      remedy: 'Set SUPABASE_JWT_SECRET on the CEE staging service (Render) to the Supabase project JWT secret.',
    })
    return
  }

  if (!SCENARIO_ID) {
    leg('4. owner mints the round', 'BLOCKED', {
      because: '--scenario <uuid> not supplied: a round pins a version of a scenario the OWNER owns.',
      remedy: 'Create a scenario as the witness owner and pass its id.',
    })
    return
  }

  // ── leg 4: mint, over TWO targets ──────────────────────────────────────
  // Two, not one: a single-target round shows one axis and invites the wrong
  // conclusion whichever way it lands.
  const targets = [
    { target: { kind: 'factor', id: 'witness-target-a' }, label: 'Monthly churn rate', description: null, unit: '%' },
    { target: { kind: 'factor', id: 'witness-target-b' }, label: 'Time to first value', description: null, unit: 'days' },
  ]
  const mintRes = await fetch(`${ORIGIN}/bff/collab/rounds`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenario_id: SCENARIO_ID,
      context_note: 'PR4 two-person witness',
      targets,
      participants: [{ display_name: 'Witness Participant' }],
    }),
  })
  const minted = await json(mintRes)
  const roundId = minted?.round_id ?? null
  const participantToken = minted?.participants?.[0]?.token ?? null
  if (!roundId || !participantToken) {
    leg('4. owner mints the round', 'BLOCKED', {
      http: mintRes.status,
      code: minted?.code ?? null,
      because: minted?.message ?? 'no round_id / participant token returned',
    })
    return
  }
  leg('4. owner mints the round', 'PASS', {
    round_id: roundId,
    graph_version_ref: minted?.graph_version_ref ?? null,
    participant_token_sha256_prefix: sha(participantToken),
  })

  // ── leg 5: the participant's BLIND packet ──────────────────────────────
  const packetRes = await fetch(`${ORIGIN}/bff/collab/packet/${encodeURIComponent(roundId)}`, {
    headers: { 'x-collab-participant-token': participantToken },
  })
  const packet = await json(packetRes)
  const blindProblems = assertPacketIsBlind(packet, targets.length)
  leg('5. participant receives a BLIND packet', blindProblems.length === 0 ? 'PASS' : 'FAIL', {
    http: packetRes.status,
    problems: blindProblems,
  })
  if (blindProblems.length > 0) return

  // ── leg 6: the participant contributes privately, in their own words ───
  const expressions = [
    'about one in twenty a month, based on the last two quarters',
    'a fortnight if onboarding is staffed, longer otherwise',
  ]
  const submitted = []
  for (let i = 0; i < targets.length; i += 1) {
    const res = await fetch(`${ORIGIN}/bff/collab/packet/${encodeURIComponent(roundId)}/events`, {
      method: 'POST',
      headers: { 'x-collab-participant-token': participantToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'belief_submitted',
        target: targets[i].target,
        belief: { value: i === 0 ? 0.05 : 14, expression_raw: expressions[i], confidence: 0.6 },
      }),
    })
    const body = await json(res)
    submitted.push({ http: res.status, authored_by_sha256_prefix: body?.authored_by ? sha(body.authored_by) : null })
    if (!res.ok) {
      leg('6. participant submits beliefs privately', 'FAIL', { http: res.status, code: body?.code ?? null, because: body?.message })
      return
    }
  }
  leg('6. participant submits beliefs privately', 'PASS', { submitted })

  // ── leg 7: owner closes ────────────────────────────────────────────────
  const closeRes = await fetch(`${ORIGIN}/bff/collab/rounds/${encodeURIComponent(roundId)}/close`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!closeRes.ok) {
    const body = await json(closeRes)
    // F-6 is the anti-anchoring rule, not a bug: an owner who joined their own
    // panel cannot close until they submit or decline.
    leg('7. owner closes the round', 'FAIL', { http: closeRes.status, code: body?.code ?? null, because: body?.message })
    return
  }
  leg('7. owner closes the round', 'PASS', { http: closeRes.status })

  // ── leg 8: the reveal, WITH attribution ────────────────────────────────
  const revealRes = await fetch(`${ORIGIN}/bff/collab/rounds/${encodeURIComponent(roundId)}/reveal`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const reveal = await json(revealRes)
  const revealProblems = assertRevealCarriesAttribution(reveal, {
    targetCount: targets.length,
    minResponses: targets.length,
    participantId: packet?.self?.participant_id ?? null,
    expressions,
  })
  leg('8. owner sees the reveal WITH attribution', revealProblems.length === 0 ? 'PASS' : 'FAIL', {
    http: revealRes.status,
    problems: revealProblems,
  })
}

async function dryRun() {
  const fixtures = JSON.parse(readFileSync(FIXTURES, 'utf8'))
  // A dry run proves the ASSERTIONS bite; it proves nothing about the product.
  // So each fixture pair is a discriminating pair: the good payload must pass
  // and the corrupted twin must fail, on a NAMED problem.
  for (const c of fixtures.cases) {
    const problems =
      c.kind === 'packet'
        ? assertPacketIsBlind(c.payload, c.target_count)
        : assertRevealCarriesAttribution(c.payload, c.expected)
    const ok = c.expect === 'pass' ? problems.length === 0 : problems.length > 0
    leg(`dry-run: ${c.name}`, ok ? 'PASS' : 'FAIL', {
      expected: c.expect,
      problems,
    })
  }
}

const started = new Date().toISOString()
if (DRY_RUN) await dryRun()
else await liveRun()

const verdict = {
  witness: 'PR4 two-person collaboration',
  mode: DRY_RUN ? 'dry-run (replayed fixtures — proves the assertions, NOT the product)' : 'live wire',
  state_class: DRY_RUN ? 'replayed' : 'fresh, two-identity',
  origin: DRY_RUN ? null : ORIGIN,
  started,
  finished: new Date().toISOString(),
  legs,
  overall: legs.some(l => l.status === 'FAIL')
    ? 'FAIL'
    : legs.some(l => l.status === 'BLOCKED')
      ? 'BLOCKED'
      : 'PASS',
}
console.log(`\nOVERALL: ${verdict.overall}`)
if (OUT) {
  writeFileSync(OUT, JSON.stringify(verdict, null, 2))
  console.log(`verdict written to ${OUT}`)
}
process.exit(verdict.overall === 'FAIL' ? 1 : 0)
