// scripts/lib/supabase-admin-account.mjs
// =============================================================================
// Create a throwaway, email-confirmed Supabase account WITHOUT open sign-up,
// then sign it in. Used by the witness scripts, and meant for the core e2e
// harness once its CI secret exists.
// =============================================================================
//
// WHY: open self-sign-up (`POST /auth/v1/signup`) is being closed
// (`disable_signup: true`) on the SHARED Supabase project, which staging and
// production share (ACCOUNTS phase 2, 30 Sep 2026). After that flip, signup
// answers an error and every caller that minted its own account through it stops
// at its first step. The replacement has two calls, and neither is sign-up:
//
//   1. ADMIN CREATE: `POST /auth/v1/admin/users` `{ email, password,
//      email_confirm: true }` with the SERVICE-ROLE key. This is the REST call
//      behind supabase-js `auth.admin.createUser`, and it works with sign-up
//      disabled.
//   2. PASSWORD SIGN-IN: `POST /auth/v1/token?grant_type=password` with the
//      PUBLIC key. It returns the same session body signup used to return
//      (access_token, refresh_token, user, expires_at ...).
//
// The signed-in user's id must equal the created user's id, so the session is
// bound to the account this call created and to no other.
//
// SECRETS DISCIPLINE: the service-role key is a parameter; this module never
// reads it from anywhere. It is sent ONLY on the admin call, never on the
// sign-in, and it never appears in a return value or an error. Failure reasons
// name the HTTP status and the response KEYS, never a value. The session is
// returned to the caller in memory; logging or persisting it is the caller's
// mistake to avoid.
//
// Plain .mjs on purpose (no build step): the witness scripts run with bare
// `node`. Types live in the sibling `supabase-admin-account.d.mts`.

/** The environment variable NAME the callers read the service-role key from. */
export const SERVICE_ROLE_KEY_ENV = 'SUPABASE_SERVICE_ROLE_KEY'

const keysOf = body => (body && typeof body === 'object' ? Object.keys(body).join(', ') : '(unparseable)')

async function postJson(fetchImpl, url, headers, payload, timeoutMs) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ac.signal,
    })
    let body = null
    try {
      body = JSON.parse(await res.text())
    } catch {
      /* body stays null */
    }
    return { status: res.status, ok: res.ok, body }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {object} args
 * @param {string} args.supabaseUrl    project URL, e.g. https://<ref>.supabase.co (a trailing /rest/v1 is tolerated)
 * @param {string} args.publicKey      the publishable / anon key (public by construction)
 * @param {string} args.serviceRoleKey the service-role key: admin call ONLY
 * @param {string} args.email
 * @param {string} args.password
 * @param {typeof fetch} [args.fetchImpl]
 * @param {number} [args.timeoutMs]
 * @returns {Promise<{ok: true, userId: string, email: string, session: Record<string, unknown>, accessToken: string} |
 *                   {ok: false, step: 'config'|'admin-create'|'sign-in'|'identity', http: number|null, reason: string}>}
 */
export async function createConfirmedUserAndSignIn({
  supabaseUrl,
  publicKey,
  serviceRoleKey,
  email,
  password,
  fetchImpl = globalThis.fetch,
  timeoutMs = 30_000,
}) {
  if (!serviceRoleKey) {
    return {
      ok: false,
      step: 'config',
      http: null,
      reason:
        `no service-role key (${SERVICE_ROLE_KEY_ENV}). Accounts are admin-created now, because open sign-up is ` +
        'being closed on the shared Supabase project. Export the key from a LOCAL env file (or a CI secret); never ' +
        'commit it and never pass it on the command line.',
    }
  }
  if (!supabaseUrl || !publicKey || !email || !password) {
    return { ok: false, step: 'config', http: null, reason: 'supabaseUrl, publicKey, email and password are all required' }
  }
  const host = String(supabaseUrl).replace(/\/+$/, '').replace(/\/rest\/v1$/, '')

  let created
  try {
    created = await postJson(
      fetchImpl,
      `${host}/auth/v1/admin/users`,
      { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      { email, password, email_confirm: true },
      timeoutMs,
    )
  } catch (err) {
    return { ok: false, step: 'admin-create', http: null, reason: `admin createUser transport error: ${err?.name ?? 'error'}` }
  }
  const createdId = created.body?.id ?? created.body?.user?.id ?? null
  if (!created.ok || typeof createdId !== 'string' || createdId.length === 0) {
    return {
      ok: false,
      step: 'admin-create',
      http: created.status,
      reason: `admin createUser did not create the user (http ${created.status}; response keys [${keysOf(created.body)}])`,
    }
  }

  let signed
  try {
    signed = await postJson(
      fetchImpl,
      `${host}/auth/v1/token?grant_type=password`,
      { apikey: publicKey },
      { email, password },
      timeoutMs,
    )
  } catch (err) {
    return { ok: false, step: 'sign-in', http: null, reason: `password sign-in transport error: ${err?.name ?? 'error'}` }
  }
  const session = signed.body
  const accessToken = session?.access_token ?? null
  if (!signed.ok || typeof accessToken !== 'string' || accessToken.length === 0) {
    return {
      ok: false,
      step: 'sign-in',
      http: signed.status,
      reason: `password sign-in returned no session for the admin-created user (http ${signed.status}; response keys [${keysOf(session)}])`,
    }
  }
  if (session?.user?.id !== createdId) {
    return {
      ok: false,
      step: 'identity',
      http: signed.status,
      reason: 'the signed-in user is NOT the user just created (ids differ): the session would witness the wrong identity',
    }
  }
  return { ok: true, userId: createdId, email, session, accessToken }
}
