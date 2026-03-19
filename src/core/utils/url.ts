export function normalizeHttpUrl(url: string | undefined): string | undefined {
	if (!url?.trim()) {
		return undefined;
	}

	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return undefined;
		}
		// Strip trailing slash to avoid double-slash when paths are appended
		const normalized = parsed.toString();
		return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
	} catch {
		return undefined;
	}
}
