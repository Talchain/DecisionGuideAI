#!/usr/bin/env node
/**
 * ⭐⭐ THE AFFORDANCE CENSUS — can a person REACH this control?
 *
 * WHY IT EXISTS. On 19 Sep 2026 one day produced SEVEN instances of one
 * failure, each found by hand and each taking minutes:
 *
 *   canvas edge strength   built, wired to a CEE writer, operable on 24 of the
 *                          founder's 26 edges — he never found it and spent
 *                          34 minutes asking the chat to do it instead
 *   EdgeEditPopover        a complete inline weight/belief editor, ZERO call sites
 *   ConnectPrompt          imported and rendered, zero non-null callers
 *   TriageCard pills       dark behind a flag, writing 1.2 into a |0..1| model
 *   the breadcrumb ring    33 writers, 0 readers in the export
 *   KeyRelationships       zero product call sites
 *   ScientificEditor       zero render sites; only `import type`
 *
 * ⛔ THE REACHABILITY LEDGER CANNOT SEE ANY OF THESE, and that is not a defect
 * in it. It answers *"does the code path execute?"* — and every item above is
 * module-reachable. This answers a different question: *"can a person find it?"*
 * Two authorities, two questions, named apart (CLAUDE.md trap 21). ⛔ This is
 * NOT "a better ledger", which doctrine forbids; it is the question the ledger
 * does not ask.
 *
 * ⚠ WHAT IT MEASURES, PRECISELY, so nobody reads it as more than it is:
 * a component that can WRITE (it calls a mutation hook or a store setter) and
 * has NO product render site is DARK — built and unreachable. That is a
 * structural claim about the source, not a claim about pixels. A component with
 * a render site may still be undiscoverable, which is the edge-strength case
 * and needs a live pass over the seeded canvas route.
 *
 * ⛔ DARK IS NOT AUTOMATICALLY A DEFECT. `ModelExtentNotice` is unmounted
 * BECAUSE THE FOUNDER RULED IT OUT, twice. An absence somebody DECIDED looks
 * exactly like an absence somebody MISSED, and no scan can tell them apart —
 * so the census reports, and `DECLARED_DARK` records the ones with a ruling,
 * each with its reason. An undeclared dark writer is what this exists to catch.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, basename, extname } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

/** Signals that a component can change the model. */
const WRITE_SIGNALS = [
  /use[A-Z]\w*Mutations\s*\(/,
  /useCanvasStore\s*\(\s*s\s*=>\s*s\.(update|set|add|delete|remove|apply)/,
  /\bonUpdate[A-Z]\w*\s*[(:]/,
  /\bsetStrength\b|\bsetDirection\b|\bsetPriorRange\b|\bupdateEdge\b|\bupdateNode\b/,
]

/**
 * Dark by decision, with the decision. ⚠ An entry here is a CLAIM that someone
 * ruled on it; it must name who and why, or it is just a way of silencing the
 * scan.
 */
const DECLARED_DARK = {
  'ModelExtentNotice.tsx':
    'Ruled out by the founder twice — "just get rid of it completely" (14 Sep 2026). '
    + 'Pinned as intentionally unmounted by overlayOwner.sourceScan.spec.ts.',
  'ScientificEditor.tsx':
    'Zero render sites; only `import type { ScientificEditorProps }`. TriageCard renders that '
    + 'props SHAPE with its own controls. Recorded in domain/vocabulary.ts, 18 Sep 2026.',
  'KeyRelationships.tsx':
    'Zero product call sites — the only import and every usage in src/ and e2e/ is its own spec. '
    + 'Recorded in domain/vocabulary.ts, 18 Sep 2026.',
}

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name)
  if (statSync(p).isDirectory()) {
    return name === '__tests__' || name === 'node_modules' ? [] : walk(p)
  }
  return /\.tsx$/.test(name) ? [p] : []
})

const files = walk(SRC)
const sources = new Map(files.map(f => [f, readFileSync(f, 'utf8')]))

/** Every file's text, excluding the component's own definition, for call-site search. */
const writers = []
for (const [file, text] of sources) {
  if (!WRITE_SIGNALS.some(re => re.test(text))) continue
  const name = basename(file, extname(file))
  // A render site is `<Name` or `<Name/` anywhere in product source.
  const tag = new RegExp(`<${name}[\\s/>]`)
  const callSites = [...sources.entries()]
    .filter(([other, otherText]) => other !== file && tag.test(otherText))
    .map(([other]) => relative(ROOT, other))
  writers.push({ file: relative(ROOT, file), name, callSites })
}

const dark = writers.filter(w => w.callSites.length === 0)
const declared = dark.filter(w => DECLARED_DARK[basename(w.file)])
const undeclared = dark.filter(w => !DECLARED_DARK[basename(w.file)])

console.log(`CANVAS AFFORDANCE CENSUS  —  ${files.length} .tsx files scanned`)
console.log(`  writing components : ${writers.length}`)
console.log(`  with a render site : ${writers.length - dark.length}`)
console.log(`  DARK               : ${dark.length}  (${declared.length} declared, ${undeclared.length} NOT declared)`)
console.log()
if (undeclared.length) {
  console.log('⛔ UNDECLARED DARK WRITERS — built, able to change the model, no render site:')
  for (const w of undeclared) console.log(`     ${w.name.padEnd(30)} ${w.file}`)
  console.log()
}
if (declared.length) {
  console.log('✓ DARK BY DECISION:')
  for (const w of declared) console.log(`     ${w.name.padEnd(30)} ${DECLARED_DARK[basename(w.file)].slice(0, 96)}…`)
}

// ⚠ NON-ZERO ONLY ON AN UNDECLARED FINDING. A census that always exits 1 stops
// being read, and one that always exits 0 stops being run.
process.exit(undeclared.length > 0 ? 1 : 0)
