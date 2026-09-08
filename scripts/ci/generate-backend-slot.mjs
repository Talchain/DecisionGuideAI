import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function selectBackendSlot(env) {
  const slot = env.OLUMI_BACKEND_SLOT
  if (env.CONTEXT === 'production' || env.BRANCH === 'manual-test') {
    if (slot !== 'manual-test') throw new Error('This deployment requires OLUMI_BACKEND_SLOT=manual-test')
  }
  if (slot !== undefined && slot !== 'staging' && slot !== 'manual-test') {
    throw new Error('Invalid OLUMI_BACKEND_SLOT')
  }
  const selected = slot ?? 'staging'
  if (selected === 'manual-test' &&
      env.VITE_V5_ENDPOINT?.trim() !== 'https://olumi-assistants-service.onrender.com/proxy/v5/turn') {
    throw new Error('The manual-test slot requires its dedicated CEE V5 endpoint')
  }
  return selected
}

export function generateBackendSlot(env, destination = new URL('../../netlify/edge-functions/_shared/backend-slot.generated.ts', import.meta.url)) {
  const slot = selectBackendSlot(env)
  writeFileSync(destination, `// Generated at build time; contains no secrets.\nexport const BACKEND_SLOT = '${slot}' as const\n`)
  return slot
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    generateBackendSlot(process.env)
    console.log('generate-backend-slot: PASS (edge and direct V5 routes bound)')
  } catch (error) {
    console.error(`::error::${error.message}`)
    process.exitCode = 1
  }
}
