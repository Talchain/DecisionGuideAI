import { deployedBuild, ORIGIN } from './lib/harness'
import {
  assertDeclaredSpecsExist,
  namesABuild,
  resetManifest,
  targetIsImmutable,
} from './lib/manifest'

/**
 * A stale manifest from a previous run would let this run inherit someone else's
 * completeness. The served commit is recorded here so globalTeardown can prove the
 * whole run measured ONE build.
 */
export default async function globalSetup(): Promise<void> {
  // Fail BEFORE the browser starts if the declared set has drifted from the files on
  // disk. A listed-but-fileless spec makes the teardown guard unsatisfiable, which is
  // how "always pass CORE_PARTIAL=1" became the standing workaround that disarmed it.
  assertDeclaredSpecsExist()

  const build = await deployedBuild()

  // ⭐ FAIL HERE, NOT AT TEARDOWN. If the target cannot say what it is serving, the
  // run has no build to attribute anything to — and the OLD code recorded that as the
  // string 'unknown' and carried on, which then SILENTLY DISABLED the drift guard
  // (its first conjunct was `started !== 'unknown'`). So the one state where the run
  // knew nothing was the state that could not fail. Refusing now also saves ~5 minutes
  // of browser time spent producing a result nobody may cite.
  if (!namesABuild(build)) {
    throw new Error(
      `[core] TARGET WILL NOT SAY WHAT IT IS SERVING: ${ORIGIN}/version.json gave "${build}".\n` +
        `  Expected a commit. A run that cannot name its build cannot produce an attributable\n` +
        `  verdict, so it does not start.\n` +
        `  If the target is an immutable deploy URL, a 404 here means that deploy does not\n` +
        `  exist — which is a hard error on purpose, never a skip and never a pass.\n` +
        `  Resolve a real one with: node scripts/core-e2e/resolve-immutable-target.mjs`,
    )
  }

  resetManifest(build)

  // ⭐ STATE THE EPISTEMIC STATUS OF THE RUN, EVERY RUN. Whether "the build did not
  // drift" is PROVEN (a deploy permalink cannot move) or merely OBSERVED (two reads of
  // a mutable alias agreed, with every spec sitting in the unsampled gap between them)
  // is the difference between a verdict and a hopeful one — and it is invisible in the
  // pass/fail. An operator reading a green months later has only the log.
  const pinned = targetIsImmutable(ORIGIN)
  // eslint-disable-next-line no-console
  console.log(
    `[core] target is serving build ${build}\n` +
      `[core] target ${ORIGIN}\n` +
      (pinned
        ? `[core] ATTRIBUTION: PROVEN — this is an immutable deploy permalink and cannot move under the run.`
        : `[core] ATTRIBUTION: SAMPLED — this is a MUTABLE ALIAS. The teardown guard compares two\n` +
          `[core]   reads with the whole suite between them, so it detects drift but does not\n` +
          `[core]   preclude it. For an attributable verdict, resolve a pinned target first:\n` +
          `[core]   CORE_UI_URL=$(node scripts/core-e2e/resolve-immutable-target.mjs) pnpm run e2e:core`),
  )
}
