import axios from 'axios';

function resolveDefaultBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const host = window.location.hostname;
    // In production (deployed on server IP or domain), use relative path so Nginx reverse-proxies /api
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return '';
    }
  }
  return 'http://localhost:8000';
}

export const DEFAULT_API_BASE_URL = resolveDefaultBaseUrl();

let activeBaseUrl = DEFAULT_API_BASE_URL;

export function getApiBaseUrl() {
  return activeBaseUrl;
}

export function setApiBaseUrl(url) {
  activeBaseUrl = url;
}

/**
 * Fallback-aware API caller that transparently switches between port 8001 and 8000
 * if a network error or 404 occurs due to port mismatch in local dev, or uses relative path in prod.
 */
export async function fetchWithFallback(urlPath, options = {}) {
  const cleanPath = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
  if (!activeBaseUrl) {
    return await axios({
      url: cleanPath,
      timeout: options.timeout || 7000,
      ...options
    });
  }
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
