/**
 * Types for `src/stubs/supabase-stub.mjs`.
 *
 * The stub is plain `.mjs` (it is a Vite ALIAS TARGET for
 * `@supabase/supabase-js`, resolved by the bundler, not by TypeScript), so a
 * direct `import` of it from a spec produced a fresh `TS7016` and the typecheck
 * ratchet correctly refused it. This declaration types the module rather than
 * baselining a new error.
 *
 * ⚠ `auth` is deliberately a `Record<string, unknown>` rather than a listed
 * shape. A listed shape here would read as if TypeScript enforced which methods
 * the stub may implement — it does not, and the property that matters (the stub
 * implements NO sign-in method, so a stubbed build fails HONESTLY instead of
 * reporting a success it never earned) is enforced at RUNTIME by
 * `src/contexts/__tests__/AuthContext.optionalAuth.spec.tsx`. A type that
 * implied a guarantee it cannot give would be the false label this estate keeps
 * paying for.
 */
export declare function createClient(): {
  auth: Record<string, unknown>
  from: (...args: unknown[]) => unknown
}
