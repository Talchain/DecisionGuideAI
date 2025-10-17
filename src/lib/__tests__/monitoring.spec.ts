import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolveMonitoringConfig, isMonitoringEnabled } from '../monitoring'

describe('Monitoring Configuration', () => {
  describe('resolveMonitoringConfig', () => {
    it('disables all in development', () => {
      const config = resolveMonitoringConfig({
        MODE: 'development',
        VITE_SENTRY_DSN: 'https://test@sentry.io/123',
        VITE_HOTJAR_ID: '1234567',
      } as ImportMetaEnv)

      expect(config.enabled.sentry).toBe(false)
      expect(config.enabled.webVitals).toBe(false)
      expect(config.enabled.hotjar).toBe(false)
    })

    it('disables all in test', () => {
      const config = resolveMonitoringConfig({
        MODE: 'test',
        VITE_SENTRY_DSN: 'https://test@sentry.io/123',
        VITE_HOTJAR_ID: '1234567',
      } as ImportMetaEnv)

      expect(config.enabled.sentry).toBe(false)
      expect(config.enabled.webVitals).toBe(false)
      expect(config.enabled.hotjar).toBe(false)
    })

    it('requires DSN for Sentry in production', () => {
      const config = resolveMonitoringConfig({
        MODE: 'production',
        VITE_HOTJAR_ID: '1234567',
      } as ImportMetaEnv)

      expect(config.enabled.sentry).toBe(false)
    })

    it('enables Sentry with valid DSN in production', () => {
      const config = resolveMonitoringConfig({
        MODE: 'production',
        VITE_SENTRY_DSN: 'https://test@sentry.io/123',
      } as ImportMetaEnv)

      expect(config.enabled.sentry).toBe(true)
      expect(config.dsn).toBe('https://test@sentry.io/123')
    })

    it('validates Hotjar ID format (6-9 digits)', () => {
      const validIds = ['123456', '1234567', '12345678', '123456789']
      const invalidIds = ['12345', '1234567890', 'abc123', '']

      validIds.forEach(id => {
        const config = resolveMonitoringConfig({
          MODE: 'production',
          VITE_HOTJAR_ID: id,
        } as ImportMetaEnv)
        expect(config.enabled.hotjar).toBe(true)
      })

      invalidIds.forEach(id => {
        const config = resolveMonitoringConfig({
          MODE: 'production',
          VITE_HOTJAR_ID: id,
        } as ImportMetaEnv)
        expect(config.enabled.hotjar).toBe(false)
      })
    })

    it('respects VITE_ENABLE_WEB_VITALS=false', () => {
      const config = resolveMonitoringConfig({
        MODE: 'production',
        VITE_ENABLE_WEB_VITALS: 'false',
      } as ImportMetaEnv)

      expect(config.enabled.webVitals).toBe(false)
    })

    it('enables Web Vitals by default in production', () => {
      const config = resolveMonitoringConfig({
        MODE: 'production',
      } as ImportMetaEnv)

      expect(config.enabled.webVitals).toBe(true)
    })

    it('includes release version when provided', () => {
      const config = resolveMonitoringConfig({
        MODE: 'production',
        VITE_RELEASE_VERSION: '2.0.0',
      } as ImportMetaEnv)

      expect(config.release).toBe('2.0.0')
    })
  })

  describe('isMonitoringEnabled', () => {
    it('returns false when all disabled', () => {
      const enabled = isMonitoringEnabled()
      // In test mode, should be false
      expect(enabled).toBe(false)
    })
  })
})
