/**
 * "ONLY A CONTROL THE USER PRESSED MAY CLAIM THE CAMERA" — enforced structurally.
 *
 * `claimCameraForUser()` suppresses the product's automatic re-fit
 * (`useFitViewOnLayoutVersion`'s reserved-box trigger). That is exactly what
 * defect #1051 needed — and it is also exactly the shape of a future defect if
 * anything AUTOMATIC learns to call it, because an automatic claim would
 * silently disable the re-fit that spends canvas won back when the dock
 * collapses. The claim must stay what its name says: a fact about a control the
 * user pressed.
 *
 * ⚠ THIS IS A DERIVED GUARD AND IT PROVES ONE THING ONLY — that the call sites
 * in the tree and the list below AGREE (CLAUDE.md trap 12d). It cannot prove the
 * list is RIGHT; whether each of these is genuinely a user gesture is a review
 * judgement, and it is recorded here so a reviewer has something to judge. What
 * it does prevent is a fourth site appearing without anyone making that
 * judgement at all.
 *
 * Scope searched: every non-test `.ts`/`.tsx` under `src/`, comments and string
 * bodies blanked so prose about the claim cannot read as a call site.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blankNonCode } from '../../../tests/helpers/stripSourceComments'

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const EXCLUDED_DIR_NAMES = new Set(['__tests__', '__fixtures__', '__helpers__', '__mocks__'])

/**
 * THE DECLARED CALL SITES — every one a control the user presses, named so a
 * reviewer can apply the judgement this scan cannot.
 *
 *  - the "Show whole model" button on the extent notice
 *  - "Fit to view" in the canvas viewport toolbar
 *  - "Zoom to Fit" in the command palette
 */
const DECLARED_CLAIM_SITES = [
  'canvas/ReactFlowGraph.tsx',
  'canvas/components/CommandPalette.tsx',
  'canvas/components/ModelExtentNotice.tsx',
] as const

/** The module that owns the claim — it declares the function, it does not call it. */
const CLAIM_MODULE = 'canvas/utils/userCameraClaim.ts'

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      if (!EXCLUDED_DIR_NAMES.has(entry)) out.push(...sourceFiles(full))
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (/\.(spec|test)\.(ts|tsx)$/.test(entry)) continue
    out.push(full)
  }
  return out
}

function callSitesOf(symbol: string): string[] {
  const found: string[] = []
  for (const file of sourceFiles(SRC_ROOT)) {
    const rel = relative(SRC_ROOT, file).split('\\').join('/')
    if (rel === CLAIM_MODULE) continue
    const code = blankNonCode(readFileSync(file, 'utf8'))
    // A call, not an import: `claimCameraForUser(` with a following paren.
    if (new RegExp(`\\b${symbol}\\s*\\(`).test(code)) found.push(rel)
  }
  return found.sort()
}

describe('who may claim the camera for the user', () => {
  it('the positive control: the scan can see a call site at all', () => {
    // Without this the assertion below passes just as happily on a regex that
    // matches nothing, which is the vacuous-absence trap (CLAUDE.md trap 13).
    expect(callSitesOf('claimCameraForUser').length).toBeGreaterThan(0)
    // ...and a contrast: a symbol that is genuinely absent must read as absent,
    // so a "sees everything" instrument cannot masquerade as a working one.
    expect(callSitesOf('claimCameraForNobodyAtAll')).toEqual([])
  })

  it('claimCameraForUser is called from the declared user controls and nowhere else', () => {
    expect(callSitesOf('claimCameraForUser')).toEqual([...DECLARED_CLAIM_SITES].sort())
  })

  it('releaseUserCameraClaim is reached only from the hook that owns the automatic fits', () => {
    // The release is the other half: a stray release would hand the camera back
    // to the product mid-overview, which is the defect wearing a different hat.
    expect(callSitesOf('releaseUserCameraClaim')).toEqual(['canvas/hooks/useFitViewOnLayoutVersion.ts'])
  })
})
