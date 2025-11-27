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

async function main() {
  const root = process.cwd()
  const srcCanvasDir = path.join(root, 'src', 'canvas')

  const shallowOffenders = []
  const selectorOffenders = []

  // Detect real imports of zustand/shallow (ignore comments, require an import statement)
  const importShallowRegex = /(^|\n)\s*import\s+[^;]*['"]zustand\/shallow['"]/m
  // Detect useCanvasStore(s => ({ ... })) object selectors
  const selectorRegex = /useCanvasStore\s*\([^)]*=>\s*\(\s*\{/m

  try {
    for await (const p of walk(srcCanvasDir)) {
      if (!p.endsWith('.ts') && !p.endsWith('.tsx')) continue
      // Whitelist: OutputsDock has an intentional, audited useShallow pattern.
      if (p.endsWith(path.join('components', 'OutputsDock.tsx'))) continue

      const txt = await fs.readFile(p, 'utf8')

      if (importShallowRegex.test(txt)) {
        shallowOffenders.push(path.relative(root, p))
      }

      if (txt.includes('useCanvasStore(') && selectorRegex.test(txt)) {
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
      console.error('\nFiles using useCanvasStore with an object selector + shallow-style pattern:')
      for (const p of selectorOffenders) console.error(' -', p)
      console.error('\nHint: replace object selectors with individual field selectors, or use getState() helpers.')
    }

    process.exit(1)
  }

  console.log('React-185 guard PASS: no unsafe Zustand shallow imports or object selectors in src/canvas')
}

main()
