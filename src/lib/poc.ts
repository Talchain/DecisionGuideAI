// src/lib/poc.ts
// PoC-only mode: renders only the Scenario Sandbox with no login/nav/landing

import { isRequireLoginEnabled } from '../flags'

export const isPocOnly =
  (import.meta.env?.VITE_POC_ONLY ?? '0') === '1'

// Login 3.4 UI half: VITE_REQUIRE_LOGIN (default off) retires the guest
// branch — when ON, no guest user is minted regardless of PoC/guest env,
// so the real-auth path in AuthContext runs and the already-mounted
// AuthGuard routes unauthenticated visitors to LoginPage. Flag OFF is
// byte-identical to the pre-flag behaviour (pinned in
// lib/__tests__/poc.requireLogin.spec.ts).
export const isGuestAuth =
  !isRequireLoginEnabled() && (
    isPocOnly ||
    (import.meta.env?.VITE_AUTH_MODE ?? 'guest') === 'guest' ||
    String(import.meta.env?.VITE_SUPABASE_URL || '').includes('/dummy')
  )
