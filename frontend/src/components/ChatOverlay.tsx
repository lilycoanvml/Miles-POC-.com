import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage } from "../types";

interface Props {
  messages: ChatMessage[];
  connected: boolean;
  started: boolean;
  micActive: boolean;
  speaking: boolean;
  onStart: () => void;
  onSend: (text: string) => void;
  onToggleMic: () => void;
}

/** Floating bottom-left conversation + "Ask anything" pill with push-to-talk mic.
 *  Before `started`, shows a single "Start" button (needed to unlock audio playback). */
export function ChatOverlay({
  messages, connected, started, micActive, speaking, onStart, onSend, onToggleMic,
}: Props) {
  const [draft, setDraft] = useState("");
  const recent = messages.slice(-3);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
  }

  return (
    <div className="overlay">
      <div className="overlay-msgs" ref={listRef}>
        {recent.map((m, i) => (
          <div key={i} className={`obubble obubble-${m.role}${m.partial ? " obubble-partial" : ""}`}>
            {m.text}
          </div>
        ))}
        {speaking && <div className="obubble obubble-miles obubble-typing">●●●</div>}
      </div>

      {!started ? (
        <button className="ask ask-start" type="button" onClick={onStart}>
          <span className="ask-spark" aria-hidden>✦</span>
          <span className="ask-start-text">Tap to start a conversation with Miles</span>
        </button>
      ) : (
        <form className="ask" onSubmit={submit}>
          <span className="ask-spark" aria-hidden>✦</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={micActive ? "Listening…" : "Ask anything"}
            disabled={!connected}
          />
          <button
            className={`ask-mic ${micActive ? "ask-mic-on" : ""}`}
            type="button"
            aria-label={micActive ? "Stop listening" : "Start listening"}
            aria-pressed={micActive}
            disabled={!connected}
            onClick={onToggleMic}
          >
            {micActive ? "■" : "🎤"}
          </button>
        </form>
      )}
    </div>
  );
}
