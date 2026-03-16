// src/api/gutCheck.js
//
// GutCheck SSE client.
//
// askGutCheck() opens a streaming connection to POST /gutcheck/ask and
// fires callbacks as events arrive. The caller (GutCheck.jsx) owns all
// state — this module is purely transport.
//
// Callbacks:
//   onSessionId(id)   — fired once, first event. Store and send back next turn.
//   onToolStart(tool) — Claude is calling a tool (show spinner)
//   onToolDone(tool)  — tool finished (mark done)
//   onChunk(text)     — append text to the streamed answer
//   onDone()          — stream complete
//   onError(message)  — something went wrong

import { BASE, getToken } from './client';

export async function askGutCheck(question, sessionId, callbacks) {
  const { onSessionId, onToolStart, onToolDone, onChunk, onDone, onError } = callbacks;

  let response;
  try {
    response = await fetch(`${BASE}/gutcheck/ask`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        question,
        session_id: sessionId ?? null,
      }),
    });
  } catch (err) {
    onError?.('Could not reach the server. Check your connection.');
    return;
  }

  if (!response.ok) {
    onError?.(`Server error ${response.status}. Please try again.`);
    return;
  }

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Buffer incoming bytes — a single read() may contain partial lines
      buffer += decoder.decode(value, { stream: true });

      // Process every complete SSE line in the buffer
      const lines = buffer.split('\n');
      buffer = lines.pop(); // last item may be incomplete — keep it

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;

        let event;
        try {
          event = JSON.parse(line.slice(5).trim());
        } catch {
          continue; // malformed line — skip
        }

        switch (event.type) {
          case 'session_id':    onSessionId?.(event.id);     break;
          case 'tool_start':    onToolStart?.(event.tool);   break;
          case 'tool_done':     onToolDone?.(event.tool);    break;
          case 'answer_chunk':  onChunk?.(event.text);       break;
          case 'done':          onDone?.();                  break;
          default:              break;
        }
      }
    }
  } catch (err) {
    onError?.('Stream interrupted. Please try again.');
  }
}
