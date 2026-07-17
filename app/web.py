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

Access: if MILES_PASSCODE is set, a shared-passcode gate protects every route and the
WebSocket (cookie-based, verified with a constant-time compare). Unset (local dev) = open.

Run:  uvicorn app.web:app --reload --port 8000
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import traceback
from pathlib import Path
from urllib.parse import parse_qs

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .agent import Miles

app = FastAPI(title="Miles")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------- passcode gate
# A shared-passcode gate for pitch demos. The Cloud Run service is publicly reachable, but the
# app refuses every page and WebSocket until the passcode is entered. The passcode is injected
# via MILES_PASSCODE (from Secret Manager) — never stored in the repo or image. The auth cookie
# is an HMAC over a constant keyed by the passcode, so it's stateless (works across instances)
# and never contains the passcode itself.
MILES_PASSCODE = os.environ.get("MILES_PASSCODE")
COOKIE_NAME = "miles_auth"
COOKIE_MAX_AGE = 8 * 60 * 60  # 8 hours

# Built frontend directory (single-service deploy). Referenced by both the gate (which streams
# large models from it) and the static mount at the bottom of the file.
_STATIC_DIR = os.environ.get("MILES_STATIC_DIR")
_CHUNK = 1024 * 1024  # 1 MiB


def _iterfile(path: Path):
    with path.open("rb") as f:
        while chunk := f.read(_CHUNK):
            yield chunk


def _expected_token() -> str:
    return hmac.new((MILES_PASSCODE or "").encode(), b"miles-authed", hashlib.sha256).hexdigest()


def _is_authed(cookies) -> bool:
    if not MILES_PASSCODE:
        return True  # gate disabled (local dev)
    tok = cookies.get(COOKIE_NAME)
    return bool(tok) and hmac.compare_digest(tok, _expected_token())


_LOGIN_HTML = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Miles — Enter passcode</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1119;
    color:#e8eef5;font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
  .card{width:min(380px,90vw);background:#141c27;border:1px solid #26313f;border-radius:16px;
    padding:36px 32px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
  .brand{font-style:italic;font-weight:800;letter-spacing:.02em;color:#4a90ff;font-size:1.5rem;margin:0 0 4px}
  p{color:#adb9c7;margin:0 0 22px;font-size:.92rem}
  label{display:block;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:#7e8a98;margin:0 0 8px}
  input{width:100%;padding:12px 14px;border-radius:9px;border:1px solid #35414f;background:#0b1119;
    color:#e8eef5;font-size:1rem;outline:none}
  input:focus{border-color:#4a90ff}
  button{width:100%;margin-top:16px;padding:12px;border:0;border-radius:9px;background:#0b62e0;
    color:#fff;font-size:1rem;font-weight:600;cursor:pointer}
  button:hover{background:#0a56c6}
  .err{color:#ff8a8a;font-size:.85rem;margin:12px 0 0}
</style></head><body>
  <form class="card" method="post" action="/login">
    <p class="brand">Miles</p>
    <p>Conversational Ford vehicle builder — enter the demo passcode to continue.</p>
    <label for="p">Passcode</label>
    <input id="p" name="passcode" type="password" autocomplete="current-password" autofocus>
    <button type="submit">Enter</button>
    <!--ERR-->
  </form>
</body></html>"""


@app.get("/healthz")
async def healthz() -> Response:
    return Response("ok", media_type="text/plain")


@app.get("/login")
async def login_page(request: Request):
    if _is_authed(request.cookies):
        return RedirectResponse("/", status_code=302)
    err = request.query_params.get("e") == "1"
    body = _LOGIN_HTML.replace("<!--ERR-->", '<p class="err">Incorrect passcode. Try again.</p>' if err else "")
    return HTMLResponse(body)


@app.post("/login")
async def login_submit(request: Request):
    raw = (await request.body()).decode("utf-8", "ignore")
    supplied = (parse_qs(raw).get("passcode") or [""])[0]
    if MILES_PASSCODE and hmac.compare_digest(supplied, MILES_PASSCODE):
        resp = RedirectResponse("/", status_code=302)
        resp.set_cookie(
            COOKIE_NAME, _expected_token(),
            max_age=COOKIE_MAX_AGE, httponly=True, secure=True, samesite="lax",
        )
        return resp
    return RedirectResponse("/login?e=1", status_code=302)


@app.middleware("http")
async def passcode_gate(request: Request, call_next):
    path = request.url.path
    gated = bool(MILES_PASSCODE) and path not in ("/login", "/healthz")
    if gated and not _is_authed(request.cookies):
        return RedirectResponse("/login", status_code=302)
    # Stream large .glb models with chunked transfer — Cloud Run rejects buffered HTTP/1
    # responses over 32 MiB, and the vehicle model is larger. (Served only past the gate.)
    if request.method == "GET" and path.endswith(".glb") and _STATIC_DIR:
        fp = Path(_STATIC_DIR) / path.lstrip("/")
        if fp.is_file():
            return StreamingResponse(_iterfile(fp), media_type="model/gltf-binary")
    return await call_next(request)


# --------------------------------------------------------------------------- chat pumps

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
    # WebSocket handshakes bypass HTTP middleware, so enforce the passcode here too.
    if MILES_PASSCODE and not _is_authed(ws.cookies):
        await ws.close(code=1008)  # policy violation
        return
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


# Serve the built frontend for the single-service deploy (the container sets MILES_STATIC_DIR to
# the Vite `dist/` copied in by the Dockerfile). Mounted LAST so the routes above take precedence;
# html=True serves index.html at "/" and the hashed assets/GLB beneath it.
if _STATIC_DIR and Path(_STATIC_DIR).is_dir():
    app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="static")
