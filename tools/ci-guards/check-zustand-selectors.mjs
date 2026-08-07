#!/usr/bin/env node
import { promises as fs } from 'fs'
import path from 'path'

async function* walk(dir) {
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) yield* walk(p)
    else yield p
  }
}

// Detect real imports of zustand/shallow (ignore comments, require an import
// statement on a single line). Use [^;\n]* to prevent matching across lines
// (which would catch comments on later lines).
const importShallowRegex = /(^|\n)\s*import\s+[^;\n]*['"]zustand\/shallow['"]/m

// React #185 landmine = a BARE object selector passed straight to useCanvasStore:
//   useCanvasStore(s => ({ ... }))            // fresh object every render → #185
// The arrow must be the DIRECT first argument — an optional (params) or a single
// identifier, then `=>`, then `({`.
//
// A useShallow wrapper is the SAFE pattern and MUST NOT be flagged:
//   useCanvasStore(useShallow(s => ({ ... })))
// useShallow shallow-compares the returned object, so a fresh reference each
// render does not churn (this is the canonical Zustand v5 multi-field pattern,
// e.g. StyledEdge's audited 2-subscription consolidation). It does not match
// here because after `useCanvasStore(` comes the identifier `useShallow`
// followed by `(`, never `=>`. Bare object selectors are still caught
// regardless of import path — that is the actual React #185 protection.
//
// Known, pre-existing gap (out of scope for this guard, unchanged): a block-body
// selector `useCanvasStore(s => { return { ... } })` is not detected — matching
// it would false-flag block bodies that return primitives.
const bareObjectSelectorRegex = /useCanvasStore\s*\(\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\(\s*\{/m

// Positive control (repo memory: "an absence assertion is vacuous without a
// presence proof"). If the detection ever stops catching the dangerous shape, or
// starts catching the safe useShallow shape, fail LOUD rather than pass silently
// on a scan that proves nothing.
function selfTest() {
  const mustFlag = 'const x = useCanvasStore(s => ({ a: s.a, b: s.b }))'
  const mustFlagParen = 'const x = useCanvasStore((s) => ({ a: s.a }))'
  const mustPass = 'const x = useCanvasStore(useShallow(s => ({ a: s.a })))'
  const mustPassMultiline = 'useCanvasStore(\n  useShallow(s => ({\n    a: s.a,\n  })),\n)'
  const errs = []
  if (!bareObjectSelectorRegex.test(mustFlag)) errs.push('bare object selector no longer flagged')
  if (!bareObjectSelectorRegex.test(mustFlagParen)) errs.push('bare (parenthesised) object selector no longer flagged')
  if (bareObjectSelectorRegex.test(mustPass)) errs.push('useShallow-wrapped selector wrongly flagged')
  if (bareObjectSelectorRegex.test(mustPassMultiline)) errs.push('multiline useShallow-wrapped selector wrongly flagged')
  if (errs.length) {
    console.error('React-185 guard SELF-TEST FAILED — its detection is broken, refusing to run:')
    for (const e of errs) console.error(' -', e)
    process.exit(2)
  }
}

async function main() {
  selfTest()

  const root = process.cwd()
  const srcCanvasDir = path.join(root, 'src', 'canvas')

  const shallowOffenders = []
  const selectorOffenders = []

  try {
    for await (const p of walk(srcCanvasDir)) {
      if (!p.endsWith('.ts') && !p.endsWith('.tsx')) continue
      // Whitelist: OutputsDock has an intentional, audited useShallow pattern.
      if (p.endsWith(path.join('components', 'OutputsDock.tsx'))) continue

      const txt = await fs.readFile(p, 'utf8')

      if (importShallowRegex.test(txt)) {
        shallowOffenders.push(path.relative(root, p))
      }

      if (txt.includes('useCanvasStore(') && bareObjectSelectorRegex.test(txt)) {
        selectorOffenders.push(path.relative(root, p))
      }
    }
  } catch (e) {
    console.error('Symptom: React-185 guard failed to scan canvas sources')
    console.error('Likely cause:', e?.message || e)
    console.error('Minimal patch plan: ensure src/canvas/ exists and is readable; re-run guard')
    process.exit(1)
  }

  if (shallowOffenders.length || selectorOffenders.length) {
    console.error('React-185 guard FAIL. Unsafe Zustand patterns detected in canvas code.')

    if (shallowOffenders.length) {
      console.error('\nFiles importing zustand/shallow (forbidden in canvas):')
      for (const p of shallowOffenders) console.error(' -', p)
    }

    if (selectorOffenders.length) {
      console.error('\nFiles passing a BARE object selector to useCanvasStore (fresh object every render → React #185):')
      for (const p of selectorOffenders) console.error(' -', p)
      console.error('\nHint: wrap the selector in useShallow(...) or split it into individual field selectors.')
    }

    process.exit(1)
  }

  console.log('React-185 guard PASS: no unsafe Zustand shallow imports or bare object selectors in src/canvas')
}

main()
