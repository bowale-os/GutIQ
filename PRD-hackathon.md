# GutIQ — Amazon Nova AI Hackathon PRD

**Version:** 2.0 (Hackathon Edition)
**Deadline:** March 16, 2026 — 14 days
**Submission Category:** Voice AI (primary) + Agentic AI (secondary)
**Stack:** FastAPI · PostgreSQL · Amazon Nova 2 Sonic · Amazon Nova 2 Lite · LangChain · Qdrant · React · AWS

---

## 1. Hackathon Strategy

### Why GutIQ Wins

| Judging Criterion | Weight | Our Angle |
|---|---|---|
| Technical Implementation | 60% | Nova 2 Sonic (voice → structured log) + Nova 2 Lite (agentic reasoning over logs + clinical KB) — two Nova models, clean AWS architecture |
| Community Impact | 20% | 20M+ GERD patients in the US alone; real, measurable use case with citation-backed research |
| Creativity & Innovation | 20% | Voice-first symptom logging is a novel UX for chronic condition management; RAG insight grounding in PubMed evidence is differentiated |

### Nova Models Used

| Model | Role in GutIQ |
|---|---|
| **Nova 2 Sonic** | Speech-to-speech conversational log entry. User speaks naturally, Sonic extracts structured fields (foods, symptoms, severity, stress, sleep) via multi-turn dialogue |
| **Nova 2 Lite** | Agentic reasoning for insights. Given user log summary + retrieved clinical abstracts, generates non-medical pattern insights with citations |

### Category: Voice AI
The voice log flow is the demo centerpiece — 30-second voice entry vs. filling a 7-field form. This is what judges will remember.

---

## 2. The Pivot: GCP → AWS

| Layer | Original Plan | Hackathon Version |
|---|---|---|
| LLM | HuggingFace Inference (Phi-3) / Vertex AI | **Amazon Nova 2 Lite** via Bedrock — same LangChain chain, swap the LLM |
| Vector DB | Qdrant (GCP-hosted) | **Qdrant** — keep it, host on AWS App Runner or Qdrant Cloud |
| RAG Framework | LangChain RetrievalQA | **LangChain RetrievalQA** — unchanged |
| Embeddings | HuggingFace `all-MiniLM-L6-v2` | Keep, or swap to **Amazon Titan Embeddings** for full AWS story |
| Voice input | None planned | **Amazon Nova 2 Sonic** — new, the demo centrepiece |
| Hosting | GCP Cloud Run | **AWS App Runner** |
| Database | GCP Cloud SQL | Neon PostgreSQL (already working, keep it) |

> **Key insight:** LangChain and Qdrant stay exactly as designed. The only change is swapping the LLM from HuggingFace/Vertex to Nova 2 Lite — one line in the LangChain chain config. The hackathon explicitly lists LangChain as an approved framework.

> **Pragmatic note:** Neon PostgreSQL is already working and free. Keep it for the 14-day sprint — judges care about Nova integration, not where Postgres runs.

---

## 3. The Demo Flow (3-Minute Video Script)

```
0:00 — Problem hook: "20 million Americans have GERD. Tracking triggers is
       the #1 thing doctors recommend. Nobody does it because it's too tedious."

0:30 — Sign up → onboarding (digestive condition: GERD, goal: identify triggers)

1:00 — VOICE LOG: User taps mic, speaks naturally:
       "Had spicy tacos and two coffees for lunch. Feeling heartburn, maybe a 7
       out of 10. Stressed today, work deadline. Slept around 5 hours last night."

       Nova 2 Sonic responds conversationally:
       "Got it — did you exercise today? And roughly what time did you eat lunch?"

       User: "No exercise, ate around 1pm"

       Sonic: "Thanks, I've logged that. Stay consistent and I'll spot your patterns."

       → Structured log saved to DB: foods=[spicy_food, coffee], symptoms=[heartburn],
         severity=7, stress=7, sleep=5.0, exercise=0

1:30 — DASHBOARD: Show 14-day trend charts (simulated data):
       - Heartburn severity peaks correlate with stress spikes
       - Coffee appears in 80% of high-severity days

2:00 — AI INSIGHTS: User clicks "Analyse My Patterns"
       Nova 2 Lite (agentic) reasons over their logs + 3 retrieved PubMed abstracts:
       "Your logs show heartburn severity averages 6.8 on days with stress ≥7,
       versus 3.2 on lower-stress days. Research on visceral hypersensitivity
       suggests stress amplifies esophageal sensitivity — this may explain the
       pattern in your data. [Source: PMC10635461]"

2:30 — Export log as PDF for doctor appointment. Medical disclaimer shown.

2:50 — Call to action: "Built with Amazon Nova 2 Sonic + Nova 2 Lite on AWS"
```

---

## 4. What's Already Built (Keep As-Is)

- Auth (signup, login, JWT) ✅
- PostgreSQL schema (users + logs tables) ✅
- Alembic migrations ✅
- FastAPI async structure ✅
- GitHub Actions CI ✅

---

## 5. 14-Day Build Plan

### Days 1–2: Log Schema + CRUD Endpoints

**Fix the schema gap first** — everything else depends on complete log data.

**Alembic migration needed:**
```sql
ALTER TABLE logs ADD COLUMN foods TEXT[];
ALTER TABLE logs ADD COLUMN symptoms TEXT[];
ALTER TABLE logs ADD COLUMN severity INT;
ALTER TABLE logs ADD COLUMN sleep_hours FLOAT;
ALTER TABLE logs ADD COLUMN stress_level INT;
ALTER TABLE logs ADD COLUMN exercise_min INT;
ALTER TABLE logs ADD COLUMN notes TEXT;
ALTER TABLE logs ADD COLUMN meal_time TIME;         -- GERD-specific
ALTER TABLE logs ADD COLUMN lie_down_after BOOLEAN; -- GERD-specific
ALTER TABLE logs ADD COLUMN parsed_at TIMESTAMPTZ;
```

**Endpoints to build:**

| Method | Path | Description |
|---|---|---|
| POST | `/logs` | Create log (structured fields OR raw_content) |
| GET | `/logs` | List user's logs, paginated + filterable by date |
| GET | `/logs/{id}` | Single log |
| GET | `/auth/me` | Current user profile |

**Auth middleware:** Implement `get_current_user` in `app/api/deps.py`

---

### Days 3–5: Nova 2 Sonic Voice Integration

This is the technical centrepiece. Nova 2 Sonic is a **speech-to-speech** model accessed via AWS Bedrock streaming API.

**Architecture:**
```
Browser mic → WebSocket → FastAPI /voice/log endpoint
  → stream audio to Nova 2 Sonic (Bedrock)
  → Sonic responds with voice + structured JSON extraction
  → parsed fields saved to logs table
  → Sonic audio response streamed back to browser
```

**Endpoint:**
```
POST /voice/start-session
→ Returns: { session_id, websocket_url }

WS  /voice/stream/{session_id}
→ Bidirectional: audio in, audio + JSON out
```

**Nova 2 Sonic system prompt:**
```
You are GutIQ, a friendly gut health logging assistant for a patient with {condition}.
Your job: have a brief conversational exchange to collect today's health log.
Extract: foods eaten, symptoms experienced, severity (1-10), stress level (1-10),
sleep hours, exercise minutes, meal time, and whether they lay down within 2 hours of eating.
Ask follow-up questions naturally if fields are missing.
When you have enough, say "All logged!" and return a JSON block with the extracted fields.
Never give medical advice. Speak warmly and in plain language.
```

**Fallback for demo:** If Sonic WebSocket is complex to demo live, show pre-recorded interaction + show the structured JSON that gets saved.

---

### Days 6–8: RAG Insights — LangChain + Qdrant + Nova 2 Lite

**Architecture:**
```
POST /insights { days: 14 }
  1. Fetch user's last N logs from PostgreSQL
  2. Compute log summary: top symptoms, top foods, avg stress, avg sleep,
     stress-severity correlation
  3. LangChain RetrievalQA:
       - Retriever: Qdrant (top-5 semantically similar clinical abstracts)
       - LLM: Nova 2 Lite via Amazon Bedrock
  4. Return: { insight_text, sources[], log_summary }
```

**LangChain + Qdrant + Nova 2 Lite wiring:**
```python
from langchain_aws import BedrockLLM
from langchain_community.vectorstores import Qdrant
from langchain.chains import RetrievalQA
from langchain_huggingface import HuggingFaceEmbeddings

# LLM: Nova 2 Lite via Bedrock (one-line swap from HuggingFace)
llm = BedrockLLM(
    model_id="amazon.nova-lite-v1:0",
    region_name="us-east-1"
)

# Vector store: Qdrant (unchanged from original plan)
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
qdrant = Qdrant.from_existing_collection(
    embeddings=embeddings,
    collection_name="gut_docs",
    url=settings.QDRANT_URL
)

# Chain: RetrievalQA (unchanged)
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=qdrant.as_retriever(search_kwargs={"k": 5}),
    return_source_documents=True
)
```

**ETL script (run once to populate Qdrant):**
```python
# scripts/etl.py
queries = [
    "heartburn triggers diet stress GERD",
    "peptic ulcer bloating sleep exercise patterns",
    "visceral hypersensitivity stress esophageal"
]
# 1. Fetch 500+ PubMed abstracts via EUtils API
# 2. RecursiveCharacterTextSplitter(chunk_size=500)
# 3. Embed with all-MiniLM-L6-v2
# 4. Upsert to Qdrant collection "gut_docs"
```

**Nova 2 Lite prompt (inside LangChain chain):**
```python
system_prompt = """
You are a non-medical health pattern analyst for a gut health app.
Given a user's log summary and relevant clinical research excerpts,
identify 2-3 hypothetical patterns using language like "your logs suggest..."
and "research indicates...". Never give medical advice or diagnoses.
Always end with: "Please consult your doctor for medical guidance."
"""
query = f"""
User: {condition} patient. Goal: {goal}.
Log summary (last {days} days):
  - Top symptoms: {top_symptoms}
  - Top foods before symptoms: {top_foods}
  - Avg stress on high-symptom days: {avg_stress_high}/10
  - Avg stress on low-symptom days: {avg_stress_low}/10
  - Avg sleep: {avg_sleep} hours

Find patterns in this data supported by the retrieved clinical context.
"""
```

---

### Days 9–11: React Frontend (MVP Only)

**4 screens needed for the demo:**

| Screen | Components |
|---|---|
| `/login` + `/signup` | Simple forms, condition selector on signup |
| `/log/voice` | Mic button, live transcript display, confirmation of parsed fields |
| `/dashboard` | 2 Recharts (heartburn severity over time, stress vs severity scatter), last 5 logs table, "Analyse Patterns" button |
| `/insights` | Insight card with text + source citations, medical disclaimer |

**Don't build:** settings page, export, full log history, pagination — cut scope ruthlessly.

---

### Days 12–13: Integration + Demo Data

- Seed 14 days of simulated logs for demo account (`demo@gutiq.com`)
- Stress and heartburn severity intentionally correlated in seed data so insights are compelling
- Test voice → log → insight full flow end to end
- Record 3-minute demo video

---

### Day 14: Submission

**Devpost submission checklist:**
- [ ] Text description (emphasise Nova 2 Sonic + Nova 2 Lite, community impact)
- [ ] Demo video (~3 min, hashtag `#AmazonNova`)
- [ ] GitHub repo (public or share with `testing@devpost.com` + `Amazon-Nova-hackathon@amazon.com`)
- [ ] Blog post on builder.aws.com (bonus $200 AWS credits × 100 winners — easy win)

---

## 6. AWS Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│          (Vite + Tailwind, hosted on S3/CloudFront)      │
└──────────────┬──────────────────────────────────────────┘
               │ REST + WebSocket
┌──────────────▼──────────────────────────────────────────┐
│              FastAPI Backend (AWS App Runner)             │
│                                                          │
│  /auth/*     JWT auth (existing)                         │
│  /logs/*     CRUD (Days 1-2)                             │
│  /voice/*    Nova 2 Sonic WebSocket relay (Days 3-5)     │
│  /insights   LangChain RetrievalQA → Nova 2 Lite         │
└────┬──────────────┬──────────────────┬───────────────────┘
     │              │                  │
┌────▼────┐  ┌──────▼──────┐  ┌───────▼──────────────────┐
│Postgres │  │Amazon Bedrock│  │  Qdrant Vector DB         │
│  (Neon) │  │              │  │  (Qdrant Cloud or         │
│         │  │ Nova 2 Sonic │  │   self-hosted App Runner) │
│         │  │ Nova 2 Lite  │  │  500+ PubMed chunks       │
└─────────┘  └─────────────┘  │  LangChain retriever       │
                               └──────────────────────────-┘
```

---

## 7. Scope Cuts (Things to Drop for 14 Days)

| Cut | Reason |
|---|---|
| TimescaleDB hypertables | Standard Postgres is fine for demo scale; adds setup complexity |
| Redis caching | Premature for hackathon |
| CSV / PDF export | Nice to have, not demo-critical |
| PATCH/DELETE log endpoints | Not needed for demo flow |
| Cypress E2E tests | No time; manual testing sufficient |
| Refresh tokens | 24-hour JWT is fine |
| `/auth/profile` PATCH | Not needed for demo |

---

## 8. Differentiators for Judges

1. **Two Nova models in one app** — Sonic for input, Lite for reasoning. Not just "I used an LLM", but a voice-to-structured-data-to-insight pipeline.

2. **Real clinical grounding** — Insights cite actual PubMed PMC IDs. Not hallucinated health advice.

3. **Measurable community impact** — GERD affects 20% of US adults. Quote the 30–45% symptom reduction stat from tracking apps in the pitch.

4. **Conversation design** — Sonic's multi-turn extraction (asking follow-ups) shows thoughtful prompt engineering, not just transcription.

5. **Medical safety** — Explicit non-prescriptive language + disclaimer. Shows maturity. Judges who are AWS health/enterprise folks will notice.

---

## 9. Blog Post Outline (Bonus Prize)

**Title:** *"How I Built a Voice-First Gut Health Tracker with Amazon Nova in 14 Days"*

Sections:
1. The problem: 20M GERD patients who don't track triggers
2. Why voice input matters for chronic condition tracking
3. Technical deep-dive: Nova 2 Sonic for conversational data extraction
4. Grounding AI insights in PubMed research with LangChain + Qdrant + Nova 2 Lite
5. Community impact: what consistent tracking does for GERD patients
6. How to adopt: open source repo, steps to deploy on AWS

Publish on `builder.aws.com` before March 16 deadline.

---

## 10. Updated Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python 3.11) |
| Database | PostgreSQL (Neon, or RDS Postgres) |
| ORM | SQLModel + Alembic |
| Voice AI | Amazon Nova 2 Sonic (AWS Bedrock) |
| RAG LLM | Amazon Nova 2 Lite (AWS Bedrock, via LangChain) |
| RAG Framework | LangChain RetrievalQA |
| Vector DB | Qdrant (Qdrant Cloud or self-hosted on App Runner) |
| Embeddings | HuggingFace `sentence-transformers/all-MiniLM-L6-v2` |
| Clinical KB | 500+ PubMed/NHS abstracts (ETL script → Qdrant) |
| Auth | JWT (existing, python-jose + bcrypt) |
| Frontend | React + Vite + Tailwind + Recharts |
| Hosting | AWS App Runner (API) + S3/CloudFront (frontend) |
| CI | GitHub Actions (existing) |
