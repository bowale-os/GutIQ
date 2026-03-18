import { BASE, throwIfNotOk } from './client';
import { makeUserCreateRequest, makeLogInRequest, parseTokenResponse } from './schemas';

// GET /auth/check-username?username=xxx → { available: bool }
export const checkUsername = async (username) => {
  const res = await fetch(`${BASE}/auth/check-username?username=${encodeURIComponent(username)}`);
  if (!res.ok) return { available: false };
  return res.json();
};

// POST /auth/signup  (email optional)
export const signup = async (username, password, email = null) => {
  const res = await fetch(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(makeUserCreateRequest(username, password, email)),
  });
  await throwIfNotOk(res);
  return parseTokenResponse(await res.json());
};

// POST /auth/login  (identifier = username or email)
export const login = async (identifier, password) => {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(makeLogInRequest(identifier, password)),
  });
  await throwIfNotOk(res);
  return parseTokenResponse(await res.json());
};
