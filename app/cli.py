"""Minimal chat REPL for the Miles POC.

    export ANTHROPIC_API_KEY=...
    python -m app.cli

Type 'quit' to exit. Type '/state' to inspect the current SessionState.
"""
from __future__ import annotations

import sys

from .agent import Miles


def main() -> None:
    bot = Miles()
    print("Miles POC — chat only. Say hello to begin. ('/state' to debug, 'quit' to exit)\n")
    # Miles opens the conversation per the greeting subtask.
    try:
        opening = bot.send("(The user has just opened the chat.)")
        print(f"Miles: {opening}\n")
    except Exception as exc:  # noqa: BLE001
        print(f"[error] {exc}", file=sys.stderr)
        return

    while True:
        try:
            user = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not user:
            continue
        if user.lower() in ("quit", "exit"):
            break
        if user == "/state":
            print(f"  {bot.state.render_block()}\n")
            continue
        try:
            reply = bot.send(user)
        except Exception as exc:  # noqa: BLE001
            print(f"[error] {exc}", file=sys.stderr)
            continue
        print(f"Miles: {reply}\n")


if __name__ == "__main__":
    main()
