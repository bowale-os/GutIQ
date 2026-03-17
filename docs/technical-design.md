# GutIQ — Technical Design

Complete reference for the backend architecture, AI pipelines, data models,
and frontend structure. Keep this updated when adding new features.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite), plain CSS-in-JS via style objects |
| Backend | FastAPI (async), Python 3.11+ |
| Database | PostgreSQL via asyncpg, SQLModel ORM |
| Migrations | Alembic |
| AI model | Anthropic Claude (claude-haiku-4-5-20251001) |
| Vector DB | Qdrant Cloud |
| Embeddings | FastEmbed — BAAI/bge-small-en-v1.5 (local, no GPU) |
| Auth | JWT (HS256), python-jose, bcrypt |
| Transcription | Deepgram |

---

## Backend file map

```
backend/app/
├── main.py                        FastAPI app, CORS, lifespan (DB connect/disconnect)
├── core/
│   ├── config.py                  Pydantic BaseSettings — reads .env
│   ├── security.py                JWT create/verify, password hash/verify
│   └── utils.py                   utcnow() helper
├── db/
│   └── __init__.py                Async engine, session factory, get_session(), lifespan
├── models/
│   ├── user.py                    User table (auth fields + health profile fields)
│   ├── log.py                     Log, FoodEntry, SymptomEntry, WellnessEntry
│   ├── pain_relief.py             PainReliefSession, PainReliefChunk, PainReliefFeedback
│   └── gut_check.py               GutCheckSession, GutCheckMessage
├── schemas/
│   ├── log.py                     Request/response Pydantic models for log endpoints
│   ├── pain_relief.py             PainReliefRequest, StructuredRelief, PrimaryAction, etc.
│   ├── user.py                    UserUpdate, UserResponse
│   └── onboarding.py              OnboardingRequest
├── api/
│   ├── deps.py                    get_current_user() — JWT → User ORM object
│   └── v1/
│       ├── __init__.py            Router aggregator — all routers registered here
│       ├── auth.py                POST /auth/signup, POST /auth/login
│       ├── onboarding.py          POST /onboarding/complete, GET /onboarding/status
│       ├── log.py                 POST /log/preview, POST /log/create-log, GET /log/list-logs
│       ├── user.py                GET /users/me, PATCH /users/me
│       ├── pain_relief.py         POST /pain-relief/session, POST /pain-relief/feedback
│       └── gut_check.py           POST /gutcheck/ask (SSE), POST /gutcheck/profile/regenerate
├── ai_llm/
│   ├── parser.py                  Log parsing — Claude extracts foods/symptoms/wellness from text
│   ├── transcriber.py             Deepgram voice → text transcription
│   ├── pain_relief_gen.py         Pain relief generation — returns StructuredRelief JSON
│   ├── gut_check_prompt.py        GutCheck system prompt builder + log formatter
│   ├── gut_check_tools.py         query_logs and fetch_research tool implementations
│   ├── gut_check_profile.py       Background health profile regeneration
│   └── gut_check_gen.py           GutCheck agent loop — SSE streaming, tool dispatch
└── rag/
    ├── retriever.py               Red flag check, condition resolution, Qdrant similarity search
    └── ingest.py                  Offline script — embed PDFs/text into Qdrant collection
```

---

## Data models

### User
```
id, name, email, hashed_password
digestive_condition, goal, age_range
health_profile_summary          — Claude-generated compact summary of all logs (~400 tokens)
profile_updated_at              — when the profile was last regenerated
logs_since_last_profile_change  — counter; triggers regeneration at 5
created_at, updated_at
```

### Log (envelope)
```
id, user_id, raw_content, source ("text"|"voice")
transcript, natural_summary, confidence
logged_at
→ food_entries[]      FoodEntry(name)
→ symptom_entries[]   SymptomEntry(name, severity 1-10)
→ wellness_entry      WellnessEntry(stress, sleep_hours, exercise)
```

### PainReliefSession
```
id, user_id, session_id (client-facing UUID)
body_clicks (JSON), description, intensity, pain_character
identified_condition, is_red_flag, red_flag_reason
steps_recommended (full Claude JSON as string)
→ chunks[]     PainReliefChunk(text, source, title, pmid, year, condition, relevance_score)
→ feedback     PainReliefFeedback(relief_rating 1-5, steps_completed, notes)
```

### GutCheckSession + GutCheckMessage
```
GutCheckSession: id, user_id, created_at
GutCheckMessage: id, session_id, user_id, role ("user"|"assistant"), content, tools_used (JSON list), created_at
```

---

## Feature: Pain Relief (Tiwa)

**Entry point:** `POST /pain-relief/session`

**Pipeline:**
```
1. retrieve()  [sync, run in thread pool]
   ├─ Red flag check — keyword patterns + structural rules (lower-right + intensity ≥6)
   ├─ Condition resolution — region map scoring + keyword boost + pain character
   └─ Qdrant similarity search — top 6 chunks filtered by winning condition

2. If red flag → return escalation immediately, skip Claude

3. generate_relief_steps()  [async]
   ├─ Build user prompt (regions + intensity + description + retrieved chunks)
   ├─ Claude call — claude-haiku-4-5-20251001, max 1500 tokens
   ├─ Parse JSON response → StructuredRelief
   └─ Handle {"error": "insufficient_evidence"} sentinel

4. Save PainReliefSession + PainReliefChunk rows to DB

5. Return PainReliefResponse { session_id, is_red_flag, structured, reply }
```

**StructuredRelief schema:**
```json
{
  "primary":   { "action": "...", "instruction": "...", "duration_minutes": 10 },
  "maintain":  ["...", "..."],
  "avoid":     ["...", "..."],
  "alternatives": [ { "action": "...", "instruction": "...", "duration_minutes": 8 }, ... ],
  "session_duration_minutes": 20,
  "when_to_seek_care": "..."
}
```

**Frontend flow:** intake → loading → relief (breathing circle, timer, primary action) → done (star rating) → seekcare | redflag

---

## Feature: GutCheck Agent (Tiwa)

**Entry point:** `POST /gutcheck/ask` — returns SSE stream

**Architecture decision:** Raw logs injected into system prompt (not pre-computed correlations). This handles ~80% of questions with zero tool calls. Tools fire only for questions the injected context cannot answer.

**Context layers injected on every turn:**
1. Long-term health profile (~400 tokens) — Claude-generated summary of full log history, updated in background every 5 new logs
2. Last 30 days raw logs (~6,000 tokens) — full detail for recent/specific questions

**Why not pre-computed correlations:** Pearson r on 14-30 rows of self-reported data has massive confidence intervals. Claude reasoning over raw logs is more honest and adapts to follow-up questions naturally.

**Agent loop:**
```
1. Load user, recent logs, conversation history from DB
2. Build system prompt (profile + raw logs + tool usage rules)
3. Stream Claude response
   ├─ content_block_start (tool_use) → yield SSE tool_start
   ├─ content_block_delta (text)     → yield SSE answer_chunk
   └─ stop_reason == "end_turn"      → yield SSE done, break loop
4. If stop_reason == "tool_use":
   ├─ Execute all tool calls in parallel (asyncio.gather)
   ├─ yield SSE tool_done for each
   ├─ Append assistant turn + tool results to messages
   └─ Loop (continue streaming)
5. Save user message + assistant message to GutCheckMessage
```

**SSE event types:**
```
{ type: "session_id",   id: "uuid" }           — first event, always
{ type: "tool_start",   tool: "query_logs" }   — Claude called a tool
{ type: "tool_done",    tool: "query_logs" }   — tool result ready
{ type: "answer_chunk", text: "..." }           — streaming text
{ type: "done" }                                — stream complete
```

**Tools:**

`query_logs` — searches full log history beyond 30 days
- Fires for: "every time X", "has X ever", "how many times", specific date ranges
- Filters: food_contains, symptom_contains, min_severity, days_back (max 1825), limit
- Synonym expansion: FOOD_SYNONYMS + SYMPTOM_SYNONYMS dicts (covers 80% case)
- TODO: replace Python-side text matching with DB full-text search when synonym list grows

`fetch_research` — semantic search over Qdrant clinical knowledge base
- Fires for: "why does X happen", "is there research on X", mechanism questions
- Reuses existing `_get_vector_store()` singleton from pain relief pipeline
- Runs in thread pool (Qdrant client is synchronous)

**Conversation memory:**
- Session persists in DB. History loaded on each request.
- Last 10 Q+A pairs kept (older trimmed to prevent context overflow).
- Session ID sent as first SSE event; frontend stores and sends back on next turn.

**Health profile background task:**
- Triggered by `POST /log/create-log` when `logs_since_last_profile_change >= 5`
- Sends existing profile + last 20 new logs to Claude (not full history each time)
- Stores result on `User.health_profile_summary`, resets counter
- Failures are logged and swallowed — never blocks a request
- Manual trigger: `POST /gutcheck/profile/regenerate`

---

## Feature: Log Entry

**Entry point:** `POST /log/preview` (parse without saving), `POST /log/create-log` (save)

**Parse pipeline:**
```
raw text / voice transcript
  → parse_with_llm() — Claude extracts foods, symptoms, wellness, severity, confidence
  → return LogPreviewResponse for user review
  → user confirms → POST /log/create-log
  → save Log + FoodEntry[] + SymptomEntry[] + WellnessEntry
  → increment User.logs_since_last_profile_change
  → if >= 5: trigger background profile regeneration
```

---

## Auth flow

```
POST /auth/signup → hash password, save User, return JWT
POST /auth/login  → verify password, return JWT
All protected routes: Authorization: Bearer <token>
  → get_current_user() in deps.py: decode JWT → user_id → User ORM object
Token expiry: 24 hours (configurable via ACCESS_TOKEN_EXPIRE_HOURS)
```

---

## Frontend screen map

```
gutiq-app/src/
├── App.jsx                Main router. AUTH_SCREENS get NavBar. demoMode bypasses auth.
├── screens/
│   ├── Login.jsx          Email/password auth + "Skip to demo" button
│   ├── Signup.jsx         Account creation with validation
│   ├── Onboarding.jsx     3-step wizard: condition → goal → settings
│   ├── Dashboard.jsx      Sparkline chart, recent logs, pain relief CTA
│   ├── LogEntry.jsx       Voice/text log capture → preview → confirm → save
│   ├── GutCheck.jsx       Tiwa AI chat. Real SSE in production, mock in demo mode.
│   ├── PainRelief.jsx     Tiwa pain relief. RAG backend in production, mock in demo mode.
│   ├── Export.jsx         14-day doctor summary. PDF generation TODO.
│   ├── Profile.jsx        Editable user settings.
│   ├── Lifestyles.jsx     Community tips and challenges. Currently mock data only.
│   └── Insights.jsx       Pattern insights. Orphaned — not routed in App.jsx yet.
├── api/
│   ├── client.js          BASE_URL, getToken(), setToken(), auth headers
│   ├── auth.js            login(), signup()
│   ├── logs.js            fetchRealLogs(), preview(), create()
│   ├── user.js            getUserData(), update()
│   ├── onboarding.js      complete(), getStatus()
│   ├── painRelief.js      submitPainSession(), submitPainFeedback()
│   └── gutCheck.js        askGutCheck() — SSE client with buffered line parsing
└── constants/
    ├── colors.js           COLORS design system
    ├── styles.js           FONTS, STYLES, shared style objects
    └── mockData.js         currentUser, mockLogs, mockInsights (demo mode data)
```

---

## Environment variables

```
DATABASE_URL              postgresql+asyncpg://...   (async, for app)
DATABASE_URL_SYNC         postgresql://...           (sync, for alembic)
JWT_SECRET                random secret key
JWT_ALGORITHM             HS256
ACCESS_TOKEN_EXPIRE_HOURS 24
ANTHROPIC_API_KEY         sk-ant-...
DEEPGRAM_API_KEY          ...
QDRANT_URL                https://xyz.qdrant.io
QDRANT_API_KEY            ...
LOG_PROMPTS               true | false   (prints full prompts to stdout for debugging)
```

---

## Debugging tips

**GutCheck agent not calling tools:**
Set `LOG_PROMPTS=true` in `.env`. The full system prompt and Claude's raw response print to stdout. Check that the tool usage rules in `gut_check_prompt.py` are being injected correctly.

**Wrong condition identified in pain relief:**
Check `retriever.py` — the `_resolve_condition()` function logs all condition scores at DEBUG level. Set log level to DEBUG to see them.

**Health profile not updating:**
Call `POST /gutcheck/profile/regenerate` manually to force a rebuild. Check that `logs_since_last_profile_change` is incrementing in the DB after each log save.

**SSE stream not reaching frontend:**
Check nginx config — the `X-Accel-Buffering: no` header must reach the client. Vite dev proxy also needs `changeOrigin: true`.

**Qdrant returns no results:**
The collection may be empty. Run `python backend/app/rag/ingest.py` to embed the knowledge base documents. Collection name: `gut_pain_relief`.

**Claude returns non-JSON in pain relief:**
`_extract_json()` in `pain_relief_gen.py` handles markdown fence stripping and regex fallback. If it still fails, the raw response is logged when `LOG_PROMPTS=true`.
