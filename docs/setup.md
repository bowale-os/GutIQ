# Local Setup Guide

Follow these steps to run GutIQ locally.

## Requirements
- **Python ≥ 3.12** (recommended for best performance/stability)
- **FastAPI ≥ 0.115.0** (latest stable release)
- **PostgreSQL 14+** (TimescaleDB extension optional)
- **Node.js ≥ 18** (for React frontend)
- **Docker** (optional, for Qdrant + DB) or online qdrant and db options
 

## Installation
`
git clone https://github.com/bowale-os/gutiq.git
cd gutiq
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install
npm start
`

## Environment Variables
Create a .env file in the backend directory:

`
DATABASE_URL=postgresql://user:password@localhost:5432/gutiq
JWT_SECRET=your_secret_key
GEMINI_API_KEY=your_api_key
`