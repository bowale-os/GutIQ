# User Flow

This document outlines the end‑to‑end flow for a GutIQ user.

```mermaid
flowchart TD
    A[Sign Up / Log In] --> B[Select Digestive Issues/ Current discomfo]
    B --> C[Log Meals / Symptoms]
    C --> D[Submit Logs]
    D --> E[FastAPI sends data to LangChain]
    E --> F[Retrieve medical evidence & generate insight]
    F --> G[Return personalized recommendations]
    G --> H[User views dashboard & feedback]
```

**Summary:**  
The user signs in, logs data, runs analysis, receives insights and maybe posture advice with supporting medical explanations, and provides feedback for system improvement.
