/**
 * DERIVED GUARD — the authorship fix depends on an UNTYPED field surviving
 * `EdgeV3Schema`'s passthrough. This RED-flags the day that stops being true.
 *
 * `readWireEdgeStrengthAuthor` reads `provenance.source === 'user_specified'`
 * from the wire edge. That literal is **not in the UI's pinned contract**:
 * `@talchain/schemas` 0.55.0 is also the latest published tag and declares no
 * such member, so the value arrives only because `EdgeV3Schema` is
 * `.passthrough()`. Verified on the live wire that it does arrive.
 *
 * ⛔ THE RISK THIS GUARD EXISTS FOR, named by Core when reviewing the fix:
 * if a future schemas version TIGHTENS that object, the field is stripped before
 * the reader sees it, the reader returns `undefined`, the caller falls back to
 * `'cee'` — and the product silently goes back to crediting Olumi for numbers the
 * user stated, **under a fully green suite**. A silent reversion to the original
 * defect is the worst outcome available here, so the passthrough assumption is
 * pinned rather than assumed.
 *
 * ⇒ IF THIS SPEC REDS: the contract has started declaring the field. That is not
 * necessarily bad — it may be an improvement — but it means the shape the reader
 * depends on has MOVED. Re-derive whether `provenance.source` still arrives, and
 * whether it still carries `'user_specified'`, before editing this file.
 *
 * ⚠⚠ WHAT THIS CANNOT SEE, stated rather than left to be discovered: a PRODUCER
 * that silently stops stamping. No client-side guard can detect that — the edge
 * simply arrives unstamped and is indistinguishable from one CEE authored. The
 * failure direction is the safe one by construction (an edge stays credited to
 * Olumi; the user is never falsely credited), but it IS a silent failure and the
 * only instrument that would catch it is a live wire check, not a unit test.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** The literal the reader keys on. */
const TARGET = '"user_specified"'
/**
 * ⭐ THE CONTRAST, AND WITHOUT IT THIS SPEC IS VACUOUS. An absence probe that
 * cannot see a presence proves nothing. `user_confirmed` IS a declared literal in
 * the pinned contract, so it must read non-zero in the same sweep — otherwise the
 * probe is blind and the target's zero means nothing.
 *
 * ⚠ This was not hypothetical: the first version of this sweep used `find`
 * without `-L` and scanned ZERO files, because pnpm installs the package as a
 * SYMLINK. Target read 0 — and so did the contrast, which is the only reason it
 * was caught.
 */
const CONTRAST = '"user_confirmed"'

const PKG = join(process.cwd(), 'node_modules', '@talchain', 'schemas')

function declarationFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    // `statSync` FOLLOWS symlinks; `Dirent.isDirectory()` does not. pnpm's store
    // is symlinked, so the distinction decides whether this sweep sees anything.
    let s
    try { s = statSync(full) } catch { continue }
    if (s.isDirectory()) declarationFiles(full, acc)
    else if (entry.endsWith('.d.ts')) acc.push(full)
  }
  return acc
}

describe('the authorship reader depends on a passthrough field — pin that assumption', () => {
  const files = declarationFiles(PKG)
  const corpus = files.map((f) => readFileSync(f, 'utf8')).join('\n')
  const count = (needle: string) => corpus.split(needle).length - 1

  it('the probe can see a declared literal at all (floor — else the target zero is meaningless)', () => {
    expect(files.length, 'no .d.ts files scanned — the sweep is blind').toBeGreaterThan(0)
    expect(count(CONTRAST), 'contrast literal absent — probe is blind, target zero proves nothing').toBeGreaterThan(0)
  })

  it('`user_specified` is still NOT a declared member — it rides the passthrough', () => {
    expect(
      count(TARGET),
      'the contract now declares `user_specified`: re-derive that the field still reaches ' +
        '`readWireEdgeStrengthAuthor` before changing this expectation — a tightened object ' +
        'would silently revert to crediting Olumi for the user’s own numbers',
    ).toBe(0)
  })
})
