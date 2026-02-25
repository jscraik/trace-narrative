---
date: 2026-02-25
topic: codex-app-server-production-remediation
---

# Codex App Server Production Remediation Brainstorm

## Table of Contents
- [What We’re Building](#what-were-building)
- [Why This Approach](#why-this-approach)
- [Approaches Considered](#approaches-considered)
- [Key Decisions](#key-decisions)
- [Resolved Questions](#resolved-questions)
- [Open Questions](#open-questions)
- [Next Steps](#next-steps)

## What We’re Building
Firefly Narrative should treat Codex app-server as a production protocol runtime, not a status shim. The goal is to make sidecar communication, lifecycle state, and event ingestion authoritative from the backend/runtime boundary so the UI only observes and requests safe operations. This improves reliability, trust boundaries, and operational predictability for capture mode transitions and session data integrity.

## Why This Approach
We selected a protocol-native runtime because the current implementation exposes major production gaps (optimistic handshake, stub thread snapshot, renderer-callable ingest bridge, and host-PATH sidecar dependency). The chosen direction prioritizes correctness and long-term maintainability over short-term minimal change. It also reduces hidden coupling between frontend state and runtime truth, which is essential for auditable and deterministic behavior.

## Approaches Considered
### A) Protocol-Native Runtime (Chosen)
Make backend protocol handling authoritative, remove UI-mutable bridge paths, and align runtime behavior with documented app-server semantics.

### B) Strangler Migration
Run legacy and protocol-native paths in parallel behind a progressive cutover.

### C) Stabilize-Then-Rebuild
Apply short-term guardrails now, defer full parity to a later phase.

## Key Decisions
- Choose **Approach A: Protocol-Native Runtime**.
- Set release posture to **direct default-on rollout**.
- Keep focus on **production-standard app-server parity**, not broader platform refactors.
- Preserve a strict boundary: backend owns protocol truth; frontend consumes status/events.

## Resolved Questions
- **Primary direction:** Approach A selected.
- **Rollout posture:** default-on (no staged feature-flag rollout as primary path).

## Open Questions
None currently.

## Next Steps
Move to planning to define implementation sequencing, command/API surface updates, validation strategy, and rollout safeguards for this chosen direction.
