#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs'
import { gzipSync } from 'zlib'

const BUDGET = 200 * 1024
const dist = 'dist/assets'

const files = readdirSync(dist).filter(f => f.endsWith('.js') && !f.endsWith('.map'))
let total = 0, failed = false

console.log('📦 Bundle Report (gzipped)\n')

files.forEach(f => {
  const size = gzipSync(readFileSync(`${dist}/${f}`)).length
  total += size
  const kb = (size/1024).toFixed(1)
  const status = size > BUDGET ? '❌' : '✅'
  console.log(`${status} ${f}: ${kb} KB`)
  if (size > BUDGET) failed = true
})

console.log(`\nTotal: ${(total/1024).toFixed(1)} KB`)
process.exit(failed ? 1 : 0)
