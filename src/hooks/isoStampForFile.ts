/**
 * Generate an ISO timestamp safe for filenames.
 * Format: 2026-01-27T13-29-25-123Z
 */
export function isoStampForFile(): string {
	return new Date().toISOString().replace(/[:.]/g, "-");
}
