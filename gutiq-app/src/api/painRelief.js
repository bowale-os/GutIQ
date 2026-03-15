import { BASE, authJsonHeaders, throwIfNotOk } from './client';

export async function submitPainSession({ body_clicks, description, intensity, pain_character }) {
  const res = await fetch(`${BASE}/pain-relief/session`, {
    method: 'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify({
      session_id: null,
      body_clicks,
      description,
      intensity,
      pain_character: pain_character || null,
    }),
  });
  await throwIfNotOk(res);
  return res.json();
}

export async function submitPainFeedback({ session_id, relief_rating, steps_completed }) {
  const params = new URLSearchParams({ session_id, relief_rating, steps_completed });
  const res = await fetch(`${BASE}/pain-relief/feedback?${params}`, {
    method: 'POST',
    headers: authJsonHeaders(),
  });
  if (res.status === 204) return;
  await throwIfNotOk(res);
}
