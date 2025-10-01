// tools/gen-share-cap-evidence.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { deflateRaw } from 'pako'
import { randomBytes } from 'node:crypto'

const MAX_URL_PARAM_BYTES = 8 * 1024
const COMPRESS_THRESHOLD = 1500

function base64UrlEncode(buf) {
  const b64 = Buffer.from(buf).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function encodeSnapshotToUrlParam(p) {
  const json = JSON.stringify(p)
  const utf8 = Buffer.from(json, 'utf8')
  let param
  if (utf8.byteLength > COMPRESS_THRESHOLD) {
    const deflated = deflateRaw(utf8)
    param = 'z:' + base64UrlEncode(deflated)
  } else {
    param = base64UrlEncode(utf8)
  }
  if (param.length > MAX_URL_PARAM_BYTES) {
    throw new Error('Link too large; please use Export/Import JSON')
  }
  return param
}

async function main() {
  const outDir = path.join(process.cwd(), 'docs/evidence/share')
  await mkdir(outDir, { recursive: true })
  let msg = ''
  try {
    // Incompressible payload (~22KB when encoded) to reliably exceed 8KB cap
    const rnd = randomBytes(16 * 1024).toString('base64')
    const param = encodeSnapshotToUrlParam({ v: 1, seed: '777', model: 'local-sim', data: { rnd } })
    msg = `Unexpected: param length=${param.length}`
  } catch (e) {
    msg = String(e && e.message ? e.message : e)
  }
  await writeFile(path.join(outDir, 'url_cap_evidence.txt'), msg + '\n', 'utf8')
  console.log('[share-cap] wrote evidence:', msg)
}

main().catch((err) => { console.error(err); process.exit(1) })
