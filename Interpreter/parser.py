from typing import List
from .lexer import Token, TokenType
from .ast_nodes import play, edit

class ParserError(Exception):
    pass

class Parser:
    def __init__(self, tokens: List[Token], mode: str = "play"):
        self.tokens = tokens
        self.pos = 0
        self.mode = mode.lower() if mode in ("play", "edit") else "play"

        self.play_cmds = {
            "file": lambda: play.File(self._expect(TokenType.IDENT).text),
            "start": lambda: play.Start(),
            "word": self._parse_word,
            "words": lambda: play.Words(),
            "max_guesses": lambda: play.MaxGuesses(int(self._expect(TokenType.INT).text)),
            "guess": lambda: play.Guess(self._expect(TokenType.IDENT).text),
            "show": lambda: play.Show(),
            "edit": lambda: play.Edit(),
            "help": lambda: play.Help(),
            "quit": lambda: play.Quit(),
        }

        self.edit_cmds = {
            "create": self._parse_create,
            "file": lambda: edit.File(self._expect(TokenType.IDENT).text),
            "deletefile": lambda: edit.DeleteFile(self._expect(TokenType.IDENT).text),
            "categories": self._parse_categories,
            "add": self._parse_add,
            "list": lambda: edit.ListWords(),
            "edit": self._parse_edit,
            "delete": lambda: edit.Delete(int(self._expect(TokenType.INT).text)),
            "done": lambda: edit.Done(),
            "help": lambda: edit.Help(),
        }

    def _peek(self):
        return self.tokens[self.pos] if self.pos < len(self.tokens) else Token(TokenType.EOF, "")

    def _advance(self):
        tok = self._peek()
        self.pos += 1
        return tok

    def _expect(self, ttype: TokenType):
        tok = self._peek()
        if tok.type != ttype:
            raise ParserError(f"Expected {ttype}, got {tok.type} ('{tok.text}')")
        return self._advance()

    def parse(self):
        tok = self._peek()
        if tok.type != TokenType.IDENT:
            raise ParserError(f"Command expected, got {tok.type} ('{tok.text}')")
        cmd_name = tok.text.lower()
        self._advance()

        if cmd_name == "help":
            return edit.Help() if self.mode == "edit" else play.Help()

        if self.mode == "play" and cmd_name in self.play_cmds:
            return self.play_cmds[cmd_name]()
        if self.mode == "edit" and cmd_name in self.edit_cmds:
            return self.edit_cmds[cmd_name]()

        raise ParserError(f"Unknown command '{cmd_name}' in {self.mode} mode")

    def _parse_word(self):
        next_tok = self._peek()
        if next_tok.type == TokenType.IDENT:
            return play.Word(self._advance().text)
        return play.Word()

    def _parse_categories(self):
        headers = []
        while True:
            tok = self._peek()
            if tok.type in (TokenType.IDENT, TokenType.STRING):
                headers.append(self._advance().text)
            elif tok.type == TokenType.PIPE:
                self._advance()
            else:
                break
        return edit.Categories(headers)

    def _parse_add(self):
        word_tok = self._expect(TokenType.IDENT)
        values = []
        while True:
            tok = self._peek()
            if tok.type in (TokenType.IDENT, TokenType.STRING):
                values.append(self._advance().text)
            elif tok.type == TokenType.PIPE:
                self._advance()
            else:
                break
        return edit.Add(word_tok.text, values)

    def _parse_create(self):
        filename_tok = self._expect(TokenType.IDENT)
        next_tok = self._peek()
        if next_tok.type == TokenType.IDENT:
            self._advance()
        return edit.Create(filename_tok.text)
    
    def _parse_edit(self):
        index_tok = self._expect(TokenType.INT)
        values = []
        while True:
            tok = self._peek()
            if tok.type in (TokenType.IDENT, TokenType.STRING):
                values.append(self._advance().text)
            elif tok.type == TokenType.PIPE:
                self._advance()
            else:
                break
        return edit.Edit(int(index_tok.text), values)