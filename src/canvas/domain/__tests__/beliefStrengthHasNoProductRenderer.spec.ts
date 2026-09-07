/**
 * ⭐⭐ THE TRIPWIRE THAT WAS ADVERTISED BUT NOT IMPLEMENTED.
 *
 * ⚠⚠ READ THIS FIRST: THE SENTENCE THIS FILE WAS BUILT ON WAS FALSE.
 * It said `GraphTextView` is "the only renderer of `edge.data.beliefStrength`".
 * It is not. Derived at the bytes:
 *
 *   captureModelVersion.ts:104  `collectFields` is a DENYLIST — every key not
 *                               in `EXCLUDED_FIELDS` is captured, and
 *                               `beliefStrength` is not in it (0 occurrences
 *                               of the name in that file), so it flows into
 *                               every versioned edge.
 *   describeChange.ts:47        `FIELD_LABELS.beliefStrength = 'effect size'`
 *   WhatChangedPanel.tsx:39     renders those lines via `describeChangeset`,
 *                               and is mounted in `routes/CanvasMVP.tsx`.
 *
 * So a change to `beliefStrength` already reaches a user as
 * "Link a -> b effect size 0.5 -> 0.7". Bounded honestly: it renders only when
 * the field CHANGES, and the added-edge path renders no value — so this is a
 * false comment, not a proven live harm. The tripwire below is still worth
 * having; what it may NOT claim is exclusivity.
 *
 * ⭐ THE SHAPE IS THE POINT, AND IT IS THE ONE THIS HEADER ALREADY WARNS ABOUT
 * ONE LEVEL DOWN. Below, I correct a truncated `head -5` enumeration — and
 * then committed the same error one level up, by sweeping the FILE
 * (`GraphTextView`) rather than the SURFACE (everything that can render the
 * field). A probe proves what it is pointed at, never that it is pointed at
 * everything.
 *
 * `edgeRenderedDistribution.capture.spec.ts` pins that `beliefStrength` is a
 * flat `0.5` across the 6 Sep capture while `beliefExists` beside it carries
 * four CEE-sourced values, and its comment claimed the pin "REDs the day anyone
 * binds a surface to it".
 *
 * ⚠ IT COULD NOT. That spec's entire input is two frozen JSON fixtures and
 * three pure domain modules. It observes no reader, no call site and no product
 * module — so if someone mounted `GraphTextView` in the product tree tomorrow,
 * all twenty of its tests would stay green. An independent seat named that, and
 * it was right: a comment manufacturing a guarantee the code does not provide.
 *
 * This file is that guarantee, DERIVED rather than asserted.
 *
 * ⚠⚠ AND THE CLAIM IT REPLACES WAS FALSE AT THE BYTES, TWICE OVER. I wrote that
 * the module was "imported once, for `SectionErrorBoundary`"; a peer repeated a
 * neighbouring version ("its only non-comment reference outside tests is a
 * story file"). Both are wrong. Measured with no truncation:
 *
 *   the MODULE      → 9 importers (7 product files, all for SectionErrorBoundary)
 *   the COMPONENT   → 2 importers (one Storybook story, one test) — ZERO product
 *
 * The narrow conclusion survives — `beliefStrength` has no product renderer —
 * but only the second line supports it. My original figure came from a `grep`
 * piped through `head -5`: an enumeration read from a truncated list, which is
 * how "once" was produced from nine.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SRC = resolve(__dirname, '../../..')

/** Every non-test, non-story source file under `src/`. */
function productFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '__fixtures__' || entry === 'node_modules') continue
      productFiles(full, acc)
      continue
    }
    if (!/\.tsx?$/.test(entry)) continue
    if (/\.spec\.|\.test\.|\.stories\./.test(entry)) continue
    acc.push(full)
  }
  return acc
}

const FILES = productFiles(SRC)

/** Files importing the NAMED binding `symbol` from a `GraphTextView` module. */
function productImportersOf(symbol: string): string[] {
  const re = new RegExp(`import\\s*\\{[^}]*\\b${symbol}\\b[^}]*\\}\\s*from\\s*'[^']*GraphTextView'`)
  return FILES.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => f.slice(SRC.length + 1))
}

/**
 * ⚠⚠ THE STATIC PROBE ABOVE IS BLIND IN THE DIRECTION THAT MATTERS.
 * `lazy(() => import('./GraphTextView'))` mounts the component and matches no
 * `import {...} from` — so the tripwire would stay green while the property it
 * pins is false. That is not hypothetical: it is THIS REPO'S OWN mounting
 * idiom, with 9 live product sites including `ReactFlowGraph.tsx` and
 * `OutputsDock.tsx`, in the same component tree.
 *
 * This catches any dynamic import of the module, however the result is bound.
 */
function productDynamicImportersOfModule(): string[] {
  const re = /import\s*\(\s*(?:\/\*[^*]*\*\/\s*)?'[^']*GraphTextView'/
  return FILES.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => f.slice(SRC.length + 1))
}

/** Any dynamic import at all — the control for the probe above. */
function anyDynamicImporters(): string[] {
  const re = /lazy\(\(\)\s*=>\s*import\s*\(/
  return FILES.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => f.slice(SRC.length + 1))
}

describe('beliefStrength has no product renderer — derived, not asserted', () => {
  it('the sweep can see the tree at all', () => {
    // Trap 13: an absence claim needs a probe proven capable of a presence.
    // A path or filter mistake would return an empty file list and every
    // assertion below would pass by looking at nothing.
    expect(FILES.length).toBeGreaterThan(500)
  })

  it('CONTRAST CONTROL: the same probe DOES find product importers of the module', () => {
    // Proves the regex and the traversal work on this exact module path. Without
    // this, "zero GraphTextView importers" could mean "the probe matches nothing".
    const boundary = productImportersOf('SectionErrorBoundary')
    expect(boundary.length).toBeGreaterThan(0)
    expect(boundary).toContain('canvas/components/ModelTabBody.tsx')
  })

  it('⭐ THE TRIPWIRE: no product file imports the GraphTextView COMPONENT', () => {
    // `edge.data.beliefStrength` is a flat UI default (`DEFAULT_EDGE_DATA`)
    // while CEE supplies real per-edge `belief_exists`. `GraphTextView` would
    // render the flat value as a per-edge FIGURE; nothing in the product mounts
    // it, and this case is what keeps that true.
    //
    // ⚠ NOT "the only renderer" — see the header. `WhatChangedPanel` already
    // renders the field as a CHANGE LINE via `describeChange`. This case pins
    // the mount, which is a narrower claim than exclusivity and the one the
    // probe can actually support.
    //
    // If this REDs, someone has bound a surface to it and the flat 0.5 has just
    // become user-visible. Fix the field, do not delete this test.
    expect(productImportersOf('GraphTextView')).toEqual([])
  })

  it('CONTRAST CONTROL: the dynamic probe can see this repo\'s lazy-mount idiom', () => {
    // Without this, "zero dynamic importers" below is indistinguishable from a
    // regex that matches nothing (trap 13). `lazy(() => import(...))` is how
    // this repo actually mounts deferred panels, so the control asserts the
    // probe finds real instances of the exact syntax it must not miss.
    const lazySites = anyDynamicImporters()
    expect(lazySites.length).toBeGreaterThan(4)
    expect(lazySites).toContain('canvas/components/OutputsDock.tsx')
  })

  it('⭐ THE TRIPWIRE, SECOND DOOR: no product file LAZY-mounts the module either', () => {
    // The static probe cannot see `lazy(() => import('./GraphTextView'))`, and
    // that is the idiom a future mount is most likely to use here.
    expect(productDynamicImportersOfModule()).toEqual([])
  })
})
