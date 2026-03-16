# GutIQ Changelog

All notable changes to this project are documented here.
Format: `[date] — description` grouped by feature area.

---

## 2026-03-16 — Doctor Export rebuild (PDF + share link + QR code)

### Frontend

**New files**
- `gutiq-app/src/utils/exportStats.js` — Pure computation layer split out of Export.jsx. Contains `computeStats`, `detectPatterns`, `computeTrend`, `buildSummary`. No React, no side effects — takes raw log arrays, returns plain objects. Patterns use food correlation logic (high-rate ≥ 0.9 for Strong, ≥ 0.6 for Moderate) and sleep co-occurrence detection.
- `gutiq-app/src/utils/exportPdf.js` *(in progress)* — jsPDF + jspdf-autotable PDF generation extracted from Export.jsx. Draws the full A4 report: header strip, 4 stat boxes, pattern rows with strength chips, pain level trend bars, AI summary block, full log table, disclaimer footer.

**Modified files**
- `gutiq-app/src/screens/Export.jsx` — Full rebuild. Now imports from `exportStats.js` (computations) and `exportPdf.js` (PDF). Added real `generatePDF()` via jsPDF — downloads a formatted A4 PDF with all report sections. Added `createShareLink` integration: generates a 7-day secure link, displays it with a copy button, renders a QR code via `qrcode.react` so a doctor can scan it directly. Removed doctor name input field. Replaced "Top trigger" stat (misleading — was just most-logged food) with "High Pain Days" stat with proper correlation-based pattern detection. Stress column changed from emoji to Low/Moderate/High text labels. All "severity" language changed to "pain level".

**New packages installed**
- `jspdf@4.2.0` — PDF generation
- `jspdf-autotable@5.0.7` — table rendering in PDF
- `qrcode.react@4.2.0` — QR code component

### Bug fixes / polish
- `index.html` — `body { background: #0A0C0F }` (black) changed to `#FAF7F2` (warm cream) so overscroll on all pages no longer shows a dark flash.
- Removed "severity" label everywhere in the export UI, replaced with "pain level".

---

## 2026-03-16 — GutCheck AI Agent (full implementation)

### Backend

**New files**
- `backend/app/models/gut_check.py` — Two new DB tables: `GutCheckSession` (one per conversation) and `GutCheckMessage` (one row per turn). Sessions persist across turns so conversation history is never lost.
- `backend/app/ai_llm/gut_check_prompt.py` — System prompt builder. Injects two context layers: a long-term health profile summary and the last 30 days of raw logs. Also contains `format_log()` which converts Log ORM objects into clean dicts Claude can reason over.
- `backend/app/ai_llm/gut_check_tools.py` — Two tool implementations: `query_logs` (full history search with synonym expansion) and `fetch_research` (Qdrant semantic search). Includes `FOOD_SYNONYMS` and `SYMPTOM_SYNONYMS` dictionaries so "coffee" matches espresso/latte/americano etc.
- `backend/app/ai_llm/gut_check_gen.py` — The agent loop. Streams SSE events (`session_id`, `tool_start`, `tool_done`, `answer_chunk`, `done`). Parallel tool execution via `asyncio.gather`. Saves both turns to DB after each exchange.
- `backend/app/ai_llm/gut_check_profile.py` — Background health profile regeneration. Called every 5 new logs. Claude compresses full log history into a ~400 token profile stored on the User row. Updates incrementally (feeds existing profile + new logs only).
- `backend/app/api/v1/gut_check.py` — Two endpoints: `POST /gutcheck/ask` (SSE stream) and `POST /gutcheck/profile/regenerate` (manual rebuild trigger for dev/testing).

**Modified files**
- `backend/app/models/user.py` — Added `health_profile_summary`, `profile_updated_at`, `logs_since_last_profile_change` fields.
- `backend/app/db/__init__.py` — Registered `GutCheckSession` and `GutCheckMessage` for auto table creation.
- `backend/app/api/v1/__init__.py` — Registered `gut_check` router at `/gutcheck`.
- `backend/app/api/v1/log.py` — Profile background task wired into `POST /log/create-log`. Counter increments on every save; triggers regeneration at 5.

### Frontend

**New files**
- `gutiq-app/src/api/gutCheck.js` — SSE client. Opens stream, buffers partial lines, parses events, fires typed callbacks (`onSessionId`, `onToolStart`, `onToolDone`, `onChunk`, `onDone`, `onError`).

**Modified files**
- `gutiq-app/src/screens/GutCheck.jsx` — `runConversation()` replaced with real SSE call. Demo mode preserved (uses `DEMO_RESPONSES` + animated fake tool states). Added `sessionId` state persisted across turns for multi-turn conversation memory. Added `error` state displayed when stream fails. Added `ThinkingBubble` component: pulsing orange dot, 8 rotating thoughts cycling every 2s via `setInterval`, tool call states shown below divider only when tools fire. Installed `react-markdown` to render Claude's markdown responses (bold, lists, headers) as formatted HTML instead of raw text. Fixed "Previous gut checks" section always rendering mock data — now shows live `conversation` state in real mode, mock only in demo, hidden when empty. Avatar initial fixed from "N" to "T" (Tiwa). System prompt updated to instruct Claude to write in plain flowing prose without markdown formatting. Duplicate React key `Mar 15` in Dashboard fixed: `key={log.date}` → `key={log.id ?? \`${log.date}-${i}\`}`.
- `gutiq-app/src/App.jsx` — Passes `demoMode` prop to `GutCheck`.

---

## 2026-03-15 — Pain Relief (Tiwa) — demo mode support

- `PainRelief.jsx` — Added `demoMode` prop. In demo mode: skips API call, loads `MOCK_RELIEF` after 1.8s simulated latency, skips feedback submission.
- `App.jsx` — Passes `demoMode` to `PainRelief`.

---

## 2026-03-14 — Pain Relief — structured relief experience

### Backend
- `schemas/pain_relief.py` — Added `PrimaryAction` and `StructuredRelief` Pydantic models. Response now carries structured JSON instead of markdown steps.
- `ai_llm/pain_relief_gen.py` — Rewrote generation to return `StructuredRelief`. Added `_extract_json()` helper with markdown fence stripping and regex fallback. MAX_TOKENS 800 → 1500.
- `api/v1/pain_relief.py` — Normal response returns `structured=StructuredRelief`; red flag returns `reply=reason`.

### Frontend
- `PainRelief.jsx` — Full rewrite. Multi-view flow: intake → loading → relief → done → seekcare → redflag. Breathing circle animation as primary UX anchor. Primary action + maintain/avoid/alternatives structure. Session timer. Star rating on done screen. Voice input via Web Speech API.
- `App.jsx` — Added `breatheExpand` and `breatheSlow` CSS keyframes to `GLOBAL_STYLES`. Registered `pain_relief` screen.
- `Dashboard.jsx` — Added Tiwa pain relief entry card with `HeartPulse` icon.
- `src/api/painRelief.js` — New API module: `submitPainSession` and `submitPainFeedback`.

---

## Earlier — Core platform

- Auth (login, signup, JWT)
- Onboarding wizard (condition, goal, age range)
- Log entry (voice + text, Claude parse, preview/confirm flow)
- Dashboard (sparkline chart, recent logs, stats)
- Export (14-day summary for doctor sharing)
- Profile (editable user settings)
- GutCheck UI shell (chat interface, tool state animation, streaming text — previously mock only)
- Lifestyles (community tips and challenges — currently mock data)
