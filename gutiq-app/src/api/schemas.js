// ── Frontend schemas mirroring backend Pydantic models ─────────────────────────
// Each section corresponds to a backend schema file in app/schemas/
//
// Convention:
//   make*(fields)  → build a correctly-shaped outbound REQUEST object
//   parse*(raw)    → whitelist + default an inbound RESPONSE object

// ══════════════════════════════════════════════════════════════════════════════
// AUTH  (backend: schemas/user.py)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} UserCreateRequest
 * @property {string} name        - 2–50 chars
 * @property {string} email
 * @property {string} password    - min 8 chars
 */
export const makeUserCreateRequest = (name = '', email = '', password = '') =>
  ({ name, email, password });

/**
 * @typedef {Object} LogInRequest
 * @property {string} email
 * @property {string} password
 */
export const makeLogInRequest = (email = '', password = '') =>
  ({ email, password });

/**
 * @typedef {Object} TokenResponse
 * @property {string} access_token
 * @property {string} token_type   - always "bearer"
 * @property {string} user_id
 */
export const parseTokenResponse = (raw = {}) => ({
  access_token: raw.access_token ?? '',
  token_type:   raw.token_type   ?? 'bearer',
  user_id:      raw.user_id      ?? '',
});

// ══════════════════════════════════════════════════════════════════════════════
// ONBOARDING  (backend: schemas/onboarding.py)
// ══════════════════════════════════════════════════════════════════════════════

/** @type {readonly string[]} */
export const DIGESTIVE_CONDITIONS = /** @type {const} */ (['GERD', 'IBS', "Crohn's Disease", 'Ulcerative Colitis', 'Celiac Disease', 'Other']);

/** @type {readonly string[]} */
export const AGE_RANGES = /** @type {const} */ (['Under 25', '25–40', '41–60', '60+']);

/**
 * @typedef {Object} OnboardingCompleteRequest
 * @property {string} name
 * @property {string} digestive_condition  - free text, max 100 chars
 * @property {string} goal                 - max 150 chars
 * @property {string} age_range
 */
export const makeOnboardingCompleteRequest = (
  digestive_condition = '',
  goal = '',
  age_range = '',
) => ({ digestive_condition, goal, age_range });

/**
 * @typedef {Object} OnboardingStatusResponse
 * @property {boolean} is_complete
 * @property {Object.<string, boolean>} missing
 */
export const parseOnboardingStatusResponse = (raw = {}) => ({
  is_complete: raw.is_complete ?? false,
  missing:     raw.missing     ?? {},
});

/**
 * @typedef {Object} OnboardingCompleteResponse
 * @property {string} message
 * @property {string} user_id
 */
export const parseOnboardingCompleteResponse = (raw = {}) => ({
  message: raw.message ?? '',
  user_id: raw.user_id ?? '',
});

// ══════════════════════════════════════════════════════════════════════════════
// LOGS  (backend: schemas/log.py)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} SymptomItem
 * @property {string}      name
 * @property {number|null} severity   - 1–10 per symptom, or null
 */
const parseSymptomItem = (raw = {}) => ({
  name:     raw.name     ?? '',
  severity: raw.severity ?? null,
});

/**
 * @typedef {Object} LogPreviewResponse
 * @property {string|null}    transcript
 * @property {string[]}       log_categories
 * @property {string[]}       parsed_foods
 * @property {SymptomItem[]}  parsed_symptoms      - one object per symptom
 * @property {number|null}    overall_severity     - fallback when no per-symptom scores
 * @property {string|null}    parsed_stress        - "low"|"medium"|"high"
 * @property {number|null}    parsed_sleep         - hours
 * @property {string|null}    parsed_exercise      - "none"|"light"|"moderate"|"intense"
 * @property {string}         confidence           - "high"|"medium"|"low"
 * @property {string}         natural_summary
 * @property {string|null}    missing_critical_field
 */
export const parseLogPreviewResponse = (raw = {}) => ({
  transcript:             raw.transcript                                    ?? null,
  log_categories:         raw.log_categories                               ?? [],
  parsed_foods:           raw.parsed_foods                                 ?? [],
  parsed_symptoms:        (raw.parsed_symptoms ?? []).map(parseSymptomItem),
  overall_severity:       raw.overall_severity                             ?? null,
  parsed_stress:          raw.parsed_stress                                ?? null,
  parsed_sleep:           raw.parsed_sleep                                 ?? null,
  parsed_exercise:        raw.parsed_exercise                              ?? null,
  confidence:             raw.confidence                                   ?? 'high',
  natural_summary:        raw.natural_summary                              ?? '',
  missing_critical_field: raw.missing_critical_field                       ?? null,
});

/**
 * @typedef {Object} LogCreateRequest
 * @property {'text'|'voice'}  source
 * @property {string|null}     raw_content
 * @property {string|null}     transcript
 * @property {string|null}     natural_summary
 * @property {string|null}     confidence
 * @property {string[]|null}   parsed_foods
 * @property {SymptomItem[]|null} parsed_symptoms
 * @property {number|null}     overall_severity   - fallback severity applied to symptoms with null severity
 * @property {string|null}     parsed_stress
 * @property {number|null}     parsed_sleep
 * @property {string|null}     parsed_exercise
 */
export const makeLogCreateRequest = ({
  source           = 'text',
  raw_content      = null,
  transcript       = null,
  natural_summary  = null,
  confidence       = null,
  parsed_foods     = null,
  parsed_symptoms  = null,
  overall_severity = null,
  parsed_stress    = null,
  parsed_sleep     = null,
  parsed_exercise  = null,
} = {}) => ({
  source, raw_content, transcript, natural_summary, confidence,
  parsed_foods, parsed_symptoms, overall_severity,
  parsed_stress, parsed_sleep, parsed_exercise,
});

/**
 * @typedef {Object} LogResponse
 * @property {string}         id
 * @property {string}         user_id
 * @property {string|null}    raw_content
 * @property {string}         logged_at        - ISO datetime
 * @property {string|null}    natural_summary
 * @property {string|null}    confidence
 * @property {string[]}       parsed_foods
 * @property {SymptomItem[]}  parsed_symptoms
 * @property {string|null}    parsed_stress
 * @property {number|null}    parsed_sleep
 * @property {string|null}    parsed_exercise
 */
export const parseLogResponse = (raw = {}) => ({
  id:              raw.id                                      ?? '',
  user_id:         raw.user_id                                 ?? '',
  raw_content:     raw.raw_content                             ?? null,
  logged_at:       raw.logged_at                               ?? '',
  natural_summary: raw.natural_summary                         ?? null,
  confidence:      raw.confidence                              ?? null,
  parsed_foods:    raw.parsed_foods                            ?? [],
  parsed_symptoms: (raw.parsed_symptoms ?? []).map(parseSymptomItem),
  parsed_stress:   raw.parsed_stress                           ?? null,
  parsed_sleep:    raw.parsed_sleep                            ?? null,
  parsed_exercise: raw.parsed_exercise                         ?? null,
});

/**
 * @typedef {Object} LogListResponse
 * @property {LogResponse[]} logs
 * @property {number}        total
 */
export const parseLogListResponse = (raw = {}) => ({
  logs:  (raw.logs ?? []).map(parseLogResponse),
  total: raw.total ?? 0,
});

/**
 * @typedef {Object} LogCreateResponse
 * @property {boolean}     success
 * @property {string}      message
 * @property {LogResponse} log
 */
export const parseLogCreateResponse = (raw = {}) => ({
  success: raw.success ?? false,
  message: raw.message ?? '',
  log:     parseLogResponse(raw.log ?? {}),
});

// ══════════════════════════════════════════════════════════════════════════════
// USER  (backend: schemas/user.py — update endpoints)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} UserUpdateRequest
 * @property {string|undefined} email
 * @property {string|undefined} digestive_condition
 * @property {string|undefined} goal
 * @property {string|undefined} age_range
 */
export const makeUserUpdateRequest = ({
  email               = undefined,
  digestive_condition = undefined,
  goal                = undefined,
  age_range           = undefined,
} = {}) => ({
  ...(email               !== undefined && { email }),
  ...(digestive_condition !== undefined && { digestive_condition }),
  ...(goal                !== undefined && { goal }),
  ...(age_range           !== undefined && { age_range }),
});

/**
 * @typedef {Object} UserUpdateResponse
 * @property {string}      email
 * @property {string|null} digestive_condition
 * @property {string|null} goal
 * @property {string|null} age_range
 * @property {string}      updated_at   - ISO datetime
 */
export const parseUserUpdateResponse = (raw = {}) => ({
  name:                raw.name                ?? '',
  email:               raw.email               ?? '',
  digestive_condition: raw.digestive_condition  ?? null,
  goal:                raw.goal                ?? null,
  age_range:           raw.age_range           ?? null,
  updated_at:          raw.updated_at          ?? '',
});
