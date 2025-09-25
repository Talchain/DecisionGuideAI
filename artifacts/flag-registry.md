# Flag Registry

Central registry of all feature flags and configuration options for the Scenario Sandbox PoC.

**Safety First**: All powerful features are OFF by default. Enable only what you need for testing.

## Feature Flags

### Server-Sent Events Streaming 🟡

- **Key**: `VITE_FEATURE_SSE`
- **Default**: `false`
- **Type**: boolean
- **Environment**: client
- **Toggle**: Environment variable or localStorage
- **Risk Level**: medium

Enable real-time streaming of analysis results via SSE

**Observable Behavior**: Stream panel shows real-time token updates; "Start" button initiates streaming

---

## Security & Analysis

### Secret Hygiene Scanner 🔴

- **Key**: `SECRET_HYGIENE_ENABLED`
- **Default**: `false`
- **Type**: boolean
- **Environment**: server
- **Toggle**: env
- **Risk Level**: critical

Scan code and logs for accidentally exposed secrets

**Observable Behavior**: Server logs show hygiene scan results; blocks deployments with exposed secrets

---

## Demo & Simulation

### Simulation Mode 🟢

- **Key**: `VITE_SIM_MODE`
- **Default**: `false`
- **Type**: boolean
- **Environment**: client
- **Toggle**: Environment variable or localStorage
- **Risk Level**: low

Use deterministic offline simulation instead of real services

**Observable Behavior**: Predictable token streams; no external service calls; safe for demos

---

## Usage Notes

- **Environment variables** take precedence over localStorage
- **Boolean flags**: Use `1` or `true` to enable, `0` or `false` to disable
- **Client-side flags** (VITE_*) can be toggled via localStorage in DevTools
- **Server-side flags** require environment variables and service restart

