# Technical Design

## RAG Pipeline Overview
1. Embed medical documents using an embedding model.
2. Store vectors in Qdrant.
3. Receive user context from FastAPI.
4. Retrieve top‑k relevant docs via vector similarity.
5. Construct final prompt via LangChain and pass to Gemini/OpenAI model.
6. Return digestible explanation to frontend.

## Database Design
- **users**
- **food_logs**
- **symptom_logs**

- **feedback**

Each table includes timestamps for time‑series analysis with TimescaleDB.
