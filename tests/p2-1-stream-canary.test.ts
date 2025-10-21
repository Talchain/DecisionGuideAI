import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';

async function waitFor(url: string, ms = 8000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 80));
  }
  throw new Error('timeout');
}

describe('P2-1: Stream Canary Header', () => {
  let child: any = null;
  const BASE = 'http://127.0.0.1:4353';

  beforeAll(async () => {
    child = spawn(process.execPath, ['dist/main.js'], {
      env: { ...process.env, PORT: '4353', PROMETHEUS_ENABLE: '1', RATE_LIMIT_ENABLED: '0' },
      stdio: 'ignore'
    });
    await waitFor(`${BASE}/health`);
  });

  afterAll(() => { try { if (child?.pid) process.kill(child.pid, 'SIGINT'); } catch {} });

  it('accepts X-Enable-Enhanced-Stream: 1', async () => {
    const r = await fetch(`${BASE}/v1/stream?demo=1`, { headers: { 'X-Enable-Enhanced-Stream': '1' } });
    expect(r.ok).toBe(true);
  });

  it('accepts X-Enable-Enhanced-Stream: true', async () => {
    const r = await fetch(`${BASE}/v1/stream?demo=1`, { headers: { 'X-Enable-Enhanced-Stream': 'true' } });
    expect(r.ok).toBe(true);
  });

  it('accepts legacy X-Stream-Enhanced', async () => {
    const r = await fetch(`${BASE}/v1/stream?demo=1`, { headers: { 'X-Stream-Enhanced': 'yes' } });
    expect(r.ok).toBe(true);
  });

  it('emits canary metrics', async () => {
    await fetch(`${BASE}/v1/stream?demo=1`, { headers: { 'X-Enable-Enhanced-Stream': '1' } });
    const m = await fetch(`${BASE}/metrics`);
    const text = await m.text();
    expect(text).toContain('plot_engine_stream_canary_total');
  });
});
