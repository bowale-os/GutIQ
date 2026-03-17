# GutIQ — System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  React Frontend (Vite)                                          │
│                                                                 │
│  Login → Onboarding → Dashboard                                 │
│                           │                                     │
│              ┌────────────┼────────────────┐                    │
│              ▼            ▼                ▼                    │
│         LogEntry      GutCheck        PainRelief                │
│         (voice/text)  (AI chat)       (Tiwa relief)             │
│              │            │                │                    │
│              │         SSE stream          │                    │
└──────────────┼────────────┼────────────────┼────────────────────┘
               │  REST      │  SSE           │  REST
               ▼            ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│  FastAPI Backend                                                │
│                                                                 │
│  /auth          /log            /gutcheck       /pain-relief    │
│  signup/login   preview         ask (SSE)       session         │
│                 create-log      profile/regen   feedback        │
│                    │                │                │          │
│                    ▼                ▼                ▼          │
│              parse_with_llm   gut_check_gen   pain_relief_gen   │
│              (Claude)         (agent loop)    (structured JSON) │
│                                    │                │          │
│                              gut_check_tools   retriever.py    │
│                              query_logs        red flag check  │
│                              fetch_research    condition map   │
│                                    │           Qdrant search   │
└────────────────────────────────────┼───────────────┼───────────┘
                                     │               │
               ┌─────────────────────┤               │
               ▼                     ▼               ▼
        ┌────────────┐      ┌──────────────┐  ┌────────────┐
        │ PostgreSQL │      │ Claude Haiku │  │  Qdrant    │
        │            │      │ (Anthropic)  │  │  Cloud     │
        │ users      │      │              │  │            │
        │ logs       │      │ - log parse  │  │ clinical   │
        │ food/sympt │      │ - pain relief│  │ knowledge  │
        │ wellness   │      │ - gutcheck   │  │ base       │
        │ gut_check  │      │   agent loop │  │ (PubMed    │
        │ pain_relief│      │ - profile    │  │  NHS docs) │
        └────────────┘      └──────────────┘  └────────────┘
```

## Two AI pipelines

### Pain Relief — single-turn, structured output
User describes symptoms → retrieve clinical evidence from Qdrant → Claude returns structured JSON → frontend renders guided experience. No streaming. One round trip.

### GutCheck — multi-turn agent loop, SSE streaming
User asks a question → inject 30-day raw logs + health profile into Claude context → Claude reasons directly or calls tools → stream answer back as SSE events. Multi-turn: conversation history loaded from DB on every request. Tools fire only when context can't answer the question.

## GutCheck tool routing

```
Question type                          → How answered
─────────────────────────────────────────────────────────────────
"Why was Tuesday bad?"                 → Raw logs in context (no tool)
"Am I getting better over time?"       → Profile in context (no tool)
"Every time coffee caused heartburn"   → query_logs tool → DB query
"Why does stress affect my gut?"       → fetch_research tool → Qdrant
"Coffee + stress together?"            → query_logs + fetch_research (parallel)
```

## Health profile maintenance

Every 5 logs saved → background task → Claude reads existing profile + last 20 new logs → updates compact summary (~400 tokens) stored on User row → injected into every GutCheck turn automatically.

This keeps long-term insight available regardless of how many total logs a user has, while keeping the context window cost fixed.
