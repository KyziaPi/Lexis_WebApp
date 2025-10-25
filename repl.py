from Interpreter import Interpreter, InterpreterError
import json
import sys

COLORS = {
    "🟩": "\033[92m🟩\033[0m",
    "🟨": "\033[93m🟨\033[0m",
    "⬜": "\033[90m⬜\033[0m",
    "✅": "\033[92m✅\033[0m",
    "❌": "\033[91m❌\033[0m"
}

def render_feedback(raw):
    """Format feedback returned from the interpreter, including JSON results."""
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            return raw

        fb = data.get("feedback", [])
        if isinstance(fb, list):
            # Join and color category-style feedback
            feedback_text = "\n".join(fb)
        else:
            # Color word-style feedback like 🟩🟨⬜
            feedback_text = "".join(COLORS.get(ch, ch) for ch in str(fb))

        extra = []
        if "hint" in data:
            extra.append(f"Hint: {data['hint']}")
        if "remaining" in data:
            extra.append(f"Guesses left: {data['remaining']}")
        if data.get("result") == "win":
            extra.append("🎉 You guessed it!")

        return "\n".join(filter(None, [feedback_text] + extra))
    except json.JSONDecodeError:
        return raw


def repl():
    print("Welcome to Lexis DSL Interpreter!")
    print("Type 'help' for available commands, 'quit' to exit.\n")

    interp = Interpreter()

    while True:
        try:
            mode = interp.mode.capitalize()
            file_info = f" [{interp.current_filename}]" if interp.current_filename else ""
            prompt = f"[{mode}]{file_info} >>> "

            command = input(prompt).strip()
            if not command:
                continue

            result = interp.run_once(command)
            if result:
                print(render_feedback(result))

        except KeyboardInterrupt:
            print("\n(Interrupted) Type 'quit' to exit.\n")
            continue
        except InterpreterError as e:
            print(f"Interpreter Error: {e}\n")
        except SystemExit:
            print("Goodbye!")
            sys.exit(0)
        except Exception as e:
            print(f"Runtime Error: {e}\n")


if __name__ == "__main__":
    repl()