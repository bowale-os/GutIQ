import { BASE, getToken, throwIfNotOk } from './client';
import { makeUserUpdateRequest, parseUserUpdateResponse } from './schemas';


// GET /users/me
export const getUserData = async () => {
  const token = getToken();
  const res = await fetch(`${BASE}/users/me`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  });
  await throwIfNotOk(res);
  return parseUserUpdateResponse(await res.json());
};


// PATCH /users/me
export const update = async ({ email, digestive_condition, goal, age_range }) => {
  const token = getToken();
  const res = await fetch(`${BASE}/users/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(makeUserUpdateRequest({ email, digestive_condition, goal, age_range })),
  });
  await throwIfNotOk(res);
  return parseUserUpdateResponse(await res.json());
};
