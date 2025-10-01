// tools/gen-ui-evidence-pack.ts
import { mkdir, writeFile, readFile } from 'fs/promises'
import path from 'path'
import { exec as _exec } from 'child_process'
import { promisify } from 'util'

const exec = promisify(_exec)

async function main() {
  const uiDir = path.join(process.cwd(), 'docs/evidence/ui')
  await mkdir(uiDir, { recursive: true })

  const seed = '777'
  const model = 'local-sim'
  const prefix = `evidence-pack-seed${seed}-model-${model}`
  const tmpDir = path.join(uiDir, prefix)
  await mkdir(tmpDir, { recursive: true })

  // snapshot.json — minimal deterministic sample
  const snapshot = {
    id: 'local-1',
    at: new Date(0).toISOString(),
    seed,
    model,
    data: {
      nodes: [ { id: 'n1', label: 'A' }, { id: 'n2', label: 'B' } ],
      edges: [ { id: 'e1', from: 'n1', to: 'n2', w: 0.9 } ]
    }
  }
  await writeFile(path.join(tmpDir, 'snapshot.json'), JSON.stringify(snapshot, null, 2), 'utf8')

  // report.json — copy fixture bytes unmodified
  const reportSrc = path.join(process.cwd(), 'src/fixtures/reports/report.v1.example.json')
  const reportBytes = await readFile(reportSrc)
  await writeFile(path.join(tmpDir, 'report.json'), reportBytes)

  // health.json — minimal shape
  const health = { status: 'ok', p95_ms: 0 }
  await writeFile(path.join(tmpDir, 'health.json'), JSON.stringify(health, null, 2), 'utf8')

  // version.json — from package.json
  const pkg = JSON.parse(await readFile(path.join(process.cwd(), 'package.json'), 'utf8'))
  const version = { name: pkg.name, version: pkg.version, node: process.versions.node }
  await writeFile(path.join(tmpDir, 'version.json'), JSON.stringify(version, null, 2), 'utf8')

  // headers.txt — redacty, no secrets
  const headers = [
    'GET /report',
    'Accept: application/json',
    'User-Agent: EvidenceGen/1.0',
  ].join('\n') + '\n'
  await writeFile(path.join(tmpDir, 'headers.txt'), headers, 'utf8')

  // zip it (junk paths)
  const zipPath = path.join(uiDir, `${prefix}.zip`)
  const files = ['snapshot.json', 'report.json', 'health.json', 'version.json', 'headers.txt']
    .map(f => path.join(tmpDir, f))
  await exec(`zip -j ${JSON.stringify(zipPath)} ${files.map(f => JSON.stringify(f)).join(' ')}`)

  console.log('[ui-pack] wrote:', zipPath)
}

main().catch((err) => { console.error(err); process.exit(1) })
