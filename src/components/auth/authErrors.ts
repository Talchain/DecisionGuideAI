/**
 * How a sign-in surface reads a failed auth call.
 *
 * TWO QUESTIONS, TWO PREDICATES. "Is this a server fault?" and "is this a rate
 * limit?" are not address-correlated: Supabase returns them identically for an
 * address that exists and one that does not, so naming them leaks nothing.
 * Everything else (a 400/422 for an unknown address, a wrong password) IS
 * address-correlated, and every surface must answer it with one sentence that
 * is identical for both cases.
 */

export function isServerFault(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' && status >= 500
}

export function isRateLimited(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status
  if (status === 429) return true
  const msg = error instanceof Error ? error.message : String(error ?? '')
  return msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('too many')
}

export type EmailSendOutcome = 'sent' | 'rate-limited' | 'server-fault'

/**
 * For "email me a link" calls. An address-correlated refusal (no such user,
 * sign-ups not allowed) reports `sent`, exactly as a delivered link does, so
 * the page never tells anyone whether an address has an account.
 */
export function classifyEmailSend(error: unknown): EmailSendOutcome {
  if (!error) return 'sent'
  if (isRateLimited(error)) return 'rate-limited'
  if (isServerFault(error)) return 'server-fault'
  return 'sent'
}
