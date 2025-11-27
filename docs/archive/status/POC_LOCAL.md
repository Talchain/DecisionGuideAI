# PoC Local Development

One-command bring-up for PoC mode with all sandbox features enabled.

## Prerequisites

- **Node 20** (via nvm or system Node)
- **Engine service** running locally on port 4311

---

## Quick Start

### 1. Start Engine Service

In your `plot-lite-service` repo:

```bash
cd ~/Documents/GitHub/plot-lite-service

# Set environment variables
export PORT=4311
export CORS_ORIGINS="http://localhost:5174,http://127.0.0.1:5174,http://localhost:5173,http://127.0.0.1:5173"
export TEST_ROUTES=1

# Start the Engine
npm run dev
```

**Expected output:**
```
Server running on http://127.0.0.1:4311
```

### 2. Start UI (PoC Mode)

In this repo (`DecisionGuideAI`):

```bash
npm run dev:poc
```

**What this does:**
- ✅ Uses Node 20 (via nvm if available)
- ✅ Frees port 5174
- ✅ Sets all PoC environment variables
- ✅ Installs dependencies
- ✅ Starts Vite dev server

**Expected output:**
```
=== PoC UI Dev Server ===

Using Node 20 via nvm...
Freeing port 5174...
Port 5174 is free

PoC environment configured:
  VITE_POC_ONLY=1
  VITE_AUTH_MODE=guest
  VITE_EDGE_GATEWAY_URL=http://127.0.0.1:4311

Installing dependencies...
Starting Vite dev server on port 5174...
Open: http://localhost:5174/#/sandbox

  VITE v5.4.20  ready in XXX ms

  ➜  Local:   http://localhost:5174/
  ➜  Network: http://192.168.1.X:5174/
```

---

## Verification

### 3. Run Acceptance Tests

In a separate terminal:

```bash
npm run accept:poc
```

**Expected output:**
```
=== UI ACCEPTANCE ===
ENGINE_ACCEPT: {"status":"ok","p95_ms":...}
UI_ACCEPT: url=http://localhost:5174/#/sandbox, mode=PoC, auth=guest, engine=http://127.0.0.1:4311
```

### 4. Browser Verification

Open: **http://localhost:5174/#/sandbox**

**Expected behavior:**
- ✅ Sandbox panel renders immediately
- ✅ No login screen
- ✅ No navigation bar
- ✅ Guest authentication active
- ✅ All sandbox features enabled

**Browser Console:**
```javascript
// Check PoC mode
console.log('PoC:', import.meta.env.VITE_POC_ONLY);
// Expected: PoC: 1

// Check Engine health
fetch('http://127.0.0.1:4311/health')
  .then(r => r.json())
  .then(data => console.log('✅ Engine:', data));
// Expected: ✅ Engine: {status: "ok", ...}

// Test SSE stream
const es = new EventSource('http://127.0.0.1:4311/demo/stream?scenario=sch1');
es.addEventListener('hello', e => console.log('✅ hello:', e.data));
es.addEventListener('token', e => console.log('✅ token:', e.data));
es.addEventListener('done', () => {
  console.log('✅ done');
  es.close();
});
```

---

## Features Enabled in PoC Mode

When `VITE_POC_ONLY=1`, all sandbox features default to **ON**:

- ✅ **SSE Streaming** (`VITE_FEATURE_SSE`)
- ✅ **Scenario Sandbox** (`VITE_FEATURE_SCENARIO_SANDBOX`)
- ✅ **Decision CTA** (`VITE_FEATURE_SANDBOX_DECISION_CTA`)
- ✅ **Mapping** (`VITE_FEATURE_SANDBOX_MAPPING`)
- ✅ **Projections** (`VITE_FEATURE_SANDBOX_PROJECTIONS`)
- ✅ **Realtime** (`VITE_FEATURE_SANDBOX_REALTIME`)
- ✅ **Strategy Bridge** (`VITE_FEATURE_SANDBOX_STRATEGY_BRIDGE`)
- ✅ **Triggers (Basic)** (`VITE_FEATURE_SANDBOX_TRIGGERS_BASIC`)
- ✅ **Voting** (`VITE_FEATURE_SANDBOX_VOTING`)
- ✅ **Whiteboard** (`VITE_FEATURE_WHITEBOARD`)

---

## Environment Variables

The `dev:poc` script automatically sets:

```bash
VITE_POC_ONLY=1                          # Enable PoC mode
VITE_AUTH_MODE=guest                     # Guest authentication (no Supabase)
VITE_FEATURE_SCENARIO_SANDBOX=1          # Sandbox feature
VITE_FEATURE_SSE=1                       # SSE streaming
VITE_EDGE_GATEWAY_URL=http://127.0.0.1:4311  # Local Engine URL
VITE_SUPABASE_URL=http://example.invalid # Dummy (not used)
VITE_SUPABASE_ANON_KEY=dummy             # Dummy (not used)
# VITE_OPENAI_API_KEY is unset          # Engine-only mode
```

---

## Troubleshooting

### Port 5174 is busy
```bash
# Kill the process manually
lsof -ti:5174 | xargs kill -9
```

### Engine not responding
```bash
# Check Engine is running
curl http://127.0.0.1:4311/health

# Expected: {"status":"ok",...}
```

### Sandbox doesn't render
1. ✅ Check `VITE_FEATURE_SSE=1` is set
2. ✅ Check `VITE_FEATURE_SCENARIO_SANDBOX=1` is set
3. ✅ Check browser console for errors
4. ✅ Verify Engine is running and healthy

### nvm not found
The script will continue with your system Node version. Ensure it's Node 20:
```bash
node --version
# Should be v20.x.x
```

---

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `npm run dev:poc` | Start PoC UI dev server (all features ON) |
| `npm run accept:poc` | Run acceptance tests |
| `npm run build:poc` | Build PoC for production |

---

## Files

- **`scripts/dev-poc-ui.sh`** - PoC dev server script
- **`tools/accept-ui.mjs`** - Acceptance test script
- **`.nvmrc`** - Node version (20)
- **`src/flags.ts`** - PoC-aware flags system
- **`src/main.tsx`** - PoC acceptance logging

---

## What's Different from Full App?

| Feature | Full App | PoC Mode |
|---------|----------|----------|
| **Authentication** | Supabase | Guest (no DB calls) |
| **Routes** | All routes | Only `/sandbox` |
| **Navigation** | Global navbar | None |
| **Landing Page** | Yes | No (redirects to sandbox) |
| **OpenAI** | Optional | Not used (Engine-only) |
| **Features** | Gated by flags | All ON by default |

---

## Next Steps

1. ✅ **Local development** - Use `npm run dev:poc`
2. ✅ **Netlify deployment** - Merge PR and deploy
3. ✅ **Verification** - Run acceptance tests
4. ✅ **Documentation** - Share POC_LOCAL.md with team
