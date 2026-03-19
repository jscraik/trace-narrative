/**
 * Unit tests for redact.ts
 *
 * Coverage targets:
 *  - Each pattern family redacts correctly
 *  - Multiple matches in one string each count
 *  - Input length cap (> 2 MB) returns unredacted + empty hits
 *  - Clean input returns unchanged string + empty hits
 *  - Replacement text shape: [REDACTED:<kind>]
 */

import { describe, expect, it, vi } from "vitest";
import { redactSecrets } from "../redact";

// ---------------------------------------------------------------------------
// Happy paths — each pattern family
// ---------------------------------------------------------------------------

describe("redactSecrets — pattern families", () => {
	it("redacts OpenAI API keys (sk-...)", () => {
		const input = "key=sk-abcdefghijklmnopqrst12345";
		const { redacted, hits } = redactSecrets(input);
		expect(redacted).not.toContain("sk-abcdefghijklmnopqrst12345");
		expect(redacted).toContain("[REDACTED:OPENAI_KEY]");
		expect(hits).toHaveLength(1);
		expect(hits[0].type).toBe("OPENAI_KEY");
		expect(hits[0].count).toBe(1);
	});

	it("redacts GitHub Personal Access Tokens (ghp_...)", () => {
		const input = "GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuv";
		const { redacted, hits } = redactSecrets(input);
		expect(redacted).toContain("[REDACTED:GITHUB_TOKEN]");
		expect(hits[0].type).toBe("GITHUB_TOKEN");
	});

	it("redacts AWS access keys (AKIA...)", () => {
		const input = "AWS_KEY=AKIAIOSFODNN7EXAMPLE";
		const { redacted, hits } = redactSecrets(input);
		expect(redacted).toContain("[REDACTED:AWS_ACCESS_KEY]");
		expect(hits[0].type).toBe("AWS_ACCESS_KEY");
	});

	it("redacts PEM private key blocks", () => {
		const input = [
			"-----BEGIN RSA PRIVATE KEY-----",
			"MIIEowIBAAKCAQEA0Z3VS5JJcds3xHn/ygWep4",
			"-----END RSA PRIVATE KEY-----",
		].join("\n");
		const { redacted, hits } = redactSecrets(input);
		expect(redacted).toContain("[REDACTED:PRIVATE_KEY_BLOCK]");
		expect(redacted).not.toContain("MIIEowIBAAKCAQEA");
		expect(hits[0].type).toBe("PRIVATE_KEY_BLOCK");
	});

	it("redacts Bearer tokens in Authorization headers", () => {
		const input = "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR";
		const { redacted, hits } = redactSecrets(input);
		expect(redacted).toContain("[REDACTED:BEARER_TOKEN]");
		expect(hits[0].type).toBe("BEARER_TOKEN");
	});

	it("redacts Stripe secret keys (sk_live_... and sk_test_...)", () => {
		// String split to prevent Github secret scanning from detecting it as a real leak
		const input = "STRIPE_KEY=sk_" + "test_000000000000000000000000";
		const { redacted, hits: _hits } = redactSecrets(input);
		expect(redacted).toContain("[REDACTED:STRIPE_KEY]");
	});

	it("redacts Slack tokens (xoxb-...)", () => {
		const input = "token=xoxb-1234567890-abcdefghij";
		const { redacted, hits: _hits } = redactSecrets(input);
		expect(redacted).toContain("[REDACTED:SLACK_TOKEN]");
	});

	it("redacts NPM tokens (npm_...)", () => {
		// Pattern: \bnpm_[A-Za-z0-9]{36}\b — must be exactly 36 alphanumeric chars after npm_
		const input = "NPM_TOKEN=npm_abcdefghijklmnopqrstuvwxyz1234567890";
		const { redacted, hits: _hits } = redactSecrets(input);
		expect(redacted).toContain("[REDACTED:NPM_TOKEN]");
	});

	it("redacts JWT tokens (eyJ... . eyJ... . sig)", () => {
		const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.abc123def456";
		const { redacted, hits: _hits } = redactSecrets(jwt);
		expect(redacted).toContain("[REDACTED:JWT_TOKEN]");
	});

	it("redacts database connection URLs", () => {
		const url = "postgres://user:password@db.example.com/mydb";
		const { redacted, hits: _hits } = redactSecrets(url);
		expect(redacted).toContain("[REDACTED:DATABASE_URL]");
	});

	it("redacts SendGrid API keys (SG. ...)", () => {
		const input =
			"SG.abcdefghijklmnopqrstuv.0123456789abcdefghijklmnopqrstuvwxyz01234567890a";
		const { redacted, hits: _hits } = redactSecrets(input);
		expect(redacted).toContain("[REDACTED:SENDGRID_KEY]");
	});

	it("redacts Twilio Account SIDs (AC...)", () => {
		const input = "ACCOUNT_SID=AC00000000000000000000000000000000";
		const { redacted, hits: _hits } = redactSecrets(input);
		expect(redacted).toContain("[REDACTED:TWILIO_SID]");
	});

	it("redacts Google API keys (AIza...)", () => {
		// Pattern: \bAIza[0-9A-Za-z_-]{35}\b — 35 chars, must end with alphanumeric for \b to match
		const input = "key=AIza1234567890abcdefghijklmnopqrstuvwxy";
		// Verify: AIza(4) + 1234567890abcdefghijklmnopqrstuvwxy(35) = ends with 'y' (alpha) -> \b ok
		const { redacted, hits: _hits } = redactSecrets(input);
		expect(redacted).toContain("[REDACTED:GOOGLE_API_KEY]");
	});

	it('redacts password assignments (key = "value")', () => {
		const input = 'password = "mysupersecretpassword123"';
		const { redacted, hits: _hits } = redactSecrets(input);
		expect(redacted).toContain("[REDACTED:PASSWORD_ASSIGNMENT]");
	});

	it("redacts api_key assignments with single quotes", () => {
		const input = "api_key: 'my-very-secret-api-key'";
		const { redacted, hits: _hits } = redactSecrets(input);
		expect(redacted).toContain("[REDACTED:PASSWORD_ASSIGNMENT]");
	});
});

// ---------------------------------------------------------------------------
// Multiple matches
// ---------------------------------------------------------------------------

describe("redactSecrets — multiple matches", () => {
	it("counts all occurrences of the same type in the same string", () => {
		const input = [
			"key1=sk-aaaabbbbccccddddeeeefffff00000",
			"key2=sk-gggghhhhiiiijjjjkkkkllll11111",
		].join("\n");
		const { hits } = redactSecrets(input);
		const openAiHit = hits.find((h) => h.type === "OPENAI_KEY");
		expect(openAiHit?.count).toBe(2);
	});

	it("accumulates hits from multiple pattern families", () => {
		const input = [
			"ghp_abcdefghijklmnopqrstuvwxy", // GitHub token
			"sk-abcdefghijklmnopqrstuvwxyz", // OpenAI
		].join(" ");
		const { hits } = redactSecrets(input);
		const types = hits.map((h) => h.type);
		expect(types).toContain("GITHUB_TOKEN");
		expect(types).toContain("OPENAI_KEY");
	});
});

// ---------------------------------------------------------------------------
// Clean input
// ---------------------------------------------------------------------------

describe("redactSecrets — clean input", () => {
	it("returns the input unchanged when no patterns match", () => {
		const clean = "Hello world. No secrets here.";
		const { redacted, hits } = redactSecrets(clean);
		expect(redacted).toBe(clean);
		expect(hits).toHaveLength(0);
	});

	it("handles empty string without throwing", () => {
		const { redacted, hits } = redactSecrets("");
		expect(redacted).toBe("");
		expect(hits).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Input length cap (ReDoS protection)
// ---------------------------------------------------------------------------

describe("redactSecrets — input length cap", () => {
	it("returns unredacted + empty hits when input exceeds 2 MB", () => {
		// Build a 3 MB string with a real secret inside it
		const secret = "sk-abcdefghijklmnopqrst12345";
		const padding = "a".repeat(3 * 1024 * 1024);
		const oversized = padding + secret;

		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
			/* suppress console output in test */
		});
		const { redacted, hits } = redactSecrets(oversized);
		warnSpy.mockRestore();

		// Secret must NOT be redacted (we skipped the scan)
		expect(redacted).toContain(secret);
		expect(hits).toHaveLength(0);
	});

	it("emits a console.warn when input is too large", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
			/* suppress console output in test */
		});
		redactSecrets("x".repeat(3 * 1024 * 1024));
		expect(warnSpy).toHaveBeenCalledOnce();
		expect(warnSpy.mock.calls[0][0]).toContain("[redact]");
		warnSpy.mockRestore();
	});

	it("processes input exactly at the 2 MB boundary without warning", () => {
		// Exactly 2 MB — should scan normally
		const atLimit = "a".repeat(2 * 1024 * 1024);
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
			/* suppress console output in test */
		});
		const { hits } = redactSecrets(atLimit);
		expect(warnSpy).not.toHaveBeenCalled();
		expect(hits).toHaveLength(0);
		warnSpy.mockRestore();
	});
});

// ---------------------------------------------------------------------------
// Replacement text shape
// ---------------------------------------------------------------------------

describe("redactSecrets — replacement shape", () => {
	it("uses [REDACTED:<KIND>] format exactly", () => {
		const input = "sk-abcdefghijklmnopqrst12345";
		const { redacted } = redactSecrets(input);
		// Must match [REDACTED:OPENAI_KEY] exactly — no extra whitespace or casing
		expect(redacted).toMatch(/\[REDACTED:OPENAI_KEY\]/);
	});

	it("does not leave the original secret in the string after redaction", () => {
		const secret = "sk-abcdefghijklmnopqrst12345";
		const { redacted } = redactSecrets(`prefix ${secret} suffix`);
		expect(redacted).not.toContain(secret);
		expect(redacted).not.toContain("sk-");
	});
});
