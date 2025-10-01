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
  const e2eDir = path.join(root, 'e2e')
  const offenders = []
  try {
    for await (const p of walk(e2eDir)) {
      if (!p.endsWith('.spec.ts')) continue
      if (p.endsWith('_helpers.ts')) continue
      const txt = await fs.readFile(p, 'utf8')
      const mentionsSandbox = txt.includes('#/sandbox')
      const usesHelper = txt.includes('gotoSandbox(')
      if (mentionsSandbox && !usesHelper) offenders.push(p)
    }
  } catch (e) {
    console.error('Symptom: CI guard failed to scan e2e specs')
    console.error('Likely cause:', e?.message || e)
    console.error('Minimal patch plan: ensure e2e/ exists and contains specs; re-run guard')
    process.exit(1)
  }
  if (offenders.length) {
    console.error('Provider stub guard FAIL. The following specs reference #/sandbox without gotoSandbox():')
    for (const p of offenders) console.error(' -', path.relative(root, p))
    process.exit(1)
  }
  console.log('Provider stub guard PASS')
}

main()
