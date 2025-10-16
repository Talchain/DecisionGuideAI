#!/usr/bin/env node
import { execSync } from 'child_process'
import { readFileSync, readdirSync } from 'fs'
import { gzipSync } from 'zlib'

const distPath = 'dist/assets'
const files = readdirSync(distPath).filter(f => f.endsWith('.js') && !f.endsWith('.map'))

let total = 0, monitoring = 0
files.forEach(file => {
  const content = readFileSync(`${distPath}/${file}`)
  const size = gzipSync(content).length
  total += size
  if (readFileSync(`${distPath}/${file}`, 'utf-8').match(/sentry|web-vitals|hotjar/)) {
    monitoring += size
  }
})

console.log(`Total: ${(total/1024).toFixed(2)} KB`)
console.log(`Monitoring: ${(monitoring/1024).toFixed(2)} KB (${((monitoring/total)*100).toFixed(1)}%)`)
