# app/ai-llm/transcriber.py

import httpx
from app.core.config import settings
from fastapi import HTTPException

async def llm_transcribe(audio_bytes: bytes) -> str:
    """
    Transcribe audio using Deepgram Nova-3.
    """
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.deepgram.com/v1/listen",
            headers={
                "Authorization": f"Token {settings.DEEPGRAM_API_KEY}",
                "Content-Type": "audio/webm",
            },
            content=audio_bytes,
            params={
                "model": "nova-3",
                "smart_format": "true",
                "punctuate": "true",
            },
            timeout=30.0,
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {response.text}"
        )

    result = response.json()
    
    try:
        transcript = (
            result["results"]["channels"][0]
            ["alternatives"][0]
            ["transcript"]
        )
    except (KeyError, IndexError):
        raise HTTPException(
            status_code=422,
            detail="Audio contained no recognizable speech"
        )

    if not transcript.strip():
        raise HTTPException(
            status_code=422,
            detail="Audio contained no recognizable speech"
        )

    return transcript.strip()