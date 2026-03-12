import { BASE, throwIfNotOk } from './client';
import { makeUserCreateRequest, makeLogInRequest, parseTokenResponse } from './schemas';

// POST /auth/signup
export const signup = async (email, password, name) => {
  const res = await fetch(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(makeUserCreateRequest(name, email, password)),
  });
  await throwIfNotOk(res);
  return parseTokenResponse(await res.json());
};

// POST /auth/login
export const login = async (email, password) => {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(makeLogInRequest(email, password)),
  });
  await throwIfNotOk(res);
  return parseTokenResponse(await res.json());
};
