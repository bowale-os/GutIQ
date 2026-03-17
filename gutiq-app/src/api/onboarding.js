import { BASE, authJsonHeaders, throwIfNotOk } from './client';
import {
  makeOnboardingCompleteRequest,
  parseOnboardingStatusResponse,
  parseOnboardingCompleteResponse,
} from './schemas';

// GET /onboarding/status
export const getStatus = async () => {
  const res = await fetch(`${BASE}/onboarding/status`, { headers: authJsonHeaders() });
  await throwIfNotOk(res);
  return parseOnboardingStatusResponse(await res.json());
};

// POST /onboarding/complete
export const complete = async (name, digestive_condition, goal, age_range) => {
  const res = await fetch(`${BASE}/onboarding/complete`, {
    method: 'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify(makeOnboardingCompleteRequest(name, digestive_condition, goal, age_range)),
  });
  await throwIfNotOk(res);
  return parseOnboardingCompleteResponse(await res.json());
};
