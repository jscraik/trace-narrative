import redactionPatterns from '../../shared/redaction-patterns.json';

export type RedactionHit = { type: string; count: number };

export type RedactionResult = {
  redacted: string;
  hits: RedactionHit[];
};

/**
 * Very small, heuristic scrubbing.
 * Goal: prevent accidentally committing secrets into `.narrative/`.
 *
 * Expand as needed.
 */
type RedactionPatternConfig = {
  kind: string;
  pattern: string;
  flags?: string;
};

const compiledPatterns: Array<{ type: string; re: RegExp }> = (
  redactionPatterns as RedactionPatternConfig[]
).map((pattern) => {
  const baseFlags = pattern.flags ?? '';
  const flags = baseFlags.includes('g') ? baseFlags : `${baseFlags}g`;
  return {
    type: pattern.kind,
    re: new RegExp(pattern.pattern, flags)
  };
});

/** Maximum input size (bytes) we'll redact in one call. Larger inputs are returned unredacted. */
const MAX_REDACT_INPUT_BYTES = 2 * 1024 * 1024; // 2 MB

export function redactSecrets(input: string): RedactionResult {
  if (input.length > MAX_REDACT_INPUT_BYTES) {
    // Input is too large to scan safely — log a warning and skip.
    // This prevents ReDoS on the PRIVATE_KEY_BLOCK [\s\S]*? pattern.
    console.warn(
      `[redact] Input too large to redact (${input.length} chars > ${MAX_REDACT_INPUT_BYTES}). Returning as-is.`
    );
    return { redacted: input, hits: [] };
  }

  let redacted = input;
  const hits: RedactionHit[] = [];

  for (const p of compiledPatterns) {
    const matches = redacted.match(p.re);
    if (!matches || matches.length === 0) continue;
    hits.push({ type: p.type, count: matches.length });
    redacted = redacted.replace(p.re, `[REDACTED:${p.type}]`);
  }

  return { redacted, hits };
}
