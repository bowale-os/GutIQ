# Changelog

- **2026-03-07 - v0.1**
  - Hardened auth and token validation paths to handle malformed token `sub` values, corrupt password hashes, and duplicate-email race conditions without unhandled crashes.
  - Fixed async session usage in user profile updates and added DB error handling/rollback safeguards in user and onboarding writes.
  - Added missing-user guard for onboarding completion to prevent state-desync attribute errors when records disappear mid-flow.
  - Stabilized log schema parsing by safely handling malformed JSON in `parsed_foods`/`parsed_symptoms`.
  - Reworked log preview route validation to handle mismatched user IDs, empty text/audio payloads, and missing preview response model references safely.

- **2026‑02‑23 – v0.1**
  - Initialized repository and base documentation.
  - FastAPI backend structure (`src/gutiq/`) with `main.py`, API routes, Pydantic models
  - Complete project documentation (`docs/`) with architecture diagrams, database schema, 6-week roadmap.
  -Scaffolded backend folder

- **2026‑03‑01 – v0.1**
  - Set up sign up and login logic with access token return
  - Updated User and Log classes
  - Connected to NeonDB
  -Set up alembic for clean database updates and migration


- **2026‑03‑02 – v0.1**
  - I set up CI with github actions.
  - Update User class, added age-range field and migrated it.


- **2026‑03‑04 – v0.1**
  - I completed the onboarding route
  - Made schemas for onboarding requests and responses.

 **2026‑03‑04 – v0.1**
  - modeled great looking ui and frontend with claude
  - developed user info retrieval and updating route
  - Made schemas for user info requests and response.
  - finished claude plan..
  


 **2026‑03‑06 – v0.1**
  - added logging flow to frontend
  - added log_type as enum table, and updated model
  

