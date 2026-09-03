// Type declarations for scripts/ci/assert-build-id-stamped.mjs.
// See scripts/build-id.d.mts for why these exist.

export interface BuildIdStampResult {
  /** True only when `errors` is empty AND the positive control found a meta tag. */
  ok: boolean
  errors: string[]
  /** Every `x-build-id` meta tag found, in scan order. */
  checked: Array<{ file: string; id: string }>
}

/**
 * Assert every `.html` under `outDir` carries a stamped build id and no
 * `%BUILD_ID%` placeholder.
 *
 * Fails — never silently passes — when the directory is missing, holds no HTML,
 * or holds no `x-build-id` meta tag at all: an absence assertion over nothing is
 * vacuous, and a build that failed to emit would otherwise read as clean.
 *
 * `requireSha` additionally rejects the honest `'unidentified'` fallback, for
 * CI and Netlify where a commit SHA is always derivable and `'unidentified'`
 * therefore means the derivation broke.
 */
export declare function assertBuildIdStamped(
  outDir: string,
  options?: { requireSha?: boolean },
): BuildIdStampResult
