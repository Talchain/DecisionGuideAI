#!/usr/bin/env node
import { promises as fs } from 'fs'
import path from 'path'

async function* walk(dir) {
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      // Skip common large / generated directories
      const name = ent.name
      if (name === 'node_modules' || name === 'dist' || name === '.git' || name === '.github') continue
      yield* walk(p)
    } else {
      yield p
    }
  }
}

async function main() {
  const root = process.cwd()
  const offenders = []

  for await (const p of walk(root)) {
    const rel = path.relative(root, p)
    const base = path.basename(p)
    // Guardrail: flag files with a literal " 2." suffix in the basename, e.g. "foo 2.ts".
    if (/ 2\.[^/]+$/.test(base)) {
      offenders.push(rel)
    }
  }

  if (offenders.length) {
    console.error('Duplicate-suffix guard FAIL: found files with " 2." in the name (likely editor duplicates).')
    console.error('These should not be committed. Offending paths:')
    for (const f of offenders) {
      console.error(' -', f)
    }
    process.exit(1)
  }

  console.log('Duplicate-suffix guard PASS: no "* 2.*" files found in repository.')
}

main().catch(err => {
  console.error('Duplicate-suffix guard ERROR:', err?.message || err)
  process.exit(1)
})
