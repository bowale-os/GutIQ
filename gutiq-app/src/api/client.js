export const BASE = import.meta.env.VITE_API_URL;

// ── Token & local storage ──────────────────────────────────────────────────────

export const getToken       = () => localStorage.getItem('gutiq_token');
export const setToken       = (t) => localStorage.setItem('gutiq_token', t);
export const clearToken     = () => localStorage.removeItem('gutiq_token');
export const isLoggedIn     = () => !!getToken();

export const storeUser = (username, userId = '', name = '', condition = '', email = '') => {
  localStorage.setItem('gutiq_username', username);
  if (userId)    localStorage.setItem('gutiq_user_id', userId);
  if (name)      localStorage.setItem('gutiq_name', name);
  if (condition) localStorage.setItem('gutiq_condition', condition);
  if (email)     localStorage.setItem('gutiq_email', email);
};

export const getStoredUser = () => {
  const username  = localStorage.getItem('gutiq_username') || '';
  const userId    = localStorage.getItem('gutiq_user_id') || '';
  const condition = localStorage.getItem('gutiq_condition') || 'GERD';
  const stored    = localStorage.getItem('gutiq_name') || '';
  const name      = stored || username || 'User';
  const email     = localStorage.getItem('gutiq_email') || '';
  return { username, userId, condition, name, email };
};

export const clearStoredUser = () => {
  ['gutiq_token', 'gutiq_username', 'gutiq_user_id', 'gutiq_name', 'gutiq_condition', 'gutiq_email'].forEach(k => localStorage.removeItem(k));
};

// ── Shared headers ─────────────────────────────────────────────────────────────

export const authJsonHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

export const authHeaders = () => ({
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

// ── Error handling ─────────────────────────────────────────────────────────────

export async function throwIfNotOk(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.detail;
    const message = Array.isArray(detail)
      ? detail.map(e => e.msg).join(', ')
      : typeof detail === 'string' ? detail : `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res;
}
