/**
 * Get the basename (final component) of a file path.
 * Handles both forward and backward slashes.
 */
export function basename(p: string): string {
	const parts = p.split(/[\\/]/).filter(Boolean);
	return parts[parts.length - 1] ?? p;
}
