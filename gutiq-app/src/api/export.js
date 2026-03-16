// src/api/export.js
import { BASE, authJsonHeaders } from './client';

/**
 * createShareLink — sends the report snapshot to the backend, gets back
 * a short-lived share URL and token.
 *
 * @param {object} report  The full report payload (stats, logs, patterns, summary)
 * @returns {Promise<{ token: string, url: string }>}
 */
export async function createShareLink(report) {
  const res = await fetch(`${BASE}/export/share`, {
    method:  'POST',
    headers: authJsonHeaders(),
    body:    JSON.stringify({ report }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Server error ${res.status}`);
  }

  return res.json(); // { token, url, expires_in_days }
}
