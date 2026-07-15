"""FastAPI WebSocket backend: one connection = one Miles Live session.

Browser frames (JSON):
  {"type":"audio", "data":"<base64 PCM16 LE @ 16000 Hz>"}
  {"type":"text",  "text":"..."}

Server events forwarded as JSON (see app/agent.py events()):
  {"type":"audio", "data":"<base64 PCM16 LE @ 24000 Hz>", "mime_type":"audio/pcm;rate=24000"}
  {"type":"transcript", "role":"user"|"miles", "text":"...", "final":bool}
  {"type":"tool", "tool":..., "ok":bool, "payload":..., "phase":..., "config":...}
  {"type":"interrupted"}
  {"type":"turn_complete", "phase":...}
  {"type":"error", "message":"..."}

Run:  uvicorn app.web:app --reload --port 8000
"""
from __future__ import annotations

import asyncio
import base64
import json
import traceback

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .agent import Miles

app = FastAPI(title="Miles")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _pump_events(ws: WebSocket, bot: Miles) -> None:
    try:
        async for event in bot.events():
            await ws.send_json(event)
    except Exception as exc:  # noqa: BLE001
        traceback.print_exc()
        try:
            await ws.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass


async def _pump_inbound(ws: WebSocket, bot: Miles) -> None:
    while True:
        msg = await ws.receive()
        if msg.get("type") == "websocket.disconnect":
            raise WebSocketDisconnect()
        text = msg.get("text")
        if not text:
            continue
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            # Plain text fallback (legacy).
            await bot.send_text(text)
            continue
        kind = data.get("type")
        try:
            if kind == "audio":
                blob = base64.b64decode(data.get("data", ""))
                if blob:
                    await bot.send_audio(blob)
            elif kind == "text":
                t = (data.get("text") or "").strip()
                if t:
                    await bot.send_text(t)
        except Exception:
            traceback.print_exc()
            raise


@app.websocket("/ws")
async def chat(ws: WebSocket) -> None:
    await ws.accept()
    try:
        async with Miles() as bot:
            outbound = asyncio.create_task(_pump_events(ws, bot))
            inbound = asyncio.create_task(_pump_inbound(ws, bot))
            done, pending = await asyncio.wait(
                {outbound, inbound}, return_when=asyncio.FIRST_COMPLETED,
            )
            for t in pending:
                t.cancel()
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001
        traceback.print_exc()
        try:
            await ws.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass
