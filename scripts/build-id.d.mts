// Type declarations for scripts/build-id.mjs.
//
// Present so `vite.config.ts` and tests/ci-guards/build-id-stamp.spec.ts import
// this module WITHOUT a TS7016 implicit-any, rather than ratcheting two new
// errors into scripts/ci/typecheck-baseline.txt. (The sibling
// scripts/supabase-stub-decision.mjs still carries that error in the baseline;
// out of this lane's scope, but the same one-file fix applies.)

/** The literal that appears in HTML sources and must never reach `dist/`. */
export declare const BUILD_ID_PLACEHOLDER: '%BUILD_ID%'

/** Stamped when no commit SHA is derivable. */
export declare const UNIDENTIFIED_BUILD_ID: 'unidentified'

/** The shape a stamped build id must have. */
export declare const BUILD_ID_PATTERN: RegExp

/**
 * Derive the build id: `COMMIT_REF` → `GITHUB_SHA` → `git rev-parse HEAD` →
 * `UNIDENTIFIED_BUILD_ID`. Returns a lowercase hex SHA, or the literal
 * `'unidentified'` — never a placeholder and never a fabricated stand-in.
 */
export declare function resolveBuildId(
  env?: Record<string, string | undefined>,
  readGitHead?: () => string | null,
): string

/** Replace every occurrence of the placeholder, literally. */
export declare function stampBuildId(html: string, buildId: string): string

/**
 * The Vite plugin. `transformIndexHtml` covers the HTML entry in dev and build;
 * `closeBundle` sweeps any remaining `.html` under `outDir`, which is how
 * `public/` files — copied verbatim, never transformed — get the same value.
 *
 * Typed loosely on purpose: this is consumed as a Vite `PluginOption` in
 * vite.config.ts and driven hook-by-hook in the spec, and pinning Rollup's
 * hook signatures here would couple the declaration to a vendored type version
 * for no benefit at either call site.
 */
export declare function buildIdPlugin(options?: { buildId?: string }): {
  name: string
  enforce: 'pre'
  configResolved(config: {
    command: string
    root: string
    build: { outDir: string }
  }): void
  transformIndexHtml: { order: 'pre'; handler(html: string): string }
  closeBundle(): void
}
