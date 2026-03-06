# GutIQ — UI Design Tool Prompt + Product Description

---

## Product Description (for tool context)

GutIQ is a voice-first gut health tracking app for patients managing GERD, peptic ulcers, and IBS. Users speak their daily health log — what they ate, symptoms, stress, sleep — and an AI (Amazon Nova 2 Sonic) extracts and saves structured data. After 7+ days of logs, a RAG AI pipeline (LangChain + Qdrant + Nova 2 Lite) surfaces personalised, evidence-backed pattern insights like *"Your logs show heartburn peaks on high-stress days — research links stress to visceral hypersensitivity in GERD patients."*

**Target user:** Adults 25–55 with a diagnosed digestive condition. Logs on their phone, usually morning or evening. Non-technical. Wants simple, warm, reassuring — not clinical or overwhelming.

**Core value:** Replace the tedious 7-field form with a 30-second voice conversation. Make 14 days of consistent logging feel effortless.

---

## UI Design Tool Prompt

Paste this into **v0.dev**, **Lovable**, **Bolt.new**, or any AI UI builder.

---

```
Build a complete React + Tailwind CSS web app called GutIQ — a voice-first gut
health tracker for patients with GERD, ulcers, and IBS. The app uses React Router
for navigation and Axios for API calls. All API calls go to BASE_URL/api/v1.

---

DESIGN SYSTEM

Color palette (warm, approachable — NOT clinical blue):
  Primary:     #C96A2B  (burnt amber — CTAs, active states)
  Secondary:   #4A7C59  (sage green — success, healthy indicators)
  Background:  #FDFAF6  (warm off-white)
  Surface:     #FFFFFF  (cards)
  Text:        #1C1917  (near-black)
  Muted:       #78716C  (secondary text, placeholders)
  Danger:      #DC2626  (errors, high severity)
  Border:      #E7E5E4  (subtle dividers)

Typography: Inter font. Headings bold, body regular. Large tap targets (min 44px).

Border radius: rounded-2xl on cards, rounded-full on buttons and badges.

Mobile-first. Max width 430px centered on desktop (phone frame feel).
No sidebars. Bottom navigation bar on authenticated screens.

Tone: Warm, calm, encouraging. Like a health coach, not a hospital.

---

SCREENS — build all of the following:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCREEN 1: /signup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fields:
  - name (text input)
  - email (email input)
  - password (password input, min 8 chars)
  - digestive_condition (select dropdown):
      options: ["GERD", "Peptic Ulcer", "IBS", "Acid Reflux", "Other"]

On submit: POST /auth/signup
  Request body: { name, email, password }
  Response: { access_token: string, token_type: "bearer" }
  → Store access_token in localStorage as "gutiq_token"
  → After signup, navigate to /onboarding

Show inline validation errors. Show loading spinner on submit button while waiting.
Show server error (e.g. "Email already registered") as a red banner under the form.

Logo at top: stylised gut icon (swirl or intestine outline) + "GutIQ" wordmark in
primary amber. Tagline below: "Understand your gut. One voice note a day."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCREEN 2: /login
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fields: email, password
On submit: POST /auth/login
  Request body: { email, password }
  Response: { access_token: string, token_type: "bearer" }
  → Store token, navigate to /dashboard
  → 401 error: show "Incorrect email or password" inline

Link to /signup at bottom.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCREEN 3: /onboarding  (shown once after signup)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2-step card wizard. Progress dots at top.

Step 1 — "What's your main condition?"
  Large icon cards (tap to select, not a dropdown):
  - 🔥 GERD / Acid Reflux
  - 🩺 Peptic Ulcer
  - 💨 IBS
  - ❓ Not sure yet
  Selected card gets amber border + checkmark.

Step 2 — "What's your goal?"
  Large icon cards:
  - 📋 Identify my trigger foods
  - 😌 Manage stress-related symptoms
  - 💊 Track symptoms for my doctor
  - 📈 See patterns over time

"Next" button advances steps. "Get started →" on step 2 navigates to /dashboard.
This screen has no API call — store selections locally for now (will be PATCH
/auth/profile when backend endpoint is built). Save to localStorage as
"gutiq_onboarding" so it doesn't show again.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCREEN 4: /dashboard  (home screen)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Header: "Good morning, [name] 👋" (name from localStorage or "there" as fallback)
Subheading: "Day [streak] streak" with a small flame icon if streak ≥ 3 days.

─── Section: Today's Status ───
If no log today:
  Prominent card with pulsing amber mic icon:
  "Tap to log today"
  Button: "Start voice log →" → navigate to /log/voice

If log exists today:
  Green card: "✓ Logged today" with the logged_at time.
  Show 3 parsed fields as chips: e.g. [heartburn] [stress: 7] [coffee]

─── Section: 7-Day Overview ───
Recharts LineChart (use mock data if GET /logs returns empty):
  - X axis: last 7 days (Mon, Tue, Wed...)
  - Y axis: 0–10
  - Line 1: severity (red, dashed)
  - Line 2: stress_level (amber, solid)
  Small legend below. Tooltip on hover showing both values.

─── Section: Recent Logs ───
Last 3 logs as cards. Each card shows:
  - logged_at formatted as "Today 8:32am" or "Mon 7:15pm"
  - Symptom chips: small rounded badges in sage green
  - Food chips: small rounded badges in amber
  - Severity dot: colored circle (green ≤3, amber 4–6, red ≥7)
  Tap card → /log/{id}

─── Section: Insights ───
Card with gradient background (amber to sage):
  If < 7 logs: "Log 7 days to unlock AI insights"
               Progress bar: e.g. "3 / 7 days"
  If ≥ 7 logs: "Your patterns are ready"
               Button: "Analyse my patterns →" → navigate to /insights

─── Bottom disclaimer ───
Small grey text: "GutIQ provides pattern insights for informational purposes only.
Not medical advice."

On load: GET /logs?limit=3  (Authorization: Bearer {token})
  Response shape:
  [
    {
      id: string,
      user_id: string,
      raw_content: string,
      logged_at: string (ISO datetime),
      foods: string[],          // e.g. ["coffee", "spicy food"]
      symptoms: string[],       // e.g. ["heartburn", "bloating"]
      severity: number,         // 1-10
      sleep_hours: number,
      stress_level: number,     // 1-10
      exercise_min: number,
      notes: string,
      meal_time: string,        // e.g. "13:00"
      lie_down_after: boolean,
      parsed_at: string | null
    }
  ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCREEN 5: /log/voice  (voice entry — primary log method)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Full-screen focused UI. Dark background (#1C1917) with amber accents.
Back arrow top-left.

State 1 — IDLE:
  Large pulsing circle mic button (amber, 96px diameter) centered on screen.
  Label below: "Tap and speak your log"
  Hint text: "e.g. 'Had coffee and toast, feeling some heartburn,
  stress was about a 6, slept 7 hours'"

  Small text link below: "Prefer to type? →" → navigate to /log/manual

State 2 — RECORDING (mic tapped):
  Circle animates with sound-wave ripple effect (CSS animation).
  Live transcript appears below mic as text streams in.
  AI response appears as a chat bubble below transcript.
  Example exchange:
    User: "Had spicy tacos and coffee..."
    GutIQ: "Got it — what time did you eat, and did you lie down
             within 2 hours of the meal?"

  Small "Stop" button below.

  NOTE: WebSocket connection to WS /voice/stream/{session_id}
  On mount: POST /voice/start-session → { session_id, websocket_url }
  Stream mic audio via WebSocket.
  WebSocket messages come in as JSON:
    { type: "transcript", text: string }     ← user speech
    { type: "ai_response", text: string }    ← GutIQ reply
    { type: "complete", log: LogObject }     ← session done, log saved

  FALLBACK (for when voice API not yet connected):
  Show a mock conversation animation with pre-scripted exchange.
  Show "Simulate voice log" button in dev mode.

State 3 — CONFIRMED:
  Checkmark animation (green).
  Show extracted fields as a confirmation card:
    🍕 Foods: [spicy food] [coffee]
    💢 Symptoms: [heartburn] [bloating]
    📊 Severity: 7/10 (shown as a colored bar)
    😰 Stress: 6/10
    😴 Sleep: 7 hours
    🏃 Exercise: 0 min
    🕐 Meal time: 1:00 PM
    🛋️ Lay down after: No

  Two buttons:
    "Edit fields" → expand inline editable version of each field
    "Save & go home" → navigate to /dashboard

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCREEN 6: /log/manual  (structured fallback)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Form layout. All fields optional except at least one symptom or food.

Fields:
  - Foods: multi-select tag input. Pre-populated chips:
      [Coffee] [Alcohol] [Spicy food] [Fatty food] [Citrus] [Chocolate]
      [Tomatoes] [Onions] [Mint] [Bread] [Dairy] [+ Add custom]
    Tapping a chip toggles it amber. Tapping + opens text input.

  - Symptoms: multi-select tag input. Pre-populated chips:
      [Heartburn] [Bloating] [Regurgitation] [Nausea] [Stomach pain]
      [Belching] [Difficulty swallowing] [Chest discomfort] [+ Add custom]

  - Severity (1–10): Large horizontal slider. Color transitions
    green→amber→red as value increases. Current value shown large above slider.

  - Stress level (1–10): Same slider style.

  - Sleep hours: Number stepper (5.0, 5.5, 6.0 ... 10.0) with +/- buttons.

  - Exercise: Number stepper (0, 15, 30, 45, 60, 90 min)

  - Meal time: Time picker (HH:MM)

  - Lie down within 2 hours of eating?: Toggle switch (Yes / No)

  - Notes: Optional textarea, placeholder "Anything else to note?"

On submit: POST /logs
  Request body (Authorization: Bearer {token}):
  {
    foods: string[],
    symptoms: string[],
    severity: number,
    sleep_hours: number,
    stress_level: number,
    exercise_min: number,
    notes: string,
    meal_time: string,
    lie_down_after: boolean,
    raw_content: ""   // empty string for manual logs
  }
  Response: { id, logged_at, ... full log object }
  → On success: navigate to /dashboard

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCREEN 7: /log/:id  (log detail)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
On load: GET /logs/{id}  (Authorization: Bearer {token})

Show all fields in a clean read-only card layout.
Header: formatted date + time (e.g. "Monday, Mar 3 · 8:32 AM")

If raw_content is not empty, show a "Voice log" badge and the transcript
in a light grey quote block.

Fields displayed as icon + label rows:
  🍕 Foods eaten: [chip list]
  💢 Symptoms: [chip list]
  📊 Severity: colored progress bar (0–10)
  😰 Stress: colored progress bar (0–10)
  😴 Sleep: "7.0 hours"
  🏃 Exercise: "30 min" or "None"
  🕐 Meal time: "1:00 PM"
  🛋️ Lay down after: "Yes" / "No"
  📝 Notes: (if present)

Edit button top-right: makes fields inline editable.
Delete button (subtle, red text): confirmation modal before DELETE /logs/{id}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCREEN 8: /insights
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
On mount: POST /insights  { days: 14 }
  (Authorization: Bearer {token})
  Response:
  {
    insight_text: string,
    sources: [{ title: string, url: string, relevance_score: number }],
    log_summary: {
      top_symptoms: string[],
      top_foods: string[],
      avg_stress_high_symptom_days: number,
      avg_stress_low_symptom_days: number,
      avg_sleep: number,
      total_logs: number
    }
  }

Loading state:
  Full-screen amber gradient with spinning brain/sparkle icon.
  Text: "Analysing your patterns..." → "Searching clinical research..."
  Cycle these messages every 2 seconds while loading.

Loaded state:

─── Summary Stats Row ───
3 stat cards in a row:
  [Total logs: 14] [Avg sleep: 6.2h] [High stress days: 5]

─── Your Patterns ───
The insight_text rendered in a card with a subtle amber-left-border.
Use markdown-style bold for key phrases.

─── Supporting Research ───
List of source cards. Each shows:
  - Source title (truncated to 2 lines)
  - Relevance score as a small percentage badge
  - "View abstract →" link (opens in new tab)

─── Log Summary ───
Expandable section (collapsed by default):
  Top symptoms: [chip list]
  Top foods: [chip list]
  Stress correlation:
    "High-symptom days: {avg_stress_high}/10 avg stress"
    "Low-symptom days: {avg_stress_low}/10 avg stress"

─── Disclaimer ───
Box with amber border:
"⚠️ These are hypothetical patterns based on your logs and published research.
This is not medical advice. Always consult your healthcare provider."

─── Share / Export ───
Two buttons:
  "Copy insights" (copies insight_text to clipboard)
  "Download summary" (generates a simple text/HTML summary for doctor visits)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BOTTOM NAVIGATION BAR (authenticated screens only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fixed bottom bar, 4 items:
  🏠 Home        → /dashboard
  🎙️ Log         → /log/voice
  📊 History     → /history  (list of all logs, paginated GET /logs)
  🔮 Insights    → /insights

Active tab highlighted in amber. Inactive tabs in muted grey.
The Log tab is slightly larger (56px vs 48px) with a raised amber circle
background — make it feel like the primary action.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCREEN 9: /history
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
On load: GET /logs?limit=20&offset=0

Grouped by date (Today, Yesterday, This Week, Earlier).
Each log row: date/time | symptom chips | severity dot.
Infinite scroll: when user reaches bottom, fetch next 20 with &offset=20.
Tap row → /log/{id}

Empty state:
  Illustration (simple SVG: person looking at empty clipboard).
  "No logs yet. Tap the mic to get started."
  CTA button → /log/voice

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTHENTICATION GUARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Create a ProtectedRoute component that:
  1. Reads "gutiq_token" from localStorage
  2. If missing → redirect to /login
  3. Attach token to all Axios requests:
     axios.defaults.headers.common["Authorization"] = `Bearer ${token}`
  4. On 401 response from any API call → clear token, redirect to /login

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOCK DATA (use when API not connected)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Create a /src/mock/logs.ts file with 14 days of realistic demo data:
  - Days 1–5: high stress (7–9), high severity (6–8), foods: coffee + spicy
  - Days 6–10: lower stress (3–5), lower severity (2–4), foods: bland diet
  - Days 11–14: stress rises again (6–8), severity follows (5–7)
  This pattern makes the AI insight ("stress correlates with heartburn")
  visually obvious in the dashboard charts.

Create a USE_MOCK flag in /src/config.ts (default: true).
When USE_MOCK=true, all API calls return mock data instead of hitting the backend.
When USE_MOCK=false, all calls go to BASE_URL.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPONENT LIBRARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Build these as reusable components:

  <SymptomChip label="heartburn" />
    → sage green rounded badge

  <FoodChip label="coffee" />
    → amber rounded badge

  <SeverityBar value={7} />
    → horizontal bar, green→amber→red gradient based on value

  <LogCard log={LogObject} />
    → used in history + dashboard recent section

  <InsightCard text={string} sources={[]} />

  <VoicePulse active={boolean} />
    → the animated mic circle

  <MedicalDisclaimer />
    → reusable disclaimer banner, used on dashboard + insights

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROUTING STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/                → redirect to /dashboard if authed, else /login
/login           → LoginPage
/signup          → SignupPage
/onboarding      → OnboardingPage (ProtectedRoute)
/dashboard       → DashboardPage (ProtectedRoute)
/log/voice       → VoiceLogPage (ProtectedRoute)
/log/manual      → ManualLogPage (ProtectedRoute)
/log/:id         → LogDetailPage (ProtectedRoute)
/history         → HistoryPage (ProtectedRoute)
/insights        → InsightsPage (ProtectedRoute)
```

---

## Notes for When Backend Is Ready

To switch from mock to live, only two changes needed in the frontend:

1. Set `USE_MOCK = false` in `/src/config.ts`
2. Set `BASE_URL = "https://your-api-url.com/api/v1"` in `/src/config.ts`

Every screen is already wired to the correct endpoint, method, request body, and
response shape matching the FastAPI backend exactly. No structural refactoring needed.
