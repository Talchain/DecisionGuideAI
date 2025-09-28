#!/usr/bin/env node

/**
 * Contract Wall Gateway Mock Server
 * Implements the 6 endpoints for validation testing
 */

import http from 'http';
import { URL } from 'url';

const PORT = 3001;
const FROZEN_EVENTS = ['hello', 'token', 'cost', 'done', 'cancelled', 'limited', 'error'];

// Simple storage for active sessions and jobs
const activeSessions = new Map();
const activeJobs = new Map();
const healthMetrics = {
  p95_ms: 150,
  requestCount: 0,
  errorCount: 0,
  startTime: Date.now()
};

function sendSSE(res, event, data) {
  if (!FROZEN_EVENTS.includes(event)) {
    console.warn(`Warning: Non-frozen event type attempted: ${event}`);
    return;
  }
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function generateSeed() {
  return Math.random().toString(16).substr(2, 12).padStart(12, '0');
}

function recordRequest(startTime, isError = false) {
  const responseTime = Date.now() - startTime;
  healthMetrics.requestCount++;
  if (isError) healthMetrics.errorCount++;

  // Simulate P95 calculation (simplified)
  healthMetrics.p95_ms = Math.max(healthMetrics.p95_ms, responseTime);
}

const server = http.createServer((req, res) => {
  const startTime = Date.now();
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method.toLowerCase();

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Last-Event-ID');

  if (method === 'options') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // Route handling
    if (method === 'get' && url.pathname === '/stream') {
      handleStream(req, res, url);
    } else if (method === 'post' && url.pathname === '/cancel') {
      handleCancel(req, res);
    } else if (method === 'get' && url.pathname === '/jobs/stream') {
      handleJobsStream(req, res, url);
    } else if (method === 'post' && url.pathname === '/jobs/cancel') {
      handleJobsCancel(req, res);
    } else if (method === 'post' && url.pathname === '/report') {
      handleReport(req, res);
    } else if (method === 'get' && url.pathname === '/health') {
      handleHealth(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        code: 'BAD_INPUT',
        message: 'Endpoint not found',
        retryable: false,
        timestamp: new Date().toISOString()
      }));
      recordRequest(startTime, true);
    }
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      code: 'INTERNAL',
      message: 'Internal server error',
      retryable: true,
      timestamp: new Date().toISOString()
    }));
    recordRequest(startTime, true);
  }
});

function handleStream(req, res, url) {
  const startTime = Date.now();
  const seed = url.searchParams.get('seed');
  const resume = url.searchParams.get('resume');
  const lastEventId = req.headers['last-event-id'];

  if (!seed) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      code: 'BAD_INPUT',
      message: 'Missing required parameter: seed',
      retryable: false,
      timestamp: new Date().toISOString()
    }));
    recordRequest(startTime, true);
    return;
  }

  // Check if this is a resume request
  const isResume = resume === '1' || lastEventId;
  if (isResume) {
    if (activeSessions.has(seed)) {
      // Resume only once
      const sessionData = activeSessions.get(seed);
      if (sessionData.resumed) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          code: 'BAD_INPUT',
          message: 'Session already resumed - resume-once limit',
          retryable: false,
          timestamp: new Date().toISOString()
        }));
        recordRequest(startTime, true);
        return;
      }
      sessionData.resumed = true;
    } else {
      activeSessions.set(seed, { resumed: true, startTime: Date.now() });
    }
  } else {
    activeSessions.set(seed, { resumed: false, startTime: Date.now() });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send frozen event sequence
  setTimeout(() => sendSSE(res, 'hello', { sessionId: seed, timestamp: new Date().toISOString() }), 100);
  setTimeout(() => sendSSE(res, 'token', { content: 'Starting analysis...', progress: 0.1 }), 200);
  setTimeout(() => sendSSE(res, 'cost', { credits: 100, estimate: 500, breakdown: { analysis: 300, llm: 200 } }), 300);
  setTimeout(() => sendSSE(res, 'token', { content: 'Processing data...', progress: 0.5 }), 500);
  setTimeout(() => sendSSE(res, 'token', { content: 'Finalising...', progress: 0.9 }), 700);
  setTimeout(() => {
    sendSSE(res, 'done', { result: 'success', reportId: `rpt_${seed}`, analysisComplete: true });
    res.end();
    recordRequest(startTime);
  }, 1000);

  req.on('close', () => {
    recordRequest(startTime);
  });
}

function handleCancel(req, res) {
  const startTime = Date.now();
  let body = '';

  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const jobId = data.jobId;

      if (!jobId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          code: 'BAD_INPUT',
          message: 'Missing jobId',
          retryable: false,
          timestamp: new Date().toISOString()
        }));
        recordRequest(startTime, true);
        return;
      }

      // First cancel should be fast, subsequent should be no-ops
      const responseTime = activeJobs.has(jobId) ? 50 : 25; // Second call faster (cached)

      setTimeout(() => {
        if (!activeJobs.has(jobId)) {
          activeJobs.set(jobId, { cancelled: true, cancelCount: 1 });
        } else {
          activeJobs.get(jobId).cancelCount++;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          cancelled: true,
          jobId: jobId,
          timestamp: new Date().toISOString()
        }));
        recordRequest(startTime);
      }, responseTime);

    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        code: 'BAD_INPUT',
        message: 'Invalid JSON',
        retryable: false,
        timestamp: new Date().toISOString()
      }));
      recordRequest(startTime, true);
    }
  });
}

function handleJobsStream(req, res, url) {
  const startTime = Date.now();
  const jobId = url.searchParams.get('jobId');

  if (!jobId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      code: 'BAD_INPUT',
      message: 'Missing jobId',
      retryable: false,
      timestamp: new Date().toISOString()
    }));
    recordRequest(startTime, true);
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  setTimeout(() => sendSSE(res, 'hello', { jobId, status: 'monitoring', queuePosition: 1 }), 100);
  setTimeout(() => sendSSE(res, 'token', { jobId, stage: 'processing', progress: 0.3, eta: '45s' }), 300);
  setTimeout(() => sendSSE(res, 'done', { jobId, status: 'completed', resultUrl: `/results/${jobId}` }), 600);
  setTimeout(() => {
    res.end();
    recordRequest(startTime);
  }, 700);

  req.on('close', () => {
    recordRequest(startTime);
  });
}

function handleJobsCancel(req, res) {
  const startTime = Date.now();
  let body = '';

  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const jobId = data.jobId;

      if (!jobId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          code: 'BAD_INPUT',
          message: 'Missing jobId',
          retryable: false,
          timestamp: new Date().toISOString()
        }));
        recordRequest(startTime, true);
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        cancelled: true,
        jobId: jobId,
        previousStatus: 'running',
        timestamp: new Date().toISOString()
      }));
      recordRequest(startTime);

    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        code: 'BAD_INPUT',
        message: 'Invalid JSON',
        retryable: false,
        timestamp: new Date().toISOString()
      }));
      recordRequest(startTime, true);
    }
  });
}

function handleReport(req, res) {
  const startTime = Date.now();
  let body = '';

  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);

      // Validate basic report structure
      if (!data.seed) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          code: 'BAD_INPUT',
          message: 'Report validation failed',
          retryable: false,
          validationErrors: ['seed is required'],
          timestamp: new Date().toISOString()
        }));
        recordRequest(startTime, true);
        return;
      }

      // Return report.v1 response with meta.seed echoed
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        schema: 'report.v1',
        meta: {
          seed: data.seed,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          analysisType: 'decision'
        },
        reportId: `rpt_${generateSeed()}`,
        status: 'accepted',
        validationPassed: true,
        timestamp: new Date().toISOString()
      }));
      recordRequest(startTime);

    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        code: 'BAD_INPUT',
        message: 'Invalid JSON',
        retryable: false,
        timestamp: new Date().toISOString()
      }));
      recordRequest(startTime, true);
    }
  });
}

function handleHealth(req, res) {
  const startTime = Date.now();

  const uptime = Date.now() - healthMetrics.startTime;
  const errorRate = healthMetrics.requestCount > 0 ? healthMetrics.errorCount / healthMetrics.requestCount : 0;

  let status = 'healthy';
  if (errorRate > 0.1 || healthMetrics.p95_ms > 3000) {
    status = 'unhealthy';
  } else if (errorRate > 0.05 || healthMetrics.p95_ms > 1500) {
    status = 'degraded';
  }

  const healthData = {
    status,
    p95_ms: healthMetrics.p95_ms,
    replay: {
      lastStatus: 'success',
      refusals: Math.floor(Math.random() * 5),
      retries: Math.floor(Math.random() * 10),
      lastTs: new Date(Date.now() - Math.random() * 3600000).toISOString()
    },
    test_routes_enabled: process.env.NODE_ENV !== 'production'
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(healthData));
  recordRequest(startTime);
}

server.listen(PORT, () => {
  console.log(`🚀 Contract Wall Gateway running on http://localhost:${PORT}`);
  console.log(`📋 Endpoints: /stream, /cancel, /jobs/stream, /jobs/cancel, /report, /health`);
  console.log(`🧪 Frozen SSE events: ${FROZEN_EVENTS.join(', ')}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gateway...');
  server.close(() => {
    console.log('✅ Gateway stopped');
    process.exit(0);
  });
});