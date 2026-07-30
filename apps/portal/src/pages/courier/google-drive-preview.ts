/**
 * Zero Local Storage: turns a Google Drive share/view link into Drive's own
 * embeddable /preview link. RASSCO never downloads, proxies, or stores the
 * underlying file — the browser loads it directly from drive.google.com.
 *
 * A Drive "/view" link cannot be embedded (Google sets X-Frame-Options:
 * SAMEORIGIN on it); only the "/preview" variant is designed for iframes.
 * Returns null — never the original URL — when a safe /preview link can't be
 * built, so callers never fall back to embedding an unsafe or unrecognized URL.
 *
 * Kept in its own dependency-free module (no React) so it can be unit tested
 * directly instead of importing the whole review page.
 */
export function buildGoogleDrivePreviewUrl(driveUrl: string | null | undefined): string | null {
  if (!driveUrl || typeof driveUrl !== "string") return null;
  const trimmed = driveUrl.trim();

  // Security guard: Reject javascript:, blob:, file://, or non-http(s)
  if (/^(javascript|blob|file):/i.test(trimmed)) return null;
  if (!/^https?:\/\/(drive|docs)\.google\.com\//i.test(trimmed)) return null;

  // Pattern 1: /file/d/FILE_ID/
  const matchFileD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFileD && matchFileD[1]) {
    return `https://drive.google.com/file/d/${matchFileD[1]}/preview`;
  }

  // Pattern 2: ?id=FILE_ID or &id=FILE_ID
  const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchIdParam && matchIdParam[1]) {
    return `https://drive.google.com/file/d/${matchIdParam[1]}/preview`;
  }

  return null;
}
