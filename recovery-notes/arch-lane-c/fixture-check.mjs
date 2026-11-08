import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'
const req = createRequire(path.resolve('package.json')); const Ajv = req('ajv/dist/2020').default
const isNode = (n) => n !== null && typeof n === 'object' && !Array.isArray(n)
function opened(n, siblingOnly = null) {
  if (Array.isArray(n)) return n.map((x) => opened(x)); if (!isNode(n)) return n
  const out = {}
  for (const [k, v] of Object.entries(n)) {
    if (k === 'additionalProperties' && v === false) continue
    if ((k === 'anyOf' || k === 'oneOf') && Array.isArray(v)) {
      const shapes = v.filter((b) => isNode(b) && isNode(b.properties)); const all = new Set(shapes.flatMap((b) => Object.keys(b.properties)))
      out[k] = v.map((b) => (shapes.length > 1 && shapes.includes(b) ? opened(b, [...all].filter((x) => !Object.keys(b.properties).includes(x))) : opened(b))); continue
    }
    out[k] = opened(v)
  }
  if (siblingOnly && siblingOnly.length) out.propertyNames = { not: { enum: siblingOnly } }
  return out
}
const v = new Ajv({ strict: false }).compile(opened(JSON.parse(fs.readFileSync('src/olumiView/view.v3.json', 'utf8'))))
const files = []; const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.view3?\.json$/.test(f)) files.push(p) } }
walk('src/olumiView/golden'); walk('src/olumiView/fixtures')
let bad = 0; for (const f of files) { const j = JSON.parse(fs.readFileSync(f, 'utf8')); if (!v(j)) { bad++; const e = v.errors[0]; console.log('FAIL', f.replace('src/olumiView/', ''), e.instancePath || '/', e.message, JSON.stringify(e.params)) } }
console.log({ files: files.length, fail: bad })
