export const BASE = import.meta.env.VITE_API_URL;

// ── Token & local storage ──────────────────────────────────────────────────────

export const getToken       = () => localStorage.getItem('gutiq_token');
export const setToken       = (t) => localStorage.setItem('gutiq_token', t);
export const clearToken     = () => localStorage.removeItem('gutiq_token');
export const isLoggedIn     = () => !!getToken();

export const storeUser = (email, userId = '', condition = '') => {
  localStorage.setItem('gutiq_email', email);
  if (userId)    localStorage.setItem('gutiq_user_id', userId);
  if (condition) localStorage.setItem('gutiq_condition', condition);
};

export const getStoredUser = () => {
  const email     = localStorage.getItem('gutiq_email') || '';
  const userId    = localStorage.getItem('gutiq_user_id') || '';
  const condition = localStorage.getItem('gutiq_condition') || 'GERD';
  const raw       = email.split('@')[0].replace(/[._-]/g, ' ');
  const name      = raw.replace(/\b\w/g, c => c.toUpperCase()) || 'User';
  const initials  = name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
  return { email, userId, condition, name, initials };
};

export const clearStoredUser = () => {
  ['gutiq_token', 'gutiq_email', 'gutiq_user_id', 'gutiq_condition'].forEach(k => localStorage.removeItem(k));
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
