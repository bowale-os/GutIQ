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
export const DIGESTIVE_CONDITIONS = /** @type {const} */ (['GERD', 'IBS', 'Ulcer', 'Other']);

/** @type {readonly string[]} */
export const AGE_RANGES = /** @type {const} */ (['Under 20', '20-30', '30-40', '40-50', '50+']);

/**
 * @typedef {Object} OnboardingCompleteRequest
 * @property {'GERD'|'IBS'|'Ulcer'|'Other'} digestive_condition
 * @property {string} goal        - max 150 chars
 * @property {'Under 20'|'20-30'|'30-40'|'40-50'|'50+'} age_range
 */
export const makeOnboardingCompleteRequest = (
  digestive_condition = 'GERD',
  goal = '',
  age_range = '20-30',
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
 * @typedef {Object} LogPreviewResponse
 * @property {string|null}   transcript
 * @property {string[]}      log_categories
 * @property {string[]|null} parsed_foods
 * @property {string[]|null} parsed_symptoms
 * @property {number|null}   parsed_severity   - 1–10
 * @property {string|null}   parsed_stress
 * @property {number|null}   parsed_sleep      - hours
 * @property {string|null}   parsed_exercise
 * @property {string}        confidence        - "high"|"medium"|"low"
 * @property {string}        natural_summary
 * @property {string|null}   missing_critical_field
 */
export const parseLogPreviewResponse = (raw = {}) => ({
  transcript:             raw.transcript              ?? null,
  log_categories:         raw.log_categories          ?? [],
  parsed_foods:           raw.parsed_foods            ?? null,
  parsed_symptoms:        raw.parsed_symptoms         ?? null,
  parsed_severity:        raw.parsed_severity         ?? null,
  parsed_stress:          raw.parsed_stress           ?? null,
  parsed_sleep:           raw.parsed_sleep            ?? null,
  parsed_exercise:        raw.parsed_exercise         ?? null,
  confidence:             raw.confidence              ?? 'high',
  natural_summary:        raw.natural_summary         ?? '',
  missing_critical_field: raw.missing_critical_field  ?? null,
});

/**
 * @typedef {Object} LogCreateRequest
 * @property {'text'|'voice'}  source
 * @property {string|null}     raw_content
 * @property {string[]|null}   log_categories
 * @property {string[]|null}   parsed_foods
 * @property {string[]|null}   parsed_symptoms
 * @property {number|null}     parsed_severity
 * @property {string|null}     parsed_stress
 * @property {number|null}     parsed_sleep
 * @property {string|null}     parsed_exercise
 */
export const makeLogCreateRequest = ({
  source          = 'text',
  raw_content     = null,
  log_categories  = null,
  parsed_foods    = null,
  parsed_symptoms = null,
  parsed_severity = null,
  parsed_stress   = null,
  parsed_sleep    = null,
  parsed_exercise = null,
} = {}) => ({
  source, raw_content, log_categories,
  parsed_foods, parsed_symptoms, parsed_severity,
  parsed_stress, parsed_sleep, parsed_exercise,
});

/**
 * @typedef {Object} LogResponse
 * @property {string}        id
 * @property {string}        user_id
 * @property {string|null}   raw_content
 * @property {string}        logged_at     - ISO datetime
 * @property {string|null}   log_type
 * @property {string[]|null} parsed_foods
 * @property {string[]|null} parsed_symptoms
 * @property {number|null}   parsed_severity
 * @property {string|null}   parsed_stress
 * @property {number|null}   parsed_sleep
 * @property {string|null}   parsed_exercise
 */
export const parseLogResponse = (raw = {}) => ({
  id:              raw.id              ?? '',
  user_id:         raw.user_id         ?? '',
  raw_content:     raw.raw_content     ?? null,
  logged_at:       raw.logged_at       ?? '',
  log_type:        raw.log_type        ?? null,
  parsed_foods:    raw.parsed_foods    ?? null,
  parsed_symptoms: raw.parsed_symptoms ?? null,
  parsed_severity: raw.parsed_severity ?? null,
  parsed_stress:   raw.parsed_stress   ?? null,
  parsed_sleep:    raw.parsed_sleep    ?? null,
  parsed_exercise: raw.parsed_exercise ?? null,
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
  email:               raw.email               ?? '',
  digestive_condition: raw.digestive_condition  ?? null,
  goal:                raw.goal                ?? null,
  age_range:           raw.age_range           ?? null,
  updated_at:          raw.updated_at          ?? '',
});
