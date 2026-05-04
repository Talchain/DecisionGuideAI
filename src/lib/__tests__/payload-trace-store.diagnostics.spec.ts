/**
 * Diagnostic-surface tests for payload-trace-store.
 *
 * P0 fix (2026-05): when payload inspection is disabled (VITE_APP_ENV not
 * in {development, staging}), the merged debug bundle now records WHY
 * traces are absent instead of silently showing payloadCount: 0. These
 * tests pin the inspection-status surface and the new error metadata
 * fields on TracedPayload.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  usePayloadTraceStore,
  getPayloadInspectionStatus,
  recordRequestPayload,
  recordResponsePayload,
  type TracedPayload,
} from '../payload-trace-store';

describe('payload-trace-store diagnostic surface', () => {
  describe('getPayloadInspectionStatus', () => {
    it('returns a stable shape regardless of resolved env', () => {
      const status = getPayloadInspectionStatus();
      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('resolvedAppEnv');
      expect(status).toHaveProperty('reason');
      expect(typeof status.enabled).toBe('boolean');
      expect(typeof status.resolvedAppEnv).toBe('string');
      // reason is null when enabled, non-null string when disabled
      if (status.enabled) {
        expect(status.reason).toBeNull();
      } else {
        expect(typeof status.reason).toBe('string');
        expect((status.reason ?? '').length).toBeGreaterThan(0);
      }
    });

    it('reason mentions VITE_APP_ENV when disabled', () => {
      const status = getPayloadInspectionStatus();
      if (!status.enabled) {
        expect(status.reason).toMatch(/VITE_APP_ENV/);
      }
    });
  });

  describe('TracedPayload error metadata (P0 fix 2026-05)', () => {
    beforeEach(() => {
      usePayloadTraceStore.setState({
        payloads: [],
        selectedId: null,
        filterService: null,
        filterStatus: null,
        searchQuery: '',
      });
    });

    it('persists errorName / errorCause / source when supplied', () => {
      const inspection = getPayloadInspectionStatus();
      // The inspection-disabled path returns silently in the test env if
      // VITE_APP_ENV is not in {dev, staging}. Skip the assertion in that
      // case — the contract is "fields are persisted iff capture is on".
      if (!inspection.enabled) {
        return;
      }

      const id = 'req-preflight-failure-1';
      recordRequestPayload({
        id,
        endpoint: 'https://cee-staging.onrender.com/proxy/v5/turn',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { kind: 'message' },
      });
      recordResponsePayload({
        id,
        status: 0,
        headers: {},
        body: null,
        duration: 12,
        error: 'Failed to fetch',
        errorName: 'TypeError',
        errorCause: 'NetworkError when attempting to fetch resource.',
        source: 'preflight_or_network',
      });

      const stored = usePayloadTraceStore
        .getState()
        .payloads.find((p) => p.id === id);
      expect(stored).toBeDefined();
      const payload = stored as TracedPayload;
      expect(payload.completed).toBe(true);
      expect(payload.errorName).toBe('TypeError');
      expect(payload.errorCause).toContain('NetworkError');
      expect(payload.source).toBe('preflight_or_network');
    });

    it.each([
      {
        label: 'bearer token',
        cause: 'TypeError: socket hangup; bearer abc123secrettoken stale',
        banned: ['abc123secrettoken'],
      },
      {
        label: 'api_key=value pair',
        cause: 'TypeError: failed handshake; api_key=ZAQWSXcdervfb',
        banned: ['ZAQWSXcdervfb'],
      },
      {
        label: 'token: value with colon',
        cause: 'fetch error response { token: t0pSecretValue1234 }',
        banned: ['t0pSecretValue1234'],
      },
      {
        label: 'authorization=value',
        cause: 'inner error: authorization=Bearer-XYZ-private',
        banned: ['Bearer-XYZ-private'],
      },
      {
        label: 'JWT-shaped string',
        cause: 'inner: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.abcDEF123-_',
        banned: ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.abcDEF123-_'],
      },
      {
        label: 'password=value',
        cause: 'AuthError password=hunter2',
        banned: ['hunter2'],
      },
    ])(
      'scrubs secret-like substrings from errorCause: $label (P1 fix 2026-05)',
      ({ cause, banned }) => {
        const inspection = getPayloadInspectionStatus();
        if (!inspection.enabled) return;

        const id = `req-redact-${cause.length}`;
        recordRequestPayload({
          id,
          endpoint: 'https://cee-staging.onrender.com/proxy/v5/turn',
          method: 'POST',
          headers: {},
          body: {},
        });
        recordResponsePayload({
          id,
          status: 0,
          headers: {},
          body: null,
          duration: 12,
          error: 'Failed to fetch',
          errorName: 'TypeError',
          errorCause: cause,
          source: 'preflight_or_network',
        });

        const stored = usePayloadTraceStore
          .getState()
          .payloads.find((p) => p.id === id) as TracedPayload | undefined;
        expect(stored).toBeDefined();
        expect(stored!.errorCause).toBeDefined();
        for (const secret of banned) {
          expect(
            stored!.errorCause!,
            `errorCause leaked secret: ${secret}`,
          ).not.toContain(secret);
        }
        // Hard cap to keep the bundle small.
        expect(stored!.errorCause!.length).toBeLessThanOrEqual(200);
      },
    );

    it('redacts a JWT that begins near the 200-char truncation boundary (P1 fix 2026-05)', () => {
      // Pre-fix: v5Adapter truncated the cause to 200 chars BEFORE the
      // store's redactor saw it. A JWT starting near char 195 would be
      // chopped mid-token, defeating the three-segment regex; the
      // partial JWT prefix (e.g. "eyJab") survived in the bundle.
      // Post-fix: the adapter forwards the full cause; the store
      // redacts FIRST, then truncates — so the full JWT pattern is
      // visible to the regex and gets fully replaced before truncation.
      const inspection = getPayloadInspectionStatus();
      if (!inspection.enabled) return;

      const padding = 'x'.repeat(190);
      const jwtSecret =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.abcDEF123-_secretEnd';
      const longCause = `${padding}${jwtSecret}`;

      const id = 'req-jwt-on-boundary-1';
      recordRequestPayload({
        id,
        endpoint: 'https://cee-staging.onrender.com/proxy/v5/turn',
        method: 'POST',
        headers: {},
        body: {},
      });
      recordResponsePayload({
        id,
        status: 0,
        headers: {},
        body: null,
        duration: 12,
        error: 'Failed to fetch',
        errorName: 'TypeError',
        errorCause: longCause,
        source: 'preflight_or_network',
      });

      const stored = usePayloadTraceStore
        .getState()
        .payloads.find((p) => p.id === id) as TracedPayload | undefined;
      expect(stored).toBeDefined();
      // Whole JWT must NOT survive verbatim.
      expect(stored!.errorCause).not.toContain(jwtSecret);
      // Even the JWT prefix (first segment) must NOT be present.
      expect(stored!.errorCause).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      // Truncation cap still applies after redaction.
      expect(stored!.errorCause!.length).toBeLessThanOrEqual(200);
    });

    it('exportPayloads includes errorName / errorCause / source / inspection (P1 fix 2026-05)', () => {
      const inspection = getPayloadInspectionStatus();
      if (!inspection.enabled) return;

      const id = 'req-export-fields-1';
      recordRequestPayload({
        id,
        endpoint: 'https://cee-staging.onrender.com/proxy/v5/turn',
        method: 'POST',
        headers: {},
        body: {},
      });
      recordResponsePayload({
        id,
        status: 0,
        headers: {},
        body: null,
        duration: 12,
        error: 'Failed to fetch',
        errorName: 'TypeError',
        errorCause: 'TypeError: NetworkError when attempting to fetch resource.',
        source: 'preflight_or_network',
      });

      const exported = JSON.parse(
        usePayloadTraceStore.getState().exportPayloads(),
      );
      expect(exported.inspection).toBeDefined();
      expect(exported.inspection.enabled).toBe(true);
      expect(exported.inspection.resolvedAppEnv).toBe(inspection.resolvedAppEnv);

      const target = exported.payloads.find((p: { id: string }) => p.id === id);
      expect(target).toBeDefined();
      expect(target.errorName).toBe('TypeError');
      expect(target.errorCause).toContain('NetworkError');
      expect(target.source).toBe('preflight_or_network');
    });

    it('preserves non-secret content in errorCause', () => {
      const inspection = getPayloadInspectionStatus();
      if (!inspection.enabled) return;

      const id = 'req-redact-clean';
      recordRequestPayload({
        id,
        endpoint: 'https://cee-staging.onrender.com/proxy/v5/turn',
        method: 'POST',
        headers: {},
        body: {},
      });
      recordResponsePayload({
        id,
        status: 0,
        headers: {},
        body: null,
        duration: 12,
        error: 'Failed to fetch',
        errorName: 'TypeError',
        errorCause: 'TypeError: NetworkError when attempting to fetch resource.',
        source: 'preflight_or_network',
      });

      const stored = usePayloadTraceStore
        .getState()
        .payloads.find((p) => p.id === id) as TracedPayload | undefined;
      expect(stored!.errorCause).toContain('NetworkError');
      expect(stored!.errorCause).toContain('TypeError');
    });

    it('omits errorName / errorCause / source when not supplied (no spurious empty strings)', () => {
      const inspection = getPayloadInspectionStatus();
      if (!inspection.enabled) return;

      const id = 'req-clean-200-1';
      recordRequestPayload({
        id,
        endpoint: 'https://cee-staging.onrender.com/proxy/v5/turn',
        method: 'POST',
        headers: {},
        body: {},
      });
      recordResponsePayload({
        id,
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: { ok: true },
        duration: 50,
      });

      const stored = usePayloadTraceStore
        .getState()
        .payloads.find((p) => p.id === id) as TracedPayload | undefined;
      expect(stored).toBeDefined();
      expect(stored!.errorName).toBeUndefined();
      expect(stored!.errorCause).toBeUndefined();
      expect(stored!.source).toBeUndefined();
    });
  });
});
