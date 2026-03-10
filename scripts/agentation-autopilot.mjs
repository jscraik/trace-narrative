#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import http from 'node:http';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT ?? 8787);
const MODE = (process.env.AGENTATION_MODE ?? 'autopilot').trim().toLowerCase();
const TRIGGER_EVENTS = new Set(
  (process.env.TRIGGER_EVENTS ?? 'submit')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
);

const RUNS_DIR = path.resolve(ROOT, process.env.AGENTATION_RUNS_DIR ?? '.narrative/agentation/runs');
const STATUS_FILE = path.resolve(
  ROOT,
  process.env.AGENTATION_STATUS_FILE ?? '.narrative/agentation/latest-status.json'
);
const IMPLEMENT_COMMAND = (process.env.AGENTATION_IMPLEMENT_COMMAND ?? '').trim();
const REVIEW_COMMAND = (process.env.AGENTATION_REVIEW_COMMAND ?? '').trim();
const CRITIQUE_COMMAND = (process.env.AGENTATION_CRITIQUE_COMMAND ?? '').trim();
const IMPLEMENT_TIMEOUT_MS = Number(process.env.CODEX_IMPLEMENTATION_TIMEOUT_MS ?? 300000);
const REVIEW_TIMEOUT_MS = Number(process.env.CODEX_REVIEW_TIMEOUT_MS ?? 180000);

let queue = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error };
  }
}

function eventName(body) {
  if (!body || typeof body !== 'object') return 'unknown';
  if (typeof body.event === 'string') return body.event;
  if (typeof body.type === 'string') return body.type;
  return 'unknown';
}

async function readStatus() {
  try {
    const raw = await readFile(STATUS_FILE, 'utf8');
    const parsed = safeJsonParse(raw);
    return parsed.ok && parsed.value && typeof parsed.value === 'object' ? parsed.value : {};
  } catch {
    return {};
  }
}

async function writeStatus(patch) {
  await mkdir(path.dirname(STATUS_FILE), { recursive: true });
  const current = await readStatus();
  const next = {
    schema_version: '1.0',
    ...current,
    ...patch,
    updated_at: nowIso()
  };
  await writeFile(STATUS_FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

function stepSummary(step, result) {
  return {
    step,
    success: result.success,
    timedOut: result.timedOut,
    exitCode: result.exitCode,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    durationMs: result.durationMs,
    command: result.command
  };
}

function skippedStep(step, command, reason) {
  return {
    step,
    command,
    success: false,
    skipped: true,
    timedOut: false,
    exitCode: null,
    startedAt: nowIso(),
    finishedAt: nowIso(),
    durationMs: 0,
    output: `${step} skipped: ${reason}\n`
  };
}

async function runStep({ step, command, timeoutMs, outputFile }) {
  if (!command) {
    const skipped = {
      step,
      command,
      success: false,
      skipped: true,
      timedOut: false,
      exitCode: null,
      startedAt: nowIso(),
      finishedAt: nowIso(),
      durationMs: 0,
      output: `${step} skipped: command not configured\n`
    };
    await writeFile(outputFile, skipped.output, 'utf8');
    return skipped;
  }

  const started = Date.now();
  const startedAt = nowIso();

  return await new Promise((resolve) => {
    const child = spawn(process.env.SHELL || '/bin/zsh', ['-lc', command], {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2000).unref();
    }, timeoutMs);

    child.on('close', async (code) => {
      clearTimeout(timer);
      const finishedAt = nowIso();
      const durationMs = Date.now() - started;
      const output = [`# ${step}`, '', `## stdout`, stdout.trimEnd(), '', `## stderr`, stderr.trimEnd(), '']
        .join('\n')
        .trimStart();
      await writeFile(outputFile, `${output}\n`, 'utf8');

      resolve({
        step,
        command,
        success: !timedOut && code === 0,
        skipped: false,
        timedOut,
        exitCode: code,
        startedAt,
        finishedAt,
        durationMs,
        output
      });
    });

    child.on('error', async (error) => {
      clearTimeout(timer);
      const finishedAt = nowIso();
      const durationMs = Date.now() - started;
      const output = `Failed to start step ${step}: ${error.message}\n`;
      await writeFile(outputFile, output, 'utf8');
      resolve({
        step,
        command,
        success: false,
        skipped: false,
        timedOut: false,
        exitCode: null,
        startedAt,
        finishedAt,
        durationMs,
        output
      });
    });
  });
}

async function processJob(body) {
  const event = eventName(body);
  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const jobDir = path.join(RUNS_DIR, jobId);
  await mkdir(jobDir, { recursive: true });

  await writeFile(path.join(jobDir, 'payload.json'), `${JSON.stringify(body, null, 2)}\n`, 'utf8');

  await writeStatus({
    state: 'webhook_received',
    mode: MODE,
    event,
    job_id: jobId,
    job_dir: jobDir,
    trigger_events: [...TRIGGER_EVENTS]
  });

  const implementationFile = path.join(jobDir, 'implementation.txt');
  const reviewFile = path.join(jobDir, 'review.txt');
  const critiqueFile = path.join(jobDir, 'critique.txt');

  let implementation = skippedStep('implementation', IMPLEMENT_COMMAND, 'not run');
  let review = skippedStep('review', REVIEW_COMMAND, 'not run');
  let critique = skippedStep('critique', CRITIQUE_COMMAND, 'not run');

  if (MODE === 'critique') {
    const critiqueCommand = CRITIQUE_COMMAND || REVIEW_COMMAND;
    await writeStatus({ state: 'running_critique', mode: MODE, job_id: jobId });
    critique = await runStep({
      step: 'critique',
      command: critiqueCommand,
      timeoutMs: REVIEW_TIMEOUT_MS,
      outputFile: critiqueFile
    });
    await writeFile(implementationFile, implementation.output, 'utf8');
    await writeFile(reviewFile, review.output, 'utf8');
  } else {
    await writeStatus({ state: 'running_implementation', mode: MODE, job_id: jobId });
    implementation = await runStep({
      step: 'implementation',
      command: IMPLEMENT_COMMAND,
      timeoutMs: IMPLEMENT_TIMEOUT_MS,
      outputFile: implementationFile
    });

    if (implementation.success && REVIEW_COMMAND) {
      await writeStatus({ state: 'running_review', mode: MODE, job_id: jobId });
      review = await runStep({
        step: 'review',
        command: REVIEW_COMMAND,
        timeoutMs: REVIEW_TIMEOUT_MS,
        outputFile: reviewFile
      });
    } else {
      review = skippedStep(
        'review',
        REVIEW_COMMAND,
        implementation.success ? 'command not configured' : 'implementation did not succeed'
      );
      await writeFile(reviewFile, review.output, 'utf8');
    }
    await writeFile(critiqueFile, critique.output, 'utf8');
  }

  const issues = [];
  if (MODE === 'critique') {
    const critiqueCommand = CRITIQUE_COMMAND || REVIEW_COMMAND;
    if (!critiqueCommand) issues.push('critique command not configured');
    if (critique.timedOut) issues.push('critique timed out');
    if (critiqueCommand && !critique.success) issues.push('critique failed');
  } else {
    if (!IMPLEMENT_COMMAND) issues.push('implementation command not configured');
    if (!REVIEW_COMMAND) issues.push('review command not configured');
    if (implementation.timedOut) issues.push('implementation timed out');
    if (review.timedOut) issues.push('review timed out');
    if (IMPLEMENT_COMMAND && !implementation.success) issues.push('implementation failed');
    if (REVIEW_COMMAND && implementation.success && !review.success) issues.push('review failed');
  }

  const hardFailure = MODE === 'critique'
    ? Boolean(CRITIQUE_COMMAND || REVIEW_COMMAND) && !critique.success
    : Boolean(IMPLEMENT_COMMAND) && !implementation.success;
  const finalState = hardFailure
    ? 'failed'
    : issues.length === 0
      ? 'completed'
      : 'completed_with_issues';

  const result = {
    schema_version: '1.0',
    job_id: jobId,
    event,
    mode: MODE,
    created_at: nowIso(),
    state: finalState,
    issues,
    critique: stepSummary('critique', critique),
    implementation: stepSummary('implementation', implementation),
    review: stepSummary('review', review)
  };

  await writeFile(path.join(jobDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  await writeStatus({
    state: finalState,
    mode: MODE,
    job_id: jobId,
    last_result_file: path.join(jobDir, 'result.json'),
    issues,
    critique: stepSummary('critique', critique),
    implementation: stepSummary('implementation', implementation),
    review: stepSummary('review', review)
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'agentation-autopilot', method: req.method }));
    return;
  }

  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk.toString();
  });

  req.on('end', async () => {
    const parsed = safeJsonParse(raw || '{}');
    if (!parsed.ok) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
      return;
    }

    const payload = parsed.value;
    const event = eventName(payload);

    if (!TRIGGER_EVENTS.has(event)) {
      res.writeHead(202, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true, ignored: true, event, trigger_events: [...TRIGGER_EVENTS] }));
      return;
    }

    queue = queue.then(() => processJob(payload)).catch(async (error) => {
      await writeStatus({
        state: 'failed',
        mode: MODE,
        error: `job_error:${error instanceof Error ? error.message : String(error)}`
      });
    });

    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: true, accepted: true, event, mode: MODE }));
  });
});

server.listen(PORT, async () => {
  await writeStatus({
    state: 'ready',
    mode: MODE,
    listening: `http://localhost:${PORT}`,
    trigger_events: [...TRIGGER_EVENTS]
  });
  console.log(`[agentation-autopilot] listening on http://localhost:${PORT}`);
  console.log(`[agentation-autopilot] mode: ${MODE}`);
  console.log(`[agentation-autopilot] trigger events: ${[...TRIGGER_EVENTS].join(', ')}`);
});
