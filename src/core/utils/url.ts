export function normalizeHttpUrl(url: string | undefined): string | undefined {
  if (!url?.trim()) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}
