import os
import random
import json
from .lexer import Lexer
from .parser import Parser, ParserError
from .ast_nodes import play, edit

class InterpreterError(Exception):
    pass

class Interpreter:
    def __init__(self):
        self.mode = "play"
        self.file_mode = "letters"
        self.words = []
        self.word_data = []
        self.categories = []
        self.secret = None
        self.secret_row = None
        self.max_guesses = 6
        self.remaining_guesses = self.max_guesses
        self.current_file = None
        self.current_filename = None
        self.hint_index = 0

    def run_once(self, code: str):
        lexer = Lexer(code)
        tokens = []
        while True:
            tok = lexer.next_token()
            tokens.append(tok)
            if tok.type.name == "EOF":
                break
        try:
            parser = Parser(tokens, self.mode)
            node = parser.parse()
            return self.eval(node)
        except ParserError as e:
            return f"Syntax Error: {e}"

    def eval(self, node):
        if isinstance(node, (play.Help, edit.Help)):
            node = play.Help() if self.mode == "play" else edit.Help()
        if self.mode == "play":
            return self._eval_play(node)
        if self.mode == "edit":
            return self._eval_edit(node)
        raise InterpreterError(f"Invalid mode {self.mode}")

    def _eval_play(self, node):
        if isinstance(node, play.Help):
            lines = [
                "\n=== Play Mode Commands ===",
                "file <filename>        - Load a word bank to play",
                "start                  - Start the game session",
                "word [<word>]          - Select or randomize a secret word",
                "guess <word>           - Submit your guess",
                "show                   - Display the current secret word",
                "words                  - List all words in the current word bank",
                "max_guesses <n>        - Set the maximum number of guesses",
                "edit                   - Switch to edit mode",
                "help                   - Show this help message",
                "quit                   - Exit the game",
            ]
            return "\n".join(lines)

        if isinstance(node, play.File):
            return self._load_file(node.filename)

        if isinstance(node, play.Start):
            if not self.current_file:
                return "Error: No word bank loaded."
            if not self.words:
                return "Error: Word bank empty."
            self.secret = None
            self.secret_row = None
            self.hint_index = 0
            self.remaining_guesses = self.max_guesses
            if self.file_mode == "letters":
                return "Game started in LETTERS mode. Use 'word' or 'word <word>' to choose a secret word."
            elif self.file_mode == "hints":
                return "Game started in HINTS mode. Use 'word' or 'word <word>' to select a secret word."
            elif self.file_mode == "categories":
                return "Game started in CATEGORIES mode. Use 'word' or 'word <word>' to select a secret word."
            else:
                return "Unknown game mode."

        if isinstance(node, play.Word):
            if not self.current_file:
                return "Error: No word bank loaded."
            if not self.words:
                return "Error: Word bank empty."
            if node.word:
                if node.word not in self.words:
                    return f"Error: Word '{node.word}' not in bank."
                idx = self.words.index(node.word)
            else:
                idx = random.randrange(len(self.words))
            self.secret = self.words[idx]
            self.secret_row = self.word_data[idx]
            self.hint_index = 0
            self.remaining_guesses = self.max_guesses
            if self.file_mode == "hints":
                if len(self.secret_row) > 1:
                    if self.hint_index < len(self.secret_row) - 1:
                        self.hint_index += 1
                        extra = self.secret_row[self.hint_index]
                if extra:
                    return f"Secret word has been set. Use 'guess <word>' to start guessing.\nHint: {extra}"
            else:
                return f"Secret word has been set. Use 'guess <word>' to start guessing."

        if isinstance(node, play.Guess):
            if not self.secret:
                return "Error: No secret word chosen."
            if self.remaining_guesses <= 0:
                return "No guesses left."
            if node.word not in self.words:
                return f"Error: Word '{node.word}' not in bank." 
            self.remaining_guesses -= 1
            feedback = self._make_feedback(node.word)
            if node.word == self.secret:
                win_msg = {"result": "win", "feedback": feedback}
                self.secret = None
                self.secret_row = None
                return json.dumps(win_msg)
            extra = None
            if self.file_mode == "hints":
                if len(self.secret_row) > 1:
                    if self.hint_index < len(self.secret_row) - 1:
                        self.hint_index += 1
                        extra = self.secret_row[self.hint_index]
            result = {"result": "continue", "feedback": feedback, "remaining": self.remaining_guesses}
            if extra:
                result["hint"] = extra
            return json.dumps(result)

        if isinstance(node, play.Show):
            if not self.secret:
                return "No secret word chosen."
            return f"The secret word is: {self.secret}"

        if isinstance(node, play.Words):
            if not self.current_file:
                return "Error: No word bank loaded."
            return "Words: " + ", ".join(self.words)

        if isinstance(node, play.MaxGuesses):
            self.max_guesses = node.n or 6
            self.remaining_guesses = self.max_guesses
            return f"Max guesses set to {self.max_guesses}"

        if isinstance(node, play.Edit):
            self.mode = "edit"
            return "Switched to edit mode. Type 'help' for edit commands."

        if isinstance(node, play.Quit):
            raise SystemExit()

        return f"Unknown play command: {node}"

    def _make_feedback(self, guess):
        if self.file_mode == "categories":
            if guess not in self.words:
                return ["❌ Word not in list."]
            g_idx = self.words.index(guess)
            g_row = self.word_data[g_idx]
            feedback = []
            for i in range(1, len(g_row)):
                if i < len(self.secret_row) and g_row[i].strip().lower() == self.secret_row[i].strip().lower():
                    feedback.append(f"{self.categories[i-1]}: ✅ ({g_row[i]})")
                else:
                    feedback.append(f"{self.categories[i-1]}: ❌ ({g_row[i]})")
            return feedback
        elif self.file_mode == "letters":
            secret = self.secret
            feedback = []
            for i, ch in enumerate(guess):
                if i < len(secret) and ch == secret[i]:
                    feedback.append("🟩")
                elif ch in secret:
                    feedback.append("🟨")
                else:
                    feedback.append("⬜")
            return "".join(feedback)
        elif self.file_mode == "hints":
            if guess == self.secret:
                return f"✅ Correct! The word was '{self.secret}'."
            else:
                return "❌ Incorrect guess."
        return "Invalid feedback mode."

    def _eval_edit(self, node):
        if isinstance(node, edit.Help):
            lines = [
                "\n=== Edit Mode Commands ===",
                "create <filename>                            - Create a new word bank file",
                "file <filename>                              - Load an existing word bank file",
                "deletefile <filename>                        - Delete a word bank file",
                "categories <cat1> | <cat2> | <cat3>          - Define categories (for categories mode)",
                "add <word>                                   - Add a word (letters mode)",
                "add <word> | <val1> | <val2> | <val3>        - Add a word with values or hints",
                "list                                         - Display all entries in the current file",
                "edit <index> | <new values>                  - Edit a word entry",
                "delete <index>                               - Delete a word by its index",
                "done                                         - Exit edit mode and return to play mode",
                "help                                         - Show this help message",
            ]
            return "\n".join(lines)

        if isinstance(node, edit.Create):
            return self._create_file(node.filename)

        if isinstance(node, edit.File):
            return self._load_file(node.filename)

        if isinstance(node, edit.DeleteFile):
            return self._delete_file(node.filename)

        if isinstance(node, edit.Categories):
            if not self.current_file:
                return "Error: No file loaded."
            self.categories = node.headers
            self.file_mode = "categories"
            return self._save_file()

        if isinstance(node, edit.Add):
            if not self.current_file:
                return "Error: No file loaded."
            row = [node.word] + node.values
            if self.file_mode == "letters" and len(row) > 1:
                if self.categories:
                    self.file_mode = "categories"
                else:
                    self.file_mode = "hints"
            expected_len = 1 + len(self.categories)
            if self.file_mode == "categories" and len(row) != expected_len:
                return f"Error: Expected {expected_len} values (1 word + {len(self.categories)} categories), got {len(row)}"

            self.word_data.append(row)
            self.words.append(node.word)
            return self._save_file()

        if isinstance(node, edit.ListWords):
            if not self.current_file:
                return "Error: No file loaded."
            if not self.word_data:
                return "No words available."
            lines = []
            if self.categories:
                lines.append("word | " + " | ".join(self.categories))
                lines.append("-" * len(lines[0]))
            for row in self.word_data:
                lines.append(" | ".join(row))
            return "\n".join(lines)

        if isinstance(node, edit.Edit):
            if not self.current_file:
                return "Error: No file loaded."
            if node.index < 1 or node.index > len(self.word_data):
                return f"Error: Index {node.index} out of range"
            new_row = node.values
            if self.categories and len(new_row) != len(self.categories) + 1:
                return f"Error: Expected {len(self.categories) + 1} values, got {len(new_row)}"
            self.word_data[node.index - 1] = new_row
            self.words[node.index - 1] = new_row[0]
            return self._save_file()

        if isinstance(node, edit.Delete):
            if not self.current_file:
                return "Error: No file loaded."
            if node.index < 1 or node.index > len(self.word_data):
                return f"Error: Index {node.index} out of range"
            removed = self.word_data.pop(node.index - 1)
            self.words.pop(node.index - 1)
            return f"Deleted word '{removed[0]}'\n" + self._save_file()

        if isinstance(node, edit.Done):
            self.mode = "play"
            return "Exiting edit mode, back to play mode."

        return f"Unknown edit command: {node}"

    def _create_file(self, filename):
        folder_path = os.path.join("WordBanks")
        os.makedirs(folder_path, exist_ok=True)

        filepath = os.path.join(folder_path, filename)
        
        if os.path.exists(filepath):
            return f"Error: file '{filename}' already exists"
        with open(filepath, "w", encoding="utf-8") as f:
            pass
        self.current_file = filepath
        self.current_filename = filename
        self.words, self.word_data, self.categories = [], [], []
        self.file_mode = "letters"
        return f"Created '{filename}' in letters mode (default)."


    def _load_file(self, filename):
        folder_path = os.path.join("WordBanks")
        filepath = os.path.join(folder_path, filename)
        
        if not os.path.exists(filepath):
            return f"Error: file '{filename}' not found"
        with open(filepath, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip()]
        if not lines:
            self.words, self.word_data, self.categories = [], [], []
            self.current_file = filepath
            self.current_filename = filename
            self.file_mode = "letters"
            return f"Loaded file '{filename}' (empty)"
        first_line = lines[0]
        if "|" in first_line:
            if first_line.lower().startswith("word |"):
                file_mode = "categories"
            else:
                file_mode = "hints"
        else:
            file_mode = "letters"
        self.words, self.word_data, self.categories = [], [], []
        self.current_file = filepath
        self.current_filename = filename
        self.file_mode = file_mode
        if file_mode == "letters":
            self.words = lines
            self.word_data = [[w] for w in lines]
        elif file_mode == "hints":
            for line in lines:
                parts = [p.strip() for p in line.split("|")]
                self.word_data.append(parts)
                self.words.append(parts[0])
        elif file_mode == "categories":
            headers = [h.strip() for h in lines[0].split("|")]
            if headers[0].lower() != "word":
                return f"Error: Invalid categories file '{filename}' (missing 'word' header)"
            self.categories = headers[1:]
            for line in lines[1:]:
                parts = [p.strip() for p in line.split("|")]
                if not parts or not parts[0]:
                    continue
                self.word_data.append(parts)
                self.words.append(parts[0])
        return f"Loaded file '{filename}' ({file_mode} mode, {len(self.words)} entries)"

    def _save_file(self):
        if not self.current_file:
            return "Error: no file selected"
        with open(self.current_file, "w", encoding="utf-8") as f:
            if self.file_mode == "categories":
                if self.categories:
                    f.write("word | " + " | ".join(self.categories) + "\n")
                for row in self.word_data:
                    f.write(" | ".join(row) + "\n")
            elif self.file_mode == "hints":
                for row in self.word_data:
                    f.write(" | ".join(row) + "\n")
            elif self.file_mode == "letters":
                for row in self.word_data:
                    f.write(row[0] + "\n")
        return f"Saved to '{self.current_filename}'"

    def _delete_file(self, filename):
        folder_path = os.path.join("..", "WordBanks")
        filepath = os.path.join(folder_path, filename)
        
        if not os.path.exists(filepath):
            return f"Error: file '{filename}' does not exist"
        os.remove(filepath)
        if self.current_file == filename:
            self.current_file, self.words, self.word_data, self.categories = None, [], [], []
        return f"Deleted file '{filename}'"