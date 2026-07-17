interface Props {
  connected: boolean;
  started: boolean;
  micActive: boolean;
  speaking: boolean;
  onStart: () => void;
  onToggleMic: () => void;
}

/**
 * Bottom-left voice control. The conversation is purely spoken — there are no chat bubbles.
 * Before `started`, a single "Start" button unlocks audio playback; after that it's a push-to-talk
 * mic pill that pulses while listening and glows softly while Miles is speaking.
 */
export function VoiceControl({ connected, started, micActive, speaking, onStart, onToggleMic }: Props) {
  if (!started) {
    return (
      <div className="voice">
        <button className="voice-start" type="button" onClick={onStart}>
          <span className="voice-spark" aria-hidden="true">✦</span>
          <span>Tap to start a conversation with Miles</span>
        </button>
      </div>
    );
  }

  return (
    <div className="voice">
      <button
        className={`voice-mic ${micActive ? "is-on" : ""} ${speaking ? "is-speaking" : ""}`}
        type="button"
        aria-label={micActive ? "Stop listening" : "Start listening"}
        aria-pressed={micActive}
        disabled={!connected}
        onClick={onToggleMic}
      >
        {micActive ? "■" : "🎤"}
      </button>
      <span className="voice-status">
        {!connected ? "Connecting…" : micActive ? "Listening…" : speaking ? "Miles is speaking…" : "Tap to talk"}
      </span>
    </div>
  );
}
