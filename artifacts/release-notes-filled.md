# Release Notes Template

## What Changed (Plain English)

<!-- Brief, non-technical summary of what users will notice -->
-
-
-

## Why It Matters

<!-- Business value and user impact -->
-
-

## How to Try It

<!-- Simple steps for users to test the new features -->
1.
2.
3.

## Flags/Toggles

<!-- Feature flags and configuration changes -->
- **New flags**:
- **Changed defaults**:
- **Deprecated flags**:

## Risk & Rollback

<!-- Single line about risk level and rollback plan -->
**Risk**: <!-- Low/Medium/High --> | **Rollback**: <!-- Brief description of rollback procedure -->

## Evidence Links

<!-- Auto-populated by notes:prepare script -->
### Validation Status
- 🔗 [Release Validation](./artifacts/release-summary.json)
- 🔗 [Integration Status](./artifacts/integration-status.html)
- 🔗 [Evidence Pack](./artifacts/index.html)

### Testing Reports
- 🔗 [Determinism Check](./artifacts/determinism-check.json)
- 🔗 [SSE Stability](./artifacts/sse-stability.json)
- 🔗 [Config Lint](./artifacts/config-lint.json)

### Documentation
- 🔗 [Feature Flags](./artifacts/flags.html)
- 🔗 [Operator Handbook](./artifacts/operator-handbook.md)
- 🔗 [API Collection](./tools/postman-collection.json)

### Release Readiness
```
✅ TypeScript compilation - OK
✅ Unit tests - OK
✅ Integration status report available
✅ Deterministic analysis validation - OK
✅ Configuration security check - OK
✅ No obvious secrets detected in source code
✅ Creating evidence pack ZIP - OK
✅ Evidence pack created: release-poc-2025-09-24T18-30-30.zip (139KB)
✅ Contracts - TypeScript compilation & unit tests
✅ Tests - API contracts & validation
✅ Integration - End-to-end system checks
✅ Determinism - Reproducible analysis results
✅ Secret/PII Guards - Configuration security
**🟢 **GO**** - PoC Release Decision
```

---
*Generated: 24/09/2025, 19:30:40 | Version: PoC-2025-09-24*