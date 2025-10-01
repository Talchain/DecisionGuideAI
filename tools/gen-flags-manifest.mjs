// tools/gen-flags-manifest.mjs
// Scans src/flags.ts to generate a manifest of feature env keys and detector functions.
// Writes manifest.json and manifest_drift.json under docs/evidence/flags/.
import { promises as fs } from 'fs'
import path from 'path'

const flagsFile = 'src/flags.ts'
const outDir = 'docs/evidence/flags'
const baselineFile = path.join(outDir, 'manifest.baseline.json')

function uniq(arr) { return Array.from(new Set(arr)).sort() }

const src = await fs.readFile(flagsFile, 'utf8')
const envKeys = uniq((src.match(/VITE_[A-Z0-9_]+/g) || []))
const fnNames = uniq((src.match(/export\s+function\s+(is[A-Za-z0-9_]+)/g) || []).map(m => m.split('function ')[1]))

const manifest = { generatedAt: new Date().toISOString(), envKeys, functions: fnNames }
await fs.mkdir(outDir, { recursive: true })
await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

let baseline = null
try { baseline = JSON.parse(await fs.readFile(baselineFile, 'utf8')) } catch {}
if (!baseline) {
  await fs.writeFile(baselineFile, JSON.stringify(manifest, null, 2))
  baseline = manifest
}

function diffArr(a, b) {
  const A = new Set(a || []); const B = new Set(b || [])
  const added = [...A].filter(x => !B.has(x)).sort()
  const removed = [...B].filter(x => !A.has(x)).sort()
  return { added, removed }
}

const drift = {
  generatedAt: new Date().toISOString(),
  envKeys: diffArr(manifest.envKeys, baseline.envKeys),
  functions: diffArr(manifest.functions, baseline.functions),
}
await fs.writeFile(path.join(outDir, 'manifest_drift.json'), JSON.stringify(drift, null, 2))

console.log(`Flags manifest written. Env keys: ${envKeys.length}, functions: ${fnNames.length}`)
if ((drift.envKeys.added.length + drift.envKeys.removed.length + drift.functions.added.length + drift.functions.removed.length) > 0) {
  console.log('Drift detected:', JSON.stringify(drift, null, 2))
}
