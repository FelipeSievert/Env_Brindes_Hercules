// Keep origins explicit: Preview URLs must be listed in ALLOWED_ORIGINS.
// APP_URL is trusted too, so invitation redirects and CORS cannot disagree.
export function normalizeOrigin(value: string): string {
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) return '';
    return url.origin;
  } catch {
    return '';
  }
}

export function createCorsPolicy(allowedOrigins: string, appUrl: string, sdkHeaders: Record<string, string>) {
  const origins = new Set([appUrl, ...allowedOrigins.split(/[,\s]+/)]
    .map(normalizeOrigin).filter(Boolean));

  function isAllowed(origin: string): boolean {
    return !origin || origins.has(normalizeOrigin(origin));
  }

  function headers(origin: string): Headers {
    const result = new Headers(sdkHeaders);
    // Never inherit the SDK's wildcard for this administrative endpoint.
    result.delete('Access-Control-Allow-Origin');
    result.set('Vary', 'Origin');
    result.set('Cache-Control', 'no-store');
    result.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (origin && isAllowed(origin)) result.set('Access-Control-Allow-Origin', origin);
    return result;
  }

  return { isAllowed, headers };
}
