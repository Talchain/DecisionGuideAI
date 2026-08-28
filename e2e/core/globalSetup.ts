import { deployedBuild } from './lib/harness'
import { assertDeclaredSpecsExist, resetManifest } from './lib/manifest'

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
  resetManifest(build)
  // eslint-disable-next-line no-console
  console.log(`[core] target is serving build ${build}`)
}
