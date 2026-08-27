import { deployedBuild } from './lib/harness'
import { resetManifest } from './lib/manifest'

/**
 * A stale manifest from a previous run would let this run inherit someone else's
 * completeness. The served commit is recorded here so globalTeardown can prove the
 * whole run measured ONE build.
 */
export default async function globalSetup(): Promise<void> {
  const build = await deployedBuild()
  resetManifest(build)
  // eslint-disable-next-line no-console
  console.log(`[core] target is serving build ${build}`)
}
