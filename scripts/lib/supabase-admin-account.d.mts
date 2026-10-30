// scripts/lib/supabase-admin-account.d.mts
// Types for the admin-created account helper, so its spec (and, later, the core
// e2e harness) is typechecked rather than silently `any`. The implementation is
// plain .mjs so the witness scripts can run with bare `node`.

/** The environment variable NAME the callers read the service-role key from. */
export declare const SERVICE_ROLE_KEY_ENV: 'SUPABASE_SERVICE_ROLE_KEY'

export interface CreateConfirmedUserArgs {
  /** Project URL, e.g. https://<ref>.supabase.co (a trailing /rest/v1 is tolerated). */
  supabaseUrl: string
  /** The publishable / anon key (public by construction). Used for the sign-in only. */
  publicKey: string
  /** The service-role key. Sent on the admin call ONLY; never returned. */
  serviceRoleKey: string | undefined | null
  email: string
  password: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export type CreateConfirmedUserResult =
  | {
      ok: true
      userId: string
      email: string
      /** The password-grant session body: the same shape open signup used to return. MEMORY ONLY. */
      session: Record<string, unknown>
      /** MEMORY ONLY: never log, never persist, never put in a URL. */
      accessToken: string
    }
  | {
      ok: false
      step: 'config' | 'admin-create' | 'sign-in' | 'identity'
      http: number | null
      reason: string
    }

export declare function createConfirmedUserAndSignIn(
  args: CreateConfirmedUserArgs,
): Promise<CreateConfirmedUserResult>
