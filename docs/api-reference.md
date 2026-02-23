# API Reference
Below are the main REST endpoints for the GutIQ backend (FastAPI).

| Method | Endpoint | Description |
|--------|-----------|--------------|
| POST | /signup | Create a user account |
| POST | /login | Authenticate and return JWT |
| POST | /logs | Post a new meal/symptom log |
| GET | /logs/{user_id} | Retrieve user's log history |
| POST | /analyze | Run LangChain RAG pipeline on latest logs |
| POST | /feedback | Collect user feedback on accuracy |

Example request: {
  "meal": "Tomato soup",
  "symptom": "Heartburn", 
  "severity": 3
}
