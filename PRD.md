# GutIQ — Product Requirements Document

**Version:** 1.0
**Date:** March 2026
**Stack:** FastAPI · PostgreSQL · SQLModel · LangChain · Qdrant · React · GCP

---

## 1. Overview

GutIQ is an AI-assisted gut health tracking app for patients managing chronic digestive conditions (GERD, peptic ulcers, IBS). Users log meals, symptoms, sleep, stress, and exercise via a conversational interface. An RAG pipeline correlates their personal logs against a curated clinical knowledge base to surface non-medical, evidence-backed pattern insights — e.g., *"High-stress days in your logs align with research linking visceral hypersensitivity to bloating."*

### Problem Statement

Digestive condition patients need to track triggers (diet, stress, sleep, exercise) and symptoms over 2–4 weeks to identify personal patterns. Existing solutions are either too generic, too manual, or provide no evidence-grounded feedback. Doctors lack structured, exportable log data at appointments.

### Goals

| Goal | Target |
|---|---|
| Sub-100ms query latency for log retrieval | 1K+ simulated daily events |
| RAG insight relevance | 80%+ in user tests |
| Clinical knowledge base | 500+ PubMed/NHS abstracts |
| Test coverage | 80%+ (pytest) |
| Deployment | GCP Cloud Run + Cloud SQL |

---

## 2. Current State (Phase 1 — Completed)

### 2.1 What's Built

The backend foundation is production-structured with async FastAPI, PostgreSQL via SQLModel, JWT auth, Alembic migrations, and CI via GitHub Actions.

#### API Endpoints (Live)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | No | Health ping |
| GET | `/health` | No | Health status |
| POST | `/auth/signup` | No | Register user → returns JWT |
| POST | `/auth/login` | No | Login → returns JWT |

#### Database Schema (Current)

**`users` table**
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK, auto-generated |
| `email` | VARCHAR | Unique, indexed |
| `hashed_password` | VARCHAR | bcrypt |
| `digestive_condition` | VARCHAR | Nullable, indexed (e.g., "GERD") |
| `goal` | VARCHAR | Nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL, server default |
| `updated_at` | TIMESTAMPTZ | NOT NULL, auto-updated |

**`logs` table**
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK, auto-generated |
| `user_id` | UUID | FK → users.id |
| `raw_content` | TEXT | Raw chatbot input |
| `logged_at` | DATETIME | Auto-set on creation |
| `parsed_foods` | VARCHAR | AI-populated post-submission |
| `parsed_symptoms` | VARCHAR | AI-populated post-submission |
| `parsed_severity` | INT | AI-populated (1–10) |

#### Tech Stack (Active)
- **Runtime:** Python 3.11, FastAPI 0.115+
- **ORM:** SQLModel (SQLAlchemy + Pydantic hybrid)
- **DB drivers:** asyncpg (async) + psycopg2 (sync/Alembic)
- **Auth:** passlib[bcrypt] 1.7.4 + bcrypt 3.x, python-jose HS256 JWT
- **Migrations:** Alembic (3 applied migrations)
- **CI:** GitHub Actions — Postgres service container, pytest

#### Known Schema Gaps
- `UserCreateRequest` accepts a `name` field that is **not stored** in the User model
- `logs` table missing: `sleep_hours`, `stress_level`, `exercise_minutes`, `exercise_notes`, `additional_notes`
- `app/crud/log.py` and `app/api/deps.py` are empty stubs

---

## 3. User Personas

### Primary: GERD / Ulcer Patient
- Tracks heartburn, regurgitation, bloating, epigastric pain daily
- Needs to identify personal food/stress triggers over 2–4 weeks
- Wants doctor-exportable summaries
- Not medically trained — needs non-prescriptive, pattern-based language

### Secondary: General Gut Health User
- Tracks IBS-like symptoms, general digestive discomfort
- Interested in lifestyle correlations (sleep quality, exercise timing)

---

## 4. Feature Requirements

### Phase 1 — Foundation ✅ Complete

- [x] PostgreSQL + Alembic migrations
- [x] User model (id, email, hashed_password, digestive_condition, goal, timestamps)
- [x] Log model (id, user_id, raw_content, logged_at, parsed fields)
- [x] FastAPI async structure with CORS
- [x] JWT auth: signup + login
- [x] bcrypt password hashing
- [x] GitHub Actions CI (Postgres service, pytest)
- [x] Auth tests: signup success, login success, login fail

---

### Phase 2 — Complete Backend CRUD + User Profile

#### 2.1 Fix Schema Inconsistencies

- Add `name` column to `User` model (VARCHAR, nullable) or remove `name` from `UserCreateRequest`
- Migrate `logs` table to add MVP fields (see below)

#### 2.2 Expanded Log Schema

```
logs (
  id            UUID PRIMARY KEY,
  user_id       UUID REFERENCES users(id),
  raw_content   TEXT,            -- original chatbot input
  logged_at     TIMESTAMPTZ,

  -- Structured fields (user-filled or AI-parsed)
  foods         TEXT[],          -- e.g. ["coffee", "pizza"]
  symptoms      TEXT[],          -- e.g. ["bloating", "heartburn"]
  severity      INT,             -- 1–10
  sleep_hours   FLOAT,           -- e.g. 6.5
  stress_level  INT,             -- 1–10
  exercise_min  INT,             -- minutes of exercise
  notes         TEXT,            -- free-form extra notes

  -- AI fields
  parsed_at     TIMESTAMPTZ,     -- when AI processed the log
  insight_id    UUID             -- FK to future insights table
)
```

#### 2.3 Log Endpoints (Required)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/logs` | JWT | Create new log |
| GET | `/logs` | JWT | List user's logs (paginated, filterable) |
| GET | `/logs/{id}` | JWT | Get single log |
| PATCH | `/logs/{id}` | JWT | Update log fields |
| DELETE | `/logs/{id}` | JWT | Delete log |

**Filter params for GET /logs:**
- `?from_date=&to_date=` — date range
- `?symptom=bloating` — filter by symptom
- `?limit=20&offset=0` — pagination

#### 2.4 User Profile Endpoints (Required)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/auth/me` | JWT | Get current user profile |
| PATCH | `/auth/profile` | JWT | Update digestive_condition, goal, name |

#### 2.5 Auth Middleware

- Implement `get_current_user` dependency in `app/api/deps.py`
- All `/logs` and `/auth/me` routes must validate JWT and extract `user_id`

#### 2.6 Tests to Add
- POST /logs (create, validate ownership)
- GET /logs (returns only current user's logs)
- GET /auth/me (returns correct user)
- 401 on missing/invalid JWT

---

### Phase 3 — Frontend Core

#### Stack
- **Framework:** React + Vite + Tailwind CSS
- **HTTP:** Axios
- **Charts:** Recharts
- **CSV export:** PapaParse

#### Pages / Components

| Page | Description |
|---|---|
| `/signup` | Registration form (name, email, password, digestive condition) |
| `/login` | Login form |
| `/onboarding` | Set health goal, confirm condition |
| `/dashboard` | Symptom trends (LineChart), recent logs table, Insights button |
| `/log/new` | Log entry form: foods multi-select, symptom multi-select, sliders for stress/sleep/exercise |
| `/log/{id}` | Detail view with AI-parsed fields |
| `/export` | CSV export of date-range logs |

#### Dashboard Charts (Recharts)
- Symptom frequency over time (LineChart, daily)
- Stress level vs. symptom severity correlation (ScatterChart)
- Sleep hours trend (BarChart)
- Top 5 foods appearing before symptoms (PieChart)

#### Disclaimer Banner
> *GutIQ provides pattern insights for informational purposes only. This is not medical advice. Always consult a healthcare professional.*

---

### Phase 4 — RAG AI Pipeline

#### 4.1 Clinical Knowledge Base (ETL)

- **Sources:** PubMed EUtils API + NHS RSS/JSON
- **Queries:** `"heartburn triggers diet stress"`, `"GERD symptoms sleep exercise"`, `"peptic ulcer bloating patterns"`
- **Target:** 500+ abstracts
- **Processing:** RecursiveCharacterTextSplitter (chunk_size=500) → HuggingFace embeddings (`sentence-transformers/all-MiniLM-L6-v2`) → Qdrant collection `gut_docs`

```python
# etl.py skeleton
queries = [
    "heartburn triggers diet stress",
    "GERD symptoms sleep exercise",
    "peptic ulcer bloating patterns"
]
splitter = RecursiveCharacterTextSplitter(chunk_size=500)
embedder = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
# Fetch → chunk → embed → upsert to Qdrant
```

#### 4.2 Insights Endpoint

```
POST /insights
Authorization: Bearer <token>
Body: { "days": 7 }   # look-back window
```

**Flow:**
1. Fetch user's last N logs from PostgreSQL
2. Summarize: top symptoms, foods, avg stress, avg sleep
3. Query Qdrant (top-5 semantically similar clinical docs)
4. LangChain RetrievalQA prompt:
   > *"Based on these user logs: {log_summary} and these clinical abstracts: {docs}, identify hypothetical digestive patterns. Use non-prescriptive language. Do not give medical advice."*
5. Return structured response with insight text + source citations

**LLM:** Phi-3 Mini (HuggingFace Inference) or Vertex AI (GCP)

#### 4.3 Insights Schema

```
insights (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  generated_at TIMESTAMPTZ,
  log_window_days INT,
  insight_text TEXT,
  source_docs  JSONB    -- [{title, url, relevance_score}]
)
```

#### 4.4 Caching
- Redis cache for insights (TTL: 1 hour) to avoid redundant LLM calls on same log window

---

### Phase 5 — Optimization & Deploy

#### Performance Targets

| Metric | Target |
|---|---|
| Log query (1K events) | < 100ms |
| Insights generation | < 5s |
| Qdrant HNSW lookup | < 50ms |

#### TimescaleDB (Optional Upgrade)
- If log volume justifies it: convert `logs` table to hypertable on `logged_at`
- Enables: `time_bucket('1 day', logged_at)` aggregate queries
- Required for resume claim of *"sub-100ms on 1K+ simulated daily events"*

```sql
SELECT create_hypertable('logs', 'logged_at');
SELECT time_bucket('1 day', logged_at) AS day,
       AVG(stress_level), array_agg(DISTINCT symptoms)
FROM logs
WHERE user_id = $1
GROUP BY day ORDER BY day DESC;
```

#### GCP Deployment

| Component | GCP Service |
|---|---|
| FastAPI backend | Cloud Run |
| PostgreSQL | Cloud SQL (Postgres 15) |
| Qdrant vector DB | Cloud Run (containerised) |
| LangChain / LLM | Vertex AI |
| React frontend | Firebase Hosting or Cloud Storage + CDN |

#### CI/CD (GitHub Actions — Existing + Expand)

- [x] Backend test job (Postgres service, pytest)
- [ ] Docker build + push to Artifact Registry
- [ ] Cloud Run deploy on merge to `main`
- [ ] Cypress E2E tests against staging URL

---

## 5. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Security | Passwords bcrypt-hashed; JWTs signed HS256; no PII in logs |
| Privacy | No data shared with third parties; medical disclaimer on all AI outputs |
| Availability | 99.5% uptime target (Cloud Run auto-scaling) |
| Accessibility | WCAG 2.1 AA for frontend |
| Test coverage | 80%+ (pytest backend, Cypress E2E frontend) |

---

## 6. Out of Scope (v1)

- Push notifications / reminders
- Doctor portal / direct sharing
- Native mobile app
- Real-time streaming logs
- Multi-language support
- Prescription or clinical-grade recommendations

---

## 7. Phased Delivery Summary

| Phase | Status | Key Deliverables |
|---|---|---|
| 1 — Foundation | ✅ Complete | Auth, DB schema, CI |
| 2 — CRUD + Profile | 🔲 Next | Log endpoints, /auth/me, deps.py middleware, expanded log schema |
| 3 — Frontend | 🔲 Pending | React dashboard, log form, Recharts charts, CSV export |
| 4 — RAG Pipeline | 🔲 Pending | ETL script, Qdrant, LangChain, /insights endpoint |
| 5 — Optimize + Deploy | 🔲 Pending | TimescaleDB, GCP deploy, Docker, E2E tests |

---

## 8. Open Questions

1. **Name field:** Store `name` on User model (add migration) or drop it from the signup schema?
2. **Log entry UX:** Pure chatbot NLP input → AI parses fields, or structured form with optional free-text note?
3. **LLM choice:** HuggingFace Inference (free tier, slower) vs. Vertex AI (paid, faster) for MVP demo?
4. **TimescaleDB:** Standard Postgres sufficient for demo scale (1K events)? Or install TimescaleDB extension for resume accuracy?
5. **Auth tokens:** Add refresh tokens, or 24-hour expiry acceptable for MVP?
