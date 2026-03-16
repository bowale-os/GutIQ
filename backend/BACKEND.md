# GutIQ Backend — File-by-File Logic & Debug Reference

Every file explained. Read this when something breaks or when you need to know
where to make a change.

---

## app/main.py

**What it does:** Entry point. Creates the FastAPI app, mounts CORS middleware,
and registers all routes via `api_router`.

**Debug:** If the server won't start, this is the first file to check. CORS errors
in the browser (blocked requests) → check the `origins` list here. Add your
frontend URL if it's missing.

---

## app/core/config.py

**What it does:** Single source of truth for all environment variables.
Uses `pydantic-settings` — reads from `.env` automatically.
Every other file imports `from app.core.config import settings`.

**Fields:**
- `DATABASE_URL` — async PostgreSQL URL (`postgresql+asyncpg://...`)
- `DATABASE_URL_SYNC` — sync URL used by Alembic only
- `JWT_SECRET` — signs and verifies auth tokens
- `JWT_ALGORITHM` — always `HS256`
- `ANTHROPIC_API_KEY` — Claude API
- `DEEPGRAM_API_KEY` — voice transcription
- `QDRANT_URL` — Qdrant Cloud cluster URL
- `QDRANT_API_KEY` — Qdrant Cloud API key

**Debug:** `ValidationError` on startup → a required env var is missing from `.env`.
The error message names the missing field.

---

## app/core/security.py

**What it does:** Password hashing (bcrypt) and JWT token creation/verification.

**Key functions:**
- `hash_password(plain)` → hashed string stored in DB
- `verify_password(plain, hashed)` → True/False on login
- `create_access_token(subject, expires_delta)` → signed JWT

**Debug:** Login returning 401 → `verify_password` returning False.
Token decode errors → `JWT_SECRET` mismatch between token creation and verification.

---

## app/core/utils.py

**What it does:** Small helpers. Currently contains `utcnow()` — returns
`datetime.utcnow()` in a timezone-aware way, used as the default for all
`created_at` / `logged_at` fields across models.

---

## app/db/__init__.py

**What it does:** Creates the async SQLAlchemy engine and session factory.
The `lifespan` async context manager runs on startup/shutdown:
- Creates the engine
- Calls `SQLModel.metadata.create_all` (creates tables if missing)
- Disposes the engine on shutdown

`get_session()` is the FastAPI dependency that yields an `AsyncSession`
and rolls back on exception.

**Debug:** `✓ Database connected` in logs = working.
Connection refused → `DATABASE_URL` wrong or Postgres not running.
`create_all` silently skips tables that already exist — use Alembic for schema changes.

---

## app/models/user.py — `User`

**Table:** `users`

**Fields:** `id` (UUID PK), `name`, `email` (unique), `hashed_password`,
`digestive_condition`, `goal`, `age_range`, `created_at`, `updated_at`.

**Debug:** Unique constraint violation on signup → email already registered.

---

## app/models/log.py — `Log`, `FoodEntry`, `SymptomEntry`, `WellnessEntry`

**Tables:** `logs`, `food_entries`, `symptom_entries`, `wellness_entries`

**Log** is the parent envelope — stores raw input only, never modified after save.
**FoodEntry** — one row per food item (many per log).
**SymptomEntry** — one row per symptom with its own severity.
**WellnessEntry** — exactly one per log (stress, sleep, exercise).

**Relationships:** Log → children via SQLModel `Relationship`. Use
`selectinload` when querying to avoid N+1 queries (see `log.py` router).

**Debug:** Missing child rows after save → check `session.flush()` is called
before inserting children. `flush()` gives the parent its DB-generated ID.

---

## app/models/pain_relief.py — `PainReliefSession`, `PainReliefChunk`, `PainReliefFeedback`

**Tables:** `pain_relief_sessions`, `pain_relief_chunks`, `pain_relief_feedback`

**PainReliefSession** — one row per interaction. Stores everything the user
reported (body clicks as JSON, description, intensity) + what the system decided
(condition, red flag status) + the full Claude response (`steps_recommended`).

**PainReliefChunk** — one row per clinical evidence chunk retrieved from Qdrant
for that session. Gives a complete audit trail: you can always see exactly what
evidence grounded each recommendation. Queryable by `source`, `condition`, `pmid`.

**PainReliefFeedback** — submitted by the user after trying the steps.
`relief_rating` (1–5), `steps_completed`, optional `notes`.
Unique constraint on `session_id` — one feedback per session.
This data is the ground truth for measuring whether the system actually helps.

**Debug:** `body_clicks` is a JSON column — stored as a list of dicts.
If it's null, check that `[c.model_dump() for c in request.body_clicks]`
is being passed correctly in the router.

---

## app/schemas/pain_relief.py

**What it does:** All Pydantic schemas and enums for the pain relief feature.

**Key types:**
- `BodyView` — `anterior` | `posterior` (which body image was clicked)
- `AnteriorRegion` / `PosteriorRegion` — named body regions on each view
- `GutCondition` — the 6 identifiable conditions
- `PainCharacter` — optional structured pain descriptor (sharp, cramping, burning...)
- `BodyClickPoint` — one tap: `{region, view}`
- `PainReliefRequest` — what the frontend sends (validated by FastAPI automatically)
- `RetrievedChunk` — one Qdrant result chunk
- `RetrievalResult` — internal output of the retriever, passed to Claude generation
- `PainReliefResponse` — what the frontend receives back

**Debug:** 422 Unprocessable Entity from the API → request body failed Pydantic
validation. The response body will name the exact field and why it failed.

---

## app/schemas/log.py, user.py

Standard Pydantic schemas for the log and user endpoints.
Same pattern — request schemas validate incoming data, response schemas
control what's returned. Check these if the API returns unexpected fields.

---

## app/api/deps.py

**What it does:** `get_current_user` dependency. Decodes the JWT Bearer token,
extracts the user ID, and fetches the `User` row from the DB.
All protected endpoints declare `current_user: User = Depends(get_current_user)`.

**Debug:** 401 on a protected endpoint → token missing, expired, or signed with
wrong `JWT_SECRET`. Check `Authorization: Bearer <token>` header is being sent.

---

## app/api/v1/auth.py

**Endpoints:** `POST /auth/signup`, `POST /auth/login`

**Signup:** Checks email uniqueness → hashes password → inserts `User` → returns JWT.
**Login:** Looks up user by email → `verify_password` → returns JWT.

**Debug:** 400 "Email already registered" → unique constraint hit.
401 "Incorrect email or password" → wrong credentials or user doesn't exist.

---

## app/api/v1/log.py

**Endpoints:** `POST /log/preview`, `POST /log/create-log`,
`GET /log/list-logs`, `GET /log/logs/{log_id}`

**Preview:** Accepts text or voice. For voice: transcribes with Deepgram first.
Calls `parse_with_llm()` → returns structured fields for user to review.
Does NOT save to DB.

**Create-log:** Saves the confirmed preview to DB. Creates the `Log` envelope,
then `FoodEntry` / `SymptomEntry` / `WellnessEntry` children.
`session.flush()` before children is critical — it assigns `log.id`.

**Debug:** Empty `food_entries` after save → check `body.parsed_foods` is not None.
`WellnessEntry` not created → all three wellness fields are None (by design).

---

## app/api/v1/pain_relief.py

**Endpoints:** `POST /pain-relief/session`, `POST /pain-relief/feedback`

**Session endpoint flow:**
1. Validate `PainReliefRequest` (Pydantic — automatic)
2. `asyncio.to_thread(retrieve, body)` — runs the sync Qdrant retriever
   in a thread pool so it doesn't block the async event loop
3. If red flag → save session, return escalation immediately (no Claude call)
4. `generate_relief_steps()` — Claude call, grounded in chunks
5. `_save_session()` — save `PainReliefSession` + `PainReliefChunk` rows
6. Return `PainReliefResponse`

DB save is after generation — we never store incomplete sessions.
DB failure after generation is caught and logged but non-fatal — the user
still receives their relief steps.

**Feedback endpoint:** Looks up session by `session_id` + `user_id`,
guards against duplicate submissions (409), saves `PainReliefFeedback`.

**Debug:** 503 → check `detail` field. "Knowledge base unavailable" = Qdrant issue.
"Relief step generation failed" = Claude issue. Both log the full exception.

---

## app/ai_llm/parser.py

**What it does:** Sends the user's log text to Claude haiku and extracts
structured JSON: foods, symptoms (with severity), wellness metrics,
natural summary, confidence level.

**System prompt:** Carefully tuned to return only `foods` and `symptoms`
the user explicitly mentioned — never infers. History context injected
to help with disambiguation (e.g. "my usual breakfast").

**Debug:** `json.JSONDecodeError` → Claude returned malformed JSON.
The error logs the first 200 chars of the raw response.
Set `echo=True` on the engine (in `db/__init__.py`) for full SQL visibility.

---

## app/ai_llm/pain_relief_gen.py

**What it does:** Takes the `RetrievalResult` (condition + Qdrant chunks)
and builds a Claude prompt. The prompt injects each chunk as a numbered
context block and strictly instructs Claude to only use that content.

**Key constants:**
- `MODEL = "claude-haiku-4-5-20251001"` — fast, cheap, sufficient for structured output
- `MAX_TOKENS = 800` — enough for 6 steps, prevents runaway responses
- `LOG_PROMPTS` — set `LOG_PROMPTS=true` in `.env` to print full prompt + response

**Debug:** Steps look generic or wrong → set `LOG_PROMPTS=true` and check
what chunks were fed as context. If chunks are irrelevant, the problem is
upstream in the retriever (wrong condition resolved).

---

## app/rag/ingest.py

**What it does:** One-time script that builds the Qdrant knowledge base.
Run it before the pain relief endpoint will work.

**Steps:**
1. Fetch PubMed abstracts via E-utilities API (free, no key)
2. Scrape NHS condition pages via WebBaseLoader
3. Load any PDFs from `knowledge/pdfs/` via PyMuPDFLoader
4. Save all raw docs to `knowledge/cache/raw_docs.parquet`
5. Split into 512-char chunks with 64-char overlap
6. Embed with `all-MiniLM-L6-v2` (local, downloads on first run ~90MB)
7. Upsert to Qdrant Cloud in batches of 100

**Commands:**
```bash
python -m app.rag.ingest               # full fetch + index
python -m app.rag.ingest --from-cache  # re-index from Parquet (fast)
python -m app.rag.ingest --recreate    # wipe Qdrant collection + rebuild
```

**Debug:** PubMed failures → NCBI rate-limiting, increase `time.sleep(0.4)`.
NHS failures → page structure changed, check URL still valid.
Qdrant failures → check `QDRANT_URL` and `QDRANT_API_KEY` in `.env`.
First run is slow (model download + 500 API calls) — subsequent `--from-cache`
runs take under 4 minutes.

---

## app/rag/retriever.py

**What it does:** Takes a `PainReliefRequest` and returns a `RetrievalResult`.
Zero LLM calls. Three stages:

1. **Red flag check** — keyword scan of description + structural rules
   (lower-right click + intensity ≥ 6 → possible appendicitis).
   If triggered, returns immediately with `is_red_flag=True`.

2. **Condition resolver** — scores all `GutCondition` values using:
   - Body region primary/secondary candidates (2.0 / 1.0 points)
   - Keyword signals from description (1.5 points each)
   - Pain character enum (1.0 point)
   Returns the highest-scoring condition.

3. **Qdrant search** — embeds the description, filters by `metadata.condition`,
   returns top-6 chunks by cosine similarity.
   Falls back to unfiltered search if filtered query returns nothing.

**Singleton:** `_vector_store` is a module-level variable created once on first
call and reused for the process lifetime. This avoids re-loading the embedding
model on every request.

**Debug:** Wrong condition → add `logging.DEBUG` to see all condition scores.
No chunks returned → run `python -m app.rag.ingest` to populate Qdrant.
Qdrant connection error → verify `QDRANT_URL` + `QDRANT_API_KEY`.

---

## alembic/

Standard Alembic migration setup.

```bash
alembic upgrade head       # apply all pending migrations
alembic current            # show current revision
alembic history            # show full migration chain
alembic downgrade -1       # roll back one migration
alembic revision --autogenerate -m "description"  # generate new migration
```

`env.py` imports all models so Alembic can detect schema changes via
`--autogenerate`. If you add a new model, import it in `env.py`.

---

## knowledge/

```
knowledge/
├── cache/
│   └── raw_docs.parquet   # cached raw docs — safe to delete, rebuilt by ingest
└── pdfs/                  # drop ACG / BSG / Rome Foundation PDFs here
```

The `pdfs/` folder is checked by `ingest.py` during every run.
PDF filenames are used to auto-detect the condition:
- `ibs_cramping` if filename contains "ibs" or "irritable"
- `acid_reflux` if contains "gerd", "reflux", "heartburn", or "acid"
- `constipation` if contains "constipat"
- `nausea` if contains "nausea" or "vomit"
- `general` for everything else

---

## Running the full stack locally

```bash
cd backend

# 1. Install dependencies
pip install -r requirements.txt

# 2. Set up .env (see Environment Variables section above)

# 3. Apply DB migrations
alembic upgrade head

# 4. Build knowledge base (first time only)
python -m app.rag.ingest

# 5. Start server
uvicorn app.main:app --reload --port 8000

# 6. Interactive API docs
open http://localhost:8000/docs
```
