/**
 * Secure Storage Wrapper
 *
 * Provides encrypted localStorage using Web Crypto API (AES-GCM).
 * Falls back to plaintext in development if encryption key is not set.
 *
 * Usage:
 *   import { secureStorage } from '@/lib/secureStorage'
 *   secureStorage.setItem('key', 'sensitive-data')
 *   const data = secureStorage.getItem('key')
 *
 * Environment:
 *   VITE_STORAGE_KEY - Base64-encoded 256-bit key for encryption
 *   If not set, falls back to plaintext storage with dev warning
 */

// Key derivation from environment
const STORAGE_KEY_ENV = import.meta.env.VITE_STORAGE_KEY as string | undefined

// Prefix for encrypted values to distinguish from plaintext
const ENCRYPTED_PREFIX = 'enc:v1:'

// Check if Web Crypto is available
const isWebCryptoAvailable = typeof crypto !== 'undefined' && !!crypto.subtle

/**
 * Derive a CryptoKey from the environment variable
 */
async function getEncryptionKey(): Promise<CryptoKey | null> {
  if (!STORAGE_KEY_ENV) {
    return null
  }

  try {
    // Decode base64 key
    const keyBytes = Uint8Array.from(atob(STORAGE_KEY_ENV), c => c.charCodeAt(0))

    // Import as AES-GCM key
    return await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[secureStorage] Failed to derive encryption key:', err)
    }
    return null
  }
}

// Cache the key promise to avoid repeated derivation
let keyPromise: Promise<CryptoKey | null> | null = null

function getKey(): Promise<CryptoKey | null> {
  if (!keyPromise) {
    keyPromise = getEncryptionKey()
  }
  return keyPromise
}

/**
 * Encrypt a string value using AES-GCM
 */
async function encrypt(value: string): Promise<string> {
  const key = await getKey()

  if (!key || !isWebCryptoAvailable) {
    // No encryption available - return plaintext
    return value
  }

  try {
    // Generate random IV (12 bytes for AES-GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12))

    // Encode value as UTF-8
    const encoder = new TextEncoder()
    const data = encoder.encode(value)

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    )

    // Combine IV + ciphertext and encode as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(encrypted), iv.length)

    return ENCRYPTED_PREFIX + btoa(String.fromCharCode(...combined))
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[secureStorage] Encryption failed:', err)
    }
    // Fall back to plaintext on error
    return value
  }
}

/**
 * Decrypt a string value using AES-GCM
 */
async function decrypt(stored: string): Promise<string> {
  // Check if value is encrypted
  if (!stored.startsWith(ENCRYPTED_PREFIX)) {
    // Not encrypted - return as-is (migration support)
    return stored
  }

  const key = await getKey()

  if (!key || !isWebCryptoAvailable) {
    // Can't decrypt without key - return raw value
    if (import.meta.env.DEV) {
      console.warn('[secureStorage] Cannot decrypt without VITE_STORAGE_KEY')
    }
    return stored.slice(ENCRYPTED_PREFIX.length)
  }

  try {
    // Decode base64
    const combined = Uint8Array.from(
      atob(stored.slice(ENCRYPTED_PREFIX.length)),
      c => c.charCodeAt(0)
    )

    // Extract IV (first 12 bytes) and ciphertext
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )

    // Decode UTF-8
    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[secureStorage] Decryption failed:', err)
    }
    // Return empty string on decryption failure (corrupted data)
    return ''
  }
}

/**
 * Secure Storage API
 *
 * Drop-in replacement for localStorage with automatic encryption.
 * Async methods are required due to Web Crypto API.
 */
export const secureStorage = {
  /**
   * Store an encrypted value
   */
  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await encrypt(value)
    localStorage.setItem(key, encrypted)
  },

  /**
   * Retrieve and decrypt a value
   */
  async getItem(key: string): Promise<string | null> {
    const stored = localStorage.getItem(key)
    if (stored === null) {
      return null
    }
    return decrypt(stored)
  },

  /**
   * Remove an item
   */
  removeItem(key: string): void {
    localStorage.removeItem(key)
  },

  /**
   * Clear all secure storage items
   * Note: This clears ALL localStorage, not just encrypted items
   */
  clear(): void {
    localStorage.clear()
  },

  /**
   * Check if encryption is available
   */
  isEncryptionEnabled(): boolean {
    return !!STORAGE_KEY_ENV && isWebCryptoAvailable
  },
}

/**
 * Sync wrapper for cases where async is not possible
 * Uses synchronous localStorage with no encryption (legacy compatibility)
 *
 * WARNING: Use only when async is not possible. Prefer secureStorage for new code.
 */
export const secureStorageSync = {
  setItem(key: string, value: string): void {
    if (import.meta.env.DEV && !STORAGE_KEY_ENV) {
      console.warn(
        '[secureStorage] Using sync storage without encryption. ' +
        'Set VITE_STORAGE_KEY for encrypted storage.'
      )
    }
    localStorage.setItem(key, value)
  },

  getItem(key: string): string | null {
    const stored = localStorage.getItem(key)
    // Handle encrypted values in sync mode (can't decrypt)
    if (stored?.startsWith(ENCRYPTED_PREFIX)) {
      if (import.meta.env.DEV) {
        console.warn(
          '[secureStorage] Encrypted value accessed via sync API. ' +
          'Use async secureStorage.getItem() instead.'
        )
      }
      return null
    }
    return stored
  },

  removeItem(key: string): void {
    localStorage.removeItem(key)
  },
}

// Development helper to generate a storage key
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as any).__generateStorageKey = async () => {
    const key = crypto.getRandomValues(new Uint8Array(32))
    const base64 = btoa(String.fromCharCode(...key))
    console.log('Generated VITE_STORAGE_KEY:')
    console.log(base64)
    console.log('\nAdd to .env.local:')
    console.log(`VITE_STORAGE_KEY=${base64}`)
    return base64
  }
}

export default secureStorage
