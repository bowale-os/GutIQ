# Changelog

- **2026‑02‑23 – v0.1**
  - Initialized repository and base documentation.
  - FastAPI backend structure (`src/gutiq/`) with `main.py`, API routes, Pydantic models
  - Complete project documentation (`docs/`) with architecture diagrams, database schema, 6-week roadmap.
  - Scaffolded backend folder

- **2026‑03‑01 – v0.1**
  - Set up sign up and login logic with access token return
  - Updated User and Log classes
  - Connected to NeonDB
  - Set up alembic for clean database updates and migration

- **2026‑03‑02 – v0.1**
  - Set up CI with GitHub Actions
  - Updated User class, added age-range field and migrated it

- **2026‑03‑04 – v0.1**
  - Completed the onboarding route
  - Made schemas for onboarding requests and responses
  - Modelled frontend UI
  - Developed user info retrieval and updating route
  - Made schemas for user info requests and responses
  - Finished Claude integration plan

- **2026‑03‑06 – v0.1**
  - Added logging flow to frontend
  - Added log_type as enum table and updated model

- **2026‑03‑11 – v0.2**
  - Added landing/marketing screens to present GutIQ to potential users

- **2026‑03‑12 – v0.2**
  - Applied CodeRabbit review recommendations across the codebase

- **2026‑03‑15 – v0.3**
  - Built full RAG-powered Pain Relief system
  - Ingested 141 PubMed abstracts (27 targeted clinical queries) + ACG/BSG/Rome Foundation guidelines into Qdrant Cloud vector store (3,779 vectors, 6 gut conditions)
  - Clinical knowledge base cached as Parquet files for fast re-indexing without re-hitting APIs
  - `POST /pain-relief/session` — takes body region clicks (anterior/posterior body map), pain description, intensity, retrieves relevant clinical evidence, returns Claude-generated evidence-grounded relief steps
  - `POST /pain-relief/feedback` — records how well the relief steps worked per session
  - DB models and Alembic migration for pain relief sessions, retrieved chunks, and feedback
  - Pydantic schemas for full request/response validation
  - Red flag detection — escalates to "seek medical attention" for dangerous symptom patterns
  - FastEmbed (ONNX, no PyTorch/GPU) for local embeddings — lightweight and fast
