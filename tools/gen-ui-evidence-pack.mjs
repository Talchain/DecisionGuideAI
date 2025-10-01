// tools/gen-ui-evidence-pack.mjs
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { exec as _exec } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(_exec)

async function main() {
  const uiDir = path.join(process.cwd(), 'docs/evidence/ui')
  await mkdir(uiDir, { recursive: true })

  const seed = '777'
  const model = 'local-sim'
  const prefix = `evidence-pack-seed${seed}-model-${model}`
  const tmpDir = path.join(uiDir, prefix)
  await mkdir(tmpDir, { recursive: true })

  const snapshot = {
    id: 'local-1',
    at: new Date(0).toISOString(),
    seed,
    model,
    data: { nodes: [{ id: 'n1', label: 'A' }, { id: 'n2', label: 'B' }], edges: [{ id: 'e1', from: 'n1', to: 'n2', w: 0.9 }] }
  }
  await writeFile(path.join(tmpDir, 'snapshot.json'), JSON.stringify(snapshot, null, 2), 'utf8')

  const reportSrc = path.join(process.cwd(), 'src/fixtures/reports/report.v1.example.json')
  const reportBytes = await readFile(reportSrc)
  await writeFile(path.join(tmpDir, 'report.json'), reportBytes)

  const health = { status: 'ok', p95_ms: 0 }
  await writeFile(path.join(tmpDir, 'health.json'), JSON.stringify(health, null, 2), 'utf8')

  const pkg = JSON.parse(await readFile(path.join(process.cwd(), 'package.json'), 'utf8'))
  const version = { name: pkg.name, version: pkg.version, node: process.versions.node }
  await writeFile(path.join(tmpDir, 'version.json'), JSON.stringify(version, null, 2), 'utf8')

  const headers = ['GET /report', 'Accept: application/json', 'User-Agent: EvidenceGen/1.0'].join('\n') + '\n'
  await writeFile(path.join(tmpDir, 'headers.txt'), headers, 'utf8')

  const zipPath = path.join(uiDir, `${prefix}.zip`)
  const files = ['snapshot.json', 'report.json', 'health.json', 'version.json', 'headers.txt']
    .map(f => path.join(tmpDir, f))

  await exec(`zip -j ${JSON.stringify(zipPath)} ${files.map(f => JSON.stringify(f)).join(' ')}`)
  console.log('[ui-pack] wrote:', zipPath)
}

main().catch((err) => { console.error(err); process.exit(1) })
