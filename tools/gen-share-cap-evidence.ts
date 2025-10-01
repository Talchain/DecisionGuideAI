// tools/gen-share-cap-evidence.ts
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { encodeSnapshotToUrlParam } from '../src/lib/snapshotShare'
import { randomBytes } from 'node:crypto'

async function main() {
  const outDir = path.join(process.cwd(), 'docs/evidence/share')
  await mkdir(outDir, { recursive: true })
  let msg = ''
  try {
    // Construct a payload that is difficult to compress, to exceed 8KB after encoding
    const rnd = randomBytes(10 * 1024).toString('base64') // ~13.3KB base64 string
    const data = { rnd }
    const param = encodeSnapshotToUrlParam({ v: 1, seed: '777', model: 'local-sim', data })
    // In case it unexpectedly succeeds (should not), record length
    msg = `Unexpected: param length=${param.length}`
  } catch (e: any) {
    msg = String(e?.message || e)
  }
  await writeFile(path.join(outDir, 'url_cap_evidence.txt'), msg, 'utf8')
  console.log('[share-cap] wrote evidence:', msg)
}

main().catch((err) => { console.error(err); process.exit(1) })
