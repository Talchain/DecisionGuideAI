/**
 * Payload Guard (M1.6)
 * Client-side 96KB payload enforcement
 */

const MAX_PAYLOAD_KB = 96
const MAX_PAYLOAD_BYTES = MAX_PAYLOAD_KB * 1024

export interface PayloadValidation {
  valid: boolean
  sizeKB: number
  error?: string
}

/**
 * Validate payload size before transmission
 */
export function validatePayloadSize(payload: unknown): PayloadValidation {
  const json = JSON.stringify(payload)
  const sizeBytes = new Blob([json]).size
  const sizeKB = Math.round(sizeBytes / 1024)

  if (sizeBytes > MAX_PAYLOAD_BYTES) {
    return {
      valid: false,
      sizeKB,
      error: `Payload exceeds ${MAX_PAYLOAD_KB}KB limit (${sizeKB}KB)`,
    }
  }

  return {
    valid: true,
    sizeKB,
  }
}
