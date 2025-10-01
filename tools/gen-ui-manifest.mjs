// tools/gen-ui-manifest.mjs
// Scans docs/evidence/ui and writes a manifest of files with size bytes
import { promises as fs } from 'fs'
import path from 'path'

const root = 'docs/evidence/ui'

async function walk(dir) {
  let out = []
  let ents
  try { ents = await fs.readdir(dir, { withFileTypes: true }) } catch { return out }
  for (const ent of ents) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      out = out.concat(await walk(p))
    } else {
      try {
        const st = await fs.stat(p)
        out.push({ path: p, bytes: st.size })
      } catch {}
    }
  }
  return out
}

const files = await walk(root)
await fs.mkdir(root, { recursive: true })
await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), files }, null, 2))
console.log(`Wrote UI manifest with ${files.length} entries`)
