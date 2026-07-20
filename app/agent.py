"""The Miles agent on Gemini Live API (native-audio dialog).

A `Miles` instance owns one persistent bidi session. Mic chunks (PCM16 @ 16 kHz LE)
go in via `send_audio`; typed text via `send_text`. The `events()` async generator
yields UI events: audio chunks (PCM16 @ 24 kHz LE base64), transcripts, tool calls,
phase updates, interruptions.
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
from pathlib import Path

from google import genai
from google.genai import types

from . import kb, memory, tools
from .flags import is_miles3
from .state import SessionState

PERSONA_DIR = Path(__file__).resolve().parent.parent / "content" / "personas"


def _load_persona_tone(persona_id: str) -> str:
    path = PERSONA_DIR / persona_id / "tone.md"
    try:
        return path.read_text(encoding="utf-8").strip()
    except OSError:
        return ""

ROOT = Path(__file__).resolve().parent.parent

MODEL = os.environ.get("MILES_MODEL", "gemini-2.5-flash-native-audio-preview-09-2025")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
VOICE_NAME = os.environ.get("MILES_VOICE", "Charon")


def _build_client() -> genai.Client:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY (or GOOGLE_API_KEY) is not set.")
    return genai.Client(api_key=GEMINI_API_KEY, http_options={"api_version": "v1beta"})


def _convert_schema(schema: dict) -> dict:
    """Strip JSON Schema keys Gemini doesn't accept; recurse into properties/items."""
    if not isinstance(schema, dict):
        return schema
    out: dict = {}
    for k, v in schema.items():
        if k == "additionalProperties":
            continue
        if k == "properties" and isinstance(v, dict):
            out[k] = {pk: _convert_schema(pv) for pk, pv in v.items()}
        elif k == "items":
            out[k] = _convert_schema(v)
        else:
            out[k] = v
    return out


def _build_tool() -> types.Tool:
    decls = []
    for t in tools.load_tool_schemas():
        params = _convert_schema(t.get("input_schema") or {"type": "object", "properties": {}})
        decls.append(types.FunctionDeclaration(
            name=t["name"],
            description=t.get("description", ""),
            parameters=params,
        ))
    return types.Tool(function_declarations=decls)


def _render_system_prompt(mem: dict, now_iso: str) -> str:
    text = (ROOT / "system_prompt.md").read_text(encoding="utf-8")
    subs = {
        "{temp:car_configurations}": json.dumps(kb.load_kb(), ensure_ascii=False),
        "{temp:current_datetime}": now_iso,
        "{temp:past_interactions_summary?}": memory.context_value(mem, "past_interactions_summary"),
        "{user:full_name?}": memory.context_value(mem, "full_name"),
        "{user:email?}": memory.context_value(mem, "email"),
        "{user:location?}": memory.context_value(mem, "location"),
        "{user:height_cm?}": memory.context_value(mem, "height_cm"),
        "{user:test_drive_preferences?}": memory.context_value(mem, "test_drive_preferences"),
        "{user:profiling?}": memory.context_value(mem, "profiling"),
        "{user:car_config?}": memory.context_value(mem, "car_config"),
        "{user:test_drive_appointment?}": memory.context_value(mem, "test_drive_appointment"),
    }
    for token, value in subs.items():
        text = text.replace(token, value)
    text += (
        "\n\n## Voice runtime\n"
        "You are speaking aloud through a real-time voice interface. Keep replies short "
        "(1–2 sentences). Speak naturally; do not narrate stage directions, emoji, or "
        "markdown. The current session state will be appended below; treat it as ground truth."
    )
    # Miles 3.0: append the persona/budget taskflow (supersedes the v2 taskflow when active).
    if is_miles3():
        v3_path = ROOT / "system_prompt_miles3.md"
        if v3_path.exists():
            text += "\n" + v3_path.read_text(encoding="utf-8")
    return text


def _result_for_function_response(raw: str, is_error: bool) -> dict:
    if is_error:
        return {"error": raw}
    try:
        obj = json.loads(raw)
    except (ValueError, TypeError):
        return {"result": raw}
    return obj if isinstance(obj, dict) else {"result": obj}


class Miles:
    """One Live API session per instance."""

    def __init__(self, now_iso: str = "2026-05-30T10:00:00Z"):
        self.client = _build_client()
        self.memory = memory.load()
        self.state = SessionState(full_name=self.memory.get("full_name"))
        self.state.profile = dict(self.memory.get("profiling") or {})
        self.system_text = _render_system_prompt(self.memory, now_iso)
        self.tool = _build_tool()
        self._session = None
        self._cm = None
        self._out_queue: asyncio.Queue = asyncio.Queue()
        self._state_dirty = False
        self._tone_injected: str | None = None  # persona id whose tone.md has been injected

    def _config(self) -> types.LiveConnectConfig:
        return types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=types.Content(parts=[types.Part.from_text(text=self.system_text)]),
            tools=[self.tool],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE_NAME),
                ),
            ),
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
        )

    async def __aenter__(self):
        self._cm = self.client.aio.live.connect(model=MODEL, config=self._config())
        self._session = await self._cm.__aenter__()
        # Kick off the greeting: tell Miles a user just opened the chat.
        await self._session.send_client_content(
            turns=[types.Content(role="user", parts=[
                types.Part.from_text(text=self._with_state("(The user has just opened the chat.)")),
            ])],
            turn_complete=True,
        )
        return self

    async def __aexit__(self, exc_type, exc, tb):
        if self._cm is not None:
            await self._cm.__aexit__(exc_type, exc, tb)
        self._cm = None
        self._session = None

    def _state_block(self) -> str:
        return self.state.render_block()

    def _with_state(self, user_text: str) -> str:
        return f"{user_text}\n\n<system-reminder>\n{self._state_block()}\n</system-reminder>"

    async def _maybe_inject_persona_tone(self) -> None:
        """Once the persona locks, hand Miles that persona's voice delta.

        In voice mode the per-turn [STATE] reminder only rides on typed turns (see docs/AUDIT.md
        D1), so we inject the tone as a standalone context turn (turn_complete=False) that persists
        for the rest of the session. Fires once per locked persona.
        """
        if not is_miles3() or self._session is None:
            return
        dominant = self.state.persona.get("dominant")
        if not dominant or dominant == self._tone_injected:
            return
        tone = _load_persona_tone(dominant)
        if not tone:
            return
        self._tone_injected = dominant
        reminder = (
            f"<system-reminder>\nPersona locked: {dominant}. Adopt this voice for the rest of the "
            f"conversation (still ≤40 words, one question):\n{tone}\n</system-reminder>"
        )
        await self._session.send_client_content(
            turns=[types.Content(role="user", parts=[types.Part.from_text(text=reminder)])],
            turn_complete=False,  # context only — do not trigger a response
        )

    # -------- inbound: from the browser --------
    async def send_audio(self, pcm16_16k_bytes: bytes) -> None:
        """Forward a raw PCM16 LE @ 16 kHz mic chunk to the model (auto VAD on)."""
        if not self._session:
            return
        await self._session.send_realtime_input(
            audio=types.Blob(data=pcm16_16k_bytes, mime_type="audio/pcm;rate=16000"),
        )

    async def send_text(self, text: str) -> None:
        if not self._session:
            return
        await self._session.send_client_content(
            turns=[types.Content(role="user", parts=[
                types.Part.from_text(text=self._with_state(text)),
            ])],
            turn_complete=True,
        )

    # -------- outbound: to the browser --------
    async def events(self):
        """Async generator of UI events streamed from the Live session.

        The native-audio Live model returns from `session.receive()` after each
        `turn_complete`. Wrap it in an outer loop so we keep yielding for the
        lifetime of the session.
        """
        assert self._session is not None
        try:
            while True:
                async for msg in self._session.receive():
                    sc = msg.server_content
                    if sc:
                        # Audio out (PCM16 LE @ 24 kHz).
                        if sc.model_turn and sc.model_turn.parts:
                            for p in sc.model_turn.parts:
                                if p.inline_data and p.inline_data.data:
                                    yield {
                                        "type": "audio",
                                        "data": base64.b64encode(p.inline_data.data).decode("ascii"),
                                        "mime_type": p.inline_data.mime_type or "audio/pcm;rate=24000",
                                    }
                        # Live transcriptions.
                        if sc.input_transcription and sc.input_transcription.text:
                            yield {"type": "transcript", "role": "user",
                                   "text": sc.input_transcription.text,
                                   "final": bool(getattr(sc.input_transcription, "finished", False))}
                        if sc.output_transcription and sc.output_transcription.text:
                            yield {"type": "transcript", "role": "miles",
                                   "text": sc.output_transcription.text,
                                   "final": bool(getattr(sc.output_transcription, "finished", False))}
                        if sc.interrupted:
                            yield {"type": "interrupted"}
                        if sc.turn_complete:
                            yield {"type": "turn_complete", "phase": self.state.phase}

                    # Tool calls.
                    if msg.tool_call and msg.tool_call.function_calls:
                        responses = []
                        for fc in msg.tool_call.function_calls:
                            args = dict(fc.args or {})
                            result, is_error = tools.execute(fc.name, args, self.state, self.memory)
                            payload = None
                            if not is_error:
                                try:
                                    payload = json.loads(result)
                                except (ValueError, TypeError):
                                    payload = {"raw": result}
                            yield {
                                "type": "tool", "tool": fc.name, "ok": not is_error,
                                "payload": payload, "phase": self.state.phase,
                                "config": dict(self.state.config),
                            }
                            responses.append(types.FunctionResponse(
                                id=fc.id, name=fc.name,
                                response=_result_for_function_response(result, is_error),
                            ))
                        await self._session.send_tool_response(function_responses=responses)
                        # A tool may have just completed discovery → (re)score persona and, once it
                        # locks, hand Miles the matching voice (works in voice mode; see D1).
                        self.state.update_persona()
                        await self._maybe_inject_persona_tone()
        except Exception as exc:
            import traceback
            print(f"[events] EXC: {type(exc).__name__}: {exc}", flush=True)
            traceback.print_exc()
            raise
