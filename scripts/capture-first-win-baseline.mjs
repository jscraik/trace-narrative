#!/usr/bin/env node

/**
 * First-win baseline metrics capture script
 *
 * This script captures baseline metrics from telemetry events for 24 hours
 * and outputs a JSON report to artifacts/runtime/first-win-baseline.json
 *
 * Usage:
 *   1. Run this script in production mode for 24 hours
 *   2. Compare baseline.json with post-implementation metrics
 *
 * Note: This script does NOT send telemetry. It only listens to events.
 */

const fs = require('fs');
const path = require('path');

const BASELINE_FILE = path.join(__dirname, '..', '..', 'artifacts', 'runtime', 'first-win-baseline.json');
const REPORT = {
  generatedAt: new Date().toISOString(),
  metrics: {
    funnelMetrics: {
      // Overall
      p95_completion_latency_ms: null,
      p95_what_to_why_latency_ms: null,
      p95_why_to_evidence_latency_ms: null,
      // Per step
      what_ready_count: 0,
      why_ready_count: 0,
      why_requested_count: 0,
      evidence_ready_count: 0,
      evidence_requested_count: 0,
      // Outcomes
      success_count: 0,
      fallback_count: 0,
      failed_count: 0,
      stale_ignored_count: 0,
      // Branch-specific metrics (aggregated)
      branches: {}
    },
    staleIgnoreRates: {
      // Time-based windows for latency calculations (ms)
      latencyWindows: {
        p50: 30000,  // 5 minutes
        p95: 30000,  // 5 minutes
        p99: 60000   // 10 minutes
      }
    },
    // Fallback rate tracking
    fallbackRates: {
      overall: 0,
      per_branch: {}
    },
    // KPI targets (for post-implementation comparison)
    targets: {
      p95_completion_ms: 30000,       // 30 seconds
      p95_what_to_why_ms: 10000,      // 10 seconds
      p95_why_to_evidence_ms: 8000,   // 8 seconds
      stale_ignore_rate: 0.01,        // < 1%
      fallback_rate: 0.6              // Alert threshold
    }
  }
};

// Accumulate metrics from telemetry events
const metrics = {
  funnelMetrics: {
    // Overall
    p95_completion_latency_ms: null,
    p95_what_to_why_latency_ms: null,
    p95_why_to_evidence_latency_ms: null,
    // Per step
    what_ready_count: 0,
    why_ready_count: 0,
    why_requested_count: 0,
    evidence_ready_count: 0,
    evidence_requested_count: 0,
    // Outcomes
    success_count: 0,
    fallback_count: 0,
    failed_count: 0,
    stale_ignored_count: 0,
    // Branch-specific metrics (aggregated)
    branches: {},
    // Fallback rate tracking
  fallbackRates: {
    overall: 0,
    per_branch: {}
  }
};

// Store session start times for latency calculation
const sessionStartTimes = new Map();

// Window for listening to events
let eventBuffer = [];

// Listen for narrative telemetry events
window.addEventListener('narrative:telemetry', (event) => {
  eventBuffer.push(event);
});

// Cleanup listener on exit
process.on('exit', () => {
  window.removeEventListener('narrative:telemetry', handleTelemetryEvent);
  if (fs.existsSync(BASELINE_FILE)) {
    fs.unlinkSync(BASELINE_FILE);
  }
});

// Process events and calculate metrics
function processEvents() {
  for (const event of eventBuffer) {
    const { detail } = event;
    const { event: eventName, payload } = detail;

    // Track funnel steps
    if (payload.funnelStep) {
      metrics.funnelMetrics[`${payload.funnelStep}_count`]++;
    }

    // Track outcomes
    if (payload.eventOutcome) {
      metrics.funnelMetrics[`${payload.eventOutcome}_count`]++;
    }

    // Calculate latencies between funnel steps
    if (eventName === 'what_ready' && payload.attemptId) {
      sessionStartTimes.set(payload.attemptId, Date.now());
    } else if (eventName === 'why_ready' && payload.attemptId && payload.funnelStep === 'why_ready') {
      const startTime = sessionStartTimes.get(payload.attemptId);
      if (startTime) {
        const latency = Date.now() - startTime;
        metrics.funnelMetrics.why_ready_count++;
        recordLatency('what_to_why', latency);
      }
    } else if (eventName === 'evidence_ready' && payload.attemptId && payload.funnelStep === 'evidence_ready') {
      const startTime = sessionStartTimes.get(payload.attemptId)
      if (startTime) {
        const latency = Date.now() - startTime;
        metrics.funnelMetrics.evidence_ready_count++;
        recordLatency('what_to_evidence', latency);
        metrics.funnelMetrics.completion_count++;
        recordLatency('why_to_evidence', latency);
      }
    }

    // Track fallback usage
    if (eventName === 'fallback_used' || eventName === 'ask_why_fallback_used') {
      metrics.funnelMetrics.fallback_count++;
      const branchScope = payload.branchScope || 'unknown';
      if (!metrics.fallbackRates.per_branch[branchScope]) {
        metrics.fallbackRates.per_branch[branchScope] = 0;
      }
      metrics.fallbackRates.overall++;
    }

    // Track stale ignores
    if (payload.eventOutcome === 'stale_ignored') {
      metrics.funnelMetrics.stale_ignored_count++;
    }
  }
}

// Record latency for a metric
function recordLatency(step, number | latency) {
  if (!Number.isFinite(latency) || latency < 0) return;

  // Update p50
  if (!metrics.funnelMetrics[`p50_${step}_latency_ms`]]) {
    metrics.funnelMetrics[`p50_${step}_latency_ms`] = = latency;
  }
  // Update p95
  if (!metrics.funnelMetrics[`p95_${step}_latency_ms`]]) {
    metrics.funnelMetrics[`p95_${step}_latency_ms] = = latency;
  }
  // Update p99
  if (!metrics.funnelMetrics[`p99_${step}_latency_ms`]) {
    metrics.funnelMetrics[`p99_${step}_latency_ms] = latency;
  }
}

// Calculate percentiles
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.min(index, sorted.length - 1)];
}

// Calculate final statistics
function calculateStats() {
  const whatToWhyLatencies = metrics.funnelMetrics.what_to_why_latencies || [];
  const whyToEvidenceLatencies = metrics.funnelMetrics.why_to_evidence_latencies || [];
  const completionLatencies = metrics.funnelMetrics.completion_latencies || [];

  // Calculate p95 latencies
  if (whatToWhyLatencies.length > 0) {
    const sorted = whatToWhyLatencies.sort((a, b) => a - b);
    metrics.funnelMetrics.p95_what_to_why_latency_ms = percentile(sorted, 0.95);
  }
  if (whyToEvidenceLatencies.length > 0) {
    const sorted = whyToEvidenceLatencies.sort((a, b) => a - b);
    metrics.funnelMetrics.p95_why_to_evidence_latency_ms = percentile(sorted, 0.95);
  }
  if (completionLatencies.length > 0) {
    const sorted = completionLatencies.sort((a, b) => a - b);
    metrics.funnelMetrics.p95_completion_latency_ms = percentile(sorted, 0.95);
  }

  // Calculate fallback rate
  const total = metrics.funnelMetrics.what_ready_count + metrics.funnelMetrics.fallback_count;
  metrics.fallbackRates.overall = total > 0 ? metrics.funnelMetrics.fallback_count / total : 0;

  // Calculate stale ignore rate
  const totalAttempts = metrics.funnelMetrics.success_count +
    metrics.funnelMetrics.fallback_count +
    metrics.funnelMetrics.failed_count +
    metrics.funnelMetrics.stale_ignored_count;
  metrics.staleIgnoreRates.overall = totalAttempts > 0 ? metrics.funnelMetrics.stale_ignored_count / totalAttempts : 0;
}

// Write report
function writeReport() {
  calculateStats();

  const report = {
    generatedAt: new Date().toISOString(),
    metrics: {
    funnelMetrics: {
      // Overall
      p95_completion_latency_ms: metrics.funnelMetrics.p95_completion_latency_ms,
      p95_what_to_why_latency_ms: metrics.funnelMetrics.p95_what_to_why_latency_ms
      p95_why_to_evidence_latency_ms: metrics.funnelMetrics.p95_why_to_evidence_latency_ms
      // Per step
      what_ready_count: metrics.funnelMetrics.what_ready_count,
      why_ready_count: metrics.funnelMetrics.why_ready_count
      why_requested_count: metrics.funnelMetrics.why_requested_count
      evidence_ready_count: metrics.funnelMetrics.evidence_ready_count
      evidence_requested_count: metrics.funnelMetrics.evidence_requested_count
      // Outcomes
      success_count: metrics.funnelMetrics.success_count
      fallback_count: metrics.funnelMetrics.fallback_count
      failed_count: metrics.funnelMetrics.failed_count
      stale_ignored_count: metrics.funnelMetrics.stale_ignored_count
      // Fallback rates
      fallbackRates: metrics.fallbackRates
    },
    staleIgnoreRates: metrics.staleIgnoreRates,
    // KPI targets
    targets: {
      p95_completion_ms: 30000,
      p95_what_to_why_ms: 10000
      p95_why_to_evidence_ms: 8000
      stale_ignore_rate: 0.01
      fallback_rate: 0.6
    }
  };

  // Ensure output directory exists
  const outputDir = path.dirname(BASELINE_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir,  }

  fs.writeFileSync(BASELINE_FILE, JSON.stringify(report, null, 2));
}

// Run the capture
console.log(`Capturing baseline metrics for 24 hours to Press Ctrl+C to exit`);
console.log(`Output: ${BASELINE_FILE}`);

console.log('Press Ctrl+C to stop capture early');
console.log('');
console.log('To capture baseline metrics for a longer period (e.g., 7-14 days), run:');
console.log('Current metrics will be written to ${reportPath}`);
console.log('Compare with targets after implementation:');
