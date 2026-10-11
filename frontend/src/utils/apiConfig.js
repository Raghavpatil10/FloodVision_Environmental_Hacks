import axios from 'axios';

// Detect or fallback base URL (support both 8001 and 8000 seamlessly)
export const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

let activeBaseUrl = DEFAULT_API_BASE_URL;

export function getApiBaseUrl() {
  return activeBaseUrl;
}

export function setApiBaseUrl(url) {
  activeBaseUrl = url;
}

/**
 * Fallback-aware API caller that transparently switches between port 8001 and 8000
 * if a network error or 404 occurs due to port mismatch.
 */
export async function fetchWithFallback(urlPath, options = {}) {
  const cleanPath = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
  const ports = activeBaseUrl.includes(':8001')
    ? [activeBaseUrl, activeBaseUrl.replace(':8001', ':8000')]
    : [activeBaseUrl, activeBaseUrl.replace(':8000', ':8001')];

  let lastErr = null;
  for (const base of ports) {
    try {
      const response = await axios({
        url: `${base}${cleanPath}`,
        timeout: options.timeout || 7000,
        ...options
      });
      activeBaseUrl = base;
      return response;
    } catch (err) {
      lastErr = err;
      // If error is a legitimate HTTP business response (not port mismatch or missing route), don't retry
      if (err.response && ![404, 502, 503].includes(err.response.status)) {
        throw err;
      }
    }
  }
  throw lastErr;
}

export default {
  getApiBaseUrl,
  setApiBaseUrl,
  fetchWithFallback,
  DEFAULT_API_BASE_URL
};
