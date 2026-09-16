/**
 * EVERY ASK THAT HOLDS A RECOMMENDATION MUST CARRY ITS `block_id`.
 *
 * ## The loss, located
 *
 * `buildRecommendations.ts:501` puts the producer's finding id on the
 * recommendation: `action.parameters = { block_id: item.id }`. The Ask drawer
 * forwards `parameters` verbatim on the dispatched turn
 * (`AskOlumiDrawer.handleSend`), so that id is the only thing on the wire that
 * says WHICH finding the user is working through. The finding's own paragraph
 * is `context`, which the drawer renders read-only and never sends.
 *
 * Derived across the tree, not hand-listed — five `openAskOlumi` call sites
 * hold a recommendation, and `AnalysisNewTabBody.tsx:1165` was the one that
 * dropped `parameters`. It is wired to FIVE mount points on the Reasoning tab,
 * so the tab's primary "Work through with Olumi" route dispatched a coaching
 * turn with no finding and no id — the user reads a finding, presses the
 * button, and the turn arrives about nothing in particular.
 *
 * ## Why this is a DERIVED guard and not a list
 *
 * ⛔ THIS CLASS HAS NOW RECURRED THREE TIMES ON THIS SURFACE.
 * `askRoutesCarryTheFinding.spec.tsx` exists because a fix "closed one instance
 * of the class and stopped", and states the enumeration in words: *"every
 * `openAskOlumi` call that HOLDS a recommendation"*. It then pinned three of
 * them BY HAND — so the fourth route, in a different file, was invisible to it.
 * A hand-maintained enumeration of the sites a rule applies to is the same
 * mirror defect as a hand-maintained list of values (trap 12), one level up.
 *
 * This guard derives the population from the source at run time. A new
 * rec-holding ask route fails it the day it is written, wherever it lives.
 *
 * ⚠ WHAT IT CANNOT DO, STATED SO NOBODY READS MORE INTO IT. It watches the
 * CARRIER (does this call site pass `parameters`?), never the BEHAVIOUR (does
 * the id reach CEE, and can CEE resolve it?). Those are different claims and
 * this one is the weaker. Receiver-side resolution is a question for Core and
 * is not evidenced here.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(process.cwd(), 'src')

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      sourceFiles(p, out)
    } else if (
      (p.endsWith('.ts') || p.endsWith('.tsx')) &&
      !p.endsWith('.spec.ts') &&
      !p.endsWith('.spec.tsx') &&
      !p.endsWith('.test.ts') &&
      !p.endsWith('.test.tsx')
    ) {
      out.push(p)
    }
  }
  return out
}

/** Every `openAskOlumi({ … })` call, as `{file, line, body}`. */
function askCallSites(): Array<{ file: string; line: number; body: string }> {
  const sites: Array<{ file: string; line: number; body: string }> = []
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, 'utf8')
    if (!text.includes('openAskOlumi({')) continue
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i]!.includes('openAskOlumi({')) continue
      // Brace-balance from the opening `{` to its match — the call's own body,
      // never a fixed window that could clip a long site or swallow the next.
      let depth = 0
      let body = ''
      let started = false
      for (let j = i; j < lines.length; j++) {
        for (const ch of lines[j]!) {
          if (ch === '{') {
            depth++
            started = true
          } else if (ch === '}') depth--
        }
        body += `${lines[j]!}\n`
        if (started && depth <= 0) break
      }
      sites.push({ file: file.slice(SRC.length + 1), line: i + 1, body })
    }
  }
  return sites
}

/**
 * ⚠ COMMENTS ARE STRIPPED BEFORE ANY PREDICATE RUNS, AND THIS WAS MEASURED.
 * A first cut tested the raw body. A mutant that deleted the forwarding line
 * and left a comment reading "parameters dropped" SURVIVED with `applied=1` —
 * the guard matched its own explanation. Every one of these call sites carries
 * a long docblock naming the very fields the rule is about, so on this surface
 * that is the normal case, not a contrived one. Same class as the estate's DS
 * scanner, which trips on a docblock explaining the rule it enforces.
 */
const stripComments = (body: string): string =>
  body.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

/** A site HOLDS a recommendation when it reads fields off one. */
const holdsRecommendation = (body: string): boolean => /\brec\.\w/.test(stripComments(body))

describe('every ask that holds a recommendation carries its block_id', () => {
  const sites = askCallSites()

  it('pins its own precondition: the sweep found call sites and found rec-holding ones', () => {
    // Without this the suite would pass by finding NOTHING — an absence probe
    // with no positive control (trap 13). Both counts are asserted, and the
    // rec-holding count is the population the rule is about.
    expect(sites.length).toBeGreaterThanOrEqual(5)
    expect(sites.filter((s) => holdsRecommendation(s.body)).length).toBeGreaterThanOrEqual(5)
  })

  it('pins the contrast: the sweep can tell a rec-holding site from one without', () => {
    // A predicate that answered YES for everything would make the rule vacuous
    // while looking thorough. There must be at least one ask that carries no
    // recommendation — the completed-limit ask is one, by design.
    expect(sites.some((s) => !holdsRecommendation(s.body))).toBe(true)
  })

  it('forwards parameters from every rec-holding ask route', () => {
    const offenders = sites
      .filter((s) => holdsRecommendation(s.body))
      .filter((s) => !/\bparameters\b/.test(stripComments(s.body)))
      .map((s) => `${s.file}:${s.line}`)
    expect(offenders).toEqual([])
  })
})
