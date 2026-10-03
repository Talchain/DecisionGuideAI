/**
 * AIQ #72 5885033487 / 5885116642 (29 Sep 2026): P(goal) is said as a SHARE OF MODEL RUNS at every site, through the one
 * register (`GOAL_ANCHOR_COPY`) — never "chance of success / reaching / hitting / target", "probability of success /
 * reaching / hitting / meeting" or "likely to reach target".
 * Served 29 Sep: the goal inspector said "25% chance of success" beside Olumi's own "these are model outcomes, not
 * probabilities that the target will be achieved". Five sites hand-typed their own "chance" wording on the live arm.
 *
 * A SOURCE scan (string literals outside comments, all of src/ minus tests and fixtures), so a sixth hand-typed site
 * REDs here the day it is written, not the day a user reads it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../../../..') // src/
const FORBIDDEN =
  /chance of (success|reaching|hitting|target|achieving)|likely to reach target|Chance all your limits hold|probability of (success|reaching|hitting|meeting)/i
/** The banned-term list itself names the old wording so it can refuse it. */
const ALLOWED = new Set(['glossaryCheck.ts'])

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (name === '__tests__' || name === 'fixtures' || name === 'node_modules') continue
    if (statSync(p).isDirectory()) sourceFiles(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.(spec|test)\.tsx?$/.test(name) && !ALLOWED.has(name)) out.push(p)
  }
  return out
}

/** Lines that are code, not commentary: drops // and block-comment lines and JSX comments. */
function codeLines(text: string): string[] {
  return text.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
}

describe('the goal figure says "model runs" everywhere — no hand-typed "chance" wording', () => {
  const files = sourceFiles(ROOT)

  it('POSITIVE CONTROL: the scan sees the source tree, and the register carries the ruled phrase', () => {
    expect(files.length).toBeGreaterThan(500)
    const register = files.find((f) => f.endsWith('goalAnchorCopy.ts'))!
    expect(readFileSync(register, 'utf8')).toContain('reaches the target in ${formatted} of model runs')
    // The predicate bites on the old wordings it is asked to exclude.
    for (const old of ['25% chance of success', 'X chance of reaching target.', '5% chance of target.', '34% chance of hitting your goal', '< 1% likely to reach target', 'Chance all your limits hold', 'No probability of reaching this target', 'Probability of meeting this target', 'cannot show probability of success']) {
      expect(FORBIDDEN.test(old), old).toBe(true)
    }
  })

  it('no source line outside comments carries the forbidden goal-chance wording', () => {
    const hits: string[] = []
    for (const f of files) {
      codeLines(readFileSync(f, 'utf8')).forEach((l) => { if (FORBIDDEN.test(l)) hits.push(`${f.replace(ROOT, 'src')}: ${l.trim().slice(0, 120)}`) })
    }
    expect(hits).toEqual([])
  })
})
