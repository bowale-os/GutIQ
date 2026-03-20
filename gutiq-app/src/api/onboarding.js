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
export const complete = async (
  digestive_condition, goal,
  age_range = null, reminder_time = null, reminder_channel = null,
  preferred_name = null, medications = null, dietary_protocol = null,
) => {
  const res = await fetch(`${BASE}/onboarding/complete`, {
    method: 'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify(makeOnboardingCompleteRequest(
      digestive_condition, goal,
      age_range, reminder_time, reminder_channel,
      preferred_name, medications, dietary_protocol,
    )),
  });
  await throwIfNotOk(res);
  return parseOnboardingCompleteResponse(await res.json());
};
