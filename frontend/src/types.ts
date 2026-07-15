// Mirrors the event shapes emitted by app/agent.py and forwarded by app/web.py.

export interface ToolEvent {
  type: "tool";
  tool: string;
  ok: boolean;
  payload: any;
  phase: string;
  config: Record<string, string | undefined>;
}
export interface AudioEvent {
  type: "audio";
  data: string; // base64 PCM16 LE @ 24kHz
  mime_type?: string;
}
export interface TranscriptEvent {
  type: "transcript";
  role: "user" | "miles";
  text: string;
  final?: boolean;
}
export interface InterruptedEvent { type: "interrupted"; }
export interface TurnCompleteEvent { type: "turn_complete"; phase: string; }
export interface ErrorEvent { type: "error"; message: string; }
export interface AssistantEvent { type: "assistant"; text: string; phase: string; }
export type ServerEvent =
  | ToolEvent | AudioEvent | TranscriptEvent
  | InterruptedEvent | TurnCompleteEvent | ErrorEvent | AssistantEvent;

export type Role = "user" | "miles" | "system";
export interface ChatMessage {
  role: Role;
  text: string;
  partial?: boolean;
}

import type { RigState } from "./three/rig";

export interface StageState {
  model?: string;
  exteriorColor?: string;
  wheel?: string;
  interior?: string;
  finalized: boolean;
  rig?: RigState;
}
