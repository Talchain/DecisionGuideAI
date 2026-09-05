/**
 * WHOSE TREE IS ON THE OTHER END OF THE PORT? — geometry harness.
 *
 * The mechanism, the evidence and the reasoning behind the signal now live in ONE
 * place, `e2e/support/servingTree.ts`, because `playwright.visual.config.ts` needs
 * exactly the same assertion and a second copy of a guard is the hand-maintained
 * mirror at the top of CLAUDE.md. Read that file before changing anything here.
 *
 * What is left in this file is only what is SPECIFIC to the geometry harness: its
 * message prefix and how to give this lane its own port. The check itself is covered
 * by `tests/serving-tree-identity.spec.ts`.
 */

import type { FullConfig } from '@playwright/test'
import { assertServingTree } from '../support/servingTree'

export default async function globalSetup(config: FullConfig): Promise<void> {
  const { probeURL, repoRoot } = await assertServingTree(config, {
    label: 'geometry',
    remediation: [
      'Give this lane its own port and re-run:',
      '    GEOMETRY_PORT=5289 pnpm exec playwright test -c playwright.geometry.config.ts',
    ],
  })

  // eslint-disable-next-line no-console
  console.log(`[geometry] identity OK — ${probeURL} is served by ${repoRoot}`)
}
