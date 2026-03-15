import { BASE, authHeaders, authJsonHeaders, isLoggedIn, clearStoredUser, throwIfNotOk } from './client';
import {
  makeLogCreateRequest,
  parseLogPreviewResponse,
  parseLogCreateResponse,
  parseLogListResponse,
} from './schemas';

// ── Shape transformer ──────────────────────────────────────────────────────────

export function apiLogToFrontend(log) {
  const symptoms = log.parsed_symptoms || [];
  const severities = symptoms.map(s => s.severity).filter(s => s != null);
  const maxSeverity = severities.length > 0 ? severities.reduce((m, s) => s > m ? s : m) : null;

  return {
    date: new Date(log.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    log_categories: [
      log.parsed_foods?.length  ? 'food'     : null,
      symptoms.length           ? 'symptom'  : null,
      log.parsed_stress         ? 'stress'   : null,
      log.parsed_sleep != null  ? 'sleep'    : null,
      log.parsed_exercise && log.parsed_exercise !== 'none' ? 'exercise' : null,
    ].filter(Boolean),
    parsed_foods:    log.parsed_foods  || [],
    parsed_symptoms: symptoms,            // [{name, severity}]
    parsed_severity: maxSeverity,        // derived max — used by Dashboard sparkline
    parsed_stress:   log.parsed_stress  || null,
    parsed_sleep:    log.parsed_sleep   ?? null,
    parsed_exercise: log.parsed_exercise || null,
    natural_summary: log.natural_summary || log.raw_content || '',
    confidence:      log.confidence     || 'high',
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
