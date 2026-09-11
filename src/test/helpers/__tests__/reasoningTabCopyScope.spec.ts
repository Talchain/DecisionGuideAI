/**
 * THE IMPORT-CLOSURE WALK'S OWN GUARD.
 *
 * `reasoningTabCopyScope.ts` derives the corpus that every copy guard on the
 * Reasoning tab publishes a verdict over. It is SHARED: `noEmDashesInRendered
 * Copy.spec.ts` consumes it today and `noWinnerVocabulary.spec.ts` is named to
 * migrate onto it. A file the walk silently drops is dropped for every consumer
 * at once, and each of them reports a clean sweep while doing it.
 *
 * ── ⭐⭐⭐ WHY THIS FILE EXISTS — THE DEFECT IT WOULD HAVE CAUGHT ────────────
 * The first version of the walk marked a file `seen` ON POP and then used the
 * barrel name set it was popped WITH. Five files in this closure import
 * `../modals`, asking between them for five different bindings. The first pop
 * won; every later arrival hit `if (seen.has(file)) continue` and its names
 * were discarded unread.
 *
 * Measured: the shipped walk returned 93 copy files, a union-corrected walk 94.
 * The dropped file was `modals/analysedOptions.ts` — a DIRECT dependency of the
 * render root, which imports `hasAnalysedOptions` through that barrel at
 * `AnalysisNewTabBody.tsx:52` and calls it at `:774`.
 *
 * ⚠ EVERY INSTRUMENT AGREED WITH EVERY OTHER. `unresolved` was empty, because
 * the edge was never OFFERED to the resolver. The consuming spec's four
 * positive controls all sit on the name set that won the first pop. Its
 * contrast controls check what must be OUT, and the dropped file was out. The
 * corpus-size floor is 50 and 93 clears it. Nothing was broken; the walk simply
 * stopped looking, which is the one failure mode this estate's guards are
 * written to make loud (CLAUDE.md trap 13).
 *
 * ── HOW THIS GUARD IS BOUND, AND WHY NOT BY A COUNT ────────────────────────
 * A count assertion (`toBe(94)`) passes on ANY 94-file answer, including a
 * wrong one, and it reds on every legitimate addition to the tab. So the
 * verdict below binds by FILE IDENTITY to the one path the defect closed: a
 * module reachable ONLY through a SECOND visit to a barrel, on a name set the
 * first visit did not carry.
 *
 * The preconditions are asserted rather than assumed, because the witness only
 * witnesses anything while that shape holds (CLAUDE.md trap 13b — a guard whose
 * discrimination depends on a fixture that nothing pins). If a refactor makes
 * `analysedOptions.ts` reachable directly, this file reds and says so, instead
 * of passing forever on a first-visit edge.
 *
 * ⚠ WHICH file a one-set-per-file walk drops is a LIFO ORDERING ARTEFACT, not a
 * property of `analysedOptions.ts`. That is the point of the contrast below: a
 * sibling reached through the SAME barrel on a DIFFERENT name set. The pair
 * separates "this walk follows second visits" from "this walk reaches a lot of
 * files", and only the first is what the correction bought.
 *
 * ── THE ALIAS TWIN, PINNED WITHOUT A FIXTURE ───────────────────────────────
 * `parseEdges` used to record only the name BEFORE `as` and use it both as what
 * the target must export and as what a consumer asks for. Those are two
 * different names on a re-export. It does not bite on today's walk (neither
 * selectively-walked barrel carries an `as`), so a closure-size assertion CANNOT
 * see it and none is attempted. It is pinned instead at the two pure functions
 * that decide it, where the discrimination is exact.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  reasoningTabCopyScope,
  parseEdges,
  edgeIsRequested,
  resolveSpec,
  TAB_RENDER_ROOT,
  COPY_SCOPE_PREFIX,
} from '../reasoningTabCopyScope'

const abs = (rel: string): string => resolve(process.cwd(), rel)
const read = (rel: string): string => readFileSync(abs(rel), 'utf8')

const { files: COVERED_FILES, unresolved: UNRESOLVED_SPECS } = reasoningTabCopyScope()

/** The barrel that is reached more than once, with different names each time. */
const MODALS_BARREL = 'src/components/results/modals/index.ts'

/**
 * ⭐ THE WITNESS. Reachable ONLY by following the modals barrel a SECOND time,
 * for a binding the first visit did not ask for. The shipped walk returned 93
 * files and did not contain this one; the corrected walk returns 94 and does.
 */
const SECOND_VISIT_WITNESS = 'src/components/results/modals/analysedOptions.ts'

/** The binding that carries the witness in. */
const SECOND_VISIT_BINDING = 'hasAnalysedOptions'

/**
 * ⭐ THE CONTRAST. Reached through the SAME barrel on a DIFFERENT name set, so
 * a one-set-per-file walk keeps exactly one of the two. Asserting the witness
 * alone would not distinguish "second visits are followed" from "the walk got
 * bigger"; asserting both does.
 */
const FIRST_VISIT_CONTRAST = 'src/components/results/modals/decisionRecordStore.ts'

/** Every in-closure import of the modals barrel, with the names it asks for. */
const barrelImporters = COVERED_FILES.flatMap(rel =>
  parseEdges(read(rel))
    .filter(e => resolveSpec(e.spec, abs(rel)) === abs(MODALS_BARREL))
    .map(e => ({ rel, names: e.exposed ?? [] })),
)

describe('the Reasoning tab copy-scope walk', () => {
  describe('the instrument itself', () => {
    it('PRECONDITION: the walk resolved every specifier it was offered', () => {
      // An unresolved specifier shrinks the corpus in exactly the way this file
      // exists to catch, so it is a hard error here too, not only downstream.
      expect(
        UNRESOLVED_SPECS,
        `unresolved import specifiers:\n  ${UNRESOLVED_SPECS.join('\n  ')}`,
      ).toEqual([])
    })

    it('PRECONDITION: it reaches a real corpus and reports each file once', () => {
      expect(COVERED_FILES.length, 'the import walk collapsed').toBeGreaterThan(50)
      // The walk now re-processes a file for names it has not been walked for,
      // so a file can be POPPED several times. It must still be REPORTED once:
      // a duplicate would mean the visit record is not keyed by file.
      expect([...new Set(COVERED_FILES)].length, 'a file is reported twice').toBe(
        COVERED_FILES.length,
      )
      for (const f of COVERED_FILES) expect(f.startsWith(COPY_SCOPE_PREFIX)).toBe(true)
    })

    it('PRECONDITION: it is deterministic — two walks agree', () => {
      // Re-entering the walk must not depend on state left by the first. A
      // per-file accumulator that leaked across calls would show up here.
      expect(reasoningTabCopyScope().files).toEqual(COVERED_FILES)
    })
  })

  describe('the second-visit path, which is what the correction bought', () => {
    it('PRECONDITION: the barrel is reached MORE THAN ONCE, with DIFFERENT names', () => {
      // ⭐ The shape the witness depends on. If this stops holding, the witness
      // below stops witnessing anything and this file says so rather than
      // passing on a first-visit edge (CLAUDE.md trap 13b).
      expect(
        barrelImporters.length,
        `only ${barrelImporters.length} in-closure file imports ${MODALS_BARREL}; ` +
          'a single importer cannot produce a second visit',
      ).toBeGreaterThan(1)
      const distinct = new Set(barrelImporters.map(i => [...i.names].sort().join('|')))
      expect(distinct.size, 'every importer asks for the same names: no second name set exists').
        toBeGreaterThan(1)
    })

    it('PRECONDITION: exactly one importer asks for the witness binding, and others do not', () => {
      // This is what makes the witness DROPPABLE: one name set carries it, at
      // least one other does not, so a walk that keeps one set per file has a
      // real chance of keeping the wrong one.
      const asking = barrelImporters.filter(i => i.names.includes(SECOND_VISIT_BINDING))
      expect(asking.map(i => i.rel)).toEqual([TAB_RENDER_ROOT])
      expect(
        barrelImporters.some(i => !i.names.includes(SECOND_VISIT_BINDING)),
        'every importer asks for the witness binding, so no visit can discard it',
      ).toBe(true)
    })

    it('PRECONDITION: the barrel is the ONLY route to the witness', () => {
      // If anything in the closure imported it directly, it would arrive on a
      // first visit and the verdict below would be satisfied by the wrong path.
      const direct = COVERED_FILES.filter(
        rel => rel !== MODALS_BARREL && parseEdges(read(rel)).some(e => resolveSpec(e.spec, abs(rel)) === abs(SECOND_VISIT_WITNESS)),
      )
      expect(direct, `the witness is reachable directly from: ${direct.join(', ')}`).toEqual([])
      // And the barrel really does route the binding there.
      const routed = parseEdges(read(MODALS_BARREL)).filter(e =>
        edgeIsRequested(e, [SECOND_VISIT_BINDING]),
      )
      expect(routed.length, 'no barrel edge serves the witness binding').toBe(1)
      expect(resolveSpec(routed[0]!.spec, abs(MODALS_BARREL))).toBe(abs(SECOND_VISIT_WITNESS))
    })

    it('⭐ VERDICT: the walk reaches a file carried ONLY by a second visit to a barrel', () => {
      // ⭐⭐ THE ASSERTION THE SHIPPED WALKER FAILS. Bound by file identity, not
      // by a count: `toBe(94)` would pass on any 94-file answer, including one
      // that swapped this file for another, and would red on every legitimate
      // addition to the tab.
      expect(existsSync(abs(SECOND_VISIT_WITNESS)), 'the witness file has moved').toBe(true)
      expect(
        COVERED_FILES,
        `${SECOND_VISIT_WITNESS} is a direct dependency of the render root ` +
          `(${TAB_RENDER_ROOT}:52 imports ${SECOND_VISIT_BINDING} through ${MODALS_BARREL}) ` +
          'and the walk did not reach it. A walk that marks a file seen before using the ' +
          'name set it was popped with discards every later arrival: this is that drop.',
      ).toContain(SECOND_VISIT_WITNESS)
    })

    it('CONTRAST: a sibling on the SAME barrel, on a DIFFERENT name set, is also reached', () => {
      // ⭐ The other half of the pair. A one-set-per-file walk keeps exactly one
      // of these two, and WHICH one is a LIFO artefact rather than a property of
      // either file. Both present is the claim; it separates "second visits are
      // followed" from "the closure happens to be large".
      expect(COVERED_FILES).toContain(FIRST_VISIT_CONTRAST)
      const carriers = parseEdges(read(MODALS_BARREL)).filter(
        e => resolveSpec(e.spec, abs(MODALS_BARREL)) === abs(FIRST_VISIT_CONTRAST),
      )
      expect(carriers.length, 'the contrast is not served by the barrel at all').toBe(1)
      expect(
        carriers[0]!.exposed?.includes(SECOND_VISIT_BINDING) ?? false,
        'the contrast rides the same barrel edge as the witness, so it is not a contrast',
      ).toBe(false)
    })
  })

  describe('the alias twin: `source` and `exposed` are two different names', () => {
    it('DISCRIMINATION: a re-export alias matches on the EXPOSED name, not the source one', () => {
      // ⭐⭐ THE PAIR. `export { default as Header } from './Header'` is live in
      // this repo at `components/ProsConsList/components/index.ts`. A consumer
      // writes `import { Header } from '...'`, so the barrel must be followed
      // when `Header` is requested and NOT when `default` is. Recording only the
      // pre-`as` name makes the first case miss and the second case hit: both
      // halves are asserted, because either alone passes on a broken parse.
      const [edge] = parseEdges(`export { default as Header } from './Header'`)
      expect(edge!.source, 'the name the target must export').toEqual(['default'])
      expect(edge!.exposed, 'the name a consumer asks for').toEqual(['Header'])
      expect(edgeIsRequested(edge!, ['Header']), 'an aliased re-export is not followed').toBe(true)
      expect(
        edgeIsRequested(edge!, ['default']),
        'matching on the pre-`as` name: a consumer cannot ask for it',
      ).toBe(false)
    })

    it('DISCRIMINATION: an import alias carries the SOURCE name forward', () => {
      // The mirror of the case above, and the reason the two fields cannot be
      // collapsed in either direction. `./x` must export `foo`; the local name
      // `bar` is what a sibling `export { bar }` would offer on.
      const [edge] = parseEdges(`import { foo as bar } from './x'`)
      expect(edge!.source).toEqual(['foo'])
      expect(edge!.exposed).toEqual(['bar'])
    })

    it('CONTROL: with no alias the two agree, which is why merging them survived review', () => {
      const [edge] = parseEdges(`export { alpha, beta } from './m'`)
      expect(edge!.source).toEqual(['alpha', 'beta'])
      expect(edge!.exposed).toEqual(['alpha', 'beta'])
      // And a type-only binding still resolves to a real name rather than ''.
      expect(parseEdges(`import type { Thing } from './t'`)[0]!.exposed).toEqual(['Thing'])
      expect(parseEdges(`import { type Thing as T } from './t'`)[0]!.source).toEqual(['Thing'])
    })

    it('CONTROL: a clause with no braces offers no named binding', () => {
      // `null`, not `[]` — a default or namespace import is not "asks for
      // nothing", and a selective barrel must not follow it.
      const [star] = parseEdges(`import * as ns from './m'`)
      expect(star!.exposed).toBeNull()
      expect(star!.wildcard).toBe(true)
      expect(edgeIsRequested(star!, ['anything'])).toBe(false)
    })
  })
})
