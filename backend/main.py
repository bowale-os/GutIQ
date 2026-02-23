from fastapi import FastAPI

app = FastAPI(title="GutIQ API v0.1.0")

@app.get("/")
async def root():
    return {"message": "GutIQ Backend - Ready for chatbot logging!"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
