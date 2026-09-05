/**
 * Two things, in this order, before a single pixel is captured.
 *
 * 1. ⭐ REFUSE TO MEASURE A FOREIGN CHECKOUT.
 *
 *    This harness had the same latent TOCTOU race as the geometry one (fixed there
 *    in #1130): Playwright checks the port, finds it free, launches vite, a sibling
 *    lane binds the port inside our boot window, OUR vite dies, and Playwright's
 *    wait-for-the-port is satisfied by the sibling's server. The run then proceeds
 *    against a foreign tree, green, exit 0. `e2e/support/servingTree.ts` carries the
 *    full mechanism and the evidence.
 *
 *    ⚠⚠ IT IS HIGHER CONSEQUENCE HERE THAN IT WAS THERE, AND THAT IS WHY THIS EXISTS.
 *    A geometry run that measures the wrong tree prints a wrong number, and the number
 *    is gone when the terminal scrolls. `pnpm visual:bless` runs THIS config with
 *    `updateSnapshots: 'all'` and WRITES REFERENCE IMAGES INTO THE REPO. A raced bless
 *    commits ANOTHER CHECKOUT'S PIXELS as this repo's baseline — an artefact that
 *    persists, is reviewed as though it depicted this tree, and then judges every
 *    later PR. `scripts/visual/rebless.sh` cannot see it either: its guards check that
 *    the reference tree was clean beforehand and that images were written, both of
 *    which are perfectly true of a foreign capture.
 *
 *    So the identity assertion runs FIRST, before this setup touches anything — a run
 *    that must not measure should also not have side effects.
 *
 * 2. CLEAR THE CAPTURE MANIFEST.
 *
 *    Without this, a manifest left behind by a PREVIOUS run would satisfy the
 *    completeness check at the end of a run that captured nothing — the instrument
 *    confirming itself with last week's evidence. The manifest must be built from
 *    scratch by the run it describes, or it describes nothing.
 */

import { existsSync, rmSync } from 'node:fs'
import type { FullConfig } from '@playwright/test'
import { assertServingTree } from '../support/servingTree'
import { MANIFEST_PATH } from './harness'

export default async function globalSetup(config: FullConfig): Promise<void> {
  const { probeURL, repoRoot } = await assertServingTree(config, {
    label: 'visreg',
    remediation: [
      'This config boots its own dev server on a fixed port. Wait for the sibling lane',
      'to finish, or run the two lanes from a single checkout — and if you were',
      'blessing, DO NOT commit anything this run wrote.',
    ],
  })

  // eslint-disable-next-line no-console
  console.log(`[visreg] identity OK — ${probeURL} is served by ${repoRoot}`)

  if (existsSync(MANIFEST_PATH)) rmSync(MANIFEST_PATH)
}
