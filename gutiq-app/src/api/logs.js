import { BASE, authHeaders, authJsonHeaders, isLoggedIn, clearStoredUser, throwIfNotOk } from './client';
import {
  makeLogCreateRequest,
  parseLogPreviewResponse,
  parseLogCreateResponse,
  parseLogListResponse,
} from './schemas';

// ── Shape transformer ──────────────────────────────────────────────────────────

export function apiLogToFrontend(log) {
  return {
    date: new Date(log.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    log_categories: [
      (log.parsed_foods?.length)    ? 'food'     : null,
      (log.parsed_symptoms?.length) ? 'symptom'  : null,
      log.parsed_stress             ? 'stress'   : null,
      log.parsed_sleep              ? 'sleep'    : null,
      log.parsed_exercise           ? 'exercise' : null,
    ].filter(Boolean),
    parsed_foods:    log.parsed_foods    || [],
    parsed_symptoms: log.parsed_symptoms || [],
    parsed_severity: log.parsed_severity ?? 5,
    parsed_stress:   log.parsed_stress   || null,
    parsed_sleep:    log.parsed_sleep    || null,
    parsed_exercise: log.parsed_exercise || null,
    natural_summary: log.raw_content     || '',
    confidence:      'high',
    _id:             log.id,
  };
}

// ── Route calls ────────────────────────────────────────────────────────────────

// POST /log/preview — multipart FormData
export const preview = async (rawContent) => {
  const fd = new FormData();
  fd.append('source', 'text');
  fd.append('raw_content', rawContent);
  const res = await fetch(`${BASE}/log/preview`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  await throwIfNotOk(res);
  return parseLogPreviewResponse(await res.json());
};

// POST /log/create-log
export const create = async (logData) => {
  const res = await fetch(`${BASE}/log/create-log`, {
    method: 'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify(makeLogCreateRequest(logData)),
  });
  await throwIfNotOk(res);
  return parseLogCreateResponse(await res.json());
};

// GET /log/list-logs
export const list = async () => {
  const res = await fetch(`${BASE}/log/list-logs`, { headers: authJsonHeaders() });
  await throwIfNotOk(res);
  const { logs, total } = parseLogListResponse(await res.json());
  return { logs: logs.map(apiLogToFrontend), total };
};

// ── Helpers ────────────────────────────────────────────────────────────────────

export async function fetchRealLogs() {
  if (!isLoggedIn()) return [];
  try {
    const { logs } = await list();
    return logs;
  } catch (err) {
    if (err.status === 401) {
      clearStoredUser();
    }
    return [];
  }
}
