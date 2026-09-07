/**
 * ⭐⭐ THE TRIPWIRE THAT WAS ADVERTISED BUT NOT IMPLEMENTED.
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
    // `GraphTextView` is the only renderer of `edge.data.beliefStrength`, which
    // is a flat UI default (`DEFAULT_EDGE_DATA`) while CEE supplies real
    // per-edge `belief_exists`. While nothing in the product mounts it, that
    // constant cannot mislead a user.
    //
    // If this REDs, someone has bound a surface to it and the flat 0.5 has just
    // become user-visible. Fix the field, do not delete this test.
    expect(productImportersOf('GraphTextView')).toEqual([])
  })
})
