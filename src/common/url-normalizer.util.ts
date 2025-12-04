export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Remove fragment
    urlObj.hash = '';

    // Sort query params for consistent comparison
    const params = Array.from(urlObj.searchParams.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
    urlObj.search = new URLSearchParams(params).toString();

    // Remove trailing slash (except for root path)
    if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }

    // Convert to lowercase for case-insensitive comparison
    return urlObj.toString().toLowerCase();
  } catch (error) {
    // If URL is invalid, return as-is
    return url.toLowerCase();
  }
}
