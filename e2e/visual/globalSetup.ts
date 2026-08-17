/**
 * Clear the capture manifest before the run.
 *
 * Without this, a manifest left behind by a PREVIOUS run would satisfy the
 * completeness check at the end of a run that captured nothing — the instrument
 * confirming itself with last week's evidence. The manifest must be built from
 * scratch by the run it describes, or it describes nothing.
 */

import { existsSync, rmSync } from 'node:fs'
import { MANIFEST_PATH } from './harness'

export default function globalSetup(): void {
  if (existsSync(MANIFEST_PATH)) rmSync(MANIFEST_PATH)
}
